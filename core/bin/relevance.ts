#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveAll } from "../src/relevance/derive.ts";
import type { Derived } from "../src/relevance/derive.ts";
import { THRESHOLDS, tierIdx, TIERS } from "../src/relevance/fit.ts";
import { HouseholdHubError, loadDeriveInput, loadRelevanceDocs } from "../src/relevance/inputs.ts";
import type { PointsFile } from "../src/relevance/inputs.ts";
import { duplicateRefs } from "../src/relevance/derivedFiles.ts";
import { SignalsClient, USER_AGENT } from "../src/relevance/signals.ts";
import { REL_ERROR_LIST, REL_WARNING_LIST } from "../src/validate/codes.ts";
import { validateFile } from "../src/validate/index.ts";
import { relevanceFiles } from "../src/relevance/refs.ts";

const USAGE = `Usage: node core/bin/relevance.ts <command> [options]

Commands:
  check                        validate every data/relevance/<trip>/<lane>.json (E_REL_* errors, W_REL_* warnings) and
                               refs shared across a trip's files. Offline.
  derive [--write|--check]     compute substitutes, detour, fits, role, badge and the far pointer from the records, the
                               cached signals and data/relevance/inputs/. --write stores derived/<trip>.json; --check
                               exits 1 when a stored file differs. Offline.
  signals --fetch [--osm] [--refresh] [--max-age-days n]
                               read Wikidata and Wikipedia page views for the confirmed QIDs of every record (and the
                               QIDs of parent designations); with --osm also Overpass class counts within 25 km.
                               Sequential, cached, identified as ${USER_AGENT}
  calibrate                    print the draw against draw_suggested confusion table (9.1 step 6)
  codes                        list the error and warning codes

Options:
  --root <dir>    repository root (default: two levels above this file)
  --today <iso>   date used for staleness and read dates (default: today)
  --window MM-DD:MM-DD   season window for effective_draw in derive
  --json          machine-readable output where a command prints a report
`;

function arg(argv: string[], name: string): string | null {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
}

function check(argv: string[], root: string): number {
  if (argv.includes("--today")) process.env.RELEVANCE_TODAY = arg(argv, "--today") ?? "";
  const json = argv.includes("--json");
  let errors = 0;
  let warnings = 0;
  const report: unknown[] = [];
  const files = relevanceFiles(root);
  for (const f of files) {
    const res = validateFile(f, root);
    const shown = relative(root, f);
    errors += res.errors.length;
    warnings += res.warnings.length;
    if (json) report.push({ file: shown, errors: res.errors, warnings: res.warnings });
    else for (const e of res.errors) process.stdout.write(`ERROR ${e.code} ${shown}#${e.path}: ${e.message}\n`);
  }
  for (const [trip, ref, where] of duplicateRefs(root)) {
    errors++;
    const msg = `ref "${ref}" is in more than one file of ${trip}: ${where.map((w) => relative(root, w)).join(", ")}. Keep one record per ref.`;
    if (json) report.push({ file: `data/relevance/${trip}`, errors: [{ code: "E_REL_DUP_REF", path: "", message: msg }], warnings: [] });
    else process.stdout.write(`ERROR E_REL_DUP_REF data/relevance/${trip}: ${msg}\n`);
  }
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else process.stdout.write(`${errors === 0 ? "OK" : "FAILED"}: ${files.length} relevance file(s), ${errors} error(s), ${warnings} warning(s)\n`);
  return errors > 0 ? 1 : 0;
}

function tripWindow(root: string, trip: string): { from: string; to: string } | null {
  const p = join(root, "data", "relevance", "inputs", "points.json");
  if (!existsSync(p)) return null;
  return (JSON.parse(readFileSync(p, "utf8")) as PointsFile).trips?.[trip]?.window ?? null;
}

function deriveFiles(root: string, window: { from: string; to: string } | null): Map<string, string> {
  const { input, trips } = loadDeriveInput(root, window);
  const out = new Map<string, string>();
  for (const [trip, refs] of trips) {
    const w = window ?? tripWindow(root, trip);
    const all = deriveAll({ ...input, window: w });
    const mine = new Set(refs);
    const items: Derived[] = all.filter((d) => mine.has(d.ref));
    out.set(trip, JSON.stringify({ schema: "relevance-derived/1", trip, thresholds: THRESHOLDS, window: w, items }, null, 2) + "\n");
  }
  return out;
}

function derive(argv: string[], root: string): number {
  const win = arg(argv, "--window");
  const window = win ? { from: win.split(":")[0]!, to: win.split(":")[1]! } : null;
  let files: Map<string, string>;
  try {
    files = deriveFiles(root, window);
  } catch (e) {
    if (e instanceof HouseholdHubError) {
      process.stderr.write(e.message + "\n");
      return 1;
    }
    throw e;
  }
  const dir = join(root, "data", "relevance", "derived");
  let drift = 0;
  for (const [trip, text] of files) {
    const path = join(dir, `${trip}.json`);
    if (argv.includes("--write")) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    } else if (argv.includes("--check") && (!existsSync(path) || readFileSync(path, "utf8") !== text)) {
      drift++;
      process.stderr.write(`${relative(root, path)} differs from what derive produces; run: node core/bin/relevance.ts derive --write\n`);
    } else if (!argv.includes("--check")) {
      const j = JSON.parse(text) as { items: Derived[] };
      for (const d of j.items) {
        process.stdout.write(`${d.ref}\tdraw_suggested ${d.draw_suggested}\ted ${d.effective_draw}\trole ${d.role}\tbadge ${d.badge ?? "-"}\tdetour ${d.detour_min ?? "-"}\n`);
        for (const w of d.warnings) process.stdout.write(`  WARN ${w.code}: ${w.message}\n`);
      }
    }
  }
  if (argv.includes("--write")) process.stdout.write(`wrote ${files.size} derived file(s)\n`);
  else if (argv.includes("--check")) process.stdout.write(`${drift === 0 ? "OK" : "DRIFT"}: ${files.size} derived trip(s), ${drift} out of date\n`);
  return drift > 0 ? 1 : 0;
}

async function signals(argv: string[], root: string): Promise<number> {
  if (!argv.includes("--fetch")) {
    process.stderr.write("signals needs --fetch (it makes network calls)\n");
    return 2;
  }
  const docs = loadRelevanceDocs(root);
  const qids = new Set<string>();
  for (const { doc } of docs) {
    for (const r of doc.records) {
      if (r.wikidata.state === "value" && r.wikidata.v) qids.add(r.wikidata.v);
      for (const d of r.signals.designations.v ?? []) if (d.wikidata) qids.add(d.wikidata);
    }
  }
  const langsFile = join(root, "data", "relevance", "signals", "langs.json");
  const langs = existsSync(langsFile) ? (JSON.parse(readFileSync(langsFile, "utf8")) as { langs: Record<string, string[]> }).langs : {};
  const client = new SignalsClient({
    root,
    refresh: argv.includes("--refresh"),
    maxAgeDays: Number(arg(argv, "--max-age-days") ?? 365),
    today: arg(argv, "--today") ?? undefined,
    log: (l) => process.stderr.write(l + "\n"),
  });
  process.stdout.write(`${qids.size} confirmed QID(s); User-Agent: ${USER_AGENT}\n`);
  const wd = await client.wikidata([...qids], langs);
  await client.pageviews(wd);
  if (argv.includes("--osm")) {
    const pts = existsSync(join(root, "data", "relevance", "inputs", "points.json")) ? (JSON.parse(readFileSync(join(root, "data", "relevance", "inputs", "points.json"), "utf8")) as PointsFile) : null;
    const places = docs.flatMap(({ doc }) => doc.records).flatMap((r) => {
      const p = pts?.points[r.ref];
      return p ? [{ ref: r.ref, class_key: r.class_key, lat: p.lat, lon: p.lon }] : [];
    });
    await client.osm(places);
  }
  process.stdout.write(`${client.requests.length} request(s) made; results cached under data/relevance/signals/\n`);
  return 0;
}

function calibrate(root: string): number {
  const { input } = loadDeriveInput(root);
  const matrix: Record<string, Record<string, number>> = {};
  let total = 0;
  let within1 = 0;
  let far = 0;
  const derived = deriveAll(input);
  for (const d of derived) {
    const r = input.records.find((x) => x.ref === d.ref)!;
    if (r.draw.state !== "value" || !r.draw.v) continue;
    total++;
    const gap = Math.abs(tierIdx(r.draw.v) - tierIdx(d.draw_suggested));
    if (gap <= 1) within1++;
    if (gap >= 3) far++;
    (matrix[r.draw.v] ??= {})[d.draw_suggested] = ((matrix[r.draw.v] ??= {})[d.draw_suggested] ?? 0) + 1;
  }
  process.stdout.write(["draw \\ suggested", ...TIERS].join("\t") + "\n");
  for (const t of TIERS) process.stdout.write([t, ...TIERS.map((s) => matrix[t]?.[s] ?? 0)].join("\t") + "\n");
  const pct = total ? Math.round((within1 / total) * 100) : 100;
  process.stdout.write(`${total} record(s); ${pct}% within one tier (target 80%); ${far} differ by 3 tiers (target 0)\n`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const root = resolve(arg(argv, "--root") ?? fileURLToPath(new URL("../..", import.meta.url)));
  switch (argv[0]) {
    case "check": return check(argv, root);
    case "derive": return derive(argv, root);
    case "signals": return signals(argv, root);
    case "calibrate": return calibrate(root);
    case "codes":
      process.stdout.write([...REL_ERROR_LIST, ...REL_WARNING_LIST].join("\n") + "\n");
      return 0;
    default:
      process.stderr.write(`Unknown command ${argv[0]}.\n${USAGE}`);
      return 2;
  }
}

main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
  process.stderr.write(String(e instanceof Error ? e.stack : e) + "\n");
  process.exit(1);
});
