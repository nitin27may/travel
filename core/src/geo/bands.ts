// The walk and drive band of a straight-line distance (nearby spec 5.1). Kept apart from distance.ts so the haversine module that client
// map code imports carries no config modules; the numbers are core/src/config/nearby.ts.
import type { NEAR_BANDS } from "../schema/api/nearby.ts";
import {
  DRIVE_BAND_EDGES_MIN, DRIVE_PADDING_MIN, FAST_KMH, ROAD_EXTRA_KM, ROAD_FACTOR, SHORT_DRIVE_KM, SLOW_KMH, WALK_KM,
} from "../config/nearby.ts";

/**
 * The time band of a straight-line distance (nearby spec 5.1): a walk under `WALK_KM`, then the timeline's drive estimate (straight line
 * times `ROAD_FACTOR`, plus `ROAD_EXTRA_KM` under `SHORT_DRIVE_KM`; `SLOW_KMH`, or `FAST_KMH` above; plus `DRIVE_PADDING_MIN`).
 */
export function bandOf(km: number): (typeof NEAR_BANDS)[number] {
  if (km < WALK_KM) return "walk";
  const short = km < SHORT_DRIVE_KM;
  const road = km * ROAD_FACTOR + (short ? ROAD_EXTRA_KM : 0);
  const min = (road / (short ? SLOW_KMH : FAST_KMH)) * 60 + DRIVE_PADDING_MIN;
  const [a, b, c] = DRIVE_BAND_EDGES_MIN;
  return min < a ? "lt15" : min < b ? "15-30" : min < c ? "30-60" : "60-120";
}
