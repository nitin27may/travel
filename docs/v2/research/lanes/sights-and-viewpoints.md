# Lane: sights and viewpoints

Status: draft (17 Oct 2026).

## 1. Purpose

The places people come to see and the places they look from: lakes, waterfalls, viewpoints, summits by
lift, canyons, glaciers, beaches, old towns, museums, churches, markets, historic sites, scenic drives'
pull-outs. Answer **what it is, why go, how long it takes, when it is best, how you get in, what it
costs, and whether it suits the party.**

## 2. Produces

`entity` kind `place` with subkinds: `lake`, `waterfall`, `viewpoint`, `summit`, `canyon`, `glacier`,
`beach`, `cave`, `town`, `old_town`, `museum`, `church`, `castle`, `market`, `historic_site`, `garden`,
`zoo`, `aquarium`, `science_centre`, `splash_pad`, `playground`, `picnic_area`, `pullout`. Offers for
tickets; parking lots and shuttle stops as in the trails lane (section 4 there applies to sights too).

## 3. Required fields

`name`, `subkind`, `area_id`, `point` (the thing itself), `summary` (why go, our words, 1-3 sentences),
`duration_min`/`duration_max` (realistic visit time), `season` (open periods or "year round"), `hours`
(or explicit "always open"), access (relation to parking, shuttle stop or transit; or `attrs.access_note`),
cost (`cost_band` and an offer when ticketed, or free), `sources`.

## 4. Optional fields

`attrs.best_time` (light, computed; crowds), `attrs.walk_from_parking` (metres, minutes, gain, surface),
`attrs.viewpoint_bearing` (degrees the view faces; feeds light computation), `attrs.photo_spot` (point,
note), `attrs.closed_days`, `attrs.last_entry`, `attrs.reservation` (`none`, `recommended`, `required`,
with offer), `attrs.rainy_day_ok`, `attrs.indoor`, `eligibility` (accessibility, stroller), `attrs.kid_note`,
`attrs.toilets`, `attrs.food_nearby`, `attrs.crowds`, `attrs.drone_rules`, `attrs.swimming`
(`allowed`, `banned`, `unsafe`, with water temperature by month when known).

## 5. Sources, in order

Land manager or site operator; official tourism board; Wikidata (identity, QID, coordinates); OSM
(points, opening_hours tag as a hint only); community for crowds and best time.

## 6. Evidence rules

Hours and prices: `official` or `operator` with read date. Assumptions the user brings are verified,
never inherited ("the Stowe gondola was actually operating"). Summary: our words with at least one source.

## 7. Leave empty

Hours from OSM tags alone for a plan; prices without a read date; "best time" without either a light
computation or a dated crowd source.

## 8. Freshness

Hours 180 days; prices 120 days; season 365 days; closures 7 days; summaries 2 years.

## 9. Traps

Day-of-week closures (museums on Mondays); seasonal last-entry times earlier than closing; viewpoints
reachable only by shuttle; renamed or replaced attractions; "the view" being 0.4 mi beyond the
marked point.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "s1",
  "patch": { "kind": "place", "subkind": "lake", "name": "Moraine Lake", "area_id": "area_lake_louise",
    "point": [-116.1773, 51.3217], "summary": "Glacier-fed lake in the Valley of the Ten Peaks; the Rockpile viewpoint is the classic photograph.",
    "duration_min": 90, "duration_max": 240,
    "season": [ { "from": "06-01", "to": "10-12", "status": "open", "note": "shuttle season, 2026 pattern" } ],
    "attrs": { "access_note": "Road closed to private vehicles year-round; Parks Canada shuttle or commercial tour", "viewpoint_bearing": 150 } },
  "evidence": [ { "field": "attrs.access_note", "value": "...", "source": { "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise", "publisher": "Parks Canada", "kind": "official" }, "observed_on": "2026-10-17", "quote": "Moraine Lake Road is closed to personal vehicles", "confidence": "official" } ] } ],
  "relations": [ { "from": "ent_moraine_shuttle_stop", "to": "s1", "kind": "serves" } ] }
```
