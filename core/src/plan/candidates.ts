// Candidates for the trip builder (trip-builder.md 4.3, 4.12; FLOW stages 3 and 4, TF6, S9; task TB-E1): where the rows come from
// (the region lists or the drive band, and `CatalogueStore.near` around a pick), and how a page is ranked. The ranking is pure; the
// gathering reads a store and nothing else (P9: one data boundary, server side only, bounded by BUILDER_SCAN).
//
// Rules: trip mode lists the chosen regions of one country, measured from their centroid; near mode lists the reach around the start
// (a box first, then the drive model keeps what is within the one-way limit), narrowed by travel regions when chosen; `near` lists the
// surroundings of one pick, measured from it; when that pick is an area (a park or a zone, TB-PIN), its members only (the `within`
// closure a row carries through `enrich`, else the area's fallback radius, area.ts). Rows scoring removes ("Not for your party", "Closed in July") are their own lists, never
// the default one, so suggestions obey fit and month (S9). A pick's strip never shows breadth-only records (`researched: false`, QB9).
import { BUILDER_BADGES, BUILDER_DURATION_BAND_EDGES, BUILDER_SCAN, BUILDER_TIME_BAND_MIN } from "../config/builder.ts";
import { RADIUS_CAP } from "../config/nearby.ts";
import type { DriveIndex } from "../drive/model.ts";
import { bboxOf } from "../geo/distance.ts";
import type { CatalogueStore } from "../catalogue/store.ts";
import { readSuitability } from "../schedule/suitability.ts";
import type { Profile } from "../schedule/types.ts";
import type { PlaceRow, Result } from "../schema/api/index.ts";
import { PLAN_LIMITS, type PlanCandidatePage, type PlanCandidateRow, type PlanCandidatesQuery } from "../schema/api/plan.ts";
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
  let places = scoped.map((r) => ({ row: r, place: placeFromRow(r, ctx.enrich?.(r) ?? {}) }));
  const nearRow = q.near ? rows.find((r) => r.slug === q.near) : undefined;
  // a pick that is an area lists what lies inside it (TB-PIN, R1: Discover pre-filtered to its `within` closure)
  const nearArea = nearRow ? placeFromRow(nearRow, ctx.enrich?.(nearRow) ?? {}) : null;
  if (nearArea && isAreaPlace(nearArea)) places = places.filter((p) => inArea(p.place, nearArea));
  const centre = ctx.centre ?? (nearRow ? placeFromRow(nearRow).point : null) ?? centroid(places.flatMap((p) => (p.place.point ? [p.place.point] : [])));
  const points = new Map<string, EnginePoint>(places.flatMap((p) => (p.place.point ? [[placeNode(p.place.ref), p.place.point] as [string, EnginePoint]] : [])));
  if (centre) points.set(START, centre);
  const table = driveTable(points, ctx.drive, q.month ?? null, ctx.routed);

  const scored: (PlanCandidateRow & { list: "main" | "not_for_party" | "closed" })[] = [];
  for (const { row, place } of places) {
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
      removed: { not_for_party: scored.filter((r) => r.list === "not_for_party").length, closed: scored.filter((r) => r.list === "closed").length },
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
