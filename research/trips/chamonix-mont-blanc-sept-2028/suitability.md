# Suitability and relevance pass, Chamonix and Mont Blanc (lane R6)

Researched 18 Oct 2026 by travel-researcher. Files:
- `data/suitability/chamonix-mont-blanc-2028/R6.json` (14 records, suitability/1)
- `data/relevance/chamonix-mont-blanc-2028/R6.json` (14 records, relevance/1)

Every timetable, closing date and price is 2026 data used as a pattern (`applies_to: 2026`). No 2028 figure exists.

## What was checked

| Source | Used for |
|---|---|
| en.chamonix.com Aiguille du Midi cable car page (opened) | min age 3, "under 5 not recommended", accessibility, adapted toilet, 3,842 m, 20 min ride, weather wording |
| chamonix.net dates and times 2026 (opened; a private info site, kind `press`) | Aiguille du Midi first/last ascents and last descents by period; Montenvers 14 Sep - 1 Nov; Flegere |
| en.chamonix.com Montenvers train page (opened) | min age 1, "2 to 3 hours", accessibility, adapted toilets, food, 100 steps |
| en.chamonix.com Mer de Glace gondola page (opened) | "about 200 steps", cave not accessible, cave closed 17 Oct - 1 Nov |
| en.chamonix.com Grand Balcon Nord page (opened) | 5.7 km, +140/-523 m, Medium, 2 h 30, 2,310 m, couloir warning, 15 Jun - 31 Oct |
| en.chamonix.com Lac Blanc from La Flegere page (opened) | 7 km, +500 m, Difficult, 3 h, 2,352 m, 1 Jul - 30 Sep, dogs and swimming bans |
| hautesavoiemontblanc-tourisme.com Gaillands climbing site (opened) | lake at 1,017 m, parking, WC, season of the site |
| Chamonix tourist office Loopi route sheet for the Aiguillette des Posettes (PDF opened) | 7 km, Moyenne, 4 h 15, Le Tour to Vallorcine, the arete |
| en.chamonix.com Emosson dam page and valais.ch Vieux-Emosson hike (opened) | dam 16 May - 31 Oct, free; footprint hike 12.9 km, +845 m, difficult, 4 h 40, snow-free from about mid-July |
| en.chamonix.com tourism-and-disability page (opened) | nothing at street level; tried for the town records |
| Wikidata (search, then coordinates and description checked) | QIDs below |

No route platform, Google or booking site is cited. AllTrails figures in the trip research were not used.

## Findings that change the plan

1. **"Lac du Chatelard" could not be identified.** No lake of that name exists near Argentiere, Vallorcine or Le Chatelard in any tourism listing or on Wikidata; the only Lac du Chatelard is at Nevache (Hautes-Alpes). Every R field is `searched_none`. The trip stop should be renamed or dropped.
2. **The "Col des Montets" hike is published as the Aiguillette des Posettes from Le Tour**, not from the Col des Montets: 7 km and 4 h 15 one way to Vallorcine, rated Moyenne. No official gain figure exists. The record keeps the trip ref and holds a hint.
3. **Aiguille du Midi limits are rules from the operator page:** no children under 3 (rule), under 5 not recommended (advice). The early-September 2026 band was 08:10 first ascent, 16:00 last round-trip ascent, 17:30 last descent.
4. **Mer de Glace stairs: the two official pages disagree** (100 steps on the train page, about 200 on the gondola page). The newer gondola page is the value; the other is a conflict.
5. **Emosson footprints are a full hike**, not part of a dam visit.

## Open conflicts

| Record | Field | Conflict |
|---|---|---|
| Grotte de la Mer de Glace | `ext.cave.steps` | 200 (gondola page) against 100 (train page); trip research also cites 430-580 from blogs |
| Emosson | access | valais.ch says the VerticAlp railway closed in 2022; the trip research cites a 2026 funicular timetable. Not resolved; the dam is reachable by post bus |
| Posettes | `gain_m` | not published; GPS sites give +700 to +860 m on comparable routes (kept out of the data) |
| Lac Blanc and Mont Blanc reflection | access | the hike page says open to 30 Sep, the Flegere gondola ran only to 20 Sep in 2026 |

## Applicability questions

- **Mont Blanc reflection** is a viewpoint reached only by a 3.5 km mountain walk. It might be better modelled as part of the Lac Blanc trail record (`part/` ref) than as a separate viewpoint, since its age band simply repeats the trail's.
- **Aiguille du Midi** (`lift`): `age_band` is A, but the operator's "under 5 not recommended" is the most useful child fact; it fits `age_band` with `official_info`, which is what was done.
- **Grotte de la Mer de Glace** (`show_cave`): the access is a gondola plus stairs; `stroller_on_board` is N for show caves, but the gondola's rule would matter.
- **Chamonix market** is an event in a town, not a town. `on_site_min` is the only useful field.

## Operator questions (for the owner to send, Q14)

| To | Contact (from the operator page) | Question |
|---|---|---|
| Compagnie du Mont-Blanc, Aiguille du Midi | +33 4 50 53 22 75 | May a folded pushchair travel in the cabin and onto the terraces? Is there any height or age rule for the Step into the Void? |
| Compagnie du Mont-Blanc, Montenvers and Mer de Glace | via montblancnaturalresort.com | Are pushchairs allowed on the train and the Mer de Glace gondola? What is the current step count to the ice cave, and its temperature? Are back carriers allowed on the stairs? |
| Chamonix tourist office | +33 4 50 53 00 24 | Is there a lake called "Lac du Chatelard" in the upper valley? What is the official climb of the Aiguillette des Posettes route? Is the Lac des Gaillands shore path suitable for a pushchair or wheelchair? |
| VerticAlp Emosson | emosson.ch | Does the Le Chatelard funicular run in September, and is the dam crest step-free? |

## Records and levels

| Record | Profile | Level | Notes |
|---|---|---|---|
| Lac des Gaillands | lake | Usable | wheelchair and walk_m `searched_none` |
| Lac du Chatelard | lake | Usable (all `searched_none`) | unidentified place |
| Aiguille du Midi | lift | Usable | stroller on board `searched_none` |
| Montenvers train | lift | Usable | early-September timetable gap |
| Emosson dam and dinosaur tracks | sight | Usable | stroller, wheelchair `searched_none` |
| Grotte de la Mer de Glace | show_cave | Usable | air temperature, carry_child `searched_none` |
| Chamonix old town | town | Usable | wheelchair `searched_none` |
| Chamonix market | town | Usable | wheelchair `searched_none` |
| Les Praz village | town | Usable | wheelchair `searched_none` |
| Vallorcine | town | Usable | wheelchair `searched_none` |
| Col des Montets (Posettes) | hike | Usable | gain, navigation, group rule `searched_none` |
| Lac Blanc via Flegere | hike | Usable | navigation, group rule `searched_none` |
| Plan de l'Aiguille (Grand Balcon Nord) | hike | Usable | navigation, group rule `searched_none` |
| Mont Blanc reflection | viewpoint | Usable | |

14 of 14 Usable, 0 Complete. No hard limit rests on anything but the operator page.

## Relevance

| Record | QID | Draw | Standing | Distinction | Class | draw_suggested |
|---|---|---|---|---|---|---|
| Lac des Gaillands | Q3215662 | local | good | common | lake/small-mirror | local (no signals fetched) |
| Lac du Chatelard | searched_none | local | ordinary | common | lake/small-mirror | local |
| Aiguille du Midi | Q3088020 (cable car; mountain Q404728) | world | top | rare | lift/panorama | local |
| Montenvers train | Q1069340 | national | top | rare | lift/panorama | local |
| Emosson | Q2885035 | regional | good | rare | sight/landmark | local |
| Grotte de la Mer de Glace | Q30737737 | regional | good | rare | cave/show | local |
| Chamonix old town | Q83236 | world | top | rare | town/alpine-resort | local |
| Chamonix market | searched_none | local | good | common | town/alpine-resort | local |
| Les Praz village | Q6529888 | local | good | common | town/alpine-resort | local |
| Vallorcine | Q912354 | local | good | common | town/alpine-resort | local |
| Col des Montets (Posettes) | Q31661143 | regional | good | common | trail/lookout | local |
| Lac Blanc via Flegere | Q3214753 (the lake; not the Vosges Q267332) | national | top | rare | lake/alpine-hike-in | local |
| Plan de l'Aiguille | searched_none | national | top | rare | trail/lookout | local |
| Mont Blanc reflection | Q3214753 | national | top | rare | lake/small-mirror | local |

`draw_suggested` reads `local` everywhere because `relevance.ts signals --fetch` has not run; calibrate after it does. Gotcha: "Lac Blanc" on Wikidata returns Quebec and Vosges lakes first. Designations: only the Aiguilles Rouges nature reserve (scope `parent`) on Lac Blanc and the reflection; the Mont Blanc massif has no UNESCO or park designation.
