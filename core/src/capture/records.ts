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
import { RELATION_RULES, targetsOf } from "../schema/capture/relations.ts";
import type { RuleKey } from "../schema/capture/relations.ts";

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

/**
 * The derived inverses of one record (entity-graph 5.1), built from RELATION_RULES: for each stored relation, the records whose link
 * names this one, under the relation's inverse name. A symmetric relation's reverse keeps the relation's own name (`alternative_to`,
 * `combo_with`: the records that list this one). Area membership (`covers_areas`) and the closure (`members_all`) are the graph index's
 * (EG-I), not this per-process map.
 *
 * Legacy names (spec 15), kept until their readers move: `at` is `offers_at`, `on` is `offers_on` and `children` is `members` (the same
 * arrays); `parks_for` and `serves` are the two halves of `access_points`.
 */
export interface Incoming {
  /** records that are `part_of` this one (direct members; a stage's whole route) */
  members: string[];
  /** routes that `reach` this record */
  reached_by: string[];
  /** routes that `pass` this record */
  passed_by: string[];
  /** routes and offers that start here */
  starts_here: string[];
  /** routes that end here */
  ends_here: string[];
  /** offers whose `at` names this record */
  offers_at: string[];
  /** offers whose `on` names this record */
  offers_on: string[];
  /** access places whose `parks_for` or `serves` names this record */
  access_points: string[];
  /** records an operator runs (keyed by the operator ref) */
  operator_of: string[];
  /** requirements this pass or lodging offer covers */
  covers: string[];
  /** products that include this requirement */
  included_in: string[];
  /** variants of this primary */
  variants: string[];
  alternative_to: string[];
  combo_with: string[];
  /** legacy alias of offers_at (same array) */
  at: string[];
  /** legacy alias of offers_on (same array) */
  on: string[];
  /** legacy alias of members (same array) */
  children: string[];
  /** legacy: the parks_for half of access_points */
  parks_for: string[];
  /** legacy: the serves half of access_points */
  serves: string[];
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

/** An empty Incoming, with the legacy names sharing their arrays. */
export function emptyIncoming(): Incoming {
  const members: string[] = [], offers_at: string[] = [], offers_on: string[] = [];
  return {
    members, reached_by: [], passed_by: [], starts_here: [], ends_here: [], offers_at, offers_on, access_points: [], operator_of: [], covers: [],
    included_in: [], variants: [], alternative_to: [], combo_with: [], at: offers_at, on: offers_on, children: members, parks_for: [], serves: [],
  };
}

/** Where each record-to-record rule's reverse lands in Incoming (covers_areas names areas, so it has no entry). */
const INVERSE_SLOT: Readonly<Partial<Record<RuleKey, keyof Incoming>>> = Object.fromEntries(
  RELATION_RULES.filter((r) => r.shape !== "areas").map((r) => [r.key, (r.inverse ?? r.key) as keyof Incoming]),
);

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
    const row = rec as unknown as Record<string, unknown>;
    for (const rule of RELATION_RULES) {
      const slot = INVERSE_SLOT[rule.key];
      if (!slot) continue;
      for (const t of targetsOf(row, rule.key)) {
        const x = get(primary(t));
        x[slot].push(rec.ref);
        if (rule.key === "parks_for" || rule.key === "serves") x[rule.key].push(rec.ref);
      }
    }
  }
  const world: World = { root, cap, suit, rel, points: pts?.points ?? {}, operators, alias, incoming, trips, supersedes: new Map() };
  // 9.7: an official re-read may replace a pre-migration value as the shown value; the files on disk are not touched
  if (opts.supersede !== false) applySupersedes(world, loadSupersedes(root));
  return world;
}

export const primaryRef = (w: World, ref: string): string => w.alias.get(ref) ?? ref;
export const incomingOf = (w: World, ref: string): Incoming => w.incoming.get(ref) ?? emptyIncoming();
