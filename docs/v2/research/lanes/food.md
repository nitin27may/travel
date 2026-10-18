# Lane: food

Status: draft (17 Oct 2026; required fields and sources made concrete 18 Oct 2026, aligned with
[../kinds/eatery.md](../kinds/eatery.md)).

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

The checks per level are in [../kinds/eatery.md](../kinds/eatery.md). An eatery is Usable (can go in
a day plan) when these are filled with evidence:

| Field | Format | Example |
|---|---|---|
| `name`, `subkind`, `area_id` | core fields | `bakery` |
| `point`, `point_source` | OSM `amenity` (restaurant, cafe, pub, bar) or `shop` (bakery, supermarket, deli); never a Google business pin | `osm_node:...` |
| `hours` | per weekday, seasonal periods, `tz`, kitchen close when earlier | Tue-Sat 09:00-16:00, America/Toronto |
| `attrs.closed_days` | weekdays, plus a holiday rule (`closed_public_holidays`, `open`, `unknown`) | `["sun", "mon"]`, `unknown` |
| `season` | open period with `applies_to`; shoulder-season closing | |
| `cost_band` | 0-4 | `1` |
| `attrs.why` | one line: the dish, the view, the only open place | "sticky buns for Sunday's hike" |
| `attrs.payment` | `cash_only`, `card`, `card_min` | `cash_only` |
| `attrs.reservation` | `none`, `recommended`, `required`, with lead time and channel | "phone preorder, 48 h notice" |

## 4. Optional fields

`attrs.cuisine`, `attrs.signature_dishes`, `attrs.reservation` (`none`, `recommended`, `required`, with
lead time and window), `attrs.kid_friendly` (kids' menu, high chairs, early service), `attrs.dietary`
(vegetarian, vegan, gluten-free, halal, kosher, as stated), `attrs.seasonal_open`, `attrs.cash_only`,
`attrs.view`, `attrs.outdoor_seating`, `attrs.price_examples` (with read date and currency),
`attrs.local_specialty` (link to the area guide's food list).

## 5. Sources, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The venue's own site or official social page | hours, closed days, season, payment, reservation, menu |
| 2 | Regional tourism board (explorehuntsville.ca, the valley boards) | which places are open in the shoulder month; seasonal opening |
| 3 | Local press reviews | why go, signature dishes |
| 4 | The venue by phone, recorded as `operator` with the date | holiday hours, cash rule |
| 5 | OSM `opening_hours` | a hint only, never a planning value on its own |
| 6 | Dated community reports | real hours, queues, kid-friendliness |

Google, Yelp and TripAdvisor are never stored as sources; a search snippet that shows hours is
`community` at best and is marked as a snippet (the Algonquin research marks these `[S]`).

## 6. Evidence rules

Hours and closed days: `operator`, read within 180 days; community only as a conflict. Reservation lead
time: `operator` or two dated community sources.

## 7. Leave empty

Ratings and review counts (not ours to store); prices without dates; hours from memory.

## 8. Freshness

Hours 180 days; closed days 180 days; seasonal opening 365 days; summaries 2 years.

## 9. Traps

Sunday and Monday closures in small towns (Henrietta's Pine Bakery, Dwight: Tue-Sat only, on a
Thanksgiving weekend; research/trips/algonquin-muskoka-oct-2026/attractions.md line 125); a page that
is last year's text (the same bakery's "closed starting Saturday Nov 1" is 2025 because 1 Nov 2026 is a
Sunday: check weekday-date pairs against the claimed year); hours only from snippets (Erika's Bakery,
same file line 126); shoulder-season closures (Portage Store "late April to mid-October", line 57);
kitchens closing at 21:00 in the Alps; hut kitchens cash-only (Rifugio Vandelli); supermarkets closed
on public holidays; the one grocery in a car-free village with short hours.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "f1",
  "patch": { "kind": "eatery", "subkind": "teahouse", "name": "Lake Agnes Tea House",
    "hours": { "daily": [["08:00","17:00"]] }, "season": [ { "from": "06-01", "to": "10-10", "status": "open" } ],
    "attrs": { "cash_only": true, "why": "Historic tea house at the lake, reached only on foot", "closed_days": [] } },
  "evidence": [ { "field": "attrs.cash_only", "value": true, "source": { "url": "https://...", "kind": "operator" }, "observed_on": "2026-10-17", "quote": "Cash only", "confidence": "operator" } ] } ],
  "relations": [ { "from": "f1", "to": "ent_lake_agnes_trail", "kind": "combo_with" } ] }
```
