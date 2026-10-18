// Shared types for core/src/suitability. Kept free of imports from the rest of the folder so there are no cycles.
import type * as E from "../schema/enums.ts";

export type GradeSystem = (typeof E.GRADE_SYSTEM)[number];
export type Basis = (typeof E.SUIT_BASIS)[number];
export type Grade5 = 1 | 2 | 3 | 4 | 5;
export type Mode = "walk" | "ride";

/** The limit fields: a value here may only rest on an operator or official rule (K3). */
export const LIMIT_FIELDS = [
  "min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "adult_required", "group_min", "solo",
] as const;
export type LimitField = (typeof LIMIT_FIELDS)[number];

/** Basis a limit may rest on. group_min is narrower: official_rule only (spec 1.2). */
export const RULE_BASES: readonly Basis[] = ["operator_rule", "official_rule"];

/**
 * Fields outside the shared limit list that still state a rule an operator or a land manager makes (K3). They take the
 * same bases as a limit. `operator_info` never fits any of them.
 */
export const SECOND_RULE_FIELDS: readonly string[] = [
  "min_rider_age", "ski_school_min_age",
  // S0b: shoe size for crampons, flotation age, coaster load and driver rule, weight by time slot, distance from wildlife
  "min_shoe_eu", "floats_required_under", "max_load_kg", "driver_rule", "weight_by_slot", "min_distance_m",
  // capture contract 2.6: who may steer a jet ski, go-kart, ATV or snowmobile
  "driver",
];

/** True for a field whose basis may only be a rule: a limit or a second-list rule. */
export const isRuleField = (field: string): boolean => (LIMIT_FIELDS as readonly string[]).includes(field) || SECOND_RULE_FIELDS.includes(field);
