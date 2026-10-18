// Pure rules of relevance.md section 3: draw_suggested, effective draw, access load, context fits, role, flags, badge.
// No I/O and no network in this file (acceptance: derive and check never call out).
import type { AccessCostType, DrawTier, RelAccessItem, RelDesignation, RelMention, Standing, Distinction, Weather } from "../schema/relevance.ts";

export const TIERS: readonly DrawTier[] = ["local", "regional", "national", "world"];
export const tierIdx = (t: DrawTier): number => TIERS.indexOf(t);
export const maxTier = (a: DrawTier, b: DrawTier): DrawTier => (tierIdx(a) >= tierIdx(b) ? a : b);
export const atLeast = (t: DrawTier, floor: DrawTier): boolean => tierIdx(t) >= tierIdx(floor);

/** The 3.1 thresholds. A starting point: they are recalibrated after the lanes run (9.1 step 6). */
export const THRESHOLDS = {
  version: 1,
  languages: { world: 25, national: 10, regional: 3 },
  views: { world: 40000, national: 10000, regional: 2000 },
};
export type Thresholds = typeof THRESHOLDS;

export function fameTier(languages: number | null, views: number | null, th: Thresholds = THRESHOLDS): DrawTier {
  const byLang: DrawTier =
    languages === null ? "local" : languages >= th.languages.world ? "world" : languages >= th.languages.national ? "national" : languages >= th.languages.regional ? "regional" : "local";
  const byViews: DrawTier =
    views === null ? "local" : views >= th.views.world ? "world" : views >= th.views.national ? "national" : views >= th.views.regional ? "regional" : "local";
  return maxTier(byLang, byViews);
}

export interface DrawSuggestionInput {
  languages: number | null;
  views: number | null;
  designations: RelDesignation[];
  editorial: RelMention[];
  /** fame tier of the parent area named by a parent designation's QID, when known */
  parentFame?: DrawTier | null;
}

/** 3.1 rules 1 to 4. Parent designations never raise the tier, except that a world parent lifts an official highlight. */
export function drawSuggested(i: DrawSuggestionInput, th: Thresholds = THRESHOLDS): DrawTier {
  let tier = fameTier(i.languages, i.views, th);
  const own = i.designations.filter((d) => d.scope === "own");
  if (own.some((d) => d.type === "unesco_whs")) tier = maxTier(tier, "national");
  if (own.some((d) => d.type === "national_park")) tier = maxTier(tier, "national");
  if (own.some((d) => d.type === "official_highlight")) {
    const parents = i.designations.filter((d) => d.scope === "parent");
    const parentWorld = i.parentFame === "world" || parents.some((d) => d.type === "unesco_whs");
    tier = maxTier(tier, parentWorld ? "national" : "regional");
  }
  if (i.editorial.some((m) => m.list === "top_list" && (m.reach === "national" || m.reach === "global"))) tier = maxTier(tier, "national");
  return tier;
}

// ---- effective draw ----

const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function doy(mmdd: string): number {
  const [m, d] = mmdd.split("-").map(Number) as [number, number];
  let n = 0;
  for (let i = 0; i < m - 1; i++) n += DAYS[i]!;
  return n + d;
}
/** True when two MM-DD ranges, each of which may wrap the new year, share a day. */
export function seasonsOverlap(a: { from: string; to: string }, b: { from: string; to: string }): boolean {
  const split = (r: { from: string; to: string }): [number, number][] => {
    const f = doy(r.from);
    const t = doy(r.to);
    return f <= t ? [[f, t]] : [[f, 366], [1, t]];
  };
  return split(a).some(([a1, a2]) => split(b).some(([b1, b2]) => a1 <= b2 && b1 <= a2));
}

export function effectiveDraw(draw: DrawTier, peak: { tier: DrawTier; from: string; to: string } | null | undefined, window?: { from: string; to: string } | null): DrawTier {
  if (!peak || !window) return draw;
  return seasonsOverlap(peak, window) ? maxTier(draw, peak.tier) : draw;
}

// ---- access load (3.3) ----

export type AccessLoad = "easy" | "plan" | "hard";
const LOAD_ORDER: AccessLoad[] = ["easy", "plan", "hard"];
const worst = (a: AccessLoad, b: AccessLoad): AccessLoad => (LOAD_ORDER.indexOf(a) >= LOAD_ORDER.indexOf(b) ? a : b);

const HARD_ALWAYS: AccessCostType[] = ["permit_lottery", "high_clearance_4wd"];
const PLAN_TYPES: AccessCostType[] = ["timed_entry", "day_permit", "daily_cap", "shuttle_only", "toll_reservation", "lift_only", "boat_or_ferry"];

/** A cap or a booking that sells out a month ahead (book_ahead_days of 30 or more) is hard; a short window is plan. */
export function accessLoad(items: RelAccessItem[], external: AccessLoad = "easy"): AccessLoad {
  let load: AccessLoad = external;
  for (const it of items) {
    if (HARD_ALWAYS.includes(it.type)) load = worst(load, "hard");
    else if (PLAN_TYPES.includes(it.type)) load = worst(load, (it.book_ahead_days ?? 0) >= 30 ? "hard" : "plan");
    // long_walk_in and seasonal_road cost effort or a season, not a booking: easy
  }
  return load;
}

/** Costs that can fail on the day, which make an anchor need a Plan B (3.2). */
export const FAILING_COSTS: AccessCostType[] = ["permit_lottery", "timed_entry", "daily_cap", "shuttle_only"];

// ---- context fits (3.4) ----

export type Fit = "plan_around" | "worth_it" | "if_nearby" | "skip";
export const FITS: Fit[] = ["skip", "if_nearby", "worth_it", "plan_around"];
const dropOne = (f: Fit): Fit => FITS[Math.max(0, FITS.indexOf(f) - 1)]!;

export interface FitFacts {
  ed: DrawTier;
  standing: Standing;
  distinction: Distinction;
  weather: Weather;
  load: AccessLoad;
  /** minutes extra, there and back, beyond the drive the day makes anyway; null when unknown */
  detourMin: number | null;
  /** minutes on site; null when unknown */
  onSiteMin: number | null;
}
export interface FitResult {
  fit: Fit;
  reason: string;
}

function applyDrops(base: Fit, f: FitFacts, vacationPlanAround: boolean): { fit: Fit; notes: string[] } {
  let fit = base;
  const notes: string[] = [];
  if (f.load === "hard" && !(vacationPlanAround && base === "plan_around")) {
    fit = dropOne(fit);
    notes.push("hard access drops it one step");
  }
  if (f.weather === "clear_only") {
    fit = dropOne(fit);
    notes.push("clear weather only drops it one step");
  }
  return { fit, notes };
}

const finish = (fit: Fit, reason: string, notes: string[]): FitResult => ({ fit, reason: notes.length ? `${reason}; ${notes.join("; ")}` : reason });

export function vacationFit(f: FitFacts): FitResult {
  const { ed, standing, distinction } = f;
  const detourOk = f.detourMin !== null && f.detourMin <= 20;
  let base: Fit;
  let why: string;
  if (ed === "world" || (ed === "national" && standing === "top")) [base, why] = ["plan_around", `draw ${ed}, standing ${standing}`];
  else if (ed === "national" || (ed === "regional" && standing === "top" && distinction !== "common")) [base, why] = ["worth_it", `draw ${ed}, standing ${standing}, distinction ${distinction}`];
  else if (ed === "regional" || (ed === "local" && (standing === "top" || standing === "good") && detourOk)) [base, why] = ["if_nearby", `draw ${ed}, standing ${standing}`];
  else [base, why] = ["skip", ed === "local" && standing !== "ordinary" ? `local draw with a detour over 20 min or unknown (${f.detourMin ?? "unknown"})` : `local draw, standing ${standing}`];
  const { fit, notes } = applyDrops(base, f, true);
  return finish(fit, why, notes);
}

export interface WeekendFacts extends FitFacts {
  /** minutes one way to the nearest public hub; null when no hub is known */
  nearestHubMin: number | null;
  /** true when the area holds 2 or more top places of draw regional or above within 30 min of one another */
  areaCluster: boolean;
}
export function weekendFit(f: WeekendFacts): FitResult {
  const hubOk = f.nearestHubMin !== null && f.nearestHubMin >= 90 && f.nearestHubMin <= 240;
  let base: Fit;
  let why: string;
  if (!hubOk) [base, why] = ["skip", f.nearestHubMin === null ? "no hub distance known" : f.nearestHubMin < 90 ? "under 1.5 h from a hub, so a day trip" : "over 4 h from the nearest hub"];
  else if (f.areaCluster && atLeast(f.ed, "regional") && f.standing === "top") [base, why] = ["plan_around", "two or more top places within 30 min, hub 1.5 to 4 h away"];
  else if (atLeast(f.ed, "regional")) [base, why] = ["worth_it", `draw ${f.ed}, hub 1.5 to 4 h away`];
  else if (f.ed === "local" && f.standing === "top") [base, why] = ["if_nearby", "local favourite, hub 1.5 to 4 h away"];
  else [base, why] = ["skip", "the rest"];
  const { fit, notes } = applyDrops(base, f, false);
  return finish(fit, why, notes);
}

export interface DayFacts extends FitFacts {
  /** one-way minutes from the hub */
  hubMin: number;
}
export function dayTripFit(f: DayFacts): FitResult {
  const h = f.hubMin;
  const total = (f.onSiteMin ?? 0) + 2 * h;
  let base: Fit;
  let why: string;
  if (h > 180) [base, why] = ["skip", "over 3 h one way"];
  else if (atLeast(f.ed, "regional") && f.standing === "top" && total <= 720) [base, why] = ["plan_around", `draw ${f.ed}, top, ${h} min away`];
  else if ((f.standing === "top" || f.standing === "good") && h <= 120) [base, why] = ["worth_it", `standing ${f.standing}, ${h} min away`];
  else if (f.standing === "good" && h <= 60) [base, why] = ["if_nearby", `good, ${h} min away`];
  else [base, why] = ["skip", f.standing === "ordinary" && h > 45 ? "ordinary and over 45 min away" : "the rest"];
  const { fit, notes } = applyDrops(base, f, false);
  return finish(fit, why, notes);
}

export function passingFit(f: FitFacts): FitResult {
  const d = f.detourMin;
  const on = f.onSiteMin;
  if (f.load !== "easy") return { fit: "skip", reason: "needs a booking or permit" };
  if (d === null || d > 30) return { fit: "skip", reason: d === null ? "detour unknown" : `detour ${d} min is over 30` };
  let base: Fit;
  let why: string;
  if (d <= 30 && atLeast(f.ed, "national") && on !== null && on <= 120) [base, why] = ["plan_around", `detour ${d} min, draw ${f.ed}`];
  else if (d <= 20 && atLeast(f.ed, "regional") && on !== null && on <= 90) [base, why] = ["worth_it", `detour ${d} min, draw ${f.ed}`];
  else if (d <= 10 && on !== null && on <= 45) [base, why] = ["if_nearby", `detour ${d} min, ${on} min on site`];
  else [base, why] = ["skip", "too long a stop for the draw"];
  const { fit, notes } = applyDrops(base, f, false);
  return finish(fit, why, notes);
}

// ---- role, flags, badge (3.5, 3.6) ----

export type Role = "anchor" | "highlight" | "filler" | "local_only";
export const roleOf = (vac: Fit): Role => (vac === "plan_around" ? "anchor" : vac === "worth_it" ? "highlight" : vac === "if_nearby" ? "filler" : "local_only");

export interface Flags {
  rainy_day: boolean;
  en_route: boolean;
  hidden_gem: boolean;
}
export function flagsOf(i: { role: Role; weather: Weather; passing: Fit; standing: Standing; ed: DrawTier; accessLegalPublic: boolean }): Flags {
  return {
    rainy_day: (i.weather === "indoor" || i.weather === "any_weather") && i.role !== "local_only",
    en_route: i.passing === "plan_around" || i.passing === "worth_it",
    hidden_gem: i.standing === "top" && (i.ed === "local" || i.ed === "regional") && i.accessLegalPublic,
  };
}

export type Badge = "Worth the journey" | "Worth a detour" | "Local favourite";
export type Lens = "vacation" | "day" | "place";

/**
 * The one chip (3.6). `place` is the place page, which allows all three. `vacation` allows the first two. `day`
 * allows "Worth the journey" and "Local favourite", and only for a place inside the day band (day fit not skip).
 */
export function badgeOf(role: Role, standing: Standing, ed: DrawTier, lens: Lens = "place", dayFit?: Fit): Badge | null {
  if (lens === "day" && (dayFit === undefined || dayFit === "skip")) return null;
  if (role === "anchor") return "Worth the journey";
  if (role === "highlight" && lens !== "day") return "Worth a detour";
  if (standing === "top" && (ed === "local" || ed === "regional") && lens !== "vacation") return "Local favourite";
  return null;
}

// ---- straight-line estimates (3.3) ----

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371.0088;
  const rad = (x: number): number => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Straight line x 1.42 at 70 km/h, in minutes one way, marked approximate by callers. */
export const approxMinutes = (km: number): number => Math.round(((km * 1.42) / 70) * 60);

// ---- gate and rescue (7.1 steps 1 and 2) ----

export type GateState = "fits" | "rescued" | "dimmed";
export interface GateResult {
  state: GateState;
  /** the line names the easy way when the card is rescued or dimmed with a taste */
  nameEasyWay: boolean;
  /** `part`: the easy way gives a taste, the card stays dimmed */
  taste: boolean;
}
/**
 * What a party-gated card does. `partyFits` is the suitability verdict for the place itself, `easyWayFits` the verdict
 * for the ref named in `easy_way` (null when there is none). A dimmed anchor or highlight whose easy payoff is `full` or
 * `most` and whose easy way fits stays undimmed; `part` stays dimmed and names the easy way; `none` stays dimmed.
 */
export function gate(role: Role, easyPayoff: "full" | "most" | "part" | "none", partyFits: boolean, easyWayFits: boolean | null): GateResult {
  if (partyFits) return { state: "fits", nameEasyWay: false, taste: false };
  const top = role === "anchor" || role === "highlight";
  if (top && easyWayFits === true && (easyPayoff === "full" || easyPayoff === "most")) return { state: "rescued", nameEasyWay: true, taste: false };
  if (top && easyWayFits === true && easyPayoff === "part") return { state: "dimmed", nameEasyWay: true, taste: true };
  return { state: "dimmed", nameEasyWay: false, taste: false };
}
