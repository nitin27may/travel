# Review: the API-1a contract (PHASE-B-START slot 2, Opus read)

Reviewer: Claude Opus 5.5 (`claude-opus-5-5`), 22 Oct 2026. Read only, on branch `public/API1a` (worktree
`/Users/nks/workspace/travel-wt/v2-API1a`, head `828f605`, base `299941b`). The one command run was the contract test alone:
`pnpm exec vitest run test/catalogue/contract.test.ts` in `core/`: 161 tests, 93 passed, 68 todo, 0 failed (53 cases on 3 targets
plus 2 bookkeeping tests).

## Verdict

**Accept with changes.** The shape is right. A `SupabaseStore` built on the two-tier plan (projections written by core, schema diff
M13) can implement `CatalogueStore` without changing the interface. Each method returns `Result<T>` and carries its revision. Allowlists
are strict objects, the sort rule is a code-point rule that `collate "C"` reproduces, and the revision is a content hash. Six findings
should change the contract before API-1b builds on it. Four are about identity: what the registry records when a record merges, changes
key or disappears, and how a URL turns into store input. Each fix is a few hours now. After API-1b, the same fix touches the JSON store,
the handlers, the OpenAPI document and the loader.

| Severity | Count |
|---|---|
| must (before API-1b starts) | 6 |
| should (in API-1b, or before SRV-0) | 17 |
| later | 6 |

## Findings

### Must

**API1a-R-1 (must). Merged records have a slug in the registry but no redirect a store can see.**
Evidence: the registry pins 363 keys, "359 pages plus 4 merged records" (`core/src/catalogue/store.ts:29`,
`core/test/catalogue/slugs.test.ts:155`). The 4 merged keys sit in `places` with their own slugs, and `retired` is empty
(`data/catalogue/slugs.json`: 363 places, 0 retired). The redirect to the surviving page exists only in web's
`legacyPaths` (`web/lib/public/places.ts:456`, `:490-491`). `getPlace` answers `moved` only through `movedTo`, which reads `retired`
(`core/src/catalogue/stub/index.ts:192`, `core/src/catalogue/slugs.ts:175-180`). Any store that follows the contract answers
`not_found` for those 4 slugs. That includes SupabaseStore, whose loader copies `slugs.json`.
Fix: record merges in the registry. Add `merged: { <key>: <survivor key> }` (written by `slugs.ts merge <key> <survivor>`, or by
`build` when the builder reports a `same_place_as` pair). Make `movedTo` resolve a slug pinned to a merged key to the survivor's
slug. Add a merged slug to the stub fixture and a `K9.merged` case.

**API1a-R-2 (must). `alias` destroys the old identity key, so an old `ref` can never be resolved.**
Evidence: `aliasKey` deletes `oldKey` from `places` and rewrites `retired`, and keeps no trace of it (`core/src/catalogue/slugs.ts:296-304`).
Refs will change often:
- `loc:` and `proto:` refs change when TD-4 imports the old trips (D-B2).
- The 74 `trip/<id>/<kind>:<name>` refs embed a lower-case name (`trip/algonquin-muskoka-2026/sight:ragged falls`), so renaming the
  place changes its ref.
- The 136 `legacy/<folder>/...` refs embed a folder path.
- `loc:` ids embed the area path (`loc:CA/AB/banff-national-park/lake-louise`).

`ref` is the id that saves, `ids=` and the planner's `trip_item.entity_id` will key on (owner Q74 and schema diff 12). Schema diff M5
already plans `entity_alias (alias, ref)` for it.
Fix: `aliasKey` also writes `formerKeys: { <old key>: <new key> }`, collapsing chains as `renameSlug` does for slugs. Add
`resolveRef(reg, ref)` to `slugs.ts`. Document that SupabaseStore loads `entity_alias` from `formerKeys`. Add a case: after an alias,
the old ref resolves to the same slug.

**API1a-R-3 (must). A place cannot be deleted or withdrawn.**
Evidence: `missing()` fails `build` and `--check` for every pinned key that has no record, and the only remedy it names is `alias`
(`core/src/catalogue/slugs.ts:248-257`; D-B1 covers only merges and identity changes). Some places vanish with no successor: a deleted
locations entry, or a trip going private (CLAUDE.md: seven pages went private on 17 Oct) that takes its capture-seeded pages out of
the public set. Each one blocks check-all, and the only way out is a false alias.
Fix: add `slugs.ts withdraw <key>`. It writes `withdrawn: { <key>: <slug> }` (a tombstone). The slug stays reserved, `getPlace`
answers `not_found` for it, and `build` restores the key when its record comes back. `missing()` ignores withdrawn keys.

**API1a-R-4 (must). The `sort` input takes any field name, and the stub improvises the ordering.**
Evidence:
- `sortSpec` is `/^-?[a-z][a-z0-9_]*$/` (`core/src/schema/api/place.ts:102`), so `sort=password` is valid input.
- The stub ignores an unknown field silently (`stub/index.ts:123-125`, where `x === y` holds for two `undefined` values).
- It puts nulls last in both directions (`:126-127`). Postgres defaults to `NULLS FIRST` for `DESC`.
- It sorts strings by `sortKey(String(x))` (`:128`), which needs a stored key per sortable column in SQL.

K11 tests only the default order (`listPlaces.cases.ts`, K11). D-B5's parity goal (SRV-D risk 10) is therefore unproven for every
user-chosen sort.
Fix:
- Add enums `PLACE_SORT_KEYS` (for example `name`, `km`, `gain_m`, `elevation_m`, `kids_from`) and `TRIP_SORT_KEYS` in
  `core/src/schema/api/`. Any other key answers `invalid_input`.
- Write the rule in `store.ts`: numbers compare numerically and strings by `sortKey`; nulls go last in both directions; the tiebreak
  is `sortKey(name)` ascending, then `ref` ascending.
- Add a `K11.sort` case with `sort: ["-km"]` over rows that include nulls and a tie.

**API1a-R-5 (must). The contract's HTTP input is the store object, not the URL.**
Evidence: `CATALOGUE_CONTRACT.input` is "the object a handler parses from the request (path and query together)"
(`store.ts:144-146`). For `listPlaces`, `near` and `listTrips` that object is `placeQuery`, with a nested `facets` record, a `bbox`
tuple and `sort` and `ids` arrays (`place.ts:113-120`). For `getTrip` and `getExport` it nests `profile`. EXECUTION-PLAN 4.3 rule 3
puts every key flat in the URL (`country`, `region`, `k`, `p`, `split`, `page`, `pageSize`, ...), and web's codec uses comma lists,
an upper-case `country`, `sort` with `dir`, and `f.<id>` keys (`web/lib/entities/url.ts:20-50`). An OpenAPI document generated from
`input` would publish a `facets` object parameter that no URL carries. API-1b would then put the coercion inside `respond()`, outside
the contract and outside the kit.
Fix: give each method an `httpQuery` schema: flat string parameters, documented as the URL carries them. Add one codec in core,
`fromSearchParams(method, URLSearchParams) -> input`, with its inverse `toSearchParams`, on web's `decodeState` rules. OpenAPI documents
`httpQuery`, and `respond()` calls the codec. Add a kit case: `decodeState(encodeState(s))`, passed through `fromSearchParams`, gives
the same `PlaceQuery`.

**API1a-R-6 (must, owner sign-off). The row allowlist carries household save metadata.**
Evidence: `sourceTypes` is built from the `sources` table of `data/locations/locations.json` (`web/components/places/rows.ts:72`). That
table holds 24 `instagram`, 9 `note`, 1 `friend` and 1 `official`, and owner decision 13.3 (21 Oct) made those saves private (schema
diff 8). `added` is the date a place was saved to the list (`rows.ts:75`). The detail's `sources` lists the origin `locations`
(`place.ts:18`, `:431`), which says the household saved the place. All three are now frozen into `placeListRowShape`
(`place.ts:59`, `:62`) and `placeDetail`.
Fix: drop `sourceTypes` and `added` from `placeRow`, or redefine them: `sourceTypes` as the kinds of the catalogue's registry
citations, `added` as the first-published date. Output `locations` as a neutral origin, or drop it. Whichever the owner picks, record
it in `docs/v2/TODO.md`. Removing them later changes the allowlist, K2, `light-data.test.ts` and the M13 projection.

### Should

**API1a-R-7 (should). The revision does not cover everything a store serves.**
A8 hashes "the dataset object" (`store.ts:37-38`). JsonStore also reads the globe files, and later the towns layer, through `FileStore`
(API brief step 15), so an edit to a globe line leaves the ETag unchanged on a `max-age=3600` endpoint. SupabaseStore's loader must
hash the same object, and that object has no definition yet.
Fix: add `servedSnapshot(...)` to `core/src/catalogue/revision.ts`, listing every input: the dataset, the registry, the globe files,
the towns, the parse vocabulary and the source registry citations. JsonStore and the loader both hash it. The loader writes the revision
to `catalogue_meta` in the same transaction as the projections.

**API1a-R-8 (should). The revision must come from the same snapshot as the data.**
`Result` carries the revision "from the same read" (`common.ts:83`). In Postgres the data query and the `catalogue_meta` read can
straddle a reload.
Fix: one sentence in `store.ts`: a store returns the revision of the snapshot its data came from. For SupabaseStore that means one SQL
function returning both, or a `REPEATABLE READ` transaction, and a loader that swaps everything in one transaction.

**API1a-R-9 (should). "Caps refuse" does not hold for the request-size caps.**
A1 and the `limits.ts` header say input schemas carry shape only and the store answers `too_large` (`store.ts:15-17`,
`limits.ts:4-6`). But `query.valuesPerKey`, `textChars`, `ids`, `sortKeys` and `reportText.max` are schema `.max()` rules
(`place.ts:114-119`, `report.ts`), so they answer `invalid_input`, and K18.store asserts exactly that (`handler.cases.ts:25`).
Fix: state two classes in A1 and in the `limits.ts` header. Result-size caps (`pageSize`, `limit`) answer 413. Request-size caps answer
400 with `details.max`.

**API1a-R-10 (should). K12 lets a detail cite ids it does not resolve.**
K12 checks that every `src` is a registry id and that `citations[id].id === id` (`getPlace.cases.ts`, K12). It never checks that every
`src` in a detail is a key of that detail's `citations`, so a store that sends `citations: {}` passes. Also, `fact.provenance` and
`fact.conflicts[].provenance` are free strings (`place.ts:197-202`): the Rockies pages' provenance passes outside D-B4 and outside
K12.
Fix: assert `src` ⊆ `keys(citations)` per detail. Either document `fact.provenance` as display text that holds no source id, or map it
to `apiVal`.

**API1a-R-11 (should). Free-text `q` has two normalisations.**
`listPlaces` matches `q` with `toLowerCase().includes` on name, area and region (`stub/index.ts:106`); `search` uses `sortKey`
(`:353-356`). So "emerald" finds "Émerald Pool" in search but not in the list. Postgres cannot copy either one cheaply: under
`collate "C"`, `lower()` folds ASCII only.
Fix: define `q` as a substring of `sortKey(name + " " + area_name + " " + region_name)`, compared against `sortKey(q)`. SupabaseStore
stores that key as a column computed by core.

**API1a-R-12 (should, before phase E). Pin the distance rule.**
The stub uses core `haversineKm`, includes on the unrounded km and sorts on the rounded `distanceKm` (`stub/index.ts:282-286`). PostGIS
`geography` distance is spheroidal by default, and its sphere radius differs from core's. Rows on the radius edge and near-ties would
differ, and K3 and K17 would flake on SupabaseStore.
Fix: the contract says `distanceKm = round1(haversineKm)`, inclusion is `unrounded <= r`, and the order is rounded distance, then
`sortKey`, then `ref`. SQL may prefilter with `ST_DWithin` plus a margin, and core computes the final values. Move `bearingOf` and
`bandOf` from the stub to a core module now, so all three stores share them.

**API1a-R-13 (should). The 2 km home-point check never runs on SupabaseStore.**
The web runner owns it because core does not hold the home point (`kit.ts:94-95`). SRV-0 adds SupabaseStore to the core runner only
(EXECUTION-PLAN 4.6).
Fix: the core runner reads the home point from an untracked environment variable or a local secret file, never a committed value. It
runs the check when the value is set and marks the case todo with the reason when it is not. check-all sets it.

**API1a-R-14 (should). K7 misses methods, and Whitby is unsettled.**
K7 scans lists, details, trips, counts, search, the globe tree and pins, nearby, and one CSV export of one trip
(`household.cases.ts`). It skips `towns`, `near`, `globeCard`, `globeFeature` and `globeLine`, `parse`, place exports, the other formats
(`ics` carries the title), and unlisted trips, which `getTrip` serves (`trip.ts:199`) but `listTrips` never lists. When META-2 loads
GeoNames, Whitby will appear in `towns()` and in nearby `towns[]`, and `/whitby/i` (`kit.ts:97`) and the web privacy test will both
fail. That is owner question Q50, still open (nearby spec 2).
Fix: extend K7 to every method, every export format, and the unlisted slugs taken from facts. Get a ruling on Q50 before META-2. If
Whitby may appear as a town, write the exemption as a typed rule in the kit (town `id` and `name` fields only), never as a loosened
regex.

**API1a-R-15 (should). The scrub belongs in the store, not in `respond()`.**
Brief step 16 has `respond()` "run the privacy scrub". `store.ts:9-10` and EXECUTION-PLAN 4.1 let server components call the store
directly. If `respond()` rewrites output, the pages and the API diverge, and the ETag no longer describes the body.
Fix: the scrub stays where it is now: the dataset builder, and later the loader. K7 at store level proves it. `respond()` runs the same
detector and fails closed (500 `internal`, logged). It never rewrites.

**API1a-R-16 (should). `PlaceDetail.notes` invites a leak.**
The field is described as "free-form notes from the place store" (`web/lib/public/types.ts:220-221`; `place.ts:442`). The builder
always writes `''` (`web/lib/public/places.ts:263, 375, 620, 667`), but the locations store's `notes` are private (schema diff 8). A
loader that maps the field would publish them.
Fix: drop `notes` from `placeDetail`, or make it `z.literal("")` until a public notes field is specified.

**API1a-R-17 (should). `PlaceRow` cannot say a pin is approximate.**
Detail points and globe pins carry `approx`, but the row's `lat` and `lon` do not (`place.ts:47-48`), so the list's map view draws an
approximate point as exact (T5). M13 stores `approx` beside `place_row` anyway.
Fix: add `approx: boolean` to the API `placeRow` (43 keys). The StaticAdapter maps it, as it maps `ref` (A2). The shipped row can follow
later.

**API1a-R-18 (should). Trip slugs are not pinned and cannot move.**
The registry has no trips section. The 74 `trip/` keys are trip-scoped place refs, not trips. `getTrip` has no `moved` variant
(`trip.ts:193`, `store.ts:115`). Trip ids carry years (`dolomites-2027`), and trip dates have moved before.
Fix: add a registry section keyed by `trip/<id>` and make the output `TripLookup = tripDetail | {moved, ref}`, mirroring places.

**API1a-R-19 (should). `ids=` drops renamed places silently.**
`ids` are slugs (`place.ts:118-119`), and the stub matches them literally (`stub/index.ts:107`). A shared or saved hand-picked list loses
a place on its first rename or merge.
Fix: resolve each id through `movedTo` (and through `resolveRef`, if refs are accepted) before filtering.

**API1a-R-20 (should). Region registry edge cases.**
- A pinned region with no place fails `build` and `--check` (`slugs.ts:253-255`), which blocks check-all when a region's last place is
  withdrawn.
- Alias ambiguity across countries is unspecified. The stub unions the matches (`stub/index.ts:86`). There is no collision today (I
  checked all 41 regions), but codes such as `WA`, `SC` and the numeric legacy codes (`8`, `34`) will collide as countries are added.
- `it/veneto` carries the alias `IT-veneto`, which is not its ISO 3166-2 code (`IT-34`).

Fix: keep an emptied region pinned and warn instead of failing. An ambiguous alias without `country` answers `invalid_scope` with the
candidates in `details`. Fix the Veneto ISO source in the locations data.

**API1a-R-21 (should). Three cases will fail on real data for the wrong reason.**
- K6 counts `<wpt` against `1 + skipped` (`getExport.cases.ts:18`), but a real place export carries its trailhead and parking points.
- `getTrip.shape` scans the whole detail for `20\d\d-\d\d-\d\d` (`trips.cases.ts:56`), which Commons file names in photo URLs will
  match.
- K9 dereferences `facts.retired!` (`getPlace.cases.ts:62`), and the real registry has 0 retired slugs.

Fix: K6 asserts one item (the filename carries the slug, and no other place's name appears in the body). Restrict the date scan to
prose fields. The json target runs over a registry copy with one planted rename (and one merge, for R-1).

**API1a-R-22 (should). `countPlaces` semantics are unwritten.**
The contract does not say which facet keys appear, how options are ordered (the stub uses count descending, then `sortKey(label)`), or
how `unchecked`, `gaps` and `scope` are computed. The stub returns zeros, and its `scope` is country plus `k` (`stub/index.ts:182-186`).
SupabaseStore cannot match an unwritten rule.
Fix: write the rule in `store.ts`. Add a case that compares `countPlaces(q)` with a core reference computed over all `listPlaces` rows.

**API1a-R-23 (should). Facet filter semantics are unwritten.**
The stub skips any facet whose key is not a row field (`stub/index.ts:98-104`): `tag=x` filters nothing (the row has `tags`), and the
same holds for `kid`, `style`, `grade`, `due`, `stroller`, `length`, `around`, `perday` and `drive`.
Fix: state that filter semantics are the core query engine (`web/lib/entities/filter.ts` now, `core/src/query` after API-2). Add a case
over a corpus of queries: `listPlaces(q).items` equals the engine's result over every row. Make the stub call the engine once API-2
lands.

### Later

**API1a-R-24 (later).** The catalogue can be pulled in bulk: page through `listPlaces` at 100 rows a page, then call `getPlace` for each
slug, and walk `globePins` country by country. EXECUTION-PLAN's risk row "P8 by API" already accepts this ("honest that per-item reads
stay possible", with a rate limit when hosting is chosen). Add that sentence to `store.ts` so nobody mistakes the caps for a volume
control.

**API1a-R-25 (later).** `globePins(cc)` has no cap. At the 10,000-place target one country could return megabytes in one body. Add a cap
with `too_large`, or tile by bounding box, when 3.66 is measured.

**API1a-R-26 (later).** `towns` clamps `r` silently: `TownList` has no `clamped` field (`nearby.ts:101`, `stub/index.ts:312`). Add the
field for symmetry with `near`.

**API1a-R-27 (later).** The allowlist has open members: `sectionRow.value` (`place.ts:232`), the `v` of `apiAnyVal`, and the scheduler's
`looseObject` shapes (`trip.ts:120`). Only K7's text scan guards them. Narrow them when API-2 moves the scheduler.

**API1a-R-28 (later).** `rowReads`, which K4 depends on, is counted by the store itself (`stub/index.ts:58`). For JsonStore and
SupabaseStore, count in the target, with a `FileStore` spy or an SQL client wrapper, so a store cannot pass K4 by not counting.

**API1a-R-29 (later).** `getTrip` serves `visibility: "unlisted"` trips, while `getExport` says "`not_found` for an unknown or unlisted
item" (`store.ts:118-121`). Choose one meaning of "unlisted" for both.

## Answers to the six questions

1. **Supabase fit.** Yes, if R-1 to R-5 land first. Status of each SRV-D risk:

   | SRV-D risk | Status |
   |---|---|
   | Slugs not stored (2) | Closed by the registry, except merges, withdrawals and ref history (R-1 to R-3) |
   | Provenance with no home (4) | Closed at the API boundary (`apiVal`, registry ids, K12/K13). Storage stays verbatim jsonb, and the contract makes that no harder (R-10 is the hole) |
   | Source ids per file (5) | Closed in output by `REGISTRY_ID_RE` and K12. The mapping is still SRV-0's `source_local`. Free-text `fact.provenance` is outside it |
   | 13 load-breaking constraints (3) | Untouched. The contract is consistent with C2 (only pages have slugs) and C13 (trip `ref` is `trip/<id>`) |
   | RLS (8) | Untouched, but easier: SupabaseStore needs only the public-read projections, `town` and `catalogue_meta` |
   | Sort drift JS vs Postgres (10) | Closed for the default order. Open for `sort=` (R-4), `q` (R-11), facet option order (R-22) and distance (R-12) |
   | Household data (9) | Mostly closed by strict allowlists. Open: R-6, R-13, R-16 |

   The JS-only behaviours and how to keep parity are in the plan below.
2. **Caps and P8.** Every cap the contract states is enforced inside the stub, and a store that returns more than asked fails K1 and
   K2. Refuse-over-trim holds for `pageSize` and `limit` on every paged method and on `search`. It does not hold for the request-size
   caps, which answer 400 (R-9). Truncation is a deliberate product rule for `towns` (`truncated`) and `nearbyForPlace` (`more`).
   `countPlaces` returns counts only and has no row cap, which is correct. The near radius clamps to 100 with `clamped`, and `towns`
   clamps without the flag (R-26). The globe is per country and per item, but pins are uncapped (R-25). Export is per item and refuses a
   list. There is no total cap and no rate story in the contract; that is accepted in the plan (R-24).
3. **Privacy.** No schema field names a booking, a reservation, a traveller or the home point. The strict objects block new keys.
   Household data can still reach output four ways:
   - the save metadata in the allowlist (R-6);
   - a `notes` field described as place-store notes (R-16);
   - the open members (R-27);
   - free text, guarded only by K7, whose coverage has gaps (R-14).

   The scrub belongs in the store or builder, with `respond()` only detecting (R-15). Whitby is undecided (Q50) and will collide with
   the towns layer (R-14). K7 runs at store level, but the home-point half runs only in web (R-13).
4. **Identity and stability.**
   - A3 is the right call for today: a page matched by name keeps `loc:` or `proto:`, because the match depends on the slug.
   - When that page later gets a capture record, its ref changes, and `alias` carries the slug. Links by slug survive. Anything keyed
     by the old ref breaks, because `alias` keeps no history (R-2).
   - First-come registration and rename-to-308 are sound: no redirect chains (`slugs.ts:289-292`), and `registryProblems` catches
     double pins.
   - A deleted place has no path (R-3). The 4 merged records have no store-visible redirect (R-1).
   - The revision is deterministic: canonical JSON with code-point key order, refusing values JSON cannot hold (`revision.ts:12-36`).
     It does not yet cover every served input (R-7).
5. **Contract-kit quality.** I reasoned through K1, K2, K9, K11, K12 and K17, and each fails a plausible wrong store:
   - K1 fails a silent trim.
   - K2 fails an extra or missing key.
   - K9 fails a store that ignores `retired`.
   - K11 fails `lower(name)` ordering under any collation, because the fixture's "Émerald Pool" ties with "Emerald Pool".
   - K17 fails a store that counts only the approximate points in range.
   - K12 fails a file-local id, but passes a store that sends no citations (R-10).

   Missing cases for API-1b and SRV-0: merged-slug and old-ref resolution (R-1, R-2), `sort=` (R-4), `q` normalisation (R-11),
   filter and count semantics against the core engine (R-22, R-23), a cross-store revision equality case (SRV-0), a URL codec
   round-trip (R-5), and three false-failure fixes (R-21). The todo set is right: the json target is all todo; the near and nearby
   cases are pending on stub-before-E; `towns` and `globeCity` test their own `not_available` branch; K18 and K19 belong to the
   handler; K10.mtime cannot apply to an in-memory store.
6. **API-1b readiness.** The given list is right, and each item still holds:
   - K12 local-source ids on the Rockies pages (and the `fact.provenance` strings, R-10);
   - `apiVal` mapping of `PVal` display values and basis labels (`looksLikeVal` already catches an unmapped `basisLabel`);
   - query-string coercion, which moves into the contract as `httpQuery` plus a core codec (R-5);
   - `pb.refBySlug` exposed through `createPublicData()`;
   - parity tests for `FACET_PARAMS` against `PLACE_FACET_KEYS` (city is the one extra) and `TRIP_LIST_KEYS` against `TRIP_ROW_KEYS`.

   Missing from the list:
   - the merged and withdrawn registry sections and `formerKeys` (R-1 to R-3);
   - the sort allowlist (R-4);
   - `servedSnapshot()` (R-7);
   - store-side scrub with a detector in `respond()` (R-15);
   - a json-target registry copy with a planted rename and merge (R-21);
   - the owner's ruling on R-6;
   - `getTrip`'s profile keys `p` and `split`, which are top-level URL keys (rule 3) but nested in the input.

   Change the contract (R-1 to R-6) before API-1b starts. The rest can land inside API-1b.

## Supabase parity plan

Rule: Postgres filters, pages, counts and measures. It never computes a value that core computes in JS. Every JS-only value is computed
by core at load and stored.

| JS-only behaviour | Why Postgres cannot match it cheaply | Keep parity by |
|---|---|---|
| `sortKey` (NFKD, `\p{M}` stripped, `toLowerCase`) | No Unicode property classes in PG regex, and `lower()` under `collate "C"` folds ASCII only | A `sort_name text collate "C"` column written by core. Order by `sort_name, ref collate "C"`; `ref` needs the C collation too, or the database collation breaks the tie |
| Sort on other columns (R-4) | Per-column normalisation | One stored key per allowlisted sort key. `NULLS LAST` written explicitly for `ASC` and `DESC` |
| `q` matching (R-11) | Same as `sortKey` | A `search_key` column written by core. `position(sortKey(q) in search_key) > 0`, with `sortKey(q)` computed in JS |
| Region aliases (`kebab`) | NFD plus a mark range | An alias table of `kebab(alias) -> region key`, loaded from `slugs.json` |
| Town prefix (`kebab(prefix)`) | Same | Store `kebab(name)` and use a trigram or `text_pattern_ops` index |
| Revision (canonical JSON SHA-256) | Re-encoding jsonb changes the bytes | The loader computes `revisionOf(servedSnapshot())` once and writes it to `catalogue_meta` in the load transaction. The store reads it in the same snapshot as the data (R-7, R-8) |
| Slugs | Assignment is a whole-set function | Copy `slugs.json` and never compute a slug in SQL. The loader runs `registryDrift` and refuses to load on drift |
| Distance, bearing, band | PostGIS is spheroidal, and its sphere radius differs | Prefilter with `ST_DWithin` plus a margin, then core computes `distanceKm`, `bearing` and `band` (R-12) |
| Filters and facet counts | The rules live in the core query engine | Store band and facet columns written by core. Prove parity with the corpus case (R-22, R-23) |
| Privacy | The scrub is core code | Scrub before load, so the projections are clean. Run K7 and the home-point check on the supabase target (R-13), with the anon key, so RLS is under test too |

SRV-0 adds a cross-store case: JsonStore and SupabaseStore on the same commit return the same revision, the same page 2 for a sorted
and filtered query, and byte-identical details after `JSON.parse`.

## Checked and found clean

- The `Result` envelope, the error codes and the status table (K18.status). Every method is async (A9).
- Strict objects for rows, details and values. K2 compares exact key sets. `PLACE_ROW_KEYS` and `TRIP_ROW_KEYS` derive from the schemas.
  Web's `PlaceListRow` is now `z.infer` of core's schema (`web/components/places/rows.ts`).
- `compareCodePoints` walks code points, not UTF-16 units, so it matches `collate "C"` over UTF-8, including above U+FFFF.
- `canonicalJson` sorts keys by code point, drops `undefined`, and throws on non-finite numbers and non-plain objects. `revisionOf` uses
  no mtime, clock or process data.
- The registry: `registryProblems` catches double pins and retired-in-use slugs; `renameSlug` collapses chains; `registryText` is
  canonical and the test pins it. The committed file holds 363 unique slugs and 41 regions, no Whitby, no cross-country alias
  collision, and refs of at most 96 characters (`REF_MAX` is 160).
- The slug move to core reproduces today's assignment (the A14 claim, with `order` keeping the pre-registry key form). The web diff only
  re-exports, threads the registry, and keeps `refBySlug` off public pages.
- `apiVal` uses the storage enums (`SUIT_STATE`, `REL_BASIS`) without duplicating `val()`. `REGISTRY_ID_RE` rejects `src-NNNN`.
  `looksLikeVal` catches an unmapped page `PVal`.
- The point shape: `pointRole` comes from META-0's `POINT_ROLE`, and `approx` is set only where the data marks it.
- Near: the stub resolves the centre before any row scan (K4). An unscoped query answers `invalid_scope`, and an approximate centre
  answers `not_found`.
- Export accepts one slug by regex. The licence guard counts what it leaves out without listing it.
- The contract test runs green on the stub targets, and the pending and not-applicable cases are visible as todo lines with reasons.
