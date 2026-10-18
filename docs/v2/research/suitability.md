# Suitability: who a place suits, with provenance

Status: draft (18 Oct 2026). This is the foundation spec. Nothing in it is built yet. Build order: **S0** (schema, validator, migration; section 9), then the enrichment lanes **R1 to R6** (section 8), then **S1** (adapter, "Who it suits", filters; section 7.5).

Owner request (18 Oct 2026), summarised:
- Every place and detail needs metadata that tells a visitor whether it suits a 6-year-old, a 10-year-old, a baby in a stroller, or someone with limited capacity.
- This matters most for hikes, trails and walks. It applies equally to adventures: zip lines, bungee, mountain biking (how hard the riding is) and canoeing.
- The schema comes first. Then enrich only the places linked to trips already planned. Places with no data are left for now.

This page **extends** and does not replace:
- the kind profiles ([kinds/README.md](kinds/README.md) sections 4, 8 and 10), whose value states and household check it reuses;
- the trails lane ([lanes/trails.md](lanes/trails.md) sections 6 and 7);
- the family and accessibility lanes ([lanes/family-and-kids.md](lanes/family-and-kids.md), [lanes/accessibility.md](lanes/accessibility.md)).

It **supersedes** three things:
- the flat `eligibility.stroller` enum (`yes`, `jogging_stroller`, `no`);
- the trail profile's U10 check;
- the meaning of "house grade". The house grade becomes the **family effort** grade, extended from hiking to every kind (section 3).

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| K1 | **One `suitability` block for every kind**, plus a per-kind extension (`trail`, `ride`, `paddle`, `ferrata`, `water`, `cave`, `snow`). Products that differ (offers) carry their own block. | A 6-year-old filter has to work the same way on a lake, a zip line and a hike | Some fields are `not_applicable` for many kinds; the validator removes those from the totals |
| K2 | **Every value is a `Val`**: a value or a state (`value`, `none_stated`, `searched_none`, `not_applicable`, `gap`), a **basis** (`operator_rule`, `official_rule`, `official_grade`, `official_info`, `community`, `our_inference`), source ids, and a read date | The owner's honesty rule; "not stated by the operator" is a valid, displayable answer | Records are about three times larger than flat columns |
| K3 | **Hard limits are only `operator_rule` or `official_rule`.** Age, height, weight, swimming and adult-ratio rules from anyone else are kept as conflicts. They never become the chosen value. | Resellers copy stale limits. A harness weight is not negotiable. | Many limits stay `searched_none` until someone asks the operator |
| K4 | **Recommended age is separate from minimum age.** `age_band` is our judgement (`our_inference`) with its reasons. `min_age` is a rule. | "Recommended from 12" is not "minimum 12" (Via Ferrata Loen trap) | Two age numbers on a card need careful wording (section 7.3) |
| K5 | **Family effort (FE1 to FE5) is computed, never typed.** It is `max(terrain grade, effort band)`. The terrain grade comes from the official grade through one mapping file. The effort band comes from `effort_km = km + gain_m / 100`, the formula already in `data/schema/difficulty-map.json`. The original grade always stays visible. | One filter across SAC, CAI, Parks Canada, IMBA, whitewater classes and piste colours. A reviewer can see why. | The mapping is ours; we publish it and cite each scale |
| K6 | **The profile gates on two things, not one**: a terrain cap by age, and the distance and climb ceiling. Family effort does **not** replace the ceiling. | A flat 14 km (FE3) and a short exposed ledge (FE3) are different problems for a 6-year-old | Departs from trip-timeline.md 3.11, which said familyEffort replaces the ceiling (section 6.2) |
| K7 | **Child time is stored only when a source states it.** Otherwise it is computed at runtime from the timeline's multipliers and labelled "our rule". | No invented numbers in the data; one place to tune the rule | Few sources state child times, so most child times are computed |
| K8 | **Enrichment writes sidecar files, `data/suitability/<trip-slug>/<lane>.json`**, keyed by stable refs. It does not edit trail, prototype or schedule files. | Lanes L4b (trail tracks) and L3c (timeline) edit those files at the same time | One extra join in the adapter. The data moves into the catalog when catalog rows exist. |
| K9 | **The flat catalog columns stay as a projection** of the block (`min_age`, the height and weight limits, `house_grade`, `kid_fit`, `accessibility`, `walk_km`, `walk_gain_m`) | SQL filters and the existing adapter keep working | A derive step must run after every change. The validator fails on drift. |
| K10 | **AllTrails, Komoot, Gaia, Outdooractive and Wikiloc are never a `src`.** A trail figure needs an official or operator source, or a track plus a DEM. Otherwise it is a gap. | sources-and-licences.md; trip-planner skill: "AllTrails and an official source. Never AllTrails alone." | Utah and Patagonia trails lean on NPS and APN pages, which are thinner |

## 1. The shared model

### 1.1 The value wrapper

```ts
// core/src/schema/suitability.ts
type Basis =
  | 'operator_rule'   // the operator's own rule: age, height, weight, harness, swim test, adult ratio
  | 'official_rule'   // a land manager's or a law's rule: group of four, permit age, no strollers on the bus
  | 'official_grade'  // a published grade in a recognised system: SAC T2, CAI E, Parks Canada Moderate, Class II
  | 'official_info'   // a land manager or operator states a fact that is not a rule: "paved for 1.2 km", "toilets at the lot"
  | 'community'       // dated trip reports, parent blogs, forum posts; never for a hard limit
  | 'our_inference';  // our judgement or our computation, with the method in `note`

type State = 'value' | 'none_stated' | 'searched_none' | 'not_applicable' | 'gap';

interface Val<T> {
  v: T | null;              // null unless state = 'value'
  state: State;
  basis: Basis | null;      // required when state is 'value' or 'none_stated'
  src: string[];            // ids into the file's sources table (each has url and read date); [] only for computed values
  read?: string;            // ISO date when this value was read later than its source row
  quote?: string;           // up to 300 characters, the words the value rests on (units as written)
  note?: string;            // our words: the method for our_inference, the unit conversion, the reason
  tried?: string[];         // required for searched_none: queries and pages tried
  on?: string;              // required for searched_none: the date of the search
  conflicts?: { v: T; basis: Basis; src: string[]; note?: string }[];
}
```

The states mean exactly what [kinds/README.md](kinds/README.md) section 4 says. The UI wording, which every surface uses:

| State and basis | Visitor sees |
|---|---|
| `value`, `operator_rule` | "Minimum age 8 (operator rule, read 12 Oct 2026)" |
| `value`, `official_grade` | "CAI E (official grade)" |
| `value`, `our_inference` | "Recommended from 8 (our judgement: 11 km and 750 m of climbing)" |
| `none_stated` | "No minimum age (operator states none, read ...)" |
| `searched_none` | "Minimum height not stated by the operator (searched 12 Oct 2026). Ask before booking." |
| `gap` | "Not checked yet" (hollow chip) |
| `not_applicable` | hidden |

### 1.2 The shared block (every kind, every offer)

| Group | Field | Type | Allowed basis | Notes |
|---|---|---|---|---|
| **Hard limits** | `min_age`, `max_age` | `Val<int>` years, on the activity date | `operator_rule`, `official_rule` | `age_rule` says `rule` or `recommendation`. A recommendation is `operator_rule` with `age_rule: 'recommendation'`. It warns and does not exclude. |
| | `age_rule` | `'rule' \| 'recommendation'` | | |
| | `min_height_cm`, `max_height_cm` | `Val<int>` | as above | convert inches, with a `note` ("44 in = 112 cm") |
| | `min_weight_kg`, `max_weight_kg` | `Val<number>`, one decimal | as above | convert pounds with a note. **Say which end it is**: the Kicking Horse 50 lb minimum was stored as a maximum |
| | `limit_reason` | `'harness' \| 'seat' \| 'equipment' \| 'insurance' \| 'law' \| 'policy' \| null` | | harness and seat limits show "not negotiable" |
| | `adult_required` | `Val<'none' \| {under: int} \| {ratio: int}>` | as above | "under 16 with an adult"; "one adult per 2 children" |
| | `group_min` | `Val<{n: int, season?: string}>` | `official_rule` | the Parks Canada group of four |
| **Who it suits** | `age_band` | `Val<{from: int, to: int \| null}>` | `our_inference`, `official_info` | the **recommended** band. `note` holds the reason with numbers. |
| | `kid_note` | `string` (our words, one or two sentences) | | the honest sentence: "Long for under-9s; the meadow at 8 km is a natural turnaround" |
| | `carrier_ok` | `Val<boolean>` | any except `community` alone for `true` on exposed routes | a toddler in a back carrier is sensible: no hands-on sections, no ladders, no `serious` exposure |
| | `stroller` | `Val<'smooth' \| 'all_terrain' \| 'none'>` | `official_info`, `community`, `our_inference` | **smooth**: paved, boardwalk or compacted fine gravel, any pushchair. **all_terrain**: packed gravel and roots with big wheels. **none**: steps, rock or narrow tread. |
| | `stroller_extent` | `{scope: 'whole' \| 'part', part_note?: string, part_km?: number}` | | "first 1.2 km paved, then steps" is `smooth` + `part` |
| | `wheelchair` | `Val<'step_free' \| 'partial' \| 'none'>` | `step_free` needs `official_info` (accessibility lane rule) | |
| | `access_detail` | `{surface, max_gradient_pct, steps, width_min_cm, length_m}` (each `Val`) | | lanes/accessibility.md section 3 |
| | `accessible_toilet`, `accessible_parking` | `Val<boolean>` | | |
| | `limited_capacity_note` | `string` | | our words for "someone with limited capacity": rest points, benches, a lift alternative, the shortest version |
| **Effort** | `effort` | section 1.3 | | family effort and its inputs |
| **Time** | `adult_time_min` | `Val<[int, int]>` minutes | `official_info`, `our_inference` (Naismith, lanes/trails.md 7) | the moving time range for an average adult |
| | `child_time_min` | `Val<{from_age: int, to_age: int \| null, range: [int, int]}[]>` | `official_info`, `community` | **only when a source states it** (K7). Otherwise null, and the runtime computes it |
| | `on_site_min` | `Val<[int, int]>` | any | for non-walking kinds: time on site with children |
| **Facilities** | `toilets` | `Val<('start' \| 'route' \| 'payoff' \| 'none')[]>` | `official_info`, `community` | |
| | `water` | `Val<'potable' \| 'treat' \| 'none'>` | | |
| | `food` | `Val<'hut' \| 'cafe' \| 'none'>` | | the hut or cafe is its own entity, related by `combo_with` |
| | `shade` | `Val<'full' \| 'partial' \| 'none'>` | `community` allowed | |
| | `bail_out` | `Val<{name: string, at_km: number, note?: string}[] \| 'committing'>` | | turnaround points, a lift down, a road crossing. `committing` means no exit between start and end. |
| | `signal` | `Val<'good' \| 'patchy' \| 'none'>` | `community`, `official_info` | mobile coverage; carriers' coverage maps are `official_info` |
| **Hazards that decide age** | `exposure` | `Val<{level: 'none' \| 'some' \| 'significant' \| 'serious', fenced: 'fenced' \| 'partly' \| 'unfenced' \| null, where?: string}>` | `official_grade`, `official_info`, `community` | the household avoids unfenced cliff edges (lanes/family-and-kids.md) |
| | `altitude_m` | `Val<int>` high point | | above 2,500 m a slower ascent is advised for small children; a chip only, not a gate |
| | `water_safety` | section 2.4 | | any kind on or in water |
| **Access season** | `access_season` | `Val<{from: 'MM-DD', to: 'MM-DD', status: 'open' \| 'limited' \| 'closed', via: 'road' \| 'lift' \| 'shuttle' \| 'trail' \| 'boat', note?: string}[]>` | `official_info`, `operator_rule` | the season **of the access**, not of the place. Seceda is open when its lift runs; Moraine Lake when the shuttle runs. Carries `applies_to: 'YYYY'` (pattern year). |

### 1.3 The effort block

```ts
interface Effort {
  source_grade: Val<{ system: GradeSystem; value: string }> | null; // as published, always shown
  terrain: 1 | 2 | 3 | 4 | 5 | null;                              // from source_grade through difficulty-map v2, else from drivers
  terrain_basis: 'mapped' | 'drivers' | 'override';
  effort_km: number | null;                                        // km + gain_m / 100, with mode factors (2.2)
  band: 1 | 2 | 3 | 4 | null;                                      // from effort_km (bands below)
  family_effort: 1 | 2 | 3 | 4 | 5 | null;                         // max(terrain, band); computed by derive, never typed
  override?: { grade: 1 | 2 | 3 | 4 | 5; reason: string; by: string; on: string };
  drivers: {                                                       // the basis, each a Val
    distance_km: Val<number>; gain_m: Val<number>; loss_m: Val<number>;
    surface: Val<('paved' | 'boardwalk' | 'gravel' | 'dirt' | 'roots' | 'rock' | 'scree' | 'snow' | 'water')[]>;
    scrambling: Val<'none' | 'hands_occasional' | 'hands_needed' | 'climbing'>;
    fixed_aids: Val<('chains' | 'cables' | 'ladders' | 'steps')[]>;
    max_grade_pct?: Val<number>;
  };
}
```

**Effort bands** are the existing `difficulty-map.json` bands, unchanged: `effort_km` under 6 is 1, under 12 is 2, under 20 is 3, and 20 or more is 4. FE5 is reserved for technical terrain.

**Terrain from drivers**, used when no official grade exists. A reviewer can override it with a reason.

| Driver | Terrain at least |
|---|---|
| paved, boardwalk, under 5% (the ABA accessible-trail limit for any length) | 1 |
| path, no hands, `exposure` none | 2 |
| rough, loose or steep path; `exposure` some | 3 |
| `scrambling: hands_occasional`, `exposure` significant, chains or ladders | 4 |
| `hands_needed` or `climbing`, `exposure` serious, harness | 5 |

### 1.4 Family effort: the common scale

| FE | Name | Means for a family | Typical child fit (advice, section 6) |
|---|---|---|---|
| 1 | Stroll | flat or nearly flat, made surface, under about 6 effort-km, no drop-offs | any age; usually a stroller |
| 2 | Easy | a clear path with no hands and no exposure, under about 12 effort-km | from 4, or carried |
| 3 | Moderate | rough or steep path, sure footing, some drop-offs beside a wide path, or a long day of easy ground | from 6 |
| 4 | Hard | long and steep, hands sometimes, exposed sections, chains or ladders; via ferrata A-B; Class III water; black runs | from 10, with hard limits checked |
| 5 | Technical | serious exposure, scrambling, route-finding, harness and lanyards; via ferrata C and above; Class IV and above | 16 and over |

## 2. Per kind: recognised scales and extensions

Every scale below maps to a terrain grade in `data/schema/difficulty-map.json` v2 (built in S0). The table cells are that file's content. Where a mapping is our judgement it says so. Sources were read on 18 Oct 2026, through search results unless "opened" is written.

### 2.1 Hiking, walks and viewpoints reached on foot

| System (`GradeSystem`) | Grades | Terrain map | Source |
|---|---|---|---|
| `sac` (Swiss Alpine Club hiking scale; OSM `sac_scale`) | T1 hiking, T2 mountain hiking, T3 demanding mountain hiking, T4 alpine hiking, T5 demanding alpine, T6 difficult alpine. Grades assume good conditions. | T1 short and flat 1, T1 2, T2 3, T3 4, T4 to T6 5 (the existing map) | SAC scale PDF via BASPO: https://www.baspo.admin.ch/dam/fr/sd-web/qKSxeWIiXYZa/sac-berg-und-alpinwanderskala_FR.pdf ; Euregio comparison: https://www.europaregion.info/en/euregio/projekte/nachhaltigkeit/digiway-geodata-for-safety-in-the-mountains/comparison-tool/sac |
| `cai` (Club Alpino Italiano) | T turistico (lanes, mule tracks, easy paths, usually below 2,000 m), E escursionistico (paths over mixed terrain, some steep protected bits), EE escursionisti esperti (fixed ropes, short ladders, steep slippery slopes), EEA (via ferrata; helmet, harness, lanyard with an energy absorber), EAI (snowshoe) | T 1 or 2 (2 above 6 effort-km), E 3, EE 4, EEA 5 (refined by the ferrata grade, 2.3) | CAI scale PDF (Regione Valle d'Aosta): https://mappe.regione.vda.it/MOBILE/Sentieri/documenti/scala_difficolta_esc_CAI.pdf |
| `yds` (Yosemite Decimal System classes) | Class 1 trail; 2 simple scrambling, hands occasionally; 3 scrambling, hands needed; 4 simple climbing, exposure, falls can be fatal; 5 roped climbing | 1 (flat) 1, 1 2, 2 4, 3 5, 4 and 5 out of scope (5) | https://en.wikipedia.org/wiki/Yosemite_Decimal_System (definitions vary by source; the class is set by the hardest move) |
| `parks-canada` | Easy (hard-packed surface, few obstacles, under 2 h, little elevation change), Moderate (mostly stable, under 5 h, some short steep sections), Difficult (major elevation gain, long steep sections, varied terrain), Route (unmarked, route-finding). Definitions vary by park. Gros Morne adds gain bands: 0-100 m, 100-500 m, 500 m and over. | Easy 1, Moderate 2, Difficult 4, Route 5 (existing); the effort band usually lifts long Moderates to 3 | https://www.parks.canada.ca/voyage-travel/experiences/sports/randonnee-hiking/niveaux-sentiers-trail-ratings ; https://parks.canada.ca/amnc-nmca/on/super/activ/experiences/randonnees-hiking/classification |
| `nps` | No national NPS scale. Parks use Easy, Moderate and Strenuous in their own words. Shenandoah publishes a formula: sqrt(gain_ft × 2 × miles). Under 50 Easiest, 50-100 Moderate, 100-150 Moderately Strenuous, 150-200 Strenuous, over 200 Very Strenuous. The park itself notes exceptions (Dark Hollow Falls scores 36 and is rated Moderate for steepness). | Easy 1, Moderate 2, Strenuous 3, Very strenuous 4; the Shenandoah numeric score is effort only, so it feeds `band` and not `terrain` | https://home.nps.gov/shen/planyourvisit/how-to-determine-hiking-difficulty.htm |
| `dnt`, `apn`, `sepaq`, `uk` | as in difficulty-map v1. DNT green, blue, red and black are still unmapped (Norway is out of scope until L3d). | unchanged | existing file |
| `local` | any other published word ("easy" on a valley board page) | no mapping: terrain comes from drivers, with `terrain_basis: drivers` | |

Hiking extension (`ext.trail`): `shape`, `navigation` (`waymarked`, `signed_junctions`, `cairns`, `route_finding`), `water_crossings`, `snowfields_until`, `hazards`, `dogs` (all already defined in lanes/trails.md section 6). Viewpoints and waterfalls carry `ext.trail` only for the walk from the car. A roadside viewpoint has `walk_m` and `exposure`.

### 2.2 Cycling paths and mountain biking (`ext.ride`)

| System | Grades | Terrain map | Source |
|---|---|---|---|
| `imba` (IMBA Trail Difficulty Rating) | White circle (easiest; hardened, under 5% average), Green circle (easy), Blue square (more difficult), Black diamond (very difficult), Double black (extremely difficult). It rates the technical challenge only, not fitness. | white 1, green 2, blue 3, black 4, double black 5 | https://imbacanada.com/trail-difficulty-rating-system/ ; OSM `mtb:scale:imba`: https://wiki.openstreetmap.org/wiki/Key:mtb:scale:imba |
| `sts` (Singletrail-Skala; OSM `mtb:scale`) | S0 to S5, open-ended, technical only, ideal conditions, rated by the predominant section | S0 2, S1 3, S2 4, S3 to S5 5 | https://singletrail-skala.de/downloads?lang=en ; https://wiki.openstreetmap.org/wiki/Key:mtb:scale |
| `trailforks` | White, Green, Blue, Black, Double Black, Proline (plus separate UK/EU and NZ scales) | as IMBA; Proline 5 | https://www.trailforks.com/about/metadata/ (link only for facts; Trailforks is a community platform, so its grade is `community` unless the land manager publishes the same) |
| `whistler` (Whistler trails database, aligned with IMBA) | Green, Blue, Black, Double black. Whistler says its trails run harder than other networks. | as IMBA, plus a chip "local grades run hard (the operator says so)" | https://whistler.com/trails/bike |
| `bike-path` (ours) | `car_free_paved`, `car_free_gravel`, `quiet_road`, `shared_road` | paved and car-free 1, gravel 2, quiet road 3 (traffic), shared road 4 for children | our rule; label "our grade" |

Ride extension: `bike_hire` (child seats, trailers, tag-alongs, e-bikes with `Val` and price on the offer), `traffic` (`none`, `crossings`, `sections`), `min_rider_age` on hire (operator rule), `one_way_return` (the Drava path to Lienz returns by train: `{mode: 'train', bikes_allowed}`). **Effort for riding**: `effort_km = km × 0.25 + gain_m / 100`. Four km of riding count as one km of walking. This factor is **our rule**, tunable in difficulty-map v2, and labelled so.

### 2.3 Via ferrata (`ext.ferrata`)

| System | Grades | Terrain map | Source |
|---|---|---|---|
| `schall` (A to E, sometimes F) | A easy (beginners and children with protection), B moderate (the most common), C difficult, D very difficult (vertical, holds far apart), E extremely difficult (partly overhanging); F exists on two routes | A 4, B 4, C 5, D 5, E 5 | https://climbers-paradise.com/en/blog/article/via-ferrata-tutorial-05-types-and-difficulties ; https://www.bergfreunde.eu/via-ferrata-grades-calculator/ |
| `huesler` (K1 to K6) | verbal scale; K1 is about Schall A | K1-K2 4, K3 and above 5 | same sources (the K-level text was not found; GAP) |
| `cai-ferrata` (Italian guides: F, PD, D, MD, ED) | facile, poco difficile, difficile, molto difficile, estremamente difficile | F and PD 4, D and above 5 | CAI PDF above (EEA-PD wording); montagna.tv: https://www.montagna.tv/186309/scala-difficolta-vie-ferrate/amp/ |
| `osm-ferrata` (OSM `via_ferrata_scale` 1 to 6) | as tagged (Loen: 4 main, 2 alternate exit) | 1-2 4, 3 and above 5 | OSM wiki |

Ferrata extension: `kit` (`provided`, `rent`, `own`), `guide` (`required`, `recommended`, `none`), `kit_weight_note`. **Weight is the real gate.** A DAV safety study (2010) found standard ferrata sets risky below 50 kg body weight and seriously so below 30 kg. Children's full-body harnesses are rated to about 40 kg. Source: a secondary summary of the DAV test, https://www.bergsteigen.com/produkte/test-klettersteigsets-fuer-kinder/ (search result, not opened). So a ferrata with no published weight rule gets `min_weight_kg: searched_none`, plus a fixed advice chip: "Ferrata sets are tested for 50 kg and over; ask the operator about a child set." The chip text is `our_inference` citing that source. **We never turn the chip into a rule.**

### 2.4 Paddling, boats, lakes and swimming (`ext.paddle`, `water_safety`)

| System | Grades | Terrain map | Source |
|---|---|---|---|
| `whitewater` (International Scale of River Difficulty, American Whitewater) | Class I easy (riffles, small waves, little risk to swimmers); II novice (clear channels); III intermediate; IV advanced; V expert; VI rarely run. The class changes with water level. | `flatwater-sheltered` 1, `flatwater-open` (wind, cold, crossings) 2, I 2, II 3, III 4, IV-VI 5 | https://americanwhitewater.org/content/Wiki/safety:ratingssurvey ; https://en.wikipedia.org/wiki/International_scale_of_river_difficulty |
| `flatwater` (ours) | `sheltered` (small lake, rental zone), `open` (big lake, wind fetch, glacial cold), `sea_sheltered`, `sea_open` | 1, 2, 2, 3 | our rule |

`water_safety` (any kind on or in water):

| Field | Values |
|---|---|
| `class` | `Val` of the whitewater or flatwater grade above |
| `lifejacket` | `Val<'provided_all_sizes' \| 'provided_adult_only' \| 'bring_own' \| 'not_provided'>`; `child_sizes_from_kg` (operator) |
| `swim_ability` | `Val<'none_needed' \| 'comfortable' \| 'tested'>`; `operator_rule` for a stated test |
| `lifeguard` | `Val<boolean>` with the season |
| `entry` | `Val<'shallow_gradual' \| 'steps_or_ladder' \| 'drop_off'>` for swim spots and beaches |
| `water_temp_c` | `Val<[int, int]>` by month; glacier lakes stay cold, so this is `official_info` or `community` with a date |
| `current_or_tide` | `Val<'none' \| 'some' \| 'strong'>` with a note |
| `min_age_on_board` | for boat tours: an `operator_rule` (Zodiac and RIB tours often set one), else `searched_none` |

Boat tours and cruises are FE1 by default. Their suitability is the limits, the duration (`on_site_min`), toilets on board, sea state (`current_or_tide`), and the `access_season`.

### 2.5 Zip line, bungee, coasters, swings, canyoning, rafting and horses

There is no recognised public grade. **The operator's limits are the whole answer.** We searched for an industry rule (the ACCT zip-line standard) and found no public participant rule. Operators set their own, and they vary widely: one course sets 80-250 lb (36.3-113.4 kg), another a 50 lb (22.7 kg) minimum, another 44 in (112 cm) and 8+ with an adult up to 17. Source: search results of 18 Oct 2026, for example https://www.omnihotels.com/hotels/homestead-virginia/things-to-do/resort-activities/zip-line/participant-requirements . **So we never carry a limit from one operator to another.**

| Kind | Terrain | Required beyond the shared block |
|---|---|---|
| zip line | 2 (plus any walk-in) | min and max weight, min height, min age, `adult_required`, `limit_reason` (usually `harness`) |
| bungee, giant swing | not_applicable (FE shown as "limits only") | as zip line, plus a `medical` list and `waiver_signer_age` |
| mountain coaster (Funbob, Gardonè) | 1 | min age to ride alone, min height to ride alone, min age as a passenger, max riders per sled |
| canyoning | 4 or 5 by operator level (operators publish their own levels: `operator` grade system) | `swim_ability`, jumps optional or not, wetsuit sizes from |
| rafting | the river class (2.4) | the class **at the trip's water level**, by month (the class changes with level) |
| horse riding | 2 or 3 by ride length | min age, `max_weight_kg` (`limit_reason: policy`, horse welfare), helmet sizes |

### 2.6 Skiing and snow (`ext.snow`)

Piste colours are resort-relative and differ by region. `source_grade.system` is the region's scale.

| System | Colours | Terrain map | Source |
|---|---|---|---|
| `piste-eu` (most of Europe) | green (beginner), blue (easy), red (intermediate), black (expert) | green 1, blue 2, red 3, black 4, off-piste or itinerary 5 | https://en.wikipedia.org/wiki/Piste ; https://www.skiclub.co.uk/discover-snowsports/staying-safe/piste-maps/ |
| `piste-at-ch` (Austria, Switzerland) | blue (beginner), red, black; no green | blue 2, red 3, black 4 | same |
| `piste-na` (North America) | green circle, blue square, black diamond, double black diamond; ratings are consistent only within one resort | green 2, blue 3, black 4, double black 5 | same |
| `piste-jp` (Japan) | green, red, black; no blue | green 2, red 3, black 4 | same |

Snow extension: `ski_school_min_age` (operator rule), `magic_carpet` (bool), `lift_child_rules` (lift height or adult rules, operator). Snowshoe routes use CAI EAI or the hiking scale. No trip in scope has skiing today. The mapping is in S0 so the scale exists when one does.

### 2.7 Caves, sights, towns and wildlife

| Kind | Terrain | Key fields |
|---|---|---|
| show cave | 1 if paved with rails and few steps; 2 with more than 100 steps; mark `steps` | `access_detail.steps`, temperature (`water_temp_c` reused as `air_temp_c`), `stroller` (usually `none`: carriers at the door), operator min age |
| adventure caving | 4 or 5 | helmet and lamp provided, crawling, `min_age` operator |
| museum, castle, landmark | 1 | `wheelchair`, `stroller` (often a cloakroom rule: `operator_rule`), `accessible_toilet`, `on_site_min` with children |
| town | 1 | `stroller` (cobbles: `all_terrain`), `wheelchair` (old town steps), toilets, `limited_capacity_note`. **Lite profile**: effort fields `not_applicable` |
| wildlife viewing | from the walk; 1 when roadside | `on_site_min`, early start (`access_season` plus a note), "quiet needed" note, `hazards` (bears) |
| lift used as the outing | 1 at the top station, plus the walk | `lift_child_rules`, `stroller` on the cabin (`operator_rule`), last ride down in `access_season.note` |

## 3. Provenance and honesty rules

1. **Every value has a source id and a read date.** The file's `sources` table carries `url`, `title`, `publisher`, `kind` and `read`, as research-sidecar/1 does. A value without `src` must be `our_inference` with a `note` that names the method ("Naismith from 7.4 km and 385 m", "effort_km 18.7, band 3").
2. **Never invent a limit.** An age, height or weight with no operator or official source is `searched_none`, with `on` and `tried`. The validator bounces `value` with any other basis (`E_SUIT_LIMIT_BASIS`).
3. **"Not stated by the operator" is a valid answer**, and the UI shows it as such (1.1).
4. **AllTrails and the other route platforms are never a source** (`E_SUIT_LINK_ONLY_SRC`). A trail's distance and gain need `official_info`, `official_grade`, an operator club, or `our_inference` from a stored track plus a DEM (L4b output). The AllTrails link may sit in the trail's links as a cross-check. Where AllTrails and the official figures disagree, the official figure is the value and the record notes the range.
5. **Our judgement is labelled as ours.** `age_band`, `carrier_ok` (when inferred), terrain from drivers, and every computed time are `our_inference`, and the chip says "our judgement".
6. **Conflicts are kept, never averaged.** Example: Sorapis gain 114 m against 460-630 m (kinds/trail.md section 11).
7. **Units.** A quote in lb, in, mi or ft needs a `note` with the conversion (`E_SUIT_UNIT`). Weight to one decimal (40 lb = 18.1 kg). A converted value within 1 kg or 2 cm of a limit is `marginal` in the household check (kinds/README.md section 8).
8. **Pattern year.** Limits, seasons and prices carry `applies_to` (the year read) and stay valid as a pattern. A public trip is a dateless template.
9. **Freshness.** Limits 365 days. Grades and stats 3 years. Access season 365 days. Facilities, signal and shade 2 years. The completeness engine drops a stale field to `gap` at check time (kinds/README.md C7).

## 4. Completeness checks (added to every kind profile)

These are the family checks `F1` to `F12`. Each kind profile includes the ones its column marks. **U** counts for Usable, **C** for Complete, and a blank means not applicable. They replace trail U10 and adventure OU1 to OU4. Their wording moves here, and the profiles link to it.

| Id | Check | trail | viewpoint, waterfall, lake | sight, town | activity offer, lift | swim spot | stay, eatery |
|---|---|---|---|---|---|---|---|
| F1 | hard limits: age, height and weight, each a `value`, `none_stated` or `searched_none` | C | | | **U** | C | |
| F2 | `adult_required` and `group_min` (value or `none_stated`) | U | | | **U** | C | |
| F3 | `age_band` with a reason, and a `kid_note` | **U** | **U** | C | **U** | **U** | |
| F4 | `stroller` with `stroller_extent` | **U** | **U** | **U** | C | **U** | C |
| F5 | `carrier_ok` | **U** | C | | C | | |
| F6 | `wheelchair` (and `access_detail` when not `none`) | C | **U** | **U** | C | C | **U** |
| F7 | `effort`: `source_grade` (or `searched_none`) and the drivers distance and gain; `family_effort` computes | **U** | U when a walk is needed | | U for ride, paddle and ferrata | | |
| F8 | `adult_time_min` (or `on_site_min`) | **U** | **U** | C | **U** | C | |
| F9 | `toilets`, `water`, `shade` | C | C | C | C | **U** (toilets) | |
| F10 | `bail_out` and `signal` | C | | | C | | |
| F11 | `exposure` (and `water_safety` for any water kind) | **U** | **U** (fencing) | | **U** for water | **U** | |
| F12 | `access_season` | **U** | **U** | C | **U** | **U** | |

The badge counts them like any other check: "Usable · 21 of 30". Kind profiles get a one-line change, "Family checks F1-F12 from suitability.md apply as marked", and their totals are recomputed (S0 step 7).

## 5. Storage

### 5.1 The sidecar document `suitability/1`

```text
data/suitability/
  README.md                         schema, refs, examples (S0)
  <trip-slug>/migrated.json         S0 output: values moved from existing fields, nothing new
  <trip-slug>/<lane>.json           enrichment output (R1-R6), one file per lane
```

```jsonc
{
  "schema": "suitability/1",
  "trip": "canadian-rockies-2029",
  "lane": "R2a",
  "researched": "2026-10-20",
  "agent": "travel-researcher",
  "model": "opus",
  "sources": [
    { "id": "src-0001", "url": "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise",
      "title": "Lake Louise area hikes", "publisher": "Parks Canada", "kind": "official", "read": "2026-10-20" }
  ],
  "records": [
    {
      "ref": "legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass",
      "kind": "trail", "subkind": "hike",
      "suitability": {
        "age_band": { "v": { "from": 10, "to": null }, "state": "value", "basis": "our_inference", "src": [],
          "note": "11.2 km and 750 m (effort_km 18.7) is over the 6-7 and 8-9 ceilings; Larch Valley meadow is a turnaround" },
        "kid_note": "Too long and steep for a 6-year-old; the meadow is a natural turnaround.",
        "stroller": { "v": "none", "state": "value", "basis": "our_inference", "src": ["src-0001"], "note": "switchbacks on a dirt trail" },
        "stroller_extent": { "scope": "whole" },
        "group_min": { "v": null, "state": "searched_none", "basis": null, "src": [], "on": "2026-10-20",
          "tried": ["parks.canada.ca Moraine Lake page (404 on 12 Oct 2026)", "Banff trail conditions"] },
        "effort": {
          "source_grade": { "v": null, "state": "gap", "basis": null, "src": [] },
          "drivers": {
            "distance_km": { "v": 11.2, "state": "value", "basis": "official_info", "src": ["src-0001"] },
            "gain_m": { "v": 750, "state": "value", "basis": "official_info", "src": ["src-0001"] }
          }
        }
      }
    }
  ]
}
```

Values in this example come from `legacy/canadian-rockies-sept-2029/data/trails.json`. The R2a lane re-reads them before they count.

### 5.2 Refs (every ref must resolve; `E_SUIT_REF`)

| Ref form | For | Survives |
|---|---|---|
| `place/<slug>` | items with a public place page (the Dolomites' 42; Lake Louise) | L4 slugs are frozen |
| `legacy/<folder>/<dataset>/<id>` | the Rockies `trails`, `sights` and `adventures` rows | L4b promoting Rockies trails to pages (the adapter maps the id to the new slug) |
| `trip/<trip-slug>/<kind>:<normName>` | summary-trip stops with no page and no id (the adapter's `CategoryItem.key`) | renames break it; the validator lists unresolved refs, and the fix is a ref update |
| `offer/<parent ref>#<product>` | products of an activity (Family Float, Class III) | |

Per-offer blocks sit under `records[].offers[]`, each with `name` and its own `suitability`.

### 5.3 Derive and projection

`core/src/suitability/derive.ts` (S0) computes `effort.terrain`, `band` and `family_effort`, plus the flat projection: `min_age` and the other limits (only when `state: value` and the basis is a rule), `house_grade = family_effort`, `kid_fit`, `accessibility = wheelchair`, `walk_km`, `walk_gain_m`.

`kid_fit` is derived:
- `yes` when `age_band.from` is 7 or under;
- `strong-kid` when it is 8 to 11;
- `no` when it is 12 or over, or a hard `min_age` is 12 or over;
- `unknown` otherwise.

## 6. How it plugs in

### 6.1 Party profile on the trip timeline ([features/trip-timeline.md](../features/trip-timeline.md) 3.11)

S0 ships `projectForSchedule(record, offer?) → ScheduleSuitability` in `core/src/suitability/project.ts`. It returns exactly the interface in trip-timeline.md 3.11, plus five fields (a superset):

| Timeline field | From |
|---|---|
| `minAge`, `maxAge`, `minHeightCm`, `maxHeightCm`, `minWeightKg`, `maxWeightKg` | the limit when `state: value` and the basis is `operator_rule` or `official_rule`. When the only age is a `recommendation`, it is `minAge` with `rule: 'advice'` |
| `rule` | `'hard'` if any filled limit is a rule; `'advice'` if only recommendations; `null` if none. **Added**: `ruleByField: Record<limitField, 'hard' \| 'advice'>`, because one record can hold a hard weight and an advised age (Via Ferrata Loen: age 12 recommended, 40-120 kg harness) |
| `stroller` | `smooth` with scope `whole` gives `yes`; `smooth` with `part`, or `all_terrain`, gives `partly` (the note goes in the added `strollerNote`); `none` gives `no` |
| `wheelchair` | `step_free` gives `yes`, `partial` gives `partly`, `none` gives `no` |
| `carrierOk` | `carrier_ok.v` |
| `familyEffort`, `sourceGrade` | `effort.family_effort`; `sourceGrade` is `{system, value}` from `effort.source_grade`. The system enum widens to the `GradeSystem` list in section 2 (a superset of the timeline's six) |
| `childTime` | `child_time_min` when stated (`byAge` from `from_age`, minutes at the range midpoint), else `null` |
| `adultTime` | `adult_time_min` as `{min, max, source}` |
| `distanceKm`, `gainM`, `lossM` | `effort.drivers` |
| `provenance` | "Operator rule, read 12 Oct 2026; CAI grade from the Cortina section page; times our rule" |
| **Added** | `terrain` (the terrain grade on its own), `effortKm`, `exposureUnfenced: boolean`, `ruleByField`, `strollerNote` |

**Merge order.** L3c owns `core/src/schedule/**`, so S0 declares `ScheduleSuitability` itself. Whichever lane merges second changes `core/src/schedule/suitability.ts` to `export type { ScheduleSuitability as Suitability } from '../suitability/project.ts'`. A type test in S0 asserts that the two shapes match.

### 6.2 The age gates (tuned from trip-timeline.md 3.11)

| Youngest | Terrain cap | Walk ceiling (one walk) | Effort-km check | Reason |
|---|---|---|---|---|
| 0-3, carried | 2, and `carrier_ok` or `stroller` ≠ `none` | 8 km, 400 m (timeline 2.4) | 12 | the carrier adult's limit |
| 4-5 | 2 | 4 km, 200 m | 6 | familienleben.ch, 4-6 years: "ca. 2-4 km", "bis 150-250 Höhenmeter" (opened 18 Oct 2026) |
| 6-7 | 3 | 6 km, 350 m | 9.5 | 7-10 years: "ca. 4-8 km", "250-500 Höhenmeter"; matches the Rockies child notes |
| 8-9 | 3 | 9 km, 500 m | 14 | same band |
| 10-12 | 4 | 12 km, 750 m | 19.5 | 11+ years: "oft 8-12 km", "500-800 Höhenmeter" |
| **13-15** | **4** (FE5 shows an advice chip; it does not exclude) | adult | none | **Changed from 5.** FE5 is harness and exposure terrain. A DAV test (secondary source) found ferrata sets risky below 50 kg, a common weight at 13. The hard weight rules still gate the actual product. |
| 16+ | 5 | adult | none | |

- A relaxed pace lowers the terrain cap by one and the ceilings by 25%.
- **Both gates apply** (K6). Family effort does not replace the ceiling. That sentence in trip-timeline.md 3.11 is superseded, and its owner is told.
- `exposure` `significant` or `serious` with `fenced: unfenced` adds an advice chip for anyone under 8.
- Cross-check: DAV guidance, as quoted by indenbergen.de (opened 18 Oct 2026), puts children's time at about 1.5 times adult time, and the maximum walking time at about 4 h for ages 3-6, 5 h for 6-10 and 6-7 h for 10-14. That is consistent with the timeline's multipliers and day caps, so those stay as written. https://www.indenbergen.de/weblog/wie-weit-kann-dein-kind-in-den-bergen-wandern-richtlinien-je-nach-alter/ ; https://www.familienleben.ch/freizeit/ferien-reisen/wandern-mit-kindern-in-der-schweiz-touren-sicherheit-tipps-9876
- **Gotcha:** both pages are secondary. They are good enough for advice and must never be used for a rule. The ceilings stay "our rule" in the UI.

### 6.3 Trip tags and filters (lane L3b; spec to write: features/trip-tags.md)

| Tag or filter | Rule |
|---|---|
| **Kids from N** (trip) | the lowest youngest-age for which `selectVariant` finds a fitting variant on every day. Computed at build by running the profile at ages 0 to 17. This replaces the hand-typed `ageFit` (today 4 to 11 per trip in `publicTrips`). The old value is kept as a conflict until a person accepts it. |
| **Hike effort** (trip) | the max `family_effort` of the trails in the default variant: FE1-2 easy, FE3 moderate, FE4-5 strenuous. This replaces the "longest trail by km and gain" rule in the TODO row. |
| **Stroller-friendly** (trip) | every day's easiest variant has no walking item with `stroller: none`, except items that are folded access. "Some stroller days (n of N)" otherwise. |
| **Step-free** (trip, later) | as above with `wheelchair`. Shown only when at least 80% of items have a non-`gap` value. |
| Places: **Kids** | an age stepper. It hides places with a hard `min_age` above the age and dims places whose `age_band.from` is above it |
| Places: **Effort** | FE1 to FE5 multi-select; the original grade is shown on the card |
| Places: **Stroller** | smooth, or smooth plus all-terrain |
| Places: **Carrier OK**, **Step-free**, **Flatwater only** | booleans |

All of these are derived. None is typed by hand. A `gap` value never passes a positive filter ("Stroller-friendly" excludes unknowns) and never fails a negative one.

### 6.4 The place page "Who it suits" section (S1; Fable designs it)

Order:
1. **Chips**: limits (rule chips are solid; advice chips are outlined); recommended ages; stroller (with extent); carrier; wheelchair; family effort with the original grade ("FE3 · CAI E").
2. **Times**: "Adults 3-4 h. With a 6-year-old about 5 h 30 (our rule)."
3. **Facilities**: toilets, water, shade, signal, bail-out points.
4. **Water safety**, when it applies.
5. **When you can get there**: the access season.

Every chip opens its provenance (basis, source link, read date). `searched_none` reads "not stated by the operator". The section shows "Not checked yet" for gaps rather than hiding them. On trip-page entries the same chips appear in the expanded entry (trip-timeline.md 3.10).

### 6.5 Completeness

Section 4 adds the F checks to `web/lib/public/completeness.ts`'s tracked checks (S1). The badge's `notTracked` count falls as they land.

## 7. Scope today

Scope is every trail, activity and sight-type item (lakes, viewpoints, waterfalls, sights, towns, lifts) on a public trip page with days, plus the Dolomites place pages. Stays, food and logistics are out of scope, except `wheelchair` and `stroller` on stays, which come later. The six overview trips have no items yet (Costa Rica, New Hampshire, Niagara, Norway, Quebec, Switzerland). They join after L3d converts them to days.

Counted from the LD adapter on 18 Oct 2026 (`createPublicData()`, trip categories and place pages).

### 7.1 Counts by trip and kind

| Trip (slug) | Trails | Activities and lifts | Sights, lakes, viewpoints, towns | In scope | Any structured suitability signal today | Meets the new Usable bar |
|---|---|---|---|---|---|---|
| dolomites-2027 (42 place pages, minus 2 eateries) | 12 | 4 (Funbob, rafting, Drava cycle path, Lagazuoi lift) | 24 (8 lakes, 5 viewpoints, 2 sights, 9 towns) | **40** | 19 (18 with trail facts, 8 with a min age, 3 kid notes) | 0 |
| canadian-rockies-2029 | 33 | 15 (12 activities, 3 lifts) | 28 | **76** | 76 (trails: km, gain, hours, audience, child note on all; sights: child note on all; activities: `child_6yo_ok` on all, min age on 10 of 43 rows, 0 heights) | 0 |
| iceland-ring-road-2027 | 5 | 1 | 19 | **25** | 0 (prose in research md only) | 0 |
| utah-five-parks | 12 | 0 | 9 | **21** | 0 | 0 |
| patagonia-2027 | 7 | 1 (minitrekking) | 11 | **19** | 0 (PLAN.md prose: minitrekking 8-65, Big Ice 18+) | 0 |
| chamonix-mont-blanc-2028 | 3 | 2 lifts | 9 | **14** | 0 | 0 |
| algonquin-muskoka-2026 | 2 | 0 | 4 | **6** | 0 | 0 |
| vermont-fall-2026 | 1 | 0 | 5 | **6** | 0 | 0 |
| **Total** | **75** | **23** | **109** | **207** | **95 (46%)** | **0 (0%)** |

Notes:
- "Any signal" means at least one of these exists in a structured field: distance and gain, a min age, a child note, an audience, or `child_6yo_ok`.
- **Nothing meets Usable today.** No value carries a per-value basis. No record has `stroller` in the new shape, or `carrier_ok`, `wheelchair`, `exposure` fencing or `access_season`. Every place in `data/locations/locations.json` has `accessibility: unknown`, and 54 of 64 have `kid_fit: unknown`.
- Trip-level `ageFit` (4 to 11) and `effort` exist for 8 trips in `publicTrips`. They are hand-typed and become derived (6.3).

### 7.2 Migration traps found while counting (S0 handles them)

| Trap | Where | Migration rule |
|---|---|---|
| A 50 lb **minimum** stored as `max_weight_kg: 22.7` | `legacy/canadian-rockies-sept-2029/data/adventures.json`, `kicking-horse-family-float` | migrate as `min_weight_kg` 22.7, with a note citing research adventure.md line 136, and `state: value` only after R2b re-reads the operator page |
| 40 lb is 18.1 kg, on the Kananaskis raft (`kananaskis-river-raft`, `max_weight_kg: 18.1`) | same file | the same check: is it a minimum? Migrate it as a `conflict` until R2b confirms |
| Horse-ride `max_weight_kg` 104 and 113 | `banff-horse-ride`, `lake-louise-horse` | `limit_reason: policy` |
| Trail `min_age` with conf `operator` but src `PLAN.md` (Sorapis 10, Lagazuoi 10, Cinque Torri 10, Tre Cime 6) | `web/data-snapshots/prototype.json` trails | `PLAN.md` is not an operator. Migrate as `age_band.from` with `our_inference`, never as `min_age` |
| Rockies `difficulty` easy, moderate, hard | `trails.json` | this is our word, not Parks Canada's ("Difficult"). Migrate to `kid_note` context only; `source_grade` stays a gap until R2a reads the official page |
| `child_6yo_ok` is party-specific | `adventures.json` | not migrated as a fact. It becomes a hint for R2b, which sets `age_band` |
| `audience` adult_only, family, both | `trails.json` | becomes `age_band` hints, `our_inference`, with a note "from the 2029 plan's tracks" |
| Pushchair sentences in `kid_notes` (Braies "steps on the east side"; Fiscalina "buggy walks listed") | prototype trails | copied to `kid_note` verbatim; `stroller` stays a gap for R1 to set (the migration never infers a new value) |

## 8. Enrichment plan (lanes for travel-researcher, Opus)

The lanes run after S0 merges. Web research may run in parallel across lanes. **No lane searches Wikimedia Commons.** These lanes need no photos. If one ever does, one searcher runs sequentially and no other lane runs Commons at the same time (repo rule, 429s on 12 Oct 2026).

### 8.1 Lanes

| Lane | Trip | Records | Writes (owns) | Sources, in order |
|---|---|---|---|---|
| **R1** | dolomites-2027 | 40 | `data/suitability/dolomites-2027/R1.json`, `research/trips/dolomites-july-2027/suitability.md` | CAI section pages and OSM `sac_scale` and `cai_scale` tags (ref numbers); valley boards (dreizinnen.com, cortina.dolomiti.org, val-gardena.net, altabadia.org) and south-tirol.com; Provincia di Bolzano open data; operators (Funbob Monte Baranci, the Rienza rafting operator, the Lagazuoi cable car) for limits, lift child rules and stroller-on-cabin rules; Drava path: drauradweg.com or the Osttirol and Kärnten boards, and ÖBB for bikes on the train back; dated community reports for stroller, shade and signal only |
| **R2a** | canadian-rockies-2029 trails and sights | 61 | `data/suitability/canadian-rockies-2029/R2a.json`, `research/trips/canadian-rockies-sept-2029/suitability-trails.md` | Parks Canada trail pages, trail conditions and accessibility pages (Banff, Jasper, Yoho, Kootenay); Alberta Parks and Kananaskis trail pages; Parks Canada open data GPX for distance and gain; Roam and the Parks Canada shuttles for stroller-on-bus rules; community for shade and signal |
| **R2b** | canadian-rockies-2029 activities and lifts | 15 (and their offers) | `data/suitability/canadian-rockies-2029/R2b.json`, `research/trips/canadian-rockies-sept-2029/suitability-activities.md` | operator product pages, terms and waivers (Pursuit and the Banff Jasper Collection, Kicking Horse rafting, Lake Minnewanka cruise, canoe rentals, horse outfitters, Mt Norquay via ferrata); the land manager's licence pages; **never resellers for limits** |
| **R3** | patagonia-2027 | 19 | `data/suitability/patagonia-2027/R3.json`, `research/trips/patagonia-feb-mar-2027/suitability.md` | Parques Nacionales (argentina.gob.ar: Los Glaciares, Tierra del Fuego) with APN trail grades; operators (Hielo y Aventura for minitrekking 8-65 and Big Ice; Piratour for the penguin walk's minimum age, a known GAP; the Beagle Channel boats); El Chalten tourism. Operator sites return menus to the fetcher (trap): try their PDFs and terms pages, and record `searched_none` with what was tried |
| **R4** | iceland-ring-road-2027 | 25 | `data/suitability/iceland-ring-road-2027/R4.json`, `research/trips/iceland-ring-road/suitability.md` | Vatnajokull NP (Skaftafell, Svartifoss), Thingvellir NP, Umhverfisstofnun (Fjadrargljufur access rules), Snaefellsjokull NP (Arnarstapi-Hellnar, Djupalonssandur: sneaker waves are a `water_safety` and `exposure` item), Myvatn Nature Baths (age and child rules), Safetravel for hazards, road.is for access season |
| **R5** | utah-five-parks | 21 | `data/suitability/utah-five-parks/R5.json`, `research/trips/usa-southwest-rockies/suitability.md` | NPS pages for Zion, Bryce Canyon, Capitol Reef, Arches and Canyonlands, including their accessibility pages (Pa'rus and Riverside Walk are the step-free and stroller test cases); the Angels Landing permit rules (`official_rule`); the Narrows flow and closure rules (`water_safety`, `access_season`); BLM for Lower Calf Creek Falls; NPS park words are `nps` grades |
| **R6** | chamonix-mont-blanc-2028, algonquin-muskoka-2026, vermont-fall-2026 | 26 | `data/suitability/<trip>/R6.json` (three files), `research/trips/<folder>/suitability.md` (three) | Compagnie du Mont-Blanc (lift child rules, stroller on cabins, closing dates), Chamonix tourist office and OHM; Ontario Parks and Algonquin trail guides; Vermont FPR and Vermont Trailfinder; state and town pages for town access |
| R7 (deferred) | the six overview trips | after L3d | | |

Each lane brief, copied into the researcher's prompt:
- **Goal**: every record in your trip's scope reaches Usable on the F checks (section 4), or records why it cannot.
- **Inputs**: this page; [kinds/](kinds/) for the kind; S0's `data/suitability/<trip>/migrated.json` (start from it and do not re-type migrated values without re-reading the source); the trip's research folder.
- **Must not touch**: anything outside the lane's files. That includes `prototype/`, `web/`, `core/`, `legacy/`, `data/catalog/`, `data/schedules/`, `data/locations/`, and any other lane's files.
- **Output format**: `suitability/1` (5.1). One record per in-scope ref, including records that end up mostly `searched_none`. The research markdown holds the per-record notes and an end table: "Record: Usable · F 9 of 11; missing F5 carrier, F12 access season".
- **Acceptance checks** (the lane fails if any fails):
  1. `node core/bin/suitability.ts check --root .` passes with zero errors on the lane's files.
  2. Every in-scope ref for the trip appears exactly once across the trip's files (`check --coverage <trip>` lists none missing).
  3. No hard limit has a basis other than `operator_rule` or `official_rule`. No source host is on the link-only list.
  4. Every `searched_none` has `on` and at least two `tried` entries, one of them the operator's or the land manager's own page.
  5. Every trail with distance or gain cites `official_info`, an operator, or a track plus a DEM. AllTrails appears only as a cross-check link in the markdown.
  6. Every unit conversion has a note. Every weight says minimum or maximum.
  7. At least 80% of records reach Usable on the F checks. The rest are listed with the operator contact to ask (phone or email from the operator's own page).
  8. The final report gives the count by level and the list of operator questions.

### 8.2 Order and collisions

```
S0 schema+validator+migration ──► R1 R2a R2b R3 R4 R5 R6 (parallel web research, no Commons)
                                        │
L4b trail tracks (parallel) ────────────┤  writes prototype trails and data/catalog/trails/geo, never data/suitability
L3c timeline (parallel) ────────────────┤  owns core/src/schedule, data/schedules
                                        ▼
                    S1 adapter + Who it suits + filters + F checks in the badge (after L3c and L4b merge)
```

- **L4b and suitability.** L4b's tracks give `gain_m` and `loss_m` from geometry and a DEM. After L4b merges, `suitability.ts derive --from-tracks` (S0 provides it, off by default) adds those as `our_inference` conflicts or values. They never overwrite an official figure. L4b promoting Rockies trails to pages does not break `legacy/...` refs.
- **L3c.** The type alias in 6.1 is the only shared line.
- **L3b** (trip tags) reads S1's derived fields, so L3b's suitability tags wait for S1. Its other tags do not.

## 9. Build brief S0: schema, validator, migration (travel-builder, Sonnet)

**Goal.** Make `suitability/1` a validated, generated, documented data family. Migrate the existing child and access fields into it without inventing anything. Provide the derive and projection functions that L3c and S1 consume. This lane has no UI.

**Files you own**
- `core/src/schema/suitability.ts` (new): the Zod schema of section 1 and 5.1, registered as a document kind `suitability` in `core/src/schema/index.ts` (`DOCUMENT_TABLES`) and `core/src/validate/documents.ts`
- `core/src/schema/difficultyMap.ts` and `data/schema/difficulty-map.json`: v2. It adds `cai`, `schall`, `huesler`, `cai-ferrata`, `osm-ferrata`, `imba`, `sts`, `trailforks`, `whistler`, `bike-path`, `whitewater`, `flatwater`, `piste-eu`, `piste-at-ch`, `piste-na`, `piste-jp` and the mode factors (`walk` 1, `ride` 0.25), each mapping with a `source` URL and `read` date. `schema_version` allows 2, and v1 still validates.
- `core/src/schema/enums.ts`: add `SUIT_BASIS`, `SUIT_STATE`, `GRADE_SYSTEM`, `STROLLER`, `WHEELCHAIR`, `LIMIT_REASON` (append only)
- `core/src/suitability/` (new): `derive.ts` (terrain, band, family_effort, the flat projection, `kid_fit`), `project.ts` (`projectForSchedule`, `ScheduleSuitability`, 6.1), `gates.ts` (the 6.2 table as data plus `fits(record, profile)`), `refs.ts` (resolves the 5.2 refs against the legacy data, the prototype snapshot and the trip categories), `migrate.ts`
- `core/src/validate/suitability.ts` (new) and the codes in `core/src/validate/codes.ts` and `messages.ts` (append)
- `core/bin/suitability.ts` (new): `check [--coverage <trip>]`, `derive`, `migrate --write`, `derive --from-tracks` (off by default)
- `core/test/suitability/**`, `core/test/fixtures/suitability/**`
- `data/suitability/README.md`, `data/suitability/<trip>/migrated.json` (8 trips)
- `data/schema/generated/*` (regenerated, never hand-edited)
- `docs/v2/research/kinds/*.md`: only the one-line F-check note and the recomputed totals (section 4)

**Must not touch.** `core/src/schedule/**`, `data/schedules/**` (L3c); `prototype/src/data/trails.ts`, `data/catalog/trails/geo/**` (L4b); `web/**` (S1 does the adapter); `legacy/**` (read only); `data/locations/locations.json` (the projection there waits for S1); `docs/v2/features/trip-timeline.md` (its owner applies 6.1 and 6.2).

**Steps**
1. Write the schema (section 1, the `Val` wrapper as a generic Zod factory, strict objects). Write the per-kind `ext` blocks (2.1 to 2.7) as a discriminated union on `kind`.
2. Extend difficulty-map to v2 with the section 2 tables. Every mapping row carries `source` and `read`. Write a test that maps every grade in the tables of this page.
3. Write the validator codes. Errors: `E_SUIT_SCHEMA`, `E_SUIT_REF`, `E_SUIT_DUP_REF` (a ref in two files), `E_SUIT_SRC` (unknown source id), `E_SUIT_SRC_READ` (source without a read date), `E_SUIT_LINK_ONLY_SRC` (alltrails, komoot, gaia, outdooractive, wikiloc, trailforks for facts, google, tripadvisor, booking hosts), `E_SUIT_LIMIT_BASIS`, `E_SUIT_SEARCHED_NONE` (no `on` or `tried`), `E_SUIT_UNIT` (lb, in, ft or mi in a quote with no note), `E_SUIT_RANGE` (min > max), `E_SUIT_GRADE` (value not in the system), `E_SUIT_TYPED_EFFORT` (`family_effort` present in a file; it is derived), `E_SUIT_STEP_FREE` (`step_free` without `official_info`). Warnings: `W_SUIT_STALE`, `W_SUIT_CONFLICT`, `W_SUIT_COMMUNITY_ONLY`, `W_SUIT_MARGINAL_CONVERSION`. Messages follow the house style in `messages.ts`: what is wrong, then an example fix.
4. Write `derive` and `project`. Unit tests cover:
   - Larch Valley: band 3 from 18.7;
   - Lake Agnes: both official figures, as a conflict;
   - Via Ferrata Loen: age `advice`, weight `hard`, `ruleByField`;
   - Kicking Horse: `min_weight_kg` 22.7;
   - Funbob: height `searched_none`, which gives `unknown` in `fits`;
   - Braies: `stroller` `smooth` + `part`, which gives `partly`;
   - Drava: ride factor;
   - a Class II raft: terrain 3.
5. Write `gates.ts` from 6.2, with tests for every row, the relaxed shift, and both gates (a flat 14 km FE3 fails a 6-year-old on the ceiling, not the cap).
6. Write `migrate`. The sources are the Rockies `trails.json`, `sights.json` and `adventures.json`, the prototype snapshot trails and places, and `locations.json` (`kid_fit`, `stats`). Follow the 7.2 rules exactly. Every migrated value gets `src` pointing to its original file (`kind: computed`, `publisher: "this repo"`, with the file's `read` or `checked` date). It is labelled `basis: our_inference` unless the original row names an official or operator URL for that very field. Write `data/suitability/<trip>/migrated.json`. Print a per-trip report that matches section 7.1's "any signal" counts (fail loudly if it does not).
7. Recompute the kind profile totals with the F checks and add the one-line note to each kind file.
8. Add `node core/bin/suitability.ts check --root .` to `tools/check-all.sh`, after "validate every data file". Regenerate `data/schema/generated/`.
9. Write `data/suitability/README.md`: the format, refs, value states, basis meanings, one full example per family (trail, activity with offers, lake with water safety), and the lane acceptance checks.

**Acceptance checks**
- `pnpm --dir core typecheck` and `pnpm --dir core test` pass, and the new tests cover every validator code with one failing fixture each.
- `node core/bin/schema.ts generate --check --root .` passes. `bash tools/check-all.sh` passes end to end.
- `migrate` finds 207 in-scope refs, all resolved, and writes 8 files. Its "any signal" counts are 19, 76, 0, 0, 0, 0, 0, 0. The Kicking Horse minimum weight is fixed. No trail `min_age` is migrated as a rule.
- `projectForSchedule` output type-checks against a copy of the trip-timeline.md 3.11 interface (a structural type test).
- No file outside "Files you own" is changed (`git diff --name-only` against the base).

**Verification.** `tsc` and the tests as above. This lane has no UI, so there are no Playwright screenshots. S1 carries the 1440 and 390 light and dark screenshots of "Who it suits" and the filters.

**Commit rules.** Logical commits: schema and map; validator; derive, project and gates; migration and data; docs. Stage only your paths with `git -C /home/nitin27may/workspace/travel-wt/v2 add <paths>`, never `-A`. End each message with the project's Co-Authored-By trailer. Rebase onto the branch head before reporting. Run `travel-verifier` before you report done.

### 9.1 S1 in one paragraph (brief to be written after L3c and L4b merge)

- Add `web/lib/public/suitability.ts`. It joins `data/suitability/**` onto `PublicPlace` and `CategoryItem` as `suitability: PublicSuitability | null`.
- Feed `projectForSchedule` into the timeline's adapter.
- Add the F checks to `completeness.ts`.
- Build "Who it suits" (Fable designs it first) and the Places filters (Kids, Effort, Stroller, Carrier OK, Step-free, Flatwater only).
- Derive the trip tags of 6.3 for L3b.
- Write the projected flat columns back to `locations.json` through `locations.py edit`.
- Verification includes Playwright screenshots at 1440 and 390, light and dark, then the design review and the verifier.

## 10. Open questions for the owner

1. **Limited capacity as a profile input.** In v1, wheelchair and limited-capacity data are chips and a Places filter only. Should the trip profile get an "access needs" control now (step-free only, short walks only), or later?
2. **Teen cap.** Is FE5 terrain (harness, serious exposure) advice-only for ages 13 to 15, and allowed outright only from 16? This is stricter than the timeline's 13+.
3. **Asking operators.** Many limits will end as "not stated by the operator". Will you send the operator questions each lane drafts? Researchers cannot email or phone. An answer recorded as `operator_rule` with `method: email` closes F1.
4. **Rockies breadth.** Should we enrich only the 15 activities and 33 trails on the plan's days, or all 43 adventures and 62 trails in the data files (another 28 and 29 records)?
5. **Overview trips.** Norway, Switzerland, Costa Rica, Quebec, Niagara and New Hampshire are out until L3d gives them days. Do you want Norway's known hard limits (Via Ferrata Loen, 40-120 kg) captured now anyway?

## 11. Gotchas

- A minimum stored as a maximum passes every type check. Only the `limit` direction note and a person catch it.
- "Family" products are not "any age": the Kicking Horse family float has a weight minimum a small child fails.
- The grade of a river changes with the water level, and the class of a trail changes with snow. Store the condition the grade assumes in `note`.
- Piste and MTB colours are resort-relative. A Whistler black is harder than most blacks, and the operator says so. Show the chip.
- An accessible entrance with a single step is `partial`, not `step_free`.
- A stroller that suits the first 1.2 km is not a stroller trail. `stroller_extent` exists so the card can say so.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First draft: shared model, per-kind scales with sources, F checks, sidecar storage, scope counts (207 records, 46% with any signal, 0% Usable), lanes R1-R6, S0 brief, tuned age gates (superset of trip-timeline.md 3.11) |
