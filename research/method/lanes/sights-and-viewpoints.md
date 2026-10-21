# Lane: sights and viewpoints

Status: draft (17 Oct 2026; deepened 18 Oct 2026 to the depth of [trails.md](trails.md) and aligned
with the kind profiles in [../kinds/](../kinds/README.md)).

## 1. Purpose

The places people come to see and the places they look from: lakes, waterfalls, gorges, viewpoints,
summits reached by lift or road, scenic pull-outs, glaciers seen from a point, beaches, old towns,
museums, churches, castles, markets, gardens, show caves, and the family places (playgrounds, splash
pads, picnic areas). Answer, for each: **what it is and why go, where exactly you stand, how you get
there and park, how long it takes, when it is open and at its best, what it costs and how to book,
whether it suits each person, and where to read more.**

Questions the lane must answer:
1. What is it, in our words, and is the famous view really at the marked point?
2. Where is the subject point (where you stand), and which access points reach it (lot, shuttle stop,
   station, lift)? Is private access allowed at all, and at what hours?
3. How far is the walk from the access point: metres, minutes, gain, surface, steps, pushchair?
4. Season, hours, last entry or last lift, closed weekdays, maintenance closures?
5. Fee or ticket bands by age, booking or timed entry, how fast it sells out?
6. Best time of day: computed light from the bearing, and dated crowd windows?
7. Safety: fences, eroded rims, swimming rules, water quality?
8. Who it suits: pushchairs, accessibility, kids' notes, rainy-day value?
9. Every useful link: official, booking, conditions, OSM, Wikidata, Commons, webcam.

## 2. Produces

| Record | Kind / subkind | Profile |
|---|---|---|
| Lake | `place` / `lake` | [../kinds/lake.md](../kinds/lake.md) |
| Waterfall, gorge, canyon | `place` / `waterfall`, `gorge`, `canyon` | [../kinds/waterfall.md](../kinds/waterfall.md) |
| Viewpoint, summit by lift or road, pull-out | `place` / `viewpoint`, `summit`, `pullout` | [../kinds/viewpoint.md](../kinds/viewpoint.md) |
| Museum, church, castle, landmark, old town, historic site, market, garden, zoo, aquarium, science centre, show cave, playground, splash pad, picnic area | `place` / those subkinds | [../kinds/sight.md](../kinds/sight.md) |
| Beach, swim spot, natural hot spring | `place` / `beach`, `swim_spot`, `hot_spring` | [../kinds/swim-spot.md](../kinds/swim-spot.md) |
| Lift or scenic train that is the reason to go | `activity` / `gondola`, `cable_car`, `scenic_train`, ... | [../kinds/lift.md](../kinds/lift.md) (shared with the adventure lane) |
| Parking lot, shuttle stop | `place` / `parking`, `shuttle_stop` | [../kinds/parking.md](../kinds/parking.md), [../kinds/trailhead.md](../kinds/trailhead.md) |
| Ticket, timed entry, guided tour, shuttle seat, parking slot | `offer` kind `ticket`, `tour`, `shuttle`, `permit` | per profile |
| Relations | `parks_for` (parking → sight, `attrs.walk_min`), `serves` (shuttle stop or lift → sight), `combo_with`, `alternative_to` (quiet substitute, rainy-day swap), `covered_by` (pass), `near` | |
| Links | `entity_link` rows | section 3 |
| Conditions | `condition_report` rows | road bans, closures, water quality, as of the read date |

## 3. Links

Every kind below is filled or recorded `searched_none` with date and query
([../kinds/README.md](../kinds/README.md) section 6). Which kinds are on the checklist depends on the
profile; this is the union.

| `kind` | What | Required? |
|---|---|---|
| `official` | the land manager's or site's own page | required when one exists; a gap otherwise |
| `hours_rates` | the hours and prices page when separate | checklist for ticketed sights |
| `booking` | timed entry, shuttle seat, parking slot | required when access or entry needs one |
| `conditions` | road bans, closures, water quality postings, lift status | required for lakes, viewpoints by road or lift, swim spots |
| `timetable` | shuttle or bus timetable | required when access is by shuttle or transit |
| `tourism_board` | the valley or city tourism page | checklist |
| `accessibility` | the site's access statement | checklist for sights |
| `osm` | node, way or relation | checklist |
| `wikidata`, `wikipedia` | identity; facts paraphrased | checklist |
| `commons` | the Commons category | checklist |
| `webcam` | live camera | checklist for lakes and viewpoints |
| `trip_report`, `video` | dated | checklist |
| `navigation` | generated from the "arrive at" point | always shown |

## 4. Access

The subject point and the access points are separate entities ([../kinds/README.md](../kinds/README.md)
section 5). For every sight the lane records:

| Item | Where it lives | Rule |
|---|---|---|
| where you stand | `entity.point` | the viewpoint, the jetty, the museum entrance; never a polygon centroid or a street geocode |
| where you leave the car | parking entity, `parks_for` with `walk_min` and metres | one per lot; capacity, fee, fills-by per [../kinds/parking.md](../kinds/parking.md) |
| the shuttle or bus | shuttle stop entity, `serves`; the shuttle `offer` | first arrival and last departure per season |
| the lift | lift entity, `serves` | last descent |
| the walk | `attrs.walk_from_access` `{m, min, gain_m, surface, steps, stroller}` | from OSM paths (`agent_inferred`) or the source |
| access restrictions | `hours` periods and `condition_report` | Braies road barred to cars 09:00-16:00 without a slot, 1 Jul - 15 Sep; Alpe di Siusi uphill 09:00-17:00 |
| car-free centres | `attrs.access_note`, ZTL hours | park outside the gates |

**Coordinates never come from Google Maps** (trails.md section 4 applies unchanged). Source order:
OSM (`tourism=viewpoint`, `waterway=waterfall`, `natural=beach`, `entrance=main`, `amenity=parking`),
then the agency's data or map, then a person's pin over imagery. When OSM has several candidate nodes
(three viewpoint nodes at Moraine Lake's Rockpile, within about 100 m), a person picks one and sets
`point_checked`.

## 5. Required fields

The full lists, formats, examples and the Draft / Usable / Complete checks are in each profile. The
fields every sight needs before it can go into a day plan (Usable):

| Field | Format | Notes |
|---|---|---|
| `name`, `subkind`, `area_id`, `point`, `point_source` | [../kinds/README.md](../kinds/README.md) section 3 | Draft |
| `summary` | our words, 1-3 sentences | why go, named precisely |
| access | relation(s) or `attrs.access_note` | section 4 |
| `attrs.walk_from_access` | m, min, gain, surface, stroller | not for drive-up sights with a 50 m walk: `{m: 50}` |
| `duration_min`, `duration_max` | minutes on site | |
| `season` | season structure with `applies_to` | the access season for lakes and lift viewpoints |
| `hours` | hours structure with `last_entry`, `last_up`/`last_down`, `closed_days`, `breaks`, `closures` | or `always_open` |
| fee | `free`, or an `offer` with bands, currency, `applies_to`, `read_on` | |
| reservation | `none`, `recommended`, `required`; the `offer` window with tz and `sellout` when not `none` | |
| kind-specific | lake: `swimming`; viewpoint: `viewpoint_bearing`, `light`, `safety`; waterfall: `safety`, `flow`; sight: `visit_mode`, `indoor`; swim spot: `water`, `swimming`, `supervision`, `entry`, `hazards` | per profile |

## 6. Optional fields (Complete)

| Field | Unit / values |
|---|---|
| `attrs.best_time` | light windows (`attrs.light`, computed) plus dated crowd windows |
| `attrs.viewpoint_bearing` | degrees, or a list for a panorama |
| `attrs.photo_spot` | point and note |
| `attrs.crowds` | `{peak_hours, quiet_hours, weekday_vs_weekend, source}` |
| `attrs.facilities` | toilets, cafe, lockers, pushchair parking, picnic |
| `attrs.kid_note` | our words |
| `eligibility.accessibility` | `step_free`, `partial`, `none`, with a note |
| `attrs.rainy_day_ok`, `attrs.indoor` | bool |
| `attrs.pass_covers` | relation `covered_by` to pass offers |
| `attrs.drone_rules` | as stated by the land manager |
| `attrs.water_temp_c` | by month, with source |
| `attrs.water_level_note` | lakes that drain by late summer |
| `attrs.dress_code`, `attrs.photo_rules` | churches, museums |
| `attrs.languages` | tours, audio guides |
| `attrs.heritage` | UNESCO or national listing |

## 7. Computed values (mark `agent_inferred`)

- **Light**: `core/src/sun` for the point and `viewpoint_bearing`, giving front-lit, side-lit and
  back-lit windows per month (method/README.md R12). Never from memory; longitude is positive east.
- **Walk from access**: shortest OSM path from the access point to `point`, with gain from a DEM.
- **Duration** when no source gives one: from the walk plus a stated on-site time, labelled computed.
- **Access window**: the intersection of the site's hours, the access hours (road ban, last shuttle,
  last lift) and the light window, shown on the day plan.

## 8. Sources, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Land manager or site operator (Parks Canada, NPS, Ontario Parks, the museum, the castle, the municipality) | access rules, hours, prices, timed entry, swimming bans |
| 2 | Transport and access operators (Parks Canada shuttle, braies.bz, südtirolmobil, auronzo.info, the lift company) | shuttle and lift times, booking windows, fares |
| 3 | Official tourism boards (south-tirol.com, val-gardena.net, dreizinnen.com, gostowe) | season lists, facilities, passes |
| 4 | Heritage bodies, public health and environment agencies | listings, water quality |
| 5 | Wikidata | identity, names, height of waterfalls (as `community`) |
| 6 | OpenStreetMap | points, entrances, viewpoints with `direction`, fences, toilets; `opening_hours` as a hint only |
| 7 | Wikimedia Commons (one sequential runner) | geotagged photos that confirm where the classic view is |
| 8 | Dated community reports (within two seasons) | crowds, real duration, whether the view is real, water temperature |

Google Maps, TripAdvisor and resellers are never sources (../sources-and-licences.md).

## 9. Evidence rules

| Field | Minimum evidence |
|---|---|
| hours, closed days, last entry, last lift | `official` or `operator`, read within 180 days; OSM `opening_hours` alone fails |
| prices and age bands | `official` or `operator` with `applies_to` and `read_on` |
| access restrictions (road bans, shuttle-only) | `official` |
| booking windows and sell-out | window `official` or `operator`; sell-out may be `community` with two dated reports |
| swimming banned or unsafe | `official` |
| water quality | the agency posting, dated |
| summary, payoff | our words with at least one source |
| light, walk, duration | computed (`agent_inferred`) or `community` |
| crowds | `community`, dated |
| user assumptions | verified, never inherited ("the Stowe gondola was actually operating") |

## 10. Splitting and identity

- **Viewpoint or trail**: more than about 1 km or 30 minutes of walking from the access point makes it
  the payoff of a trail ([../kinds/viewpoint.md](../kinds/viewpoint.md) section 1).
- **Lake and swim spot**: a beach with its own facilities on a lake is a swim spot related to the lake.
- **One lift line per ticket**: Ortisei-Furnes-Seceda is one lift; the Fermeda chairlift at the top is
  another.
- **Same name, two places**: Moss Glen Falls in Stowe and in Granville are two entities with their
  towns shown in the name; dedupe by point (500 m) before name.
- **Renamed or replaced attractions**: `retire` the old entity with a `merge` pointer; never edit the
  name in place without evidence.

## 11. Leave empty

- Hours from OSM tags alone, from a search snippet, or from memory.
- Prices without a read date and a season.
- "Best time" without a light computation or a dated crowd source.
- The bearing when no tag, imagery or geotagged photo supports it.
- Swimming "allowed" because nobody said it was banned.
- Future-year dates (shuttle seasons, lift seasons): carry the read year in `applies_to`.
- A point copied from a Google link (the legacy Rockies `map_url` fields are name searches; they
  become gaps, not points).

## 12. Freshness

Hours and closed days 180 days; prices 120 days; season and access rules 365 days; booking windows
365 days and before the next window; closures and water quality 7 days (the conditions check);
summaries 2 years; light recomputed on any point or bearing change; links 90 days; points never.

## 13. Traps (all from this repo's research)

| Trap | Where |
|---|---|
| Shuttle-only lake | Moraine Lake (legacy/canadian-rockies-sept-2029/data/sights.json) |
| Road closed to cars mid-day without a slot | Braies (research/trips/dolomites-july-2027/transport.md 2.1); Alpe di Siusi (same file) |
| Back-lit lookout | Echo Rock until about 13:30 (research/trips/algonquin-muskoka-oct-2026/foliage-photo.md) |
| A tower that does not exist | Track and Tower Trail (repo CLAUDE.md, Algonquin entry) |
| A lake that does not exist | "Lac de Peclerey" (research/trips/chamonix-mont-blanc-sept-2028/trails.md line 142) |
| Two waterfalls with one name | Moss Glen Falls (research/trips/vermont-fall-2026/trails.md) |
| Closed Mondays | Museum Ladin (research/trips/dolomites-july-2027/sights.md line 372) |
| Guided-only castle | Castel Rodengo (dolomites sights.md) |
| Season sources disagree | Lagazuoi 6 Jun versus 30 May (dolomites sights.md line 65) |
| Time slots introduced | Seceda from summer 2026 (dolomites sights.md line 19) |
| Seven-month closure | Banff Upper Hot Springs (research/trips/canadian-rockies-sept-2029/adventure.md line 214) |
| Stored map links without points | legacy/canadian-rockies-sept-2029/data/sights.json `map_url` |
| The quiet substitute | Sorapis versus Lago di Limides; Seceda versus Col Raiser (dolomites sights.md) |

## 14. Example changeset (abridged)

Moraine Lake with its shuttle access. OSM ids read 18 Oct 2026; shuttle facts are 2026 from
legacy/canadian-rockies-sept-2029/data/sights.json.

```json
{
  "purpose": "sights lane: Moraine Lake",
  "changes": [
    { "op": "create", "target_kind": "entity", "temp_ref": "s1",
      "patch": { "kind": "place", "subkind": "lake", "name": "Moraine Lake", "area_id": "area_lake_louise",
        "point": [-116.18069, 51.32786], "point_source": "osm_node:348002838",
        "osm_ref": "way/356877446",
        "summary": "Glacier-fed lake in the Valley of the Ten Peaks; the Rockpile viewpoint is the classic photograph.",
        "duration_min": 90, "duration_max": 240,
        "season": [ { "from": "06-01", "to": "10-12", "status": "open", "note": "shuttle season", "applies_to": "2026" } ],
        "attrs": { "access_note": "Moraine Lake Road is closed to personal vehicles; Parks Canada shuttle or a commercial tour",
          "shore_walk": { "km": 2.6, "loop": false, "note": "lakeshore 1.3 km one way" } } },
      "evidence": [
        { "field": "attrs.access_note", "value": "closed to personal vehicles",
          "source": { "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise", "publisher": "Parks Canada", "kind": "official" },
          "observed_on": "2026-10-12", "applies_to": "2026",
          "quote": "Private vehicles not allowed on Moraine Lake Road year-round", "confidence": "official" },
        { "field": "point", "value": [-116.18069, 51.32786],
          "source": { "url": "https://www.openstreetmap.org/node/348002838", "publisher": "OpenStreetMap", "kind": "reference", "licence": "ODbL-1.0" },
          "observed_on": "2026-10-18", "quote": "one of three viewpoint nodes at the Rockpile end; a person must confirm which is the top", "confidence": "community" } ] },
    { "op": "create", "target_kind": "offer", "temp_ref": "o1",
      "patch": { "entity": "s1", "kind": "shuttle", "name": "Parks Canada Lake Louise and Moraine Lake shuttle",
        "currency": "CAD", "price_basis": "per_person", "price_read_on": "2026-10-12",
        "attrs": { "price_bands": [ { "band": "adult", "amount": 12.75 }, { "band": "youth", "amount": 4.00 } ], "online_fee": 3.50 },
        "window_rule": "fixed_date",
        "window_spec": { "opens_on": "2026-04-15", "opens_time": "08:00", "tz": "America/Edmonton", "share": 0.4 },
        "fallback": "remaining seats released 48 hours ahead", "sellout": null },
      "evidence": [ { "field": "window_spec", "value": "15 Apr 08:00 MT, 40%",
        "source": { "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise", "publisher": "Parks Canada", "kind": "official" },
        "observed_on": "2026-10-12", "applies_to": "2026", "quote": "opened 15 Apr 2026 8am MT, 40% of seats, rest released 48h ahead", "confidence": "official" } ] }
  ],
  "relations": [ { "from": "ent_lake_louise_park_and_ride_stop", "to": "s1", "kind": "serves" } ],
  "links": [
    { "entity": "s1", "kind": "official", "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise", "label": "Parks Canada: shuttles to Lake Louise and Moraine Lake" },
    { "entity": "s1", "kind": "osm", "url": "https://www.openstreetmap.org/way/356877446", "label": "OpenStreetMap" }
  ],
  "gaps": [
    { "target": "o1", "field": "attrs.price_bands[1].band", "reason": "youth age range not verified", "tried": ["parks.canada.ca parkbus page"] },
    { "target": "o1", "field": "sellout", "reason": "no dated report of how fast launch-day seats go", "tried": [] },
    { "target": "o1", "field": "url", "reason": "the booking page itself was not recorded in the research", "tried": [] },
    { "target": "s1", "field": "attrs.swimming", "reason": "not stated", "tried": [] },
    { "target": "s1", "field": "attrs.walk_from_access", "reason": "shuttle stop point not yet in the catalog", "tried": [] }
  ],
  "summary": "1 lake, 1 shuttle offer; point needs a person to confirm which of three OSM viewpoint nodes; 5 gaps"
}
```

`propose` returns, for `s1`: `{"level": "draft", "passed": 10, "total": 29, "missing": [{"check":
"U4", "field": "attrs.walk_from_access"}, {"check": "U6", "field": "hours"}, {"check": "U8",
"field": "offer.sellout"}, {"check": "U9", "field": "attrs.swimming"}]}`
([../kinds/lake.md](../kinds/lake.md) section 12).
