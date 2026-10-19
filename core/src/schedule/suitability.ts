// The Suitability contract (spec 3.11): one normalised record per item that the profile reads. The suitability spec owns
// the fields and their research; this file owns how a profile uses them. Every read is null-safe: a missing field never
// excludes a variant and never raises a warning on its own.
import { ageRules } from "./rules.ts";
import type { Profile, Suitability } from "./types.ts";

export const emptySuitability = (): Suitability => ({
  minAge: null, maxAge: null, minHeightCm: null, maxHeightCm: null, minWeightKg: null, maxWeightKg: null, rule: null,
  stroller: null, wheelchair: null, carrierOk: null, familyEffort: null, sourceGrade: null, childTime: null, adultTime: null,
  distanceKm: null, gainM: null, lossM: null, provenance: "",
});

/** Fills the gaps of a partial record. */
export const readSuitability = (s: Partial<Suitability> | null | undefined): Suitability => ({ ...emptySuitability(), ...(s ?? {}) });

export interface FitResult {
  fits: boolean;
  /** Why not, in words with numbers. null when it fits. */
  reason: string | null;
  /** Advice that does not exclude: a soft age limit, a stroller note. */
  advice: string[];
}

/** Whether one item suits a profile. Hard limits exclude; advice does not. */
export function suitsProfile(s: Suitability, p: Profile): FitResult {
  const out: FitResult = { fits: true, reason: null, advice: [] };
  if (p.party !== "family" || p.youngest === null) return out;
  const age = p.youngest;
  if (s.minAge !== null && age < s.minAge) {
    if (s.rule === "advice") out.advice.push(`Advised for age ${s.minAge} and up`);
    else return { fits: false, reason: `Minimum age is ${s.minAge}; the youngest limit here is age ${age}`, advice: [] };
  }
  if (s.maxAge !== null && age > s.maxAge && s.rule !== "advice") return { fits: false, reason: `Maximum age is ${s.maxAge}`, advice: [] };
  if (age < 4 && s.stroller === "no" && s.carrierOk === false) return { fits: false, reason: "No stroller or carrier on this one", advice: [] };
  const max = ageRules(age).maxEffort;
  if (s.familyEffort !== null && s.familyEffort > max && age < 16) out.advice.push(`Effort ${s.familyEffort} is above the usual ${max} at age ${age}`);
  return out;
}
