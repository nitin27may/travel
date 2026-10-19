# CS7 batch 2: trip pins, Rockies stops, and rows that need a code change

Read on 19 Oct 2026 by travel-researcher (Opus). Dolomites tracks are in [CS7b-dolomites-tracks.md](CS7b-dolomites-tracks.md).
API calls: run record `data/capture/runs/api-2026-10-19-cs7b-overpass.json` (Overpass 19 requests, 11 of them 502 and retried, no
429; Wikidata 12). Every point is "agent checked, needs a person's check".

## 3.41 Trip pins for the five "Area only" trips

No data file feeds the trips map a base point: `tripPin` in `web/lib/public/globe.ts` takes the first base, then a place or gazetteer
city named like the first word of the legacy `region` ("Muskoka & Algonquin", "Niagara", "Rincón", "Switzerland", "Lofoten"), and none
of those match. The points below are researched and ready; wiring them is a code change (hand-back).

| Trip (legacy folder) | Pin | lat, lon | Source | Why this point |
|---|---|---|---|---|
| algonquin-muskoka-oct-2026 | Dwight (base area, Lake of Bays) | 45.33099, -79.0115 | OSM node 1485292613 (place=locality, wikidata Q1521274) | the trip's one base; `bases.config.json` holds a township centroid for Dwight from Nominatim, which this node replaces |
| niagara-day-aug-2026 | Niagara Glen Nature Centre (first stop) | 43.12922, -79.06 | OSM way 272966214; reserve Q7023713 P625 43.1294, -79.0595 | the plan's base is the household's home town, never a pin; the Glen is the first stop and the subject of the day |
| costa-rica-feb-2027 | Hotel Hacienda Guachipelín (first base, Rincón de la Vieja) | 10.75208, -85.37965 | OSM node 360010114 (tourism=hotel) | the plan's pick for the first base |
| norway-summer | Svolvær (first base) | 68.23333, 14.56667 | Q145948 P625 ("town in Vågan Municipality, Norway") | first of the ten bases |
| switzerland-2027 | Lucerne (first base) | 47.0523, 8.3059 | Q4191 P625 ("city at Lake Lucerne") | first of the three bases |

## 3.35 Rockies stops

27 itinerary stops got OSM points in `data/capture/points.json` (trailhead lots, docks, gondola base stations, rental points), so
`relevance.ts points --build` now holds 247 points. The Jasper SkyTram lower station was told from the upper one by distance to the
Whistlers summit (Q22701843). Left as gaps: the elk rut and dark-sky outings (no single place), and Kinney Lake (no OSM lot is
named for the Berg Lake trailhead). Inserted plan entries (groceries, the Sunshine gondola, Saskatchewan Crossing) have no capture
ref and so no point.

**Bases.** The schedule's base coordinates (`data/schedules/canadian-rockies-2029.json`) carry no source. Wikidata P625 for the same
towns is in `data/relevance/inputs/points.json` `towns`. Banff and Jasper agree within about 100 m. Two do not: Kananaskis Village
(schedule 50.936, -115.145; Q6360620 50.91748, -115.1474, about 2 km apart) and Lake Louise (schedule 51.4254, -116.1773, the
hamlet; the relevance town 51.41167, -116.22806 sits by the lake, about 4 km west, so its QID is likely the lake's, to check). The timeline should read the towns' points (hand-back); the Calgary
airport base has no Wikidata or OSM point on record yet.

## 3.17 Moraine Lake Plan B

The data is already there: the Moraine Lake suitability record (`R2a.json`) holds `access_season` "via shuttle" with the Parks
Canada rule (`official_rule`). The relevance record's `access_cost` is `[]`, and its note says the shuttle lives in the access season.
`plan_b` in `core/src/relevance/derive.ts` reads only `access_cost`, so it never sees the shuttle. Filling `access_cost` would remove
the pre-migration leaf `access_cost.v=[]` and fail the ledger test. Fix (hand-back): derive treats an access season by shuttle with a
booking window as `shuttle_only` for Plan B.

## 3.18 Sentinel Pass

The place exists since batch 1 (`part/.../larch-valley-sentinel-pass#sentinel-pass`, OSM node 2706106443) and the route `reaches` it.
S6's "takes its badge from it" needs the route's draw to move to the pass, which the ledger blocks (same as the Tre Cime draw).

## 3.19 Cavell Meadows

Re-sourced: an R7 lane record (lane CS7b) supersedes the migrated one with Parks Canada's figures (Trail 42, moderate, 6-7 km return, 500 m).
Parks Canada also says Cavell Road stays closed for the 2026 season. The other link-only "Row note" texts (Lake Annette, Mary
Schaffer, Rockwall) sit in `migrated.json` records that R2a lane records already supersede.

## 3.22 Rockies trip notes

Both sentences are in `legacy/canadian-rockies-sept-2029/data/itinerary.json` (day 1 track C, the Yoho day track B), which this lane may
not edit, and the schedule file has no note override for a track. Proposed wording for whoever edits the source:
- "A young child's body clock is still about 2 h ahead, so expect a crash around 19:00 local time (INFERENCE)."
- "The Burgess Shale Mt Stephen hike is age 8+, so not for younger children."

## 3.25 Hidden facets

Mostly an adapter gap, not a data gap. 76 of the 86 trail lane records already hold `ext.trail.shape`, and 21 of 24 lake records
hold `walk_m`, yet the facets read 0. Nothing in `web/lib` fills `FacetRow.shape` (hand-back). Real data gaps: dogs (17 of 86 trails),
lake toilets (10 of 24) and swimming facts (1 of 24). Parks Canada's leash rule is park-wide ("dogs must be on a leash that measures
3 metres or less") but it also says some trails ban dogs without listing them on the hiking pages, so a park-wide "leash" was not
stored per trail. South Tyrol's nature-park dog rules were not found on an official page (searched_none). Culture and lift facets were
not reached.

## 3.39, 3.40 and 3.36

See the commits for the Track and Tower grade conflict (Ontario Parks says moderate) and the Tre Cime toll, Braies P4 and Lavaredo
re-reads. 3.40 was tried and reverted: renaming the capture record to "Scout Lookout (Angels Landing chains view)" dropped the trail's
effort and age from the Utah tags, because the public adapter joins them by the capture name. The public item name comes from the
prototype snapshot. The rename needs the join to use the ref first (hand-back).
