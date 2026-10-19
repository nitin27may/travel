// Leg resolution (spec 2.5): stored ORS, then the plan's minutes, then the base matrix, then a straight line scaled to a
// road time (the prototype rule, ported from prototype/src/lib/geo.ts), then a 10 minute local move.
import { haversineM } from "../checks/time.ts";
import { LOCAL_MOVE_MIN } from "./rules.ts";
import type { Point, ResolvedLeg, StoredLeg } from "./types.ts";

export interface LegEnd {
  /** Item id, place slug, "base", "next-base" or "origin": whatever the stored legs are keyed by. */
  ids: string[];
  point: Point | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Straight-line estimate. Under 1.2 km it is a walk at 4.5 km/h over 1.3 x the distance; over that a winding road. */
export function estimateLeg(a: Point, b: Point): ResolvedLeg {
  const d = haversineM(a, b) / 1000;
  if (d < 1.2) {
    const km = d * 1.3;
    return { mode: "walk", minutes: Math.max(2, Math.round((km / 4.5) * 60)), km: round1(km), basis: "estimate", estimate: true };
  }
  const road = d * 1.42 + (d > 60 ? 0 : 1.5);
  const speed = d > 60 ? 72 : 46;
  return { mode: "drive", minutes: Math.max(5, Math.round(((road / speed) * 60 + 3) / 5) * 5), km: Math.round(road), basis: "estimate", estimate: true };
}

const find = (legs: StoredLeg[], from: string[], to: string[]): StoredLeg | null => {
  for (const l of legs) if (from.includes(l.from) && to.includes(l.to)) return l;
  for (const l of legs) if (l.symmetric !== false && from.includes(l.to) && to.includes(l.from)) return l;
  return null;
};

/** The ladder. A stored leg wins over everything; its `basis` says which rung it is. */
export function resolveLeg(from: LegEnd, to: LegEnd, stored: StoredLeg[], hub: Point | null = null): ResolvedLeg {
  const hit = find(stored, from.ids, to.ids);
  if (hit) return { mode: hit.mode, minutes: hit.minutes, km: hit.km, basis: hit.basis, estimate: hit.basis !== "routed" && hit.estimate };
  if (from.point && to.point) return estimateLeg(from.point, to.point);
  // one end has a coordinate and the other has none (a stop the plan never placed): the day's hub stands in for it, still marked ≈
  const known = from.point ?? to.point;
  if (hub && known && (known.lat !== hub.lat || known.lon !== hub.lon)) {
    // the other end is reached from the base by a stored leg: from a placed stop the way there is back through the base, not a copy of the way in
    const e = estimateLeg(known, hub);
    const toHub = find(stored, ["base"], (from.point ? to : from).ids);
    return toHub?.minutes ? { ...e, mode: "drive", minutes: Math.round((e.minutes + toHub.minutes) / 5) * 5, km: null } : e;
  }
  return { mode: "drive", minutes: LOCAL_MOVE_MIN, km: null, basis: "estimate", estimate: true };
}

/** True when two ends are the same place: no leg, a 5 minute buffer. */
export const samePlace = (a: LegEnd, b: LegEnd): boolean => a.ids.some((x) => x !== "" && b.ids.includes(x));
