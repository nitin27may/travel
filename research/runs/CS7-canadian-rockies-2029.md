# CS7 batch 1: Canadian Rockies 2029

Lane CS7 (capture contract step 7), batch 1, read on 18 Oct 2026 by travel-researcher (Opus). Records in
`data/capture/canadian-rockies-2029/CS7.json`; relations and payoff fields added in place to `migrated.json`; points appended to
`data/relevance/inputs/points.json`; API runs in `data/capture/runs/api-2026-10-18-cs7-*.json`. Every point is marked "agent checked,
needs a person's check".

## Blockers found (apply to every CS7 trip file)

1. **The migration ledger test freezes suitability and relevance.** `core/test/capture/migration.test.ts` pins the leaf multiset and
   the record count of every suitability and relevance lane file, CS7 files included. Any new value (an `age_band`, a payoff's
   relevance record, a draw move that changes the class) fails it. Batch 1 therefore wrote capture-layer data only and moved one
   suitability fact between existing records (the multiset holds). Fix for a builder: let the test require that no pre-migration leaf
   is lost (superset), or count only the leaves of `migrated.json` files and the pre-migration lane files.
2. **The migration count tests read every capture file.** "339 records", "160 places, 137 routes, 41 offers" and "52 cut out" count
   all files under `data/capture/<trip>/`, so any `CS7.json` fails them (3 tests). Fix: filter the `docs` of the "committed migration
   (counts)" block to `migrated.json`.
3. **`season`, `hours`, `price`, `window`, `best_time`, `best_window` have no `home` in `core/src/schema/capture/properties.ts`.** They
   default to `{ in: "none" }`, so `capture.ts gaps` reports them missing even when a capture record holds them (the prices and windows
   below do not lower the gap count). Fix: `home: cap("<key>")` on each.
4. **`summary` reads `rel.why`.** Access places, stops and huts carry no relevance record (N), so their `summary` R can never be met.
5. **`points.json` is generated** (`relevance.ts points --build`) and its builder has no input for an OSM point of a capture record, so
   the 47 CS7 points were appended by hand as the brief says. A rebuild drops them. Fix: read `point`/`osm_ref` from capture records,
   or a `data/capture/points.json` input.
6. **`area_id` vocabulary.** The only areas are the household store's `areas` (53 rows); of this lane's places only Banff National
   Park (`CA/AB/banff-national-park`) has one. Yoho, Jasper, Kananaskis and every non-Canadian area are left without `area_id`.

## Point issues in the existing data (not changed)

- `part/.../banff-gondola#top` sits on Q125749525 P625 (51.14801, -115.55557), the **lower** terminal. OSM node 10809307025 "Banff
  Gondola Upper Terminal" is 51.14448, -115.57502.

## Backlog rows

| Row | Done | Records |
|---|---|---|
| Sulphur Mountain | yes | summit (`#sulphur-mountain`, Q842987, the mountain's high point 2.5 km south of the top station), Sanson's Peak (OSM node 12244949797, tagged only "2260"), summit boardwalk (starts at the top station, reaches Sanson's Peak; Pursuit "2 km"), Sky Bistro (`part_of` the summit). The trail now `reaches` the summit and Sanson's Peak; the top station is `part_of` the summit. |
| Moraine Lake | yes | Rockpile viewpoint (OSM node 348002838), Rockpile loop (Parks Canada: 0.7 km loop, not 0.8), Parks Canada shuttle stop (node 13240062778), shuttle-seat offer with season, price and window |
| Larch Valley | yes | Sentinel Pass (OSM saddle node 2706106443; Wikidata Q22562892 has Larch Valley's coordinate), Larch Valley (Q22366287). The route `starts_at` the stop, `passes` the valley, `reaches` the pass. The draw stays on the route (blocker 1). |
| Kicking Horse | partly | upper section and lower canyon as river routes (Wild Water's trip pages), Wild Water River Base meeting point. No put-in or take-out is published or mapped: points are `searched_none`; operator question added. The Class III-IV offer is `on` the lower canyon; the family-float offers stay `on` the river (a placement test pins it). |
| Johnston Canyon | yes | Lower and Upper Falls (`part_of` the canyon, OSM waterfall nodes), Ink Pots (OSM node 1366399455), Ink Pots trail (5.5 km, passes both falls). The catwalk walk `passes` both falls; its `reaches` stays the canyon (a migration test pins it). |

## Values for the verifier's sample

| Record | Value | Source |
|---|---|---|
| shuttle seat, Moraine Lake | adult 12.75 CAD (18-64), senior 6.00, youth 4.00 (17 and under), plus 3.50 online booking fee | Parks Canada fees page |
| shuttle seat | window: 40% at a spring launch, 60% at 08:00 MDT two days before | Parks Canada shuttle page (`official_rule`) |
| shuttle seat | season 1 Jun to 12 Oct 2026, weather permitting | same |
| Lake Louise Lakeshore parking | 42.00 CAD per vehicle per day; paid season 15 May to 12 Oct 2026 | Parks Canada fees page (OSM's 36.75 CAD tag is older) |

## Lakes: access points

Parking (OSM) for Bow, Emerald, Lake Minnewanka, Maligne (north-end lot), Mount Lorette Ponds, Pyramid, Wedge Pond and Lake Louise,
plus the Lake Louise and Moraine shuttle stops. Fill times have no capture field yet and `walk_m`, `age_band` and stroller were already
answered for these lakes; Berg and Cameron Lake (off the plan) still lack kids data, which waits for blocker 1.

## Payoff places

Points added for Sarrail Ridge (OSM peak), Sulphur Skyline (OSM viewpoint), the Athabasca Glacier toe (OSM attraction); official links
from the route's land-manager page; up to 2 Commons photos each (Troll Falls: winter only within 300 m, none picked).
