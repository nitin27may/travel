// "Why this" for the trip builder (trip-builder.md 4.9; task TB-E1): every base, day and left-out pick carries reasons built from the
// numbers the engine used. A reason without a number or a source is never made (`values` is never empty), and a drive figure that is
// not routed carries "≈". At most PLAN_LIMITS.reasons per holder.
import { PLAN_LIMITS, type PlanReason } from "../schema/plan-draft.ts";

/** Minutes as the product writes them: "45 min", "2 h", "1 h 25". */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
const approx = (estimated: boolean): string => (estimated ? " ≈" : "");

const reason = (code: string, values: PlanReason["values"], text: string): PlanReason => ({ code, values, text: text.slice(0, 240) });
/** The first PLAN_LIMITS.reasons reasons. */
export const capReasons = (rs: readonly (PlanReason | null)[]): PlanReason[] => rs.filter((r): r is PlanReason => r !== null).slice(0, PLAN_LIMITS.reasons);

// ---- bases --------------------------------------------------------------------------------------------------------------------------

export function baseCovers(n: number, of: number, avgMin: number, maxMin: number, estimated: boolean): PlanReason {
  return reason(
    "covers_picks",
    { n, of, avgMin, maxMin },
    `Closest town to ${n} of your ${of} picks (avg ${fmtMinutes(avgMin)}${approx(estimated)}, longest ${fmtMinutes(maxMin)}${approx(estimated)})`,
  );
}
export const basePinned = (nights: number): PlanReason => reason("pinned_base", { nights }, `You chose this town for ${nights} ${nights === 1 ? "night" : "nights"}`);
export function baseAlternative(name: string, extraMin: number, estimated: boolean): PlanReason {
  return reason("next_best_base", { town: name, extraMin }, `${name} would add ${fmtMinutes(extraMin)}${approx(estimated)} of driving in all`);
}
export function baseFromStart(name: string, min: number, estimated: boolean): PlanReason {
  return reason("from_start", { min }, `${fmtMinutes(min)}${approx(estimated)} from your start to ${name}`);
}
export const baseLodging = (cls: number): PlanReason | null => (cls >= 2 ? reason("lodging", { cls }, "Many places to stay listed on OpenStreetMap") : null);

// ---- days ---------------------------------------------------------------------------------------------------------------------------

export function dayDriving(driveMin: number, estimated: boolean): PlanReason {
  return reason("day_drive", { driveMin }, `${fmtMinutes(driveMin)}${approx(estimated)} of driving`);
}
export function dayPair(a: string, b: string, apartMin: number, estimated: boolean): PlanReason {
  return reason("close_pair", { a, b, apartMin }, `${a} and ${b} are ${fmtMinutes(apartMin)}${approx(estimated)} apart`);
}
export const dayKept = (n: number): PlanReason => reason("kept_items", { n }, `${n} ${n === 1 ? "place stays" : "places stay"} where you put ${n === 1 ? "it" : "them"}`);
export const dayOrder = (stops: number): PlanReason => reason("shortest_order", { stops }, "Shortest drive order");

// ---- did not fit (4.7) --------------------------------------------------------------------------------------------------------------

export function missTooFar(min: number | null, baseName: string | null, radiusMin: number, estimated: boolean): PlanReason {
  if (min === null) return reason("no_road", { radiusMin }, "No road we know of reaches it from your base");
  return reason(
    "too_far",
    { min, radiusMin },
    `Too far from your ${baseName ? "base" : "start"}: ${fmtMinutes(min)}${approx(estimated)} from ${baseName ?? "your start"}, over your ${fmtMinutes(radiusMin)} each way`,
  );
}
export const missClosed = (why: string, month: number): PlanReason => reason("closed", { month }, why);
export const missFit = (why: string, youngest: number): PlanReason => reason("not_for_party", { youngest }, why);
export function missTime(days: number, addDays: number | null, tried: number): PlanReason {
  return addDays === null
    ? reason("no_room", { days, tried }, `No room in your ${days} ${days === 1 ? "day" : "days"}, and ${tried} more would not fit it either`)
    : reason("no_room", { days, addDays }, `No room in your ${days} ${days === 1 ? "day" : "days"}; ${addDays} more ${addDays === 1 ? "day fits" : "days fit"} it`);
}
export const missUnknown = (listed: boolean): PlanReason =>
  listed ? reason("no_location", { listed: 1 }, "We do not have a location for this yet") : reason("not_listed", { listed: 0 }, "This place is no longer in our list");

// ---- several bases and move days (TB-E2) --------------------------------------------------------------------------------------------

/** "Base 2: Jasper, 4 nights, 6 of your 9 picks within 40 min ≈" (the picks assigned to it, and the longest drive out to one). */
export function baseShare(index: number, name: string, nights: number, n: number, of: number, maxMin: number, estimated: boolean): PlanReason {
  const nn = `${nights} ${nights === 1 ? "night" : "nights"}`;
  if (n === 0) return reason("base_share", { index, nights, n, of }, `Base ${index}: ${name}, ${nn}, none of your ${of} picks is closest to it`);
  return reason("base_share", { index, nights, n, of, maxMin }, `Base ${index}: ${name}, ${nn}, ${n} of your ${of} picks within ${fmtMinutes(maxMin)}${approx(estimated)}`);
}
/** A base the visitor chose that the nights do not reach: it stays listed, with no days. */
export const baseNoNights = (name: string, nights: number): PlanReason =>
  reason("no_nights", { nights }, `No nights at ${name}: your other bases hold all ${nights} ${nights === 1 ? "night" : "nights"}`);
/** Picks beyond the reach of every base, counted on the base nearest to them. */
export const baseOutOfReach = (n: number, radiusMin: number): PlanReason =>
  reason("out_of_reach", { n, radiusMin }, `${n} of your ${n === 1 ? "picks is" : "picks are"} beyond the day-trip reach of every base; this one is the nearest`);
export function missTooFarBases(min: number | null, nearest: string | null, radiusMin: number, estimated: boolean): PlanReason {
  if (min === null || nearest === null) return reason("no_road", { radiusMin }, "No road we know of reaches it from your bases");
  return reason(
    "too_far",
    { min, radiusMin },
    `Too far from your bases: ${fmtMinutes(min)}${approx(estimated)} from ${nearest}, the nearest, over your ${fmtMinutes(radiusMin)} each way`,
  );
}
/** "Move from Banff to Jasper: 3 h 10 ≈ of driving" */
export function dayMove(from: string, to: string, min: number, estimated: boolean): PlanReason {
  return reason("move_day", { fromBase: from, toBase: to, min }, `Move from ${from} to ${to}: ${fmtMinutes(min)}${approx(estimated)} of driving`);
}
export function moveLong(min: number, limitMin: number, estimated: boolean): PlanReason {
  return reason("long_move", { min, limitMin }, `The move is ${fmtMinutes(min)}${approx(estimated)}, over your ${fmtMinutes(limitMin)} of driving a day: break the drive`);
}
export function moveOverDay(min: number, dayMin: number, estimated: boolean): PlanReason {
  return reason("move_over_day", { min, dayMin }, `The move is ${fmtMinutes(min)}${approx(estimated)}, longer than a whole day at your pace (${fmtMinutes(dayMin)}): add a base between`);
}
export const moveNoRoad = (from: string, to: string): PlanReason => reason("no_road_move", { fromBase: from, toBase: to }, `No road we know of from ${from} to ${to}`);

// ---- area picks (TB-PIN) ------------------------------------------------------------------------------------------------------------

/** "Algonquin Provincial Park is your area; its 4 trails are the stops" (the members among the picks, counted). */
export function areaPinned(area: string, members: number, allTrails: boolean): PlanReason {
  const noun = allTrails ? (members === 1 ? "trail" : "trails") : members === 1 ? "place" : "places";
  return reason("area_pinned", { area, n: members }, `${area} is your area; its ${members} ${noun} ${members === 1 ? "is a stop" : "are the stops"}`);
}
/** TB_AREA_EMPTY: the area is picked and nothing inside it is. */
export const areaEmpty = (area: string): PlanReason => reason("pick_inside", { area }, `Pick places inside ${area}`);
/** A base chosen for an area with no pick inside it yet: the drive from the town to the area's point. */
export function baseNearArea(area: string, min: number, estimated: boolean): PlanReason {
  return reason("near_area", { area, min }, `${fmtMinutes(min)}${approx(estimated)} from ${area}, your area`);
}
