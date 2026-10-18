# Lane: adventure

Status: draft (17 Oct 2026; deepened 18 Oct 2026 to the depth of [trails.md](trails.md) and aligned
with [../kinds/adventure.md](../kinds/adventure.md) and [../kinds/lift.md](../kinds/lift.md)).

## 1. Purpose

Find the activities that make a trip memorable and pin down the facts that decide **who in the party
can do them and how to get a place**: ziplines, via ferrata, rafting, canyoning, glacier walks,
paragliding, heli-hikes, mountain coasters, gondolas and cable cars, cruises and boat tours, canoe and
kayak rental, horse rides, guided summits, cycling tours, wildlife tours, scenic flights. The Rockies
research found that **hard limits are the most commonly missing fact**, and that they decide the
plan (Norquay via ferrata 12+ and 40 kg; Kicking Horse family float 8+ and 23 kg; Burgess Shale
under 8 not allowed); no minimum height was found for 42 of 43 adventures.

Questions:
1. Who runs it, what exactly is each product, and is there a family or easier version?
2. Per **product**: minimum and maximum age (rule or recommendation), height, weight (minimum or
   maximum, in which unit), adult-accompaniment rules, fitness, swimming, footwear, waiver age.
3. Season window by product, days of the week, departure times, duration including check-in.
4. Booking window and channel, how fast it sells out, walk-up possibility.
5. Price per age band, what is included (gear, guide, transport, lift tickets, park fees), currency,
   the season it was read for.
6. Weather and cancellation policy, refund terms, minimum participants.
7. Where to meet, where it actually happens, transfer time, parking.
8. Safety: certification body, the land manager's licence, reputable incident notes with dates.
9. How to know on the day that it runs.

## 2. Produces

| Record | Kind | Notes |
|---|---|---|
| The activity | `entity` kind `activity`, subkind from `ACTIVITY_TYPE` (`boat-tour`, `cruise`, `kayak`, `canoe`, `rafting`, `glacier-walk`, `ice-trek`, `guided-hike`, `via-ferrata`, `climbing`, `canyoning`, `zipline`, `coaster`, `paragliding`, `heli`, `scenic-flight`, `horse`, `cycling`, `bike-park`, `wildlife`) | profile [../kinds/adventure.md](../kinds/adventure.md) |
| Lifts, cable cars, scenic trains | `activity` / `gondola`, `cable_car`, `chairlift`, `funicular`, `rack_railway`, `scenic_train` | profile [../kinds/lift.md](../kinds/lift.md) |
| Each product | `offer` (kind `tour`, `ticket`, `rental`) per bookable variant, with its own `eligibility` (R5), prices, window, slots | "Family Float" and "Class III" are two offers |
| Operator | `attrs.operator {name, url, phone}`; an operator entity only when it runs several activities in the area | |
| Meeting point | `entity` place subkind `meeting_point` when it differs from where the activity happens; relation `starts_at` | |
| Activity location | `attrs.activity_point` with `point_source` (the put-in, the ferrata start) when `point` is the meeting point | |
| Relations | `alternative_to` (family or easier version), `combo_with`, `covered_by` (pass or bundle), `serves` (lift → trailhead or viewpoint) | |
| Links | section 3 | |
| Conditions | `condition_report` rows: river level warnings, wind closures, operator status | |

**Splitting rule.** One activity per thing a person would name ("Via Ferrata Loen"); one offer per
product with its own limits or price (route grades, family versus standard, private versus shared).
A resold bundle (lift plus ferrata plus lunch) is an offer on the main activity with `covered_by`
relations, not a new activity.

## 3. Links

| `kind` | What | Required? |
|---|---|---|
| `official` | operator product page | required |
| `booking` | the booking page | required |
| `hours_rates` | rates and season page | checklist |
| `terms` | T&C: cancellation, weather, refund | checklist |
| `waiver` | the waiver PDF (often states limits) | checklist |
| `safety` | certification or the land manager's licence page | checklist |
| `conditions` | river level, wind, avalanche bulletin | required when `weather_dependent` |
| `status` | live running status (lifts, boats) | checklist for lifts and boats |
| `tourism_board` | listing on the official board | checklist |
| `osm` | the route (via ferrata `highway=via_ferrata` ways and relations), the base, the station | checklist |
| `video`, `trip_report` | dated | checklist |
| reseller pages | GetYourGuide, Viator, Civitatis | optional, link only; never evidence for limits |
| `navigation` | generated to the meeting point | always |

## 4. Meeting point, location and access

| Item | Rule |
|---|---|
| `point` | where the party presents itself: the operator base, the meeting point, the lift valley station |
| `attrs.activity_point` | where it happens when that is elsewhere, with `point_source` (OSM via ferrata relation, river put-in) |
| meeting point entity | when shared by several operators or far from the base; `starts_at` |
| `attrs.transfer` | from the meeting point to the activity: minutes and mode |
| `attrs.check_in_min` | how early the operator wants you |
| parking | a [parking](../kinds/parking.md) entity related by `parks_for` |

Coordinates: OSM (`highway=via_ferrata`, `aerialway=*`, `shop=sports`, `office=guide`,
`leisure=*`), then the operator's map, then a `manual_pin`. Never a Google business pin.

## 5. Required fields

Activity:

| Field | Unit / values |
|---|---|
| `name`, `subkind`, `area_id`, `point`, `point_source` | core fields |
| `attrs.operator` | `{name, url, phone}` |
| `season` | season structure with `applies_to` |
| `hours` or `attrs.slots` | `[{season, days, times: ["09:00"], tz}]` |
| `attrs.weather_dependent` | bool, with what cancels it (wind, river level, lightning) |
| at least one `offer` | below |

Offer (each product):

| Field | Unit / values |
|---|---|
| `name` | product name as sold ("Family Float", "Skyline route") |
| `eligibility.min_age`, `max_age` | years; `none_stated` only when the operator says so; `searched_none` when the page is silent |
| `eligibility.age_rule` | `rule` or `recommendation` ("recommended from 12" is a recommendation) |
| `eligibility.min_height_cm`, `max_height_cm` | cm, or `none_stated` / `searched_none` |
| `eligibility.min_weight_kg`, `max_weight_kg` | kg, one decimal (convert from lb, note it); state which end the source means |
| `eligibility.adult_required` | `none`, `under_N_with_adult`, `one_adult_per_N_children` |
| `duration_min` | total including check-in and transfers; `attrs.activity_min` for the activity itself |
| `price_min`, `price_max`, `currency`, `price_basis` (`per_person`, `per_group`, `per_boat`), `price_read_on`, `applies_to` | plus `attrs.price_bands`: `[{band: "adult 16+", amount}, {band: "child 6-15", amount}, {band: "under 6", amount: 0}]` |
| `window_rule` + `window_spec` | `anytime`, `fixed_date`, `rolling`, `monthly_release`, `lottery`, `same_day`, with times and zone |
| `sellout` | `minutes`, `hours`, `days`, `weeks`, `rarely` |
| `url` | booking page |

## 6. Optional fields

| Field | Unit / values |
|---|---|
| `eligibility.fitness` | 1-5 with what it means here ("2 h of continuous paddling") |
| `eligibility.swim_required` | bool |
| `eligibility.waiver_signer_age` | years (often 18) |
| `eligibility.medical` | pregnancy, heart conditions, back problems, as stated |
| `eligibility.footwear` | required footwear, often decisive for via ferrata and glacier walks |
| `attrs.min_participants` | integer; what happens if not met |
| `attrs.group_size_max` | integer; guides per group (Dolomites ferrata: 3-4 per guide) |
| `attrs.included` | gear, guide, transport, photos, snacks, park entry, lift tickets |
| `attrs.extras` | list with prices |
| `attrs.weather_policy` | our paraphrase: who cancels, at what conditions, refund or rebook |
| `attrs.cancel_policy` | deadline and fee |
| `attrs.transfer` | from where, minutes |
| `attrs.what_to_bring` | list |
| `attrs.languages` | guiding languages |
| `attrs.private_option` | price and minimum |
| `attrs.accessibility` | as stated |
| `attrs.safety_notes` | certification body (ACMG, IFMGA, Paddle Canada, the Italian guide colleges), licence, reputable incident notes with dates |
| `attrs.operating_check` | how to know on the day (status page, phone, app) |
| `attrs.route_grade` | for via ferrata: the local scale as written (OSM `via_ferrata_scale`, Hüsler or the Italian scale) |

## 7. Computed values (mark `agent_inferred`)

- **Age on the activity date** from the traveller's birth date (never the booking date).
- **Unit conversion**: lb to kg (x 0.4536, one decimal), in to cm; the quote keeps the original.
- **Duration** when only the activity time is given: add the stated check-in and transfer.
- **Weather window**: the slots that fit the day's forecast rule; recomputed by the conditions check.
- **Household check** per offer ([../kinds/README.md](../kinds/README.md) section 8): `pass`, `fail`,
  `marginal`, `unknown`.

## 8. Sources, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Operator product page, rates page, terms, waiver PDF | limits, prices, slots, policies |
| 2 | The land manager that licenses it (park guide permits, via ferrata rules, river authority) | season, rules, licence |
| 3 | Official tourism board | which operators exist; season |
| 4 | The operator by phone or email, recorded as `operator` evidence with `method` and date | limits the page does not state |
| 5 | OSM | route geometry and grade (`via_ferrata_scale`), stations, base |
| 6 | Reputable press and guidebooks | context |
| 7 | Dated community reports | sell-out speed, real duration, crowding, whether it ran |
| 8 | Resellers (GetYourGuide, Viator, Civitatis) | `community` evidence for sell-out and as links only; their limits are conflicts at most |

## 9. Evidence rules

| Field | Minimum evidence |
|---|---|
| age, height, weight limits | `operator` or `official` on the product page, terms, waiver, or a recorded operator reply; a reseller or blog value is attached as a conflict only |
| `age_rule` | the operator's wording ("minimum" versus "recommended") in the quote |
| prices | `operator` with `price_read_on` and `applies_to` |
| season and slots | `operator` |
| booking window | `operator` or `official`; `sellout` may be `community` with two dated reports |
| weather and cancellation | `operator` terms |
| safety notes | `official` (licence, certification) or reputable press with a date |
| duration including check-in | `operator`, or `community` for the real total |

A limit with sources that disagree (Athabasca IceWalks: about 7, some say 6) is recorded with both
values; the operator's value is chosen when there is one, otherwise the stricter value is chosen and
the field stays a conflict.

## 10. Leave empty

- Any limit not found: `searched_none`, never "none". `none_stated` only when the operator writes it.
- 2027-2029 prices or hours: carry the read year, never project.
- Refund terms not in the terms page.
- Height limits inferred from age ("a 12-year-old is tall enough").
- A minimum weight stored in a maximum field because the source said "50 lb".

## 11. Freshness

Hard limits 365 days; prices 120 days; season and slots 365 days; booking windows 365 days and before
the next window; weather and cancellation policy 365 days; safety notes 2 years; links 90 days.

## 12. Traps (all from this repo's research)

| Trap | Where |
|---|---|
| Limits differ by product within one operator | Norquay routes 12+ versus 14+ (research/trips/canadian-rockies-sept-2029/adventure.md line 7) |
| Minimum weight stored as maximum | Kicking Horse family float, `max_weight_kg: 22.7` for a 50 lb minimum (same file line 136; legacy/canadian-rockies-sept-2029/data/adventures.json) |
| Pounds versus kilograms | 40 lb = 18.1 kg made a 20 kg child a marginal pass (same file line 9) |
| Sources disagree on age | Athabasca IceWalks 6 or 7 (line 12); a Banff Adventures page says 6+ for an 8+ product (line 136) |
| Recommendation versus rule | Via Ferrata Loen "recommended from age 12; 40-120 kg set by the harness" (research/trips/norway-summer/sights.md line 72) |
| Height never published | 42 of 43 Rockies adventures (repo CLAUDE.md); Funbob San Candido (research/trips/dolomites-july-2027/adventure.md line 65) |
| Per-group guide pricing, lift tickets extra | Dolomites ferrata EUR 380-500 per group (dolomites adventure.md lines 23-30) |
| Weather and refund terms missing everywhere | dolomites adventure.md line 139 |
| Operator sites unreadable to the fetcher | hieloyaventura.com and piratour.com.ar (research/trips/patagonia-feb-mar-2027/adventure-2.md line 6) |
| Adult-only products in a family trip | Big Ice 18-50 versus minitrekking 8-65 (patagonia adventure-2.md line 40) |
| One company, many spellings; only one may land | Piratour, the only operator allowed to land on Martillo (patagonia adventure-2.md lines 87-88) |
| Programmes that stop before the trip | Junior Explorer at Minnewanka ends about 31 Aug (canadian-rockies adventure.md line 19) |
| Opening hours that contradict the weather plan | an activity that only runs mornings on a day planned as the afternoon weather slot |
| Free-child deals with conditions | Banff Gondola: one free child per paying adult, first 2 hours (adventures.json) |
| "No zipline" is a finding | Cortina: no zipline found; do not assume one (dolomites adventure.md line 107) |

## 13. Example changeset (abridged)

Via Ferrata Loen, Norway. Facts from research/trips/norway-summer/sights.md line 72 (GAP CLOSED
2026-08-31); OSM ids read 18 Oct 2026.

```json
{
  "purpose": "adventure lane: Loen",
  "changes": [
    { "op": "create", "target_kind": "entity", "temp_ref": "a1",
      "patch": { "kind": "activity", "subkind": "via-ferrata", "name": "Via Ferrata Loen", "area_id": "area_loen",
        "point": [6.83909, 61.87480], "point_source": "osm_node:13812190758",
        "attrs": { "operator": { "name": "Loen Skylift (departures from Loen Active)", "url": "https://en.loenskylift.no/viaferrataloen", "phone": null },
          "activity_point": { "osm": "relation/16057739", "note": "main route, via_ferrata_scale 4; alternate exit relation/16057738, scale 2" },
          "slots": [ { "season": "in season", "days": "daily", "times": ["09:00", "10:00", "11:00"], "tz": "Europe/Oslo" } ],
          "weather_dependent": true,
          "what_to_bring": ["1.5 l water per person", "gloves", "long trousers", "windproof"] } },
      "evidence": [ { "field": "attrs.slots", "value": ["09:00", "10:00", "11:00"],
        "source": { "url": "https://en.loenskylift.no/viaferrataloen", "publisher": "Loen Skylift", "kind": "operator" },
        "observed_on": "2026-08-31", "applies_to": "2026",
        "quote": "Departs from Loen Active in the village at 09:00, 10:00 and 11:00, daily in season", "confidence": "operator" } ] },
    { "op": "create", "target_kind": "offer", "temp_ref": "o1",
      "patch": { "entity": "a1", "kind": "tour", "name": "Via Ferrata Loen (instructor, equipment, Skylift descent)",
        "eligibility": { "min_age": 12, "age_rule": "recommendation", "min_weight_kg": 40, "max_weight_kg": 120,
          "min_height_cm": { "state": "searched_none", "on": "2026-08-31", "tried": ["operator page"] } },
        "price_min": 2380, "price_max": 2380, "currency": "NOK", "price_basis": "per_person",
        "price_read_on": "2026-08-31", "applies_to": "2026",
        "attrs": { "included": ["instructor", "equipment", "Loen Skylift descent"] } },
      "evidence": [
        { "field": "eligibility.max_weight_kg", "value": 120,
          "source": { "url": "https://en.loenskylift.no/viaferrataloen", "publisher": "Loen Skylift", "kind": "operator" },
          "observed_on": "2026-08-31", "quote": "Minimum weight 40 kg, maximum 120 kg, set by the harness and lanyard system", "confidence": "operator" },
        { "field": "eligibility.min_age", "value": 12,
          "source": { "url": "https://en.loenskylift.no/viaferrataloen", "publisher": "Loen Skylift", "kind": "operator" },
          "observed_on": "2026-08-31", "quote": "Recommended from age 12", "confidence": "operator" } ] }
  ],
  "relations": [ { "from": "ent_loen_skylift", "to": "a1", "kind": "combo_with" } ],
  "links": [
    { "entity": "a1", "kind": "official", "url": "https://en.loenskylift.no/viaferrataloen", "label": "Loen Skylift: Via Ferrata Loen" },
    { "entity": "a1", "kind": "osm", "url": "https://www.openstreetmap.org/relation/16057739", "label": "OpenStreetMap: Via Ferrata Loen" }
  ],
  "gaps": [
    { "target": "a1", "field": "point", "reason": "operator says departures are from Loen Active in the village; confirm that OSM node 13812190758 (Loen Skylift AS) is that place", "tried": ["Overpass 2026-10-18"] },
    { "target": "o1", "field": "eligibility.adult_required", "reason": "not on the page", "tried": [] },
    { "target": "o1", "field": "duration_min", "reason": "not on the page", "tried": [] },
    { "target": "o1", "field": "window_rule", "reason": "booking window and sell-out not recorded", "tried": [] },
    { "target": "o1", "field": "attrs.weather_policy", "reason": "terms not found", "tried": [] }
  ],
  "summary": "1 activity, 1 offer; offer Draft 6 of 16; limits are a recommendation plus harness weights"
}
```

Sources are the two operator pages listed in research/trips/norway-summer/sights.md (lines 120-121).
`propose` returns the offer at Draft · 6 of 16
with OU4, OU5 and OU7 next ([../kinds/adventure.md](../kinds/adventure.md) section 12).
