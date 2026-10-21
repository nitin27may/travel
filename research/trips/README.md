# Trips: the index

One row per trip: every folder in `research/trips/` and every trip page in `legacy/`. A new trip gets its row here before
its first lane file, and uses its trip id for both `research/trips/<id>/` and `data/*/<id>/`. The 13 older folders keep their
legacy names (data citations and validator examples name them), so the second column maps each folder to its trip id.

State as of 21 Oct 2026. "Built" means a legacy page exists in `legacy/<folder>/index.html`. Since 18 Oct 2026 every legacy
folder is served and public in `legacy/MANIFEST.json` (commit c694021); the old live site changes only at go-live. The
public slug is the new site's `/trips/<slug>/` (`web/lib/public/slugs.ts`).

| Research folder | Trip id and data | Legacy page | Public slug | State | Dates and shape | Open items |
|---|---|---|---|---|---|---|
| `algonquin-muskoka-oct-2026` | `algonquin-muskoka-2026`: capture, suitability, relevance | built, PLAN.md | `algonquin-muskoka-2026` | past | 10-12 Oct 2026, 2 nights at Dwight (Lake of Bays) from Whitby | none (trip done) |
| `canadian-rockies-sept-2029` | `canadian-rockies-2029`: capture, suitability, relevance, schedules | built, PLAN.md, `data/*.json` | `canadian-rockies-2029` | planned; published on the old site | 8-22 Sep 2029, 14 nights, Calgary in and out, 5 bases | 9 broken links (1 on the page); no minimum height found for 42 of 43 adventures |
| `chamonix-mont-blanc-sept-2028` | `chamonix-mont-blanc-2028`: capture, suitability, relevance | built, PLAN.md | `chamonix-mont-blanc-2028` | planned | 1-9 Sep 2028, 8 nights, Les Praz 3 and Argentiere 4 | Mont Blanc tunnel autumn closure; UTMB 2028 dates; no 2028 timetables |
| `costa-rica-feb-2027` | `costa-rica-2027`: no data yet | built, PLAN.md | `costa-rica-2027` | planned | 13-23 Feb 2027, 10 nights, Rincon de la Vieja, Arenal, Manuel Antonio, Uvita | open-jaw fare; Poas status for Feb 2027; `gaps.md` in the folder |
| `dolomites-july-2027` | `dolomites-2027`: capture, suitability, relevance, schedules, legs | built, PLAN.md | `dolomites-2027` | planned | 13-26 Jul 2027, Venice in and out, rental car, 4 bases | guide minimum ages; activity prices and limits (GAPs in PLAN.md) |
| `iceland-ring-road` | `iceland-ring-road-2027`: capture, suitability, relevance | built, PLAN.md | `iceland-ring-road-2027` | planned | 4-15 Sep 2027, 11 nights, camper van, Ring Road and Snaefellsnes | no campsite confirmed open for Sept 2027; all prices 2026 |
| `niagara-day-aug-2026` | `niagara-day-2026`: no data | built, PLAN.md | `niagara-day-2026` | past | 29 Aug 2026, one day from Whitby | none (trip done) |
| `norway-summer` | `norway-summer-2028`: no data | built, PLAN.md | `norway-summer-2028` | planned, dates open | summer 2028, 14 nights, Lofoten, Senja, Fjord Norway; window A about 24 Jun-8 Jul | group size; driving legs not routed (GAP) |
| `patagonia-feb-mar-2027` | `patagonia-2027`: capture, suitability, relevance | built, PLAN.md | `patagonia-2027` | planned; book now | 26 Feb-11 Mar 2027, 13 nights, BA, Ushuaia, El Chalten, El Calafate | flight and Chalten lodging by 31 Oct 2026; Piratour minimum age; hotel prices |
| `peru` | none | none (research only) | none | idea | no dates; 17-day or 24-26-day shapes in `notes/DAYS.md` | dates and length |
| `switzerland-2027` | `switzerland-2027`: no data | built, PLAN.md | `switzerland-2027` | planned | 27 Jul-10 Aug 2027, 14 nights, rail, Lucerne, Wengen, Zermatt | the pass choice; the join with the Dolomites trip |
| `usa-southwest-rockies` | `utah-five-parks`: capture, suitability, relevance | built, PLAN.md | `utah-five-parks` | planned, dates open; published on the old site | 11 days, 10 nights, five Utah parks | dates (hard line 1 October); `notes/CALL-LIST.md` partly stale |
| `vermont-fall-2026` | `vermont-fall-2026`: capture, suitability, relevance | built, PLAN.md | `vermont-fall-2026` | past | 1-4 Oct 2026, Whitby to Hyde Park VT | none (trip done) |
| none | `quebec-2026`: no data | built (page only, no PLAN.md) | `quebec-2026` | past | 29 Sep-1 Oct 2026, Whitby to Ile d'Orleans, prologue to Vermont | none (trip done) |
| none | `new-hampshire-stopover-2026`: no data | built (page only) | `new-hampshire-stopover-2026` | past | 30 Sep-1 Oct 2026, Franconia Notch and the Kancamagus, the day before Vermont | none (trip done) |

"Trip id and data" lists which of `data/capture/<id>/`, `data/suitability/<id>/`, `data/relevance/<id>/` and
`data/schedules/<id>.json` exist. The summaries below were moved verbatim from `CLAUDE.md` on 21 Oct 2026 (cleanup D17).
Lines that no longer matched the folders were corrected the same day; each correction is marked "(corrected 21 Oct)".
"Published" and "not published" below describe the old live site when each summary was written; they were not re-checked
against the live site.

## Current trips
- `legacy/algonquin-muskoka-oct-2026/` — **Sat 10 – Mon 12 Oct 2026 (Canadian Thanksgiving), 2 nights at Port
  Cunnington Lodge, Dwight (Lake of Bays), from Whitby. Built, NOT published.** Theme `autumn`, build with
  `python3 build_page.py`; PLAN.md + 5 research files (4, plus `suitability.md`; corrected 21 Oct). Shape: Sat Huntsville lunch → Solitaire Lake Trail
  (Echo Rock is back-lit until ~13:30, so afternoon) + Dwight Beach sunset; Sun Track and Tower at 08:00
  (**no tower exists**, the payoff is a Cache Lake ledge, front-lit until ~10:30) → Ragged Falls; Mon Dorset
  tower → Huntsville → leave by 13:30 or after 19:30. **Sunday hangs on the $21 Algonquin day permit, sold
  online only 5 days ahead (Sun 11 = Tue 6 Oct, release time inferred); Plan B is in the page toggle.**
  2026 is an early colour year: Algonquin peaked ~27 Sep, Lake of Bays lagged. The address
  "1212 S Limberlost Rd #1150" matches no source; navigate to the reserve by name. Open: Dorset slot
  availability, Ragged Falls fee, all Thanksgiving traffic timing. No Phase 2 conditions routine scheduled yet.
- `legacy/vermont-fall-2026/` — Oct 1–4, 2026, Whitby → Hyde Park VT. Sept 29 cloud routine emails a foliage/weather verdict (trig_01XZPgWV5iHm54Pwcvme6XzG).
- `legacy/quebec-sept-2026/` — Sep 29 – Oct 1, 2026. Prologue leg to Vermont: Whitby → Île d'Orléans
  (2 nights) → Derby Line → Hyde Park. Discussion-stage; Vermont pages NOT changed for it.
- `legacy/iceland-ring-road/` — **4–15 Sep 2027, 11 nights, ~2,190 km. First camper-van trip.**
  Built through `legacy/_system/` (theme `alpine-snow`), 4 research files (3, plus `suitability.md`; corrected 21 Oct) + PLAN.md + `sun-times.py`
  and `dark-times.py`. KEF in/out, counter-clockwise Ring Road + Snæfellsnes, 10 campsites,
  no hotels. **Dates were set by arithmetic, not taste: Iceland reaches NO astronomical darkness
  before ~3 Sep** (mid-July doesn't even end civil twilight), so an aurora on a summer van trip is
  impossible — but 50 campsites shut during September and **the Camping Card expires 15 Sep**.
  Those two curves cross at 8–15 Sep. Window B (11–22 Sep) is behind the A/B toggle.
  **Van constraints that shaped it:** campsite-only sleeping is law, so days are ordered around
  campsites not trailheads (reverse of every other plan here); **2WD campers are barred from
  F-roads and no Icelandic insurer sells river-crossing cover at any price**, so the highlands are
  out; puffins are gone by September. Biggest unverified risk = **no campsite confirmed open for
  Sept 2027**; all prices are 2026.
- `legacy/dolomites-july-2027/` — Jul 13–26, 2027, YYZ→Venice, rental car, 4 bases. Dates moved
  back from 26 Jun so the high routes and all lifts are open; hut-to-hut considered and
  declined. `research/trips/dolomites-july-2027/archive/PLAN-superseded-june.md` keeps the June reasoning.

- `legacy/chamonix-mont-blanc-sept-2028/` — **Fri 1 – Sat 9 Sep 2028, 8 nights (recommended from a 1–14 Sep window), from Toronto.**
  7 research files (6, plus `suitability.md`; corrected 21 Oct) + PLAN.md + page built through `legacy/_system/` (theme `alpine-snow`). Shape: Les Praz 3, optional
  Refuge du Lac Blanc hut night 1, Argentiere 4; valley day hikes, **no full Tour du Mont Blanc** (7-11 days,
  huts close ~20 Sep, bookings open ~15 Oct the year before). Every lift-dependent day is before 9 Sep because
  the 2026 pattern closes Brevent/Planpraz/Bellevue ~13 Sep and a 2028 closing Sunday could be 10 Sep.
  **Everything is 2026 data used as a pattern; no 2028 timetable exists.** Biggest risks: the Mont Blanc tunnel
  autumn closure (2025 ran 1 Sep – 12 Dec; ATMB says 2027-28 repeat it, so Courmayeur may be unreachable),
  no Toronto-Geneva nonstop (Toronto-Zurich is), UTMB 2028 dates unknown. Guest card = free trains Servoz-Vallorcine
  only, buses discounted not free. "Lac de Peclerey" does not exist (Montagne de Peclerey). Not published.

- `legacy/canadian-rockies-sept-2029/` — **PUBLISHED. Sat 8 – Sat 22 Sep 2029, 14 nights, Calgary in/out, adults + a child ~6.**
  Built through `legacy/_system/` (theme `alpine-snow`) from `data/*.json` (48 sights, 62 trails, 33 bookings, 43 adventures,
  `itinerary.json`); `merge_data.py` merges lane files, `plan_tables.py` fills PLAN.md tables, `build_page.py` builds the page
  and injects the gallery after the trail list (`after="trails"`). Every day has Track A (adult-only hike), B (family) and
  C (less walking); 7 split days. Bases: Banff 2, Lake Louise 1, Jasper 4, Lake Louise 4, Kananaskis Village 3. **Waterton
  is not in the 14-night plan (it is in the 16-night option).** Window 8-22 Sep chosen over 1-15 Sep for Labour Day (Mon 3 Sep)
  and larch timing (peak ~20 Sep - 5 Oct); costs ~1 more school day. All 2026 data used as a pattern. `check_links.py` result:
  465 URLs, 9 broken (1 on the page: Jasper SkyTram hours, a 520). Child limits: no minimum height found for 42 of 43 adventures.

- `legacy/patagonia-feb-mar-2027/` — **Fri 26 Feb – Thu 11 Mar 2027, 13 nights, Toronto, adults plus children 11+. Built, NOT published.**
  Seed was a video (BA, Calafate, Chalten, Ushuaia); route **reversed**: BA 1, Ushuaia 4, El Chalten 4, El Calafate 2, BA 2
  (penguins a week earlier, walking ramps up, last domestic leg from Calafate). PLAN.md (Opus) + 8 research files (7, plus `suitability.md`; corrected 21 Oct) + `research/trips/patagonia-feb-mar-2027/sun.md`
  (the logistics sun table is wrong, use this one); page via `build_page.py` (theme `alpine-snow`, `photos.py` for hero/cards),
  gallery 42 photos after the trail list. Torres del Paine: NO (day tour swap costs the Chalten spare day). Big Ice 18+, rafting 16+ cut;
  minitrekking 8-65 fits. Urgent: international flight and Chalten lodging by 31 Oct, domestic flights and car 15 Nov, Piratour and
  minitrekking 30 Nov. Biggest GAPs: Air Canada YYZ-EZE 2027 days, Piratour minimum age, hotel prices, AllTrails links unfetched.
  Open: citizenship, children's heights, car vs buses, 03:00 Fitz Roy appetite. No conditions routine yet (~22 Feb 2027).

## Queued
- `legacy/usa-southwest-rockies/` — **PUBLISHED (nks-travel.pages.dev/usa-southwest-rockies/). Cut on 2026-09-24
  from 15 days Utah+Arizona to 11 days / 10 nights, five Utah parks only.** Springdale 3, Bryce 1,
  Torrey 2, Moab 3, SLC 1; Bryce→Torrey via UT-12 with optional Lower Calf Creek Falls. Dropped
  Page, Antelope, Horseshoe Bend, Monument Valley and the Hanksville badlands (4 nights); every leg
  is paved so AWD is no longer needed. Moab could be 2 nights (10 days) on official figures.
  Night split is inference: no official source gives days per park (`research/trips/usa-southwest-rockies/days-*.md`; corrected 21 Oct).
  The 15-day plan, old page and builder are in `research/trips/usa-southwest-rockies/archive/`.
  `research/trips/usa-southwest-rockies/notes/CALL-LIST.md` is from the 15-day plan and partly stale. Theme `desert`, build with
  `python3 build_page.py`. **Dates open**; the one hard line is 1 October (Narrows dry-suit cold).
- `legacy/norway-summer/` — **summer 2028, exact dates open.** 14 nights. Research (5 files) + PLAN.md
  + a built `index.html`. Shape: **Arctic first** — Lofoten 3, Andenes 1, Senja 2 — then Fjord
  Norway north to south (Ålesund, Åndalsnes 2, Geiranger 1, Loen 2, Aurland 1, Bergen 1).
  Open-jaw EVE in / BGO out, two cars, one internal flight TOS→AES.
  **10 bases, ~1,740 km driven** (legs summed in PLAN.md; estimates, not routed — GAP).
  **Recommended window ~24 Jun – 8 Jul 2028**: 2028 *fellesferie* is 10–30 July (ISO weeks
  28–30), a week later than 2026, so late June is pre-crowd *and* inside the midnight sun.
  Window B (~29 Jul – 12 Aug, itinerary reversed) is in the page behind the A/B toggle.
  Trollstigen is treated as a bonus, never a dependency. **Not published yet.**
  First page built through `legacy/_system/` (theme `coastal`) rather than by hand.
  **Hiking ceiling is 12 km round trip** — this cut the Ryten→Kvalvika beach descent (12–13 km)
  and the Vidden traverse in Bergen (13–15 km, substitute = Ulriken cable car up and back).
  Romsdalseggen (10–11 km, 970 m up / **1,277 m down**) is the biggest day and fits.
  Via Ferrata Loen: **age 12+, 40–120 kg** — harness limits, not policy, so not negotiable.
  Only open question left is **group size**.
- `legacy/switzerland-2027/` — Tue 27 Jul – Tue 10 Aug 2027, 14 nights, rail: Lucerne 4, Wengen 5, Zermatt 5 (dates and bases added 21 Oct from its PLAN.md). PLAN.md + 5 research files and a published page.
- `research/trips/peru/` (corrected 21 Oct: there is no `legacy/peru/` folder; the manifest dropped it) — **research only, no dates, no page yet.** 4 research files + `research/trips/peru/notes/DAYS.md`.
  Triggered by a traveller's Instagram post recommending the Cordillera Huayhuash near Huaraz.
  Verdict: **no honest "see Peru" trip under ~3 weeks**; Huayhuash + Machu Picchu together is
  **24–26 days** door-to-door. Two costed shapes in `DAYS.md` (same notes folder) — **A: 17 days** (Santa Cruz 4-day
  trek + full Cusco block) and **B: 24–26 days** (full 135 km Huayhuash circuit + Cusco).
  Key sequencing finding: **do Huaraz BEFORE Cusco** — you arrive in Cusco already acclimatised
  and the Cusco block drops from 6 nights to 4.
  Hard constraints: Machu Picchu is 4,500 tickets/day (5,600 on peak dates incl. **19 Jun – 2 Nov**),
  one fixed circuit + one fixed entry hour, book 60+ days out; **from 2026 an Inca Trail permit no
  longer includes MP entry**; never sleep night one in Cusco (Sacred Valley is 500–600 m lower);
  leave a buffer day after MP — rail blockades shut the corridor twice in late 2025.
  Best month = **September**. The post's "October = fewer crowds" is wrong for MP specifically.
