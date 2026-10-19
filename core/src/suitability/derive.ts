// Computed fields of suitability/1 (spec 1.3, 5.3): terrain, effort band, family effort, and the flat catalogue copy.
// Family effort is never an input. Everything here is a pure function of the stored values and the difficulty map.
import type { SuitabilityBlock, SuitabilityExt, SuitabilityRecord, SuitFlat } from "../schema/suitability.ts";
import { gradeIsWaterClass, hasEffort, isOperated, loadApplicability, maskNotApplicable, profileOf } from "./applicability.ts";
import type { Applicability } from "./applicability.ts";
import { suitLevel } from "./level.ts";
import type { RecordLike } from "./level.ts";
import { bandOf, DEFAULT_MAP, modeFactor, terrainFromGrade } from "./map.ts";
import type { DifficultyMap } from "./map.ts";
import { RULE_BASES } from "./types.ts";
import type { Grade5, GradeSystem, Mode } from "./types.ts";

type AnyVal<T> = { v: T | null; state: string; basis: string | null } | undefined;

/** The value when state is `value`, else null. */
export function valOf<T>(x: AnyVal<T>): T | null {
  return x && x.state === "value" ? x.v : null;
}
/** The value when it rests on an operator or official rule. */
export function ruleValOf<T>(x: AnyVal<T>): T | null {
  return x && x.state === "value" && x.basis !== null && (RULE_BASES as readonly string[]).includes(x.basis) ? x.v : null;
}

export type TerrainBasis = "mapped" | "drivers" | "override" | "kind_default";

export interface ComputedEffort {
  source_grade: { system: GradeSystem; value: string } | null;
  terrain: Grade5 | null;
  terrain_basis: TerrainBasis | null;
  effort_km: number | null;
  band: 1 | 2 | 3 | 4 | null;
  family_effort: Grade5 | null;
  mode: Mode;
}

export interface EffortInput {
  kind: string;
  subkind?: string;
  /** the record's operator flag, for profiles where it is optional */
  operated?: boolean;
  block: SuitabilityBlock;
  ext?: SuitabilityExt;
}

/**
 * Terrain a subkind has with no grade and no drivers (spec 2.5 and 2.7). Only where the spec fixes it. The keys are
 * values of SUIT_SUBKIND: a key outside the vocabulary never fires (the S0 keys `mountain-coaster` and `show-cave` did not).
 */
export const KIND_TERRAIN: Record<string, Grade5> = {
  zipline: 2,
  coaster: 1,
  "boat-tour": 1,
  cruise: 1,
  cave: 1,
  museum: 1,
  castle: 1,
  landmark: 1,
  wildlife: 1,
  gondola: 1,
};

const g5 = (n: number): Grade5 => Math.min(5, Math.max(1, Math.round(n))) as Grade5;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function modeOf(input: EffortInput): Mode {
  return input.ext?.kind === "ride" || input.subkind === "cycling" || input.subkind === "mtb" || input.subkind === "bike-park" ? "ride" : "walk";
}

/** Spec 1.3 table: terrain from drivers, used when no official grade exists. Null when the drivers say nothing. */
export function terrainFromDrivers(block: SuitabilityBlock): Grade5 | null {
  const d = block.effort?.drivers;
  const expo = valOf(block.exposure)?.level ?? null;
  const scramble = valOf(d?.scrambling);
  const aids = valOf(d?.fixed_aids) ?? [];
  const surface = valOf(d?.surface) ?? [];
  if (scramble === "hands_needed" || scramble === "climbing" || expo === "serious") return 5;
  if (scramble === "hands_occasional" || expo === "significant" || aids.some((a) => a === "chains" || a === "cables" || a === "ladders")) return 4;
  if (expo === "some" || surface.some((s) => s === "roots" || s === "rock" || s === "scree" || s === "snow")) return 3;
  const maxGrade = valOf(d?.max_grade_pct);
  const made = surface.length > 0 && surface.every((s) => s === "paved" || s === "boardwalk");
  if (made && (maxGrade === null || maxGrade < 5) && (expo === null || expo === "none")) return 1;
  if (surface.length > 0 || scramble === "none") return 2;
  return null;
}

/** True when a level made surface lets the "flat" row of a grade apply. */
function isFlat(block: SuitabilityBlock): boolean {
  const d = block.effort?.drivers;
  const surface = valOf(d?.surface) ?? [];
  const expo = valOf(block.exposure)?.level ?? null;
  const gain = valOf(d?.gain_m);
  const made = surface.length > 0 && surface.every((s) => s === "paved" || s === "boardwalk");
  return made && (expo === null || expo === "none") && (gain === null || gain < 50);
}

export function effortKmOf(block: SuitabilityBlock, mode: Mode, map: DifficultyMap): number | null {
  const d = block.effort?.drivers;
  const km = valOf(d?.distance_km);
  if (km === null) return null;
  const gainVal = d?.gain_m;
  const gain = valOf(gainVal) ?? (gainVal?.state === "not_applicable" ? 0 : null);
  if (gain === null) return null;
  return round2(km * modeFactor(map, mode) + gain / 100);
}

export function deriveEffort(input: EffortInput, map: DifficultyMap = DEFAULT_MAP): ComputedEffort {
  const { block } = input;
  const mode = modeOf(input);
  // A10: for paddle profiles the effort grade is the water class, and effort.source_grade is N
  const located = profileOf({ kind: input.kind, subkind: input.subkind });
  const waterGrade = located && gradeIsWaterClass(located.profile, isOperated(located.profile, input.operated)) ? valOf(block.water_safety?.class) : null;
  const sg = valOf(block.effort?.source_grade) ?? waterGrade;
  let terrain: Grade5 | null = null;
  let basis: TerrainBasis | null = null;
  const override = block.effort?.override;
  if (override) {
    terrain = override.grade as Grade5;
    basis = "override";
  } else if (sg) {
    const t = terrainFromGrade(map, sg.system, sg.value, isFlat(block));
    if (t !== null) {
      terrain = g5(t);
      basis = "mapped";
    }
  }
  if (terrain === null) {
    const t = terrainFromDrivers(block);
    if (t !== null) {
      terrain = t;
      basis = "drivers";
    }
  }
  if (terrain === null) {
    const k = (input.subkind && KIND_TERRAIN[input.subkind]) || (input.kind === "lift" ? 1 : undefined);
    if (k) {
      terrain = k as Grade5;
      basis = "kind_default";
    }
  }
  const effortKm = effortKmOf(block, mode, map);
  const band = effortKm === null ? null : (bandOf(map, effortKm) as 1 | 2 | 3 | 4);
  const family = terrain === null && band === null ? null : g5(Math.max(terrain ?? 0, band ?? 0));
  return { source_grade: sg, terrain, terrain_basis: basis, effort_km: effortKm, band, family_effort: family, mode };
}

/** Spec 5.3: yes when the recommended band starts at 7 or under, strong-kid for 8 to 11, no from 12 or a hard minimum of 12. */
export function kidFitOf(block: SuitabilityBlock): SuitFlat["kid_fit"] {
  // a recommended age warns and never excludes (spec 1.2)
  const minAge = block.age_rule === "recommendation" ? null : ruleValOf(block.min_age);
  if (minAge !== null && minAge >= 12) return "no";
  const from = valOf(block.age_band)?.from ?? null;
  if (from === null) return "unknown";
  if (from <= 7) return "yes";
  if (from <= 11) return "strong-kid";
  return "no";
}

export function accessibilityOf(block: SuitabilityBlock): SuitFlat["accessibility"] {
  const w = valOf(block.wheelchair);
  return w === "step_free" ? "step-free" : w === "partial" ? "partial" : w === "none" ? "none" : "unknown";
}

/** The flat catalogue columns (K9) for one record. Limits appear only when they rest on a rule. Fields the profile marks N are skipped. */
export function projectFlat(rec: RecordLike, map: DifficultyMap = DEFAULT_MAP, app: Applicability = loadApplicability()): SuitFlat {
  const located = profileOf(rec, app);
  const b = maskNotApplicable(rec.suitability, located, rec.operated);
  const e = deriveEffort({ kind: rec.kind, subkind: rec.subkind, operated: rec.operated, block: b, ext: rec.ext }, map);
  const hardAge = b.age_rule !== "recommendation";
  const effortApplies = !located || hasEffort(located.profile, isOperated(located.profile, rec.operated));
  return {
    min_age: hardAge ? ruleValOf(b.min_age) : null,
    max_age: hardAge ? ruleValOf(b.max_age) : null,
    min_height_cm: ruleValOf(b.min_height_cm),
    max_height_cm: ruleValOf(b.max_height_cm),
    min_weight_kg: ruleValOf(b.min_weight_kg),
    max_weight_kg: ruleValOf(b.max_weight_kg),
    house_grade: effortApplies ? e.family_effort : null,
    kid_fit: kidFitOf(b),
    accessibility: accessibilityOf(b),
    walk_km: valOf(b.effort?.drivers?.distance_km),
    walk_gain_m: valOf(b.effort?.drivers?.gain_m),
    suit_level: suitLevel(rec, app),
  };
}

// ---- the three derived values every kind feeds (applicability spec 5.3): kids_from, family_effort, stroller_ok ----

/** The larger of the rule minimum age (record, or the most permissive offer) and the recommended band start. Null when neither is known. */
export function kidsFromOf(rec: RecordLike, app: Applicability = loadApplicability()): number | null {
  const located = profileOf(rec, app);
  const ages: (number | null)[] = [rec.suitability, ...(rec.offers ?? []).map((o) => o.suitability)].map((blk) => {
    const b = maskNotApplicable(blk, located, rec.operated);
    const min = b.age_rule === "recommendation" ? null : ruleValOf(b.min_age);
    const band = valOf(b.age_band)?.from ?? null;
    return min === null && band === null ? null : Math.max(min ?? 0, band ?? 0);
  });
  const known = ages.filter((a): a is number => a !== null);
  if (known.length === 0) return null;
  // with offers, the most permissive (lowest) rule is what a party can book; the record alone otherwise
  return rec.offers && rec.offers.length > 0 ? Math.min(...known) : known[0]!;
}

/** The family effort, or null for a profile where effort is N (bungee, boat, lift and others). */
export function familyEffortOf(rec: RecordLike, map: DifficultyMap = DEFAULT_MAP, app: Applicability = loadApplicability()): Grade5 | null {
  return projectFlat(rec, map, app).house_grade as Grade5 | null;
}

/** yes, partly or no from `stroller` (a surface) or `stroller_on_board` (a carriage rule); null when the profile asks for neither. */
export function strollerOkOf(rec: RecordLike, app: Applicability = loadApplicability()): "yes" | "partly" | "no" | null {
  const located = profileOf(rec, app);
  const b = maskNotApplicable(rec.suitability, located, rec.operated);
  const board = valOf(b.stroller_on_board);
  if (board !== null) return board === "yes" ? "yes" : board === "no" ? "no" : "partly";
  const s = valOf(b.stroller);
  if (s === null) return null;
  if (s === "none") return "no";
  if (s === "all_terrain") return "partly";
  return b.stroller_extent?.scope === "whole" ? "yes" : "partly";
}

/** What `kidsFromOf` decided on and why: a rule hides a place from a younger child, advice only fades it (suitability-display 5). */
export interface KidsFrom {
  value: number;
  basis: "rule" | "advice";
}

/** `kidsFromOf` with its basis: `rule` when a rule minimum sets the number (or ties with the band), `advice` when the recommended band start is higher. */
export function kidsFromBasisOf(rec: RecordLike, app: Applicability = loadApplicability()): KidsFrom | null {
  const located = profileOf(rec, app);
  const parts: KidsFrom[] = [];
  for (const blk of [rec.suitability, ...(rec.offers ?? []).map((o) => o.suitability)]) {
    const b = maskNotApplicable(blk, located, rec.operated);
    const min = b.age_rule === "recommendation" ? null : ruleValOf(b.min_age);
    const band = valOf(b.age_band)?.from ?? null;
    if (min === null && band === null) continue;
    const value = Math.max(min ?? 0, band ?? 0);
    parts.push({ value, basis: min !== null && min >= (band ?? 0) ? "rule" : "advice" });
  }
  if (parts.length === 0) return null;
  const pick = rec.offers && rec.offers.length > 0 ? parts.reduce((a, b) => (b.value < a.value ? b : a)) : parts[0]!;
  return pick;
}
