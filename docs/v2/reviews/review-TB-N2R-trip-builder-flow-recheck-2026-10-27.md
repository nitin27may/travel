# Review TB-N2R: re-check of the revised Trip Builder frames

Status: design re-review, 27 Oct 2026, `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Reviewed: branch
`design/TB-FLOW` at 3f7cd314: [FLOW.md](../design/trip-builder/FLOW.md) section 12 and the frames it lists
([wireframes-phone.md](../design/trip-builder/wireframes-phone.md) F0, F1 weekend and air, F2n, F3, F3s, F4, E0, E1, E2,
E4, E5, E6, E7, F8, C2, C3, X1; [wireframes-desktop.md](../design/trip-builder/wireframes-desktop.md) W0, W3, W4, WE,
W8, WC), against my first review [review-TB-N2](review-TB-N2-trip-builder-flow-2026-10-27.md), the foundation
(principles P1 to P9, T1 to T5), [trip-scope-scenarios.md](../design/trip-scope-scenarios.md),
[keep-from-live-site.md](../design/keep-from-live-site.md) and
[product-direction-2026-10-18.md](../design/product-direction-2026-10-18.md).

**Verdict: approve for the owner.** All four must-fix items and all twelve should-fix items are resolved in FLOW and
the frames. No must-fix remains. One new should-fix (R1: the item sheet shows a lock switch that is off on an item
that will not move) and eight polish items can go straight into the TB-W1 and ED briefs; none needs the owner.

## 0. How this was checked

The frames were re-rendered as throwaway mocks from `web/app/themes.css` and the self-hosted fonts, with the TB-N2
generator updated to the revised wireframes (scratchpad, not committed). Each was shot at 2x, phone 390 x 844 and
desktop 1440 x 900, light and dark, with dark set by clicking the page's theme control, in Chromium from
`web/node_modules` with the Metal GPU flags. All 30 shots are in `web/test-results/shots/TBN2R/` (gitignored). The
owner set is committed in [design/trip-builder/shots-TBN2R/](../design/trip-builder/shots-TBN2R/):

| Shot | Frame | Shows |
|---|---|---|
| `p1-f1-weekend-start-390-light.png` | F1 weekend | step 1 of 3, the live count as a button (M3), the thin state, "Next: Pick" (L1) |
| `p2-f1-air-departure-airport-390-dark.png` | F1 by air | "Fly from Toronto Pearson (YYZ) · 35 min ≈ · Change" and the hire-car line (S2, S8) |
| `p3-f3-pick-reach-pill-390-light.png` | F3 | reach pill first (M3), "Stay here" only on the picked town, one collapsed near strip, Map in the bar (S7) |
| `p4-e0-just-built-390-light.png`, `p4-e0-just-built-390-dark.png` | E0 | the build lands in the editor: status line, bases and checks collapsed, Day 1 with the getting-there card, handles live, one bottom bar (M1, M4) |
| `p5-e1-editor-placed-by-you-390-dark.png` | E1 | "Locked to Day 2", "Placed by you · Day 2", the moved marker, the toast, one bar (M2, M4) |
| `p6-e2-item-sheet-as-specified-390-light.png` | E2 as written | Move to day first, Up and Down in one row (L8); the lock and placed conflict (R1) |
| `p7-e2-item-sheet-proposed-390-light.png` | E2 with R1 | one "Keep on Day 2" switch, on because the person placed it |
| `p8-c2-make-it-yours-390-light.png` | C2 | non-modal Make it yours card above Day 1, "Keep it as it is" (S3) |
| `p9-f8-review-undated-390-light.png` | F8, month only | state line "In Mine · on this phone", "by about 1 Jun ≈", primary Add dates (F-Q4 option B, S4, S5) |
| `d1-we-just-built-1440-light.png` | WE | just built on desktop: status and collapsed lines at the top of the outline, Day 1 card, one Settings button |
| `d2-wc-make-it-yours-1440-dark.png` | WC | the card inline above Day 1, no fifth column |
| `d3-w8-review-dated-1440-light.png` | W8, dated | "In your account", exact book-by dates, primary Add to calendar |

Measured on the shots:
- **E0.** Day 1 starts at 260 px (it was 415). The status, bases and checks lines take 132 px under the 64 px header.
- **E1.** The day gets 631 of 844 px, 75% (it was 570, 68%): header 64, day chips 65, one bar 84.
- **F3.** With the reach pill the pills wrap to two rows; the list starts at 192 px and gets 559 px (L-R3).

## 1. The first review's items

### Must-fix

| # | Resolved? | Evidence |
|---|---|---|
| M1 build lands in the editor | **Yes** | TF1, "The plan" section, E0, WE. No "Edit my plan" on the build; getting there is the Day 1 and last-day card, Change opens E7. Step counts 2, 3, 4, 4, 4, 4 (FLOW 2.1). `replaceState` to `/t/<id>/` (TF9, L9). Shot p4, d1 |
| M2 placed edits stay | **Yes in behaviour** | TF11, 7.1 (every move, reorder, add, swap and replace marks "Placed by you"), `edits[].placed` in TB-C2, the rebuild line "3 locked and 2 placed by you stay" (E5, E6), C5 names "from our trip". The item sheet shows it in a confusing way: R1 |
| M3 reach changeable on the phone | **Yes** | stage 1 count is a button (F1), first pill on stage 3 (F3), filter rail on desktop (W3). Shot p1, p3 |
| M4 one bottom bar | **Yes** | TF18: Settings · Review replaces the public bar; Undo in the toast and in ⋯ with Redo, Rebuild, Make it yours, Close plan. Shot p4, p5 |

### Should-fix

| # | Resolved? | Note |
|---|---|---|
| S1 two driving controls | Yes | "Longest drive from home, each way" and "Driving on a day out from your base, in total"; day-out driving only at 3 nights or more; Moves hidden for Day trip and Weekend (F2n, F4, W4) |
| S2 departure airport | Yes | F1, W0, with alternates and the corrected note |
| S3 non-modal copy card | Yes | C2, WC; "Change dates and who" dropped; one Settings button on desktop |
| S4 no save button | Yes | F-Q4 option B, F8, W8 |
| S5 book-by without dates | Yes | month only "by about … ≈ (for early July)"; "Add dates to see book-by dates"; lodging only with a sourced rule |
| S6 keyboard model | Yes | 7.1 follows components 8.1, 300 ms, letters scoped to plan rows, listed under `?`, can be turned off; `R` opens the Apply line |
| S7 near strip | Yes | one strip, collapsed, two-line rows, earlier strips in the tray, Map in the bar |
| S8 car-only disclosure | Yes | kind tiles "by car", F1 by air "We plan a hire car from the airport" |
| S9 suggestions obey fit and month | Yes | stage 3 and 4 rules, F3s note, TB-E1 scope |
| S10 identity per draft | Yes | TF19, `identity` in TB-C2 |
| S11 open jaw | Yes | stage 6 rules, E7 warning with "Reverse the bases", TB-E5 scope |
| S12 empty and error states | Yes | TF14, X1, below-estimate line, stale-ref and shared-link lines |

Polish L1 to L9, the accessibility gaps (focus after Remove, the reduced-motion "moved" marker, Undo in ⋯) and the
rainy-day chip (TF20) are all applied. The FLOW diagram is now blue-gray (L7).

## 2. New findings

### Should-fix (important)

| # | Screen | What is wrong | Why it matters to a family | Exact fix |
|---|---|---|---|---|
| R1 | E2 item sheet (shot p6); E1 and WE chips | A placed item and a locked item behave the same (both stay in their day: TF11, field map "placed and locked refs are in their day"), but the sheet shows **two controls**: "Let the plan move it" and a "Locked to Day 2" switch that is **off**. The day shows two chips with different styles for the same promise | A parent reads "Locked: off" and believes the plan may move the lake they just put on grandma's day, so they lock it again, or they tap "Let the plan move it" without knowing what changes. P4: if a control needs explaining, the control is wrong. T3: the state on screen must match what will happen | **One control, one word.** The sheet row is a switch "Keep on Day 2", **on** for both placed and locked items, with the reason under it: "On because you placed it. Turn off to let the plan move it." (shot p7). Turning it off is the `release` op; turning it on is `lock`. The day chip reads "Kept on Day 2" with the lock icon for both; the sheet and the screen-reader name carry the reason ("placed by you" or "locked"). The rebuild line keeps counting both: "5 kept stay" or, when both kinds exist, "3 locked and 2 placed by you stay". `edits[].placed` stays as the origin marker in TB-C2; no schema change. Update FLOW 7.1 (the Lock row), E1, E2, WE and the toast copy |

### Polish

| # | Screen | Fix |
|---|---|---|
| L-R1 | E1 toast (shot p5) | "Moved Lago di Braies to Day 2 and kept there · Undo" wraps to two lines at 390. Show "Moved to Day 2 · kept there" with Undo; the place name goes to the live region |
| L-R2 | Trip header sub-line at 390 (shots p4, p5) | "July · 2 adults, 1 child (6) · On this phone" truncates, so the sync word that F-Q4 relies on is the part lost. On phones the sub-line reads "July · On this phone"; the party is in Settings › Start and on Review |
| L-R3 | F3 pills (shot p3) | The reach pill pushes the pills to two rows, and the kids chip is no longer first (TB-N kept "kids chip first"). Keep one horizontally scrolling row with a fade edge, in the order Reach, Kids, Looking for, Month, Filters |
| L-R4 | F1 thin state (shot p1) | "Ask us for more" must be its own link (as in the shot's notice), never inside the count button: a link inside a button is a nested control that screen readers cannot reach |
| L-R5 | F1 and F3 weekend | F1 says "4 places within 3 h so far" (the measured Ontario count); F3 says "9 places" and lists 6. Use the measured 4 in F3, or mark F3's numbers as illustrative |
| L-R6 | F1 by air (shot p2) | "(July)(A month ▾)" shows the month twice. When a month is chosen, the chip reads "July ▾" and replaces "A month" |
| L-R7 | F8, W8 | "Edit my plan" as a secondary action contradicts M1 (the plan is always editable). Phone: drop it, Back returns to the plan. Desktop: "Back to the plan" (shot d3). F8 lists "Book ahead (3)" with two rows: list three, or add "Show 1 more" |
| L-R8 | F3s (wireframe indent) | The strip is indented 98 px under the photo, so names wrap ("Muskoka Heritage Place"). Indent 28 px on phones |

### Checks on the new states (no finding)

- **One bottom bar** (TF18): holds on E0, E1, E2 (sheet over it), C2 and Review (Link, PDF, Add dates). Trips and Places
  are one tap away through ⋯ › Close plan.
- **Reach pill**: changes the live count and opens the 1 to 8 h control with the counts at 3 h and 4 h (shot of F3 with
  the sheet: `web/test-results/shots/TBN2R/r03r-*`).
- **Just-built state**: status line announced once (`role="status"`), bases and checks expand in place, no "Edit my
  plan" anywhere on the build. Cold-build progress and "build failed" keep the draft (FLOW 7 states).
- **Make it yours**: non-modal, does not cover the trip, dismissible, then the first section of Settings and a ⋯ item.
  On a phone it pushes Day 1 to about 470 px on first open only, which is acceptable for a dismissible card.
- **F-Q4 option B copy**: "In Mine · on this phone" (signed out), "In your account" (signed in) as a plain state line,
  not a button; primary "Add dates" when undated, "Add to calendar" when dated; no "Keep" or "Save" anywhere.
- **Principles**: P3 now passes at the build (Day 1 in the first view); P4 passes except R1; P5 (Settings returns to
  the same day and scroll), P7 (copy is one tap shorter), P8 and P9 unchanged and passing. Scenario rules 1, 3 and 9
  pass. No green in any frame or mock.

## 3. Contrast of every pair the revised mocks use (WCAG 2.x, from `web/app/themes.css`)

All pass AA: text 4.5:1 or more, UI 3:1 or more.

| Pair | Where | Light | Dark |
|---|---|---|---|
| `--header-ink` on `--header` | step and trip header titles | 14.82 | 17.49 |
| `--header-mute` on `--header` | header sub-lines | 8.98 | 10.60 |
| `--ink` on `--surface` | rows, sheet rows | 16.06 | 13.83 |
| `--ink` on `--bg` | count card, getting-there card | 14.85 | 15.28 |
| `--ink-2` on `--surface` | chip text, secondary text | 12.09 | 10.76 |
| `--ink` on `--surface-2` | moved row | 13.66 | 12.24 |
| `--ink-2` on `--surface-2` | chip text on the moved row | 10.28 | 9.52 |
| `--muted` on `--surface-2` | meta on the moved row, "moved" marker | 5.91 | 6.59 |
| `--muted` on `--surface` | meta lines | 6.94 | 7.45 |
| `--muted` on `--bg` | captions | 6.42 | 8.23 |
| `--ink` on `--info-soft` | "Built 10 days" status line, notices | 13.24 | 12.74 |
| `--info` on `--info-soft` | notice icon | 5.91 | 7.61 |
| `--ink` on `--accent-soft` | Make it yours card text | 14.11 | 12.57 |
| `--ink-2` on `--accent-soft` | Make it yours card lead | 10.62 | 9.77 |
| `--accent-text` on `--accent-soft` | card heading, active pills, Picked | 5.56 | 7.26 |
| `--accent-text` on `--surface` | current day, book-by dates | 6.33 | 7.99 |
| `--accent-text` on `--bg` | live counts, book-by dates on Review | 5.85 | 8.83 |
| `--accent-ink` on `--accent` | primary buttons, current day chip, switch thumb | 6.96 | 6.96 |
| `--ok` on `--ok-soft` | "Fits age 6" (blue) | 6.85 | 7.56 |
| `--warn` on `--warn-soft` | warning chips | 6.11 | 7.84 |
| `--ink` on `--warn-soft` | warning banner text | 14.17 | 13.05 |
| `--crit` on `--surface` | "Remove from the plan" | 6.61 | 7.01 |
| `--toast-ink` on `--toast-bg` | Undo toast | 14.85 | 15.28 |
| UI: `--line-2` on `--surface` | pills, buttons, switches at rest, the dashed Placed chip | 3.67 | 3.42 |

Not approved as an indicator: `--accent` on `--surface` is 2.52:1 in light (6.54 dark). The Make it yours card border
uses it, which is fine because the card is named by its heading and the border is decoration. The foundation's switch
"on" track (components 2.5) also uses it; the thumb position and the `--accent-ink` thumb on `--accent` (6.96) carry
the state, so the mocks pass, but the foundation should state that the thumb, not the track colour, is the indicator.
That is a foundation follow-up, not a Trip Builder item; I did not change the foundation here.

## 4. Next

- The planner folds R1 and L-R1 to L-R8 into FLOW 7.1, E1, E2, WE, F1, F3, F8 and W8, or into the TB-W1 and ED briefs.
  No further design review of the flow is needed before the briefs; the ED build ends with the usual review.
- The TB-N foundation pass (patterns 3.12, 5.2, the focused-flow rule) still owes the TB-N2 changes, as listed in
  TB-N2 section 12.

## Change log

- 2026-10-27: created (TB-N2R, `travel-design-reviewer`, Opus 5.5).
