# MASTER TABLE — every location, one row each
Generated from `pins-final.json`. 51 destinations: everything currently scheduled **plus**
everything researched and held in reserve. Regenerate with `python3 build_master_table.py`.

**Trail column:** `No` = you never leave the car park, pure sightseeing. `Yes` = you walk to the
view. `Stroll` = pavement/village. `Walk-through` = the bridge itself. `Lift`/`Drive` = mechanical.
**km** is round trip. **Ascent** in metres.

**Score:** 10 = unmissable and cheap · 9 = unmissable but costs effort · 8 = strong ·
7 = worth the stop, first to cut · 6 = only because it's on the road · 5 = filler.

| # | Location | Day | Type | Trail | km RT | Ascent | Time | Score | Map | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Base — 1592 Center Rd, Hyde Park | Base | Logistics | - | - | - | - | - | [pin](https://maps.google.com/?q=44.601828,-72.5745682) | Hotel |
| 2 | Hannaford, Morrisville | Thu 1 | Logistics | No | - | - | 30 m | - | [pin](https://maps.google.com/?q=44.5727869,-72.5967606) | Thu picnic shop |
| 3 | Moss Glen Falls (Stowe) | Thu 1 | Waterfall | Yes | 0.8 | 17 | 60 m | 8 | [pin](https://maps.google.com/?q=44.4823794,-72.6245046) | Rim spur steep/eroded |
| 4 | Barnes Camp boardwalk | Fri 2 | Boardwalk | Yes | 1.1 | flat | 20 m | 6 | [pin](https://maps.google.com/?q=44.5378709,-72.7884842) | Wetland + beaver dam |
| 5 | Bingham Falls | Fri 2 | Waterfall | Yes | 0.8 | 46 down | 45 m | 8 | [pin](https://maps.google.com/?q=44.5167269,-72.7660351) | STEEP WET STAIRS - grip matters |
| 6 | Emily's Bridge (Gold Brook) | Fri 2 | Covered bridge | No | - | - | 15 m | 6 | [pin](https://maps.google.com/?q=44.4404009,-72.6798624) | 1844; the flex item |
| 7 | Pinnacle Meadows overflow lot | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.43779,-72.64712) | OVERFLOW, Stowe Land Trust, Pinnacle Rd. 1.6 km EAST of the trailhead by road · Stowe Land Trust. User-supplied pin |
| 8 | Smugglers' Notch | Fri 2 | Scenic drive | No | - | - | 60 m | **10** | [pin](https://maps.google.com/?q=44.5553,-72.79587) | Top of pass. No vehicles over 40 ft · corrected: OSM saddle, 675 m. Nominatim returned the RESORT in Jeffersonville, 3.5 km away on the wrong side |
| 9 | Stowe Community Church | Fri 2 | Village | Stroll | 1.5 | flat | 45 m | 8 | [pin](https://maps.google.com/?q=44.4656466,-72.6846447) | Village + viewpoint |
| 10 | Stowe Gondola SkyRide | Fri 2 | Lift | No | - | - | 90 m | 7 | [pin](https://maps.google.com/?q=44.52903,-72.78428) | 10:00-16:30, $40-43, book online · Mansfield Base Lodge |
| 11 | Stowe Pinnacle trailhead | Fri 2 | Hike | Yes | 5.5 | 457 | 3 h | **9** | [pin](https://maps.google.com/?q=44.43882,-72.66764) | MAIN LOT - holds ~9 cars, fills before 09:00 on weekdays · corrected from user-supplied Google pin - Nominatim was ~970 m off, on the trail line not the lot |
| 12 | Sunset Rock, Stowe | Fri 2 | Viewpoint | Yes | 0.8 | 40 | 45 m | 8 | [pin](https://maps.google.com/?q=44.4650363,-72.6786046) | 10 min walk from Sunset St |
| 13 | von Trapp Bierhall | Fri 2 | Food | No | - | - | 90 m | 7 | [pin](https://maps.google.com/?q=44.4654369,-72.7451481) | 11:30-21:00, Resy. Thin on veg |
| 14 | Barr Hill Natural Area | Sat 3 | Viewpoint | Yes | 1.1 | 27 | 50 m | **9** | [pin](https://maps.google.com/?q=44.6080645,-72.289919) | VIEW IS AT THE TRAILHEAD FIELD |
| 15 | Craftsbury Common | Sat 3 | Village | Stroll | 1.0 | flat | 45 m | 8 | [pin](https://maps.google.com/?q=44.6535578,-72.3827342) | White-fenced hilltop green |
| 16 | Fisher Covered Railroad Bridge | Sat 3 | Covered bridge | No | - | - | 15 m | 7 | [pin](https://maps.google.com/?q=44.5323138,-72.4277306) | Last covered RR bridge used in the US |
| 17 | Lake Willoughby North Beach | Sat 3 | Viewpoint | No | - | - | 15 m | 7 | [pin](https://maps.google.com/?q=44.7711201,-72.0548723) | Quick look from the north end |
| 18 | Lake Willoughby South Beach | Sat 3 | Viewpoint | No | 0.3 | flat | 60 m | **10** | [pin](https://maps.google.com/?q=44.748209,-72.0597399) | Picnic. Cold in October |
| 19 | Mount Pisgah South trailhead | Sat 3 | Hike | Yes | 3.5 | 274 | 2 h | **9** | [pin](https://maps.google.com/?q=44.7297412,-72.0306816) | TRIMMED to Pulpit Rock |
| 20 | Pulpit Rock (Pisgah) | Sat 3 | Viewpoint | Yes | 3.5 | 274 | - | **9** | [pin](https://maps.google.com/?q=44.7207664,-72.0272121) | Ledge 650 ft above the lake |
| 21 | Craftsbury General Store | Sat opt | Food | No | - | - | 30 m | 7 | [pin](https://maps.google.com/?q=44.6345579,-72.3718867) | OPTIONAL. Sat 7:00-21:00. Only staffed food in the Kingdom - skip it and there is nothing until Morrisville |
| 22 | Prospect Rock, Johnson | Sat opt | Hike | Yes | 4.2 | 140 | 70 m | 7 | [pin](https://maps.google.com/?q=44.6552188,-72.7221615) | Suspension bridge over the Lamoille |
| 23 | Ten Bends Beer, Hyde Park | Sat opt | Food | No | - | - | 60 m | 5 | [pin](https://maps.google.com/?q=44.5885536,-72.6057439) | At the doorstep |
| 24 | Cambridge Junction / Poland Bridge | Sun 4 | Covered bridge | Walk-through | 0.3 | flat | 20 m | 7 | [pin](https://maps.google.com/?q=44.6510988,-72.8146024) | 1887, 2nd-largest single span in VT |
| 25 | Comstock Covered Bridge | Sun 4 | Covered bridge | No | - | - | 10 m | 7 | [pin](https://maps.google.com/?q=44.8996622,-72.6446362) | 1883. Off VT-118 N |
| 26 | Fuller Covered Bridge | Sun 4 | Covered bridge | No | - | - | 10 m | 7 | [pin](https://maps.google.com/?q=44.9032472,-72.6397131) | 1890. South Richford Rd |
| 27 | Gates Farm Covered Bridge | Sun 4 | Covered bridge | No | - | - | 10 m | 5 | [pin](https://maps.google.com/?q=44.6457214,-72.8722716) | 1897, last Burr arch of the era |
| 28 | Hutchins Covered Bridge | Sun 4 | Covered bridge | No | - | - | 15 m | 6 | [pin](https://maps.google.com/?q=44.8585853,-72.6125419) | 1883. DIRT after 50 yards |
| 29 | Longley Covered Bridge | Sun 4 | Covered bridge | No | - | - | 10 m | 7 | [pin](https://maps.google.com/?q=44.9072383,-72.6556465) | 1863. VT-118 + Longley Bridge Rd |
| 30 | Missisquoi NWR visitor centre | Sun opt | Nature | Yes | 2.0 | flat | 20 m | 5 | [pin](https://maps.google.com/?q=44.9630979,-73.168301) | 6,729 acres, peak migration |
| 31 | Appalachian Gap overlook | Backup | Viewpoint | No | 0.02 | - | 45 m | **9** | [pin](https://maps.google.com/?q=44.2110741,-72.9312953) | DRIVE-UP. 20 m from the car |
| 32 | Lincoln Gap (top of pass) | Backup | Scenic drive | No | - | - | 20 m | 6 | [pin](https://maps.google.com/?q=44.0950338,-72.9290382) | WOODED - no view from the car |
| 33 | Sunset Ledge trailhead | Backup | Hike | Yes | 3.5 | 119 | 75 m | 8 | [pin](https://maps.google.com/?q=44.0879167,-72.9275429) | LT SOUTH. West to Champlain/Adirondacks |
| 34 | Warren Falls | Backup | Waterfall | Yes | 0.3 | 20 | 45 m | 7 | [pin](https://maps.google.com/?q=44.0955039,-72.8643766) | Carved-granite gorge |
| 35 | Warren Store / Warren village | Backup | Village | Stroll | 0.8 | flat | - | 7 | [pin](https://maps.google.com/?q=44.1145085,-72.8560776) | Village + covered bridge |
| 36 | Mad River Glen | Backup opt | Lift | No | - | - | 60 m | 7 | [pin](https://maps.google.com/?q=44.1975661,-72.9238018) | $20. LAST CHAIR LOADS 14:30 |
| 37 | Cold Hollow Cider Mill | Backup only | Food | No | - | - | 60 m | 6 | [pin](https://maps.google.com/?q=44.3813667,-72.7197344) | BACKUP DAY ONLY - dropped from Sunday |
| 38 | Barnet | RESERVE | Village | No | - | - | 2 h | 8 | [pin](https://maps.google.com/?q=44.2966923,-72.0495301) | RESERVE. NEK festival Sat Oct 3 |
| 39 | Grand Isle (Champlain Islands) | RESERVE | Scenic drive | No | - | - | 2 h | 8 | [pin](https://maps.google.com/?q=44.722515,-73.2931129) | RESERVE. Sunday alternative route |
| 40 | Jay Peak tram | RESERVE | Lift | No | - | - | 2 h | 8 | [pin](https://maps.google.com/?q=44.9360212,-72.5079214) | RESERVE. $15, weekends to Oct 11 |
| 41 | Laraway Lookout trailhead | RESERVE | Hike | Yes | 5.8 | 424 | 3 h | 6 | [pin](https://maps.google.com/?q=44.7337105,-72.7372733) | RESERVE |
| 42 | Molly Stark Mountain | RESERVE | Hike | Yes | 4.0 | 314 | 2 h | 6 | [pin](https://maps.google.com/?q=44.2220019,-72.9270626) | RESERVE. Molly Stark's Balcony |
| 43 | Mount Abraham | RESERVE | Hike | Yes | 8.4 | 762 | 4 h | **10** | [pin](https://maps.google.com/?q=44.1203955,-72.9361931) | RESERVE. Above treeline, 4,006 ft |
| 44 | Mount Elmore / Elmore State Park | RESERVE | Hike | Yes | 6.0-6.8 | 448 | 3 h | **9** | [pin](https://maps.google.com/?q=44.5313055,-72.5488003) | RESERVE. GATE OPENS 10:00 |
| 45 | Peacham village | RESERVE | Village | No | - | - | 2 h | 8 | [pin](https://maps.google.com/?q=44.3284703,-72.1703611) | RESERVE. NEK festival Fri Oct 2 |
| 46 | Raja Indian & Nepali, Stowe | Thu-Sat | Food | No | - | - | 75 m | - | [pin](https://maps.google.com/?q=44.4656857,-72.6843216) | Closed Wed AND Sun |
| 47 | Le Tandoor, Brossard QC | Thu+Sun | Food | No | - | - | 60 m | - | [pin](https://maps.google.com/?q=45.4732652,-73.4747521) | Only good veg meal on the drive |
| 48 | Boyden Valley Winery | ? | ? | No | - | - | 30 m | 5 | [pin](https://maps.google.com/?q=44.64887,-72.88916) | VERIFY SUNDAY HOURS · 64 VT Route 104 |
| 49 | Creamery Covered Bridge, Montgomery | ? | ? | No | - | - | 15 m | 6 | [pin](https://maps.google.com/?q=44.86724,-72.65252) | 1883. WEST HILL RD not Hill West Rd · Creamery Bridge Rd, West Hill |
| 50 | Great Eddy Covered Bridge, Waitsfield | ? | ? | No | - | - | 45 m | 7 | [pin](https://maps.google.com/?q=44.18937,-72.8235) | 1833, oldest still in service · Bridge Street |
| 51 | Highgate Springs border crossing | ? | ? | No | - | - | 15-30 m | - | [pin](https://maps.google.com/?q=44.97932,-73.1053) | 24 h port · APPROX - this is the village; the I-89 port of entry is ~3 km north at the 45th parallel |
| 52 | Mount Mansfield Auto Toll Road | ? | ? | No | - | - | 90 m | 7 | [pin](https://maps.google.com/?q=44.5375,-72.7908) | $37/veh + $14/pax, 9:30-16:30 · APPROX - entrance off Mountain Rd/VT-108 |
| 53 | P — Moss Glen Falls lot | Thu 1 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.485243,-72.627263) | Parking for Moss Glen Falls (Stowe). Small gravel lot, 380 m from the falls |
| 54 | P — Bingham Falls Parking | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.518223,-72.769776) | Parking for Bingham Falls. Named lot on VT-108, 340 m from the gorge. ~15 cars |
| 55 | P — Notch top parking | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.556784,-72.79404) | Parking for Smugglers' Notch. 219 m from the saddle, free. Smallest lot of the week |
| 56 | P — Barnes Camp lot | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.539655,-72.791161) | Parking for Barnes Camp boardwalk. 290 m from the visitor centre |
| 57 | P — Sunset St lot | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.463912,-72.67677) | Parking for Sunset Rock, Stowe. CAPACITY 10, free, unpaved. Or park behind the Community Church |
| 58 | P — Church lot | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.465681,-72.684581) | Parking for Stowe Community Church. Free, public, 6 m. The village anchor lot |
| 59 | P — Mansfield base lot | Fri 2 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.530203,-72.785668) | Parking for Stowe Gondola SkyRide. 170 m. NB Lower Barnes Lot nearby is access=private |
| 60 | P — North Beach lot | Sat 3 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.771335,-72.054463) | Parking for Lake Willoughby North Beach. 40 m from the beach |
| 61 | P — Common parking | Sat 3 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.65427,-72.38275) | Parking for Craftsbury Common. 79 m from the green |
| 62 | P — Barr Hill trailhead lot | Sat 3 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.60877,-72.287795) | Parking for Barr Hill Natural Area. 185 m. The view is from the field right here |
| 63 | P — Fisher Bridge pull-off | Sat 3 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.532889,-72.427605) | Parking for Fisher Covered Railroad Bridge. 64 m, free |
| 64 | P — Poland Bridge lot | Sun 4 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.650638,-72.814207) | Parking for Cambridge Junction / Poland Bridge. 60 m |
| 65 | P — Nearest lot | Sun 4 | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.644491,-72.87635) | Parking for Gates Farm Covered Bridge. 350 m — otherwise roadside on VT-15 |
| 66 | P — Sunset Ledge Trail Head Parking | Backup | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.094732,-72.927931) | Parking for Sunset Ledge trailhead. NAMED lot. LT South starts here |
| 67 | P — Lincoln Gap Long Trail Trailhead Parking | Backup | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.094898,-72.928308) | Parking for Lincoln Gap (top of pass). NAMED. The two gap lots are 94 m apart |
| 68 | P — App Gap overlook lot | Backup | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.211202,-72.931333) | Parking for Appalachian Gap overlook. 14 m, asphalt, public. The drive-up view |
| 69 | P — Warren Falls pull-off | Backup | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.093967,-72.863858) | Parking for Warren Falls. 175 m |
| 70 | P — Village lot | ? | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.189597,-72.824248) | Parking for Great Eddy Covered Bridge, Waitsfield. 64 m, free, public |
| 71 | P — Macs Bend Parking | Sun opt | Parking | No | - | - | - | - | [pin](https://maps.google.com/?q=44.964558,-73.166283) | Parking for Missisquoi NWR visitor centre. 227 m |

## Totals

| | Count |
|---|---|
| Destinations in the plan | **63** |
| Held in reserve (researched, not scheduled) | **8** |
| **Stops needing a trail** | **12** |
| **Stops with no walking at all** | **46** |

### The trail stops, shortest first

| Stop | Day | km RT | Ascent | Time | Score |
|---|---|---|---|---|---|
| Warren Falls | Backup | **0.3** | 20 m | 45 m | 7 |
| Moss Glen Falls (Stowe) | Thu 1 | **0.8** | 17 m | 60 m | 8 |
| Bingham Falls | Fri 2 | **0.8** | 46 down m | 45 m | 8 |
| Sunset Rock, Stowe | Fri 2 | **0.8** | 40 m | 45 m | 8 |
| Barnes Camp boardwalk | Fri 2 | **1.1** | flat m | 20 m | 6 |
| Barr Hill Natural Area | Sat 3 | **1.1** | 27 m | 50 m | 9 |
| Missisquoi NWR visitor centre | Sun opt | **2.0** | flat m | 20 m | 5 |
| Mount Pisgah South trailhead | Sat 3 | **3.5** | 274 m | 2 h | 9 |
| Pulpit Rock (Pisgah) | Sat 3 | **3.5** | 274 m | - | 9 |
| Sunset Ledge trailhead | Backup | **3.5** | 119 m | 75 m | 8 |
| Prospect Rock, Johnson | Sat opt | **4.2** | 140 m | 70 m | 7 |
| Stowe Pinnacle trailhead | Fri 2 | **5.5** | 457 m | 3 h | 9 |

### The no-walking stops — sorted by score

| Stop | Day | Score | Why |
|---|---|---|---|
| Smugglers' Notch | Fri 2 | 10 | Top of pass. No vehicles over 40 ft | corrected: OSM saddle, 675 m. Nominatim returned the RESORT in Jeffersonville, 3.5 km away on the wrong side |
| Lake Willoughby South Beach | Sat 3 | 10 | Picnic. Cold in October |
| Appalachian Gap overlook | Backup | 9 | DRIVE-UP. 20 m from the car |
| Stowe Gondola SkyRide | Fri 2 | 7 | 10:00-16:30, $40-43, book online | Mansfield Base Lodge |
| von Trapp Bierhall | Fri 2 | 7 | 11:30-21:00, Resy. Thin on veg |
| Fisher Covered Railroad Bridge | Sat 3 | 7 | Last covered RR bridge used in the US |
| Lake Willoughby North Beach | Sat 3 | 7 | Quick look from the north end |
| Craftsbury General Store | Sat opt | 7 | OPTIONAL. Sat 7:00-21:00. Only staffed food in the Kingdom - skip it and there is nothing until Morrisville |
| Comstock Covered Bridge | Sun 4 | 7 | 1883. Off VT-118 N |
| Fuller Covered Bridge | Sun 4 | 7 | 1890. South Richford Rd |
| Longley Covered Bridge | Sun 4 | 7 | 1863. VT-118 + Longley Bridge Rd |
| Mad River Glen | Backup opt | 7 | $20. LAST CHAIR LOADS 14:30 |
| Great Eddy Covered Bridge, Waitsfield | ? | 7 | 1833, oldest still in service | Bridge Street |
| Mount Mansfield Auto Toll Road | ? | 7 | $37/veh + $14/pax, 9:30-16:30 | APPROX - entrance off Mountain Rd/VT-108 |
| Emily's Bridge (Gold Brook) | Fri 2 | 6 | 1844; the flex item |
| Hutchins Covered Bridge | Sun 4 | 6 | 1883. DIRT after 50 yards |
| Lincoln Gap (top of pass) | Backup | 6 | WOODED - no view from the car |
| Cold Hollow Cider Mill | Backup only | 6 | BACKUP DAY ONLY - dropped from Sunday |
| Creamery Covered Bridge, Montgomery | ? | 6 | 1883. WEST HILL RD not Hill West Rd | Creamery Bridge Rd, West Hill |
| Ten Bends Beer, Hyde Park | Sat opt | 5 | At the doorstep |
| Gates Farm Covered Bridge | Sun 4 | 5 | 1897, last Burr arch of the era |
| Boyden Valley Winery | ? | 5 | VERIFY SUNDAY HOURS | 64 VT Route 104 |
