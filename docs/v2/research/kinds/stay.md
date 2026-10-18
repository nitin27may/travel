# Kind profile: stay (hotel, lodge, rental, campsite)

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method: [../lanes/stays.md](../lanes/stays.md).
Huts have their own profile ([hut.md](hut.md)).

## 1. What it is

A property people sleep in: hotel, lodge, B&B, guesthouse, apartment, rental house, hostel, motel,
resort, campsite, glamping. Stored as `entity.kind = stay` with that subkind. Produced by the
**stays** lane. We never book stays; this profile feeds suggestions, night bases and the reservations
form (09-reservations.md). The question it answers is not "is it nice" (the OTAs do that) but
**does it work for this party on these nights**: family rooms that are real rooms, air conditioning in
a heatwave, check-in after a late drive, a campsite open in September, parking for a camper.

Separate rows: room or pitch products as `offer` kind `room` or `campsite` (family room, two-bedroom
unit, tent pitch, RV pitch with hookups), each with its own occupancy and eligibility; the base town
([town](town.md)); parking when it is off-site ([parking](parking.md)).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `point` | the reception or main entrance | | arrival navigation |
| `attrs.address` | postal address as the property writes it | | the reservation and the taxi; never the point source |
| `website` | the property's own site | | |
| `attrs.check_in_from`, `attrs.check_in_until`, `attrs.check_out_by` | local `HH:MM` | `15:00`, `22:00`, `10:00` | a late arrival after a 6-hour drive |
| `season` | open dates, `applies_to` | `05-13..09-30 (2026)` | campsites shutting in September |
| `cost_band` | 0-4, from operator rates when listed; never OTA prices | `2` | |
| `attrs.rooms_family` | what a family room is: beds, max occupancy, connecting, two-bedroom units, cots, extra beds and price | "two-bedroom apartment, sleeps 5" | "family room" meaning a double plus a sofa bed |
| `attrs.amenities.parking` | `free`, `paid` (rate), `none`, `street`; height limit; EV | `paid, 15 EUR/night, 2.0 m height` | a camper or a roof box |
| `attrs.amenities.air_conditioning` | `yes`, `some_rooms`, `no`, `unknown`: only from the property | `no` | most alpine hotels have none |
| `attrs.amenities.breakfast` | `included`, price, `none` | | |
| `attrs.min_stay` | nights by season and holiday weekends | `{"07-01..08-31": 3}` | the long-weekend minimum that breaks a plan |

Campsites add (each as a check): `attrs.pitches` (tent, RV, cabin), `attrs.hookups`, `attrs.showers`,
`attrs.dump_station`, `attrs.max_vehicle_m`, `attrs.reservation` rule, `attrs.camping_card`
acceptance, `attrs.winter_open`, `attrs.quiet_hours`.

Complete adds: `attrs.adults_only`, `attrs.luxury` (category, view side, which rooms have the view),
`attrs.amenities` (pool, spa, laundry, kitchen, elevator, accessible room, wifi, pets),
`attrs.half_board`, `attrs.cancellation_typical` (our paraphrase, for planning), `attrs.distance_to`
(walking minutes to the centre, lift, station), `attrs.noise` (road, rail, bars), `attrs.tourist_tax`
(or from the town).

## 3. Location

`point` from OSM (`tourism=hotel`, `guest_house`, `apartment`, `camp_site` with id; the entrance or
reception node when tagged) → the property's own map → `manual_pin` checked against imagery. A street
address geocoded through Nominatim is acceptable (OSM data) and is recorded as `osm_node` or
`osm_way` of the matched building, not as "address". The Algonquin plan's address "1212 S Limberlost
Rd #1150" matched no source (repo CLAUDE.md, Algonquin entry): navigate by name, store a gap.

## 4. Link checklist

`official` (the property's site), `booking` (its own booking page, or the park campground system),
`terms` (cancellation), `hours_rates` (published rates), `accessibility`, `tourism_board` (lodging
directory), `osm`, `commons`, `webcam`; OTA pages (Booking.com, Expedia) link only and optional;
`navigation` generated.

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The property's own site, rate page and terms | check-in, rooms, amenities, season, min stay, parking |
| 2 | Park or municipal campground reservation systems (Parks Canada, Ontario Parks, the Iceland Camping Card list) | campsite season, pitches, windows |
| 3 | Official tourism lodging directories | season, category, contact |
| 4 | OSM, Wikidata | identity and point |
| 5 | Phone or email, recorded as `operator` | room layouts and air conditioning the site does not state |
| 6 | Dated community reports | noise, evening vibe, whether the family room is a room |

OTA content and prices are never stored (../sources-and-licences.md).

## 6. People limits

Room occupancy per `offer` (max adults, max children, cot ages), `adults_only` and its age, pets.
The household check compares the party with the chosen room offer's occupancy.

## 7. Time and money

Season, check-in and check-out, min stay by season, cost band from operator rates with read year,
deposit and cancellation typical terms, campsite windows (park systems open on fixed dates), tourist
tax.

## 8. Never guess

Air conditioning; room layouts; prices from OTAs; amenities from photos; the season of a campsite in
the shoulder month; that a camping card is accepted.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `website` and `attrs.address` | `operator` |
| U4 | Usable | `attrs.check_in_from`, `check_out_by` | `operator` |
| U5 | Usable | `cost_band` | `operator` rates, or `agent_inferred` from category with a note |
| U6 | Usable | `attrs.rooms_family` or the room `offer`s with occupancy (SN ok for small parties) | `operator` |
| U7 | Usable | `attrs.amenities.parking` | `operator` |
| U8 | Usable | `attrs.min_stay` (value or `none_stated`, SN ok) | `operator` |
| U9 | Usable, campsites | `attrs.pitches`, `attrs.reservation`, `attrs.max_vehicle_m` | `operator` or `official` |
| C9 | Complete | `attrs.amenities.air_conditioning` (no SN for summer trips below 1,500 m) | `operator` |
| C10 | Complete | `attrs.amenities.breakfast` | `operator` |
| C11 | Complete | `attrs.cancellation_typical` | `operator` |
| C12 | Complete | `attrs.distance_to` | `agent_inferred` from routing |
| C13 | Complete | `eligibility.accessibility` or the accessible-room amenity (SN ok) | `operator` |
| C14 | Complete | `attrs.noise` | `community` |
| C15 | Complete, campsites | `attrs.hookups`, `showers`, `dump_station`, `camping_card`, `quiet_hours` | `operator` |
| C16 | Complete | `attrs.check_in_until` (late arrival rule) | `operator` |

Totals: hotel Draft 5, Usable 8, Complete 15 (**28**); campsite **30**.

## 10. Freshness

Season and check-in times: 365 days. Cost band: 365 days. Min stay: 365 days. Amenities: 2 years.
Campsite windows: 365 days and before the window. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| Campsites shutting in September; the Camping Card valid to 15 September | research/trips/iceland-ring-road/van.md line 34, timing.md line 26 |
| No campsite confirmed open for the trip's month | Iceland, September 2027 (repo CLAUDE.md, Iceland entry) |
| An address that matches no source | Port Cunnington area, "1212 S Limberlost Rd #1150" (repo CLAUDE.md, Algonquin entry) |
| Hotel prices not found for the trip year | Patagonia hotel prices GAP (repo CLAUDE.md, Patagonia entry); Chamonix "working range" is INFER (research/trips/chamonix-mont-blanc-sept-2028/stay.md line 94) |
| Air conditioning taken for granted | lanes/stays.md section 9 |
| Campsite-only sleeping is law for camper vans | Iceland (repo CLAUDE.md) |

## 12. Worked example: Camping Glacier d'Argentiere

| Field | Value | Source |
|---|---|---|
| `subkind` | `campsite` | |
| `season` | 13 May - 30 Sep 2026 | research/trips/chamonix-mont-blanc-sept-2028/stay.md lines 65, 95 (hautesavoiemontblanc-tourisme.com) |
| price | pitch, car and 2 adults including tax about 25.10-27.10 EUR; tent pitch 4.50-6.50; electricity 7 EUR (2026) | same |
| tourist tax | 0.20 EUR per person per night (2026) | stay.md line 43 |
| `point`, check-in, pitches, max vehicle, reservation rule, showers | gaps | |

Level once the point is recorded: **Draft · 8 of 30** (D1-D5, U1, U2, U5). Missing for Usable: U3 the
campsite's own site, U4 check-in, U6 pitch offers, U7 parking, U8 min stay, U9 pitches and vehicle
length.
