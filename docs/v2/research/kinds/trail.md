# Kind profile: trail

Status: draft (18 Oct 2026). Follows the template in [README.md](README.md). The research method is
[../lanes/trails.md](../lanes/trails.md); this page is the checklist that says when a trail is Draft,
Usable or Complete.

## 1. What it is

A route a person chooses at a trailhead and walks (or bikes, paddles, snowshoes) to a payoff and back,
round, or through. Stored as `entity.kind = trail`, subkind `hike`, `walk`, `scramble`, `trek_stage`,
`snowshoe`, `bike`, `paddle`, `via_ferrata_approach`. Produced by the **trails** lane.

Separate entities, never folded into the trail:

| Thing | Stored as | Relation |
|---|---|---|
| where walking starts | [trailhead](trailhead.md) | `trailhead_of` (trailhead → trail) |
| where you leave the car | [parking](parking.md) | `parks_for` (parking → trailhead) |
| the bus or shuttle | trailhead profile, subkind `shuttle_stop` | `serves` (stop → trailhead) |
| the hut or tea house on the way | [hut](hut.md) or [eatery](eatery.md) | `combo_with`, plus `attrs.hut_or_teahouse` |
| the lake or viewpoint it reaches, when it is also visited by other means | [lake](lake.md), [viewpoint](viewpoint.md) | `combo_with` |
| a via ferrata (harness, lanyards) | [adventure](adventure.md) | the approach is a trail, the ferrata an activity |
| a lift that shortens it | [lift](lift.md) | `serves` (lift → trailhead at the top station) |
| a permit or parking reservation | `offer` kind `permit` or `shuttle` | on the parking or trailhead |

**Splitting rule** (lanes/trails.md section 9): one entity per route a person chooses at the
trailhead. A shorter turnaround on the same path is a `turnaround_points` entry (Mirror Lake before
Lake Agnes); a different destination from the same trailhead is a separate trail (Lake Agnes versus
Plain of Six Glaciers); a loop and its out-and-back version are two trails when the loop adds terrain
the out-and-back does not (Sorapis 215 out-and-back versus the 215/216/213 circuit).

## 2. Required fields

Core fields (README section 3) apply. `point` is the **payoff** (the lake, the pass, the summit view),
not the trailhead.

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| trailhead | relation `trailhead_of` from a trailhead entity | Lake Louise Lakeshore trailhead | where the day starts, and what you navigate to |
| `attrs.shape` | `out_and_back`, `loop`, `lollipop`, `point_to_point`, `network` | `out_and_back` | point-to-point needs a car shuttle or a bus back |
| `attrs.distance_km` | km, one decimal; round trip for out-and-back, total for loops, one way for point-to-point | `7.4` | the party's walking ceiling (the Norway plan's 12 km cut routes) |
| `attrs.gain_m` | metres of total ascent | `385` | effort, more than distance, decides whether a 6-year-old finishes |
| `attrs.time_h` | `[min, max]` hours moving time for an average adult | `[2.5, 3.5]` | fits the day, the lift's last descent, the shuttle's last bus |
| `attrs.local_grade`, `attrs.local_system` | as written by the land manager; system `parks-canada`, `sac`, `cai`, `nps`, `yds`, `sepaq`, `apn`, `dnt`, `uk`, `other` | `Moderate`, `parks-canada` | the official word, quoted on the card |
| `attrs.house_grade`, `attrs.house_basis` | 1-5 from `vocab://difficulty`; `technical`, `effort`, `effort-only` | `2`, `technical` | one scale across countries |
| `season` | season structure; `attrs.snow_free` `{from, to, confidence}` for mountain trails | `06-15..10-10 open` | snow on cabled ledges in late June |
| `eligibility.stroller`, `carrier_ok`, `min_age_guidance`, `fitness` | section 6 | `no`, `true`, `5`, `2` | who comes |
| `attrs.dogs` | `allowed_leash`, `allowed_off_leash`, `banned`, `unknown` | `allowed_leash` | |
| `attrs.restrictions` | list: `group_min` (with dates), `permit_required`, `quota`, `bikes`, `drones`; or `none_stated` | `[{kind: "group_min", n: 4, season: "07-15..10-15"}]` | Parks Canada group-of-four rules decide whether a family of three may go |
| `attrs.hazards` | list `{kind, note, season}`: `bears`, `avalanche`, `rockfall`, `heat`, `lightning`, `cliff_edges_unfenced`, `river`, `tides`, `wildfire_area`, ...; or `none_stated` | `[{kind: "lightning", note: "off the loop by 14:00 in July"}]` | what to carry and when to turn back |
| `attrs.payoff` | our words: what you see and where exactly | "the view is 0.4 mi beyond the forested summit" | the Mt. Pisgah lesson |

Complete adds: `attrs.loss_m`, `attrs.high_point_m`, `attrs.surface`, `attrs.exposure`,
`attrs.scrambling`, `attrs.navigation`, `attrs.water_sources`, `attrs.shade`,
`attrs.turnaround_points`, `alternative_to` (family or Plan B option), `attrs.light`, `attrs.crowds`,
a `track` row. Definitions and units are in lanes/trails.md section 6.

## 3. Location

| Point | What | Source order |
|---|---|---|
| subject (`entity.point`) | the payoff | OSM (`natural=peak`, `tourism=viewpoint`, the lake's way, the hut) → agency map → manual pin |
| trailhead | where walking starts | OSM within 2 km: `highway=trailhead`, a guidepost (`tourism=information` + `information=guidepost`), the path's first node at the car park → agency data → manual pin |
| parking | the lot entrance | OSM `amenity=parking` near the trailhead → agency map → manual pin |
| track | the route line | OSM relation (`route=hiking`, CAI `ref`) or agency GPX/GeoJSON; `track.source` and `licence` set |

The navigation buttons go to the parking lot (README section 5), not to the payoff. Never use a
mountain pass node as the trailhead: `Passo Tre Croci - Son Zuógo` is OSM node 290420596, a
`mountain_pass` saddle at 1,809 m (read 18 Oct 2026); the path 215 start and the lots sit beside it and
need their own points.

## 4. Link checklist

From lanes/trails.md section 3. Each kind is filled or `searched_none` with date and query (C3).

| Kind | Required? | Rule |
|---|---|---|
| `official` | required when one exists; a gap otherwise | the source for distance, gain, season, rules |
| `conditions` | required when one exists (U15) | read by the conditions check; never copied |
| `area_closures` | checklist | |
| `osm` | checklist | relation or way URL |
| `track_source` | required when a `track` exists | licence on the track |
| `gpx_download` | checklist | store the file only if the licence allows |
| `alltrails` | checklist, link only | `found_in_search` with date (the link checker is blocked) |
| `komoot`, `gaia`, `outdooractive`, `wikiloc` | checklist, link only | |
| `trip_report` | checklist | dated within two seasons |
| `webcam` | checklist | |
| `map_sheet` | checklist | swisstopo, NRCan, USGS, Tabacco (Dolomites) or the park map PDF |
| `video` | checklist | |
| `booking` | required when access needs a permit, shuttle or parking slot | also produces the `offer` |
| `navigation` | generated | to the parking lot and the trailhead |

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Land manager: Parks Canada trail page and trail conditions, NPS, Ontario Parks, Vermont FPR, CAI section or the valley board (dreizinnen.com, cortina.dolomiti.org), Parques Nacionales | distance, gain, grade, season, closures, restrictions, permits |
| 2 | Land manager open data (Parks Canada GPX, swisstopo) | geometry, official lengths |
| 3 | Official tourism boards | access, shuttles, parking where the park page is silent |
| 4 | OpenStreetMap | track, trailhead and parking points, `sac_scale`, surface, CAI `ref` numbers |
| 5 | Wikidata | identity and names |
| 6 | Recent trip reports, dated within two seasons | parking fill times, crowds, conditions, payoff reality; `community` only |
| 7 | AllTrails, Komoot, Gaia, Outdooractive, Wikiloc | links only, and only to check the official figure describes the same route |

## 6. People limits

Trails rarely have rules; they have **guidance**. Store `eligibility.min_age_guidance` as our
recommendation with the stats it rests on (`agent_inferred`), never as a rule. A land manager's real
rule (a group minimum, a dog ban, a permit age) goes in `attrs.restrictions` with `official` evidence.

Household check (README section 8): each traveller's age on the day against `min_age_guidance`
(`marginal` within a year), the party's walking ceiling (`trip.prefs.walk_limit`) against
`distance_km` and `gain_m`, fitness against `eligibility.fitness`, and `group_min` against the number
of people walking. A trail over the ceiling is a `check_trip` issue that names the
`turnaround_points` or the `alternative_to` trail.

## 7. Time and money

- **Season**: open, limited and closed periods; `snow_free` with confidence for anything above about
  1,800 m in the Alps or above treeline in the Rockies.
- **Daily time window**: the latest sensible start, from `time_h` and whichever ends first: last bus
  or shuttle, last lift down, sunset (from `core/src/sun`), an afternoon storm rule.
- **Money** sits on the access entities: parking fee, toll road, shuttle fare, permit. The trail itself
  is free unless a permit is per person (`offer` kind `permit`).
- **Booking windows** on the related `offer`: the Tre Cime toll road slot, the Moraine Lake shuttle
  (40% of seats at the launch, the rest 48 hours ahead).

## 8. Never guess

- distance, gain or time not stated by a source or computed by a documented method (lanes/trails.md
  section 7);
- a one-way figure presented as a round trip (double it and say so in the quote);
- group-size or permit rules from memory (the Larch Valley group-of-four was recorded as INFERENCE
  when the official page returned 404; that is right);
- parking capacity from satellite imagery;
- closure status older than 7 days for a plan within 14 days;
- a "summit" payoff without checking that the view exists.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8 (README section 10) plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `trailhead_of` relation from a trailhead that is at least Draft | |
| U4 | Usable | `attrs.shape` | any with a source |
| U5 | Usable | `attrs.distance_km` | `official`, `operator` (a club), or `agent_inferred` from a stored `track`; community alone fails |
| U6 | Usable | `attrs.gain_m` | as U5, track plus DEM allowed |
| U7 | Usable | `attrs.time_h` | `official`, or computed (lanes/trails.md section 7) and marked `agent_inferred` |
| U8 | Usable | `attrs.local_grade` with `local_system`, and `attrs.house_grade` | local grade `official`; house grade computed |
| U9 | Usable | access resolved: the trailhead has a `parks_for` parking, or `access_mode` is `shuttle_only`, `transit` or `walk_in` with a `serves` relation or an access note | |
| U10 | Usable | `eligibility.stroller`, `carrier_ok`, `min_age_guidance`, `fitness` | `agent_inferred` allowed, with the stats in the quote |
| U11 | Usable | `attrs.dogs` and `attrs.restrictions` (value or `none_stated`) | `official` |
| U12 | Usable | `attrs.hazards` (list or `none_stated`) | `official` or `community` |
| U13 | Usable | `attrs.payoff` | `community` allowed |
| U14 | Usable, when a permit, shuttle or parking slot is needed | an `offer` with `window_rule`, `window_spec.tz`, `sellout` | `official` or `operator` |
| U15 | Usable | `conditions` link filled or `searched_none` | |
| C9 | Complete | a `track` with `source`, `source_ref`, `licence` | |
| C10 | Complete | `attrs.loss_m`, `attrs.high_point_m` | as U5 |
| C11 | Complete | `attrs.surface`, `attrs.exposure`, `attrs.scrambling`, `attrs.navigation` | `official` or `community` |
| C12 | Complete | `attrs.water_sources`, `attrs.shade` | `community` allowed |
| C13 | Complete, when `high_point_m` is above 1,800 m or the season row says snow | `attrs.snow_free` with confidence | `official` or two dated `community` reports |
| C14 | Complete | `attrs.turnaround_points`, or `not_applicable` (no shorter version) | |
| C15 | Complete | at least one `alternative_to` (family or Plan B), or `not_applicable` | |
| C16 | Complete, when the payoff is a view | `attrs.light` computed with `core/src/sun` | `agent_inferred` |
| C17 | Complete | `attrs.crowds` with a dated source | `community` allowed |
| C18 | Complete | its trailhead and every related parking lot are at least Usable | |

Totals before conditional checks drop out: Draft 5, Usable 15, Complete 18; **38**. C4 (photo) applies.
C5 exempts U7 computed time, U10, U12 community hazards, U13, C12, C16 and C17.

## 10. Freshness

| Group | Re-check |
|---|---|
| distance, gain, loss, grade, shape | 3 years, or when a source changes |
| season, snow-free window | 365 days |
| closures, conditions | 7 days; the conditions check re-reads them before every trip |
| restrictions, permits, booking windows | 365 days, and before the next window opens |
| hazards, crowds, payoff | 2 years |
| links | 90 days (link checker) |
| track | never, unless a closure or reroute is reported |

## 11. Traps (from this repo's research)

| Trap | Where it happened |
|---|---|
| Forested summit, view 0.4 mi beyond | Mt. Pisgah, research/trips/vermont-fall-2026/trails.md |
| One-way figure read as round trip, and the reverse | Sorapis 215 is "5.6 km one-way, ~114 m gain to the lake" in one source and "11-12.6 km, 475-630 m" round trip in others (research/trips/dolomites-july-2027/trails.md sections 0.6 and 3); the gain figures cannot both be right, so it is a conflict, not a range to average |
| Conflicting official figures | Iceline 20.3 km/1,090 m versus 20.8 km/710 m; Stanley Glacier 4.9 km one way versus 8.4 km return (research/trips/canadian-rockies-sept-2029/trails-national.md) |
| Trailhead taken from a Google Maps address | "Trailhead: Passo Tre Croci (Google Maps: Passo Tre Croci, 32043 Cortina d'Ampezzo)" (dolomites trails.md section 3); the Rockies `trails.json` stores only `map_url` name searches such as `maps.google.com/?q=Moraine+Lake...`, no point at all |
| A lot that fills at 06:00-06:30 | Sorapis, Passo Tre Croci (dolomites trails.md section 0.6) |
| The dangerous return loop | Sorapis 216 descent: steep rubble, exposed ledge, no aids (dolomites trails.md 0.6) |
| Shuttle-only access | Moraine Lake Road closed to private vehicles (legacy/canadian-rockies-sept-2029/data/sights.json, `moraine-lake`) |
| Rule recorded as INFERENCE when the official page 404'd | Larch Valley group of four (legacy/canadian-rockies-sept-2029/data/trails.json, `larch-valley-sentinel-pass`) |
| Hiking ceiling cuts routes | Norway 12 km ceiling cut Ryten-Kvalvika and Vidden (repo CLAUDE.md, Norway entry) |
| A lift that closes before the trip | Fedare chairlift and Faloria cable car closed for the June window (dolomites trails.md section 0.2) |

## 12. Worked example: Lago di Sorapis by path 215

Data from research/trips/dolomites-july-2027/trails.md (read Aug 2026, 2026 figures) and
prototype/src/data/trails.ts (`sorapis`); OSM ids read 18 Oct 2026.

| Check | State | Why |
|---|---|---|
| D1-D5 | pass | name, `trail`/`hike`, `area_cortina`, sources; the payoff point is a `manual_pin` at Rifugio Vandelli until the lake's OSM way is recorded (the Overpass lookup failed with a server error on 18 Oct 2026: a gap, not a guess) |
| U1, U2 | pass | summary ours; season "snow-free from late June" (community) |
| U3 | **fail** | the trailhead is "Passo Tre Croci" from a Google Maps address; OSM node 290420596 is the pass, not the path start |
| U4 | pass | `out_and_back` (path 215) |
| U5, U6 | pass at Usable, conflict | OSM relation 3985745 (path 215) is 10.7 km per the prototype's Overpass read; gain conflict 114 m versus 460-630 m; no official page found, so the track plus DEM is the only rule-meeting source |
| U7 | pass | computed 4.5-6 h, `agent_inferred` |
| U8 | **fail** | CAI grade not recorded (the research says "Moderate" and "difficult" from blogs) |
| U9 | **fail** | parking not an entity; sources disagree: "free roadside on SR48 plus an overflow lot, no published capacity" versus "free gravel car park near the bridge, ~20 spaces" |
| U10, U12, U13 | pass | stroller no, guidance 10 with "ladders and cabled ledges" as the reason, fitness 3; hazards (exposure, July storms); payoff is the lake itself |
| U11 | **fail** | dogs and restrictions not recorded |
| U15 | **fail** | no conditions page recorded |
| C checks | mostly fail | no `point_checked`, no photo, links unresolved, conflicts open |

Result: **Draft · 14 of 37** (U14 does not apply: no permit or slot; C13 applies because the lake is
at 1,923 m; C16 applies). The missing list starts: U3 add the
path 215 start node and relate it; U8 read the CAI Cortina grade; U9 create the two lots with
`point_source` from OSM and record the capacity conflict; U11 dogs; U15 conditions page. That is the
next research job, and it is exactly what the plan was missing.

## 13. Prototype field mapping

prototype/src/data/trails.ts uses its own keys. The import maps them; the prototype is not edited from
here.

| Prototype key | Profile field |
|---|---|
| `distance_km` | `attrs.distance_km` |
| `elevation_gain_m`, `elevation_loss_m`, `max_elevation_m` | `attrs.gain_m`, `attrs.loss_m`, `attrs.high_point_m` |
| `duration_hours` (`"3.5-4.5"`) | `attrs.time_h` `[3.5, 4.5]` |
| `difficulty` (`easy`..`expert`) | `attrs.house_grade` 1-5 via `vocab://difficulty`; the local grade is a separate field the prototype lacks |
| `route_shape` (`out-and-back`) | `attrs.shape` (`out_and_back`) |
| `exposure` (3 values) | `attrs.exposure` (4 values: adds `serious`) |
| `water_toilets_huts` | split into `attrs.water_sources`, the trailhead's `facilities`, `attrs.hut_or_teahouse` |
| `min_age`, `kid_notes` | `eligibility.min_age_guidance`, `attrs.kid_note` |
| `dog_policy` | `attrs.dogs` |
| `season`, `best_time_of_day` | `season`, `attrs.light` and `attrs.crowds` |
| `th_*` | the trailhead entity |
| `pk_*` | the parking entity and its `offer` |
| `permit_*` | the `offer` (`window_rule`, `window_spec`) |
| `geometry_source`, `geometry_ids` | `track.source`, `track.source_ref` |
| `Conf` `inferred` | evidence `agent_inferred` |
