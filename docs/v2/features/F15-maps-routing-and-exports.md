# F15. Maps, routing and exports

## Purpose

One map engine for Explore, the plan, entity pages and Today mode; drive and walk times that are
real where it matters and cached forever; offline tiles for the trip area; and exports that open in
the tools people already use (Google Maps, Apple Maps, calendars, GPS apps, Google My Maps).

## User stories

1. As a planner, I want the day's route drawn with leg times, so that I see the shape of the day.
2. As a driver, I want a Google Maps link with all of today's stops in order, so that navigation is one tap.
3. As a hiker, I want the GPX of a trail on my watch or in Gaia, so that I can follow it offline.
4. As a planner, I want the trip's days and deadlines in my calendar, so that it lives with everything else.
5. As someone used to Google My Maps (the vault's `make_maps.py`), I want a CSV export that imports cleanly.

## Detailed behaviour

### Maps

1. MapLibre GL JS with OpenFreeMap vector tiles online; a calm style with category pins by shape and colour (colour-blind safe); terrain hillshade from Mapterhorn or AWS Terrain Tiles where useful (trail pages).
2. Pins: numbered per section in the plan (F06), clustered in Explore; stays as a bed icon; anchored transport as arcs (flights) or lines (ferries, trains); trailheads and parking as distinct symbols on trail pages.
3. Layers toggle: trails, parking, toilets, viewpoints, the household's saved places, the trip's bases.
4. Attribution always visible: OpenStreetMap contributors, OpenFreeMap, terrain source.

### Routing and legs

5. Legs between consecutive items and from/to the night's base. Modes: drive, walk, bike, transit (transit as a link to Google Maps in v1, no computed transit times), ferry and flight from reservations.
6. Provider: OpenRouteService free API behind `leg_cache` keyed by geohash cells and mode; self-hosted Valhalla on the home server when quotas bite (it fits in Docker; North America extract size is the constraint).
7. Straight-line estimates first (× 1.4 rural, × 1.8 mountain), real times filled in asynchronously; estimates labelled.
8. Leg geometry stored (as a line) for corridor searches (F07) and drawing.
9. Drive time from home or a base for Explore uses the same cache (origin rounded to ~1 km).
10. Quota protection: per-day budget of routing calls; when exceeded, estimates only with a note.

### Offline tiles

11. Per-trip PMTiles extract (F13), from a Protomaps planet build or regional extracts, served from object storage (provider not selected; R-60 selected Neon only for Postgres, auth and live updates) or the web host (also not selected); downloaded to Cache Storage. Not built.

### Exports

12. **Google Maps multi-stop link** per day (origin = base, waypoints in order, destination = base or next base), respecting Google's waypoint limit (9 waypoints via URL; longer days split into two links).
13. **Apple Maps link** per item (and per day when supported).
14. **ICS**: per-trip feed (secret URL, F09) with days as all-day events, timed items, reservations (flights with both zones), deadlines and reminders as alarms; one-off `.ics` per deadline.
15. **GPX**: per trail (track from `entity.shape` when licence allows, with attribution in metadata), per day (route as a GPX route with waypoints), per trip (all items as waypoints).
16. **KML/KMZ**: per trip for Google Earth / My Maps (folders per day).
17. **My Maps CSV**: the `make_maps.py` shape (name, description, lat, lon, category, day, order, link) so it round-trips with the old vault workflow.
18. **PDF**: print view of the trip or a day range (F11 print view) via the browser's print to PDF, plus a server-rendered PDF later.
19. **trip.json**: full export of the user's trip (their data, for backup and portability; codes included only for the owner).

## Sharing

See [10-sharing.md](../10-sharing.md). Exports are a sharing audience of their own: a day's Google Maps link, a GPX of a trail, an ICS feed URL, a PDF of the plan and an image card of a route can be sent through the Web Share API sheet on phones or copied on desktop. Exports respect the same include rules as guest links (no codes or ages in PDFs shared outward unless chosen; the owner's full export is separate).

## Data touched

`leg_cache`, `entity.shape`, `media`, `trip_item`, `reservation_segment`, `calendar_feed`, `offline_package`, object storage for tiles (provider not selected).

### Schema additions

- `leg_cache.geometry geography(LineString,4326)` (replacing text) and `leg_cache.estimate boolean`.
- `routing_budget (on_date, provider, calls int, limit int)`.

## Operations and MCP tools

Queries: `leg.get` (from, to, mode), `day.route`, `export.gmaps_links`, `export.gpx`, `export.kml`, `export.ics`, `export.mymaps_csv`, `export.trip_json`, `entity.track`.

MCP: `plan_drive` (legs and stops), `export` (format, scope: trip, day, entity) returning a URL valid for 24 h.

## Edge cases

- Ferry legs (Lofoten, Patagonia lakes): routing engines treat ferries inconsistently; ferries come from reservations or hand-marked legs, not the router.
- Border crossings (Vermont, Quebec): legs computed normally, with a border-wait note on the leg when crossing.
- Points off the road network (a summit): drive leg to the nearest trailhead or parking, then walk.
- GPX of an OSM-derived track: includes ODbL attribution; disabled for tracks from sources that forbid redistribution.

## Acceptance criteria

1. A day with 5 stops produces one Google Maps link that opens with the stops in order from the base.
2. Re-requesting the same leg makes zero routing calls (cache hit) for 1 year.
3. The ICS feed shows an overnight flight with correct local times at both ends in Google Calendar and Apple Calendar.
4. GPX of a trail validates against the GPX 1.1 schema and opens in Gaia GPS and OsmAnd.
5. My Maps CSV imports into Google My Maps with layers per day.

## Milestone

M1 (maps, legs, cache), M2 (day routes, Maps links), M3 (ICS), M4 (offline tiles, GPX, KML, CSV, PDF).

## Open questions

1. Self-host Valhalla from the start on the home server (no quotas) vs ORS free API? Default: ORS first; Valhalla when coverage beyond Ontario and the Rockies is needed.
2. Transit times: link to Google Maps only in v1? Default: yes.
