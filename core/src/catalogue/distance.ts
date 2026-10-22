// The distance rule of `near`, `nearbyForPlace` and `towns` (review API1a-R-12), so every store measures, includes and orders the same
// rows. PostGIS `geography` distance is spheroidal and its sphere radius differs from core's, so SupabaseStore may only PREFILTER in SQL
// (`ST_DWithin` with a margin of at least 1 km) and must then call `measure()` here for every candidate, or store core's distances.
//
//   distance   = haversineKm (core's one great-circle function; CONS-2 moves it to core/src/geo without changing it)
//   inclusion  = the UNROUNDED distance <= r
//   distanceKm = the distance rounded to 0.1 km (what a row shows)
//   order      = distanceKm (rounded), then sortKey(name), then ref, in code-point order
import { haversineKm } from "../relevance/fit.ts";
import { BEARINGS, NEAR_BANDS } from "../schema/api/nearby.ts";
import { compareCodePoints, sortKey } from "./sortKey.ts";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Measure {
  /** unrounded km, for inclusion only */
  km: number;
  /** rounded to 0.1 km, for display and order */
  distanceKm: number;
  bearing: (typeof BEARINGS)[number];
  band: (typeof NEAR_BANDS)[number];
}

/** Eight-point compass bearing from `from` to `to` (initial great-circle bearing, nearby spec 5.1). */
export function bearingOf(from: LatLon, to: LatLon): (typeof BEARINGS)[number] {
  const rad = (x: number) => (x * Math.PI) / 180;
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return BEARINGS[Math.round(deg / 45) % 8]!;
}

/**
 * The time band of a straight-line distance (nearby spec 5.1): a walk under 1.2 km, then the timeline's drive estimate (straight line
 * x 1.42, plus 1.5 km under 60 km; 46 km/h, or 72 above 60 km; plus 3 minutes).
 */
export function bandOf(km: number): (typeof NEAR_BANDS)[number] {
  if (km < 1.2) return "walk";
  const road = km * 1.42 + (km < 60 ? 1.5 : 0);
  const min = (road / (km < 60 ? 46 : 72)) * 60 + 3;
  return min < 15 ? "lt15" : min < 30 ? "15-30" : min < 60 ? "30-60" : "60-120";
}

/** One measurement from a centre: the unrounded km for inclusion, and the rounded distance, bearing and band a row carries. */
export function measure(centre: LatLon, point: LatLon): Measure {
  const km = haversineKm(centre, point);
  return { km, distanceKm: Math.round(km * 10) / 10, bearing: bearingOf(centre, point), band: bandOf(km) };
}

/** Inside the radius: the unrounded distance, never the rounded one, so an edge row is in or out on every store alike. */
export const within = (m: Measure, r: number): boolean => m.km <= r;

/** The near order: rounded distance, then sortKey(name), then ref. */
export function compareByDistance(a: { distanceKm: number; name: string; ref: string }, b: { distanceKm: number; name: string; ref: string }): number {
  return a.distanceKm - b.distanceKm || compareCodePoints(sortKey(a.name), sortKey(b.name)) || compareCodePoints(a.ref, b.ref);
}
