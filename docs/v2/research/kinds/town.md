# Kind profile: town, village, base

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/destination-overview.md](../lanes/destination-overview.md) for what the place is, and
[../lanes/stays.md](../lanes/stays.md) for the base facts.

## 1. What it is

A town, village or city a trip passes through or sleeps in. Stored as `entity.kind = place`, subkind
`town`, `village` or `city`; when people sleep there it carries `attrs.base`. Produced by the
**destination overview** lane (identity, why go, sub-regions) and the **stays** lane (the base facts
that decide where to sleep: the trip-planner skill's rule that "the famous village is often the wrong
one to sleep in").

Geography versus place: the town's `area` row holds the polygon and the tree (country > region >
town) so "everything in Argentiere" is a query; the `place/town` entity holds the visitable and base
facts and sets `area_id` to that same area. (01-domain-model.md does not settle this yet; see
README section 13.)

Separate entities: the stays in it ([stay](stay.md)); the old town as a [sight](sight.md) when it is
a visit in its own right; the station, the supermarket ([eatery](eatery.md) subkind `supermarket`),
car parks ([parking](parking.md)); lifts from the village ([lift](lift.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `summary` | our words: what it is and who it suits | "Quieter top-of-valley village under the Aiguille Verte; trains and buses to Chamonix." | |
| `attrs.base.elevation_m` | metres, from a source | `1252` | night temperature, altitude for small kids |
| `attrs.base.access` | list: `road`, `car_free`, `rail`, `lift_only`, `ferry`, with notes | `["road", "rail"]` | a car-free village needs luggage logistics |
| `attrs.base.why_sleep_here` | our words, concrete | "trailheads from the door for Col de Balme and the Aiguilles Rouges" | |
| `attrs.base.why_not` | our words, concrete | "grocery limited; sun lost earlier" | |
| `attrs.base.groceries` | relation to the nearest real supermarket entity, with drive or walk minutes | "Super U Les Pelerins, daily" | self-catering and picnics |
| `attrs.base.drive_times_min` | to the area's other bases and main sights, from routing (`leg_cache`), never memory | `{chamonix_centre: 15}` | the cost of the base in every day |
| `attrs.base.transport` | guest card or local pass: what it covers, what it does not | "carte d'hote: free train Servoz-Vallorcine only; buses discounted, not free" | the free-bus assumption that is wrong |
| `attrs.base.parking` | free, paid (with rate), resident-only, ZTL | "Chamonix commune 24 h EUR 19.90 versus 22.50: conflict" | |

Complete adds: `attrs.base.loses_sun` (computed per month, horizon-aware when available),
`attrs.base.night_temp_c` by month, `attrs.base.evening_vibe` (`quiet`, `lively`,
`day_tripper_churn`), `attrs.base.last_transport` (last train, bus or lift back),
`attrs.base.tourist_tax` (per person per night, exemptions, year), `attrs.base.ev_charging`,
`attrs.base.pharmacy`, `attrs.base.atm`, `attrs.base.cell_coverage`, `attrs.base.ztl`.

## 3. Location

`point` is the town centre as people mean it (the main square, the church, the station when that is
the centre), from OSM `place=town`/`village` node or Wikidata P625 (allowed for towns at Draft).
The `area` polygon comes from OSM or geoBoundaries. Navigation goes to the point; for a car-free
village, to the car park or station that `serves` it.

## 4. Link checklist

`official` (municipality), `tourism_board`, `timetable` (local buses and trains), `osm`, `wikidata`,
`wikipedia`, `wikivoyage` (facts only, CC BY-SA), `commons`, `webcam`; `navigation` generated.

## 5. Where to research, in order

1. Municipality and tourist office (guest card terms, parking guide, tourist tax).
2. Transport operators (local bus, rail, last services).
3. Wikidata and Wikipedia for elevation and identity (paraphrased).
4. OSM for the centre, supermarkets, pharmacies, ATMs, charging.
5. Routing (`plan_drive` / `leg_cache`) for drive times; `core/src/sun` for sun loss.
6. Community for evening vibe, noise, day-tripper churn.

## 6. People limits

None of its own. Elevation and night temperature feed the family and multi-generation checks.

## 7. Time and money

Tourist tax with the year; parking rates; guest-card coverage; last transport back per season;
shoulder-season closures (half the village shut after mid-September is common in the Alps).

## 8. Never guess

Elevation ("~1,060 m INFER" is a gap, not a value); drive times; what a guest card covers; tourist tax
from an old grid (the 2019 Chamonix grid is "obsolete; do not quote"); sun loss without computing it.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus. For a town that is not a base, only U3 and C9-C10 apply.

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.base.access` (or the town's access note) | `official` |
| U4 | Usable, base | `attrs.base.elevation_m` | `official` or Wikidata |
| U5 | Usable, base | `attrs.base.why_sleep_here` and `why_not` | our words with sources |
| U6 | Usable, base | `attrs.base.groceries` relation | `operator` hours on the supermarket |
| U7 | Usable, base | `attrs.base.drive_times_min` to at least the trip's other bases | `agent_inferred` from routing |
| U8 | Usable, base | `attrs.base.transport` (or `none`) | `official` |
| U9 | Usable, base | `attrs.base.parking` | `official` |
| C9 | Complete | `area` polygon linked | |
| C10 | Complete | `attrs.base.last_transport` (or `not_applicable`) | `official` |
| C11 | Complete, base | `attrs.base.loses_sun` | `agent_inferred` |
| C12 | Complete, base | `attrs.base.night_temp_c` | `official` climate data |
| C13 | Complete, base | `attrs.base.tourist_tax` with year | `official` |
| C14 | Complete, base | `attrs.base.evening_vibe` | `community` |
| C15 | Complete, base | `attrs.base.ev_charging`, `pharmacy`, `atm` | OSM |

Totals for a base: Draft 5, Usable 9, Complete 15; **29**. For a town that is not a base: Draft 5,
Usable 3, Complete 10; **18**.

## 10. Freshness

Guest card and transport: 365 days. Parking rates and tourist tax: 365 days (they change on 1
January). Last transport: 180 days. Elevation, area: never. Sun loss: recompute on change. Evening
vibe: 2 years. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Guest card does not cover the buses people expect | Chamonix carte d'hote (research/trips/chamonix-mont-blanc-sept-2028/stay.md line 9); Val Gardena Guest Pass covers neither the Braies shuttle nor the Tre Cime bus (research/trips/dolomites-july-2027/transport.md) |
| Elevations not sourced, filled from memory as INFER | Chamonix, Les Praz, Les Houches (chamonix stay.md line 31) |
| Old tax grid | 2019 taxe de sejour (chamonix stay.md line 42) |
| Ridge-blocked sunset not computable yet | chamonix stay.md section 1 GAP |
| A village that is not in the valley the board covers | Longiaru is not one of Alta Badia's six villages (dolomites sights.md line 334) |
| A car-free valley road | Alpe di Siusi closed to private traffic 09:00-17:00 (dolomites transport.md) |
| Engineering works replace trains in autumn | Chamonix-Le Chatelard 28 Sep - 6 Nov 2026 (chamonix stay.md line 37) |

## 12. Worked example: Argentiere as a base

| Field | Value | Source |
|---|---|---|
| `elevation_m` | 1,252 (station 1,244; Komoot 1,270): conflict, Wikipedia chosen as `community` until an official figure is read | chamonix stay.md line 31 |
| `access` | road, rail (TER stop), buses | chamonix stay.md line 65 |
| `why_sleep_here` | quieter, trailheads to Col de Balme and the Aiguilles Rouges from the door | same |
| `why_not` | steeper valley, grocery limited, sun lost earlier (the last is INFER) | same |
| `groceries` | "several small grocery stores"; nearest supermarket not sourced (gap) | chamonix stay.md line 51 |
| `transport` | carte d'hote: Servoz-Vallorcine trains free; bus passes discounted (2-day EUR 5, weekly EUR 10) | chamonix stay.md lines 9, 38 |
| `last_transport` | Chamo'nuit night bus Les Houches - Argentiere every 45 min 20:50-midnight (search summary) | chamonix stay.md line 36 |
| `tourist_tax` | gap: 2027 grid on the council agenda; 2019 grid obsolete | chamonix stay.md lines 42-44 |

Level: **Draft · 10 of 29** (D1-D5, U1, U2, U3, U5, U8). Missing for Usable: U4 an official elevation,
U6 a supermarket entity, U7 drive times from routing, U9 parking.
