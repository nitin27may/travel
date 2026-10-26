// THE HOUSEHOLD HOME POINT MODULE (CONS-2, PHASE-B-START section 3; PUBLIC-SCRUB 25 Oct 2026). This is the one module that knows
// where the household lives. The point itself is not in the repository: it comes from HOME_POINT_LAT and HOME_POINT_LON (the
// environment, else the git-ignored root .env.local or .env), as core/src/config/home.ts describes. There is no default: without
// the variables the first call to `nearHome()` throws, so no build, check or scrub runs without the household exclusion.
//
//   - Nothing else may read the point or type the town: origin.ts, party.ts, dateless.ts and the relevance input check import from
//     here or from core/src/config/nearby.ts (the radius). Do not print these values in logs, test names or messages, and do not
//     export the point itself: callers ask `nearHome()` a yes or no question.
//   - What it exposes is unchanged: the public start city, the town-name pattern the scrub replaces, and a boolean.
import { resolveHomePoint } from "../config/home.ts";
import { HOME_RADIUS_KM } from "../config/nearby.ts";
import { haversineKm } from "../geo/distance.ts";

/** Default public starting city, and its centre, used wherever the home town or a point near it would show. */
export const PUBLIC_START_CITY = { name: "Toronto", lat: 43.6532, lon: -79.3832 } as const;

/** The home town as it appears in text; the scrub replaces it with the public starting city. */
export const HOME_TOWN = /whitby/gi;

/** The same pattern without the global flag, for `test()` (a global regex keeps a position between calls). Detectors and checks import this one. */
export const HOME_TOWN_RE = /whitby/i;

let cached: { lat: number; lon: number } | null = null;

function homePoint(): { lat: number; lon: number } {
  cached ??= resolveHomePoint();
  return cached;
}

/** True when the point lies within the household exclusion radius (`HOME_RADIUS_KM`) of the home point. Throws when it is unset. */
export function nearHome(lat: number, lon: number): boolean {
  return haversineKm(homePoint(), { lat, lon }) <= HOME_RADIUS_KM;
}

/** Forget the resolved point, so a test can change the environment and resolve again. */
export function resetHomePointCache(): void {
  cached = null;
}
