// Migration of the existing child and access fields into suitability/1 sidecars (spec 7.2, brief step 6).
//
// Rules, from the spec:
// - nothing is invented: a value that was in a source stays, with the source named; everything else is absent or a gap;
// - every migrated value is basis our_inference with src pointing to its original file (kind computed);
// - a limit is never a chosen value here (no operator or official page was re-read); it is kept as a conflict, so the
//   enrichment lane R2b/R1 can confirm it;
// - trail minimum ages marked "operator" but sourced from PLAN.md are not operator rules: they become age_band.from;
// - "easy / moderate / hard" is our word, not a published grade: it becomes a hint, and source_grade stays a gap.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SuitabilityBlock, SuitabilityDoc, SuitabilityRecord, SuitabilitySource, SuitVal } from "../schema/suitability.ts";
import { projectFlat } from "./derive.ts";
import { loadMap } from "./map.ts";
import type { DifficultyMap } from "./map.ts";
import { loadScope } from "./refs.ts";
import type { Scope, ScopeItem } from "./refs.ts";

export const MIGRATION_DATE = "2026-10-18";
const LANE = "S0-migrated";

type Row = Record<string, unknown>;
type Hint = NonNullable<SuitabilityRecord["hints"]>[number];

export interface TripReport {
  trip: string;
  inScope: number;
  resolved: number;
  /** records with a signal by the spec's own count (spec 7.1: trail facts, a min age, a child note, an audience, child_6yo_ok) */
  anySignal: number;
  /** records that carry at least one migrated value, hint or conflict (place-level km and gain included) */
  withAnyData: number;
  limitConflicts: number;
  ageBandFromPlan: number;
}

export interface OffPlanReport {
  trip: string;
  trails: number;
  sights: number;
  adventures: number;
  limitConflicts: number;
}

export interface Migration {
  /** keyed by path under data/suitability/, e.g. "dolomites-2027/migrated.json" */
  docs: Map<string, SuitabilityDoc>;
  reports: TripReport[];
  /** Rockies rows that are on no plan day: migrated to keep the spec 7.2 fixes (Kicking Horse, Kananaskis, horses) */
  offPlan: OffPlanReport[];
}

/** Expected "any signal" counts of spec 7.1, in the order of the spec table. */
export const EXPECTED_SIGNAL: Record<string, number> = {
  "dolomites-2027": 19,
  "canadian-rockies-2029": 76,
  "iceland-ring-road-2027": 0,
  "utah-five-parks": 0,
  "patagonia-2027": 0,
  "chamonix-mont-blanc-2028": 0,
  "algonquin-muskoka-2026": 0,
  "vermont-fall-2026": 0,
};
export const EXPECTED_IN_SCOPE = 207;

// ---- sources ----------------------------------------------------------------------------------------------------
class SourceBook {
  private rows: SuitabilitySource[] = [];
  private byUrl = new Map<string, string>();
  add(url: string, title: string, read: string): string {
    const have = this.byUrl.get(url);
    if (have) return have;
    const id = `src-${String(this.rows.length + 1).padStart(4, "0")}`;
    this.rows.push({ id, url, title, publisher: "this repo", kind: "computed", read });
    this.byUrl.set(url, id);
    return id;
  }
  list(): SuitabilitySource[] {
    return this.rows;
  }
}

// ---- value builders ---------------------------------------------------------------------------------------------
const inferred = <T>(v: T, src: string[], note: string): SuitVal<T> => ({ v, state: "value", basis: "our_inference", src, note });
const gapWithConflict = <T>(v: T, src: string[], note: string): SuitVal<T> => ({
  v: null, state: "gap", basis: null, src: [], conflicts: [{ v, basis: "our_inference", src, note }],
});
const gap = <T>(): SuitVal<T> => ({ v: null, state: "gap", basis: null, src: [] });

function num(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(x)) return Number(x);
  return null;
}

/** "5-6 h", "4h28", "about 2 h 50", "30-40 min", "1-1.5": minutes, or null when it says something else. */
export function parseMinutes(raw: string): [number, number] | null {
  const s = raw.trim().toLowerCase().replace(/^about\s+/, "");
  let m = /^(\d+)\s*h\s*(\d+)$/.exec(s);
  if (m) {
    const t = Number(m[1]) * 60 + Number(m[2]);
    return [t, t];
  }
  m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*min\b/.exec(s);
  if (m) return range(m[1]!, m[2], 1);
  m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*h(?:ours?)?\b/.exec(s);
  if (m) return range(m[1]!, m[2], 60);
  m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/.exec(s);
  if (m) return range(m[1]!, m[2], 60);
  return null;
}
function range(a: string, b: string | undefined, f: number): [number, number] {
  const lo = Math.round(Number(a) * f);
  return [lo, b === undefined ? lo : Math.round(Number(b) * f)];
}

// ---- readers ----------------------------------------------------------------------------------------------------
function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

interface Fact { v: string; conf?: string; src?: string; read?: string }
interface ProtoPlace { id: string; kind: string; minAge?: number; km?: number; gain?: number; hours?: string; durationMin?: number }
interface ProtoTrail { facts: Record<string, Fact> }
interface Snapshot { places: ProtoPlace[]; trails: Record<string, ProtoTrail> }

interface Ctx {
  root: string;
  map: DifficultyMap;
  scope: Scope;
  snap: Snapshot | null;
  locations: Map<string, Row>;
  locUpdated: string;
  rockies: Map<string, Map<string, Row>>; // "folder/dataset" -> id -> row
}

function loadCtx(root: string): Ctx {
  const scope = loadScope(root);
  if (!scope) throw new Error("data/suitability/scope.json is missing; run the scope dump (tools/suitability-scope/dump-scope.test.ts)");
  const snap = readJson<Snapshot>(join(root, "web", "data-snapshots", "prototype.json"));
  const loc = readJson<{ updated?: string; places: Row[] }>(join(root, "data", "locations", "locations.json"));
  const rockies = new Map<string, Map<string, Row>>();
  for (const it of scope.items) {
    const l = it.source.legacy;
    if (!l) continue;
    const key = `${l.folder}/${l.dataset}`;
    if (rockies.has(key)) continue;
    const rows = readJson<Row[]>(join(root, "legacy", l.folder, "data", `${l.dataset}.json`)) ?? [];
    rockies.set(key, new Map(rows.map((r) => [String(r.id), r])));
  }
  return {
    root, map: loadMap(root), scope, snap,
    locations: new Map((loc?.places ?? []).map((p) => [String(p.id), p])),
    locUpdated: loc?.updated ?? MIGRATION_DATE,
    rockies,
  };
}

// ---- one record -------------------------------------------------------------------------------------------------
interface Built {
  block: SuitabilityBlock;
  hints: Hint[];
  signal: boolean;
  hasData: boolean;
  limitConflicts: number;
  ageBandFromPlan: boolean;
}

class Recorder {
  block: SuitabilityBlock = {};
  hints: Hint[] = [];
  signal = false;
  limitConflicts = 0;
  ageBandFromPlan = false;
  private book: SourceBook;
  constructor(book: SourceBook) {
    this.book = book;
  }
  src(url: string, title: string, read: string): string {
    return this.book.add(url, title, read);
  }
  hint(field: string, text: string, src: string): void {
    this.hints.push({ field, text, src: [src] });
  }
  drivers(): NonNullable<NonNullable<SuitabilityBlock["effort"]>["drivers"]> {
    this.block.effort ??= {};
    this.block.effort.drivers ??= {};
    return this.block.effort.drivers;
  }
  distance(km: number, src: string, note: string): void {
    this.drivers().distance_km = inferred(km, [src], note);
  }
  gain(m: number, src: string, note: string): void {
    this.drivers().gain_m = inferred(m, [src], note);
  }
  loss(m: number, src: string, note: string): void {
    this.drivers().loss_m = inferred(m, [src], note);
  }
  time(raw: string, src: string, where: string, field = "adult_time_min"): void {
    const r = parseMinutes(raw);
    if (r) this.block.adult_time_min = inferred(r, [src], `converted from ${where} "${raw}" to minutes; not re-read at the source`);
    else this.hint(field, `${where} says "${raw}", which is not a time range`, src);
  }
  minAgeConflict(age: number, src: string, note: string): void {
    this.block.min_age = gapWithConflict(age, [src], note);
    this.limitConflicts++;
  }
  sourceGradeGap(): void {
    this.block.effort ??= {};
    this.block.effort.source_grade = gap();
  }
}

const NOT_RE_READ = "carried over unchanged; the official or operator page was not re-read";

function migrateRockies(it: ScopeItem, ctx: Ctx, book: SourceBook): Recorder {
  const r = new Recorder(book);
  const l = it.source.legacy!;
  const row = ctx.rockies.get(`${l.folder}/${l.dataset}`)?.get(l.id);
  if (!row) throw new Error(`${it.ref}: no row ${l.id} in ${l.dataset}.json`);
  const file = `legacy/${l.folder}/data/${l.dataset}.json`;
  const checked = typeof row.checked === "string" ? row.checked : MIGRATION_DATE;
  const s = r.src(file, `${l.dataset}.json of the 2029 plan`, MIGRATION_DATE);
  const status = row.status ? `status ${String(row.status)}` : "no status";
  if (l.dataset === "trails") {
    const km = num(row.km);
    const gain = num(row.gain_m);
    const extra = typeof row.stats_note === "string" ? ` Row note: ${row.stats_note}` : "";
    if (km !== null) r.distance(km, s, `trails.json km ${km} (${status}, checked ${checked}); ${NOT_RE_READ}.${extra}`);
    if (gain !== null) r.gain(gain, s, `trails.json gain_m ${gain} (${status}, checked ${checked}); ${NOT_RE_READ}.${extra}`);
    if (typeof row.hours === "string") r.time(row.hours, s, "trails.json hours");
    if (typeof row.child_note === "string" && row.child_note) r.block.kid_note = row.child_note;
    if (typeof row.audience === "string") r.hint("age_band", `the 2029 plan's tracks mark this ${row.audience}; the research lane sets the recommended ages`, s);
    if (typeof row.difficulty === "string") r.hint("source_grade", `our label "${row.difficulty}" is not Parks Canada's grade; source_grade stays a gap until the official page is read`, s);
    r.sourceGradeGap();
    r.signal = true; // km, gain, audience and a child note are all present on every trail row
  } else if (l.dataset === "sights") {
    if (typeof row.child_note === "string" && row.child_note) r.block.kid_note = row.child_note;
    r.signal = typeof row.child_note === "string" && row.child_note.length > 0;
  } else {
    const minAge = num(row.min_age);
    const minH = num(row.min_height_cm);
    const maxW = num(row.max_weight_kg);
    const type = String(row.type);
    if (minAge !== null) r.minAgeConflict(minAge, s, `adventures.json min_age ${minAge} (${status}, checked ${checked}); ${NOT_RE_READ}. R2b confirms it at the operator.`);
    if (minH !== null) {
      r.block.min_height_cm = gapWithConflict(minH, [s], `adventures.json min_height_cm ${minH}; ${NOT_RE_READ}.`);
      r.limitConflicts++;
    }
    if (maxW !== null) {
      if (l.id === "kicking-horse-family-float") {
        // research/trips/canadian-rockies-sept-2029/adventure.md line 136: "minimum 8 yrs and 50 lb (23 kg) is a MINIMUM weight, not max"
        r.block.min_weight_kg = gapWithConflict(maxW, [s], `adventures.json stores ${maxW} as max_weight_kg, but research adventure.md line 136 says the operator's 50 lb (22.7 kg) is a MINIMUM weight, not a maximum. Migrated as the minimum; it becomes a value only after R2b re-reads the operator page.`);
        r.limitConflicts++;
      } else if (l.id === "kananaskis-river-raft") {
        // adventure.md lines 9 and 154 read the same 40 lb (18.1 kg) as a minimum, while the row stores it as a maximum
        r.block.max_weight_kg = gapWithConflict(maxW, [s], `adventures.json stores ${maxW} as max_weight_kg.`);
        r.block.min_weight_kg = gapWithConflict(maxW, [s], `research adventure.md lines 9 and 154 read the operator's 40 lb (${maxW} kg) as a minimum weight, not a maximum. The two readings conflict; R2b confirms which end it is at the operator page.`);
        r.limitConflicts += 2;
      } else {
        r.block.max_weight_kg = gapWithConflict(maxW, [s], `adventures.json max_weight_kg ${maxW}; ${NOT_RE_READ}.`);
        r.limitConflicts++;
        if (type === "horse") r.block.limit_reason = "policy"; // horse welfare, spec 7.2
      }
    }
    if (typeof row.child_6yo_ok === "string") r.hint("age_band", `child_6yo_ok is "${row.child_6yo_ok}" for the 2029 party (a child of about 6, 20 kg); it is a hint for the research lane, not a fact about the activity`, s);
    if (typeof row.audience === "string") r.hint("age_band", `the 2029 plan marks this activity ${row.audience}; the research lane sets the recommended ages`, s);
    r.signal = row.child_6yo_ok !== undefined || row.audience !== undefined;
  }
  return r;
}

function migrateProto(it: ScopeItem, ctx: Ctx, book: SourceBook, r: Recorder): void {
  const id = it.source.protoId;
  if (!id || !ctx.snap) return;
  const place = ctx.snap.places.find((p) => p.id === id);
  const trail = ctx.snap.trails[id];
  const s = r.src("web/data-snapshots/prototype.json", "prototype snapshot of the Dolomites trips", MIGRATION_DATE);
  const was = (name: string, f: Fact): string => `prototype.json trail fact ${name} "${f.v}" (conf ${f.conf ?? "?"}, src ${f.src ?? "?"}, read ${f.read ?? "?"})`;
  const f = trail?.facts ?? {};
  if (trail) r.signal = true; // spec 7.1 counts a place with trail facts as having a signal
  const dist = f.distance_km;
  if (dist) {
    const n = num(dist.v);
    if (n !== null) r.distance(n, s, `${was("distance_km", dist)}; ${NOT_RE_READ}.`);
    else r.hint("distance_km", `prototype.json distance_km reads "${dist.v}" (conf ${dist.conf ?? "?"}); sources disagree, so no value was chosen`, s);
  } else if (place?.km !== undefined) r.distance(place.km, s, `prototype.json place km ${place.km}; no source recorded; ${NOT_RE_READ}.`);
  const gn = f.elevation_gain_m;
  if (gn) {
    const n = num(gn.v);
    if (n !== null) r.gain(n, s, `${was("elevation_gain_m", gn)}; ${NOT_RE_READ}.`);
  } else if (place?.gain !== undefined && place.gain > 0) r.gain(place.gain, s, `prototype.json place gain ${place.gain}; no source recorded; ${NOT_RE_READ}.`);
  const loss = f.elevation_loss_m;
  if (loss && num(loss.v) !== null) r.loss(num(loss.v)!, s, `${was("elevation_loss_m", loss)}; ${NOT_RE_READ}.`);
  const dur = f.duration_hours;
  if (dur) r.time(dur.v, s, `prototype.json trail fact duration_hours (conf ${dur.conf ?? "?"}, src ${dur.src ?? "?"})`);
  else if (place?.hours) r.time(place.hours, s, "prototype.json place hours");
  // minimum ages
  const ma = f.min_age;
  if (ma) {
    const n = num(ma.v);
    if (n !== null) {
      const fromPlan = /PLAN\.md/.test(ma.src ?? "");
      r.block.age_band = inferred({ from: n, to: null }, [s], `${was("min_age", ma)}. ${fromPlan ? "PLAN.md is not an operator, so this is a recommended age and not a minimum (spec 7.2)." : "No operator page is cited, so this is a recommended age and not a minimum."}`);
      if (fromPlan) r.ageBandFromPlan = true;
      r.signal = true;
    }
  }
  if (place?.minAge !== undefined && !ma) {
    r.minAgeConflict(place.minAge, s, `prototype.json place minAge ${place.minAge}; no source recorded, so it is not a rule; ${NOT_RE_READ}.`);
    r.signal = true;
  } else if (place?.minAge !== undefined && ma && num(ma.v) !== place.minAge) {
    r.minAgeConflict(place.minAge, s, `prototype.json place minAge ${place.minAge} differs from the trail fact min_age ${ma.v}; no source recorded.`);
  }
  const kn = f.kid_notes;
  if (kn) {
    r.block.kid_note = kn.v; // verbatim; stroller stays a gap for the research lane (spec 7.2)
    r.signal = true;
  }
  for (const [key, label] of [["difficulty", "source_grade"], ["exposure", "exposure"], ["surface", "surface"]] as const) {
    const fx = f[key];
    if (fx) r.hint(label, `${was(key, fx)}; ${key === "difficulty" ? "a label, not a published grade" : "not migrated as a value"}`, s);
  }
  if (f.difficulty) r.sourceGradeGap();
}

function migrateLocation(it: ScopeItem, ctx: Ctx, r: Recorder): void {
  const id = it.source.locationId;
  const row = id ? ctx.locations.get(id) : undefined;
  if (!row) return;
  const s = r.src("data/locations/locations.json", "locations store", ctx.locUpdated);
  const stats = (row.stats ?? {}) as Row;
  const km = num(stats.km);
  const gain = num(stats.gain_m);
  const d = r.block.effort?.drivers;
  if (km !== null && !d?.distance_km) r.distance(km, s, `locations.json stats.km ${km} (stats_verified ${String(row.stats_verified)}); ${NOT_RE_READ}.`);
  if (gain !== null && !d?.gain_m) r.gain(gain, s, `locations.json stats.gain_m ${gain} (stats_verified ${String(row.stats_verified)}); ${NOT_RE_READ}.`);
  if (row.kid_fit && row.kid_fit !== "unknown") r.hint("age_band", `locations.json kid_fit is "${String(row.kid_fit)}"`, s);
  const ma = num(row.min_age);
  if (ma !== null && !r.block.min_age && !r.block.age_band) r.minAgeConflict(ma, s, `locations.json min_age ${ma}; no source recorded, so it is not a rule.`);
}

function ofKind(kind: string): SuitabilityRecord["kind"] {
  const allowed = ["trail", "viewpoint", "waterfall", "lake", "sight", "town", "activity", "lift", "swim_spot", "stay", "eatery"];
  if (!allowed.includes(kind)) throw new Error(`scope kind "${kind}" is not a suitability kind`);
  return kind as SuitabilityRecord["kind"];
}

export function migrate(root: string): Migration {
  const ctx = loadCtx(root);
  const byTrip = new Map<string, ScopeItem[]>();
  for (const it of ctx.scope.items) byTrip.set(it.trip, [...(byTrip.get(it.trip) ?? []), it]);
  const docs = new Map<string, SuitabilityDoc>();
  const reports: TripReport[] = [];
  for (const trip of [...byTrip.keys()].sort()) {
    const items = [...byTrip.get(trip)!].sort((a, b) => a.ref.localeCompare(b.ref));
    const book = new SourceBook();
    const records: SuitabilityRecord[] = [];
    const rep: TripReport = { trip, inScope: items.length, resolved: 0, anySignal: 0, withAnyData: 0, limitConflicts: 0, ageBandFromPlan: 0 };
    for (const it of items) {
      let r: Recorder;
      if (it.source.legacy) r = migrateRockies(it, ctx, book);
      else r = new Recorder(book);
      migrateProto(it, ctx, book, r);
      migrateLocation(it, ctx, r);
      // a Rockies item with a place page keeps its place ref; the legacy row was read above
      const subkind = it.source.legacy?.dataset === "adventures" ? String(ctx.rockies.get(`${it.source.legacy.folder}/adventures`)?.get(it.source.legacy.id)?.type ?? "").replace(/_/g, "-") || undefined : undefined;
      const rec: SuitabilityRecord = { ref: it.ref, kind: ofKind(it.kind), ...(subkind ? { subkind } : {}), suitability: r.block, ...(r.hints.length ? { hints: r.hints } : {}) };
      rec.flat = projectFlat(rec, ctx.map);
      records.push(rec);
      rep.resolved++;
      if (r.signal) rep.anySignal++;
      if (Object.keys(r.block).length > 0 || r.hints.length > 0) rep.withAnyData++;
      rep.limitConflicts += r.limitConflicts;
      if (r.ageBandFromPlan) rep.ageBandFromPlan++;
    }
    docs.set(`${trip}/migrated.json`, {
      schema: "suitability/1", trip, lane: LANE, researched: MIGRATION_DATE, agent: "travel-builder", model: "sonnet",
      sources: book.list(), records,
    });
    reports.push(rep);
  }

  // Rockies rows on no plan day. The spec 7.2 traps (Kicking Horse, Kananaskis, the horse rides) are all among them,
  // so they are migrated too, into their own file, and the 207-ref counts above stay as the spec states them.
  const offPlan: OffPlanReport[] = [];
  const onPlan = new Set(ctx.scope.items.filter((i) => i.source.legacy).map((i) => `${i.source.legacy!.dataset}/${i.source.legacy!.id}`));
  const folder = "canadian-rockies-sept-2029";
  const rockiesTrip = "canadian-rockies-2029";
  if (ctx.rockies.size > 0) {
    const book = new SourceBook();
    const records: SuitabilityRecord[] = [];
    const rep: OffPlanReport = { trip: rockiesTrip, trails: 0, sights: 0, adventures: 0, limitConflicts: 0 };
    for (const dataset of ["adventures", "sights", "trails"] as const) {
      const rows = [...(ctx.rockies.get(`${folder}/${dataset}`)?.values() ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      for (const row of rows) {
        const id = String(row.id);
        if (onPlan.has(`${dataset}/${id}`)) continue;
        const kind = dataset === "trails" ? "trail" : dataset === "sights" ? "sight" : row.type === "gondola" ? "lift" : "activity";
        const it: ScopeItem = { ref: `legacy/${folder}/${dataset}/${id}`, key: null, trip: rockiesTrip, kind, name: String(row.name), days: [], source: { legacy: { folder, dataset, id } } };
        const r = migrateRockies(it, ctx, book);
        const subkind = dataset === "adventures" ? String(row.type).replace(/_/g, "-") : undefined;
        const rec: SuitabilityRecord = { ref: it.ref, kind: ofKind(kind), ...(subkind ? { subkind } : {}), suitability: r.block, ...(r.hints.length ? { hints: r.hints } : {}) };
        rec.flat = projectFlat(rec, ctx.map);
        records.push(rec);
        rep[dataset]++;
        rep.limitConflicts += r.limitConflicts;
      }
    }
    records.sort((a, b) => a.ref.localeCompare(b.ref));
    docs.set(`${rockiesTrip}/migrated-offplan.json`, {
      schema: "suitability/1", trip: rockiesTrip, lane: `${LANE}-offplan`, researched: MIGRATION_DATE, agent: "travel-builder", model: "sonnet",
      sources: book.list(), records,
    });
    offPlan.push(rep);
  }
  return { docs, reports, offPlan };
}

/** Throws with every mismatch against spec 7.1 (207 refs, the "any signal" counts). */
export function assertSpecCounts(m: Migration): void {
  const bad: string[] = [];
  const total = m.reports.reduce((s, r) => s + r.inScope, 0);
  if (total !== EXPECTED_IN_SCOPE) bad.push(`in-scope refs: ${total}, spec says ${EXPECTED_IN_SCOPE}`);
  for (const r of m.reports) {
    if (r.resolved !== r.inScope) bad.push(`${r.trip}: ${r.resolved} of ${r.inScope} refs migrated`);
    const want = EXPECTED_SIGNAL[r.trip];
    if (want === undefined) bad.push(`${r.trip}: not a trip of spec 7.1`);
    else if (r.anySignal !== want) bad.push(`${r.trip}: any signal ${r.anySignal}, spec says ${want}`);
  }
  const main = [...m.docs.keys()].filter((k) => k.endsWith("/migrated.json"));
  if (main.length !== 8) bad.push(`${main.length} migrated.json files, spec says 8`);
  if (bad.length) throw new Error(`migration does not match spec 7.1:\n  ${bad.join("\n  ")}`);
}
