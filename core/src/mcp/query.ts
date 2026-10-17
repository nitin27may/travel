// The filter grammar of plan 4.2 as JSON, evaluated over rows. A filter is one condition or {"all": [...]} / {"any": [...]}.
//   {"field": "kind", "op": "in", "value": ["lake", "waterfall"]}
// Operators by type: text contains / is / is not; number = < <= > >= between; enum in / not in; months includes any;
// bool is; date before / after.
import type { Row } from "./data.ts";

export interface Condition {
  field: string;
  op: string;
  value?: unknown;
}
export type Filter = Condition | { all: Filter[] } | { any: Filter[] };

export const OPERATORS = ["contains", "is", "is not", "=", "<", "<=", ">", ">=", "between", "in", "not in", "includes any", "before", "after"] as const;

function get(row: Row, field: string): unknown {
  return field.split(".").reduce<any>((v, k) => (v == null ? undefined : v[k]), row);
}

function test(row: Row, c: Condition): boolean {
  const v = get(row, c.field);
  const x = c.value;
  switch (c.op) {
    case "contains": return typeof v === "string" ? v.toLowerCase().includes(String(x).toLowerCase()) : Array.isArray(v) ? v.some((e) => String(e).toLowerCase().includes(String(x).toLowerCase())) : false;
    case "is": return Array.isArray(v) ? v.includes(x) : v === x;
    case "is not": return Array.isArray(v) ? !v.includes(x) : v !== x;
    case "=": return v === x;
    case "<": return typeof v === "number" && typeof x === "number" && v < x;
    case "<=": return typeof v === "number" && typeof x === "number" && v <= x;
    case ">": return typeof v === "number" && typeof x === "number" && v > x;
    case ">=": return typeof v === "number" && typeof x === "number" && v >= x;
    case "between": return typeof v === "number" && Array.isArray(x) && x.length === 2 && v >= Number(x[0]) && v <= Number(x[1]);
    case "in": return Array.isArray(x) && x.includes(v);
    case "not in": return Array.isArray(x) && !x.includes(v);
    case "includes any": return Array.isArray(v) && Array.isArray(x) && x.some((e) => v.includes(e));
    case "before": return typeof v === "string" && typeof x === "string" && v < x;
    case "after": return typeof v === "string" && typeof x === "string" && v > x;
    default: throw new Error(`unknown operator "${c.op}"; use one of: ${OPERATORS.join(", ")}`);
  }
}

export function matches(row: Row, f: Filter): boolean {
  if ("all" in f) return f.all.every((x) => matches(row, x));
  if ("any" in f) return f.any.some((x) => matches(row, x));
  if (typeof (f as Condition).field !== "string" || typeof (f as Condition).op !== "string") {
    throw new Error('a condition needs "field" and "op", for example {"field": "kind", "op": "in", "value": ["lake"]}');
  }
  return test(row, f as Condition);
}

export interface Sort {
  field: string;
  dir: "asc" | "desc";
}

export function queryRows(rows: Row[], o: { filter?: Filter; sort?: Sort[]; fields?: string[]; limit?: number; cursor?: string }) {
  let out = o.filter ? rows.filter((r) => matches(r, o.filter!)) : [...rows];
  for (const s of [...(o.sort ?? [])].reverse()) {
    out = out.map((r, i) => ({ r, i })).sort((a, b) => {
      const x = get(a.r, s.field) as any;
      const y = get(b.r, s.field) as any;
      const c = x == null ? (y == null ? 0 : 1) : y == null ? -1 : x < y ? -1 : x > y ? 1 : 0;
      return (s.dir === "desc" ? -c : c) || a.i - b.i;
    }).map((e) => e.r);
  }
  const total = out.length;
  const start = o.cursor ? Number.parseInt(o.cursor, 10) || 0 : 0;
  const limit = o.limit ?? 100;
  const page = out.slice(start, start + limit);
  const rowsOut = o.fields ? page.map((r) => Object.fromEntries(o.fields!.map((f) => [f, get(r, f)]))) : page;
  return { rows: rowsOut, total, next_cursor: start + limit < total ? String(start + limit) : null };
}
