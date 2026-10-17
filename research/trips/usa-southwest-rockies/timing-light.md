# Research lane 6 — Seasonal timing and light

RAW DATA for synthesis. Every claim carries a source URL inline. Unverified items are marked
`GAP:`. Nothing here is estimated unless labelled "computed" (astronomy) or "derived"
(arithmetic on cited NOAA normals).

**Windows under test**
- **Window A** — 20 Sep – 14 Oct **2027** (forced late by Iceland 4–15 Sep 2027)
- **Window B** — 10 Sep – 4 Oct **2028**

**Method note on astronomy.** All sun and moon numbers below were *computed*, not looked up,
using PyEphem 4.2.1 (https://rhodesmill.org/pyephem/) against the actual 2027/2028 dates,
with the real latitude/longitude/elevation of each viewpoint. They are not generic
golden-hour advice and not copied from a website. Scripts used: `/tmp/sun.py`, `/tmp/moon.py`,
`/tmp/geo.py` (regenerate from the tables below if needed).

**Method note on climate.** All temperature, precipitation and snow-probability figures are
**NOAA 1991–2020 Daily Climate Normals**, pulled per-station per-calendar-date from the NCEI
data service — https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-daily-1991-2020
(station IDs given inline; station metadata from
https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt). This means the numbers are
specific to the exact calendar dates each window falls on, not monthly averages.

---

## 0. Trip-day calendar (computed)

Day numbering follows the Shape-A itinerary in `BRAINSTORM.md`.

| Trip day | Content | **Window A (2027)** | **Window B (2028)** |
|---|---|---|---|
| 1 | YYZ→LAS, drive to Springdale | Mon 20 Sep | Sun 10 Sep |
| 2 | Zion — Angels Landing | Tue 21 Sep | Mon 11 Sep |
| 3 | Zion — Narrows | Wed 22 Sep | Tue 12 Sep |
| 4 | Kanarra Falls → Bryce | Thu 23 Sep | Wed 13 Sep |
| 5 | Bryce sunrise → Page, Horseshoe Bend sunset | Fri 24 Sep | Thu 14 Sep |
| 6 | **Antelope Canyon** | Sat 25 Sep | Fri 15 Sep |
| 7 | → Monument Valley, sunset at The View | Sun 26 Sep | Sat 16 Sep |
| 8 | MV sunrise → Moki Dugway → Natural Bridges → Factory Butte sunset | Mon 27 Sep | Sun 17 Sep |
| 9 | **Moonscape sunrise**, → Moab, **Delicate Arch sunset** | Tue 28 Sep | Mon 18 Sep |
| 10 | Arches full day | Wed 29 Sep | Tue 19 Sep |
| 11 | **Mesa Arch sunrise**, Dead Horse Point sunset | Thu 30 Sep | Wed 20 Sep |
| 12 | Moab → Durango | Fri 1 Oct | Thu 21 Sep |
| 13 | Durango (rail / Mesa Verde) | Sat 2 Oct | Fri 22 Sep |
| 14 | **Million Dollar Hwy / Red Mountain Pass → Ouray** | Sun 3 Oct | Sat 23 Sep |
| 15 | **Ouray — Yankee Boy / Blue Lakes** | Mon 4 Oct | Sun 24 Sep |
| 16 | Ouray → Breckenridge via **Monarch Pass** | Tue 5 Oct | Mon 25 Sep |
| 17 | **Breckenridge / Boreas / Hoosier Pass** | Wed 6 Oct | Tue 26 Sep |
| 18 | WY transit night | Thu 7 Oct | Wed 27 Sep |
| 19 | → Grand Teton | Fri 8 Oct | Thu 28 Sep |
| 20 | **Grand Teton — Schwabacher / Oxbow sunrise** | Sat 9 Oct | Fri 29 Sep |
| 21 | Yellowstone S — **Grand Prismatic** | Sun 10 Oct | Sat 30 Sep |
| 22 | Yellowstone — Canyon, Hayden Valley | Mon 11 Oct | Sun 1 Oct |
| 23 | Yellowstone — **Lamar Valley**, Mammoth | Tue 12 Oct | Mon 2 Oct |
| 24 | → SLC | Wed 13 Oct | Tue 3 Oct |
| 25 | Fly SLC → YYZ | Thu 14 Oct | Wed 4 Oct |

Colorado block = **1–6 Oct** (A) vs **21–26 Sep** (B). Wyoming/Yellowstone block =
**8–13 Oct** (A) vs **28 Sep – 3 Oct** (B).

---

## 1. Colorado aspen peak colour — the sharpest difference between the windows

### 1.1 Official / agency statements

- **USDA Forest Service, San Juan National Forest fall colour report:**
  "fall colors begin with golden yellow quaking aspen at the highest elevations and narrow
  leaf cottonwoods in low-lying cold areas as early as late August. But aspens…usually peak
  near the end of September to early October."
  The same page describes the seasonal pattern as **starting mid-September near Silverton
  and finishing early-to-mid October around Pagosa Springs, Purgatory and Dolores.**
  Source: https://www.fs.usda.gov/r02/sanjuan/conditions/sjnf-fall-colors-report
- The San Juan Skyway report on that page is segmented as: Durango→Purgatory,
  Purgatory→Coal Bank, Coal Bank→Molas Pass, Silverton area, **Ouray→Telluride**,
  Dolores→Rico, Pagosa Springs. This is the live-condition source to check ~10 days out.
  Source: https://www.fs.usda.gov/r02/sanjuan/conditions/sjnf-fall-colors-report
- **USDA Forest Service national fall-colours page:** "White River National Forest, Colorado:
  Home to the famed Maroon Bells, this forest showcases vast groves of quaking aspens that
  turn **brilliant gold in late September**." And: "San Juan National Forest, Colorado: **The
  Million Dollar Highway between Ouray and Silverton** is one of the most scenic fall drives
  in the country." Source: https://www.fs.usda.gov/visit/fall-colors
- **Gunnison–Crested Butte (Kebler Pass region), destination marketing org:** "**Every
  September**, Crested Butte + Gunnison welcomes fall with open arms… Peak timing:
  September's cool nights and sunny days create ideal conditions for vibrant autumn colors."
  Named drives: **Ohio Pass, Waunita Pass, Taylor Canyon, Rainbow Lake Road.**
  Source: https://gunnisoncrestedbutte.com/blog/fall-colors/
- **Practitioner consensus, aggregated:** for the **8,000–9,500 ft** band (which includes the
  Million Dollar Highway corridor and the Ouray↔Silverton drive) "the best target window is
  likely still landing in the back half of September rather than stretching into October";
  in Southwest Colorado — Durango, Silverton, Ridgway, Ouray, Telluride — colour begins
  peaking around late September. Source (aggregator citing KOAA/Aspen Times/Springs Mag):
  https://www.explorefall.com/states/colorado.html and
  https://www.koaa.com/colorado-culture/2025-colorado-leaf-peeping-forecast-best-dates-drives-for-fall-colors
- **Elevation is the driver, not the calendar date:** "Colorado foliage is strongly
  elevation-driven, so a single statewide peak date is not useful for planning an aspen trip…
  **Higher passes often turn before nearby towns and river valleys.** … moving a short
  distance uphill or downhill can shift foliage stage from low color to peak or past peak."
  Source: https://www.explorefall.com/states/colorado.html

### 1.2 Elevation bands for the specific stops (station/summit elevations, verified)

| Location | Elevation | Source |
|---|---|---|
| Ouray town | 2,390 m / 7,838 ft | GHCN station USC00056203, https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt |
| **Red Mountain Pass summit** | 11,018 ft / 3,358 m | https://en.wikipedia.org/wiki/Red_Mountain_Pass |
| Red Mountain Pass (OSM node) | 37.89892, −107.71191 | https://nominatim.openstreetmap.org (query "Red Mountain Pass, Colorado") |
| Silverton | 2,830 m / 9,285 ft | GHCN USC00057656 |
| Telluride (4WNW stn) | 2,635 m / 8,646 ft | GHCN USC00058204 |
| Crested Butte town | 2,703 m / 8,868 ft | GHCN USC00051959 |
| **Kebler Pass summit** | 38.84987, −107.10035 | https://nominatim.openstreetmap.org (query "Kebler Pass, Colorado") |
| Breckenridge | 2,926 m / 9,600 ft | GHCN USC00050909 |
| Dillon / Summit Co. | 2,768 m / 9,081 ft | GHCN USC00052281 |

The aspen band in the San Juans/Elks runs roughly **8,000–10,500 ft**. Every stop on this
itinerary — Ouray (7,838), Telluride (8,646), Silverton (9,285), Crested Butte (8,868),
Breckenridge (9,600) — sits inside or just below it, and the drives (Red Mountain Pass
11,018; Boreas Pass; Hoosier Pass 11,542) cross the **top** of it. Higher ground turns and
drops **first**.

### 1.3 The quantified window comparison

Combining the FS statement ("aspens usually peak near the end of September to early October",
starting mid-September at the highest elevations) with the elevation profile above:

| | **Window A — 1–6 Oct 2027** | **Window B — 21–26 Sep 2028** |
|---|---|---|
| Ouray / Million Dollar Hwy (7,800–11,000 ft) | Peak-to-just-past-peak at town level; **high pass almost certainly past peak / bare** | **Squarely on peak across the whole elevation range** |
| Silverton (9,285 ft) | Past peak in a normal year (FS: colour *starts* mid-Sep at Silverton) | On peak / late peak |
| Telluride (8,646 ft) | Late peak to past peak | On peak |
| Kebler Pass / Crested Butte (8,868 ft+) | Past peak likely | On peak |
| Breckenridge / Summit Co (9,600 ft) | **Past peak — highest and coldest stop on the route** | On peak to late peak |

**Bottom line on aspens:** Window B lands the entire Colorado block inside the FS-stated
"end of September" peak. Window A lands it in the "early October" tail, which the FS text
associates with the *lower* end of the range (Pagosa Springs, Purgatory, Dolores at 6,700–
8,800 ft) — none of which are on this itinerary. **The two highest stops on the route,
Red Mountain Pass and Breckenridge, are the two most likely to be past peak in Window A.**

**Confidence caveat:** peak date shifts ±7–10 days year to year with snowpack, summer drought
and the first hard freeze. A drought year pulls peak *earlier*, which hurts Window A further;
a wet cool summer pushes it later, which would rescue Window A.
Source for the drought-shifts-peak-earlier mechanism:
https://www.koaa.com/colorado-culture/2025-colorado-leaf-peeping-forecast-best-dates-drives-for-fall-colors

### 1.4 Live-condition sources to check 10–14 days out

- **USFS San Juan NF fall colour report** (segment-by-segment, incl. Ouray→Telluride and
  Silverton): https://www.fs.usda.gov/r02/sanjuan/conditions/sjnf-fall-colors-report
- **USFS GMUG (Grand Mesa–Uncompahgre–Gunnison) conditions** — covers Kebler Pass, Ohio Pass,
  Crested Butte and the Ouray Ranger District; road-status tables and district phone numbers
  (Ouray RD 970-240-5300, Gunnison RD 970-641-0471):
  https://www.fs.usda.gov/r02/gmug/conditions
- **CDOT COtrip** — live cameras on US 550 (Red Mountain Pass) and US 50 (Monarch Pass):
  https://www.cotrip.org/
- **explorefall.com Colorado map** (date-slider peak estimate, aggregator not agency):
  https://www.explorefall.com/states/colorado.html
- GAP: **Colorado Tourism Office official fall-colour report** — https://www.colorado.com
  returns HTTP 403 to every user agent tried and could not be read. Its fall-colour page could
  not be verified.
- GAP: **A named public webcam at Red Mountain Pass, Kebler Pass or the Ouray amphitheatre** —
  no specific camera URL verified. COtrip carries CDOT cameras but individual camera IDs were
  not confirmed.
- GAP: **Year-by-year historical peak-date table for any San Juan sub-region** — the USFS
  report page explicitly does not publish one, and no other authoritative source was reachable.

---

## 2. Yellowstone wildlife

### 2.1 Elk rut — **the decisive wildlife difference**

- **NPS Yellowstone, elk:** "The mating season (**rut**) generally occurs from **early
  September to mid-October**. Elk gather in mixed herds… **Bulls bugle** to announce their
  availability and fitness to females and to warn and challenge other bulls."
  Source: https://www.nps.gov/yell/learn/nature/elk.htm
- Same page, quick-facts line: "Mating season (rut) in **September and October**."
- **Where, in autumn:** "Autumn, during 'rut' or mating season: **northern range, including
  Mammoth Hot Springs; Madison River**." Source: https://www.nps.gov/yell/learn/nature/elk.htm
- Winter destinations (relevant because the rut is on the front edge of migration): "migrate
  north to the northern range and around **Gardiner, Montana**; south to the **Jackson Hole
  Elk Refuge** in Jackson, Wyoming." Source: same page.

**Window comparison.** Window B (Yellowstone 28 Sep – 3 Oct 2028) sits in the **core** of the
NPS-stated early-Sep-to-mid-Oct rut. Window A (8–13 Oct 2027) sits in the **final week** of
the stated range — bugling still possible, harems breaking up, activity declining.
Neither window misses the rut outright; Window B catches it at intensity, Window A catches
its tail.

### 2.2 Bison rut — **over before both windows**

- **NPS Yellowstone, bison:** group sizes reach "a maximum of about 1,000 during the breeding
  season (known as the **rut**) in **July and August**." "Group sizes **decrease through
  autumn** and into winter."
  Source: https://www.nps.gov/yell/learn/nature/bison.htm
- Breeding-herd locations (still where the animals are in autumn): "The **northern** herd
  breeds in the **Lamar Valley** and on the high plateaus around it. The **central** herd
  breeds in **Hayden Valley**." 2025 population estimate ≈ **5,300**.
  Source: https://www.nps.gov/yell/learn/nature/bison.htm

**Bison rut is a non-differentiator.** It is finished by mid-September in both windows. Bison
will be present and photographable in Hayden and Lamar in both; the huge rut aggregations and
bellowing will not be.

### 2.3 Wolves in Lamar Valley

- **NPS Yellowstone, wolf:** "They inhabit most of the park, **peak activity is at dawn and
  dusk**." Average pack size in Yellowstone **11.8** (a second figure on the same page gives
  9.8); home range **185–310 sq mi**.
  Source: https://www.nps.gov/yell/learn/nature/wolf.htm
- Autumn homesite behaviour: "**Rendezvous sites**: used as wolf pups get older as a central
  homesite; time spent there and number of homesites varies widely between packs."
  Source: https://www.nps.gov/yell/learn/nature/wolf.htm
- **The hour, computed for the actual dates** (Lamar Valley 44.898 N, −110.220 W, 1,980 m,
  MDT; PyEphem):

| | civil dawn | sunrise | sunset | civil dusk |
|---|---|---|---|---|
| **W-A, 12 Oct 2027** (day 23) | **07:02** | 07:32 | 18:41 | **19:11** |
| **W-B, 2 Oct 2028** (day 23) | **06:50** | 07:20 | 18:58 | **19:28** |

So the practical wolf-watching windows are roughly **06:45–08:15** and **18:00–19:15** in
Window A, and **06:35–08:00** and **18:15–19:30** in Window B. Window A's shorter day means
a slightly later, more civilised pre-dawn alarm (~12 minutes) — a small point in A's favour.

- GAP: **NPS/Yellowstone Wolf Project guidance naming specific pullouts (Slough Creek, Lamar
  Canyon, Soda Butte, Hitching Post, Footbridge) and stating whether October beats late
  September for sightings** — not found on any nps.gov page reachable in this session. The
  annual Wolf Project report was not retrieved.
- GAP: **Autumn pack locations / rendezvous-site data for 2027 or 2028** — inherently
  unknowable this far out; check the current Wolf Project report closer to the trip.

**Reasoned (not sourced) point for the synthesiser:** the standard argument that October beats
September for wolves rests on snow pushing elk (and therefore wolves) to lower ground and on
thinner crowds. Neither is *sourced* here. Treat "October is better for wolves" as unverified.

### 2.4 Bears — hyperphagia, and what it means for hiking

- **NPS Yellowstone, bear:** "Bears spend most of their time feeding, especially during
  '**hyperphagia**,' the period **in autumn** when they may gain **more than three pounds per
  day** until they enter their dens to hibernate. In years and locations when **whitebark
  pine nuts** are available, they are the **most important bear food from September through
  October**." Autumn foods also include buffaloberry, ungulate carcasses, ants, false
  truffles and **army cutworm moths**.
  Source: https://www.nps.gov/yell/learn/nature/bear.htm
- **Denning:** "Most bears enter their den by **mid-November**; although, some males remain
  active through December." Black bears: "In **November**, they locate or excavate a den on
  north-facing slopes between 5,800–8,600 feet." Grizzly dens are dug at
  **6,562–10,000 ft** on north-facing slopes.
  Source: https://www.nps.gov/yell/learn/nature/bear.htm
- **Where to look:** "**Dawn and dusk in the Hayden and Lamar valleys, on the north slopes of
  Mount Washburn, and from Fishing Bridge to the East Entrance.**"
  Source: https://www.nps.gov/yell/learn/nature/bear.htm
- Grizzlies also take "weakened or injured male ungulates **during the fall rut**" and
  scavenge wolf kills spring through fall.
  Source: https://www.nps.gov/yell/learn/nature/bear.htm

**Implication, identical in both windows:** 28 Sep – 3 Oct and 8–13 Oct are **both** deep in
hyperphagia and both well before mid-November denning. Bears are maximally active, maximally
food-focused, and feeding in exactly the valleys this itinerary drives. **Bear spray, hiking
in a group of 3+, and making noise are mandatory in either window**, and the north slope of
Mount Washburn — which the Dunraven Pass road climbs — is explicitly named as bear habitat.
Window A is ~10 days deeper into hyperphagia, which if anything raises encounter probability
slightly, but does not change the required precautions.

- GAP: **Yellowstone Bear Management Area seasonal closure dates for autumn** — no reachable
  nps.gov page (`/yell/planyourvisit/bearclosures.htm` and four URL variants all 404).
  Several backcountry BMAs restrict off-trail travel into autumn; verify before booking any
  backcountry hike.
- GAP: **Bear activity around Moab and the San Juans** — not researched; low relevance
  (black bear country, no grizzly).

### 2.5 Pronghorn, bighorn, moose

- GAP: **Pronghorn, bighorn sheep and Grand Teton moose rut timing** — no authoritative NPS
  or state-agency page verified in this session. Do not assert dates for these without a
  source. (Widely reported but *unverified here*: bighorn rut is Nov–Dec, moose rut late Sep
  – early Oct, pronghorn rut Sep. If the moose figure holds, it slightly favours **Window B**
  for the Gros Ventre / Moose-Wilson Road — but it is unverified.)

---

## 3. Southwest monsoon end date, slot-canyon flash flood risk, and wet bentonite

### 3.1 Monsoon season dates — official

- **NWS Flagstaff (the office covering Page, Antelope Canyon and the Navajo Nation):**
  "Officially runs from **June 15th to September 30th**." "However, in northern Arizona,
  monsoonal moisture typically does not reach the region until the first week of July."
  "Much of the area receives **40–50% of its annual precipitation** during monsoon season."
  Source: https://www.weather.gov/fgz/MonsoonInfo
- **The critical caveat, same source:** "In most years, the monsoon season begins to **wind
  down** across northern Arizona in **September**. There tends to be longer breaks between
  the rounds of showers and thunderstorms… **However, this period can be where we see our
  most severe weather** with cooler Pacific Ocean troughs combining with lingering monsoonal
  moisture." Source: https://www.weather.gov/fgz/MonsoonInfo
- **NWS Tucson** confirms the seasonal accounting runs to "the total for the entire season
  **ending September 30th**." Source: https://www.weather.gov/twc/monsoon
- "**each monsoon season is different in almost every aspect from the onset/end**" — NWS
  explicitly warns against treating the calendar dates as physical.
  Source: https://www.weather.gov/fgz/MonsoonInfo

**Window comparison for Antelope Canyon (trip day 6):**

| | Antelope Canyon date | Days remaining in official monsoon season |
|---|---|---|
| **Window A** | **25 Sep 2027** | 5 days left |
| **Window B** | **15 Sep 2028** | 15 days left |

**Window A is meaningfully safer in a slot canyon.** Ten extra days of monsoon decay is a
real risk reduction, and NOAA normals agree: at Page AP (USC00026180) the probability of a
day with ≥0.10 in of precipitation is **7.7 %/day** over the Window-B Utah block vs
**6.9 %/day** over the Window-A block — a ~10 % relative reduction, on top of the seasonal
trend. Source: NCEI 1991–2020 daily normals, station USC00026180.

### 3.2 Antelope Canyon flash-flood history — why this matters

- "Antelope Canyon is visited **exclusively through guided tours**, in part because rains
  during summer season can quickly flood it. **Rain does not have to fall on or near the
  Antelope Canyon slots for flash floods to whip through; rain falling dozens of miles away
  can funnel into them with little notice.**"
- "On **August 12, 1997, eleven tourists** — including seven from France, one from the UK,
  one from Sweden and two from the US — **were killed in Lower Antelope Canyon by a flash
  flood. Very little rain fell at the site that day**, but an earlier thunderstorm dumped a
  large amount of water into the canyon basin **7 miles (11 km) upstream**."
- Mitigations installed since: bolted ladder systems, deployable cargo nets at the top of the
  canyon, a **NOAA Weather Radio** and an **alarm horn** at the fee booth.
- "Despite improved warning and safety systems, the risk of injury from flash floods still
  exists. On **July 30, 2010**, several tourists were stranded on a ledge when two flash
  floods occurred at **Upper** Antelope Canyon."
- Geology confirms the mechanism: "Antelope Canyon was formed by the **erosion of Navajo
  Sandstone due to flash flooding**… Rainwater, **especially during monsoon season**, runs
  into the extensive basin above the slot canyon sections."
  Source for all of the above: https://en.wikipedia.org/wiki/Antelope_Canyon

**Operational rule for either window:** the hazard is upstream rain, not local rain. A clear
sky over Page means nothing. Check the NWS Flagstaff flash-flood potential product
(https://www.weather.gov/fgz/Monsoon — Day 1/2/3 Flash Flood Potential graphics, including a
**Navajo Nation** area selection) the morning of the tour, and accept that Navajo Parks may
cancel. **Zion's Narrows carries the same class of risk on trip day 3** and the same rule
applies.

### 3.3 Wet bentonite — Hanksville, Factory Butte, Bentonite Hills, Cathedral Valley

- **NPS Capitol Reef, verbatim:** "**Bentonite clay (altered volcanic ash) absorbs water and
  becomes very slick and gummy when wet, making vehicle or foot travel difficult or
  impossible.**" The hills are the Brushy Basin shale member of the Morrison Formation and
  occur "on both the **Hartnet** and **Cathedral** (also known as the Caineville Wash)
  Roads, which usually require high clearance vehicles to access."
  Source: https://www.nps.gov/care/planyourvisit/cathedralvalley.htm
- Same page: "road conditions can vary greatly depending on recent weather conditions.
  **Spring and summer rains and winter snows can leave the roads muddy, washed out, and
  impassable to the best high-clearance four-wheel drive vehicle**, so check at the visitor
  center, or call **435-425-3791** (press #1 then #4 for road conditions, #3 for weather)."
- **The river ford:** "The south end of the **Hartnet Road** near Highway 24 requires
  **fording the Fremont River; there is no bridge**. Do not attempt to cross the river during
  floods or other periods of high water… The ford has a hard packed, rocky bottom and water
  levels are **normally a foot or less deep**."
  Source: https://www.nps.gov/care/planyourvisit/cathedralvalley.htm
- Isolation warning, same page: "Foot and vehicle travel in the Cathedral Valley area is
  light… **If you have problems, help may not arrive for hours or even days.** Carry plenty
  of water, food, gas, adequate clothing, **a shovel**, and emergency supplies. **Cell phone
  reception is usually poor to nonexistent.**"
- The **Cathedral Valley / Caineville Wash / Hartnet** high route over Thousand Lake Mountain
  (6,800 → 9,500 → 7,000 ft) "is normally open from **mid-June to late October**."
  Source: https://www.nps.gov/care/planyourvisit/cathedralvalley.htm — **relevant to Window A**:
  trip day 9 is 28 Sep 2027, still inside that season, but the margin shrinks.

**Precipitation risk on the Hanksville day (trip day 9), NOAA normals:**
Hanksville (USW00023170, 1,313 m) — P(≥0.10 in precip) = **6.9 %/day** across the
Window-A Utah block vs **7.1 %/day** for Window B. Capitol Reef NP (USC00421171) = **7.1 %**
(A) vs **8.3 %** (B). Source: NCEI 1991–2020 daily normals.
**Window A is marginally drier for the bentonite roads** — a small but real edge, consistent
with the monsoon-decay argument.

---

## 4. Temperature and precipitation normals — NOAA 1991–2020, exact trip dates

All figures are the **mean over the actual calendar dates each window occupies**, per station.
Source for every row: https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-daily-1991-2020
(station ID given). "P(wet)" = probability of a day with ≥0.10 in precipitation.

### 4.1 Utah / Arizona red rock — trip days 1–11

| Station (elev) | Window | Mean high | Mean low | P(wet)/day | P(snow)/day |
|---|---|---|---|---|---|
| **Zion NP** USC00429717 (1,231 m) | A 20–30 Sep | 87.3 °F / 30.7 °C | 57.7 °F / 14.3 °C | 7.6 % | 0.0 % |
| | B 10–20 Sep | **91.1 °F / 32.9 °C** | 61.8 °F / 16.5 °C | 8.1 % | 0.0 % |
| **Bryce Canyon NP HQ** USC00421008 (2,405 m) | A | 66.7 °F / 19.3 °C | **38.5 °F / 3.6 °C** | 10.6 % | n/a |
| | B | 70.5 °F / 21.4 °C | 41.8 °F / 5.5 °C | 13.0 % | n/a |
| **Page AP AZ** USC00026180 (1,302 m) | A | 81.1 °F / 27.3 °C | 55.8 °F / 13.2 °C | 6.9 % | 0.0 % |
| | B | 85.3 °F / 29.6 °C | 59.8 °F / 15.4 °C | 7.7 % | 0.0 % |
| **Bluff UT** USC00420788 (1,315 m) — Monument Valley proxy | A | 80.3 °F / 26.8 °C | 47.6 °F / 8.6 °C | 6.9 % | 0.0 % |
| | B | 84.7 °F / 29.3 °C | 52.2 °F / 11.2 °C | 7.2 % | 0.0 % |
| **Hanksville** USW00023170 (1,313 m) | A | 82.2 °F / 27.9 °C | 43.8 °F / 6.6 °C | 6.9 % | 0.0 % |
| | B | 86.8 °F / 30.5 °C | 48.2 °F / 9.0 °C | 7.1 % | 0.0 % |
| **Capitol Reef NP** USC00421171 (1,676 m) | A | 75.9 °F / 24.4 °C | 51.4 °F / 10.8 °C | 7.1 % | 0.0 % |
| | B | 80.2 °F / 26.8 °C | 55.0 °F / 12.8 °C | 8.3 % | 0.0 % |
| **Canyonlands–The Neck** USC00421163 (1,790 m) | A | 75.1 °F / 23.9 °C | 52.9 °F / 11.6 °C | 10.2 % | 0.0 % |
| | B | 79.5 °F / 26.4 °C | 57.4 °F / 14.1 °C | 10.4 % | 0.0 % |
| **Moab** USC00425733 (1,235 m) | A | 84.1 °F / 28.9 °C | 50.8 °F / 10.5 °C | 8.5 % | 0.0 % |
| | B | **88.2 °F / 31.2 °C** | 55.1 °F / 12.8 °C | 9.0 % | 0.0 % |

**Reading:** Window A is **4–5 °F (2.3–2.8 °C) cooler by day** everywhere in Utah and
Arizona. For a trip whose Utah block is built around all-day hiking (Angels Landing, the
Narrows, Devils Garden, Delicate Arch), **Window A is the more comfortable half.** Moab at
88 °F / 31 °C (B) vs 84 °F / 29 °C (A) is the sharpest single case. Snow risk in the red rock
is **zero in both windows**. GAP: **Kayenta AZ (USC00024578/USC00024580)** — the nearest
station to Monument Valley — returns no data from the NCEI normals service; Bluff UT is used
as a proxy and sits ~335 m *lower* than Monument Valley, so real MV lows will run a few
degrees colder than the table.

### 4.2 Colorado San Juans and Summit County — trip days 12–17

| Station (elev) | Window | Mean high | Mean low | P(wet)/day | P(snow ≥0.1 in)/day |
|---|---|---|---|---|---|
| **Ouray** USC00056203 (2,390 m) | **A 1–6 Oct** | 62.9 °F / 17.1 °C | 38.1 °F / 3.4 °C | 19.6 % | **3.8 %** |
| | **B 21–26 Sep** | 66.8 °F / 19.3 °C | 42.1 °F / 5.6 °C | 21.8 % | **2.0 %** |
| **Silverton** USC00057656 (2,830 m) — Red Mtn Pass proxy | A | 59.6 °F / 15.4 °C | **24.5 °F / −4.2 °C** | 20.7 % | **7.4 %** |
| | B | 63.3 °F / 17.4 °C | 27.6 °F / −2.5 °C | 22.6 % | **3.9 %** |
| **Telluride** USC00058204 (2,635 m) | A | 62.1 °F / 16.7 °C | 27.7 °F / −2.4 °C | 16.7 % | 3.6 % |
| | B | 65.6 °F / 18.7 °C | 31.2 °F / −0.4 °C | 20.1 % | 2.1 % |
| **Crested Butte** USC00051959 (2,703 m) — Kebler Pass proxy | A | 59.5 °F / 15.3 °C | 26.1 °F / −3.3 °C | 17.4 % | **6.8 %** |
| | B | 63.3 °F / 17.4 °C | 29.0 °F / −1.7 °C | 18.7 % | 3.8 % |
| **Breckenridge** USC00050909 (2,926 m) | A 5–6 Oct | GAP (no Tmax/Tmin normals at this station) | — | — | **10.7 %** |
| | B 25–26 Sep | GAP | — | — | **6.1 %** |
| **Dillon 1E** USC00052281 (2,768 m) — Summit Co proxy | A 1–6 Oct | 59.6 °F / 15.4 °C | 24.3 °F / −4.3 °C | 11.9 % | 6.7 % |
| | B 21–26 Sep | 63.8 °F / 17.7 °C | 27.4 °F / −2.5 °C | 13.6 % | 3.7 % |

Note: Breckenridge USC00050909 publishes snow normals but not temperature normals; Dillon 1E
is the temperature proxy (158 m lower, 12 km north).

### 4.3 Wyoming / Yellowstone — trip days 18–24

| Station (elev) | Window | Mean high | Mean low | P(wet)/day | P(snow ≥0.1 in)/day | P(snow on ground ≥1 in)/day |
|---|---|---|---|---|---|---|
| **Jackson WY** USC00484910 (1,893 m) | **A 7–13 Oct** | 57.7 °F / 14.3 °C | 26.5 °F / −3.0 °C | 13.0 % | 4.3 % | — |
| | **B 27 Sep–3 Oct** | 62.3 °F / 16.8 °C | 29.1 °F / −1.6 °C | 13.0 % | 2.4 % | — |
| **Moran 5WNW** USC00486440 (2,074 m) — Oxbow Bend | A | 54.4 °F / 12.5 °C | 26.8 °F / −2.9 °C | 16.6 % | **8.0 %** | 7.5 % |
| | B | 59.9 °F / 15.5 °C | 29.9 °F / −1.1 °C | 16.5 % | 4.4 % | 3.2 % |
| **Old Faithful** USC00486845 (2,241 m) | A | 53.0 °F / 11.7 °C | 23.9 °F / −4.5 °C | 17.9 % | **10.2 %** | **13.7 %** |
| | B | 58.2 °F / 14.6 °C | 26.6 °F / −3.0 °C | 17.0 % | 6.2 % | 7.2 % |
| **Lake Yellowstone** USC00485345 (2,406 m) | A | **49.1 °F / 9.5 °C** | 27.4 °F / −2.6 °C | 14.8 % | **14.1 %** | **19.9 %** |
| | B | 54.6 °F / 12.6 °C | 30.5 °F / −0.8 °C | 15.3 % | 8.6 % | 10.0 % |
| **Mammoth** USC00489905 (1,891 m) | A | 56.5 °F / 13.6 °C | 30.8 °F / −0.7 °C | 12.1 % | 7.6 % | 7.6 % |
| | B | 61.8 °F / 16.6 °C | 34.3 °F / 1.3 °C | 12.6 % | 4.6 % | 4.1 % |
| **Gardiner MT** USC00243378 (1,608 m) — N entrance | A | 63.1 °F / 17.3 °C | 36.6 °F / 2.5 °C | GAP | GAP | — |
| | B | 68.7 °F / 20.4 °C | 40.0 °F / 4.5 °C | GAP | GAP | — |
| **Dubois WY** USC00482715 (2,120 m) — Togwotee Pass approach | A | 58.2 °F / 14.6 °C | 27.8 °F / −2.3 °C | 9.5 % | 6.6 % | 6.0 % |
| | B | 62.7 °F / 17.1 °C | 30.8 °F / −0.7 °C | 11.1 % | 3.4 %* | 3.4 % |

\* Window-B Dubois snow figure is 4.4 %/day for ≥0.1 in; 3.4 % is the ≥1.0 in figure.

**Reading:** Yellowstone in Window A is **5–5.5 °F (~3 °C) colder** at every station and
carries **roughly double the daily snow probability**. Lake Yellowstone in Window A has a
**19.9 % chance on any given day of already having snow on the ground.**

GAP: **West Yellowstone MT (USC00248857)** and **Yellowstone Canyon RS (USC00489900)** return
no data from the NCEI normals service. Gardiner MT publishes temperature but not precipitation
or snow normals.

---

## 5. First snow and pass-closure probability

### 5.1 Cumulative probability of at least one measurable-snow day per leg (derived)

Derived by compounding the NOAA per-date `DLY-SNOW-PCTALL-GE001TI` normals across each leg's
actual dates: `P = 1 − Π(1 − p_i)`. This assumes daily independence, which slightly
**overstates** the true figure (snow days cluster in storms) — treat as an upper bound on
"at least one snowy day," and the *ratio* between windows as the reliable signal.

| Leg | **Window A** | **Window B** | A/B |
|---|---|---|---|
| Ouray block (trip d12–17) | **21 %** (1–6 Oct) | **11 %** (21–26 Sep) | 1.9× |
| Silverton / Red Mtn Pass (d12–17) | **37 %** (1–6 Oct) | **21 %** (21–26 Sep) | 1.8× |
| Telluride (d12–17) | 20 % | 12 % | 1.7× |
| Breckenridge (d16–17, 2 nights) | **22 %** (5–6 Oct) | 13 % (25–26 Sep) | 1.7× |
| Dillon / Summit Co (d16–17) | 14 % | 8 % | 1.8× |
| Jackson (d19–20) | 8 % | 4 % | 2.0× |
| Grand Teton / Oxbow (d19–20) | 14 % | 8 % | 1.8× |
| Old Faithful (d21–22) | 20 % | 12 % | 1.7× |
| Yellowstone Lake (d21–23) | **38 %** | 25 % | 1.5× |
| **Whole Yellowstone leg, Old Faithful proxy (d19–24)** | **48 %** | **33 %** | 1.5× |
| **Whole Yellowstone leg, Lake proxy (d19–24)** | **61 %** | **43 %** | 1.4× |

Source data: NCEI 1991–2020 daily normals, stations as listed in §4.

**Headline:** in Window A the trip has a roughly **60 % chance of at least one snow day
somewhere in Yellowstone** and a **~37 % chance of snow on Red Mountain Pass**. In Window B
those fall to ~43 % and ~21 %.

### 5.2 Specific pass status

- **Red Mountain Pass, US 550, 11,018 ft.** Paved throughout; kept open through winter but
  "known for being treacherous in the wintertime due to the steep 8 % grade and switchbacks on
  the north side facing Ouray… **Avalanches are frequent, and can block the highway for some
  time.** … winding and narrow, and has **no shoulder**." Climate at the pass is subalpine
  (Köppen Dsc) bordering alpine. Source: https://en.wikipedia.org/wiki/Red_Mountain_Pass
  Neither window has an avalanche risk (that is a mid-winter problem); the operative risk in
  early October is **a wet snow event making a shoulderless cliff road unpleasant** — 37 %
  chance of ≥1 snow day on the Silverton proxy in Window A vs 21 % in Window B.
- **Monarch Pass, US 50, 11,312 ft** (trip day 16, Ouray→Breckenridge). "The pass can be
  traversed by all vehicles under most conditions and is **generally open year-round**;
  however, 7 % grades exist, and the area is prone to heavy winter snowfall, **often resulting
  in temporary closures during severe winter storms**." Runaway-truck ramps both sides.
  Source: https://en.wikipedia.org/wiki/Monarch_Pass
  **Not a hard closure risk in either window.** Live status: https://www.cotrip.org/
- **Kebler Pass, Gunnison County Road 12** (optional aspen detour). "It is a **mostly gravel
  road and is closed during the winter months**. A few portions of the road near the top of
  the pass have been paved. **In the summer, the road is accessible by all passenger
  vehicles.**" Source: https://en.wikipedia.org/wiki/Kebler_Pass
  GAP: **the exact winter-closure date for GCR 12** was not verified. Early October is
  normally still open; an early storm can shut it. Check with the Gunnison Ranger District,
  970-641-0471 (https://www.fs.usda.gov/r02/gmug/conditions).
- **Togwotee Pass, US 26/287, 9,655 ft** (trip day 19 approach from the transit night).
  "The pass receives **heavy winter snowfall**… **Annual snowfall at the pass often exceeds
  25 feet (7.6 m)** (reports of over fifty feet are also known) and **the road can be shut
  down for days at a time during blizzards**."
  Source: https://en.wikipedia.org/wiki/Togwotee_Pass
  Dubois (2,120 m, on the east approach) shows **6.6 %/day** snow probability in Window A vs
  **4.4 %/day** in Window B. A multi-day blizzard closure in either window is unlikely but
  Window A's risk is ~1.5× higher.
  GAP: **WYDOT historical closure statistics for Togwotee in October** — wyoroad.info returned
  404 and no WYDOT closure history was verified.
- **Dunraven Pass, Yellowstone, 8,859 ft** (Canyon Village ↔ Tower Fall; carries the
  Mt Washburn access and the direct Canyon→Lamar link). Source for elevation:
  https://en.wikipedia.org/wiki/Dunraven_Pass
  **NPS published 2026 season: "Open May 22 – October 12, 2026: Canyon Village to Tower Fall
  (Dunraven Pass). This is a high elevation pass that generally experiences more winter
  weather than other roads in the park — as with all other roads, the closing date is subject
  to change."** Source: https://www.nps.gov/yell/planyourvisit/parkroads.htm

  > **THIS IS THE SINGLE HARDEST FACT IN THIS DOCUMENT.**
  > Window A puts trip day 22 (Canyon) on **11 Oct** and day 23 (Lamar → Mammoth) on
  > **12 Oct 2027**. On the published NPS pattern, **Dunraven Pass closes on or about 12
  > October** — i.e. the day the itinerary needs it. In Window A the Canyon→Tower→Lamar
  > drive is a coin flip; the detour is Canyon→Norris→Mammoth→Tower, roughly an extra hour.
  > Window B (Lamar on **2 Oct 2028**) has ten days of margin.

- **Beartooth Highway, US 212, Beartooth Pass 10,947 ft** (the NE entrance approach and the
  optional scenic add-on). NPS 2026: "**Open May 22 – October 12, 2026: Beartooth Highway
  (US-212), Chief Joseph Scenic Byway (WY-296).**"
  Source: https://www.nps.gov/yell/planyourvisit/parkroads.htm
  Independently: "Because of heavy snowfall at the top, the pass is usually open for about
  five months per year, from **mid-May to mid-October**, weather conditions permitting… At
  this elevation and latitude, **snowstorms can occur even in the middle of the summer**."
  Source: https://en.wikipedia.org/wiki/Beartooth_Highway
  **Window A: Beartooth is closed or closing. Window B: comfortably open.**
- **Yellowstone's other roads.** "The **only** road generally open year-round to regular
  vehicles is from the **North Entrance at Gardiner, Montana, through the park to Cooke City,
  Montana (via Tower Junction)**. **Most park roads are closed to regular vehicles from early
  November to late-April.**" 2026 published dates: West Entrance–Madison, Madison–Old
  Faithful, Madison–Norris, Mammoth–Norris, Norris–Canyon **open to 31 October**;
  East Entrance–Fishing Bridge (Sylvan Pass), Canyon–Bridge Bay **to 31 October**;
  South Entrance–West Thumb, West Thumb–Old Faithful (Craig Pass), West Thumb–Lake Village,
  Tower-Roosevelt–Tower Fall **to 31 October**.
  Source: https://www.nps.gov/yell/planyourvisit/parkroads.htm
  **Both windows are inside the open season for everything except Dunraven and Beartooth.**
  "After initial opening, **weather causes occasional closures**. Please check locally or at
  WY DOT and MT DOT before traveling." Same source.
- **Yankee Boy Basin road above Ouray** (trip day 15). GAP: **no authoritative closure date
  verified.** The USFS Ouray Ranger District (970-240-5300) is the source of record:
  https://www.fs.usda.gov/r02/gmug/conditions. The upper basin is above 11,000 ft and is
  normally the first thing in the itinerary to be lost to snow — a Window-A risk.
- **Cathedral Valley high route over Thousand Lake Mountain** "is normally open from
  **mid-June to late October**." Source: https://www.nps.gov/care/planyourvisit/cathedralvalley.htm

---

## 6. Sun azimuth and elevation for every signature shot — computed for the actual dates

All values computed with PyEphem for the exact viewpoint coordinates, at 1,010 hPa,
geometric horizon 0°, refraction applied. **Times are LOCAL and the timezone is stated per
row — this matters, see the Arizona note below.**

> **TIMEZONE TRAP.** Page, Horseshoe Bend and Glen Canyon are in **Arizona = MST (UTC−7), no
> DST**. Antelope Canyon and Monument Valley are on the **Navajo Nation, which DOES observe
> DST = MDT (UTC−6)**. On trip days 5–7 the traveller crosses a one-hour boundary twice
> without crossing a state line. A tour booked for "8 a.m." at Antelope Canyon is **7 a.m.
> Page time**. Both windows are before the US DST change (first Sunday in November), so this
> applies to A and B identically.

### 6.1 Master table

| Shot | Window / date | Sunrise (az) | Sunset (az) | Solar noon alt | Civil dawn | Civil dusk |
|---|---|---|---|---|---|---|
| **Bryce Sunrise Point** (37.6247, −112.1655, 2,470 m, MDT) | A d5 24 Sep 27 | **07:17** (90.0°) | 19:22 (269.8°) | 51.8° | 06:51 | 19:49 |
| | B d5 14 Sep 28 | **07:10** (85.4°) | 19:37 (274.3°) | 55.4° | 06:43 | 20:03 |
| **Horseshoe Bend** (36.8791, −111.5104, 1,300 m, **MST/Arizona**) | A d5 24 Sep 27 | 06:15 (90.0°) | **18:20** (269.8°) | 52.5° | 05:48 | 18:46 |
| | B d5 14 Sep 28 | 06:07 (85.5°) | **18:34** (274.3°) | 56.1° | 05:41 | 19:00 |
| **Upper Antelope Canyon** (36.8619, −111.3743, 1,250 m, **MDT/Navajo**) | A d6 25 Sep 27 | 07:15 (90.5°) | 19:18 (269.3°) | **52.2°** | 06:49 | 19:44 |
| | B d6 15 Sep 28 | 07:07 (86.0°) | 19:32 (273.8°) | **55.7°** | 06:41 | 19:58 |
| **Monument Valley / The View** (36.9832, −110.1112, 1,650 m, **MDT/Navajo**) | A d7 26 Sep 27 | 07:11 (90.9°) | **19:11** (268.8°) | 51.6° | 06:44 | 19:37 |
| | A d8 27 Sep 27 | **07:12** (91.4°) | 19:10 (268.3°) | 51.3° | 06:45 | 19:36 |
| | B d7 16 Sep 28 | 07:03 (86.4°) | **19:25** (273.3°) | 55.2° | 06:37 | 19:52 |
| | B d8 17 Sep 28 | **07:04** (86.9°) | 19:24 (272.8°) | 54.8° | 06:38 | 19:50 |
| **Natural Bridges NM** (37.6017, −110.0083, 1,990 m, MDT) | A d8 27 Sep 27 | 07:11 (91.4°) | 19:09 (268.3°) | 50.6° | 06:45 | 19:36 |
| | B d8 17 Sep 28 | 07:03 (86.9°) | 19:23 (272.9°) | 54.2° | 06:37 | 19:50 |
| **Factory Butte / Blue Valley Spire** (38.345, −111.010, 1,450 m, MDT) | A d8 27 Sep 27 | 07:15 (91.4°) | **19:13** (268.3°) | 49.9° | 06:49 | 19:40 |
| | B d8 17 Sep 28 | 07:07 (86.9°) | **19:28** (272.9°) | 53.5° | 06:40 | 19:55 |
| **Moonscape Overlook** (38.4318, −110.8847, 1,500 m, MDT) | A d9 28 Sep 27 | **07:16** (91.9°) | 19:11 (267.8°) | 49.4° | 06:49 | 19:38 |
| | B d9 18 Sep 28 | **07:08** (87.3°) | 19:26 (272.4°) | 53.0° | 06:41 | 19:52 |
| **Delicate Arch** (38.7436, −109.4993, 1,500 m, MDT) | A d9 28 Sep 27 | 07:10 (91.9°) | **19:05** (267.8°) | 49.1° | 06:43 | 19:32 |
| | B d9 18 Sep 28 | 07:02 (87.3°) | **19:20** (272.4°) | 52.7° | 06:35 | 19:47 |
| **Mesa Arch** (38.3887, −109.8687, 1,830 m, MDT) | A d11 30 Sep 27 | **07:14** (92.9°) | 19:04 (266.8°) | 48.7° | 06:47 | 19:31 |
| | B d11 20 Sep 28 | **07:05** (88.3°) | 19:18 (271.4°) | 52.3° | 06:38 | 19:45 |
| **Dead Horse Point** (38.4820, −109.7409, 1,800 m, MDT) | A d11 30 Sep 27 | 07:13 (92.9°) | **19:03** (266.8°) | 48.6° | 06:46 | 19:30 |
| | B d11 20 Sep 28 | 07:05 (88.3°) | **19:18** (271.4°) | 52.2° | 06:38 | 19:45 |
| **Ouray / Million Dollar Hwy** (38.0228, −107.6714, 2,380 m, MDT) | A d15 4 Oct 27 | 07:08 (94.9°) | 18:49 (264.9°) | 47.5° | 06:41 | 19:16 |
| | B d15 24 Sep 28 | 07:00 (90.3°) | 19:03 (269.4°) | 51.1° | 06:33 | 19:30 |
| **Schwabacher Landing** (43.6797, −110.7141, 2,020 m, MDT) | A d20 9 Oct 27 | **07:29** (97.9°) | 18:50 (261.9°) | 39.9° | 07:00 | 19:19 |
| | B d20 29 Sep 28 | **07:18** (93.0°) | 19:06 (266.8°) | 43.5° | 06:49 | 19:35 |
| **Oxbow Bend** (43.8646, −110.5488, 2,070 m, MDT) | A d20 9 Oct 27 | **07:28** (97.9°) | 18:49 (261.8°) | 39.8° | 06:59 | 19:18 |
| | B d20 29 Sep 28 | **07:17** (93.0°) | 19:05 (266.8°) | 43.3° | 06:48 | 19:34 |
| **Grand Prismatic Overlook** (44.5230, −110.8385, 2,250 m, MDT) | A d21 10 Oct 27 | 07:31 (98.5°) | 18:48 (261.2°) | **38.7°** | 07:02 | 19:17 |
| | B d21 30 Sep 28 | 07:20 (93.5°) | 19:04 (266.2°) | **42.3°** | 06:50 | 19:34 |
| **Lamar Valley** (44.8980, −110.2200, 1,980 m, MDT) | A d23 12 Oct 27 | 07:32 (99.6°) | 18:41 (260.1°) | 37.6° | 07:02 | 19:11 |
| | B d23 2 Oct 28 | 07:20 (94.6°) | 18:58 (265.1°) | 41.1° | 06:50 | 19:28 |
| **Zion Canyon / Springdale** (37.20, −112.987, 1,250 m, MDT) | A d2 21 Sep 27 | 07:18 (88.5°) | 19:30 (271.3°) | 53.4° | 06:52 | 19:57 |
| | B d2 11 Sep 28 | 07:11 (84.0°) | 19:44 (275.7°) | 56.9° | 06:44 | 20:11 |

**Systematic pattern across every row:** Window A's sun rises **4–5° further south** and sets
**4–5° further south** than Window B, and peaks **3.4–3.6° lower**. Day length is **~28
minutes shorter** in Utah and **~34 minutes shorter** in Wyoming.

### 6.2 Subject bearings — does the light actually hit the subject? (computed)

Great-circle bearing from the standard shooting position to the subject:

| Viewpoint → subject | Bearing | Compass |
|---|---|---|
| Mesa Arch viewpoint → arch opening (east, over the canyon) | 90.0° | E |
| Bryce Sunrise Point → amphitheatre (east-facing wall) | 90.0° | E |
| Bryce Inspiration Point → amphitheatre | 60.1° | ENE |
| Dead Horse Point overlook → the Goosenecks | 254.8° | WSW |
| Horseshoe Bend overlook → the bend / river | 180.0° | S |
| Schwabacher Landing → Grand Teton summit (43.74104, −110.80244) | **314.0°** | **NW** |
| Oxbow Bend turnout → Mount Moran summit (43.83521, −110.77632) | **259.7°** | **W** |
| Grand Prismatic Overlook → the spring (44.525, −110.8381) | 5.8° | N |
| Moonscape Overlook → Factory Butte (38.43787, −110.91437) | ~WNW | — |
| Moonscape Overlook → badlands below | 257.4° | WSW |

Peak coordinates from Wikipedia (Grand Teton, Mount Moran, Grand Prismatic Spring, Mesa Arch,
Delicate Arch, Dead Horse Point) via
https://en.wikipedia.org/w/api.php?action=query&prop=coordinates ; Factory Butte, Horseshoe
Bend, Upper Antelope Canyon and The View Hotel (36.98212, −110.11185) from OSM Nominatim,
https://nominatim.openstreetmap.org

**What the bearings tell you:**

- **Mesa Arch faces due east (90.0°).** Window A sunrise azimuth **92.9°** — 2.9° south of
  the arch axis. Window B sunrise azimuth **88.3°** — 1.7° north of it. **Both windows put
  the rising sun essentially inside the arch's opening; Window B is marginally better
  centred.** The classic under-glow (sun bouncing off the cliff below onto the arch's
  underside) works in both. Practical note: arrive ~45 min before sunrise (06:30 W-A /
  06:20 W-B) — this is the most crowded sunrise in Utah.
- **Bryce amphitheatre faces east (90.0° from Sunrise Point, 60.1° from Inspiration Point).**
  Window A sunrise 90.0°, Window B 85.4°. **Window A's sun rises exactly on the amphitheatre
  axis** — this is the one shot where Window A's more southerly sunrise is *better*, because
  it lines up with the amphitheatre's east-facing bowl rather than clipping it from the
  north-east. Marginal, but real.
- **Schwabacher Landing → Grand Teton is 314° (NW).** The sun rises at **97.9° (A)** or
  **93.0° (B)** — i.e. behind and to the right of the photographer, front-lighting the Teton
  face across the beaver ponds. **Works in both windows.** Window A's more southerly sunrise
  puts a warmer, more raking light on the peak's south face; Window B's more northerly
  sunrise lights the face more evenly. Both are good; **Window A is arguably the better
  Schwabacher light**, at the cost of a colder, likelier-frozen morning.
- **Oxbow Bend → Mount Moran is 259.7° (due W).** Same logic: sunrise from the east
  back-lights the photographer and front-lights Moran. **Works in both.** The reflection
  requires still water — colder Window A mornings (Moran mean low **26.8 °F / −2.9 °C**) are
  *more* likely to be dead calm, and more likely to produce mist off the Snake. **This is a
  genuine Window A advantage for Oxbow Bend.**
- **Grand Prismatic Overlook → the spring is 5.8° (due N)** and requires the sun **high and
  behind you** to penetrate the steam and saturate the colours. See §6.4 — this is where
  Window A fails hardest.
- **Dead Horse Point looks WSW (254.8°).** Sunset azimuth **266.8° (A)** / **271.4° (B)** —
  the sun sets **to the right of the subject** in both, which is what you want (side-light on
  the goosenecks rather than straight into the lens). Both fine.
- **Horseshoe Bend looks due south (180°).** The sun is never behind the subject; the shot is
  about the low sun raking across the bend from the west. Sunset **18:20 MST (A)** /
  **18:34 MST (B)**.
- **Monument Valley: West Mitten bears ~312° (NW) from The View.** GAP: **exact coordinates
  for West Mitten, East Mitten and Merrick Butte could not be verified** — Nominatim has no
  entries, Wikipedia has only Merrick Butte (36.98056, −110.08596) which is inconsistent
  with the visitor-centre position and is likely imprecise; Overpass API timed out. **Do not
  rely on the Monument Valley bearings above.** What *is* solid: The View
  Hotel/visitor-centre position (36.98212, −110.11185, OSM Nominatim) and the sun times
  above. The standard photographic practice — sunrise front-lights the buttes warm from
  behind the terrace, sunset renders them as silhouettes — should be re-verified against a
  photography source before it goes in the plan.

### 6.3 Antelope Canyon light beams — do they even happen? (computed)

Beams require the sun **high enough to drop a shaft through a narrow overhead slot to the
canyon floor.** Season, per tour operators: "**light beams start around March 20 and last
until early October**"; strongest beam hours "**11:00 AM to 1:30 PM**"; peak months June–
August; and the shoulder sweet spot is "**mid-September to October** (monsoon over,
comfortable temperatures, **soft light**)". Sources:
https://slotcanyonguide.com/antelope-canyon/best-time-to-visit/ ,
https://navajotours.com/blog/what-are-the-best-times-to-see-the-antelope-canyon-light-beams/ ,
https://www.antelope-canyon-tours.com/opening-hours/

**Computed solar altitude at Upper Antelope Canyon (36.8619, −111.3743), local Navajo MDT:**

| Threshold | **W-A, 25 Sep 2027** | **W-B, 15 Sep 2028** |
|---|---|---|
| Peak solar altitude | **52.2°** | **55.7°** |
| Sun ≥ 30° | 09:56–16:38 (6.7 h) | 09:46–16:54 (7.1 h) |
| Sun ≥ 40° | 10:56–15:38 (4.7 h) | 10:42–15:58 (5.3 h) |
| Sun ≥ 45° | 11:32–15:00 (3.5 h) | 11:14–15:26 (4.2 h) |
| **Sun ≥ 50°** | **12:22–14:12 (1.8 h)** | **11:52–14:48 (2.9 h)** |
| **Sun ≥ 55°** | **NEVER** | **12:50–13:50 (1.0 h)** |
| Sun ≥ 60° | never | never |

**Verdict.** Both windows are inside the stated beam season, and neither is anywhere near the
June–August peak. But Window B gives **61 % more high-sun time (≥50°)** and **a full hour
above 55°, which Window A never reaches at all.** If a defined, photographable beam is the
goal, **book the 12:00–13:30 slot and choose Window B.** In Window A, expect the "soft light /
reflected glow" version of Upper Antelope rather than a hard shaft — which is still excellent
and is what most operators sell for late September. **Lower Antelope Canyon, which is about
reflected wall colour rather than beams, is unaffected in either window.**

### 6.4 Grand Prismatic Overlook — the second hard finding

The overlook shot needs the sun high enough to burn through the steam and to make the
microbial mat colours read. **Computed solar altitude at the overlook (44.5230, −110.8385,
2,250 m, MDT):**

| Threshold | **W-A, 10 Oct 2027** | **W-B, 30 Sep 2028** |
|---|---|---|
| Peak solar altitude | **38.7°** | **42.3°** |
| Sun ≥ 30° | 10:52–15:28 (4.6 h) | 10:30–15:54 (5.4 h) |
| **Sun ≥ 40°** | **NEVER — the sun does not reach 40° all day** | **12:08–14:18 (2.2 h)** |

> **In Window A, the sun never gets above 38.7° at Grand Prismatic. In Window B you get 2.2
> hours above 40°.** Combine with the temperature normals — Old Faithful mean high
> **53.0 °F / 11.7 °C** (A) vs **58.2 °F / 14.6 °C** (B) — and Window A is both lower-sun
> *and* colder, which means **more steam** obscuring the spring. This is a compounding, not
> an additive, penalty. Grand Prismatic Overlook is the shot Window A most clearly degrades.

### 6.5 Deep-canyon and slot lighting windows (computed)

Hours per day the sun is above each altitude threshold — a proxy for how long light actually
reaches a canyon floor:

| Location | Threshold | **Window A** | **Window B** |
|---|---|---|---|
| **Zion Canyon floor** (37.20, −112.95, MDT) | ≥40° | 10:58–15:52 (**4.9 h**) | 10:44–16:12 (**5.5 h**) |
| | ≥50° | 12:16–14:34 (2.3 h) | 11:50–15:06 (3.3 h) |
| | ≥55° | **never** | 12:38–14:18 (1.7 h) |
| **The Narrows / Wall Street** (37.297, −112.948, MDT) | ≥40° | 11:00–15:48 (**4.8 h**) | 10:46–16:08 (**5.4 h**) |
| | ≥50° | 12:20–14:28 (2.1 h) | 11:54–15:02 (3.1 h) |
| | ≥55° | **never** | 12:46–14:10 (1.4 h) |
| **Horseshoe Bend inner canyon** (MST) | ≥40° | 09:56–14:40 (**4.7 h**) | 09:42–15:00 (**5.3 h**) |
| | ≥50° | 11:18–13:18 (2.0 h) | 10:50–13:52 (3.0 h) |

**What is simply not lit in October.** In Window A the sun never exceeds ~50–52° anywhere in
southern Utah. Practical consequences:
- **The Narrows** — the glowing-wall reflected light that makes the Wall Street section work
  needs sun striking the upper canyon walls. Window A gives **2.1 h** of ≥50° sun vs
  **3.1 h** in Window B, and **zero** time above 55° vs 1.4 h. **Shoot the Narrows
  11:00–14:30 in either window; the usable envelope is ~50 minutes narrower in Window A.**
- **Any north-facing wall or north-side alcove** — with the sun peaking at 48–52° and
  transiting due south, north-facing rock in a deep canyon receives **no direct sun at all**
  in either window at these latitudes; that is not a window discriminator, it is a
  year-round-in-autumn fact. It matters for: the north wall of Zion Canyon below Angels
  Landing in the morning, the north-facing side of the Delicate Arch bowl, and the shaded
  north walls in Bryce's amphitheatre after ~10:00.
- **Bryce amphitheatre after sunrise** — the bowl faces east, so it is fully lit at sunrise
  and progressively shaded through the afternoon. This is why the itinerary's "Bryce sunrise"
  on day 5 is correct in both windows, and why an afternoon Bryce arrival on day 4 should
  target **Sunset Point at 19:22 (A) / 19:37 (B)** for the last warm light on the far wall.

---

## 7. Sunrise vs sunset vs overcast — assignment per location

| Location | Best light | Reasoning |
|---|---|---|
| **Mesa Arch** | **SUNRISE, no alternative** | Arch opening bears 90.0° (due E). The under-glow only exists in the first ~15 min after sunrise. Useless at sunset. Arrive 45 min early. |
| **Bryce amphitheatre** | **SUNRISE** (Sunrise/Inspiration Pt) | Bowl faces E (60–90°). Secondary: **sunset at Sunset Point** for the far wall. |
| **Delicate Arch** | **SUNSET** | Standard. Sun sets 267.8° (A) / 272.4° (B) — west, front-lighting the arch's west face. Allow ~60 min for the 4.8 km hike up in fading light plus headtorches down. |
| **Horseshoe Bend** | **SUNSET** (viewpoint faces S) | Note: the inner canyon goes dark long before the rim. The last light is on the rim and the far wall, not the river. Sunset **18:20 MST (A)** / **18:34 MST (B)** — remember Arizona time. |
| | *also good* **OVERCAST** | A high overcast tames the ~10 EV range between lit rim and shadowed river. |
| **Upper Antelope Canyon** | **MIDDAY, 11:00–13:30** | Beams need the sun near its peak; see §6.3. Time of day matters far more than time of year. |
| **Lower Antelope Canyon** | **OVERCAST or midday** | Reflected wall colour, not beams. "Photography within the canyons is difficult due to the **wide exposure range (often 10 EV or more)**" — https://en.wikipedia.org/wiki/Antelope_Canyon. Overcast is genuinely better here. |
| **Monument Valley Mittens** | **SUNRISE** primary, **SUNSET** secondary | Sunrise 07:11 (A) / 07:03 (B) MDT-Navajo; sunset 19:11 (A) / 19:25 (B). GAP on the exact bearings (§6.2) — verify which of the two the View Hotel terrace is oriented for. |
| **Moonscape Overlook** | **SUNRISE** | Badlands bear WSW (257°) from the overlook, so the rising sun front-lights them across the void. Sunrise 07:16 (A) / 07:08 (B). Factory Butte reads better at **sunset** from the UT-24 side. |
| **Factory Butte / Blue Valley Spire** | **SUNSET** | Sunset 19:13 (A) / 19:28 (B). |
| **Dead Horse Point** | **SUNSET** | Goosenecks bear 254.8° WSW; sun sets 266.8° (A) / 271.4° (B), i.e. off to the right — side-light, not backlight. Sunset 19:03 (A) / 19:18 (B). |
| **Schwabacher Landing** | **SUNRISE only** | Teton bears 314° NW; sun rises 97.9° (A) / 93.0° (B) behind you. Needs still water. |
| **Oxbow Bend** | **SUNRISE only** | Moran bears 259.7° W. Needs still water + ideally mist. **Colder Window A mornings favour this shot.** |
| **Grand Prismatic Overlook** | **HIGH SUN, 11:30–14:00** — never sunrise or sunset | Needs altitude, not warmth of light. **Actively hostile to overcast** (colours die) and to cold (steam). See §6.4. |
| **Lamar Valley (wildlife)** | **DAWN and DUSK** | NPS: wolves' "peak activity is at dawn and dusk" — https://www.nps.gov/yell/learn/nature/wolf.htm ; bears "dawn and dusk in the Hayden and Lamar valleys" — https://www.nps.gov/yell/learn/nature/bear.htm |
| **Zion Narrows** | **MIDDAY 11:00–14:30** | Reflected glow, not direct sun. See §6.5. |
| **Million Dollar Hwy aspens** | **OVERCAST or diffuse** | Backlit yellow aspen against blue sky is the classic, but a bright overcast saturates the gold and kills the contrast problem on a shaded canyon road. Either works. |

---

## 8. Dark-sky and astrophotography

### 8.1 Certified parks on this route

- **Natural Bridges NM (trip day 8)** — "designated the **world's first International Dark Sky
  Park in 2007**"; "Home to some of the darkest skies in the country."
  Source: https://www.nps.gov/nabr/index.htm
- **Canyonlands NP (trip day 11)** — "the International Dark Sky Association designated
  Canyonlands as a **Gold-Tier International Dark Sky Park in 2015**. Canyonlands is one of
  many parks in southern Utah with the International Dark Sky Park designation."
  Source: https://www.nps.gov/cany/learn/nature/lightscape.htm
- **Arches NP (trip day 10)** — "In **2019** Arches National Park became certified as an
  official International Dark Sky Park." NPS advice: "You'll see the darkest skies during a
  **new moon or when the moon is below the horizon**. Even the light from a thin crescent
  moon can make it more difficult to see fainter stars or even the Milky Way." Best spots:
  "the farther **north** you drive, away from the lights of Moab, the darker the sky."
  Source: https://www.nps.gov/arch/planyourvisit/stargazing.htm
- **Dead Horse Point State Park (trip day 11)** — carries an International Dark Sky Park
  designation. Source: https://stateparks.utah.gov/parks/dead-horse/
- GAP: **Capitol Reef NP and Bryce Canyon NP dark-sky certification years** — the nps.gov
  night-sky/lightscape pages for both (`/care/learn/nature/nightsky.htm`,
  `/brca/learn/nature/lightscape.htm` and three other URL patterns) returned 404 or no
  matching text. Both are widely reported as IDSPs but that is **not verified here**.

### 8.2 Moon phases across both windows (computed, PyEphem; MDT = UTC−6)

**Window A (2027)**
| Event | UTC | MDT |
|---|---|---|
| Full Moon | 15 Sep 2027 23:03 | 15 Sep 17:03 — *before the trip* |
| Last Quarter | 23 Sep 2027 10:20 | 23 Sep 04:20 (trip day 4) |
| **NEW MOON** | **30 Sep 2027 02:35** | **29 Sep 2027 20:35 (trip day 10 evening)** |
| First Quarter | 7 Oct 2027 11:47 | 7 Oct 05:47 (trip day 18) |
| Full Moon | 15 Oct 2027 13:46 | 15 Oct 07:46 — *day after the trip ends* |

**Window B (2028)**
| Event | UTC | MDT |
|---|---|---|
| Last Quarter | 12 Sep 2028 00:45 | 11 Sep 18:45 (trip day 2) |
| **NEW MOON** | **18 Sep 2028 18:23** | **18 Sep 2028 12:23 (trip day 9)** |
| First Quarter | 25 Sep 2028 13:09 | 25 Sep 07:09 (trip day 16) |
| Full Moon | 3 Oct 2028 16:24 | 3 Oct 10:24 (trip day 24) |

### 8.3 Nightly moon illumination and the dark windows (computed at Natural Bridges,
37.6017 N, −110.0083 W)

**Window A — the dark run is trip days 7–13 (26 Sep – 2 Oct 2027)**

| Trip day | Night of | Illum @ midnight | Moonset (MDT) | Where the itinerary is |
|---|---|---|---|---|
| d7 | 26 Sep 2027 | 11.2 % | 17:11 | **Monument Valley** |
| d8 | 27 Sep 2027 | **4.9 %** | 17:42 | **Natural Bridges (world's 1st IDSP) / Hanksville** |
| d9 | 28 Sep 2027 | **1.1 %** | 18:11 | **Moonscape / Moab** |
| d10 | **29 Sep 2027** | **0.2 % — NEW MOON NIGHT** | 18:40 | **Moab / Arches (IDSP 2019)** |
| d11 | 30 Sep 2027 | **1.9 %** | 19:09 | **Canyonlands (Gold Tier) + Dead Horse Point (IDSP)** |
| d12 | 1 Oct 2027 | 6.2 % | 19:42 | Durango |
| d13 | 2 Oct 2027 | 12.4 % | 20:18 | Durango |

Astronomical darkness on the new-moon night at Mesa Arch/Canyonlands (30 Sep 2027):
**20:31 – 05:46 MDT** — over **9 hours** of fully dark sky, moonless.

**Window B — the dark run is trip days 6–12 (15–21 Sep 2028)**

| Trip day | Night of | Illum @ midnight | Moonset (MDT) | Where the itinerary is |
|---|---|---|---|---|
| d6 | 15 Sep 2028 | 9.4 % | 17:28 | **Page / Antelope Canyon** |
| d7 | 16 Sep 2028 | **3.6 %** | 18:02 | **Monument Valley** |
| d8 | 17 Sep 2028 | **0.6 %** | 18:34 | **Natural Bridges (world's 1st IDSP)** |
| d9 | **18 Sep 2028** | **0.5 % — NEW MOON DAY** | 19:06 | **Moonscape / Hanksville → Moab** |
| d10 | 19 Sep 2028 | **3.5 %** | 19:38 | **Arches (IDSP 2019)** |
| d11 | 20 Sep 2028 | 9.2 % | 20:14 | **Canyonlands + Dead Horse Point** |
| d12 | 21 Sep 2028 | 17.1 % | 20:55 | Durango |

Astronomical darkness at Canyonlands on 20 Sep 2028: **20:47 – 05:37 MDT**, with the moon
(9.2 %) setting at 20:14 — clean.

**Both windows are close to ideal, and this is not a differentiator.** Both land the new moon
in the middle of the Utah dark-sky block, and both give 5–6 consecutive nights below 10 %
illumination across Natural Bridges, Arches, Canyonlands and Dead Horse Point.

Two small distinctions:
1. **Window A** puts the new moon on the **Moab nights (d9–d11)**, so the Gold-Tier Canyonlands
   and Dead Horse Point nights fall at **1.9 %** illumination — the darkest possible pairing
   with the two best-certified sites.
2. **Window B** puts the new moon on the **Natural Bridges night (d8, 0.6 %)** — the world's
   first and one of the darkest IDSPs — with Canyonlands slipping to **9.2 %** and a moon
   that does not set until 20:14, 33 minutes before astronomical dark begins.
   **Slight edge: Window A.**

**Milky Way core note (computed context):** by late September the galactic core sets in the
early evening; by mid-October it is essentially gone from the evening sky at these latitudes.
GAP: **exact galactic-core set times for these dates were not computed.** If core-over-arch
compositions matter, **Window B (10–20 Sep) is the better half of September** for it. Verify
with a planetarium tool before committing.

**Yellowstone/Teton nights are bad in both windows.** Window A d21–d25 run **83 %→100 %**
illumination (full moon 15 Oct); Window B d21–d25 run **95 %→98 %** (full moon 3 Oct). Neither
window offers Teton astrophotography. Non-differentiator.

---

## 9. Crowd levels — actual NPS visitation, not opinion

Monthly **recreation visits**, pulled from the NPS IRMA Visitor Use Statistics service
(https://irmaservices.nps.gov/v3/rest/stats/visitation — the public API behind
https://irma.nps.gov/STATS/). "Oct/Sep" is October as a percentage of September.

| Park | Year | Jul | Aug | **Sep** | **Oct** | Oct/Sep |
|---|---|---|---|---|---|---|
| **Yellowstone** | 2023 | 969,692 | 846,389 | **838,458** | **299,127** | **36 %** |
| | 2024 | 992,352 | 868,259 | **852,435** | **346,025** | **41 %** |
| | 2025 | 975,109 | 881,936 | **839,579** | **313,959** | **37 %** |
| **Grand Teton** | 2023 | 707,359 | 682,600 | **602,607** | **240,943** | 40 % |
| | 2024 | 772,800 | 701,711 | **579,139** | **270,892** | 47 % |
| | 2025 | 787,186 | 735,593 | **617,970** | **281,020** | 45 % |
| **Zion** | 2023 | 561,026 | 458,449 | 491,799 | **504,584** | **103 %** |
| | 2024 | 546,452 | 470,995 | 506,117 | **517,501** | **102 %** |
| | 2025 | 529,798 | 476,657 | 475,492 | **504,122** | **106 %** |
| **Bryce Canyon** | 2023 | 343,627 | 310,367 | 367,425 | 284,766 | 78 % |
| | 2024 | 319,540 | 300,280 | 366,719 | 272,988 | 74 % |
| | 2025 | 234,414 | 230,476 | 265,048 | 202,248 | 76 % |
| **Arches** | 2023 | 165,671 | 144,080 | 174,673 | 140,260 | 80 % |
| | 2024 | 156,052 | 143,726 | 148,366 | 135,716 | 91 % |
| | 2025 | 158,207 | 150,262 | 142,337 | **158,262** | **111 %** |
| **Canyonlands** | 2023 | 72,734 | 64,707 | 99,439 | **101,576** | **102 %** |
| | 2024 | 70,592 | 65,386 | 105,723 | 96,428 | 91 % |
| | 2025 | 66,388 | 61,026 | 100,997 | 87,556 | 87 % |
| **Capitol Reef** | 2023 | 113,890 | 103,047 | 174,351 | 171,042 | 98 % |
| | 2024 | 127,118 | 114,322 | 201,326 | 197,115 | 98 % |
| | 2025 | 122,287 | 110,159 | 182,374 | 181,747 | 100 % |
| **Glen Canyon NRA (Page)** | 2024 | 592,799 | 469,689 | 448,687 | 311,100 | 69 % |
| | 2025 | 479,862 | 419,144 | 310,766 | 300,097 | 97 % |
| **Natural Bridges NM** | 2024 | 6,774 | 4,758 | 9,798 | 9,727 | 99 % |
| | 2025 | 3,788 | 4,327 | 9,599 | 9,352 | 97 % |
| **Mesa Verde** | 2024 | 80,791 | 65,889 | 61,676 | 48,655 | 79 % |
| | 2025 | 78,589 | 62,596 | 55,614 | 48,708 | 88 % |

**What the data actually says:**

1. **Yellowstone and Grand Teton empty out in October — by roughly 60 %.** This is the single
   largest, best-evidenced advantage of Window A anywhere in this document. Three consecutive
   years show October at **36–41 %** of September at Yellowstone and **40–47 %** at Grand
   Teton. Window A's Yellowstone block (8–13 Oct) sits in that low-traffic regime; Window B's
   (28 Sep – 3 Oct) straddles the busiest month.
   **Caveat:** October's monthly total is depressed by the road closures from ~1 November, so
   the true early-October figure is higher than the monthly mean implies. The direction of
   the effect is not in doubt; the magnitude at 8–13 October specifically is unverified.
2. **The Utah parks do not empty out.** Zion is **busier** in October than September in every
   year measured (102–106 %). Canyonlands and Capitol Reef are flat (87–102 %). Arches was
   **111 %** in 2025. **Shifting the Utah block ten days later buys essentially nothing in
   crowd terms.** Both windows face the same Utah crowds.
3. **Bryce is the one Utah park where October is quieter** (74–78 % of September) — a small
   point for Window A.
4. **Mesa Verde** (optional trip day 13) is 79–88 % in October — mildly quieter.

### 9.1 Shuttles and access systems (identical or near-identical in both windows)

- **Zion Canyon shuttle is mandatory in both windows.** "During the shuttle season, visitors
  **cannot drive personal vehicles on the Zion Canyon Scenic Drive**. This includes before
  shuttles start for the day and after they stop running." Published schedule blocks:
  **May 17 – September 12**, **September 13 – October 24**, **October 25 – November 28**.
  Window A (21–22 Sep) and Window B (11–12 Sep) fall in *different* schedule blocks — Window
  B's Zion days land on 11–12 Sep, i.e. the **last days of the peak summer block**.
  Source: https://www.nps.gov/zion/planyourvisit/zion-canyon-shuttle-system.htm
- **Bryce Canyon shuttle** runs "April through **mid-October**", with schedule blocks
  **May 9 – September 20/21** and **September 21/22 – October 18**. Window A's Bryce days
  (23–24 Sep) and Window B's (13–14 Sep) are both covered.
  Source: https://www.nps.gov/brca/planyourvisit/shuttle.htm
- **Arches timed entry:** the current NPS Arches "Operating Hours & Seasons" page makes **no
  mention of a timed-entry or reservation requirement** — it says only "Arches National Park
  is normally open year-round, 24 hours a day. Fees apply. The park is very busy between
  March and October. To avoid traffic, we recommend entering the park **before 8 am or after
  3 pm**." (page last updated April 18, 2025), and no timed-entry page exists in the
  `/arch/planyourvisit/` URL set. Source: https://www.nps.gov/arch/planyourvisit/hours.htm
  **GAP: whether a timed-entry pilot will be in force in 2027 or 2028 is unknowable now.**
  This affects both windows identically; recheck ~12 months out.

### 9.2 Seasonal service closures — a real Window A cost

**Yellowstone lodging, "typical season" per NPS** —
https://www.nps.gov/yell/planyourvisit/lodging.htm

| Lodge | Typical season | Window A (8–13 Oct) | Window B (28 Sep – 3 Oct) |
|---|---|---|---|
| **Grant Village Lodge** | late-May – **early-October** | **likely CLOSED** | open |
| **Lake Yellowstone Hotel & Cabins** | mid-May – **early-October** | **likely CLOSED** | open |
| **Lake Lodge Cabins** | early-June – **early-October** | **likely CLOSED** | open |
| **Old Faithful Lodge Cabins** | early-May – **early-October** | **likely CLOSED** | open |
| **Old Faithful Inn** | May – **mid-October** | borderline | open |
| **Canyon Lodge & Cabins** | mid-May – **late-October** | open | open |
| **Old Faithful Snow Lodge** | year-round (short closure Mar–Apr) | open | open |
| **Mammoth Hot Springs Hotel** | year-round (short closure Mar–Apr) | open | open |
| **Roosevelt Lodge Cabins** | early-June – **early-September** | closed | **closed** |

> **The `BRAINSTORM.md` Shape-A itinerary sleeps at "Old Faithful / Grant" on trip day 21 and
> "Canyon" on day 22. In Window A, Grant Village, Lake Hotel, Lake Lodge and Old Faithful
> Lodge Cabins are all past their typical closing date.** Window A's in-park options collapse
> to Old Faithful Inn (borderline), Old Faithful Snow Lodge, Canyon Lodge and Mammoth.
> Window B has the full set. Both windows lose Roosevelt Lodge.

**Grand Teton facilities** — https://www.nps.gov/grte/planyourvisit/hours.htm
- Craig Thomas Discovery & Visitor Center closes **October 31** — open in both windows.
- **Jenny Lake Visitor Center closes October 12** — open in both, but only just in Window A
  (trip day 20 = 9 Oct).
- **Jenny Lake Campground closes September 27** — closed in Window A, and closes the day
  *before* Window B's Teton arrival (28 Sep). Effectively closed in both.
- **Gros Ventre Campground closes October 10** — closed for Window A's Teton days (8–9 Oct
  is inside, 10 Oct is the last day); open in Window B.
- Another listed facility closes **September 30**, another **September 20**, another
  **September 13** — GAP: **the facility names could not be reliably paired with the dates**
  from the scraped page layout. Re-read https://www.nps.gov/grte/planyourvisit/hours.htm
  directly before booking.

**Yellowstone construction delays (2026 pattern, indicative only):** "expect up to 15-minute
delays, **August 25 through November**"; a bridge project with "**up to 15-minute delays**,
24 hours a day, seven days a week, from April 13 through **late October**", plus "**five full
nighttime closures (9 p.m.–4 a.m.)** … after September 7"; another segment "up to 30-minute
delays through November." Source: https://www.nps.gov/yell/planyourvisit/parkroads.htm
GAP: 2027/2028 construction schedules do not exist yet.

---

## 10. Consolidated GAP list

- **GAP:** Colorado Tourism Office official fall-colour report — colorado.com returns HTTP 403
  to every user agent attempted; page unreadable.
- **GAP:** Named public webcam URLs for Red Mountain Pass, Kebler Pass or the Ouray
  amphitheatre — only the COtrip index (https://www.cotrip.org/) verified, not individual
  camera IDs.
- **GAP:** Year-by-year historical peak-date table for any San Juan sub-region — the USFS
  report page explicitly does not publish one.
- **GAP:** NPS / Yellowstone Wolf Project guidance naming specific Lamar Valley pullouts and
  stating whether October beats late September — not found on any reachable nps.gov page.
- **GAP:** Autumn wolf pack locations / rendezvous sites for 2027–2028 — unknowable now.
- **GAP:** Yellowstone Bear Management Area autumn closure dates — five nps.gov URL patterns
  all returned 404.
- **GAP:** Pronghorn, bighorn and Grand Teton moose rut dates — no authoritative source
  verified. Do not assert.
- **GAP:** Kayenta AZ stations USC00024578 / USC00024580 return no NCEI normals; Bluff UT
  (335 m lower) used as the Monument Valley proxy — real MV overnight lows will be colder.
- **GAP:** West Yellowstone MT (USC00248857) and Yellowstone Canyon RS (USC00489900) return no
  NCEI normals. Gardiner MT publishes temperature but not precipitation/snow normals.
  Breckenridge USC00050909 publishes snow but not temperature normals.
- **GAP:** Exact coordinates for West Mitten, East Mitten and Merrick Butte — Nominatim has
  no entries, Wikipedia's Merrick Butte coordinate is inconsistent with the visitor-centre
  position, Overpass API timed out. **The Monument Valley bearings in §6.2 are unreliable.**
- **GAP:** Capitol Reef and Bryce Canyon International Dark Sky Park certification years —
  nps.gov night-sky pages not reachable.
- **GAP:** Galactic-core set times for the specific dates — not computed.
- **GAP:** Kebler Pass (Gunnison CR 12) exact winter-closure date.
- **GAP:** Yankee Boy Basin road seasonal closure date.
- **GAP:** WYDOT historical October closure statistics for Togwotee Pass.
- **GAP:** Whether Arches timed entry will be in force in 2027/2028.
- **GAP:** Grand Teton facility-name-to-closing-date pairing for the 20 Sep / 30 Sep /
  13 Sep entries on the NPS hours page.
- **NOTE, not a gap:** all NPS road and lodging season dates quoted are the **2026** published
  schedule. NPS publishes the following year in winter. The *pattern* is stable
  (Dunraven/Beartooth mid-October, everything else 31 October, park roads close to regular
  vehicles early November) but the exact 2027/2028 dates must be re-verified.

---

## 11. RECOMMENDATION

### **Choose Window B — 10 September to 4 October 2028.**

The decision does not rest on preference. Three findings are hard enough to decide it on
their own, and two of them are binary rather than marginal.

**1. Dunraven Pass and the Beartooth Highway close on ~12 October.** NPS published
"Open May 22 – **October 12**" for both. Window A needs Dunraven on **11–12 October 2027** —
the exact closing date. That is not a weather risk, it is a **scheduled closure the itinerary
collides with**. Window B clears it by ten days.
https://www.nps.gov/yell/planyourvisit/parkroads.htm

**2. Grand Prismatic Overlook does not work in Window A.** Computed: on 10 Oct 2027 the sun
**never rises above 38.7°** at the overlook — it does not reach 40° at any point in the day.
On 30 Sep 2028 it is above 40° for 2.2 hours. Compound that with Old Faithful running
**5.2 °F / 2.9 °C colder** in Window A (NOAA normals) and therefore steamier, and the single
most photographed thermal feature in the park is materially degraded. This is a physical
constraint that no amount of good weather fixes.

**3. Colorado aspens.** USFS: aspens "usually peak near the end of September to early
October", starting mid-September at the highest elevations. Window B puts the entire Colorado
block (21–26 Sep 2028) inside that peak at every elevation on the route. Window A (1–6 Oct
2027) lands in the tail, and **the two highest stops — Red Mountain Pass at 11,018 ft and
Breckenridge at 9,600 ft — are the two most likely to be bare.** The Million Dollar Highway
in gold is one of the three or four reasons this trip exists.
https://www.fs.usda.gov/r02/sanjuan/conditions/sjnf-fall-colors-report

**Supporting, in the same direction:**
- **Snow risk roughly doubles.** Derived from NOAA 1991–2020 daily normals: chance of at least
  one measurable-snow day is **37 % vs 21 %** on the Silverton/Red Mountain Pass leg, and
  **48–61 % vs 33–43 %** across the Yellowstone leg.
- **Four Yellowstone lodges are past their typical closing date in Window A** — Grant Village,
  Lake Yellowstone Hotel, Lake Lodge and Old Faithful Lodge Cabins. The itinerary's day-21
  base ("Old Faithful / Grant") is not bookable as written.
  https://www.nps.gov/yell/planyourvisit/lodging.htm
- **Elk rut.** NPS: "early September to mid-October". Window B is in the core; Window A is in
  the last week.
- **Antelope Canyon beams.** Window B gives 61 % more time above 50° solar altitude and a full
  hour above 55°, which Window A never reaches.
- **Longer days.** Window B has ~28 more minutes of daylight in Utah and ~34 more in Wyoming —
  material on a 25-day trip with sunrise and sunset shoots on ten of them.

### What choosing Window B costs you — be honest about it

These are real and they are not trivial:

1. **Yellowstone and Grand Teton crowds, and this is the big one.** NPS visitation shows
   October at **36–41 % of September** at Yellowstone and **40–47 %** at Grand Teton, three
   years running. Window B's Yellowstone block sits in the busy regime; Window A's sits in the
   quiet one. **Window B trades solitude for reliability.** Mitigation: Window B's Yellowstone
   dates (28 Sep – 3 Oct) are the *last* days of September and the first of October, i.e. the
   leading edge of the drop, not the peak of the crush. Be at Lamar by 06:35 and at Grand
   Prismatic before 11:30.
2. **Utah is 4–5 °F / 2.3–2.8 °C hotter throughout.** Moab **88.2 °F / 31.2 °C** vs
   **84.1 °F / 28.9 °C**; Zion **91.1 °F / 32.9 °C** vs **87.3 °F / 30.7 °C** (NOAA normals).
   Angels Landing, Devils Garden and the Delicate Arch hike are all meaningfully harder in
   Window B. **Start every Utah hike at first light.**
3. **Ten more days of monsoon season.** Antelope Canyon on **15 Sep 2028** has 15 days left of
   the official 15 Jun – 30 Sep monsoon; **25 Sep 2027** has 5. Given the 1997 Lower Antelope
   flood killed eleven people from rain falling 7 miles upstream, this is a genuine safety
   delta, not a comfort one. It also slightly raises the odds of losing the Hanksville
   bentonite roads. https://www.weather.gov/fgz/MonsoonInfo
4. **Oxbow Bend and Schwabacher.** Window A's colder mornings (Moran mean low **26.8 °F /
   −2.9 °C**) are more likely to give dead-calm water and river mist. Window B is warmer and
   more likely breezy.
5. **Bryce amphitheatre alignment.** Window A's sunrise azimuth is **exactly 90.0°**, dead on
   the east-facing bowl; Window B rises at 85.4°, slightly north of the axis. Marginal, but
   Window A genuinely wins this one shot.
6. **A slightly less perfect Canyonlands dark-sky night.** Window A puts the new moon on the
   Moab nights, giving Gold-Tier Canyonlands and Dead Horse Point at **1.9 %** illumination.
   Window B gives Natural Bridges at 0.6 % but Canyonlands at **9.2 %** with a moon that sets
   only 33 minutes before astronomical dark. Both are excellent; A is fractionally better.
7. **A second consecutive year of a major trip** — Iceland Sep 2027 then USA Sep 2028. That is
   a scheduling and budget cost, not a trip-quality one, and it is outside this lane's remit.

### If 2027 is immovable and Window A must be used

Four changes make Window A survivable:
- **Reverse the Yellowstone sub-order** so Lamar/Tower is reached before 12 October, or plan
  the Canyon→Mammoth leg via Norris and treat Dunraven as a bonus.
- **Move Grand Prismatic Overlook to 11:30–14:00 sharp** and accept that 38.7° is what you get;
  consider substituting the Fairy Falls trail view or dropping it for Midway boardwalk.
- **Book Mammoth Hot Springs Hotel and Canyon Lodge** — they are the only two in-park options
  reliably open on 10–13 October.
- **Drop Breckenridge to a drive-through** and put the Colorado colour budget entirely on the
  Ouray–Silverton–Telluride corridor at 7,800–9,300 ft, which holds colour ~10 days longer
  than Red Mountain Pass or Summit County.
