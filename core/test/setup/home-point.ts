// Unit-test home point (PUBLIC-SCRUB). The real point is never in the repository (core/src/config/home.ts): a machine that has it in
// the environment or the git-ignored root .env.local tests against it, and a fresh clone or CI without it gets this decoy, so every
// privacy test still runs. The decoy is open ocean, far from any place, route or town the data holds.
import { HOME_POINT_ENV, HomePointUnsetError, resolveHomePoint } from "../../src/config/home.ts";

export const DECOY_HOME_POINT = { lat: 10.5, lon: -140.5 } as const;

try {
  resolveHomePoint();
} catch (e) {
  if (!(e instanceof HomePointUnsetError) || !/no home point is configured/.test(e.message)) throw e;
  process.env[HOME_POINT_ENV.lat] = String(DECOY_HOME_POINT.lat);
  process.env[HOME_POINT_ENV.lon] = String(DECOY_HOME_POINT.lon);
}
