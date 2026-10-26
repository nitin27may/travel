// Pins core/src/privacy/home.ts: the only module that asks where the household is, with the exclusion radius from config/nearby.ts.
// The point comes from the environment (core/src/config/home.ts) through the probe, so no test types it, and no assertion message
// prints it.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_POINT_ENV, HomePointUnsetError, parseHomePoint, resolveHomePoint } from "../../src/config/home.ts";
import { HOME_RADIUS_KM } from "../../src/config/nearby.ts";
import { PUBLIC_START_CITY, nearHome } from "../../src/privacy/home.ts";
import { scrubOrigin, publicOrigin } from "../../src/privacy/origin.ts";
import { HOME_PROBE as HOME } from "./probe.ts";

/** The pre-CONS-2 formula, verbatim in behaviour: radius 2 km, earth radius 6371. */
function oldNearHome(lat: number, lon: number): boolean {
  const dLat = ((lat - HOME.lat) * Math.PI) / 180;
  const dLon = ((lon - HOME.lon) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((HOME.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a)) <= 2;
}

describe("privacy/home", () => {
  it("resolved a numeric point from the environment", () => {
    expect(Number.isFinite(HOME.lat) && Number.isFinite(HOME.lon)).toBe(true);
  });
  it("the radius is the shared one", () => expect(HOME_RADIUS_KM).toBe(2));
  it("nearHome agrees with the old formula on a ring of offsets", () => {
    const kmPerDegLat = 111.19;
    for (const km of [0, 0.5, 1, 1.5, 1.9, 1.99, 2.01, 2.5, 3, 10, 50]) {
      for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
        const lat = HOME.lat + (km * Math.cos((bearing * Math.PI) / 180)) / kmPerDegLat;
        const lon = HOME.lon + (km * Math.sin((bearing * Math.PI) / 180)) / (kmPerDegLat * Math.cos((HOME.lat * Math.PI) / 180));
        expect(nearHome(lat, lon), `offset ${km} km at ${bearing} degrees`).toBe(oldNearHome(lat, lon));
      }
    }
  });
  it("moves a point near home to the public starting city and leaves a far one", () => {
    const out = scrubOrigin({ a: { lat: HOME.lat, lon: HOME.lon }, b: { lat: 51.1784, lon: -115.5708 } });
    expect(out.a).toEqual({ lat: PUBLIC_START_CITY.lat, lon: PUBLIC_START_CITY.lon });
    expect(out.b).toEqual({ lat: 51.1784, lon: -115.5708 });
  });
  it("replaces the home town in text, keeping case", () => {
    expect(publicOrigin("Drive from Whitby, then whitby again")).toBe(`Drive from ${PUBLIC_START_CITY.name}, then ${PUBLIC_START_CITY.name.toLowerCase()} again`);
  });
});

describe("the home point comes only from the environment (PUBLIC-SCRUB)", () => {
  const empty = () => mkdtempSync(path.join(tmpdir(), "home-point-"));
  const set = { [HOME_POINT_ENV.lat]: "1.5", [HOME_POINT_ENV.lon]: "-2.5" };

  it("the module holds no coordinate pair: nothing in the source is a point", () => {
    for (const f of ["../../src/privacy/home.ts", "../../src/config/home.ts"]) {
      // the public start city is the one point the module may hold
      const src = readFileSync(new URL(f, import.meta.url), "utf8").replace(/^export const PUBLIC_START_CITY.*$/m, "");
      expect(src, f).not.toMatch(/lat:\s*-?\d+\.\d+,\s*lon:\s*-?\d+\.\d+/);
      expect(src, f).not.toMatch(/HOME_POINT\s*=\s*\{/);
    }
  });

  it("reads both variables, and refuses half a point or a value that is not a coordinate", () => {
    expect(parseHomePoint(set, "test")).toEqual({ lat: 1.5, lon: -2.5 });
    expect(parseHomePoint({}, "test")).toBeNull();
    expect(() => parseHomePoint({ [HOME_POINT_ENV.lat]: "1.5" }, "test")).toThrow(HomePointUnsetError);
    expect(() => parseHomePoint({ [HOME_POINT_ENV.lat]: "north", [HOME_POINT_ENV.lon]: "2" }, "test")).toThrow(/E_HOME_POINT_UNSET/);
    expect(() => parseHomePoint({ [HOME_POINT_ENV.lat]: "91", [HOME_POINT_ENV.lon]: "2" }, "test")).toThrow(HomePointUnsetError);
  });

  it("fails closed with a clear error when neither the environment nor a root env file holds it", () => {
    const dir = empty();
    writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages: []\n");
    expect(() => resolveHomePoint({}, dir)).toThrow(HomePointUnsetError);
    try {
      resolveHomePoint({}, dir);
    } catch (e) {
      expect((e as Error).message).toContain(HOME_POINT_ENV.lat);
      expect((e as Error).message).toContain(HOME_POINT_ENV.lon);
    }
  });

  it("falls back to the git-ignored root .env.local, and the environment wins over it", () => {
    const dir = empty();
    writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages: []\n");
    writeFileSync(path.join(dir, ".env.local"), `${HOME_POINT_ENV.lat}=3.25\n${HOME_POINT_ENV.lon}=4.75\n`);
    expect(resolveHomePoint({}, path.join(dir))).toEqual({ lat: 3.25, lon: 4.75 });
    expect(resolveHomePoint(set, dir)).toEqual({ lat: 1.5, lon: -2.5 });
  });

  it("no tracked file holds both values of the configured point (audit GB-C-1)", () => {
    const root = new URL("../../..", import.meta.url).pathname;
    const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
    const num = (n: number) => new RegExp(`(?<![\\d.])${String(n).replace(".", "\\.")}(?![\\d])`);
    const lat = num(HOME.lat);
    const lon = num(HOME.lon);
    const holders = files.filter((f) => {
      if (/\.(png|webp|jpg|woff2|ico|pdf)$/.test(f) || f.startsWith("web/public/globe/") || f === "core/test/setup/home-point.ts") return false;
      let text: string;
      try {
        text = readFileSync(`${root}${f}`, "utf8");
      } catch {
        return false;
      }
      return lat.test(text) && lon.test(text);
    });
    expect(holders).toEqual([]);
  });
});
