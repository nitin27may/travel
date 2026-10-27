// Leg cache keys and privacy (driving-time-model.md 5.6 and 6.3 "Privacy"): only r:, t: and g: keys; no key within 2 km of home; a
// visitor's start cannot become a key (compile time) and leaves nothing behind. The home point is used in memory only, never printed.
import { describe, expect, it } from "vitest";
import { HOME_RADIUS_KM } from "../../src/config/nearby.ts";
import { aliasKey, cellKey, cellNearHome, geohash, geohashBox, keyKind, parseCacheKey, townKey, writableLegKey } from "../../src/drive/keys.ts";
import { indexDriveData, modelDrive } from "../../src/drive/model.ts";
import type { PublicDrivePoint, VisitorDrivePoint } from "../../src/drive/types.ts";
import { HOME_PROBE } from "../privacy/probe.ts";

/** A point `km` north of home (in memory only). */
const northOfHome = (km: number) => ({ lat: HOME_PROBE.lat + km / 111.2, lon: HOME_PROBE.lon });

describe("geohash", () => {
  it("encodes the reference point and its box holds it", () => {
    expect(geohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
    const box = geohashBox(geohash(51.17622, -115.56982));
    expect(box.south).toBeLessThanOrEqual(51.17622);
    expect(box.north).toBeGreaterThanOrEqual(51.17622);
    expect(box.west).toBeLessThanOrEqual(-115.56982);
    expect(box.east).toBeGreaterThanOrEqual(-115.56982);
    expect(() => geohashBox("a!")).toThrow();
  });
});

describe("key grammar", () => {
  it("mints r:, t: and g: keys and parses them back", () => {
    const r = aliasKey("place/moraine-lake");
    const t = townKey(5892532);
    const g = cellKey({ lat: 51.17622, lon: -115.56982 })!;
    expect([r, t, g].map(keyKind)).toEqual(["r", "t", "g"]);
    for (const k of [r, t, g]) expect(parseCacheKey(k)).toBe(k);
    expect(g).toMatch(/^g:[0-9b-hjkmnp-z]{6}$/);
  });

  it("refuses a dated trip folder, a bad ref, a bad town id and an unknown prefix", () => {
    expect(() => aliasKey("legacy/canadian-rockies-sept-2029/sights/moraine-lake")).toThrow(/dated/);
    expect(() => aliasKey("Place With Spaces")).toThrow();
    expect(() => townKey(0)).toThrow();
    expect(() => townKey(1.5)).toThrow();
    expect(parseCacheKey("r:legacy/dolomites-july-2027/x")).toBeNull();
    expect(parseCacheKey("x:123")).toBeNull();
    expect(parseCacheKey("g:abc")).toBeNull();
    expect(parseCacheKey("t:abc")).toBeNull();
  });
});

describe("home refusal (HOME_RADIUS_KM, core/src/privacy/home.ts)", () => {
  it("refuses a cell at home and within the radius; allows one well outside", () => {
    expect(cellKey(northOfHome(0))).toBeNull();
    expect(cellKey(northOfHome(1))).toBeNull();
    expect(cellKey(northOfHome(HOME_RADIUS_KM + 0.3))).toBeNull(); // the cell still touches the circle
    expect(cellKey(northOfHome(50))).not.toBeNull();
  });

  it("refuses a stored g: key near home on parse, and a keyed point near home on write", () => {
    const near = `g:${geohash(northOfHome(0.5).lat, northOfHome(0.5).lon)}`;
    expect(parseCacheKey(near)).toBeNull();
    const far: PublicDrivePoint = { ...northOfHome(80), cc: "CA", key: townKey(5892532) };
    const home: PublicDrivePoint = { ...northOfHome(0.2), cc: "CA", key: aliasKey("place/somewhere") };
    expect(writableLegKey(far, home)).toBeNull();
    expect(writableLegKey(home, far)).toBeNull();
    expect(writableLegKey(far, { ...far, key: aliasKey("place/elsewhere") })).toEqual({ from_cell: far.key, to_cell: "r:place/elsewhere" });
  });

  it("tests the whole cell, not only its centre (injected guard)", () => {
    const hash = geohash(10, 10);
    const box = geohashBox(hash);
    const cornerOnly = (lat: number, lon: number) => lat === box.north && lon === box.east;
    expect(cellNearHome(hash, cornerOnly)).toBe(true);
    expect(cellKey({ lat: 10, lon: 10 }, cornerOnly)).toBeNull();
    expect(cellKey({ lat: 10, lon: 10 }, () => false)).toBe(`g:${hash}`);
  });
});

describe("the visitor's start is never a key", () => {
  const visitor: VisitorDrivePoint = { lat: 43.65, lon: -79.38, cc: "CA", sub: "ON", visitor: true };
  const pub: PublicDrivePoint = { lat: 45.0, lon: -78.0, cc: "CA", sub: "ON", key: townKey(6167865) };

  it("cannot be passed to the key builders (compile-time)", () => {
    // @ts-expect-error a VisitorDrivePoint is not a PublicDrivePoint
    expect(writableLegKey(visitor, pub)).toBeNull();
    // @ts-expect-error a VisitorDrivePoint cannot be a cell
    expect(() => cellKey(visitor)).not.toThrow();
    // @ts-expect-error a visitor point has no key
    const bad: VisitorDrivePoint = { ...visitor, key: townKey(1) };
    void bad;
  });

  it("is modelled in memory and the answer carries no coordinate or key", () => {
    const e = modelDrive(visitor, pub, {}, indexDriveData({ profiles: [], areas: [], crossings: [], segments: [], calibration: null }));
    expect(e.minutes).toBeGreaterThan(0);
    const text = JSON.stringify(e);
    expect(text).not.toContain("43.65");
    expect(text).not.toContain("t:");
  });
});
