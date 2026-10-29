// The nearby thresholds, each defined once (CONS-2; EXECUTION-PLAN 5.3). Pure and framework-free, so the build, the handlers, JsonStore
// and a later SupabaseStore read the same numbers.
//
// Single source of truth: the API's own limits, `API_LIMITS` in core/src/schema/api/limits.ts, own the radius numbers (25, 50, 100 and
// the presets are part of the published contract). This module re-exports them under the names the rest of the code uses and adds the
// numbers the contract does not carry (the walk and drive band arithmetic, the household exclusion radius). Change a radius in
// limits.ts only; nothing else holds a copy.
import { haversineKm } from "../geo/distance.ts";
import { API_LIMITS } from "../schema/api/limits.ts";

/** "Near" (nearby spec 5.1): places within this many km of a place or the visitor's centre. Also the default `near` radius. */
export const NEAR_KM: number = API_LIMITS.nearRadius.default;
/** Day trips (nearby spec 5.2): the farthest a place may be and still count as a day trip, and the "area" cap of the relevance derivation. */
export const DAY_TRIP_KM: number = API_LIMITS.nearby.dayTrips;
/**
 * The add picker's radius (STEP2-E3; edit-mode-spec 7.2 group 6): places with a page and a non-approximate point within this many km of
 * a day's base or one of its stops are offered on that day. Not `NEAR_KM`: the timeline's add list is a day-trip radius, the near API's is
 * a "what is around here" radius, and each moves on its own.
 */
export const ADD_NEARBY_KM = 30;
/**
 * A place or park farther than this from every base of a trip is not offered a day (README ruling C5, M3): the picker says how far it is
 * and offers "Start a new trip with ..." instead. Equal to the day-trip limit, since beyond it no day of the trip can reach the place.
 */
export const ADD_PIN_FAR_KM: number = API_LIMITS.nearby.dayTrips;
/** The radius chips offered on near mode, in km. */
export const RADIUS_PRESETS: readonly number[] = API_LIMITS.nearRadius.presets;
/** The largest radius a visitor can ask for; above it the store clamps (P8). */
export const RADIUS_CAP: number = API_LIMITS.nearRadius.max;
/** The default radius when the centre is an area rather than a point. */
export const AREA_DEFAULT_R: number = API_LIMITS.nearRadius.areaDefault;
/** The decimals a `near=point:<lat>,<lon>` coordinate may carry (store.ts A41): the cell a client rounds its point to before it asks. */
export const NEAR_POINT_DECIMALS: number = API_LIMITS.nearPoint.decimals;
/** A coordinate rounded to the near cell, as the URL carries it. */
export const toNearCell = (deg: number): number => Number(deg.toFixed(NEAR_POINT_DECIMALS)) || 0;
/**
 * The most a distance from the cell can differ from the distance from the asker's own point inside it: half the cell's diagonal at the
 * equator, where a degree of longitude is longest (about 0.79 km). A client that re-measures from its exact point asks for `r` plus this.
 */
export function nearCellSlackKm(): number {
  const half = 0.5 / 10 ** NEAR_POINT_DECIMALS;
  return haversineKm({ lat: 0, lon: 0 }, { lat: half, lon: half });
}

/** Under this many km of straight line a place is a walk (nearby spec 5.1). */
export const WALK_KM = 1.2;
/** The timeline's drive estimate: road distance is the straight line times this, plus `ROAD_EXTRA_KM` under `SHORT_DRIVE_KM`. */
export const ROAD_FACTOR = 1.42;
export const ROAD_EXTRA_KM = 1.5;
/** Below this straight-line distance the drive is slow roads (`SLOW_KMH`), above it faster roads (`FAST_KMH`). */
export const SHORT_DRIVE_KM = 60;
export const SLOW_KMH = 46;
export const FAST_KMH = 72;
/** Minutes added to every drive for parking and getting going. */
export const DRIVE_PADDING_MIN = 3;
/** The upper edges, in minutes, of the drive bands `lt15`, `15-30` and `30-60` (nearby spec 5.1). */
export const DRIVE_BAND_EDGES_MIN = [15, 30, 60] as const;
/** Two places closer than this are one pin on the map (nearby spec 5.7). */
export const PAIR_COLLAPSE_M = 200;

/**
 * The household exclusion radius in km: a place or point this close to the household's home is never published as it is. The point itself
 * lives in core/src/privacy/home.ts; only this number is shared with the relevance input check.
 */
export const HOME_RADIUS_KM = 2;
