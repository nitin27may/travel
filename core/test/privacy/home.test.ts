// Pins core/src/privacy/home.ts: the only module that holds the household point, with the exclusion radius from config/nearby.ts.
// The test reads the point out of the source text so it never types it, and no assertion message prints it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_RADIUS_KM } from "../../src/config/nearby.ts";
import { PUBLIC_START_CITY, nearHome } from "../../src/privacy/home.ts";
import { scrubOrigin, publicOrigin } from "../../src/privacy/origin.ts";

const SRC = readFileSync(new URL("../../src/privacy/home.ts", import.meta.url), "utf8");
const m = /const HOME_POINT = \{ lat: (-?[\d.]+), lon: (-?[\d.]+) \}/.exec(SRC);
const HOME = { lat: Number(m?.[1]), lon: Number(m?.[2]) };

/** The pre-CONS-2 formula, verbatim in behaviour: radius 2 km, earth radius 6371. */
function oldNearHome(lat: number, lon: number): boolean {
  const dLat = ((lat - HOME.lat) * Math.PI) / 180;
  const dLon = ((lon - HOME.lon) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((HOME.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a)) <= 2;
}

describe("privacy/home", () => {
  it("found a numeric point in the module", () => {
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
