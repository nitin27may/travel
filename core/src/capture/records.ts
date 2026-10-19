// The world of capture records: the capture, suitability and relevance sidecars joined by ref, the points file, the operators,
// the relation graph (with the derived inverses) and the aliases. Offline; reads only files under `root`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CaptureDoc, CaptureOperator, CaptureRecord, OperatorsFile } from "../schema/capture/records.ts";
import type { RelevanceDoc, RelevanceRecord } from "../schema/relevance.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../schema/suitability.ts";
import type { PointsFile } from "../relevance/inputs.ts";
import type { SupersedeEntry } from "../schema/capture/records.ts";
import { applySupersedes, loadSupersedes } from "./supersede.ts";

export const CAPTURE_DIR = "data/capture";
/** Folders of data/capture that hold something other than a trip's capture sidecars. */
export const CAPTURE_NON_TRIP_DIRS = ["splits", "runs"];
export const OPERATORS_PATH = `${CAPTURE_DIR}/operators.json`;
export const TYPE_MAP_PATH = `${CAPTURE_DIR}/type-map.json`;

export interface Located<R> { rec: R; trip: string; file: string }

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Every data/<kind>/<trip>/<lane>.json of a sidecar family, sorted. */
export function sidecarFiles(root: string, kind: "capture" | "suitability" | "relevance"): string[] {
  const base = join(root, "data", kind);
  if (!existsSync(base)) return [];
  const skip = kind === "capture" ? CAPTURE_NON_TRIP_DIRS : kind === "relevance" ? ["signals", "derived", "inputs"] : [];
  const out: string[] = [];
  for (const trip of readdirSync(base).sort()) {
    const dir = join(base, trip);
    if (skip.includes(trip) || !statSync(dir).isDirectory()) continue;
    for (const n of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) out.push(join(dir, n));
  }
  return out;
}

export function captureFiles(root: string, onlyTrip?: string | null): string[] {
  return sidecarFiles(root, "capture").filter((f) => !onlyTrip || f.includes(`/capture/${onlyTrip}/`));
}

export interface Incoming {
  /** offers whose `at` names this record */
  at: string[];
  /** offers whose `on` names this record */
  on: string[];
  parks_for: string[];
  serves: string[];
  /** records that are `part_of` this one */
  children: string[];
  /** routes that `reach` this record: the derived inverse, never stored */
  reached_by: string[];
  /** routes and offers that start here */
  starts_here: string[];
}

export interface World {
  root: string;
  cap: Map<string, Located<CaptureRecord>>;
  suit: Map<string, Located<SuitabilityRecord>>;
  rel: Map<string, Located<RelevanceRecord>>;
  points: Record<string, unknown>;
  operators: Map<string, CaptureOperator>;
  /** old ref -> the primary ref that took its place */
  alias: Map<string, string>;
  incoming: Map<string, Incoming>;
  /** trip -> primary refs of its capture records */
  trips: Map<string, string[]>;
  /** the supersede entries (9.7) that were applied to this world, by layer|ref|path */
  supersedes?: Map<string, SupersedeEntry>;
}

const emptyIncoming = (): Incoming => ({ at: [], on: [], parks_for: [], serves: [], children: [], reached_by: [], starts_here: [] });

/** `exclude` leaves one capture file out, so the validator can compare it with the others. `opts.supersede: false` gives the raw lane values. */
export function loadWorld(root: string, exclude?: string, extra: CaptureDoc[] = [], opts: { supersede?: boolean } = {}): World {
  const cap = new Map<string, Located<CaptureRecord>>();
  const trips = new Map<string, string[]>();
  for (const f of sidecarFiles(root, "capture")) {
    if (exclude && resolve(f) === resolve(exclude)) continue;
    const doc = readJson<CaptureDoc>(f);
    if (!doc || !Array.isArray(doc.records)) continue;
    for (const rec of doc.records) {
      if (!cap.has(rec.ref)) cap.set(rec.ref, { rec, trip: doc.trip, file: f });
      trips.set(doc.trip, [...(trips.get(doc.trip) ?? []), rec.ref]);
    }
  }
  // documents not (or not yet) on disk, such as the one being validated
  for (const doc of extra) {
    for (const rec of doc.records) {
      cap.set(rec.ref, { rec, trip: doc.trip, file: exclude ?? "" });
      trips.set(doc.trip, [...(trips.get(doc.trip) ?? []), rec.ref]);
    }
  }
  const suit = new Map<string, Located<SuitabilityRecord>>();
  for (const f of sidecarFiles(root, "suitability")) {
    const doc = readJson<SuitabilityDoc>(f);
    if (!doc || !Array.isArray(doc.records)) continue;
    const migrated = /(^|\/)migrated[^/]*\.json$/.test(f);
    for (const rec of doc.records) {
      // a lane file supersedes the migrated file for the same ref (suitability refs.ts)
      const had = suit.get(rec.ref);
      if (!had || (/(^|\/)migrated[^/]*\.json$/.test(had.file) && !migrated)) suit.set(rec.ref, { rec, trip: doc.trip, file: f });
    }
  }
  const rel = new Map<string, Located<RelevanceRecord>>();
  for (const f of sidecarFiles(root, "relevance")) {
    const doc = readJson<RelevanceDoc>(f);
    if (!doc || !Array.isArray(doc.records)) continue;
    for (const rec of doc.records) if (!rel.has(rec.ref)) rel.set(rec.ref, { rec, trip: doc.trip, file: f });
  }
  const pts = readJson<PointsFile>(join(root, "data", "relevance", "inputs", "points.json"));
  const ops = readJson<OperatorsFile>(join(root, OPERATORS_PATH));
  const operators = new Map((ops?.operators ?? []).map((o) => [o.ref, o]));
  const alias = new Map<string, string>();
  for (const { rec } of cap.values()) for (const a of rec.aliases ?? []) alias.set(a, rec.ref);

  const incoming = new Map<string, Incoming>();
  const get = (ref: string): Incoming => {
    let x = incoming.get(ref);
    if (!x) {
      x = emptyIncoming();
      incoming.set(ref, x);
    }
    return x;
  };
  const primary = (ref: string): string => alias.get(ref) ?? ref;
  for (const { rec } of cap.values()) {
    for (const t of rec.at ?? []) get(primary(t)).at.push(rec.ref);
    for (const t of rec.on ?? []) get(primary(t.ref)).on.push(rec.ref);
    for (const t of rec.parks_for ?? []) get(primary(t)).parks_for.push(rec.ref);
    for (const t of rec.serves ?? []) get(primary(t)).serves.push(rec.ref);
    for (const t of rec.part_of ?? []) get(primary(t)).children.push(rec.ref);
    for (const t of rec.reaches ?? []) get(primary(t)).reached_by.push(rec.ref);
    for (const t of rec.starts_at ?? []) get(primary(t)).starts_here.push(rec.ref);
  }
  const world: World = { root, cap, suit, rel, points: pts?.points ?? {}, operators, alias, incoming, trips, supersedes: new Map() };
  // 9.7: an official re-read may replace a pre-migration value as the shown value; the files on disk are not touched
  if (opts.supersede !== false) applySupersedes(world, loadSupersedes(root));
  return world;
}

export const primaryRef = (w: World, ref: string): string => w.alias.get(ref) ?? ref;
export const incomingOf = (w: World, ref: string): Incoming => w.incoming.get(ref) ?? emptyIncoming();
