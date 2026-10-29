# LT-1: the 8 trip-tied places and the 32 Rockies store places, to the family sets (28 Oct 2026)

Batch LT-1 of [location-type-requirements.md](../../docs/v2/features/location-type-requirements.md) 7.2 and 9 (DATA-PLAN 2.5).
Branch `lt/LT1` (worktree `travel-wt/LT-LT1`, from `main` deb66d7b). Agent travel-researcher, model Opus 5.5. Not pushed.
Run record: [data/capture/runs/lt1-2026-10-28-rockies-places.json](../../data/capture/runs/lt1-2026-10-28-rockies-places.json).
Reports: [lt1-2026-10-28-rockies-places/](lt1-2026-10-28-rockies-places/) (placement, family tier and promotion gate after the run).
Starting point: the LT-WHERE proposals ([report](../reports/lt-where-2026-10-28.md)); every proposal used here was confirmed against
OSM by id (Overpass), Wikidata and the land manager's page before it became a value. Lane files: `data/capture/catalogue/LT1-ca.json`,
`data/suitability/catalogue/LT1-ca.json`, `data/relevance/catalogue/LT1-ca.json`. No lane prose file: the catalogue lane has no trip
folder in `research/trips/`, so this note is the prose.

## Result

| | before | after |
|---|---|---|
| Of the 40 places, with a capture record | 13 | 40 |
| Basics fields missing over the 40 (`locations.py basics --report`) | 276 | 74 (elevation and photo for most; photos are D5c) |
| New capture records | | 44: 27 places, 16 car parks, 1 welcome centre |
| New suitability records / relevance records | | 27 / 28 |
| Records of the 40 at Usable or better | 12 (Dolomites draft) | 39 (Dolomites still draft: access point) |
| Catalogue lane, required tier | 106 places complete | 150 of 150 places complete (`gaps --tier required --trip catalogue`) |
| Placement of the new records | | 0 without area, point or nearest town; 0 approximate |
| Gap budget | E_PLACE_AREA 23, W_TIER_REQUIRED 382 records / 3,659 keys | E_PLACE_AREA 21, W_TIER_REQUIRED 382 / 3,658 (written with `--budget --write`; nothing raised) |

The budget fell, never rose: every new record was written complete for its type (each R key a value or a dated `searched_none`),
the Dolomites gained its official link (one key), and two Rockies trail records got an area from `derive-area` because the new
car parks are labels near them (ptarmigan-cirque, rockwall-lookout).

## Per place

Status is the engine level after the run (`capture.ts fields --ref`). "usable_partial" means every required key is answered and some
answers are dated `searched_none`.

| Place | Type | Record | Level | Done this run | Needs review / not found |
|---|---|---|---|---|---|
| White Mountain NF (P0) | forest | existing | usable | run_by USDA Forest Service; conditions (alerts) and map_sheet links; closures: Lincoln Woods Trail closed Jun to Nov 2026, Sawyer River Road closed since Dec 2023 | Lincoln Woods lot address not stored (Nominatim answers a trail) |
| Dolomites (P0) | nature_reserve | existing | draft | official link (Fondazione Dolomiti UNESCO); osm_ref relation/2139488; conditions and map_sheet dated searched_none | no access point: a serial site of nine systems (decision below); run_by held back (below) |
| Arches NP (P0) | national park | existing | usable | run_by NPS; conditions and maps links; closures searched_none (alerts load by script); visitor-center lot address (nearest road) | |
| Bryce Canyon NP (P0) | national park | existing | usable | as Arches; lot address postal "UT-63, Bryce 84764" from the NPS directions page | |
| Canyonlands NP (P0) | national park | existing | usable | as Arches; closures: Grand View Point remodel, late summer to early fall 2026 | |
| Zion NP (P0) | national park | existing | usable | as Arches; closures searched_none (the Narrows rule is noted) | lot address not stored (Nominatim answers a trail) |
| Lake Louise (P0) | lake | existing | usable | osm_ref relation/18238904; Lakeshore parking address (Lake Louise Drive) | |
| Stowe (P0) | town | existing | usable | nothing needed: official, tourism board, osm_ref and GeoNames were already in | |
| Banff NP | national park | existing | usable | map_sheet (2026 visitor guide with the park map); visitor centre address | entry rules are PA-R-CA's (unchanged) |
| Jasper NP | national park | existing | usable | map_sheet (points of interest PDF); information centre address | |
| Yoho NP | national park | existing | usable | map_sheet (park map PDF); visitor centre address (Trans-Canada Highway, Field: Parks Canada) | |
| Kootenay NP | national park | existing | usable | map_sheet (2026 points of interest PDF); visitor centre address (Main Street East, Radium Hot Springs: Parks Canada); osm_ref corrected (conflict below) | |
| Kananaskis Country | conservation area | existing | usable | map_sheet (KC maps library); visitor centre address (Highway 40: Alberta Parks) | osm_ref: no boundary element (held back, below) |
| Spray Valley PP | provincial park | new | usable | identity, boundary osm_ref, run_by Alberta Parks, map_sheet (2019 South Spray and Peter Lougheed map), access through the Wedge Pond car park (an Alberta Parks Spray Valley day use) | conditions page searched_none (the advisories URL is an empty shell) |
| Mount Robson PP | provincial park | new | usable | identity, boundary osm_ref, run_by BC Parks, park map PDF, Welcome Centre access record | covers_areas held back (below); conditions searched_none (advisories load by script) |
| Beauvais Lake | lake | new | usable | lake, Beaver Creek day-use car park (Range Road 15) | best_time, stroller, wheelchair searched_none |
| Ashlar Ridge | mountain | new | usable | the view from the Sulphur Skyline (8.8 km, 700 m, 4-6 h), Miette Hot Springs car park with the mid-October to mid-May road closure | OSM peak: three nodes share the name; the nearest one to Wikidata was taken (person to confirm) |
| Athabasca Glacier | glacier view | new | usable | barriers and crevasse warning, Toe of the Glacier trail (1.8 km, 60 m), Glacier Road car park | car park address searched_none (unnamed Glacier Road) |
| Curly Phillips Boathouse | historic site | new | usable | 2027 season (28 May to 10 Oct, operator), hours searched_none, no admission (our reading), access via the Maligne Lake car park | osm_ref: no OSM element (held back, below) |
| Maligne Lake | lake | new | usable | lake facts, accessibility (paved 300 m), Spirit Island boat-only, access via the existing Maligne Lake car park | a second page exists for the same lake: `maligne-lake-and-spirit-island` (trip record); a person decides `same_place_as` |
| Mount Edith Cavell | mountain | new | usable | **Cavell Road closed for the whole 2026 season** (closure on the place and the car park), caribou closure 1 Nov to 15 May, Path of the Glacier 800 m, upper car park | same-place pair with the trip's `mount-edith-cavell-and-cavell-meadows` |
| Mount Kerkeslin | mountain | new | usable | seen from the Athabasca Falls path (150 m), falls car park | |
| Barrier Lake | reservoir | new | usable | day use 1 May to 14 Oct, lookout hike, car park | address answer is 253 m away and OSM names the district "Kananaskis Village" (flagged in the note) |
| Burstall Lakes | lake | new | usable_partial | Burstall Pass day use (50 places, pit toilets) | trail distance and time not published (searched_none) |
| Highwood Pass | pullout | new | usable | Canada's highest paved road, Highway 40 open 15 Jun to 30 Nov, Highwood Meadows car park | |
| Mount Lawrence Grassi | mountain | new | usable | seen from the Grassi Lakes day use; bear warning since 10 Jun 2026 | |
| Paddy's Flat | valley (a riverside flat) | new | usable | campground season 30 Apr to 13 Oct, 96 sites, water not drinkable | type: Wikidata says "plain"; also a campground (the stay batch) |
| Upper Kananaskis Lake | lake | new | usable | Upper Lake day use year-round, access via the named North Interlakes car park | the Upper Lake lot itself is not named in OSM |
| Mount Blakiston | mountain | new | usable | seen from the Entrance and Red Rock parkways (May to late October), Red Rock Canyon car park | **height conflict**: Parks Canada 2,940 m, Wikidata and OSM 2,910 m (both kept) |
| Upper Elk Lake | lake | new | usable_partial | wilderness rules, hazards, park map PDF, Elk Lakes trailhead car park | distance to the upper lake and the season not published |
| Sinclair Canyon | gorge | new | usable | Highway 93 through the canyon, Juniper / Sinclair trail 6 km, pull-out | |
| Mount Robson | mountain | new | usable | 3,954 m, seen from the Welcome Centre | |
| Whiteswan Lake | lake | new | usable_partial | gravel road and truck hazards, wind, no cell, Home Basin car park | car park address and the season not published |
| Chancellor Peak | mountain | new | usable | seen from the Trans-Canada Highway (Wikipedia, paraphrased) | **height conflict**: 3,280 m (OSM, Wikidata) against 3,266 m (Wikipedia, Wikidata); no access record (a roadside view) |
| Yoho Valley | valley | new | usable | Yoho Valley Road mid-June to mid-October, vehicles over 7 m reverse, Takakkaw Falls car park, park map | |
| Jasper | town | new | usable | municipality and Tourism Jasper links, GeoNames 6354954 | |
| Kananaskis Village | village | new | usable | Alberta Parks page as official, GeoNames 5989106 | tourism board searched_none |
| Waterton Park | village | new | usable | Parks Canada map page, watertontourism.com, GeoNames 6176887 | |
| Golden | town | new | usable | Town of Golden, Tourism Golden, GeoNames 5962582 | |
| Field | village | new | usable | field.ca, GeoNames 5952555 | tourism board searched_none |

Access records added (each with an OSM point, `parks_for`, the official day-use or park page and an address or a dated
`searched_none`): Miette Hot Springs, Toe of the Glacier, Mount Edith Cavell upper lot, Athabasca Falls, Barrier Lake day use,
Burstall Pass, Highwood Meadows, Grassi Lakes, Paddy's Flat group camping, North Interlakes, Beaver Creek, Red Rock Canyon, Elk Lakes
trailhead, Sinclair Canyon pull-out, Home Basin, Takakkaw Falls, and the Mount Robson Welcome Centre. Two existing car parks of the
Rockies trip now also park for catalogue places (Maligne Lake for the lake and the boathouse; Wedge Pond for Spray Valley).

## Sources (read 28 Oct 2026, one request at a time per host)

Parks Canada (Jasper, Waterton, Yoho, Kootenay and Banff pages and PDFs: the Jasper day hiking guide 2026, maps), Alberta Parks (day-use
pages of Upper Lake, Burstall Pass, Highwood Meadows, Barrier Lake, Beaver Creek, Grassi Lakes, Wedge Pond, Paddy's Flat, the park
pages and the Kananaskis maps library), BC Parks (Mount Robson, Elk Lakes, Whiteswan Lake), NPS (conditions, maps, Bryce directions),
USDA Forest Service (White Mountain alerts, maps), Fondazione Dolomiti UNESCO, the Municipality of Jasper, Tourism Jasper, the Town of
Golden, Tourism Golden, watertontourism.com, field.ca, Pursuit (Maligne Lake rentals). Open data: Wikidata (3 calls), Overpass (7 calls:
one 400 and two 502s retried), Nominatim reverse (31 lookups at zoom 17 and 16), the OSM API (1, the history of relation 7707395), English
Wikipedia introductions (2 calls, paraphrased only). Every stored URL was fetched again at the end (108 URLs, all 200 or 206; four
redirects replaced by their target). User agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`; caches under
`tools/.cache/lt1/` (gitignored). Overpass and Nominatim ran under `/tmp/travel-overpass.lock` and `/tmp/travel-nominatim.lock`.
Not used: Google, Apple, Bing, AllTrails, Tripadvisor, booking sites. Rows of the Rockies lane R2a (read 18 Oct) are reused for the
Takakkaw Falls path facts and say so in their titles.

## Licence notes

- `osm_ref` values, OSM points and every address from Nominatim or Overpass are ODbL-1.0; each address note says "Licence odbl
  (OpenStreetMap contributors, R-ODbL-2)" and the source rows are published as "OpenStreetMap contributors (ODbL)".
- Wikidata values (QIDs, P625 points, GeoNames ids, heights) are CC0.
- Wikipedia (CC BY-SA) is paraphrased only (Chancellor Peak's roadside view); no sentence is copied.
- Official pages: facts and short quotes under 120 characters only; summaries are our own words.
- No photos (D5c).

## Rulings and conflicts (nothing picked silently)

- **Kootenay osm_ref.** The record held relation/7707395, which Wikidata's P402 also names. The OSM API history shows the relation was
  deleted on 3 May 2026 (version 17) after it had been cut to one outer way; way/673733022 now carries the boundary tags and the QID.
  The record now holds way/673733022 as a Val with relation/7707395 kept in `conflicts` (source: Wikidata P402); the OSM link follows.
- **Heights.** Mount Blakiston 2,940 m (Parks Canada) against 2,910 m (Wikidata P2044, OSM ele). Chancellor Peak 3,280 m (OSM, one
  Wikidata value) against 3,266 m (Wikipedia, the other Wikidata value). Both kept in `altitude_m.conflicts`.
- **Ashlar Ridge** has three OSM peak nodes of that name along the ridge; the one nearest the Wikidata point is stored, flagged.
- **Visitor-centre house numbers left out.** Banff (224 Banff Avenue), Jasper (500 Connaught Drive) and Kootenay (7556 Main Street
  East) are stored as their street only (`nearest_road`): the privacy detector's street-address rule (`core/src/privacy/detect.ts`
  STREET_ADDRESS) reads any "number + Street" line as a household planning note, and three such lines raised the normaliser budget
  (W_NORM_PRIVACY 2 to 5). See Decision 2.
- **Curly Phillips Boathouse price** is a value of 0 with basis `our_inference`: the operator sells rentals from it and names no
  admission. `not_applicable` was tried first; the page model draws it as "Not checked yet: price", which says the opposite.
- **Barrier Lake** is typed `water.body.pond_reservoir` (Wikipedia: a reservoir built in 1947); Upper Kananaskis Lake stays a lake.
- **Mountains are typed `nature.landform.mountain`**, not `nature.summit`: the visit is the view from a road or a trail, never the
  climb. Their access record is where the view is (the falls path, the Welcome Centre, the Red Rock Canyon lot).

## Held back, and why

1. **Two `searched_none` osm_refs** (Curly Phillips Boathouse, Kananaskis Country). `core/test/capture/location-types.test.ts`
   "every stored osm_ref still parses and reads" expects every stored osm_ref to read as an element id, so a dated `searched_none`
   (which the contract allows since LT-C) fails it. The searches are in the run record. Decision 3.
2. **Mount Robson Provincial Park `covers_areas`.** With it, the Rockies trip's Mount Robson stop becomes a member and the trip summary
   gains "Entry not checked yet for Mount Robson Provincial Park" (`web/tests/data/booking-refs.test.ts` pins one such line). That is
   the honest state until a protected-area task reads BC Parks fees; the area link should land with that task (W_PARK_AREA reminds).
3. **Dolomites `run_by`.** A run_by on a record of a `migrated.json` breaks `core/test/capture/migration.test.ts` (run_by only on
   offers there). The Fondazione Dolomiti UNESCO is the authority of the World Heritage property; it was not added to operators.json.

## Sample check of 10 values (re-read in the cached pages at the end)

| # | Value | Source | Result |
|---|---|---|---|
| 1 | Highwood Meadows day use season 15 Jun to 30 Nov | Alberta Parks Highwood Meadows page | pass |
| 2 | Barrier Lake day use season 1 May to 14 Oct | Alberta Parks Barrier Lake page | pass |
| 3 | Paddy's Flat 13.2 km west of Bragg Creek, season 30 Apr to 13 Oct | Alberta Parks campground page | pass |
| 4 | Cavell Road closed for the 2026 season | Parks Canada Mount Edith Cavell page | pass |
| 5 | Sulphur Skyline 8.8 km return, 700 m, 4-6 h | Jasper day hiking guide 2026 | pass |
| 6 | Toe of the Athabasca Glacier 1.8 km return, 60 m, 1 h | same guide | pass |
| 7 | Mount Blakiston 2,940 m | Parks Canada Waterton scenic drives | pass |
| 8 | Mount Robson 3,954 m | BC Parks Mount Robson | pass |
| 9 | Yoho Valley Road closed mid-October to mid-June | Parks Canada Yoho points of interest | pass |
| 10 | Maligne Lake season 28 May to 10 Oct 2027 | Pursuit rentals page | pass |

10 of 10. The same agent wrote and checked them; a second reader should look first at the `our_inference` age bands, the estimated
`walk_m` and `on_site_min` values (flagged `estimate`), the three flagged addresses and the two height conflicts.

## Promotion gate (no promotion made: every gate exits 1)

| Family, key | Records of the family | Would add (before, at deb66d7b) | Would add (after) |
|---|---|---|---|
| park `osm_ref` | 40 to 42 | 11 | 10 |
| park `run_by` | | 22 | 17 |
| park `links.conditions` | | 35 | 29 |
| park `links.map_sheet` | | 40 | 29 |
| park `address` | | 29 | 31 |
| sight `osm_ref` | 167 to 187 | 116 | 116 |
| sight `address` | | 159 | 178 |
| town `osm_ref` | 47 to 52 | 28 | 28 |
| town `links.tourism_board` | | 31 | 31 |
| access `address` | 83 to 100 | 80 | 69 |
| access `osm_ref` | | 10 | 10 |

The new records add no unanswered key to any gate except `address` on parks and natural sights: D2 gives a park or a natural sight
no address of its own when an access point carries one, but the gate counts the record's own `address`. Decision 4.

## DECISIONS NEEDED

1. **Towns layer anchors (coordinator, needs the 27 Oct GeoNames cache).** Six new points lie more than 5 km from every anchor
   (Ashlar Ridge, Paddy's Flat car park, Whiteswan Lake and Home Basin, Chancellor Peak, Yoho Valley), so `tools/tests/test_towns.py`
   fails. The fix is `python3 tools/towns.py build` with the cached dump of 27 Oct (a fresh download would change the dump date in
   every near_town note), then `node core/bin/capture.ts derive-near --check`. This worktree has no cache and the main checkout was not
   touched.
2. **Addresses against the privacy detector (LT-M or LT-C).** STREET_ADDRESS flags every postal address of a public place. Before
   any door-place promotion (museums, stays, visitor centres all have house numbers) the detector needs to exempt `address.v.lines`
   of public records, or the normaliser budget rises with each address.
3. **osm_ref `searched_none` (builder).** `location-types.test.ts` should skip osm_refs whose state is not `value`; then the two held-back
   searches can be stored.
4. **Address promotion on parks and natural sights.** `gaps --promote address` counts the record's own address; per D2 the answer is
   the access point's. Either the gate reads the access point, or `address` stays A on those categories for good.
5. **Same place, two pages.** Store places Maligne Lake and Mount Edith Cavell have new records beside the Rockies trip's
   `maligne-lake-spirit-island` and `mount-edith-cavell` records (two slugs already existed for each). A person decides whether one
   takes `same_place_as` the other.
6. **Dolomites access point.** No single entrance exists; the planner decides whether the region keeps `access_points` as a gap or
   names the Cortina information office.
7. **Pre-existing, not this batch:** at deb66d7b `relevance.ts derive --check` already failed (canadian-rockies-2029 and catalogue
   out of date after DG2F). Re-deriving fixes the check and makes `web/tests/data/relevance.test.ts` "drops a pointer whose target is
   the record's own part_of parent" fail: the Moraine lakeshore's derived part_of is now the canoe offer and its far pointer is 0.5 km
   away (the same result on a clean deb66d7b). Also failing on a clean tree: `core/test/drive/keys.test.ts` (home refusal),
   `web/tests/data/legs-home-radius.test.ts` and `web/tests/places/tracks-adapter.test.ts`.

## Checks run (end of branch)

Clean: `validate.ts --all` (0 errors), `capture.ts run --check` on the run record, `capture.ts build --check`, `gaps --budget --check`,
`derive-near --check`, `derive-area --check`, `graph.ts build --check`, `suitability.ts check`, `relevance.ts check`,
`relevance.ts derive --check`, `relevance.ts points --build --check`, `sources.ts check`, `normalise.ts --budget --check`,
`locations.py validate` and `build --check`, `towns.py --check` (manifest), `snapshot:check` (after `pnpm --dir web snapshot`),
`tools/gate/check_map.py`, `tools/tree_check.py --check`, `tools/cons/hardcode_scan.py --check`, core `tsc`, core vitest
capture, schema, plan and schedule (1,272 passed), web `tsc`, web place-size test on a real build (median 1.2027, largest 1.2050,
unchanged from deb66d7b; no page over its cap). The checks that need the household point ran with a placeholder in the environment of
the command only; no home point was written anywhere. The P0 place pages changed by at most 1.032 (White Mountain NF); pages of places
this run did not touch differ from the deb66d7b build only in the build id.
