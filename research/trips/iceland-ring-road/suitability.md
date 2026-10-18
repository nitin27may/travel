# Iceland Ring Road 2027: suitability and relevance (lane R4)

Read 18 Oct 2026 by travel-researcher (Opus), one pass for both specs. Files:
- `data/suitability/iceland-ring-road-2027/R4.json` (suitability/1, 25 records, 41 sources)
- `data/relevance/iceland-ring-road-2027/R4.json` (relevance/1, 25 records)
- six entries in `data/suitability/kind-map.json` (kind changes, each with a reason)

All values are 2026 readings used as a pattern for September 2027. Nothing here is household data. Distances and hubs are not computed by this lane.

## What was checked

| Source | Pages read | Used for |
|---|---|---|
| Vatnajokull National Park (vatnajokulsthjodgardur.is) | Svartifoss S2 and S6 trail pages, Svartifoss destination, Dettifoss, Jokulsargljufur, the Dettifoss landslide notice, Jokulsarlon, Breidamerkursandur, the Jokulsarlon parking closure notice | Svartifoss figures and grade, Dettifoss walk and closures, lagoon facilities and season |
| Environment Agency of Iceland (ust.is) | Gullfoss (2 pages), Skogafoss (2), Geysir area (3), Godafoss, Dettifoss natural monument, Hraunfossar, the regional lists | protection status, facilities, season; no walk distances published |
| Thingvellir National Park (thingvellir.is) | parking service, visitor centre, hiking trails, rules | toilets, signage, World Heritage status |
| Icelandic Tourist Board (ferdamalastofa.is) | Reynisfjara signs (zones, lights), Reynisfjara erosion (24 Feb 2026) | beach hazards, lifeguard, access since February 2026 |
| Snaefellsjokull National Park (snaefellsjokull.is) | Djupalonsandur, Djupalonssandur-Dritvik, Arnarstapi, Arnarstapi-Hellnar, Hellnar, glacier, travel and safety advice | surf and undertow, toilets, platform access, trail length |
| Earth Lagoon Myvatn (earthlagoon.is, formerly Myvatn Nature Baths) | home, FAQ, lagoon, pricing, info; old terms URL | child policy, temperature, wheelchair, hours |
| Skagafjordur Heritage Museum (glaumbaer.is) | opening hours and admission | season |
| Akureyri Botanic Garden (lystigardur.akureyri.is) | practical information, opening hours | step-free access, toilets, season |
| Safetravel (ICE-SAR), Icelandic Met Office | home alert; IMO Svartsengi news (read through search results, the fetched page showed only the banner) | Reykjanes volcanic hazard |
| Wikidata | name search, then each candidate checked by description and coordinates | QIDs |

No Commons searches. No AllTrails, Google, Tripadvisor or booking sites as a source. Travel and rental-company pages seen in search results are mentioned below only as unconfirmed claims, never as values.

## What was found (the facts that matter)

- **Myvatn Nature Baths is now Earth Lagoon Myvatn** (renamed 2025, new facility scheduled for summer 2026). Its FAQ: "Yes, all children are welcome" (no minimum age, recorded as `none_stated`), water 36-40 C, "The lagoon is accessible for wheelchairs" (a wheelchair takes you from the shower to the lagoon). Bands: 0-5 free with an adult, 6-12, 13-15. The old terms URL 301s to a 404.
- **Reynisfjara since 24 Feb 2026:** erosion undermined the viewing platform and two signs; the light sign was removed; access only to the upper beach ridge, not down to the basalt columns. The beach "is never closed" but is zoned by light (yellow, red). "No manned security on site."
- **Dettifoss:** 1 km each way from the west car park (paved road 862). A landslide closed the northern part of the platform and the path down to the falls until assessed.
- **Svartifoss:** the park's S2 loop is 5.8 km, 250 m, about 2 hours, "Easy", with many wooden and stone steps, slippery when wet. S6 is 7.1 km, 310 m, "Challenging".
- **Djupalonssandur:** heavy surf and a strong undertow (park); toilets at the upper lot; a wheelchair-accessible viewing platform above the beach.
- **Hraunfossar:** good wheelchair access in parts, toilets, open all year.
- **Akureyri garden:** "fully accessible to those with mobility issues"; toilets 1 Jun - 30 Sep only.
- **Glaumbaer:** daily 10-18 to 20 Sep, then weekdays 10-16 to 20 Oct. The plan's day (12 Sep) is inside the daily window.
- **Jokulsarlon:** flush toilets, restaurants, rangers every day; the main lot closed 2-7 Oct 2026 for works.

## Hard limits found

| Record | Limit | Source |
|---|---|---|
| Earth Lagoon Myvatn | no minimum age (`none_stated`, operator: "all children are welcome") | earthlagoon.is/faq |

No other record in scope is an operated activity with limits. Silfra, the glacier walks and whale watching are optional plan items with no scope ref, so they were not researched in this lane (their limits in `route.md` stay unconfirmed by an operator page here).

## Conflicts

Resolved (kept, never averaged):
- **Svartifoss distance and climb:** S2 5.8 km / 250 m is the value (the park's Svartifoss loop). Kept as conflicts: 5.4 km / 120 m (repo research, direct route) and S6 7.1 km / 310 m (official, the full circuit).
- **Myvatn child rules:** applicability spec 3.12 gave "minimum age 1, under 12 in an adult's care, armbands 1-8" from the old terms page. A search snippet of that page shows only "guests take full responsibility for ... the children in their care", and the armband 2-8 rule found is the Blue Lagoon's (bluelagoon.com/safety-standards). The spec's example is not confirmed and was not carried over. **The spec page 3.12 row should be corrected by its owner.**

Still open:
- **Thingvellir wheelchair access:** travel sources disagree (the main paths accessible, against the Almannagja path too steep for most manual chairs). Recorded `searched_none`; ask the park.
- **Djupalonssandur walk:** the park says "a 2km hiking trail ... from the upper parking lot down to Djupalonssandur". There is also a lot by the lagoon; its distance is not stated. The 2 km is stored as the park states it.
- **Reynisfjara deaths and the platform rebuild date:** travel sources give different last fatality dates; the park and landowners give no rebuild date.
- **Seljalandsfoss and Skogafoss parking fees** (800-1,000 ISK in travel sources) and **Skogafoss stairs** (525-527): no official figure.
- **Fjadrargljufur:** no current land-manager page (the old ust.is URL is 404); length 1-3.2 km in travel sources.

## Kind changes (in kind-map.json)

| Ref | From | To | Why |
|---|---|---|---|
| sight:blue lagoon area lava fields | sight/landmark | sight/area | a landscape where the volcanic status decides the visit |
| trail:djupalonssandur | trail/hike | swim_spot/beach | the stop is the beach; applicability 8.2 names it |
| trail:thingvellir | trail/hike | trail/walk | a short made path down Almannagja |
| viewpoint:diamond beach | viewpoint | swim_spot/beach | an open surf beach |
| viewpoint:jokulsarlon | viewpoint | lake/lake | a lagoon visited from the shore |
| viewpoint:reynisfjara beach | viewpoint | swim_spot/beach | sneaker waves; applicability 8.2 names it |

`migrated.json` still holds the old kinds (it is S0's file and is superseded by R4). If `migrate --check` compares against kind-map, it will now differ for these six; that is for the S0 owner to regenerate.

## Applicability questions

1. **`exposure` "some" lifts a roadside waterfall to family effort 3 (Moderate).** Gullfoss, Godafoss, Skogafoss, Seljalandsfoss, Hraunfossar, Kirkjufell and the Thingvellir walk all derive FE3 from one driver ("rough path or exposure some"). For a viewpoint 100 m from a car park that reads wrong on a chip. Suggest: for waterfall and viewpoint profiles, terrain from exposure only when `walk_m` is over about 500 m, or mark exposure as a warning only.
2. **`water_safety.entry` and `ext.water.swimming` are R on `beach`.** On Icelandic surf beaches nobody enters the water. The honest answer is `drop_off` / `unsafe`, which works, but a "no-swim beach" subkind (or `entry: not_used`) would read better.
3. **`hazards` is A on `waterfall` and `lake`.** At Dettifoss (landslide) and Jokulsarlon (ice floes) the hazard decides the day; consider R where `exposure` is not `none`.
4. **`area` has no `exposure` or water fields.** Fine for the Reykjanes lava fields; volcanic gas went into `hazards` as `health`.
5. **The hazard vocabulary has no `volcanic` category.** Eruption risk went in as `other`. Suggest adding `volcanic`.
6. **Snaefellsjokull view** has no defined spot in the plan. It is a viewpoint with no place; consider dropping it or tying it to a named stop (Arnarstapi or the Malarrif visitor centre).

## Relevance

Draw is our judgement, with the evidence named in each note. Fame signals (Wikipedia languages and page views) were **not** counted by this lane; `relevance.ts signals --fetch` has not run for these QIDs, so `draw_suggested` in the derived file is a floor from designations only.

| Record | Draw | Standing | Distinction | Class | QID | Derived role |
|---|---|---|---|---|---|---|
| Thingvellir (walk) | world | top | unique | sight/heritage-site | Q16419351 | anchor |
| Geysir | world | top | unique | sight/landmark | Q216846 | anchor |
| Gullfoss | world | top | rare | waterfall/giant | Q38519 | anchor |
| Seljalandsfoss | world | top | rare | waterfall/roadside | Q777882 | anchor |
| Skogafoss | world | top | rare | waterfall/roadside | Q1130718 | anchor |
| Reynisfjara | world | top | rare | beach/ocean | Q115641739 | anchor |
| Jokulsarlon | world | top | rare | lake/glacial-turquoise | Q511933 | anchor |
| Dettifoss | national | top | rare | waterfall/giant | Q210280 | anchor |
| Godafoss | national | top | rare | waterfall/giant | Q1137629 | anchor |
| Svartifoss (trail) | national | top | rare | waterfall/hike-in | Q1145786 | anchor |
| Fjadrargljufur | national | top | rare | gorge/river-limestone | Q956845 | anchor |
| Diamond Beach | national | top | rare | beach/ocean | Q53795710 | anchor |
| Kirkjufell | national | top | rare | viewpoint/roadside | Q1547402 | anchor |
| Hraunfossar (Borgarfjordur waterfalls) | regional | top | unique | waterfall/roadside | Q427971 | highlight |
| Glaumbaer | regional | top | rare | sight/museum | Q1530105 | highlight |
| Namaskard (Hverir) | regional | top | rare | sight/landmark | searched_none | highlight |
| Seydisfjordur | regional | top | rare | town/historic-village | Q623557 | highlight |
| Arnarstapi to Hellnar | regional | top | rare | trail/lookout | searched_none | highlight |
| Djupalonssandur | regional | top | rare | beach/ocean | Q5285420 | highlight |
| Earth Lagoon Myvatn | regional | top | common | lake/swim-beach | Q27016707 | filler |
| Reykjavik old harbour | regional | good | common | town/historic-village | Q16424292 | filler |
| Snaefellsjokull view | regional | good | common | viewpoint/roadside | Q1315012 | local_only (clear_only drops it) |
| Reykjanes lava fields | local | good | common | sight/landmark | Q1288839 | local_only |
| Akureyri botanic garden | local | good | rare | park/urban | Q894637 | local_only |
| Hofn harbour | local | good | common | town/historic-village | Q817118 | local_only |

Tiers: world 7, national 6, regional 9, local 3. QIDs: 23 of 25 confirmed, 2 `searched_none` (100% answered). Editorial mentions were not searched (`gap` on every record).

Judgement notes:
- **Seljalandsfoss** is `world` on judgement with no own designation found. When signals run, a gap warning against a low suggestion is expected; the note explains it.
- **Kirkjufell** is held at `national` (lower tier when in doubt): no top list or headline page was read.
- **Diamond Beach** is `national`, paired with Jokulsarlon rather than a reason on its own.

Classes proposed for `data/vocab/relevance-classes.json` (not used in the JSON; the closest existing class was used instead):
- `geothermal/field` for Geysir and Hverir (now `sight/landmark`)
- `water/geothermal-bath` for Earth Lagoon, GeoSea and the Blue Lagoon (now `lake/swim-beach`, which is wrong for substitutes)
- `lake/glacier-lagoon` for Jokulsarlon and Fjallsarlon (now `lake/glacial-turquoise`)
- `gorge/moss-canyon` or a general `gorge/river-rim` for Fjadrargljufur (now `gorge/river-limestone`)
- `trail/coastal` for Arnarstapi-Hellnar (now `trail/lookout`)
- `landscape/lava-field` for the Reykjanes lava fields (now `sight/landmark`)

Designation gaps: the Vatnajokull World Heritage listing (2019) was not read on a UNESCO or park page, so it is not recorded for Svartifoss, Dettifoss or the lagoons. Reykjanes and Katla are UNESCO Global Geoparks, a type the designation list does not have.

`data/relevance/signals/langs.json` should gain `is` for the Icelandic QIDs (most page views are in English and Icelandic). Not edited here: it is RV0's file.

## Per-record level (suitability)

All 25 are **Usable**, 0 Complete, 0 Draft. Many R fields are answered as `searched_none`, which is honest but thin: those records are Usable by the letter only.

| Record | Profile | Level | Thin spots (`searched_none` on R fields) |
|---|---|---|---|
| Earth Lagoon Myvatn | hot_spring | Usable | adult_required, pregnancy |
| Reykjanes lava fields | area | Usable | none |
| Hraunfossar | waterfall | Usable | distance, walk_m |
| Dettifoss | waterfall | Usable | stroller, wheelchair |
| Geysir | sight | Usable | stroller, wheelchair |
| Glaumbaer | sight | Usable | wheelchair |
| Godafoss | waterfall | Usable | stroller, wheelchair, distance, walk_m |
| Gullfoss | waterfall | Usable | stroller, wheelchair, distance, walk_m, access_season |
| Namaskard | sight | Usable | stroller, wheelchair |
| Seljalandsfoss | waterfall | Usable | stroller, wheelchair, distance, walk_m, access_season |
| Skogafoss | waterfall | Usable | stroller, wheelchair, distance, walk_m |
| Akureyri garden | sight | Usable | none |
| Hofn harbour, Reykjavik old harbour, Seydisfjordur | town | Usable | stroller and wheelchair are our judgement, not a town source |
| Arnarstapi to Hellnar | hike | Usable | group_min, source_grade, gain_m, navigation |
| Djupalonssandur | beach | Usable | lifeguard |
| Fjadrargljufur | hike | Usable | group_min, stroller, source_grade, distance, gain, navigation |
| Svartifoss | hike | Usable | group_min |
| Thingvellir | walk | Usable | stroller, wheelchair, distance, gain, surface |
| Diamond Beach | beach | Usable | toilets, lifeguard, walk_m |
| Jokulsarlon | lake | Usable | stroller, wheelchair, walk_m |
| Kirkjufell | viewpoint | Usable | stroller, wheelchair, walk_m, access_season |
| Reynisfjara | beach | Usable | toilets |
| Snaefellsjokull view | viewpoint | Usable | stroller, wheelchair, walk_m, access_season |

`group_min` is `searched_none` for the three hikes: no Icelandic park page states a group rule, and none was expected.

## Operator questions (owner Q14: send by email or phone)

1. **Earth Lagoon Myvatn** (info@jardbodin.is, +354 464 4411): Is there a minimum age? Must children under a certain age be accompanied in the water by an adult, and at what ratio? Are armbands or floats required, and up to what age? Any rule or advice for pregnant guests? Are toilets inside the changing rooms?
2. **Thingvellir National Park** (+354 488 1800, option 2): Is the path from Hakid down Almannagja to the assembly site step-free for a manual wheelchair, and for a stroller? Its length and surface?
3. **Vatnajokull National Park, Jokulsargljufur** (Gljufrastofa): Is the 1 km path from the west Dettifoss car park suitable for a stroller or a wheelchair? Is the northern platform reopened?
4. **Vatnajokull National Park, Breidamerkursandur rangers**: Are there toilets at Eystri-Fellsfjara (Diamond Beach) outside construction periods? Any sneaker-wave signage there? Step-free access to the Jokulsarlon shore?
5. **Environment Agency of Iceland** (ust.is, rangers for Gullfoss, Geysir, Skogafoss, Godafoss, Fjadrargljufur): walk length from each car park to the main viewpoint, whether the paths are step-free, and whether any path closes seasonally (the Gullfoss lower path, Seljalandsfoss behind the falls).
6. **Reynisfjara landowners** (via the Icelandic Tourist Board): when the viewing platform will be rebuilt; are the toilets at the car park open to non-customers?
7. **Skagafjordur Heritage Museum** (+354 453 6173, byggdasafn@skagafjordur.is): Can a stroller or a wheelchair go inside the turf houses?
8. **Snaefellsjokull National Park**: How far is the lower (lagoon) car park from Djupalonssandur? Is the Arnarstapi-Hellnar path waymarked, and what is its climb?

## Gotchas

- A renamed operator kills old URLs: myvatnnaturebaths.is/terms now 301s to a 404. Re-check rules after a rename instead of trusting older notes.
- A spec example can be wrong: the Myvatn child rules in applicability 3.12 look like the Blue Lagoon's.
- ust.is pages give protection status and rules, almost never walk distances. Expect `searched_none` for `walk_m` on Icelandic natural monuments.
- Wikidata name search returns ships named after waterfalls (Dettifoss, Godafoss) and an Australian "Diamond Beach" first. Every QID here was checked by description and coordinates.

## Correction pass RC (18 Oct 2026, backlog 3a.8 and 3a.10)

- **Earth Lagoon Myvatn `min_age`.** The operator's FAQ says "Yes, all children are welcome", an affirmative no-minimum, so the field is now `no_limit`.
- **Moved pages.** The Glaumbaer hours and Akureyri botanic garden pages were re-read at their new URLs. Glaumbaer's access season gains the 1 Apr to 19 May weekday rows and the by-appointment off-season rows from the same page.
- **Relevance re-judged:**
  - **Diamond Beach: national to regional, anchor to highlight.** The national draw rested on the parent park; it has no Wikipedia article. It is the lagoon's beach across the road, and the lagoon carries the draw.
  - **Kirkjufell: stays national and an anchor.** It has 22 languages and about 25,400 views, and the note now cites them.
  - **Fjadrargljufur: stays national and an anchor.** It has 17 languages and about 7,700 views, plus the 2019 visitor-pressure closure.
  - **Seljalandsfoss: stays world and an anchor.** It has 40 languages.
- **Pairs:** Jokulsarlon and Diamond Beach (both ways); Geysir and Gullfoss (both ways); Namaskard with the Myvatn lagoon.
