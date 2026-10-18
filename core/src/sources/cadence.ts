import type { FactType } from "../schema/sources.ts";

/** Days between re-checks by the type of fact a source supports (backlog 3a.7). */
export const CADENCE_DAYS: Record<FactType, number> = {
  prices_hours: 90,
  seasons_closures: 180,
  rules: 365,
  grades_geography: 730,
  general: 365,
};

const word = (names: string): RegExp => new RegExp(`(^|\\.)(${names})(\\.|$)`);

/**
 * First match wins; anything not listed is physical or geographic (grades, distances, places, standing), the slowest class.
 * `field` is the dotted path inside the record, as written to used_by.
 */
const RULES: [FactType, RegExp][] = [
  ["prices_hours", word("access_cost|last_up|last_down|price|fee|hours|craft_capacity|lift_served")],
  ["seasons_closures", word("access_season|best_time|peak_months|draw_peak|traffic|ice_min|air_temp_c|water_temp_c|sea_state|wind_exposure|traction|swimming|weather|fuel_gap_km")],
  ["rules", word("min_age|max_age|age_band|min_weight_kg|max_weight_kg|min_height_cm|max_height_cm|adult_required|participation|dogs|stroller|stroller_on_board|carrier_ok|driver_rule|boots|vehicle_limits|max_load_kg|max_riders|min_distance_m|water_safety|group_min|floats_required_under|solo|skills_park|guided|pass|craft|vessel|cabin|trip_style|sections|class_at_level|on_water_min")],
];

export function factTypeOf(field: string): FactType {
  for (const [t, re] of RULES) if (re.test(field)) return t;
  return "grades_geography";
}

/** The cadence a source needs: the shortest of the facts that rely on it. A source nothing relies on gets the general one. */
export function recheckOf(fields: string[]): { cadence_days: number; fact_type: FactType } {
  if (fields.length === 0) return { cadence_days: CADENCE_DAYS.general, fact_type: "general" };
  let best: FactType = factTypeOf(fields[0]!);
  for (const f of fields) {
    const t = factTypeOf(f);
    if (CADENCE_DAYS[t] < CADENCE_DAYS[best]) best = t;
  }
  return { cadence_days: CADENCE_DAYS[best], fact_type: best };
}

const DAY = 86_400_000;
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / DAY);
}
