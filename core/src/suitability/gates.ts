// The age gates of spec 6.2, as data, and fits(): does a record suit a party?
//
// Both gates apply (K6): a terrain cap by the youngest child's age, and a ceiling on one walk's distance and climb.
// Family effort does not replace the ceiling. Hard limits are checked too; a limit nobody has found is "unknown".
import type { SuitabilityBlock, SuitabilityRecord } from "../schema/suitability.ts";
import { deriveEffort, ruleValOf, valOf } from "./derive.ts";
import type { ComputedEffort } from "./derive.ts";
import { DEFAULT_MAP } from "./map.ts";
import type { DifficultyMap } from "./map.ts";
import { mergeBlock } from "./project.ts";

export interface Gate {
  /** inclusive age range of the youngest traveller */
  from: number;
  to: number | null;
  terrainCap: 1 | 2 | 3 | 4 | 5;
  /** one walk: km and metres of climb; null means no ceiling (adult) */
  ceilingKm: number | null;
  ceilingGainM: number | null;
  /** effort_km limit (km + gain/100): the ceilings combined */
  effortKm: number | null;
  /** terrain above the cap is advice and does not exclude (13-15 and FE5) */
  adviceAboveCap?: boolean;
  /** a child carried or in a stroller: needs carrier_ok or a stroller that works */
  carried?: boolean;
  reason: string;
}

export const GATES: readonly Gate[] = [
  { from: 0, to: 3, terrainCap: 2, ceilingKm: 8, ceilingGainM: 400, effortKm: 12, carried: true, reason: "the carrier adult's limit (timeline 2.4)" },
  { from: 4, to: 5, terrainCap: 2, ceilingKm: 4, ceilingGainM: 200, effortKm: 6, reason: "familienleben.ch, 4-6 years: about 2-4 km, up to 150-250 m climb" },
  { from: 6, to: 7, terrainCap: 3, ceilingKm: 6, ceilingGainM: 350, effortKm: 9.5, reason: "7-10 years: about 4-8 km, 250-500 m climb" },
  { from: 8, to: 9, terrainCap: 3, ceilingKm: 9, ceilingGainM: 500, effortKm: 14, reason: "same band" },
  { from: 10, to: 12, terrainCap: 4, ceilingKm: 12, ceilingGainM: 750, effortKm: 19.5, reason: "11+ years: often 8-12 km, 500-800 m climb" },
  { from: 13, to: 15, terrainCap: 4, ceilingKm: null, ceilingGainM: null, effortKm: null, adviceAboveCap: true, reason: "FE5 is harness and exposure terrain; an advice chip, not an exclusion. Hard weight rules still gate the product" },
  { from: 16, to: null, terrainCap: 5, ceilingKm: null, ceilingGainM: null, effortKm: null, reason: "adult" },
] as const;

/** A relaxed pace lowers the terrain cap by one and the ceilings by 25%. */
export const RELAXED = { capDrop: 1, ceilingFactor: 0.75 } as const;

export function gateFor(age: number): Gate {
  const g = GATES.find((x) => age >= x.from && (x.to === null || age <= x.to));
  if (!g) throw new Error(`no gate for age ${age}`);
  return g;
}

export interface Profile {
  /** the youngest traveller */
  youngestAge: number;
  oldestAge?: number;
  relaxed?: boolean;
  /** only checked when given */
  childHeightCm?: number;
  childWeightKg?: number;
}

export type CheckStatus = "ok" | "fail" | "unknown" | "advice";
export interface FitCheck {
  gate: "terrain_cap" | "ceiling_km" | "ceiling_gain" | "effort_km" | "carried" | "min_age" | "max_age" | "min_height" | "max_height" | "min_weight" | "max_weight" | "exposure";
  status: CheckStatus;
  detail: string;
}
export interface FitResult {
  /** no when any check fails; unknown when none fails but one is unknown; yes otherwise */
  fits: "yes" | "no" | "unknown";
  checks: FitCheck[];
  /** advice chips: they warn and never exclude */
  advice: string[];
  effort: ComputedEffort;
}

export function fits(record: SuitabilityRecord, profile: Profile, opts: { offerIndex?: number; map?: DifficultyMap } = {}): FitResult {
  const map = opts.map ?? DEFAULT_MAP;
  const offer = opts.offerIndex === undefined ? undefined : record.offers?.[opts.offerIndex];
  const b: SuitabilityBlock = mergeBlock(record.suitability, offer);
  const effort = deriveEffort({ kind: record.kind, subkind: record.subkind, block: b, ext: offer?.ext ?? record.ext }, map);
  const gate = gateFor(profile.youngestAge);
  const relaxed = profile.relaxed === true;
  const cap = Math.max(1, gate.terrainCap - (relaxed ? RELAXED.capDrop : 0));
  const factor = relaxed ? RELAXED.ceilingFactor : 1;
  const checks: FitCheck[] = [];
  const advice: string[] = [];
  const add = (gate_: FitCheck["gate"], status: CheckStatus, detail: string): void => void checks.push({ gate: gate_, status, detail });

  // Terrain and the walking ceilings apply to a walk. A trail always has one; anything else has one only when its
  // record carries effort inputs (a coaster or a museum has no distance to check).
  const eff = b.effort;
  const walking = record.kind === "trail" || !!eff?.source_grade || !!eff?.override || !!eff?.drivers?.distance_km || !!eff?.drivers?.gain_m || !!eff?.drivers?.surface || !!eff?.drivers?.scrambling;

  // terrain cap
  if (!walking) {
    /* not a walk: only the hard limits below can exclude it */
  } else if (effort.terrain === null) add("terrain_cap", "unknown", "terrain grade not known");
  else if (effort.terrain <= cap) add("terrain_cap", "ok", `terrain ${effort.terrain} within cap ${cap}`);
  else if (gate.adviceAboveCap) {
    add("terrain_cap", "advice", `terrain ${effort.terrain} is above the cap ${cap}: advice only for this age`);
    advice.push(`terrain ${effort.terrain}: advice only under 16`);
  } else add("terrain_cap", "fail", `terrain ${effort.terrain} above the cap ${cap} for the youngest, age ${profile.youngestAge}`);

  // ceilings on one walk (riding is judged by effort_km only)
  const drivers = b.effort?.drivers;
  const km = valOf(drivers?.distance_km);
  const gain = valOf(drivers?.gain_m);
  if (walking && gate.ceilingKm !== null && effort.mode === "walk") {
    const maxKm = gate.ceilingKm * factor;
    if (km === null) add("ceiling_km", "unknown", "distance not known");
    else add("ceiling_km", km <= maxKm + 1e-9 ? "ok" : "fail", `${km} km against ${maxKm} km`);
  }
  if (walking && gate.ceilingGainM !== null && effort.mode === "walk") {
    const maxGain = gate.ceilingGainM * factor;
    if (gain === null) add("ceiling_gain", "unknown", "climb not known");
    else add("ceiling_gain", gain <= maxGain + 1e-9 ? "ok" : "fail", `${gain} m against ${maxGain} m`);
  }
  if (walking && gate.effortKm !== null) {
    const maxE = gate.effortKm * factor;
    if (effort.effort_km === null) add("effort_km", "unknown", "effort km not known");
    else add("effort_km", effort.effort_km <= maxE + 1e-9 ? "ok" : "fail", `effort ${effort.effort_km} km against ${maxE} km`);
  }

  // carried child: a carrier, or a stroller that works
  if (gate.carried) {
    const carrier = valOf(b.carrier_ok);
    const stroller = valOf(b.stroller);
    if (carrier === true || (stroller !== null && stroller !== "none")) add("carried", "ok", "carrier ok or a stroller works");
    else if (carrier === false && stroller === "none") add("carried", "fail", "no carrier and no stroller");
    else if (carrier === null && stroller === null) add("carried", "unknown", "carrier and stroller not known");
    else add("carried", "fail", "a carrier is not sensible and the stroller does not work");
  }

  // hard limits. A limit nobody found is unknown; a measurement the party has not given is not checked.
  const limit = <T extends number>(name: FitCheck["gate"], v: Parameters<typeof ruleValOf<T>>[0], have: number | undefined, ok: (limit: number, have: number) => boolean, label: string): void => {
    const rule = ruleValOf(v);
    if (rule !== null) {
      if (have === undefined) return;
      add(name, ok(rule, have) ? "ok" : "fail", `${label} ${rule}, party ${have}`);
    } else if (v && (v.state === "searched_none" || v.state === "gap") && have !== undefined) {
      add(name, "unknown", `${label} not stated by the operator`);
    }
  };
  const adviceAge = b.age_rule === "recommendation";
  const ageCheck = (name: "min_age" | "max_age", v: typeof b.min_age, have: number | undefined, ok: (l: number, h: number) => boolean, label: string): void => {
    const rule = ruleValOf(v);
    if (rule !== null && have !== undefined) {
      if (ok(rule, have)) add(name, "ok", `${label} ${rule}`);
      else if (adviceAge) {
        add(name, "advice", `${label} ${rule} is a recommendation`);
        advice.push(`${label} ${rule} recommended`);
      } else add(name, "fail", `${label} ${rule}, party ${have}`);
    } else if (rule === null && v && (v.state === "searched_none" || v.state === "gap")) add(name, "unknown", `${label} not stated by the operator`);
  };
  ageCheck("min_age", b.min_age, profile.youngestAge, (l, h) => h >= l, "minimum age");
  ageCheck("max_age", b.max_age, profile.oldestAge, (l, h) => h <= l, "maximum age");
  limit("min_height", b.min_height_cm, profile.childHeightCm, (l, h) => h >= l, "minimum height");
  limit("max_height", b.max_height_cm, profile.childHeightCm, (l, h) => h <= l, "maximum height");
  limit("min_weight", b.min_weight_kg, profile.childWeightKg, (l, h) => h >= l, "minimum weight");
  limit("max_weight", b.max_weight_kg, profile.childWeightKg, (l, h) => h <= l, "maximum weight");

  // unfenced exposure: an advice chip for anyone under 8
  const expo = valOf(b.exposure);
  if (expo && (expo.level === "significant" || expo.level === "serious") && expo.fenced === "unfenced" && profile.youngestAge < 8) {
    add("exposure", "advice", "unfenced drop-offs: advice for anyone under 8");
    advice.push("unfenced drop-offs");
  }

  const result: FitResult["fits"] = checks.some((c) => c.status === "fail") ? "no" : checks.some((c) => c.status === "unknown") ? "unknown" : "yes";
  return { fits: result, checks, advice, effort };
}
