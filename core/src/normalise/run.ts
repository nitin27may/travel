// The normaliser's engine (RIS-N): discover files, apply the rules to a copy of each document, report what would change, write it.
//
// Library API (documented for RIS-J, the loader and tests; the CLI is core/bin/normalise.ts):
//   normaliseText(text, ctx)   one document's text in, the new text out, with its changes and findings (pure; no disk)
//   planNormalise(opts)        read-only: the report for a repository root
//   applyReport(report, root)  write the changed files of a report (and run the delegated placement plans again)
//   summarise(report)          counts per family and rule, the shape the budget pins
//
// Guarantees:
//   - idempotent: the output of normaliseText is a fixed point (a second pass changes nothing);
//   - format-preserving: only the bytes of changed values move (jsonPatch.ts), so a diff shows only the normalised paths;
//   - never loses a value of a suitability or relevance record: every leaf a record held before is still there (the migration
//     ledger rule, applied per record); a violation reverts the document and reports E_NORM_LEDGER;
//   - never a private key into meta (records.ts, points.ts refuse and report E_NORM_REFUSED).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { leafHash, leavesOf } from "../capture/migrate.ts";
import { planNearDerivation } from "../capture/deriveNear.ts";
import { planPlacementMigration } from "../capture/migratePlacement.ts";
import { checkDocument } from "./checks.ts";
import { DEFAULT_READ, DEFAULT_RUN, Sink, isObj, type Obj } from "./common.ts";
import { discover } from "./files.ts";
import { patchText } from "./jsonPatch.ts";
import { normalisePoints, pinnedPointRefs } from "./points.ts";
import { normaliseRecord, walkDates } from "./records.ts";
import { normaliseBasis } from "./tripLevel.ts";
import { FAMILIES, type Change, type DocResult, type Family, type FamilySummary, type FileResult, type Finding, type NormaliseOptions, type NormaliseReport, type RuleId } from "./types.ts";

export { DEFAULT_RUN, DEFAULT_READ };

export interface TextContext {
  family: Family;
  /** path shown in changes and findings (relative to the root) */
  file: string;
  run?: string;
  readDefault?: string;
  /** refs the migration ledger pins (see pinnedPointRefs); empty when none */
  pinned?: ReadonlySet<string>;
  /** the repository root, for the freshness class list the meta check reads; null skips that one check */
  root?: string | null;
}

export interface TextResult extends DocResult {
  text: string;
}

/** Multiset containment of record leaves: every leaf of `before` still in `after` (the ledger rule, per record). */
function leavesKept(before: Obj, after: Obj): boolean {
  const have = new Map<string, number>();
  for (const l of leavesOf(after)) have.set(leafHash(l), (have.get(leafHash(l)) ?? 0) + 1);
  for (const l of leavesOf(before)) {
    const h = leafHash(l);
    const n = have.get(h) ?? 0;
    if (n === 0) return false;
    have.set(h, n - 1);
  }
  return true;
}

/** Applies the rules of the document's family to a deep copy of `parsed`. */
function applyRules(parsed: Obj, ctx: TextContext, sink: Sink): Obj {
  const doc = structuredClone(parsed);
  switch (ctx.family) {
    case "capture":
    case "suitability":
    case "relevance": {
      if (Array.isArray(doc.records)) doc.records.forEach((r, i) => isObj(r) && normaliseRecord(r, `/records/${i}`, sink, ctx.family as "capture" | "suitability" | "relevance"));
      // the envelope (researched, sources[].read ...): everything but the records, which normaliseRecord walked
      const { records: _r, ...envelope } = doc;
      walkDates(envelope, "", sink);
      Object.assign(doc, envelope);
      break;
    }
    case "points":
      normalisePoints(doc, sink, ctx.pinned ?? new Set());
      break;
    case "windows":
    case "base-plans":
    case "seasons": {
      normaliseBasis(doc, sink);
      walkDates(doc, "", sink);
      break;
    }
    default:
      walkDates(doc, "", sink);
  }
  return doc;
}

/** One document's text in, the normalised text out. Pure. */
export function normaliseText(text: string, ctx: TextContext): TextResult {
  const sink = new Sink(ctx.file, ctx.family, ctx.run ?? DEFAULT_RUN, ctx.readDefault ?? DEFAULT_READ);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    sink.find("E_NORM_PARSE", "error", "", `not valid JSON: ${(e as Error).message}`);
    return { text, doc: null, changes: [], findings: sink.findings };
  }
  if (!isObj(parsed)) {
    sink.find("E_NORM_PARSE", "error", "", "the document is not a JSON object");
    return { text, doc: parsed, changes: [], findings: sink.findings };
  }
  let doc = applyRules(parsed, ctx, sink);
  let changes = sink.changes;

  // the ledger rule, per record, for the two families the migration ledger covers
  if ((ctx.family === "suitability" || ctx.family === "relevance") && Array.isArray(parsed.records) && Array.isArray(doc.records)) {
    const bad = parsed.records.findIndex((r, i) => isObj(r) && isObj(doc.records && (doc.records as unknown[])[i]) && !leavesKept(r, (doc.records as Obj[])[i]!));
    if (bad >= 0) {
      sink.find("E_NORM_LEDGER", "error", `/records/${bad}`, "the rules would lose or change a value leaf of this record; the document is left as it is (the migration ledger rule)");
      doc = structuredClone(parsed);
      changes = [];
    }
  }

  const same = JSON.stringify(doc) === JSON.stringify(parsed);
  const out = same ? text : patchText(text, parsed, doc);
  const post = new Sink(ctx.file, ctx.family, sink.run, sink.readDefault);
  checkDocument(doc, ctx.family, ctx.root ?? null, post);
  return { text: out, doc, changes: same ? [] : changes, findings: [...sink.findings, ...post.findings] };
}

const emptySummary = (): FamilySummary => ({ files: 0, changedFiles: 0, changes: {}, findings: {} });

/** Counts per family and rule: the shape the budget pins. */
export function summarise(files: readonly FileResult[], delegated: NormaliseReport["delegated"]): Record<Family, FamilySummary> {
  const out = Object.fromEntries(FAMILIES.map((f) => [f, emptySummary()])) as Record<Family, FamilySummary>;
  for (const r of files) {
    const s = out[r.family];
    s.files++;
    if (r.after !== r.before) s.changedFiles++;
    for (const c of r.changes) s.changes[c.rule] = (s.changes[c.rule] ?? 0) + 1;
    for (const f of r.findings) s.findings[f.code] = (s.findings[f.code] ?? 0) + 1;
  }
  for (const d of delegated) {
    out[d.family].changedFiles++;
  }
  return out;
}

function readLedger(root: string): unknown {
  const p = join(root, "data", "capture", "migration-ledger.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** The delegated rules: area chain (META-1) and town ids (META-2), planned by their own tools. Empty when the data they need is absent. */
function planDelegated(root: string, findings: Finding[]): NormaliseReport["delegated"] {
  const out: NormaliseReport["delegated"] = [];
  const note = (rule: string, msg: string): void => void findings.push({ code: "W_NORM_PLACEMENT_SKIPPED", level: "info", file: "", family: "capture", path: "", message: `${rule}: ${msg}` });
  if (!existsSync(join(root, "data", "reference", "towns"))) {
    note("town", "data/reference/towns is missing; the nearest-town rule is skipped");
  } else {
    try {
      const near = planNearDerivation(root);
      near.problems.forEach((p) => note("town", p));
      for (const w of near.writes) out.push({ file: relative(root, w.path), family: "capture", rule: "town", text: w.text });
    } catch (e) {
      note("town", String((e as Error).message));
    }
  }
  try {
    const area = planPlacementMigration(root);
    area.problems.forEach((p) => note("area", p));
    for (const w of area.writes) out.push({ file: relative(root, w.path), family: w.path.endsWith("points.json") ? "points" : "capture", rule: "area", text: w.text });
  } catch (e) {
    note("area", String((e as Error).message));
  }
  return out;
}

/** The read-only report for a repository root. */
export function planNormalise(opts: NormaliseOptions): NormaliseReport {
  const root = opts.root;
  const run = opts.run ?? DEFAULT_RUN;
  const readDefault = opts.readDefault ?? DEFAULT_READ;
  const pinned = pinnedPointRefs(readLedger(root));
  const files: FileResult[] = [];
  for (const f of discover(root, opts.families ?? FAMILIES, opts.files)) {
    const before = readFileSync(f.abs, "utf8");
    const r = normaliseText(before, { family: f.family, file: f.file, run, readDefault, pinned, root });
    files.push({ file: f.file, family: f.family, before, after: r.text, changes: r.changes, findings: r.findings });
  }
  const wantPlacement = (opts.placement ?? true) && (!opts.families || opts.families.includes("capture"));
  const extra: Finding[] = [];
  const delegated = wantPlacement ? planDelegated(root, extra) : [];
  const families = summarise(files, delegated);
  for (const d of delegated) families[d.family].changes[d.rule as RuleId] = (families[d.family].changes[d.rule as RuleId] ?? 0) + 1;
  for (const x of extra) families.capture.findings[x.code] = (families.capture.findings[x.code] ?? 0) + 1;
  let errors = 0, warnings = 0, changes = 0;
  for (const r of files) {
    changes += r.changes.length;
    for (const x of r.findings) x.level === "error" ? errors++ : x.level === "warn" ? warnings++ : 0;
  }
  changes += delegated.length;
  const changedFiles = files.filter((r) => r.after !== r.before).length + delegated.length;
  return { root, run, files, delegated, families, totals: { files: files.length, changedFiles, changes, errors, warnings } };
}

/** The changes of a report as a flat list (the CLI prints them for --check). */
export const changesOf = (report: NormaliseReport): Change[] => report.files.flatMap((f) => f.changes);
export const findingsOf = (report: NormaliseReport): Finding[] => report.files.flatMap((f) => f.findings);

/**
 * Writes the changed files of a report, then plans the delegated rules again from the new disk state and writes those (they edit
 * other keys of the same files, so they run second). Returns the paths written. Refuses to write a delegated plan into a points
 * file already on /2 (their writer produces point_source rows).
 */
export function applyReport(report: NormaliseReport, opts: { placement?: boolean } = {}): string[] {
  const written: string[] = [];
  const put = (rel: string, text: string): void => {
    const p = join(report.root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    written.push(rel);
  };
  for (const f of report.files) if (f.after !== f.before) put(f.file, f.after);
  if (opts.placement ?? true) {
    for (const d of planDelegated(report.root, [])) {
      const cur = existsSync(join(report.root, d.file)) ? readFileSync(join(report.root, d.file), "utf8") : "";
      if (d.file.endsWith("points.json") && cur.includes('"capture-points/2"')) continue;
      put(d.file, d.text);
    }
  }
  return written;
}
