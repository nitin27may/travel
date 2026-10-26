// Where the household home point comes from (PUBLIC-SCRUB, 25 Oct 2026). The point is never in a tracked file: it is read from the
// environment, and nothing in code supplies a default. Framework-free (node:fs only, for the root env files); the reading is
// `resolveHomePoint` below. core/src/privacy/home.ts is its only production caller (and caches the result), the test probe the other.
//
// Resolution, highest first (the same precedence as web/scripts/with-root-env.mjs):
//   1. the inherited process environment (Vercel, CI, a shell export),
//   2. the repository root `.env.local`, then `.env` (both git-ignored; found by walking up from the working directory to the
//      folder that holds `pnpm-workspace.yaml`).
// Neither present: the first call that needs the point throws HomePointUnsetError, so a build or a check never runs without the
// household exclusion (fail closed). Unit tests inject a decoy point when none is configured (core/test/setup/home-point.ts, also loaded by web/vitest.config.ts).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** The two environment variables that hold the home point, in decimal degrees (longitude positive EAST). */
export const HOME_POINT_ENV = { lat: "HOME_POINT_LAT", lon: "HOME_POINT_LON" } as const;

/** The git-ignored env files at the repository root that may hold the point, read in this order (later files do not override). */
export const HOME_POINT_ENV_FILES: readonly string[] = [".env.local", ".env"];

/** The file that marks the repository root when the env files are looked up from the working directory. */
export const REPO_ROOT_MARKER = "pnpm-workspace.yaml";

/** Raised when no source holds the point, or a source holds a malformed one. The message names the variables, never a value. */
export class HomePointUnsetError extends Error {
  readonly code = "E_HOME_POINT_UNSET";
  constructor(detail: string) {
    super(
      `E_HOME_POINT_UNSET: ${detail}. Set ${HOME_POINT_ENV.lat} and ${HOME_POINT_ENV.lon} (decimal degrees) in the environment or in the ` +
        `git-ignored root .env.local; the household exclusion cannot run without them.`,
    );
    this.name = "HomePointUnsetError";
  }
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The point from one source: null when neither variable is set there, the point when both are valid, and a throw when only one is
 * set or a value is not a coordinate (a half-configured source must not silently fall through to another).
 */
export function parseHomePoint(env: Env, source: string): { lat: number; lon: number } | null {
  const rawLat = env[HOME_POINT_ENV.lat]?.trim();
  const rawLon = env[HOME_POINT_ENV.lon]?.trim();
  if (!rawLat && !rawLon) return null;
  if (!rawLat || !rawLon) throw new HomePointUnsetError(`${source} sets only one of the two variables`);
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new HomePointUnsetError(`${source} holds a value that is not a latitude and longitude`);
  }
  return { lat, lon };
}

/** The repository root at or above `from` (the folder holding pnpm-workspace.yaml), or null outside the repository. */
export function repoRootFrom(from: string): string | null {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, REPO_ROOT_MARKER))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

/** The home point from the environment, else the root env files; throws HomePointUnsetError when none holds it. Never log the result. */
export function resolveHomePoint(env: Env = process.env, cwd: string = process.cwd()): { lat: number; lon: number } {
  const fromEnv = parseHomePoint(env, "the environment");
  if (fromEnv) return fromEnv;
  const root = repoRootFrom(cwd);
  for (const name of root ? HOME_POINT_ENV_FILES : []) {
    const file = path.join(root as string, name);
    if (!existsSync(file)) continue;
    const fromFile = parseHomePoint(parseEnv(readFileSync(file, "utf8")), `the root ${name}`);
    if (fromFile) return fromFile;
  }
  throw new HomePointUnsetError("no home point is configured");
}
