// Freshness (plan 0A.1): data/schema/freshness.json says how long each kind of fact stays trustworthy. Given a date this
// finds every expired field and marks the rows that carry one as review_status "stale". Deterministic for a given date:
// the age of a field is the distance between its read date and that date, never the clock.
import { tableOf } from "../schema/index.ts";
import { ENTITIES } from "./common.ts";
import type { CatalogData, Deps, Entity, Row } from "./common.ts";

export interface FreshnessIssue {
  class: string;
  entity: Entity;
  id: string;
  area_id: string | null;
  field: string;
  read: string;
  age_days: number;
  limit_days: number;
  on_stale: string[];
}

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

/** when a field was last read: its own field_meta, else the row's last verification, else its newest source, else its update day */
export function readDateOf(row: Row, field: string, sourceRows: Row[]): string {
  const m = row.field_meta?.[field]?.read;
  if (typeof m === "string" && m !== "0000-00-00") return m;
  if (row.last_verified) return row.last_verified;
  const reads = ((row.sources ?? []) as string[]).map((id) => sourceRows.find((s) => s.id === id)?.read).filter((r): r is string => !!r).sort();
  if (reads.length) return reads[reads.length - 1]!;
  return row.updated ?? "1970-01-01";
}

const present = (v: unknown): boolean => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** row-level stale causes: classes whose expiry marks the row */
export const MARKS_ROW = (onStale: string[]): boolean => onStale.includes("badge") || onStale.includes("backlog");

export function findIssues(data: CatalogData, deps: Deps, today: string): FreshnessIssue[] {
  const out: FreshnessIssue[] = [];
  const cols = (e: Entity): Set<string> => new Set(Object.keys(tableOf("catalog", e).shape));
  for (const cls of deps.freshness.classes as Row[]) {
    if (cls.stale_after_days === null) continue;
    for (const spec of cls.fields as string[]) {
      const [t, c] = spec.includes(".") ? (spec.split(".") as [string, string]) : [null, spec];
      const tables = (t ? ENTITIES.filter((e) => e === t) : ENTITIES.filter((e) => e !== "offer_prices" && cols(e).has(c))) as Entity[];
      for (const entity of tables) {
        if (!cols(entity).has(c)) continue;
        for (const f of data.files.values()) {
          const rows = (f.doc[entity] ?? []) as Row[];
          const sources = (f.doc.sources ?? []) as Row[];
          for (const row of rows) {
            if (row.review_status === "retired" || !present(row[c])) continue;
            // a price is a snapshot: only the newest one per offer says whether the price is current
            if (entity === "offer_prices") {
              const newest = rows.filter((r) => r.offer_id === row.offer_id).map((r) => r.read as string).sort().at(-1);
              if (row.read !== newest) continue;
            }
            const read = entity === "offer_prices" ? row.read : readDateOf(row, c, sources);
            const age = daysBetween(read, today);
            if (age > cls.stale_after_days) {
              const owner = entity === "offer_prices" ? (data.findRow("offers", row.offer_id)?.row ?? null) : row;
              out.push({
                class: cls.id, entity, id: row.id, area_id: owner?.area_id ?? null, field: c, read, age_days: age, limit_days: cls.stale_after_days, on_stale: cls.on_stale,
              });
            }
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.entity.localeCompare(b.entity) || a.id.localeCompare(b.id) || a.field.localeCompare(b.field));
}

/** ids (as "entity:id") of rows that the issues mark stale: offers for a price, the row itself otherwise */
export function staleRowKeys(issues: FreshnessIssue[], data: CatalogData): Map<string, FreshnessIssue[]> {
  const m = new Map<string, FreshnessIssue[]>();
  for (const i of issues) {
    if (!MARKS_ROW(i.on_stale)) continue;
    const key = i.entity === "offer_prices" ? `offers:${String(i.id).split("#")[0]}` : `${i.entity}:${i.id}`;
    if (i.entity === "offer_prices" && !data.findRow("offers", String(i.id).split("#")[0]!)) continue;
    (m.get(key) ?? m.set(key, []).get(key)!).push(i);
  }
  return m;
}
