#!/usr/bin/env node
// The catalog pipeline CLI (plan 0A.2, 0A.3): one command per step of the flywheel, plus the generated reports.
//   node core/bin/catalog.ts normalise research/trips/x/trails.json
//   node core/bin/catalog.ts match     research/trips/x/trails.json
//   node core/bin/catalog.ts propose   research/trips/x/trails.json        (writes data/catalog/proposals/<id>.json)
//   node core/bin/catalog.ts apply     <proposal id> [--changes ch-001,ch-004]   (default: the auto-accepted changes)
//   node core/bin/catalog.ts freshness [--date 2026-10-17] [--write]
//   node core/bin/catalog.ts coverage  [--date ...] [--write]
//   node core/bin/catalog.ts backlog   [--date ...] [--write]
//   node core/bin/catalog.ts index [--check]  |  dedupe
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, loadDeps, loadLocations } from "../src/catalog/common.ts";
import { findIssues } from "../src/catalog/freshness.ts";
import { matchRecord, placeRows } from "../src/catalog/match.ts";
import { normaliseSidecar } from "../src/catalog/normalise.ts";
import { freshenCatalog } from "../src/catalog/dispatch.ts";
import { runCatalogOp } from "../src/catalog/ops.ts";
import { backlogFor, coverageFor, writeBacklog, writeCoverage } from "../src/catalog/reports.ts";
import { dedupe } from "../src/research/dedupe.ts";
import { indexText, INDEX_PATH, writeIndex } from "../src/research/index.ts";
import { clock } from "../src/ops/run.ts";
import { FileStore } from "../src/store/index.ts";
import { readFileSync, existsSync } from "node:fs";

const USAGE = `Usage: node core/bin/catalog.ts <step> [args] [--root <dir>] [--date YYYY-MM-DD] [--actor <id>] [--json]

Steps:
  normalise <sidecar>        records of a research sidecar as catalog-shaped rows, with warnings
  match <sidecar>            for each record: same entity, possible duplicate, or new
  propose <sidecar...>       write a proposal under data/catalog/proposals/ (nothing else changes)
  apply <proposal> [--changes ch-001,ch-002]   apply the named changes, or the auto-accepted ones
  reject <proposal> [--changes ...]            reject open changes
  undo <proposal> [--changes ...]              undo applied changes from catalog_changes
  freshness [--write]        expired fields on this date; --write marks the rows stale
  coverage [--write]         coverage per area; --write updates data/catalog/coverage.json
  backlog [--write]          the research backlog; --write updates data/catalog/backlog.json
  index [--check]            write research/INDEX.json (--check: fail when it is out of date)
  dedupe                     records and facts repeated across sidecars

--actor defaults to u_owner. TRAVEL_TODAY pins the date.
`;

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  const flag = (n: string): string | undefined => {
    const at = argv.indexOf(n);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const root = resolve(flag("--root") ?? fileURLToPath(new URL("../..", import.meta.url)));
  const json = argv.includes("--json");
  const today = flag("--date") ?? clock().today;
  const actor = { id: flag("--actor") ?? "u_owner", via: "cli" };
  const valued = new Set(["--root", "--date", "--actor", "--changes"]);
  const pos = argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1] ?? ""));
  const step = pos[0]!;
  const args = pos.slice(1);
  const store = new FileStore(root);
  const out = (v: unknown, text: string): void => void process.stdout.write(json ? JSON.stringify(v, null, 2) + "\n" : text + "\n");
  const changes = flag("--changes")?.split(",").filter(Boolean);

  const readSidecar = (p: string) => {
    const f = resolve(root, p);
    if (!existsSync(f)) throw new Error(`no sidecar at ${p}`);
    return JSON.parse(readFileSync(f, "utf8"));
  };

  switch (step) {
    case "normalise": {
      const n = normaliseSidecar(readSidecar(args[0]!), args[0]!, await loadDeps(store));
      out(n, [
        `${n.records.length} record(s) from ${args[0]} (lane ${n.lane}, researched ${n.researched})`,
        ...n.records.map((r) => `  ${r.entity.padEnd(12)} ${String(r.id ?? "(no id)").padEnd(60)} ${r.warnings.length ? `${r.warnings.length} warning(s)` : ""}`),
        ...n.records.flatMap((r) => r.warnings.map((w) => `  WARN ${r.id ?? "?"} ${w.code}: ${w.message}`)),
        ...(n.unknownTags.length ? [`unknown tags: ${n.unknownTags.join(", ")}`] : []),
      ].join("\n"));
      return 0;
    }
    case "match": {
      const n = normaliseSidecar(readSidecar(args[0]!), args[0]!, await loadDeps(store));
      const data = await loadCatalog(store);
      const loc = await loadLocations(store);
      const rows = n.records.map((r) => ({
        entity: r.entity, id: r.id,
        match: matchRecord(r, r.entity === "places" ? placeRows(loc.places) : data.rows(r.entity)),
      }));
      out(rows, rows.map((r) => `  ${r.entity.padEnd(12)} ${String(r.id).padEnd(60)} ${r.match.kind}${r.match.id ? ` ${r.match.id} (${r.match.by}, ${r.match.similarity})` : ""}`).join("\n"));
      return 0;
    }
    case "propose": {
      let rc = 0;
      for (const p of args) {
        const r = await runCatalogOp(store, "catalog.propose", { actor, sidecar: p });
        if (!r.ok) {
          process.stdout.write(`FAILED ${p}: ${r.code}: ${r.message}\n`);
          rc = 1;
          continue;
        }
        const res = (r as { result?: Record<string, any> }).result ?? {};
        out(res, res.proposal_id ? `${p}: proposal ${res.proposal_id}: ${res.changes} change(s), ${res.auto} auto-accepted${res.existing ? " (already on disk, kept)" : ""}` : `${p}: nothing to propose`);
      }
      return rc;
    }
    case "apply":
    case "reject":
    case "undo": {
      const r = await runCatalogOp(store, `catalog.${step}`, { actor, proposal_id: args[0], ...(changes ? { change_ids: changes } : {}) });
      if (json) process.stdout.write(JSON.stringify(r) + "\n");
      else if (!r.ok) process.stdout.write(`FAILED ${r.code}: ${r.message}\n`);
      else process.stdout.write(`OK catalog.${step}: ${JSON.stringify((r as { result?: unknown }).result)}\n`);
      return r.ok ? 0 : 1;
    }
    case "freshness": {
      const data = await loadCatalog(store);
      const issues = findIssues(data, await loadDeps(store), today);
      if (argv.includes("--write")) {
        const r = await freshenCatalog(store, { today, actor });
        out(r, `${r.marked.length} row(s) marked stale on ${today}`);
      } else out(issues, `${issues.length} expired field(s) on ${today}\n` + issues.map((i) => `  ${i.entity}:${i.id} ${i.field} read ${i.read}, ${i.age_days} days (limit ${i.limit_days}, ${i.class})`).join("\n"));
      return 0;
    }
    case "coverage": {
      if (argv.includes("--write")) out({ changed: await writeCoverage(store, today) }, `wrote data/catalog/coverage.json for ${today}`);
      else {
        const c = await coverageFor(store, today);
        out(c, c.areas.map((a) => `  ${a.level.padEnd(8)} ${a.area_id.padEnd(45)} ${a.total.toFixed(2)} ${a.band}`).join("\n"));
      }
      return 0;
    }
    case "backlog": {
      if (argv.includes("--write")) {
        const r = await writeBacklog(store, today);
        out(r, `backlog: ${r.rows} item(s)${r.changed ? ", file updated" : ", unchanged"}`);
      } else {
        const rows = await backlogFor(store, today);
        out(rows, rows.slice(0, 40).map((r) => `  ${String(r.priority).padStart(3)} ${r.id} ${r.reason.padEnd(12)} ${r.area_id ?? "-"} ${r.field ?? ""} (${r.lane})`).join("\n") + (rows.length > 40 ? `\n  ... ${rows.length - 40} more` : ""));
      }
      return 0;
    }
    case "index": {
      if (argv.includes("--check")) {
        const have = existsSync(resolve(root, INDEX_PATH)) ? readFileSync(resolve(root, INDEX_PATH), "utf8") : "";
        if (have !== indexText(root)) {
          process.stdout.write(`${INDEX_PATH} is out of date. Run: node core/bin/catalog.ts index\n`);
          return 1;
        }
        process.stdout.write(`${INDEX_PATH} is up to date\n`);
        return 0;
      }
      process.stdout.write(writeIndex(root) ? `wrote ${INDEX_PATH}\n` : `${INDEX_PATH} unchanged\n`);
      return 0;
    }
    case "dedupe": {
      const r = dedupe(root, await loadDeps(store));
      out(r, [`${r.groups.length} repeated record group(s), ${r.conflicts.length} conflicting fact(s)`,
        ...r.groups.map((g) => `  ${g.kind.padEnd(8)} ${g.entity}: ${g.members.map((m) => `${m.id} (${m.path})`).join(" = ")}`),
        ...r.conflicts.map((c) => `  conflict ${c.key}: ${c.values.map((v) => `${JSON.stringify(v.value)} (${v.path})`).join(" vs ")}`)].join("\n"));
      return 0;
    }
    default:
      process.stderr.write(`Unknown step "${step}".\n${USAGE}`);
      return 2;
  }
}

process.exit(await main(process.argv.slice(2)));
