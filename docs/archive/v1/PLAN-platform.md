# Travel platform plan: research / data / web

Status: APPROVED by the owner on 2026-10-17 with the plan's recommended answer for every decision in 8.2, 8.3 and 8.4 (D1 to D25), unless a later change log row says otherwise. Revision 4 (same day) applies the independent review; its new decisions D26-D30 (8.6) carry recommendations the briefs assume until the owner says otherwise. P1a (code and data move) is running; P1b follows.

## 0. Summary, addenda folded in, gaps found (Revised 4)

**Revision 4 (17 Oct 2026):** applies the independent review (`docs/archive/v1/REVIEW-platform-plan.md`, enhancements E1-E33) after checking every repo claim it makes against the tree at commit `6859a27` (the review's base) and `f4d4ec9` (P1a step 1). Phase briefs ready to hand to a coding agent live in `docs/archive/v1/briefs/` (index: `docs/archive/v1/briefs/README.md`). Where this revision and an older section disagree, the section marked "Revised 4" wins; superseded text was removed rather than left beside the new text.

### Revision 4: what changed

| # | Enhancement (review section 7) | Applied in | How |
|---|---|---|---|
| E1 | 15 trip folders, 8 builders | 1.2, 8.1 R1, 6.3 P1 | counts corrected; the 8 builders are listed by name |
| E2 | hooks compute `ROOT` three levels up | 1.2 (hooks row), 6.3 P1a | `../../..` to `../..`, script paths to `tools/...` (already done by P1a step 1) |
| E3 | exact new `Paths` layout, `trips_root` | 1.2 (`tools` row), 6.3 P1b | every `Paths` attribute named with its P1a and P1b value; `trips_root = legacy/` in P1b, and "legacy or data/trips" from P4c |
| E4 | inbox move deferred | 1.2 (inbox row), 6.3 P2b | `locations/inbox/` moves in P2b with the rule at `locations.py:1267`, five test assertions, `test_site_outputs.py:31` and the `location` skill |
| E5 | generated strings verbatim; byte-identical site | 1.2, 1.3, 6.3 P1b | `location_views.py:199-200` untouched until P2b; the `.site/` diff must be empty with `HUB_TODAY` pinned, no exceptions |
| E6 | green-after-each-step order | 6.3 P1a/P1b | the review's steps 0-5, split P1a (0-2) and P1b (3-5) |
| E7 | test files and constants listed | 1.2 (tests row), 6.3 P1 | listed, with one correction: two of the review's constant edits were wrong (claims table below) |
| E8 | stale hook pitfall | 6.3 P1b, briefs | dry run as `python3 tools/publish.py --dry-run`; no Write/Edit on the store during P1 |
| E9 | `archive/` and loose notes | 1.1, 1.2 | they move to `research/trips/<slug>/archive/` and `research/trips/<slug>/notes/`; `research/` may hold HTML and scripts as evidence, never served |
| E10 | CI decision | 1.1 rules, 1.5, D27 | no CI in Phase 1; the gate is the pre-publish hook plus `tools/check-all.sh`; CI arrives with Phase 2's export Action |
| E11 | MapLibre is 6.14.0 | 0 (G2 removed), 3B | G2 deleted; `maplibre-gl@6.14.0` pinned for the app |
| E12 | one canonical table list | 2.2, 2.3, 2.3A, 2.8 (removed), 0A.1, 0B.2 | trip and catalog tables re-issued once; `adventures`/`bookings` gone; `bases.booking_id` gone; one `trip.web_published`; money as scalar pairs. One deviation: `items.offer_id` is not added, because `items.booking_id` already reaches the offer through `trip_bookings.offer_id` and two paths to one fact can disagree |
| E13 | `bases.tz`, `items.tz` | 2.3, 4.13 | `bases.tz` required (IANA), `items.tz` nullable, `trip.origin_tz` required; the zone rule for `hhmm` is stated once in 2.1 |
| E14 | one runtime per concern | 1.5, 2.5, 5.2, 12, 8.1 R2/R3 | TypeScript (in a new `core/` package) for ops, structural validation, day checks, book-by, catalog pipeline, sun, lanes, research index, views and indexes, exports; Python keeps the existing tools; hooks call `node` |
| E15 | Zod-as-source evaluated | 2.5, D26 | decision: Zod 4 is the source; JSON Schema 2020-12 is exported, committed and read by MCP and docs |
| E16 | split P2 | 6.3 | P2a (schema source, export, DDL, validator, hooks) and P2b (locations v3, inbox, day checks, operation catalogue, read-only MCP). Neither touches `web/`: the schema lives in `core/`, so P2 and P3 cannot collide on `web/package.json` |
| E17 | Python runtime | 1.5 | `tools/` stays stdlib-only at run time; `tools/pyproject.toml` pins Python and declares pytest as a dev group; hooks and `publish.sh` run system `python3`, never `uv run` |
| E18 | visibility filtering, merge order | 1.3, 4.13, 6.3 P3a | `public` built and listed, `unlisted` built not listed, `private` never built; `x-private` stripped by a generated allow-list; privacy test with sentinel fixtures; `web/out` copied first, legacy second, `_redirects` last |
| E19 | product basics | 4.1, 4.13 | `/about/data/`, OG tags, `manifest.json`, Cloudflare Web Analytics, JS budget test |
| E20 | split P3, pin versions, 64 places | 3B, 6.3 | P3a and P3b; versions pinned in 3B (checked against the npm registry on 2026-10-17); parity target is exactly 64 places |
| E21 | split P4, geocoding, spend | 6.3, D29 | P4a ops core, P4b ingestion and coverage, P4c imports with a geocode pre-step (126 Rockies rows have no coordinates) and a stated Opus budget |
| E22 | auto-accept lands in `stated` | 0A.2 | new rows land `review_status: proposed`, `confidence: stated`; `verified` needs the owner or two independent official sources |
| E23 | priority floor, calibrated targets | 0A.3 | `priority = max(1, trips_using) * urgency * severity`; targets marked provisional until the P4c data-readiness report |
| E24 | P5c skills and agents, P5a test harness | 6.3, 4.9, 4.13 | P5c is an Opus-owned phase; P5a tests only on committed GeoJSON; offline harness named; fonts self-hosted; ICS and `manifest.json` in P5a |
| E25 | split P5b | 0B.2, 6.3 | P5b1, P5b2, P5b3; `TripDraft` is the trip.json shape plus an operation log; Download/Import trip.json (moved earlier, into P5b1); unknown counting rule for the match counter |
| E26 | P7 v1 | 0A.5, 6.3 | v1 = the fallback planner plus a data-readiness report; the scored algorithm is the v2 spec; `quality` and `crowded` dropped until fields exist; sun in TS |
| E27 | route fixture and format | 0B.5, 6.3 P8 | committed Calgary-Jasper fixture with provenance and ODbL line; polyline precision 6 plus per-vertex `t_s`/`d_m` arrays in a sidecar; hand-marked ferry and pass segments; tested Overpass limiter; depends on P5b3's index |
| E28 | refetch, `__` file names, hashed leg ids | 3A, 2.3A | `trails.py refetch --changed` yearly; `/` becomes `__` in file names; legs are `lg-<10 hex>` with `from_id`, `to_id`, `mode` columns |
| E29 | Phase 2 truth decision | 5.6, 6.3 (Phase 2 outline), D28 | decision row with both designs and a recommendation (git-backed writes) to settle before the Phase 2 plan |
| E30 | file ownership for parallel pairs | 6.4 | one table per parallel pair; "commit only owned paths, never `git add -A`"; one worktree per agent when two run at once |
| E31 | accessibility gaps | 0B.6 | reduced motion, sr-only day and leg tables, focus on view changes, `lang` on local names |
| E32 | honest offline | 4.9 | geohash cells precached; the tile cap will usually be hit on mountain trips and the blank-basemap fallback is the expected experience |
| E33 | localStorage keys | 4.10, 4.13 | keys named from `base.js` (`<slug>:<id>`, `<slug>:plan`, `data-ck-legacy` prefixes `ch27-`, `dolo27-`, `qc26-`) and the migration rule |

Also fixed in this revision (found while checking, not in the review): the catalog common block's `status` collided with `places.status` (the owner's wishlist status) and `trip.status`; it is now `review_status`. Locations v2 places already have `kind`, so the v3 migration does not "add `kind`" (the old P2 text said it did). The Rockies `bases.json` also has no coordinates, so the geocode pre-step covers 126 rows, not 110. `/<slug>/edit/` became `/edit/?trip=<slug>` (one static page instead of one disabled page per trip, review 4.3). Tooling that has no Python history today (sun, exports, lanes, research index, views) is written in TypeScript once, not in Python first.

### Review claims checked (2026-10-17)

Every factual repo claim in the review was re-run. These were wrong or imprecise; everything else held (15 trip folders, 8 builders, hook `ROOT`, `trips_root` uses, the inbox rule and its assertions, the generated strings, 64 places, 8 places with `trip`, 12 hub badges, 441 files under `globe/assets/`, MapLibre 6.14.0, 48/62/43/33 Rockies rows with no coordinates, `adventures.merged.json`, `import gallery as G` at line 800, Node 22.23 and pnpm 12.4, the repo is private, no `.github/`, no root `README.md`).

| Review claim | Finding |
|---|---|
| Section 3 item 14: `test_migrate_v2.py:52` and `test_locations_split.py:16` must change `HERE.parents[1]` to `parents[2]` | **Wrong.** `HERE` is the test file's directory. `parents[1]` of `_system/tests` and of `tools/tests` are both the repo root, so no change is needed; P1a step 1 left them as they were and the suite passed |
| Section 3 item 13: seven test files use `HERE.parent / "tools"` | **Imprecise.** Five do (`test_location_views`, `test_locations`, `test_locations_split`, `test_migrate_v2`, `test_schema_sqlite`); the other two (`test_list_page`, `test_site_outputs`) use `ROOT / "_system" / "tools"` (item 15). Seven files in total need a `sys.path` edit |
| Section 5 / E17: "system 3.14, no jsonschema" | **Wrong.** System Python 3.14.4 has `jsonschema` 4.19.2 and pytest 9.0.2. The conclusion still holds (relying on an unpinned system package in a hook is fragile), and revision 4 removes the need: hooks validate through Node |
| P4 verdict: Patagonia's tables are "prose Markdown" | **Partly wrong.** `patagonia-feb-mar-2027/PLAN.md` has pipe tables under Trails, Bookings and deadlines, Adventures, Budget, Night split and Day by day (275 table lines). Hazards and Gotchas are lists. The P4c count test therefore counts table rows per section and leaves prose sections to the owner's sign-off |
| P4 verdict: "only `bases.json` may carry points" | **Wrong.** None of the Rockies files has coordinates; `bases.json` (16 rows) has none either |
| Section 3 item 7: `locations.py:231` reads `ROOT/_system/site/countries.json` | **Imprecise.** That line is a fallback after `PATHS.countries_json`; it still has to change, because the fallback otherwise names a path that no longer exists |
| Section 2 P2: the v3 migration adds `kind` | **Wrong (inherited from the plan).** v2 `places` already has `kind`; v3 moves the tag vocabulary out and adds catalog columns (2.3A) |

**Revision 3 (17 Oct 2026):** section 0B specifies the trip creation flow, search-to-add, notes, routing with breaks and guardrails.

**Revision 2 (17 Oct 2026):** the product is now a global catalog plus trips that reference it, with a research flywheel, a coverage model, multi-user-ready schema, a no-AI trip builder and a free-data price approach. Read section 0A first; sections 1, 2, 4, 6, 7 and 8 carry "Revised" subsections where they changed.

**The plan in ten lines.**

1. Three layers: `research/` (raw, never published), `data/` (schema-versioned JSON in git, the system of record in Phase 1), `web/` (Next.js static export on the existing Cloudflare Pages project). Python tools in `tools/`, hand-built pages in `legacy/` until each trip migrates; every current URL keeps working (1.3).
2. One schema source (Zod 4 in the `core/` TypeScript package, with SQL, UI and privacy metadata) exports a committed JSON Schema and generates the D1 DDL and the operation catalogue; each concern has one runtime, so hooks call Node for validation and Python keeps only the existing tools (2.5, 1.5; revised 4).
3. `trip.json` is season-based: days are numbered, deadlines are offsets, an edition resolves dates. The unit is trip > day > timed item, with legs, Plan B and day checks (2).
4. Every bookable thing is a booking row with its opening window, sell-out speed, limits and a computed book-by date; every research agent returns bookings in one shared shape (2.3, 2.3A, 7.4).
5. Trails are a global catalogue with stored GeoJSON from OSM (Waymarked Trails) or agency datasets, an elevation profile, and a house difficulty scale 1-5 that keeps the local grade (3A).
6. Default UI stack: shadcn/ui (Base UI) + TanStack Table + Recharts profile + MapLibre; every entity gets cards, list, table (with an advanced filter panel) and map views from one descriptor, with the filter bar on top and all state in the URL (3B, 4.2).
7. One operation set serves the UI, the HTTP API, MCP and skills; imports and re-research produce proposals, never silent writes (5).
8. Phase 1 is read-mostly in the cloud, editable on the owner's machine (and in the browser for new drafts); Phase 2 adds a Worker and remote MCP, with the write path decided first (D28: git-backed writes recommended over D1 with a nightly export) (3C, 5.6; revised 4).
9. Phase 1 is seventeen sub-phases, each one Sonnet agent and one PR (P5c is Opus): P1a/P1b restructure, P2a/P2b schema, P3a/P3b app and places, P4a/P4b/P4c operations, ingestion and two imports, P5a plan pages, P5b1-P5b3 creation flow, P5c skills and agents, P6 globe and catalog lists, P7 v1 planner, P8 routing with breaks (6.3; revised 4). Briefs are in `docs/archive/v1/briefs/`.
10. D1-D25 were approved with the recommended answers; revision 4 adds D26-D30 (8.6), each with a recommendation.

### Where the addenda changed the plan

| Addendum | Folded into |
|---|---|
| 1: social capture, extending research, fares, tooling carry-over, weather rules, domain | sections 9, 10, 11, 12, 13, 14 |
| 2: filter bar on top, advanced panel, four views including map, forms and draft/publish, MCP tool list, stack comparison, trails first-class, gaps check | 4.2, 4.7, 5.7, 3B, 3A and 4.4, "Gaps found" below |
| 3: embeds plus links, feature parity, trip tags and style, research agents by trip type | 4.8, 4.10, 2.3 (trip_tags) and 2.6, 7.2 and 7.3 |
| 4: day-by-day timed items with checks and worked days, trip type taxonomy, structured research sidecars, booking research inside every agent | 2.3 (items, bookings), 2.4, 2.6, 2.7, 7.2 (bookable output column), 7.4, 10.1-10.2 |

### Gaps found (requirements still missing or ambiguous)

Checked against the brief and all four addenda.

| # | Gap | Recommendation |
|---|---|---|
| G1 | The brief says Next.js 15; 16 has been stable since Oct 2025 | Use 16 (D2) |
| G2 | (removed in revision 4: the version was already recorded; `globe/assets/vendor/VERSIONS.txt` says `maplibre-gl 6.14.0`) | the app pins `maplibre-gl@6.14.0` (3B) |
| G3 | Style tag lists differ between the brief, addendum 3 and addendum 4 (`luxury` vs `luxury-relax`, `relax`, `mixed`) | One vocabulary of 11 style tags, `luxury` as an alias, `mixed` as a primary style only (2.6, D7) |
| G4 | `research/<trip-slug>/` and `research/<place-id>/` would share one namespace with `vault-notes/` and `inbox/` | `research/trips/<slug>/` and `research/places/<id>/` (D8) |
| G5 | Locations v2 "collections" (road-trip ideas) have no stated relation to trips | A collection can seed a trip: `trip.create --from-collection <id>` adopts its places in order as candidate items; collections stay idea-level |
| G6 | After a trip, nothing marks its places visited | `trip.set_status travelled` proposes `place.visit_add` for every place used, dated from the edition |
| G7 | Private fields (ages, heights, confirmations) are needed on the owner's phone but must not be public | Phase 1: private fields only in the local editor; Phase 2: an Access-protected owner view of the plan page |
| G8 | Checklist and booking ticks are per device (localStorage); two adults on a trip will not see each other's ticks | Phase 2: sync tick state to D1 per trip; Phase 1 accepts per-device state |
| G9 | Base currency is assumed CAD everywhere | Make it explicit in `fx` (CAD base) and in the profile |
| G10 | Travellers' citizenship is not in the profile; the entry lane needs it | Add per traveller, private (D6) |
| G11 | Drive times between items have no source beyond manual matrices and inference | Keep manual plus Google directions links in Phase 1; decide a routing API in Phase 2 (D13) |
| G12 | Prose editing in the UI is not specified | Markdown textarea with live preview for `prose/*.md`; no rich-text editor |
| G13 | A quick-search or command palette (the Travel Finder's centrepiece) is not in the brief | Add a `/` and Ctrl+K palette in P5b3 (`UniversalSearch`) over the static search index; no natural-language parsing in v1 |
| G14 | Search-engine indexing of public plan pages is unstated | `noindex` on plan pages (D16) |
| G15 | Order of migrating the 13 other legacy trips is unstated | By next travel date (D15) |
| G16 | "Sold out" is a booking state no tool can detect reliably | Manual status, plus the conditions routine and price-watch flag likely sell-outs as questions |

## 0A. Product direction: catalog, flywheel, planner (new in revision 2)
### 0A.0 What changed in this revision

Owner direction, 17 Oct 2026: what is built for the owner today must work for other people tomorrow. The product is a **global catalog of travel knowledge plus trips that link to it**. Claude is one way to fill and use it, but a person with no AI must be able to say where, how many days, when and what kind of trip, and get an editable itinerary. Research is never lost: it feeds the catalog. Nothing paid.

| Area | Before this revision | Now | Sections touched |
|---|---|---|---|
| What is shared | places (locations) and trails | a catalog of places, trails, activities, stays, eateries, bookable offers, route legs and area guides, each with provenance and freshness | 0A.1, 1.4, 2.8 |
| Adventures, stays, bookings | per trip | activities, stays and **offers** are catalog entities; a trip keeps only references plus its own choices (day, time, party, notes, overrides, status, confirmation) | 2.8 (supersedes those tables in 2.3) |
| Research | feeds one trip through proposals | feeds the catalog first, through one ingestion path with auto-accept rules; every trip, however created, contributes the same way | 0A.2, 7.6 |
| Coverage | not modelled | a computed coverage score per area and a research backlog built from GAP markers, staleness and thin coverage | 0A.3, 4.11 |
| Users | single owner | multi-tenant-ready schema (`owner_id`, `visibility`, contributor attribution, public and private layers), no accounts built | 0A.4, 2.8, 8 |
| Trip creation | Claude-led (trip-planner) or by hand | plus a **deterministic no-AI trip builder** over the catalog, gated on coverage | 0A.5, 4.11, 6.1 (P7) |
| Prices | Playwright scraping for the owner's research | deep links, stored price snapshots with staleness, user-entered prices; live data only where free and allowed (weather, FX); scraping stays an owner-only research tool | 0A.6, 11 |
| Phases | P1-P6 | P2 widened (catalog schemas, provenance, visibility); ingestion and merge in P4; builder as P7 after coverage gates | 6.1 |
| Decisions | D1-D16 | plus D17-D22 (personal tool or product, catalog licence, who edits, affiliate sign-ups, auth path, BYO key) | 8.3 |

### 0A.1 Catalog versus trip (Revised 4)

**Rule:** a fact about the world lives once, in the catalog. A trip stores references to catalog rows plus what only that trip knows: day, time, track, party, notes, overrides, decisions, status, confirmation, and private data.

**Revised 4:** the tables below are a summary. The authoritative column lists are 2.3 (trip) and 2.3A (catalog); where a summary here and 2.3A differ, 2.3A wins.

#### Catalog entities

| Entity | Store | Id pattern | Key fields beyond the common block |
|---|---|---|---|
| Geography (countries, regions, areas) | `data/locations/locations.json` (schema v2, unchanged) | `CA`, `CA/AB`, `CA/AB/banff` | as today |
| `place` | `data/locations/` | `CA/AB/banff/lake-louise` | kind, coordinates, wikidata, image (as today) |
| `trail` | `data/catalog/trails/<CC>.json` + `geo/` | place-style path | 2.3 trail catalogue row: km, gain, house grade, local grade, geometry ref |
| `activity` | `data/catalog/activities/<CC>.json` | `<area_id>/<slug>` | type (the adventure enum of 2.3), operator, duration_min, indoor (bool), weather_sensitive (bool), adventure_level 1-5 |
| `stay` | `data/catalog/stays/<CC>.json` | `<area_id>/<slug>` | kind (`hotel`, `lodge`, `cabin`, `apartment`, `hut`, `campsite`, `hostel`), comfort_tier 1-4, sleeps_max, elevation_m, car_free_access, last_transport |
| `eatery` | `data/catalog/eateries/<CC>.json` | `<area_id>/<slug>` | cuisine, price_tier 1-4, kids_menu (bool or null), reservation (`required`, `recommended`, `walk-in`), hours |
| `offer` | `data/catalog/offers/<CC>.json` | `of-<provider-slug>-<product-slug>` | the bookable product: everything a booking needs that is not trip-specific (2.3A; provider, `book_url`, `reseller_urls`, limits, `opens_*`, `sellout_*`, `same_day`, cancellation, weather refund), plus `subject` (`{entity, id}`: the activity, stay, trail permit, place ticket or leg it books) |
| `offer_price` | `data/catalog/offers/<CC>.json`, table `offer_prices` | `<offer_id>#<n>` | amount, currency, `per`, `age_from`/`age_to` for child bands, `valid_months`, `read` date, source, `window` (for flights) |
| `leg` | `data/catalog/legs/<CC>.json` | `lg-<10 hex>` (hash of `from_id`, `to_id`, `mode`; revised 4, the old `<from>~<to>~<mode>` ids grew to hundreds of characters) | `from_id` and `to_id` (any catalog ids with coordinates), mode, km, minutes, basis (`routed`, `timetable`, `matrix`, `inference`), seasonal notes (closures), symmetric (bool) |
| `area_guide` | `data/catalog/areas/<CC>.json` | the area id | summary (our wording), best months, getting there, hidden gems (place ids with one line each), what to know, safety notes |

#### Common block on every catalog row

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | stable once created; merges keep the surviving id and record `merged_from` |
| area_id | text | no | FK areas (the country > region > area hierarchy); geography rows excepted |
| tags | json | no | canonical vocabulary ids (shared with trips) |
| kid_fit | text | no | `yes`, `strong-kid`, `no`, `unknown` |
| min_age, max_age, min_height_cm, max_height_cm, min_weight_kg, max_weight_kg | int | yes | eligibility; on activities and offers mainly |
| house_grade | int | yes | 1-5 (3A); on trails, activities and places of kind trail |
| walk_km, walk_gain_m | real, int | yes | walking involved (for a sight with a long approach, an activity with a hike) |
| accessibility | text | no | `step-free`, `partial`, `none`, `unknown` |
| season_months | json | no | months it works; `[]` when unknown |
| cost_ref | text | yes | an `offer_id` or a one-line reference ("free", "park pass") |
| review_status | text | no | `raw` (machine-extracted, unreviewed), `proposed` (in a proposal, or auto-accepted without owner review), `verified` (reviewed by the owner, or two independent `official` sources agree), `stale` (a field passed its freshness limit), `retired`. Revised 4: renamed from `status`, which collided with `places.status` and `trip.status` |
| confidence | text | no | `verified`, `stated`, `inference`, `gap`, `conflict` |
| sources | json | no | source ids (table `sources` in the same file: url, title, publisher, kind, read date) |
| field_meta | json | no | per-field provenance for fast-expiring fields: `{"hours": {"read": "2026-10-13", "src": ["src-0041"]}, "price": {...}}` |
| verified_by | text | yes | actor id that last verified (`u_owner`, `agent:research-trails`) |
| last_verified | date | yes | |
| contributed_by | json | no | actor ids that created or edited the row (attribution) |
| licence | text | no | `own-words` (our summary, default), `odbl` (OSM-derived), `ogl-ca`, `cc-by-4.0`, `public-domain` |
| updated | date | no | |

#### Freshness policy per field class (`data/schema/freshness.json`)

| Field class | Examples | Stale after | On stale |
|---|---|---|---|
| prices | `offer_prices.amount`, fares | 120 days, or the next season if `valid_months` ended | badge "price read 5 months ago"; backlog item when a trip with a chosen edition uses it |
| hours and closed days | `eatery.hours`, `open_from` | 180 days | badge; backlog item |
| booking windows and sell-out | `opens_*`, `sellout_*` | 365 days (one season) | backlog item before the next season |
| closures and conditions | trail closures, road status | 7 days | never trusted for planning; the conditions routine re-reads them |
| hard limits | ages, heights, weights | 365 days | badge |
| trail stats | km, gain, grade | 3 years | none unless a source changes |
| geography, coordinates, geometry | ids, lat and lon, GeoJSON | never | none |
| our summaries | area guides, place notes | 2 years | review prompt |

`review_status` becomes `stale` when any field with a policy passes its limit; `catalog freshness` (in `core/`, run as `node core/bin/catalog.ts freshness`; revised 4) recomputes it at build time (deterministic for a given date) and writes backlog items (0A.3).

#### What a trip keeps

| Trip table | References | Trip-only fields |
|---|---|---|
| `items` | `place_id`, `trail_id`, `activity_id`, `eatery_id`, `leg_id`, `custom_item_id`, `booking_id` (a `trip_bookings` row, which carries the `offer_id`) | day, track, seq, start or window, duration, tz, pinned, `override` (json: any catalog field replaced for this trip, e.g. a different start point), notes, Plan B pointer |
| `bases` | `stay_id` or `place_id` | nights, tz, why, why not |
| `trip_activities` (replaces `adventures`) | `activity_id` | day, verdict, why, party fit (derived) |
| `trip_bookings` (replaces `bookings`) | `offer_id`, `base_id` (for a stay) | used_days, book-by (computed from the offer and the edition, editable), priority, status, price_paid_amount and price_paid_currency (private), confirmation (private), contact (private), notes |
| `trip_trails` | `trail_id` | role, alternative_of, turnaround rule, party note, verdict (as 2.3) |

A trip-specific fact that the world should know (a corrected trail grade, a new opening window) is not an override: it is a catalog edit (0A.2). Overrides are for genuinely trip-specific choices.

### 0A.2 The flywheel: research always feeds the catalog (Revised 4)

**Revised 4:** the pipeline is written once, in TypeScript (`core/src/catalog/`, CLI `node core/bin/catalog.ts <step>`), and runs on the owner's machine in Phase 1 and in the Worker in Phase 2. There is no Python `tools/catalog.py` and no "TS twin". New rows auto-accept only to `stated` (table below).

#### One ingestion path

| Step | Tool or operation | What happens |
|---|---|---|
| 1. Capture | any research agent, `trip-import`, the capture pipeline (section 9), a UI form | Markdown for people plus a `research-sidecar/1` sidecar (10.1) whose `records` are catalog-shaped rows (places, trails, activities, stays, eateries, offers with prices, legs, area-guide facts) |
| 2. Normalise | `catalog normalise` | units to metric, currencies kept with ISO codes, enums mapped (the Rockies' `guided_hike` to `guided-hike`), tags through the vocabulary, local difficulty to the house grade (3A), dates to ISO, ids proposed from the area hierarchy |
| 3. Match | `catalog match` | in order: exact id; external ids (wikidata, OSM relation, operator `book_url` host + path); coordinates within 300 m plus name similarity of at least 0.85 (trigram) for places, stays, eateries; trailhead within 500 m plus name for trails; provider plus product name for offers. A match above threshold is "same entity"; between 0.6 and 0.85 is "possible duplicate" and always goes to review |
| 4. Merge | `catalog merge` | per field: a new value with a newer read date and an equal or better source kind (`official` > `operator` > `press` > `reseller` > `blog` > `community`) replaces; an older or weaker value is kept as an alternative in `field_meta`; disagreeing values of equal strength become `conflict` |
| 5. Proposal | `catalog.propose` (operation, like `research.propose` in 5.4) | a diff of catalog changes plus any trip changes, each change with its sources, sidecar path and fact keys |
| 6. Review | the "Proposed changes" queue (UI) or a skill with explicit ids | auto-accept rules below; everything else waits for the owner |
| 7. Catalog | `catalog.apply` | rows written with `review_status`, `confidence`, `verified_by`, `contributed_by`; a `catalog_changes` row per change (who, when, op, before, after, proposal id) |
| 8. Reuse | every later trip, the builder (0A.5), coverage (0A.3) | the next trip in the area starts from the catalog, not from zero |

**New operations** (added to the catalogue of 5.3 and generated into the API and MCP like the rest): `catalog.add`, `catalog.edit`, `catalog.merge`, `catalog.retire`, `catalog.verify`, `catalog.propose`, `catalog.apply`, `catalog.coverage` (read), `backlog.list` (read), `backlog.add`, `planner.draft` (read: returns a draft, writes nothing). New MCP tools: `get_coverage`, `list_backlog`, `propose_catalog_change` (Phase 1 read tools for the first two; writes in Phase 2).

**Auto-accept rules** (owner can switch each off in `data/catalog/policy.json`):

| Change | Auto-accept when |
|---|---|
| New row (place, trail, activity, stay, eatery, offer, leg) | at least one `official` or `operator` source, no possible duplicate, all required fields present; lands as `review_status: proposed`, `confidence: stated`, `contributed_by: [agent:<lane>]` (revised 4: never `verified` without review) |
| Promotion to `verified` | the owner verifies the row (`catalog.verify`), or two sources of kind `official` from different hosts state the same value for every required fact; `verified_by` records which |
| New price snapshot | always (snapshots append; nothing is overwritten) |
| New link (official, AllTrails, map links) | always |
| Filling a null field | source kind `operator` or better |
| Changing a non-null fact, hard limits, house grade, any deletion or merge | never; owner review |
| A price change over 20% against the last snapshot | appended, plus a question on any trip using the offer |

#### Every way of making a trip feeds the catalog the same way

| Trip origin | Path into the catalog |
|---|---|
| Created with Claude (`trip-planner`) | lane agents write sidecars; the bookings audit consolidates; steps 2-7 run before the plan synthesis, so the plan references catalog ids |
| Built by hand in the UI | each form that adds something new (a stay, an activity, a booking) calls `catalog.add` first and then links it from the trip (`item.add` with the new id); the form shows "This will also be added to the shared catalog" |
| Imported from an old PLAN.md (`trip-import`) | the import writes sidecars from the PLAN.md tables and research files, runs steps 2-7, then proposes the trip with references |
| Generated by the builder (0A.5) | reads the catalog only; it never adds facts, so there is nothing to ingest until the user adds or corrects something |

#### A hand correction becomes a catalog edit

Example: on the Patagonia Day 8 page the owner changes Laguna de los Tres from house grade 4 to 5 in the trail sheet.

1. The sheet's edit control calls `catalog.edit` on `AR/santa-cruz/el-chalten/laguna-de-los-tres` with `{house_grade: 5, reason: "final 2.4 km is exposed scrambling in wind", source: null}` and actor `u_owner` via `ui`.
2. A `catalog_changes` row records the before and after, actor and reason; the trail's `contributed_by` gains `u_owner`, `verified_by` becomes `u_owner`, `last_verified` today.
3. Every trip that uses the trail sees the change; their day checks re-run (a Track B day that uses it now warns).
4. If the edit is really a trip-only choice ("for our party treat it as grade 5"), the sheet offers "Only for this trip", which writes `trip_trails.override` instead.

In Phase 1 (git), the same edit is a commit to `data/catalog/trails/AR.json` with the changelog row; in Phase 2 it is a D1 write exported nightly.

### 0A.3 Coverage and the research backlog (Revised 4)

**Revised 4:** the targets and weights below are provisional. They were set before any region was imported, and two of the seven types (eateries, area guides) exist in no research today. P4c computes coverage for the two imported regions and writes a data-readiness report (`docs/reports/data-readiness-<date>.md`); the owner then fixes the targets in a dated calibration table at the end of this section. Until then no phase gates on a band.

#### Coverage score per area

`catalog coverage` (`core/`) computes, for each area (and rolled up to region and country), a score per entity type and a weighted total. Every row counts by freshness: `verified` and fresh 1.0, `verified` but `stale` 0.5, `raw` or `proposed` 0.3, `retired` 0.

| Type | Target per area (counts as full) | Weight in the total |
|---|---|---|
| sights (places of kinds viewpoint, waterfall, museum, town, park ...) | 8 | 0.25 |
| trails | 6 | 0.20 |
| activities with an offer | 4 | 0.15 |
| stays | 3 | 0.15 |
| eateries | 3 | 0.05 |
| legs between the area's top 6 places and its stays (share of pairs covered) | 100% | 0.10 |
| area guide present and fresh | 1 | 0.10 |

`coverage_type = min(1, weighted_count / target)`; `coverage = sum(weight * coverage_type)`. Bands: **thin** under 0.4, **usable** 0.4-0.7, **good** 0.7 and over. Style-specific scores re-weight the same numbers (an `adventure` view weights trails 0.35 and activities 0.30; `luxury-relax` weights stays and eateries). The scores are written to `data/catalog/coverage.json` (generated, deterministic per build date).

#### Research backlog

`data/catalog/backlog.json` (generated from the data, plus owner-added rows):

| Column | Meaning |
|---|---|
| id | `bl-<hash>` stable for the same subject and reason |
| subject | `{entity, id}` or `{area_id}` |
| reason | `gap` (a GAP marker or `confidence: gap` on a field), `stale` (freshness policy), `low-coverage` (area band thin for a type), `conflict`, `user-request` (Phase 2: requested by someone without agents) |
| field | the field concerned, when there is one |
| lane | suggested lane (7.2) |
| priority | `max(1, trips_using) * urgency * severity` (revised 4: the floor of 1 keeps backlog items on areas no trip uses yet, which is where coverage work is needed): urgency 3 if a chosen edition starts within 120 days, 2 within a year, 1 otherwise; severity 3 for hard limits, booking windows and prices on must-book offers, 2 for hours and stats, 1 otherwise |
| status | `open`, `claimed` (by an agent run id), `done`, `wont-do` |
| created, done | dates |

Agents work it with `trip-research --backlog [--area <id>] [--limit 10]`: the top items are grouped by area and lane and run as normal lane jobs whose sidecars flow through 0A.2. The owner sees the backlog as a table view with the usual filters.

#### Coverage in the UI

Area pages and the builder show the band and the per-type counts ("Banff: good. 41 sights, 38 trails, 22 activities, 9 stays; 6 prices stale"). The globe gets a coverage layer (areas tinted by band). The builder warns before it plans in a thin area (0A.5).

#### Calibration (filled after P4c)

| Date | Area | Measured per type (sights, trails, activities with offer, stays, eateries, legs share, guide) | Score with provisional targets | Targets adopted | Decided by |
|---|---|---|---|---|---|
| (after P4c) | Banff, Lake Louise, Jasper, Kananaskis, El Chalten, Ushuaia, El Calafate | from `data/catalog/coverage.json` | | | owner |

### 0A.4 Multi-user readiness (designed now, built later)

#### Two layers

| Layer | Contains | Who can read | Who can write (later) |
|---|---|---|---|
| Public catalog | facts (coordinates, stats, limits, windows, prices with read dates), our own summaries, links, licensed geometry, licensed images | anyone; downloadable as `/data/catalog/*.json` | owner now; later contributors through proposals (D19) |
| Private user layer | a user's trips (unless they publish one), travellers' ages, heights, weights, citizenship, booking confirmations, prices paid, contacts, notes, saved views, checklist ticks, inbox captures | the owning user (and people they share with, later) | the owning user |

Never public, regardless of settings: traveller ages, heights, weights and citizenship; booking confirmations and contacts; prices paid; inbox screenshots and social captions; the raw `research/` tree; any text copied from a blog, forum or social post.

#### Schema readiness, built now

| Field or rule | Where | Value today |
|---|---|---|
| `owner_id` | `trip` row | `u_owner` on every trip |
| `visibility` | `trip` row | `public` (the published page without private fields), `unlisted`, `private`; today's trips are `public`, matching current behaviour |
| `actor` on every operation | ops input envelope | `{id: "u_owner", via: "ui"|"cli"|"mcp"|"agent:<lane>"}` |
| `contributed_by`, `verified_by` | catalog common block | actor ids |
| `catalog_changes` | catalog files | one row per change with actor |
| Ownership checks | ops layer (D1 has no row-level security, so every read and write path filters by `owner_id` and `visibility` in the ops functions; tests assert it per operation) | trivially true with one owner |
| `x-private` | schema | drives the export allow-list |

#### Licensing

| Material | Licence | Obligation |
|---|---|---|
| OSM-derived geometry and tags (trail lines, some coordinates) | ODbL 1.0 | attribution; the catalog partition that contains it is shared alike under ODbL |
| geoBoundaries ADM2 (the globe's district level) | gbOpen is described as CC BY 4.0, but the geoBoundaries R package notes that gbOpen mixes CC BY, ODbL, CC BY-SA and national licences per boundary | attribution to geoBoundaries and the original source; `tools/globe_data.py` records each country's boundary licence from its metadata and the build lists them |
| Natural Earth | public domain | credit anyway |
| Parks Canada, NPS, Wanderland data | OGL-Canada, US public domain, opendata.swiss "must provide the source" | attribution strings (3A) |
| Open-Meteo data | CC BY 4.0 | attribution on weather and elevation displays |
| Our summaries, area guides, notes | our own; catalog licence decision D18 | |
| Blog, forum, Reddit, social posts, operator marketing text | not ours | **store facts in our own words plus the link**; short quotes only as private evidence in `research/` |
| Images | per file (Commons licences, recorded by the gallery pipeline) | attribution line per image; no images from Instagram, Facebook or blogs |

Recommendation for D18: publish the catalog under **ODbL** as a whole. It contains OSM-derived data, which forces share-alike on that part anyway, and a single licence is easier for anyone reusing it than a split between CC BY facts and ODbL geometry.

#### Auth beyond one owner (decision D21, not designed here)

| Option | What it gives | What it costs | Recommendation |
|---|---|---|---|
| Cloudflare Access with an email allow-list | the owner plus a few invited people (family); no user database; free tier covers small teams | no self sign-up; identity is only an email; ownership must map emails to `owner_id` | **keep this until D17 says "product"** |
| Auth.js (self-hosted on the Worker) with email magic links or OAuth | real accounts, sessions, free | we run sessions, account deletion, abuse handling | first choice if it becomes a product |
| A hosted identity provider's free tier | less code | vendor limits and lock-in | second choice |

What changes in any multi-user move: per-user `owner_id` on new trips, ownership checks already in the ops layer start to matter, saved views and ticks become per user, catalog edits by non-owners go through proposals only, rate limits on the API and the inbox, and a privacy policy.

### 0A.5 The no-AI trip builder (Revised 4)

**Revised 4: v1 and v2.** The scored algorithm below needs inputs that no data holds yet: quality signals, a `crowded` tag, per-weekday opening hours, eateries, and a leg matrix. Phase 1 ships **P7 v1**, which uses only what exists:

| v1 step | Rule |
|---|---|
| Candidates | catalog rows in the chosen areas (no 90-minute radius, because legs are sparse) |
| Filter | step 2 below, unchanged; rows with unknown limits are kept with a warning |
| Score | `3*tag_match + 2*must_do + 1*freshness` (no `quality`, no crowding penalty) |
| Bases | the user's bases from S5, or one base per area in area order with nights split by candidate count; no clustering |
| Days | per base, picks spread across that base's nights in score order, at most `pace + 1` items a day, no times; one generic meal slot at 12:30 and one at 19:00 (an item of type `meal` with no eatery) |
| Distances | straight line x 1.4 at 60 km/h everywhere, every number labelled "estimate" |
| Output | a `trip.json` draft, `generated_by: planner@1`, with a per-item reason line |

v1 also produces the **data-readiness report** per area (what the v2 steps would need and what is missing: rows with `duration_min`, rows with hours, eateries, legs between top places and stays). The full algorithm below is the **v2 spec**, re-planned once two regions have calibrated coverage (0A.3). v2 adds `quality_signals` (json: official top lists, number of plans using the row, owner rating) to the catalog common block in a schema migration at that time; until then the term is absent from the schema.

A deterministic planner over the catalog. It runs in the browser (pure TypeScript in `web/lib/planner/`, same day checks as 2.4, and sun times from `core/src/sun/`, the one sun implementation), so it works on the static Phase 1 site with no server and no AI. Same inputs plus the same catalog snapshot always give the same draft (ties broken by id).

#### Inputs (the first screen at `/plan/new/`)

| Input | Maps to | Default |
|---|---|---|
| Where: one or more areas, regions or a country | `trip.countries`, candidate areas | required |
| How many days | days 1..N, `nights = N - 1` (0 for a day trip) | required |
| When: month(s) or exact dates | `season_months`, optional edition | month required |
| Party: adults, children with ages (heights optional) | `travellers` (private, stored locally) | 2 adults |
| Style tags | `primary_style`, `trip_tags` | `active-nature` |
| Pace 1-5 | `profile.pace` | 3 |
| Walking per day: km and gain | `hiking_ceiling_km`, `hiking_ceiling_gain_m` | 10 km, 500 m |
| Adventure level 1-5 | max `activity.adventure_level`; `max_house_grade` | 3 |
| Luxury level 1-4 | stay `comfort_tier`, eatery `price_tier` | 2 |
| Budget per day for the party (optional) | filter on offer prices with fresh snapshots | none |
| Transport | `profile.transport` | rental car |
| Base preference | `profile.base_preference` | balanced |
| Must-do and avoid | catalog ids or tags | none |

#### Steps

| # | Step | Rule |
|---|---|---|
| 1 | Candidates | all catalog rows in the chosen areas, plus rows within 90 minutes of them by catalog legs (or straight-line distance x 1.4 at 60 km/h where no leg exists, marked `inference`) |
| 2 | Filter | season (`season_months` includes the month, or unknown), eligibility for the youngest and smallest traveller (ages, heights, weights; unknown limits are kept with a warning), `house_grade <= max`, `walk_km`/`walk_gain_m` within the per-day ceiling, kid fit when children are present, `adventure_level <= level`, comfort tier within one of the luxury level, `status != retired`, opening months, `avoid` |
| 3 | Score | `score = 3*tag_match + 2*must_do + quality + 1*freshness - 2*crowding_penalty`. `tag_match` = share of the row's tags in the chosen styles and interests; `quality` = 0-2 from signals we hold (official "top 10" lists, appearance in N plans, owner rating when present); `freshness` = 1 fresh, 0.5 stale, 0.2 raw; `crowding_penalty` = 1 for rows tagged `crowded` when pace is 1-2. Weights live in `data/catalog/planner-weights.json` |
| 4 | Bases | cluster the top-scored candidates by travel time (k-medoids over leg minutes, k from days and `base_preference`: few-long 1 base per 4-5 nights, balanced per 3, many-short per 2; single-base forced for day trips and `single-base`); pick a stay per cluster by comfort tier and score; night split proportional to the cluster's scored content, minimum 2 nights unless `many-short` |
| 5 | Day assembly | per base night: an anchor (the best item within 90 min of the base), then greedy nearest-neighbour additions that fit opening hours, daylight (sun times computed for the month, mid-month if no dates), travel legs and the pace budget (2.4: 5-13 active hours by pace); meals inserted at 12:00-13:30 and 18:30-20:00 windows near the route; one `buffer` per day at pace 1-3; travel days between bases carry the leg plus at most one stop on the way |
| 6 | Validate and repair | run the day checks; while a day fails, drop its lowest-scored optional item, then shorten, then move the item to a free day in the same base; never exceed the walking ceiling |
| 7 | Plan B and swaps | for each outdoor item with `weather_sensitive`, the best-scoring `indoor` or sheltered alternative within 45 minutes becomes a track `P` item; days in the same base with weather-sensitive anchors form a `flexible_group` so the user (or the conditions routine) can swap them |
| 8 | Bookings | each chosen offer becomes a `trip_bookings` row with the book-by date computed from its window (2.3) when dates are known |
| 9 | Output | a normal `trip.json` draft (`status: idea`, `generated_by: planner@<version>`, `owner_id`, `visibility: private`) with an explanation per item (score breakdown and which filters it passed), opened in the editor |

#### Personalisation controls

Sliders and toggles re-run steps 2-7 instantly in the browser and say what changed.

| Control | Effect on filters and weights | Example message |
|---|---|---|
| Less walking | ceiling -25% per step, `max_house_grade - 1` at the second step | "Walking cut to 6 km and 300 m a day; 12 of 40 trails remain" |
| Less adventure | `adventure_level - 1`; activity weight x 0.7 | "Rafting and via ferrata removed; 2 boat trips added" |
| More relaxed | pace - 1; later first start (09:00); an extra `rest` item | "Day length now 7 h; Day 4 has a free afternoon" |
| More luxury | comfort tier + 1; eatery price tier + 1; spa activities weighted up | "3 stays upgraded; 2 nights have no stay at tier 3 (thin)" |
| Kid-friendly | `kid_fit = yes` only; limits checked for the youngest; pace capped at 3 | "Big Ice removed (18+); minitrekking kept (8-65)" |

#### When coverage is thin

The planner never invents. Before planning it shows the area's band (0A.3). If the filtered candidates cannot fill the days, it fills what it can and leaves the rest as `free` days with a clear note: "Only 3 days of content for Lago del Desierto with your filters; Days 4-5 left free. Thin data: 2 trails, 0 stays." It lists the top backlog items for the area.

| "Research more" | For the owner | For other users (later) |
|---|---|---|
| Action | runs `trip-research --backlog --area <id>` (agents, sidecars, proposals) | adds `user-request` items to the backlog queue the owner's agents work through (Phase 2), or bring-your-own-key agent runs if D22 says yes |
| Result | new catalog rows after review | the same rows, later, for everyone |

#### Where AI adds value on top

Explaining a draft in plain language ("why Ushuaia first"), filling gaps (research lanes), rewriting prose and day narratives, importing old plans, and conversational editing (`trip-edit`: "make Day 3 easier for the kids" becomes slider changes or operations). AI output still lands as proposals and catalog rows; the planner itself stays deterministic.

#### Demo regions and the gate

Revised 4: v1 ships in P7 without a coverage gate; it shows the band and the data-readiness report instead. v2 waits for calibrated coverage (0A.3). From existing research the strongest regions are:

| Region | What exists today | Expected after import |
|---|---|---|
| Canadian Rockies (Banff, Yoho, Kootenay, Jasper, Kananaskis) | structured data: 48 sights, 62 trails, 43 adventures, 33 bookings, 16 bases; no row has coordinates (P4c geocodes them) | good in Banff, Lake Louise, Jasper and Kananaskis areas |
| Patagonia (Ushuaia, El Chalten, El Calafate) | about 22 trails, 15 adventures, 18 bookings, stays snapshots, sun table | good in El Chalten and Ushuaia; usable in El Calafate |

Dolomites, Utah parks and Vermont follow as their plans are imported.

### 0A.6 Prices and live data without paid services

Checked 2026-10-17. Most findings come from search results summarising official pages; where only third-party sources were found, the row says so.

#### Free or free-tier options

| Data | Option | What it allows | Terms and quota | Sign-up or approval | Verdict |
|---|---|---|---|---|---|
| Flights | Amadeus Self-Service APIs | (was) flight offers search with a free monthly test quota | **Self-service portal decommissioned 17 Jul 2026**: registrations paused, keys disabled; Enterprise unaffected (PhocusWire; apis.io) | n/a | gone |
| Flights | Kiwi.com Tequila | (was) search API | public self-service closed in 2024 per third-party sources; partner-only now; no official statement found | partnership | not available |
| Flights | Skyscanner Travel API | live prices | partner approval for established, high-traffic businesses; caching reportedly forbidden; affiliate links via a network (third-party sources) | approval | not available to us |
| Flights | Travelpayouts / Aviasales Data API | **cached** prices from other users' searches, 2-7 days old, each with `expires_at`; meant for content pages, not live search; default currency RUB (set `currency=cad`) | free with a token | Travelpayouts sign-up (affiliate platform) | **optional**, as a "typical price" hint only, if the owner signs up (D20) |
| Lodging | Booking.com Demand API | search, availability, booking | Managed Affiliate Partner contract; credentials via an account manager; booking needs extra approval; one guide reports partner terms barring AI agents from performing the agreement without approval | contract | not available |
| Activities | Viator Partner API, Basic Access | product content and affiliate links; purchase completes on viator.com; no bulk data | free; higher access tiers need approval and certification | self-service sign-up, no prior approval | **optional** affiliate links and product facts (D20) |
| Activities | GetYourGuide Partner API | catalog and booking | registration and a certification process; eligibility not published | approval | not now |
| Car rental | no free API found in this pass | | | | deep links only |
| FX | Frankfurter (ECB reference rates) | daily rates, historical series | no key, no published quota, fair use; updated once per working day around 16:00 CET; host now `frankfurter.dev` (older `api.frankfurter.app`) | none | **use** |
| Weather and climate | Open-Meteo | forecast, historical, climate, elevation | free for non-commercial use: under 10,000 calls a day, 5,000 an hour, 600 a minute, 300,000 a month; CC BY 4.0 attribution; commercial use (ads, subscriptions) needs a paid plan | none | **use**; revisit if D17 makes it a product with ads or subscriptions |

#### Recommended approach (intuitive, free)

| Layer | What the user sees | How |
|---|---|---|
| 1. Deep links, prefilled | "Search flights", "Search stays", "Search cars", "Directions" buttons on the trip, each day and each booking row, carrying the edition dates and the party | Booking.com `searchresults.html` with `checkin`, `checkout`, `group_adults`, `group_children`, `age`, `selected_currency` (parameters verified in our 14 Oct research); Google Flights (a `q=` natural-language query, or a `tfs` built in the browser by a TS encoder in `web/lib/deeplinks/` that is tested against the byte fixtures of `tools/fares/tfs.py`, the owner's research tool; both are unofficial URL formats, P5a verifies them and keeps a test that the link opens a results page); Skyscanner and Kayak path-style search URLs (unofficial patterns, verified in P5); Google Maps URLs for directions and places (documented by Google) |
| 2. Reference price snapshots | "From CAD 3,437 for 3 people, read 14 Oct 2026" with a freshness badge (fresh, aging, stale per 0A.1) | `offer_prices` rows for offers and fare snapshots per route and window (the `fare_quotes` of section 11 move into the catalog as route-window snapshots: `{from, to, depart, return, party, total, currency, read, source}`) |
| 3. User-entered prices | "I found it for ..." on any booking or budget row | a private `price_paid` or a new snapshot with `source: user` (public only if the user shares it) |
| 4. Live lookups (only where free and allowed) | weather and FX now; optional Travelpayouts "typical fare" hint after D20 | cached at the edge for 6 hours (weather), 24 hours (FX), until `expires_at` (Travelpayouts) |

**The Playwright scraping of Google Flights and Booking.com is an owner-only research tool.** It stays in the `trip-fares` skill for the owner's own research and is never offered through the app, the API or MCP to other users, because: both sites' terms do not permit automated access, and offering it would put the site and its users in breach; it depends on undocumented internals (the `tfs` protobuf bytes, DOM text with non-breaking spaces) that break without notice; it uses the owner's machine and IP, so running it for others would also risk blocks on the owner's own browsing; and the result is a point-in-time price that must be shown with its read date anyway, which the snapshot layer already does. The skill checks `actor.id == u_owner` and refuses otherwise.

**Weather and FX in the plan.** When the chosen edition has dates: a forecast strip per base for the days within the forecast horizon (Open-Meteo forecast), climate normals per month otherwise (Open-Meteo historical data, cached at build); every money figure converts to the user's currency with "ECB rate of <date>" (Frankfurter). Both carry their attribution lines.

## 0B. Trip creation experience (UI) (Revised 3)
### 0B.0 What changed in revision 3

Owner direction, 17 Oct 2026: the trip creation flow is the most important screen set; it must be easy enough that a person can add everything a trip needs without help.

| Area | Revision 2 | Revision 3 |
|---|---|---|
| Creating a trip in the UI | a four-step wizard plus a day editor (4.7) | a full screen-by-screen flow with live counts, a catalog picker, a day board beside a map, bookings and costs, and review (0B.2) |
| Adding things | forms per entity | one search box: catalog first, then "add as custom" (0B.3) |
| Notes and own stops | notes on rows only | notes on trip, day, item and place with private or shared visibility; custom stops by pin (0B.4) |
| Routing | manual legs plus Google links; routing API deferred (D13) | **routing with breaks**: break every N hours, daily maximum drive with overnight suggestions, corridor search with detour minutes (0B.5); a Phase 1 and Phase 2 routing plan; D13 replaced by D23 |
| Schema | | `notes`, `custom_items`, `routes` tables in the trip; `items.custom_item_id` (0B.2 schema table) |
| Phases | P5 included a local editor | P5 split: **P5a** plan pages, **P5b** trip creation UI; new **P8** routing with breaks; P7 builder plugs into the flow (6.2) |

### 0B.1 What comparable tools get right and wrong

Checked 2026-10-17 (store listings, help centres and press; marketing copy is labelled as such).

| Tool | What makes it easy | Borrow | Avoid | Source |
|---|---|---|---|---|
| Wanderlog | every added place is pinned on the map at once; lines connect stops in visiting order; drag to reorder; times and distances between places and a daily driving total; a route optimiser; forward confirmation emails or connect Gmail to import bookings (store listing) | pin-on-add, connected day lines, per-leg and per-day totals, "optimise this day's order" | gating basics (Gmail import, Google Maps export) behind Pro; a Google-only basemap | App Store listing |
| Roadtrippers | Explore along the route for food, fuel, overnights and rest areas; a Trip Distance Tool that places stops by a chosen driving distance or time; unrouted waypoints (keep an idea without routing it); drag the route to another road (help centre) | break-by-time placement, "maybe" stops that are not routed yet, category chips along the route | stop caps on the free tier (3 or 7 stops per trip, the pages disagree); Autopilot suggestions behind Premium | help centre; membership pages |
| Furkot | daily Travel Time and Daily Mileage limits for the whole trip or one day; when a day passes a limit or the "end a day" time it finds lodging between stops; overnight stops recalculate as the route changes; no overnight stops when start and end times are equal (help centre) | **automatic overnight stops from daily limits**, recalculated live; per-day overrides of the limits | lodging picked by price and rating only, presented as a suggestion; we pick from the catalog and say why | help.furkot.com |
| TripIt | forward confirmations to one address and a master itinerary appears; optional mailbox import | a single "bookings inbox" that turns confirmations into booking rows (fits the inbox of section 9, Phase 2) | needing mailbox access; we keep it forward-only and private | third-party guides and university job aids |
| Google Maps lists | private or shared lists, collaborators can add places and notes, viewers see who added what (support page) | shared lists with attribution as the model for shared trip notes later | lists with no days, times or legs | support.google.com |
| Google Trips | discontinued 5 Aug 2019; features moved into Search and Maps; Google Travel trip summaries later phased out | lesson: do not build on someone else's travel product for core data | dependency on Google for anything but outbound links and the optional embed | AlternativeTo, TechRadar, Android Police |
| Inspirock | auto-generated itineraries from dates and interests; acquired by Klarna in Oct 2021; current status not confirmed | "answers first, draft second" (as in 0A.5) | opaque auto-planning: every suggestion must show why (score breakdown) | Emerce, craft.co |

Design rules taken from this:
1. Show the map from the first screen where a place is chosen, and pin every item the moment it is added.
2. Every number that matters is visible where the decision is made: matches left after a filter, minutes added by a detour, hours driven today.
3. Drafts are suggestions with reasons, never final; one tap to accept, one to remove.
4. Nothing basic is gated. Everything works without an account and without AI.
5. Unscheduled ideas are allowed: a tray of "maybe" items that are not on a day yet.

### 0B.2 The flow, screen by screen (Revised 4)

**Revised 4 changes.** (1) The board for an existing trip is `/edit/?trip=<slug>`, one static page, not `/<slug>/edit/` (no disabled page per trip; when editing is off the page says where editing works, 4.7). (2) `TripDraft` is a trip.json document plus an operation log, never a separate shape: every screen and board action is an operation (section 5) applied in the browser by the same `core/` functions the CLI uses. (3) A draft that lives only in IndexedDB can be downloaded and imported as `trip.json` from the first screen that creates it (P5b1), not only at S9. (4) Unknown values are counted explicitly in the match counter (rule after the table).

Route: `/new/` (the flow) and `/edit/?trip=<slug>` (the same board for an existing trip). The left side holds the steps; from S1 onward the right side is a live map. Every answer updates a **match counter** at the top: "38 things match in Banff and Lake Louise; 12 suit a 10-year-old; 9 are open in September."

| Screen | Asks | Required for a draft | What narrows live | Component |
|---|---|---|---|---|
| S0 Start | "Start blank", "From a template" (the demo regions' sample trips, day-trip templates from the vault notes), "Copy an existing trip" (any of your trips, a public trip later) | one choice | - | `StartChooser` |
| S1 Where | search box over countries, regions and areas (typeahead, the place hierarchy), or click areas on the map; several allowed, ordered | **at least one area** | map zooms to the selection; counter shows catalog rows in the areas and their coverage band (0A.3) | `AreaPicker` |
| S2 When and how long | a month or season chips, or exact dates (optional); number of days | **month (or season) and days** | season filter; daylight hours for the month shown ("about 13 h of daylight"); closed-in-season items greyed | `WhenPicker` |
| S3 Who | adults; children with ages; optional heights (private); "someone has limited mobility" toggle | **party size** (ages default to adult) | eligibility filter for the youngest and smallest; "12 suit a 10-year-old" | `PartyEditor` |
| S4 Style and pace | style chips (one primary, any extra); pace 1-5; walking km and gain per day; sliders: adventure, luxury, relaxed (0A.5) | none (defaults) | tag weights and filters; the counter and the card grid re-sort at once | `StyleAndPace` |
| S5 Getting around and bases | transport: car, public transport, mixed, camper; base preference: one base, a few, move often; daily maximum drive (default 4 h) | none (defaults) | public transport hides items without a transit or walk access note; drive limit feeds 0B.5 | `TransportAndBases` |
| S6 Choose from what exists | catalog candidates as cards (photo, badges, eligibility, "+40 min from base"), filter bar on top (the shared one from 4.2), checkboxes or drag straight onto a day; "Add everything I ticked" | none | the counter; picks appear as pins and in the "Unscheduled" tray | `CandidatePicker` (an `EntityPage` in picking mode) |
| S7 Day board with map | columns or rows per day (phone: one day at a time), time slots, items as cards, legs between cards ("62 km, 55 min"), base per night at the bottom of each day, an "Unscheduled" tray; the map beside it shows the day in its colour | none | the day checks (2.4) run on every change; warnings appear on the card that causes them | `DayBoard`, `DayColumn`, `ItemCard`, `LegChip`, `BaseSlot`, `UnscheduledTray`, `BoardMap` |
| S8 Bookings and costs | every item linked to an offer is listed with the computed book-by date, status and price snapshot; deep links with dates and party (0A.6); budget table with totals per person and group | none | the Timeline view (4.5) | `BookingsAndCosts` |
| S9 Review | the plan page preview, the open warnings with one-tap fixes (0B.7), visibility (private by default for new users), "Save" | a title (prefilled "Banff, September, 7 days") | - | `ReviewAndSave` |

**Unknowns in the match counter.** A row whose `season_months` is `[]`, whose limits are null or whose `kid_fit` is `unknown` is kept, never dropped, and counted separately: "38 things match in Banff and Lake Louise; 12 suit a 10-year-old and 19 more have no age limit published; 9 are open in September and 22 have no season recorded". The hedge clause appears only when the unknown count is above zero. The copy never says a row "suits" anyone when its limits are unknown.

**Download and import.** "Download trip.json" writes the current document (private fields included, because it goes to the user's own disk; the file name says so: `<slug>.private.trip.json`). "Import trip.json" validates with the `core/` structural validator, shows the errors in the 4.7 message format, and on success creates a new draft with a new id unless the user chooses "Replace the draft with the same id". These are the only backup of a browser-only trip in Phase 1 (4.13).

**Minimum to get a draft:** one area, a month or season, the number of days and the party size (four answers). Everything else has a default and can be changed later on the board.

**First draft.** After S5 (or from any later screen) "Make me a first draft" runs the no-AI builder (0A.5) with the answers and the S6 picks as must-dos, and fills the board. Before P7 exists, the same button runs the simple fallback: picks are grouped by nearest base and spread across that base's days in score order, with no times; the board shows them for the user to arrange. "Nearest" needs coordinates, so P5b depends on the P4c geocode step; a pick without coordinates goes to the Unscheduled tray with the 0B.7 "Item without coordinates" message.

**Draft-and-edit loop.** The board is the trip; there is no separate "generated" state. Regenerating asks first and only re-plans days the user has not touched (an item moved or edited by hand is pinned, shown with a pin icon, and kept).

**Undo and autosave.**

| Behaviour | Rule |
|---|---|
| Undo, redo | every board action is an operation (section 5) appended to a local log (IndexedDB store `ops`, keyed by draft id and sequence); undo applies the inverse operation that each operation returns; Ctrl+Z / Ctrl+Shift+Z and buttons; at least 100 steps; undo works across sessions on the same device |
| Autosave | every operation is saved to IndexedDB at once (Phase 1, no server needed for a new user); with the local API (owner) or Phase 2 it is also sent to the server, queued while offline and replayed with `client_op_id` |
| Versions | "Save a version" names a snapshot; restoring one is a proposal (5.4) against the current state |

**Templates and existing trips.** Copying a trip creates a new trip with new ids, the same items as references, no bookings statuses, no private data, and the edition cleared; templates are ordinary trips with `visibility: public` and the tag `template`.

**Schema additions.** Revised 4: the `notes`, `custom_items` and `routes` tables and `items.custom_item_id`, `items.pinned` are now part of the canonical table list in 2.3; the revision 3 table that stood here was removed so the columns are specified once.

### 0B.3 Search to add anything

One search box on the board and in S6 (`/` focuses it).

| Mode | How | Results |
|---|---|---|
| By name | prefix and fuzzy match over the build-time search index of the catalog (names, local names, aliases, tags) | catalog rows first, grouped by type, each with its area and "in N trips" |
| By category near here | a category chip (food, viewpoint, short walk, playground, fuel, rest area, museum, stay) plus "near": the current map view, the selected day's base, or the selected item | catalog rows sorted by distance; then "Search OpenStreetMap too" (Overpass on demand, cached, 0B.5) |
| Along my route | the same chips over the route corridor of the selected day (0B.5) | sorted by detour minutes |
| Not found | "Add as custom": name (prefilled), location (click on the map, drag the pin, or "no location"), kind, notes, duration | a `custom_items` row, shown with a "custom" badge |

Custom items are trip-local. Each has "Suggest for the shared catalog", which creates a `catalog.propose` change (0A.2) with the item's fields and the user's note as the reason; in Phase 1 only the owner can accept. Once accepted, the item is re-pointed at the new catalog id (`catalog_id`) and the badge disappears. An OSM result added to a trip becomes a custom item carrying its OSM id, so matching later is exact.

### 0B.4 Your own notes and stops

| Need | Design |
|---|---|
| Notes on a trip, a day, an item or a place | a notes panel on each; Markdown with live preview; stored in `notes` with `scope` and `ref` |
| Private or shared | each note is `private` (default; never in the export) or `shared` (printed on the plan page in a "Notes" block, visible to whoever can see the trip) |
| Custom stops | click the map or long-press on a phone to drop a pin; name it; it becomes a custom item placed on the selected day after the nearest item, legs recomputed |
| Custom times | any item's start, window and duration can be typed or dragged on the time axis; a hand-set time pins the item |
| Attachments | links (any URL, with a title); files (PDF tickets, screenshots) stay on the device in IndexedDB in Phase 1, referenced by `local_key`; Phase 2 decision D24 on private storage (R2 behind Access) |
| Notes never overwrite catalog facts | notes live in their own table; a note on a catalog place is shown under the place's facts, labelled "Your note", never merged into them. If a note looks like a correction ("closed on Mondays now"), the panel offers "Suggest this as a correction", which opens a `catalog.edit` proposal with the note as the reason |

### 0B.5 Map-driven routing with breaks (Revised 4)

The user sets a chain of waypoints (A to B, or A-B-C over several days), **break every N hours** (2 h, 3 h, custom) and a **daily maximum drive** (default 4 h). The planner suggests breaks and overnight stops; one tap inserts one.

#### Algorithm (`web/lib/routing/breaks.ts`, pure, tested; the same code runs in the Worker in Phase 2)

| # | Step | Detail |
|---|---|---|
| 1 | Route | get a route geometry and per-segment durations for the waypoint chain from the active provider (table below); store it in the route sidecar (format below: encoded polyline at precision 6 plus per-vertex cumulative `t_s` and `d_m` arrays, because an encoded polyline carries no time); flag segments that are ferries (`ferry` step type or OSM `route=ferry`) and points on OSM `mountain_pass=yes` nodes or catalog legs with seasonal closure notes |
| 2 | Day split | walk `t(s)`: a day ends at the last waypoint before `daily_max_drive_min` is passed; if none, at the point where the limit is reached; the overnight search (step 6) runs around that point. Per-day overrides of the limit are allowed (Furkot's model) |
| 3 | Break points | within each day, the target points are at `k * break_every_min` of driving (k = 1, 2, ...) measured from the day's start, skipping any target within 30 min of a planned item or the day's end |
| 4 | Corridor | for each target, a window of the route from `t - 20 min` to `t + 20 min`; the corridor is that stretch buffered by `corridor_km` (default 5 km, adjustable 1-25 km) |
| 5 | Candidates | catalog rows in the corridor whose kind or tags match the selected break types (table below), from the spatial index; optionally OSM POIs via Overpass for the same corridor (on demand, cached) |
| 6 | Overnight | at each day end, search a wider corridor (`corridor_km * 3`, at most 30 km) for catalog stays first, then towns with stays; when none are in the catalog, show OSM `tourism=hotel|motel|guest_house|camp_site` as unverified suggestions that become custom items if chosen |
| 7 | Detour | estimated detour = 2 x perpendicular distance from the route / 50 km/h x 1.3 (Phase 1); in Phase 2 a routed check for the top 5 candidates (A to candidate to B minus A to B) |
| 8 | Rank | `rank = 3*type_match + 2*interest + 1*open_now - detour_min/10 - penalty` (a 20-minute detour costs as much as a full interest match) where `interest` = tag match with the trip's styles (0A.5), `open_now` = open at the arrival time on that weekday, and `penalty` = 2 if it would arrive after sunset minus 30 min; ties by catalog quality, then id |
| 9 | Present | map: target markers on the route, candidate pins sized by rank; list per target: name, type, "+12 min detour", open or closed at arrival, tags; one tap inserts the stop as an item at the right seq, adds its duration (default by type: viewpoint 15, short walk 45, food 45, fuel 10, rest area 15, town 60) and recomputes every following leg and the day checks |
| 10 | Cautions | ferry segments: "Ferry: check the timetable" chip with the operator link and a warning if the arrival time misses the last sailing (when the timetable is in the catalog); mountain passes: chip with closure months from the catalog leg or "seasonal closures possible"; daylight: any driving after sunset is shown in the day's colour with a dusk pattern and a warning when `early_starts`/profile says no night driving |

Break types and what they match:

| Break type | Catalog kinds or tags | OSM tags (on demand) |
|---|---|---|
| viewpoint | kind `viewpoint` | `tourism=viewpoint` |
| town | kind `town` | `place=town|village` |
| food | eateries; tag `cafe` | `amenity=cafe|restaurant|fast_food` |
| short walk | trails with `km <= 3` and house grade <= 2 | `highway=trailhead` |
| rest area | tag `rest-area` | `highway=rest_area|services` |
| fuel | tag `fuel` | `amenity=fuel` (plus `amenity=charging_station` for EVs) |
| family stop | `kid_fit=yes` places; tag `playground` | `leisure=playground` |

#### Corridor search against the static catalog

| Piece | Design |
|---|---|
| Spatial index | built at publish by the index writer in `web/lib/index/` (`pnpm --dir web data:index`, P5b3; the reader is in the same module, so encoding and decoding have one implementation): every catalog row with coordinates goes into geohash-5 buckets (about 4.9 x 4.9 km); one JSON file per geohash-3 prefix (`/data/index/geo/<gh3>.json`, about 156 x 156 km), each holding its geohash-5 buckets with compact rows `[id, type, lat, lon, tag_bits, kind, open_summary, quality]`; trails are indexed by trailhead |
| Query | sample the corridor stretch every 1 km, take the geohash-5 cells covering `corridor_km` around each sample, load the needed geohash-3 files (cached by the service worker), then filter exactly with point-to-polyline distance |
| Size | under 100 bytes a row; 10,000 rows is about 1 MB across all files, loaded a few files at a time |
| OSM POIs | one Overpass query per corridor window using `around:<radius>` over the window's sampled coordinates, only when the user presses "Search OpenStreetMap too"; results cached in IndexedDB for 30 days by query hash (Phase 2: also in KV, shared); at most one query every 5 seconds; results labelled "From OpenStreetMap, not verified" with ODbL attribution. Revised 4: the 5-second spacing is enforced by a client-side limiter (`web/lib/osm/limiter.ts`) shared by every Overpass call, with a test using fake timers; this is the one place the static site calls a third party on a user's behalf |

#### Routing providers (checked 2026-10-17)

| Option | Terms and limits | Fit |
|---|---|---|
| OSRM public demo (FOSSGIS) | best effort, no guarantees, can be withdrawn; excessive use is blocked; commercial use only if publicly accessible with attribution; a real User-Agent required | research-time use by the owner's tools, sparingly; never from users' browsers at scale |
| Valhalla public server (FOSSGIS) | fair use like the OSRM and Nominatim demo servers, rate limited (reported as about 1 request per second per user; not verified) | same as OSRM |
| OpenRouteService free Standard plan | 2,000 directions a day and 40 a minute; matrix 500 a day; key required | **Phase 2 provider** behind our Worker (key kept server-side), results cached by waypoint chain |
| GraphHopper free package | 500 credits a day, 5 locations per request, non-commercial only, no guarantees | backup provider |
| Self-hosted OSRM or Valhalla on a small VM | no quota; OSRM car-profile memory scales with the extract (planet about 123 GiB; Germany reported under 16 GB); Valhalla tiles are lighter | only if the product grows (D17) |
| Google Directions | outbound links only (Google Maps URLs); no API use | always present as "Open in Google Maps" |

**Revised 4: route storage and the test fixture.**

| Piece | Rule |
|---|---|
| Route sidecar | `data/trips/<slug>/routes/<route-id>.json`: `{"schema": "route-geometry/1", "polyline": "<encoded, precision 6>", "precision": 6, "t_s": [...], "d_m": [...], "flags": [{"from_vertex": i, "to_vertex": j, "kind": "ferry" or "pass", "label": "...", "source": "osm" or "hand"}], "provider": "ors", "profile": "driving-car", "fetched": "<date>", "licence": "ODbL 1.0, route geometry derived from OpenStreetMap data via openrouteservice"}`; `routes.geometry_file` points at it; `t_s` and `d_m` have one entry per decoded vertex (a test asserts the lengths match) |
| Leg geometry in the catalog | the same sidecar shape under `data/catalog/legs/geo/<leg-id>.json` |
| Fixture | `core/test/fixtures/routes/calgary-banff-lake-louise-jasper.json`, fetched once by the owner with `python3 tools/route.py fetch --waypoints ...` (ORS key from the environment, never committed) before P8 starts, committed with its provenance and licence line; ferry and pass flags are added by hand (`source: "hand"`) so tests never need Overpass |
| Who fetches | the owner, at research or edit time; tests, hooks and builds never call a routing provider |

**Recommendation (D23).**
- **Phase 1:** no live routing in users' browsers. The owner's tools compute routes at research or edit time (`tools/route.py` calling ORS with the owner's key from the environment, or the OSRM demo sparingly) and store them as catalog legs with geometry, plus `routes.geometry_file` in the trip. The break finder runs in the browser over stored geometry. For a new A-B with no stored route, it uses a straight-line estimate x 1.3 at 70 km/h, labels every number "estimate", still finds corridor candidates along the straight line, and offers "Open in Google Maps" for real times.
- **Phase 2:** a `/api/v1/route` endpoint in the Worker proxies ORS (free plan), caches by waypoint chain in KV for 30 days and in D1 as catalog legs, and falls back to GraphHopper. Self-hosting is a later decision if usage grows.

### 0B.6 Map interactions, accessibility and phones (Revised 4)

| Interaction | Behaviour |
|---|---|
| Draw or drag the route | drag the day's line to a road: inserts a via point (a `transfer` item with `duration_min: 0`, hidden from the timeline) and re-routes (Phase 2), or re-estimates (Phase 1) |
| Click to add | click (long-press on a phone) on the map: "Add a stop here" with the nearest catalog rows within 500 m offered first, else a custom item |
| Legs and times update | every insert, move or delete recomputes legs, cumulative drive time, arrival times and the day checks; the changed numbers flash briefly |
| Reorder | drag cards on the board or numbered pins on the map; "Optimise this day" reorders the non-pinned items by nearest neighbour from the base and back |
| Day colours | each day has a colour from a fixed, colour-blind-safe palette of 8 hues with distinct dash patterns, so colour is never the only cue |
| Fit to day | selecting a day fits the map to its items and route; "Whole trip" fits everything |
| Offline | stored routes and GeoJSON render without a network (4.9); routing and Overpass buttons are disabled with "needs a connection" |
| Keyboard and screen readers | every board action has a keyboard path (arrow keys move focus, Space picks up, arrows move, Space drops; or a "Move to day" menu); drag-and-drop announcements through an ARIA live region; the map is never the only way: every map action has a list equivalent |
| Phone | the board shows one day at a time with a day switcher; the map is a bottom sheet that expands to full screen; "Move to day" menu instead of cross-day dragging; large touch targets (44 px); the match counter and warnings stay in a sticky header |
| Performance | the board virtualises long days; map updates are batched per animation frame |
| Reduced motion (revised 4) | every animation (the house rule that opens, closes and expands animate) is wrapped in `@media (prefers-reduced-motion: no-preference)`; with `reduce` set, changes are instant and the "changed numbers flash" becomes a static highlight for 2 s. A Playwright test with `reducedMotion: 'reduce'` asserts no CSS transition longer than 0 ms on the board |
| Text equivalents for maps and profiles (revised 4) | every `DayMap`, `BoardMap` and `TrailMap` is followed by a visually hidden table (`sr-only`) of the day's items in order with their legs ("2. Lake Agnes Tea House, 3.6 km walk, 1 h 10"); every `ElevationProfile` has a text line with min, max, gain and loss; the map canvas carries `aria-hidden="true"` and a label pointing to the table |
| Focus management (revised 4) | when URL state changes the view (view switcher, `?focus=`, day switcher, step change in `/new/`), focus moves to the new region's heading (`tabIndex=-1`) and a polite live region announces it ("Table view, 64 places"); closing a sheet returns focus to its trigger |
| Language of names (revised 4) | local place names carry `lang` (`<span lang="es">Laguna de los Tres</span>`), from `places.name_lang` or the country's main language when unset; screen readers then pronounce them correctly |

### 0B.7 Guardrails

Each guardrail is a day check (2.4) or a picker check with a one-tap fix; nothing is silently changed.

| Situation | Message | Offered fixes |
|---|---|---|
| Day too long for the pace | "Day 3 runs 11 h; pace 3 allows 9 h" | "Move Lake Agnes to Day 4 (2 h free)", "Make it optional", "Accept for this day" |
| Legs do not fit | "You arrive at Moraine Lake at 10:40; the shuttle slot is 10:00" | "Start 45 min earlier", "Swap the order of the first two stops" |
| After dark | "The drive to Jasper ends 40 min after sunset" | "Leave 1 h earlier", "Drop the Peyto stop", "Accept" |
| Closed on that weekday | "Harberton is closed on Tuesdays (Day 4 is a Tuesday)" | "Move to Day 3", "Swap Days 3 and 4" |
| Outside its season or opening hours | "The gondola's last ride up is 19:30" | "Move it before 18:30" |
| Item without coordinates | "Piratour pickup has no location" (a grey pin in the tray, not on the map) | "Pick it on the map", "Use the operator's address", "Keep without a location" (no legs computed; day checks skip it with a note) |
| Someone in the party cannot do it | "Big Ice is 18+; Child (11) cannot go" | "Make it a Track A item and add the family alternative (minitrekking, 8-65)" using `day_tracks`, or "Remove" |
| Limits unknown | "Minimum age not published" | "Ask the operator" (adds an open question), "Keep" |
| Over the walking ceiling | "Day 8 walks 21 km; your limit is 10 km" | "Use the shorter alternative (Laguna Capri loop, 11.7 km)", "Track A only", "Raise the limit for this day" |
| Booking deadline passed or opening soon | "Book-by date was 31 Oct" | "Mark booked", "Find an alternative" (search filtered to the same type and day) |
| Overnight not found within the daily limit | "No stay found within 4 h; the next catalog stay is at 5 h 10" | "Raise today's limit to 5 h 15", "Add a custom stay", "Search OpenStreetMap" |

## 1. Target repo layout and migration table (Revised: 1.1, 1.4; Revised 4: 1.1-1.3, 1.5)

### 1.1 Target tree (Revised 4)

```
travel/
  CLAUDE.md                      short repo rules; points at skills and docs/
  README.md                      stub in P1b (what lives where, three commands); full text in P3a
  publish.sh                     thin wrapper: exec python3 tools/publish.py "$@"
  package.json, pnpm-workspace.yaml   pnpm workspace with two packages: core, web (skeleton created in P1b so P2a and P3a never both create it)
  docs/                          plans, audits, reviews, briefs/ (phase briefs), reports/ (data-readiness and other generated reports)
  research/                      RAW, never published, kept forever; may hold HTML, scripts and images as evidence
    trips/<slug>/                <lane>.md files, sun.md, fares-*.md, gpx/, screenshots/
      archive/                   superseded plans, pages and builders (was <slug>/archive/)
      notes/                     loose working notes (BRAINSTORM, CALL-LIST, MASTER-*, OPTIONS-*, PARKING, DAYS)
    places/                      PRIORITIES.md; <CC>/<region>/<area>/<place>/ research not tied to a trip (path = place id)
    inbox/                       social captures and screenshots before resolution (moves from locations/inbox/ in P2b)
    vault-notes/                 unchanged (already here)
  data/                          SYSTEM OF RECORD, schema-versioned JSON, in git
    schema/
      generated/                 schema.json (JSON Schema 2020-12 exported from core/), schema.sql (D1/SQLite DDL), ops.json (operation catalogue); never hand-edited
      legacy/                    locations_schema.sql until P2a generates it
      difficulty-map.json        local grade -> house grade (3A)
      freshness.json             freshness policy (0A.1)
    reference/                   countries.json (moved from _system/site/), currencies.json, licences.json (feeds /about/data/)
    vocab/tags.json              shared tag vocabulary with aliases and kinds (P2b moves it out of locations.json)
    locations/                   locations.json (schema v2 -> v3 in P2b), parts when split, WISHLIST.md (generated, private), README.md
    catalog/                     the shared catalog beyond places (2.3A); one file per country per entity
      trails/                    <CC>.json rows; geo/<trail-id with / as __>.geojson geometry + profile; NOTICE-ODbL.md
      activities/  stays/  eateries/  offers/ (offers + offer_prices)  legs/ (+ geo/)  areas/ (area guides)
      policy.json                auto-accept rules (0A.2)
      coverage.json              generated (0A.3)
      backlog.json               generated plus owner-added rows (0A.3)
      changes/                   catalog_changes, one JSONL file per month
      proposals/                 catalog proposals awaiting review (0A.2)
    trips/<slug>/
      trip.json                  one file per trip (2.3)
      prose/                     day-NN.md, orientation.md, answer.md ... long prose as Markdown, referenced by path
      routes/                    route sidecars (0B.5)
      proposals/                 proposals awaiting review (5.4)
      gallery.json               moved from legacy/<slug>/gallery/gallery.json when the trip migrates
  core/                          TypeScript package @travel/core (Node 22, no framework): the ONE implementation of schemas, validation, day checks, book-by, sun, operations, catalog pipeline, lanes, research index, exports; bin/ CLIs run directly by node (type stripping); used by web/, hooks, MCP and the Phase 2 Worker
    src/  bin/  test/  package.json  tsconfig.json
  web/                           Next.js app (App Router, TS strict, Tailwind, shadcn/ui); out/ is the static export
    app/  components/  lib/ (entities, views, index, search, draft, osm)  tests/  public/ (geo/, fonts/, icons/, manifest.json, sw.js)
  api/                           Phase 2 only: Cloudflare Worker (Hono) for /api/v1 and /mcp, wrangler.jsonc, migrations/
  tools/                         Python tooling that exists today or calls the network from the owner's machine; stdlib only at run time (1.5)
    pyproject.toml               requires-python and a pytest dev group; no runtime dependencies
    locations.py  location_views.py  migrate_locations_v2.py  globe_data.py  publish.py  hub.py  theme_tokens.py
    trails.py (owner-run fetch)  route.py (owner-run ORS)  geocode.py (owner-run, P4c)  links.py  anchors.py  shots.py
    gallery/ (gallery.py, gallery_find.py, gallery_pick.py)  fares/ (tfs.py)
    hooks/ (locations_changed.sh, data_changed.sh, schema_changed.sh, prepublish.sh)
    tests/ (fixtures/)   check-all.sh (the local gate: every test suite and check in one command)
    .cache/                      gitignored (was _system/site/cache/)
  legacy/                        hand-built pages, live at their current URLs until each trip migrates
    _system/                     the legacy page builder: build.py, base.css, base.js, layout.html, themes/, components/, migrate.py, migrate_legacy.py, README.md, site/ (locations.html, site.css)
    <slug>/                      every trip folder as it is today minus research/, archive/ and loose notes (index.html, PLAN.md, build_page.py and per-trip scripts, gallery/, assets/, data/)
    globe/                       the current globe page and assets (until P6)
    locations/index.html         the generated list page (until /places/ replaces it)
    MANIFEST.json                frozen list of legacy folders with served: true or false
  .claude/
    skills/  agents/  settings.json
```

Rules that keep the layers honest (Revised 4):

| Rule | Enforced by |
|---|---|
| Nothing under `research/` is ever copied to `.site/` | `tools/publish.py` allow-list plus a test that greps the staged tree for `research/` |
| `data/` is only written through operations (section 5): CLI, skill, UI export, API | PostToolUse hook validates any Claude write to `data/**` through `node core/bin/validate.ts`; `tools/check-all.sh` validates everything; the pre-publish hook runs it and blocks a publish that fails. **No CI in Phase 1** (D27): the owner verifies locally and the publish gate is the guard; CI arrives with Phase 2's export Action |
| `data/schema/generated/` is never hand-edited | `node core/bin/schema.ts generate --check` (byte-equal) in `core` tests and in `check-all.sh` |
| `legacy/` only shrinks | a test asserts no folder appears in `legacy/` that is not in `legacy/MANIFEST.json` |
| Trip slugs never collide with app routes | the validator rejects a slug in the reserved list: `places trips trails activities stays eateries offers areas adventures bookings globe locations inbox api mcp data assets geo _next legacy new edit review backlog plan schema about fonts icons` |
| Each concern has one runtime | 1.5 |

### 1.2 Migration table (Revised 4)

Every move uses `git mv` (history kept). "P1a" rows are done (commits `f4d4ec9`, `babcaca`); P1b verifies them and does the rest. The order inside P1 is the green-after-each-step order of 6.3.

**Folders and files**

| Today (before P1) | New | Phase | Note |
|---|---|---|---|
| `_system/tools/*.py` | `tools/` | P1a (done) | `ROOT = Path(__file__).resolve().parents[1]` in `locations.py`, `location_views.py`, `globe_data.py` |
| `_system/tools/hooks/` | `tools/hooks/` | P1a (done) | inside both scripts `ROOT` changed from `/../../..` to `/../..`; `$ROOT/_system/tools/locations.py` became `$ROOT/tools/locations.py`; `_system/tests` became `tools/tests`; `.claude/settings.json` points at `tools/hooks/`. The path globs in `locations_changed.sh` (`*/locations/locations.json`, `*/locations/[A-Z][A-Z].json`, `*/_system/site/locations.html`, `*/_system/site/site.css`) still match the new paths and are not changed |
| `_system/tests/` (9 test files, 109 tests) and `fixtures/` | `tools/tests/` | P1a (done) | edits in the table "Test constants" below; the count stays 109 |
| `_system/tools/locations_schema.sql` | `data/schema/legacy/locations_schema.sql` | P1a (done) | P2a generates its successor |
| `locations/locations.json`, `WISHLIST.md`, `README.md` | `data/locations/` | P1a (done) | path change only; schema stays v2 until P2b |
| `locations/PRIORITIES.md` | `research/places/PRIORITIES.md` | P1a (done) | hand-written ranking prose |
| `_system/site/countries.json` | `data/reference/countries.json` | P1a (done) | `globe_data.py:89` writes there |
| `locations/inbox/` | `research/inbox/` | **P2b** (deferred from P1) | a behaviour change, not a path change: `locations.py:1267-1268` rejects a `sources.screenshot` outside `locations/inbox/`; `:1386,:1412` help text; five assertions (`test_locations.py:157,160,165,404`, `test_location_views.py:143`), `test_site_outputs.py:31`, `.claude/skills/location/SKILL.md:35,52-53`. P2b changes the rule, the assertions, the skill and rewrites the stored values in one tested step |
| `locations/index.html` | `legacy/locations/index.html` | P1b | still generated by `location_views.py`; still served at `/locations/` |
| the 15 trip folders: `algonquin-muskoka-oct-2026`, `canadian-rockies-sept-2029`, `chamonix-mont-blanc-sept-2028`, `costa-rica-feb-2027`, `dolomites-july-2027`, `iceland-ring-road`, `new-hampshire-stopover-2026`, `niagara-day-aug-2026`, `norway-summer`, `patagonia-feb-mar-2027`, `peru`, `quebec-sept-2026`, `switzerland-2027`, `usa-southwest-rockies`, `vermont-fall-2026` | `legacy/<slug>/` | P1b | URL stays `/<slug>/`. `peru/` has no `index.html`, is not served, and is recorded in `legacy/MANIFEST.json` with `served: false` |
| `<slug>/research/` (13 trips have one) | `research/trips/<slug>/` | P1b | only `patagonia-feb-mar-2027/build_page.py` names a research path, in display text (`research/sun.md`), so builds and bytes are unaffected |
| `<slug>/archive/` (dolomites, usa-southwest-rockies, vermont) | `research/trips/<slug>/archive/` | P1b | `usa-southwest-rockies/archive/` holds a superseded page and builder; `research/` may hold HTML and scripts as evidence and is never served |
| loose notes: `peru/DAYS.md`, `usa-southwest-rockies/BRAINSTORM.md`, `CALL-LIST.md`, `vermont-fall-2026/MASTER-MAP-AND-SCORES.md`, `MASTER-TABLE.md`, `PARKING.md`, `OPTIONS-viewpoints.md` | `research/trips/<slug>/notes/` | P1b | no builder reads them (checked) |
| `<slug>/PLAN.md` | stays in `legacy/<slug>/` | P1b | three builders parse it (Rockies, Chamonix, Patagonia). When a trip migrates (P4c) it is copied to `research/trips/<slug>/PLAN.md` and its content lives in `trip.json` + `prose/` |
| `<slug>/data/*.json` (Rockies only) | stays in `legacy/canadian-rockies-sept-2029/data/` | P1b | input to the P4c import |
| `<slug>/*.py` per-trip scripts | stay in `legacy/<slug>/` | P1b | the 8 builders are `algonquin-muskoka-oct-2026`, `canadian-rockies-sept-2029`, `chamonix-mont-blanc-sept-2028`, `costa-rica-feb-2027`, `iceland-ring-road`, `norway-summer`, `patagonia-feb-mar-2027`, `usa-southwest-rockies`. Each keeps `sys.path.insert(0, str(HERE.parent / "_system"))` (resolves to `legacy/_system` after the move) and gains `sys.path.insert(0, str(HERE.parents[1] / "tools" / "gallery"))` for `import gallery as G`; in the Rockies builder that import is module-level at line 800, so the new line goes next to the existing one at line 15 |
| `<slug>/gallery/` | `legacy/<slug>/gallery/`, then `data/trips/<slug>/gallery.json` on migration | P1b / P4c+ | `*-candidates.json` stays gitignored |
| `globe/` (441 files under `assets/`) | `legacy/globe/` | P1b | still served at `/globe/`; P6 moves the committed outputs to `web/public/geo/` without re-running the downloads |
| `_system/build.py`, `base.css`, `base.js`, `layout.html`, `themes/`, `components/`, `migrate.py`, `migrate_legacy.py`, `README.md` | `legacy/_system/` | P1b | `build.py` resolves `SYSTEM` from its own folder, so it works unchanged; `migrate.py` and `migrate_legacy.py` resolve `<slug>` relative to their parent, which becomes `legacy/`, where the trips are |
| `_system/site/locations.html`, `site.css` | `legacy/_system/site/` | P1b | templates for the legacy list page |
| `_system/gallery.py`, `gallery_find.py`, `gallery_pick.py` | `tools/gallery/` | P1b | `gallery_find.py` imports `gallery` from its own folder and caches under `/tmp/gal`; both still work |
| `_system/gallery.html` | not moved (untracked, regenerable; `.gitignore` entry becomes `legacy/_system/gallery.html`) | P1b | |
| `_system/site/cache/` | `tools/.cache/` (untracked; move locally or delete) | P1b | `globe_data.py:27` `CACHE = ROOT / "tools" / ".cache"`; `.gitignore` entry follows |
| `_system/site/GLOBE-RESEARCH.md`, `PLAN-locations-g5.md`, `AUDIT-2026-10-16.md` | `docs/` | P1b | |
| `publish.sh` | stays at the root as a three-line wrapper; logic moves to `tools/publish.py`, the hub heredoc to `tools/hub.py` (verbatim: text, CSS, 404 page, footer) | P1b | `.site/` must be byte-identical (1.3) |
| (new) `legacy/MANIFEST.json`, `tools/tests/fixtures/served-urls.txt` | | P1b (the fixture was written in P1a step 1) | |
| (new) `README.md` | root | P1b (stub only) | a pure restructure does not write documentation; the full README is P3a |
| `research/vault-notes/` | unchanged | | |
| `.site/`, `.wrangler/`, `.pytest_cache/`, `__pycache__/` | unchanged, gitignored | | |

**`Paths` in `tools/location_views.py`** (one value per phase; P4c adds the second trip root)

| Attribute | Before P1 | After P1a (now) | After P1b | From P4c |
|---|---|---|---|---|
| `store` | `locations/locations.json` | `data/locations/locations.json` | same | same |
| `wishlist` | `locations/WISHLIST.md` | `data/locations/WISHLIST.md` | same | same |
| `list_page` | `locations/index.html` | `locations/index.html` | `legacy/locations/index.html` | same until `/places/` replaces it |
| `globe_places` | `globe/assets/data/places.json` | unchanged | `legacy/globe/assets/data/places.json` | P6: `web/public/geo/data/places.json` |
| `template`, `css` | `_system/site/locations.html`, `site.css` | unchanged | `legacy/_system/site/...` | same |
| `countries_json` | `_system/site/countries.json` | `data/reference/countries.json` (the old `ROOT` fallback in `locations.py` was removed) | same | same |
| `trips_root` | repo root | repo root (trips have not moved) | `legacy/` (otherwise `validate` fails on the 8 places with a `trip` and `/locations/` loses its trip links) | becomes `trip_roots = [legacy/, data/trips/]`: a trip exists if either holds `<slug>/`; `trip_url` is set when `legacy/<slug>/index.html` exists or `data/trips/<slug>/trip.json` has `web_published: true` |

**Test constants** (all under `tools/tests/`)

| File | Edit | Phase |
|---|---|---|
| `test_location_views.py`, `test_locations.py`, `test_locations_split.py`, `test_migrate_v2.py`, `test_schema_sqlite.py` | `sys.path.insert(0, str(HERE.parent))` (was `HERE.parent / "tools"`) | P1a (done) |
| `test_list_page.py:12`, `test_site_outputs.py:7` | `ROOT / "tools"` (was `ROOT / "_system" / "tools"`) | P1a (done) |
| `test_migrate_v2.py:52`, `test_locations_split.py:16` | **no change**: `HERE.parents[1]` is the repo root from both `_system/tests` and `tools/tests` (the review said `parents[2]`; that is wrong) | n/a |
| `test_globe_data.py`, `test_globe_page.py`, `test_site_outputs.py`, `test_list_page.py` (`ROOT = parents[2]`) | no change to `ROOT`; data paths `globe/...` to `legacy/globe/...`, `locations/index.html` to `legacy/locations/index.html`, `_system/site/...` to `legacy/_system/site/...`; `test_site_outputs.py:38` asserts no `legacy/locations/assets` | P1b (the `data/` paths were done in P1a) |
| `test_schema_sqlite.py` | `DDL = ROOT / "data" / "schema" / "legacy" / "locations_schema.sql"` | P1a (done) |
| `test_locations_split.py` real-store test, `test_location_views.py`, `test_migrate_v2.py` tmp roots | every tmp root has the repo shape: `data/locations/`, `data/reference/`, `legacy/_system/site/`, `legacy/<slug>/index.html` for each trip with a page; `test_migrate_v2.py`'s `--check` test creates `legacy/<slug>/` for the fixture's trips | P1b (the `data/` half was done in P1a) |
| five `locations/inbox/` assertions and `test_site_outputs.py:31` | unchanged in P1 | P2b |

**Strings left verbatim on purpose.** `location_views.py:199-200` writes "Generated from `locations/locations.json` ... `python3 _system/tools/locations.py add`" into `data/locations/WISHLIST.md` and `/locations/index.html`. Changing it would change published bytes, so P1 leaves it; P2b updates it together with the inbox move and rebuilds both files in the same commit.

### 1.3 How publish keeps every URL working (Revised 4)

`tools/publish.py` builds `.site/` from a route table, so where a file lives and where it is served are decoupled:

| Served at | Source, Phase 1 before migration | Source after a trip migrates |
|---|---|---|
| `/<slug>/` and `/<slug>/assets/` | `legacy/<slug>/index.html`, `legacy/<slug>/assets/` | `web/out/<slug>/` (the app's plan page at the same URL) |
| `/globe/` | `legacy/globe/` | `web/out/globe/` (P6) |
| `/locations/` | `legacy/locations/index.html` | `/places/` in the app; `/locations/` becomes a static redirect page plus a `_redirects` rule `/locations/* /places/:splat 301` |
| `/` hub | `tools/hub.py` (same output as today's heredoc) | the app's home page (P3a), which lists migrated and legacy trips from `data/trips/*` plus `legacy/MANIFEST.json` |
| everything else in `web/out/` | not deployed in P1 | `/places/`, `/trips/`, `/trails/`, `/data/*.json`, `/about/data/` ... |

**Merge order (from P3a).** 1) `tools/publish.py` runs `python3 tools/locations.py build` (failure fails the publish); 2) `pnpm --dir web build` produces `web/out/`; 3) `web/out/*` is copied into the empty `.site/`; 4) each legacy route is copied unless the app already wrote that path, and a legacy route that would overwrite an app file is an error unless the collision rule below picks the app; 5) the hub is written only while the app has no home page (before P3a); 6) `_redirects` is written last from `web/redirects.json` plus legacy renames; 7) the served-URL superset test, the privacy test and the file-count test run against `.site/`. `publish.py --check` fails if both or neither source exists for a published slug.

**Collision rule.** A slug is served from `web/out/` only when `data/trips/<slug>/trip.json` has `trip.web_published = true` (one boolean column; revised 4, the old `"web": {"published": true}` object is gone); otherwise the legacy page wins.

**Visibility (revised 4, from P3a).** The export is filtered before anything is written:

| `trip.visibility` | Built at `/<slug>/` | In `/trips/`, the home page, `/data/*.json`, the search and spatial indexes, the sitemap | Robots |
|---|---|---|---|
| `public` | yes | yes | `noindex` on plan pages (D16), lists indexed |
| `unlisted` | yes | no | `noindex` |
| `private` | no | no | n/a |

Fields marked `x-private` (2.1) are removed by an allow-list generated from the schema, never by a deny-list. A privacy test builds the export with two fixture trips (one `private`, one `unlisted`, each carrying sentinel values such as a traveller height of 137 cm, a confirmation `CONF-SENTINEL-7Q`, a note marked `private`) and fails if `web/out/` contains a sentinel, the private slug anywhere, the unlisted slug outside its own folder, any `x-private` field name in a `/data/*.json` file, or the strings `research/`, `inbox/`, `screenshot`.

A test asserts that the set of served URLs after a change is a superset of the set before (`tools/tests/fixtures/served-urls.txt`, written in P1a). Cloudflare Pages honours a static `_redirects` file, so no server is needed for moved routes.

**Acceptance for P1 in one line:** with `HUB_TODAY` pinned to the baseline date, `python3 tools/publish.py --dry-run` produces a `.site/` tree whose file list and bytes equal the pre-move tree (`diff -r` empty, no exceptions), and `python3 -m pytest tools/tests -q` reports 109 passed plus the new P1b tests.

### 1.4 Revised: catalog layout and migration additions (Revised 4: phases renamed)

| Today | New | When | Note |
|---|---|---|---|
| `locations/` (places and geography) | `data/locations/` (unchanged from 1.2) | P1 | the places and geography partition of the catalog; name kept because the brief and the 109 tests use it |
| (none) | `data/catalog/{trails,activities,stays,eateries,offers,legs,areas}/` | P2a creates the schemas and empty folders; P4c fills them by importing the Rockies and Patagonia | trails moved from the earlier `data/trails/` path |
| Rockies `data/{sights,trails,adventures,bases,bookings}.json` | sights to `data/locations/` places, trails to `data/catalog/trails/`, adventures to `data/catalog/activities/` + `offers/`, bases to `data/catalog/stays/` (where a property is named), bookings to `offers/` + the trip's `trip_bookings` | P4c | through the ingestion path (0A.2), not by hand; every row is geocoded first (P4c step 1) |
| Patagonia PLAN.md tables | the same split | P4c | through a reviewed mapping fixture (6.3 P4c) |

### 1.5 Runtimes: one per concern (new in revision 4)

The plan had six Python/TypeScript parity pairs (structural validator, day checks, book-by, the catalog pipeline's "TS twin", `place.*`, sun times). Each pair is written twice and tested for agreement forever. Revision 4 gives every concern exactly one implementation.

| Concern | Runtime and home | Called by |
|---|---|---|
| Schemas (source), JSON Schema export, DDL, operation catalogue | TypeScript, `core/src/schema/`, `core/bin/schema.ts` | `check-all.sh`, the `schema_changed.sh` hook |
| Structural validation (per-column and the declarative `rules` metadata) | TypeScript, `core/src/validate/`, `core/bin/validate.ts` | hooks (`node core/bin/validate.ts <file>`), ops, the editor, MCP `validate_trip`, `check-all.sh` |
| Day checks, book-by, sun times, fit per traveller | TypeScript, `core/src/checks/`, `core/src/bookings/`, `core/src/sun/` | ops, the editor, the plan pages, the planner, `validate` |
| Operations, `FileStore`, ops CLI, local API, read-only MCP | TypeScript, `core/src/ops/`, `core/bin/{ops,serve,mcp}.ts` | skills, the UI, Claude Code |
| Catalog normalise, match, merge, propose, apply, freshness, coverage | TypeScript, `core/src/catalog/`, `core/bin/catalog.ts` | P4b onwards; Phase 2 Worker imports the same module |
| Lane selection, research index and dedupe | TypeScript, `core/src/lanes/`, `core/src/research/` | skills (through the CLI), the UI's "Suggested research" |
| Entity views, search index, spatial index, exports (GPX, KML, CSV, ICS) | TypeScript, `web/lib/views/`, `web/lib/index/`, `web/lib/exports/` (writer and reader in one module) | `pnpm --dir web build` |
| `place.*` (capture, resolve, edit, visit), list page, WISHLIST, globe pins | Python, `tools/locations.py`, `location_views.py` (109 tests) | the `location` skill, hooks; the ops CLI delegates `place.*` to it. The one remaining parity pair: a test runs `core`'s validator and `locations.py validate` over the store and fixtures and asserts the same verdict, until Phase 2 ports `place.*` to TS |
| Globe data, Commons gallery, trail geometry fetch, routing fetch, geocoding, link and anchor checks, screenshots, fares `tfs`, theme tokens, publish and hub | Python, `tools/` | the owner and skills, never hooks except `locations.py build` and the test suite |

**Node in hooks.** Node 22.23 runs TypeScript directly (type stripping; checked on this machine: `node a.ts` with a typed import runs in about 60 ms). `core/` therefore has no build step: `tsconfig.json` sets `"erasableSyntaxOnly": true`, `"allowImportingTsExtensions": true`, `"noEmit": true`, `"module": "nodenext"`, and imports carry `.ts` extensions. Hooks call `node "$ROOT/core/bin/validate.ts" <file>`; if `core/node_modules` is missing the hook prints "run: pnpm --dir <repo> install" and exits 2.

**Python runtime spec.** `tools/` stays stdlib-only at run time, as `locations.py`'s docstring promises. `tools/pyproject.toml` (P2a) contains `requires-python = ">=3.12"`, no `dependencies`, and `[dependency-groups] dev = ["pytest>=8"]`, so `uv run --project tools pytest` gives a reproducible run on another machine. Hooks, `publish.sh` and the briefs use the system `python3` (3.14.4 here, with pytest 9.0.2), never `uv run`, so a missing virtual environment can never block a hook. A third-party Python package may be added only to an owner-run tool, behind an import guard that prints how to install it.

**The local gate.** `tools/check-all.sh` runs, in order: `python3 -m pytest tools/tests -q`, `python3 tools/locations.py validate`, `python3 tools/locations.py build --check`, `pnpm --dir core test`, `node core/bin/schema.ts generate --check`, `node core/bin/validate.ts --all`, and once `web/` exists `pnpm --dir web typecheck`, `lint`, `test`, `build`. `prepublish.sh` runs it. CI is deferred (D27).

## 2. Data schema v1: trip.json and the catalog (Revised 4: canonical)

**Revised 4.** This section is the single canonical list of tables and columns for `trip.json` (2.2, 2.3) and for the catalog (2.3A). Revision 2's 2.8 and revision 3's schema table in 0B.2 were folded in and removed; the tables `adventures` and `bookings` no longer exist; 0A.1 is a summary that points here. The schema source is Zod in `core/src/schema/` (2.5); this section is what that source must say.

### 2.1 Decisions (Revised 4)

| Decision | Choice | Why |
|---|---|---|
| Folder or single file | **Folder per trip:** `data/trips/<slug>/trip.json` plus `prose/*.md`, `routes/*.json`, `proposals/*.json` and `gallery.json` | Structured facts in one JSON file make every operation atomic (one file read, one write, one validation). Long narrative stays Markdown so diffs are readable; JSON points at it by path |
| Row shape | Relational, the locations v2 pattern: the root holds named tables (arrays of flat rows with ids); nested objects only where the value is never filtered or joined | Maps one-to-one to D1 tables; the same validator rules (FK, unique, enums, contiguous positions) as locations |
| Dates | **Season-based.** Days are `n` (0..N, 0 = travel day before Day 1); every date-like field is relative (`offset_days` from Day 1 of an edition) or a month list. Absolute dates exist only on `editions` and `trip_bookings.deadline_date` | A plan survives a change of year; an edition resolves real dates, the countdown, the booking calendar and the conditions routine |
| World facts versus trip choices | Places, trails, activities, stays, eateries, offers, legs and area guides are catalog rows (2.3A); the trip references them and keeps only its own choices (`trip_trails`, `trip_activities`, `trip_bookings`, `items`, `bases`) | A fact lives once (0A.1) |
| Ids | Trip id = slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, not in the reserved list of 1.1). Trip row ids are slugs unique within their table (`laguna-esmeralda`, `bk-piratour`), except days (`n`) and items (`d03-i02`, generated). Catalog ids follow 2.3A | Human-readable, stable, matches the Rockies data today |
| File names from ids | an id becomes a file name by replacing `/` with `__` (`AR/santa-cruz/el-chalten/laguna-de-los-tres` becomes `AR__santa-cruz__el-chalten__laguna-de-los-tres.geojson`); ids never contain `__` (validated) | `-` already appears inside slugs, so the old "slashes as dashes" encoding collided |
| Provenance | Every trip row may carry `src` (array of `sources.id`) and `confidence` (`verified`, `stated`, `inference`, `gap`, `conflict`) | The plans already use VERIFIED / INFERENCE / GAP / CONFLICT in prose; this makes it filterable |
| Privacy | Columns tagged `x-private` (traveller ages, heights, weights, citizenship, booking confirmations and contacts, prices paid, private notes) are never written to the static export; the export allow-list is generated from the schema | One rule, enforced at the schema, tested with sentinels (1.3) |
| Money | **Two scalar columns per amount**: `<name>_amount` (real) and `<name>_currency` (ISO 4217 text); a row with several amounts in one currency has one `currency` column. No money objects anywhere | The JSON row and the D1 row then have the same shape, so `D1Store` needs no mapping layer |
| Time zones | `bases.tz` (IANA, required), `items.tz` (IANA, nullable override), `trip.origin_tz` (required) | Multi-zone trips (Patagonia UTC-3 with a Toronto departure and an overnight flight) |
| Units | stored metric only (km, m, kg, cm, Celsius); display units are a preference (4.13) | Rockies `mi` values are converted on import |

**The zone of an `hhmm` value.** For an item: `items.tz`, else the `tz` of the base where the group sleeps the night of `items.day` (`days.base_id`), else for the last day of the trip or a day trip `trip.origin_tz`. A checkout or a departure that happens before the move is in the previous base's zone and must set `items.tz` when it differs (the validator warns `W_TZ_MISSING` when consecutive items on one day resolve to bases in different zones and neither sets `tz`). Sun times for a day use the zone and coordinates of that night's base.

Types, as in locations v2: `text`, `int`, `real`, `bool`, `json`, `date` (ISO), `datetime` (ISO with offset), `month` (1-12), `hhmm` (`^([01]\d|2[0-3]):[0-5]\d$`), `offset` (int days relative to Day 1 of the chosen edition; negative = before), `tz` (an IANA zone name present in `Intl.supportedValuesOf('timeZone')`). "Null?" = may be null.

### 2.2 Root object (Revised 4: canonical)

Key order: `schema_version` (1), `id`, `updated`, then the tables in this order: `trip`, `profile`, `travellers`, `trip_tags`, `editions`, `bases`, `days`, `day_tracks`, `items`, `trip_trails`, `trip_activities`, `trip_bookings`, `custom_items`, `notes`, `routes`, `hazards`, `weather_rules`, `budget`, `fx`, `fare_windows`, `fare_quotes`, `documents`, `emergency`, `packing`, `knowledge`, `questions`, `gotchas`, `research_refs`, `sources`, `changelog`. `trip` and `profile` are single objects; every other table is an array. Unknown keys and unknown columns are rejected. Empty tables are `[]`. Writers emit keys in this order and rows sorted by primary key (days by `n`, items by `day`, `track`, `seq`), one row per line, so diffs stay small (the locations v2 writer rule).

### 2.3 Trip tables (Revised 4: canonical)

**trip** (exactly one object)

| Column | Type | Null? | Rule |
|---|---|---|---|
| slug | text | no | equals root `id` and the folder name |
| title | text | no | "Argentine Patagonia" |
| subtitle | text | no | one line, shown on cards |
| status | text | no | `idea`, `researching`, `planned`, `booked`, `travelled`, `dropped` |
| primary_style | text | no | one of `adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `mixed` |
| duration_shape | text | no | `day-trip` (0 nights), `weekend` (1-2), `short-break` (3-5), `week` (6-9), `multi-week` (10+); validated against `nights` |
| movement_shape | text | no | `single-base`, `two-bases`, `multi-base`, `road-trip`, `hut-to-hut`, `camper`, `cruise` |
| party_shape | text | no | `solo`, `couple`, `family-young`, `family-teen`, `family-mixed`, `friends`, `multi-gen`; default derived from travellers |
| countries | json | no | sorted ISO2 list, FK `countries.code` in locations |
| region_label | text | no | "Patagonia, Argentina" |
| season_months | json | no | sorted distinct months 1-12 |
| season_note | text | no | |
| nights | int | no | sum of `bases.nights` (validated) |
| origin | text | no | "Toronto (YYZ)" |
| origin_tz | tz | no | `America/Toronto` |
| base_currency | text | no | ISO 4217; `CAD` today (G9); `fx` rates are relative to it |
| theme | text | yes | legacy theme name (`alpine-snow`) or app theme token set |
| hero_image | text | yes | Commons `Special:FilePath` URL |
| answer_prose, orientation_prose | text | yes | paths under `prose/` |
| web_published | bool | no | the app serves `/<slug>/` (1.3); the only publish flag |
| visibility | text | no | `public`, `unlisted`, `private` (1.3) |
| owner_id | text | no | `u_owner` today |
| shared_with | json | no | `[]` today; actor ids later |
| generated_by | text | yes | `planner@<version>` when the builder made the first draft |
| legacy_url | text | yes | `/<slug>/` while the legacy page exists |
| created | date | no | |

**profile** (exactly one object; drives research lanes, day shaping and Plan B)

| Column | Type | Null? | Rule |
|---|---|---|---|
| pace | int | no | 1 (slow) to 5 (packed) |
| comfort | text | no | `lean`, `mid`, `comfortable`, `splurge` |
| budget_target_amount, budget_target_currency | real, text | yes | total for the party |
| budget_tier | text | no | same enum as comfort |
| must_do | json | no | array of `{text, ref}`; `ref` is a catalog id or null |
| avoid | json | no | array of text |
| hiking_ceiling_km | real | yes | the Norway "12 km round trip" rule |
| hiking_ceiling_gain_m | int | yes | |
| max_house_grade | int | yes | 1-5; trails above it go to Track A only |
| weather_rain | text | no | `low`, `medium`, `high` |
| weather_wind_gust_kmh, weather_cold_c, weather_heat_c | int | yes | Plan B thresholds (gust default 50) |
| base_preference | text | no | `few-long`, `balanced`, `many-short`, `campsite-only` |
| car_free | bool | no | |
| transport | json | no | subset of `own-car`, `rental-car`, `camper`, `train`, `bus`, `domestic-flight`, `ferry`, `bike`, `taxi-app`, `walk` |
| daily_max_drive_min | int | no | default 240 (D25) |
| break_every_min | int | no | default 120 (D25) |
| kids_mode | text | no | `none`, `young`, `mid`, `teen`, `mixed` |
| early_starts | text | no | `never`, `sometimes`, `fine` |
| night_driving | bool | no | false means the after-dark caution of 0B.5 is a warning |
| lanes_extra, lanes_skip | json | no | lane ids forced on or off (7.3) |
| notes | text | no | `""` |

**travellers** (PK `id`; every column `x-private` except `id`, `label`, `role`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `t1`, `t2` ... |
| label | text | no | "Adult 1", "Child (13)" |
| role | text | no | `adult`, `child`, `infant` |
| age_years | int | yes | at `age_as_of` |
| age_as_of | date | yes | age at an edition = `age_years + floor((edition.start - age_as_of) / 365.25)` |
| height_cm, weight_kg | int | yes | |
| fitness | int | yes | 1-5 |
| citizenship | json | no | ISO2 list (D6); `[]` when unknown |
| notes | text | no | `""` |

**trip_tags** (PK `tag_id`): `tag_id` text, FK `data/vocab/tags.json`, canonical ids only. `trip.primary_style` must also appear here. The same vocabulary serves `place_tags` and the catalog `tags` columns.

**editions** (PK `id`): `id` (`e2027`), `label`, `year` int, `start` date (Day 1), `end` date (`end - start + 1` equals the number of days with `n >= 1`), `status` (`candidate`, `chosen`, `booked`, `travelled`, `cancelled`; at most one `chosen` or `booked`), `why`, `fare_window_id` (FK `fare_windows`, nullable), `conditions_trigger` (scheduled-task id, nullable, section 13). Derived from the chosen edition, never stored: each day's date and weekday, the countdown, every booking's absolute deadline, sun times, traveller ages, weekday checks.

**bases** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `ushuaia` |
| name | text | no | |
| place_id | text | yes | FK locations `places.id` (the town) |
| stay_id | text | yes | FK catalog `stays.id`; null until a property is chosen |
| lodging | text | yes | property label while `stay_id` is null |
| night_from | int | no | day `n` of the first night |
| nights | int | no | >= 1; bases may not overlap; together they cover every night |
| lat, lon | real | yes | required when both `place_id` and `stay_id` are null |
| tz | tz | no | IANA zone of the base |
| elevation_m | int | yes | |
| why | text | no | the defence column of the night split |
| why_not | text | no | `""` |

The booking for a base is the `trip_bookings` row whose `base_id` names it. Check-in day = `night_from`, check-out day = `night_from + nights`.

**days** (PK `n`): `n` int (0..N contiguous; 0 only for an overnight departure), `title`, `kind` (`travel`, `hike`, `sightseeing`, `city`, `rest`, `buffer`, `mixed`), `base_id` (nullable; where the group sleeps that night; validated against `bases`), `summary`, `prose` (nullable path), `flexible_group` (nullable), `decision_rules` json, `plan_b_title`, `plan_b_text` (nullable), `sun_note` (nullable), `day_of_links` json (`{label, url, kind}`; kinds `closures`, `forecast`, `parking`, `tel`, `webcam`), `accepted_warnings` json (day-check codes the owner accepted; still shown, never blocking).

**day_tracks** (PK `day` + `track`): `day` int FK `days.n`; `track` `A`, `B`, `C`, `P`; `audience` `adult-only`, `family`, `less-walking`, `plan-b`; `title`; `notes`; `split` bool.

**items** (PK `id`; unique `day` + `track` + `seq`). The timed unit: trip > day > item.

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `d08-i03` (generated) |
| day | int | no | FK `days.n` |
| track | text | yes | null = whole group; `A`, `B`, `C`; `P` = Plan B items |
| seq | int | no | 1..n contiguous per day and track; the chronological order |
| start | hhmm | yes | fixed start |
| window_start, window_end | hhmm | yes | a flexible window instead of a fixed start; at most one of `start` or the window |
| tz | tz | yes | overrides the zone rule of 2.1 |
| duration_min | int | no | planned duration including breaks |
| type | text | no | `activity`, `trail`, `sight`, `meal`, `transfer`, `checkin`, `checkout`, `buffer`, `rest`, `flight`, `break` |
| optional | bool | no | rendered "(optional)"; excluded from the pace check |
| pinned | bool | no | hand-placed; kept when a draft is regenerated |
| title | text | no | |
| place_id | text | yes | FK locations places |
| trail_id | text | yes | FK catalog trails; required when `type = trail` |
| activity_id | text | yes | FK catalog activities |
| eatery_id | text | yes | FK catalog eateries |
| custom_item_id | text | yes | FK `custom_items.id` |
| base_id | text | yes | required when `type` is `checkin` or `checkout` |
| booking_id | text | yes | FK `trip_bookings.id` (the offer is reached through it) |
| lat, lon | real | yes | when no referenced row supplies coordinates; every item except `buffer` and `rest` must resolve to coordinates or carry `W_NO_COORDS` |
| address | text | yes | offline fallback text |
| leg_id | text | yes | FK catalog legs; when set, the `leg_*` values default from the leg and the validator warns if they differ by more than 20% without an `override` note |
| leg_mode | text | yes | travel FROM the previous item (from the night's base for seq 1; from `trip.origin` on a day trip): `drive`, `walk`, `bus`, `shuttle`, `train`, `ferry`, `boat`, `flight`, `taxi`, `bike`, `none` |
| leg_km | real | yes | |
| leg_minutes | int | yes | |
| leg_basis | text | yes | `routed`, `timetable`, `matrix`, `estimate`, `inference` |
| leg_notes | text | no | tolls, fuel, cell dead zones, parking |
| cost_amount, cost_currency | real, text | yes | when there is no booking |
| cost_per | text | yes | `person`, `group`, `vehicle`; required when `cost_amount` is set |
| open_from, open_to | hhmm | yes | opening hours for that weekday |
| closed_weekdays | json | no | ISO weekdays 1-7, checked against the resolved date |
| needs_daylight | bool | no | must finish before sunset; default true for trails |
| plan_b_item_id | text | yes | FK items (track `P`, same day) |
| override | json | yes | catalog fields replaced for this trip only (`{"trailhead_lat": ...}`) |
| notes | text | no | `""` |
| links | json | no | `{label, url, kind}`; kinds `official`, `operator`, `alltrails`, `google-maps`, `osm`, `komoot`, `outdooractive`, `wikiloc`, `waymarked`, `webcam`, `other` |

Reference rule: an item references at most one of `trail_id`, `activity_id`, `eatery_id`, `custom_item_id` (`place_id` may accompany any of them). Travel legs are columns on the item they arrive at, so the order and the "does the leg fit" check work on one pair of rows.

**trip_trails** (PK `trail_id`): `trail_id` FK catalog trails; `role` (`track-a`, `track-b`, `track-c`, `optional`, `listed`, `rejected`); `alternative_of` (nullable trail_id); `turnaround_rule` (nullable); `party_note`; `kid_fit` (`yes`, `strong-kid`, `no`, `unknown`, for this party); `verdict`; `override` (json, nullable).

**trip_activities** (PK `activity_id`): `activity_id` FK catalog activities; `day` (nullable int); `verdict` (`in`, `optional`, `swap`, `cut`); `why`; `offer_id` (nullable FK catalog offers: the product chosen when an activity has several). Fit per traveller is derived at an edition from the offer's limits ("Fits all", "Not for Child (11)", "Limits unknown"); heights and weights are private, so the export carries only the verdict.

**trip_bookings** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `bk-piratour` |
| offer_id | text | yes | FK catalog offers; null only for one-off private arrangements |
| item | text | yes | label; required when `offer_id` is null |
| category | text | yes | the offer category enum (2.3A); required when `offer_id` is null |
| book_url | text | yes | only when `offer_id` is null |
| base_id | text | yes | FK `bases.id` for a lodging booking |
| used_days | json | no | day numbers |
| book_by_offset | offset | yes | computed from the offer's window (rule below), editable |
| book_by_basis | text | no | `computed`, `owner`, `inference` |
| deadline_date | date | yes | absolute rules only, bound to `edition_id` |
| edition_id | text | yes | |
| priority | text | no | `urgent`, `must`, `should`, `optional` |
| status | text | no | `todo`, `held`, `booked`, `paid`, `walk-up`, `sold-out`, `cancelled`, `not-needed` |
| price_paid_amount, price_paid_currency | real, text | yes | x-private |
| confirmation, contact | text | yes | x-private |
| found_by | text | no | lane id or `owner` |
| notes | text | no | |
| src | json | no | |

**Recommended book-by, computed** (`core/src/bookings/bookBy.ts`, the one implementation). With `U` = offset of the first used day and the offer's window fields:

| Opening and sell-out | book_by_offset |
|---|---|
| `minutes-after-release` | the opening offset itself (be online at release); the Timeline shows the release time when `opens_rule` has one |
| `rolling-lead` | `max(U - opens_lead_days, U - sellout_lead_days - 14)`; with no sell-out figure, the opening itself |
| `fixed-date` / `monthly-release` / `lottery` | the opening (or lottery close) date for the edition, written to `deadline_date` |
| `never` sells out | `U - 7` (or `U - 1` for walk-up tickets that exist) |
| `unknown` | `U - 120` for flights and lodging in a peak month, `U - 60` for tours, `U - 30` otherwise; `book_by_basis = inference` and a GAP flag |

The Timeline (4.5) lists bookings by resolved book-by date with a derived state: `not-yet-open`, `open`, `urgent` (open and book-by within 14 days, or past), `booked`, `sold-out`.

**custom_items** (PK `id`): `id` (`cx-<slug>`), `name`, `kind` (the place kinds plus `break`, `fuel`, `rest-area`), `lat`, `lon` (nullable), `address` (nullable), `osm_id` (nullable, `node/123`), `notes`, `duration_min` (nullable), `open_from`, `open_to` (nullable hhmm), `proposed` (`no`, `proposed`, `accepted`, `rejected`), `catalog_id` (nullable, after acceptance). Trip-local; can be proposed to the catalog (0B.3).

**notes** (PK `id`): `id`, `scope` (`trip`, `day`, `item`, `place`), `ref` (day n, item id or catalog id, as text; null for `trip`), `text` (Markdown), `visibility` (`private`, `shared`; `private` is x-private and never exported), `links` json, `attachments` json (`{name, local_key}`), `author`, `created`, `updated` (datetime). Never part of a catalog row (0B.4).

**routes** (PK `id`): `id`, `days` json, `waypoints` json (item ids or `{lat, lon}`), `profile` (`car`, `camper`), `break_every_min`, `daily_max_drive_min`, `corridor_km` real, `break_types` json, `avoid` json (`ferries`, `tolls`, `unpaved`), `geometry_file` (nullable path under `routes/`, the sidecar of 0B.5), `provider` (nullable: `ors`, `osrm`, `graphhopper`, `estimate`), `computed` (nullable datetime).

**hazards** (PK `id`): `category` (`wind`, `cold`, `heat`, `water`, `glacier`, `wildlife`, `terrain`, `altitude`, `crime`, `health`, `road`, `remoteness`, `other`), `title`, `text`, `severity` 1-3, `days` json, `trail_ids` json, `place_ids` json, `mitigation`, `src`.

**weather_rules** (PK `id`): `day` (nullable int), `metric` (`gust_kmh`, `wind_kmh`, `precip_mm`, `precip_prob`, `temp_max_c`, `temp_min_c`, `snowline_m`, `visibility`), `op` (`>`, `>=`, `<`, `<=`), `value` real, `at` hhmm, `action`, `plan_b_day` (nullable). Defaults generated from `profile.weather_*` (section 13).

**budget** (PK `id`): `category` (`getting-there`, `local-transport`, `lodging`, `food`, `activities`, `passes`, `insurance`, `misc`), `item`, `currency`, `per_person_amount` (nullable real), `group_low_amount`, `group_high_amount` (real), `basis` (`fare-read`, `snapshot`, `operator`, `inference`, `gap`), `read_date` (nullable), `booking_id` (nullable FK `trip_bookings`), `fare_window_id` (nullable), `src`. Totals are derived in `trip.base_currency`.

**fx** (PK `currency`): `currency`, `rate_to_base` real (units of base currency per 1 unit), `as_of` date, `source` (`frankfurter`, `assumption`).

**fare_windows** (PK `id`): `label`, `depart` date, `return` date, `nights_away` int, `party` json (`{adults, children: [ages]}`, x-private), `school_break` bool, `notes`. **fare_quotes** (PK `id`): `window_id` FK, `kind` (`flight-intl`, `flight-domestic`, `lodging`, `car`), `leg`, `date_from`, `date_to`, `total_amount`, `total_currency` (whole party), `provider`, `method` (`playwright-tfs`, `playwright-tfs-oneway`, `playwright-booking`, `manual`), `url`, `read_at` datetime, `filters`, `confidence`, `notes`.

**documents** (PK `id`): `item` (`passport-validity`, `visa`, `eta`, `minors-consent`, `insurance`, `idp`, `park-pass`, `vaccination`, `other`), `applies_to` (`all`, `adults`, `children` or a traveller id), `rule`, `deadline_offset` (nullable offset), `computed_rule` (nullable), `status`, `src`.

**emergency** (PK `base_id`): `number`, `hospital_name`, `hospital_lat`, `hospital_lon`, `hospital_tel`, `rescue_tel`, `embassy`, `insurer_tel` (x-private), `roadside_tel`, `src`.

**packing** (PK `id`): `item`, `reason` (`hut`, `van`, `glacier`, `kids`, `rain`, `cold`, `altitude`, `boat`, `city`), `qty`. Ticks live in the browser (4.10).

**knowledge** (PK `id`): `claim`, `status` (`verified`, `inference`, `gap`, `conflict`), `src`. **questions** (PK `id`): `text`, `status` (`open`, `answered`, `dropped`), `answer`, `asked` date. **gotchas** (PK `id`): `text`, `src`.

**research_refs** (PK `id`): `path` (under `research/`, must exist), `sidecar` (nullable path), `lane`, `title`, `added` date, `sha256`, `synthesised` (nullable date).

**sources** (PK `id`): `src-0001` sequential; `url`, `title`, `publisher`, `kind` (`official`, `operator`, `reseller`, `press`, `blog`, `community`, `video`, `computed`), `checked` date, `research_ref` (nullable).

**changelog** (PK `seq`): `seq` int, `at` datetime, `actor_id` (`u_owner`, `agent:<lane>`), `actor_via` (`ui`, `cli`, `mcp`, `api`, `import`, `skill:<name>`), `op` (operation name), `summary`, `refs` json. Every operation appends one row.

### 2.3A Catalog tables (new in revision 4: canonical)

Each catalog file is `data/catalog/<entity>/<CC>.json` with keys `schema_version`, `country`, the entity table, and that file's own `sources` table (`id`, `url`, `title`, `publisher`, `kind`, `read`). Places and geography stay in `data/locations/` (locations v3, below).

**Common block** (every catalog row except geography; places get it in v3): `id`, `area_id` (FK areas), `name`, `name_lang` (BCP 47, nullable), `tags` json (canonical vocabulary ids), `kid_fit` (`yes`, `strong-kid`, `no`, `unknown`), `min_age`, `max_age`, `min_height_cm`, `max_height_cm`, `min_weight_kg`, `max_weight_kg` (int, nullable), `house_grade` (int 1-5, nullable), `walk_km` (real, nullable), `walk_gain_m` (int, nullable), `duration_min` (int, nullable: typical time on site), `accessibility` (`step-free`, `partial`, `none`, `unknown`), `season_months` json, `cost_ref` (nullable: an offer id or a short text), `lat`, `lon` (real, nullable; required for places, stays, eateries; trails use `trailhead_*`), `review_status` (`raw`, `proposed`, `verified`, `stale`, `retired`), `confidence` (`verified`, `stated`, `inference`, `gap`, `conflict`), `sources` json (ids into the file's `sources`), `field_meta` json, `verified_by` (nullable), `last_verified` (nullable date), `contributed_by` json, `licence` (`own-words`, `odbl`, `ogl-ca`, `cc-by-4.0`, `public-domain`), `merged_from` json (`[]`), `updated` date.

| Table (file) | Id | Columns beyond the common block |
|---|---|---|
| `trails` (`trails/<CC>.json`) | place-style path `AR/santa-cruz/el-chalten/laguna-de-los-tres` | `place_id` (nullable), `km`, `km_range`, `gain_m`, `loss_m`, `hours` (text), `shape` (`out-and-back`, `loop`, `point-to-point`, `network`), `house_basis` (`technical`, `effort`, `effort-only`), `local_system` (`sac`, `parks-canada`, `sepaq`, `nps`, `yds`, `uk`, `apn`, `dnt`, `other`), `local_grade`, `local_source_url`, `trailhead_lat`, `trailhead_lon`, `trailhead_name`, `hazards` json, `permit`, `geometry_file` (`geo/<id with / as __>.geojson`), `geometry_source` (`osm`, `parks-canada`, `nps`, `usfs`, `swisstopo`, `manual-gpx`), `geometry_source_id`, `geometry_fetched` (date), `official_url`, `alltrails_url`, `komoot_url`, `outdooractive_url`, `wikiloc_url`, `notes` |
| `activities` | `<area_id>/<slug>` | `type` (`boat-tour`, `cruise`, `kayak`, `canoe`, `rafting`, `glacier-walk`, `ice-trek`, `guided-hike`, `via-ferrata`, `climbing`, `canyoning`, `zipline`, `gondola`, `train`, `heli`, `scenic-flight`, `horse`, `cycling`, `wildlife`, `hot-springs`, `spa`, `snorkel-dive`, `ski`, `dog-sled`, `cave`, `4x4`, `food-tour`, `show`, `museum-tour`, `other`), `operator`, `place_id` (nullable), `indoor` bool, `weather_sensitive` bool, `adventure_level` 1-5, `notes` |
| `stays` | `<area_id>/<slug>` | `kind` (`hotel`, `lodge`, `cabin`, `apartment`, `hut`, `campsite`, `hostel`), `comfort_tier` 1-4, `sleeps_max`, `elevation_m`, `car_free_access` bool, `last_transport` (text), `address`, `notes` |
| `eateries` | `<area_id>/<slug>` | `cuisine`, `price_tier` 1-4, `kids_menu` (bool, nullable), `reservation` (`required`, `recommended`, `walk-in`), `hours` json (`{"1": [["12:00","15:00"]], ...}` by ISO weekday), `notes` |
| `offers` | `of-<provider-slug>-<product-slug>` | `subject_entity` (`activity`, `stay`, `trail`, `place`, `leg`), `subject_id`, `category` (`flight-intl`, `flight-domestic`, `lodging`, `hut`, `car`, `ferry`, `tour`, `activity`, `permit`, `parking`, `timed-entry`, `restaurant`, `spa`, `pass`, `insurance`, `transport`, `other`), `provider`, `book_url`, `reseller_urls` json, `other_limits`, `limits_status` (`verified`, `stated-by-reseller`, `none-stated`, `gap`), `opens_kind` (`always-open`, `rolling-lead`, `fixed-date`, `monthly-release`, `lottery`, `on-arrival`, `unknown`), `opens_lead_days`, `opens_rule`, `opens_evidence`, `sellout_kind` (`never`, `minutes-after-release`, `days`, `weeks`, `months`, `unknown`), `sellout_lead_days`, `sellout_peak`, `same_day` (`yes`, `no`, `sometimes`, `unknown`), `cancellation`, `weather_refund`, `price_variance`, `notes`. Hard limits use the common block columns |
| `offer_prices` (in the offers file) | `<offer_id>#<n>` | `offer_id`, `amount`, `currency`, `per` (`person`, `adult`, `child`, `group`, `vehicle`, `night`, `room`), `age_from`, `age_to` (nullable), `valid_months` json, `basis_year` (nullable int), `read` date, `source_id`, `window` (nullable json, for fares). Snapshots only append |
| `legs` (`legs/<CC>.json`, geometry in `legs/geo/`) | `lg-` plus the first 10 hex digits of the SHA-256 of `from_id`, `to_id` and `mode` joined by a vertical bar | `from_id`, `to_id` (catalog ids with coordinates), `mode`, `km`, `minutes`, `basis` (`routed`, `timetable`, `matrix`, `estimate`, `inference`), `seasonal_notes`, `symmetric` bool, `geometry_file` (nullable). Unique `from_id` + `to_id` + `mode` |
| `area_guides` (`areas/<CC>.json`) | the area id | `summary` (our words), `best_months` json, `getting_there`, `hidden_gems` json (`[{place_id, line}]`), `what_to_know`, `safety` |
| `catalog_changes` (`changes/YYYY-MM.jsonl`, one JSON object per line) | `seq` | `at` datetime, `actor_id`, `actor_via`, `entity`, `id`, `op` (`add`, `edit`, `merge`, `retire`, `verify`), `before`, `after` (json), `reason`, `proposal_id`, `sources` |
| `backlog` (`backlog.json`) | `bl-<hash>` | `subject_entity`, `subject_id`, `area_id`, `reason` (`gap`, `stale`, `low-coverage`, `conflict`, `user-request`), `field`, `lane`, `priority` (0A.3), `status` (`open`, `claimed`, `done`, `wont-do`), `claimed_by`, `created`, `done` |

**Locations v3** (`data/locations/locations.json`, P2b). The v2 tables and ids stay. Changes: the `tags` table moves to `data/vocab/tags.json` (gaining `kind`: `style`, `activity`, `feature`, `audience`, `free`) and `place_tags` keeps pointing at it; `places` keeps `kind`, `status` (the owner's wishlist status: `idea`, `shortlisted`, `planned`, `visited`, `dropped`) and `trip`, and gains the common-block columns it lacks: `name_lang`, `min_age` to `max_weight_kg`, `house_grade`, `walk_km`, `walk_gain_m`, `duration_min`, `accessibility`, `cost_ref`, `review_status`, `confidence`, `field_meta`, `verified_by`, `last_verified`, `contributed_by`, `licence`, `merged_from`, `updated`, with defaults set by the migration (`review_status: proposed`, `confidence: stated`, `licence: own-words`, `accessibility: unknown`, `contributed_by: ["u_owner"]`, `updated` = the place's `added`). `sources.screenshot` paths move under `research/inbox/`. Every v2 id survives; `WISHLIST.md` headings are unchanged.

**Example (Patagonia Day 3).** `items[d03-i01].booking_id = "bk-piratour"` points to `trip_bookings[bk-piratour]`, whose `offer_id` is `of-piratour-harberton-martillo` in `data/catalog/offers/AR.json`. That offer holds the provider, `book_url`, `limits_status: gap` on minimum age, the window `opens_kind: rolling-lead`, and a price snapshot `{offer_id, amount: 140, currency: "USD", per: "adult", read: "2026-10-13", source_id: ...}` in `offer_prices`; the trip row holds only `used_days: [3]`, `book_by_offset: -88`, `priority: must`, `status: todo`. A second trip to Ushuaia reuses the offer and its snapshots.

**DDL notes.** Catalog tables carry no `trip_id`; trip tables carry a leading `trip_id` and join to the catalog by FK. `json` columns get `CHECK (json_valid(col))`. `trips.owner_id`, `trips.visibility`, catalog `review_status`, `last_verified` and `area_id` are indexed.

### 2.4 Validation rules beyond the per-column ones (Revised 4: named codes)

Every rule has a code. Errors (`E_*`) block a write; warnings (`W_*`) are shown and never block. The P2a fixture suite holds one broken fixture per `E_*` code and P2b one per `W_*` code (so the fixture count is the number of codes, not a padded target), plus valid fixtures. Messages follow 4.7.

**Structural (errors; `core/src/validate/`, P2a):**

| Code | Rule |
|---|---|
| `E_SCHEMA` | a column is missing, unknown, of the wrong type, outside its enum or pattern |
| `E_KEY_ORDER` | root keys out of the 2.2 order (writer bug; the writer always emits the order) |
| `E_PK_DUP` | duplicate primary key in a table |
| `E_FK` | a foreign key misses its target (inside the file, into `data/locations`, into `data/catalog/*`, into `data/vocab/tags.json`) |
| `E_SRC` | an id in `src` or `sources` is not in the sources table |
| `E_DAYS_CONTIGUOUS` | `days.n` is not 0..N or 1..N without gaps |
| `E_SEQ_CONTIGUOUS` | `items.seq` is not 1..n per day and track |
| `E_BASE_COVER` | a night is covered by no base or by two (no bases and no nights for a day trip) |
| `E_NIGHTS_SUM` | `trip.nights` differs from the sum of `bases.nights` |
| `E_DURATION_SHAPE` | `duration_shape` does not match `nights` |
| `E_EDITION_LENGTH` | `end - start + 1` differs from the number of days with `n >= 1` |
| `E_EDITION_CHOSEN` | more than one edition `chosen` or `booked` |
| `E_STYLE_TAG` | `primary_style` is not in `trip_tags` |
| `E_ITEM_REF` | an item breaks the reference rule (type `trail` without `trail_id`, `checkin`/`checkout` without `base_id`, more than one of `trail_id`, `activity_id`, `eatery_id`, `custom_item_id`) |
| `E_ITEM_TIME` | both `start` and a window, or `window_end` before `window_start` |
| `E_PLAN_B` | `plan_b_item_id` does not target a track `P` item on the same day |
| `E_COST_PAIR` | an `_amount` without its `_currency` (or `cost_per`), or the reverse |
| `E_BOOKING_OFFER` | a `trip_bookings` row with neither `offer_id` nor `item` and `category` |
| `E_OFFER_WINDOW` | an offer with `opens_kind: rolling-lead` and no `opens_lead_days` |
| `E_TZ` | a `tz` value is not an IANA zone |
| `E_RESEARCH_PATH` | a `research_refs.path` does not exist |
| `E_SLUG` | slug pattern, reserved slug (1.1), or slug differs from the folder |
| `E_ID_ENCODING` | a catalog id contains `__` or a character outside `[A-Za-z0-9/-]` |
| `E_LEG_ID` | a leg id is not the hash of its `from_id`, `to_id`, `mode` |
| `E_VISIBILITY` | `web_published: true` on a `private` trip |

**Day checks (warnings; `core/src/checks/`, P2b; the same function serves the hook summary, the editor panel, the plan pages and the planner)**, per day and per track (whole-group items are merged into each track's timeline):

| Code | Rule |
|---|---|
| `W_ORDER` | items sorted by `seq` have non-decreasing effective start (fixed `start`, else `window_start`, else the previous end plus its leg) |
| `W_OVERLAP` | `start(i) + duration(i) + leg_minutes(i+1) <= start(i+1)` for fixed starts; a window passes when the earliest arrival is before `window_end` |
| `W_LEG_MISSING` | a change of coordinates over 300 m between consecutive items without `leg_mode` and `leg_minutes` |
| `W_DAYLIGHT` | an item with `needs_daylight` ends after sunset for the chosen edition (sun from `core/src/sun/`, in the base's zone) |
| `W_HOURS` | an item starts before `open_from` or ends after `open_to`, or falls on a `closed_weekdays` day |
| `W_BOOKING_DAY` | an item's booking has `used_days` that excludes this day |
| `W_PACE` | active time (non-optional item durations and legs, excluding `rest`) over the pace budget: pace 1 = 5 h, 2 = 7 h, 3 = 9 h, 4 = 11 h, 5 = 13 h; travel days count driving at 1.5x |
| `W_CEILING` | trail km or gain on a track over `hiking_ceiling_*`, or a Track B or C trail above `max_house_grade` |
| `W_EARLY` | an item before 06:00 when `early_starts = never` |
| `W_DEADLINE` | a booking whose book-by is past for the chosen edition and still `todo` |
| `W_NO_COORDS` | an item other than `buffer` or `rest` resolves to no coordinates (day checks that need them skip it with a note) |
| `W_TZ_MISSING` | consecutive items in different base zones with no `items.tz` |
| `W_LEG_DRIFT` | `leg_*` differs from the catalog leg by more than 20% without an override note |
| `W_DRIVE_LIMIT` | driving on a day over `profile.daily_max_drive_min` |
| `W_FIT` | a traveller fails an offer's or row's limits; `W_FIT_UNKNOWN` when limits are null |

### 2.5 One source (Revised 4: Zod as the source, decision D26)

```
core/src/schema/*.ts         Zod 4 schemas, restricted subset, with .meta({ sql, ui, private, rules }) on tables and columns
          |
          +-- node core/bin/schema.ts generate --> data/schema/generated/schema.json   (JSON Schema 2020-12, z.toJSONSchema, committed)
          |                                    --> data/schema/generated/schema.sql    (SQLite/D1 DDL from the exported JSON Schema)
          |                                    --> data/schema/generated/ops.json      (operation catalogue for MCP and API, section 5)
          +-- TypeScript types are z.infer<> of the same schemas (nothing generated)
          +-- the exported JSON Schema is what MCP get_entity_schema returns, what /schema/ renders, and what any
              Python or third-party consumer reads; Python hooks do not validate (1.5)
```

**Evaluation.** Revisions 1-3 chose JSON Schema as the source because "Python hooks must not need Node". With one runtime per concern (1.5) the hooks call Node anyway, and even before that the objection did not hold: an exported JSON Schema, committed, serves every non-TS reader.

| | JSON Schema first (revisions 1-3) | Zod first (revision 4) |
|---|---|---|
| Generators to write and test | DDL, TS types, Zod, ops catalogue | DDL, ops catalogue (JSON Schema export is built into Zod 4; types come from `z.infer`) |
| Cross-field rules | `x-rules` interpreted by a Python and a TS validator, parity-tested over every fixture | declarative `rules` metadata interpreted by one TS validator |
| Reviewability of diffs | JSON diffs | TS diffs of the source plus the JSON diff of the committed export (both visible in the PR) |
| Forms and API input | generated Zod | the same Zod |
| Risk | parity drift (R2) | metadata must survive the export: a test asserts every `meta` key (`sql`, `ui`, `private`, `rules`) appears in `schema.json` for every table; transforms and refinements are banned in schema files (lint rule) because they do not export |

**Decision: Zod as the source** (pinned `zod@4.6.7`), with the committed JSON Schema export. The restricted subset: `z.object` (strict), `z.string` with `enum`, `regex`, `date`, `datetime`; `z.number().int()` with min and max; `z.boolean`; `z.array`; `.nullable()`; `z.enum`; references by importing the shared schema object (exported as `$defs`). Cross-file references (trip to locations, catalog, vocab) are resolved at validation time by loading the referenced files, not by `$ref` across files; the export emits one document with `$defs` per table in a stable order (sorted by table name), so `generate --check` is byte-stable.

- **Locations joins the same source in P2a:** `core/src/schema/locations.ts` describes v2 (and v3 in P2b); the generated DDL must load in SQLite with the existing data, and `tools/tests/test_schema_sqlite.py` is extended to load the generated `schema.sql` (trips, catalog, locations) with `PRAGMA foreign_key_check` empty.
- **DDL mapping:** each trip table becomes a D1 table with a leading `trip_id` column; catalog tables carry no `trip_id`; `json` columns get `CHECK (json_valid(col))`; money is already two scalar columns (2.1), so the JSON row and the D1 row match.
- **Schema versioning policy:** `schema_version` is an integer per file family (trip, catalog entity, locations). Adding a nullable column or an enum value is a minor change with no version bump. Renaming, removing, or tightening is a version bump with a migration in `core/src/migrate/<family>-v<n>.ts` that is idempotent (`--check` writes nothing; a second run is a no-op), keeps every id, and ships with a fixture of the old version. The validator rejects a file whose version is newer than the code; an older file is migrated by `node core/bin/migrate.ts`, never silently on read.

### 2.6 Trip type taxonomy (metadata for filters and research lanes)

| Dimension | Field | Enum or free | Values | Drives |
|---|---|---|---|---|
| Duration shape | `trip.duration_shape` | enum | `day-trip`, `weekend`, `short-break`, `week`, `multi-week` | list filter; day trips skip the stays, entry and fares lanes; the page drops Bases, Timeline buckets beyond T-14 and Emergency per base |
| Movement shape | `trip.movement_shape` | enum | `single-base`, `two-bases`, `multi-base`, `road-trip`, `hut-to-hut`, `camper`, `cruise` | `road-trip` and `camper` run the road-trip lane and render drive legs prominently; `hut-to-hut` runs huts inside the stays lane |
| Style | `trip.primary_style` (one) + `trip_tags` of kind `style` (many) | controlled vocabulary with aliases | `adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `family`, `romantic`, `hidden-gems`, `mixed` (`luxury` is an alias of `luxury-relax`) | the main filter chip group; the globe colour option; the lane selection table (7.3) |
| Season | `trip.season_months` | enum months 1-12 | | "good in" filter; editions must fall inside it (warning) |
| Party | `trip.party_shape` + `travellers` | enum + rows | see above | `kid_fit` filters and adventure fit; `family-*` forces the kid-limit columns in the adventure lane |
| Free tags | `trip_tags` of kind `activity`, `feature`, `audience`, `free` | free, but normalised through the vocabulary (new tags are added with `tag.add`, aliases resolve) | `penguins`, `glaciers`, `larches`, `fall-colours` | search, secondary chips |

### 2.7 Worked examples (Revised 4: canonical columns)

Revised 4: example A carries every 2.3 `items` column; examples B and C are abridged (omitted columns take their defaults).

**A. Patagonia Day 8, Laguna de los Tres (multi-day trip, single-base stretch, three tracks plus Plan B).** Values from today's PLAN.md where it states them; times are the plan's defaults. The full trip root and the other tables follow the same shape; only Day 8's rows are shown.

```json
{
  "days": [
    {"n": 8, "title": "Laguna de los Tres", "kind": "hike", "base_id": "el-chalten",
     "summary": "The Fitz Roy day: the hard hike for those who want it, the Capri loop for the rest.",
     "prose": "prose/day-08.md", "flexible_group": "chalten-weather",
     "decision_rules": ["At Poincenot camp by 11:00, otherwise everyone turns back via Laguna Capri", "Leave the lake by 13:30 (INFERENCE)"],
     "plan_b_title": "Wind over 50 km/h or cloud on Fitz Roy", "plan_b_text": "Swap with Day 9 (spare day) or walk Chorrillo del Salto",
     "sun_note": "Sunrise 07:28; no shade on the last 2.4 km",
     "day_of_links": [{"label": "Chalten wind forecast", "url": "https://www.windy.com/-49.33/-72.89", "kind": "forecast"}]}
  ],
  "day_tracks": [
    {"day": 8, "track": "A", "audience": "adult-only", "title": "Laguna de los Tres", "notes": "One adult and a strong teen", "split": true},
    {"day": 8, "track": "B", "audience": "family", "title": "Laguna Capri and Mirador Fitz Roy loop", "notes": "Same trailhead, same view over water", "split": true},
    {"day": 8, "track": "C", "audience": "less-walking", "title": "Mirador de los Condores", "notes": "From the visitor centre", "split": true},
    {"day": 8, "track": "P", "audience": "plan-b", "title": "Chorrillo del Salto", "notes": "", "split": false}
  ],
  "items": [
    {"id": "d08-i01", "day": 8, "track": null, "seq": 1, "start": "06:30", "window_start": null, "window_end": null, "tz": null, "duration_min": 30,
     "type": "meal", "optional": false, "pinned": false, "title": "Breakfast and packed lunch", "place_id": null, "trail_id": null, "activity_id": null, "eatery_id": null, "custom_item_id": null,
     "base_id": "el-chalten", "booking_id": null, "lat": null, "lon": null, "address": null,
     "leg_id": null, "leg_mode": "none", "leg_km": null, "leg_minutes": null, "leg_basis": null, "leg_notes": "",
     "cost_amount": null, "cost_currency": null, "cost_per": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": false, "plan_b_item_id": null, "override": null, "notes": "", "links": []},
    {"id": "d08-i02", "day": 8, "track": "A", "seq": 2, "start": "07:15", "window_start": null, "window_end": null, "tz": null, "duration_min": 540,
     "type": "trail", "optional": false, "pinned": false, "title": "Laguna de los Tres and back", "place_id": null,
     "trail_id": "AR/santa-cruz/el-chalten/laguna-de-los-tres", "activity_id": null, "eatery_id": null, "custom_item_id": null, "base_id": null, "booking_id": "bk-glaciares-flexipass",
     "lat": -49.3226, "lon": -72.8889, "address": "Trailhead at the north end of Av. San Martin, El Chalten",
     "leg_id": null, "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "From the lodging to the trailhead",
     "cost_amount": null, "cost_currency": null, "cost_per": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": "d08-p01", "override": null,
     "notes": "21.5 km, about 950 m; about 450 m in the last 2.4 km", "links": []},
    {"id": "d08-i02b", "day": 8, "track": "B", "seq": 2, "start": "08:30", "window_start": null, "window_end": null, "tz": null, "duration_min": 270,
     "type": "trail", "optional": false, "pinned": false, "title": "Laguna Capri and Mirador Fitz Roy loop", "place_id": null,
     "trail_id": "AR/santa-cruz/el-chalten/laguna-capri-mirador-fitz-roy", "activity_id": null, "eatery_id": null, "custom_item_id": null, "base_id": null, "booking_id": "bk-glaciares-flexipass",
     "lat": -49.3226, "lon": -72.8889, "address": "Same trailhead",
     "leg_id": null, "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "",
     "cost_amount": null, "cost_currency": null, "cost_per": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": "d08-p01", "override": null,
     "notes": "11.7 km, 390 m", "links": []},
    {"id": "d08-i03b", "day": 8, "track": "B", "seq": 3, "start": "14:00", "window_start": null, "window_end": null, "tz": null, "duration_min": 120,
     "type": "rest", "optional": false, "pinned": false, "title": "Back in town: cafe, rest", "place_id": null, "trail_id": null, "activity_id": null, "eatery_id": null, "custom_item_id": null,
     "base_id": null, "booking_id": null, "lat": -49.3315, "lon": -72.8863, "address": "El Chalten centre",
     "leg_id": null, "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "",
     "cost_amount": null, "cost_currency": null, "cost_per": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": false, "plan_b_item_id": null, "override": null, "notes": "", "links": []},
    {"id": "d08-i09", "day": 8, "track": null, "seq": 9, "start": "19:30", "window_start": null, "window_end": null, "tz": null, "duration_min": 90,
     "type": "meal", "optional": false, "pinned": false, "title": "Dinner together", "place_id": null, "trail_id": null, "activity_id": null, "eatery_id": null, "custom_item_id": null,
     "base_id": null, "booking_id": null, "lat": -49.3315, "lon": -72.8863, "address": "El Chalten centre",
     "leg_id": null, "leg_mode": "walk", "leg_km": 0.5, "leg_minutes": 8, "leg_basis": "inference", "leg_notes": "",
     "cost_amount": 30, "cost_currency": "USD", "cost_per": "person", "open_from": "19:00", "open_to": "23:00", "closed_weekdays": [],
     "needs_daylight": false, "plan_b_item_id": null, "override": null, "notes": "", "links": []},
    {"id": "d08-p01", "day": 8, "track": "P", "seq": 1, "start": "10:00", "window_start": null, "window_end": null, "tz": null, "duration_min": 180,
     "type": "trail", "optional": false, "pinned": false, "title": "Chorrillo del Salto", "place_id": null, "trail_id": "AR/santa-cruz/el-chalten/chorrillo-del-salto",
     "activity_id": null, "eatery_id": null, "custom_item_id": null, "base_id": null, "booking_id": null, "lat": null, "lon": null, "address": null,
     "leg_id": null, "leg_mode": "walk", "leg_km": 1.0, "leg_minutes": 15, "leg_basis": "inference", "leg_notes": "",
     "cost_amount": null, "cost_currency": null, "cost_per": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": null, "override": null, "notes": "", "links": []}
  ],
  "weather_rules": [
    {"id": "wr-08", "day": 8, "metric": "gust_kmh", "op": ">", "value": 50, "at": "06:00", "action": "Do Plan B or swap with Day 9", "plan_b_day": 9}
  ]
}
```

What the day checks report on it: Track A active time is 30 + 12 + 540 + 8 + 90 = 680 min (11 h 20), over the pace-3 budget of 9 h, so the editor shows "Track A exceeds pace 3 by 2 h 20; accepted as the trip's one hard day?" and the import records it as an accepted warning (`W_PACE` in `accepted_warnings` on the day, an array of check codes, so the warning stays visible but does not block). Daylight passes: a 07:15 start plus 9 h ends 16:15, sunset on 5 Mar is 20:38 and civil dawn 06:56, so the 07:15 start is in daylight (research/sun.md, computed).

**B. A road-trip day with drive legs and a night stop** (shape from the Quebec prologue: Ile d'Orleans to Derby Line to Hyde Park; times illustrative).

```json
{
  "trip": {"duration_shape": "short-break", "movement_shape": "road-trip"},
  "bases": [{"id": "hyde-park", "name": "Hyde Park, VT", "night_from": 3, "nights": 1, "lat": 44.594, "lon": -72.616, "tz": "America/New_York", "why": "Night stop before Stowe"}],
  "items": [
    {"id": "d03-i01", "day": 3, "track": null, "seq": 1, "start": "08:30", "duration_min": 15, "type": "checkout", "title": "Check out", "base_id": "ile-d-orleans", "leg_id": null, "leg_mode": "none"},
    {"id": "d03-i02", "day": 3, "track": null, "seq": 2, "start": null, "window_start": "11:15", "window_end": "12:00", "duration_min": 45, "type": "transfer",
     "title": "Border crossing at Stanstead / Derby Line", "lat": 45.005, "lon": -72.099,
     "leg_mode": "drive", "leg_km": 240, "leg_minutes": 165, "leg_basis": "matrix", "leg_notes": "Fuel before the border; wait times on the CBSA page"},
    {"id": "d03-i03", "day": 3, "track": null, "seq": 3, "start": "12:30", "duration_min": 60, "type": "meal", "title": "Lunch in Newport, VT", "lat": 44.936, "lon": -72.205,
     "leg_mode": "drive", "leg_km": 15, "leg_minutes": 20, "leg_basis": "matrix", "leg_notes": ""},
    {"id": "d03-i04", "day": 3, "track": null, "seq": 4, "start": "15:00", "duration_min": 30, "type": "checkin", "title": "Check in, Hyde Park", "base_id": "hyde-park",
     "leg_mode": "drive", "leg_km": 75, "leg_minutes": 70, "leg_basis": "matrix", "leg_notes": "Cell coverage patchy on VT-100 (GAP)"}
  ]
}
```

(Abridged: omitted columns take their defaults.) The checks verify 08:45 + 165 min drive = 11:30, inside the border window; 12:00 + 20 = 12:20 before the 12:30 lunch; 13:30 + 70 = 14:40 before the 15:00 check-in. The page renders the legs between item cards as "240 km, 2 h 45 by car (matrix)" with a Google directions link for the whole day (section 4.6).

**C. Day trip versus multi-day.** A day trip (`duration_shape = day-trip`, Niagara or the Elora Gorge write-ups) has `nights = 0`, no `bases`, exactly one day `n = 1`, the first item's leg starts at `trip.origin`, the last item is a `transfer` home, and an edition is optional (an undated day trip is "any Saturday in September": `season_months` only). Validation drops the base-coverage rule, the page drops Bases, Emergency per base and the T-90/T-60 Timeline buckets, and the research lanes drop stays, entry and fares (7.3).

### 2.8 Removed in revision 4

Revision 2's list of trip-side changes (`trip` gains, `items` gains, `trip_activities`, `trip_bookings`, `catalog_changes`, the DDL notes and the Patagonia Day 3 example) is folded into 2.3 and 2.3A, which are now the only place these columns are specified.

## 3. Research spikes
### 3A. Trail geometry, metadata and difficulty normalisation (Revised 4: storage)

Checked 2026-10-17. Probes were run live against the Waymarked Trails and Overpass APIs from this machine; the results are below.

**What the owner wants per trail:** a line on our map, start and end markers, distance, gain, an elevation profile, a difficulty badge, and a click-out to the source.

#### Source comparison

| Source | Coverage | Licence | How to fetch one trail | Quality | Verdict |
|---|---|---|---|---|---|
| OpenStreetMap hiking relations through **Waymarked Trails (WMT)** | Worldwide, wherever OSM mappers have built `route=hiking/foot/walking` relations | ODbL 1.0 (attribution, share-alike on the derived database) | `GET https://hiking.waymarkedtrails.org/api/v1/details/relation/<osm_id>` returns ordered geometry (`route.main[].ways[].geometry`, EPSG:3857) plus tags. `GET .../relation/<osm_id>/way-elevation` returns a sampled profile with `min_elevation`/`max_elevation`. **Verified live 2026-10-17** on relation 10692471: 121 KB info, 2.6 MB elevation (84 km, so it must be resampled). The `/geometry/gpx` path quoted in a 2023 blog returns 404 today; the route list in the API source is `info`, `wikilink`, `way-elevation` only. | Good where relations exist. Member order can be wrong in the raw relation; WMT's `main`/`appendices` already sorts it. Stats tags (`distance`, `ascent`) are often missing | **Primary** for geometry |
| OSM via **Overpass API** | Same data | ODbL | `relation(<id>);out geom;` or a bbox search to *find* the relation id | Same | **Discovery** tool (find ids by bbox and name); not for bulk. Main instance guidance: under 10,000 queries and 1 GB a day for occasional use, divide by 100 for regular use, send a User-Agent, back off 30 s on 429 |
| **Parks Canada "Trails APCA"** | Trails in national parks, historic sites, marine areas | Open Government Licence - Canada | ArcGIS FeatureServer `vw_Trails_Sentiers_APCA_V2_FGP/FeatureServer/0/query?where=...&f=geojson`; also a static GeoJSON | Official alignment, "not necessarily complete", updated weekly | **Fallback 1 for Canada**, and the authority for the official rating |
| **NPS Public Trails** | Public trails in NPS units | US federal data (public domain) | `mapservices.nps.gov/.../NPS_Public_Trails/FeatureServer/0/query?f=geojson`, max 2,000 records a page | Official; restricted segments removed | **Fallback 1 for US parks**; USFS publishes a National Forest System trails layer too |
| **Wanderland Schweiz** (FEDRO, SchweizMobil, cantons) on opendata.swiss | All official Swiss hiking routes | "Open use, must provide the source" | geo.admin.ch REST API, layer `ch.astra.wanderland`; closures are a separate daily dataset | Official, annual update | **Fallback 1 for Switzerland**, and the closures feed for the conditions routine |
| Sépaq (Quebec parks) | Quebec national parks | No open dataset found | Park PDF maps only | Official | **Link only**; geometry from OSM |
| Outdooractive | Strong in the Alps (tourism boards publish there) | Per API project; partner model, reuse terms not published | API key per project and domain | Good, curated | **Link only** unless the owner signs up as a partner (decision D9) |
| Komoot | Global, user routes | API is partner-contract only ("prohibited to use the API without such a contract") | n/a | Mixed | **Link only** |
| Wikiloc | Global, user tracks | Terms forbid bulk download and re-hosting | Manual GPX download by a signed-in user | Mixed | **Link only**; a manually downloaded GPX may be used privately in `research/`, never published |
| Hiking Project (onX) | US | Data API closed to the public since late 2020 | n/a | | **Link only** |
| AllTrails | Global | No API; fetches return 403 | n/a | | **Link only** (search URL or the trail page URL the owner pastes) |
| Strava | Segments and user activities | Not evaluated: user activity data, not trail data | | | **Excluded** |

**Coverage spot-check (Patagonia, 2026-10-17).** Overpass bbox `-49.45,-73.10,-49.20,-72.80` around El Chalten returned eight hiking relations, among them Sendero Laguna de los Tres (r4485261), Senda Laguna Torre (r9051398), Senda Mirador Condores (r9063573), Senda Loma del Pliegue Tumbado (r9095170) and Vuelta al Huemul (r9365907). None carried `sac_scale` at relation level. This is the expected pattern: OSM gives good geometry for popular trails and almost never gives the difficulty or stats we want, so those come from the official or research source and are stored separately.

#### Elevation profiles

| Option | Resolution | Access | Use |
|---|---|---|---|
| WMT `way-elevation` | WMT's own DEM sampling | Free, same request family as the geometry | **Primary** when the trail is an OSM relation; resample to 200 points |
| Open-Meteo Elevation API | Copernicus GLO-90 (90 m) | Free, no key for non-commercial; 100 coordinates per request; attribution to Copernicus and Open-Meteo | **Fallback** for agency or hand-drawn lines: sample the stored line every 50 m (max 400 points = 4 requests) |
| Mapterhorn terrain tiles | Global 30 m (Copernicus), regional LiDAR down to 0.25 m (Zurich), 10 m USA; Terrarium-encoded 512 px PMTiles | Free; BSD-3 code, per-source data attribution | **Map terrain** (MapLibre `raster-dem`, hillshade, 3D on the globe) and, later, a more accurate offline profile computed in `tools/` |

90 m sampling under-reads gain on steep switchbacks. Rule: the displayed **gain is the stated figure from the source** (official first), and the computed gain is shown only on the profile, labelled "computed". If they differ by more than 25%, the build prints a warning, not an error.

#### How a research lane captures a trail

1. `research-trails` writes `research/trips/<slug>/trails.md` as today (claims with URLs), plus one row per trail in a structured block.
2. For each trail it runs `tools/trails.py find --name "Laguna de los Tres" --near -49.33,-72.89` (Overpass bbox search, 5 km box, cached) and records the candidate `osm_relation` with its name, or `null` with the reason.
3. `tools/trails.py fetch <trail-id>` pulls geometry by priority: agency dataset (when `geometry.source` is `parks-canada`, `nps`, `swisstopo`) then WMT relation then a hand-supplied GPX/GeoJSON in `research/trips/<slug>/gpx/`. It writes `data/catalog/trails/geo/<trail id with / as __>.geojson` (simplified) and the profile, and stamps `fetched` and `source_url`.
4. `tools/trails.py check` validates: line length within 15% of stated km (warn), start within 300 m of the trailhead coordinates (warn), the profile present.
5. The trail row in `data/catalog/trails/` is written through the shared operation `trail.upsert` (section 5), never by hand.
6. (Revised 4) `tools/trails.py` network calls (`find`, `fetch`, `refetch`) are owner-run only: never from a test, a hook or a build. Tests use committed GeoJSON fixtures under `tools/tests/fixtures/trails/` and `core/test/fixtures/trails/`.
7. (Revised 4) Once a year, `python3 tools/trails.py refetch --changed` re-reads every stored geometry by `geometry_source` and `geometry_source_id`, writes nothing, and reports each trail whose length changed by more than 5% or whose source relation was deleted; the owner then re-fetches the listed trails. Geometry is never marked stale automatically (freshness table), because OSM relations and agency datasets change without notice and a silent re-fetch could replace a good line with a broken one.

#### Difficulty normalisation: the house scale

Every trail keeps the local grade verbatim (`difficulty.local` = `{system, grade, label, source_url}`) and gets a house grade 1-5 that drives filters and the badge. The house grade is the higher of a **technical** grade (from the local system) and an **effort** grade (from distance and gain), so a long flat walk and a short exposed scramble both read correctly.

| House | Label | Technical meaning | SAC (OSM `sac_scale`) | Parks Canada | Sépaq / Quebec resorts | US agency (NPS, state) | YDS | UK / Scotland |
|---|---|---|---|---|---|---|---|---|
| 1 | Easy | Paved, boardwalk or wide flat path; no exposure | `strolling`, T1 when short | Easy | Facile / Beginner | Easy | Class 1 (flat) | Easy access, Easy |
| 2 | Moderate | Well-marked path, some steep sections, no hands | T1 | Easy (upper) to Moderate | Intermédiaire / Intermediate | Moderate | Class 1 | Moderate |
| 3 | Challenging | Steep, rough or loose; sure-footedness needed | T2 | Moderate (upper) to Difficult | Difficile / Advanced | Strenuous | Class 1-2 | Strenuous |
| 4 | Hard | Long steep sections, rough terrain, possible short hands-on steps, some exposure | T3 | Difficult | Très difficile / Expert only | Strenuous (very) | Class 2-3 | Strenuous, Scramble grade 1 |
| 5 | Alpine | Exposure, scrambling, route-finding, unmarked | T4-T6 | Route | n/a | n/a | Class 3-4+ | Scramble grade 2-3 |

Effort grade, from `effort_km = km + gain_m / 100` (the Swiss "performance kilometre": 100 m of ascent counts as 1 km):

| effort_km | under 6 | 6-12 | 12-20 | 20-30 | over 30 |
|---|---|---|---|---|---|
| Effort grade | 1 | 2 | 3 | 4 | 4 (5 is reserved for technical terrain) |

Worked example: Laguna de los Tres, 21.5 km and 950 m gives effort_km 31 (effort 4); no local technical grade recorded, research says "Hard", so technical 4; house grade **4**. Laguna Capri plus Mirador Fitz Roy, 11.7 km and 390 m gives 15.6 (effort 3); local "Moderate"; house **3**. Senda Costera, 8 km and 70 m gives 8.7 (effort 2); APN "Medium"; house **2**.

When a local grade is missing, technical defaults to null and the house grade equals the effort grade with `difficulty.house_basis = "effort-only"`, shown as a hollow badge. The mapping table lives in `data/schema/difficulty-map.json` so it can be extended (Norway DNT colours green/blue/red/black, NZ DOC, Japan) without code changes.

#### Storage per trail and licensing

| Item | Size | Note |
|---|---|---|
| Geometry, simplified (Douglas-Peucker 5 m, 5 decimal places, about 1 m precision) | 8-25 KB raw for a 5-20 km trail, about a third gzipped | One file per trail: `data/catalog/trails/geo/<trail id with / as __>.geojson` (2.1 file-name rule) |
| Profile, 200 samples `[distance_m, elevation_m]` | about 3 KB | Inside the same GeoJSON as a `properties.profile` array |
| Metadata row | about 1.5 KB | In `data/catalog/trails/<country>.json` |

The Rockies (62 trails) plus Patagonia (22) is about 1.5 MB raw in git. That is acceptable; a repo-size test fails if one geometry file passes 150 KB (resample harder).

Obligations:

| Licence | What we must do |
|---|---|
| ODbL (OSM, WMT) | Visible "© OpenStreetMap contributors" on every map and profile that shows OSM-derived lines (the map attribution control does this when the source declares it); the stored GeoJSON in git is a derivative database, so the repo's `data/catalog/trails/geo/` carries an ODbL notice file and the public `/data/` download of trail lines must stay ODbL. Keep per-file `source` and `source_id` so attribution can be generated. |
| OGL-Canada | Attribution string "Contains information licensed under the Open Government Licence - Canada" on trail pages using Parks Canada lines |
| opendata.swiss "open use, must provide the source" | Source line "Source: FEDRO / SchweizMobil" |
| NPS (US federal) | No obligation; credit anyway |
| Copernicus via Open-Meteo, Mapterhorn sources | Credit line in the profile footer and map attribution |

Mixing an ODbL line and an OGL line in one file is avoided: each geometry file has exactly one source.

### 3B. Component library (Revised 4: pinned versions)

Checked 2026-10-17.

**Default: shadcn/ui (Base UI primitives) + TanStack Table v8 + the shadcn chart component (Recharts), themed with our own tokens.** This is also the recommendation; the alternatives below were weighed and lost on data-grid quality or on Tailwind fit. What the recommendation adds to a stock shadcn start is the theme (section 4.9) and three house components (`EntityGrid`, `MapView`, `ElevationProfile`), so it does not look like every other shadcn app.

| Candidate | Look out of the box | Accessibility | Data table / grid | Maintenance (Oct 2026) | Tailwind and Server Components fit | Verdict |
|---|---|---|---|---|---|---|
| **shadcn/ui** | Plain and generic unless themed; fully restylable because the code is copied in | Base UI or Radix primitives (both WAI-ARIA); Base UI became the default on 3 Jul 2026, Radix still supported, React Aria added as a third base | The "Data Table" recipe is TanStack Table; we own and extend it | Very active | Native Tailwind v4; components are client islands inside RSC pages; no runtime CSS-in-JS, so static export is clean | **Default** |
| HeroUI (ex NextUI) | Most polished default look of the set | React Aria (strong) | Table is presentational; no grouping, no advanced filter; we would still put TanStack under it | Active, MIT, Tailwind v4 | Good; its provider must be a client boundary | Runner-up for look. If adopted: swap primitives and form controls; `EntityGrid` keeps TanStack underneath. Cost: a second component vocabulary next to shadcn recipes the owner already knows from other projects |
| Radix Themes | Handsome, consistent | Radix | No data grid | Slower release cadence than primitives | Ships its own CSS, fights Tailwind utility styling | Rejected |
| Mantine (+ mantine-datatable / Mantine React Table) | Good | Good | Mantine React Table is the most complete free grid of the set (grouping, filters, virtualisation) | Active | CSS Modules, not Tailwind; a second styling system in one app | Rejected on Tailwind fit |
| Park UI / Ark UI | Good | Zag state machines, good | No grid | Smaller community; Panda CSS first | Tailwind preset exists but is secondary | Rejected |
| Tremor | Dashboard look | Radix + Recharts | Simple table | Acquired by Vercel Jan 2025, all components free and open source | Tailwind | Not a base kit. Borrow patterns (KPI tiles, bar lists) for budget and stats only |
| AG Grid Community | Spreadsheet look | Good | Strong core grid, but **row grouping, aggregation and advanced filtering are Enterprise** (paid, about US$1k per developer a year, third-party figure) | Very active | Own theming system; heavy bundle | Rejected: group-by is a stated requirement |
| **TanStack Table v8** | Headless (renders what we render) | Ours to get right (tests below) | Column filters, global filter, multi-sort, grouping, aggregation, column visibility and ordering, faceted unique values and min/max for filter counts, row selection; pair with TanStack Virtual for large lists | Active | Pure logic, works in client islands | **The grid engine under every table view** |

**Accessibility tests that come with this choice** (headless means we own them): axe-core in Playwright on every list view in all four modes; keyboard-only path through the filter bar, the advanced panel, a grid cell and the view switcher; `aria-sort` on sortable headers; focus returns to the trigger after the detail sheet closes; WCAG AA contrast checked against the theme tokens with the gate `legacy/_system/build.py --check` already runs (path after P1b).

**MapLibre GL JS integration.** The globe already vendors MapLibre and uses OpenFreeMap styles. In the app:

| Piece | Decision |
|---|---|
| Package | `maplibre-gl@6.14.0` from npm (the version the globe vendors), imported only inside client components with `next/dynamic` (`ssr: false`) so the RSC page stays static HTML |
| Wrapper | A thin house hook (`useMap`) over the raw API rather than `react-map-gl`, so a MapLibre major upgrade does not wait for a wrapper release |
| Styles | OpenFreeMap `liberty`, `positron`, `dark` (no key); Mapterhorn `raster-dem` for hillshade and 3D terrain |
| Data | GeoJSON sources built at export time (`/data/...json`), so the map reads the same files offline from the cache (4.8) |
| Profile link | `ElevationProfile` (shadcn chart over Recharts, an `AreaChart` of `[distance, elevation]`) and `MapView` share a tiny store (`useSyncExternalStore`); hovering the profile moves a marker along the line, hovering the line highlights the profile point |

**Pinned versions (Revised 4; checked against the npm registry on 2026-10-17).** Briefs install exactly these; a bump is its own PR with the globe and terrain re-tested.

| Package | Version | Note |
|---|---|---|
| Node, pnpm | 22.23.2, 12.4.1 | installed on the owner's machine; `engines` and `packageManager` fields record them |
| `next` | 16.4.2 | static export (`output: 'export'`, `trailingSlash: true`) |
| `react`, `react-dom` | 19.3.1 | |
| `typescript` | 6.0.3 | not 7.0.x: 7 is the native-compiler line and tool support (Next, ESLint plugins) lags; revisit with Phase 2 |
| `tailwindcss` | 4.3.3 | |
| `shadcn` (CLI) | 4.22.0 | `components.json` base `base` (Base UI, `@base-ui/react` 1.9.0); lint rule bans `@radix-ui/*` imports (R16) |
| `@tanstack/react-table` | 8.21.3 | stay on v8: v9.0.0 shipped 2026-08-04 and the shadcn Data Table recipe targets v8 |
| `@tanstack/react-virtual` | 3.14.21 | |
| `maplibre-gl` | **6.14.0** | the version `globe/assets/vendor/VERSIONS.txt` and `GLOBE-RESEARCH.md` record; the globe route uses the same |
| `recharts` | whatever `shadcn add chart` installs, then pinned in the lockfile | |
| `zod` | 4.6.7 | the schema source (2.5) |
| `vitest` | 5.0.5 | unit tests in `core/` and `web/` |
| `@playwright/test`, `@axe-core/playwright` | 1.64.1, 4.14.0 | e2e and accessibility |
| `@modelcontextprotocol/sdk` | 1.32.1 | stdio MCP server (P2b) |
| `idb`, `fake-indexeddb` | 8.0.4, 6.2.6 | drafts (P5b1) and their tests |
| `@dnd-kit/core` | 6.3.1 | board drag-and-drop with the keyboard sensor (P5b2) |

### 3C. Cloudflare: static export, Pages Functions + D1, remote MCP

Checked 2026-10-17.

| Question | Finding | Consequence for this plan |
|---|---|---|
| Does Next.js static export still work, and with what limits? | Yes (`output: 'export'`, docs updated 2026-08-09). Server Components run at build time. Unsupported: dynamic routes without `generateStaticParams` or with `dynamicParams: true`, Route Handlers that read the Request (only `GET` with `dynamic = 'force-static'`), cookies, rewrites, redirects, headers, proxy (ex-middleware), ISR, default image optimisation, Draft Mode, **Server Actions**, intercepting routes | Every route has `generateStaticParams` from `data/`. No Server Actions, so Phase 1 forms cannot save to a server (4.7 explains what they do instead). No intercepting-route modals; the detail card is a client sheet driven by `?focus=`. Images use plain `<img>` with Commons `?width=` URLs (what the pages do today). Legacy URL redirects are files, not `next.config` |
| Next.js 15 or 16? | Next.js 16 shipped 21 Oct 2025 (middleware renamed to `proxy.ts`, deprecated not removed); 16.1 needs Node 20.9+ | Recommend **Next.js 16** (the brief said 15). Nothing in static export changes; starting on 15 means a forced migration within months. Owner decision D2 |
| Pages or Workers for hosting? | Cloudflare now says "we recommend using Workers to deploy your Next.js site" and newer docs point at vinext/OpenNext on Workers; Pages still works and is not deprecated; Pages Free: 20,000 files and 25 MiB per file; Workers static assets: 100,000 files on paid plans since 2 Sep 2025 | **Stay on the Pages project `nks-travel` for Phase 1.** The hostname `nks-travel.pages.dev` is what is shared and bookmarked; a Worker would serve on `*.workers.dev` until a custom domain is bound. Re-evaluate at Phase 2 once the custom domain exists (then the host can move with no URL change) |
| File-count budget | Today: 441 files under `globe/assets/` plus legacy pages (revised 4: was miscounted as 432); the app adds one HTML and one RSC payload per route | Under 2,000 files at Phase 1; a build test fails above 15,000 (headroom under 20,000) |
| Pages Functions + D1 | Pages and Workers use the same `d1_databases` binding; migrations applied with `wrangler d1 migrations apply --remote` before deploy | Workable, but the MCP server is better as a Worker (below), so Phase 2 puts the API in that Worker too, one codebase |
| Remote MCP on Workers | Cloudflare documents `createMcpHandler()` (stateless, Streamable HTTP, fastest path) and `McpAgent` (a Durable Object per session, state and elicitation). Authless and authenticated templates exist. Claude Code connects with `claude mcp add <name> --transport http <url>` | Phase 2: one Worker `nks-travel-api` with Hono routes `/api/v1/*` and `/mcp` (`createMcpHandler`, stateless; our tools need no session state). Both call the same operation functions (section 5). Phase 1 ships a **local stdio MCP** (`web/mcp/` run by Node against the JSON in git) with read tools, so Claude Code can explore before any cloud write path exists |
| Auth for a single owner | Cloudflare Access can protect a hostname or path with email one-time PIN and issue service tokens (headers `CF-Access-Client-Id`, `CF-Access-Client-Secret`) | Writes and `/mcp` sit behind Access. The browser signs in with a PIN; Claude Code uses a service token passed as headers in `claude mcp add --header ...`, the secret kept in the OS keychain, never in Claude settings. The Worker also checks the `Cf-Access-Jwt-Assertion` header itself (defence in depth) |
| D1 to git export | A Worker cron cannot run our Python tests or push to git without holding a GitHub write token | A scheduled **GitHub Action** (nightly, plus manual dispatch) calls `GET /api/v1/export` with a read token, writes `data/`, runs `tools/data.py validate` and the full test suite, and opens a PR `data: D1 export <date>`. Git history stays the audit log and nothing reaches `main` that fails a test. Revised 4: whether D1 is the truth at all is decision D28 (5.6); the recommended design has no export loop |

## 4. Web app information architecture (Revised: 4.11; Revised 3: 4.12; Revised 4: 4.1, 4.7, 4.9, 4.10, 4.13)

### 4.1 Routes (Revised 4)

| Route | What | Data at build | Phase |
|---|---|---|---|
| `/` | Home: upcoming trips with countdown, the next 10 booking deadlines across trips, links to the lists and the globe | `data/trips/*` (public only), `legacy/MANIFEST.json` | P3a |
| `/trips/` | Trips list, four views | public `trip.json` rows plus legacy manifest rows ("legacy page" badge) | P3a (legacy rows), P4c (data trips) |
| `/<slug>/` | Plan page (4.5); same URL as today | `data/trips/<slug>/` | P5a |
| `/<slug>/print/` | Print layout, one day per page | same | P5a |
| `/places/` | Places list, four views (replaces `/locations/`) | `data/locations` | P3a (cards, list, table), P3b (map, advanced panel) |
| `/places/<CC>/<region>/<area>/<place>/` | Place page: map, stats, sources, "part of N plans" | same | P3a |
| `/trails/`, `/trails/<id...>/` | Trails list and trail page (map, profile, badge, source links) | `data/catalog/trails` | P5a |
| `/activities/`, `/stays/`, `/eateries/`, `/offers/` | catalog lists in the four views (4.11) | `data/catalog/*` | P6 |
| `/areas/<CC>/<region>/<area>/` | area guide and coverage (4.11) | `data/catalog/areas`, `coverage.json` | P6 |
| `/backlog/` | research backlog table (owner) | `data/catalog/backlog.json` | P6 |
| `/bookings/` | every booking across trips as a Timeline and the four views | public trips with a chosen edition | P5a |
| `/globe/` | The globe (4.6) | `data/locations`, trips, `web/public/geo/` | P6 |
| `/new/` | the creation flow S0-S9 (0B.2) | catalog views, indexes | P5b1-P5b3 |
| `/edit/?trip=<slug>` | the board for an existing trip; one static page; with `NEXT_PUBLIC_EDITING=off` it explains where editing works and links to `/new/` for browser-only drafts | client-side | P5b2 |
| `/edit/route/?trip=<slug>&days=<a-b>` | routing with breaks (0B.5) | client-side | P8 |
| `/review/` | proposal queue (0A.2), local server only | API | P4b |
| `/plan/new/` | the planner inputs as a standalone entry (same `TripDraft` as `/new/`) | catalog views | P7 |
| `/schema/` | rendered from `data/schema/generated/schema.json` and `ops.json` | generated | P3b |
| `/about/data/` | licences and attribution for every data source (ODbL for the catalog and OSM-derived lines, OGL-Canada, NPS public domain, opendata.swiss, Open-Meteo CC BY 4.0, Copernicus via Open-Meteo, Natural Earth, geoBoundaries per country, Wikimedia Commons per image, Frankfurter/ECB), from `data/reference/licences.json`; the privacy line (what is never published) | generated | P3a |
| `/data/<entity>.json` | Static JSON views per entity (`entity-view/1`), public rows only, `x-private` stripped | build output | P3a |
| `/inbox/` | Capture review queue (section 9) | API only | Phase 2 |

Static export rules applied: every dynamic segment has `generateStaticParams`; no Server Actions, cookies, rewrites or headers; `trailingSlash: true` so `/patagonia-feb-mar-2027/` maps to `.../index.html` as today; redirects are a generated `_redirects` file. Routes that depend on a server (`/edit/`, `/review/`) are single static pages whose client code checks `NEXT_PUBLIC_EDITING` (`local` = talk to `http://localhost:<port>` from `node core/bin/serve.ts`, `hosted` = Phase 2 API, `off` = the deployed default).

### 4.2 One entity contract, four views for free

Every list renders through `EntityPage<T>` and one descriptor per entity. A new entity type (for example `stays` later) gets cards, list, table and map views, the filter bar, the advanced panel, the detail sheet and the forms by writing a descriptor; most of it is generated from the schema's `x-ui` annotations.

```ts
// web/lib/entities/types.ts
export interface EntityDescriptor<Row> {
  type: 'place' | 'trip' | 'trail' | 'activity' | 'stay' | 'eatery' | 'offer' | 'booking';
  schemaId: string;                       // '#/$defs/<table>' in data/schema/generated/schema.json (revised 4)
  dataUrl: string;                        // /data/places.json (entity-view/1)
  id: (r: Row) => string;
  title: (r: Row) => string;
  subtitle?: (r: Row) => string;
  image?: (r: Row) => string | null;
  badges?: (r: Row) => Badge[];           // status, house grade, kid fit, style
  geo: (r: Row) => GeoShape | null;       // point, line (trail GeoJSON url) or bbox (trip)
  facets: FacetDef<Row>[];                // drives the filter bar; generated from x-ui.facet
  columns: ColumnDef<Row>[];              // TanStack columns; generated from x-ui.column
  groupBy: GroupDef<Row>[];               // country, region, area, style, status, trip
  search: (r: Row) => string;             // text the q box matches
  detail: DetailSection<Row>[];           // sections of the detail sheet and page
  ops: { create?: OpName; edit?: OpName; remove?: OpName };   // section 5
}
```

| Shared component | Role |
|---|---|
| `EntityPage` | Reads the URL state, loads `dataUrl`, applies filters once, passes the same filtered rows to whichever view is active |
| `FilterBar` | Horizontal bar on top of every list: search box, chips for active filters, select menus per facet with counts ("Hard (4)"), "Clear all", and the view switcher on the right. On mobile it collapses to search plus a "Filters (3)" button opening a bottom sheet with the same controls |
| `ViewSwitcher` | One segmented control: Cards, List, Table, Map |
| `CardsView` | Image cards (the hub and list-page look today) |
| `ListView` | Dense rows: title, badges, one-line summary, right-aligned key stats |
| `TableView` | `EntityGrid` on TanStack Table: sortable, resizable, column chooser, group-by rows with counts, sticky header, virtualised over 300 rows, CSV and JSON export of the filtered rows, and the **Advanced filter panel** |
| `AdvancedFilterPanel` | Table view only, opened from "Advanced": rows of field + operator + value (operators per type: text `contains`/`is`/`is not`; number `=`, `<`, `<=`, `>`, `>=`, `between`; enum `in`/`not in`; months `includes any`; bool; date `before`/`after`), AND or OR across rows, sort and group-by pickers, **saved views** (named URL states stored in localStorage in Phase 1, in D1 per owner in Phase 2) |
| `MapView` (as a list view) | The filtered rows on MapLibre: points clustered (cluster count, click to zoom), trail rows drawn as lines from their GeoJSON with a difficulty colour, trips as their bounding box or base pins; hover shows a mini card, click opens `DetailSheet`; "Search as I move the map" toggles a bbox filter that lives in the URL |
| `DetailSheet` | One detail card for every view and for the globe; a side sheet on desktop, bottom sheet on mobile; deep-linked by `?focus=<id>`; actions from `ops` |
| `EmptyState` | Never a dead end: shows which chip removed the last rows and offers one-tap loosen (Travel Finder idea, adopted) |

**Facets per entity** (the filters the brief names, all in the URL):

| Facet | URL param | Places | Trips | Trails | Adventures | Bookings |
|---|---|---|---|---|---|---|
| Search | `q` | yes | yes | yes | yes | yes |
| Country, region, area | `country`, `region`, `area` (as in PLAN-locations-g5 2.4) | yes | yes (via countries) | yes | yes (via place) | yes (via trip) |
| Status | `status` | idea, shortlisted, planned, visited, dropped | idea ... travelled | - | verdict | todo ... sold-out |
| Kind / type | `kind` | place kinds | duration_shape, movement_shape (`shape`) | shape | `adv` (adventure type) | category |
| Trip style | `style` | via place_tags of kind style | primary style and style tags | via trips using it | via trip | via trip |
| Trail difficulty | `grade` (`2-4`, house scale) | for kind trail | max grade in plan | yes | - | - |
| Kid fit | `kid` | kid_fit | party_shape | kid_fit per trip | fit verdict | - |
| Season | `season` (months csv) | season_months | season_months | season_months | season_window | used month |
| Tags | `tag` | yes | yes | yes | - | - |
| Trip | `trip` | yes | - | yes | yes | yes |
| Deadline window | `due` (`14d`, `60d`, `overdue`) | - | - | - | - | yes |
| Map bbox | `bbox` | all four views honour it once set from the map | | | | |

Other URL state: `view` (`cards`, `list`, `table`, `map`), `sort`, `group`, `cols`, `f` (advanced conditions, e.g. `f=km.gt.10~gain_m.lt.800~or`), `sv` (saved view name), `focus`, `ids` and `label` (a set handed over from the globe). **Gotcha:** on today's list page `view=grid` means cards. The app calls the views `cards`, `list`, `table`, `map`, and a shim maps a legacy `view=grid` to `cards`; the UI label for the table view is "Table (grid)". Today's list uses the hash (`#country=CA`); the app uses the query string so links are readable, and `/places/` rewrites an incoming hash to the query on load so old globe links keep working.

### 4.3 Look

House theme, not the shadcn default: tokens ported from `legacy/_system/themes/*.css` (P3, generated by `tools/theme_tokens.py`), so each trip keeps its theme (`alpine-snow`, `desert` ...) on its plan page, and the shell uses the hub's identity (deep forest `#14251d`, amber accent `#d69329`, Big Shoulders Display headings, Source Serif 4 body, IBM Plex Mono for data). No purple, no gradients; AA contrast enforced by the existing theme gate. Light and dark both supported; the plan pages default to light for outdoor readability.

### 4.4 Map and trail components

| Component | Contents |
|---|---|
| `MapView` | Base wrapper (3B): OpenFreeMap style, Mapterhorn hillshade toggle, attribution assembled from the sources on screen (ODbL, OGL-Canada, Copernicus) |
| `DayMap` | One per day: the day's items numbered in order, the legs as lines (straight dashed when not routed, solid when a route geometry exists), trail lines coloured by house grade, the base as a bed icon; a Track selector (A/B/C) re-filters what is drawn |
| `TrailMap` | The trail line, start and end markers, the trailhead, km markers every 1 km; `DifficultyBadge` and the stats strip above |
| `ElevationProfile` | Area chart of the stored profile, hover-linked to a marker on `TrailMap`; footer: stated vs computed gain, source and attribution |
| `DifficultyBadge` | House grade 1-5 as a filled pill (hollow when effort-only) plus the local grade text ("4 Hard - APN: Hard"); tooltip explains the scale |
| `RouteStrip` | Road-trip days: item cards connected by leg chips ("75 km, 1 h 10, matrix") |
| `StaticMapFallback` | When WebGL or the network fails: the stored GeoJSON drawn as an inline SVG at build time (no tiles), with coordinates and addresses listed |
| `ExternalLinks` | The link row for a place, item or trail (4.8) |

### 4.5 Plan page spine (`/<slug>/`)

The audit's spine (2.3), rendered from `trip.json`; the edition picker in the hero switches every derived date.

| Phase | Section | Component | Source fields |
|---|---|---|---|
| Open | Hero: image, title, edition dates, countdown, the trip in numbers | `TripHero`, `Countdown`, `NumbersStrip` | trip, editions, derived totals |
| Open | The answer first | `Prose` | `trip.answer_prose` |
| Before you go | Timeline of deadlines T-90 ... day-of, with checkboxes and an "Add to calendar" ICS download (4.13) | `BookingTimeline` | trip_bookings + offers (computed book-by) |
| Before you go | Documents and entry | `DocumentsChecklist` | documents |
| Before you go | Packing | `PackingChecklist` | packing |
| Orient | What this place is, sub-regions, what to know | `Prose`, `RegionCards` | orientation prose |
| Orient | Photo gallery | `Gallery` (lightbox) | `gallery.json` |
| Orient | Bases and route, night split with the defence column | `NightSplit`, `RouteMap` | bases, days |
| Days | Day N sections: theme, date, sun and light, time-chip timeline, Track A/B/C tabs, `DayMap`, weather rule chips, Plan B card, decision rules, day-of links | `DaySection`, `TimeChips`, `TrackTabs`, `WeatherRuleChip`, `PlanBCard`, `DayOfLinks`, `SunTimes` | days, day_tracks, items, weather_rules, derived sun |
| Reference | Trails (table plus maps), Adventures with limits and fit, Where to stay, Budget, Hazards, Gotchas | `TrailTable`, `AdventureTable`, `StayTable`, `BudgetTable`, `HazardList`, `GotchaList` | trip_trails + trails, trip_activities + activities + offers, bases + stays, budget + fx, hazards, gotchas |
| Reference | Emergency per base | `EmergencyCards` | emergency |
| Close | State of knowledge, open questions, change log | `KnowledgeTable`, `QuestionList`, `ChangeLog` | knowledge, questions, changelog |

Sticky day navigation with scrollspy, and "today mode" (when the date is inside the chosen edition the page opens on today's day with its sun times and forecast link at the top).

### 4.6 Globe route

`/globe/` ports today's `legacy/globe/index.html` into a client component with the same look (MapLibre globe projection, OpenFreeMap styles, admin TopoJSON drill-down country > ADM1 > ADM2, the gazetteer search) and the same hash parameters (`c`, `s`, `d`, `p`, `style`, `spin`, `terrain`, `pins`). Additions: an entity switch (places, trips, trails), pins coloured by `status` or by `style` (a legend toggle), and the list filters (`q`, `country`, `style`, `status`, `kid`, `grade`, `season`, `tag`) read from the query string so "show me these on the globe" from any list keeps its filter. A pin click opens the same `DetailSheet` as the lists. The geo assets move from `legacy/globe/assets/` to `web/public/geo/` (written by `tools/globe_data.py`). Parity test: the same set of drill paths and the same pin counts as the legacy globe for the same data, checked against a committed fixture of 10-20 hashes captured from the legacy globe before P6 starts (revised 4).

### 4.7 Creating and editing in the UI (Revised 4: editing flag)

Revised 4: the forms below are the item and booking sheets inside the board (4.12); the old four-step wizard is replaced by `/new/` (0B.2). Whether the board can save is an explicit build flag, `NEXT_PUBLIC_EDITING=local|hosted|off`, not the presence of an API origin.

Forms exist for place, trip, day, item, trail, adventure and booking. They are generated from the schema (field types, enums, required, help text and messages from `x-ui`) and submit **operations**, never raw rows (section 5), so a form cannot write anything a skill could not.

| Flow | Steps |
|---|---|
| New place | Name and an optional URL or caption; "Resolve" calls `place.resolve` (Wikidata then Nominatim) and shows candidates with their parent chain on a mini map; pick one; fill kind, status, season, kid fit, tags (typeahead over the vocabulary, aliases resolved), stats; Save calls `place.add` |
| New trip | Wizard of four short steps: 1 what and where (title, countries, primary style, extra style tags, duration and movement shape); 2 who (travellers with ages, the profile: pace, comfort, weather tolerance, hiking ceiling, kids mode); 3 when (season months; optional editions); 4 adopt saved places (a picker over `/places/` filtered to the countries chosen). Save calls `trip.create`; the trip opens in the editor with a lane suggestion (7.3) |
| Edit a day | The day editor shows the timeline as cards; drag to reorder (`seq`), "Add item" (type first, then the fields that type needs), legs edited inline between cards with a "Fetch drive time" button (Phase 2, cached); the day-check panel on the right updates on every change; Plan B items are edited in a Plan B lane under the timeline |
| Add trail | Search the catalogue first; otherwise paste an OSM relation id, a Waymarked Trails URL or upload a GPX; `trail.upsert` fetches geometry and profile (Phase 2 runs it in the Worker; Phase 1 queues it for `tools/trails.py fetch`) |
| Add adventure or booking | One combined form: the activity plus its booking product (provider, links, price with read date and currency, limits, opening rule, sell-out, terms); the computed book-by is shown live |

**Validation messages.** Errors (schema and structural rules) appear inline under the field and block Save: "Distance must be a number of kilometres, for example 11.7", "This place id already exists: CA/QC/charlevoix/le-buton. Open it instead?", "Night 5 is covered by two bases: El Chalten and El Calafate". Warnings (day checks, freshness) appear in the side panel and on Save as a summary, never blocking: "Track A runs 11 h 20; pace 3 allows 9 h. Accept for this day?" Every message carries a code (`E_FK`, `W_PACE`) so the same text is used by the CLI, the API and MCP.

**Draft and publish.**

| Mode | Where edits go | What the public site shows | Publish |
|---|---|---|---|
| Phase 1, on the owner's machine (`NEXT_PUBLIC_EDITING=local`) | `node core/bin/serve.ts` runs the file-backed API on localhost; operations write `data/**` in the working tree, the same validators run, the PostToolUse-equivalent check runs inline | the last deploy, built from git | commit (the editor offers "Commit these changes" with a generated message listing the operations), then `./publish.sh` |
| Phase 1, the deployed static site (`off`) | `/edit/` explains that editing an existing trip works on the owner's machine or after Phase 2; `/new/` works fully in the browser with IndexedDB drafts and Download/Import (0B.2) | the last deploy | - |
| Phase 2 (`hosted`) | the hosted API writes (D28 decides whether to git or to D1) | the last deploy, built from git | "Publish" runs the export action (git PR from D1, tests, merge, deploy). A trip page shows "Unpublished edits since <date>" in the editor only |

### 4.8 Embeds and links, per provider

Everywhere a place, item, trail or route appears, the row shows our map first, then the link row. Rule: **embed only what loads without our key in a static page or with a referrer-restricted key, and always render the outbound link too.**

| Provider | Embed or link | Key or account | Offline | Notes |
|---|---|---|---|---|
| Our MapLibre map with stored GeoJSON | Embed (primary) | none | lines, items and profile work from the cache; basemap tiles only if cached | 4.9 |
| Google Maps Embed API (place mode per place, directions mode per day) | Embed, lazy, behind a "Show Google map" button | API key required (Maps Embed API is free and unlimited); restrict by HTTP referrer to `nks-travel.pages.dev` and the future custom domain; the key ships in the page | none | Minimum size 200 x 200; may show ads. Directions mode waypoint limits to be verified in P5a |
| Google Maps link (`https://www.google.com/maps/search/?api=1&query=lat,lon`) and directions (`/maps/dir/?api=1&origin=&destination=&waypoints=`) | Link | none | opens the native app, which may have its own offline area | Every item and every day; the day link chains the items in order |
| OpenStreetMap | Link (`openstreetmap.org/relation/<id>` for trails, `?mlat=&mlon=#map=16/` for points) | none | - | |
| Waymarked Trails | Link (`hiking.waymarkedtrails.org/#route?id=<rel>`) | none | - | Our line comes from its API (3A) |
| AllTrails | Link only | - | - | No API, fetches 403 |
| Official park page | Link | - | - | Always shown first in the row when present |
| Komoot, Outdooractive, Wikiloc | Link by default; their own share-embed iframes may be enabled per trail only after P5a verifies the embed terms | none for public tours | none | Partner APIs not used (3A) |
| Wikimedia Commons photos | Embed (`Special:FilePath` with `?width=`) with the attribution line | none | cached when the trip is saved offline | the gallery pipeline already verifies licences |
| YouTube | Embed via `youtube-nocookie.com`, click-to-load | none | none | for video research the owner wants on the page |
| Instagram, Facebook, TikTok posts | Link only | oEmbed needs a Meta app token | - | screenshots from the inbox are research and never published |

### 4.9 Offline and print (Revised 4)

Trip pages are used at trailheads with no signal. The static export already gives a self-contained HTML page per trip; on top of that:

| Measure | How |
|---|---|
| "Save this trip for offline" | A hand-written service worker (`web/public/sw.js`, no framework plugin) precaches on request: the plan page HTML and its RSC payload, the app shell JS and CSS, the self-hosted fonts (`web/public/fonts/`, 4.13), `/data/trips/<slug>.json`, every trail GeoJSON the trip uses, the spatial-index files `/data/index/geo/<gh3>.json` for every geohash-3 cell the trip's bounding box touches (revised 4), gallery thumbnails at `?width=480` capped at 60 images, and the basemap vector tiles for each day's bounding box at zooms 10-14, capped at 1,500 tiles per trip (about 20-40 MB; the button shows the size). The cap protects the free OpenFreeMap service; the cache name carries the build id so a new deploy refreshes it |
| Without cached tiles | `DayMap` falls back to the stored GeoJSON on a blank background (MapLibre renders lines and points with no basemap), then to `StaticMapFallback` (build-time SVG). **Expected experience (revised 4):** a 30 x 30 km day box is about 200 tiles at zoom 14 alone (inference), so any multi-day mountain trip passes the 1,500-tile cap; the worker then caches zooms 10-12 for every day and 13-14 only around the trailheads until the cap, and the page says "Basemap saved for N of M days; trail lines and stops work everywhere". Lines, pins, profiles, addresses and checklists working offline is the promise; a full basemap is not |
| Always offline | Item addresses and coordinates as text, "Copy this day's addresses", tel links, the emergency block |
| Phone map apps | Per day and per trip GPX and KML downloads generated at build (`/<slug>/assets/day-04.gpx`), the existing practice; Organic Maps or Gaia then work fully offline |
| Checklists and booking ticks | localStorage, keys and migration in 4.10 |
| Install | `web/public/manifest.json` (name, short name, theme colour from the shell tokens, `display: standalone`, start URL `/`, icons 192 and 512 px plus a maskable icon) so "Add to Home Screen" opens the saved trip full screen (P5a) |
| Offline test harness | Playwright: load the plan page, press "Save for offline", wait for the worker's `cached` message, `context.setOffline(true)`, reload; assert the page, every `DayMap` line (GeoJSON source has features), the checklists, the self-hosted font (`document.fonts.check`) and the emergency block render; tile requests are not asserted (OpenFreeMap is never called in tests: the test routes `tiles.openfreemap.org` to a 404) |
| Print | `/<slug>/print/`: one day per page, maps replaced by images captured from the canvas on `beforeprint` (or the SVG fallback), links printed as short URLs, QR code per day linking to the Google directions URL |

### 4.10 Feature parity with today's pages (Revised 4: storage keys)

| Current feature | Where it lives today | New component or field |
|---|---|---|
| Chronological day-by-day with time chips | hand-written sections; `_system` day components in newer pages | `DaySection` + `TimeChips` from `items` |
| Optional stops | "(optional)" text | `items.optional` |
| Stay per night with check-in dates | night-split table in PLAN.md and page | `NightSplit` from `bases` (check-in = `night_from`, resolved by edition) |
| Road-trip stops in order with drive legs | Quebec, Vermont, Iceland, USA pages (prose and tables) | `RouteStrip` from `items.leg_*` |
| Per-day embedded map | Google Maps iframes and links in some pages | `DayMap` plus the Google embed button and directions link (4.8) |
| Day-of links block | page-level block (audit says move it per day) | `DayOfLinks` from `days.day_of_links` |
| Sticky day navigation with scrollspy | `base.js` scrollspy | `DayNav` (IntersectionObserver) |
| A/B plan toggle | `base.js` `setPlan` with `data-plan-btn` | edition picker (Window A/B) when the difference is dates; `TrackTabs` and `PlanBCard` when it is the day plan |
| Plan B cards | prose | `PlanBCard` from track `P` items and `days.plan_b_*` |
| Track A/B/C | Rockies and Patagonia | `day_tracks` + `TrackTabs` |
| Decision rules, weather rule chips | prose; chips proposed by the audit | `days.decision_rules`, `WeatherRuleChip` from `weather_rules` |
| Checklist with persistence | `base.js` checklist (localStorage) | `PackingChecklist`, `DocumentsChecklist`, `BookingTimeline` ticks; keys and the one-time migration below |
| Countdown | `base.js` countdown with `trip-date` meta | `Countdown` from the chosen edition |
| Sun and light times | per-trip `sun-times.py`, `dark-times.py`, `research/sun.md` | `SunTimes` from `core/src/sun/` per edition (revised 4); `days.sun_note` for light guidance |
| Bookings and deadlines table | PLAN.md table | `BookingTimeline` (primary) and the bookings table view |
| Hazards | list | `HazardList` |
| Gotchas | list | `GotchaList` |
| State of knowledge | table in newer plans | `KnowledgeTable` |
| Open questions | list | `QuestionList` |
| Change log | list | `ChangeLog` from `changelog` |
| Photo gallery with lightbox | `gallery.py inject`, lightbox JS | `Gallery` from `gallery.json` |
| Trail table with AllTrails and official links | tables | `TrailTable` + `ExternalLinks` + `TrailMap` |
| Adventures with limits | tables | `AdventureTable` with fit per traveller |
| Budget | table | `BudgetTable` with FX stamp |
| Trip meta for the hub (`trip-date`, `trip-dates`, `trip-duration`, `trip-region`) | `<meta>` tags scraped by publish | read from `trip.json` directly; meta tags still emitted for any external scraper |
| Hero image and credit | hero block | `TripHero` |
| Theme per trip | `_system/themes/*.css` | theme tokens per trip (`trip.theme`) |
| Print stylesheet | `base.css` print rules | `/<slug>/print/` |
| KML/CSV/GPX downloads | `assets/` | generated downloads per trip and day |

**localStorage keys (revised 4).** What the legacy pages store today (`legacy/_system/base.js:55-136`, verified 2026-10-17):

| Key | Value | Set by |
|---|---|---|
| `<slug>:<checkbox id>` | `"1"` or `"0"` | checklist boxes (`#checklist input[data-k]` and `[data-ck]`); `<slug>` is `body[data-slug]`, else the path with slashes removed |
| `<data-ck-legacy prefix><id>` | `"1"` or `"0"` | read-only fallback for three older pages: `ch27-` (Switzerland), `dolo27-` (Dolomites), `qc26-` (Quebec) |
| `<slug>:plan` | the A/B plan id | `setPlan` |

App keys: `travel:v1:<slug>:check:<id>`, `travel:v1:<slug>:edition` (replaces `:plan` where the A/B toggle was a date window), `travel:v1:prefs` (units, currency, theme), `travel:v1:views` (saved views), `travel:v1:<slug>:migrated`. Migration rule: the P4c import writes `data/trips/<slug>/legacy-keys.json` mapping each legacy checkbox id to the new item, packing or booking id; the first time the app's plan page loads for a slug without `travel:v1:<slug>:migrated`, it copies every mapped legacy value (trying `<slug>:<id>`, then the `data-ck-legacy` prefix) to the new key, then sets `migrated`. Legacy keys are never deleted, so returning to a legacy page (rollback) keeps the ticks. The same origin (`nks-travel.pages.dev`) serves both pages, so the storage is shared. A unit test covers the mapping and the no-overwrite rule (a new key that already has a value wins).

### 4.11 Revised: catalog browsing, coverage and the builder UI (Revised 4: phases)

| Route | What | Phase |
|---|---|---|
| `/activities/`, `/stays/`, `/eateries/`, `/offers/` | catalog lists in the four views, each from a descriptor (4.2); facets add `comfort`, `price_tier`, `adventure_level`, `accessibility`, `fresh` (fresh, aging, stale) and `review_status` (raw, proposed, verified, stale) | P6 |
| `/areas/<CC>/<region>/<area>/` | area guide: summary, best months, getting there, hidden gems, coverage band and per-type counts, the area's backlog (owner) | P6 |
| `/plan/new/` | the no-AI builder (0A.5): inputs, sliders, live counts, the draft preview with explanations; "Save draft" stores the trip in the browser (Phase 1) or D1 (Phase 2); "Open in editor" | P7 (v1, 0A.5) |
| `/review/` | the proposal queue (0A.2): grouped by area and entity, each change with its diff, sources and "accept", "reject", "edit then accept" | P4b (local), Phase 2 (hosted) |
| `/backlog/` | the research backlog as a table view (owner) | P6 |

UI rules added by the catalog:
- Every catalog row in a detail sheet shows provenance in one line ("Verified 13 Oct 2026 by agent:research-adventure from the operator page; price read 13 Oct 2026") and a freshness badge on fast-expiring fields.
- Editing a catalog fact from a trip asks once: "Change it for everyone" (`catalog.edit`, attributed) or "Only for this trip" (`override`).
- A "Report outdated" action on any field creates a backlog item with reason `stale`.
- Coverage bands appear on area pages, in the builder before it plans, and as a globe layer.

### 4.12 Revised 3: trip creation routes and components (Revised 4: routes)

| Route | What | Phase |
|---|---|---|
| `/new/` | the creation flow S0-S9 (0B.2) | P5b1-P5b3 |
| `/edit/?trip=<slug>` | the same `DayBoard` and `BoardMap` for an existing trip (replaces the editor of 4.7, whose forms remain as the item and booking sheets); revised 4: one static page instead of `/<slug>/edit/` | P5b2 |
| `/edit/route/?trip=<slug>&days=<a-b>` | routing with breaks for a day range (0B.5) | P8 |

| Component | Role |
|---|---|
| `StartChooser`, `AreaPicker`, `WhenPicker`, `PartyEditor`, `StyleAndPace`, `TransportAndBases` | S0-S5, each writing to one `TripDraft` state and the match counter |
| `MatchCounter` | live counts after every answer (rows matching, eligible for the youngest, open in the month) |
| `CandidatePicker` | `EntityPage` in picking mode: checkboxes, drag-to-day, "Add ticked" |
| `DayBoard`, `DayColumn`, `ItemCard`, `LegChip`, `BaseSlot`, `UnscheduledTray` | S7; drag and keyboard moves; pins for hand-placed items |
| `BoardMap` | `MapView` bound to the board: day colours, numbered pins, click-to-add, drag-route, fit-to-day |
| `UniversalSearch` | 0B.3: catalog, near here, along my route, Overpass on demand, add as custom |
| `NotesPanel` | 0B.4 |
| `BreakPlanner` | 0B.5: waypoints, break interval, daily limit, corridor slider, break-type chips, ranked suggestions, overnight suggestions, cautions |
| `GuardrailBanner`, `FixMenu` | 0B.7 |
| `UndoBar` | undo, redo, version list |
| `BookingsAndCosts`, `ReviewAndSave` | S8, S9 |

The 4.7 rule stands: every action submits operations, so the board writes exactly what the skills write.

### 4.13 Product basics (new in revision 4)

Things a public site needs that revisions 1-3 never mentioned. Each row names the phase that builds it and the test that holds it.

| Need | Design | Phase | Test |
|---|---|---|---|
| Visibility filtering of the export | 1.3: `public` built and listed, `unlisted` built but unlisted, `private` never built; `x-private` stripped by a generated allow-list | P3a (lists and `/data/`), P5a (plan pages) | privacy test with sentinel fixtures (1.3) |
| Licences and attribution | `/about/data/` from `data/reference/licences.json`; every map shows its attribution control; each data download links back to `/about/data/` | P3a | a test asserts every `licence` value used in `data/` has an entry in `licences.json` |
| Sharing previews | `og:title`, `og:description`, `og:image` (the hero at `?width=1200`), `og:url` and canonical from `SITE_ORIGIN` (14), `twitter:card = summary_large_image`; lists use the hub image | P3a (shell and lists), P5a (plan pages) | a test parses every exported HTML for the four OG tags and fails on a missing one or on a hard-coded host |
| Install and offline | `manifest.json` and icons; service worker (4.9); fonts self-hosted in `web/public/fonts/` (Big Shoulders Display, Source Serif 4, IBM Plex Mono, all SIL OFL; licence files beside them) so offline pages do not fall back to system fonts | P5a (manifest, worker); P3a (fonts, because the shell uses them first) | offline harness (4.9); a test fails if exported HTML references `fonts.googleapis.com` |
| Calendar export | `/<slug>/assets/<slug>.ics` built for the chosen edition: one all-day event per booking book-by date ("Book by: Piratour"), check-in and check-out per base, one all-day event per day with its title; `UID` = `<slug>-<row id>@nks-travel`, `DTSTAMP` = build date, so re-imports update instead of duplicating | P5a (`web/lib/exports/ics.ts`) | snapshot test of the Patagonia ICS; line folding at 75 octets; validates with a strict parser in the test |
| Units and currency | data stored metric (2.1); a preference `travel:v1:prefs` with `distance: km or mi`, `elevation: m or ft`, `temperature: C or F`, `currency` (display only, converted through `fx` with the "ECB rate of <date>" line); default from the browser locale (`en-US` gets imperial) | P3a (preference and formatting helpers in `web/lib/format/`), P5a (plan pages use them) | unit tests for every formatter, including rounding rules (km to one decimal, mi to one decimal, m and ft to the nearest 10) |
| Time zones | 2.1 zone rule; every displayed time shows its zone abbreviation when the trip spans more than one zone; sun times computed per base zone | P2b (rule in day checks), P5a (display) | Patagonia day 0 (Toronto departure, overnight flight) fixture |
| Analytics | Cloudflare Web Analytics (free, cookie-less, no consent banner needed): one beacon script in the app shell when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set at build; never on legacy pages (byte-identical rule); owner enables it in the dashboard (D30) | P3a | test: the beacon appears only when the variable is set |
| Performance budget | per-route JS budget measured on the export: the gzipped size of every script referenced by an HTML file at load (dynamic imports excluded) must be at most 200 KB for list pages and 250 KB for a plan page before the map island; MapLibre (about 800 KB) loads only through `next/dynamic`; LCP target 2.5 s on a mid-range phone, checked by hand with Lighthouse in P5a, not enforced | P3a (test), P5a (plan page) | `web/tests/budget.test.ts` parses `web/out/**/index.html` and sums gzipped script sizes |
| Backups and recovery | `data/` and `research/` are in git (the GitHub remote is the backup; push after each verified commit, house rule); deploys: Cloudflare Pages keeps every deployment and can roll back from the dashboard; a browser-only draft: Download trip.json (0B.2) is the backup, and S9 warns when a draft has not been downloaded since its last 20 operations; Phase 2: the git-backed design (D28) keeps git as the backup, or, with D1 as truth, D1 Time Travel plus the export (retention to be checked in the Phase 2 plan) | P5b1 (download warning); Phase 2 | download warning test |
| Error monitoring | Phase 1: none at run time (static pages, owner-only edits); build and test failures are the signal. Phase 2: a `window.onerror` and `unhandledrejection` beacon posting `{message, stack, route, build_id}` to a Worker endpoint that logs to Workers Logs, rate limited per IP | Phase 2 | |
| Accessibility | 0B.6 rules (reduced motion, text equivalents, focus, `lang`), axe in Playwright on every route, keyboard paths | every UI phase | axe suite, keyboard suite |
| Offline expectations | 4.9: lines, pins, profiles, addresses, checklists, fonts and the trip's spatial index work offline; the basemap usually does not, and the page says so | P5a | offline harness |
| Browser state migration | 4.10 keys and rule | P5a | unit test |
| Browser-only drafts | Download and Import trip.json (0B.2) | P5b1 | round-trip test: download, import into a fresh context, identical document |

## 5. One operation set: UI, API, MCP, skills (Revised 3: 5.8; Revised 4: 5.1, 5.2, 5.6)

### 5.1 The rule (Revised 4: phases)

Every change to `data/` is an **operation**: a named, schema-validated input that produces a validated new state, a changelog row and a list of warnings. Operations are defined once and reached four ways:

| Path | Caller | Transport | Phase |
|---|---|---|---|
| UI forms | the owner in the browser | `POST /api/v1/ops/<name>` to the localhost file server (Phase 1) or the Worker (Phase 2); a browser-only draft applies the same functions in memory | P5b / Phase 2 |
| HTTP API | anything | same endpoint | P4a (local) / Phase 2 |
| MCP | Claude Code and other agents | tools generated from the operation catalogue; stdio locally (read-only) in Phase 1, Streamable HTTP on the Worker in Phase 2 | P2b read / Phase 2 write |
| Skills writing in git | Claude Code skills | the ops CLI: `node core/bin/ops.ts <name> --input <file or ->` | P4a |

### 5.2 Where each part lives (Revised 4)

| Part | Location | Notes |
|---|---|---|
| Operation catalogue (name, summary, input and output schema, tables touched, read or write, phase, MCP tool name) | `core/src/ops/catalogue.ts`, exported to `data/schema/generated/ops.json` | input schemas reuse the entity Zod schemas, so a field change propagates everywhere (P2b writes the catalogue; P4a the logic) |
| Operation logic | `core/src/ops/` (pure functions `(dataset, input, actor) => {next, changelog, warnings, inverse}`) | one implementation; `inverse` feeds undo (0B.2). Storage is an adapter: `FileStore` (reads and writes `data/**`), `MemoryStore` (tests and the browser draft), `D1Store` or `GitStore` (Phase 2, D28) |
| Validation | Zod (input) and `core/src/validate/` (state) and `core/src/checks/` (day checks) | one implementation (1.5); no Python validator |
| Ops CLI | `core/bin/ops.ts` (`node core/bin/ops.ts <name> --input <file or ->`) over `FileStore` | what skills call |
| Local API server | `core/bin/serve.ts` (localhost only, same routes as the Phase 2 Worker) over `FileStore` | lets the board save in Phase 1 (`NEXT_PUBLIC_EDITING=local`) |
| MCP server | `core/bin/mcp.ts` (stdio, read tools, P2b); Phase 2 `api/src/mcp.ts`; both register tools from `ops.json` | never drifts: the tool list, input schemas and descriptions are generated |
| Worker | `api/` (Hono), imports `@travel/core` | Phase 2 |
| Place capture | `tools/locations.py` stays the implementation of `place.*` in Phase 1 (109 tests, Wikidata/Nominatim resolver); the ops CLI delegates `place.*` to it with `python3 tools/locations.py ... --json` | the single remaining parity pair (1.5); Phase 2 ports `place.*` to TS and runs the 109 tests' cases through the CLI against both before switching |

### 5.3 Operation list

Reads are open in Phase 1 (they read the JSON in git or the built `/data/*.json`); writes need the owner (5.5).

| Operation | Input (summary) | Effect |
|---|---|---|
| `schema.list_types` | - | entity types with counts and schema ids |
| `schema.get` | `type` | the exported JSON Schema of the table, with its `ui`, `private`, `sql` and `rules` metadata |
| `ops.list`, `ops.describe` | `name?` | the catalogue entry |
| `rows.query` | `type`, `filter` (the URL filter grammar of 4.2 as JSON), `sort`, `fields`, `limit`, `cursor` | rows from `entity-view/1` |
| `trip.get` | `slug`, `edition?`, `resolve: bool` | the trip; with `resolve`, real dates, ages, book-by dates, sun times |
| `place.get`, `trail.get` | `id`, `geometry: bool` | row, with derived "part of N plans" |
| `search` | `q`, `types?` | grouped hits across entities |
| `bookings.due` | `within_days`, `trip?` | the cross-trip Timeline |
| `place.resolve` | `name`, `hint` (country, region, coordinates) | candidates with parent chains (external lookup, no write) |
| `place.add`, `place.edit`, `place.visit_add` | as `locations.py add/edit/visit add` | locations rows, sources |
| `tag.add`, `tag.alias` | `id`, `label`, `kind` / `alias`, `canonical` | vocabulary |
| `trip.create` | trip, profile, travellers, tags, optional editions | new `data/trips/<slug>/` |
| `trip.update` | patch of trip, profile, travellers | |
| `trip.adopt_place` | `slug`, `place_id` | sets the place's `trip` and status `planned`; adds a stop candidate to the trip's research queue |
| `edition.add`, `edition.update`, `edition.choose` | edition row / patch / `id` | revised 4: `edition.update` stores `conditions_trigger` (section 13) |
| `base.set` | the night split | bases rows (validated cover) |
| `day.add`, `day.update`, `day.swap`, `day.remove` | day row / `a`, `b` | renumbers items' `day` on swap |
| `item.add`, `item.update`, `item.move`, `item.remove` | item row / `id`, `seq`, `track` | keeps `seq` contiguous |
| `track.set` | day track row | |
| `trail.upsert` | catalogue row; optional `osm_relation`, `gpx` upload | catalogue row; queues or runs geometry fetch |
| `trail.link` | `slug`, trip_trails row | |
| `trip_activity.set`, `trip_booking.upsert`, `trip_booking.set_status` (revised 4: replace `adventure.upsert` and `booking.upsert`; the product side is `catalog.add`/`catalog.edit` on activities and offers) | rows | book-by recomputed |
| `hazard.upsert`, `weather_rule.upsert`, `budget.upsert`, `document.upsert`, `emergency.upsert`, `question.add`, `question.answer`, `knowledge.add`, `gotcha.add` | rows | |
| `fare.add_window`, `fare.add_quote` | section 11 rows | budget rows can reference them |
| `research.add_ref` | `path`, `lane`, `title` | research_refs row, sidecar indexed |
| `research.propose` | `slug`, `refs?` | a **proposal** (5.4), no write |
| `trip.import` | `slug`, `plan_md`, `research_paths` | a proposal that creates the whole trip |
| `proposal.apply`, `proposal.reject` | `proposal_id`, `change_ids?` | applies the chosen changes as their operations |
| `inbox.add`, `inbox.resolve`, `inbox.dismiss` (Phase 2) | section 9 | |

Every write returns `{ok, changed: [ids], warnings: [{code, message, where}], changelog_seq}` and accepts `client_op_id` (idempotent retry) and `expected_rev` (optimistic concurrency: the trip's `rev` in D1, the file's hash in git mode). A mismatch returns `409 E_STALE` with the current rev.

### 5.4 Proposals: how imports and re-synthesis avoid silent changes

`trip.import` and `research.propose` never write. They return a proposal: an ordered list of changes, each one operation with its input, a human summary, a before/after diff of the affected rows and its provenance (`research_ref`, `source` ids, the sidecar fact keys it came from). The proposal is stored as `data/trips/<slug>/proposals/<id>.json` (git mode) or a D1 table (Phase 2) and reviewed in the editor's "Proposed changes" panel, or applied by a skill with explicit ids. Applying runs the referenced operations, so the result is identical to doing them by hand.

### 5.5 Auth (Phase 2, single owner)

| Surface | Protection |
|---|---|
| Public pages and `/data/*.json` | none; the export contains only allow-listed, non-private fields |
| `/edit/`, `/inbox/`, `/api/v1/ops/*`, `/api/v1/export` (the page is public; the API calls behind it are protected) | Cloudflare Access application, owner email one-time PIN |
| `/mcp` | Cloudflare Access service token; Claude Code adds it with `claude mcp add travel --transport http https://<api-host>/mcp --header "CF-Access-Client-Id: ..." --header "CF-Access-Client-Secret: ..."`; the secret comes from the keychain into the shell, never into a Claude settings file |
| The Worker itself | verifies the `Cf-Access-Jwt-Assertion` JWT on every write (do not rely on Access alone) |
| iOS Share Sheet endpoint (section 9) | a separate Access service token stored in the Shortcut, scoped to `inbox.add` only |

### 5.6 Keeping git JSON and D1 consistent (Revised 4: decision D28)

**Revised 4.** Phase 1 is unchanged: git is the truth, every write is an operation, hooks validate. For Phase 2 two designs are on the table, and the choice (D28) must be made before the Phase 2 plan is written, not inside it.

| | A. Git-backed writes (recommended) | B. D1 as the truth with a nightly export PR (revisions 1-3) |
|---|---|---|
| Write path | the Worker runs the operation and the validator, then commits the changed files through the GitHub API (one commit per operation or per 10-second batch, message lists the operations, `expected_rev` = the file's blob SHA) | the Worker writes D1; a nightly Action exports D1 to a PR |
| Sources of truth | one (git) | two, up to 24 hours apart |
| D1 | a read index rebuilt from git on each push (or not needed at all for one owner) | the truth |
| Latency of a write | 2-5 s (GitHub API round trips) | milliseconds |
| Concurrency | one writer at a time per file (409 on a stale SHA, the client retries with a rebase of its operation) | row-level, many writers |
| Machinery removed | export Action, `data/.mode`, `diff-d1`, the `D1-Export` trailer, the second service token | none |
| Failure modes | GitHub API outage blocks writes (the browser queues operations, 0B.2 autosave); a token with `contents: write` on one repo lives in the Worker | a red export PR leaves the public site days behind; a 409 in the git-to-D1 job has no resolution procedure; the owner's local server can write files the hook now rejects |
| Fits | one owner and a few family editors (D17 today) | a multi-user product with concurrent editors |

Recommendation: **A** while D17 says "personal tool"; revisit B only if D17 becomes "product". Either way the three write paths stay joined: an operation applied through the CLI, through the local API, and through MCP `apply_operation` in Phase 2 must produce identical files (a Phase 2 test). The table below is design B, kept as the reference if B is chosen.

| | Phase 1 | Phase 2 (design B) |
|---|---|---|
| Source of truth for `data/` | **git** (files) | **D1** for structured data; git holds snapshots and the history |
| Prose (`prose/*.md`) | git | D1 `prose` table (Markdown text); exported to the same paths |
| Research (`research/**`) | git only | git only (raw files are never in D1; D1 stores `research_refs` and indexed sidecar facts) |
| Who writes | ops CLI, local API, `locations.py` | the Worker (UI, API, MCP); skills switch from the CLI to MCP for data writes |
| Guard | PostToolUse hook validates every Claude write to `data/**` | `data/.mode` contains `d1`; the hook then **rejects** direct file writes to `data/trips/**` and `data/locations/**` and tells the agent to use MCP |
| D1 to git | - | nightly GitHub Action: `GET /api/v1/export` (whole dataset, deterministic JSON in the D13 format), write `data/`, run `node core/bin/validate.ts --all` and all tests, open and auto-merge a PR `data: D1 export <date> rev <n>` when green; red leaves the PR open and opens an issue |
| git to D1 | - | only for deliberate file edits merged to main (for example a schema migration): an Action runs `node core/bin/ops.ts diff-d1`, which turns the diff into operations with `expected_rev` and applies them; any 409 fails the run. Export commits carry the trailer `D1-Export: <rev>` and are skipped, so the two jobs cannot loop |
| Schema migrations | `node core/bin/migrate.ts` on files (2.5 versioning policy) | the same migration file generates the D1 SQL (`api/migrations/NNNN_*.sql`) and the JSON rewrite; both are applied in one release |

### 5.7 MCP tools

Generated: each operation in `ops.json` may carry `"mcp": {"tool": "<name>", "phase": 1|2}`. Both servers loop over the catalogue and register each tool with the operation's summary as the description and its input JSON Schema as `inputSchema`. A test snapshots the registered tool list and asserts every schema is byte-equal to the generated one, so UI, API and MCP cannot drift. The repo's `.mcp.json` registers the Phase 1 stdio server for Claude Code.

| Tool | Operation | Phase |
|---|---|---|
| `list_entity_types` | `schema.list_types` | 1 |
| `get_entity_schema` | `schema.get` | 1 |
| `list_operations`, `describe_operation` | `ops.list`, `ops.describe` | 1 |
| `query_rows` | `rows.query` | 1 |
| `get_trip` | `trip.get` (with `resolve`) | 1 |
| `get_place`, `get_trail` | `place.get`, `trail.get` | 1 |
| `search` | `search` | 1 |
| `list_due_bookings` | `bookings.due` | 1 |
| `validate_trip` | runs the validator and day checks on a stored trip or on a candidate JSON passed in (skills use it before writing) | 1 |
| `create_trip`, `add_place`, `add_item`, `update_item`, `upsert_trip_booking`, `upsert_trail`, `set_trip_activity` | the matching operations | 2 |
| `apply_operation` | any write operation by name (the long tail), validated against its schema | 2 |
| `propose_research_changes`, `apply_proposal` | `research.propose`, `proposal.apply` | 2 |
| `inbox_add`, `inbox_resolve` | `inbox.*` | 2 |

Seven dedicated write tools plus one generic one keeps the tool list short enough for an agent's context while the common edits still get a typed schema.

### 5.8 Revised 3: operations for the creation flow

| Operation | Input | Effect |
|---|---|---|
| `trip.copy` | `from_slug`, `new_slug`, `include` (items, notes) | a new trip with references only; no private data, no booking statuses, no edition |
| `note.add`, `note.update`, `note.remove` | `scope`, `ref`, `text`, `visibility`, `links`, `attachments` | `notes` rows |
| `custom_item.add`, `custom_item.update`, `custom_item.propose` | `custom_items` row / `id` | trip-local item; `propose` creates a `catalog.propose` change |
| `item.pin`, `item.unpin` | `id` | protects hand-placed items on regenerate |
| `day.optimise` | `day`, `track` | reorders non-pinned items by nearest neighbour; returns the new order as a proposal |
| `route.set` | `routes` row | stores the request |
| `route.compute` | `route_id` | Phase 1: estimate or stored geometry; Phase 2: provider call through the Worker; writes `geometry_file` and catalog legs |
| `route.suggest_breaks` (read) | `route_id`, overrides | ranked break and overnight candidates with detour minutes (0B.5), writes nothing |
| `route.insert_break` | `route_id`, `candidate` (catalog id, OSM id or coordinates) | inserts the item (and a custom item for OSM or map picks), recomputes legs |
| `search.near`, `search.along_route` (read) | `lat`, `lon`, `radius_km`, `types` / `route_id`, `corridor_km`, `types` | catalog rows from the spatial index |

MCP gains `suggest_breaks` and `search_along_route` (read, Phase 1) and the write tools via `apply_operation` (Phase 2).

## 6. Phases (Revised 4: replaces 6.0-6.2 of revisions 1-3)

Revised 4: the phase list of revisions 1-3 (P1-P6, the 6.1 and 6.2 amendments, P7, P8, P8b) is replaced by the sub-phases below, sized so one agent finishes each in one PR. The old text is in git history at `6859a27`. Each sub-phase has a self-contained brief in `docs/archive/v1/briefs/<id>.md`; the index, approvals and models are in `docs/archive/v1/briefs/README.md`.

### 6.0 Working rules for every phase

| Rule | Detail |
|---|---|
| Model | Sonnet codes. Opus owns P5c (skills and agents) and the model-spend steps inside P4c (the Patagonia mapping, any model help on geocoding misses). House rule: Opus plans, Sonnet codes |
| Branch and checkout | every phase works on `phase/<id>` (for example `phase/p3a`). P1b runs in the main checkout (nothing runs beside it). Every other phase runs in its own worktree `/home/nitin27may/workspace/travel-wt/<id>`, created by the brief's first step, so two agents never share a working tree |
| Commits | `git -C <checkout> add <owned paths>` only, never `git add -A` or `git add .`; one commit per brief step, each green; message prefix `<ID> step <n>: `; trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; push the branch after each green step (the owner pulls on other machines) |
| Merge | rebase onto `origin/main` before opening the PR (house rule), `gh pr create` with `--title` and `--body-file` (it has no `--json`), the owner merges; any branch cleanup only after `gh pr view <n> --json merged -q .merged` prints `true` |
| Verify | the brief's acceptance commands, then `bash <checkout>/tools/check-all.sh` (from P2a; before that, the commands the brief lists) |
| Network | tests, hooks and builds never call the network. Fetches (Wikidata, Nominatim, Overpass, Waymarked Trails, ORS, Commons) are owner-run steps with committed outputs |
| Deletions | any deletion of a tracked file outside a `git mv` needs the owner's yes first, stating what is lost (house rule) |
| Report | every brief ends with what to report: commits, test counts, acceptance outputs, deviations, open questions |

### 6.1 Order and parallelism (Revised 4)

| Phase | Goal | Depends on | Can run in parallel with | Model |
|---|---|---|---|---|
| P1a | code and data move (steps 0-2) | approval | nothing | Sonnet (running) |
| P1b | legacy move, `publish.py`/`hub.py`, docs (steps 3-5) | P1a | nothing | Sonnet |
| P2a | schema source, export, DDL, structural validator, hooks | P1b | P3a | Sonnet |
| P2b | locations v3 and the inbox move, day checks, operation catalogue, read-only MCP | P2a | P3a, P3b | Sonnet |
| P3a | app scaffold, theme, places in cards/list/table, place pages, `/trips/`, `/about/data/`, visibility and privacy, publish merge | P1b | P2a, P2b | Sonnet |
| P3b | map view, advanced filter panel, saved views, CSV, `/schema/`, axe and keyboard suites | P3a, P2a | P2b, P4a, P4b | Sonnet |
| P4a | operations core, `FileStore`, ops CLI, local API, book-by, sun | P2b | P3b | Sonnet |
| P4b | catalog ingestion pipeline, coverage, backlog, `/review/` | P4a | P3b | Sonnet |
| P4c | geocode, import the Rockies and Patagonia, data-readiness report | P4b | P3b | Sonnet; Opus for the Patagonia mapping step |
| P5a | plan pages, day and trail maps, trail geometry, offline and PWA, exports (GPX, KML, CSV, ICS), OG, storage migration | P4c, P3b | P5b1-P5b3, P5c, P6 | Sonnet |
| P5b1 | creation flow S0-S6, match counter, `TripDraft`, IndexedDB autosave, undo, Download/Import, fallback first draft | P4c, P3b | P5a, P5c, P6 | Sonnet |
| P5b2 | S7 day board, `BoardMap`, keyboard moves, legs, day checks in the panel, `/edit/` | P5b1 | P5a, P5c, P6 | Sonnet |
| P5b3 | S8-S9, notes, custom items, universal search, search and spatial indexes, guardrails | P5b2 | P5a, P5c, P6 | Sonnet |
| P5c | skills and agents (`.claude/skills/*`, `.claude/agents/*`, the rewritten `trip-planner`) | P5a, P4c | P5b1-P5b3, P6 | **Opus** |
| P6 | globe route, coverage layer, catalog lists, area pages, backlog view | P3b, P4c | P5a, P5b1-P5b3, P5c | Sonnet |
| P7 | planner v1 and the data-readiness report in the UI | P5b2 | P5b3, P8 (after P5b3) | Sonnet |
| P8 | routing with breaks (Phase 1 part) | P5b3 | P7 | Sonnet |

```
P1a -> P1b -> P2a -> P2b -> P4a -> P4b -> P4c -> P5a ------------------> (Phase 2 plan)
          \       \                          \-> P5b1 -> P5b2 -> P5b3 -> P8
           \       \-> P3b (also needs P3a)   \            \-> P7
            \-> P3a                            \-> P6, P5c (after P5a)
```

### 6.2 Removed in revision 4

The revision 2 table "phase changes for the catalog, the flywheel and the builder" and the revision 3 table "phases for the creation flow and routing" are folded into 6.1 and 6.3. Two scope moves: the catalog list routes, area pages and backlog view move from P5 to P6 (P5a is the plan pages; P6 already owns a descriptor-driven map surface), and P8b (the Phase 2 routing service) moves into the Phase 2 outline (6.5).

### 6.3 Phase summaries (Revised 4)

Each summary is the contract; the brief carries the steps, commands and tests.

#### P1a. Code and data move (running)

Steps 0-2 of the review's order: baseline (`.site/` copy, `tools/tests/fixtures/served-urls.txt`, 109 tests); `_system/tools` to `tools/`, `_system/tests` to `tools/tests/`, hook `ROOT` and script paths, `.claude/settings.json`; `data/locations/`, `data/reference/countries.json`, `data/schema/legacy/locations_schema.sql`, `research/places/PRIORITIES.md`. End state: all 109 tests green, `.site/` byte-identical, trips, `globe/`, `locations/index.html`, `locations/inbox/` and `_system/` (minus tools and tests) still at their old paths. No brief (it is running).

#### P1b. Legacy move, publish port, docs

Owns: the `git mv` rows marked P1b in 1.2; `tools/location_views.py` `Paths` (P1b column), `tools/globe_data.py` `ASSETS`/`CACHE`; the P1b test edits of 1.2; the one `sys.path` line in each of the 8 builders; `tools/publish.py`, `tools/hub.py`, `publish.sh` (wrapper); `legacy/MANIFEST.json`; new tests (served-URL superset, no `research/` in `.site/`, manifest frozen, reserved slugs); `.gitignore`; the pnpm workspace skeleton (root `package.json`, `pnpm-workspace.yaml`); `CLAUDE.md`, `.claude/skills/location/SKILL.md`, `.claude/skills/trip-planner/SKILL.md` (paths only), `data/locations/README.md`, `legacy/_system/README.md`, a stub `README.md`, `docs/` moves.
Acceptance: 109 passed plus the new tests; `locations.py validate` and `build --check`; every builder rebuilds and `git status --short legacy` is empty; `HUB_TODAY=<baseline date> python3 tools/publish.py --dry-run && diff -r /tmp/site-before .site` is empty; both hooks run by hand with sample JSON return 0; the two generated strings and `locations/inbox/` untouched.

#### P2a. Schema source, export, DDL, structural validator, hooks

Owns: `core/**` (package scaffold, `src/schema/**`, `src/validate/**`, `bin/schema.ts`, `bin/validate.ts`, `test/**`); `data/schema/generated/**`, `data/schema/freshness.json`, `data/schema/difficulty-map.json`; `data/catalog/policy.json` and empty catalog folders with `.gitkeep`; `tools/pyproject.toml`, `tools/check-all.sh`; `tools/hooks/data_changed.sh`, `tools/hooks/schema_changed.sh` and their `.claude/settings.json` entries; `tools/tests/test_schema_sqlite.py` (extended).
Acceptance: `node core/bin/schema.ts generate --check` byte-equal; the generated `schema.sql` loads in SQLite with every valid fixture and `PRAGMA foreign_key_check` empty; the existing `test_schema_sqlite.py` cases pass against the generated DDL for locations; one broken fixture per `E_*` code of 2.4 fails with exactly that code, every valid fixture passes; every `meta` key survives the export; the hooks block a bad write (exit 2) and pass a good one, run by hand; 109 Python tests still pass.

#### P2b. Locations v3, inbox move, day checks, operation catalogue, read-only MCP

Owns: `tools/locations.py`, `tools/location_views.py`, `tools/migrate_locations_v3.py`, `tools/tests/test_locations*.py`, `test_location_views.py`, `test_site_outputs.py`, `test_migrate_v3.py`; `data/locations/**`, `data/vocab/tags.json`; `git mv locations/inbox research/inbox`; `.claude/skills/location/SKILL.md`; `core/src/schema/locations.ts` (v3), `core/src/checks/**`, `core/src/ops/catalogue.ts`, `core/bin/mcp.ts`, `core/test/checks/**`, `core/test/mcp/**`; `data/schema/generated/ops.json`; `.mcp.json`.
Acceptance: `migrate_locations_v3.py --check` writes nothing and a second run is a no-op; every v2 id present; WISHLIST headings unchanged; the inbox rule, five assertions, `test_site_outputs.py:31` and the skill all say `research/inbox/`; the two generated strings name the new paths and both outputs are rebuilt in the same commit; one fixture per `W_*` code; the place parity test (core validator versus `locations.py validate`) agrees on the store and fixtures; Claude Code lists `list_entity_types`, `get_entity_schema`, `query_rows`, `get_place`, `validate_trip` through `.mcp.json`; the 109 tests, adjusted only where the inbox and vocabulary moved, pass with the same count or more.

#### P3a. App scaffold, theme, places in three views

Owns: `web/**` except the paths later phases own (6.4); `tools/theme_tokens.py`; `tools/publish.py` (merge order and route table only); `tools/hub.py` (a `--json` mode the app home page reads); `data/reference/licences.json`; `tools/tests/test_publish_merge.py`; the full `README.md`.
Scope: Next.js 16.4.2 static export, TS strict, Tailwind 4.3.3, shadcn (Base UI), self-hosted fonts; theme tokens from `legacy/_system/themes/*.css`; `EntityPage`, `FilterBar`, `ViewSwitcher`, `CardsView`, `ListView`, `TableView` (sort, group-by, sticky header, virtualised), `DetailSheet`, `EmptyState`; place descriptor; entity views writer (`web/lib/views/`); `/`, `/places/`, place pages, `/trips/` (legacy manifest), `/about/data/`, `/locations/` redirect and the hash shim; visibility filtering and the privacy test; OG tags for shell and lists; units preference; analytics flag; JS budget test; publish merge order (1.3).
Acceptance: `/places/` shows exactly the 64 places with the same filters and counts as `/locations/` for the URL params of `docs/PLAN-locations-g5.md` 2.4; three views share URL state; privacy test, budget test, OG test, font test pass; `python3 tools/publish.py --dry-run` stages the app plus every legacy route, `_redirects` last, and the served-URL superset test passes; under 15,000 files.

#### P3b. Map view, advanced panel, saved views, schema page, accessibility suites

Owns: `web/components/map/MapView.tsx`, `web/lib/map/**`, `web/components/entity/AdvancedFilterPanel.tsx`, `web/lib/entities/savedViews.ts`, `web/lib/entities/csv.ts`, `web/app/schema/**`, `web/tests/e2e/a11y/**`, `web/tests/e2e/keyboard/**`; edits to `TableView` limited to wiring the panel and the column chooser.
Acceptance: map view clusters 64 places and honours `bbox`; 3-condition AND/OR filter, group by country, column chooser, CSV export of filtered rows, saved view round trip; axe zero serious or critical on every route in all four views; keyboard path test; `/schema/` renders every table and operation.

#### P4a. Operations core

Owns: `core/src/ops/**` (logic; the catalogue file stays P2b's but P4a may add entries), `core/src/store/**` (`FileStore`, `MemoryStore`), `core/src/bookings/**` (book-by), `core/src/sun/**`, `core/bin/ops.ts`, `core/bin/serve.ts`, `core/test/ops/**`, `core/test/sun/**`.
Acceptance: every write operation of 5.3 and 5.8 that P4c and P5 need has a test applying it to a fixture trip and asserting the file, the changelog row, the warnings and that `inverse` restores the original bytes; the same operation through the CLI and through the local API produces byte-identical files; book-by for Patagonia's 26 Feb 2027 edition gives offsets -118 (Sat 31 Oct 2026) and -88 (Mon 30 Nov 2026); sun times match `research/trips/patagonia-feb-mar-2027/sun.md` within 1 minute; `client_op_id` replays are idempotent and a stale `expected_rev` returns `E_STALE`.

#### P4b. Catalog ingestion, coverage, backlog, review queue

Owns: `core/src/catalog/**`, `core/src/research/**` (sidecar index, dedupe), `core/src/lanes/**`, `core/bin/catalog.ts`, `core/test/catalog/**`; `web/app/review/**`, `web/components/review/**`.
Acceptance: normalise, match, merge, propose, apply, freshness and coverage each have unit tests with named fixtures; a deliberately duplicated place is a possible duplicate; re-running an import of the same sidecars is a no-op proposal; auto-accept lands new rows as `proposed`/`stated` (E22); priority floor (E23); lane selection reproduces the Patagonia worked example of 7.3; `/review/` accepts and rejects changes against the local server.

#### P4c. Geocode and import two trips

Owns: `tools/geocode.py` and its test; `research/trips/canadian-rockies-sept-2029/geocode-report.md`, `research/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/*.json` (sidecars), `research/trips/patagonia-feb-mar-2027/mapping.json` (the reviewed mapping fixture); `core/src/import/**`, `core/test/import/**`; `data/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/**`; catalog rows in `data/catalog/**` and places in `data/locations/` for both regions (through operations only); `data/catalog/coverage.json`, `backlog.json`; `docs/reports/data-readiness-<date>.md`; `.claude/skills/trip-import/SKILL.md` (a working draft; P5c finalises it).
Model spend: the geocode step uses Wikidata and Nominatim (free, one request a second, owner-run, about 126 rows, about 3-5 minutes). Tables are mapped by code: the Rockies `data/*.json` files and Patagonia's PLAN.md pipe tables (Trails, Bookings and deadlines, Adventures, Budget, Night split). The prose that no parser can map faithfully (each trip's day-by-day sections into days, tracks and items that reference the catalog ids from the code step; orientation, answer-first, hazards, gotchas and state of knowledge into prose files and rows) is mapped by **one Opus run per trip**, budgeted under D29 and approved by the owner before it runs. Each run's output is a committed mapping fixture (`research/trips/<slug>/mapping.json`) the owner reviews once; every later run of the import is deterministic over it.
Acceptance: every Rockies row (48 sights, 62 trails from `trails.json`, 43 activities from `adventures.merged.json`, 33 bookings, 16 bases) appears in the catalog or the trip, or in a listed exclusion with a reason; every row has coordinates or is `review_status: raw` with `W_NO_COORDS` and appears in the geocode report; Patagonia table rows per section match the counts the test parser reads from PLAN.md (Trails, Bookings and deadlines, Adventures, Budget, Night split, Day by day), and the prose sections (Hazards, Gotchas, Orientation, The answer first) are signed off by the owner in the PR; both trips validate with zero errors and every warning fixed or accepted; coverage computed for Banff, Lake Louise, Jasper, Kananaskis, El Chalten, Ushuaia and El Calafate and the data-readiness report written.

#### P5a. Plan pages, maps, trails, offline, exports

Owns: `web/app/[slug]/page.tsx`, `web/app/[slug]/print/**`, `web/app/trails/**`, `web/app/bookings/**`, `web/components/plan/**`, `web/components/map/**` except `MapView.tsx` (now frozen; wrap it), `web/public/sw.js`, `web/public/manifest.json`, `web/public/icons/**`, `web/lib/exports/**`, `web/lib/storage/**`, `web/lib/weather/**`, `web/lib/fx/**`, `web/lib/deeplinks/**`, `web/scripts/shots.ts`, `tools/trails.py`, `tools/tests/test_trails.py`, `data/catalog/trails/geo/**` (owner-run fetch outputs), `data/trips/*/legacy-keys.json`.
Acceptance: both plan pages render the full spine (4.5) and every parity row (4.10); every trail on both trips has geometry or a recorded reason; offline harness (4.9) passes; ICS, GPX, KML, CSV snapshots; OG tags; storage migration test; the owner reviews both pages against the legacy pages (screenshots at 2x, tiled, desktop and phone) before `web_published` is set in a separate commit.

#### P5b1. Creation flow inputs and drafts

Owns: `web/app/new/**`, `web/components/create/steps/**`, `web/components/create/MatchCounter.tsx`, `web/components/create/CandidatePicker.tsx`, `web/lib/draft/**`, `core/src/planner/fallback.ts` and `core/src/planner/index.ts`.
Acceptance: the four-answer minimum produces a board-ready draft with the fallback; match counter wording with unknowns (0B.2); every step change is an operation and undo works for 100 steps across a reload; autosave restores after a tab is killed (Playwright closes the page mid-edit); Download/Import round trip; axe clean; phone layout at 390 x 844.

#### P5b2. Day board and board map

Owns: `web/app/edit/page.tsx`, `web/components/create/board/**` (`DayBoard`, `DayColumn`, `ItemCard`, `LegChip`, `BaseSlot`, `UnscheduledTray`, `BoardMap`), `web/lib/board/**`.
Acceptance: picks drag onto days and move by keyboard (pick up, move, drop, "Move to day" menu) with live-region announcements; legs and arrival times recompute on every change; day checks show on the card that causes them; `/edit/?trip=` with `NEXT_PUBLIC_EDITING=local` saves through the local API and the files validate; with `off` it explains; keyboard-only creation of a 3-day trip.

#### P5b3. Bookings, review, notes, custom items, search, guardrails

Owns: `web/components/create/{BookingsAndCosts,ReviewAndSave,NotesPanel,UniversalSearch,GuardrailBanner,FixMenu,UndoBar}.tsx`, `web/lib/search/**`, `web/lib/index/**` (search and spatial index writer and reader), `web/lib/osm/**` (Overpass client and limiter), `web/lib/guardrails/**`.
Acceptance: every guardrail in 0B.7 has a test that shows the message and applies the fix; notes and custom items round-trip through the ops CLI to identical files; search by name, near here and "Search OpenStreetMap too" (mocked) with the 5-second limiter tested; spatial index files under `/data/index/geo/` built, read and filtered by point-to-polyline distance.

#### P5c. Skills and agents (Opus)

Owns: `.claude/skills/{trip-import,trip-edit,trip-research,research-trails,trip-fares,trip-build,trip-verify,trip-publish,trip-photos,trip-conditions,catalog-review}/SKILL.md`, the rewritten `.claude/skills/trip-planner/SKILL.md`, `.claude/agents/*.md`, `tools/fares/tfs.py`, `tools/conditions.py`, `tools/links.py`, `tools/anchors.py` and their tests, the conditions gate in `tools/hooks/prepublish.sh`, `tools/tests/test_skill_commands.py`.
Acceptance: each skill names only commands that exist (a test greps every `node core/bin/...`, `python3 tools/...` and `pnpm ...` command in the skills and runs it with `--help`); each agent file states its lane, inputs, outputs (`<lane>.md` and `<lane>.json`), the sidecar schema and the one-sequential-searcher rule for Commons; `trip-photos` and every agent carry the Commons rule; the owner reviews the set in one review packet.

#### P6. Globe route and catalog lists

Owns: `web/app/globe/**`, `web/components/globe/**`, `web/public/geo/**`, `tools/globe_data.py` (output paths only), `tools/tests/test_globe_*.py`, `web/app/{activities,stays,eateries,offers,areas,backlog}/**`, `web/lib/entities/descriptors/{activity,stay,eatery,offer,area}.ts`, `web/tests/fixtures/globe-hashes.json`.
Acceptance: the committed hash fixture (10-20 `#c=..&s=..&d=..` hashes with expected labels and pin counts, captured from the legacy globe before any P6 code) passes against the app globe; list filters apply on the globe; a pin opens the shared `DetailSheet`; coverage layer; catalog lists in four views; `/globe/` serves from the app; `legacy/globe/` deleted in the same PR only after the owner confirms.

#### P7. Planner v1 (Revised 4)

Owns: `core/src/planner/**` (replacing the P5b1 fallback behind the same `firstDraft` export), `core/bin/plan.ts`, `web/app/plan/new/**`, `web/components/planner/**`.
Acceptance: the v1 rules of 0A.5; the same inputs give byte-identical drafts; every draft passes the day checks or carries an explained accepted warning; a 7-day "Banff, September, family with a 6-year-old, active-nature, pace 3" draft uses only rows that are kid-fit or of unknown fit (flagged) and stays within the walking ceiling; a thin area produces free days and backlog items, never invented rows; property tests over random inputs never exceed ceilings; the data-readiness report renders per area.

#### P8. Routing with breaks (Phase 1 part)

Owns: `core/src/routing/**` (breaks, corridor, estimate; pure, shared with the Phase 2 Worker), `web/components/create/BreakPlanner.tsx`, `web/app/edit/route/**`, `tools/route.py` and its test (owner-run ORS fetch), `core/test/fixtures/routes/**`.
Acceptance: with the committed Calgary-Banff-Lake Louise-Jasper fixture, a 2 h interval yields targets at 2 h and 4 h with ranked candidates and detour minutes; "max 4 h a day" splits a 7 h chain into two days with an overnight suggestion from catalog stays; ferry and pass cautions on hand-marked fixture segments; inserting a candidate recomputes legs and day checks; an unrouted A-B shows estimates labelled as such; Overpass only on demand, served from cache on the second call; property tests: no suggestion beyond the corridor, ranks deterministic.

### 6.4 File ownership for parallel phases (new in revision 4)

Outside the owned paths, a phase may only make **append-only** edits to the shared files below (add a dependency, a nav link, a route-table row, a descriptor registration; never reorder, reformat or delete someone else's lines). Each agent works in its own worktree and rebases onto `origin/main` before its PR; the second to merge resolves conflicts in shared files.

Shared, append-only: `package.json` (root), `pnpm-lock.yaml` (regenerate with `pnpm install`, never hand-edit), `core/package.json`, `web/package.json`, `web/app/layout.tsx` (nav links only), `web/lib/entities/registry.ts`, `core/src/ops/catalogue.ts` (new entries only), `tools/publish.py` route table (`ROUTES` list only), `tools/check-all.sh` (new lines only), `.claude/settings.json` (new hook entries only), `CLAUDE.md` (one line per phase in a "Platform" section).

| Parallel pair or group | Phase | Owns exclusively | Must not touch |
|---|---|---|---|
| P2a with P3a | P2a | `core/**`, `data/schema/**`, `data/catalog/policy.json`, `tools/hooks/{data,schema}_changed.sh`, `tools/pyproject.toml`, `tools/check-all.sh` (creates it) | `web/**`, root `package.json`, `pnpm-workspace.yaml` (P1b created them) |
| | P3a | `web/**`, `tools/theme_tokens.py`, `tools/publish.py` merge code, `tools/hub.py` (`--json` output only), `data/reference/licences.json`, `README.md` | `core/**`, other `data/**` (reads only) |
| P2b with P3a or P3b | P2b | `tools/locations.py`, `tools/location_views.py`, `tools/migrate_locations_v3.py`, their tests, `data/locations/**`, `data/vocab/**`, `research/inbox/**`, `.claude/skills/location/**`, `core/src/checks/**`, `core/src/schema/locations.ts`, `core/bin/mcp.ts`, `.mcp.json` | `web/**` |
| | P3a / P3b | as their summaries in 6.3 | `core/**`, `tools/locations*.py`, `data/**` |
| P3b with P4a, P4b, P4c | P3b | `web/components/map/MapView.tsx`, `web/lib/map/**`, `AdvancedFilterPanel`, saved views, CSV, `web/app/schema/**`, a11y and keyboard suites | `core/**`, `web/app/review/**`, `data/**` |
| | P4a / P4b / P4c | `core/src/{ops,store,bookings,sun}/**` (P4a); `core/src/{catalog,research,lanes}/**`, `web/app/review/**`, `web/components/review/**` (P4b); `core/src/import/**`, `data/trips/**`, `data/catalog/**` rows, `tools/geocode.py` (P4c) | `web/**` outside the review folders |
| P5a, P5b1-P5b3, P5c, P6 | P5a | `web/app/[slug]/**`, `web/app/{trails,bookings}/**`, `web/components/{plan,map}/**` (`MapView.tsx` frozen), `web/public/{sw.js,manifest.json,icons}/**`, `web/lib/{exports,storage,weather,fx,deeplinks}/**`, `tools/trails.py`, `data/catalog/trails/geo/**` | `web/app/{new,edit,globe}/**`, `web/components/{create,globe}/**`, `.claude/**` |
| | P5b1 / P5b2 / P5b3 (sequential among themselves) | `web/app/new/**`, `web/app/edit/**`, `web/components/create/**`, `web/lib/{draft,board,search,index,osm,guardrails}/**`, `core/src/planner/{fallback,index}.ts` (P5b1) | `web/components/{plan,map,globe}/**` (import, do not edit), `web/app/[slug]/**`, `.claude/**` |
| | P5c | `.claude/skills/**` (except `location`), `.claude/agents/**`, `tools/fares/**`, `tools/conditions.py`, `tools/links.py`, `tools/anchors.py` | `web/**`, `core/**` |
| | P6 | `web/app/{globe,activities,stays,eateries,offers,areas,backlog}/**`, `web/components/globe/**`, `web/public/geo/**`, `web/lib/entities/descriptors/{activity,stay,eatery,offer,area}.ts`, `tools/globe_data.py` output paths, `legacy/globe/**` (deletion, after the owner's yes) | `web/components/{plan,map,create}/**`, `.claude/**` |
| P7 with P8 | P7 | `core/src/planner/**`, `core/bin/plan.ts`, `web/app/plan/**`, `web/components/planner/**` | `core/src/routing/**`, `web/app/edit/route/**` |
| | P8 | `core/src/routing/**`, `web/components/create/BreakPlanner.tsx`, `web/app/edit/route/**`, `tools/route.py`, `core/test/fixtures/routes/**` | `core/src/planner/**` |

### 6.5 Phase 2 outline (Revised 4; separate plan, after P5a and P5b3)

| Step | Content |
|---|---|
| 2.0 | **Decide D28 first**: git-backed writes from the Worker (recommended) or D1 as the truth with a nightly export (5.6) |
| 2A | `api/` Worker (Hono) importing `@travel/core`; `GitStore` (design A) or `D1Store` (design B); `/api/v1/*`; Access protection and the JWT check |
| 2B | Remote MCP (`createMcpHandler`) with the full tool list; Claude Code registration with a service token kept in the keychain |
| 2C | design A: D1 (optional) as a read index rebuilt on push. Design B: the export Action (needs its own Access service token, a second secret) and `diff-d1` |
| 2D | Inbox endpoint, iOS Shortcut, `/inbox/` review queue with rate limits and a block list; `place.*` ported to TS, the 109 tests' cases run through the CLI against both implementations before the switch |
| 2E | Hosted editing (`NEXT_PUBLIC_EDITING=hosted`); saved views, ticks and drafts per user; error beacon (4.13) |
| 2F | Routing service (was P8b): `api/src/route.ts` proxies ORS with a GraphHopper fallback, KV cache by waypoint chain, legs written through `catalog.add`; quota counters |
| 2G | Joined write paths: one test applies the same operation through the CLI, the local API and MCP `apply_operation` and asserts identical files |
| Later, recorded so they are not lost | import from Google Maps lists (Takeout CSV or GeoJSON into custom items or places); collaboration (two travellers editing one trip, shared ticks; G8); a running-cost and limits table (Pages builds are local, Workers free 100k requests a day, D1 and KV free tiers, ORS 2,000 directions a day, Overpass fair use); privacy policy and terms the day a second person signs in; per-user deletion procedure |

## 7. Skills, agents, hooks and gates (Revised: 7.6; Revised 4: 7.1, 7.5)

### 7.1 Skills (`.claude/skills/`) (Revised 4)

Revised 4: every skill except `location` is written or rewritten in **P5c, an Opus-owned phase**, after the data and commands it points at exist (P4c, P5a). P4c leaves a working draft of `trip-import`; P1b changes only paths in the two existing skills; P2b updates `location` for the inbox and vocabulary moves.

| Skill | Status | Trigger | Does | Model at run time |
|---|---|---|---|---|
| `location` | existing; paths in P1a/P1b, inbox and vocabulary in P2b | "add X", a screenshot, a caption | capture through `locations.py` (`place.*`) | Sonnet; Haiku for bulk export parsing |
| `capture-social` | new, Phase 2 for the endpoint; the export parser and pilot can be written in P5c if the owner asks | "process my saved posts", a Meta export file | section 9 pipeline into `research/inbox/` and then `place.add` | Sonnet; Haiku for caption extraction |
| `trip-planner` | existing, rewritten in P5c as the orchestrator | "plan X", "start the Peru trip" | intake (one question at a time) to `trip.create`; lane selection (`node core/bin/ops.ts lanes.select`); launches the lane agents in one message; bookings audit; `catalog.propose` and review; plan synthesis as a proposal; apply after review; then `trip-build`, `trip-verify`, `trip-conditions` | Opus for synthesis, agents per lane |
| `trip-import` | draft in P4c, final in P5c | "import the Patagonia plan" | PLAN.md + research files + any `data/*.json` to sidecars and a `trip.import` proposal through the ingestion path; validates; applies after review; unmapped content becomes `knowledge` rows marked GAP | Opus for a new mapping fixture, Sonnet for the deterministic run |
| `trip-edit` | new, P5c | "move Laguna Torre to Day 9" | translates the request into operations (`node core/bin/ops.ts`), shows the diff and the day-check warnings, applies on confirmation; asks "for everyone or only this trip" on fact changes | Sonnet |
| `trip-research` | new, P5c | "add adventure research for this trip", `--backlog` | one lane in re-run mode (7.3), `research.add_ref`, `research.propose`; or the backlog by priority (0A.3) | per lane |
| `research-trails` | new, P5c | "capture the geometry for these trails" | 3A capture with `python3 tools/trails.py find/fetch/check`, then `trail.upsert` | Sonnet |
| `trip-fares` | existing method, skill in P5c | "compare windows" | section 11 with `tools/fares/tfs.py`; owner-only (actor check) | Sonnet with Playwright MCP |
| `trip-build` | new, P5c | "rebuild" | `node core/bin/schema.ts generate --check`, `pnpm --dir web build`, legacy builds for unmigrated trips | Sonnet |
| `trip-verify` | new, P5c | before every publish | `bash tools/check-all.sh`, link and anchor checks, privacy test, axe on changed pages, screenshot slices read (zoomed, per the owner's rule) | Sonnet |
| `trip-publish` | new, P5c (wraps `tools/publish.py`) | "publish" | `python3 tools/publish.py`, then a live check that every served URL in the changed set returns 200 | Sonnet |
| `trip-photos` | existing tools, skill in P5c | "find photos" | the Commons pipeline in `tools/gallery/`, **one sequential searcher** | Haiku search, Sonnet review |
| `trip-conditions` | new, P5c | at plan time and by the gate in section 13 | creates the T-2 scheduled task ending in one named verdict; `tools/conditions.py check` | uses `schedule` |
| `catalog-review` | new, P5c | "review the proposals" | walks the proposal queue: possible duplicates first, conflicts next, then the rest; applies with explicit ids; also the review-time check for copied text (R23) | Sonnet |

### 7.2 Agents (`.claude/agents/`), roster by trip type

Every lane agent writes exactly two files: `research/trips/<slug>/<lane>.md` (for humans, every claim with a URL, `GAP:` where unverified) and `research/trips/<slug>/<lane>.json` (the sidecar, section 10.1). For a place not tied to a trip the folder is `research/places/<place-id>/`. Every agent that finds something bookable returns it in `records.bookings[]` in the shared `booking-record/1` shape (7.4), so bookings merge without a second pass.

| Agent (lane id) | Inputs | Must cite | Public sources first | Triggered by | Bookable output |
|---|---|---|---|---|---|
| `research-overview` (`overview`) | trip profile, countries, season | official tourism board, park agency | tourism boards, park agencies, Wikipedia for structure only | every trip | none (points other lanes at candidates) |
| `research-sights` (`sights`) | overview candidates, adopted places | hours, prices, reservation rules with read dates | official sites, Commons geotags, Google Maps popular times (manual) | every trip except pure `adventure` day trips | timed-entry tickets, shuttles (Moraine Lake), museum and site tickets |
| `research-hidden-gems` (`hidden-gems`) | region, style | each gem's local source (local blog, regional tourism office, local-language press) | local-language sources, regional tourism offices, Reddit local subs | tag `hidden-gems`, or `pace <= 2` with `scenic-relaxed` | small-operator tours when found |
| `research-trails` (`trails`) | profile ceilings, max grade, party | km, gain, time, local grade, trailhead, closures; geometry source id | park agencies, OSM/Waymarked Trails, Parks Canada and NPS datasets, Wanderland; AllTrails, Komoot, Outdooractive, Wikiloc as links | styles `adventure`, `active-nature`, `scenic-relaxed` (grades 1-2 only), `family`; any must_do trail | permits, parking reservations, huts, park passes |
| `research-adventure` (`adventure`) | party ages, heights, weights (private), style | price, min age, height, weight, booking channel, weather refund, season | operator pages first; Civitatis, GetYourGuide, Viator as a cross-check | `adventure`, `active-nature`, `family`; forced on when `kids_mode != none` and any activity is in must_do | every tour, zipline, rafting, via ferrata, glacier walk, boat tour |
| `research-relax-luxury` (`relax-luxury`) | comfort, budget tier | spa and restaurant prices, booking lead time, dress code, downtime quality | property sites, Michelin and national guides, Booking.com reviews (Playwright method) | `luxury-relax`, `relax`, `romantic`, `comfort = splurge` | spas, restaurants, special stays |
| `research-city-culture` (`city-culture`) | cities on the route | hours, tickets, closed days, walking routes | museum and city sites, official city tourism | `city-culture`, or any base in a city of more than 500,000 | museum and show tickets, tours |
| `research-road-trip` (`road-trip`) | origin, bases, transport | leg distances and times with basis, fuel, tolls, ferries, cell dead zones, border waits | Google Maps directions links, 511 road sites, ferry operators, border wait pages, rental companies | `movement_shape` in `road-trip`, `camper`, or style `road-trip` | ferries, rental cars, campsites |
| `research-stays` (`stays`) | bases, party, comfort | elevation, access, last transport, price snapshots with read dates | Booking.com (Playwright method), tourism-board directories, hut systems | every trip with `nights > 0` | hotels, lodges, huts, campsites |
| `research-timing` (`timing`) | season, editions | peak dates, live-condition sources, sun azimuth and elevation, climate normals, wind | Open-Meteo (forecast and archive), national climate normals, local foliage or snow trackers | every trip | none |
| `research-logistics` (`logistics`) | route, transport | domestic flights, rail, transfers, airport timings | airline and rail operator sites, airport sites, Rome2Rio as a link | every trip with `nights > 0` | domestic flights, trains, transfers |
| `research-entry` (`entry`) | countries, travellers' citizenship (decision D6) | passport rule, visa or eTA, minors' consent, insurance requirement, advisories, emergency numbers, hospitals per base | travel.gc.ca, consulates, IATA rules via airline sites | any country other than Canada | eTA, visas, insurance |
| `research-fares` (`fares`) | editions or candidate windows, party | fares and lodging by window, currency, read date | Google Flights and Booking.com via the Playwright method (section 11), frankfurter.app for FX | every trip with flights or `nights >= 2` | international flights (as quotes, not bookings, until a window is chosen) |
| `research-community` (`community`) | the draft plan | trip reports, closures people hit, crowd and parking reality, scams | Reddit, TripAdvisor forums, blogs, YouTube transcripts (`youtube-transcript` skill) | every multi-day trip; optional for day trips | none (flags issues on existing bookings) |
| `bookings-audit` (step, not a lane) | all sidecars' `records.bookings` | that each link loads, each price has a read date and currency, each window has evidence or a GAP | the same sources the record cites | after the lanes, before synthesis | consolidates; adds missing rows for any bookable item in the draft that has none |
| `plan-synthesis` | all sidecars, prose, the profile | n/a | n/a | after the audit | the `trip.import` / `research.propose` proposal (Opus) |

### 7.3 Which lanes run

`lanes.select` (`core/src/lanes/`, revised 4: TypeScript, so the UI's "Suggested research" and the skills share it; CLI `node core/bin/ops.ts lanes.select --input '{"slug": "..."}'`) computes the set:

1. Start with the lanes whose trigger column matches the trip's `primary_style`, style tags, `duration_shape`, `movement_shape`, `party_shape`, `kids_mode`, `comfort`, `nights` and countries.
2. Day trips (`duration_shape = day-trip`) keep only `overview`, `sights` or `trails` by style, `timing`, and `road-trip` when driving more than 90 minutes; they drop `stays`, `logistics`, `entry`, `fares`, `community`.
3. Add `profile.lanes_extra`, remove `profile.lanes_skip`.
4. The result and the reason per lane are shown to the owner before launch ("adventure: style adventure; entry: AR is not CA").

Worked: Patagonia (active-nature, adventure, family; multi-week; multi-base; AR) runs overview, sights, trails, adventure, stays, timing, logistics, entry, fares, community. It skips relax-luxury and hidden-gems (no matching style), road-trip (multi-base by air; the car is only for 6 days) and city-culture: Buenos Aires is over 500,000 so the rule would add it, but the profile puts it in `lanes_skip` because BA is a buffer stop.

**Re-run mode:** `trip-research --slug <slug> --lane <lane> [--focus "Via ferrata options"]` runs one lane against the current trip, writes `<lane>-<YYYY-MM-DD>.md/.json` when `<lane>.md` exists (never overwrites), and ends with `research.propose` limited to that file (section 10). The other lanes are not touched.

### 7.4 Shared booking sidecar shape (Revised 4: an offer record)

Revised 4: a booking found by a lane is recorded as a catalog `offers` row plus its `offer_prices` snapshots (2.3A) inside `records.offers[]`; the trip-side choice (`used_days`, priority, status) becomes a `trip_bookings` row only when the plan synthesis adopts it. Each offer record carries, beyond the 2.3A columns:

| Field | Meaning |
|---|---|
| `for` | what it books, as `subject_entity` and `subject_id` on the offer (2.3A); for something not yet in the catalog, the record's own `match` keys |
| `found_by` | lane id |
| `match` | dedupe keys: `book_url` host + path, operator name, product name |
| `evidence` | array of `{source_id, quote, read}` for price, limits, window and terms |

When an agent cannot find the booking window it writes `opens_kind: "unknown"` and `opens_evidence` listing every page checked with its read date ("operator FAQ 2026-10-13: no window stated; Civitatis lists dates to Mar 2027"); the computed book-by then uses the conservative default and carries the GAP flag. Permit and reservation systems the agents check by name: recreation.gov (US federal permits and timed entry), the Parks Canada Reservation Service, Sepaq, Havasupai reservations, provincial and state park systems, APN ventaweb (Argentina), the Machu Picchu ticket system, hut systems (SAC, CAI, DNT, refuges), then tourism boards, then resellers as a cross-check only.

### 7.5 Hooks and gates (Revised 4)

Hooks are shell scripts in `tools/hooks/` registered in `.claude/settings.json` with `"$CLAUDE_PROJECT_DIR"`. Validation runs through Node (`node core/bin/validate.ts`, 1.5); Python hooks use the system `python3` and the stdlib only. Hook configuration is read when a Claude Code session starts (inference from observed behaviour), so a session that started before a hook change still runs the old one; briefs say so where it matters.

| Hook | When | Checks | On failure | Built in |
|---|---|---|---|---|
| `locations_changed.sh` (PostToolUse Write/Edit/MultiEdit, existing) | `data/locations/**`, the legacy list template and CSS | `python3 tools/locations.py validate` then `build` | exit 2 | exists (paths in P1a) |
| `data_changed.sh` (PostToolUse Write/Edit/MultiEdit) | any write under `data/trips/**`, `data/catalog/**`, `data/vocab/**` | `node core/bin/validate.ts <file>` (structure and rules; from P2b also a day-check summary); refuses a deletion of a catalog row (use `catalog.retire`) | exit 2 with codes and messages | P2a |
| `schema_changed.sh` (PostToolUse) | `core/src/schema/**` | `node core/bin/schema.ts generate` then `generate --check` | exit 2 | P2a |
| `research_changed.sh` (PostToolUse) | `research/**/*.json` | the sidecar schema `research-sidecar/1` through `node core/bin/validate.ts` | exit 2 | P4b |
| `prepublish.sh` (PreToolUse Bash, existing, extended) | a Bash command containing `publish.sh`, `tools/publish.py` without `--dry-run`, `wrangler pages deploy` or `wrangler deploy` | `bash tools/check-all.sh` (every suite, the privacy and superset tests), the conditions gate (section 13) from P5c | exit 2 blocks the publish | exists; extended in P1b (match `tools/publish.py`), P2a (check-all) and P5c (conditions) |
| `legacy_page_changed.sh` | `legacy/*/index.html` | the audit 2.5 page gates | exit 2 | not scheduled in Phase 1 (legacy only shrinks); build it if legacy edits keep breaking pages |
| Freshness (in `validate`, warning) | always | prices read over 180 days ago on a trip whose chosen edition is within 120 days; `opens_kind unknown` with book-by within 30 days | warning | P4b |
| Privacy (test) | build | 1.3 sentinel test | test fails | P3a |

Gotcha: the `prepublish.sh` match is a substring test on the whole Bash command, so any command that merely mentions `publish.sh` (a `git add publish.sh`, a commit message) runs the full gate. That is harmless when the tree is green and slow otherwise; briefs avoid the string in commit commands.

### 7.6 Revised: agents and skills write to the catalog

| Change | Detail |
|---|---|
| Sidecar `records` | now target catalog entities (places, trails, activities, stays, eateries, offers with `offer_prices`, legs, area-guide facts); the shared booking shape of 7.4 becomes the catalog `offer` plus its price snapshots |
| Order in `trip-planner` | lanes, then the bookings audit, then `catalog.propose` and review (auto-accept rules apply), then the plan synthesis, which references catalog ids |
| New skill `catalog-review` | walks the proposal queue with the owner: possible duplicates first, conflicts next, then the rest; applies with explicit ids |
| New mode `trip-research --backlog` | works the research backlog by priority (0A.3) |
| `trip-edit` | asks "for everyone or only this trip" on fact changes and calls `catalog.edit` or writes an `override` |
| `trip-fares` | owner-only (actor check); writes route-window snapshots into the catalog |
| New hook check | a Claude write to `data/catalog/**` validates the entity schema and refuses deletions (deletion is `catalog.retire`, confirmed by the owner, per the house rule on deletions) |

## 8. Risks, gotchas, owner decisions (ranked) (Revised: 8.3; Revised 3: 8.4; Revised 4: 8.1, 8.5, 8.6)

### 8.1 Risks and gotchas (Revised 4: R1-R4)

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | P1 breaks a published URL or a legacy build (15 trip folders, 8 builders, path constants in 3 tools, 2 hooks and 7 test files; revised 4) | medium / high | byte-diff of `.site/` with `HUB_TODAY` pinned, per-builder byte-diff, served-URL superset test, the green-after-each-step order of 6.3, hooks run by hand |
| R2 | (revised 4: removed) Python and TS validators drift | n/a | there is one validator, in TypeScript (1.5) |
| R3 | `place.*` validation exists in `locations.py` and in `core`'s locations schema until Phase 2 ports `place.*` (the one remaining parity pair) | certain / medium | P2b parity test over the store and fixtures; the ops CLI delegates `place.*` writes to Python; Phase 2 runs the 109 tests' cases through the CLI against both before switching |
| R4 | Static export has no Server Actions, so the deployed editor cannot save in Phase 1 | certain / low | `NEXT_PUBLIC_EDITING=local` with `node core/bin/serve.ts` on the owner's machine; `/edit/` explains on the deployed site; `/new/` drafts live in IndexedDB with Download/Import |
| R5 | Waymarked Trails' API is undocumented (the blog's GPX path already 404s) | medium / medium | geometry is fetched once and stored; the fetcher has a fallback to Overpass `out geom`; contract test against one known relation runs weekly, not in CI |
| R6 | OSM relations missing or mis-ordered; no difficulty on relations (true in Chalten) | high / medium | agency datasets first where they exist; length check against stated km; difficulty from research, never from OSM alone |
| R7 | ODbL share-alike on stored trail lines | certain / low | lines kept per source with a NOTICE; the public `/data/` trail download stays ODbL; no mixing sources in one file |
| R8 | 90 m Open-Meteo elevation understates gain | high / low | stated gain is primary; computed gain labelled; Mapterhorn upgrade path |
| R9 | Offline tile caching strains OpenFreeMap | low / medium | 1,500-tile cap per trip, on request only; GeoJSON-on-blank fallback; GPX/KML for phone apps |
| R10 | Cloudflare keeps steering Next.js to Workers; Pages could stagnate | medium / medium | static export is portable; bind the custom domain early (D14), after which moving hosts changes no URL |
| R11 | Import fidelity: Patagonia's PLAN.md is 900 lines of prose with nuance that does not fit fields | high / medium | prose stays as Markdown under `prose/`; unmapped statements become `knowledge` rows; the owner reviews the proposal |
| R12 | Day-check noise trains the owner to ignore warnings | medium / medium | `accepted_warnings` per day; thresholds in one config; P4c tunes them on two real trips |
| R13 | Private data leaks (children's ages, heights, confirmations) into the public export | low / high | `x-private` in the schema drives the export allow-list; a privacy test greps the build |
| R14 | Instagram or Facebook flags the account during browser read-through | low / high | pilot first, 9.3 limits, export-first, no automation of account actions |
| R15 | `view=grid` meant cards on the legacy list page; "grid" now means table | certain / low | views renamed `cards/list/table/map`; legacy value mapped |
| R16 | shadcn switched its default primitives to Base UI on 3 Jul 2026; examples online mix Radix and Base UI APIs (`asChild` vs `render`) | high / low | pin the base in `components.json`; lint rule against importing the other base |
| R17 | Renaming a trip folder leaves the old URL live on Pages (existing gotcha) | medium / low | slugs are frozen once published; `publish.py` refuses a rename without a `_redirects` entry |
| R18 | The Pages free plan's 20,000-file limit | low / medium | build test fails above 15,000 files |
| R19 | Patagonia crosses T-60 on 28 Dec 2026 with no conditions routine | certain / medium | section 13 gate; `trip-conditions` in P5c; the routine must exist by 28 Dec 2026, so P5c is scheduled before then or the owner creates the routine by hand |
| R20 | Commons rate limits if gallery work is parallelised by the new agents | medium / medium | one sequential searcher, written into `trip-photos` and the agent files |

### 8.2 Decisions needed from the owner (ranked by how much they block)

Revised 4: in this table and in 8.3-8.4, a phase name without a letter means the whole family ("P2" is P2a and P2b, "P5" is P5a-P5c); 6.1 gives the sub-phases.

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Trails as a global catalogue (`data/catalog/trails/`, ids in the place hierarchy) rather than per trip | yes | P2 |
| D2 | Next.js 16 instead of the brief's 15 | 16 | P3 |
| D3 | App plan pages keep `/<slug>/` (no redirect) rather than move to `/trips/<slug>/` | keep `/<slug>/` | P3 |
| D4 | Is `github.com/nitin27may/travel` private? Traveller ages, heights and booking confirmations would be in git | keep it private; if public, private fields move to a gitignored `data/private/` overlay | P2 |
| D5 | Phase 1 editing through a local server (`node core/bin/serve.ts`, revised 4) acceptable until Phase 2 | yes | P5b2 scope |
| D6 | Record travellers' citizenship for the entry lane (today assumed Canadian) | yes, per traveller, private | P2 |
| D7 | Style vocabulary: keep both `relax` and `scenic-relaxed` and `luxury-relax`, or merge `relax` into one of them | keep all three: `relax` = downtime, `scenic-relaxed` = gentle sightseeing, `luxury-relax` = premium stays and spas; `luxury` an alias | P2 |
| D8 | Research namespace `research/trips/<slug>/` and `research/places/<id>/` (instead of `research/<slug>/`) | yes; avoids collisions with `vault-notes/` and `inbox/` | P1 |
| D9 | Outdooractive or Komoot partner access | no; link only | none |
| D10 | Offline tile cache size per trip (default 1,500 tiles, about 20-40 MB) | accept | P5 |
| D11 | Which capture signals the bulk social run uses (after the pilot) | decide after the pilot report | 9 |
| D12 | A Google Cloud project and referrer-restricted Maps Embed key | yes (free); without it the Google embed button is hidden and links remain | P5 |
| D13 | Drive times: inference and manual matrices (today) vs a routing API (OpenRouteService or Google Distance Matrix) in Phase 2 | manual in Phase 1; decide in Phase 2 | Phase 2 |
| D14 | The custom domain name, and when | choose before Phase 2 | Phase 2 host move |
| D15 | Migration order for the other 13 legacy trips after the first two | by next travel date: Costa Rica (Feb 2027), Dolomites, Iceland, Chamonix, Norway, then the rest; past trips last or never | after P5 |
| D16 | Should public plan pages be indexed by search engines | `noindex` on plan pages, index the lists | P3 |

### 8.3 Revised: added risks and decisions

Added risks:

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R21 | Bad merges corrupt the catalog (two different "Mirador" viewpoints merged) | medium / high | possible duplicates always go to review; merges keep `merged_from` and are reversible from `catalog_changes` |
| R22 | Auto-accept lets agent errors into `verified` | medium / medium | revised 4: auto-accepted rows land `proposed`/`stated`, never `verified`; `verified` needs the owner or two independent official sources (0A.2) |
| R23 | Copied text from blogs or operators slips into summaries | medium / medium | sidecars carry facts and links; revised 4: a review-time check in `catalog-review` (the snippets a test would need are never stored), not a test |
| R24 | The builder's drafts look authoritative where data is thin | high / medium | coverage band shown before planning; free days instead of filler; explanations per item |
| R25 | Open-Meteo's free tier is non-commercial; a move to ads or subscriptions (D17) breaks the terms | low now / medium | the decision explicitly includes the weather licence |
| R26 | Unofficial deep-link formats (Google Flights `q=` or `tfs`, Skyscanner, Kayak) change | high / low | link tests in P5a; fall back to the provider's search page with the destination only |
| R27 | Booking.com and Viator affiliate terms constrain how links and data are shown, or bar AI use | medium / medium | no affiliate sign-up until D20; read the terms before any integration |

Added decisions, and the ranking of all 22 by what they block (numbers kept so earlier references stay valid):

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D17 | Stay a personal tool with an open-data catalog, or become a multi-user product | personal tool with a public catalog for now; the schema is ready either way | P2 visibility defaults, Phase 2 auth |
| D18 | Catalog licence | ODbL for the whole catalog (0A.4) | P3 (publishing `/data/catalog/*.json`) |
| D19 | Who can edit the catalog | owner and owner's agents now; others only through proposals, if D17 opens it | Phase 2 |
| D20 | Sign up for free affiliate programmes (Travelpayouts for cached fares, Viator Basic Access for activity links) | not before P5 ships deep links; then Travelpayouts only if the "typical fare" hint is wanted | P5 optional widgets |
| D21 | Auth path beyond one owner | Cloudflare Access with an email allow-list; Auth.js if D17 says product | Phase 2 |
| D22 | Bring-your-own-key agent runs for other users | no until D17 | none now |

| Rank | Decision | Blocks |
|---|---|---|
| 1 | D1 trails (now catalog) as global entities | P2 |
| 2 | D4 repo private | P2 |
| 3 | D17 personal tool or product | P2 defaults |
| 4 | D2 Next.js 16 | P3 |
| 5 | D3 plan URLs at `/<slug>/` | P3 |
| 6 | D18 catalog licence | P3 data downloads |
| 7 | D8 research namespace | P1 |
| 8 | D6 citizenship field | P2 |
| 9 | D7 style vocabulary | P2 |
| 10 | D16 indexing | P3 |
| 11 | D5 local editor in Phase 1 | P5 |
| 12 | D12 Maps Embed key | P5 |
| 13 | D10 offline cache size | P5 |
| 14 | D20 affiliate sign-ups | P5 optional |
| 15 | D15 migration order | after P5 |
| 16 | D11 capture signals | section 9 |
| 17 | D19 who edits the catalog | Phase 2 |
| 18 | D21 auth path | Phase 2 |
| 19 | D13 routing API | Phase 2 |
| 20 | D14 custom domain | Phase 2 |
| 21 | D9 Outdooractive or Komoot partner | none |
| 22 | D22 bring-your-own-key | none |

D8 ranks below the P2 blockers only because its recommendation can be applied by default in P1; if the owner disagrees it must be answered before P1 starts.

### 8.4 Revised 3: routing and creation-flow decisions and risks

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D23 (replaces D13) | Routing: Phase 1 stored routes and estimates with Google links, Phase 2 an ORS proxy in the Worker with GraphHopper fallback, self-hosting only if usage grows | as stated (0B.5) | P8 (Phase 1 part needs only the owner's ORS key, free) |
| D24 | Private file attachments: device-only (IndexedDB) for good, or private R2 storage behind Access in Phase 2 | device-only in Phase 1; R2 in Phase 2 if the owner wants tickets on several devices | P5b (no), Phase 2 |
| D25 | Default daily maximum drive and break interval | 4 h a day, a break every 2 h | P8 |

Ranking update: D23 takes D13's place (rank 19) but moves up to just after D12 for P8; D24 and D25 rank after D10.

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R28 | Drag-and-drop boards are hard to make accessible | high / medium | keyboard and "Move to day" paths first, drag second; tests in P5b |
| R29 | Estimated legs (Phase 1) mislead on mountain roads | high / medium | every estimate labelled; stored routes for researched areas; Google link on every leg |
| R30 | Overpass load or blocking from users' browsers | low / medium | on-demand only, 30-day cache, one query per 5 s, clear attribution |
| R31 | ORS free quota exhausted if the site opens to others | low now / medium | KV cache by chain; per-user limits; D17 gate before opening |

### 8.5 Revised 4: the ten ranked risks from the review

These rank above R1-R31 for scheduling, because each one stalls the whole effort rather than one feature.

| Rank | # | How the effort fails or stalls | Mitigation now in the plan |
|---|---|---|---|
| 1 | R32 | P1 ships with hooks pointing at a non-existent root and `validate` failing on `trip` references; every later agent's PostToolUse hook exits 2 | 1.2 lists every constant; P1a did the hook `ROOT` and paths; the P1b brief runs both hooks by hand with sample JSON on stdin and sets `trips_root = legacy/` in the same commit as the trip move |
| 2 | R33 | P2, P4 and P5b each handed to one agent, which compresses scope; the compressed parts (geocoding, keyboard paths, undo) hurt later | 6.3 sub-phases, one PR each, with mechanically checkable acceptance in every brief |
| 3 | R34 | the schema agent guesses which of three layers is canonical | one canonical list (2.2, 2.3, 2.3A); 2.8 and the 0B.2 table removed; the P2a brief points only at 2.2-2.5 |
| 4 | R35 | parity pairs drift (a check passes in the hook and fails in the editor) | one runtime per concern (1.5); one remaining pair (`place.*`) with its own test |
| 5 | R36 | the Rockies import stalls on coordinates (126 rows, none with a point) | P4c step 1 geocodes with a report; rows that stay unresolved are `raw` with `W_NO_COORDS`, so the import never blocks on them |
| 6 | R37 | the P7 coverage gate never opens, or new research spend is incurred to open it | no gate for v1 (0A.5); targets calibrated after P4c (0A.3) |
| 7 | R38 | two agents in one checkout both touch `web/package.json` or `web/components/map/**` | `core/` separates schema work from `web/`; 6.4 ownership table; one worktree per agent; append-only shared files; never `git add -A` |
| 8 | R39 | Phase 2's two-truth design leaves a red export PR and a public site days behind | D28 decided before the Phase 2 plan, recommendation git-backed writes (5.6) |
| 9 | R40 | external APIs break or throttle (Waymarked Trails already lost its GPX route; Overpass, OpenFreeMap, ORS quotas) | every fetch owner-run with committed outputs; tests never touch the network; a weekly contract check outside the test suite (`python3 tools/trails.py contract`, owner-run) |
| 10 | R41 | the owner becomes the bottleneck (proposal queues, fixture approvals, screenshots, two plan-page sign-offs) | auto-accept to `stated`; one review packet per PR (summary, counts, the five rows most worth checking, screenshots); approvals batched per phase in `docs/archive/v1/briefs/README.md` |

Also real but lower: legacy pages keep being edited while migration runs, so parity targets move (the P5a brief freezes its parity snapshot at the start); the no-spend rule versus the P4c Opus mapping (D29); the `.pages.dev` hostname becomes load-bearing once OG tags exist (14).

### 8.6 Revised 4: new decisions

D1-D25 stand as approved. New decisions only where revision 4 needs one; each has a recommendation the briefs assume unless the owner says otherwise.

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D26 | Schema source: Zod 4 with a committed JSON Schema export (2.5), instead of JSON Schema with four generators | Zod as the source | P2a |
| D27 | CI in Phase 1 | none: the local gate (`tools/check-all.sh`) run by `prepublish.sh`; GitHub Actions arrive with Phase 2 | none (confirms 1.1) |
| D28 | Phase 2 write path: git-backed writes from the Worker, or D1 as the truth with a nightly export | git-backed writes while D17 says "personal tool" (5.6) | the Phase 2 plan |
| D29 | Model spend inside Phase 1: one Opus run per imported trip (two in total) to map the day-by-day prose and the prose sections into a reviewed mapping fixture (P4c), plus optional Opus help on geocoding misses; P5c authoring on Opus | approve, capped at one mapping run per trip; any second run asks first; tables and geocoding are mapped by code and free APIs (no model) | P4c |
| D30 | Cloudflare Web Analytics (free, cookie-less) on app pages | yes; the owner enables it for the Pages project and gives the beacon token as a build variable | P3a (optional; without it no beacon is emitted) |

## 9. Capture pipeline: saved social posts and phone share

Everything here feeds `data/locations/` (schema v2, built). Raw material lands in `research/inbox/`; only resolved places reach the store.

### 9.1 Sources and methods

| Source | Method | Gives | Limits |
|---|---|---|---|
| Instagram "Saved" export (Accounts Center, Download your information, JSON) | `tools/capture/meta_export.py parse <zip>`: reads the saved-posts and collections JSON, writes one inbox row per post (URL, saved time, collection name, caption when present) | bulk links and captions | captions are often bare; locations tags are not always in the export |
| Facebook "Saved" export | same parser, Facebook file layout | links, titles | |
| Browser read-through of the signed-in saved collection | Playwright MCP attached to the signed-in Chrome (the existing setup), only for posts whose caption names nothing: open the post, read caption, location tag and the first comment by the author | caption, location tag | throttled (9.3); never automated login |
| Video posts with on-screen text or voiceover | `yt-dlp` to a temp folder (one folder per post, treated as untrusted), `ffmpeg -vf fps=1/2` frame extraction, OCR (`tesseract`) or a vision read of a contact sheet of frames, and audio transcription (local `whisper.cpp`, or the existing `youtube-transcript` skill for YouTube) | place names from text overlays and narration | slow; only for posts where caption and tag are empty |
| Phone: iOS Share Sheet shortcut | Shortcut "Save to travel": takes the shared URL and text, POSTs `{url, text, shared_at, app}` to `https://<api-host>/api/v1/inbox` with an Access service token scoped to `inbox.add` | one row per share | Phase 2 (needs the Worker and D1); until then the shortcut appends to a Note the owner pastes into the `location` skill |

### 9.2 Pilot before bulk

The 10-post pilot is a hard step: pick 10 saved posts across the two apps (at least 4 videos), run every method, and report the hit rate per signal before any bulk run.

| Signal | Hits / 10 | Places found | Correct after review |
|---|---|---|---|
| Caption | | | |
| Location tag | | | |
| On-screen text (OCR or vision) | | | |
| Voiceover (transcription) | | | |

The pilot report goes to `research/inbox/PILOT-<date>.md`; the owner decides which signals the bulk run uses (decision D11).

### 9.3 Throttling and account safety

| Rule | Value |
|---|---|
| Browser read-through pace | one post every 20-40 s (randomised), at most 60 posts per session, at most 2 sessions a day |
| No automation of login, likes, follows, comments, saves | never |
| Stop condition | any challenge page, "try again later", or a login prompt ends the session and records the time |
| yt-dlp | one download at a time, `--sleep-requests 2`, no playlist expansion |
| Downloads | deleted after extraction; only frames used as evidence are kept, in `research/inbox/<capture-id>/` |
| Parallel agents | none for social capture (same lesson as the Commons 429: one shared IP) |

### 9.4 Inbox table, resolver, review queue

**inbox** (D1 table in Phase 2; `research/inbox/inbox.json` in Phase 1)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `inb-00001` |
| received | date | no | |
| channel | text | no | `ig-export`, `fb-export`, `ig-browser`, `share-sheet`, `manual` |
| url | text | yes | |
| text | text | no | caption or shared text |
| media_path | text | yes | under `research/inbox/` |
| signals | json | no | `{caption, location_tag, ocr, transcript}` extracted text |
| candidates | json | no | resolver output: `[{name, place_id_proposed, parent_chain, lat, lon, wikidata, score}]` |
| status | text | no | `new`, `resolved`, `needs-review`, `filed`, `dismissed`, `duplicate` |
| place_ids | json | no | places created or matched when filed |
| note | text | no | |

Resolver step (`inbox.resolve`): extract place names from the signals (Haiku), run `place.resolve` for each (Wikidata then Nominatim, one request a second), dedupe against the store (by id, then by name within 2 km, the locations rule), and set `resolved` when exactly one confident candidate per name exists, otherwise `needs-review`.

Review queue (`/inbox/`, Phase 2; the `location` skill in Phase 1): a table view of inbox rows with the extracted names, candidate chips on a mini map, and three actions: **File** (calls `place.add` or links an existing place; the source row gets the URL, the post date and the screenshot path), **Merge** (attach as another source of an existing place), **Dismiss**. Bulk-file is allowed only for rows already `resolved`.

## 10. Extending research later and re-synthesis

### 10.1 Research outputs: Markdown for people, a sidecar for the machine (Revised 4: records)

Each lane run writes `<lane>.md` and `<lane>.json` side by side. The sidecar schema `research-sidecar/1` lives in `core/src/schema/researchSidecar.ts` with the rest (exported into `data/schema/generated/schema.json`; revised 4):

| Field | Type | Meaning |
|---|---|---|
| `schema` | text | `research-sidecar/1` |
| `lane` | text | lane id (7.2) |
| `subject` | object | `{kind: trip|place|area|country, id}` |
| `researched` | date | |
| `agent`, `model` | text | `research-trails`, `claude-sonnet-...` |
| `md` | text | path of the Markdown twin |
| `geo` | object | `{countries: [], regions: [], areas: []}` for grouping |
| `trip_type` | object | `{duration_shape, movement_shape, styles: []}` copied from the trip at run time |
| `tags` | array | vocabulary tags |
| `sources` | array | `{id, url, title, publisher, kind, read}` |
| `facts` | array | `{key, value, unit, confidence (verified, stated, inference, gap, conflict), src: [ids], gap_reason, subject_ref}`; e.g. `{"key": "piratour.min_age", "value": null, "confidence": "gap", "gap_reason": "not stated on operator or resellers, checked 2026-10-13"}` |
| `records` | object | normalised entities in their target schema shapes (revised 4: the catalog tables of 2.3A): `places[]`, `trails[]` (plus `osm_relation`), `activities[]`, `stays[]`, `eateries[]`, `offers[]` with `offer_prices[]`, `legs[]`, `area_facts[]`, `items[]` (suggested timed items); each record has `match` keys and `src` |

### 10.2 Grouping, index, dedupe, merge

| Step | Tool | Rule |
|---|---|---|
| Group | folder layout | by subject: `research/trips/<slug>/` or `research/places/<place-id>/`; by lane: the file name; by date: the suffix of re-runs |
| Index | `research.index` (`core/src/research/`, revised 4) writes `research/INDEX.json` (committed, deterministic) | one row per sidecar: path, lane, subject, researched, geo, styles, tags, counts of facts and records, GAP count; the editor's "Research" tab and `trip-research` read it |
| Dedupe | `research.dedupe` (`core/src/research/`, shares the matcher of 0A.2) | records match on stable ids first (place id, wikidata, OSM relation, operator `book_url` host and path), then name within 2 km for places and trails, then provider plus product name for bookings; conflicting facts on the same key are kept side by side and marked `conflict` |
| Merge | `research.propose` (operation) | compares merged records and facts with the current `trip.json` (and locations or trails catalogue rows) and emits a proposal (5.4): new rows, changed fields, and conflicts; each change carries the sidecar path, fact keys and source ids |
| Provenance kept | `research_refs` row per file with its `sha256` at synthesis; `sources.research_ref`; every changed row's `src` | a later re-run is compared against the last synthesised hash, so only what is new or changed is proposed |

### 10.3 Extending research later

| Request | Path |
|---|---|
| "Add adventure research for this trip" | the `trip-research` skill or the editor's "Add research" button picks the lane; re-run mode (7.3) writes `research/trips/<slug>/adventure-<date>.md/.json`; `research.add_ref`; `research.propose` limited to that file; the owner reviews the proposal |
| "This country has a great hike, add it" | not tied to a trip: `place.add` (kind trail) under the country, then `trip-research --place <id> --lane trails` writes `research/places/<id>/trails.md/.json` and proposes a trail catalogue row with geometry; any trip that later adopts the place inherits the research ref |
| A trip adopts a place with research | `trip.adopt_place` adds the place's research refs to the trip's `research_refs` (by path, no copying) |

**Re-synthesis never applies silently.** A proposal lists, per change: the operation, the before and after, the reason ("adventure-2027-01-10.json: Piratour min age now stated as 6 by the operator, read 2027-01-10; was GAP"), and whether it conflicts with an owner edit made after the last synthesis (detected from `changelog.actor = owner|ui` on the same row since `research_refs.synthesised`). Conflicting changes are unticked by default. Earlier research files are never edited or deleted; a superseded fact is kept in its file and its row is marked superseded in the index.

## 11. Fares and cost comparison

Fares are a skill (`trip-fares`), a research lane (`fares`) and two tables in `trip.json`. The method is the one proven on 14 Oct 2026 for Patagonia (`research/trips/patagonia-feb-mar-2027/fares-window-compare.md` after P1): Playwright MCP `browser_run_code_unsafe` against Google Flights and Booking.com, because web search returns only aggregator averages.

### 11.1 Method (carried into the skill verbatim)

| Step | Rule |
|---|---|
| Google Flights, round trip | one UI search with the real party (adults, children with ages), then rebuild the `tfs` parameter: base64url-decode, replace the two date strings (same length), re-encode, load `/travel/flights/search?tfs=...&curr=CAD`; confirm the dates in the "Track prices from ... departing X and returning Y" header. The price is the total for the party |
| Google Flights, one way (domestic legs) | build `tfs` by hand: `08 1c 10 02` + segment + `40 01 40 01 40 02 48 01 70 01`; never append the trailing `82 01 ... 98 01 01` bytes (it flips to round trip); cheapest = the "from CA$X" header |
| Schedules not yet published | Aerolineas Argentinas opens about 100 days out: a later window returns nothing and is recorded as GAP, never as zero |
| Booking.com lodging | `searchresults.html?ss=..&checkin=..&checkout=..&group_adults=..&group_children=..&age=..&no_rooms=1&selected_currency=CAD&nflt=review_score%3D80`; default sort with the review filter; median of the first 12; regexes use `\s` because innerText uses non-breaking spaces; poll until prices render |
| Car | rental aggregators and the operator page for the chosen airports; deposit and gravel cover noted |
| Always | the read date and time, the currency, the party it was priced for, and the URL used |
| Helpers | `tools/fares/tfs.py` (encode, decode, swap dates, one-way builder) with unit tests against the bytes above |

### 11.2 Tables (Revised 4)

`fare_windows` and `fare_quotes` are specified in 2.3 (money as `total_amount` and `total_currency`). Derived per window: total in `trip.base_currency` (through `fx`), rank, and the difference against the plan's window. `editions.fare_window_id` links the chosen window; `budget` rows reference quotes (`basis: fare-read`), so choosing an edition updates the budget and the deadlines in one step.

### 11.3 Flow

`trip-fares compare --slug <slug> --windows <list or "every Saturday Jan-Mar">` runs the method per window (sequentially; one browser), writes `fares-window-compare-<date>.md/.json`, and proposes `fare.add_window` and `fare.add_quote` rows. The editor's "Windows" tab shows the comparison table (window, nights, international, domestic, lodging, car, total CAD, read date) with a "Choose this window" action (`edition.add` + `edition.choose`). An optional weekly price-watch scheduled task re-reads the chosen window's international fare and appends a quote; a change over 10% adds an open question.

## 12. Tooling carry-over map (Revised 4: one runtime per concern)

| Tool today | Lands in | Runtime | Owned by skill | Phase | Note |
|---|---|---|---|---|---|
| `_system/gallery.py`, `gallery_find.py`, `gallery_pick.py` (Commons pipeline) | `tools/gallery/` | Python | `trip-photos` | P1b move; P5c skill | **One sequential searcher**, never parallel agents (429 lasting 25+ minutes on 2026-10-12); the web `Gallery` reads `gallery.json` unchanged |
| per-trip `photos.py`, `fetch_photos.py`, `verify_photos.py` | replaced by `tools/gallery/` | Python | `trip-photos` | P5c | originals stay in `legacy/<slug>/` until the trip migrates |
| 4 copies of `sun-times.py` plus `dark-times.py` | `core/src/sun/` (sunrise, sunset, civil, nautical and astronomical twilight, azimuth and elevation), a port of `iceland-ring-road/sun-times.py`'s algorithm; used by day checks, plan pages and the planner in the browser | TypeScript | `trip-build`, `research-timing` | P4a | test against `research/trips/patagonia-feb-mar-2027/sun.md` (within 1 minute) and Iceland's darkness table; no Python `sun.py` (revised 4) |
| `canadian-rockies-sept-2029/check_links.py` | `tools/links.py` (HEAD then GET fallback, per-host pacing) | Python (owner-run, network) | `trip-verify` | P5c | the Rockies result (465 URLs, 9 broken) is the regression fixture, replayed from a recorded response file |
| two `anchor_check.py` copies | `tools/anchors.py` | Python | `trip-verify` | P5c | |
| Iceland `shots.py`, `verify.py` | `web/scripts/shots.ts`: Playwright screenshots at 2x, split into tiles for reading (revised 4: TypeScript, because Playwright is already installed in `web/` and Python Playwright would be a third-party dependency in `tools/`) | TypeScript | `trip-verify` | P5a (needed for the P5a review) | runs on `web/out` pages and legacy pages |
| `_system/tools/globe_data.py` | `tools/globe_data.py`; outputs to `web/public/geo/` in P6 | Python | `trip-build` (`places` step); heavy steps stay manual | P1a move, P6 outputs | |
| `_system/tools/locations.py`, `location_views.py`, `migrate_locations_v2.py` | `tools/` | Python | `location` | P1a; v3 in P2b | the one parity pair with `core`'s validator (1.5) |
| `_system/tools/locations_schema.sql` | `data/schema/legacy/`, then generated (`data/schema/generated/schema.sql`) | | | P1a, P2a | |
| `_system/tests/` (109 tests), `_system/tools/hooks/` | `tools/tests/`, `tools/hooks/` | Python, shell | all | P1a | |
| `_system/build.py` and the page system | `legacy/_system/` | Python | `trip-build` (legacy step) | P1b | retired when the last legacy page migrates |
| Rockies `merge_data.py`, `plan_tables.py` | absorbed into the deterministic Rockies mapping in `core/src/import/` | TypeScript | `trip-import` | P4c | stay in `legacy/` until that trip migrates |
| `publish.sh` heredoc hub | `tools/hub.py` | Python | `trip-publish` | P1b | byte-identical output |
| vault skill `make_maps.py` (CSV for map apps) | `web/lib/exports/` (GPX, KML, CSV, ICS per day and per trip, written at build) | TypeScript | `trip-build` | P5a | revised 4: was `tools/exports.py`; ICS needs the book-by dates, which are TS |
| (new) `tools/trails.py` | find, fetch, check, refetch (3A) | Python (owner-run, network) | `research-trails` | P5a | |
| (new) `tools/route.py` | ORS or OSRM fetch into route sidecars and catalog legs | Python (owner-run, network) | | P8 | |
| (new) `tools/geocode.py` | Wikidata then Nominatim through `locations.py`'s resolver, one request a second, report of misses | Python (owner-run, network) | `trip-import` | P4c | |
| (new) `tools/fares/tfs.py` | 11.1 | Python | `trip-fares` | P5c | |
| (new) `tools/conditions.py` | gate and routine payload (13) | Python | `trip-conditions` | P5c | reads trip.json; the 60-day gate runs in `prepublish.sh` |
| (new) research index, dedupe, lane selection | `core/src/research/`, `core/src/lanes/` | TypeScript | `trip-research`, `trip-planner` | P4b | revised 4: were `tools/research.py`, `tools/lanes.py` |
| (new) validate, generate, check-days, migrate | `core/bin/{validate,schema,migrate}.ts`, `core/src/checks/` | TypeScript | all | P2a, P2b | revised 4: was `tools/data.py`; `export`, `import` and `diff-d1` are Phase 2 (D28) |
| (new) entity views, search and spatial indexes | `web/lib/views/`, `web/lib/index/` | TypeScript | `trip-build` | P3a, P5b3 | revised 4: was `tools/views.py` |
| (new) theme tokens | `tools/theme_tokens.py` (reads the legacy theme CSS, writes `web/app/themes.css`) | Python | `trip-build` | P3a | shares the hex and contrast gate with `legacy/_system/build.py` |

## 13. Weather and conditions rules

| Piece | Rule |
|---|---|
| Default weather rules | `day.shape` (and `trip.import`) generates `weather_rules` from the profile: trail and boat days get `gust_kmh > weather_wind_gust_kmh` checked at the day's first item minus 60 min; `precip_mm` thresholds by rain tolerance (low: 1 mm/h, medium: 3 mm/h, high: none); `temp_max_c < weather_cold_c` and `> weather_heat_c` (heat moves the start earlier rather than to Plan B) |
| Plan B required | any day with a weather rule must have track `P` items or `plan_b_text`; missing is a validator warning on the day and an item in the plan's open questions |
| Conditions routine | `trip-conditions` creates a one-shot scheduled task for 07:00 local time two days before Day 1 of the chosen edition (and optionally one each morning on the trip). The task reads the trip through MCP (`get_trip` with `resolve`), pulls Open-Meteo forecasts for each base and each day's key items, the day-of closure links, road status (511 and equivalents) and seasonal trackers (foliage, snow), evaluates every weather rule, and ends with **one named verdict**: `GO`, `GO, PLAN B ON DAY n`, `SWAP DAYS n AND m`, or `DELAY`, plus the three reasons that drove it. Its id is stored in `editions.conditions_trigger` |
| The 60-day rule | no trip with a chosen edition starting within 60 days may lack `conditions_trigger`: `tools/conditions.py check` warns in `validate` from T-90, and **fails the pre-publish gate** from T-60; the home page shows the trip in red until it is set |
| Today | no dated trip is inside 60 days on 2026-10-17 (Vermont, Quebec and Algonquin are past). Patagonia (Day 1 = 26 Feb 2027) crosses T-60 on 28 Dec 2026, so its routine must exist by then |
| Re-planning | a `SWAP DAYS` verdict links to the editor with the swap pre-filled as a `day.swap` proposal; nothing changes without the owner |

## 14. Domain and hosting (Revised 4)

The site stays on the Cloudflare Pages project `nks-travel` at `https://nks-travel.pages.dev/`. A custom domain is bound later in the Pages dashboard; the only repo change is the hub footer line. To keep that true, the app must not hard-code the host:

| Do not hard-code | Instead |
|---|---|
| `nks-travel.pages.dev` in links | relative links everywhere (`/patagonia-feb-mar-2027/`); a test greps `web/out/` and fails on the string outside the footer and `robots.txt` |
| canonical URLs, Open Graph URLs, sitemap | `SITE_ORIGIN` read once at build (default `https://nks-travel.pages.dev`); switching domains is an env change and a rebuild |
| the API host | `NEXT_PUBLIC_API_ORIGIN`, read only when `NEXT_PUBLIC_EDITING` is `local` or `hosted` (revised 4: editing is an explicit flag, `off` on the deployed Phase 1 site) |
| analytics | `NEXT_PUBLIC_CF_BEACON_TOKEN` (Cloudflare Web Analytics, cookie-less; unset means no beacon; D30) |
| CORS allow-list in the Worker | from a Worker variable listing both origins |
| Google Maps Embed key restrictions | configured in Google Cloud for both hosts; the key itself is a build-time env value, not committed |
| Cloudflare Access applications | dashboard configuration per hostname |
| service worker scope and cache names | relative scope `/`; cache names keyed by build id, not host |
| iOS Shortcut endpoint | points at the API host; documented in `docs/` as the one place to update |

Open Graph tags (4.13) make `SITE_ORIGIN` load-bearing from P3a, so the test that greps `web/out/` for a hard-coded host runs from P3a.

Old `pages.dev` URLs keep working after the custom domain is added because Pages serves both; a later decision can redirect `pages.dev` to the custom domain with a single Bulk Redirect rule outside the repo.

## Appendix: Travel Finder design, adopted and rejected

Input: `research/vault-notes/travel-finder/*.md` (six documents).

| Travel Finder idea | Verdict | Where / why |
|---|---|---|
| URL as the single source of truth for filters, view and sort | adopted | 4.2 |
| Faceted filters with counts, removable chips, "never zero-out the world" with one-tap loosen | adopted | `FilterBar`, `EmptyState` |
| Persona quick-starts as saved filter presets | adopted as default saved views ("Family with young kids", "Hard hikes", "Rainy-day rescue") | 4.2 saved views |
| Map plus cards, switchable | adopted and extended to four views | 4.2 |
| MapLibre GL JS | adopted | 3B |
| RSC by default, client islands for map, filters, palette | adopted | 3B, 4.1 |
| JSON-LD (`TouristTrip`, `TouristAttraction`, `ItemList`) and `/llms.txt` | adopted (P3 lists, P5 plan pages) | cheap agent-readability |
| Documented read API and an MCP server over the same DTOs | adopted, generated from one catalogue | 5 |
| Command palette | adopted, without NL parsing in v1 | G13 |
| Place graph and route builder (precomputed edges) | deferred | needs a routing API (D13) |
| Supabase (Postgres + PostGIS + RLS) on Vercel | rejected | owner chose Cloudflare and git JSON; the dataset is small enough for client-side filtering and SQLite/D1 |
| The vault as the source of truth with one-way ingest | rejected | owner moved everything into this repo; `data/` is the record |
| Real drive-time from day one (Google Matrix) | rejected for Phase 1 | cost and key management for a single-owner tool; links instead |
| Claude-inspired palette (ivory, coral `#d97757`), Poppins and Lora | rejected | owner's rule against an "AI look"; the hub's own identity and trip themes are kept |
| Parallel and intercepting routes for modal detail | rejected | unsupported in static export; `DetailSheet` with `?focus=` instead |
| Postgres trigram search | rejected | a prebuilt client-side index is enough at this size |
| Accounts and favourites | rejected | single owner; Access in Phase 2 |

From `research/vault-notes/vault-trip-planner-skill/`: the intake question bank (style, pace, party, budget, activities) became the `profile` fields and the `trip-planner` intake; the budget categories (`getting-there`, `local-transport`, `lodging`, `food`, `activities`, `misc` with a 10-15% buffer) became the `budget.category` enum; the discovery "what to capture per place" list (why, time needed, cost, best time, cluster, logistics note with limits) maps to item and booking fields; the day-trip template shaped the day-trip rules in 2.7 C; `make_maps.py` became `tools/exports.py`.

## Sources

All checked 2026-10-17 unless noted. "Probed" means a live request from this machine on that date.

Trails, elevation, licences
- Waymarked Trails API, relation info and way-elevation (probed; the `/geometry/gpx` path returned 404): https://hiking.waymarkedtrails.org/api/v1/details/relation/10692471 and https://hiking.waymarkedtrails.org/api/v1/details/relation/10692471/way-elevation
- Waymarked Trails API source (route list): https://github.com/waymarkedtrails/waymarkedtrails-api
- 2023 blog using the old GPX path: https://www.r-bloggers.com/2023/11/osm-guadeloupe-trail-relation/
- OSM forum on mis-ordered relation members: https://community.openstreetmap.org/t/osm-wanderwege-fur-garmin-oder-komoot/109381
- Overpass API usage policy: https://wiki.openstreetmap.org/wiki/Overpass_API ; El Chalten bbox query (probed): https://overpass-api.de/api/interpreter
- OSM `sac_scale`: https://wiki.openstreetmap.org/wiki/Key:sac_scale
- OSMF attribution guidelines: https://osmfoundation.org/wiki/Attribution ; Licence FAQ: https://osmfoundation.org/wiki/Licence_and_Legal_FAQ
- Parks Canada "Trails APCA" dataset: https://open.canada.ca/data/en/dataset/64a90e8d-5bc0-4027-8645-b5881b4068d4
- Parks Canada trail ratings: https://www.parks.canada.ca/voyage-travel/experiences/sports/randonnee-hiking/niveaux-sentiers-trail-ratings ; classification: https://parks.canada.ca/amnc-nmca/on/super/activ/experiences/randonnees-hiking/classification
- NPS Public Trails feature service: https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0
- USFS National Forest System Trails: https://catalog-beta.data.gov/dataset/national-forest-system-trails-feature-layer
- Wanderland Schweiz (opendata.swiss): https://opendata.swiss/en/dataset/langsamverkehr-wanderland-schweiz ; closures: https://opendata.swiss/en/dataset/sperrungen-umleitungen-wanderwege-und-wanderland
- Quebec resort grading example (no Sepaq source found): https://www.lemassif.com/sites/default/files/2025-08/P-7673-Massif-Carte-2024-24x24-Rando.pdf
- Forestry England recreation routes grades: https://www.data.gov.uk/dataset/forestry-england-recreation-routes ; Forestry and Land Scotland: https://forestryandland.gov.scot/visit/things-to-do/trails
- Outdooractive platform: https://developers.outdooractive.com/Overview/Outdooractive-Platform.html
- Komoot API (partners only): https://static.komoot.de/doc/external-api/v007/index.html
- Wikiloc terms: https://www.wikiloc.com/wikiloc/terms_en.html
- Hiking Project data API closure: https://hikingproject.com/data
- Open-Meteo Elevation API: https://open-meteo.com/en/docs/elevation-api
- Mapterhorn: https://mapterhorn.com/ ; Protomaps on Mapterhorn: https://protomaps.com/blog/mapterhorn-terrain/

Web stack
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports (page dated 2026-08-09)
- Next.js 16: https://nextjs.org/blog/next-16
- shadcn/ui Base UI default: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- HeroUI on React libraries: https://heroui.com/blog/best-react-ui-component-libraries
- Mantine vs shadcn/ui: https://designrevision.com/compare/mantine-vs-shadcn.md
- AG Grid Community vs Enterprise: https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise.md ; pricing (third party): https://www.vendr.com/marketplace/ag-grid
- Tremor (joining Vercel, open source): https://tremor.so/
- Google Maps Embed API: https://developers.google.com/maps/documentation/embed ; embedding guide: https://developers.google.com/maps/documentation/embed/embedding-map

Cloudflare
- Static Next.js on Pages: https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
- Pages limits: https://developers.cloudflare.com/pages/platform/limits
- Workers static asset limits (2 Sep 2025): https://developers.cloudflare.com/changelog/2025-09-02-increased-static-asset-limits/
- Migrating from Pages to Workers: https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/
- Remote MCP servers on Workers: https://developers.cloudflare.com/agents/guides/remote-mcp-server/ ; build an MCP server: https://developers.cloudflare.com/agents/guides/build-mcp-server
- Cloudflare Access service tokens and the `Cf-Access-Jwt-Assertion` header: from Cloudflare One documentation, not re-checked for this plan

Revision 2 (prices, live data, licences; checked 2026-10-17)
- Amadeus self-service shutdown (17 Jul 2026): https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers (search summary; the page returned 403 to a direct fetch) ; https://apis.io/plans/amadeus/amadeus-plans-pricing/
- Kiwi Tequila (third-party sources only): https://ignav.com/docs/kiwi-tequila-alternative ; https://www.vervotech.com/hub/integrations/tequila-api/
- Skyscanner partner access (third-party sources): https://supergood.ai/api-report-card/skyscanner-api ; https://www.travelpayouts.com/blog/no-more-skyscanner-api-and-white-label/amp/
- Travelpayouts Aviasales Data API: https://support.travelpayouts.com/hc/en-us/articles/203956163 ; requirements: https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access
- Booking.com Demand API prerequisites: https://developers.booking.com/demand/docs/getting-started/prerequisites ; partner terms note: https://vorplabs.com/agent-tools/booking-demand-api
- Viator Partner API: https://docs.viator.com/partner-api/ ; https://partnerresources.viator.com/travel-commerce/technical-guide/
- GetYourGuide Partner API spec: https://github.com/getyourguide/partner-api-spec ; https://supergood.ai/api-report-card/getyourguide
- Frankfurter: https://frankfurter.dev
- Open-Meteo terms (fetched): https://open-meteo.com/en/terms
- geoBoundaries licence caveat (geobounds R package COPYRIGHTS): https://stat.ethz.ch/CRAN/web/packages/geobounds/COPYRIGHTS
- Google Flights URL formats (unofficial, vendor blog): https://scrapegraphai.com/blog/google-flights-api ; Google Maps URLs: https://developers.google.com/maps/documentation/urls (not re-checked)
- `_system/site/GLOBE-RESEARCH.md` for the globe's boundary sources (Natural Earth, geoBoundaries gbOpen)

Revision 3 (trip creation and routing; checked 2026-10-17)
- Wanderlog store listing: https://apps.apple.com/IN/app/id1476732439
- Roadtrippers help centre: https://support.roadtrippers.com/hc/en-us/articles/200632079-Planning-a-Trip ; get started: https://roadtrippers.com/get-started/ ; membership: https://roadtrippers.com/membership/
- Furkot automatic overnight stops: https://help.furkot.com/features/automatic-overnight-stops.html ; trip settings: https://help.furkot.com/features/travel-mode.html
- TripIt (third-party guide): https://10xtravel.com/tripit-everything-you-need-to-know/
- Google Maps lists: https://support.google.com/maps/answer/7280933
- Google Trips shutdown: https://alternativeto.net/news/2019/6/google-s-travel-planning-app-trips-is-shutting-down-on-august-5th-2019 ; trip summaries phased out: https://www.androidpolice.com/google-killing-this-scheduling-tool/
- Inspirock acquired by Klarna: https://www.emerce.nl/nieuws/klarna-koopt-online-reisplanner-inspirock ; status: https://craft.co/inspirock
- OSRM demo server policy: https://github.com/Project-OSRM/osrm-backend/wiki/API%20Usage%20Policy ; memory: https://github.com/Project-OSRM/osrm-backend/wiki/Disk-and-Memory-Requirements ; Germany in 16 GB (2018): https://lists.openstreetmap.org/pipermail/osrm-talk/2018-March/001649.html
- Valhalla (FOSSGIS demo, fair use): https://github.com/Valhalla/valhalla ; rate figure (unverified): https://cran.uni-muenster.de/web/packages/valh/vignettes/install-valhalla.html
- OpenRouteService plans: https://openrouteservice.org/plans/
- GraphHopper pricing: https://www.graphhopper.com/pricing/

Repo inputs: `CLAUDE.md`, `AUDIT-2026-10-16.md` 2.1-2.5, `_system/site/PLAN-locations-g5.md`, `_system/site/GLOBE-RESEARCH.md`, `locations/README.md`, `locations/locations.json`, `patagonia-feb-mar-2027/PLAN.md`, `patagonia-feb-mar-2027/research/fares-window-compare.md`, `canadian-rockies-sept-2029/data/*.json`, `globe/index.html`, `_system/base.js`, `publish.sh`, `research/vault-notes/**`, and the fares method memory note (2026-10-14).

### Change log

| Date | Change |
|---|---|
| 2026-10-17 | Revision 4: independent review applied (E1-E33, 0 rejected, one applied with a deviation: no `items.offer_id`); review claims re-checked, four wrong and three imprecise (section 0); canonical schema (2.2, 2.3, 2.3A; 2.8 removed); one runtime per concern and the `core/` package (1.5); Zod as the schema source (2.5, D26); phases re-split into P1a-P8 with file ownership (6); product basics (4.13); top-ten risks (8.5); D26-D30 (8.6); phase briefs in `docs/archive/v1/briefs/` |
| 2026-10-17 | First draft: brief plus addenda 1-4 folded in |
| 2026-10-17 | Revision 3: section 0B (trip creation experience, routing with breaks); 4.12, 5.8, 6.2, 8.4; P5 split into P5a and P5b; P8 added; D23 replaces D13 |
| 2026-10-17 | Revision 2: section 0A (catalog, flywheel, coverage, multi-user readiness, no-AI builder, prices and live data); revised 1.1, 1.4, 2.8, 4.11, 6.1, 7.6, 8.3; trails path moved to `data/catalog/trails/` |
