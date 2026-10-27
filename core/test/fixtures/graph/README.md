# Graph fixtures (EG-FX)

Synthetic, privacy-safe capture records that exercise the whole entity graph (docs/v2/features/entity-graph.md) before any real data.
Every name, ref, operator and area id is invented (`ZZ/..` areas, `example.org` URLs). Nothing here is a trip, household data or a
research claim, and nothing here ships: tests read this folder, `data/` never does. The test is
`core/test/capture/graph-fixtures.test.ts`: it validates each file with the real validator and loads the four valid files together with
`loadWorld`, asserting the derived reverse links.

The place records are stubs: the validator also reports non-graph findings on them (`E_PLACE_AREA`, `W_PLACE_POINT`,
`W_TIER_REQUIRED`). The test looks at graph codes only.

`operators.json` is the operator list the files refer to. `expected.json` is the outcome of each invalid file.

## valid/ (no graph code allowed)

| File | Park and jurisdiction | What it proves |
|---|---|---|
| `park-national.json` | Ridgeback National Park (`ZZ/N1`), national | `covers_areas`; a zone (North Valley) and a gated sub-area (Glacier Basin) with a timed-entry offer `at` it; lakes `part_of` zones; parking (`parks_for`) and shuttle stop (`serves`); a hike with a one-level variant (`variant_of`); a three-stage trek chained by `ends_at` to `starts_at` under a whole route; entry fee, vehicle permit, activity permit `on` the trek, guided hike `on` a route with `from_km`/`to_km` and `includes` the fee, canoe rental `at` a lake, a lodging offer that `includes` a fee, operators (`run_by`) |
| `park-provincial.json` | Lakeland Provincial Park (`ZZ/P1`), provincial | two campgrounds (one run by a concessionaire) with campsite offers, a day-use area and its reservation, a canoe route (`starts_at` a boat launch that `serves` a lake, `passes` with `at_km`, `reaches`, `ends_at` an interior site), a backcountry permit `on` the canoe route, a vehicle permit `covered_by` an annual pass, a campsite offer that `includes` the vehicle permit, a canoe rental `at` a lake |
| `park-system.json` | Cedar Point Park and Alder Bay Park (`ZZ/S1`), one park system | one system pass `at` both parks and the `covered_by` target of both parks' day fees |
| `park-straddle.json` | Twin Rivers National Park (`ZZ/E1` and `ZZ/E2`), two jurisdictions | `covers_areas` with two areas; members by `area_id` (no `part_of`) and by `part_of`; two entrance fees run by two agencies; timed entry; a symmetric `alternative_to` pair and a `combo_with` pair, each stored once |

## invalid/ (one deliberate fault each; the outcome is `expected.json`, graph codes only)

| File | Fault | Outcome |
|---|---|---|
| `wrong-target-kind.json` | an access place `parks_for` an offer | error `E_CAP_REL_TARGET` |
| `wrong-source-kind.json` | `run_by` on a lake | error `E_CAP_REL_KIND` |
| `part-of-cycle.json` | two lakes `part_of` each other | error `E_CAP_REL_CYCLE` |
| `two-level-variant.json` | a variant of a variant | error `E_CAP_VARIANT` |
| `third-parent.json` | a lake `part_of` three parks | warning `W_CAP_REL_PARENTS` |
| `ends-at-twice.json` | a route with two `ends_at` | error `E_CAP_REL_CARD` |
| `nested-wrapper.json` | `part/part/place/..#a#b` | error `E_CAP_REF` |
| `symmetric-twice.json` | `combo_with` stored on both sides | error `E_CAP_REL_SYM` |
| `derived-typed.json` | `members` typed on a record | error `E_CAP_REL_DERIVED` |
| `protected-not-top.json` | a nature reserve under a `part/` ref | error `E_CAP_REF_TOP` |
| `stage-gap.json` | two stages that do not chain | warning `W_CAP_STAGE_ORDER` |
| `copied-link.json` | a member repeats its park's conditions link | warning `W_CAP_INHERITED_COPY` |

Add a fixture by adding the file and its `expected.json` row; the test fails if the two lists differ.

## eg-r0/ (the EG-R0 review fixes, PA-C; test: `core/test/capture/relations-eg-r0.test.ts`)

| File | Shape | Outcome |
|---|---|---|
| `two-parks-one-area.json` | two protected areas covering one area (a peace park over a national park), a lake in it, and a reserve that covers it too but sits `part_of` the national park | no `E_CAP_REL_CYCLE` (M1: a record with `covers_areas` is never an area member); the lake has both parks as containers |
| `merge-loop.json` | stages A to B, B to C and C back to B | warning `W_CAP_STAGE_ORDER` (S4: two stages end where one starts) |
| `alias-self.json` | a lake `part_of` its own alias; a pond naming one park three times, once through an alias | error `E_CAP_REL_REF` (S5) and warning `W_CAP_REL_DUP` without `W_CAP_REL_PARENTS` (S10) |
