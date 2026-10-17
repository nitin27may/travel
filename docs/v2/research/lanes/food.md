# Lane: food

Status: draft (17 Oct 2026).

## 1. Purpose

Where to eat and buy food, with the **day-of-week and hours gotchas** that ruin evenings (the restaurant
closed on the one night you need it), signature local dishes, markets, groceries for self-catering and
picnics, and food at huts and trailheads. We do not compete with Google on restaurant breadth
(07-competitors.md section 5): depth goes to what a plan needs.

## 2. Produces

`entity` kind `eatery`, subkinds `restaurant`, `cafe`, `bakery`, `bar`, `pub`, `teahouse`, `hut_kitchen`,
`food_truck`, `market`, `grocery`, `supermarket`, `deli`, `ice_cream`, `winery`, `brewery`, `distillery`.
Offers only for things booked ahead (tasting menus, cooking classes, food tours).

## 3. Required fields

`name`, `subkind`, `point`, `area_id`, `hours` (structured per weekday with seasonal variants),
`attrs.closed_days`, `cost_band`, `attrs.why` (one line: the dish, the view, the fact that it is the only
open place), `sources`.

## 4. Optional fields

`attrs.cuisine`, `attrs.signature_dishes`, `attrs.reservation` (`none`, `recommended`, `required`, with
lead time and window), `attrs.kid_friendly` (kids' menu, high chairs, early service), `attrs.dietary`
(vegetarian, vegan, gluten-free, halal, kosher, as stated), `attrs.seasonal_open`, `attrs.cash_only`,
`attrs.view`, `attrs.outdoor_seating`, `attrs.price_examples` (with read date and currency),
`attrs.local_specialty` (link to the area guide's food list).

## 5. Sources, in order

The venue's own site or social page for hours; regional tourism; local press reviews; OSM
`opening_hours` as a hint; community for real hours and queues. Google, Yelp and TripAdvisor content is
never stored; links to the venue page only.

## 6. Evidence rules

Hours and closed days: `operator`, read within 180 days; community only as a conflict. Reservation lead
time: `operator` or two dated community sources.

## 7. Leave empty

Ratings and review counts (not ours to store); prices without dates; hours from memory.

## 8. Freshness

Hours 180 days; closed days 180 days; seasonal opening 365 days; summaries 2 years.

## 9. Traps

Sunday and Monday closures in small towns; shoulder-season closures; kitchens closing at 21:00 in the
Alps; hut kitchens cash-only; supermarkets closed on public holidays; the one grocery in a car-free
village with short hours.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "f1",
  "patch": { "kind": "eatery", "subkind": "teahouse", "name": "Lake Agnes Tea House",
    "hours": { "daily": [["08:00","17:00"]] }, "season": [ { "from": "06-01", "to": "10-10", "status": "open" } ],
    "attrs": { "cash_only": true, "why": "Historic tea house at the lake, reached only on foot", "closed_days": [] } },
  "evidence": [ { "field": "attrs.cash_only", "value": true, "source": { "url": "https://...", "kind": "operator" }, "observed_on": "2026-10-17", "quote": "Cash only", "confidence": "operator" } ] } ],
  "relations": [ { "from": "f1", "to": "ent_lake_agnes_trail", "kind": "combo_with" } ] }
```
