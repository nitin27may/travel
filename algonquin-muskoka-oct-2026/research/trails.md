# RAW DATA: Trails & Hikes lane (Algonquin / Muskoka, Sat 10 - Mon 12 Oct 2026)

Compiled 2026-09-27 (research date). Raw data for synthesis, not a human report. Every claim has a source URL. `GAP:` = could not verify, with the source that failed. `INFERENCE:` = my derivation, not from a source.

Blocked sources (HTTP 403 on fetch): alltrails.com (all trail pages), trailforks.com, tripadvisor.* (review pages), timeanddate.com. AllTrails numbers below come from search-engine result snippets only, not from the page itself.

---
## 0. Cross-cutting facts (read first)

### 0.1 Fall colour status (matters for choosing Algonquin vs Lake of Bays)
- Ontario Parks Fall Colour report dated 25 Sep 2026: Algonquin = Yellow/Orange, colour change 80%, leaf fall 10%. Arrowhead = Orange, colour change 50%, leaf fall 10%. Peak timing "not specified". Source: https://www.ontarioparks.ca/fallcolour
- Discover Muskoka report dated 26 Sep 2026: Lake of Bays "Advancing to Peak, 10-20%, green predominates"; Huntsville 50%, 10% leaf fall; Algonquin 80%, 10% leaf fall. Predicted windows: early colours 20 Sep - 3 Oct; peak maple 4 - 8 Oct; "peak golden encore colours" 9 - 18 Oct. Source: https://www.discovermuskoka.ca/ontario-fall-colour-report/
- Secondary (search summary, 28 Sep): Muskoka tends to peak around Thanksgiving; Algonquin and Haliburton turn first, before Lake of Bays. Source: https://www.discovermuskoka.ca/ontario-fall-colour-report/ (via WebSearch summary; also https://www.canada-spirit.com/guides/ontario-fall-colors/ was returned but not fetched)
- INFERENCE: Algonquin Hwy 60 was already at 80% colour + 10% leaf fall on 25 Sep. By 10-12 Oct it is likely past the maple peak (leaf litter, more bare canopy, golden tamarack/beech/oak tones remain). Lake of Bays / Dwight / Limberlost (10-20% on 26 Sep) is likelier to be at or near peak on the weekend. Nothing published gives a 10-12 Oct-specific forecast.
- Ontario Parks blog: "Traditionally, the fall colours are on display from mid-September until mid-October". Source: https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/

### 0.2 Daylight
- Sunset Huntsville: 1 Oct 19:01, 2 Oct 18:59, 3 Oct 18:57, 4 Oct 18:55, 5 Oct 18:53 (EDT). Source: https://www.sunsetnmoonrise.com/sunrise-sunset-time/canada/ontario/huntsville
- INFERENCE: continuing ~2 min/day gives about 18:43 (10 Oct) to about 18:39 (12 Oct). GAP: exact 10-12 Oct values and sunrise not obtained (timeanddate.com 403, sunrisesunset.com returned a form only).

### 0.3 Drive times (origin = proxy for 1679 Port Cunnington Rd)
- Method: OSRM public demo router (free-flow, no traffic, no Thanksgiving congestion) https://router.project-osrm.org/ . Origin proxy = Port Cunnington Lodge 45.2611, -79.0248 (Photon geocode https://photon.komoot.io/api/?q=Port%20Cunnington%20Road%20Dwight ). Exact geocode of "1679 Port Cunnington Rd" FAILED (Photon and Nominatim returned empty). Lake of Bays Marina at 1170 Port Cunnington Rd = 45.294498, -79.029315 (https://www.yelp.ca/biz/lake-of-bays-marina-dwight via search). A 1837 Port Cunnington Rd = 45.2509, -79.0338 (https://www.walkscore.com/score/1837-PORT-CUNNINGTON-Road-Lake-of-Bays-ON-P0A-1H0/lat=45.250944/lng=-79.033785/). INFERENCE: 1679 lies between them, i.e. near the lodge proxy. Treat all times as +/- 5 min. GAP: the address may sit on a different part of the road than assumed; re-run once the exact pin is known.
- Whitby (43.8975, -78.9429) to origin proxy: 211.8 km, 197.9 min free-flow (OSRM). No holiday traffic modelled.
- Dwight/base to Limberlost Solitaire Beach / Clear Lake Creek lot (45.4006, -79.0011): 33.3 km, 40.7 min (OSRM). Earlier run to reserve centroid 45.3996,-79.0052: 33.1 km, 39 min.
- Base to Track and Tower trailhead (45.559924, -78.577561): 57.2 km, 56.9 min (OSRM).
- Other Hwy 60 trailheads (OSRM where noted, otherwise INFERENCE from km markers at roughly 1.0 - 1.4 min per km of highway, calibrated on the three OSRM points):
  - Hemlock Bluff parking (45.5645, -78.5518): 59.4 km, 58.9 min (OSRM).
  - Centennial Ridges board (45.5564, -78.4196): 72.6 km, 74.5 min (OSRM).
  - Lookout Trail km 39.7: INFERENCE about 76 - 78 min.
  - Two Rivers km 31.0: INFERENCE about 64 - 66 min.
  - Peck Lake km 19.2: INFERENCE about 50 - 52 min. Mizzy Lake km 15.4: about 44 - 48 min. Whiskey Rapids km 7.2: about 33 - 40 min. Spruce Bog km 42.5: about 78 - 82 min.
  - Booth's Rock parking (45.518138, -78.399629; Rock Lake road, 9 km south of km 40.3): 81.3 km, 89.8 min (OSRM). Effectively out of range.
- Ragged Falls (Oxtongue River-Ragged Falls PP, 45.4034, -78.9000): 24.6 km, 26.6 min (OSRM). Coordinates from https://photon.komoot.io/api/?q=Ragged%20Falls%20Oxtongue%20River%20Provincial%20Park
- Dorset Scenic Lookout Tower (45.2522, -78.8932): 22.7 km, 24.6 min (OSRM). Coordinates from Photon.
- Lions Lookout, Huntsville (45.3269, -79.2067): 34.5 km, 37.4 min (OSRM).
- Arrowhead PP (park point 45.3916, -79.2004; Stubb's Falls / Big Bend lots not separately geocoded): 42.3 km, 54.4 min (OSRM). Slightly over the 50 min brief.

### 0.4 Algonquin day-use vehicle permit (Hwy 60 corridor) - applies to Track and Tower and every Hwy 60 trail
- Price: $21.00 per vehicle per day, includes 13% HST. Valid 07:00 - 22:00 on date of issue. One vehicle, up to 14 occupants. Source: https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php
- Discounts (same page): Ontario seniors 65+ 20% off; Ontario residents with disabilities 50% off; Canadian Armed Forces/Veterans in Ontario free, weekdays only (Mon 12 Oct is a weekday but also a holiday: GAP whether the free-veteran rule applies on a statutory holiday).
- How to buy: online up to 5 days in advance, or phone 1-888-668-7275. "Permits are not available for purchase in-person." Source: same page. Reservation site per third party: reservations.ontarioparks.com, Day Use tab, "Algonquin - Hwy 60 Corridor" https://algonquinpark.com/algonquin-park-day-pass-your-access-to-world-famous-wilderness/
- INFERENCE (date arithmetic on the 5-day rule): Sat 10 Oct permits open about Mon 5 Oct; Sun 11 Oct about Tue 6 Oct; Mon 12 Oct about Wed 7 Oct. GAP: exact release time of day not found.
- Sell-out risk: "All daily vehicle permits are sold exclusively in advance... Once permits sell out for a given day, the park reaches capacity and no walk-up entry is permitted." Source: https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ . Third party: "Day Passes for the Highway 60 Corridor regularly sell out during the Thanksgiving long weekend." Source: https://algonquinpark.com/algonquin-park-day-pass-your-access-to-world-famous-wilderness/
- Ontario Parks advice: visit Mon-Thu if possible; on weekends "reserve your permit online and plan to arrive before 10:00 a.m."; consider East Gate entry from GTA to avoid West Gate congestion (about 5 min from Whitney). Source: https://blog.ontarioparks.ca/fall-colours-at-algonquin-provincial-park/ . Another source says arrive before 8 am at popular trailheads: https://algonquinpark.com/algonquin-park-day-pass-your-access-to-world-famous-wilderness/ (via WebSearch summary).
- Does it cover both trailheads? No. It covers Track and Tower (Hwy 60 corridor). Limberlost is a separate private property with no fee (see Section 1).
- Booth's Rock exception: 12 Sep - 18 Oct 2026 the small Booth's Rock lot needs a special DVP ("DVP - Booth's Rock Trail + Hwy 60"), same $21; if the lot is full you are turned away. Source: https://www.algonquinpark.on.ca/visit/general_park_info/fees-day-use.php and https://www.ontarioparks.ca/park/algonquin/alerts
- GAP: Algonquin-specific price is not shown on https://www.ontarioparks.ca/fees/dayuse/2026 (says "contact the park directly"; generic range $12.25-$21.00). The $21.00 figure comes from the Friends of Algonquin page, which lists no effective date.

### 0.5 Algonquin alerts as of 27 Sep 2026 (https://www.ontarioparks.ca/park/algonquin/alerts)
- Hardwood Lookout Trail (km 13.8 Hwy 60, 1 km loop, Smoke Lake view: https://www.algonquinpark.on.ca/visit/recreational_activites/hardwood-lookout-trail.php ) CLOSED on five weekends incl. Fridays and holiday Mondays: 11-13 Sep, 18-20 Sep, 25-27 Sep, 2-4 Oct, 9-12 Oct. So it is closed for our trip.
- Booth's Rock special permit 12 Sep - 18 Oct (above).
- Tea Lake Campground open for day use fall weekends only, 12 Sep - 12 Oct.
- Backcountry: Provoking Falls Bridge (Highland Backpacking Trail) closed, bridge removed, 2.5 km reroute; Highview Cabin closed for season; low-water notices. Not relevant to day hikes.
- New Fork Lake Trail, 2.4 km, rated difficult (location on Hwy 60 not confirmed).
- No alert listed for Track and Tower, Whiskey Rapids, Mizzy, Centennial Ridges, or any hunting notice (as summarised by the fetch tool; the page itself was not read line-by-line by me).

---
## 1. Solitaire Lake Trail, Limberlost Forest and Wildlife Reserve

### 1.1 Distance, gain, time, difficulty (sources disagree; report the range)
| Source | Distance | Gain | Time | Difficulty |
|---|---|---|---|---|
| Limberlost official Hiking Trails page | 6.3 km (3.9 mi) | not given | not given | Easy-Moderate | https://limberlostforest.com/activities/hiking-trails/ |
| AllTrails (snippet only, page 403) | 3.9 mi = 6.3 km | 931 ft = 284 m (SUSPECT, see note) | 2 - 2.5 h | Moderate | https://www.alltrails.com/trail/canada/ontario/solitaire-lake-loop |
| Gaia GPS (9 user tracks) | 3.7 mi = 5.95 km | 157 ft = 48 m | 2 h 06 min | listed Easy, text says "moderate" | https://www.gaiagps.com/hike/475146/solitaire-lake-trail-loop/ |
| Trailforks (snippet) | 3.6 mi = 5.8 km | n/a | n/a | n/a | https://www.trailforks.com/trails/solitaire-trail/ |
| Ontario Hiking | 6.3 km | n/a | about 2 h | Easy-Moderate | https://ontariohiking.com/limberlost-forest-trails/ |
| Find Your Muskoka | "6 1/2 km" | n/a | n/a | easy to moderate, mostly level with a few steep sections | https://findingyourmuskoka.ca/2022/04/12/hiking-the-limberlost-reserve/ |
| OLD official Solitaire trail brochure PDF (2015 upload) | 13 km (section table sums to 13.0) | "80% slight grade, 10% 20-degree, 10% steeper" | n/a | Easy to moderate | https://limberlostforest.com/wp-content/uploads/2015/03/solitaire_trail.pdf |

- Working range: 5.8 - 6.5 km (3.6 - 4.0 mi) round trip loop; gain either about 48 m (Gaia) or 284 m (AllTrails).
- NOTE on gain: AllTrails 931 ft looks inflated for a loop that is "relatively flat until the lookout rock" (AllTrails snippet text, same URL). The 2015 brochure says "Other than the climb up to the Echo Rock Lookout, the grades are relatively gradual." INFERENCE: real gain is probably in the 50 - 120 m range; unresolved.
- GAP / CONFLICT: the official brochure PDF states 13 km, more than 2x the 6.3 km on the current official site. Probable explanation (INFERENCE only): stale brochure or a section table that includes access spurs; the lake is small and Echo Rock to Solitaire Beach by brochure GPS is only about 1.1 km straight-line. Not resolved. This matters against the 12 km ceiling: if 13 km were true it would exceed it. Recommend asking the reserve (705-635-1584, info@limberlostforest.com) or checking the 2026 summer map PDF linked from https://limberlostforest.com/site-map/ (map PDF not opened).
- Official 2026 status of maps: Summer Trail Map 2026 (PDF, updated Spring 2026), Google Maps overlay "some newer features currently missing". Source: https://limberlostforest.com/site-map/

### 1.2 Trailhead and access
- Official mailing/visitor address: 1002 Buck Lake Landing, Huntsville ON P1H 2J6 (https://limberlostforest.com/ and https://limberlostforest.com/site-map/). Discover Muskoka lists 1088 Buck Lake Landing (https://www.discovermuskoka.ca/listings/limberlost-forest-wildlife-reserve-258/). The user-supplied "1212 S Limberlost Rd #1150" appears in NO source I fetched. GAP: not verified on the official site; the brochure does name "South Limberlost Road" and "Main Gates to Limberlost" (PDF above), so the road name is consistent but the civic number is unconfirmed.
- Wikipedia: main gate "3 km off of Muskoka Road 8 in Lake of Bays"; coordinates 45.3990 N, 79.0011 W; about 10,000 acres. Source: https://en.wikipedia.org/wiki/Limberlost_Forest_and_Wildlife_Reserve
- Trail start options per official brochure: "Start at either the sandy beach in front of the Solitaire Lodge, or alternatively from the parking area near the Clear Lake Creek north of the main entrance gate." GPS from brochure: Solitaire Beach N45 23.848 W79 00.066 (= 45.3975, -79.0011); Clear Lake Creek parking N45 24.038 W79 00.066 (= 45.4006, -79.0011); Echo Rock Lookout N45 23.665 W79 00.854 (= 45.3944, -79.0142). Also a "Water's Edge Parking Area" (POI #4) on the east side. Source: https://limberlostforest.com/wp-content/uploads/2015/03/solitaire_trail.pdf (pdftotext of the downloaded PDF). Ontario Hiking says "Parking: Main parking lot" (https://ontariohiking.com/limberlost-forest-trails/).
- Direction/loop: circles Lake Solitaire; Echo Rock at NW corner; Kalonga Creek bridge and Kalonga Wetland turn-off on the east side; eastern boardwalk and Hidden Cliffs on the east side. Source: the brochure PDF above.

### 1.3 Fees, waiver, hours, rules
- Free: "Hiking trails are free to use." https://limberlostforest.com/activities/hiking-trails/ ; "free parking" ; guest parking pass at the visitor kiosk (Discover Muskoka listing above).
- Mandatory online safety waiver: "All users must complete the safety waiver online"; non-compliance results in removal and ticketing. https://limberlostforest.com/activities/hiking-trails/ and https://limberlostforest.com/rules-regulations/ (waiver link in main navigation; I did not open the waiver form).
- Hours: Open daily 9:00 am - 5:00 pm; day-use hiking access restricted to these hours. https://limberlostforest.com/activities/hiking-trails/ . IMPLICATION: a 2 - 2.5 h loop must start by about 14:00 to be out by 17:00; sunrise-start not possible.
- Dogs: "All dogs must be on a leash, we are not leash free"; owners pack out waste. https://limberlostforest.com/rules-regulations/
- Vehicles: park only in designated areas, 20 km/h speed limit; "RVs, tear drop, pop up trailers, camper vans are NOT permitted." Sources: same two pages.
- Facilities: outhouses at main parking lot and Buck Lake landing; garbage at office, main lot and Buck Lake landing (hiking trails page). Ontario Hiking says no public washrooms or picnic areas (conflict; official page wins). Office is 300 m past the Information Booth.

### 1.4 Parking capacity / Thanksgiving fill
- Official: "ample" / designated areas (Discover Muskoka, hiking page). No stated stall count. GAP: no source gives capacity or fill time for Thanksgiving weekend; search for Thanksgiving-specific reports returned nothing. Reservation-style booking exists via Think Reservations for rentals only (https://limberlostforest.com/site-map/).
- INFERENCE: with no permit gate, it is a first-come lot on a peak-colour long weekend; arrive at 09:00 opening or use the Sun/Mon.

### 1.5 What you see
- Lake Solitaire (largest lake on the reserve), sandy beach at start, Little Echo Rock boardwalk with cliff views across lake, Echo Rock Lookout (steep climb, "incredible view to the south and east over Solitaire Lake"), large quartz outcrop, Hidden Cliffs boardwalk and rock overhang, Windy Cave, giant white pine (10 ft girth, 150+ years), old-growth hemlock, heron nesting ground, beaver dams, Teda's Rest picnic point on hemlock/pine. Brochure PDF explicitly ties Echo Rock view to "the change in the colours of the deciduous tree leaves in the fall." Sources: brochure PDF; https://findingyourmuskoka.ca/2022/04/12/hiking-the-limberlost-reserve/ ; https://ontariohiking.com/limberlost-forest-trails/
- Reviews say the trail is "widely known for... spectacular views, especially during the fall colours" (AllTrails snippet, https://www.alltrails.com/trail/canada/ontario/solitaire-lake-loop ). Rule zero check: the real long-range view is one lookout (Echo Rock, about 1.5 km from Clear Lake Creek per brochure table); the rest is lakeshore walking, boardwalks, hemlock forest, and passes some private cottages. Complaints: bugs, "sections along private properties" (AllTrails snippet).
- Related short add-ons: Buck Lake Lookout 0.7 km, Moderate-Difficult, "very good view at the top" (Oct 2020 report) https://limberlostforest.com/activities/hiking-trails/ and search summary; Echo Rock trail listed 1.6 km on Ontario Hiking, Echo Rock 5.5 km Moderate-Difficult on official page (different trail definitions, conflict).

### 1.6 Season-specific (mid-October)
- Mud/wet: "Water running down to Solitaire Lake all along the trail" (wet feet, Sep 2017); "can be a bit wet and muddy"; "sturdy footwear is a must". Sources: https://ontarioadventurer.ca/2017/09/17/limberlost-forest-wildlife-reserve/ ; https://findingyourmuskoka.ca/2022/04/12/hiking-the-limberlost-reserve/
- Downed trees/branches may be present on trails (official hiking page).
- Echo Rock climb is very steep (search summary of Limberlost reviews); leaf litter on rock = slippery (INFERENCE, no source).
- Hunting: NOT permitted. "Hunting and the use of ATVs for game retrieval is not allowed in the reserve." "Firearms of any kind are not allowed." https://limberlostforest.com/rules-regulations/ . No hunter-orange guidance appears there. GAP: hunting on land adjacent to the reserve (Crown/private) not verified; no source found.
- Alerts/closures: none found. Homepage fetch showed none; https://limberlostforest.com/ (no live alert feed read).

### 1.7 Offline maps
- Limberlost publishes free PDF trail maps (2026 summer map) - free offline use possible: https://limberlostforest.com/site-map/ .
- AllTrails offline maps need a paid tier (Plus or Peak). Sources: https://support.alltrails.com/hc/en-us/articles/37212750759956-Downloading-parks-for-offline-use ; snippet "Offline maps are available to AllTrails Plus and Peak members". Price seen: about US$36/yr (USD only; CAD price GAP). Gaia GPS Solitaire track also exists (paid features not researched).

---
## 2. Track and Tower Trail, Algonquin Provincial Park

### 2.1 Distance, gain, time, difficulty
| Source | Distance | Gain | Time | Difficulty |
|---|---|---|---|---|
| Friends of Algonquin, trail page | 7.5 km loop | n/a | "4 hours" (Hwy 60 trails index) | trail page says "Difficult" (fetch summary), index says "Moderate" (CONFLICT) https://www.algonquinpark.on.ca/visit/recreational_activites/track-and-tower-trail.php and https://www.ontarioparks.ca/park/algonquin/activities |
| Ontario Trails Council | 7.7 km loop | n/a | n/a | "Semi-developed" https://www.ontariotrails.on.ca/trail/track-and-tower-trail |
| AllTrails (snippet only) | 5.2 mi = 8.4 km | 885 ft = 270 m (another snippet: 243 m) | 2.5 - 3 h | Moderate https://www.alltrails.com/trail/canada/ontario/algonquin-track-and-tower-trail |
| 10Adventures | 7.9 km | 255 m | 2-3 h | n/a https://www.10adventures.com/hikes/algonquin-provincial-park/track-and-tower-trail/ |
| Road Trips and Suitcases | 8 km | "70 m" (stated) vs cumulative 273 m (internally inconsistent) | 2:15 - 2:45 | steep sections about 10% https://roadtripsandsuitcases.com/ontario-algonquin-track-and-tower-trail/ |
| 2 Nerds In A Truck | 7.5 km official, 8.6 km measured | n/a | 4 h suggested | "Difficult" https://2nerdsinatruck.com/track-and-tower-trail/ |
| Adventure Report | 7.5 km official, GPS 8.6 km | n/a | 2 h 45 | n/a https://www.adventurereport.ca/the-track-and-tower-trail-a-7-5-km-hike-in-algonquin-provincial-park/ |
| Your Matie Katie | 8 km | avg 280 m | 2 h 40 incl. lunch | n/a https://yourmatiekatie.com/2021/09/20/track-and-tower-trail-algonquin-park-on/ |

- Working range: 7.5 - 8.6 km (4.7 - 5.3 mi) loop; gain about 240 - 280 m (790 - 920 ft); 2.5 - 4 h. Within the 12 km ceiling. Elevation gain is the bigger effort than the distance suggests. First about 3 km almost flat, then steady climb, then a wooden staircase of about 130 (134 per 2 Nerds) steps, then a short side loop to the best viewpoint (https://www.10adventures.com/... via search summary; https://2nerdsinatruck.com/track-and-tower-trail/).

### 2.2 Trailhead and parking
- Trailhead: km 25.0 Hwy 60, coordinates 45.559924, -78.577561 (Friends of Algonquin page above). 10Adventures: right side of Hwy 60 heading east, about 15.7 miles (25 km) from the west gate.
- Amenities: parking and toilets (Friends page).
- Capacity: "LARGE parking lot... right on the side of the highway" (2 Nerds); "at least 50 vehicles" (Adventure Report photo, spring); "spacious" but "can fill up during busy weekend days, particularly in the fall or on long weekends" (Road Trips and Suitcases). GAP: no official stall count.
- The binding constraint is the DVP quota (section 0.4), not the lot. Arrive before 10:00 (Ontario Parks) or before 08:00 (third party).

### 2.3 Fees / permit
- Daily Vehicle Permit $21.00, sold online up to 5 days ahead only, per 0.4. Covers Track and Tower and all other Hwy 60 trailheads except Booth's Rock (special DVP). Does not cover Limberlost (free).

### 2.4 Dogs
- Allowed on leash, standard Ontario Parks rules (2 Nerds: https://2nerdsinatruck.com/track-and-tower-trail/). Friends trail page does not mention dogs; Ontario Trails Council does not either. Mizzy Lake is the trail that bans dogs (0.6 below).

### 2.5 Closures / alerts / state of the railway and tower
- Official Algonquin alerts page (27 Sep 2026) lists no Track and Tower closure. Source: https://www.ontarioparks.ca/park/algonquin/alerts . Ontario Trails Council: "Open year-round", "Closures: none reported" (undated). Friends of Algonquin says "Contact Algonquin Park Information for updates" (705-633-5572, info@algonquinpark.on.ca per https://www.ontariotrails.on.ca/trail/track-and-tower-trail ).
- Railway component: the loop follows the historic Ottawa, Arnprior and Parry Sound Railway (Grand Trunk, ran until 1959). What you actually see are RUINS: footings/anchor points of an old log trestle, log cribs in the gorge, and the foundation "to the end of what used to be a massive train bridge" (2 Nerds; Ontario Trails Council; https://algonquinpark.com/trails-track-and-tower-trail/ not fetched). There is a modern wooden bridge at about the 5.4 km mark (2 Nerds) and boardwalks, a dam at Cache Lake, and small waterfalls. It is NOT a walk across a trestle. The trail merges briefly with the "Old Railway Trail" (bike/ski track). An optional 5.5 km side trip along that abandoned railway to Mew Lake is not part of the loop (Friends page).
- Washouts: no source reports any washed-out or closed section of Track and Tower. Search "Track and Tower 2025 closed/washed out/reroute" returned nothing relevant. GAP: no dated 2026 trail-condition report found; AllTrails recent reviews (403) not readable.
- Tower: NO tower structure remains. The Skymount fire tower "stood here until the 1970s"; the trail reaches the "former fire tower location" with a short side loop to a rock-ledge lookout. Source: https://roadtripsandsuitcases.com/ontario-algonquin-track-and-tower-trail/ ; also 10Adventures and Adventure Report describe only the lookout, no tower. So the "tower" is a site, not an open structure.

### 2.6 What you actually see
- Cache Lake at the start (views from the start per Your Matie Katie), stream with rapids/small waterfalls with boardwalks, dam, old railway ruins, then the main payoff: a rocky ledge lookout "over a stunning landscape of lake and forest", over Cache Lake and surrounding forest; about the 4.1 km mark per Adventure Report. Multiple blogs say it is "exemplary especially in the fall season" (AllTrails/10Adventures snippets). Friends page carries a "fall danger" icon at the lookout (unfenced ledge).
- Rule-zero note: much of the 7.5+ km is forested walking with mud and streams; the vista is one main ledge plus lake glimpses. The lookout is "fully open to sun, wind, and sudden rain" (Road Trips and Suitcases).
- INFERENCE (colour): Hwy 60 at km 25 was already about 80% colour with 10% leaf fall on 25 Sep; expect strong golds/reds still visible on 10 Oct but maple peak likely past.

### 2.7 Mid-October conditions
- "Numerous muddy areas and mini streams", rocky, steep; "sturdy, grippy, and ideally waterproof" boots (2 Nerds). Stairs can be "icy" in freeze/thaw (spring report, Adventure Report); INFERENCE for mid-Oct: wet leaves on stairs/rock. Early morning frost possible (no source).
- Hunting: sport hunting is prohibited in Algonquin except the Clyde, Bruton and Eyre townships (McRae Addition) Recreation/Utilization zone, plus treaty harvest. Sources: https://www.algonquinpark.on.ca/visit/recreational_activites/hunting-and-trapping.php ; https://www.outdoorintel.ca/en/hunting/algonquin-park . GAP: I could not confirm where those townships sit relative to Hwy 60 km 25; no source ties them to the corridor. No hunting notice on the Algonquin alerts page. Hunting occurs in the WMUs around the park (bear over bait, grouse in Oct; moose opening 3rd Saturday of October = Sat 17 Oct 2026 per outdoorintel.ca, secondary source). Hunter orange is mandatory for hunters during firearms seasons; for hikers only a recommendation ("wear bright colours, stay on the marked trail", https://myhaliburtonhighlands.com/hiking-during-hunting-season/ ). GAP: no official Algonquin hunter-orange advice for Hwy 60 trails found. A search snippet from https://www.ontarioparks.ca/alerts (all Ontario Parks) mentioned hunter-orange notes for "Nokomis Trail" and "South Old Woman River Trail"; those appear to be other parks - INFERENCE, not verified.
- Sunset around 18:40 (0.2). Lookout loop time 4 h per Friends means start by about 13:00 at the latest.

### 2.8 Offline maps
- Same as 1.7: AllTrails offline = paid (Plus/Peak). Free option: Ontario Parks / Friends trail guide is sold in the park store (Friends page: "trail guide available for purchase"). Komoot exists (https://www.komoot.com/smarttour/e1805408895/track-and-tower-trail), free/paid offline terms not checked.

---
## 3. Additional candidates (within about 50 min of Dwight unless noted)

Hiking ceiling 12 km round trip. "Permit" = Algonquin DVP $21 unless noted.

| # | Trail | Dist km / mi | Gain | Time | Drive from base | Payoff | Parking / crowd | Oct status |
|---|---|---|---|---|---|---|---|---|
| A | Dorset Scenic Lookout Tower + trail (Algonquin Highlands) | trail 2.3 km total (Discover Muskoka); walk from Tower Hill about 20 min one-way | "steep sections" (n/a) | 1 - 1.5 h | 25 min (OSRM) | 30 m (100 ft) staircase tower, 360 deg over Lake of Bays, 142 m above lake; Peek-A-Boo Rock ground-level views | Vehicle charge; free alt parking at baseball diamond on Main St / Hwy 35 parkette; weekend rush likely (INFERENCE) | OPEN: Sat/Sun and Thanksgiving Mon (15 Sep - 13 Oct) 9:00 - 18:00; weekdays 10-18 to 12 Oct; last entry 1 h before close. Fees: $5.58 pp walk-up, $16.74 vehicle, season pass $27.91. Dogs leashed OK at park/trail, not on tower. Sources: https://www.algonquinhighlands.ca/explore-play/parks-and-outdoor-spaces/dorset-scenic-lookout-tower/ ; https://www.discovermuskoka.ca/listings/dorset-scenic-lookout-tower-trail-141/ ; https://www.dorsetcanada.com/attraction/dorset-scenic-lookout-tower/ . GAP: Discover Muskoka mentions a "construction" period with 50% discounted admission where park/trail "remain OPEN"; the Algonquin Highlands page shows no tower closure but I could not confirm the tower CLIMB is open. Call 705-766-1032 (dorsetcanada.com). |
| B | Hemlock Bluff Trail (Hwy 60 km 27.2) | 3.5 km loop / 2.2 mi (Friends); AllTrails 2.4 mi (3.9 km) | AllTrails 918 ft (280 m) SUSPECT; 265 m on another source | 1.5 - 2 h | 59 min (OSRM) | Bluff view over Jack Lake; hemlock stand; wetland pond; early-Oct reviewer "stunning" fall colours | Small pull-in lot, permit required; less busy than cliff trails ("rewarding alternative to the corridor's busiest cliff-top trails") | Open; no alert. Sources: https://www.algonquinpark.on.ca/visit/recreational_activites/hemlock-bluff-trail.php ; https://www.alltrails.com/trail/canada/ontario/hemlock-bluff-trail (snippet) |
| C | Two Rivers Trail (km 31.0) | 2.3 km loop / 1.4 mi | n/a ("easy ascent") | about 1 h (INFERENCE) | about 65 min (INFERENCE from km) | Pine-clad cliff, scenic lookout (fall danger icon) | permit; picnic ground nearby | Open; no alert. Source: https://www.algonquinpark.on.ca/visit/recreational_activites/two-rivers-trail.php . GAP: no independent fall-view review fetched. |
| D | Lookout Trail (km 39.7) | 2.1 km loop (Friends) / 1.9 km (10Adventures) | 71 - 78 m | 0.5 - 1 h | about 77 min (INFERENCE) | Best-value view on Hwy 60: "expansive vistas spanning several hundred square km", fall recommended. Views over Lake of Two Rivers area | Highest pressure: "arrive before 8 am"; "high crowd levels" | Open; no alert. Sources: https://www.algonquinpark.on.ca/visit/recreational_activites/lookout-trail.php ; https://www.10adventures.com/hikes/algonquin-provincial-park/lookout-trail/ ; https://wanderingwagars.com/fall-colours-in-algonquin-provincial-park/ |
| E | Centennial Ridges (km 37.6) | 10.4 km loop / 6.5 mi | 438 m (search), AllTrails 6.4 mi loop; via Raccoon Lake 7.1 mi, 1551 ft | 3.75 - 6 h | 75 min (OSRM) | Two ridges, about five cliff lookouts over Whitefish and Cloud lakes | Reviews say easier to park than Booth's Rock but still permit-limited | Open. "Very demanding" (Friends). Fits the 12 km ceiling but hard; poor for a mixed group. Sources: https://www.algonquinpark.on.ca/visit/recreational_activites/centennial-ridges-trail.php ; https://www.10adventures.com/hikes/algonquin-provincial-park/centennial-ridges-trail/ (search summary) |
| F | Oxtongue River-Ragged Falls PP | under 1 km out and back / 0.6 mi | about 30 m (105 ft) | 30 - 60 min | 27 min (OSRM) | 80 ft falls, river rapids, granite rock vantage points, several angles | Large lot; day-use season 8 May - 18 Oct 2026 (Ontario Parks) ; separate Ontario Parks day-use permit (price GAP, Algonquin-corridor DVP is $21, Ontario range $12.25 - 21.00) | Open on our dates. Sources: https://www.ontarioparks.ca/park/oxtongueriverraggedfalls ; https://ontariohiking.com/oxtongue-river-ragged-falls-provincial-park/ ; https://www.discovermuskoka.ca/listings/ragged-falls-oxtongue-river-hiking-trail-359/ . GAP: whether the Algonquin DVP is valid here (it is a separate park) not confirmed. |
| G | Arrowhead PP: Stubb's Falls + Big Bend Lookout | Stubb's 2.6 km loop, Big Bend a short walk | n/a | Stubb's about 45 min | 54 min (OSRM, park point) | Falls on Little East River, stairs, hardwood forest; Big Bend view of Big East River glacial delta ("breathtaking in the fall") | Reservation required ("Arrowhead offers advance day use permits"), register plate online up to 5 days ahead; Ontario Parks blog urges midweek | Open all year for day use 2026; Arrowhead colour 50% on 25 Sep. Page shows "4 alerts" with no detail retrieved (GAP). Sources: https://www.ontarioparks.ca/park/arrowhead ; https://blog.ontarioparks.ca/visit-arrowhead-fall/ ; https://www.ontarioparks.ca/park/arrowhead/activities |
| H | Lions Lookout, Huntsville | 1.3 km / 0.8 mi | steep sections | 30 - 45 min (INFERENCE) | 37 min (OSRM) | Muskoka River and Fairy Lake, Huntsville panorama; "a favourite spot to take in the fall colours" | Two small lots above/below lookout; steep drive up | Open (road closed only in winter). Fees not stated (GAP). Source: https://www.discovermuskoka.ca/listings/lions-lookout-trail-259/ |
| I | Limberlost Buck Lake Lookout (0.7 km) or Echo Rock | 0.7 km / 0.4 mi | steep | 20 - 40 min | 41 min | Lookout over Buck Lake; Echo Rock over Solitaire | Free, same lot as Solitaire, hours 9-5, waiver | Open. Source: https://limberlostforest.com/activities/hiking-trails/ |

### 3.1 Verified other Hwy 60 trails (mostly view-poor or out of range)
- Peck Lake (km 19.2): 2.3 km / 1.4 mi, moderate, rocky lakeshore loop with stairs and boardwalk, lake glimpses; 20 min - 1 h; about 51 min drive (INFERENCE). Source: https://allofalgonquin.com/go-take-a-hike/peck-lake-trail/ . Low-vista lakeshore walk.
- Mizzy Lake (km 15.4): 10.8 km loop, needs a full day (about 6 h), ponds/wildlife, muddy, NO DOGS. https://www.algonquinpark.on.ca/visit/recreational_activites/mizzy-lake-trail.php . Forested-no-view trap for a colour trip.
- Spruce Bog Boardwalk (km 42.5): 1.5 - 1.6 km, easy, bog with colour from tamarack (goes gold later) https://www.ontarioparks.ca/park/algonquin/activities ; far (about 80 min, INFERENCE).
- Whiskey Rapids (km 7.2): 2.1 km loop, moderate, Oxtongue River rapids, steep uphill return, floods after heavy rain. https://www.algonquinpark.on.ca/visit/recreational_activites/whiskey-rapids-trail.php . River scene, no vista.
- Booth's Rock (Rock Lake road): 5.1 km loop, difficult, lake overlook, Barclay estate ruins; special DVP required 12 Sep - 18 Oct and turned away if lot full; 90 min drive. https://www.algonquinpark.on.ca/visit/recreational_activites/booths-rock-trail.php . Exclude.
- Hardwood Lookout (km 13.8): closed Fri-Mon 9-12 Oct. Exclude.
- Mew Lake, Beaver Pond: not researched in this pass (GAP).
- "Hunts Falls" near Huntsville: no such Ontario trail found in searches ("Hunts Falls" returned only Huntsville Alabama and Muskoka River/High Falls trails). GAP. https://www.discovermuskoka.ca/discover-muskokas-wilderness-with-these-popular-hiking-spots-in-muskoka/ appeared but was not fetched.

---
## 4. Ranking for a mid-October fall-colour trip (my ranking from the data above)

Weighting: verified view payoff, colour likelihood on 10-12 Oct, effort vs. ceiling, permit/parking risk, drive time.

1. Solitaire Lake Trail (pre-chosen) - lake + Echo Rock lookout, Lake of Bays region likelier at peak on the weekend, free, 41 min, no permit. Risks: 9-5 hours, wet/muddy, 13 km brochure conflict (resolve before going), lot capacity unknown.
2. Dorset Scenic Lookout Tower - 25 min, open Thanksgiving weekend 9-18, verified staircase tower with 360 degree view, guaranteed elevated view above Lake of Bays colour. Confirm the tower climb is open (GAP on "construction").
3. Track and Tower (pre-chosen) - one solid ledge lookout after a demanding, muddy 7.5-8.6 km; needs a $21 DVP booked at the window opening; Algonquin colour may be past peak.
4. Lookout Trail (km 39.7) - best short view per effort in Algonquin, but 77 min drive, earliest lot fill, permit sell-out risk. If Algonquin is used, consider swapping Track and Tower for Lookout plus Hemlock Bluff in one permit day. Full-day trip: 2.5 h of driving each way from the base including traffic (INFERENCE).
5. Lions Lookout, Huntsville - 37 min, 1.3 km, verified fall-colour view, small lots.
6. Hemlock Bluff - 59 min, 3.5 km, Jack Lake bluff, less crowded; pair with Two Rivers.
7. Ragged Falls - 27 min, under 1 km, falls not colour-dependent (good for rain/fatigue); short.
8. Arrowhead Stubb's Falls + Big Bend - 54 min, reservation required; over the 50 min brief.
9. Centennial Ridges - big views but 10.4 km and 438 m gain; only for a strong group; 75 min.

Traps (rule zero: forested, no vista, or unavailable):
- Mizzy Lake (ponds, 10.8 km, no dogs), Peck Lake (lakeshore glimpses), Whiskey Rapids (river only), Spruce Bog (bog boardwalk, colour is tamarack later), Two Rivers (lookout is a cliff, thinly documented).
- Track and Tower itself: the "tower" no longer exists; the railway is ruins; most of the loop is forest.
- Solitaire: one lookout (Echo Rock) then lakeshore/forest; conflicting length data.
- Unavailable: Hardwood Lookout (closed 9-12 Oct), Booth's Rock (special permit, 90 min).

---
## 5. Open items to close before the plan is final (all GAPs)
1. Confirm Solitaire loop length (6.3 vs 13 km) and start point with Limberlost office 705-635-1584, info@limberlostforest.com.
2. Confirm 1212 S Limberlost Rd #1150 is a valid Limberlost/Solitaire lot address.
3. Dorset tower: confirm climb is open on 10-12 Oct (705-766-1032 per dorsetcanada.com).
4. Algonquin DVP: book on release day (about 5 Oct for Sat); note Ontario Parks says sell-out means no walk-up.
5. Re-check Algonquin alerts page 8-9 Oct for Track and Tower closures and any hunting notices (https://www.ontarioparks.ca/park/algonquin/alerts ).
6. Exact 10-12 Oct sunset and sunrise (timeanddate.com blocked).
7. Exact origin geocode for 1679 Port Cunnington Rd to refine drive times; add Thanksgiving traffic (Whitby to base 198 min free-flow only).
8. Ragged Falls day-use price and whether the Algonquin DVP is honoured there.
9. AllTrails page content (403) - recent trail reviews and exact AllTrails distance/gain for Solitaire, Track and Tower, Lookout: read in app or browser.

## GAP CLOSED 2026-09-27 - Solitaire length (6.3 km vs 13 km)
The current official trails page (https://limberlostforest.com/activities/hiking-trails/) lists **Solitaire Trail 6.3 km, "Easy to moderate"**; also Echo Rock Trail 5.5 km (moderate to difficult), Buck Lake Lookout Trail 0.7 km, Clear Lake Trail 1.5 km. Same page: open 9am-5pm, online safety waiver mandatory, 20 km/h in the lot, no hunting/fall notice on the page. This CONTRADICTS the 13 km in the 2015 brochure PDF quoted above; the brochure is stale, so use 6.3 km (AllTrails 6.3, Gaia 5.95, Trailforks 5.8 agree). Item 1 in the follow-up list is closed. The 284 m AllTrails gain remains implausible against Gaia's 48 m; treat gain as GAP (small, roughly 50 m, plus the Echo Rock climb).
The address 1212 S Limberlost Rd #1150 still matches no source; navigate to "Limberlost Forest and Wildlife Reserve" / Clear Lake Creek lot (45.4006, -79.0011) instead.
