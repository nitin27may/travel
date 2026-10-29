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
import { gatherCandidateRows, rankCandidates } from '@travel/core/plan/candidates.ts';
import { routedKey, placeNode, townNode } from '@travel/core/plan/driveTable.ts';
import { buildPlan, dayTripRadiusMin } from '@travel/core/plan/engine.ts';
import type { EnginePlace, EnginePoint, EngineTown, RoutedLegs } from '@travel/core/plan/engineTypes.ts';
import { placeFromRow } from '@travel/core/plan/candidates.ts';
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
import { runLegBatch, type LegService } from './legs';

// PlanService (trip-builder.md 15.1 ISO-5; task TB-API): the builder's own server service. It reads the public CatalogueStore (and adds no method
// to it), the towns layer through that store, the leg cache through the TB-L leg service, and the public reference files for hubs, airports and
// region groups; it hands the pure engine (core/src/plan/engine.ts) what it read and returns the contract's shapes. The route handlers
// (web/app/api/v1/plan/**) do the HTTP: flag, origin, rate limit, validation, privacy. Nothing here knows a request.
//
// PRIVACY (trip-builder 7): the party arrives in `build()`'s body only and goes straight to the engine; it is never kept, logged or echoed. A
// near-mode start is a REFERENCE (hub, airport, town) that this service resolves to a public point and uses in memory: that point is never a
// leg-cache key (the visitor-start rule of core/src/drive/keys.ts: the engine routes the start as its own node, never looked up), never logged
// and never returned. Candidates carry no party at all (a band at most), so they are cacheable for everyone.
//
// Routing: builds read `leg_cache` only (`allowRouting: false`), so a build never spends the OpenRouteService day budget; an uncached cell is the
// drive model's estimate, flagged (the engine's basis `estimate` or `mixed`). Turning routing on for builds is one deps field (TB-W1 decides).
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
      centre = placeFromRow(row).point;
    } else if (q.mode === 'near') {
      const s = await resolveOrigin(q.start);
      if (!s) return err('not_available', 'That start is not in our public list yet.');
      centre = toEnginePoint(s);
    }
    const rows = await gatherCandidateRows(store, q, { centre });
    if (!rows.ok) return err(rows.error.code, rows.error.message, rows.error.details);
    const ranked = rankCandidates(rows.data, q, { centre, drive: deps.drive() });
    if (!ranked.ok) return err(ranked.code, ranked.message, ranked.max !== undefined ? { max: ranked.max } : undefined);
    const parsed = planCandidatePage.safeParse(ranked.data);
    if (!parsed.success) return err('internal', 'The answer could not be built.');
    return ok(parsed.data, rows.revision || (await store.revision()));
  }

  /** The picks' rows by the ref the body named, with the detail's trail figures where the row has none. */
  async function picksPlaces(refs: readonly string[]): Promise<Map<string, EnginePlace>> {
    const out = new Map<string, EnginePlace>();
    const asked = await store.resolveRefs({ refs: [...refs] });
    if (!asked.ok) return out;
    const slugs = new Map<string, string>();
    asked.data.items.forEach((r) => {
      if ((r.state === 'current' || r.state === 'moved' || r.state === 'merged') && r.slug) slugs.set(String(r.asked), r.slug);
    });
    if (slugs.size === 0) return out;
    const list = await store.listPlaces({ ids: [...new Set(slugs.values())] }, { page: 1, pageSize: API_LIMITS.pageSize.max });
    if (!list.ok) return out;
    const bySlug = new Map<string, PlaceRow>(list.data.items.map((r) => [r.slug, r]));
    await Promise.all(
      [...slugs].map(async ([askedRef, slug]) => {
        const row = bySlug.get(slug);
        if (!row) return;
        const extra: Partial<EnginePlace> = { ref: askedRef };
        if (row.km === null || row.gain_m === null) {
          const d = await store.getPlace(slug);
          if (d.ok && !('moved' in d.data)) {
            extra.distanceKm = row.km ?? d.data.stats.distanceKm;
            extra.gainM = row.gain_m ?? d.data.stats.gainM;
          }
        }
        out.set(askedRef, placeFromRow(row, extra));
      }),
    );
    return out;
  }

  /** Candidate base towns: the towns around the first picks, the pinned and accepted bases, the largest first. */
  async function townsFor(b: PlanBuildInput, places: ReadonlyMap<string, EnginePlace>): Promise<EngineTown[]> {
    const found = new Map<string, EngineTown>();
    const add = (t: { id: string; name: string; lat: number; lon: number; pop: number | null; cc: string }) => {
      if (!found.has(t.id)) found.set(t.id, { id: t.id, name: t.name, point: { lat: t.lat, lon: t.lon, cc: t.cc.toUpperCase(), population: t.pop }, population: t.pop, lodging: null });
    };
    const radiusKm = Math.min(API_LIMITS.nearRadius.max, Math.round(dayTripRadiusMin(b) * 0.9));
    const around = [...places.values()].filter((p) => p.point).slice(0, TOWNS_PER_PICK_QUERY);
    for (const p of around) {
      const t = await store.towns({ near: `place:${p.slug}`, r: radiusKm });
      if (t.ok) t.data.items.forEach(add);
    }
    for (const base of b.bases) {
      const t = await store.towns({ city: base.town, r: 1 });
      if (t.ok) t.data.items.filter((x) => x.id === base.town).forEach(add);
    }
    const pinned = new Set(b.bases.map((x) => x.town));
    return [...found.values()]
      .sort((a, c) => Number(pinned.has(c.id)) - Number(pinned.has(a.id)) || (c.population ?? 0) - (a.population ?? 0) || a.id.localeCompare(c.id))
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
    const places = await picksPlaces(b.picks.map((p) => p.ref));
    const towns = near && b.nights === 0 ? [] : await townsFor(b, places);
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
