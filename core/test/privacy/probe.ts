// A point near home for tests, read out of core/src/privacy/home.ts the way home.test.ts does, so no test types it and none prints it.
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../src/privacy/home.ts", import.meta.url), "utf8");
const m = /const HOME_POINT = \{ lat: (-?[\d.]+), lon: (-?[\d.]+) \}/.exec(SRC);
if (!m) throw new Error("core/src/privacy/home.ts no longer holds HOME_POINT in the form the probe reads");

/** The home point itself (never print it). */
export const HOME_PROBE = { lat: Number(m[1]), lon: Number(m[2]) };

/** A point `km` north of home. */
export function northOfHome(km: number): { lat: number; lon: number } {
  return { lat: HOME_PROBE.lat + km / 111.19, lon: HOME_PROBE.lon };
}
