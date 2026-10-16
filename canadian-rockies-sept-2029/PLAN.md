# Canadian Rockies: Sat 8 to Sat 22 September 2029

14 nights, 15 days, two adults and a child of about 6. Fly Toronto (YYZ) to Calgary (YYC) and back, one rental car, hotels and lodges. National parks (Banff, Yoho, Kootenay, Jasper) and provincial parks (Kananaskis and Peter Lougheed, Mount Robson). Four bases, five check-ins.

Every price, timetable, season and closure here is a 2026 (or older) figure used as a pattern. Nothing for 2029 has been published. GAP means not verified. INFERENCE means my reasoning, not a source. Drive times marked "matrix" come from `data/bases.json`, where the researcher estimated every leg from general road knowledge with no routing source; treat all of them as INFERENCE.

The structured version of this plan is `data/itinerary.json`. The days-per-park evidence and the option arithmetic are in `research-days.md`.

---

## The answer first

**Book 14 nights: fly out Sat 8 Sep, fly home Sat 22 Sep 2029.**

- **How many days.** The full set of parks you asked for takes 12-14 nights at a 6-year-old's pace; 10 is the minimum and 16 is ideal only if Waterton is in (research INFERENCE table; blogs say 11 minimum, 14 ideal for the full loop with Waterton). 14 nights covers everything except Waterton, keeps the long drives to the two Icefields Parkway days, and leaves one swap day in Jasper.
- **Which dates.** 8-22 Sep rather than 1-15 Sep. It skips the Labour Day weekend (Sat 1-Mon 3 Sep 2029) in Banff, and it puts the Larch Valley day (Tue 18) and the Ptarmigan Cirque day (Fri 21) at the edge of larch colour instead of a week before it. It costs one more school day (10 vs 9, INFERENCE), a borderline Moraine canoe, no Kananaskis raft, and colder mornings.
- **Why not shorter.** 12 nights works: drop the Robson day and the Peter Lougheed lakes day. 10 nights deletes every slack day and ends with a 4-5 h drive. 8 nights means no Jasper.
- **The adult-hike requirement.** Seven of the 15 days are split days: one adult does an adult-only hike while the other adult and the child do a family option in the same area, and the plan says where and when you rejoin. Every day also has a low-walking fallback. Each adult gets three or four big hikes.

| Option | Verdict |
|---|---|
| 8 nights | Banff, Lake Louise, Yoho, Kootenay north. No Jasper. Only if school absence must stay at one week. |
| 10 nights | Weakest: Jasper with no slack and a 4-5 h last-day drive, or a one-way fee to Edmonton (GAP). |
| 12 nights | Honest fallback: drop Day 6 (Robson) and Day 13 (Peter Lougheed lakes). |
| **14 nights** | **Recommended.** |
| 16 nights | Adds Waterton (2 nights, two 3 h+ drives). Better in the 1-15 Sep window. |

### The other window: Sat 1 to Sat 15 Sep

Same route, every date seven days earlier. What changes:
- Days 1-3 land on the Labour Day weekend: peak prices and the busiest Johnston Canyon day of the year (Mon 3). Be on the trail by 07:30 or skip it.
- The Moraine canoe should still be running on Day 11, and the Kananaskis River raft (minimum age 5 and 18 kg; 2026 daily 13:30) can replace the morning of Day 14.
- Larches are green everywhere, so Ptarmigan Cirque loses its point; it stays as a good alpine walk.
- About 25 more minutes of daylight a day, warmer nights, early rather than peak elk rut.
- Waterton fits better here if you want it.

---

## Orientation

**What the place is.** The Canadian Rockies are a belt of layered sedimentary rock, mostly limestone and shale, pushed up and stacked by mountain building, then carved by glaciers. Long valleys run north-west to south-east between the ranges, and the highways follow them (general knowledge, not from the research files). The lake colours come from rock flour ground by glaciers and suspended in meltwater (general knowledge).

**Why it is famous, specifically.** Three images: Moraine Lake at sunrise with the Ten Peaks lit from the east (Travel Banff Canada); Lake Louise under the Victoria Glacier; and the Icefields Parkway, 232 km between Lake Louise and Jasper, where a highway runs past a glacier you can walk to the toe of from a car park (icefieldsparkway.com; Parks Canada).

**What you cannot get anywhere else.** A drive-up glacier (Athabasca), a road-accessible Dark Sky Preserve (Jasper), and the Burgess Shale fossil beds in Yoho (the guided hikes are age 8+, so not this trip). In mid to late September, subalpine larches turn gold for about 7-10 days, starting high and working down (several 2026 guides).

**Sub-regions**

| Area | What it is for | Days |
|---|---|---|
| Banff and the Bow Valley (incl. Sunshine Meadows, Johnston Canyon) | First nights at low altitude, Sunshine split day, town, hot springs | 1-3 |
| Kootenay north (Marble Canyon, Paint Pots) | Two short canyon and ochre-bed walks on the move day | 3 |
| Icefields Parkway | Bow Lake, Peyto Lake, the Columbia Icefield; driven once each way with different stops | 4, 8 |
| Jasper and Mount Robson | Maligne Lake, Miette Hot Springs, the highest peak in the Canadian Rockies | 5-7 |
| Lake Louise, Moraine Lake and Yoho | The three headline lakes, each a split day | 9-11 |
| Kananaskis and Peter Lougheed (provincial) | Quieter lakes and the family larch walk at Highwood Pass | 12-14 |

**The trip in numbers**
- 14 nights; 4 bases (Banff, Lake Louise twice, Jasper, Kananaskis Village).
- Driving about 26 h in total, about 1h45 a day on average; the two Parkway days are 175 min non-stop each (matrix) and 7-8 h with stops (INFERENCE).
- Family walking about 47 km over 15 days, about 3.2 km a day; longest family day about 6 km in three short pieces (Day 3) (INFERENCE, sums from `trails.json`).
- Highest family point about 2,385 m (Sunshine's Standish chair top, if it runs; GAP) or about 2,400 m at Ptarmigan Cirque (2,206 m start plus 210 m; INFERENCE arithmetic).
- Longest adult hike: the Iceline, 20.3 km and 1,090 m on one Parks Canada page, 20.8 km and 710 m on another.

**Know before reading the days**
1. **Moraine Lake Road is closed to private cars all year.** You get there on a Parks Canada shuttle from the Park and Ride at the Lake Louise ski resort. In 2026, 40% of seats went on sale on 15 Apr at 08:00 MDT and the rest at 08:00 two days before each date; nearly 40,000 seats sold on opening day.
2. **One car, so split days are drop-and-collect.** The hiking adult is dropped at a trailhead and collected at a stated time and place. That adult hikes alone in grizzly country: bear spray, an agreed turnaround time, and the busiest trail available. On Larch Valley, a legal group-of-four rule may apply.
3. **Bear spray cannot fly**, not even in checked bags (Parks Canada). Buy or rent it on Day 1.
4. **Elk rut.** Mid-September to mid-October is the peak. Stay at least 30 m from all elk (Parks Canada; a Banff wildlife specialist suggests 60 m in rut), never get or park between a bull and cows, and keep the child within arm's reach in Banff and Jasper townsites.
5. **Icefields Parkway: no cell signal, fuel only at Saskatchewan River Crossing** (seasonal, pricier), full toilets only at Lake Louise, Saskatchewan Crossing, the Icefield Centre and Jasper; pit toilets elsewhere.
6. **2026 closures are 2029 unknowns, not facts**: Maligne Canyon (superintendent closure, 8 Oct 2026), Edith Cavell Road and Cavell Meadows (closed for 2026, debris flows), Opal Hills (grizzly closure, 8 Oct 2026), Johnston Canyon (closed from 13 Oct 2026 for rock-slope work), the Upper Kananaskis Lake circuit (grizzly with cubs, 2026), Crypt Lake (no boat access on 12 Oct 2026). Each day says what happens if one of them is still shut.

## Must-do sights

<!-- BEGIN:sights -->
| Sight | Park | Time | Map | Official | Why | Child note | Status |
|---|---|---|---|---|---|---|---|
| **Moraine Lake** | Banff | 3 h | [Map](https://maps.google.com/?q=Moraine+Lake,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise) | Most photographed lake in the Rockies; Rockpile viewpoint and canoes. | Flat lakeshore (1.3 km one way) and Rockpile (0.7 km loop) suit a 6 year old. Shuttle fare tiers for | VERIFIED |
| **Lake Louise** | Banff | 2.5 h | [Map](https://maps.google.com/?q=Lake+Louise,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise) | Iconic Rockies lake; lakeshore walk and Fairview Lookout. | Lakeshore trail 2.3 km one way is easy; stroller-capable surface not verified (GAP). | VERIFIED |
| **Johnston Canyon** | Banff | 2.5 h | [Map](https://maps.google.com/?q=Johnston+Canyon,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Easy catwalk walk with waterfalls; Ink Pots beyond. | Lower Falls 1.1 km one way, 85 m: fine for a 6 year old; exposed catwalks, hold hands. 2026 pattern: | VERIFIED |
| **Peyto Lake Lookout** | Banff | 1 h | [Map](https://maps.google.com/?q=Peyto+Lake+Lookout,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Best easy view on the Icefields Parkway. | 0.6 km one way, 30 m gain; paved to lookout is GAP (not verified). | VERIFIED |
| **Bow Lake** | Banff | 1 h | [Map](https://maps.google.com/?q=Bow+Lake,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/visit/les10-top10/glaciers-icefields) | Roadside lake, picnic, Num-Ti-Jah Lodge. | Bow Glacier Falls trail 3.8 km one way, 95 m (too long for the little one, lakeside strolling is fin | VERIFIED |
| **Vermilion Lakes Drive** | Banff | 1 h | [Map](https://maps.google.com/?q=Vermilion+Lakes+Drive,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/nautiques-sports) | Sunrise/sunset views and elk and bird watching. | Short stops, flat. GAP: no official page fetched for this sight; description is general knowledge. | GAP |
| **Cave and Basin National Historic Site** | Banff | 1.5 h | [Map](https://maps.google.com/?q=Cave+and+Basin+National+Historic+Site,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/lhn-nhs/ab/caveandbasin) | History plus boardwalk walks to marsh. | Good rainy-day child stop. GAP: no official page fetched for this sight; description is general know | GAP |
| **Banff Gondola (Sulphur Mountain)** | Banff | 2 h | [Map](https://maps.google.com/?q=Banff+Gondola+(Sulphur+Mountain),+Banff+National+Park,+Alberta) | [Official](https://www.banffjaspercollection.com/attractions/banff-gondola/) | Big views with almost no walking; replaces the 4.8 km one-way, 655 m Sulphur Mountain trail. | Height requirements: GAP. Private operator, not Parks Canada. | INFERENCE |
| **Lake Minnewanka** | Banff | 2 h | [Map](https://maps.google.com/?q=Lake+Minnewanka,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/nautiques-sports) | Easy lake walk, scenic cruise. | Lake Minnewanka Trail to Stewart Canyon bridge is 1.6 km one way, 30 m. 2026: trail past Stewart Can | VERIFIED |
| **Icefields Parkway (Hwy 93N) scenic drive** | Banff | 6 h | [Map](https://maps.google.com/?q=Icefields+Parkway+(Hwy+93N)+scenic+drive,+Banff+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/banff/visit/les10-top10/glaciers-icefields) | Spine of the trip, with Peyto, Bow Lake, Columbia Icefield, Athabasca and Sunwapta Falls. | Long drive for a 6 year old, plan frequent stops. Gas stations limited: GAP not verified. | INFERENCE |
| **Athabasca Glacier and Columbia Icefield** | Jasper | 2.5 h | [Map](https://maps.google.com/?q=Athabasca+Glacier+and+Columbia+Icefield,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/glaciers-icefields) | Walk to the toe of a glacier you can see from the road. | Toe trail 1.8 km round trip, 60 m: feasible. Do not walk on the ice. Icefield Centre information des | VERIFIED |
| **Sunwapta Falls** | Jasper | 1 h | [Map](https://maps.google.com/?q=Sunwapta+Falls,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/itineraires-itineraries/sunwapta) | Easy roadside falls. | Upper falls viewpoint is short and fenced; Lower Sunwapta Falls trail 2.6 km round trip, 87 m. Trail | VERIFIED |
| **Athabasca Falls** | Jasper | 1 h | [Map](https://maps.google.com/?q=Athabasca+Falls,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/glaciers-icefields) | Very short walk, big water. | 200 m walk, fenced viewpoints; hold hands near canyon edges. Day-use area open per 2026 page. | VERIFIED |
| **Maligne Lake and Spirit Island** | Jasper | 4 h | [Map](https://maps.google.com/?q=Maligne+Lake+and+Spirit+Island,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/itineraires-itineraries/lac-maligne) | One of the most photographed spots in the Rockies. | Cruise requires little walking; life jackets for child supplied by operator: GAP. Maligne Road reope | INFERENCE |
| **Maligne Canyon** | Jasper | 2 h | [Map](https://maps.google.com/?q=Maligne+Canyon,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne) | Normally a top family walk. | CLOSED 2026: Superintendent closure, no public access (2026-10-08 trail conditions) and 'closed unti | VERIFIED |
| **Pyramid Lake** | Jasper | 2 h | [Map](https://maps.google.com/?q=Pyramid+Lake,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/ete-summer/activitesnautiques-wateractivities/plages-beaches) | Easy sunset spot, picnic, boat rental. | Pyramid Bench trails reopened per 2026 page; trailhead open. Lake Annette Loop (2.4 km flat) is near | VERIFIED |
| **Jasper Townsite** | Jasper | 3 h | [Map](https://maps.google.com/?q=Jasper+Townsite,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/itineraires-itineraries) | Town services, dining, base for Maligne and Icefields. | Town stroll. Post-wildfire burn area safety guidance: see Parks Canada page. | INFERENCE |
| **Miette Hot Springs** | Jasper | 3 h | [Map](https://maps.google.com/?q=Miette+Hot+Springs,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/sources-miette-springs) | Soak after hiking; Sulphur Skyline trail nearby. | Miette Hot Springs open per 2026 page. Water temperature for a 6 year old: GAP. | VERIFIED |
| **Mount Edith Cavell and Cavell Meadows** | Jasper | 2 h | [Map](https://maps.google.com/?q=Mount+Edith+Cavell+and+Cavell+Meadows,+Jasper+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/cavell) | Glacier views. | CLOSED 2026: Cavell Road and day-use area closed; trails 41 Path of the Glacier and 42 Cavell Meadow | VERIFIED |
| **Emerald Lake** | Yoho | 2.5 h | [Map](https://maps.google.com/?q=Emerald+Lake,+Yoho+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/places) | Easy flat loop, canoe rental. | Emerald Lakeshore 5.2 km loop, minimal gain, muddy and rooty on east side. | VERIFIED |
| **Takakkaw Falls** | Yoho | 1.5 h | [Map](https://maps.google.com/?q=Takakkaw+Falls,+Yoho+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/places) | Tallest falls on the trip, flat paved walk to base. | 0.9 km one way flat paved path. Yoho Valley Road switchbacks: trailers not allowed GAP. | VERIFIED |
| **Natural Bridge** | Yoho | 0.5 h | [Map](https://maps.google.com/?q=Natural+Bridge,+Yoho+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/places) | Roadside quick stop. | Almost no walking. Parking is about 4 km west of Field on Emerald Lake Road. Distance to bridge: GAP | INFERENCE |
| **Wapta Falls** | Yoho | 2 h | [Map](https://maps.google.com/?q=Wapta+Falls,+Yoho+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/places) | Easy forest walk to a large falls. | 2.2 km one way, 80 m gain: family-friendly per Parks Canada. Eastbound access only from the highway. | VERIFIED |
| **Marble Canyon** | Kootenay | 1 h | [Map](https://maps.google.com/?q=Marble+Canyon,+Kootenay+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/kootenay/activ/places) | Short, easy, high impact. | 0.9 km one way, 65 m. Fenced bridges. | VERIFIED |
| **Paint Pots** | Kootenay | 1 h | [Map](https://maps.google.com/?q=Paint+Pots,+Kootenay+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/pn-np/bc/kootenay/activ/places) | Easy flat walk; Indigenous cultural site. | 1 km one way, 35 m. Good for 6 year old. | VERIFIED |
| **Radium Hot Springs** | Kootenay | 3 h | [Map](https://maps.google.com/?q=Radium+Hot+Springs,+Kootenay+National+Park,+British+Columbia) | [Official](https://parks.canada.ca/hotsprings/) | Soak and swim break. | Pool depth/age rules: GAP. 2026 note: Hot Springs trail connector to Sinclair Canyon closed for road | VERIFIED |
| **Waterton Townsite** | Waterton Lakes | 3 h | [Map](https://maps.google.com/?q=Waterton+Townsite,+Waterton+Lakes+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/waterton/visit/pointe-interest-points) | Compact base; wildlife and prairie-meets-mountain scenery. | Town shoreline paths flat. Wildlife corridor caution on Entrance Road per 2026 notice. | VERIFIED |
| **Red Rock Parkway and Red Rock Canyon** | Waterton Lakes | 2 h | [Map](https://maps.google.com/?q=Red+Rock+Parkway+and+Red+Rock+Canyon,+Waterton+Lakes+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/waterton/visit/pointe-interest-points) | Easy red argillite canyon walk. | Red Rock Canyon Loop open per 2026 page. Loop length: GAP, INFERENCE 0.7 km. | VERIFIED |
| **Cameron Lake** | Waterton Lakes | 2 h | [Map](https://maps.google.com/?q=Cameron+Lake,+Waterton+Lakes+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/conduite-driving/akamina) | Boat rental, grizzly habitat, flat shore walk. | Cameron Lakeshore Trail listed open (2026-10-12). Bear warning: GAP no specific warning listed for i | VERIFIED |
| **Prince of Wales Hotel** | Waterton Lakes | 1 h | [Map](https://maps.google.com/?q=Prince+of+Wales+Hotel,+Waterton+Lakes+National+Park,+Alberta) | [Official](https://parks.canada.ca/pn-np/ab/waterton/visit/pointe-interest-points) | Classic photo; afternoon tea. | Prince of Wales Loop Trail open per 2026 page. | VERIFIED |
| **Upper and Lower Kananaskis Lakes** | Peter Lougheed Provincial Park | 2 h | [Map](https://maps.google.com/?q=Upper+and+Lower+Kananaskis+Lakes,+Peter+Lougheed+Provincial+Park,+Alberta) | [Official](https://www.albertaparks.ca/parks/kananaskis/peter-lougheed-pp/) | Classic Kananaskis lake and Opal Range scenery with easy lakeside access for a child. | Lakeside strolls at Lower Lake and Interlakes are flat; keep away from shoreline in bear closure zon | VERIFIED |
| **Elbow Falls** | Elbow-Sheep Wildland | 1 h | [Map](https://maps.google.com/?q=Elbow+Falls,+Elbow-Sheep+Wildland,+Alberta) | [Official](https://www.albertaparks.ca/parks/kananaskis/elbow-falls-pra/information-facilities/day-use/elbow-falls/) | Easiest roadside waterfall near Calgary; pram-free short loop. | Fenced viewpoints; hold hands near rail. | VERIFIED |
| **Wedge Pond** | Spray Valley Provincial Park | 1 h | [Map](https://maps.google.com/?q=Wedge+Pond,+Spray+Valley+Provincial+Park,+Alberta) | [Official](https://www.albertaparks.ca/parks/kananaskis/spray-valley-pp/information-facilities/day-use/wedge-pond/) | Reflection photo stop with no climbing. | Flat, 20-45 min. | VERIFIED |
| **Mount Lorette Ponds** | Bow Valley Wildland / Kananaskis Country | 1 h | [Map](https://maps.google.com/?q=Mount+Lorette+Ponds,+Bow+Valley+Wildland+/+Kananaskis+Country,+Alberta) | [Official](https://www.albertaparks.ca/parks/kananaskis/bow-valley-pp/information-facilities/day-use/mt-lorette-ponds/) | Quick easy picnic and pond stop for a young child. | Easy flat loop; check closure notices (day use appears in Alberta Parks closure notice). | VERIFIED |
| **Canmore Nordic Centre Provincial Park** | Canmore Nordic Centre Provincial Park | 2 h | [Map](https://maps.google.com/?q=Canmore+Nordic+Centre+Provincial+Park,+Canmore+Nordic+Centre+Provincial+Park,+Alberta) | [Official](https://albertaparks.ca/parks/kananaskis/canmore-nordic-centre-pp/) | Base for Grassi Lakes access and trail network (INFERENCE). | GAP | GAP |
| **Highwood Pass and Hwy 40 corridor** | Peter Lougheed Provincial Park | 1 h | [Map](https://maps.google.com/?q=Highwood+Pass,+Peter+Lougheed+Provincial+Park,+Alberta) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/annual-road-closures/) | Gateway to larch cirque hiking; scenic drive. | Parking lot busy and construction reported; go early on weekdays. | VERIFIED |
| **Smith-Dorrien / Spray Trail (Hwy 742)** | Spray Valley Provincial Park | 1 h | [Map](https://maps.google.com/?q=Smith-Dorrien+Trail,+Spray+Valley+Provincial+Park,+Alberta) | GAP | Access road for several Sept larch and family hikes. | Gravel, dusty, washboard, no cell service; GAP: Alberta Parks closure chart does not list it. | INFERENCE |
| **Mount Robson Visitor Centre viewpoint** | Mount Robson Provincial Park | 1 h | [Map](https://maps.google.com/?q=Mount+Robson+Visitor+Centre,+Mount+Robson+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/mount-robson-park/) | Easiest look at the highest Rockies peak. | Zero walking; clouds often cover summit. | VERIFIED |
| **Overlander Falls** | Mount Robson Provincial Park | 1 h | [Map](https://maps.google.com/?q=Overlander+Falls,+Mount+Robson+Provincial+Park,+British+Columbia) | GAP | Short family walk in Robson Valley. | Easy for 6 year old; BC Parks lists it as a short family hike. | VERIFIED |
| **Kinney Lake** | Mount Robson Provincial Park | 4 h | [Map](https://maps.google.com/?q=Kinney+Lake,+Mount+Robson+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/mount-robson-park/) | Most accessible lake on the Berg Lake trail. | Long but flat; 9-10 km return; see trail kinney-lake. | VERIFIED |
| **Berg Lake** | Mount Robson Provincial Park | 24 h | [Map](https://maps.google.com/?q=Berg+Lake,+Mount+Robson+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/mount-robson-park/) | Signature BC Rockies backpack; adult-only for this trip. | Not suitable for a 6 year old in a day; multi-day only with reservations. | VERIFIED |
| **Mount Assiniboine helicopter access** | Mount Assiniboine Provincial Park | 8 h | [Map](https://maps.google.com/?q=Mount+Shark+Helipad,+Mount+Assiniboine+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/mount-assiniboine-park/) | Only practical non-hiking access to Lake Magog. | GAP: child weight/fare and lodge pricing not found (Assiniboine Lodge site not fetched). | GAP |
| **Lake Magog and Assiniboine core area** | Mount Assiniboine Provincial Park | 24 h | [Map](https://maps.google.com/?q=Lake+Magog+and+Assiniboine+core+area,+Mount+Assiniboine+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/mount-assiniboine-park/) | Matterhorn-style Mount Assiniboine view. | Camping reservation via BC Parks; core sites sell out within seconds; huts via lodge. | VERIFIED |
| **Elk Lakes Provincial Park** | Elk Lakes Provincial Park | 4 h | [Map](https://maps.google.com/?q=Elk+Lakes+Provincial+Park,+Elk+Lakes+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/elk-lakes-park/hiking/) | Quiet alternative with easy lake walk. | Medium clearance vehicle, radio recommended; industrial traffic. | VERIFIED |
| **Beauvais Lake Provincial Park** | Beauvais Lake Provincial Park | 3 h | [Map](https://maps.google.com/?q=Beauvais+Lake+Provincial+Park,+Beauvais+Lake+Provincial+Park,+Alberta) | [Official](https://www.albertaparks.ca/parks/south/beauvais-lake-pp/information-facilities/) | Info only for this trip; far south. | Listing marks main trail for older children. | INFERENCE |
| **Whiteswan Lake and Lussier Hot Springs** | Whiteswan Lake Provincial Park | 3 h | [Map](https://maps.google.com/?q=Whiteswan+Lake+and+Lussier+Hot+Springs,+Whiteswan+Lake+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/whiteswan-lake-park/) | Family friendly soak; swimsuit required, no dogs. | Steep path to springs; hot water 43 C - supervise child. | VERIFIED |
| **Castle Provincial Park** | Castle Provincial Park | 3 h | [Map](https://maps.google.com/?q=Castle+Provincial+Park,+Castle+Provincial+Park,+Alberta) | [Official](https://www.albertaparks.ca/parks/south/castle-pp/information-facilities/) | Info only. | GAP | GAP |
| **Top of the World Provincial Park** | Top of the World Provincial Park | 6 h | [Map](https://maps.google.com/?q=Top+of+the+World+Provincial+Park,+Top+of+the+World+Provincial+Park,+British+Columbia) | [Official](https://bcparks.ca/top-of-the-world-park/) | Info only. | Remote; not for this trip. | GAP |
<!-- END:sights -->

## Photo gallery

The gallery is injected into index.html from gallery.json (`_system/gallery.py inject`). Nothing is hand-written here.

---

## Light

| Date | Place | Sunrise | Sunset | Daylight |
|---|---|---|---|---|
| Sat 8 Sep | Banff | 07:05 | 20:16 | 13 h 11 m |
| Tue 11 Sep | Jasper | 07:18 | 20:21 | 13 h 03 m |
| Sat 15 Sep | Lake Louise | 07:18 | 20:02 | 12 h 44 m |
| Tue 18 Sep | Lake Louise | 07:23 | 19:55 | 12 h 32 m |
| Sat 22 Sep | Kananaskis Village | 07:25 | 19:42 | 12 h 17 m |

Computed with the NOAA method in `sun-times.py` for MDT (UTC-6), flat horizon. The research table gives Banff 07:06 and 20:13 for 8 Sep, so treat everything as plus or minus 3 minutes. Mountains delay real sunrise and advance real sunset at lake level by 30-90+ minutes (researcher INFERENCE). Mount Robson is probably on Pacific time (GAP). Kananaskis Village coordinates (50.93 N, 115.14 W) are my approximation.

---

# The plan

## Bases

| Base | Nights | Dates | Why |
|---|---|---|---|
| Banff (`banff`) | 2 | Sat 8, Sun 9 | Walkable town; first night at 1,383 m before Sunshine (2,159-2,385 m). |
| Lake Louise (`lake-louise`) | 1 | Mon 10 | Starts the Parkway 35 min closer than Banff (175 vs 210 min to Jasper, matrix). |
| Jasper (`jasper`) | 4 | Tue 11 to Fri 14 | Three full days and the Robson swap day at the far end of the loop. Tightest lodging in the Rockies since the 2024 fire. |
| Lake Louise (`lake-louise`) | 4 | Sat 15 to Tue 18 | Yoho, Lake Louise and Moraine from the shuttle Park and Ride. |
| Kananaskis Village (`kananaskis-village`) | 3 | Wed 19 to Fri 21 | Peter Lougheed lakes and Highwood Pass; 70 min to YYC (matrix). |

- **Canmore** is cheaper, has the best family pools (Pocaterra Inn waterslide, Canmore Inn and Suites) and is 25 min from Banff (matrix). Swap the first two nights there if Banff prices are out of reach.
- **Field** is the fallback for the second Lake Louise block (25 min, matrix; lodging GAP). Lake Louise village has thin, pricey groceries, so stock up in Jasper on Day 7.
- **Jasper fallbacks**: Hinton (about 1 h east) or Valemount (85 min west, matrix).

## How the three tracks work

- **Track A**: the adult-only hike. On a split day one adult does it alone.
- **Track B**: the family option in the same area. On a split day the other adult and the child do it; on a non-split day the whole family does it.
- **Track C**: the low-walking fallback for a tired child, bad weather or a closure.

**Split days: 2, 5, 7, 9, 10, 11, 13.** On every other day Track A is optional and the plan assumes the family stays together.

Suggested rota (change freely):

| Day | Hike | Adult |
|---|---|---|
| 2 | Sunshine Meadows to Citadel Pass | 1 |
| 5 | Bald Hills | 2 |
| 7 | Sulphur Skyline | 1 |
| 9 | Iceline | 2 |
| 10 | Plain of Six Glaciers | 1 |
| 11 | Larch Valley to Sentinel Pass | 2 |
| 13 | Sarrail Ridge | 1 |

---

### Day 1, Sat 8 Sep: Toronto to Banff

| | |
|---|---|
| Drive | Calgary to Banff 90 min (matrix; Rome2Rio 1h25-1h45), plus car pickup and a grocery stop |
| Track A | None: arrival day |
| Track B | Fenland Loop (`fenland-loop`, 1.9 km, flat), then Vermilion Lakes Drive (`vermilion-lakes`) for the last hour before sunset |
| Track C | Banff Gondola (`banff-gondola`): 2026 hours 09:00-21:00 from 8 Sep, last ride up 19:30 |
| Split | No |
| Bookings | Rental car, Discovery Pass, Banff lodging |
| Light | Sunrise 07:05, sunset 20:16 |

- **Bear spray today**, in Calgary, Canmore or Banff. Rental about C$10-12 a day (2025-26 blogs, low confidence).
- The child's body clock is 2 h ahead: expect a 19:00 crash (INFERENCE), and early wake-ups that help the next two mornings.
- **Decision rule.** Flight lands after about 15:00 (2029 schedules GAP): straight to the hotel.
- **Wet weather.** Cave and Basin (`cave-and-basin`; hours GAP) or the hotel pool.

### Day 2, Sun 9 Sep: Sunshine Meadows (split)

| | |
|---|---|
| Drive | Banff to the Sunshine gondola base, about 15-20 min each way (INFERENCE, not in the matrix) |
| Track A | Sunshine Meadows to Citadel Pass (`sunshine-meadows-citadel-pass`): 10.2 km, 580 m, 4-6 h from the village; turn around by 13:30 |
| Track B | Gondola up together at 08:00, 1-2 h on the meadow paths (no family trail id or distance: GAP), down by 11:30; afternoon Lake Minnewanka Classic cruise (`lake-minnewanka-cruise`; 2026: 10:00-18:00 to 17 Sep) |
| Track C | Banff Gondola, Cave and Basin, Banff Upper Hot Springs (`banff-upper-hot-springs`; 2026: 13:00-22:00) |
| Split | Yes. Rejoin at the Sunshine gondola base car park about 15:30-16:00, then the Upper Hot Springs together |
| Bookings | Discovery Pass; check post-Labour Day hours |
| Light | Sunrise 07:06, sunset 20:13 |

- **Why this day.** Sunshine's gondola closed on 21 Sep 2025 and 20 Sep 2026, both the third Sunday of September. In 2029 that is Sun 16 Sep (INFERENCE). So Sunshine goes first, green larches and all.
- Sunshine gondola 2026: 6 Jul-20 Sep, 08:00-18:00, no pre-booking needed; price GAP; no id in the dataset.
- Altitude 2,159-2,385 m: low risk after a night at 1,383 m (researcher INFERENCE).
- The Minnewanka Junior Explorer kids' cruise ended 31 Aug in 2026; the free shuttle ended on Labour Day. A 6-15 child needs a seat; no strollers on board.
- Adult alternative with a guide: Norquay Via Ferrata (`norquay-via-ferrata`, age 12+, minimum 40 kg).
- **Decision rule.** At 07:00, cloud or fresh snow at Sunshine: everyone takes Track C and Citadel Pass is dropped, not moved.

### Day 3, Mon 10 Sep: Johnston Canyon and Kootenay, to Lake Louise

| | |
|---|---|
| Drive | Banff to Lake Louise 40 min direct (matrix; Canadream 40); detours to Johnston Canyon via Castle Junction and down Hwy 93S add about 60-75 min (INFERENCE) |
| Track A | Optional: Bourgeau Lake (`bourgeau-lake`), 13.4 km, 730 m, 5-6 h; drop 07:00 on Hwy 1, collect about 13:30 |
| Track B | Johnston Canyon Lower Falls (`johnston-canyon`; 1.1 km one way, 85 m) on the trail by 08:00; Marble Canyon (`marble-canyon-walk`, 1.8 km, 65 m); Paint Pots (`paint-pots-walk`, 2.0 km, 35 m) |
| Track C | Marble Canyon only (fenced bridges), Lake Louise lakeshore for a first look in the evening |
| Split | No |
| Bookings | None needed for Johnston Canyon (2026); Lake Louise lodging |
| Light | Lake Louise sunrise 07:10, sunset 20:14 |

- **Why this order.** Johnston Canyon fills first, so it is first, on a weekday. Kootenay's canyon walks are short and never full (INFERENCE).
- **Bow Valley Parkway.** A fall vehicle restriction on the eastern 17 km ran 28 Aug-2 Oct in 2026 per Parks Canada (a blog says 1 Sep-6 Oct). Approach Johnston Canyon from Castle Junction, not from Banff.
- Johnston Canyon catwalks are exposed: hold hands.
- **Decision rule.** Johnston Canyon still closed (it shut from 13 Oct 2026 with no end date) or full at 08:00: straight to Marble Canyon and Paint Pots.
- **Wet weather.** Marble Canyon in light rain is fine; skip Paint Pots mud.

### Day 4, Tue 11 Sep: Icefields Parkway north

| | |
|---|---|
| Drive | Lake Louise to Jasper 175 min non-stop (matrix), 232 km; 8-9 h door to door |
| Track A | Optional: Wilcox Pass (`wilcox-pass`), 8 km, 390 m, 3-4 h, while the others ride the Ice Explorer; rejoin at the Icefield Centre about 16:00 |
| Track B | Bow Lake (`bow-lake`), Peyto Lake lookout (`peyto-lake-lookout`, 1.2 km), Saskatchewan Crossing, Columbia Icefield Ice Explorer and Skywalk (`columbia-icefield-ice-explorer`, `glacier-skywalk`) |
| Track C | Same stops, viewpoints only; Skywalk instead of the Ice Explorer |
| Split | No |
| Bookings | Columbia Icefield Adventure; Jasper lodging |
| Light | Lake Louise sunrise about 07:12; Jasper sunset 20:21 |

Pacing for the child, four stops plus pit toilets:

| Time | Stop | Why then |
|---|---|---|
| 07:30 | Leave Lake Louise with a full tank | Saskatchewan Crossing is the only fuel |
| 08:15 | Bow Lake, lakeside only | Still water in the morning; Bow Glacier Falls (3.8 km each way) is too long |
| 09:30 | Peyto Lake lookout, 1.2 km, 30 m | Parking eases before 10:00; light best before noon |
| 11:00 | Saskatchewan River Crossing | Fuel, full toilets, early lunch |
| 12:30 | Columbia Icefield: Ice Explorer and Skywalk | 2026: about 126 adult, 82 child 6-15 (third party); 5 and under free; departures after 15:30 about 20% cheaper |
| 18:00 | Jasper | |

- No cell signal except at the Icefield (second-hand). Download offline maps the night before.
- **Decision rule.** Parkway closed: second night in Lake Louise, run Day 10 now; the detour is 7-8 h. Snow at Bow Summit: skip Peyto. Ice Explorer cancelled: Brewster refunds the attraction portion (2026 terms) and the toe walk (`toe-glacier-walk`) replaces it.

### Day 5, Wed 12 Sep: Maligne Lake (split)

| | |
|---|---|
| Drive | Jasper to Maligne Lake about 1 h each way (INFERENCE) |
| Track A | Bald Hills (`bald-hills`): 10.4 km, 500 m, 4-5 h; rated Poor on 8 Oct 2026 |
| Track B | 10:00 Spirit Island cruise (`maligne-lake-cruise`), Mary Schaffer Loop (`mary-schaffer-loop`, 3.2 km), Moose Lake Loop (`moose-lake-loop`, 2.7 km) on the way out if wanted; Pyramid Lake (`pyramid-lake`) in the evening |
| Track C | Cruise only |
| Split | Yes. Rejoin at the Maligne Lake boathouse car park about 14:00 |
| Bookings | Maligne cruise |
| Light | Sunrise 07:19, sunset 20:18 |

- The boat stops at an overlook; nobody walks on Spirit Island. No toilet on board, no strollers. 2026 hours 09:00-17:30 from 7 Sep.
- Opal Hills (`opal-hills`) is the shorter adult loop but was closed for grizzlies on 8 Oct 2026.
- **Decision rule.** Maligne Canyon (`maligne-canyon`) reopened by 2029: stop on the way back about 15:00. Bald Hills closed or snowy: the hiking adult joins the cruise.
- **Wet weather.** The cruise runs in rain (policy GAP); or a Jasper wildlife tour (`jasper-wildlife-tour`; 2026 about 69-74 adult, 35-39 child).

### Day 6, Thu 13 Sep: Mount Robson and the SkyTram (swap day)

| | |
|---|---|
| Drive | Jasper to Mount Robson 60 min each way (matrix) |
| Track A | Kinney Lake (`kinney-lake`): 10 km, 131 m, 3-3.5 h, nearly flat. One adult, or the whole family if the child's ceiling is 10 km |
| Track B | Visitor centre viewpoint (`mount-robson-viewpoint`), Overlander Falls (`overlander-falls-trail`, 2.3 km, 90 m), back to Jasper by 14:00 for the SkyTram (`jasper-skytram`) |
| Track C | Viewpoint and SkyTram |
| Split | No (optional; rejoin at the Berg Lake trailhead lot about 11:30) |
| Bookings | SkyTram timed ticket |
| Light | Jasper sunrise 07:21, sunset 20:16; Robson 07:26 and 20:21 MDT, an hour earlier on the clock if Robson is on Pacific time |

- **Why morning at Robson.** Cloud often covers the summit; clear mornings are the best chance (BC Parks sight note).
- SkyTram 2026 fall hours: 10:00-17:00 on the official site; another listing says 10:00-18:00 with last ride up 16:30. Allow 90 min between up and down.
- BC Parks: elk and moose can be aggressive in the September-October rut.
- **Decision rule.** This is the Jasper swap day. Robson in cloud on the 07:00 forecast: swap with Day 7. Anything lost on Days 4-5 takes this slot.

### Day 7, Fri 14 Sep: Miette Hot Springs (split)

| | |
|---|---|
| Drive | Jasper to Miette about 1 h each way via Hwy 16 east (INFERENCE) |
| Track A | Sulphur Skyline (`sulphur-skyline`): 8 km, 700 m, 3-4 h from the pools; exposed ridge; start about 11:30 |
| Track B | Slow morning in Jasper (laundry, groceries for Lake Louise, rest); Miette Mine trail (`jasper-miette-mine-trail`, 0.8 km) and the pools (`miette-hot-springs`; 2026: 11:00-21:00 from 8 Sep); Lake Annette Loop (`lake-annette-loop`, 2.4 km) in the evening; dark sky if clear (`jasper-dark-sky`) |
| Track C | Soak only |
| Split | Yes. Rejoin at the Miette pools car park about 15:30 |
| Bookings | Check wildlife orders |
| Light | Sunrise 07:23, sunset 20:13 |

- Day 7 of 15 is deliberately half rest.
- Bighorn sheep on Hwy 16 east (research). Elk rut in Jasper townsite: Jasper dispatch 780-852-6155.
- **Decision rule.** Smoke forecast (special air quality statement): pools and town only, nobody climbs. Lightning: no ridge.

### Day 8, Sat 15 Sep: Icefields Parkway south

| | |
|---|---|
| Drive | Jasper to Lake Louise 175 min non-stop (matrix); 7-8 h with stops |
| Track A | Optional: Parker Ridge (`parker-ridge`), 5.4 km, 250 m, 2-3 h, while the family walks to the glacier toe; only if at the Icefield by 12:00 |
| Track B | Athabasca Falls (`athabasca-falls-trail`, 0.2 km), Sunwapta Falls (`sunwapta-falls`), toe of the Athabasca Glacier (`toe-glacier-walk`, 1.8 km, 60 m) |
| Track C | Viewpoints from the car parks |
| Split | No (optional; rejoin at the Parker Ridge lot about 14:00) |
| Bookings | **08:00 MDT in Jasper: the 60% shuttle release for Mon 17 Sep** (if not booked in April) |
| Light | Jasper sunrise about 07:25; Lake Louise sunset 20:02 |

| Time | Stop | Why then |
|---|---|---|
| 08:00 | Book shuttle seats, fill the tank in Jasper | No cell on the Parkway |
| 08:45 | Athabasca Falls, fenced, 200 m | Short first stop; hold hands at the canyon edge |
| 09:30 | Sunwapta Falls, upper viewpoint (lower falls 2.6 km if wanted) | Spray in morning light |
| 11:30 | Columbia Icefield: toe walk, lunch, full toilets | Stay behind signs and ropes: a child died in a crevasse here in 1990, a backcountry skier in May 2026 |
| 14:30 | Saskatchewan Crossing | Fuel, toilets |
| 16:30 | Lake Louise | |

- **Decision rule.** Day 4 lost Bow Lake or Peyto: add them back and drop Sunwapta. Parkway closed: one more night in Jasper and drop Day 9 (Yoho), the only Lake Louise-block day with no shuttle seat attached.

### Day 9, Sun 16 Sep: Yoho (split)

| | |
|---|---|
| Drive | Lake Louise to Field 25 min (matrix); the Yoho Valley and Emerald Lake roads add about 20-30 min each (INFERENCE) |
| Track A | Iceline (`iceline-trail`): 20.3 km and 1,090 m, or 20.8 km and 710 m (two Parks Canada pages); 7-8 h. Drop at Takakkaw 07:30 |
| Track B | Takakkaw Falls walk (`takakkaw-falls-walk`, 1.8 km flat) at 08:00; Emerald Lake canoe (`emerald-lake-canoe`) and the west side of the lakeshore (`emerald-lakeshore`); Natural Bridge (`natural-bridge`) |
| Track C | Takakkaw viewpoint (paved), Natural Bridge, a canoe |
| Split | Yes. Rejoin at the Takakkaw Falls car park about 15:30 |
| Bookings | **08:00 MDT at Lake Louise: the 60% shuttle release for Tue 18 Sep** (if not booked in April); Lake O'Hara if the lottery was won |
| Light | Sunrise 07:19, sunset 20:00 |

- Emerald Lake canoe (2026): 10:00-16:45, though the page also says last rental 14:00; 70-100 an hour; one adult 19+ per canoe; two adults plus two children under 30 kg fit.
- The Iceline was Fair with deadfall and high snow on 5 Oct 2026. Alternatives: the Emerald Triangle via the Wapta Highline (`emerald-triangle-wapta-highline`, 18.8 km, 1,285 m) keeps the car at Emerald Lake; the Burgess Shale Walcott Quarry (`burgess-walcott`, 11 h guided) had a 2026 access ban.
- **Decision rule.** Lake O'Hara lottery won for this date: replace the day (children 1-16 must be on the reservation; no O'Hara trail ids in this dataset). Snow on the Iceline high section: turn back at the first viewpoint or join Track B.
- **Wet weather.** Wapta Falls (`wapta-falls-trail`, 4.4 km, eastbound access only), or Golden, 40 min from Field: Kicking Horse gondola and grizzly refuge (`kicking-horse-gondola-grizzly`; Thu-Mon only from 10 Sep in 2026, so Sunday works) and Golden Skybridge (`golden-skybridge`; the zipline needs 23 kg, the child fails it).

### Day 10, Mon 17 Sep: Lake Louise (split)

| | |
|---|---|
| Drive | A few minutes to the Park and Ride (1 Whitehorn Rd); Lakeshore shuttle to the lake |
| Track A | Plain of Six Glaciers (`plain-of-six-glaciers`): 11.8 km, 595 m, 5-6 h. Shorter: Lake Agnes (`lake-agnes`, 7.8 km, 495 m). Steeper: Mount Fairview (`mount-fairview`, 10 km, 990 m) |
| Track B | Lakeshore trail (`lake-louise-lakeshore`, 4.6 km, 175 m), canoe (`lake-louise-canoe`), then the Lake Louise Gondola together (`lake-louise-gondola`) |
| Track C | Chateau end of the lake only, then the gondola |
| Split | Yes. Rejoin at the Chateau end of the lakeshore about 13:30, then shuttle back and the gondola together |
| Bookings | Lakeshore shuttle |
| Light | Sunrise 07:21, sunset 19:58 |

- **Why a weekday.** Lake Louise is the most crowded lake in the plan; Monday rather than Sunday.
- **Do not drive to the lakeshore lot**: about 75% of cars were turned away in summer 2025 (Parks Canada).
- Lake Louise Gondola 2026: 09:00-16:30; adult 65, child 6-12 16 before tax; under 12 or under 106 cm rides with an adult; views over the Whitehorn grizzly corridor.
- Plain of Six is the busiest trail in the plan, which makes it the best one for a solo adult. Teahouse dates GAP.
- **Decision rule.** Tuesday's Moraine forecast clearly worse than Monday's: try to swap Days 10 and 11 at the Sat 15 release (change fee 3.50, up to 1 h before departure, seats permitting).

### Day 11, Tue 18 Sep: Moraine Lake (split)

| | |
|---|---|
| Drive | Park and Ride; Moraine shuttle only |
| Track A | Larch Valley to Sentinel Pass (`larch-valley-sentinel-pass`): 11.2 km, 750 m, 5-6 h; group-of-four rule may apply |
| Track B | First shuttle about 06:30; Rockpile at first light (0.7 km loop with stairs), Moraine lakeshore (`moraine-lakeshore`, 2.6 km), canoe if still open (`moraine-lake-canoe`) |
| Track C | Rockpile only |
| Split | Yes. Rejoin at the Moraine Lake shuttle stop about 13:00 |
| Bookings | Moraine shuttle (book on launch day in April) |
| Light | Sunrise 07:23 on a flat horizon, later on the lake; sunset 19:55 |

- **Why last.** Larch Valley's first trees turn yellow about mid-September, with the peak about 10 days later (2026 guide). The 18th is the edge of colour at best.
- **Group of four.** Larch Valley, Sentinel Pass, Consolation Lakes, Paradise Valley and others need a tight group of four or more when the trailhead sign says "mandatory", typically mid-July to mid-October (Parks Canada page, search snippet only). A solo adult must join three others at the trailhead. Whether a 6-year-old counts toward four: GAP.
- Shuttle seats 2026: adult 12.75, youth 4.00 (Banff Blog) plus a 3.50 online fee; the ticket covers Moraine, Lake Louise and the Lake Connector.
- Moraine canoe: about 160 an hour, mid-June to mid-September, so it may be closed by the 18th (GAP).
- **Decision rule.** Rule mandatory and no group by about 08:30: the hiking adult takes the Lake Connector to Lake Louise and walks to Lake Agnes (`lake-agnes`), outside the group-access area, and rejoins at 13:00.

### Day 12, Wed 19 Sep: Canmore and Grassi Lakes, to Kananaskis

| | |
|---|---|
| Drive | Lake Louise to Canmore 60 min, Canmore to Kananaskis Village 45 min (matrix) |
| Track A | Optional: Ha Ling Peak (`ha-ling-peak`), 7 km, 780 m, 4-5 h; steep exposed scree |
| Track B | Grassi Lakes easy route (`grassi-lakes-upper`, 3.8 km, 125 m); Canmore groceries; Canmore Nordic Centre skills park (`canmore-nordic-centre`, free) |
| Track C | Mount Lorette Ponds (`mount-lorette-ponds`, 1 km flat) on Hwy 40 |
| Split | No (optional; rejoin near the Grassi and Ha Ling trailheads about 14:00) |
| Bookings | Kananaskis Conservation Pass, online this morning |
| Light | Kananaskis Village sunrise 07:20, sunset 19:49 |

- The Conservation Pass (2026: 15 a day per vehicle, 90 a year) is separate from the Parks Canada pass. Four parking days at day rates: 60.
- Shop in Canmore (Safeway, Save-On-Foods, the IGA opened April 2026). Kananaskis Village has almost nothing.

### Day 13, Thu 20 Sep: Kananaskis Lakes (split)

| | |
|---|---|
| Drive | Kananaskis Village to Upper Kananaskis Lake about 35-40 min each way (INFERENCE) |
| Track A | Sarrail Ridge (`sarrail-ridge`): 11.3 km, 675 m, 5-6 h; steep slippery gully |
| Track B | Interlakes trail (`interlakes-trail`), flat, about 4 km out and back; Rockwall lookout (`rockwall-lookout`, 0.5 km); Rawson Lake (`rawson-lake`, 7.8 km, 300 m) as the stretch goal |
| Track C | Lower Lake lakeside (`kananaskis-lakes-day-use`) |
| Split | Yes. Rejoin at the Rawson Lake and Upper Lake trailhead lot about 14:30 |
| Bookings | Conservation Pass |
| Light | Sunrise 07:22, sunset 19:46 |

- 2026: Rawson and Sarrail grizzly advisory from 5 Jul; the Upper Kananaskis Lake circuit (`upper-kananaskis-lake-loop`) closed from North Interlakes to White Spruce for a grizzly with cubs. Both are 2029 unknowns.
- **Decision rule.** Read the Peter Lougheed trail report the evening before. Rawson and Sarrail closed: the adult takes Chester Lake (`chester-lake`) or Burstall Pass (`burstall-pass`) on the Smith-Dorrien gravel road, if the rental contract allows gravel. Days 13 and 14 swap freely on weather.
- **Wet weather.** Troll Falls (`troll-falls`, 3.4 km) from the village.

### Day 14, Fri 21 Sep: Highwood Pass and Ptarmigan Cirque (family day)

| | |
|---|---|
| Drive | Kananaskis Village to Highwood Pass about 50 min each way (INFERENCE) |
| Track A | None: family-together day by design. Ptarmigan Cirque is the one larch walk sized for the child, and the dataset has no adult-only trail at Highwood Pass (Arethusa Cirque is in the research but not in `trails.json`) |
| Track B | Ptarmigan Cirque (`ptarmigan-cirque`): 4.5 km, 210 m, 2-3 h from 2,206 m; Wedge Pond (`wedge-pond-loop`, 1 km) on the way back |
| Track C | Highwood Pass from the car (`highwood-pass-summit`), Wedge Pond |
| Split | No |
| Bookings | Conservation Pass |
| Light | Sunrise 07:23, sunset 19:44 |

- Larches here turn mid-September to early October (Alberta Parks), so the 21st is plausibly early colour (INFERENCE).
- The trail is closed in snow or wet. The lot is busy with construction reported and an overflow lot added: arrive by 09:00.
- Cold: expect day highs of 9-12 C and nights below freezing at 2,000-2,500 m (INFERENCE, standard lapse rate from Banff's Parks Canada averages).
- **Decision rule.** Snow or rain on the pass: swap with Day 13. Both days poor: Troll Falls and Mount Lorette Ponds (`mount-lorette-ponds-loop`) in the valley. This is the last flex point.

### Day 15, Sat 22 Sep: home

| | |
|---|---|
| Drive | Kananaskis Village to Calgary 70 min (matrix), plus car return |
| Track A | None: departure day |
| Track B | Troll Falls (`troll-falls`, 3.4 km, 155 m) only if the flight leaves after about 15:00 |
| Track C | Wedge Pond (`wedge-pond`) if there is time, otherwise straight to YYC |
| Split | No |
| Light | Sunrise 07:25, sunset 19:42 |

Leave at least 3 h before departure (INFERENCE). Refuel in Calgary.

### If you only get N nights

| Nights | Keep | Drop |
|---|---|---|
| 12 | Everything else as written | Day 6 (Robson; SkyTram moves to Day 7 morning) and Day 13 (Peter Lougheed lakes). Kananaskis becomes 2 nights. |
| 10 | Banff 2, Lake Louise 3, Jasper 4; leave Jasper by the Parkway to Canmore (235 min, matrix) for the last night | Kananaskis, all swap days, one split day |
| 8 | Banff 3, Lake Louise 4; Parkway as a Lake Louise out-and-back to Bow, Peyto and possibly the Icefield | Jasper, Robson, Kananaskis |
| 16 | All of the 14-night plan, then Kananaskis Village to Waterton (200 min, matrix) for 2 nights | Nothing, but Waterton is thinning by late September (Goat Haunt cruise ended 20 Sep in 2026) |

---

## Deadlines

All 2029 dates are INFERENCE from the 2026 opening patterns unless stated.

| When | What | Booking id |
|---|---|---|
| 1-31 Aug 2028 (only if wanted) | Mount Assiniboine Lodge requests for summer 2029; not in this plan; child policy GAP | `assiniboine-lodge` |
| As soon as 2029 inventory opens, about Sep-Oct 2028 (about 12 months ahead, unverified) | All lodging on refundable rates | `lodging-banff-ll-canmore-field` |
| Same day | Jasper, 4 nights; about 20% of rooms lost in 2024 | `jasper-lodging` |
| About Sep-Oct 2028 | Flights YYZ-YYC; decide Calgary vs Edmonton out first | |
| Once lodging is fixed | Rental car; ask in writing about gravel roads and animal-strike cover | `calgary-rental-car` |
| Early Dec 2028 (info only) | Berg Lake campsites (2026 season opened 2 Dec 2025) | `berg-lake` |
| Late Jan to mid Feb 2029 | Parks Canada campgrounds, only if you switch a night to camping (2026: Yoho and Kootenay 20 Jan, Jasper 27 Jan, Banff 12 Feb) | `camp-banff-front` |
| About 2-23 Mar 2029 | Lake O'Hara day-bus lottery for Sun 16 Sep (optional; 10 per application in 2026) | `lake-ohara-bus` |
| Spring 2029 | 2029-30 school calendar; ask about a 10-day absence | |
| **Mid-April 2029, 08:00 MDT** | **Shuttle seats: Lakeshore for Mon 17, Moraine for Tue 18.** 2026 launch was Wed 15 Apr; 15 Apr 2029 is a Sunday, so the date will differ (GAP). Only 40% of seats on launch day | `shuttle-moraine-lakelouise` |
| Spring 2029 and the week before | 2029 status of Johnston Canyon, Maligne Canyon, Edith Cavell, Opal Hills, Upper Kananaskis Lake circuit, the Larch Valley group rule, Sunshine's closing date, the Bow Valley Parkway fall restriction | `wildlife-orders` |
| About Jun-Jul 2029 (lead time GAP) | Columbia Icefield Adventure for Tue 11 Sep, early afternoon | `icefields-parkway` |
| About Aug 2029 | Maligne cruise, 10:00 Wed 12 Sep; non-refundable | `maligne-cruise` |
| Before the trip | Discovery Pass, family annual (2026: 167.50; 14 daily family passes at 24.50 cost more) | `pass-discovery` |
| At booking | Travel medical and cancellation cover including wildfire evacuation | |
| About Thu 6 Sep 2029 | Conditions re-check routine (not yet scheduled) | |
| Sat 8 Sep, Day 1 | Bear spray | |
| Sat 15 Sep, 08:00 MDT, in Jasper | 60% shuttle release for Mon 17 | `shuttle-moraine-lakelouise` |
| Sun 16 Sep, 08:00 MDT, at Lake Louise | 60% shuttle release for Tue 18 | `shuttle-moraine-lakelouise` |
| Wed 19 Sep morning | Kananaskis Conservation Pass | `kananaskis-pass` |

## Bookings

<!-- BEGIN:bookings -->
| Booking | Provider | Opens (2026 pattern) | Sells out | Cost (CAD 2026) | Must do | Link | Status |
|---|---|---|---|---|---|---|---|
| Parks Canada Discovery Pass or daily entry | Parks Canada | No booking window; buy any time online or at gate. Fees rose 1 Jan 2026. | No sell-out; no timed entry. | Annual adult $83.50, senior $71.50, family/group $ | yes | GAP | VERIFIED |
| Canada Strong Pass (free park admission promotion) | Government of Canada / Parks Canada | Ran 19 Jun - 7 Sep 2026; free admission and 25% off camping/roofed accommodation (summarie | n/a | Free admission in window; parking, reservations, h | no | GAP | GAP |
| Parks Canada Lake Louise / Moraine Lake shuttle (incl. Lake Connector, Alpine Start) | Parks Canada | Wed 15 Apr 2026 08:00 MDT: 40% of seats released; remaining 60% released 08:00 MDT two day | Reported ~40,000 seats booked on launch day 2026 (search title only); usually so | Shuttle seat adult $12.75, senior $6, youth $4 (Ba | yes | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Moraine Lake Road private vehicle ban and commercial/Roam options | Parks Canada; Roam Transit; licensed commercial operators | Road closed to personal vehicles year-round; commercial list at CarFreeBanff.ca; Roam Rese | Roam and commercial seats not documented (GAP). | Roam Reservable Super Pass one-day $30; Moraine La | yes | GAP | VERIFIED |
| Lake Louise Lakeshore parking and Park and Ride | Parks Canada | Park and Ride free for shuttle reservation holders; Lakeshore lot paid, fills before sunri | Lakeshore lot full before sunrise. | Alpine Start Lakeshore parking $36.75 (Banff Blog) | no | GAP | VERIFIED |
| Banff to Lake Louise: Roam 8X Lake Louise Express | Roam Transit | Runs year-round; reservations recommended in summer (roamtransit.com not fetched). | GAP | Adult $12.50 (Banff Blog); no Parks Canada Banff s | no | GAP | VERIFIED |
| Johnston Canyon parking and shuttle | Parks Canada / Roam | No Parks Canada reservation or shuttle found for 2026. Bow Valley Parkway vehicle restrict | Parking fills early (general, unsourced). Official sell-out data: GAP. | Parking free per one local guide; park pass requir | no | GAP | GAP |
| Lake O'Hara day-use bus (lottery) | Parks Canada | Random draw: apply 08:00 2 Mar to 23:59 MDT 23 Mar 2026; $10 per application (search summa | Lottery; sell-out rate: GAP. | $10 application; bus fare not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Lake O'Hara campground | Parks Canada | Tue 10 Feb 2026 08:00 MT per official pages (one blog said Thu 22 Jan). | Fill rate: GAP. | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Larch Valley / Sentinel Pass group-of-four rule | Parks Canada | No booking. Restriction typically mid-July to mid-October; sign at trailhead says mandator | n/a | Free. | no | GAP | VERIFIED |
| Banff front-country campgrounds (Tunnel Mountain, Lake Louise, Two Jack, Johnston Canyon, etc.) | Parks Canada | Thu 12 Feb 2026 08:00 MT (rescheduled date, queue). | Fill rate: GAP. | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Yoho and Kootenay front-country campgrounds | Parks Canada | Tue 20 Jan 2026 08:00 MT (Kicking Horse, Monarch, Redstreak, Marble Canyon, McLeod Meadows | Yoho demand highest July-August (search summary). | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Jasper front-country (Whistlers, Wapiti, Miette, Overflow) | Parks Canada | Tue 27 Jan 2026 08:00 MT. | GAP | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Waterton Townsite campground and backcountry | Parks Canada | Tue 3 Feb 2026 08:00 MT (rescheduled). One search summary says Townsite is first-come self | GAP | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Parks Canada backcountry camping (Banff, Yoho, Kootenay; Jasper separately) | Parks Canada | Mon 26 Jan 2026 08:00 MT (Banff, Yoho, Kootenay); Wed 28 Jan (Jasper). | Demand highest July-August (Yoho page). | Not listed. | no | [Book](https://www.parks.canada.ca/voyage-travel/reserve) | VERIFIED |
| Berg Lake Trail campsites (BC Parks) | BC Parks | 07:00 PT Tue 2 Dec 2025 for 2026 peak season (27 May - 29 Sep). | Reservations often fill up fast (BC release). | Not listed. | no | [Book](https://camping.bcparks.ca) | VERIFIED |
| Mount Assiniboine Lodge and Naiset Huts | Assiniboine Lodge / BC Parks | Lodge: 2027 booking requests accepted only 1-31 Aug 2026; replies mid-Dec. Naiset huts sum | Lodge gets about 4x as many requests as it can place; no waitlist for 2027. | GAP (rates page not fetched). | no | GAP | VERIFIED |
| Kananaskis Conservation Pass | Alberta Government | Buy online or at visitor centres any time. | No sell-out. | $15/day (one vehicle) or $90/year (up to 3 vehicle | no | GAP | VERIFIED |
| Peter Lougheed Provincial Park campgrounds (Interlakes, Lower Lake, Canyon) | Alberta Parks | Interlakes reservations opened 30 Mar 2026 09:00 on shop.albertaparks.ca, 90-day rolling w | GAP | Interlakes $31/night, season 14 May - 12 Oct; Cany | no | [Book](https://shop.albertaparks.ca) | VERIFIED |
| Yoho Valley Road and Takakkaw Falls | Parks Canada | No booking; seasonally closed until mid-June (2026), open July 2026; closes typically arou | Parking at Takakkaw and Emerald Lake fills early (Parks Canada trail page). | Free. | no | GAP | GAP |
| Icefields Parkway status and Columbia Icefield Adventure | Parks Canada; Banff Jasper Collection | No booking for road. 2026 avalanche closure in March, reopened 26 Mar. Glacier Adventure 1 | GAP | Tour pricing not fetched. | no | [Book](https://www.banffjaspercollection.com/attractions/columbia-icefield-glacier-adventure/) | VERIFIED |
| Maligne Lake cruise and Maligne Road | Banff Jasper Collection | 2026 season 29 May - 11 Oct; hours 7 Sep - 3 Oct 09:00-17:30. Maligne Road open since 11 O | Specific times only guaranteed with pre-purchased tickets (operator). | Not fetched. | no | [Book](https://www.banffjaspercollection.com/attractions/maligne-lake-cruise/) | VERIFIED |
| Jasper SkyTram | Jasper SkyTram | Fall hours 3 Sep - 27 Oct 10:00-17:00 per official site (another operator listed 7 Sep - 2 | GAP | Not fetched. | no | [Book](https://jasperskytram.com/plan-your-visit/hours) | VERIFIED |
| Jasper accommodations after 2024 wildfire | Various | No window found. | Occupancy 96% summer 2025 (Travel Weekly); some hotels being rebuilt for 2027. | GAP | yes | GAP | GAP |
| Hotels in Banff, Lake Louise, Canmore, Field (Fairmont, Deer Lodge, Emerald Lake Lodge, etc.) | Various | No lead-time or sell-out data found for named properties. | GAP; Labour Day weekend is a Canada-wide long weekend (INFERENCE). | GAP; Fairmont CLL summer offer covers 1 Jun - 30 S | yes | GAP | GAP |
| Skoki, Mount Engadine, Shadow Lake, Sundance, Num-Ti-Jah, Glacier View lodges | Various | No booking-open dates found. Skoki hiking season 25 Jun - 25 Sep. | GAP | GAP | no | GAP | GAP |
| Crypt Lake hiker boat shuttle | Waterton Shoreline Cruise | 2025 schedule: daily to 5 Oct; 2026 booking opening not found. | Advance booking strongly recommended (operator). | 2025: $34 all ages 3+ (excl. GST). | no | [Book](https://watertoncruise.com) | GAP |
| Prince of Wales Hotel, Waterton | Glacier Park Collection | 2026 season 11 May - 12 Oct (another source 5 Oct). | GAP | GAP | no | [Book](https://www.glacierparkcollection.com/lodging/prince-of-wales-hotel/) | GAP |
| Waterton Red Rock/Akamina roads and shuttle | Parks Canada | Roads typically open 1 May - 1 Nov (2024-25 schedule); no public Waterton shuttle found fo | n/a | Free. | no | GAP | GAP |
| Radium Hot Springs pools | Parks Canada | No booking; summer hours 08:30-22:00 to September; winter hours around 15 Oct. | n/a | Entry not fetched. | no | GAP | VERIFIED |
| Calgary rental car and Edmonton one-way fee | Rental companies | No data. | No 2026 shortage found; 2022 shortage only. | GAP; $1.25/km default one-way at one operator. | yes | GAP | GAP |
| Wildlife and bear orders (Hillsdale split, Lake Louise campground, Moraine group access) | Parks Canada | 2026 Hillsdale closure bulletin 16 Jul - 31 Aug (bulletin URL not mapped); Bow Valley Park | n/a | Penalty up to $25,000. | no | GAP | GAP |
| Closures and reduced hours after Labour Day | Various | 2026: Banff Gondola 8 Sep - 12 Oct 09:00-21:00; Lake Minnewanka cruise 1-17 Sep 10:00-18:0 | n/a | n/a | no | GAP | VERIFIED |
<!-- END:bookings -->

## Trails

### Family trails

<!-- BEGIN:trails-family -->
| Trail | Level | Distance | Gain | Time | Map | AllTrails | Official | For a 6 year old | Alt |
|---|---|---|---|---|---|---|---|---|---|
| **Moraine Lakeshore**<br>Banff | easy | 2.6 km (1.6 mi) | 10 m | 1 h | [Map](https://maps.google.com/?q=Moraine+Lake,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/moraine-lake-trail) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Flat, easy 1.3 km one way. |  |
| **Lake Louise Lakeshore**<br>Banff | easy | 4.6 km (2.9 mi) | 175 m | 1.5 h | [Map](https://maps.google.com/?q=Lake+Louise+Lakeshore,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/lake-louise-lakeshore) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise) | 2.3 km one way, listed gain 175 m (GAP confidence; verify). |  |
| **Fenland Loop**<br>Banff | easy | 1.9 km (1.2 mi) | 20 m | 45 min | [Map](https://maps.google.com/?q=Fenland+Trail,+Banff,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/fenland-trail--3) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Short flat. |  |
| **Johnson Lake Loop**<br>Banff | easy | 2.9 km (1.8 mi) | 90 m | 1 h | [Map](https://maps.google.com/?q=Johnson+Lake,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/johnson-lake) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Easy loop. |  |
| **Peyto Lake Lookout**<br>Banff | easy | 1.2 km (0.7 mi) | 30 m | 30 min | [Map](https://maps.google.com/?q=Bow+Summit,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/peyto-lake-viewpoint) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Short. |  |
| **Marble Canyon Walk**<br>Kootenay | easy | 1.8 km (1.1 mi) | 65 m | 45 min | [Map](https://maps.google.com/?q=Marble+Canyon,+Kootenay+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/marble-canyon) | [Official](https://parks.canada.ca/pn-np/bc/kootenay/activ/randonnee-hike/courte-short) | Bridges fenced. |  |
| **Paint Pots Walk**<br>Kootenay | easy | 2.0 km (1.2 mi) | 35 m | 45 min | [Map](https://maps.google.com/?q=Paint+Pots,+Kootenay+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/paint-pots) | [Official](https://parks.canada.ca/pn-np/bc/kootenay/activ/randonnee-hike/courte-short) | Easy. |  |
| **Wapta Falls**<br>Yoho | easy | 4.4 km (2.7 mi) | 80 m | 1.5 h | [Map](https://maps.google.com/?q=Wapta+Falls,+Yoho+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/wapta-falls) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/jour-day) | Family-friendly. |  |
| **Takakkaw Falls Walk**<br>Yoho | easy | 1.8 km (1.1 mi) | 5 m | 30 min | [Map](https://maps.google.com/?q=Takakkaw+Falls,+Yoho+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/takakkaw-falls-trail) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/jour-day) | Flat paved. |  |
| **Emerald Lakeshore**<br>Yoho | easy | 5.2 km (3.2 mi) | 5 m | 2 h | [Map](https://maps.google.com/?q=Emerald+Lake,+Yoho+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/emerald-lake-loop) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/jour-day) | Flat; 5.2 km loop slightly over 5 km. |  |
| **Lake Annette Loop**<br>Jasper | easy | 2.4 km (1.5 mi) | 90 m | 1 h | [Map](https://maps.google.com/?q=Lake+Annette,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/explore/trail/canada/alberta/lake-annette-loop) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/riviere-river) | Flat. |  |
| **Mary Schaffer Loop**<br>Jasper | easy | 3.2 km (2.0 mi) | 84 m | 1 h | [Map](https://maps.google.com/?q=Maligne+Lake,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/mary-schaeffer-loop) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne) | Flat. |  |
| **Moose Lake Loop**<br>Jasper | easy | 2.7 km (1.7 mi) | 59 m | 1 h | [Map](https://maps.google.com/?q=Maligne+Lake+Rd,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/moose-lake-loop) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne) | Easy. |  |
| **Athabasca Falls Walk**<br>Jasper | easy | 0.2 km (0.1 mi) | 5 m | 20 min | [Map](https://maps.google.com/?q=Athabasca+Falls,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/athabasca-falls) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/glaciers-icefields) | Short; hold hands. |  |
| **Toe of Athabasca Glacier**<br>Jasper | easy | 1.8 km (1.1 mi) | 60 m | 1 h | [Map](https://maps.google.com/?q=Glacier+toe,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/toe-of-the-glacier-athabasca) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/glaciers-icefields) | Short. |  |
| **Red Rock Canyon Loop**<br>Waterton Lakes | easy | 0.7 km (0.4 mi) | 10 m | 30 min | [Map](https://maps.google.com/?q=Red+Rock+Canyon,+Waterton+Lakes+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/red-rock-canyon-trail) | [Official](https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/randonee-hiking/promenades-walks) | Easy. |  |
| **Miette Mine Trail**<br>Jasper | easy | 0.8 km (0.5 mi) | GAP | 30 min | [Map](https://maps.google.com/?q=Miette+Hot+Springs,+Jasper+National+Park,+Alberta) | GAP | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/miette) | Easy. |  |
| **Rawson Lake**<br>Peter Lougheed Provincial Park | moderate | 7.8 km (4.8 mi) | 300 m | 3-4 h return | [Map](https://maps.google.com/?q=Rawson+Lake+trailhead,+Upper+Kananaskis+Lake,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/rawson-lake--11) | [Official](https://albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/peter-lougheed/rawson-lake/) | About 4 km one way with 300 m gain; a fit 6 year old may manage with breaks, but 2026 grizzly-with-cubs advisory (effective July 5) is a key | interlakes-trail |
| **Interlakes Trail (Upper and Lower Lake)**<br>Peter Lougheed Provincial Park | easy | 8.6 km (5.3 mi) | GAP | 2-3 h | [Map](https://maps.google.com/?q=North+Interlakes+Day+Use,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/interlakes-trail) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/peter-lougheed/upper-lake/) | Flat lake trail, bail out anywhere. GAP: elevation gain not verified. | kananaskis-lakes-day-use |
| **Rockwall Lookout (Rockwall fen)**<br>Peter Lougheed Provincial Park | easy | 0.5 km (0.3 mi) | 7 m | 20 min | [Map](https://maps.google.com/?q=Peter+Lougheed+Discovery+and+Information+Centre,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/rockwall) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/peter-lougheed/rockwall) | Paved, short. INFERENCE that this is the intended Rock Wall item; not the Kootenay Rockwall Trail. | kananaskis-lakes-day-use |
| **Chester Lake**<br>Peter Lougheed Provincial Park | moderate | 9.0 km (5.6 mi) | 315 m | 3-4 h | [Map](https://maps.google.com/?q=Chester+Lake+trailhead,+Smith-Dorrien+Trail,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/chester-lake-loop) | [Official](https://albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/peter-lougheed/chester-lake/) | Gentle old road, best family larch hike; 9 km is a long day for a 6 year old but doable with breaks. | ptarmigan-cirque |
| **Ptarmigan Cirque**<br>Peter Lougheed Provincial Park (Highwood Pass) | moderate | 4.5 km (2.8 mi) | 210 m | 2-3 h | [Map](https://maps.google.com/?q=Ptarmigan+Cirque+trailhead,+Highwood+Pass,+Peter+Lougheed+Provincial+Park+(Highwood+Pass),+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/ptarmigan-cirque-interpretive) | [Official](https://albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/peter-lougheed/ptarmigan-cirque-interpretive/) | Short loop, best family larch pick; some steep parts and alpine weather. | wedge-pond |
| **Grassi Lakes (easy route)**<br>Canmore Area / Bow Valley | easy | 3.8 km (2.4 mi) | 125 m | 1.5-2 h | [Map](https://maps.google.com/?q=Grassi+Lakes+trailhead,+Canmore,+Canmore+Area+/+Bow+Valley,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/grassi-lake-trail) | [Official](https://albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/canmore-and-area/grassi-lakes-upper) | Wide old road, easy route; the Interpretive route is harder. | wedge-pond |
| **Troll Falls**<br>Kananaskis Village / Spray Valley | easy | 3.4 km (2.1 mi) | 155 m | 1-1.5 h | [Map](https://maps.google.com/?q=Stoney+trailhead,+Kananaskis+Village,+Kananaskis+Village+/+Spray+Valley,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/troll-falls) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/kananaskis-valley/troll-falls/) | Flat family classic; Upper Falls +0.9 km. | wedge-pond |
| **Ribbon Creek**<br>Kananaskis Village | easy | 8.8 km (5.5 mi) | GAP | GAP | [Map](https://maps.google.com/?q=Ribbon+Creek+day+use,+Kananaskis+Village,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/ribbon-creek-kovach-and-terrace-loop) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/kananaskis-valley/ribbon-creek-summer/) | GAP: distances not found; no search result covered Ribbon Creek. | troll-falls |
| **Mount Lorette Ponds loop**<br>Kananaskis Country | easy | 1.0 km (0.6 mi) | GAP | 30 min | [Map](https://maps.google.com/?q=Mount+Lorette+Ponds,+Kananaskis+Country,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/mount-lorette-pond-trail) | [Official](https://www.albertaparks.ca/parks/kananaskis/bow-valley-pp/information-facilities/day-use/mt-lorette-ponds/) | Easy flat. | wedge-pond |
| **Elbow Falls loop**<br>Elbow-Sheep Wildland | easy | 0.8 km (0.5 mi) | 27 m | 30 min | [Map](https://maps.google.com/?q=Elbow+Falls,+Elbow-Sheep+Wildland,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/elbow-falls-loop) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/elbow-valley/elbow-falls-interpretive/) | Short loop. | wedge-pond |
| **Wedge Pond loop**<br>Spray Valley Provincial Park | easy | 1.0 km (0.6 mi) | GAP | 20-45 min | [Map](https://maps.google.com/?q=Wedge+Pond,+Spray+Valley+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/wedge-pond-loop-trail) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/kananaskis-valley/wedge-pond/) | Flat. | troll-falls |
| **Kinney Lake**<br>Mount Robson Provincial Park | easy | 10.0 km (6.2 mi) | 131 m | 3-3.5 h | [Map](https://maps.google.com/?q=Berg+Lake+trailhead,+Mount+Robson+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/kinney-lake) | [Official](https://bcparks.ca/mount-robson-park/berg-lake-trail/) | Flat; 9-10 km return is a long day; bikes allowed to Kinney. | overlander-falls-trail |
| **Overlander Falls trail**<br>Mount Robson Provincial Park | easy | 2.3 km (1.4 mi) | 90 m | 1 h | [Map](https://maps.google.com/?q=Robson+Meadows+campground+road,+Mount+Robson+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/overlander-falls) | GAP | BC Parks lists as a short family hike. | mount-robson-viewpoint |
| **Elk Lakes (Lower and Upper)**<br>Elk Lakes Provincial Park | easy | 4.0 km (2.5 mi) | 30 m | 1.5 h | [Map](https://maps.google.com/?q=Elk+Lakes+trailhead,+Elk+Lakes+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/lower-elk-lake) | [Official](https://bcparks.ca/elk-lakes-park/hiking/) | Flat 2 km one way (1 km + 1 km). | elk-lakes-park |
<!-- END:trails-family -->

### Adult-only trails, each with its family alternative

<!-- BEGIN:trails-adult -->
| Trail | Level | Distance | Gain | Time | Map | AllTrails | Official | Why adults only | Family alternative |
|---|---|---|---|---|---|---|---|---|---|
| **Larch Valley to Sentinel Pass**<br>Banff | hard | 11.2 km (7.0 mi) | 750 m | 5-6 h | [Map](https://maps.google.com/?q=Moraine+Lake,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/sentinel-pass-trail-2) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise) | Too long and steep for a 6 year old (11.2 km return, 750 m). | moraine-lakeshore |
| **Plain of Six Glaciers (to teahouse and Abbot Pass viewpoint)**<br>Banff | hard | 11.8 km (7.3 mi) | 595 m | 5-6 h | [Map](https://maps.google.com/?q=Lake+Louise+Lakeshore,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/plain-of-six-glaciers-trail) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise) | 11.8 km return, 595 m: too long for a 6 year old. Teahouse figure used is Parks Canada's 5.9 km one way. Abbot Pass hut climb is mountaineer | lake-louise-lakeshore |
| **Lake Agnes Tea House**<br>Banff | moderate | 7.8 km (4.8 mi) | 495 m | 3-4 h | [Map](https://maps.google.com/?q=Lake+Louise+Lakeshore,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/lake-agnes-trail-to-plain-of-six-glaciers-trail-loop) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise) | 3.9 km one way, 495 m: steady switchbacks; a fit 6 year old may manage but it is long. Classified adult_only for safety. | lake-louise-lakeshore |
| **Iceline Trail**<br>Yoho | hard | 20.3 km (12.6 mi) | 1090 m | 7-8 h | [Map](https://maps.google.com/?q=Takakkaw+Falls+parking,+Yoho+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/iceline-summit) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/jour-day) | 20 km, 1090 m: not for a 6 year old. | takakkaw-falls-walk |
| **Emerald Triangle (via Wapta Highline)**<br>Yoho | hard | 18.8 km (11.7 mi) | 1285 m | 7-8 h | [Map](https://maps.google.com/?q=Emerald+Lake,+Yoho+National+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/emerald-triangle) | [Official](https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/jour-day) | 18.8 km loop, 1285 m: not suitable. | emerald-lakeshore |
| **Sunshine Meadows to Citadel Pass**<br>Banff | moderate | 10.2 km (6.3 mi) | 580 m | 4-6 h | [Map](https://maps.google.com/?q=Sunshine+Village,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/sunshine-meadows-via-banff-ave-and-citadel-pass) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | Parks Canada lists Sunshine Meadows 10.2 km, 580 m; Citadel Pass add-on is GAP. | johnson-lake-loop |
| **Cory Pass Loop**<br>Banff | hard | 11.7 km (7.3 mi) | 930 m | 5-6 h | [Map](https://maps.google.com/?q=Fireside+picnic+area,+Hwy+1A,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/cory-pass) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | 11.7 km, 930 m, scrambling: no. | fenland-loop |
| **Mount Fairview**<br>Banff | hard | 10 km (6.2 mi) | 990 m | 4-5 h | [Map](https://maps.google.com/?q=Lake+Louise+Lakeshore,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/mount-fairview) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | 5 km one way, 990 m: no. | lake-louise-lakeshore |
| **Bourgeau Lake**<br>Banff | hard | 13.4 km (8.3 mi) | 730 m | 5-6 h | [Map](https://maps.google.com/?q=Bourgeau+Lake+trailhead,+Trans-Canada+Hwy,+Banff+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/bourgeau-lake-trail) | [Official](https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking) | 6.7 km one way, 730 m: no. | johnson-lake-loop |
| **Crypt Lake**<br>Waterton Lakes | hard | 17.2 km (10.7 mi) | 675 m | 6 h | [Map](https://maps.google.com/?q=Crypt+Landing+(boat+from+Waterton+townsite),+Waterton+Lakes+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/crypt-lake-trail-loop) | [Official](https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/randonee-hiking) | Includes a tunnel and narrow ledge: Parks Canada difficult. Not for a 6 year old. | red-rock-canyon-loop |
| **Bear's Hump**<br>Waterton Lakes | moderate | 2.8 km (1.7 mi) | 200 m | 1-1.5 h | [Map](https://maps.google.com/?q=Waterton+Visitor+Centre,+Waterton+Lakes+National+Park,+Alberta) | GAP | [Official](https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/randonee-hiking/promenades-walks) | Short but steep with drop offs; ability varies. | red-rock-canyon-loop |
| **Skyline Trail**<br>Jasper | hard | 44 km (27.3 mi) | 1650 m | 2 days | [Map](https://maps.google.com/?q=Maligne+Lake,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/skyline-trail-jasper) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/passez-stay/arrierepays-backcountry/sugg-sentiers_trip-ideas/skyline) | Multi-day backpack. | mary-schaffer-loop |
| **Opal Hills Loop**<br>Jasper | hard | 8.2 km (5.1 mi) | 460 m | 3-4 h | [Map](https://maps.google.com/?q=Maligne+Lake+Road,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/opal-hills-loop-trail--2) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne) | 8.2 km, 460 m. | moose-lake-loop |
| **Sulphur Skyline**<br>Jasper | hard | 8 km (5.0 mi) | 700 m | 3-4 h | [Map](https://maps.google.com/?q=Miette+Hot+Springs,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/sulphur-skyline-trail) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/miette) | 8 km, 700 m. | jasper-miette-mine-trail |
| **Wilcox Pass**<br>Jasper | moderate | 8 km (5.0 mi) | 390 m | 3-4 h | [Map](https://maps.google.com/?q=Wilcox+Campground,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/wilcox-viewpoint-via-wilcox-pass) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/glaciers-icefields) | First viewpoint is 2.4 km; full 8 km is long. | toe-glacier-walk |
| **Parker Ridge**<br>Jasper | moderate | 5.4 km (3.4 mi) | 250 m | 2-3 h | [Map](https://maps.google.com/?q=Parker+Ridge+trailhead,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/parker-ridge--3) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails) | 5.4 km, 250 m: a fit 6 year old could try. | toe-glacier-walk |
| **Bald Hills**<br>Jasper | hard | 10.4 km (6.5 mi) | 500 m | 4-5 h | [Map](https://maps.google.com/?q=Maligne+Lake,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/bald-hills-trail-loop) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne) | 10.4 km, 500 m. | mary-schaffer-loop |
| **Cavell Meadows**<br>Jasper | hard | 7.7 km (4.8 mi) | 553 m | GAP | [Map](https://maps.google.com/?q=Cavell+Road,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/edith-cavell-meadows-trail) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/cavell) | GAP distance not verified. | lake-annette-loop |
| **Fryatt Valley**<br>Jasper | hard | 22 km (13.7 mi) | GAP | overnight | [Map](https://maps.google.com/?q=Fryatt+trailhead,+Jasper+National+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/fryatt-valley-trail-via-geraldine) | [Official](https://parks.canada.ca/pn-np/ab/jasper/activ/passez-stay/arrierepays-backcountry/sugg-sentiers_trip-ideas/fryatt) | Backpacking only. | athabasca-falls-trail |
| **Sarrail Ridge**<br>Peter Lougheed Provincial Park | hard | 11.3 km (7.0 mi) | 675 m | 5-6 h | [Map](https://maps.google.com/?q=Rawson+Lake+trailhead,+Upper+Kananaskis+Lake,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/sarrail-ridge-via-rawson-lake-trail) | GAP | Steep final gully (close to 400 m in just over 1 km); too hard for 6 year old. | rawson-lake |
| **Upper Kananaskis Lake Circuit**<br>Peter Lougheed Provincial Park | moderate | 15.7 km (9.8 mi) | GAP | 5-6 h | [Map](https://maps.google.com/?q=North+Interlakes+/+White+Spruce,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/upper-kananaskis-lake-trail) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/peter-lougheed/upper-lake/) | Too long for 6 year old. | interlakes-trail |
| **Indefatigable Bench viewpoint**<br>Peter Lougheed Provincial Park | hard | GAP | 250 m | GAP | [Map](https://maps.google.com/?q=Interlakes+Day+Use,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/indefatigable-trail) | GAP | Unofficial decommissioned trail in grizzly habitat; not for a child. | interlakes-trail |
| **Ha Ling Peak**<br>Bow Valley / Canmore | hard | 7.0 km (4.4 mi) | 780 m | 4-5 h | [Map](https://maps.google.com/?q=Ha+Ling+trailhead,+Canmore,+Bow+Valley+/+Canmore,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/ha-ling-peak) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/canmore-and-area/ha-ling/) | About 700-840 m steep climb; not for child. | grassi-lakes-upper |
| **Tent Ridge Horseshoe**<br>Spray Valley Provincial Park | hard | 10.0 km (6.2 mi) | 810 m | 4-5.5 h | [Map](https://maps.google.com/?q=Tent+Ridge+trailhead,+Smith-Dorrien,+Spray+Valley+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/tent-ridge-horseshoe?mobileMap=false) | GAP | Scramble sections and exposed ridge; not for 6 year old. | chester-lake |
| **Burstall Pass**<br>Peter Lougheed Provincial Park | hard | 14.8 km (9.2 mi) | 470 m | 5-6 h | [Map](https://maps.google.com/?q=Burstall+Pass+trailhead,+Smith-Dorrien,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/burstall-pass--3) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/peter-lougheed/burstall-pass/) | Long and steep climb; official 7.4 km one way. | chester-lake |
| **Lillian Lake**<br>Peter Lougheed Provincial Park | moderate | 6.0 km (3.7 mi) | 457 m | GAP | [Map](https://maps.google.com/?q=Galatea+Day+Use,+Hwy+40,+Peter+Lougheed+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/galatea-creek-to-lillian-lake) | [Official](https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/kananaskis-valley/galatea-creek/) | GAP: separate Lillian data not found; combined Lillian+Galatea listing is 9.3 mi and 3018 ft. | ptarmigan-cirque |
| **Berg Lake Trail**<br>Mount Robson Provincial Park | hard | 46.0 km (28.6 mi) | 900 m | 2-3 days | [Map](https://maps.google.com/?q=Berg+Lake+trailhead,+Mount+Robson+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/berg-lake-trail) | [Official](https://bcparks.ca/mount-robson-park/berg-lake-trail/) | Multi-day permit hike; not feasible with 6 year old. | kinney-lake |
| **Mount Shark to Lake Magog**<br>Mount Assiniboine Provincial Park | hard | 52.0 km (32.3 mi) | 1000 m | 1.5-2 days one way | [Map](https://maps.google.com/?q=Mount+Shark+trailhead,+Mount+Assiniboine+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/lake-magog-to-mt-shark-trailhead-via-wonder-pass) | [Official](https://bcparks.ca/mount-assiniboine-park/hiking/) | About 27 km one way (about 54 km return); not for a 6 year old on foot. | lake-magog |
| **Sunburst Lake to Lake Magog**<br>Mount Assiniboine Provincial Park | easy | 6.8 km (4.2 mi) | 271 m | 20 min from Magog | [Map](https://maps.google.com/?q=Lake+Magog+campground,+Mount+Assiniboine+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/sunburst-and-cerulean-lake-via-lake-magog-campground) | [Official](https://bcparks.ca/mount-assiniboine-park/hiking/) | Short but needs park access; GAP: Sunburst Peak details not found. | lake-magog |
| **Elk Lakes Viewpoint trail**<br>Elk Lakes Provincial Park | moderate | 2.4 km (1.5 mi) | 122 m | 1.5 h | [Map](https://maps.google.com/?q=Elk+Lakes+trailhead,+Elk+Lakes+Provincial+Park,+British+Columbia) | [AllTrails](https://www.alltrails.com/trail/canada/british-columbia/lower-elk-lake-viewpoint-trail) | [Official](https://bcparks.ca/elk-lakes-park/hiking/) | Steep and route-finding; not a good fit. | elk-lakes-lower-upper |
| **Beauvais Lake Trail**<br>Beauvais Lake Provincial Park | moderate | 9.7 km (6.0 mi) | 354 m | 2.5-4 h | [Map](https://maps.google.com/?q=Beauvais+Lake+day+use,+Beauvais+Lake+Provincial+Park,+Alberta) | [AllTrails](https://www.alltrails.com/trail/canada/alberta/beauvais-lake-park-trail) | [Official](https://www.albertaparks.ca/parks/south/beauvais-lake-pp/information-facilities/trails/) | Listing says older children only. | beauvais-lake-pp |
<!-- END:trails-adult -->

## Adventures

<!-- BEGIN:adventures -->
| Adventure | Park | Min age | Height | Weight | Child 6 yrs | Price (CAD 2026) | Early Sept | Map | Status |
|---|---|---|---|---|---|---|---|---|---|
| Banff Gondola (Sulphur Mountain summit) | Banff | GAP | none stated | - | yes | Not published in fetched text (prices load dynamically). One | Open year-round except short November maintenance; free shuttle daily  | [Map](https://maps.google.com/?q=Banff+Gondola) | VERIFIED |
| Sulphur Mountain switchback trail (hike up, gondola down) | Banff | GAP | none stated | - | unknown | Free trail; gondola down ticket priced as gondola | Open in early Sept (INFERENCE; snow possible later). 2026 data not fet | [Map](https://maps.google.com/?q=Sulphur+Mountain+Trail+Banff) | GAP |
| Lake Louise Summer Gondola (grizzly/wildlife viewing, Whitehorn corridor) | Banff | GAP | 106 | - | with_adult | Window 2026: adult (18-64) 65, senior 54, youth (13-17) 29,  | Jun 5-Oct 11, 2026, daily 9:00-4:30 (search summary). 2029 dates unkno | [Map](https://maps.google.com/?q=Lake+Louise+Sightseeing+Gondola) | VERIFIED |
| Lake Louise Sightseeing (same product as Lake Louise Gondola) | Banff | GAP | none stated | - | with_adult | See lake-louise-gondola | See lake-louise-gondola | [Map](https://maps.google.com/?q=Lake+Louise+Sightseeing+Gondola) | VERIFIED |
| Jasper SkyTram (Whistlers Mountain) | Jasper | GAP | none stated | - | yes | Not in fetched text (tickets page returns no prices). Kids G | Apr 15-Oct 25, 2026, weather dependent (official page and opening-date | [Map](https://maps.google.com/?q=Jasper+SkyTram) | VERIFIED |
| Columbia Icefield Adventure (Ice Explorer onto Athabasca Glacier) | Jasper | GAP | none stated | - | yes | Not published in fetched text; ages 5 and under free | May 1-Oct 12, 2026, weather dependent (page; opening-dates page) | [Map](https://maps.google.com/?q=Columbia+Icefield+Discovery+Centre) | VERIFIED |
| Columbia Icefield Skywalk (Glacier Skywalk) | Jasper | GAP | none stated | - | yes | Not published in fetched text | Columbia Icefield Skywalk May 1-Oct 12, 2026 (opening-dates page) | [Map](https://maps.google.com/?q=Columbia+Icefield+Skywalk) | VERIFIED |
| Athabasca Glacier guided ice walk (Icewalks) | Jasper | 7 | none stated | - | unknown | Adult about 138-144 (2024/2025 listings); child price GAP (o | Daily 1 Jun-30 Sep (source undated). Runs early Sept: yes (INFERENCE) | [Map](https://maps.google.com/?q=Athabasca+Glacier+Icewalks) | GAP |
| Maligne Lake Cruise and Spirit Island | Jasper | GAP | none stated | - | yes | Not published in fetched text; ages 5 and under free | 2026 May 29-Oct 11 (opening-dates page); main page says cruise closed  | [Map](https://maps.google.com/?q=Maligne+Lake+Cruise) | VERIFIED |
| Moraine Lake canoe rental | Banff | GAP | none stated | - | unknown | 170 + tax per canoe per hour (includes paddles, PFDs, basic  | Mid-June to mid-September, water-level dependent; no reservations, fir | [Map](https://maps.google.com/?q=Moraine+Lake+Canoe+Dock) | VERIFIED |
| Lake Louise canoe rental | Banff | GAP | none stated | - | with_adult | About 160 per hour per canoe (blog; unverified) | Summer season, exact dates GAP | [Map](https://maps.google.com/?q=Lake+Louise+Boathouse) | GAP |
| Emerald Lake canoe rental (Boathouse Trading Co.) | Yoho | GAP | none stated | - | with_adult | 100 per hour per canoe incl. paddles and PFDs; no half-hour  | May long weekend to Thanksgiving weekend (page says closes Oct 11); 10 | [Map](https://maps.google.com/?q=Emerald+Lake+Boathouse+Yoho) | VERIFIED |
| Kicking Horse family/gentle rafting (Wild Water Adventures Gentle Introduction; Banff Adventures family trip) | Yoho/Golden BC | 5 | none stated | 22.7 | no | Page shows 95/119 unlabelled (child and young-child rates ex | May long weekend to mid-September; trip 9:15-1:00 | [Map](https://maps.google.com/?q=Kicking+Horse+River+rafting+Golden+BC) | VERIFIED |
| Kicking Horse whitewater rafting (Class III-IV: Exciter, Tradition, Maximum Horsepower) | Yoho/Golden BC | 12 | none stated | - | no | GAP | Summer; early Sept GAP | [Map](https://maps.google.com/?q=Kicking+Horse+River+rafting+Golden+BC) | GAP |
| Kananaskis River rafting (Class II-III) | Kananaskis | 5 | none stated | 159 | yes | Adult (16+) 97 + 3 river fee + tax; child (5-15) 62 + 3 rive | Daily 1:30 pm, mid-May to mid-September (so early Sept ok, ends border | [Map](https://maps.google.com/?q=Kananaskis+River+rafting) | VERIFIED |
| Bow River float / raft | Banff | GAP | none stated | - | unknown | GAP | GAP | [Map](https://maps.google.com/?q=Bow+River+Banff) | GAP |
| Banff horseback rides (Banff Trail Riders / Warner Stables, Spray River, Bow River, Sulphur Mountain) | Banff | 8 | none stated | 104 | no | Bow River 1 hr from 102, Spray River 1 hr from 109, 2 hr 198 | Season dates not on page; office 9:00-6:00 daily | [Map](https://maps.google.com/?q=Warner+Stables+Banff) | VERIFIED |
| Brewster Stables Lake Louise horseback | Banff | 8 | none stated | 113 | no | GAP | Reopen May 2026; early Sept GAP | [Map](https://maps.google.com/?q=Lake+Louise+horseback) | GAP |
| Jasper and Waterton horseback rides | Jasper/Waterton | GAP | none stated | - | unknown | GAP | GAP | [Map](https://maps.google.com/?q=Jasper+horseback+riding) | GAP |
| Mount Norquay Via Ferrata (Explorer, Ridgewalker; also Skyline, Summiteer) | Banff | 12 | none stated | - | no | Explorer 169-199; Ridgewalker 219-259 (resellers differ; Nor | Mid-June to early Oct, morning and afternoon departures. Early Sept: y | [Map](https://maps.google.com/?q=Mount+Norquay+Banff) | VERIFIED |
| Lake Minnewanka Cruise (Classic, Premium, Junior Explorer) | Banff | GAP | none stated | - | yes | Not published in fetched text. One free child (6-15) per pay | 2026: Classic May 8-Oct 12; Premium and Beer Voyage May 22-Sep 27; Jun | [Map](https://maps.google.com/?q=Lake+Minnewanka+Cruise) | VERIFIED |
| Banff Upper Hot Springs | Banff | GAP | none stated | - | with_adult | Single entry 2026: adult (18-64) 19.75, youth (3-17) 17.25,  | Hours page not fetched; no early-September closure listed on FAQ | [Map](https://maps.google.com/?q=Banff+Upper+Hot+Springs) | VERIFIED |
| Radium Hot Springs pools | Kootenay | GAP | none stated | - | with_adult | Single entry: adult 19.75, youth (3-17) 17.25, under 3 free, | Open daily all year; fall hours Sep 1-Oct 12, 2026: Mon-Fri 11:30-9, S | [Map](https://maps.google.com/?q=Radium+Hot+Springs+Pools) | VERIFIED |
| Miette Hot Springs | Jasper | GAP | none stated | - | with_adult | Single entry: adult 19.75, youth (3-17) 17.25, under 3 free, | Sep 8-Oct 12, 2026: daily 11-9, last entry 8:30; closed from Oct 13 to | [Map](https://maps.google.com/?q=Miette+Hot+Springs) | VERIFIED |
| Fairmont Banff Springs spa | Banff | GAP | none stated | - | unknown | GAP | GAP | [Map](https://maps.google.com/?q=Fairmont+Banff+Springs) | GAP |
| Golden Skybridge (bridges, coaster, zipline) | Golden BC | GAP | none stated | - | yes | Prices not in fetched text (ticket page shows only Buy Ticke | 2026 listing: hours page shows Sep 8-27 weekdays 10-6, weekends 10-8;  | [Map](https://maps.google.com/?q=Golden+Skybridge) | VERIFIED |
| Kicking Horse Mountain Resort Golden Eagle Express gondola and Grizzly Bear Refuge (Boo) | Golden BC | GAP | none stated | - | yes | 2026 child (6-12): Sightseeing Day Pass (gondola) 37 (adult  | Summer May 30-Sep 27, 2026. Sep 1-7 daily: gondola 10-4:30, refuge 10- | [Map](https://maps.google.com/?q=Kicking+Horse+Mountain+Resort) | VERIFIED |
| Scenic helicopter flights (Three Sisters, Assiniboine, Continental Divide) | Canmore/Banff | 2 | none stated | - | yes | 25 min about 320-339 adult; child 6-12 half; 2-5 free (year  | Summer; helipad closes Nov. Early Sept: yes | [Map](https://maps.google.com/?q=Canmore+Helipad) | GAP |
| Heli-hiking (Backroads family option etc.) | Rockies | 4 | none stated | - | yes | GAP; packaged trips thousands per family | Late June to early Sept; mid-Sept GAP | [Map](https://maps.google.com/?q=Canadian+Rockies+heli+hiking) | GAP |
| Burgess Shale guided hike: Mount Stephen fossil beds (Parks Canada, Yoho) | Yoho | 8 | none stated | - | no | Senior 85.47; youth 69.19; adult GAP; reservation fee 11.50  | June-Sept 2026. Early Sept: yes | [Map](https://maps.google.com/?q=Mount+Stephen+Fossil+Beds+Yoho) | VERIFIED |
| Burgess Shale guided hike: Walcott Quarry (Parks Canada, Yoho) | Yoho | GAP | none stated | - | no | Adult 131; senior 110.04; youth 89.08 | July-Sept 2026; Parks Canada bulletin 21 Jul 2026 prohibits access to  | [Map](https://maps.google.com/?q=Walcott+Quarry+Yoho) | VERIFIED |
| Crypt Lake boat shuttle (Waterton Shoreline Cruises) | Waterton | GAP | none stated | - | unknown | Crypt Shuttle 35 for ages 3+, infants free (ex GST) | 2026: daily morning 30 May-12 Oct. Early Sept: yes | [Map](https://maps.google.com/?q=Waterton+Shoreline+Cruise) | VERIFIED |
| Waterton border cruise and Goat Haunt cruise | Waterton | GAP | none stated | - | yes | Border Cruise: adult (13+) 67, child (3-12) 33, infant free; | Border Cruise May 2-Oct 12 (Sep 8-20 daily 2:00 pm); Goat Haunt Landin | [Map](https://maps.google.com/?q=Waterton+Shoreline+Cruise) | VERIFIED |
| Waterton Red Rock Parkway (scenic drive) | Waterton | GAP | none stated | - | yes | Free with park pass | Usually open about 8 May to late Oct (pattern, not 2026 confirmed); ea | [Map](https://maps.google.com/?q=Red+Rock+Parkway+Waterton) | GAP |
| Bow Valley Parkway cycling (seasonal vehicle closure 17 km) | Banff | GAP | none stated | - | with_adult | Free; rentals about 30-80 per day (blog) | Fall restriction: Parks Canada says 28 Aug-2 Oct; a blog says 1 Sep-6  | [Map](https://maps.google.com/?q=Bow+Valley+Parkway+Banff) | GAP |
| Legacy Trail Banff to Canmore | Banff | GAP | none stated | - | with_adult | Free; rentals as above | Paved; bike season; early Sept yes (INFERENCE) | [Map](https://maps.google.com/?q=Legacy+Trail+Banff) | GAP |
| Jasper bike rentals | Jasper | GAP | none stated | - | unknown | GAP | GAP | [Map](https://maps.google.com/?q=Jasper+bike+rental) | GAP |
| Jasper wildlife tours (SunDog, Maligne Adventures) | Jasper | GAP | none stated | - | yes | SunDog about 69-74 adult, 35-39 child; 3-3.5 hours | Operates in Sept (INFERENCE); elk rut starts ~late Aug | [Map](https://maps.google.com/?q=Jasper+wildlife+tour) | GAP |
| Jasper Dark Sky Preserve stargazing | Jasper | GAP | none stated | - | yes | Festival events various | Festival 16-25 Oct 2026 (outside window). Stargazing in early Sept: po | [Map](https://maps.google.com/?q=Jasper+Dark+Sky+Preserve) | GAP |
| Canmore Nordic Centre summer (mountain biking, skills park, hiking, disc golf) | Canmore | GAP | none stated | - | yes | Skills park free; bike rental on site (Trail Sports); Kanana | Summer to autumn; early Sept: yes | [Map](https://maps.google.com/?q=Canmore+Nordic+Centre) | VERIFIED |
| Nakiska summer gondola / coaster | Kananaskis | GAP | none stated | - | unknown | N/A | No summer ops in 2026; plan for 2027 coaster, lift-served biking, hiki | [Map](https://maps.google.com/?q=Nakiska+Ski+Area) | GAP |
| Yamnuska guided scrambles (Yamnuska Mountain Adventures) | Kananaskis | GAP | none stated | - | no | GAP | Summer; GAP | [Map](https://maps.google.com/?q=Mount+Yamnuska) | GAP |
| Elk rut viewing (Banff, Jasper) and bighorn rut | Banff/Jasper | GAP | none stated | - | with_adult | Free | Elk rut: Parks Canada Banff advisory from 29 Aug; Jasper bulletin says | [Map](https://maps.google.com/?q=Banff+Townsite+elk) | GAP |
<!-- END:adventures -->

Hard limits that rule the child out (assuming 6 years, 115 cm, 20 kg): Norquay Via Ferrata (12+, 40 kg), Kicking Horse family float (50 lb / 23 kg minimum), Golden Skybridge zipline (23 kg), horse rides in Banff and Lake Louise (8+), Burgess Shale Mt Stephen (8+), Athabasca IceWalks (about 7+, sources conflict). The Kananaskis River raft (5+, 18 kg) passes by about 2 kg: weigh the child before booking.

---

## Hazards

- **Bears.** September is berry season (hyperphagia); expect at least one closure or group-access order somewhere by mid-September (researcher INFERENCE). Carry bear spray clipped on, not in a pack. Keep the child within arm's reach, pick them up and back away, never run (secondary sources; official Parks Canada bear pages not retrieved, GAP). Some closures are posted only at the trailhead, not online (Parks Canada Banff bulletin).
- **Solo adults on split days.** Seven days put one adult alone on an adult-only trail. Use the busiest options, agree a turnaround time and a hard collect time, and consider a satellite messenger (no cell on most of these trails; INFERENCE).
- **Elk rut.** Bulls charge people and vehicles. 30 m minimum (Parks Canada), 60 m suggested in rut. Report to Banff dispatch 403-762-1470.
- **Cold and snow.** Lake Louise's September mean low is -0.8 C (Parks Canada). At least one September snowfall at altitude is near-certain (local anecdote); first snow at the ski hills came 24 Aug 2025, about 30 Aug 2026 and 7 Sep 2023. Warm layers every day above 2,000 m.
- **Glaciers.** Stay behind the ropes at the Athabasca Glacier toe. A child died in a crevasse there in 1990; a backcountry skier died above the icefall in May 2026.
- **Water and edges.** Glacial rivers are cold and fast (INFERENCE; no Parks Canada page retrieved). Hold hands at Johnston Canyon catwalks, Athabasca Falls and Sunwapta Falls.
- **Smoke.** Smoke reached the Rockies in August-September in at least 2017, 2018, 2020, 2022 and 2024. Day 6 is the Jasper swap day; Days 13 and 14 swap with each other.
- **Wildfire.** Jasper's 2024 fire closed the town and the Parkway for weeks. Check the Alberta wildfire app and fire bans before each Parkway day.
- **Exposure.** Sulphur Skyline (exposed ridge), Sarrail Ridge (slippery gully), Ha Ling (scree), Iceline (moraine and exposure).
- **Altitude and sun.** Low risk at these heights after a first night in Banff; UV is high on snow and water even in September (INFERENCE).
- **Roads.** Dawn and dusk wildlife on every park highway; check the rental damage waiver covers animal strikes (GAP).
- **Emergency.** 911 everywhere. Banff dispatch 403-762-1470; Jasper dispatch 780-852-6155; Banff warden 403-762-1460.

## Gotchas / Known issues

1. Moraine Lake is shuttle-only. Booking 40% of seats in April is the plan; the 48-hour release is the fallback, and for Mon 17 it falls at 08:00 on Sat 15, while you are in Jasper about to drive a road with no signal.
2. One shuttle ticket covers Moraine, Lake Louise and the Lake Connector. Use the Connector as the Larch Valley fallback.
3. The Larch Valley group-of-four rule can stop a solo adult. Whether a child counts is unknown.
4. Bear spray cannot go on any flight.
5. Fuel on the Parkway is only at Saskatchewan Crossing, and only seasonally.
6. The Bow Valley Parkway's eastern section may be closed to cars in September: reach Johnston Canyon from Castle Junction.
7. Sunshine's gondola may close after Sun 16 Sep 2029 (third-Sunday pattern, two data points). That is why it is on Day 2.
8. A 6-year-old is not free on the gondolas or cruises (5 and under are).
9. BC requires a booster seat until age 9 or 145 cm (2008 rule, still cited; ICBC text not retrieved). Yoho, Kootenay and Robson are in BC. Bring your own booster.
10. Mount Robson is probably on Pacific time; Field and Yoho time zone also needs checking (GAP).
11. The Smith-Dorrien road (Hwy 742) is gravel. Most rental contracts bar unsealed roads (INFERENCE; no Canadian policy retrieved). It is only used in a fallback.
12. Kananaskis needs its own Conservation Pass to park; the Parks Canada pass does not cover it.
13. The Maligne cruise does not land on Spirit Island and has no toilet on board.
14. The Minnewanka Junior Explorer kids' cruise ends 31 Aug, before either window.
15. The Iceline has two official sets of figures (20.3 km / 1,090 m and 20.8 km / 710 m). Stanley Glacier figures also conflict, and it is not in the dataset.
16. Larch Valley is about 8 km return to the meadow (researcher, unverified); the dataset's 11.2 km is to Sentinel Pass.
17. `sun-times.py` in this folder still holds the Norway coordinates from an earlier trip. The Rockies times above used its function with the coordinates listed under Light.
18. Lake Louise village has no clear indoor pool plus breakfast option (GAP) and thin groceries. Shop in Jasper on Day 7 and Canmore on Day 12.

---

## State of knowledge

**Verified (2026 sources, used as a pattern)**
- Moraine Lake Road private-vehicle ban; 2026 shuttle seasons, 40/60 release rule, Park and Ride, change fee (Parks Canada)
- Icefields Parkway length, fuel and toilet points, no cell signal (icefieldsparkway.com)
- 2026 closures: Maligne Canyon, Edith Cavell, Opal Hills, Johnston Canyon from 13 Oct, Upper Kananaskis Lake circuit, Crypt Lake boat access, Lake Minnewanka trail past Stewart Canyon (Parks Canada, Alberta Parks)
- Trail figures for most family and adult trails (Parks Canada, Alberta Parks, BC Parks via `trails.json`)
- Child limits: Lake Louise Gondola, Emerald canoe, Kananaskis raft, Kicking Horse float, Golden Skybridge, Norquay Via Ferrata, Banff horse rides, hot springs supervision rules
- 2026 hours: Miette, Radium, Maligne cruise, Banff Gondola, Lake Louise Gondola, Minnewanka cruise
- Bear spray rules; elk 30 m rule; Alberta child seat rules
- Monthly September averages for Banff and Lake Louise (Parks Canada)
- Computed sun times

**GAP or INFERENCE**
- Every 2029 date, price and closure, including the shuttle launch date and the Sunshine closing date
- All drive times except Calgary-Banff and Banff-Lake Louise (matrix INFERENCE); all legs to trailheads not in the matrix
- Whether a 6-year-old counts in the group-of-four rule; whether the rule is mandatory in 2029
- Larch timing for 18 and 21 Sep 2029
- Sunshine gondola price; Columbia Icefield child rules (FAQ 404); SkyTram fall hours (two listings conflict)
- Mount Robson and Field time zones; BC booster rule current text
- Jasper post-fire lodging and services in 2029
- Rental contract terms for gravel; one-way fee to Edmonton
- Moraine and Lake Louise canoe season ends; tea house dates
- Ontario 2029-30 school calendar (start date assumed Tue 4 Sep)
- The child's real height, weight and walking ceiling
- Family walking and driving totals; the base split itself

---

## Open questions for you

1. **Exact dates and school.** Is 8-22 Sep workable for the school, or does it need to be 1-15 Sep (9 school days) or an 8-night version (5 days)?
2. **Calgary or Edmonton out?** This loop ends in Kananaskis, so Calgary is simpler and avoids a one-way fee. Edmonton only makes sense if you drop Kananaskis and end in Jasper.
3. **Waterton in or out?** In means 16 nights or the 1-15 Sep window.
4. **Lodge nights.** Moraine Lake Lodge guests get road access to Moraine (no shuttle). Emerald Lake Lodge, Num-Ti-Jah at Bow Lake and Fairmont Chateau Lake Louise are options for one night each; none has a sourced price or child policy (GAP).
5. **The child's real height and weight.** The plan assumes 115 cm and 20 kg. At 23 kg the Kicking Horse float and the Golden zipline open up; below 18 kg the Kananaskis raft closes.
6. **Hiking ceiling.** How far does the child walk happily: 4 km, 6 km, 10 km? At 8-10 km, Kinney Lake, Rawson Lake and possibly Lake Agnes become family days and fewer splits are needed. And are both adults comfortable hiking alone in grizzly country?
7. **Group-of-four rule.** Is the Larch Valley adult willing to join strangers at the trailhead, or should Day 11 hire a guide or default to Lake Agnes?
8. **Budget.** No September 2029 lodging rate exists. Lake Louise for five nights is the most expensive part of the plan (Kayak: September is Lake Louise's priciest month, weak source). Is that acceptable, or should the second block move to Field?

## Change log

- 2026-10-12: First plan. 14 nights, Sat 8-Sat 22 Sep 2029 (window B chosen over 1-15 Sep). Banff 2, Lake Louise 1, Jasper 4, Lake Louise 4, Kananaskis Village 3. Seven split days (2, 5, 7, 9, 10, 11, 13), each with a same-area family track and a low-walking fallback. Waterton, Radium, Lake O'Hara, Assiniboine, Elk Lakes and Hamber left out. Sunshine moved to Day 2 because of the third-Sunday gondola closing pattern.
