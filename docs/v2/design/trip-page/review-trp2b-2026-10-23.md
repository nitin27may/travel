# Design review: TRP2b, routed legs, the OpenStreetMap credit and Export trip (23 Oct 2026)

Reviewer: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Review only: no app code changed, nothing built, served or run (the coordinator's full e2e was running on this machine).

**Verdict: ship after fixes.** The plumbing is right. The legs come through one client call when the map mounts, the files are small (9.0 KB Rockies, 19 KB Dolomites), the refused-near-home count is 0, a routed leg is solid amber over its casing and an estimate stays dashed ink, and the files credit OpenStreetMap under ODbL and OpenRouteService. But four things on the map are not yet true to the trip, and the print view does not print what the page shows:
- the amber lines stop at the car park, 0.5 to 4.2 km short of their pins
- six walking legs are labelled "Road route"
- the All days key shows an amber swatch for an ink line
- on a phone, the collapsed key explains the dashed line and not the amber one

None of this was seen on screen, because the screenshot set no longer exists (section 0), so a full re-shoot is itself a must. Counts: **8 must, 10 should, 8 later.**

## 0. What this is based on

- **Screenshots: none.** `/Users/nks/workspace/travel-wt/v2-TRP2b/web/test-results/` held only `.last-run.json` and `revision-timing.txt` when I looked. Playwright empties its output folder at the start of every run, so the e2e run going on now deleted `shots/TRP2b/`. No copy exists anywhere under `/Users/nks/workspace`. Every visual judgement below is therefore made from code, data and computed contrast, and is marked **open (no shot)** where only a render can settle it. MUST-8 closes that.
- **Code**: `git show f563e26 03dd046 5402aec` on `main` (merge 6d319c4), plus the TRP2a files they touch (`routeSpec.ts`, `GoogleTripMap.tsx` `legParts`, `trips.css` key swatches, `ui.css`, `print.css`).
- **Data**: `data/schedules/legs/*.json` and `canadian-rockies-2029.unrouted.json`. I decoded every Dolomites polyline and measured its two ends against the place points in `web/data-snapshots/prototype.json` (the points the pins are drawn from).
- **Authority**: [google-map-note.md](google-map-note.md) 5, 8 and 17 (the TRP2b addendum), [review-trp2a-2026-10-23.md](review-trp2a-2026-10-23.md), [TRP2.md](../../build/public-site/briefs/TRP2.md) steps 7 to 10 and the acceptance checks, [principles.md](../foundation/principles.md) P1 to P9 and T1 to T5, the no-green rule, and [review-API3-2026-10-23.md](../../build/public-site/review-API3-2026-10-23.md) R-5, R-9 and R-13.

## 1. The TRP2b addendum and acceptance checks, ticked

Status key: **pass** (proven in code or data); **pass (tests)** (an e2e or unit test only); **partial**; **fail**; **open (no shot)**.

| Item | Status | Evidence |
|---|---|---|
| Checklist 19 on real legs: a leg with geometry is solid `--map-route-pick` 3.5 px over a 5.5 px casing | pass (tests); open (no shot) | `GoogleTripMap.tsx` `legParts` line 116; e2e `trip-routes.spec.ts:61-77` asserts weights 3.5 and 5.5 in different colours |
| Checklist 19: no estimate is amber at rest or solid | pass | `routeSpec.ts` `dayLegs` line 37: style `straight-estimate` unless the leg id has geometry |
| Checklist 19: the key shows "Road route" only when one is drawn | pass, with two defects | `keyOf` line 130. But the swatch is amber in All days, where the line is ink (MUST-3), and the label is wrong for walking legs (MUST-2) |
| Note 5.2: the mixed sentence | pass (wording), change | `KEY_SOME_ROUTE` matches the note exactly. MUST-1 and MUST-2 change the wording, because the note's sentence does not cover the car park ends or the walks |
| Note 8: the chip shows only while a routed leg is drawn | pass (tests) | `TripRouteMap.tsx:392` tests `base.lines` for a `route` or `route-pick` style; e2e lines 83, 102, 116 |
| Note 8: chip wording | **fail** against the note | It reads "Route geometry ©", but the note says "Route lines ©". Ruled in section 4 (SHOULD-1) |
| Note 8: link, style, inset | pass | Links to `https://www.openstreetmap.org/copyright`; mono 11.5 px `--muted` on `--surface` at 88%, radius 6, padding 2 px 6 px, at `--s-2` (8 px) top and left (`map.css`). Contrast is in section 3 |
| Note 8: chip at 390 | partial; open (no shot) | Computed: the text is 43 characters of IBM Plex Mono at 11.5 px (0.6 em advance), about 297 px plus 12 px padding. The chip is capped at the map width minus 76 px, about 282 to 298 px in the sheet, so it wraps to two lines (about 36 px tall). The controls stay clear (they need 52 px on a coarse pointer). See SHOULD-1 |
| Note 17: Export trip at the page top, secondary, beside the primary | pass | `TripActions.tsx`: "Export trip" (38 px `.btn`) after the primary. The primary reads "Copy to my trips", not the note's "Copy with my dates". That is L5's label, not this lane's |
| Note 17: "Export" in the plan bar from 1024 px, 36 px secondary | partial | `PlanBar.tsx` plus `timeline.css:66-67` (`display: none` below 1024 px). But `.btn-sm` is **30 px**, not 36 px (`ui.css:23`). Its 44 px `::after` hit area is fine. See SHOULD-7 |
| Note 17: phone shows it at the page top only | pass | The same media rule |
| Brief 7: generalised script, `trip-legs/2`, fields, polyline5, 30 m simplification, attribution, sequential at 28 a minute, missing pairs only, `--check` without network, key never printed, sizes | pass | `legs-ors.mjs` (the `--check` and `--list` path line 67; the key is read from `ORS_API_KEY` at line 95 and never logged). Data: `simplifiedM: 30`, Rockies 27 of 27 legs with geometry in 9.0 KB, Dolomites 40 of 40 in 19 KB, both far under the 200 KB target |
| Brief 8: legs read through `tripLegs(slug)` on mount, never with `getTrip` | pass (tests) | `TripRouteMap.tsx:377-383`; e2e line 70 counts exactly one legs request and no other |
| Brief 9: print from the `json` model; calendar; CSV, KML and GPX | partial | Print is built from the model (`TripPrintView.tsx`), but it is not what the page shows (MUST-5) and it has no booking windows (MUST-6). KML and GPX carry the routed lines (`routes.ts`) but ignore the chosen profile (SHOULD-6) |
| Brief 9: no household data | pass | `TripExport` holds no traveller field; the builder reports the privacy scan over each export |
| Brief 9: "the export menu code loads on open" | partial | The chunk loads after first paint (`next/dynamic`), not on open, and the model is fetched on mount so the labels can show counts. This predates TRP2b. LATER-6 |
| Brief 10: tests | pass (tests) | `trip-routes.spec.ts`, `export/trip-routes.test.ts`, `legs-files.test.ts`, `leg-geometry.test.ts`, `polyline.test.ts` |
| Acceptance 5: start JS not larger | builder-reported, +0.07 KB | Ruled in section 4 |
| Acceptance 6: legs, `--check` green, solid and dashed, credit visible | pass (code and tests); open (no shot) | As above |
| Acceptance 7: each export opens, gaps "Not checked yet", no household data | partial | The gap wording is applied to plan times, where it is wrong (MUST-5) |
| Acceptance 8: no new literal | **fail** (one host) | `TripRouteMap.tsx:394` hard-codes `https://www.openstreetmap.org/copyright`; `core/src/export/licence.ts` already holds it inside `OSM_ATTRIBUTION`. SHOULD-8 |
| Acceptance 9: screenshots of Rockies 8 and 9, Dolomites 3, key, export menu, print view | **fail** | The set is gone (section 0). MUST-8 |
| Acceptance 10: owned paths only | partial | The brief lists neither `web/lib/client/{api,contract,data,static,stub}.ts` nor `web/scripts/legs/*`. The client method was needed for step 8 ("API-3's `tripLegs(slug)` client method"), and it sits behind the one data boundary (P9). Accepted in section 4; the coordinator should record it |

## 2. Judgement by area

### 2.1 A routed leg beside a dashed one on the same day (T5, P3)

**The order is right in principle, and wrong in one case.** In light, the routed leg is the strongest line: 3.5 px of continuous amber with a 1 px ink edge each side (amber to casing 6.38:1, casing to the basemap 12.89:1 on forest and 14.73:1 on plain land). It sits above a 2.5 px dashed ink estimate that leaves 43% gaps. The fact we hold therefore outranks the guess, and both stay under the pins (`zIndex` 1 and 2 against 10 to 30).

**Dark may invert the order** (open, no shot):
- The estimate is `--map-route` `#E7ECF1`. That is 8.24:1 on Google's dark forest and 12.50:1 on dark land.
- The routed amber is 3.89:1 on dark forest, 5.91:1 on dark land and 2.85:1 on high ground.
- The dark casing `#0B1119` almost disappears on the dark basemap (1.27:1 on land, 1.93:1 on forest), so in dark the casing does not frame the amber. It only separates it from a crossing white dash.

A near-white dash can read before a mid-luminance amber line, and a family would then look at the guess first. Continuity and hue may still win. Only the dark shot of Dolomites day 4 can settle it (SHOULD-2 has the fix, ready if needed).

**The real hierarchy defect is that routed lines do not reach their pins** (MUST-1). `pairs.ts` routes each leg to the stop's trailhead or car park (`routingPoint`), which is right for the drive. But `routeSpec` draws the decoded line as it is, so the amber ends where the road ends. Measured on the Dolomites file, 27 of 40 legs end more than 300 m from a pin. Examples:

| Leg | Gap |
|---|---|
| San Candido to Croda del Becco (Seekofel) | 3.98 km |
| Croda del Becco to Funbob (the same day, day 4) | 3.98 km |
| Sorapis to Cortina | 4.22 km |
| Antorno to Monte Piana | 2.87 km |
| Ortisei to Seceda | 2.76 km |
| Ortisei to Viel dal Pan | 2.09 km |

At a day fit of zoom 11 to 12, 4 km is about 75 to 150 px. On Dolomites day 4, pin 2 therefore sits alone on the mountain, with two amber lines stopping at the Braies car park. A family reads that as a broken map, or as "the road goes to the summit". Either reading is wrong.

### 2.2 Honest legend with some legs routed and some not (T5, P4, P6)

**What is honest today:**
- the key appears only for what is drawn
- the all-dashed sentence returns when no routed leg is in view
- the mixed sentence names OpenStreetMap
- a failed legs request leaves the estimates and raises no error (e2e line 109)

**Four gaps:**
1. **Walking legs are called roads** (MUST-2). Six Dolomites legs are `foot-hiking` and are drawn and keyed as "Road route". Two of them are on day 4, the day the owner looks at: San Candido to the Drava path (1.0 km) and Funbob to San Candido (1.6 km). Others are Siusi to Puflatsch, Antorno to Monte Piana, Cinque Torri to Limides and Ötzi to Bolzano. The timeline calls them walks, so the map and the list disagree.
2. **The All days swatch is amber** (MUST-3). In All days the routed style is `route`, which is ink 2 px solid with a halo (`legParts` line 117). But `keyOf` always pushes style `route-pick`, and `.key-swatch[data-key='road']` is amber with a casing (`trips.css:104`). This is the same class of defect as TRP2a MUST-4.
3. **On a phone the amber line goes unexplained** (MUST-4). The collapsed key shows the first item that is `estimate` or `road`, and `estimate` always comes first. On a mixed day the phone reads "Straight line, not a route", while the loudest line on screen is amber.
4. **Why a leg is dashed.** The ledger has the reasons ("no road or path within reach of a stop" for 5 Rockies pairs on days 5 and 6; "the route is over 5 times the straight line" for day 14). The UI does not say why. The key's "no route is stored for that leg" reads as our omission, when for 5 of the 6 there is no road at all: it is a trail, a lake or a lift. The key cannot carry six reasons. Changing the shared sentence (MUST-2) covers the common case, and the per-leg reason belongs where the leg is described: the timeline's travel row and the leg's tooltip (LATER-1, P6). The reason must be served through `tripLegs`, not read from a second file (P9).

**There is also a flash on load** (SHOULD-3). The lines are drawn dashed first. When the legs arrive (one request after mount), they redraw amber, and the sentence changes from "Road routes are not drawn yet..." to the mixed one. The visitor sees the map change its claim on every page view (P5).

### 2.3 The credit chip at 390 and 1440

- **Placement is right.** Top left at 8 px, our controls top right, Google's logo and terms at the bottom untouched. The fit paddings already reserve the top (56 px wide, 40 px narrow).
- **At 1440** the chip fits on one line in the map column (open, no shot).
- **At 390** it wraps to two lines (computed in section 1). At about 44 px from the map top, that is deeper than the narrow top padding of 40, so a pin fitted to the top edge can sit under it.
- **The fix is the short form**, which the OpenStreetMap attribution guideline allows on small maps: "© OpenStreetMap" linked to the copyright page (SHOULD-1).
- **The OpenRouteService credit is only in the chip's `title`.** A tooltip never shows on touch and is not reliably read by screen readers, and `/about/data/` does not mention OpenRouteService at all. The files credit it correctly. The site does not (MUST-7).

### 2.4 Export trip: entry points and menu copy (P3, P4, P7, P8)

**Placement follows the note.** The secondary button at the top reads "Export trip". The plan bar has a smaller "Export" from 1024 px. The phone has the top button only. Both menus use the same component, and the export model is cached once per page.

**The copy needs plain words** (SHOULD-7):
- **"GPX: 61 points" and "KML: 61 points" lead with a file format.** A family does not know which one opens in their phone app. Say what each is for, and say that the routes are inside: "GPX for a GPS or hiking app · 61 points, 27 routes", "KML for Google Earth or My Maps · 61 points, 27 routes", "Spreadsheet (CSV) · 120 stops". The route count already exists in `fileSummary`, but today it only appears in the toast after the download.
- **"Print or save as PDF" uses the download icon.** Use the print icon.
- **The plan bar's trigger is named only "Export".** Pass `triggerLabel="Export trip"` so a screen reader hears what is exported, and `align="end"` so the menu opens inward from the bar's right edge.

**Per item and light (P8):** each file is built for one trip, in the browser, from one model read plus one legs read made when the file is asked for. Nothing is bulk. The routed lines are not stored in the model, so the page does not grow with its routes. That is good.

### 2.5 The print view (T2, T1, T3)

**Structure is sound:**
- a title, then one meta line
- an `h2` per day, with `break-after: avoid`
- an ordered list of stops, with `break-inside: avoid`
- the source line at the end
- `print.css` forces light tokens, so dark mode prints black on white (21:1; `--muted` prints dimgray at 5.49:1)
- no date appears anywhere, because the model is dateless

**The content is not the page's** (MUST-5):
- **Times.** `stop.time` is the authored item time (`dayItem.time` in `core/src/schema/api/trip.ts`). It is not the scheduler's time for the profile the visitor picked, which is what the timeline shows. An untimed stop prints a bold "Not checked yet" where its time should be. "Not checked yet" is the site's word for a missing fact (an opening hour, a price). A free slot in a plan is not a fact we failed to check, so the paper would carry dozens of false gap markers and hide the real ones (T3).
- **Tracks.** Both tracks print, labelled "Lane A" and "Lane B". The page says "Adults' hike", "The easier day" or "Croda del Becco". "Lane" is our internal word (P4).
- **Booking windows are missing** (MUST-6). The brief lists them, and T1 makes them first-class. On paper, "book 60 days before day 3" is the line a family most needs.
- **Too many links.** Up to four raw URLs per stop print in 9 pt: on a 14-day trip with about 100 stops, that is pages of addresses. One link per stop (the place page, which holds the rest) is enough (SHOULD-8).
- **A credit for map data that is not there.** The source line ends with "Map data © OpenStreetMap contributors (ODbL)", but the print holds no map and no coordinates. Credit what is printed (SHOULD-8).

### 2.6 File formats: credits and ODbL

- **KML and GPX** add a `route:<trip>:<day>:<n>` line for each leg with geometry. A line is exportable only with the ODbL licence (`lineExportable`). The file then carries `OSM_ATTRIBUTION` and "Road routes by OpenRouteService", and each track has its own notice. That is correct and honest.
- **Track names are plain:** "Day 8: Athabasca Falls to Sunwapta Falls (drive, 24.6 km, 21 min)", and a walking leg says "walk".
- **Two defects:**
  - Every track of every variant goes in, so the Rockies file holds days 8 and 9 twice (B and C have identical geometry). The page's chosen profile is ignored (SHOULD-6).
  - The API-served KML and GPX carry no routed lines, while the browser-built ones do, so one file request has two answers depending on who builds it (P9, SHOULD-9).

### 2.7 Accessibility

- **The map is still not the only way** (T2). Every routed leg's time and distance is in the timeline, read from the same legs file at build. The files and the print hold the rest.
- **The chip link** is a normal link inside the map region, before the canvas, with a visible underline. Its focus ring comes from the global `:focus-visible` rule (open, no shot).
- **Hover loses its leg cue on routed days.** The hovered leg turns `--accent`, but `--map-route-pick` already is `--accent` (`#D9962B` in both themes), so hovering a row on a routed day changes nothing on the line. Only the pin ring remains (P5, SHOULD-4).
- **The menu** is the existing Base UI menu, so keyboard handling, Esc and focus return are L5's and already tested. The disabled calendar entry is announced as disabled, with "Copy to my trips" as its hint.

### 2.8 Consistency with the trip page and the place page

- **Place pages are untouched.** `GoogleJsMap.tsx`, the place family and the place `ExportMenu` path keep "PDF: print this page" and the page's own print.
- **The trip page's two Export buttons are one component.**
- **The key vocabulary is the note's**, apart from MUST-2 and MUST-3.
- **No green.** Nothing new is drawn with `--ok`, `--warn` or an `--id-*` colour. The chip, swatches and lines use `--muted`, `--surface`, `--accent`, `--map-casing`, `--map-route` and `--map-halo` only.

## 3. Colour pairs approved (WCAG 2.x, computed from `web/app/themes.css`)

| Pair | Light | Dark | Use | Passes as |
|---|---|---|---|---|
| `--accent` routed line to `--map-casing` | 6.38 | 7.53 | the edge of a routed leg | non-text 3:1 |
| `--map-casing` on Google forest `#C3F1D5` / plain land `#F5F5F5` | 12.89 / 14.73 | | the routed leg's outline in light | non-text |
| `--accent` on Google light land / forest | 2.31 / 2.02 | | amber alone in light | fails alone; carried by the casing (above) |
| `--accent` on Google dark land `#1F2835` / forest `#164A55` / high ground `#485876` | | 5.91 / 3.89 / 2.85 | amber in dark | passes except on high ground, where the 7.53 edge carries it |
| `--map-casing` dark on dark land / forest | | 1.27 / 1.93 | the dark casing | **does not frame the line**; acceptable only because amber passes on land and forest (SHOULD-2) |
| `--map-route` estimate on forest / land | 12.89 / 14.73 | 8.24 / 12.50 | dashed estimate | non-text |
| `--muted` chip text on `--surface` 88% over white / forest / water | 6.94 / 6.75 / 6.61 | | ODbL chip | text AA |
| `--muted` chip text on `--surface` 88% over dark forest / high ground / water / land | | 7.08 / 6.84 / 7.61 / 7.36 | ODbL chip | text AA |
| `--ink` on `--surface` | 16.06 | 13.83 | Export buttons | text AAA |
| `--line-2` button edge on `--bg` | 3.39 | 3.78 | Export button outline | non-text 3:1 |
| `--muted` on `--bg` | 6.42 | 8.23 | the key sentence | text AA |
| print: black on white; dimgray (`--muted` in print) on white | 21.00; 5.49 | same (print forces light) | print view | text AAA; text AA |
| SHOULD-2 candidate: `--muted` `#A3B0BE` estimate on dark forest / land | | 4.43 / 6.73 | the dark estimate, if needed | non-text 3:1 |

**Correction to the note**: section 5.1 gives the light casing on forest as 15.21. The casing is `#172230`, which gives **12.89**. It still passes. Carry it into `tokens.md` 5.1 with TRP2a LATER-8.

## 4. Rulings on the builder's departures and known gaps

| Item | Ruling | Reason |
|---|---|---|
| 27 Rockies and 40 Dolomites legs, polyline5, 30 m, 9.0 and 19 KB | **Accept** | Inside the brief; small (P8) |
| 6 Rockies pairs not drawn as routes, in `*.unrouted.json` | **Accept** the data; **LATER-1** for the UI | A straight line for a trail or lake leg is honest (T5). Refusing a 7.5x detour is right: a line that loops 40 km round a lake would mislead more than a straight one |
| Refused near home: 0 | **Accept** | API3 R-5 is met: the count is printed and the leg is never named |
| Solid amber over casing for routed legs, dashed otherwise | **Accept**, with MUST-1 to MUST-4 | Matches note 5.1 |
| "Road route" only when one is drawn | **Accept**, with MUST-2 and MUST-3 | The rule is right; the label and the All days swatch are not |
| Chip reads "Route geometry © OpenStreetMap contributors" (brief) where the note says "Route lines ©" | **Change: use the note's "Route lines © OpenStreetMap contributors"** (SHOULD-1) | The note is the design ruling, and the brief's step 8 was written before it. "Geometry" is a word a family does not use (P4). Both satisfy ODbL |
| Chip top left | **Accept** | Note 8 |
| OpenRouteService credit in the tooltip, the files and the API attribution | **Accept** for files and API; **change** for the site (MUST-7) | A tooltip is not a credit on touch |
| Export trip at the top and in the plan bar from 1024 px; phone top only | **Accept**; the size is a polish fix (SHOULD-7) | Note 17 |
| Print view rendered from the `json` model | **Accept** the source; **change** the content (MUST-5, MUST-6) | One data boundary is right (P9); the model must carry the profile's times |
| CSV, KML and GPX with routed lines | **Accept**, with SHOULD-6 | |
| Calendar only for a dated copy | **Accept** | Public trips are dateless; unchanged from L5 |
| Start JS +0.07 KB | **Accept**; record it in the brief | 70 bytes is the `next/dynamic` stub for the plan bar menu. D-E9's intent (the map and export code stay out of start JS) is met |
| `web/lib/client/*` and `web/scripts/legs/*` outside the listed paths | **Accept** | Step 8 needs the client method behind the one boundary (P9); record it for the coordinator |
| Known gap: Dolomites day 4 base to stop 1 stays a straight estimate, though the file holds Funbob and San Candido | **Change: SHOULD-5** | The map's chain and the fetched pairs come from two walks of the trip. Drive one from the other |
| Known gap: API-served KML and GPX carry no routed lines | **Change before the server switch: SHOULD-9** | One file, one answer (P9) |
| Known gap: print has no booking windows | **Change: MUST-6** (before go-live; does not block the preview) | Brief step 9; T1 |
| Known gap: R-9, legs read per request | **LATER-3** (API lane, before the server) | Only matters with a running server and a rewritten file; the legs files are now stable |
| R-13: no body budget | **LATER-4** | 9 KB and 19 KB against a 16 MB worst case; add the cap with R-9 |
| Known gap: the `data/schedules/README.md` describes `trip-legs/1` and `--env-file` | **Change: SHOULD-10** | Wrong docs on the one script that spends a key |
| Leg labels "38 min · 24 km" (note 5.1) not built | **LATER-2** | The timeline carries the same numbers, so the map need not; recorded as a departure from the note |

## 5. Findings

### MUST

| # | Rank | Screen | Defect | Why it matters to a family | Fix | Evidence |
|---|---|---|---|---|---|---|
| MUST-1 | critical | Every routed day at all widths; worst on Dolomites days 4, 6, 9 and 10 | Routed lines end at the car park or trailhead, 0.5 to 4.2 km short of the pin. Pin 2 on day 4 floats about 4 km from both its amber legs | The map seems to say the road stops in the middle of nowhere, or that it reaches the summit. Neither is true, and the stop and its route look unrelated (T5, P3) | In `routeSpec.ts` `dayLegs`, when a leg has geometry and either end of the decoded line is more than 50 m from its pin (or base), add a `straight-estimate` stub from the line's end to the pin. Give it the id `<legId>:a` or `<legId>:b`, and let the hover effect recolour a leg's stubs with it. The key then shows both items. Mixed sentence: "Road routes from OpenStreetMap data run to each stop's car park or trailhead. A straight line has no road route stored, often because the stop is reached on foot, by lift or by boat." Unit test: every routed leg's drawn path starts and ends within 50 m of its pins | `data/schedules/legs/dolomites-2027.json` decoded against `prototype.json` points (section 2.1 table); `pairs.ts` `routingPoint` |
| MUST-2 | important | Dolomites days 4 and 5 (and every day with a `foot-hiking` leg), key and lines | Six walking legs are drawn and keyed as "Road route" | The family plans to drive a stretch that is a footpath, and the map contradicts the day list's "Walk" | Carry `mode` from the leg into the geometry record (`legGeometry` returns `{ path, mode }`) and onto the `Line`. In `keyOf`, label the item "Road or path route" when any drawn routed leg is a walk, and "Road route" otherwise. Keep one solid style, because the timeline says which. Test on Dolomites day 4 | `dolomites-2027.json`: `san-candido -> drava`, `funbob -> san-candido`, `siusi -> puflatsch`, `antorno -> monte-piana`, `cinque-torri -> limides`, `otzi -> bolzano` are `foot-hiking` |
| MUST-3 | important | All days key, both trips | The "Road route" swatch is amber with a casing, but All days draws routed legs as ink 2 px solid with a halo | The key describes a line that is not on the map (brief step 3, checklist 11) | In `keyOf`, push the road item with the style of the drawn lines (`route` in All days, `route-pick` in Day view). In `trips.css`, add `.key-swatch[data-key='road'][data-all] { height: 2px; background: var(--map-route); outline: 1px solid var(--map-halo); }` and pass `data-all` from `RouteKey`. Extend `route-spec.test.ts` | `routeSpec.ts:130`; `trips.css:104`; `legParts` line 117 |
| MUST-4 | important | 390 sheet, collapsed key, any mixed day | The one-line key shows "Straight line, not a route" when an amber leg is also drawn | The most visible line on the phone map is unexplained; a family on the road reads only the collapsed key (T2) | In `RouteKey`, when collapsed, show the `road` item if present, else `estimate`. If both fit on one line with "Map key" (test the width at 360 px), show both, road first | `TripRouteMap.tsx:42` |
| MUST-5 | important | Print view, both trips | It prints the authored item time, not the scheduled time of the profile on the page. An untimed stop gets a bold "Not checked yet". Both tracks print as "Lane A" and "Lane B" | The paper plan disagrees with the screen. False gap markers hide real ones (T3), and "Lane" means nothing to a reader (P4) | Give `loadExport` the page's profile, as the brief's server switch already spells out: `loadExport(type, slug, format, profile)` to `?p=`. Build the model's stop times from the same scheduler timelines the page renders. Print the chosen track only, with its page label (`variants[].label`). An untimed stop prints no time. "Not checked yet" prints only where a fact is missing (season, hours, a price). Pin it with a test that compares the print view's day 3 times with the timeline's day 3 times for `family-6` | `TripPrintView.tsx:197`; `build.server.ts:63-65`; `core/src/schema/api/trip.ts:111` |
| MUST-6 | important (before go-live; does not block the preview) | Print view and CSV | No booking windows | The costliest miss on a trip is a booking window (T1; brief step 9) | Add `bookings: { name, rule, note }[]` to `TripExport` from the trip's booking category items (`bookRule`, `bookNote`), worded dateless as the page words them ("Book 60 days before day 3"). Print a "Book ahead" section after the meta line, plus the rule under the stop it belongs to. Add a column to the CSV | Brief step 9; `categoryItem.bookRule` in `trip.ts:168` |
| MUST-7 | important | `/about/data/` and the chip | OpenRouteService is credited only in a tooltip and inside the files | Its terms ask for a visible credit; a tooltip is invisible on touch and to most screen readers | Add one line to the `/about/data/` credits: "Road routes: OpenRouteService (openrouteservice.org), from OpenStreetMap data, ODbL." Keep the `title`. Do not lengthen the chip | `TripRouteMap.tsx:393`; `web/app/about/data/page.tsx` |
| MUST-8 | important | Verification set | No screenshot exists; the set was deleted by the next Playwright run | Section 2's dark hierarchy, the chip at 390, the print layout and the menu have only been judged from code | After MUST-1 to MUST-5, `travel-verifier` writes shots **outside Playwright's output folder** (for example `web/shots/TRP2b/`, git-ignored, or a run with its own `--output`), at 2x on the Metal flags, through the theme control. Shoot at 1440 and 390, light and dark: Rockies day 8, Rockies day 5 (mixed), Dolomites day 4 (mixed, walk legs, the stubs), Dolomites day 3, All days, the phone key collapsed and open, a hovered row on a routed day, the export menu open from the top and from the plan bar, and the print view (Chromium print-to-PDF, every page). Read in tiles | Section 0 |

### SHOULD

| # | Rank | Screen | Defect | Fix |
|---|---|---|---|---|
| SHOULD-1 | polish | Chip, all widths | The wording departs from the note, and the chip wraps at 390 | "Route lines © OpenStreetMap contributors" on maps at least 560 px wide; "Routes © OpenStreetMap" below 560 px (the `wide` flag `routeSpec` already has), with the same link. Update the e2e expectation |
| SHOULD-2 | important | Dark, mixed days | The near-white estimate (8.24 to 12.50) may out-read the amber route (2.85 to 5.91), whose dark casing disappears (1.27 to 1.93) | Decide on the MUST-8 dark shot. If the dash reads first, add `--map-estimate` through `tools/theme_tokens.py`: light `#172230`, dark `#A3B0BE` (4.43 on dark forest, 6.73 on dark land). Use it for `straight-estimate` only; the All days `route` keeps `--map-route`. Update `tokens.md`, `tokens.json` and the specimen together |
| SHOULD-3 | important | Every routed trip, on load | The lines draw dashed, then flip to amber, and the sentence changes | Hold the line layer and the key sentence until `tripLegs` settles or 1,200 ms pass, whichever is first. Pins draw at once. After the timeout, draw the estimates and swap later without moving the camera |
| SHOULD-4 | polish | Hover on a routed day | The hovered leg is already `--accent`, so nothing changes on the line | When the leg is `route-pick` and hot, draw it at 5 px over a 7 px casing (unchanged colours). Assert the weights in `leg-parts.test.ts` |
| SHOULD-5 | important | Dolomites day 4 (and any day whose chain differs from the detail's item pairs) | Base to stop 1 stays straight though the file holds the pair | Make `pairs.ts` ask for the pairs of the map's chain (morning base, pins by place, night base), and key the lookup by place on both sides. Test: every step of Dolomites days 3, 4 and 5 whose two places appear in the file draws routed |
| SHOULD-6 | important | KML, GPX | Every variant's tracks are exported (Rockies days 8 and 9 twice); the profile is ignored | Filter `routeLines` to the chosen profile's track, dedupe identical pairs per day, and name the track in the label: "Day 8, family day: Athabasca Falls to Sunwapta Falls (drive, 24.6 km, 21 min)" |
| SHOULD-7 | polish | Export menu and plan bar | Format-first labels; the routes are not named; the download icon is used for print; "Export" has no context; the button is 30 px against the 36 px ruled | Labels as in 2.4. `icon: 'print'` for print. `triggerLabel="Export trip"` and `align="end"` in the plan bar. Add `.btn-sm` 36 px variant for the plan bar only (`.tl-planbar-export .btn { height: 36px; }`), keeping the 44 px `::after` |
| SHOULD-8 | polish | Print view, and acceptance 8 | Up to four raw URLs per stop; an OSM map credit with no map; the OSM copyright URL hard-coded in `TripRouteMap.tsx` | Print the place page URL only. Drop "Map data © OpenStreetMap contributors (ODbL)" from the print, unless coordinates are printed. Export `OSM_COPYRIGHT_URL` from `core/src/export/licence.ts` and import it in the chip |
| SHOULD-9 | important (before the server switch) | API KML and GPX | They carry no routed lines; the browser's files do | Move the `routeLines` join into `core/src/export` behind `getExport`, reading the same legs projection. The browser then calls the same builder. One file, one answer (P9) |
| SHOULD-10 | polish | `data/schedules/README.md` | Describes `trip-legs/1` and `--env-file` | Document `trip-legs/2` (polyline5, `simplifiedM`, attribution), `ORS_API_KEY`, the `*.unrouted.json` ledger and its reasons, and `--check` and `--list` |

### LATER

| # | Item | Owner |
|---|---|---|
| LATER-1 | Serve the unrouted reasons through `tripLegs` (`unrouted: [{ from, to, reason }]`). Show "No road route: on foot, by lift or by boat" on the timeline's travel row and as the leg's tooltip (P6) | TRP3 or the API lane |
| LATER-2 | The routed leg label "21 min · 24.6 km" from zoom 9 (note 5.1) | TRP3 |
| LATER-3 | API3 R-9: read the legs files once, beside the revision | API lane, before the server |
| LATER-4 | API3 R-13: a `tripLegs.totalChars` cap of about 400,000 and a check-all validation of the legs files | API lane |
| LATER-5 | A small car park mark where a stub meets its route (after MUST-1), using the place page's parking glyph | TRP3 |
| LATER-6 | Load the export chunk and the model on menu open, and show counts after they arrive (brief step 9) | L5 follow-up |
| LATER-7 | Lifts as their own line once META-1 gives lift kinds. Today Ortisei to Seceda is a 3.9 km drive to the lift base, plus a MUST-1 stub up the mountain | META-1, then TRP3 |
| LATER-8 | Note corrections into `tokens.md` 5.1: casing on forest 12.89 (not 15.21), accent to casing 6.38 light, and the chip wording of SHOULD-1 | foundation |

## 6. What the owner should look at on the refreshed preview

After MUST-1 to MUST-5 and a rebuild of the preview (`127.0.0.1:3476`), with the env file in place:
- **Rockies, day 8, desktop.** One solid amber line from pin 1 (Athabasca Falls) to pin 2 (Sunwapta Falls), following the Icefields Parkway's bends. There is no dashed line, because the day's only step is routed. The key reads "Road route" with no sentence. A small grey chip at the top left reads "Route lines © OpenStreetMap contributors". Toe of the Athabasca Glacier is still listed under "1 not on the map".
- **Rockies, day 5 or 6.** Amber lines where a road exists, and straight dashed lines where a stop has no road within reach. The sentence under the key explains why.
- **Dolomites, day 4.** The amber drive from San Candido to the Braies car park, then a short dashed line up to pin 2 (Croda del Becco). The walking legs on the Drava path day are labelled "Road or path route". The base to stop 1 leg may still be dashed until SHOULD-5 lands.
- **Theme toggle** to dark on the same day. Check that the amber reads before the dashed lines. If it does not, SHOULD-2 is the fix.
- **All days.** Thin dark solid lines for routes and dashed lines for estimates, with a matching dark swatch in the key.
- **On a phone.** Open the Map button. The one-line key names the amber line first.
- **Export trip** at the top of the page; **Export** at the right end of the day bar on a wide window. In the menu:
  - "Print or save as PDF" opens the print dialog with a text-only plan: every day, the times you see on screen for your chosen profile, and no dates.
  - The GPX and KML open in a GPS or mapping app with the routes as lines, credited to OpenStreetMap and OpenRouteService.

**Deliberately not there yet:**
- booking windows on the printout (MUST-6, before go-live)
- the reason a particular leg is straight (LATER-1)
- time and distance labels on the map lines (LATER-2)
- routes in files fetched from the API rather than built in the browser (SHOULD-9)
- lines from the Rockies hotels, which still have no map positions
- the Google map's green and its peak markers, which stay until the Map ID style from the TRP2a review section 6 is published in the console
