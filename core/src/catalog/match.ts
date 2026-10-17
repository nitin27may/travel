// Step 3 of the flywheel (plan 0A.2): is this record a row we already have? In order: exact id; external ids (wikidata,
// OSM relation, operator book_url host plus path); coordinates plus a trigram name similarity (places, stays, eateries);
// trailhead plus name (trails); provider plus product name (offers). At least 0.85 is "same entity"; from 0.6 up to 0.85
// is a "possible duplicate", which always goes to review. A row without coordinates matches only by id or external id.
import { haversineM, hostOf, nameKey, similarity, urlKey } from "./common.ts";
import type { Entity, PlaceRef, Row } from "./common.ts";
import type { NormRecord } from "./normalise.ts";

/** The thresholds, in one place. Radii are metres. */
export const MATCH = {
  same_similarity: 0.85,
  possible_similarity: 0.6,
  /** within this distance and at least same_similarity: same entity */
  radius_m: { places: 300, stays: 300, eateries: 300, trails: 500 } as Record<string, number>,
  /** within this distance and at least possible_similarity: possible duplicate (always reviewed) */
  possible_radius_m: { places: 1000, stays: 1000, eateries: 1000, trails: 1500 } as Record<string, number>,
};

export type MatchKind = "same" | "possible" | "new";
export type MatchBy = "id" | "merged-id" | "wikidata" | "osm_relation" | "book_url" | "geo+name" | "provider+product" | "name";

export interface Candidate {
  id: string;
  by: MatchBy;
  similarity: number;
  distance_m: number | null;
  kind: "same" | "possible";
}

export interface MatchResult {
  kind: MatchKind;
  /** the row matched, for same and possible */
  id: string | null;
  by: MatchBy | null;
  similarity: number | null;
  distance_m: number | null;
  /** every candidate at or above the possible threshold, best first */
  candidates: Candidate[];
}

const NEW: MatchResult = { kind: "new", id: null, by: null, similarity: null, distance_m: null, candidates: [] };

/** the lat/lon of a record or row; trails use the trailhead */
function point(row: Row): { lat: number; lon: number } | null {
  const lat = row.lat ?? row.trailhead_lat;
  const lon = row.lon ?? row.trailhead_lon;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
}

/** external ids a row carries: columns first, then field_meta.external for ids with no column */
export function externalIds(row: Row): { wikidata?: string; osm_relation?: string; book_urls: string[] } {
  const ext = row.field_meta?.external ?? {};
  const urls = [row.book_url, row.official_url, ...(ext.book_urls ?? [])].filter((u) => typeof u === "string").map(urlKey);
  return {
    wikidata: row.wikidata ?? ext.wikidata,
    osm_relation: row.geometry_source === "osm" && row.geometry_source_id ? String(row.geometry_source_id) : ext.osm_relation !== undefined ? String(ext.osm_relation) : undefined,
    book_urls: urls,
  };
}

const bestFirst = (a: Candidate, b: Candidate): number =>
  Number(b.kind === "same") - Number(a.kind === "same") || b.similarity - a.similarity || (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9) || a.id.localeCompare(b.id);

function done(cands: Candidate[]): MatchResult {
  if (cands.length === 0) return NEW;
  const sorted = [...cands].sort(bestFirst);
  const top = sorted[0]!;
  return { kind: top.kind, id: top.id, by: top.by, similarity: top.similarity, distance_m: top.distance_m, candidates: sorted };
}

/** Match one normalised record against the existing rows of its entity. `existing` are catalog rows (or places). */
export function matchRecord(rec: Pick<NormRecord, "entity" | "id" | "row" | "match">, existing: Row[]): MatchResult {
  const entity = rec.entity as Entity | "places";
  const { row, match } = rec;

  // 1. exact id, including ids this row absorbed in an earlier merge
  if (rec.id) {
    const hit = existing.find((e) => e.id === rec.id);
    if (hit) return { kind: "same", id: hit.id, by: "id", similarity: 1, distance_m: null, candidates: [{ id: hit.id, by: "id", similarity: 1, distance_m: null, kind: "same" }] };
    const merged = existing.find((e) => Array.isArray(e.merged_from) && e.merged_from.includes(rec.id));
    if (merged) return { kind: "same", id: merged.id, by: "merged-id", similarity: 1, distance_m: null, candidates: [{ id: merged.id, by: "merged-id", similarity: 1, distance_m: null, kind: "same" }] };
  }
  if (entity === "legs" || entity === "area_guides" || entity === "offer_prices") return NEW;

  // 2. external ids
  const wantBook = [match.book_url, row.book_url, row.official_url].filter((u) => typeof u === "string").map(urlKey);
  for (const e of existing) {
    const x = externalIds(e);
    if (match.wikidata && x.wikidata === match.wikidata) return done([{ id: e.id, by: "wikidata", similarity: 1, distance_m: null, kind: "same" }]);
    if (match.osm_relation !== undefined && x.osm_relation === String(match.osm_relation)) return done([{ id: e.id, by: "osm_relation", similarity: 1, distance_m: null, kind: "same" }]);
    if (wantBook.length && x.book_urls.some((u) => wantBook.includes(u))) return done([{ id: e.id, by: "book_url", similarity: 1, distance_m: null, kind: "same" }]);
  }

  const name = String(row.name ?? "");
  if (!name) return NEW;
  const cands: Candidate[] = [];

  // 5. offers: provider plus product name
  if (entity === "offers") {
    const provider = String(match.provider ?? row.provider ?? "");
    for (const e of existing) {
      if (similarity(provider, String(e.provider ?? "")) < MATCH.same_similarity && nameKey(provider) !== nameKey(String(e.provider ?? ""))) continue;
      const s = similarity(String(match.product ?? name), String(e.name ?? ""));
      if (s >= MATCH.same_similarity) cands.push({ id: e.id, by: "provider+product", similarity: round2(s), distance_m: null, kind: "same" });
      else if (s >= MATCH.possible_similarity) cands.push({ id: e.id, by: "provider+product", similarity: round2(s), distance_m: null, kind: "possible" });
    }
    return done(cands);
  }

  // 3 and 4. coordinates plus name
  const here = point(row);
  const radius = MATCH.radius_m[entity];
  if (here && radius !== undefined) {
    const wide = MATCH.possible_radius_m[entity]!;
    for (const e of existing) {
      const there = point(e);
      if (!there) continue;
      const d = haversineM(here.lat, here.lon, there.lat, there.lon);
      if (d > wide) continue;
      const s = similarity(name, String(e.name ?? ""));
      const dm = Math.round(d);
      if (s >= MATCH.same_similarity && d <= radius) cands.push({ id: e.id, by: "geo+name", similarity: round2(s), distance_m: dm, kind: "same" });
      else if (s >= MATCH.possible_similarity) cands.push({ id: e.id, by: "geo+name", similarity: round2(s), distance_m: dm, kind: "possible" });
    }
    return done(cands);
  }

  // activities and area-less records: same area and a near-identical name is only ever a possible duplicate
  if (entity === "activities" && row.area_id) {
    for (const e of existing) {
      if (e.area_id !== row.area_id) continue;
      const s = similarity(name, String(e.name ?? ""));
      if (s >= MATCH.possible_similarity) cands.push({ id: e.id, by: "name", similarity: round2(s), distance_m: null, kind: "possible" });
    }
  }
  return done(cands);
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** places live in data/locations; same rules, place-shaped rows */
export function placeRows(places: PlaceRef[]): Row[] {
  return places.map((p) => ({ id: p.id, area_id: p.area_id, name: p.name, lat: p.lat, lon: p.lon, wikidata: p.wikidata }));
}

export { hostOf };
