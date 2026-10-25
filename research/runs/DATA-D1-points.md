# DATA-D1: points for records with no point (25 Oct 2026)

Branch `public/DATA-D1`. Run record: `data/capture/runs/api-2026-10-25-data-d1-points.json`. Model: Claude Sonnet 5.5 (the brief asked for Opus). Every point is agent checked and needs a person's check.

## Result

| | before | after |
|---|---|---|
| Records with no point (`W_PLACE_POINT`) | 84 | 6 |
| Points in `data/capture/points.json` | 99 | 179 (80 new rows, 1 moved, 1 marked approx) |
| Approximate points | 1 | 41 (each has an `approx_note`; `W_PLACE_APPROX` stays 0) |
| `W_TIER_REQUIRED` | 385 records, 3875 keys | unchanged |

By trip, no point before to after: Rockies 53 to 2, Patagonia 8 to 2, Chamonix 6 to 1, Utah 6 to 1, Iceland 5 to 0, Algonquin 3 to 0, Vermont 2 to 0, Dolomites 1 to 0.

## Method and limits

- Order followed: Wikidata P625 (by QID, else name search in the area), then OSM, then the land manager's page.
- **Overpass was unreachable** (timeouts all session). OSM points come from the OSM API (`api.openstreetmap.org`, bbox map scans) and Nominatim, one call at a time under the lock file `/tmp/travel-overpass.lock`, 1.2 s or more apart. `flock` is not installed on this machine, so the scripts use Python `fcntl` on the lock files. Request counts in the run record are approximate (Wikidata 124 searches, Nominatim 69, OSM API 82 scans).
- User agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. No Google, AllTrails, Tripadvisor or Komoot coordinates.
- The read date and source sit in each row's `point_source` (the points schema has no other date field). Roles are the trailhead, parking or meeting point where OSM maps one; otherwise `centre` with `approx: true` and a note saying what the point stands for.

## searched_none (6)

| Record | Tried |
|---|---|
| Berg Lake trail | Nominatim, OSM scan (no lot or trailhead node; CS7b found the same), Wikidata |
| Fryatt valley | Nominatim (nothing), OSM scan (Fryatt Creek ways only), Wikidata (no P625) |
| Lac du Châtelard (Chamonix) | Nominatim, Wikidata within 20 km; `research/trips/chamonix-mont-blanc-sept-2028/suitability.md` line 29 says the only Lac du Châtelard is at Névache, so the place may not exist |
| Laguna de los Tres | Wikidata, Nominatim, OSM scan (trail ways, no named lake node) |
| Laguna Esmeralda | Nominatim (a street only), Wikidata, OSM scan |
| Windows Section, Arches | Nominatim, two queries, nothing |

## Rulings

**Waterton marina (3.61c).** The cruise row used OSM way 678717446, the cruise company's building on Waterton Avenue. The marina is OSM node 270866424 `Waterton Harbour` (`leisure=marina`), 105 m east; the ferry route ways start 130 m north-east of it. The row now holds the marina node with role `meeting`.

**Elk rut (3.61d).** The row stays on the Banff townsite node and is now `approx: true`, role `centre`, with the note that the rut has no single viewing point.

**Kananaskis Village base point (ST-1, about 2 km).** Wikidata Q6360620 gives 50.91748,-115.1474 and OSM node 926027463 `Kananaskis Village Centre` gives 50.91861,-115.14809 (read 25 Oct). Two independent sources agree within about 130 m. The schedule's 50.936,-115.145 is rounded, has no source row, and is 2 km north. **Wikidata/OSM wins.**

**Lake Louise base point (ST-1, about 4 km).** The relevance town uses Q1367398, which is the lake (51.41167,-116.22806). The stay base is the hamlet: Wikidata Q12826048 (51.42528,-116.18056) and OSM `place=hamlet` node 2665400241 (51.42497,-116.17754) agree, and the schedule's 51.4254,-116.1773 is within 30 m of the OSM hamlet. **The hamlet wins; the lake item is the wrong entity for a base.**

Both fixes sit in files this lane does not own (`data/relevance/inputs/bases.config.json`, `data/schedules/canadian-rockies-2029.json`). Handed to the coordinator: swap the Lake Louise QID to Q12826048 with the OSM hamlet coordinates, and replace the Kananaskis schedule point with the OSM village-centre node.

## Conflicts between sources (kept in `point_source`)

- Grand View Point walk (Utah): OSM trailhead node 6806471755 at the road end against Wikidata Q62073199, 1.4 km north-east. OSM wins because the trailhead is tagged.
- Cameron Lake: Wikidata Q3214786 against the OSM lake way, 1.2 km south. Wikidata kept for the lake; the run record outcome is `conflict`.
- Cory Pass: OSM `Cory Pass Trail Parking` on Hwy 1A against the legacy trailhead name "Fireside picnic area". Not shown to be the same place.

## Destination points (3.47e)

- `part/place/cascate-di-fanes#payoff` and `part/place/sass-pordoi-and-piz-boe#payoff` now hold the last vertex of the stored OSM track. Pordoi's track is confirmed (end offset 8 m). Fanes' track is **unconfirmed** (1.4 km mapped against 7 km researched), so that point is `approx`.
- **Cinque Torri, Val Fiscalina and Vallunga have no `#payoff` part**, and Federa's destination is the lake record `place/lago-federa`, which already had a point. Creating the three parts is outside the owned files (coordinator item).

## Operator questions (new)

1. Dettifoss: the park page puts the walk's start at the *west* car park (road 862); the point is the falls (Wikidata Q210280, `approx`). Which car park will the plan use, and is a trailhead node worth adding?
2. Mount Indefatigable viewpoint: OSM node 3762652045 is tagged `Indefatigable Trail Decomissioned 2005`. Is the route still open? The point is the North Interlakes lot.
3. Kicking Horse family float and the Kananaskis raft: the operators' put-ins were not found. The Wild Water Adventures river base (2750 Beaverfoot Road, from the operator's contact page) is the meeting point; the river rows are `approx`.
4. Rafting on the Rienza (Dolomites): Rafting Club Activ's FAQ (https://www.rafting-club-activ.com/en/faq/, read 25 Oct) says Rienz and Eisack tours meet at its rafting station in the St. Sigmund sports zone, Kiens. The sports zone is not mapped in OSM, so the point is the St. Sigmund village node, `approx`.
5. Lillian Lake and Burstall Pass: the legacy trailheads (Galatea day use; Smith-Dorrien lot) were matched by name only.

## Not verified

- All points are agent checked, none by a person.
- The Algonquin base address is household data and is not in any file.
- OSM tags can change; reads are dated 25 Oct 2026.

## Derived files

`python3 tools/towns.py build` re-downloaded GeoNames (cities1000, 25 Oct) and added 49 towns (Canada, Austria, Germany, Arizona, Vermont); `capture.ts derive-near --write` then rewrote `near_town` and `near_town_km` in 13 capture files, so those diffs also carry the new date stamp. `data/relevance/inputs/points.json` was regenerated with `relevance.ts points --build` (a generated file; `--check` fails without it).

## Gate results and coordinator items

`bash tools/check-all.sh` was run with a venv outside the repo (`web/.env.local` does not exist in this worktree). Results:

- Python tests: 266 passed; `test_real_tree_passes_and_is_fast` fails on **main too** (`research/trips/dolomites-july-2027/stays.md` and `stays-august.md` name `legacy/.../PLAN.md`, and a stale baseline entry for `placementBlock.ts::data/reference/towns`). Not from this lane. I ran the stages after it with that one test and the tree check skipped; locations, core tests, typecheck, generated schema, capture build, gap budget, towns, derive-near, validate, suitability, relevance (after `relevance.ts derive --write`), source registry and snapshot stages all passed.
- The web unit tests then stop at 4 failures in 3 files, all caused by the new points (all three pass on the unmodified branch). They sit in `web/` and the legs data, which this lane does not own:
  1. `web/tests/data/places-point-join.test.ts`: pins "98 of 359 pages have no point (was 121), 58 trails (was 81)". Now 58 pages have no point (the trail count in the message reads 58); update the pinned counts.
  2. `web/tests/data/legs-files.test.ts` (two tests): `data/schedules/legs/canadian-rockies-2029.json` has "3 of 36 pairs have no leg". The routed legs file is a result of `web/scripts/legs-ors.mjs`, which needs an ORS key, so it needs a re-run (the moved Waterton marina point and the new points change the pairs).
  3. `web/tests/data/relevance.test.ts`: "the data holds a hand-picked pair with no point". Every hand-picked pair now has a point, so the test's fixture needs a pair that still lacks one (or the assertion changing).
- The stages after the web unit tests (OpenAPI, slugs, e2e) did not run because the script stops at the first failure.
