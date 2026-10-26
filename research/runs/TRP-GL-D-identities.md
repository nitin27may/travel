# Run TRP-GL-D: three Rockies identities through sourced points (26 Oct 2026)

Run record: `data/capture/runs/trp-gl-d-2026-10-26-identities.json`. Brief: `docs/v2/build/briefs-bundle-A.md` 7.4;
spec: `docs/v2/design/trip-page/review-trp2b2-2026-10-23.md` 10.3 (B4 note) and 10.5 (D5). Agent travel-researcher, model
Opus.

## Scope

Trip `canadian-rockies-2029` (folder `canadian-rockies-sept-2029`). Three place and trail pairs that the trip map joins as
one stop: `sights/emerald-lake` and `trails/emerald-lakeshore`, `place/lake-louise` and `trails/lake-louise-lakeshore`,
`sights/paint-pots` and `trails/paint-pots-walk`. Goal: Rockies family profiles draw those legs as routes, because each
side holds a sourced point (T5).

## Outcome in one paragraph

Paint Pots was already closed before this run. For Emerald Lake and Lake Louise, the trail start points were found and
sourced, but **no record data was written**. The two trails' points are pinned in the migration ledger as the inherited
lake-centre values. Replacing them fails the ledger test, and there is no supersede for points yet (C8 in
`docs/v2/features/catalogue-intake-and-storage.md`, an open coordinator decision). Even with the points stored, the
current join routes only one of the three family steps involved (measured, below), because the legs follow the trip
detail's track order, not the scheduler's. So D5 needs one owner decision on data and one code change. Route counts are
unchanged: Rockies adults 0, family-6 10, family-4 11; Dolomites 36 per profile.

## Per pair: what was found and the decision

| Pair | Place point (stored) | Trail start (found, sourced) | Decision |
|---|---|---|---|
| paint-pots / paint-pots-walk | OSM way 234163234, Paint Pots Parking, role entrance (DATA-D1, 25 Oct) | the same way; the trailhead node 3611622970 is 10 m away | already closed. Both hold the same OSM point, so the exact-coordinate join aliases them. Family-6 and family-4 day 3 draw Marble Canyon Walk to Paint Pots Walk as a road route. No change |
| emerald-lake / emerald-lakeshore | Wikidata Q316177 P625, 51.444, -116.531 (in the lake) | Parks Canada Yoho day hikes: trailhead "Emerald Lake parking lot, 10 km west of Field" (5.2 km loop, minimal gain). OSM: Emerald Lake Parking way 230454536 (centroid 51.43895, -116.54119, already held as `part/.../sights/emerald-lake#parking`); the loop path way 436275405 leaves the lot at node 269747928 (51.43938, -116.54149); a "Parks Canada Route Map" board is node 13198598010 (51.43835, -116.54094) | (a) a distinct point, about 0.9 km from the lake point. (b) is false: the trail does not start in the lake. Not stored: ledger pin (C8) |
| lake-louise / lake-louise-lakeshore | Wikidata Q1367398, 51.41167, -116.22806 (in the lake), via the locations store | Parks Canada Banff day hikes: trailhead "Lake Louise Lakeshore parking lot, 4 km from the community of Lake Louise" (2.3 km one way). OSM: the parking is way 26752321 (centroid 51.41501, -116.21343, already held as `part/place/lake-louise#parking`); the shore path way 613989340 (tagged Plain of Six Glaciers Trail) starts at node 348007195 (51.41680, -116.21616); map board "Welcome to Lake Louise" is node 11246022407 (51.41626, -116.21627) | (a) a distinct point, about 0.9 km from the lake point. (b) is false. Not stored: ledger pin (C8) |

All OSM reads went through overpass-api.de, one request at a time under `/tmp/travel-overpass.lock` with the project user
agent; one 502 was retried once after 20 s. No Google source was used. Every point is "agent checked, needs a person's
check".

**Which point, once C8 allows it.** Parks Canada names the parking lot as the trailhead for both trails, and the earlier
precedents store the lot for a route-as-attraction trail (`paint-pots-walk`, `peyto-lake-lookout`). The recommended
trail point is therefore the parking way the store already holds. These are OSM way 230454536 and way 26752321, each with
`point_role: trailhead`. The path start nodes above are the alternative if the owner wants where walking starts rather
than where the car stops. They are 50 m and 250 m from the lots.

A note for whoever stores a point: the relevance build writes 5 decimals, so a coordinate whose fifth decimal is 0 (node
348007195 becomes 51.4168) fails check D4 in `web/lib/public/completeness.ts`, which counts the decimal digits of the
number. That is a check bug (trailing zeros), not a data fault.

## What the join does with distinct points (measured, then reverted)

I wrote both trail points into `data/capture/points.json`, rebuilt the relevance inputs, ran derive-near and fetched the
three new pairs from ORS under `/tmp/travel-ors.lock`. The pairs were Takakkaw Falls Walk to Emerald Lakeshore (39 min,
28 km), Emerald Lakeshore to Takakkaw Falls (39 min), and Lake Louise Lakeshore to Lake Louise (11 min, 1 km). Then I read
`routedSteps` for each family profile. Everything was reverted once the ledger test failed, but the ORS responses stay in
the gitignored cache (`tools/.cache/legs-ors`), so a later run needs no new requests.

| Profile, day | Chain the scheduler draws | Routed before | Routed with the two points |
|---|---|---|---|
| family-6, day 9 (track B) | Takakkaw Falls Walk, Emerald Lakeshore, Natural Bridge | Takakkaw to Natural Bridge (Emerald Lakeshore had no pin) | Takakkaw to Emerald Lakeshore routed; Emerald Lakeshore to Natural Bridge **dashed** |
| family-6, day 10 (track B) | Lake Louise Lakeshore, Lake Louise Gondola | none (one pin) | Lakeshore to Gondola **dashed** |
| family-4, days 9 and 10 (track C) | uses the lake places, not the trails | unchanged | unchanged |

Counts stay at 10 and 11. Why two steps stay dashed: `web/scripts/legs/pairs.ts` fetches consecutive items of the trip
detail's tracks, and the detail lists the trails before the sights (day 9 B: `9-B-5` Takakkaw Falls Walk, `9-B-6`
Emerald Lakeshore, `9-B-2` Takakkaw Falls, `9-B-3` Emerald Lake, `9-B-4` Natural Bridge). So no pair Emerald Lakeshore to
Natural Bridge or Lake Louise Lakeshore to Gondola is ever asked for. The legs that do exist (Emerald Lake to Natural
Bridge, Lake Louise to Gondola) are keyed by the lake places, whose pins are the lake points, not the trailheads. No
honest data change closes that.

## Gaps

- GAP: `trails/emerald-lakeshore` point and `trails/lake-louise-lakeshore` point. Sourced values above; blocked by the
  migration ledger pin (C8).
- GAP: `trails/emerald-lakeshore` area_id. There is no `CA/BC` region and no Yoho area in `data/locations/locations.json`.
  This is the same gap for every Yoho record (Emerald Lake, Takakkaw Falls, Natural Bridge and the rest).
- GAP: `starts_at` on both trails. The official trailhead is the parking lot, which exists as a part record for each:
  `part/legacy/canadian-rockies-sept-2029/sights/emerald-lake#parking` and `part/place/lake-louise#parking`. Not written:
  it changes the trail pages (Directions, access points) and the relevance inputs, which this data seat cannot check under
  the focused-test rule. One line each for the follow-up.
- Unchanged required gaps on both trails: `access_points` (no home in the registry), `geometry` (lives in `data/tracks`,
  needs `web/scripts/tracks-osm.mjs`; candidate OSM ways are listed above), `starts_at`.

## Conflicts

- Lake Louise Lakeshore gain: Parks Canada Banff day hikes says gain 175 m, loss 75 m (stored in
  `data/suitability/canadian-rockies-2029/R2a.json`, src-0001). The Parks Canada 2025 "Maps of the Lake Louise area" says
  gain and loss "minimal". Both give 2.3 km one way and about 1 h. Keep 175 m and add the map's value as a conflict; not
  written here.

## Questions for the owner

1. **C8:** extend `capture-supersedes/1` to points (one reviewed entry per point), or approve retaking these two ledger
   pins? The pinned values are inherited lake centres, never a sourced trailhead.
2. **The join (B2 code, after 1):** pick one. (a) Make `legs/pairs.ts` ask for the scheduler's chain per profile. This is
   the D5 alternative "re-key the legs to the scheduler's slugs". (b) Alias a trail pin to its place when the trail's point
   equals, exactly, the routing point the legs already end at (the place's trailhead or parking). Data alone cannot close
   D5.
3. **Trail point:** the parking lot that Parks Canada names (recommended, matches the precedents) or the path start node?
4. **Yoho area:** add the region `CA/BC` and the area `CA/BC/yoho-national-park` through the location skill?
5. **starts_at:** may a data lane add `starts_at` to the two parking parts, accepting the page-byte change, which the
   per-merge budget step would measure?

## Files written

- `data/capture/runs/trp-gl-d-2026-10-26-identities.json` (run record)
- `research/runs/TRP-GL-D-identities.md` (this note)

No record, sidecar, points, legs, test or derived file changed.

## Commands and results

| Command | Result |
|---|---|
| `node core/bin/capture.ts gaps --budget --check` | OK, no count rose (E_PLACE_AREA 227, E_PLACE_ORPHAN 7, W_PLACE_POINT 1, W_TIER_REQUIRED 384 records and 3,731 keys), before and after |
| `node core/bin/capture.ts gaps --placement --trip canadian-rockies-2029` | records 199, no area 114, no point 0, approximate 8, no nearest town 0, outside its area 0, offers saying nowhere 7; unchanged |
| `node core/bin/capture.ts gaps --tier required --trip canadian-rockies-2029` | unchanged; both trails "draft", missing access_points, geometry, starts_at (Emerald also area_id) |
| `node core/bin/capture.ts run --check` on the run record | OK |
| `node core/bin/sources.ts check` | OK, 587 sources |
| `node core/bin/validate.ts --all` | OK, 98 files with the trial data; OK, 99 files on the final tree (the run record added) |
| `node core/bin/suitability.ts check` | OK, 0 errors |
| `node core/bin/relevance.ts check`, `derive --check` | OK |
| `node core/bin/slugs.ts --check` | OK |
| `node core/bin/normalise.ts --check --family capture,points,relevance`, `--budget --check` | OK; the findings equal main's |
| `pnpm --dir web snapshot:check` | snapshot is current |
| `core/test/capture/migration.test.ts` | with the trial points: 1 failure ("every point the relevance inputs held is still held", emerald-lakeshore). After the revert: passes |
| `node web/scripts/legs-ors.mjs --check` | with the trial points: 3 missing pairs, then fetched (3 ORS requests); after the revert: all files valid |
| `python3 tools/tree_check.py --check` | folder contract OK |
| `python3 tools/relink.py check` | exit 0; the same template placeholders as main |

Not run, per the owner's focused-test rule (26 Oct): `bash tools/check-all.sh`, the web build, S13 and the e2e. They belong
to the per-merge step and T2.
