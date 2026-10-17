# Lane: relax and luxury

Status: draft (17 Oct 2026).

## 1. Purpose

The slow and the special: spas, hot springs, thermal baths, fine dining and chef's tables, scenic trains,
private tours and guides, boat charters, sunset cruises, wine estates with tastings, scenic flights as an
experience, beach clubs. Answer **what the experience actually includes, what it costs, how far ahead to
book, and what the upgrade buys over the standard option.**

## 2. Produces

`entity` kind `activity` (subkinds `spa`, `hot_spring`, `thermal_bath`, `scenic_train`, `private_tour`,
`charter`, `sunset_cruise`, `tasting`, `cooking_class`) or `eatery` (`fine_dining`, `chefs_table`) with
offers per product (day pass, treatment, menu, private versus shared).

## 3. Required fields

`name`, `subkind`, `point`, `season`, `hours`, at least one offer with price band, currency, read date,
`window_rule` and `sellout`; `attrs.includes` (what you actually get); `attrs.dress_code` when one applies.

## 4. Optional fields

`eligibility` (spa minimum age, often 16 or 18; adults-only hours), `attrs.private` (true private or
small group, maximum size), `attrs.upgrade_over` (relation to the standard option and what it adds),
`attrs.view`, `attrs.best_time` (sunset slot, computed), `attrs.cancel_policy`, `attrs.deposit`,
`attrs.dietary_handling` (tasting menus), `attrs.transfer_included`.

## 5. Sources, in order

Operator pages and terms; official tourism; reputable press (guides with dated reviews); community for
whether "private" is private and whether the view is real.

## 6. Evidence rules

Prices and inclusions `operator` with read date; age rules `operator`; "private" claims checked against
terms (maximum group size).

## 7. Leave empty

Star ratings from aggregators; prices from resellers; "romantic" without a concrete feature.

## 8. Freshness

Prices 120 days; inclusions 365 days; booking windows 365 days (tasting menus often 30-90 days ahead).

## 9. Traps

Spa minimum ages that exclude a 15-year-old; "private tour" with up to 8 people; sunset cruise slots that
are not at sunset on the actual dates (compute); scenic trains whose views are on one side only (seat
side matters); hot springs closed for maintenance weeks.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "r1",
  "patch": { "kind": "activity", "subkind": "hot_spring", "name": "Banff Upper Hot Springs",
    "attrs": { "includes": "pool entry; towel and swimsuit rental extra" } } },
  { "op": "create", "target_kind": "offer", "temp_ref": "ro1",
    "patch": { "entity": "r1", "kind": "ticket", "name": "Adult entry", "currency": "CAD", "window_rule": "anytime", "sellout": "rarely",
      "eligibility": { "min_age": null } } } ],
  "gaps": [ { "target": "ro1", "field": "price_min", "reason": "official rates page not read" } ] }
```
