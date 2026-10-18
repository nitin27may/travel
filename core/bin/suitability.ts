#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectFlat, deriveEffort } from "../src/suitability/derive.ts";
import { loadApplicability } from "../src/suitability/applicability.ts";
import { checkRecord, fieldsOf } from "../src/suitability/level.ts";
import { loadMap } from "../src/suitability/map.ts";
import { assertSpecCounts, migrate } from "../src/suitability/migrate.ts";
import { rebaseOperatorInfo } from "../src/suitability/rebaseBasis.ts";
import { duplicateRefsAcrossFiles, loadScope, missingCoverage } from "../src/suitability/refs.ts";
import type { SuitabilityDoc } from "../src/schema/suitability.ts";
import { SUIT_ERROR_LIST, SUIT_WARNING_LIST } from "../src/validate/codes.ts";
import { validateFile } from "../src/validate/index.ts";

const USAGE = `Usage: node core/bin/suitability.ts <command> [options]

Commands:
  check [--coverage <trip>]   validate every data/suitability/<trip>/*.json (E_SUIT_* errors, W_SUIT_* warnings), refs shared
                              across a trip's files, and with --coverage list the scope refs of the trip no file covers
                              and the level (draft, usable_partial, usable, complete) of each record
  derive [--write] [--trip t] print the computed effort of every record; with --write store the flat catalogue copy
  derive --from-tracks        add gain and loss from L4b track files (off by default; needs data/catalog/trails/geo/*.json)
  fields --ref <ref>          print a record's profile and the paths a lane researches: R (required), A (applicable), N (never)
  fields --kind K --subkind S [--operated] [--all]   the same for a kind and subkind; --all lists the N paths
  migrate [--write] [--check] move the existing child and access fields into data/suitability/<trip>/migrated.json
  rebase-basis [--write] [--trip t] [--keep f1,f2]
                              rewrite basis operator_rule to operator_info on every field that is not a hard limit or a
                              second-list rule (min_rider_age, driver_rule and so on). Dry run unless --write; --keep names
                              more fields to leave as operator_rule. Prints the count per file.
  codes                       list the error and warning codes

Options:
  --root <dir>   repository root (default: two levels above this file)
  --json         machine-readable output where a command prints a report
  --today <iso>  date used for staleness (default: today)
`;

function arg(argv: string[], name: string): string | null {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
}

function suitFiles(root: string, onlyTrip?: string | null): string[] {
  const base = join(root, "data", "suitability");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  for (const trip of readdirSync(base).sort()) {
    if (onlyTrip && trip !== onlyTrip) continue;
    const dir = join(base, trip);
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((n) => n.endsWith(".json")).sort();
    } catch {
      continue; // scope.json and README.md sit beside the trip folders
    }
    for (const n of names) out.push(join(dir, n));
  }
  return out;
}

const write = (path: string, doc: unknown): void => writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");

function check(argv: string[], root: string): number {
  if (argv.includes("--today")) process.env.SUITABILITY_TODAY = arg(argv, "--today") ?? "";
  const json = argv.includes("--json");
  let errors = 0;
  let warnings = 0;
  const report: unknown[] = [];
  const files = suitFiles(root);
  for (const f of files) {
    const res = validateFile(f, root);
    const shown = relative(root, f);
    errors += res.errors.length;
    warnings += res.warnings.length;
    if (json) report.push({ file: shown, errors: res.errors, warnings: res.warnings });
    else {
      for (const e of res.errors) process.stdout.write(`ERROR ${e.code} ${shown}#${e.path}: ${e.message}\n`);
    }
  }
  // one ref in two files of a trip
  const trips = [...new Set(files.map((f) => relative(join(root, "data", "suitability"), f).split("/")[0]!))];
  for (const trip of trips) {
    for (const [ref, where] of duplicateRefsAcrossFiles(root, trip)) {
      errors++;
      const msg = `ref "${ref}" is in more than one file of ${trip}: ${where.map((w) => relative(root, w)).join(", ")}. Keep one record per ref. Example: move the values into the first file and delete the other record.`;
      if (json) report.push({ file: `data/suitability/${trip}`, errors: [{ code: "E_SUIT_DUP_REF", path: "", message: msg }], warnings: [] });
      else process.stdout.write(`ERROR E_SUIT_DUP_REF data/suitability/${trip}: ${msg}\n`);
    }
  }
  const cov = arg(argv, "--coverage");
  if (cov) {
    const missing = missingCoverage(root, cov);
    if (!loadScope(root)) {
      process.stderr.write("data/suitability/scope.json is missing; cannot check coverage\n");
      return 2;
    }
    if (missing.length) {
      errors += missing.length;
      for (const m of missing) process.stdout.write(`ERROR E_SUIT_REF coverage ${cov}: no record for ${m}\n`);
    }
  }
  if (cov && !json) coverageLevels(root, cov);
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else process.stdout.write(`${errors === 0 ? "OK" : "FAILED"}: ${files.length} suitability file(s), ${errors} error(s), ${warnings} warning(s)\n`);
  return errors > 0 ? 1 : 0;
}

/** Applicability spec 8.1, acceptance check 7: the level of every record of a trip, counted once per ref. */
function coverageLevels(root: string, trip: string): void {
  const app = loadApplicability(root);
  const tally = { draft: 0, usable_partial: 0, usable: 0, complete: 0 };
  const lines: string[] = [];
  const seen = new Set<string>();
  const files = suitFiles(root, trip).sort((a, b) => Number(/migrated/.test(a)) - Number(/migrated/.test(b))); // a lane record supersedes a migrated one
  for (const f of files) {
    const doc = JSON.parse(readFileSync(f, "utf8")) as SuitabilityDoc;
    for (const r of doc.records) {
      if (seen.has(r.ref)) continue;
      seen.add(r.ref);
      const c = checkRecord(r, app);
      tally[c.level]++;
      lines.push(`${c.level}\t${r.ref}\t${c.located?.name ?? "no profile"}\t${c.missingRequired.length} required open`);
    }
  }
  process.stdout.write(`levels in ${trip}: ${tally.complete} complete, ${tally.usable} usable, ${tally.usable_partial} usable (partly unverified), ${tally.draft} draft of ${seen.size} record(s)\n`);
  for (const l of lines) process.stdout.write(`  ${l}\n`);
}

function fieldsCommand(argv: string[], root: string): number {
  const app = loadApplicability(root);
  let target: { kind: string; subkind?: string; operated?: boolean } | null = null;
  const ref = arg(argv, "--ref");
  if (ref) {
    for (const f of suitFiles(root)) {
      const hit = (JSON.parse(readFileSync(f, "utf8")) as SuitabilityDoc).records.find((r) => r.ref === ref);
      if (hit) {
        target = { kind: hit.kind, subkind: hit.subkind, operated: hit.operated };
        break;
      }
    }
    if (!target) {
      process.stderr.write(`no record with ref "${ref}" in data/suitability\n`);
      return 2;
    }
  } else if (arg(argv, "--kind")) {
    target = { kind: arg(argv, "--kind")!, subkind: arg(argv, "--subkind") ?? undefined, operated: argv.includes("--operated") };
  } else {
    process.stderr.write("fields needs --ref <ref> or --kind K --subkind S\n");
    return 2;
  }
  const f = fieldsOf(target, app);
  if (!f) {
    process.stderr.write(`kind "${target.kind}" with subkind ${JSON.stringify(target.subkind ?? null)} has no profile: correct it in data/suitability/kind-map.json\n`);
    return 1;
  }
  process.stdout.write(`profile ${f.profile}${f.operated ? " (operated)" : ""}\n`);
  for (const [label, list] of [["R required", f.R], ["A applicable", f.A]] as const) process.stdout.write(`${label} (${list.length}): ${list.join(", ")}\n`);
  process.stdout.write(`N never ask (${f.N.length}): ${argv.includes("--all") ? f.N.join(", ") : "not listed; add --all to list them. Never fill an N field."}\n`);
  return 0;
}

function derive(argv: string[], root: string): number {
  const map = loadMap(root);
  if (argv.includes("--from-tracks")) {
    const dir = join(root, "data", "catalog", "trails", "geo");
    const tracks = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".json")) : [];
    if (tracks.length === 0) {
      process.stdout.write("no track files in data/catalog/trails/geo yet (L4b has not merged): nothing to derive\n");
      return 0;
    }
    process.stderr.write(`${tracks.length} track file(s) found, but the L4b track format is not defined in this lane: derive --from-tracks stays off until S1\n`);
    return 2;
  }
  const doWrite = argv.includes("--write");
  const files = suitFiles(root, arg(argv, "--trip"));
  let changed = 0;
  for (const f of files) {
    const doc = JSON.parse(readFileSync(f, "utf8")) as SuitabilityDoc;
    let touched = false;
    for (const r of doc.records) {
      const e = deriveEffort({ kind: r.kind, subkind: r.subkind, block: r.suitability, ext: r.ext }, map);
      const flat = projectFlat(r, map);
      if (JSON.stringify(r.flat) !== JSON.stringify(flat)) {
        touched = true;
        if (doWrite) r.flat = flat;
      }
      if (!doWrite) process.stdout.write(`${r.ref}\tterrain ${e.terrain ?? "-"} (${e.terrain_basis ?? "-"})\teffort_km ${e.effort_km ?? "-"}\tband ${e.band ?? "-"}\tFE${e.family_effort ?? "-"}${touched && r.flat === undefined ? "\t(no flat copy)" : ""}\n`);
    }
    if (touched) {
      changed++;
      if (doWrite) write(f, doc);
    }
  }
  process.stdout.write(`${doWrite ? "updated" : "would update"} the flat copy in ${changed} of ${files.length} file(s)\n`);
  return !doWrite && changed > 0 ? 1 : 0;
}

function runMigrate(argv: string[], root: string): number {
  const m = migrate(root);
  const json = argv.includes("--json");
  if (json) process.stdout.write(JSON.stringify({ reports: m.reports, offPlan: m.offPlan }, null, 2) + "\n");
  else {
    process.stdout.write("trip\tin scope\tresolved\tany signal\twith data\tlimit conflicts\tage band from PLAN.md\n");
    for (const r of m.reports) process.stdout.write(`${r.trip}\t${r.inScope}\t${r.resolved}\t${r.anySignal}\t${r.withAnyData}\t${r.limitConflicts}\t${r.ageBandFromPlan}\n`);
    for (const o of m.offPlan) process.stdout.write(`off-plan ${o.trip}: ${o.adventures} adventures, ${o.trails} trails, ${o.sights} sights, ${o.limitConflicts} limit conflicts\n`);
  }
  assertSpecCounts(m); // fails loudly when 7.1 does not match
  let drift = 0;
  for (const [rel, doc] of m.docs) {
    const trip = rel.split("/")[0]!;
    const path = join(root, "data", "suitability", rel);
    const text = JSON.stringify(doc, null, 2) + "\n";
    if (argv.includes("--write")) {
      mkdirSync(join(root, "data", "suitability", trip), { recursive: true });
      writeFileSync(path, text);
    } else if (argv.includes("--check") && (!existsSync(path) || readFileSync(path, "utf8") !== text)) {
      drift++;
      process.stderr.write(`${relative(root, path)} differs from what migrate produces; run: node core/bin/suitability.ts migrate --write\n`);
    }
  }
  if (argv.includes("--write")) process.stdout.write(`wrote ${m.docs.size} file(s)\n`);
  return drift > 0 ? 1 : 0;
}

function runRebaseBasis(argv: string[], root: string): number {
  const doWrite = argv.includes("--write");
  const keep = (arg(argv, "--keep") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  let total = 0;
  let touched = 0;
  for (const f of suitFiles(root, arg(argv, "--trip"))) {
    const doc = JSON.parse(readFileSync(f, "utf8")) as SuitabilityDoc;
    const r = rebaseOperatorInfo(doc, { keep });
    if (r.changed === 0) continue;
    touched++;
    total += r.changed;
    process.stdout.write(`${r.changed}\t${relative(root, f)}\n`);
    if (doWrite) write(f, r.doc);
  }
  process.stdout.write(`${doWrite ? "rewrote" : "would rewrite"} ${total} basis value(s) in ${touched} file(s)\n`);
  return 0;
}

function main(argv: string[]): number {
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const root = resolve(arg(argv, "--root") ?? fileURLToPath(new URL("../..", import.meta.url)));
  switch (argv[0]) {
    case "check":
      return check(argv, root);
    case "derive":
      return derive(argv, root);
    case "fields":
      return fieldsCommand(argv, root);
    case "migrate":
      return runMigrate(argv, root);
    case "rebase-basis":
      return runRebaseBasis(argv, root);
    case "codes":
      process.stdout.write([...SUIT_ERROR_LIST, ...SUIT_WARNING_LIST].join("\n") + "\n");
      return 0;
    default:
      process.stderr.write(`Unknown command ${argv[0]}.\n${USAGE}`);
      return 2;
  }
}

process.exit(main(process.argv.slice(2)));
