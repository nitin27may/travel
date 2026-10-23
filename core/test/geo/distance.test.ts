// Golden and unit tests for core/src/geo/distance.ts. pairs.json was captured from the implementations this module replaced
// (fit.ts haversineKm, checks/time.ts haversineM, catalogue/distance.ts bearingOf and bandOf) BEFORE they were removed, so a pass here
// means the visitor-facing distances, bearings and bands did not move. The Python mirror reads the same table (tools/tests/test_geo_parity.py).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bandOf } from "../../src/geo/bands.ts";
import { EARTH_RADIUS_KM, bboxHas, bboxOf, bearing8, circleMeetsBbox, haversineKm, haversineM } from "../../src/geo/distance.ts";
import { AREA_DEFAULT_R, DAY_TRIP_KM, HOME_RADIUS_KM, NEAR_KM, RADIUS_CAP, RADIUS_PRESETS } from "../../src/config/nearby.ts";
import { API_LIMITS } from "../../src/schema/api/limits.ts";

interface Pt { name: string; lat: number; lon: number }
interface Row { a: Pt; b: Pt; km: number; m: number; bearing: string; band: string }
const table = JSON.parse(readFileSync(new URL("./pairs.json", import.meta.url), "utf8")) as { radiusKm: number; pairs: Row[] };

describe("geo/distance golden table", () => {
  it("has the 22 pairs the Python parity test also reads", () => expect(table.pairs).toHaveLength(22));
  it("uses the earth radius the old core implementation used", () => expect(EARTH_RADIUS_KM).toBe(table.radiusKm));
  for (const r of table.pairs) {
    const label = `${r.a.name} -> ${r.b.name}`;
    it(`${label}: km and m`, () => {
      expect(haversineKm(r.a, r.b)).toBeCloseTo(r.km, 9);
      expect(haversineM(r.a, r.b)).toBeCloseTo(r.m, 6);
    });
    it(`${label}: bearing and band`, () => {
      expect(bearing8(r.a, r.b)).toBe(r.bearing);
      expect(bandOf(r.km)).toBe(r.band);
    });
    it(`${label}: the whole-km figure is the same at the radii the other copies used`, () => {
      // web/lib/map/geo.ts, places.ts, legs-ors.mjs, search/build.ts, origin.ts and locations.py used 6371; core used 6371.0088.
      const old = (r.km * 6371) / EARTH_RADIUS_KM;
      expect(Math.abs(old - r.km)).toBeLessThanOrEqual(r.km * 2e-6);
      // 1.4e-6 of 19,000 km is 27 m, so a tenth of a km can flip on a long pair; the whole-km figure a visitor reads does not.
      expect(Math.round(old)).toBe(Math.round(r.km));
    });
  }
});

describe("geo/distance", () => {
  it("is symmetric and zero for the same point", () => {
    const a = { lat: 51.18, lon: -115.57 };
    const b = { lat: 51.43, lon: -116.18 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 12);
  });
  it("does not return NaN for antipodes", () => expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 6));
  it("band edges", () => {
    expect(bandOf(1.19)).toBe("walk");
    expect(bandOf(1.2)).toBe("lt15");
    expect(bandOf(200)).toBe("60-120");
  });
  it("bbox of a circle holds its edge points and refuses far ones", () => {
    const c = { lat: 51.18, lon: -115.57 };
    const box = bboxOf(c, 25);
    expect(bboxHas(box, c)).toBe(true);
    expect(bboxHas(box, { lat: 51.18, lon: -115.57 + 0.3 })).toBe(true);
    expect(bboxHas(box, { lat: 53, lon: -115.57 })).toBe(false);
  });
  it("bbox crosses the antimeridian", () => {
    const box = bboxOf({ lat: -17.7, lon: 179.9 }, 50);
    expect(box.west).toBeGreaterThan(box.east);
    expect(bboxHas(box, { lat: -17.7, lon: -179.9 })).toBe(true);
    expect(bboxHas(box, { lat: -17.7, lon: 0 })).toBe(false);
  });
  it("circleMeetsBbox", () => {
    const box = { west: -116, south: 51, east: -115, north: 52 };
    expect(circleMeetsBbox({ lat: 51.5, lon: -115.5 }, 1, box)).toBe(true);
    expect(circleMeetsBbox({ lat: 51.5, lon: -114.5 }, 40, box)).toBe(true);
    expect(circleMeetsBbox({ lat: 51.5, lon: -114.5 }, 30, box)).toBe(false);
    expect(circleMeetsBbox({ lat: 53, lon: -115.5 }, 120, box)).toBe(true);
    expect(circleMeetsBbox({ lat: 53, lon: -115.5 }, 120, { ...box, west: 170, east: -170 })).toBe(false);
  });
});

describe("config/nearby has one source", () => {
  it("reads the contract's limits and does not change their values", () => {
    expect([NEAR_KM, DAY_TRIP_KM, RADIUS_CAP, AREA_DEFAULT_R]).toEqual([25, 100, 100, 50]);
    expect(RADIUS_PRESETS).toEqual([10, 25, 50, 100]);
    expect(RADIUS_PRESETS).toBe(API_LIMITS.nearRadius.presets);
    expect(HOME_RADIUS_KM).toBe(2);
  });
});
