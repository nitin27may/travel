// `capture.ts derive-area` (capture contract 3.7.1): sets `area_id` on the place and route records that have none, from the record's
// parent or from its sourced point, against the areas of the locations store (the registry; never an id it does not hold). Offline and
// idempotent; it reruns when points, towns or areas change. The pure rule is `decideAreas`; `planAreaDerivation` reads the files.
//
// The rule, in order (the first that answers wins; a record nobody can place stays a gap with its reason, never a guess):
//   1. authored: an `area_id` this step did not write (the ledger below says which ones it wrote) is never touched;
//   2. the parent: the ref a `part/` was cut out of, `part_of`, `starts_at`, `at`, when every parent that has an area (authored or
//      derived in this run) names the same one; parents that disagree leave the record a gap (`parents_disagree`);
//   3. the point (the record's own, or a route's start): the labels are the authored records with an exact point and the locations
//      store's places, each with its area. The nearest label must lie within AREA_DERIVATION.radiusKm; the nearest label of any other
//      area at least marginRatio times farther; the area's region must be the region of the record's nearest town (data/reference/towns
//      carries cc and admin1; a town in a region the registry lacks fails); and that town must be one of the area's own label towns, or
//      its point must fall to the same area by the same test (so a Canmore trail is never put in Banff by distance alone).
//   Only authored labels place a point: a derived area never labels another record, so a second run finds what the first did.
//
// Provenance: the area_id is a bare id (capture/1), so what this step wrote, and why, is the ledger data/capture/derived-areas.json
// (basis our_inference, the rule, the label it came from, the distances). The edit changes only the `area_id` key of a record
// (core/src/normalise/jsonPatch.ts keeps every other byte); a new key goes right after `ref`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AREA_DERIVATION } from "../config/area.ts";
import { nearestTown } from "../derive/near.ts";
import { hasTownsFiles, readTownsFiles } from "../derive/townsData.ts";
import { haversineKm } from "../geo/distance.ts";
import { deepEqual, patchText } from "../normalise/jsonPatch.ts";
import { NEAR_TOWN_NONE } from "../schema/capture/points.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import { loadPlacement, pointOf } from "./placementBlock.ts";
import { loadWorld, readJson } from "./records.ts";
import type { World } from "./records.ts";

export const DERIVED_AREAS_PATH = "data/capture/derived-areas.json";
export const DERIVED_AREAS_SCHEMA = "capture-derived-areas/1";
export const STORE_LABEL = "locations store";
/** The thresholds the rule reads (AREA_DERIVATION by default; a test may widen one to show what it guards). */
export interface AreaRules { radiusKm: number; marginRatio: number; floorKm: number; minPrecision: number }
type Rules = AreaRules;

// ----- the pure rule -------------------------------------------------------------------------------------------------------------------

export interface AreaPoint { lat: number; lon: number; approx: boolean }
/** One place or route record, as the rule sees it. */
export interface AreaSubject {
  ref: string;
  trip: string;
  point: AreaPoint | null;
  /** the record's near_town id, `none_within_50km`, or null when it has none */
  town: string | null;
  /** primary refs of its parents (cut-out, part_of, starts_at, at) */
  parents: string[];
  /** an area_id this step did not write, else null */
  authored: string | null;
}
/** A point with a known area: an authored record or a locations-store place. */
export interface AreaLabel { area: string; lat: number; lon: number; town: string | null; from: string }
/** A town of the towns layer: its point and the registry region it lies in (`unregistered:<cc>-<admin1>` when the store has none). */
export interface AreaTown { lat: number; lon: number; region: string }
export interface AreaInput {
  subjects: AreaSubject[];
  /** labels that are not subjects (the locations store's places) */
  storeLabels: AreaLabel[];
  towns: Record<string, AreaTown>;
  /** area id -> its region id, for every area of the registry */
  areaRegion: Record<string, string>;
}

export type AreaReason = "no_point" | "no_area_within_radius" | "ambiguous" | "region_mismatch" | "town_outside_area" | "parents_disagree";
export type AreaVia = "authored" | "parent" | "point";
export interface AreaDecision {
  ref: string;
  area: string | null;
  via: AreaVia | null;
  /** the parent ref, the label's ref (or "locations store") */
  from: string | null;
  /** km to the winning label, and to the nearest label of another area (point rule only) */
  km: number | null;
  rivalKm: number | null;
  reason: AreaReason | null;
  /** the registry region of the record's nearest town (`unregistered:...` when the store lacks it), for the proposals */
  region: string | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

interface Ranked { area: string; km: number; label: AreaLabel; rival: number | null }

/** The distance test alone: the nearest label within the radius and the clear margin over every other area. */
function nearestArea(q: { lat: number; lon: number }, labels: readonly AreaLabel[], rules: Rules): Ranked | AreaReason {
  let best: { km: number; label: AreaLabel } | null = null;
  for (const l of labels) {
    const km = haversineKm(q, l);
    if (!best || km < best.km || (km === best.km && l.from < best.label.from)) best = { km, label: l };
  }
  if (!best || best.km > rules.radiusKm) return "no_area_within_radius";
  let rival: number | null = null;
  for (const l of labels) if (l.area !== best.label.area) { const km = haversineKm(q, l); if (rival === null || km < rival) rival = km; }
  if (rival !== null && rival < rules.marginRatio * Math.max(best.km, rules.floorKm)) return "ambiguous";
  return { area: best.label.area, km: best.km, label: best.label, rival };
}

/** The point rule for one record. */
export function pointDecision(s: AreaSubject, labels: readonly AreaLabel[], input: Pick<AreaInput, "towns" | "areaRegion">, rules: Rules = AREA_DERIVATION): AreaDecision {
  const town = s.town && s.town !== NEAR_TOWN_NONE ? input.towns[s.town] ?? null : null;
  const region = town?.region ?? null;
  const none = (reason: AreaReason): AreaDecision => ({ ref: s.ref, area: null, via: null, from: null, km: null, rivalKm: null, reason, region });
  if (!s.point) return none("no_point");
  const hit = nearestArea(s.point, labels, rules);
  if (typeof hit === "string") return none(hit);
  if (town) {
    if (input.areaRegion[hit.area] !== town.region) return none("region_mismatch");
    const own = labels.some((l) => l.area === hit.area && l.town === s.town);
    if (!own) {
      const t = nearestArea(town, labels, rules);
      if (typeof t === "string" || t.area !== hit.area) return none("town_outside_area");
    }
  }
  return { ref: s.ref, area: hit.area, via: "point", from: hit.label.from, km: round1(hit.km), rivalKm: hit.rival === null ? null : round1(hit.rival), reason: null, region };
}

/** The labels the subjects give: every authored record with an exact point. */
export function subjectLabels(subjects: readonly AreaSubject[]): AreaLabel[] {
  return subjects.flatMap((s) => (s.authored && s.point && !s.point.approx ? [{ area: s.authored, lat: s.point.lat, lon: s.point.lon, town: s.town, from: s.ref }] : []));
}

/** Every subject's decision: authored, else the parents, else the point. Order-independent. */
export function decideAreas(input: AreaInput, rules: Rules = AREA_DERIVATION): Map<string, AreaDecision> {
  const labels = [...subjectLabels(input.subjects), ...input.storeLabels];
  const byRef = new Map(input.subjects.map((s) => [s.ref, s]));
  const memo = new Map<string, AreaDecision>();
  const resolve = (s: AreaSubject, stack: Set<string>): AreaDecision => {
    const had = memo.get(s.ref);
    if (had) return had;
    if (s.authored) {
      const d: AreaDecision = { ref: s.ref, area: s.authored, via: "authored", from: null, km: null, rivalKm: null, reason: null, region: null };
      memo.set(s.ref, d);
      return d;
    }
    stack.add(s.ref);
    const found = new Map<string, string>();
    for (const p of s.parents) {
      const ps = byRef.get(p);
      if (!ps || stack.has(p)) continue;
      const a = resolve(ps, stack).area;
      if (a && !found.has(a)) found.set(a, p);
    }
    stack.delete(s.ref);
    let d: AreaDecision;
    if (found.size === 1) {
      const [[area, from]] = [...found];
      d = { ref: s.ref, area: area!, via: "parent", from: from!, km: null, rivalKm: null, reason: null, region: null };
    } else if (found.size > 1) {
      d = { ref: s.ref, area: null, via: null, from: null, km: null, rivalKm: null, reason: "parents_disagree", region: null };
    } else d = pointDecision(s, labels, input, rules);
    memo.set(s.ref, d);
    return d;
  };
  for (const s of input.subjects) resolve(s, new Set());
  return memo;
}

// ----- the hold-out accuracy test ------------------------------------------------------------------------------------------------------

/** The family of a ref: a `part/<ref>#x` and `<ref>` are one family (they share points and parents). */
export const familyOf = (ref: string): string => (ref.startsWith("part/") ? ref.slice(5) : ref).replace(/#.*$/, "");

export interface Accuracy {
  mode: "one" | "family";
  known: number;
  answered: number;
  matched: number;
  /** matched / answered: the share of the rule's answers that equal the authored area */
  precision: number;
  /** matched / known */
  coverage: number;
  abstained: Record<string, number>;
  confusion: { ref: string; known: string; derived: string; via: AreaVia; from: string | null }[];
}

/**
 * Hides each authored area in turn (mode `one`: the record alone; mode `family`: the record and its whole family, so a sibling at the
 * same spot cannot answer for it), derives it, and compares. Precision is what gates the write (AREA_DERIVATION.minPrecision).
 */
export function holdOutAccuracy(input: AreaInput, mode: "one" | "family", rules: Rules = AREA_DERIVATION): Accuracy {
  const known = input.subjects.filter((s) => s.authored);
  let answered = 0, matched = 0;
  const abstained: Record<string, number> = {};
  const confusion: Accuracy["confusion"] = [];
  for (const k of known) {
    const hide = (s: AreaSubject): boolean => (mode === "one" ? s.ref === k.ref : familyOf(s.ref) === familyOf(k.ref));
    const subjects = input.subjects.map((s) => (hide(s) ? { ...s, authored: null } : s));
    const d = decideAreas({ ...input, subjects }, rules).get(k.ref)!;
    if (!d.area) { abstained[d.reason ?? "none"] = (abstained[d.reason ?? "none"] ?? 0) + 1; continue; }
    answered++;
    if (d.area === k.authored) matched++;
    else confusion.push({ ref: k.ref, known: k.authored!, derived: d.area, via: d.via!, from: d.from });
  }
  return { mode, known: known.length, answered, matched, precision: answered ? matched / answered : 0, coverage: known.length ? matched / known.length : 0, abstained, confusion };
}

// ----- reading the repository ----------------------------------------------------------------------------------------------------------

export interface LedgerEntry { area_id: string; via: "parent" | "point"; from: string; km?: number; rival_km?: number | null }
export interface Ledger { schema: typeof DERIVED_AREAS_SCHEMA; note: string; basis: "our_inference"; rule: Record<string, unknown>; areas: Record<string, LedgerEntry> }

export function readLedger(root: string): Ledger | null {
  const doc = readJson<Ledger>(join(root, DERIVED_AREAS_PATH));
  return doc && doc.schema === DERIVED_AREAS_SCHEMA && doc.areas && typeof doc.areas === "object" ? doc : null;
}

const slug = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface StoreRow { [k: string]: unknown }

/** The registry: areas with their region, regions with their country, ISO code and name, places with an area and a point. */
function loadRegistry(root: string): { areaRegion: Record<string, string>; regions: { id: string; country: string; iso: string | null; name: string }[]; places: { area: string; lat: number; lon: number }[] } {
  const dir = join(root, "data", "locations");
  const store = readJson<StoreRow>(join(dir, "locations.json")) ?? {};
  const list = (k: string): StoreRow[] => {
    const own = Array.isArray(store[k]) ? (store[k] as StoreRow[]) : [];
    if (store.layout !== "by-country" || !Array.isArray(store.parts)) return own;
    return [...own, ...(store.parts as string[]).flatMap((cc) => {
      const part = readJson<StoreRow>(join(dir, `${cc}.json`));
      return part && Array.isArray(part[k]) ? (part[k] as StoreRow[]) : [];
    })];
  };
  const areaRegion: Record<string, string> = {};
  for (const a of list("areas")) if (typeof a.id === "string" && typeof a.region_id === "string") areaRegion[a.id] = a.region_id;
  const regions = list("regions").flatMap((r) => (typeof r.id === "string" && typeof r.country === "string" ? [{ id: r.id, country: r.country, iso: typeof r.iso_3166_2 === "string" ? r.iso_3166_2 : null, name: typeof r.name === "string" ? r.name : "" }] : []));
  const places = list("places").flatMap((p) => (typeof p.area_id === "string" && areaRegion[p.area_id] && typeof p.lat === "number" && typeof p.lon === "number" ? [{ area: p.area_id, lat: p.lat, lon: p.lon }] : []));
  return { areaRegion, regions, places };
}

/** The parents of a record, as primary refs (the same reading as migrate-placement). */
function parentsOf(w: World, rec: CaptureRecord): string[] {
  const cut = rec.ref.startsWith("part/") ? [rec.ref.slice(5).replace(/#.*$/, "")] : [];
  return [...new Set([...cut, ...(rec.part_of ?? []), ...(rec.starts_at ?? []), ...(rec.at ?? [])].map((r) => w.alias.get(r) ?? r).filter((r) => r !== rec.ref))];
}

export interface LoadedAreas { input: AreaInput; world: World; ledger: Ledger | null; files: Map<string, string>; current: Map<string, string | undefined>; problems: string[] }

export function loadAreaInput(root: string): LoadedAreas {
  const problems: string[] = [];
  const world = loadWorld(root, undefined, [], { supersede: false });
  const pw = loadPlacement(root, world);
  const reg = loadRegistry(root);
  const ledger = readLedger(root);
  if (existsSync(join(root, DERIVED_AREAS_PATH)) && !ledger) problems.push(`${DERIVED_AREAS_PATH} is not a ${DERIVED_AREAS_SCHEMA} file; it is written only by capture.ts derive-area --write`);
  const towns: Record<string, AreaTown> = {};
  const nearTowns: { id: string; lat: number; lon: number; pop: number; geonamesId: number }[] = [];
  if (!hasTownsFiles(root)) problems.push("data/reference/towns is missing; run: python3 tools/towns.py build");
  else {
    for (const t of readTownsFiles(root).rows) {
      const cc = t.cc.toUpperCase();
      const r = reg.regions.find((x) => x.country === cc && ((x.iso && x.iso.toUpperCase() === `${cc}-${t.admin1.toUpperCase()}`) || (!!t.admin1Name && slug(x.name) === slug(t.admin1Name))));
      towns[t.id] = { lat: t.lat, lon: t.lon, region: r ? r.id : `unregistered:${cc}-${t.admin1.toUpperCase()}${t.admin1Name ? ` (${t.admin1Name})` : ""}` };
      nearTowns.push({ id: t.id, lat: t.lat, lon: t.lon, pop: t.pop, geonamesId: t.geonamesId });
    }
  }
  const files = new Map<string, string>();
  const current = new Map<string, string | undefined>();
  const subjects: AreaSubject[] = [];
  for (const { rec, trip, file } of [...world.cap.values()].sort((a, b) => a.rec.ref.localeCompare(b.rec.ref))) {
    if (rec.layer !== "place" && rec.layer !== "route") continue;
    files.set(rec.ref, file);
    current.set(rec.ref, rec.area_id);
    const mine = !!rec.area_id && ledger?.areas[rec.ref]?.area_id === rec.area_id;
    const hit = pointOf(pw, rec);
    const town = rec.near_town?.state === "value" && typeof rec.near_town.v === "string" ? rec.near_town.v : null;
    subjects.push({ ref: rec.ref, trip, point: hit ? { lat: hit.point.lat, lon: hit.point.lon, approx: !!hit.point.approx } : null, town, parents: parentsOf(world, rec), authored: rec.area_id && !mine ? rec.area_id : null });
  }
  const storeLabels: AreaLabel[] = reg.places.map((p) => {
    const t = nearestTown(p, nearTowns);
    return { area: p.area, lat: p.lat, lon: p.lon, town: t ? t.town.id : NEAR_TOWN_NONE, from: STORE_LABEL };
  });
  return { input: { subjects, storeLabels, towns, areaRegion: reg.areaRegion }, world, ledger, files, current, problems };
}

// ----- the plan --------------------------------------------------------------------------------------------------------------------------

export interface Write { path: string; text: string }
export interface AreaChange { ref: string; trip: string; file: string; from: string | null; to: string | null; via: AreaVia | null; source: string | null }
export interface Proposal { region: string; towns: string[]; refs: string[] }
export interface TripReport { place_route: number; had_area: number; derived_parent: number; derived_point: number; unresolved: number; unresolved_by_reason: Record<string, number> }

export interface AreaPlan {
  writes: Write[];
  changes: AreaChange[];
  decisions: Map<string, AreaDecision>;
  unresolved: AreaDecision[];
  proposals: Proposal[];
  perTrip: Record<string, TripReport>;
  problems: string[];
  ledgerChanged: boolean;
}

/** The record object with `area_id` set (right after `ref` when new) or removed; every other key in its place. */
function withArea(r: Record<string, unknown>, area: string | null): Record<string, unknown> {
  if (area === null) { const { area_id: _drop, ...rest } = r; return rest; }
  if ("area_id" in r) return { ...r, area_id: area };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) { out[k] = v; if (k === "ref") out.area_id = area; }
  return out;
}

export function ledgerText(areas: Record<string, LedgerEntry>, rules: Rules = AREA_DERIVATION): string {
  const doc: Ledger = {
    schema: DERIVED_AREAS_SCHEMA,
    note: "Generated by node core/bin/capture.ts derive-area --write. Do not edit. The area_id values capture.ts derive-area wrote, and why (capture contract 3.7.1). An area_id that differs from its entry here is authored and is never touched.",
    basis: "our_inference",
    rule: { order: ["parent", "point"], radius_km: rules.radiusKm, margin_ratio: rules.marginRatio, floor_km: rules.floorKm, labels: "authored area_id records with an exact point, and the locations store's places" },
    areas: Object.fromEntries(Object.entries(areas).sort(([a], [b]) => a.localeCompare(b))),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

export function planAreaDerivation(root: string, opts: { trip?: string | null } = {}): AreaPlan {
  const { input, ledger, files, current, problems } = loadAreaInput(root);
  const decisions = decideAreas(input);
  const inScope = (s: AreaSubject): boolean => !opts.trip || s.trip === opts.trip;
  const changes: AreaChange[] = [];
  const nextLedger: Record<string, LedgerEntry> = {};
  // entries of trips outside --trip stay as they are, if their record still holds the value
  for (const [ref, e] of Object.entries(ledger?.areas ?? {})) {
    const s = input.subjects.find((x) => x.ref === ref);
    if (s && !inScope(s) && current.get(ref) === e.area_id) nextLedger[ref] = e;
  }
  const perTrip: Record<string, TripReport> = {};
  const unresolved: AreaDecision[] = [];
  for (const s of input.subjects) {
    const t = (perTrip[s.trip] ??= { place_route: 0, had_area: 0, derived_parent: 0, derived_point: 0, unresolved: 0, unresolved_by_reason: {} });
    t.place_route++;
    const d = decisions.get(s.ref)!;
    if (s.authored) { t.had_area++; continue; }
    if (!d.area) {
      t.unresolved++;
      t.unresolved_by_reason[d.reason!] = (t.unresolved_by_reason[d.reason!] ?? 0) + 1;
      unresolved.push(d);
    } else if (d.via === "parent") t.derived_parent++;
    else t.derived_point++;
    if (!inScope(s)) continue;
    const was = current.get(s.ref) ?? null;
    if (d.area) nextLedger[s.ref] = { area_id: d.area, via: d.via as "parent" | "point", from: d.from!, ...(d.via === "point" ? { km: d.km!, rival_km: d.rivalKm } : {}) };
    if (d.area !== was) changes.push({ ref: s.ref, trip: s.trip, file: files.get(s.ref)!, from: was, to: d.area, via: d.via, source: d.from });
  }

  const writes: Write[] = [];
  const byFile = new Map<string, Map<string, string | null>>();
  for (const c of changes) byFile.set(c.file, new Map([...(byFile.get(c.file) ?? []), [c.ref, c.to]]));
  for (const [file, want] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const text = readFileSync(file, "utf8");
      const before = JSON.parse(text) as { records: Record<string, unknown>[] };
      const after = { ...before, records: before.records.map((r) => (want.has(String(r.ref)) ? withArea(r, want.get(String(r.ref))!) : r)) };
      const next = patchText(text, before, after);
      // the only difference is the area_id key of the records named in the plan
      const strip = (r: Record<string, unknown>): Record<string, unknown> => { const { area_id: _a, ...rest } = r; return rest; };
      const now = JSON.parse(next) as { records: Record<string, unknown>[] };
      const ok = now.records.length === before.records.length && now.records.every((r, i) => (want.has(String(r.ref)) ? deepEqual(strip(r), strip(before.records[i]!)) : deepEqual(r, before.records[i]))) && deepEqual({ ...now, records: [] }, { ...before, records: [] });
      if (!ok) problems.push(`${file}: the edited file differs from the original by more than the area_id keys`);
      else if (next !== text) writes.push({ path: file, text: next });
    } catch (e) {
      problems.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const ledgerPath = join(root, DERIVED_AREAS_PATH);
  const ledgerNow = ledgerText(nextLedger);
  const ledgerWas = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : null;
  // no ledger file is needed until this step has written something
  const ledgerChanged = ledgerWas === null ? Object.keys(nextLedger).length > 0 : ledgerWas !== ledgerNow;
  if (ledgerChanged) writes.push({ path: ledgerPath, text: ledgerNow });

  // proposals: the unresolved records whose point no registry area reaches, grouped by the region of their nearest town
  const groups = new Map<string, { towns: Set<string>; refs: string[] }>();
  for (const d of unresolved) {
    if (d.reason !== "no_area_within_radius" && d.reason !== "region_mismatch" && d.reason !== "town_outside_area") continue;
    const s = input.subjects.find((x) => x.ref === d.ref)!;
    if (!inScope(s)) continue;
    const key = d.region ?? `no town within 50 km (${s.trip})`;
    const g = groups.get(key) ?? { towns: new Set<string>(), refs: [] };
    if (s.town && s.town !== NEAR_TOWN_NONE) g.towns.add(s.town);
    g.refs.push(d.ref);
    groups.set(key, g);
  }
  const proposals = [...groups].map(([region, g]) => ({ region, towns: [...g.towns].sort(), refs: g.refs.sort() })).sort((a, b) => b.refs.length - a.refs.length || a.region.localeCompare(b.region));
  return { writes, changes, decisions, unresolved: unresolved.filter((d) => inScope(input.subjects.find((x) => x.ref === d.ref)!)), proposals, perTrip, problems, ledgerChanged };
}
