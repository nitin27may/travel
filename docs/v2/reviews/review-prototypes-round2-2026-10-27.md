# Review: clickable prototypes, round 2 (phase 3 of the fix plan)

Date: 27 Oct 2026. Reviewer: `travel-design-reviewer`, model Claude Opus 5.5. Branch `design/PROTO-FIX` at `44383529`
("planner deep links"), worktree `travel-wt/PLANSYNC`. Scope: the screens that changed in phase 1 and 2 of
[FIX-PLAN-2026-10-27.md](../prototypes/FIX-PLAN-2026-10-27.md), checked against [FLOW.md](../design/trip-builder/FLOW.md),
[park-page/README.md](../design/park-page/README.md) and [anatomy.md](../design/park-page/anatomy.md), the foundation
([principles P1 to P9, T1 to T5](../design/foundation/principles.md), tokens, components 5 and 8.1) and the product direction
(public site first, no green, families).

How it was checked: served with `serve.py` on port 4387, rendered with Playwright from `web/` (Chromium, Metal GPU flags) at
2x, 390 x 844 and 1440 x 900, light and dark through each app's own theme control (builder: the stage panel's Dark theme
switch; parks and planner: the header theme button). About 230 shots, every one read; tall pages read in tiles. Touch targets
measured from the DOM at 390. Contrast ratios computed from `prototypes/themes.css`. Owner shots (12) are in
[prototypes-round2-shots/](prototypes-round2-shots/). Working shots: `web/test-results/shots/proto-r2/` (not committed).
No console errors on any page in either theme.

## Verdict

| Area | Verdict |
|---|---|
| Builder | **Good progress, not done.** Long-press drag, the keyboard model, the request sheet, Surprise me for every country, the far-park card and real sun times all work and read well. Three must-fix items: the sunset chip understates a hazard, the 1440 editor has no visible Settings or Review, and the free-day links are 20 px targets. The map shows days but not their legs. |
| Parks | **Close.** Index, cards, pager, drive-sort groups, bottom bar, share sheet and the three new full pages render every section. Must-fix: phone targets are 30 to 38 px across the index and page, and the compact cover's photo label collides with the breadcrumb. The map view draws a list beside the map, which PN14 rules out for v1. |
| Planner | **Good, one bug that matters.** The diff sheet, the three date modes, Today with sun and an offline state, the Requests panel and the header chip all work. Must-fix: an overdue book-by date reads "-145 days from today" in a calm tone. |
| Consistency between the three apps | **Weak.** Three headers, three theme controls (one of which does not persist), three navigation sets, two date pickers for one date model, two sheet styles, letters as icons in Parks. A family moving from a park page to the builder to My trips sees three products. |
| Regressions | **None found from this round.** The squeezed item row (B-M4) and the desktop editor without Settings or Review (B-M2) are in code this round did not change; the Kootenay cover collision (P-M2) is new only because Kootenay is a new compact page. |

## Must-fix

| ID | Screen | What is wrong | Why it matters to a family | Exact fix |
|---|---|---|---|---|
| B-M1 | Builder editor, day with late hikes (`builder.js` item chips `.chip.warn` "Ends near sunset"; engine `sunWarn`) | Alpe di Siusi ends 18:30 and Seceda ends 21:45 against a 18:16 sunset; both chips read **"Ends near sunset"**. The truthful sentence ("ends 18:30, after sunset") sits in a warning box at the bottom of the day, below every stop. Shot 01 | A parent reads "near" as "fine if we hurry". Ending a hike or a lift ride after dark with a 6-year-old is exactly what P2's safety exception says must be visible at rest, and FLOW 7.1 says warnings sit on the day header | Two chip states: "Ends after sunset 18:16" (`--crit` text on `--crit-soft`, 5.45:1 light, 6.36:1 dark) when end > sunset; "Ends 15 min before sunset" (`--warn`) inside the 30-minute band. Move the day's warnings to the day header line (one line, "2 warnings · Show") with the one fix. An item that **starts** after sunset (Seceda 18:45) is "Starts after sunset", and the lift is flagged as closed |
| B-M2 | Builder editor at 1440 (`stage7()` desk branch returns `f:''`) | No visible Settings and no Review. Both live only in the ⋯ menu. Shot 02 | P7: the screen does not name its primary action. FLOW 7 says desktop has "one Settings button"; Review and prepare is the finish line. A desktop planner has no visible way forward | Desktop header right side: a secondary **Settings** button and the primary **Review** button (same labels as the phone bar), before ⋯. Keep ⋯ for Undo, Redo, Rebuild, Make it yours, Close plan |
| B-M3 | Builder free day (`.note` "Free day: nothing planned yet" with `button.lnk` Fill this day, Add a place, Remove this day) | Three underlined text buttons run together on one line with no separators, each 20 px tall; "Add a place" repeats the dashed "Add a place to Day 4" row right below. Shot 04 | Components 1 says 44 x 44 on touch. On a phone in a car, a thumb hits the wrong one; Remove this day is destructive (undoable, but surprising) | Replace the three links with two 44 px buttons in the note: **Fill this day** (secondary) and **Remove this day** (quiet, `--crit` text). Drop "Add a place" from the note; the dashed row below is that action. When `fillFree` has nothing for the day (Castle), hide Fill this day and say "Nothing we hold fits this day" |
| B-M4 | Builder item row with a park link at 390 (`.it` row, `parkLink()` `.parklnk`) | "Algonquin Provincial Park" link takes the right column, so "Lake of Two Rivers beach and trails" wraps one word per line and the Book ahead chip becomes a circle. Shot 03 | The day reads as broken; the booking deadline is unreadable on the device a family uses on the road | Put the park link on its own line under the duration (`display:block`, `--t-meta`), never in the title row; let the title take the full content width. Check at 320 |
| P-M1 | Parks index and park page at 390 (`.pills button`, view toggle, pager, `.req` "Details ▾", member card Save and Add to a trip, header Saved and Theme) | Measured: filter pills 34 px tall, view toggle 36, pager 38 x 38, Filters 30, Details 24, Save and Add to a trip 30, header buttons 36, search 38 | Components 1: 44 x 44 on touch. These are the controls a family uses with one hand at a trailhead (T2) | Phone: pills, toggle, pager, header buttons and member-card buttons at `min-height:44px`; "Details ▾" becomes a 44 px row button; desktop may stay 36 with a 44 hit area (components 1) |
| P-M2 | Park page, compact cover (Kootenay, Bruce Peninsula, Zion) (`park.js` cover `.band` "No photo in this prototype") | The band text overlaps the breadcrumb "British Columbia" at 390. Shot 08 | Text on text is unreadable and looks broken on the first screen of the page | Put the band at the bottom-right of the cover under the title block (or drop it: the "Placeholder data" tag already says so); never in the breadcrumb row |
| L-M1 | Planner trip Overview "Next to book" and My trips card "Next:" (Algonquin) | "Campsite at Lake of Two Rivers by Thu 4 Jun 2026 · **-145 days from today**"; the card shows "Next: ... by Thu 4 Jun" in normal ink. The Checks panel does say FIX | A missed booking window is the most expensive error in the product (T1, T3). A negative number in calm text hides it | Overdue book-by: "**Overdue** since Thu 4 Jun 2026 · check if it is still open" in `--crit` on the card, the chip and Next to book; never print a negative count. Also fix the demo seed so the Algonquin weekend's windows are not all in the past, or keep one overdue row on purpose and label it |

## Should-fix

### Builder

| ID | Screen | Issue | Fix |
|---|---|---|---|
| B-S1 | Item chips `.chip.keep` vs `.chip.warn` | "Placed by you" (`--accent-soft` #FBEFD9) and the sunset warning (`--warn-soft` #FBF0D6) are the same colour: **1.0:1** between the two fills; only the icon differs. Text pairs pass (5.56:1 and 6.11:1 light; 7.26:1 and 7.84:1 dark) | "Placed by you" and "Kept on Day n" become neutral chips (`--ink-2` on `--surface-2`, lock icon); amber stays for things that may stop the day |
| B-S2 | Map of your days, phone and 1440 (`mapOpts('plan')`) | Legs join only a day's own stops, so a one-stop day draws no line and the base square hides under the first pin. Day 3 and Day 5 Braies pins overlap and hide each other's number. Selecting "Day 3" does not dim other days | Each day's leg starts and ends at its base (and at the airport on Day 1 and the last day); the selected day draws full colour, other days use `--map-route-dim`; offset co-located pins or show "2" as a stacked count |
| B-S3 | Day header and Day 1 card | Dolomites Day 1 header says "10 min driving" under a card "2 h 45 to Ortisei"; Algonquin says "2 h 05 driving" under "drive 2 h 35 to Huntsville" plus a 1 h leg, and the far-park card says 3 h 05 | The day's driving total includes the getting-there leg; one number per trip for the same drive (T3) |
| B-S4 | Departure day card | "Return the car, then fly from 2 h 45 ≈ away" | "Drive 2 h 45 ≈ to VCE, return the car, fly home". Print the same on the print view (B-S11) |
| B-S5 | Swap for indoor (`rainswap:` row in the item sheet; sheet `swap`) | Offered on an item that is already indoors (Museum Gherdëina, "Local history, indoors"); the suggestion reads "+180 min ≈" with a "Fits" chip; it opens a second sheet over the item sheet | Hide the row for indoor items and when no indoor place fits; write the delta in the house format ("+3 h ≈ on this day" or "+45 min driving ≈"); replace the item sheet's content instead of stacking a sheet |
| B-S6 | Surprise me sheet | The 4 options sit below three control groups (first option at about y 690 of 844); the filled "Done" competes with each option's "Plan this" | Options first (top 3 visible), controls in one collapsed row above ("July · any distance · 2 interests ▾"); remove the filled Done (the close button exists), keep Shuffle as secondary |
| B-S7 | Convert notice (`convert` sheet) | A modal bottom sheet. FLOW C5 says an inline notice; FLOW L5 says no second dialog after a Settings Apply | Show it inline in the Apply line of the sheet that triggered it (Settings, Make it yours), with Continue and Cancel; a modal only when the trigger has no sheet (a drag) |
| B-S8 | Settings Apply line and editor notice | "Apply: 2 days · nothing is kept in place" reads as "everything is lost" | "Rebuild 2 days · nothing is locked or placed by you yet" (FLOW: "3 locked and 2 placed by you stay") |
| B-S9 | Editor top on phone after a settings change (Algonquin) | Far-park card, "Settings changed" notice, bases, checks and map lines stack above Day 1; Day 1's first stop starts below the fold | Far-park card and pending-settings notice merge into one card; collapse the far-park card to one line once the person chose "carry on" |
| B-S10 | Builder theme | The only theme control is in the prototype stage panel; the builder neither reads nor writes `travel:v1:theme`, so a dark Parks or Planner session opens the builder light | Read and write `travel:v1:theme` like the other two apps; put a theme item in the ⋯ menu |
| B-S11 | Print view (`#printview`) | Day 1 and the last day print without the flight and the 2 h 45 drive; no sunrise and sunset; free and departure days are bare words | Print the getting-there cards on Day 1 and the last day, the day's sunset, and the departure drive (T2, works in the field) |
| B-S12 | Banff trip mode stage 1 | Departure airport defaults to Billy Bishop (YTZ) because it is nearest by distance, not by service | Placeholder data, but the rule is the product's: the origin ladder (O4) ranks airports by scheduled service to the destination country, then distance. Record in `trip-origin-and-nearest-airport.md` if not already there |

### Parks

| ID | Screen | Issue | Fix |
|---|---|---|---|
| P-S1 | `/parks` Map view at 1440 | A list sits beside the map. PN14 and review S6 say no list-beside-map in v1. Pins use the trip day colours (blue, orange, rose, yellow), which mean nothing here and have no legend; Banff, Yoho and Kootenay pins overlap | Follow PN14 (map full width, the list stays the List view) or bring it to the owner as a PN14 change; one pin colour (`--map-pin`) with rank numbers, clustering when pins overlap (P1) |
| P-S2 | Park page rows (`.glyph` "T", "C"; banner `.ic` "i" and "!") | Letters stand in for icons; the builder and planner use SVG icons | Use the shared icon set (ticket, tent, info, alert) at 18 px `--muted` |
| P-S3 | Killarney Entry and bookings | "Campsite reservation" is a Book ahead row under Entry, while the state line says campground windows are under Where to stay | PN12: campground booking windows live only under Where to stay; Entry counts and links them |
| P-S4 | Park pages with every fact invented (Jasper, Yoho, Killarney) | A dashed "Placeholder" or "Placeholder URL" tag on nearly every row, plus a page banner; the tags dominate the page rhythm | Where the whole page is placeholder, the cover tag and the banner are enough; per-row tags only on pages that mix real and invented facts (Banff, Algonquin). Keep the grep test for the mixed pages |
| P-S5 | Basics only (Kootenay) | Two stacked explanation boxes ("Placeholder: ... not researched yet" and "Basics only") | One box: "Basics only: index facts and a short place list. Entry, safety, seasons, camping and getting there are not researched yet." |
| P-S6 | Member cards | Age chip reads "From about 5" | "Age 5 and up" (T4: the age reads as an age) |
| P-S7 | Glance at 390 and 1440 | "4 h 45" touches the Placeholder tag ("4 h 45(Placeholder") | 8 px gap before the tag |

### Planner

| ID | Screen | Issue | Fix |
|---|---|---|---|
| L-S1 | Travellers diff sheet | Opens the moment "Add infant" is tapped, before an age exists; removals read "Not for age 0"; base towns (Ortisei, Cortina) appear under Added; "Undo this change" is shown before anything was applied | Open the diff after the age is entered (or default an infant to "under 1"); reason text "Not suitable under 1 year"; leave bases out of Added; label the secondary **Keep the old plan** (the toast after Apply keeps Undo) |
| L-S2 | Date sheet | The toast from the previous action sits over the sheet's Cancel and Save for 6 s (shot 12); the three modes are radios here and chips in the builder ("A month ▾ · Dates… · Flexible") for one shared date model | Dismiss toasts when a sheet opens, or lift them above the sheet footer; one control for both apps: the builder's three chips, same labels ("Exact dates", "A month", "Flexible") |
| L-S3 | Trip Overview tiles | "4.3 h" driving and "$159" for an Italian trip | House format "4 h 18 ≈" (as the builder); EUR for a trip abroad, as the builder's Known costs |
| L-S4 | Today map | One pin in a large empty map on phones and desktop, no base, no leg | Fit to the base plus today's stops with padding; draw base to stop to base (same fix as B-S2) |
| L-S5 | Offline state | Header chip "Offline" and body chip "Offline · using the copy on this device" both show; the header chip squeezes the trip chip to "Dolom…" | Keep the body chip only on Today; header shows a 24 px icon with an accessible name |

### Cross-app

| ID | Issue | Fix |
|---|---|---|
| X-S1 | Three headers: Parks "TRIP PLANS · Saved · Theme" (text button), Planner chip and moon icon with no brand on phones, Builder trip header with no theme. Components 1 (phone header): brand, then Search, Sign in or Account, Theme, each 44 x 44 | One prototype header for Parks and Planner per components 1; the builder keeps the trip header inside a plan (TF18) but its ⋯ menu carries Theme |
| X-S2 | Navigation names differ: Parks desktop "Home, Parks, Trips, Plan", Parks phone bar "Home, Parks, Mine, Plan", Planner "My trips, Plan, Today", builder none | One set for the prototypes, matching navigation-and-mine: Home, Parks, Mine, Plan; Today stays the planner's trip bar |
| X-S3 | Two sheet styles: Parks centred sheet with a bordered square close button and a 1 px border; builder and planner bottom sheets with a bare X | One sheet (components 5): bottom sheet on phones, side sheet on desktop, bare 44 px X |
| X-S4 | The same seeded Dolomites trip shows "1 child (6)" in the builder and "1 child (9)" in the planner | Seed the party once through `shared/contract.js` |

## Polish

- Builder day chips show a base letter under each number ("1 A"); unexplained. Show it only with two or more bases, with a legend "A Ortisei · B Cortina".
- Status line prints zeros ("0 did not fit · 0 warnings"); FLOW's example omits zero counts.
- "Base: Huntsville · 1 nights"; "1 stops" in the desktop outline; "2 warning".
- Fill free days sheet shows "+170 min"; use "+2 h 50".
- Sub-line "Saved on this phone · just now · …" is cut; FLOW L-R2 reads "July · On this phone".
- Keyboard focus on a plan row draws the ring around the title only, inside the lifted card's outline; ring the whole row.
- Long-press drag shows the drop band on the day chips but no drag pill ("to Day 3 · before 11:30", components 8.1).
- Review bar at 390: "Add to calendar" wraps to two lines; shorten to "Calendar" with the icon, or two buttons plus ⋯.
- My trips: the secondary "Use a copy of one of our trips" sits above the primary "New trip"; swap them.
- Planner trip title in a permanent dashed box; show the dashed edit affordance on hover and focus only.
- Parks phone filter row cuts "Open in" at the edge with no fade; add the scroll fade the foundation uses for chip rows.
- "Prototype controls" pill covers content above the phone bottom bar in Parks and Planner; move it into the header or the footer.

## Accessibility summary

- **Contrast (approved pairs, computed):** light `--muted`/`--bg` 6.42:1, `--muted`/`--surface` 6.94:1, `--accent-ink`/`--accent` 6.96:1,
  `--accent-text`/`--bg` 5.85:1, `--info`/`--info-soft` 5.91:1, `--crit`/`--crit-soft` 5.45:1, `--ok`/`--ok-soft` 6.85:1,
  `--warn`/`--warn-soft` 6.11:1, `--accent-text`/`--accent-soft` 5.56:1, `--line-2`/`--surface` (control edge) 3.67:1,
  `--header-ink`/`--header` 14.82:1, focus ring `--focus`/`--bg` 14.85:1. Dark: `--muted`/`--surface` 7.45:1, `--muted`/`--bg` 8.23:1,
  `--accent-ink`/`--accent` 6.96:1, `--accent-text`/`--bg` 8.83:1, `--info`/`--info-soft` 7.61:1, `--crit`/`--crit-soft` 6.36:1,
  `--ok`/`--ok-soft` 7.56:1, `--warn`/`--warn-soft` 7.84:1, `--accent-text`/`--accent-soft` 7.26:1, `--line-2`/`--surface` 3.42:1,
  `--header-ink`/`--header` 17.49:1, `--focus`/`--bg` 15.28:1. All pass AA (text 4.5:1, controls 3:1).
- **Not approved:** `--accent` as a border on `--surface` (selected chips) is 2.52:1; the selected state also changes fill and text
  colour, so it is not the only cue, but the edge alone fails 3:1. The `.chip.keep` and `.chip.warn` fills are 1.0:1 apart (B-S1).
- **Targets:** builder Up and Down 34 px, map legend Day pills 34 px, free-day links 20 px, collapsed lines 42 px; Parks see P-M1;
  Planner "Change dates" 32 px, Today checkboxes 22 px without a padded hit area, maps buttons 36 px.
- **Focus:** every app has a visible `:focus-visible` ring; the header uses `--focus-in-header`. Focus returns to the opener after the
  share sheet and the switcher (spec-tested). **Motion:** all three stylesheets honour `prefers-reduced-motion`.
- **Palette:** no green anywhere; the map day colours are the identity set (blue, orange, rose, sky, vermillion, teal, yellow) on a dark
  casing.

## The builder agent's listed deviations: do they need FLOW or foundation changes?

| Deviation | Recommendation |
|---|---|
| FLOW C5 has no opt-in link | **Change FLOW.** Decision D1 of the fix plan already chose it. Add to C5: "Stops copied from our trip stay placed; a rebuild moves only what the planner placed. Under the notice, the link **Let the plan move places from our trip** (per copy, off by default) releases them." Add one clause to TF11 and the 7.1 Lock row so "placed from our trip" is a third reason a stop is kept. Apply B-S7 at the same time (inline, not a modal) |
| FLOW has no "Swap for indoor" row | **Change FLOW 7.1.** Add a row: "Swap for indoor (rain plan) · item sheet row, shown only for an outdoor stop when an indoor place fits · row menu · menu · `replacePick` with the `indoor` filter · that day · toast, Placed by you". It complements TF20's Rainy day chip (which adds), it does not replace it. Include B-S5's rules |
| Key `?` added | **No FLOW change** (7.1 already says the keys are listed under `?`). **Foundation change:** components 8.1 says Space drops; FLOW and the prototype use Enter. Align 8.1 to FLOW: Space lifts, arrows move, Left/Right or PageUp/PageDown move across days, **Enter drops**, Esc cancels, `?` lists the keys, single-letter keys only on a focused row and switchable (WCAG 2.1.4) |
| Phone long-press drops onto another day's chip | Not in the agent's list, but it **conflicts with FLOW 7.1** ("a phone never drags across days"). Recommendation: keep the prototype's behaviour (the day chips are large, explicit drop targets; Move to day… remains the single-pointer path WCAG 2.5.7 needs) and amend the FLOW rule to "a phone drags across days only onto the day chips; Move to day… is always present". Owner call |
| `--b-control` is a shorthand without a style | **Foundation change.** `tokens.json` `border.hairline`, `border.control` and `border.selected` lack `solid`, so `border: var(--b-control)` renders no border. Make them `1px solid var(--line)`, `1px solid var(--line-2)`, `2px solid var(--accent)`; leave `dashed` as is; regenerate `web/app/themes.css` with `tools/theme_tokens.py` and update `tokens.md`, `specimen.html` and `changes-from-preview.md` together |
| `--z-drawer` (25) below `--z-scrim` (30) | **Foundation change.** The order is right for non-modal sheets (components 5.1), but there is no layer for a **modal** sheet above its scrim, so Parks swapped the two tokens (`app.css` line 151) and the planner wraps both in one `--z-scrim` box. Add `--z-modal: 35` ("modal sheets and dialogs, above the scrim, below menus") to `tokens.json` and `tokens.md`; modal sheets use it, non-modal sheets keep `--z-drawer`; then remove the Parks swap |

## What is good and should stay

- Long-press lift with the dashed drop band on the day chips, the ghost and the "Moved ... kept there · Undo" toast; the keyboard model with live-region announcements and a `?` sheet that explains the switch.
- The far-park card: one sentence with the measured gap and two clear ways out ("Raise the reach to 4 h", "Make it a trip by air"), and it appears in the editor when the reach drops.
- Trip-mode deep link from a park: "Land at Calgary (YYC), nearest airport to Banff National Park" on stage 1.
- Sun times from `shared/sun.js` on Today (05:33 and 21:05 for Ortisei on 14 Jul 2027, Europe/Rome) and in the day warnings with real numbers.
- The Requests flow: honest copy ("We do not pad with places we have not researched"), the same status chips in the builder pick list and the planner panel.
- Parks: the drive-sort group "Drive time not set (6)" keeps unknowns visible (PN20 spirit), the pager keeps state in the URL, and the Seasons and closures section prints the read date (T3).
- The planner diff sheet structure (Moved, Added, Removed with counts, and "Kept where they are: 2 locked, 0 placed by you").

## Order of work

1. Must-fix B-M1 to B-M4, P-M1, P-M2, L-M1 (prototype only, about 3 h).
2. FLOW edits for C5, 7.1 (Swap for indoor, phone cross-day drop) and the foundation edits for border tokens, `--z-modal` and components 8.1, as one `travel-design-reviewer` foundation pass so the six foundation files stay consistent.
3. Should-fix in the order B-S1, B-S2 with L-S4 (one map fix), X-S1 to X-S3, then the rest.

## Shots named in this review

Files in `prototypes-round2-shots/` (2x, committed because this review names them):

- `01-builder-sunset-chips-390-light.png`
- `02-builder-editor-1440-light.png`
- `03-builder-item-row-squeezed-390-light.png`
- `04-builder-free-day-390-light.png`
- `05-builder-swap-for-indoor-390-light.png`
- `06-builder-surprise-me-390-light.png`
- `07-builder-convert-notice-390-light.png`
- `08-parks-kootenay-basics-390-light.png`
- `09-parks-map-view-1440-light.png`
- `10-planner-next-to-book-390-light.png`
- `11-planner-travellers-diff-390-dark.png`
- `12-planner-dates-sheet-390-light.png`
