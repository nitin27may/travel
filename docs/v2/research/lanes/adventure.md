# Lane: adventure

Status: draft (17 Oct 2026).

## 1. Purpose

Find the activities that make a trip memorable and pin down the facts that decide **who in the party
can do them and how to get a place**: ziplines, via ferrata, rafting, canyoning, glacier walks,
paragliding, heli-hikes, gondolas, cruises, horse rides, guided summits, kayaking, cycling tours,
wildlife tours, scenic flights. The current Rockies research found that **hard limits are the most
commonly missing fact**, and that they decide the plan (Norquay via ferrata 12+ and 40 kg; Kicking
Horse family float 8+ and 23 kg; Burgess Shale under 8 not allowed).

Questions:
1. Who runs it, what exactly is the product, and is there a family or easier version?
2. Minimum age, height and weight, maximum weight, fitness, swimming ability, accompanying-adult rules,
   waiver age, per **product**, not per operator.
3. Season window, days of the week, departure times, duration including check-in.
4. Booking window, channel, how fast it sells out, walk-up possibility.
5. Price per age band, what is included, extras (photos, transport, gear, park fees), currency.
6. Weather and cancellation policy, refund terms, minimum participants.
7. Where to meet, how long the transfer is, parking.
8. Safety notes worth knowing (certifications, recent incidents only from reputable sources).

## 2. Produces

| Record | Kind |
|---|---|
| The activity | `entity` kind `activity`, subkind from `ACTIVITY_TYPE` (boat-tour, cruise, kayak, canoe, rafting, glacier-walk, ice-trek, guided-hike, via-ferrata, climbing, canyoning, zipline, gondola, train, heli, scenic-flight, horse, cycling, wildlife, ...) |
| Each product | `offer` (kind `tour`, `ticket`, `rental`) per bookable variant, with its own `eligibility` (R5), price, booking window, slots |
| Operator | `attrs.operator` (name, website, phone); a separate operator entity only if it runs several activities in the area |
| Meeting point | `entity` place subkind `meeting_point` when different from the activity location; relation `starts_at` |
| Relations | `alternative_to` (family version), `combo_with`, `covered_by` (pass or bundle offer) |
| Links | `official` (operator product page), `booking`, `hours_rates`, `waiver`, `safety`, `conditions` (river level, avalanche, wind) |

## 3. Required fields

Activity: `name`, `subkind`, `area_id`, `point` (where it happens or starts), `attrs.operator`,
`season` (R11), at least one `offer`.

Offer (each product):
| Field | Unit / values |
|---|---|
| `name` | product name as sold ("Family Float", "Skyline route") |
| `eligibility.min_age` | years, or explicit `null` with evidence "no minimum stated" (different from unknown) |
| `eligibility.min_height_cm`, `max_height_cm` | cm or explicit null |
| `eligibility.min_weight_kg`, `max_weight_kg` | kg (convert from lb, note it) or explicit null |
| `eligibility.adult_required` | `none`, `under_N_with_adult`, `one_adult_per_N_children` |
| `duration_min` | total including check-in and transfers; `attrs.activity_min` for the activity itself |
| `price_min`, `price_max`, `currency`, `price_basis` (`per_person`, `per_group`, `per_boat`), `price_read_on` | plus `attrs.price_bands`: `[{band: 'adult 16+', amount}, {band: 'child 6-15', amount}, {band: 'under 6', amount: 0}]` |
| `window_rule` + `window_spec` | `anytime`, `fixed_date`, `rolling`, `monthly_release`, `lottery`, `same_day` with times and zone |
| `sellout` | `minutes`, `hours`, `days`, `weeks`, `rarely` |
| `url` | booking page |

## 4. Optional fields

| Field | Unit / values |
|---|---|
| `eligibility.fitness` | 1-5 with what it means here ("2 h of continuous paddling") |
| `eligibility.swim_required` | bool |
| `eligibility.waiver_signer_age` | years (often 18) |
| `eligibility.medical` | pregnancy, heart conditions, back problems, as stated |
| `eligibility.footwear` | required footwear, often decisive for via ferrata and glacier walks |
| `attrs.slots` | departure times by season `[{season, days, times: ['09:00','13:00']}]` |
| `attrs.min_participants` | integer; what happens if not met |
| `attrs.group_size_max` | integer |
| `attrs.included` | list: gear, guide, transport, photos, snacks, park entry |
| `attrs.extras` | list with prices |
| `attrs.weather_policy` | our paraphrase: who cancels, at what conditions, refund or rebook |
| `attrs.cancel_policy` | deadline and fee |
| `attrs.transfer` | from where, minutes |
| `attrs.what_to_bring` | list |
| `attrs.languages` | guiding languages |
| `attrs.private_option` | price and minimum |
| `attrs.accessibility` | as stated |
| `attrs.safety_notes` | certification body (ACMG, IFMGA, Paddle Canada), reputable incident notes with dates |
| `attrs.operating_check` | how to know on the day whether it runs (status page, phone) |

## 5. Sources, in order

1. Operator product page, hours-and-rates page, terms and conditions, waiver PDF.
2. The land manager when it licenses the activity (park permits for guides, via ferrata rules).
3. Official tourism board pages.
4. Reputable press and guidebooks for context.
5. Community reports (dated) for sell-out speed, real duration, crowding.
Resellers (GetYourGuide, Viator) only as `community` evidence for sell-out and as links, never as the
source of limits (they often copy stale limits).

## 6. Evidence rules

Hard limits need `operator` or `official` evidence on the product page or terms; a reseller or blog value
is attached as a conflict only. Prices need the read date and the season. A limit stated as "about 7"
(Athabasca IceWalks, sources disagreed between 6 and 7) is recorded as a conflict with both values.

## 7. Leave empty

Limits not found (record "no minimum stated" only when the operator explicitly says so, otherwise a gap);
2029 prices or hours (never project; carry the read year); refund terms not in the terms page.

## 8. Freshness

Hard limits 365 days; prices 120 days; season and slots 365 days; booking windows 365 days; weather
policy 365 days.

## 9. Traps

- Limits differ by product within one operator (Norquay: routes 12+ versus 14+).
- Pounds versus kilograms (40 lb = 18.1 kg made a 20 kg child a marginal pass).
- Programmes that stop before the trip's dates (Junior Explorer at Minnewanka ends about 31 Aug).
- Opening hours that contradict the weather plan (an activity that only runs mornings on a day planned
  as the afternoon weather slot).
- Free-child deals with conditions (one free child per paying adult, first 2 hours).
- Age measured on the activity date, not the booking date.

## 10. Example changeset (abridged)

```json
{
  "changes": [
    { "op": "create", "target_kind": "entity", "temp_ref": "a1",
      "patch": { "kind": "activity", "subkind": "via-ferrata", "name": "Via Ferrata Mt. Norquay",
        "area_id": "area_banff", "point": [-115.60, 51.20],
        "season": [ { "from": "06-20", "to": "10-10", "status": "open", "note": "2026 pattern" } ],
        "attrs": { "operator": { "name": "Banff Norquay", "url": "https://banffnorquay.com" } } } },
    { "op": "create", "target_kind": "offer", "temp_ref": "o1",
      "patch": { "entity": "a1", "kind": "tour", "name": "Explorer route",
        "eligibility": { "min_age": 12, "min_weight_kg": 40, "adult_required": "under_18_with_adult", "footwear": "closed hiking shoes" },
        "duration_min": 240, "currency": "CAD", "price_basis": "per_person",
        "window_rule": "anytime", "sellout": "days" },
      "evidence": [ { "field": "eligibility.min_age", "value": 12,
        "source": { "url": "https://banffnorquay.com/summer/via-ferrata/", "publisher": "Banff Norquay", "kind": "operator" },
        "observed_on": "2026-10-17", "quote": "Minimum age 12, minimum weight 40 kg", "confidence": "operator" } ] },
    { "op": "create", "target_kind": "offer", "temp_ref": "o2",
      "patch": { "entity": "a1", "kind": "tour", "name": "Skyline route",
        "eligibility": { "min_age": 14, "min_weight_kg": 40 } } }
  ],
  "gaps": [ { "target": "o1", "field": "attrs.weather_policy", "reason": "terms page not found" } ]
}
```
