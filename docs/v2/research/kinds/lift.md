# Kind profile: lift, cable car, scenic train

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/adventure.md](../lanes/adventure.md) (as an activity),
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md) (what it reaches) and
[../lanes/relax-and-luxury.md](../lanes/relax-and-luxury.md) (scenic trains).

## 1. What it is

A gondola, cable car, chairlift, funicular, rack railway or scenic train people ride for the view or
to start a walk. Stored as `entity.kind = activity`, subkind `gondola`, `cable_car`, `chairlift`,
`funicular`, `rack_railway`, `scenic_train`, with ticket `offer`s. In the Alps the lift calendar
decides which days work: the Dolomites June plan was moved because the Fedare chairlift and the
Faloria cable car were closed for the whole window (research/trips/dolomites-july-2027/trails.md
section 0.2).

One entity per lift line a person buys a ticket for. A two-stage line sold as one ticket
(Ortisei-Furnes-Seceda) is one entity with `attrs.stages`; a separate lift at the top with its own
ticket (the Fermeda chairlift) is its own entity.

Separate entities: the viewpoint, trailhead or hut at the top (`serves` from the lift); the
[parking](parking.md) at the valley station; passes (`offer` kind `pass` with `covered_by`); the
mountain coaster or bike park at the top station ([adventure](adventure.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `point` | the valley station where you board | Ortisei station of the Seceda lift | the navigation target |
| `attrs.top_station` | `{name, point, point_source, elevation_m}` | `{name: "Seceda", point: [11.72435, 46.59794], point_source: "osm_node:296550944", elevation_m: 2500}` | where the walk starts; 8-9 °C colder |
| `attrs.stages` | list `{from, to, type, minutes}` | gondola Ortisei-Furnes, cable car Furnes-Seceda; 15-20 min total | |
| `season` | per lift, `applies_to` | `05-22..11-02 open (2026)` | opens after the trip starts, or closes before it ends |
| `hours` | periods with `open`, `last_up`, `last_down`, `breaks`, frequency | 08:30-17:30 to 10 Jul, 08:30-18:00 11 Jul - 23 Aug (2026) | the last descent strands people |
| ticket offers | `return`, `one_way_up`, `one_way_down`, `segment`, with bands (ages), currency, `applies_to`, read date | return 74 EUR adult, 37 junior 8-15.99, free 0-7.99 with a paying adult | |
| `attrs.reservation` | `none`, `recommended`, `required` (time slots), with the `offer` window | `required`: time slots every 30 min from summer 2026 | no slot, no ride |
| `attrs.passes` | which passes are valid and which are **not** | "SuperSummer not valid on Ortisei-Furnes, Furnes-Seceda or Fermeda" | the pass that does not cover the one lift you need |
| `attrs.weather_closure` | what stops it (wind, lightning) and the status source | "wind; check the live status page" | |
| `attrs.carries` | `pushchairs`, `bikes`, `dogs`, `wheelchairs`: `yes`, `folded`, `no`, `extra_fee` | `{pushchairs: "folded"}` | |

Complete adds: `attrs.capacity` (cabin size), `attrs.queue_note` (peak queues), `attrs.seat_side`
(scenic trains: which side has the view), `attrs.frequency_min`, `attrs.staff_breaks`,
`eligibility` (chairlift minimum height or age to ride alone), `attrs.combo` (lift plus lunch, lift
plus coaster), `attrs.closing_sunday` pattern.

## 3. Location

Two points: `point` = valley (boarding) station, `attrs.top_station.point` = top station, both from OSM
`aerialway=station` nodes (or railway stations) with ids. Stations share names: OSM has two "Ortisei
station" nodes 400 m apart (411679826 and 1638308249, read 18 Oct 2026), one of them the Seceda lift
and one another line: pick by the `aerialway` way that ends there, never by name alone. `shape` holds
the line from the `aerialway` way. Parking at the valley station is a separate entity.

## 4. Link checklist

`official` (operator), `hours_rates`, `booking`, `status` (live running status), `timetable` (trains),
`webcam` (top station), `tourism_board` (season lists such as south-tirol.com and
cortinadampezzo.it), `osm`, `wikidata`, `commons`, `video`; `navigation` generated.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Operator site (seceda.it, lagazuoi.it, Compagnie du Mont-Blanc, Pursuit for Banff and Jasper) | season, hours, last up and down, prices, slots |
| 2 | Regional season lists (south-tirol.com opening hours, cortinadampezzo.it summer openings, dolomiti.it SuperSummer) | which lifts run when, pass validity; a conflict when they disagree with the operator |
| 3 | Pass issuers (Dolomiti SuperSummer, Gardena Card, Multipass) | validity |
| 4 | OSM | stations, line, `aerialway:occupancy` |
| 5 | Dated community reports | queues, slot sell-out, whether it actually ran |

## 6. People limits

Usually none for gondolas and trains. Chairlifts may have a minimum height or age to ride without an
adult; record per lift. `attrs.carries.pushchairs` and wheelchairs go to the accessibility check.

## 7. Time and money

Season per lift (they differ within one valley), hours with `last_up` and `last_down`, staff breaks
(Rosetta closed 13:00-13:40), ticket types and bands with ages and read year, time-slot windows and
sell-out, passes valid and not valid, closing-Sunday patterns.

## 8. Never guess

That a lift runs on the trip's dates (read the season per lift); last descent; that a pass covers it;
2027 or 2028 dates (carry the 2026 pattern with `applies_to`); slot sell-out speed.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.top_station` with point and elevation | OSM, `official` |
| U4 | Usable | `hours` with `last_up` and `last_down` for each season period | `operator` |
| U5 | Usable | ticket offers: at least return, with bands, currency, `applies_to`, read date | `operator` |
| U6 | Usable | `attrs.reservation`; when not `none`, the offer window with tz and sellout | `operator` |
| U7 | Usable | at least one `serves` relation (what it reaches) | |
| U8 | Usable | `attrs.passes` (valid and not valid, or `none`) | `official` |
| C9 | Complete | `attrs.stages` | `operator` |
| C10 | Complete | `attrs.weather_closure` and `status` link | `operator` |
| C11 | Complete | `attrs.carries` | `operator` |
| C12 | Complete | `shape` from the OSM line | |
| C13 | Complete | `attrs.queue_note` | `community` |
| C14 | Complete, scenic trains | `attrs.seat_side` | `community` |
| C15 | Complete, chairlifts | `eligibility` for riding (SN ok) | `operator` |

Totals: Draft 5, Usable 13, Complete 20; **38** (36 for a gondola: C14 and C15 drop out).

Family checks F1-F12 from [suitability.md](../suitability.md) section 4 apply as marked in its activity offer, lift column: F1, F2, F3, F8 and F12 are Usable; F4, F5, F6, F9 and F10 are Complete. They are counted like any other check and are in the totals above.


## 10. Freshness

Season and hours: 365 days and re-read in April-May for a summer trip (dolomites trails.md
header: "re-check all lift and hut opening dates in April-May 2027"). Prices: 120 days. Slot rules:
365 days. Pass validity: 365 days. Stations and line: never. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Lifts closed for the whole trip window | Fedare (11 Jul - 15 Sep) and Faloria (opens 11 Jul) for a 26 Jun start (dolomites trails.md 0.2) |
| A lift closed for a whole summer | Ciampinoi chairlift closed summer 2026, gondola only (research/trips/dolomites-july-2027/sights.md line 148); Grands Montets closed to lifts summer 2026 (research/trips/chamonix-mont-blanc-sept-2028/stay.md line 65) |
| Sources disagree on season and hours | Lagazuoi 6 Jun versus 30 May; 16:40 versus 17:00 (dolomites sights.md line 65) |
| Staff lunch break | Rosetta cable car closed 13:00-13:40 (dolomites sights.md line 171) |
| Time-slot booking introduced | Seceda from summer 2026 (dolomites sights.md line 19) |
| A pass that does not cover the famous lift | SuperSummer not valid on Seceda (dolomites trails.md 0.2) |
| Lifts that stop mid-September | Brevent, Planpraz and Bellevue about 13 Sep (repo CLAUDE.md, Chamonix entry) |
| Two names, one product | Lake Louise Sightseeing and the Lake Louise Gondola (research/trips/canadian-rockies-sept-2029/adventure.md line 50) |
| Hours page dead at check time | Jasper SkyTram hours URL returned 520 (repo CLAUDE.md, Rockies entry) |
| Free-child deals with conditions | Banff Gondola: one free child per paying adult, first 2 hours (legacy/canadian-rockies-sept-2029/data/adventures.json) |

## 12. Worked example: Ortisei-Furnes-Seceda

| Field | Value | Source |
|---|---|---|
| `point` | Ortisei valley station: which of OSM nodes 411679826 and 1638308249 is to be settled from the aerialway way (gap) | OSM, read 18 Oct 2026 |
| `top_station` | Seceda, OSM node 296550944, 46.59794, 11.72435; about 2,500 m | OSM; dolomites sights.md 1.1 |
| `stages` | gondola Ortisei-Furnes (2,500 m long, 450 m vertical, 6-8 person cabins); cable car Furnes-Seceda (about 30 people); 15-20 min | dolomites sights.md 1.1 |
| `season` | 22 May - 2 Nov 2026 | seceda.it |
| `hours` | 08:30-17:30 to 10 Jul; 08:30-18:00 11 Jul - 23 Aug (2026); `last_up`/`last_down` gap | south-tirol.com via dolomites trails.md 0.2 |
| tickets | return 74 EUR adult, 37 EUR junior 8-15.99, free 0-7.99 with a paying adult; one way about 49/25 | seceda.it |
| `reservation` | `required`, time slots every 30 minutes, from summer 2026; window rule gap | val-gardena.net Q&A |
| `passes` | SuperSummer not valid; Gardena Card covers Val Gardena lifts (prices not published) | dolomiti.it; dolomites sights.md line 196 |

Level once the valley station is settled: **Draft · 10 of 36** (D1-D5, U1, U2, U3, U5, U8). Missing for
Usable: U4 last up and last down, U6 the slot window and sell-out, U7 the `serves` relation to the
ridge viewpoint ([viewpoint.md](viewpoint.md) example).
