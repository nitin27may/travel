# Dolomites July 2027: suitability and relevance research (lane R1)

Researched 18 Oct 2026 by travel-researcher (Opus) in one pass for both specs. Output files:
- `data/suitability/dolomites-2027/R1.json` (suitability/1, 45 records: the 40 scope refs plus the 5 `part/` walk records S0b split out)
- `data/relevance/dolomites-2027/R1.json` (relevance/1, 40 records, one per scope ref)

All dates, prices and seasons are 2026 figures used as a pattern for 2027. Nothing here is a household fact.

## Gotchas found this pass

- **The Funbob "7 or 8" disagreement is resolved.** The operator page (dreizinnen.com) states: under 3 not allowed, under 8 only with a rider of 18 or over, from 8 a child must ride alone with ID. The plan's "minimum age 8" was the solo age, not the minimum. The minimum is 3.
- **The Rienza raft has two operator ages.** The tour page says minimum 6. The same operator's FAQ says children under 9 only after consultation. Both are kept: 6 is the rule, 9 is the conflict.
- **The operator's terms disagree with its FAQ on pregnancy** (rafting): the AGB says white water is not suitable; the FAQ says "let us assess together". The AGB is the value.
- **Lagazuoi has two season starts and two top-station heights** on its own pages: 6 June on the web page, 30 May on the price PDF; 2,752 m on the accessibility page, 2,782 m on the price PDF.
- **Overpass was failing (502 and 500)** while the other lanes ran; the OSM API `relation/<id>/full.json` worked for route geometry. Open-Meteo's elevation API returned 429 after a few batches.
- **A 90 m DEM over-counts climb on cliff traverses.** Sorapis came out at 575 m up one way against the 114-220 m reports, so the DEM gain was not used there. It was used, labelled as an upper bound, only on Viel dal Pan.
- **OSM `cai_scale` is mapper-tagged.** It is stored with basis `community`, never `official_grade`. No CAI section page with grades was found for any route; the CAI Veneto hut sheets redirect to a section index.
- **Several earlier figures came from route platforms** (the Croda del Becco 7.3 km and 1,314 m, the Federa 7.9 km). Those platforms are never a source, so the figures are not values here; Croda del Becco's distance and gain are `searched_none`.

## What was checked, record by record

Sources are in the files' `sources` tables with their read date. "Search result" means the page was read through a search summary, not opened; such values carry that note.

### Trails and walks
- **Tre Cime loop**: dreizinnen.com tour 569 (Easy, 8.8 km, 550 m up and down, 4 h, 2,169-2,451 m, trails 101 and 105) and the Three Peaks highlight page ("the icon of the Dolomites", a UNESCO highlight). auronzo.info for the toll road (online booking only, 40 EUR, 12 h, late May to late October; disabled visitors free after booking). Trail reports' 9.5-10.5 km and 400-480 m are kept as conflicts.
- **Cadini viewpoint**: no official page. Distance and gain from dated trail reports in the trip research (community); OSM path 117 is EEA beyond the viewpoint.
- **Lago di Sorapis**: OSM path 215 (E). Length from the OSM line to Rifugio Vandelli, doubled (12.6 km). Gain is the midpoint of the report range; the DEM value is rejected (see Gotchas).
- **Cinque Torri**: cortina.dolomiti.org open-air museum page (part of the largest WWI open-air museum of the Dolomites). Lift dates from the trip research, not re-read.
- **Monte Piana**: pustertal.org museum page (jeep shuttle 1 Jun-31 Oct 2026, 09:00-17:00, every 20 min, no booking; "exposed but secured spots") and the suedtirol.info theme path (994 m, 130 m, 30 min from Rifugio Bosi). The 9.2 km and 600 m are the plan's, labelled.
- **Croda del Becco**: dreizinnen.com tour 544 (Difficult; 3 h 30 in the facts against 4.5 h in the text; wire-rope sections; "very demanding, vertigo and slip resistance required"). No distance or gain on the page.
- **Val Fiscalina**: dreizinnen.com valley page (family and buggy valley; paid car park) and tour 50030 (4.5 km, 101 m, 1 h 10, Intermediate).
- **Federa walk**: OSM paths 437 and 434 (both T); a family hiking blog and a news page via search (about 4 km and 350 m each way; carrier yes, stroller no).
- **Cascate di Fanes**: cortina.dolomiti.org botanical path (Easy, 7 km, 249/253 m, 2 h 30, asphalt then dirt, roots at the end, Ampezzo Dolomites natural park).
- **Adolf Munkel Weg**: odlesdolomites.com activity page (Intermediate, 12.42 km against 13 km in the directions, 593/876 m, 3:50 against 4:30, trails 6, 35, 28; the 9 km loop via Geisleralm).
- **Alpe di Siusi (Steger trail)**: seiser-alm.it (leicht, 9.9 km against 4.5 km in the text, 333 m, 3 h, path 30, tagged pushchair- and family-friendly) and the board's stroller brochure PDF (section Compatsch to Laranzer Schwaige, 5.4 km).
- **Bullaccia**: seiser-alm.it (easy, 9.1 km, 340 m, 3:10, signposts 14, PU, 24) and the stroller brochure's "Auf dem Puflatsch" (8.8 km, 333 m, mittel; out and back to the Arnika hut).
- **Vallunga**: valgardena.it (the winter listing: Easy, 7.5 km, 200 m, 2 h, path 14, Puez-Geisler park). Stroller from family blogs (search results).
- **Viel dal Pan**: OSM path 601 (E); length and DEM gain computed from the OSM line (7.2 km, 511 m up, 688 m down one way). The Dolomiti Superski route page returned 403.
- **Sass Pordoi and Piz Boè**: sasspordoi.it (14 May-1 Nov 2026, 09:00-17:00, 4 min ride, 2,950 m); trentino.com (a commercial guide, so `community`: 7.8 km, 561 m, 3 h 15, 2,830-3,152 m, rope-secured sections); OSM 627 (E) and 638 (EEA:F).
- **Lagazuoi tunnels**: lagazuoi.it percorso 6 (more than 1 km of tunnel, 639 m of descent, 2.5-3 h, cables throughout; footwear, gloves, headlamp and helmet).
- **Seceda ridge**: seceda.it summer page (22 May-2 Nov 2026, 08:30-17:00; adult 74 EUR return, juniors 8-15.99 37 EUR, under 8 free with a paying adult; panoramic point at 2,500 m). No walk figures anywhere official.
- **Braies walk**: dreizinnen.com family tour (3.6 km, 86 m, 59 min) and prags.bz (wide forest path on one side, steep sections with steps on the other; not fully step-free).
- **Dobbiaco and Limides walks**: no board page found; plan figures labelled `our_inference`.

### Lakes, viewpoints, towns, sight, area
- **Lago di Braies**: prags.bz (1 Jul-15 Sep 2026, 09:00-16:00, cars only with a reservation; 44 EUR combined ticket; P4 about 100 m from the lake; disabled spaces; an accessible toilet at Emma's Bistrot; please avoid swimming).
- **Lago di Carezza**: eggental.com (barrier-free circuit and platform, barrier-free toilets 09:00-18:00, 4 disabled spaces, swimming strictly prohibited, natural monument, 1,520 m).
- **Landro, Antorno, Dobbiaco lake, Misurina, Limides, Federa**: no land-manager page with access facts found; Misurina's stroller and wheelchair facts are from a family blog and a disability travel guide (search results).
- **Passo Gardena**: only press. ÖAMTC reports the September 2026 ban put on hold; l'Adige reports a planned 150-vehicle booked zone from 2027.
- **Santa Maddalena**: the Villnöss board's sustainable-behaviour PDF, via search only (the church road is closed to non-residents; park and walk about 30 min). The PDF itself did not open.
- **Towns (9)**: no town accessibility pages found; stroller and wheelchair are `our_inference` (paved centres with setts and slopes). These are the weakest records.
- **Ötzi museum**: iceman.it opening times (daily in July and August, last entry 17:30, under 6 free); the press kit ("barrierefrei"; 277,754 visitors in 2025); suedtirolfueralle.it survey (side entrance with ramps for prams and wheelchairs, lifts to every floor, door widths, reserved parking).
- **Dolomites (area)**: UNESCO 1237 (2009, criteria vii and viii) via search results; whc.unesco.org returns 403.

### Activities and lift
- **Funbob**: see Gotchas. Also: max 127 kg per sled, heart and back problems and pregnancy excluded, may close in thunderstorms or heavy rain; 23 May-18 Oct 2026, 09:00-18:30 from 21 Jun to 30 Aug.
- **Rafting on the Rienza**: Rafting Club Activ tour page (minimum 6, 2.5 h, 09:30 and 13:30, under 14 50 EUR, from 14 70 EUR, swims and an optional bridge jump), FAQ (wetsuit, neoprene shoes and helmet provided; swimsuit and towel; runs in any weather; under 9 after consultation), AGB (good physical condition; not suitable in pregnancy; full refund when cancelled for safety). Pustertal board: May to September, "should know how to swim".
- **Drava path**: the San Candido tourist office flyer (44 km, 500 m height difference, families and beginners, return by train, bring ID; rental shops with a Lienz pick-up service).
- **Lagazuoi cable car**: lagazuoi.it info page, the price PDF (under 8 free with a paying adult; last up 16:40, last down 17:00), the conditions of sale (minors under an adult's supervision; no guarantee of operation, no refunds) and "An accessible mountain" (no barriers from the car park to the top terrace; a wheelchair path to the refuge with a stairlift).

## Open conflicts

| Record | Field | Values kept | Next step |
|---|---|---|---|
| Rafting on the Rienza | `min_age` | 6 (tour page) against under 9 after consultation (FAQ) | Ask the operator (below) |
| Rafting on the Rienza | `participation.pregnancy` | not allowed (AGB) against assess together (FAQ) | Ask the operator |
| Rafting on the Rienza | `water_safety.swim_ability` | not stated by the operator; the board says "should know how to swim" | Ask the operator |
| Lagazuoi cable car | `access_season` | 6 Jun (web) against 30 May (PDF) to 18 Oct 2026 | Re-read in spring 2027 |
| Lagazuoi cable car | `altitude_m` | 2,752 m (accessibility page) against 2,782 m (price PDF) | Ask the operator |
| Alpe di Siusi | `distance_km` | 9.9 km (header) against 4.5 km (text, one way) | Both on one board page; 4.5 is one way |
| Adolf Munkel Weg | `distance_km`, `adult_time_min` | 12.42 km and 3:50 against 13 km and 4:30 on one page | Low impact |
| Bullaccia | `source_grade` | easy (trail page) against mittel (stroller brochure) | Low impact |
| Val Fiscalina | `source_grade` | Intermediate (circular trail) against Easy (buggy route) | Different routes in one valley |
| Sass Pordoi and Piz Boè | `source_grade` | CAI E (627) against EEA:F (638, summit) | The FE3 under-rates the summit; see Applicability question 4 |
| Lago di Sorapis | `gain_m` | 550 (report midpoint) against 114 one way and the rejected DEM | Needs an official figure or an L4b track |
| Cadini viewpoint | `distance_km`, `gain_m` | 3.9 km / 144 m against 3.2 km / 210 m and an OSM 4.3 km | Needs a track |
| Tre Cime loop | `distance_km`, `gain_m`, `age_band` | board 8.8 km / 550 m against reports; an earlier figure of 6 against our 10 | Board figures are the value |
| Passo Gardena | `access_season` | open against a planned 2027 booked zone (press) | Check the Province traffic page in spring 2027 |
| Lagazuoi tunnels | `effort.drivers.loss_m` | 639 m (operator) against 647 m (Cortina board via the plan) | Low impact |
| Croda del Becco, Piz Boè | `min_age` | searched_none; the plan's 12 kept as an `our_inference` conflict | Not a rule |

**Resolved:** the Funbob solo age (8, operator); the Funbob minimum age (3, operator; an earlier figure of 8 was the solo age); the Rienza minimum of 6 is now an operator rule rather than a plan figure.

## Applicability questions

1. **`group_min` is R on `hike`, but no Italian or South Tyrol day hike has a group rule.** Thirteen records carry the same `searched_none`. Suggest A on `hike` and R only where a land manager publishes group rules (Parks Canada).
2. **`max_weight_kg` is R on `coaster`, but coaster operators publish a load per sled, not a rider weight** (Funbob: 127 kg per sled, which is `ext.coaster.max_load_kg`). Suggest A for `max_weight_kg` on `coaster`.
3. **`effort.drivers.gain_m` is R on `cycle_path`, but downhill rides publish a height difference only** (Drava: 500 m of descent). Derive should accept `loss_m` alone for a one-way downhill ride, or `gain_m` should be A when `ext.ride.one_way_return` is set.
4. **One `source_grade` per hike hides a harder section.** Piz Boè is CAI E to Rifugio Boè and EEA:F for the summit path; derive maps E to terrain 3 and gives FE3. Suggest a "hardest section" rule or a second grade field, so the summit reads as FE4 or FE5.
5. **`wheelchair` and `stroller` are R on `town`**, but no town in scope has an accessibility page; all nine are our inference. Fine as R, but the UI should show them as "our judgement" clearly.
6. **`water_safety.child_sizes_from_kg` is R on `rafting`**, and no operator here publishes it; it will be `searched_none` almost everywhere. Consider A.
7. **`hazards` is N on `town` and on `lake`'s rowing-boat use at Braies.** The Braies boats are a rental with their own rules (an `activity/boat-tour`-like record would be needed). Not added.

## Proposed relevance classes

- `activity/coaster`: an alpine coaster or rail toboggan (Funbob is filed under `activity/ropes-zip` as the nearest class).
- `region/mountain-range`: a whole range or UNESCO serial site (the Dolomites is filed under `peak/summit`).
- `trail/cycle-path`: a long car-free cycle path (the Drava path is filed under `trail/riverside`).

## Operator questions to send (owner question Q14)

Send by email where an address is given; the operator's own pages are the source of each contact.

**Rafting Club Activ** (info@rafting-club-activ.com, +39 328 966 07 78, Rienz meeting point: sports zone St. Sigmund)
1. Your Rienza tour page says minimum age 6, and your FAQ says children under 9 only after consultation. Which applies, and what do you check for children from 6 up to 9?
2. Is there a minimum or maximum body weight for the Rienza tour, and from what weight do you have life jackets and wetsuits?
3. What whitewater class is the San Sigismondo to Rio di Pusteria section in July, and how long is the section in km?
4. How long is the time on the water within the 2.5 hours?
5. Must participants be able to swim? Is there a test?
6. Is there a form to sign, and who signs for a minor?
7. Your AGB says white water is not suitable in pregnancy; your FAQ says you assess together. Which applies?
8. What is the usual water temperature in July?

**3 Zinnen Dolomites lifts, Funbob Monte Baranci** (contact on dreizinnen.com)
1. Is there a minimum or maximum height to ride, alone or as a passenger?
2. How many riders may sit on one sled?
3. Is there a minimum or maximum rider weight, apart from the 127 kg per sled?
4. If the run closes for a storm, is the ticket refunded or valid another day?
5. Can a wheelchair user ride the Haunold chairlift to the top?

**Lagazuoi S.p.A.** (lagazuoi@lagazuoi.it, +39 0436 867301)
1. May a pushchair travel in the cable car, open or folded?
2. Your web page gives a 6 June 2026 opening and the price PDF 30 May. Which is right, and when will 2027 dates be published?
3. Is the top station at 2,752 m or 2,782 m?
4. Do you advise a minimum age for the tunnel descent?

**Seceda AG** (contact on seceda.it)
1. May pushchairs and wheelchairs use the Ortisei-Furnes-Seceda cabins?
2. Is a time slot still required in 2027, and how far ahead can it be booked?

**Sass Pordoi cable car** (+39 0462 608811, info@canazei.org)
1. What are the child age bands and the free age?
2. May a pushchair or wheelchair travel in the cabin?
3. What time is the last descent in July?

**South Tyrol Museum of Archaeology** (+39 0471 320 100, info@iceman.it)
1. May pushchairs go round the exhibition, or must they be left at the cloakroom?
2. Does the family room with supervised childcare run in July and August 2027?

**Papin Sport** (+39 0474 913450, papinsport.com)
1. Which child seats, trailers, tag-alongs and children's bike sizes can be hired in San Candido?
2. How does the Lienz bike pick-up work, and when must it be booked?
3. Can the train back from Lienz carry the hire bikes?

**Monte Piana jeep shuttle** (info@montepiana.com, +39 338 5282447)
1. Are child seats available, and may a folded pushchair ride along?
2. When will the 2027 dates be confirmed?

## Suitability levels by record

Levels from `node core/bin/suitability.ts check --coverage dolomites-2027`: **45 usable, 0 complete, 0 draft**. "R answered" counts `value`, `none_stated` and `searched_none`.

| Record | Profile | Level | R answered | A answered | Searched, nothing published (R) |
|---|---|---|---|---|---|
| `place/tre-cime-di-lavaredo-loop` | hike | Usable | 13 of 13 | 5 of 23 | group_min |
| `place/cadini-di-misurina-viewpoint` | walk | Usable | 11 of 11 | 1 of 21 | - |
| `place/lago-di-sorapis` | hike | Usable | 13 of 13 | 5 of 23 | group_min |
| `place/cinque-torri` | walk | Usable | 11 of 11 | 0 of 21 | effort.drivers.gain_m |
| `place/monte-piana` | hike | Usable | 13 of 13 | 3 of 23 | group_min |
| `place/croda-del-becco` | hike | Usable | 13 of 13 | 5 of 23 | group_min, effort.drivers.distance_km, effort.drivers.gain_m |
| `place/val-fiscalina` | hike | Usable | 13 of 13 | 4 of 23 | group_min |
| `part/place/lago-federa#walk` | hike | Usable | 13 of 13 | 2 of 23 | group_min |
| `place/cascate-di-fanes` | hike | Usable | 13 of 13 | 4 of 23 | group_min, access_season |
| `place/adolf-munkel-weg` | hike | Usable | 13 of 13 | 4 of 23 | group_min |
| `place/alpe-di-siusi` | hike | Usable | 13 of 13 | 3 of 23 | group_min |
| `place/bullaccia-and-the-witches-benches` | hike | Usable | 13 of 13 | 5 of 23 | group_min |
| `place/vallunga` | hike | Usable | 13 of 13 | 4 of 23 | group_min |
| `place/viel-dal-pan` | hike | Usable | 13 of 13 | 3 of 23 | group_min |
| `place/sass-pordoi-and-piz-boe` | hike | Usable | 13 of 13 | 5 of 23 | group_min |
| `part/place/lagazuoi-cable-car-and-tunnels#tunnels` | walk | Usable | 11 of 11 | 4 of 21 | effort.drivers.distance_km |
| `place/seceda-ridge` | walk | Usable | 11 of 11 | 1 of 21 | effort.drivers.distance_km |
| `part/place/lago-di-braies#walk` | walk | Usable | 11 of 11 | 5 of 21 | - |
| `part/place/lago-di-dobbiaco#walk` | walk | Usable | 11 of 11 | 1 of 21 | wheelchair |
| `part/place/lago-di-limides#walk` | walk | Usable | 11 of 11 | 1 of 21 | - |
| `place/lago-di-braies` | lake | Usable | 7 of 7 | 5 of 19 | - |
| `place/lago-di-carezza` | lake | Usable | 7 of 7 | 7 of 19 | walk_m |
| `place/lago-di-landro` | lake | Usable | 7 of 7 | 0 of 19 | stroller, wheelchair |
| `place/lago-dantorno` | lake | Usable | 7 of 7 | 0 of 19 | stroller, wheelchair |
| `place/lago-di-dobbiaco` | lake | Usable | 7 of 7 | 0 of 19 | stroller, wheelchair |
| `place/lago-di-misurina` | lake | Usable | 7 of 7 | 0 of 19 | - |
| `place/lago-di-limides` | lake | Usable | 7 of 7 | 0 of 19 | - |
| `place/lago-federa` | lake | Usable | 7 of 7 | 1 of 19 | - |
| `place/passo-gardena` | viewpoint | Usable | 8 of 8 | 1 of 14 | - |
| `place/santa-maddalena-val-di-funes` | viewpoint | Usable | 8 of 8 | 0 of 14 | wheelchair |
| `place/bolzano` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/cortina-dampezzo` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/dobbiaco` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/la-val` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/ortisei` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/san-candido` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/san-vito-di-cadore` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/santa-cristina` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/selva-di-val-gardena` | town | Usable | 2 of 2 | 1 of 8 | - |
| `place/otzi-south-tyrol-museum-of-archaeology` | sight | Usable | 4 of 4 | 6 of 12 | - |
| `place/dolomites` | area | Usable | 4 of 4 | 1 of 15 | - |
| `place/funbob-monte-baranci` | coaster | Usable | 16 of 16 | 2 of 5 | min_height_cm, max_height_cm, min_weight_kg, max_weight_kg, ext.coaster.max_riders |
| `place/rafting-on-the-rienza` | rafting | Usable | 23 of 23 | 1 of 7 | min_weight_kg, max_weight_kg, water_safety.class, water_safety.lifejacket, water_safety.child_sizes_from_kg, water_safety.swim_ability, water_safety.water_temp_c, participation.waiver, ext.paddle.class_at_level, ext.paddle.on_water_min |
| `place/drava-cycle-path-to-lienz` | cycle_path | Usable | 8 of 8 | 3 of 15 | effort.drivers.gain_m |
| `place/lagazuoi-cable-car-and-tunnels` | lift | Usable | 9 of 9 | 6 of 16 | stroller_on_board |

## Relevance by record

Draw: 2 world, 8 national, 22 regional, 8 local. Derived roles (`relevance.ts derive`, before `signals --fetch` has run, so `draw_suggested` reads no fame signals yet): 7 anchors, 9 highlights, 12 fillers, 12 local only. QIDs: 36 agent-confirmed by coordinates and description (a person should re-check), 4 `searched_none` (Adolf Munkel Weg, Viel dal Pan, Funbob, the Rienza raft product).

| Record | Draw | Standing | Distinction | Class | QID | draw_suggested (no signals fetched yet) | Role |
|---|---|---|---|---|---|---|---|
| `place/tre-cime-di-lavaredo-loop` | world | top | unique | trail/alpine-loop | Q1257207 | national | anchor |
| `place/cadini-di-misurina-viewpoint` | regional | top | rare | viewpoint/summit-panorama | Q476378 | local | filler |
| `place/lago-di-sorapis` | national | top | rare | lake/alpine-hike-in | Q15410555 | local | anchor |
| `place/cinque-torri` | regional | top | rare | sight/heritage-site | Q933666 | local | highlight |
| `place/monte-piana` | regional | good | rare | sight/heritage-site | Q872637 | local | filler |
| `place/croda-del-becco` | regional | good | common | peak/summit | Q446041 | local | local_only |
| `place/val-fiscalina` | regional | top | common | trail/riverside | Q1420331 | local | filler |
| `place/lago-federa` | regional | good | common | lake/alpine-hike-in | Q3825692 | local | filler |
| `place/cascate-di-fanes` | regional | top | rare | waterfall/hike-in | Q67370898 | local | highlight |
| `place/adolf-munkel-weg` | regional | top | rare | trail/alpine-loop | searched_none | local | highlight |
| `place/alpe-di-siusi` | national | top | unique | trail/alpine-loop | Q1261451 | local | anchor |
| `place/bullaccia-and-the-witches-benches` | regional | good | common | viewpoint/summit-panorama | Q2117539 | local | filler |
| `place/vallunga` | local | good | common | trail/forest-loop | Q1408786 | local | local_only |
| `place/viel-dal-pan` | regional | top | rare | trail/lookout | searched_none | local | filler |
| `place/sass-pordoi-and-piz-boe` | regional | good | rare | peak/summit | Q1478439 | local | local_only |
| `place/lagazuoi-cable-car-and-tunnels` | regional | top | rare | lift/cable-car-hike | Q16557871 | local | highlight |
| `place/seceda-ridge` | national | top | rare | viewpoint/summit-panorama | Q2263528 | local | highlight |
| `place/lago-di-braies` | national | top | rare | lake/glacial-turquoise | Q445369 | regional | anchor |
| `place/lago-di-carezza` | national | top | rare | lake/small-mirror | Q1416530 | local | highlight |
| `place/lago-di-landro` | regional | good | common | lake/small-mirror | Q691103 | local | local_only |
| `place/lago-dantorno` | local | good | common | lake/small-mirror | Q2217047 | local | local_only |
| `place/lago-di-dobbiaco` | local | ordinary | common | lake/small-mirror | Q2438157 | local | local_only |
| `place/lago-di-misurina` | regional | good | common | lake/small-mirror | Q1177961 | local | filler |
| `place/lago-di-limides` | local | good | common | lake/small-mirror | Q55978735 | local | local_only |
| `place/passo-gardena` | regional | good | common | drive/mountain-pass | Q1416427 | local | local_only |
| `place/santa-maddalena-val-di-funes` | national | top | unique | sight/landmark | Q33481488 | local | highlight |
| `place/cortina-dampezzo` | national | top | rare | town/alpine-resort | Q41158 | local | anchor |
| `place/ortisei` | regional | top | common | town/alpine-resort | Q255568 | local | filler |
| `place/selva-di-val-gardena` | regional | good | common | town/alpine-resort | Q499129 | local | filler |
| `place/santa-cristina` | local | good | common | town/alpine-resort | Q504253 | local | local_only |
| `place/san-candido` | regional | top | common | town/historic-village | Q474782 | local | filler |
| `place/dobbiaco` | local | good | common | town/historic-village | Q380189 | local | local_only |
| `place/san-vito-di-cadore` | local | ordinary | common | town/alpine-resort | Q41024 | local | local_only |
| `place/la-val` | local | good | common | town/historic-village | Q419733 | local | local_only |
| `place/bolzano` | regional | good | common | town/historic-village | Q6526 | local | filler |
| `place/otzi-south-tyrol-museum-of-archaeology` | national | top | unique | sight/museum | Q1755973 | local | anchor |
| `place/dolomites` | world | top | unique | peak/summit | Q1283 | national | anchor |
| `place/funbob-monte-baranci` | regional | top | rare | activity/ropes-zip | searched_none | local | highlight |
| `place/rafting-on-the-rienza` | regional | good | common | water/rafting | searched_none | local | filler |
| `place/drava-cycle-path-to-lienz` | regional | top | rare | trail/riverside | Q1255895 | local | highlight |

AllTrails and the other route platforms were not used as sources. Cross-check links found earlier stay in `research/trips/dolomites-july-2027/trails.md`.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | Lane R1: suitability and relevance in one pass; 45 suitability records usable, 40 relevance records |

## Correction pass RC (18 Oct 2026, backlog 3a.8 and 3a.10)

- **Wording.** "The plan's age 6/8/12/10" and "The trip plan used 6" now read "an earlier figure of ...". The Rienza operator question now asks "what do you check for children from 6 up to 9?" (also in docs/v2/research/operator-questions-2026-10-18.md).
- **Otzi museum.** The opening and fees page moved to /en/the-museum/opening-times-and-fees and was re-read. "Children under the age of 6 gratis" is an affirmative welcome, so `min_age` is now `no_limit`. The access season (Tue-Sun 10-18, open Mondays in July and August, closed 1 Jan, 1 May and 25 Dec) still matches; its basis is now `operator_info`.
- **Santa Maddalena.** The Villnoss board PDF is gone. All 8 values (5 suitability, 3 relevance) now cite the IDM Sudtirol church page, which states the gated resident-only road, the Putzen car park and the walk of about 30 min.
- **Open-Meteo.** The bare API endpoint is replaced by the Elevation API documentation page, with the method in the title: latitude and longitude arrays sampled every 30 m along OSM relation 7302436. Distance values never came from elevation, so the source was removed from the Viel dal Pan, Sorapis and Cadini distances; they rest on the OSM relations.
- **Lago di Braies walk.** The family-tour listing (_675) now redirects to a 404. The board's live summer-walk listing (_644) for the same loop gives 3.6 km, 59 min and 86 m, graded Easy. The old listing said Intermediate, and the grade note records that.
- **Passo Gardena.** The ÖAMTC article was opened at its new slug. It confirms "Das für 1.9. geplante Fahrverbot für das Grödner Joch gilt vorerst nicht".
- **rebase-basis.** 19 Lagazuoi, Seceda, Funbob and Rienza values moved to `operator_info`: seasons, altitude, last up and down, ride time, food, kit, wear and weather cancellation. Kept as rules: the Funbob pregnancy and medical exclusions, and the Rienza pregnancy and fitness conditions.
- **Relevance: Cortina d'Ampezzo, anchor to highlight.** Distinction moves from rare to common: San Vito (10 km), Selva (29 km), Santa Cristina (32 km) and Ortisei (36 km) are the same class. The old note already said "towns are many in the area".
- **Pairs:**
  - Tre Cime loop with the Cadini viewpoint (from Rifugio Auronzo)
  - Lagazuoi with Cinque Torri (both on Passo Falzarego)
  - Alpe di Siusi with the Bullaccia and Witches' Benches
  - Santa Maddalena with the Adolf Munkel trail
