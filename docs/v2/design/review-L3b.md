# L3b design review: trip tags, filters, type-aware facets

Reviewer: travel-design-reviewer (Opus), 19 Oct 2026. Branch `public/L3b` at `7ff2f98` (private history), built with `pnpm build`, served from `web/out`, Chromium on the Arc GPU, 2x, at 1440 and 390, light and dark (set with the site's theme toggle). Screenshots are in `/tmp/l3b-review/`; tall pages were read in tiles (`*.tN.png`).

**Verdict: not ready to merge.** The filter model is right and mostly self-explaining. Three things fail the owner's rule "a gap is never a yes" or T5: Kids-from values that sit below an age the data already rules out, a fade that gives no reason, and trip pins and clusters drawn at country centroids. One phone layout break is also a must-fix.

## Scores

| | Score | Note |
|---|---|---|
| P1 scale | Partial | Counts, groups and Kind search scale. The count line stacks up to five clauses, and the map clusters on fake points |
| P2 progressive | Pass | Four pills, the rest under More filters |
| P3 glance | Pass | The card answers length, season, kids and effort |
| P4 no manual | Pass, with gaps | Six pills only when scoped (checked). Kids works differently on Trips and Places |
| P5 smooth | Pass | Menus are non-modal (no `aria-modal`, no `inert`, body still scrolls) with 0.2 s transitions. Clear all and Back keep the view |
| P6 metadata | Partial | The Kids chip has no basis |
| P7 the 90% | Pass | |
| P8 light data | Pass | Bands are labels only |
| P9 server-ready | Pass | `k`, `kid` and `view` survive reload; Clear all drops the filters and keeps `view`; Back restores them |
| T1 when | Pass | Season chip on every card |
| T2 field | Fail at 390 | View switcher breaks (M4) |
| T3 trust | Partial | The plan's typed value looks the same as a computed one |
| T4 families | Fail | M1, M2 |
| T5 honest maps | Fail | M3 |

No green anywhere in the UI. Accent is amber, warnings are red, dark mode is navy.

## Must-fix before merge

**M1. A Kids-from value below what the data proves.** In `trip-tag-conflicts.md` the scheduler's fit age is 10 for Utah and Dolomites, even with every gap item counted as a pass. Gaps can only push that number up, so 10 is a floor. The cards show the plan's typed 7 and 8 (`trips-cards-d-light.t0.png`). Utah's own Scout Lookout record carries `age_band.from 8`. On `/trips/?kid=6` Rockies passes on its typed 5 even though 16 items have no age on record (`trips-kid6-d-light.t0.png`).
*Fix:* show `max(typed, known floor)`. When the computed value is "none", the floor is the scheduler's fit age with gaps treated as passes. Utah and Dolomites then show "Kids from 10". Log the change in the conflicts table.

**M2. The Kids chip does not say what it rests on.** "Kids from 5" (our plan, 16 gaps), "Kids from 10" (computed) and Vermont's "All ages" (computed 0, where the plan said 4) all look the same. "All ages" is the strongest claim on the page, and it overrules the plan author without saying so.
*Fix:* add a quiet basis suffix using the honesty-marker tooltip (the P4 exception): "Kids from 5 · our plan" or "Kids from 10 · checked". For Vermont, show "All ages · checked", or keep the plan's 4 until a reviewer accepts the looser value. A computed value should never silently loosen a typed one.

**M3. Trip pins and clusters sit at country centroids.** Utah, Vermont and New Hampshire are all at 38, -97 (Kansas). Algonquin and Niagara are at 60, -95 (near Hudson Bay). Chamonix, Costa Rica, Norway and Switzerland are also centroids. The "nearest member" rule therefore puts the "6" and "3" clusters in Kansas (`trips-map-d-light.t0.png`, `trips-map-na-z3-d-light.png`). Acceptance check 15 passes in letter only, and the legend says "Trip, at its first base". After clicking the 6 cluster, it did not split at a 500 km scale (`trips-map-cluster-zoom-d-light.png`).
*Fix:* never anchor a cluster on an `approx` member. Draw approximate pins hollow, with a legend row "Middle of the country, no base yet". Re-cluster on `moveend` after a cluster click.

**M4. The phone view switcher breaks.** At 390 the four-button switcher stretches to the height of the count block, and its active segment becomes a 160 px orange slab. The count line also wraps with a leading "·" (`phone-combo.png`, first panel; `phone-trail-top-light.png`).
*Fix:* `align-self: start` on the switcher, and put the hidden-facet clause on its own line without the leading dot.

**M5. A faded row gives no reason and fails AA.** The fade is `opacity: 0.6` on the whole card or row, with no label and nothing for screen readers. Without a reason it reads as disabled. Measured in light mode: faded title 4.3:1, faded area line 2.75:1, both under AA. Dark mode measured 5.9:1 (`places-kid6-cards-d-light.t0.png`, `places-kid6-list-d-light.t0.png`, `places-kid6-table-d-dark.t0.png`).
*Fix:* fade only the image and the meta row, at 0.6. Keep title and text tokens at full contrast. Add a full-opacity chip "A stretch at 6 · advice says 8+" to every faded card and list row, plus a visually hidden version in table rows.

## Fix in stage 4

1. **Kids works two ways.** Trips uses radios ("A child of 6", hides everything above the age). Places uses a stepper ("Youngest child 6", fades advice). The active chips say "Kids: A child of 6" and "Kids: Youngest child 6". *Fix:* one control, one label ("Youngest child"), and the same hide-on-rule, fade-on-advice behaviour on Trips once trips carry rule versus advice (`trips-kids-menu-d-light.s.png`).
2. **The count line at 10,000.** With Kind, Kids and coverage active it reads "75 of 209 places · for age 6 · 33 are a stretch… · 50 not checked yet · Shape and Dogs hidden…". *Fix:* the count on line 1, notes on line 2 at most, and turn "50 not checked yet" into a link that shows them. The denominator should be the scope (125 trails), not all 209 places.
3. **Effort menu has no "not known" count.** The menu shows 98 of 125. *Fix:* add a muted row "27 not known yet, hidden when you pick one", like the Trips Kids menu (`places-effort-menu-d-dark.s.png`).
4. **Utah's record name.** "Angels Landing chains view or Scout Lookout" decides Utah's effort. The record covers Scout Lookout only (6.1 km, 362 m, FE 3; the chains are explicitly outside it), and the plan's day 2 baseline is Scout Lookout. So "moderate" is honest and the family variant does not include the chains. But the name will reach day rows and "decided by" text and imply the chains. *Fix (CS7):* rename the record "Scout Lookout (Angels Landing chains view)".
5. **Activities read from anchors only.** This leaves gaps a family notices: Rockies has no "Hiking" tag while Dolomites does, and "Dolomites" appears as a Highlight. *Fix:* a highlight must be a place, not the region; review the anchor roles for Rockies.
6. **Length labels differ.** The card says "Weekend", the table says "Weekends (2 nights)", the subtitle says "a weekend". *Fix:* one label set from `lengthClass`.
7. **Tag chips look like the "Public page" button.** *Fix:* make "Public page" a text link, or give tag chips a tag icon, so it is clear which pills filter (P4).
8. **More filters is a popover holding an accordion.** That is two clicks to any value, and Multi-day is missing with no count-line mention. *Fix:* show the active value next to each header, and list every coverage-hidden facet in the count line.

## Fine

- Six pills appear only with a Kind, and clearing Kind returns to four (`places-trail-d-light.t0.png`, `places-after-back-d-light.png`).
- The phone sheet has Done, a 44 px target, no horizontal scroll at 390, and "Show 125 places" (`phone-sheet-*.png`).
- Overview trips show Where, Length and When only, with no fake zeros.
- The Trips Kids menu copy "No age guidance yet · Hidden when you pick an age" is a model for honest filter copy.
- Hike-effort chips match the conflicts doc. Algonquin's computed "strenuous" over the typed "easy" is the right direction.

## Round 2

Reviewer: travel-design-reviewer (Opus), 19 Oct 2026. Branch `public/L3b` at `6df3180` (private history), `pnpm build`, served from `web/out`, Chromium on the Arc GPU with real OpenFreeMap and Mapterhorn tiles (98 to 140 tile responses per desktop run), 2x, 1440 and 390, light and dark through the theme toggle. Shots are in `/tmp/l3b-review/r2/`.

**Verdict: not yet.** M1, M2, M4 and M5 are fixed. M3 is half fixed: pins now sit in the right places on a real map, but clusters never split after the camera moves, two area-only trips still form a solid cluster in Hudson Bay, and the legend does not show the hollow pin.

### Round-1 must-fixes

| | Status | Evidence |
|---|---|---|
| M1 Kids floor | Fixed | Utah and Dolomites read "Kids from 10 · checked"; Rockies "Kids from 5 · our plan"; Algonquin "Kids from 10 · checked" (`trips-cards-d-light.t0.png`, `.t1.png`) |
| M2 Kids basis | Fixed | "· our plan" and "· checked" on every chip. Vermont reads "All ages · checked", one of the two options round 1 allowed. Hike effort follows suit: Rockies "moderate · our plan" |
| M3 honest pins | Partly fixed | See R1 to R3 below. Fixed: Utah sits at Zion, Vermont near Stowe, New Hampshire in the White Mountains, Quebec on the St Lawrence; nothing is in Kansas (`trips-map-na-d-light.png`, `vt-z6-direct.png`). Costa Rica, Norway and Switzerland are ring pins that open a card with an "Area only" chip (`click-costa.png`) |
| M4 phone switcher | Fixed | 162 x 40 at 390 in light and dark; no orange slab (`phone-switcher-*.png`) |
| M5 stretch | Fixed | Chip "A stretch at 6 · advice says 8+" on cards and list rows; title and area line stay full contrast; the table carries hidden text (`places-kid6-*`) |

### Must-fix before merge

**R1. Clusters never re-cluster after the camera moves.** Clicking the "3" cluster in New England flies to a 50 km view and the pin still reads "3" (`click-world3.png`). Clicking the Vermont "2" at zoom 3.2 flies to a 5 km view and it still reads "2" (`click-ne.png`). Mouse-wheel zoom does the same (`vt-wheel.png`). In all three the address bar keeps the old `c=`, so `onCamera` is not firing after the first load. Loading `?c=-72,44.3,6` directly does split Vermont and New Hampshire correctly (`vt-z6-direct.png`), so the clustering is right and only the update is missing. A family who clicks a cluster lands on an empty valley with the same number on it. This is the round-1 "re-cluster on moveend" fix, not yet done.
*Fix:* call `onCamera` on every `moveend` (user gesture and `flyTo`), and add an e2e test that clicks a cluster and expects its members as separate pins.

**R2. Area-only pins still cluster, solid, in Hudson Bay.** Algonquin and Niagara are both area-only at 60, -95. The app keeps them out of `clusterPins`, but the map engine merges the two coincident pins into a solid numbered "2" (`pin-merged`, `n > 1`), and clicking it fans out two solid buttons, "A" and "N" (`click-hudson.png`). That is exactly what T5 forbids: a solid cluster drawn where no trip is, 1,700 km from Niagara.
*Fix:* never merge pins whose style is `place` (area only) in the engine, or offset coincident area pins; keep them hollow in the fan. Better still, give Algonquin and Niagara a first positioned stop (a research task: their places seem to be `prototype_approx` only), because "the middle of Canada" for a Niagara day trip is not useful even when it is hollow.

**R3. The legend shows a solid dot for "Area only, no base yet".** Both legend rows draw the same filled dot in light and dark (`legend-zoom.png`, `trips-map-eu-d-dark.png`), while the map draws a ring with a centre dot. The legend is the only explanation of the hollow pin.
*Fix:* render the legend swatch from the same icon image as the pin (`pin-place`).

### Stage 4

1. At 390 the Switzerland ring sits on top of the Chamonix and Dolomites "2" and hides its numeral (`trips-map-m-dark.png`). Draw clusters above area pins, or nudge the ring.
2. Dark basemap shows dense admin labels (Russian oblasts in Cyrillic, German states) at the Europe view (`trips-map-eu-d-dark.png`); `hideBasemapLabels` should also drop states and provinces below zoom 5.
3. The table has no visible stretch marker, only hidden text (`places-kid6-table-d-dark.t0.png`). Add a narrow "Fit" column or the chip in the Name cell.
4. Table cells repeat their header: "Length 8.3 mi", "Climb 2,400 ft".
5. Card footers read "No source yet Draft" as one run; separate with " · ".
6. At 390 the count line still runs to five lines with Kind and Kids active, the Kids chip is clipped at the right edge, and "Clear all" sits alone below a gap (`phone-switcher-places-dark.png`). Round-1 stage 4 item 2 covers the count line.
7. The five template trip cards show an empty grey image box with no icon in a full-page shot (`trips-cards-d-light.t1.png`); check lazy loading, and use the same icon fallback the place cards use.
