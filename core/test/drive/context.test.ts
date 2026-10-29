// RB-008 (review TB-R1): drive estimates ran 25 to 40 % long in the builder because its points (catalogue rows, hubs, airports) carry
// a country and nothing else: a Canadian point with no province had no rural limit, so the model guessed 80 km/h on hilly terrain.
// The model now boxes such a point into its province and area (data/reference/drive box fields, model.ts contextOf), and a longer
// leg runs part of its way at the motorway limit (DRIVE_MODEL.motorwayShare). Pinned here on the routed ORS pairs of the golden set.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDriveData, loadGolden } from "../../src/drive/load.ts";
import { contextOf, explainDrive, indexDriveData, modelDrive } from "../../src/drive/model.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const idx = indexDriveData(loadDriveData(REPO).data);
const golden = loadGolden(REPO, [])!;
const bare = (p: { lat: number; lon: number; cc: string | null }) => ({ lat: p.lat, lon: p.lon, cc: p.cc });
const pair = (id: string) => golden.pairs.find((p) => p.id === id)!;

describe("a point that arrives with only a country takes its province and area from the boxes", () => {
  it("Banff, Lake Louise and Jasper are Alberta park points; Toronto is Ontario; Cortina is Belluno", () => {
    expect(contextOf(idx, { lat: 51.1784, lon: -115.5708, cc: "CA" })).toMatchObject({ sub: "AB", area: "CA/AB/banff-national-park" });
    expect(contextOf(idx, { lat: 51.41167, lon: -116.22806, cc: "CA" })).toMatchObject({ sub: "AB", area: "CA/AB/banff-national-park" });
    expect(contextOf(idx, { lat: 52.8737, lon: -118.0814, cc: "CA" })).toMatchObject({ sub: "AB", area: "CA/AB/jasper-national-park" });
    expect(contextOf(idx, { lat: 43.67028, lon: -79.38667, cc: "CA" })).toMatchObject({ sub: "ON", area: null });
    expect(contextOf(idx, { lat: 46.5405, lon: 12.1357, cc: "IT" })).toMatchObject({ area: "IT/veneto/belluno" });
  });
  it("a point that names its subdivision or area (even as null) is never boxed", () => {
    const p = { lat: 51.1784, lon: -115.5708, cc: "CA", sub: null, area: null };
    expect(contextOf(idx, p)).toBe(p);
    expect(contextOf(idx, { lat: 51.1784, lon: -115.5708, cc: null })).toEqual({ lat: 51.1784, lon: -115.5708, cc: null });
  });
  it("on the golden set, a bare point drives like the authored one (mean difference under 2 %)", () => {
    let sum = 0;
    for (const p of golden.pairs) {
      const full = modelDrive(p.a, p.b, {}, idx).minutes!;
      const boxed = modelDrive(bare(p.a), bare(p.b), {}, idx).minutes!;
      sum += Math.abs(boxed - full) / full;
    }
    expect(sum / golden.pairs.length).toBeLessThan(0.02);
  });
});

describe("the known pairs are within 15 % (RB-008)", () => {
  for (const id of ["run:b:yyc>banff", "run:b:yyc>canmore", "run:b:yyc>lake-louise", "run:b:yyc>jasper", "run:b:yeg>yyc"]) {
    it(`${id}, routed by ORS, from bare points`, () => {
      const p = pair(id);
      const m = modelDrive(bare(p.a), bare(p.b), {}, idx).minutes!;
      expect(Math.abs(m / p.minutes - 1), `${m} against ${p.minutes}`).toBeLessThanOrEqual(0.15);
    });
  }
  it("Toronto to Dwight, the review's Muskoka corridor (about 2 h 40 by the 400 and Highway 11)", () => {
    const m = modelDrive({ lat: 43.67028, lon: -79.38667, cc: "CA" }, { lat: 45.32726, lon: -79.01127, cc: "CA" }, {}, idx).minutes!;
    expect(Math.abs(m / 160 - 1), `${m}`).toBeLessThanOrEqual(0.15);
  });
  it("the motorway share is the leg's: none under 20 km, none between two mountain ends, and never faster than the motorway", () => {
    const short = explainDrive({ lat: 43.65, lon: -79.38, cc: "CA" }, { lat: 43.75, lon: -79.3, cc: "CA" }, {}, idx).explanation;
    expect(short.motorwayShare).toBe(0);
    const park = explainDrive({ lat: 51.1784, lon: -115.5708, cc: "CA" }, { lat: 52.8737, lon: -118.0814, cc: "CA" }, {}, idx).explanation;
    expect(park.motorwayShare).toBe(0);
    for (const p of golden.pairs) {
      const e = explainDrive(bare(p.a), bare(p.b), {}, idx);
      expect(e.explanation.limitKmh * e.explanation.realisation, p.id).toBeLessThanOrEqual(110); // the realised speed, before calibration
      expect(e.estimate.minutes!).toBeGreaterThan((p.straightKm / 130) * 60);
    }
  });
});
