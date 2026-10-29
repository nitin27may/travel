// Stage 1 of the trip builder engine: the candidate score with visible parts (trip-builder.md 4.3; task TB-E1). Pure and deterministic:
// integer parts, so ties are exact; the caller sorts by total, then name, then ref.
//
//   draw      the relevance badge: worth the journey 40, worth a detour 25, local 10, unknown 15
//   fit       the party against the suitability block and, for a trail, the walk ceiling at the youngest's age: pass 30, unknown 10,
//             fail 0; a failed RULE removes the row ("Not for your party"), failed advice ("Long for age 7: 11.2 km") keeps it with `why`
//   season    the month against the season months: in 20, shoulder 8, unknown 8, closed removes the row ("Closed in July")
//   theme     each matched interest 10, at most 20
//   distance  the one-way drive from the centre: under 30 min 10, under 60 6, under 120 3
//   quality   completeness at the required tier 5
//
// A gap is never a yes: an unknown fit or season scores below a known pass. A pick the visitor made is never removed by scoring; the
// packer reads `fit` and `seasonState` and puts a failed pick in Did not fit with its reason (4.7).
import { BUILDER_SCORE } from "../config/builder.ts";
import { suitsProfile } from "../schedule/suitability.ts";
import { walkCeiling } from "../schedule/rules.ts";
import type { Pace, Profile } from "../schedule/types.ts";
import type { PlanParty, PlanScore } from "../schema/api/plan.ts";
import type { EnginePlace } from "./engineTypes.ts";

export type FitState = "pass" | "unknown" | "fail";
export type SeasonState = "in" | "shoulder" | "unknown" | "closed";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** The scheduler's profile for a build's party (the POST body only; never stored). */
export function profileOf(party: PlanParty, pace: Pace): Profile {
  const youngest = party.children.length ? Math.min(...party.children) : null;
  return { party: youngest === null ? "adults" : "family", youngest, pace, adults: party.adults, walkKm: party.walkKm, split: false };
}

/** The profile a cacheable candidates query implies: its party band (`adults` or `family-<youngest>`), never ages. */
export function profileOfBand(band: string | undefined, pace: Pace = "standard"): Profile {
  const m = band ? /^family-(\d{1,2})$/.exec(band) : null;
  const youngest = m ? Number(m[1]) : null;
  return { party: youngest === null ? "adults" : "family", youngest, pace, adults: 2, walkKm: null, split: false };
}

/**
 * The walk ceiling a trail fails for the party (review TB-R1 RB-012: "Fits 7" on an 11 km trail): its length or its climb over what we
 * plan at the youngest's age (core/src/schedule/rules.ts `walkCeiling`, the same caps the day check W_CEILING reads), in words.
 */
function ceilingWhy(place: Partial<Pick<EnginePlace, "kind" | "distanceKm" | "gainM">>, p: Profile): string | null {
  if (place.kind !== "trail" || p.youngest === null) return null;
  const c = walkCeiling(p);
  if (c.km !== null && place.distanceKm != null && place.distanceKm > c.km) return `Long for age ${p.youngest}: ${place.distanceKm} km; we plan walks up to ${c.km} km`;
  if (c.gainM !== null && place.gainM != null && place.gainM > c.gainM) return `Steep for age ${p.youngest}: ${place.gainM} m of climb; we plan up to ${c.gainM} m`;
  return null;
}

/**
 * Whether a place suits the party, and why not in words with numbers. An adults party has no limit to check. A rule the party fails
 * (an operator's age limit) is `fail` by `rule`; a trail over our walk ceiling for the youngest is `fail` by `advice` (it stays a
 * candidate and a stop, the day check says so), never "Fits" (RB-012).
 */
export function fitOf(place: Pick<EnginePlace, "suitability"> & Partial<Pick<EnginePlace, "kind" | "distanceKm" | "gainM">>, p: Profile): { state: FitState; why: string | null; basis: "rule" | "advice" | null } {
  if (p.party !== "family" || p.youngest === null) return { state: "pass", why: null, basis: null };
  const s = place.suitability;
  const known = s !== null && (s.minAge !== null || s.maxAge !== null || s.rule !== null || s.stroller !== null || s.familyEffort !== null);
  const r = s && known ? suitsProfile(s, p) : null;
  if (s && r && !r.fits) {
    const why = s.minAge !== null && p.youngest < s.minAge ? `Needs age ${s.minAge}; youngest is ${p.youngest}` : r.reason;
    if (s.rule !== "advice") return { state: "fail", why, basis: "rule" };
  }
  const long = ceilingWhy(place, p);
  if (long) return { state: "fail", why: long, basis: "advice" };
  if (!r) return { state: "unknown", why: null, basis: null };
  if (r.fits) return { state: "pass", why: null, basis: null };
  const why = s!.minAge !== null && p.youngest < s!.minAge ? `Needs age ${s!.minAge}; youngest is ${p.youngest}` : r.reason;
  return { state: "fail", why, basis: "advice" };
}

/** The month against the season months: in, shoulder (a month next to a season month), unknown (no month or no season), closed. */
export function seasonOf(place: Pick<EnginePlace, "season">, month: number | null | undefined): { state: SeasonState; why: string | null } {
  if (!month || place.season.length === 0) return { state: "unknown", why: null };
  if (place.season.includes(month)) return { state: "in", why: null };
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  if (place.season.includes(prev) || place.season.includes(next)) return { state: "shoulder", why: null };
  return { state: "closed", why: `Closed in ${MONTH_NAMES[month - 1]}` };
}

/** Each interest the place matches (its kind, type or a tag), 10 points, at most 20. */
export function themePoints(place: Pick<EnginePlace, "kind" | "type" | "tags">, interests: readonly string[]): number {
  if (!interests.length) return 0;
  const own = new Set([place.kind, ...(place.type ? [place.type] : []), ...place.tags]);
  const hits = new Set(interests.filter((i) => own.has(i))).size;
  return Math.min(BUILDER_SCORE.themeMax, hits * BUILDER_SCORE.themeEach);
}

/** The distance part for a one-way drive; null (no point) scores 0. */
export function distancePoints(driveMin: number | null): number {
  if (driveMin === null) return 0;
  for (const b of BUILDER_SCORE.distance) if (driveMin < b.underMin) return b.points;
  return 0;
}

export interface Scored {
  score: PlanScore;
  fit: FitState;
  fitBasis: "rule" | "advice" | null;
  seasonState: SeasonState;
  /** the words of a removed row ("Needs age 12; youngest is 6", "Closed in July"); null on the main list */
  why: string | null;
  /** which list the row belongs on */
  list: "main" | "not_for_party" | "closed";
}

export interface ScoreContext {
  profile: Profile;
  month: number | null;
  /** chosen interests: facet values (`kind`, `tag`, type ids) */
  interests: readonly string[];
  /** one-way drive from the centre, minutes; null when the place has no point */
  driveMin: number | null;
}

/** The score of one place with its parts (4.3). Closed wins over unfit for the list a row lands on: a closed place is not an option at all. */
export function scorePlace(place: EnginePlace, ctx: ScoreContext): Scored {
  const fit = fitOf(place, ctx.profile);
  const season = seasonOf(place, ctx.month);
  const parts = {
    draw: BUILDER_SCORE.draw[place.draw ?? "unknown"],
    fit: BUILDER_SCORE.fit[fit.state],
    season: BUILDER_SCORE.season[season.state],
    theme: themePoints(place, ctx.interests),
    distance: distancePoints(ctx.driveMin),
    quality: place.complete ? BUILDER_SCORE.quality : 0,
  };
  const total = parts.draw + parts.fit + parts.season + parts.theme + parts.distance + parts.quality;
  // a rule the party fails takes the row off the main list; our advice (a walk over the age's ceiling) keeps it there, with its words
  const list = season.state === "closed" ? "closed" : fit.state === "fail" && fit.basis !== "advice" ? "not_for_party" : "main";
  const why = list === "closed" ? season.why : list === "not_for_party" || fit.state === "fail" ? fit.why : null;
  return { score: { ...parts, total }, fit: fit.state, fitBasis: fit.basis, seasonState: season.state, why, list };
}

/** The candidate order (4.3): score, then name, then ref, in code-point order so every run cuts a page at the same row. */
export function byScore<T extends { name: string; ref: string; score: { total: number } }>(a: T, b: T): number {
  return b.score.total - a.score.total || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
}
