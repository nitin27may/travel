// Duration rules (spec 2.3), profile multipliers (2.4) and meal windows (2.6). Every rule has an id so an expanded
// entry can say "Our rule for a lake viewpoint: 45 min". These are rules of thumb, not research: they live in this one
// file so the owner can tune them (spec open question 5).
import { toMin } from "../checks/time.ts";
import { FREE_ROW_MIN } from "../config/schedule.ts";
import type { Pace, Profile, ScheduleItem } from "./types.ts";

export interface DurationRule {
  id: string;
  minutes: number;
  /** "lake viewpoint": the words used in the entry's basis text. */
  label: string;
}

const T: [string, number][] = [
  ["viewpoint.short-walk", 30],
  ["lake.viewpoint", 45],
  ["waterfall.roadside", 20],
  ["sight.landmark", 45],
  ["sight.museum", 120],
  ["town.stroll", 90],
  ["scenic-drive", 10],
  ["lift.ride", 80],
  ["hot-spring", 120],
  ["activity.default", 180],
  ["boat.default", 90],
  ["meal.breakfast", 45],
  ["meal.lunch.sit-down", 60],
  ["meal.lunch.picnic", 40],
  ["meal.dinner", 75],
  ["break.coffee", 20],
  ["break.snack", 15],
  ["break.leg-stretch", 15],
  ["checkin", 30],
  ["checkout", 20],
  ["booking.checkin", 20],
  ["arrival.car-hire", 60],
  ["park.walk-in", 10],
  ["trail.naismith", 0],
];

/** The rule's words in an entry's basis text: "lake.viewpoint" reads "lake viewpoint". */
export const DURATION_RULES: Record<string, DurationRule> = Object.fromEntries(T.map(([id, minutes]) => [id, { id, minutes, label: id.replace(/[.-]/g, " ") }]));

export const rule = (id: string): DurationRule => DURATION_RULES[id] ?? DURATION_RULES["activity.default"]!;

/** Active-time budget per pace (core pace 2, 3, 4 in checks/days.ts PACE_MIN). */
export const ACTIVE_BUDGET_MIN: Record<Pace, number> = { relaxed: 420, standard: 540, full: 660 };

export interface PaceRules {
  startMin: number;
  visitMultiplier: number;
  capAdultsMin: number;
  capFamilyMin: number;
  capToddlerMin: number;
  driveLimitMin: number;
}

export const PACE_RULES: Record<Pace, PaceRules> = {
  relaxed: { startMin: 8 * 60 + 30, visitMultiplier: 1.25, capAdultsMin: 600, capFamilyMin: 540, capToddlerMin: 480, driveLimitMin: 180 },
  standard: { startMin: 8 * 60, visitMultiplier: 1.0, capAdultsMin: 690, capFamilyMin: 600, capToddlerMin: 540, driveLimitMin: 240 },
  full: { startMin: 7 * 60, visitMultiplier: 0.85, capAdultsMin: 780, capFamilyMin: 660, capToddlerMin: 570, driveLimitMin: 360 },
};

export interface AgeRules {
  trailMultiplier: number;
  /** Default walk ceiling for one walk; null means none. */
  maxKm: number | null;
  maxGainM: number | null;
  /** Highest family effort level (suitability 6.1 default by youngest age). */
  maxEffort: number;
}

/** The age bands of spec 2.4. A null youngest is an adult-only party. */
export function ageRules(youngest: number | null): AgeRules {
  if (youngest === null || youngest >= 13) return { trailMultiplier: 1.0, maxKm: null, maxGainM: null, maxEffort: youngest === null || youngest >= 16 ? 5 : 4 };
  if (youngest <= 3) return { trailMultiplier: 1.3, maxKm: 8, maxGainM: 400, maxEffort: 2 };
  if (youngest <= 5) return { trailMultiplier: 1.8, maxKm: 4, maxGainM: 200, maxEffort: 2 };
  if (youngest <= 7) return { trailMultiplier: 1.6, maxKm: 6, maxGainM: 350, maxEffort: 3 };
  if (youngest <= 9) return { trailMultiplier: 1.35, maxKm: 9, maxGainM: 500, maxEffort: 3 };
  return { trailMultiplier: 1.15, maxKm: 12, maxGainM: 750, maxEffort: 4 };
}

/** The walk ceiling in force: the visitor's longest walk wins over the age band. */
export function walkCeiling(p: Profile): { km: number | null; gainM: number | null } {
  const age = ageRules(p.party === "family" ? p.youngest : null);
  return { km: p.walkKm ?? age.maxKm, gainM: p.walkKm !== null ? null : age.maxGainM };
}

/** Day span cap in minutes (2.4). */
export function dayCapMin(p: Profile): number {
  const r = PACE_RULES[p.pace];
  if (p.party === "adults" || p.youngest === null) return r.capAdultsMin;
  return p.youngest < 4 ? r.capToddlerMin : r.capFamilyMin;
}

/** Longest drive stretch before a break (2.5). */
export const breakEveryMin = (p: Profile): number => (p.party === "family" && p.youngest !== null && p.youngest < 10 ? 90 : 120);

export interface MealWindow {
  from: number;
  to: number;
}
export interface MealWindows {
  lunch: MealWindow;
  dinner: MealWindow;
}
const win = (a: string, b: string): MealWindow => ({ from: toMin(a)!, to: toMin(b)! });
export function mealWindows(p: Profile): MealWindows {
  return p.party === "family"
    ? { lunch: win("11:30", "13:00"), dinner: win("17:30", "19:00") }
    : { lunch: win("12:00", "13:30"), dinner: win("18:30", "20:30") };
}

/** Dinner starts this long after the window opens: settle in first. */
export const DINNER_SETTLE_MIN = 15;
/** A wait before a pinned entry, a meal or a check-in becomes a `rest` row only when longer than this (SW-022: the rail's times add up). */
export const REST_THRESHOLD_MIN = FREE_ROW_MIN;
/** A gap this long before a pinned entry earns a coffee before the rest. */
export const COFFEE_GAP_MIN = 40;
/** Round suggested starts to this many minutes. */
export const ROUND_MIN = 5;
export const LOCAL_MOVE_MIN = 10;

/** Naismith: 12 min per km plus 1 min per 10 m of climb, then 10% for stops. */
export const naismithMin = (km: number, gainM: number): number => (km * 12 + gainM / 10) * 1.1;

export interface ResolvedDuration {
  minutes: number;
  source: "plan" | "data" | "operator" | "rule" | "pace";
  basis: string;
  /** True when the duration is a guess and the item carries "duration not known". */
  unknown: boolean;
}

/** Generated durations are shown to the nearest 5 minutes: a rule of thumb does not know the minute. */
export const round5 = (min: number): number => Math.max(5, Math.round(min / 5) * 5);

/** The minutes a duration is shown as: the nearest 5, and a zero stays zero. A day's drive total is the sum of these (SW-022). */
export const shownMin = (exact: number): number => (exact > 0 ? round5(exact) : 0);

/** Every duration and total is shown to the nearest 5 minutes; stored minutes (a routed leg's) stay exact in the data. */
const fmt = (exact: number): string => {
  const min = shownMin(exact);
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? (m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`) : `${m} min`;
};
export const fmtHM = fmt;

/** The rule id an item falls under when it has no duration of its own. */
const SUB_RULE: Record<string, string> = {
  viewpoint: "viewpoint.short-walk", lake: "lake.viewpoint", waterfall: "waterfall.roadside", town: "town.stroll", museum: "sight.museum",
  "lift-ride": "lift.ride", "hot-spring": "hot-spring", "scenic-drive": "scenic-drive", boat: "boat.default", cruise: "boat.default", sight: "sight.landmark",
};
export function ruleIdFor(item: ScheduleItem): string {
  if (item.rule && DURATION_RULES[item.rule]) return item.rule;
  const sub = item.sub ?? "";
  const k = item.kind;
  if (k === "trail") return "trail.naismith";
  if (k === "meal") return sub === "breakfast" ? "meal.breakfast" : sub === "dinner" ? "meal.dinner" : sub === "sit-down" ? "meal.lunch.sit-down" : "meal.lunch.picnic";
  if (k === "break") return DURATION_RULES[`break.${sub}`] ? `break.${sub}` : "break.snack";
  if (k === "checkin" || k === "checkout") return k;
  if (k === "rest") return "break.snack";
  return SUB_RULE[sub] ?? "activity.default";
}

/**
 * Duration of an item for a profile (2.2, 2.3, 2.4): an authored value, then the data range resolved by pace, then the
 * rule table. Trail time is multiplied for the youngest's age; visits by the pace. Operator and authored values are
 * never scaled (a booked 90 minute cruise is 90 minutes).
 */
export function resolveDuration(item: ScheduleItem, p: Profile): ResolvedDuration {
  const pr = PACE_RULES[p.pace];
  const own = item.durationMin;
  const src = item.durationSource === "plan" ? "plan" : "data";
  const R = (minutes: number, source: ResolvedDuration["source"], basis: string, unknown = false): ResolvedDuration => ({ minutes, source, basis, unknown });
  if (own !== null && item.durationSource === "operator") return R(own, "operator", `operator: ${fmt(own)}`);
  if (item.kind === "trail") {
    const st = item.stats;
    let base: number | null = null;
    let basis = "";
    if (item.durationRange) {
      const [lo, hi] = item.durationRange;
      base = p.pace === "relaxed" ? hi : p.pace === "full" ? lo : Math.round((lo + hi) / 2);
      basis = `data ${fmt(lo)}-${fmt(hi)}, ${p.pace} = ${fmt(base)}`;
    } else if (own !== null) {
      base = own;
      basis = `${src}: ${fmt(base)}`;
    } else if (st && st.distanceKm !== null) {
      base = naismithMin(st.distanceKm, st.gainM ?? 0);
      basis = `rule: Naismith ${fmt(Math.round(base))}`;
    }
    if (base !== null) {
      const mult = ageRules(p.party === "family" ? p.youngest : null).trailMultiplier;
      return R(round5(base * mult), item.durationRange || own !== null ? src : "rule", mult !== 1 ? `${basis}, x ${mult} for age ${p.youngest}` : basis);
    }
  }
  if (own === 0) return R(0, "plan", "a moment, not a duration");
  if (own !== null) {
    // data durations of visits follow the pace multiplier; the plan's own, meals, breaks and check-ins do not
    const k = item.kind === "visit" && src === "data" ? pr.visitMultiplier : 1;
    return R(k === 1 ? Math.max(5, Math.round(own)) : round5(own * k), src, k !== 1 ? `${src} ${fmt(own)}, ${p.pace} x ${k}` : `${src}: ${fmt(own)}`);
  }
  const r = rule(ruleIdFor(item));
  const k = item.kind === "visit" ? pr.visitMultiplier : 1;
  return R(k === 1 ? r.minutes : round5(r.minutes * k), "rule", `rule: ${r.label} ${fmt(r.minutes)}${k !== 1 ? ` x ${k}` : ""}`, r.id === "activity.default" && item.sub !== "activity" && item.rule !== "activity.default");
}
