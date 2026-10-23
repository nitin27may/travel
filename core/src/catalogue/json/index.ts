// JsonStore: the CatalogueStore over the repo's JSON (EXECUTION-PLAN 4.1; API brief step 15). The dataset arrives through a JsonSource
// (./source.ts), so core never imports web. This class owns what the contract owns (store.ts A1 to A23): input validation, the caps
// (principle P8: inside the methods), the sort and paging rule, region/`ids`/`q` resolution, the error codes and the revision.
//
// Until phase E fills them, `near`, `nearbyForPlace`, `towns`, `city=` and `globeCity` answer `not_available` (cases K3, K4, K5, K15,
// K17 are pending on this target with the task that fills them).
import type { z } from "zod";
import * as S from "../../schema/api/index.ts";
import { scheduleTrip } from "../../schedule/schedule.ts";
import { parseTimelineUrl } from "../../schedule/profileCodec.ts";
import type { DayTimeline, Profile, ScheduleDayInput } from "../../schedule/types.ts";
import { revisionOf, servedSnapshot } from "../revision.ts";
import { fail, ok, type Result } from "../result.ts";
import { currentSlug, isWithdrawn, movedTo, regionSlugOf, resolveRegion } from "../slugs.ts";
import { PLACE_SORT_VALUES, TRIP_SORT_VALUES, sortRows } from "../sorting.ts";
import { PLACE_TEXT, TRIP_TEXT, compareCodePoints, matchesText, sortKey } from "../sortKey.ts";
import type { CatalogueStore } from "../store.ts";
import type { JsonSource, ListFilter } from "./source.ts";

export type { JsonSource, ListEngine, ListFilter, EngineCounts, SearchScope } from "./source.ts";

type Invalid = { ok: false; error: S.ApiError };

/** Parses an input with its contract schema; an invalid input is `invalid_input` with the failing paths in `details` (case K18). */
function check<T>(schema: z.ZodType<T>, input: unknown): { ok: true; value: T } | Invalid {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  const issues = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return { ok: false, error: { code: "invalid_input", message: "The request does not match the contract.", details: { issues } } };
}

const NO_TOWNS = "The towns layer is not built yet (META-2), so towns, city filters and near mode are not available.";

export class JsonStore implements CatalogueStore {
  private revPromise: Promise<string> | null = null;
  private readonly placeBySlug: Map<string, S.PlaceRow>;
  private readonly tripBySlug: Map<string, S.TripRow>;

  readonly source: JsonSource;

  constructor(source: JsonSource) {
    this.source = source;
    this.placeBySlug = new Map(source.placeRows.map((r) => [r.slug, r]));
    this.tripBySlug = new Map(source.tripRows.map((r) => [r.slug, r]));
  }

  // ---- revision ----------------------------------------------------------------------------------------------------------------

  /** The content hash of everything served (A8): rows, details, the registry, the globe, the vocabulary and the cited sources. */
  revision(): Promise<string> {
    this.revPromise ??= Promise.resolve().then(() => {
      const s = this.source;
      const placeDetails = s.placeRows.map((r) => s.placeDetail(r.slug));
      const tripDetails = s.tripRows.map((r) => s.tripDetail(r.slug));
      return revisionOf(servedSnapshot({
        dataset: { placeRows: s.placeRows, placeDetails, tripRows: s.tripRows, tripDetails },
        slugs: s.registry,
        ...s.snapshot(),
      }));
    }).catch((e) => {
      // a failure while the snapshot is built is not the store's answer for life: the next call builds it again (audit GB-A-5)
      this.revPromise = null;
      throw e;
    });
    return this.revPromise;
  }

  // ---- places ------------------------------------------------------------------------------------------------------------------

  /** One page of sorted rows, with the page-size cap (case K1). */
  private async page<T>(rows: T[], page: S.ApiPage | undefined): Promise<Result<S.Paged<T>>> {
    const pageSize = page?.pageSize ?? S.API_LIMITS.pageSize.default;
    if (pageSize > S.API_LIMITS.pageSize.max) return fail("too_large", `pageSize is at most ${S.API_LIMITS.pageSize.max}.`, { max: S.API_LIMITS.pageSize.max });
    const n = page?.page ?? 1;
    const start = (n - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);
    return ok({ items, total: rows.length, page: n, pageSize, nextPage: start + pageSize < rows.length ? n + 1 : null }, await this.revision());
  }

  /**
   * The rows a list query keeps before the engine runs, and the filter the engine gets (A16, A19, A20, A21): `q` by the sortKey rule,
   * `ids` through the registry, `region` to its canonical slug, `city` refused until the towns layer exists. An error for an ambiguous
   * region alias and for a facet key the engine cannot evaluate.
   */
  private prepare<Row extends { slug: string }>(
    rows: readonly Row[],
    q: S.PlaceQuery,
    text: (r: Row) => string[],
    engine: JsonSource["placeEngine"] | JsonSource["tripEngine"],
    space: "places" | "trips",
  ): { rows: Row[]; filter: ListFilter } | S.ApiError {
    const facets: Record<string, string[]> = {};
    const countries = (q.facets?.country ?? []).map((c) => c.toLowerCase());
    for (const [key, values] of Object.entries(q.facets ?? {})) {
      if (!values.length) continue;
      if (key === "city") return { code: "not_available", message: NO_TOWNS };
      if (!engine.knows(key)) return { code: "not_available", message: `This store cannot evaluate the facet "${key}".` };
      if (key === "region" && space === "places") {
        const slugs = new Set<string>();
        for (const v of values) {
          const hits = resolveRegion(this.source.registry, v, countries);
          if (hits.length > 1) return { code: "invalid_scope", message: `The region "${v}" names regions in more than one country; add a country.`, details: { candidates: hits } };
          slugs.add(hits.length ? regionSlugOf(hits[0]!) : v);
        }
        facets[key] = [...slugs];
      } else facets[key] = values;
    }
    const ids = q.ids?.length ? new Set(q.ids.map((id) => currentSlug(this.source.registry, id, space)).filter((s): s is string => !!s)) : null;
    const kept = rows.filter((r) => (!ids || ids.has(r.slug)) && matchesText(q.q, text(r)));
    return { rows: kept, filter: { facets, ...(q.bbox ? { bbox: q.bbox } : {}) } };
  }

  async listPlaces(q: S.PlaceQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.PlaceRow>>> {
    const qi = check(S.placeQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    const prep = this.prepare(this.source.placeRows, qi.value, PLACE_TEXT, this.source.placeEngine, "places");
    if ("code" in prep) return { ok: false, error: prep };
    const matched = this.source.placeEngine.match(prep.rows, prep.filter);
    return this.page(sortRows(matched, qi.value.sort ?? [], PLACE_SORT_VALUES, (r) => r.name), pi.value);
  }

  async countPlaces(q: S.PlaceQuery): Promise<Result<S.FacetCounts>> {
    const qi = check(S.placeQuery, q);
    if (!qi.ok) return qi;
    const prep = this.prepare(this.source.placeRows, qi.value, PLACE_TEXT, this.source.placeEngine, "places");
    if ("code" in prep) return { ok: false, error: prep };
    const engine = this.source.placeEngine;
    const matched = engine.match(prep.rows, prep.filter);
    const c = engine.counts(prep.rows, prep.filter, this.source.placeRows);
    // A22: options by count (descending), then by the sortKey of their label, then by value
    const facets = Object.fromEntries(
      Object.entries(c.facets).map(([key, opts]) => [
        key,
        [...opts].sort((a, b) => b.count - a.count || compareCodePoints(sortKey(a.label), sortKey(b.label)) || compareCodePoints(a.value, b.value)),
      ]),
    );
    return ok({ n: matched.length, unchecked: c.unchecked, scope: c.scope, total: this.source.placeRows.length, facets, gaps: c.gaps, notes: c.notes }, await this.revision());
  }

  async getPlace(slug: string): Promise<Result<S.PlaceLookup>> {
    const si = check(S.placeSlugInput, { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.source.registry, slug);
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, await this.revision());
    if (isWithdrawn(this.source.registry, slug)) return fail("not_found", "That place has been withdrawn.");
    const d = this.placeBySlug.has(slug) ? this.source.placeDetail(slug) : null;
    return d ? ok(d, await this.revision()) : fail("not_found", "No place has that slug.");
  }

  async nearbyForPlace(slug: string): Promise<Result<S.NearbyBlock>> {
    const si = check(S.placeSlugInput, { slug });
    if (!si.ok) return si;
    return fail("not_available", "Nearby lands in phase E (N2).");
  }

  async near(q: S.NearQuery, page?: S.ApiPage): Promise<Result<S.NearPage>> {
    const qi = check(S.nearQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    return fail("not_available", "Near mode lands in phase E (N2).");
  }

  async towns(q: S.TownQuery): Promise<Result<S.TownList>> {
    const qi = check(S.townQuery, q);
    if (!qi.ok) return qi;
    return fail("not_available", NO_TOWNS);
  }

  // ---- search ------------------------------------------------------------------------------------------------------------------

  async parse(input: S.ParseInput): Promise<Result<S.ParsedQuery>> {
    const pi = check(S.parseInput, input);
    if (!pi.ok) return pi;
    return ok(this.source.parse(pi.value), await this.revision());
  }

  async search(q: S.SearchQuery): Promise<Result<S.SearchResult>> {
    const qi = check(S.searchQuery, q);
    if (!qi.ok) return qi;
    const limit = qi.value.limit ?? S.API_LIMITS.searchLimit.default;
    if (limit > S.API_LIMITS.searchLimit.max) return fail("too_large", `limit is at most ${S.API_LIMITS.searchLimit.max}.`, { max: S.API_LIMITS.searchLimit.max });
    return ok(this.source.search(qi.value.q, qi.value.scope ?? {}, limit), await this.revision());
  }

  // ---- trips -------------------------------------------------------------------------------------------------------------------

  async listTrips(q: S.TripQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.TripRow>>> {
    const qi = check(S.tripQuery, q);
    if (!qi.ok) return qi;
    const pi = check(S.apiPage, page ?? {});
    if (!pi.ok) return pi;
    const prep = this.prepare(this.source.tripRows, qi.value, TRIP_TEXT, this.source.tripEngine, "trips");
    if ("code" in prep) return { ok: false, error: prep };
    const matched = this.source.tripEngine.match(prep.rows, prep.filter);
    return this.page(sortRows(matched, qi.value.sort ?? [], TRIP_SORT_VALUES, (r) => r.title), pi.value);
  }

  async getTrip(slug: string, profile?: S.TripProfile): Promise<Result<S.TripLookup>> {
    const si = check(S.tripSlugInput, profile ? { slug, profile } : { slug });
    if (!si.ok) return si;
    const moved = movedTo(this.source.registry, slug, "trips");
    if (moved) return ok({ moved: moved.slug, ref: moved.key }, await this.revision());
    const d = this.tripBySlug.has(slug) ? this.source.tripDetail(slug) : null;
    if (!d) return fail("not_found", "No public trip has that slug.");
    return ok(this.scheduled(d, si.value.profile), await this.revision());
  }

  /**
   * The detail's days scheduled for a profile (the timeline's URL keys). An unknown value falls back to the plan's own setting, as the
   * page does. Visitor additions (`add`) need the place pages and are not applied here.
   */
  private scheduled(d: S.TripDetail, profile: S.TripProfile | undefined): S.TripDetail {
    const keys = Object.entries(profile ?? {}).filter(([, v]) => v !== undefined && v !== "");
    if (!keys.length || !d.schedule) return d;
    const inputs = d.days.map((day) => day.scheduleInput);
    if (inputs.some((i) => i === null)) return d;
    const state = parseTimelineUrl(new URLSearchParams(keys as [string, string][]), d.schedule.defaultProfile as unknown as Profile);
    const timelines = scheduleTrip(inputs as unknown as ScheduleDayInput[], state.profile, state.overrides);
    return { ...d, schedule: { ...d.schedule, timelines: timelines as unknown as DayTimeline[] } } as unknown as S.TripDetail;
  }

  // ---- exports -----------------------------------------------------------------------------------------------------------------

  async getExport(q: S.ExportQuery): Promise<Result<S.ExportFile>> {
    const qi = check(S.exportQuery, q);
    if (!qi.ok) return qi;
    const { type, slug } = qi.value;
    const live = type === "place" ? this.placeBySlug.has(slug) : this.tripBySlug.has(slug);
    const file = live ? this.source.exportFile(qi.value) : null;
    return file ? ok(file, await this.revision()) : fail("not_found", `No public ${type} has that slug.`);
  }

  // ---- globe -------------------------------------------------------------------------------------------------------------------

  async globeTree(): Promise<Result<S.GlobeTree>> {
    return ok(this.source.globe.tree(), await this.revision());
  }

  async globePins(cc: string): Promise<Result<S.LightPin[]>> {
    const ci = check(S.globePinsInput, { cc });
    if (!ci.ok) return ci;
    return ok(this.source.globe.pins(cc) ?? [], await this.revision());
  }

  async globeCard(key: string): Promise<Result<S.GlobeCardFile>> {
    const ki = check(S.globeCardInput, { key });
    if (!ki.ok) return ki;
    const card = this.source.globe.card(key);
    return card ? ok(card, await this.revision()) : fail("not_found", "Nothing on the globe has that key.");
  }

  async globeFeature(id: string): Promise<Result<S.GlobeFeature>> {
    const ii = check(S.globeIdInput, { id });
    if (!ii.ok) return ii;
    const f = this.source.globe.feature(id);
    return f ? ok(f, await this.revision()) : fail("not_found", "No feature has that id.");
  }

  async globeLine(id: string): Promise<Result<S.GlobeLine>> {
    const ii = check(S.globeIdInput, { id });
    if (!ii.ok) return ii;
    const l = this.source.globe.line(id);
    return l ? ok(l, await this.revision()) : fail("not_found", "No line has that id.");
  }

  async globeCity(townId: string): Promise<Result<S.GlobeCity>> {
    const ti = check(S.globeCityInput, { townId });
    if (!ti.ok) return ti;
    return fail("not_available", "City outlines need the towns layer (GLB2 row 9.3).");
  }

  // ---- report ------------------------------------------------------------------------------------------------------------------

  async report(input: S.ReportInput): Promise<Result<S.ReportResult>> {
    const ri = check(S.reportInput, input);
    if (!ri.ok) return ri;
    const url = this.source.reportLink(ri.value.page);
    return url ? ok({ kind: "link", url }, await this.revision()) : fail("not_available", "Reporting is off.");
  }
}
