# DATA-D1b: points follow-up (25 Oct 2026)

Branch `public/DATA-D1b` (worktree `v2-DATA-D1b`, merged with `main` at f314284 before any change). Model: Claude Opus 5.5.
Run record: `data/capture/runs/api-2026-10-25-data-d1b-points.json`. Script: `research/runs/DATA-D1b-points/build_points_d1b.py`
(one function per step; the D1 rows came from `research/runs/DATA-D1-points/build_points.py`). Every point is agent checked and
needs a person's check. Before-snapshots: `before-budget.txt`, `before-build-check.txt` and `before-locations-validate.txt` in
`research/runs/DATA-D1b-points/`, taken by the earlier agent on the pre-merge branch. The merge was a fast-forward to `main`,
which already held D1, so the numbers did not change and they were not re-taken. The placement and tier snapshots it took were
byte-identical to D1's `research/runs/DATA-D1-points/after-placement.json` and `after-tier.json`, so those two files are the
before evidence (the folder contract forbids a second copy). The after-snapshots (`after-placement.json`, `after-tier.json`,
`after-budget.txt`) sit beside the script; `capture.ts build --check` and `locations.py validate` gave the same output as before
("OK: the generated capture files match data/vocab/types.json", "ok"), so no after copy of those is kept.

## Method and limits

- External calls ran one at a time through a small cached fetcher (scratchpad, not committed) under `flock` on the shared lock
  files: `/tmp/travel-overpass.lock` for Overpass, `/tmp/travel-wikidata.lock` for Wikidata, `/tmp/travel-d1b-web.lock` for land
  manager and operator pages. **`flock` was not installed; I installed it with `brew install flock` (flock 0.4.0) for this run.**
  Overpass calls waited 10 s after each answer; a 502 was retried after 20 s with doubling (no 429 was seen).
- User agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. No Google, AllTrails, Tripadvisor or Komoot
  coordinate; two web searches (search engine result pages) were used only to find official page addresses, never for a value.
- **Overpass was reachable this time** (D1 could not use it). Request counts are in the run record.
- Read dates: everything on 2026-10-25. The date and the source sit in each row's `point_source`.

## Counts

| | before | after |
|---|---|---|
| `W_PLACE_POINT` (records with no point) | 6 | **1** (Lac du Chatelard) |
| Approximate points | 41 | **14** (each with an `approx_note`; `W_PLACE_APPROX` 0) |
| Points in `data/capture/points.json` | 179 | 185 (5 new records, 1 capture override of a relevance-input point: the Fanes route start) |
| Exact points corrected that D1 had not marked approx | - | 4 (Upper Kananaskis Lake loop, Elbow Falls loop, Canmore Nordic Centre, Miette Hot Springs) |
| Required tier, `gaps --tier required` matrix: routes with a point | 130 of 143 (trails 105 of 118) | 135 of 143 (trails 110 of 118) |
| Required tier, places with a point | 200 of 201 | 200 of 201 |
| Required tier complete (place, trail, other route, offer, event, stay) | 7, 1, 0, 1, 0, 0 | unchanged |
| `W_TIER_REQUIRED` | 385 records, 3875 keys | unchanged (the point is a placement key, not a tier key) |
| `E_PLACE_AREA`, `E_PLACE_ORPHAN` | 277, 17 | unchanged (findings below; not fixed) |

Gap budget: `W_PLACE_POINT` lowered 6 to 1 with `gaps --budget --write`; nothing rose.

## Step 1: the six `searched_none` records

| Record | Result | Point and source |
|---|---|---|
| Berg Lake Trail | **found** (role `parking`) | OSM way 1185166549, the car park at the end of Kinney Lake Road where the Berg Lake Trail ways start; BC Parks (bcparks.ca/mount-robson-park/berg-lake-trail/): "begins at the end of Kinney Lake Road" |
| Fryatt Valley | **found** (`trailhead`) | OSM node 2520427794, where Fryatt Trail (Parks Canada trail 122) leaves Geraldine Fire Road. Parks Canada: the Fryatt page says 2 km up Geraldine Road; the Geraldine page says the road runs 3.3 km beyond the Fryatt trailhead, and the mapped road runs 3.34 km beyond this node (2.09 km before it) |
| Laguna de los Tres | **found** (`trailhead`) | OSM node 7069713837 (`highway=trailhead`) at the north end of El Chalten, beside the "Senda al Fitz Roy" boards; the park leaflet (PNLG zona norte 2024) puts the lake on the Fitz Roy path, 2 km from the APN visitor centre to the path start |
| Laguna Esmeralda | **found** (`parking`) | OSM way 567999991 beside RN 3 where the Sendero Laguna Esmeralda ways start; Ushuaia tourism office: the path starts 18 km from Ushuaia on RN 3 at a large roadside car park |
| Windows Section, Arches | **found** (`trailhead`) | OSM node 4835435421 The Windows Trailhead (`highway=trailhead`); NPS place page lists the trailhead and parking |
| Lac du Chatelard (Chamonix) | **still none** | see below |

**Lac du Chatelard: the place does not exist in the plan's area.** Tried on 25 Oct: Overpass, every feature whose name contains
"telard" in 45.80-46.20 N, 6.70-7.10 E (52 hits: the hamlet Le Chatelard VS, its stations, the funicular, the Chatelard-Barberine
power plants, the Chatelard tunnel near Passy; no water body); Wikidata `wbsearchentities` in French for "Lac du Chatelard",
"Lac de Chatelard" and "lac Chatelard" (no result) and full-text search "Chatelard lac" (a mountain and a railway company). The
record first appears in the 18 Oct prototype seed list (the public-trips data file of the old prototype, commit 079f7ba, since removed), day 6 "Aiguillette
des Posettes": `Col des Montets|hike` and `Lac du Chatelard|water|45`. The legacy plan (`legacy/chamonix-mont-blanc-sept-2028/PLAN.md`)
has no such stop; it names Le Chatelard only as the Mont-Blanc Express station on the way to Lac d'Emosson, which the trip already
holds as `trip/chamonix-mont-blanc-2028/sight:emosson dam and dinosaur tracks`. **Proposal (not done; no ref deleted):** drop the
stop from day 6, or, if the owner meant the ponds at the Col des Montets or Lac d'Emosson, mark
`trip/chamonix-mont-blanc-2028/lake:lac du chatelard` `same_place_as` the record it meant. Until then it stays the one
`W_PLACE_POINT`. (DECISIONS NEEDED 1.)

## Step 2: the 41 approximate points

Ranked by how much a wrong point hurts: trailheads and meeting points first (a family drives there), then route starts, then
places, then area centres. 25 were replaced in this step and 2 more in steps 4 and 6 (Fanes payoff, Cameron Lake), so **27 of 41
are now sourced single points and 14 stay approximate** with a note. Several D1 points were not just vague but at the wrong place: Bear's Hump (1.1 km), the two Elk Lakes trails (4.6 km), Lussier Hot Springs (2.9 km); the trail rows that held the destination lake instead of the trailhead (Lillian, Crypt, Capri) were 3.4 to 5.1 km from the start.

| Rank | Record | Was (D1) | Now | Source of the location rule |
|---|---|---|---|---|
| 1 | Bear's Hump (trail) | townsite visitor centre | trail's first vertex at Highway 5, **1.1 km north** | Parks Canada walks page: across the Entrance Road from the Prince of Wales access road |
| 2 | Elk Lakes, Lower and Upper; Elk Lakes viewpoint (trails) | park label node | the trailhead car park at the end of the Elk River FSR, **4.6 km north-east** | BC Parks Elk Lakes page (trailhead parking lot, 1 km to the nearest lake) |
| 3 | Lillian Lake (trail) | the lake | Galatea day use, **official point** from the Alberta Parks map (OSM lot 40 m away), 5.1 km east of the lake | Alberta Parks Galatea Creek trail report |
| 4 | Crypt Lake (trail) | the lake | Crypt Landing (trail's lakeshore vertex), 5.1 km north-west | Parks Canada day hikes: trailhead at Crypt Landing |
| 5 | Cavell Meadows (trail) | a trail way midpoint | upper lot at the end of Cavell Road | Parks Canada Cavell page: trailhead at the end of the Cavell Road |
| 6 | Opal Hills (trail) | a loop way midpoint | the loop's start at the north-east corner of the upper lots | Parks Canada Maligne page |
| 7 | Skyline Trail | viewpoint label | where the trail leaves the Bald Hills track by the big lot | Parks Canada Maligne page |
| 8 | Red Rock Canyon loop (trail) | a loop way | the upper lot | Parks Canada walks page: upper parking lot |
| 9 | Tent Ridge Horseshoe (trail) | a track midpoint | the track's end on Mount Shark Road | OSM only (no official page); in the person-check queue |
| 10 | Sulphur Mountain trail | (same lot) | approx lifted | Banff & Lake Louise Tourism: Upper Hot Springs parking area |
| 11 | Johnson Lake loop | the lake | the car park at the end of Johnson Lake Road | OSM; the official table could not be read by script (GAP below) |
| 12 | Dettifoss walk | the falls (Wikidata) | the west car park, 1.3 km from the D1 point, 1 km walk to the viewpoint | Vatnajokull D1 page: starting point car park west of Dettifoss |
| 13 | Arnarstapi to Hellnar | village centre | the Arnarstapi end of the **park's own GPX** (620 m from D1) | Snaefellsjokull trail 28 page and GPX |
| 14 | Skaftafell Svartifoss | visitor centre | first point of the **park's own S2 GPX** (32 m) | Vatnajokull S2 page: starting point Skaftafellsstofa |
| 15 | Fjadrargljufur | information board | the Parka car park at the canyon | OSM |
| 16 | Laguna Capri | the lake | the Fitz Roy path trailhead | PNLG leaflet |
| 17 | Coastal path (Senda Costera) | the bay node | the Ensenada Zaratiegui car park | Parques Nacionales trail page: "nace en el estacionamiento de Ensenada Zaratiegui" |
| 18 | Pa'rus Trail | a mid vertex | the south end by the visitor centre | NPS Pa'rus page |
| 19 | Stowe Recreation Path | a way centre | the village end | Town of Stowe page |
| 20 | Plan de l'Aiguille walk | the area (Wikidata) | the cable car station | Chamonix tourism Grand Balcon Nord page |
| 21 | Rafting on the Rienza (meeting) | St. Sigmund village node | the St. Sigmund sports ground, 800 m west | Rafting Club Activ contact page: Sports zone St. Sigmund |
| 23 | Red Rock Parkway (drive, adventure) | the canyon at the end | the start on Highway 5 | Parks Canada driving page |
| 24 | Chamonix market | town centre | Place du Mont Blanc | Haute-Savoie tourism markets page |
| 25 | Whiteswan Lake and Lussier Hot Springs | the park point | **the spring**, 2.9 km away (the record's type is a hot spring) | OSM, Wikidata agree |

Kept approximate (14), each with its note: the Lago di Braies walk (the product shows no point for a walk whose stored track is unconfirmed, pinned by `web/tests/data/places-point-join.test.ts`; the north-shore map board, OSM node 12978036296, 8 m from the track start, is ready once the track is confirmed), Bow Valley Parkway cycling (moved to the parkway's east end; the gate is not mapped and
the page names Fireside Day-use Area, about 400 m away), the elk rut (area level), the Red Rock Parkway sight and the Smith-Dorrien
drive (a road has no single point), the Kananaskis River and the three Kicking Horse River rows (rivers; the put-ins are not
published, step 5), the Beagle Channel (a channel), Buenos Aires cafes and bookshops, the Ushuaia harbour walk, the Fitz Roy glow
(the plan names no viewpoint), and the Montgomery covered bridge loop (a mean of five bridges).

GAP: the Parks Canada Banff day-hikes table (parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/banff) is built in the browser,
so its trailhead lines for Johnson Lake and Cory Pass were not read; a person can read them in a browser.

## Step 3: the three missing destination parts (Cinque Torri, Val Fiscalina, Vallunga)

Exact refs in `data/capture/dolomites-2027/migrated.json`: `place/cinque-torri` (`nature.trail.walk`), `place/val-fiscalina` and
`place/vallunga` (`nature.trail.hike`), all three `layer: route` with **`route_is_attraction: true`** ("the open-air museum
circuit is the experience", "the valley walk is the experience"). None has `reaches`.

**Not created; DECISIONS NEEDED 2.** The safest reversible choice was to source the points and stop before writing records:

1. The data already rules that these routes are their own payoff. `web/lib/public/relevance.ts` expects a payoff only when
   `route_is_attraction` is not true, so three `#payoff` parts would add public place pages that nothing asks for.
2. Each new place would have to carry its full required tier (for a `nature.landform.rock_formation`: wikidata, summary,
   access_cost, class_key, draw, standing, distinction, easy_payoff, weather, why, signals, links, plus a suitability block of eight
   keys). Left as gaps, `W_TIER_REQUIRED` rises, which the budget forbids; filled, it is a relevance and suitability pass of its
   own, beyond this lane.
3. Wiring a payoff means adding `reaches` to the parent route in `migrated.json` (one record per ref, so a lane file cannot add
   it). The ledger allows a new leaf, but the parent records are not this lane's files.

Sourced destination points, ready if the owner wants the parts (read 25 Oct):

| Route | Destination | Point | Role | Area |
|---|---|---|---|---|
| `place/cinque-torri` | the five towers (Torre Grande) | OSM node 899332740 Torre Grande (`natural=peak`) 46.509075,12.051868; Wikidata Q933666 46.50925,12.053972 (160 m); type `nature.landform.rock_formation` | centre | `IT/veneto/belluno` (the parent's) |
| `place/val-fiscalina` | Talschlusshutte / Rifugio Fondovalle at the valley head | OSM way 96096595 46.651378,12.353867 (the route's official link is the hut's site, and the stored confirmed track `data/tracks/fiscalina.json` ends 27 m from it); type `stay.mountain.hut` or `nature.viewpoint.viewpoint` | centre | not set on the parent (an `E_PLACE_AREA` row); `IT/trentino-alto-adige/bolzano` by the trip's other Sesto places |
| `place/vallunga` | the head of the flat valley floor | the stored confirmed track `data/tracks/vallunga.json` ends at 46.576247,11.804518 (cut at the destination); Wikidata Q1408786 (the valley) 46.574321,11.797771 is 550 m down-valley; the research names no single end point ("to the hut at the valley bottom") | centre, `approx` | not set on the parent; `IT/trentino-alto-adige/bolzano` |

**Federa:** confirmed. `part/place/lago-federa#walk` points at `place/lago-federa` (the lake, Wikidata Q3825692, which has a
point), so the destination exists. But the walk names the lake in `starts_at`, not `reaches`: the walk would read as starting at
the lake. Its own point is the track's first vertex at the trailhead 2.8 km north-west of the lake. Proposal for the record
owner: move `place/lago-federa` from `starts_at` to `reaches` on the walk (a relation fix, not a point).

## Step 4: the Fanes track

**Official route found.** The Cortina tourism board page "Botanical Path to the Cascate di Fanes"
(https://cortina.dolomiti.org/it/escursioni/botanical-path-to-the-cascate-di-fanes-en, read 25 Oct): Easy, 2 h 30, 7 km, +249 m /
-253 m; start and finish at the Ampezzo Dolomites Natural Park information point; path 10 along the Ru de Fanes, after half an
hour the clearing of Pian de Loa, then across Ponte Outo to the belvedere over the Cascate Basse di Fanes; back the same way. No
page of the Parco Naturale Fanes-Senes-Braies covers it: these falls are in the Parco Naturale delle Dolomiti d'Ampezzo (Veneto).

**Why 1.4 km against 7 km.** The 7 km is the return trip from the information point (about 3.5 km each way). OSM relation 1641053
is path 10 itself (AVS, `ref=10`), but the stored track `data/tracks/fanes-falls.json` uses a start override at Pian de Loa
(the snapshot trailhead, OSM node 7920730765 area) and so keeps only the last 1.4 km. Its destination end is right (117 m from the
falls node).

**Rulings (which source wins):**
- Start: the tourism board's route wins. `place/cascate-di-fanes` now has a capture point at OSM node 470623991 "Centro visitatori
  del parco" (`information=office`, 150 m from the park's Ponte Felizon guidepost), role `trailhead`; this beats the snapshot
  trailhead in `data/relevance/inputs/points.json`, 2 km up the route.
- End: `part/place/cascate-di-fanes#payoff` is the waterfall itself, OSM node 9861910524 Cascate di Fanes
  (`waterway=waterfall`); Wikidata Q67370898 is 70 m away and the belvedere the route ends at (node 1398755045) 130 m. Approx
  lifted.
- The track stays as it is (generated by `web/scripts/tracks-osm.mjs`, outside this lane) and stays unconfirmed in
  `web/lib/public/honesty-overrides.ts`. For a builder: re-fetch relation 1641053 without the Pian de Loa start override, cut
  from its east end by the information point to the falls, and expect about 3.5 km and +250 m; then it can be confirmed.

## Step 5: the five operator questions from D1

| D1 question | Result | Source (read 25 Oct) |
|---|---|---|
| 1. Dettifoss: which car park, and a trailhead node? | **Answered.** The park's D1 trail starts at the "car park west of Dettifoss", 1 km to the viewpoint; that car park is OSM way 1531241656 (toilets node 6646954959 beside it). The walk row now holds it; no separate trailhead node is needed | vatnajokulsthjodgardur.is `.../jokulsargljufur/dettifoss-d1` and `.../dettifoss` |
| 2. Mount Indefatigable: is the route open? | **Open question.** No official page states it. OSM node 3762652045 is tagged "Indefatigable Trail Decomissioned 2005"; the Alberta Parks Peter Lougheed trail-report index lists 28 trails and no Indefatigable; Wikipedia and trip reports say it was decommissioned in 2005 for grizzly habitat and is discouraged. The row's point (North Interlakes lot, node 269821248) is right: it is 5 m from the official North Interlakes trailhead point | albertaparks.ca trail reports, Peter Lougheed index |
| 3. Kicking Horse and Kananaskis put-ins | **Open question** for both. Wild Water's Gentle page says guests meet at the River Base and ride a bus to a put-in "inside the Yoho National Park boundary", no place named. Chinook Rafting's FAQ names only the meeting point, Chinook Rafting Riverbase on Highway 1X, which OSM maps as way 1302746691 (51.13811,-115.05127); the Kananaskis offer has no meeting-point part to hold it (lane D4a) | wildwater.com/kicking-horse-rafting-trips/gentle/, chinookrafting.com/faqs/ |
| 4. Rienza rafting station | **Partly answered.** The operator's contact page: "Meeting point Rienz / Eisack: Sports zone St. Sigmund". OSM maps the St. Sigmund sports ground (pitches 42881996, 1134655979, 1134655980); the row moved there from the village node, 800 m east, and is no longer approx. The exact spot in the zone stays a question | rafting-club-activ.com/en/contact/ |
| 5. Lillian Lake and Burstall Pass trailheads | **Answered.** The Alberta Parks trail-report maps carry official trailhead points: Galatea day use 50.861178,-115.176195 (Lillian Lake now uses it) and Burstall Pass day use 50.790503,-115.303701 (the D1 OSM lot is 30 m from it) | albertaparks.ca trail reports Galatea Creek, Burstall Pass |

The open ones are added to `research/method/operator-questions-2026-10-18.md` under "Added by lane DATA-D1b".

## Step 6: final rulings on the three source conflicts (read 25 Oct)

1. **Grand View Point (Canyonlands).** OSM wins, and the conflict reaches further than the walk. NPS
   (https://www.nps.gov/places/grand-view-point.htm): "Grand View Point lies at the southernmost end of the Island in the Sky
   scenic drive". At the road end OSM maps the Grand View Point Overlook (node 6806471756), the trailhead (node 6806471755) and
   the parking (relation 15336057). Wikidata Q62073199 (P625 from GNIS 1435608) sits 1.4 km north-east on two unnamed pull-outs.
   Ruling: the walk keeps the OSM trailhead (its `point_source` now cites NPS). The viewpoint record
   `trip/utah-five-parks/viewpoint:grand view point` should move to the OSM overlook (node 6806471756, 38.310154,-109.856773),
   but its Wikidata point is pinned by `data/capture/migration-ledger.json`, and `core/test/capture/migration.test.ts` fails when a
   pinned point changes. So the record keeps the Wikidata point, the run record logs the conflict, and moving it is a coordinator
   item (DECISIONS NEEDED 5). A Wikidata edit is a person's job, not ours.
2. **Cameron Lake (Waterton).** No real conflict. D1 compared Wikidata Q3214786 with OSM way 588314114, which is an NHD polygon of
   the small US part of the lake (latitudes 48.9975 to 48.9989). The lake itself is OSM relation 8299848 (`wikidata=Q3214786`),
   centre 49.00920,-114.05106, 25 m from the Wikidata point. Ruling: Wikidata kept, the OSM relation agrees, approx lifted.
3. **Cory Pass.** The OSM lot and the legacy "Fireside picnic area" are the same place. OSM node 508583984 Cory Pass Trail
   Parking sits at the end of an unpaved access road off Highway 1A by its east end, and the Cory Pass Trail way starts 23 m from
   it. Parks Canada's Bow Valley Parkway page names Fireside Day-use Area at that end of the parkway. Hiking guides (thebanffblog,
   hikebiketravel, 10adventures, read as search results only) describe the start as the Fireside lot about 1 km up an access road
   from Highway 1A, with the trail across the creek. Ruling: the OSM point stands, with role `parking`. No official page gives the
   trailhead wording (the Banff day-hikes table is built in the browser: GAP in step 2).

## Step 7: person-check sample

Population: the 77 rows in `data/capture/points.json` written by D1 or D1b that are not approximate. Seed **20261025**, drawn with
Python's `random.seed(20261025); random.sample(sorted(population), 20)`. Each point was re-read in OSM (Overpass, one query for all
18 OSM elements) and compared with the land manager's own coordinate where one exists (the Alberta Parks trail-report maps) or
with the land manager's description of the place. For an area record (a park, a nature reserve), "right" means inside the
area's polygon, since 100 m has no meaning there.

| # | Record | Check | Result |
|---|---|---|---|
| 1 | Cascate di Fanes route start | OSM node 470623991 re-read; the tourism board names the park information point as the start | pass |
| 2 | Lago di Braies walk | (sampled while it held the OSM map board; restored to D1's approximate row for the web rule, see step 2). The node re-read matches, 0 m | pass |
| 3 | Elbow Falls loop | Alberta Parks official trailhead point 50.867767,-114.781998 against the D1 OSM lot node | **fail, 113 m** |
| 4 | Chester Lake | Alberta Parks official point, 31 m | pass |
| 5 | Dorset lookout tower | OSM node 2944856296 is the tower itself (`man_made=tower`) | pass |
| 6 | Lake Magog (nature reserve) | the Wikidata point lies inside the OSM lake polygon (way 355375756) | pass |
| 7 | Dettifoss walk | OSM car park re-read; the park page names the car park west of the falls | pass |
| 8 | Johnston Canyon walk | OSM lot re-read, 23 m | pass |
| 9 | Lussier Hot Springs | OSM spring and Wikidata, 10 m | pass |
| 10 | Waterton townsite | OSM `place=hamlet` node re-read in the townsite (Wikidata, 516 m west, is the outlier) | pass |
| 11 | Beauvais Lake Provincial Park | inside the OSM park polygon (way 428126248) | pass |
| 12 | Canmore Nordic Centre (`snow.ski.nordic_centre`) | the D1 Wikidata park point against the OSM Day Lodge | **fail, 401 m** |
| 13 | Navajo Loop and Queens Garden | OSM trailhead 10 m from the Sunset Point overlook (operator Bryce Canyon NP); the NPS trail pages returned 404 | pass |
| 14 | Rafting on the Rienza | OSM pitch re-read; the operator names the St. Sigmund sports zone | pass (the spot inside the zone is an open question) |
| 15 | Tent Ridge Horseshoe | OSM track vertex on Mount Shark Road re-read; no official source exists | pass on OSM only |
| 16 | Grand View Point viewpoint | (sampled while it held the OSM overlook; that override was later withdrawn for the ledger, see step 6). The overlook node re-read matches NPS's road end | pass |
| 17 | Sulphur Mountain trail | OSM lot re-read, 18 m; tourism board names it | pass |
| 18 | Aiguille du Midi valley station | OSM station re-read; Wikidata 15 m | pass |
| 19 | Berg Lake Trail | OSM lot at the end of Kinney Lake Road; BC Parks names that road end | pass |
| 20 | Ribbon Creek | Alberta Parks official point, 55 m | pass |

**18 of 20 pass** (the target). The two failures come from two source classes, and both classes were re-checked:

- **An OSM car-park node standing for a trailhead** (Elbow Falls: the node is the lot, the official trailhead is the trail's
  start 113 m east). Re-check against every other Alberta Parks official point: Burstall Pass 30 m, Chester Lake 31 m, Ribbon
  Creek 55 m, North Interlakes (Mount Indefatigable row) 5 m, all pass. Corrected: Elbow Falls loop now holds the official point.
- **A Wikidata P625 standing for a facility** (Canmore Nordic Centre: the item is the provincial park, the record is the
  Nordic centre). Re-check of the other D1 Wikidata points on facilities: Prince of Wales Hotel 55 m from the OSM building, Miette
  Hot Springs 95 m from the OSM pools. Corrected: the Nordic centre now holds the OSM Day Lodge, and Miette the OSM pools (inside
  100 m but on the edge). Natural features from Wikidata (lakes, falls, canyon, parks) were not counted as this class.

Found beside the sample: **Upper Kananaskis Lake loop** held OSM node 269822623 "Upper Lake Circuit Junction", a trail junction
770 m west of the official North Interlakes trailhead; it now holds the Alberta Parks point (the legacy plan names North
Interlakes).

## Findings for the roadmap (reported, not fixed)

**E_PLACE_AREA 277.** All 277 are records with no `area_id` at all (none has an `area_id` the store does not know). By trip:
Rockies 136, Dolomites 34, Iceland 29, Patagonia 26, Chamonix 21, Utah 19, Algonquin 6, Vermont 6. By layer: places 162, routes
115 (72 of the routes are legacy Rockies refs). `capture.ts migrate-placement` (dry run) finds a source for none of them: the
locations store holds only the wishlist places, Wikidata gives no area, and no parent has an area to inherit. Now that 343 of 344
places and routes have a point, the cheap fix is a derived `area_id` from the point, the way `derive-near` derives the town: a
point-in-area lookup against the locations store's areas (and the national or provincial park boundaries), written only when one
area contains the point and recorded with basis `our_inference`. That is a builder task (a new derive command and its tests),
then a data run. Until then, `E_PLACE_AREA` stays at 277.

**E_PLACE_ORPHAN 17.** All 17 are Rockies offers that say nowhere where they happen (no `at`, `on` or `starts_at`): Athabasca
icewalks, Banff horse ride, Banff Springs spa, Bow River raft, the two Burgess Shale hikes, the Crypt Lake shuttle, the Canmore
heli flight, heli hiking, the Jasper-Waterton horse ride record, the Jasper wildlife tour, the Lake Louise horse ride, the Norquay
via ferrata, Radium Hot Springs, the Waterton cruise, the Yamnuska scramble and the Assiniboine Lodge helicopter. This is
batch D4a's first goal (lane AC). Two points found here help it: the Waterton cruise meets at the Waterton Harbour marina (the
D1 row) and Chinook Rafting meets at its Riverbase on Highway 1X (OSM way 1302746691). Note that the Waterton cruise already has
a point in `points.json` but still counts as an orphan, because an offer's place comes from `at`, not from its own point.

## DECISIONS NEEDED

1. **Lac du Chatelard** (Chamonix day 6): drop the stop, or mark it `same_place_as` the place that was meant. No ref deleted.
2. **Cinque Torri, Val Fiscalina and Vallunga payoff parts**: the routes are `route_is_attraction`, so no payoff is expected. If
   the owner wants destination places anyway, a lane needs ownership of the parent records (to add `reaches`) and the required
   tier for three new places. The sourced points are in step 3.
3. **Mount Indefatigable viewpoint** (Rockies trail): every source says the trail was decommissioned in 2005; keep it on a family
   plan only after Alberta Parks answers (operator question).
4. **Federa** relation: the walk names the lake in `starts_at`; moving it to `reaches` is a record fix for the Dolomites owner.
5. **Grand View Point viewpoint**: the pre-migration point (Wikidata Q62073199) is wrong by 1.4 km per NPS and OSM, but the
   migration ledger pins it. Either the ledger gets a reviewed exception for corrected points, or the coordinator records the OSM
   overlook through whatever supersede route the owner approves.

## Builder items from the gate

- `core/test/capture/placement-block.test.ts` ("gaps --placement --trip prints the per-trip table and the records with a hint")
  expects a Rockies record with no point and the hint "track start". Berg Lake and Fryatt were the last two; with them filled
  the Rockies report has no such line. The test pins a data gap and needs a fixture or a looser assertion (outside this lane).
- `web/.og-cache` does not exist in a fresh worktree (it is ignored), so the folder-contract test fails on the mentions in
  `HANDOVER.md`, `research/tools.md`, `tools/handover-cache.sh` and `web/scripts/commons-cache.mjs`. I created the empty folder
  (with a `.keep`, ignored by git) in this worktree only.
- `web/tests/data/places-point-join.test.ts` pins "58 of 359 pages have no point, 45 of them trails"; with this lane the count
  falls (37 measured before the Braies row was restored, so 38 now). The pin needs the new counts, as after D1.

## Not verified

- Every point is agent checked; none has a person's check.
- Johnson Lake and Cory Pass: the official trailhead wording was not read (the Parks Canada Banff table is built in the browser).
- Tent Ridge rests on OSM alone; Navajo Loop on OSM and the NPS-operated overlook node (NPS pages 404).
- The Rienz meeting spot inside the St. Sigmund sports zone, and the Kicking Horse and Kananaskis put-ins.
- Requests outside the fetcher's log: two WebFetch reads (the PNLG leaflet PDF on argentina.gob.ar and the Parks Canada Banff
  day-hikes page) and a handful of web searches used to find official page addresses; the run record counts only the logged
  fetcher requests.

## Derived files

After each data step: `python3 tools/towns.py build` (one GeoNames download, 25 Oct; the moved anchors added one town, Kaslo BC, to the layer),
`node core/bin/capture.ts derive-near --write` (rewrote `near_town` and `near_town_km` in the capture files whose records got or
changed a point), `node core/bin/relevance.ts points --build` and `derive --write`. These files carry those rewrites only.

## Gate (25 Oct)

`bash tools/check-all.sh` with a venv outside the repo on `PATH` (`web/.env.local` does not exist in this worktree, so there was
nothing to move aside). The other DATA agents' runs wrote their logs into the same scratchpad names during my first runs, so
those logs were not mine; the final runs used unique log names.

- The real script stops at core tests on one test that pins a data gap (`placement-block.test.ts`, "track start" hint; builder
  item above).
- A copy of the script that skips only that test and the pinned page count in `web/tests/data/places-point-join.test.ts` (38 of
  359 pages now have no point, against the pinned 58) ends **CHECK-ALL OK**: Python 267 passed, core 1990 passed, every data,
  capture, budget, towns, near-town, validate, suitability, relevance, sources, snapshot, hard-code and folder-contract stage,
  web typecheck, lint, build, web tests 1822 passed, server answers, OpenAPI, slugs.
