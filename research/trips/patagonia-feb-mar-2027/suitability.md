# Patagonia Feb-Mar 2027: suitability and relevance (lane R3)

Researched 18 Oct 2026 by travel-researcher (Opus) in one pass for both specs (suitability-applicability.md 8.3).

Files:
- Suitability: `data/suitability/patagonia-2027/R3.json` (19 records, 22 sources)
- Relevance: `data/relevance/patagonia-2027/R3.json` (19 records, 16 sources)
- Derived: `data/relevance/derived/patagonia-2027.json` (written by `relevance.ts derive --write`)

`migrated.json` carried no values for this trip. Every value here was read on 18 Oct 2026, apart from the community figures noted below. AllTrails, Komoot, Wikiloc, Gaia and booking sites were not used as sources. Wikimedia Commons was not searched.

## What I checked

| Source | Publisher | Result |
|---|---|---|
| argentina.gob.ar/senderos-del-parque-nacional-tierra-del-fuego | APN | Opened. The official trail table: Costera Media, 8,000 m, 4 h, 70 m, Nov-Apr. Lapataia trails are open to all, all year. Only the Castorera has an adapted route. No group size, registration or minimum age is stated. |
| APN walkway map PDF (Perito Moreno, July 2024) | APN | Opened (text extracted). Six circuits with lengths, times and complexity. Sendero Accesible 565 m is "Muy Baja". Also the safety text on children and steps. |
| api.hieloyaventura.com/api/excurtions | Hielo y Aventura (operator) | **Breakthrough.** The site is a script shell (that is why earlier passes saw only menus), but its own API returns the full product text. Minitrekking: 8-65 only, no exceptions; medical exclusions; crampons and helmets provided; 1 guide per 10; 3.5 km in total; runs all year. |
| piratour.net (4 product pages) | Piratour (operator) | Opened. Martillo landing walk (1 h, zodiac, no pier, not for reduced mobility, not recommended in pregnancy, **no minimum age**), catamaran (2.5 h, all year), Laguna Esmeralda trek (9 km RT, 2 h each way). piratour.com.ar is a stale site with injected casino spam, so I did not use it. |
| turismoushuaia.com (Esmeralda, pingüinera, Canoero, Piratour) | Secretaría de Turismo Ushuaia | Opened. Esmeralda is "dificultad media", among the most recommended. Martillo is the only penguin colony of Tierra del Fuego, with penguins Oct-Apr. |
| elchalten.tur.ar (WordPress API: trekking posts) | Secretaría de Turismo El Chaltén | Opened. Difficulty categories (Alta, Media, Baja) and times. Tres: 4 h each way. Capri: 3:30 RT. Cóndores y Águilas: 3 h total. Chorrillo: 4 km, 1 h. **The pages date from 2016-2017.** The Circuito Azul and Verde page is from 2026. |
| elcalafate.tur.ar (PN Los Glaciares, Perito Moreno) | Secretaría de Turismo El Calafate | Opened. No pets in national parks. Trail registration is required May-Sep. Glacier services: restaurant, snack bar, toilets, parking, accessibility area. |
| argentina.gob.ar/parquesnacionales (Los Glaciares, TdF) | APN | Opened. Los Glaciares is a WHS, inscribed 1981. Contacts. |
| argentina.travel Los Glaciares itinerary | Visit Argentina (INPROTUR) | Opened. "Los recorridos de trekking imperdibles son: Laguna de los Tres..., Loma del Pliegue Tumbado, Laguna Torre y Laguna Capri" (editorial top list, national). |
| switchbacktravel.com, triptins.com, solsalute.com | blogs | Opened. Used only as community values for distance and gain conflicts, exposure, surface, navigation and signal. |
| Wikidata (wbsearchentities, wbgetentities by QID) and the es.wikipedia summaries for Laguna Nimez and Isla Martillo | | QIDs confirmed by coordinates and description (relevance file notes). |

Tried and failed: catamaranescanoero.com.ar (no DNS on 18 Oct 2026); lagunanimez.com (no DNS); elcalafate.tur.ar has no Laguna Nimez page (404); argentina.gob.ar Los Glaciares senderos pages (404, as in the earlier pass); a web search for a provincial Isla Martillo visitor rule found none.

## What I found, per record

| Record | Profile | Level | Key findings |
|---|---|---|---|
| Minitrekking on the glacier | glacier | Usable | **min 8, max 65 (operator rule, no exceptions)**. Pregnancy not allowed. Excludes cardiac, respiratory, mobility and coordination conditions, and BMI 30+. Crampons and helmet provided, own boots. 1 guide per 10. On the ice about 1 h (EN) or 1 h 15 (ES). Not found: shoe size, waiver, adult rule. |
| Beagle Channel boat | boat | Usable | 2.5 h catamaran, 168-195 seats, all year. No age rule (fares start at 0). Not found: stroller, wheelchair or lifejacket rules. |
| Penguin colony stop (Isla Martillo) | wildlife (operated) | Usable | 1 h guided walk; landing by ladder and gangplank, no pier; not for reduced mobility. **Piratour states no minimum age.** Penguins Oct-Apr (official). No distance rule found. |
| Perito Moreno walkways | sight | Usable | Sendero Accesible 565 m is smooth, so the stroller and wheelchair rating is partial; toilets and food on site (official). |
| Palermo and Recoleta, San Telmo, cafes and bookshops, Ushuaia harbour, El Chaltén village | town | Usable | Mostly our judgement. El Chaltén's accessible town circuits are official. |
| Lapataia Bay | viewpoint | Usable | Open all year to all visitors (APN). Wheelchair access not stated. |
| Evening Fitz Roy glow | viewpoint | Usable | All our judgement (see questions below). |
| Laguna Nimez birds | viewpoint | Usable | No official page. Hours, season and walk distance are `searched_none`. |
| Laguna de los Tres | hike | Usable | Local grade "Dificultad Alta"; 8 h (official). Distance and gain have no official figure, so the community 20.9-21 km and 945-1,103 m are kept as conflicts. |
| Laguna Capri | hike | Usable | "Dificultad Media"; 3:30 RT (official). Distance and gain are community conflicts. |
| Mirador de los Cóndores, Mirador de las Águilas | hike | Usable | "Dificultad Baja"; the circuit takes 3 h in total (official). |
| Chorrillo del Salto | hike | Usable | "Dificultad Baja"; 4 km each way and 1 h (official); part of it runs on Ruta 41. |
| Coastal path (Senda Costera) | hike | Usable | APN Medium, 8 km one way, 70 m, 4 h, Nov-Apr. FE2 computed. |
| Laguna Esmeralda | hike | Usable | "Dificultad media" (municipal); 9 km RT and 2 h each way (operator). Gain not found. |

End table (suitability levels):

| Record | Level | R fields open |
|---|---|---|
| all 19 | Usable · 19 of 19 records | 0 |

Complete: 0. Usable: 19. Draft: 0.

## Hard limits found

| Record | Limit | Basis and source |
|---|---|---|
| Minitrekking | min_age 8, max_age 65, "No exceptions" | operator_rule, api.hieloyaventura.com/api/excurtions (read 18 Oct 2026) |
| Minitrekking | pregnancy not allowed; medical exclusions | operator_rule, same |
| Penguin landing | not for reduced mobility (participation N on this profile, so it is held as `wheelchair: none`) | official_info, piratour.net |
| Chaltén trails, Senda Costera | dogs banned in national parks | official_rule, elcalafate.tur.ar |

No height or weight limit is published for any record.

## Conflicts

Resolved:
- **Minitrekking age.** An earlier figure of 8-65 came from press and resellers. It is now an operator rule.
- **Piratour versus "Pira Tour"**: the same company (earlier research). piratour.net is the current site; piratour.com.ar is stale.

Still open (kept as `conflicts` or noted):
- Laguna de los Tres distance (20.9 / 21 km) and gain (945 / 1,103 m): no official figure exists. Time: official 8 h against 7-10 h (community).
- Laguna Capri, Cóndores and Chorrillo: distance and gain are community only. Chorrillo's official distance (8 km RT from "4 km del Chaltén") conflicts with 6.4 km (community).
- Minitrekking time on the ice: 1 h (EN) against 1 h 15 (ES), on the operator's own page.
- **Hielo y Aventura publishes a second product, "Minitrekking2"** (10 h, 15 Aug-31 May, ages 12-60; one label inside it says 18-55). Its relation to Minitrekking (8-65) is unclear. The earlier 8-65 figure belongs to the product named "Minitrekking". Ask the operator.
- Laguna Nimez Wikidata coordinates are about 26 km off the reserve. A person should fix the item.

## Kind and record notes

- No kind changes made, so `kind-map.json` is untouched by this lane.
- The prototype's day 4 puts "Beagle Channel boat" and "Penguin colony stop" on one day. The plan uses a separate Beagle catamaran (day 2) and the Piratour Harberton landing (day 3). I researched the boat as the Lobos and Les Eclaireurs catamaran, and the stop as the Isla Martillo landing walk.
- "San Telmo market": the street fair is Sunday only, and the plan is not in Buenos Aires on a Sunday. The covered market is daily.

## Applicability questions

1. **Wildlife (operated): `participation.guide`, `medical` and `pregnancy` are N.** The Martillo landing has a required guide, a reduced-mobility exclusion and a pregnancy warning. I removed them from the data (W_SUIT_NA_FIELD) and kept the facts in `kid_note`, `hazards` and `wheelchair`. Recommended: make them A on `wildlife` when operated.
2. **Pregnancy enum.** Operators write "not recommended" (Piratour), which is neither `ask_doctor` nor `not_allowed`. Proposed: add `not_recommended`.
3. **BMI limit.** Hielo y Aventura excludes BMI 30+. There is no field (MEDICAL has no `obesity`). Proposed: add `obesity` to MEDICAL, or a `max_bmi` limit.
4. **Laguna Nimez as `viewpoint`.** It is a 3 km self-guided reserve loop for birds. A `walk` or `wildlife` (self) profile fits better. I left it as is because the change needs a person's call on the ref's meaning.
5. **"Evening Fitz Roy glow"** has no fixed viewing spot. If it means Mirador de los Cóndores at sunset (the plan's Day 6), it duplicates that record. If it means the village, `walk_m: 0` is right.
6. **Family effort without official distance.** Laguna de los Tres derives FE3 from drivers only, because its distance and gain are community conflicts. A reviewer override to FE4 (21 km, about 1,000 m) is warranted. Override is a person's call.

## Relevance: proposed classes

- `trail/coastal` for the Senda Costera (I used `trail/forest-loop`).
- `town/city-district` for Buenos Aires neighbourhood walks (I used `town/historic-village`).
- `town/harbour` for waterfront promenades (I used `town/lakeside`).

## Relevance end table

draw_suggested is from `relevance.ts derive`. The signals tool has not fetched yet, so it reflects designations and mentions only.

| Record | Draw | Standing | Distinction | Class | draw_suggested | Role (derived) |
|---|---|---|---|---|---|---|
| Laguna de los Tres | world | top | rare | lake/alpine-hike-in | national | highlight (clear_only drops it) |
| Laguna Capri | national | good | rare | lake/alpine-hike-in | national | highlight |
| Mirador de los Cóndores | regional | top | common | viewpoint/summit-panorama | local | filler |
| Mirador de las Águilas | local | good | common | viewpoint/summit-panorama | local | local_only |
| Chorrillo del Salto | local | good | common | waterfall/hike-in | local | local_only |
| Evening Fitz Roy glow | local | good | rare | viewpoint/roadside | local | local_only |
| Laguna Nimez birds | local | good | common | wildlife/viewing | local | local_only |
| Lapataia Bay | regional | top | rare | viewpoint/roadside | local | highlight |
| Coastal path | regional | top | rare | trail/forest-loop | local | highlight |
| Laguna Esmeralda | regional | top | rare | lake/glacial-turquoise | local | highlight |
| Beagle Channel boat | national | good | rare | water/boat-tour | local | highlight |
| Penguin colony stop | national | top | rare | wildlife/viewing | local | **anchor** |
| Perito Moreno walkways | world | top | unique | sight/landmark | national | **anchor** |
| Minitrekking | national | top | rare | glacier/walk-on | local | **anchor** |
| Palermo and Recoleta | national | good | rare | town/historic-village | local | highlight |
| San Telmo market | national | good | rare | town/historic-village | local | highlight |
| Cafe and bookshops | local | good | common | town/historic-village | local | local_only |
| Harbour walk | local | good | common | town/lakeside | local | local_only |
| El Chaltén village | national | top | rare | town/alpine-resort | local | **anchor** |

QIDs: 9 confirmed, 10 `searched_none` (100% answered).

Calibration note for RV0: Laguna de los Tres is the trip's icon, but `clear_only` drops a world, top place from `plan_around` to `worth_it`. The 3.4 exception covers only `hard` access, not weather. Worth a look in step 6.

## Operator questions for the owner (Q14)

Send by email or WhatsApp. Researchers cannot.

1. **Piratour** (info@piratour.net; WhatsApp +54 9 2901 486234, from piratour.net):
   - What is the minimum age for the Isla Martillo landing walk ("Caminata en Pingüinera")?
   - Must a minor be with an adult, and at what ratio?
   - Is there a minimum distance from the penguins, and who sets it?
   - When does the 2027 landing season end, and does it still run on Tuesdays when Harberton is closed?
   - Do you allow a pushchair or a child carrier on the walk?
2. **Hielo y Aventura** (clientes@hieloyaventura.com, from its own product data):
   - Is there a minimum shoe size for the crampons, and are children's crampons available?
   - Must a minor walk with a parent or guardian, and who signs any waiver?
   - What is the difference between "Minitrekking" (8-65) and "Minitrekking2" (12-60, Aug 15 to May 31)? Which one runs in March 2027?
   - What is the refund rule when the operator suspends a trip for weather?
3. **Canoero or Piratour catamaran** (Canoero +54 02901 433893, from turismoushuaia.com; Piratour as above):
   - Are child lifejackets carried, and from what weight?
   - May a folded pushchair come aboard?
   - Is the boat wheelchair accessible?
   - Is there a minimum age?
4. **Parque Nacional Tierra del Fuego** (tierradelfuego@apn.gob.ar, +54 02901 577931):
   - Are the Bahía Lapataia boardwalks step-free?
   - Is there a group size or registration rule for the Senda Costera?
5. **Parque Nacional Los Glaciares, Centro de Informes** (02902-492504):
   - Does the park publish official distance and climb figures for the El Chaltén trails (Laguna de los Tres, Capri, Cóndores, Chorrillo del Salto)?
6. **Municipalidad de El Calafate** (Secretaría de Turismo):
   - What are the official hours, season and entry fee of the Reserva Laguna Nimez, and how long is its trail?

## Gotchas recorded

- The hieloyaventura.com page is an empty script shell. Its product facts are at `https://api.hieloyaventura.com/api/excurtions` (note the spelling) as JSON, with English text under `lenguage_id: 2`. This is the fix for the "operator returns menus" trap in suitability.md 8.1 R3.
- piratour.com.ar is an old site with injected spam. The current site is piratour.net (WordPress product pages).
- elchalten.tur.ar trail pages render a different post at some URLs. Read them through `wp-json/wp/v2/posts?categories=37`.
- The APN difficulty-map has "Medium" only. The APN page says "Media", so the record quotes the Spanish word and maps it.

## Correction pass RC (18 Oct 2026, backlog 3a.8 and 3a.10)

- **Wording.** "The plan's 8-65" now reads "an earlier figure of 8-65".
- **Piratour Isla Martillo page.** The URL now goes to the "version terrestre" page, which is the same product. The 1 h walk, landing, mobility, clothing and weather quotes all match it. The October to April season quote is not on it; it is on the Ushuaia tourism page, which the access season now cites.
- **rebase-basis.** The minitrekking medical and pregnancy exclusions stay `operator_rule` ("cannot take the tour").
- **Relevance re-judged:**
  - **Isla Martillo penguin stop: national to regional, anchor to filler.** The hard access load (the daily landing quota) drops the regional fit one step. "Only penguin colony in Tierra del Fuego" supports its distinction, not a national draw. It has 3 languages and no measured views.
  - **Minitrekking: national to regional, anchor to highlight.** The draw rested on the parent WHS and plan research. It is now `same_place_as` the Perito Moreno walkways, which keep the anchor.
  - **El Chalten village: stays national and an anchor.** Under the settlement rule only views count, and it has about 31,300 a year, plus the "Capital Nacional del Trekking" title. Distinction stays rare: El Calafate is the only other base, about 200 km away. The note now cites these, not the WHS.
