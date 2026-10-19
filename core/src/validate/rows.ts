// Generic per-table checks shared by every family: schema, unknown and missing columns, time zones,
// primary keys, foreign keys and source ids.
import type { Table } from "../schema/meta.ts";
import type { Issue } from "./codes.ts";
import { describeMissing, describeZodIssue } from "./messages.ts";
import type { ZodLikeIssue } from "./messages.ts";
import type { Refs } from "./refs.ts";

export type Row = Record<string, unknown>;

export interface Ctx {
  refs: Refs;
  errors: Issue[];
  warnings: Issue[];
  /** set once any E_SCHEMA problem is found; semantic rules are skipped because they would cascade */
  schemaBroken: boolean;
  /** the file being validated, when it has a path (the capture validator leaves it out of its cross-file checks) */
  file?: string;
}

export function err(ctx: Ctx, code: string, path: string, message: string): void {
  ctx.errors.push({ code, path, message });
}

const CODE_BY_COLUMN: Record<string, string> = { "trip.slug": "E_SLUG", "legs.id": "E_LEG_ID" };

let ZONES: Set<string> | null = null;
export function isIanaZone(z: string): boolean {
  if (!ZONES) ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  if (ZONES.has(z)) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: z });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(z) || z === "UTC";
  } catch {
    return false;
  }
}

export const isObj = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

function checkRow(t: Table, row: unknown, path: string, ctx: Ctx): void {
  if (!isObj(row)) {
    err(ctx, "E_SCHEMA", path, `each ${t.name} row must be an object with the columns of ${t.name}. Example: {"${t.meta.pk[0] ?? "id"}": "..."}.`);
    ctx.schemaBroken = true;
    return;
  }
  const missing = Object.keys(t.shape).filter((c) => !(c in row));
  for (const c of missing) {
    err(ctx, "E_SCHEMA", `${path}/${c}`, describeMissing(t, c));
    ctx.schemaBroken = true;
  }
  const res = t.schema.safeParse(row);
  if (!res.success) {
    for (const issue of res.error.issues as unknown as ZodLikeIssue[]) {
      const col = issue.path[0];
      if (typeof col === "string" && missing.includes(col) && issue.path.length === 1) continue;
      const override = typeof col === "string" && issue.path.length === 1 && (issue.code === "invalid_format" || issue.code === "too_small")
        ? CODE_BY_COLUMN[`${t.name}.${col}`] : undefined;
      const code = override ?? "E_SCHEMA";
      const p = issue.code === "unrecognized_keys" ? path : `${path}/${issue.path.join("/")}`;
      err(ctx, code, p, describeZodIssue(t, issue, row));
      if (code === "E_SCHEMA") ctx.schemaBroken = true;
    }
  }
  for (const [a, b] of [["lat", "lon"], ["trailhead_lat", "trailhead_lon"]] as const) {
    if (a in t.shape && b in t.shape && (row[a] === null) !== (row[b] === null) && row[a] !== undefined && row[b] !== undefined) {
      err(ctx, "E_SCHEMA", `${path}/${row[a] === null ? a : b}`, `${a} and ${b} must both be set or both be null; one of them is missing. Example: ${a} -49.3226, ${b} -72.8889.`);
    }
  }
  for (const [col, schema] of Object.entries(t.shape)) {
    const m = schema.meta() as Record<string, unknown> | undefined;
    if (m?.["x-type"] === "tz" && typeof row[col] === "string" && !isIanaZone(row[col] as string)) {
      err(ctx, "E_TZ", `${path}/${col}`, `"${col}" is "${row[col]}", which is not an IANA time zone. Example: "America/Argentina/Buenos_Aires" (a name from the tz database, not an offset like "UTC-3").`);
    }
  }
}

/** Validates a table value (an array of rows, or one object for single tables). Returns the rows seen. */
export function checkTable(t: Table, value: unknown, basePath: string, ctx: Ctx): Row[] {
  if (t.meta.single) {
    checkRow(t, value, basePath, ctx);
    return isObj(value) ? [value] : [];
  }
  if (!Array.isArray(value)) {
    err(ctx, "E_SCHEMA", basePath, `"${t.name}" must be a list of rows (use [] when there are none), got ${value === null ? "null" : typeof value}.`);
    ctx.schemaBroken = true;
    return [];
  }
  const rows: Row[] = [];
  const seen = new Map<string, number>();
  value.forEach((row, i) => {
    const path = `${basePath}/${i}`;
    checkRow(t, row, path, ctx);
    if (!isObj(row)) return;
    rows.push(row);
    if (t.meta.pk.length > 0 && t.meta.pk.every((c) => c in row)) {
      const key = t.meta.pk.map((c) => JSON.stringify(row[c])).join("|");
      const first = seen.get(key);
      if (first !== undefined) {
        err(ctx, "E_PK_DUP", path, `${t.name} has two rows with the same ${t.meta.pk.join(" + ")} (${t.meta.pk.map((c) => JSON.stringify(row[c])).join(", ")}); rows ${first} and ${i}. Give one of them a new id, for example "${String(row[t.meta.pk[0]!])}-2".`);
      } else seen.set(key, i);
    }
  });
  return rows;
}

export function fkColumns(t: Table): { col: string; target: string; json: boolean }[] {
  const out: { col: string; target: string; json: boolean }[] = [];
  for (const [col, schema] of Object.entries(t.shape)) {
    const m = schema.meta() as Record<string, unknown> | undefined;
    if (typeof m?.["x-fk"] === "string") out.push({ col, target: m["x-fk"], json: m["x-type"] === "json" });
  }
  return out;
}

export function valuesOf(row: Row, col: string, json: boolean): string[] {
  const v = row[col];
  if (json) return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return typeof v === "string" ? [v] : typeof v === "number" ? [String(v)] : [];
}
