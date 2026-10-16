# Research lane 3 — route & driving logistics

RAW DATA for synthesis. Not a human-facing report. Every claim carries a source URL.
`GAP:` marks anything unverified.

Route researched (fixed): Las Vegas → Springdale/Zion → Kanarraville → Bryce Canyon → Page →
Monument Valley → [UT-261 Moki Dugway → Natural Bridges] → Hanksville → Moab → Durango →
Silverton → Ouray → Breckenridge → [Pinedale or Rock Springs WY] → Jackson/Grand Teton →
Yellowstone → Salt Lake City.

**Dates: the brief said "late Sep – mid Oct 2027, fallback ~10 Sep – 4 Oct 2028." While this
lane was running, `travel/CLAUDE.md` was updated to record the dates as DECIDED: 10 Sep – 4 Oct
2028.** Both windows are covered below. Section 9 carries sun tables for both; §3.4, §11 and §12
explain why the 2028 window is materially safer for the Colorado and Wyoming legs.
Base substitutions recorded in CLAUDE.md (Frisco not Breckenridge, Moose/Dornans not Jackson,
Hanksville not Torrey) were re-routed and are small, with one exception — see §1.4.

## Contents

- §0 — Method note on distances and times — READ THIS FIRST
- §1 — Leg-by-leg distances and times
- §2 — The Breckenridge → Jackson leg — routing options and the overnight split
- §3 — Million Dollar Highway — US-550, Durango ↔ Silverton ↔ Ouray
- §4 — Moki Dugway — UT-261
- §5 — Unpaved / high-clearance sections — vehicle class and what happens when wet
- §6 — One-way rental Las Vegas → Salt Lake City, and the unpaved-road clause
- §7 — Cell coverage dead zones and where offline maps are mandatory
- §8 — Fuel — prices and the no-service stretches
- §9 — Sunrise, sunset and daylight saving
- §10 — Border and entry for a Canadian, and drones
- §11 — Elevation profile, passes, and altitude
- §12 — Seasonal road closures that bound the driving plan (bonus — not in the brief but load-bearing)
- §13 — Consolidated GAPs and the calls that close them

---

## 0. Method note on distances and times — READ THIS FIRST

**Google Maps and the Google Directions API were not reachable from this environment.**
GAP: Google Maps drive times — no fetchable endpoint; maps.google.com and the Directions API
both require a key/JS. Every distance and duration below was computed instead by querying two
independent open routing engines over the same OpenStreetMap road network:

- **Valhalla** (public FOSSGIS instance) — `https://valhalla1.openstreetmap.de/route`, costing
  profile `auto`. Docs: <https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/>
- **OSRM** demo server — `http://router.project-osrm.org/route/v1/driving/...`.
  Docs: <http://project-osrm.org/docs/v5.24.0/api/>
- Underlying road data: OpenStreetMap, <https://www.openstreetmap.org/copyright>

**Distances from the two engines agree to within ~1% on every leg** and can be treated as solid.
**Durations diverge and must be treated as estimates, not sourced times.** OSRM's demo profile
applies a very heavy penalty to unpaved surfaces (it returned 5h28 for the 73-mile Monument
Valley → Natural Bridges leg, which is nonsense); Valhalla's numbers are far closer to reality
and are the ones quoted in the main table. Where Valhalla is itself optimistic or pessimistic,
it is flagged per leg in §1.2.

Waypoints used (lat, lon): LAS airport 36.0840/−115.1537 · Springdale 37.1889/−113.0263 ·
Kanarraville 37.5375/−113.1799 · Bryce Canyon City 37.6714/−112.1567 · Page 36.9147/−111.4558 ·
Monument Valley (The View) 36.9829/−110.1116 · Mexican Hat 37.1519/−109.8645 · Moki Dugway top
37.2727/−109.9297 · Natural Bridges VC 37.6083/−110.0128 · Hanksville 38.3719/−110.7146 ·
Torrey 38.2994/−111.4194 · Moab 38.5733/−109.5498 · Durango 37.2753/−107.8801 · Silverton
37.8119/−107.6645 · Ouray 38.0228/−107.6712 · Breckenridge 39.4817/−106.0384 · Rock Springs
41.5875/−109.2029 · Pinedale 42.8666/−109.8607 · Lander 42.8330/−108.7307 · Jackson
43.4799/−110.7624 · Moose/GTNP 43.6588/−110.7169 · Old Faithful 44.4605/−110.8281 · Canyon
Village 44.7348/−110.4936 · Mammoth 44.9766/−110.7036 · Gardiner 45.0316/−110.7057 · SLC
40.7608/−111.8910 · Stansbury Island 40.8382/−112.5289.

---

---

## 1. Leg-by-leg distances and times

### 1.1 Main table (Valhalla / OSM; distance cross-checked against OSRM)

| # | Leg | Miles | Km | Valhalla est. | OSRM est. |
|---|---|---|---|---|---|
| 1 | LAS airport → Springdale (I-15 N → SR-9) | 170.2 | 274.0 | 3h22 | 3h42 |
| 2a | Springdale → Kanarraville | 43.8 | 70.6 | 0h54 | 0h59 |
| 2b | Kanarraville → Bryce Canyon City | 100.9 | 162.3 | 1h45 | 1h58 |
| 2 | **Day total Springdale → Kanarra → Bryce** | **144.7** | **232.9** | **2h39** | **2h57** |
| — | (direct Springdale → Bryce, no Kanarra) | 85.5 | 137.7 | 1h47 | 2h12 |
| 3 | Bryce Canyon City → Page AZ (UT-12 → US-89 S via Kanab → US-89 E) | 149.7 | 240.9 | 2h39 | 3h09 |
| 4 | Page → Monument Valley (AZ-98 → US-160 → US-163) | 125.5 | 202.0 | 2h17 | 2h40 |
| 5a | Monument Valley → US-163 → **UT-261 / Moki Dugway** → UT-275 → Natural Bridges VC | 73.0 | 117.4 | 2h25 | 5h28 |
| 5b | Natural Bridges → Hanksville (UT-95 → UT-24) | 103.0 | 165.7 | 2h46 | 4h37 |
| 5 | **Day total Monument Valley → Hanksville** | **176.0** | **283.2** | **5h12** | **10h06** |
| 6 | Hanksville → Moab (UT-24 → I-70 → US-191) | 108.7 | 175.0 | 1h58 | 2h04 |
| 6alt | Hanksville → Torrey (Capitol Reef) | 47.8 | 76.9 | 1h01 | 1h07 |
| 6alt | Torrey → Moab (via UT-24/I-70) | 156.1 | 251.3 | 2h58 | 3h09 |
| 7 | Moab → Durango (US-191 → US-491 → US-160) | 160.0 | 257.5 | 2h49 | 3h18 |
| 8a | Durango → Silverton (US-550, Coal Bank + Molas) | 48.3 | 77.7 | 0h52 | 0h57 |
| 8b | Silverton → Ouray (**Million Dollar Hwy**, Red Mtn Pass) | 23.5 | 37.8 | 0h25 | 0h53 |
| 8 | **Durango → Ouray total** | **71.7** | **115.4** | **1h18** | **1h51** |
| 9 | Ouray → Breckenridge (US-550 → **US-50 Monarch Pass** → US-285 → US-24 → **CO-9 Hoosier Pass**) | 239.3 | 385.1 | 4h19 | 5h26 |
| 9alt | Ouray → Grand Junction → I-70 E → Breckenridge (over **Vail Pass**) | 280.8 | 451.9 | 4h40 | — |
| 10 | Breckenridge → Rock Springs WY | 317.8 | 511.5 | 5h38 | 6h20 |
| 10alt | Breckenridge → Pinedale WY | 416.8 | 670.8 | 7h36 | 8h10 |
| 10alt | Breckenridge → Lander WY | 345.1 | 555.4 | 6h32 | 8h08 |
| 11 | Rock Springs → Jackson (US-191 via Pinedale) | 179.1 | 288.3 | 3h41 | 3h34 |
| 11alt | Pinedale → Jackson | 77.1 | 124.1 | 1h34 | 1h36 |
| 11alt | Lander → Dubois → Jackson (Togwotee Pass) | 160.6 | 258.5 | 3h15 | 3h24 |
| — | (Breckenridge → Jackson, one hop, via Rock Springs) | 494.0 | 794.9 | 9h11 | 9h46 |
| 12 | Jackson → Moose / Grand Teton HQ | 13.3 | 21.5 | 0h18 | 0h22 |
| 13 | Jackson → Old Faithful (via GTNP + South Entrance) | 97.9 | 157.5 | 2h09 | 2h45 |
| 14 | Old Faithful → Canyon Village | 42.4 | 68.2 | 1h03 | 1h17 |
| 15 | Canyon Village → Mammoth | 32.7 | 52.6 | 0h48 | 1h00 |
| 15b | Mammoth → Gardiner MT | 5.1 | 8.3 | 0h08 | 0h15 |
| 16 | Gardiner → Salt Lake City | 375.9 | 604.9 | 6h13 | 7h19 |
| 16alt | West Yellowstone → Salt Lake City | 322.2 | 518.5 | 4h54 | 5h34 |
| 16alt | Old Faithful → Salt Lake City (direct) | 354.0 | 569.6 | 5h42 | 6h34 |
| 17 | Salt Lake City → Stansbury Island | 47.3 | 76.0 | 1h03 | 1h16 |
| — | (Moab → SLC, if the trip were cut short there) | 233.8 | 376.3 | 3h56 | 4h34 |

**Point-to-point transit total for the itinerary as routed** (legs 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
11, 13, 14, 15+15b, 16): **2,396.7 mi / 3,857 km.** Add in-park and day-loop driving (Zion
shuttle-free days, Bryce rim road, Monument Valley 17-mile loop, Arches ~45 mi/day, Canyonlands
Island in the Sky ~65 mi round trip from Moab, Grand Teton loops, Yellowstone Grand Loop, the
Stansbury Island round trip ~95 mi) and the ~2,820 mi figure in BRAINSTORM.md is consistent.
GAP: in-park mileage not individually routed.

### 1.1b Effect of the base substitutions recorded in `travel/CLAUDE.md`

Re-routed with the same engine (Valhalla / OSM). Substituting the bases is nearly free, except that
**the Ouray → Frisco leg is not simply "Ouray → Breckenridge minus 10 miles" — the engine picks a
different corridor entirely.**

| Substitution | Distance | Km | Est. | Note |
|---|---|---|---|---|
| Breckenridge ↔ Frisco (the shift itself) | 9.9 | 15.9 | 0h13 | CO-9 / I-70 |
| Jackson ↔ Moose / Dornans (the shift itself) | 13.3 | 21.5 | 0h18 | US-89/191 |
| **Ouray → Frisco** | **264.0** | **424.8** | **4h15** | vs Ouray → Breckenridge 239.3 mi / 4h19 |
| **Frisco → Rock Springs** | **308.7** | **496.9** | **5h26** | vs Breckenridge → Rock Springs 317.8 mi / 5h38 |

**Ouray → Frisco is 25 miles LONGER but 4 minutes shorter**, because from Frisco the engine prefers
the I-70 / Grand Junction corridor over the two-lane Monarch Pass / US-285 / Hoosier Pass line.
That is a real trade, not a rounding error: choosing Frisco quietly swaps **Monarch Pass (11,312 ft)
and Hoosier Pass (11,542 ft)** for **Vail Pass (10,662 ft) on the interstate**. Lower, faster and
far safer in an early-season storm — but it also removes both of the trip's highest passes and the
Hoosier Pass drive that BRAINSTORM Day 17 lists as content.
**Flag for synthesis: if the scenic Monarch/Hoosier line is wanted, it has to be requested
explicitly; it is no longer the default once the base moves to Frisco.**
Frisco → Rock Springs is 9 miles shorter and unchanged in character (CO-9 north to Kremmling).

### 1.2 Where the routing-engine time is wrong, and which way

Flagged per leg. "Google-optimistic" means any nominal drive time understates the real day.

| Leg | Verdict | Why |
|---|---|---|
| 1. LAS → Springdale | Engine **pessimistic**; a nominal ~2h45 is about right in free-flow | SR-9 through La Verkin/Virgin/Rockville has long 25–45 mph stretches that Valhalla weights heavily. Real risk is the opposite: **Friday/Sunday I-15 traffic out of Las Vegas** and a possible queue at the Zion entrance. |
| 3. Bryce → Page | Realistic | US-89 is fast two-lane. **Clock trap: Page is MST year-round while Utah is MDT — you gain an hour crossing into Arizona in Sept/Oct.** See §9. |
| 5a. Monument Valley → Natural Bridges via Moki Dugway | **Any engine time here is unreliable.** OSRM's 5h28 is absurd; Valhalla's 2h25 for 73 mi is plausible only if you do not stop | The Dugway is 3 mi of unpaved switchbacks at ~5–15 mph, and nobody drives it without stopping at the top and at Muley Point. Budget **half a day**, not 2h25. |
| 5b. Natural Bridges → Hanksville | Realistic-to-optimistic | UT-95 is empty, fast, and 100+ mi with **zero services** (§8). Add stops for Hite/Colorado River crossing viewpoints. |
| 8. Durango → Silverton → Ouray | **Valhalla is badly optimistic.** 0h25 for the 23.5 mi Silverton→Ouray section implies ~56 mph over Red Mountain Pass, which is not achievable | US-550 through the Uncompahgre Gorge is a no-shoulder, no-guardrail shelf road with hairpins; OSRM's 0h53 is nearer the truth. Treat **Durango → Ouray as a full day with stops**, not 1h18. |
| 9. Ouray → Breckenridge | Engine optimistic by ~30–45 min | Crosses **Monarch Pass** (11,312 ft, 6% grades for 9–10 mi each side) and finishes over **Hoosier Pass** (11,542 ft, 8% switchbacks on the north side). Two-lane US-50/US-285 with slow trucks and few passing lanes. The I-70 alternative via Grand Junction is 41 mi longer but nearly all interstate — a fair-weather fallback if Monarch is snowed. |
| 10. Breckenridge → Rock Springs | Realistic | CO-9/US-40/CO-13/WY-789 is fast, empty two-lane. Wind is the variable, not traffic. |
| 11. Rock Springs → Jackson | Realistic | US-191 high desert; the last 30 mi into Jackson can queue in season. |
| 13–15. Inside Yellowstone | **All engine times are optimistic.** Park-wide speed limit is 45 mph and NPS quotes 50 min for the ~37 mi South Entrance → Grant Village alone | Bison jams and pull-outs. NPS's own drive-time table is the authority: <https://www.nps.gov/yell/planyourvisit/directions.htm> |
| 16. Gardiner → SLC | Realistic | I-15 the whole way south of Idaho Falls. |

### 1.3 Two hard constraints inside legs 2 and 13

- **Zion Canyon Scenic Drive is shuttle-only.** "During the shuttle season, visitors _cannot_
  drive personal vehicles on the Zion Canyon Scenic Drive." 2026 season ran **May 17 – Nov 28**
  (first bus 07:00; last out of the Visitor Center 18:00 from Sept 13, 17:00 from Oct 25). No
  ticket or reservation needed. Personal vehicles only "during the non-shuttle season, usually
  December through February."
  <https://www.nps.gov/zion/planyourvisit/zion-canyon-shuttle-system.htm>
  → A late-Sep/mid-Oct trip is fully inside shuttle season. The car is parked for two days in Zion.
- **Zion–Mt Carmel Tunnel size limits** (SR-9 eastbound, i.e. the Springdale → Bryce/Page leg).
  Single vehicle max: length 35'-9", **width 7'-10"**, **height 11'-4"**, weight 50,000 lb.
  Combined vehicle: total length 50'-0", same width/height/weight.
  <https://www.nps.gov/zion/planyourvisit/the-zion-mount-carmel-tunnel.htm>
  → A full-size or premium SUV (~6'6"–6'10" body, ~7' across mirrors) clears this without an
  escort. A roof box does not breach 11'-4". Only a towed trailer or an RV triggers the escort.
  GAP: current tunnel escort fee and escort hours — the NPS page above does not state them.

---

---

## 2. The Breckenridge → Jackson leg — routing options and the overnight split

### 2.1 Headline finding: (a) and (b) are the same road

Reading the actual turn-by-turn from both engines, **the default Breckenridge → Rock Springs route
IS the Steamboat / Craig / Baggs corridor.** There is no "fast vs scenic" choice on this leg —
the scenic one is the fast one. Forcing waypoints through Steamboat/Craig/Baggs returns
318.1 mi / 5h41 (Valhalla), identical to the unconstrained 317.8 mi / 5h38.

Road sequence (OSRM `steps=true`, <http://router.project-osrm.org>):

| Road | Miles |
|---|---|
| CO-9 Breckenridge → Silverthorne → Kremmling | 49.3 |
| US-40 Kremmling → Muddy Pass → Rabbit Ears → Steamboat → Craig | 93.5 |
| CO-13 Craig → Wyoming line at Baggs | 38.2 |
| WY-789 Baggs → Creston Jct | 53.6 |
| I-80 / US-30 Creston Jct → Rock Springs | 79.8 |

Useful sub-legs: Breckenridge → Steamboat **103.0 mi / 1h54**; Steamboat → Craig 42.0 mi / 0h51;
Craig → Rock Springs 173.0 mi / 3h05.

### 2.2 The three corridors compared

| | (a) Rock Springs split | (b) Pinedale split | (c) Lander / Wind River |
|---|---|---|---|
| Day 1 | Breck → Rock Springs **317.8 mi / 5h38** | Breck → Pinedale **416.8 mi / 7h36** | Breck → Lander **345.1 mi / 6h32** |
| Day 2 | Rock Springs → Jackson **179.1 mi / 3h41** | Pinedale → Jackson **77.1 mi / 1h34** | Lander → Dubois → Jackson **160.6 mi / 3h15** |
| Total | 496.9 mi | 493.9 mi | 505.7 mi |
| Divide crossings | Muddy 8,772 ft + **Rabbit Ears 9,426 ft** | same | **Muddy 8,772 ft only** + **Togwotee 9,655 ft** |
| Balance | lopsided, easy day 1 | brutal day 1, superb day 2 | **most balanced — both halves under 7h** |

Passes, sourced:
- **Muddy Pass 8,772 ft / 2,674 m**, US-40 — "one of the lower crossings of the continental divide
  in Colorado," "rarely closed in winter," "gentle grades without switchbacks."
  <https://en.wikipedia.org/wiki/Muddy_Pass_(Continental_Divide)>
- **Rabbit Ears Pass 9,426 ft / 2,873 m**, US-40 — "often receives a great deal of snow in winter
  and is subject to regular short closures during heavy winter storms"; westbound descent is a
  **6.8% grade with a single runaway truck ramp**. <https://en.wikipedia.org/wiki/Rabbit_Ears_Pass>
- **Togwotee Pass 9,655 ft / 2,943 m**, US-26/287 — annual snow "frequently surpasses 25 feet
  (7.6 m), with some reports documenting over 50 feet (15 m)"; "**sweeping vistas of the Teton
  Range are visible from the western slopes of the pass**"; "the road can be shut down for days at
  a time during blizzards." <https://en.wikipedia.org/wiki/Togwotee_Pass>

Corridor character:
- **(a)/(b) north of Craig**: CO-13 runs from developed areas into "remote terrain," "grassland and
  barren terrain dotted with shrubs." <https://en.wikipedia.org/wiki/Colorado_State_Highway_13>
  Then WY-789 for 53.6 mi across the Great Divide Basin edge to I-80. Empty, two-lane, unlit.
  GAP: no official WYDOT/Wyoming tourism description of WY-789 Baggs→Creston — travelwyoming.com
  road-trips index 404'd.
- **US-191 Rock Springs → Pinedale**: "continues northward at Rock Springs, traveling through high
  desert country for **98 miles (158 km)** through Eden and Farson to Pinedale."
  <https://en.wikipedia.org/wiki/U.S._Route_191_in_Wyoming>. Engine: 102.0 mi / 2h06.
- **Pinedale → Jackson**: "At Pinedale, the route becomes concurrent with the Wyoming Centennial
  Scenic Byway… The terrain becomes increasingly mountainous, passing through Bondurant before
  descending through the **Hoback River Canyon** to Jackson." Same source. A genuinely scenic 90 min.
- **(c) does not go the way you would expect.** Both engines route Breckenridge → Rawlins **north
  through North Park**, not east via Denver and not via Laramie: CO-9 → US-40 to Muddy Pass →
  **CO-14 through Walden** → CO-125 → WY-230 (Riverside / Encampment / Saratoga) → I-80 to Rawlins.
  Breck → Rawlins **221.7 mi / 4h11**; Rawlins → Lander 125.1 mi / 2h25 on US-287/WY-789 through
  Muddy Gap and Jeffrey City. This corridor **skips Rabbit Ears entirely** and runs the Upper North
  Platte valley — Carbon County lists Hobo Hot Springs in Saratoga (free, 24/7), the Grand
  Encampment Museum, 300+ miles of trout streams. <https://www.wyomingcarboncounty.com/>
- **(c) finish**: Lander → Dubois → Togwotee → Moran Jct → Jackson is the **Wyoming Centennial
  Scenic Byway** — 163 mi / 262 km, a Forest Service Byway since 1989, crossing Shoshone and
  Bridger-Teton NFs and Grand Teton NP, with "the Absaroka and Teton mountain ranges… high meadows,
  coniferous and aspen meadows and opportunities to see elk, pronghorn, coyote, moose."
  <https://en.wikipedia.org/wiki/Wyoming_Centennial_Scenic_Byway>

### 2.3 Options checked and rejected

- **Via Laramie / I-80**: Breck → Laramie → Rawlins = **277.5 mi / 5h48** vs 221.4 mi direct —
  a **56-mile detour**. Worse, it uses the Rawlins–Laramie stretch: "the 77-mile section… earned
  the nickname '**Snow Chi Minh Trail**'… one of the nation's most closure-prone interstates."
  <https://en.wikipedia.org/wiki/Interstate_80_in_Wyoming>
- **Via Flaming Gorge (US-191 south of Rock Springs)**: Breck → Flaming Gorge Dam → Rock Springs =
  **377.3 mi / 6h58** — **+59 mi and +1h17** over direct, via Craig → Maybell → Dinosaur → Vernal UT.
  Flaming Gorge NRA is legitimate (<https://www.explorewy.com/>) but as a *transit* choice it eats
  the day. **Verdict: it is a day trip from Rock Springs, not a routing.**
- **Via Salt Lake City**: Breck → SLC = **464.5 mi / 7h18** (CO-9 → I-70 west 275.4 mi through
  Glenwood Canyon → US-6/191 → I-15). Then SLC → Jackson via **Star Valley US-89** = 273.3–276.0 mi
  / ~5h10–5h30 (I-80 to Evanston → UT-16 → WY-30 → US-89 up the Salt River valley → Alpine → Snake
  River Canyon into Jackson from the south), **or** via Idaho Falls / I-15 = 303.0 mi / 4h49 ending
  over **Teton Pass on WY-22** (steep 10% grade). Totals **737.7 mi** (Star Valley) or **767.5 mi**
  (Idaho Falls) versus 494 mi direct — **+244 to +274 miles and a mandatory second overnight**.
  Only worth it if SLC itself is wanted; if so, take Star Valley, not Idaho Falls.
  GAP: 2026 status of WY-22 / Teton Pass after the June 2024 roadway collapse and rebuild — WYDOT's
  route-condition query is a form POST that cannot be driven by a fetcher, and WebSearch was
  unavailable. Check `wyoroad.info` route WY22 before relying on it.

### 2.4 What is actually in each candidate overnight town

Populations and elevations from the Wikipedia city articles for each town.

| Town | Pop (2020) | Elev | Chain hotels | Verdict |
|---|---|---|---|---|
| **Rock Springs WY** | 23,526 | 6,388 ft | ~6 in town | Functional, characterless |
| Green River WY | 11,825 | 6,115 ft | 1 (Hampton) | Skip — 15.8 mi past Rock Springs |
| **Pinedale WY** | 2,005 | 7,175 ft | 3 + 11 independents | **Best split for (a)/(b)** |
| **Lander WY** | 7,546 | 5,358 ft | effectively 1 | **Best split for (c)** |
| Dubois WY | 911 | 6,946 ft | GAP | Too small, too far along |
| Steamboat Springs CO | 13,224 | 6,867 ft | many | Only 103 mi from Breck — wastes the day |
| Craig CO | 9,060 | 6,198 ft | GAP | Too early; elk-season pressure |
| Rawlins WY | 8,221 | 6,834 ft | GAP | Truck-stop town |

- **Rock Springs** — 5th-most populous city in Wyoming, energy town, "57 Variety Town." Sweetwater
  County tourism lists **12 hotels/inns county-wide, 8 of them national chains**: Baymont, Best
  Western Outlaw Inn, Comfort Inn & Suites, Days Inn, Four Points by Sheraton, Hampton Inn (all
  Rock Springs) + Hampton Inn & Suites Green River.
  <https://www.explorewy.com/eat-and-sleep/hotels-and-inns/>
  Food is better than expected — Boars Tusk Steakhouse, Bravura Steak House, Broadway Burger
  Station, Casa Chavez, Boschetto's European Market, Square State Brewing, alongside the chains.
  <https://www.explorewy.com/eat-and-sleep/dining-and-nightlife/restaurants/>
  Nearby: Flaming Gorge NRA, Killpecker Sand Dunes, Pilot Butte Wild Horse Scenic Loop, Seedskadee
  NWR — all of which need half a day you will not have. <https://www.explorewy.com/>
- **Pinedale** — 7,175 ft, pop 2,005, hunting-outfitter town. **14 lodging properties, 3 national
  chains** (Best Western Pinedale Inn, Hampton Inn & Suites, Quality Inn & Suites) plus Log Cabin
  Motel, Jackalope Motor Lodge, Chambers House B&B, Gannett Peak Lodge and two campgrounds.
  <https://www.visitpinedale.org/where-to-stay>
  Content: **Museum of the Mountain Man**; **Fremont Lake**, "four miles from Pinedale… Wyoming's
  second largest natural lake"; White Pine Ski Area; Wind River Range gateway.
  <https://en.wikipedia.org/wiki/Pinedale,_Wyoming>
  GAP: restaurant list — visitpinedale.org dining page not reachable. For a town of 2,000 in
  hunting season assume 5–10 places and early closing.
- **Lander** — **5,358 ft, the lowest sleeping elevation of any candidate**, which matters after
  Breckenridge. NOLS headquarters and Wyoming Catholic College. **Sinks Canyon State Park is
  "within seven (7) miles of Lander"**; South Pass City and Atlantic City "30 miles to the south."
  <https://www.landerchamber.org/> Lodging is the weakness: the chamber directory returns 10
  entries with **only one true national chain in Lander itself (Holiday Inn Express & Suites)** —
  the Hampton Inn listed is in Riverton, 25 mi away.
  <https://info.landerchamber.org/list/category/hotels-motels-49>
- **Dubois** — pop 911. National Bighorn Sheep Interpretive Center (largest Rocky Mountain bighorn
  herd in the lower 48, wintering in Whiskey Basin); National Museum of Military Vehicles (opened
  Aug 2020, "500 fully restored military vehicles"); badlands showing "all three major
  mountain-building forces: tectonic, volcanic, and glacial."
  <https://en.wikipedia.org/wiki/Dubois,_Wyoming> · <https://duboiswyoming.org/>
  **Better as a mid-morning stop on day two of corridor (c) than as the overnight.**
  GAP: Dubois lodging list — duboiswyoming.org /where-to-stay 404s both URL forms.
- **Craig CO** — "Elk Hunting Capital of the World," and **late Sep/Oct is Colorado rifle elk
  season**. <https://en.wikipedia.org/wiki/Craig,_Colorado> · <https://www.visitmoffatcounty.com/>
  GAP: no sourced statement that Craig fills during hunting season, but book ahead if you stop.
- **Rawlins** — Wyoming Frontier Prison (1901–1981) is tourable; annual snowfall 54.1 in; "the city
  offers essential services along I-80." <https://en.wikipedia.org/wiki/Rawlins,_Wyoming>
  A services stop, not an evening.

### 2.5 Recommendation

**For corridors (a)/(b): sleep in Pinedale, not Rock Springs** — if the traveller wants a full day
in Jackson/Grand Teton on arrival. The arithmetic is decisive: Rock Springs → Jackson is 179.1 mi /
3h41 and burns the morning, arriving mid-day and hitting Hoback Canyon in flat light. Pinedale →
Jackson is **77.1 mi / 1h34** — leave 07:30, in Jackson before 09:00. Pinedale also gives the
transit night one actual thing to do (Museum of the Mountain Man) and Fremont Lake 4 mi out for a
dawn detour. **Cost: a 416.8 mi / 7h36 first day**, arriving Pinedale around 18:00–19:00 from a
10:00 Breckenridge start.

**If the first day must be shorter, Rock Springs is the correct fallback** — more beds, more food,
and an 11:00 Jackson arrival is still workable.

**Corridor (c) via Lander is the best-balanced option overall** — 6h32 in, 3h15 out, both halves
under seven hours, the lowest sleeping elevation, Sinks Canyon seven miles from the pillow, the
lower and safer Muddy Pass instead of Rabbit Ears, and it finishes with the Teton reveal off
Togwotee's western slope. It costs ~10 extra miles and thin chain-hotel supply in Lander.
**If the trip is about the drive rather than about maximising Jackson time, (c) wins.**

### 2.6 Seasonal risk and the exact condition sources

Colorado (CDOT): <https://www.cotrip.org/> · alert subscriptions <https://subscription.cotrip.org>
· phone **511** · chain/traction law and "Maximum Grades on Colorado Mountain Passes" at
<https://www.codot.gov/travel>

Wyoming (WYDOT), all from <https://www.wyoroad.info/>:
- interactive map <https://map.wyoroad.info>
- closures & advisories <https://www.wyoroad.info/highway/conditions/RoadClosures.html>
- conditions by route (US26, US287, US191, WY28, I80 all listed)
  <https://www.wyoroad.info/pls/Browse/WRR.RoutesQuery>
- cameras <https://www.wyoroad.info/Highway/webcameras/webcameras.html>
- RWIS sensors <https://www.wyoroad.info/Highway/Sensors/sensors.html>
- historical closure archive, monthly, Oct 2019 → present
  <https://www.wyoroad.info/Highway/History/HistoricalInfo.html>
- phone **1-888-WYO-ROAD (1-888-996-7623)**

Specifics:
- **Togwotee does not close seasonally** — NPS confirms US-89/191 and US-26/287 (Jackson to Flagg
  Ranch) are "plowed and open for winter travel" but "require winter tires and chains for mountain
  passes." <https://www.nps.gov/grte/planyourvisit/roads.htm> It shuts episodically for days in a
  blizzard, and **the detour is back through Rawlins and Rock Springs — hundreds of miles.** On
  corridor (c) this is a hold, not a reroute. Check wyoroad route US26/US287 that morning.
- WYDOT currently carries a standing advisory on the Jackson approach used by (a)/(b):
  "Between Bondurant and Hoback Jct Road Open Falling Rock."
  <https://www.wyoroad.info/highway/conditions/RoadClosures.html>
- **Grand Teton seasonal closures: Teton Park Road closes November 1** (Taggart Lake TH to Signal
  Mountain Lodge); **Moose-Wilson Road closes November 1** to mid-May; Antelope Flats, Deadmans
  Bar, Pilgrim Creek, Schwabacher and Two Ocean roads close on conditions.
  <https://www.nps.gov/grte/planyourvisit/roads.htm> A mid-October arrival clears these, but only
  just — and Schwabacher Landing (the sunrise shot in the BRAINSTORM day plan) is a
  **conditions-based** closure, not a dated one.
- GAP: **WY-28 / South Pass winter behaviour** — Wikipedia gives the crossing (7,550 ft at the
  highway, historic pass 7,412 ft, 96.46 mi, two lanes throughout, junction with US-191 at Farson)
  but no closure information, and no WYDOT seasonal page was reachable. WY-28 is not on any of the
  three primary corridors; it only matters if you combine a Rock Springs night with a Lander morning.
- GAP: **US-191 Rock Springs → Pinedale wind and ground blizzard** — no WYDOT statement specific to
  this corridor could be sourced (the conditions-by-route query is a form POST). What is sourced:
  98 miles of open high desert with no shelter, and the adjacent I-80 corridor across the same basin
  is documented as among "the nation's most closure-prone interstates" for ground blizzards and wind.
  Treat as real but unverified; check on the morning.

### 2.7 Biggest unverified risks on this leg

1. **US-191 Rock Springs → Pinedale in wind** — 98 mi, no shelter, no official source found.
2. **Togwotee shutting for days in a storm with no practical detour** (corridor (c) only).

---

---

## 3. Million Dollar Highway — US-550, Durango ↔ Silverton ↔ Ouray

### 3.1 What it is, exactly

- US-550 overall runs Bernalillo NM → Montrose CO, **305.104 mi (491.017 km)**.
  The name "Million Dollar Highway" is applied loosely to Silverton–Ouray but **strictly refers
  to "twelve miles (19 km) south of Ouray through the Uncompahgre Gorge to the summit of Red
  Mountain Pass."** <https://en.wikipedia.org/wiki/U.S._Route_550>
- Silverton → Ouray ≈ **23.5 mi / 37.8 km** (routing, §1) — Wikipedia describes the Ouray–Silverton
  section as 23 mi / 37 km. Same source.
- Three passes on the Durango → Ouray run, all sourced from the US-550 article above:
  - **Coal Bank Pass 10,640 ft (3,240 m)**
  - **Molas Pass 10,970 ft (3,340 m)**
  - **Red Mountain Pass 11,018 ft (3,358 m)**
  - Silverton itself sits at **9,320 ft (2,840 m)**.

### 3.2 Road character

- Hazards, verbatim: **"steep cliffs, narrow lanes, and a lack of guardrails"**; hairpin turns
  ascend Red Mountain Pass. <https://en.wikipedia.org/wiki/U.S._Route_550>
- Northbound descent toward Ouray: **"a steep 8% grade with switchbacks … This section of road is
  winding and narrow, and has no shoulder."** The lower section is blasted through near-vertical
  quartzite cliffs hundreds of feet above the valley.
  <https://en.wikipedia.org/wiki/Red_Mountain_Pass>
- **Why there are no guardrails** — this is the useful detail, from Ouray's own tourism office:
  the highway is "notable for [its] lack of guardrails in many sections to facilitate winter
  plowing." Plows need to push snow over the edge. <https://visitouray.com/scenic-drives>
- Ouray's own framing of the drive: Ouray → Silverton and return is a **2-hour round trip, paved,
  standard passenger car**. Same page. (Compare Valhalla's 0h25 one-way — see §1.2; Ouray's
  2-hour round trip is the realistic number.)
- Avalanche exposure: **"seventy named avalanche paths … intersect Highway 550 in the 23 mi
  (37 km) between Ouray and Silverton."** <https://en.wikipedia.org/wiki/U.S._Route_550>
  Red Mountain Pass: "Avalanches are frequent, and can block the highway for some time."
  <https://en.wikipedia.org/wiki/Red_Mountain_Pass>
- CDOT's own byway description is thin: San Juan Skyway = **236 miles, ~6 hours** driving, and
  the only advice is "Be prepared for summertime afternoon thundershowers" and "Inquire about road
  conditions in winter." <https://www.codot.gov/travel/scenic-byways/southwest/san-juan-skyway>
  Ouray's page gives the loop as 232 mi / 7 hours without stops. <https://visitouray.com/scenic-drives>

### 3.3 RV / trailer suitability

- Wikipedia notes large RVs use the road in both directions and that this "add[s] a degree of
  challenge to people in cars" — i.e. RVs are **not prohibited**, they are the hazard.
  <https://en.wikipedia.org/wiki/U.S._Route_550>
- GAP: an explicit CDOT vehicle-length restriction on US-550 Ouray–Silverton — none found on
  codot.gov; the San Juan Skyway page carries no RV/trailer warning at all.
- Practical read for this trip: an SUV is a non-issue. The relevant risk is **oncoming RVs
  crossing the centreline on the hairpins**, plus the absence of a shoulder to pull onto.

### 3.4 First-snow timing — hard data, not folklore

Computed from **NRCS SNOTEL site 713, "Red Mountain Pass, CO"**, daily snow-depth records,
water years 2005–2024 (20 seasons). Query used:
`https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customSingleStationReport/daily/713:CO:SNTL/2005-09-01,2024-12-15/SNWD::value`
Portal: <https://wcc.sc.egov.usda.gov/reportGenerator/> · Programme: <https://www.nrcs.usda.gov/programs-initiatives/sswsf-snow-survey-and-water-supply-forecasting-program>

| Metric (Red Mountain Pass SNOTEL) | Result |
|---|---|
| Median date of first ≥1 in snow on the ground | **Oct 9** |
| Earliest / latest in 20 yrs (≥1 in) | Sep 10 / Nov 5 |
| Median date of first ≥6 in | **Oct 24** |
| Seasons with ≥1 in **by Sep 30** | **5 of 20 (25%)** |
| Seasons with ≥1 in **by Oct 14** | **13 of 20 (65%)** |

Caveat: the SNOTEL site is at pass elevation but not on the roadway; snow lying at the sensor
does not automatically mean snow on plowed asphalt. It is the right proxy for "has winter
started up there."

**Planning consequence.** The rejected 2027 window would have hit Ouray around **1–5 Oct**, with
roughly a 1-in-4 chance of the season's first snow already on the pass and a higher chance of
overnight ice on the shaded gorge section. **The decided 10 Sep – 4 Oct 2028 window puts Ouray
around 21–25 Sep** — only 5 of 20 seasons had any snow lying by 30 Sep, and the median first
snow is 9 Oct, so the 2028 dates are roughly two weeks clear of the median. This, together with
Dunraven Pass in §12, is the strongest driving-logistics case for 2028. The pass does not close for the season — it is maintained
all winter — but individual storms close it, and CDOT can impose a Traction Law within hours.

### 3.5 Road-condition sources to check on the day

- **COtrip (CDOT official)** — <https://www.cotrip.org/> and the conditions view at
  <https://www.cotrip.org/roadConditions>. Note the page is a JS app; it renders nothing to a
  scraper, so this must be checked in a browser or the COtrip app.
- **Colorado 511** by phone (CDOT's traveller information number).
- **Colorado Traction Law / Passenger Vehicle Chain Law** —
  <https://www.codot.gov/travel/winter-driving/tractionlaw>. In force "during winter storms, or
  when conditions require." To comply you need one of: 4WD/AWD **plus** M+S or mountain-snowflake
  tyres with **≥3/16 in tread**; winter tyres with ≥3/16 in tread; manufacturer-rated all-weather
  tyres with ≥3/16 in tread; or chains/alternative traction devices. Chain Law (more severe) =
  "every vehicle must have chains or an approved alternative traction device," and is "the final
  safety measure before the highway is closed." Fine **$100 + $33 surcharge**, rising to
  **$500 + $157** if you block a lane.
  → **This is a rental-car problem.** A rented AWD SUV on all-season M+S tyres normally complies
  with a Traction Law; almost no rental car complies with a full Chain Law, and rental agreements
  generally forbid fitting chains. GAP: chain-fitting clause in specific rental T&Cs — not located.
- **Active roadwork:** CDOT has been running daytime full closures on US-550 in recent seasons
  (e.g. 08:00–15:00 windows). <https://www.codot.gov/news/2026/may2026/us550-adjusted-closure-times-june1>
  Re-check closer to travel; a mid-day full closure would wreck a Durango→Ouray day.

---

---

## 4. Moki Dugway — UT-261

- UT-261 total length **32.961 mi (53.046 km)**, US-163 north of Mexican Hat → SR-95 just east of
  Natural Bridges NM. "After turning north, the route encounters the Moki Dugway, becoming an
  **unpaved road** for its ascent up onto Cedar Mesa, only to return to being paved for the rest
  of the route." Part of the Trail of the Ancients National Scenic Byway. Built **1958 by Texas
  Zinc** to haul uranium ore from the Happy Jack mine in Fry Canyon to the mill at Mexican Hat.
  <https://en.wikipedia.org/wiki/Utah_State_Route_261>
- **Surface, grade, length**: "**3 miles of steep, unpaved but well-graded switchbacks (11% grade)**,
  winding 1,200 feet from Cedar Mesa to the valley floor"; elsewhere on the same page, "descending
  335 m (1,100 ft) from the top of Cedar Mesa … a series of sharp switchbacks down a steep (11%)
  gravel road over less than three miles."
  <https://www.dangerousroads.org/north-america/usa/783-mokee-dugway-usa.html>
  A second source gives "about three miles" and "a gradient of up to 10%," descending 1,200 ft.
  <https://www.utahscanyoncountry.com/The-Moki-Dugway-Scenic-Backway-Utah-Highway-261/>
  → Use **~3 mi unpaved, ~10–11% grade, ~1,100–1,200 ft of elevation**.
- **Vehicle / trailer restriction — the number that matters**:
  "**The State of Utah recommends that only vehicles less than 28 feet in length and 10,000 pounds
  in weight attempt to negotiate this steep (11% grade), narrow, and winding road.** Most vehicles
  can travel the route safely. **Caution is advised for motorhomes or vehicles pulling trailers.**
  There are no facilities along the Moki Dugway stretch."
  <https://www.dangerousroads.org/north-america/usa/783-mokee-dugway-usa.html>
  GAP: the primary UDOT page or sign text stating the 28 ft / 10,000 lb advisory — udot.utah.gov
  and visitutah.com both 404'd on every guessed path; dangerousroads is a secondary source
  paraphrasing the roadside sign.
- **NPS, official, on the same road** (via its Muley Point page, which is reached off UT-261 at
  the top of the Dugway): the approach has "tight" switchbacks with **"no railings"** and is
  **"not recommended for trailers."** Make sure "your vehicle and your nerves can handle the drive
  before you go." <https://www.nps.gov/glca/planyourvisit/muley-point.htm>
- Driving technique, sourced: "stay in low gear due to the grades and take turns slowly … Cell
  service in the area can be spotty … there are no services or amenities along the road."
  <https://www.utahscanyoncountry.com/The-Moki-Dugway-Scenic-Backway-Utah-Highway-261/>
- **Is it a problem for a rental?** It is a **numbered state highway**, not a backcountry track,
  which matters for the rental unpaved-road clause (§6) — but it is still unpaved, so a literal
  reading of "paved public roads only" catches it. This is the single most likely place on the
  trip to breach a rental contract without realising it. Treat §6 as binding here.
- GAP: posted speed limit on the Dugway — no source found. GAP: whether UT-261 is ever closed
  seasonally — no UDOT source located; it is a state-maintained highway and is not believed to
  close, but that is unverified.
- Practical: an AWD/2WD SUV in dry conditions is fine. Snow or heavy rain on an 11% graded-dirt
  shelf road with no railings is a different proposition entirely.

---

---

## 5. Unpaved / high-clearance sections — vehicle class and what happens when wet

The recurring physical fact behind almost all of these is **bentonite clay** (altered volcanic
ash). NPS states it plainly: bentonite "absorbs water and becomes very slick and gummy when wet,
making vehicle or foot travel difficult or impossible."
<https://www.nps.gov/care/planyourvisit/cathedralvalley.htm>

### 5.1 Cathedral Valley Loop + the Fremont River ford (Capitol Reef NP)

Source: <https://www.nps.gov/care/planyourvisit/cathedralvalley.htm> and
<https://www.nps.gov/care/planyourvisit/roads.htm>

- **57.6 mi (92.7 km) loop, 6–8 hours.** Hartnet Road is **27.8 mi (44.7 km)** of unimproved dirt;
  Cathedral Road returns to UT-24.
- **Vehicle:** "Vehicles with **high ground clearance, even those without four-wheel drive**, can
  usually negotiate the roads without difficulty." The roads page is firmer: Hartnet Road requires
  a "**high-clearance or high-clearance 4WD vehicle**."
- **The Fremont River ford** is at the south end of Hartnet Road, 11.7 mi east of the visitor
  centre on UT-24. **No bridge.** "Water levels are normally a foot or less deep," bottom is hard
  packed and rocky. "**Do not attempt to cross the river during floods or other periods of high
  water.**" Driving the loop **anti-clockwise (Cathedral Road first)** avoids the ford entirely —
  this is the practical workaround for a rental car.
- **When wet:** "Spring and summer rains and winter snows can leave the roads muddy, washed out,
  and **impassable to the best high-clearance four-wheel drive vehicle**."
- **Remoteness:** cell reception "usually poor to nonexistent"; carry water, food, fuel, a shovel;
  "**help may not arrive for hours or even days**."
- Conditions line: **435-425-3791**. Alerts: <https://www.nps.gov/care/planyourvisit/conditions.htm>

### 5.2 Factory Butte / Coal Mine Road (BLM, near Hanksville)

Source: <https://capitolreefcountry.com/factory-butte/>

- Access is **Coal Mine Road, also signed North Factory Butte Road / County Road 1800**,
  roughly **10–12 mi (~15 min) from Hanksville**.
- **Vehicle:** the main road "can be passable for standard 2WD vehicles during dry conditions."
  But "**side roads, especially those leading to areas like Moonscape Overlook, can be rougher and
  may require high-clearance 4WD vehicles.**"
- **When wet:** "Travel is not recommended when roads are wet, as the bentonite clay becomes
  extremely slippery and can make roads **impassable even for 4WD vehicles**."
- Management context: Factory Butte SRMA, with a 5,300-acre designated OHV open area and Swing Arm
  City. Motorised travel off designated routes is restricted outside those areas.
  GAP: the BLM Utah primary page for Factory Butte — every blm.gov URL guessed returned 404.

### 5.3 Bentonite Hills / Moonscape Overlook (Caineville, BLM)

Source: <https://capitolreefcountry.com/bentonite-hills/>

- On BLM land "near the Mars Desert Research Station road" (i.e. off UT-24 near Caineville).
- **No fees, 24/7 access, no facilities, water or shade.**
- **When wet, verbatim:** "**Absolutely do not attempt to drive or hike here if it is raining.
  Bentonite clay turns into a 'death mud' that is impossibly slick and will trap any vehicle —
  including those with 4WD.**"
- GAP: exact access road name/number, mileage from Hanksville, and a stated vehicle class for the
  Bentonite Hills specifically — the source page gives none, and no BLM page was locatable.
- **Same-day decision rule this implies:** check the Hanksville/Caineville forecast and the
  previous 24–48 h of rain. If it has rained, the Factory Butte / Bentonite Hills / Moonscape
  sunrise plan is cancelled, not attempted. There is no "careful driving" version of wet bentonite.

### 5.4 Shafer Trail / Shafer Canyon Road (Canyonlands, Island in the Sky)

Sources: <https://www.nps.gov/cany/planyourvisit/driving.htm> ·
<https://www.nps.gov/cany/planyourvisit/road-conditions.htm>

- "The Shafer Trail at the Island in the Sky district is an iconic road that **descends 1,500 feet
  (457 m)**" through the sandstone cliff below the mesa.
- **Vehicle:** "**High-clearance four-wheel-drive or AWD vehicles are highly recommended.**"
- **Permit:** "**A day-use permit is not required to drive the Shafer Trail Road**" — but a permit
  *is* required the moment you continue past the junction onto the White Rim Road.
- NPS current-conditions text: Shafer Trail "open with typical rough conditions … **expect
  washboarding and ruts above the switchbacks**; high-clearance 4WD recommended."
- White Rim Road, for contrast (not part of this itinerary): 100-mi loop, 2–3 days by 4WD,
  "**your vehicle must have high-clearance, four-wheel drive (low range)**," max **8 ft wide and
  9.5 ft tall**, permit required, and "Upheaval Wash can become **impassable due to mud and
  quicksand** conditions after heavy rain."
  <https://www.nps.gov/cany/planyourvisit/whiterimroad.htm>
- **When wet:** heavy precipitation is the stated cause of impassability — mud, quicksand,
  flash flooding.
- Conditions: **435-719-2313**, or the road-conditions page above.
- **Realistic call for a rental SUV:** the Shafer switchbacks in the dry are drivable in an AWD
  crossover with decent clearance and a calm driver, but it is an exposed shelf road with a
  1,500 ft drop and no guardrail, and it is squarely inside the rental "unpaved roads" exclusion
  (§6). Descending to the Gooseneck Overlook and turning around is the low-risk version.

### 5.5 Yankee Boy Basin / Camp Bird Road (Ouray, CO)

- Ouray brands itself "**Jeep Capital of the World**." Trails are rated **Class 1–5**, Class 1 =
  "paved to bumpy dirt roads," Class 5 = "requiring winching and accepting probable mechanical
  damage." Critically: "**Rain can increase ratings by 1–2 levels.**" 4WD/AWD with high clearance
  is recommended for most trails. <https://visitouray.com/off-roading>
- Rental/tour operators named on that page: Alpine Scenic 4x4, Colorado West, Switzerland of
  America — i.e. **renting a purpose-built Jeep locally in Ouray is the normal way to do this**,
  which also sidesteps the LAS→SLC rental contract.
- Seasonal closure authority: **Ouray County Road & Bridge**, which publishes a "Winter and Spring
  Operating Plan for **CR-361 & CR-26**" (CR-26 is the Camp Bird / Yankee Boy access).
  Phone **(970) 626-5391**. <https://ouraycountyco.gov/151/Road-Bridge> (linked as "Trail
  Closures" from <https://visitouray.com/off-roading>)
- Ouray also notes there is **no dedicated road-conditions website yet** — you call the guide
  services or the Sheriff's Office. <https://visitouray.com/off-roading>
- GAP: Yankee Boy Basin specifics — exact mileage, the point where 2WD ends and 4WD/high clearance
  begins, the shelf-road/overhang section, and the seasonal closing date for CR-26. visitouray.com
  mentions Yankee Boy in its intro but never details it; the USFS GMUG recreation pages 301-redirect
  to a generic landing page; ouraycountyco.gov exposes the operating-plan document only as a link.
  **Call (970) 626-5391 or the Ouray Ranger District to close this.**
- Seasonal risk: at ~11,000–12,500 ft, Yankee Boy is snow-dependent. See §11 and the Red Mountain
  Pass SNOTEL data in §3.4 — by mid-October the upper basin is a coin flip.

### 5.6 Alstrom Point (Glen Canyon NRA / BLM, north of Big Water)

- **GAP — this one is genuinely unsourced.** There is **no NPS page for Alstrom Point**: the Glen
  Canyon "Places to Go" index lists Muley Point but not Alstrom
  (<https://www.nps.gov/glca/planyourvisit/placestogo.htm>), and the Glen Canyon site index
  returned nothing. visitsouthernutah.com has an Alstrom Point page but it contains only a title
  and a photo, no logistics (<https://visitsouthernutah.com/alstrom-point/>). americansouthwest.net,
  utah.com and blm.gov all 404'd on every path tried. WebSearch was unavailable (budget exhausted)
  and every fallback search engine (DuckDuckGo, Brave, Qwant, Mojeek, Ecosia, SearXNG mirrors)
  returned CAPTCHAs, 403s or 429s.
- What is **not** in dispute from the general BLM/Glen Canyon guidance: it is a long unmaintained
  sand-and-slickrock route off US-89 near Big Water, with no services, no signage, no cell
  coverage, and the same bentonite behaviour when wet.
- **Action for the synthesis agent: treat Alstrom Point as a guided-tour or drop-it item until
  someone verifies the road with Glen Canyon NRA / the Big Water contact station.** Do not put an
  unverified self-drive on the plan.

### 5.7 Monument Valley 17-mile Valley Drive loop (Navajo Tribal Park)

Source: <https://navajonationparks.org/navajo-tribal-parks/monument-valley/>

- **Surface:** "The valley drive has **very rough terrain and deep sand dunes**," especially in
  monsoon season.
- **Restrictions, verbatim:** "**Motorcycles/RV's are Prohibited on the loop drive.**"
- **Fees:** "$10 per person, per day, per location" and "$15 per vehicle. Scenic Drive."
  → Confirms BRAINSTORM.md: this is **Navajo Nation land and the America the Beautiful pass does
  not apply.**
- **Hours:** winter 08:00–17:00, last entry 14:30; summer 08:00–19:00, last entry 16:30.
  → **This is a scheduling trap for a sunrise/sunset trip: the gate opens at 08:00, well after
  sunrise (07:08–07:27 MDT in the window, §9), and the last entry is 14:30 in winter hours.**
  Sunrise from the loop is not possible unless you are staying at The View Hotel inside the park.
  GAP: the exact date the park switches from summer to winter hours — not stated on the page.
- Guided tours reach places "only accessible via guided tours"; a Navajo guide is not stated to be
  required for the loop itself.
- Park phone: **435-727-5870**.
- **Vehicle class:** a standard SUV in dry conditions is the norm; the road is graded dirt with
  washboard and sand. GAP: an official statement on clearance requirement — the page gives none.
- GAP: Monument Valley drone policy — not on this page. Navajo Nation land is **not** NPS, so the
  NPS drone ban (§10) does not automatically apply; a separate tribal permit regime does. Confirm
  by phone before carrying a drone anywhere on Navajo land.

### 5.8 Summary — what vehicle you actually need

| Section | Genuinely required | When wet |
|---|---|---|
| Moki Dugway UT-261 | Any 2WD car in dry weather; <28 ft, <10,000 lb | Avoid — 11% graded dirt, no railings |
| Monument Valley 17-mi loop | Standard SUV; no motorcycles, no RVs | Deep sand becomes worse; check at gate |
| Factory Butte main road | 2WD OK dry | **Impassable even to 4WD** |
| Moonscape Overlook spur | **High-clearance 4WD** | Impassable |
| Bentonite Hills | High clearance advisable | **"Death mud" — traps any vehicle incl. 4WD** |
| Cathedral Valley loop | **High clearance**, 4WD strongly preferred | Impassable to best 4WD; ford floods |
| Fremont River ford | High-clearance 4WD; ~1 ft normal depth | Do not attempt in high water — drive the loop anti-clockwise instead |
| Shafer Trail (down and back) | **High-clearance 4WD or AWD recommended** (NPS) | Mud/quicksand; flash flood risk |
| White Rim Road | High-clearance 4WD **with low range** + permit | Not on this itinerary |
| Yankee Boy Basin | 4WD high clearance; rain raises the class rating 1–2 levels | GAP — call Ouray County |
| Alstrom Point | GAP — unverified, treat as 4WD/guided | GAP |

---

---

## 6. One-way rental Las Vegas → Salt Lake City, and the unpaved-road clause

### 6.1 One-way drop fee by agency — nobody publishes a flat LAS→SLC number

The fee is quoted at booking or baked into the rate. What each agency commits to in writing:

| Agency | Published policy | Source |
|---|---|---|
| **National** | "There is typically **no drop charge** (also called an 'inter-city fee') for one-way rentals between airport locations." + "All pricing details will be disclosed in the second step of the booking process." + "*Restrictions may apply" | <https://www.nationalcar.com/en/car-rental/one-way.html> |
| **Enterprise** | "A drop charge is a fee for picking up a rental car at one location and returning it to a different location. The rental car drop fee **varies depending on location and time of year**. If you have to pay a drop charge, it will be disclosed at the time of reservation." | <https://www.enterprise.com/en/car-rental/one-way.html> |
| **Hertz** | "**Intercity fee** is for rentals returned to a location other than the location specified in the Rental Agreement." No schedule published. | <https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=ONEWAY&EOAG=LAS> |
| **Avis** | §8: "If return is indicated to a location other than the location where your rental commences, **you may have to pay a 'one way service fee.'**" | <https://www.avis.com/en/legal-documents/rental-terms> |
| **Budget** | §1.4(b): "If we grant permission to return the Vehicle to an alternative location, **we may apply different rates and additional fees or charges**." | <https://www.budget.com/en/legal-documents/rental-terms> |
| **Dollar** | "One-way rentals within the U.S. … vary by DOLLAR location and vehicle availability. **A one-way drop fee will apply.**" | <https://www.dollar.com/AboutUs/GeneralPolicies.aspx> |
| **Sixt** | "you authorize us to charge your credit or debit card a **one-way charge or service fee** plus any additional costs incurred by us in the return of the Vehicle." | <https://www.sixt.com/shared/t-c/sixt_US_en_NEVADA.pdf> |
| **Alamo** | "All car classes can be reserved for a one-way rental, but prices vary by location, vehicle, date and availability." No drop-charge statement. | <https://www.alamo.com/en/car-rental/one-way.html> |
| Thrifty | GAP — thrifty.com serves no static policy page (all `/rental-terms`, `/rental-policies` paths 404). Thrifty is a Hertz brand and Dollar's page is co-branded, so the Dollar wording likely applies. | — |

**Actionable: the National / Enterprise / Alamo group is the only one that publicly states
"typically no drop charge between airport locations."** LAS and SLC are both major airport
locations in that network. Price there first.

**GAP: an actual quoted LAS→SLC drop fee for Sept–Oct 2028** — every rate engine is JavaScript-only
and requires a live booking query. This is the single most valuable thing to check manually.

### 6.2 Which SUV class actually has ground clearance

Manufacturer-published figures, inches.

| Vehicle (MY) | Ground clearance | Source |
|---|---|---|
| Toyota RAV4 (2026) | **8.1** (8.5 Woodland) | <https://www.toyota.com/rav4/features/> |
| Toyota 4Runner (2026) | **8.1** SR5/TRD Off-Road; 8.8–9.1 higher trims; **10.1** TRD Pro/Trailhunter | <https://www.toyota.com/4runner/features/> |
| Toyota Highlander (2026) | **8.0** | <https://www.toyota.com/highlander/features/> |
| Ford Bronco Sport (2025) | **7.8** base; 8.1 Badlands; 8.7–8.8 Sasquatch | <https://www.fromtheroad.ford.com/content/dam/fordmediasite/us/en/library/2025/specs/2025-Bronco-Sport-Technical-Specs.pdf> |
| Ford Bronco (2026) | **8.3–8.4** base; **10.5** Badlands | <https://www.ford.com/suvs/bronco/2026/models/base/> |
| Ford Explorer (2027) | **7.6** Active/ST-Line; 7.8 ST; 8.3 Platinum; 8.7 Tremor | <https://www.ford.com/suvs/explorer/models/> |
| Subaru Outback (2026) | **8.7**; 9.5 Wilderness | <https://www.subaru.com/vehicles/outback/2026/specs-trim.html> |
| Subaru Forester (2026) | **8.7**; 9.3 Wilderness | <https://www.subaru.com/vehicles/forester/2026/specs-trim.html> |
| Nissan Rogue (2026) | **8.2** | <https://www.nissanusa.com/vehicles/crossovers-suvs/rogue/specs.html> |
| Hyundai Tucson (2026) | 7.1 (2WD) / **8.3** (AWD) | <https://www.hyundaiusa.com/us/en/vehicles/tucson/compare-specs> |
| Hyundai Santa Fe (2026) | **7.0**; 8.3 XRT | <https://www.hyundaiusa.com/us/en/vehicles/santa-fe/compare-specs> |
| Kia Telluride (2027) | **7.4**; 9.1 X-Pro | <https://www.kia.com/us/en/telluride/specs> |
| Jeep Wrangler | Jeep publishes only "11.1 max/available" (<https://www.jeep.com/wrangler/capability.html>); base Sport **9.7** per <https://www.caranddriver.com/jeep/wrangler/specs/2025/jeep_wrangler_jeep-wrangler_2025> |
| Jeep Grand Cherokee | Jeep publishes no number; **8.4** base MY2025 per <https://www.caranddriver.com/jeep/grand-cherokee/specs/2025/jeep_grand-cherokee_jeep-grand-cherokee_2025> |

**GAP: Chevrolet Tahoe / Suburban / Equinox and GMC Yukon ground clearance — GM publishes no
figure anywhere fetchable.** chevrolet.com, gmc.com and media.chevrolet.com carry no clearance
value; Car and Driver and Cars.com both list "NA"; edmunds/kbb/motortrend return 403.
**Do not assume a number for a Tahoe.**

**The point:** the vehicles that actually fill "Standard SUV" and "Full-size SUV" — Equinox, Rogue,
Explorer, Santa Fe, Telluride, Tucson — sit at roughly **7.0–8.4 in**. That is car-like.
**A generic SUV booking buys no clearance.** For reference, everything in §5 that needs "high
clearance" is asking for meaningfully more than 8 in, plus proper approach/departure angles.

### 6.3 Booking an "SUV" class does NOT guarantee AWD or 4WD

- **Hertz:** "In general, Hertz accepts reservations only for a **class of vehicles**, and not for
  vehicles either of specific makes, model years or models **or with particular characteristics not
  common to all vehicles in the class**."
  <https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=LEGALUS&EOAG=LAS>
  AWD is precisely "a characteristic not common to all vehicles in the class."
- **Avis:** "Renters reserve a car in a specific group, not a specific make and model. **Vehicle
  make, model, trim, features and color are not guaranteed.**"
  <https://www.avis.com/en/cars/toyota/4runner>
- **National — the decisive evidence.** Drivetrain is a published *class attribute*, and the plain
  SUV classes are published as **2 Wheel Drive**:

| Class (SIPP) | Example models | Published drivetrain |
|---|---|---|
| Standard SUV (SFAR) | Chevrolet Equinox or similar | **2 Wheel Drive** |
| Standard SUV **AWD** (SFDR) | Chevrolet Equinox or similar | 4WD or AWD |
| Midsize SUV (IFAR) / AWD (IFDR) | Nissan Rogue or similar | 2WD / AWD |
| Full Size SUV (FFAR) / AWD (FFDR) | Tahoe, Wagoneer, Expedition | 2WD / AWD |
| Premium SUV (PFAR) / AWD (PFDR) | Expedition Max, Wagoneer L | 2WD / AWD |
| Jeep (IJAR) / Jeep Wrangler 4-door (FJAR) | Wrangler / Wrangler Unlimited | 4WD/AWD |
| **Premium All-Terrain (PQAR)** | **Jeep Wrangler Rubicon, Land Rover Defender AWD** | **4WD/AWD** |

All under <https://www.nationalcar.com/en/rental-cars/us/suvs/>

**Two reliable levers:**
1. Book a class with **AWD/4WD in the class name**, or the **Jeep / Premium All-Terrain** classes.
2. **National Emerald Aisle** — "Choose your own car — Choose any make, model and color at the
   reserved Midsize rate. The keys are in the cars." Offered at **Las Vegas and Salt Lake City**
   (also St. George, Provo, Denver, Phoenix).
   <https://www.nationalcar.com/en/emerald-club/services/emerald-aisle.html>
   You inspect and pick the actual car. Still not a contractual guarantee, but it is the practical
   answer for this trip.

GAP: Hertz and Enterprise/Alamo "or similar" class lists — hertz.com vehicle pages are fully
client-side; enterprise.com/alamo.com return 403 to curl and 404 to WebFetch.

### 6.4 THE UNPAVED-ROAD CLAUSE — verbatim, and it is not boilerplate

**Four of the majors ban unpaved roads outright and void the damage waiver for it.**

**Avis, §15 Prohibited Use of the Car** —
> "**A VIOLATION OF THIS PARAGRAPH, WILL AUTOMATICALLY TERMINATE YOUR RENTAL, AND IS AN EXCLUSION
> TO AND VOIDS ALL LIABILITY PROTECTION AND ANY OPTIONAL SERVICES THAT YOU HAVE ACCEPTED,
> INCLUDING … LOSS DAMAGE WAIVER OR PARTIAL DAMAGE WAIVER.** … It is a violation of this paragraph
> if: a. You use or permit the car to be used: … 4) to be operated in a test, race or contest,
> **or on unpaved roads**"

And §13 makes the waiver conditional: "If you accept full LDW … and **the car is operated in
accordance with the Agreement**, we assume responsibility for the loss of or damage to the car…"
<https://www.avis.com/en/legal-documents/rental-terms> ·
<https://www.avis.com/content/dam/avis/na/us/common/pdf-files/PrefMbrGlobalTermsMiddle.pdf>

**Budget, §1.5** (same Avis Budget Group drafting) —
> "**ANY VIOLATION OF THIS PARAGRAPH IS ALSO AN EXCLUSION FROM, AND AUTOMATICALLY VOIDS, ALL
> LIABILITY PROTECTION AND ANY AND ALL PRODUCTS AND SERVICES, INCLUDING … LOSS DAMAGE WAIVER, AND
> PARTIAL LOSS DAMAGE WAIVER.** … **1.5(a)(7)** Use the Vehicle (i) to carry hazardous materials;
> (ii) in a test, race, or contest; **(iii) on unpaved roads**"
<https://www.budget.com/en/legal-documents/rental-terms>

**Enterprise — banned in §4, waiver voided in §17** —
> "**4. Limits on Use** … **(10) Vehicle shall not be driven on an unpaved road or off-road.**"
> "**17. Optional Damage Waiver.** … [DW does not apply] … **(10) on an unpaved road or off road**
> … **THE FOLLOWING SHALL INVALIDATE DW** … e. the damage or loss arises out of the use of the
> vehicle … **operating off road**"
<https://legislature.vermont.gov/Documents/2018/WorkGroups/House%20Judiciary/Bills/S.105/S.105~Enterprise%20Car%20Rental~Enterprise%20Car%20Rental%20Terms%20and%20Conditions~4-10-2018.pdf>
(Enterprise's US T&Cs filed as a public legislative exhibit — enterprise.com itself blocks fetching.)

Independent corroboration from a state-contract administrator: "Off-road travel is prohibited under
the State's Rental Contracts with Enterprise/National and Hertz. Off-road use may void the
contract." <https://www.boisestate.edu/rmi/employee-vehicle-rentals/off-road-rental-agreements/>
That same page shows these clauses *can* be varied by negotiated contract — Boise State has a
"moderate terrain" carve-out defined as "gravel and/or dirt roads maintained by a state, county,
local municipality, or individual property owner … includes fire roads maintained by the Bureau of
Land Management." A retail renter has no such carve-out.

**Sixt — Nevada and Utah state contracts** (the two states that bracket this trip), and notably the
*least* absolute wording. Prohibited Uses §7, identical in both:
> "the following … shall be considered prohibited uses of the Vehicle: … • **On other than a paved
> road or graded private road or driveway**"

Utah LDW exclusion: "We will not waive your responsibility, even though you purchased LDW … if
damage to or loss of the Vehicle is the result of a prohibited use, including damage or loss that …
**(g) is caused by driving on unpaved roads**."
Nevada is narrower — a statutory carve-out limits it to causation: "…or on an unpaved road **if the
damage or loss is a direct result of the road or driving conditions**."
<https://www.sixt.com/shared/t-c/sixt_US_en_UTAH.pdf> ·
<https://www.sixt.com/shared/t-c/sixt_US_en_NEVADA.pdf>
Sixt is the only major that explicitly permits a "graded private road or driveway" — but note
*private*, which does not cover graded BLM or county roads.

**Hertz** — LDW is conditional: "relieves you of all financial responsibility … **provided the car
is used in accordance with the terms of the Rental Agreement**."
<https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=COVERAGES&EOAG=LAS>
GAP: Hertz's verbatim unpaved-road clause — the location "Rental Restrictions" pages for LAS and
SLC contain only Canada/Mexico terms, and every T&C PDF path 404'd. **It lives in the counter
agreement. Read it before signing.**

**Dollar / Thrifty** — "LDW does not apply if: (1) the renter uses the vehicle **in violation of
the Rental Agreement**…" <https://www.dollar.com/AboutUs/GeneralPolicies.aspx>
GAP: verbatim unpaved clause — not on the General Policies page; it is in the counter agreement.

**Turo is not an escape hatch.** Prohibited uses include "'Off roading' or driving on undeveloped
or unimproved roads," with consequences including "**voiding your protection for any physical
damage to a host's vehicle**." <https://help.turo.com/en_us/prohibited-uses-Hyi0E4l49> ·
<https://turo.com/us/en/policies/terms> GAP: no provision lets an individual host waive this. A
host's informal "sure, go ahead" restores nothing.

### 6.5 Canadian credit-card CDW on dirt

**GAP: a Canadian card benefit guide with an explicit off-road/unpaved exclusion could not be
obtained** — WebSearch quota was exhausted; Brave/DDG/Bing/Ecosia/Mojeek/Startpage were all blocked
or JS-gated; RBC/TD/Scotiabank/CIBC/BMO/Amex-CA benefit-guide URL probing returned 404; canada.ca
(FCAC) refused connections.

What **was** verified, and matters more:
- **RBC Avion Visa Infinite** CDW requires you to initiate the rental with that card, be present in
  person, pay the **full** cost of the rental with it, and **decline the counter CDW** ("If the
  covered person accepts the rental agency's CDW option… this Certificate of Insurance will only
  cover up to the deductible"). Rental must **not exceed 48 consecutive days**.
  <https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf>
- Hertz's own warning: "most credit card insurance is **supplemental**, which means it will only
  reimburse you for loss or damages over and above what is covered by any other insurance."

**Inference: card CDW is written to sit on top of a valid rental agreement. If the agreement is
breached by driving unpaved, there is no waiver for it to sit on top of. Treat card CDW as zero
protection on dirt.** A 25-day rental is inside the 48-day cap, so it works fine on pavement —
provided the rental is booked and paid in full on that card, in the driver's name, with the counter
CDW declined.

### 6.6 The carve-out — Moab 4x4 outfitters that DO permit dirt

| Outfitter | What it permits and costs | Source |
|---|---|---|
| **Canyonlands Jeep and Car Rentals** (Moab) | Wrangler Rubicons with 2″ Mopar lift + 35″ tyres; explicitly "from graded dirt roads to well-known 4×4 routes like Gemini Bridges and Fins and Things"; also **Shafer Trail**, Onion Creek. **2026 rate $330/day; 2027 rate $345/day**, 200 free miles/day, 10-hour period. **CDW $40/day with a $7,000 deductible.** "CDW is **required** for International Renters that do not have valid full-coverage insurance based in the United States. **We do not accept insurance issued through Credit Card companies.**" Optional **$25 glass & tyre coverage** — "highly recommend[ed] … when renting vehicles that are going to be traveling on non-paved roads." **Minimum age 25**, no debit cards, no one-way drops. | <https://www.canyonlandsjeep.com/jeep-rentals/> |
| **Twisted Jeeps** (Moab + Silverton CO) | Built 4-door Wranglers/Gladiators. **Wrangler 4-dr $345/day (1–2 days), $315 (3–4), $285 (5+); Gladiator $295 / $265 / $235.** "The collision damage waiver … only waives damage beyond $5,000.00 to the vehicle under contract… **The Collision Damage Waiver is available for non-residents only.**" | <https://twistedjeeps.com/reservations/> |
| Farabee's Jeep Rentals | Now Death Valley and **Silverton CO** — relevant to the Ouray/San Juans block, not Moab | <https://www.farabeesjeeprentals.com> |

**Recommended structure for this trip: a paved-road major rental for the 25-day LAS→SLC backbone,
plus a 1–2 day Moab Jeep for Shafer Trail (and optionally a Silverton/Ouray Jeep day for Yankee Boy
Basin).** That is the only version where the dirt days are actually insured. Note Canyonlands Jeep
publishes 2027 pricing already, so a booking made now locks the rate.

### 6.7 Driver requirements a Canadian must satisfy at the counter

- **A provincial licence is sufficient; an IDP is NOT needed.** "Canadians with a provincial or
  territorial driver's licence do not need an IDP to drive in the U.S."
  <https://travel.gc.ca/travelling/documents/international-driving-permit>
  (CAA sells one for **$32.00 CAD as of 1 Dec 2025** if wanted:
  <https://www.caa.ca/services/travel/international-driving-permit/>)
- **Hertz:** "You **can't** rent a Hertz vehicle with only an International Driver's Permit."
  <https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=LICENSE&EOAG=LAS>
- **Avis:** "Avis does not accept **digital** driver's licenses for rental. Please bring a hard
  copy." <https://www.avis.com/en/help/usa-faqs/rental-requirements>
  Enterprise likewise does not accept digital licences.
  <https://www.enterprise.com/en/car-rental-faqs/us-renter-requirements/drivers-license-requirements.html>
- **Bring the passport to the counter.** Avis LAS: "If the drivers license is not U.S.-issued, you
  must present your drivers license **and either a passport or a Canadian enhanced license** in the
  driver's name." <https://www.avis.com/en/locations/nam/us/nv/las-vegas/las>
- **Age and young-driver surcharge** (no state exception in NV, UT or AZ):

| Company | Min age | Under-25 surcharge | Source |
|---|---|---|---|
| Avis — LAS / SLC / PHX | 21 | **$27/day** | <https://www.avis.com/en/locations/nam/us/nv/las-vegas/las> · <https://www.avis.com/en/locations/nam/us/ut/salt-lake-city/slc> |
| Enterprise | 21 | **~$25.00/day** ages 21–24 | <https://www.enterprise.com/en/car-rental-faqs/us-renter-requirements/car-rental-under-25.html> |
| Hertz | 20 | **$19/day** | <https://www.hertz.com/us/en/support/book-a-rental/driver-requirements> |

Over 25 days that is **$475–$675 in surcharge alone** if any driver is under 25.

- **Credit card must be in the renter's own name.** Hertz: "the renter must present … a valid major
  credit card or debit card **in the renter's own name** with available credit." Authorisation
  holds: "up to USD 200.00, or for a Small SUV – USD 300.00, **Standard SUV – USD 400.00**, …
  **Large SUV – USD 750.00**"; "**Debit cards are not permitted … on Large SUV**."
  <https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=PAYMENT&EOAG=LAS>
  Avis: "The name on all rental credentials (license and credit or debit card) must match the name
  on the reservation."
- **Do not attempt a debit-card one-way.** Avis requires 25+, a credit check and, "at airport
  locations, **proof of a return airline ticket** … when using a debit card"; Hertz requires "proof
  of a return airline flight to coincide with the rental." **Both conditions assume a round trip
  from the pickup airport, which a LAS→SLC open-jaw is not.** Use a credit card in the driver's
  name — which is also the prerequisite for card CDW (§6.5).
  <https://www.avis.com/en/help/usa-faqs/debit-card-policy>

GAP: Enterprise's credit-card name-match rule — not stated on their renter-requirements FAQ.

---

---

## 7. Cell coverage dead zones and where offline maps are mandatory

### 7.1 The carrier assumption is wrong for Utah

The standard advice is "Verizon is best in the rural West." **In Utah specifically the data
contradicts it.** AT&T offers the strongest overall coverage in Utah, "including a strong signal
in urban areas and covering a surprising amount of rural, rugged terrain," leading on FCC-derived
data at **67.1% of state area**, while "**Verizon doesn't cover the rugged areas of Utah very well
and you'll probably struggle for signal in most national parks.**"
<https://www.whistleout.com/CellPhones/Guides/Best-Coverage-in-Utah-USA>
T-Mobile has the largest 5G network but "struggles in rural areas."
<https://timetransfers.com/en/guides/usa/best-carriers/> ·
<https://www.phonearena.com/news/tmobile-5g-network-coverage-utah_id152177>

Zion is the exception where Verizon does better — it works in Springdale and near the South/East
entrances "but not at all further up the canyon."
<https://www.tripadvisor.com/ShowTopic-g143057-i1449-k4457660-Celll_phone_coverage-Zion_National_Park_Utah.html>
NPS has an active project record for a Verizon facility at the Zion Canyon Visitor Center:
<https://parkplanning.nps.gov/projectHome.cfm?projectID=60937>

**Consequence: if buying a US eSIM, prefer an AT&T-backed one. Most travel eSIMs (Airalo included)
ride T-Mobile.**

NPS's own honest framing: "cell phone service varies in different parks—and even can be
inconsistent within the boundaries of an individual park," and "wireless coverage maps from
providers are approximate, and service breaks can occur even in supposedly covered areas."
<https://www.nps.gov/aboutus/broadband.htm>

### 7.2 Dead zones, in route order

| Location | Status | Source |
|---|---|---|
| **Zion Canyon above Springdale** | Verizon works in Springdale and at the entrances, not up-canyon. Free WiFi at Zion Canyon Visitor Center and Human History Museum, plus Springdale businesses | <https://www.nps.gov/zion/planyourvisit/goodsandservices.htm> |
| **Bryce Canyon** | Free WiFi at Visitor Center and Bryce Canyon Lodge (lodge closed Nov–Mar). GAP: NPS publishes no cell statement — call 435-834-5322 | <https://www.nps.gov/brca/planyourvisit/goodsandservices.htm> |
| **Monument Valley** | **GAP — no authoritative statement exists.** Navajo Nation land, so no NPS page. Assume very limited outside the Goulding's / US-163 corridor | — |
| **UT-261 Moki Dugway / Cedar Mesa / UT-95** | "This 120-mile stretch has no gas, no food, and **no cell service**" | <https://capitolreefcountry.com/scenic-drives/highway-95/> |
| **Natural Bridges NM** | NPS, flatly: "**No cell phone coverage.**" Also no food, supplies, gas or lodging | <https://www.nps.gov/nabr/planyourvisit/goodsandservices.htm> |
| **Cathedral Valley / Factory Butte** | NPS: "**Cell phone reception is usually poor to nonexistent**"; "help may not arrive for hours or even days" | <https://www.nps.gov/care/planyourvisit/cathedralvalley.htm> |
| **Canyonlands Island in the Sky** | "Limited at visitor center and scenic drive areas **with La Sal Mountain visibility**" — line of sight or nothing | <https://www.nps.gov/cany/planyourvisit/goodsandservices.htm> |
| **Canyonlands Needles** | "**Little to no service, even in the developed areas.**" NPS adds: "**Satellite phones provide more reliable communication than cellular networks throughout the park.**" | same |
| **US-550 San Juan passes** | "Cell service is unreliable across the passes on this route" | <https://wereintherockies.com/million-dollar-highway/> — GAP: no CDOT or carrier-specific data |
| **Wyoming US-191 Rock Springs–Pinedale–Jackson** | **GAP — no authoritative source found.** 98 mi of high desert, two tiny settlements. Assume long gaps | — |
| **Yellowstone** | See below — restrictive **by design** | <https://www.nps.gov/yell/learn/news/22008.htm> |
| **Grand Teton** | GAP — NPS publishes an "Internet & Cellular Access Details" heading but the content does not render to a fetcher. Call **307-739-3399** | — |

**Yellowstone is the important one because the restriction is policy, not terrain.** NPS:

> "Cell phone service originating from inside the boundaries of Yellowstone National Park is
> currently limited to the **Mammoth, Old Faithful, Canyon, Tower-Roosevelt, and Grant** developed
> areas." … "Cell phone reception **outside developed areas is not intended**, and therefore would
> be variable and should not be expected."
> — <https://www.nps.gov/yell/learn/news/22008.htm>

An approved Lake-area tower adds Fishing Bridge/Lake Village
(<https://parkplanning.nps.gov/projectHome.cfm?ProjectID=43426>), and the Goods & Services page
now lists signal near Mammoth, West Yellowstone, Old Faithful, Grant Village, Lake Village and
Mount Washburn, warning that "**during summer the number of users can overwhelm cellular
circuits**" — texting beats calls or data.
<https://www.nps.gov/yell/planyourvisit/goodsandservices.htm>
187 miles of fibre has been laid along park roads but NPS states this "would not expand authorized
cellular phone coverage areas."

**Practical read: Hayden Valley, Lamar Valley, Norris, Madison and the Grand Loop between developed
areas are all dead.**

### 7.3 Offline maps — mandatory download list

1. UT-261 + UT-95 + Natural Bridges + Cedar Mesa (NPS: no coverage)
2. Monument Valley / Mexican Hat / Bluff
3. Cathedral Valley / Factory Butte / Bentonite Hills
4. Canyonlands Needles and Island in the Sky
5. US-550 Coal Bank / Molas / Red Mountain passes
6. US-191 Rock Springs → Pinedale → Jackson
7. All of Yellowstone outside the five developed areas
8. Zion Canyon above Springdale

Google Maps offline mechanics that matter (<https://support.google.com/maps/answer/6291838>):
- "**Your offline maps can guide you to your destination as long as the entire route is within the
  offline map**" — download generous, overlapping boxes; a route that exits the box loses
  navigation mid-drive.
- **Driving navigation works offline; transit, cycling and walking directions do not.** No live
  traffic, no alternate routes.
- Maps **expire**; auto-update happens on WiFi within 15 days of expiry. Refresh in a hotel before
  each remote leg.

Add Gaia GPS or onX Offroad for the dirt (Cathedral Valley, Factory Butte, the Moki Dugway
approach) — road-map apps thin out on unmaintained routes. GAP: Gaia/onX pricing and offline
download limits not researched.

### 7.4 Connectivity for a Canadian visitor — 25 days

| Option | Cost | Source |
|---|---|---|
| Rogers US pay-per-day | **CAD $16.00/day** → 25 days = $400 | <https://www.rogers.com/mobility/roaming> |
| **Rogers Travel Pass 30 days** | **CAD $80** | same |
| Bell Roam Better US | CAD $13/day, capped at 20 days/billing cycle | <https://www.bell.ca/Mobility/Roam-Better-FAQ> |
| Telus Easy Roam US | ~CAD $14/day — GAP: telus.com roaming pages 404'd ×3; secondary <https://www.whistleout.ca/CellPhones/Guides/Canadian-US-Roaming-Guide> | — |
| Airalo US eSIM 30 d unlimited | **CAD $96.50**, runs on **T-Mobile** | <https://www.airalo.com/united-states-esim> |

**Clear winner: the Rogers 30-day Travel Pass at CAD $80** — beats $400 pay-as-you-go, beats Bell
(whose 20-day cap means a trip straddling two billing cycles costs ~$325), beats Airalo, and keeps
the Canadian number live for hotel and rental confirmations. Caveat: you inherit whichever US
partner network Rogers uses; you don't choose. Airalo's T-Mobile backing is a **liability** on this
route (§7.1). GAP: no AT&T-network travel eSIM pricing obtained.

### 7.5 Satellite messaging as the backstop

- **Apple Emergency SOS via satellite** — iPhone 14 or later, iOS 16.1+, **available in the United
  States and Canada**, "free for two years after the activation of an iPhone 14 or later."
  <https://support.apple.com/en-us/101573> · Messages via satellite:
  <https://support.apple.com/en-us/120930> · free-period extension:
  <https://www.apple.com/newsroom/2023/11/apple-extends-emergency-sos-via-satellite-for-an-additional-free-year/>
  GAP: Apple has never published a price for after the free period.
- **T-Mobile T-Satellite (Starlink direct-to-cell)** — $10/month, and critically **free emergency
  Text-to-911 for all compatible phones on any carrier**. Works with 60+ phones including iPhone
  14+, Galaxy S23/S24, Pixel 7/8. Text, location pings and lightweight app data only.
  <https://www.satelliteinternet.com/providers/starlink/starlink-direct-to-cell/>
  (t-mobile.com's own page returned 403 to a fetcher.)
- GAP: Google/Pixel Satellite SOS availability and cost — support.google.com 404'd.

**Verify the iPhone's free satellite window has not lapsed before departure.** On UT-95, in
Cathedral Valley and across the Yellowstone interior it is the only comms you will have.

---

---

## 8. Fuel — prices and the no-service stretches

### 8.1 State averages (AAA, "price as of 9/5/26" — i.e. a 2026 snapshot, not a 2027/2028 forecast)

<https://gasprices.aaa.com/state-gas-price-averages/>

| State | USD/US gal | USD/litre (÷3.785) |
|---|---|---|
| **Nevada** | **$4.9486** | $1.3074 |
| Arizona | $4.5354 | $1.1983 |
| Utah | $4.4187 | $1.1675 |
| Wyoming | $4.3711 | $1.1549 |
| **Colorado** | **$4.2166** | $1.1141 |
| US national avg | $4.1459 | $1.0954 |

Nevada is the outlier — **+$0.80/gal over the national average and +$0.73 over Colorado**. Colorado
is cheapest of the five. Utah metro sub-averages the same day: SLC $4.3685, **St. George $4.4751**
(<https://gasprices.aaa.com/?state=UT>); Wyoming: Cheyenne $4.1430, Casper $4.2238
(<https://gasprices.aaa.com/?state=WY>). AAA's Utah county map spans $4.3210 to **$4.9720** — a
~$0.65/gal spread inside one state.

EIA cross-check, week of 2026-08-31 (<https://www.eia.gov/petroleum/gasdiesel/>): US $4.071;
**Rocky Mountain (PADD 4 — UT, CO, WY, MT, ID) $4.266**; **West Coast (PADD 5, includes NV and AZ)
$5.206**. Same pattern: the Rockies leg is near the national average, the Nevada/Arizona bookends
sit in the expensive PADD.

GAP: county-level Utah/Wyoming prices — AAA renders them only in an interactive map. GAP: current
pump prices for Springdale, Torrey, Bryce Canyon City, Jackson, in-park Yellowstone — GasBuddy
returns HTTP 403 to automated fetch.

### 8.2 Trip fuel cost — arithmetic, shown

Distance input 2,820 mi (from BRAINSTORM.md; §1 independently routes 2,397 mi of point-to-point
transit plus in-park driving, which is consistent).

- at 22 mpg: 2,820 ÷ 22 = **128.18 US gal** (485.2 L)
- at 25 mpg: 2,820 ÷ 25 = **112.80 US gal** (426.9 L)

| Price basis | @22 mpg | @25 mpg |
|---|---|---|
| Cheapest state, CO $4.2166 | $540.49 | $475.63 |
| Utah average $4.4187 (route is Utah-heavy) | $566.39 | $498.43 |
| Most expensive, NV $4.9486 | $634.32 | $558.20 |

**Planning band: roughly US$500–600** before gateway premiums. GAP: per-state mileage split not
sourced, so the Utah weighting is a construction, not data. GAP: no USD/CAD rate sourced — convert
on the day.

### 8.3 Gateway-town premium — evidence, not folklore

- **Springdale (Zion):** a single Shell station; reported spread of roughly **$0.45–0.80/gal over
  Hurricane, 25 miles away**. <https://gaspricesecret.com/gas-prices-in-utah/> (March 2026
  snapshot — the absolute numbers are stale, the spread is the point)
- **Big Water UT** (US-89, 14 mi north of Page): "Gasoline in Big Water is typically **$0.50/gallon
  more than in Page**, so fill up in Page." <https://usroute89.com/project/page-to-kanab/>
- **Hanksville:** Visit Utah calls it "the last stop for **reasonably priced** gas and supplies
  until you reach Blanding."
  <https://www.visitutah.com/things-to-do/road-trips/undiscovered/bicentennial-byway>
- **Monument Valley (Goulding's):** repeated traveller reports of a captive-market premium.
  <https://gouldings.com/amenities/gas-convenience-store/> One GasBuddy listing flagged the station
  as **being rebuilt with fuel unavailable** — <https://www.gasbuddy.com/station/144573>.
  **Verify on the day; if Goulding's is down the nearest fuel is Kayenta (~30 min south) or Mexican
  Hat (~30 min north).**
- **Bondurant WY** (US-191 between Pinedale and Jackson): "a single pump at the general store (cash
  only, expect $0.50/gallon premium)" — source is <https://blog.wayro.ai/> which reads as
  AI-generated. **Treat as unconfirmed.**

### 8.4 85-octane at altitude — a real rental gotcha

- "Most Utah gas stations sell 85-octane fuel." Per the Utah Dept. of Agriculture and Food:
  "It's mainly **Colorado, Utah, Wyoming, Idaho, New Mexico**, places that have higher elevations."
  <https://www.ksl.com/article/50290966/most-utah-gas-stations-sell-85-octane-fuel-but-is-it-ok-for-your-car>
- Same article: owner's manuals are written for sea level and typically specify 87;
  **turbocharged/high-compression engines should use premium regardless of elevation**; sub-87 fuel
  "could void warranty coverage."
- Manufacturer language, e.g. Jeep: "Use of gasoline with an octane number lower than 87 can cause
  engine failure and may void or not be covered by the New Vehicle Limited Warranty."
  <https://www.jeepgarage.org/threads/colorado-utah-wyoming-grand-cherokee-and-85-octane-regular-gas.237680/>

**Consequence: in UT/CO/WY the pump labelled "regular" is often 85, and the "mid-grade" button (87)
is what actually matches the manual. Most modern rental SUVs are turbocharged four-cylinders.
Budget the mid-grade price for the Utah/Colorado/Wyoming legs, not the AAA regular average.**
Descending from Bryce or Breckenridge to Las Vegas at 2,000 ft on a tank of 85 is where pinging
shows up. Arizona and Nevada sell 87 as regular. GAP: mid-grade differential per state not captured.

### 8.5 The long stretches with no fuel — named, with mileages

**(1) UT-95 "Bicentennial Highway", Hanksville ↔ Blanding — the worst one on this route.**
- Highway length **121 miles (195 km)**, US-191 south of Blanding to SR-24 at Hanksville.
  <https://en.wikipedia.org/wiki/Utah_State_Route_95>
- Same source, explicitly: "Fry's Canyon … contained the only gas station between Hanksville and
  Blanding, **but it has since closed and there are no services on the route itself**." Fry Canyon
  Lodge closed **2007**.
- The only fuel possibility en route is a **seasonal, summer-only station at Hite Marina** (~44 mi
  from Hanksville) and "the marina is often closed due to low water levels." Do not plan around it.
  <https://www.visitutah.com/things-to-do/road-trips/undiscovered/bicentennial-byway>
- Roadside sign leaving Hanksville reportedly reads "**No Services for the Next 122 Miles**."
  <https://capitolreefcountry.com/scenic-drives/highway-95/>
- Trip report: "121 miles with **no designated rest stops, no commercial facilities, no place to
  buy gas or pick up food or stop for repairs**."
  <https://www.asthemagpieflies.com/blog/2023/9/12/bicentennialhighway>
- **This itinerary is worse than the 121-mile number**, because you join UT-95 at Natural Bridges
  rather than at Blanding. Natural Bridges NM itself: "no food, supplies, gas, lodging" and "no cell
  phone coverage." <https://www.nps.gov/nabr/planyourvisit/goodsandservices.htm>
  **Last reliable fuel before Hanksville is Mexican Hat or Bluff — roughly 95–100 road miles of
  UT-261 + UT-95 with nothing.**

**(2) I-70 Utah, Salina ↔ Green River — the famous one.**
- "After leaving exit 56 in Salina, I-70 departs on a **104-mile (167 km) course** to the first
  Green River offramp, exit 160." Described as "the longest distance in the Interstate Highway
  System with **no motorist services** directly along the highway." Roadside signage reads "Next
  services on I-70 110 miles." <https://en.wikipedia.org/wiki/Interstate_70_in_Utah>
- Deseret News uses 106 mi: <https://www.deseret.com/2013/9/23/20526064/about-utah-no-bull-no-service-for-106-miles/>
- **Use ~105 miles; the sign says 110.** **Not on the routed itinerary** — Hanksville → Moab runs
  UT-24 north to I-70 at Green River then US-191 south, i.e. it joins I-70 *east* of the gap, and
  the trip exits via Yellowstone → I-15, not I-70. It only bites if the plan changes to Moab → SLC
  (US-191 → I-70 **west** through the gap to Salina).

**(3) Hanksville — the hinge.** Fuel in town: **Hollow Mountain** (the station built into the rock)
and **Stan's Fuel & Foodmart** on Highway 95. <https://www.hanksvilleutah.gov/fuel>
Distances out: Torrey 48 mi west; Green River 57 mi north; Blanding 126–133 mi southeast with
nothing in between. **Rule: never leave Hanksville below three-quarters of a tank in any
direction.** GAP: station operating hours — the town page lists none; assume nothing is open
overnight.

**(4) US-89 Page → Kanab.** "There are **no major services** along U.S. 89 between Kanab and Page."
<https://www.aaroads.com/guides/us-089-south-kanab-ut> The only stop is the Chevron at Big Water,
14 mi north of Page, at ~+$0.50/gal. **This stretch IS on the routed itinerary** — Bryce → Page
runs UT-12 → US-89 south through Kanab → US-89 east to Page (confirmed from the Valhalla
turn-by-turn, §1). So you drive it westbound-to-eastbound with Kanab as the last real fuel town.
**Fill in Kanab on the way in and in Page on the way out.** GAP: exact Page→Kanab mileage not sourced.

**(5) Wyoming — US-191.** Rock Springs → Pinedale "**98 miles (158 km)** through Eden and Farson."
<https://en.wikipedia.org/wiki/U.S._Route_191_in_Wyoming> **Farson** (~40 mi north of Rock Springs)
is the one intermediate service point. Jackson ↔ Rock Springs 179 mi. Between Bondurant and
Pinedale (~30 mi) there is nothing open. GAP: the Farson and Bondurant service claims come only
from AI-generated blog pages; treat as indicative.

**(6) Fuel inside Yellowstone — this one is fine.** Six in-park stations: **Mammoth, Tower
Junction, Canyon Village, Fishing Bridge, Grant Village, Old Faithful.** Key NPS line: "**All
service stations offer 24-hour, year-round credit card fueling.**"
<https://www.nps.gov/yell/planyourvisit/goodsandservices.htm> The *stores* are seasonal
(<https://stations.sinclairoil.com/wy/yellowstone-national-park>), the card-at-pump is not.
Entering from Jackson, **Grant Village is your first in-park fuel** — NPS gives South Entrance →
Grant Village as a **50-minute** drive at the park's 45 mph limit.
<https://www.nps.gov/yell/planyourvisit/directions.htm>

**(7) Grand Teton.** GAP: **no authoritative list of Grand Teton fuel stations obtained** — the
nps.gov/grte basicinfo, faqs and goodsandservices pages returned no fuel content or 404'd, and
gtlc.com service pages 404'd. NPS confirms convenience stores at Colter Bay (summer), Signal
Mountain (summer), Dornan's at Moose (year-round except November) and Headwaters/Flagg Ranch, but
does not say they pump fuel.
<https://www.nps.gov/grte/planyourvisit/eatingsleeping.htm> **Verify: 307-739-3399.**

**(8) The parks with no fuel at all.**
- Zion: "**There are no gas stations or grocery stores in Zion.**"
  <https://www.nps.gov/zion/planyourvisit/goodsandservices.htm>
- Bryce: none in the park; nearest is a Sinclair in Bryce Canyon City ~2 mi north.
  <https://www.nps.gov/brca/planyourvisit/goodsandservices.htm>
- Canyonlands: "**There is no food, lodging, or gas available in Canyonlands National Park.**"
  Island in the Sky → Moab 32 mi; Needles → Monticello 48 mi.
  <https://www.nps.gov/cany/planyourvisit/goodsandservices.htm>

**(9) US-550 Durango → Silverton → Ouray → Montrose.** GAP: no source states a no-services gap;
Durango, Silverton, Ouray and Ridgway all have stations. The constraint here is grade and weather,
not distance — but a 25-mile crossing at 11,000 ft with heavy braking burns fuel faster than the
flat-road number, and Silverton is small with limited hours.

### 8.6 Fill-up rule table

| Stretch | Gap | Fill before |
|---|---|---|
| UT-261 / UT-95, Mexican Hat → Hanksville | ~95–100 mi, zero services | **Mexican Hat or Bluff** |
| UT-95, Hanksville → Blanding (reverse) | 121–133 mi, zero services | Hanksville |
| I-70, Salina ↔ Green River | 104 mi (sign: 110) | Green River or Salina |
| Hanksville → Torrey | 48 mi | Hanksville |
| US-89, Page → Kanab | one pricey Chevron at Big Water only | **Page** |
| US-191, Rock Springs → Pinedale | 98 mi, Farson midway only | Rock Springs |
| US-191, Pinedale → Jackson | ~77–110 mi, Bondurant one cash pump | Pinedale |
| Yellowstone loop | 6 stations, 24/7 card pumps | fine |

---

---

## 9. Sunrise, sunset and daylight saving

### 9.1 Source and method

Times computed from the **US Naval Observatory Astronomical Applications API v4.0.1**,
<https://aa.usno.navy.mil/api/rstt/oneday>. **These are actual 2027 tables, not a 2026 proxy.**
Cross-checked against <https://api.sunrise-sunset.org/json> — agreement within 1–2 minutes on all
spot checks. DST transitions independently verified against the **IANA Time Zone Database
(tzdata 2026c)** via `zdump -v America/Denver`.
GAP: timeanddate.com cross-check — HTTP 403 to every fetch attempt on `/sun/`, `/time/change/usa`
and `/time/us/arizona-no-dst.html`.

**Caveat that matters for a photography trip.** USNO times assume a flat sea-level horizon with
standard refraction. A source applying an elevation correction (<https://api.sunrisesunset.io/json>)
returns systematically earlier sunrises: Moab 2027-09-22 07:06 vs 06:59:36 (−6 min); Old Faithful
2027-10-14 07:37 vs 07:27:43 (−9 min). Both are correct for different questions. **In canyon and
mountain terrain, direct light on the floor arrives near the USNO time or 30–90 minutes later,
because terrain blocks the true horizon.** Zion's valley floor and Ouray's box canyon are extreme.

### 9.2 Sunrise / sunset, 2027

All Utah, Colorado, Wyoming and Navajo Nation locations are on **MDT (UTC−6)** for all four dates.
**Page, AZ is on MST (UTC−7).** The entire Sept 22 – Oct 14 window sits inside DST — **no clock
change happens during the trip.**

| Location | TZ | Sep 22 | Sep 30 | Oct 8 | Oct 14 |
|---|---|---|---|---|---|
| Springdale / Zion | MDT | 07:20 / 19:29 | 07:26 / 19:17 | 07:33 / 19:05 | 07:39 / 18:57 |
| Bryce Canyon | MDT | 07:16 / 19:26 | 07:23 / 19:13 | 07:30 / 19:01 | 07:36 / 18:53 |
| **Page, AZ** | **MST** | **06:14 / 18:23** | **06:20 / 18:11** | **06:27 / 17:59** | **06:32 / 17:51** |
| Monument Valley (Navajo) | MDT | 07:08 / 19:17 | 07:15 / 19:05 | 07:22 / 18:54 | 07:27 / 18:45 |
| Moab | MDT | 07:06 / 19:15 | 07:13 / 19:03 | 07:20 / 18:50 | 07:26 / 18:42 |
| Ouray | MDT | 06:58 / 19:08 | 07:05 / 18:55 | 07:13 / 18:43 | 07:18 / 18:35 |
| Breckenridge | MDT | 06:52 / 19:01 | 06:59 / 18:48 | 07:07 / 18:36 | 07:13 / 18:27 |
| Jackson / Grand Teton | MDT | 07:10 / 19:20 | 07:19 / 19:06 | 07:29 / 18:52 | 07:36 / 18:42 |
| Yellowstone — Old Faithful | MDT | 07:10 / 19:21 | 07:20 / 19:06 | 07:30 / 18:51 | 07:37 / 18:41 |
| Yellowstone — Mammoth | MDT | 07:10 / 19:20 | 07:20 / 19:05 | 07:29 / 18:50 | 07:37 / 18:40 |
| Salt Lake City | MDT | 07:15 / 19:25 | 07:23 / 19:11 | 07:31 / 18:58 | 07:38 / 18:49 |

### 9.2b Sunrise / sunset for the DECIDED window — 10 Sep – 4 Oct **2028**

The trip folder's CLAUDE.md now records the dates as **10 Sep – 4 Oct 2028**, which is earlier than
the §9.2 table. Recomputed from the same USNO endpoint for actual 2028 dates
(<https://aa.usno.navy.mil/api/rstt/oneday>). Page is on MST (UTC−7); everything else MDT (UTC−6).
**DST in 2028 ends 5 Nov, so the whole window is inside DST — no clock change.**

| Location | Sep 10 | Sep 18 | Sep 26 | Oct 4 |
|---|---|---|---|---|
| Springdale / Zion | 07:11 / 19:46 | 07:17 / 19:34 | 07:24 / 19:22 | 07:31 / 19:10 |
| Bryce Canyon | 07:07 / 19:43 | 07:14 / 19:31 | 07:20 / 19:18 | 07:27 / 19:06 |
| **Page AZ (MST)** | **06:05 / 18:40** | **06:11 / 18:28** | **06:18 / 18:16** | **06:24 / 18:04** |
| Monument Valley (Navajo, MDT) | 06:59 / 19:34 | 07:06 / 19:22 | 07:12 / 19:10 | 07:19 / 18:58 |
| Moab | 06:56 / 19:33 | 07:03 / 19:20 | 07:10 / 19:08 | 07:17 / 18:55 |
| Ouray | 06:49 / 19:25 | 06:56 / 19:13 | 07:03 / 19:00 | 07:10 / 18:48 |
| Frisco / Breckenridge | 06:41 / 19:20 | 06:49 / 19:07 | 06:56 / 18:54 | 07:04 / 18:41 |
| Jackson / Grand Teton | 06:58 / 19:41 | 07:07 / 19:26 | 07:16 / 19:12 | 07:25 / 18:58 |
| Yellowstone — Old Faithful | 06:57 / 19:42 | 07:07 / 19:27 | 07:16 / 19:12 | 07:26 / 18:57 |
| Yellowstone — Mammoth | 06:56 / 19:42 | 07:06 / 19:27 | 07:16 / 19:11 | 07:25 / 18:56 |
| Salt Lake City | 07:04 / 19:44 | 07:12 / 19:30 | 07:20 / 19:17 | 07:28 / 19:04 |

**The 2028 window is materially better for driving days than the 2027 one.** Compare the last day
of each: sunset at Old Faithful is **18:57 on 4 Oct 2028** versus **18:41 on 14 Oct 2027** — 16
extra minutes of evening light at the point in the trip where you have the least. Zion at the start
gains even more: 19:46 on 10 Sep 2028 versus 19:29 on 22 Sep 2027.

### 9.3 Day length shrinks fastest exactly where the trip ends

| Location | Sep 22 | Oct 14 | Lost over the window |
|---|---|---|---|
| Springdale / Zion | 12h09 | 11h18 | −51 min |
| Moab | 12h09 | 11h16 | −53 min |
| Ouray | 12h10 | 11h17 | −53 min |
| Breckenridge | 12h09 | 11h14 | −55 min |
| Salt Lake City | 12h10 | 11h11 | −59 min |
| Jackson / Grand Teton | 12h10 | 11h06 | **−64 min** |
| Old Faithful | 12h11 | 11h04 | **−67 min** |
| Mammoth | 12h10 | 11h03 | **−67 min** |

**Southern Utah loses ~2.3 min/day; Yellowstone loses ~3 min/day.** Scheduling Yellowstone last
means roughly **one hour less usable daylight per day there than in Zion at the start**, and the
shortest day of the trip is the last one at the highest latitude. Budget shorter driving days in
Wyoming.

### 9.4 The Page vs Monument Valley clock trap — read before booking any sunrise tour

- **Page, Arizona is MST year-round.** `America/Phoenix` has zero DST transitions in tzdata for
  2027 or 2028. Arizona opted out under the Uniform Time Act via Senate Bill 1, 21 March 1968.
- **Monument Valley is Navajo Nation land and DOES observe MDT.** `America/Shiprock` shows the full
  transitions (Mar 14 2027 → MDT; Nov 7 2027 → MST). The Navajo Nation's own statement: "While most
  of Arizona does not observe Daylight Saving Time, the Navajo Nation does in order to remain on
  the same time as many of our Diné relatives, communities, and services in Utah and New Mexico."
  <https://opvp.navajo-nsn.gov/260307-daylight-savings-times/>
- **During the trip, Monument Valley clocks read one hour AHEAD of Page clocks.**

| Sep 22 | Clock sunrise | Same instant UTC |
|---|---|---|
| Page, AZ | 06:14 **MST** | 13:14 UTC |
| Monument Valley | 07:08 **MDT** | 13:08 UTC |

Note the perversity: Monument Valley's sunrise is **6 minutes earlier in real time** (it is further
east) but the clock says it is **54 minutes later**. The clock difference and the astronomical
difference point in opposite directions.

Consequences:
- A 07:00 Monument Valley sunrise slot = **06:00 on your Page hotel clock**. Driving from Page
  (~2–2.5 h) means leaving around **03:30–04:00 Page time**.
- Your phone changes on its own somewhere on the drive. Your car clock and any offline device do not.
- **Antelope Canyon is itself on Navajo Nation land immediately outside Page** — by the same rule
  its land is MDT while the town is MST. This is a chronic source of missed tour slots.
  GAP: navajonationparks.org's Antelope Canyon page 404'd and no NPS page states the operating
  time zone. **Confirm the time zone in writing with the specific tour operator at booking.**
- Extra wrinkle if routing via Hopi land: the Hopi Reservation does **not** observe DST despite
  being surrounded by the Navajo Nation. <https://en.wikipedia.org/wiki/Time_in_Arizona>
- Cross-reference §5.7: **Monument Valley's own gate opens at 08:00**, well after sunrise. Sunrise
  from the 17-mile loop requires staying at The View inside the park.

### 9.5 Daylight saving dates

Rule, 15 U.S.C. §260a: DST runs "during the period commencing at 2 o'clock antemeridian on the
**second Sunday of March** … and ending at 2 o'clock antemeridian on the **first Sunday of
November**." <https://www.law.cornell.edu/uscode/text/15/260a> · NIST states it identically:
<https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst>

| Year | DST begins | **DST ends** |
|---|---|---|
| **2027** | Sun 14 Mar 2027, 02:00 → 03:00 | **Sun 7 Nov 2027, 02:00 → 01:00** |
| **2028** | Sun 12 Mar 2028, 02:00 → 03:00 | **Sun 5 Nov 2028, 02:00 → 01:00** |

Confirmed against tzdata 2026c: `America/Denver Sun Nov 7 07:59:59 2027 UT = 01:59:59 MDT
isdst=1` → `Sun Nov 7 08:00:00 2027 UT = 01:00:00 MST isdst=0`.

**A 20 Sep – 14 Oct 2027 trip is entirely within DST.** So is a 10 Sep – 4 Oct 2028 trip. **No
clock change to plan around in either window.**

NIST lists the non-observing areas as Hawaii, American Samoa, Guam, Puerto Rico, the US Virgin
Islands, and "Arizona (with an exception for the Navajo Indian Reservation, which does observe DST)."

### 9.6 Civil twilight / blue hour

USNO defines civil twilight as beginning/ending when the sun's centre is 6° below the horizon.
<https://aa.usno.navy.mil/faq/RST_defs> Computed from the USNO tables across all 44
location-date combinations, the offset is stable at **26–30 minutes** and barely moves across the
window:

| Region | Civil twilight before sunrise / after sunset |
|---|---|
| Southern Utah & Arizona (Zion, Bryce, Page, Monument Valley) | **26 min** |
| Moab, Ouray | 26–27 min |
| Breckenridge | 27 min |
| Salt Lake City | 27–28 min |
| Jackson / Grand Teton | 28–29 min |
| Yellowstone | **29–30 min** |

Photographers' "blue hour" is narrower — roughly **10–11 minutes** at the dark end of civil
twilight (<https://api.sunrisesunset.io/json>). Example: Moab Sep 22 morning blue hour 06:33–06:43,
golden hour 06:43–07:34; Old Faithful Oct 14 morning blue hour 06:58–07:09.

**Field rule: on location and set up 35–40 min before the listed sunrise; stay 30 min past sunset.**
In Zion, Ouray and Monument Valley add more on the sunrise side — canyon walls mean direct light
lands well after the tabled time.

---

---

## 10. Border and entry for a Canadian, and drones

### 10.1 Canadian **citizen**, flying YYZ → LAS

- **Passport required.** "Canadian citizens travelling by air to the United States must present one
  of the following documents: a passport, which must be **valid for the duration of their stay**; a
  valid NEXUS card, used at self-serve kiosks at designated airports."
  <https://travel.gc.ca/locations/united-states> · Regulation 8 CFR 212.1(a)(1):
  <https://www.ecfr.gov/current/title-8/section-212.1>
  Note the validity rule is "valid for the duration of the stay," **not** the usual
  six-months-beyond convention.
- **No visa.** 9 FAM 201.1-3(B): "A visa is not required for Canadian citizens except for those who
  apply for admission in E, K, V, or S nonimmigrant classifications."
  <https://fam.state.gov/fam/09FAM/09FAM020101.html> Canadians are normally admitted for up to
  **6 months**.
- **No ESTA.** ESTA "determines the eligibility of visitors to travel to the United States **under
  the Visa Waiver Program**" (<https://www.cbp.gov/travel/international-visitors/esta>), and
  **Canada is not on the DHS VWP list** (<https://www.dhs.gov/visa-waiver-program>). Canadians are
  exempt under a separate, broader authority. GAP: a single verbatim CBP sentence saying
  "Canadians do not need ESTA" — esta.cbp.dhs.gov and help.cbp.gov are JavaScript SPAs.
- **US Preclearance at Toronto Pearson.** "CBP Preclearance is the strategic stationing of CBP
  personnel at designated foreign airports to inspect travelers prior to boarding U.S.-bound
  flights." CBP operates at 16 locations including Toronto.
  <https://www.cbp.gov/border-security/ports-entry/operations/preclearance>
  Port hours: **Toronto Pearson T1 and T3: 03:30–21:00**. <https://www.cbp.gov/travel/preclearance>
  Air Canada (YYZ→LAS from T1): check-in/bag drop opens 4 h before, closes 60 min before; gate
  deadline 30 min; "For flights to the U.S. departing before 9 am, a queue system is in place."
  <https://www.aircanada.com/ca/en/aco/home/plan/check-in-information/check-in-and-boarding-times.html>
  GAP: torontopearson.com's own preclearance page and GTAA recommended arrival time — the site
  serves CAPTCHAs to all automated requests.
- **The >30-day alien registration rule applies in principle, but an air arrival is already
  registered.** travel.gc.ca: "Canadians and other foreign nationals visiting the United States for
  periods **longer than 30 days** must be registered with the United States Government. Failure to
  comply … could result in penalties, fines, and misdemeanor prosecution… **You can verify if you
  have been automatically registered on entry to the U.S. by looking up your I-94 admission form.**"
  USCIS lists as already registered: "**Aliens admitted to the United States as nonimmigrants who
  were issued Form I-94, I-94A, or I-94W (paper or electronic)**," and lists as *not* registered:
  "Canadian visitors who entered the United States **at land ports of entry** and were not issued …
  a Form I-94." <https://www.uscis.gov/alienregistration>
  **A 25-day trip is under 30 days anyway — but precleared at YYZ means an electronic I-94 is
  issued, so registration is automatic either way.** Verify at <https://i94.cbp.dhs.gov/> after
  entry. If no I-94 exists, Form **G-325R** must be filed online before day 30, **fee $0**
  (<https://www.uscis.gov/g-325r>).
  Carry requirement for 18+: evidence of registration must be carried at all times; a mobile device
  displaying the I-94 satisfies it. Penalty for failure to carry: "fined not to exceed $5,000 or
  … imprisoned not more than 30 days, or both."
- Dual Canadian-American citizens **must enter on the US passport**. Presidential Proclamation
  10998 (effective 1 Jan 2026) restricts entry for nationals of 39 countries; travel.gc.ca confirms
  "Canadian citizens, including dual citizens, travelling on a Canadian passport are **not** subject
  to these entry limitations."

### 10.2 Canadian **permanent resident** (non-citizen)

**Entry follows citizenship, not PR status.**
> "**Permanent residents (landed immigrants) of Canada must have a nonimmigrant visa.**"
> <https://adoption.state.gov/content/travel/en/us-visas/tourism-visit/citizens-of-canada-and-bermuda.html>
> (travel.state.gov mirror — travel.state.gov itself returns 403 to automated fetches)

Air Canada's operational version: "**Canadian permanent residents/landed immigrants travelling to
the United States as non-immigrants must have a valid passport and either a valid non-immigrant
visa or an ESTA depending on their citizenship.**"
<https://www.aircanada.com/ca/en/aco/home/plan/travel-requirements/travel-documents.html>

**A PR card confers no US entry right** — its role is re-entry to Canada, for which you carry both
the passport and the PR card.

**Stale-regulation trap, flagged:** 9 FAM 201.1-3(B)(c) still describes a waiver for "permanent
residents of Canada or Bermuda who have a common nationality with Canadians… citizens of all
Commonwealth countries" (listing India, Nigeria, Pakistan). **The current text of 22 CFR 41.2(b) no
longer says this** — it covers only "Citizens of the British Overseas Territory of Bermuda"
(<https://www.ecfr.gov/current/title-22/section-41.2>), and 8 CFR 212.1(a) has no Commonwealth
carve-out. **Do not rely on it. Plan on visa-or-ESTA by citizenship.**

- **VWP/ESTA-eligible (42 countries)**: <https://www.dhs.gov/visa-waiver-program> — includes most
  of Western Europe, Australia, NZ, Japan, Korea, Singapore, Taiwan, Chile, Israel, Qatar, UK.
- **Not on the list → B1/B2 visa required**: India, Philippines, Nigeria, China, Pakistan,
  Bangladesh, Sri Lanka, Vietnam, Brazil, Mexico, South Africa, Kenya, Egypt, Indonesia, Thailand,
  Turkey and others.
- **ESTA fee is $40.27, not $21 or $40**: "the inflation-adjusted **FY 2026 ESTA fee will be
  $40.27** ($17 + $10.27 + $13) per travel authorization" … "CBP will begin assessing the FY 2026
  amounts … on **January 1, 2026**." EVUS FY2026 $30.75.
  <https://www.federalregister.gov/documents/2025/11/19/2025-20304/certain-dhs-immigration-fees-required-by-hr-1-fiscal-year-2026-adjustments-for-inflation>
  ESTA is normally 2 years, multiple entry. VWP stay is capped at **90 days** and an **e-Passport
  is mandatory**.
- **B1/B2 in Canada:** DS-160 → MRV fee **$185** → interview at
  <https://ais.usvisa-info.com/en-ca/niv>. From 1 Jul 2026 a **$750 expedited appointment fee**
  exists at select posts, *in addition to* the $185.
  <https://www.federalregister.gov/documents/full_text/text/2026/06/09/2026-11513.txt>
  Same rule: "while the median global wait time for an NIV appointment is approximately 30 days, at
  certain posts wait times **exceed 12 months**." US Mission Canada: "Non-Canada resident applicants
  can anticipate wait times of approximately **600 calendar days**."
  <https://ca.usembassy.gov/visas/> The DS-160 number must match the booking number or the
  interview is forfeited.
  **A Canadian PR from a non-VWP country should start the B1/B2 process many months ahead of a
  Sept 2028 trip.**
  GAP: post-by-post wait times for Toronto/Montreal/Vancouver — travel.state.gov 403;
  ustraveldocs.com/ca and ais.usvisa-info.com are JS-only. Check
  <https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html>
  in a browser. GAP: the HR-1 "visa integrity fee" — the Federal Register notice announces it with
  no dollar amount and no implementation date. Do not budget a number.

### 10.3 Travel medical insurance — two findings that change the plan

**Finding 1: the "OHIP covers nothing since 2020" premise could not be verified, and ontario.ca
contradicts it.** The live page still documents an active Travellers Program:
> "**Emergency outpatient services** — OHIP will pay whichever is less: **up to $50 (Canadian) per
> day**; the amount billed by the hospital. **Emergency inpatient services** — OHIP will pay up to:
> **$400 (Canadian) per day** for services provided in an operating room, a coronary care unit, an
> intensive care unit…; **$200 (Canadian) per day** for lower levels of care."
> "**We recommend that you buy private health insurance before leaving Ontario.**"
> "**OHIP does not cover the cost of a transfer to an Ontario hospital** for ongoing care."
> <https://www.ontario.ca/page/ohip-coverage-while-outside-canada>
GAP: verification that the Out-of-Country Travellers Program ended 1 Jan 2020 — ontario.ca
contradicts it and health.gov.on.ca is unreachable (**expired TLS certificate**).
**Either way the number is functionally nil** against US pricing. travel.gc.ca: "**Make sure you
get travel insurance that includes coverage for medical evacuation and hospital stays**" and "your
provincial or territorial health plan may cover none, or only a small part, of the costs of your
medical care abroad" and "will never pay your bills up front."
<https://travel.gc.ca/travelling/documents/travel-insurance>

**Finding 2 — the 25-day problem. Card travel-medical coverage is capped by trip length and 25 days
is exactly the boundary.**
- **RBC Avion Visa Infinite — 15 days.** "Coverage is provided for the **first fifteen (15)
  consecutive days** of your trip if you are under 65 … or for the **first three (3) consecutive
  days** if you are 65 years of age or older." Top-up available by phone (1-866-292-5233).
  <https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf>
  **A 25-day trip has NO coverage on days 16–25.**
- **Scotiabank Passport Visa Infinite — 25 days, counted inclusively.** "Coverage is provided for
  the **first 25 consecutive days**…" and "**There is no coverage for that portion of a Trip which
  extends beyond the first 25 consecutive days**," counted "**including the day of departure and
  day of return**."
  <https://www.scotiabank.com/content/dam/scotiabank/canada/common/documents/pdf/Passport-Infinite-plus-COI-EN.pdf>
  **A trip described as "25 days" that spans 26 calendar days wheels-up to wheels-down has zero
  coverage on the final day, and the exclusion is not pro-rated.** 10 Sep – 4 Oct 2028 inclusive is
  **25 calendar days** — it fits Scotiabank exactly, with no margin.
- **Age 65+ collapses both caps to 3 days.**
- Both require phoning the assistance line *before* treatment.
GAP: TD and American Express Canada benefit guides — all candidate URLs 404. RBC (15) and
Scotiabank (25) bracket the realistic range.

**Recommendation for the synthesis agent: budget a standalone 25-day travel-medical policy. Do not
assume the credit card covers the trip.**

### 10.4 Drones — all eleven parks on this route ban them

| Unit | Status | Source |
|---|---|---|
| **Zion NP** | Banned — "Use of remote-controlled equipment (including … drones …) within Zion National Park is prohibited." | <https://www.nps.gov/zion/learn/management/lawsandpolicies.htm> |
| **Bryce Canyon NP** | Banned — same wording, "prohibited by law." | <https://www.nps.gov/brca/learn/management/lawsandpolicies.htm> |
| **Glen Canyon NRA (incl. Horseshoe Bend)** | Banned — "Launching, landing, or operating an uncrewed aircraft from or on lands and waters administered by the National Park Service within the boundaries of Glen Canyon NRA and Rainbow Bridge NM is prohibited except as approved in writing by the superintendent." | <https://www.nps.gov/glca/learn/management/lawsandpolicies.htm> |
| — Horseshoe Bend jurisdiction | **NPS land within Glen Canyon NRA**; only the *parking lot* is City of Page. So the ban applies. | <https://www.nps.gov/glca/planyourvisit/horseshoe-bend.htm> |
| **Monument Valley Navajo Tribal Park** | Banned **+ confiscation** — "**Drones are Prohibited at all Navajo Tribal Park locations. Drones will be confiscated if flown within the tribal park locations.**" Homepage: "strictly Prohibited inside the Navajo Tribal Park lands **and across our Great Nation**." | <https://navajonationparks.org/permits/> · <https://navajonationparks.org/> |
| **Natural Bridges NM** | Banned (SEUG determination). | <https://www.nps.gov/cany/learn/news/news082014.htm> |
| **Canyonlands NP** | Banned. | <https://www.nps.gov/cany/learn/management/determination-drones.htm> |
| **Arches NP** | Banned — superintendent's determination under **36 CFR 1.5**; explicitly rejects designated-zone alternatives. | <https://www.nps.gov/arch/learn/management/determination-drones.htm> |
| **Capitol Reef NP** | Banned — rationale cites that 96% of the park is designated Wilderness, plus Mexican Spotted Owl and Desert Bighorn. | <https://www.nps.gov/care/learn/management/compendium.htm> |
| **Mesa Verde NP** | Banned — "the use of drones within the park boundaries is **illegal under all circumstances**." Cites 36 CFR 2.17(a)(3). | <https://www.nps.gov/meve/learn/management/lawsandpolicies.htm> |
| **Grand Teton NP** | Banned. | <https://www.nps.gov/grte/learn/management/lawsandpolicies.htm> |
| **Yellowstone NP** | Banned under 36 CFR §1.5(f). | <https://www.nps.gov/yell/learn/management/lawsandpolicies.htm> |

**Legal basis and penalty.** "**Policy Memorandum 14-05**, released by the NPS director in June
2014, directed each superintendent to use the authority under **36 CFR 1.5** to prohibit the
launching, landing, or operation of uncrewed aircraft." "**Jurisdiction by the NPS ends at the park
boundary.**" Penalty: "**a misdemeanor with the maximum penalty of six months in jail and a $5,000
fine.**" Rangers can also cite 36 CFR §2.2 (harassing wildlife), §2.34 (disorderly conduct) and
§2.12(a)(3).
<https://www.nps.gov/orgs/aviationprogram/upload/uncrewed-aircraft-in-national-parks.pdf> ·
<https://home.nps.gov/articles/uncrewed-aircraft-in-the-national-parks.htm> ·
<https://www.law.cornell.edu/cfr/text/36/1.5>
Launching outside and flying in is not a loophole: overflight still exposes you to §2.2 and §2.34
citations and to FAA airspace rules.

**BLM, USFS and Utah State Parks are materially different — and this is where the drone can
actually fly on this route.**
- **BLM** (relevant to Bears Ears, Valley of the Gods, Cedar Mesa, Factory Butte): generally
  permitted, but **launch and landing are regulated as OHV use**. "The BLM regulates drones while
  they are on or immediately over the ground. When they are involved in any phase of take-off or
  landing, drone users must follow **Off-Highway Vehicle (OHV) regulations as defined in 43 CFR
  8340. This means that you must launch and land your drone on designated routes only.**" And:
  "**Don't launch or land your drone in designated wilderness**" (Wilderness Act §4(c)). Wildfire
  TFRs: "It is illegal to operate a drone where a TFR is in place" — <https://tfr.faa.gov/tfr2/list.html>
  <https://www.blm.gov/sites/default/files/docs/2023-04/Drone%20Fact%20Sheet%20Final.pdf>
  GAP: a BLM *national* recreational drone policy statement — blm.gov has none; this Utah Canyon
  Country fact sheet is the most authoritative reachable source and is region-specific.
- **National Forests (USFS)**: "The public can fly UAS on National Forest System lands for fun or
  recreation" per FAA recreational rules, **but** "UAS are considered to be both motorized equipment
  and mechanical transport and as such they **cannot take off from, land in, or be operated from
  congressionally designated Wilderness Areas**." Maintain 2,000 ft above Wilderness.
  <https://www.fs.usda.gov/managing-land/fire/aviation/uas/faq>
- **Utah State Parks** — per-park, permit-based, seasonally restrictive:
  - **Dead Horse Point SP** (Moab, on the BRAINSTORM Day 11 sunset plan): "**drones are prohibited
    from March through October** of each year throughout the entire park." Nov 1 – end of Feb:
    permit only, **$10/day**, in person at the visitor centre; "drone operation at the main
    viewpoint of Dead Horse Point [is] not permitted."
    <https://stateparks.utah.gov/parks/dead-horse/drone-regulations/>
    → **A late-Sep/early-Oct trip is inside the total ban.**
  - **Goblin Valley SP**: permit required year-round, **$15/day**, in person only, not available in
    advance; Mar 1 – Oct 31 "**no drones … on weekends or holidays**," max 2 permits/hour Mon–Fri,
    10/day, and flights only over Valley 1 from the designated platform.
    <https://stateparks.utah.gov/parks/goblin-valley/drone/>
  - GAP: Valley of the Gods and Goosenecks State Park specific rules — Valley of the Gods is BLM
    (the Bears Ears fact sheet applies); Goosenecks SP has no drone page in the Utah State Parks
    index. Assume permit-required and confirm.

**What a Canadian must do to fly recreationally in the US.**
- **A foreign national cannot hold a US drone registration — they get a "recognition of ownership."**
  "**A U.S. citizen or legal permanent resident. For foreign operators, FAA will consider the
  certificate issued to be a recognition of ownership rather than a certificate of U.S. aircraft
  registration.**" Registration is **$5, valid 3 years**, and covers all drones in your inventory.
  "All drones must be registered, except those that weigh **0.55 pounds or less (less than 250
  grams)** and are flown under the Exception for Limited Recreational Operations."
  <https://www.faa.gov/uas/getting_started/register_drone> · 14 CFR 48.20 / 48.15:
  <https://www.law.cornell.edu/cfr/text/14/48.20>
- **FAA's foreign-operator checklist:** "**If the foreign drone has FAA remote ID broadcasting
  capabilities and is registered in a country outside of the United States, then you must submit a
  Notice of Identification (NOI) to the FAA before you fly.**" And: "**If your drone is not
  registered in a country outside the United States and/or does not have Remote ID, the only place
  you can operate your drone is within the geographic boundaries of an FAA-Recognized Identification
  Area (FRIA).**" <https://www.faa.gov/uas/resources/foreign_operators>
- **TRUST is mandatory:** "**You are required by law to take TRUST and carry proof when flying.**"
  <https://www.faa.gov/uas/recreational_flyers>
- **Remote ID** in force since 16 Sep 2023; three routes to compliance — Standard Remote ID drone,
  a Broadcast Module, or flying inside a FRIA.
  <https://www.faa.gov/uas/getting_started/remote_id>
- **A Transport Canada RPAS certificate is not recognised.** For commercial work: "The FAA does not
  currently recognize any foreign RPC or equivalent," and commercial operation needs DOT authority
  under 14 CFR Part 375.
- GAP: whether a specific Canadian-bought DJI model appears on the FAA Declaration of Compliance
  list — must be checked per model in the FAA Declaration of Compliance System.

**Practical verdict for this trip: the drone is dead weight for most of it.** Every national park
and Monument Valley bans it, Dead Horse Point bans it outright in the trip's season, and the only
genuinely legal, interesting flying is on BLM land — Factory Butte, the Bentonite Hills, Valley of
the Gods, Cedar Mesa outside wilderness — with launch and landing confined to designated routes.
Add the FAA registration, NOI, TRUST and Remote ID steps before departure, and confirm no TFR.

---

---

## 11. Elevation profile, passes, and altitude

### 11.1 Passes actually crossed on this route

Route composition confirmed by reading the Valhalla turn-by-turn narrative for each leg (same
API as §0), so these are the passes on the *routed* line, not a guess.

| Pass | Elevation | Highway | On which leg | Notes |
|---|---|---|---|---|
| **Coal Bank Pass** | **10,640 ft / 3,240 m** | US-550 | Durango → Silverton | <https://en.wikipedia.org/wiki/U.S._Route_550> |
| **Molas Pass** | **10,970 ft / 3,340 m** | US-550 | Durango → Silverton | same |
| **Red Mountain Pass** | **11,018 ft / 3,358 m** | US-550 | Silverton → Ouray | 8% grade, switchbacks, no shoulder, no guardrails. <https://en.wikipedia.org/wiki/Red_Mountain_Pass> |
| **Monarch Pass** | **11,312 ft / 3,448 m** | US-50 | Ouray → Breckenridge | "6% grade for 10 miles" east descent, "6% grade for 9 miles" west. Generally open year-round; temporary closures in severe storms. <https://en.wikipedia.org/wiki/Monarch_Pass> |
| **Poncha Pass** | **9,010 ft / 2,750 m** | US-285 | Ouray → Breckenridge | <https://en.wikipedia.org/wiki/Poncha_Pass> |
| **Hoosier Pass** | **11,542 ft / 3,518 m** | CO-9 | Ouray → Breckenridge (final 14 mi, Fairplay → Breck) | On the Continental Divide. "Smooth approach on the south side but has several switchbacks on the north side with a grade of 8%." Open all year, occasional storm closures. <https://en.wikipedia.org/wiki/Hoosier_Pass> |
| **Rabbit Ears Pass** | **9,426 ft / 2,873 m** | US-40 | Breckenridge → Rock Springs (Kremmling → Steamboat) | "Often receives a great deal of snow in winter and is subject to regular short closures during heavy winter storms." <https://en.wikipedia.org/wiki/Rabbit_Ears_Pass> |
| **Togwotee Pass** | **9,655 ft / 2,943 m** | US-26/287 | **only if** the Lander/Dubois routing is chosen | Annual snowfall "often surpassing 25 feet"; closures during blizzards common. Best Teton reveal of any approach. <https://en.wikipedia.org/wiki/Togwotee_Pass> |

**Named in the brief but NOT on the routed line — worth stating explicitly:**

- **Loveland Pass, 11,990 ft / 3,650 m** (US-6, 6.7% grade, hairpins, Continental Divide). It is
  the *hazmat and over-height bypass* around the Eisenhower Tunnel on I-70; vehicles over
  **13 ft 11 in** and all hazmat traffic are banned from the tunnel and must use it.
  <https://en.wikipedia.org/wiki/Loveland_Pass> — This route only touches it if you detour to
  Denver or drive I-70 east of Silverthorne. Breckenridge → Rock Springs goes **north on CO-9**
  and never uses I-70 east.
- **Vail Pass, 10,662 ft** (I-70, 7% grades both sides, two runaway truck ramps westbound).
  <https://en.wikipedia.org/wiki/Vail_Pass> — only if you drive I-70 west from Breckenridge.
- **Boreas Pass** (a Breckenridge day-drive on the BRAINSTORM Day 17). GAP: elevation and surface
  not verified — no source fetched. It is an unpaved former railroad grade; confirm before adding.

### 11.2 Sleeping elevations, in order

| Base | Elevation | Source |
|---|---|---|
| Las Vegas | ~2,000 ft | GAP: not sourced |
| Springdale / Zion | **3,855 ft / 1,175 m** | <https://en.wikipedia.org/wiki/Springdale,_Utah> |
| Bryce Canyon City | ~7,700–8,000 ft (rim 8,000–9,100 ft) | GAP: not sourced |
| Page AZ | **4,101 ft / 1,250 m** (MST year-round, no DST) | <https://en.wikipedia.org/wiki/Page,_Arizona> |
| Monument Valley | ~5,200 ft | GAP: not sourced |
| Hanksville / Torrey | ~4,300 / ~6,800 ft | GAP: not sourced |
| Moab | **4,026 ft / 1,227 m** | <https://en.wikipedia.org/wiki/Moab,_Utah> |
| Durango | ~6,500 ft | GAP: not sourced |
| **Silverton** | **9,320 ft / 2,840 m** | <https://en.wikipedia.org/wiki/U.S._Route_550> |
| **Ouray** | **7,792 ft / 2,375 m** | <https://en.wikipedia.org/wiki/Ouray,_Colorado> |
| **Breckenridge** | **9,728 ft / 2,965 m** (infobox); the article's Geography section gives **9,601 ft / 2,926 m** | <https://en.wikipedia.org/wiki/Breckenridge,_Colorado> |
| Rock Springs / Pinedale / Lander | **6,388 / 7,175 / 5,358 ft** | see §2.4 |
| Jackson WY | **6,237 ft / 1,901 m** | <https://en.wikipedia.org/wiki/Jackson,_Wyoming> |
| Yellowstone (Old Faithful) | ~7,350 ft | GAP: not sourced |
| Salt Lake City | ~4,300 ft | GAP: not sourced |

GAP: town elevations marked above were not individually sourced — Wikipedia infoboxes are the
obvious fix but were not fetched for each. The ~9,600 ft figure for Breckenridge used in the brief
is confirmed (it is the Geography-section figure; the infobox says 9,728 ft).

### 11.3 Altitude sickness — Breckenridge is the real exposure

Source: MedlinePlus (US National Library of Medicine), *Acute mountain sickness*
<https://medlineplus.gov/ency/article/000133.htm>

- Onset threshold: AMS affects travellers at high altitudes **"usually above 8000 ft (2400 m)."**
  **Breckenridge at ~9,600–9,700 ft is comfortably above that line, and it is a sleeping
  elevation, not a drive-through.**
- Symptoms (mild–moderate): headache, nausea, fatigue, dizziness, **difficulty sleeping**, loss of
  appetite, rapid heartbeat, shortness of breath on exertion. Severe: confusion, ataxia,
  coughing blood, breathlessness at rest.
- Risk factors: **rapid ascent from sea level**, prior history, inadequate acclimatisation,
  pre-existing heart/lung conditions, anaemia.
- Ascent-rate guidance: spend a few days ascending to 9,850 ft (3,000 m); above that, don't raise
  your **sleeping** elevation more than 990–1,640 ft (300–500 m) per night.
- Prevention: gradual ascent, rest every 2,000 ft above 8,000 ft, **sleep lower where possible**,
  hydrate, carbohydrate-rich meals, **avoid alcohol**. Acetazolamide as a preventative.
- Treatment: descent is the primary intervention.

**How this itinerary actually scores.** It is not a sea-level-to-9,600 ft jump. The sleeping
profile before Breckenridge is roughly: Springdale ~3,900 → Bryce ~7,700 → Page 4,300 →
Monument Valley ~5,200 → Hanksville ~4,300 → Moab ~4,000 → Durango ~6,500 → **Ouray 7,792** →
**Breckenridge ~9,700**. So there are 10+ days above 4,000 ft and two nights at 7,700–7,800 ft
immediately before Breckenridge. That is a reasonable staged ascent and materially lowers risk.

The specific things to still flag:
1. **The single largest overnight jump is Ouray 7,792 → Breckenridge ~9,700 = ~1,900 ft**, well
   over the 990–1,640 ft/night guidance. Not dangerous at this altitude band, but it is the night
   people sleep badly.
2. **Bryce on Day 4–5 is the first hit**: Springdale ~3,900 ft → Bryce ~7,700 ft on Day 4, having
   flown from Toronto (~250 ft) three days earlier. Expect the headache there, not in Colorado.
3. **Hoosier Pass at 11,542 ft on the drive in**, and Yankee Boy Basin / Imogene at 11,000–13,000 ft
   from Ouray, are the exertion points. Hiking hard on arrival day at Breckenridge is the classic
   mistake.
4. Alcohol at 9,700 ft on arrival night is the other classic mistake.
5. GAP: no Colorado-specific public-health source obtained — cdc.gov and uchealth.org both
   returned HTTP 403 to automated fetch, and colorado.com 403'd. MedlinePlus is a solid substitute
   but is generic rather than Colorado-tuned.


---

---

## 12. Seasonal road closures that bound the driving plan (bonus — not in the brief but load-bearing)

- **Yellowstone.** "Most park roads are closed to regular vehicles from **early November to
  late-April**." Dunraven Pass (Canyon Village → Tower Fall) ran **May 22 – October 12** in 2026,
  and NPS notes "this is a high elevation pass that generally experiences more winter weather than
  other roads in the park." Beartooth Highway: "open the Friday of Memorial Day weekend to
  **mid-October**." <https://www.nps.gov/yell/planyourvisit/parkroads.htm>
  → **The rejected 2027 window (20 Sep – 14 Oct) would have put Yellowstone at 10–13 Oct — inside
  the Dunraven Pass closing window**, and the Canyon → Tower → Lamar Valley plan in the BRAINSTORM
  day shape depends on Dunraven. **The decided 10 Sep – 4 Oct 2028 window puts Yellowstone around
  28 Sep – 2 Oct, roughly ten days clear of the Dunraven and Beartooth closings.** This is the
  single strongest driving-logistics argument for the 2028 dates.
- **Yellowstone driving speed.** "The speed limit in Yellowstone is **45 mph** unless posted
  otherwise," and "**average drive times listed below may be significantly longer due to wildlife
  on the roadway, weather, or infrastructure improvement projects.**"
  <https://www.nps.gov/yell/planyourvisit/directions.htm> This is the authority for why every
  routing-engine time inside the park is optimistic (§1.2).
- **Grand Teton.** "**Teton Park Road** closed **November 1** to April 30 from Taggart Lake
  Trailhead to Signal Mountain Lodge." "**Moose-Wilson Road** closed **November 1** until mid-May."
  "Other roads such as **Antelope Flats, Deadmans Bar, Grassy Lake, Pilgrim Creek, Schwabacher, and
  Two Ocean are closed seasonally based on conditions**." US-89/191 and US-26/287 from Jackson to
  Flagg Ranch are "plowed and open for winter travel." NPS: "Make sure your vehicle is equipped
  with winter or all-season tires and **carry tire chains when driving over mountain passes**."
  <https://www.nps.gov/grte/planyourvisit/roads.htm>
  → **Schwabacher Landing (the sunrise shot on BRAINSTORM Day 20) is a conditions-based closure,
  not a dated one.** In mid-October it is a coin flip. Have a fallback (Oxbow Bend, Snake River
  Overlook — both off the main highway).
  → "Carry tire chains" is directly at odds with most rental agreements. See §6.
- **Zion.** Shuttle-only on the Canyon Scenic Drive through late November (§1.3), and the
  Zion–Mt Carmel Tunnel size limits on the eastbound leg (§1.3).
- **Monument Valley.** Gate hours 08:00–17:00 winter / 08:00–19:00 summer, last entry 14:30 / 16:30
  (§5.7). GAP: the changeover date between the two schedules.
- **US-550 / Red Mountain Pass.** No seasonal closure — maintained all winter — but individual
  storms close it and CDOT can impose a Traction Law within hours (§3.4, §3.5).
- **Ouray alpine roads (CR-26 Yankee Boy, CR-361 Black Bear).** Ouray County publishes a "Winter
  and Spring Operating Plan for CR-361 & CR-26." GAP: the actual dates. Call **(970) 626-5391**.

---

---

## 13. Consolidated GAPs and the calls that close them

Every unverified item in this file, with the source that failed. Two structural causes: the
session's **WebSearch budget was exhausted (200/200)** partway through, and every fallback search
engine (DuckDuckGo, Brave, Bing, Qwant, Mojeek, Ecosia, Startpage, SearXNG mirrors, Marginalia) was
CAPTCHA-walled, 403'd, 429'd or returned degraded results from this network. Everything below was
therefore attempted by direct URL probing.

### Highest value — these change decisions

| GAP | What failed | How to close |
|---|---|---|
| **Actual quoted LAS→SLC one-way drop fee, Sept–Oct 2028** | All rate engines are JS-only | Run a live booking query on nationalcar.com, hertz.com, avis.com. Price National first (§6.1) |
| **Alstrom Point road: distance, surface, vehicle class** | No NPS page exists; visitsouthernutah.com has title+photo only; americansouthwest.net, utah.com, blm.gov all 404 | Call Glen Canyon NRA / Big Water contact station. **Until then treat it as guided-tour-or-drop** |
| **Yankee Boy Basin: mileage, where 4WD starts, CR-26 seasonal closing date** | visitouray.com mentions it but never details it; USFS GMUG pages 301-redirect to a generic landing page; the county operating plan is a link-only document | **Ouray County Road & Bridge (970) 626-5391** |
| **Grand Teton fuel stations AND cell service** | nps.gov/grte basicinfo, faqs and goodsandservices returned no content or 404; gtlc.com service pages 404 | **Grand Teton 307-739-3399** |
| **Antelope Canyon / Navajo Parks operating time zone** | navajonationparks.org Antelope Canyon page 404; no NPS page states it | **Confirm in writing with the tour operator at booking.** This is the trip's worst clock trap (§9.4) |
| **Cathedral Valley / Fremont ford current state** | — (the CLAUDE.md note says the ford is currently impassable) | **Capitol Reef 435-425-3791.** Drive the loop anti-clockwise to avoid the ford entirely (§5.1) |

### Road and vehicle

- **GAP: Google Maps drive times** — no fetchable endpoint. All times in §1 are OpenStreetMap
  routing-engine estimates. Distances are solid; times are not sourced.
- **GAP: UDOT primary source for the Moki Dugway 28 ft / 10,000 lb advisory** — udot.utah.gov and
  visitutah.com 404'd on every guessed path. dangerousroads.org is a secondary source paraphrasing
  the roadside sign.
- **GAP: posted speed limit on the Moki Dugway**, and whether UT-261 ever closes seasonally.
- **GAP: CDOT vehicle-length restriction on US-550 Ouray–Silverton** — none found; the San Juan
  Skyway page carries no RV/trailer warning at all.
- **GAP: Bentonite Hills access road name/number and mileage from Hanksville**, and a stated
  vehicle class. capitolreefcountry.com gives none; no BLM page locatable.
- **GAP: BLM Utah primary page for Factory Butte** — every blm.gov URL guessed returned 404.
- **GAP: Boreas Pass elevation and surface** (a Breckenridge/Frisco day-drive in the BRAINSTORM).
- **GAP: chain-fitting clause in rental T&Cs** — Grand Teton NPS says "carry tire chains when
  driving over mountain passes," which most rental agreements forbid. Unresolved conflict.
- **GAP: Hertz verbatim unpaved-road prohibition** and **Dollar/Thrifty's** — both live only in the
  counter agreement. Read it before signing.
- **GAP: GM ground clearance (Tahoe, Suburban, Equinox, Yukon)** — GM publishes no figure anywhere.
- **GAP: Canadian credit-card CDW off-road exclusion wording** — no Canadian benefit guide reachable.
- **GAP: Enterprise credit-card name-match rule.**
- **GAP: any Utah/Colorado rental location advertising *guaranteed* 4WD.** None found.

### Wyoming leg

- **GAP: US-191 Rock Springs → Pinedale wind / ground blizzard, official statement** — the WYDOT
  conditions-by-route query is a form POST that cannot be driven by a fetcher.
- **GAP: WY-28 / South Pass winter closure behaviour.**
- **GAP: WY-22 / Teton Pass 2028 status** after the June 2024 collapse and rebuild.
- **GAP: WY-789 Baggs → Creston Junction description** — travelwyoming.com road-trips index 404.
- **GAP: Dubois lodging list; Steamboat, Craig and Rawlins hotel counts; Pinedale and Lander
  restaurant counts.**
- GAP: no sourced statement that **Craig CO fills during rifle elk season** — but the "Elk Hunting
  Capital of the World" branding plus late-Sep/Oct timing makes booking ahead non-negotiable.

### Fuel, cell, sun

- **GAP: county-level Utah/Wyoming gas prices** — AAA renders them only in an interactive map.
- **GAP: current pump prices for Springdale, Torrey, Bryce Canyon City, Jackson, in-park
  Yellowstone** — GasBuddy 403s automated fetch.
- **GAP: mid-grade (87) vs "regular" (85) price differential per state** — matters more than the
  gateway premium (§8.4).
- **GAP: Hanksville station operating hours.** **GAP: exact Page→Kanab mileage.**
- **GAP: Yellowstone 2028 in-park station opening dates.**
- **GAP: Monument Valley cell coverage** — tribal land, so no NPS page exists.
- **GAP: Zion and Bryce official NPS cell statements** — the "Internet & Cellular Access Details"
  blocks are collapsed elements that do not render to a fetcher. Zion 435-772-3256,
  Bryce 435-834-5322.
- **GAP: AT&T-network travel eSIM pricing**; **GAP: Gaia GPS / onX pricing and offline limits**;
  **GAP: Google/Pixel Satellite SOS availability and cost**; **GAP: Telus Easy Roam official US rate.**
- **GAP: timeanddate.com cross-check on sun times** — 403 on every path. USNO (primary US government
  source) plus api.sunrise-sunset.org and IANA tzdata were used instead, which is stronger anyway.
- **GAP: terrain-adjusted sunrise times** — no source models canyon-wall or ridge obstruction. Zion,
  Ouray and Monument Valley figures are unobstructed-horizon times.
- **GAP: town elevations for Las Vegas, Bryce Canyon City, Monument Valley, Hanksville/Torrey,
  Durango, Yellowstone, Salt Lake City** — not individually fetched (§11.2).
- **GAP: Monument Valley summer→winter hours changeover date.**

### Border, drones, insurance

- **GAP: verbatim CBP statement that Canadians do not need ESTA** — esta.cbp.dhs.gov and
  help.cbp.gov are JS SPAs. The conclusion is nonetheless solid (Canada is not on the VWP list).
- **GAP: B1/B2 wait times by post for Toronto/Montreal/Vancouver** — travel.state.gov 403;
  ustraveldocs.com/ca and ais.usvisa-info.com JS-only.
- **GAP: the HR-1 "visa integrity fee" amount** — announced with no figure. Do not budget it.
- **GAP: Toronto Pearson's own preclearance page and GTAA recommended arrival time** — bot-walled.
- **GAP: verification that Ontario's Out-of-Country Travellers Program ended 1 Jan 2020** —
  ontario.ca contradicts it with live reimbursement rates; health.gov.on.ca has an **expired TLS
  certificate**. Either way the coverage is functionally nil (§10.3).
- **GAP: TD and American Express Canada travel-medical certificates** — all candidate URLs 404.
- **GAP: BLM national recreational drone policy** — none exists on blm.gov; the Utah Canyon Country
  fact sheet was used instead.
- **GAP: Valley of the Gods and Goosenecks State Park drone rules.**
- **GAP: whether a Canadian-bought DJI model is on the FAA Declaration of Compliance list.**

### The five phone calls that close most of this

1. **Ouray County Road & Bridge (970) 626-5391** — Yankee Boy / CR-26 season and condition
2. **Capitol Reef (435) 425-3791** — Cathedral Valley roads and the Fremont ford
3. **Grand Teton (307) 739-3399** — fuel and cell service in the park
4. **Monument Valley Navajo Tribal Park (435) 727-5870** — hours changeover, vehicle rules, drones
5. **Canyonlands (435) 719-2313** — Shafer Trail condition

Plus one browser session: a live LAS→SLC one-way quote at National, Hertz and Avis for the actual
2028 dates.
