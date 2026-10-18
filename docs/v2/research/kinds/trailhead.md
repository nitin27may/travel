# Kind profile: trailhead (and shuttle stop, meeting point)

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method: [../lanes/trails.md](../lanes/trails.md)
section 4.

## 1. What it is

The point where walking starts. Stored as `entity.kind = place`, subkind `trailhead`. Produced by the
**trails** lane. A trailhead may start several trails (`trailhead_of`, one row per trail) and be served
by several parking lots (`parks_for`) and shuttle stops (`serves`).

The same profile, with the access fields only, covers `shuttle_stop` (a bus or shuttle stop that
serves a trailhead or sight) and `meeting_point` (where an activity's operator meets you;
`starts_at` from the activity).

Separate entities: the [parking](parking.md) lot (even when it is 20 m away: it has its own
capacity, fee and fill time), the trails, a hut at the trailhead ([hut](hut.md)), a lift station
([lift](lift.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `name` | as signed on the ground | `Lake Louise Lakeshore trailhead` | the name on the signpost you look for |
| `point` | WGS84, 5 decimals, where walking starts | `[-116.21660, 51.41660]` | the navigation target when there is no lot |
| `point_source` | README section 5 | `osm_node:123456` | |
| `attrs.access_mode` | `car`, `shuttle_only`, `transit`, `boat`, `walk_in` | `shuttle_only` | whether the car is any use |
| `attrs.access_road` | road name and type `paved`, `gravel`, `4wd`, `seasonal` | `SR48 (paved)` | rental cars on gravel; camper vans on narrow roads |
| `attrs.access_road_season` | season structure with gate times | `06-01..10-15 open, gate 07:00-21:00` | a road that opens mid-June |
| `attrs.elevation_m` | metres | `1809` | snow at the start; the climb that follows |
| `attrs.facilities` | `toilets` (`flush`, `pit`, `none`, `seasonal`), `water`, `bins`, `info_board`, `bear_lockers`, `picnic` | `{toilets: "pit"}` | the last toilet before four hours on the trail |
| `attrs.cell_coverage` | `good`, `patchy`, `none`, `unknown` | `none` | meeting up, calling the shuttle, the emergency plan |

Shuttle stop adds: `attrs.lines` (operator and line numbers), relation to the shuttle `offer`
(timetable, fare, booking), `attrs.first_arrival` and `attrs.last_departure` per season (from the
timetable, local time). Meeting point adds: `attrs.check_in_min` (how early the operator wants you).

## 3. Location

The trailhead **is** an access point, so subject and access coincide. Source order: OSM within 2 km of
the trail (`highway=trailhead`; a guidepost `tourism=information` + `information=guidepost`; the
path's first node at the car park) → the agency's map or data → `gps` from a person's track →
`manual_pin`. Not a mountain pass node, not a village centre, not the hut's centroid, not a Google
pin. Navigation buttons point here only when no parking lot is related (README section 5).

## 4. Link checklist

| Kind | Required? |
|---|---|
| `official` (the park or valley page that names the trailhead) | checklist |
| `osm` | checklist |
| `timetable` (shuttle stop) | required when `access_mode` is `shuttle_only` or `transit` |
| `booking` (shuttle seat) | required when the shuttle needs a reservation |
| `webcam` | checklist |
| `navigation` | generated |

## 5. Where to research, in order

1. Land manager's trail or area page (Parks Canada, NPS, CAI or the valley board) for the name and the
   access mode.
2. OSM for the point, the access road, toilets (`amenity=toilets` within 100 m).
3. Transport operator timetables (südtirolmobil, DolomitiBus, Parks Canada shuttle) for stops.
4. Recent trip reports for facilities and cell coverage (`community`).

## 6. People limits

None of its own. `facilities.toilets` and `accessibility` (step-free from the lot, `partial`, `none`)
feed the accessibility and family checks.

## 7. Time and money

`access_road_season`, gate hours, shuttle first arrival and last departure. Money sits on the parking
lot or shuttle `offer`. The Braies first bus arrives 06:29 on weekdays and 07:29 otherwise, so a 05:00
plan fails by bus (research/trips/dolomites-july-2027/transport.md, D2).

## 8. Never guess

The point (no lot centroid, no pass node, no Google pin); toilets "probably"; cell coverage; first and
last bus times without the current timetable and its day markers.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check |
|---|---|---|
| U3 | Usable | `attrs.access_mode` |
| U4 | Usable | `attrs.access_road` with type (or `not_applicable` for `walk_in`/`boat`) |
| U5 | Usable | at least one `trailhead_of` relation (or, for a shuttle stop, `serves`; for a meeting point, `starts_at`) |
| U6 | Usable, when `access_mode` is `car` | at least one `parks_for` parking, or `attrs.parking_note` "roadside" with evidence |
| U7 | Usable, when `shuttle_only` or `transit` | timetable link and `first_arrival` / `last_departure` for the season |
| C9 | Complete | `attrs.elevation_m` |
| C10 | Complete | `attrs.facilities` (toilets at least; SN ok) |
| C11 | Complete | `attrs.cell_coverage` (SN ok) |
| C12 | Complete, when the road is seasonal | `attrs.access_road_season` |

U1 (summary) may be one line. U2 season is the access season. C4 (photo) is `not_applicable`.
Totals: Draft 5, Usable 7, Complete 12; **24**.

## 10. Freshness

Point: never, unless reported moved. Access mode and road: 365 days. Road season and gates: 365 days.
Timetables: 180 days and before every trip. Facilities: 2 years. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Trailhead copied from a Google Maps address | Passo Tre Croci, Rifugio Auronzo, Bai de Dones (research/trips/dolomites-july-2027/trails.md sections 2-4) |
| The pass node is not the trailhead | OSM node 290420596 is the Passo Tre Croci saddle (read 18 Oct 2026) |
| Shuttle-only access, so no lot at the trailhead | Moraine Lake (lanes/trails.md section 4) |
| First bus too late for the plan | Braies 05:00 and Sorapis 05:30 starts (dolomites transport.md, summary point 2) |
| Last bus strands you | Santa Maddalena 21:42 lands in Bressanone at 22:21 with no onward bus (dolomites transport.md, D12) |

## 12. Worked example: Rifugio Auronzo trailhead (Tre Cime loop)

| Field | Value | Source |
|---|---|---|
| `name` | Rifugio Auronzo trailhead (paths 101 and 105) | dolomites trails.md, Tre Cime loop entry |
| `point` | pending: the path 101 start node beside the hut | OSM; the hut is way 186519265 at 46.61220, 12.29610 (read 18 Oct 2026), a reference, not the trailhead |
| `access_mode` | `car` (toll road) and `transit` (bus 444 from Dobbiaco, DolomitiBus shuttle from Misurina) | dolomites transport.md 2.2 |
| `access_road` | SP49 Misurina - Rifugio Auronzo toll road (paved), `access_road_season` with mandatory slot | dolomites transport.md section 1 |
| `first_arrival` / `last_departure` | bus 444: first 08:19, last 18:08 back to Dobbiaco (2026) | dolomites transport.md 2.2 |
| `elevation_m` | 2,320 | prototype trails.ts `tre-cime` |
| relations | `parks_for` from four lots, P1-P4 (parking.md example) | OSM |

Level: none yet. D4 fails until the start node is recorded, so `propose` would bounce the create with
`missing_draft_field`. Once the node is in, U3-U7 pass and a one-line summary (U1) and the access
season (U2) make it Usable. The fix is one Overpass query for the path 101 start node.
