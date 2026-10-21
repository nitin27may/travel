# Capture contract: the full schema audit and rethink for places, routes and activities

Status: draft (18 Oct 2026). Build steps 1 to 4 of section 11 are built (lane CC, 18 Oct 2026): the schema and tree, the generator and CLI, the completeness engine, and the migration. Sections 6 and 7 (UI sections and filters, steps 5 and 6) are not built. Owner: travel-planner (Opus).

**Every researcher, crawler, scraper and import reads this page first.** It settles, in one place, every schema decision for places, sites, scenes, summits, trails, hikes and activities: what a record is, which type it has, which properties it must carry, where each value comes from, how a gap is worded, and where the UI shows it.

Owner direction (18 Oct 2026), summarised:
- Whenever a place is added, the schema says what metadata it needs, for every kind: lake, waterfall, trail, hike, park, play area, adventure area, rafting.
- Activities are tagged and captured too, not only places and their nearby places. The more detail we capture (time to visit and so on), the better we can show related things.
- Any agent that researches, fetches, crawls or scrapes knows in advance exactly which properties to collect, so the UI can show them well later.
- The type vocabulary misses no kind of place or activity a person goes out to visit or do: nature, water, air, snow, culture and family play.
- A new type is a data entry, not a schema change and not a UI change. A subtype inherits its parent's contract and overrides only what differs.
- Activities get difficulty and effort on the same family-effort scale, mapped from their own grades.
- Places hold activities. A summit is part of a hike; a lake offers a canoe rental and a cruise.
- Filters differ by type. Narrowing to a category brings in that category's filters, from the contract, with no per-type UI code.

**This page extends, and in places supersedes:**

| Page or file | What changes |
|---|---|
| [kinds/README.md](kinds/README.md) and the 15 kind profiles | Their field lists, link checklists and checks are folded into the base contract and the type deltas here (section 3). The profiles stay as worked examples and traps. Their `D`/`U`/`C` check lists become generated from the contract (section 5). |
| [suitability-applicability.md](suitability-applicability.md), `data/schema/suitability-applicability.json` | Its 37 flat profiles become marks on nodes of the type tree (section 2.3). The JSON file is then generated from `data/vocab/types.json`; nobody edits it by hand. The matrix itself is unchanged. |
| [suitability.md](suitability.md), [relevance.md](relevance.md) | Unchanged as specs for their groups. Their fields keep their homes; this page says which kinds need them and where they show. |
| [lanes/](lanes/) | Lane briefs keep the "how". The "what" (fields per kind) comes from `capture.ts fields` (section 5). |
| `core/src/schema/enums.ts` `PLACE_KIND`, `ACTIVITY_TYPE`, `STAY_KIND`, `SUIT_KIND`, `SUIT_SUBKIND`, `LINK_KIND` | Replaced by one type tree and one link vocabulary (sections 2 and 3.4). The old values become aliases. |

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| CC1 | **Three layers, three record shapes: place (the where), route (the way) and offer (the doing).** A place exists whatever you do there (summit, viewpoint, lake, museum, parking lot) and holds the payoff, facilities, access season and draw. A route is a line with a start, an end and places it passes (trail, trek stage, via ferrata, ski run, river section, scenic drive, a lift line) and holds distance, gain, time, effort and stroller access. An offer is a product someone runs, rents or sells on a route or at a place (rafting trip, canoe rental, gondola ticket, timed-entry permit, room) and holds operator, limits, price, booking and its season. Self-guided hiking is not an offer: the route is the activity. Stays, eateries, access points and events are places with their own types. Tested against ten examples in 2.7. | One contract, one validator and one page template, instead of eight catalogue tables with drifting columns (audit 1.2 and 1.5, D1-D6) | The catalogue tables (`trails`, `activities`, `offers`, `stays`, `eateries`) merge into three. They are empty today (`data/catalog/*/` holds only geometry), so the cost is code, not data. |
| CC2 | **One closed type tree**: domain, category, type, optional subtype (`water.paddle.canoe`, `air.zip.kids_course`). 15 domains, 61 categories, 324 type and subtype ids (section 2.2). Every record has exactly one `type`. `kind` and `subkind` are derived from it for old readers. | The owner's "miss nothing" and "extend without rebuilding" | A type id is a path; renaming a node needs an alias row |
| CC3 | **Inheritance.** A node's capture marks, effort scales, display rules, link checklist, sources and relevance class are resolved by walking from the root to the node. A child overrides only what differs. | A new subtype is one JSON entry (section 8) | A deep override can surprise. `capture.ts explain <type>` prints where each mark comes from. |
| CC4 | **Activities are offers** attached to places or routes by `at`, run by an `operator` record, with optional `variants` for products that differ only in limits, time or price (Family Float and Class III on one river with one operator). | The owner's model; it matches the suitability `offers[]` that already exists | Variants and separate offers are a judgement call; rule in 2.4 |
| CC5 | **Relations are typed and few**: `reaches` (a route's payoff), `passes` (with `at_km`), `on` (offer on a route), `at` (offer at a place), `run_by`, `part_of`, `starts_at`, `parks_for`, `serves`, `combo_with`, `alternative_to`, `pairs_with`, `variant_of`. `reached_by` is the derived inverse of `reaches`, never stored. "How to get there" and "At this place you can also" are queries over them (sections 2.5, 2.7). | Niagara, Lake Louise and a summit on a hike are all data, never page code | Relations need refs that resolve; the validator checks them |
| CC6 | **One property registry** (`core/src/schema/capture/properties.ts`) defines every property once: key, group, value type, unit, label, gap wording, UI section, display level and filter role. Values use the suitability `Val` wrapper everywhere. | The audit found 9 places defining the same facts (1.1, 1.5) | A new property is a schema change on purpose; a new type is not |
| CC7 | **One authored data file for marks**: `data/vocab/types.json` (the tree with its overrides). A generator writes the resolved contract to `data/schema/capture/<domain>.json`, the old applicability file, rendered docs, the validator's checks and the UI section map (section 5). | "Changing a kind's fields is one edit" | The generator and its drift check must exist before any new research (backlog 3a.12) |
| CC8 | **The UI renders sections from the contract**: a fixed list of 14 sections, each drawing the properties the resolved contract assigns to it with renderers chosen by value type. No per-type components. | "The UI renders sections from the contract, never per-type code" | A new value type (not a new type) needs a renderer, which is rare |
| CC9 | **Type-aware filters come from the property registry.** The four primary filters stay fixed on unscoped lists. Narrowing Kind to a domain or category adds that scope's facet properties under "More filters" (section 7). | P4, and the owner's "filters differ by type" | List rows carry a few more derived facet bands; the P8 allowlist test grows by those keys |
| CC10 | **Effort is one family-effort scale (FE1-5) for everything that has effort**, mapped from each activity's own grade system by `data/schema/difficulty-map.json`. A new grade system is a data entry. Things with no effort (a boat tour, a lift, a zip line) show time instead (applicability PC3). | Owner point 3 | Mapping tables need a reviewer per scale |
| CC11 | **Crawlers obey others' terms as we ask others to obey ours (P8 in reverse).** Never Google, AllTrails, Tripadvisor and the rest; robots.txt and terms honoured; one request at a time per host; every value carries its source, read date, method and quote (section 9). | Legal, ethical and practical | Some facts stay link-only or "ask the operator" |
| CC12 | **Every crawl run writes a run record** listing, per ref and per R field, what it found, what it searched without result, and what it could not reach (section 9.6). | "Record what it could not find" is research output | One more file per run |

## 1. Audit of what exists

### 1.1 Where properties are defined today

| Id | Definition site | What it holds | Records today |
|---|---|---|---|
| K | `research/method/kinds/*.md` (15 profiles) | per-kind fields as `attrs.*`, `eligibility.*`, link checklists, D/U/C checks | none; Markdown only, nothing validates it |
| L | `research/method/lanes/*.md` (17 lanes) | required output fields per lane, link table (trails), source order | none; Markdown only |
| S | `core/src/schema/suitability.ts` (shared block plus 18 extensions) | limits, who it suits, effort drivers, times, facilities, hazards, water safety, participation | 214 lane records, 289 migrated |
| SA | `data/schema/suitability-applicability.json` | R/A/N/op per field for 37 profiles × 148 fields | used by the validator and `suitability.ts fields` |
| RV | `core/src/schema/relevance.ts`, `data/vocab/relevance-classes.json` (42 classes) | QID, class, draw, standing, distinction, easy payoff, weather, access cost, signals | 209 records |
| LOC | `core/src/schema/locations.ts` (places v3) | identity, point, area chain, QID, `season_months`, `kid_fit`, common limit columns | 64 places; limit columns empty on all 64 |
| CAT | `core/src/schema/catalog/*.ts` (common, trails, activities, offers, offer_prices, stays, eateries, area_guides) | the planned catalogue columns, booking windows, prices | 0 rows (only `trails/geo`, `legs/geo`) |
| SRC | `data/sources/registry.json` (`sources/1`, merged from SR) | 293 sources with use links, licence and terms notes, re-check cadence, link status | 293 |
| PUB | `web/lib/public/types.ts` and `places.ts` | what the site reads: `PublicPlace.facts[]` as free-text label/value pairs, `access`, `hazards`, `links`, `photos` | 105 place pages built |
| TL/SH | `docs/v2/features/trip-timeline.md`, `short-trips.md` | what the scheduler and the outing frame need: durations, hours, slots, sun anchors, permits with release rules, go checks | specified; `TimelineEntry` is not in code |

### 1.2 Property inventory

Columns: where the property is defined, the kinds it applies to, the UI surface that shows it today (`PlacePage` sections by line in `web/components/places/PlacePage.tsx`), and the problem found. "None" in the UI column means no surface reads it. Abbreviations are the ids in 1.1.

| Group | Property | Defined in | Kinds | UI today | Problem |
|---|---|---|---|---|---|
| Identity | name, names by language | KR core, LOC `name`/`name_lang`, CAT `name_lang` | all | Cover | `name_lang` holds one language; K needs `{lang: name}` |
| Identity | kind, subkind | LOC `PLACE_KIND` (19), S `SUIT_KIND` (12) + `SUIT_SUBKIND` (84), K entity kinds (place, trail, activity, stay, eatery, event), CAT `ACTIVITY_TYPE` (30), `STAY_KIND` (7), RV class prefixes (18), PUB 11 families (`model.ts` EXPECT) | all | Cover kicker, glance plan | **Six vocabularies, none complete** (1.5). RV uses kinds `park` and `region` that S does not have. |
| Identity | point | LOC `lat`/`lon`, CAT `lat`/`lon`, TR `trailhead_lat`/`lon`, K `point` `[lon, lat]` | all | Map card, Directions | Two coordinate orders across docs; trails store the access point, not the payoff |
| Identity | point_source, point_checked | K (5), L trails, PUB `pointSource` | all | PointSource line | Not a column in LOC or CAT; lives only in the public adapter's legacy data |
| Identity | area chain | LOC `area_id` > regions > countries | all | Breadcrumbs, kicker | Fine |
| Identity | QID | LOC `wikidata`, RV `wikidata` (Val), K `wikidata_qid` | all | Footer | **Three homes**; RV is the only one with provenance |
| Identity | OSM ref | K `osm_ref`, TR `geometry_source_id` | all | none | No column on places |
| Identity | summary | K core, CAT `notes`, LOC `notes` | all | Cover | LOC `notes` mixes capture notes with summary (TODO "scrub internal capture notes") |
| Identity | tags | LOC `place_tags`, CAT `tags`, `data/vocab/tags.json` (80) | all | table and facet only | Activity tags (21) overlap with types ("rafting", "via-ferrata"); duplicate classification |
| When | operating season | K `season` rows (R11), LOC/CAT `season_months`, S `access_season`, CAT `area_guides.best_months` | all | When to go (SeasonStrip) | **Four shapes**; `access_season` (getting there) and operating season (the lift runs) are conflated |
| When | best window (foliage, flow, larches) | RV `draw_peak`, E wildlife `peak_months`, K waterfall `attrs.flow`, K event `peak_window` | waterfall, wildlife, viewpoint, event | none | No shared field; `draw_peak` is about fame, not timing |
| When | best time of day | K `attrs.light` (5 kinds), K lake `attrs.best_time`, E wildlife `best_time`, TL sun anchors `golden-am/pm` | viewpoint, lake, waterfall, trail, wildlife | glance slot "Best time of day" / "Light" | **UI slot with no field**; three enums |
| When | opening hours | K section 9 `hours` (periods, last_entry, last_up/down), EA `hours` (weekday intervals), TR `hours` (walking time, text), PUB fact "Hours" | sight, lift, eatery, offers, ticketed swim | glance slot "Hours" | **`hours` means opening hours in K and walking time in TR**; no structured hours anywhere with data |
| When | time on site, adult time, child time | S `on_site_min`, `adult_time_min`, `child_time_min`; K `duration_min/max`; LOC/CAT `duration_min`; TR `hours`, `km_range`; legacy `time_needed_hours`, `durationMin` | all | glance "Time"/"Duration" from a fact | **Six names**; `child_time_min` is empty on all 214 records |
| When | slots and departures | K adventure `attrs.slots`, K lift `frequency`, SH `activity-slot` | offers | none | No schema |
| Access | access points (trailhead, parking, stop) | K trailhead, parking profiles; L trails; PUB `access` | trail, lake, viewpoint, waterfall, sight, offers | Trailhead and parking (AccessCard) | Only legacy Dolomites data has them; no catalogue table |
| Access | walk from access | S `walk_m`, K `attrs.walk_from_access {m, min, gain_m, surface, stroller}` | viewpoint, lake, waterfall, sight | glance "Walk from the car" | Two shapes; stroller inside it duplicates S `stroller` |
| Access | transit, shuttle | K trailhead `attrs.lines`, K town `attrs.base.transport` | all | glance "Getting there" (town) | No structured field |
| Access | permits, timed entry, reservations | RV `access_cost` (typed, `book_ahead_days`), CAT offers `opens_*`, `sellout_*`, K `window_rule`/`window_spec`, SH `BookRule`, TR `permit` (text) | all | `booking` callout | **Five shapes** of one booking window |
| Access | fees and prices | CAT `offer_prices` (`PRICE_PER`), K price `{basis per_person...}`, K parking `attrs.fee`, LOC/CAT `cost_ref`, K `cost_band` | all | glance "Fee"/"Ticket"/"Price" from a fact | Two `per` vocabularies; no data |
| Suitability | limits, age band, stroller, carrier, wheelchair | S (Val), LOC/CAT flat columns, K `eligibility.*`, TL contract | all | Who it suits shows only `kidFit` and `minAge` | **The 214 records have no UI** (S1 queued); K `eligibility.stroller` enum `yes/jogging_stroller/no` vs S `smooth/all_terrain/none` vs TL `yes/partly/no`; `ACCESSIBILITY` `step-free` vs `WHEELCHAIR` `step_free` |
| Suitability | effort and grade | S `effort` (derived FE), CAT `house_grade`, `house_basis`, TR `local_system`/`local_grade`, K trail `attrs.house_grade` | trail, offers with grades | glance "Difficulty" from a fact | Three homes; `LOCAL_SYSTEM` (9) is a subset of `GRADE_SYSTEM` (27) |
| Relevance | class, draw, standing, why, pairs | RV | all | none | RV1 queued; `pairs_with` specified (relevance 3.2) but not in the schema |
| Facilities | toilets, water, food, shade, signal | S (Val); K `attrs.facilities` (6 kinds, different sub-shapes), K trailhead toilets `flush/pit/none/seasonal`, K trailhead `cell_coverage` | all | none | **Fields with no UI home**; S `signal` and K `cell_coverage` duplicate |
| Facilities | change rooms, picnic, baby change, playground on site | K swim-spot `attrs.facilities` only | swim, beach, park, play | none | Not in S; the owner asked for change rooms |
| Safety | hazards | S `hazards` (typed), TR `hazards` (strings), K `attrs.hazards`, K `attrs.safety` (fencing), S `exposure`, PUB `hazards: string[]` | all | Hazards card | **Four shapes**; PUB reads untyped strings |
| Safety | closures, conditions | K `conditions` link, L `condition_report`, CAT `area_guides.safety`, K hours `closures` | all | none | No structured closure field |
| Safety | wildlife rules | E wildlife `min_distance_m`, `stay_in_vehicle`; S hazards `wildlife` | wildlife, trail | none | Fine once S1 renders it |
| Links | link kinds and states | K section 6 (21 kinds), `LINK_KIND` enum (11, includes `google-maps`), L trails table, TR `official_url`/`alltrails_url`/…, `DAY_LINK_KIND` | all | LinksTabs (5 tabs) | **Three vocabularies**; `google-maps` is stored in the enum though K says navigation is generated |
| Media | photos with licence and credit | L media (filename, licence, author, attribution, width, height), LOC `image`, PUB `photos[]` | all | Photos, Credits | LOC `image` has no licence fields |
| Nearby | part of, offered at, along the way, combo, alternative, pairs | K relation names (`parks_for`, `serves`, `trailhead_of`, `starts_at`, `combo_with`, `alternative_to`, `affects`, `covered_by`), RV `easy_way`, `pairs_with`, AC `place_id`, OF `subject_entity`/`subject_id` | all | "Places in X / Also in district" (area containment only) | **No `part_of` or `at`**; "at this place you can also" cannot be drawn |
| Sources | per value src, read date, quote | S/RV Val, K evidence rows, L envelope `observed_on`, SRC registry, CAT `field_meta`, `catalogSources` | all | Facts and sources, provenance popover | Basis vocabularies differ: `SUIT_BASIS` (7, with `operator_info`), L `official/operator/community/agent_inferred`, `SOURCE_KIND` (8), `CONFIDENCE` (5) |
| Status | completeness level | K levels (Draft, Usable, Complete), S `suit_level` (4 incl. `usable_partial`), PUB `completeness` | all | Data notes badge | Two engines with different checks |

### 1.3 Fields with no UI home

- **All suitability values** of the 214 records: limits, age band, stroller, carrier, wheelchair, effort, times, toilets, shade, water, food, signal, water safety, participation, every extension (S1, backlog 3a.5).
- **All relevance values** of the 209 records: class, draw, standing, distinction, easy payoff, weather, access cost, designations (RV1).
- `PublicPlace.tags`, `subkind`, `category`, `elevationM` as text, `lines[].source`, `completeness.passed/total` (UI agent read, 18 Oct).
- K-only fields with no data and no UI: `viewpoint_bearing`, `photo_spot`, `drone_rules`, `crowds`, `queue_note`, `seat_side`, `loses_sun`, `evening_vibe`, `fills_by`, `capacity_cars`.

### 1.4 UI sections with no field behind them

| UI | Reads | Behind it today |
|---|---|---|
| Glance strip, 6 slots per family (`model.ts` 75-87) | free-text facts matched by label ("Fee", "Lot", "Best time of day") | No typed field for best time, hours, fee, swimming, boat rental, lift, exposure, last entry, check-in, phone, menu. Measured on the 105 built pages: hours missing on 6 of 6 sights and 2 of 2 eateries; best time or light on 23 of 25 lakes and viewpoints; fee on 82 of 82 applicable pages outside trails |
| "Who it suits" (PlacePage 441) | `kidFit` (`'unknown'` for every prototype place), `minAge` | 214 suitability records exist and are not read |
| Globe card facts ×3 (globe spec 4.3) | best months, kids, elevation or length | not in `GlobeCard` |
| Timeline entry meta (timeline-design 4.2) | hours, best light, price with year, child rule, fixed slot, `time.source` | not in `DayItem` |
| "Nearby, worth adding" (relevance 3.2) | `pair_with` | not in RV schema |
| Suitability chips: rule, advice, gap, fits, advice fail, rule fail (components.md 2.8) | `kids_from`, `family_effort`, `stroller_ok` | `ChipKind` lacks all six |

### 1.5 Duplicates and conflicts, and how this page resolves them

| # | Conflict | Resolution here |
|---|---|---|
| D1 | Six kind vocabularies (19, 12+84, 6, 30, 7, 11 families, plus 18 class prefixes) | One type tree (2.2). Old values are aliases in `types.json` `aliases`. |
| D2 | Limits in four places: S block, LOC/CAT flat columns, K `eligibility.*`, TL contract | S block is the only input. Flat columns stay a computed copy (K9 rule). K `eligibility` and TL fields are views of S. |
| D3 | Stroller: S `smooth/all_terrain/none`; K `yes/jogging_stroller/no`, `walk_from_access.stroller`, `attrs.carries.pushchairs`; TL `yes/partly/no` | S `stroller` (surface) and `stroller_on_board` (carriage) are canonical; `stroller_ok` (`yes/partly/no`) is derived for filters and TL |
| D4 | Accessibility: `step-free` (ACCESSIBILITY, L accessibility) vs `step_free` (WHEELCHAIR); K `eligibility.accessibility` vs `attrs.accessibility` vs `attrs.accessible_spaces` | S `wheelchair` plus `access_detail`, `accessible_toilet`, `accessible_parking`; `step-free` hyphen values become aliases |
| D5 | Time: `duration_min`, `duration_max`, `on_site_min`, `adult_time_min`, `child_time_min`, TR `hours`, `time_needed_hours`, `durationMin`, K `attrs.time_h`, `attrs.activity_min` | S `on_site_min` (places), `adult_time_min` and `child_time_min` (routes), offer `duration_min` (door to door, with check-in) and `activity_min` (the activity itself). TR `hours` is renamed `time_h` and folded into `adult_time_min`. |
| D6 | `hours` means opening hours (K) and walking time (TR) | `hours` is opening hours only (3.2 format) |
| D7 | Season: K rows, `season_months`, `access_season`, `best_months`, `draw_peak` | `season` = operating (it runs, it is open); `access_season` = you can get there; `best_window` = the good weeks; `season_months` derived for cards; `draw_peak` stays relevance-only and must fall inside `best_window` |
| D8 | Booking windows in five shapes | One `window` object on access and experience offers (3.2); RV `access_cost` items of type `permit_lottery`, `timed_entry`, `day_permit`, `daily_cap`, `shuttle_only`, `toll_reservation` point to that offer and `book_ahead_days` is derived |
| D9 | Price `per`: `PRICE_PER` vs K `basis` | One `per` vocabulary: `person`, `adult`, `child`, `family`, `group`, `vehicle`, `vehicle_day`, `hour`, `night`, `room`, `boat`, `weight` |
| D10 | Hazards in four shapes; fencing as `attrs.safety` and S `exposure.fenced` | S `hazards` (typed by `HAZARD_CATEGORY`) and S `exposure`; PUB strings become a rendering of them |
| D11 | Signal as S `signal` and K `cell_coverage` | S `signal` |
| D12 | Facilities: K `attrs.facilities` sub-shapes vs S fields | S fields, extended by `change_rooms`, `showers`, `picnic`, `baby_change` (3.2) |
| D13 | QID in three places | RV `wikidata` (Val) is the input; LOC `wikidata` is a computed copy |
| D14 | Market is a sight subkind (K sight) and an eatery subkind (K eatery) | `food.market.market` for a market with regular hours; `event.market` for a dated pop-up (Christmas market) |
| D15 | Link vocabularies (K 21 kinds, `LINK_KIND` 11 with `google-maps`, TR url columns) | One `LINK_KIND` (3.4); navigation stays generated, never stored |
| D16 | Basis vocabularies (`SUIT_BASIS`, L confidence, `SOURCE_KIND`, `CONFIDENCE`) | `SUIT_BASIS` is the value basis; `SOURCE_KIND` is the source row's kind; a new `method` says how the value was taken (9.4). `CONFIDENCE` retires with the catalogue merge. |
| D17 | Two completeness engines (K checks, S `suit_level`) | One engine over the resolved contract (5.3); K checks are generated |
| D18 | Activity tags (`tags.json` kind `activity`, 21) repeat types | Activity tags on places are derived from the types of their offers and parts; the 21 tags become aliases of type nodes |

## 2. Types, records and relations

### 2.1 Records

| Record | Is | Has its own | Examples |
|---|---|---|---|
| **place** | a point or an area you go to | point (and optional polygon), hours, season, access points, facilities | Lake Louise, Fairview Lookout summit, Elora Gorge Conservation Area, Moraine Lake Park and Ride, a playground, a hut, a hotel |
| **route** | a line you travel, start to end | geometry, distance, gain, shape, grade, start and end places | Larch Valley trail, Alta Via 1 stage 3, the Icefields Parkway, a Kicking Horse river section, Via ferrata Tridentina |
| **offer** | a product someone runs, rents or sells | operator, limits, season, hours or slots, duration, price, booking window, booking URL, its own suitability, optional variants | Wild Water Class III rafting, GRCA tube rental at Elora, Lake Louise canoe rental, Maligne Lake cruise, Banff Gondola ticket, Moraine Lake shuttle seat, Algonquin day permit |
| operator | who runs offers | name, URL, phone, licence (land-manager permit), terms page | Wild Water Adventures, Pursuit, Niagara Parks |

Rules:
1. **An access point is a place** (`access.*` types), related by `parks_for`, `serves` or `starts_at`. It is never folded into the subject (K `split_required` stays).
2. **A self-guided activity on a free route is not an offer.** Paddling your own canoe on a canoe route is the route; renting the canoe is an offer.
3. **A ticketed place keeps its ticket as an offer** (museum entry, lift ticket, pool entry), so prices, windows and limits live in one shape for everything that is sold.
4. **A lift is a route with a ticket offer on it.** The line runs from the valley station to the top station, both places (`starts_at`, `reaches`); the ride time is the route's time. Hours, `last_up` and `last_down` belong to the ticket offer, because they strand people and differ by season. Applicability profile `lift` resolves on the offer; stroller-on-board and cabin are offer facts. See 2.7 for why.

### 2.2 The type tree

Ids are `domain.category.type[.subtype]`. "Rec" says which records may carry the type (P place, R route, O offer). Profile is the suitability profile resolved at that node (section 2.3); children inherit it unless a cell says otherwise. Effort scale is the grade system mapped onto FE1-5 (section 2.6); "none" means the node has no effort and shows time.

**nature**

| Category | Types (subtypes in brackets) | Rec | Profile | Effort scale | Relevance class default |
|---|---|---|---|---|---|
| `nature.trail` | hike, walk, river_hike, scramble, summit_hike, nature_walk (boardwalk, interpretive), accessible_trail, rail_trail, snowshoe_route | R | hike (walk: walk; river_hike: river_hike) | sac, cai, parks-canada, nps, yds, uk, apn, dnt, sepaq; snowshoe_route: sac-wt (new) | trail/* |
| `nature.trek` | hut_trek (alta_via, tmb_style), backpacking_route, trek_stage (hut_stage) | R | hike | as trail | trail/hut-to-hut |
| `nature.summit` | summit, peak_viewpoint | P | viewpoint | none (the route carries it) | peak/summit |
| `nature.viewpoint` | viewpoint, pullout, lookout_tower, skywalk_platform | P | viewpoint | none | viewpoint/* |
| `nature.landform` | mountain, glacier_view, canyon, gorge, slot_canyon, arch_hoodoo, rock_formation, wild_cave_entrance, dune, volcano_crater, geothermal (geyser, mud_pots), coast_cliff, island, valley | P | viewpoint (canyon, gorge, slot_canyon: waterfall) | none | canyon/*, gorge/*, glacier/* |
| `nature.protected` | national_park, state_provincial_park, conservation_area, nature_reserve, forest, dark_sky_site | P | area | none | park/* |
| `nature.garden` | botanical_garden, arboretum, urban_park, flower_fields | P | area | none | park/urban |
| `nature.wildlife` | viewing_spot, bird_hide, tide_pools, wildlife_tour, whale_watch, stargazing | P (spot), O (tour) | wildlife | none | wildlife/viewing |

**water**

| Category | Types | Rec | Profile | Effort scale | Relevance |
|---|---|---|---|---|---|
| `water.body` | lake, pond_reservoir, river, creek, lagoon, sea_bay_fjord | P (river also R for a section) | lake (river, creek: lake with `ext.paddle` A) | none | lake/* |
| `water.falls` | waterfall, cascade, rapids | P | waterfall | none | waterfall/* |
| `water.swim` | beach (lake_beach, sea_beach), swim_spot, swimming_hole, outdoor_pool, aquatic_centre | P (+O entry) | beach (swim_spot, swimming_hole, pools: swim) | none | lake/swim-beach, beach/ocean |
| `water.thermal` | hot_spring, thermal_bath, spa, sauna | P (+O entry) | hot_spring | none | water/* |
| `water.paddle` | canoe (rental, tour, canoe_trip), kayak (rental, tour, sea_kayak), sup (rental, tour), packraft | O, R (paddle route) | canoe_kayak (sup: sup) | flatwater, whitewater | lake/forest-paddle |
| `water.river` | rafting, float, tubing, river_bug | O | rafting (float, tubing: float) | whitewater | water/rafting, water/tubing |
| `water.boat` | boat_tour, cruise, zodiac, glass_bottom, sailing, ferry_crossing, water_taxi, boat_rental (motorboat, pedal_boat, rowboat), fishing_charter | O | boat (boat_rental: canoe_kayak, operated false) | none | water/boat-tour |
| `water.motor` | jet_ski, waterski_wakeboard, towable_tube, flyboard | O | motor_water (new) | none | water/motor (new) |
| `water.under` | snorkel, scuba (discover, certified) | O | dive (new) | none | water/dive (new) |
| `water.surf` | surf, kitesurf, windsurf | O | surf (new) | operator | water/surf (new) |
| `water.fishing` | fishing_spot, fishing_lesson | P, O | lake | none | water/fishing (new) |

**air**

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `air.zip` | zipline (single_line, course, tandem_line, mega_zip, kids_course) | O | zipline | none | activity/ropes-zip |
| `air.jump` | bungee, giant_swing, skydive_tandem | O | bungee (skydive: paraglide) | none | activity/ropes-zip |
| `air.flight` | paragliding, hang_gliding, hot_air_balloon, heli_tour, scenic_flight, parasailing | O | paraglide (balloon, heli, scenic: air_tour) | none | activity/air (new) |

**mountain** (adventure on rock, ice and in caves)

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `mountain.ferrata` | via_ferrata (self_guided, guided, kids_ferrata) | R (route), O (guided) | ferrata (operated becomes `flag`) | schall, huesler, cai-ferrata, osm-ferrata | trail/via-ferrata |
| `mountain.climb` | crag, multipitch, bouldering, indoor_wall, guided_climb, kids_climb | P (crag, wall), O | climb (new) | yds-rock, french, uiaa (new); bouldering: font, v-scale (new) | activity/climb (new) |
| `mountain.alpine` | guided_summit, glacier_walk, ice_trek, ice_climbing | O | glacier (guided_summit: hike, operated) | glacier: operator; guided_summit: ifas (new) | glacier/walk-on |
| `mountain.canyon` | canyoning | O | canyoning (new) | canyon-fr (new, v·a·class) | activity/canyon (new) |
| `mountain.cave` | caving | O | caving | operator | cave/show |

**snow**

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `snow.ski` | ski_area (ski_hill, ski_resort), ski_run, alpine_ski, ski_lesson, nordic_centre, cross_country, ski_touring | P (area), R (run, nordic trail), O (pass, lesson) | snow | piste-eu, piste-at-ch, piste-na, piste-jp; touring: ifas | snow/ski (new) |
| `snow.play` | sledding_hill, snow_tube_park, skating_rink, skating_trail, snow_play_area | P (+O) | play (new) with `ext.snow` A | none | snow/play (new) |
| `snow.tour` | dog_sled, snowmobile, sleigh_ride, snowcat, ice_fishing, snowshoe_tour | O | snow | none (snowshoe_tour: sac-wt) | snow/tour (new) |

**wheels**

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `wheels.bike` | cycle_path, road_route, mtb_trail, bike_park, pump_track, bike_tour, bike_rental (e_bike, kids_bike, trailer) | R, P, O | cycle_path (mtb_trail: mtb_xc; bike_park: mtb_lift) | bike-path, imba, sts, trailforks, whistler | trail/rail-trail |
| `wheels.drive` | scenic_drive, mountain_pass, offroad_4x4, atv_quad, vehicle_tour | R, O | drive (offroad, atv, vehicle_tour: vehicle_tour) | none | drive/* |

**ride** (scenic conveyances)

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `ride.lift` | gondola, cable_car, chairlift, funicular, rack_railway | R (the line; stations are P) + O ticket | lift (on the offer) | none | lift/* |
| `ride.rail` | scenic_train, heritage_railway | R + O ticket | lift (on the offer) | none | lift/panorama |
| `ride.wheel` | observation_wheel | P + O | lift | none | lift/panorama |

**animals**

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `animals.ride` | horse_ride, pony_ride | O | horse | operator (pace) | activity/horse (new) |
| `animals.see` | zoo, aquarium, safari_park, wildlife_sanctuary, raptor_centre | P + O | sight | none | animals/zoo (new) |
| `animals.farm` | petting_farm, farm_experience | P + O | play (new) | none | play/farm (new) |

**culture**

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `culture.museum` | museum, art_gallery, science_centre, childrens_museum, planetarium_observatory, open_air_museum | P + O | sight | none | sight/museum |
| `culture.heritage` | historic_site, castle_fort, palace, ruins, monument, landmark, old_town, religious_site, lighthouse, bridge (covered, suspension), dam, visitor_centre | P | sight | none | sight/*, town/historic-village |
| `culture.under` | show_cave, mine_tour | P + O | show_cave | none | cave/show |
| `culture.tour` | walking_tour, guided_tour, factory_tour, food_tour, cooking_class, tasting | O | sight (operated) | none | sight/heritage-site |
| `culture.show` | performance, sound_and_light, sports_game | O | sight | none | sight/landmark |

**play** (family play and amusement)

| Category | Types | Rec | Profile | Effort | Relevance |
|---|---|---|---|---|---|
| `play.playground` | playground, nature_playground, adventure_playground, splash_pad, indoor_play | P | play (new; splash_pad adds `ext.water` A) | none | play/playground (new) |
| `play.amusement` | theme_park, amusement_park, water_park, alpine_coaster, mini_golf, go_kart, trampoline_park, family_centre | P + O (rides as variants) | theme_park (new; alpine_coaster: coaster) | none | play/theme-park (new) |
| `play.adventure` | adventure_park, ropes_course, treetop_trail | P + O | zipline (adventure_park: theme_park) | none | activity/ropes-zip |
| `play.farm` | pick_your_own (orchard, berry, pumpkin, christmas_tree), corn_maze, hayride, sugar_bush | P + O (seasonal) | play (new) | none | play/farm (new) |

**food, stay, settlement, access, event**

| Category | Types | Rec | Profile | Relevance |
|---|---|---|---|---|
| `food.eat` | restaurant, cafe, bakery, teahouse, bar_pub, food_truck, hut_kitchen | P | eatery | none (not ranked) |
| `food.drink` | brewery, winery, distillery, cidery | P + O tasting | eatery | none |
| `food.market` | market, food_hall, grocery | P | eatery | none |
| `stay.room` | hotel, lodge, b_and_b, guesthouse, motel, resort, hostel | P + O room | stay | none |
| `stay.self` | apartment, cabin_cottage, rental_house | P + O | stay | none |
| `stay.mountain` | hut, bivouac | P + O bed | stay | trail/hut-to-hut (as a destination) |
| `stay.camp` | campground, backcountry_site, glamping, rv_park | P + O pitch | stay | none |
| `settlement` | city, town, village, district, cluster | P | town (cluster: area) | town/* |
| `access.start` | trailhead, meeting_point, valley_station | P | access (new) | none |
| `access.park` | parking, park_and_ride | P + O reservation | access (new) | none |
| `access.transit` | shuttle_stop, transit_stop, station, dock, ferry_terminal, boat_launch | P | access (new) | none |
| `access.amenity` | picnic_area, rest_area, public_toilet, visitor_info, ev_charger, fuel | P | amenity (new) | none |
| `access.pass` | day_use_permit, timed_entry, backcountry_permit, park_pass, lift_pass, shuttle_seat | O | none (access offers carry no suitability; their limits live on the offer) | none |
| `event` | festival, market_event, sport_event, holiday, natural (foliage, bloom, larch, migration, aurora, salmon_run), closure | event record (dated occurrences, K event.md) | none | none |

**Counts.** 15 domains, 61 categories, 324 ids: 277 types and 47 subtypes, counted from the tables above. The tree covers every type the owner named: playground and play area (`play.playground`), adventure park (`play.adventure`), beach, picnic area, campground, splash pad, pick-your-own, zoo and aquarium, theme and water park, market, ski hill, lookout tower, multi-day hut treks, summits on trails, via ferrata, rock climbing, boating, canoe, cruise, skiing, zip line variants, jet ski, and the Niagara cluster (2.5).

**Offer classes.** Every `O` type also has a class, set at the category and overridable: `experience` (run by an operator: rafting, cruise, zip line), `rental` (self-guided with gear: canoe rental, tube rental at Elora, bike rental), `ticket` (entry to a place: museum, lift, pool, zoo), `access` (permit, timed entry, shuttle seat, parking reservation, pass) and `lodging` (room, bed, pitch). The class decides the offer base contract (3.3).

### 2.3 Reconciliation with the 37 suitability profiles and the 42 relevance classes

- **Suitability profiles become node marks.** Each of the 37 profiles is attached to the node in the "Profile" column; its R/A/N row is copied unchanged. **10 profiles are new**, because their fields differ from every existing row: `motor_water`, `dive`, `surf`, `climb`, `canyoning`, `play`, `theme_park`, `access`, `amenity` and the `river` variant of `lake` (water fields A). The total becomes 47. Each new profile is a row written by the planner and reviewed by the design reviewer before the lane that first meets it (section 10).
- **`operated`** stays a flag on records. The `ferrata` profile changes from `always` to `flag`, because most Dolomites via ferratas are self-guided routes.
- **Relevance classes.** 42 classes map to category defaults as in the tables. **14 classes are new** (marked "new"), because the tree adds domains that the 8 researched trips never met (play, snow, dive, climb). Relevance applies to places and routes, and to `experience` offers that people travel for on their own (Maligne Lake cruise, Athabasca icewalk). Other offers inherit their place's relevance.
- **K profiles.** The 15 Markdown profiles map onto nodes: trail to `nature.trail`; trailhead and parking to `access.*`; viewpoint to `nature.viewpoint`; lake to `water.body.lake`; waterfall to `water.falls`; sight to `culture.*`; town to `settlement`; adventure to the O categories; lift to `ride.*`; hut to `stay.mountain`; stay to `stay.*`; eatery to `food.*`; swim-spot to `water.swim` and `water.thermal`; event to `event`.
- **UI families** (`model.ts` EXPECT, 11) are replaced by contract sections (section 6.1); the glance plan per type is derived (section 6.2).

### 2.4 How a place holds many offers, and how an offer links to its operator

```jsonc
// place
{ "ref": "place/elora-gorge-ca", "type": "nature.protected.conservation_area", "point": [-80.4352, 43.6741], "point_source": "osm_way:...", ... }
// offer
{ "ref": "offer/elora-gorge-tubing", "type": "water.river.tubing", "class": "rental",
  "at": ["place/elora-gorge-ca"], "on": [{ "ref": "route/grand-river-elora-tubing", "from_km": 0, "to_km": 2 }],
  "run_by": "operator/grca",
  "starts_at": "place/elora-gorge-tube-hut",
  "season": { "v": [{ "from": "06-26", "to": "09-07", "status": "open" }], "state": "value", "basis": "operator_info", "src": ["src-0004"], "applies_to": "2026" },
  "hours": { ... }, "duration_min": { ... }, "price": [ ... ], "window": { ... }, "book_url": "...",
  "suitability": { ... },            // its own, checked against the type's profile
  "variants": [                      // only when limits, time or price differ and everything else is shared
    { "name": "Single tube", "suitability": { "min_height_cm": { ... } } } ] }
// operator
{ "ref": "operator/grca", "name": "Grand River Conservation Authority", "url": "...", "terms_url": "...", "phone": "..." }
```

Rules:
1. **One offer per product line of one operator at one place.** Products that share operator, place, meeting point, season and booking page but differ in limits, time or price are `variants` (Family Float and Class III, a 1 h and a 2 h kayak rental). A product with a different meeting point or season is its own offer.
2. **`at` may list several places** (a lift pass valid at three lifts; a boat tour stopping at two docks). The first is the primary place for maps and lists.
3. **An offer's fields win; anything it leaves out falls back** to the variant's offer, then to the place's values for facilities and access only. Limits never fall back from a place to an offer.
4. **An operator is a record, not a string**, because one operator runs several offers (Pursuit: gondola, Skywalk, cruise) and its terms, waiver and weather policy are one source for all of them.

### 2.5 Relations and "at this place you can also"

| Relation | From → to | Example | Used by |
|---|---|---|---|
| `reaches` | route → place (its payoff; one or more) | the Larch Valley route reaches Sentinel Pass; the Banff Gondola line reaches the Sulphur Mountain summit | "How to get there" on the place, the payoff on the route |
| `reached_by` | place → routes (derived inverse of `reaches`, never stored) | Sulphur Mountain summit is reached by the gondola line and the Sulphur Mountain trail | "How to get there" |
| `part_of` | place → place, route → route | Horseshoe Falls part_of the Niagara Falls cluster; the top station part_of Sulphur Mountain; Alta Via 1 stage 3 part_of Alta Via 1 | "Part of", breadcrumbs, rolled-up counts |
| `passes` (with `at_km`) | route → place | the Lake Agnes trail passes Mirror Lake at km 2.7 | route profile markers, "On the way" |
| `at` | offer → place | Lake Louise canoe rental at Lake Louise | "At this place you can also" |
| `on` | offer → route (with optional `from_km`, `to_km`) | Wild Water Class III on the Kicking Horse lower canyon section; the gondola ticket on the gondola line | "Ways to do this route" |
| `run_by` | offer → operator | | operator block, shared terms |
| `starts_at` | route or offer → access place | Larch Valley starts at Moraine Lake trailhead; rafting meets at Wild Water base | directions, the arrive-at rule (K 5) |
| `parks_for`, `serves` | access place → place or route | Lake Louise Park and Ride serves Lake Louise | Trailhead and parking |
| `combo_with`, `alternative_to` | any → any | | Plan B, the trip planner |
| `pairs_with` (hand-picked, with reason) | place or route → any | Lake Louise pairs with the Lake Agnes tea house walk | "Nearby, worth adding" (relevance 3.2) |
| `variant_of` | offer → offer | only when two offers must stay separate but are one product family | offer grouping |

**"At this place you can also" (section `around`, 6.1)** is computed, never typed:
1. offers whose `at` includes the place, grouped by domain ("On the water: canoe rental, cruise");
2. places and routes that are `part_of` the place, and their offers ("Niagara Falls: Horseshoe Falls, American Falls; Hornblower cruise, Journey Behind the Falls, WildPlay zip line, Whirlpool Aero Car, White Water Walk");
3. for routes, the places the route `passes` and `reaches` ("On the way: Mirror Lake; payoff: Lake Agnes Tea House"), and offers `on` it;
4. never the routes that only `reach` the place: those are "How to get there", a separate list (2.7).
At most 6 rows at rest, grouped, with a count and "Show all" (P1, P3).

**Niagara as the worked cluster.** `settlement.cluster` "Niagara Falls" (point at Table Rock), with `part_of` children: Horseshoe Falls and American Falls (`water.falls.waterfall`), the Whirlpool (`water.body.river`), Queen Victoria Park (`nature.garden.urban_park`). Offers: Niagara City Cruises (`water.boat.boat_tour`) at the cruise dock; Journey Behind the Falls (`culture.tour.guided_tour`, class ticket); WildPlay Zipline to the Falls (`air.zip.zipline.mega_zip`); Whirlpool Aero Car (`ride.lift.cable_car` line with a ticket offer); White Water Walk (`nature.trail.nature_walk.boardwalk` with a ticket offer); Niagara SkyWheel (`ride.wheel.observation_wheel`). One page can then list everything at Niagara from data.

### 2.6 Difficulty, effort and age for activities

- **One family-effort scale, FE1-5**, named on chips (Stroll, Easy, Moderate, Hard, Technical; difficulty-map v2). The number stays internal (applicability PC11).
- **Each category names the grade systems it accepts** (`effort.scales` in `types.json`). A record stores `effort.source_grade {system, value}` exactly as published. `derive.ts` maps it to FE through `data/schema/difficulty-map.json`.
- **New scales to add as data** (each is one block in `difficulty-map.json`, `GRADE_SYSTEM` append): `yds-rock` (5.0-5.15), `french` (sport 1-9c), `uiaa` (I-XII), `font` and `v-scale` (bouldering), `ifas` (alpine F to ED), `canyon-fr` (v1-7, a1-7, I-VI), `sac-wt` (snowshoe WT1-6). Existing: SAC, CAI, Parks Canada, NPS, YDS class, UK, APN, DNT, SEPAQ, Schall, Huesler, CAI ferrata, OSM ferrata, IMBA, STS, Trailforks, Whistler, bike path, whitewater I-VI, flatwater, piste EU, AT-CH, NA (green circle to double black) and JP.
- **Mapping rule.** A scale maps to FE by the easiest grade a family member must manage on that product, not the hardest available at the place. A ski area's FE is its easiest lift-served run (as `mtb_lift` in applicability 5.3); a crag's FE comes from its easiest top-rope routes, and the grade range is a separate fact.
- **No effort** for nodes whose cost is time or nerve, not effort (boat, lift, zip, jump, flight, motor water, amusement). The effort chip slot shows time (PC3). Their limits (age, height, weight, licence) are R.
- **Age and limits sit on each offer and variant** (`suitability` block), never on the place, with basis `operator_rule` for limits (validator `limit_source`). `kids_from` and `stroller_ok` are derived exactly as applicability 5.3.
- **A new shared participation field, `participation.driver`** (`{min_age, licence: none | boat_card | driving_licence, passenger_min_age}`), replaces `ext.coaster.driver_rule` and serves jet ski, go-kart, ATV and snowmobile. This is the one schema change the tree needs (section 10, step 1).

### 2.7 The three layers, tested: place, route, offer

The coordinator proposed a three-layer model for the thin line between a hike (the doing) and a summit or viewpoint (where you go to see). **Adopted, with four adjustments:**

| # | Adjustment | Why |
|---|---|---|
| T1 | **Self-guided doing is not stored as an offer.** "Hiking on a route" is the route itself. An offer exists only when someone runs, rents or sells something. | Otherwise every trail gets an empty twin record, and two records drift |
| T2 | **Lifts, ski runs and scenic trains are routes** with a ticket offer on them; their stations are places. | They have a start, an end and a ride time, exactly like a trail. Hours and `last_down` stay on the ticket offer. |
| T3 | **`reaches` is kept apart from `passes` and `part_of`.** `reaches` is the payoff (one primary, ordered extras); `passes` is on the way; `part_of` is containment (a top station is part of the summit area, a stage part of a trek). | "Is this why you go?" and "is this inside that?" are different questions, and the UI answers them in different sections |
| T4 | **A route needs a payoff place only when the payoff has its own identity**: a name on signs or maps, a view or facilities worth stating, or another way to reach it. A forest loop with no destination reaches nothing; the route is its own payoff (class `trail/forest-loop`). | Avoids inventing places to satisfy the model |

#### 2.7.1 Ten worked examples

| Example | Places (where) | Routes (way) | Offers (doing) | Key relations |
|---|---|---|---|---|
| Sulphur Mountain | summit (`nature.summit.summit`); top station (`access.transit.station`, part_of the summit); Sanson's Peak (`nature.viewpoint`); summit restaurant (`food.eat`, part_of) | Banff Gondola line (`ride.lift.gondola`); Sulphur Mountain trail (`nature.trail.hike`, 5.5 km one way); summit boardwalk (`nature.trail.nature_walk.boardwalk`) | gondola ticket `on` the line, run_by Pursuit, with hours, `last_down`, price, window | summit `reached_by` gondola and trail (derived); boardwalk starts_at the top station, reaches Sanson's Peak |
| Aiguille du Midi | summit terraces (`nature.summit.summit`); Step into the Void (`culture.heritage.landmark`, part_of) | cable car, two stages (`ride.lift.cable_car`, stage routes part_of the line) via Plan de l'Aiguille | ticket `on` the line, run_by Compagnie du Mont-Blanc, timed-slot window | `reached_by` the cable car only, so the summit's effort is N and its kids chip comes from the offer; altitude 3,842 m is a place hazard |
| Moraine Lake | the lake (`water.body.lake`); Rockpile (`nature.viewpoint`); Sentinel Pass (`nature.viewpoint`); Larch Valley meadows (`nature.landform.valley`); shuttle stop (`access.transit.shuttle_stop`) | Rockpile trail (`walk`, 0.8 km); lakeshore trail (`walk`); Larch Valley-Sentinel Pass (`hike`) | Parks Canada shuttle seat (`access.pass.shuttle_seat`, window R, Rest!); canoe rental `at` the lake (rental, limits, life-jacket sizes) | Rockpile trail reaches Rockpile; Larch Valley route starts_at the shuttle stop, passes the meadows, reaches Sentinel Pass; the seasonal group-of-four rule sits on the route (`official_rule`), never on the lake |
| Tre Cime loop | Rifugio Auronzo, Rifugio Lavaredo, Dreizinnenhütte / Rifugio Locatelli (`stay.mountain.hut`); the north-face viewpoint by Locatelli (`nature.viewpoint`); Tre Cime di Lavaredo (`nature.landform.mountain`) | the loop (`hike`); the Auronzo toll road (`wheels.drive.mountain_pass`) | toll (`access.pass`, on the road); hut beds and meals (lodging and food at each hut) | the loop starts_at Auronzo, passes Lavaredo and Locatelli, reaches the north-face viewpoint; the draw (world) sits on the mountain and the viewpoint; effort on the loop |
| Kicking Horse River | the river (`water.body.river`); put-ins and take-outs (`access.transit.boat_launch`) | upper section (Class II-III) and lower canyon (III-IV) as river routes | rafting offers from three operators, each `on` a section, run_by its operator; variants (Family Float, Class III) | draw on the river; class by month on the route; limits on each variant (the 50 lb minimum is a variant `operator_rule`) |
| Niagara | the cluster (`settlement.cluster`) with part_of children: Horseshoe Falls, American Falls, the Whirlpool, Queen Victoria Park | White Water Walk boardwalk; the Aero Car line (`ride.lift.cable_car`) | cruise, Journey Behind the Falls, zip line to the falls, Aero Car ticket, SkyWheel ticket, each `at` or `on` a child | the cluster page lists every child and offer through part_of (2.5) |
| A beach (Wasaga Beach) | the beach (`water.swim.beach.lake_beach`), part_of Wasaga Beach Provincial Park (`nature.protected`); beach areas' parking lots (`access.park.parking`) | none; `walk_m` from each lot | parking reservation or day-use fee (`access.pass`) | a place with no route: lifeguard season, toilets and change rooms on the place; fill times on the lots |
| A museum (Royal Tyrrell Museum) | the museum (`culture.museum.museum`) | none | entry ticket (hours, last entry, price, window); a dig programme (`culture.tour.guided_tour`, min age R) | the programme's age limit never leaks onto the museum's card; the museum's kids chip comes from the ticket ("all ages") |
| A ski hill (Blue Mountain, Ontario) | the ski area (`snow.ski.ski_area.ski_hill`); summit lodge (part_of) | runs (`snow.ski.ski_run`, piste grade green to double black); chairlifts (`ride.lift.chairlift`) that reach the summit | lift pass (ticket), ski lesson (experience, ages), snow tubing (`snow.play.snow_tube_park` ticket) | the area's FE is the easiest lift-served run (2.6); the lesson's ages give the kids chip |
| A canyon (Johnston Canyon) | the canyon (`nature.landform.canyon`); Lower Falls and Upper Falls (`water.falls.waterfall`, part_of the canyon); the Ink Pots (`water.body.pond_reservoir`) | catwalk trail from the lot (`walk`) that passes Lower Falls and reaches Upper Falls; the Ink Pots extension (`hike`) | guided winter ice walk `on` the catwalk trail | today one record carries the 2.2 km walk on the canyon itself: it splits (2.7.5) |

#### 2.7.2 Which facts live on which layer

The rule: **a fact lives on the layer that causes it.** Walking effort comes from the route, a conveyance rule from the offer, and what you find at the payoff from the place.

| Fact | Place | Route | Offer |
|---|---|---|---|
| point, polygon | R | start, end and geometry | inherits the meeting place |
| view, light, `best_time`, bearing | R (viewpoints, summits, lakes) | N | N |
| facilities | R/A on the place and on access places | via the places it passes | on board (boats, trains) |
| `access_season` | the road, shuttle or lift to it | snow-free window, closures | N |
| operating `season`, `hours`, slots | only for places that open (museum, park gates) | gated routes only | R |
| distance, gain, time, FE, `source_grade`, surface, scrambling, navigation, `bail_out`, `dogs` | N (moved off viewpoint, lake and waterfall profiles: their effort drivers become N, `walk_m` stays) | R | the grade of an operated product (whitewater class, ferrata grade) when it differs from the route's |
| stroller, carrier | at the payoff site (stroller rule in a museum) | the surface along the way | `stroller_on_board` |
| `exposure`, fencing | at the edge (unfenced viewpoint) | on the way | N |
| hazards | at the payoff (sneaker waves) | on the way (bears, river crossings) | weather cancel |
| hard limits, participation, waiver, kit, price, window, operator | N | official rules only (group of four, permit age) | R |
| `age_band` (our advice) | the payoff site ("unfenced, hold hands") | the walk ("From about 6") | the operator's rule, or our advice for a rental |
| relevance draw and class | **here: the place a visitor comes to see** (a lift's top station, a trail's payoff) | only when the route is itself the experience, with `route_is_attraction: true` and a reason (the Tre Cime loop, the Icefields Parkway, a scenic train, the Alta Via) | only when the product draws on its own (Maligne Lake cruise, Athabasca icewalk) |

**Derived for cards and filters** (never typed): a place's `kids_from` and `family_effort` are the easiest of its `reached_by` routes and the offers on them, with the means named ("From 4 · by gondola"). A route's payoff photo and draw come from its primary `reaches` place, shown as "to Sentinel Pass".

#### 2.7.3 Search and cards follow intent

- **The Kind filter's first level is intent**: See (places, except access, food and stay), Walk and ride (routes), Do (offers). Domains and categories sit under each. Kind stays one of the four primary filters (P4); intent is its top row, not a fifth filter.
- **Looking for a view.** A query or Kind = See returns place cards. Each place card carries one line, "2 ways: gondola 8 min · trail 5.5 km, Moderate". Its chips are the easiest way's.
- **Looking for a walk.** Kind = Walk and ride (or Trails) returns route cards: distance, time and effort chips, plus a payoff line ("to Sentinel Pass · world-class view") with the payoff's photo.
- **Looking for something to do.** Kind = Do returns offers grouped by place ("At Lake Louise: canoe rental, guided hike").
- **Deduplication.** When a place and a route that reaches it both match an unscoped search, the place is shown with the route nested ("2 ways"). When Kind is scoped to routes, the route shows on its own.
- **Type-aware filters follow the intent scope** (section 7): See brings walk-from-car, time on site and stroller; Walk and ride brings effort, length, time and climb; Do brings ages from, duration, price and booking.

#### 2.7.4 How pair_with excludes the ways to the place

"Nearby, worth adding" (relevance 3.2) answers *as well as*. Its candidates exclude:
1. every route or lift in the subject's `reached_by` (they are "How to get there", section 6.1 row 7);
2. the places a route subject `reaches` or `passes` (they are its payoff and "On the way");
3. offers `on` those routes or `at` the subject, and `part_of` parents and children (they are "At this place you can also").

Routes that **start at** the subject or its access point stay valid pairs. That is the owner's own example: at Lake Louise, the Lake Agnes tea house walk and Fairview Lookout. Each candidate is shown once: the pair list wins, and the item is removed from "At this place you can also".

#### 2.7.5 Records in today's 214 that conflate layers

Counted on 18 Oct 2026 from the lane sidecars and the relevance classes:

| Conflation | Records | Examples | Split into |
|---|---|---|---|
| A trail record judged as its payoff (relevance class `lake/*`, `viewpoint/*`, `waterfall/*`, `peak/*`, `canyon/*`) | 33 | lago-di-sorapis, cadini-di-misurina-viewpoint, peyto-lake-lookout, sulphur-skyline, laguna de los tres, lower calf creek falls | a route plus a payoff place (often an existing record: deduplicate by name and 500 m); the class and draw move to the place |
| An activity record carrying limits, operator and price as a place | 19 | the three canoes, both cruises, the two rafts and the family float, both hot springs, the Ice Explorer, minitrekking, Funbob | 15 offers (`at` or `on` an existing or new place or route); 1 route (Drava cycle path); 1 event (the elk rut); the 2 Canmore Nordic Centre records become 1 place with offers |
| A lift stored as one record | 6 | banff-gondola, jasper-skytram, lake-louise-gondola, Aiguille du Midi, Montenvers train, Lagazuoi | per lift: a line (route), a ticket offer and the top place, so 18 records |
| A place carrying a walk of 2 km or more | 3 | johnston-canyon (2.2 km), dettifoss (2 km), grand view point (2.9 km) | the place plus the route to it |
| Drives | 5 | | no split: retyped as routes |
| **Total to split** | **61 of 214 (29%)** | | about 100 new records; 148 records only change type |

**Migration plan (step 4 of section 11):**
1. **SP1, proposals (builder, generated).** For each of the 61, write `data/capture/splits/<trip>.json`: the new refs, which fields move to which layer by 2.7.2 (effort and drivers to the route; limits, participation, price and window to the offer; `walk_m`, edge exposure, facilities and light to the place; relevance by its rule), and dedupe candidates by name and 500 m.
2. **SP2, review (researcher).** Confirm each payoff place (point from OSM), each operator, and the variants. Lifts and activities first, since they are the offers that bring prices and windows to the timeline. Then the 33 trail payoffs, planned trips first (10.5). Then the 3 places.
3. **SP3, apply (builder).** Old refs become aliases of the new primary ref (the route for trails, the offer for activities, the line for lifts), so trip items and sidecars keep resolving. Sidecars are rewritten by `migrate`, never by hand. `kind-map.json` records each split with a reason (it already supports `split`).
4. **SP4, re-derive.** Re-derive relevance and recount anchors: some of the 3a.10 "anchor inflation" (53 of 209) comes from routes judged with their payoff's draw.

## 3. The capture contract

### 3.1 Conventions

| Mark | Meaning |
|---|---|
| **R** | required for Usable. Missing shows "Not checked yet" at its slot. |
| **R?** | required when its trigger holds (stated in the row) |
| **A** | applicable; counts for Complete; shown when known; missing A fields of a section collapse into one line |
| **N** | never asked, shown or counted |

| Source code | Order of preference | Trusted for |
|---|---|---|
| **O** operator | the operator's own product, rates, terms and waiver pages | limits, hours, slots, prices, windows, what is included |
| **F** official | land manager, agency, municipality, government open data (Parks Canada, NPS, Ontario Parks, Provincia di Bolzano, swisstopo) | rules, seasons, closures, permits, grades, trail stats |
| **T** tourism board | official regional tourism sites | seasons, events, hours when the operator has no page |
| **D** open data | Wikidata (identity), OSM (points, geometry, `opening_hours` as a hint only), Commons (photos) | identity, points, geometry, photos |
| **C** community | dated trip reports, forum posts (two or more for a pattern) | shade, signal, crowds, fill times, stroller reality |
| **X** computed | `core/src/sun`, routing (ORS), derive | light, sun loss, drive times, FE |

| Display code | Meaning (principles) |
|---|---|
| **Rest** | in the first view of the place page or day row (P2, P3) |
| **Rest!** | the P2 safety exception: visible at rest whatever the chip cap (hard limits, closures, permits and slots that must be booked, main hazards) |
| **Card** | also on list cards and list rows (P8 allowlist) |
| **Detail** | one click away, in its section (P2, P6) |
| **Filter** | a facet in type-aware filters (section 7) |

Every value is a `Val` (suitability 1.1): `{v, state, basis, src, read, quote, note, tried, on, applies_to, conflicts}`, with the states `value`, `no_limit`, `none_stated`, `searched_none`, `not_applicable`, `gap`. Gap wording below is what the UI says for `searched_none`; for `gap` it always says "Not checked yet".

### 3.2 The base contract (every place, route and offer, before deltas)

| Group | Property | Format | Base mark | Sources | Honest-gap wording | UI component (section) | Display |
|---|---|---|---|---|---|---|---|
| Identity | `name` | as signed or as the operator writes it | R | F, O, D | none (a record needs a name) | Cover | Rest, Card |
| Identity | `names` | `{lang: name}` | A | F, T, D | "Local name not recorded" | Cover subtitle | Detail |
| Identity | `type` | type id (2.2) | R | ours | none | Cover kicker, Badge | Rest, Card, Filter |
| Identity | `point` + `point_source` + `point_checked` | `[lon, lat]`, 5 decimals; source as K 5 | R (routes: start and end via `starts_at`) | D (OSM), F, own pin | "Location approximate" honesty chip | PlaceMap, Directions | Rest |
| Identity | `area_id` | smallest containing area | R | D, ours | none | Breadcrumbs | Rest, Card |
| Identity | `wikidata` | QID or `searched_none` | R | D | "No Wikidata entry" (Detail only) | Footer | Detail |
| Identity | `osm_ref` | `node/`, `way/`, `relation/` | A | D | "Not mapped in OSM" | Links (OSM tab) | Detail |
| Identity | `summary` | our words, 1-3 sentences | R | ours, from F, O | "No summary yet" | Cover | Rest, Card |
| When | `season` (operating) | rows `{from, to, status, applies_to}` | R? when the place or offer operates (hours, staff, a lift) | O, F, T | "Season not published; ask the operator (searched <date>)" | SeasonStrip (When to go) | Rest, Card, Filter |
| When | `access_season` | rows with `via` | R for natural places reached by road, lift, shuttle or boat | F, O | "Access season not published" | SeasonStrip | Rest! when closed in the trip window |
| When | `best_window` | rows `{from, to, why: foliage, flow, larch, bloom, wildlife, snow, water_temp}` | A | F, T, C | "No best weeks recorded" | When to go | Rest |
| When | `best_time` | `[{slot: sunrise, golden_am, morning, midday, afternoon, golden_pm, sunset, night; why: light, crowds, wildlife, heat, tide; months?}]` | A | X (light), C (crowds), F (wildlife) | "No best time of day recorded" | Glance, timeline entry meta | Rest |
| When | `hours` | K 9 format: tz, periods, closed_days, breaks, closures, `last_entry`, `last_up`, `last_down` | R? when it operates; `always_open` allowed | O, F, T (D as a hint only) | "Hours not published; check before you go (searched <date>)" | HoursTable (When to go), timeline | Rest (today's hours), Detail (table) |
| When | time on site, route time, child time | `on_site_min` (place), `adult_time_min` + `child_time_min` (route), `duration_min` + `activity_min` (offer) | R (one of them per record) | F, O, X (Naismith, marked estimate) | "Time not published; our estimate" or "Not checked yet" | Glance, timeline duration | Rest, Card (band), Filter |
| Access | access points | `starts_at`, `parks_for`, `serves` relations, with `walk_m` and walk minutes | R? when you cannot drive to the door | F, D, C | "No parking or stop recorded" | AccessCard (Trailhead and parking) | Rest |
| Access | `walk_m` | metres from the access point | R? as above | F, X | "Walk from the car not measured" | Glance | Rest |
| Access | transit | `serves` from a stop, `timetable` link | A | F, O | "No public transport found (searched <date>)" | AccessCard | Detail |
| Access | `access_cost` | relevance typed list; offers for permits and slots | R | F, O | "No permit or booking needed" is a value (`no_limit`) | Booking callout, WindowChip | Rest! when a booking is required |
| Access | price | on offers: `[{amount, currency, per, age_from, age_to, applies_to, read}]`; places with a fee: an `access` or `ticket` offer | R? when anything is sold | O, F | "Price not published (searched <date>)" | PriceRows | Rest (from-price), Card (band), Filter |
| Access | `window` | `{rule: fixed_date, rolling, monthly_release, lottery, same_day, anytime, on_arrival; days_before, opens_time, tz; sellout: {kind, lead}; fallback}` | R? on access and experience offers | O, F | "Booking window not published; book as early as possible" | WindowChip, timeline book-by | Rest! |
| Suitability | the S block and extensions | as `suitability.ts`, marks per node from the applicability rows | per profile | O (limits), F, C (soft fields), ours (age band) | per suitability-display.md | SuitChips, WhoItSuits | Rest (3 chips), Card (2), Detail, Filter |
| Relevance | `class_key`, `draw`, `standing`, `distinction`, `easy_payoff`, `weather`, `why`, `signals` | relevance/1 | R on places, routes and experience offers with their own class; N on access, amenity, food, stay | ours, D (signals) | none (judged) | RelevanceBadge, Why line | Rest, Card (badge) |
| Relevance | `pairs_with` | `[{ref, reason, src?}]` | A | ours, F, C | none (derived pairs fill in) | Nearby, worth adding | Rest (up to 3) |
| Facilities | `toilets` | `[start, route, payoff, none, on_board, station]` | A | F, D, C | "Toilets not recorded" | Facilities | Detail |
| Facilities | `water` | `potable, treat, none` | A | F, C | "Drinking water not recorded" | Facilities | Detail |
| Facilities | `food` | `hut, cafe, none` (+ `passes` relations to eateries) | A | F, O, D | "Food not recorded" | Facilities | Detail |
| Facilities | `shade` | `full, partial, none` | A | C, F | "Shade not recorded" | Facilities | Detail |
| Facilities | `change_rooms`, `showers` (new) | bool | N (A for swim, beach, thermal, pools, splash pad) | F, O | "Change rooms not recorded" | Facilities | Detail |
| Facilities | `picnic`, `baby_change` (new) | bool | A | F, D, C | "Not recorded" | Facilities | Detail |
| Facilities | `signal` | `good, patchy, none` | A | C | "Phone signal not recorded" | Facilities | Detail |
| Safety | `hazards` | typed list with season | A (R on routes and water) | F, O, C | "No hazards published (searched <date>)" | WarningLine | Rest! (main hazard) |
| Safety | `exposure` | level, fenced | A | F, C | "Edges not described" | WarningLine, Kind block | Rest! when unfenced and significant |
| Safety | closures | `hours.closures`, `condition_report` rows, `conditions` link | R? when the manager publishes a status page | F (read within 7 days) | "No closure page found" | WarningLine, Links | Rest! |
| Safety | wildlife rules | `ext.wildlife.min_distance_m`, `stay_in_vehicle`, hazard `wildlife` | R? in bear, elk or bison areas | F | none | WarningLine | Rest! |
| Links | the type's checklist (3.4) | `entity_link {kind, url, state: filled, searched_none, found_in_search, query, on}` | official R; the rest A | O, F, then link-only platforms | "<kind>: none found (checked <date>)" | LinksTabs | Detail (first tab at rest) |
| Media | photos | `{file, licence, author, attribution, source_url, width ≥ 1600, height}` | A (N for access, amenity) | D (Commons), own | "No licensed photo yet" | Gallery, Credits | Rest, Card |
| Nearby | relations of 2.5 | refs | `part_of` R? when it is part of something; others A | ours, F | none | Around ("At this place you can also"), Part of | Rest |
| Sources | `src` on every value; source rows `{id, url, title, publisher, kind, read, method, run}` | | R | | "No source recorded" (never allowed for a value) | Provenance popover, Facts and sources | Detail (one step away, P6) |

### 3.3 Record and offer-class deltas

| Record or class | R adds | A adds | N (removes from base) |
|---|---|---|---|
| **route** | geometry or `searched_none`, `distance_km`, `gain_m`, `shape`, `effort.source_grade` (where a scale exists), `adult_time_min`, `starts_at`, `hazards` | `loss_m`, high point, `passes` places, `child_time_min`, `navigation`, `bail_out`, GPX licence | `on_site_min`, `hours` (unless gated) |
| **offer: experience** | `run_by`, `at`, `season`, `hours` or slots, `duration_min`, `activity_min`, price, `window`, `book_url`, limits (per variant), `participation.weather_cancel` | `variants`, `participation.*` per profile, included, cancellation | point (it inherits the meeting place), `wikidata` (A only when the product has one) |
| **offer: rental** | `run_by`, `at`, `season`, `hours`, price, limits, deposit or ID rule | `variants`, life jackets and child sizes | `window` unless reservable |
| **offer: ticket** | price, `hours` (inherits the place's when the same), `window` when timed | concessions, passes that cover it (`covered_by`) | relevance (inherits the place's) |
| **offer: access** | `window`, price, `rule` (what it unlocks), channel (online only, gate), refund | sell-out fallback | suitability, relevance, media |
| **offer: lodging** | check-in and check-out, price band, cancellation, occupancy | `min_stay` | relevance, effort |
| **operator** | name, URL | terms URL, waiver URL, phone, licence | everything else |

### 3.4 One link vocabulary

`official` (the land manager's or operator's own page), `hours_rates`, `booking`, `conditions`, `status`, `timetable`, `terms`, `waiver`, `safety`, `accessibility`, `menu`, `tourism_board`, `osm`, `wikidata`, `wikipedia`, `wikivoyage`, `commons`, `webcam`, `map_sheet`, `gpx_download`, `track_source`, `trip_report`, `video`, and the link-only platforms `alltrails`, `komoot`, `gaia`, `outdooractive`, `wikiloc`, `trailforks`, `reseller`. `navigation` is generated at render time and never stored. `google-maps` leaves `LINK_KIND`.

### 3.5 Per-type deltas (the contract by category)

Each row lists only what differs from 3.2 and 3.3. Suitability marks come from the profile in 2.2 and are not repeated. The link list is the type's checklist; `official` is always R. "Slot 3" is the at-rest deciding chip (applicability 5.1).

| Category | R adds | A adds | N | Links (checklist) | First sources | Slot 3 |
|---|---|---|---|---|---|---|
| `nature.trail`, `nature.trek` | `shape`, `effort.source_grade` + `local_system`, `starts_at`, trek: `part_of` on stages, `ends_at` hut, hut booking window | `passes` huts and lakes, snow-free window, `navigation`, `water_crossings`, `dogs`, turnaround points | `hours` | official, conditions, osm, track_source, gpx_download, alltrails, komoot, gaia, outdooractive, wikiloc, trip_report, webcam, map_sheet, video, booking (R? permit or shuttle) | F trail page and conditions, F open data GPX, T, D OSM, C dated reports | stroller or carrier |
| `nature.summit`, `nature.viewpoint` | reached by at least one route, road or lift (`reached_by` not empty, or a road `access_point`); `walk_m`; `best_time` R (light from X) | bearing, `exposure`, crowds, photo spot | `hours` unless gated | official, conditions, osm, wikidata, commons, webcam, trip_report | F, D, X | fencing |
| `nature.landform` | `best_window` R where it changes (glacier view, geothermal) | as viewpoint | `hours` | official, osm, wikidata, wikipedia, commons | F, D | hazard or fencing |
| `nature.protected`, `nature.garden` | `access_cost` (pass, permit, timed entry), park `hours` when gated, `toilets` R | visitor centre (`part_of`), trail list (`part_of` routes) | effort | official, conditions, booking, osm, wikidata, wikipedia, commons, map_sheet | F | pass needed |
| `nature.wildlife` | `best_window`, `best_time` R, wildlife rules R | sightings likelihood | `hours` for spots | official, conditions, safety | F, O | stay in vehicle |
| `water.body`, `water.falls` | `access_season`, `best_time` (lake) or `best_window` (falls: flow) R, `ext.water.swimming` R | shore walk (`passes`), boat and canoe offers (`at`), water temperature by month, facilities | `hours` unless gated | official, conditions, booking, timetable, osm, wikidata, wikipedia, commons, webcam, trip_report, video | F, O (shuttle), T, D, X, C | stroller (lake), fencing (falls) |
| `water.swim`, `water.thermal` | `ext.water.swimming`, `water_safety.lifeguard`, `water_safety.entry`, `toilets`, `change_rooms`, `hours` + `last_entry` (pools, thermal), water quality status link | water temperature, shade, `showers`, lockers, dogs | effort | official, hours_rates, booking, conditions, status, osm, commons, webcam | O, F (health agency for water quality), T, D, C | lifeguard; water temperature |
| `water.paddle`, `water.river`, `water.boat`, `water.motor`, `water.under`, `water.surf` (offers) | class of 3.3 R; `water_safety.lifejacket` + `child_sizes_from_kg`, `swim_ability`; river: `ext.paddle.class_at_level`; motor: `participation.driver` | `ext.paddle.*`, `ext.boat.*`, sea state, seasick risk | `toilets`, `shade` (A on boats) | official, booking, hours_rates, terms, waiver, safety, conditions (R? weather dependent), status, reseller | O, F (licensing), T, phone to operator | kit or PFD sizes; craft capacity; driver rule |
| `air.*` | limits R on every variant (age, height, weight both ends), `participation.weather_cancel` R | `ext.zip.*`, `ext.jump.*`, `ext.flight.weight_by_slot` | effort | official, booking, terms, waiver, safety, conditions | O | braking; weight by slot |
| `mountain.*` | grade R, `participation.guide`, `kit_provided`, `min_shoe_eu` (glacier), `ext.ferrata.*` | approach and descent, bail-out | `toilets` | official, booking, terms, waiver, conditions, map_sheet, trip_report | O, F, C (route reports, dated) | guide required |
| `snow.*` | `season` (snow), piste grade R (ski), ski school age, lift pass offer | magic carpet, rentals (`at`) | `shade` | official, hours_rates, booking, status, webcam, map_sheet | O, T | magic carpet; solo age |
| `wheels.bike` | grade R, traffic, return option | bike hire sizes, e-bike rule | `hours` (paths) | official, conditions, map_sheet, trailforks, gpx_download | F, O | traffic |
| `wheels.drive` | `access_season`, vehicle limits, road surface, `drive_min` | fuel gap, winding, pullouts (`passes`) | facilities | official, conditions, status, map_sheet | F (road agency), X | road surface |
| `ride.*` | route `reaches` the top station; ticket offer `on` the line with `hours`, `last_up`/`last_down` R, `participation.weather_cancel` | cabin, queue note, seat side | effort | official, hours_rates, booking, status, timetable, webcam | O, T, pass issuers | stroller on board |
| `animals.*` | `hours` + `last_entry` (zoo), limits per ride offer | feeding times as slots | effort (A for farm walks) | official, hours_rates, booking, accessibility | O | stroller |
| `culture.*` | `hours` + `last_entry` + `closed_days` R, ticket offer, `visit_mode`, indoor or rainy-day | dress code, photo rules, languages, accessibility detail | effort | official, hours_rates, booking, accessibility, tourism_board, osm, wikidata, wikipedia, commons | O, T, F (heritage bodies), D | stroller rule |
| `play.*` | `hours` (or `always_open`), `age_band` R, `toilets` R, surface under equipment (playgrounds), ticket or entry offer (amusement), ride height limits per variant | `shade`, `picnic`, `baby_change`, fencing, splash pad season | effort | official, hours_rates, booking, osm, commons | F (municipality), O, D, C | age range ("Ages 2-12"); tallest limit |
| `play.farm` | operating `season` per crop (PYO), `hours`, price per weight or entry | weather closure rule, cash only | effort | official, hours_rates | O (farm site, social page only as `official`), T | in season now |
| `food.*` | `hours` with kitchen close R, `closed_days`, cost band, reservation | kids menu, high chairs, dietary, payment | effort, relevance | official, menu, booking, osm | O, T, D (hint) | none |
| `stay.*` | check-in and check-out, season, cost band, parking, rooms for families | campsite pitches, hookups, quiet hours | effort, relevance | official, booking, terms, accessibility | O, F (park campgrounds) | wheelchair |
| `settlement` | elevation, access, why stay here (bases) | groceries, last transport, tourist tax, sun loss | effort | official, tourism_board, timetable, wikidata, wikipedia, wikivoyage | F, T, D, X | none |
| `access.*` | point R, `parks_for`/`serves` R, fee (reservation offer), `fills_by` (SN ok), gate hours | capacity, RV limits, accessible spaces, EV, overflow | relevance, media, suitability (except `accessible_parking`, `walk_m`) | official, booking (R? reserved), status, webcam | F, D, C (two dated reports for fill times) | none |

### 3.6 R/A/N matrix of the non-suitability properties

Columns are domains or category groups; the full matrix per type is in the generated files. `R?` triggers are in 3.2.

| Property | trail/trek | summit/view | landform | park/garden | wildlife | water body/falls | swim/thermal | water offers | air | mountain | snow | wheels | ride | animals | culture | play | food | stay | settlement | access |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| point + source | R | R | R | R | R | R | R | N (meeting place) | N | R? | R | R | R | R | R | R | R | R | R | R |
| wikidata | R | R | R | R | A | R | A | N | N | A | A | A | A | A | R | A | N | N | R | N |
| season (operating) | N | N | N | R? | R? | N | R | R | R | R | R | R? | R | R | R | R | R | R | N | R? |
| access_season | R | R | R | R | R | R | R? | A | A | R | R | R | A | N | N | N | N | A | N | R? |
| best_window | A | A | R? | A | R | R (falls) | A | A | N | A | A | A | A | N | N | N | N | N | A | N |
| best_time | A | R | A | A | R | R (lake) | A | A | A | A | A | A | A | A | A | N | N | N | A | N |
| hours | N | R? | N | R? | R? | R? | R | R | R | R | R | R? | R | R | R | R | R | R | N | R? |
| time (on site, route, offer) | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R | A | N | A | N |
| access points | R | R? | R? | R | R? | R | R | R | R | R | R | R | R | A | A | A | A | A | N | N |
| price / fee | R? | R? | N | R? | R? | R? | R | R | R | R | R | R? | R | R | R | R | A | R | N | R? |
| window | R? | R? | N | R? | R? | R? | R? | R | R | R | R | R? | R? | R? | R? | R? | A | A | N | R? |
| toilets | A | A | N | R | A | A | R | A | A | A | A | A | A | A | A | R | A | A | N | A |
| change rooms, showers | N | N | N | N | N | N | R | A | N | N | A | N | N | N | N | A | N | A | N | N |
| hazards | R | A | A | A | R | A | R | R | A | R | A | A | A | A | N | A | N | N | N | N |
| closures | R? | R? | R? | R? | R? | R? | A | A | A | R? | R? | R? | R? | A | A | A | A | N | N | R? |
| relevance | R | R | R | R | R | R | R | R? | R? | R? | R | R | R | R | R | R | N | N | R | N |
| photo | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | N |
| part_of / passes / reaches | R? | R? | A | A | A | A | A | R (at or on) | R | R | R | A | R? | A | A | A | A | A | A | R (parks_for) |

## 4. What the owner's examples look like under the contract

| Example | Records and types | Notes |
|---|---|---|
| Rafting on the Kicking Horse | route `water.body.river` (section, class by month); offer `water.river.rafting` by `operator/wild-water` with variants Family Float (`float` profile overrides) and Class III-IV | the 50 lb minimum is a variant limit, `operator_rule` |
| Tubing at Elora | place `nature.protected.conservation_area`; offer `water.river.tubing` class rental, operated by GRCA, season 26 Jun to 7 Sep (2026 pattern) | owner Q10 still holds |
| A boat tour from a dock | place `access.transit.dock` (starts_at); offer `water.boat.boat_tour` offered_at the lake | the dock carries parking |
| A zip line in an adventure park | place `play.adventure.adventure_park`; offers `air.zip.zipline.course` and `air.zip.zipline.kids_course`, `play.adventure.ropes_course` | one operator, three offers |
| A gondola | route `ride.lift.gondola` from the valley station (`starts_at`) that `reaches` the top station; a ticket offer `on` it | `last_down` is Rest! on the offer |
| Kayak rental | offer `water.paddle.kayak.rental` offered_at the lake | life jacket child sizes R |
| Fairview Lookout | place `nature.viewpoint.viewpoint`, reached by the route `nature.trail.hike` "Fairview Lookout trail" (`reaches`) | the summit carries the view and light; the route carries effort |
| Alta Via 1 | route `nature.trek.hut_trek.alta_via`; 10 routes `nature.trek.trek_stage.hut_stage` `part_of` it, each `ends_at` a `stay.mountain.hut` with a lodging offer | hut booking windows are Rest! on the stage |

## 5. One source of truth

### 5.1 Files

| File | Authored or generated | Holds |
|---|---|---|
| `core/src/schema/capture/properties.ts` | authored (schema change) | every property: key, group, Zod value type ref, unit, label, gap wording, section, display level, filter role (section 7) |
| `data/vocab/types.json` | **authored (the one edit)** | the tree: `id`, `parent`, `label`, `aliases`, `records`, `offer_class`, `profile`, `effort.scales`, `relevance_class`, `marks` (overrides `{property: R, R?, A, N}`), `links` (adds or removes), `sources` (order override), `display` (`slot3`, glance order) |
| `data/schema/difficulty-map.json` | authored | grade systems to FE |
| `data/schema/capture/<domain>.json` | generated | every node resolved: its full mark table, the suitability row, sections, links, sources, filters, the D/U/C checks |
| `data/schema/suitability-applicability.json` | generated (was authored) | unchanged shape, so `suitability.ts` keeps working |
| `docs/v2/research/capture/<domain>.md` | generated | the checklist a person reads, one table per type |
| `web/lib/public/contract.ts` | generated | the section map and the facet list the adapter uses (P9: behind the adapter, at build time) |

### 5.2 The CLI

```
node core/bin/capture.ts fields --type water.river.tubing        # the exact checklist: R, R?, A per group, sources in order, gap wording, link checklist
node core/bin/capture.ts fields --kind lake                       # alias lookup: old kind and subkind names resolve through types.json aliases
node core/bin/capture.ts fields --ref offer/elora-gorge-tubing    # the record's type, plus what is still missing on it (state per R field)
node core/bin/capture.ts fields --type ... --format json          # for crawlers and the MCP `profile://type/<id>` resource
node core/bin/capture.ts explain air.zip.zipline.kids_course      # where each mark comes from (node or ancestor)
node core/bin/capture.ts build [--check]                          # regenerate 5.1 outputs; --check fails on drift (runs in tools/check-all.sh)
node core/bin/capture.ts gaps --trip dolomites-2027 [--level usable]   # per record, missing R fields; feeds the research pass
node core/bin/capture.ts run --check <run.json>                   # validate a crawl run record (9.6)
```

`suitability.ts fields` becomes a thin call to `capture.ts fields` restricted to the suitability group.

### 5.3 Who reads the resolved contract

| Reader | Reads | Behaviour |
|---|---|---|
| Researchers and crawlers | `capture.ts fields --format json` | collect exactly the R and A properties; never an N property (`W_CAP_NA_FIELD`) |
| Validator (`core/src/validate/capture.ts`, new) | resolved marks | one completeness engine: Draft (identity R), Usable (all R answered), `usable_partial` (soft `none_stated` on an R limit, as CF), Complete (A answered, links resolved, photo, fresh, reviewed). Replaces K check lists and `suit_level` (both become views). |
| Public adapter and UI | `web/lib/public/contract.ts` | renders sections, glance slots and facets by type |
| MCP (`propose`, `research_brief`) | the same JSON | returns missing fields per record |

## 6. UI rendering from the contract (S1 section mapping)

### 6.1 The fixed sections

Every place, route and offer page uses these 14 sections in this order. A section with no R or A property for the type is not drawn; a section with R or A properties and no values shows its gap markers (owner rule, 18 Oct; applicability PC2).

| # | Section | Component | Properties (groups) | Display |
|---|---|---|---|---|
| 1 | Cover | Cover | name, type, area, summary, photo, relevance badge | Rest |
| 2 | At a glance | GlanceStrip | 6 slots: the type's `display.glance` order, else the first six R properties with a short renderer | Rest |
| 3 | Warnings | WarningLine | Rest! properties: closures, required bookings, main hazard, wildlife rules, out-of-season access | Rest |
| 4 | Who it suits | SuitChips, WhoItSuits | suitability limits, age band, stroller, carrier, wheelchair (suitability-display.md) | Rest (chips), Detail |
| 5 | The route or the activity | RouteSection (routes), KindBlock (offers, extensions) | route stats and profile; extension fields under the kind heading | Rest (stats), Detail |
| 6 | Options and prices | OfferList | variants and offers with limits, time, price, window | Rest (from-price, limits chip), Detail |
| 7 | How to get there | WaysList, AccessCard, Directions | places: `reached_by` routes, lifts and roads with their effort and time ("2 ways"); access points, `walk_m`, transit, parking fee and fill time. Routes: `starts_at`, `reaches` (payoff), `passes` (on the way) | Rest |
| 8 | When to go | SeasonStrip, HoursTable, BestTime | season, access season, best window, best time, hours | Rest (strip, today), Detail (table) |
| 9 | Facilities | FactRows | toilets, water, food, shade, change rooms, picnic, baby change, signal | Detail (collapsed with values inline) |
| 10 | At this place you can also | AroundList | 2.5 query (excludes the ways to the place, 2.7.4) | Rest (6 rows) |
| 11 | Nearby, worth adding | PairList | `pairs_with` + derived pair_with | Rest (3) |
| 12 | Photos | Gallery, Credits | media | Rest |
| 13 | Links | LinksTabs | link checklist with states | Detail (first tab at rest) |
| 14 | Facts and sources | SourceList, provenance Popover | every value's provenance | Detail |

**Renderers are chosen by value type, never by type id**: range (`[min, max]` with unit), enum (label from the registry), bool, duration, season rows, hours, price list, window, limit (rule or advice chip), grade (FE name plus original grade), relation list, link list. A new value type needs one renderer and is a schema change. A new type needs nothing.

### 6.2 What replaces the label-matched glance

`glanceFor()` in `web/components/places/model.ts` matches free-text facts by label ("Fee", "Lot"). It is replaced by the contract's glance order per type, reading typed values. During migration the adapter maps legacy facts to properties once (`Fee` to price, `Lot` to access point, `Best time of day` to `best_time`), with basis `community` or the fact's own source, so nothing visible is lost.

### 6.3 Other surfaces

| Surface | Reads from the contract |
|---|---|
| Place card (lists, globe card 3.6) | the Card properties: name, type label, area, season band, kids chip, effort name, relevance badge, photo, and the facet bands of 7.3 (P8 allowlist) |
| Day row and timeline entry (L3c) | time, duration, the three suitability chips, Rest! warnings, window book-by, hours for the day |
| Globe selection card | summary, three facts from the glance order, `part_of` parent ("At Niagara Falls") |
| Exports (per item) | every property marked Detail or Rest, with sources (P8) |

## 7. Type-aware filters

### 7.1 Rules

1. **Unscoped lists keep the four primary filters**: Places: Country, Kind, Season, Kids; Trips: Where, When, Length, Kids (P4 decision). Kind is the type tree, shown as domains first with counts, then categories.
2. **Narrowing Kind to a domain or category adds that scope's facets** under "More filters", and promotes up to two of them into the bar beside the four (the bar never holds more than six). The scope's facets come from properties with `filter` set in the registry, which are R or A for most types in scope.
3. **A facet appears only when it can split the results**: at least 60% of the records in scope answer it, and at least two values occur. Otherwise it is hidden, and the count line says why ("Duration hidden: not known for most results"). This keeps gaps from producing empty filters (P1, P4).
4. **A gap never passes a positive filter** (suitability 6.3). The result count names how many were left out for missing data.
5. **One Clear all**, chips for every active facet, results update as you choose (P4). Clearing Kind removes the scope's facets and keeps the four primary filters.
6. **Facets read only derived bands** (7.3) in list rows, never raw values (P8). URL state is `?k=<type id>&f.<facet>=<value>` (P9: a server answers the same query later).

### 7.2 Facets by scope

| Scope (Kind narrowed to) | Promoted (bar) | More filters |
|---|---|---|
| Trails and treks (`nature.trail`, `nature.trek`) | Effort, Length | Time, Climb, Shape (loop, out and back, point to point), Stroller, Dogs, Multi-day |
| Views and summits | Walk from the car | Effort to reach, Best time of day, Stroller, Fenced |
| Water places (`water.body`, `water.falls`, `water.swim`) | Swimming, Walk from the car | Lifeguard, Water temperature band, Toilets, Change rooms, Boats here |
| Activities (any O domain: water offers, air, mountain, snow tours, animals.ride) | Ages from, Duration | Effort (where it has one), Price band, Booking needed, Guided or self-guided, Weather dependent, Indoor |
| Sightseeing (`culture.*`, `animals.see`) | Time on site, Price band | Indoor or rainy-day, Booking needed, Stroller, Step-free, Open on (weekday) |
| Family play (`play.*`) | Ages, Price band | Indoor, Toilets, Shade, Fenced, Season |
| Snow (`snow.*`) | Effort (piste), Ages from | Lessons, Magic carpet, Rentals, Price band |
| Food, stays | (kept as today: price tier, reservation, kids menu; stays: kind, family rooms) | |

The table is not code: each facet is a registry property with `filter: {scope: [...], control: range | enum | bool, bands, label}`. Adding a facet to a scope is one registry edit; a new type joins its parent's scope automatically.

### 7.3 Facet bands carried in list rows (P8 allowlist extension)

| Key | Values | From |
|---|---|---|
| `effort` | FE name (exists: the effort chip) | derive |
| `kids_from` | integer (exists) | derive |
| `time_band` | `<1h`, `1-2h`, `2-4h`, `half-day`, `full-day`, `multi-day` | time property of the type |
| `price_band` | `free`, `$`, `$$`, `$$$` (per person, local currency thresholds in data) | offers |
| `booking` | `none`, `recommended`, `required` | windows and access cost |
| `flags` | up to 6 short ids from bool facets: `swim`, `lifeguard`, `indoor`, `stroller`, `step_free`, `dogs`, `guided`, `toilets`, `change_rooms`, `fenced` | facilities and suitability |

These are labels and bands, not facts with sources, so they stay inside the P8 rule "only what a card, a column or a filter needs". The pinned-keys test adds them by name.

## 8. Extension procedure (a new type is data)

### 8.1 Checklist

1. **Find the parent.** `capture.ts explain <nearest node>`. If no category fits, add the category first (same file).
2. **Add one entry to `data/vocab/types.json`** with `id`, `parent`, `label`, `aliases` (common names, old ids), `records`.
3. **Override only what differs**: `marks` for properties whose mark changes, `effort.scales` if it has its own grade system, `display.slot3` or `display.glance` if the deciding chip or glance order differs, `links` to add a link kind, `relevance_class` if a new class is needed (then add the class to `relevance-classes.json`).
4. **New grade system?** Add one block to `difficulty-map.json` and append its id to `GRADE_SYSTEM`.
5. **Run `capture.ts build`**, review the generated diff (resolved marks, the rendered checklist), and run `bash tools/check-all.sh`.
6. **Only if the type needs a fact no property can hold**, it is a schema change: add the property to `properties.ts` and its Zod field, which goes through the planner and the design reviewer. Everything else, including UI and filters, follows from steps 2-5.

### 8.2 Three worked examples

**Jet ski under water activities.** Files touched: `data/vocab/types.json` only (the `water.motor` category and `participation.driver` property exist from step 1 of section 10).

```jsonc
{ "id": "water.motor.jet_ski", "parent": "water.motor", "label": "Jet ski", "aliases": ["pwc", "sea-doo", "waverunner"],
  "records": ["offer"], "offer_class": "experience",
  "marks": { "participation.driver": "R", "water_safety.water_temp_c": "A" },
  "display": { "slot3": "participation.driver" } }
```
It inherits from `water.motor`: the `motor_water` profile (limits R per variant, life jacket R, no effort, time on the effort slot), the offer contract, the link list (official, booking, terms, waiver, conditions), the relevance class `water/motor`, and the Activities facets (Ages from, Duration, Price band, Booking needed). The page shows "Driver 16+ with a boat card · passengers 8+" as slot 3 with no new code.

**Alta Via stage under multi-day treks.** Files touched: `data/vocab/types.json` only.

```jsonc
{ "id": "nature.trek.trek_stage.hut_stage", "parent": "nature.trek.trek_stage", "label": "Hut-to-hut stage", "aliases": ["alta via stage", "tappa"],
  "records": ["route"],
  "marks": { "part_of": "R", "ends_at": "R", "window": "R?" },
  "links": { "add": ["booking"] } }
```
It inherits the hike profile, the SAC and CAI scales, trail links and the trail facets. The R `ends_at` (a `stay.mountain.hut`) brings the hut's lodging offer and booking window to the stage, where the warning line shows it at rest. `part_of` gives the trek page its list of stages. The trek itself (`nature.trek.hut_trek.alta_via`) needs no entry beyond its own row in the seed tree.

**Kids' zip course under zip lines.** Files touched: `data/vocab/types.json` only.

```jsonc
{ "id": "air.zip.zipline.kids_course", "parent": "air.zip.zipline", "label": "Kids' zip course", "aliases": ["junior zip", "mini zip"],
  "records": ["offer"],
  "marks": { "adult_required": "R", "age_band": "R", "max_age": "R", "max_height_cm": "A", "ext.zip.between_lines": "A" },
  "display": { "slot3": "adult_required" } }
```
It inherits the zipline profile (height and weight limits R, braking, weather cancel) and the relevance class. Slot 3 changes from braking to "Adult on the ground". It appears under Activities and Family play filters because both scopes include `air.zip` through the registry's facet scopes.

## 9. Crawler and scraper rules

### 9.1 Allowed sources

| Tier | Examples | Method allowed |
|---|---|---|
| Open data APIs | Wikidata (CC0), OSM via Overpass (ODbL, credited, separable layer), Wikimedia Commons API (per-file licence), NPS API (public domain), Parks Canada open data (OGL-Canada), swisstopo OGD, Provincia di Bolzano open data, geoBoundaries | `api`, cached |
| Official and agency pages | land managers, municipalities, road agencies, health agencies (water quality) | `crawl` when robots.txt and terms allow automated access; else `read` |
| Operator pages | the operator's product, rates, terms, waiver pages | `read` by default (one page at a time by a research agent); `crawl` only for a host whose terms allow it, recorded in the registry |
| Tourism boards | official regional sites | `read`, `crawl` when allowed |
| Community | dated trip reports, forums | `read` only, facts in our words, two reports for a pattern |

### 9.2 Never

- **Google** (Maps, Places, Search result pages, Street View, Google-derived pins or blog widgets), **Apple and Bing maps**: not as a source of any stored value. A coordinate of unknown origin is treated as Google-derived.
- **AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Trailforks, FATMAP**: link only (`found_in_search` with the search date). Never fetched by a crawler, never a source of stats, reviews or photos.
- **Tripadvisor, Yelp, Booking.com, Expedia, Airbnb**: link only; never ratings, review text, counts, ranks or prices.
- **Resellers** (GetYourGuide, Viator, Civitatis): link only; a limit they state is kept as a conflict, never as the chosen value.
- **Social media scraping** (Instagram, Facebook, TikTok). The owner's own captures stay as capture sources; a business's own social page may be read by hand as its `official` page.
- **Paywalled guidebooks**, and any personal data.

**P8 in reverse.** We ask others not to copy our catalogue in bulk, so we do not copy theirs. A site's terms that forbid automated access are obeyed even where a technical block is absent. The registry records each host's `terms_note` and a new `automated: allowed | forbidden | unknown`; `unknown` is treated as forbidden for crawling and allowed for a single-page read.

### 9.3 Rate limits and politeness

- One request at a time per host; at least 1 s between requests (Wikidata and Nominatim: 1 per second; Overpass: sequential with a cache; Commons: one runner, never parallel agents, a couple of seconds apart; the 25-minute 429 of 12 Oct 2026 is the reason).
- At most 200 pages per host per run. Obey `Retry-After`; back off exponentially on 429 or 503, and stop the host for the run after the second 429.
- Honour robots.txt, including `Crawl-delay`.
- User agent: `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`. It names the project and the public site, never an email (relevance rule 6). This replaces the "contact" wording in sources-and-licences.md.
- Cache every fetched page with its read date (gitignored); never re-fetch inside the property's freshness window.
- Parallel lanes are allowed only when they hit disjoint hosts; Commons and Nominatim stay single-runner across the whole machine.

### 9.4 Provenance per value

| Field | Rule |
|---|---|
| `src` | every value cites at least one source row; `our_inference` needs a `note` with the method |
| source row | `{id, url, title, publisher, kind, read, method, run}`. `method` (new): `read` (an agent or person read the page), `crawl` (a parser extracted it), `api`, `computed`, `owner`. `run` is the crawl run id when `method` is `crawl` or `api`. |
| `read` | the date the page was fetched, not its published date |
| `observed_on` | for community facts, the date of the observation (the hike), kept apart from `read` |
| `applies_to` | the season year the fact describes ("2026 data used as a pattern", T3) |
| `quote` | the exact short phrase the value came from, at most 300 characters; mandatory for crawled values so a reviewer can check the parse |
| `basis` | whose statement it is (`operator_rule`, `operator_info`, `official_rule`, `official_grade`, `official_info`, `community`, `our_inference`). Scraping is a method, never a basis. |

### 9.5 Crawled values are proposals

Crawled and API values enter with `review_status: proposed`. Hard limits, prices, booking windows, closures and any value that contradicts a `stated` value are never auto-accepted (lanes README). A parse that cannot find its quote again on a re-fetch is dropped, not kept.

### 9.6 The run record

Every crawl or API run writes `data/capture/runs/<run-id>.json` (committed; small):

```jsonc
{ "schema": "capture-run/1", "run": "crawl-2026-10-21-ontario-parks", "started": "2026-10-21", "agent": "travel-researcher", "model": "opus",
  "scope": { "types": ["nature.protected.state_provincial_park"], "refs": ["place/algonquin-pp"] },
  "hosts": [{ "host": "www.ontarioparks.ca", "requests": 14, "robots": "allowed", "terms": "allowed", "status": "ok" }],
  "results": [
    { "ref": "place/algonquin-pp", "field": "hours", "outcome": "filled", "src": "src-0012" },
    { "ref": "place/algonquin-pp", "field": "toilets", "outcome": "searched_none", "tried": ["https://www.ontarioparks.ca/park/algonquin/facilities"] },
    { "ref": "place/algonquin-pp", "field": "window", "outcome": "blocked", "host": "reservations.ontarioparks.ca", "reason": "terms" },
    { "ref": "place/algonquin-pp", "field": "price", "outcome": "conflict", "src": ["src-0012", "src-0013"] } ] }
```

Outcomes: `filled`, `searched_none` (every source the contract lists for the field was tried), `gap` (some were not), `blocked` (robots, terms, 404, 429, login), `conflict`. `capture.ts run --check` validates it; `gaps` reads it so the next pass starts where this one stopped; the source registry (3a.7) folds in its sources.

### 9.7 Superseding a pre-migration value (Q41, decided 19 Oct 2026)

The owner approved: an official re-read may replace a pre-migration value as the shown value, through an override that keeps
the original leaf, so the ledger guarantee ("every pre-migration leaf still exists with the same value") holds unchanged.
**Built (lane D2, 19 Oct 2026)**: `core/src/capture/supersede.ts` (read side), `supersedeCheck.ts` (validator rules E_SUP_*), schema
table `capture_supersedes`. As built, `loadWorld` applies the entries to the in-memory world (records are copied, nothing on disk
moves), so every reader that goes through the world (completeness engine, bands, the web adapter's sections, suitability and tags)
shows the superseding value without a change of its own; `loadWorld(root, undefined, [], { supersede: false })` gives the raw lane
values, which the validator uses. `resolveVal(world, layer, ref, path)` returns the shown Val and the entry behind it. A source of an
entry that the lane file also holds (same normalised URL) is shown under the lane file's id; one it does not hold is warned about
(W_SUP_LANE_SRC) and shows the basis without a link. Capture-layer records are post-migration and are edited in place (E_SUP_NOT_LEDGER).

**The file.** `data/capture/supersedes.json`, schema `capture-supersedes/1`, owned by research lanes:

```jsonc
{ "schema": "capture-supersedes/1",
  "sources": [ { "id": "src-0001", "url": "https://cortina.dolomiti.org/en/escursioni/to-lago-sorapis-en/", "title": "To Lago Sorapis", "publisher": "Cortina d'Ampezzo tourist office", "kind": "official", "read": "2026-10-19", "method": "read" } ],
  "entries": [ {
    "id": "sup-0001",
    "layer": "suitability",                      // suitability | relevance | capture
    "ref": "place/lago-di-sorapis",
    "path": "suitability.effort.drivers.gain_m", // dot path into the record, as the ledger walks it
    "was": 550,                                  // the stored v, exactly; the check that the override is not stale
    "value": { "v": 434, "state": "value", "basis": "official_info", "src": ["src-0001"], "read": "2026-10-19", "quote": "434 m", "applies_to": "2026" },
    "reason": "the tourist office's route sheet; the stored figure was the midpoint of trail reports",
    "by": "travel-researcher (lane CS7c)",
    "on": "2026-10-19"
  } ] }
```

**Rules.**
1. The lane file is never edited: the original leaf stays where it is, so `lostLeaves` stays 0 and the ledger file is not retaken.
2. `value.basis` is `official_rule`, `official_grade`, `official_info`, `operator_rule` or `operator_info`. A community or inference
   re-read never supersedes (E_SUP_BASIS).
3. `was` must equal the leaf stored at `ref` + `path` today (E_SUP_STALE), and that leaf must be in the migration ledger (a
   post-migration value is simply edited in place, it needs no override) (E_SUP_NOT_LEDGER).
4. `path` must resolve to a Val in the record that wins for the ref (lane file over `migrated.json`) (E_SUP_PATH); `value` must pass
   the same schema as the Val it replaces (E_SUP_SCHEMA) and every `src` must be in the file's `sources` (E_SUP_SRC).
5. One entry per `ref` + `path` (E_SUP_DUP). Hard limits, prices, windows and closures in an entry are listed for the verifier.

**Read order (one resolver, core).** `resolveVal(world, layer, ref, path)` in `core/src/capture/` returns, in order: the supersede
entry for that ref and path, else the winning lane record's Val, else `migrated.json`'s. Every reader goes through it: the capture
engine (`readProperty`), suitability derive (effort, flat copy), relevance derive (`judged`, access costs), the relevance points and
the web adapter (`web/lib/public/suitability.ts`, `sections.ts`, `tags.ts`). The superseded value is not dropped from view: the
resolver returns it as an extra conflict `{v: was, basis: <the old basis>, src: <the old src>, note: "earlier figure"}`, so the
page shows "434 m (tourist office); earlier figure 550 m" under T3.

**Tests a builder adds.** The ledger test keeps its guarantee and adds: every entry's `was` is a ledger leaf at that path; a fixture
entry changes the shown value and leaves `lostLeaves` at 0; a stale `was` fails `validate --all`. `sources.ts build` reads the file's
`sources`.

**First entries once built** (each already stored as a conflict): Lago di Sorapis gain 550 to 434 m and distance 12.6 to 10.5 km
(cortina.dolomiti.org); Track and Tower grade Difficult to moderate (Ontario Parks, the land manager, over The Friends of Algonquin
Park). Monte Piana is not one: the stored 600 m covers the plateau loop, which the official one-way figure does not. All three are
in `data/capture/supersedes.json`.

## 10. Migration and gaps

### 10.1 Today's 214 enriched records against the contract

Measured on 18 Oct 2026 from `data/suitability/*/R*.json` and `data/relevance/*/R*.json` (script output kept in the build brief, not here). "Suitability R" is the share of the profile's R fields answered (value, `no_limit`, `none_stated` or `searched_none`); "as values" is the share that is a real value. "Contract R" adds the base R properties that have a home today: point with source, QID answered, relevance class and why, operating season, hours, best time, access points, price, toilets and the official link, where each is R for the type.

| Profile | Records | Suitability R answered | Suitability R as values | Contract R per record | Contract R filled |
|---|---|---|---|---|---|
| hike | 53 | 100% | 86% | 18 | 87% |
| walk | 28 | 100% | 89% | 16 | 84% |
| town | 26 | 100% | 87% | 6 | 72% |
| lake | 21 | 100% | 84% | 14 | 70% |
| viewpoint | 18 | 100% | 81% | 14 | 72% |
| sight | 14 | 100% | 82% | 13 | 50% |
| waterfall | 14 | 100% | 76% | 16 | 75% |
| lift | 6 | 100% | 87% | 17 | 66% |
| drive | 5 | 100% | 80% | 9 | 78% |
| area | 4 | 100% | 94% | 10 | 65% |
| rafting, boat, canoe_kayak | 9 | 86-100% | 62-69% | 20-31 | 70-73% |
| hot_spring, beach | 6 | 100% | 83% | 17-19 | 68-77% |
| other activities (8 profiles, 1-2 each) | 10 | 100% | 42-88% | 14-25 | 57-85% |
| **All** | **214** | **99.5%** | **83%** | | **77%** |

Levels today: 132 `usable`, 82 `usable_partial` (CF). A fields (Complete) are answered at 16%.

The high suitability numbers flatter the picture, for three reasons:
1. **Points.** Only the 45 Dolomites records have a stored point with a source; the other 169 have none in data (trip-timeline audit; 3a.9 is generating `points.json`).
2. **Offers.** One record of 214 carries offers (2 products). Activities are stored as places with limits on the record, so no product has its own price, slots or window.
3. **Structured time and money.** No record has structured hours, prices or booking windows, because no schema holds them with data. Every `R?` for hours or price fails.

### 10.2 What the built pages show (105 place pages, `web/out/places`)

| Family | Pages | Photo | Season | Kids assessed | Links checked | Hours (where asked) | Fee (where asked) | Best time or light (where asked) |
|---|---|---|---|---|---|---|---|---|
| town | 24 | 58% | 0% | 4% | 0% | | 0% | |
| trail | 19 | 21% | 47% | 47% | 63% | | | |
| area | 17 | 88% | 0% | 6% | 0% | | 0% | |
| viewpoint | 13 | 38% | 15% | 8% | 8% | | 8% | 8% |
| lake | 12 | 33% | 33% | 0% | 17% | | 8% | 8% |
| waterfall, sight, activity, eatery, lift | 20 | 0-67% | 0-17% | 0-100% | 0-100% | 0% (sight, eatery) | 0-20% | |

### 10.3 Properties missing entirely (no field with data anywhere)

| Property | Types that need it as R | Today |
|---|---|---|
| Opening hours (structured, with last entry and last down) | culture, ride, play, food, swim, thermal, every operated offer | 0 records; sights show "No hours recorded yet" on every page |
| Best time of day | viewpoint, summit, lake, wildlife | 0 records; the lake and viewpoint glance slot is empty on 23 of 25 pages |
| Operating season as rows (versus `season_months`) | every operated type | 0 records |
| Prices with currency and year | every offer | 0 records (`offer_prices` empty) |
| Booking windows as rules | access and experience offers | 0 structured; relevance `access_cost` names the type only |
| Toilets | play, park, swim (R); others A | 65 of 214 values, 147 never asked; no UI |
| Change rooms, picnic, baby change | swim, play, park | no field |
| Child time by age | routes | 0 of 214 |
| Shade, signal, water | A everywhere | 3, 2 and 5 of 214 |
| Part of, passes, reaches, at, on | summits, stages, offers, clusters | no relation exists |
| Operators as records | every offer | none |

### 10.4 Migration steps

| Step | What | Who |
|---|---|---|
| M1 | Assign a type to every record: S `kind`+`subkind`, LOC `kind`, legacy families, through `types.json` aliases; `kind-map.json` reasons carry over | builder (generated), reviewed by researcher |
| M2 | Split the 61 records that conflate layers (2.7.5, SP1-SP4): activities into offers with variants and operator records, lifts into line, ticket and top place, trail payoffs into route plus place | builder proposes, researcher reviews |
| M3 | Map the public adapter's label-matched facts to typed properties once (6.2), with their sources | builder |
| M4 | Move `point`s from legacy data and 3a.9 `points.json` into records with `point_source` | builder |
| M5 | Fill the 10.3 gaps by research (10.5) | researcher |

### 10.5 Gap-filling pass, scoped to planned trips first

Order (owner: the plan's days first, Q15):
1. **Public trips and dated trips inside 12 months**, records on the plan's days only: Patagonia (Feb 2027), the published Canadian Rockies days, Dolomites (Jul 2027), Iceland (Sep 2027).
2. Short trips and day trips from the hubs (Elora, Algonquin, Niagara once it is a public trip).
3. Everything else in scope, then off-plan records.

Per record, aim at Usable under the contract. Hours, prices, windows and toilets come first because they are R for the most types and drive the timeline and filters. The pass uses `capture.ts gaps` as its brief and writes run records. Commons stays one runner.

## 11. Build plan and sequencing

| Step | Work | Owner | Depends on | Before go-live? |
|---|---|---|---|---|
| 1 | **Schema**: `properties.ts`, `types.json` seed (this page's tree), record shapes place, route and offer with operators and variants, relations of 2.5, `participation.driver`, the new facility fields, `method` and `run` on source rows, `automated` in the registry, link vocabulary, the 10 new profiles' rows | travel-builder (Sonnet), rows drafted by travel-planner | this page, owner Q1 | yes |
| 2 | **Generator and CLI**: `capture.ts build/fields/explain/gaps/run`, generated outputs of 5.1 with `--check` in `check-all.sh`; `suitability.ts fields` delegates | travel-builder | 1 | yes |
| 3 | **Validator wiring**: one completeness engine over the resolved contract; K checks and `suit_level` become views; `W_CAP_NA_FIELD`, `E_CAP_TYPE`, `E_CAP_REL_REF`, `E_CAP_METHOD`, run-record checks | travel-builder | 2 | yes |
| 4 | **Migration** M1-M4, including the 61 layer splits (SP1-SP4) | travel-builder, travel-researcher review | 3 | yes |
| 5 | **UI section mapping inside S1** (3a.5): the 14 sections from `contract.ts`, value-type renderers, glance from the contract, "At this place you can also", Rest! warning line, the six suitability chip kinds; design reviewer (Opus) designs the new sections first | travel-design-reviewer, then travel-builder, then travel-verifier | 2, 4; L3c and L4b merged | yes |
| 6 | **Type-aware filters** (section 7) with the facet bands and the P8 allowlist test | travel-builder, design reviewer first | 5 | yes for trails, activities, sightseeing; others after |
| 7 | **Gap-filling research pass** 10.5 step 1 (planned and public trips) | travel-researcher (Opus) | 2, 4 | yes, for the public trips |
| 8 | Crawl runs for open data and allowed agencies (Ontario Parks, Parks Canada, NPS hours and closures) | travel-researcher with a builder-written runner | 3, owner Q3 | after |
| 9 | Research pass 10.5 steps 2-3; new domains (play, snow, dive, climb) as trips need them | travel-researcher | 7 | after |
| 10 | Planner and MCP use of the contract (`profile://type`, `propose` completeness) | builder | 3 | after (planner) |

**Before go-live:** steps 1-7, because the public place pages must stop drawing label-matched facts, show suitability and the Rest! warnings, and carry hours, prices and windows for the public trips' days. **After:** crawl automation, the remaining trips, the new domains' research and the planner integration.

## 12. Gotchas

- **Hours means opening hours.** The trail table's `hours` column is walking time and must be renamed in step 1, or the scheduler will read a 3 h walk as "open 3 h".
- **`R?` triggers must be data, not prose.** Each trigger in `types.json` is an expression over properties (`hours: "R? operated"`); a trigger written only in Markdown will never fire in the validator.
- **Aliases hide renames.** An old kind that maps to two types (`sight/market`, `sight/park`) needs the reviewed `kind-map.json` reason, not a default.
- **Offer fallback is one-way.** Facilities and access fall back from place to offer; limits never do. A test pins it.
- **Facet thresholds move with data.** A facet that hides at 59% coverage appears after one research pass. That is intended; the count line explains it.
- **Generated files are not edited.** `suitability-applicability.json` stops being hand-edited from step 2; a PR that edits it fails `build --check`.
- **Commons and Nominatim stay single-runner across agents**, even when the research pass fans out by trip.

## 13. Owner questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Make toilets R (required to be Usable) for parks, beaches, swim spots and play places, and change rooms R for swim spots and pools? It adds roughly one more source read per record. | Yes; families decide on them, and the owner named them |
| Q2 | Gap-filling order: public trips and trips inside 12 months first (Patagonia, Rockies days, Dolomites, Iceland), then short trips from the hubs, then the rest? | Yes |
| Q3 | Allow an automated crawler for open-data APIs and official agency sites whose terms allow it, while operator pages stay one-page reads by a research agent? | Yes |

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First version: audit of 9 definition sites, the type tree (15 domains, 61 categories, 324 ids), the three-layer model tested on ten examples with 61 records to split, place, route and offer records with operators, variants and relations, the base contract and per-type deltas, the generator and CLI, contract-driven sections and type-aware filters, the extension checklist with three worked examples, crawler rules and run records, the migration assessment of the 214 records, and the build plan (backlog 3a.12) |
| 2026-10-18 | Steps 1 to 4 built (lane CC). Resolved while building: (1) the registry counts are 15 domains, 61 categories (settlement and event are their own category) and 324 ids; (2) the profile rows live in `types.json` `profiles` and `suitability-applicability.json` is generated, with the 10 new profile rows drafted by the builder for design review; (3) `ferrata` operated is now `flag`; (4) the viewpoint, lake and waterfall profiles keep their effort-driver cells: 13 more records hold a short distance, so only the three long walks moved; (5) lifts: the line keeps the old ref and the suitability block moves to `offer/<ref>#ticket`; (6) an activity record keeps its ref as the offer; (7) the elk rut record is the viewing place and a new event record carries the occurrence; (8) the two Canmore Nordic Centre records are mtb routes at one new place, not offers; (9) a payoff place that already exists keeps its own relevance record and the trail's judgement is kept verbatim in `splits/<trip>.json`; (10) a record's relevance moves with the judgement (a route has none after a payoff split) and its trailhead point stays in `points.json`; (11) operators come only from a source row of kind `operator`; (12) `participation.driver` is added beside `ext.coaster.driver_rule`, which stays for the one record that uses it; (13) toilets stay A for parks (owner Q1 is still open); (14) 15 relevance classes marked new were added, one more than the 14 counted. |
| 2026-10-18 | Verifier fixes (lane CC). (1) The minitrekking runs `at` the Perito Moreno walkways, as its `same_place_as` says. (2) Placement: 20 facts moved from routes and tickets to payoff places and top stations (altitude, food, shade, the toilets of a payoff, the services at a lift's arrival), each in the same lane file so src ids keep their meaning; 12 places and stations got a suitability record (a station is kind `access`, subkind `station`, profile `access`, which now takes facilities, altitude and wheelchair as A). A fact stays on the route unless its source text says it is about the endpoint; 52 such cases, hazards and exposure included, are in `data/capture/placement.json` `review` for the next research pass. The lift profile's altitude_m is A: it is the top station's. The two duplicated values on Lagazuoi `#tunnels` were removed and are kept verbatim in the same file; the ledger test counts them. (3) Draw lives on the place a visitor comes to see: five lifts' relevance records moved to their top stations; the Montenvers train keeps its own (a scenic train); 52 routes that keep a relevance record carry `route_is_attraction` with a reason, Tre Cime with spec example 4 (see relevance.md 3.7); derive reads the layer and gives a route with no judgement the draw of the place it reaches. (4) The ten new profile rows are marked `review: design`, with the verifier's fixes (play operated flag with min_age and adult_required R when operated; climb drivers are the pitch or route height and gain is for the approach; canyoning bail_out and adult_time_min A and on_site_min R; motor_water weights and swim ability A; dive and surf current_or_tide A; access wheelchair A). (5) The tree counts in the tests now come from `types.json`. (6) The stubs sights/banff-gondola and sights/canmore-nordic-centre are aliases of their real records (their lane records stay, so the ledger holds). (7) Kicking Horse is one offer per operator `on` its river, each with `run_by`, `variant_of` the family float, which keeps the variants. (8) Hielo y Aventura's `derived_from` URL is its public page. (9) The missing places and relations are in capture-research-backlog.md. |
| 2026-10-19 | 9.7 added (lane CS7c, Q41): the supersede override for pre-migration values, as a spec for a builder; the file, its rules, the read order and the tests. |
| 2026-10-19 | Engine plumbing (lane D2). (1) `geometry` has a home (`tracks`, data/tracks) and a `readProperty` case: a route with a confirmed, stitched track that names its ref in `refs` answers it; a held-back track is a gap with the reason "route not confirmed" (3.3 asks for "geometry or searched_none" and is silent on confirmation; `UNCONFIRMED_TRACK_COUNTS` in `core/src/capture/tracks.ts` flips the rule). (2) 9.7 built, first entries Sorapis climb and distance and the Track and Tower grade. (3) A relevance record may carry `plan_b_pick` `{ref, reason, src}`, which wins over the derived Plan B (named so because `plan_b` is a derived key the validator refuses to read from a record). (4) `ext.water.swimming` gains `discouraged`, shown as "Swimming discouraged"; it counts as not swimmable for the swim flag. (5) Track fetcher: `start` in `data/tracks/inputs.json` replaces the stored trailhead for the cut. (6) Area `IT/trentino-alto-adige/bolzano` (Bolzano, the autonomous province) added to the area table of `data/locations/locations.json`; source Wikidata Q15124 "South Tyrol" (ISO 3166-2 IT-BZ, OSM relation 47046), read 19 Oct 2026. `area_id` set on Lago di Braies, Lago di Landro, the Otzi museum, Passo Gardena, La Val and Santa Maddalena. |
