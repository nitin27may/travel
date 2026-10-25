# DATA-D1b: points follow-up (25 Oct 2026)

Branch `public/DATA-D1b` (worktree `v2-DATA-D1b`, merged with `main` at f314284 before any change). Model: Claude Opus 5.5.
Run record: `data/capture/runs/api-2026-10-25-data-d1b-points.json`. Script: `research/runs/DATA-D1b-points/build_points_d1b.py`
(one function per step; the D1 rows came from `research/runs/DATA-D1-points/build_points.py`). Every point is agent checked and
needs a person's check. Before-snapshots: `before-budget.txt`, `before-build-check.txt` and `before-locations-validate.txt` in
`research/runs/DATA-D1b-points/`, taken by the earlier agent on the pre-merge branch. The merge was a fast-forward to `main`,
which already held D1, so the numbers did not change and they were not re-taken. The placement and tier snapshots it took were
byte-identical to D1's `research/runs/DATA-D1-points/after-placement.json` and `after-tier.json`, so those two files are the
before evidence (the folder contract forbids a second copy); my after-snapshots sit beside the script.

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
| `W_PLACE_POINT` (records with no point) | 6 | (filled in at the end) |
| Approximate points | 41 | |
| Points in `data/capture/points.json` | 179 | |

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
places, then area centres. 26 were replaced in this step and 2 more in steps 4 and 6 (Fanes payoff, Cameron Lake), so **28 of 41
are now sourced single points and 13 stay approximate** with a note. Several D1 points were not just vague but at the wrong place: Bear's Hump (1.1 km), the two Elk Lakes trails (4.6 km), Lussier Hot Springs (2.9 km); the trail rows that held the destination lake instead of the trailhead (Lillian, Crypt, Capri) were 3.4 to 5.1 km from the start.

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
| 22 | Lago di Braies walk | first vertex of an unconfirmed track | the map board on the north shore, 8 m away | OSM; a loop has no single start |
| 23 | Red Rock Parkway (drive, adventure) | the canyon at the end | the start on Highway 5 | Parks Canada driving page |
| 24 | Chamonix market | town centre | Place du Mont Blanc | Haute-Savoie tourism markets page |
| 25 | Whiteswan Lake and Lussier Hot Springs | the park point | **the spring**, 2.9 km away (the record's type is a hot spring) | OSM, Wikidata agree |

Kept approximate (13), each with its note: Bow Valley Parkway cycling (moved to the parkway's east end; the gate is not mapped and
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
| `place/val-fiscalina` | Talschlusshutte / Rifugio Fondovalle at the valley head | OSM way 96096595 46.651378,12.353867 (the route's official link is the hut's site, and the stored confirmed track `data/tracks/fiscalina.json` ends 18 m from it); type `stay.mountain.hut` or `nature.viewpoint.viewpoint` | centre | not set on the parent (an `E_PLACE_AREA` row); `IT/trentino-alto-adige/bolzano` by the trip's other Sesto places |
| `place/vallunga` | the head of the flat valley floor | the stored confirmed track `data/tracks/vallunga.json` ends at 46.576247,11.804518 (cut at the destination); Wikidata Q1408786 (the valley) 46.574321,11.797771 is 550 m down-valley; the research names no single end point ("to the hut at the valley bottom") | centre, `approx` | not set on the parent; `IT/trentino-alto-adige/bolzano` |

**Federa:** confirmed. `part/place/lago-federa#walk` points at `place/lago-federa` (the lake, Wikidata Q3825692, which has a
point), so the destination exists. But the walk names the lake in `starts_at`, not `reaches`: the walk would read as starting at
the lake. Its own point is the track's first vertex at the trailhead 2.8 km north-west of the lake. Proposal for the record
owner: move `place/lago-federa` from `starts_at` to `reaches` on the walk (a relation fix, not a point).
