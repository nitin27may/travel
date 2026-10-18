# Kind profile: waterfall (and canyon, gorge)

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/sights-and-viewpoints.md](../lanes/sights-and-viewpoints.md).

## 1. What it is

A waterfall, cascade, gorge or canyon people walk to and look at. Stored as `entity.kind = place`,
subkind `waterfall`, `canyon` or `gorge`. Produced by the **sights and viewpoints** lane. Waterfalls
are the trip-type favourite for families in this repo's intent notes ("waterfalls, lookouts, caves,
swimming, splash pads"), and they have their own traps: flow that depends on the season, eroded rims,
and duplicate names.

Separate entities: [parking](parking.md); the access walk as a [trail](trail.md) when it is longer
than about 2 km or has its own grade; a ticketed gorge walk with helmets is a [sight](sight.md) or
[adventure](adventure.md) (Bletterbach); canyoning is adventure.

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `summary` | our words, with the height and type | "100-125 ft cascade in a mossy gorge in C.C. Putnam State Forest." | |
| `attrs.height_m` | metres, from a source; feet converted | `35` | the Granville versus Stowe difference |
| access | `parks_for` with walk minutes, or a trail relation | lot 380 m from the falls | |
| `attrs.walk_from_access` | `{m, min, gain_m, surface, stroller, steps}` | `{m: 800, gain_m: 40, surface: "roots, rock steps", stroller: "no"}` | a 0.5 mi walk can still mean a rooty climb |
| `duration_min`, `duration_max` | minutes | `30`, `60` | a 10-minute roadside stop or an hour |
| `season` | access season plus `attrs.flow` by month (`high`, `medium`, `low`, `dry`, `frozen`) with source | `{05: "high", 09: "low"}` | a waterfall in a dry September is a wet rock |
| `hours`, fee | `always_open`, or the site's hours and an `offer` | | |
| `attrs.safety` | `fenced`, `partly_fenced`, `unfenced_edge`, `eroded_rim`, `slippery_steps`, with where | `eroded_rim` | "rim edge is eroded, stay back" |
| `attrs.swimming` | `allowed`, `banned`, `unsafe`, `unknown` | `unsafe` | kids at a plunge pool |
| `attrs.viewing` | `roadside`, `platform`, `rim`, `base`, `behind` | `rim` | |

Complete adds: `attrs.light` (computed from bearing), `attrs.viewpoint_bearing`, `attrs.crowds`,
`attrs.photo_spot`, `attrs.facilities`, `attrs.kid_note`, `eligibility.accessibility` (Granville has a
0.1 mi accessible boardwalk).

## 3. Location

`point` is the main viewing spot (platform, rim overlook or base), from OSM (`waterway=waterfall` node
is the falls itself; prefer a `tourism=viewpoint` beside it when one exists, else the waterfall node)
→ agency map → `manual_pin`. Check the area: two places with one name an hour apart must stay two
entities with their towns in the name shown to people.

## 4. Link checklist

`official` (state forest, park or town; a regional trail directory run by a public body such as
Vermont Trailfinder also counts), `conditions`, `osm`, `wikidata`, `commons`, `alltrails` (link only), `trip_report`, `webcam`, `video`; `navigation` generated.

## 5. Where to research, in order

1. Land manager (state forest, provincial park, municipality, Norwegian Public Roads for the national
   tourist route stops).
2. Regional trail directories run by public bodies (Vermont Trailfinder) and tourism boards (gostowe).
3. OSM for the falls node, the path, the lot, fences.
4. Wikidata and Wikipedia for height (paraphrased, checked against the land manager).
5. Dated community reports for flow by month, rim conditions, crowds.

## 6. People limits

`attrs.safety` and `attrs.walk_from_access` against the household's avoid rules (unfenced edges with
young kids) and pushchairs.

## 7. Time and money

Mostly free and always open. Record the access season (road closures, snow), flow by month, and any
fee (Ragged Falls fee was an open question in the Algonquin plan: repo CLAUDE.md).

## 8. Never guess

Height; flow in the trip's month; whether swimming is allowed; "accessible" without a source; which of
two same-named falls a source means.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | access resolved | `official` |
| U4 | Usable | `attrs.walk_from_access` | `official`, `community`, or `agent_inferred` from OSM |
| U5 | Usable | `duration_min`, `duration_max` | `community` |
| U6 | Usable | `hours`/fee (or `always_open` and `free`) | `official` |
| U7 | Usable | `attrs.safety` (SN ok) | `community` |
| U8 | Usable | `attrs.flow` for at least the trip-type months (SN ok) | `community` |
| C9 | Complete | `attrs.height_m` | `official`, or Wikidata as `community` |
| C10 | Complete | `attrs.swimming` | `official` for `banned` |
| C11 | Complete | `attrs.viewing` | |
| C12 | Complete | `attrs.viewpoint_bearing` and `attrs.light` | `agent_inferred` |
| C13 | Complete | `attrs.crowds` | `community` |
| C14 | Complete | `eligibility.accessibility` | `official` |
| C15 | Complete | related access entities at least Usable | |

Totals: Draft 5, Usable 8, Complete 15; **28**.

## 10. Freshness

Access and fee: 365 days. Flow: 2 years (it is a pattern). Safety: 2 years, and on any report.
Height: never. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Two Moss Glen Falls an hour apart: Stowe (100-125 ft gorge, rooty climb) and Granville (35 ft roadside, accessible boardwalk) | research/trips/vermont-fall-2026/trails.md, Moss Glen Falls entry |
| Lot size disagrees: "~8-10 cars" versus a small gravel lot in OSM | vermont trails.md versus vermont notes/PARKING.md |
| Eroded rim overlook | Moss Glen Falls (Stowe), same entry |
| Waterfalls with no official data at all | Cascate di Fanes and Cascate di Riva marked GAP (research/trips/dolomites-july-2027/sights.md, hidden gems) |
| A fee nobody could confirm | Ragged Falls (repo CLAUDE.md, Algonquin entry) |

## 12. Worked example: Moss Glen Falls (Stowe, Vermont)

| Field | Value | Source |
|---|---|---|
| `name` shown | "Moss Glen Falls (Stowe)" | vermont trails.md |
| access | gravel lot `[-72.62726, 44.48524]`, OSM (`OSM` row), 380 m from the falls | vermont notes/PARKING.md |
| `walk_from_access` | 0.5 mi (0.8 km) round trip; meadow and boardwalk, then a short steep rooty climb to the rim overlook | vermont trails.md |
| `height_m` | 100-125 ft = 30-38 m (converted; a range from the source) | vermont trails.md, `community` |
| `safety` | `eroded_rim`, rock steps slippery when wet | vermont trails.md |
| `season`, fee | year-round state forest, free (no closures found, 2026) | vermont trails.md |
| links | gostowe, Trailfinder, AllTrails (link only) | vermont trails.md |
| `flow` | `gap` | |

`point`: OSM node 3003882646 (`waterway=waterfall`, "Moss Glen Falls", 44.48238, -72.62450, read 18
Oct 2026), 300-400 m from the lot node above, which matches the research's 380 m.

Level: **Draft · 12 of 28** (D1-D5, U1, U2, U3, U4, U5, U6, U7); U8
(flow in October) is the one check between it and Usable.
