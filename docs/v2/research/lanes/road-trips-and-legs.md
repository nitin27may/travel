# Lane: road trips and legs

Status: draft (17 Oct 2026).

## 1. Purpose

Everything about getting between places: drive legs and their real times, where to stop (a break at
least every 2 hours, the household's own rule: "avoid long single stretches with nothing to break them
up"), seasonal roads and passes, ferries, borders, tolls and vignettes, fuel and EV charging, winter
tyres, cell dead zones, one-way rental fees, vehicle restrictions (2WD campers barred from F-roads).

## 2. Produces

- `leg_cache` rows (routing results, cached per cell pair and mode); legs of record with notes become
  `entity` kind `hub`? No: notable road segments are `entity` kind `place` subkind `scenic_road`, `pass`,
  `ferry_route`, `border_crossing`, with season and rules; ferries have `offer` rows (vehicle booking).
- Stops: `place` subkinds `rest_area`, `fuel`, `ev_charger`, `pullout`, `viewpoint`, plus food entities,
  related to roads by `along` (new relation kind, with km from the start).
- Rules per area in the area guide: driving side, speed norms, winter tyre law and dates, vignette,
  tolls, low-emission zones, border wait-time links.

## 3. Required fields

Road or pass: `name`, `shape` (line) or two end points, `season` (opening and closing pattern with
variability: "Trollstigen typically opens late May, varies with snow"), `attrs.restrictions` (vehicle
length, weight, trailer, 2WD), `attrs.status_url` (the road authority's live status page, as a
`conditions` link).

Ferry route: operator, ports (points), crossing minutes, frequency by season, vehicle booking `offer`
with window and sell-out.

Border crossing: point, hours, documents needed, wait-time link.

## 4. Optional fields

`attrs.tolls` (amount, currency, payment method, vignette), `attrs.fuel_gap_km` (longest stretch without
fuel), `attrs.ev_gap_km`, `attrs.cell_dead_zones` (segments), `attrs.winter_tyres` (required dates),
`attrs.chains`, `attrs.wildlife_risk` (dusk collisions), `attrs.scenic_notes` (which direction is better
for views and light), `attrs.price_arbitrage` (fuel cheaper on one side of a border), `attrs.one_way_fee`
(rental companies, for the region pair).

## 5. Sources, in order

Road authorities (511 services, Statens vegvesen, road.is, ASFINAG); ferry operators; border agencies
(CBSA, CBP wait times); rental company terms for one-way fees and road bans; OSM for geometry and
stations; EV networks' public maps (links); community for real driving times in peak traffic.

## 6. Evidence rules

Seasonal opening dates: `official` with the year read; stated as a pattern for future years. Routing
times come from the routing provider with `computed_at`; traffic-adjusted estimates are labelled.

## 7. Leave empty

Opening dates for future years as facts (they are patterns); toll prices without read date; "no fuel for
200 km" without a map source.

## 8. Freshness

Seasonal patterns 365 days; tolls 120 days; ferry schedules 365 days; road status 1 day (conditions
check only); routing cache 365 days.

## 9. Traps

Estimated legs never routed (the Norway plan marked its 1,740 km as GAP); holiday-weekend traffic
(Thanksgiving: leave by 13:30 or after 19:30); seasonal roads used as dependencies (Trollstigen treated as
a bonus, never a dependency); F-road bans; ferries needing vehicle reservations in summer; Mont Blanc
tunnel autumn closure.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "rd1",
  "patch": { "kind": "place", "subkind": "pass", "name": "Trollstigen", "area_id": "area_romsdal",
    "season": [ { "from": "05-25", "to": "10-15", "status": "open", "note": "pattern; opens when snow allows" } ],
    "attrs": { "restrictions": { "max_length_m": 13.1 }, "status_url": "https://www.vegvesen.no/trafikk" } },
  "evidence": [ { "field": "attrs.restrictions.max_length_m", "value": 13.1, "source": { "url": "https://...", "kind": "official" }, "observed_on": "2026-10-17", "quote": "Vehicles over 13.1 m not permitted", "confidence": "official" } ] } ] }
```
