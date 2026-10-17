# Lane: fares and costs

Status: draft (17 Oct 2026).

## 1. Purpose

Prices that let a party budget and choose: entry fees and passes (with "pays for itself after N visits"),
activity and transport prices, typical lodging bands, food cost anchors, fuel prices, flight fare
patterns for a route and month (not live fares), currency and card notes. Feeds `budget_line` estimates
and the pass comparison (01-domain-model.md 3.7).

## 2. Produces

Prices on `offer` rows (`price_min`, `price_max`, `currency`, `price_basis`, `price_read_on`,
`attrs.price_bands`); `offer` kind `pass` with `covered_by` relations; area-level `cost_anchors`
(`meal_casual`, `meal_mid`, `coffee`, `groceries_day`, `fuel_per_l`, `parking_day`) with read dates;
`fare_pattern` notes per route and month (`low`, `typical`, `high` ranges with sources and dates).

## 3. Required fields

Every price: amount or range, currency, basis, `price_read_on`, `applies_to` (season or year), source.

## 4. Optional fields

`attrs.discounts` (family, senior, youth age bands, online-only fee), `attrs.online_fee`, `attrs.tax_included`,
`attrs.tourist_tax`, `attrs.price_rises` (scheduled increases, e.g. Parks Canada "next increase 1 Jan
2028"), `attrs.payment` (cash, card, app).

## 5. Sources, in order

Operator and official price pages; government fee schedules; tourism boards; dated community reports;
fare-history tools as patterns only (never stored as quotes).

## 6. Evidence rules

`official` or `operator` for prices used in budgets; community prices only as `unverified` estimates.
Conversions to the home currency are computed at display time with a stored rate and date, never stored
as a price.

## 7. Leave empty

Live flight fares (out of scope); future-year prices; OTA prices.

## 8. Freshness

120 days, or when the season they describe ends.

## 9. Traps

Kids' age bands differing per operator; online booking fees; prices that rose on 1 January; "from"
prices that exclude mandatory extras; youth free entry (Parks Canada 0-17) assumed elsewhere.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "offer", "temp_ref": "pass1",
  "patch": { "kind": "pass", "name": "Parks Canada Discovery Pass (family/group)", "price_min": 167.5, "price_max": 167.5,
    "currency": "CAD", "price_basis": "per_vehicle", "price_read_on": "2026-10-12",
    "attrs": { "price_rises": "next scheduled increase reported 1 Jan 2028" } },
  "evidence": [ { "field": "price_min", "value": 167.5, "source": { "url": "https://parks.canada.ca/...", "kind": "official" }, "observed_on": "2026-10-12", "applies_to": "2026", "quote": "Family/group annual pass $167.50", "confidence": "official" } ] } ] }
```
