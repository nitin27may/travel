// Shared types for core/src/suitability. Kept free of imports from the rest of the folder so there are no cycles.
import type * as E from "../schema/enums.ts";

export type GradeSystem = (typeof E.GRADE_SYSTEM)[number];
export type Basis = (typeof E.SUIT_BASIS)[number];
export type Grade5 = 1 | 2 | 3 | 4 | 5;
export type Mode = "walk" | "ride";

/** The limit fields: a value here may only rest on an operator or official rule (K3). */
export const LIMIT_FIELDS = [
  "min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "adult_required", "group_min",
] as const;
export type LimitField = (typeof LIMIT_FIELDS)[number];

/** Basis a limit may rest on. group_min is narrower: official_rule only (spec 1.2). */
export const RULE_BASES: readonly Basis[] = ["operator_rule", "official_rule"];
