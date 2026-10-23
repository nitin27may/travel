// `CatalogueStore`: the one read interface of the public catalogue (EXECUTION-PLAN 4.2; PHASE-B-START sections 5 and 6).
//
// ==== 3b HAND-OFF (API-3a, 23 Oct 2026, Opus; for the Sonnet pass in this worktree) ====================================================
// API-3a wrote the contract below (A25 to A39), the codec, the OpenAPI, the town guard and the detector exemption, and the case tables
// K20 to K27. Every case 3b fills is registered with `awaits` (core/test/catalogue/contract/kit.ts): it runs, must FAIL with the reason
// named, and turns red the day it passes, so the marker is removed in the same commit as the code. Per case, what to implement and where:
//   K20 json export        JsonStore.getExport: drop the `json` not_available line; web/lib/server/exports.ts adds `json` (the model,
//                          licence-guarded per A26, EXPORT_FILE mime and ext). StubStore.getExport: a model built from the fixture.
//   K21 print text/plain   exports.ts and StubStore: `print` = the A26 plain-text layout, EXPORT_FILE.print mime, `.txt`, PRINT_GAP for
//                          gaps. Then web/lib/client/api.ts loadExport reads `json` (not `print`); EXPORT_MODEL_FORMAT goes.
//   K22 parsed counts      JsonStore/StubStore.countPlaces: `mergeParsed(q, q.parsed)` (below) first, then the same count. ApiAdapter:
//                          countParsed/countList call GET /api/v1/places/counts with `parsed.*` (web/lib/client/{api,contract,data}.ts,
//                          `// API-3` section); StaticAdapter keeps its local count.
//   K23 listUnchecked      JsonStore: ListEngine gains `unchecked(rows, f, only)` (web/lib/server/engine.ts over uncheckedRows; group
//                          order = the order of that query's countPlaces facet keys, A27); page it with the A15 sort. StubStore: the
//                          same over ROW_FACETS (gap = a null field; season [] is a gap), and its countPlaces fills `gaps` and
//                          `unchecked` by A25 (it answers {} and 0 today). Respond: UNCHECKED_ROW allowlist (done).
//   K24 searchCards        JsonSource gains `cards(q, rows, scopeRows)` (web: lib/search/fulltext.ts BM25 over cardText, A28; or move
//                          terms/stem/searchTexts into a new core search module, coordinator's call). JsonStore: cap, filters, order, `terms`.
//                          StubStore: the A28 rule over its own card text. ApiAdapter's full-text pass calls it; StaticAdapter keeps
//                          textIndex files.
//   K25 globe card path    green in 3a (contract `path`, OpenAPI from it, no override). Nothing to do.
//   K26 town guard         StubStore: run `safeTown` on every town and `safeOutline` on every city outline in the constructor (the
//                          fixture's planted towns come through `StubOptions.data`). JsonStore needs nothing until META-2 loads towns
//                          through the same two calls (META-2's loader, json/towns.ts); on the json target K26 checks the
//                          not_available branch until META-2 turns facts.town.layer on and the target plants towns.
//   K27 tripLegs           a new legs.ts beside json/index.ts (core/src/catalogue/json/): read data/schedules/legs/<trip>.json (JsonSource gains
//                          `legsFile(slug)`), map pair keys to legStopKey via the trip detail's stops, run `safeOutline` on each
//                          geometry, cap at API_LIMITS.tripLegs.max. JsonStore.tripLegs calls it; StubStore gets two fixture legs.
//                          A trip with no file answers `{legs: [], fetched: null}`.
//   A30 revision timing    JsonSource gains `revisionInputs()` (web/lib/server/source.ts: the files createPublicData reads, the slug
//                          registry, vocab, globe files; buildId from .next/BUILD_ID or TRAVEL_BUILD_ID, else "dev"); JsonStore.revision
//                          = inputRevision(...) cached per process, retried on failure. web/tests/api/targets.ts makeChanged must then
//                          change an INPUT hash (wrap revisionInputs), and web/tests/api/revision-timing.test.ts flips its last
//                          assertion to `toBeLessThan(TARGET_MS)` and records the figure (G-B: 2.9 s; 3a measured 2.8 s).
//   A36 pins cap           JsonStore/StubStore.globePins: above API_LIMITS.globePins.max answer too_large with details.max.
//   step 12                web/tests/e2e/api-default.spec.ts: parsed counts, unchecked rows and the text search read /api/v1/.
//   bookkeeping            remove each `awaits` with its code; then core/test/catalogue/contract.test.ts's "awaiting API-3b" list
//                          becomes [] and core/test/catalogue/schema.test.ts's `awaiting3b` list goes (round-trip calls added);
//                          AWAITS_3B (below) is deleted when nothing answers it.
//   other                  web/lib/client/stub.ts (not an API-3 file; ask the coordinator) gains the new calls for the StubAdapter.
//                          core/test/catalogue/json-store.test.ts builds a JsonSource literal: when the optional members become
//                          required, add them there (not an API-3 file either).
// ======================================================================================================================================
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
// A28 Card search (D-E7). `searchCards(q)`: places whose CARD TEXT holds the words, best first, every other filter of q applied. The rule
//     is the site's full-text pass (web/lib/search/fulltext.ts), written here so a SQL store can reproduce it:
//     - card text = name, kind label, the area chain's names, the one-line summary and the tag labels;
//     - terms = normalize() (web/lib/search/normalize.ts: NFD, accents dropped, lower case), split on [^a-z0-9]+, words of 2+ characters,
//       the STOP list dropped, `stem` applied (-ing over 6 letters, -ies, -ses/-xes/-ches/-shes, a plural -s not -ss);
//     - score = BM25 (k1 1.2, b 0.75; idf = ln(1 + (N - df + 0.5) / (df + 0.5))) over the rows of the query's COUNTRY scope (every row
//       with no country), so a place scores the same however the catalogue is split; a row must hold at least ceil(distinct terms / 2);
//     - order: score descending, compared after rounding to 6 decimals (so a SQL sum and a JS sum agree), then sortKey(name), then ref
//       (A15; the static fallback breaks ties by slug today and moves to this rule in 3b);
//     - at most API_LIMITS.cards.max rows, no paging (`total` and `truncated` say how many more); `terms` echoes the query's terms.
//     Parity: the loader writes the terms per row (core function), SQL holds the postings; the stop list and stemmer are data for it.
// A29 Globe card path (GB-A-6 settled). The contract's path is `GET /api/v1/globe/card/{kind}/{slug}` with `path: globeCardPath`, and
//     OpenAPI reads it like any path (the ROUTE_OF override is gone). The STORE method keeps `globeCard(key)` with `<kind>:<slug>`: the
//     card carries that key, and every caller (the adapters, the kit) already speaks it; `globeCardKey(kind, slug)` is the one join
//     the handler makes (case K25).
// A30 Revision from inputs (D-E4; supersedes A8 for JsonStore). `revision()` = inputRevision({buildId, files}): SHA-256 of the build id
//     and the content hash of every input file the store reads (the files the dataset builder reads, the slug registry, the vocabulary,
//     the globe files, later the towns and legs files), computed once per process and cached; a failed computation is retried (GB-A-5).
//     K10 holds: one build and the same files give one revision in any process; a changed input changes it; an mtime never does. A code
//     change moves every ETag through the build id, which is correct. Caveats: (1) a private input (the wishlist) moves the public ETag
//     when it changes, which says when it changed and nothing else; (2) StubStore, which has no files, keeps the snapshot hash (A8);
//     (3) SupabaseStore's loader computes the same inputRevision from the same files and writes it to `catalogue_meta` in the projections'
//     transaction (A8b unchanged), so JsonStore and SupabaseStore of one build agree. Target: the first call under 300 ms at 10,000
//     places (web/tests/api/revision-timing.test.ts).
// A31 Codec looseness (GB-A-12). `r` is read by a decimal pattern (`^\d+(\.\d+)?$`; `0x10`, `1e2`, `-5` and `Infinity` are
//     invalid_input); a repeated `f.<facet>` or `parsed.<key>` is refused like every other repeated key; the export `profile` is
//     documented as accepted and ignored (export.ts) rather than applied, because no export layout shows profile-dependent times yet.
// A32 Moves keep the query (GB-A-13). A 308 for a moved place, trip or trip's legs carries the request's query string to the new URL, so
//     `?p=family` survives the redirect. tripLegs answers `{moved, ref}` for a retired trip slug like getTrip (R-18).
// A33 The town guard (D-E3 as amended; owner decision Q87: safe geometry, not exclusion). Every town is served through
//     core/src/privacy/towns.ts at LOAD: `safeTown` keeps a centre outside the household radius, replaces one inside it with the town's
//     Wikidata point when that is outside, else with the point at a FIXED offset (2 x radius + radius / 4 due north, then E, W, S);
//     `safeOutline` serves an outline or a line only when no coordinate lies within the radius (else the ring, or a dashed leg).
//     Amendments to D-E3, with why:
//     - D-E3's fallback "the nearest point 0.5 km outside the radius" is REFUSED: that point lies on the line from home through the
//       centre at a known distance, so the public centre and the served one give the home point back. The fixed offset does not
//       depend on where home is; what leaks is one bit per town (guarded or not, and whether the Wikidata point was inside).
//     - D-E3's "the row is marked approx" is DROPPED: a flag on one town among thousands names the home town to anyone reading the
//       layer. A guarded row carries the public gazetteer fields only (`town` is strict, nearby.ts), and a refused outline is a ring
//       like any town OSM has no polygon for.
//     - Residual risk for the owner: an observer who compares the layer with public GeoNames and OSM data can still see that one
//       town's centre or outline differs, which says "the household lives within about 2 km of this town's centre or border". That
//       is the town-level fact Q50 accepted (a "near <home town>" search works); the address-level fact stays hidden. `TOWN_POLICY = "exclude"` is
//       the one-line switch if the owner prefers exclusion.
//     The detector's typed exemption (detect.ts) lifts ONLY the home-town text rule, by shape: a town id under id/key/value/nearTown/
//     townId or in a `city` array, a town's name or chip label (at most 80 characters, no digit) beside such an id and holding its name
//     part, and `city=` parameters of an href. No method answers 500 for a town (case K26), and K7 runs with the exemption on.
// A34 Trip legs (D-E5). `tripLegs(slug)`, `GET /api/v1/trips/{slug}/legs`: the routed legs of one public trip from its
//     `trip-legs/2` file (legs.ts; /1 still read), keyed by the public stop keys of getTrip's detail (a day item id or `base:<id>`), never
//     by the file's pair keys. Geometry is an encoded polyline, precision 5, simplified to about 30 m, at most
//     API_LIMITS.tripLegs.polylineChars per leg; more than API_LIMITS.tripLegs.max legs is `too_large`. A trip with no file answers no
//     legs (`fetched: null`); an unknown or unlisted trip `not_found`; a retired slug `{moved}` (A32). `attribution` is shown wherever a
//     geometry is drawn. Every geometry passes `safeOutline` at load, and the detector decodes it on the way out (A39, case K27).
//     Parity: the mapping from file pairs to stop keys runs in the loader (core code), so SupabaseStore serves a stored `trip_legs`
//     projection and never maps at request time.
// A35 Row keys (LST2b, MX). `PlaceRow.nearTown`: the record's nearest town id (META-2's `near_town`) or null; the only new row key
//     (K2: the shipped row's keys plus ref, approx, nearTown). The shipped list row keeps its 41 keys until LST2b adds `nearTown` (and `approx`) there with web/tests/data/light-data.test.ts;
//     until then the ApiAdapter drops `ref`, `approx` and `nearTown` when it rebuilds a list file. Near rows and nearby items gain
//     `minutes`: routed minutes when `basis` is `routed`, else null (null everywhere until MX writes a matrix), so MX needs no contract
//     change. Near rows' allowlist is PLACE_ROW_KEYS + distanceKm, bearing, band, basis, minutes.
// A36 Pins cap (GB-A-10, R-25). `globePins(cc)` answers `too_large` with `details.max` when the country holds more than
//     API_LIMITS.globePins.max (2,000) pins; never a cut list, because a globe that silently drops pins misleads. Tiling by box is the
//     follow-up if a country ever passes it.
// A37 Towns say when they clamp (R-26). TownList carries `clamped` exactly as NearPage does.
// A38 Reserved words. `counts`, `unchecked` and `cards` are path words under /api/v1/places/, so a place slug equal to one of them
//     would be shadowed there (the page route is unaffected). No place holds one today (case listPlaces.reserved); the slug assigner
//     must refuse them (request to the slugs.ts owner: add RESERVED_API_WORDS to reservedSlugs).
// A39 Encoded lines are read by the detector. A string under `geometry` that is a well-formed polyline is decoded and every vertex is
//     tested like a coordinate, so a leg cannot carry a point near home past respond() inside an encoding (detect.ts).
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

/** The skeleton answer of a method API-3a wrote and API-3b implements (3b hand-off above): the kit's `awaits` cases match it. 3b deletes it. */
export const AWAITS_3B = (what: string): string => `${what} is in the contract (API-3a) and is implemented in API-3b.`;

/** Path words under /api/v1/places/ that a place slug may never take (A38). */
export const RESERVED_API_WORDS = ["counts", "unchecked", "cards"] as const;
