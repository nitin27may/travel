# Kind profile: adventure activity

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/adventure.md](../lanes/adventure.md).

## 1. What it is

Something you book and do with an operator, or rent gear for: zipline, via ferrata, rafting,
canyoning, glacier walk, boat tour or cruise, kayak or canoe rental, mountain coaster, paragliding,
heli-hike, horse ride, wildlife tour, guided summit, bike park. Stored as `entity.kind = activity`
with the subkind from `ACTIVITY_TYPE`, plus **one `offer` per product** (research/README.md R5).
Produced by the **adventure** lane. Lifts, cable cars and scenic trains have their own profile
([lift.md](lift.md)); spas and ticketed hot pools use [swim-spot.md](swim-spot.md).

Hard limits are the most commonly missing fact and they decide the plan: in the Rockies research no
minimum height was found for 42 of 43 adventures (repo CLAUDE.md, Rockies entry). So this profile is
strict about limits and about the difference between "none" and "not published".

Separate entities and rows:

| Thing | Stored as | Rule |
|---|---|---|
| each product (Family Float, Class III, Explorer route, Skyline route) | `offer` with its own `eligibility`, price, window | limits differ by product within one operator |
| the operator | `attrs.operator {name, url, phone}`; an operator entity only when it runs several activities in the area | |
| where you meet | trailhead profile, subkind `meeting_point`, relation `starts_at` | when it is not where the activity happens |
| the family version | another activity or offer, relation `alternative_to` | |
| a pass or bundle | `offer` kind `pass`, relation `covered_by` | |
| the lift you ride to start | [lift](lift.md) | lift tickets are usually not included |

## 2. Required fields

Activity:

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `subkind` | `ACTIVITY_TYPE` | `via-ferrata` | |
| `point` | where it starts or happens | Loen Active base in Loen | the navigation target |
| `attrs.operator` | `{name, url, phone}` | Loen Active | who to call when the page is silent |
| `season` | season structure, `applies_to` | `06-01..09-30` (example shape) | runs on the trip's dates or not |
| `hours` / `attrs.slots` | departures by season: `[{season, days, times: ["09:00","10:00","11:00"]}]` | daily 09:00, 10:00, 11:00 in season | morning-only activities clash with the afternoon weather slot |
| `attrs.weather_dependent` | bool, with what cancels it (wind, river level, lightning) | `true`, "wind" | needs a Plan B day |
| `attrs.operating_check` | how to know on the day (status page, phone, app) | "call the base before 08:00" | |

Each offer (product):

| Field | Format | Example | Why it matters |
|---|---|---|---|
| `name` | as sold | `Via Ferrata Loen` | |
| `eligibility.min_age`, `max_age` | years; `none_stated` only when the operator says so; else `searched_none` | `12` (recommended) | measured on the activity date |
| `eligibility.age_rule` | `rule` or `recommendation` | `recommendation` | "recommended from 12" is not "minimum 12" |
| `eligibility.min_height_cm`, `max_height_cm` | cm | `105` (Gardonè coaster) | |
| `eligibility.min_weight_kg`, `max_weight_kg` | kg, one decimal, converted from lb with a note | `40`, `120` | harness limits are not negotiable |
| `eligibility.adult_required` | `none`, `under_N_with_adult`, `one_adult_per_N_children` | `under_18_with_adult` | |
| `duration_min` | minutes **including** check-in and transfers; `attrs.activity_min` for the activity itself | `240` | |
| price | bands `[{band, amount}]`, `currency`, `price_basis`, `applies_to`, `price_read_on` | `2380 NOK per_person, 2026` | |
| `window_rule`, `window_spec`, `sellout` | 01-domain-model.md 2.3 | `anytime`, `days` | when to book |
| `url` | booking page | | |

Complete adds per offer: `eligibility.fitness`, `swim_required`, `footwear`, `medical`,
`waiver_signer_age`; `attrs.included`, `attrs.extras`, `attrs.weather_policy`, `attrs.cancel_policy`,
`attrs.min_participants`, `attrs.group_size_max`, `attrs.languages`, `attrs.private_option`. Per
activity: `attrs.safety_notes` (certification body: ACMG, IFMGA, Paddle Canada, the Italian guide
colleges), `attrs.transfer`, `attrs.what_to_bring`, `alternative_to`.

## 3. Location

`point` is where the party presents itself: the operator's base, the meeting point, the lower station
of a coaster. When the activity happens elsewhere (a rafting put-in 40 minutes away), `point` is the
meeting point and `attrs.activity_point` (with `point_source`) is the put-in. Source order: OSM
(`shop`, `office=guide`, `leisure=*`, `aerialway` for coasters) → the operator's map or address
geocoded through Nominatim (OSM data) and checked → `manual_pin`. Not a Google business pin.

## 4. Link checklist

| Kind | Required? |
|---|---|
| `official` (the operator's product page) | required |
| `booking` | required |
| `hours_rates` | checklist |
| `terms` (T&C, cancellation, weather) | checklist |
| `waiver` | checklist |
| `safety` (certification or the land manager's licence) | checklist |
| `conditions` (river level, wind, avalanche) | required when `weather_dependent` |
| `tourism_board` | checklist |
| `osm` | checklist |
| `video` | checklist |
| `trip_report` | checklist |
| resellers (GetYourGuide, Viator, Civitatis) | optional, link only, never a source of limits |

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Operator product page, rates page, terms, waiver PDF | limits, prices, slots, policies |
| 2 | Land manager that licenses it (park permits for guides, via ferrata rules) | season, rules |
| 3 | Official tourism board | which operators exist, season |
| 4 | Phone or email to the operator, recorded as `operator` evidence with `method: phone` or `email` and the date | limits the site does not publish |
| 5 | Reputable press and guidebooks | context |
| 6 | Dated community reports | sell-out speed, real duration, crowding |
| 7 | Resellers | `community` evidence for sell-out only; their limits are attached as conflicts at most |

## 6. People limits

The household check (README section 8) runs per offer for every traveller on the item: age on the
activity date against `min_age`/`max_age`, height, weight against both ends, `adult_required` against
the party, `swim_required`, fitness. A `recommendation` age is reported as `marginal` rather than
`fail` for a child under it, with the operator's words. `searched_none` on any limit returns
`unknown` with "ask the operator" and the phone number. When a child fails, `check_trip` offers the
`alternative_to` product (Kicking Horse Class III → family float → the Bow River float).

## 7. Time and money

Season by product; departures by season and weekday; duration including check-in; price bands by age
with currency and read year; what is included (gear, guide, transport, park entry, lift tickets);
booking window and sell-out; weather and cancellation terms; minimum participants.

## 8. Never guess

Any limit (age, height, weight) not on the operator's page or terms, or confirmed by the operator;
whether a weight is a minimum or a maximum; future-year prices or hours (carry the read year);
refund terms; that "family" products accept a 6-year-old.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8 apply to the activity. Offers have their own checks (`O`), and the
activity's level depends on them.

Activity:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.operator` with name and url | `operator` |
| U4 | Usable | `hours` or `attrs.slots` for the season | `operator` |
| U5 | Usable | access: `point` is where you meet, or a `starts_at` meeting point; parking or transit note | `operator` |
| U6 | Usable | `attrs.weather_dependent` with what cancels it | `operator` or `community` |
| U7 | Usable | at least one offer is Usable | |
| C9 | Complete | every offer is Complete | |
| C10 | Complete | `attrs.safety_notes` (SN ok) | `official` or `operator` |
| C11 | Complete | `attrs.operating_check` | `operator` |
| C12 | Complete | `alternative_to` a family or easier option, or `not_applicable` | |
| C13 | Complete, when weather dependent | `conditions` link | |

Offer:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| OD1 | Draft | `name`, `kind`, parent activity | |
| OU1 | Usable | `min_age` with `age_rule`: value, `none_stated` or `searched_none` | `operator` or `official` only |
| OU2 | Usable | height limits: value, `none_stated` or `searched_none` | same |
| OU3 | Usable | weight limits: value (with min or max explicit), `none_stated` or `searched_none` | same |
| OU4 | Usable | `adult_required` | same |
| OU5 | Usable | `duration_min` including check-in | `operator` or `community` |
| OU6 | Usable | price bands with currency, `applies_to`, `price_read_on` | `operator` |
| OU7 | Usable | `window_rule` with `window_spec.tz`, and `sellout` | `operator`, `sellout` may be `community` |
| OU8 | Usable | booking `url` | |
| OC1 | Complete | every limit is a value or `none_stated` (no `searched_none` left): ask the operator | `operator` |
| OC2 | Complete | `weather_policy` | `operator` |
| OC3 | Complete | `cancel_policy` | `operator` |
| OC4 | Complete | `included` and `extras` | `operator` |
| OC5 | Complete | `min_participants` (or `none_stated`) | `operator` |
| OC6 | Complete | `fitness`, `swim_required`, `footwear`, `medical` as stated (SN ok) | `operator` |
| OC7 | Complete | `waiver_signer_age` (SN ok) | `operator` |

Totals: activity Draft 5, Usable 7, Complete 13 (**25**); each offer Draft 1, Usable 8, Complete 7
(**16**). The badge reads "Usable · 19 of 25 · offers 1 of 2 Usable".

## 10. Freshness

Hard limits: 365 days. Prices: 120 days. Season and slots: 365 days. Booking windows: 365 days and
before the next window. Weather and cancellation terms: 365 days. Safety notes: 2 years. Links: 90
days.

## 11. Traps

| Trap | Where |
|---|---|
| Limits differ by product | Norquay via ferrata 12+ versus Skyline and Summiteer 14+ (research/trips/canadian-rockies-sept-2029/adventure.md line 7) |
| A minimum weight stored as a maximum | Kicking Horse family float: "50 lb (23 kg) is a MINIMUM weight", stored as `max_weight_kg: 22.7` (same file line 136; legacy/canadian-rockies-sept-2029/data/adventures.json) |
| Pounds rounding to a marginal pass | 40 lb = 18.1 kg against a 20 kg child (same file line 9) |
| Sources disagree on the age | Athabasca IceWalks "about 7", some say 6 (same file line 12); one Banff Adventures page says 6+ for a product listed 8+ (line 136) |
| A recommendation read as a rule | Via Ferrata Loen "recommended from age 12" (research/trips/norway-summer/sights.md line 72) |
| Height limit never published | 42 of 43 Rockies adventures (repo CLAUDE.md); Funbob San Candido height GAP (research/trips/dolomites-july-2027/adventure.md line 65) |
| Guide pricing per group, not per person; lifts not included | Dolomites guided via ferrata EUR 380-500 per group, 3-4 per guide (dolomites adventure.md lines 23-30) |
| Weather and refund terms are the recurring gap | dolomites adventure.md line 139 |
| Operator sites return only menus to the fetcher | Patagonia: hieloyaventura.com and piratour.com.ar (research/trips/patagonia-feb-mar-2027/adventure-2.md line 6) |
| Same company, many spellings | Piratour, PiraTour, Pira Tour (patagonia adventure-2.md line 87) |
| A programme that ends before the trip | Junior Explorer at Minnewanka (lanes/adventure.md section 9) |

## 12. Worked example: Via Ferrata Loen (Norway)

From research/trips/norway-summer/sights.md line 72 (GAP CLOSED 2026-08-31).

| Field | Value | Evidence |
|---|---|---|
| activity `subkind` | `via-ferrata` | |
| `point` | pending: the Loen Active base in Loen village (OSM lookup) | |
| `attrs.slots` | daily in season 09:00, 10:00, 11:00, `tz` Europe/Oslo | operator |
| offer `name` | Via Ferrata Loen (instructor, equipment and Loen Skylift descent included) | operator |
| price | 2,380 NOK per person; the ferrata + zipline package costs the same | operator, read 2026 |
| `min_age` | 12, `age_rule: recommendation` | operator |
| weight | `min_weight_kg` 40, `max_weight_kg` 120, set by the harness and lanyard system | operator |
| height | `searched_none` ("no published height limit") | operator page |
| `what_to_bring` | 1.5 l water per person, gloves, long trousers, windproof; shoes and gloves rentable | operator |
| window, sellout, weather policy, cancel policy, duration | gaps | |

Offer: **Draft · 6 of 16** (OD1, OU1, OU2, OU3, OU6, OU8 pass; OU4 adult rule, OU5 duration and OU7
window missing). Activity: Draft until the point is recorded and OU4, OU5, OU7 close; then U7 passes
and it is Usable. For a 12-year-old of 38 kg the household check returns `fail` on weight, whatever
the age.
