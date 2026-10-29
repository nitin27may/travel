# Location type requirements: what research each kind of place must carry

Status: **spec; LT-C built 28 Oct 2026 (section 13)** (28 Oct 2026, travel-planner, Opus 5.5, branch `docs/LOCTYPE` from `main` 3484b727). Docs
only: no registry, `types.json`, record or app code changed. BACKLOG 15.391; TODO row of 28 Oct 2026; tasks in
[DATA-PLAN](../build/DATA-PLAN.md) 2.5 (LT-C, LT-M, LT-WHERE, LT-AP, LT-1 to LT-4, LT-RAT).

**Owner request (28 Oct 2026, verbatim):** "detail address, map links or coordinates, if trail then trail links from all
trails, if it is a park then follow the park schema, if this is a sight seen it should be that sight-seen; do you think we
should be putting it based on location type too, so that we have everything based on location what is needed when doing
data research".

Principles cited by number from [foundation/principles.md](../design/foundation/principles.md): P1 (the rule is per type,
so it holds at 10,000 places), P2 (permits and the address you drive to stay at rest), P3, P6 (the address when you
drive or print, the trail links when you open a trail), P7 (Directions is the 90% action on a place), P8 (no new list-row
data, no bulk link files, per-item exports), P9 (every new value reaches the UI through `/api/v1` and `CatalogueStore`).

## 0. The answer in one paragraph

**Yes: put it on the location type, and keep it on the type tree that already exists.** The capture contract already
drives research by type: `data/vocab/types.json` (15 domains, 61 categories, 324 type ids) gives every type its marks, and
`node core/bin/capture.ts fields --type <id>` prints the checklist a researcher follows. What is missing is not the
mechanism but four things the owner named: **(1) an address** (no property exists), **(2) a written map-links rule**
(the links are already generated from our point at render time; this page makes that the rule and adds the land manager's
map as a researched link), **(3) the trail-app and park links as required, not optional** (the tier counts only the
`official` link today), and **(4) a family view** so a research batch can say "all parks" or "all sights" and get one
done-definition. This page groups the 324 types into **nine families** (trail and route, park, sight, stay, eat,
activity and offer, transport and access, event, town), lists each family's required fields, proposes the registry and
`types.json` changes, and plans the 155 places of the locations store in a proposals run, an access-point pass and four
regional batches (27 h of data work, 14 h of code).
**Trade-off:** new required fields make the gap count rise unless they are switched on per family only after that family
is filled, so the promotions wait for the fills (the ratchet of 5.4); in return the gap budget never fails and no page
shows a new empty marker for a field nobody has started.

## 1. Request, traced

| Owner phrase | Where it lands |
|---|---|
| "detail address" | new registry property `address` (5.1), on the record you drive to (D2) |
| "map links or coordinates" | coordinates exist (`point`, role, source); Google Maps, Apple Maps, Directions and OSM links are generated at read time (D3); the land manager's map is the researched `map_sheet` link |
| "if trail then trail links from all trails" | the trail family's link set: official, AllTrails, OSM relation, GPX with its licence required; Komoot, Gaia, Wikiloc, Outdooractive applicable (D4, 4.1) |
| "if it is a park then follow the park schema" | the park family (4.2) is the data the park page reads ([park-page/data-map.md](../design/park-page/data-map.md)) |
| "if this is a sight seen it should be that sight-seen" | the sight family (4.3): dwell time, hours where operated, walk from the car, accessibility, the type's own facts |
| "putting it based on location type" | yes: marks per type in `types.json`, families as a `family` key on each category (5.3), `capture.ts gaps --family` (6.3) |

## 2. Findings, verified (not assumed)

Measured on `main` 3484b727 with the repo's own tools, read-only, 28 Oct 2026.

| # | Question | Verdict | Evidence |
|---|---|---|---|
| a | Is there a street or postal address property? | **Confirmed: none.** No key, group or value type for street, locality or postcode in the registry; no record carries one; no spec mentions a stored address | `core/src/schema/capture/properties.ts` (96 base keys plus the suitability paths) has no address row; `grep -i address` finds only Google terms in [source-strategy-osm-google.md](source-strategy-osm-google.md). The store has no address column either |
| b | Is there a map-links property? | **Confirmed: none, and none is needed.** Only the `links` list (`CAP_LINK_KIND`: official, osm, wikidata, commons, map_sheet, ...). The enum comment says "`navigation` is generated at render time and `google-maps` is gone". The web already builds Google Maps search, Google directions and Apple Maps links from our point (`core/src/links/links.ts`: `searchUrl`, `directionsUrl`, `appleMapsUrl`), and the place page's Directions card targets the parking or trailhead through the access points (`web/components/places/PlacePage.tsx`). A stored Google URL already fails (`E_CAP_LINK_ONLY`) | `core/src/schema/enums.ts` `CAP_LINK_KIND`; the old trip schema's `LINK_KIND` still lists `google-maps` (trip files only, legacy) |
| c | Are trail-app links optional? | **Confirmed, and weaker than that.** `nature.trail` and `nature.trek` list `alltrails, komoot, gaia, outdooractive, wikiloc, gpx_download, map_sheet` as A; only `official` is R. Worse, the tier engine counts the `links` property as answered when an `official` link is filled (`core/src/capture/engine.ts`, case `links`), so even an R kind other than `official` would not be counted. Of 118 trail records, 0 store an AllTrails link (the page builds a search link, `allTrailsLink`), 16 an OSM link, and 0 an `osm_ref` | `capture.ts fields --type nature.trail.hike`; `capture.ts gaps --tier required --type nature.trail` (osm_id 0 of 118, official 69, geometry 9) |
| d | How are parks modelled? | **One category, `nature.protected` (7 types plus `zone`), profile `area`, place layer, no park-specific schema object.** Required today: name, type, point, area_id, wikidata, summary, access_points, access_cost, the relevance keys, links (official), and suitability kid_note, on_site_min, hazards, access_season; R? season, hours, price, window, closures; A run_by, covers_areas, map_sheet, conditions. The "park schema" is the read models the park page needs: `EntryBlock` (requirement offers `access.pass.*` with `entry`, `price`, `window`, `covered_by`), `PlaceContext` members (EG-Q), and the planned camping block (PA-3C). The page's data-map needs `run_by` (the authority kicker), the `conditions` link (alerts), and members for stays and visitor centres; all three are A or absent today. 29 park records: run_by on 7, conditions on 5, official on 22 | [park-page/README.md](../design/park-page/README.md), [data-map.md](../design/park-page/data-map.md); `capture.ts fields --type nature.protected`, `gaps --tier required --type nature.protected` (20 of 29 complete) |
| d2 | Park point role | **Mismatch found.** The contract text (3.7.1) says a park's default role is `entrance`; the code (`defaultPointRole` in `core/src/capture/placementBlock.ts`) gives `nature.protected` the role `centre`. The data shows the cost: for 61 store places with both a store point and a capture point, three park points differ by 15 to 29 km (Kootenay 29.3, Kananaskis 18.6, Jasper 14.9), one a centroid and one an OSM feature | resolved in D2 below: the park's own point is `centre` (the pin); Directions goes to the park's access point (entrance or visitor centre) |
| e | How do sights differ? | **By category, and the differences are real.** Viewpoint and summit: `best_time` R, `access_points` R? (no door access), suitability `walk_m`, `exposure`, `on_site_min` R. Waterfall: `best_window` R (flow), `access_points` R, `walk_m`, `exposure`, distance R. Lake (`water.body`): `best_time` R, `access_points` R. Museum and heritage: `season`, `hours`, `price` R, `access_cost` R, point role `entrance`, `on_site_min`, `stroller`, `wheelchair` R; a ticket offer layer. Landform: `best_window` R? | `capture.ts fields` on `nature.viewpoint`, `water.falls`, `culture.museum`, `culture.heritage` |
| f | Store against capture records | **Two stores with a clear split, one undocumented overlap.** The locations store (`data/locations/locations.json`, 155 places; 148 with Wikidata, 65 with an image, 51 with season months, 0 with walk km, duration or cost) is authoritative for the hierarchy (countries, regions, areas: every capture `area_id` must be one of its ids, `E_PLACE_AREA`), the wishlist status, adoption by a trip, visits, collections, tags and private sources, and for the basics of a place that has no capture record. Capture records and their sidecars are authoritative for every registry property; the store's own columns are a seed. The store has a coarse `kind` (18 values), not a type id. 72 of 155 store places have a capture record (lane `catalogue` or a trip lane); 83 have none and therefore no type. **The overlap:** the store's `lat`/`lon` and `points.json` both hold a point for 61 places with no drift check between them (the 15 to 29 km park differences above). The `location` skill writes only the store; the `research` skill writes records; `locations.py basics --report` reads both | `tools/locations.py basics --report --json`; [data/locations/README.md](../../../data/locations/README.md); capture-contract 3.7.1, 3.8 |

**Store places by family and trip use** (store `kind` mapped to a family; "trip" means a ref used in a trip's schedule or
lane, or a store `trip` value; region tiers follow the public trips with days):

| Priority | Places | trail | park | sight | stay | activity | route | town | No capture record |
|---|---|---|---|---|---|---|---|---|---|
| P0 tied to a trip | 8 | | 5 | 2 | | | | 1 | 0 |
| P1 Rockies regions (CA/AB, CA/BC) | 32 | | 8 | 19 | | | | 5 | 27 |
| P2 Utah and Dolomites regions | 19 | | 1 | 9 | 1 | 1 | | 7 | 11 |
| P3 Iceland, Patagonia, Chamonix regions | 27 | | 1 | 11 | | 1 | | 14 | 27 |
| P4 past-trip regions (CA/ON, CA/QC, US/VT, US/NH) | 30 | 6 | 2 | 16 | | | | 6 | 16 |
| P5 no trip region (US/WA, US/CO, VN, ...) | 39 | 1 | 13 | 10 | | 2 | 1 | 12 | 2 |
| **All** | **155** | **7** | **30** | **67** | **1** | **4** | **1** | **45** | **83** |

Only 8 store places are used by a trip today, so "how many trips use them" orders by the trip whose region holds them;
the 83 without a capture record have no type yet and are the bulk of the work.

## 3. Decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| D1 | **Research requirements stay on the type tree.** No second list: a family is a label on each `types.json` category (`family`), never a separate checklist. A family's checklist is the union of its types' resolved marks, printed by `capture.ts fields` and counted by `gaps --family` | one source of truth (capture-contract 5); P1: a new type joins a family by one key | a family view hides per-type differences; the per-type checklist stays the brief, the family view is only the batch report |
| D2 | **The address lives on the record you drive to.** Door places (museum, heritage site, stay, eatery, playground, amusement park, zoo, thermal pool, visitor centre, ski base) carry their own postal address (R once filled). Parking, trailheads, transit stops and docks carry a postal address or a nearest-road address. Natural places (trail, lake, viewpoint, waterfall, summit, landform, park) carry none of their own when an access point exists; the page shows the address of the Directions target. A park's own point keeps the role `centre` (the map pin); its arrival is its access point (main entrance or visitor centre record). Country and region are never stored in the address: they come from `area_id` (capture-contract 3.7.1) | P6: the address is needed at the moment you drive or print, and you drive to the car park, not to the middle of a lake; no fabricated street for a waterfall | a natural place reached straight from a road with no access record needs its own address (A on natural types covers it); one more record (the car park) for many sights, already required by `access_points` |
| D3 | **Map links are generated at read time, never researched or stored.** Google Maps search, Google directions, Apple Maps from the stored point (5 decimals) and the name; directions to the access point; the OSM link from `osm_ref`. A Google `place_id` is used in the search link only if Q-SRC5 is answered yes, obtained by a visitor's pick or a researcher's single lookup, never bulk-matched (and no batch in this plan looks one up). **Researched:** the land manager's own map (`map_sheet`: a park or trail map PDF, an official topographic sheet) and, for trails, the GPX download with its licence. No what3words (proprietary; its terms forbid storing and bulk conversion) | nothing Google returns is stored (Google Maps Platform terms 3.2.3, Q-SRC2); generated links cannot go stale; the official map is a fact only research can find | a map link carries no curation (no "best car park" in a Google link); the access point carries that instead |
| D4 | **Link kinds become tier keys.** Each kind in a type's resolved `links.R` (other than `official`, which keeps its `links` key) counts as its own required key `links.<kind>`, answered by a filled link, a `found_in_search` link (link-only platforms) or a dated `searched_none`. Landing it changes no count, because every `links.R` holds only `official` today; families then promote kinds (5.4) | the owner's "trail links from all trails" is a required set, not a wish; the engine must count what it requires | per-kind keys raise the key count once promoted; the ratchet keeps that inside fills |
| D5 | **Trail links:** AllTrails (the trail's own page, found by a search, never fetched), the official page, the OSM relation through `osm_ref`, and `gpx_licence` when a GPX download is offered are required; Komoot, Gaia, Wikiloc, Outdooractive and Trailforks stay applicable (regional strength differs: Outdooractive and Komoot in the Alps, AllTrails and Gaia in North America). The page keeps the generated AllTrails search when no page is stored (`allTrailsLink`) | one direct link beats a search with name collisions; a GPX file without a stated licence is never offered | about 2 agent-minutes per trail to find and check the AllTrails page by search; a trail with no AllTrails page is a dated `searched_none` |
| D6 | **Link-only rule unchanged.** Every third-party link is a reference: we store the URL, the kind, the state and the date, never their content, ratings, counts, photos, coordinates or track (capture-contract 9.2, DATA-LOC 3, Q-LOC-1). Official pages are read one page at a time unless the host's terms allow automated access | P8 in reverse: we do not copy others' catalogues | some facts stay one click away on AllTrails |
| D7 | **Addresses come from open or official sources only, in this order:** the operator's or land manager's page (F, O); Wikidata P6375 street address and P281 postal code (CC0); OSM `addr:*` tags on the `osm_ref` element; Nominatim reverse geocoding of the access point for a nearest-road address (single lookups, one a second, one runner, cached). Never Google, Apple, Bing, a booking site or a review site. OSM and Nominatim values carry the `odbl` licence and sit in the identity layer (R-ODbL-2, Q-SRC1) | open data first; one licence class per value | if Q-SRC1 is answered against the identity-layer rule, `address` must pick one provider class per country (R-ODbL-1); the procedure in 6.1 already tries official first, so the fallback costs a re-run, not a redesign |
| D8 | **The store stays the seed; records win.** Once a store place has a capture record, `points.json` is its authoritative point and the store's `lat`/`lon` is the seed; a drift report (`W_LOC_POINT_DRIFT`, report only, more than 2 km apart and the record's role not `centre`) lists differences for a person. The store gets no address, link or type-fact columns (DATA-LOC 2: "write nothing that does not fit an existing column or capture property") | one home per fact | the store row and the page can disagree until the report is worked |

## 4. Families and what each must carry

### 4.0 Every family: identity, where, map links, media

Marks: **R** required for Usable, **R?** required when its condition holds, **A** counts for Complete. "Today" is the
resolved mark on `main`; "Proposed" is the mark after the family's promotion (5.4). Every value carries `src`, a read date
and a basis, or a dated `searched_none` with what was tried.

| Group | Field | Today | Proposed | Source order | Note |
|---|---|---|---|---|---|
| Identity | `name` | R | R | F, O, D | as signed |
| Identity | `type` (one of the 324 ids) | R | R | ours, from P31 and OSM tags | the 83 store places without a record get one in their batch |
| Identity | `wikidata` | R (N on stay, eat, access, offers) | unchanged | D | QID or `searched_none` |
| Identity | `osm_ref` | A | **R on places and routes** | D | `node/`, `way/`, `relation/`; becomes a `Val` so `searched_none` can be stored (5.2) |
| Identity | `geonames_id` | R on towns, else A | unchanged | D | |
| Where | `point` with `point_role` and `coord_src`, `point_src` | R | R | D (OSM, Wikidata P625), F; manual last; never Google | role default by type (`defaultPointRole`) |
| Where | `area_id` (country and region read from it) | R | R | the store | never stored again |
| Where | access points: `starts_at` (trailhead), `parks_for` (parking), `serves` (shuttle, stop) | R or R? by type | unchanged | F, D, C | an access point is its own `access.*` record |
| Where | `walk_m` from the access point | R on viewpoint, waterfall, lake | unchanged | F, X | |
| Where | `address` | none | R on door places and access points; A on natural places; N on towns, events and offers | F, O, D (Wikidata), D (OSM `addr:*`), D (Nominatim reverse, nearest road) | D2, D7, 5.1 |
| Where | `near_town` | R? derived | unchanged | X | computed, never researched |
| Map links | Google Maps, Apple Maps, Directions, OSM | generated | generated, never stored | from `point`, the access point, `osm_ref` | D3 |
| Map links | land manager's map (`map_sheet`) | A where listed | R on parks; A on trails, ferrata, bike, drive, snow | F | park or trail map PDF, official sheet |
| Media | `photos` | A | A | D (Commons, one runner), agency public domain, own | CC BY, CC BY-SA, CC0, public domain only (DD-3); else "No licensed photo yet" |

### 4.1 Trail and route (`nature.trail`, `nature.trek`, route layer of `wheels.bike`, `wheels.drive`, `mountain.ferrata`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `starts_at` (trailhead record), `ends_at` on point-to-point | R; ends_at N | `ends_at` R? with a new trigger `point_to_point` (capture-contract 3.7.2) | |
| Type links | `official` (trail or land manager page) | R | R | |
| Type links | `alltrails` | A | **R** (filled, `found_in_search`, or `searched_none`) | D5 |
| Type links | `osm` relation | A (link) | through `osm_ref` R | the link is generated from `osm_ref` |
| Type links | `gpx_download` | A | A | |
| Type links | `gpx_licence` | A | **R?** with a new trigger `gpx_offered` (a `gpx_download` link is filled) | never offer a file without a licence |
| Type links | `komoot`, `gaia`, `wikiloc`, `outdooractive`, `trailforks`, `trip_report`, `conditions` | A | A | `conditions` R? `status_page` on managed land |
| Type facts | `effort.source_grade` with the scale named, `distance_km`, `gain_m`, `adult_time_min`, `exposure`, `hazards`, `access_season`, `ext.trail.navigation` | R | R | effort drivers; OSM track (TRK-1) first, then the official page, then a marked estimate (DATA-LOC 3) |
| Type facts | `ext.trail.shape` | A | **R** (capture-contract 3.7.2 proposal) | loop, out and back, point to point |
| Type facts | `geometry` | R | R | TRK-1 and its runs |
| Type facts | `loss_m`, `surface`, `high_point_m`, `dogs`, `child_time_min`, `snow_free_window` | A | A | |
| Suits | `age_band`, `kid_note`, `stroller`, `carrier_ok`, `group_min` | R | R | |

### 4.2 Park and protected area (`nature.protected.*`, `nature.garden`; requirement offers `access.pass.*` at the park)

The park page's data ([data-map.md](../design/park-page/data-map.md)) is the schema. Entry requirements are researched by
the protected-area tasks (PA-R-CA, PA-MUS, PA-R-ON, [protected-area-entry.md](protected-area-entry.md)); this family covers
the rest.

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Identity | `osm_ref` (the boundary relation) | A | R | |
| Identity | `run_by` (the authority: Parks Canada, NPS, Ontario Parks) | A | **R** | the kicker on the park page |
| Where | `point` role `centre` | R | R | the pin (D2) |
| Where | `access_points`: at least one entrance, gate or visitor-centre record | R | R | the Directions target and its `address` |
| Where | `covers_areas` for a park that is the store area of its members | A | A | EG-I membership |
| Type links | `official` | R | R | |
| Type links | `conditions` (alerts, closures) | A | **R** | the alerts link at rest (PN10) |
| Type links | `map_sheet` (park map PDF) | A | **R** | |
| Type links | `booking` (permits, day use) | R? | R? `bookable` | campground booking lives on the campground's lodging offer (`book_url`), not here (PN12) |
| Type links | `hours_rates` (fees page) | none | A | |
| Type facts | `access_cost` or requirement offers (`entry`, `price`, `window`, `covered_by`) | R | R | PA tasks |
| Type facts | `season` (or "open all year"), `access_season`, `hours` when gated, `closures` | R?, R, R?, R? | unchanged | |
| Type facts | `hazards` (wildlife), `ext.wildlife.*` in bear, elk or bison areas | R, R? | unchanged | |
| Type facts | members: campgrounds (`stay.camp.*`), visitor centres, trails (`part_of`) | derived | derived | EG-Q; camping block PA-3C |
| Suits | `kid_note`, `on_site_min` | R | R | |

### 4.3 Sight (`nature.viewpoint`, `nature.summit`, `nature.landform`, `nature.wildlife`, `water.body`, `water.falls`, `water.swim`, `water.thermal`, place layer of `culture.*`, `animals.see`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `address` | none | R on `culture.*`, `animals.see`, `water.thermal`, `water.swim` pools; A on natural sights | D2 |
| Type links | `official` | R | R | land manager, museum, operator |
| Type links | `hours_rates`, `booking` (tickets) | A | **R?** `operates` and `bookable` on culture, animals, thermal | |
| Type links | `conditions`, `webcam`, `wikipedia`, `commons`, `trip_report` | A | A | |
| Type facts | dwell: `on_site_min` | R | R | |
| Type facts | `walk_m`, `exposure` (viewpoint, waterfall, lake) | R | R | |
| Type facts | `best_time` (viewpoint, lake), `best_window` (waterfall flow, landform) | R | R | light from `core/src/sun` |
| Type facts | `ext.water.swimming` (lake, waterfall) | R (contract 3.5) | R | |
| Type facts | `hours` with `last_entry`, `closed_days`, `price` (ticket offer), `visit_mode`, `indoor` (culture) | R, R, R?, N, N | `indoor` by type default (S2D-IND) | |
| Suits | `stroller`, `wheelchair`, `age_band`, `kid_note` | R | R | accessibility |

### 4.4 Stay (`stay.*`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `address` | none | **R** | the check-in desk; huts: nearest-road address of the access point |
| Type links | `official` | R | R | |
| Type links | `booking` | A | **R** | the booking page, link only; never prices or ratings from a booking site |
| Type facts | lodging offer: `check_in_out`, `cost_band`, `price`; `run_by`, `window` | R, R, R; A, A | `run_by` and `window` R on `offer.lodging` (capture-contract 3.7.2) | |
| Type facts | `family_rooms`, `pitches`, `quiet_hours`, `groceries` | N, A | unchanged | |
| Suits | `wheelchair` | R | R | |

### 4.5 Eat (`food.*`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `address` | none | **R** | |
| Type links | `official`; `menu`, `booking` | R; A | unchanged | |
| Type facts | `hours` with kitchen close, `season`, cost band, reservation | R, R, contract 3.5 | unchanged | the catalogue lists food only where it is a destination (source-strategy 5 row 8) |
| Suits | `wheelchair` | R | R | |

### 4.6 Activity and offer (offer layer of `water.*`, `air.*`, `mountain.*`, `snow.*`, `ride.*`, `animals.ride`, `play.*`, `culture.tour`, `culture.show`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `at`, `on` or `starts_at` (the meeting place); no address of its own | R | R | the address is the meeting place's (D2) |
| Type links | `official`, `booking` (`book_url` on experience offers) | R, R | unchanged | |
| Type links | `terms`, `waiver`, `safety`, `reseller` | A | A | resellers are link only |
| Type facts | `run_by`, `season`, `hours`, `duration_min`, `activity_min`, `price`, `window`, limits per variant, `participation.weather_cancel` | R (offer.experience) | unchanged | |

### 4.7 Transport and access (`access.start`, `access.park`, `access.transit`, `access.amenity`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `point` (role `parking`, `trailhead`, `centre`), `parks_for` or `serves` | R | R | |
| Where | `address` (postal or nearest road) | none | **R** | the address the Directions card and print show |
| Type links | `official` | R | R | |
| Type links | `status` | A | R? `status_page` | |
| Type links | `timetable` | none | **R** on `access.transit` | |
| Type facts | fee (reservation offer), `fills_by`, gate hours, `capacity`, `rv_limits`, `accessible_parking`, `walk_m` | contract 3.5 | unchanged | |

### 4.8 Event (`event.*`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Where | `part_of` or `at` (where it happens); no address | R | R | `E_PLACE_ORPHAN` |
| Type links | `official`; `tourism_board` | R; A | unchanged | |
| Type facts | `season` or `recurrence` | R | R | |

### 4.9 Town and city (`settlement.*`)

| Group | Field | Today | Proposed | Note |
|---|---|---|---|---|
| Identity | `geonames_id` | R | R | the towns layer |
| Where | no address (a town is a locality) | | N | |
| Type links | `official` | R | R | |
| Type links | `tourism_board` | A | **R** | |
| Type links | `wikivoyage`, `timetable` | A | A | |
| Type facts | `on_site_min` (M6, trip-builder-location-metadata), `why_stay`, `groceries`, `last_transport` | N, A | M6 as planned there | |

## 5. Registry and `types.json` changes (proposal; LT-C builds them)

### 5.1 The `address` property

```ts
// core/src/schema/capture/properties.ts, BASE_PROPERTIES, Identity group, after osm_ref
def({ key: "address", group: "identity", label: "Address", value: "object", section: "access", display: ["rest"], base: "N",
  gap: "Address not recorded yet", home: cap("address"), layers: ["place"], lanes: ["O", "F", "D"],
  expose: { trip: ["day"], export: ["print", "csv", "ics"] } }),
```

```ts
// core/src/schema/capture/records.ts: the value, held in a Val (src, on, basis), so searched_none is possible
export const Address = z.object({
  kind: z.enum(["postal", "nearest_road"]),         // nearest_road: from a reverse lookup of the point; shown as "Near ..."
  lines: z.array(z.string().min(1).max(120)).min(1).max(3), // as the source writes them; no country, no region
  locality: z.string().min(1).max(80),               // the postal locality, which may differ from near_town
  postcode: z.string().max(16).nullable(),           // null where the country or the place has none
}).strict();
```

| Attribute | Value | Why |
|---|---|---|
| key, group, label | `address`, identity, "Address" | it says where |
| value type | `object` (no new value type) | the registry already carries objects |
| base | N; marks per type in `types.json` (5.3) | the ratchet (5.4) |
| layers | place only | offers and events inherit their place's |
| section, display | `access`, rest | the Directions card (P6) |
| privacy | public | a public place's address |
| expose | page rest; trip day (TRIP_DAY_KEYS); list none (P8: no row field); export print, csv, ics; api detail; mcp public | the ICS override is new: exposeOf says "ics never" because public trips are dateless; the dated copy's "Add to calendar" needs a LOCATION |
| keep | K2 display (derived) | |
| lanes | O, F, D | D7 |

### 5.2 Other registry and schema changes

| Change | Where | Effect on gaps at landing |
|---|---|---|
| `osm_ref` accepts a `Val` as well as the bare string (the reader takes both; new writes use `Val`), so `searched_none` is storable | `records.ts` line 232, `engine.ts` read | none (reader only; ledger leaves untouched) |
| Per-kind link keys: each kind in the resolved `links.R` other than `official` becomes the tier key `links.<kind>`; answered by `filled`, `found_in_search` (link-only kinds) or `searched_none` | `engine.ts` (case `links` stays for `official`), `capture.ts gaps` | none: every `links.R` is `["official"]` today (a test pins `W_TIER_REQUIRED.keys` unchanged) |
| Two triggers: `point_to_point` (a route with distinct start and end), `gpx_offered` (a filled `gpx_download` link) | `core/src/capture/triggers.ts` | none until a mark names them |
| `family` key on every category and on the `settlement` and `event` domains; a test fails a category without one | `data/vocab/types.json`, `core/src/schema/capture/typesFile.ts` | none |
| OSM link generated from `osm_ref` on the page; stored `osm` links stay valid (ledger) | `web/` (LT-M) | none |
| `W_LOC_POINT_DRIFT` report (store point against `points.json`, over 2 km, record role not `centre`) | `tools/locations.py basics --report` | report only, not in the budget |

### 5.3 `types.json` marks, phase 1 (lands with LT-C, gap-neutral)

`address: "A"` on the categories of 4.3 (culture, animals.see, water.thermal, water.swim), 4.4, 4.5, 4.7, and on the
natural categories of 4.1 to 4.3; `address: "N"` on `settlement`, `event` and the offer layers. Every promotion of 4 is
written as A in phase 1. Nothing becomes R in LT-C.

### 5.4 The ratchet: how a required field arrives without failing the gap budget

The budget (`data/capture/gap-budget.json`, 27 Oct: `W_TIER_REQUIRED` 382 records, 3,659 keys) may only fall. A new R mark
on records that lack the value raises it. The rule:

1. A new property or link kind lands as **A** (phase 1): it counts for Complete, not Usable, so no count moves.
2. A family batch fills the field on every record of the family it touches: a value or a dated `searched_none`.
3. **In the same commit**, the batch promotes the mark from A to R (or R?) for that family's categories, runs
   `capture.ts gaps --promote <key> --family <f>` (new in LT-C: prints the count the promotion would add and exits 1 when
   it is above 0), then `gaps --budget --check` and `--write` to lower what the fill closed.
4. A family not yet filled keeps the A mark. New records of a promoted family error from their first write (existing rule
   for new records), so the gap cannot reopen.
5. Never `--write --reason` to raise the budget for a promotion; a promotion that would raise it waits for its fill.

**Size of what waits behind the ratchet** (records today that would gain an unanswered key if promoted without a fill):

| Promotion | Records | Keys |
|---|---|---|
| `address` R on door places (culture 22, stay 5, food 1, play 2, thermal 5, swim 3, snow 1, visitor info 6) | about 45 | about 45 |
| `address` R on access points (parking 55, starts 8, transit 11, amenity 6) | 80 | 80 |
| `osm_ref` R on places and routes (trails 0 of 118; access 70 of 80; parks 18 of 29) | about 250 | about 250 |
| `links.alltrails` R on trails (0 of 118) | 118 | 118 |
| `links.conditions`, `links.map_sheet`, `run_by` R on parks | 29 | about 75 |
| `links.tourism_board` R on towns | 47 | about 31 |
| **All** | | **about 600** |

These keys are on trip-lane records as well as store places; the batches of 7 fill the store places and the trip-lane
records of the same family and region together, so each promotion closes in one commit.

## 6. Research procedure per family

### 6.1 Common steps (every batch)

1. `node core/bin/capture.ts gaps --tier required --family <f> --trip <lane> --json` and `gaps --placement`: the brief.
2. For each place without a record: choose the type with `capture.ts types --tree` (P31 and OSM tags are hints, DC-C's
   `source-type-map.json` when it exists), then `capture.ts fields --type <id>` is the checklist. Read
   [method/kinds/](../../../research/method/kinds/README.md)`<kind>.md` for the traps.
3. Identity and where first: Wikidata (one request a second), then the OSM element through Overpass (one runner, at least
   10 s apart, cached), then the official page. Points never from Google (`W_PLACE_POINT`, T5).
4. Address (D7): the proposals file of LT-WHERE first; confirm each against the official page for door places.
5. Links: the type's checklist; official pages read one page at a time; link-only platforms found by a search and stored
   as `found_in_search` with the query and date, never fetched.
6. Type facts and suitability: the family table of 4; every gap a dated `searched_none`.
7. Photos: Commons one call at a time under `flock /tmp/travel-commons.lock`, never from parallel agents; allowlist only.
8. ODbL: every value from OSM or Nominatim carries licence `odbl` and the attribution "© OpenStreetMap contributors" on the
   page and in exports (R-ODbL-2); Wikidata values are CC0; official values keep their licence line.
9. Write records through the `research` skill into the lane files; store-only columns (`wikidata`, `elevation_m`, `image`,
   `season_months`) through `locations.py edit`; never hand-edit the store. Run record `data/capture/runs/<run>.json`.
10. Hand-back: `gaps --family` before and after, `gaps --budget --check`, `budget:report` for the place size (S2D-SIZE
    first), `locations.py basics --report`, the Opus sample review.

### 6.2 Source order and done-definition by family

| Family | Source order | Tools and skills | Model | Done when |
|---|---|---|---|---|
| Trail and route | F trail or land manager page and conditions, F open-data GPX, T, D OSM relation and track (TRK-1), C dated reports; AllTrails and the other platforms link only | `research` skill; `capture.ts`; TRK-1 track runs | Sonnet fills, Opus 10-record review | every 4.1 R key a value or `searched_none`; trailhead and parking records exist with points and addresses; the AllTrails page or `searched_none`; GPX only with a licence |
| Park | F (park agency pages, alerts, maps, permits), D (Wikidata, agency open data, OSM boundary) | `research`, `location` for a missing store area | Opus for authority and members, Sonnet for links | 4.2 R keys; at least one entrance or visitor-centre access record with an address; `run_by` an operator in `operators.json` |
| Sight | F, O (museum or operator), T, D (OSM, Wikidata), X (light), C | `research`; `node core/bin/sun.ts` for best time | Sonnet, Opus review | 4.3 R keys; the Directions target has an address |
| Stay | O, F (park campgrounds) | `research` | Sonnet | 4.4 R keys; postal address; booking link |
| Eat | O, T, D (hint only) | `research` | Sonnet | 4.5 R keys; postal address |
| Activity and offer | O, F (licensing), T | `research`, adventure lane | Sonnet, Opus for limits | 4.6 R keys; the meeting place resolves (`E_PLACE_ORPHAN` 0) |
| Transport and access | F, D (OSM parking and stops), C (two dated reports for fill times) | `research` | Sonnet | 4.7 R keys; address postal or nearest road |
| Event | T, F | `research` | Sonnet | 4.8 R keys |
| Town | F, T, D (GeoNames, Wikidata), X | `research`; `tools/towns.py` layer | Sonnet | 4.9 R keys; `geonames_id` |

Every family also: an Opus sample of 10 values per batch confirmed at 90% or better (the L4 method), or the batch is
reworked before merge.

### 6.3 Quality checks

| Check | Exists | Added by |
|---|---|---|
| `capture.ts gaps --tier required --type <prefix>` | yes | |
| `capture.ts gaps --tier required --family <f>` (the union of the family's prefixes, with the 6.4 matrix) | no | LT-C |
| `capture.ts gaps --promote <key> --family <f>` (the ratchet gate) | no | LT-C |
| `locations.py basics --report` layers `address` and `type links`, and the drift report | no | LT-C (Python half) |
| `gaps --budget --check` in check-all | yes | |
| dead-link check | partly: `node core/bin/sources.ts links --fetch` checks the sources of the suitability and relevance files, not the capture `links` | LT-RAT runs it; extending it to capture `links` is a later tools task, not here |

## 7. Plan for the 155 store places

### 7.1 What is automatable and what needs a person

| Step | Automatable | Human or agent judgement |
|---|---|---|
| `osm_ref` candidates for places with a QID (Wikidata P402 relation; the OSM element's own `wikidata` tag through Overpass) and Overpass by name near the point | yes, one runner | which element is the place (a lake's water polygon, not its car park) |
| Address proposals: Wikidata P6375 and P281; OSM `addr:*` on the element; Nominatim reverse of the access point (155 plus about 56 new access points, at one a second about 4 minutes of requests) | yes, one runner, cached, user agent `travel-capture/1.0` | postal or nearest road; confirm door addresses on the official page |
| Type suggestion for the 83 without a record (P31, OSM tags) | yes, as a suggestion | the type is ours (contract 2.2) |
| Licences of photos and GPX | partly (Commons API licence field) | the GPX licence from the official page |
| AllTrails, Komoot, Outdooractive pages | a search, by an agent, no fetch | is it the same trail |
| Park authority, entry, members | no | Opus |
| Proposals become values | never automatically (capture-contract 9.5) | the batch confirms each |

### 7.2 Batches (order: P0 then P1 to P5; inside a batch, parks and access points before the sights they serve)

Rates: the measured 4.1 agent-minutes per place (D2b) for a record that exists and needs the new fields, about 6 minutes
for a new record at the full required tier with its sidecars, 5 minutes per new access-point record, 8 per new trail.

| Batch | Places | Families | Work | Hours | Model | Window |
|---|---|---|---|---|---|---|
| **LT-WHERE** | all 155 | all | `osm_ref` candidates and address proposals into one run record; no values written | 3 | Sonnet run 2.5, Haiku check 0.5 | D spare, after LT-C |
| **LT-AP** | the 56 places that need an access point (basics report: parking missing 56 of 100), in priority order | transport and access | new `access.park`/`access.start` records with point, address, `parks_for`; fills the 4.7 keys and promotes them | 5.5 | Sonnet 5, Opus review 0.5 | split: P0 to P1 in LT-1, the rest in LT-2 to LT-4 |
| **LT-1: trip-tied and Rockies** | 40 (P0 8, P1 32): 13 parks, 21 sights, 6 towns | park, sight, town | 4.2, 4.3, 4.9; 27 new records; the Rockies parks after PA-R-CA (entry rules stay there) | 6 | Sonnet 4.5, Opus 1.5 (parks, review) | D spare |
| **LT-2: Utah, Dolomites, Iceland, Patagonia, Chamonix** | 46 (P2 19, P3 27) | sight 20, town 21, park 2, stay 1, activity 2 | 38 new records | 4.5 | Sonnet 4, Opus 0.5 | E |
| **LT-3: past-trip regions** | 30 (P4): 6 trails, 16 sights, 6 towns, 2 parks | trail, sight, town, park | 16 new records; the trail links and the trail promotion | 3.5 | Sonnet 3, Opus 0.5 | E |
| **LT-4: the rest** | 39 (P5): 13 parks, 12 towns, 10 sights, 4 others | all | 2 new records; mostly the new fields on existing records | 3 | Sonnet 2.5, Opus 0.5 | E |
| **LT-RAT** | | all | the promotions the batches did not close, the final `--write`, the cross-family Opus sample | 1.5 | Opus | E |
| **Total data** | 155 | | | **27** | | |

Batch size: at most 25 records per commit and one lane file per region; a batch that moves the place size merges alone
(S2D-SIZE first, Q290 re-baseline applies to required-tier fills).

## 8. How this feeds the product

| Surface | What it reads | UI change (LT-M unless noted) |
|---|---|---|
| Place page, Directions card (P6, P7) | the Directions target's `address` (postal, or "Near <road>, <locality>"), its point and role; generated Google, Apple and OSM links; `map_sheet` | one address line under "To <target>"; an "Official map" link where `map_sheet` is filled; OSM link from `osm_ref`; no new section (P2: the card exists) |
| Place page, Links | the family's link set, link-only platforms labelled in aria only (privacy test) | trail pages show the stored AllTrails page, else the search (exists); Komoot, Outdooractive, Wikiloc when stored; GPX only with its licence line |
| Park page (PA-2) | `run_by`, `conditions`, `map_sheet`, the entrance access point | the kicker, the alerts link at rest, the map link in Getting there (already in the PA design; this fills the data) |
| Add picker fit lines (edit-mode-spec 7.3) | `walk_m` and the access-point kind | "Park, then 1.2 km on foot" in the fit line where held (Step 2 follow-up, design review first) |
| Directions per day (TRIP-NAVIGATION-PLAN, BACKLOG 15.48) | access points of each stop | day route waypoints are the access points, not centres; no new data beyond LT-AP |
| Print (day sheet) | `address` of each stop's target | one line per stop |
| ICS (dated copy, Add to calendar) | `address`, else the name and coordinates; `GEO` from the point | `LOCATION` and `GEO` per event in `core/src/export/ics.ts` (none today) |
| CSV export | `address` | one column |
| `/api/v1/places/<slug>` detail and the public remote MCP (R-124) | `address`, `osm_ref` | detail only, never the list row (P8, P9) |

Every UI item ends with travel-design-reviewer (Opus) and travel-verifier (Sonnet). Trip scope (trip-scope-scenarios) is
untouched: these are public catalogue facts. Nothing from keep-from-live-site is removed; the Places cards and table keep
their columns (no address column in lists, P8).

## 9. Tasks

| Id | What | h | Model | Blocked by | Bundle |
|---|---|---|---|---|---|
| LT-C | Contract: `address` property and Zod value, `osm_ref` as `Val`, per-kind link keys, triggers `point_to_point` and `gpx_offered`, `family` on categories with a test, `gaps --family`, `gaps --promote`, phase-1 marks (5.3), basics report layers and drift report, capture-contract text (3.4, 3.7.1, 3.7.2) | 7 | Opus builder 6 (a shared contract), Opus review 1 | not beside RIS-H or STY-P on `properties.ts`; one `types.json` writer | D (B2 contract lane; Infra) |
| LT-M | UI: Directions-card address line, OSM link from `osm_ref`, official map link, print address, ICS `LOCATION` and `GEO`, CSV column, API detail and MCP field | 7 | Sonnet builder 5, Opus reviewer 1, Sonnet verifier 1 | LT-C; S2D-SIZE | E (Infra) |
| LT-WHERE | `osm_ref` and address proposals for the 155 (7.2) | 3 | Sonnet, Haiku check | LT-C | D (data seat 1) |
| LT-AP | Access-point records for the 56 places without one | 5.5 | Sonnet, Opus review | LT-WHERE | D and E (split across the batches) |
| LT-1 | P0 and P1: 40 places | 6 | Sonnet, Opus | LT-WHERE; PA-R-CA for the 5 Rockies parks | D |
| LT-2 | P2 and P3: 46 places | 4.5 | Sonnet, Opus | LT-1 | E |
| LT-3 | P4: 30 places, the trail promotion | 3.5 | Sonnet, Opus | LT-2; TRK-1 for trail tracks | E |
| LT-4 | P5: 39 places | 3 | Sonnet, Opus | LT-3 | E |
| LT-RAT | Remaining promotions, final budget write, Opus cross-family sample | 1.5 | Opus | LT-4 | E |

**Data hours: 27**, in data seat 1: **D 11** (LT-WHERE 3, LT-1 6, the P0 and P1 share of LT-AP 2), inside window D's
spare of about 15.5 h left after S2-C (DATA-PLAN 2.4.4); **E 16** (LT-AP rest 3.5, LT-2, LT-3, LT-4, LT-RAT), inside E's
spare of about 34 h. **Code hours: 14** (LT-C 7 in D, LT-M 7 in E), counted as Infra in the builder lanes. First batch:
**LT-C, then LT-WHERE, then LT-1** (the 8 trip-tied places and the 32 in the Rockies regions).

### 9.1 Brief: LT-C (Opus builder)

- **Goal.** The contract of 5: a stored address, `osm_ref` that can be `searched_none`, link kinds that count, families and
  the ratchet gate, all gap-neutral at landing.
- **Owns.** `core/src/schema/capture/properties.ts`, `core/src/schema/capture/records.ts`, `core/src/schema/capture/typesFile.ts`,
  `core/src/capture/engine.ts`, `core/src/capture/resolve.ts`, `core/src/capture/triggers.ts`, `core/bin/capture.ts`,
  `data/vocab/types.json` (family keys and phase-1 marks only), `tools/locations.py` (basics layers, drift report), the tests
  under `core/test/capture/` and `tools/tests/`, generated files rebuilt by `capture.ts build` and the schema export
  (`data/schema/**`, `research/types/**`), and `research/method/capture-contract.md` 3.4, 3.7.1, 3.7.2.
- **Must not touch.** `web/**`, any record or sidecar under `data/capture/<lane>/`, `data/suitability/`, `data/relevance/`,
  `data/locations/locations.json`, `data/capture/gap-budget.json` counts, `legacy/**`.
- **Steps.** (1) Add the registry row of 5.1 and the `Address` schema; (2) `osm_ref` reader takes a string or a `Val`;
  (3) per-kind link keys from `links.R` minus `official`; (4) the two triggers; (5) `family` on every category and the two
  domains, with a test; (6) `gaps --family` and `gaps --promote`; (7) phase-1 marks; (8) `capture.ts build`; (9) basics
  report layers and `W_LOC_POINT_DRIFT`; (10) the contract text: the park point role is `centre`, address and link rules.
- **Acceptance.** `gaps --budget --check` passes with every count unchanged; a test pins `W_TIER_REQUIRED.keys` before and
  after; `gaps --promote address --family stay` prints the expected count and exits 1; a planted category without a family
  fails; the registry exposure test passes (address: api detail, mcp public, no list row); `capture.ts build --check` clean.
- **Verification.** `pnpm -C core typecheck` (tsc), `pnpm -C core test`, `python3 -m pytest tools/tests`,
  `bash tools/check-all.sh`; no UI, so no screenshots.
- **Commit.** `core(LT-C): address, osm_ref Val, link-kind tier keys, families and the promotion gate`; add only owned
  paths with `git -C <worktree> add <paths>`; end with the Co-Authored-By trailer.

### 9.2 Brief: LT-M (Sonnet builder)

- **Goal.** Show what LT-C stores where the decision is made (8), with no new list data.
- **Owns.** `web/components/places/PlacePage.tsx` (Directions card and links), `web/components/map/PointLinks.tsx`,
  `web/lib/map/links.ts` (OSM URL from `osm_ref`), `web/lib/public/**` read-model fields for `address` and `osm_ref`,
  `core/src/export/ics.ts`, `core/src/export/csv.ts`, the print stylesheet rule for the day sheet, their tests and e2e
  specs.
- **Must not touch.** `core/src/schema/**`, `data/**`, `web/app/themes.css` (colour only through tokens), list-row
  allowlists.
- **Steps.** Address line (postal as written; nearest road as "Near ..."); official map link; OSM link; ICS `LOCATION` and
  `GEO`; CSV column; API detail and MCP field through the exposure map; empty states say "Address not recorded yet" only in
  Detail, never at rest (P2 markers rule).
- **Acceptance.** Lake Louise shows the address of its car park; a museum shows its own; a place without one shows
  coordinates only; the ICS of a dated copy carries `LOCATION` and `GEO`; place-size budget within S2D-SIZE's limit;
  privacy test passes (no link-only platform name in page text).
- **Verification.** `pnpm -C web typecheck` (tsc), `pnpm -C web test`, the place e2e specs; Playwright screenshots of a
  trail, a park, a museum and a lake place page at 1440 and 390, light and dark, into `web/test-results/shots/`; then
  travel-design-reviewer, then travel-verifier.
- **Commit.** `web(LT-M): address and map links on place pages, print, ICS and CSV`; owned paths only; Co-Authored-By
  trailer.

Research batches use [briefs/DATA.md](../build/public-site/briefs/DATA.md) and
[DATA-AGENT-PROMPTS.md](../build/public-site/briefs/DATA-AGENT-PROMPTS.md) with the scope of their row, section 6 here, and
one writer at a time on `points.json`, `gap-budget.json` and the lane files.

## 10. Supersedes and refines

| Page | What changes |
|---|---|
| [capture-contract.md](../../../research/method/capture-contract.md) 3.7.2 | the proposals "AllTrails as R?" and "`links.R`: official, osm" are replaced by D4, D5 (AllTrails R with `found_in_search`, OSM through `osm_ref` R); note added there |
| capture-contract 3.7.1 | the park default role "entrance" is corrected to `centre`, with the arrival through access points (D2); LT-C edits the text |
| [park-page/data-map.md](../design/park-page/data-map.md) row "Directions target" | the target is the park's entrance or visitor-centre access point, not the park's own point; note added there |
| [briefs/DATA-LOC.md](../build/public-site/briefs/DATA-LOC.md) 2 | refined, not superseded: the basics tier gains the address and the family link sets; its rule "nothing that does not fit an existing column or capture property" holds (the address is a capture property) |

## 11. Owner questions

| ID | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q-LT1 | Require the AllTrails page (or a dated "none found") on every trail, found by a search and never fetched? | **Yes** | about 2 minutes per trail; a direct link avoids wrong-trail searches |
| Q-LT2 | Natural places show the address of their car park or trailhead, and a nearest-road address from OpenStreetMap where no postal address exists, marked "Near ..."? | **Yes** | a nearest-road address is approximate by nature; it is labelled so |
| Q-LT3 | Required fields arrive per family only after that family is filled (the ratchet), never by raising the gap budget? | **Yes** | some families stay at A for weeks; the budget never fails |

## 12. Gotchas

- `exposeOf` says ICS never carries a property (public trips are dateless). `address` overrides it for the dated copy
  only; a public trip's ICS does not exist.
- The ledger pins every pre-migration leaf: stored `osm` links stay, and `osm_ref` stays a bare string on old records.
- Nominatim allows single lookups at one a second with caching; bulk geocoding of large lists is discouraged. 211 lookups
  are fine; the gazetteer waves (DC-W0, DC-W1) must not reuse Nominatim for addresses at country scale (use Geofabrik
  extracts there).
- The store's coarse `kind` is not a family: "place" (14) and "region" (5) need the type chosen in the batch.
- A new access-point record for a store place is a new record: its required tier errors from the first write, so LT-AP
  fills it fully before committing.
- Three Rockies park points differ by 15 to 29 km between the store and the record; do not "fix" the record to the store's
  centroid.

## 13. As built (LT-C, 28 Oct 2026)

Where the build differs from sections 5 and 9.1:

| Item | As built | Why |
|---|---|---|
| Phase-1 `address` marks | A on `culture.museum`, `culture.heritage`, `culture.under`, `animals.see`, `water.thermal`, `water.swim`, `stay.*`, `food.*`, `access.start`, `access.park`, `access.transit`, `access.amenity`, the natural place categories (`nature.protected`, `nature.garden`, `nature.viewpoint`, `nature.summit`, `nature.landform`, `nature.wildlife`, `water.body`, `water.falls`) and the D2 door places outside 4.3 to 4.5 (`play.playground`, `play.amusement`, `snow.ski`); N on `settlement`. None on `nature.trail` and `nature.trek` | `address` lives on the place layer only, so a mark on a route-only category is refused by the matrix check K9; a trail's address is its trailhead's. The 5.4 table counts playgrounds, amusement parks and ski bases as door places, so they need the A mark before their promotion |
| `pageTask: "LT-M"` on the registry row | the generated public contract (`data/schema/capture/<domain>.json`) leaves the `address` marks out until LT-M; the engine, `fields`, `gaps` and `research/types` count them | an A gap is drawn by the web's section loop as a closing word at rest ("Not checked yet: ..., address") on every place page, a new empty marker and new bytes, against 0 and the LT-M rule "never at rest". LT-M removes the key when it draws the address (one line in `properties.ts`) |
| Per-kind link keys at landing | one type lists a kind other than `official` in `links.R`: `nature.trek.trek_stage.hut_stage` (`booking`); no record has that type, so no count moved (a test pins it) | finding 2b assumed every `links.R` is `["official"]` |
| `access.pass` family | `park` (4.2 lists the requirement offers at the park) | the category holds lift passes and shuttle seats too; a later split is a one-key change |
| ICS | `address` is the only property with `ics` in its exports (the override of 12 Gotchas); `core/src/export/ics.ts` is LT-M's | |
| Validator | `core/src/validate/capture.ts` holds `address` and an `osm_ref` Val to the Val rules (a `searched_none` needs `on` and `tried`), and warns `W_CAP_NA_FIELD` for an address where the type never asks it (a town) | the brief's file list missed the validator |
| Drift report | 0 places today: the three Rockies parks of 2 d2 differ by 15 to 29 km but their record role is `centre`, which D8 leaves out | |

## Change log

| Date | Change |
|---|---|
| 2026-10-28 | LT-C built (Opus 5.5, branch `lt/LTC`): section 13 records where the build differs (phase-1 marks list, `pageTask`, the hut-stage link kind, `access.pass` family, validator). Status line unchanged otherwise |
| 2026-10-28 | First version (travel-planner, Opus 5.5): verdicts (a) to (f), D1 to D8, nine families with required fields, the registry diff and the ratchet, the procedure per family, the plan for the 155 store places (LT-C, LT-M, LT-WHERE, LT-AP, LT-1 to LT-4, LT-RAT), product surfaces, Q-LT1 to Q-LT3. BACKLOG 15.391; DATA-PLAN 2.5 |
