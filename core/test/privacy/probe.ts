// A point near home for tests, resolved the way core/src/privacy/home.ts resolves it (environment, else the git-ignored root env
// file, else the decoy core/test/setup/home-point.ts injects), so no test types it and none prints it.
import "../setup/home-point.ts";
import { resolveHomePoint } from "../../src/config/home.ts";

/** The home point itself (never print it). */
export const HOME_PROBE = resolveHomePoint();

/** A point `km` north of home. */
export function northOfHome(km: number): { lat: number; lon: number } {
  return { lat: HOME_PROBE.lat + km / 111.19, lon: HOME_PROBE.lon };
}
