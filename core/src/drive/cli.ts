// `drive-calibrate.ts` (DT-1a; driving-time-model.md 4.5): measure the drive model against our routed legs, offline.
//
//   drive-calibrate.ts [--check | --write] [--json]   validate data/reference/drive/*.json, calibrate on the golden set, compare with
//                                                     (or write) data/reference/drive/generated/calibration.json; print the report
//   drive-calibrate.ts pairs [--check | --write]      rebuild core/test/fixtures/drive/golden-legs.json from the stored ORS legs and runs
//
// --check exits 1 on a data problem, a stale golden set, a calibration file that differs from what this run computes, or a threshold
// of spec 6.3 that fails. --write refuses a calibration whose golden mean error worsens by more than 3 points. No network.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { calibrate, calibrationProblems, GOLDEN_PATH } from "./calibrate.ts";
import { buildGolden, collectRawPairs, goldenDrift } from "./golden.ts";
import { DRIVE_FILES, loadDriveData, loadGolden } from "./load.ts";
import type { ErrorStats } from "./schema.ts";

const text = (doc: unknown): string => `${JSON.stringify(doc, null, 2)}\n`;
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const line = (name: string, s: ErrorStats | undefined): string =>
  s ? `  ${name.padEnd(14)} n ${String(s.n).padStart(3)}  mean ${pct(s.meanError).padStart(6)}  bias ${pct(s.medianBias).padStart(6)}  p90 ${pct(s.p90Error).padStart(6)}  within 20% ${pct(s.within20).padStart(6)}` : `  ${name}: no pairs`;

function pairsCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const doc = buildGolden(root);
  const next = text(doc);
  const file = join(root, GOLDEN_PATH);
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  out(`golden set: ${doc.pairs.length} pairs from ${doc.sources.map((s) => `${s.file} (${s.pairs})`).join(", ")}`);
  if (argv.includes("--write")) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, next);
    out(`wrote ${GOLDEN_PATH}`);
    return 0;
  }
  if (argv.includes("--check") && current !== next) {
    err(`${GOLDEN_PATH} is stale: run node core/bin/drive-calibrate.ts pairs --write, then --write`);
    return 1;
  }
  return 0;
}

export function driveCalibrateCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  if (argv[0] === "pairs") return pairsCommand(argv.slice(1), root, out, err);
  const problems: string[] = [];
  const { data, calibration: previous, problems: dataProblems } = loadDriveData(root);
  problems.push(...dataProblems);
  const golden = loadGolden(root, problems);
  if (golden) {
    const drift = goldenDrift(golden, collectRawPairs(root).pairs);
    if (drift.length > 0) problems.push(`${GOLDEN_PATH} no longer matches the stored legs and runs (pairs --write):`, ...drift.map((d) => `  ${d}`));
  }
  if (problems.length > 0 || !golden) {
    for (const p of problems) err(`PROBLEM ${p}`);
    return 1;
  }
  const goldenText = readFileSync(join(root, GOLDEN_PATH), "utf8");
  const run = calibrate(golden.pairs, { ...data, calibration: null }, sha(goldenText));
  const next = text(run.doc);
  const fails = calibrationProblems(run, golden.pairs, argv.includes("--write") ? previous : null);

  if (argv.includes("--json")) out(next);
  else {
    const s = run.doc.summary;
    out(`drive model on the golden set (${golden.pairs.length} routed ORS pairs; mean absolute error of minutes):`);
    for (const slice of Object.keys(s.naive)) {
      out(`${slice}:`);
      out(line("naive (today)", s.naive[slice]));
      out(line("prior (L2)", s.prior[slice]));
      out(line("calibrated", s.calibrated[slice]));
      out(line("leave-one-out", s.leaveOneOut[slice]));
    }
    out("calibrated, by straight-line band:");
    for (const [b, st] of Object.entries(s.bands)) out(line(b, st));
    out(`${run.doc.cells.length} cells: ${run.doc.cells.map((c) => `${c.cell} n ${c.n}`).join("; ")}`);
  }
  for (const f of fails) err(`FAIL ${f}`);

  const file = join(root, DRIVE_FILES.calibration);
  if (argv.includes("--write")) {
    if (fails.length > 0) {
      err("not written: fix the failures above");
      return 1;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, next);
    out(`wrote ${DRIVE_FILES.calibration}`);
    return 0;
  }
  if (argv.includes("--check")) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== next) {
      err(`${DRIVE_FILES.calibration} is ${current === null ? "missing" : "stale"}: run node core/bin/drive-calibrate.ts --write`);
      return 1;
    }
    if (fails.length > 0) return 1;
    out("drive data and calibration OK");
  }
  return fails.length > 0 && argv.includes("--check") ? 1 : 0;
}
