# L4b: trail tracks and trail pages for every public trip

Wave 3, stage 3. It runs in parallel with L3c (timeline), L3b (tags and filters), L2b (globe) and CS7 (research), and merges right after L3c.
- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 14 hours, in four parts:
  - track fetch and data, 4 h
  - adapter: tracks and the new trail pages, 4 h
  - trail page UI (map line, profile, GPX), 4 h
  - tests and shots, 2 h
- **Backlog:** 3.7, 3.8; the TODO row "Trail maps on every trail page"; the 2.41 item "the pin we stored" wording.
- **Specs:** [research/lanes/trails.md](../../../../research/method/lanes/trails.md) (track, `track_source`, geometry rules), [research/capture-contract.md](../../../../research/method/capture-contract.md) 2.7 (routes, `reaches`, `starts_at`) and 9 (crawler rules), [research/map-stack-2026-10-18.md](../../../../research/reports/map-stack-2026-10-18.md), [design/foundation/](../../design/foundation/) components 4.4 (elevation profile), principles P2, P3, P6, P8, T2, T3, T5.
- **Starts:** now. The one edit in `web/lib/export/build.server.ts` (step 11) waits until L3c merges and you rebase.

## Goal

1. **Real OSM geometry** for the trails that carry an OSM relation or way id (17 Dolomites trails today), stored once in `data/tracks/` with ODbL credit, drawn on the place map instead of the straight "not the path" line.
2. **The elevation profile from the track**: distance and elevation sampled along the real line, with gain, loss and high point computed from it, replacing the synthetic curve from km and gain.
3. **GPX and KML from the track**, with the ODbL notice in the file. Routes a person has not confirmed (`UNCONFIRMED_TRAIL_DATA`: Fanes, Seceda, Nuvolau and the rest) keep their page but are held back from export, and their map line is drawn dashed and labelled.
4. **A trail page for every trail on a public trip**: the Rockies (64 trail routes in `data/capture/canadian-rockies-2029`), Patagonia (7), Iceland (5), Chamonix (3) and the Dolomites (20), each with the full link checklist ("none found (checked ...)" for gaps). Day items on the trip pages link to them through the existing name lookup.
5. **Honest maps** (T5): every line says where it came from; a trail with no track shows its trailhead and the honest straight-line guide, labelled.

**Changed 19 Oct (Q26, owner): nothing is private, so the trails of every trip are built, Vermont, Norway, Utah and Algonquin included.** Visibility still fails closed for any future private trip.

## Read first

- [research/lanes/trails.md](../../../../research/method/lanes/trails.md) sections on `track`, `track_source`, `gpx_download` and the gotcha on closed sections.
- `web/lib/public/places.ts` (`buildLines`, the trail branch of `buildPlaces`, `byName`), `slugs.ts`, `honesty-overrides.ts`, `sources.ts` (the Rockies `trails.json` read), `types.ts` (`PlaceLine`, `PublicPlace`).
- `web/lib/public/trips.ts` (`slugForName`): read only, to see how day items find place pages.
- `core/src/capture/records.ts` (`loadWorld`) and `data/capture/<trip>/*.json` for the route records, their `type`, `starts_at` and `reaches`.
- `web/components/places/PlacePage.tsx`, `ElevationProfile.tsx`, `model.ts` (`sampleProfile`, `profileSummary`), `PlaceMap.tsx`, `mapPoints.ts`, `LinksTabs.tsx`.
- `web/lib/export/gpx.ts`, `kml.ts`, `licence.ts`, `build.server.ts` (`lineOf`, which sets `geometry: []`).
- `web/lib/map/` (the `MapSpec` line layer; additive only).
- [README.md](README.md) 4.2 and 8; the [L3c brief](L3c-trip-timeline.md) "Files you own".

## Files you own

| Area | Paths |
|---|---|
| Track data | `data/tracks/**` (new): `<place-slug>.json` in `trail-track/1`, `README.md` with the schema, the sources and the licence |
| Fetch script | `web/scripts/tracks-osm.mjs` (new) |
| Adapter, trail part | `web/lib/public/tracks.ts` (new), the trail code in `web/lib/public/places.ts` (`buildLines`, the trail branch, the new route-based trail places), `web/lib/public/slugs.ts` (trail slugs, additive), `web/lib/public/honesty-overrides.ts`; additive fields in `types.ts` (`PlaceLine.geometry`, `PlaceLine.dashed`, `PublicPlace.profile`) |
| Place pages | `web/components/places/**` **except `rows.ts`** (L3b owns it), `web/app/places/[slug]/page.tsx`, `web/styles/places.css` |
| Exports | `web/lib/export/gpx.ts`, `kml.ts`, `licence.ts`; after the L3c rebase, one line in `build.server.ts` (`lineOf`: `geometry: l.geometry ?? []`) |
| Tests | `web/tests/places/tracks*.test.ts`, `web/tests/places/model.test.ts` and `place-page.test.tsx` (trail blocks), `web/tests/export/gpx*.test.ts`, `kml*.test.ts`, `web/tests/e2e/places-trail*.spec.ts`; the trail `describe` blocks of `places.spec.ts` and `places.shots.spec.ts` |

## Do not touch

- **L3c** (building now in `v2-L3c`; everything it owns):
  - `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts`
  - `data/schedules/**`, `web/scripts/legs-ors.mjs`
  - `web/lib/public/timeline.ts`, `prose.ts`, and the `days`, `bases` and `categories` code in `web/lib/public/trips.ts`; L3c's additive blocks in `types.ts` and `honesty.ts`
  - `web/app/trips/[slug]/page.tsx`, `web/components/trips/timeline/**`, `TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `StopStats.tsx`, `TripRouteMap.tsx`, `useTripUrl.ts`, `model.ts`, `web/styles/timeline.css`
  - `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts` (except the one line after the rebase), `types.ts`, `web/components/actions/CopySheet.tsx`
  - `web/tests/trips/timeline*.test.ts`, `web/tests/data/prose*.test.ts`, `web/tests/e2e/trip-timeline*.spec.ts`, and the trip page `describe` blocks
- **L3b:** `web/components/places/rows.ts`, the `facets` block of `descriptors/place.tsx`, `web/lib/entities/**`, `web/components/entity/FilterBar.tsx`, `MoreFilters*.tsx`, `FacetMenu.tsx`, `PhoneFilterSheet.tsx`, `web/lib/public/tags.ts`, `bands.ts`, `world.ts`, `index.ts`, every trips list file, `web/tests/e2e/places-parity.spec.ts`.
- **L2b:** `web/app/globe/**`, `web/app/globe-data/**`, `web/lib/globe/**`, `web/components/globe/**`, `web/styles/globe.css`, `web/public/globe/**`, `tools/globe_data.py`, `web/lib/client/data.ts`.
- **S1:** `web/lib/public/contract.ts`, `suitability.ts`, `relevance.ts`, `sections.ts`, `party.ts`, `web/components/suit/**`. Do not build the contract sections, "Who it suits" or "How to get there": S1 does that on top of your page after you merge. Keep the trail sections in `PlacePage.tsx` in their own components (`TrailMap`, `TrailProfile`, `TrailExport`) so S1 can move them without rewriting them.
- **CS7:** `data/capture/**`, `data/suitability/**`, `data/relevance/**`, `data/sources/**`. You read capture route records; you never write them. A track's OSM id that is missing from a record goes in the hand-back for CS7.
- `web/components/ui/**`, `web/components/entity/**`: ask in the hand-back. `web/lib/map/**`: additive only, listed in the report.
- `legacy/`, `prototype/`, `core/`: read only.

## Steps

### Part 1. Fetch and store the tracks

1. **`data/tracks/README.md`:** the `trail-track/1` schema:
   - `place` (slug), `refs` (capture refs), `osm` (`relation:<id>` or `way:<id>` list), `fetched` (ISO date, in the file header only), `licence: "ODbL-1.0"`, `attribution: "© OpenStreetMap contributors"`;
   - `geometry`: `[lon, lat]` pairs, simplified to about 5 m (Douglas-Peucker) and at most 2,000 points;
   - `elevation`: one sample every 25 m along the line, `[distance_m, elevation_m]`, with `dem` naming the source;
   - `totals`: `km`, `gain_m`, `loss_m`, `high_m`, `low_m`, computed from the samples with a 5 m hysteresis so DEM noise does not inflate the gain;
   - `confirmed`: copied from `UNCONFIRMED_TRAIL_DATA` at fetch time, never typed.
2. **`web/scripts/tracks-osm.mjs`:**
   - Input: every trail place whose source holds an OSM relation or way id (`geometry_ids` in the prototype trails, `links.osm` or `track_source` in capture records).
   - Overpass: one query per trail (`relation(<id>); way(r); out geom;`), **sequential, one request at a time, at least 1 s apart**, at most 200 requests a run, obeying `Retry-After`, stopping after the second 429. User-Agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`: the project and the public site, **never an email**.
   - Only one Overpass job on the machine at a time: wrap the run in `flock /tmp/travel-overpass.lock` (L2b and CS7 use the same lock).
   - Stitch the ways of a relation into one ordered line (or a loop). A relation that does not stitch into one line is written with `stitched: false` and drawn as segments.
   - Elevation: sample the line against the AWS Terrain Tiles (Terrarium PNG, open data, credited "Terrain Tiles: Mapzen, AWS Open Data; sources include SRTM and others"). Fetch tiles sequentially, cache them outside git (`web/.tile-cache`, gitignored), never at site build time.
   - Cache every Overpass response outside git with its read date. `--check` fails when a trail with an OSM id has no track file or its `osm` list differs. The build never calls Overpass or the tile server.
3. **Run it once** and commit `data/tracks/*.json`. Check each line by eye against the trailhead and the payoff point (a 2,000-point line is small); a track whose start is more than 300 m from our trailhead is kept with `confirmed: false` and listed in the hand-back.
4. **Never** fetch or copy anything from AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Strava, Google or Tripadvisor: they stay links in the checklist (`found_in_search` with the search date). No coordinate from Google, ever.

### Part 2. The adapter

5. **`web/lib/public/tracks.ts`:** reads `data/tracks/*.json` at build time; returns the line (geometry, dashed when unconfirmed or unstitched), the profile samples, the totals and the credit. Pure apart from the file read; tested with a fixture track.
6. **`places.ts`, trail branch:**
   - `buildLines` sets `PlaceLine.geometry` from the track and keeps `exportable: confirmed`.
   - The trail's stats (`km`, `gain_m`) stay the researched values; the track's totals are shown beside them only when they differ by more than 10% ("Track: 8.1 km, 640 m up · OSM and Terrain Tiles"), so a reader sees both and their sources (T3, the "Sources disagree" pattern).
   - `PublicPlace.profile` is the sampled profile, or `null` with no track.
7. **New trail places** from the capture route records of public trips (`layer: route`, a `nature.trail.*` or `nature.trek.*` type) that have no place page today:
   - name, type label, area chain, trip refs and the trailhead from `starts_at` (or the Rockies `trailhead` text, as text only, with no invented point);
   - the link checklist from the record's `links` and the Rockies `official_url`, `map_url` and `alltrails_url` (link only), with "none found (checked <date>)" for the rest;
   - slugs by the patterns 1.2 rule, unique, stable; added to `byName` so the trip pages' `slugForName` finds them with no change to `trips.ts`;
   - the payoff: when the route `reaches` a place, the page names it ("To Sentinel Pass") and links it. The draw, standing and photo belong to the payoff place (CC-adapter-requests 3), not to the route.
8. **Privacy and P8:** the new pages pass the privacy test (no household data, no party, no dates) and carry the track inline in the page only, never in a list or search file. List rows gain no track keys.
9. **2.41 wording:** "the pin we stored" becomes "Our point" with its source ("Our point · OpenStreetMap node 123"), on trail and place pages.

### Part 3. The trail page

10. **Map** (`TrailMap.tsx`): the real line through the map adapter's line layer, the trailhead and parking pins, the payoff pin. Unconfirmed lines are dashed with the label "Route not confirmed yet". The legend credits "© OpenStreetMap contributors (ODbL)" and the DEM. No Google geometry: on the Google family the line is our own overlay, and the initial view fits the line.
11. **Profile** (`TrailProfile.tsx`): `ElevationProfile` takes the real samples; scrubbing moves the marker along the real line (`lerpPoint` on the track, not a straight guide). Units follow the preference. With no track, the profile keeps today's synthetic curve with the label "Shape estimated from length and climb" (honesty chip).
12. **Exports:** GPX `trk` and KML `LineString` from the geometry; the file header carries the ODbL notice, the source relation ids and the read date (P8: every export says where it came from). Unconfirmed lines are not exported, and the menu says why. After the L3c rebase, `build.server.ts` `lineOf` passes `l.geometry`.
13. **Rockies and other trips:** each day item that names a trail now links to its page (no edit to L3c files: the name lookup does it). Check the count in the hand-back.

### Part 4. Tests

14. Unit tests:
    - stitching: a relation of three ways in mixed directions gives one ordered line; a gap gives `stitched: false`;
    - totals with hysteresis on a noisy fixture (gain within 5% of the hand-computed value);
    - simplification keeps the start, the end and every point that moves the line more than 5 m;
    - `--check` fails on a missing track and on an `osm` list that differs;
    - GPX and KML: a confirmed line exports with the ODbL header; an unconfirmed one does not; a waypoint that fails the licence guard is dropped and counted;
    - the new trail places: every public-trip trail route has a page; none from a private trip; slugs unique and stable across two builds;
    - no track value cites a link-only platform (extend `link-only-facts.test.ts` by a trail fixture).
15. E2E (`places-trail.spec.ts`): Tre Cime (confirmed track), Seceda (unconfirmed), a Rockies trail with no track, Lake Agnes (payoff link), axe on each.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Every trail with an OSM id has a committed track file; `node web/scripts/tracks-osm.mjs --check` passes; the build makes no network call | 3.7 |
| 2 | Tre Cime draws the real loop on its map, its profile scrubs along it, and the marker stays on the line | 3.7, components 4.4 |
| 3 | Seceda, Fanes and Nuvolau draw a dashed line labelled "Route not confirmed yet" and offer no GPX or KML track | 3.7, T5 |
| 4 | GPX and KML of a confirmed trail contain the track, the ODbL notice, the relation ids and the read date | 3.7, P8 |
| 5 | Every trail route on a public trip has a page with the full link checklist; private trips' trails have none | 3.8, privacy |
| 6 | Rockies day items that name a trail link to its trail page | 3.8 |
| 7 | No value, line or point on a trail page comes from AllTrails, Komoot, Google or another link-only platform; those appear only as links | trails lane, contract 9.2 |
| 8 | Where the track's km or gain differs from the researched value by more than 10%, both show with their sources | T3 |
| 9 | Lines and the profile render on the Arc GPU in light and dark; the line passes 3:1 against the basemap in both | T5, tokens 5 |
| 10 | The privacy test, the P8 pinned-keys test and the link-only test pass with the new pages | README 8 |
| 11 | Place page JS grows by under 5 kB gzip; the largest trail page HTML stays under 250 kB | README 6 |
| 12 | `git diff --name-only` shows only owned paths; the `build.server.ts` line and any `web/lib/map` addition are listed | README 4.1 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
node web/scripts/tracks-osm.mjs --check
python3 tools/theme_tokens.py --check
bash tools/check-all.sh   # with web/.env.local moved aside
```

Screenshots: the L0 harness at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/L4b/`, on the Arc GPU (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`). Read tall pages in 1600 px tiles and zoom on each map to check the line, the pins and the labels.

| Page | Shots |
|---|---|
| `/places/tre-cime-di-lavaredo-loop/` | full page; the map; the profile mid-scrub |
| `/places/seceda-ridge/` | the dashed line and the export menu |
| a Rockies trail with a track, one without | full page |
| Lake Agnes or Larch Valley | the payoff link |
| phone | the profile scrub on touch |

Then `travel-design-reviewer` (Opus, never Fable) reviews the map, the profile and the honesty labels; `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-L4b`, branch `public/L4b`, dev port 3424.
- **Commits, in this order:**
  1. `data(tracks): trail-track/1 schema and the fetch script`
  2. `data(tracks): OSM tracks with elevation samples (ODbL)`
  3. `web(public/L4b): tracks in the adapter, trail pages for every public trip`
  4. `web(public/L4b): trail map line, profile from the track`
  5. `web(public/L4b): GPX and KML from the track` (includes the `build.server.ts` line, after the rebase)
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back. Do not push.
- **Merge order:** after L3c (the `build.server.ts` line), before L3b (L3b owns `rows.ts` and the parity spec and rebases onto your new place set) and before S1 (S1 builds its sections on your trail page).

## Hand-back report

Keep it short. Include:
- the commits and the test counts;
- the tracks fetched, held back (unconfirmed or unstitched) and failed, with the reason;
- every track whose start is more than 300 m from our trailhead;
- every trail whose track totals differ from the researched values by more than 10%;
- the count of new trail pages per trip, and of Rockies day items now linked;
- OSM ids found in prototype data but missing from capture records (for CS7);
- the size deltas (check 11) and any `web/lib/map` addition.
