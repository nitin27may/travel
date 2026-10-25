// Helpers shared by the rules (RIS-N): the sink a rule reports to, JSON pointers, Val detection and the meta block starter.
import { SUIT_STATE } from "../schema/enums.ts";
import { RUN_ID_RE } from "../schema/rowMeta.ts";
import type { Change, Family, Finding, Level, RuleId } from "./types.ts";

export type Obj = Record<string, unknown>;
export const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

/** The run id used when none is given: the task that built the normaliser. */
export const DEFAULT_RUN = "RIS-N";
/** The `read` given to a point row that names none: the day the migration ledger was taken, when the first points were read. */
export const DEFAULT_READ = "2026-10-18";

/** Where a rule writes what it changes and what it finds. One per document. */
export class Sink {
  readonly changes: Change[] = [];
  readonly findings: Finding[] = [];
  readonly file: string;
  readonly family: Family;
  readonly run: string;
  readonly readDefault: string;
  constructor(file: string, family: Family, run: string, readDefault: string = DEFAULT_READ) {
    this.file = file;
    this.family = family;
    this.run = run;
    this.readDefault = readDefault;
    if (!RUN_ID_RE.test(run)) throw new Error(`run id "${run}" does not match the RowMeta run id pattern`);
  }
  change(rule: RuleId, path: string, note?: string): void {
    this.changes.push({ file: this.file, family: this.family, rule, path, ...(note ? { note } : {}) });
  }
  find(code: string, level: Level, path: string, message: string): void {
    this.findings.push({ code, level, file: this.file, family: this.family, path, message });
  }
}

/** A JSON pointer segment (RFC 6901). */
export const seg = (k: string | number): string => String(k).replace(/~/g, "~0").replace(/\//g, "~1");

const STATES: ReadonlySet<string> = new Set(SUIT_STATE);
/** A storage Val: `v`, a known `state` and a `src` list (the same test as the keep pass). */
export const isVal = (x: unknown): x is Obj => isObj(x) && "v" in x && typeof x.state === "string" && STATES.has(x.state) && Array.isArray(x.src);

/** Every Val under `x` with its JSON pointer; `meta` blocks are not walked. */
export function eachVal(x: unknown, at: string, fn: (val: Obj, path: string) => void): void {
  if (Array.isArray(x)) x.forEach((y, i) => eachVal(y, `${at}/${i}`, fn));
  else if (isObj(x)) {
    if (isVal(x)) fn(x, at);
    for (const [k, y] of Object.entries(x)) if (k !== "meta") eachVal(y, `${at}/${seg(k)}`, fn);
  }
}

/**
 * The `meta` block of a row, started when the run changes the row (RowMeta v1: schema_version, run_id) and never overwritten:
 * a key already present stays. Returns null when the row holds a `meta` that is not an object (reported by the caller).
 */
export function startMeta(row: Obj, run: string): Obj | null {
  if (row.meta !== undefined && !isObj(row.meta)) return null;
  const meta: Obj = isObj(row.meta) ? row.meta : {};
  if (meta.schema_version === undefined) meta.schema_version = 1;
  if (meta.run_id === undefined) meta.run_id = run;
  // schema_version first, as the spec's table lists it
  const ordered: Obj = { schema_version: meta.schema_version };
  for (const [k, v] of Object.entries(meta)) if (k !== "schema_version") ordered[k] = v;
  row.meta = ordered;
  return ordered;
}

/** Sets `key` on `meta` unless it already holds a different value; returns false (a conflict) when it does. */
export function setMetaKey(meta: Obj, key: string, value: unknown): boolean {
  if (meta[key] === undefined) {
    meta[key] = value;
    return true;
  }
  return JSON.stringify(meta[key]) === JSON.stringify(value);
}

/** `YYYY-MM-DD` */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
