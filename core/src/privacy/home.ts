// THE HOUSEHOLD HOME POINT MODULE (CONS-2, PHASE-B-START section 3). This is the one file in the repository that holds where the
// household lives, and the baselined exception in tools/cons/baseline.json says why: the privacy scrub (origin.ts) has to run in every
// build, test and hook, including a fresh clone with no environment file, so the point cannot come from a secret yet.
//
//   - It exists while the repository is private. BEFORE ANY CHANGE OF REPOSITORY VISIBILITY this point moves to a secret or an
//     environment variable read at build time (and this file stops holding it); the visibility change is blocked until that is done.
//   - Nothing else may type the point or the town: origin.ts, party.ts, dateless.ts and the relevance input check import from here or
//     from core/src/config/nearby.ts (the radius). Do not print these values in logs, test names or messages, and do not export the
//     point itself: callers ask `nearHome()` a yes or no question.
//   - What it exposes is unchanged: the public start city, the town-name pattern the scrub replaces, and a boolean.
import { HOME_RADIUS_KM } from '../config/nearby.ts';
import { haversineKm } from '../geo/distance.ts';

/** Default public starting city, and its centre, used wherever the home town or a point near it would show. */
export const PUBLIC_START_CITY = { name: 'Toronto', lat: 43.6532, lon: -79.3832 } as const;

/** The home town as it appears in text; the scrub replaces it with the public starting city. */
export const HOME_TOWN = /whitby/gi;

const HOME_POINT = { lat: 43.88, lon: -78.94 } as const;

/** True when the point lies within the household exclusion radius (`HOME_RADIUS_KM`) of the home point. */
export function nearHome(lat: number, lon: number): boolean {
  return haversineKm(HOME_POINT, { lat, lon }) <= HOME_RADIUS_KM;
}
