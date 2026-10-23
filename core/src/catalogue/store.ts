// `CatalogueStore`: the one read interface of the public catalogue (EXECUTION-PLAN 4.2; PHASE-B-START sections 5 and 6).
//
// API-3b (23 Oct 2026) filled A25 to A39 in JsonStore, StubStore and the route handlers: parsed counts (mergeParsed), listUnchecked, searchCards,
// tripLegs (json/legs.ts), the json and print exports, the revision from inputs (A30), the pins cap (A36) and the town guard at load (A33).
// API-3c (23 Oct 2026) rewrote A33 (towns shown exactly, accepted by gazetteer identity), extended A39 and added A40 (echoes).
// Where each lives: JsonStore core/src/catalogue/json/index.ts over a JsonSource (web/lib/server/source.ts); StubStore core/src/catalogue/stub/.
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
// A3  `ref` of a place is its identity key: the capture ref verbatim when the page is built from a capture record, else `place/<slug>`
//     (amended by A24; it was `loc:<id>` / `proto:<id>`, D-B2). A locations or prototype page that is merely MATCHED to a capture record
//     (facets by name or proto id) keeps its `place/<slug>`: the match depends on the slug, so it cannot be the identity the slug hangs
//     on. When such a page becomes a capture page, `slugs.ts alias place/<slug> <capture ref>` carries its slug over (D-B1's identity
//     change) and the old ref stays resolvable through `formerKeys`.
// A4  `ref` of a trip is `trip/<trip id>` (the capture and trip-file id, which is also the public slug); trip-scoped refs already read
//     `trip/<id>/<item key>`.
// A5  The slug registry (`catalogue-slugs/2`) keys are those refs (never a private origin key, A24): 363 place keys today (359 pages plus 4 merged records, recorded in
//     `places.merged` so their slugs answer 308 to the survivor, R-1), the trips in their own space (R-18), `formerKeys` for every key
//     `alias` replaced (R-2; SupabaseStore loads it as `entity_alias`), and `withdrawn` tombstones (R-3). Its `regions` section pins
//     `<cc>/<region slug>` with the region's spellings; region aliases resolve through `resolveRegion` (D-B3). `city` takes a town id
//     and answers `not_available` until the towns layer exists (META-2).
// A6  The detail carries provenance as `apiVal` with registry ids plus one `citations` table keyed by registry id (D-B4). The page's
//     display words (basis label, look) are derived by the reader from `basis` and `state`, so they are not in the contract; API-1b
//     maps the page model's PVal both ways.
// A7  Rows and provenance values are strict objects (the allowlist); the scheduler's own shapes inside a trip detail (scheduleInput,
//     timelines, the default profile) are open objects: the scheduler owns them, and they hold no catalogue text.
// A8  (Superseded for JsonStore by A30; StubStore keeps it.) `revision()` hashes the canonical JSON of `servedSnapshot()` (revision.ts, R-7): the dataset, the slug registry, the globe files,
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
// A16 Free text (R-11, amended 23 Oct 2026 by HYG on review API3-R-7). ONE rule for the `q` of listPlaces, countPlaces, listUnchecked,
//     listTrips and the filters of searchCards: a row matches when EVERY word of q (lower case, split on white space) is a substring of
//     the row's HAYSTACK, lower-cased and NOT accent-folded, exactly what the browser list has always done (core/src/query/text.ts:
//     queryWords, placeHaystack, tripHaystack, matchesFreeText). A place's haystack is name, area, region, country name, tag labels,
//     kind label and kind; a trip's is title, region, country name and first base. It replaces the first wording of A16 (sortKey(q) a
//     substring of sortKey of name, area and region, accents folded), which no page ever used: it made the server count 20 where the
//     list showed 22 for "lake", and it is why 3b kept free-text states in the browser. The ApiAdapter no longer does (api.ts);
//     only an advanced filter or a saved view, which are the browser's grammar, still count locally. `search` (typeahead) is its own
//     rule and keeps sortKey (sortKey.ts matchesText). SupabaseStore: the loader writes the haystack lower-cased in a column, SQL
//     prefilters with `ILIKE ALL` over the words (escaped), core confirms with `matchesFreeText`. Case K28 holds every store to it.
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
// A24 Origin refs (REF1, owner ruling 23 Oct 2026, audit GB-B-3): no public output may tell which places come from the owner's wishlist.
//     - Rule. A page built from no capture record (74 from data/locations, 41 from the old prototype) has the ref `place/<slug>`, minted
//       ONCE from the slug it held when first pinned. The registry pins that key like any other, so a later `rename` changes the slug
//       and keeps the ref (stable, opaque). Capture pages keep their capture ref; trips stay `trip/<slug>` (A4).
//     - Private side. The link `loc:<id>` / `proto:<id>` -> `place/<slug>` lives only in data/locations/page-keys.json (ORIGIN_KEYS_PATH),
//       next to the wishlist that already holds the same fact. Only the dataset builder reads it, and only `slugs.ts build`, `reorigin`
//       and `migrate-origins` write it. data/catalogue/slugs.json may be published, so `registryProblems` refuses any origin key in it
//       and `aliasKey` refuses one. A wishlist id that changes is `slugs.ts reorigin <old> <new>`: the page keeps ref and slug.
//     - No former keys for the old refs. `migrate-origins` rekeyed the 115 `loc:`/`proto:` keys with NO formerKeys entries. That is safe:
//       those refs existed only in responses of an API that was never deployed (the live site is the legacy one), saved views, shares
//       and `ids=` carry slugs (A19), and the slugs did not change. A former-key entry would have published the fact the rekey hides.
//     - Later capture record. `slugs.ts alias place/<slug> <capture ref>`; `place/<slug>` stays in formerKeys and resolves (R-2): a
//       public-safe string. Where the capture migration already named a matched record `place/<slug>` (43 of the 115), the page ref
//       equals that record's ref: the same place, one identity.
//     - Guards. The builder fails when two pages share a ref, a `place/<slug>` is another page's capture ref, or a ref is an origin key
//       (places.ts assertRefsDistinct). `apiRef` requires `<layer>/...`, and the privacy detector (ORIGIN_REF) fails respond() closed on
//       any `loc:`/`proto:` value or map key; case K7 asserts it for every method, and the web privacy test for every published file.
//     - Known residue (not refs, owner to rule): web/redirects.json and the page routes keep the 74 old `/places/<cc>/<region>/<area>/
//       <place>/` redirects, which only wishlist places have; and a row or detail with `sources: []` / `researched: false` is a
//       wishlist-only page. Both are visible behaviour, out of REF1's scope.
//
// ---- Decisions (API-3a, 23 Oct 2026, Opus; PHASE-E-START D-E3 to D-E7, audit G-B, review API1a) -------------------------------------
//
// A25 Counts (R-22 written; D-E7). `countPlaces(q)` answers FacetCounts for the query, where q may carry `parsed` (a ParsedScope):
//     the store counts `mergeParsed(q, q.parsed)` (below: `parsed.q` replaces `q`, each key of `parsed.facets` replaces that key), so
//     a parsed count is one request and equals listing the merged query (case K22).
//     - `n` = listPlaces(merged).total.
//     - `facets`: one entry per facet key the ENGINE publishes for the list (core/src/query's descriptor facets that are not hidden; the
//       stub publishes country, region, kind), in the engine's order; a key the engine does not publish never appears. Each option's
//       count applies every OTHER key (a key never narrows its own options); a selected value with no rows appears with count 0 (not
//       for `region`, whose values are aliases); options run by count descending, then sortKey(label), then value in code-point order.
//     - `gaps[key]`: for each facet key with a gap state, the rows whose value for that key is a gap ("not checked yet", H2: a known
//       "no" is an answer) and that match every other key. Keys with no gap state are absent, not 0.
//     - `unchecked`: the rows that fail ONLY on a gap of a selected key; a row counts once, under the first such key in facet order.
//       It equals listUnchecked(merged).total (case K23).
//     - `scope`: rows matching only the scope keys `country` and `k` (the count line's denominator). `total`: the catalogue's rows.
//     - `notes`: the engine's count-line words, e.g. "12 not checked yet"; display text, not data.
//     Parity: SupabaseStore stores the facet values and gap flags the core engine computes per row (loader), and counts with SQL; the
//     corpus case K28 (HYG) holds every store to the engine.
// A26 Export formats (D-E6). `json` is the export model (exportModel: core/src/export/types.ts as the contract), the body the client's
//     Export menu and its file builders read. The licence guard holds inside it: a waypoint whose point fails the guard is left out and
//     counted in `skipped`, a stop keeps its row with `point: null`. `print` is `text/plain; charset=utf-8`, filename `<slug>.txt`, laid
//     out for paper: the title, the item's page URL, then per day "Day n: title" with each stop on a line of time, name, area and
//     location ("lat, lon", "approximate" when so); a place is one block of kind, area and location. Every laid-out value the item lacks
//     reads PRINT_GAP ("Not checked yet"), never blank, `null`, `undefined` or `-` (case K21). No JSON in a print body. Every format's
//     mime and extension is EXPORT_FILE's. The on-page print view is the browser's own, rendered from `json`.
// A27 "Not checked yet" rows (D-E7). `listUnchecked(q, page)`: the rows left out of listPlaces(q) only because their value for a selected
//     key is a gap, as one paged list (A1 caps, A15 order inside a group). `only` limits the keys (a parse's constraints). Groups run in
//     the facet-key order of countPlaces(q).facets; a row sits in the first group it qualifies for and carries that key as `gap`
//     (allowlist PLACE_ROW_KEYS + `gap`). `groups` (key, label, note, count) is complete on every page; `total` = sum of counts =
//     countPlaces(q).unchecked when `only` is absent. A query that selects no key with a gap state answers an empty page, not an error.
//     Parity: the same per-row gap flags as A25, so SQL selects them with the A15 ORDER BY and LIMIT/OFFSET.
// A28 Card search (D-E7; amended 23 Oct 2026 by HYG on review API3-R-8). `searchCards(q)`: places whose CARD TEXT holds the words, best
//     first, every other filter of q applied. The rule is ONE module, core/src/search/bm25.ts (terms, buildTextIndex, searchTexts), which
//     JsonSource, StubStore and the browser's static files import; a SQL store reproduces it from these definitions:
//     - card text = name, kind label, the area chain's names, the one-line summary and the tag LABELS (definition 2: labels, never ids);
//     - terms = normalize() (core/src/parse/normalize.ts: NFD, accents dropped, ss for the sharp s, lower case), split on [^a-z0-9]+,
//       words of 2+ characters, the STOP list dropped, `stem` applied (-ing over 6 letters, -ies, -ses/-xes/-ches/-shes, a plural -s not -ss);
//     - definition 1, document length: the number of terms of a card AFTER stop words and stemming, repeats counted (it is `len` of the
//       index and the |d| of BM25; the average is the mean over the documents indexed in the scope);
//     - definition 3, N: the number of cards INDEXED in the query's scope; a place with no card text is not a document, adds nothing to N,
//       to df or to the average, and can never be a hit;
//     - definition 4, distinct terms: the query's terms are made distinct (first seen first) BEFORE the minimum-match rule, so "lake lake
//       lake boat" has two terms, needs one, and scores each term once;
//     - score = BM25 (k1 1.2, b 0.75; idf = ln(1 + (N - df + 0.5) / (df + 0.5)); a term adds idf * tf * (k1 + 1) / (tf + k1 * (1 - b +
//       b * |d| / avg))) over the cards of the query's COUNTRY scope (every row with no country), so a place scores the same however the
//       catalogue is split; a row must hold at least ceil(distinct terms / 2);
//     - order: score descending, compared after rounding to 6 decimals (so a SQL sum and a JS sum agree), then sortKey(name), then ref
//       (A15);
//     - at most API_LIMITS.cards.max rows, no paging (`total` and `truncated` say how many more); `terms` echoes the query's terms.
//     Parity: the loader writes the postings (term, ref, tf), each card's length, and per country scope the card count and the total length;
//     SQL returns the postings of the query's terms in scope and core scores them with `searchTexts`, so the sum order is the same. Case
//     K24.order pins ten queries on the stub fixture (whole answer) and on the real data (relative order of the pinned slugs).
//
// Done in API-3c: R-1 (A40), R-2 and R-3 (A33), R-6 (A39). Open, with owners:
//   R-4  META-2: JsonStore's towns loader calls `publicTownLayer()` and implements `publicTowns()` from the same rows; every static
//        towns file is written from that output; META-2's towns script writes `data/reference/towns/**` only from the GeoNames dump,
//        verbatim, with the dump's checksum (the file is A33's trust root); K26 runs on the json target with planted towns; the web
//        privacy test scans `data/reference/towns/**`. GLB2b: a served city outline must be the gazetteer's outline exactly (simplify
//        BEFORE the loader builds the gazetteer, or the detector refuses the vertices).
//   R-5  TRP2b: count refused legs (`safeLine` null) at fetch and load, print the count only; the owner decides if it is above 0.
//   R-7  DONE in HYG (A16 amended, core/src/query/text.ts, K28, the ApiAdapter's text fallbacks dropped); the advanced filter and saved
//        view fallbacks stay: they are the browser's grammar, not in the contract.
//   R-8  DONE in HYG (A28 amended, core/src/search/bm25.ts, K24.order).
//   R-9  TRP2b: legs and lines read once per source, beside the revision (A8b).
//   R-10 SRV-0: TRAVEL_BUILD_ID override and a production error on `dev`.
//   R-11 SRV-0: `catalogue_meta.data_revision`; revision = SHA-256(app build id, data revision).
//   R-12 LST2b: unchecked slugs in one capped request, or page on demand, and surface the cut.
//   R-13 TRP2b: `tripLegs.totalChars` cap; validate legs files in check-all and log at load.
//   R-14 META-2, TRP2b, LST2c: the kit gaps (K23 only-on-gap row, K27 planted near-home leg on json, K10 read-coverage spy, json
//        K3/K4/K5/K15/K17, towns.clamped on a real layer).
//   R-15..R-18 (later): revision-input dotfiles, reserved path words derived, rate limit over /api/v1/* (GB-A-9). R-16 is moot (A33).
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
   * The revision of what this store serves (A30: `inputRevision` of the build id and the input files' hashes for a file-backed store,
   * the snapshot hash of A8 for an in-memory one). Equal for the same build and data in two processes; changes when any input changes;
   * never depends on a file's mtime (case K10). Computed once per process; a failure is retried on the next call. Handlers use it as the
   * ETag and answer `If-None-Match` with 304 (case K19). First call under 300 ms at 10,000 places (A30).
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

  /**
   * Counts only, no rows: the facet options with live counts, the "not checked yet" count, the scope and the catalogue total, by the
   * rules of A25. Same query rules as listPlaces. With `q.parsed`, counts `mergeParsed(q, q.parsed)` (case K22).
   */
  countPlaces(q: S.CountQuery): Promise<Result<S.FacetCounts>>;

  /**
   * One page of the rows left out of listPlaces(q) only because a selected key's value is a gap ("not checked yet", H1), grouped by
   * key (A27, case K23). Same paging caps and sort as listPlaces; rows carry PLACE_ROW_KEYS plus `gap`. `GET /api/v1/places/unchecked`.
   */
  listUnchecked(q: S.UncheckedQuery, page?: S.ApiPage): Promise<Result<S.UncheckedPage>>;

  /**
   * Places whose card text holds the words of `q.q`, best first, every other filter applied (A28, case K24): at most
   * API_LIMITS.cards.max rows (a larger `limit` is `too_large`), one page. `GET /api/v1/places/cards`.
   */
  searchCards(q: S.CardQuery): Promise<Result<S.CardHits>>;

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
   * The routed legs of one public trip, keyed by its detail's stop keys, with an optional encoded polyline each (A34, case K27); read
   * when the trip map mounts, never inside getTrip. A retired slug answers `{moved, ref}` (A32); unknown or unlisted `not_found`.
   * `GET /api/v1/trips/{slug}/legs`.
   */
  tripLegs(slug: string): Promise<Result<S.TripLegsLookup>>;

  /**
   * One export file for ONE trip or place (case K6): never a list, never two slugs. The licence guard holds: points whose source is not
   * ours to give are left out and counted in `skipped`; approximate points are labelled and counted in `approx`. `not_found` for an
   * unknown or unlisted item.
   */
  getExport(q: S.ExportQuery): Promise<Result<S.ExportFile>>;

  /** The area tree with counts and no pins. */
  globeTree(): Promise<Result<S.GlobeTree>>;
  /** The light pins of ONE country (lower-case ISO alpha-2). An unknown country answers an empty list; more than API_LIMITS.globePins.max pins is `too_large` (A36). */
  globePins(cc: string): Promise<Result<S.LightPin[]>>;
  /** The card and pin behind one `place:<slug>` or `trip:<slug>` key, or `not_found`. Served at `/api/v1/globe/card/{kind}/{slug}` (A29). */
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
  countPlaces: { http: "GET /api/v1/places/counts", query: S.countsHttpQuery, input: S.countQuery, output: S.facetCounts },
  listUnchecked: { http: "GET /api/v1/places/unchecked", query: S.uncheckedHttpQuery, input: S.uncheckedQuery.extend(S.apiPage.shape), output: S.uncheckedPage },
  searchCards: { http: "GET /api/v1/places/cards", query: S.cardsHttpQuery, input: S.cardQuery, output: S.cardHits },
  getPlace: { http: "GET /api/v1/places/{slug}", input: S.placeSlugInput, output: S.placeLookup },
  nearbyForPlace: { http: "GET /api/v1/places/{slug}/nearby", input: S.placeSlugInput, output: S.nearbyBlock },
  near: { http: "GET /api/v1/near", query: S.nearHttpQuery, input: S.nearQuery.extend(S.apiPage.shape), output: S.nearPage },
  towns: { http: "GET /api/v1/towns", query: S.townsHttpQuery, input: S.townQuery, output: S.townList },
  parse: { http: "GET /api/v1/parse", query: S.parseHttpQuery, input: S.parseInput, output: S.parsedQuery },
  search: { http: "GET /api/v1/search", query: S.searchHttpQuery, input: S.searchQuery, output: S.searchResult },
  listTrips: { http: "GET /api/v1/trips", query: S.listHttpQuery, input: S.tripQuery.extend(S.apiPage.shape), output: S.paged(S.tripRow) },
  getTrip: { http: "GET /api/v1/trips/{slug}", query: S.profileHttpQuery, input: S.tripSlugInput, output: S.tripLookup },
  tripLegs: { http: "GET /api/v1/trips/{slug}/legs", input: S.tripLegsInput, output: S.tripLegsLookup },
  getExport: { http: "GET /api/v1/export/{type}/{slug}", query: S.exportHttpQuery, input: S.exportQuery, output: S.exportFile },
  globeTree: { http: "GET /api/v1/globe/tree", input: null, output: S.globeTree },
  globePins: { http: "GET /api/v1/globe/pins/{cc}", input: S.globePinsInput, output: S.lightPin.array() },
  globeCard: { http: "GET /api/v1/globe/card/{kind}/{slug}", path: S.globeCardPath, input: S.globeCardInput, output: S.globeCardFile },
  globeFeature: { http: "GET /api/v1/globe/feature/{id}", input: S.globeIdInput, output: S.globeFeature },
  globeLine: { http: "GET /api/v1/globe/feature/{id}/line", input: S.globeIdInput, output: S.globeLine },
  globeCity: { http: "GET /api/v1/globe/city/{townId}", input: S.globeCityInput, output: S.globeCity },
  report: { http: "POST /api/v1/report", input: S.reportInput, output: S.reportResult },
} as const satisfies Record<CatalogueMethod, { http: string; query?: z.ZodType; path?: z.ZodObject; input: z.ZodType | null; output: z.ZodType }>;

export const CATALOGUE_METHODS = Object.keys(CATALOGUE_CONTRACT) as CatalogueMethod[];

/**
 * The parsed-count merge (A25): the query a parse opens when it is applied to a list query. `parsed.q` replaces `q` (absent: no words
 * left), and each facet key of `parsed.facets` replaces that key of `q.facets`; every other key of `q` stays. Pure, so SupabaseStore
 * applies it before its SQL, and the client's local count (StaticAdapter) uses the same function.
 */
export function mergeParsed(q: S.CountQuery, parsed: S.ParsedScope | undefined = q.parsed): S.PlaceQuery {
  const { parsed: _parsed, ...plain } = q;
  if (!parsed) return plain;
  const { q: _words, facets, ...rest } = plain;
  const merged: Record<string, string[]> = { ...(facets ?? {}), ...(parsed.facets ?? {}) };
  for (const k of Object.keys(merged)) if (!merged[k]!.length) delete merged[k];
  return { ...rest, ...(parsed.q ? { q: parsed.q } : {}), ...(Object.keys(merged).length ? { facets: merged } : {}) };
}

export { RESERVED_API_WORDS } from "./slugs.ts";
