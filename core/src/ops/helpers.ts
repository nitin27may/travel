import { TRIP_SCHEMA_VERSION, TRIP_TABLES } from "../schema/trip.ts";
import { OpError } from "./types.ts";
import type { Row } from "./types.ts";

/** a document with every table empty (single tables are filled by the caller) */
export function emptyTrip(slug: string, today: string): Row {
  const doc: Row = { schema_version: TRIP_SCHEMA_VERSION, id: slug, updated: today };
  for (const t of TRIP_TABLES) doc[t.name] = t.meta.single ? {} : [];
  return doc;
}

export const rows = (doc: Row, table: string): Row[] => (doc[table] ??= []);

export function pkOf(table: string): string[] {
  const t = TRIP_TABLES.find((x) => x.name === table);
  if (!t) throw new OpError("E_INTERNAL", `no trip table ${table}`);
  return t.meta.pk;
}

const same = (a: Row, b: Row, cols: string[]): boolean => cols.every((c) => a[c] === b[c]);

/** replace the row with the same primary key, or append; returns true when it replaced */
export function upsertRow(doc: Row, table: string, row: Row): boolean {
  const pk = pkOf(table);
  const list = rows(doc, table);
  const at = list.findIndex((r) => same(r, row, pk));
  if (at >= 0) {
    list[at] = row;
    return true;
  }
  list.push(row);
  return false;
}

export function findRow(doc: Row, table: string, key: Record<string, unknown>, what = table): Row {
  const r = rows(doc, table).find((x) => Object.entries(key).every(([k, v]) => x[k] === v));
  if (!r) throw new OpError("E_NOT_FOUND", `no ${what} ${Object.entries(key).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(", ")} in trip "${doc.id}". Existing: ${rows(doc, table).slice(0, 8).map((x) => JSON.stringify(x[Object.keys(key)[0]!])).join(", ") || "none"}.`);
  return r;
}

export function removeRows(doc: Row, table: string, pred: (r: Row) => boolean): Row[] {
  const list = rows(doc, table);
  const gone = list.filter(pred);
  doc[table] = list.filter((r) => !pred(r));
  return gone;
}

const TRACK_RANK: Record<string, number> = { A: 1, B: 2, C: 3, P: 4 };
const rank = (t: unknown): number => (t === null || t === undefined ? 0 : (TRACK_RANK[String(t)] ?? 9));

/** make `seq` run 1..n inside every (day, track) group, keeping the current order; `first` wins ties (the item being placed) */
export function renumberItems(doc: Row, first?: string): void {
  const list = rows(doc, "items");
  const order = new Map<Row, number>(list.map((r, i) => [r, i]));
  const sorted = [...list].sort((a, b) => a.day - b.day || rank(a.track) - rank(b.track) || a.seq - b.seq || Number(b.id === first) - Number(a.id === first) || order.get(a)! - order.get(b)!);
  const counter = new Map<string, number>();
  for (const r of sorted) {
    const k = `${r.day}|${r.track ?? ""}`;
    const n = (counter.get(k) ?? 0) + 1;
    counter.set(k, n);
    r.seq = n;
  }
}

/** merge a patch into a row; keys the patch lacks keep their value; a primary-key change is refused */
export function patchRow(row: Row, patch: Row, pk: string[], what: string): void {
  for (const c of pk) {
    if (c in patch && patch[c] !== row[c]) throw new OpError("E_PK_CHANGE", `${what} ${c} cannot change (${JSON.stringify(row[c])} to ${JSON.stringify(patch[c])}). Add a new row and remove this one.`);
  }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) row[k] = v;
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
