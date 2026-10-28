# STEP2-ERV: design review of the built edit mode (28 Oct 2026)

Reviewer: travel-design-reviewer, model Opus 5.5 (`claude-opus-5-5`). Review only, no code changed.
Scope: E1, E1B, E2, E3, E4, E5, E6, INT and UI1 as merged on `main` at 06822e9d, on `/t/<id>/?edit=1`.
Checked against: [README.md](README.md) sections 4 and 5, [edit-mode-spec.md](edit-mode-spec.md), foundation patterns 3.13,
components 8.x, [principles](../foundation/principles.md) P1 to P9, and the owner's requirement. That requirement is one
trip-details experience for copied and built trips, edited from the details page, where any stop of a day can be deleted
and more can be added, in the current app's design system.

## Method

- Production build (`next build`, then `next start`) with `NEXT_PUBLIC_TRIP_EDIT=1` and the decoy
  `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5`, on port 4931. The server was stopped by PID afterwards. The worktree had no
  image cache, so covers and day thumbnails show their empty placeholders; that is not a finding.
- Two device copies were seeded the way `web/tests/e2e/t-edit-flow.spec.ts` does it: `canadian-rockies-2029` (15 days, 2
  adults and a child of 10) and `dolomites-2027` (14 days, 2 adults and a child of 6).
- Every edit feature was walked with Playwright Chromium on the Metal GPU, at 2x, at 390, 768, 1280, 1440 and 1760, in
  light and dark. Dark mode was set with the site's own theme button. That made 263 shots in
  `/Users/nks/workspace/travel-wt/S2-ERV-shots/` (outside test-results, not committed). Tall pages were read in tiles, and
  every shot cited below was looked at.
- Measured, not estimated: target sizes, contrast of each colour pair actually rendered, the focus order, the live-region
  text, scroll position across Done and Back, and the JS budget (`pnpm budget:report`).
- The edit-mode e2e specs were run against the same server, one worker, Chromium only: 71 passed and 3 failed. The
  failures are ER-012 and ER-013.

Shot names below are relative to `S2-ERV-shots/`.

## Verdict

**GO for turning `tripEdit` on for the owner's own testing only. NO-GO for anyone else until ER-001 and ER-002 are fixed.**

The owner's requirement holds on the built page:
- One details page serves the copy in read and edit mode.
- Every row of every day has a `⋯` with Remove: our stops, places the person added, and the rows the rules made.
- Every day has "Add a place to Day n".
- One undo stack covers every change, and Done keeps the day in view.

The two must-fix rows do not lose data, so the owner can test with them. They do make a family's plan wrong without
saying so, which is why nobody else should get the flag first. Tell the owner about both before he tests.

## Findings

Severity: **must-fix** (blocks release beyond the owner), **should-fix** (fix in this step), **nice** (polish).

| ID | Severity | Surface | Viewport / theme | Finding | Evidence | Proposed fix | Owner package |
|---|---|---|---|---|---|---|---|
| ER-001 | must-fix | Fix warning's one fix; Move to day list; a moved stop's legs | all; seen at 1440 light, 390 dark | The day list and the warning's fix ignore how far a stop is from the day's base. We moved the Lake Louise Gondola from Day 10 to Day 9. Its Fix warning then offered **Move Lake Louise Gondola to Day 6**, and that is a Jasper day after Kinney Lake at Mount Robson. One click put it there with "Drive 10 min to Lake Louise Gondola" and "Drive 10 min Back to Jasper". The real drive is about 3 to 4 hours each way, and the map shows the dashed line across the 50 km scale. The warning cleared, so the day reads as fine. The Move to day list also marks Day 6 (Jasper) **Fits** with "-45 min driving ≈". The cause is the C2 default: a moved stop gets a 10-minute leg. A family following this would plan a gondola ride they cannot reach (P6, T5, the safety exception in P2). | `43-move-gondola-list-1440-light`, `45-fix-warning-1440-light`, `46-moved-row-1440-light`, `53-after-fix-1440-light`, `45-fix-warning-390-dark` | 1. Price every leg of a moved or added stop with the drive model (`modelDrive`; straight-line km times the road factor is enough until N2). Never fall back to a 10-minute figure. If no price exists, the leg reads "Drive time not known yet" and raises a Check warning. 2. The one fix only proposes days whose base is within `ADD_NEARBY_KM` of the stop, its original day first. If none qualifies, the fix is Remove. 3. Move to day rows add the distance from that day's base ("212 km from Jasper") and never say Fits beyond `ADD_PIN_FAR_KM`. | E5 (`useFix`), E1 (`moveFit`), C2 (drive pricing) |
| ER-002 | must-fix | Day header warnings | all; seen at 1440 and 390, light and dark | The same warning renders twice in two styles. E5's "To check: Day 9 is 10 h 25 away from base…" box sits above the older read-mode line "△ Day 9 is 10 h 25 away from base…", and the meta row adds "△ 2 warnings". After a version change, Dolomites Day 4 shows two To fix rows, "5 to check · Show", a "Not suited to age 6 (1 stop)" line, a boxed "Not suited to age 6" notice and three more triangle lines: nine warning lines in four styles. That breaks EA8 ("Check warnings collapse to one line") and P3: the first view stops being readable at a glance. | `45-fix-warning-1440-light`, `18-daymenu-1440-dark`, `73-dolo-settings-shorter-1440-light`, `75-dolo-after-party-1440-light` | On `/t/` (read and edit), the timeline's own day notices leave out every code that `WARN_LEVEL` grades. They are shown only by `DayWarnings`. The meta-row "n warnings" becomes a link to that block. The suitability box is merged into the To fix row of the same stop. | E5, with the timeline owner for the notice list |
| ER-003 | should-fix | Warning wording | all | "Day 9 is 10 h 25 away from base, over 10 h for a standard family day" reads as a distance, not as how long the day is. | `45-fix-warning-390-dark`, `24-after-add-390-light` | "Day 9 is 10 h 25 from leaving the base to getting back; a standard family day is 10 h." Change it in the check's message, so the public page gets the fix too. | C1 / core checks, E5 |
| ER-004 | should-fix | Add picker rows | all; seen at 390 and 768 | "Day full: try Day 6" uses `--crit`, the Fix colour, on nearly every nearby row, while Add stays live and adds the place anyway (Jasper was added to a "full" Day 5). The red reads as "not allowed" and conflicts with the two-level rule (11.1): red means a rule fails. | `21-picker-390-light`, `21-picker-768-dark`, `23-picker-added-390-light` | Make `add-fit[data-fit=full]` use `--warn`, with the Tight chip's words. Keep `--crit` for a Fix-level reason ("Closed on Thursdays"). | E3 |
| ER-005 | should-fix | Add picker groups | all | The group "From the other versions of this day" never appears. The plan model emits no `variant` candidates for any day of either trip, although Rockies has versions A, B and C on every day. "Elsewhere on this trip, near here" is empty for Rockies too: every day there has only `nearby` candidates. Only Removed, Maybe, Within 30 km and Search results show. | `40-picker-groups-1440-light`; the plan-model API counts by group | Emit `variant` and `trip` candidates in `addByDay` from the plan model, and add a test that a day with versions yields group 1. | E3 with the plan-model owner (T1 / M) |
| ER-006 | should-fix | Phone bottom sheets (item sheet, day menu, Trip actions, Settings, Changes) | 390, both themes | The sheet header carries Expand and Collapse chevrons right above the item sheet's **Move up** and **Move down** chevrons. They look the same and do different things. They are also 30 x 30 px, and so is Close, under the 44 px minimum (components 5.5, WCAG 2.5.8). | `10-stopmenu-390-light`, `18-daymenu-390-light`, `29-tripmenu-390-dark`; target probe: `.sheet-bottom-frame button` min 30 x 30 | Action sheets drop the snap buttons (the grab bar and swipe stay). Other sheets give them a 44 px hit area and an unambiguous glyph. Close is 44 px everywhere. | UI1 (shared `BottomSheet`) |
| ER-007 | should-fix | Item sheet (phone) | 390 | The sheet opens at half height. The title is in display type and wraps to three lines, so **Open place page** and **Remove from Day n** sit below the fold. The destructive row and the way out are hidden on first view (P3). | `10-stopmenu-390-light`, `62-stops-actions-390-dark` | Size action sheets to their content, up to 90% of the height. Use the title style (`--t-title`), not display. | UI1, E1 |
| ER-008 | should-fix | Toast with a sheet open; toast stack | 390, both themes | With the item sheet open, the Undo toast covers the sheet's bottom rows, including the Remove line. Two toasts stack to about 200 px and cover the day being edited. | `17-toast-over-sheet-390-light`, `16-removed-toast-390-light`, `76-focus-handle-390-dark` | On a phone, show one toast at a time: the newest replaces the older, whose Undo stays in the edit bar. With a sheet open, the toast sits above the sheet's top edge, not over its rows. | UI1 |
| ER-009 | should-fix | Plan bar "Edit" link | 390 (worst), all widths | The plan bar's accent "Edit" (it opens the party editor) is still shown in edit mode. At 390 it is the only word beside "Canadian Rockies", so it reads as "Edit trip" while the person is already editing. Its target is 63 x 28 px. | `03-edit-day1-390-light`, `02-edit-top-1440-light` | On `/t/`, hide it in edit mode (Settings owns Who is going), or label it "Who is going". Make it 44 px high. | T1 / UI1 |
| ER-010 | should-fix | Day rail strip in the sticky bar | 768 | The strip of day numbers does not show the active day: it shows days 8 to 12 or 9 to 13 while Day 1 or Day 2 is active. A tablet user loses the "where am I" cue (P3). | `03-edit-day1-768-dark`, `10-stopmenu-768-dark` | Centre the active cell after the tools row wraps, and again on resize. The scroll offset is computed before the second line takes its width. | UI1 |
| ER-011 | should-fix | Focus order in a stop row | all | Tab order inside a row: map badge, title link, Why this time, `⋯`, then the drag handle. The handle is drawn first (the leading slot) but is reached last, after the next row's content has started (WCAG 2.4.3). | tab-order probe on Dolomites Day 2 (log in the run notes); `76-focus-handle-*` | Put the handle first in the DOM, so the order is handle, content, `⋯`. | E2 |
| ER-012 | should-fix | Keyboard drop | 1440 | `t-edit-keyboard` "Space lifts … Space drops" failed in the suite run: after the drop, focus was not on the moved stop's handle. It passed on the rerun and in the manual probe, so it is intermittent. Spec 16 says focus stays on the moved entry. | spec output, first run | Restore focus after the re-render settles (`requestAnimationFrame` after the layout commit), and assert it in the spec without a race. | E2 |
| ER-013 | should-fix | e2e suite | 390 | `t-edit-remove` "the edit bar replaces the public bar…" still expects the bar to hold [Settings, Done]. UI1 added Undo and Redo, so the suite is red on a passing product. | spec output | Expect four buttons: Undo, Redo, Settings, Done. | UI1 |
| ER-014 | should-fix | Settings footer | all | The Settings sheet's footer button is a filled **Done**: the same word and look as the page's Done, which leaves edit mode. One word has two meanings on one screen. | `27-settings-1440-light`, `27-settings-390-light` | Footer button "Close", secondary (the X stays). Or drop the footer: each control already applies with an Undo toast. | E4 |
| ER-015 | should-fix | Day headline after edits; emptied day | all | A day keeps our plan's headline after its stops are removed: Day 15 still reads "Troll Falls if the flight leaves after about 15:00" and "≈1 h 40 driving" with Troll Falls gone, and Day 3 still says "by way of Johnston Canyon". The emptied day reads "No stops are planned for this day yet." with no **Drop Day 15** (spec 6: "No stops on Day 4 · Add a place to Day 4 · Drop Day 4"). The day no longer reads as its own plan (P6). | `52-empty-day-1440-light`, `16-removed-toast-390-light` | When a day differs from our plan, show its headline muted, with "Our plan:" in front, and recompute the meta row from the edited timeline. Use the spec's empty-day line with both actions. | E1, E4 |
| ER-016 | should-fix | Version of Day n | 390, 1440 | Each version's consequence line ("Day 4 is 10 h 15 … over 10 h for a standard family day") is in `--crit`, but it is advice (Check level). Only the minimum-age line is a rule. | `20-version-390-light`, `71-dolo-version-1440-light` | Colour each line by `WARN_LEVEL`: Check in `--warn`, Fix in `--crit`. | E4 |
| ER-017 | should-fix | Stops tab and Export counts | 1440 | Four counts for one trip disagree: the tab says Stops 96, the categories add up to 96, the CSV row says "47 stops" and GPX "29 points". A family cannot tell which list is the trip. | `30-export-1440-light`, `49-stops-1440-light` | Name what each count holds: "47 stops on your days" in Export, and "96 places in this trip (stops and options)" on the tab, or count only places on the days. | E6 |
| ER-018 | nice | Print header | 1440 | The second header line reads "Planned for Family, 10 · Standard": internal profile words, not the party words used everywhere else. | `63-print-1440-light-t0` | Use `partyText`: "Planned for 2 adults · 1 child (10) · Standard pace". | E6 |
| ER-019 | nice | Settings labels | all | Label styles are mixed: DAYS, ADULTS and CHILDREN are mono caps, while Trip name, Starts, Who is going and Pace are sentence case. | `27-settings-*` | One label style (the field label of components 3.x) for every row. | E4 |
| ER-020 | nice | Changes line | 1440 Summary | "4 changes from our plan · Show" appears three times on the Summary view: the cover meta, a line above the tabs, and the Summary's Your changes cell. | `48-summary-1440-light-t0` | Keep the cover meta and the Summary cell. Show the line above Day 1 on Days only (spec 10). | E1 / T1 |
| ER-021 | nice | Trip actions menu | 1440, Mac | The shortcut hints read "Ctrl Z" and "Ctrl Shift Z" on a Mac. | `29-tripmenu-1440-light` | Show ⌘Z and ⇧⌘Z on Apple platforms. | E1 |
| ER-022 | nice | Sticky bar height | 1280 to 1760 | The two-line edit bar (UI1 ruling I12), the header and the tab row take about 280 px of a 900 px window at 1440 (31%). At 1760 the tools still take their own line with room to spare. | `03-edit-day1-1440-light`, `03-edit-day1-1760-dark` | From about 1600 px, put the tools on the rail's line when they fit (measure, do not use a breakpoint). Move the sync word to the cover meta. | UI1 |
| ER-023 | nice | Mode switch | 1440 | Entering edit mode adds the handle column, so the time rail moves about 23 px to the right. P5 and spec 1 say nothing moves when the mode changes. | `81-after-done-1440-light` against `03-edit-day1-1440-light` | Reserve the leading slot's width on `/t/` in read mode too. | E1 / E2 |
| ER-024 | nice | Add picker content | all | "Jasper" (a town) is offered as a place to add to a day based in Jasper, with "0.1 km SW". | `21-picker-390-light` | Leave out kinds town and base from the nearby group, or show them as "Explore Jasper" with no Add. | E3 |
| ER-025 | nice | Stops tab row actions | 390, 1440 | Stops tab rows offer Move up and Move down in a list sorted by category, where the day order is not visible. The spec asks for Add to Day n, Move to day… and Remove from the trip. | `62-stops-actions-1440-light` | On the Stops tab, leave out Move up and Move down. | E6 |
| ER-026 | nice | Side sheet width | 1440, 1760 | The Settings side sheet is 460 px, against 420 px in spec 8 and README 4.3. | `27-settings-1760-dark` | Keep 460 (one side-sheet width is simpler) and amend spec 8 and README 4.3 to 460. | planner (spec text) |

Counts: **2 must-fix, 15 should-fix, 9 nice.**

## What works (keep)

- **Any row can be removed, and Undo puts it back where it was.** That covers our stops, added places and the rows the
  rules made, such as the hire car, meals and rests. When the day still relies on the row, a one-line consequence shows,
  for example "The drive to Banff stays; nothing meets the car." The day re-flows: removing the hire car moved "Drop
  bags" from 12:30 to 11:30 (`14-rulemenu-390-light`, `15-rule-removed-390-light`).
- **Day-level actions.** Every day has "Add a place to Day n". The day menu gives Add a day after, Add a note, Version of
  Day n, Reset Day n (disabled with "Day 4 is already our plan") and Drop Day n last in the danger colour. Drop asks where
  the day's stops go (`18-daymenu-*`, `19-dropday-*`).
- **The changes sheet** uses the per-kind verbs of ruling C4: Remove it, Put it back, Remove note. Reset to our plan
  confirms above 3 changes, with Cancel first and Reset in the danger colour (`25-changes-1440-light`,
  `26-reset-confirm-1440-dark`).
- **Settings applies at once.** The Days stepper asks one question ("Day to drop … Drop Day 14 · no stops on it" with
  Cancel and Apply). A party change re-flows the copy and raises an Undo toast (`73-…`, `75-…`).
- **Done keeps the day.** After Done the URL keeps `#day-6`, Day 6 stays in view, and Back returns to edit mode at the
  same place.
- **Trip removal.** Remove from My trips lands on Mine with "Removed Dolomites from My trips · Undo".
- **Keyboard.** A keyboard lift is announced: "Lago di Braies, Day 2, position 2 of 2". The `1 to fix · Day 9` button
  scrolls to the day and focuses the fix.
- **Print.** Print uses the edited timelines under "Your copy of Canadian Rockies · Sat 8 Sep 2029 · 2 adults, 1 child".
- **Vocabulary follows README 5.** We checked Your copy, Edit trip, Done, Move to day…, Remove from Day n, Add to Maybe,
  Changes from our plan, To fix, To check and On this device. There are no emojis, no green, no purple: accent amber on
  navy and neutral surfaces only.

## Information design: does a day still read as a time-ordered plan after edits?

- **Yes for removals, adds and moves within a day.** Times re-flow and legs re-join their neighbours: Day 1 after the hire
  car went, and Day 5 after an add. The map's numbered order follows the timeline.
- **No for a stop moved to another day.** The 10-minute default leg of C2 makes the times after it fiction: Day 9 has the
  gondola at 15:40, and Day 6 has it at 12:40 after a "10 min" drive from Mount Robson. The only cue is the "≈" that
  every leg carries. This is ER-001, and it is the one place where the plan stops being chronologically honest.
- **The headline drifts.** The day headline and its meta row ("≈1 h 40 driving") stay our plan's after edits (ER-015).
  The warnings stack in four styles (ER-002), so on a heavily edited day the warnings outweigh the timeline.

## Measures (AA pairs approved)

Target sizes at 390 (measured):

| Control | Size |
|---|---|
| Handle | 28 x 44 |
| `⋯` on a row, `⋯` on a day | 44 x 44 |
| Add row | 336 x 44 |
| Edit bar buttons | 44 x 50 and up |
| Picker Add | 64 x 44 |
| Day menu and item sheet rows | 44 px high and up |
| Day rail cells | 44 x 36 (public bar, unchanged) |
| Sheet Expand, Collapse, Close | **30 x 30** (ER-006) |
| Plan bar Edit link | **63 x 28** (ER-009) |

Contrast, measured on the rendered page (text against the background actually behind it). Every pair passes AA:

| Pair | Light | Dark |
|---|---|---|
| Row `⋯` and the add row: `--ink-2` on `--surface` | 12.09 | 10.76 |
| Handle: `--muted` on `--surface` | 6.94 | 7.45 |
| To fix row: `--crit` on `--surface` | 6.61 | 7.01 |
| To check row: `--warn` on `--warn-soft` | 6.11 | 7.84 |
| `1 to fix` count: `--crit` on `--bg` | 6.11 | 7.75 |
| Changes count and plan bar Edit: `--accent-text` on `--bg` | 5.85 | 8.83 |
| Done: `--on-accent` on `--accent` | 6.96 | 6.96 |
| Toast text and Undo | 14.85 | 15.28 |
| Marks ("Moved from Day 10") | 12.09 | 10.76 |
| Move to day sub-line on hover (`--muted` on `--surface-2`) | 5.91 | 6.59 |
| Tight chip: `--warn` on `--warn-soft` | 6.11 | 7.84 |
| Picker distance line | 6.94 | 7.45 |
| Pressed Kids chip: `--accent-text` on `--accent-soft` | 5.56 | 7.26 |
| Remove row (`--crit`) | 6.61 | 7.01 |

JS budget (`pnpm budget:report` on this build): the heaviest public trip page is 193.8 KB start JS against the 200 KB
limit. The flag-off figure of 192.4 KB and `/t/` at 299.1 KB (limit 325) come from the integration pass, and we did not
re-measure them.

## Acceptance rows

| Row | Verdict | Evidence |
|---|---|---|
| EA1 every stop removable, Undo to the same place | **Pass** | `16-removed-toast-*`, `15-rule-removed-*`, `25-changes-1440-light`; `t-edit-remove`, `t-edit-flow` pass except the stale ER-013 |
| EA2 add row on every day; picker groups; re-flow | **Partial** | The add row is on all 15 days and an add re-flows the day (`24-after-add-390-light`). Removed, Maybe and nearby groups show (`40-picker-groups-1440-light`). The other-versions group never appears, and "Elsewhere on this trip" is empty on Rockies (ER-005) |
| EA3 Move to day, up and down by button at 390; long-press drag; body scrolls | **Pass** (Chromium) | `10-stopmenu-390-light`, `11-movetoday-390-light`; `t-edit-drag` passes in Chromium. WebKit touch emulation was not run in this review |
| EA4 keyboard lift, across days, drop, cancel, announced | **Partial** | Announcement measured. `t-edit-keyboard` 7 of 8; focus after drop is intermittent (ER-012); handle out of focus order (ER-011) |
| EA5 50 undo steps survive a reload; the 51st drops the oldest | **Pass** | `t-edit-undo` passes on this build; manual undo and redo walk in `t-edit-flow` |
| EA6 changes sheet, Reset Day n, Reset to our plan, confirm above 3 | **Pass** | `25-changes-*`, `26-reset-confirm-*`, `18-daymenu-*` (Reset disabled with its reason); `t-edit-days` passes |
| EA7 dates relabel; a shorter range asks; a party change re-flows a copy | **Partial** | The copy parts pass (`73-dolo-settings-shorter-1440-light`, `75-dolo-after-party-1440-light`). The built-trip Apply cannot be tested until STEP2-B2 |
| EA8 Fix at rest and counted; Check collapsed; nothing disabled | **Fail** | Fix at rest and counted: yes (`45-…`, `55-count-jump-settled-*`). Nothing disabled: yes. Check collapse is broken by duplicates (ER-002), and the one fix gives an impossible day (ER-001) |
| EA9 convert notice; From our trip; Undo restores | **Fail (not built)** | No engine action exists on a copy yet. `MakeItYours.tsx` leaves out "Where you start" until STEP2-B2 and B3. This does not block GO-2 for copies; it blocks GO-3 |
| EA12 `/trips/` start JS unchanged; `/t/` within budget | **Partial** | 193.8 KB with the flag on against 192.4 KB with it off: +1.4 KB, inside the limit but not "unchanged". `/t/` is 299.1 of 325 per the integration pass |

## Owner packages, by count

| Package | Rows |
|---|---|
| UI1 | 7: ER-006 to 010, 013, 022 |
| E1 | 6: ER-001, 007, 015, 020, 021, 023 |
| E3 | 3: ER-004, 005, 024 |
| E4 | 4: ER-014, 015, 016, 019 |
| E5 | 3: ER-001, 002, 003 |
| E2 | 3: ER-011, 012, 023 |
| E6 | 3: ER-017, 018, 025 |
| C2 and the plan model | 2: ER-001, 005 |
| T1 | 2: ER-009, 020 |
| planner | 1: ER-026 |

Some rows are listed under more than one package.

## Change log

| Date | Change |
|---|---|
| 2026-10-28 | Created (STEP2-ERV, travel-design-reviewer, Opus 5.5) |
