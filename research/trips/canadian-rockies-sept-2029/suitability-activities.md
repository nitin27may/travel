# Rockies activities: suitability and relevance (lane R2b)

Researched 18 Oct 2026 by travel-researcher (Opus). One pass for both specs: `research/method/suitability-applicability.md` section 8 and `research/method/relevance.md` section 8.

Files written:
- `data/suitability/canadian-rockies-2029/R2b.json` (suitability/1, 17 records, 36 sources)
- `data/relevance/canadian-rockies-2029/R2b.json` (relevance/1, 17 records)
- this log

This file is named `suitability-activities.md` (the name in suitability.md 8.1) rather than `suitability.md`, so it cannot collide with lane R2a, which writes trails and sights into the same research folder.

## Scope

The 15 in-scope refs of `data/suitability/scope.json` from the `adventures` dataset, plus the two off-plan raft refs the lane brief asked to resolve (`kicking-horse-family-float`, `kananaskis-river-raft`, both in `migrated-offplan.json` and not counted by `--coverage`).

`glacier-skywalk` and `jasper-dark-sky` are `sight / attraction` in `kind-map.json` (M3), but they are adventure refs, so this lane covers them. No kind changes were made.

## What was checked

Every hard limit was read from the operator's or the land manager's own page on 18 Oct 2026. Resellers and booking agents (Banff Adventures, Orbitz, AAA, byFood, Magpie) were read only to find the operator, and appear as `community` facts or not at all. No AllTrails, Google, Tripadvisor or booking site is a source. No Wikimedia Commons request was made. Wikidata was queried by name to find candidates, and every QID was confirmed by label, description and coordinates.

| Record | Pages read |
|---|---|
| Kicking Horse family float | wildwater.com Gentle trip and FAQ; raftbanff.com FAQ and trips (Hydra); banffadventures.com family page (agent for Hydra) |
| Kananaskis raft | chinookrafting.com home and FAQs; banffadventures.com Kananaskis page (agent) |
| Banff Gondola | banffjaspercollection.com FAQs and hours |
| Jasper SkyTram | banffjaspercollection.com FAQs, tickets, hours (hours through search results) |
| Lake Louise gondola | skilouise.com sightseeing gondola, FAQ, accessibility, wildlife viewing, hours |
| Maligne and Minnewanka cruises | banffjaspercollection.com FAQs and hours pages |
| Canoes | chateau-lake-louise.com canoeing; morainelake.com day visits; crmr.com canoeing; thebanffblog.com (community only) |
| Hot springs | parks.canada.ca Banff Upper and Miette FAQs and hours |
| Ice Explorer, Skywalk | banffjaspercollection.com Columbia Icefield FAQs and hours |
| Dark sky | parks.canada.ca Jasper Dark-Sky Preserve page |
| Elk rut | Parks Canada Banff elk rut advisory (28 Aug 2026); Jasper 2026 wildlife-viewing restricted-activity bulletin |
| Canmore Nordic Centre | albertaparks.ca summer activities |
| Designations | parks.canada.ca Canadian Rocky Mountain Parks World Heritage page |

## Findings per record

- **Kicking Horse family float.** Both operators set a **minimum** of 8 years and 50 lb (22.7 kg). Wild Water's page: "Ages 8+ & 50lbs (23kg)". Hydra's FAQ: "minimum age is 8 yrs and 50lbs", maximum about 350 lb (158.8 kg). The 50 lb figure is a minimum, never a maximum: **the S0 trap is resolved**. Stored as two offers. Wild Water: 3 h, 1 h 20 on the water, Class II-III (Hopi's Hole III+), recommends that pregnant guests stay on land, waivers signed only at the River Base. Hydra: 2-2.5 h, 1 h on the water, "basic swimming ability" preferred, parent co-signs under 18. Both run rain or shine, mid-May to mid-September. Glacier-fed water; no temperature published.
- **Kananaskis raft.** Chinook's FAQ: minimum 5 years and **40 lb minimum** (18.1 kg), 350 lb maximum (158.8 kg), Class 2 and 3, 1.5-2 h on the water in a 4 h tour, non-swimmers pointed to this trip. **The 18.1 kg conflict is resolved: it is a minimum.** Kit list and the "stable, dam-controlled" level come from the booking agent only (`community`).
- **Banff Gondola.** Strollers "not recommended" (stored as `no`, with a note that it is advice). Cabins take wheelchairs; the summit boardwalk is 368 stairs each way. Top terminal 2,281 m. Open year-round except a November maintenance period. Last ride up 1.5 h before closing, last down 10 min before. The September 8 to October 12 hours (09:00-21:00) were read from the same page by the plan research on 12 Oct; the page now shows 13 Oct onward only.
- **Jasper SkyTram.** Strollers and backpack carriers ride, but each needs a free reserved ticket. Upper Station 2,263 m (summit trail to 2,463 m). From 7 Sep: 10:00-18:00, last up 16:30, last down 17:50.
- **Lake Louise gondola.** Under 12 must ride with an adult; under 106 cm only in an enclosed gondola with an adult (`solo` 12). Strollers fold and ride in a separate cabin. 5 Jun-11 Oct 2026, final ride down 17:10. The operator publishes no top elevation and no last ride up.
- **Maligne Lake cruise.** No strollers (leave at the dock); two accessible boats booked ahead; 1.5 h (Premium 2 h). The page now shows the 2027 season, 28 May-10 Oct (`applies_to` 2027).
- **Lake Minnewanka cruise.** No strollers; wheelchair on the back deck only; about 1 h. Classic runs 8 May-12 Oct 2026. The Junior Explorer children's cruise is July and August only (plan research).
- **Lake Louise canoe.** Three adults, or two adults aged 16+ with two children each under 25 kg (55 lb). No age minimum and no life-jacket sizes published.
- **Moraine Lake canoe.** Two to three people per canoe, mid-June to mid-September, closes without notice in wind, rain or snow; shuttle-only road. No child rules published.
- **Emerald Lake canoe.** The operator (CRMR) says only: May to September, canoes and life jackets by the hour. Child weights, the 9 kg smallest jacket and the "19+ in each canoe" rule come from a blog and are kept as `community` values or a conflict.
- **Banff Upper and Miette hot springs.** No minimum age (babies allowed, swim diapers to age 3). Banff: under 14 need an adult 18+. Miette: under 14 need a responsible person 14+ in the same pool. Both 37-40 °C, step-free with aquatic wheelchairs, pregnancy: consult a physician.
- **Ice Explorer.** No minimum age published (the separate Ice Odyssey is 6+). 2.5-3 h, 15-25 min on the ice, no toilets on the glacier. Closes for lightning, blizzards, heavy rain and extreme wind.
- **Skywalk.** Flat 1 km loop, built for wheelchairs and strollers; 40-45 min.
- **Jasper dark sky.** RASC Dark-Sky Preserve since 2011; four roadside spots "accessible and suitable for most visitors"; no stroller detail.
- **Elk rut.** Banff advisory 28 Aug-31 Oct 2026, at least 30 m from all elk. The Jasper 2026 order: 100 m from bears, cougars and wolves, 30 m from elk, moose, caribou, sheep and goats, except inside a legally parked vehicle (`official_rule`).
- **Canmore Nordic Centre.** Over 100 km of trails, a free unsupervised skills park, bear spray strongly recommended. Alberta Parks publishes no IMBA grades.

## Hard limits found

| Record or offer | Limit | Basis and source |
|---|---|---|
| Wild Water Gentle | min age 8; min weight 22.7 kg (50 lb) | operator_rule, wildwater.com Gentle page |
| Hydra Family Whitewater | min age 8; min weight 22.7 kg (50 lb); max weight 158.8 kg (about 350 lb) | operator_rule, raftbanff.com FAQ |
| Chinook Kananaskis | min age 5; min weight 18.1 kg (40 lb); max weight 158.8 kg (350 lb) | operator_rule, chinookrafting.com FAQs |
| Lake Louise gondola | adult required under 12; solo from 12; under 106 cm enclosed cabin with an adult | operator_rule, skilouise.com sightseeing gondola |
| Lake Louise canoe | adults 16+ when two children ride; children under 25 kg each | operator_rule, chateau-lake-louise.com |
| Banff Upper Hot Springs | adult 18+ required under 14; no minimum age | official_rule, Parks Canada FAQ |
| Miette Hot Springs | responsible person 14+ required under 14; no minimum age | official_rule, Parks Canada FAQ |
| Elk rut | wildlife distances 100 m and 30 m | official_rule, Jasper 2026 bulletin |

## Conflicts

Resolved:
- Kicking Horse 50 lb: a **minimum** at both operators (8 years and 50 lb).
- Kananaskis 40 lb (18.1 kg): a **minimum**, per Chinook's FAQ.

Still open:
- Kicking Horse Gentle minimum age: resellers (Orbitz, one AAA page) say 7; the operator says 8. Kept as the operator's 8; the reseller figures are not stored because their hosts are link-only.
- Hydra's family trip class: the booking agent says Class 1-3; Hydra's own page gives no class. Stored as III (the harder end) on the agent's word.
- Emerald Lake canoe: a blog says one person per canoe must be 19+; the operator states nothing (conflict on `adult_required`).
- Jasper SkyTram season start: the 2026 hours table starts 16 May, the plan research saw 15 Apr.
- Emerald Lake canoe season: the operator says May to September, a blog says to Thanksgiving weekend.
- Banff Gondola September hours rest on the plan research's 12 Oct read of the operator page; the page has rolled forward.

## Applicability questions

- **`mtb_xc` on a network.** `effort.drivers.distance_km` and `gain_m` are R, but the Canmore Nordic Centre is a 100 km network with no single route. Both are stored as `not_applicable` with a note. Recommend that a network record take the `area` treatment, with child trail records carrying effort.
- **`canoe_kayak` `water_safety.lifejacket`.** The enum has no value for "provided, sizes not stated", which is what most operators say. Recorded as `searched_none` with that note. Recommend adding `provided_sizes_unknown`.
- **`stroller_on_board` for advice.** Banff Gondola "does not recommend" strollers. The enum has no advice value, so it is `no` with a note. Recommend `not_recommended`.
- **`rafting` `water_safety.class` with a range.** The grade must be a single class, so "II-III" is stored as III with a note. A range type would keep the operator's words.
- **`hot_spring` `ext.water.clarity`** is A. Parks Canada pools are clear and chlorinated; no source says so, so it is left open.
- **`sight` `access_season` (Skywalk, Dark sky)** is A on `sight`. For the Skywalk it is decisive (operator shuttle, May to October), so it was filled.

## Relevance

Classes proposed for `data/vocab/relevance-classes.json` (the JSON uses the nearest existing class until they exist):
- `water/hot-spring` (Banff Upper, Miette; now `sight/landmark`)
- `paddle/canoe-rental` (the three canoe rentals; now `lake/forest-paddle`)
- `sky/dark-sky` (Jasper dark sky; now `viewpoint/roadside`)
- `ride/mtb-network` (Canmore Nordic Centre; now `trail/forest-loop`)

QIDs confirmed: Banff Gondola Q125749525, Jasper Tramway Q6164065, Lake Louise Ski Resort Q13231225 (operator of the gondola), Banff Upper Hot Springs Q4854872, Miette hot springs Q14874867, Columbia Icefield Skywalk Q64841048, Canmore Nordic Centre Provincial Park Q1003855. The other ten have no item of their own and are `searched_none`, naming the lake, river or glacier item in the note. Parent QIDs: Q72895 (World Heritage site), Q41858 Banff, Q503429 Jasper, Q828404 Yoho.

All area designations are `scope: parent`. Editorial mentions were not searched (`gap`). `draw_suggested` is `local` everywhere because `relevance.ts signals --fetch` (the only networked command) has not been run; the coordinator should run it before calibrating.

| Record | Class | Draw | Standing | Distinction | Derived role |
|---|---|---|---|---|---|
| Maligne Lake cruise | water/boat-tour | national | top | unique | anchor |
| Ice Explorer | glacier/walk-on | national | top | unique | anchor |
| Banff Gondola | lift/panorama | national | top | rare | highlight |
| Lake Louise canoe | lake/forest-paddle | regional | top | rare | highlight |
| Moraine Lake canoe | lake/forest-paddle | regional | top | rare | highlight |
| Emerald Lake canoe | lake/forest-paddle | regional | top | rare | highlight |
| Banff Upper Hot Springs | sight/landmark | regional | top | rare | highlight |
| Miette Hot Springs | sight/landmark | regional | top | rare | highlight |
| Kicking Horse family float | water/rafting | regional | top | rare | highlight |
| Jasper SkyTram | lift/panorama | regional | top | rare | filler |
| Jasper dark sky | viewpoint/roadside | regional (national 16-25 Oct) | top | rare | filler |
| Lake Louise gondola | lift/panorama | regional | good | rare | filler |
| Lake Minnewanka cruise | water/boat-tour | regional | good | rare | filler |
| Elk rut | wildlife/viewing | regional | good | common | filler |
| Canmore Nordic Centre | trail/forest-loop | regional | good | common | filler |
| Kananaskis raft | water/rafting | regional | good | rare | filler |
| Columbia Icefield Skywalk | viewpoint/roadside | regional | good | rare | local_only |

## Operator questions (owner question Q14)

Send by email or phone. Contacts are from each operator's own page.

1. **Wild Water Adventures** (1-888-647-6444, info@wildwater.com): Is there a maximum weight on the Gentle trip? Is a swimming ability needed? Are child life jackets sized for 23 kg? Does high water in June raise the age or weight minimum? What is the September water temperature?
2. **Hydra River Guides** (1.888.920.3968): What river class is the Family Whitewater? Can pregnant guests raft? Does the family trip run after Labour Day?
3. **Chinook Rafting** (1-866-330-7238): Is pregnancy allowed? Which gear is provided (wetsuit, booties, spray jacket)? What is the last trip date in September?
4. **Pursuit, Banff Gondola and Jasper SkyTram** (1.866.850.8726): Is a stroller allowed in the Banff cabins or only discouraged? What closes the lifts in wind or lightning, and is a closed day refunded? What are the September hours for the next season?
5. **Pursuit, Columbia Icefield** (1-866-506-0515): Is there a minimum age for the Ice Explorer? Can a stroller ride the shuttle and the Ice Explorer?
6. **Pursuit, Maligne and Minnewanka cruises** (403.762.4425 for Minnewanka): Do you stock child life jackets, and from what weight? Is there a toilet on board? Is there a minimum age? What happens in bad weather?
7. **Lake Louise Ski Resort** (Guest Services): What is the top-station elevation? When is the last ride up?
8. **Fairmont Chateau Lake Louise boathouse**: Child life-jacket sizes; any minimum age; summer season dates.
9. **Moraine Lake Lodge** (403.522.3733): Child rules, minimum age and life-jacket sizes for canoes.
10. **Emerald Lake Lodge, The Boathouse Trading Co.**: Minimum renter age; children per canoe and their weight limit; smallest life jacket; last day of the season.
11. **Parks Canada, Miette Hot Springs** (1-800-767-1611): 2027 opening and closing dates.

## Levels

`check --coverage canadian-rockies-2029`: all 17 R2b records are **usable**, none complete, none draft (15 in scope plus 2 off-plan). Missing A fields per record are listed by the coverage command; the common ones are child life-jacket sizes, toilets and access detail.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First pass: 17 records, both rafts' weight traps resolved, relevance for all 17 |

## Correction pass RC (18 Oct 2026, backlog 3a.8 and 3a.10)

- **Kicking Horse family float `pregnancy`.** "We recommend pregnant ladies remain on land" is advice, not a rule. It is now `operator_info`. The vocabulary has no `not_recommended`, so the value is `ask_doctor` (the nearest non-rule value), with the quote and a note. A `not_recommended` value is a schema follow-up for CF.
- **Moraine Lake canoe `craft_capacity`.** The invented "children 0" is gone. The page says only "two to three people", so the field is `searched_none` for the adult and child split, with that quote.
- **Banff and Miette hot springs `min_age`.** "Babies and toddlers are allowed" is an affirmative no-minimum, so both are now `no_limit`.
- **rebase-basis.** These moved from `operator_rule` to `operator_info`:
  - the swim-ability preferences
  - the Jasper SkyTram stroller note
  - toilets and season fields

  Kept as rules: waivers, the Maligne and Minnewanka stroller ban (`stroller_on_board`) and the Lake Louise canoe capacity (two children under 25 kg).
- **Lake Minnewanka cruise.** The hours page moved, and the new page shows 2027 dates. The access season is now 7 May to 11 Oct 2027 (it was 8 May to 12 Oct 2026).
- **`same_place_as`** (CF one anchor per place):
  - Maligne cruise with Maligne Lake and Spirit Island
  - Ice Explorer with the Athabasca Glacier
  - Minnewanka cruise with Lake Minnewanka
  - the three canoe rentals with their lakes
  - Canmore Nordic Centre activity with the park

  The Maligne cruise and the Ice Explorer drop from anchor to highlight. No Sulphur Mountain or Whitehorn place record exists, so the two gondolas have none.
- **Pair:** the Banff Gondola with the Upper Hot Springs (Mountain Avenue, about 0.5 km).
