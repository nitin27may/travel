# data/tracks

Stored OSM geometry for trails, one file per trail, in the `trail-track/1` format. The public site reads these files at build time
and never calls Overpass, the OSM API or a tile server.

## Files

`<place>.json`, where `<place>` is the prototype place id of the trail (`tre-cime`, `sorapis`). The id does not change when a
public slug does. The OSM ids come from the capture record of the same trail (a route of type `nature.trail.*`, matched by name; its `links` entries of kind `osm`, in walking order, replace the ids written in the prototype fact). A trail whose relations a capture record does not name, and the points to cut at, are in `inputs.json` (below).

## Format (`trail-track/1`)

| Field | Meaning |
|---|---|
| `schema` | `trail-track/1` |
| `place` | the prototype place id (the file name) |
| `refs` | capture refs of the same trail, when known |
| `osm` | the OSM records the line was built from: `relation:<id>` or `way:<id>` |
| `fetched` | ISO date the OSM data was read (file header only, never per point) |
| `source` | `overpass`, `osm-api`, or `overpass+osm-api` (see Fetching) |
| `licence`, `attribution` | `ODbL-1.0`, `© OpenStreetMap contributors` |
| `stitched` | true when the ways joined into one ordered line (or one loop) |
| `confirmed` | true when nothing holds the line back; copied from the checks below, never typed |
| `held_back` | why `confirmed` is false: `listed in UNCONFIRMED_TRAIL_DATA`, `the relation does not stitch into one line`, `our trailhead is N m from the line` (over 300 m, measured to the nearest point of the line), `our destination is N m from the line`, `not cut: <why>` (the relation could not be cut at the trailhead and the destination, so the whole relation is kept), `the stored OSM relation is the wrong route`, `N km against M km researched` (more than 40% off, as a round trip or as one way) |
| `start_offset_m` | distance from our trailhead to the nearest point of the OSM line (not to the nearer end) |
| `end_offset_m` | the same for the destination point, or null when none is recorded |
| `cut` | how the line was cut: `destination` (trailhead to the destination point), `loop` (back to the trailhead), `ring` (a closed relation walked whole from the trailhead), `far end` (trailhead to the free end), or null (not cut) |
| `legs` | the OSM records the route is made of, in walking order, with the km each contributes |
| `simplify_m` | Douglas-Peucker tolerance in metres (5; widened until the line fits in 2,000 points) |
| `totals` | `km`, `gain_m`, `loss_m`, `high_m`, `low_m`, from the elevation samples with a 5 m hysteresis so DEM noise does not inflate the climb. Gain, loss, high and low are null for an unstitched line |
| `dem` | the elevation source, or null |
| `step_m` | spacing of the elevation samples along the line (25) |
| `geometry` | `[lon, lat]` pairs, oriented from the end nearest our trailhead. Empty when `stitched` is false |
| `segments` | only when `stitched` is false: the pieces, each a `[lon, lat]` list |
| `elevation` | `[distance_m, elevation_m]` along `geometry` every `step_m` metres; empty when `stitched` is false |

A line that is not `confirmed` is still shown on its place page, dashed and labelled "Route not confirmed yet", and is left out of
GPX and KML. The adapter also holds a line back when the trail is in `UNCONFIRMED_TRAIL_DATA` (`web/lib/public/honesty-overrides.ts`),
so removing it from that list is the confirmation.

## Cutting and joining

A relation usually runs past the walk (path 101 runs 21.7 km, the Tre Cime loop is 9). The fetcher therefore cuts: it puts the
trailhead on the nearest point of the first relation (not its nearer end), joins the relations in the order the capture record lists
them (the first point where one meets the next, at least 300 m on), and ends at the destination point: the payoff the capture record
`reaches`, or a point in `inputs.json`. A closed relation is walked whole from the trailhead, a route with `loop` closes back to it.
Without a destination, a relation that runs on both sides of the trailhead is not cut and stays held back.

`inputs.json` (`trail-track-inputs/1`), by prototype place id: `osm` (relations for a trail with no capture record), `destination` or
`destination_ref` (a point, or a ref in `data/relevance/inputs/points.json`), `loop`, `wrong_route` (the stored relation is not the
walk: the track stays held back with that reason). Every entry carries its `source`. Points come from OSM or Wikidata only.

## Sources and licence

- **Geometry:** OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Every export of a track
  carries the notice, the relation ids and the read date. Using the data publicly needs this credit and share-alike on the database.
- **Elevation:** Terrain Tiles on AWS Open Data, Terrarium encoding, zoom 13 ("Terrain Tiles: Mapzen, AWS Open Data; sources
  include SRTM and others"). Elevation is sampled along our line; no tile is copied into this repo.
- **Never:** AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Strava, Google or Tripadvisor geometry. They stay links.

## Fetching

```
node web/scripts/tracks-osm.mjs              # fetch every missing track
node web/scripts/tracks-osm.mjs --rebuild    # rebuild every file from the cached OSM responses, no request
node web/scripts/tracks-osm.mjs --only sorapis
node web/scripts/tracks-osm.mjs --check      # offline: every trail with an OSM id has a consistent file
```

One request at a time, at least 1 s apart, at most 200 a run, Retry-After obeyed, stop after the second 429, User-Agent
`travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. The run takes `flock /tmp/travel-overpass.lock`.
Responses and tiles are cached outside git in `web/.tile-cache/`.

The script asks Overpass first. When Overpass is at capacity it falls back to the OSM API (`/api/0.6/<type>/<id>/full.json`) for the
rest of the run, which returns the same ways. `source` records which one each file came from.

## Reading the numbers

`totals` are computed from the line and a DEM, not surveyed. An OSM relation often runs on past the trail we researched (a whole
long path rather than the walk to the lake), so a track's km and climb can differ from the researched figures. The place page shows
both with their sources when they differ by more than 10%.
