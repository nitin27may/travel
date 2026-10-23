// The towns layer (core/src/privacy/towns.ts, store.ts A33; owner ruling Q87 of 23 Oct 2026): every town as the public gazetteer has it,
// accepted by the detector by identity; route lines keep their refusal. Never names a town, never prints the home point.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_RADIUS_KM } from "../../src/config/nearby.ts";
import { HOME_TOWN_RE } from "../../src/privacy/home.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { TOWN_POLICY, gazetteerOf, lineClearOfHome, publicGazetteer, publicTownLayer, safeLine, safeOutline, safeTown } from "../../src/privacy/towns.ts";
import { encodePolyline5 } from "../../src/schema/api/legs.ts";
import { northOfHome } from "./probe.ts";

const SRC = readFileSync(new URL("../../src/privacy/towns.ts", import.meta.url), "utf8");
const DETECT = readFileSync(new URL("../../src/privacy/detect.ts", import.meta.url), "utf8");
const ring = (c: { lat: number; lon: number }, d: number) => [[[c.lon - d, c.lat - d], [c.lon + d, c.lat - d], [c.lon + d, c.lat + d], [c.lon - d, c.lat - d]]];

describe("safeTown and safeOutline: the identity", () => {
  it("is the owner's Q87 ruling: show every town as the public data does", () => {
    expect(TOWN_POLICY).toBe("public");
  });
  it("serves every centre unchanged, inside the radius too, and every outline unchanged", () => {
    for (const km of [0, 0.3, HOME_RADIUS_KM - 0.1, HOME_RADIUS_KM + 0.1, 30]) {
      const c = northOfHome(km);
      expect(safeTown(c)).toEqual(c);
    }
    const g = { type: "Polygon", coordinates: ring(northOfHome(0.5), 0.01) };
    expect(safeOutline(g)).toBe(g);
    expect(safeOutline(null)).toBeNull();
  });
  it("'exclude' is the documented product switch: it drops a centre inside the radius and keeps the rest", () => {
    expect(safeTown(northOfHome(0.3), "exclude")).toBeNull();
    expect(safeTown(northOfHome(30), "exclude")).toEqual(northOfHome(30));
  });
});

describe("publicGazetteer and publicTownLayer", () => {
  const near = { id: "ca-zz-planted-a", name: "Planted A", ...northOfHome(0.5) };
  const far = { id: "ca-zz-planted-b", name: "Planted B", ...northOfHome(40) };
  const outline = { id: near.id, geometry: { type: "Polygon", coordinates: ring(northOfHome(0.5), 0.01) } };
  it("holds the loaded points and outline vertices, exactly", () => {
    const g = publicGazetteer([near, far], [outline]);
    expect(g.size).toBe(2);
    expect(g.has(near.id) && g.has(far.id) && !g.has("ca-zz-other")).toBe(true);
    expect(g.name(near.id)).toBe("Planted A");
    expect(g.isPoint(near.id, near.lat, near.lon)).toBe(true);
    expect(g.isPoint(near.id, near.lat + 1e-9, near.lon)).toBe(false);
    expect(g.isPoint(far.id, near.lat, near.lon)).toBe(false);
    const v = outline.geometry.coordinates[0]![0]!;
    expect(g.isVertex(near.id, v[0]!, v[1]!)).toBe(true);
    expect(g.isVertex(near.id, v[1]!, v[0]!)).toBe(false);
    expect(g.isVertex(far.id, v[0]!, v[1]!)).toBe(false);
  });
  it("serves the layer as loaded and builds the gazetteer from the same rows", () => {
    const layer = publicTownLayer([near, far], [outline, { id: "ca-zz-no-town", geometry: null }]);
    expect(layer.towns).toEqual([near, far]);
    expect(layer.outlines).toEqual([outline]);
    expect(layer.gazetteer.isPoint(near.id, near.lat, near.lon)).toBe(true);
    const ex = publicTownLayer([near, far], [outline], "exclude");
    expect(ex.towns).toEqual([far]);
    expect(ex.outlines).toEqual([]);
    expect(ex.gazetteer.has(near.id)).toBe(false);
  });
  it("the detector accepts a served town by identity and nothing else", () => {
    const { gazetteer } = publicTownLayer([near], [outline]);
    expect(privacyHits({ items: [near] }, 20, { gazetteer })).toEqual([]);
    expect(privacyHits({ id: near.id, name: near.name, geometry: outline.geometry }, 20, { gazetteer })).toEqual([]);
    expect(privacyHits({ items: [near] }).length).toBe(1);
    expect(privacyHits({ items: [{ ...near, lat: near.lat + 0.001 }] }, 20, { gazetteer }).length).toBe(1);
  });
  it("gazetteerOf reads a store's PublicTownsHolder, and is null for a store without one", async () => {
    const g = publicGazetteer([far]);
    expect(await gazetteerOf({ publicTowns: () => g })).toBe(g);
    expect(await gazetteerOf({ publicTowns: async () => g })).toBe(g);
    expect(await gazetteerOf({})).toBeNull();
    expect(await gazetteerOf(null)).toBeNull();
  });
});

describe("safeLine: route lines are not gazetteer data and keep their refusal (A34)", () => {
  it("refuses a line with any vertex within the radius, in either axis order, at any depth", () => {
    const near = northOfHome(1);
    expect(lineClearOfHome({ type: "Polygon", coordinates: ring(northOfHome(30), 0.05) })).toBe(true);
    expect(lineClearOfHome({ type: "MultiPolygon", coordinates: [ring(northOfHome(30), 0.05), [[[near.lon, near.lat], [0, 0], [1, 1]]]] })).toBe(false);
    expect(lineClearOfHome([[near.lat, near.lon]])).toBe(false);
    const ok = { type: "LineString", coordinates: [[-116.1, 51.3], [-116.2, 51.4]] };
    expect(safeLine(ok)).toBe(ok);
    expect(safeLine(null)).toBeNull();
  });
  it("reads an encoded line too, and agrees with the detector", () => {
    const near = northOfHome(0.5);
    expect(safeLine(encodePolyline5([[-116.1, 51.3], [near.lon, near.lat]]))).toBeNull();
    const clear = encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]);
    expect(safeLine(clear)).toBe(clear);
    for (const g of [{ coordinates: ring(northOfHome(30), 0.05) }, { coordinates: ring(northOfHome(1), 0.001) }]) expect(lineClearOfHome(g)).toBe(privacyHits(g).length === 0);
  });
});

describe("the towns code and the detector name no town", () => {
  const code = (src: string) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  it("towns.ts holds neither the home town's name nor a coordinate", () => {
    expect(HOME_TOWN_RE.test(SRC)).toBe(false);
    expect(code(SRC)).not.toMatch(/-?\d{1,3}\.\d{3,}/);
  });
  it("detect.ts holds neither the home town's name nor a coordinate (the word comes from home.ts)", () => {
    expect(HOME_TOWN_RE.test(DETECT)).toBe(false);
    expect(code(DETECT)).not.toMatch(/-?\d{1,3}\.\d{3,}/);
  });
});
