# Capture research backlog: places and relations the migration could not create

For the gap-filling pass (capture contract 11, step 7). Each item is a record or a relation that the spec's worked examples (2.7.1)
need and that no lane has researched. The migration does not invent them: a name, a point and a source come from research, a
`part/<ref>#<slug>` or `offer/<ref>#<slug>` ref is given, and the relation is stored in the trip's capture sidecar.
Facts that stayed on a route because the source does not say they belong to the endpoint are in `data/capture/placement.json`
(`review`).

| Example | Missing | Relations to store | Current records |
|---|---|---|---|
| Sulphur Mountain | the summit (`nature.summit.summit`); Sanson's Peak (`nature.viewpoint.viewpoint`); the summit boardwalk route (`nature.trail.nature_walk.boardwalk`, starts at the top station, reaches Sanson's Peak) | the Sulphur Mountain trail (`adventures/sulphur-mountain-trail`) `reaches` the summit; the gondola top station `part_of` the summit; the summit restaurant `part_of` the summit | the gondola line, its ticket and its top station exist; the trail is a route without a `reaches` |
| Tre Cime loop | the north-face viewpoint by Rifugio Locatelli (`nature.viewpoint.viewpoint`); Tre Cime di Lavaredo (`nature.landform.mountain`); Rifugio Auronzo, Rifugio Lavaredo and Locatelli (`stay.mountain.hut`) with their lodging offers; the Auronzo toll road (`wheels.drive.mountain_pass`) and its toll (`access.pass`) | the loop `starts_at` Auronzo, `passes` Lavaredo and Locatelli, `reaches` the viewpoint; the world draw moves from the loop to the mountain and the viewpoint when they exist | the loop is `route_is_attraction` until then |
| Moraine Lake | the Rockpile (`nature.viewpoint.viewpoint`) and its walk (`nature.trail.walk`, 0.8 km); the shuttle stop (`access.transit.shuttle_stop`) and the Parks Canada shuttle seat (`access.pass.shuttle_seat`, window R); Sentinel Pass (`nature.viewpoint.viewpoint`); the Larch Valley meadows (`nature.landform.valley`) | Rockpile walk `reaches` Rockpile; canoe rental `at` the lake (done) | the lake and the lakeshore walk exist |
| Larch Valley | Sentinel Pass and the meadows as places | the route `starts_at` the shuttle stop, `passes` the meadows, `reaches` Sentinel Pass; the group-of-four rule stays on the route | `trails/larch-valley-sentinel-pass` is a route flagged `route_is_attraction`; its draw moves to Sentinel Pass when it exists |
| Kicking Horse | the put-ins and take-outs (`access.transit.boat_launch`); the river sections (upper II-III, lower canyon III-IV) as river routes | each operator's offer `on` the section it runs | the river place and one offer per operator exist |
| Aiguille du Midi, Johnston Canyon, Niagara | the summit terraces and Step into the Void; Lower and Upper Falls and the Ink Pots; the Niagara cluster and its children | `part_of` | one record each |
| Every payoff place | `point` (from OSM), `area_id`, `summary`, `links`, `photos` | | the 26 new payoff places have a name and the relevance judgement only |
