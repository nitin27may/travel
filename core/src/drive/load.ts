// Reads data/reference/drive/** (Node only; the model itself is pure and takes the parsed data). Every file is parsed with its schema
// (schema.ts) and the cross-file rules (check.ts); a problem is a line of text, never a throw, so `--check` can list them all.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { driveDataProblems } from "./check.ts";
import type { DriveData } from "./model.ts";
import {
  areasFile, calibrationFile, crossingsFile, goldenFile, profileFile, segmentsFile,
  type CalibrationFile, type GoldenFile,
} from "./schema.ts";
import { GOLDEN_PATH } from "./calibrate.ts";
import type { z } from "zod";

export const DRIVE_DIR = "data/reference/drive";
export const DRIVE_FILES = {
  countries: `${DRIVE_DIR}/countries.json`,
  areas: `${DRIVE_DIR}/areas.json`,
  crossings: `${DRIVE_DIR}/crossings.json`,
  segments: `${DRIVE_DIR}/segments.json`,
  calibration: `${DRIVE_DIR}/generated/calibration.json`,
} as const;

function readParsed<T>(root: string, rel: string, schema: z.ZodType<T>, problems: string[]): T | null {
  const file = join(root, rel);
  if (!existsSync(file)) {
    problems.push(`${rel} is missing`);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${rel} is not JSON (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const i of r.error.issues.slice(0, 10)) problems.push(`${rel}: ${i.path.join(".") || "(root)"}: ${i.message}`);
    return null;
  }
  return r.data;
}

/** The area ids of the locations store (the registry), including its per-country parts. */
export function registryAreaIds(root: string): Set<string> {
  const dir = join(root, "data", "locations");
  const read = (f: string): Record<string, unknown> | null => (existsSync(join(dir, f)) ? (JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>) : null);
  const store = read("locations.json") ?? {};
  const lists: unknown[] = [store.areas];
  if (store.layout === "by-country" && Array.isArray(store.parts)) for (const cc of store.parts as string[]) lists.push(read(`${cc}.json`)?.areas);
  const ids = new Set<string>();
  for (const l of lists) if (Array.isArray(l)) for (const a of l) if (a && typeof (a as { id?: unknown }).id === "string") ids.add((a as { id: string }).id);
  return ids;
}

export interface LoadedDrive {
  data: DriveData;
  calibration: CalibrationFile | null;
  problems: string[];
}

/** The authored files (and the calibration when present), parsed and checked. `data.calibration` is the generated file. */
export function loadDriveData(root: string, opts: { calibration?: boolean } = {}): LoadedDrive {
  const problems: string[] = [];
  const countries = readParsed(root, DRIVE_FILES.countries, profileFile, problems);
  const areas = readParsed(root, DRIVE_FILES.areas, areasFile, problems);
  const crossings = readParsed(root, DRIVE_FILES.crossings, crossingsFile, problems);
  const segments = readParsed(root, DRIVE_FILES.segments, segmentsFile, problems);
  const calibration = opts.calibration === false || !existsSync(join(root, DRIVE_FILES.calibration)) ? null : readParsed(root, DRIVE_FILES.calibration, calibrationFile, problems);
  const data: DriveData = {
    profiles: countries?.rows ?? [],
    areas: areas?.rows ?? [],
    crossings: crossings?.rows ?? [],
    segments: segments?.rows ?? [],
    calibration,
  };
  if (problems.length === 0) problems.push(...driveDataProblems(data, registryAreaIds(root)));
  return { data, calibration, problems };
}

/** The golden fixture, parsed; null with a problem line when it is missing or malformed. */
export function loadGolden(root: string, problems: string[]): GoldenFile | null {
  return readParsed(root, GOLDEN_PATH, goldenFile, problems);
}
