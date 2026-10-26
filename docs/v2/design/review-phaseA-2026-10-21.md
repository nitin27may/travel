# Phase A design review, round 1 (21 Oct 2026)

Reviewer: `travel-design-reviewer` (Opus). Scope: the five phase A UI lanes plus the FIXF consistency check, each read as
`git -C <worktree> diff main...HEAD` against `main` 10021d0. Review only: no app code changed, nothing committed.

Judged against [principles.md](foundation/principles.md) P1-P9 and T1-T5, [tokens.md](foundation/tokens.md),
[components.md](foundation/components.md), [patterns.md](foundation/patterns.md), the no-green rule and the R1 checklist
(EXECUTION-PLAN 8.2).

## How it was checked

- Lane screenshots read where they exist: `v2-FIXF/web/test-results/shots/FIXF/`, `v2-SHL2/.../SHL2/` (gallery only),
  `v2-LST2a/.../LST2/`, `v2-PLC2a/.../PLC2/`.
- GLB2a and TRP1 had no screenshots, and SHL2 had none of the header or footer. I took my own from each lane's built
  `web/out`, served one at a time on port 3480 (killed by PID after each), Chromium 1248 with
  `--use-gl=angle --use-angle=metal --ignore-gpu-blocklist --enable-gpu-rasterization`, 2x, 1440 x 900 and 390 x 844, light
  and dark through the site's theme key, tall pages in tiles. Live OpenFreeMap tiles loaded. Files:
  `/private/tmp/claude-501/-Users-nks-workspace-travel/6ecdf19c-bdc2-4d26-a05a-b168e5a5515a/scratchpad/shots/{SHL2,GLB,TRP}/`
  (named below as `mine/<lane>/<file>`).
- Caveat: GLB2a's `web/out` was built 2 minutes before its last commit fd02d23 (private history) and TRP1's 8 minutes before 42e9757 (private history). The
  GLB2a card re-placement on `moveend` is visible in the shots, so the build looks current. 42e9757 (private history) changes Rockies Day 12
  data only, and I did not re-check that day visually. The verifier should rebuild both before the sweep.
- 1024 was checked on Dolomites Day 4 only. Motion was not timed. GPU frame budgets are the verifier's job.

## Verdicts

| Lane | Commit(s) | Verdict | Must-fix rows |
|---|---|---|---|
| SHL2 | 4656183 | **Ship** | 0 |
| FIXF | 19730ee | **Ship** (consistent with the foundation) | 0 |
| GLB2a | a4cd4f9 (private history) d02ccbf (private history) fd02d23 (private history) | **Ship after fixes** | 4 (M1-M4) |
| TRP1 | 3c43c8b (private history) 42e9757 (private history) | **Ship after fixes** | 6 (M5-M10) |
| LST2a | 745f35d (private history) | **Ship after fixes** | 3 (M11-M13) |
| PLC2a | ed56483 (private history) | **Ship after fixes** | 6 (M14-M19) |

No lane needs rework. The structures are right: one fit model, one Where menu, one facts strip, one Directions chooser.
The must rows are placement, wording and honesty defects that a visitor would see within one visit.

## Scores against the principles

A pass means no breach found in this review. A partial is explained by the row numbers given.

| | SHL2 | FIXF | GLB2a | TRP1 | LST2a | PLC2a |
|---|---|---|---|---|---|---|
| P1 scale | n/a | n/a | partial (M2: pins overlap) | pass | pass (count tween, L8) | pass |
| P2 progressive | n/a | pass | pass | partial (L13) | pass | partial (M14: strip too tall on phone) |
| P3 glance | pass | pass | partial (M1: the card hides the feature) | partial (M7, M9) | pass | partial (M14, M18) |
| P4 no manual | pass | pass | partial (M3: silent switch) | pass | partial (M11, M13) | partial (M15, M17) |
| P5 smooth, linked | n/a | partial (L19) | pass | partial (M7) | pass | pass |
| P6 metadata | n/a | n/a | pass | partial (M5) | pass | partial (M14, M16) |
| P7 primary action | pass | pass | pass | partial (L14) | pass | partial (M19) |
| P8 catalogue | pass | pass | pass (lines load one per pick) | pass | pass (no new loads) | pass |
| P9 boundary | pass (`reportProblem()`) | pass | pass (`globeLine()`) | partial (M8: slug literal) | pass | pass |
| T1 when | n/a | n/a | n/a | partial (M6: season said three times) | n/a | pass |
| T2 field | pass | pass | partial (M1 on phone) | partial (M7) | pass | partial (M14) |
| T3 trust age | n/a | n/a | n/a | pass | n/a | pass (dates shown, M14 moves them) |
| T4 families | n/a | n/a | n/a | partial (M5) | pass | pass |
| T5 honest maps | n/a | n/a | pass (our own lines with their credit) | partial (M9) | n/a | pass (no Directions without a point) |
| No green | pass | pass | pass | pass | pass | pass |
| Light and dark | pass | pass | pass | pass | pass | pass |

## Must-fix rows

Each row gives the lane, the file or component, the defect, the fix and the evidence.

### GLB2a

**M1. GLB2a, `GlobeShell.tsx` feature card and `controller.padding()`: the card covers the feature it describes.**
On a phone the river card sits in the middle of the map (y 320 to 430 CSS px) on top of the Danube and the upper Ganges.
The right-hand control column and the attribution bar cover the Ganges delta. On desktop, after Fly here, the card is
anchored to the river's label point, so it always sits on the river between Varanasi and Bangladesh. A family that searches
"Ganges" sees half of it.
Fix: on phone and landscape phone, dock the feature card as the bottom peek sheet above the bottom bar (components 7.2: "as
a peek sheet on phone"). Add its measured height plus 16 px to the camera's bottom padding, and the 56 px control column to
the right padding, before `fitMove`. On desktop, once the camera rests, place a fitted feature's card in the corner of the
free area farthest from the box centre, not at the label point. Point features (peak, city) keep the anchored card.
Evidence: `mine/GLB/danube-pick-390-light.png`, `ganges-fly-390-dark.png`, `ganges-fly-1440-dark.png`,
`ganges-pick-1440-light.png`.

**M2. GLB2a, globe pins (`engine.ts` pin layer, `cluster.ts` radius) on the globe page and the cover: pins overlap.**
At 390 a "1" disc sits on top of the "26" disc over Britain. At 1440 "26" and "1" touch over Scandinavia, and "3" and "1"
touch over Israel and Egypt. Count discs are 28 to 44 px, so any overlap hides a number and shrinks a target below 24 px
(A4b acceptance).
Fix: after clustering, run one screen-space pass at the current zoom. Two discs whose centres are closer than r1 + r2 + 4 px
merge into one cluster with the summed count, which fans out on tap, as co-located stops do in components 7.1. Apply the
same pass to `CoverGlobe.tsx`.
Evidence: `mine/GLB/world-390-light.png`, `options-1440-light.png`, `nf0-results-1440-light.png`.

**M3. GLB2a, `GlobeControls.tsx` and `GlobeSearch.tsx`: the Natural features switch is unexplained, and its off state is
silent.** The switch has no description line. With `nf=0`, typing "Ganges" opens no result list at all: no row, no reason,
no way back. That breaks P4 (visible state, one obvious way to clear).
Fix: (a) pass `note="Rivers, seas, ranges and plains, in search and on tap"` to the Switch, in `--muted` `--t-small`, the
same slot the Auto-spin reduced-motion note uses. (b) When natural features are off and the query matches only features,
show one result row: "Ganges is a natural feature. Natural features are off." with a "Turn on" link-button that calls
`changeNatural(true)` and keeps the query.
Evidence: `mine/GLB/options-1440-light.png`, `options-390-dark.png`, `nf0-results-1440-light.png`.

**M4. GLB2a, `CoverGlobe.tsx`: the cluster numerals on the home cover are underlined; the same discs on `/globe/` are
not.** The link underline leaks into the disc label. Underlines on a count read as noise and make the two globes look like
two products.
Fix: `text-decoration: none` on the cover pin label, with mono 600 `--surface` on `--ink` as in components 7.2 (16.06 light,
13.83 dark).
Evidence: `mine/GLB/home-1440-light.png`, `home-390-light.png`, against `mine/GLB/world-390-light.png`.

### TRP1

**M5. TRP1, the limits chip on a day row (`DayRow`, `timeline.css`): the chip runs out of the card.** Dolomites Day 4,
Funbob: "Minimum age 3 · Under 8 with an adult · alone fro..." passes the card's right edge at 1024 and is cut at 390. This
is the exact item R4-T4 was about, and the rule that matters most to a family (T4) is the one cut.
Fix: components 2.8 says that on a day row a limits chip "takes the full row width instead". Give `.limits` chips on day rows
`max-width: 100%` and let them wrap at the " · " joins (one value per line when needed), never `overflow: visible`. Keep the
lock glyph on the first line.
Evidence: `mine/TRP/dolomites-day4-1024-light.png`, `dolomites-day4-390-light.png`.

**M6. TRP1, Switzerland overview (`SeasonBand.tsx`, the depth notice): the season is said three times and there are two
banners.** The stats card says "Valid for: Season not set yet". Below it, "THIS PLAN IS VALID FOR" holds a notice banner
about the missing months. A second, wider notice says "This plan has not been converted to days yet". The "Overview only"
chip already sits on the cover. R4-T3 asked for the season once.
Fix: when `depth === 'overview'` and there is no season, drop the "This plan is valid for" section and render one notice
banner, full column width, under the stats card: "Overview only. No days and no season are written down yet, so check the
season yourself before you pick dates." Keep the stats cell. Ruling Q-TRP-2 below.
Evidence: `mine/TRP/switzerland-1440-dark-t0.png`, `switzerland-390-light-t0.png`.

**M7. TRP1, `.tl-mappill` (`TripPlan.tsx`, `timeline.css`): on a phone the map pill covers what the visitor is reading.**
It now waits for Day 1 as asked, but once shown it sits over the time column and the item title. On Dolomites Day 4 it
hides "Funbob, Monte Baranci" and its glyph; on Rockies Day 3 it hides the distance line.
Fix: move Map into the sticky day strip as its last cell, pinned at the right end and outside the scrolling numbers: map
icon plus "Map" in `--t-tab`, 44 px, `aria-controls="route"`. Remove the floating pill. The strip is already the way to
move between days (P3), and a control that lives there covers nothing. Ruling Q-TRP-1.
Evidence: `mine/TRP/dolomites-day4-390-light.png`, `rockies-pill2-390-dark.png`.

**M8. TRP1, `web/lib/public/trips.ts`: `GALLERY_COVER = new Set(['patagonia-feb-mar-2027'])` hard-codes a trip slug in
code.** The cover choice is content. Acceptance 3 of the brief ("no new literal caught by the hard-coding scan") and P9 (the
store serves the same model later) both fail.
Fix: carry it as data on the trip, for example `cover: { from: 'gallery', index: 0 }` in the trip's hub or meta record, and
read that field. Leave no slug in code. The visible result, the Fitz Roy cover, is right and stays.
Evidence: the diff; the visible result in `mine/TRP/patagonia-top-390-light.png`.

**M9. TRP1, the route map on a day whose stops are all unplaced (`TripPlan.tsx` map day model): the map looks empty and
says nothing about it.** Patagonia Day 2 now reads "2 stops not on the map" (good), but the map still frames the whole of
Patagonia with other days' dots and nothing picked.
Fix: when a day has no placed stop, fit to the day's base when the base has a point, with the base sign picked, and label
it "Map: Day 2, Ushuaia. 2 stops are not on the map, so the base is shown". When the base has no point, keep the whole-trip
view and say "Day 2 has no stops on the map". Ruling Q-TRP-3.
Evidence: `mine/TRP/patagonia-day2-1440-light.png`.

**M10. TRP1, `data/schedules/canadian-rockies-2029.json`: step 7 is not in the branch.** There is no Day 6 time-zone marker
(Mount Robson) and no Day 9 canoe last-rental pin. R1 checklist row 11 asks the owner to read the Day 6 inference, so R1
cannot run without it.
Fix: add both markers from the research already held, flagged as inference, or report them deferred with the reason in the
hand-back so the coordinator can strike row 11.
Evidence: `git -C v2-TRP1 diff --stat main...HEAD` lists no file under `data/schedules/`.

### LST2a

**M11. LST2a, `WhereMenu.tsx` `.where-back` and `.where-title`: the back row is set as a heading in amber.** The phone
drill-down's back control is Big Shoulders 24 (`--t-card`) in `--accent-text`, so it reads as a title, not as a way back.
Level 0's title "Where" is the same size in `--ink`, so the header changes colour by level. `--accent-text` is reserved for
the live count, the leave-by number and active filter text (tokens 3); it is not for navigation.
Fix: the header is one 44 px row. Levels 1 and 2 get a ghost icon button (chevronLeft, `--ink-2`, `aria-label="Back to
countries"` or "Back to provinces"), then the level title in `--t-row` 21 `--ink` ("Canada", "Alberta"). Level 0 shows the
title "Where" in the same `--t-row` 21 `--ink`, with no button. This matches the spec's "< Canada" wireframe (nearby 4.4) at
a weight that reads as navigation. Ruling Q-LST-1.
Evidence: `LST2/where-drill1-390-light.png`, `where-drill2-390-dark.png`, `sheet-where-390-light.png`, `where-drill0-390-light.png`.

**M12. LST2a, `.where-mark` in `filters.css`: the Where menu draws its own option marks.** Its radio is a circle with a
check glyph, and its checked box is an amber outline. Kind and Season draw the foundation marks, so two pills in one bar
look like two products (consistency, P4).
Fix: use the foundation marks from components 2.5. A checkbox is 20 px, radius 4, 1.5 px `--line-2`; checked, it is a
`--ink` fill with a `--surface` check. A radio is a 20 px circle with a 10 px `--ink` dot. Reuse the same option component
FacetMenu uses rather than a parallel `.where-mark`. The selected row may keep its `--accent-soft` well with `--accent-text`
text (5.56 light, 7.26 dark).
Evidence: `LST2/where-alberta-1440-light.png`, `where-alberta-1440-dark.png`.

**M13. LST2a, the empty state for a lone Kind chip (`EmptyState.tsx`, the count line): "0 of 0 food".** The denominator
is the scope after the Kind filter, so it reads as if the catalogue were empty. The title "No food here yet" also uses a
kind label as a noun.
Fix: when the result is 0, the count line reads "No places" with the chip row under it. "of N" appears only when N is the
unfiltered total (359). The title becomes "No food places here yet", built from the noun the descriptor already has. Keep
the "Show all 359 places" primary button: it is right.
Evidence: `LST2/lone-kind-390-dark.png`.

### PLC2a

**M14. PLC2a, `trailFacts.ts` and `glanceHtml`: on a phone the 15-tile strip is about 1,200 px tall.** Each tile repeats a
two- or three-line provenance ("official information · read 18 Oct 2026"), so the strip runs to about 1.5 screens before
"Before you go". P6 puts provenance one step away, and the tile already links to its row, where the provenance is.
Fix: at every width, the tile shows the label, the value and any honesty chip ("2 values", "Not checked yet"), with no
provenance line. Add one line under the strip: "Read 18 to 19 Oct 2026. Sources are in each section." On a phone, an odd
last tile (AllTrails) spans both columns. That brings the strip to about 560 px at 390. Ruling Q-PLC-1.
Evidence: `PLC2/fenland-loop-390-light-t0.png`, `tre-cime-390-dark-t0.png`.

**M15. PLC2a, `trailFacts.ts` hazard slot: "Hazards listed above" points the wrong way.** The strip sits above "Before
you go", so the hazards are below it. A parent who scrolls up finds nothing.
Fix: replace it with the count and the first hazard, linked to `#warnings`: "Mosquitoes" when there is one, "Mosquitoes
+2" when there are more. Combined with exposure, it reads "No exposure · Mosquitoes".
Evidence: `PLC2/fenland-loop-1440-light-t0.png`, `tre-cime-390-dark-t0.png`.

**M16. PLC2a, `trailFacts.ts` "Trailhead and parking": the tile says "Not checked yet" while the page holds a parking
value.** Fenland's How to get there shows "Parking: Townsite lot (Our research, read 12 Oct 2026)". The owner's honesty
rule works both ways: a gap is never a yes, and a value we hold is never shown as a gap.
Fix: the slot reads, in order, `access_points`, `starts_at`, the trailhead name, and then the parking row or
`place.access.parking[0]`, before it falls back to the gap chip.
Evidence: `PLC2/fenland-loop-1440-light-t0.png` (tile) against `fenland-loop-1440-light-t1.png` (How to get there).

**M17. PLC2a, `Sections.tsx` Glance: the AllTrails tile is patched into the HTML with a regex, and it does not look like a
link.** `html.replace(/(<a href="https:\/\/www\.alltrails\.com...` breaks the day `glanceHtml` changes its markup. The tile
shows "Open on AllTrails" as a bold serif value, with no underline and no outbound glyph, so it reads as a fact.
Fix (the clean version asked for): add `external?: { url: string; label: string }` to `GlanceSlotHtml`. In `glanceHtml`,
an external slot renders
`<a class="ga ga-ext" href="…" target="_blank" rel="noopener noreferrer">` with the value underlined in `--ink`, a 13 px
external-arrow icon, and `<span class="sr-only"> (opens in a new tab, third-party site)</span>`. The label is "AllTrails ·
link only". Delete the regex. `trailStrip` sets `external` from `allTrailsLink()`, the one builder in `links.ts`.
Evidence: the diff; `PLC2/fenland-loop-1440-light-t0.png`.

**M18. PLC2a, the glance grid (`ps-glance` CSS): a short last row leaves bordered empty cells.** Ötzi has four tiles in a
three-column grid, so two blank cells with borders sit under them and read as missing data. Ruling Q-PLC-3.
Fix: the last tile spans the rest of its row: `.ps-glance .ga:last-child:nth-child(3n+1){grid-column:span 3}` and
`.ps-glance .ga:last-child:nth-child(3n+2){grid-column:span 2}` at three columns; `:nth-child(2n+1)` spans 2 at two
columns.
Evidence: `PLC2/otzi-1440-dark-t0.png`.

**M19. PLC2a, `PlacePage.tsx` cover actions: a place with no stored point has no primary action.** Fenland's cover shows
three secondary buttons and nothing primary. P7 names Directions or Save as a place's primary action.
Fix: no Directions button without a point (T5; ruling Q-PLC-4). In that case, "Save to a trip" takes the primary variant,
so the cover always has exactly one primary.
Evidence: `PLC2/fenland-loop-1440-light-t0.png`, `fenland-loop-390-light-t0.png`.

## Later rows

| # | Lane | Where | What, and the fix |
|---|---|---|---|
| L1 | GLB2a | `GlobeSearch` result line | "River · river" repeats the kind. When `where` equals the kind, show the countries the feature crosses or nothing |
| L2 | GLB2a | `CoverGlobe.tsx` | The cover's "246" merges Canada and the US, but the hint says "Tap a pin to open its country". Cluster by country on the cover, or say "open the area" |
| L3 | GLB2a | globe at rest after a fly | A pin can sit under the Map options pill (bottom-left, dark 1440). Add the pill's box to the left and bottom padding |
| L4 | GLB2a | Natural features off | River and sea labels stay drawn but cannot be picked. Acceptable with the M3 note; revisit if testers try to tap them |
| L5 | LST2a | `WhereMenu.tsx` find field | The placeholder says "province" for every country. Use `regionNoun()` ("Find a country, state or park" for the US) |
| L6 | LST2a | `PhoneFilterSheet.tsx` Where group | The summary reads "Where  Alberta 1", where the 1 looks like a count of places. Show "Where · Alberta" with no number |
| L7 | LST2a | Where, country column | Countries whose shards are not loaded under other filters show no count. Keep them blank (no new bulk load, P8 and P9) and add one muted footer line: "Counts for other countries appear when you pick one" |
| L8 | LST2a | count tween (`@property --count-n`) | `counter()` has no digit grouping, so at 10,000 (P1) "10000" draws on the way to "10,000". Group the final value, or skip the tween above 999 |
| L9 | LST2a | `filters.css` Where block | Literal 15.5px, 12.5px, 10px, 6px and 18px. Use the type and space tokens (`--t-note` size, `--s-*`) |
| L10 | LST2a | phone province level | It is single-pick and drills (as spec 4.4), while desktop is multi. Keep it. When a link carries two or more regions, the phone shows them checked, with the title "2 provinces" |
| L11 | LST2a | phone Where lists | The inner scroll has no cue. Add a 16 px `--surface` fade at the bottom edge |
| L12 | TRP1 | suitability chip wording | "Recommended: From about 3" and "From about 12" sit side by side. Drop "Recommended:"; the person glyph says advice |
| L13 | TRP1 | Day 4 header at 390 | The "1 warning" count shown in the header at 1024 is not in the header at 390 (the warning text still renders lower). Keep the count in the header at every width (P2 safety at rest) |
| L14 | TRP1 | overview trip end | No primary action when Copy is absent. Make Export the primary there (P7) |
| L15 | PLC2a | Ötzi glance | "EUR 13" in the glance, "€13" in the cover lede; "all year" in lower case. Use one currency style and sentence case |
| L16 | PLC2a | cover actions on a phone | Five buttons wrap to three rows, with Export's note between them. Put the note under the whole row |
| L17 | PLC2a | trail page | The strip repeats the Who it suits chips (stroller, wheelchair, effort) a few hundred px apart. Decide with S1 whether the chip row hides on trails |
| L18 | PLC2a | `links.ts` | `komootSearchUrl` is exported and unused. Use it or remove it |
| L19 | FIXF | home hero search | The hero field says "countries" and the panel says "areas". The panel opens at the top right, away from the hero field the visitor tapped. Use one placeholder; later, anchor the panel over the hero field at 1440 (P5) |
| L20 | SHL2 | Report a problem | Re-shoot footer and About with `reportUrl` set before the link goes on (Q70 repo) |
| L21 | process | TRP1 | 42e9757 (private history) edits `core/src/suitability/**`, `core/test/suitability/**` and `data/suitability/**`, outside TRP1's owned paths (`core/src/schedule/**` only). The coordinator accepts or re-homes it before merge |
| L22 | lists (pre-existing) | Places group heading | "Canada 48" is the page slice, not Canada's 178. Show "48 of 178" or the full count |
| L23 | foundation | tokens 2.2 | The Where selected row draws a `--muted` count on `--accent-soft`, which is not in the allowed-pairs table. It passes (6.10 light, 6.77 dark, AA). Add the row to tokens.md 2.2 and tokens.json in the next foundation edit |

## Consistency across lanes

| Job | Where it happens | Today | Ruling |
|---|---|---|---|
| Going back one level | globe crumb chip "< World"; Where drill "< Canada"; place breadcrumbs | The chip and breadcrumbs use mono `--ink`; Where uses Big Shoulders 24 in amber | One pattern: a chevron and the level name in ink. M11 |
| Choosing options in a filter | Kind and Season menus; Where menu | Different marks | Foundation 2.5 marks everywhere. M12 |
| Active filter state | pills, chips, phone summary | Where shows the pill "Where · Alberta" plus the chips "Canada", "Alberta"; Kind shows only its pill | As spec 4.4 says (one chip per level). Accepted |
| Empty and no-result states | list `EmptyBlock`; Where "No province matches…"; globe search | The list and Where explain and offer a way out; the globe with `nf=0` shows nothing | Every empty result says why and offers one action. M3 |
| Outbound links | AllTrails tile; Directions menu; globe card Wikipedia; Report a problem | Directions, Report and Wikipedia carry the sr-only note and look like links; AllTrails does not | Underline, external glyph, sr-only note. M17 |
| Directions | place cover; place rail card | Now the same chooser (Google Maps directions, Apple Maps) from one builder | Consistent. Keep |
| "Not checked yet" | strip tiles, section rows, Who it suits | The same dashed `--line-2` chip in `--muted` (6.94 light, 7.45 dark) | Consistent. Keep |
| Count discs on maps | home cover, globe page | Underlined on the cover | M4 |
| A floating control over content | trip map pill; globe feature card; globe attribution | Each covers what the visitor reads | No floating control over reading content on a phone. M1, M7 |
| Saying the season | trip cover stats, season band | Three times on an overview | Once. M6 |
| Counts in prose | list "116 of 178 places"; "0 of 0 food"; Where rows | Wrong denominator when empty | M13 |

## Rulings on the open questions

### SHL2

None asked. The header without Sign in is balanced at 1440 and 390 in both themes (`mine/SHL2/places-top-*`). With the
link off, the footer and About render nothing extra (`mine/SHL2/about-foot-*`). The `capabilities.signIn` and
`reportProblem()` seams are right for P9.

### GLB2a

- **Q-GLB-1. A phone feature card covering a long river (camera padding).** Do. Dock the card as the peek sheet and pad
  the camera by its height, the control column and the attribution. M1.
- **Q-GLB-2. "1" over "83" in the phone world view.** Do. Merge overlapping discs in screen space at the current zoom.
  M2. Do not solve it by nudging pins, because a nudged pin lies about where the place is (T5).
- **Q-GLB-3. The Natural features switch has no description line.** Do: "Rivers, seas, ranges and plains, in search and on
  tap". Also show the switch's effect where it bites, in search. M3.

### TRP1

- **Q-TRP-1. The map pill floats over the first rows at 390.** Do: move Map into the sticky day strip and remove the
  floating pill. M7.
- **Q-TRP-2. Two banners on the Switzerland overview: merge?** Yes. One notice banner, and no "valid for" section when
  there is no season. M6.
- **Q-TRP-3. A day with only unplaced stops looks empty.** Do: frame the base and say so, or say the day has no mapped
  stops. M9.
- **Q-TRP-4. "Minimum age N" wording.** Keep "Minimum age 3" on the rule chip (lock glyph, `--surface-2` fill, `--ink`:
  13.66 light, 12.24 dark). It repeats the operator's own words, and "No minimum age" on Ötzi uses the same form. Use
  "From about N" only for our advice. Drop the "Recommended:" prefix (L12).

### LST2a

- **Q-LST-1. The phone drill-down popover, and the weight of the amber back row.** Keep the drill-down popover. The back
  row is wrong: a ghost chevron plus a `--t-row` ink title. M11.
- **Q-LST-2. Where as a `<details>` group in the phone Filters sheet.** Keep. Open it when Where has a value, and drill
  inside it at the deepest chosen level, which the build already does. Fix the summary text (L6).
- **Q-LST-3. Countries not loaded show no count.** Later. Leave them blank rather than load shards to count them (P8, P9),
  and add the footer line (L7).
- **Q-LST-4. Checkbox on desktop, drill-down on phone.** Keep the difference: it is in spec 4.4, and on a phone one
  province is the common case. Use the same marks on both (M12), and handle two or more regions from a link (L10).

### PLC2a

- **Q-PLC-1. 15 tiles tall on a phone (the source line wraps).** Do: remove the per-tile provenance at every width and add
  one read-date line under the strip. M14.
- **Q-PLC-2. The AllTrails tile is patched by string replacement.** Do the clean version: an `external` slot type in
  `glanceHtml`. M17.
- **Q-PLC-3. The empty cell on the Bolzano (Ötzi) glance.** Do: the last tile spans the rest of its row. M18.
- **Q-PLC-4. Places without a point have no cover Directions button.** Correct as built. Directions start from our
  coordinates (T5), and the rail card already says "No point is stored yet". Make Save the primary in that case. M19.

### FIXF

Consistent with the foundation. The panel is clamped inside the viewport at 1440 and 390 from both buttons. It uses the
input focus treatment (2 px `--accent` plus the `--focus` ring, 6.38:1 on amber) and the surface menu box, and a second tap
closes it. Two later items are in L19.

## Colour pairs approved in this review

Every pair is AA or better. Ratios are WCAG 2.x, light then dark, computed from tokens.json values on 21 Oct 2026.

| Use | Pair | Light | Dark |
|---|---|---|---|
| Where selected row text | `--accent-text` on `--accent-soft` | 5.56 | 7.26 |
| Where selected row count | `--muted` on `--accent-soft` (not yet in tokens 2.2, L23) | 6.10 | 6.77 |
| Where option text, strip values, AllTrails link | `--ink` on `--surface` | 16.06 | 13.83 |
| Where unselected count, the "Not checked yet" chip, the switch note | `--muted` on `--surface` | 6.94 | 7.45 |
| Trip map control and pill (toast colours) | `--toast-ink` on `--toast-bg` | 14.85 | 15.28 |
| Rule chip "Minimum age 3" | `--ink` on `--surface-2` | 13.66 | 12.24 |
| Cover and globe count discs | `--surface` on `--ink` | 16.06 | 13.83 |
| Feature card kicker "RIVER" (existing) | `--accent-text` on `--surface` | 6.33 | 7.99 |
| Option marks and switch keyline (UI, 3:1) | `--line-2` on `--surface` | 3.67 | 3.42 |
| River and area line on the map (UI) | `--accent` over the 1 px casing, tokens 5.1 | per tokens 5.1 | per tokens 5.1 |

Not approved as a stand-alone indicator: `--accent` on `--surface` in light is 2.52:1. The Where menu's amber checkbox
border alone does not carry the selected state; M12 replaces it with the ink-filled mark.
