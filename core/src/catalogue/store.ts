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
// A1  Caps refuse, except the radius. `pageSize` above API_LIMITS.pageSize.max and `limit` above API_LIMITS.searchLimit.max answer
//     `too_large` (413); one rule for every paged method (case K1). The near radius is the one clamp (`clamped: true`, case K3), as the
//     nearby spec 5.3 decides. Input schemas carry shape only, so a handler never answers 400 for what the store answers 413 for.
// A2  `PlaceRow` (the API row) is the shipped list row plus `ref`, 42 keys. The row the site ships today (web PlaceListRow, the
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
// A5  The slug registry keys are those refs (363 today: 359 pages plus 4 merged records whose slugs redirect). Its `regions` section
//     pins `<cc>/<region slug>` with the region's spellings; region aliases resolve through `resolveRegion` (D-B3). `city` takes a
//     town id and answers `not_available` until the towns layer exists (META-2).
// A6  The detail carries provenance as `apiVal` with registry ids plus one `citations` table keyed by registry id (D-B4). The page's
//     display words (basis label, look) are derived by the reader from `basis` and `state`, so they are not in the contract; API-1b
//     maps the page model's PVal both ways.
// A7  Rows and provenance values are strict objects (the allowlist); the scheduler's own shapes inside a trip detail (scheduleInput,
//     timelines, the default profile) are open objects: the scheduler owns them, and they hold no catalogue text.
// A8  `revision()` hashes the canonical JSON of the served dataset plus the slug registry (revision.ts). A store computes it once per
//     load. JsonStore hashes what it serves (the dataset object), not the files, so an mtime never moves it.
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
import type { z } from "zod";
import * as S from "../schema/api/index.ts";
import type { Result } from "./result.ts";

export interface CatalogueStore {
  /**
   * The content hash of everything this store serves: the dataset plus the slug registry (D-B6, revision.ts). Equal for the same data in
   * two processes and in two store kinds; changes when any served value changes; never depends on a file's mtime (case K10). Handlers use
   * it as the ETag and answer `If-None-Match` with 304 (case K19).
   */
  revision(): Promise<string>;

  /**
   * One page of the Places list for a query. `page.pageSize` defaults to API_LIMITS.pageSize.default (48); above
   * API_LIMITS.pageSize.max (100) the answer is `too_large` (case K1). Rows carry exactly PLACE_ROW_KEYS (case K2) and a stable `ref`
   * (case K8). Sorted by `q.sort` (descriptor keys), then by sortKey(name), then by `ref` in code-point order, so every store cuts page 2
   * at the same row (D-B5, case K11). `facets.region` accepts every alias and filters on the canonical slug (case K14); `facets.city`
   * answers `not_available` until the towns layer exists (case K15). A page past the last answers an empty `items` with the true total.
   */
  listPlaces(q: S.PlaceQuery, page?: S.ApiPage): Promise<Result<S.Paged<S.PlaceRow>>>;

  /** Counts only, no rows: the facet options with live counts, the "not checked yet" count, the scope and the catalogue total. Same query rules as listPlaces. */
  countPlaces(q: S.PlaceQuery): Promise<Result<S.FacetCounts>>;

  /**
   * One place: its page model, or `{moved, ref}` when `slug` is retired (the handler answers 308 to the current slug, case K9), or
   * `not_found`. Every point carries `pointRole` and `approx` (case K16); every `src` is a registry id resolved in `citations`
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

  /** One public trip, its days scheduled for `profile` (the timeline's URL keys; an unknown value falls back to the default). Dateless. */
  getTrip(slug: string, profile?: S.TripProfile): Promise<Result<S.TripDetail>>;

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
 * Each method's input and output schemas, and its path in EXECUTION-PLAN 4.4: the table respond() and the OpenAPI builder read (API-1b),
 * so a handler, the document and the store cannot disagree. `input` is the object a handler parses from the request (path and query
 * together); `output` is the `data` of a successful Result.
 */
export const CATALOGUE_CONTRACT = {
  revision: { http: "GET /api/v1/health", input: null, output: S.apiRevision },
  listPlaces: { http: "GET /api/v1/places", input: S.placeQuery.extend(S.apiPage.shape), output: S.paged(S.placeRow) },
  countPlaces: { http: "GET /api/v1/places/counts", input: S.placeQuery, output: S.facetCounts },
  getPlace: { http: "GET /api/v1/places/{slug}", input: S.placeSlugInput, output: S.placeLookup },
  nearbyForPlace: { http: "GET /api/v1/places/{slug}/nearby", input: S.placeSlugInput, output: S.nearbyBlock },
  near: { http: "GET /api/v1/near", input: S.nearQuery.extend(S.apiPage.shape), output: S.nearPage },
  towns: { http: "GET /api/v1/towns", input: S.townQuery, output: S.townList },
  parse: { http: "GET /api/v1/parse", input: S.parseInput, output: S.parsedQuery },
  search: { http: "GET /api/v1/search", input: S.searchQuery, output: S.searchResult },
  listTrips: { http: "GET /api/v1/trips", input: S.tripQuery.extend(S.apiPage.shape), output: S.paged(S.tripRow) },
  getTrip: { http: "GET /api/v1/trips/{slug}", input: S.tripSlugInput, output: S.tripDetail },
  getExport: { http: "GET /api/v1/export/{type}/{slug}", input: S.exportQuery, output: S.exportFile },
  globeTree: { http: "GET /api/v1/globe/tree", input: null, output: S.globeTree },
  globePins: { http: "GET /api/v1/globe/pins/{cc}", input: S.globePinsInput, output: S.lightPin.array() },
  globeCard: { http: "GET /api/v1/globe/card/{key}", input: S.globeCardInput, output: S.globeCardFile },
  globeFeature: { http: "GET /api/v1/globe/feature/{id}", input: S.globeIdInput, output: S.globeFeature },
  globeLine: { http: "GET /api/v1/globe/feature/{id}/line", input: S.globeIdInput, output: S.globeLine },
  globeCity: { http: "GET /api/v1/globe/city/{townId}", input: S.globeCityInput, output: S.globeCity },
  report: { http: "POST /api/v1/report", input: S.reportInput, output: S.reportResult },
} as const satisfies Record<CatalogueMethod, { http: string; input: z.ZodType | null; output: z.ZodType }>;

export const CATALOGUE_METHODS = Object.keys(CATALOGUE_CONTRACT) as CatalogueMethod[];
