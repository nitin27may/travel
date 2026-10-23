// The distance rule of `near`, `nearbyForPlace` and `towns` (review API1a-R-12), so every store measures, includes and orders the same
// rows. PostGIS `geography` distance is spheroidal and its sphere radius differs from core's, so SupabaseStore may only PREFILTER in SQL
// (`ST_DWithin` with a margin of at least 1 km) and must then call `measure()` here for every candidate, or store core's distances.
//
//   distance   = haversineKm (core/src/geo/distance.ts, the one great-circle function; bearing8 and bandOf live there too)
//   inclusion  = the UNROUNDED distance <= r
//   distanceKm = the distance rounded to 0.1 km (what a row shows)
//   order      = distanceKm (rounded), then sortKey(name), then ref, in code-point order
import { bandOf } from "../geo/bands.ts";
import { bearing8, haversineKm } from "../geo/distance.ts";
import type { LatLon } from "../geo/distance.ts";
import type { BEARINGS, NEAR_BANDS } from "../schema/api/nearby.ts";
import { compareCodePoints, sortKey } from "./sortKey.ts";

export { bandOf };
export type { LatLon };

export interface Measure {
  /** unrounded km, for inclusion only */
  km: number;
  /** rounded to 0.1 km, for display and order */
  distanceKm: number;
  bearing: (typeof BEARINGS)[number];
  band: (typeof NEAR_BANDS)[number];
}

/** One measurement from a centre: the unrounded km for inclusion, and the rounded distance, bearing and band a row carries. */
export function measure(centre: LatLon, point: LatLon): Measure {
  const km = haversineKm(centre, point);
  return { km, distanceKm: Math.round(km * 10) / 10, bearing: bearing8(centre, point), band: bandOf(km) };
}

/** Inside the radius: the unrounded distance, never the rounded one, so an edge row is in or out on every store alike. */
export const within = (m: Measure, r: number): boolean => m.km <= r;

/** The near order: rounded distance, then sortKey(name), then ref. */
export function compareByDistance(a: { distanceKm: number; name: string; ref: string }, b: { distanceKm: number; name: string; ref: string }): number {
  return a.distanceKm - b.distanceKm || compareCodePoints(sortKey(a.name), sortKey(b.name)) || compareCodePoints(a.ref, b.ref);
}
