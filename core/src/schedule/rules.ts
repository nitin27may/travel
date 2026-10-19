// Duration rules (spec 2.3), profile multipliers (2.4) and meal windows (2.6). Every rule has an id so an expanded
// entry can say "Our rule for a lake viewpoint: 45 min". These are rules of thumb, not research: they live in this one
// file so the owner can tune them (spec open question 5).
import { toMin } from "../checks/time.ts";
import type { Pace, Profile, ScheduleItem } from "./types.ts";

export interface DurationRule {
  id: string;
  minutes: number;
  /** "lake viewpoint": the words used in the entry's basis text. */
  label: string;
}

const R = (id: string, minutes: number, label: string): DurationRule => ({ id, minutes, label });

export const DURATION_RULES: Record<string, DurationRule> = Object.fromEntries(
  [
    R("viewpoint.roadside", 15, "roadside viewpoint"),
    R("viewpoint.short-walk", 30, "viewpoint with a short walk"),
    R("lake.viewpoint", 45, "lake viewpoint"),
    R("lake.shore", 90, "lake with a shore walk"),
    R("waterfall.roadside", 20, "roadside waterfall"),
    R("waterfall.walk", 15, "waterfall with a walk"),
    R("sight.landmark", 45, "landmark"),
    R("sight.museum", 120, "museum"),
    R("town.stroll", 90, "town stroll"),
    R("town.errands", 45, "errands"),
    R("scenic-drive", 10, "scenic drive"),
    R("lift.ride", 80, "lift ride (20 min ride, 60 at the top)"),
    R("lift.access", 20, "lift to a trailhead"),
    R("hot-spring", 120, "hot spring"),
    R("activity.default", 180, "activity"),
    R("boat.default", 90, "cruise"),
    R("meal.breakfast", 45, "breakfast out"),
    R("meal.lunch.sit-down", 60, "sit-down lunch"),
    R("meal.lunch.picnic", 40, "picnic lunch"),
    R("meal.dinner", 75, "dinner"),
    R("break.coffee", 20, "coffee stop"),
    R("break.snack", 15, "snack"),
    R("break.fuel", 15, "fuel stop"),
    R("break.leg-stretch", 15, "leg stretch"),
    R("break.groceries", 45, "groceries"),
    R("checkin", 30, "check-in"),
    R("checkout", 20, "check-out"),
    R("booking.checkin", 20, "arrive ahead of the slot"),
    R("arrival.car-hire", 60, "collect a hire car"),
    R("airport.before.international", 180, "be at the airport"),
    R("airport.before.domestic", 120, "be at the airport"),
    R("park.walk-in", 10, "walk from the car park"),
    R("trail.naismith", 0, "walk time (Naismith)"),
  ].map((r) => [r.id, r]),
);

export const rule = (id: string): DurationRule => DURATION_RULES[id] ?? DURATION_RULES["activity.default"]!;

/** Active-time budget per pace (core pace 2, 3, 4 in checks/days.ts PACE_MIN). */
export const ACTIVE_BUDGET_MIN: Record<Pace, number> = { relaxed: 420, standard: 540, full: 660 };

export interface PaceRules {
  startMin: number;
  visitMultiplier: number;
  bufferMin: number;
  morningCoffee: boolean;
  afternoonCoffee: boolean;
  capAdultsMin: number;
  capFamilyMin: number;
  capToddlerMin: number;
  driveLimitMin: number;
}

export const PACE_RULES: Record<Pace, PaceRules> = {
  relaxed: { startMin: 8 * 60 + 30, visitMultiplier: 1.25, bufferMin: 20, morningCoffee: true, afternoonCoffee: true, capAdultsMin: 600, capFamilyMin: 540, capToddlerMin: 480, driveLimitMin: 180 },
  standard: { startMin: 8 * 60, visitMultiplier: 1.0, bufferMin: 15, morningCoffee: false, afternoonCoffee: true, capAdultsMin: 690, capFamilyMin: 600, capToddlerMin: 540, driveLimitMin: 240 },
  full: { startMin: 7 * 60, visitMultiplier: 0.85, bufferMin: 10, morningCoffee: false, afternoonCoffee: false, capAdultsMin: 780, capFamilyMin: 660, capToddlerMin: 570, driveLimitMin: 360 },
};

export interface AgeRules {
  trailMultiplier: number;
  /** Default walk ceiling for one walk; null means none. */
  maxKm: number | null;
  maxGainM: number | null;
  snackEveryMin: number | null;
  /** Highest family effort level (suitability 6.1 default by youngest age). */
  maxEffort: number;
}

/** The age bands of spec 2.4. A null youngest is an adult-only party. */
export function ageRules(youngest: number | null): AgeRules {
  if (youngest === null || youngest >= 13) return { trailMultiplier: 1.0, maxKm: null, maxGainM: null, snackEveryMin: null, maxEffort: youngest === null || youngest >= 16 ? 5 : 4 };
  if (youngest <= 3) return { trailMultiplier: 1.3, maxKm: 8, maxGainM: 400, snackEveryMin: 120, maxEffort: 2 };
  if (youngest <= 5) return { trailMultiplier: 1.8, maxKm: 4, maxGainM: 200, snackEveryMin: 120, maxEffort: 2 };
  if (youngest <= 7) return { trailMultiplier: 1.6, maxKm: 6, maxGainM: 350, snackEveryMin: 150, maxEffort: 3 };
  if (youngest <= 9) return { trailMultiplier: 1.35, maxKm: 9, maxGainM: 500, snackEveryMin: 150, maxEffort: 3 };
  if (youngest <= 12) return { trailMultiplier: 1.15, maxKm: 12, maxGainM: 750, snackEveryMin: 180, maxEffort: 4 };
  return { trailMultiplier: 1.0, maxKm: null, maxGainM: null, snackEveryMin: null, maxEffort: 4 };
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
/** A wait before a pinned entry becomes a `rest` only when longer than this. */
export const REST_THRESHOLD_MIN = 20;
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
  ruleId: string | null;
  /** True when the duration is a guess and the item carries "duration not known". */
  unknown: boolean;
}

const fmt = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? (m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`) : `${m} min`;
};
export const fmtHM = fmt;

/** The rule id an item falls under when it has no duration of its own. */
export function ruleIdFor(item: ScheduleItem): string {
  if (item.rule && DURATION_RULES[item.rule]) return item.rule;
  const sub = item.sub ?? "";
  switch (item.kind) {
    case "trail":
      return "trail.naismith";
    case "meal":
      return sub === "breakfast" ? "meal.breakfast" : sub === "dinner" ? "meal.dinner" : sub === "sit-down" ? "meal.lunch.sit-down" : "meal.lunch.picnic";
    case "break":
      return DURATION_RULES[`break.${sub}`] ? `break.${sub}` : "break.snack";
    case "checkin":
      return "checkin";
    case "checkout":
      return "checkout";
    case "rest":
      return "break.snack";
    default:
  }
  if (sub === "viewpoint") return "viewpoint.short-walk";
  if (sub === "lake") return "lake.viewpoint";
  if (sub === "waterfall") return "waterfall.roadside";
  if (sub === "town") return "town.stroll";
  if (sub === "museum") return "sight.museum";
  if (sub === "lift-ride") return "lift.ride";
  if (sub === "hot-spring") return "hot-spring";
  if (sub === "scenic-drive") return "scenic-drive";
  if (sub === "boat" || sub === "cruise") return "boat.default";
  if (sub === "activity") return "activity.default";
  if (sub === "sight") return "sight.landmark";
  return "activity.default";
}

/**
 * Duration of an item for a profile (2.2, 2.3, 2.4): an authored value, then the data range resolved by pace, then the
 * rule table. Trail time is multiplied for the youngest's age; visits by the pace. Operator and authored values are
 * never scaled (a booked 90 minute cruise is 90 minutes).
 */
export function resolveDuration(item: ScheduleItem, p: Profile): ResolvedDuration {
  const age = ageRules(p.party === "family" ? p.youngest : null);
  const pr = PACE_RULES[p.pace];
  if (item.durationMin !== null && item.durationSource === "operator") {
    return { minutes: item.durationMin, source: "operator", basis: `operator: ${fmt(item.durationMin)}`, ruleId: null, unknown: false };
  }
  if (item.kind === "trail") {
    const stats = item.stats;
    let base: number | null = null;
    let basis = "";
    if (item.durationRange) {
      const [lo, hi] = item.durationRange;
      base = p.pace === "relaxed" ? hi : p.pace === "full" ? lo : Math.round((lo + hi) / 2);
      basis = `data ${fmt(lo)}-${fmt(hi)}, ${p.pace} = ${fmt(base)}`;
    } else if (item.durationMin !== null) {
      base = item.durationMin;
      basis = `${item.durationSource === "plan" ? "plan" : "data"}: ${fmt(base)}`;
    } else if (stats && stats.distanceKm !== null) {
      base = naismithMin(stats.distanceKm, stats.gainM ?? 0);
      basis = `rule: Naismith ${fmt(Math.round(base))}`;
    }
    if (base !== null) {
      const mult = age.trailMultiplier;
      const minutes = Math.max(5, Math.round(base * mult));
      return {
        minutes,
        source: item.durationRange || item.durationMin !== null ? (item.durationSource === "plan" ? "plan" : "data") : "rule",
        basis: mult !== 1 ? `${basis}, x ${mult} for age ${p.youngest}` : basis,
        ruleId: item.durationRange || item.durationMin !== null ? null : "trail.naismith",
        unknown: false,
      };
    }
  }
  if (item.durationMin === 0) return { minutes: 0, source: "plan", basis: "a moment, not a duration", ruleId: null, unknown: false };
  if (item.durationMin !== null) {
    const src = item.durationSource === "plan" ? "plan" : "data";
    // data durations of visits follow the pace multiplier; the plan's own, meals, breaks and check-ins do not
    const scale = item.kind === "visit" && src === "data" ? pr.visitMultiplier : 1;
    const minutes = Math.max(5, Math.round(item.durationMin * scale));
    return { minutes, source: src, basis: scale !== 1 ? `${src === "plan" ? "plan" : "data"} ${fmt(item.durationMin)}, ${p.pace} x ${scale}` : `${src === "plan" ? "plan" : "data"}: ${fmt(item.durationMin)}`, ruleId: null, unknown: false };
  }
  const r = rule(ruleIdFor(item));
  const scale = item.kind === "visit" ? pr.visitMultiplier : 1;
  const minutes = Math.max(5, Math.round(r.minutes * scale));
  const known = r.id !== "activity.default" || item.sub === "activity" || item.rule === "activity.default";
  return { minutes, source: "rule", basis: `rule: ${r.label} ${fmt(r.minutes)}${scale !== 1 ? ` x ${scale}` : ""}`, ruleId: r.id, unknown: !known };
}
