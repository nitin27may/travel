// The town guard (core/src/privacy/towns.ts, store.ts A33): generic over every town, never naming one, never leaking the home point.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_RADIUS_KM } from "../../src/config/nearby.ts";
import { haversineKm } from "../../src/geo/distance.ts";
import { HOME_TOWN_RE, nearHome } from "../../src/privacy/home.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { TOWN_POLICY, guardOffset, safeGeometry, safeOutline, safeTown } from "../../src/privacy/towns.ts";
import { encodePolyline5 } from "../../src/schema/api/legs.ts";
import { HOME_PROBE, northOfHome } from "./probe.ts";

const SRC = readFileSync(new URL("../../src/privacy/towns.ts", import.meta.url), "utf8");

describe("safeTown", () => {
  it("is the owner's Q87 policy: safe geometry, not exclusion", () => {
    expect(TOWN_POLICY).toBe("safe-geometry");
  });
  it("serves a centre outside the radius as it is", () => {
    const far = northOfHome(HOME_RADIUS_KM + 0.1);
    expect(safeTown(far)).toEqual({ ...far, moved: false });
  });
  it("moves a centre inside the radius to its Wikidata point when that point is outside", () => {
    const alt = northOfHome(6);
    expect(safeTown({ ...northOfHome(0.3), alt })).toEqual({ ...alt, moved: true });
  });
  it("otherwise moves it a fixed 2 x radius + radius / 4 due north, outside the radius wherever home is inside it", () => {
    for (const km of [0, 0.2, 1, 1.99]) {
      for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
        // a centre `km` from home on bearing `deg`, with a Wikidata point that is inside the radius too
        const c = { lat: HOME_PROBE.lat + (km / 111.19) * Math.cos((deg * Math.PI) / 180), lon: HOME_PROBE.lon + ((km / 111.19) * Math.sin((deg * Math.PI) / 180)) / Math.cos((HOME_PROBE.lat * Math.PI) / 180) };
        if (!nearHome(c.lat, c.lon)) continue;
        const got = safeTown({ ...c, alt: HOME_PROBE })!;
        expect(got.moved).toBe(true);
        expect(nearHome(got.lat, got.lon), `${km} km at ${deg}`).toBe(false);
        expect(haversineKm(c, got)).toBeCloseTo(guardOffset(), 6);
        // due north of the centre, whatever the direction of home: the moved point does not depend on where home lies
        expect(got.lon).toBeCloseTo(c.lon, 9);
        expect(got.lat).toBeGreaterThan(c.lat);
      }
    }
  });
  it("leaks nothing finer than the guard bit: two centres the same distance from different home directions move by the same vector", () => {
    const a = northOfHome(0.5);
    const b = { lat: HOME_PROBE.lat - 0.5 / 111.19, lon: HOME_PROBE.lon };
    const ma = safeTown(a)!;
    const mb = safeTown(b)!;
    expect(ma.lat - a.lat).toBeCloseTo(mb.lat - b.lat, 3);
    expect(ma.lon - a.lon).toBeCloseTo(mb.lon - b.lon, 9);
  });
});

describe("safeGeometry and safeOutline", () => {
  const ring = (c: { lat: number; lon: number }, d: number) => [[[c.lon - d, c.lat - d], [c.lon + d, c.lat - d], [c.lon + d, c.lat + d], [c.lon - d, c.lat - d]]];
  it("refuses an outline with any vertex within the radius, in either axis order, at any depth", () => {
    const near = northOfHome(1);
    expect(safeGeometry({ type: "Polygon", coordinates: ring(northOfHome(30), 0.05) })).toBe(true);
    expect(safeGeometry({ type: "MultiPolygon", coordinates: [ring(northOfHome(30), 0.05), [[[near.lon, near.lat], [0, 0], [1, 1]]]] })).toBe(false);
    expect(safeGeometry([[near.lat, near.lon]])).toBe(false);
    expect(safeOutline({ type: "Polygon", coordinates: ring(northOfHome(1), 0.001) })).toBeNull();
    const ok = { type: "Polygon", coordinates: ring(northOfHome(30), 0.05) };
    expect(safeOutline(ok)).toBe(ok);
    expect(safeOutline(null)).toBeNull();
  });
  it("reads an encoded line too", () => {
    const near = northOfHome(0.5);
    expect(safeGeometry(encodePolyline5([[-116.1, 51.3], [near.lon, near.lat]]))).toBe(false);
    expect(safeGeometry(encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]))).toBe(true);
  });
  it("agrees with the detector: what it serves, respond() serves", () => {
    for (const g of [{ coordinates: ring(northOfHome(30), 0.05) }, { coordinates: ring(northOfHome(1), 0.001) }]) {
      expect(safeGeometry(g)).toBe(privacyHits(g).length === 0);
    }
  });
});

describe("the guard names no town", () => {
  it("towns.ts holds neither the home town's name nor a coordinate", () => {
    const code = SRC.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(HOME_TOWN_RE.test(SRC)).toBe(false);
    expect(code).not.toMatch(/-?\d{1,3}\.\d{3,}/);
  });
});
