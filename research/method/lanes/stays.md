# Lane: stays

Status: draft (17 Oct 2026; required fields and sources made concrete 18 Oct 2026, aligned with
[../kinds/stay.md](../kinds/stay.md), [../kinds/hut.md](../kinds/hut.md) and [../kinds/town.md](../kinds/town.md)).

## 1. Purpose

Answer **where to sleep and why**, at two levels: the **base** (which town or valley) and the **property**
(which hotel, lodge, rental, hut or campsite). The former trip skill's rule holds: the famous village
is often the wrong one to sleep in; record elevation, car-free status, how it is reached, tourist tax,
**when it loses the sun**, overnight temperature (most alpine hotels have no air conditioning),
day-tripper churn versus evening quiet, last transport up, and the nearest real supermarket.

We never book stays; this lane feeds suggestions, the plan's night bases and the reservations form
(09-reservations.md).

## 2. Produces

- **Base towns**: `entity` kind `place` subkind `town` with `attrs.base` (the base facts below), or
  `area` rows for larger bases.
- **Properties**: `entity` kind `stay` with subkinds `hotel`, `lodge`, `b_and_b`, `guesthouse`, `apartment`,
  `rental_house`, `hostel`, `hut`, `campsite`, `glamping`, `resort`, `motel`.
- **Room products** where they matter: `offer` kind `room` (family room, two-bedroom unit, adults-only
  suite), with `eligibility` (max occupancy, min age for adults-only) and booking window (huts).
- **Campsite pitches**: `offer` kind `campsite` (tent, RV with hookups, max length).

## 3. Required fields

The exact checks per level are in the kind profiles: [../kinds/town.md](../kinds/town.md) (base
towns), [../kinds/stay.md](../kinds/stay.md) (properties and campsites), [../kinds/hut.md](../kinds/hut.md)
(huts). A stay is Usable (can be a night base in a plan) when these are filled with evidence:

**Base town** (`place/town` with `attrs.base`):

| Field | Format | Example |
|---|---|---|
| `name`, `point`, `point_source`, `area_id` | core fields; `wikidata:` allowed for the point | Argentiere |
| `attrs.base.elevation_m` | metres, `official` or Wikidata; never "~1,060 m INFER" | `1252` |
| `attrs.base.access` | list of `road`, `car_free`, `rail`, `lift_only`, `ferry` | `["road", "rail"]` |
| `attrs.base.why_sleep_here`, `attrs.base.why_not` | our words, concrete | "trailheads from the door"; "grocery limited" |
| `attrs.base.groceries` | relation to a supermarket `eatery` entity with minutes | Super U Les Pelerins, 10 min |
| `attrs.base.drive_times_min` | from routing (`leg_cache`), never memory | `{chamonix_centre: 15}` |
| `attrs.base.transport` | guest card: what it covers and what it does not | carte d'hote: Servoz-Vallorcine trains only |
| `attrs.base.parking` | free, paid with rate and year, ZTL | 24 h EUR 19.90 (2026) |

**Property** (`stay`):

| Field | Format | Example |
|---|---|---|
| `name`, `subkind`, `point`, `point_source`, `area_id` | core fields; point from OSM `tourism` (hotel, guest_house, apartment, camp_site) | |
| `website`, `attrs.address` | the property's own site; the address as it writes it | |
| `attrs.check_in_from`, `attrs.check_in_until`, `attrs.check_out_by` | local `HH:MM` | `15:00`, `22:00`, `10:00` |
| `season` | open dates with `applies_to` | `05-13..09-30 (2026)` |
| `cost_band` | 0-4 from the property's published rates, or computed from category with a note | `2` |
| `attrs.rooms_family` or room `offer`s | beds, max occupancy, connecting, cots, extra-bed price | "two-bedroom apartment, sleeps 5" |
| `attrs.amenities.parking` | `free`, `paid` (rate), `none`, `street`; height limit | `paid, 2.0 m` |
| `attrs.min_stay` | nights by season and holiday weekend, or `none_stated` | `{"07-01..08-31": 3}` |
| campsites | `attrs.pitches`, `attrs.reservation`, `attrs.max_vehicle_m` | |
| huts | `attrs.booking` (channel and window), `attrs.half_board` (price, year), `attrs.payment`, `eligibility.min_age` for nights | see the hut profile |

## 4. Optional fields

Base: `loses_sun` (`{month, time_hhmm}` computed with core/src/sun and the horizon), `night_temp_c` by
month, `evening_vibe` (`quiet`, `lively`, `day_tripper_churn`), `last_transport_up`, `tourist_tax`
(amount per person per night, age exemptions), `parking`, `ev_charging`.

Property:
| Field | Values |
|---|---|
| `attrs.rooms_family` | family rooms, connecting rooms, two-bedroom units, max occupancy per room, cots, extra beds and their price |
| `attrs.adults_only` | bool |
| `attrs.luxury` | category (stars or local rating), signature features (view side, spa, butler, private terrace), which room categories have the view |
| `attrs.amenities` | `air_conditioning` (decisive in summer Alps), `pool`, `spa`, `laundry`, `kitchen`, `parking` (free/paid/none, height limit), `ev_charging`, `elevator`, `accessible_room`, `wifi`, `breakfast` (included or price), `half_board`, `pets` |
| `attrs.cancellation_typical` | our paraphrase of the usual policy, for planning only (the real one comes with the reservation) |
| `attrs.min_stay` | nights, by season and holiday weekends |
| `attrs.distance_to` | walking minutes to the centre, lift, station |
| hut-specific | `booking_opens` (date or rule), `half_board`, `cash_only`, `showers`, `sheet_sleeping_bag_required`, `dorm_or_private`, `water`, `access_trail` relation |
| campsite-specific | `pitches`, `hookups`, `showers`, `dump_station`, `max_vehicle_m`, `reservation` rule, `camping_card` acceptance, `winter_open` |

## 5. Sources, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | The property's own site, rates page and terms | check-in times, rooms, amenities (air conditioning only from here), season, min stay, parking, published rates |
| 2 | Hut and alpine club booking systems (montourdumontblanc.com for TMB huts, CAI and SAC portals, refuge sites) | hut season, booking-open dates, half board, payment, age rules |
| 3 | Park and municipal campground reservation systems (Parks Canada, Ontario Parks, the Iceland Camping Card list) | campsite season, pitches, windows |
| 4 | Official tourism lodging directories (hautesavoiemontblanc-tourisme.com, the valley boards) | season, category, contact, campsite prices |
| 5 | Municipality and tourist office | guest card terms, tourist tax, parking guide |
| 6 | OSM and Wikidata | identity and points |
| 7 | The property by phone or email, recorded as `operator` with the date | room layouts, air conditioning, late check-in |
| 8 | Dated community reports | evening vibe, real noise, sun loss, whether the family room is a room |

Online travel agencies (Booking.com, Expedia, Airbnb listings) are links only; their content,
ratings and prices are never stored.

## 6. Evidence rules

Check-in/out times, season and min stay: `operator`. Hut booking opening dates: `official` or `operator`
with the year. Prices are bands only (`cost_band`) unless an operator page lists rates with dates; never
store OTA prices.

## 7. Leave empty

Room prices from OTAs; amenities inferred from photos; "air conditioning" unless stated.

## 8. Freshness

Season and hut windows 365 days; check-in/out 365 days; amenities 2 years; cost band 365 days.

## 9. Traps

Famous village versus good base; valley floors that go dark early; no air conditioning in heatwaves;
minimum stays on long weekends; huts closing about 20 September (Chamonix); campsites shutting during
September and the Camping Card expiring 15 September (Iceland); "family room" meaning a double plus a
sofa bed.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "st1",
  "patch": { "kind": "stay", "subkind": "hut", "name": "Refuge du Lac Blanc", "area_id": "area_chamonix",
    "season": [ { "from": "06-10", "to": "09-20", "status": "open" } ],
    "attrs": { "check_in_from": "16:00", "check_out_by": "08:30", "half_board": true, "cash_only": false,
      "booking_opens": { "rule": "fixed_date", "note": "about 15 Oct for the following summer" } } },
  "evidence": [ { "field": "season", "value": "06-10..09-20", "source": { "url": "https://...", "kind": "operator" }, "observed_on": "2026-10-17", "applies_to": "2026", "quote": "Open from early June to 20 September", "confidence": "operator" } ] } ],
  "gaps": [ { "target": "st1", "field": "attrs.booking_opens", "reason": "only community sources give the date" } ] }
```
