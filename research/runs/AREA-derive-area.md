# AREA: area_id derived from the parent or the sourced point (25 Oct 2026)

Lane AREA, builder, model Opus 5.5. Command: `node core/bin/capture.ts derive-area [--check|--write] [--trip <id>] [--accuracy]`
(capture contract 3.7.1). Ledger of what it wrote: `data/capture/derived-areas.json`. Thresholds: `core/src/config/area.ts`.

## The rule

1. An `area_id` the step did not write (not in the ledger, or different from its entry) is authored and never touched.
2. The parent (the ref a `part/` was cut out of, `part_of`, `starts_at`, `at`), when every parent with an area names one area.
3. The point (the record's own, or a route's start). Labels: the records with an authored area and an exact point, and the
   locations store's places. The nearest label within 10 km; every other area's nearest label at least twice as far (the winner's
   distance read as at least 0.5 km); the area's region equal to the region of the record's `near_town` (a region the store lacks
   fails); and that town one of the area's label towns, or its own point falls to the same area by the same test.

A derived area never labels another record. The registry has no area outlines, so the radius is the only fence against land the
registry does not hold: the nearest known point outside Banff National Park (Canmore, the Grassi Lakes) is 12 km from a Banff label,
Kootenay's Marble Canyon 15.6 km. At 15 km the rule put four Canmore and Kananaskis trails in Banff; at 20 km it also took Yoho and
Kootenay. The town test alone does not stop Canmore at 15 km (Canmore's own point is 14.4 km from a Banff label).

## Measured accuracy (the 67 records with an authored area_id)

The brief expected about 117 known records; the store had 67 (Rockies 27, Dolomites 34, Utah 6). Each authored area hidden, then
derived; precision is the share of the rule's answers that equal the authored area, coverage the share of all 67.

| Hold-out | Answered | Match | Precision | Coverage |
|---|---|---|---|---|
| the record alone (parents and siblings keep theirs) | 56 | 55 | 98.2% | 82.1% |
| the record and its family (`part/<ref>#x` with `<ref>`) | 44 | 43 | 97.7% | 64.2% |

The one confusion: `place/viel-dal-pan` is authored `IT/veneto/belluno`; the rule says `IT/trentino-alto-adige/provincia-di-trento`
(nearest label Sass Pordoi, 1.4 km; nearest town Canazei, Trentino). The hut stands on the Trentino side of the ridge, so the authored
value may be the one to check. The gate (`--write` refuses under 95% family precision) passed. The frozen copy is
`core/test/fixtures/derive-area/known-2026-10-25.json`.

## Written (49 records; E_PLACE_AREA 277 to 228)

| Trip | Place and route | Had an area | From a parent | From the point | Unresolved |
|---|---|---|---|---|---|
| canadian-rockies-2029 | 163 | 27 | 2 | 20 | 114 |
| dolomites-2027 | 68 | 34 | 4 | 11 | 19 |
| utah-five-parks | 25 | 6 | 3 | 8 | 8 |
| vermont-fall-2026 | 6 | 0 | 0 | 1 | 5 |
| iceland-ring-road-2027 | 29 | 0 | 0 | 0 | 29 |
| patagonia-2027 | 26 | 0 | 0 | 0 | 26 |
| chamonix-mont-blanc-2028 | 21 | 0 | 0 | 0 | 21 |
| algonquin-muskoka-2026 | 6 | 0 | 0 | 0 | 6 |

Unresolved by reason: no registry area within 10 km 217, between two areas without a clear margin 7, nearest town outside the area 2,
region of the nearest town differs 1, no point 1 (Lac du Chatelard, D1b decision 1).

Spot-checked against the map: the 22 Rockies records are all inside Banff National Park, the Utah ones match their counties except
Bryce (below), Vermont's Stowe path is Lamoille County, and 14 of the 15 Dolomites records sit in the area given. Two known limits:

- **Rifugio Scotoni** got `IT/veneto/belluno` from the Lagazuoi tunnels label 2.9 km away; the hut is on the Alta Badia side
  (South Tyrol). A border case the radius cannot see without outlines.
- **Bryce** (Navajo Loop and its payoff, Bryce Amphitheatre rim, Sunset Point: 4 records plus 1 part) got `US/UT/kane-county`, because
  the locations store files its Bryce place under Kane County. The amphitheatre is in Garfield County. When the store is corrected,
  `derive-area --write` moves the five with it (the ledger names the store as their label).

## Proposals (points no registry area reaches; owner decision, then the `location` skill)

Grouped by the region of the nearest town (`derive-area` prints the live list):

| Region | Records | What the points are (by eye) |
|---|---|---|
| CA/AB (in the store) | 67, plus most of the 24 with no town within 50 km | Jasper National Park, Kananaskis Country (Canmore, Peter Lougheed, Spray Valley), Waterton Lakes National Park, Castle and Beauvais Lake provincial parks, the Icefields Parkway north of Banff |
| CA-BC (not in the store) | 23 | Yoho, Kootenay and Mount Robson parks; Elk Lakes and Top of the World provincial parks; Golden |
| FR Auvergne-Rhone-Alpes (not in the store) | 17 | Chamonix valley (and 3 records in CH Valais: Vallorcine side, Emosson) |
| AR Santa Cruz, Tierra del Fuego, Buenos Aires; CL (not in the store) | 21, plus 5 with no town | El Chalten and Los Glaciares, Ushuaia and Tierra del Fuego National Park, Buenos Aires |
| IS, every region (not in the store) | 19, plus 10 with no town | the ring road |
| IT/trentino-alto-adige (in the store) | 11 | Alpe di Siusi, Val Gardena, Dobbiaco, San Candido, Carezza: Bolzano province, but no Bolzano label lies within 10 km with a clear margin |
| CA-ON (not in the store) | 6 | Algonquin and Muskoka |
| US/VT and US/UT (in the store) | 7, plus 6 with no town | Caledonia and Franklin counties (VT); Capitol Reef, Goblin Valley, Calf Creek, Salt Lake City, Moab town, Dead Horse Point (UT) |
