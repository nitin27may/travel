# Kind profile: hut, refuge, rifugio

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/stays.md](../lanes/stays.md) (hut-specific fields) and [../lanes/trails.md](../lanes/trails.md)
(the access trail).

## 1. What it is

A mountain hut reached on foot (or by lift plus a walk) where people eat and, usually, sleep:
refuge, rifugio, Hütte, DNT cabin, backcountry lodge. Stored as `entity.kind = stay`, subkind `hut`.
Produced by the **stays** lane, with the **trails** lane for the approach. A hut matters twice: as a
lunch stop on a day hike (cash, kitchen hours) and as a night (booking window, half board, age rules).

One entity per hut. A hut without beds (malga, baita, alpine tea house) is `eatery` /
`hut_kitchen` ([eatery.md](eatery.md)) instead. A hut with beds keeps its day-visitor kitchen inside
this entity (`attrs.day_visitors`); it is not split into a separate eatery.

Separate entities: the access trail(s) ([trail](trail.md), relation `combo_with` plus
`attrs.access_trails`); the lift that shortens the approach ([lift](lift.md)); bed products (`offer`
kind `room`: dorm bed, private room) with their own windows.

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `point` | the hut building | | |
| `attrs.elevation_m` | metres | `2352` | cold nights, altitude for kids |
| `season` | open period, `applies_to`; sources often disagree | `06-05..10-04 (Ulysse) / 06-03..09-29 (tourism board)` | the hut closes before your date |
| `attrs.access_trails` | relations to trails with time from the nearest lift or road | "1 h 30 - 2 h from La Flegere" | the walk in with a pack |
| `attrs.access_lift` | relation to a lift and that lift's season | Flegere, ends about 13 Sep | the approach doubles when the lift stops |
| `attrs.booking` | channel and window: `{online_until, phone_from, opens_rule}` with the offer | "online until 31 May; from 1 June phone only" | |
| `attrs.half_board` | `mandatory`, `optional`, `none`; price per person with year | `mandatory`, 80 EUR (undated) | |
| `attrs.payment` | `cash_only`, `card`, `card_min_amount` | `cash_only` | no ATM at 2,300 m |
| `eligibility.min_age` | years, rule or recommendation | `8` ("no children under 8") | the rule that ends a family plan |
| `attrs.dorm_or_private` | `dorm`, `private`, `both`; beds total | `both`, 40 places | |
| `attrs.day_visitors` | kitchen hours for lunch, cash rule, whether day visitors are served | "lunch 11:30-14:30, cash only" (Vandelli) | the lunch stop on a day hike |

Complete adds: `attrs.check_in_from`, `attrs.check_out_by` (and breakfast time), `attrs.showers`
(none, cold, token), `attrs.sheet_sleeping_bag_required`, `attrs.water` (drinkable, buy only),
`attrs.charging`, `attrs.wifi`, `attrs.dietary_handling`, `attrs.deposit` and cancellation terms,
`attrs.bivouac_rule` (allowed nearby or banned), `attrs.club_discount` (CAI, SAC, DAV, Alpine Club of
Canada), `attrs.emergency_phone`.

## 3. Location

`point` from OSM `tourism=alpine_hut` or `tourism=wilderness_hut` (node or way, with id) → the club's
hut database → `manual_pin`. The access point is the trailhead or the lift top station, related, not
copied into the hut.

## 4. Link checklist

`official` (the hut's own site), `booking` (its system or the club's: montourdumontblanc.com for TMB
huts, the CAI or SAC portals), `terms`, `tourism_board`, `osm`, `wikidata`, `commons`, `webcam`,
`trip_report`; `navigation` generated to the trailhead.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The hut's own site and booking system | season, booking rule, half board, payment, age rules |
| 2 | The alpine club or hut network booking platform | when the season's bookings open (the TMB platform opened 2027 bookings on 15 Oct 2026) |
| 3 | Official tourism board | season, contact, a conflict when it disagrees |
| 4 | Phone or email, recorded as `operator` evidence | rules the site does not state |
| 5 | OSM | point, `capacity`, `ele` |
| 6 | Dated community reports | real kitchen hours, crowding, water |

## 6. People limits

`eligibility.min_age` is often a hard rule for overnight stays ("no children under 8") and absent for
day visitors; record which. Check age on the night, against every child. The approach trail's own
checks apply to the walk.

## 7. Time and money

Season per year, booking channel and window (club platforms open on fixed dates: `fixed_date`), half
board price with year, deposit (Rifugio Lagazuoi: 50% non-refundable, forfeited inside 3 days),
payment method, the lift calendar that changes the approach.

## 8. Never guess

Opening and closing dates for the trip's year; that it takes cards; age rules; that day visitors are
served lunch; the booking-open date for a future season ("pattern suggests 15 Oct 2027" is an
inference, not a date).

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.elevation_m` | OSM `ele` or `official` |
| U4 | Usable | `attrs.access_trails` (at least one relation with time), or `attrs.access_lift` | |
| U5 | Usable | `attrs.payment` | `operator`; two dated `community` reports allowed |
| U6 | Usable | `attrs.day_visitors` (or `not_applicable` for huts closed to day visitors) | `operator` or `community` |
| U7 | Usable, for a night | `attrs.booking` with an `offer` window (`window_rule`, tz) | `operator` or `official` |
| U8 | Usable, for a night | `attrs.half_board` with price and year | `operator` |
| U9 | Usable, for a night | `eligibility.min_age` (value, `none_stated`, or SN ok) | `operator` |
| C9 | Complete | `attrs.dorm_or_private` and beds | `operator` |
| C10 | Complete | `attrs.check_in_from`, `check_out_by` | `operator` |
| C11 | Complete | `attrs.showers`, `sheet_sleeping_bag_required`, `water` | `operator` or `community` |
| C12 | Complete | `attrs.deposit` and cancellation | `operator` |
| C13 | Complete | `attrs.access_lift` season linked, or `not_applicable` | |
| C14 | Complete, for a night | `eligibility.min_age` is a value or `none_stated` (no SN) | `operator` |

The hut is assessed as a night stop by default (U7-U9, C14 apply); a hut used only as a lunch stop on
a trip drops them. Totals: Draft 5, Usable 9, Complete 14; **28** (24 as a lunch stop).

## 10. Freshness

Season and booking rules: 365 days, and before the booking window opens. Half board price: 365 days
(huts publish once a year). Payment and age rules: 365 days. Kitchen hours: 365 days. Point and
elevation: never.

## 11. Traps

| Trap | Where |
|---|---|
| Season sources disagree | Lac Blanc 5 Jun - 4 Oct (Ulysse) versus 3 Jun - 29 Sep (tourism board) (research/trips/chamonix-mont-blanc-sept-2028/stay.md line 108) |
| Booking channel changes at the season start | Lac Blanc online until 31 May, phone only from 1 June (same) |
| Age rule for nights | Lac Blanc: no children under 8 (same) |
| Huts close about 20 September | TMB huts (research/trips/chamonix-mont-blanc-sept-2028/timing.md line 96) |
| Booking opens on a fixed date the year before | TMB platform 15 Oct (chamonix stay.md line 7) |
| Cash only | Rifugio Vandelli (research/trips/dolomites-july-2027/trails.md 0.6); Lake Agnes Tea House (lanes/food.md) |
| Non-refundable deposits | Rifugio Lagazuoi 50% (research/trips/dolomites-july-2027/sights.md line 74) |
| The approach depends on a lift that stops mid-September | Lac Blanc and the Flegere lift (chamonix timing.md line 115) |

## 12. Worked example: Refuge du Lac Blanc

| Field | Value | Evidence |
|---|---|---|
| `elevation_m` | 2,352 (timing.md) versus 2,358 (stay.md): conflict | chamonix research |
| `season` | conflict: 5 Jun - 4 Oct 2026 (Ulysse, 40 places) and 3 Jun - 29 Sep 2026 (Haute-Savoie tourism) | stay.md line 108 |
| `booking` | online at refugedulacblanc.fr until 31 May; phone 07 67 56 74 14 from 1 June | same |
| `half_board` | `mandatory`, 80 EUR per person (undated tourism card; 2016 figure 55 EUR) | same; `applies_to` unknown, so the price fails the rule |
| `payment` | `cash_only` | same |
| `min_age` | 8, `rule`, nights | same |
| `bivouac_rule` | no bivouac | same |
| `access_lift` | La Flegere, ending about 13 Sep (2026 pattern) | chamonix timing.md line 115 |

Level once the point is recorded: **Draft · 10 of 28** (D1-D5, U1, U2 with the conflict, U3, U5,
U9). Missing for Usable: U4 the access trail relation, U6 day-visitor lunch, U7
the booking window as an `offer`, U8 a dated half-board price.
