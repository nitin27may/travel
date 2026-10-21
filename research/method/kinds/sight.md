# Kind profile: sight (museum, landmark, church, castle, old town)

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md).

## 1. What it is

A built or cultural place people visit: a museum, church, castle, landmark, old town, historic site,
market, garden, zoo, aquarium, science centre, show cave, and the family places that use the same
fields (playground, splash pad, picnic area). Stored as `entity.kind = place` with those subkinds.
Produced by the **sights and viewpoints** lane (and family-and-kids for the kid places).

Separate entities: tickets and guided tours as `offer` rows (a castle visitable "by guided tour only"
has its tours as offers with times); [parking](parking.md); the café or restaurant inside when it has
its own hours ([eatery](eatery.md)); the town around an old town ([town](town.md)); a gorge walk with
helmets sold as an experience ([adventure](adventure.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `summary` | our words, 1-3 sentences | "Ladin culture museum in a castle above San Martino in Badia." | |
| `hours` | hours structure with `last_entry`, `closed_days`, seasonal periods, `closures` | Tue-Sun 10:00-18:00, 1 May - 1 Nov; `closed_days: ["mon"]` | the Monday-closure evening |
| `season` | | `05-01..11-01 open` | |
| ticket | `offer` kind `ticket` with price bands (adult, child with ages, family, under-N free), currency, `applies_to`, `read_on`; or `free` | `[{band: "adult", amount, currency: "EUR"}, {band: "child 6-14", amount}]` | budget and age bands |
| `attrs.reservation` | `none`, `recommended`, `required` (timed entry), with the `offer` window | `required` | timed entry sells out |
| `attrs.visit_mode` | `self_guided`, `guided_only` (with tour `offer`s), `exterior_only`, `service_times_restricted` | `guided_only` | "visitable by guided tour only, on limited days" |
| `duration_min`, `duration_max` | minutes | `60`, `120` | |
| `attrs.indoor`, `attrs.rainy_day_ok` | bool | `true` | the rainy-day rescue persona |
| access | `parks_for`, transit note, or `attrs.access_note` (ZTL, car-free centre) | "ZTL cameras; park outside the gates" | a fine by post three months later |
| `attrs.kid_note` | our words; kids' trail, hands-on rooms, pushchair rules | | |

Complete adds: `attrs.dress_code` (churches), `attrs.photo_rules`, `attrs.pass_covers` (museum cards,
city passes; relation `covered_by` to the pass `offer`), `eligibility.accessibility` (step-free,
lifts), `attrs.facilities` (toilets, café, lockers, pushchair parking), `attrs.languages` (tours,
audio guides), `attrs.crowds`, `wikidata_qid`, `attrs.heritage` (UNESCO or national listing).

## 3. Location

`point` is the **public entrance** (OSM entrance node `entrance=main` on the building when tagged,
else the building centroid and say so), not the street address geocode. An old town's point is its
main square, with `shape` the historic centre polygon when OSM or the municipality has one. Access
points (car park outside a ZTL, a station) are separate.

## 4. Link checklist

`official`, `hours_rates`, `booking`, `accessibility`, `tourism_board`, `osm`, `wikidata`,
`wikipedia`, `commons`, `video`, `trip_report`, `map_sheet` (the site plan PDF), `terms` (photo,
cancellation); `navigation` generated.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The site's own page and ticket shop | hours, last entry, closed days, prices, reservation, tours |
| 2 | Official tourism board, municipality (ZTL rules) | access, passes that cover it, seasonal changes |
| 3 | National or regional heritage bodies, UNESCO | listing, identity |
| 4 | Wikidata, OSM | identity, entrance point, `opening_hours` as a hint only |
| 5 | Dated community reports | queues, real duration, how kid-friendly it is |

## 6. People limits

Usually none; record them when they exist (minimum age on tower climbs and cave tours, pushchairs not
allowed, height limits on rides at zoos and science centres). Accessibility (step-free entrance,
lifts) goes to the accessibility check.

## 7. Time and money

Hours per season with `last_entry`; weekly `closed_days`; holiday closures; maintenance `closures`;
ticket bands with ages and the read date; timed-entry windows with sell-out; which passes cover it.

## 8. Never guess

Hours from OSM `opening_hours` alone; "open Mondays"; prices without a year; child age bands;
whether a guided-only site has an English tour; ZTL hours.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `hours` with `closed_days` (and `last_entry` when it differs from closing) | `operator` or `official`; OSM fails |
| U4 | Usable | ticket `offer` with bands, currency, `applies_to`, `read_on`, or `free` | `operator` |
| U5 | Usable | `attrs.reservation`; when not `none`, the `offer` window with tz and sellout | `operator` |
| U6 | Usable | `attrs.visit_mode`; when `guided_only`, at least one tour `offer` with days and times | `operator` |
| U7 | Usable | `duration_min`, `duration_max` | `community` |
| U8 | Usable | access resolved (parking relation, transit or access note including ZTL) | `official` |
| U9 | Usable | `attrs.indoor`, `attrs.rainy_day_ok` | |
| C9 | Complete | `eligibility.accessibility` (SN ok) | `operator` |
| C10 | Complete | `attrs.facilities` | |
| C11 | Complete | `attrs.kid_note` | `community` |
| C12 | Complete | `attrs.pass_covers` (or `none`) | `official` |
| C13 | Complete, for churches and religious sites | `attrs.dress_code` and service-time limits | `operator` |
| C14 | Complete | `attrs.crowds` | `community` |
| C15 | Complete | `attrs.languages` for guided or audio content | `operator` |

Totals: Draft 5, Usable 11, Complete 19; **35**.

Family checks F1-F12 from [suitability.md](../suitability.md) section 4 apply as marked in its sight, town column: F4 and F6 are Usable, F3, F8, F9 and F12 are Complete. They are counted like any other check and are in the totals above.


## 10. Freshness

Hours and closed days: 180 days. Prices: 120 days. Timed-entry windows: 365 days. Visit mode and
tours: 365 days. Accessibility and facilities: 2 years. Summary: 2 years. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Closed Mondays | Museum Ladin Ciastel de Tor (research/trips/dolomites-july-2027/sights.md line 372) |
| Guided tour only, limited days | Castel Rodengo (dolomites sights.md, hidden gems) |
| Car-free centres with cameras | Bressanone and Cortina ZTL, fines and hours GAP (dolomites transport.md 1.5) |
| An assumption the user brought, verified | "the Stowe gondola was actually operating" (lanes/sights-and-viewpoints.md section 6) |
| Prices not published, only online booking | Bletterbach (dolomites sights.md) |
| Rainy-day option worth having | Klimastollen Prettau climate tunnel (dolomites sights.md, Cascate di Riva entry) |

## 12. Worked example: Museum Ladin Ciastel de Tor

| Field | Value | Source |
|---|---|---|
| `subkind` | `museum` | |
| `hours` | Tue-Sun 10:00-18:00, `closed_days: ["mon"]`, season 1 May - 1 Nov, `applies_to` 2026 | research/trips/dolomites-july-2027/sights.md line 372 (museumladin.it) |
| `point` | pending: entrance node | OSM |
| ticket, reservation, visit mode, duration, access | gaps | |
| identity | museumladin.it; the research also names it as the source for Longiaru | dolomites sights.md line 334 |

Level once the point is recorded: **Draft · 8 of 34** (C13 does not apply). The missing list is the
whole Usable block except U3: ticket bands (U4), reservation (U5), visit mode (U6), duration (U7),
access and parking (U8), indoor flag (U9). One read of museumladin.it closes most of it.
