# Kind profile: viewpoint

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md).

## 1. What it is

A place you stand to look: a lookout, a pull-out on a scenic road, a summit reached by lift or road, a
ridge a short walk from a top station. Stored as `entity.kind = place`, subkind `viewpoint`, `summit`
(when reached without a real hike) or `pullout`. Produced by the **sights and viewpoints** lane, with
the **timing, light and weather** lane computing its light.

The test that separates a viewpoint from a trail: if reaching it from the access point takes more
than about 1 km or 30 minutes of walking, it is the payoff of a [trail](trail.md), and the viewpoint
entity exists only if people also reach it another way. Cadini di Misurina (3.9 km out-and-back from
Rifugio Auronzo) is a trail; the Seceda ridge (10-15 minutes near-flat from the top station) is a
viewpoint.

Separate entities: the [lift](lift.md) or road that reaches it, the [parking](parking.md), the trail
that also reaches it, a hut or restaurant at the top.

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `summary` | our words: what you see, named | "The Odle/Geisler towers drop away in one tilted meadow; the classic Seceda photograph." | is it the view in the photo |
| access | `parks_for`, `serves` (from a lift), or `attrs.access_note` | `serves` from the Seceda cable car | |
| `attrs.walk_from_access` | `{m, min, gain_m, surface, stroller}` | `{min: 15, gain_m: 30, surface: "gravel"}` | |
| `attrs.viewpoint_bearing` | degrees the main view faces, or a list for a panorama | `[0, 60]` | front-lit or back-lit at the planned hour |
| `attrs.light` | computed with `core/src/sun` (method/README.md R12): `[{best, until_hhmm, months, note}]` | `{best: "afternoon", note: "back-lit until about 13:30"}` | Echo Rock is back-lit until ~13:30 |
| `attrs.payoff_check` | our words on whether the marked point has the view | "view is at the promontory, 30-40 min on, not at the hut" | the forested-summit problem |
| `duration_min`, `duration_max` | minutes on site | `30`, `90` | |
| `season`, `hours` | the access season and hours (the lift's, the road's) | lift 22 May - 2 Nov 2026 | dawn from a lift that opens at 08:30 is impossible |
| fee | `free`, or the access `offer` | | |
| `attrs.safety` | `fenced`, `partly_fenced`, `unfenced_edge`, with a note | `unfenced_edge` | the trip-type avoid rule "unfenced cliff edges with young kids" |

Complete adds: `attrs.crowds`, `attrs.photo_spot` (point and note), `attrs.drone_rules`,
`attrs.facilities`, `attrs.weather_note` (cloud base, wind at the ridge), `eligibility.accessibility`.

## 3. Location

`point` is where you stand, from OSM `tourism=viewpoint` (with `direction` tag when present: a good
hint for `viewpoint_bearing`), else `manual_pin`. A summit is `natural=peak` only when the view is
from the summit. Access points are separate (README section 5).

## 4. Link checklist

`official`, `conditions` (road or lift status), `booking` (when the access needs it), `osm`,
`wikidata`, `commons`, `webcam` (often the best "is it clear" check), `trip_report`, `video`;
`navigation` generated.

## 5. Where to research, in order

1. Land manager or tourism board (the lookout's page, the scenic road's page).
2. The lift or road operator for access hours and booking (seceda.it, auronzo.info).
3. OSM for the point, `direction`, fences (`barrier`), toilets.
4. `core/src/sun` for light windows from the point and bearing, never from memory.
5. Commons geotagged photos to confirm where the classic view is taken (find-media, sequential).
6. Dated community reports for crowds and whether the payoff is real.

## 6. People limits

`attrs.safety` against the household's avoid rules; `walk_from_access` against pushchairs and
mobility. A lift that reaches it may carry age or pushchair rules (lift profile).

## 7. Time and money

The access hours decide the light you can get: first lift up, last lift down, road gate times. Store
both; the day check compares `attrs.light` with the access window and flags a plan that wants dawn
from a lift that opens at 08:30 (research/trips/dolomites-july-2027/timing.md, Seceda: "to shoot
dawn, hike about 2 hours from the valley in the dark, or sleep at a ridge rifugio").

## 8. Never guess

Light times (compute); the bearing (from OSM `direction`, imagery or a geotagged photo, else a gap);
that the marked point has the view; that an edge is fenced.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | access resolved (relation or access note) | `official` |
| U4 | Usable | `attrs.walk_from_access` | `agent_inferred` from OSM paths |
| U5 | Usable | `duration_min`, `duration_max` | `community` |
| U6 | Usable | `hours` or `always_open`, including the access's last lift or gate time | `official` or `operator` |
| U7 | Usable | fee (`free` or an access `offer`) | `official` or `operator` |
| U8 | Usable | `attrs.viewpoint_bearing` | OSM `direction`, imagery or photo, `agent_inferred` allowed |
| U9 | Usable | `attrs.light` | `agent_inferred` (computed) |
| U10 | Usable | `attrs.safety` (SN ok) | `community` |
| C9 | Complete | `attrs.payoff_check` | `community` |
| C10 | Complete | `attrs.crowds` with a dated source | `community` |
| C11 | Complete | `attrs.photo_spot` | |
| C12 | Complete | `attrs.facilities` (or `none`) | |
| C13 | Complete | every related access entity at least Usable | |

Totals: Draft 5, Usable 16, Complete 15; **36** (37 when a walk is needed: F7).

Family checks F1-F12 from [suitability.md](../suitability.md) section 4 apply as marked in its viewpoint, waterfall, lake column: F3, F4, F6, F8, F11 (fencing) and F12 are Usable, F7 is Usable when a walk is needed, and F5 and F9 are Complete. They are counted like any other check and are in the totals above.


## 10. Freshness

Access hours: 180 days; access season and booking: 365 days. Light: recompute when the point or
bearing changes. Safety, payoff, crowds: 2 years. Links: 90 days. Point: never.

## 11. Traps

| Trap | Where |
|---|---|
| Back-lit until early afternoon | Echo Rock, Solitaire Lake (research/trips/algonquin-muskoka-oct-2026/foliage-photo.md section 2.4) |
| A named lookout that does not exist | the Track and Tower Trail has no tower; the payoff is a Cache Lake ledge (repo CLAUDE.md, Algonquin entry) |
| The famous view is not at the summit | Cadini di Misurina view is a spur after Forcella Longeres (research/trips/dolomites-july-2027/trails.md, Cadini entry) |
| Dawn needs a lift that is not running | Seceda first lift 08:30 (dolomites timing.md, Seceda) |
| A place name that does not exist | "Lac de Peclerey" (research/trips/chamonix-mont-blanc-sept-2028/trails.md line 142) |

## 12. Worked example: Seceda ridge viewpoint

| Field | Value | Source |
|---|---|---|
| access | `serves` from the Ortisei-Furnes-Seceda lift ([lift.md](lift.md) example); top station OSM node 296550944 "Seceda", 46.59794, 11.72435 (read 18 Oct 2026) | OSM |
| `point` | pending: the ridge viewpoint node | OSM `tourism=viewpoint` to look up |
| `walk_from_access` | about 10-15 minutes, near flat | research/trips/dolomites-july-2027/sights.md 1.1, `community` |
| `season` | lift 22 May - 2 Nov 2026 | seceda.it via sights.md 1.1 |
| `hours` | lift 08:30-17:30 to 10 Jul, 08:30-18:00 11 Jul - 23 Aug (2026) | south-tirol.com via dolomites trails.md 0.2 |
| fee | the lift's offer: return 74 EUR adult, 37 EUR junior 8-15, free under 8 with a paying adult (2026) | seceda.it via sights.md 1.1 |
| booking | time slots every 30 minutes from summer 2026 | val-gardena.net via sights.md 1.1 |
| `light`, `bearing`, `safety` | gaps | |

Level once the point is recorded: **Draft · 11 of 36** (D1-D5, U1, U2, U3, U5, U6, U7). Missing for
Usable: U4 from OSM paths, U8 bearing, U9 light, U10 safety.
