// StubStore: an in-memory CatalogueStore over the fixture in ./fixture.ts (EXECUTION-PLAN 4.1; API brief step 12). It implements every
// method and every cap of the contract, so the contract kit runs green on it today and a JsonStore or SupabaseStore can be held to the
// same cases. It is also the data behind web's StubAdapter for unit tests (API-1b).
//
// It is a reference implementation of the RULES, not of the product: the parser and the export bodies are deliberately small, and it
// evaluates only the facet keys it can read off a row. Any other key answers `not_available` (store.ts A21), never an ignored filter.
import type { z } from "zod";
import * as S from "../../schema/api/index.ts";
import { compareByDistance, measure, within, type Measure } from "../distance.ts";
import { cardHitsOf } from "../cards.ts";
import { buildTextIndex, cardText, queryTerms, searchTexts } from "../../search/bm25.ts";
import { publicTownLayer, safeLine, type PublicGazetteer, type PublicTownsHolder } from "../../privacy/towns.ts";
import { printText } from "../printText.ts";
import { approxNote } from "../../export/licence.ts";
import { revisionOf, servedSnapshot } from "../revision.ts";
import { fail, ok, type Result } from "../result.ts";
import { currentSlug, isWithdrawn, kebab, movedTo, resolveRegion } from "../slugs.ts";
import { PLACE_SORT_VALUES, TRIP_SORT_VALUES, sortRows } from "../sorting.ts";
import { compareCodePoints, matchesText, sortKey } from "../sortKey.ts";
import { matchesFreeText, placeHaystack, tripHaystack } from "../../query/text.ts";
import { mergeParsed, type CatalogueStore } from "../store.ts";
import { uncheckedPageOf, type UncheckedGroupRows } from "../unchecked.ts";
import { stubData, stubSearchRecords, type StubData, type StubPlace, type StubTrip } from "./fixture.ts";

export { stubData, STUB_ALIASED, STUB_MERGED, STUB_RETIRED, STUB_SOURCES, STUB_TRIP_RETIRED, STUB_WITHDRAWN, type StubData } from "./fixture.ts";

export interface StubOptions {
  data?: StubData;
  /** Which phase E layers exist. All on by default; switch one off to see the `not_available` answer the JsonStore gives before E. */
  layers?: { near?: boolean; towns?: boolean; nearby?: boolean };
}

type Invalid = { ok: false; error: S.ApiError };

/** Parses an input with its contract schema; an invalid input is `invalid_input` with the failing paths in `details` (case K18). */
function check<T>(schema: z.ZodType<T>, input: unknown): { ok: true; value: T } | Invalid {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  const issues = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return { ok: false, error: { code: "invalid_input", message: "The request does not match the contract.", details: { issues } } };
}

/** Rows a licence lets us hand out in a file. */
const OPEN_LICENCES = new Set(["ODbL", "ours", "CC0"]);

/** The facet keys the stub reads off a row, and how (store.ts A21). `f.<x>` reads the row field `x` when the row has one. */
const ROW_FACETS: Record<string, (r: S.PlaceRow) => readonly string[]> = {
  area: (r) => [r.area],
  kind: (r) => [r.kind, r.legacyKind ?? ""],
  season: (r) => r.season.map(String),
  trip: (r) => r.trips.map((t) => t.slug),
  tag: (r) => r.tags.map((t) => t.id),
  effort: (r) => (r.effort ? [r.effort] : []),
  shape: (r) => (r.shape ? [r.shape] : []),
};

/**
 * The facet keys that have a gap state ("not checked yet", store.ts A25) and what a gap is on a row: the stub's `season` has one, an
 * empty season being "nobody has looked" (a known answer is a list of months). Group order is this order.
 */
const GAP_FACETS: { key: string; label: string; note: string; isGap: (r: S.PlaceRow) => boolean }[] = [
  { key: "season", label: "Season", note: "not checked yet", isGap: (r) => r.season.length === 0 },
];

export class StubStore implements CatalogueStore, PublicTownsHolder {
  readonly data: StubData;
  readonly layers: { near: boolean; towns: boolean; nearby: boolean };
  /** Row scans so far: case K4 checks that an unknown centre is refused before any row is read. */
  rowReads = 0;
  private readonly rev: string;
  private readonly gazetteer: PublicGazetteer;
  private readonly bySlug: Map<string, StubPlace>;
  private readonly tripBySlug: Map<string, StubTrip>;

  constructor(opts: StubOptions = {}) {
    const given = opts.data ?? stubData();
    // A33 (owner ruling Q87, 23 Oct): every town and outline is served exactly as the public rows were loaded, and the gazetteer the
    // detector reads is built from the same rows, so a served town point is accepted only when it is that public point
    const layer = publicTownLayer(given.towns, given.cities);
    this.gazetteer = layer.gazetteer;
    this.data = { ...given, towns: layer.towns, cities: layer.outlines };
    this.layers = { near: true, towns: true, nearby: true, ...opts.layers };
    const d = this.data;
    this.rev = revisionOf(servedSnapshot({
      dataset: { places: d.places, trips: d.trips, countryNames: d.countryNames, reportUrl: d.reportUrl },
      slugs: d.registry,
      globe: { continents: d.continents, features: d.features, lines: d.lines, cities: d.cities },
      towns: d.towns,
      vocab: { regions: d.registry.regions },
      citations: d.citations,
    }));
    this.bySlug = new Map(d.places.map((p) => [p.row.slug, p]));
    this.tripBySlug = new Map(d.trips.map((t) => [t.row.slug, t]));
  }

  async revision(): Promise<string> {
    return this.rev;
  }

  /** The loaded public gazetteer (towns.ts), for the detector in respond() and the contract kit; null when the towns layer is off. */
  publicTowns(): PublicGazetteer | null {
    return this.layers.towns ? this.gazetteer : null;
  }

  // ---- places ------------------------------------------------------------------------------------------------------------------

  private scanRows(): S.PlaceRow[] {
    this.rowReads++;
    return this.data.places.map((p) => p.row);
  }

  /**
   * Rows matching the query (store.ts A16, A19, A20, A21); `skip` leaves one facet key out (for facet counts). `city` is handled by the
   * caller. An error when a region alias is ambiguous or a facet key cannot be evaluated here.
   */
  private filterRows(rows: S.PlaceRow[], q: S.PlaceQuery, skip?: string): S.PlaceRow[] | S.ApiError {
    const facets = Object.entries(q.facets ?? {}).filter(([k, v]) => k !== skip && k !== "city" && v.length);
    const countries = (q.facets?.country ?? []).map((c) => c.toLowerCase());
    const regionKeys = new Set<string>();
    for (const v of q.facets?.region ?? []) {
      const hits = resolveRegion(this.data.registry, v, countries);
      if (hits.length > 1) return { code: "invalid_scope", message: `The region "${v}" names regions in more than one country; add a country.`, details: { candidates: hits } };
      for (const h of hits) regionKeys.add(h);
    }
    const tests: ((r: S.PlaceRow) => boolean)[] = [];
    for (const [key, values] of facets) {
      if (key === "country") tests.push((r) => values.some((v) => v.toUpperCase() === r.country));
      else if (key === "region") tests.push((r) => regionKeys.has(`${r.country.toLowerCase()}/${r.region}`));
      else if (key === "k") tests.push((r) => values.some((v) => r.type === v || (r.type ?? "").startsWith(`${v}.`)));
      else {
        const read = ROW_FACETS[key] ?? (key.startsWith("f.") && key.slice(2) in rows[0]! ? (r: S.PlaceRow) => [String((r as Record<string, unknown>)[key.slice(2)])] : null);
        if (!read) return { code: "not_available", message: `The stub cannot evaluate the facet "${key}"; the query engine (core/src/query) lands in API-2.` };
        tests.push((r) => values.some((v) => read(r).includes(v)));
      }
    }
    const ids = q.ids?.length ? new Set(q.ids.map((id) => currentSlug(this.data.registry, id)).filter((s): s is string => !!s)) : null;
    return rows.filter((r) => {
      if (!tests.every((t) => t(r))) return false;
      if (!matchesFreeText(q.q, r, placeHaystack)) return false;
      if (ids && !ids.has(r.slug)) return false;
      if (q.bbox) {
        const [w, s, e, n] = q.bbox;
        if (r.lat === null || r.lon === null || r.lat < s || r.lat > n || r.lon < w || r.lon > e) return false;
      }
      return true;
    });
  }

  /** One page of sorted rows, with the page-size cap (case K1). */
  private page<T>(rows: T[], page: S.ApiPage | undefined): Result<S.Paged<T>> {
    const pageSize = page?.pageSize ?? S.API_LIMITS.pageSize.default;
    if (pageSize > S.API_LIMITS.pageSize.max) return fail("too_large", `pageSize is at most ${S.API_LIMITS.pageSize.max}.`, { max: S.API_LIMITS.pageSize.max });
    const n = page?.page ?? 1;
    const start = (n - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);
    return ok({ items, total: rows.length, page: n, pageSize, nextPage: start + pageSize < rows.length ? n + 1 : null }, this.rev);
  }

  /** The city filter of a list (nearby spec 4.2): within the nearby radius of the town, by the distance rule. */
  private cityFilter(rows: S.PlaceRow[], city: string | undefined): S.PlaceRow[] | S.ApiError {
    if (!city) return rows;
    if (!this.layers.towns) return { code: "not_available", message: "The city filter needs the towns layer, which is not built yet (META-2)." };
    const town = this.data.towns.find((t) => t.id === city);
    if (!town) return { code: "not_found", message: "No town has that id." };
    return rows.filter((r) => r.lat !== null && r.lon !== null && !r.approx && within(measure(town, { lat: r.lat, lon: r.lon }), S.API_LIMITS.nearby.radius));
  }

  private matching(q: S.PlaceQuery, skip?: string): S.PlaceRow[] | S.ApiError {
    const rows = this.filterRows(this.scanRows(), q, skip);
    return Array.isArray(rows) ? this.cityFilter(rows, skip === "city" ? undefined : q.facets?.city?.[0]) : rows;
  }

  async listPlaces(q: S.PlaceQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.PlaceRow>>> {
    const qi = check(S.placeQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    const rows = this.matching(qi.value);
    if (!Array.isArray(rows)) return { ok: false, error: rows };
    return this.page(sortRows(rows, qi.value.sort ?? [], PLACE_SORT_VALUES, (r) => r.name), pi.value);
  }

  /** Rows that fail ONLY on a gap of a selected key, grouped by key in GAP_FACETS order; a row sits in the first group it qualifies for (A25, A27). */
  private uncheckedGroups(q: S.PlaceQuery, only?: readonly string[]): UncheckedGroupRows[] | S.ApiError {
    const seen = new Set<string>();
    const groups: UncheckedGroupRows[] = [];
    for (const g of GAP_FACETS) {
      if (!(q.facets?.[g.key]?.length) || (only && !only.includes(g.key))) continue;
      const others = this.matching(q, g.key);
      if (!Array.isArray(others)) return others;
      const rows = others.filter((r) => g.isGap(r) && !seen.has(r.ref));
      for (const r of rows) seen.add(r.ref);
      groups.push({ key: g.key, label: g.label, note: g.note, rows });
    }
    return groups;
  }

  async countPlaces(q: S.CountQuery): Promise<Result<S.FacetCounts>> {
    const qi = check(S.countQuery, q);
    if (!qi.ok) return qi;
    // a parsed count is the count of the query the parse opens (A25, case K22)
    const query = mergeParsed(qi.value);
    const matched = this.matching(query);
    if (!Array.isArray(matched)) return { ok: false, error: matched };
    const facets: S.FacetCounts["facets"] = {};
    // store.ts A22: options counted with every OTHER key applied; a selected value with no rows shows with 0
    const tally = (key: string, value: (r: S.PlaceRow) => string, label: (r: S.PlaceRow) => string): S.ApiError | null => {
      const rows = this.matching(query, key);
      if (!Array.isArray(rows)) return rows;
      const by = new Map<string, S.FacetCount>();
      for (const r of rows) {
        const v = value(r);
        if (!v) continue;
        const had = by.get(v);
        by.set(v, { value: v, label: label(r), count: (had?.count ?? 0) + 1 });
      }
      for (const v of query.facets?.[key] ?? []) if (key !== "region" && !by.has(v)) by.set(v, { value: v, label: v, count: 0 });
      facets[key] = [...by.values()].sort((a, b) => b.count - a.count || compareCodePoints(sortKey(a.label), sortKey(b.label)) || compareCodePoints(a.value, b.value));
      return null;
    };
    for (const [key, value, label] of [["country", (r: S.PlaceRow) => r.country, (r: S.PlaceRow) => r.country_name], ["region", (r: S.PlaceRow) => r.region, (r: S.PlaceRow) => r.region_name], ["kind", (r: S.PlaceRow) => r.kind, (r: S.PlaceRow) => r.kindLabel]] as const) {
      const err = tally(key, value, label);
      if (err) return { ok: false, error: err };
    }
    const scoped = this.filterRows(this.data.places.map((p) => p.row), { facets: { ...(query.facets?.country ? { country: query.facets.country } : {}), ...(query.facets?.k ? { k: query.facets.k } : {}) } });
    const scope = Array.isArray(scoped) ? scoped.length : 0;
    // gaps: per key with a gap state, the rows in it that match every other key; unchecked: the rows that fail only on a gap of a selected key
    const gaps: Record<string, number> = {};
    for (const g of GAP_FACETS) {
      const rows = this.matching(query, g.key);
      if (!Array.isArray(rows)) return { ok: false, error: rows };
      gaps[g.key] = rows.filter(g.isGap).length;
    }
    const groups = this.uncheckedGroups(query);
    if (!Array.isArray(groups)) return { ok: false, error: groups };
    const unchecked = groups.reduce((n, g) => n + g.rows.length, 0);
    return ok({ n: matched.length, unchecked, scope, total: this.data.places.length, facets, gaps, notes: unchecked ? [`${unchecked} not checked yet`] : [] }, this.rev);
  }

  async listUnchecked(q: S.UncheckedQuery, page?: S.ApiPage): Promise<Result<S.UncheckedPage>> {
    const qi = check(S.uncheckedQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    const pageSize = pi.value.pageSize ?? S.API_LIMITS.pageSize.default;
    if (pageSize > S.API_LIMITS.pageSize.max) return fail("too_large", `pageSize is at most ${S.API_LIMITS.pageSize.max}.`, { max: S.API_LIMITS.pageSize.max });
    const { only, ...plain } = qi.value;
    const groups = this.uncheckedGroups(plain, only);
    if (!Array.isArray(groups)) return { ok: false, error: groups };
    return ok(uncheckedPageOf(groups, plain.sort ?? [], pi.value.page ?? 1, pageSize), this.rev);
  }

  async searchCards(q: S.CardQuery): Promise<Result<S.CardHits>> {
    const qi = check(S.cardQuery, q);
    if (!qi.ok) return qi;
    const limit = qi.value.limit ?? S.API_LIMITS.cards.default;
    if (limit > S.API_LIMITS.cards.max) return fail("too_large", `limit is at most ${S.API_LIMITS.cards.max}.`, { max: S.API_LIMITS.cards.max });
    const { q: words, limit: _limit, ...filters } = qi.value;
    const rows = this.matching(filters);
    if (!Array.isArray(rows)) return { ok: false, error: rows };
    const query = queryTerms(words);
    if (!query.length) return ok(cardHitsOf([], [], limit), this.rev);
    // BM25 over the cards of the query's country scope (A28; the one scorer, core/src/search/bm25.ts)
    const countries = new Set((filters.facets?.country ?? []).map((c) => c.toUpperCase()));
    const scope = this.data.places.filter((p) => !countries.size || countries.has(p.row.country));
    const index = buildTextIndex(scope.map((p) => ({ id: p.row.ref, text: cardText({ name: p.detail.name, kindLabel: p.detail.kindLabel, areaChain: p.detail.areaChain, summary: p.detail.summary, tags: p.row.tags.map((t) => t.label) }) })));
    const score = new Map(searchTexts([index], words, Number.MAX_SAFE_INTEGER).map((h) => [h.id, h.score]));
    const scored = rows.flatMap((row) => (score.has(row.ref) ? [{ row, score: score.get(row.ref)! }] : []));
    return ok(cardHitsOf(scored, query, limit), this.rev);
  }

  async getPlace(slug: string): Promise<Result<S.PlaceLookup>> {
    const si = check(S.placeSlugInput, { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.data.registry, slug);
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, this.rev);
    if (isWithdrawn(this.data.registry, slug)) return fail("not_found", "That place has been withdrawn.");
    const p = this.bySlug.get(slug);
    return p ? ok(p.detail, this.rev) : fail("not_found", "No place has that slug.");
  }

  async nearbyForPlace(slug: string): Promise<Result<S.NearbyBlock>> {
    const si = check(S.placeSlugInput, { slug });
    if (!si.ok) return si;
    if (!this.layers.nearby) return fail("not_available", "Nearby lands in phase E (N2).");
    const p = this.bySlug.get(slug);
    if (!p) return fail("not_found", "No place has that slug.");
    const point = p.detail.point;
    const limits = S.API_LIMITS.nearby;
    const base = { ref: p.detail.ref, slug, radius: limits.radius, items: [], more: 0, dayTrips: { count: 0, r: limits.dayTrips }, towns: [] };
    const others = this.data.places.filter((o) => o !== p && o.detail.point);
    const excludedApprox = others.filter((o) => o.detail.point!.approx).length;
    const basis = { distance: "straight_line" as const, excludedApprox };
    if (!point) return ok({ ...base, state: "no_point", basis }, this.rev);
    if (point.approx) return ok({ ...base, state: "approx_point", basis }, this.rev);
    const measured = others
      .filter((o) => !o.detail.point!.approx)
      .map((o) => ({ o, m: measure(point, o.detail.point!), name: o.detail.name, ref: o.detail.ref }))
      .map((x) => ({ ...x, distanceKm: x.m.distanceKm }))
      .sort(compareByDistance);
    const inside = measured.filter((x) => within(x.m, limits.radius));
    const items: S.NearbyItem[] = inside.slice(0, limits.list).map(({ o, m }) => ({
      ref: o.detail.ref, slug: o.detail.slug, name: o.detail.name, kind: o.detail.kind, kindLabel: o.detail.kindLabel,
      distanceKm: m.distanceKm, bearing: m.bearing, band: m.band, basis: "estimate", minutes: null, badge: o.detail.badge,
    }));
    const towns = this.layers.towns
      ? this.data.towns
          .map((t) => ({ t, m: measure(point, t), name: t.name, ref: t.id }))
          .map((x) => ({ ...x, distanceKm: x.m.distanceKm }))
          .sort(compareByDistance)
          .slice(0, 3)
          .map(({ t, m }) => ({ id: t.id, name: t.name, distanceKm: m.distanceKm, bearing: m.bearing }))
      : [];
    const dayTrips = measured.filter((x) => !within(x.m, limits.radius) && within(x.m, limits.dayTrips)).length;
    return ok({ ...base, state: "ok", items, more: Math.max(0, inside.length - limits.list), dayTrips: { count: dayTrips, r: limits.dayTrips }, towns, basis }, this.rev);
  }

  /** A near centre, resolved through indexes only (no row scan, case K4). */
  private centre(near: string | undefined, city: string | undefined): Result<S.NearPage["centre"]> {
    if (city) {
      if (!this.layers.towns) return fail("not_available", "A town centre needs the towns layer, which is not built yet (META-2).");
      const t = this.data.towns.find((x) => x.id === city);
      return t ? ok({ kind: "town", key: city, name: t.name, lat: t.lat, lon: t.lon }, this.rev) : fail("not_found", "No town has that id.");
    }
    if (!near) return fail("invalid_scope", "A near query needs a centre: `near` (place:<slug> or area:<id>) or `city` (a town id).");
    const [kind, id] = [near.slice(0, near.indexOf(":")), near.slice(near.indexOf(":") + 1)];
    if (kind === "place") {
      const p = this.bySlug.get(currentSlug(this.data.registry, id) ?? id);
      const pt = p?.detail.point;
      if (!p || !pt) return fail("not_found", "No place with a point has that slug.");
      if (pt.approx) return fail("not_found", "That place's point is approximate, so no distance can be measured from it.");
      return ok({ kind: "place", key: near, name: p.detail.name, lat: pt.lat, lon: pt.lon }, this.rev);
    }
    const inArea = this.data.places.filter((p) => p.detail.point && !p.detail.point.approx && (p.row.area === id || `${p.row.country.toLowerCase()}/${p.row.region}/${p.row.area}` === id));
    if (!inArea.length) return fail("not_found", "No area with an exact point has that id.");
    const lat = inArea.reduce((s, p) => s + p.detail.point!.lat, 0) / inArea.length;
    const lon = inArea.reduce((s, p) => s + p.detail.point!.lon, 0) / inArea.length;
    return ok({ kind: "area", key: near, name: inArea[0]!.row.area_name, lat, lon }, this.rev);
  }

  /** The radius rule (case K3): default by centre kind, clamped to the max. */
  private radius(r: number | undefined, kind: "place" | "area" | "town"): { r: number; clamped: boolean } {
    const lim = S.API_LIMITS.nearRadius;
    const asked = r ?? (kind === "area" ? lim.areaDefault : lim.default);
    return asked > lim.max ? { r: lim.max, clamped: true } : { r: asked, clamped: false };
  }

  async near(q: S.NearQuery, page?: S.ApiPage): Promise<Result<S.NearPage>> {
    const qi = check(S.nearQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    if (!this.layers.near) return fail("not_available", "Near mode lands in phase E (N2).");
    const c = this.centre(qi.value.near, qi.value.city ?? qi.value.facets?.city?.[0]);
    if (!c.ok) return c;
    const centre = c.data;
    const { r, clamped } = this.radius(qi.value.r, centre.kind);
    const rows = this.filterRows(this.scanRows(), qi.value);
    if (!Array.isArray(rows)) return { ok: false, error: rows };
    let excludedApprox = 0;
    const hits: (S.NearRow & { m: Measure })[] = [];
    for (const row of rows) {
      if (row.lat === null || row.lon === null) continue;
      if (row.approx) {
        excludedApprox++;
        continue;
      }
      const m = measure(centre, { lat: row.lat, lon: row.lon });
      if (!within(m, r)) continue;
      hits.push({ ...row, distanceKm: m.distanceKm, bearing: m.bearing, band: m.band, basis: "estimate", minutes: null, m });
    }
    hits.sort(compareByDistance);
    const paged = this.page(hits.map(({ m: _m, ...row }) => row), pi.value);
    if (!paged.ok) return paged;
    return ok({ ...paged.data, centre, r, clamped, basis: { distance: "straight_line", excludedApprox } }, this.rev);
  }

  async towns(q: S.TownQuery): Promise<Result<S.TownList>> {
    const qi = check(S.townQuery, q);
    if (!qi.ok) return qi;
    if (!this.layers.towns) return fail("not_available", "The towns layer is not built yet (META-2).");
    const v = qi.value;
    const cap = S.API_LIMITS.towns.max;
    const withPlaces = (t: S.Town): S.Town => ({ ...t, places: this.data.places.filter((p) => p.detail.point && !p.detail.point.approx && within(measure(t, p.detail.point), S.API_LIMITS.nearby.radius)).length });
    if (v.prefix !== undefined) {
      if (!v.cc || !v.region) return fail("invalid_scope", "A town prefix needs a country (`cc`) and a region: towns load by region, never the world.");
      const keys = resolveRegion(this.data.registry, v.region, v.cc);
      if (!keys.length) return fail("not_found", "No region has that name or code.");
      const want = kebab(v.prefix);
      const hits = this.data.towns
        .filter((t) => keys.includes(`${t.cc}/${t.region}`) && kebab(t.name).startsWith(want))
        .sort((a, b) => compareCodePoints(sortKey(a.name), sortKey(b.name)) || compareCodePoints(a.id, b.id));
      return ok({ items: hits.slice(0, cap).map(withPlaces), truncated: hits.length > cap, clamped: false }, this.rev);
    }
    if (!v.near && !v.city) return fail("invalid_scope", "Towns need a centre (`near` or `city`) or a prefix with a country and a region.");
    const c = this.centre(v.near, v.city);
    if (!c.ok) return c;
    const { r, clamped } = this.radius(v.r, c.data.kind);
    const hits = this.data.towns
      .map((t) => ({ t, m: measure(c.data, t), name: t.name, ref: t.id }))
      .map((x) => ({ ...x, distanceKm: x.m.distanceKm }))
      .filter((x) => within(x.m, r) && x.t.id !== v.city)
      .sort(compareByDistance);
    return ok({ items: hits.slice(0, cap).map(({ t, m }) => ({ ...withPlaces(t), distanceKm: m.distanceKm, bearing: m.bearing })), truncated: hits.length > cap, clamped }, this.rev);
  }

  // ---- search ------------------------------------------------------------------------------------------------------------------

  async parse(input: S.ParseInput): Promise<Result<S.ParsedQuery>> {
    const pi = check(S.parseInput, input);
    if (!pi.ok) return pi;
    const words = pi.value.q.toLowerCase().split(/\s+/).filter(Boolean);
    const chips: S.ParsedQuery["chips"] = [];
    const facets: Record<string, string[]> = {};
    const unused: string[] = [];
    words.forEach((w, i) => {
      const region = resolveRegion(this.data.registry, w);
      const kind = S.PLACE_KINDS.find((k) => k === w || `${k}s` === w);
      if (region.length === 1) {
        const [cc, slug] = [region[0]!.slice(0, 2), region[0]!.slice(3)];
        facets.country = [cc.toUpperCase()];
        facets.region = [slug];
        chips.push({ id: "where", label: this.data.registry.regions[region[0]!]!.name, set: { country: [cc.toUpperCase()], region: [slug] }, words: [i, i + 1] });
      } else if (kind) {
        facets.kind = [kind];
        chips.push({ id: "kind", label: kind, set: { kind: [kind] }, words: [i, i + 1] });
      } else unused.push(w);
    });
    const target = pi.value.target ?? "places";
    const params = new URLSearchParams(Object.entries(facets).flatMap(([k, vs]) => vs.map((x): [string, string] => [k, x])));
    if (unused.length) params.set("q", unused.join(" "));
    return ok({ target, chips, q: unused.join(" "), unused, notYet: [], didYouMean: [], href: `/${target}/?${params}`, facets, vocab: "stub" }, this.rev);
  }

  async search(q: S.SearchQuery): Promise<Result<S.SearchResult>> {
    const qi = check(S.searchQuery, q);
    if (!qi.ok) return qi;
    const limit = qi.value.limit ?? S.API_LIMITS.searchLimit.default;
    if (limit > S.API_LIMITS.searchLimit.max) return fail("too_large", `limit is at most ${S.API_LIMITS.searchLimit.max}.`, { max: S.API_LIMITS.searchLimit.max });
    const want = sortKey(qi.value.q);
    const records = stubSearchRecords(this.data).filter((r) => !qi.value.scope?.kind || r.k === qi.value.scope.kind);
    const scored = records
      .map((record) => ({ record, score: !want ? 0 : sortKey(record.n).startsWith(want) ? 2 : matchesText(qi.value.q, [record.n, record.x]) ? 1 : 0 }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || compareCodePoints(sortKey(a.record.n), sortKey(b.record.n)) || compareCodePoints(a.record.h, b.record.h));
    const group = (id: "trips" | "places" | "areas", k: "trip" | "place" | "area", label: string) => {
      const all = scored.filter((h) => h.record.k === k);
      return { id, label, total: all.length, hits: all.slice(0, limit) };
    };
    const groups = [group("trips", "trip", "Trips"), group("places", "place", "Places"), group("areas", "area", "Areas")];
    return ok({ counts: { trips: groups[0]!.total, places: groups[1]!.total, areas: groups[2]!.total }, groups, query: want, partial: false }, this.rev);
  }

  // ---- trips -------------------------------------------------------------------------------------------------------------------

  async listTrips(q: S.TripQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.TripRow>>> {
    const qi = check(S.tripQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    const countries = (qi.value.facets?.country ?? []).map((c) => c.toUpperCase());
    const unsupported = Object.keys(qi.value.facets ?? {}).find((k) => k !== "country");
    if (unsupported) return fail("not_available", `The stub cannot evaluate the trip facet "${unsupported}"; the query engine lands in API-2.`);
    const rows = this.data.trips
      .map((t) => t.row)
      .filter((r) => (!countries.length || r.countries.some((c) => countries.includes(c.code))) && matchesFreeText(qi.value.q, r, tripHaystack));
    return this.page(sortRows(rows, qi.value.sort ?? [], TRIP_SORT_VALUES, (r) => r.title), pi.value);
  }

  async getTrip(slug: string, profile?: S.TripProfile): Promise<Result<S.TripLookup>> {
    const si = check(S.tripSlugInput, profile ? { slug, profile } : { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.data.registry, slug, "trips");
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, this.rev);
    const t = this.tripBySlug.get(slug);
    return t ? ok(t.detail, this.rev) : fail("not_found", "No public trip has that slug.");
  }

  /** The fixture's legs: from the base to the first stop, then stop to stop, two at most, each a straight line through its midpoint (a stand-in for a routed one). */
  private legsOf(t: StubTrip): S.TripLeg[] {
    const stops = t.detail.days.flatMap((day) => day.items.map((it) => ({ day: day.n, key: it.id, point: it.placeSlug ? this.bySlug.get(it.placeSlug)?.detail.point ?? null : null })));
    const base = t.detail.bases[0];
    const chain = [...(base?.point ? [{ day: 1, key: `base:${base.id}`, point: base.point }] : []), ...stops].filter((x) => x.point);
    const legs: S.TripLeg[] = [];
    for (let i = 0; i + 1 < chain.length && legs.length < 2; i++) {
      const [a, b] = [chain[i]!, chain[i + 1]!];
      const mid: [number, number] = [(a.point!.lon + b.point!.lon) / 2 + 0.01, (a.point!.lat + b.point!.lat) / 2];
      const geometry = safeLine(S.encodePolyline5([[a.point!.lon, a.point!.lat], mid, [b.point!.lon, b.point!.lat]]));
      legs.push({ day: b.day, from: a.key, to: b.key, mode: "drive", km: Math.round(measure(a.point!, b.point!).distanceKm * 13) / 10, minutes: 30 + i * 15, geometry });
    }
    return legs;
  }

  async tripLegs(slug: string): Promise<Result<S.TripLegsLookup>> {
    const si = check(S.tripLegsInput, { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.data.registry, slug, "trips");
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, this.rev);
    const t = this.tripBySlug.get(slug);
    if (!t) return fail("not_found", "No public trip has that slug.");
    const legs = this.legsOf(t);
    return ok({ ref: t.detail.ref, slug, legs, attribution: legs.length ? "Stub fixture legs. Map data: OpenStreetMap contributors (ODbL)." : "", fetched: legs.length ? "2026-10-01" : null }, this.rev);
  }

  // ---- exports -----------------------------------------------------------------------------------------------------------------

  /** The export model of one item (A26): the licence guard leaves a point out of the waypoints and counts it; a stop keeps its row with `point: null`. */
  private exportModel(type: "place" | "trip", slug: string): S.ExportModel | null {
    const exportPoint = (p: S.ApiPoint): NonNullable<S.ExportModel["waypoints"][number]["point"]> => ({ lat: p.lat, lon: p.lon, pointSource: p.pointSource, pointChecked: p.pointChecked, sourceLicence: p.sourceLicence });
    const open = (p: S.ApiPoint | null | undefined): p is S.ApiPoint => !!p && OPEN_LICENCES.has(p.sourceLicence);
    if (type === "place") {
      const p = this.bySlug.get(slug);
      if (!p) return null;
      const pt = p.detail.point;
      const waypoints = open(pt) ? [{ id: `place:0:${slug}`, name: p.detail.name, kind: p.detail.kind, role: "place" as const, day: null, note: null, url: `/places/${slug}/`, point: exportPoint(pt) }] : [];
      return { type: "place", slug, title: p.detail.name, url: `/places/${slug}/`, kind: p.detail.kind, waypoints, lines: [], skipped: pt && !open(pt) ? 1 : 0 };
    }
    const t = this.tripBySlug.get(slug);
    if (!t) return null;
    const stops: Extract<S.ExportModel, { type: "trip" }>["stops"] = [];
    const waypoints: S.ExportModel["waypoints"] = [];
    let skipped = 0;
    let order = 0;
    for (const day of t.detail.days) {
      for (const it of day.items) {
        const place = it.placeSlug ? this.bySlug.get(it.placeSlug) : undefined;
        const pt = place?.detail.point ?? null;
        if (pt && !open(pt)) skipped++;
        stops.push({
          day: day.n, order: order++, id: it.id, name: it.name, kind: it.kind, category: it.category, area: place?.detail.areaLabel ?? null, time: it.time, durationMin: it.durationMin,
          lane: null, note: it.note, placeSlug: it.placeSlug, links: [], point: open(pt) ? exportPoint(pt) : null,
        });
        if (open(pt)) waypoints.push({ id: `stop:${day.n}:${it.placeSlug}`, name: it.name, kind: it.kind, role: "stop", day: day.n, note: it.note, url: `/places/${it.placeSlug}/`, point: exportPoint(pt) });
      }
    }
    return {
      type: "trip", slug, title: t.detail.title, url: `/trips/${slug}/`, depth: t.detail.depth, nights: t.detail.nights ?? 0,
      days: t.detail.days.map((d) => ({ n: d.n, title: d.title, base: d.base })), stops, waypoints, lines: [], tz: null, seasonLabel: t.detail.season?.label ?? null, skipped,
    };
  }

  async getExport(q: S.ExportQuery): Promise<Result<S.ExportFile>> {
    const qi = check(S.exportQuery, q);
    if (!qi.ok) return qi;
    const { type, slug } = qi.value;
    const format = qi.value.format;
    if (format === "json" || format === "print") {
      const model = this.exportModel(type, slug);
      if (!model) return fail("not_found", `No public ${type} has that slug.`);
      const approx = model.waypoints.filter((w) => approxNote(w.point) !== null).length;
      const source = model.waypoints.some((w) => w.point.sourceLicence === "ODbL") ? "Map data: OpenStreetMap contributors (ODbL)" : "";
      const area = model.type === "place" ? this.bySlug.get(slug)?.detail.areaLabel ?? null : null;
      const body = format === "json" ? JSON.stringify(model) : printText(model, { area });
      return ok({ filename: `${slug}.${S.EXPORT_FILE[format].ext}`, mime: S.EXPORT_FILE[format].mime, body, source, skipped: model.skipped, approx }, this.rev);
    }
    const places = type === "place" ? [this.bySlug.get(slug)].filter((p): p is StubPlace => !!p) : (this.tripBySlug.get(slug)?.places ?? []).map((s) => this.bySlug.get(s)!).filter(Boolean);
    const title = type === "place" ? this.bySlug.get(slug)?.detail.name : this.tripBySlug.get(slug)?.detail.title;
    if (!title) return fail("not_found", `No public ${type} has that slug.`);
    let skipped = 0;
    let approx = 0;
    let odbl = false;
    const points: { name: string; lat: number; lon: number; approx: boolean }[] = [];
    for (const p of places) {
      const pt = p.detail.point;
      if (!pt) continue;
      if (!OPEN_LICENCES.has(pt.sourceLicence)) {
        skipped++;
        continue;
      }
      if (pt.sourceLicence === "ODbL") odbl = true;
      if (pt.approx) approx++;
      points.push({ name: p.detail.name, lat: pt.lat, lon: pt.lon, approx: pt.approx });
    }
    const label = (p: (typeof points)[number]) => (p.approx ? `${p.name} (location approximate)` : p.name);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const bodies: Record<Exclude<S.ExportFormat, "json" | "print">, string> = {
      csv: ["name,lat,lon,approximate", ...points.map((p) => `"${p.name.replace(/"/g, '""')}",${p.lat},${p.lon},${p.approx}`)].join("\n"),
      gpx: `<?xml version="1.0"?><gpx version="1.1" creator="stub">${points.map((p) => `<wpt lat="${p.lat}" lon="${p.lon}"><name>${esc(label(p))}</name></wpt>`).join("")}</gpx>`,
      kml: `<?xml version="1.0"?><kml><Document><name>${esc(title)}</name>${points.map((p) => `<Placemark><name>${esc(label(p))}</name><Point><coordinates>${p.lon},${p.lat}</coordinates></Point></Placemark>`).join("")}</Document></kml>`,
      ics: ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//stub//EN", `X-WR-CALNAME:${title}`, "END:VCALENDAR"].join("\r\n"),
    };
    return ok({ filename: `${slug}.${S.EXPORT_FILE[format].ext}`, mime: S.EXPORT_FILE[format].mime, body: bodies[format], source: odbl ? "Map data: OpenStreetMap contributors (ODbL)" : "", skipped, approx }, this.rev);
  }

  // ---- globe -------------------------------------------------------------------------------------------------------------------

  private pins(): S.LightPin[] {
    const placePins = this.data.places
      .filter((p) => p.detail.point)
      .map((p): S.LightPin => ({
        kind: "place", slug: p.detail.slug, name: p.detail.name, lat: p.detail.point!.lat, lon: p.detail.point!.lon, type: p.detail.kind,
        path: [p.row.country.toLowerCase(), p.row.region, p.row.area], approx: p.detail.point!.approx, tier: p.detail.badge ? "national" : "local", kindLabel: p.detail.kindLabel,
      }));
    const tripPins = this.data.trips.map((t): S.LightPin => ({
      kind: "trip", slug: t.row.slug, name: t.row.title, lat: t.row.lat!, lon: t.row.lon!, type: t.row.depth, path: [t.row.country.toLowerCase()], approx: t.row.approx, tier: "world", kindLabel: "Trip",
    }));
    return [...placePins, ...tripPins];
  }

  async globeTree(): Promise<Result<S.GlobeTree>> {
    const rows = this.scanRows();
    const node = (cc: string): S.GlobeTree["continents"][number]["countries"][number] => {
      const mine = rows.filter((r) => r.country.toLowerCase() === cc);
      const exact = mine.filter((r) => r.lat !== null && !r.approx);
      const regions = [...new Set(mine.map((r) => r.region))].sort(compareCodePoints);
      return {
        slug: cc, name: this.data.countryNames[cc] ?? cc.toUpperCase(), places: mine.length, trips: this.data.trips.filter((t) => t.row.country.toLowerCase() === cc).length,
        children: regions.map((reg) => ({ slug: reg, name: mine.find((r) => r.region === reg)!.region_name, places: mine.filter((r) => r.region === reg).length, trips: 0, children: [] })),
        at: exact.length ? [exact.reduce((s, r) => s + r.lon!, 0) / exact.length, exact.reduce((s, r) => s + r.lat!, 0) / exact.length] : null,
      };
    };
    const continents = this.data.continents.map((c) => {
      const countries = c.countries.map(node);
      return { slug: c.slug, name: c.name, places: countries.reduce((s, n) => s + n.places, 0), trips: countries.reduce((s, n) => s + n.trips, 0), countries };
    });
    return ok({ continents }, this.rev);
  }

  async globePins(cc: string): Promise<Result<S.LightPin[]>> {
    const ci = check(S.globePinsInput, { cc });
    if (!ci.ok) return ci;
    const pins = this.pins().filter((p) => p.path[0] === cc);
    if (pins.length > S.API_LIMITS.globePins.max) return fail("too_large", `A country answers at most ${S.API_LIMITS.globePins.max} pins.`, { max: S.API_LIMITS.globePins.max });
    return ok(pins, this.rev);
  }

  async globeCard(key: string): Promise<Result<S.GlobeCardFile>> {
    const ki = check(S.globeCardInput, { key });
    if (!ki.ok) return ki;
    const [kind, slug] = key.split(":") as ["place" | "trip", string];
    const pin = this.pins().find((p) => p.kind === kind && p.slug === slug);
    if (!pin) return fail("not_found", "Nothing on the globe has that key.");
    const place = kind === "place" ? this.bySlug.get(slug)!.detail : null;
    const trip = kind === "trip" ? this.tripBySlug.get(slug)!.detail : null;
    const card: S.GlobeCardFile["card"] = {
      key, kind, slug, title: place?.name ?? trip!.title, kindLabel: pin.kindLabel, glyph: place ? place.kind : "trip", areaLabel: place?.areaLabel ?? trip!.region,
      summary: (place?.summary ?? trip!.subtitle).slice(0, 120), facts: [], usedIn: place?.trips[0] ? { ...place.trips[0], day: null } : null, image: null,
      badge: place && place.completeness.level !== "draft" ? place.completeness.label : null, approx: pin.approx, href: `/${kind}s/${slug}/`,
    };
    return ok({ card, pin }, this.rev);
  }

  async globeFeature(id: string): Promise<Result<S.GlobeFeature>> {
    const ii = check(S.globeIdInput, { id });
    if (!ii.ok) return ii;
    const f = this.data.features.find((x) => x.id === id);
    return f ? ok(f, this.rev) : fail("not_found", "No feature has that id.");
  }

  async globeLine(id: string): Promise<Result<S.GlobeLine>> {
    const ii = check(S.globeIdInput, { id });
    if (!ii.ok) return ii;
    const l = this.data.lines.find((x) => x.id === id);
    return l ? ok(l, this.rev) : fail("not_found", "No line has that id.");
  }

  async globeCity(townId: string): Promise<Result<S.GlobeCity>> {
    const ti = check(S.globeCityInput, { townId });
    if (!ti.ok) return ti;
    if (!this.layers.towns) return fail("not_available", "City outlines need the towns layer (GLB2 row 9.3).");
    const c = this.data.cities.find((x) => x.id === townId);
    return c ? ok(c, this.rev) : fail("not_found", "No city outline has that town id.");
  }

  // ---- report ------------------------------------------------------------------------------------------------------------------

  async report(input: S.ReportInput): Promise<Result<S.ReportResult>> {
    const ri = check(S.reportInput, input);
    if (!ri.ok) return ri;
    if (!this.data.reportUrl) return fail("not_available", "Reporting is off.");
    return ok({ kind: "link", url: `${this.data.reportUrl}?page=${encodeURIComponent(ri.value.page)}` }, this.rev);
  }
}
