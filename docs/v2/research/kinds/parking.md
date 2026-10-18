# Kind profile: parking

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method: [../lanes/trails.md](../lanes/trails.md)
section 4 (the parking table there is the source of these fields).

## 1. What it is

One parking lot (or one signed stretch of legal roadside parking). Stored as `entity.kind = place`,
subkind `parking`. Produced by the **trails** lane, and by sights and road-trips for lots that serve
lakes, viewpoints, towns and lifts. Parking capacity and fill time decide the order of a day
(research/README.md section 8), so a lot is never a text field on the trail or the lake.

One entity per lot the agency or the ground names separately: Rifugio Auronzo has P1, P2, P3 and P4
in OSM; Lago di Braies has P2 (about 800 m from the lake) to P4 (about 100 m). A park-and-ride for a
shuttle is a parking lot related to the shuttle stop, not to the lake.

Separate entities: the trailhead or sight it serves (`parks_for`, with `attrs.walk_min`), the
reservation or toll (`offer` kind `permit` or `shuttle`), the EV charger (`place/ev_charger`) when it
matters on a road trip.

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `name` | as signed or as the agency names it | `Parcheggio Rifugio Auronzo (P4)` | which of four lots the booking is for |
| `point` | WGS84, 5 decimals, at the **entrance** | `[12.29439, 46.61356]` | the navigation target |
| `point_source` | `osm_way:<id>` (`amenity=parking`), `official:<url>`, `manual_pin` | `osm_way:74709399` | |
| `parks_for` | relation to trailheads and sights, `attrs.walk_min` and metres | `walk_min: 5` | P2 at Braies is 800 m from the lake with a pushchair |
| `attrs.fee` | `{amount, currency, basis, applies_to, read_on}` or `free` | `{amount: 40, currency: "EUR", basis: "per_vehicle_12h", applies_to: "2026"}` | budget, and whether coins are needed |
| `attrs.payment` | `machine_card`, `machine_coins`, `app` (name), `online_prebooked`, `pass_covers`, `honour_box` | `online_prebooked` | |
| `attrs.reservation` | `none`, `recommended`, `required`; an `offer` when not `none` | `required` | no slot, no entry |
| `attrs.fills_by` | list `{season: "MM-DD..MM-DD", days: weekday/weekend/holiday/all, time: "HH:MM", source}` | `{season: "07-01..08-31", days: "all", time: "06:30"}` | **the single most decisive parking fact** |
| `attrs.capacity_cars` | integer or `[min, max]` with evidence | `~20` | a lot of nine cars decided a whole Vermont day |
| `attrs.overflow` | where people go when full | "Pinnacle Meadows overflow, 1.6 km east" | the Plan B when you arrive at 09:15 |
| `attrs.hours` | gate times; overnight allowed or not | `00:00-24:00, overnight banned` | sunrise starts, hut nights |

Complete adds: `attrs.capacity_rv` (or `none`, with max length in m), `attrs.accessible_spaces`,
`attrs.surface`, `attrs.ev_charging`, `attrs.winter_access`, `attrs.pass_covers`,
`attrs.shuttle_alternative`.

## 3. Location

The point is the lot entrance (the node where the access road enters the `amenity=parking` way when
tagged, else the way's centroid, and the evidence says which). Source order: OSM → agency map →
`manual_pin` placed by a person over imagery. A Google pin someone sends is re-placed as a
`manual_pin` and checked against OSM (the Vermont `USER` rows in
research/trips/vermont-fall-2026/notes/PARKING.md). Check OSM `access`: the Lower Barnes lot near the
Stowe gondola is `access=private` (same file).

## 4. Link checklist

| Kind | Required? |
|---|---|
| `official` (the agency or municipality parking page) | checklist |
| `booking` | required when `reservation` is not `none` |
| `hours_rates` | checklist |
| `osm` | checklist |
| `webcam` (often the only live "is it full" signal) | checklist |
| `status` (a live occupancy page) | checklist |
| `navigation` | generated |

## 5. Where to research, in order

| # | Source | Trusted for |
|---|---|---|
| 1 | Land manager or municipality (Parks Canada parking page, auronzo.info, prags.bz, Vermont FPR) | fee, reservation, hours, capacity when published |
| 2 | Tourism board pages | fee and reservation where the agency is silent |
| 3 | OSM | point, `capacity`, `fee`, `access`, `surface`, `parking:disabled` (hints; `capacity` from OSM is `community` grade) |
| 4 | Dated trip reports, at least two | `fills_by`, overflow reality |
| 5 | Webcams | fill time on a given morning (a dated observation) |

## 6. People limits

`accessible_spaces` and the walk to the subject (`parks_for.attrs.walk_min`, metres, gain, surface)
feed the accessibility and pushchair checks. `capacity_rv` and max vehicle length feed the camper-van
trip type.

## 7. Time and money

- `fills_by` per season and day type; "arrive early" is never a value.
- Fee per basis with currency, `applies_to` and read date; whether a pass covers it.
- Reservation: `offer` with `window_rule` (the Tre Cime slot: mandatory online, 12 hours from the booked
  entry; Braies: 1 Jul - 15 Sep 09:00-16:00 entry needs a booked slot, free before 09:00 and after
  16:00 per research/trips/dolomites-july-2027/transport.md 2.1).
- Gate hours and overnight rules.

## 8. Never guess

Capacity from satellite imagery; fill time from one undated report; a fee without a year; "free"
because no machine was mentioned; overnight parking allowed.

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8, plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | at least one `parks_for` relation with `walk_min` | computed from the path is `agent_inferred`, allowed |
| U4 | Usable | `attrs.fee` (value or `free`) | `official` or `operator`; `community` fails |
| U5 | Usable | `attrs.reservation` | `official` or `operator` |
| U6 | Usable, when `reservation` is not `none` | an `offer` with `window_rule`, `window_spec.tz`, `sellout` | `official` |
| U7 | Usable | `attrs.fills_by` for the trip-type season, or `searched_none` (SN ok) | two dated `community` reports allowed |
| U8 | Usable | `attrs.hours` (or `always_open`) | |
| C9 | Complete | `attrs.capacity_cars` (SN ok, after the official page and OSM) | `official`, or OSM `capacity` marked `community` |
| C10 | Complete | `attrs.overflow` (or `none`) | |
| C11 | Complete | `attrs.payment` | |
| C12 | Complete | `attrs.accessible_spaces` (SN ok) | |
| C13 | Complete | `attrs.capacity_rv` and max length, or `none` | |
| C14 | Complete, when the road closes in winter | `attrs.winter_access` | |

U1 summary may be one line ("closest lot; fills first"). C4 (photo) is `not_applicable`.
Totals: Draft 5, Usable 8, Complete 14; **27**.

## 10. Freshness

Fee and payment: 120 days. Reservation rule and window: 365 days, and before the next window opens.
Fills-by: 365 days. Capacity: 3 years. Hours: 180 days. Point: never. Links: 90 days.

## 11. Traps

| Trap | Where |
|---|---|
| A nine-car lot that ordered the whole day | Stowe Pinnacle, research/trips/vermont-fall-2026/notes/PARKING.md |
| Fills by 06:00-06:30 | Sorapis at Passo Tre Croci (research/trips/dolomites-july-2027/trails.md 0.6) |
| Two sources, two different lots | "free roadside on SR48 plus an overflow lot, no published capacity" versus "free gravel car park near the bridge, ~20 spaces" (dolomites trails.md 0.6 and 3) |
| One famous lot is four lots | Rifugio Auronzo P1-P4 in OSM (ways 1109742730, 1109742731, 1220017592, 74709399, read 18 Oct 2026); the research has one "~700 vehicles" figure (dolomites trails.md 0.4) |
| Price ladder by distance | Braies P2 about EUR 7 at 800 m to P4 EUR 44 at 100 m including a EUR 22 food voucher (dolomites transport.md 2.1) |
| Lot that does not exist because access is shuttle-only | Moraine Lake (lanes/trails.md section 4) |
| Private lot beside a public one | Lower Barnes lot, `access=private` (vermont notes/PARKING.md) |
| The same lot fee charged by the hour on Parks Canada land in town | Banff Gondola lot 17.50 CAD, 09:00-21:00, 15 May - 12 Oct 2026 (legacy/canadian-rockies-sept-2029/data/adventures.json, `banff-gondola`) |

## 12. Worked example: Parcheggio Rifugio Auronzo (P4)

| Field | Value | Source |
|---|---|---|
| `point` | `[12.29439, 46.61356]`, `osm_way:74709399` (centroid; entrance node to record) | OSM, read 18 Oct 2026 |
| `parks_for` | Rifugio Auronzo trailhead; Tre Cime loop | |
| `fee` | 40 EUR per car, valid 12 hours from the booked entry, includes the toll road; 26 motorbike, 60 motorhome; `applies_to` 2026 | auronzo.info via research/trips/dolomites-july-2027/transport.md section 1 |
| `reservation` | `required`; `offer` kind `permit`, `window_rule` to be read (the research says "booking opens end of April"; the prototype says "30 days before": a conflict) | dolomites trails.md, prototype trails.ts |
| `fills_by` | `searched_none`: the research says "fills by mid-morning in July" (undated, one source) | dolomites trails.md |
| `capacity_cars` | conflict: "~700 vehicles" for the whole area in one blog; P4 alone unknown | |

Level: **Draft · 9 of 26** (D1-D5, U1, U3, U4 on the drei-zinnen.bz tourism page, U5; C14 is
`not_applicable` because the trailhead it serves is a summer-only destination). Missing next: U2 the
toll road's 2027 season, U6 the booking-window conflict, U7 two dated fill-time reports for P4, U8 the
gate hours.
