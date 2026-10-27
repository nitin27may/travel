# Protected-area fixtures (PA-FX)

Synthetic capture records for the parks contract (docs/v2/features/protected-area-entry.md, sections 4, 5 and 13), built before any park
research. Every park, operator, area (`ZZ/Q*`), price (`ZZD`, `ZZE`, `ZZF`) and URL (`example.org`) is invented. Nothing here is a trip,
household data or a research claim, and nothing here ships: tests read this folder, `data/` never does.

The test is `core/test/parks/fixtures.test.ts`. It copies the files into a scratch root with the real validator inputs and runs the real
validator (`validateDoc`), `loadWorld` and the engine's `readProperty` and `completeness`. Conventions follow `../graph/` (EG-FX): same lane
file shape, same operators (`../graph/operators.json` plus `operators.json` here), stub places that raise only tier and point findings.

`locations.json` is the locations store the area ids resolve against. `invalid/expected.json` is the outcome of each invalid file (the
parks codes only: `E_/W_ENTRY*`, `WINDOW*`, `PARK*`, `PLACE_ORPHAN`, `CAP_REL_*`, `CAP_REF`, `CAP_LANE`). Add a fixture by adding the file
and its row; the test fails if the two lists differ.

## valid/ (no parks code, no error, no warning on an offer)

The stub place records also carry `W_PLACE_POINT`, and the campsite lodging offers wait on the stay contract (`W_TIER_REQUIRED`,
`W_CAP_BELOW_USABLE`: access_cost, cost_band, PA-3C). The test ignores exactly those.

| File | Park and jurisdiction | Shapes it proves |
|---|---|---|
| `f1-national.json` | Highcrest National Park (`ZZ/Q1`), national | zone (Glacier Basin) with `part_of`; a **system pass** on the operator (`offer/operator/...#explorer-pass`, no `at`, per-family price, 12-month validity) that the entry fee is `covered_by`; entry fee with a free child row (`age_to`) and `through_traffic` / `pass_holder` exemptions; a lottery bus at the zone (`lottery` window with a `then` rolling, quota per day); a valley shuttle (`fixed_date` then `rolling`, `cancel.until_hours`); a front-country campsite lodging offer (`fixed_date` launch day). Derived: the pass is a system pass and its `at` is firm; the park's `access_cost` is firm |
| `f2-provincial.json` | Pinewater Provincial Park (`ZZ/Q2`), provincial | operating season and gate hours; an annual vehicle pass (`park_pass` at the park, not a system pass); a vehicle permit `covered_by` it with a `camper` exemption; a day-use reservation (`required: some_days`, rolling); a backcountry permit priced `person_night` with a resident row and a foreign row, a `lottery` window with a rolling `then`, quota per night; two campgrounds (one run by a concessionaire); a campsite offer with a `monthly_release` window that `includes` the vehicle permit |
| `f3-straddle.json` | Twinfall National Park (`ZZ/Q3` and `ZZ/Q4`), two jurisdictions | `covers_areas` with two areas; members by `area_id` (two lakes) and by `part_of` (an overlook); two entrance fees run by two agencies in two currencies, each per vehicle valid 7 days from first use; a timed entry with hours in force and a rolling window; an activity permit with `for_types` (a type id of the tree), a lottery and a `same_day` `then` |
| `f4-no-fee-and-half-filled.json` | Open Meadow Reserve (`ZZ/Q5`), Ember Ridge National Park (`ZZ/Q6`) | a reserve with no requirement offer (its `access_cost` is a gap until a sourced `no_limit` is authored on its relevance record, which the test adds to a scratch root and then reads as firm); resident, national and foreign price rows, a free child row, `on_arrival` window, `school_group` and `resident` exemptions; a toll road timed slot (`on` a scenic drive, `cancel.until_hours`); a half-filled permit: window `searched_none`, price `none_stated`, `required: advised` |

Coverage the test asserts across the four files: every access type (`entry_fee`, `park_pass`, `timed_entry`, `day_use_permit`,
`vehicle_permit`, `activity_permit`, `backcountry_permit`, `shuttle_seat`) and a campground offer; every window rule of `WINDOW_RULE`
(as a rule or as a `then`), a `lottery` and a `fixed_date` that each have a `then`; every `required` level and visit mode but `through`;
person, vehicle and group units; `person_night`; all three residencies; a free child row; the keys `quota`, `for_types`, `cancel`,
`change`, `proof`.

## invalid/ (one deliberate fault each; the outcome is `expected.json`)

| File | Fault | Outcome |
|---|---|---|
| `entry-on-a-lake.json` | an `entry` block on a lake | error `E_ENTRY_SCHEMA` |
| `for-types-unknown-node.json` | `for_types` names `water.angling`, not a node of the type tree | error `E_ENTRY_SCHEMA` |
| `then-of-a-then.json` | a `then` inside a `then` | error `E_WINDOW_THEN` |
| `then-on-anytime.json` | a `then` on an `anytime` window | error `E_WINDOW_THEN` |
| `zone-without-park.json` | a zone with no `part_of` | error `E_PARK_ZONE` |
| `covers-unknown-area.json` | `covers_areas` names an area that is not in the store | error `E_PARK_AREA` |
| `covers-a-region.json` | `covers_areas` names a region | error `E_PARK_AREA` |
| `named-area-not-covered.json` | an area named after the park exists and the park does not cover it | warning `W_PARK_AREA` |
| `system-pass-without-fee.json` | a system pass no fee names in `covered_by` | error `E_PLACE_ORPHAN` |
| `system-pass-unknown-operator.json` | a system pass of an operator that is not in `operators.json` | errors `E_CAP_REF`, `E_PLACE_ORPHAN` |

`W_ENTRY_OVERRIDE` needs a relevance sidecar and is covered by `core/test/capture/entry-validate.test.ts`.
