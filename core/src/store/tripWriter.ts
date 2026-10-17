// The trip writer (plan 2.2): root keys in table order, rows sorted by primary key (items by day, track, seq), columns in
// schema order, one row per line, a trailing newline. The same document always gives the same bytes.
import { TRIP_SCHEMA_VERSION, TRIP_TABLES } from "../schema/trip.ts";
import type { Table } from "../schema/meta.ts";

type Row = Record<string, any>;

const TRACK_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, P: 4 };
const trackRank = (t: unknown): number => (t === null || t === undefined ? 0 : (TRACK_ORDER[String(t)] ?? 9));

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function sortRows(t: Table, rows: Row[]): Row[] {
  const out = [...rows];
  if (t.name === "items") {
    return out.sort((a, b) => cmp(a.day, b.day) || trackRank(a.track) - trackRank(b.track) || cmp(a.seq, b.seq) || cmp(a.id, b.id));
  }
  if (t.name === "day_tracks") return out.sort((a, b) => cmp(a.day, b.day) || trackRank(a.track) - trackRank(b.track));
  const pk = t.meta.pk;
  if (pk.length === 0) return out;
  return out.sort((a, b) => {
    for (const c of pk) {
      const d = cmp(a[c], b[c]);
      if (d !== 0) return d;
    }
    return 0;
  });
}

/** columns in schema order, then any extra keys (the validator rejects those) */
function orderRow(t: Table, row: Row): Row {
  const out: Row = {};
  for (const col of Object.keys(t.shape)) if (col in row) out[col] = row[col];
  for (const k of Object.keys(row)) if (!(k in out)) out[k] = row[k];
  return out;
}

export function serializeTrip(doc: Row): string {
  const lines = ["{"];
  const entries: [string, unknown][] = [["schema_version", doc.schema_version ?? TRIP_SCHEMA_VERSION], ["id", doc.id], ["updated", doc.updated]];
  for (const t of TRIP_TABLES) {
    if (!(t.name in doc)) continue;
    const v = doc[t.name];
    entries.push([t.name, t.meta.single ? orderRow(t, v as Row) : Array.isArray(v) ? sortRows(t, v as Row[]).map((r) => orderRow(t, r)) : v]);
  }
  entries.forEach(([k, v], i) => {
    const comma = i < entries.length - 1 ? "," : "";
    if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object")) {
      lines.push(`${JSON.stringify(k)}: [`);
      v.forEach((r, j) => lines.push(JSON.stringify(r) + (j < v.length - 1 ? "," : "")));
      lines.push(`]${comma}`);
    } else lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
  });
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** other JSON files (proposals): two-space indent, trailing newline */
export function serializeJson(doc: unknown): string {
  return JSON.stringify(doc, null, 2) + "\n";
}
