# Rockies trails and sights: suitability and relevance (lane R2a)

Researched 18 Oct 2026 by travel-researcher (Opus). One pass for both specs: `research/method/suitability-applicability.md` section 8 and `research/method/relevance.md` section 8.

Files written:
- `data/suitability/canadian-rockies-2029/R2a.json` (suitability/1, 61 records, 47 sources)
- `data/relevance/canadian-rockies-2029/R2a.json` (relevance/1, 61 records, 15 sources)
- this log

This file is named `suitability-trails.md` (the name in suitability.md 8.1), not `suitability.md`, so it cannot collide with lane R2b, which writes `suitability-activities.md` into the same folder.

## Scope

The 61 in-scope refs of `data/suitability/scope.json` from the Rockies `trails` (33) and `sights` (28) datasets, including `place/lake-louise`. Kinds and subkinds are as in `kind-map.json`; no kind was changed (see Applicability questions 1-3). Off-plan rows (`migrated-offplan.json`) are out of scope.

## What was checked

Every figure was read from the land manager's own page on 18 Oct 2026: Parks Canada (Banff, Jasper, Yoho, Kootenay, Cave and Basin), Alberta Parks (Kananaskis trail reports, day-use pages, road closures), BC Parks (Mount Robson, Berg Lake Trail, the BC Parks blog). The plan's own data files (`trails.json`, `sights.json`, `bookings.md`) are cited as `computed` sources for the plan's figures and on-site times, and appear only as conflicts or our-inference notes, never as facts. No AllTrails, Hiking Project, Komoot, Google, Tripadvisor or booking site is a source; the plan's Hiking Project and AllTrails figures (Overlander Falls, Rockwall) were dropped, not carried. No Wikimedia Commons request was made. Wikidata was queried by name and by a 4 km coordinate search to find candidates; every QID was confirmed by its description and its P625 point, and the note says so.

| Pages | Records they answered |
|---|---|
| parks.canada.ca Banff day hikes (Banff, Lake Louise and Icefields Parkway tables) | every Banff trail: grade, distance, gain, time, surface, accessible stalls; Johnston Canyon closure; Sunshine steps and bridge |
| parks.canada.ca bear zones (Group Access) and Banff closures | group_min for every national-park trail; Moraine Lake group of four; Aylmer and Minnewanka restrictions; Fenland and Vermilion not closed |
| parks.canada.ca Lake Louise shuttle page and FAQ; Banff top 10 Louise and Icefields pages | Moraine and Louise access season, accessible shuttle, no accessible parking at Moraine, 20 stalls at Louise, strollers allowed on the shuttle; Peyto barrier-free path; Bow Lake gravel path; headlines |
| parks.canada.ca Jasper trail table, Maligne, Icefields, Miette and River pages | Jasper grades, distances, gains, times, dogs |
| parks.canada.ca Jasper accessible facilities, beaches, status page, Sunwapta and Maligne itineraries, Icefields Parkway itinerary | stroller and wheelchair detail (Athabasca Falls 14 steps, Sunwapta 30 m over 10%, Mary Schaffer 300 m paved, Lake Annette step-free, Miette 800 m paved, Pyramid bridge, Columbia Icefield centre); open status; "one of the world's most spectacular drives"; fuel and no cell coverage |
| parks.canada.ca Yoho day hikes and places | Emerald, Iceline, Takakkaw (flat paved, access symbol), Yoho Valley Road season and vehicle rule, Natural Bridge facilities |
| parks.canada.ca Kootenay day hikes and places | Marble Canyon and Paint Pots (two pages disagree), washrooms |
| parks.canada.ca Cave and Basin home, visit and trails | hours, free youth admission, 2-3 h, boardwalks |
| albertaparks.ca trail reports: Grassi Lakes Upper, Ha Ling, Ptarmigan Cirque, Troll Falls, Wedge Pond, Rockwall, Upper Lake | Kananaskis distances and climbs, easy-route fork, rockfall closure, group size limit (a maximum) |
| albertaparks.ca advisories, annual road closures, Peter Lougheed, Mt. Lorette Ponds, Wedge Pond day use, Canmore Nordic Centre | Hwy 40 closed 1 Dec - 14 Jun; Conservation Pass rule; Mt. Lorette step-free asphalt loop; Wedge Pond year-round; Canmore bear warning |
| bcparks.ca Mount Robson and Berg Lake Trail; BC Parks Robson valley blog | Kinney Lake 7 km to the north end, bikes to Kinney, no day-use fee, hazards; Overlander Falls as a short family hike; the visitor-centre deck |
| skibig3.com summer gondolas | Sunshine summer gondola 6 Jul - 20 Sep 2026 |
| canadabuys.canada.ca tender | Johnston Canyon rock slope remediation, 19-month contract from 31 Aug 2026 |
| parks.canada.ca Canadian Rocky Mountain Parks WHS | the WHS and its seven parks (Banff, Jasper, Yoho, Kootenay, Mount Robson, Mount Assiniboine, Hamber) |

## What was found

- **All 61 records reach Usable** for their profile (`check --coverage`: 0 R paths open on any R2a record). None is Complete: A fields (toilets, food, shade, signal, accessible toilets) were filled only where a page on the list stated them.
- **Usable leans on `searched_none` in places.** 75 values are `searched_none` with the pages tried, most of them the stroller surface, wheelchair access, access season or distance of small Kananaskis, Kootenay and Robson stops. They are honest gaps: the land managers do not publish them.
- **Hard limits.** No trail or sight has an age, height or weight rule. The rules found:
  - **Group of four, Moraine Lake area (Larch Valley, Sentinel Pass):** `official_rule`, Parks Canada bear-zone page: "Group Access requires people to travel in a tight group of four or more". Dates are set each year (the Moraine page that gives them returns 404); the page does not say whether children count. The Moraine lakeshore and the Rockpile are exempt (trip research, from Parks Canada). This was a GAP in the plan and is now a rule.
  - **Moraine Lake Road closed to personal vehicles year-round** (shuttle 1 Jun - 12 Oct 2026, licensed operators, lodge guests, accessible-placard holders exempt): `official_rule`, Parks Canada shuttle page and Banff top 10.
  - **Yoho Valley Road** (Takakkaw, Iceline): closed mid-October to mid-June; vehicles over 7 m reverse on the switchbacks; no trailers. `official_rule`, Yoho.
  - **Highway 40** (Ptarmigan Cirque, Highwood Pass): closed 1 Dec - 14 Jun. `official_rule`, Alberta Parks.
  - **Grassi Lakes**: wildlife corridor, designated trails only. **Troll Falls**: trails around and above the falls blocked for extreme rockfall. **Sunshine Meadows**: off-trail hiking restricted north of Citadel Pass. **Bald Hills**: no dogs.
  - **Johnston Canyon**: whole trail and day-use area closed 13 Oct - 11 Dec 2026 for rock slope work; a 19-month federal tender from August 2026 means later seasons may see closures too.
- **Accessibility, confirmed officially:** Lake Annette loop and Mt. Lorette Ponds are step-free (with steep short sections at Lake Annette); Takakkaw Falls is a flat paved path with an access symbol; partial access at Athabasca Falls (14 steps to the main bridge), Sunwapta Falls (30 m over 10%), Mary Schaffer (300 m paved), Pyramid Island (8% ramp, one small step), Miette mine loop, Peyto Lake (barrier-free path from the upper lot only), the Columbia Icefield centre, Jasper townsite and Emerald Lake. Moraine Lake has no accessible parking but an accessible shuttle. Parks Canada does not recommend strollers in Johnston Canyon even though the path is paved.
- **Our judgements, labelled as ours:** every `age_band` (from the 6.2 ceilings with the numbers in the note), `carrier_ok`, most `stroller` values (from the published surface or rating), `exposure` levels, Naismith times where no official time exists, on-site times (from the plan's allowance), and every relevance judgement.

## Conflicts

Kept as `conflicts` beside the chosen value; none averaged.

| Record | Chosen | Also published | Status |
|---|---|---|---|
| Parker Ridge gain | 250 m (Jasper table and text) | 305 m (Banff table); 275 m (Jasper prose) | open: two Parks Canada pages disagree |
| Iceline | 20.3 km, 1,090 m (Yoho, Little Yoho loop) | 17.4 km, 970 m (Celeste Lake loop, a different route); 20.8 km, 710 m (another Parks Canada figure the plan cites) | open |
| Marble Canyon | 0.9 km one way, 65 m (day hikes) | 1.6 km return, 20 m (places page) | open |
| Paint Pots gain | 35 m (day hikes) | 25 m (places page) | open |
| Sulphur Skyline | 8.8 km (Miette page) | 8 km (Jasper table) | open |
| Miette mine lower loop | 900 m (Miette page) | 800 m (Jasper table, accessibility page) | open |
| Sunshine Meadows | 10.2 km | 10.3 km (same page) | open, small |
| Lake Annette gain | 0 m (official) | 90 m (plan) | resolved to the official figure |
| Mary Schaffer gain | 0 m (official) | 84 m (plan) | resolved to the official figure |
| Troll Falls | 2.8 km return, 0 m (Alberta Parks "Length 1.4 km", read as one way) | 3.4 km, 155 m (plan, blogs) | open: whether 1.4 km is one way |
| Ha Ling | 7.8 km return, 810 m | 7.0 km (plan) | resolved to the official figure; whether 810 m is gain is open |
| Kinney Lake | 14 km return to the lake's north end (BC Parks) | 10 km to the south end (plan, blog) | open: no official figure to the first lake view |
| Interlakes | no official section length | 15.7 km for the whole Upper Lake trail; 8.6 km (plan) | open |
| Lake Louise lakeshore gain | 175 m (official) | none | flagged: the trail is close to level; likely cumulative undulation |
| Sarrail Ridge | no official page | 11.3 km, 675 m (plan, blogs, `community`) | open; the hazards value rests on community reports alone (W_SUIT_COMMUNITY_ONLY) |

Also noted: Parker Ridge is listed in the plan under Jasper, but Parks Canada's Banff table carries it (it sits in Banff near the Jasper boundary). The plan's Johnston Canyon row said "status for Sept 2029 is GAP"; the 2026 closure dates are now read and the 2029 risk is in the access season.

## Applicability questions

Fields or kinds that look wrong for a record; the data was left as `kind-map.json` has it.

1. **`sights/canmore-nordic-centre` is `activity / mtb` (M4, M5)**, but this sight row is the provincial park, used by the plan as the way to Grassi Lakes; the bike product is the adventure row R2b covers. It fits `sight / park` (the `area` profile, B14). I did not change `kind-map.json`, because `migrate --check` would then fail on S0's `migrated.json`, which this lane does not own. The record holds mtb_xc R fields mostly as `searched_none`.
2. **`trails/mary-schaffer-loop` and `trails/troll-falls` should be `walk`.** M1 kept them `hike` on the plan's climbs (84 m, 155 m); the official figures are 3.2 km with no gain and 1.4 km (one way?) with 0 m.
3. **`sights/kinney-lake-view` as a `lake` record** is a lake 7 km up a trail; `walk_m` 7000 reads oddly as "the walk from the car". The trail record carries the effort; the lake record could take the area profile, or `walk_m` could allow a trail ref.
4. **`ext.drive.vehicle_limits` is R for every drive.** The Icefields Parkway, Highwood Pass and Vermilion Lakes have no private-vehicle limit on the land manager's pages, so the answer is a `searched_none`. A `none_stated` would be more useful, but no page says "no limit" in words.
5. **`stroller` as a surface against a land manager's advice.** Johnston Canyon is 100% paved to the Lower Falls, but Parks Canada says strollers are not recommended. I stored `none` (`official_info`) with the reason. A separate advisory flag may be cleaner.
6. **`hazards` is A on the `walk` profile.** The Athabasca Glacier toe walk has a deciding hazard (stepping onto the ice); it was filled anyway as an A field.
7. **Exposure on railed viewpoints.** A railed canyon edge (Athabasca, Sunwapta) set to `significant` lifts terrain to 4 through the drivers table even when fenced; I stored `some, fenced`. The drivers rule may want to read `fenced`.

## Operator questions (owner question Q14)

Researchers cannot email or phone. Contacts are given only where the land manager's own page showed one.

1. **Parks Canada, Banff (Lake Louise Visitor Centre; contact through parks.canada.ca/pn-np/ab/banff/visit):** When is Group Access in effect for the Moraine Lake area trails in a typical year? Does a child count toward the four? May two parties of two join as one group of four? Are the Lakeshore and the Rockpile still exempt?
2. **Parks Canada, Banff:** Will the Johnston Canyon rock slope work (tender to early 2028) close the canyon in summer or September seasons after 2026?
3. **Parks Canada, Banff:** Is the 175 m gain on the Lake Louise Lakeshore trail correct? Which parts of the Lake Louise and Moraine Lake lakeshore trails are paved or firm enough for a stroller or a wheelchair? What is the surface of the main Peyto Lake lookout path from the lower lot?
4. **Parks Canada, Jasper:** What are Miette Road's seasonal dates? Is the Icefield Centre information desk expected to reopen?
5. **Parks Canada, Yoho:** What is Emerald Lake Road's season? How far is the Natural Bridge viewpoint from the lot, and is it step-free?
6. **Parks Canada, Kootenay:** Which figures are current for Marble Canyon (0.9 km one way and 65 m, or 1.6 km return and 20 m) and Paint Pots (35 m or 25 m)? Are either path or their bridges usable with a stroller or a wheelchair?
7. **Cave and Basin National Historic Site (403-762-1566, caveandbasin@pc.gc.ca, from the site's page):** Are the cave tunnel, the basin and the boardwalks step-free for a wheelchair and a stroller? What are the summer hours?
8. **Alberta Parks (information line 1-877-537-2757; Kananaskis wildlife reports 403-591-7755; Spray Valley 1-866-686-0339, all from Alberta Parks pages):** Is the Troll Falls "Length 1.4 km" one way? How long is the Interlakes section? Is the Rockwall path wheelchair-accessible? What is the Wedge Pond trail surface? What is the Kananaskis Lakes Trail season? Is Sarrail Ridge a maintained trail?
9. **BC Parks, Mount Robson (no contact read):** How far is the first Kinney Lake view from the trailhead, and what is the climb? How long is the Overlander Falls trail, and is the visitor-centre deck step-free? What is the visitor centre's season?
10. **Banff Sunshine (no contact read; the resort site did not resolve from the fetcher):** Does the summer gondola still close around 20 September, and may strollers ride it?

## Relevance

Draw tiers: world 4, national 12, regional 34, local 11. Roles after `relevance.ts derive`: 13 anchors, 18 highlights, 15 fillers, 15 local only.

- **Anchors** ("Worth the journey"): Moraine Lake, Lake Louise, Peyto Lake, the Icefields Parkway (world); Larch Valley and Sentinel Pass, Plain of Six Glaciers, Sunshine Meadows, Emerald Lake, Maligne Lake and Spirit Island, Athabasca Falls, Johnston Canyon, Takakkaw Falls, the Columbia Icefield and Athabasca Glacier (national, standing top).
- **Calibration choice:** the short walks that only reach a headline place (Moraine and Louise lakeshores, Peyto lookout, Takakkaw walk, Athabasca Falls path, glacier toe, Emerald lakeshore) are judged `regional`, because the place carries the draw on its own record; otherwise every place would anchor twice. Cave and Basin is `regional` (a two-hour town visit), and Bow Lake `good` in standing against Peyto.
- **Designations:** the Canadian Rocky Mountain Parks WHS and the national or provincial park are `parent` on every record except the Canmore Nordic Centre (the park itself, `own`) and Cave and Basin (the National Historic Site, `own`, a heritage listing). `official_highlight` is used where a Parks Canada page names the place as a headline: the Parkway, the Banff top 10 Lake Louise and Icefields pages.
- **QIDs:** 37 of 61 confirmed; 24 `searched_none` (mostly trails and walks with no item of their own, plus Natural Bridge, Paint Pots, Moose Lake and Bald Hills), so every record has a QID or a recorded search. Park QIDs are on the parent designations.
- **draw_suggested is `local` everywhere** because `relevance.ts signals --fetch` (the RV0 network step) has not run for these QIDs yet; the confusion table comes after it.
- Editorial mentions were not searched (`gap`) on this pass.
- No access_cost items were added: the shuttles, the lift and the seasonal roads are already suitability `access_season.via`, and the Kananaskis Conservation Pass is a parking pass with no cap. Maligne Lake carries `boat_or_ferry` (capped) for Spirit Island.

| Record | Kind / subkind | Suitability | FE | Draw | Standing | Distinction | Class | draw_suggested | Role | Badge |
|---|---|---|---|---|---|---|---|---|---|---|
| trails/bald-hills | trail/hike | usable | 4 | regional | good | common | trail/lookout | local | filler | - |
| trails/bourgeau-lake | trail/hike | usable | 4 | regional | good | common | lake/alpine-hike-in | local | filler | - |
| trails/emerald-lakeshore | trail/hike | usable | 1 | regional | top | rare | trail/riverside | local | highlight | Worth a detour |
| trails/iceline-trail | trail/hike | usable | 4 | national | top | rare | trail/alpine-loop | local | highlight | Worth a detour |
| trails/interlakes-trail | trail/hike | usable | None | regional | good | common | trail/riverside | local | filler | - |
| trails/ha-ling-peak | trail/hike | usable | 3 | regional | top | common | peak/summit | local | local_only | Local favourite |
| trails/grassi-lakes-upper | trail/hike | usable | 1 | regional | top | common | lake/alpine-hike-in | local | filler | Local favourite |
| trails/kinney-lake | trail/hike | usable | None | regional | good | rare | lake/alpine-hike-in | local | filler | - |
| trails/lake-louise-lakeshore | trail/hike | usable | 2 | regional | top | rare | trail/riverside | national | highlight | Worth a detour |
| trails/larch-valley-sentinel-pass | trail/hike | usable | 4 | national | top | rare | trail/alpine-loop | local | anchor | Worth the journey |
| trails/mary-schaffer-loop | trail/hike | usable | 1 | regional | good | common | trail/riverside | local | filler | - |
| trails/parker-ridge | trail/hike | usable | 2 | regional | top | rare | trail/lookout | national | filler | Local favourite |
| trails/plain-of-six-glaciers | trail/hike | usable | 3 | national | top | rare | trail/alpine-loop | national | anchor | Worth the journey |
| trails/ptarmigan-cirque | trail/hike | usable | 2 | regional | top | rare | trail/alpine-loop | local | highlight | Worth a detour |
| trails/sarrail-ridge | trail/hike | usable | 4 | regional | good | common | viewpoint/summit-panorama | local | local_only | - |
| trails/sulphur-skyline | trail/hike | usable | 4 | regional | good | common | viewpoint/summit-panorama | local | local_only | - |
| trails/sunshine-meadows-citadel-pass | trail/hike | usable | 3 | national | top | rare | trail/alpine-loop | local | anchor | Worth the journey |
| trails/wilcox-pass | trail/hike | usable | 2 | regional | top | rare | trail/lookout | local | highlight | Worth a detour |
| trails/troll-falls | trail/hike | usable | 3 | local | good | common | waterfall/hike-in | local | local_only | - |
| trails/athabasca-falls-trail | trail/walk | usable | 2 | regional | top | rare | waterfall/roadside | local | highlight | Worth a detour |
| trails/fenland-loop | trail/walk | usable | 1 | local | good | common | trail/forest-loop | local | local_only | - |
| trails/jasper-miette-mine-trail | trail/walk | usable | 1 | local | ordinary | common | trail/forest-loop | local | local_only | - |
| trails/lake-annette-loop | trail/walk | usable | 1 | local | top | common | trail/forest-loop | local | local_only | Local favourite |
| trails/marble-canyon-walk | trail/walk | usable | 1 | regional | top | rare | gorge/river-limestone | local | highlight | Worth a detour |
| trails/moose-lake-loop | trail/walk | usable | 1 | local | ordinary | common | trail/forest-loop | local | local_only | - |
| trails/moraine-lakeshore | trail/walk | usable | 1 | regional | top | rare | trail/riverside | national | highlight | Worth a detour |
| trails/overlander-falls-trail | trail/walk | usable | 3 | local | good | common | waterfall/hike-in | local | local_only | - |
| trails/paint-pots-walk | trail/walk | usable | 1 | regional | top | rare | sight/landmark | local | highlight | Worth a detour |
| trails/peyto-lake-lookout | trail/walk | usable | 1 | regional | top | rare | viewpoint/roadside | national | highlight | Worth a detour |
| trails/rockwall-lookout | trail/walk | usable | 1 | local | ordinary | common | trail/lookout | local | local_only | - |
| trails/takakkaw-falls-walk | trail/walk | usable | 1 | regional | top | unique | waterfall/giant | local | highlight | Worth a detour |
| trails/toe-glacier-walk | trail/walk | usable | 2 | regional | top | unique | glacier/walk-on | local | highlight | Worth a detour |
| trails/wedge-pond-loop | trail/walk | usable | None | local | good | common | lake/small-mirror | local | local_only | - |
| sights/bow-lake | lake/lake | usable | None | national | good | rare | lake/glacial-turquoise | national | highlight | Worth a detour |
| sights/emerald-lake | lake/lake | usable | None | national | top | rare | lake/glacial-turquoise | local | anchor | Worth the journey |
| sights/kinney-lake-view | lake/lake | usable | None | regional | good | rare | lake/alpine-hike-in | local | filler | - |
| sights/lake-minnewanka | lake/lake | usable | None | regional | good | common | water/boat-tour | local | filler | - |
| sights/maligne-lake-spirit-island | lake/lake | usable | None | national | top | rare | lake/glacial-turquoise | local | anchor | Worth the journey |
| sights/moraine-lake | lake/lake | usable | None | world | top | rare | lake/glacial-turquoise | national | anchor | Worth the journey |
| sights/mount-lorette-ponds | lake/lake | usable | None | local | good | common | lake/small-mirror | local | local_only | - |
| sights/pyramid-lake | lake/lake | usable | None | regional | top | common | lake/swim-beach | local | filler | Local favourite |
| sights/wedge-pond | lake/lake | usable | None | local | good | common | lake/small-mirror | local | local_only | - |
| place/lake-louise | lake/lake | usable | None | world | top | rare | lake/glacial-turquoise | national | anchor | Worth the journey |
| sights/athabasca-falls | waterfall/waterfall | usable | 3 | national | top | rare | waterfall/roadside | local | anchor | Worth the journey |
| sights/johnston-canyon | waterfall/canyon | usable | 3 | national | top | rare | gorge/river-limestone | local | anchor | Worth the journey |
| sights/marble-canyon | waterfall/canyon | usable | 3 | regional | top | rare | gorge/river-limestone | local | highlight | Worth a detour |
| sights/natural-bridge | waterfall/gorge | usable | 3 | regional | good | rare | gorge/river-limestone | local | filler | - |
| sights/overlander-falls-view | waterfall/waterfall | usable | 3 | local | good | common | waterfall/hike-in | local | local_only | - |
| sights/sunwapta-falls | waterfall/waterfall | usable | 3 | regional | good | rare | waterfall/roadside | local | filler | - |
| sights/takakkaw-falls | waterfall/waterfall | usable | None | national | top | unique | waterfall/giant | local | anchor | Worth the journey |
| sights/mount-robson-viewpoint | viewpoint/viewpoint | usable | None | national | top | unique | viewpoint/roadside | local | highlight | Worth a detour |
| sights/peyto-lake | viewpoint/viewpoint | usable | None | world | top | rare | viewpoint/roadside | national | anchor | Worth the journey |
| sights/icefields-parkway-drive | drive/scenic_drive | usable | None | world | top | unique | drive/scenic-parkway | national | anchor | Worth the journey |
| sights/highwood-pass-summit | drive/scenic_drive | usable | None | regional | top | rare | drive/mountain-pass | local | highlight | Worth a detour |
| sights/vermilion-lakes | drive/scenic_drive | usable | None | regional | top | common | drive/scenic-parkway | local | local_only | Local favourite |
| sights/jasper-townsite | town/town | usable | None | regional | top | common | town/alpine-resort | local | filler | Local favourite |
| sights/cave-and-basin | sight/historic_site | usable | None | regional | top | unique | sight/heritage-site | local | highlight | Worth a detour |
| sights/columbia-icefield-athabasca-glacier | sight/attraction | usable | None | national | top | unique | glacier/walk-on | national | anchor | Worth the journey |
| sights/paint-pots | sight/attraction | usable | None | regional | top | rare | sight/landmark | local | highlight | Worth a detour |
| sights/kananaskis-lakes-day-use | sight/area | usable | None | regional | top | common | lake/glacial-turquoise | local | filler | Local favourite |
| sights/canmore-nordic-centre | activity/mtb | usable | None | regional | good | common | trail/forest-loop | local | filler | - |

## Correction pass RC (18 Oct 2026, backlog 3a.8 and 3a.10)

Suitability:
- **Johnston Canyon `access_season`.** The 11 Dec 2026 end is now sourced: the Parks Canada bulletin "Area Closure: Johnston Canyon Trail and Day Use Area" (issued 13 Oct 2026, ends 11 Dec 2026). The winter walking page adds that the Upper Falls and Ink Pots stay reachable by the Moose Meadows Trail, so the note no longer says the whole trail is closed. The 19-month tender note stays.
- **Interlakes `hazards`.** No live page states the grizzly closure any more: the Kananaskis advisories and the Upper Lake trail report (read 18 Oct) show the trail open ("Open Sep 9th"). The closure rests on our earlier research (trails-provincial.md), so the basis is now `our_inference` with that note.
- **Group rules.** Parks Canada's group-of-four list (bear management page, re-read 18 Oct) names Bryant Creek/Allenby Pass, the Lake Minnewanka area and the Moraine Lake area in Banff, McArthur Valley and the Odaray Highline in Yoho, and nothing in Jasper. The 11 Banff, Yoho and Jasper trails not on it moved from `none_stated` to `no_limit` (`official_rule`, note "not on Parks Canada's group-of-four list"). Larch Valley keeps its value of 4. The Alberta Parks and BC Parks trails stay `searched_none`: no such list exists there.
- Two sources pointed to their final URLs after the link check (Icefields Parkway, Banff top 10).

Relevance (spec 3.1 rule 3 and the CF anchor test):
- **Johnston Canyon: stays national and an anchor.** New place-level evidence: Parks Canada lists it in its Banff top 10 ("Discover Johnston Canyon"), recorded as an own `official_highlight`. The Wikidata item is a one-language bot stub, so the fame signal under-reads. Distinction stays rare (Marble Canyon is the only same-class place within 100 km in the catalogue).
- **Emerald Lake: anchor to highlight.** The draw stays national (Yoho's headline lake; 9 languages, about 17,200 views). Distinction moves from rare to common: Lake Louise (21 km), Bow Lake (25 km), Moraine (28 km) and Peyto are the same class within 100 km. Common caps it at highlight.
- **Sunshine Meadows: national to regional, anchor to highlight.** The national draw rested on the parent park and WHS only. Its place signals are 1 language and about 580 views a year, and no headline page was found.
- **Athabasca Falls: stays national and an anchor.** The evidence is now place-level: it is a named stop on Parks Canada's Icefields Parkway itinerary (own `official_highlight`), with 17 languages.
- **Takakkaw Falls: stays national and an anchor.** Parks Canada calls it Canada's second highest waterfall (11 languages, about 10,700 views). The note now cites that, not the parent park.
- **Pairs (`pairs_with`):**
  - Lake Louise with the Lake Louise gondola
  - Moraine Lake with Larch Valley
  - the Athabasca Glacier with the Glacier Skywalk
  - Peyto Lake with Bow Lake
  - Emerald Lake with the Natural Bridge
  - Marble Canyon with the Paint Pots

  No Lake Agnes record exists, so that pair is not recorded.
