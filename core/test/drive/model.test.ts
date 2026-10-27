// The L2 model (driving-time-model.md 4.3, 4.4, 6.3): golden legs from our routed data, the property tests, and every modifier.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRIVE_MODEL, DRIVE_TERRAINS } from "../../src/config/drive.ts";
import { haversineKm } from "../../src/geo/distance.ts";
import { naiveMinutes } from "../../src/drive/calibrate.ts";
import { loadDriveData, loadGolden } from "../../src/drive/load.ts";
import { bandId, createModel, detourOf, explainDrive, harderTerrain, indexDriveData, modelDrive, type DriveData } from "../../src/drive/model.ts";
import type { CrossingRow, ProfileRow, SegmentRow } from "../../src/drive/schema.ts";
import type { ModelPoint } from "../../src/drive/types.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const loaded = loadDriveData(REPO);
const idx = indexDriveData(loaded.data);
const problems: string[] = [];
const golden = loadGolden(REPO, problems)!;
const byId = (id: string) => {
  const p = golden.pairs.find((x) => x.id === id);
  if (!p) throw new Error(`golden pair ${id} is missing`);
  return p;
};
const end = (e: { lat: number; lon: number; cc: string | null; sub: string | null; area: string | null }): ModelPoint => ({ ...e });
const err = (model: number, routed: number): number => Math.abs(model - routed) / routed;

describe("the data the model reads", () => {
  it("parses and passes the cross-file checks", () => {
    expect(loaded.problems).toEqual([]);
    expect(problems).toEqual([]);
  });
});

describe("golden legs from our routed data", () => {
  it("Banff to Lake Louise: the naive rule doubles it (98 min against 48); the model is within 20% and its range holds the routed time", () => {
    const p = byId("run:m:banff>lake-louise");
    expect(p.minutes).toBeCloseTo(47.9, 1);
    expect(naiveMinutes(p.straightKm)).toBeGreaterThan(90);
    const e = modelDrive(end(p.a), end(p.b), {}, idx);
    expect(e.confidence).toBe("modelled");
    expect(e.source).toBe("model");
    expect(err(e.minutes!, p.minutes)).toBeLessThan(0.2);
    expect(e.range![0]).toBeLessThanOrEqual(p.minutes);
    expect(e.range![1]).toBeGreaterThanOrEqual(p.minutes);
  });

  it("Calgary airport to Banff (base pair): within 10%", () => {
    const p = byId("run:b:yyc>banff");
    expect(err(modelDrive(end(p.a), end(p.b), {}, idx).minutes!, p.minutes)).toBeLessThan(0.1);
  });

  it("Lake Louise to Bow Lake (Icefields Parkway): naive 66 against 31; the model cuts the error to under a third", () => {
    const p = byId("run:m:lake-louise>bow-lake");
    const naive = err(naiveMinutes(p.straightKm), p.minutes);
    const model = err(modelDrive(end(p.a), end(p.b), {}, idx).minutes!, p.minutes);
    expect(naive).toBeGreaterThan(1);
    expect(model).toBeLessThan(0.35);
  });

  it("Dolomites hops are alpine, modelled from the IT profile, and stay rough (spec 2.3: short alpine hops resist any offline model)", () => {
    for (const id of ["dolomites-2027:cortina>lagazuoi", "dolomites-2027:san-candido>tre-cime", "dolomites-2027:landro>san-candido"]) {
      const p = byId(id);
      const { estimate, explanation } = explainDrive(end(p.a), end(p.b), {}, idx);
      expect(explanation.terrain, id).toBe("alpine");
      expect(explanation.profiles, id).toEqual(["IT"]);
      expect(explanation.calibrationCell, id).toMatch(/^IT\|alpine\|/);
      expect(err(estimate.minutes!, p.minutes), id).toBeLessThan(0.4);
      expect(estimate.range![0], id).toBeLessThanOrEqual(estimate.minutes!);
      expect(estimate.range![1], id).toBeGreaterThan(estimate.minutes!);
    }
  });

  it("uses the subdivision's rural limit: Alberta 100, British Columbia 80", () => {
    const ab = explainDrive({ lat: 51.18, lon: -115.57, cc: "CA", sub: "AB" }, { lat: 51.43, lon: -116.18, cc: "CA", sub: "AB" }, {}, idx).explanation;
    const bc = explainDrive({ lat: 51.3, lon: -116.97, cc: "CA", sub: "BC" }, { lat: 51.44, lon: -116.54, cc: "CA", sub: "BC" }, {}, idx).explanation;
    expect(ab.ruralKmh).toBe(100);
    expect(bc.ruralKmh).toBe(80);
  });
});

describe("properties (spec 6.3)", () => {
  const from: ModelPoint = { lat: 51.0, lon: -115.0, cc: "CA", sub: "AB" };
  const at = (km: number): ModelPoint => ({ lat: 51.0, lon: -115.0 + km / (111.32 * Math.cos((51 * Math.PI) / 180)), cc: "CA", sub: "AB" });

  it("is monotonic in distance within one country and terrain (prior and calibrated; band edges included)", () => {
    for (const ix of [indexDriveData({ ...loaded.data, calibration: null }), idx]) {
      for (const area of [null, "CA/AB/banff-national-park"]) {
        let last = 0;
        for (let km = 1; km <= 400; km += 0.5) {
          const m = modelDrive({ ...from, area }, { ...at(km), area }, {}, ix).minutes!;
          expect(m, `${km} km in ${area ?? "AB"}`).toBeGreaterThanOrEqual(last);
          last = m;
        }
      }
    }
    // Italy, alpine, calibrated
    let last = 0;
    for (let km = 1; km <= 300; km += 0.5) {
      const p: ModelPoint = { lat: 46.5, lon: 11.0, cc: "IT", area: "IT/trentino-alto-adige/bolzano" };
      const m = modelDrive(p, { ...p, lon: 11.0 + km / 76.6 }, {}, idx).minutes!;
      expect(m, `${km} km IT`).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });

  it("is symmetric without a ferry, a one-way crossing or a closure", () => {
    for (const p of golden.pairs) {
      expect(modelDrive(end(p.a), end(p.b), {}, idx)).toEqual(modelDrive(end(p.b), end(p.a), {}, idx));
    }
  });

  it("is never faster than the motorway limit, answers integers, and repeats itself", () => {
    for (const p of golden.pairs) {
      const e = modelDrive(end(p.a), end(p.b), {}, idx);
      const again = modelDrive(end(p.a), end(p.b), {}, idx);
      expect(e).toEqual(again);
      expect(Number.isInteger(e.minutes)).toBe(true);
      expect(Number.isInteger(e.km)).toBe(true);
      const row = loaded.data.profiles.find((r) => r.cc === p.a.cc && r.sub === p.a.sub) ?? loaded.data.profiles.find((r) => r.cc === p.a.cc && r.sub === null)!;
      const motorway = row.legal.motorway ?? 130;
      expect(haversineKm(p.a, p.b) / (e.minutes! / 60)).toBeLessThanOrEqual(motorway);
    }
  });

  it("winds more on short hops and by terrain", () => {
    expect(detourOf("alpine", 5)).toBeGreaterThan(detourOf("alpine", 50));
    for (const t of DRIVE_TERRAINS) expect(detourOf(t, 1000)).toBeCloseTo(DRIVE_MODEL.detourByTerrain[t], 6);
    expect(harderTerrain("flat", "alpine")).toBe("alpine");
    expect(harderTerrain("hilly", "mountain")).toBe("mountain");
    expect(bandId(9.99)).toBe("lt10");
    expect(bandId(10)).toBe("10-30");
    expect(bandId(151)).toBe("gt150");
  });

  it("createModel binds the index with the spec 6.1 signature", () => {
    const m = createModel(idx);
    expect(m(from, at(50))).toEqual(modelDrive(from, at(50), {}, idx));
  });
});

// ----- confidence and modifiers on a small in-memory data set ----------------------------------------------------------------------------

const SRC = { url: "https://example.org/source", title: "a test source", read: "2026-10-27" };
const row = (cc: string, sub: string | null, rural: number | null, extra: Partial<ProfileRow> = {}): ProfileRow => ({
  cc, sub, name: `${cc} ${sub ?? ""}`.trim(), side: "right", legal: { urban: 50, rural, expressway: null, motorway: 120, unpaved: null }, legalSource: SRC,
  terrain: "rolling", terrainBasis: "prior", rain: null, winter: null, borderDefaultMin: {}, ferryCheckinMin: null, version: 1, read: "2026-10-27", ...extra,
});
const AREA_A = "XA/r/one";
const AREA_B = "XA/r/two";
const base: DriveData = {
  profiles: [
    row("XA", null, 90, { winter: { months: [1, 2], factor: 0.8, basis: "prior" }, borderDefaultMin: { XB: 25 }, ferryCheckinMin: 30 }),
    row("XB", null, 90),
  ],
  areas: [
    { area: AREA_A, terrain: "mountain", basis: "prior", unpavedShare: 0, winterFactor: null, note: "test" },
    { area: AREA_B, terrain: "mountain", basis: "prior", unpavedShare: 0, winterFactor: 0.7, note: "test" },
  ],
  crossings: [],
  segments: [],
  calibration: null,
};
const a: ModelPoint = { lat: 60.0, lon: 10.0, cc: "XA", area: AREA_A };
const b: ModelPoint = { lat: 60.3, lon: 10.4, cc: "XA", area: AREA_B };
const ferry: CrossingRow = { id: "f1", from: AREA_A, to: AREA_B, kind: "ferry", via: "place/ferry", symmetric: true, minutes: 40, checkinMin: null, headwayMin: { "7": 60 }, months: null, source: SRC };
const closed: CrossingRow = { ...ferry, id: "c1", kind: "closed-season", minutes: 90, headwayMin: null, months: [12, 1, 2], symmetric: false };
const seg = (s: Partial<SegmentRow>): SegmentRow => ({ id: "s1", refs: ["place/end-b"], rule: "closed", note: "a test stretch", source: SRC, ...s });
const bKeyed = { ...b, key: "r:place/end-b" } as unknown as ModelPoint;

describe("confidence", () => {
  it("answers rough with the fallback when a country has no profile", () => {
    const ix = indexDriveData(base);
    const p = { lat: 10, lon: 10, cc: "ZZ" };
    const q = { lat: 10.3, lon: 10.2, cc: "ZZ" };
    const { estimate, explanation } = explainDrive(p, q, {}, ix);
    expect(estimate.confidence).toBe("rough");
    expect(explanation.ruralKmh).toBe(DRIVE_MODEL.fallbackRuralKmh);
    expect(explanation.terrain).toBe(DRIVE_MODEL.fallbackTerrain);
    expect(explanation.calibrationCell).toBeNull();
    expect(explainDrive({ ...p, cc: null }, q, {}, ix).estimate.confidence).toBe("rough");
  });

  it("answers modelled with the prior range when the cell is uncalibrated", () => {
    const e = modelDrive(a, b, {}, indexDriveData(base));
    expect(e.confidence).toBe("modelled");
    expect(e.range).toEqual([Math.round(e.minutes! * DRIVE_MODEL.priorRange[0]), Math.round(e.minutes! * DRIVE_MODEL.priorRange[1])]);
    expect(e.attribution).toBeNull();
    expect(e.flags).toEqual([]);
  });
});

describe("modifiers (spec 4.4)", () => {
  const plain = modelDrive(a, b, {}, indexDriveData(base)).minutes!;

  it("ferry: sailing + the country's check-in + half the month's headway, either direction", () => {
    const ix = indexDriveData({ ...base, crossings: [ferry] });
    expect(modelDrive(a, b, { month: 7 }, ix)).toMatchObject({ minutes: plain + 40 + 30 + 30, flags: ["ferry"] });
    expect(modelDrive(b, a, { month: 3 }, ix).minutes).toBe(plain + 40 + 30);
  });

  it("closed in season: the way round in the closed months, a chip when the month is unknown, nothing otherwise", () => {
    const ix = indexDriveData({ ...base, crossings: [closed] });
    expect(modelDrive(a, b, { month: 1 }, ix)).toMatchObject({ flags: ["closed-season", "winter"] });
    expect(modelDrive(a, b, { month: 12 }, ix)).toMatchObject({ minutes: plain + 90, flags: ["closed-season"] });
    expect(modelDrive(a, b, {}, ix)).toMatchObject({ minutes: plain, flags: ["closed-season"] });
    expect(modelDrive(a, b, { month: 7 }, ix)).toMatchObject({ minutes: plain, flags: [] });
    expect(modelDrive(b, a, { month: 12 }, ix).flags).toEqual([]); // one-way row
  });

  it("border: the destination's minutes for the origin, a chip even when no row names the pair", () => {
    const ix = indexDriveData(base);
    const x: ModelPoint = { lat: 60.3, lon: 10.4, cc: "XB" };
    const there = modelDrive(x, a, {}, ix);
    const back = modelDrive(a, x, {}, ix);
    expect(there.flags).toEqual(["border"]);
    expect(back.flags).toEqual(["border"]);
    expect(there.minutes! - back.minutes!).toBe(0); // XA's row names XB: 25 min both ways (destination first, then origin)
    expect(there.minutes!).toBeGreaterThan(modelDrive({ ...x, cc: "XA" }, a, {}, ix).minutes! + 20);
  });

  it("winter: the country's months and factor, an area's lower factor wins", () => {
    const ix = indexDriveData(base);
    const w = explainDrive(a, b, { month: 1 }, ix);
    expect(w.estimate.flags).toEqual(["winter"]);
    const drive = w.explanation.baseMinutes - DRIVE_MODEL.parkMin;
    expect(w.estimate.minutes).toBe(Math.round(drive / 0.7 + DRIVE_MODEL.parkMin));
    expect(modelDrive(a, b, { month: 6 }, ix).flags).toEqual([]);
  });

  it("city entry: +8 per end in a town of a million, +4 from 250,000; never below", () => {
    const ix = indexDriveData(base);
    expect(modelDrive({ ...a, population: 2_000_000 }, { ...b, population: 300_000 }, {}, ix).minutes).toBe(plain + 12);
    expect(modelDrive({ ...a, population: 249_999 }, b, {}, ix).minutes).toBe(plain);
  });

  it("unpaved share: speed capped on that share, chip raised", () => {
    const ix = indexDriveData({ ...base, areas: base.areas.map((r) => ({ ...r, unpavedShare: 0.5 })) });
    const e = modelDrive(a, b, {}, ix);
    expect(e.flags).toEqual(["unpaved"]);
    expect(e.minutes!).toBeGreaterThan(plain);
  });

  it("segments: closed answers none, 4x4 only for a 4x4, slow multiplies, fixed is authored", () => {
    const run = (s: SegmentRow, opts = {}) => modelDrive(a, bKeyed, opts, indexDriveData({ ...base, segments: [s] }));
    expect(run(seg({ rule: "closed" }))).toEqual({ minutes: null, km: null, range: null, confidence: "none", source: "segment", flags: ["no-road"], attribution: null });
    expect(run(seg({ rule: "closed", months: [11, 12] }), { month: 12 }).flags).toEqual(["closed-season"]);
    expect(run(seg({ rule: "closed", months: [11, 12] }), { month: 7 }).minutes).toBe(plain);
    expect(run(seg({ rule: "4x4" })).confidence).toBe("none");
    expect(run(seg({ rule: "4x4" }), { vehicle: "4x4" })).toMatchObject({ confidence: "modelled", flags: ["4x4"] });
    expect(run(seg({ rule: "slow", factor: 2 })).minutes!).toBeGreaterThan(plain * 1.8);
    expect(run(seg({ rule: "fixed", minutes: 33 }))).toMatchObject({ minutes: 33, confidence: "authored", source: "segment", range: null });
    // a point without the key is not served by the segment
    expect(modelDrive(a, b, {}, indexDriveData({ ...base, segments: [seg({ rule: "closed" })] })).minutes).toBe(plain);
  });
});
