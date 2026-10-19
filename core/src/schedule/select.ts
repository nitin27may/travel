// Variant selection (spec 3.3). The profile picks one version of each day; the rule and its reason are always recorded.
import { ACTIVE_BUDGET_MIN, ageRules, fmtHM, resolveDuration, walkCeiling } from "./rules.ts";
import type { DayVariant, Profile, ScheduleDayInput } from "./types.ts";

export interface VariantNeeds {
  minAge: number | null;
  /** Whose rule the minimum age is: an operator's, or the plan's own audience. */
  minAgeRule: "hard" | "plan" | null;
  maxWalkKm: number;
  maxGainM: number;
  activeMin: number;
  /** The trail that sets the maximum, for the no-fit message. */
  longest: { name: string; km: number; gainM: number } | null;
}

/** What a variant asks of a party (3.2): derived from its items, never typed. */
export function variantNeeds(v: DayVariant, p: Profile): VariantNeeds {
  let minAge: number | null = null;
  let minAgeRule: VariantNeeds["minAgeRule"] = null;
  let maxWalkKm = 0;
  let maxGainM = 0;
  let activeMin = 0;
  let longest: VariantNeeds["longest"] = null;
  for (const it of v.items) {
    if (it.minAge !== null && it.minAgeRule !== "advice" && it.minAge >= (minAge ?? 0)) {
      minAge = it.minAge;
      minAgeRule = it.minAgeRule === "plan" ? "plan" : "hard";
    }
    if (it.optional) continue;
    if (it.kind === "trail" && it.stats?.distanceKm != null) {
      const km = it.stats.distanceKm;
      const gain = it.stats.gainM ?? 0;
      if (km > maxWalkKm) {
        maxWalkKm = km;
        longest = { name: it.title, km, gainM: gain };
      }
      maxGainM = Math.max(maxGainM, gain);
    }
    if (it.kind === "visit" || it.kind === "trail") activeMin += resolveDuration(it, p).minutes;
  }
  return { minAge, minAgeRule, maxWalkKm, maxGainM, activeMin, longest };
}

export interface FitCheck {
  fits: boolean;
  /** The first reason it does not fit, with numbers. */
  reason: string | null;
}

/** All three tests of 3.3: minimum age, the walk ceiling, and the activity budget (pace x 1.1). */
export function variantFits(v: DayVariant, p: Profile): FitCheck {
  const needs = variantNeeds(v, p);
  const youngest = p.party === "family" ? p.youngest : null;
  if (youngest !== null && needs.minAge !== null && needs.minAge > youngest) {
    return { fits: false, reason: needs.minAgeRule === "plan" ? `An adults' hike in this plan; we offer it from age ${needs.minAge}` : `Includes something with a minimum age of ${needs.minAge}` };
  }
  const ceil = walkCeiling(p);
  if (ceil.km !== null && needs.maxWalkKm > ceil.km) {
    const l = needs.longest;
    return { fits: false, reason: `${l?.name ?? "A walk"} is ${l?.km} km; we plan walks up to ${ceil.km} km at age ${youngest ?? "this setting"}` };
  }
  if (ceil.gainM !== null && needs.maxGainM > ceil.gainM) {
    return { fits: false, reason: `A climb of ${needs.maxGainM} m is above the ${ceil.gainM} m we plan at age ${youngest}` };
  }
  const budget = ACTIVE_BUDGET_MIN[p.pace] * 1.1;
  if (needs.activeMin > budget) {
    return { fits: false, reason: `${fmtHM(needs.activeMin)} of activity is over a ${p.pace} day (${fmtHM(Math.round(budget))})` };
  }
  return { fits: true, reason: null };
}

export interface Selection {
  variant: DayVariant;
  /** A parallel lane the party can add, or null. */
  parallel: DayVariant | null;
  fits: boolean;
  reason: string;
  chosenBy: "profile" | "override";
}

const audienceOk = (v: DayVariant, p: Profile): boolean => (p.party === "adults" ? true : v.audience !== "adults");

/** Picks a variant per 3.3. `forced` is a variant key from the URL (d=5C); it wins even when it does not fit. */
export function selectVariant(day: ScheduleDayInput, p: Profile, forced?: string | null): Selection {
  const vs = day.variants;
  if (!vs.length) throw new Error(`day ${day.day} has no variants`);
  const parallelOf = (chosen: DayVariant): DayVariant | null => {
    if (p.adults < 2 || p.party !== "family") return null;
    return vs.find((v) => v.relation === "parallel" && v.key !== chosen.key && variantFits(v, { ...p, party: "adults", youngest: null }).fits) ?? null;
  };
  const forcedV = forced ? vs.find((v) => v.key === forced) : null;
  if (forcedV) {
    const f = variantFits(forcedV, p);
    return { variant: forcedV, parallel: parallelOf(forcedV), fits: f.fits, reason: f.fits ? `${forcedV.label}: picked for this day` : `${forcedV.label}: picked for this day. ${f.reason}`, chosenBy: "override" };
  }
  const ranked = [...vs].sort((a, b) => b.rank - a.rank);
  const youngest = p.party === "family" ? p.youngest : null;
  let firstWhy: string | null = null;
  for (const v of ranked) {
    // an adults' variant is eligible for a family only when it fits the youngest and the ceiling
    if (!audienceOk(v, p) && !variantFits(v, p).fits) continue;
    const f = variantFits(v, p);
    if (!f.fits) {
      firstWhy ??= f.reason;
      continue;
    }
    let reason: string;
    if (vs.length === 1) reason = "The plan's day";
    else if (v.audience === "adults") reason = p.party === "adults" ? `${v.label}: the longest option for adults` : `${v.label}: fits age ${youngest}`;
    else if (v.audience === "family") reason = `${v.label}: fits age ${youngest ?? 0}`;
    else if (v.audience === "easy") reason = firstWhy ? `${v.label}: ${firstWhy}` : `${v.label}: the easiest option`;
    else reason = `${v.label}: fits this setting`;
    return { variant: v, parallel: parallelOf(v), fits: true, reason, chosenBy: "profile" };
  }
  // nothing fits: the lowest rank, flagged
  const low = [...vs].sort((a, b) => a.rank - b.rank)[0]!;
  const f = variantFits(low, p);
  return { variant: low, parallel: null, fits: false, reason: f.reason ?? "Does not suit this setting", chosenBy: "profile" };
}

export { ageRules };
