# Stop points of the published trips (DG-02, 28 Oct 2026)

Data batch DG-02 ([data-gaps-2026-10-28.md](../../docs/v2/design/step2/data-gaps-2026-10-28.md)): a map point for every stop of
every published trip, so a stop moved in edit mode is estimated point to point (`ScheduleItem.placePoint`, the place page's
licensed point) instead of falling back to a base-to-base guess. Run record `data/capture/runs/dg2-2026-10-28-stop-points.json`,
run note [../runs/dg2-2026-10-28-stop-points.md](../runs/dg2-2026-10-28-stop-points.md).

How the list was made: the public adapter (`createPublicData()` in `web/lib/public`) was read once, before and after, and every
item of every day variant of every public trip was listed with its plan point, its `placePoint`, and its place page's point.
A stop counts as having a point when the plan holds one (Dolomites), when it carries `placePoint` (Rockies), or, on the
summary trips, when its place page has one (the summary trips do not carry `placePoint` yet; see "Follow-ups").

## Coverage, before and after

| Trip | Stops (items over all variants) | With a point before | After | Left without |
|---|---|---|---|---|
| canadian-rockies-2029 | 91 | 64 | 66 | 25 |
| dolomites-2027 | 27 | 27 | 27 | 0 |
| chamonix-mont-blanc-2028 | 17 | 8 | 8 | 9 |
| iceland-ring-road-2027 | 29 | 21 | 21 | 8 |
| patagonia-2027 | 27 | 10 | 13 | 14 |
| utah-five-parks | 27 | 20 | 20 | 7 |
| algonquin-muskoka-2026 | 7 | 5 | 5 | 2 |
| vermont-fall-2026 | 10 | 3 | 3 | 7 |

Points stored this run (`data/capture/points.json`, `point_role: trailhead`, OSM, ODbL, agent checked, needs a person's check):

| Record | OSM element | Why this is the start |
|---|---|---|
| legacy/canadian-rockies-sept-2029/trails/sulphur-skyline | node 1936529926 | first vertex of Sulphur Skyline Trail (way 183274419) at the Miette Hot Springs drop-off loop; Parks Canada puts the trailhead at that loop |
| legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass | node 757469351 | first vertex of Larch Valley Trail (way 733820877); Parks Canada: starts just past Moraine Lake Lodge |
| trip/patagonia-2027/trail:mirador de los condores | node 660024150 | highway=trailhead, the node its `starts_at` already names |
| trip/patagonia-2027/trail:mirador de las aguilas | node 660024150 | the same trailhead: the Aguilas path branches off the Condores trail |
| trip/patagonia-2027/trail:chorrillo del salto | way 747061337 | the car park its `starts_at` names (centroid); no trailhead node within 1.5 km |

Each replaced a derived point that put the trail at its destination's Wikidata centre (`trailhead "X" at <ref>`), which the page
join rightly refuses. The place pages now draw these five pins; each grew by about 1.0 to 3.7 kB, all inside the S13 caps.

## Sample moves (Rockies, family profile, core/src/schedule/template.ts)

| Move | Before | After |
|---|---|---|
| Moraine Lake, Day 11 to Day 13 (Kananaskis) | in 1 h 45 ≈, out 1 h 15 + 1 h 10 ≈ | unchanged (it already had a placePoint) |
| Larch Valley to Sentinel Pass, Day 11 to Day 13 | drive in 2 h 20 ≈, drive on 3 h ≈; day 7 h 35 driving | 1 h 45 ≈ and 2 h 25 ≈; day 6 h 25 |
| Sulphur Skyline, Day 7 (Jasper) to Day 10 (Lake Louise) | in 5 h 10 ≈, out 5 h 35 ≈; day 11 h 35 | 4 h 20 ≈ and 4 h 45 ≈; day 9 h 55 |
| Emerald Lakeshore, Day 9 to Day 12 (both leave Lake Louise) | 10 min in, 10 min out | unchanged: no point stored (ledger, below), so the same-base local move stays |

Every moved leg stays an estimate (≈). The home point is never read: the estimates use only the two days' bases, the
stops' public points and the stored legs.

## What stays without a point, and why

| Reason | Rows | Stops |
|---|---|---|
| Logistics (transfers, airports, meals, check-ins, errands, fuel) | 28 | Rockies errands, Saskatchewan Crossing, Icefield lunch; every transfer, flight, airport, meal and campsite row of the summary trips; Vermont "Drive home" |
| Area (a town, village, street, coast road, scenic drive or loop) | 19 | Huntsville, Les Praz, Chamonix old town and market, Vallorcine, Hofn harbour, Eastfjords road, Seydisfjordur, Palermo and Recoleta, the Day 2 harbour walk, the Day 10 village and cafes, the Day 14 cafes and bookshops, Zion-Mt Carmel Highway, Byway 12, the Day 6 scenic drive, Main Street Moab, Hyde Park and Peacham villages, the covered bridge loop |
| Join gap: the stop's own record already has an OSM point, but the stop carries no place-page slug | 11 | Banff Gondola (2), Rawson Lake, Lake Minnewanka cruise, Spirit Island cruise (2), Emerald Lake canoe (2), Lake Louise canoe, Moraine Lake canoe, Ice Explorer |
| Researched, not stored: the migration ledger pins the old derived point on the ref | 4 | Iceline, Emerald Lakeshore, Lake Louise Lakeshore, Moraine Lakeshore |
| Researched, not stored: needs a towns-layer rebuild | 1 | Miette Mine Trail |
| Held back on purpose (web/lib/public/join-deferred.json) | 4 | Sarrail Ridge and Col des Montets (S13 size), Thingvellir (S13 size), Toe of the Athabasca Glacier (its row is the car park) |
| Official point the page join does not take, and S13 blocks an OSM row | 1 | Arnarstapi to Hellnar |
| Unidentified place | 1 | Lac du Chatelard (no lake of that name in the valley) |
| No record and no coordinate | 3 | Sunshine Village gondola (plan entry only), Beagle Channel boat, Minitrekking |

## Follow-ups (not data; owner or builder)

1. **Join the Rockies stops to their own records' points** (11 stops, no research needed). In `web/lib/public/timeline.ts`,
   `withPoints` reads only `pointOf(placeSlug)`; a stop whose record id is a capture record (`legacy/canadian-rockies-sept-2029/adventures/<id>`,
   `.../trails/<id>`) could take that record's own OSM point when it has no slug. That would take the Rockies to 77 of 91.
2. **Carry `placePoint` on the summary trips** (Chamonix, Iceland, Patagonia, Utah, Algonquin, Vermont). `withPoints` runs only on
   the Rockies; their 70 page points reach the route map, not the moved-stop estimate.
3. **The migration ledger pins four derived trailheads** (Iceline, Emerald Lakeshore, Lake Louise Lakeshore, Moraine Lakeshore):
   `core/test/capture/migration.test.ts` refuses any change to their relevance-input point unless a payoff place took it. The
   pinned values are derivations (`trailhead "X" at <ref>`: the lake or falls centre), not authored facts. The researched OSM
   trailheads are in the run note, ready to store once the ledger rule allows a derived point to be replaced by the record's own.
4. **Miette Mine Trail** (OSM node 2383706255): storing it adds a towns-layer anchor, and `towns.py build` re-dates every derived
   `near_town` (22 capture files). Do it with the next towns refresh.
5. **Same-base moves still take the local move.** Emerald Lakeshore moved from Day 9 to Day 12 (both leave Lake Louise) gets 10 min
   each way; `movedLegs` keeps the ladder's local move at the same base when the stop has no point and the plan stores no way.
6. **S13 is already over** before this run (median 1.2539 of 1.25, col-des-montets at 1.500; DG-11). This run moved neither figure.

Map data from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0.

## Every stop

### algonquin-muskoka-2026

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-1 | Huntsville lunch | meal | - | none: logistics: transfer, meal, check-in or airport |
| 1 | main | 1-2 | Solitaire Lake Trail | trail | solitaire-lake-trail | page point; not carried as placePoint (summary trip) |
| 1 | main | 1-3 | Dwight Beach sunset | visit | dwight-beach-sunset | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-1 | Track and Tower Trail | trail | track-and-tower-trail | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-2 | Ragged Falls | visit | ragged-falls | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-1 | Dorset lookout tower | visit | dorset-lookout-tower | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-2 | Huntsville | visit | - | none: area: a town, village, street or drive |

### canadian-rockies-2029

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | B | bear-spray-groceries | Bear spray and groceries in Banff | visit | - | none: logistics: errands |
| 1 | B | fenland-loop | Fenland Loop | trail | fenland-loop | placePoint |
| 1 | B | vermilion-lakes | Vermilion Lakes Drive | visit | vermilion-lakes-drive | placePoint |
| 1 | B | elk-rut | Elk rut viewing | visit | elk-rut-viewing-and-bighorn-rut | placePoint |
| 1 | C | banff-gondola | Banff Gondola | visit | - | none: join gap: record adventures/banff-gondola has OSM node 10809307066 and a page; the stop is not linked |
| 2 | A | sunshine-meadows-citadel-pass | Sunshine Meadows to Citadel Pass | trail | sunshine-meadows-to-citadel-pass | placePoint |
| 2 | B | sunshine-gondola | Sunshine Village gondola and the meadow paths | visit | - | none: no record: a plan entry with no capture record yet |
| 2 | B | lake-minnewanka-cruise | Lake Minnewanka cruise | visit | - | none: join gap: record adventures/lake-minnewanka-cruise has OSM way 223576165 (the dock); no page of its own |
| 2 | B | banff-upper-hot-springs | Banff Upper Hot Springs | visit | banff-upper-hot-springs | placePoint |
| 2 | C | banff-gondola | Banff Gondola | visit | - | none: join gap: record adventures/banff-gondola has OSM node 10809307066 and a page; the stop is not linked |
| 2 | C | cave-and-basin | Cave and Basin National Historic Site | visit | cave-and-basin-national-historic-site | placePoint |
| 2 | C | banff-upper-hot-springs | Banff Upper Hot Springs | visit | banff-upper-hot-springs | placePoint |
| 3 | A | bourgeau-lake | Bourgeau Lake | trail | bourgeau-lake | placePoint |
| 3 | B | johnston-canyon | Johnston Canyon | trail | johnston-canyon | placePoint |
| 3 | B | marble-canyon-walk | Marble Canyon Walk | trail | marble-canyon-walk | placePoint |
| 3 | B | paint-pots-walk | Paint Pots Walk | trail | paint-pots-walk | placePoint |
| 3 | C | marble-canyon | Marble Canyon | visit | marble-canyon | placePoint |
| 4 | A | wilcox-pass | Wilcox Pass | trail | wilcox-pass | placePoint |
| 4 | B | bow-lake | Bow Lake | visit | bow-lake | placePoint |
| 4 | B | peyto-lake-lookout | Peyto Lake Lookout | trail | peyto-lake-lookout | placePoint |
| 4 | B | saskatchewan-crossing | Early lunch and fuel at Saskatchewan River Crossing | meal | - | none: logistics: fuel, toilets and lunch |
| 4 | B | columbia-icefield-ice-explorer | Ice Explorer on the Athabasca Glacier | visit | - | none: join gap: record adventures/columbia-icefield-ice-explorer has OSM way 282985047; no page of its own |
| 4 | B | glacier-skywalk | Glacier Skywalk | visit | columbia-icefield-skywalk | placePoint |
| 4 | C | bow-lake | Bow Lake | visit | bow-lake | placePoint |
| 4 | C | peyto-lake | Peyto Lake Lookout | visit | peyto-lake-lookout-banff | placePoint |
| 4 | C | glacier-skywalk | Columbia Icefield Skywalk (Glacier Skywalk) | visit | columbia-icefield-skywalk | placePoint |
| 5 | A | bald-hills | Bald Hills | trail | bald-hills | placePoint |
| 5 | B | maligne-lake-cruise | Spirit Island cruise | visit | - | none: join gap: record adventures/maligne-lake-cruise has OSM node 4336196151 (the dock); no page of its own |
| 5 | B | mary-schaffer-loop | Mary Schaffer Loop | trail | mary-schaffer-loop | placePoint |
| 5 | B | moose-lake-loop | Moose Lake Loop | trail | moose-lake-loop | placePoint |
| 5 | B | pyramid-lake | Pyramid Lake | visit | pyramid-lake | placePoint |
| 5 | C | maligne-lake-cruise | Spirit Island cruise | visit | - | none: join gap: record adventures/maligne-lake-cruise has OSM node 4336196151 (the dock); no page of its own |
| 6 | A | kinney-lake | Kinney Lake | trail | kinney-lake | placePoint |
| 6 | B | mount-robson-viewpoint | Mount Robson Visitor Centre viewpoint | visit | mount-robson-visitor-centre-viewpoint | placePoint |
| 6 | B | overlander-falls-trail | Overlander Falls trail | trail | overlander-falls-trail | placePoint |
| 6 | B | jasper-skytram | Jasper SkyTram | visit | jasper-skytram | placePoint |
| 6 | C | mount-robson-viewpoint | Mount Robson Visitor Centre viewpoint | visit | mount-robson-visitor-centre-viewpoint | placePoint |
| 6 | C | jasper-skytram | Jasper SkyTram | visit | jasper-skytram | placePoint |
| 7 | A | sulphur-skyline | Sulphur Skyline | trail | sulphur-skyline | placePoint (new) |
| 7 | B | jasper-errands | Laundry, groceries and rest in Jasper | visit | - | none: logistics: errands |
| 7 | B | jasper-miette-mine-trail | Miette Mine Trail | trail | miette-mine-trail | none: researched, not stored: OSM node 2383706255 (the trailhead) lies 10 km from every towns-layer anchor, so storing it needs `towns.py build`, which re-dates `near_town` in 22 capture files |
| 7 | B | miette-hot-springs | Miette Hot Springs | visit | miette-hot-springs | placePoint |
| 7 | B | lake-annette-loop | Lake Annette Loop | trail | lake-annette-loop | placePoint |
| 7 | B | jasper-dark-sky | Dark-sky watching | visit | jasper-dark-sky-preserve-stargazing | placePoint |
| 7 | C | miette-hot-springs | Miette Hot Springs | visit | miette-hot-springs | placePoint |
| 8 | A | parker-ridge | Parker Ridge | trail | parker-ridge | placePoint |
| 8 | B | athabasca-falls | Athabasca Falls | visit | athabasca-falls | placePoint |
| 8 | B | sunwapta-falls | Sunwapta Falls | visit | sunwapta-falls | placePoint |
| 8 | B | toe-glacier-walk | Toe of Athabasca Glacier | trail | toe-of-athabasca-glacier | none: held back on purpose (join-deferred.json): its row is the car park 580 m from the toe |
| 8 | B | icefield-lunch | Lunch at the Icefield Centre | meal | - | none: logistics: a meal at the Icefield Centre |
| 8 | B | saskatchewan-crossing | Fuel and toilets at Saskatchewan River Crossing | break | - | none: logistics: fuel, toilets and lunch |
| 8 | C | athabasca-falls | Athabasca Falls | visit | athabasca-falls | placePoint |
| 8 | C | sunwapta-falls | Sunwapta Falls | visit | sunwapta-falls | placePoint |
| 8 | C | columbia-icefield-athabasca-glacier | Athabasca Glacier | visit | athabasca-glacier-and-columbia-icefield | placePoint |
| 9 | A | iceline-trail | Iceline Trail | trail | iceline-trail | none: researched, not stored: OSM node 2368078636; the migration ledger pins the old derived point (Takakkaw Falls) on this ref |
| 9 | B | takakkaw-falls-walk | Takakkaw Falls | trail | takakkaw-falls-walk | placePoint |
| 9 | B | emerald-lake-canoe | Emerald Lake canoe | visit | - | none: join gap: record adventures/emerald-lake-canoe has OSM node 9902888899; no page of its own |
| 9 | B | emerald-lakeshore | Emerald Lakeshore | trail | emerald-lakeshore | none: researched, not stored: OSM node 269747928; the migration ledger pins the old derived point (Emerald Lake centre) |
| 9 | B | natural-bridge | Natural Bridge | visit | natural-bridge | placePoint |
| 9 | C | takakkaw-falls | Takakkaw Falls | visit | takakkaw-falls | placePoint |
| 9 | C | natural-bridge | Natural Bridge | visit | natural-bridge | placePoint |
| 9 | C | emerald-lake-canoe | Emerald Lake canoe | visit | - | none: join gap: record adventures/emerald-lake-canoe has OSM node 9902888899; no page of its own |
| 10 | A | plain-of-six-glaciers | Plain of Six Glaciers | trail | plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint | placePoint |
| 10 | B | lake-louise-lakeshore | Lake Louise Lakeshore | trail | lake-louise-lakeshore | none: researched, not stored: OSM node 269752723; the migration ledger pins the old derived point (Lake Louise centre) |
| 10 | B | lake-louise-canoe | Lake Louise canoe | visit | - | none: join gap: record adventures/lake-louise-canoe has OSM way 128099295; no page of its own |
| 10 | B | lake-louise-gondola | Lake Louise Gondola | visit | lake-louise-summer-gondola | placePoint |
| 10 | C | lake-louise | Lake Louise | visit | lake-louise | placePoint |
| 10 | C | lake-louise-gondola | Lake Louise Gondola | visit | lake-louise-summer-gondola | placePoint |
| 11 | A | larch-valley-sentinel-pass | Larch Valley to Sentinel Pass | trail | larch-valley-to-sentinel-pass | placePoint (new) |
| 11 | B | moraine-lake | Rockpile at first light | visit | moraine-lake | placePoint |
| 11 | B | moraine-lakeshore | Moraine Lakeshore | trail | moraine-lakeshore | none: researched, not stored: OSM node 269752450; the migration ledger pins the old derived point (Moraine Lake centre) |
| 11 | B | moraine-lake-canoe | Moraine Lake canoe | visit | - | none: join gap: record adventures/moraine-lake-canoe has OSM node 2956259306; no page of its own |
| 11 | C | moraine-lake | Moraine Lake | visit | moraine-lake | placePoint |
| 12 | A | ha-ling-peak | Ha Ling Peak | trail | ha-ling-peak | placePoint |
| 12 | B | canmore-groceries | Groceries in Canmore | visit | - | none: logistics: errands |
| 12 | B | grassi-lakes-upper | Grassi Lakes | trail | grassi-lakes-easy-route | placePoint |
| 12 | B | canmore-nordic-centre | Canmore Nordic Centre | visit | canmore-nordic-centre-summer | placePoint |
| 12 | C | mount-lorette-ponds | Mount Lorette Ponds | visit | mount-lorette-ponds | placePoint |
| 12 | C | canmore-nordic-centre | Canmore Nordic Centre Provincial Park | visit | canmore-nordic-centre-summer | placePoint |
| 13 | A | sarrail-ridge | Sarrail Ridge | trail | sarrail-ridge | none: held back on purpose (join-deferred.json): the S13 median gate |
| 13 | B | interlakes-trail | Interlakes Trail (Upper and Lower Lake) | trail | interlakes-trail-upper-and-lower-lake | placePoint |
| 13 | B | rockwall-lookout | Rockwall Lookout (Rockwall fen) | trail | rockwall-lookout-rockwall-fen | placePoint |
| 13 | B | kananaskis-lakes-day-use | Upper and Lower Kananaskis Lakes | visit | upper-and-lower-kananaskis-lakes | placePoint |
| 13 | B | rawson-lake | Rawson Lake | trail | - | none: join gap: record trails/rawson-lake has OSM node 269822212 and a page; the stop is not linked |
| 13 | C | kananaskis-lakes-day-use | Upper and Lower Kananaskis Lakes | visit | upper-and-lower-kananaskis-lakes | placePoint |
| 14 | B | ptarmigan-cirque | Ptarmigan Cirque | trail | ptarmigan-cirque | placePoint |
| 14 | B | wedge-pond-loop | Wedge Pond loop | trail | wedge-pond-loop | placePoint |
| 14 | C | highwood-pass-summit | Highwood Pass and Hwy 40 corridor | visit | highwood-pass-and-hwy-40-corridor | placePoint |
| 14 | C | wedge-pond | Wedge Pond | visit | wedge-pond | placePoint |
| 15 | B | troll-falls | Troll Falls | trail | troll-falls | placePoint |
| 15 | C | wedge-pond | Wedge Pond | visit | wedge-pond | placePoint |

### chamonix-mont-blanc-2028

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-t1 | Geneva airport to Chamonix | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 1 | main | 1-2 | Les Praz village | visit | - | none: area: a town, village, street or drive |
| 2 | main | 2-1 | Lac des Gaillands | visit | lac-des-gaillands | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-2 | Chamonix old town | visit | - | none: area: a town, village, street or drive |
| 3 | main | 3-1 | Lac Blanc via Flegere | trail | lac-blanc-via-flegere | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-2 | Mont Blanc reflection | visit | mont-blanc-reflection | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-1 | Montenvers train | visit | montenvers-train | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-2 | Grotte de la Mer de Glace | visit | grotte-de-la-mer-de-glace | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-1 | Plan de l'Aiguille | trail | plan-de-laiguille | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-2 | Aiguille du Midi | visit | aiguille-du-midi | page point; not carried as placePoint (summary trip) |
| 6 | main | 6-1 | Col des Montets | trail | col-des-montets | none: held back on purpose (join-deferred.json): the page is at the S13 1.5 cap |
| 6 | main | 6-2 | Lac du Chatelard | visit | lac-du-chatelard | none: unidentified place: no lake of this name in the upper valley (suitability lane); rename or drop the stop, never guess |
| 7 | main | 7-1 | Emosson dam and dinosaur tracks | visit | emosson-dam-and-dinosaur-tracks | page point; not carried as placePoint (summary trip) |
| 7 | main | 7-2 | Vallorcine | visit | - | none: area: a town, village, street or drive |
| 8 | main | 8-1 | Chamonix market | visit | - | none: area: a town, village, street or drive |
| 8 | main | 8-2 | Cafe afternoon | meal | - | none: logistics: transfer, meal, check-in or airport |
| 9 | main | 9-t1 | Drive to Geneva airport | transfer | - | none: logistics: transfer, meal, check-in or airport |

### dolomites-2027

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | i2 | Lago di Landro | visit | lago-di-landro | plan point |
| 2 | main | i3 | Lago di Braies | visit | lago-di-braies | plan point |
| 2 | main | i4 | Val Fiscalina | trail | val-fiscalina | plan point |
| 3 | main | i5 | Tre Cime di Lavaredo loop | trail | tre-cime-di-lavaredo-loop | plan point |
| 3 | main | i6 | Cadini di Misurina viewpoint | visit | cadini-di-misurina-viewpoint | plan point |
| 4 | A | i7 | Croda del Becco | trail | croda-del-becco | plan point |
| 4 | A | i9 | Funbob, Monte Baranci | visit | funbob-monte-baranci | plan point |
| 4 | B | i8 | Drava cycle path to Lienz | visit | drava-cycle-path-to-lienz | plan point |
| 4 | B | i9 | Funbob, Monte Baranci | visit | funbob-monte-baranci | plan point |
| 5 | main | i10 | Lago d'Antorno | visit | lago-dantorno | plan point |
| 5 | main | i11 | Monte Piana | trail | monte-piana | plan point |
| 6 | main | i13 | Lago di Sorapis | trail | lago-di-sorapis | plan point |
| 7 | main | i14 | Lagazuoi cable car and tunnels | visit | lagazuoi-cable-car-and-tunnels | plan point |
| 7 | main | i15 | Rifugio Scotoni | visit | rifugio-scotoni | plan point |
| 8 | main | i16 | Rifugio Nuvolau and Averau | visit | rifugio-nuvolau-and-averau | plan point |
| 8 | main | i17 | Cinque Torri | visit | cinque-torri | plan point |
| 8 | main | i18 | Lago di Limides | visit | lago-di-limides | plan point |
| 9 | main | i19 | La Val | visit | la-val | plan point |
| 9 | main | i20 | Passo Gardena | visit | passo-gardena | plan point |
| 10 | A | i21 | Sass Pordoi and Piz Boè | trail | sass-pordoi-and-piz-boe | plan point |
| 10 | B | i22 | Viel dal Pan | trail | viel-dal-pan | plan point |
| 11 | main | i23 | Alpe di Siusi | trail | alpe-di-siusi | plan point |
| 11 | main | i24 | Bullaccia and the Witches' Benches | trail | bullaccia-and-the-witches-benches | plan point |
| 12 | main | i25 | Seceda ridge | visit | seceda-ridge | plan point |
| 12 | main | i26 | Santa Maddalena, Val di Funes | visit | santa-maddalena-val-di-funes | plan point |
| 13 | main | i27 | Adolf Munkel Weg | trail | adolf-munkel-weg | plan point |
| 13 | main | i28 | Ötzi, South Tyrol Museum of Archaeology | visit | otzi-south-tyrol-museum-of-archaeology | plan point |

### iceland-ring-road-2027

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-1 | Keflavik airport, pick up the van | visit | - | none: logistics: transfer, meal, check-in or airport |
| 1 | main | 1-2 | Blue Lagoon area lava fields | visit | blue-lagoon-area-lava-fields | page point; not carried as placePoint (summary trip) |
| 1 | main | 1-3 | Campsite Reykjavik | checkin | - | none: logistics: transfer, meal, check-in or airport |
| 2 | main | 2-1 | Thingvellir | trail | thingvellir | none: held back on purpose (join-deferred.json): S13, the page would pass +50% |
| 2 | main | 2-2 | Geysir | visit | geysir | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-3 | Gullfoss | visit | gullfoss | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-1 | Seljalandsfoss | visit | seljalandsfoss | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-2 | Skogafoss | visit | skogafoss | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-3 | Reynisfjara beach | visit | reynisfjara-beach | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-1 | Fjadrargljufur canyon | trail | fjadrargljufur-canyon | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-2 | Skaftafell Svartifoss | trail | skaftafell-svartifoss | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-1 | Jokulsarlon | visit | jokulsarlon | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-2 | Diamond Beach | visit | diamond-beach | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-3 | Hofn harbour | visit | - | none: area: a town, village, street or drive |
| 6 | main | 6-t1 | Eastfjords coast road | visit | - | none: area: a town, village, street or drive |
| 6 | main | 6-2 | Seydisfjordur | visit | - | none: area: a town, village, street or drive |
| 7 | main | 7-1 | Dettifoss | visit | dettifoss | page point; not carried as placePoint (summary trip) |
| 7 | main | 7-2 | Namaskard | visit | namaskard | page point; not carried as placePoint (summary trip) |
| 7 | main | 7-3 | Myvatn Nature Baths | visit | myvatn-nature-baths | page point; not carried as placePoint (summary trip) |
| 8 | main | 8-1 | Godafoss | visit | godafoss | page point; not carried as placePoint (summary trip) |
| 8 | main | 8-2 | Akureyri botanical garden | visit | akureyri-botanical-garden | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-1 | Glaumbaer turf farm | visit | glaumbaer-turf-farm | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-2 | Kirkjufell | visit | kirkjufell | page point; not carried as placePoint (summary trip) |
| 10 | main | 10-1 | Djupalonssandur | trail | djupalonssandur | page point; not carried as placePoint (summary trip) |
| 10 | main | 10-2 | Arnarstapi to Hellnar | trail | arnarstapi-to-hellnar | none: has an official point (park GPX), which the page join does not take (OSM or Wikidata only); an OSM row would push the page past the S13 +50% cap (1.47 now) |
| 10 | main | 10-3 | Snaefellsjokull view | visit | snaefellsjokull-view | page point; not carried as placePoint (summary trip) |
| 11 | main | 11-1 | Borgarfjordur waterfalls | visit | borgarfjordur-waterfalls | page point; not carried as placePoint (summary trip) |
| 11 | main | 11-2 | Reykjavik old harbour | visit | reykjavik-old-harbour | page point; not carried as placePoint (summary trip) |
| 12 | main | 12-1 | Keflavik airport | visit | - | none: logistics: transfer, meal, check-in or airport |

### patagonia-2027

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-1 | Palermo and Recoleta walk | visit | - | none: area: a town, village, street or drive |
| 1 | main | 1-2 | Evening parrilla | meal | - | none: logistics: transfer, meal, check-in or airport |
| 2 | main | 2-1 | Flight to Ushuaia | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 2 | main | 2-2 | Harbour walk | visit | - | none: area: a town, village, street or drive |
| 3 | main | 3-1 | Coastal path | trail | coastal-path | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-2 | Lapataia Bay | visit | lapataia-bay | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-1 | Beagle Channel boat | visit | - | none: no page and no coordinate in either sidecar (an activity offer) |
| 4 | main | 4-2 | Penguin colony stop | visit | penguin-colony-stop | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-1 | Laguna Esmeralda | trail | laguna-esmeralda | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-2 | Town dinner | meal | - | none: logistics: transfer, meal, check-in or airport |
| 6 | main | 6-1 | Flight Ushuaia to Calafate | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 6 | main | 6-t2 | Drive to El Chalten | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 7 | main | 7-1 | Mirador de los Condores | trail | mirador-de-los-condores | page point (new); not carried as placePoint (summary trip) |
| 7 | main | 7-2 | Mirador de las Aguilas | trail | mirador-de-las-aguilas | page point (new); not carried as placePoint (summary trip) |
| 8 | main | 8-1 | Laguna Capri | trail | laguna-capri | page point; not carried as placePoint (summary trip) |
| 8 | main | 8-2 | Evening Fitz Roy glow | visit | evening-fitz-roy-glow | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-1 | Laguna de los Tres | trail | laguna-de-los-tres | page point; not carried as placePoint (summary trip) |
| 10 | main | 10-1 | Chorrillo del Salto | trail | chorrillo-del-salto | page point (new); not carried as placePoint (summary trip) |
| 10 | main | 10-2 | Village and cafes | visit | - | none: area: a town, village, street or drive |
| 11 | main | 11-t1 | Drive to El Calafate | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 11 | main | 11-2 | Perito Moreno walkways | visit | perito-moreno-walkways | page point; not carried as placePoint (summary trip) |
| 12 | main | 12-1 | Minitrekking on the glacier | visit | - | none: no page and no coordinate in either sidecar (an activity offer) |
| 12 | main | 12-2 | Laguna Nimez birds | visit | laguna-nimez-birds | page point; not carried as placePoint (summary trip) |
| 13 | main | 13-1 | Flight to Buenos Aires | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 13 | main | 13-2 | San Telmo market | visit | san-telmo-market | page point; not carried as placePoint (summary trip) |
| 14 | main | 14-1 | Cafe and bookshops | visit | - | none: area: a town, village, street or drive |
| 14 | main | 14-2 | Airport | visit | - | none: logistics: transfer, meal, check-in or airport |

### utah-five-parks

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-t1 | Drive from Las Vegas | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 1 | main | 1-2 | Zion Canyon Scenic Drive by shuttle | visit | zion-canyon-scenic-drive-by-shuttle | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-1 | Angels Landing chains view or Scout Lookout | trail | scout-lookout-angels-landing-chains-view | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-2 | Riverside Walk | trail | riverside-walk | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-1 | Narrows from the Temple of Sinawava | trail | narrows-from-the-temple-of-sinawava | page point; not carried as placePoint (summary trip) |
| 3 | main | 3-2 | Pa'rus Trail | trail | parus-trail | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-t1 | Zion-Mt Carmel Highway | visit | - | none: area: a town, village, street or drive |
| 4 | main | 4-2 | Bryce amphitheatre rim | visit | bryce-amphitheatre-rim | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-3 | Sunset Point | visit | sunset-point | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-1 | Navajo Loop and Queens Garden | trail | navajo-loop-and-queens-garden | page point; not carried as placePoint (summary trip) |
| 5 | main | 5-t2 | Scenic Byway 12 | visit | - | none: area: a town, village, street or drive |
| 5 | main | 5-3 | Lower Calf Creek Falls | trail | lower-calf-creek-falls | page point; not carried as placePoint (summary trip) |
| 6 | main | 6-1 | Hickman Bridge | trail | hickman-bridge | page point; not carried as placePoint (summary trip) |
| 6 | main | 6-2 | Fruita orchards | visit | fruita-orchards | page point; not carried as placePoint (summary trip) |
| 6 | main | 6-t3 | Scenic drive | visit | - | none: area: a town, village, street or drive |
| 7 | main | 7-1 | Goblin Valley | visit | goblin-valley | page point; not carried as placePoint (summary trip) |
| 7 | main | 7-t2 | Drive to Moab | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 8 | main | 8-1 | Delicate Arch trail | trail | delicate-arch-trail | page point; not carried as placePoint (summary trip) |
| 8 | main | 8-2 | Windows section | trail | windows-section | page point; not carried as placePoint (summary trip) |
| 8 | main | 8-3 | Devils Garden | trail | devils-garden | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-1 | Mesa Arch | trail | mesa-arch | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-2 | Grand View Point | visit | grand-view-point | page point; not carried as placePoint (summary trip) |
| 9 | main | 9-3 | Upheaval Dome | trail | upheaval-dome | page point; not carried as placePoint (summary trip) |
| 10 | main | 10-1 | Dead Horse Point | visit | dead-horse-point | page point; not carried as placePoint (summary trip) |
| 10 | main | 10-2 | Main Street Moab | visit | - | none: area: a town, village, street or drive |
| 11 | main | 11-t1 | Drive to Salt Lake City | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 11 | main | 11-2 | Temple Square | visit | temple-square | page point; not carried as placePoint (summary trip) |

### vermont-fall-2026

| Day | Variant | Stop id | Stop | Kind | Page | Point status |
|---|---|---|---|---|---|---|
| 1 | main | 1-t1 | Border crossing at Derby Line | transfer | - | none: logistics: transfer, meal, check-in or airport |
| 1 | main | 1-2 | Hyde Park village | visit | - | none: area: a town, village, street or drive |
| 2 | main | 2-1 | Smugglers' Notch | visit | smugglers-notch | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-2 | Stowe Recreation Path | trail | stowe-recreation-path | page point; not carried as placePoint (summary trip) |
| 2 | main | 2-3 | Cider donut stop | meal | - | none: logistics: transfer, meal, check-in or airport |
| 3 | main | 3-1 | Covered bridge loop | visit | covered-bridge-loop | none: area: five covered bridges; the stored point is their mean (approximate), which never gives a pin |
| 3 | main | 3-2 | Cabot Creamery | meal | - | none: logistics: transfer, meal, check-in or airport |
| 3 | main | 3-3 | Peacham village | visit | - | none: area: a town, village, street or drive |
| 4 | main | 4-1 | Burke Mountain overlook | visit | burke-mountain-overlook | page point; not carried as placePoint (summary trip) |
| 4 | main | 4-t2 | Drive home | transfer | - | none: logistics: transfer, meal, check-in or airport |

## Update: DG2F (28 Oct 2026)

Run note [../runs/dg2f-2026-10-28-ledger-points.md](../runs/dg2f-2026-10-28-ledger-points.md). Follow-ups 1, 2, 3 and 5 are done; 4 (Miette Mine
Trail, towns refresh) and 6 (S13, DG-11) stay open.

- Join gap: `withPoints` (web/lib/public/timeline.ts) falls back to the stop's own capture record point (`recordPoint`, the page join's
  rule: OSM or Wikidata only, never a derived trailhead or an approximate row, never a row held back for its place). A row held back for
  size feeds the plan model, never the page.
- The four ledger-pinned trailheads are stored under the ledger's one point exception (`capture.ts ledger-point`).
- Same-base moves: a stop with no point moved to a day at the same base takes its shortest stored way from the base on its own day, else
  `MOVED_STOP_LEGS.nearOwnBaseMin`; a stop with a point reaches the day's unplaced stops through the base over the stored ways.

| Trip | Stops | With a point (DG-02) | With a point now |
|---|---|---|---|
| canadian-rockies-2029 | 91 | 66 | 82 |
| summary trips (6), carried as `placePoint` | 117 | 0 carried (70 page points) | 72 (the 70, plus Col des Montets and Thingvellir from their records) |

The nine Rockies stops left: six logistics rows, the Sunshine Village gondola (no record), Miette Mine Trail (towns refresh), the Toe of
the Athabasca Glacier (its row is the car park).

Sample moves now (family profile): Moraine Lake D11 to D13 1 h 45 ≈ in, 1 h 15 + 1 h 10 ≈ on (unchanged); Larch Valley D11 to D13 1 h 45 ≈
and 2 h 25 ≈, day 6 h 25 (unchanged); Sulphur Skyline D7 to D10 4 h 20 ≈ and 4 h 45 ≈, day 9 h 55 (unchanged); Emerald Lakeshore D9 to
D12 50 min ≈ from Lake Louise (was 10 min) and 1 h 50 ≈ on to the Canmore groceries (was 10 min), day 3 h 45 driving (was 1 h 25).
