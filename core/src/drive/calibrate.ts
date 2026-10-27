// Calibration and the golden report (driving-time-model.md 4.5 and 6.3; DT-1a, measured offline). Pure: pairs and data in, the
// calibration document and the error tables out. Deterministic: no clock, sorted cells, fixed decimals, so `--check` can compare bytes.
//
// For each cell (country, terrain, straight-line band): routed km / prior road km and routed speed / prior speed, their medians, and
// a factor shrunk toward 1.0 with weight n / (n + DRIVE_CALIBRATION.shrinkPairs). The range of a cell is p10 and p90 of routed /
// calibrated minutes, shrunk toward the prior range by the same weight.
import { DRIVE_CALIBRATION, DRIVE_MODEL } from "../config/drive.ts";
import { DRIVE_PADDING_MIN, FAST_KMH, ROAD_EXTRA_KM, ROAD_FACTOR, SHORT_DRIVE_KM, SLOW_KMH } from "../config/nearby.ts";
import { cellKey, explainDrive, indexDriveData, type DriveData, type DriveIndex } from "./model.ts";
import type { CalibrationCell, CalibrationFile, ErrorStats, GoldenPair } from "./schema.ts";
import { DRIVE_SCHEMA_IDS } from "./schema.ts";
import type { DriveTerrain, ModelPoint } from "./types.ts";

const round = (x: number, d: number = DRIVE_CALIBRATION.decimals): number => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return Number.NaN;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** Nearest-rank quantile (the reading of spec 2.2). */
export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? Number.NaN : s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/** Today's straight-line rule (core/src/schedule/legs.ts `estimateLeg`) without its 5-minute rounding: the spec 2.2 baseline. */
export function naiveMinutes(straightKm: number): number {
  const short = straightKm <= SHORT_DRIVE_KM;
  const road = straightKm * ROAD_FACTOR + (short ? ROAD_EXTRA_KM : 0);
  return (road / (short ? SLOW_KMH : FAST_KMH)) * 60 + DRIVE_PADDING_MIN;
}

export const endPoint = (e: GoldenPair["a"]): ModelPoint => ({ lat: e.lat, lon: e.lon, cc: e.cc, sub: e.sub, area: e.area });

/** The slice names of a pair: "all" and its country (when both ends share one). */
export function slicesOf(p: GoldenPair): string[] {
  return p.a.cc && p.a.cc === p.b.cc ? ["all", p.a.cc] : ["all"];
}

export function errorStats(pairs: readonly { routed: number; predicted: number }[]): ErrorStats {
  const errs = pairs.map((p) => Math.abs(p.predicted - p.routed) / p.routed);
  const bias = pairs.map((p) => p.predicted / p.routed - 1);
  const n = pairs.length;
  if (n === 0) return { n: 0, meanError: 0, medianBias: 0, p90Error: 0, within20: 0 };
  return {
    n,
    meanError: round(errs.reduce((a, b) => a + b, 0) / n),
    medianBias: round(median(bias)),
    p90Error: round(quantile(errs, 0.9)),
    within20: round(errs.filter((e) => e <= 0.2).length / n),
  };
}

/** Error tables by slice for one predictor. */
export function statsBySlice(pairs: readonly GoldenPair[], predict: (p: GoldenPair, i: number) => number | null): Record<string, ErrorStats> {
  const by = new Map<string, { routed: number; predicted: number }[]>();
  pairs.forEach((p, i) => {
    const v = predict(p, i);
    if (v === null) return;
    for (const s of slicesOf(p)) {
      if (!by.has(s)) by.set(s, []);
      by.get(s)!.push({ routed: p.minutes, predicted: v });
    }
  });
  return Object.fromEntries([...by.keys()].sort().map((k) => [k, errorStats(by.get(k)!)]));
}

interface CellObs { cc: string; terrain: DriveTerrain; band: string; detour: number; speed: number; pair: number }

/** What the prior says of each pair, and the cell it falls in (null: mixed countries or no profile, never calibrated). */
function observe(pairs: readonly GoldenPair[], prior: DriveIndex): (CellObs | null)[] {
  return pairs.map((p, i) => {
    const { estimate, explanation: x } = explainDrive(endPoint(p.a), endPoint(p.b), {}, prior);
    if (estimate.confidence !== "modelled" || !p.a.cc || p.a.cc !== p.b.cc) return null;
    const driveMin = Math.max(1, p.minutes - DRIVE_MODEL.parkMin);
    const priorSpeed = x.ruralKmh * x.realisation;
    return { cc: p.a.cc, terrain: x.terrain, band: x.band, detour: p.km / x.roadKm, speed: p.km / driveMin * 60 / priorSpeed, pair: i };
  });
}

/** Fit the cells on a subset of pairs (by index). */
function fitCells(pairs: readonly GoldenPair[], obs: readonly (CellObs | null)[], use: (i: number) => boolean, data: DriveData): CalibrationCell[] {
  const groups = new Map<string, CellObs[]>();
  for (const o of obs) {
    if (!o || !use(o.pair)) continue;
    const k = cellKey(o.cc, o.terrain, o.band);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }
  const shrink = DRIVE_CALIBRATION.shrinkPairs;
  const cells: CalibrationCell[] = [...groups.keys()].sort().map((k) => {
    const g = groups.get(k)!;
    const w = g.length / (g.length + shrink);
    const md = median(g.map((o) => o.detour));
    const ms = median(g.map((o) => o.speed));
    return {
      cell: k, cc: g[0]!.cc, terrain: g[0]!.terrain, band: g[0]!.band, n: g.length,
      detour: { median: round(md), factor: round(1 + w * (md - 1)) },
      speed: { median: round(ms), factor: round(1 + w * (ms - 1)) },
      range: [DRIVE_MODEL.priorRange[0], DRIVE_MODEL.priorRange[1]],
    };
  });
  // the residual spread of each cell under its own factors, shrunk toward the prior range
  const idx = indexDriveData({ ...data, calibration: { cells } });
  for (const c of cells) {
    const g = groups.get(c.cell)!;
    const ratios = g.map((o) => {
      const p = pairs[o.pair]!;
      const m = explainDrive(endPoint(p.a), endPoint(p.b), {}, idx).estimate.minutes ?? p.minutes;
      return p.minutes / m;
    });
    const w = c.n / (c.n + shrink);
    const [p10, p90] = DRIVE_MODEL.priorRange;
    c.range = [round(w * Math.min(1, quantile(ratios, 0.1)) + (1 - w) * p10), round(w * Math.max(1, quantile(ratios, 0.9)) + (1 - w) * p90)];
  }
  return cells;
}

export const GOLDEN_PATH = "core/test/fixtures/drive/golden-legs.json";

export interface CalibrationRun {
  doc: CalibrationFile;
  /** the calibrated estimate of every pair (null when the model answers none) */
  predicted: (number | null)[];
  /** the calibration cell each pair falls in (null: not calibrated) */
  cellOf: (string | null)[];
}

/** The calibration document for the golden pairs. `sha256` is the golden file's hash (the CLI computes it). */
export function calibrate(pairs: readonly GoldenPair[], data: DriveData, sha256: string): CalibrationRun {
  const prior = indexDriveData({ ...data, calibration: null });
  const obs = observe(pairs, prior);
  const cells = fitCells(pairs, obs, () => true, data);
  const idx = indexDriveData({ ...data, calibration: { cells } });
  const calibrated = pairs.map((p) => explainDrive(endPoint(p.a), endPoint(p.b), {}, idx));
  const predicted = calibrated.map((c) => c.estimate.minutes);
  const cellOf = calibrated.map((c) => c.explanation.calibrationCell);
  const loo = pairs.map((p, i) => {
    const own = indexDriveData({ ...data, calibration: { cells: fitCells(pairs, obs, (j) => j !== i, data) } });
    return explainDrive(endPoint(p.a), endPoint(p.b), {}, own).estimate.minutes;
  });
  const priorMin = pairs.map((p) => explainDrive(endPoint(p.a), endPoint(p.b), {}, prior).estimate.minutes);
  const bands = new Map<string, { routed: number; predicted: number }[]>();
  pairs.forEach((p, i) => {
    const v = predicted[i];
    if (v == null) return;
    const b = calibrated[i]!.explanation.band;
    if (!bands.has(b)) bands.set(b, []);
    bands.get(b)!.push({ routed: p.minutes, predicted: v });
  });
  const doc: CalibrationFile = {
    schema: DRIVE_SCHEMA_IDS.calibration,
    generated: `Generated by node core/bin/drive-calibrate.ts --write from ${GOLDEN_PATH} and data/reference/drive/*.json. Do not edit.`,
    inputs: { golden: GOLDEN_PATH, sha256, pairs: pairs.length },
    shrinkPairs: DRIVE_CALIBRATION.shrinkPairs,
    cells,
    summary: {
      naive: statsBySlice(pairs, (p) => naiveMinutes(p.straightKm)),
      prior: statsBySlice(pairs, (_p, i) => priorMin[i] ?? null),
      calibrated: statsBySlice(pairs, (_p, i) => predicted[i] ?? null),
      leaveOneOut: statsBySlice(pairs, (_p, i) => loo[i] ?? null),
      bands: Object.fromEntries([...bands.keys()].sort().map((k) => [k, errorStats(bands.get(k)!)])),
    },
  };
  return { doc, predicted, cellOf };
}

/** The rules a calibration must meet (spec 4.5 step 4 and 6.3). Empty when it passes. */
export function calibrationProblems(run: CalibrationRun, pairs: readonly GoldenPair[], previous: CalibrationFile | null = null): string[] {
  const out: string[] = [];
  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
  const cal = run.doc.summary.calibrated;
  const all = cal.all;
  if (all && all.meanError > DRIVE_CALIBRATION.goldenLimit) out.push(`golden mean error ${pct(all.meanError)} is over ${pct(DRIVE_CALIBRATION.goldenLimit)}`);
  for (const [cc, limit] of Object.entries(DRIVE_CALIBRATION.goldenLimitByCountry)) {
    const s = cal[cc];
    if (s && s.meanError > limit) out.push(`golden mean error for ${cc} ${pct(s.meanError)} is over ${pct(limit)}`);
  }
  for (const [band, s] of Object.entries(run.doc.summary.bands)) {
    if (s.n >= DRIVE_CALIBRATION.bandCheckPairs && Math.abs(s.medianBias) > DRIVE_CALIBRATION.cellBiasLimit) {
      out.push(`band ${band} (n ${s.n}) has a median bias of ${pct(s.medianBias)}, beyond ${pct(DRIVE_CALIBRATION.cellBiasLimit)}`);
    }
  }
  // a cell with many pairs that the shrunk factor still cannot centre: the profile is wrong, not the calibration
  const byCell = new Map<string, number[]>();
  pairs.forEach((p, i) => {
    const v = run.predicted[i];
    const cell = run.cellOf[i];
    if (v == null || !cell) return;
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell)!.push(v / p.minutes - 1);
  });
  for (const [cell, biases] of [...byCell.entries()].sort()) {
    if (biases.length >= DRIVE_CALIBRATION.cellCheckPairs && Math.abs(median(biases)) > DRIVE_CALIBRATION.cellBiasLimit) {
      out.push(`cell ${cell} (n ${biases.length}) still shows a median bias of ${pct(median(biases))}: fix the profile, not the calibration`);
    }
  }
  const before = previous?.summary.calibrated.all?.meanError;
  if (before !== undefined && all && all.meanError > before + DRIVE_CALIBRATION.regressionLimit) {
    out.push(`golden mean error worsened from ${pct(before)} to ${pct(all.meanError)} (more than ${pct(DRIVE_CALIBRATION.regressionLimit)})`);
  }
  return out;
}
