# Run dg2-2026-10-28-stop-points: map points for the stops of the published trips

Data batch DG-02. Run record: `data/capture/runs/dg2-2026-10-28-stop-points.json`. The full list of stops, before and after,
with the reason for every stop left without a point: [../reports/stop-points-2026-10-28.md](../reports/stop-points-2026-10-28.md).

Agent: travel-researcher, model Opus. Read 2026-10-28. Overpass: five requests, one at a time under
`/tmp/travel-overpass.lock`, user agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`, one 502 retried once.
Parks Canada: three pages (Jasper Miette trails, Yoho day hikes, Lake Louise day hikes). No Google, no Nominatim, no Commons.

## What changed

Rule zero held: the Rockies trail pages with no pin were not missing research so much as carrying a derived point
(`trailhead "X" at <ref>`) that put each trail at its destination's Wikidata centre: Iceline at Takakkaw Falls, the lakeshore walks
in the middle of their lakes, Sulphur Skyline and the Mine Trail both at the Miette pool, 10 km apart in fact. The page join
refuses those, rightly. The trail's own start is in OSM in every case.

RECORDED legacy/canadian-rockies-sept-2029/trails/sulphur-skyline data/capture/points.json 2026-10-28: OSM node 1936529926,
first vertex of Sulphur Skyline Trail (way 183274419) at the Miette Hot Springs drop-off loop. Parks Canada: "Park in the pool
lot and walk up the steps toward the entrance, where there is a passenger drop-off loop."

RECORDED legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass data/capture/points.json 2026-10-28: OSM node
757469351, first vertex of Larch Valley Trail (way 733820877), 90 m south of the Parks Canada shuttle stop; Parks Canada: the
trail starts just past Moraine Lake Lodge.

Recorded in data/capture/points.json on 2026-10-28 (the refs hold spaces, so no RECORDED marker): `trip/patagonia-2027/trail:mirador de los condores` and
`trip/patagonia-2027/trail:mirador de las aguilas`: OSM node 660024150 (highway=trailhead), the node both records' `starts_at` already names.

Recorded in data/capture/points.json on 2026-10-28: `trip/patagonia-2027/trail:chorrillo del salto`: OSM way 747061337 (the car park
its `starts_at` names), centroid; no trailhead node is mapped within 1.5 km, and the falls (node 1237892708) are 570 m north-west.

Derived files rebuilt: `relevance.ts points --build`, `capture.ts derive-near --write` (no change), `derive-area --write`
(the ledger `data/capture/derived-areas.json` only). The schedule fixture `core/test/schedule/fixtures/rockies-trip.json` was
regenerated from the page model (two new `placePoint`s, nothing else moved). `web/tests/data/places-point-join.test.ts` pins the
new counts (30 pages with no point, 20 of them trails).

## Researched, not stored

GAP: `legacy/canadian-rockies-sept-2029/trails/iceline-trail`: OSM node 2368078636 (51.495794, -116.480596), first vertex of
Iceline Trail (way 24829774) by Whiskey Jack Hostel; Parks Canada names the Takakkaw Falls parking lot, about 320 m north. Not
stored: the migration ledger pins the derived point on this ref (`core/test/capture/migration.test.ts`, "every point the relevance
inputs held is still held").

GAP: `legacy/canadian-rockies-sept-2029/trails/emerald-lakeshore`: OSM node 269747928 (51.439381, -116.541492), first vertex of
Emerald Lake Loop Trail (way 436275405) at Emerald Lake Parking (way 230454536); Parks Canada: "Trailhead: Emerald Lake parking
lot". Not stored: ledger pin.

GAP: `legacy/canadian-rockies-sept-2029/trails/lake-louise-lakeshore`: OSM node 269752723 (51.416377, -116.216299), where the
shore path (Plain of Six Glaciers Trail, way 24830044) starts on the lakefront below the Chateau. Not stored: ledger pin.

GAP: `legacy/canadian-rockies-sept-2029/trails/moraine-lakeshore`: OSM node 269752450 (51.326643, -116.183438), the lodge end of
Moraine Lake Shoreline (way 317597559); Parks Canada: the walk begins just beyond the lodge. Not stored: ledger pin.

GAP: `legacy/canadian-rockies-sept-2029/trails/jasper-miette-mine-trail`: OSM node 2383706255 (53.203884, -117.926217),
highway=trailhead "Miette coal trail", beside car park way 229826695; Parks Canada: "On Miette Road, 200 m from the intersection
with Highway 16" (OSM puts the junction about 215 m away). Not stored: the point is 10 km from every towns-layer anchor, and
`towns.py build` downloads a new GeoNames dump and re-dates the derived `near_town` notes in 22 capture files. Store it with the
next towns refresh.

## Gaps on the touched records

The five records whose points were stored stay at Draft: 12 required keys open each (wikidata, summary, access_cost,
class_key, draw, standing, distinction, easy_payoff, weather, why, signals, geometry; Sulphur Skyline also access_points and
starts_at). They are pinned in the gap budget, so they warn; filling them is a trails-lane pass, not this batch. Placement:
Rockies 206 records, no point 0, no area 10, approximate 8; Patagonia 28 records, no point 0, no area 3, approximate 4.

## Licence

Every stored point is OpenStreetMap (ODbL 1.0, "© OpenStreetMap contributors"), in the separable points layer. No licence flags.
No household data: no home point was read or stored, the builds and tests ran with the decoy home point.
