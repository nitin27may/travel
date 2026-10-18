// Freshness of the judged and evidence fields (relevance.md 5 rule 8). Shared by the validator (a warning) and derive
// (a stale value is treated as a gap and carries a `stale` flag).
import type { RelevanceRecord } from "../schema/relevance.ts";

export const FRESH_DAYS = { judged: 1095, designations: 1095, editorial: 730, access: 365 };
export const STALE_FIELDS = ["draw", "standing", "distinction", "designations", "editorial", "access_cost"] as const;
export type StaleField = (typeof STALE_FIELDS)[number];

type V = { state: string; read?: string; src: string[] };
const days = (a: string, b: string): number => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);

export function staleFields(r: RelevanceRecord, researched: string, reads: Record<string, string>, today: string): { field: StaleField; latest: string; limit: number }[] {
  const pick: [StaleField, V, number][] = [
    ["draw", r.draw, FRESH_DAYS.judged],
    ["standing", r.standing, FRESH_DAYS.judged],
    ["distinction", r.distinction, FRESH_DAYS.judged],
    ["designations", r.signals.designations, FRESH_DAYS.designations],
    ["editorial", r.signals.editorial, FRESH_DAYS.editorial],
    ["access_cost", r.access_cost, FRESH_DAYS.access],
  ];
  const out: { field: StaleField; latest: string; limit: number }[] = [];
  for (const [field, v, limit] of pick) {
    if (v.state !== "value") continue;
    const rs = [v.read, ...v.src.map((id) => reads[id])].filter((x): x is string => !!x).sort();
    const latest = rs[rs.length - 1] ?? researched;
    if (days(latest, today) > limit) out.push({ field, latest, limit });
  }
  return out;
}
