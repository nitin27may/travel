// `CatalogueStore`: the one read interface of the public catalogue (EXECUTION-PLAN 4.2; PHASE-B-START sections 5 and 6).
//
//   route handler -> respond() -> CatalogueStore
//                                   |-- StubStore      (core/src/catalogue/stub, tests; API-1a)
//                                   |-- JsonStore      (core/src/catalogue/json, the repo JSON; API-1b)
//                                   |-- SupabaseStore  (core/src/catalogue/supabase, later; SRV-0)
//
// Every input and output is a Zod schema in core/src/schema/api (CATALOGUE_CONTRACT below names them per method). Every method
// enforces its own caps (principle P8: inside the function, tested by the contract kit in core/test/catalogue/contract), validates its
// input with its schema (a server component may call a store directly, without a handler), and returns `Result<T>`: it never throws
// for a request it can answer with an error code.
//
// ---- Decisions (API-1a, 22 Oct 2026; each is the option PHASE-B-START implies, listed in the hand-back) ----------------------------
//
// A1  Two classes of cap (amended in fix round 1, review R-9). RESULT-SIZE caps refuse: `pageSize` above API_LIMITS.pageSize.max and
//     `limit` above API_LIMITS.searchLimit.max answer `too_large` (413) with `details.max`, one rule for every paged method (case K1);
//     their input schemas carry shape only. The near radius is the one clamp (`clamped: true`, case K3). REQUEST-SIZE caps
//     (API_LIMITS.query.*, reportText) are schema `.max()` rules and answer `invalid_input` (400): such a request is malformed.
//     limits.ts states the same two classes.
// A2  `PlaceRow` (the API row) is the shipped list row plus `ref` and `approx` (R-17), 43 keys. The row the site ships today (web PlaceListRow, the
//     prerendered shards and the list page) stays at its 41 keys: adding `ref` there would add bytes to every list page and change
//     what web/tests/data/light-data.test.ts pins, and nothing in the site reads it yet. web/components/places/rows.ts derives its type
//     and PLACE_LIST_KEYS from `placeListRow`; the API allowlist is PLACE_ROW_KEYS. API-1b's StaticAdapter adds `ref` when it maps a
//     shipped row to a PlaceRow (the dataset's refBySlug has it).
// A3  `ref` of a place is its identity key: the capture ref verbatim when the page is built from a capture record, else `loc:<id>`,
//     else `proto:<id>` (D-B2). A locations or prototype page that is merely MATCHED to a capture record (facets by name or proto id)
//     keeps `loc:`/`proto:`: the match depends on the slug, so it cannot be the identity the slug hangs on. When such a page becomes a
//     capture page, `slugs.ts alias` carries its slug over (D-B1's identity change).
// A4  `ref` of a trip is `trip/<trip id>` (the capture and trip-file id, which is also the public slug); trip-scoped refs already read
//     `trip/<id>/<item key>`.
// A5  The slug registry (`catalogue-slugs/2`) keys are those refs: 363 place keys today (359 pages plus 4 merged records, recorded in
//     `places.merged` so their slugs answer 308 to the survivor, R-1), the trips in their own space (R-18), `formerKeys` for every key
//     `alias` replaced (R-2; SupabaseStore loads it as `entity_alias`), and `withdrawn` tombstones (R-3). Its `regions` section pins
//     `<cc>/<region slug>` with the region's spellings; region aliases resolve through `resolveRegion` (D-B3). `city` takes a town id
//     and answers `not_available` until the towns layer exists (META-2).
// A6  The detail carries provenance as `apiVal` with registry ids plus one `citations` table keyed by registry id (D-B4). The page's
//     display words (basis label, look) are derived by the reader from `basis` and `state`, so they are not in the contract; API-1b
//     maps the page model's PVal both ways.
// A7  Rows and provenance values are strict objects (the allowlist); the scheduler's own shapes inside a trip detail (scheduleInput,
//     timelines, the default profile) are open objects: the scheduler owns them, and they hold no catalogue text.
// A8  `revision()` hashes the canonical JSON of `servedSnapshot()` (revision.ts, R-7): the dataset, the slug registry, the globe files,
//     the towns layer, the parse vocabulary and the cited source entries. A store computes it once per load, from parsed content, never
//     file bytes or mtimes.
// A8b The revision of a response comes from the SAME snapshot as its data (R-8). JsonStore loads once and swaps the whole snapshot.
//     SupabaseStore reads data and `catalogue_meta` in one SQL function or one REPEATABLE READ transaction, and its loader swaps the
//     projections and the revision in one transaction.
// A9  Every method is async: SupabaseStore answers over the network, and the interface does not change when it lands.
// A10 `report()` answers `not_available` when reporting is off, not `{kind:'off'}`: the error code is the API's way to say "off".
// A11 Store methods validate their input with the same schemas the handlers use (case K18 at store level); the handler's 400 and the
//     store's `invalid_input` are one rule.
// A12 A distance from a centre is `distanceKm` everywhere (NearRow, NearbyItem, Town), not `km`: the row already has `km`, the trail
//     length, and spreading a row into a near row would overwrite it (the contract kit caught exactly that).
// A13 `excludedApprox` counts the approximate rows inside the query's scope (its filters), whatever their distance: an approximate point
//     has no trustworthy distance, so "inside the radius" cannot be known for it.
// A14 `kebab` moved to core with the two assignment functions (web/lib/public/slugs.ts re-exports all three): one copy of the rule the
//     slugs are made of. The registry's first build reproduces today's assignment exactly (359 page slugs, 78 redirects, 41 regions, the
//     380 sitemap URLs), proved against a dump of unmodified `main` 84bc50b.
// A15 Sort (R-4): `sort` takes only PLACE_SORT_KEYS or TRIP_SORT_KEYS (anything else is `invalid_input`); values and the ordering rule
//     (numbers numerically, strings by sortKey, nulls LAST in both directions, then sortKey(name) ascending, then ref ascending) live in
//     sorting.ts, which every store calls or reproduces with stored keys (case K11.sort).
// A16 Free text (R-11): `q` matches when sortKey(q) is a substring of sortKey of the row's text fields (sortKey.ts matchesText,
//     PLACE_TEXT, TRIP_TEXT), in lists and in search alike.
// A17 Distance (R-12): distance.ts is the rule: core haversine, inclusion on the unrounded km, `distanceKm` rounded to 0.1, order by
//     rounded distance then sortKey(name) then ref. SQL may only prefilter; core computes the values.
// A18 Privacy (R-15): the scrub happens before data reaches a store (the dataset builder now, the loader later); a store returns
//     scrubbed data, which K7 proves at store level. `respond()` runs the same DETECTOR on every body and fails closed (500 `internal`,
//     logged); it never rewrites a body, so a page and the API cannot differ and the ETag describes the bytes sent.
// A19 `ids=` (R-19) holds slugs a client saved: each resolves through the registry first (a retired or merged slug to its current
//     slug, a withdrawn one to nothing), then filters.
// A20 Regions (R-20): an alias matching regions in two countries without a `country` facet is `invalid_scope` with the candidates in
//     `details.candidates`; a pinned region whose last place goes stays pinned and `slugs.ts --check` only warns.
// A21 Facets (R-23) mean what the core query engine says (web/lib/entities/filter.ts now, core/src/query after API-2): every value of
//     one key is OR, keys are AND, `region` after alias resolution, `k` a type or a type prefix, list fields (tags, trips, season,
//     flags) match on any member. A store that cannot evaluate a key answers `not_available`, never ignores it.
// A22 Counts (R-22): `countPlaces(q).n` equals listPlaces(q).total. `facets[key]` lists the options of every facet key with a live count
//     computed with every OTHER key applied (a key never narrows its own options), options ordered by count descending then
//     sortKey(label); a selected value with no rows appears with count 0. `scope` applies only the scope keys (`country`, `k`);
//     `total` is the catalogue; `unchecked` counts rows that fail only on a gap of a parsed constraint (H1); `gaps[key]` counts the rows
//     whose value for `key` is unknown that match every other key.
// A23 Volume (R-24): the caps bound one response, not a client. Paging every list and reading every detail can still copy the catalogue,
//     as EXECUTION-PLAN's risk "P8 by API" accepts; a rate limit comes with hosting.
//
// ---- Carried to API-1b (review of 22 Oct; must be done there, not deferred further) --------------------------------------------
//
// C1  JsonStore builds `servedSnapshot()` from everything it reads (dataset, registry, globe files through web/lib/public/globe.ts's
//     readers, vocabulary, cited sources) and returns that revision with every result (A8, A8b).
// C2  respond() calls httpCodec.fromSearchParams for every GET, OpenAPI documents the `*HttpQuery` schemas (not the store inputs), and
//     the detector of A18 runs on every body, failing closed.
// C3  K12 on real data: map `src` through each lane file's own source table before the page scrub blanks local urls (184 values on the
//     Rockies pages cite "this repo" sources), and K12 now also requires every `src` to be a key of the detail's `citations` (R-10).
//     `fact.provenance` stays display text that names no source id.
// C4  The json target runs over a COPY of the registry with one planted rename and one planted merge, so K9 and K9.merged run on real
//     data (R-21); its facts list the unlisted trips K7 must also scan.
// C5  JsonStore's filters and counts call the web query engine (A21, A22) and the stub-vs-engine corpus case is added to the kit when
//     the engine reaches core in API-2 (R-22, R-23 parity).
// C6  K7 extended to unlisted trips and the home-point check (R-13: the web runner, with the point read from the local untracked file
//     the privacy test already uses; no new environment variable). The Whitby ruling (Q50) stays with the owner before META-2.
// C7  `rowReads` for JsonStore is counted by the target (a FileStore spy), not by the store (R-28).
import type { z } from "zod";
import * as S from "../schema/api/index.ts";
import type { Result } from "./result.ts";

export interface CatalogueStore {
  /**
   * The content hash of everything this store serves: `servedSnapshot()` (D-B6, A8, revision.ts). Equal for the same data in
   * two processes and in two store kinds; changes when any served value changes; never depends on a file's mtime (case K10). Handlers use
   * it as the ETag and answer `If-None-Match` with 304 (case K19).
   */
  revision(): Promise<string>;

  /**
   * One page of the Places list for a query. `page.pageSize` defaults to API_LIMITS.pageSize.default (48); above
   * API_LIMITS.pageSize.max (100) the answer is `too_large` (case K1). Rows carry exactly PLACE_ROW_KEYS (case K2) and a stable `ref`
   * (case K8). Sorted by `q.sort` (PLACE_SORT_KEYS, A15), then by sortKey(name), then by `ref` in code-point order, so every store cuts
   * page 2 at the same row (D-B5, cases K11, K11.sort). `q.q` follows A16, facets A21, `ids` A19. `facets.region` accepts every alias and filters on the canonical slug (case K14); `facets.city`
   * answers `not_available` until the towns layer exists (case K15). A page past the last answers an empty `items` with the true total.
   */
  listPlaces(q: S.PlaceQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.PlaceRow>>>;

  /** Counts only, no rows: the facet options with live counts, the "not checked yet" count, the scope and the catalogue total. Same query rules as listPlaces. */
  countPlaces(q: S.PlaceQuery): Promise<Result<S.FacetCounts>>;

  /**
   * One place: its page model, or `{moved, ref}` when `slug` is retired or belongs to a merged record (the handler answers 308 to the
   * current slug, cases K9, K9.merged), or `not_found` (unknown, or withdrawn: R-3, K9.withdrawn). Every point carries `pointRole` and `approx` (case K16); every `src` is a registry id resolved in `citations`
   * (cases K12, K13).
   */
  getPlace(slug: string): Promise<Result<S.PlaceLookup>>;

  /**
   * The "Around here" block of one place: at most API_LIMITS.nearby.list (8) places within API_LIMITS.nearby.radius (25) km, the count
   * of day trips to API_LIMITS.nearby.dayTrips km, the nearest towns. Approximate points are never listed and `basis.excludedApprox`
   * counts them (case K17); a place with no point or an approximate one answers `state` without items. `not_available` until the nearby
   * module lands (phase E, N2); `not_found` for an unknown slug.
   */
  nearbyForPlace(slug: string): Promise<Result<S.NearbyBlock>>;

  /**
   * Places around a centre, nearest first. Needs a resolvable centre: no `near` and no `city` is `invalid_scope` (case K5); a token or
   * town that does not resolve is `not_found`, answered before any shard or row is read (case K4). `r` defaults to
   * API_LIMITS.nearRadius.default (25; 50 for an area centre) and is clamped to API_LIMITS.nearRadius.max (100) with `clamped: true`
   * (case K3). Approximate points are excluded and counted in `basis` (case K17). Same paging and filter rules as listPlaces.
   * `not_available` until phase E (N2).
   */
  near(q: S.NearQuery, page?: S.ApiPage): Promise<Result<S.NearPage>>;

  /**
   * Towns of the towns layer: around a centre (`near` or `city`, `r` clamped as in `near`), or by name prefix inside one region
   * (`prefix` with `cc` and `region`; a prefix without a region is `invalid_scope`). At most API_LIMITS.towns.max (200) rows, with
   * `truncated` when more match. `not_available` until META-2 builds the layer (case K15).
   */
  towns(q: S.TownQuery): Promise<Result<S.TownList>>;

  /** Reads a human query as filters (smart search). Pure: the same words and vocabulary give the same parse. */
  parse(input: S.ParseInput): Promise<Result<S.ParsedQuery>>;

  /** Search by name. `limit` (hits per group) defaults to API_LIMITS.searchLimit.default; above API_LIMITS.searchLimit.max (50) `too_large`. */
  search(q: S.SearchQuery): Promise<Result<S.SearchResult>>;

  /** One page of the Trips list. Same paging, sorting and cap rules as listPlaces; rows carry exactly TRIP_ROW_KEYS (case K2). Public trips only. */
  listTrips(q: S.TripQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.TripRow>>>;

  /**
   * One trip, its days scheduled for `profile` (the timeline's URL keys; an unknown value falls back to the default). Dateless. A retired
   * trip slug answers `{moved, ref}` (R-18); a withdrawn one `not_found`.
   */
  getTrip(slug: string, profile?: S.TripProfile): Promise<Result<S.TripLookup>>;

  /**
   * One export file for ONE trip or place (case K6): never a list, never two slugs. The licence guard holds: points whose source is not
   * ours to give are left out and counted in `skipped`; approximate points are labelled and counted in `approx`. `not_found` for an
   * unknown or unlisted item.
   */
  getExport(q: S.ExportQuery): Promise<Result<S.ExportFile>>;

  /** The area tree with counts and no pins. */
  globeTree(): Promise<Result<S.GlobeTree>>;
  /** The light pins of ONE country (lower-case ISO alpha-2). An unknown country answers an empty list. */
  globePins(cc: string): Promise<Result<S.LightPin[]>>;
  /** The card and pin behind one `place:<slug>` or `trip:<slug>` key, or `not_found`. */
  globeCard(key: string): Promise<Result<S.GlobeCardFile>>;
  /** One gazetteer feature by id, or `not_found`. */
  globeFeature(id: string): Promise<Result<S.GlobeFeature>>;
  /** One feature's line or outline by id, or `not_found`. */
  globeLine(id: string): Promise<Result<S.GlobeLine>>;
  /** One city's outline by town id; `not_available` until the towns layer exists (GLB2 row 9.3). */
  globeCity(townId: string): Promise<Result<S.GlobeCity>>;

  /** Report a problem on a page: the feedback form's link now, a stored report later. No personal data is kept. `not_available` when reporting is off. */
  report(input: S.ReportInput): Promise<Result<S.ReportResult>>;
}

export type CatalogueMethod = keyof CatalogueStore;

/**
 * Each method's schemas and its path in EXECUTION-PLAN 4.4: the table respond() and the OpenAPI builder read (API-1b), so a handler, the
 * document and the store cannot disagree. `query` is what the URL carries (flat strings; OpenAPI documents it; httpCodec.ts decodes it,
 * R-5); `input` is the store's input the codec produces; `output` is the `data` of a successful Result. Path-only methods have no query.
 */
export const CATALOGUE_CONTRACT = {
  revision: { http: "GET /api/v1/health", input: null, output: S.apiRevision },
  listPlaces: { http: "GET /api/v1/places", query: S.listHttpQuery, input: S.placeQuery.extend(S.apiPage.shape), output: S.paged(S.placeRow) },
  countPlaces: { http: "GET /api/v1/places/counts", query: S.listHttpQuery, input: S.placeQuery, output: S.facetCounts },
  getPlace: { http: "GET /api/v1/places/{slug}", input: S.placeSlugInput, output: S.placeLookup },
  nearbyForPlace: { http: "GET /api/v1/places/{slug}/nearby", input: S.placeSlugInput, output: S.nearbyBlock },
  near: { http: "GET /api/v1/near", query: S.nearHttpQuery, input: S.nearQuery.extend(S.apiPage.shape), output: S.nearPage },
  towns: { http: "GET /api/v1/towns", query: S.townsHttpQuery, input: S.townQuery, output: S.townList },
  parse: { http: "GET /api/v1/parse", query: S.parseHttpQuery, input: S.parseInput, output: S.parsedQuery },
  search: { http: "GET /api/v1/search", query: S.searchHttpQuery, input: S.searchQuery, output: S.searchResult },
  listTrips: { http: "GET /api/v1/trips", query: S.listHttpQuery, input: S.tripQuery.extend(S.apiPage.shape), output: S.paged(S.tripRow) },
  getTrip: { http: "GET /api/v1/trips/{slug}", query: S.profileHttpQuery, input: S.tripSlugInput, output: S.tripLookup },
  getExport: { http: "GET /api/v1/export/{type}/{slug}", query: S.exportHttpQuery, input: S.exportQuery, output: S.exportFile },
  globeTree: { http: "GET /api/v1/globe/tree", input: null, output: S.globeTree },
  globePins: { http: "GET /api/v1/globe/pins/{cc}", input: S.globePinsInput, output: S.lightPin.array() },
  globeCard: { http: "GET /api/v1/globe/card/{key}", input: S.globeCardInput, output: S.globeCardFile },
  globeFeature: { http: "GET /api/v1/globe/feature/{id}", input: S.globeIdInput, output: S.globeFeature },
  globeLine: { http: "GET /api/v1/globe/feature/{id}/line", input: S.globeIdInput, output: S.globeLine },
  globeCity: { http: "GET /api/v1/globe/city/{townId}", input: S.globeCityInput, output: S.globeCity },
  report: { http: "POST /api/v1/report", input: S.reportInput, output: S.reportResult },
} as const satisfies Record<CatalogueMethod, { http: string; query?: z.ZodType; input: z.ZodType | null; output: z.ZodType }>;

export const CATALOGUE_METHODS = Object.keys(CATALOGUE_CONTRACT) as CatalogueMethod[];
