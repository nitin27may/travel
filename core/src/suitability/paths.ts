// Every field path the applicability file must list for each profile. The shared-block paths are named here; the
// extension paths come from the `ext` union itself, so a new extension field fails the file's check until it has a mark.
import { ext } from "../schema/suitability.ts";

/** Shared-block paths, in the order of the applicability tables (suitability-applicability.md section 2). */
export const BLOCK_PATHS = [
  // hard limits
  "min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "limit_reason", "adult_required", "solo", "group_min",
  // who it suits
  "age_band", "kid_note", "carrier_ok", "stroller", "stroller_extent", "stroller_on_board", "wheelchair", "access_detail",
  "accessible_toilet", "accessible_parking", "limited_capacity_note",
  // effort and time
  "effort.source_grade", "effort.drivers.distance_km", "effort.drivers.gain_m", "effort.drivers.surface", "effort.drivers.scrambling",
  "effort.drivers.fixed_aids", "effort.drivers.loss_m", "effort.drivers.max_grade_pct", "adult_time_min", "child_time_min", "on_site_min",
  // facilities
  "toilets", "water", "food", "shade", "bail_out", "signal",
  // hazards, water, season
  "exposure", "altitude_m", "hazards", "walk_m", "water_safety.class", "water_safety.lifejacket", "water_safety.child_sizes_from_kg",
  "water_safety.swim_ability", "water_safety.lifeguard", "water_safety.entry", "water_safety.water_temp_c", "water_safety.current_or_tide",
  "access_season",
  // participation (adventures only)
  "participation.guide", "participation.kit_provided", "participation.wear", "participation.min_shoe_eu", "participation.fitness",
  "participation.medical", "participation.pregnancy", "participation.waiver", "participation.weigh_in", "participation.weather_cancel",
] as const;

/** Keys of the shared block that are not a field of their own: a flag on another field, or a group named by its members. */
export const BLOCK_NON_PATHS = ["age_rule", "effort", "water_safety", "participation"] as const;

/** Extension keys that are free text, not a researched field. */
const EXT_NON_PATHS = new Set(["kind", "note"]);

export function extPaths(): string[] {
  const out: string[] = [];
  for (const option of ext.options) {
    const shape = (option as unknown as { shape: Record<string, unknown> }).shape;
    const kind = (shape.kind as { value: string }).value;
    for (const key of Object.keys(shape)) if (!EXT_NON_PATHS.has(key)) out.push(`ext.${kind}.${key}`);
  }
  return out;
}

export const EXT_KINDS: string[] = ext.options.map((o) => ((o as unknown as { shape: { kind: { value: string } } }).shape.kind.value));

export const APPLICABILITY_PATHS: string[] = [...BLOCK_PATHS, ...extPaths()];
