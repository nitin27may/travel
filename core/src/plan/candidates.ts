// Candidates for the trip builder (trip-builder.md 4.3, 4.12; FLOW stages 3 and 4, TF6, S9; task TB-E1): where the rows come from
// (the region lists or the drive band, and `CatalogueStore.near` around a pick), and how a page is ranked. The ranking is pure; the
// gathering reads a store and nothing else (P9: one data boundary, server side only, bounded by BUILDER_SCAN).
//
// Rules: trip mode lists the chosen regions of one country, measured from their centroid; near mode lists the reach around the start
// (a box first, then the drive model keeps what is within the one-way limit), narrowed by travel regions when chosen; `near` lists the
// surroundings of one pick, measured from it; when that pick is an area (a park or a zone, TB-PIN), its members only (the `within`
// closure a row carries through `enrich`, else the area's fallback radius, area.ts). Rows scoring removes ("Not for your party", "Closed in July") are their own lists, never
// the default one, so suggestions obey fit and month (S9). A pick's strip never shows breadth-only records (`researched: false`, QB9).
// RB-003: a row is offered only when the build can place it (`locateRow`, the same ladder the build reads through the service); the rest
// are counted in `removed.no_location`, never shown with Pick.
import { BUILDER_BADGES, BUILDER_DURATION_BAND_EDGES, BUILDER_SCAN, BUILDER_TIME_BAND_MIN } from "../config/builder.ts";
import { RADIUS_CAP } from "../config/nearby.ts";
import type { DriveIndex } from "../drive/model.ts";
import { bboxOf, haversineKm } from "../geo/distance.ts";
import type { CatalogueStore } from "../catalogue/store.ts";
import { readSuitability } from "../schedule/suitability.ts";
import type { Profile } from "../schedule/types.ts";
import type { PlaceRow, Result } from "../schema/api/index.ts";
import { PLAN_LIMITS, type PlanCandidatePage, type PlanCandidateRow, type PlanCandidatesQuery, type PlanPointBasis } from "../schema/api/plan.ts";
import { PLACE_ROW_KEYS } from "../schema/api/place.ts";
import { START, driveTable, placeNode } from "./driveTable.ts";
import type { EnginePlace, EnginePoint, RoutedLegs } from "./engineTypes.ts";
import { inArea, isAreaPlace } from "./area.ts";
import { visitMinOf } from "./engine.ts";
import { byScore, profileOfBand, scorePlace } from "./score.ts";

/** An EnginePlace from a Places row, with any richer facts a source has (a suitability block, a data duration). */
export function placeFromRow(row: PlaceRow, extra: Partial<EnginePlace> = {}): EnginePlace {
  const hasPoint = row.lat !== null && row.lon !== null && !row.approx;
  const minAge = row.kids_from;
  return {
    ref: row.ref,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    type: row.type,
    tags: row.tags.map((t) => t.id),
    point: hasPoint ? { lat: row.lat!, lon: row.lon!, cc: row.country || null } : null,
    region: row.region || null,
    country: row.country || null,
    season: [...row.season],
    draw: row.badge ? BUILDER_BADGES[row.badge] ?? null : null,
    complete: row.completeness.level !== "draft",
    suitability: minAge !== null ? readSuitability({ minAge, rule: row.kids_basis === "advice" ? "advice" : row.kids_basis === "rule" ? "hard" : null, provenance: "row" }) : null,
    visitMin: row.time_band ? BUILDER_TIME_BAND_MIN[row.time_band] ?? null : null,
    visitRange: null,
    distanceKm: row.km,
    gainM: row.gain_m,
    needsDaylight: row.kind === "trail",
    ...extra,
  };
}

/** A point the service located for a row (RB-003), with where it came from; a town row also names its towns-layer town. */
export interface LocatedPoint {
  point: EnginePoint;
  basis: PlanPointBasis;
  /** the gazetteer town id of a town row (basis `town`) */
  townId?: string | null;
}

/** What the service read about a row that has no exact point of its own (each from the public store; never the visitor's start). */
export interface LocateHints {
  /** a town row's towns-layer town (the public gazetteer point, and the id a base writes) */
  town?: { id: string; point: EnginePoint } | null;
  /** the record's own public point (its OpenStreetMap element or Wikidata P625) that its page holds back for size; basis `exact` */
  record?: EnginePoint | null;
  /** the place's own exact access point (car park, else trailhead), licensed and never approximate */
  access?: EnginePoint | null;
  /** the located point of the record a part belongs to (`part/place/<x>#walk` is at `place/<x>`), or of a record's own `#place` part */
  parent?: LocatedPoint | null;
}

/**
 * The ONE ladder that says where the build places a row (RB-003, PLAN_POINT_BASES order): a town row at its gazetteer town; the row's exact
 * point, else the record's own public point the page holds back; the place's car park or trailhead; the record a part belongs to. Never an
 * approximate pin (T5: an approximate point never counts for a distance). Null: no location yet. The candidates
 * and the build both read this, so a row offered with Pick is a row the engine can place.
 */
export function locateRow(row: Pick<PlaceRow, "kind" | "lat" | "lon" | "approx" | "country">, hints: LocateHints = {}): LocatedPoint | null {
  const cc = row.country || null;
  if (row.kind === "town" && hints.town) return { point: { ...hints.town.point, cc: hints.town.point.cc ?? cc }, basis: "town", townId: hints.town.id };
  if (row.lat !== null && row.lon !== null && !row.approx) return { point: { lat: row.lat, lon: row.lon, cc }, basis: "exact" };
  if (hints.record) return { point: { ...hints.record, cc: hints.record.cc ?? cc }, basis: "exact" };
  if (hints.access) return { point: { ...hints.access, cc: hints.access.cc ?? cc }, basis: "access" };
  if (hints.parent) return { point: hints.parent.point, basis: "part_of" };
  return null;
}

/**
 * How sure a name match of a town row to a gazetteer town must be: an equal name within `equalKm` of the row's pin; one name the other's
 * first words ("Selva" for "Selva di Val Gardena", "Santa Cristina Valgardena" for "Santa Cristina") within `wordPrefixKm`; one name the
 * other's first letters ("La Val" for "La Valle - Wengen", at least `prefixMinChars`) within `prefixKm`. Without a pin only an equal name
 * that is the only one counts. `pinNeighbourKm`: how far around a pin the service looks for an exact place to list towns from (a pin is
 * not a `towns` centre).
 */
export const TOWN_MATCH = { equalKm: 30, wordPrefixKm: 8, prefixKm: 4, prefixMinChars: 5, pinNeighbourKm: 25 } as const;

/** The gazetteer town a town row names (RB-003), by the TOWN_MATCH tiers, nearest first; null when none is sure enough. */
export function matchTown<T extends { id: string; name: string; lat: number; lon: number; cc: string }>(
  row: { name: string; country: string; lat: number | null; lon: number | null },
  towns: readonly T[],
): T | null {
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const want = fold(row.name);
  if (!want) return null;
  const cc = row.country.toLowerCase();
  const pin = row.lat !== null && row.lon !== null ? { lat: row.lat, lon: row.lon } : null;
  const mine = towns.filter((t) => t.cc.toLowerCase() === cc);
  const tier = (t: T): number | null => {
    const n = fold(t.name);
    if (n === want) return 0;
    if (n.startsWith(`${want}-`) || want.startsWith(`${n}-`)) return 1;
    if (Math.min(n.length, want.length) >= TOWN_MATCH.prefixMinChars && (n.startsWith(want) || want.startsWith(n))) return 2;
    return null;
  };
  const reach = [TOWN_MATCH.equalKm, TOWN_MATCH.wordPrefixKm, TOWN_MATCH.prefixKm] as const;
  if (!pin) {
    const equal = mine.filter((t) => tier(t) === 0);
    return equal.length === 1 ? equal[0]! : null;
  }
  const scored = mine.flatMap((t) => {
    const k = tier(t);
    if (k === null) return [];
    const km = haversineKm(pin, t);
    return km <= reach[k]! ? [{ t, k, km }] : [];
  });
  scored.sort((a, b) => a.k - b.k || a.km - b.km || (a.t.id < b.t.id ? -1 : 1));
  return scored[0]?.t ?? null;
}

/** An EnginePlace whose point is the located one (RB-003): the same place the candidates ranked, so the build can place what was offered. */
export function placeAt(row: PlaceRow, at: LocatedPoint | null, extra: Partial<EnginePlace> = {}): EnginePlace {
  return placeFromRow(row, { ...extra, ...(at ? { point: at.point, pointBasis: at.basis } : { point: null }) });
}

/** True when the build can place a place: it has a point, or it is an area (a park, a zone) the build pins and fills with its members. */
export const isPlaceable = (p: Pick<EnginePlace, "point" | "kind" | "type" | "visitMin" | "visitRange">): boolean => p.point !== null || isAreaPlace(p);

/** The candidate list's duration band of a visit length. */
export function durationBandOf(min: number | null): PlanCandidateRow["durationBand"] {
  if (min === null) return null;
  for (const e of BUILDER_DURATION_BAND_EDGES) if (min < e.underMin) return e.band;
  return "full_day";
}

/** The interests a query names: the Places facet values that say what to see (kind, narrowed kind, tag, style). */
export function interestsOf(q: Pick<PlanCandidatesQuery, "facets">): string[] {
  const f = q.facets ?? {};
  return [...new Set(["kind", "k", "tag", "style"].flatMap((k) => f[k] ?? []))].sort();
}

/** True when a row lies in a chosen region: `CC/<code or slug>` against the row's country and region (aliases included). */
export function inRegion(row: Pick<PlaceRow, "country" | "region" | "regionAliases">, id: string): boolean {
  const m = /^([A-Z]{2})\/(.+)$/.exec(id);
  if (!m) return true; // a region group: the service expands it before the query (TB-RG); trust the store's scope
  if (row.country !== m[1]) return false;
  const code = m[2]!.toLowerCase();
  return row.region.toLowerCase() === code || row.regionAliases.some((a) => a.toLowerCase() === code);
}

export interface CandidateContext {
  /** the start (near mode, resolved from `start`), the pick's point (`near`), or the region centroid; null: the centroid of the rows */
  centre: EnginePoint | null;
  drive: DriveIndex;
  routed?: RoutedLegs;
  /** a richer place for a row (suitability, data duration), when the service has one */
  enrich?: (row: PlaceRow) => Partial<EnginePlace> | null;
  /**
   * Where the build places a row (RB-003): the service's `locateRow` over what it read from the store. Absent: the row's exact point only.
   * A row this answers null for (and that is not an area) is never offered; it is counted in `removed.no_location`.
   */
  locate?: (row: PlaceRow) => LocatedPoint | null;
  pace?: Profile["pace"];
}

export type CandidateAnswer = { ok: true; data: PlanCandidatePage } | { ok: false; code: "too_large" | "invalid_input"; max?: number; message: string };

const centroid = (ps: readonly EnginePoint[]): EnginePoint | null => {
  if (!ps.length) return null;
  const lat = ps.reduce((n, p) => n + p.lat, 0) / ps.length;
  const lon = ps.reduce((n, p) => n + p.lon, 0) / ps.length;
  const ccs = [...new Set(ps.map((p) => p.cc))];
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, cc: ccs.length === 1 ? ccs[0]! : null };
};

const rowOnly = (r: PlaceRow): PlaceRow => Object.fromEntries(PLACE_ROW_KEYS.map((k) => [k, r[k]])) as PlaceRow;

/** One page of ranked candidates (4.3): scored, split into the default list and the two removed lists, sorted by score, name, ref. */
export function rankCandidates(rows: readonly PlaceRow[], q: PlanCandidatesQuery, ctx: CandidateContext): CandidateAnswer {
  const pageSize = q.pageSize ?? PLAN_LIMITS.candidatePage.default;
  if (pageSize > PLAN_LIMITS.candidatePage.max) return { ok: false, code: "too_large", max: PLAN_LIMITS.candidatePage.max, message: `A page holds at most ${PLAN_LIMITS.candidatePage.max} candidates.` };
  const profile = profileOfBand(q.party, ctx.pace);
  const interests = interestsOf(q);
  const seen = new Set<string>();
  let scoped = [...rows].filter((r) => (seen.has(r.ref) ? false : (seen.add(r.ref), true)));
  const regions = q.regions;
  if (regions?.length) scoped = scoped.filter((r) => regions.some((id) => inRegion(r, id)));
  if (q.mode === "trip") scoped = scoped.filter((r) => r.country === q.cc);
  if (q.near) scoped = scoped.filter((r) => r.slug !== q.near && r.researched);
  const locate = ctx.locate ?? ((r: PlaceRow) => locateRow(r));
  const located = new Map<string, LocatedPoint | null>();
  const at = (r: PlaceRow): LocatedPoint | null => {
    if (!located.has(r.ref)) located.set(r.ref, locate(r));
    return located.get(r.ref)!;
  };
  let places = scoped.map((r) => ({ row: r, place: placeAt(r, at(r), ctx.enrich?.(r) ?? {}) }));
  const nearRow = q.near ? rows.find((r) => r.slug === q.near) : undefined;
  // a pick that is an area lists what lies inside it (TB-PIN, R1: Discover pre-filtered to its `within` closure)
  const nearArea = nearRow ? placeAt(nearRow, at(nearRow), ctx.enrich?.(nearRow) ?? {}) : null;
  if (nearArea && isAreaPlace(nearArea)) places = places.filter((p) => inArea(p.place, nearArea));
  const centre = ctx.centre ?? nearArea?.point ?? centroid(places.flatMap((p) => (p.place.point ? [p.place.point] : [])));
  const points = new Map<string, EnginePoint>(places.flatMap((p) => (p.place.point ? [[placeNode(p.place.ref), p.place.point] as [string, EnginePoint]] : [])));
  if (centre) points.set(START, centre);
  const table = driveTable(points, ctx.drive, q.month ?? null, ctx.routed);

  const scored: (PlanCandidateRow & { list: "main" | "not_for_party" | "closed" })[] = [];
  let noLocation = 0;
  for (const { row, place } of places) {
    // RB-003: a row the build cannot place is never offered with Pick; near reach mode cannot even say it is in reach, so it is not counted
    if (!isPlaceable(place)) {
      if (q.mode === "trip" || q.near) noLocation++;
      continue;
    }
    const cell = centre && place.point ? table.get(START, placeNode(place.ref)) : null;
    const driveMin = cell?.min ?? null;
    // near mode: the reach is the one-way limit; a row beyond it, or with no point to measure, is not a candidate at all
    if (q.mode === "near" && !q.near && (driveMin === null || driveMin > q.driveLimitMin)) continue;
    const s = scorePlace(place, { profile, month: q.month ?? null, interests, driveMin });
    const visitMin = Math.min(1440, visitMinOf(place, profile));
    scored.push({
      ...rowOnly(row),
      score: s.score,
      visitMin,
      durationBand: durationBandOf(visitMin),
      driveMin,
      driveBasis: cell && cell.min !== null ? (cell.routed ? "routed" : "estimate") : null,
      fit: s.fit,
      seasonState: s.seasonState,
      why: s.why,
      placeable: true,
      pointBasis: place.point ? (place.pointBasis ?? "exact") : null,
      townId: at(row)?.townId ?? null,
      list: s.list,
    });
  }
  const list = q.list ?? "main";
  const chosen = scored.filter((r) => r.list === list).sort(byScore);
  const limit = q.limit ?? Number.POSITIVE_INFINITY;
  const page = q.page ?? 1;
  const cut = chosen.slice((page - 1) * pageSize, page * pageSize).slice(0, limit);
  const total = Math.min(chosen.length, q.limit ?? chosen.length);
  const hasNext = q.limit === undefined && page * pageSize < chosen.length;
  return {
    ok: true,
    data: {
      items: cut.map(({ list: _l, ...r }) => r),
      total,
      page,
      pageSize,
      nextPage: hasNext ? page + 1 : null,
      list,
      removed: { not_for_party: scored.filter((r) => r.list === "not_for_party").length, closed: scored.filter((r) => r.list === "closed").length, no_location: noLocation },
    },
  };
}

/** The store methods the gathering reads. */
export type CandidateSource = Pick<CatalogueStore, "listPlaces" | "near">;

export interface GatherScope {
  /** near mode: the start's public point; `near`: the pick's point (else the store resolves the slug) */
  centre: EnginePoint | null;
  /** the region slugs of the chosen regions and groups (the service expands groups, TB-RG); absent: from `CC/<slug>` ids */
  regionSlugs?: readonly string[];
  /** km around a pick for `near` (clamped to the near API's cap) */
  nearKm?: number;
}

const slugsOf = (ids: readonly string[] | undefined): string[] => (ids ?? []).flatMap((id) => (/^[A-Z]{2}\/(.+)$/.exec(id)?.[1] ? [/^[A-Z]{2}\/(.+)$/.exec(id)![1]!] : []));

/**
 * The rows a candidates query ranks, read from the store: a pick's surroundings through `near`, a country's regions through
 * `listPlaces`, or the near-mode reach as a bounding box through `listPlaces`. At most BUILDER_SCAN.maxRows rows.
 */
export async function gatherCandidateRows(src: CandidateSource, q: PlanCandidatesQuery, scope: GatherScope): Promise<Result<PlaceRow[]>> {
  const out: PlaceRow[] = [];
  const pageSize = BUILDER_SCAN.pageSize;
  if (q.near) {
    const r = Math.min(RADIUS_CAP, scope.nearKm ?? RADIUS_CAP);
    for (let page = 1; out.length < BUILDER_SCAN.maxRows; page++) {
      const res = await src.near({ near: `place:${q.near}`, r }, { page, pageSize });
      if (!res.ok) return res;
      out.push(...res.data.items.map((x) => rowOnly(x as unknown as PlaceRow)));
      if (res.data.nextPage === null) break;
    }
    return { ok: true, data: out.slice(0, BUILDER_SCAN.maxRows), revision: "" };
  }
  const regions = scope.regionSlugs ? [...scope.regionSlugs] : slugsOf(q.regions);
  const facets: Record<string, string[]> = {};
  if (q.mode === "trip") facets.country = [q.cc];
  if (regions.length) facets.region = regions;
  const query =
    q.mode === "near" && scope.centre
      ? (() => {
          const km = (q.driveLimitMin / 60) * BUILDER_SCAN.reachKmPerHour;
          const box = bboxOf(scope.centre, km);
          return { facets, bbox: [box.west, box.south, box.east, box.north] as [number, number, number, number] };
        })()
      : { facets };
  let revision = "";
  for (let page = 1; out.length < BUILDER_SCAN.maxRows; page++) {
    const res = await src.listPlaces(query, { page, pageSize });
    if (!res.ok) return res;
    revision = res.revision;
    out.push(...res.data.items);
    if (res.data.nextPage === null) break;
  }
  return { ok: true, data: out.slice(0, BUILDER_SCAN.maxRows), revision };
}
