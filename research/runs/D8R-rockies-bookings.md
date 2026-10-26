# Run d8r-bookings-2026-10-26-rockies: dateless booking rules for the Rockies "Book ahead" rows

Run record: `data/capture/runs/d8r-bookings-2026-10-26-rockies.json`. Agent: travel-researcher (Opus). Task: D8R-BOOKINGS
(BACKLOG 15.223b, DATA-PLAN D8-R, review TRP-GL-C F1). Read on 2026-10-26, one request at a time, user agent
`travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`. Lane prose: `research/trips/canadian-rockies-sept-2029/bookings.md`,
section "D8-R bookings re-read (26 Oct 2026)".

## Scope

Trip `canadian-rockies-2029` (prose folder `canadian-rockies-sept-2029`). The export and print "Book ahead" list is built in
`web/lib/public/trips.ts` from the itinerary's `booking_ids` and the `deadline_note` of the frozen
`legacy/canadian-rockies-sept-2029/data/bookings.json` (15 rows after the two lodging rows are dropped; all with
`bookRule: null`). For each row, and for the campground and hut rows the brief names, this run looked for the booking mechanics
on the official or operator page and wrote them as a rule with no calendar year in it, relative to the trip day or as "opens on
a fixed date each year". `legacy/**` was not edited.

## Result in one line

The rules are found and sourced for every row that has one. Two rows land in the store; six records are a proposal because the
contract cannot hold them without an owner decision (below). Nothing reaches the export yet: the export reads the legacy notes,
not capture records (the wiring gap below).

## The table

Confidence: **high** = an official or operator rule read today; **medium** = official, but the rule is a pattern seen in one
season (marked inference); **low** = not published. "Export today" is what `tripBookings` gives now (reproduced from the
legacy notes through the core functions; 7 rows). "Export once wired" is the proposed `bookRuleText`/note.

| Booking row (days) | Official source (read 2026-10-26) | Rule, dateless | Price band (2026, CAD) | Confidence | Stored? | Export today | Export once wired |
|---|---|---|---|---|---|---|---|
| shuttle-moraine-lakelouise (8-11) | Parks Canada, [Visiting Lake Louise and Moraine Lake](https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise); [Banff fees](https://parks.canada.ca/pn-np/ab/banff/visit/tarifs-fees) | 40 % of seats go on sale on one launch day each spring at 08:00 Mountain; the other 60 % open at 08:00 Mountain 2 days before each departure. Reservation required; up to 10 seats per booking; change or cancel up to 1 h before the departure window (fee each time). | adult 12.75, senior 6.00, youth 4.00, plus 3.50 online fee | high for the 2-day rule; medium that the launch is in April every year (one season read: inference) | yes, already: `offer/legacy/.../moraine-lake#shuttle-seat` (lane CS7), re-read today and unchanged | no row (every sentence was dated, so the scrub drops it) | "Opens 2 days before Day 11 at 08:00 local" (and Day 10), note "40% of seats go on sale on a spring launch day; book then" |
| moraine-private-access (11) | Parks Canada [Moraine Lake Road order](https://parks.canada.ca/pn-np/ab/banff/bulletins/5ad13e1f-bf45-4b41-bdd6-d525b33a4bc3); Roam [Super Pass](https://roamtransit.com/fares/reservations/super-pass-reservations/) | No private vehicles on Moraine Lake Road (order in force until further notice). The second way in is the Roam Reservable Super Pass: seats for each month go on sale in one batch at 09:00 Mountain; the batch covering September opens in late July. Round trip only, online only. | adult 30, senior 15, youth 15, 12 and under free (reservation still needed) | high (operator rule); medium that the batches repeat each year | proposal (`#roam-super-pass`) | "Have the Parks Canada shuttle reservation as primary ...; the Banff-Lake Louise Roam 8X runs year-round." | rule "Opens in a monthly batch, about 5 weeks before the month, at 09:00 local" (needs a new rule kind, see wiring) |
| lake-ohara-bus (9, optional) | Parks Canada [reservation policies: random draw](https://parks.canada.ca/termes-terms/reservation); [Visiting Lake O'Hara](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit); [Yoho fees](https://parks.canada.ca/pn-np/bc/yoho/visit/tarifs-fees) | Lottery. Apply online in a three-week window in early spring (08:00 first day to 23:59 last day, Mountain), up to 6 date and time choices; winners have 14 days to claim; seats left after the draw are sold in real time until 15:30 the day before. Max 6 per reservation, children must be on it. | 10 per application (non-refundable); bus 25.50 per person return plus 3.50 fee | high for the mechanics; medium that the window is in March each year (inference) | proposal (`place/lake-ohara#day-use-bus`; no Lake O'Hara place exists) | no row (dated) | "Lottery: apply in March for any day; leftover seats until 15:30 the day before Day 9" |
| pass-discovery (1, 2) | Parks Canada [admission](https://parks.canada.ca/voyage-travel/admission); [Banff fees](https://parks.canada.ca/pn-np/ab/banff/visit/tarifs-fees) | No window: buy online before the trip or at a gate or visitor centre. The Discovery Pass runs 12 months from purchase; youth 17 and under enter free. | daily adult 12.25, family 24.50; Discovery adult 83.50, family 167.50 | high | proposal (`place/banff-national-park#parks-canada-admission`; no park place exists) | "For a 2-week trip across 4 parks the annual family pass is likely cheaper than daily passes." | rule "Buy any time before Day 1", kind "pass" (not "book ahead") |
| kananaskis-pass (12-15) | Alberta, [Kananaskis Conservation Pass](https://www.alberta.ca/kananaskis-conservation-pass) | No window: buy online, by phone or at a visitor centre, at the latest by 23:59 on the first day parked; no retroactive purchase. One pass per vehicle. | day 15 per vehicle; year 90 (up to 3 vehicles) | high | proposal (`#conservation-pass` on kananaskis-lakes-day-use) | no row (note "buy online on the day" is read as nothing to book) | "Buy by 23:59 on Day 12", kind "pass" |
| icefields-parkway (4, 8) | Pursuit, [Columbia Icefield](https://www.banffjaspercollection.com/attractions/columbia-icefield/) and [tickets](https://www.banffjaspercollection.com/attractions/columbia-icefield-adventure/tickets/) | Road: no booking. Icefield Adventure: timed departures sold online and by phone; no window or lead time is published. | not published on the page (widget) | low (none stated) | yes: `window` none_stated, `book_url`, `activity_min` searched_none on `adventures/columbia-icefield-ice-explorer` | "Road should be open in September; pre-book icefield tour for chosen day." | rule none; note "Timed tickets; the operator publishes no window" |
| maligne-cruise (5) | Pursuit tickets page (read by DATA-D4a 2026-10-25, not re-fetched) | No window published; timed tickets online. | not published (widget) | low | yes (D4a, none_stated) | "Buy a few weeks ahead for the chosen day. Maligne Canyon trailhead and Cavell Road closed for 2026." (stale year fact) | note "Timed tickets; no window published" |
| jasper-skytram (6) | Pursuit tickets page (D4a, 2026-10-25) | Any time; pre-book a flight time. | not published (widget) | medium | yes (D4a, anytime) | no row ("no advance booking needed") | rule none; note "Pre-book a flight time" |
| closures-after-labour-day (2): Banff Gondola, Lake Minnewanka cruise | Pursuit (D4a, 2026-10-25) | Gondola: any time, timed slots, operator advises buying ahead at busy times; cruise: no window published. | not published | medium / low | yes (D4a) | no row | not a booking: a "check hours" row |
| lakelouise-lakeshore-parking (10) | Parks Canada louise page and fees | No reservation: paid lot in the shuttle season, fills before sunrise; shuttle holders park free at the Park and Ride. | 42 per vehicle per day | high | yes, price on `offer/place/lake-louise#parking` (CS7) | "Do not plan to drive to the Lakeshore lot; use shuttle." | kind "check", not "booking" |
| johnston-canyon (3) | Parks Canada [Bow Valley Parkway](https://parks.canada.ca/pn-np/ab/banff/visit/les10-top10/promenade-de-la-vallee-de-la-bow-bow-valley-parkway), [closure bulletin](https://parks.canada.ca/pn-np/ab/banff/bulletins/06d4ef61-a3c9-4b65-8dfc-66d056252d6c); Roam [reservations](https://roamtransit.com/fares/reservations/) | No booking. Roam route 9 takes no reservations (only route 8X does). In the fall cycling season (early September to early October, pilot to 2030) cars may not use the eastern Bow Valley Parkway: reach Johnston Canyon from Castle Junction. | free (park admission) | high | no (closures belong to the overview-facts lane) | no row ("no booking expected") | kind "check": "No booking; come from Castle Junction in early autumn" |
| yoho-valley-road (9) | Parks Canada [Yoho hours](https://parks.canada.ca/pn-np/bc/yoho/visit/heures-hours) | No booking; the road is open mid-June to mid-October, weather permitting; trailers not allowed. | free | high | no (access_season belongs to the overview-facts lane) | no row (dated) | kind "check" |
| larch-valley-group (11) | Parks Canada (rule stored as `group_min` 4 on the trail, lane R2a) | No booking. When Group Access is in effect, hikers must move in a tight group of four or more. | free | high for the rule; whether a child counts is not published (ask) | yes, already (R2a) | "A small group cannot hike when the rule is mandatory unless joining others." | kind "check"; owner call on the household wording |
| wildlife-orders (2, 7) | Parks Canada Banff bulletins | Not a booking: check bulletins the week before. | n/a | n/a | no | no row | kind "check" |
| calgary-rental-car (1, 15) | none (no official source class for a private rental) | Not researched: no official or operator rule exists for "when to book". | n/a | none | no | "Reserve with free cancellation once lodging is booked; ..." | owner's own note; kind "task" |
| camp-* rows (not in the plan) | Parks Canada [launch dates](https://parks.canada.ca/voyage-travel/reserve) | Each park opens its whole season on one launch day each winter (January or February) at 08:00 Mountain, with a queue. | per site (Banff fees page) | medium (pattern, inference) | proposal | not in the export | "Opens on a fixed launch day each winter" |
| pl-campgrounds (not in the plan) | Alberta Parks [Interlakes](https://albertaparks.ca/parks/kananaskis/peter-lougheed-pp/information-facilities/camping/interlakes/), [reservation FAQs](https://albertaparks.ca/albertaparks-ca/visit-our-parks/camping-in-alberta-parks/online-reservations/reservation-faqs/) | Rolling 90 days before arrival, the window moves at 09:00 Mountain each day; some sites first come, first served. | 31 per night | high | proposal | not in the export | "Opens 90 days before Day 13 at 09:00 local" |

Peyto Lake: no booking and no 2026 closure notice was found (a web search found only 2019 to 2021 construction closures).
Assiniboine lodge and huts, Berg Lake, Crypt Lake: not re-read (not in the plan's rows; the lane prose keeps the 12 Oct findings).

## What is stored

- `data/capture/canadian-rockies-2029/migrated.json`, record `legacy/canadian-rockies-sept-2029/adventures/columbia-icefield-ice-explorer`:
  `window` none_stated, `book_url` (the operator's ticket page), `activity_min` searched_none; new source row `src-0098`. No
  pinned value changed; the three keys were absent. `capture.ts fields --ref` still lists `duration_min`, `activity_min` and
  `book_url` as missing although they are stored, because the registry gives them no home (RIS-H; not changed, reported).
- Nothing else in `data/capture/`: the shuttle seat (CS7), the D4a windows and the R2a group rule were already right.

## Why six records are a proposal, not stored

1. **An access offer cannot be stored without a relevance record.** `access.pass.*` requires `summary` and `access_cost`
   (capture contract 3.3), and their only home is the relevance sidecar (`rel("why")`, `rel("access_cost")`). A relevance
   record also needs `class_key`, `draw`, `standing` and the rest, and no class in `data/vocab/relevance-classes.json` fits a
   pass; relevance.md 3.7 says an offer is judged with its place unless it draws on its own. A new record in the store with the
   two keys open is an error (`W_TIER_REQUIRED` at error level for new records). Writing a fake class and draw to pass the gate
   would put judgement data on a pass. Tried in the worktree, then removed: the Roam and Kananaskis records validated except for
   `summary`, `access_cost` and `hours`/`season`.
2. **Two have no place to hang on.** Parks Canada admission and the campgrounds belong to a park, and `at` must name a record the ref resolver knows
   (a place-page slug, a legacy row or a capture record), and Banff National Park is only an area of the locations store. Lake O'Hara has no place
   record at all (it needs a point, from OSM, by the points runner).

Owner decision Q-D8R-1 below. The proposal records, ready to load once it is decided:

```json
{
 "schema": "capture/1",
 "trip": "canadian-rockies-2029",
 "lane": "D8RB (proposal, not stored)",
 "researched": "2026-10-26",
 "agent": "travel-researcher",
 "model": "opus",
 "sources": [
  {
   "id": "src-0001",
   "url": "https://roamtransit.com/fares/reservations/super-pass-reservations/",
   "title": "Super Pass Reservations",
   "publisher": "Roam Transit (Bow Valley Regional Transit Services Commission)",
   "kind": "operator",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0002",
   "url": "https://roamtransit.com/fares/reservations/",
   "title": "Reservations",
   "publisher": "Roam Transit (Bow Valley Regional Transit Services Commission)",
   "kind": "operator",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0003",
   "url": "https://www.alberta.ca/kananaskis-conservation-pass",
   "title": "Kananaskis Conservation Pass",
   "publisher": "Government of Alberta",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0004",
   "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise",
   "title": "Visiting Lake Louise and Moraine Lake",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0005",
   "url": "https://parks.canada.ca/pn-np/ab/banff/bulletins/5ad13e1f-bf45-4b41-bdd6-d525b33a4bc3",
   "title": "Restricted activity: travel by motor vehicles is restricted on Moraine Lake Road",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0006",
   "url": "https://parks.canada.ca/voyage-travel/admission",
   "title": "Admission and passes",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0007",
   "url": "https://parks.canada.ca/pn-np/ab/banff/visit/tarifs-fees",
   "title": "Fees, Banff National Park",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0008",
   "url": "https://parks.canada.ca/termes-terms/reservation",
   "title": "Reservation policies (random draw for the Lake O'Hara day-use bus)",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0009",
   "url": "https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit",
   "title": "Visiting Lake O'Hara",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0010",
   "url": "https://parks.canada.ca/pn-np/bc/yoho/visit/tarifs-fees",
   "title": "Fees, Yoho National Park",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0011",
   "url": "https://parks.canada.ca/voyage-travel/reserve",
   "title": "Reservation launch dates",
   "publisher": "Parks Canada",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0012",
   "url": "https://albertaparks.ca/albertaparks-ca/visit-our-parks/camping-in-alberta-parks/online-reservations/reservation-faqs/",
   "title": "Reservation FAQs",
   "publisher": "Alberta Parks",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  },
  {
   "id": "src-0013",
   "url": "https://albertaparks.ca/parks/kananaskis/peter-lougheed-pp/information-facilities/camping/interlakes/",
   "title": "Interlakes Campground",
   "publisher": "Alberta Parks",
   "kind": "official",
   "read": "2026-10-26",
   "method": "read"
  }
 ],
 "records": [
  {
   "ref": "offer/legacy/canadian-rockies-sept-2029/sights/moraine-lake#roam-super-pass",
   "type": "access.pass.shuttle_seat",
   "layer": "offer",
   "name": "Roam Reservable Super Pass (Banff to Lake Louise and Moraine Lake)",
   "at": [
    "legacy/canadian-rockies-sept-2029/sights/moraine-lake",
    "place/lake-louise"
   ],
   "season": {
    "v": [
     {
      "from": "06-01",
      "to": "10-12",
      "status": "open",
      "applies_to": "2026",
      "note": "summer reservation season; Moraine Lake access depends on the road being open"
     }
    ],
    "state": "value",
    "basis": "operator_info",
    "src": [
     "src-0001"
    ],
    "read": "2026-10-26",
    "quote": "Moraine Lake is scheduled to open on June 1st – October 12th, 2026.",
    "applies_to": "2026"
   },
   "price": {
    "v": [
     {
      "amount": 30,
      "currency": "CAD",
      "per": "adult",
      "age_from": 19,
      "applies_to": "2026",
      "note": "one-day pass, same-day return"
     },
     {
      "amount": 15,
      "currency": "CAD",
      "per": "person",
      "age_from": 65,
      "applies_to": "2026",
      "note": "senior"
     },
     {
      "amount": 15,
      "currency": "CAD",
      "per": "person",
      "age_from": 13,
      "age_to": 18,
      "applies_to": "2026",
      "note": "youth; 18 only with high-school ID"
     },
     {
      "amount": 0,
      "currency": "CAD",
      "per": "child",
      "age_to": 12,
      "applies_to": "2026",
      "note": "free, but each child still needs a reservation"
     }
    ],
    "state": "value",
    "basis": "operator_info",
    "src": [
     "src-0001"
    ],
    "read": "2026-10-26",
    "note": "Prices are for a same-day return; a return booked on another date costs extra per person. The pass is valid on every Roam route for that day.",
    "applies_to": "2026"
   },
   "window": {
    "v": {
     "rule": "monthly_release",
     "opens_time": "09:00",
     "tz": "America/Edmonton",
     "sellout": {
      "kind": "unknown"
     },
     "fallback": "Seats for each month go on sale in one batch in spring or summer; the batch that covers September opens in late July. Without a reservation, walk-up seats on route 8X reach Lake Louise only, not Moraine Lake."
    },
    "state": "value",
    "basis": "operator_rule",
    "src": [
     "src-0001",
     "src-0002"
    ],
    "read": "2026-10-26",
    "quote": "Reservations for September & October (until the 12th) open at 9 a.m. MT on July 27th",
    "note": "Release dates are set per season; the operator says reservations are typically sold out for much of the summer but gives no lead time. Round trip only; book online, not on the bus.",
    "applies_to": "2026"
   },
   "links": [
    {
     "kind": "official",
     "url": "https://roamtransit.com/fares/reservations/super-pass-reservations/",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0001"
     ]
    },
    {
     "kind": "booking",
     "url": "https://roamtransit.betterez.com/cart/607a075d39c0361ea1fe027a",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0001"
     ]
    }
   ],
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "legacy/canadian-rockies-sept-2029/sights/moraine-lake",
     "reason": "D8-R bookings: the second way to reach Moraine Lake without a car (booking row moraine-private-access)."
    }
   }
  },
  {
   "ref": "offer/legacy/canadian-rockies-sept-2029/sights/kananaskis-lakes-day-use#conservation-pass",
   "type": "access.pass.park_pass",
   "layer": "offer",
   "name": "Kananaskis Conservation Pass",
   "at": [
    "legacy/canadian-rockies-sept-2029/sights/kananaskis-lakes-day-use"
   ],
   "price": {
    "v": [
     {
      "amount": 15,
      "currency": "CAD",
      "per": "vehicle_day",
      "applies_to": "2026",
      "note": "day pass, one personal vehicle"
     },
     {
      "amount": 90,
      "currency": "CAD",
      "per": "vehicle",
      "applies_to": "2026",
      "note": "yearly pass, valid 365 days from purchase, registers up to 3 vehicles at one address"
     }
    ],
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0003"
    ],
    "read": "2026-10-26",
    "quote": "Day pass - $15 (registers one vehicle) Yearly pass - $90 (registers up to 3 vehicles)",
    "note": "The pass is for the vehicle, not the passengers; needed when parked at provincial park and public land sites in Kananaskis Country and the Bow Valley.",
    "applies_to": "2026"
   },
   "window": {
    "v": {
     "rule": "anytime",
     "fallback": "Buy online, by phone or at a Kananaskis visitor centre, at the latest by 23:59 on the first day of the visit; a pass cannot be bought afterwards for a day already parked."
    },
    "state": "value",
    "basis": "official_rule",
    "src": [
     "src-0003"
    ],
    "read": "2026-10-26",
    "quote": "You can purchase your pass up until 11:59 pm on the first day of your visit.",
    "note": "Retroactive purchases are not available. The page encourages buying before arriving; cell service is patchy in parts of Kananaskis.",
    "applies_to": "2026"
   },
   "links": [
    {
     "kind": "official",
     "url": "https://www.alberta.ca/kananaskis-conservation-pass",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0003"
     ]
    },
    {
     "kind": "booking",
     "url": "https://conservationpass.alberta.ca/kcp",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0003"
     ]
    }
   ],
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "legacy/canadian-rockies-sept-2029/sights/kananaskis-lakes-day-use",
     "reason": "D8-R bookings: the parking pass for the Kananaskis days (booking row kananaskis-pass)."
    }
   }
  },
  {
   "ref": "offer/place/banff-national-park#parks-canada-admission",
   "type": "access.pass.park_pass",
   "layer": "offer",
   "name": "Parks Canada admission: daily fee or Discovery Pass",
   "at": [
    "place/banff-national-park (needs a place record; today only the area CA/AB/banff-national-park exists)"
   ],
   "price": {
    "v": [
     {
      "amount": 12.25,
      "currency": "CAD",
      "per": "adult",
      "age_from": 18,
      "age_to": 64,
      "applies_to": "2026",
      "note": "daily admission"
     },
     {
      "amount": 10.75,
      "currency": "CAD",
      "per": "person",
      "age_from": 65,
      "applies_to": "2026",
      "note": "daily admission, senior"
     },
     {
      "amount": 0,
      "currency": "CAD",
      "per": "child",
      "age_to": 17,
      "applies_to": "2026",
      "note": "youth 17 and under enter free"
     },
     {
      "amount": 24.5,
      "currency": "CAD",
      "per": "family",
      "applies_to": "2026",
      "note": "daily, up to seven people in one vehicle"
     },
     {
      "amount": 83.5,
      "currency": "CAD",
      "per": "adult",
      "applies_to": "2026",
      "note": "Discovery Pass, 12 months, more than 80 places"
     },
     {
      "amount": 71.5,
      "currency": "CAD",
      "per": "person",
      "age_from": 65,
      "applies_to": "2026",
      "note": "Discovery Pass, senior"
     },
     {
      "amount": 167.5,
      "currency": "CAD",
      "per": "family",
      "applies_to": "2026",
      "note": "Discovery Pass, family or group"
     }
    ],
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0007"
    ],
    "read": "2026-10-26",
    "quote": "Family/Group $ 24.50 ... Parks Canada Discovery Pass ... Family/Group $ 167.50",
    "applies_to": "2026"
   },
   "window": {
    "v": {
     "rule": "anytime",
     "sellout": {
      "kind": "never"
     },
     "fallback": "Buy online before the trip, or at a park gate or visitor centre; the Discovery Pass runs 12 months from purchase."
    },
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0006"
    ],
    "read": "2026-10-26",
    "quote": "Get your Discovery Pass online",
    "note": "No timed entry or cap is stated; 'never' sells out is our reading of an unlimited pass (inference).",
    "applies_to": "2026"
   },
   "links": [
    {
     "kind": "official",
     "url": "https://parks.canada.ca/voyage-travel/admission",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0006"
     ]
    },
    {
     "kind": "hours_rates",
     "url": "https://parks.canada.ca/pn-np/ab/banff/visit/tarifs-fees",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0007"
     ]
    }
   ],
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "booking row pass-discovery",
     "reason": "D8-R bookings: entry to the national parks on every Banff, Yoho, Kootenay and Jasper day."
    }
   }
  },
  {
   "ref": "offer/place/lake-ohara#day-use-bus",
   "type": "access.pass.shuttle_seat",
   "layer": "offer",
   "name": "Lake O'Hara day-use bus (random draw)",
   "at": [
    "place/lake-ohara (needs a place record with a point)"
   ],
   "season": {
    "v": [
     {
      "from": "06-19",
      "to": "10-04",
      "status": "open",
      "applies_to": "2026"
     }
    ],
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0009"
    ],
    "read": "2026-10-26",
    "quote": "Operating from June 19 to October 4, 2026.",
    "applies_to": "2026"
   },
   "price": {
    "v": [
     {
      "amount": 25.5,
      "currency": "CAD",
      "per": "person",
      "applies_to": "2026",
      "note": "return bus fare; plus a 3.50 online reservation fee"
     },
     {
      "amount": 10,
      "currency": "CAD",
      "per": "group",
      "applies_to": "2026",
      "note": "per draw application, non-refundable"
     }
    ],
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0010",
     "src-0008"
    ],
    "read": "2026-10-26",
    "quote": "Shuttle - To Lake O'Hara Area and Return Per person $ 25.50",
    "applies_to": "2026"
   },
   "window": {
    "v": {
     "rule": "lottery",
     "opens_time": "08:00",
     "tz": "America/Edmonton",
     "sellout": {
      "kind": "unknown"
     },
     "fallback": "Apply online during a three-week window in early spring (08:00 on the first day to 23:59 on the last, Mountain time) with up to six date and time choices; seats left after the draw are sold in real time until 15:30 the day before."
    },
    "state": "value",
    "basis": "official_rule",
    "src": [
     "src-0008",
     "src-0009"
    ],
    "read": "2026-10-26",
    "quote": "any unreserved seats are made available for standard reservations, and you can make a reservation up until 3:30 pm the day prior",
    "note": "The window was 2 to 23 March in the year read; that it falls in March every year is a pattern (inference). Winners have 14 days to claim. At most 6 people per reservation; children 1 to 16 must be on it.",
    "applies_to": "2026"
   },
   "links": [
    {
     "kind": "official",
     "url": "https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0009"
     ]
    },
    {
     "kind": "terms",
     "url": "https://parks.canada.ca/termes-terms/reservation",
     "state": "filled",
     "on": "2026-10-26",
     "src": [
      "src-0008"
     ]
    }
   ],
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "booking row lake-ohara-bus",
     "reason": "D8-R bookings: the optional Lake O'Hara day."
    }
   }
  },
  {
   "ref": "offer/place/banff-national-park#frontcountry-campsite",
   "type": "stay.camp.campground",
   "layer": "offer",
   "offer_class": "lodging",
   "name": "Parks Canada front-country campsites (Banff, Jasper, Yoho, Kootenay)",
   "window": {
    "v": {
     "rule": "fixed_date",
     "opens_time": "08:00",
     "tz": "America/Edmonton",
     "sellout": {
      "kind": "unknown"
     },
     "fallback": "The whole season opens on one launch day per park in January or February, with an online queue; the dates are announced each winter."
    },
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0011"
    ],
    "read": "2026-10-26",
    "quote": "Launch dates vary by location",
    "note": "Banff front country opened on a Thursday in mid-February, Jasper in late January, Yoho and Kootenay in mid to late January in the year read; that it recurs is a pattern (inference).",
    "applies_to": "2026"
   },
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "booking rows camp-banff-front, camp-yoho-kootenay, camp-jasper",
     "reason": "D8-R bookings: only if camping (not in the plan)."
    }
   }
  },
  {
   "ref": "offer/place/interlakes-campground#campsite",
   "type": "stay.camp.campground",
   "layer": "offer",
   "offer_class": "lodging",
   "name": "Interlakes campground, Peter Lougheed Provincial Park",
   "price": {
    "v": [
     {
      "amount": 31,
      "currency": "CAD",
      "per": "night",
      "applies_to": "2026",
      "note": "unserviced site"
     }
    ],
    "state": "value",
    "basis": "official_info",
    "src": [
     "src-0013"
    ],
    "read": "2026-10-26",
    "quote": "Unserviced 46 - $31",
    "applies_to": "2026"
   },
   "window": {
    "v": {
     "rule": "rolling",
     "days_before": 90,
     "opens_time": "09:00",
     "tz": "America/Edmonton",
     "sellout": {
      "kind": "unknown"
     },
     "fallback": "Part of the sites are first come, first served."
    },
    "state": "value",
    "basis": "official_rule",
    "src": [
     "src-0012",
     "src-0013"
    ],
    "read": "2026-10-26",
    "quote": "the booking window resets at 9:00 a.m. Mountain Time",
    "note": "90-day rolling window for individual campsites.",
    "applies_to": "2026"
   },
   "meta": {
    "schema_version": 1,
    "run_id": "d8r-bookings-2026-10-26-rockies",
    "origin": {
     "from": "booking row pl-campgrounds",
     "reason": "D8-R bookings: only if camping (not in the plan)."
    }
   }
  }
 ]
}
```

`at` in the Parks Canada admission and Lake O'Hara records is a placeholder text, not a ref: it names the place record that has
to exist first. The two campground records have no `at` for the same reason.

## The wiring gap: how the export gets these rules

Today `web/lib/public/trips.ts` (the Rockies branch, about line 355) builds one `logistics:<id>` category row per legacy
`booking_ids` entry, with `bookRule: null` and `placeSlug: null` hard-coded and the note from `deadline_note`. No capture record is
read. So nothing this run found changes the export until a code task connects them. That task needs:

1. **A map from booking row to capture ref.** shuttle-moraine-lakelouise to `offer/legacy/canadian-rockies-sept-2029/sights/moraine-lake#shuttle-seat`;
   icefields-parkway to `legacy/canadian-rockies-sept-2029/adventures/columbia-icefield-ice-explorer`; maligne-cruise to
   `legacy/canadian-rockies-sept-2029/adventures/maligne-lake-cruise`; jasper-skytram to `offer/legacy/canadian-rockies-sept-2029/adventures/jasper-skytram#ticket`;
   lakelouise-lakeshore-parking to `offer/place/lake-louise#parking`; larch-valley-group to the trail's `group_min`; the four
   proposal refs once stored. Best done when TD-3/TD-4 move the rows into `data/trips/`, so the trip names the capture ref
   instead of a legacy booking id (review F12 also wants the legacy ids out of the API).
2. **`window` to `BookRuleInput`.** `rolling` maps directly: `daysBefore = days_before`, `time = opens_time`, `tz`, and `dayN` =
   the day the seat is used (the trip's day, not the row's first day: review F10). `anytime` and `on_arrival` give no rule
   ("buy any time", a pass). `fixed_date`, `lottery` and `monthly_release` cannot be said with `BookRuleInput` today: it needs a
   rule kind (rolling, launch day each year, lottery, monthly batch, any time) and `bookRuleText` a wording for each ("Opens on a
   launch day each spring at 08:00 local", "Lottery: apply in early spring", "Opens in a monthly batch about 5 weeks ahead").
   That is a shared contract change (core export types and the API model), so Opus.
3. **A row kind**, so the rows with nothing to book (johnston-canyon, yoho-valley-road, lakelouise-lakeshore-parking,
   larch-valley-group, wildlife-orders, closures-after-labour-day) print as "check" and passes as "pass", not as "booking"
   (review F1, third bullet). Today `NOTHING_TO_BOOK` guesses this from the note's words.
4. **`placeSlug` from the offer's `at`**, so `withStopBookings` puts the shuttle rule next to the Moraine Lake and Lake Louise
   stops (15.223b's last sentence).

Proposed owner of that task: a new BACKLOG row beside 15.223b (call it 15.223d), builder seat, with the `BookRuleInput` change
on Opus, landing with TD-3/TD-4. Until then the legacy notes stay the export's only input, and the export keeps 7 rows with no
rule.

## Contract findings (not changed, reported)

- **RIS-H homes.** `duration_min`, `activity_min` and `book_url` are stored on records but have no home in the registry, so
  `capture.ts fields --ref` lists them as missing on the Columbia Icefield record even after this run stored `book_url` and
  `activity_min` (and D4a stored `duration_min`). Every offer in the trip reads the same way.
- **Access offers and relevance.** See "Why six records are a proposal".
- **`window` has no month.** A launch day "each spring" or a lottery "in March" has nowhere to say the month except `fallback`
  text. A `opens_month` (or `opens_from`/`opens_to` as MM-DD) would let the export say "apply in March" without a year.

## Questions for the owner

- **Q-D8R-1.** How should passes and shuttle seats be stored? (a) give `summary` a capture home on offers and make
  `access_cost` not applicable to an offer that is itself the access cost (registry change, with RIS-H); (b) add a relevance class
  for passes and allow a judgement-free relevance record; (c) keep them as proposals. Recommended: (a).
- **Q-D8R-2.** Create park-level place records (Banff National Park as a place, Lake O'Hara with a point) so admission, the
  O'Hara bus and campgrounds can hang on them? The points runner (Overpass, one at a time) would do Lake O'Hara.
- **Q-D8R-3.** Household wording. The larch-valley row is already rewritten by `PARTY_LEAK` to "a small group cannot hike ..."
  and the "whether a young child counts" clause is dropped as a GAP. Separately, `research/trips/canadian-rockies-sept-2029/bookings.md`
  line 3 still states the party (adults and a child's age) and several sections name the child's age: PUBLIC-SCRUB did not
  catch this file. Scrub it, or is it acceptable in research prose? This run added no household data.
- **Q-D8R-4.** The shuttle row covers days 8 to 11, but one row carries one rule. Split it into one row per day the shuttle is
  ridden (Day 10 Lake Louise, Day 11 Moraine Lake), each "Opens 2 days before Day N at 08:00 local"?
- **Q-D8R-5.** calgary-rental-car has no official source of a booking rule. Keep it as the owner's own task row, or drop it from
  "Book ahead"?

## Files written

- `data/capture/canadian-rockies-2029/migrated.json`: the Columbia Icefield record (3 keys) and source row `src-0098`.
- `data/capture/runs/d8r-bookings-2026-10-26-rockies.json`: the run record (23 results).
- `data/capture/gap-budget.json`: `W_TIER_REQUIRED.keys` 3724 to 3723 (`gaps --budget --write`; it only goes down).
- `research/trips/canadian-rockies-sept-2029/bookings.md`: section "D8-R bookings re-read (26 Oct 2026)", with the GAP CLOSED
  lines.
- `research/method/operator-questions-2026-10-18.md`: section "D8-R bookings" (D8R-1 to D8R-3).
- This note.

## Commands and results

| Command | Result |
|---|---|
| `node core/bin/validate.ts --all` | OK, 104 files |
| `node core/bin/capture.ts run --check data/capture/runs/d8r-bookings-2026-10-26-rockies.json` | OK, 0 errors, 0 warnings |
| `node core/bin/capture.ts gaps --budget --check` | OK; one count fell (3724 to 3723), budget lowered with `--write` |
| `node core/bin/sources.ts check` | 1 error: the registry drifts by the new source row `src-0098`. Not rebuilt here: the coordinator regenerates `data/sources/registry.json` at merge |
| `node core/bin/normalise.ts --check` and `--budget --check` | OK, 0 would change; findings identical to main (none on the touched record) |
| `node core/bin/slugs.ts --check` | OK |
| `python3 tools/tree_check.py` | folder contract OK (11 rules) |
| `python3 tools/relink.py check` | exit 0; 9 broken relative links, all in files this run did not touch (WISHLIST.md, vault-notes templates) |
| `node core/bin/capture.ts gaps --placement --trip canadian-rockies-2029` | 205 records; no area 15, no point 0, approximate 8, offers saying nowhere 0 (unchanged; the touched offer inherits its place) |
| `pnpm --dir core exec vitest run test/export` | 31 passed; the Rockies export still gives 7 booking rows, none with a rule (reproduced through `tripBookings`) |
