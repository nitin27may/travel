# Rockies stay bases: town facts, ways to stay, swaps (DATA-D9R, 25 Oct 2026)

Spec: `docs/v2/features/stay-bases-and-optimisation.md` (sections 3, 6, 9.2, 9.3, 9.5, 14). Data:
`data/base-plans/canadian-rockies-2029.json` (`trip-base-plans/1`, every alternative and swap `review: "draft"`). Run note
and the named-property list: `research/runs/DATA-D9R-canadian-rockies-2029.md` (its "Private: not for public output"
section). Builds on `base-strategies.md` (DATA-L1, OSRM), which stays the dated record and is not edited.

Public-safe: town level only. No property names, party, ages, home town, budget or booking state in this file. The older
private lane file `logistics-stays.md` was read for the question only and is not cited for any value.

**Until STY-P lands the `base` property group, the town facts live here in the spec 9.3 / section 14 field order, not in
the Rockies `BS.json` capture lane file.**

Marks: VERIFIED (read on the named page on the read date), COMPUTED (ORS routing, read 25 Oct 2026), INFERENCE (our
reasoning, says so), GAP / `searched_none` (what was tried). Every ORS number is free-flow driving with no stops, no
traffic and no roadworks, from `research/runs/DATA-D9R/ors-legs-2026-10-25.json`; label it "typical drive, no stops".

## 1. Routing: ORS against the DATA-L1 OSRM run

Base points (D1 ruling ST-1 applied): Banff, Canmore, Golden, Jasper, Hinton, Valemount from the GeoNames towns layer
(`data/reference/towns/ca.json`, ids 5892532, 5914894, 5962582, 6354954, 5975503, 6173031); Lake Louise village OSM node
2665400241 (`place=hamlet`); Kananaskis Village OSM node 926027463 (village centre); Calgary airport Wikidata Q1160343
(P625 51.113889, -114.020278); Edmonton airport Wikidata Q269588 (P625 53.31, -113.57944); Lake Louise Park and Ride OSM
way 262311607 (Nominatim, 51.44171, -116.16323).

| Pair (one way) | ORS min | ORS km | OSRM min (DATA-L1) |
|---|---|---|---|
| Calgary airport - Canmore | 87 | 114.2 | 94 |
| Calgary airport - Kananaskis Village | 85 | 107.9 | not run |
| Calgary airport - Banff | 102 | 136.2 | 110 |
| Calgary airport - Lake Louise | 139 | 189.8 | 155 |
| Calgary airport - Golden | 201 | 271.2 | 221 |
| Calgary airport - Jasper | 333 | 420.9 | 364 |
| Edmonton airport - Jasper | 269 | 392.3 | not run |
| Edmonton airport - Calgary airport | 165 | 264.1 | not run |
| Canmore - Banff | 30 | 28.1 | 30 |
| Canmore - Lake Louise | 68 | 81.7 | not run |
| Canmore - Kananaskis Village | 47 | 57.4 | 51 |
| Canmore - Golden | 130 | 163.1 | not run |
| Canmore - Jasper | 261 | 312.8 | not run |
| Banff - Lake Louise | 48 | 57.5 | 54 |
| Banff - Kananaskis Village | 62 | 80.8 | 69 |
| Banff - Golden | 110 | 138.9 | not run |
| Banff - Jasper | 242 | 288.6 | not run |
| Lake Louise - Field | 24 | 27.0 | 27 |
| Lake Louise - Golden | 65 | 82.3 | 72 |
| Lake Louise - Kananaskis Village | 99 | 134.3 | not run |
| Lake Louise - Jasper | 197 | 232.0 | 216 |
| Golden - Field | 47 | 57.1 | not run |
| Golden - Jasper | 256 | 308.2 | 278 |
| Jasper - Hinton | 66 | 76.9 | 69 |
| Jasper - Valemount | 95 | 125.0 | 104 |
| Lake Louise village - Park and Ride | 7 | 3.2 | not run |
| Banff - Park and Ride | 52 | 59.8 | not run |
| Canmore - Park and Ride | 72 | 84.0 | not run |
| Golden - Park and Ride | 70 | 84.8 | not run |

ORS is 0 to 11 % faster than OSRM on every shared pair (both free-flow; different speed profiles). The Lake Louise to
Jasper ORS distance, 232.0 km, equals the 232 km the Icefields Parkway site gives (cited in the legacy research), a useful
cross-check. Per DD-5 the stored legs are ORS through STY-L; OSRM stays the cross-check.

### Day-trip drive per strategy (spec 3.5 item 10)

Same method as `base-strategies.md`: round trip from the nearest strategy base to the main stop of each of the plan's 15
day sections. The method reproduces the DATA-L1 OSRM totals to 0.1 h (S0 23.6, S1 33.0, S3 27.4, S5 33.9). Moraine Lake is
measured to the Lake Louise Park and Ride, because Moraine Lake Road is closed to personal vehicles year-round (Parks
Canada, read 25 Oct 2026) and ORS does not route it; Sunshine Meadows and Sulphur Skyline did not snap to a routable road
in ORS, so those two sections keep the OSRM value (cross-check only, marked in
`research/runs/DATA-D9R/ors-day-trip-totals.json`).

| Strategy | Check-ins / moves | Base to base incl. airport (ORS min) | Longest transfer | Day-trip drive (ORS h) | OSRM h |
|---|---|---|---|---|---|
| `as-planned`: Banff 2, Lake Louise 1, Jasper 4, Lake Louise 4, Kananaskis Village 3 | 5 / 4 | 728 | 197 | 21.3 | 23.6 |
| `fewer-moves`: Banff 3, Jasper 4, Lake Louise 4, Kananaskis Village 3 | 4 / 3 | 725 | 242 | 21.3 (method blind to the day 3 and 4 change: +45 and +6 min, below) | 23.6 |
| `three-bases`: Jasper 4, Lake Louise 5, Banff 5 | 3 / 2 | 680 | 333 | 24.8 | 27.4 |
| `three-bases-canmore`: Jasper 4, Lake Louise 5, Canmore 5 | 3 / 2 | 685 | 333 | 25.3 | 27.8 |
| `three-bases` + `golden-for-lake-louise` (the owner's Jasper, Golden, Banff) | 3 / 2 | 801 | 333 | 30.1 | 33.0 |
| `as-planned` + `canmore-for-banff` | 5 / 4 | (Canmore 87 to the airport) | 197 | 22.8 | not run |
| `as-planned` + `canmore-for-kananaskis` | 5 / 4 | (Canmore 87 to the airport) | 197 | 23.0 | not run |
| two bases, Jasper and Banff (S5) | 2 / 1 | not summed | 333 | 31.0 | 33.9 |
| one base (best: Lake Louise) | 1 / 0 | not summed | 333 | 52.3 | not run |

Reading it: the DATA-L1 conclusions hold under ORS. Three bases with Lake Louise in the middle costs about 3.5 h more
day-trip driving than the plan for two fewer check-ins; Golden in the middle costs 5.3 h more than Lake Louise; one base
does not fit (Maligne Lake is 503 min round trip from Lake Louise, the best single base).

## 2. The four ways to stay and three swaps

All in `data/base-plans/canadian-rockies-2029.json`. Night counts per stay are set from the day content (below), not the
spec's placeholders.

| Id | Stays (nights) | Day order | Review |
|---|---|---|---|
| `as-planned` | Banff 1-2, Lake Louise 3, Jasper 4-7, Lake Louise 8-11, Kananaskis Village 12-14 | as written | approved (the published plan, as the spec 9.2 example) |
| `fewer-moves` | Banff 1-3, Jasper 4-7, Lake Louise 8-11, Kananaskis Village 12-14 | as written | draft |
| `three-bases` | Jasper 1-4, Lake Louise 5-9, Banff 10-14 | reordered | draft |
| `three-bases-canmore` | Jasper 1-4, Lake Louise 5-9, Canmore 10-14 | reordered as `three-bases` | draft |
| swap `canmore-for-banff` | Canmore instead of Banff | any strategy with Banff | draft |
| swap `golden-for-lake-louise` | Golden instead of Lake Louise village | any; on `three-bases` it is the owner's plan | draft |
| swap `canmore-for-kananaskis` | Canmore instead of Kananaskis Village | `as-planned`, `fewer-moves` | draft |
| `checked_not_fit` | one base; two bases (Jasper, Banff) | | |

### 2.1 Day map for Jasper first (spec 3.4: confirmed with four corrections)

| New day | Night base | From plan day | What changes (ORS, typical drive, no stops) |
|---|---|---|---|
| 1 | Jasper | 1, keep only the errands item | Calgary airport to Jasper 333 min (421 km), via Banff, Lake Louise and the Parkway; the plan's Banff evening items do not fit |
| 2-4 | Jasper | 5, 6, 7 | none |
| 5 | Lake Louise | 8 (Parkway south) | as written, ends in Lake Louise |
| 6 | Lake Louise | 4 (Bow Lake, Peyto, Saskatchewan Crossing, Icefield, Skywalk) | an out-and-back from Lake Louise in the plan's order: Bow Lake 62 min round trip, Icefield 208 min round trip |
| 7 | Lake Louise | 9 (Yoho) | Emerald Lake 71 min round trip, as the plan's Lake Louise nights |
| 8 | Lake Louise | 10 (Lake Louise) | none |
| 9 | Lake Louise | 11 (Moraine) | Park and Ride 7 min from the village; first shuttle 06:30 (Parks Canada) |
| 10 | Banff | 3 (Johnston, Marble, Paint Pots) | a transfer day: Lake Louise to Johnston Canyon 29 min, then the plan's stops, Paint Pots to Banff 47 min |
| 11 | Banff | 2 (Sunshine, Minnewanka, hot springs) | none (the plan's own Banff day) |
| 12 | Banff | 12 (Canmore) | Ha Ling area 88 min round trip from Banff against 41 from Canmore |
| 13 | Banff | 13 (Kananaskis Lakes) | 197 min round trip from Banff against 92 from Kananaskis Village |
| 14 | Banff | 14 (Highwood Pass) | not routed (GAP: Banff to Highwood Pass pair for STY-L) |
| 15 | out | 15 (Troll Falls, airport) | Banff to Troll Falls 59 min, Troll Falls to the airport 84 min: 143 against 89 from the village |

Corrections to spec 3.4:

1. **Jasper 4 nights, not 5.** The Jasper content is three full days (plan days 5 to 7) plus the arrival night. A fifth
   Jasper night would need a fourth Jasper day the plan does not have.
2. **Plan day 4 is a whole day from the middle base (new day 6), not a `keep` subset from Banff on day 14.** Bow Lake is
   62 min round trip from Lake Louise against 153 from Banff, and keeping the whole day loses no item (the spec's draft
   dropped the Skywalk). Its minus: the Icefield area two days running (new days 5 and 6), and the Parkway driven three
   times (north on day 1, south on day 5, out and back on day 6). Gotcha 19 holds: no strategy "saves the Parkway".
3. **Lake Louise 5 nights, Banff 5** (Jasper 4): the middle block holds plan days 8, 4, 9, 10, 11.
4. **`left_out` is plan day 1's Banff evening items**: `fenland-loop`, `vermilion-lakes`, `elk-rut` (and day 1's copy of
   `banff-gondola`, which stays on plan day 2's easy variant). Reason: day 1 drives to Jasper, and every Banff-night day
   already holds a whole plan day (D9 allows whole-day moves only). INFERENCE.

The Golden swap uses the same map with Golden as the middle base (spec 3.4's table was written for that case). Its
numbers: Golden to the Park and Ride 70 min, so the 06:30 first Moraine shuttle means leaving Golden by about 05:20
(COMPUTED from ORS and the Parks Canada time; any check-in time at the kiosk comes on top); Golden to Field 47 min against
24 from Lake Louise; Golden to Jasper 256 min against 197.

### 2.2 Fewer moves (M2 candidate)

Night 3 moves from Lake Louise to Banff. Day 3 ends back in Banff (Paint Pots to Banff 47 min against 41 to Lake Louise,
+6 min); day 4 starts in Banff (Banff to Jasper 242 min against 197 from Lake Louise, +45 min). Largest one-day change
+45 min, under the M2 limit of 60. Plan Day 3's first leg is from Banff in both versions.

### 2.3 Open jaw (a `requires` note on the three-base strategies)

- Edmonton airport to Jasper 269 min (392 km) against Calgary airport to Jasper 333 min: day 1 is about 64 min shorter.
  COMPUTED.
- Rental one-way policy, two operators (policy, not a quote): Enterprise Canada says a drop charge, if any, "will be
  disclosed at the time of reservation" and varies by location and time of year (read 25 Oct 2026). Hertz Canada says
  one-way rentals have "no separate drop-off fees on most rentals" across 100+ Canadian locations (read 25 Oct 2026).
  VERIFIED.
- GAP (searched 25 Oct 2026): whether Edmonton airport to Calgary airport one-way is offered by either operator, and the
  fee; both pages list no routes, and the fee is by quote. The forum figure in spec 3.2 ("nothing to several hundred
  dollars") is not used.

## 3. Spec 3.5 answers

1. **Base points.** Golden: GeoNames 5962582 (51.29995, -116.9689); Wikidata Q1020179 gives 51.3019, -116.967 (about
   250 m away). Canmore: GeoNames 5914894 (51.08335, -115.35206); Wikidata Q991515 gives 51.08800, -115.34778 (about 590 m).
   Lake Louise and Kananaskis Village: the D1 ruling (OSM hamlet node 2665400241; OSM node 926027463). Airports: Wikidata
   Q1160343 and Q269588. New town points are listed in the run note for the coordinator (D1b owns `points.json`).
2. **Routing.** The leg pairs for STY-L are listed in the run note.
3. **Price bands.** `searched_none` for all six base towns (section 4, field 4). Official statistics found: CBRE average
   daily rate by month through the Alberta Economic Dashboard (Government of Alberta), "Alberta Resorts" (Banff, Lake
   Louise, Kananaskis, Canmore and Jasper combined): CAD 709.50 for September 2025, CAD 641.94 for September 2024; Calgary
   Airport hotels CAD 155.62 for September 2025 (series updated 22 Oct 2026, read 25 Oct 2026). These are averages per
   occupied room over a five-town region, not the 9.3 band unit, so they can appear only as a dated area line if the owner
   allows it (Q113).
4. **Check-in pattern, minimum stays, lead time.** Section 4, fields 5 to 7. Operator pages state check-in from 16:00 and
   check-out by 11:00 (Banff n=2, Lake Louise n=1); every other town `searched_none` (only OTA and aggregator listings
   came up, which are excluded). No operator page read states a minimum stay. Campground lead time: Parks Canada opened
   the season's Banff, Jasper, Yoho and Kootenay campground reservations in January and February (read 25 Oct 2026).
5. **Golden.** Time zone: Mountain time, aligned with Alberta (Town of Golden notice of 4 Mar 2026, read 25 Oct 2026; CTV
   of 23 Sep 2026 reports the council kept Mountain Daylight Time after BC's change); IANA `America/Edmonton` ("AB, BC(E)",
   tz `zone1970.tab`, read 25 Oct 2026). BC child-seat rule: children under nine must use a booster seat from 18 kg until
   nine years or 145 cm, whichever comes first (ICBC fact sheet TS274S, read 25 Oct 2026); Alberta: child seat under 6 and
   18 kg or less, "Booster seats are not required by law in Alberta" (alberta.ca/child-seats, read 25 Oct 2026). Kicking
   Horse Canyon: "Project is complete", Phase 4 completed in 2024 (kickinghorsecanyon.ca, read 25 Oct 2026); live
   conditions on DriveBC. Moraine: Park and Ride at the Lake Louise Ski Resort, first departure 06:30 MDT every 30 min,
   shuttle season to mid-October in the 2026 pattern (Parks Canada, read 25 Oct 2026); Golden to the Park and Ride 70 min
   (ORS).
6. **Park passes.** Parks Canada: buy a pass when "spending time in a national park", including "stops in towns and
   villages"; not when "travelling through the parks without stopping" (except the Icefields and Bow Valley Parkways); a
   daily pass is valid "until 4:00pm on the day after purchase" and covers Banff, Jasper, Kootenay, Yoho and others
   (page modified 28 Sep 2026, read 25 Oct 2026). So a pass is needed to stay in Banff, Lake Louise and Jasper. Canmore:
   no national park pass and no Kananaskis Conservation Pass for the townsite (Tourism Canmore Kananaskis FAQ; Alberta
   page: "Canmore townsite and municipal land" need no pass). Golden is outside the national parks (INFERENCE from the
   town's location; no page read says so explicitly). Kananaskis Village: the Alberta page says vehicles parked at public
   sites in Kananaskis Country need the Conservation Pass, and hotel guests "are not exempt" when they park in a publicly
   accessible location; whether a hotel's own lot counts is not stated (GAP).
7. **Jasper capacity after the fire.** No official figure found (searched 25 Oct 2026: Tourism Jasper "where to stay",
   Municipality rebuild numbers page, news search). A local paper reported on 13 May 2025 that Tourism Jasper estimated
   about 20 % fewer accommodations that season (community basis, not stored as a number). Tourism Jasper's directory (read
   25 Oct 2026) lists hotels and inns, cabins and lodges, hostels and camping, with one lodge "being rebuilt" and one
   closing for renovation in the autumn. Hinton (66 min) and Valemount (95 min, Pacific time) pass as fallbacks only for
   an overflow night: from Hinton, Maligne and Robson days get about 2 h longer round trip (INFERENCE from the Jasper legs;
   not routed per day).
8. **Open jaw.** Section 2.3.
9. **DATA-L1 facts table.** Canmore outside the park and the Nordic Centre needing the Kananaskis pass: VERIFIED (Alberta
   page: the Nordic Centre is in the pass area). Canmore parking: four paid zones (Town Centre, Riverside Park, Boat
   Launch, Quarry Lake) on the Town of Canmore page; rates `searched_none` (not on that page; the town announced payment
   changes from 18 Mar 2026). Jasper rooms: item 7. Official Canmore and Lake Louise rates: `searched_none` (only the
   five-town CBRE series exists). The Banff 2025 ADR line from DATA-L1 is not re-verified (the cited article now
   redirects); the CBRE series replaces it as the official statistic.
10. **Re-run.** Section 1.

## 4. Town facts (spec 9.3 / section 14 field order)

Field key: (1) point, elevation, zone; (2) why, why not; (3) lodging and directory; (4) price band; (5) check-in pattern;
(6) minimum stay; (7) lead time; (8) park pass; (9) groceries, parking, transit; (10) drives; (11) Canmore comparison;
(12) gaps. Drives are in section 1 and not repeated.

### Banff

1. GeoNames 5892532 (51.17622, -115.56982); Wikidata Q58337 (51.1781, -115.572). Elevation 1,400 m (Wikidata P2044). Zone
   `America/Edmonton` (tz `zone1970.tab`). VERIFIED.
2. Why: the most to do on foot, and a bus network to Lake Louise and Canmore. Why not: paid, busy downtown parking; a park
   pass for every day. INFERENCE from fields 8 and 9.
3. Hotels, cabins, bed and breakfasts, hostels, camping and RV, backcountry lodges (Banff & Lake Louise Tourism directory
   categories, https://www.banfflakelouise.com/accommodation, read 25 Oct 2026); Parks Canada campgrounds
   (https://parks.canada.ca/voyage-travel/reserve). VERIFIED.
4. `searched_none` (25 Oct 2026): operator rate pages are booking engines with no static rates; searches returned OTA and
   aggregator prices only, which are excluded. Area statistic: section 3 item 3.
5. Check-in from 16:00, check-out by 11:00, n=2 operator pages (read 25 Oct 2026). VERIFIED (small sample).
6. `none_stated` on the 2 operator pages read.
7. GAP for rooms. Campgrounds: Tunnel Mountain reservations opened 12 Feb 2026 for the season (Parks Canada).
8. National park pass needed (Parks Canada, item 6).
9. Groceries: GAP (no official page read). Parking: one paid downtown zone, CAD 12 an hour from 1 May to 31 Oct, 08:00 to
   20:00; the Train Station lot is free (banff.ca/parking, read 25 Oct 2026). Transit: Roam routes 1, 2 and 7 (local), 3
   (Canmore), 8X (Lake Louise, year-round), 9 (Johnston Canyon) (roamtransit.com, read 25 Oct 2026; seasons of 3 and 9 not
   stated).
11. See Canmore.
12. Groceries and their hours; room lead time; rates.

### Lake Louise village

1. OSM node 2665400241 (51.42497, -116.17754; D1 ruling); Wikidata Q12826048. Elevation 1,600 m (Wikidata P2044). Zone
   `America/Edmonton`. VERIFIED.
2. Why: 7 min from the Moraine and lakeshore Park and Ride and at the foot of the Parkway. Why not: a small village with few
   services. Why-not is INFERENCE (services not counted from a source).
3. Same directory as Banff (Lake Louise is in it); Lake Louise campground on Parks Canada reservations. VERIFIED.
4. `searched_none` (as Banff).
5. Check-in from 16:00, check-out by 11:00, n=1 operator page. VERIFIED (sample of one).
6. `none_stated` on the page read.
7. GAP for rooms; Lake Louise campground reservations opened 12 Feb 2026 (Parks Canada).
8. National park pass needed.
9. Groceries, parking: GAP. Transit: Roam 8X to Banff, year-round; Parks Canada shuttles to the lakeshore and Moraine from
   the Park and Ride (seasonal, item 5).
12. Groceries, parking, rates, lead time.

### Jasper

1. GeoNames 6354954 (52.87946, -118.08041); Wikidata Q999429 (52.8731, -118.082). Elevation 1,060 m (Wikidata P2044). Zone
   `America/Edmonton`. VERIFIED.
2. Why: the only base for Maligne, Robson and Miette in a day. Why not: fewer rooms since the fire, and far from every other
   base. Why INFERENCE (section 1 table); why-not community basis (section 3 item 7).
3. Hotels and inns, cabins and lodges, hostels, camping (Tourism Jasper, https://www.jasper.travel/where-to-stay/, read
   25 Oct 2026); Parks Canada campgrounds. VERIFIED.
4. `searched_none`.
5. `searched_none` (only aggregator listings came up).
6. `none_stated` (Tourism Jasper directory).
7. GAP for rooms; Jasper frontcountry campground reservations opened 27 Jan 2026 (Parks Canada).
8. National park pass needed.
9. Groceries, parking, transit: GAP.
12. Capacity figure (item 7), rates, check-in pattern, groceries.

### Kananaskis Village

1. OSM node 926027463 (50.91861, -115.14809; D1 ruling; Wikidata Q6360620 within about 130 m). Elevation: GAP (Wikidata has
   none). Zone `America/Edmonton`. VERIFIED.
2. Why: 85 min from the airport and the nearest base to Kananaskis Lakes and Highwood Pass. Why not: few lodgings and
   services. Why COMPUTED; why-not community basis (aggregator and guide pages, not stored).
3. Hotel lodging is present (guide pages, community basis); the Tourism Canmore Kananaskis directory has a Kananaskis
   filter (https://www.explorecanmore.ca/all-accommodations/) but lists no property in the village (read 25 Oct 2026).
   Kananaskis campgrounds: reservations "up to 90 days in advance" (Tourism Canmore Kananaskis FAQ). PARTLY VERIFIED.
4. `searched_none`.
5. `searched_none` (aggregators only).
6. `none_stated`.
7. Campgrounds 90 days ahead (above); rooms GAP.
8. Not in a national park. Kananaskis Conservation Pass for vehicles parked at public sites (CAD 15 a day, CAD 90 a year;
   alberta.ca, read 25 Oct 2026); a hotel's own lot: GAP (item 6).
9. Groceries, parking, transit: GAP (Roam lists no Kananaskis route).
12. Elevation, lodging count, the pass rule at hotel lots, groceries.

### Canmore

1. GeoNames 5914894 (51.08335, -115.35206); Wikidata Q991515 (51.08800, -115.34778). Elevation: GAP (Wikidata has none).
   Zone `America/Edmonton`. VERIFIED.
2. Why: outside the park, 30 min from Banff and 87 from the airport. Why not: Lake Louise and Moraine days get about 20 min
   longer each way. COMPUTED and VERIFIED (field 8).
3. Hotels, lodges, motels and inns, vacation rentals, hostels, cabins and huts, glamping, campgrounds (Tourism Canmore
   Kananaskis directory, https://www.explorecanmore.ca/all-accommodations/, read 25 Oct 2026). VERIFIED.
4. `searched_none`.
5. `searched_none` (aggregators only).
6. `none_stated`.
7. Campgrounds: Kananaskis sites up to 90 days ahead; the municipal campground is first come, first served (Tourism Canmore
   Kananaskis FAQ). Rooms GAP.
8. No national park pass and no Kananaskis pass for the townsite; both are needed outside it (Parks Canada, Alberta,
   Tourism Canmore Kananaskis). VERIFIED.
9. Groceries: GAP from an official page. Parking: four paid zones (Town Centre, Riverside Park, Boat Launch, Quarry Lake;
   canmore.ca, read 25 Oct 2026), rates not stated there; free options named by Tourism Canmore Kananaskis. Transit: Roam 3
   to Banff, 5C, 5T and 12 local.
11. Canmore against Banff and Lake Louise village: no band for any of the three (field 4), so no comparison. The page may
    say only "Cost not compared yet". The DATA-L1 "usually cheaper" claim is blog-only and stays out (rule S4).
12. Rates, check-in pattern, parking rates, groceries.

### Golden

1. GeoNames 5962582 (51.29995, -116.9689); Wikidata Q1020179 (51.3019, -116.967). Elevation 800 m (Wikidata P2044). Zone
   `America/Edmonton`, Mountain time (Town of Golden; tz). VERIFIED.
2. Why: a full town on the Trans-Canada, 47 min from Field and Yoho. Why not: off the Icefields Parkway, 70 min from the
   Moraine Park and Ride. COMPUTED.
3. Hotels and motels, cabins and cottages, lodges, vacation rentals, bed and breakfasts, camping, hostels (Tourism Golden,
   https://www.tourismgolden.com/accommodations/hotels, read 25 Oct 2026). VERIFIED.
4. `searched_none`.
5. `searched_none` (aggregators only).
6. `none_stated`.
7. Tourism Golden: "we highly recommend booking accommodation in advance for the high season and holiday weekends"; no
   months stated, so `months_ahead` is a GAP.
8. No national park pass to sleep in the town (INFERENCE: Golden is outside the parks); a pass for Yoho and the other parks.
9. Groceries, parking, transit: GAP.
10. Kicking Horse Canyon (Hwy 1 east of Golden) complete (section 3 item 5). BC booster rule applies in Golden (ICBC).
12. Rates, check-in pattern, groceries, lead time in months.

### Calgary airport (gateway)

1. Wikidata Q1160343 (51.113889, -114.020278), elevation 3,557 ft (Wikidata P2044, about 1,084 m). Zone `America/Edmonton`.
2. to 9. Not a base in any strategy. Area statistic: Calgary Airport hotels CBRE ADR CAD 155.62 for September 2025
   (section 3 item 3).

### Edmonton airport (open-jaw note only)

Wikidata Q269588 (53.31, -113.57944), elevation 2,373 ft (Wikidata P2044, about 723 m). Zone `America/Edmonton`. Jasper
269 min, Calgary airport 165 min (ORS).

## 5. Plus and minus points that still rest on our inference

- Banff why / why not (field 2), Lake Louise why-not, Jasper why, Golden "outside the parks".
- `left_out` of plan day 1's Banff evening items in the three-base strategies, and "the Parkway driven three times".
- Hinton and Valemount as fallbacks (no per-day routing).
- `fewer-moves` "Banff has a third night": an availability question, kept as `unknown`.

## 6. Gaps (searched 25 Oct 2026)

- Price bands for all six base towns: operator pages give no static rates; OTA prices are excluded.
- Check-in patterns for Jasper, Kananaskis Village, Canmore and Golden; Lake Louise n=1 and Banff n=2 only.
- Room booking lead times in months for every town.
- Groceries for every town from an official or operator page; parking for Lake Louise, Jasper, Golden.
- Elevation for Canmore and Kananaskis Village (no Wikidata P2044).
- Jasper capacity after the fire from Tourism Jasper or the Municipality.
- Edmonton to Calgary one-way availability and fee.
- Banff to Highwood Pass and the other day legs (STY-L pairs in the run note).
