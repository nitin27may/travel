# REVIEW4: whole-site design review after stage 4

Reviewer: travel-design-reviewer (Opus), 20 Oct 2026, at `09dbe3f` (all five stage 4 lanes merged). `pnpm build` with no `.env.local` (so no Google map family), `web/out` on :4481, GPU Chromium (ANGLE/GL, Arc) at 2x; 1440, 1024, 390 x 844 and 844 x 390; dark set with the site toggle. Screens: `/tmp/review4/`, tall pages in tiles (`*.tN.png`). The machine was under e2e load. The 10,000-place fixture was not built; check 5.1 owns it.

**Verdict: NOT YET.** The trip page is the strongest thing on the site and the honesty work holds everywhere. But the owner's first-use tasks dead-end in smart search, every place map fills two thirds of its frame, the trip route map draws false lines with duplicate numbers, and three pages state false things. All are small, contained fixes.

## Summary

| Page type | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8/P9 | T1 | T2 | T3 | T4 | T5 | Must | Soon |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | pass | pass | pass | partial | pass | pass | pass | pass | n/a | partial | pass | n/a | pass | 0 | 2 |
| Trips list | pass | pass | pass | partial | pass | pass | pass | pass | pass | pass | pass | **fail** | pass | 1 | 1 |
| Trip page | pass | pass | pass | pass | pass | pass | pass | pass | pass | partial | pass | partial | **fail** | 2 | 4 |
| Places list | pass | pass | pass | partial | pass | pass | pass | pass | pass | pass | pass | pass | n/a | 0 | 3 |
| Place pages | pass | pass | pass | partial | pass | partial | pass | pass | pass | partial | partial | pass | **fail** | 3 | 5 |
| Globe | pass | pass | partial | pass | pass | pass | **fail** | pass | n/a | pass | pass | n/a | pass | 1 | 2 |
| Smart search | pass | pass | pass | **fail** | pass | pass | **fail** | pass | pass | pass | pass | partial | n/a | 2 | 2 |
| Site pages and 404 | n/a | pass | pass | pass | n/a | n/a | pass | pass | n/a | pass | pass | n/a | n/a | 0 | 0 |
| Phone navigation | n/a | pass | pass | pass | pass | n/a | pass | n/a | n/a | pass | n/a | n/a | n/a | 0 | 1 |

Site-wide: **no green** in the UI chrome, light or dark (only in photos and terrain). **Overlays are non-modal**: no `aria-modal` on search, add-a-place, the map sheet or menus. **Back** on a phone restores `?k=water` and scroll (y 2589). **No household data** in `web/out` (no Whitby, no first-person travel text; "by Nitin" is authorship). **Trips are dateless.**

## Must-fix before the owner's review

| # | Page | What is wrong | Evidence | Fix | Owner |
|---|---|---|---|---|---|
| 4.20 | Smart search, first-use task 1 | "easy hike with kids near Banff" gives **0 of 75 trails**. The parse sets `area=banff`, but Lake Louise and others sit in a separate "Banff National Park" area. It also sets `kid=yes` and Stroll+Easy together. The header search also offers "Did you mean Banff National Park" for a word it already matched. | `srch-p0.png`, `srch-h0.png`, `gl-search-picked.png` | Resolve a named place to the union of areas with that name (Banff, Banff National Park), or to the region with a radius. Never ship a reading that returns 0: relax the narrowest geography first, then the effort, and say so in the undo line. Add the query to the smart-search e2e test with a "> 0" assertion. | LST, plus a CS7d data fix for the area split |
| 4.21 | Smart search, first-use task 2 | "lake for a 6 year old in the Dolomites" gives **0 of 10**. `area=dolomites` and `region=south-tyrol` exclude Braies, Sorapis (Veneto) and Misurina. The same zero happens for "stroller friendly lake" (the leftover `q=friendly`) and for "rockies 10 days september" on Places (`q=rockies`). | P1, P4 and P6 in the search log | Treat range names (Dolomites, Rockies) as a bounding area across regions, not as one admin area. Drop leftover adjectives ("friendly") from `q`. On Places, send a trip-shaped query ("10 days") to Trips with a one-line link. | LST |
| 4.22 | Every place page, all widths | The map canvas is 478 x 318 inside a frame of about 665 x 440. The right third and the bottom are an empty grey well, and the scale bar floats in the gap. | `pp-sorapis-map-vp.png`, `pp-moraine-1440.t0.png`, `pp-gondola-390.t0.png` | Call `map.resize()` from a `ResizeObserver` on the frame, and run it once after fonts and the rail have settled. Add an e2e assertion that the canvas width matches the frame width within 2 px. | PLC (`lib/map/**`) |
| 4.23 | Trip page route map, Rockies Day 5 and Dolomites Day 4 | The day route is a **straight amber line over the mountains**, although the real road (Maligne Lake Road) is drawn beside it. Two pins are both numbered **"2"**, but the label says "2 stops". The map therefore disagrees with the timeline. | `rk-1440-fam3-d5-d5.png`, `rk-390-mapsheet-sheet.png`, `dol-1440-d4-dark.png` | T5: draw a straight leg only as a thin dashed "as the crow flies" line, never in `--map-route-pick`. Use the solid amber only for ORS or plan geometry. Number pins from the same list as the timeline entries; a stop repeated in a day keeps its first number. Add a test that the map numbers equal the numbered timeline entries. | TRP |
| 4.24 | Rockies: trips card, hero and filter | The card says "Kids from 5 · our plan" and the hero chip says "Ages 5+". The hero text says "suits children from about 6", and the plan bar says "Family, 6". The day stops go up to "From about 10". With `?kid=6` the Rockies passes cleanly. A family reads 5 as a yes. | `trips-1440-light.t0.png`, `rk-390-top.png` | Show one number on all three surfaces: the family version's computed floor (6), never the typed 5. This is the L3b M1 rule applied to the hero chip too. | LST (card), TRP (hero) |
| 4.25 | Trip page, phone first view | The hero title is clipped at the top of the card ("ROCKIES, 14" cut through), so the trip name is unreadable at 390 x 844. | `rk-390-top.png` | Let the hero grow to fit the title. If space is short, clamp the title to three lines at `--t-display-s`. Never use negative offsets above the card. | TRP |
| 4.26 | Globe, place deep link at 1440 | `/globe/place/lake-louise/` lands at pitch 55 with **no pin and no card on screen**, although the DOM holds "Close details". The phone docked card works. This is the target of every place page's "Globe" button, so it is a dead end. | `gl-place-1440-long.png`, compare `gl-place-390.png` | Fit the place with the panel width as right padding and a pitch of 40 or less, then open the anchored card. If the anchor is off-screen, fall back to the docked card. Add an e2e test that the card is visible after load at 1440 and 1024. | GLB |
| 4.27 | Place page: Dolomites | The page reads "Viewpoint · Belluno · Trentino-Alto Adige", "Viewpoint in Belluno, Italy" and "Access: Lift 6 Jun to 18 Oct". Belluno is in Veneto, a mountain range is not a viewpoint, and a range has no lift season. | `pp-dolomites-1440.t0.png` | Make the Dolomites an `area` or range record with no access tile, and correct its admin path. Audit the other area-kind records for borrowed lift seasons. | PLC (kind), CS7d (data) |
| 4.28 | Place page: Banff Gondola | "When you can go" ends with "cancelled for not stated". It reads as broken. | `pp-gondola-390.t1.png` | Drop any clause whose value is a not-stated marker. The gap already shows in the "not checked yet" line. | PLC |

## Fix soon

**Home**
- Phone: "Tap a pin to open its country" sits over a globe with no pins for 3+ s (`home-390-light-full.t0.png`; pins by 9 s, `home-390-wait.png`). Show the line once pins draw.
- Cover clusters (246, 26, 79) differ from the globe page (182, 64, 15, 64). Use one cluster radius.

**Trips list and trip page**
- On a phone, the "Map · All days" pill sits over the "Plan it for" card and the season heading (`rk-390-top.png`). Fix: hide the pill until Day 1 reaches the focus line.
- Patagonia: the cover is Recoleta cemetery (Buenos Aires); Day 2 map says "0 stops" with Harbour walk in the day; "Exposure: level None" is raw (`pat-1440-top.t0.png`, `pat-1440-d2.png`). Use a Patagonia cover, "1 stop not on the map", drop "None".
- Overview (Switzerland): the text says "Copy it to plan your own dates" with no Copy button; "Season not set yet" twice; five grey photo tiles, possibly lazy loading (`swi-1440.t0/t1.png`). Match the text to the buttons.
- Dolomites Day 4: "Age 3+ · weight not stated · height not stated +4". Show stated limits only.

**Places list**
- At 1440, every active filter shows twice, once as the filled pill with × and once as a chip with × below it (`pl-1440-water-kid6.t0.png`, `srch-p0.png`). Fix: on desktop, the pill is the chip; keep the chip row for the phone summary only.
- From a parse, the Kids pill reads "Youngest child · Easy with kids", but the pill is an age control. Fix: map the ask "with kids" to the ask chip, as the LST note rules, and keep the pill for ages.
- 15 sort options. Fix: 6 or fewer; the rest via table columns.

**Place pages**
- Sorapis: the glance tile says "Starts at: Not checked yet", while the Directions card says "The trail starts at Passo Tre Croci, start of path 215". Fix: feed the tile from the same value.
- Akureyri: the glance says "Operating season: Not checked yet", while "When you can go" shows "Open 1 Jun – 30 Sep". This is S1b M7 again. The pointer glyph still sits on its own line (S1b M3).
- Lake Louise card: "No source yet · Partly checked · 25 of 25" contradicts itself. "25 of 25" reads as complete (`pl-1440-light.t0.png`). Fix: name the count "25 basics" or show the level only.
- Ötzi: "Opening hours 10:00–18:00, 10:00–18:00" is printed twice.
- Gondola: the cover line starts with an orphan "·" ("· photo and judgement from the place it reaches").

**Globe**
- Lake Louise sits in the district "Banff National Park" (1 place), and its neighbours sit in "Banff" (45 places). Same cause as 4.20.
- The search placeholder is "Search a country, state, city, sea or range" at 1440 and "Search the globe" at 844. Pick one.
- Immersive mode: I found no "Hide controls" button on `/globe/it/` in this build. Confirm where it went, or whether it is now inside Map options.

## First-use walk (P4)

Starting from a cold home page at 1440:

1. **"An easy hike with kids near Banff."** Typed into the cover search, the chips read well. "Did you mean Banff National Park" made me hesitate, since I had said Banff. "Show places" gave **0 of 75 trails**. The empty state is honest, but a newcomer reads it as "this site has nothing". **Dead end** (4.20).
2. **"A place for a 6-year-old in the Dolomites."** It gave **0 of 10**. Places → Kind → Water → Youngest child → 6 works, but took five clicks and a guess that a lake is "Water" (4.21).
3. **"Get to a Rockies day-by-day plan."** Home → Trips card → trip page → day 5 took three clicks, with no hesitation. The day header answers time, driving, walking and warnings at a glance.

## Five things a first-time visitor would find most confusing

1. A sentence search that turns into neat chips and then shows zero results (4.20, 4.21).
2. Five ways to say the same age: "Ages 5+", "Kids from 5", "From about 10", "Fits age 6", and "Youngest child · Easy with kids", while the hero says "from about 6" (4.24).
3. Maps: on place pages a third of the frame is blank, and on trip days lines cross mountains with two pins numbered 2 (4.22, 4.23).
4. "Partly checked · 25 of 25" and "Early research · 20 of 32": numbers whose meaning is not obvious, and which sometimes contradict the label.
5. Each active filter shows twice at 1440, both removable, so it is unclear which one is "the" filter.

## Where the lanes' work clashes

| Clash | Where | Ruling |
|---|---|---|
| The primary action has two names | Trip: "Copy to my trips". Place: "Save to a trip". Overview: neither, though its text says copy | Keep both verbs, since they are different acts, but the overview text must match its buttons |
| Two Directions controls on one place page | Cover "Directions" and rail "Google Maps directions / Apple Maps" | Accept, because the cover is the phone-first action. Make the cover button open the same chooser |
| One age concept, five labels | Cards (LST), hero (TRP), day chips (TRP), parse (LST) | Use "Youngest child" for the control, "From about N" for fit, and "Any age" for no limit. Drop "Ages N+" and "Kids from N" |
| Pill and chip duplicates | FilterBar (LST) at 1440 | See Places, above |
| Area names | Globe districts (GLB), smart search areas (LST), place breadcrumbs (PLC) disagree on Banff and the Dolomites | One area table; CS7d fixes the data |
| Search placeholders | Home "Search trips, places and countries", lists "Search places" / "Search trips", globe two variants | Keep scoped placeholders on the lists. Give the globe one placeholder |

## What is strongest (protect it in FIX4)

- **The trip timeline.** The profile is chosen once and carried in the bar. The day head counts fit honestly ("Not suited to age 3 (1 stop) · 1 not checked"). Over-long days name what to drop. The split lanes and the strip with hour ticks work.
- **Add a place.** Inline, non-modal, with a consequence line per candidate ("adds about 20 min of driving, day ends about 20:30").
- **Honesty on place pages.** Dashed "Not checked yet" markers, provenance one step away, "Sources disagree" with both values, and no driving button for shuttle-only Moraine Lake.
- **The globe.** Breadcrumb drill-down, counts by continent, the docked phone card, and search that flies and opens its card.
- **The list mechanics.** Kind counts, the age stepper, the two-line count line, the collapsed phone summary, and Back restoring scroll and filters.
- The navy and amber palette holds in both themes with no green.

## Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version (REVIEW4): rows 4.20-4.28 proposed as must-fix; the fix-soon list by page type. |
