// Calibration and the golden set (driving-time-model.md 4.5, 6.3): the thresholds, idempotence, shrinkage, near-mode recall, and the
// committed generated files matching what the code computes from the stored legs (offline).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRIVE_CALIBRATION, DRIVE_MODEL } from "../../src/config/drive.ts";
import { calibrate, calibrationProblems, endPoint, errorStats, GOLDEN_PATH, median, naiveMinutes, quantile } from "../../src/drive/calibrate.ts";
import { keepWithin } from "../../src/drive/display.ts";
import { collectRawPairs, goldenDrift } from "../../src/drive/golden.ts";
import { DRIVE_FILES, loadDriveData, loadGolden } from "../../src/drive/load.ts";
import { indexDriveData, modelDrive } from "../../src/drive/model.ts";
import { dedupePairs, legsFilePairs, runFilePairs } from "../../src/drive/pairs.ts";
import type { GoldenPair } from "../../src/drive/schema.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const { data } = loadDriveData(REPO);
const golden = loadGolden(REPO, [])!;
const goldenText = readFileSync(join(REPO, GOLDEN_PATH), "utf8");
const sha = createHash("sha256").update(goldenText).digest("hex");
const run = calibrate(golden.pairs, { ...data, calibration: null }, sha);
const s = run.doc.summary;

describe("the golden set", () => {
  it("is pinned: count, sources and hash (a new batch of routed legs updates all three on purpose)", () => {
    expect(golden.pairs.length).toBe(186);
    expect(golden.sources.map((x) => x.pairs)).toEqual([19, 33, 134]);
    expect(run.doc.inputs).toEqual({ golden: GOLDEN_PATH, sha256: sha, pairs: 186 });
    const committed = JSON.parse(readFileSync(join(REPO, DRIVE_FILES.calibration), "utf8"));
    expect(committed.inputs.sha256).toBe(sha);
  });

  it("matches the stored legs and research runs today (no drift)", () => {
    expect(goldenDrift(golden, collectRawPairs(REPO).pairs)).toEqual([]);
  });

  it("holds only open-engine values: ORS driving-car, with its attribution; no Google anywhere", () => {
    expect(golden.engine).toBe("ors");
    expect(golden.attribution).toMatch(/OpenRouteService/);
    expect(goldenText).not.toMatch(/google/i);
  });

  it("has two countries, with country and subdivision on every end", () => {
    for (const p of golden.pairs) for (const e of [p.a, p.b]) expect(e.cc).toMatch(/^(CA|IT)$/);
    expect(golden.pairs.every((p) => p.straightKm >= DRIVE_CALIBRATION.minStraight)).toBe(true);
  });
});

describe("thresholds (spec 6.3) on the golden set", () => {
  it("reproduces the measured naive error (about 30%)", () => {
    expect(s.naive.all!.meanError).toBeGreaterThan(0.27);
    expect(s.naive.all!.meanError).toBeLessThan(0.32);
  });

  it("calibrated: at most 22% overall, 20% in Canada, 33% in Italy; and better than naive", () => {
    expect(s.calibrated.all!.meanError).toBeLessThanOrEqual(0.22);
    expect(s.calibrated.CA!.meanError).toBeLessThanOrEqual(0.2);
    expect(s.calibrated.IT!.meanError).toBeLessThanOrEqual(0.33);
    expect(s.calibrated.all!.meanError).toBeLessThan(s.naive.all!.meanError - 0.08);
    // honest out of sample too
    expect(s.leaveOneOut.all!.meanError).toBeLessThanOrEqual(0.22);
  });

  it("no band with 20 or more pairs shows a median bias beyond 15%", () => {
    for (const [band, st] of Object.entries(s.bands)) if (st.n >= 20) expect(Math.abs(st.medianBias), band).toBeLessThanOrEqual(0.15);
  });

  it("raises no calibration problem", () => {
    expect(calibrationProblems(run, golden.pairs)).toEqual([]);
  });

  it("fails a worsening of more than 3 points against the committed file", () => {
    const worse = structuredClone(run.doc);
    worse.summary.calibrated.all!.meanError -= 0.05;
    expect(calibrationProblems(run, golden.pairs, worse).join("\n")).toMatch(/worsened/);
  });
});

describe("calibration mechanics", () => {
  it("is idempotent and byte-stable, and the committed file equals this run", () => {
    const again = calibrate(golden.pairs, { ...data, calibration: null }, sha);
    expect(JSON.stringify(again.doc)).toBe(JSON.stringify(run.doc));
    expect(readFileSync(join(REPO, DRIVE_FILES.calibration), "utf8")).toBe(`${JSON.stringify(run.doc, null, 2)}\n`);
  });

  it("a cell with 5 pairs moves the model by at most 20% of its bias (shrink n / (n + 20))", () => {
    const base = golden.pairs.find((p) => p.id === "run:m:banff>lake-louise")!;
    const prior = indexDriveData({ ...data, calibration: null });
    const priorMin = modelDrive(endPoint(base.a), endPoint(base.b), {}, prior).minutes!;
    // five copies routed twice as slow and twice as long: bias 100%
    const fake: GoldenPair[] = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `fake-${i}`, km: base.km * 2, minutes: base.minutes * 2 }));
    const r = calibrate(fake, { ...data, calibration: null }, sha);
    expect(r.doc.cells).toHaveLength(1);
    const cell = r.doc.cells[0]!;
    expect(cell.n).toBe(5);
    const w = 5 / (5 + DRIVE_CALIBRATION.shrinkPairs);
    expect(Math.abs(cell.detour.factor - 1)).toBeLessThanOrEqual(w * Math.abs(cell.detour.median - 1) + 1e-3);
    const calMin = modelDrive(endPoint(base.a), endPoint(base.b), {}, indexDriveData({ ...data, calibration: r.doc })).minutes!;
    const bias = base.minutes * 2 / priorMin - 1;
    expect(Math.abs(calMin / priorMin - 1)).toBeLessThanOrEqual(0.2 * bias + 0.02);
  });

  it("an uncalibrated cell keeps the prior range; a calibrated one stays near it", () => {
    for (const c of run.doc.cells) {
      expect(c.range[0]).toBeLessThanOrEqual(1);
      expect(c.range[1]).toBeGreaterThanOrEqual(1);
      if (c.n <= 2) {
        expect(c.range[0]).toBeCloseTo(DRIVE_MODEL.priorRange[0], 1);
      }
    }
  });

  it("statistics helpers: median, nearest-rank quantile, error stats", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10);
    expect(errorStats([{ routed: 100, predicted: 110 }, { routed: 100, predicted: 70 }])).toEqual({ n: 2, meanError: 0.2, medianBias: -0.1, p90Error: 0.3, within20: 0.5 });
    expect(errorStats([]).n).toBe(0);
  });

  it("naive is today's estimateLeg arithmetic without the 5-minute rounding", () => {
    expect(naiveMinutes(50)).toBeCloseTo(((50 * 1.42 + 1.5) / 46) * 60 + 3, 6);
    expect(naiveMinutes(100)).toBeCloseTo(((100 * 1.42) / 72) * 60 + 3, 6);
  });
});

describe("near-mode recall (spec 4.2): the keep factor never drops a golden pair that is really inside", () => {
  const idx = indexDriveData(data);
  for (const limit of [60, 120, 180, 240]) {
    it(`within ${limit} min`, () => {
      const inside = golden.pairs.filter((p) => p.minutes <= limit);
      expect(inside.length).toBeGreaterThan(0);
      for (const p of inside) expect(keepWithin(modelDrive(endPoint(p.a), endPoint(p.b), {}, idx), limit), p.id).toBe(true);
    });
  }
});

describe("pair extraction", () => {
  const leg = (from: string, to: string, geometry: string, km = 10, minutes = 12, profile = "driving-car") => ({ from, to, profile, mode: profile === "driving-car" ? "drive" : "walk", km, minutes, geometry });
  const doc = (legs: unknown[]) => ({ schema: "trip-legs/2", trip: "sample-trip", fetched: "2026-10-25", attribution: "ORS", legs });

  it("takes the polyline ends of drive legs only, and refuses a malformed file", () => {
    // `_p~iF~ps|U_ulLnnqC` is (38.5, -120.2) to (40.7, -120.95)
    const out = legsFilePairs("f.json", doc([leg("a", "b", "_p~iF~ps|U_ulLnnqC"), leg("c", "d", "_p~iF~ps|U_ulLnnqC", 1, 5, "foot-hiking")]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "sample-trip:a>b", a: { lat: 38.5, lon: -120.2 }, b: { lat: 40.7, lon: -120.95 } });
    expect(() => legsFilePairs("f.json", { schema: "nope" })).toThrow(/not a trip-legs file/);
  });

  it("reads a run's matrix (skipping unrouted cells) and base pairs", () => {
    const out = runFilePairs("r.json", {
      points: { x: [50, -115], y: [50.5, -115] },
      base_pairs: [{ from: "x", to: "y", km: 70, minutes: 50 }],
      matrix: { names: ["x", "y"], points: [[50, -115], [50.5, -115]], durations_min: [[0, 50], [null, 0]], distances_km: [[0, 70], [null, 0]] },
    });
    expect(out.map((p) => p.id)).toEqual(["run:m:x>y", "run:b:x>y"]);
  });

  it("drops walks and counts a pair once in either direction", () => {
    const p = (id: string, a: number, b: number, km = 10) => ({ id, source: "s", a: { lat: a, lon: 0 }, b: { lat: b, lon: 0 }, straightKm: km, km, minutes: 10 });
    expect(dedupePairs([p("1", 0, 1), p("2", 1, 0), p("3", 0, 1), p("4", 5, 5.001, 0.1)]).map((x) => x.id)).toEqual(["1"]);
  });
});
