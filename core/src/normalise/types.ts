// Shared types of the normaliser (RIS-N; docs/v2/features/catalogue-intake-and-storage.md 4.1 S1 to S7, section 6.1).
//
// A run reads files, applies pure rules to a deep copy of each document, and reports what it WOULD change (`Change`) and what it
// found but will not change (`Finding`). `--write` stores the changed text; nothing here touches the disk.

/** The file families the normaliser knows, in the order a report lists them. */
export const FAMILIES = ["capture", "suitability", "relevance", "points", "operators", "tracks", "windows", "base-plans", "seasons"] as const;
export type Family = (typeof FAMILIES)[number];

/** The three trip-level families that have no core schema yet (windows OVR-Ca, base plans STY-Ca, seasons D6a-W). */
export const TRIP_LEVEL_FAMILIES: readonly Family[] = ["windows", "base-plans", "seasons"];

/** What a rule changes. One id per rule of S1 to S4 and S6; a report counts changes by this id. */
export const RULES = [
  "basis", // trip-level basis vocabulary to SUIT_BASIS (4.2)
  "season_shape", // {value, basis} to a Val (4.2)
  "method", // method written beside a mapped computed or plan basis
  "points_schema", // capture-points/1 to /2 (one per file)
  "point_src", // free-text point_source to a point_src object and a meta block (one per row)
  "origin", // capture `origin` key to meta.origin (RIS-C: 107 records)
  "estimate", // Val.estimate from a note that says "estimate" (S4)
  "unit", // imperial text to SI, the source's form in meta.original (S1)
  "price_year", // the year a price applies to (S1: currency with year)
  "date", // a date written another way to ISO 8601 (S1)
  "name", // names as signed, NFC, one space (S1)
  "language", // language tags of `names` to BCP 47 case (S1)
  "currency", // a currency written another way to ISO 4217 (S1)
  "area", // area chain (META-1, delegated to migrate-placement)
  "town", // nearest town id (META-2, delegated to derive-near)
  "meta", // a meta block started on a row the run touched (schema_version, run_id)
] as const;
export type RuleId = (typeof RULES)[number];

export interface Change {
  file: string;
  family: Family;
  rule: RuleId;
  /** JSON pointer of the row or value changed */
  path: string;
  /** a short statement, never a value that could be private */
  note?: string;
}

export type Level = "error" | "warn" | "info";

export interface Finding {
  code: string;
  level: Level;
  file: string;
  family: Family;
  path: string;
  message: string;
}

export interface NormaliseOptions {
  /** repository root; every path in a report is relative to it */
  root: string;
  /** limit the run to these families (default: all) */
  families?: readonly Family[];
  /** limit the run to these files, relative to the root (default: every file of the families) */
  files?: readonly string[];
  /** the run id stamped into `meta.run_id` of rows the run starts a block on (default RIS-N) */
  run?: string;
  /**
   * The `read` date given to a point row whose old text names none. The migration ledger's date by default (2026-10-18, when the
   * first points were read); the row then also carries the work tag `read-date-imputed`.
   */
  readDefault?: string;
  /** run the delegated placement rules (area chain, town ids); default true, skipped when the towns layer is missing */
  placement?: boolean;
}

export interface FileResult {
  file: string;
  family: Family;
  /** the text on disk */
  before: string;
  /** the text after the rules; equal to `before` when nothing changes */
  after: string;
  changes: Change[];
  findings: Finding[];
}

export interface FamilySummary {
  files: number;
  /** files whose text would change */
  changedFiles: number;
  changes: Partial<Record<RuleId, number>>;
  findings: Record<string, number>;
}

export interface NormaliseReport {
  root: string;
  run: string;
  files: FileResult[];
  /** delegated plans (area chain, town ids): files they would write, counted in `changes` as well */
  delegated: { file: string; family: Family; rule: RuleId; text: string }[];
  families: Record<Family, FamilySummary>;
  totals: { files: number; changedFiles: number; changes: number; errors: number; warnings: number };
}

/** The single-document entry point's result (library use by RIS-J, the loader and tests). */
export interface DocResult {
  doc: unknown;
  changes: Change[];
  findings: Finding[];
}
