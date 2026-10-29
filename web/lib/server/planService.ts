import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { BUILDER_PACK } from '@travel/core/config/builder.ts';
import { loadDriveData } from '@travel/core/drive/load.ts';
import { aliasKey, cellKey } from '@travel/core/drive/keys.ts';
import { indexDriveData, type DriveIndex } from '@travel/core/drive/model.ts';
import type { PublicDrivePoint } from '@travel/core/drive/types.ts';
import { zoneNear } from '@travel/core/export/tz.ts';
import { gatherCandidateRows, locateRow, matchTown, placeAt, rankCandidates, TOWN_MATCH, type LocateHints, type LocatedPoint } from '@travel/core/plan/candidates.ts';
import { routedKey, placeNode, townNode } from '@travel/core/plan/driveTable.ts';
import { buildPlan, dayTripRadiusMin } from '@travel/core/plan/engine.ts';
import type { EnginePlace, EnginePoint, EngineTown, RoutedLegs } from '@travel/core/plan/engineTypes.ts';
import type { PlaceRow } from '@travel/core/schema/api/index.ts';
import { API_LIMITS } from '@travel/core/schema/api/index.ts';
import {
  planBuildAnswer,
  planBuildRules,
  planCandidatePage,
  planMatrixRules,
  planRegions,
  planStarts,
  type PlanApiError,
  type PlanBuildAnswer,
  type PlanBuildInput,
  type PlanCandidatePage,
  type PlanCandidatesQuery,
  type PlanErrorCode,
  type PlanRegionGroup,
  type PlanRegions,
  type PlanResult,
  type PlanStarts,
} from '@travel/core/schema/api/plan.ts';
import type { PlanOrigin } from '@travel/core/schema/plan-draft.ts';
import { travelRoot } from '@/lib/data/root';
import { recordPoint } from '@/lib/public/timeline';
import { folderAliases } from '@/lib/public/aliases';
import { privateRef } from '@travel/core/catalogue/alias.ts';
import { runLegBatch, type LegService } from './legs';

// PlanService (trip-builder.md 15.1 ISO-5; task TB-API): the builder's own server service. It reads the public CatalogueStore (and adds no method
// to it), the towns layer through that store, the leg cache through the TB-L leg service, and the public reference files for hubs, airports and
// region groups; it hands the pure engine (core/src/plan/engine.ts) what it read and returns the contract's shapes. The route handlers
// (web/app/api/v1/plan/**) do the HTTP: flag, origin, rate limit, validation, privacy. Nothing here knows a request.
//
// PRIVACY (trip-builder 7): the party arrives in `build()`'s body only and goes straight to the engine; it is never kept, logged or echoed. A
// near-mode start is a REFERENCE (hub, airport, town) that this service resolves to a public point and uses in memory: that point is never a
// leg-cache key (the visitor-start rule of core/src/drive/keys.ts: the engine routes the start as its own node, never looked up), never logged
// and never returned. Candidates carry no party at all (a band at most); a query with a start or a band arrives through a no-store POST
// (RB-010, shared.ts), so only public queries are cached.
//
// LOCATION (RB-003): the candidates and the build place a row by ONE ladder (core/src/plan/candidates.ts `locateRow`) over facts this
// service reads from the public store (a town row's gazetteer town, a car park or trailhead from the detail, the record a part belongs to)
// and the record's own public point its page holds back for size (web/lib/public/timeline.ts `recordPoint`, the plan model's reader). A
// row the ladder cannot place is never offered, so every Pick resolves in the build. Rows with an exact point read nothing extra; the rest
// are located once per store revision (locatorCache).
//
// Routing: builds read `leg_cache` only (`allowRouting: false`), so a build never spends the OpenRouteService day budget; an uncached cell is the
// drive model's estimate, flagged (the engine's basis `estimate` or `mixed`). Routing for builds is the deps field `allowRouting`, set per request from the server switch PLAN_ROUTING (shared.ts); a cell the router cannot answer stays the model's estimate.
//
// Extension point: this file imports the builder's engine and contracts, so it is registered in web/tests/plan/isolation.test.ts (X-API).

type Ok<T> = Extract<PlanResult<T>, { ok: true }>;
const ok = <T>(data: T, revision: string): Ok<T> => ({ ok: true, data, revision });
const err = (code: PlanErrorCode, message: string, details?: Record<string, unknown>): { ok: false; error: PlanApiError } => ({
  ok: false,
  error: { code, message, ...(details ? { details } : {}) },
});

/** A country needs this many researched places in a group before the Where step offers it (TB9: below it the group is greyed with "Ask us"). */
export const PLAN_GROUP_MIN_PLACES = 5;
/** Candidate base towns read per build: from around the picks, then the best by size (the engine scores at most BUILDER_PACK.baseTowns). */
const TOWNS_PER_PICK_QUERY = 6;
const TOWNS_KEPT = 120;
/** Nodes (picks, then towns) whose leg-cache cells a build reads: picks first, then the largest towns. */
const ROUTED_TOWNS = BUILDER_PACK.baseTowns;

export interface PlanPoint {
  lat: number;
  lon: number;
  cc: string | null;
}
export interface PlanGroupDef {
  /** `<cc>-<id>`, lower case (planRegionId) */
  id: string;
  /** our own label ("Northern Italy, east", QB7) */
  name: string;
  /** region slugs of the country (the catalogue's `region` facet values) */
  regions: readonly string[];
}

/** The public reference files the service reads: hubs, airports and region groups. A missing file is an empty list, never an error. */
export interface PlanReference {
  hub(id: string): PlanPoint | null;
  airport(iata: string): PlanPoint | null;
  groups(cc: string): readonly PlanGroupDef[];
  /** the names of the hubs and airports, for the start picker (TB-W1); absent: none */
  starts?(): PlanStarts;
}

export interface PlanService {
  /** `GET /api/v1/plan/regions/{cc}` */
  regions(cc: string): Promise<PlanResult<PlanRegions>>;
  /** `GET /api/v1/plan/starts` */
  starts(): Promise<PlanResult<PlanStarts>>;
  /** `GET /api/v1/plan/candidates` (the decoded query) */
  candidates(q: PlanCandidatesQuery): Promise<PlanResult<PlanCandidatePage>>;
  /** `POST /api/v1/plan/build` (the parsed body) */
  build(b: PlanBuildInput): Promise<PlanResult<PlanBuildAnswer>>;
}

export interface PlanServiceDeps {
  store: CatalogueStore;
  /** null: no leg cache (every leg is the model's estimate) */
  legs: Pick<LegService, 'estimateMatrix'> | null;
  reference: PlanReference;
  drive: () => DriveIndex;
  now: () => Date;
  /** may a build ask the router for cells the cache lacks (default false: cache only) */
  allowRouting?: boolean;
}

// ---- reference files -----------------------------------------------------------------------------------------------------------

const readJson = (file: string): unknown => {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown) : null;
  } catch {
    return null;
  }
};
const rowsOf = (j: unknown, key: string): Record<string, unknown>[] => {
  const list = Array.isArray(j) ? j : j && typeof j === 'object' ? ((j as Record<string, unknown>)[key] ?? (j as Record<string, unknown>).rows) : null;
  return Array.isArray(list) ? list.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : [];
};
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const pointOf = (r: Record<string, unknown>): PlanPoint | null => {
  const lat = num(r.lat);
  const lon = num(r.lon);
  return lat !== null && lon !== null ? { lat, lon, cc: typeof r.cc === 'string' ? r.cc.toUpperCase() : null } : null;
};

/**
 * The default reference, from the public reference folder: `hubs.json` and `airports.json` (rows with `id` or `iata`, `lat`, `lon`, `cc`) and
 * `region-groups.json` (rows with `id`, `cc`, `name`, `regions`), each read once. None exists on `main` yet (MX hubs, ORG-D
 * airports, TB-RG); until they land a hub or airport start answers `not_available` and a country has no groups.
 */
export function fileReference(root: string = travelRoot()): PlanReference {
  const dir = path.join(root, 'data', 'reference');
  let hubs: Map<string, PlanPoint> | undefined;
  let airports: Map<string, PlanPoint> | undefined;
  let groups: Map<string, PlanGroupDef[]> | undefined;
  const load = <K extends string>(file: string, list: string, key: string, id: (r: Record<string, unknown>) => K | null): Map<K, PlanPoint> => {
    const m = new Map<K, PlanPoint>();
    for (const r of rowsOf(readJson(path.join(dir, file)), list)) {
      const k = id(r);
      const p = pointOf(r);
      if (k && p && !m.has(k)) m.set(k, p);
    }
    void key;
    return m;
  };
  return {
    hub: (id) => (hubs ??= load('hubs.json', 'hubs', 'id', (r) => (typeof r.id === 'string' ? r.id : null))).get(id) ?? null,
    airport: (iata) => (airports ??= load('airports.json', 'airports', 'iata', (r) => (typeof r.iata === 'string' ? r.iata.toUpperCase() : null))).get(iata) ?? null,
    starts: () => {
      const text = (r: Record<string, unknown>, ...keys: string[]): string | null => {
        for (const k of keys) if (typeof r[k] === 'string' && r[k].trim()) return r[k].trim().slice(0, 120);
        return null;
      };
      const cc = (r: Record<string, unknown>): string | null => (typeof r.cc === 'string' && /^[A-Za-z]{2}$/.test(r.cc) ? r.cc.toUpperCase() : null);
      const hubs = rowsOf(readJson(path.join(dir, 'hubs.json')), 'hubs').flatMap((r) => {
        const id = text(r, 'id');
        return id && pointOf(r) ? [{ id, name: text(r, 'name', 'city', 'label') ?? id, cc: cc(r) }] : [];
      });
      const airports = rowsOf(readJson(path.join(dir, 'airports.json')), 'airports').flatMap((r) => {
        const iata = text(r, 'iata')?.toUpperCase() ?? null;
        return iata && pointOf(r) ? [{ iata, name: text(r, 'name', 'city', 'label') ?? iata, cc: cc(r) }] : [];
      });
      const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
      return { hubs: hubs.sort(byName).slice(0, 300), airports: airports.sort(byName).slice(0, 600) };
    },
    groups: (cc) => {
      if (!groups) {
        groups = new Map();
        for (const r of rowsOf(readJson(path.join(dir, 'region-groups.json')), 'groups')) {
          if (typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.regions)) continue;
          const g: PlanGroupDef = { id: r.id, name: r.name, regions: r.regions.filter((x): x is string => typeof x === 'string') };
          const key = r.id.slice(0, 2).toUpperCase();
          groups.set(key, [...(groups.get(key) ?? []), g]);
        }
      }
      return groups.get(cc.toUpperCase()) ?? [];
    },
  };
}

let driveIndex: DriveIndex | undefined;
/** The drive model's parameters (data/reference/drive), indexed once per process. */
export const defaultDrive = (): DriveIndex => (driveIndex ??= indexDriveData(loadDriveData(travelRoot()).data));

// ---- the service ----------------------------------------------------------------------------------------------------------------

const slugOfRegion = (id: string): string | null => /^[A-Z]{2}\/(.+)$/.exec(id)?.[1] ?? null;

const toEnginePoint = (p: PlanPoint): EnginePoint => ({ lat: p.lat, lon: p.lon, cc: p.cc });

/** Rows located per process and store revision (the store is in memory today; a SQL store reads the same facts in one query). */
const LOCATED_CAP = 5000;

const partParent = (ref: string): string | null => /^part\/([^#]+)#/.exec(ref)?.[1] ?? null;
const exactRow = (r: Pick<PlaceRow, 'lat' | 'lon' | 'approx'>): boolean => r.lat !== null && r.lon !== null && !r.approx;
const point2 = (x: number): string => (Math.round(x * 100) / 100).toFixed(2);

/** One locator cache per store: the located point of a row by ref, for the revision it was read at. */
const locatorCache = new WeakMap<CatalogueStore, { revision: string; byRef: Map<string, LocatedPoint | null> }>();

export function createPlanService(deps: PlanServiceDeps): PlanService {
  const { store, reference } = deps;

  /** A public reference to its point, in memory only. Null when no public file knows it. */
  async function resolveOrigin(o: PlanOrigin): Promise<PlanPoint | null> {
    if (o.kind === 'hub') return reference.hub(o.id);
    if (o.kind === 'airport') return reference.airport(o.iata);
    return townPoint(o.id);
  }

  /**
   * A town's public gazetteer point (store.ts A33), through `near(city=)`'s centre (N2, A41): `towns({city})` lists the towns AROUND a
   * town and leaves the town itself out, so it cannot name it. One row is asked for, at the smallest radius; the rows are not read.
   * The country is the town id's first segment (`ca-ab-canmore`, apiTownId).
   */
  async function townPoint(id: string): Promise<PlanPoint | null> {
    const n = await store.near({ city: id, r: 1 }, { page: 1, pageSize: 1 });
    if (!n.ok || n.data.centre.kind !== 'town' || n.data.centre.lat === null || n.data.centre.lon === null) return null;
    return { lat: n.data.centre.lat, lon: n.data.centre.lon, cc: id.slice(0, 2).toUpperCase() };
  }

  // ---- where a row is (RB-003) ------------------------------------------------------------------------------------------------
  // The candidates and the build read ONE ladder (core/src/plan/candidates.ts `locateRow`), over facts read here from the public store:
  // a town row's gazetteer town, a place's car park or trailhead, the record a part belongs to. Nothing here reads the visitor's start.

  /**
   * The gazetteer town a town row is (core `matchTown`): among the towns around its pin (measured from the row itself when its point is
   * exact, else from the exact place nearest the pin), else by name in its region and the regions grouped with it (a South Tyrol row's
   * towns sit under Trentino-Alto Adige in the gazetteer).
   */
  async function gazetteerTown(row: PlaceRow): Promise<{ id: string; point: EnginePoint } | null> {
    const of = (t: { id: string; lat: number; lon: number; cc: string; pop: number | null } | null) =>
      t ? { id: t.id, point: { lat: t.lat, lon: t.lon, cc: t.cc.toUpperCase(), population: t.pop } } : null;
    const pin = row.lat !== null && row.lon !== null ? { lat: row.lat, lon: row.lon } : null;
    if (pin) {
      const centre = exactRow(row) ? `place:${row.slug}` : await exactNeighbour(pin);
      if (centre) {
        const t = await store.towns({ near: centre, r: TOWN_MATCH.equalKm + TOWN_MATCH.pinNeighbourKm });
        const hit = t.ok ? matchTown(row, t.data.items) : null;
        if (hit) return of(hit);
      }
    }
    const first = row.name.split(/[\s,]+/)[0] ?? '';
    if (!first) return null;
    const siblings = reference.groups(row.country).filter((g) => g.regions.includes(row.region)).flatMap((g) => g.regions);
    for (const region of [...new Set([row.region, ...siblings].filter(Boolean))]) {
      const t = await store.towns({ prefix: first.slice(0, 60), cc: row.country.toLowerCase(), region });
      const hit = t.ok ? matchTown(row, t.data.items) : null;
      if (hit) return of(hit);
    }
    return null;
  }

  /** `place:<slug>` of the exact-point place nearest a pin (within TOWN_MATCH.pinNeighbourKm), the centre a `towns` query can take; null: none. */
  async function exactNeighbour(pin: { lat: number; lon: number }): Promise<string | null> {
    const n = await store.near({ near: `point:${point2(pin.lat)},${point2(pin.lon)}`, r: TOWN_MATCH.pinNeighbourKm }, { page: 1, pageSize: 1 });
    const first = n.ok ? n.data.items[0] : undefined;
    return first ? `place:${first.slug}` : null;
  }

  /** The place's own access point from its detail: the first car park, else the trailhead; exact points only. */
  async function accessPoint(row: PlaceRow): Promise<EnginePoint | null> {
    const d = await store.getPlace(row.slug);
    if (!d.ok || 'moved' in d.data) return null;
    const a = d.data.access;
    const p = [...(a?.parking ?? []), ...(a?.trailhead ? [a.trailhead] : [])].find((x) => !x.approx && Number.isFinite(x.lat) && Number.isFinite(x.lon));
    return p ? { lat: p.lat, lon: p.lon, cc: row.country || null } : null;
  }

  /** The rows of some refs, by ref (current refs only: a part's parent is a `place/<slug>` ref). */
  async function rowsByRef(refs: readonly string[]): Promise<Map<string, PlaceRow>> {
    const out = new Map<string, PlaceRow>();
    if (!refs.length) return out;
    const asked = await store.resolveRefs({ refs: [...refs] });
    if (!asked.ok) return out;
    const slugOf = new Map<string, string>();
    for (const r of asked.data.items) if ((r.state === 'current' || r.state === 'moved' || r.state === 'merged') && r.slug) slugOf.set(String(r.asked), r.slug);
    if (!slugOf.size) return out;
    const list = await store.listPlaces({ ids: [...new Set(slugOf.values())] }, { page: 1, pageSize: API_LIMITS.pageSize.max });
    if (!list.ok) return out;
    const bySlug = new Map(list.data.items.map((r) => [r.slug, r]));
    for (const [ref, slug] of slugOf) {
      const row = bySlug.get(slug);
      if (row) out.set(ref, row);
    }
    return out;
  }

  /** What the ladder needs for one row, read from the store (none for an exact non-town row). */
  async function hintsFor(row: PlaceRow, depth = 0): Promise<LocateHints> {
    if (row.kind === 'town') {
      const town = await gazetteerTown(row);
      if (town || exactRow(row)) return { town };
    }
    if (exactRow(row)) return {};
    // the record's own OpenStreetMap or Wikidata point, by the place-page join's rule, when the page holds it back for size (join-deferred)
    // (the sidecars key a record by its dated folder: the public ref is turned back in memory only, never served)
    const own = recordPoint(travelRoot(), privateRef(row.ref, folderAliases()));
    if (own) return { record: { lat: own.lat, lon: own.lon, cc: row.country || null } };
    const access = await accessPoint(row);
    if (access) return { access };
    if (depth > 0) return {};
    // a part with no point is where the record it is part of is (a lake's walk); an activity with no point is at its own `#place` part
    const parentRef = partParent(row.ref);
    const linked = parentRef ?? `part/${row.ref}#place`;
    const other = (await rowsByRef([linked])).get(linked);
    return other ? { parent: locateRow(other, await hintsFor(other, depth + 1)) } : {};
  }

  /** The located point of each row, by ref (null: no location yet), cached per store revision. */
  async function locateRows(rows: readonly PlaceRow[]): Promise<Map<string, LocatedPoint | null>> {
    const revision = await store.revision();
    let cache = locatorCache.get(store);
    if (!cache || cache.revision !== revision || cache.byRef.size > LOCATED_CAP) locatorCache.set(store, (cache = { revision, byRef: new Map() }));
    const out = new Map<string, LocatedPoint | null>();
    for (const row of rows) {
      if (out.has(row.ref)) continue;
      // the common case reads nothing: an exact point that is not a town
      if (row.kind !== 'town' && exactRow(row)) {
        out.set(row.ref, locateRow(row));
        continue;
      }
      if (!cache.byRef.has(row.ref)) cache.byRef.set(row.ref, locateRow(row, await hintsFor(row)));
      out.set(row.ref, cache.byRef.get(row.ref)!);
    }
    return out;
  }

  /** Region ids (`CC/slug` or a group `cc-id`) as `CC/slug` ids; null names the first id that is a group nobody defines. */
  function expand(ids: readonly string[]): { ids: string[] } | { unknown: string } {
    const out: string[] = [];
    for (const id of ids) {
      if (slugOfRegion(id)) {
        out.push(id);
        continue;
      }
      const cc = id.slice(0, 2).toUpperCase();
      const g = reference.groups(cc).find((x) => x.id === id);
      if (!g || g.regions.length === 0) return { unknown: id };
      for (const slug of g.regions) out.push(`${cc}/${slug}`);
    }
    return { ids: [...new Set(out)] };
  }

  async function regions(cc: string): Promise<PlanResult<PlanRegions>> {
    const c = await store.countPlaces({ facets: { country: [cc] } });
    if (!c.ok) return err(c.error.code, c.error.message, c.error.details);
    if (c.data.n === 0) return err('not_found', 'No researched places in this country yet.');
    const first = await store.listPlaces({ facets: { country: [cc] } }, { page: 1, pageSize: 1 });
    const name = first.ok && first.data.items[0] ? first.data.items[0].country_name : cc;
    const bySlug = new Map((c.data.facets.region ?? []).map((r) => [r.value, r]));
    const regionOf = (slug: string) => ({ id: `${cc}/${slug}`, name: bySlug.get(slug)?.label ?? slug, count: bySlug.get(slug)?.count ?? 0 });
    const grouped = new Set<string>();
    const groups: PlanRegionGroup[] = reference.groups(cc).flatMap((g) => {
      const present = g.regions.filter((s) => bySlug.has(s));
      if (present.length === 0) return [];
      present.forEach((s) => grouped.add(s));
      const members = present.map(regionOf);
      const count = members.reduce((n, r) => n + r.count, 0);
      return [{ id: g.id, name: g.name, count, offered: count >= PLAN_GROUP_MIN_PLACES, regions: members }];
    });
    const ungrouped = [...bySlug.keys()].filter((s) => !grouped.has(s)).map(regionOf);
    const data: PlanRegions = { cc, name, groups, ungrouped, total: c.data.n };
    const parsed = planRegions.safeParse(data);
    return parsed.success ? ok(parsed.data, await store.revision()) : err('internal', 'The answer could not be built.');
  }

  async function candidates(q0: PlanCandidatesQuery): Promise<PlanResult<PlanCandidatePage>> {
    let q = q0;
    // region groups become region ids before anything is measured
    if (q.regions?.length) {
      const ex = expand(q.regions);
      if ('unknown' in ex) return err('invalid_scope', 'That region group is not offered.', { regions: [ex.unknown] });
      q = { ...q, regions: ex.ids };
    }
    // the centre: a pick's point for `near`, the start's public point in near mode, else the rows' own centre
    let centre: EnginePoint | null = null;
    if (q.near) {
      const p = await store.listPlaces({ ids: [q.near] }, { page: 1, pageSize: 1 });
      if (!p.ok) return err(p.error.code, p.error.message, p.error.details);
      const row = p.data.items[0];
      if (!row) return err('not_found', 'No such place.');
      centre = (await locateRows([row])).get(row.ref)?.point ?? null;
    } else if (q.mode === 'near') {
      const s = await resolveOrigin(q.start);
      if (!s) return err('not_available', 'That start is not in our public list yet.');
      centre = toEnginePoint(s);
    }
    const rows = await gatherCandidateRows(store, q, { centre });
    if (!rows.ok) return err(rows.error.code, rows.error.message, rows.error.details);
    const located = await locateRows(rows.data);
    const ranked = rankCandidates(rows.data, q, { centre, drive: deps.drive(), locate: (r) => located.get(r.ref) ?? null });
    if (!ranked.ok) return err(ranked.code, ranked.message, ranked.max !== undefined ? { max: ranked.max } : undefined);
    const parsed = planCandidatePage.safeParse(ranked.data);
    if (!parsed.success) return err('internal', 'The answer could not be built.');
    return ok(parsed.data, rows.revision || (await store.revision()));
  }

  /**
   * The picks' places by the ref the body named, each at the point the candidates offered it at (the same ladder, RB-003), with the
   * detail's trail figures where the row has none; and the picked towns as base candidates (FLOW stage 3: a town is a place to stay).
   */
  async function picksPlaces(refs: readonly string[]): Promise<{ places: Map<string, EnginePlace>; pickedTowns: Map<string, EngineTown> }> {
    const places = new Map<string, EnginePlace>();
    const pickedTowns = new Map<string, EngineTown>();
    const rows = await rowsByRef(refs);
    const located = await locateRows([...rows.values()]);
    await Promise.all(
      [...rows].map(async ([askedRef, row]) => {
        const extra: Partial<EnginePlace> = { ref: askedRef };
        if (row.km === null || row.gain_m === null) {
          const d = await store.getPlace(row.slug);
          if (d.ok && !('moved' in d.data)) {
            extra.distanceKm = row.km ?? d.data.stats.distanceKm;
            extra.gainM = row.gain_m ?? d.data.stats.gainM;
          }
        }
        const at = located.get(row.ref) ?? null;
        places.set(askedRef, placeAt(row, at, extra));
        if (at?.townId) pickedTowns.set(askedRef, { id: at.townId, name: row.name, point: at.point, population: at.point.population ?? null, lodging: null });
      }),
    );
    return { places, pickedTowns };
  }

  /** Candidate base towns: the towns around the first picks, the pinned and accepted bases, the largest first. */
  async function townsFor(b: PlanBuildInput, places: ReadonlyMap<string, EnginePlace>, pickedTowns: ReadonlyMap<string, EngineTown> = new Map()): Promise<EngineTown[]> {
    const found = new Map<string, EngineTown>();
    const add = (t: { id: string; name: string; lat: number; lon: number; pop: number | null; cc: string }) => {
      if (!found.has(t.id)) found.set(t.id, { id: t.id, name: t.name, point: { lat: t.lat, lon: t.lon, cc: t.cc.toUpperCase(), population: t.pop }, population: t.pop, lodging: null });
    };
    const radiusKm = Math.min(API_LIMITS.nearRadius.max, Math.round(dayTripRadiusMin(b) * 0.9));
    // a picked town is a candidate by its gazetteer point (and a pick right where the base would be)
    for (const t of pickedTowns.values()) if (!found.has(t.id)) found.set(t.id, t);
    // around the first picks the build can place, exact points first; a pick placed by its car park, its parent or a pin is measured from
    // the exact place nearest it (a `towns` centre is a named place or town, never a raw point)
    const rank = (p: EnginePlace) => (p.pointBasis === undefined || p.pointBasis === 'exact' ? 0 : p.pointBasis === 'town' ? 1 : 2);
    const around = [...places.values()].filter((p) => p.point).sort((a, c) => rank(a) - rank(c)).slice(0, TOWNS_PER_PICK_QUERY);
    for (const p of around) {
      const town = pickedTowns.get(p.ref);
      const centre = rank(p) === 0 ? { near: `place:${p.slug}` } : town ? { city: town.id } : await exactNeighbour(p.point!).then((c) => (c ? { near: c } : null));
      if (!centre) continue;
      const t = await store.towns({ ...centre, r: radiusKm });
      if (t.ok) t.data.items.forEach(add);
    }
    // A chosen base is a candidate by its own public point: `towns({city})` lists the towns AROUND a town and leaves the town out (same as
    // the town start, townPoint), so the point comes from `near({city})`'s centre. A town the gazetteer does not know is not a candidate and
    // the engine leaves that base out (resolveBases); the id is never echoed. The population stays as the around-picks query read it, else
    // null (the gazetteer's own figure is not on the centre; the engine uses it only to break ties).
    for (const base of b.bases) {
      if (found.has(base.town)) continue;
      const n = await store.near({ city: base.town, r: 1 }, { page: 1, pageSize: 1 });
      if (!n.ok || n.data.centre.kind !== 'town' || n.data.centre.lat === null || n.data.centre.lon === null) continue;
      add({ id: base.town, name: n.data.centre.name, lat: n.data.centre.lat, lon: n.data.centre.lon, pop: null, cc: base.town.slice(0, 2) });
    }
    const pinned = new Set(b.bases.map((x) => x.town));
    const picked = new Set([...pickedTowns.values()].map((t) => t.id));
    return [...found.values()]
      .sort(
        (a, c) =>
          Number(pinned.has(c.id)) - Number(pinned.has(a.id)) || Number(picked.has(c.id)) - Number(picked.has(a.id)) || (c.population ?? 0) - (a.population ?? 0) || a.id.localeCompare(c.id),
      )
      .slice(0, TOWNS_KEPT);
  }

  /** The leg-cache cells among the picks and the largest towns, as the engine's RoutedLegs (node ids `p:<ref>` and `t:<id>`). */
  async function routedLegs(b: PlanBuildInput, places: ReadonlyMap<string, EnginePlace>, towns: readonly EngineTown[]): Promise<RoutedLegs | undefined> {
    if (!deps.legs) return undefined;
    try {
      const nodes: { id: string; p: PublicDrivePoint }[] = [];
      for (const pl of places.values()) {
        if (!pl.point) continue;
        nodes.push({ id: placeNode(pl.ref), p: { key: aliasKey(pl.ref), lat: pl.point.lat, lon: pl.point.lon, cc: pl.point.cc } });
      }
      for (const t of towns.slice(0, ROUTED_TOWNS)) {
        const key = cellKey(t.point);
        if (key) nodes.push({ id: townNode(t.id), p: { key, lat: t.point.lat, lon: t.point.lon, cc: t.point.cc } });
      }
      if (nodes.length < 2) return undefined;
      const pts = nodes.map((n) => n.p);
      const res = await runLegBatch(deps.legs as LegService, pts, pts, { allowRouting: deps.allowRouting ?? false, ...(b.month ? { month: b.month } : {}) });
      const m = new Map<string, number>();
      res.cells.forEach((row, i) =>
        row.forEach((cell, j) => {
          if (i !== j && cell.confidence === 'routed' && cell.minutes !== null) m.set(routedKey(nodes[i]!.id, nodes[j]!.id), cell.minutes);
        }),
      );
      return m;
    } catch {
      // a leg-cache failure is never a build failure: the model's estimates stand, flagged
      return undefined;
    }
  }

  async function build(b: PlanBuildInput): Promise<PlanResult<PlanBuildAnswer>> {
    const rules = planBuildRules(b);
    const big = rules.tooLarge[0];
    if (big) return err('too_large', 'That is more than one build can take.', { path: big.path, max: big.max });
    if (rules.invalid.length) return err('invalid_input', 'The request does not match the contract.', { issues: rules.invalid.slice(0, 20) });
    const near = b.where.mode === 'near';
    // the start, in memory only
    let start: EnginePoint | null = null;
    if (b.where.mode === 'near') {
      const s = await resolveOrigin(b.where.start);
      if (!s) return err('not_available', 'That start is not in our public list yet.');
      start = toEnginePoint(s);
    }
    let gateway: EnginePoint | null = null;
    if (!near && b.origin) {
      const g = await resolveOrigin(b.origin);
      gateway = g ? toEnginePoint(g) : null;
    }
    const { places, pickedTowns } = await picksPlaces(b.picks.map((p) => p.ref));
    const towns = near && b.nights === 0 ? [] : await townsFor(b, places, pickedTowns);
    const routed = await routedLegs(b, places, towns);
    const first = [...places.values()].find((p) => p.point)?.point ?? start;
    const tz = (first && zoneNear(first.lat, first.lon)) || 'UTC';
    let built;
    try {
      built = buildPlan({ build: b, places, towns, start, gateway, tz, drive: deps.drive(), ...(routed ? { routed } : {}) });
    } catch {
      return err('internal', 'The plan could not be built.');
    }
    const mx = planMatrixRules(built.matrix);
    const answer = planBuildAnswer.safeParse({ ...built, builtAt: deps.now().toISOString() });
    if (mx.length || !answer.success) return err('internal', 'The plan could not be built.');
    return ok(answer.data, await store.revision());
  }

  async function starts(): Promise<PlanResult<PlanStarts>> {
    const parsed = planStarts.safeParse(reference.starts ? reference.starts() : { hubs: [], airports: [] });
    return parsed.success ? ok(parsed.data, await store.revision()) : err('internal', 'The answer could not be built.');
  }

  return { regions, starts, candidates, build };
}
