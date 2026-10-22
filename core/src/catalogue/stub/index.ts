// StubStore: an in-memory CatalogueStore over the fixture in ./fixture.ts (EXECUTION-PLAN 4.1; API brief step 12). It implements every
// method and every cap of the contract, so the contract kit runs green on it today and a JsonStore or SupabaseStore can be held to the
// same cases. It is also the data behind web's StubAdapter for unit tests (API-1b).
//
// It is a reference implementation of the RULES, not of the product: filters, the parser and the export bodies are deliberately small.
import type { z } from "zod";
import * as S from "../../schema/api/index.ts";
import { haversineKm } from "../../relevance/fit.ts";
import { revisionOf } from "../revision.ts";
import { fail, ok, type Result } from "../result.ts";
import { kebab, movedTo, resolveRegion } from "../slugs.ts";
import { compareCodePoints, compareSortable, sortKey } from "../sortKey.ts";
import type { CatalogueStore } from "../store.ts";
import { stubData, stubSearchRecords, type StubData, type StubPlace, type StubTrip } from "./fixture.ts";

export { stubData, STUB_RETIRED, STUB_SOURCES, type StubData } from "./fixture.ts";

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

const BEARINGS = S.BEARINGS;
function bearingOf(from: { lat: number; lon: number }, to: { lat: number; lon: number }): (typeof S.BEARINGS)[number] {
  const rad = (x: number) => (x * Math.PI) / 180;
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return BEARINGS[Math.round(deg / 45) % 8]!;
}

/** The nearby spec 5.1 bands: a walk under 1.2 km, then the timeline's drive estimate (straight line x 1.42 plus 1.5 km under 60 km; 46 km/h, 72 above 60 km; plus 3 min). */
function bandOf(km: number): (typeof S.NEAR_BANDS)[number] {
  if (km < 1.2) return "walk";
  const road = km * 1.42 + (km < 60 ? 1.5 : 0);
  const min = (road / (km < 60 ? 46 : 72)) * 60 + 3;
  return min < 15 ? "lt15" : min < 30 ? "15-30" : min < 60 ? "30-60" : "60-120";
}

/** Rows a licence lets us hand out in a file. */
const OPEN_LICENCES = new Set(["ODbL", "ours", "CC0"]);

export class StubStore implements CatalogueStore {
  readonly data: StubData;
  readonly layers: { near: boolean; towns: boolean; nearby: boolean };
  /** Row scans so far: case K4 checks that an unknown centre is refused before any row is read. */
  rowReads = 0;
  private readonly rev: string;
  private readonly bySlug: Map<string, StubPlace>;
  private readonly tripBySlug: Map<string, StubTrip>;

  constructor(opts: StubOptions = {}) {
    this.data = opts.data ?? stubData();
    this.layers = { near: true, towns: true, nearby: true, ...opts.layers };
    this.rev = revisionOf({ data: { ...this.data, registry: undefined }, slugs: this.data.registry });
    this.bySlug = new Map(this.data.places.map((p) => [p.row.slug, p]));
    this.tripBySlug = new Map(this.data.trips.map((t) => [t.row.slug, t]));
  }

  async revision(): Promise<string> {
    return this.rev;
  }

  // ---- places ------------------------------------------------------------------------------------------------------------------

  private scanRows(): S.PlaceRow[] {
    this.rowReads++;
    return this.data.places.map((p) => p.row);
  }

  /** Rows matching the query; `skip` leaves one facet key out (for facet counts). `city` is handled by the caller. */
  private filterRows(rows: S.PlaceRow[], q: S.PlaceQuery, skip?: string): S.PlaceRow[] {
    const facets = Object.entries(q.facets ?? {}).filter(([k]) => k !== skip && k !== "city");
    const countries = (q.facets?.country ?? []).map((c) => c.toLowerCase());
    const regionKeys = new Set((q.facets?.region ?? []).flatMap((v) => resolveRegion(this.data.registry, v, countries)));
    const words = (q.q ?? "").toLowerCase().trim();
    return rows.filter((r) => {
      for (const [key, values] of facets) {
        if (!values.length) continue;
        if (key === "country" && !values.some((v) => v.toUpperCase() === r.country)) return false;
        else if (key === "region" && !regionKeys.has(`${r.country.toLowerCase()}/${r.region}`)) return false;
        else if (key === "area" && !values.includes(r.area)) return false;
        else if (key === "kind" && !values.includes(r.kind) && !values.includes(r.legacyKind ?? "")) return false;
        else if (key === "k" && !values.some((v) => r.type === v || (r.type ?? "").startsWith(`${v}.`))) return false;
        else if (key === "season" && !values.some((v) => r.season.includes(Number(v)))) return false;
        else if (key === "trip" && !r.trips.some((t) => values.includes(t.slug))) return false;
        else if (!["country", "region", "area", "kind", "k", "season", "trip"].includes(key)) {
          const field = key.startsWith("f.") ? key.slice(2) : key;
          const have = (r as Record<string, unknown>)[field];
          if (have === undefined) continue;
          const list = Array.isArray(have) ? have.map(String) : [String(have)];
          if (!values.some((v) => list.includes(v))) return false;
        }
      }
      if (words && ![r.name, r.area_name, r.region_name].some((s) => s.toLowerCase().includes(words))) return false;
      if (q.ids?.length && !q.ids.includes(r.slug)) return false;
      if (q.bbox) {
        const [w, s, e, n] = q.bbox;
        if (r.lat === null || r.lon === null || r.lat < s || r.lat > n || r.lon < w || r.lon > e) return false;
      }
      return true;
    });
  }

  /** The sort of every paged method (D-B5): the asked keys, then sortKey(name), then ref, in code-point order. */
  private sortRows<T extends { name: string; ref: string }>(rows: T[], sort: readonly string[] = []): T[] {
    const keyed = rows.map((row) => ({ row, sortKey: sortKey(row.name), ref: row.ref }));
    keyed.sort((a, b) => {
      for (const spec of sort) {
        const desc = spec.startsWith("-");
        const f = desc ? spec.slice(1) : spec;
        const x = (a.row as Record<string, unknown>)[f];
        const y = (b.row as Record<string, unknown>)[f];
        if (x === y) continue;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : compareCodePoints(sortKey(String(x)), sortKey(String(y)));
        if (c !== 0) return desc ? -c : c;
      }
      return compareSortable(a, b);
    });
    return keyed.map((k) => k.row);
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

  async listPlaces(q: S.PlaceQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.PlaceRow>>> {
    const qi = check(S.placeQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    if (q.facets?.city?.length && !this.layers.towns) return fail("not_available", "The city filter needs the towns layer, which is not built yet (META-2).");
    let rows = this.filterRows(this.scanRows(), qi.value);
    if (q.facets?.city?.length) {
      const town = this.data.towns.find((t) => t.id === q.facets!.city![0]);
      if (!town) return fail("not_found", "No town has that id.");
      rows = rows.filter((r) => r.lat !== null && r.lon !== null && !this.isApprox(r.slug) && haversineKm(town, { lat: r.lat, lon: r.lon }) <= S.API_LIMITS.nearby.radius);
    }
    return this.page(this.sortRows(rows, qi.value.sort), pi.value);
  }

  private isApprox(slug: string): boolean {
    return this.bySlug.get(slug)?.detail.point?.approx === true;
  }

  async countPlaces(q: S.PlaceQuery): Promise<Result<S.FacetCounts>> {
    const qi = check(S.placeQuery, q);
    if (!qi.ok) return qi;
    if (q.facets?.city?.length && !this.layers.towns) return fail("not_available", "The city filter needs the towns layer, which is not built yet (META-2).");
    const all = this.scanRows();
    const matched = this.filterRows(all, qi.value);
    const facets: S.FacetCounts["facets"] = {};
    const tally = (key: string, value: (r: S.PlaceRow) => string, label: (r: S.PlaceRow) => string) => {
      const by = new Map<string, S.FacetCount>();
      for (const r of this.filterRows(all, qi.value, key)) {
        const v = value(r);
        if (!v) continue;
        const had = by.get(v);
        by.set(v, { value: v, label: label(r), count: (had?.count ?? 0) + 1 });
      }
      facets[key] = [...by.values()].sort((a, b) => b.count - a.count || compareCodePoints(sortKey(a.label), sortKey(b.label)));
    };
    tally("country", (r) => r.country, (r) => r.country_name);
    tally("region", (r) => r.region, (r) => r.region_name);
    tally("kind", (r) => r.kind, (r) => r.kindLabel);
    const scope = this.filterRows(all, { facets: { ...(q.facets?.country ? { country: q.facets.country } : {}), ...(q.facets?.k ? { k: q.facets.k } : {}) } }).length;
    return ok({ n: matched.length, unchecked: 0, scope, total: all.length, facets, gaps: {}, notes: [] }, this.rev);
  }

  async getPlace(slug: string): Promise<Result<S.PlaceLookup>> {
    const si = check(S.placeSlugInput, { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.data.registry, slug);
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, this.rev);
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
      .map((o) => ({ o, km: haversineKm(point, o.detail.point!) }))
      .map((x) => ({ ...x, sortKey: sortKey(x.o.detail.name), ref: x.o.detail.ref }))
      .sort((a, b) => a.km - b.km || compareSortable(a, b));
    const within = measured.filter((x) => x.km <= limits.radius);
    const items: S.NearbyItem[] = within.slice(0, limits.list).map(({ o, km }) => ({
      ref: o.detail.ref, slug: o.detail.slug, name: o.detail.name, kind: o.detail.kind, kindLabel: o.detail.kindLabel,
      distanceKm: Math.round(km * 10) / 10, bearing: bearingOf(point, o.detail.point!), band: bandOf(km), basis: "estimate", badge: o.detail.badge,
    }));
    const towns = this.layers.towns
      ? this.data.towns
          .map((t) => ({ t, km: haversineKm(point, t) }))
          .sort((a, b) => a.km - b.km || compareCodePoints(a.t.id, b.t.id))
          .slice(0, 3)
          .map(({ t, km }) => ({ id: t.id, name: t.name, distanceKm: Math.round(km * 10) / 10, bearing: bearingOf(point, t) }))
      : [];
    const dayTrips = measured.filter((x) => x.km > limits.radius && x.km <= limits.dayTrips).length;
    return ok({ ...base, state: "ok", items, more: Math.max(0, within.length - limits.list), dayTrips: { count: dayTrips, r: limits.dayTrips }, towns, basis }, this.rev);
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
      const p = this.bySlug.get(id);
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
    let excludedApprox = 0;
    const hits: (S.NearRow & { sortKey: string })[] = [];
    for (const row of rows) {
      if (row.lat === null || row.lon === null) continue;
      if (this.isApprox(row.slug)) {
        excludedApprox++;
        continue;
      }
      const km = haversineKm(centre, { lat: row.lat, lon: row.lon });
      if (km > r) continue;
      hits.push({ ...row, distanceKm: Math.round(km * 10) / 10, bearing: bearingOf(centre, { lat: row.lat, lon: row.lon }), band: bandOf(km), basis: "estimate", sortKey: sortKey(row.name) });
    }
    hits.sort((a, b) => a.distanceKm - b.distanceKm || compareSortable(a, b));
    const paged = this.page(hits.map(({ sortKey: _s, ...row }) => row), pi.value);
    if (!paged.ok) return paged;
    return ok({ ...paged.data, centre, r, clamped, basis: { distance: "straight_line", excludedApprox } }, this.rev);
  }

  async towns(q: S.TownQuery): Promise<Result<S.TownList>> {
    const qi = check(S.townQuery, q);
    if (!qi.ok) return qi;
    if (!this.layers.towns) return fail("not_available", "The towns layer is not built yet (META-2).");
    const v = qi.value;
    const cap = S.API_LIMITS.towns.max;
    const withPlaces = (t: S.Town): S.Town => ({ ...t, places: this.data.places.filter((p) => p.detail.point && !p.detail.point.approx && haversineKm(t, p.detail.point) <= S.API_LIMITS.nearby.radius).length });
    if (v.prefix !== undefined) {
      if (!v.cc || !v.region) return fail("invalid_scope", "A town prefix needs a country (`cc`) and a region: towns load by region, never the world.");
      const keys = resolveRegion(this.data.registry, v.region, v.cc);
      if (!keys.length) return fail("not_found", "No region has that name or code.");
      const want = kebab(v.prefix);
      const hits = this.data.towns
        .filter((t) => keys.includes(`${t.cc}/${t.region}`) && kebab(t.name).startsWith(want))
        .sort((a, b) => compareCodePoints(sortKey(a.name), sortKey(b.name)) || compareCodePoints(a.id, b.id));
      return ok({ items: hits.slice(0, cap).map(withPlaces), truncated: hits.length > cap }, this.rev);
    }
    if (!v.near && !v.city) return fail("invalid_scope", "Towns need a centre (`near` or `city`) or a prefix with a country and a region.");
    const c = this.centre(v.near, v.city);
    if (!c.ok) return c;
    const { r } = this.radius(v.r, c.data.kind);
    const hits = this.data.towns
      .map((t) => ({ t, km: haversineKm(c.data, t) }))
      .filter((x) => x.km <= r && x.t.id !== v.city)
      .sort((a, b) => a.km - b.km || compareCodePoints(a.t.id, b.t.id));
    return ok({ items: hits.slice(0, cap).map(({ t, km }) => ({ ...withPlaces(t), distanceKm: Math.round(km * 10) / 10, bearing: bearingOf(c.data, t) })), truncated: hits.length > cap }, this.rev);
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
      .map((record) => ({ record, score: !want ? 0 : sortKey(record.n).startsWith(want) ? 2 : sortKey(`${record.n} ${record.x}`).includes(want) ? 1 : 0 }))
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
    const words = (qi.value.q ?? "").toLowerCase().trim();
    const rows = this.data.trips
      .map((t) => t.row)
      .filter((r) => (!countries.length || r.countries.some((c) => countries.includes(c.code))) && (!words || r.title.toLowerCase().includes(words)));
    const sorted = this.sortRows(rows.map((r) => ({ ...r, name: r.title })), qi.value.sort).map(({ name: _n, ...r }) => r);
    return this.page(sorted, pi.value);
  }

  async getTrip(slug: string, profile?: S.TripProfile): Promise<Result<S.TripDetail>> {
    const si = check(S.tripSlugInput, profile ? { slug, profile } : { slug });
    if (!si.ok) return si;
    const t = this.tripBySlug.get(slug);
    return t ? ok(t.detail, this.rev) : fail("not_found", "No public trip has that slug.");
  }

  // ---- exports -----------------------------------------------------------------------------------------------------------------

  async getExport(q: S.ExportQuery): Promise<Result<S.ExportFile>> {
    const qi = check(S.exportQuery, q);
    if (!qi.ok) return qi;
    const { type, slug, format } = qi.value;
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
    const bodies: Record<S.ExportQuery["format"], [string, string, string]> = {
      csv: ["csv", "text/csv", ["name,lat,lon,approximate", ...points.map((p) => `"${p.name.replace(/"/g, '""')}",${p.lat},${p.lon},${p.approx}`)].join("\n")],
      gpx: ["gpx", "application/gpx+xml", `<?xml version="1.0"?><gpx version="1.1" creator="stub">${points.map((p) => `<wpt lat="${p.lat}" lon="${p.lon}"><name>${esc(label(p))}</name></wpt>`).join("")}</gpx>`],
      kml: ["kml", "application/vnd.google-earth.kml+xml", `<?xml version="1.0"?><kml><Document><name>${esc(title)}</name>${points.map((p) => `<Placemark><name>${esc(label(p))}</name><Point><coordinates>${p.lon},${p.lat}</coordinates></Point></Placemark>`).join("")}</Document></kml>`],
      ics: ["ics", "text/calendar", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//stub//EN", `X-WR-CALNAME:${title}`, "END:VCALENDAR"].join("\r\n")],
      print: ["txt", "text/plain", [title, ...points.map(label)].join("\n")],
    };
    const [ext, mime, body] = bodies[format];
    return ok({ filename: `${slug}.${ext}`, mime, body, source: odbl ? "Map data: OpenStreetMap contributors (ODbL)" : "", skipped, approx }, this.rev);
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
      const exact = mine.filter((r) => r.lat !== null && !this.isApprox(r.slug));
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
    return ok(this.pins().filter((p) => p.path[0] === cc), this.rev);
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
