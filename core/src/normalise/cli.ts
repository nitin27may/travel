// `node core/bin/normalise.ts`: the command line of the normaliser (RIS-N). The engine is run.ts; this file parses arguments and prints.
import { BUDGET_PATH, budgetOf, budgetRises, readBudget, updatedBudget, writeBudget } from "./budget.ts";
import { RUN_ID_RE } from "../schema/rowMeta.ts";
import { findDuplicates } from "./dupes.ts";
import { checkProseLinks } from "./proseLinks.ts";
import { applyReport, changesOf, findingsOf, planNormalise } from "./run.ts";
import { FAMILIES, RULES, TRIP_LEVEL_FAMILIES, type Family, type NormaliseReport } from "./types.ts";

export const USAGE = `Usage: node core/bin/normalise.ts <mode> [options]
       node core/bin/normalise.ts dupes [--trip <trip>] [--json]
       node core/bin/normalise.ts prose-links [--check]
       node core/bin/normalise.ts codes

Brings the research JSON into the storage contract (docs/v2/features/catalogue-intake-and-storage.md 4.1 S1 to S7, RIS-N).

Modes (one of):
  --check     list every change the rules would make and every finding; exit 1 when there is a change or an error. Read-only.
  --report    print what it WOULD change per file family, with counts; always exit 0. Read-only.
  --write     apply the changes to the files (only the changed values move; a second --write changes no byte)
  --budget --check    exit 1 when a count rose above ${BUDGET_PATH} (runs in tools/check-all.sh until RIS-J brings the counts to zero)
  --budget --update   write the budget with the current counts; refuses to raise one

Rules (S1 to S4, S6):
  basis        windows, base plans, seasons: official, operator, computed, plan to the SUIT_BASIS vocabulary (4.2)
  season_shape a season's {value, basis, src, on} becomes a Val {v, state, basis, src, read}
  points       capture-points/1 to /2: point_source text to point_src {provider, element, url, read, quote, legacy} and meta;
               "legacy" keeps the whole old string for a row the migration ledger pins, or text over 300 characters
  origin       the capture 'origin' key to meta.origin; a private-list key (loc:, proto:) is refused, never copied
  estimate     Val.estimate from a note that says "estimate" on a value with basis our_inference (a negated note is skipped)
  unit         "1,200 ft" to metres and so on, the source's form in meta.original
  price_year   a price Val with no year gets applies_to = the year it was read
  date, currency, name, language   ISO 8601, ISO 4217, names as signed, BCP 47 language tags of 'names'
  area, town   delegated to capture.ts migrate-placement and derive-near (never guesses)
Findings (not changed): E_NOTE_LONG, E_SUMMARY_LONG, W_QUOTE_LONG, E_KEEP_UNKNOWN, E_META_*, W_KEEP_UNREAD, E_NORM_PRIVACY,
  E_NORM_REFUSED, E_NORM_LEDGER, W_NORM_CONFLICT (conflicts are kept, never picked), I_NORM_CONFLICT_KEPT.

Options:
  --family <a,b>   limit to families: ${FAMILIES.join(", ")} ('trip-level' = ${TRIP_LEVEL_FAMILIES.join(", ")})
  --file <path>    limit to one file (relative to the root); repeatable
  --run <id>       the run id written into meta.run_id of rows the run starts (default RIS-N)
  --read-default <date>  the read date of a point row whose text names none (default 2026-10-18; the row gets the work tag read-date-imputed)
  --no-placement   skip the delegated area and town rules
  --root <dir>     repository root (default: two levels above this file)
  --json           print the report as JSON
  --quiet          with --check, print only the summary
`;

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};
const args = (argv: string[], name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : []));

export function parseFamilies(spec: string | null): Family[] | { error: string } | undefined {
  if (!spec) return undefined;
  const out: Family[] = [];
  for (const w of spec.split(",").map((x) => x.trim()).filter(Boolean)) {
    if (w === "trip-level") out.push(...TRIP_LEVEL_FAMILIES);
    else if ((FAMILIES as readonly string[]).includes(w)) out.push(w as Family);
    else return { error: `unknown family "${w}"; one of ${FAMILIES.join(", ")}, trip-level` };
  }
  return out;
}

function printSummary(report: NormaliseReport, out: (s: string) => void): void {
  out("");
  out("family       files  changing  changes");
  for (const f of FAMILIES) {
    const s = report.families[f];
    if (s.files === 0 && s.changedFiles === 0) continue;
    const rules = RULES.filter((r) => s.changes[r]).map((r) => `${r} ${s.changes[r]}`).join(", ");
    out(`${f.padEnd(12)} ${String(s.files).padStart(5)}  ${String(s.changedFiles).padStart(8)}  ${rules || "-"}`);
  }
  const codes: Record<string, number> = {};
  for (const f of findingsOf(report)) codes[f.code] = (codes[f.code] ?? 0) + 1;
  out("");
  out(`findings: ${Object.entries(codes).sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => `${c} ${n}`).join(", ") || "none"}`);
  out(`totals: ${report.totals.files} file(s), ${report.totals.changedFiles} would change, ${report.totals.changes} change(s), ${report.totals.errors} error(s), ${report.totals.warnings} warning(s)`);
}

export function normaliseCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    out(USAGE.trimEnd());
    return 0;
  }
  if (argv[0] === "codes") {
    out(["E_NORM_PRIVACY", "W_NORM_PRIVACY", "E_NORM_REFUSED", "E_NORM_LEDGER", "E_NORM_PARSE", "E_NORM_CURRENCY", "W_NORM_CONFLICT", "W_NORM_CONFLICT_SHOWN", "W_NORM_BASIS", "W_NORM_DATE", "W_NORM_LANGUAGE", "W_NORM_PRICE_YEAR", "W_NORM_UNIT", "W_NORM_PLACEMENT_SKIPPED", "W_NORM_COMPUTED_TOOL", "I_NORM_CONFLICT_KEPT"].join("\n"));
    return 0;
  }
  if (argv[0] === "dupes") {
    const found = findDuplicates(root, { ...(arg(argv, "--trip") ? { trip: arg(argv, "--trip")! } : {}) });
    if (argv.includes("--json")) out(JSON.stringify(found, null, 2));
    else {
      for (const d of found) out(`${d.reason.padEnd(11)} ${d.a}  <->  ${d.b}  (${d.detail}${d.distance_m !== undefined ? `, ${d.distance_m} m` : ""})`);
      out(`${found.length} candidate pair(s); the ruling (same_place_as, merge in the slug registry) is a person's`);
    }
    return 0;
  }
  if (argv[0] === "prose-links") {
    const issues = checkProseLinks(root);
    for (const i of issues) out(`${i.kind} ${i.file}${i.line ? `:${i.line}` : ""}: ${i.message}`);
    out(issues.length === 0 ? "OK: every RECORDED marker and research_ref resolves" : `${issues.length} broken link(s)`);
    return argv.includes("--check") && issues.length > 0 ? 1 : 0;
  }

  const fam = parseFamilies(arg(argv, "--family"));
  if (fam && !Array.isArray(fam)) {
    err(fam.error);
    return 2;
  }
  const run = arg(argv, "--run") ?? undefined;
  if (run && !RUN_ID_RE.test(run)) {
    err("--run must be a run id: letters, digits, '.', '_' or '-', at most 80 characters");
    return 2;
  }
  const readDefault = arg(argv, "--read-default") ?? undefined;
  if (readDefault && !/^\d{4}-\d{2}-\d{2}$/.test(readDefault)) {
    err("--read-default must be YYYY-MM-DD");
    return 2;
  }
  const files = args(argv, "--file");
  let report: NormaliseReport;
  try {
    report = planNormalise({ root, ...(fam ? { families: fam } : {}), ...(files.length ? { files } : {}), ...(run ? { run } : {}), ...(readDefault ? { readDefault } : {}), placement: !argv.includes("--no-placement") });
  } catch (e) {
    err(String((e as Error).message));
    return 2;
  }

  if (argv.includes("--budget")) {
    const now = budgetOf(report);
    const pinned = readBudget(root);
    if (argv.includes("--update")) {
      try {
        writeBudget(root, updatedBudget(now, pinned));
      } catch (e) {
        err(String((e as Error).message));
        return 1;
      }
      out(`wrote ${BUDGET_PATH}`);
      return 0;
    }
    if (!pinned) {
      err(`${BUDGET_PATH} is missing; create it with --budget --update`);
      return 1;
    }
    const rises = budgetRises(now, pinned);
    for (const r of rises) out(`RISE ${r}`);
    out(rises.length === 0 ? `OK: no count rose above ${BUDGET_PATH}` : `${rises.length} count(s) rose; fix the data, or run: node core/bin/normalise.ts --write`);
    return rises.length === 0 ? 0 : 1;
  }

  if (argv.includes("--json")) {
    out(JSON.stringify({ run: report.run, totals: report.totals, families: report.families, changes: changesOf(report), findings: findingsOf(report).filter((f) => f.level !== "info"), delegated: report.delegated.map((d) => ({ file: d.file, rule: d.rule })) }, null, 2));
    return argv.includes("--check") ? (report.totals.changedFiles > 0 || report.totals.errors > 0 ? 1 : 0) : 0;
  }

  if (argv.includes("--report")) {
    printSummary(report, out);
    return 0;
  }

  if (argv.includes("--write")) {
    const written = applyReport(report, { placement: !argv.includes("--no-placement") });
    for (const w of written) out(`wrote ${w}`);
    for (const f of findingsOf(report).filter((x) => x.level === "error")) err(`ERROR ${f.code} ${f.file}#${f.path}: ${f.message}`);
    out(`wrote ${written.length} file(s)`);
    return report.totals.errors > 0 ? 1 : 0;
  }

  if (argv.includes("--check")) {
    if (!argv.includes("--quiet")) {
      for (const c of changesOf(report)) out(`CHANGE ${c.rule} ${c.file}#${c.path}${c.note ? ` (${c.note})` : ""}`);
      for (const d of report.delegated) out(`CHANGE ${d.rule} ${d.file} (delegated: ${d.rule === "town" ? "capture.ts derive-near --write" : "capture.ts migrate-placement --write"})`);
      for (const f of findingsOf(report).filter((x) => x.level !== "info")) out(`${f.level === "error" ? "ERROR" : "WARN"} ${f.code} ${f.file}#${f.path}: ${f.message}`);
    }
    printSummary(report, out);
    const bad = report.totals.changedFiles > 0 || report.totals.errors > 0;
    out(bad ? "NOT NORMALISED: run node core/bin/normalise.ts --write (and fix the errors above)" : "OK: the files are in the contract");
    return bad ? 1 : 0;
  }

  err("choose a mode: --check, --report, --write or --budget (see --help)");
  return 2;
}

