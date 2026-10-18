# Utah five parks: suitability and relevance research log (lane R5)

Researched 18 Oct 2026 by travel-researcher (Opus), one pass for both specs (suitability-applicability.md 8.3).
Files written:

- `data/suitability/utah-five-parks/R5.json` (suitability/1, 21 records, 51 sources)
- `data/relevance/utah-five-parks/R5.json` (relevance/1, 21 records, same sources table)
- `data/suitability/kind-map.json`: six Utah entries reclassified (below)

Every value carries a source id, a read date (18 Oct 2026), a state and a basis. All facts are 2026 pages used
as a pattern; nothing is dated for a trip year. No AllTrails, Google, Tripadvisor or other link-only source was used.
No Commons search was made. Wikidata was used only for entity search and entity reads (sequential, with a
project User-Agent).

## 1. What was checked

| Land manager or operator | Pages opened (all 18 Oct 2026) |
|---|---|
| NPS Zion | thenarrows, angels-landing-hiking-permits, accessibility, conditions (updated 16 Sep 2026), zion-canyon-shuttle-system, zion-canyon-trail-descriptions (trail list did not render), thingstodo pages for Pa'rus, Riverside Walk and West Rim to Scout Lookout, 2013 red-roads release |
| NPS Bryce Canyon | day-hikes, qgnavajocombo, queensgarden (did not render), accessibility, viewpoints, shuttle, conditions (alerts did not render) |
| NPS Capitol Reef | trailguide, places/fruita-orchards, historyculture/orchards (updated 22 Jul 2026), accessibility. hikingtrails.htm and planyourvisit/orchards.htm return 404 |
| NPS Arches | physical-mobility, places/wolfe-ranch-trailhead, delicate-arch, places/delicate-arch-viewpoints, places/devils-garden-trailhead, places/the-windows-section-trailhead, conditions (updated 18 Mar 2026), hiking (trail list did not render) |
| NPS Canyonlands | hiking, places/mesa-arch, places/upheaval-dome-overlook-trails, places/grand-view-point, physical-mobility, accessibility, islandinthesky, the Sep 2025 Mesa Arch news release |
| BLM Utah | Lower Calf Creek Falls trail page, the trail brochure PDF (text extracted), the Jun 2025 rockfall warning |
| Utah State Parks | Dead Horse Point main page and fees; Goblin Valley main page, hiking and rappelling, fees. The Dead Horse overlook page (`?p=11460`) and both brochure PDFs return 404 to the fetcher; the overlook wording was read from the search result text and is marked so |
| Temple Square | templesquare.org, churchofjesuschrist.org parking and directions page, Church News 2 Oct 2026 |
| Moab | no official page on Main Street access was found; Lonely Planet (press, via search result) only |
| Water temperature | USGS 09405500 (North Fork Virgin River near Springdale) has no temperature statistics in the stat service; Zion Guru (a Springdale outfitter) is the only figure |

## 2. What was found, record by record

Kind changes (in `kind-map.json`, with a reason on each):

| Record | From | To | Why |
|---|---|---|---|
| Narrows from the Temple of Sinawava | trail/hike | trail/**river_hike** | lane note and B1: a hike in the river, closed above 150 cfs |
| Pa'rus Trail | trail/hike | trail/walk | paved, 46 m gain, typical grade 2.6% |
| Riverside Walk | trail/hike | trail/walk | 1.6 km one way, concrete, NPS "easy" |
| Mesa Arch | trail/hike | trail/walk | 1 km, 17 m (B16 limits met) |
| Upheaval Dome | trail/hike | trail/walk | 1 km, 35 m to the first overlook |
| Windows section | trail/hike | trail/walk | 1.6 km loop, 30 m |

Per-record notes (suitability):

- **Narrows (river_hike).** NPS gives only the Big Spring turnaround: 10 mi (16.1 km) round trip, "strenuous", "all-day". No gain is published (searched_none). Closed above 150 cfs, during a Flash Flood Warning and for at least 2 h after; cyanobacteria advisory; hypothermia named. NPS gives no water temperature. The only figure is the outfitter's (fall 5-12 C, winter 3-7 C), kept as `community`. The usual Wall Street / Orderville turnaround (about 9.7 km) has no official figure, so it is in the kid note only, not in the drivers.
- **Angels Landing chains view or Scout Lookout.** Scout Lookout needs no permit. Two NPS pages disagree on distance and gain (conflict, below). Restrooms at Scout Lookout, no water. The permit and the chain section are outside this record.
- **Pa'rus.** 93.6% paved, 6.4% decking, max grade 11.4%. Wheelchair is `partial`: the Zion accessibility page says "with assistance" while the trail page says "accessible for wheelchairs" (conflict kept). Bikes and leashed dogs allowed.
- **Riverside Walk.** 100% concrete, max grade 25.9%, minor drop-offs. Wheelchair-friendly "at the visitor's own discretion" (partial). NPS's gain and loss (154.2 ft / 48.5 ft) are the same numbers as its Canyon Overlook page; likely an NPS copy error, kept as published with a note.
- **Zion Canyon Scenic Drive.** 6 mi; shuttle-only in shuttle season; round trip about 90 min. Strollers ride on the bus's front bike rack, loaded by the visitor. Pets not allowed on the shuttle.
- **Navajo Loop and Queen's Garden.** 4.6 km, 191 m, 2-3 h. The combination page says Moderate, the day-hikes page now lists it under Strenuous (conflict). The Navajo Loop closed fully after spring 2026 mudslides (KUTV); NPS alerts did not render, and no reopening was found. Recorded as `limited` access with the park phone.
- **Bryce amphitheatre rim / Sunset Point.** Only the half mile between Sunset and Sunrise Points is wheelchair accessible. Sunset Point: paved, level, 494 ft (150 m) from the lot (step_free, official). No railing information on any NPS page read.
- **Lower Calf Creek Falls (BLM).** 6.0 mi (9.7 km) round trip, 3-4 h, "moderately difficult due to sandy sections", "elevation change ... minimal" with no figure (gain searched_none). $5 per vehicle. Rockfall warning at the falls (Jun 2025). BLM calls it "one of the most well known and unique features" of the monument.
- **Hickman Bridge.** 0.9 mi (1.4 km) one way, 400 ft (122 m), Moderate. An NPS release (via search) says 2 mi round trip (conflict). The top of the bridge is closed to the public. Trailhead parking often full 9 am to after 4 pm.
- **Fruita orchards.** Harvest windows from the 22 Jul 2026 orchards page; fenced orchards 09:00-17:00, unfenced dawn to dusk; ladders and pickers provided; no tree climbing; fruit hotline option 5. Orchard surfaces and access are not published.
- **Delicate Arch.** Wolfe Ranch page: 3 mi (4.8 km), 538 ft (164 m), Strenuous. The accessibility page gives 3.2 mi (5.1 km); the park page gives 480 ft (146 m) (both kept as conflicts). Last 200 yd on a narrow ledge with a drop-off; no shade, no water. Lower Viewpoint is level and wheelchair accessible.
- **Devils Garden.** Recorded as the Double O Arch out-and-back (the plan's choice): 4.0 mi (6.4 km), 275 ft (84 m), Strenuous, narrow ledges with steep drop-offs past Landscape Arch. Landscape Arch alone is Easy (2.9 km, 12 m). Drinking water spring to fall, toilets year-round.
- **Windows section.** 1 mi (1.6 km), 99 ft (30 m), Easy; first 300 ft barrier free.
- **Mesa Arch.** 0.6 mi (1 km), 56 ft (17 m), Easy, not wheelchair accessible. NPS gives no cliff-edge or railing wording; exposure is our judgement.
- **Upheaval Dome.** First overlook 0.6 mi (1 km), Moderate; gain 115 ft on the place page, 100 ft on the hiking page (conflict); time 1 h against 30 min (conflict).
- **Grand View Point.** The overlook is wheelchair accessible (physical-mobility page); the trail beyond is not. Walk length to the overlook not stated (searched_none).
- **Dead Horse Point.** $20 per private vehicle, no entry reservation; open 06:00-22:00. Overlook: a short paved ADA path, about 200 ft one way (search-result text of the park page, which 404s). A 2023 brochure (search result) says most overlooks are not fenced.
- **Goblin Valley (area).** $20 per vehicle, valid to 22:00 the day after purchase; 06:00-22:00; heat and flash-flood warnings; the Third Valley needs navigation. No rule on climbing the formations on the pages read.
- **Main Street Moab.** Only a press guide says Main Street is easy by wheelchair. Recorded as stroller `smooth` (community) and wheelchair `partial` (our judgement).
- **Temple Square.** Wheelchair access to all facilities except the Beehive House; gates 07:00-22:00; the Conference Center (where wheelchairs are lent) is closed until March 2027; the 2027 temple open house runs 5 Apr to 1 Oct.

## 3. Hard limits

No hard limit (age, height, weight, adult ratio, group minimum) applies to any of the 21 records. Every record is self-guided. `group_min` is `searched_none` on the six hikes: NPS and BLM publish group maximums for permits, never a minimum.
Rules seen but outside these records: the Angels Landing permit (beyond Scout Lookout; group of up to 6 on one application), and the Fiery Furnace (no children under 5; under-13s with an adult). Neither is in scope.

## 4. Conflicts

Kept in the data (none averaged, none resolved by picking):

| Record | Field | Value | Conflict |
|---|---|---|---|
| Scout Lookout | distance | 6.1 km (1.9 mi one way, Scout Lookout page) | 7.2 km (2.25 mi one way, permit page) |
| Scout Lookout | gain | 362 m (1187 ft) | 305 m (1000 ft, permit page) |
| Pa'rus | distance | 5.6 km end to end | 2.5 km one way (same page's accessibility table) |
| Pa'rus | wheelchair | partial ("with assistance") | step_free ("accessible for wheelchairs") |
| Navajo and Queen's Garden | grade | Moderate (combination page) | Strenuous (day-hikes page) |
| Hickman Bridge | distance | 2.9 km (0.9 mi one way) | 3.2 km (2 mi round trip, NPS release) |
| Delicate Arch | distance | 4.8 km (3 mi) | 5.1 km (3.2 mi, accessibility page) |
| Delicate Arch | gain | 164 m (538 ft) | 146 m (480 ft, park page) |
| Upheaval Dome | gain | 35 m (115 ft) | 30 m (100 ft, hiking page) |
| Upheaval Dome | time | 60 min | 30 min (hiking page) |

Resolved: the old research file said the Narrows water is 3-7 C from 1 October. The outfitter's current page says fall (October-November) is 5-12 C and 3-7 C is winter. The current page is the value. The 2026 Angels Landing spring lottery window moved from 13-25 Feb (old file) to 1-20 Jan (current page); outside this record.

Still open, with no conflict stored: the Navajo Loop status (closed in spring 2026, no reopening found); Riverside Walk gain (looks copied from Canyon Overlook).

## 5. Applicability questions (fields that may be marked wrongly)

1. **`stroller_on_board` is N on the `drive` profile.** The Zion Canyon Scenic Drive is seen only from the shuttle for most of the year, and NPS has a stroller rule (load it on the front bike rack yourself). The rule exists and decides the day for a family. Suggest A on `drive`, or a `shuttle` subkind.
2. **`ext.drive.vehicle_limits` cannot say "no private vehicles".** For a shuttle-only road the honest value is a ban, not a size. Stored as `{}` with a note. Suggest a `private_vehicles: banned | seasonal | ok` member.
3. **`water_safety.water_temp_c` is one range.** River water varies by season (5-12 C in fall, 13-20 C in summer, 3-7 C in winter). A by-month form, like `class_at_level`, would hold it.
4. **Area designations and the relevance kind.** Goblin Valley is suitability `sight`/`park` (the area profile), but relevance accepts an `own` area designation only when the relevance `kind` is `park`, `region` or `protected_area`. The relevance record uses `kind: park`. The two specs should share one rule.
5. **`hazards` is A, not R, on `viewpoint`.** The rim viewpoints (Dead Horse, Grand View, Sunset Point) have unfenced drops; it is captured under `exposure`, which is enough, so this is a note, not a request.
6. **`walk` has no `hazards` as R and no `ext.trail.navigation` as R.** Fine for these walks.

## 6. Operator questions (owner question Q14, to send by email or phone)

| # | To | Contact (from the page read) | Question |
|---|---|---|---|
| 1 | Bryce Canyon NP | 435 834-5322 (conditions page) | Has the Navajo Loop (Two Bridges side) reopened after the spring 2026 mudslides, and is a reopening date set? Are there railings at Sunset Point and on the paved rim between Sunset and Sunrise Points? |
| 2 | Zion NP | park information line on nps.gov/zion (not read) | The Riverside Walk page gives 154.2 ft gain and 48.5 ft loss, the same as the Canyon Overlook page: is that correct? Which distance to Scout Lookout is current, 1.9 mi or 2.25 mi? Does the park publish any Virgin River water temperature for the Narrows? |
| 3 | Arches NP | 435-719-2299 (park line, from the earlier research file) | Is the Delicate Arch gain 480 ft or 538 ft, and the distance 3.0 or 3.2 mi? |
| 4 | Canyonlands NP | park line on nps.gov/cany (not read) | Upheaval Dome first overlook: 100 ft or 115 ft, 30 min or 1 h? How long is the paved walk to the Grand View Point overlook, and is there a railing at Mesa Arch? |
| 5 | Capitol Reef NP | (435) 425-3791 | Hickman Bridge: 0.9 mi one way or 2 mi round trip? Can strollers or wheelchairs use the orchard paths? |
| 6 | BLM, Lower Calf Creek | contact on blm.gov/visit/lower-calf-creek-falls-trail (not read) | What is the elevation gain to the lower falls? |
| 7 | Dead Horse Point SP | 435-259-2614 (visitor center) | Is the main point fenced? The park's overlook page and brochures return 404 to us; is there a current page for the overlook path? |
| 8 | Goblin Valley SP | visitor center line on stateparks.utah.gov (not read) | May visitors climb on the goblins? Is the America the Beautiful pass accepted? |
| 9 | Temple Square | (801) 353-3355, templesquare@churchofjesuschrist.org | While the Conference Center is closed, where are wheelchairs lent? Are strollers allowed in the Tabernacle and Visitors' Center? |

## 7. Relevance pass

QIDs were confirmed by description and coordinates; 19 of 21 have a QID, 2 are `searched_none` (Pa'rus Trail, the Windows section, whose arches have their own items). Where the record is a trail to a feature, the QID is the feature's (the arch, the canyon), with the trail item named in the note. `draw_suggested` is not meaningful yet: `relevance.ts signals --fetch` has not run, so the derived file suggests from designations only.

Classes proposed for `data/vocab/relevance-classes.json` (not used in the JSON):
- `arch/natural-arch` for Delicate Arch, Devils Garden, Windows, Mesa Arch, Hickman Bridge (now `trail/lookout`).
- `canyon/hoodoo-amphitheatre` for the Bryce rim, Sunset Point and the Navajo and Queen's Garden walk (now `canyon/desert-rim`).
- `park/desert-badlands` for Goblin Valley (now `sight/landmark`).
- `town/gateway` for Moab (now `town/historic-village`, which does not fit).

Editorial mentions: none surfaced in this pass (searched_none on every record).

| Record | Draw | Standing | Distinction | Class | Derived role |
|---|---|---|---|---|---|
| Narrows | world | top | unique | canyon/slot-wade | anchor |
| Bryce amphitheatre rim | world | top | unique | canyon/desert-rim | anchor |
| Delicate Arch | world | top | unique | trail/lookout | anchor |
| Scout Lookout | national | top | rare | trail/lookout | anchor |
| Zion Canyon Scenic Drive | national | top | rare | drive/scenic-parkway | anchor |
| Navajo and Queen's Garden | national | top | rare | canyon/desert-rim | anchor |
| Sunset Point | national | top | common | canyon/desert-rim | anchor |
| Devils Garden | national | top | rare | trail/lookout | anchor |
| Grand View Point | national | top | rare | canyon/desert-rim | anchor |
| Dead Horse Point | national | top | rare | canyon/desert-rim | anchor |
| Temple Square | national | top | unique | sight/landmark | anchor |
| Windows section | national | good | rare | trail/lookout | highlight |
| Mesa Arch | national | top | rare | trail/lookout | highlight (clear_only drops it) |
| Lower Calf Creek Falls | regional | top | rare | waterfall/hike-in | highlight |
| Hickman Bridge | regional | top | rare | trail/lookout | highlight |
| Goblin Valley | regional | top | unique | sight/landmark | highlight |
| Riverside Walk | regional | good | common | trail/riverside | filler |
| Upheaval Dome | regional | good | unique | trail/lookout | filler |
| Fruita orchards | regional | good | rare | sight/heritage-site | filler |
| Main Street Moab | regional | good | rare | town/historic-village | filler |
| Pa'rus Trail | local | good | common | trail/riverside | local_only |

Calibration note: 11 anchors out of 21 is a lot for one trip. The vacation rule makes every `national` place with `top` standing an anchor. That is right for Delicate Arch or the Narrows, and generous for Sunset Point or Grand View Point. Look at this in the RV0 calibration step.

## 8. End table: suitability level by record

All 21 are **Usable** (every R field answered); none is Complete. Missing A fields are listed for the next pass.

| Record | Profile | Level | Main A fields still open |
|---|---|---|---|
| Narrows | river_hike | Usable | swim_ability, signal, shade, bail_out, wheelchair |
| Scout Lookout | hike | Usable | signal, bail_out, altitude |
| Pa'rus | walk | Usable | shade, food |
| Riverside Walk | walk | Usable | accessible_toilet detail, shade |
| Zion Scenic Drive | drive | Usable | food, signal, winding |
| Navajo and Queen's Garden | hike | Usable | altitude, signal, shade |
| Bryce amphitheatre rim | viewpoint | Usable | toilets, food |
| Sunset Point | viewpoint | Usable | food, altitude |
| Lower Calf Creek Falls | hike | Usable | signal, bail_out |
| Hickman Bridge | hike | Usable | toilets, water, shade, signal |
| Fruita orchards | sight | Usable | toilets, food, age_band |
| Delicate Arch | hike | Usable | signal, bail_out |
| Devils Garden | hike | Usable | shade, signal, bail_out |
| Windows section | walk | Usable | shade, food |
| Mesa Arch | walk | Usable | toilets, shade |
| Upheaval Dome | walk | Usable | shade |
| Grand View Point | viewpoint | Usable | food, altitude |
| Dead Horse Point | viewpoint | Usable | food, altitude, accessible_toilet |
| Goblin Valley | area | Usable | stroller, wheelchair, water, signal, altitude |
| Main Street Moab | town | Usable | toilets, on_site_min |
| Temple Square | sight | Usable | toilets, food, age_band |

## Gotchas

- `data/suitability/utah-five-parks/migrated.json` now differs from what `migrate` produces, because six kinds changed in `kind-map.json`. It is S0's file, so it was left alone. `migrate --check` reports it. The coordinator should run `migrate --write` (Iceland and Vermont show the same drift from their lanes).
- Several NPS trail-list pages render "Loading results..." to a fetcher (Zion trail descriptions, Arches hiking, Bryce Queen's Garden). Use the per-trail `thingstodo` or `places` pages instead.
- Utah State Parks pages and PDFs often 404 to a fetcher. The Dead Horse overlook facts here come from search-result text of the park's own page, and are marked that way.
- NPS often prints the same figure differently on two pages (distances, gains, grades). The conflicts table lists every case met.
