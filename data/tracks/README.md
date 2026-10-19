# data/tracks

Stored OSM geometry for trails, one file per trail, in the `trail-track/1` format. The public site reads these files at build time
and never calls Overpass, the OSM API or a tile server.

## Files

`<place>.json`, where `<place>` is the prototype place id of the trail (`tre-cime`, `sorapis`). The id does not change when a
public slug does. Trails of the capture records join here when a record carries an OSM id (`links.osm` or `track_source`).

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
| `held_back` | why `confirmed` is false: `listed in UNCONFIRMED_TRAIL_DATA`, `the relation does not stitch into one line`, `starts N m from our trailhead` (over 300 m), `N km against M km researched` (more than 40% off, as a round trip or as one way) |
| `start_offset_m` | distance from our trailhead to the nearer end of the line |
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
