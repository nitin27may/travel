# Kind profile: eatery (restaurant, cafe, bakery, market, grocery)

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method: [../lanes/food.md](../lanes/food.md).

## 1. What it is

Anywhere a plan buys food: restaurant, cafe, bakery, tea house, pub, bar, food truck, market,
grocery, supermarket, deli, winery, brewery, and huts without beds (`hut_kitchen`). Stored as
`entity.kind = eatery` with that subkind. Produced by the **food** lane. We do not compete with Google
on breadth (07-competitors.md section 5); an eatery earns a record because a plan needs it: the only
open place on a Monday, the bakery for the picnic, the supermarket for a self-catering base, the
tea house on the trail.

Separate entities: the hut it sits in when the hut has beds (then the kitchen is `attrs.day_visitors`
on the [hut](hut.md)); the trail it is on (`combo_with`); bookable experiences (tasting menu, cooking
class, food tour) as `offer` rows.

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `hours` | per weekday, seasonal periods, `tz`, kitchen close when earlier than closing | Tue-Sat 09:00-16:00 | |
| `attrs.closed_days` | weekdays; holiday rule (`closed_public_holidays`, `open`, `unknown`) | `["sun", "mon"]` | the Sunday and Monday closures that ruin a long weekend |
| `season` | open period; shoulder-season closing | `05-01..10-31` (example shape) | |
| `attrs.why` | one line: the dish, the view, the fact that it is the only open place | "sticky buns; hold Saturday's purchase for Sunday's hike" | |
| `cost_band` | 0-4 | `1` | |
| `attrs.payment` | `cash_only`, `card`, `card_min` | `cash_only` | |
| `attrs.reservation` | `none`, `recommended`, `required`, with lead time and channel | "phone preorder, 48 h notice" | |
| `attrs.kid_friendly` | `kids_menu`, `high_chairs`, `early_service` (from HH:MM), or `unknown` | `{early_service: "17:30"}` | dinner at 19:30 with a 6-year-old |
| `attrs.dietary` | as stated: `vegetarian`, `vegan`, `gluten_free`, `halal`, `kosher` | `["vegetarian"]` | the household's dietary needs |

Complete adds: `attrs.cuisine`, `attrs.signature_dishes`, `attrs.view`, `attrs.outdoor_seating`,
`attrs.price_examples` (with currency and read date), `attrs.takeaway`, `attrs.accessibility`,
`attrs.parking`, `attrs.local_specialty` (link to the area guide).

## 3. Location

`point` from OSM (`amenity=restaurant|cafe|pub|bar`, `shop=bakery|supermarket|deli`, with id) →
the venue's own address geocoded through Nominatim and checked → `manual_pin`. Never a Google
business pin. On a trail, the eatery's point is the building; the trail relates to it.

## 4. Link checklist

`official` (the venue's site or its official social page), `menu`, `booking`, `tourism_board`,
`osm`; Google Maps, Yelp and TripAdvisor never stored as sources and not on the checklist (the
generated navigation link is enough); `navigation` generated.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The venue's own site or official social page | hours, closed days, season, payment, reservation |
| 2 | Regional tourism board | season, which places are open in the shoulder month |
| 3 | Local press reviews | why go, signature dishes |
| 4 | OSM `opening_hours` | a hint only, never a planning value on its own |
| 5 | Phone, recorded as `operator` with the date | holiday hours |
| 6 | Dated community reports | real hours, queues |

Never stored from: Google, Yelp, TripAdvisor (ratings, reviews, hours snippets). A search snippet
that shows hours is `community` at best and is marked as a snippet.

## 6. People limits

None as rules. `kid_friendly` and `dietary` feed the household check (dietary needs on `person`).
Bars with age rules for children after a set hour record it in `eligibility.notes`.

## 7. Time and money

Hours per weekday with season, holiday rule, kitchen close; cost band; payment; reservation lead time
and window (tasting menus 30-90 days ahead are an `offer` with `window_rule`).

## 8. Never guess

Hours from memory or a search snippet; holiday opening; that it takes cards; ratings and review counts
(not ours to store); prices without dates.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus. U1 (summary) is satisfied by `attrs.why`.

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `hours` per weekday with `tz` | `operator`, read within 180 days |
| U4 | Usable | `attrs.closed_days` and the holiday rule (holiday rule SN ok) | `operator` |
| U5 | Usable | `cost_band` | `operator` menu or `community` |
| U6 | Usable | `attrs.payment` (SN ok) | `operator`, or two dated `community` reports |
| U7 | Usable | `attrs.reservation` | `operator` |
| C9 | Complete | `attrs.kid_friendly` (SN ok) | `operator` or `community` |
| C10 | Complete | `attrs.dietary` (SN ok) | `operator` |
| C11 | Complete | `attrs.cuisine` or `attrs.signature_dishes` | |
| C12 | Complete | `attrs.accessibility` (SN ok) | |
| C13 | Complete | `attrs.parking` or a `parks_for` relation, or `not_applicable` (on a trail) | |

C4 (photo) is `not_applicable` for groceries and supermarkets. Totals: Draft 5, Usable 8, Complete 14;
**27**.

Family checks F1-F12 from [suitability.md](../suitability.md) section 4 apply as marked in its stay, eatery column: F6 is Usable and F4 is Complete. They are counted like any other check and are in the totals above.


## 10. Freshness

Hours and closed days: 180 days. Season: 365 days. Payment and reservation: 365 days. Summaries: 2
years. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| A page that is last year's text | Henrietta's Pine Bakery says "closed starting Saturday Nov 1": 1 Nov 2026 is a Sunday, so it is 2025 text (research/trips/algonquin-muskoka-oct-2026/attractions.md line 125). The validator check: a weekday-date pair that does not match the claimed year marks the evidence stale |
| Closed on the two days of a long weekend | same bakery: Tue-Sat only, closed Sun and Mon on Thanksgiving weekend |
| Hours only from Yelp or search snippets | Erika's Bakery, Trading Bay Dining (same file lines 126, 131) |
| Holiday Monday unknown | Dwight Market (same file line 128) |
| A cafe that became packaged food only | Sunday Creek Cafe, Algonquin Visitor Centre (same file line 54) |
| Season end not published | Portage Store, "late April to mid-October" (same file line 57); Lake Agnes Tea House "closes at end of season: date GAP" (legacy/canadian-rockies-sept-2029/data/trails.json) |
| Cash only at altitude | Rifugio Vandelli (research/trips/dolomites-july-2027/trails.md 0.6) |

## 12. Worked example: Henrietta's Pine Bakery, Dwight

| Field | Value | Evidence |
|---|---|---|
| `subkind` | `bakery` | |
| `hours` | Tue-Sat 09:00-16:00, `tz` America/Toronto | henriettaspinebakery.ca, `operator` |
| `closed_days` | `["sun", "mon"]`; holiday rule `unknown` | same |
| `season` | `stale`: the page's closing notice is 2025 text; 2026 closing date not confirmed | same |
| `why` | sticky buns; buy on Saturday for Sunday's hike | ours |
| `reservation` | phone preorders, 48 hours notice, 705-635-2214 | `operator` |
| `cost_band` | 1 | `community` |
| `point` | pending: OSM lookup for 2868 Hwy 60, Dwight | |

Level once the point is recorded: **Draft · 10 of 27** (D1-D5, U1, U3, U4, U5, U7 pass; C4 applies,
since a bakery gets a photo). U2 fails because the season evidence is stale; U6
payment is missing. One phone call closes both.
