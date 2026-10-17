# Research lane: ROUTE & LOGISTICS (raw data)

Trip: Sat 10 Oct - Mon 12 Oct 2026 (Mon = Canadian Thanksgiving). Base: 1679 Port Cunnington Rd, Dwight ON. Research date: 2026-09-27.

Method notes and reliability flags (read first):
- Drive times/distances are OSRM (router.project-osrm.org, OpenStreetMap data, free-flow car profile, NO holiday traffic). Source: https://router.project-osrm.org/ (table + route endpoints, queried by script 2026-09-27). Treat as best-case minimums.
- Coordinates used: Whitby 43.8798,-78.9422 (Nominatim); Dwight village 45.3310,-79.0115 (Nominatim); Huntsville 45.3264,-79.2184; West Gate Info Centre 45.4421,-78.8209 (OSM way "West Gate Information Centre", Hwy 60 km 0 milestone at 45.4422,-78.8209); Track & Tower = Cache Lake parking 45.5524,-78.5932 (OSM, km 25.0 per Friends km table); Visitor Centre 45.5836,-78.3596 (km 43.0); Ragged Falls 45.3883,-78.9044; Oxtongue Lake 45.3680,-78.9265; Dorset 45.2439,-78.8939; Baysville 45.1498,-79.1151; Bracebridge 45.0415,-79.3110; Arrowhead PP 45.3916,-79.2004.
- GAP: exact point for 1679 Port Cunnington Rd not geocodable (Nominatim returned nothing for the address or the road). I used the middle of OSM "Port Cunnington Road" ways (45.2521,-79.0316), which is about 9 km SW of Dwight village. Times from "Dwight (PCR approx)" carry an error of maybe +/-5-10 min. Also: the brief's postal code P0C 1J0 could not be matched; sources show Dwight/Oxtongue as P0A 1H0 (https://nominatim.openstreetmap.org search "Oxtongue Lake" result display name). Confirm the address with the host.
- GAP: "1212 S Limberlost Rd" not verified anywhere. Limberlost Forest & Wildlife Reserve's official address is 1002 Buck Lake Landing, Huntsville P1H 2J6 (https://limberlostforest.com/). Main gate is "3 km off Muskoka Road 8" (Muskoka Rd 8 = Limberlost Road; source in 9 below). I used OSM point 45.3996,-79.0052 (node "Limberlost Forest and Wildlife Reserve"). Trailhead-specific time could differ by 5+ min.
- WebSearch tool summaries are LLM-written and were wrong at least once in this lane (WMU 54 deer season: a fetch summary said rifles from 1 Oct; the primary PDF says bows only, guns from 2 Nov). Where I could, I verified against primary PDFs/APIs and say so.

---

## 1. Whitby -> Dwight route options

All OSRM free-flow. Distances to Dwight village (Hwy 60 / Hwy 35 junction area); add ~14 km / ~17 min to reach the approximated Port Cunnington Rd point (OSRM: Whitby->PCR approx 213 km, 202 min; PCR approx->Whitby 213 km, 204 min).

| Option | Roads | km (to Dwight village) | Free-flow time | Tolls | Source |
|---|---|---|---|---|---|
| A. Hwy 12 north (OSRM default best route) | Brock St/Hwy 12 N from Whitby (~16 km incl. local), Hwy 12 through Beaverton area toward Orillia (Hwy 7/12 concurrency ~29 km, Hwy 12 ~33 km), Simcoe/Muskoka CR 169 (~25 km), Hwy 11 N (~71 km), Hwy 60 E from Huntsville (~21 km) | 200 (Whitby->Dwight); return Dwight->Whitby 199 km, 187 min | 186 min (return 187) | None | OSRM route Whitby->Dwight, script output 2026-09-27; Hwy 12 description https://en.wikipedia.org/wiki/Ontario_Highway_12 ("Whitby to Orillia, 146 km") |
| B. 401 W across Toronto -> 400 N -> 11 N | 401 (~50 km) -> 400 (~73 km to Barrie) -> Hwy 11 (~120 km) -> Hwy 60 (~21 km) | 129 (Whitby->Barrie) + 152 (Barrie->Dwight) = ~281 | 93 + 126 = ~219 min | None | OSRM Whitby->Barrie (129 km/93 min) + Barrie->Dwight (152 km/126 min) |
| C. Hwy 412 (free) -> 407 ETR (toll) -> 400 N -> 11 N | 412 N to 407, 407 W ~52 km to Hwy 400, 400 N to Barrie, 11 N | ~131 km Whitby->Barrie via 407 waypoint + 152 = ~283 | ~100 + 126 = ~226 min (OSRM does not prefer 407; forced via waypoint) | 407 ETR: 2026 weekend/stat-holiday light-vehicle rates 50.49c to 87.27c per km depending on zone/time; $1.00 trip toll; $5.30 camera charge without transponder. 52 km x 0.5049..0.8727 = approx $26 to $45 (my arithmetic; not a quote). Hwy 412 is toll-free since 5 Apr 2022. | https://www.407etr.com/en/rate-chart-light ; https://en.wikipedia.org/wiki/Ontario_Highway_412 |
| D. Hwy 35 / 115 via Lindsay-Minden-Dorset | 401 E (~25 km) -> Hwy 35/115 -> Hwy 35 N through Lindsay, Minden, Dorset (~139 km on Hwy 35) -> Dwight | 226 | 212 min | None | OSRM via-waypoint route (Lindsay 44.356,-78.743; Minden 44.92,-78.72; Dorset) |

Notes:
- GAP: OSRM public server rejected `exclude=toll`; whether option C is actually faster than B on the day cannot be shown from free-flow data. No live-traffic source was queried.
- GAP: 407 ETR page did not state explicitly that Thanksgiving Monday gets weekend rates; the table heading is "Weekends and Ontario Statutory Holidays" which implies it does (https://www.407etr.com/en/rate-chart-light). Sat 10 Oct and Sun 11 Oct are weekend rates.
- Hwy 12 is not a proven congestion escape: a forum-derived summary says it is "very busy on Friday afternoons and evenings" and "will not save you any time" when the 400 is bad (WebSearch summary of https://www.tripadvisor.com/ShowTopic-g154979-i54-k9724027-London_to_Muskoka_via_407_and_highway_12-Ontario.html; low quality, not verified).
- Speed limits: Hwy 60 in Algonquin is 80 km/h with frequent truck traffic (https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/).

### Thanksgiving congestion pattern (evidence is thin)
| Claim | Quality | Source |
|---|---|---|
| Hwy 400 (Toronto-Muskoka) and Hwy 11 have "extreme congestion" Friday afternoon and Monday afternoon of the long weekend | Low: site cites no sources, no byline, date field "Invalid Date" | https://www.canada-spirit.com/guides/canada-thanksgiving-explained/ |
| Hwy 400 northbound Friday 4-8 pm needs patience or a ~12:00 noon departure (this is a general cottage-season statement, NOT Thanksgiving-specific; article does not address Thanksgiving) | Medium for summer weekends, dated 19 May 2026 | https://www.lake.com/articles/best-time-to-go-to-muskoka/ |
| Southbound Monday: cottage-country traffic on the 400 peaks around midday, sometimes still jammed at 7 pm, sometimes clear by then, "no guaranteed way"; 401 westbound Oshawa/Whitby area busy Monday noon to 8 pm | Low: 680 News reporter quote, article dated 8 Oct 2005 | https://www.theglobeandmail.com/news/national/highway-to-hell-tactics-to-beat-the-holiday-traffic/article987761/ |
| Same source: reporter avoided the 400 and used alternate routes to Haliburton (2.5 h vs 2-4 h on 400) | Low, 2005 | same |
| Algonquin Park itself: "Thanksgiving weekend is particularly busy"; Hwy 60 corridor day permits sold out on multiple Thanksgiving-adjacent dates in 2025; West Gate is the congested gate; East Gate (via Peterborough-Bancroft-Whitney) suggested as alternative | High (official) | https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ ; https://www.algonquinpark.on.ca/visit/general_park_info/fall-colour-report.php |

- GAP: no 2024/2025 measured Thanksgiving-weekend volumes, delay minutes, or MTO/OPP hour-by-hour data found for Hwy 400/11/12 (searches on OPP, CTV, Global, muskoka411 returned only enforcement stats and incident stories). Specific "best departure/return hour" therefore cannot be sourced. What can be stated from the evidence: Friday PM and Monday midday-PM are the historically bad windows; Saturday morning northbound and Monday morning/early southbound are the commonly advised alternatives (lake.com and canada-spirit, both low-medium quality). Whitby is at the tail of the southbound flow (Hwy 401 EB/WB Oshawa-Whitby), so the Monday evening leg ends on a 401 that was reported busy to ~8 pm on Thanksgiving Monday in 2005.
- OPP enforcement was heavy on the 2025 Thanksgiving weekend (8,800+ province-wide charges, 4,518 speeding) (search summary; OPP releases: https://www.orilliamatters.com/police-beat/thanksgiving-weekend-blitz-to-focus-on-risky-driver-behaviours-11328377).

Daylight-based timing anchors (from section 4): sunset Sat 18:39, Sun 18:37, Mon 18:35 at Dwight; a Monday-evening return leaving Dwight at 17:00 is ~187 min free-flow = ~20:07 Whitby arrival, in the dark for the last ~1.5 h.

---

## 2. Drive-time matrix (OSRM free-flow, minutes / km)

Source: https://router.project-osrm.org/table/v1/driving/ (annotations=duration,distance), run 2026-09-27. Rows = from, columns = to. Symmetric within ~2 min. Shown as min (km).

| From \ To | Dwight PCR (approx) | Dwight village | Limberlost (approx) | Huntsville | West Gate km 0 | Track&Tower km 25 (Cache Lk) | Visitor Ctr km 43 | Oxtongue Lk | Ragged Falls | Dorset | Baysville | Bracebridge | Arrowhead PP | Whitby |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dwight PCR (approx) | - | 17 (14) | 42 (34) | 37 (34) | 35 (33) | 59 (57) | 79 (78) | 23 (20) | 27 (24) | 28 (25) | 51 (45) | 68 (71) | 57 (43) | 204 (213) |
| Dwight village | 17 (14) | - | 25 (20) | 20 (21) | 22 (22) | 45 (46) | 65 (67) | 10 (10) | 14 (13) | 18 (19) | 34 (31) | 51 (57) | 40 (30) | 187 (200) |
| Limberlost (approx) | 42 (34) | 25 (20) | - | 28 (23) | 46 (43) | 70 (67) | 90 (87) | 34 (30) | 38 (34) | 43 (39) | 52 (45) | 59 (60) | 48 (32) | 195 (202) |
| Huntsville | 37 (34) | 20 (21) | 28 (23) | - | 42 (43) | 65 (67) | 86 (88) | 30 (30) | 34 (34) | 38 (39) | 25 (24) | 31 (36) | 23 (12) | 167 (178) |
| West Gate | 35 (33) | 22 (22) | 46 (43) | 42 (43) | - | 23 (24) | 44 (45) | 12 (12) | 9 (9) | 36 (38) | 56 (53) | 73 (79) | 62 (52) | 209 (221) |
| Track&Tower | 59 (57) | 45 (46) | 70 (67) | 66 (67) | 23 (24) | - | 22 (21) | 36 (36) | 33 (33) | 60 (62) | 79 (77) | 96 (103) | 85 (76) | 232 (245) |
| Visitor Centre | 79 (78) | 65 (67) | 90 (87) | 86 (88) | 44 (45) | 23 (21) | - | 56 (57) | 53 (54) | 80 (83) | 100 (98) | 117 (124) | 106 (97) | 251 (277) |
| Oxtongue Lake | 23 (20) | 10 (10) | 34 (30) | 30 (30) | 12 (12) | 35 (36) | 56 (57) | - | 4 (4) | 24 (25) | 44 (41) | 61 (67) | 50 (39) | 197 (209) |
| Ragged Falls | 27 (24) | 14 (13) | 38 (34) | 34 (34) | 9 (9) | 33 (33) | 53 (54) | 4 (4) | - | 28 (29) | 48 (44) | 65 (70) | 54 (43) | 201 (212) |
| Dorset | 28 (25) | 18 (19) | 42 (39) | 38 (39) | 36 (38) | 60 (62) | 80 (83) | 24 (25) | 28 (29) | - | 30 (27) | 53 (50) | 58 (47) | 188 (191) |
| Baysville | 51 (45) | 34 (31) | 52 (45) | 25 (24) | 55 (53) | 79 (77) | 99 (98) | 43 (41) | 47 (44) | 30 (27) | - | 23 (23) | 48 (36) | 159 (165) |
| Bracebridge | 68 (72) | 52 (59) | 59 (60) | 31 (36) | 73 (81) | 96 (105) | 117 (124) | 61 (68) | 65 (72) | 53 (50) | 23 (23) | - | 49 (46) | 141 (143) |
| Arrowhead PP | 58 (42) | 41 (29) | 48 (31) | 24 (12) | 62 (51) | 86 (75) | 106 (95) | 50 (38) | 54 (42) | 59 (48) | 49 (36) | 49 (46) | - | 185 (187) |

(Table compiled from the raw OSRM matrices; small asymmetries between directions were averaged/rounded by hand to the nearest value shown. Whitby column = to Whitby; Whitby->X is within ~2-3 min. Dwight village->Whitby direct route run separately: 199 km / 187 min.)

Cross-checks: Hwy 60 km markers from https://www.algonquinpark.on.ca/visit/park_management/kilometre-markings.php : West Gate 0.0, Track and Tower Trail 25.0, Visitor Centre 43.0, Spruce Bog Boardwalk 42.5, Lookout Trail 39.7, Two Rivers Trail 31.0, Peck Lake 19.2, Mizzy Lake 15.4, Whiskey Rapids 7.2, Big Pines 40.3, Logging Museum 54.5, East Gate 56.0, Opeongo access 46.3. Website states 56 km corridor, West Gate km 0 to East Gate km 56 (https://www.algonquinpark.on.ca/visit/camping/highway-60-corridor.php).

Caveats: in-park times are free-flow at posted speed; OSRM does not model the Thanksgiving queue at West Gate or parking-lot delays. The Limberlost column is an approximation (see method notes). The Dwight PCR column is an approximation.

---

## 3. Algonquin day-use permit (Hwy 60 corridor), 2026

| Item | Detail | Source |
|---|---|---|
| Daily vehicle permit, Hwy 60 corridor | $21.00 per vehicle per day, HST included; covers one vehicle and all occupants (max 14) | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php ; https://www.ontarioparks.ca/dayuse/faq ; https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Validity | 7:00 am to 10:00 pm on the date of issue, so each day needs its own permit: Sat, Sun and Mon = up to 3 permits (inference from "valid on the date of issue") | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php |
| Where to buy | Online via Ontario Parks reservations up to 5 days in advance, sales open 7:00 am ET daily; phone 1-888-668-7275 (7 am - 9 pm). By my count of "5 days in advance", Sat 10 Oct permits open Mon 5 Oct 7 am, Sun 11 Oct opens Tue 6 Oct, Mon 12 Oct opens Wed 7 Oct (inference, not stated) | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php |
| Gate sales: CONFLICT | (a) Algonquin Friends fee page: "Permits are not available for purchase in-person." (b) Algonquin Friends seasonal-fees page: purchase "upon arrival at park facilities if stock permits" and via self-serve fee stations (WebFetch summary). (c) Ontario Parks FAQ: "gate purchases remain available" but "only way to guarantee your day use spot is purchasing ahead". (d) Ontario Parks blog: "100% of daily vehicle permits are available in advance." (e) Friends of Algonquin Facebook / My Bancroft Now: when the corridor sells out, permits cannot be bought at the gate and seasonal passes do not get you in. | (a) https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php (b) https://www.algonquinpark.on.ca/visit/general_park_info/fees-seasonal-use.php (c) https://www.ontarioparks.ca/dayuse/faq (d) https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ (e) https://www.mybancroftnow.com/64163/news/day-permits-sold-out-for-algonquin-parks-highway-60-corridor-on-saturday/ |
| Sell-out risk on Thanksgiving | Official fall-colour report (26 Sep 2026) names Thanksgiving weekend Oct 10/11/12 as expected busy; states Hwy 60 permits sold out on multiple Thanksgiving-adjacent dates in 2025; "All day-use visitors must reserve online up to 5 days in advance; permits frequently sell out." Treat as advance-purchase-only for planning. | https://www.algonquinpark.on.ca/visit/general_park_info/fall-colour-report.php |
| Seniors | Ontario residents 65+: 20% off. Ontario Parks 2026 range for seniors is $9.75-$16.75, so $16.75 is likely the Algonquin figure (inference; page does not print it). Bring ID. | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php ; https://www.ontarioparks.ca/fees/dayuse/2026 |
| Disability | 50% off for Ontario residents with CNIB card or MTO disabled parking permit (about $10.50) | same |
| Armed forces/veterans | Free, Ontario residents, weekdays only (so Mon 12 Oct qualifies only if it counts as a weekday; statutory holiday rule not stated) | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php |
| Seasonal passes 2026 | Annual vehicle $111.87 (Jan 1-Dec 31); Summer $84.75 (Apr 1-Nov 30); Winter $67.80 (Dec 1-Mar 31). Valid at all Ontario provincial parks. BUT seasonal holders still need a free advance reservation when the park reaches capacity; passes do not guarantee entry. | https://www.algonquinpark.on.ca/visit/general_park_info/fees-seasonal-use.php ; https://www.ontarioparks.ca/dayuse/getapermit ; https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Cost sanity check | 2 days at $21 = $42 vs summer pass $84.75; 3 days = $63. Pass does not pay off on this trip alone. | arithmetic |
| Location-specific | At multi-location parks like Algonquin, a permit is location-specific (Hwy 60 corridor permit is not valid at other Algonquin day-use areas) | https://www.ontarioparks.ca/dayuse/faq |
| Refunds | Non-refundable; date/location changes not permitted; full refund only if cancelled within 2 hours of purchase | https://www.ontarioparks.ca/dayuse/faq ; fees-day-use page |
| Booth's Rock Trail | Special permit required 12 Sep - 18 Oct 2026 (daily vehicle permit type, same $21); only if hiking that trail | https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php |

GAP: whether a permit is needed to merely drive through on Hwy 60 without stopping was not answered by any fetched page. Do not assume an exemption.
GAP: whether Ragged Falls (Oxtongue River-Ragged Falls PP) and Arrowhead each require their own daily permit for Oct 2026: a search summary says Ragged Falls is an "operating park" needing a permit; the ontarioparks.ca park page fetch printed no fee. Ontario Parks day-use range is $12.25-$21.00 for 2026 (https://www.ontarioparks.ca/fees/dayuse/2026). Park-specific price not found. Assume separate permit and separate location.

### Fall-season facility and closure data
| Item | Detail | Source |
|---|---|---|
| Hardwood Lookout Trail | CLOSED "Fridays and holiday Mondays": weekends Oct 2-4 and Oct 9-12 (Canadian Thanksgiving) | https://www.ontarioparks.ca/park/algonquin/alerts |
| Tea Lake Campground | Day-use only on fall weekends 12 Sep - 12 Oct; washrooms weekends only in that window | https://www.ontarioparks.ca/park/algonquin/alerts ; https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Fork Lake Trail | New 2.4 km trail at Visitor Centre, rated difficult, steep sections | https://www.ontarioparks.ca/park/algonquin/alerts |
| Gates | East Gate and West Gate offices open daily 8:00 am - 6:00 pm; Visitor Centre 9:00 am - 5:00 pm daily (Visitor Centre page itself defers to events calendar; 9-5 comes from the alerts page and Ontario Parks blog) | https://www.ontarioparks.ca/park/algonquin/alerts ; https://www.algonquinpark.on.ca/visit/locations/algonquin_visitor_centre.php |
| Office closures from 2026 | Opeongo Access Point office, Lake of Two Rivers campground office, Kawawaymog office all closed for 2026 season onward | https://www.ontarioparks.ca/park/algonquin/alerts |
| Backcountry | Provoking Falls bridge removed; Highview Cabin closed; multiple creeks low water | same |
| Visitor Centre location | Hwy 60 km 43.0 | https://www.algonquinpark.on.ca/visit/locations/algonquin_visitor_centre.php |
| Oxtongue River-Ragged Falls PP | Day use "Open", 2026 operating dates May 8 - Oct 18, 2026; zero active alerts as of 27 Sep 2026; hours not printed | https://www.ontarioparks.ca/park/oxtongueriverraggedfalls ; https://www.ontarioparks.ca/park/oxtongueriverraggedfalls/alerts |
| Arrowhead PP alerts (27 Sep 2026) | Beaver Meadow Trail closed (boardwalk construction, until further notice); Stubb's Falls Trail stair construction with an uphill detour; East River campground comfort station construction Mon-Fri 8-5; campground water shutoff 19 Oct. Park operating Jan 1-Dec 31 2026. Day-use fee not printed. | https://www.ontarioparks.ca/park/arrowhead/alerts ; https://www.ontarioparks.ca/park/arrowhead |
| Fall colour, Algonquin (26 Sep 2026 report) | Sugar and Red Maple canopy at best colour; average peak west Hwy 60 corridor Sep 27 (record range Sep 15 1982 to Oct 9 1996); by Oct 10-12 the colour is likely past peak (inference from those dates); Ontario Parks page 25 Sep 2026: 80% colour change, 10% leaf fall (search summary) | https://www.algonquinpark.on.ca/visit/general_park_info/fall-colour-report.php ; https://www.ontarioparks.ca/fallcolour |
| Limberlost Forest & Wildlife Reserve | Free public trails; open daily 9:00 am - 5:00 pm; signed safety waiver required (online or at kiosk); dogs on leash; no drones; 12 named trails (Clear Lake 1.5 km, Solitaire 6.3, Buck Lake 4.3, High Lake 1.8, Hickory Lake 2.3, Hickory Creek 2.5, Turtle Lake 4.7, Kalonga Wetland 5.8, Buck Lake Lookout 0.7, Ski Hill 1.3, Echo Rock 5.5, Helve Lake 1.5). Note the 9-5 hours: not a sunrise or post-sunset venue. | https://limberlostforest.com/ ; https://limberlostforest.com/activities/hiking-trails/ ; https://limberlostforest.com/rules-regulations/ |

---

## 4. Sunrise / sunset / civil twilight (EDT, UTC-4)

Method: Python `astral` 3.x (`astral.sun.sun`, civil twilight = dawn/dusk at solar depression 6 degrees), run 2026-09-27 via `uv run --with astral`, timezone America/Toronto. Cross-check: Environment Canada page for 27 Sep 2026 shows Huntsville sunrise 07:10 / sunset 19:05 and Lake of Two Rivers 07:07 / 19:02; astral gave 07:10 / 19:04 and 07:07 / 19:01 (within 1 minute). Sources: https://weather.gc.ca/en/location/index.html?coords=45.325,-79.218 and https://weather.gc.ca/en/location/index.html?coords=45.58,-78.48

Dwight (45.3333, -78.9667):
| Date | Civil dawn | Sunrise | Solar noon | Sunset | Civil dusk | Daylight |
|---|---|---|---|---|---|---|
| Sat 10 Oct | 06:55 | 07:25 | 13:02 | 18:39 | 19:09 | 11 h 13 m |
| Sun 11 Oct | 06:56 | 07:27 | 13:02 | 18:37 | 19:07 | 11 h 10 m |
| Mon 12 Oct | 06:58 | 07:28 | 13:02 | 18:35 | 19:05 | 11 h 07 m |

Huntsville (45.3269, -79.2166): 10 Oct 06:56 / 07:26 / 18:40 / 19:10; 11 Oct 06:57 / 07:28 / 18:38 / 19:08; 12 Oct 06:59 / 07:29 / 18:36 / 19:06 (dawn / sunrise / sunset / dusk).

Algonquin West Gate (45.5497, -78.5497 used for calc; West Gate is really 45.4421,-78.8209, difference under 3 min): 10 Oct 06:54 / 07:24 / 18:37 / 19:07; 11 Oct 06:55 / 07:25 / 18:35 / 19:05; 12 Oct 06:56 / 07:26 / 18:33 / 19:03.

---

## 5. Hunting, 10-12 Oct 2026

KEY CORRECTION: the brief assumed WMU 48/49. A spatial query of Ontario's WMU layer puts the trip locations elsewhere.

WMU lookup method: ArcGIS point-in-polygon on the LIO Open Data Wildlife Management Unit layer, field OFFICIAL_NAME. Endpoint: https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5

| Place | WMU |
|---|---|
| Dwight village | 50 |
| Port Cunnington Rd (approx point) | 53A |
| Huntsville | 53A |
| Baysville | 53A |
| Limberlost (approx point) | 50 |
| Arrowhead PP | 50 |
| Oxtongue Lake | 54 |
| Algonquin West Gate | 51 |

GAP: WMU 51 (Algonquin) does not appear in the season tables (Algonquin Park is closed to hunting except mention of "excluding parts of WMU 54 which lie within Algonquin"). Boundaries near the Port Cunnington point could flip between 53A and 50 because the address point is approximate.

Season dates from the primary PDF: Ontario Hunting Regulations Summary 2026-2027, https://www.ontario.ca/files/2026-03/mnr-2026-ontario-hunting-regulations-summary-en-2026-03-10.pdf (downloaded, pdftotext, grep). Deer/moose also cross-checked at https://www.ontario.ca/page/tentative-dates-deer-and-moose-hunting-seasons

| Species | WMU 50 / 53A / 54 | Open on 10-12 Oct? | PDF page |
|---|---|---|---|
| Ruffed grouse (and spruce grouse) | Sept 15 to Dec 31 (WMU 5-15, 19-23, 28-50, 53-67, 69B); daily limit 5 combined, possession 15 | YES, open | p.~"Small game" table |
| Deer, bows only | WMU 50, 53A, 54: Oct 1 to Nov 1 and Nov 16 to Dec 15 (53A: also splits Nov 16-29 / Dec 7-15 in tentative table) | YES, archery only | p.42 |
| Deer, rifles/shotguns/muzzleloaders + bows | WMU 50, 53A, 54: Nov 2 to Nov 15 | NO, opens after the trip | p.40 |
| Deer, muzzleloader/bows | 53A: Nov 30 to Dec 6 (tentative table) | NO | ontario.ca tentative dates |
| Black bear, fall | WMU 50, 53: Sept 8 to Nov 30; WMU 54: Sept 1 to Nov 30 | YES, open | p.78 |
| Moose | WMU 46-50, 53-63: Oct 19 to Oct 25 (resident, gun season); no non-resident season | NO, starts a week after the trip. (WMU 54 falls in "53-63".) | p.56 |
| Wolf/coyote | Illegal to hunt in and around Algonquin PP | n/a | p.84 |

Hunter orange (regulation text, same PDF, General Regulations p.28, and https://www.ontario.ca/document/ontario-hunting-regulations-summary/general-regulations):
- Required for all licensed hunters during a GUN season for deer, elk or moose (min 400 sq in / 2,580 sq cm garment above the waist plus head cover, visible from all sides; solid, no mesh or camo).
- Also required for bear hunters during the bear season when it is not also a deer/elk/moose gun season, except when in a tree stand.
- NOT required by regulation for grouse hunters or archery-only deer hunters when no deer/elk/moose gun season is open. On 10-12 Oct no deer or moose gun season is open in these WMUs, so the only legally orange-mandated hunters are bear hunters not in a tree stand. Practical advice (my recommendation, not a regulation): wear a blaze orange hat and vest/jacket in any Crown land or forest outside the park anyway because grouse and bear hunters are active and orange is not compulsory for grouse hunters.
- Hunting is prohibited in Algonquin PP (park-wide; the WMU 54 deer note excludes Algonquin lands). GAP: no fetched page explicitly states "hunting is prohibited in Algonquin" in those words for the Hwy 60 corridor; the exclusion note in the PDF (p.42 footnote) and the wolf/coyote closure (p.84) are the verified items.
- Limberlost Reserve: "Firearms of any kind are not allowed" and "Hunting and the use of ATVs for game retrieval is not allowed in the reserve" (https://limberlostforest.com/rules-regulations/). So hunting inside Limberlost is banned by the owner, but GAP: hunters may still be on adjoining Crown/private land and on Muskoka Rd 8 / Hwy 60 approaches; no source on actual hunter traffic along Hwy 60 outside the park was found.

---

## 6. Cell, fuel, EV, wildlife

### Cell coverage
| Item | Detail | Source |
|---|---|---|
| Official statement | "Limited cellular phone service is available along the Highway 60 Corridor"; not necessarily on secondary park roads, access points or developed campgrounds; none in the backcountry; do not rely on it for emergencies. Page links Bell, Rogers, Telus coverage maps. | https://www.algonquinpark.on.ca/visit/park_management/cell-phones-and-cellular-coverage-in-algonquin-park.php (fetched raw HTML) |
| Per-carrier | GAP: official page gives NO per-carrier breakdown. A search summary claimed "exclusively Bell and Telus" but I could not confirm it from that page (fetched raw HTML says nothing of the sort). Do not rely on that claim. | n/a |
| Dead zone | Ontario Parks blog: service limited "especially between Kilometre 20-30.6" (Track and Tower at km 25 is inside this) | https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Limberlost | Property's own note (rentals page): "Rogers and their subsidiaries are strong, Bell and their subsidiaries is spotty" | https://limberlostforest.com/what-to-bring/ |
| Trailhead-level | GAP: no source gives coverage at Ragged Falls, Track & Tower, or other trailheads by carrier. Carrier maps: https://www.rogers.com/mobility/network-coverage-map ; Bell and Telus maps linked from the Algonquin page. |

### Fuel
| Location | Detail | Source |
|---|---|---|
| Ontario Parks guidance | "Last stations at Huntsville/Dwight (west) or Whitney (east)". Fill up before entering. | https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Dwight | Shell, 25888 Hwy 35 (45.3237,-78.9957), with Webster's Corner Store and an LCBO Agency next door | OSM via Overpass API https://overpass-api.de/api/interpreter (queried 2026-09-27) |
| Oxtongue Lake, Hwy 60 (CONFLICT) | OSM shows three fuel points: XTR at 4015 Hwy 60 (45.3667,-78.9276), Parkway Gas at 4412 Hwy 60 (45.3794,-78.9192), Curv-Inn at 5280 Hwy 60 (45.4042,-78.8772, near Ragged Falls). A 2010 community-news headline "Gas Pains in Oxtongue Lake" exists but I could not read it (certificate error). Ontario Parks says last gas is Huntsville/Dwight. GAP: current 2026 open/closed status and hours of Oxtongue stations unverified; plan on Dwight/Huntsville for the last sure fill. | OSM Overpass query; https://www.oxtonguelake.ca/community-news/2010/gas-pains-on-oxtongue-lake/ (unreadable) |
| Inside the park | A search summary says one vehicle gas station exists at the Portage Store (Canoe Lake) with unreliable availability, and boat gas at Opeongo. GAP: unconfirmed for 2026. | WebSearch summary (frontenacpark.ca / other) |
| Huntsville | Many: Shell (2 Main St E), Esso (134 Hwy 60), Petro-Canada (Capstone Lane 2, 59 King William), Canadian Tire Gas Bar (45.3353,-79.2053), Mobil, Ultramar, Sunoco | OSM Overpass |
| East side of Algonquin | Algonquin Outfitters fuel point at 45.6356,-78.3601 (OSM, Hwy 60 east area); Whitney per Ontario Parks | OSM Overpass |
| Distance from Dwight village to Huntsville | 20 min / 21 km | OSRM |

### EV charging
| Site | Detail | Source |
|---|---|---|
| Huntsville Tesla Supercharger | Huntsville Place Mall, 70 King William St, 8 stalls, described as Tesla-only; OSM shows 24/7 | https://explorehuntsville.ca/electric-vehicle-charging-stations/ ; OSM |
| Ivy at Harvey's | 150 Hanes Rd, 4 spots, "universal charger" (level not stated) | same |
| Town of Huntsville | Bell parking lot, 11 High St, 4 spots (specifics not stated) | same |
| Others | Deerhurst Resort (patrons only, 2 Tesla + 1 J1772), Edmonds GM 125 Hanes Rd (1 J1772), Blue Water Acres 1052 Rat Bay Rd (FLO, 1 spot) | same |
| Bracebridge | Tesla Supercharger (OSM) | OSM Overpass |
| Dwight | Two Level 3 fast chargers (4 vehicles) planned at Township of Lake of Bays Municipal Office, Dwight, by Lakeland EV Charging; construction tentatively from May 2026, "operational by mid-to-late 2026". GAP: not confirmed operating as of Oct. | https://www.muskokaradio.com/news/local/ev-charging-project-moves-ahead-in-lake-of-bays/ (17 Apr 2026) |
| Baysville | Level 3 planned, operational "spring 2028 or earlier" (not available) | same |
| Dorset, Oxtongue, Algonquin corridor | GAP: no charging found in these sources. | n/a |
| Charger levels / non-Tesla access at Supercharger | GAP: not stated. Verify on PlugShare/ChargeHub: https://chargehub.com/en/countries/canada/ontario/huntsville.html |

### Wildlife
| Item | Detail | Source |
|---|---|---|
| Moose/deer on Hwy 60 | Moose and deer common in Algonquin "especially at night and in the morning," a major driving hazard; OPP: dusk and dawn most active, whole park is a wildlife crossing area, use high beams when clear, observe speed limits | search summary of OPP-linked coverage https://www.cbc.ca/news/canada/ottawa/moose-collisions-algonquin-killaloe-1.3552042 ; https://cottagelife.com/general/moose-involved-in-two-collisions-in-algonquin-park-over-victoria-day-long-weekend/ |
| Documented incidents | All incidents found are spring (mid-May, Victoria Day weekend). GAP: no October-specific collision statistics or moose-rut warning found. | same |
| Dusk risk this trip | Sunset 18:35-18:39 and civil dusk ~19:05-19:09 (section 4). Any return from the park after ~18:00 is in low light, Hwy 60 is 80 km/h. Any Monday-evening southbound 11/12 driving also falls after dark from ~19:05. | section 4 |
| Bear | GAP: no source found on October bear activity in the corridor. Bear hunting season is open (section 5), which is the only bear-related fact verified. |
| Parking | Park only in designated lots; do not stop suddenly on Hwy 60; transport trucks frequent | https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |

---

## 7. Weather for 10-12 Oct

Stations: ECCC "DWIGHT" 6082178 (45.383,-78.900; on Hwy 60 at Oxtongue; data 1973-2005) and "ALGONQUIN PARK EAST GATE" 6080192 (2004-2026, far east end of corridor, not Dwight). Data pulled from MSC GeoMet-OGC API on 2026-09-27: https://api.weather.gc.ca/collections/climate-normals/items?CLIMATE_IDENTIFIER=6082178&MONTH=10 (monthly normals) and https://api.weather.gc.ca/collections/climate-daily/items?CLIMATE_IDENTIFIER=6082178&datetime=YYYY-10-10/YYYY-10-12 (daily). Station list: https://api.weather.gc.ca/collections/climate-stations/items?bbox=-79.6,45.0,-78.3,45.7&HAS_NORMALS_DATA=Y (Dwight 6082178, Dorset MOE 6112072, Beatrice 2 6110606 are the only stations with normals in the area).

Caveat: these normals period is 1981-2005 for Dwight, older than the current 1991-2020 normals; no Huntsville-area station has 1991-2020 normals.

| Metric | Dwight stn (Oct monthly normal, 1981-2005) | Dwight stn, empirical Oct 10-12 only (1973-2005; 33 years, 99 station-days) | Algonquin East Gate, Oct 10-12 (2004-2025; 22 years, 66 days) |
|---|---|---|---|
| Mean daily max | 10.7 C (October mean) | 12.4 C (range 2.0 to 22.8) | 14.7 C (range 5.2 to 25.1) |
| Mean daily min | 1.7 C (October mean) | 1.9 C (lowest -8.0) | 0.8 C (lowest -5.4) |
| Nights at or below 0 C | 14 nights in October | 40 of 99 (about 40%) | 35 of 66 (about 53%) |
| Precipitation | Oct total 113.9 mm; rain 107.1 mm, 6.9 cm snow; 18.0 days with precip >=0.2 mm | Measurable (>=0.2 mm) on 53 of 99 days (54%); >=5 mm on 18 of 99 (18%); mean 2.7 mm/day | >=0.2 mm on 25 of 62 days (40%); >=5 mm on 4 of 62 (6%) |
| Snow | 2.8 days with snowfall >=0.2 cm; snow depth >=1 cm on 1.3 days | Any snowfall on 5 of 99 days (5%), max 4.6 cm | not computed |
| Thunderstorms/freezing rain | 1.3 thunder days; 0.2 freezing rain days (Oct) | n/a | n/a |

First frost (first day with min <= 0 C, searching from 15 Aug): Dwight stn, 33 years: earliest Aug 28, median Sep 18, latest Oct 7. East Gate, 22 years: earliest Sep 2, median Sep 15, latest Oct 7. In every year on record the first sub-zero night had already occurred by 10 Oct (100% of years for both stations). So 10-12 Oct is well past first frost.

Current EC forecast context (snapshot 27 Sep 2026 15:30 EDT): 7-day forecast only runs to Sat 3 Oct (Huntsville highs 16-21 C; Algonquin/Lake of Two Rivers similar). Climate normal shown on EC's own page for that date: Huntsville "Max 16 C, Min 5 C"; Lake of Two Rivers "Max 16 C, Min 4 C". GAP: no forecast covers 10-12 Oct until roughly 3-5 Oct; check again then.

Forecast URLs:
| Purpose | URL |
|---|---|
| Huntsville 7-day (city page code on-88) | https://weather.gc.ca/en/location/index.html?coords=45.325,-79.218 |
| Huntsville hourly | https://weather.gc.ca/en/forecast/hourly/index.html?coords=45.325,-79.218 |
| Algonquin Park (Lake of Two Rivers, on-29; observed at East Gate) | https://weather.gc.ca/en/location/index.html?coords=45.58,-78.48 |
| Oxtongue Lake (on-53) | https://weather.gc.ca/en/location/index.html?coords=45.38,-78.93 (station code from https://api.weather.gc.ca/collections/citypageweather-realtime/items; page not fetched) |
| ECCC climate normals search | https://climate.weather.gc.ca/climate_normals/ |
| ECCC API city forecasts | https://api.weather.gc.ca/collections/citypageweather-realtime/items?f=json&lang=en&bbox=-79.6,45.0,-78.3,45.8 |

Whitby is not covered above; forecast for the drive corridor can use Orillia/Barrie ECCC pages (not queried).

---

## 8. Road conditions and construction

| Item | Detail | Source |
|---|---|---|
| Ontario 511 | Real-time incidents, construction, closures, 900+ cameras; site https://511on.ca/ (Ontario511.ca), free app (Google Play / App Store), phone dial 511, X feed. The Ontario Parks blog also tells visitors to check 511on.ca. Only Hwy 60 note found on landing page: no oversize/overweight loads through Douglas on Hwy 60 (Douglas is east of Algonquin, not on this route). | https://511on.ca/ ; https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Incident list | https://511on.ca/list/events/traffic | search result listing |
| Algonquin traffic | Park posts real-time updates on X @Algonquin_PP and Facebook | https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ |
| Muskoka District roads | https://www.muskoka.on.ca/en/roads-and-transportation/road-construction-and-closures.aspx (page dated to 21 Sep 2026) |
| MTO Southern Highways Program 2025-2028 (data as of 16 Dec 2025) | https://www.ontario.ca/files/2026-01/mto-2025-2028-southern-ohp-en-2026-01-27.pdf (downloaded, pdftotext) |

MTO program entries relevant to the route (status "Planned"/"Underway" only; the document gives NO dates, lane closures or long-weekend restrictions):
| Highway / location | Work | Status / target completion | Notes |
|---|---|---|---|
| Hwy 11, Muskoka Rd 169 to Muskoka Rd 6 interchange (4.5 km) | Resurfacing | Planned, target 2026 | on route A/B/C/D corridor south of Gravenhurst |
| Hwy 11, Old Barrie Rd and Coldwater Rd, Orillia | Bridge replacement | Planned 2026, completion not available | on the Hwy 11 route through Orillia |
| Hwy 400, Hwy 12 north junction / Simcoe Rd 16 to Severn (7.1 km) | Resurfacing | Planned, 2026 | between Coldwater and Severn on 400 |
| Hwy 400, Hwy 9 to North Canal Rd, Holland River (2.4 km) | Bridge replacement | Underway, complete 2027 | Bradford area, options B/C |
| Hwy 400/CR 88 interchange, Bradford West Gwillimbury | Bridge replacement | Underway, 2028 | options B/C |
| Hwy 400, Dunlop St underpass, Barrie | Bridge replacement/interchange | Underway, 2028 | options B/C |
| Hwy 401, Courtice Rd to Stevenson Rd EB (9.5 km) and Wilson Rd overpass, Oshawa | Bridge/resurfacing | Underway, 2028 / 2026 | adjacent to Whitby; option B/D departure |
| Hwy 407 ETR/E, Brock Rd to Hwy 35/115 | Safety improvements | Planned 2027-2028 | not this trip |
| Hwy 11, 1.9 km north of Hwy 60 northerly 10.7 km (Huntsville) | Resurfacing | Planned 2027-2028 | not this trip |
| Hwy 35/60, Muskoka Rd 117 to Hwy 60 incl. Boyne Creek Culvert #3, Ballantyne Creek Culvert, Coopers Creek Culvert, Dwight (17.7 km) | Culvert replacement + resurfacing | Planned 2027-2028 | design upcoming; not this trip |
| Hwy 35 south of Hwy 121 south junction (18.6 km) | Resurfacing | Planned 2027-2028 | option D |
GAP: no entries found for Hwy 60 in Algonquin, Hwy 117, or Hwy 118 in Oct 2026. Actual Thanksgiving-weekend lane-closure moratoria were not found; check 511 the week of.

Muskoka District roads (from https://www.muskoka.on.ca/en/roads-and-transportation/road-construction-and-closures.aspx, 21 Sep 2026): Muskoka Rd 8 (Limberlost Rd) slurry seal, N Tasso Lake Rd to end (4.4 km), 2026; Muskoka Rd 2 Locks Bridge single-lane signals through fall 2026; MR 12, 13, 51 FDREAM through fall 2026 (single-lane during working hours, open nights/weekends); MR 117 microsurfacing completed late Aug; MR 118 microsurfacing scheduled complete Sep 2026. GAP: whether MR 8 (route to Limberlost) work is finished by 10 Oct is not stated.

---

## 9. Thanksgiving effects, groceries, LCBO

| Item | Detail | Source |
|---|---|---|
| Date | Sat 10 Oct, Sun 11 Oct, Mon 12 Oct 2026 = Canadian Thanksgiving (Monday) | trip brief; astral weekday check |
| LCBO | Closed on Thanksgiving Monday; Sundays typically about 11 am - 6 pm at most stores (Sunday hours from a low-quality blog) | https://www.cp24.com/local/toronto/2025/10/13/what-is-open-and-closed-in-toronto-on-thanksgiving-monday-2025/ (2025 Monday closed); https://barrie360.com/thanksgiving-open-closed/ (2025); https://afterdarkquick.com/blog/lcbo-beer-store-hours-ontario/ |
| Beer Store | Closed on Thanksgiving Monday (2025 notice; expect same). Huntsville Beer Store OSM tag: Sun 11:00-17:00, Sat 10:00-20:00 (OSM, unverified) | https://www.thebeerstore.ca/news/the-beer-store-operating-hours-for-thanksgiving-monday-october-13th (title only, page not fetched) ; OSM |
| LCBO locations near the base | LCBO Huntsville (45.3354,-79.2030), LCBO Dorset (45.2461,-78.8934), LCBO Agency next to Shell/Webster's Corner Store in Dwight (45.3221,-78.9942) per OSM. GAP: agency-store hours not found; agency stores may follow different holiday hours from corporate LCBOs. | OSM Overpass |
| Grocery, Thanksgiving Monday 2025 precedent | Barrie360's 2025 list shows FreshCo Huntsville and Metro Huntsville among stores OPEN on Thanksgiving Monday, plus Food Basics Bracebridge and Foodland stores in the region; no hours printed. Broad Toronto coverage says "most grocery stores will be closed" and lists only a few open chains. GAP: no Oct 2026 hours are published yet; Huntsville hours on 12 Oct 2026 unverified. | https://barrie360.com/thanksgiving-open-closed/ ; https://www.cp24.com/local/toronto/2025/10/13/what-is-open-and-closed-in-toronto-on-thanksgiving-monday-2025/ |
| Nearest supermarket to Dwight | Dorset Foodland, 1061 Main St, Dorset (45.2454,-78.8942): 18 min / 19 km from Dwight village (OSRM). Huntsville has FreshCo (12 Cann St; OSM hours Mo-Su 07:00-21:00, phone 705-789-9172), Metro (70 King William St, Huntsville Place), Your Independent Grocer (Hanes Rd area): 20 min / 21 km from Dwight village. From the approximate Port Cunnington point: Dorset 28 min, Huntsville 37 min. | OSRM; OSM Overpass; https://explorehuntsville.ca/listing/fresh-co/ |
| Dorset Foodland hours | Directory summaries say Mon-Fri 9-7, Sat 10-7, closed Sunday; phone 705-766-2415. GAP: these are old directory data (a 2019-dated listing) and the Foodland site returned HTTP 403; do not rely on them. | WebSearch summary of https://dorset.open-closed.ca/foodland-hours-1061-main-st |
| Metro Huntsville | Summary says Mondays 8:00-18:00. GAP: metro.ca returned HTTP 403 and yellowpages 403; unverified. | https://www.metro.ca/en/find-a-grocery/249 (403) |
| FreshCo Huntsville (Paisley) | store page 403; OSM hours are the only figure found | https://www.freshco.com/stores/freshco-huntsville-paisley (403) |
| Restaurants | GAP: no source on Huntsville/Baysville/Dwight restaurant Sun/Mon hours in Oct. Muskoka accommodation "sells out 2-3 months ahead" for this weekend (low-quality site) https://www.canada-spirit.com/guides/canada-thanksgiving-explained/ |
| Gas and convenience | OSM lists Circle K, Capstone Market, M&S Simply Food in Huntsville and Webster's Corner Store in Dwight; hours not given |
| Ontario retail rule | The Retail Business Holidays Act closes most retail on Thanksgiving Monday except tourist-area exemptions (not fetched; Muskoka municipalities' exemption status is a GAP) |

Practical implication from the sources (not a recommendation to the traveller): stock up on Saturday and Sunday; do not count on LCBO/Beer Store on Monday.

---

## Consolidated GAP list
1. Exact position of 1679 Port Cunnington Rd (geocoder failed) and postal code P0C 1J0 unverified; Limberlost "1212 S Limberlost Rd" unverified.
2. No measured Thanksgiving traffic data for 400/11/12/401; best hour windows unsupported beyond low-quality statements.
3. Algonquin gate/walk-up permit sales: the official pages contradict each other; permit-required-to-drive-through unanswered.
4. Ragged Falls and Arrowhead 2026 fee amounts and hours not printed.
5. Per-carrier cell coverage on Hwy 60 and at trailheads.
6. Oxtongue-area gas station status 2026; October bear/moose behaviour data; no restaurant hours.
7. Dwight EV chargers operational status; non-Tesla access at Huntsville Supercharger; charger levels for Ivy/Town sites.
8. 2026 Thanksgiving Monday hours for Huntsville supermarkets and Dorset Foodland; LCBO Agency hours in Dwight.
9. MTO/Muskoka construction dates for Oct 10-12 (only program-level data).
10. 10-12 Oct forecast (not published until about 3-5 Oct).
