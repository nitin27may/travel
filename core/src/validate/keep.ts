// The keep-or-drop rule and RowMeta, applied to the JSON families (docs/v2/features/catalogue-intake-and-storage.md 2, 3.1 and 3.3;
// RIS-C). Three checks, one place, run after each family's own validator (documents.ts):
//   - E_KEEP_UNKNOWN: a capture record key that is not a registry property, a schema key of capture/1 or a reserved meta key. The
//     capture validator calls `unknownRecordKeys` before its strict parse, so the finding names the rule rather than "unknown key".
//   - text limits on public text: E_SUMMARY_LONG (160), E_NOTE_LONG (Val.note, 280), W_QUOTE_LONG (Val.quote above 120; the hard 300
//     stays in the Val schema, owner Q174 keeps serving up to 300).
//   - every `meta` block where its family allows one, through metaFindings (core/src/validate/rowMeta.ts).
//
// Severity. Today's files already exceed some limits (17 Val notes over 280 when the spec was measured). Those codes run in WARN mode
// (KEEP_ENFORCEMENT) until RIS-J rewrites the files, and core/test/schema/keep-budget.json pins their counts: a count may only fall.
// RIS-J flips a code to "error" here when its count reaches zero. Codes no existing file trips are errors from the start.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { SUIT_STATE } from "../schema/enums.ts";
import { capRecord } from "../schema/capture/records.ts";
import { PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import { FAMILY_META, type MetaTable } from "../schema/rowMeta.ts";
import type { Issue } from "./codes.ts";
import { metaFindings } from "./rowMeta.ts";

/** Public text limits (spec 3.1, owner Q173 and Q174). */
export const SUMMARY_MAX = 160;
export const NOTE_MAX = 280;
export const NOTES_PRIVATE_MAX = 1000;
export const QUOTE_MAX = 300;
export const QUOTE_WARN = 120;

export type Enforcement = "warn" | "error";
/** Severity per code until RIS-J migrates today's JSON. A code not listed is an error. */
export const KEEP_ENFORCEMENT: Readonly<Record<string, Enforcement>> = {
  E_NOTE_LONG: "warn",
  E_SUMMARY_LONG: "warn",
};
export const levelOfKeep = (code: string): Enforcement => (code.startsWith("W_") ? "warn" : KEEP_ENFORCEMENT[code] ?? "error");

/** capture/1 record keys that are schema keys of the family, not registry properties (identity, layer, migration provenance). */
export const CAPTURE_SCHEMA_KEYS: readonly string[] = ["ref", "layer", "aliases", "offer_class", "origin", "route_is_attraction", "attraction_reason", "notes_private"];
/** The reserved row-level key every family may carry. */
export const META_KEY = "meta";

/** The keys a capture record may hold, and why: a property, a family schema key or meta. Pinned against capRecord's shape by the test. */
export function keepClassOf(key: string): "property" | "schema" | "meta" | null {
  if (key === META_KEY) return "meta";
  if (CAPTURE_SCHEMA_KEYS.includes(key)) return "schema";
  if (PROPERTY_BY_KEY.has(key)) return "property";
  return null;
}

/** Keys of a capture record outside the keep rule (E_KEEP_UNKNOWN). `reached_by` has its own code (E_CAP_REL_DERIVED). */
export function unknownRecordKeys(rec: Record<string, unknown>): string[] {
  return Object.keys(rec).filter((k) => k !== "reached_by" && keepClassOf(k) === null);
}

/** The keys of capRecord: the test asserts each has a keep class, so a schema key cannot be added without one. */
export const CAPTURE_RECORD_KEYS: readonly string[] = Object.keys(capRecord.shape);

export interface KeepFinding extends Issue {
  warning: boolean;
}

const STATES: ReadonlySet<string> = new Set(SUIT_STATE);
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
/** A storage Val: `v`, a known `state` and a `src` list. */
const isVal = (x: Obj): boolean => "v" in x && typeof x.state === "string" && STATES.has(x.state) && Array.isArray(x.src);

/** Each storage Val in a document, with its JSON pointer. */
function vals(x: unknown, at: string, out: [string, Obj][]): [string, Obj][] {
  if (Array.isArray(x)) x.forEach((y, i) => vals(y, `${at}/${i}`, out));
  else if (isObj(x)) {
    if (isVal(x)) out.push([at, x]);
    for (const [k, y] of Object.entries(x)) if (k !== META_KEY) vals(y, `${at}/${k}`, out);
  }
  return out;
}

function freshnessIds(root: string | null): ReadonlySet<string> | undefined {
  if (!root) return undefined;
  const p = join(root, "data", "schema", "freshness.json");
  if (!existsSync(p)) return undefined;
  try {
    return new Set((JSON.parse(readFileSync(p, "utf8")) as { classes: { id: string }[] }).classes.map((c) => c.id));
  } catch {
    return undefined;
  }
}

/** The table a capture record's row loads into: an offer is an `offer` row, everything else an `entity` row (1.2). */
const captureTable = (rec: Obj): MetaTable => (rec.layer === "offer" ? "offer" : "entity");

/**
 * The keep and meta findings for one parsed document of a JSON family (`schema` decides). `root` lets the freshness class ids be read;
 * null skips that one check. Pure apart from that read.
 */
export function keepFindings(doc: unknown, root: string | null): KeepFinding[] {
  const out: KeepFinding[] = [];
  if (!isObj(doc) || typeof doc.schema !== "string") return out;
  const push = (code: string, path: string, message: string, warning?: boolean): void =>
    void out.push({ code, path, message, warning: warning ?? levelOfKeep(code) === "warn" });
  // public text in every Val
  for (const [p, v] of vals(doc, "", [])) {
    if (typeof v.note === "string" && v.note.length > NOTE_MAX) push("E_NOTE_LONG", `${p}/note`, `a Val note is public (served through apiVal) and is ${v.note.length} characters; the limit is ${NOTE_MAX}. Keep the method in one or two sentences; move reasoning to the run note and point at it with meta.research_ref.`);
    if (typeof v.quote === "string" && v.quote.length > QUOTE_WARN) push("W_QUOTE_LONG", `${p}/quote`, `a quote of ${v.quote.length} characters (above ${QUOTE_WARN}); it is still served (at most ${QUOTE_MAX}, owner Q174). Trim it to the phrase that proves the value.`, true);
    if (Array.isArray(v.conflicts)) v.conflicts.forEach((c, i) => {
      if (isObj(c) && typeof c.note === "string" && c.note.length > NOTE_MAX) push("E_NOTE_LONG", `${p}/conflicts/${i}/note`, `a conflict note is public and is ${c.note.length} characters; the limit is ${NOTE_MAX}.`);
    });
  }
  const fam = FAMILY_META[doc.schema];
  const propertyKeys = new Set(PROPERTY_BY_KEY.keys());
  const fresh = freshnessIds(root);
  const meta = (m: unknown, at: string, table: MetaTable): void => {
    for (const f of metaFindings(m, at, { table, propertyKeys, ...(fresh ? { freshnessIds: fresh } : {}) })) out.push({ code: f.code, path: f.path, message: f.message, warning: f.warning === true });
  };
  if (!fam) return out;
  if (fam.at === "records[]" && Array.isArray(doc.records)) {
    doc.records.forEach((r, i) => {
      if (!isObj(r)) return;
      // the public summary: the relevance `why` (registry summary home) is the one sentence a card shows
      if (doc.schema === "relevance/1" && typeof r.why === "string" && r.why.length > SUMMARY_MAX) push("E_SUMMARY_LONG", `/records/${i}/why`, `the summary is ${r.why.length} characters; the limit is ${SUMMARY_MAX}. One sentence in our own words.`);
      if (META_KEY in r) meta(r.meta, `/records/${i}/meta`, doc.schema === "capture/1" ? captureTable(r) : fam.table);
    });
  } else if (fam.at === "points{}" && isObj(doc.points)) {
    for (const [ref, row] of Object.entries(doc.points)) if (isObj(row) && META_KEY in row) meta(row.meta, `/points/${ref.replace(/~/g, "~0").replace(/\//g, "~1")}/meta`, fam.table);
  } else if (fam.at === "operators[]" && Array.isArray(doc.operators)) {
    doc.operators.forEach((o, i) => {
      if (isObj(o) && META_KEY in o) meta(o.meta, `/operators/${i}/meta`, fam.table);
    });
  } else if (fam.at === "." && META_KEY in doc) meta(doc.meta, "/meta", fam.table);
  return out;
}

// ---- the budget: what today's files trip, so the counts can only fall (core/test/schema/keep-budget.json) ----

export interface KeepCounts {
  /** findings per code over every capture, suitability and relevance file and the capture points file */
  codes: Record<string, number>;
  /** records still carrying the capture `origin` key, which RIS-J moves to meta.origin */
  origin_key: number;
  /** points rows still carrying the free-text point_source (capture-points/1), which RIS-J structures as point_src */
  point_source_rows: number;
  /** files read */
  files: number;
}

const norm = (p: string): string => p.split(sep).join("/");

/** Counts over the repository's files: the baseline RIS-J works down. `files` are absolute paths (validate's allFiles). */
export function keepCounts(root: string, files: readonly string[]): KeepCounts {
  const codes: Record<string, number> = {};
  let origin_key = 0;
  let point_source_rows = 0;
  let n = 0;
  const pts = join(root, "data", "capture", "points.json");
  for (const f of [...files, ...(existsSync(pts) ? [pts] : [])]) {
    const r = norm(relative(root, f));
    if (!/^data\/(?:capture|suitability|relevance)\//.test(r) || !r.endsWith(".json")) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(f, "utf8"));
    } catch {
      continue;
    }
    if (!isObj(doc) || typeof doc.schema !== "string") continue;
    n++;
    for (const k of keepFindings(doc, root)) codes[k.code] = (codes[k.code] ?? 0) + 1;
    if (doc.schema === "capture/1" && Array.isArray(doc.records)) origin_key += doc.records.filter((x) => isObj(x) && "origin" in x).length;
    if (doc.schema === "capture-points/1" && isObj(doc.points)) point_source_rows += Object.values(doc.points).filter((x) => isObj(x) && typeof x.point_source === "string").length;
  }
  return { codes: Object.fromEntries(Object.entries(codes).sort(([a], [b]) => a.localeCompare(b))), origin_key, point_source_rows, files: n };
}
