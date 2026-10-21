# Kind profile: beach, hot spring, swim spot

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md) (natural places),
[../lanes/relax-and-luxury.md](../lanes/relax-and-luxury.md) (ticketed pools) and
[../lanes/family-and-kids.md](../lanes/family-and-kids.md).

## 1. What it is

Anywhere a plan has people in the water: a sea or lake beach, a river swimming hole, a natural hot
spring, a ticketed hot pool or thermal bath. Two storage forms:

| Form | Stored as | Example |
|---|---|---|
| natural, free or with a parking fee | `place` / `beach`, `swim_spot`, `hot_spring` | Dwight Beach on Lake of Bays |
| built, ticketed, with hours | `activity` / `hot_spring`, `thermal_bath`, plus a ticket `offer` | Banff Upper Hot Springs |

"Swimming" is in the family intent notes as a must ("waterfalls, lookouts, caves, swimming, splash
pads"), and the facts that matter are safety and water, not scenery.

Separate entities: the lake it is on ([lake](lake.md)); [parking](parking.md); boat, SUP or kayak rental
([adventure](adventure.md)); the café ([eatery](eatery.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `attrs.water` | `sea`, `lake`, `river`, `thermal`, `pool` | `thermal` | |
| `attrs.swimming` | `allowed`, `banned`, `unsafe`, `seasonal`, with the authority | `allowed` | |
| `attrs.supervision` | `lifeguard` (with season and hours), `none` | `none` | small children |
| `attrs.water_temp_c` | by month `{month: °C}` with source; for pools the set temperature | `{"09": 39}` | a September lake is 15 °C |
| `attrs.entry` | `sand`, `pebbles`, `rocks`, `steps`, `ladder`, `drop_off`, with depth note | `sand, shallow for 20 m` | toddlers |
| `attrs.hazards` | `currents`, `tides`, `cold_shock`, `algae`, `boats`, `jellyfish`, `rip`, `rocks`, with season | `[{kind: "algae", note: "check the advisory in August"}]` | |
| `attrs.water_quality` | status source (beach postings, EU bathing water, public health) and how often it is posted | "the local public health unit's beach postings, weekly in summer" | closures after rain |
| access | `parks_for` with walk minutes, or access note | | |
| `hours` / `season` | for ticketed pools: opening hours with last entry; for beaches: lifeguard season | daily 13:00-22:00, last entry 21:30 | |
| fee | `free`, parking fee, or a ticket `offer` with bands | adult 19.75 CAD, youth 3-17 17.25, under 3 free (2026) | |
| `attrs.facilities` | toilets, changing rooms, showers, lockers, towel and swimsuit rental | `{lockers: true, rental: ["towel", "swimsuit"]}` | |

Complete adds: `attrs.shade`, `attrs.crowds`, `attrs.dogs`, `attrs.light` (sunset beaches, computed),
`eligibility` (minimum age for adult pools, under-N must be accompanied), `attrs.maintenance_closures`
(pattern), `attrs.dress_rules` (swimwear only, no street shorts), `eligibility.accessibility` (pool
lift, beach mat).

## 3. Location

`point` is the water entry (the beach centre, the pool building entrance), from OSM
(`natural=beach`, `leisure=swimming_area`, `natural=hot_spring`, `leisure=sports_centre` +
`sport=swimming`) → official map → `manual_pin`. Access is separate.

## 4. Link checklist

`official`, `hours_rates`, `booking` (timed entry), `conditions` (water quality postings, advisories),
`status` (live crowd or closure), `tourism_board`, `osm`, `wikidata`, `commons`, `webcam`,
`trip_report`; `navigation` generated.

## 5. Where to research, in order

1. Operator or land manager (Parks Canada runs the Banff Upper Hot Springs; municipal beaches).
2. Public health or environment agency for water quality (beach postings, EU bathing water directive
   data, state advisories).
3. Official tourism board.
4. OSM for points, facilities, `supervised` tag (hint).
5. Dated community reports for water temperature, crowds, what the entry is like.

## 6. People limits

`supervision` and `entry` against the youngest swimmer; minimum ages for adult-only pools or hours;
"under 8 must be accompanied" rules; swimming ability where stated. Results go to `check_trip`.

## 7. Time and money

Pools: hours by season with last entry, maintenance closures, ticket bands with ages and read year,
timed entry windows. Beaches: lifeguard season and hours, parking fee and fill time.

## 8. Never guess

That swimming is allowed; water temperature; lifeguard presence; that a pool is open (renovation
closures last months); child age bands.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.water` and `attrs.swimming` | `official` for `banned` and `unsafe` |
| U4 | Usable | `attrs.supervision` | `official` or `operator` |
| U5 | Usable | access resolved | |
| U6 | Usable | fee: `free`, parking fee, or ticket `offer` with bands, currency, read date | `operator` or `official` |
| U7 | Usable, ticketed | `hours` with `last_entry` | `operator` |
| U8 | Usable | `attrs.entry` | `community` allowed |
| U9 | Usable | `attrs.hazards` (or `none_stated`) | `official` or `community` |
| C9 | Complete | `attrs.water_temp_c` for the trip-type months (SN ok) | `official` or dated `community` |
| C10 | Complete | `attrs.water_quality` source, or `not_applicable` (pools) | `official` |
| C11 | Complete | `attrs.facilities` | |
| C12 | Complete | `eligibility` rules (or `none_stated`) | `operator` |
| C13 | Complete | `attrs.shade`, `attrs.crowds` | `community` |
| C14 | Complete, ticketed | `attrs.maintenance_closures` pattern (SN ok) | `operator` |

Totals: ticketed pool Draft 5, Usable 14, Complete 18 (**37**); natural spot **35** (U7 and C14 drop
out).

Family checks F1-F12 from [suitability.md](../suitability.md) section 4 apply as marked in its swim spot column: F3, F4, F9 (toilets), F11 and F12 are Usable; F1, F2, F6 and F8 are Complete. They are counted like any other check and are in the totals above.


## 10. Freshness

Hours and prices: 180 and 120 days. Swimming rules and supervision: 365 days. Water quality: the
posting interval, re-read by the conditions check before a trip. Water temperature: 2 years (a
pattern). Facilities: 2 years.

## 11. Traps

| Trap | Where |
|---|---|
| A pool closed for seven months for renovation | Banff Upper Hot Springs closed Sep 2025 - Apr 2026 (research/trips/canadian-rockies-sept-2029/adventure.md line 214; bookings.md line 92) |
| Hot springs closed for maintenance weeks | lanes/relax-and-luxury.md section 9 |
| Swimming banned at a famous lake | check per lake; never inherit from a neighbouring lake |
| A sunset beach chosen without computing the light | compute with `core/src/sun` before calling a beach a sunset stop (the Algonquin plan's Dwight Beach sunset, repo CLAUDE.md) |

## 12. Worked example: Banff Upper Hot Springs

| Field | Value | Evidence |
|---|---|---|
| stored as | `activity` / `hot_spring`, operator Parks Canada | adventure.md line 213 |
| `season` | year-round; `closures`: Sep 2025 - Apr 2026 renovation | same, and bookings.md line 92 |
| `hours` | daily 13:00-22:00, last entry 21:30 (2026) | same, `official` |
| ticket | adult 19.75 CAD, youth 3-17 17.25, under 3 free (2026) | parks.canada.ca fees page |
| booking | walk-up; busy afternoons | `community` |
| `swimming`, `supervision`, `entry`, `hazards`, `facilities`, `point` | gaps (the research recorded hours and prices only) | |

Level once the point is recorded: **Draft · 9 of 37** (D1-D5, U1, U2, U6, U7). Missing for Usable:
U3 water type and rules, U4 supervision, U5 access and parking, U8 entry, U9 hazards.
