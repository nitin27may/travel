# Travel platform plan: research / data / web

Status: DRAFT for owner approval. Written 2026-10-17. Implementation starts the week after approval; no files move before then.

## 0. Summary, addenda folded in, gaps found

**Revision 2 (17 Oct 2026):** the product is now a global catalog plus trips that reference it, with a research flywheel, a coverage model, multi-user-ready schema, a no-AI trip builder and a free-data price approach. Read section 0A first; sections 1, 2, 4, 6, 7 and 8 carry "Revised" subsections where they changed.

**The plan in ten lines.**

1. Three layers: `research/` (raw, never published), `data/` (schema-versioned JSON in git, the system of record in Phase 1), `web/` (Next.js static export on the existing Cloudflare Pages project). Python tools in `tools/`, hand-built pages in `legacy/` until each trip migrates; every current URL keeps working (1.3).
2. One schema source (JSON Schema with SQL, UI and privacy annotations) generates the D1 DDL, TypeScript types, Zod and the operation catalogue (2.5).
3. `trip.json` is season-based: days are numbered, deadlines are offsets, an edition resolves dates. The unit is trip > day > timed item, with legs, Plan B and day checks (2).
4. Every bookable thing is a booking row with its opening window, sell-out speed, limits and a computed book-by date; every research agent returns bookings in one shared shape (2.3, 7.4).
5. Trails are a global catalogue with stored GeoJSON from OSM (Waymarked Trails) or agency datasets, an elevation profile, and a house difficulty scale 1-5 that keeps the local grade (3A).
6. Default UI stack: shadcn/ui (Base UI) + TanStack Table + Recharts profile + MapLibre; every entity gets cards, list, table (with an advanced filter panel) and map views from one descriptor, with the filter bar on top and all state in the URL (3B, 4.2).
7. One operation set serves the UI, the HTTP API, MCP and skills; imports and re-research produce proposals, never silent writes (5).
8. Phase 1 is read-mostly in the cloud, editable on the owner's machine; Phase 2 adds a Worker with D1, remote MCP and a nightly D1-to-git PR (3C, 5.6).
9. Six Sonnet-sized phases: restructure, schema, app and places, import two trips, plan pages with maps and trails, globe (6).
10. The 16 owner decisions are ranked in 8.2; D1 to D4 block the first two phases.

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
| G2 | "MapLibre 6": the exact version the globe vendors is not recorded | P1 records it; the app pins the same version |
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
| G13 | A quick-search or command palette (the Travel Finder's centrepiece) is not in the brief | Add a `/` and Ctrl+K palette in P5 over the static search index; no natural-language parsing in v1 |
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

### 0A.1 Catalog versus trip

**Rule:** a fact about the world lives once, in the catalog. A trip stores references to catalog rows plus what only that trip knows: day, time, track, party, notes, overrides, decisions, status, confirmation, and private data.

#### Catalog entities

| Entity | Store | Id pattern | Key fields beyond the common block |
|---|---|---|---|
| Geography (countries, regions, areas) | `data/locations/locations.json` (schema v2, unchanged) | `CA`, `CA/AB`, `CA/AB/banff` | as today |
| `place` | `data/locations/` | `CA/AB/banff/lake-louise` | kind, coordinates, wikidata, image (as today) |
| `trail` | `data/catalog/trails/<CC>.json` + `geo/` | place-style path | 2.3 trail catalogue row: km, gain, house grade, local grade, geometry ref |
| `activity` | `data/catalog/activities/<CC>.json` | `<area_id>/<slug>` | type (the adventure enum of 2.3), operator, duration_min, indoor (bool), weather_sensitive (bool), adventure_level 1-5 |
| `stay` | `data/catalog/stays/<CC>.json` | `<area_id>/<slug>` | kind (`hotel`, `lodge`, `cabin`, `apartment`, `hut`, `campsite`, `hostel`), comfort_tier 1-4, sleeps_max, elevation_m, car_free_access, last_transport |
| `eatery` | `data/catalog/eateries/<CC>.json` | `<area_id>/<slug>` | cuisine, price_tier 1-4, kids_menu (bool or null), reservation (`required`, `recommended`, `walk-in`), hours |
| `offer` | `data/catalog/offers/<CC>.json` | `of-<provider-slug>-<product-slug>` | the bookable product: everything in the bookings table of 2.3 that is not trip-specific (provider, `book_url`, `reseller_urls`, limits, `opens_*`, `sellout_*`, `same_day`, cancellation, weather refund), plus `subject` (`{entity, id}`: the activity, stay, trail permit, place ticket or leg it books) |
| `offer_price` | `data/catalog/offers/<CC>.json`, table `offer_prices` | `<offer_id>#<n>` | amount, currency, `per`, `age_from`/`age_to` for child bands, `valid_months`, `read` date, source, `window` (for flights) |
| `leg` | `data/catalog/legs/<CC>.json` | `<from_id>~<to_id>~<mode>` | from and to (any catalog ids with coordinates), mode, km, minutes, basis (`routed`, `timetable`, `matrix`, `inference`), seasonal notes (closures), symmetric (bool) |
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
| status | text | no | `raw` (machine-extracted, unreviewed), `proposed` (in a proposal), `verified` (reviewed or auto-accepted with an official source), `stale` (a field passed its freshness limit), `retired` |
| confidence | text | no | `verified`, `stated`, `inference`, `gap`, `conflict` |
| sources | json | no | source ids (table `sources` in the same file: url, title, publisher, kind, read date) |
| field_meta | json | no | per-field provenance for fast-expiring fields: `{"hours": {"read": "2026-10-13", "src": ["src-0041"]}, "price": {...}}` |
| verified_by | text | yes | actor id that last verified (`u_owner`, `agent:research-trails`) |
| last_verified | date | yes | |
| contributed_by | json | no | actor ids that created or edited the row (attribution) |
| licence | text | no | `own-words` (our summary, default), `odbl` (OSM-derived), `ogl-ca`, `cc-by-4.0`, `public-domain` |
| updated | date | no | |

#### Freshness policy per field class (`data/schema/src/freshness.json`)

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

`status` becomes `stale` when any field with a policy passes its limit; `tools/catalog.py freshness` recomputes it nightly at build time (deterministic for a given date) and writes backlog items (0A.3).

#### What a trip keeps

| Trip table | References | Trip-only fields |
|---|---|---|
| `items` | `place_id`, `trail_id`, `activity_id`, `eatery_id`, `offer_id`, `leg_id` | day, track, seq, start or window, duration, `override` (json: any catalog field replaced for this trip, e.g. a different start point), notes, Plan B pointer |
| `bases` | `stay_id` or `place_id` | nights, why, why not |
| `trip_activities` (replaces `adventures`) | `activity_id` | day, verdict, why, party fit (derived) |
| `trip_bookings` (replaces `bookings`) | `offer_id` | used_days, book-by (computed from the offer and the edition, editable), priority, status, price_paid (private), confirmation (private), contact (private), notes |
| `trip_trails` | `trail_id` | role, alternative_of, turnaround rule, party note, verdict (as 2.3) |

A trip-specific fact that the world should know (a corrected trail grade, a new opening window) is not an override: it is a catalog edit (0A.2). Overrides are for genuinely trip-specific choices.

### 0A.2 The flywheel: research always feeds the catalog

#### One ingestion path

| Step | Tool or operation | What happens |
|---|---|---|
| 1. Capture | any research agent, `trip-import`, the capture pipeline (section 9), a UI form | Markdown for people plus a `research-sidecar/1` sidecar (10.1) whose `records` are catalog-shaped rows (places, trails, activities, stays, eateries, offers with prices, legs, area-guide facts) |
| 2. Normalise | `tools/catalog.py normalise` (TS twin for the API) | units to metric, currencies kept with ISO codes, enums mapped (the Rockies' `guided_hike` to `guided-hike`), tags through the vocabulary, local difficulty to the house grade (3A), dates to ISO, ids proposed from the area hierarchy |
| 3. Match | `tools/catalog.py match` | in order: exact id; external ids (wikidata, OSM relation, operator `book_url` host + path); coordinates within 300 m plus name similarity of at least 0.85 (trigram) for places, stays, eateries; trailhead within 500 m plus name for trails; provider plus product name for offers. A match above threshold is "same entity"; between 0.6 and 0.85 is "possible duplicate" and always goes to review |
| 4. Merge | `tools/catalog.py merge` | per field: a new value with a newer read date and an equal or better source kind (`official` > `operator` > `press` > `reseller` > `blog` > `community`) replaces; an older or weaker value is kept as an alternative in `field_meta`; disagreeing values of equal strength become `conflict` |
| 5. Proposal | `catalog.propose` (operation, like `research.propose` in 5.4) | a diff of catalog changes plus any trip changes, each change with its sources, sidecar path and fact keys |
| 6. Review | the "Proposed changes" queue (UI) or a skill with explicit ids | auto-accept rules below; everything else waits for the owner |
| 7. Catalog | `catalog.apply` | rows written with `status`, `verified_by`, `contributed_by`; a `catalog_changes` row per change (who, when, op, before, after, proposal id) |
| 8. Reuse | every later trip, the builder (0A.5), coverage (0A.3) | the next trip in the area starts from the catalog, not from zero |

**New operations** (added to the catalogue of 5.3 and generated into the API and MCP like the rest): `catalog.add`, `catalog.edit`, `catalog.merge`, `catalog.retire`, `catalog.verify`, `catalog.propose`, `catalog.apply`, `catalog.coverage` (read), `backlog.list` (read), `backlog.add`, `planner.draft` (read: returns a draft, writes nothing). New MCP tools: `get_coverage`, `list_backlog`, `propose_catalog_change` (Phase 1 read tools for the first two; writes in Phase 2).

**Auto-accept rules** (owner can switch each off in `data/catalog/policy.json`):

| Change | Auto-accept when |
|---|---|
| New row (place, trail, activity, stay, eatery, offer, leg) | at least one `official` or `operator` source, no possible duplicate, all required fields present; lands as `verified` with `verified_by: agent:<lane>` |
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

### 0A.3 Coverage and the research backlog

#### Coverage score per area

`tools/catalog.py coverage` computes, for each area (and rolled up to region and country), a score per entity type and a weighted total. Every row counts by freshness: `verified` and fresh 1.0, `verified` but `stale` 0.5, `raw` or `proposed` 0.3, `retired` 0.

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
| priority | `trips_using * urgency * severity`: urgency 3 if a chosen edition starts within 120 days, 2 within a year, 1 otherwise; severity 3 for hard limits, booking windows and prices on must-book offers, 2 for hours and stats, 1 otherwise |
| status | `open`, `claimed` (by an agent run id), `done`, `wont-do` |
| created, done | dates |

Agents work it with `trip-research --backlog [--area <id>] [--limit 10]`: the top items are grouped by area and lane and run as normal lane jobs whose sidecars flow through 0A.2. The owner sees the backlog as a table view with the usual filters.

#### Coverage in the UI

Area pages and the builder show the band and the per-type counts ("Banff: good. 41 sights, 38 trails, 22 activities, 9 stays; 6 prices stale"). The globe gets a coverage layer (areas tinted by band). The builder warns before it plans in a thin area (0A.5).

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

### 0A.5 The no-AI trip builder

A deterministic planner over the catalog. It runs in the browser (pure TypeScript in `web/lib/planner/`, same day checks as 2.4), so it works on the static Phase 1 site with no server and no AI. Same inputs plus the same catalog snapshot always give the same draft (ties broken by id).

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

The builder ships (phase P7) only when two regions reach **good** coverage for their styles. From existing research the strongest are:

| Region | What exists today | Expected after import |
|---|---|---|
| Canadian Rockies (Banff, Yoho, Kootenay, Jasper, Kananaskis) | structured data: 48 sights, 62 trails, 43 adventures, 33 bookings, 16 bases | good in Banff, Lake Louise, Jasper and Kananaskis areas |
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
| 1. Deep links, prefilled | "Search flights", "Search stays", "Search cars", "Directions" buttons on the trip, each day and each booking row, carrying the edition dates and the party | Booking.com `searchresults.html` with `checkin`, `checkout`, `group_adults`, `group_children`, `age`, `selected_currency` (parameters verified in our 14 Oct research); Google Flights (a `q=` natural-language query, or a `tfs` built in the browser by the TS port of `tools/fares/tfs.py`; both are unofficial URL formats, P5 verifies them and keeps a test that the link opens a results page); Skyscanner and Kayak path-style search URLs (unofficial patterns, verified in P5); Google Maps URLs for directions and places (documented by Google) |
| 2. Reference price snapshots | "From CAD 3,437 for 3 people, read 14 Oct 2026" with a freshness badge (fresh, aging, stale per 0A.1) | `offer_prices` rows for offers and fare snapshots per route and window (the `fare_quotes` of section 11 move into the catalog as route-window snapshots: `{from, to, depart, return, party, total, currency, read, source}`) |
| 3. User-entered prices | "I found it for ..." on any booking or budget row | a private `price_paid` or a new snapshot with `source: user` (public only if the user shares it) |
| 4. Live lookups (only where free and allowed) | weather and FX now; optional Travelpayouts "typical fare" hint after D20 | cached at the edge for 6 hours (weather), 24 hours (FX), until `expires_at` (Travelpayouts) |

**The Playwright scraping of Google Flights and Booking.com is an owner-only research tool.** It stays in the `trip-fares` skill for the owner's own research and is never offered through the app, the API or MCP to other users, because: both sites' terms do not permit automated access, and offering it would put the site and its users in breach; it depends on undocumented internals (the `tfs` protobuf bytes, DOM text with non-breaking spaces) that break without notice; it uses the owner's machine and IP, so running it for others would also risk blocks on the owner's own browsing; and the result is a point-in-time price that must be shown with its read date anyway, which the snapshot layer already does. The skill checks `actor.id == u_owner` and refuses otherwise.

**Weather and FX in the plan.** When the chosen edition has dates: a forecast strip per base for the days within the forecast horizon (Open-Meteo forecast), climate normals per month otherwise (Open-Meteo historical data, cached at build); every money figure converts to the user's currency with "ECB rate of <date>" (Frankfurter). Both carry their attribution lines.

## 1. Target repo layout and migration table (Revised: 1.1, 1.4)

### 1.1 Target tree (Revised: catalog folders)

```
travel/
  CLAUDE.md                      short repo rules; points at skills and docs/
  README.md                      how to add a place, start a trip, publish
  publish.sh                     thin wrapper: exec python3 tools/publish.py "$@"
  docs/                          plans and audits (this file, AUDIT, GLOBE-RESEARCH, PLAN-locations-g5)
  research/                      RAW, never published, kept forever
    trips/<slug>/                <lane>.md files, PLAN.md originals, sun.md, fares-*.md, gpx/, screenshots/
    places/<CC>/<region>/<area>/<place>/   research not tied to a trip (path = place id)
    inbox/                       social captures and screenshots before resolution (was locations/inbox/)
    vault-notes/                 unchanged (already here)
  data/                          SYSTEM OF RECORD, schema-versioned JSON, in git
    schema/
      src/                       the ONE source: *.schema.json (JSON Schema 2020-12) with x-sql / x-ui annotations
      generated/                 schema.sql (D1/SQLite DDL), types.ts (TS types), zod.ts, ops.json (operation catalogue)
      difficulty-map.json        local grade -> house grade (3A)
    reference/                   countries.json (moved from _system/site/), currencies.json
    vocab/tags.json              shared tag vocabulary with aliases and kinds (style, activity, feature, audience, free)
    locations/                   locations.json (schema v2 -> v3 in P2), parts when split, WISHLIST.md (generated, private)
    catalog/                     the shared catalog beyond places (0A.1); one file per country per entity
      trails/                    <CC>.json rows; geo/<trail-id>.geojson geometry + profile; NOTICE-ODbL.md
      activities/  stays/  eateries/  offers/ (offers + offer_prices)  legs/  areas/ (area guides)
      policy.json                auto-accept rules (0A.2)
      freshness.json -> data/schema/src/freshness.json (policy lives with the schema)
      coverage.json              generated (0A.3)
      backlog.json               generated plus owner-added rows (0A.3)
      changes/                   catalog_changes, one JSONL file per month (who, when, op, before, after)
    trips/<slug>/
      trip.json                  one file per trip (section 2)
      prose/                     day-NN.md, orientation.md, answer.md ... long prose kept as Markdown, referenced by id
      gallery.json               moved from <slug>/gallery/gallery.json when the trip migrates
  web/                           Next.js app (App Router, TS strict, Tailwind, shadcn/ui); out/ is the static export
    app/  components/  lib/  mcp/  tests/  public/geo/ (globe admin TopoJSON, generated)
  api/                           Phase 2 only: Cloudflare Worker (Hono) for /api/v1 and /mcp, wrangler.jsonc, migrations/
  tools/                         ALL Python tooling (stdlib first; uv project with pyproject.toml)
    locations.py  location_views.py  migrate_locations_v2.py  globe_data.py
    data.py (validate, generate, export, import)  trails.py  sun.py  links.py  anchors.py  shots.py
    gallery/ (gallery.py, gallery_find.py, gallery_pick.py)  fares/ (window compare helpers)  hub.py  publish.py
    hooks/ (locations_changed.sh, data_changed.sh, prepublish.sh, ...)
    tests/  fixtures/
    .cache/                      gitignored (was _system/site/cache/)
  legacy/                        hand-built pages, live at their current URLs until each trip migrates
    _system/                     the legacy page builder: build.py, base.css, base.js, layout.html, themes/, components/, migrate.py, migrate_legacy.py, site/ (locations.html, site.css)
    <slug>/                      every trip folder as it is today minus research/ (index.html, PLAN.md, build_page.py, gallery/, assets/, archive/, data/)
    globe/                       the current globe page and assets (until the app's /globe route replaces it)
    locations/index.html         the generated list page (until the app's /places route replaces it)
  .claude/
    skills/  agents/  settings.json
```

Rules that keep the layers honest:

| Rule | Enforced by |
|---|---|
| Nothing under `research/` is ever copied to `.site/` | `tools/publish.py` allow-list plus a test that greps the staged tree for `research/` |
| `data/` is only written through operations (section 5): CLI, skill, UI export, API | PostToolUse hook validates any Claude write to `data/**`; CI validates every commit |
| `data/schema/generated/` is never hand-edited | `tools/data.py generate --check` in the test suite (byte-equal) |
| `legacy/` only shrinks | a test asserts no new folder appears in `legacy/` after P1 (list frozen in `legacy/MANIFEST.json`) |
| Trip slugs never collide with app routes | `data.py validate` rejects a slug in the reserved list: `places trips trails adventures bookings globe locations inbox api mcp data assets geo _next legacy` |

### 1.2 Migration table (today's path to the new one)

Every move happens in phase P1 with `git mv` (history kept), except where the "When" column says otherwise.

| Today | New | When | Note |
|---|---|---|---|
| `<slug>/` for the 16 trip folders (algonquin-muskoka-oct-2026, canadian-rockies-sept-2029, chamonix-mont-blanc-sept-2028, costa-rica-feb-2027, dolomites-july-2027, iceland-ring-road, new-hampshire-stopover-2026, niagara-day-aug-2026, norway-summer, patagonia-feb-mar-2027, peru, quebec-sept-2026, switzerland-2027, usa-southwest-rockies, vermont-fall-2026) | `legacy/<slug>/` | P1 | Whole folder moves; the URL stays `/<slug>/` because publish maps `legacy/<slug>/index.html` to `/<slug>/` |
| `<slug>/research/` | `research/trips/<slug>/` | P1 | Only `patagonia-feb-mar-2027/build_page.py` names a research path, and only in display text, so builds are unaffected |
| `<slug>/PLAN.md` | stays in `legacy/<slug>/` | P1 | Three builders parse it. When a trip migrates (P4+), it moves to `research/trips/<slug>/PLAN.md` (kept forever) and its content lives in `trip.json` + `prose/` |
| `<slug>/data/*.json` (Rockies only) | stays in `legacy/canadian-rockies-sept-2029/data/` | P1 | Input to `trip-import` in P4; after import it moves to `research/trips/canadian-rockies-sept-2029/lane-data/` |
| `<slug>/*.py` per-trip scripts (build_page, sun-times, dark-times, check_links, anchor_check, merge_data, plan_tables, photos, fetch_photos, verify_photos, shots, verify) | stay in `legacy/<slug>/` | P1 | One edit per `build_page.py`: `sys.path` gains `legacy/_system` (it is `HERE.parent / "_system"`, which still resolves after the move) and `tools/gallery`. The generic ones are replaced by `tools/sun.py`, `tools/links.py`, `tools/anchors.py`, `tools/shots.py` in P4 (section 12) |
| `<slug>/gallery/` | `legacy/<slug>/gallery/`, then `data/trips/<slug>/gallery.json` on migration | P1 / P4+ | `*-candidates.json` stays gitignored |
| `<slug>/archive/`, `<slug>/*.md` notes (BRAINSTORM, CALL-LIST, MASTER-*, OPTIONS-*, PARKING, DAYS) | `research/trips/<slug>/` | P1 | Prose research, not published today |
| `locations/locations.json` | `data/locations/locations.json` | P1 | Path change only; schema stays v2 in P1 |
| `locations/WISHLIST.md` | `data/locations/WISHLIST.md` | P1 | Generated |
| `locations/README.md` | `data/locations/README.md` | P1 | Paths updated |
| `locations/PRIORITIES.md` | `research/places/PRIORITIES.md` | P1 | Hand-written ranking prose |
| `locations/inbox/` | `research/inbox/` | P1 | `sources.screenshot` values are rewritten `locations/inbox/...` to `research/inbox/...` by a tested one-off in `tools/migrate_paths_p1.py` |
| `locations/index.html` | `legacy/locations/index.html` | P1 | Still generated by `location_views.py`; still served at `/locations/` |
| `globe/` | `legacy/globe/` | P1 | Still served at `/globe/`; `globe_data.py` writes there until P6 moves the outputs to `web/public/geo/` |
| `_system/build.py`, `base.css`, `base.js`, `layout.html`, `themes/`, `components/`, `migrate.py`, `migrate_legacy.py` | `legacy/_system/` | P1 | The legacy page builder. Themes are ported to web tokens in P3 by `tools/theme_tokens.py` (reads the CSS, writes `web/app/themes.css`), so colour has one source until legacy is gone |
| `_system/gallery.py`, `gallery_find.py`, `gallery_pick.py` | `tools/gallery/` | P1 | Imported by legacy builders through the added `sys.path` entry |
| `_system/gallery.html` | gone (gitignored, regenerable) | P1 | |
| `_system/README.md` | `legacy/_system/README.md` | P1 | |
| `_system/tools/*.py`, `locations_schema.sql` | `tools/`; the SQL moves to `data/schema/legacy/locations_schema.sql` until P2 generates it | P1 | `ROOT = Path(__file__).resolve().parents[1]`; `Paths` gains `data_root`, `legacy_root` |
| `_system/tools/hooks/` | `tools/hooks/` | P1 | `.claude/settings.json` paths updated in the same commit |
| `_system/tests/` (9 files, 109 tests) and `fixtures/` | `tools/tests/` | P1 | Path constants updated; the count must stay 109 passing |
| `_system/site/locations.html`, `site.css` | `legacy/_system/site/` | P1 | Templates for the legacy list page |
| `_system/site/countries.json` | `data/reference/countries.json` | P1 | |
| `_system/site/GLOBE-RESEARCH.md`, `PLAN-locations-g5.md` | `docs/` | P1 | |
| `_system/site/cache/` | `tools/.cache/` | P1 | gitignored |
| `AUDIT-2026-10-16.md` | `docs/AUDIT-2026-10-16.md` | P1 | |
| `research/vault-notes/` | unchanged | | Already in the research layer |
| `.claude/skills/location/`, `trip-planner/` | unchanged path; content updated in P1 (paths) and P4-P5 (new flow) | P1 | Section 7 |
| `.claude/settings.json` | unchanged path | P1 | Hook commands point at `tools/hooks/` |
| `.site/`, `.wrangler/`, `.pytest_cache/` | unchanged, gitignored | | |
| `publish.sh` | stays at the root as a 3-line wrapper; logic moves to `tools/publish.py` and the hub heredoc to `tools/hub.py` | P1 | Output must be byte-identical (test below) |

### 1.3 How publish keeps every URL working

`tools/publish.py` builds `.site/` from a route table, so where a file lives and where it is served are decoupled:

| Served at | Source, Phase 1 before migration | Source after a trip migrates |
|---|---|---|
| `/<slug>/` and `/<slug>/assets/` | `legacy/<slug>/index.html`, `legacy/<slug>/assets/` | `web/out/<slug>/` (the app's plan page at the same URL) |
| `/globe/` | `legacy/globe/` | `web/out/globe/` (P6) |
| `/locations/` | `legacy/locations/index.html` | `/places/` in the app; `/locations/` becomes a static redirect page plus a `_redirects` rule `/locations/* /places/:splat 301` |
| `/` hub | `tools/hub.py` (same output as today's heredoc) | the app's home page (P3), which lists migrated and legacy trips from `data/trips/index` plus `legacy/MANIFEST.json` |
| everything else in `web/out/` | not deployed in P1 | `/places/`, `/trips/`, `/trails/`, `/adventures/`, `/bookings/`, `/data/*.json` |

Collision rule: a slug is served from `web/out/` only when `data/trips/<slug>/trip.json` has `"web": {"published": true}`; otherwise the legacy page wins. `publish.py --check` fails if both or neither source exists for a published slug, and a test asserts that the set of served URLs after a change is a superset of the set before (stored in `tools/tests/fixtures/served-urls.txt`). Cloudflare Pages honours a static `_redirects` file, so no server is needed for moved routes.

**Acceptance for P1 in one line:** `PUBLISH_DRY_RUN=1 ./publish.sh` produces a `.site/` tree whose file list and bytes equal the pre-move tree (diffed by a script), and `python3 -m pytest tools/tests -q` reports 109 passed.

### 1.4 Revised: catalog layout and migration additions

| Today | New | When | Note |
|---|---|---|---|
| `locations/` (places and geography) | `data/locations/` (unchanged from 1.2) | P1 | the places and geography partition of the catalog; name kept because the brief and the 109 tests use it |
| (none) | `data/catalog/{trails,activities,stays,eateries,offers,legs,areas}/` | P2 creates empty files and schemas; P4 fills them by importing the Rockies and Patagonia | trails moved from the earlier `data/trails/` path |
| Rockies `data/{sights,trails,adventures,bases,bookings}.json` | sights to `data/locations/` places, trails to `data/catalog/trails/`, adventures to `data/catalog/activities/` + `offers/`, bases to `data/catalog/stays/` (where a property is named), bookings to `offers/` + the trip's `trip_bookings` | P4 | through the ingestion path (0A.2), not by hand |
| Patagonia PLAN.md tables | the same split | P4 | |

## 2. trip.json schema v1 (Revised: references into the catalog, see 2.8)

### 2.1 Decisions

| Decision | Choice | Why |
|---|---|---|
| Folder or single file | **Folder per trip:** `data/trips/<slug>/trip.json` plus `prose/*.md` plus `gallery.json` | Structured facts in one JSON file make every operation atomic (one file read, one write, one validation). Long narrative (orientation, the answer first, day narrative) stays Markdown so diffs are readable and Opus can write it naturally; JSON points at it by path. The gallery already has its own contract and tool |
| Row shape | Relational, the locations v2 pattern: the root holds named tables (arrays of flat rows with ids); nested objects only where the value is never filtered or joined | Maps one-to-one to D1 tables; the same validator rules (FK, unique, enums, contiguous positions) as locations |
| Dates | **Season-based.** Days are `n` (0..N, 0 = travel day before Day 1); every date-like field is relative (`offset_days` from Day 1 of an edition) or a month list. Absolute dates exist only on `editions` | A plan survives a change of year; an edition resolves real dates, the countdown, the booking calendar and the conditions routine |
| Trails | **A global catalogue** in `data/catalog/trails/`, referenced by trips through `trip_trails` | Geometry is heavy and reused (Chamonix, Dolomites and Switzerland share valleys; the Rockies trails will be reused by any later Rockies trip); "part of N plans" falls out of the join |
| Adventures, bookings | Per trip | Prices, limits checked, and deadlines are trip-specific; an adventure may carry a `place_id` for cross-trip lists |
| Ids | Trip id = slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, not in the reserved list). Row ids are slugs unique within their table (`laguna-esmeralda`, `bk-piratour`), except days (`n`) and items (`d03-i02`, generated) | Human-readable, stable, matches the Rockies data today |
| Provenance | Every row may carry `src` (array of `sources.id`) and `confidence` (`verified`, `stated`, `inference`, `gap`, `conflict`) | The plans already use VERIFIED / INFERENCE / GAP / CONFLICT in prose; this makes it filterable and lets the page render the same badges |
| Privacy | Fields tagged `x-private: true` in the schema (traveller ages, heights, weights, booking confirmation numbers, phone numbers of hosts, prices paid) are never written to the static export; the export allow-list is generated from the schema | One rule, enforced at the schema, tested by grepping the export |

Types, as in locations v2: `text`, `int`, `real`, `bool`, `json`, `date` (ISO), `month` (1-12), `hhmm` (`^([01]\d|2[0-3]):[0-5]\d$`), `offset` (int days relative to Day 1 of the chosen edition; negative = before), `money` (`{amount: real, currency: ISO 4217}`). "Null?" = may be null.

### 2.2 Root object

Key order: `schema_version` (1), `id`, `updated`, then the tables in this order: `trip`, `profile`, `travellers`, `trip_tags`, `editions`, `bases`, `days`, `day_tracks`, `items`, `trip_trails`, `adventures`, `bookings`, `hazards`, `weather_rules`, `budget`, `fx`, `fare_windows`, `fare_quotes`, `documents`, `emergency`, `packing`, `knowledge`, `questions`, `gotchas`, `research_refs`, `sources`, `changelog`. Unknown keys and unknown columns are rejected. Empty tables are `[]`.

### 2.3 Tables

**trip** (exactly one row, an object)

| Column | Type | Null? | Rule |
|---|---|---|---|
| slug | text | no | equals root `id` and the folder name |
| title | text | no | "Argentine Patagonia" |
| subtitle | text | no | one line, shown on cards |
| status | text | no | `idea`, `researching`, `planned`, `booked`, `travelled`, `dropped` |
| primary_style | text | no | one of the core styles: `adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `mixed` |
| duration_shape | text | no | enum `day-trip` (0 nights), `weekend` (1-2), `short-break` (3-5), `week` (6-9), `multi-week` (10+); validated against `nights` |
| movement_shape | text | no | enum `single-base`, `two-bases`, `multi-base`, `road-trip`, `hut-to-hut`, `camper`, `cruise` |
| party_shape | text | no | enum `solo`, `couple`, `family-young`, `family-teen`, `family-mixed`, `friends`, `multi-gen`; default derived from travellers |
| countries | json | no | sorted ISO2 list, FK `countries.code` in locations |
| region_label | text | no | "Patagonia, Argentina" (for cards and the hub) |
| season_months | json | no | sorted distinct months 1-12; the season the plan is designed for |
| season_note | text | no | "late Feb to mid Mar: penguins still at Martillo, Chalten winds easing" |
| nights | int | no | sum of `bases.nights` (validated) |
| origin | text | no | "Toronto (YYZ)" |
| theme | text | yes | legacy theme name (`alpine-snow`) or app theme token set |
| hero_image | text | yes | Commons `Special:FilePath` URL |
| answer_prose | text | yes | path under `prose/`, the "answer first" block |
| orientation_prose | text | yes | path under `prose/` |
| web_published | bool | no | the app serves `/<slug>/` (1.3) |
| legacy_url | text | yes | `/<slug>/` while the legacy page exists |
| created | date | no | |

**profile** (exactly one row; drives research lanes, day shaping and Plan B, section 7.3)

| Column | Type | Null? | Rule |
|---|---|---|---|
| pace | int | no | 1 (slow) to 5 (packed) |
| comfort | text | no | `lean`, `mid`, `comfortable`, `splurge` |
| budget_target | json | yes | money: total for the party |
| budget_tier | text | no | same enum as comfort |
| must_do | json | no | array of `{text, ref}`; `ref` is a place, trail or adventure id or null |
| avoid | json | no | array of text ("no 03:00 starts", "no hut nights") |
| hiking_ceiling_km | real | yes | the Norway "12 km round trip" rule |
| hiking_ceiling_gain_m | int | yes | |
| max_house_grade | int | yes | 1-5; trails above it go to Track A only |
| weather_rain | text | no | tolerance `low`, `medium`, `high` |
| weather_wind_gust_kmh | int | yes | above this, Plan B (default 50) |
| weather_cold_c | int | yes | below this daytime high, Plan B |
| weather_heat_c | int | yes | above this, Plan B or early start |
| base_preference | text | no | `few-long` (2+ nights each), `balanced`, `many-short`, `campsite-only` |
| car_free | bool | no | |
| transport | json | no | subset of `own-car`, `rental-car`, `camper`, `train`, `bus`, `domestic-flight`, `ferry`, `bike`, `taxi-app`, `walk` |
| kids_mode | text | no | `none`, `young` (under 8), `mid` (8-12), `teen`, `mixed`; derived default from travellers, may be overridden |
| early_starts | text | no | `never`, `sometimes`, `fine` (governs 05:00 sunrise hikes) |
| lanes_extra | json | no | lane ids forced on (section 7.3) |
| lanes_skip | json | no | lane ids forced off |
| notes | text | no | `""` |

**travellers** (PK `id`; `x-private` except `label` and `role`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `t1`, `t2` ... |
| label | text | no | "Adult 1", "Child (13)" |
| role | text | no | `adult`, `child`, `infant` |
| age_years | int | yes | at `age_as_of` |
| age_as_of | date | yes | the age at an edition = `age_years + floor((edition.start - age_as_of)/365.25)` |
| height_cm | int | yes | |
| weight_kg | int | yes | |
| fitness | int | yes | 1-5 |
| notes | text | no | `""` |

**trip_tags** (PK `tag_id`): `tag_id` text, FK `data/vocab/tags.json` id, canonical only. The vocabulary has a `kind` column (`style`, `activity`, `feature`, `audience`, `free`). Style tags: `adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `family`, `romantic`, `hidden-gems`, `mixed`. `trip.primary_style` must also appear here. The same vocabulary serves `place_tags` (locations v3) and `trail_tags`.

**editions** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `e2027`, `e2027-b` |
| label | text | no | "Window A, 26 Feb 2027" |
| year | int | no | |
| start | date | no | the date of Day 1 |
| end | date | no | the date of the last day; `end - start + 1` must equal the number of days with `n >= 1` |
| status | text | no | `candidate`, `chosen`, `booked`, `travelled`, `cancelled`; at most one `chosen` or `booked` |
| why | text | no | the reason for this window |
| fare_window_id | text | yes | FK `fare_windows.id` (section 11) |
| conditions_trigger | text | yes | the scheduled-task id of the T-2 conditions routine (section 13) |

Derived from the chosen edition (never stored): each day's date and weekday, the countdown, every booking's absolute deadline, sun times (`tools/sun.py` writes `derived/sun-<edition>.json`, gitignored and rebuilt), traveller ages, the "Harberton is closed on Tuesdays" style weekday checks (an `items.closed_weekdays` rule is validated against the resolved weekday and warns).

**bases** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `ushuaia` |
| name | text | no | |
| place_id | text | yes | FK locations `places.id` (kind `town` or `lodge`) |
| night_from | int | no | day `n` of the first night |
| nights | int | no | >= 1; bases may not overlap; together they cover every night |
| lodging | text | yes | property name once chosen |
| booking_id | text | yes | FK `bookings.id` |
| lat, lon | real | yes | required when `place_id` is null |
| elevation_m | int | yes | |
| why | text | no | the defence column of the night split |
| why_not | text | no | `""` |

Check-in day = `night_from`, check-out day = `night_from + nights`; on the page they resolve to dates.

**days** (PK `n`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| n | int | no | 0..N contiguous; 0 only for an overnight departure |
| title | text | no | the day's theme: "Harberton and the Isla Martillo penguin landing" |
| kind | text | no | `travel`, `hike`, `sightseeing`, `city`, `rest`, `buffer`, `mixed` |
| base_id | text | yes | where you sleep that night (derived from bases, stored for speed; validated) |
| summary | text | no | one or two sentences |
| prose | text | yes | `prose/day-03.md` |
| flexible_group | text | yes | days that can swap with each other ("chalten-weather" for Days 7-9) |
| decision_rules | json | no | array of text |
| plan_b_title | text | yes | Plan B card title; its items are the day's track `P` items |
| plan_b_text | text | yes | |
| sun_note | text | yes | light guidance ("Echo Rock back-lit until about 13:30"); sunrise and sunset themselves are derived per edition |
| day_of_links | json | no | array of `{label, url, kind}` (`closures`, `forecast`, `parking`, `tel`, `webcam`) |
| accepted_warnings | json | no | day-check codes the owner accepted (`pace`, `daylight` ...); still displayed, never blocking |

**day_tracks** (PK `day`+`track`): `day` int FK days.n; `track` `A`, `B`, `C`, `P`; `audience` `adult-only`, `family`, `less-walking`, `plan-b`; `title` text; `notes` text; `split` bool (the group splits for the day).

**items** (PK `id`; unique `day`+`track`+`seq`). The timed unit: trip > day > item. (The audit called these "stops"; a road-trip night stop is an item of type `checkin`.)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `d08-i03` (generated: day, item) |
| day | int | no | FK days.n |
| track | text | yes | null = whole group; `A`, `B`, `C` = fitness tracks; `P` = Plan B items (shown on the Plan B card, not in the main timeline) |
| seq | int | no | 1..n contiguous per day and track; this is the chronological order |
| start | hhmm | yes | fixed start ("14:00 Piratour departs") |
| window_start, window_end | hhmm | yes | a flexible window instead of a fixed start ("departs between 15:10 and 16:00"); at most one of `start` or the window |
| duration_min | int | no | planned duration including breaks |
| type | text | no | `activity`, `trail`, `sight`, `meal`, `transfer`, `checkin`, `checkout`, `buffer`, `rest`, `flight`. "Optional" is the flag below, so any type can be optional |
| optional | bool | no | rendered "(optional)"; excluded from the pace check |
| title | text | no | |
| place_id | text | yes | FK locations places |
| trail_id | text | yes | FK data/catalog/trails; required when type = trail |
| adventure_id | text | yes | FK adventures |
| base_id | text | yes | required when type = checkin or checkout |
| booking_id | text | yes | FK bookings |
| lat, lon | real | yes | when no place, trail or base supplies coordinates; every item except `buffer` and `rest` must resolve to coordinates |
| address | text | yes | offline fallback text |
| leg_mode | text | yes | travel FROM the previous item (from the night's base for seq 1; from `trip.origin` on a day trip): `drive`, `walk`, `bus`, `shuttle`, `train`, `ferry`, `boat`, `flight`, `taxi`, `bike`, `none` |
| leg_km | real | yes | |
| leg_minutes | int | yes | |
| leg_basis | text | yes | `matrix`, `routed`, `timetable`, `inference` |
| leg_notes | text | no | tolls, fuel, cell dead zones, parking |
| cost | json | yes | money plus `per` (`person`, `group`, `vehicle`) when there is no booking |
| open_from, open_to | hhmm | yes | opening hours for that weekday, from research |
| closed_weekdays | json | no | ISO weekdays 1-7, checked against the resolved date |
| needs_daylight | bool | no | must finish before sunset; defaults true for trails |
| plan_b_item_id | text | yes | FK items (track `P`): what replaces this item if its weather rule fires |
| notes | text | no | `""` |
| links | json | no | `{label, url, kind}`; kinds: `official`, `operator`, `alltrails`, `google-maps`, `osm`, `komoot`, `outdooractive`, `wikiloc`, `waymarked`, `webcam`, `other` |

Travel legs are columns on the item they arrive at, so the order and the "does the leg fit" check work on one pair of rows. A separate legs table was rejected: it created a second ordering to keep in sync.

**trip_trails** (PK `trail_id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| trail_id | text | no | FK `data/catalog/trails` id |
| role | text | no | `track-a`, `track-b`, `track-c`, `optional`, `listed`, `rejected` |
| alternative_of | text | yes | trail_id this replaces for family or less walking |
| turnaround_rule | text | yes | "At Poincenot camp by 11:00 or turn back" |
| party_note | text | no | "Only if experienced with 8-10 h days" |
| kid_fit | text | no | `yes`, `strong-kid`, `no`, `unknown` (for this party) |
| verdict | text | no | why in, why not |

**Trail catalogue row** (`data/catalog/trails/<CC>.json`, table `trails`, PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `AR/santa-cruz/el-chalten/laguna-de-los-tres` (same hierarchy as places) |
| name | text | no | |
| place_id | text | yes | FK locations places when the trail is also a saved place |
| area_id | text | no | FK locations areas |
| km | real | yes | stated round-trip distance (or one way when `shape` = point-to-point) |
| km_range | text | yes | "20.9-22" when sources disagree |
| gain_m | int | yes | stated |
| loss_m | int | yes | |
| hours | text | yes | "7-10 h" |
| shape | text | no | `out-and-back`, `loop`, `point-to-point`, `network` |
| house_grade | int | yes | 1-5 (3A) |
| house_basis | text | no | `technical`, `effort`, `effort-only` |
| local_system | text | yes | `sac`, `parks-canada`, `sepaq`, `nps`, `yds`, `uk`, `apn`, `dnt`, `other` |
| local_grade | text | yes | verbatim: "T3", "Difficult", "Medium" |
| local_source_url | text | yes | |
| trailhead_lat, trailhead_lon | real | yes | |
| trailhead_name | text | yes | |
| season_months | json | no | |
| hazards | json | no | text array |
| permit | text | yes | "Los Glaciares pass" |
| geometry_file | text | yes | `geo/<id-with-slashes-as-dashes>.geojson` |
| geometry_source | text | yes | `osm`, `parks-canada`, `nps`, `usfs`, `swisstopo`, `manual-gpx` |
| geometry_source_id | text | yes | `r4485261` for OSM |
| geometry_fetched | date | yes | |
| official_url, alltrails_url, komoot_url, outdooractive_url, wikiloc_url | text | yes | link-outs (3A says which may be embedded) |
| stats_confidence | text | no | `verified`, `stated`, `inference`, `gap`, `conflict` |
| src | json | no | source ids (in the trail file's own `sources` table) |
| notes | text | no | `""` |

**adventures** (PK `id`) (superseded in revision 2 by `trip_activities` plus the catalog `activity`, see 2.8): the activity as planned. Its price, hard limits and booking terms live on the linked booking row (below), because that is the bookable product and every research agent writes bookings in one shape (section 7.4).

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | |
| name | text | no | |
| type | text | no | `boat-tour`, `cruise`, `kayak`, `canoe`, `rafting`, `glacier-walk`, `ice-trek`, `guided-hike`, `via-ferrata`, `climbing`, `canyoning`, `zipline`, `gondola`, `train`, `heli`, `scenic-flight`, `horse`, `cycling`, `wildlife`, `hot-springs`, `spa`, `snorkel-dive`, `ski`, `dog-sled`, `cave`, `4x4`, `food-tour`, `show`, `museum-tour`, `other` (the Rockies' 13 values map onto these; `guided_hike` becomes `guided-hike`) |
| place_id | text | yes | |
| day | int | yes | the day it is planned on |
| verdict | text | no | `in`, `optional`, `swap`, `cut` |
| why | text | no | |
| booking_id | text | yes | FK bookings; null only when nothing is bookable or payable |
| src | json | no | |

Fit is derived per traveller at an edition from the booking's limits: a traveller fails when their age, height or weight at the edition is outside a limit. The page shows "Fits all", "Not for Child (11)" or "Limits unknown". Heights and weights are private, so the public export carries only the verdict.

**bookings** (PK `id`) (superseded in revision 2: the product fields move to the catalog `offer`, the trip keeps `trip_bookings`, see 2.8; the computed book-by rule below is unchanged): every bookable or payable thing: adventure, tour, permit, parking reservation, hut, hotel or lodge, timed-entry ticket, ferry, rental car, restaurant, spa, flight, pass, insurance. Written by whichever research agent found it (section 7.4), consolidated by the bookings audit, edited by the owner.

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `bk-piratour` |
| item | text | no | |
| category | text | no | `flight-intl`, `flight-domestic`, `lodging`, `hut`, `car`, `ferry`, `tour`, `activity`, `permit`, `parking`, `timed-entry`, `restaurant`, `spa`, `pass`, `insurance`, `transport`, `other` |
| provider | text | yes | operator or agency |
| book_url | text | yes | the direct booking page (operator or permit system) |
| reseller_urls | json | no | cross-check links (Civitatis, GetYourGuide, Viator, Booking.com) |
| contact | text | yes | email, phone or WhatsApp (x-private when personal) |
| used_days | json | no | day numbers |
| price | json | yes | money plus `per` (`person`, `adult`, `group`, `vehicle`, `night`, `room`) |
| price_child | json | yes | array of `{age_from, age_to, amount, currency}` age bands |
| price_read | date | yes | when the price was read |
| price_basis_year | int | yes | 2026 when a 2026 price is used as the pattern for 2027 |
| price_variance | text | yes | "peak Dec-Feb about 30% higher" |
| min_age, max_age | int | yes | hard limits of the product |
| min_height_cm, max_height_cm | int | yes | |
| min_weight_kg, max_weight_kg | int | yes | |
| other_limits | text | yes | "BMI 30+ excluded", "medical form" |
| limits_status | text | no | `verified`, `stated-by-reseller`, `none-stated`, `gap` |
| opens_kind | text | no | `always-open`, `rolling-lead` (opens N days before the date of use), `fixed-date` (a calendar date for the season), `monthly-release` ("on the 1st for the next month"), `lottery`, `on-arrival` (walk-up only), `unknown` |
| opens_lead_days | int | yes | for `rolling-lead`: 90 means it opens 90 days before the used day |
| opens_rule | text | yes | the rule in words: "lottery 1-31 January", "Parks Canada launch day in late January" |
| opens_evidence | text | yes | where the window was read, or, when `unknown`, what was checked and when |
| sellout_kind | text | no | `never`, `minutes-after-release`, `days`, `weeks`, `months`, `unknown` |
| sellout_lead_days | int | yes | typical days before the used day that it is gone |
| sellout_peak | text | yes | "Saturdays and the Christmas fortnight" |
| same_day | text | no | `yes`, `no`, `sometimes`, `unknown` |
| cancellation | text | yes | |
| weather_refund | text | yes | |
| book_by_offset | offset | yes | the recommended book-by, relative to Day 1 (computed, then editable) |
| book_by_basis | text | no | `computed`, `owner`, `inference` |
| deadline_date | date | yes | only when a rule is absolute for one edition; bound by `edition_id` |
| edition_id | text | yes | |
| priority | text | no | `urgent`, `must`, `should`, `optional` |
| status | text | no | `todo`, `held`, `booked`, `paid`, `walk-up`, `sold-out`, `cancelled`, `not-needed` |
| confirmation | text | yes | x-private |
| found_by | text | no | lane id of the agent that captured it (`adventure`, `trails`, `stays`, `relax-luxury`, `road-trip`, `sights`, `logistics`, `fares`, `owner`) |
| src | json | no | |

**Recommended book-by, computed** (by `bookings.compute_book_by`, shared TS/Python implementation with a parity test). With `U` = offset of the first used day:

| Opening and sell-out | book_by_offset |
|---|---|
| `minutes-after-release` | the opening offset itself (be online at release); the Timeline shows the exact release time when `opens_rule` has one |
| `rolling-lead` | `max(U - opens_lead_days, U - sellout_lead_days - 14)`: two weeks before it typically sells out, but never before it opens; with no sell-out figure, the opening itself |
| `fixed-date` / `monthly-release` / `lottery` | the opening (or lottery close) date for the edition, which may be absolute, so it is written to `deadline_date` |
| `never` sells out | `U - 7` (or `U - 1` for walk-up tickets that exist) |
| `unknown` | `U - 120` for flights and lodging in a peak month, `U - 60` for tours, `U - 30` otherwise; `book_by_basis = inference` and a GAP flag on the row |

The Timeline (section 4.5) lists bookings by resolved book-by date with a derived state: `not-yet-open` (today before the opening), `open`, `urgent` (open and book-by within 14 days, or past), `booked`, `sold-out`.

**hazards** (PK `id`): `category` (`wind`, `cold`, `heat`, `water`, `glacier`, `wildlife`, `terrain`, `altitude`, `crime`, `health`, `road`, `remoteness`, `other`), `title`, `text`, `severity` 1-3, `days` json, `trail_ids` json, `place_ids` json, `mitigation` text, `src`.

**weather_rules** (PK `id`): `day` int or null (null = every day), `metric` (`gust_kmh`, `wind_kmh`, `precip_mm`, `precip_prob`, `temp_max_c`, `temp_min_c`, `snowline_m`, `visibility`), `op` (`>`, `>=`, `<`, `<=`), `value` real, `at` hhmm (when to check), `action` text ("do Plan B"), `plan_b_day` int. Defaults are generated from `profile.weather_*` by the `day.shape` operation and can be edited.

**budget** (PK `id`): `category` (`getting-there`, `local-transport`, `lodging`, `food`, `activities`, `passes`, `insurance`, `misc`), `item`, `per_person` money or null, `group_low`, `group_high` money, `basis` (`fare-read`, `snapshot`, `operator`, `inference`, `gap`), `read_date` date, `booking_id`, `fare_window_id`, `src`. **fx** (PK `currency`): `currency`, `per_cad` real, `as_of` date, `source` (`frankfurter.app`, `assumption`). Totals are derived in CAD.

**fare_windows**, **fare_quotes**: section 11.

**documents** (PK `id`): `item` (`passport-validity`, `visa`, `eta`, `minors-consent`, `insurance`, `idp`, `park-pass`, `vaccination`, `other`), `applies_to` (`all`, `adults`, `children`, a traveller id), `rule` text, `deadline_offset` offset, `computed_rule` (`return-plus-6-months` and similar, evaluated per edition), `src`, `status`.

**emergency** (PK `base_id`): `number`, `hospital_name`, `hospital_lat`, `hospital_lon`, `hospital_tel`, `rescue_tel`, `embassy`, `insurer_tel` (x-private), `roadside_tel`, `src`.

**packing** (PK `id`): `item`, `reason` (`hut`, `van`, `glacier`, `kids`, `rain`, `cold`, `altitude`, `boat`, `city`), `qty`. Ticking happens in the browser (localStorage), not in the data.

**knowledge** (PK `id`): `claim`, `status` (`verified`, `inference`, `gap`, `conflict`), `src`. **questions** (PK `id`): `text`, `status` (`open`, `answered`, `dropped`), `answer`, `asked` date. **gotchas** (PK `id`): `text`, `src`.

**research_refs** (PK `id`): `path` (under `research/`, must exist), `sidecar` (the structured `.json` beside it, section 10.1), `lane` (section 7.3 lane id), `title`, `added` date, `sha256` (of the file when last synthesised; section 10 uses it to detect new research), `synthesised` date or null.

**sources** (PK `id`): `src-0001` sequential; `url`, `title`, `publisher`, `kind` (`official`, `operator`, `reseller`, `press`, `blog`, `community`, `video`, `computed`), `checked` date, `research_ref` (which research file cited it).

**changelog** (PK `seq`): `seq` int, `date`, `actor` (`owner`, `ui`, `skill:<name>`, `mcp`, `import`), `op` (operation name from section 5), `summary`, `refs` json. Every operation appends one row; the page's change log renders it.

### 2.4 Validation rules beyond the per-column ones

**Structural (errors):** FKs inside the file and into `data/locations` and `data/catalog/trails`; contiguous `days.n` and `items.seq`; bases cover every night exactly once (no bases and no nights for a day trip); `trip.nights` equals the sum of `bases.nights` and matches `duration_shape`; an edition's length equals the day count; at most one chosen edition; every `src` id exists; every `research_refs.path` exists; `primary_style` in `trip_tags`; items of type `trail` have a `trail_id`, `checkin` and `checkout` have a `base_id`; `rolling-lead` bookings have `opens_lead_days`; a Plan B pointer targets a track `P` item on the same day.

**Day checks (`tools/data.py check-days`, the same function in TS for the editor; warnings, shown on the day in the editor and listed by `validate`)**, per day and per track (whole-group items are merged into each track's timeline):

| Check | Rule |
|---|---|
| Order | items sorted by `seq` have non-decreasing effective start (fixed `start`, else `window_start`, else the previous end plus its leg) |
| No overlap | `start(i) + duration(i) + leg_minutes(i+1) <= start(i+1)` for fixed starts; a window passes when the earliest arrival is before `window_end` |
| Leg present | any change of coordinates over 300 m between consecutive items needs `leg_mode` and `leg_minutes` |
| Daylight | items with `needs_daylight` end before sunset for the chosen edition (from `tools/sun.py`); for a trail the end is `start + duration` |
| Opening hours | an item with `open_from`/`open_to` starts after opening and ends before closing; `closed_weekdays` against the resolved weekday |
| Booking used | an item with a booking whose `used_days` excludes this day is flagged |
| Pace | the active time (sum of non-optional item durations and legs, excluding `rest`) is within the profile's budget: pace 1 = 5 h, 2 = 7 h, 3 = 9 h, 4 = 11 h, 5 = 13 h; travel days count driving at 1.5x |
| Hiking ceiling | the sum of trail km and gain on a track is within `hiking_ceiling_km` / `hiking_ceiling_gain_m`, and a Track B or C trail is within `max_house_grade` |
| Early start | an item before 06:00 when `early_starts = never` |
| Deadlines | a booking whose book-by is past for the chosen edition and still `todo` (shown on the page as overdue) |

### 2.5 One source, two generated

```
data/schema/src/*.schema.json     JSON Schema 2020-12, restricted subset, with x-sql, x-ui, x-private, x-rules
          |
          +-- tools/data.py generate --> data/schema/generated/schema.sql   (SQLite/D1 DDL: tables, PK, FK, CHECK, json_valid)
          |                         --> data/schema/generated/types.ts    (TypeScript types)
          |                         --> data/schema/generated/zod.ts      (Zod schemas for forms and the API; messages from x-ui)
          |                         --> data/schema/generated/ops.json    (operation catalogue for MCP and API, section 5)
          +-- read directly by Python (jsonschema via uv) and by the MCP "describe" tool
```

- **Why JSON Schema as the source, not Zod:** Python tools validate on every hook and must not need Node; MCP clients consume JSON Schema natively; JSON Schema diffs are reviewable. The generator only accepts a subset (object, string with enum/pattern/format, integer/number with min/max, boolean, array, nullable via `["x","null"]`, local `$ref`), which keeps the TS and Zod generators small (about 400 lines in total) and fully tested.
- **Cross-field rules** (2.4) are declared in `x-rules` (`fk`, `unique`, `contiguous`, `sum_equals`, `date_order`, `covers`) and interpreted by both the Python validator and a TS validator. A **parity test** runs both over every fixture (valid and deliberately broken) and asserts identical verdicts and error codes.
- **Locations joins the same source in P2:** `locations.schema.json` reproduces schema v2; the generated DDL must load in SQLite with the existing tests, and `test_schema_sqlite.py` is extended to load trips and trails too with `PRAGMA foreign_key_check` empty.
- **DDL mapping:** each table becomes a D1 table with a leading `trip_id` column (except catalogue tables); `json` columns get `CHECK (json_valid(col))`; money becomes two columns (`<col>_amount`, `<col>_currency`) because budget totals and filters need them.


### 2.6 Trip type taxonomy (metadata for filters and research lanes)

| Dimension | Field | Enum or free | Values | Drives |
|---|---|---|---|---|
| Duration shape | `trip.duration_shape` | enum | `day-trip`, `weekend`, `short-break`, `week`, `multi-week` | list filter; day trips skip the stays, entry and fares lanes; the page drops Bases, Timeline buckets beyond T-14 and Emergency per base |
| Movement shape | `trip.movement_shape` | enum | `single-base`, `two-bases`, `multi-base`, `road-trip`, `hut-to-hut`, `camper`, `cruise` | `road-trip` and `camper` run the road-trip lane and render drive legs prominently; `hut-to-hut` runs huts inside the stays lane |
| Style | `trip.primary_style` (one) + `trip_tags` of kind `style` (many) | controlled vocabulary with aliases | `adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `family`, `romantic`, `hidden-gems`, `mixed` (`luxury` is an alias of `luxury-relax`) | the main filter chip group; the globe colour option; the lane selection table (7.3) |
| Season | `trip.season_months` | enum months 1-12 | | "good in" filter; editions must fall inside it (warning) |
| Party | `trip.party_shape` + `travellers` | enum + rows | see above | `kid_fit` filters and adventure fit; `family-*` forces the kid-limit columns in the adventure lane |
| Free tags | `trip_tags` of kind `activity`, `feature`, `audience`, `free` | free, but normalised through the vocabulary (new tags are added with `tag.add`, aliases resolve) | `penguins`, `glaciers`, `larches`, `fall-colours` | search, secondary chips |

### 2.7 Worked examples

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
    {"id": "d08-i01", "day": 8, "track": null, "seq": 1, "start": "06:30", "window_start": null, "window_end": null, "duration_min": 30,
     "type": "meal", "optional": false, "title": "Breakfast and packed lunch", "place_id": null, "trail_id": null, "adventure_id": null,
     "base_id": "el-chalten", "booking_id": null, "lat": null, "lon": null, "address": null,
     "leg_mode": "none", "leg_km": null, "leg_minutes": null, "leg_basis": null, "leg_notes": "",
     "cost": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": false, "plan_b_item_id": null, "notes": "", "links": []},
    {"id": "d08-i02", "day": 8, "track": "A", "seq": 2, "start": "07:15", "window_start": null, "window_end": null, "duration_min": 540,
     "type": "trail", "optional": false, "title": "Laguna de los Tres and back", "place_id": null,
     "trail_id": "AR/santa-cruz/el-chalten/laguna-de-los-tres", "adventure_id": null, "base_id": null, "booking_id": "bk-glaciares-flexipass",
     "lat": -49.3226, "lon": -72.8889, "address": "Trailhead at the north end of Av. San Martin, El Chalten",
     "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "From the lodging to the trailhead",
     "cost": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": "d08-p01",
     "notes": "21.5 km, about 950 m; about 450 m in the last 2.4 km", "links": []},
    {"id": "d08-i02b", "day": 8, "track": "B", "seq": 2, "start": "08:30", "window_start": null, "window_end": null, "duration_min": 270,
     "type": "trail", "optional": false, "title": "Laguna Capri and Mirador Fitz Roy loop", "place_id": null,
     "trail_id": "AR/santa-cruz/el-chalten/laguna-capri-mirador-fitz-roy", "adventure_id": null, "base_id": null, "booking_id": "bk-glaciares-flexipass",
     "lat": -49.3226, "lon": -72.8889, "address": "Same trailhead",
     "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "",
     "cost": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": "d08-p01",
     "notes": "11.7 km, 390 m", "links": []},
    {"id": "d08-i03b", "day": 8, "track": "B", "seq": 3, "start": "14:00", "window_start": null, "window_end": null, "duration_min": 120,
     "type": "rest", "optional": false, "title": "Back in town: cafe, rest", "place_id": null, "trail_id": null, "adventure_id": null,
     "base_id": null, "booking_id": null, "lat": -49.3315, "lon": -72.8863, "address": "El Chalten centre",
     "leg_mode": "walk", "leg_km": 0.8, "leg_minutes": 12, "leg_basis": "inference", "leg_notes": "",
     "cost": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": false, "plan_b_item_id": null, "notes": "", "links": []},
    {"id": "d08-i09", "day": 8, "track": null, "seq": 9, "start": "19:30", "window_start": null, "window_end": null, "duration_min": 90,
     "type": "meal", "optional": false, "title": "Dinner together", "place_id": null, "trail_id": null, "adventure_id": null,
     "base_id": null, "booking_id": null, "lat": -49.3315, "lon": -72.8863, "address": "El Chalten centre",
     "leg_mode": "walk", "leg_km": 0.5, "leg_minutes": 8, "leg_basis": "inference", "leg_notes": "",
     "cost": {"amount": 30, "currency": "USD", "per": "person"}, "open_from": "19:00", "open_to": "23:00", "closed_weekdays": [],
     "needs_daylight": false, "plan_b_item_id": null, "notes": "", "links": []},
    {"id": "d08-p01", "day": 8, "track": "P", "seq": 1, "start": "10:00", "window_start": null, "window_end": null, "duration_min": 180,
     "type": "trail", "optional": false, "title": "Chorrillo del Salto", "place_id": null, "trail_id": "AR/santa-cruz/el-chalten/chorrillo-del-salto",
     "adventure_id": null, "base_id": null, "booking_id": null, "lat": null, "lon": null, "address": null,
     "leg_mode": "walk", "leg_km": 1.0, "leg_minutes": 15, "leg_basis": "inference", "leg_notes": "",
     "cost": null, "open_from": null, "open_to": null, "closed_weekdays": [], "needs_daylight": true, "plan_b_item_id": null, "notes": "", "links": []}
  ],
  "weather_rules": [
    {"id": "wr-08", "day": 8, "metric": "gust_kmh", "op": ">", "value": 50, "at": "06:00", "action": "Do Plan B or swap with Day 9", "plan_b_day": 9}
  ]
}
```

What the day checks report on it: Track A active time is 30 + 12 + 540 + 8 + 90 = 680 min (11 h 20), over the pace-3 budget of 9 h, so the editor shows "Track A exceeds pace 3 by 2 h 20; accepted as the trip's one hard day?" and the import records it as an accepted warning (`accepted_warnings` on the day, an array of check codes, so the warning stays visible but does not block). Daylight passes: a 07:15 start plus 9 h ends 16:15, sunset on 5 Mar is 20:38 and civil dawn 06:56, so the 07:15 start is in daylight (research/sun.md, computed).

**B. A road-trip day with drive legs and a night stop** (shape from the Quebec prologue: Ile d'Orleans to Derby Line to Hyde Park; times illustrative).

```json
{
  "trip": {"duration_shape": "short-break", "movement_shape": "road-trip"},
  "bases": [{"id": "hyde-park", "name": "Hyde Park, VT", "night_from": 3, "nights": 1, "lat": 44.594, "lon": -72.616, "why": "Night stop before Stowe"}],
  "items": [
    {"id": "d03-i01", "day": 3, "track": null, "seq": 1, "start": "08:30", "duration_min": 15, "type": "checkout", "title": "Check out", "base_id": "ile-d-orleans", "leg_mode": "none"},
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

### 2.8 Revised: what trip.json keeps once the catalog exists

The catalog entities and their common block are specified in 0A.1. This section lists the trip-side changes; everything else in 2.1-2.7 stands.

**trip** gains:

| Column | Type | Null? | Rule |
|---|---|---|---|
| owner_id | text | no | `u_owner` today |
| visibility | text | no | `public`, `unlisted`, `private` |
| generated_by | text | yes | `planner@<version>` when the builder made the first draft; null otherwise |
| shared_with | json | no | `[]` today; actor ids later |

**items** gains `activity_id`, `eatery_id`, `offer_id`, `leg_id` (FKs into the catalog) and `override` (json: catalog fields replaced for this trip only). The inline `leg_*` columns stay as the values actually used; when `leg_id` is set they default from the catalog leg and the validator warns if they differ by more than 20% without an override note.

**bases** gains `stay_id` (FK catalog stays; nullable until a property is chosen).

**trip_activities** (PK `activity_id`; replaces `adventures`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| activity_id | text | no | FK catalog activities |
| day | int | yes | |
| verdict | text | no | `in`, `optional`, `swap`, `cut` |
| why | text | no | |
| offer_id | text | yes | the product chosen when an activity has several (a combo with transfer, say) |

**trip_bookings** (PK `id`; replaces `bookings`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `bk-piratour` |
| offer_id | text | yes | FK catalog offers; null only for one-off private arrangements (then `item` is required) |
| item | text | yes | label when no offer |
| used_days | json | no | |
| book_by_offset | offset | yes | computed from the offer's window and sell-out (2.3 rule), editable |
| book_by_basis | text | no | `computed`, `owner`, `inference` |
| deadline_date | date | yes | absolute rules, bound to `edition_id` |
| edition_id | text | yes | |
| priority | text | no | `urgent`, `must`, `should`, `optional` |
| status | text | no | `todo`, `held`, `booked`, `paid`, `walk-up`, `sold-out`, `cancelled`, `not-needed` |
| price_paid | json | yes | money; x-private |
| confirmation, contact | text | yes | x-private |
| notes | text | no | |

**catalog_changes** (catalog side, `data/catalog/changes/YYYY-MM.jsonl`): `seq`, `at` (datetime), `actor` (`{id, via}`), `entity`, `id`, `op` (`add`, `edit`, `merge`, `retire`, `verify`), `before` (json), `after` (json), `reason`, `proposal_id`, `sources`.

**DDL notes.** Catalog tables carry no `trip_id`; trip tables carry `trip_id` and join to the catalog by FK. `owner_id` and `visibility` are indexed on `trips`. `field_meta` and `contributed_by` are JSON columns with `json_valid` checks; `status`, `last_verified` and `area_id` are scalar and indexed for coverage queries.

**Example change (Patagonia Day 3).** `items[d03-s01].booking_id: "bk-piratour"` now points to `trip_bookings[bk-piratour]`, whose `offer_id` is `of-piratour-harberton-martillo` in `data/catalog/offers/AR.json`. That offer holds the provider, `book_url`, the GAP on minimum age, the season window "to 31 Mar (2026 pattern)" and a price snapshot `{amount: 140, currency: "USD", per: "adult", read: "2026-10-13", source: blog}`; the trip row holds only `used_days: [3]`, `book_by_offset: -88`, `priority: must`, `status: todo`. A second trip to Ushuaia reuses the offer and its snapshots.

## 3. Research spikes
### 3A. Trail geometry, metadata and difficulty normalisation

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

1. `research-trails` writes `research/<slug>/trails.md` as today (claims with URLs), plus one row per trail in a structured block.
2. For each trail it runs `tools/trails.py find --name "Laguna de los Tres" --near -49.33,-72.89` (Overpass bbox search, 5 km box, cached) and records the candidate `osm_relation` with its name, or `null` with the reason.
3. `tools/trails.py fetch <trail-id>` pulls geometry by priority: agency dataset (when `geometry.source` is `parks-canada`, `nps`, `swisstopo`) then WMT relation then a hand-supplied GPX/GeoJSON in `research/<slug>/gpx/`. It writes `data/catalog/trails/geo/<trail-id>.geojson` (simplified) and the profile, and stamps `fetched` and `source_url`.
4. `tools/trails.py check` validates: line length within 15% of stated km (warn), start within 300 m of the trailhead coordinates (warn), the profile present.
5. The trail row in `data/catalog/trails/` is written through the shared operation `trail.upsert` (section 5), never by hand.

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
| Geometry, simplified (Douglas-Peucker 5 m, 5 decimal places, about 1 m precision) | 8-25 KB raw for a 5-20 km trail, about a third gzipped | One file per trail: `data/catalog/trails/geo/<trail-id>.geojson` |
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

### 3B. Component library

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

**Accessibility tests that come with this choice** (headless means we own them): axe-core in Playwright on every list view in all four modes; keyboard-only path through the filter bar, the advanced panel, a grid cell and the view switcher; `aria-sort` on sortable headers; focus returns to the trigger after the detail sheet closes; WCAG AA contrast checked against the theme tokens with the gate `_system/build.py --check` already runs.

**MapLibre GL JS integration.** The globe already vendors MapLibre and uses OpenFreeMap styles. In the app:

| Piece | Decision |
|---|---|
| Package | `maplibre-gl` from npm, pinned to the version the globe uses today, imported only inside client components with `next/dynamic` (`ssr: false`) so the RSC page stays static HTML |
| Wrapper | A thin house hook (`useMap`) over the raw API rather than `react-map-gl`, so a MapLibre major upgrade does not wait for a wrapper release |
| Styles | OpenFreeMap `liberty`, `positron`, `dark` (no key); Mapterhorn `raster-dem` for hillshade and 3D terrain |
| Data | GeoJSON sources built at export time (`/data/...json`), so the map reads the same files offline from the cache (4.8) |
| Profile link | `ElevationProfile` (shadcn chart over Recharts, an `AreaChart` of `[distance, elevation]`) and `MapView` share a tiny store (`useSyncExternalStore`); hovering the profile moves a marker along the line, hovering the line highlights the profile point |

**Gotcha:** the brief says "MapLibre 6". The globe page vendors whatever version is in `globe/assets/vendor/`; phase P1 records the exact version in `web/package.json` and the globe route must use the same one, or the two maps will diverge in projection and style-spec support.

### 3C. Cloudflare: static export, Pages Functions + D1, remote MCP

Checked 2026-10-17.

| Question | Finding | Consequence for this plan |
|---|---|---|
| Does Next.js static export still work, and with what limits? | Yes (`output: 'export'`, docs updated 2026-08-09). Server Components run at build time. Unsupported: dynamic routes without `generateStaticParams` or with `dynamicParams: true`, Route Handlers that read the Request (only `GET` with `dynamic = 'force-static'`), cookies, rewrites, redirects, headers, proxy (ex-middleware), ISR, default image optimisation, Draft Mode, **Server Actions**, intercepting routes | Every route has `generateStaticParams` from `data/`. No Server Actions, so Phase 1 forms cannot save to a server (4.7 explains what they do instead). No intercepting-route modals; the detail card is a client sheet driven by `?focus=`. Images use plain `<img>` with Commons `?width=` URLs (what the pages do today). Legacy URL redirects are files, not `next.config` |
| Next.js 15 or 16? | Next.js 16 shipped 21 Oct 2025 (middleware renamed to `proxy.ts`, deprecated not removed); 16.1 needs Node 20.9+ | Recommend **Next.js 16** (the brief said 15). Nothing in static export changes; starting on 15 means a forced migration within months. Owner decision D2 |
| Pages or Workers for hosting? | Cloudflare now says "we recommend using Workers to deploy your Next.js site" and newer docs point at vinext/OpenNext on Workers; Pages still works and is not deprecated; Pages Free: 20,000 files and 25 MiB per file; Workers static assets: 100,000 files on paid plans since 2 Sep 2025 | **Stay on the Pages project `nks-travel` for Phase 1.** The hostname `nks-travel.pages.dev` is what is shared and bookmarked; a Worker would serve on `*.workers.dev` until a custom domain is bound. Re-evaluate at Phase 2 once the custom domain exists (then the host can move with no URL change) |
| File-count budget | Today: globe 432 admin files plus legacy pages; the app adds one HTML and one RSC payload per route | Under 2,000 files at Phase 1; a build test fails above 15,000 (headroom under 20,000) |
| Pages Functions + D1 | Pages and Workers use the same `d1_databases` binding; migrations applied with `wrangler d1 migrations apply --remote` before deploy | Workable, but the MCP server is better as a Worker (below), so Phase 2 puts the API in that Worker too, one codebase |
| Remote MCP on Workers | Cloudflare documents `createMcpHandler()` (stateless, Streamable HTTP, fastest path) and `McpAgent` (a Durable Object per session, state and elicitation). Authless and authenticated templates exist. Claude Code connects with `claude mcp add <name> --transport http <url>` | Phase 2: one Worker `nks-travel-api` with Hono routes `/api/v1/*` and `/mcp` (`createMcpHandler`, stateless; our tools need no session state). Both call the same operation functions (section 5). Phase 1 ships a **local stdio MCP** (`web/mcp/` run by Node against the JSON in git) with read tools, so Claude Code can explore before any cloud write path exists |
| Auth for a single owner | Cloudflare Access can protect a hostname or path with email one-time PIN and issue service tokens (headers `CF-Access-Client-Id`, `CF-Access-Client-Secret`) | Writes and `/mcp` sit behind Access. The browser signs in with a PIN; Claude Code uses a service token passed as headers in `claude mcp add --header ...`, the secret kept in the OS keychain, never in Claude settings. The Worker also checks the `Cf-Access-Jwt-Assertion` header itself (defence in depth) |
| D1 to git export | A Worker cron cannot run our Python tests or push to git without holding a GitHub write token | A scheduled **GitHub Action** (nightly, plus manual dispatch) calls `GET /api/v1/export` with a read token, writes `data/`, runs `tools/data.py validate` and the full test suite, and opens a PR `data: D1 export <date>`. Git history stays the audit log and nothing reaches `main` that fails a test |

## 4. Web app information architecture (Revised: 4.11)

### 4.1 Routes

| Route | What | Data at build | Phase |
|---|---|---|---|
| `/` | Home: upcoming trips with countdown, the next 10 booking deadlines across trips, inbox count (Phase 2), links to the four lists and the globe | `data/trips/*`, `legacy/MANIFEST.json` | P3 |
| `/trips/` | Trips list, four views | all `trip.json` plus legacy manifest rows (legacy trips appear with a "legacy page" badge) | P3 (legacy rows), P4 (data trips) |
| `/<slug>/` | Plan page (4.5); same URL as today | `data/trips/<slug>/` | P5 |
| `/<slug>/print/` | Print layout, one day per page | same | P5 |
| `/<slug>/edit/` | Trip editor (forms, 4.7); rendered in the export but only active when an API is reachable | same | P5 (local), Phase 2 (hosted) |
| `/places/` | Places list, four views (replaces `/locations/`) | `data/locations` | P3 |
| `/places/<CC>/<region>/<area>/<place>/` | Place page: map, stats, sources, "part of N plans", research links (owner-only) | same | P3 |
| `/trails/`, `/trails/<id...>/` | Trails list and trail page (map, profile, badge, source links) | `data/catalog/trails` | P5 |
| `/adventures/` | Adventures across trips, with limits and fit | all trips | P5 |
| `/bookings/` | Every booking across trips as a Timeline and the four views | all trips with a chosen edition | P5 |
| `/globe/` | The globe (4.6) | `data/locations`, trips, `web/public/geo/` | P6 |
| `/inbox/` | Capture review queue (section 9) | API only | Phase 2 |
| `/schema/` | Generated documentation of every entity type and operation (also what MCP's `describe` returns) | `data/schema/generated` | P2 |
| `/data/<entity>.json` | Static JSON views per entity (`entity-view/1`), read by the client for filtering and by the read-only MCP | build output | P3 |

Static export rules applied: every dynamic segment has `generateStaticParams`; no Server Actions, cookies, rewrites or headers; trailing slashes on (`trailingSlash: true`) so `/patagonia-feb-mar-2027/` maps to `.../index.html` as today; redirects are a generated `_redirects` file.

### 4.2 One entity contract, four views for free

Every list renders through `EntityPage<T>` and one descriptor per entity. A new entity type (for example `stays` later) gets cards, list, table and map views, the filter bar, the advanced panel, the detail sheet and the forms by writing a descriptor; most of it is generated from the schema's `x-ui` annotations.

```ts
// web/lib/entities/types.ts
export interface EntityDescriptor<Row> {
  type: 'place' | 'trip' | 'trail' | 'adventure' | 'booking';
  schemaId: string;                       // data/schema/src/<type>.schema.json
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
| Before you go | Timeline of deadlines T-90 ... day-of, with checkboxes | `BookingTimeline` | bookings (computed book-by) |
| Before you go | Documents and entry | `DocumentsChecklist` | documents |
| Before you go | Packing | `PackingChecklist` | packing |
| Orient | What this place is, sub-regions, what to know | `Prose`, `RegionCards` | orientation prose |
| Orient | Photo gallery | `Gallery` (lightbox) | `gallery.json` |
| Orient | Bases and route, night split with the defence column | `NightSplit`, `RouteMap` | bases, days |
| Days | Day N sections: theme, date, sun and light, time-chip timeline, Track A/B/C tabs, `DayMap`, weather rule chips, Plan B card, decision rules, day-of links | `DaySection`, `TimeChips`, `TrackTabs`, `WeatherRuleChip`, `PlanBCard`, `DayOfLinks`, `SunTimes` | days, day_tracks, items, weather_rules, derived sun |
| Reference | Trails (table plus maps), Adventures with limits and fit, Where to stay, Budget, Hazards, Gotchas | `TrailTable`, `AdventureTable`, `StayTable`, `BudgetTable`, `HazardList`, `GotchaList` | trip_trails + trails, adventures + bookings, bases, budget + fx, hazards, gotchas |
| Reference | Emergency per base | `EmergencyCards` | emergency |
| Close | State of knowledge, open questions, change log | `KnowledgeTable`, `QuestionList`, `ChangeLog` | knowledge, questions, changelog |

Sticky day navigation with scrollspy, and "today mode" (when the date is inside the chosen edition the page opens on today's day with its sun times and forecast link at the top).

### 4.6 Globe route

`/globe/` ports today's `legacy/globe/index.html` into a client component with the same look (MapLibre globe projection, OpenFreeMap styles, admin TopoJSON drill-down country > ADM1 > ADM2, the gazetteer search) and the same hash parameters (`c`, `s`, `d`, `p`, `style`, `spin`, `terrain`, `pins`). Additions: an entity switch (places, trips, trails), pins coloured by `status` or by `style` (a legend toggle), and the list filters (`q`, `country`, `style`, `status`, `kid`, `grade`, `season`, `tag`) read from the query string so "show me these on the globe" from any list keeps its filter. A pin click opens the same `DetailSheet` as the lists. The geo assets move from `legacy/globe/assets/` to `web/public/geo/` (written by `tools/globe_data.py`). Parity test: the same set of drill paths and the same pin counts as the legacy globe for the same data.

### 4.7 Creating and editing in the UI

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
| Phase 1, on the owner's machine | `pnpm data:serve` runs the file-backed API on localhost; operations write `data/**` in the working tree, the same validators run, the PostToolUse-equivalent check runs inline | the last deploy, built from git | commit (the editor offers "Commit these changes" with a generated message listing the operations), then `./publish.sh` |
| Phase 1, the deployed static site | forms are visible but disabled with "Editing works on the owner's machine or after Phase 2" | the last deploy | - |
| Phase 2 | the hosted API writes to D1 (the draft) | the last deploy, built from git | "Publish" runs the export action (git PR from D1, tests, merge, deploy). A trip page shows "Unpublished edits since <date>" in the editor only |

### 4.8 Embeds and links, per provider

Everywhere a place, item, trail or route appears, the row shows our map first, then the link row. Rule: **embed only what loads without our key in a static page or with a referrer-restricted key, and always render the outbound link too.**

| Provider | Embed or link | Key or account | Offline | Notes |
|---|---|---|---|---|
| Our MapLibre map with stored GeoJSON | Embed (primary) | none | lines, items and profile work from the cache; basemap tiles only if cached | 4.9 |
| Google Maps Embed API (place mode per place, directions mode per day) | Embed, lazy, behind a "Show Google map" button | API key required (Maps Embed API is free and unlimited); restrict by HTTP referrer to `nks-travel.pages.dev` and the future custom domain; the key ships in the page | none | Minimum size 200 x 200; may show ads. Directions mode waypoint limits to be verified in P5 |
| Google Maps link (`https://www.google.com/maps/search/?api=1&query=lat,lon`) and directions (`/maps/dir/?api=1&origin=&destination=&waypoints=`) | Link | none | opens the native app, which may have its own offline area | Every item and every day; the day link chains the items in order |
| OpenStreetMap | Link (`openstreetmap.org/relation/<id>` for trails, `?mlat=&mlon=#map=16/` for points) | none | - | |
| Waymarked Trails | Link (`hiking.waymarkedtrails.org/#route?id=<rel>`) | none | - | Our line comes from its API (3A) |
| AllTrails | Link only | - | - | No API, fetches 403 |
| Official park page | Link | - | - | Always shown first in the row when present |
| Komoot, Outdooractive, Wikiloc | Link by default; their own share-embed iframes may be enabled per trail only after P5 verifies the embed terms | none for public tours | none | Partner APIs not used (3A) |
| Wikimedia Commons photos | Embed (`Special:FilePath` with `?width=`) with the attribution line | none | cached when the trip is saved offline | the gallery pipeline already verifies licences |
| YouTube | Embed via `youtube-nocookie.com`, click-to-load | none | none | for video research the owner wants on the page |
| Instagram, Facebook, TikTok posts | Link only | oEmbed needs a Meta app token | - | screenshots from the inbox are research and never published |

### 4.9 Offline and print

Trip pages are used at trailheads with no signal. The static export already gives a self-contained HTML page per trip; on top of that:

| Measure | How |
|---|---|
| "Save this trip for offline" | A hand-written service worker (`web/public/sw.js`, no framework plugin) precaches on request: the plan page HTML and its RSC payload, the app shell JS and CSS, `/data/trips/<slug>.json`, every trail GeoJSON the trip uses, gallery thumbnails, and the basemap vector tiles for each day's bounding box at zooms 10-14, capped at 1,500 tiles per trip (about 20-40 MB; the button shows the size). The cap protects the free OpenFreeMap service; the cache name carries the build id so a new deploy refreshes it |
| Without cached tiles | `DayMap` falls back to the stored GeoJSON on a blank background (MapLibre renders lines and points with no basemap), then to `StaticMapFallback` (build-time SVG) |
| Always offline | Item addresses and coordinates as text, "Copy this day's addresses", tel links, the emergency block |
| Phone map apps | Per day and per trip GPX and KML downloads generated at build (`/<slug>/assets/day-04.gpx`), the existing practice; Organic Maps or Gaia then work fully offline |
| Checklists and booking ticks | localStorage, as `base.js` does today |
| Print | `/<slug>/print/`: one day per page, maps replaced by images captured from the canvas on `beforeprint` (or the SVG fallback), links printed as short URLs, QR code per day linking to the Google directions URL |

### 4.10 Feature parity with today's pages

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
| Checklist with persistence | `base.js` checklist (localStorage) | `PackingChecklist`, `DocumentsChecklist`, `BookingTimeline` ticks (same storage keys per trip slug, migrated once) |
| Countdown | `base.js` countdown with `trip-date` meta | `Countdown` from the chosen edition |
| Sun and light times | per-trip `sun-times.py`, `dark-times.py`, `research/sun.md` | `SunTimes` from `tools/sun.py` output per edition; `days.sun_note` for light guidance |
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

### 4.11 Revised: catalog browsing, coverage and the builder UI

| Route | What | Phase |
|---|---|---|
| `/activities/`, `/stays/`, `/eateries/`, `/offers/` | catalog lists in the four views, each from a descriptor (4.2); facets add `comfort`, `price_tier`, `adventure_level`, `accessibility`, `fresh` (fresh, aging, stale) and `status` (raw, proposed, verified, stale) | P5 |
| `/areas/<CC>/<region>/<area>/` | area guide: summary, best months, getting there, hidden gems, coverage band and per-type counts, the area's backlog (owner) | P5 |
| `/plan/new/` | the no-AI builder (0A.5): inputs, sliders, live counts, the draft preview with explanations; "Save draft" stores the trip in the browser (Phase 1) or D1 (Phase 2); "Open in editor" | P7 |
| `/review/` | the proposal queue (0A.2): grouped by area and entity, each change with its diff, sources and "accept", "reject", "edit then accept" | P4 (local), Phase 2 (hosted) |
| `/backlog/` | the research backlog as a table view (owner) | P5 |

UI rules added by the catalog:
- Every catalog row in a detail sheet shows provenance in one line ("Verified 13 Oct 2026 by agent:research-adventure from the operator page; price read 13 Oct 2026") and a freshness badge on fast-expiring fields.
- Editing a catalog fact from a trip asks once: "Change it for everyone" (`catalog.edit`, attributed) or "Only for this trip" (`override`).
- A "Report outdated" action on any field creates a backlog item with reason `stale`.
- Coverage bands appear on area pages, in the builder before it plans, and as a globe layer.

## 5. One operation set: UI, API, MCP, skills

### 5.1 The rule

Every change to `data/` is an **operation**: a named, schema-validated input that produces a validated new state, a changelog row and a list of warnings. Operations are defined once and reached four ways:

| Path | Caller | Transport | Phase |
|---|---|---|---|
| UI forms | the owner in the browser | `POST /api/v1/ops/<name>` to the localhost file server (Phase 1) or the Worker (Phase 2) | P5 / Phase 2 |
| HTTP API | anything | same endpoint | P5 (local) / Phase 2 |
| MCP | Claude Code and other agents | tools generated from the operation catalogue; stdio locally (read-only) in Phase 1, Streamable HTTP on the Worker in Phase 2 | P2 read / Phase 2 write |
| Skills writing in git | Claude Code skills | the ops CLI: `pnpm --dir web ops <name> --input <file or ->` | P4 |

### 5.2 Where each part lives

| Part | Location | Notes |
|---|---|---|
| Operation catalogue (name, summary, input and output JSON Schema, tables touched, read or write, phase) | `data/schema/src/ops/*.op.json`, compiled into `data/schema/generated/ops.json` | The same generator as the entity schemas (2.5); input schemas `$ref` the entity schemas, so a field change propagates everywhere |
| Operation logic | `web/lib/ops/` (TypeScript, pure functions `(dataset, input) => {next, changelog, warnings}`) | One implementation. Storage is an adapter: `FileStore` (reads and writes `data/**` in a working tree) and `D1Store` (Phase 2) |
| Validation | generated Zod (input), the TS structural validator and day checks (state), and the Python validator for hooks and CI | Python and TS validators are parity-tested over the same fixtures (2.5) |
| Ops CLI | `web/bin/ops.ts` (`pnpm ops`) over `FileStore` | What skills call |
| Local API server | `web/bin/serve-data.ts` (`pnpm data:serve`, localhost only) over `FileStore`, same routes as the Worker | Lets the editor work in Phase 1 |
| Worker | `api/` (Hono): `/api/v1/*` and `/mcp` over `D1Store` | Phase 2 |
| MCP server | `web/mcp/server.ts` (stdio, read tools, Phase 1); `api/src/mcp.ts` (`createMcpHandler`, all tools, Phase 2); both register tools from `ops.json` | Never drifts: the tool list, input schemas and descriptions are generated |
| Place capture | `tools/locations.py` stays the implementation of `place.*` in git mode in Phase 1 (109 tests, Wikidata/Nominatim resolver); the ops CLI delegates `place.*` to it | Phase 2 ports `place.*` to TS so the Worker can run it; the Python tests then run against both through the CLI |

### 5.3 Operation list

Reads are open in Phase 1 (they read the JSON in git or the built `/data/*.json`); writes need the owner (5.5).

| Operation | Input (summary) | Effect |
|---|---|---|
| `schema.list_types` | - | entity types with counts and schema ids |
| `schema.get` | `type` | JSON Schema with `x-ui` and `x-rules` |
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
| `edition.add`, `edition.choose` | edition row / `id` | |
| `base.set` | the night split | bases rows (validated cover) |
| `day.add`, `day.update`, `day.swap`, `day.remove` | day row / `a`, `b` | renumbers items' `day` on swap |
| `item.add`, `item.update`, `item.move`, `item.remove` | item row / `id`, `seq`, `track` | keeps `seq` contiguous |
| `track.set` | day track row | |
| `trail.upsert` | catalogue row; optional `osm_relation`, `gpx` upload | catalogue row; queues or runs geometry fetch |
| `trail.link` | `slug`, trip_trails row | |
| `adventure.upsert`, `booking.upsert`, `booking.set_status` | rows | book-by recomputed |
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
| `/<slug>/edit/`, `/inbox/`, `/api/v1/ops/*`, `/api/v1/export` | Cloudflare Access application, owner email one-time PIN |
| `/mcp` | Cloudflare Access service token; Claude Code adds it with `claude mcp add travel --transport http https://<api-host>/mcp --header "CF-Access-Client-Id: ..." --header "CF-Access-Client-Secret: ..."`; the secret comes from the keychain into the shell, never into a Claude settings file |
| The Worker itself | verifies the `Cf-Access-Jwt-Assertion` JWT on every write (do not rely on Access alone) |
| iOS Share Sheet endpoint (section 9) | a separate Access service token stored in the Shortcut, scoped to `inbox.add` only |

### 5.6 Keeping git JSON and D1 consistent

| | Phase 1 | Phase 2 |
|---|---|---|
| Source of truth for `data/` | **git** (files) | **D1** for structured data; git holds snapshots and the history |
| Prose (`prose/*.md`) | git | D1 `prose` table (Markdown text); exported to the same paths |
| Research (`research/**`) | git only | git only (raw files are never in D1; D1 stores `research_refs` and indexed sidecar facts) |
| Who writes | ops CLI, local API, `locations.py` | the Worker (UI, API, MCP); skills switch from the CLI to MCP for data writes |
| Guard | PostToolUse hook validates every Claude write to `data/**` | `data/.mode` contains `d1`; the hook then **rejects** direct file writes to `data/trips/**` and `data/locations/**` and tells the agent to use MCP |
| D1 to git | - | nightly GitHub Action: `GET /api/v1/export` (whole dataset, deterministic JSON in the D13 format), write `data/`, run `tools/data.py validate` and all tests, open and auto-merge a PR `data: D1 export <date> rev <n>` when green; red leaves the PR open and opens an issue |
| git to D1 | - | only for deliberate file edits merged to main (for example a schema migration): an Action runs `tools/data.py diff-d1`, which turns the diff into operations with `expected_rev` and applies them; any 409 fails the run. Export commits carry the trailer `D1-Export: <rev>` and are skipped, so the two jobs cannot loop |
| Schema migrations | `tools/data.py migrate` on files | the same migration file generates the D1 SQL (`api/migrations/NNNN_*.sql`) and the JSON rewrite; both are applied in one release |

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
| `create_trip`, `add_place`, `add_item`, `update_item`, `upsert_booking`, `upsert_trail`, `upsert_adventure` | the matching operations | 2 |
| `apply_operation` | any write operation by name (the long tail), validated against its schema | 2 |
| `propose_research_changes`, `apply_proposal` | `research.propose`, `proposal.apply` | 2 |
| `inbox_add`, `inbox_resolve` | `inbox.*` | 2 |

Seven dedicated write tools plus one generic one keeps the tool list short enough for an agent's context while the common edits still get a typed schema.

## 6. Phases (Revised: 6.1)

Each phase is sized for one Sonnet coding agent, a branch, a PR, verified and merged before the next dependent phase starts (house rules: Opus plans, Sonnet codes; new branch per piece of work; rebase onto main before the PR; push after each verified commit group). All commands use absolute paths because agent shells reset their working directory.

### 6.0 Order and parallelism

| Phase | Depends on | Can run in parallel with |
|---|---|---|
| P1 Restructure | approval | nothing (everything moves) |
| P2 Schema and generators | P1 | P3 |
| P3 App skeleton and places | P1 | P2 (P3 binds to generated types in its last step, after P2 merges) |
| P4 Trip schema in use, import two trips | P2 | P3 |
| P5 Plan pages, maps, trails, editor | P3, P4 | P6 |
| P6 Globe route | P3 | P5 |
| Phase 2 (API, D1, MCP writes, inbox) | P5 | separate plan |

### P1. Pure restructure, no behaviour change

Owns: every `git mv` in the 1.2 table; `tools/publish.py`, `tools/hub.py`, `publish.sh` (wrapper); path constants in `tools/*.py`, `tools/tests/*.py`, `tools/hooks/*.sh`, `.claude/settings.json`; the one `sys.path` line in each `legacy/*/build_page.py`; `tools/migrate_paths_p1.py` (screenshot path rewrite) and its test; `legacy/MANIFEST.json`; `tools/tests/fixtures/served-urls.txt`; `CLAUDE.md`, `README.md`, `data/locations/README.md`, `.claude/skills/location/SKILL.md`, `.claude/skills/trip-planner/SKILL.md` (paths only); `.gitignore`.

Steps:
1. Before moving: `PUBLISH_DRY_RUN=1 ./publish.sh`, save `.site/` as `/tmp/site-before/` and the list of served URLs as the fixture; record `pytest` = 109 passed.
2. Move in commit groups (trips, locations, globe, `_system`, docs), fixing paths after each group, tests green after each.
3. Port `publish.sh` logic to `tools/publish.py` and the heredoc to `tools/hub.py`.
4. Rebuild every `build_page.py` trip and compare `index.html` bytes with the committed ones.

Acceptance:
- `python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q` = 109 passed (plus the new P1 tests).
- `.site/` after equals `/tmp/site-before/` byte for byte, except the hub's day-relative badges if the date changed (the test pins the date with `HUB_TODAY`).
- Every `build_page.py` reproduces its committed page byte for byte.
- `locations.py build --check` passes; the globe and list pages work from `legacy/`.
- No file outside the 1.2 table changed content (diff review).

Tests to add: served-URL superset; publish allow-list (nothing from `research/` in `.site/`); screenshot path rewrite; `legacy/` manifest frozen; reserved-slug check.

Verify:
```bash
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q
python3 /home/nitin27may/workspace/travel/tools/locations.py validate && python3 /home/nitin27may/workspace/travel/tools/locations.py build --check
cd /home/nitin27may/workspace/travel && PUBLISH_DRY_RUN=1 HUB_TODAY=2026-10-24 ./publish.sh && diff -r /tmp/site-before .site
for f in /home/nitin27may/workspace/travel/legacy/*/build_page.py; do (cd "$(dirname "$f")" && python3 build_page.py) || echo "FAIL $f"; done; git -C /home/nitin27may/workspace/travel status --short legacy
```

### P2. Schema source and generators

Owns: `data/schema/**`, `tools/data.py`, `data/vocab/tags.json`, the locations v2 to v3 migration (tags vocabulary moved out, `kind` column added; ids unchanged), `tools/tests/test_schema_*.py`, `tools/tests/fixtures/schema/**`, `web/package.json` (only to add the generated-types check), `web/mcp/server.ts` (read tools), `.mcp.json`, `/schema/` docs generator.

Steps: write `locations.schema.json`, `trip.schema.json`, `trail.schema.json`, `research-sidecar.schema.json`, `booking-record.schema.json`, `ops/*.op.json`; the generator (DDL, TS types, Zod, ops.json); the Python validator (jsonschema plus `x-rules`); the TS validator; the parity test; the read-only stdio MCP server.

Acceptance:
- Generated `schema.sql` loads in SQLite with every fixture (`PRAGMA foreign_key_check` empty); the existing `test_schema_sqlite.py` passes against the generated DDL.
- `tools/data.py generate --check` byte-equal; Python and TS validators agree on every fixture (at least 40 broken fixtures, one per rule).
- `locations.py validate` and `build --check` pass on v3; WISHLIST.md unchanged except labels.
- Claude Code can `list_entity_types`, `get_entity_schema`, `query_rows` against the local data through `.mcp.json`.

Verify:
```bash
python3 /home/nitin27may/workspace/travel/tools/data.py generate --check
python3 /home/nitin27may/workspace/travel/tools/data.py validate
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q
pnpm --dir /home/nitin27may/workspace/travel/web test -- schema
```

### P3. App skeleton, theme, places in four views

Owns: `web/**` except `web/lib/ops/**` and `web/mcp/**`; `tools/theme_tokens.py`; `tools/views.py` (entity-view JSON writers); `tools/publish.py` (route table additions only).

Steps: Next.js 16 (or 15, decision D2) App Router, TS strict, Tailwind v4, shadcn/ui (Base UI), static export with `trailingSlash`; theme tokens from legacy themes; `EntityPage`, `FilterBar`, `ViewSwitcher`, `CardsView`, `ListView`, `TableView` with `AdvancedFilterPanel`, `MapView`, `DetailSheet`, `EmptyState`; the place descriptor; `/`, `/places/`, place pages, `/trips/` listing legacy trips from the manifest; `/locations/` redirect; the hash-to-query shim.

Acceptance:
- `/places/` shows the same 63+ places as the legacy list with the same filters and counts (parity test over the URL params of PLAN-locations-g5 2.4).
- All four views share URL state; reload restores any state; a view switch keeps filters.
- Advanced panel: 3-condition AND/OR filter, group by country, column chooser, CSV export, saved view round trip.
- axe: zero serious or critical violations on every view; keyboard path test passes.
- Legacy URLs all still served (superset test); the export has fewer than 15,000 files.

Tests: Vitest for filter grammar, URL codec, facet counts; Playwright for views, keyboard and axe; snapshot of `entity-view/1`.

Verify:
```bash
pnpm --dir /home/nitin27may/workspace/travel/web typecheck && pnpm --dir /home/nitin27may/workspace/travel/web lint
pnpm --dir /home/nitin27may/workspace/travel/web test && pnpm --dir /home/nitin27may/workspace/travel/web build
pnpm --dir /home/nitin27may/workspace/travel/web e2e
cd /home/nitin27may/workspace/travel && PUBLISH_DRY_RUN=1 ./publish.sh && python3 -m pytest tools/tests -q
```

### P4. Trip schema in use: ops, import Patagonia and the Rockies

Owns: `web/lib/ops/**`, `web/bin/ops.ts`, `web/bin/serve-data.ts`, `data/trips/patagonia-feb-mar-2027/**`, `data/trips/canadian-rockies-sept-2029/**`, `data/catalog/trails/**` (rows for both trips, geometry later), `research/trips/<both>/**` (sidecars generated from existing research), `tools/sun.py`, `tools/links.py`, `tools/anchors.py`, `tools/shots.py`, `tools/research.py`, `tools/lanes.py`, `.claude/skills/trip-import/`, related tests.

Steps: implement the operations and the file store; the ops CLI; `trip-import` (Opus maps PLAN.md sections and Rockies `data/*.json` to a proposal; Sonnet runs it); sidecars for the existing research files; apply; day checks; `sun.py` and friends.

Acceptance:
- Both trips validate with zero errors; every day-check warning is either fixed or accepted with a reason.
- Every booking, trail, adventure, hazard, budget row and day in today's PLAN.md tables appears in `trip.json` (a count test per table against the PLAN.md tables; Rockies: 62 trails, 33 bookings, 43 adventures, 48 sights).
- Patagonia's two "book by" dates resolve to Sat 31 Oct 2026 (offset -118) and Mon 30 Nov 2026 (offset -88) for the 26 Feb 2027 edition.
- `sun.py` matches `research/sun.md` within 1 minute.
- An op applied through the CLI and the same op through the local API produce identical files.

Verify:
```bash
pnpm --dir /home/nitin27may/workspace/travel/web ops validate --all
python3 /home/nitin27may/workspace/travel/tools/data.py validate && python3 /home/nitin27may/workspace/travel/tools/data.py check-days --all
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q && pnpm --dir /home/nitin27may/workspace/travel/web test
```

### P5. Plan pages, maps, trails, local editor

Owns: `web/app/[slug]/**`, `web/components/plan/**`, `web/components/map/**`, `web/public/sw.js`, `tools/trails.py`, `tools/exports.py`, `tools/fares/**`, `tools/conditions.py`, trail geometry for both trips, `.claude/skills/{trip-edit,trip-research,research-trails,trip-fares,trip-build,trip-verify,trip-publish,trip-photos,trip-conditions}/`, `.claude/agents/*.md`, the rewritten `trip-planner` skill, hooks in 7.5.

Acceptance:
- `/patagonia-feb-mar-2027/` and `/canadian-rockies-sept-2029/` render the full spine (4.5) and every row of the parity table (4.10); the owner reviews both against the legacy pages before `web_published` is set.
- Every trail on both trips has geometry or a recorded reason; profiles render; badges match the house scale table.
- Offline: with the network disabled after "Save for offline", the page, day maps (GeoJSON) and checklists work (Playwright offline test).
- The local editor creates a trip, a day with three items and a booking; files validate; day checks show in the panel.
- Print view: one day per page, no blank maps.
- Screenshots at 2x tiled and read for both trips (desktop and mobile).

Verify: as P3 plus `python3 /home/nitin27may/workspace/travel/tools/links.py --trip patagonia-feb-mar-2027`, `python3 /home/nitin27may/workspace/travel/tools/shots.py --trip patagonia-feb-mar-2027`.

### P6. Globe route

Owns: `web/app/globe/**`, `web/components/globe/**`, `tools/globe_data.py` (output paths), `web/public/geo/**`.

Acceptance: same drill paths, labels and pin counts as `legacy/globe/` (parity test); filter params from lists apply; a click opens the shared `DetailSheet`; `/globe/` then serves from the app and `legacy/globe/` is deleted in the same PR (deletion confirmed with the owner first).

### Phase 2 outline (separate plan, after P5)

| Step | Content |
|---|---|
| 2A | `api/` Worker (Hono), D1 schema from the generated DDL, `D1Store`, `/api/v1/*`, Access protection, JWT check |
| 2B | Remote MCP (`createMcpHandler`) with the full tool list; Claude Code registration with a service token |
| 2C | Export Action (D1 to git PR) and `diff-d1` import; `data/.mode = d1` guard |
| 2D | Inbox endpoint, iOS Shortcut, `/inbox/` review queue; `place.*` ported to TS |
| 2E | Hosted editor enabled on the deployed site; saved views in D1 |

### 6.1 Revised: phase changes for the catalog, the flywheel and the builder

| Phase | Change |
|---|---|
| P1 | unchanged; `data/catalog/` does not exist yet |
| **P2 (widened)** | must land before any app code depends on it: the catalog entity schemas (0A.1) with the common block, `field_meta`, `status`, `licence`; `freshness.json`; `owner_id`, `visibility`, `actor` envelope on operations; catalog id patterns and the merge rule for ids (`merged_from`); `catalog_changes`; the `trip_activities` and `trip_bookings` shapes (2.8); parity tests extended. Acceptance adds: every catalog table loads in SQLite with FKs; an operation without `actor` is rejected |
| P3 | unchanged, plus the `fresh` and `status` facets in the place descriptor |
| **P4 (widened)** | the ingestion pipeline lands here, because the import uses it: `tools/catalog.py` (normalise, match, merge, propose, apply, freshness, coverage), `catalog.*` operations, `policy.json` auto-accept rules, `/review/` working against the local server. Both imports go through it; acceptance adds: re-running the Rockies import is a no-op proposal (idempotent); a deliberately duplicated place is detected as a possible duplicate; coverage for Banff, Lake Louise, Jasper, El Chalten and Ushuaia is computed and stored |
| P5 | adds the catalog list routes, area pages, provenance lines, "change for everyone or this trip", the backlog view, deep links with dates and party (0A.6), Open-Meteo and Frankfurter widgets |
| P6 | adds the coverage layer on the globe |
| **P7 (new) No-AI trip builder** | `web/lib/planner/` (pure TS), `/plan/new/`, sliders, explanations, thin-coverage handling. **Starts only when** the Canadian Rockies and Patagonia both reach the good band for their styles in `coverage.json`. Acceptance: the same inputs give byte-identical drafts; every draft passes the day checks or carries an explained accepted warning; a 7-day "Banff, September, family with a 6-year-old, active-nature, pace 3" draft uses only kid-fit rows and stays within the walking ceiling; a thin area produces free days and backlog items, never invented rows; property tests over random inputs never exceed ceilings |
| Phase 2 | adds hosted review, `user-request` backlog items (if D17 opens it to others), and per-user ownership checks switched on |

**Deliberately deferred:** accounts and sign-up (D17, D21), public contributions to the catalog (D19), live price APIs beyond weather and FX (D20), bring-your-own-key agent runs (D22), a routing API for legs (D13).

## 7. Skills, agents, hooks and gates (Revised: 7.6)

### 7.1 Skills (`.claude/skills/`)

| Skill | Status | Trigger | Does | Model |
|---|---|---|---|---|
| `location` | existing, updated in P1 (paths) and P2 (shared tags) | "add X", a screenshot, a caption | capture through `locations.py` (`place.*`) | Sonnet; Haiku for bulk export parsing |
| `capture-social` | new (Phase 2 for the endpoint; the export and pilot work in Phase 1) | "process my saved posts", a Meta export file | section 9 pipeline into `research/inbox/` and then `place.add` | Sonnet; Haiku for caption extraction |
| `trip-planner` | existing, rewritten in P5 as the orchestrator | "plan X", "start the Peru trip" | intake (questions from `research/vault-notes/vault-trip-planner-skill/references/intake.md`, one at a time) to `trip.create`; lane selection (7.3); launches the lane agents in one message; runs the bookings audit; asks `plan-synthesis` for a proposal; applies it after review; then `trip-build`, `trip-verify`, `trip-conditions` | Opus for synthesis, agents per lane |
| `trip-import` | new, P4 | "import the Patagonia plan" | PLAN.md + research files + any `data/*.json` to a `trip.import` proposal; validates; applies after review; records unmapped content as `knowledge` rows marked GAP | Opus for the mapping, Sonnet for the mechanical passes |
| `trip-edit` | new, P5 | "move Laguna Torre to Day 9", "add a booking for the catamaran", "make Day 8 track B the default" | translates the request into operations, shows the diff and the day-check warnings, applies on confirmation | Sonnet |
| `trip-research` | new, P5 | "add adventure research for this trip", "this country has a great hike, add it" | runs one lane (re-run mode, 7.3) for a trip or a place, writes a new research file, `research.add_ref`, then `research.propose` (section 10) | per lane |
| `research-trails` | new skill wrapper over the agent, P5 | "capture the geometry for these trails" | 3A capture: find relation ids, fetch geometry and profile, `trail.upsert` | Sonnet |
| `trip-fares` | existing method, made a skill in P5 | "compare windows", "what do flights cost" | section 11 | Sonnet with Playwright MCP |
| `trip-build` | new, P3-P5 | "rebuild", after any data change | `tools/data.py generate`, entity views, `pnpm --dir web build`, legacy builds for unmigrated trips | Sonnet |
| `trip-verify` | new, P5 | before every publish | tests, day checks, link and anchor checks, privacy grep, axe on changed pages, screenshot slices read (zoomed, per the owner's rule) | Sonnet |
| `trip-publish` | new, P1 (wraps `publish.sh`) | "publish" | `tools/publish.py`, live URL check returns 200 for every served URL in the changed set | Sonnet |
| `trip-photos` | existing tools, skill in P5 | "find photos" | the Commons pipeline, **one sequential searcher** | Haiku search, Sonnet review |
| `trip-conditions` | new, P5 | at plan time and by the gate in section 13 | creates the T-2 scheduled task ending in one named verdict | uses `schedule` |

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

`tools/lanes.py select <slug>` (pure function, unit-tested, also used by the UI's "Suggested research") computes the set:

1. Start with the lanes whose trigger column matches the trip's `primary_style`, style tags, `duration_shape`, `movement_shape`, `party_shape`, `kids_mode`, `comfort`, `nights` and countries.
2. Day trips (`duration_shape = day-trip`) keep only `overview`, `sights` or `trails` by style, `timing`, and `road-trip` when driving more than 90 minutes; they drop `stays`, `logistics`, `entry`, `fares`, `community`.
3. Add `profile.lanes_extra`, remove `profile.lanes_skip`.
4. The result and the reason per lane are shown to the owner before launch ("adventure: style adventure; entry: AR is not CA").

Worked: Patagonia (active-nature, adventure, family; multi-week; multi-base; AR) runs overview, sights, trails, adventure, stays, timing, logistics, entry, fares, community. It skips relax-luxury and hidden-gems (no matching style), road-trip (multi-base by air; the car is only for 6 days) and city-culture: Buenos Aires is over 500,000 so the rule would add it, but the profile puts it in `lanes_skip` because BA is a buffer stop.

**Re-run mode:** `trip-research --slug <slug> --lane <lane> [--focus "Via ferrata options"]` runs one lane against the current trip, writes `<lane>-<YYYY-MM-DD>.md/.json` when `<lane>.md` exists (never overwrites), and ends with `research.propose` limited to that file (section 10). The other lanes are not touched.

### 7.4 Shared booking sidecar shape (`booking-record/1`)

The bookings table columns of section 2.3 minus the trip-resolved ones (`book_by_offset`, `deadline_date`, `edition_id`, `status`, `confirmation`), plus:

| Field | Meaning |
|---|---|
| `for` | `{kind: adventure|trail|base|item|sight|transport|entry, ref}` what it books |
| `found_by` | lane id |
| `match` | dedupe keys: `book_url` host + path, operator name, product name |
| `evidence` | array of `{source_id, quote, read}` for price, limits, window and terms |

When an agent cannot find the booking window it writes `opens_kind: "unknown"` and `opens_evidence` listing every page checked with its read date ("operator FAQ 2026-10-13: no window stated; Civitatis lists dates to Mar 2027"); the computed book-by then uses the conservative default and carries the GAP flag. Permit and reservation systems the agents check by name: recreation.gov (US federal permits and timed entry), the Parks Canada Reservation Service, Sepaq, Havasupai reservations, provincial and state park systems, APN ventaweb (Argentina), the Machu Picchu ticket system, hut systems (SAC, CAI, DNT, refuges), then tourism boards, then resellers as a cross-check only.

### 7.5 Hooks and gates (`.claude/settings.json` running `tools/hooks/*`)

| Hook | When | Checks | On failure |
|---|---|---|---|
| `data_changed.sh` (PostToolUse Write/Edit/MultiEdit) | any write under `data/` | JSON Schema plus `x-rules` for the touched file; day checks summarised; in D1 mode rejects direct writes to trips and locations | exit 2 with the error codes and messages |
| `locations_changed.sh` (existing) | `data/locations/**`, legacy list template | validate + build views | exit 2 |
| `schema_changed.sh` | `data/schema/src/**` | `tools/data.py generate` then `generate --check`; the parity test subset | exit 2 |
| `research_changed.sh` | `research/**/*.json` | sidecar schema `research-sidecar/1` and `booking-record/1` | exit 2 |
| `legacy_page_changed.sh` | `legacy/*/index.html` | the audit 2.5 page gates (self-contained, meta present, no hex outside themes, gallery markers) | exit 2 |
| `prepublish.sh` (PreToolUse Bash, existing, extended) | `publish.sh`, `wrangler pages deploy`, `wrangler deploy` | full pytest, web tests (`pnpm test`), `pnpm build`, served-URL superset test, privacy grep, conditions gate (section 13) | exit 2 blocks the publish |
| Freshness (in `validate`, warning) | always | prices read over 180 days ago on a trip whose chosen edition is within 120 days; `opens_kind unknown` with book-by within 30 days; a sidecar older than the trip's last edit for a lane marked stale | warning on the page and in the editor |
| Privacy (test) | build | the export contains none of the `x-private` fields, no `research/`, `inbox/` or `screenshot` strings, no traveller heights or weights | test fails |

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

## 8. Risks, gotchas, owner decisions (ranked) (Revised: 8.3)

### 8.1 Risks and gotchas

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | P1 breaks a published URL or a legacy build (16 folders, 9 builders, path constants in 3 tools and 6 test files) | medium / high | byte-diff of `.site/`, per-builder byte-diff, served-URL superset test, one commit group per area |
| R2 | Python and TS validators drift | high without a guard / high | the parity test over every fixture; `x-rules` are declarative so both interpret one description |
| R3 | `place.*` has two implementations until Phase 2 (Python `locations.py`, later TS) | certain / medium | the ops CLI delegates to Python in Phase 1; Phase 2 runs the 109 tests through the CLI against both before switching |
| R4 | Static export has no Server Actions, so the deployed editor cannot save in Phase 1 | certain / low | the editor runs against `pnpm data:serve` locally; disabled on the deployed site with a clear note |
| R5 | Waymarked Trails' API is undocumented (the blog's GPX path already 404s) | medium / medium | geometry is fetched once and stored; the fetcher has a fallback to Overpass `out geom`; contract test against one known relation runs weekly, not in CI |
| R6 | OSM relations missing or mis-ordered; no difficulty on relations (true in Chalten) | high / medium | agency datasets first where they exist; length check against stated km; difficulty from research, never from OSM alone |
| R7 | ODbL share-alike on stored trail lines | certain / low | lines kept per source with a NOTICE; the public `/data/` trail download stays ODbL; no mixing sources in one file |
| R8 | 90 m Open-Meteo elevation understates gain | high / low | stated gain is primary; computed gain labelled; Mapterhorn upgrade path |
| R9 | Offline tile caching strains OpenFreeMap | low / medium | 1,500-tile cap per trip, on request only; GeoJSON-on-blank fallback; GPX/KML for phone apps |
| R10 | Cloudflare keeps steering Next.js to Workers; Pages could stagnate | medium / medium | static export is portable; bind the custom domain early (D14), after which moving hosts changes no URL |
| R11 | Import fidelity: Patagonia's PLAN.md is 900 lines of prose with nuance that does not fit fields | high / medium | prose stays as Markdown under `prose/`; unmapped statements become `knowledge` rows; the owner reviews the proposal |
| R12 | Day-check noise trains the owner to ignore warnings | medium / medium | `accepted_warnings` per day; thresholds in one config; P4 tunes them on two real trips |
| R13 | Private data leaks (children's ages, heights, confirmations) into the public export | low / high | `x-private` in the schema drives the export allow-list; a privacy test greps the build |
| R14 | Instagram or Facebook flags the account during browser read-through | low / high | pilot first, 9.3 limits, export-first, no automation of account actions |
| R15 | `view=grid` meant cards on the legacy list page; "grid" now means table | certain / low | views renamed `cards/list/table/map`; legacy value mapped |
| R16 | shadcn switched its default primitives to Base UI on 3 Jul 2026; examples online mix Radix and Base UI APIs (`asChild` vs `render`) | high / low | pin the base in `components.json`; lint rule against importing the other base |
| R17 | Renaming a trip folder leaves the old URL live on Pages (existing gotcha) | medium / low | slugs are frozen once published; `publish.py` refuses a rename without a `_redirects` entry |
| R18 | The Pages free plan's 20,000-file limit | low / medium | build test fails above 15,000 files |
| R19 | Patagonia crosses T-60 on 28 Dec 2026 with no conditions routine | certain / medium | section 13 gate; `trip-conditions` in P5 |
| R20 | Commons rate limits if gallery work is parallelised by the new agents | medium / medium | one sequential searcher, written into `trip-photos` and the agent files |

### 8.2 Decisions needed from the owner (ranked by how much they block)

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Trails as a global catalogue (`data/catalog/trails/`, ids in the place hierarchy) rather than per trip | yes | P2 |
| D2 | Next.js 16 instead of the brief's 15 | 16 | P3 |
| D3 | App plan pages keep `/<slug>/` (no redirect) rather than move to `/trips/<slug>/` | keep `/<slug>/` | P3 |
| D4 | Is `github.com/nitin27may/travel` private? Traveller ages, heights and booking confirmations would be in git | keep it private; if public, private fields move to a gitignored `data/private/` overlay | P2 |
| D5 | Phase 1 editing through a local server (`pnpm data:serve`) acceptable until Phase 2 | yes | P5 scope |
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
| R22 | Auto-accept lets agent errors into `verified` | medium / medium | auto-accept only for additions with an official or operator source; `verified_by: agent:*` is shown, and the owner can filter for it |
| R23 | Copied text from blogs or operators slips into summaries | medium / medium | sidecars carry facts and links; a test flags summaries with long overlaps against cited source snippets kept in research |
| R24 | The builder's drafts look authoritative where data is thin | high / medium | coverage band shown before planning; free days instead of filler; explanations per item |
| R25 | Open-Meteo's free tier is non-commercial; a move to ads or subscriptions (D17) breaks the terms | low now / medium | the decision explicitly includes the weather licence |
| R26 | Unofficial deep-link formats (Google Flights `q=` or `tfs`, Skyscanner, Kayak) change | high / low | link tests in P5; fall back to the provider's search page with the destination only |
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

### 10.1 Research outputs: Markdown for people, a sidecar for the machine

Each lane run writes `<lane>.md` and `<lane>.json` side by side. The sidecar schema `research-sidecar/1` lives in `data/schema/src/research-sidecar.schema.json` with the rest:

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
| `records` | object | normalised entities in their target schema shapes: `places[]` (locations place rows), `trails[]` (trail catalogue rows plus `osm_relation`), `adventures[]`, `stays[]` (base candidates), `bookings[]` (`booking-record/1`), `items[]` (suggested timed items); each record has `match` keys and `src` |

### 10.2 Grouping, index, dedupe, merge

| Step | Tool | Rule |
|---|---|---|
| Group | folder layout | by subject: `research/trips/<slug>/` or `research/places/<place-id>/`; by lane: the file name; by date: the suffix of re-runs |
| Index | `tools/research.py index` writes `research/INDEX.json` (committed, deterministic) | one row per sidecar: path, lane, subject, researched, geo, styles, tags, counts of facts and records, GAP count; the editor's "Research" tab and `trip-research` read it |
| Dedupe | `tools/research.py dedupe` | records match on stable ids first (place id, wikidata, OSM relation, operator `book_url` host and path), then name within 2 km for places and trails, then provider plus product name for bookings; conflicting facts on the same key are kept side by side and marked `conflict` |
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

### 11.2 Tables

**fare_windows** (PK `id`): `id`, `label`, `depart` date, `return` date, `nights_away` int, `party` json (`{adults, children: [ages]}`), `school_break` bool, `notes`.

**fare_quotes** (PK `id`): `id`, `window_id` FK, `kind` (`flight-intl`, `flight-domestic`, `lodging`, `car`), `leg` text ("YYZ-EZE return", "AEP-USH"), `date_from`, `date_to`, `total` money (for the whole party), `provider` (`google-flights`, `booking.com`, operator name), `method` (`playwright-tfs`, `playwright-tfs-oneway`, `playwright-booking`, `manual`), `url`, `read_at` (ISO datetime), `filters` ("review 8+, median of 12"), `confidence`, `notes`.

Derived per window: total in CAD (through `fx`), rank, and the difference against the plan's window. `editions.fare_window_id` links the chosen window; `budget` rows reference quotes (`basis: fare-read`), so choosing an edition updates the budget and the deadlines in one step.

### 11.3 Flow

`trip-fares compare --slug <slug> --windows <list or "every Saturday Jan-Mar">` runs the method per window (sequentially; one browser), writes `fares-window-compare-<date>.md/.json`, and proposes `fare.add_window` and `fare.add_quote` rows. The editor's "Windows" tab shows the comparison table (window, nights, international, domestic, lodging, car, total CAD, read date) with a "Choose this window" action (`edition.add` + `edition.choose`). An optional weekly price-watch scheduled task re-reads the chosen window's international fare and appends a quote; a change over 10% adds an open question.

## 12. Tooling carry-over map

| Tool today | Lands in | Owned by skill | Phase | Note |
|---|---|---|---|---|
| `_system/gallery.py`, `gallery_find.py`, `gallery_pick.py` (Commons pipeline) | `tools/gallery/` | `trip-photos` | P1 move; P5 skill | **One sequential searcher**, never parallel agents (429 lasting 25+ minutes on 2026-10-12); the web `Gallery` reads `gallery.json` unchanged |
| per-trip `photos.py`, `fetch_photos.py`, `verify_photos.py` | replaced by `tools/gallery/` (hero and card images through the same pipeline) | `trip-photos` | P5 | originals stay in `legacy/<slug>/` until the trip migrates |
| 4 copies of `sun-times.py` plus `dark-times.py` | `tools/sun.py` (sunrise, sunset, civil/nautical/astronomical twilight, azimuth and elevation) reading `trip.json` bases and the chosen edition, writing `derived/sun-<edition>.json` | `trip-build`, used by `research-timing` | P4 | test against the values in `research/trips/patagonia-feb-mar-2027/sun.md` (within 1 minute) and Iceland's darkness table |
| `canadian-rockies-sept-2029/check_links.py` | `tools/links.py` (HEAD then GET fallback, per-host pacing, report of broken links per page) | `trip-verify` | P4 | the Rockies result (465 URLs, 9 broken) is the regression fixture |
| two `anchor_check.py` copies | `tools/anchors.py` | `trip-verify` | P4 | |
| Iceland `shots.py`, `verify.py` (screenshot QA) | `tools/shots.py`: Playwright screenshots at 2x, split into tiles for reading, per the owner's rule on inspecting rendered output | `trip-verify` | P4 | runs on `web/out` pages and legacy pages |
| `_system/tools/globe_data.py` | `tools/globe_data.py`; outputs move from `legacy/globe/assets/` to `web/public/geo/` in P6 | `trip-build` (light steps: `places`); heavy steps (`base`, `admin1`, `admin2`, `gazetteer`, mapshaper) stay manual, never from a hook | P1 move, P6 outputs | |
| `_system/tools/locations.py`, `location_views.py`, `migrate_locations_v2.py`, `locations_schema.sql` | `tools/` (SQL to `data/schema/legacy/`, then generated in P2) | `location` | P1 | |
| `_system/tests/` (109 tests) | `tools/tests/` | all | P1 | the count is an acceptance criterion for P1 |
| `_system/tools/hooks/` | `tools/hooks/` | | P1 | |
| `_system/build.py` and the page system | `legacy/_system/` | `trip-build` (legacy step) | P1 | retired when the last legacy page migrates |
| Rockies `merge_data.py`, `plan_tables.py` | absorbed into `trip-import` mapping rules | `trip-import` | P4 | stay in `legacy/` until that trip migrates |
| `publish.sh` heredoc hub | `tools/hub.py` | `trip-publish` | P1 | byte-identical output in P1 |
| vault skill `make_maps.py` (CSV for map apps) | `tools/exports.py`: GPX and KML per day and per trip, CSV of items | `trip-build` | P5 | |
| (new) `tools/trails.py` | find, fetch, check (3A) | `research-trails` | P5 | |
| (new) `tools/fares/tfs.py` | 11.1 | `trip-fares` | P5 | |
| (new) `tools/research.py` | index, dedupe (10.2) | `trip-research`, `plan-synthesis` | P4 | |
| (new) `tools/lanes.py` | lane selection (7.3) | `trip-planner`, `trip-research` | P4 | |
| (new) `tools/conditions.py` | gate and routine payload (13) | `trip-conditions` | P5 | |
| (new) `tools/data.py` | validate, generate, check-days, export, import, migrate, diff-d1 | all | P2 | |

## 13. Weather and conditions rules

| Piece | Rule |
|---|---|
| Default weather rules | `day.shape` (and `trip.import`) generates `weather_rules` from the profile: trail and boat days get `gust_kmh > weather_wind_gust_kmh` checked at the day's first item minus 60 min; `precip_mm` thresholds by rain tolerance (low: 1 mm/h, medium: 3 mm/h, high: none); `temp_max_c < weather_cold_c` and `> weather_heat_c` (heat moves the start earlier rather than to Plan B) |
| Plan B required | any day with a weather rule must have track `P` items or `plan_b_text`; missing is a validator warning on the day and an item in the plan's open questions |
| Conditions routine | `trip-conditions` creates a one-shot scheduled task for 07:00 local time two days before Day 1 of the chosen edition (and optionally one each morning on the trip). The task reads the trip through MCP (`get_trip` with `resolve`), pulls Open-Meteo forecasts for each base and each day's key items, the day-of closure links, road status (511 and equivalents) and seasonal trackers (foliage, snow), evaluates every weather rule, and ends with **one named verdict**: `GO`, `GO, PLAN B ON DAY n`, `SWAP DAYS n AND m`, or `DELAY`, plus the three reasons that drove it. Its id is stored in `editions.conditions_trigger` |
| The 60-day rule | no trip with a chosen edition starting within 60 days may lack `conditions_trigger`: `tools/conditions.py check` warns in `validate` from T-90, and **fails the pre-publish gate** from T-60; the home page shows the trip in red until it is set |
| Today | no dated trip is inside 60 days on 2026-10-17 (Vermont, Quebec and Algonquin are past). Patagonia (Day 1 = 26 Feb 2027) crosses T-60 on 28 Dec 2026, so its routine must exist by then |
| Re-planning | a `SWAP DAYS` verdict links to the editor with the swap pre-filled as a `day.swap` proposal; nothing changes without the owner |

## 14. Domain and hosting

The site stays on the Cloudflare Pages project `nks-travel` at `https://nks-travel.pages.dev/`. A custom domain is bound later in the Pages dashboard; the only repo change is the hub footer line. To keep that true, the app must not hard-code the host:

| Do not hard-code | Instead |
|---|---|
| `nks-travel.pages.dev` in links | relative links everywhere (`/patagonia-feb-mar-2027/`); a test greps `web/out/` and fails on the string outside the footer and `robots.txt` |
| canonical URLs, Open Graph URLs, sitemap | `SITE_ORIGIN` read once at build (default `https://nks-travel.pages.dev`); switching domains is an env change and a rebuild |
| the API host | `NEXT_PUBLIC_API_ORIGIN` (unset in Phase 1, so the editor stays disabled on the deployed site) |
| CORS allow-list in the Worker | from a Worker variable listing both origins |
| Google Maps Embed key restrictions | configured in Google Cloud for both hosts; the key itself is a build-time env value, not committed |
| Cloudflare Access applications | dashboard configuration per hostname |
| service worker scope and cache names | relative scope `/`; cache names keyed by build id, not host |
| iOS Shortcut endpoint | points at the API host; documented in `docs/` as the one place to update |

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

Repo inputs: `CLAUDE.md`, `AUDIT-2026-10-16.md` 2.1-2.5, `_system/site/PLAN-locations-g5.md`, `_system/site/GLOBE-RESEARCH.md`, `locations/README.md`, `locations/locations.json`, `patagonia-feb-mar-2027/PLAN.md`, `patagonia-feb-mar-2027/research/fares-window-compare.md`, `canadian-rockies-sept-2029/data/*.json`, `globe/index.html`, `_system/base.js`, `publish.sh`, `research/vault-notes/**`, and the fares method memory note (2026-10-14).

### Change log

| Date | Change |
|---|---|
| 2026-10-17 | First draft: brief plus addenda 1-4 folded in |
| 2026-10-17 | Revision 2: section 0A (catalog, flywheel, coverage, multi-user readiness, no-AI builder, prices and live data); revised 1.1, 1.4, 2.8, 4.11, 6.1, 7.6, 8.3; trails path moved to `data/catalog/trails/` |
