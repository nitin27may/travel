# Suitability applicability: which fields apply to which kind

Status: draft (18 Oct 2026). Planning only. This page sits between the merged S0 schema and the research lanes. Build order: this page, then a Fable check of the display rules (section 5), then **S0b** (the schema delta, section 6), then the lanes R1-R6 (section 8).

> **Note (18 Oct 2026):** [capture-contract.md](capture-contract.md) attaches these profiles to nodes of one type tree. `data/schema/suitability-applicability.json` then becomes generated from `data/vocab/types.json`; the matrix itself is unchanged, and ten new profiles are added (capture-contract 2.3). Under the three-layer model, effort drivers on the viewpoint, lake and waterfall profiles move to the routes that reach them (capture-contract 2.7.2).

Owner direction (18 Oct 2026), summarised:
- Every property must apply to the place it describes. The schema must not put every field on every place.
- Some metadata only makes sense for a few kinds, such as rafting or bungee. Work out what those are.
- Check the design principles against the properties before implementation starts.

This page **extends** [suitability.md](suitability.md). It **supersedes**:
- the column marks of the F-check table (suitability.md section 4). The F ids stay as labels. Which kind counts which field is now the applicability table (section 7.1), at subkind level;
- the K1 trade-off "some fields are `not_applicable` for many kinds". Not-applicable is now a property of the kind, held in data. It is no longer a value a lane types on each record;
- the "Flatwater only" Places filter (suitability.md 6.3). The Effort filter covers it (section 5.4);
- `water_safety.min_age_on_board`, `ext.trail.hazards`, `ext.ferrata.guide` and `ext.paddle.craft: boat_tour`. They move to shared fields (section 6). No sidecar uses any of them today.

It does not cover **relevance**: whether a place is worth the journey, its draw tier, substitutes, its role in a trip, and its fit for a day trip or a vacation. That is [relevance.md](relevance.md) (a parallel plan). The two share one research pass (section 8.3) and nothing in the schema.

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| A1 | **Every field is R, A or N per profile**, held in one data file, `data/schema/suitability-applicability.json`. R counts for Usable, A counts for Complete, N is never asked, shown or counted. | The owner's rule, enforced in one place that the validator, the completeness engine, the UI and the lane briefs all read | The table needs a review whenever a field or a kind is added |
| A2 | **Rows are profiles keyed by kind and subkind (34 profiles).** `subkind` becomes a closed vocabulary and is required. | A canoe rental and a Class III raft are both `activity`, but they need different fields | S0b must assign a subkind to all 284 sidecar records (section 8) |
| A3 | **An `operated` flag adds the operator layer** (limits, guide, waiver, weather cancellation) to profiles that are sometimes self-guided: hike, walk, wildlife, show cave, canoe and kayak, SUP, cycle path. | A self-guided hike asks nothing about waivers. A guided heli-hike or a ranger-led cave tour does. One row with a layer is simpler than doubling the rows. | One more record field (`operated: boolean`) |
| A4 | **A new shared `participation` group** holds the adventure rules that apply only to operated activities: guide, kit provided, what to wear, minimum shoe size, fitness, medical exclusions, pregnancy, waiver and guardian age, weigh-in, and weather cancellation. Offers inherit it. | These rules differ by product (Norquay routes 12+ and 14+), so they belong in the block that offers carry, not in a kind extension | The shared block grows by one group. It is N for 12 of 34 profiles and applies only when operated for 3 more. |
| A5 | **Ten new extensions** (`lift`, `boat`, `zip`, `jump`, `coaster`, `horse`, `glacier`, `flight`, `wildlife`, `drive`) and new fields on four existing ones (`ride`, `paddle`, `ferrata`, `cave`, plus `water`) | Each holds facts that only that kind has: a crampon's minimum shoe size, a paraglider's weight limit by time slot, a 100 m bear distance | 41 new fields in total (section 6.1) |
| A6 | **Three new shared fields**: `solo` (age or height to go without an adult), `stroller_on_board` (a carriage rule, unlike `stroller`, which is a surface), and `hazards` (moved out of the trail extension and typed with `HAZARD_CATEGORY`) | All three apply across several kinds: chairlift, coaster and ski lift for `solo`; lift, boat and flight for `stroller_on_board`; trails, beaches and wildlife for `hazards` | `hazards` changes type. No record uses the old field. |
| A7 | **Three suitability chips at rest on a day row and the place page; two on a place card (kids, effort; P8). Hard limits are merged into one chip, and its "+n" counts every remaining operator ban, including pregnancy and medical exclusions.** Kit, wear, fitness, waiver and weigh-in go into the entry's "Know before you go" bullets (trip-timeline.md 3.10). Display design: [design/suitability-display.md](../../docs/v2/design/suitability-display.md). | It satisfies the P2 safety exception and the 3-chip cap together (section 5.1) | The limits chip can be long: "Age 8+ · 23 kg min · swim test +2". The rule is at most three values, then "+n". |
| A8 | **Every kind feeds two derived values**: `kids_from` and `family_effort`, plus the tri-state `stroller_ok`. The filters read only these. | Adding a kind adds a mapping row and never a filter (P4) | Kinds with effort N (bungee, boat, lift) leave the results while the Effort filter is active. The count line says so. |
| A9 | **A present N field is a warning (`W_SUIT_NA_FIELD`), and a missing R field caps the record below Usable** (`suit_level` computed). A per-record exemption from an R or A field is the existing `not_applicable` state, which needs a `note`. | The owner's validator rule. The exemption covers real one-offs, such as a lift with no walk at the top. | Lanes must not use `not_applicable` to dodge research. An exemption without a `note` is an error. |
| A10 | **Water class is the effort grade for paddling.** For paddle profiles `effort.source_grade` is N, and derive reads `water_safety.class`. | The same grade in two places would drift | derive.ts gains one branch. The Class II terrain-3 test (S0 step 4) moves to `water_safety.class`. |

## 1. How applicability works

| Mark | Lane asks for it | UI shows it | Completeness |
|---|---|---|---|
| **R** | always, in the first pass | at its slot; when missing, "Not checked yet" in that slot (P2 owner rule: empty markers stay visible) | a Usable check. A missing R field keeps the record below Usable. |
| **A** | in the same pass when a source on the lane's list has it. No extra search is needed, but a `searched_none` is welcome. | at its slot when known. When missing, all missing A fields of a section collapse into one line: "Not checked yet: toilets, signal". | a Complete check |
| **N** | never | never, not even as "not stated" | not counted. A present N field gives `W_SUIT_NA_FIELD`. |

- **Answered** means a `value`, `no_limit`, `none_stated` or `searched_none` (with `on` and `tried`). A `gap` is not answered. Soft answers (`none_stated`, `searched_none`) still count as answered but can cap the level at `usable_partial` (suitability.md 4.1).
- **Offers.** An offer is checked against its parent's profile. An offer's own fields win, and the rest fall back to the record (data/suitability/README.md). An R field is answered when the offer or the record answers it.
- **The `operated` layer (A3).** When `operated: true`, the cells marked `op` in the matrix become R and the other participation cells become A. When it is `false`, they become N. The profiles that are always operated (zip line, bungee, rafting, and so on) have `operated` fixed true in the table.
- **Profiles that split a record.** A lake with a canoe rental is two records: `lake` (shore) and `canoe_kayak` (the rental, related by `combo_with`). A waterfall reached by a 4 km trail keeps `walk_m` and `exposure`, and the trail is its own `hike` record. Profiles never merge two kinds to collect fields.

### 1.1 Profiles (rows)

| Profile | Kind / subkinds | Today's sidecar records | Example |
|---|---|---|---|
| `hike` | trail / `hike`, `scramble`, `trek_stage`; activity / `guided-hike`, `heli-hike` (with `operated`) | 104 trails (as `hike` until a lane reclassifies), 5 guided hikes, 1 heli-hike | Larch Valley; Athabasca icewalk is a `glacier`, not a hike |
| `walk` | trail / `walk` | 0 (lanes reclassify short trails) | Pa'rus Trail |
| `viewpoint` | viewpoint / `viewpoint`, `summit`, `pullout` | 22, plus Rockies rows that S0b reclassifies | Cadini di Misurina |
| `lake` | lake / `lake` (a shore visit) | 11, plus about 19 Rockies "sights" | Lago di Braies |
| `swim` | swim_spot / `swim_spot` | 0 | Lac aux Americains |
| `waterfall` | waterfall / `waterfall`, `canyon`, `gorge` | 0, plus about 10 Rockies "sights" | Ragged Falls |
| `beach` | swim_spot / `beach` | 0 | Djupalonssandur (sneaker waves) |
| `drive` | drive / `scenic_drive` (**new kind**) | 0, plus 2 (Red Rock Parkway, Hwy 742) | Red Rock Parkway |
| `town` | town / `town`, `village`, `city` | 26 | Cortina |
| `sight` | sight / `museum`, `castle`, `landmark`, `historic_site`, `visitor_centre`, `attraction` | 70 (after reclassifying about 14) | Cave and Basin; Glacier Skywalk (`attraction`) |
| `lift` | lift / `gondola`, `cable_car`, `chairlift`, `funicular`, `rack_railway`, `scenic_train` | 9 | Banff Gondola, Aiguille du Midi |
| `boat` | activity / `boat-tour`, `cruise`, `zodiac`, `boat-shuttle` | 4 | Maligne Lake cruise, Crypt Lake shuttle |
| `canoe_kayak` | activity / `canoe`, `kayak` | 3 | Lake Louise canoe |
| `sup` | activity / `sup` (**new**) | 0 | |
| `rafting` | activity / `rafting` (whitewater) | 3 (one moves to `float`) | Kicking Horse Class III-IV |
| `float` | activity / `float` (**new**) | 1 (Bow River) plus the family float offers | Bow River float |
| `zipline` | activity / `zipline` | 0 (Golden Skybridge has a zip offer) | |
| `bungee` | activity / `bungee`, `swing` (**new**) | 0 | Verzasca Dam |
| `ferrata` | activity / `via-ferrata` | 1 | Norquay |
| `mtb_lift` | activity / `bike-park` (**new**) | 0 | Whistler Bike Park |
| `mtb_xc` | activity / `mtb` (**new**) | 1 (Canmore Nordic Centre) | |
| `cycle_path` | activity / `cycling` | 3 | Drava path, Legacy Trail |
| `horse` | activity / `horse` | 3 | Banff Trail Riders |
| `show_cave` | sight / `cave` | 0 | Jewel Cave scenic tour |
| `caving` | activity / `caving` (**new**, replaces `cave` for adventure caving) | 0 | |
| `glacier` | activity / `glacier-walk`, `ice-trek` | 2 (Athabasca icewalk, Patagonia minitrekking) | Minitrekking 8-65 |
| `snow` | activity / `ski`, `snowshoe`, `sled` | 0 | |
| `wildlife` | activity / `wildlife` (tour); place / `wildlife_viewing` (self) | 2 | Jasper wildlife tour, the elk rut |
| `hot_spring` | swim_spot / `hot_spring`; activity / `hot-springs`, `thermal-bath`, `spa` | 4 | Myvatn Nature Baths |
| `coaster` | activity / `coaster` | 1 (Funbob) | Funbob Monte Baranci |
| `paraglide` | activity / `paragliding` | 0 | Interlaken tandem |
| `air_tour` | activity / `heli`, `scenic-flight`, `vehicle-tour` (**new**) | 2 (heli flight, Ice Explorer) | Columbia Icefield Ice Explorer |
| `stay` | stay / all `STAY_KIND` | 0 | |
| `eatery` | eatery / all | 0 | |

Two records do not fit a profile yet. Jasper Dark Sky stargazing becomes `sight` / `attraction`, operated, with `access_season`. The Banff Springs spa becomes `hot_spring` / `spa`. An event profile (the elk rut, festivals) is out of scope; `event.md` covers it.

## 2. The matrix

Cells: **R** required for Usable; **A** applicable, shown when known; **N** not applicable; **op** R only when `operated` is true, otherwise N. Field names are the schema's. The tables split by field group so that each stays readable; every table has all 34 rows (some tables group rows that share every cell).

### 2.1 Hard limits

| Profile | min_age | max_age | height (min, max) | weight (min, max) | limit_reason | adult_required | solo (new) | group_min |
|---|---|---|---|---|---|---|---|---|
| hike | A | N | N | N | N | op | N | R |
| walk | A | N | N | N | N | op | N | A |
| viewpoint | N | N | N | N | N | N | N | N |
| lake | N | N | N | N | N | N | N | N |
| swim | N | N | N | N | N | A | N | N |
| waterfall | N | N | N | N | N | N | N | A |
| beach | N | N | N | N | N | A | N | N |
| drive | N | N | N | N | N | N | N | N |
| town | N | N | N | N | N | N | N | N |
| sight | A | N | N | N | N | A | N | N |
| lift | A | N | A | N | A | A | A | N |
| boat | R | N | N | N | A | A | N | N |
| canoe_kayak | R | N | N | A | A | R | N | N |
| sup | R | N | N | A | A | R | N | N |
| rafting | R | A | N | R | R | A | N | N |
| float | R | N | N | A | A | A | N | N |
| zipline | R | N | R | R | R | R | N | N |
| bungee | R | A | N | R | R | N | N | N |
| ferrata | R | N | A | R | R | R | N | N |
| mtb_lift | R | N | N | N | N | A | N | N |
| mtb_xc | N | N | N | N | N | N | N | N |
| cycle_path | N | N | N | N | N | N | N | N |
| horse | R | N | N | R | R | R | N | N |
| show_cave | A | N | N | N | N | A | N | N |
| caving | R | N | N | N | A | R | N | N |
| glacier | R | A | N | N | A | R | N | N |
| snow | A | N | N | N | N | A | A | N |
| wildlife | op | N | N | N | N | op | N | N |
| hot_spring | R | N | N | N | N | R | N | N |
| coaster | R | N | R | R | A | R | R | N |
| paraglide | R | A | N | R | R | A | N | N |
| air_tour | R | N | N | A | A | A | N | N |
| stay | A | N | N | N | N | N | N | N |
| eatery | N | N | N | N | N | N | N | N |

Notes:
- **`group_min` is R for `hike`** (F2 was U for every trail). Parks Canada's group-of-four rule stops a family of three. The lane answers it once per park from the restrictions page, which covers every trail in the park, so it costs one read, not one per trail.
- **The bungee guardian rule is not `adult_required`.** A parent signs and need not jump. It goes in `participation.waiver.guardian_signs_under`.
- **`mtb_xc` and `cycle_path` have no limits.** The rental age is `ext.ride.min_rider_age`, which is A on the rental offer.
- **`max_age` is A where a source has published one**, such as the minitrekking upper limit of 65 and one Interlaken listing's 60. It is N wherever no operator uses it.

### 2.2 Who it suits

| Profile | age_band | kid_note | carrier_ok | stroller + extent | stroller_on_board (new) | wheelchair | access_detail | accessible_toilet | accessible_parking | limited_capacity_note |
|---|---|---|---|---|---|---|---|---|---|---|
| hike | R | R | R | R | N | A | A | A | A | A |
| walk | R | R | R | R | N | R | A | A | A | A |
| viewpoint | R | R | A | R | N | R | A | A | A | A |
| lake | R | R | A | R | N | R | A | A | A | A |
| swim | R | R | N | A | N | A | A | A | A | A |
| waterfall | R | R | R | R | N | R | A | A | A | A |
| beach | R | R | N | A | N | A | A | A | A | A |
| drive | N | A | N | N | N | N | N | A | N | N |
| town | N | A | N | R | N | R | A | A | A | A |
| sight | A | R | A | R | N | R | A | A | A | A |
| lift | A | A | A | N | R | R | A | A | A | A |
| boat | R | R | N | N | R | R | A | A | A | A |
| canoe_kayak | R | R | N | N | N | A | N | N | N | A |
| sup | R | R | N | N | N | N | N | N | N | N |
| rafting | R | R | N | N | N | N | N | N | N | N |
| float | R | R | N | N | N | A | N | N | N | A |
| zipline | R | R | N | N | N | A | N | N | N | A |
| bungee | R | R | N | N | N | N | N | N | N | N |
| ferrata | R | R | N | N | N | N | N | N | N | N |
| mtb_lift | R | R | N | N | N | N | N | N | N | N |
| mtb_xc | R | R | N | N | N | N | N | N | N | A |
| cycle_path | R | R | N | N | N | N | N | N | N | A |
| horse | R | R | N | N | N | N | N | N | N | N |
| show_cave | R | R | R | R | N | R | A | A | A | A |
| caving | R | R | N | N | N | N | N | N | N | N |
| glacier | R | R | N | N | N | N | N | N | N | N |
| snow | R | R | N | N | N | N | N | N | N | N |
| wildlife | R | R | A | A | A | A | N | N | N | A |
| hot_spring | R | R | N | N | N | R | A | A | A | A |
| coaster | R | R | N | N | N | A | N | N | N | N |
| paraglide | R | R | N | N | N | A | N | N | N | N |
| air_tour | R | R | N | N | A | A | N | N | N | A |
| stay | N | A | N | A | N | R | A | A | A | N |
| eatery | N | A | N | A | N | R | N | A | N | N |

Notes:
- **`stroller` is a surface** (can you push it here). **`stroller_on_board` is a carriage rule** (may you bring it aboard). Maligne Lake Cruise refuses strollers on its boats and lets you leave them at the dock. That is a boat fact, not a surface. On conveyances, `stroller` is N and `stroller_on_board` is R.
- **`carrier_ok` is R for `show_cave`.** Jewel Cave bans backpack carriers and also carrying children by hand on its Scenic Tour (Recreation.gov listing). A toddler cannot do it.
- **`wheelchair` is A for zip line, paraglide and canoe**, because adaptive versions exist. When it is unknown it collapses into the "Not checked yet" line. It is never a chip.
- **`age_band` is N for town, drive, stay and eatery.** Any age goes. A child note ("cobbles: bring the all-terrain stroller") is enough.

### 2.3 Effort and time

| Profile | effort.source_grade | distance_km | gain_m | surface | scrambling | fixed_aids | adult_time_min | child_time_min | on_site_min |
|---|---|---|---|---|---|---|---|---|---|
| hike | R | R | R | A | A | A | R | A | N |
| walk | A | R | R | R | N | A | R | A | N |
| viewpoint | N | A | A | A | N | N | N | N | R |
| lake | N | A | A | A | N | N | N | N | R |
| swim | N | A | N | A | N | N | N | N | R |
| waterfall | A | R | A | A | N | A | A | N | R |
| beach | N | A | N | A | N | N | N | N | R |
| drive | N | N | N | N | N | N | N | N | R |
| town | N | N | N | N | N | N | N | N | A |
| sight | N | N | N | N | N | N | N | N | R |
| lift | N | N | N | N | N | N | N | N | R |
| boat | N | N | N | N | N | N | N | N | R |
| canoe_kayak | N | A | N | N | N | N | N | N | R |
| sup | N | A | N | N | N | N | N | N | R |
| rafting | N | A | N | N | N | N | N | N | R |
| float | N | A | N | N | N | N | N | N | R |
| zipline | N | N | N | N | N | N | N | N | R |
| bungee | N | N | N | N | N | N | N | N | R |
| ferrata | R | A | R | N | N | N | R | N | N |
| mtb_lift | R | N | N | N | N | N | N | N | A |
| mtb_xc | R | R | R | A | N | N | R | N | N |
| cycle_path | R | R | R | R | N | N | R | N | N |
| horse | N | A | N | N | N | N | N | N | R |
| show_cave | N | A | N | N | N | N | N | N | R |
| caving | R | N | N | N | A | N | N | N | R |
| glacier | A | A | A | N | N | N | N | N | R |
| snow | R | N | N | N | N | N | N | N | A |
| wildlife | N | A | N | N | N | N | N | N | R |
| hot_spring | N | N | N | N | N | N | N | N | R |
| coaster | N | N | N | N | N | N | N | N | R |
| paraglide | N | N | N | N | N | N | N | N | R |
| air_tour | N | N | N | N | N | N | N | N | R |
| stay | N | N | N | N | N | N | N | N | N |
| eatery | N | N | N | N | N | N | N | N | N |

Notes:
- **Paddling has its grade in `water_safety.class` (A10).** Family effort for canoe, SUP, rafting and float comes from that class.
- **`source_grade` for `mtb_lift` is the park's trail-colour mix** (`ext.ride.trail_mix`), and the record's grade is its easiest lift-served trail. A park with no green trail is FE3 or more for a child.
- **`ferrata` has `fixed_aids` N** because the cable is the kind. Its length and vertical go in `distance_km` and `gain_m`.
- **For a waterfall, the walk from the car (`distance_km`) is R**, because it decides between a viewpoint stop and a hike.

### 2.4 Facilities

| Profile | toilets | water | food | shade | bail_out | signal |
|---|---|---|---|---|---|---|
| hike | A | A | A | A | A | A |
| walk | A | N | A | A | N | N |
| viewpoint | A | N | A | N | N | N |
| lake | A | N | A | A | N | N |
| swim | R | N | A | A | N | N |
| waterfall | A | N | A | N | N | N |
| beach | R | N | A | A | N | N |
| drive | A | N | A | N | N | A |
| town | A | N | N | N | N | N |
| sight | A | N | A | N | N | N |
| lift | A | N | A | N | N | N |
| boat | A | N | A | N | N | N |
| canoe_kayak | A | N | N | N | N | N |
| sup | A | N | N | N | N | N |
| rafting | A | N | N | N | N | N |
| float | A | N | N | N | N | N |
| zipline | A | N | N | N | N | N |
| bungee | N | N | N | N | N | N |
| ferrata | N | N | N | N | R | A |
| mtb_lift | A | A | A | N | N | N |
| mtb_xc | N | A | N | A | A | A |
| cycle_path | A | A | A | A | A | N |
| horse | A | N | N | N | N | N |
| show_cave | A | N | N | N | N | N |
| caving | N | N | N | N | N | N |
| glacier | A | N | N | N | N | N |
| snow | A | N | A | N | N | N |
| wildlife | A | N | N | N | N | N |
| hot_spring | R | N | A | N | N | N |
| coaster | A | N | N | N | N | N |
| paraglide | N | N | N | N | N | N |
| air_tour | A | N | N | N | N | N |
| stay | N | N | N | N | N | N |
| eatery | N | N | N | N | N | N |

Notes:
- **`toilets` gains `on_board`** for boats, scenic trains and the Ice Explorer, and `station` for lifts. A cabin is never asked about toilets. The station is.
- **The ferrata `bail_out` is its escape points**, and it is R. No new field is needed: `{name, at_km}` fits "exit after the bridge, 45 min".
- **`hike` bail-out stays A** (F10 is C). The turnaround a family needs is in `kid_note` (R).

### 2.5 Hazards, water and season

| Profile | exposure | altitude_m | hazards (new shared) | ws.class | ws.lifejacket + child sizes | ws.swim_ability | ws.lifeguard | ws.entry | ws.water_temp_c | ws.current_or_tide | access_season |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hike | R | A | R | N | N | N | N | N | N | N | R |
| walk | R | A | A | N | N | N | N | N | N | N | R |
| viewpoint | R | A | A | N | N | N | N | N | N | N | R |
| lake | A | A | A | N | N | N | N | A | A | N | R |
| swim | A | N | R | N | N | A | R | R | R | R | R |
| waterfall | R | A | A | N | N | N | N | N | N | A | R |
| beach | A | N | R | N | N | N | R | R | A | R | A |
| drive | A | A | A | N | N | N | N | N | N | N | R |
| town | N | N | N | N | N | N | N | N | N | N | N |
| sight | N | N | N | N | N | N | N | N | N | N | A |
| lift | N | R | N | N | N | N | N | N | N | N | R |
| boat | N | N | A | A | R | N | N | N | A | N | R |
| canoe_kayak | N | N | A | R | R | A | N | N | R | A | R |
| sup | N | N | A | R | R | R | N | N | R | A | A |
| rafting | N | N | N | R | R | R | N | N | R | N | R |
| float | N | N | N | R | R | A | N | N | A | N | R |
| zipline | N | N | N | N | N | N | N | N | N | N | R |
| bungee | N | N | N | N | N | N | N | N | N | N | R |
| ferrata | R | R | A | N | N | N | N | N | N | N | R |
| mtb_lift | N | N | N | N | N | N | N | N | N | N | R |
| mtb_xc | A | A | A | N | N | N | N | N | N | N | A |
| cycle_path | N | N | A | N | N | N | N | N | N | N | A |
| horse | A | N | N | N | N | N | N | N | N | N | R |
| show_cave | N | N | N | N | N | N | N | N | N | N | R |
| caving | A | N | A | N | N | A | N | N | N | N | R |
| glacier | R | A | R | N | N | N | N | N | N | N | R |
| snow | A | R | A | N | N | N | N | N | N | N | R |
| wildlife | N | N | R | N | N | N | N | N | N | N | R |
| hot_spring | N | N | N | N | N | N | A | A | R | N | R |
| coaster | N | N | N | N | N | N | N | N | N | N | R |
| paraglide | N | A | N | N | N | N | N | N | N | N | R |
| air_tour | N | A | N | N | N | N | N | N | N | N | R |
| stay | N | N | N | N | N | N | N | N | N | N | A |
| eatery | N | N | N | N | N | N | N | N | N | N | A |

Notes:
- **`hazards` is R where a hazard decides the day** for a family: bears on trails, sneaker waves and tides on beaches, crevasses on glaciers, and the elk rut for wildlife. It is the P2 "main hazards" item.
- **`altitude_m` is R for lifts and snow.** The top station is the high point. Aiguille du Midi is at 3,842 m, which matters for a toddler. The chip is advice only (suitability.md 1.2).
- **`water_temp_c` is R for canoe, SUP and rafting.** Glacial lakes and rivers make a capsize a cold-shock event. For hot springs it is the pool temperature: Parks Canada keeps Banff Upper Hot Springs at 37-40 °C.

### 2.6 Participation (new shared group; adventures only)

| Profile | guide | kit_provided | wear (and min_shoe_eu) | fitness | medical | pregnancy | waiver (guardian age) | weigh_in | weather_cancel |
|---|---|---|---|---|---|---|---|---|---|
| hike, walk | op | N | op | op | N | N | op | N | op |
| viewpoint, lake, swim, waterfall, beach, drive, town | N | N | N | N | N | N | N | N | N |
| sight | N | N | N | N | N | N | N | N | N |
| lift | N | N | N | N | N | N | N | N | R |
| boat | N | A | A | N | A | A | N | N | R |
| canoe_kayak | A | A | A | N | N | N | A | N | A |
| sup | A | A | A | N | N | N | A | N | A |
| rafting | N | R | R | A | A | R | R | A | R |
| float | N | A | A | N | N | A | A | N | A |
| zipline | N | N | R | A | A | R | R | A | R |
| bungee | N | N | A | N | R | R | R | R | A |
| ferrata | R | R | R | R | A | A | R | N | R |
| mtb_lift | A | A | A | A | N | N | R | N | A |
| mtb_xc, cycle_path | N | N | N | N | N | N | N | N | N |
| horse | N | A | R | N | A | R | R | A | A |
| show_cave | N | N | A | N | N | N | N | N | N |
| caving | R | R | R | A | A | A | R | N | A |
| glacier | R | R | R | R | A | A | R | N | R |
| snow | N | A | N | N | N | N | N | N | N |
| wildlife | N | N | op | N | N | N | N | N | op |
| hot_spring | N | N | A | N | A | R | N | N | N |
| coaster | N | N | N | N | A | R | N | N | R |
| paraglide | N | N | R | R | A | R | R | R | R |
| air_tour | N | N | N | N | A | A | A | A | R |
| stay, eatery | N | N | N | N | N | N | N | N | N |

Notes:
- **`weather_cancel` replaces `attrs.weather_dependent`** (adventure.md U6) and `attrs.weather_closure` (lift.md) as the one home for "what cancels it". The catalog `attrs` become a projection when catalog rows exist (as K9 does for the flat columns).
- **`pregnancy` is R wherever operators ban it**: bungee (UKBC, Verzasca), coasters (the Les Orres terms), rafting, zip line, horse and paraglide. For hot springs Parks Canada advises consulting a physician. That is `ask_doctor`, not a ban.
- **`min_shoe_eu` is a real child gate on glaciers.** Skaftafell operators require EU 34-35 because the crampons do not fit smaller boots. It lives with `wear`.

### 2.7 Extension fields (only their own profiles; N everywhere else)

| Extension | Field | R in | A in |
|---|---|---|---|
| `trail` | `navigation` | hike | walk |
| | `shape`, `water_crossings`, `dogs` | | hike, walk |
| | `snowfields_until` | | hike |
| | `walk_m` (from the car) | viewpoint, lake, waterfall, beach | swim, wildlife |
| `ride` | `traffic` | cycle_path | mtb_xc |
| | `bike_hire`, `min_rider_age`, `one_way_return` | | cycle_path, mtb_xc, mtb_lift (hire only) |
| | `lift_served` (new) | | mtb_xc |
| | `e_bike` (new) | mtb_lift | mtb_xc, cycle_path |
| | `kids_bike_sizes` (new) | mtb_lift | mtb_xc, cycle_path |
| | `skills_park` (new) | | mtb_lift, mtb_xc |
| | `trail_mix` (new) | mtb_lift | |
| `paddle` | `craft` | canoe_kayak, sup, rafting, float | |
| | `class_at_level` (by section and month) | rafting | float |
| | `sections` (new) | rafting | float |
| | `on_water_min` (new) | rafting, float | canoe_kayak, sup |
| | `wind_exposure` (new) | canoe_kayak, sup | float |
| | `portages` (new) | | canoe_kayak |
| | `craft_capacity` (new) | canoe_kayak | sup |
| | `guided` (new) | canoe_kayak, sup | |
| | `trip_style` (new: `family_float`, `whitewater`) | rafting, float | |
| `ferrata` | `kit` (rent or own) | ferrata | |
| | `child_harness` (new) | | ferrata |
| | `approach_min`, `descent` (new) | | ferrata |
| | `kit_weight_note` | | ferrata |
| `water` | `swimming` (new) | swim, beach | lake |
| | `clarity` (new) | | hot_spring, swim |
| | `floats_required_under` (new) | | hot_spring, swim |
| `cave` | `air_temp_c` | show_cave, caving | |
| | `steps` | show_cave | caving |
| | `squeeze`, `darkness` (new) | caving | show_cave |
| | `wet` (new) | caving | |
| | `carry_child` (new) | show_cave | |
| `snow` | `ski_school_min_age`, `magic_carpet`, `lift_child_rules` | | snow |
| `lift` (new) | `cabin`, `last_up`, `last_down` | lift | |
| | `ride_min` | | lift |
| `boat` (new) | `vessel`, `sea_state` | boat | |
| | `seasick_risk`, `landing` | | boat |
| `zip` (new) | `braking` | zipline | |
| | `lines`, `tandem_under_kg`, `kids_course`, `between_lines` | | zipline |
| `jump` (new) | `height_m`, `tandem`, `harness` | | bungee |
| `coaster` (new) | `max_riders`, `max_load_kg`, `driver_rule` | coaster | |
| | `brake` | | coaster |
| `horse` (new) | `lead_rein` | horse | |
| | `share_horse`, `pace`, `pony_option` | | horse |
| `glacier` (new) | `traction`, `boots` | glacier | |
| | `ice_min` | | glacier |
| `flight` (new) | `flight_min` | paraglide, air_tour | |
| | `weight_by_slot` | paraglide | air_tour |
| | `takeoff_run_m` | paraglide | |
| | `seat_weight_rule` | | air_tour |
| `wildlife` (new) | `min_distance_m`, `best_time` | wildlife | |
| | `stay_in_vehicle`, `sightings`, `quiet_needed`, `peak_months` | | wildlife |
| `drive` (new) | `vehicle_limits`, `road_surface`, `drive_min` | drive | |
| | `fuel_gap_km`, `winding` | | drive |

Profiles with no extension: town, sight (unless `show_cave`), stay, eatery, hot_spring (it uses `water`).

## 3. Kind-specific properties: what operators and authorities publish

Every field below is one a parent or a less able visitor would decide on. Sources were read through search results on 18 Oct 2026. These are **examples that justify the field, never values to copy**: K3 still holds, and a limit from one operator is never carried to another.

### 3.1 Whitewater rafting and river floats

| Field | What it decides | What operators publish | Source |
|---|---|---|---|
| `water_safety.class` + `ext.paddle.class_at_level` + `sections` | Is this a family float or whitewater, on our dates and on our section? | Kicking Horse "Gentle" is Class I-III and "Tradition" is Class II-IV on the same river. One operator warns that river conditions may raise the minimum age and weight at short notice. | manawa.com/en/book/46817 and /46819; adventures.com (Glacier Raft Co, family-adventure) |
| `trip_style` (`family_float` or `whitewater`) | The filter-level split a parent wants | The Bow River float has "no rapids" and a minimum age of 2; Kicking Horse family trips are 6-8+ | banffadventures.com/things-to-do/float-trips; adventures.com |
| `min_age`, `min_weight_kg` | A child under 23 kg is out | Hydra: 8+ and 50 lb (23 kg); Banff Adventures: 6+ and 50 lb; Glacier Raft: 4+ | adventures.com; banffadventures.com/news/make-a-splash-with-banff-adventures |
| `participation.kit_provided` | Glacial water: is the cold handled? | Wetsuit, fleece, spray jacket, booties, helmet and PFD provided (Wild Water, Hydra) | manawa.com/en/book/46817; adventures.com |
| `water_safety.swim_ability` | A child who cannot swim is out on Class III+ | ACE (Upper New): swim 25 yd in flat water with a PFD and swim in current; Lutschine (glacial, III-IV): 14+, strong swimmers only, no exceptions | aceraft.com/eligibility-criteria; outdoor.ch/en/faq/what-is-the-minimum-age-for-river-rafting-on-the-luetschine |
| `ext.paddle.on_water_min` vs `on_site_min` | A 1-hour float is a 3-hour outing | Bow River float: 1 h on the water; listings give a 1-3 h total | banffadventures.com/things-to-do/float-trips; banfflakelouise.com/experiences/bow-river-float-trip |
| `participation.waiver.guardian_signs_under` | A parent must be present to sign | Wild Water: minors need a parent or guardian to sign the waiver | manawa.com/en/book/46817 |
| `water_safety.water_temp_c` | Cold shock on a capsize | No operator page found that publishes the temperature. **Expect `searched_none`.** The lane notes glacial source rivers and uses `our_inference` with a note. | search 18 Oct 2026 (nothing found) |

### 3.2 Bungee and giant swing

| Field | Published examples | Source |
|---|---|---|
| `min_weight_kg`, `max_weight_kg` | Verzasca Dam 45-115 kg; UKBC 35-120 kg | manawa.com (Verzasca 220 m); ukbungee.co.uk/faq |
| `participation.medical` (excluded vs ask a doctor) | Verzasca excludes heart, epilepsy and neurological disorders; UKBC requires medical advice for high blood pressure, heart conditions and epilepsy | manawa.com; ukbungee.co.uk Health Warning Notice PDF |
| `participation.pregnancy` | Barred everywhere it is stated | same |
| `participation.waiver.guardian_signs_under` | Verzasca: written parental consent under 18; UK: 14+, with a parent's signature for 14-16 | same |
| `participation.weigh_in` | Operators weigh on site. A child at the limit can be turned away on the day. | ukbungee.co.uk/faq |
| `ext.jump.tandem` | Some swings take two riders | operator pages (lane to confirm per site) |

### 3.3 Zip line

| Field | Published examples | Source |
|---|---|---|
| weight both ends, `min_age`, `adult_required` | Anakeesta: 7+, 70-270 lb, under 12 with an adult aged 18+; MegaZip: 10+, up to 260 lb, height 48-82 in | tripster.com (Anakeesta, MegaZip); suitability.md 2.5 |
| `ext.zip.braking` (`self`, `guide`, `automatic`) | Wimberley is truly self-braking (the rider stops with upper-body strength), with lower weight limits for that reason; Anakeesta guides brake for you | wimberleyzipline.com; tripster.com |
| `ext.zip.tandem_under_kg` | Coral Crater: under 50 lb rides tandem with a guide | coralcrater.com |
| `ext.zip.kids_course` | Hawaii Adventure Tower: children 40-60 lb tandem; 4 ft 6 in to go alone | coralcrater.com |
| `ext.zip.lines` (count, longest, top speed), `between_lines` | Length and speed decide nerves; walks and stairs between lines decide stamina | operator pages |

### 3.4 Mountain biking (lift-served and cross-country)

| Field | Published examples | Source |
|---|---|---|
| `min_age`, `adult_required` (advice) | Whistler Bike Park: 5+ (unless in a kids' programme); under 13 strongly recommended with an adult. That is `age_rule: recommendation` on `adult_required`. | Whistler Blackcomb, via tripoutside.com and evo.com rental pages |
| `ext.ride.e_bike` | E-bikes 16+ to rent, and not allowed on the lift-served downhill trails | same |
| `ext.ride.kids_bike_sizes` | Kids' downhill bikes in 20 in (about 5-8) and 24 in (about 8-11) | evo.com/pages/locations-whistler-bike-rentals |
| `ext.ride.trail_mix` and `source_grade` (IMBA or STS) | A park with no green trails is no place for a first-timer | suitability.md 2.2 |
| `ext.ride.skills_park` | Beginner skills areas exist, but whether they are lift-served was **not found**. Expect `searched_none`. | same |

### 3.5 Canoe, kayak and SUP

| Field | Published examples | Source |
|---|---|---|
| `ext.paddle.craft_capacity` and `adult_required` | Lake Louise: three adults, or two adults (16+) plus two children each under 25 kg (55 lb) | chateau-lake-louise.com/activities/canoeing; thebanffblog.com |
| `water_safety.lifejacket` + `child_sizes_from_kg` | PFDs included at Lake Louise; **no child size chart found** (`searched_none`) | same |
| `ext.paddle.wind_exposure` | "Kids should be nowhere near a SUP ... on an offshore wind" (Guernsey Sports Commission) | guernseypress.com, 3 Aug 2024 |
| SUP `min_age`, `adult_required` | Wai Nani: 12+ at one site, 12-15 with an adult on the water; PFD worn at all times | wainanisup.com/safety-policy |
| `ext.paddle.portages` | Beginners should keep to sheltered lakes and short portages (Algonquin guides) | destinationontario.com beginners-guide-canoeing-ontario |

### 3.6 Via ferrata

| Field | Published example (Mt Norquay) | Source |
|---|---|---|
| `min_age` per offer | 12+ Explorer and Ridgewalker; 14+ Skyline and Summiteer | banffnorquay.com via ferrata FAQ |
| weight both ends, `limit_reason: harness` | 40-120 kg, the leash manufacturer's range. A reseller's 140 kg is a conflict. | same; banffadventures.com |
| `participation.guide` | Required: you must go with a Norquay guide | same |
| `participation.kit_provided` | Helmet, harness and all equipment; own gear must meet standards | same |
| `participation.fitness` | "Comfortable hiking continuously for one hour or more" | same |
| `participation.waiver.guardian_signs_under` | A legal guardian signs for everyone under 18 | same |
| `ext.ferrata.child_harness` | Children's full-body harnesses are rated to about 40 kg (suitability.md 2.3) | bergsteigen.com (secondary) |

### 3.7 Caves

| Field | Published examples | Source |
|---|---|---|
| `ext.cave.air_temp_c` | Jewel Cave 9 °C year round; Grand Caverns 12 °C (54 °F) | recreation.gov (Jewel Cave tours); grandcaverns.com |
| `ext.cave.steps` | Talking Rocks about 265 stairs; Cumberland 350 uneven stone stairs | tripster.com (Talking Rocks); cumberlandcaverns.com tour PDF |
| `stroller` (none) and `carrier_ok` (false), `ext.cave.carry_child` | Jewel Cave bans strollers, diaper bags and backpack carriers, and children may not be carried | recreation.gov |
| `ext.cave.squeeze` | Talking Rocks: "some narrow foot spaces" | tripster.com |

### 3.8 Boat tours and cruises

| Field | Published examples | Source |
|---|---|---|
| `min_age` | Tadoussac Zodiacs: under 6 not allowed; the enclosed boat takes any age | aaa.com tripcanvas (Croisieres AML) |
| `participation.medical`, `pregnancy` (advice) | Zodiacs discouraged for young children, pregnancy, and back or mobility problems | same |
| `ext.boat.vessel`, `sea_state` | The enclosed boat "reduces the effect of sea swell", which is the seasickness answer | lesdeuxpiedsdehors.com Tadoussac guide |
| `stroller_on_board` | Maligne: no strollers on boats, leave them at the dock; Tadoussac's big boat takes strollers, the Zodiac does not | banffjaspercollection.com Maligne FAQ; aaa.com |
| `on_site_min`, `ext.boat.landing` | Maligne: about 90 min with a stop at Spirit Island | banffjaspercollection.com FAQ |
| `wheelchair` | Two accessible boats at Maligne, booked ahead | magpie.travel listing |
| `weather_cancel` | AML runs rain or shine unless it is unsafe | aaa.com |

### 3.9 Horse riding

| Field | Published examples | Source |
|---|---|---|
| `min_age`, `max_weight_kg` (`limit_reason: policy`) | Banff Trail Riders: 8+, 230 lb (104.3 kg); Brewster Lake Louise: 8+ (10+ for 4 h), 250 lb (113.4 kg) | pelago.com (Bow River Ride); banff-springs-hotel.com |
| `participation.weigh_in` | May ask guests to step on a scale and show proof of a child's age | pelago.com |
| `ext.horse.share_horse` | A child cannot share a horse with an adult | pelago.com |
| `ext.horse.pony_option`, `lead_rein` | Pony rides for ages 3-7 exist (a reseller page). No lead-rein detail found, so expect `searched_none`. | banfflakelouise.com |

### 3.10 Glacier walks

| Field | Published examples | Source |
|---|---|---|
| `min_age` per offer | Skaftafell: 8+ (easy), 10+ (Blue Ice), 12+ (5 h), 14+ (Explorer); Athabasca: 12+ (Authentik) against "as young as 7" (Travel Alberta), a conflict | 57hours.com; guidetoiceland.is; authentikcanada.com; travelalberta.com |
| `ext.glacier.traction`, `kit_provided` | Crampons and ice axe included; Athabasca uses instep crampons or microspikes | same; thecanadianrockies.com |
| `participation.min_shoe_eu` | EU 34 or 35 minimum: smaller boots do not take the crampons | 57hours.com; guidetoiceland.is |
| `ext.glacier.boots` | Boots usually not included, rent on site | 57hours.com |
| `participation.fitness`, `medical` | "Not recommended for people with mobility, joint, balance, heart or lung issues" (IceWalks) | travelalberta.com |

### 3.11 Paragliding (tandem)

| Field | Published examples | Source |
|---|---|---|
| `min_age`, `adult_required`, `waiver.guardian_signs_under` | Interlaken: 4+ to 6+ by operator, parental consent for minors | manawa.com (Beatenberg); outdoor.ch Golden Eagle; headout.com |
| `min_weight_kg`, `ext.flight.weight_by_slot` | 25-30 kg minimum; maximum 100 kg, but **80 kg at 07:15 and in the winter 15:30 slot**; Golden Eagle 90 kg, 80 kg from 16:00 | same |
| `ext.flight.takeoff_run_m`, `participation.fitness` | A run of about 40 m at take-off | same |

The maximum weight changes with the time of day. A limit stored without its slot is wrong for some departures, so `weight_by_slot` is R.

### 3.12 Hot springs and thermal baths

| Field | Published examples | Source |
|---|---|---|
| `min_age`, `adult_required` | Myvatn Nature Baths: minimum age 1; children up to 12 in an adult's care at all times | myvatnnaturebaths.is/terms |
| `ext.water.floats_required_under` | Ages 1-8 must wear armbands, which "do not replace continuous adult supervision" | same |
| `ext.water.clarity` | "The lagoon water is cloudy and not transparent", so a child under the surface cannot be seen | same |
| `water_safety.water_temp_c` | Banff Upper: kept at 37-40 °C; Myvatn main pool 36-40 °C | parks.canada.ca Banff Upper Hot Springs FAQ; islandshotel.is |
| `participation.pregnancy` (`ask_doctor`) | Parks Canada: pregnant visitors should consult a physician | parks.canada.ca FAQ |

### 3.13 Wildlife viewing

| Field | Published examples | Source |
|---|---|---|
| `ext.wildlife.min_distance_m` (`official_rule`) | Jasper order under the National Parks Act: 100 m from bears, cougars and wolves; 30 m from elk, moose, caribou, sheep and goats | jasper.travel (rules you need to know); fitzhugh.ca on the order |
| `ext.wildlife.stay_in_vehicle` | Waterton: "If you choose to stop, stay in your vehicle"; the Jasper distances do not apply inside a legally parked vehicle | parks.canada.ca/pn-np/ab/waterton/securite-safety/faune-wildlife |
| `ext.wildlife.best_time` | Dawn and dusk for most species. **No single official source**, so `official_info` per park or `community` with a date. | lane to source per park |

### 3.14 Lifts

| Field | Published examples | Source |
|---|---|---|
| `wheelchair`, `stroller_on_board` | Banff Gondola cabins take most standard wheelchairs with a ramp, but the summit boardwalk is not accessible; **no stroller rule found** | thebanffblog.com/accessible-banff; pursuitcollection.com |
| `ext.lift.last_up`, `last_down` | lift.md: the last descent strands people | lift.md section 2 |
| `participation.weather_cancel` | Wind and lightning closures; a maintenance closure every January (Banff) | thebanffblog.com; lift.md |
| `solo` | Chairlifts may set a minimum height or age to ride without an adult | lift.md section 6 |

### 3.15 Alpine coasters

| Field | Published examples | Source |
|---|---|---|
| `solo` (age and height) | Wiegand terms: alone from 8 and 1.35 m; Les Orres: alone over 1.40 m; Funbob: own sled from 8, under 3 not allowed (the boards disagree on 7 or 8, so this is a conflict) | gopass.travel Wiegand T&C PDF; lesorres.com; dreizinnen.com; suedtirolerland.it |
| `ext.coaster.driver_rule` | Les Orres: driver over 1.65 m or 18+; Wilderness Run: 16+ and 54 in to operate | lesorres.com; glenwoodcaverns.com |
| `ext.coaster.max_load_kg` | 150 kg per sled (Wiegand, Les Orres) | same |
| `participation.pregnancy` | Prohibited (Les Orres) | lesorres.com |

### 3.16 Scenic drives

| Field | Published example | Source |
|---|---|---|
| `ext.drive.vehicle_limits` (`official_rule`) | Going-to-the-Sun Road: no vehicle over 21 ft (6.4 m) or 8 ft (2.4 m) wide between Avalanche Creek and Rising Sun; over 10 ft high may struggle west of Logan Pass | nps.gov/glac/planyourvisit/gtsrinfo.htm |
| `ext.drive.road_surface`, 2WD rule | Iceland F-roads are barred to 2WD campers (repo research, CLAUDE.md Iceland entry); this search found no new source | repo research |
| `ext.drive.winding` | Car-sickness on hairpins is a child factor. It is `our_inference` from the route geometry, labelled as ours. | our rule |

## 4. Fields considered and left out

| Candidate | Left out because |
|---|---|
| High chairs and kids' menus (eatery), cots and family rooms (stay) | They are stay and eatery `attrs` in their kind profiles, not suitability. Suitability for stays stays at wheelchair and stroller (suitability.md 7). |
| Price by age band | Offers own prices (kinds/README.md 9) |
| A max soak time for hot springs | No source found; it would be invented |
| Group size and minimum participants | adventure.md OC5, an operations field |
| A per-kind "fear factor" or "thrill" grade | No published scale; it would be ours alone, and the limits already decide |
| Draw, uniqueness and trip role | relevance.md |

## 5. The principle check

### 5.1 At rest: three chips on a day row and the place page, two on a place card (P2 safety exception, P3, P6, P8)

The chip looks, wording and filter labels are designed in [design/suitability-display.md](../../docs/v2/design/suitability-display.md) (18 Oct 2026); where this section and that page differ, that page wins.

Chip rules for every kind:
1. **Slot 1, limits.** When any rule-based limit exists, one merged chip shows at most three values: "Age 8+ · 23 kg min · swim test". A `searched_none` R limit counts as a value ("height not stated"). Rule chips are filled with a lock (`--surface-2`, `--ink`); advice chips are outlined with a person glyph. Anything more becomes "+2", which opens the detail; the count includes pregnancy and medical bans. With a party profile set, slot 1 becomes the fit result: "Fits a 6-year-old" (`--ok`), "Not suited to a 3-year-old" (`--warn`, our advice) or "Not for under 8 · operator rule" (`--crit`, a rule).
2. **Slot 2, effort or time.** For kinds with effort: the family-effort **name**, never the number: "Moderate · CAI E · 3-4 h" (P4). On a day row the time is omitted because the entry carries its duration. For kinds with effort N: the time, with the kind's grade if it has one ("Class II · 2 h on water").
3. **Slot 3, the kind's deciding condition**, from the table below.
4. **Outside the three chips.** Closures (`access_season` out of window), bookings due and the main hazard are the L3c day-row **warning marks** and booking markers (trip-timeline.md 3.10); on the place page they are one warning line under the chips. They are visible at rest and are not part of the three. Pregnancy and medical bans are operator rules and count in the limits chip's "+n"; kit, wear, fitness, waiver and weigh-in go into the entry's "Know before you go" bullets.
5. A chip is never drawn for an N field, and never as "FE n/a".
6. **Place cards carry two chips** (P8 light list data): `kids_from` as a rule or advice chip, and the family-effort name (omitted when effort is N). Slot 3 is never on a card.

| Profile | Slot 1 (limits or fit) | Slot 2 | Slot 3 | Warning mark (outside chips) |
|---|---|---|---|---|
| hike | fit, or age band "From 8 (our judgement)" | FE + source grade + time | stroller or carrier ("Carrier OK") | group of 4; bears (hazards); closed season |
| walk | age band | FE1-2 + time | stroller with extent ("Stroller: first 1.2 km") | closed season |
| viewpoint | age band | "5 min from car" (`walk_m`) | fencing ("Unfenced edge") | road or lift season |
| lake | age band | time on site | stroller | access (shuttle) season |
| swim | age band | time on site | lifeguard ("No lifeguard") | water temperature under 18 °C; closures |
| waterfall | age band | walk from the car + time | fencing or stroller | season |
| beach | age band | time on site | lifeguard | sneaker waves or tides (hazards) |
| drive | none | drive time | road surface ("Gravel 22 km") | vehicle limits; road season |
| town | none | time on site | stroller ("Cobbles: all-terrain") | none |
| sight | age band | time on site | stroller rule ("Strollers at cloakroom") | season or closures |
| lift | solo or min age | ride + time at top | stroller on board ("Strollers folded") | last down; wind |
| boat | min age | duration | stroller on board or vessel ("Enclosed, heated") | sea state; season |
| canoe_kayak | min age + adult rule | time | craft capacity ("2 adults + 2 under 25 kg") | wind; water temperature |
| sup | min age + adult rule | time | wind exposure | offshore wind |
| rafting | min age, min weight, swim test | on water + class | kit ("Wetsuit provided") | river level; cold water |
| float | min age | on water + "no rapids" | kit or PFD sizes | season |
| zipline | age, height, weight | course time | braking ("Guide brakes") | weather |
| bungee | age, weight both ends | time on site | tandem or height ("220 m") | none |
| ferrata | age, weight both ends | FE + Schall grade + time | guide ("Guide required") | weather; season |
| mtb_lift | min age | easiest trail ("Greens: 6 trails") | kids' bike sizes ("Kids 20 and 24 in") | season |
| mtb_xc | none | FE + IMBA or STS + time | e-bike rule | season |
| cycle_path | none | FE + km + time | traffic ("Car-free") | return by train |
| horse | age, weight max | ride time | lead rein | none |
| show_cave | age (if any) | tour time | stroller and carrier ("No carriers") | 9 °C inside (wear) |
| caving | age | time | squeeze ("Crawling") | flooding |
| glacier | age | time on ice | shoe size ("EU 34+ for crampons") | weather; guide required |
| snow | solo or school age | piste grade | magic carpet | season |
| wildlife | none | time | stay in vehicle | 100 m from bears |
| hot_spring | min age + under-12 rule | time | water temperature ("37-40 °C") | closures |
| coaster | solo age and height | ride time | driver rule | rain |
| paraglide | age, weight by slot | flight time | take-off run | weather |
| air_tour | min age | duration | stroller on board | weather |
| stay | none | none | wheelchair | season |
| eatery | none | none | wheelchair | none |

### 5.2 On the detail view (P2, P3, P6)

Order, for every kind. A section with no R or A fields for the profile is not drawn at all (this is not a missing-data case, so the owner's "empty markers stay visible" rule does not apply to it; that rule covers sections with R or A fields):

1. **Limits and rules**: limits per offer, `solo`, `adult_required`, `group_min`, then participation (guide, waiver and guardian age, medical, pregnancy, weigh-in).
2. **Who it suits**: age band with its reason, kid note, carrier, stroller or stroller on board, wheelchair and access detail, limited-capacity note.
3. **Effort and time**: family effort with the original grade, drivers, adult and child times or time on site.
4. **The kind block**: the extension fields under a kind heading, such as "On the water" (class by section and month, water temperature, PFD sizes, kit), "On the ice" (traction, boots, shoe size), "The lift" (cabin, last up and down), "The ride" (trail mix, e-bike rule, kids' bikes).
5. **Facilities**: toilets, water, food, shade, bail-out, signal.
6. **When you can go**: access season, weather cancellation, `best_time` for wildlife, hazards.

**One step away (provenance):** every chip and row opens its basis, source link, read date, quote and conflicts. "Sources disagree" keeps its short tooltip (P4 exception). Freshness shows as "read 12 Oct 2026" (T3).

**Gaps:** a missing R field shows "Not checked yet" in its row as a dashed `--line-2` chip. All missing A fields of a section collapse into one closing line, "Not checked yet: toilets, signal". N fields never appear. The section head carries "n of m family checks done · read <date>" so gaps read as research in progress.

### 5.3 How each kind feeds the filters and the trip profile (P4: at most four primary)

Primary Places filters stay **Country, Kind, Season, Kids** (principles.md P4 decision). Effort, Stroller, Carrier OK and Step-free sit under "More filters". Labels, options and count lines for Kids, Effort and Stroller are in suitability-display.md section 5. Every kind feeds only these derived values:

| Derived value | Rule | Used by |
|---|---|---|
| `kids_from` | the larger of the rule `min_age` (from the record or its most permissive offer) and `age_band.from`; for `solo` kinds, the passenger age; null when both are gaps | Kids filter (hides above a hard rule, dims above the band), trip "Kids from N" |
| `family_effort` | effort.derive; for paddle profiles from `water_safety.class` (A10); for `mtb_lift` from the easiest lift-served trail; null for profiles where effort is N | Effort filter, trip "Hike effort" (trails only, as suitability.md 6.3) |
| `stroller_ok` | `stroller` for surfaces, `stroller_on_board` for conveyances: yes, partly or no; null when N | Stroller filter, trip "Stroller-friendly", the `carried` gate |
| `step_free` | `wheelchair` | Step-free filter |
| hard limits by offer | as projectForSchedule (suitability.md 6.1) | `selectVariant`, `W_FIT` |

- **Adding a kind adds one mapping row** in `core/src/suitability/derive.ts` (`kidsFromOf`, `familyEffortOf`, `strollerOkOf`). It never adds a filter.
- **N in a filter.** When the Effort filter is on, profiles with effort N (bungee, boat, lift and others) leave the results, and the count line says "Showing places with an effort rating". A Stroller filter treats a profile with `stroller_ok` N (bungee, rafting) the same way. A `gap` never passes a positive filter (suitability.md 6.3, unchanged).
- **Gates.** gates.ts runs a check only where the profile marks its field R or A. Today it runs the `carried` check on every record for a toddler, so a cruise returns "carrier and stroller not known" (gates.ts lines 121-129). With the table, the cruise checks `stroller_on_board` instead, and bungee skips the check because its `min_age` already excludes a toddler.

### 5.4 Clutter and completeness confirmed

| Check | Confirmed by |
|---|---|
| N fields never render as "not stated" | The UI reads the profile before it draws a row. `not_applicable` states and N fields are both skipped. The rule is tested in S1: a bungee page has no stroller, toilet or effort row. |
| Only missing R and A fields show as gaps | 5.2 gap rule; A gaps are collapsed into one line per section |
| Usable counts only R fields of the kind | `suit_level` (6.3) counts R fields, plus the `op` fields when `operated` is true. A counts for Complete. N is outside the total. |
| No new primary filter per kind | 5.3 |
| "Flatwater only" removed | the Effort filter at FE1-2 on paddle kinds gives the same list without a kind-specific control |

### 5.5 Conflicts found and how they are resolved

| # | Conflict | Resolution |
|---|---|---|
| PC1 | **P2 safety exception against the 3-chip cap.** A Class III raft has five hard rules: age, weight, swim test, pregnancy and a guardian waiver. | Limits merge into chip 1 (at most three values, then "+n"). Pregnancy and medical bans count in "+n", so they are marked at rest and one click away (the timeline's "Know before you go" is a collapsed panel, so it does not satisfy "visible at rest"). Kit, wear, fitness and the waiver go into "Know before you go". Closures and bookings are L3c warning marks, outside the cap. |
| PC2 | **The owner's "empty sections stay visible" (P2 decision) against clutter (P4).** | Markers are drawn only for missing R and A fields. A gaps collapse into one line. N is never drawn. |
| PC3 | **P6 "effort and age on the day row" for kinds with no effort** (boat, bungee, lift) | Slot 2 becomes time. No "FE n/a" chip. |
| PC4 | **T4 families first against P4's four primary filters** | Kids is primary. Stroller, Carrier OK, Step-free and Effort are in "More filters". "Flatwater only" is dropped. |
| PC5 | **`stroller` meant two things**: a surface, and a carriage rule on boats and lifts | Two fields (A6) |
| PC6 | **The same grade in two places** (`effort.source_grade` and `water_safety.class`) | A10 |
| PC7 | **Operations fields against suitability fields** (lift `weather_closure`, adventure `weather_dependent`) | `participation.weather_cancel` is the one home, and the catalog `attrs` project from it later |
| PC8 | **T1 "when" for activities whose limits change with the season or the slot** (paraglide weights, river levels) | `weight_by_slot` and `class_at_level` hold the condition. Chip 1 shows the strictest slot with "+ by time". |
| PC9 | **The `carried` gate fires on every kind** (gates.ts) | Gated by the profile (5.3) |
| PC10 | **Three chips on a card against P8** (list data carries only the kids chip and filter fields) | Cards carry two derived chips, kids and effort (both filter facets); slot 3 stays on day rows and place pages (design C3) |
| PC11 | **"FE3" on chips against P4** | Chips name the family effort; the number is internal (design C1) |
| PC12 | **Three chips on a phone day row against timeline-design 10** ("chips wrap only in the selector footer") | Suitability chips may wrap to a second line on an entry, limits first; the entry's meta drops "child rule". Flagged to the coordinator for timeline-design.md 4.2 and 10 (design C4) |

## 6. Schema delta against core/src/schema/suitability.ts

All additive except four removals of fields that no record uses (checked across all 9 sidecar files on 18 Oct 2026: zero `ext` blocks, zero `min_age_on_board`). The size is in 6.4.

### 6.1 Enums (core/src/schema/enums.ts, append only)

```ts
export const SUIT_KIND = [ /* existing 11 */, "drive" ] as const;                  // + drive
export const SUIT_PROFILE = [
  "hike", "walk", "viewpoint", "lake", "swim", "waterfall", "beach", "drive", "town", "sight", "lift", "boat",
  "canoe_kayak", "sup", "rafting", "float", "zipline", "bungee", "ferrata", "mtb_lift", "mtb_xc", "cycle_path",
  "horse", "show_cave", "caving", "glacier", "snow", "wildlife", "hot_spring", "coaster", "paraglide", "air_tour",
  "stay", "eatery",
] as const;
/** Closed subkind vocabulary; the applicability file maps each (kind, subkind) to exactly one profile. */
export const SUIT_SUBKIND = [
  "hike", "scramble", "trek_stage", "walk", "guided-hike", "heli-hike",
  "viewpoint", "summit", "pullout", "lake", "swim_spot", "beach", "hot_spring", "waterfall", "canyon", "gorge",
  "scenic_drive", "town", "village", "city",
  "museum", "castle", "landmark", "historic_site", "visitor_centre", "attraction", "cave",
  "gondola", "cable_car", "chairlift", "funicular", "rack_railway", "scenic_train",
  "boat-tour", "cruise", "zodiac", "boat-shuttle", "canoe", "kayak", "sup", "rafting", "float",
  "zipline", "bungee", "swing", "via-ferrata", "bike-park", "mtb", "cycling", "horse", "caving",
  "glacier-walk", "ice-trek", "ski", "snowshoe", "sled", "wildlife", "wildlife_viewing",
  "hot-springs", "thermal-bath", "spa", "coaster", "paragliding", "heli", "scenic-flight", "vehicle-tour",
  ...STAY_KIND, "restaurant", "cafe", "bakery", "teahouse", "bar", "market", "grocery", "hut_kitchen",
] as const;
export const APPLICABILITY = ["R", "A", "N", "op"] as const;
export const MEDICAL = [
  "heart", "high_blood_pressure", "epilepsy", "neurological", "back_neck", "recent_surgery", "dislocation",
  "asthma", "diabetes", "mobility", "balance", "lung",
] as const;
export const KIT = [
  "pfd", "helmet", "wetsuit", "booties", "spray_jacket", "fleece", "harness", "lanyard", "crampons",
  "microspikes", "ice_axe", "boots", "gloves", "headlamp", "body_armour", "full_face_helmet", "bike",
] as const;
export const WEAR = [
  "closed_shoes", "hiking_boots", "long_trousers", "layers", "swimwear", "change_of_clothes", "sun_hat",
  "warm_hat", "rain_shell",
] as const;
export const WEATHER_CAUSE = [
  "wind", "lightning", "rain", "river_level", "sea_state", "visibility", "heat", "snow", "fog", "maintenance",
] as const;
```

The KIND_TERRAIN keys in derive.ts change to the vocabulary: `mountain-coaster` becomes `coaster` and `show-cave` becomes `cave`. Today they match no subkind in `ACTIVITY_TYPE`, so the defaults never fire.

### 6.2 The shared block

```ts
// added to suitabilityBlock (all .optional())
solo: val(z.strictObject({ min_age: int.min(0).optional(), min_height_cm: int.min(0).optional() })),   // a limit (K3)
stroller_on_board: val(z.enum(["yes", "folded", "no", "leave_at_dock"])),
hazards: val(z.array(z.strictObject({ category: z.enum(E.HAZARD_CATEGORY), note: z.string().min(1), season: z.string().optional() }))),
participation: z.strictObject({
  guide: val(z.enum(["required", "recommended", "none"])).optional(),
  kit_provided: val(z.array(z.enum(E.KIT))).optional(),
  wear: val(z.array(z.enum(E.WEAR))).optional(),
  min_shoe_eu: val(z.number().min(15).max(50)).optional(),           // a limit (K3): crampon fit
  fitness: val(z.string().min(1)).optional(),                         // operator's words, quoted
  medical: val(z.strictObject({ excluded: z.array(z.enum(E.MEDICAL)), ask_doctor: z.array(z.enum(E.MEDICAL)) })).optional(),
  pregnancy: val(z.enum(["allowed", "ask_doctor", "not_allowed"])).optional(),
  waiver: val(z.strictObject({ required: z.boolean(), guardian_signs_under: int.min(0).nullable(), guardian_present: z.boolean().nullable() })).optional(),
  weigh_in: val(z.boolean()).optional(),
  weather_cancel: val(z.strictObject({ causes: z.array(z.enum(E.WEATHER_CAUSE)), policy: z.enum(["refund", "rebook", "credit", "none"]).nullable(), status: z.string().optional() })).optional(),
}).optional(),

// changed enum values (append)
toilets: val(z.array(z.enum(["start", "route", "payoff", "none", "on_board", "station"]))),

// removed (zero records use it)
water_safety.min_age_on_board                                         // shared min_age covers boats
```

### 6.3 Records, extensions and the applicability file

```ts
// record and offer
record: { ...existing, subkind: z.enum(E.SUIT_SUBKIND),               // now required and closed
          operated: z.boolean().optional() }                          // A3; default from the profile

// ext: existing kinds gain fields; ten new discriminants
trail:   hazards REMOVED (now shared, typed)
ride:    + lift_served: val(bool), e_bike: val(enum["allowed","not_on_lift_trails","banned"]),
           kids_bike_sizes: val(array(enum["12in","14in","16in","20in","24in","26in"])),
           skills_park: val(strictObject({ lift_served: bool.nullable(), note?: string })),
           trail_mix: val(strictObject({ white: int, green: int, blue: int, black: int, double_black: int, pro: int }))
paddle:  craft enum: + "float_raft"; "boat_tour" REMOVED (boats move to ext boat)
         class_at_level items: + section?: string
         + sections: val(array(strictObject({ name, class: string, km?: number }))),
           on_water_min: val(range),
           wind_exposure: val(enum["sheltered","some","exposed","offshore_risk"]),
           portages: val(strictObject({ count: int, longest_m: number })),
           craft_capacity: val(strictObject({ adults: int, children: int, child_max_kg: number.nullable() })),
           guided: val(enum["guided","self","either"]),
           trip_style: val(enum["family_float","whitewater","flatwater"])
ferrata: guide REMOVED (participation.guide); + child_harness: val(strictObject({ type: enum["full_body","sit"], to_kg?: number })),
           approach_min: val(range), descent: val(enum["walk","lift","same_way"])
water:   + swimming: val(enum["allowed","banned","unsafe","seasonal","discouraged"]),   // discouraged (19 Oct 2026): an official page asks visitors to avoid it without banning it; shown as "Swimming discouraged"
           clarity: val(enum["clear","cloudy"]),
           floats_required_under: val(int)                            // a limit (K3)
cave:    + squeeze: val(enum["none","some","crawl"]), darkness: val(enum["lit","partly_lit","headlamp"]),
           wet: val(enum["dry","damp","wading","swimming"]), carry_child: val(enum["allowed","carrier_only","not_allowed"]),
           tour_m: val(number)
lift:    { kind: "lift", cabin: val(enum["enclosed","open_chair","train","mixed"]),
           last_up: val(array(seasonTime)), last_down: val(array(seasonTime)), ride_min: val(range) }
boat:    { kind: "boat", vessel: val(enum["enclosed","part_open","open","rib"]),
           sea_state: val(enum["sheltered","some_swell","open_sea"]), seasick_risk: val(enum["low","some","high"]),
           landing: val(strictObject({ where: string, min: int })) }
zip:     { kind: "zip", braking: val(enum["self","guide","automatic"]),
           lines: val(strictObject({ count: int, longest_m: number, max_kmh?: number })),
           tandem_under_kg: val(number), kids_course: val(bool), between_lines: val(enum["flat","stairs","hike"]) }
jump:    { kind: "jump", height_m: val(number), tandem: val(bool), harness: val(enum["ankle","body","both"]) }
coaster: { kind: "coaster", max_riders: val(int), max_load_kg: val(number),
           driver_rule: val(strictObject({ min_age?: int, min_height_cm?: int })), brake: val(enum["rider","automatic"]) }
horse:   { kind: "horse", lead_rein: val(enum["available","only","not_offered"]), share_horse: val(bool),
           pace: val(enum["walk_only","trot","canter"]), pony_option: val(strictObject({ min_age: int, max_age: int })) }
glacier: { kind: "glacier", traction: val(enum["crampons","instep_crampons","microspikes"]),
           boots: val(enum["provided","rent","own"]), ice_min: val(range) }
flight:  { kind: "flight", flight_min: val(range),
           weight_by_slot: val(array(strictObject({ slot: string, min_kg?: number, max_kg: number }))),
           takeoff_run_m: val(number), seat_weight_rule: val(string) }
wildlife:{ kind: "wildlife", min_distance_m: val(array(strictObject({ species: string, m: int }))),
           stay_in_vehicle: val(enum["required","advised","no"]), best_time: val(array(enum["dawn","morning","midday","evening","dusk","night"])),
           sightings: val(enum["likely","possible","rare"]), quiet_needed: val(bool), peak_months: val(array(int.min(1).max(12))) }
drive:   { kind: "drive", vehicle_limits: val(strictObject({ max_length_m?: number, max_width_m?: number, max_height_m?: number, two_wd?: enum["ok","banned"] })),
           road_surface: val(enum["paved","gravel","mixed"]), drive_min: val(range),
           fuel_gap_km: val(number), winding: val(enum["low","some","high"]) }
// seasonTime = strictObject({ from: mmdd, to: mmdd, time: /^\d\d:\d\d$/ })
```

**Limit fields (K3)** gain `solo`, `participation.min_shoe_eu`, `ext.water.floats_required_under`, `ext.flight.weight_by_slot`, `ext.coaster.max_load_kg`, `ext.coaster.driver_rule` and `ext.wildlife.min_distance_m` (`official_rule`). `LIMIT_FIELDS` and `SECOND_RULE_FIELDS` in types.ts and validate/suitability.ts are extended to match.

**The applicability file** `data/schema/suitability-applicability.json`, with its Zod schema in `core/src/schema/suitabilityApplicability.ts` (exported to `data/schema/generated/`):

```jsonc
{
  "schema_version": 1,
  "profiles": {
    "rafting": {
      "match": [{ "kind": "activity", "subkind": "rafting" }],
      "operated": "always",                           // "always" | "never" | "flag"
      "ext": "paddle",                                // the only ext kind allowed on this profile, or null
      "fields": {
        "min_age": "R", "max_age": "A", "min_weight_kg": "R", "max_weight_kg": "R", "limit_reason": "R",
        "adult_required": "A", "age_band": "R", "kid_note": "R", "stroller": "N",
        "water_safety.class": "R", "water_safety.swim_ability": "R", "water_safety.water_temp_c": "R",
        "participation.kit_provided": "R", "participation.pregnancy": "R", "participation.waiver": "R",
        "ext.paddle.class_at_level": "R", "ext.paddle.sections": "R", "ext.paddle.on_water_min": "R"
        // every field path in the block appears; a missing path fails the file's own check
      },
      "f_label": { "min_age": "F1", "water_safety.class": "F11" }  // badge grouping, unchanged ids
    }
  }
}
```

- Every profile lists **every** field path, so the file states N explicitly. `check` fails when a path is missing.
- Every `(kind, subkind)` pair in `SUIT_SUBKIND` maps to exactly one profile (`E_SUIT_PROFILE_MAP`).
- `core/src/suitability/applicability.ts` loads it and exposes `profileOf(record)`, `markOf(profile, path, operated)` and `requiredPaths(profile, operated)`.

### 6.4 Validator rules and codes (append to codes.ts and messages.ts)

| Code | Level | Rule |
|---|---|---|
| `E_SUIT_SUBKIND` | error | `subkind` missing or not in `SUIT_SUBKIND` |
| `E_SUIT_PROFILE_MAP` | error (file) | a `(kind, subkind)` pair maps to no profile or to two |
| `E_SUIT_EXT_KIND` | error | `ext.kind` is not the profile's `ext` |
| `E_SUIT_NA_EXEMPT` | error | a `not_applicable` state on an R or A field without a `note` |
| `W_SUIT_NA_FIELD` | warning | a field marked N for the profile is present with any state other than `gap`. The message names the profile and says "remove it". |
| `W_SUIT_BELOW_USABLE` | warning (info in `check`, a line in `--coverage`) | R fields unanswered: lists them. `suit_level` is `draft` until all R fields are answered. |
| `W_SUIT_OPERATED_DEFAULT` | warning | `operated` is set on a profile where it is `always` or `never` |

- `suit_level` (`draft`, `usable`, `complete`) is computed in derive.ts and written into `flat` (a new column, `suit_level`). Usable means every R path is answered on the record or, for offer-level paths, on every offer. Complete adds every A path.
- **`check --coverage <trip>` adds the level per record**, so the lane's acceptance check 7 (80% Usable) reads the new definition.

**Delta size.**

| Part | Count |
|---|---|
| Enums | 1 kind value; 7 new lists (profiles 34, subkinds about 80, applicability marks, medical, kit, wear, weather causes) |
| Shared block | 4 additions (`solo`, `stroller_on_board`, `hazards`, `participation` with 10 fields); 2 enum values; 1 removal |
| Record | `subkind` required and closed; `operated` added |
| Extensions | 10 new kinds (34 fields); 5 existing kinds gain 18 fields; 3 fields removed or moved |
| Data | 1 new file (34 profiles, each listing every field path) |
| Validator | 7 codes; 7 more limit fields; `suit_level` in `flat` |
| derive, gates | 3 mapping functions (`kidsFromOf`, `familyEffortOf`, `strollerOkOf`), the water-class branch, profile-gated checks, fixed KIND_TERRAIN keys |

About 63 new fields in total. Every one is optional in Zod, and the applicability file decides when a field is required.

## 7. Migration consequences for the merged sidecars (S0b)

| # | Consequence | Records | Rule |
|---|---|---|---|
| M1 | **Every record needs a subkind.** 243 of 284 have none. | 104 trails, 70 sights, 26 towns, 22 viewpoints, 11 lakes, 5 Dolomites activities, 3 lifts, 2 others | Trails become `hike` (lanes may reclassify to `walk` with a reason). Towns become `town`. Viewpoints become `viewpoint`. Lakes become `lake`. Lifts become `gondola` or `cable_car` from the name. Funbob becomes `coaster`, Rienza `rafting`, the Drava path `cycling`, minitrekking `glacier-walk`, Myvatn `hot-springs`. |
| M2 | **The Rockies "sights" are mostly not sights.** By name, about 19 are lakes, 10 waterfalls or canyons and 3 viewpoints. Banff Gondola is a lift, Miette and Radium are hot springs, and Hwy 742 is a drive. | 47 `legacy/.../sights/*` | S0b writes a reviewed mapping `data/suitability/kind-map.json` (ref, kind, subkind, reason), proposed by name and checked by a person or by R2a. **The kind is a migration value**, so it is labelled and a lane may correct it. |
| M3 | **Rockies `other` adventures** | 5 | golden-skybridge: `sight` / `attraction` (with offers for its coaster and zip); glacier-skywalk: `sight` / `attraction`; red-rock-parkway: `drive`; banff-springs-spa: `hot_spring` / `spa`; jasper-dark-sky: `sight` / `attraction`, operated |
| M4 | **Subkinds that change profile** | 4 | bow-river-raft becomes `float`; columbia-icefield-ice-explorer becomes `air_tour` / `vehicle-tour` (it is a bus on the ice, not a walk); crypt-lake-shuttle becomes `boat-shuttle`; canmore-nordic-centre becomes `mtb` |
| M5 | **Duplicates across kinds** | Banff Gondola (a sight and an adventure), Miette and Radium (a sight and an adventure) | Keep the adventure ref as the record. The sight ref gets `combo_with` and no suitability of its own. Coverage counts the pair once. |
| M6 | **N fields present after reclassification** | `lift` records with `effort` (Lagazuoi: `age_band`, `effort`, `adult_time_min`); `lake` records with `effort` drivers (4) | Lagazuoi's tunnels are a walk: split it into the `lift` and a `walk` record (the tunnels). Lake drivers move to `ext.trail.walk_m` or to their own trail record. The validator warns until this is done. |
| M7 | **`flat` gains `suit_level`** | all | `derive --write` regenerates it. Every record starts as `draft`. |
| M8 | **The F-check totals in the kind profiles** | 15 kind files | Recomputed from the applicability file. The one-line note in each kind file changes to "Family checks: see suitability-applicability.md for this kind's R, A and N fields". |
| M9 | **`gates.ts` and `project.ts` tests** | core tests | The `carried` gate tests gain a cruise case (`stroller_on_board`) and a bungee case (skipped). The Class II raft terrain test reads `water_safety.class`. |
| M10 | **`scope.json`** | 207 refs | Unchanged refs, plus a `profile` per ref, so `--coverage` reports by profile |

No migrated value is lost. M2 to M4 change `kind` and `subkind` only, and M6 moves values; it deletes none.

## 8. The research lane impact

### 8.1 What changes in every lane brief (replaces suitability.md 8.1 "Each lane brief", bullets 1 to 4)

- **Goal.** Every in-scope record reaches Usable for its profile: every R field of the profile answered, plus the `op` fields when the record is operated. Then fill the A fields that the lane's sources show, in the same read.
- **Before research**, run `node core/bin/suitability.ts fields --ref <ref>`. It prints the record's profile and its R, A and N paths (S0b adds the command). Research those paths only.
- **Never fill an N field**, not even with `not_applicable` or `searched_none`. If you believe a field marked N applies to a record, write it in the lane markdown under "Applicability questions" and leave the data alone.
- **The kind is a question too.** If the record's kind or subkind is wrong (a "sight" that is a lake), correct it in `kind-map.json` with a reason, then use the new profile's fields.
- **One pass per record**: open the operator or land-manager page once and capture, in order: limits per offer; participation (guide, kit, wear, medical, pregnancy, waiver); the extension fields; times; facilities; access season and weather cancellation; hazards. Then the slot below.
- **Relevance slot.** After the suitability fields, capture the **relevance fields (from relevance.md)** from the same pages. The fields, format and file come from relevance.md; this slot is where its lane instructions merge. They are written to the relevance sidecar, never into the `suitability` block.

  ```
  ### Relevance fields (from relevance.md)  <-- merged in from relevance.md section <n>; do not edit here
  ```
- **Acceptance check 7** now reads: at least 80% of records reach Usable for their profile (`check --coverage` level), and no `W_SUIT_NA_FIELD` remains in the lane's files.
- **New acceptance check 9:** every record has a subkind in the vocabulary, and every kind change is in `kind-map.json` with a reason.

### 8.2 Per-lane additions (the kind-specific fields each lane will meet)

| Lane | Profiles in scope (count, approximate after M1-M4) | Kind-specific R fields to capture | Where they are published | Known traps |
|---|---|---|---|---|
| **R1** dolomites-2027 (40) | hike 12, lake 8, town 9, viewpoint 5, sight 2, coaster 1, rafting 1, cycle_path 1, lift 1 (+1 walk split) | Funbob: `solo` (8 vs 7 conflict), `driver_rule`, `max_load_kg`, `pregnancy`, `weather_cancel`. Rienza raft: class by section and month, `on_water_min`, kit, swim, waiver, `trip_style`. Drava: `traffic`, `one_way_return` (ÖBB bikes), `kids_bike_sizes`, `bike_hire`. Lagazuoi: `cabin`, `last_down`, `stroller_on_board`, `altitude_m`. Trails: `group_min` (`none_stated` from the CAI or valley board), `hazards`. | dreizinnen.com Funbob page and terms; the rafting operator's terms; drauradweg.com, ÖBB bike rules; lagazuoi.it | The Funbob boards disagree on the solo age: keep it as a conflict. The Lagazuoi tunnels are a `walk` record. |
| **R2a** canadian-rockies-2029 trails and sights (61) | hike 33, lake about 19, waterfall about 10, viewpoint 3, sight about 8, drive 2, hot_spring (sight duplicates, M5) | Trails: `group_min` (the Parks Canada restrictions page, once per park), `hazards` (bears), `navigation`. Lakes and waterfalls: `walk_m`, `exposure` fencing, `access_season` via shuttle. Drives: `vehicle_limits`, `road_surface`, `access_season` (Hwy 742 gravel). | Parks Canada park pages and restrictions; Alberta Parks | Apply M2 first: confirm each sight's kind before its fields |
| **R2b** canadian-rockies-2029 activities and lifts (15 plus offers) | float 2, rafting 2, boat 4, canoe_kayak 3, horse 3, ferrata 1, lift 6, glacier 1, air_tour 2, wildlife 2, hot_spring 4, mtb_xc 1, cycle_path 3 | Rafting and floats: weight by offer, class by section, kit, swim. Norquay: per-route age, 40-120 kg, guide, fitness, waiver. Horses: weight max, `weigh_in`, `share_horse`, `lead_rein`. Canoes: `craft_capacity` (2 + 2 under 25 kg), PFD sizes, `wind_exposure`, `water_temp_c`. Boats: `stroller_on_board` (Maligne: no), `vessel`, `landing`. Glacier: shoe size, traction, boots. Wildlife: `min_distance_m` (Jasper order), `best_time`. Hot springs: water temperature, `pregnancy` (ask a doctor). | operator pages listed in suitability.md 8.1; banffnorquay.com FAQ; banffjaspercollection.com FAQs; the Jasper wildlife order | The Kicking Horse and Kananaskis weights stay as fixed in S0 (a minimum). The reseller's 140 kg Norquay figure is a conflict. Athabasca 12+ against 7+ is a conflict. |
| **R3** patagonia-2027 (19) | hike 7, glacier 1, boat (Beagle Channel), wildlife (penguins), town 5, viewpoint 3, lake 1, sight 2 | Minitrekking: age 8-65 per offer, `min_shoe_eu`, traction, `fitness`, `guide`. Boats: `vessel`, `sea_state`, `stroller_on_board`, `min_age`. Penguin walk: `min_distance_m`, the Piratour minimum age (a known gap). | Hielo y Aventura terms PDF; Piratour; Parques Nacionales | Operator sites return menus to the fetcher: try PDFs and record `searched_none` with what was tried |
| **R4** iceland-ring-road-2027 (25) | beach (Djupalonssandur, Reynisfjara), waterfall, hike 5, hot_spring 1 (Myvatn), glacier (if a glacier walk is in the plan), town 4, viewpoint 5, sight | Beaches: `hazards` (sneaker waves), `current_or_tide`, `lifeguard` (none). Myvatn: `min_age` 1, under-12 adult rule, `floats_required_under` 8, `clarity` cloudy, water temperature. Waterfalls: `walk_m`, `exposure`. | Safetravel, the national park pages, myvatnnaturebaths.is/terms | Hot-spring child rules come from the terms page, not ticket resellers |
| **R5** utah-five-parks (21) | hike 12, viewpoint 4, sight 4, town 1, drive (UT-12 if it is a stop) | Angels Landing: permit as `official_rule` in `access_season` and a booking mark; the Narrows: `water_safety` (current, `water_temp_c`), `access_season` (flow closures), `hazards` (flash floods); Pa'rus: `wheelchair` step_free (`official_info`). | NPS park pages and accessibility pages | The Narrows is a `hike` with water fields, and `water_safety` is N on `hike`. Until Q1 is answered, put the flash-flood and cold-water facts in `hazards` and the flow closure in `access_season`, and list the Narrows under "Applicability questions" |
| **R6** chamonix-mont-blanc-2028, algonquin-muskoka-2026, vermont-fall-2026 (26) | lift 2 (Aiguille du Midi, Montenvers), hike, lake 2, town, viewpoint, sight | Lifts: `altitude_m` (3,842 m; the operator's child advice), `cabin`, `last_down`, `stroller_on_board`, `weather_cancel`. Algonquin: `group_min` (`none_stated`), `hazards`, `walk_m` for the lookouts. | Compagnie du Mont-Blanc; Ontario Parks; Vermont FPR | Aiguille du Midi child advice is likely a recommendation: `age_rule: recommendation`, not a rule |

### 8.3 One pass for both specs

The lanes run once for suitability and relevance. Each lane prompt is assembled as: this page's 8.1 and the lane's 8.2 row, then the relevance slot from relevance.md, then suitability.md 8.1's acceptance checks with the changes above. Each spec keeps its own output file per lane, so ownership stays disjoint: `data/suitability/<trip>/<lane>.json` here, and the relevance sidecar there.

## 9. Open questions for the owner

1. **Water on a trail.** The Narrows (Utah) and some canyon hikes are trails in a river. Should a hike be allowed `water_safety` as an exception, or should these become a new `river_hike` profile? Recommended: a `river_hike` profile, which is the hike row plus `current_or_tide`, `water_temp_c` and the flow closure. This only blocks R5.

There are no other blocking questions. suitability.md section 10 questions 1-5 still stand.

## 10. Gotchas

- **A weight limit can depend on the time of day.** Interlaken tandems cap at 80 kg on the first and last slots and 100 kg otherwise. A single `max_weight_kg` hides that.
- **"Family" rafts run from 2 to 8 years minimum on nearby rivers.** The Bow River float takes 2-year-olds and the Kicking Horse family trips 6-8+. Never generalise a kind's age.
- **A reseller's limit is a conflict, never the value.** Norquay's own 120 kg against a reseller's 140 kg is the pattern.
- **Crampon fit is a hidden age gate.** EU 34 is roughly a child of 9-10. It excludes small children even when the minimum age is 8.
- **Cloudy water is a supervision hazard** (Myvatn). It is not obvious from photos.
- **"Not applicable" is not "not checked".** A lane that types `not_applicable` on an R field to reach Usable fails `E_SUIT_NA_EXEMPT` unless it says why.

## 11. Resolutions made while building S0b (18 Oct 2026)

Where the spec was silent or two parts disagreed, the build chose as follows. The code and `data/schema/suitability-applicability.json` are the source of truth.

| # | Question | Resolution |
|---|---|---|
| B1 | `river_hike` (Q1) | A 35th profile, subkind `river_hike` of kind `trail`: the hike row with `water_safety.current_or_tide` and `water_temp_c` R and `swim_ability` A. `access_season` is already R, which carries the flow closure. |
| B2 | One record has one `ext` block, but 2.7 gives `walk_m` (trail) to lakes and beaches that also need `ext.water.swimming` | `walk_m` moved out of `ext.trail` to the shared block, so a lake or a beach keeps `water` as its one extension. No record used it. |
| B3 | `subkind` is "required and closed" and E_SUIT_SUBKIND exists | Zod keeps `subkind` an optional string and the validator raises E_SUIT_SUBKIND for a missing, unknown or wrong-kind value, so the error is specific and not E_SUIT_SCHEMA. A (kind, subkind) pair that no profile claims is also E_SUIT_SUBKIND. |
| B4 | The `op` cells and "the other participation cells become A" | `op` is R when the record is operated, else N. Every other `participation.*` cell keeps its mark when operated and is N when not. A profile marked `always` is operated, `never` is not, `flag` takes the record's `operated`. `never` profiles ask for no participation field (checked in the file). Flag profiles: hike, river_hike, walk, wildlife, show_cave, canoe_kayak, sup, cycle_path. Jasper Dark Sky stays a `sight` with no `operated` flag, because participation is N for a sight. |
| B5 | `stroller_extent` and `min_shoe_eu` share a cell with `stroller` and `wear` | `stroller_extent` is A wherever `stroller` is R or A (a record with `stroller: none` has no extent). `min_shoe_eu` is R on a glacier walk, A on ferrata and caving, N elsewhere. |
| B6 | Paths the tables do not carry | `effort.drivers.loss_m` is A where `gain_m` is R or A. `effort.drivers.max_grade_pct` is A on walk, cycle_path and mtb_xc. `ext.cave.tour_m` (in the 6.3 block, not in 2.7) is A on show_cave and caving. |
| B7 | Field counts | The 2.7 table plus 6.3 give 23 new fields on the five existing extensions (ride 5, paddle 7, ferrata 3, water 3, cave 5), not 18, and 42 fields on the ten new extensions, not 34. Three fields left the extensions (`trail.hazards`, `trail.walk_m`, `ferrata.guide`). The file lists 148 paths per profile after B13-B14. |
| B8 | M5 duplicates, and `combo_with` | There is no `combo_with` field. The sight rows that are the same place as an adventure (Banff Gondola, Miette, Radium, Red Rock Parkway, the Nordic Centre) take the adventure's profile, and both records stay; coverage counts both refs because `scope.json` lists both. |
| B9 | M6, a second record for the Lagazuoi tunnels | It needs a ref that resolves without changing the 207 in `scope.json`. A new ref form `part/<parent ref>#<slug>` resolves when its parent does. The lift keeps no walk field; the walk record holds the trail facts (distance, descent, time, recommended age, hints). |
| B10 | The effort of a profile where it is N and the kind defaults | `deriveEffort` keeps the kind defaults (fixed keys). The flat copy, `projectForSchedule` and `familyEffortOf` return no family effort for a profile without one (`hasEffort`), so a gondola has `house_grade` null. |
| B11 | `ScheduleSuitability` | No field is added. The structural test against trip-timeline 3.11 still holds. Projections skip N fields by masking the block (`maskNotApplicable`) before they read it. The chips of the display design read the block and the profile in S1. |
| B12 | W_SUIT_BELOW_USABLE | One warning per draft record, naming the profile and the first six open R paths. `check` counts it; `check --coverage <trip>` prints each record's level. |
| B13 | The Ice Explorer in `air_tour`, where `flight_min` is R | A `vehicle_tour` profile (activity / `vehicle-tour`), always operated, no extension. R: `min_age`, `age_band`, `kid_note`, `on_site_min`, `stroller_on_board`, `wheelchair`, `access_season`, `participation.weather_cancel`. A: `toilets` (on board) and the air-tour limits. `air_tour` keeps `heli` and `scenic-flight`. |
| B14 | Parks, ranges and day-use areas are not sights with an effort | An `area` profile (sight / `park`, sight / `area`), never operated, effort N because the child trail records carry it. R: `kid_note`, `on_site_min`, `access_season`, `hazards`. A: stroller, wheelchair, accessible toilet, toilets, food, water, signal, altitude, `group_min`, `limited_capacity_note`, and a new `area` extension (`pass`, `access_road`, `stay_on_site`, `child_trails`). Used for the Dolomites range, the four Rockies provincial parks, Goblin Valley, Lake Magog and the Kananaskis day-use lakes. 37 profiles in all. |
| B15 | Records whose migrated data is a walk | Cadini, Cinque Torri and Seceda ridge become `trail/walk`. Braies, Dobbiaco, Limides and Federa stay lake records and gain a `part/place/<slug>#walk` record (Federa is a `hike`) that holds the distance, climb, time, recommended age and hints; the kid note about the shore stays with the lake. This clears the 8 W_SUIT_NA_FIELD warnings with no value lost. Landro has no walk data and stays a lake. |
| B16 | M1 default of `hike` | A trail whose migrated figures are at most 3 km and 100 m of climb becomes `walk` (18 records); the reason in `kind-map.json` quotes the figures. Everything else stays `hike`. |
| B17 | Smaller fixes | Sulphur Mountain trail is `trail/hike` (unguided). The covered bridge loop is `drive/scenic_drive`. The Akureyri botanical garden is `sight/attraction`. `min_height_cm` is A on the bungee profile, which covers the `swing` subkind. A `part/` ref with an empty slug does not resolve. `projectForSchedule` returns no `terrain` or `effortKm` where the profile has no effort, and writes "child time our rule" only where `child_time_min` applies. |

## Change log

| Date | Change |
|---|---|
| 2026-10-18 (S0b fixes) | Verifier fixes: `vehicle_tour` and `area` profiles (37), unguided Sulphur Mountain, lake walks split out, easy walks, covered bridge loop; B13-B17 |
| 2026-10-18 (S0b) | Built: schema delta, 35-profile file, kind-map, migration; section 11 records the choices made where this page was silent |
| 2026-10-18 (display rules) | Fable check of section 5: chips name the effort (no "FE3"); the limits chip's "+n" counts pregnancy and medical bans; cards carry two chips (P8); rule, advice and gap looks defined; a whole-profile N section is not a missing-data marker; the research line on the section head; PC10-PC12 added; filter labels moved to design/suitability-display.md |
| 2026-10-18 | First draft: 34 profiles (a 35th, `river_hike`, waits on Q1); R, A and N matrix across six field groups plus the extensions; kind-specific fields from operator and authority sources; at-rest, detail, filter and completeness rules checked against P1-P7 and T1-T5 (9 conflicts resolved); S0b schema delta; migration consequences M1-M10; lane instructions with the relevance slot |
