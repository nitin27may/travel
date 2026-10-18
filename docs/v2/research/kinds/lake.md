# Kind profile: lake

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md).

## 1. What it is

A lake, tarn or reservoir people come to see, walk around, paddle on or swim in. Stored as
`entity.kind = place`, subkind `lake`. Produced by the **sights and viewpoints** lane. `entity.shape`
holds the water polygon (from OSM, with ODbL attribution); `point` is the place people stand to look,
not the polygon's centroid (section 3).

Separate entities: the [parking](parking.md) lot or park-and-ride; the shuttle stop
([trailhead](trailhead.md) profile); a lakeshore or loop trail longer than about 1 km
([trail](trail.md)); canoe or boat rental and cruises ([adventure](adventure.md)); a swimming beach on
the lake when it has its own facilities ([swim spot](swim-spot.md)); the lakeside tea house or hut.
A lake reached only by a hike of more than 1 km is the **payoff of a trail** and gets a lake entity
only when people also reach it another way or it needs its own facts (Lake Agnes has a tea house and
season; Sorapis is reached only on path 215).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `summary` | our words, 1-3 sentences | "Glacier-fed lake in the Valley of the Ten Peaks; the Rockpile viewpoint is the classic photograph." | why go |
| access | `parks_for` or `serves` relations, or `attrs.access_note` | "shuttle or commercial tour only" | how you get there at all |
| `attrs.walk_from_access` | `{m, min, gain_m, surface, stroller}` from the access point to `point` | `{m: 300, min: 5, gain_m: 10, surface: "paved", stroller: "yes"}` | carrying a 3-year-old |
| `duration_min`, `duration_max` | minutes on site | `90`, `240` | short stop or half day |
| `season` | access season (road, shuttle, ice-off) | `06-01..10-12 open, shuttle season (2026)` | shuttle-only lakes have no access outside it |
| `hours` | `always_open`, or the access hours (road closures, shuttle first and last) | Braies road: private cars barred 09:00-16:00, 1 Jul - 15 Sep | the plan's arrival time |
| `cost_band` and fee | free, or the access fee as an `offer` | shuttle adult 12.75 CAD (2026) | |
| `attrs.swimming` | `allowed`, `banned`, `unsafe`, `unknown`, with `water_temp_c` by month when a source gives it | `banned` | kids will want to swim |
| `attrs.shore_walk` | `{km, loop: bool, surface, stroller}` or relation to a trail | `{km: 3.7, loop: true, stroller: "no"}` | Braies east shore has rock-cut steps |
| `attrs.best_time` | light computed (`attrs.light`) plus crowd windows with source | "calm water at sunrise; boats moored before 08:00" | when to arrive |
| `attrs.viewpoint_bearing` | degrees the classic view faces | `150` | feeds the light computation |
| `attrs.facilities` | toilets, cafe, boat rental, picnic | `{toilets: "flush", cafe: true}` | |

Complete adds: `attrs.crowds` (peak and quiet hours with source), `attrs.photo_spot` (point and note),
`attrs.water_level_note` (near-dry by late summer), `attrs.drone_rules`, `attrs.kid_note`,
`eligibility.accessibility`, `attrs.boating` (rental, own boat allowed, motor ban), `attrs.ice_off`
for high lakes.

## 3. Location

| Point | What | Source |
|---|---|---|
| `point` | where people stand for the view (the Rockpile, the Braies boathouse jetty) | OSM `tourism=viewpoint` near the lake, else a `manual_pin` on the shore at the classic view; never the polygon centroid (it is in the water) |
| `shape` | water polygon | OSM `natural=water` way or relation |
| access | lot, park-and-ride, shuttle stop | separate entities, README section 5 |

Navigation goes to the access point. For a shuttle-only lake it goes to the park-and-ride.

## 4. Link checklist

`official` (land manager or tourism board), `conditions` (road, shuttle status), `booking` (when access
needs it), `timetable` (shuttle), `osm`, `wikidata`, `wikipedia`, `commons`, `webcam`, `trip_report`,
`video`; `navigation` generated.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Land manager (Parks Canada, Ontario Parks, the municipality or nature park) | access rules, season, swimming bans, boating rules |
| 2 | Transport operator and booking site (Parks Canada shuttle, braies.bz, südtirolmobil) | shuttle times, fares, booking windows |
| 3 | Official tourism board | facilities, hours of the cafe and boathouse |
| 4 | Wikidata, OSM | identity, polygon, viewpoint nodes, toilets |
| 5 | `core/src/sun` | light windows from the view point and bearing |
| 6 | Dated community reports, webcams | crowds, water level, ice-off |

## 6. People limits

Usually none. Check `walk_from_access` against pushchairs and mobility (`accessibility`), and
`swimming` plus `water_temp_c` against the kids' expectations. Paddling limits belong to the rental
activity.

## 7. Time and money

Access season and hours (road bans, shuttle first and last), the booking window of the access `offer`
(Moraine shuttle 2026: launch 15 Apr 08:00 MT for 40% of seats, the rest released 48 hours ahead),
fees with currency and read date, cafe and boathouse hours as their own eatery or activity.

## 8. Never guess

Swimming allowed; water temperature; the shuttle's 2027 dates (carry 2026 as `applies_to` 2026);
"best at sunrise" without a light computation or a dated source; capacity of the lakeside lot.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | access resolved: a `parks_for` or `serves` relation, or `attrs.access_note` with evidence | `official` |
| U4 | Usable | `attrs.walk_from_access` | `agent_inferred` from OSM paths allowed |
| U5 | Usable | `duration_min`, `duration_max` | `community` or `agent_inferred` allowed |
| U6 | Usable | `hours` (or `always_open`) including access restrictions | `official` |
| U7 | Usable | fee: `free` or an access `offer` with price, currency, read date | `official` or `operator` |
| U8 | Usable, when access needs a booking | the `offer` has `window_rule`, `window_spec.tz`, `sellout` | `official` |
| U9 | Usable | `attrs.swimming` (value, `none_stated`, or SN ok) | `official` for `banned` |
| C9 | Complete | `shape` from OSM with attribution | |
| C10 | Complete | `attrs.light` computed for the view point and bearing | `agent_inferred` |
| C11 | Complete | `attrs.crowds` with a dated source | `community` |
| C12 | Complete | `attrs.facilities` | |
| C13 | Complete | `attrs.shore_walk` or a `combo_with` trail, or `not_applicable` | |
| C14 | Complete | `attrs.photo_spot` | `community` |
| C15 | Complete | every related access entity is at least Usable | |

Totals: Draft 5, Usable 9, Complete 15; **29**.

## 10. Freshness

Access rules and booking windows: 365 days, and before the next window. Shuttle timetable and fares:
120 days. Road bans: 365 days. Swimming rules: 365 days. Light: recompute on any point change. Crowds:
2 years. Shape: never. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Shuttle-only lake, no private vehicles year-round | Moraine Lake (legacy/canadian-rockies-sept-2029/data/sights.json, `moraine-lake`) |
| Road closed to cars mid-day unless you hold a slot | Braies 1 Jul - 15 Sep, 09:00-16:00 (research/trips/dolomites-july-2027/transport.md 2.1) |
| Stored "map link" is a Google name search, no point | every entry in legacy/canadian-rockies-sept-2029/data/sights.json (`map_url`) |
| Lake near-dry by late summer | Lago di Landro (research/trips/dolomites-july-2027/sights.md, Landro entry) |
| Youth fare bands unverified | Moraine shuttle "GAP age bands not verified" (sights.json `moraine-lake`) |
| Famous lake that is no longer quiet; the quiet substitute | Sorapis versus Lago di Limides (dolomites sights.md hidden gems) |

## 12. Worked example: Moraine Lake

| Field | Value | Source |
|---|---|---|
| `point` | pending: the Rockpile viewpoint node; the water way is OSM way 356877446, centre 51.32168, -116.18490, ele 1,884 (read 18 Oct 2026) | OSM |
| `shape` | way 356877446 | OSM |
| access | `serves` from the Lake Louise Park and Ride shuttle stop; `access_note` "Moraine Lake Road is closed to personal vehicles" | Parks Canada (sights.json `moraine-lake`) |
| `season` | `06-01..10-12 open`, shuttle season, `applies_to` 2026 | same |
| access offer | Parks Canada shuttle: `fixed_date` launch 15 Apr 2026 08:00 America/Edmonton for 40% of seats, `fallback` the rest 48 hours ahead; adult 12.75, youth 4.00, plus 3.50 online fee, CAD 2026 | same |
| `shore_walk` | lakeshore 1.3 km one way; Rockpile 0.7 km loop | same |
| `duration` | 180 min (the legacy `time_needed_hours: 3`) | same, `community` |
| youth band ages | `gap` | same |

Until the Rockpile node is recorded, D4 fails and `propose` bounces the create, so the first job is
the point. With it: **Draft · 11 of 29** (D1-D5, U1, U2, U3, U5, U7, U8). Then U4 (walk from the
stop), U6 (shuttle first and last times) and U9 (swimming) make it Usable.
