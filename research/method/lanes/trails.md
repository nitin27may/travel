# Lane: trails

Status: draft (17 Oct 2026). The most detailed lane: trails are the core of most trips in this repo,
and the facts that ruin a hiking day (a full lot at 08:30, a closed section, a 900 m climb sold as
"moderate", a summit with no view) are all trail facts.

## 1. Purpose

Answer, for every trail a party might walk: **where it starts, how you get there and park, how long and
steep it is, what it is like underfoot, who can do it, when it is open and at its best, what can go
wrong, and where to read more.** Produce enough to place it on a day (time window, travel from base,
parking fill time) and to check it against each traveller.

Questions the lane must answer:
1. Where exactly is the trailhead, and which road and lot reach it? Is private parking allowed at all?
2. How many cars does each lot hold, what does it cost, how do you pay, and when does it fill by season
   and day of week? What happens when it is full (overflow, shuttle, tow zone)?
3. Distance, gain, loss, high point, shape, realistic time, local grade and house grade?
4. Exposure, scrambling, water crossings, snowfields, loose terrain?
5. Season and snow-free window; closures and restrictions now; where to check conditions on the day?
6. Who can do it: minimum age guidance, stroller, dogs, accessibility, group-size rules?
7. What is the payoff, and at what time of day is it best (light, crowds)?
8. What combines well with it, and what is the Plan B (weather, closure, too hard)?
9. Every useful link: official page, conditions page, OSM, track source, AllTrails and others (link only),
   trip reports, webcams.

## 2. Produces

| Record | Kind / subkind | Notes |
|---|---|---|
| The trail | `entity` kind `trail`, subkind `hike`, `walk`, `scramble`, `via_ferrata_approach`, `trek_stage`, `snowshoe`, `bike`, `paddle` | one record per route variant a person would choose (Sentinel Pass and Larch Valley can be one trail with a turnaround, or two; rule in section 9) |
| Trailhead | `entity` kind `place`, subkind `trailhead` | the point where walking starts; may serve several trails |
| Parking lot | `entity` kind `place`, subkind `parking` | one per lot; may serve several trailheads and sights |
| Shuttle stop | `entity` kind `place`, subkind `shuttle_stop` | when access is by shuttle (Moraine Lake) |
| Shuttle or parking reservation | `offer` kind `shuttle` or `permit` | with booking window and sell-out speed |
| Relations | `trailhead_of` (trailhead → trail), `parks_for` (parking → trailhead), `serves` (shuttle stop → trailhead), `part_of` (trail section → long route), `alternative_to` (family or Plan B option → trail), `combo_with` (trail ↔ trail or sight) | |
| Track | `track` (method/README.md R3) | geometry with source and licence |
| Links | `entity_link` rows (R2) | section 3 |
| Conditions | `condition_report` rows (R4) | closures, warnings, restrictions as of the read date |

## 3. Links: every link a trail can have

Each link is an `entity_link` with a `kind`, a label, a language, `link_only` (true when we may link but
must not copy content), the source row, and a `last_checked` date with `http_status` from the link
checker.

| `kind` | What | Required? | Rules |
|---|---|---|---|
| `official` | the land manager's page for the trail or its area (Parks Canada, NPS, Ontario Parks, a conservation authority, a regional park, a municipality, an Alpine club) | **required** when one exists; record a gap if none can be found | the primary source for distance, gain, season, rules |
| `conditions` | the page that reports closures and trail status (Parks Canada "trail conditions", NPS alerts, avalanche bulletin for winter routes) | **required** when one exists | read by the conditions check; never copy its content, record `condition_report` rows |
| `area_closures` | the area-wide closures page if separate | optional | |
| `osm` | OpenStreetMap relation or way (`https://www.openstreetmap.org/relation/<id>`) | recommended | the geometry source of choice; ODbL |
| `track_source` | where the stored geometry came from (OSM relation, the agency's GPX or GeoJSON, a manual GPX) | **required** when a `track` exists | licence on the `track` row |
| `gpx_download` | an agency's downloadable GPX or KML | optional | link; store only if the licence allows (Parks Canada open data, swisstopo) |
| `alltrails` | AllTrails trail page | optional, **link only** | never copy stats, reviews or photos; never scraped; never the only distance source |
| `komoot`, `gaia`, `outdooractive`, `wikiloc`, `fatmap` | other route platforms | optional, **link only** | same rule |
| `trip_report` | a recent report with date (blog, forum, club) | optional | community evidence for conditions, crowds, parking reality |
| `webcam` | a live camera at or near the route | optional | useful on the day |
| `map_sheet` | the official topo sheet (swisstopo, NRCan, USGS) or the park map PDF | optional | |
| `video` | an official or high-quality route video | optional | |
| `booking` | the reservation page for parking, shuttle or permit | **required** when access needs one | also produces an `offer` |
| `navigation` | deep links to the trailhead **and** to each parking lot, built from our stored point at render time, not stored: Google Maps place `https://www.google.com/maps/search/?api=1&query=<lat>,<lon>`, Google Maps directions `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>`, Apple Maps `https://maps.apple.com/?daddr=<lat>,<lon>` | generated, **always shown** when the point exists | the Google Maps URLs scheme is free and needs no key; it opens Google's app with our coordinates |

**Link checklist (required, added 18 Oct 2026).** The owner wants every trail link captured. A trail is not
complete until every `kind` above is either filled or recorded as `searched_none` with the date and the
query used (for example `wikiloc: searched_none 2026-10-18 "Sorapis" site:wikiloc.com`). The UI shows
`searched_none` kinds as "none found (checked 18 Oct 2026)", so a gap is visible and is not mistaken for
"nobody looked". AllTrails pages cannot be opened by the link checker (bot block); record them as
`found_in_search` with the search date instead of an HTTP status.

The former trip skill's rule stays: **AllTrails and an official source, never AllTrails alone.** Where
AllTrails and official figures disagree, the official figure is the value and the AllTrails link is shown
beside it; the difference is noted only if a community source explains it (different start point,
variant route).

## 4. Trailhead and parking

### Trailhead (`place/trailhead`)

| Field | Unit / values | Required |
|---|---|---|
| `name` | as signed on the ground | yes |
| `point` | WGS84, where walking starts, to 5 decimals | yes |
| `point_source` | `osm_node` (with id: `highway=trailhead`, a signpost `tourism=information` + `information=guidepost`, or the path's first node at the car park), `official` (agency dataset or map, with URL), `gps` (a person's recorded track), `manual_pin` (a person placed it on our map) | yes |
| `point_checked` | who confirmed it against the map and imagery, and when | yes before publishing |
| `access_road` | road name and type (`paved`, `gravel`, `4wd`, `seasonal`) | yes |
| `access_road_season` | season structure (R11): open from, to, gate times | when seasonal |
| `access_mode` | `car`, `shuttle_only`, `transit`, `boat`, `walk_in` | yes |
| `elevation_m` | metres | recommended |
| `facilities` | `toilets` (flush, pit, none, seasonal), `water`, `bins`, `info_board`, `bear_lockers`, `picnic` | recommended |
| `cell_coverage` | `good`, `patchy`, `none`, `unknown` | recommended |
| `notes` | our words: what to know arriving here | optional |

### Parking lot (`place/parking`)

| Field | Unit / values | Required |
|---|---|---|
| `name` | as signed or as the agency names it | yes |
| `point` | WGS84 of the lot entrance, to 5 decimals; `point_source` as for the trailhead (`osm_node`/`osm_way` with `amenity=parking`, `official`, `manual_pin`) | yes |
| `serves` | relation `parks_for` → trailhead(s) and sight(s), with walk minutes from lot to trailhead | yes |
| `capacity_cars` | integer, or a range with evidence (`~9` was the Vermont lot that decided a whole day) | recommended; gap if unknown |
| `capacity_rv` | integer or `none`; max vehicle length in m if posted | when relevant |
| `fee` | amount + currency + unit (`per_vehicle_day`, `per_hour`, `per_person`) or `free` | yes (free is a value) |
| `payment` | `machine_card`, `machine_coins`, `app` (name), `online_prebooked`, `pass_covers` (which pass), `honour_box` | recommended |
| `pass_covers` | which passes cover the fee (Parks Canada Discovery Pass, Ontario Parks seasonal, a conservation-authority membership) | when a pass applies |
| `reservation` | `none`, `required`, `recommended`; link to the `offer` with its booking window | yes |
| `fills_by` | a list of `{season: MM-DD..MM-DD, days: weekday/weekend/holiday, time: HH:MM, source}` | **recommended; the single most decisive parking fact** |
| `overflow` | where people go when full: a second lot, roadside (legal or tow zone), a park-and-ride | recommended |
| `shuttle_alternative` | relation `serves` from a shuttle stop, with the shuttle `offer` | when one exists |
| `hours` | gate open and close times, overnight allowed or not | recommended |
| `ev_charging` | count and type, or `none` | optional |
| `winter_access` | ploughed or not, months closed | when relevant |
| `accessible_spaces` | integer or `unknown` | recommended |
| `surface` | `paved`, `gravel`, `dirt` | optional |
| `notes` | our words (e.g. "the upper lot is staff only") | optional |

When access is shuttle-only (Moraine Lake Road closed to private vehicles year-round), the trailhead's
`access_mode` is `shuttle_only`, there is **no** parking lot at the trailhead, and the parking lot that
matters is the shuttle's park-and-ride, related by `serves`.

**Coordinates never come from Google Maps.** Google's terms forbid copying its map data (coordinates
included) into our database, and a Google pin is often the business or village, not where the walk starts.
Use OpenStreetMap first (Overpass within 2 km of the trail: `highway=trailhead`, `amenity=parking`, guideposts,
the path's start node), then the agency's data or map, then a person's pin on our map. Google Maps is used
only through the generated `navigation` links above, which hand our point to Google's app.

## 5. The trail: required fields

| Field | Unit / values | Notes |
|---|---|---|
| `name` | as the land manager names it; `names` for other languages | |
| `area_id` | the park, valley or town area | |
| `point` | the payoff (the lake, the pass, the summit), not the trailhead | the map pin |
| `trailhead` | relation `trailhead_of` from a trailhead entity | at least one; the start for point-to-point |
| `attrs.shape` | `out_and_back`, `loop`, `lollipop`, `point_to_point`, `network` | |
| `attrs.distance_km` | km, one decimal; round trip for out-and-back, total for loops, one way for point-to-point | |
| `attrs.gain_m` | metres of total ascent | |
| `attrs.time_h` | realistic moving time range for an average adult, `[min, max]` in hours | from the official source when given; else computed (section 7) and marked `agent_inferred` |
| `attrs.local_grade` | the land manager's grade as written (`Moderate`, `T2`, `Difficult`) + `attrs.local_system` (`parks-canada`, `sac`, `nps`, `yds`, `sepaq`, `uk`, `apn`, `dnt`, `other`) | |
| `attrs.house_grade` | 1-5 by `data/schema/difficulty-map.json`, with `attrs.house_basis` (`technical`, `effort`, `effort-only`) | computed from local grade and stats; reviewer may adjust |
| `season` | season structure (R11): open, limited, closed periods; `attrs.snow_free` `{from: MM-DD, to: MM-DD, confidence}` for mountain trails | |
| `sources` | at least one `official` evidence row for distance and gain, or a gap | |

## 6. The trail: optional fields

| Field | Unit / values |
|---|---|
| `attrs.loss_m` | metres of total descent (differs from gain on point-to-point; Romsdalseggen 970 up / 1,277 down) |
| `attrs.high_point_m`, `attrs.low_point_m` | metres |
| `attrs.max_grade_pct` | steepest sustained section, from the track and a DEM |
| `attrs.surface` | list: `paved`, `boardwalk`, `gravel`, `dirt`, `roots`, `rock`, `scree`, `snow` |
| `attrs.exposure` | `none`, `some` (drop-offs beside a wide path), `significant` (narrow path above a drop), `serious` (a fall would be fatal); with a note on where |
| `attrs.scrambling` | `none`, `hands_occasional`, `class_2`, `class_3`+ (YDS) or the SAC T-level |
| `attrs.fixed_aids` | chains, ladders, cables (and whether a via ferrata kit is needed) |
| `attrs.water_crossings` | count and type (`bridge`, `stepping_stones`, `ford`), seasonal danger |
| `attrs.snowfields` | likely until MM-DD; microspikes or axe needed |
| `attrs.navigation` | `waymarked`, `signed_junctions`, `cairns`, `route_finding` |
| `attrs.hazards` | list of `{kind, note, season}`: `bears` (grizzly, black), `avalanche`, `rockfall`, `heat`, `cold`, `lightning`, `ticks`, `cliff_edges_unfenced`, `river`, `tides`, `wildfire_area` |
| `attrs.restrictions` | list: `group_min` (Parks Canada group of four in grizzly areas, with dates), `dogs` (allowed, leash, banned), `bikes`, `drones`, `permit_required` (with the `offer`), `quota` |
| `attrs.dogs` | `allowed_leash`, `allowed_off_leash`, `banned`, `unknown` |
| `eligibility` | `min_age_guidance` (our recommendation with reason, never invented as a rule), `stroller` (`yes`, `jogging_stroller`, `no`), `carrier_ok`, `accessibility` (`step-free`, `partial`, `none`), `fitness` 1-5 |
| `attrs.kid_note` | our words on kids (the Rockies `child_note`: "too long and steep for a 6-year-old") |
| `attrs.payoff` | what you see and where (the Mt. Pisgah lesson: forested summit, view 0.4 mi beyond) |
| `attrs.light` | best-light windows computed with core/src/sun (timing lane, R12) |
| `attrs.crowds` | `{peak_hours, quiet_hours, weekday_vs_weekend, source}` |
| `attrs.water_sources`, `attrs.shade` | where; `full`, `partial`, `none` |
| `attrs.turnaround_points` | named points with distance and gain to each, for a shorter version (Lake Agnes before the Big Beehive) |
| `attrs.hut_or_teahouse` | relation to an eatery or stay entity, with its season and cash rule |
| `attrs.offline_maps_note` | whether common apps need a paid tier offline, and whether popular downloaded tracks cross a closed section |
| `combo_with` | relations to trails and sights that pair well on the same day, with a note |
| `alternative_to` | from the family alternative and the less-walking option (the Rockies `family_alternative_id`, `less_walking_alternative`) |
| `plan_b` | relation `alternative_to` with `attrs.reason` `weather`, `closure`, `too_hard`, `crowds` |

## 7. Computed values (mark `agent_inferred`)

- **Time** when no official time: Naismith-style, 4.5 km/h on the flat plus 1 hour per 600 m of gain,
  then a range of +0% to +30%; kids' time adds 50%. Stored as a range, labelled computed.
- **Gain and loss from a track**: from the `track` geometry and a DEM (Mapterhorn or similar); shown
  beside the official figure, never replacing it.
- **Light windows**: from `core/src/sun` for the trail's payoff point and facing direction; never from
  memory (the S1 longitude-sign bug moved times by 8 minutes per degree).
- **House grade**: from `data/schema/difficulty-map.json`; when stats suggest a higher effort grade than
  the local grade (a long "Moderate"), propose the higher house grade with basis `effort`.

## 8. Sources, in order

1. **The land manager**: national, state or provincial parks, forest service, conservation authority,
   regional or municipal parks, Alpine clubs for hut approaches. Their trail page, their conditions page,
   their open data (GPX, GeoJSON).
2. **Official tourism boards** for access, shuttles and parking where the park page is silent.
3. **OpenStreetMap** for geometry, trailhead and parking points, `sac_scale`, surface, access tags.
4. **Wikidata** for identity (QID) and names.
5. **Recent trip reports** (dated within 2 seasons) for parking fill times, crowds, conditions, payoff
   reality. Community confidence only.
6. **AllTrails, Komoot, Gaia, Outdooractive, Wikiloc**: links only, and only to check that the official
   figures refer to the same route.

## 9. Evidence rules

| Field | Minimum evidence |
|---|---|
| distance, gain, loss, grade | one `official` row, or a gap; community values attached only as conflicts |
| season and closures | `official` or the conditions page; read date within 7 days for anything a plan depends on soon |
| restrictions (group size, dogs, permits) | `official` |
| parking capacity, fee, reservation | `official` or `operator`; fills-by may be `community` with dated reports (at least two) |
| min-age guidance, kid note | our judgement as `agent_inferred` with the stats it rests on; never presented as a rule |
| geometry | `track` row with source and licence |
| payoff and light | community plus computed |

Splitting rule: one trail entity per route a person chooses at the trailhead. A shorter turnaround on the
same path is a `turnaround_points` entry, not a new trail; a different destination from the same
trailhead (Lake Agnes versus Plain of Six Glaciers) is a separate trail.

## 10. Leave empty

- Any number not stated by a source or computed by a documented method.
- Parking capacity guessed from satellite imagery (a gap with a note is better).
- Minimum age as a "rule" when the land manager sets none: use `min_age_guidance` with reasoning.
- Closure status older than 7 days for a plan within 14 days: re-read or leave for the conditions check.
- Group-size rules inferred from memory (the Rockies research marked the Larch Valley group-of-four as
  INFERENCE when the official page 404'd; that is the right behaviour).

## 11. Freshness

Trail stats 3 years; season 365 days; closures and conditions 7 days; parking fee 120 days; parking
fills-by 365 days; reservation windows 365 days (before the next window); links 90 days; geometry never
unless reported changed.

## 12. Traps (all from this repo's research)

- **Forested summit**: the "summit hike" with no view (Mt. Pisgah); record `payoff` precisely.
- **Same name, two places**: two Moss Glen Falls an hour apart; always name the area and check the point.
- **Lot of nine cars**: capacity and fill time decided the order of a whole day; never write "arrive early".
- **One-way versus round trip**: the Banff page lists one way; the research doubled it and said so.
- **Conflicting official figures**: Iceline 20.3 km/1,090 m versus 20.8 km/710 m; Stanley Glacier 4.9 km
  one way versus 8.4 km return. Record both.
- **Closed sections in downloaded tracks**: popular GPX files lead people into closed sections; note it.
- **Shuttle-only access**: Moraine Lake Road is closed to private vehicles; a parking lot there is wrong.
- **Group-size rules by date**: Parks Canada group-of-four restrictions apply in set windows.
- **Back-lit viewpoints**: Echo Rock is back-lit until about 13:30 (Algonquin plan); compute light.
- **Hiking ceiling per party**: the Norway plan cut 12-13 km routes for a 12 km ceiling; distance must be
  exact enough to apply it.

## 13. Example changeset (abridged)

```json
{
  "purpose": "trails lane: Lake Louise, Lake Agnes",
  "changes": [
    { "op": "create", "target_kind": "entity", "temp_ref": "th1",
      "patch": { "kind": "place", "subkind": "trailhead", "name": "Lake Louise Lakeshore trailhead",
        "area_id": "area_lake_louise", "point": [-116.2166, 51.4166],
        "attrs": { "access_road": "Lake Louise Drive (paved)", "access_mode": "car",
          "elevation_m": 1735, "facilities": { "toilets": "flush", "water": true } } },
      "evidence": [ { "field": "attrs.facilities.toilets", "value": "flush",
        "source": { "url": "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise", "publisher": "Parks Canada", "kind": "official" },
        "observed_on": "2026-10-17", "quote": "Washrooms at the lakeshore day-use area", "confidence": "official" } ] },
    { "op": "create", "target_kind": "entity", "temp_ref": "p1",
      "patch": { "kind": "place", "subkind": "parking", "name": "Lake Louise Lakeshore parking",
        "point": [-116.2150, 51.4170],
        "attrs": { "fee": { "amount": null, "currency": "CAD", "unit": "per_vehicle_day" },
          "reservation": "none",
          "fills_by": [ { "season": "06-15..09-15", "days": "all", "time": null } ],
          "overflow": "Park and Ride at the Lake Louise Ski Resort, Parks Canada shuttle",
          "accessible_spaces": null } } },
    { "op": "create", "target_kind": "entity", "temp_ref": "tr1",
      "patch": { "kind": "trail", "subkind": "hike", "name": "Lake Agnes Tea House",
        "area_id": "area_lake_louise", "point": [-116.2400, 51.4170],
        "season": [ { "from": "06-15", "to": "10-10", "status": "open", "note": "tea house season" } ],
        "attrs": { "shape": "out_and_back", "distance_km": 7.4, "gain_m": 385,
          "time_h": [2.5, 3.5], "local_system": "parks-canada", "local_grade": "Moderate",
          "house_grade": 2, "house_basis": "technical",
          "turnaround_points": [ { "name": "Mirror Lake", "distance_km": 5.4, "gain_m": 290 } ],
          "dogs": "allowed_leash", "hazards": [ { "kind": "bears", "note": "grizzly and black bear area" } ] },
        "eligibility": { "stroller": "no", "carrier_ok": true, "min_age_guidance": 5, "fitness": 2 } },
      "evidence": [ { "field": "attrs.distance_km", "value": 7.4,
        "source": { "url": "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise", "publisher": "Parks Canada", "kind": "official" },
        "observed_on": "2026-10-17", "applies_to": "2026",
        "quote": "Lake Agnes: 7.4 km return, 385 m elevation gain", "confidence": "official" } ] }
  ],
  "relations": [
    { "from": "th1", "to": "tr1", "kind": "trailhead_of" },
    { "from": "p1", "to": "th1", "kind": "parks_for", "attrs": { "walk_min": 5 } }
  ],
  "links": [
    { "entity": "tr1", "kind": "official", "url": "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise", "label": "Parks Canada: Lake Louise hikes" },
    { "entity": "tr1", "kind": "conditions", "url": "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking", "label": "Banff trail conditions and closures" },
    { "entity": "tr1", "kind": "alltrails", "url": "https://www.alltrails.com/...", "label": "AllTrails", "link_only": true }
  ],
  "gaps": [
    { "target": "p1", "field": "attrs.capacity_cars", "reason": "no official figure", "tried": ["parks.canada.ca Lake Louise parking page"] },
    { "target": "p1", "field": "attrs.fills_by[0].time", "reason": "only one undated community report", "tried": [] }
  ]
}
```

Values in this example illustrate the shape; the real run reads them fresh.
