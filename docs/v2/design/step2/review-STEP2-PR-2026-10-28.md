# Design review: STEP2-PR, the edit-mode prototype of the trip details page

Status: **review** (28 Oct 2026, travel-design-reviewer, Opus 5.5). Subject: `docs/v2/prototypes/trip/` on `main` at
1f210c17 (merge of `step2/PR`, d7f13faa), entry `trip/frames.html`. Judged against [README.md](README.md) (consistency
matrix 4, vocabulary 5, rulings 6), [edit-mode-spec.md](edit-mode-spec.md) (sections 1 to 17, EA1 to EA14),
[build-plan.md](build-plan.md) STEP2-PR, the foundation (principles P1 to P9, tokens, components, patterns), the park-page
design and trip-builder FLOW, and the owner's answers Q-BE1, Q-BE3, Q-BE4, Q-BE5, Q-BE6.

**Verdict: not ready for G-S2.** The edit page itself is close: every stop on every day can be removed and put back,
every day has its add row, buttons come before drag, warnings come in two levels and never block, Undo is everywhere and
the words mostly match the vocabulary. What blocks owner approval is the click-through around it (Mine opens a second,
older trip page; Save to a trip lands nonsense rows), one P5 break on every edit frame (the title), one phone layout bug on
every edit frame (the fix pill over the tabs), and frames that do not show what they are named for. Seven must-fix items,
all inside the prototype except M1, which needs one scope line.

## How this was reviewed

- All 26 frames in `/Users/nks/workspace/travel-wt/S2-PR-shots/` were read at 390 light and 1440 dark, and frames 04, 07
  and 08 also at the other theme.
- The prototype was run on port 4391 (`python3 docs/v2/prototypes/serve.py 4391`) with Playwright from a `web/node_modules`.
  Chromium ran on Metal (`--use-gl=angle --use-angle=metal`) at 2x, at 390 (touch) and 1440. Dark mode was set with the
  page's own Theme button. These flows were clicked end to end:
  - park page, Save to a trip, each of the two trips, the add picker, add, remove, Undo, Move to day, Move up, Done, Back,
    Mine;
  - Mine, the row menu, Open;
  - builder stage 4, Build my days, the trip page, Back;
  - Copy our Dolomites trip;
  - the desktop stop menu, the day menu, Drop Day 3, the trip menu, Reset to our plan, Settings, the convert notice.
- New shots are in `/Users/nks/workspace/travel-wt/S2-PRR/web/test-results/shots/prr/` (gitignored).
- Not verified by hand: long-press drag on a real touch device, and the WebKit spec. The builder's `edit.spec.js` covers
  EA1 to EA6. Its builder hand-off test calls `render()` instead of clicking through stages 0 to 4.

## Must-fix (blocks G-S2)

| # | Frame / file | What is wrong | Why it matters to a family | Fix |
|---|---|---|---|---|
| M1 | Flow "Done -> Mine"; `planner/index.html`, `planner/trip.js`; shots `f3-1440-02-mine-menu.png`, `f3-1440-03-mine-open.png`, `f2-390-light-12-mine.png` | Mine's **Open** goes to `planner/trip.html`, a second trip details page. It has its own tabs (Overview, Itinerary, Checklist, Travellers, Costs), an "Edit plan" button and "Fix in builder" links. The row menu reads Rename · Duplicate · Share · Delete, with no **Edit**. Rows show "3 travellers" (not the party words), "In Mine" chips and one filled **Open** per row, plus a filled **+ New trip**. Navigation is "Home · Parks · **Mine** · Plan" on the trip page but "Home · Parks · **Trips** · Plan" on the park, Mine and builder pages | The owner's core ask is one trip details page and one edit experience. Clicking Done and then Mine lands on a different product with different words. The owner will judge the flow from that | Grant STEP2-PR a link line in `planner/index.html`: the row and Open go to `/trip/?id=<id>&view=day`, and the row menu reads Open · Edit · Add to calendar · Print · Change dates · Remove (README 5.2). Then label the rest of Mine on `frames.html` as "old prototype, rebuilt in STEP2-P2". In `trip/trip.js` line 126, rename the nav item to match the other prototypes, or change all three to one word in README 5 first. If the scope line is refused, take Mine out of the frames.html flow list and say why |
| M2 | Every edit frame: 04, 05, 14 to 20, 22 to 24 at both widths; `trip.js` cover | In edit mode the cover title stops being an 80 px display heading and becomes a boxed 20 px serif input. At 1440 the input runs 1,780 px wide, across the map column. The page shifts by about 40 px | P5 says nothing moves when the mode changes, and patterns 4.3 says inline edit uses "an input of the same size, no layout shift". A parent switching modes loses their place, and the trip stops looking like the trip | Keep the heading's display font, size and width. Make it editable in place: a dashed underline and a pencil icon, always visible on touch, and the input sized to the heading. Enter saves and Esc reverts. Also seed the title as "Dolomites", not "Dolomites · your copy": the kicker already says "Your copy · from our Dolomites trip" (Mine, Settings and the picker all repeat it) |
| M3 | Frame 09 (`add=moraine-lake` on `demo-copy`); flow park -> Save to a trip -> "Dolomites · your copy" (`f1-390-02-picker.png`, `f1-390-03-landed.png`) | Saving a Banff place to the Dolomites trip offers every Dolomites day with "Tight · fits after Ortisei · **+287 h 45 ≈**" or "Day full: try another day", each with an Add button. The trip picker lists the Dolomites copy first for a Canadian park | A family will believe the drive numbers. Offering an Italy day for a Canadian lake, with a chip that only says Tight, means the planner looks broken. The only right answer is a new trip | Gate the picker on distance. When the place is beyond the add radius of every base, show one line: "Moraine Lake is 8,100 km from this trip's bases." Offer **Start a new trip with Moraine Lake** and no day rows. An impossible leg is Fix level `W_NO_ROUTE`, never Tight. In the trip picker, sort trips by distance to the place, and give a far trip the line "Far from Moraine Lake". Re-shoot frame 09 on `demo-built` (Banff) |
| M4 | Frame 10 (`add=banff-national-park`); flow park -> Banff long weekend (`f2-390-light-02-after-add.png`) | Arriving with a park lists six members. Every one is already on the trip and every button reads **Move here**, to a day the picker never names (Day 1, from the header only). Banff gondola, already on Day 1, is offered "Move here" to Day 1. Pressing the first row moved Lake Louise to Day 1, and the day became "A full day: 9 h 25" | The owner's flow "park -> Save to a trip -> add" ends with nothing to add and a surprise move. That is the opposite of saving a park | Follow spec 7.4: the header reads "Add a place in Banff National Park". Members not on the trip come first, each with "Add to Day n" for its best-fitting day. Members already on the trip read "On Day 3" with no Move button on their own day. Add two members that are not on the trip to the demo data (Peyto Lake, Lake Minnewanka) so the frame shows the real case |
| M5 | 390 edit frames 04, 06, 15 to 20, 23, 24 and `f7-390-01-day7.png` | The "1 to fix" pill sits inside the tab row and covers it. "Bookings" is cut to "Book:" and Photos is off screen. The pill is a `<span>`, so tapping it does nothing | On a phone the tabs are the page's navigation. A cut label looks broken, and the most urgent fact on the page cannot be tapped | On phones, put the count on its own line under the tab bar, or as the first chip of the day rail, as a button that scrolls to the first day with a Fix warning ("1 to fix · Day 7"). Keep it in the sticky row at 1440, also as a button |
| M6 | Frames 13, 06 and 25 at 1440, 23 at 1440, 08 and 09 | The frames do not show their subject. Frame 13 "convert notice" is pixel-identical to frame 11, because the notice is below the fold. In frames 06 and 25 at 1440 the stop menu is opened by URL with no anchor and runs off the bottom, so **Remove from Day 2** is not visible. Frame 23 opens the Day 3 menu next to Day 1's stop. In 08 and 09 the page behind is at Day 1, not the day being added to. When clicked for real, the menus anchor correctly (`f6-1440-01-item-menu-real.png`) | The owner approves screens from this set (G-S2). A missing convert notice, or a hidden Remove, cannot be approved | In the frame harness: scroll the sheet to the notice for 13; for 06, 23 and 25, scroll the page to the target and open the menu from its trigger; for 08 and 09, scroll to the target day before opening the picker. Re-shoot all 104 |
| M7 | Frames 14, 26, 07 and the builder hand-off (`f5-390-02-landed.png`) | Wrong data on screen. The built Banff trip's Settings says **"Where: Dolomites (Dolomites)"** (frame 26). Just-built says "3 bases · Banff townsite 2 nights, Lake Louise village 1 night, Banff townsite 1 night": that is 4 nights on a Thu 5 to Sun 8 Aug trip (3 nights), and 2 places, not 3 bases. The built Dolomites trip says "Ortisei 5 nights" on 5 days. Move to day says Seceda to Day 7 (Cortina) is "+5 min driving" but to Day 6 (Cortina) is "+1 h 15" | The owner reads the numbers. One wrong region or night count makes every other figure suspect, especially drive times, which a family plans their day around | Fix the demo seed. The region comes from the trip. Nights = days − 1, summed per base, and a base that repeats is counted once ("2 bases · Banff townsite 3 nights, Lake Louise village 1 night" only if the dates allow it). Take the drive change in Move to day from the same leg model as the day card |

## Should-fix

| # | Frame / file | What is wrong | Fix |
|---|---|---|---|
| S1 | 04, 05, 14 to 22 (two filled **Done**); 13 and `f6-1440-06-convert-real.png` (filled **Continue** and **Apply** in one sheet); park picker (filled "Start a new trip"); Mine (a filled Open per row) | More than one filled button on the screen. README 4.1 says Done is "the only filled button while editing" | In edit mode, make the cover's button secondary (or hide it on desktop, where the sticky row holds Done). In Settings, make Apply secondary while the convert notice is open; Continue is the one primary. In the park picker the trip rows are the actions, so "Start a new trip" is a plain row. See spec contradiction C1 |
| S2 | Every toast (`f2-390-light-03` to `-11`, `f7-390-02-copy.png`) | At 390 the toast is about 200 px wide. Its text wraps to three lines with a dangling "·" before Undo, and it covers stop rows and the Prototype controls | Width min(100% − 32 px, 560 px), above the edit bar. Put the separator only between parts ("Moved Banff gondola to Day 2 · kept there"), with Undo as the button. Stack it above the controls |
| S3 | Live region after button moves (flow 2) | It announces "Moved Banff gondola to Day 2 · kept there" with no position. Spec 5 wants "Moved Seceda to Day 4, position 3 of 5" | Add the position and count to the live text for Move to day, Move up and Move down |
| S4 | URL handling: `trip.js` add hand-off; `builder.js` line 256 | `add=` stays in the URL after the picker opens (spec 7.4), so a reload or Back reopens it. Build my days uses `location.href`, so Back from the new trip returns to the builder's Kind stage, not where the builder was opened (spec 2.1, FLOW L9) | Remove `add` with `replaceState` once the picker opens. In `finishBuild`, use `location.replace(...)` |
| S5 | Frames 08 to 10 (add picker) | **Kids** is off although the party has a 6-year-old, and **Open in July** is off on a dated trip (spec 7.1 says both default to on). On a phone the search field takes focus and opens the keyboard over the list. "Day full: try another day" does not name the day (FLOW 7.1 has "try Day 6"). Rows repeat "On Day 5" and "also on Day 5". Arriving with a place lists days in order, not best fit first (7.4). "+0 min" appears | Default the chips from the party and dates, with `aria-pressed`. On touch, focus the sheet heading, not the field. Name the best other day. Drop the "also on Day n" tail. Sort by fit. Write "no extra driving" |
| S6 | Frame 14, `f5-390-02-landed.png` | The just-built line, "Built 5 days · 0 did not fit · 0 warnings", shows zeros and links to nothing | Omit zero parts ("Built 5 days · all fit"). Make "1 did not fit" and "1 to check" links to Did not fit and to the warning. Use the warning words of README 5.1 (C2) |
| S7 | `f2-390-light-03-after-close.png` ("A full day: 9 h 25 on the go"); frame 02 (Summary list) | Check-level warnings have no fix button (spec 11.1: "Every warning has one fix button"). The Summary's Check row has no level word. Only the Fix row has its icon and colour | Add the fix ("Move a stop to a lighter day"). Prefix rows with "To fix:" or "To check:" (P6, never colour alone) |
| S8 | Frame 24 | Dropping an empty Day 8 asks for confirmation. Foundation 4.4 says reversible actions never ask, and spec 6 asks only about stops or a booking. The frame also hides the real decision | Drop an empty day at once, with an Undo toast. Re-point frame 24 to Day 3 with its 2 stops (`f6-1440-03-drop-day3.png` shows that sheet, which is right) |
| S9 | Frames 11, 26 (Settings) | There is no way to change the trip's length, so EA7 ("a shorter range asks which day goes") cannot be clicked. The start date shows as "07/13/2027". **Apply** is live next to "Nothing to apply yet". "Use my travellers" shows while signed out. The built trip has no nights stepper and no Rebuild row in view | Add the length (nights stepper or end date) with the 9.2 questions. Keep the native picker but echo "Tue 13 Jul" beside it. Disable Apply until something changes. Hide Use my travellers when signed out. Add Rebuild for built trips |
| S10 | Frames 06, 23, 25 at 1440; `f6-1440-01-item-menu-real.png` | On desktop the stop and day menus are modal panels with a full-page scrim and 52 px bordered rows. Spec 5 and README 4.3 call for a menu (the `role="menu"` pattern of VariantMenu) | An anchored popover, no scrim, rows as menu items (38 px with a 44 px hit area, one hairline divider before Remove). Keep the bordered sheet for phones |
| S11 | 1440 edit frames | The map column reads "Day 1 on the map" while the page is scrolled to Days 2 and 3 (spec 1: "the map follows the open day") | Follow the day in view (IntersectionObserver on day cards), as `/trips/` does |
| S12 | Park trip picker (`f1-390-02-picker.png`) | Rows show ISO dates ("2027-07-13 · 10 days") and the duplicated title. "Save for later, no trip" is not in the vocabulary | Use "Tue 13 Jul – Thu 22 Jul · 10 days · 2 adults · 1 child (6)", the Mine row words. Rename to the favourites word of the park page, or add it to README 5 first |
| S13 | Frame 12 (Changes from our plan) | **Restore** on "Added Tre Cime … to Day 5" means remove, which a reader will not guess. "Note on Day 4" hides the note | Show the note text. For each row kind, either name the action or add one line under the title, "Restore puts our plan back for that change" (see C4) |
| S14 | Frames 19, 22 | "Not synced yet" (pending) shows the dashed "You are offline" banner at once. Spec 15 shows it only on the second failed attempt. "Not synced · Retry" (frame 20) is warn-coloured text, not a 44 px button | Show the banner only after the second failure. Make Retry a button |
| S15 | Builder home after Back (`f5-390-03-back.png`), builder step rail (`f3-1440-05-builder-step4.png`), Mine | "Your plans", "All plans in Mine", "Edit plan", and a step "6 Your plan · Not yet" after ruling R2 removed the plan screen | Out of this package's owned files: record it for STEP2-B1 and STEP2-P2, with the words "Your trips", "All trips in Mine" and "Edit trip", and a rail ending at Build my days |

## Nice-to-have

| # | Frame | Item | Fix |
|---|---|---|---|
| N1 | 06 | Move up and Move down are greyed out with no reason | Add a line: "Seceda is the only stop on Day 2" |
| N2 | 07 | Day 7 already has a Fix warning, but its Move to day row shows only "Fits" | Add "Day 7: 1 to fix" to the row's second line |
| N3 | 15 | The Make it yours card has a 2 px border, an ink heading and bordered buttons; components 9.11 has a 1 px `--accent` border, an `--accent-text` heading and text buttons | Match 9.11 |
| N4 | 05, phone rows | "Map: Banff townsite" and "Directions" wrap onto two lines, so each row grows by 40 px | Shorten the phone label to "Map", or let the action line wrap as one inline group |
| N5 | All | The theme control is the text "Theme" on the trip and park pages and a moon icon on Mine; the trip page nav marks no current item | One control across prototypes; `aria-current` on Mine when on `/trip/` |
| N6 | `frames.html` | "Our trip made yours (built mode)" heads the builder trip | "A trip you built (built mode)" |
| N7 | 08, 09 (1440) | The picker opens at about 460 px, not the specified 420 px | 420 px, so the map column stays partly visible |

## Spec contradictions found

| # | Where | Contradiction | Recommendation |
|---|---|---|---|
| C1 | edit-mode-spec 3 ("The cover's Edit trip becomes Done too", and Done is filled in the sticky row) against README 4.1 ("Done, the only filled button while editing") | The spec asks for two filled Done buttons | Amend spec 3: on desktop the cover button becomes a secondary "Done" (or hides) and the sticky row Done is the one primary. On a phone the edit bar Done is the primary and the cover button is secondary |
| C2 | README 5.2 builder hand-off "Built 10 days · 1 did not fit · **1 warning**" against README 5.1 ("Warnings: **To fix** and **To check**") | Two words for the same thing | "Built 10 days · 1 did not fit · 1 to check" |
| C3 | edit-mode-spec 5.1 ("Current day: listed first, disabled") | Listing the current day first breaks the day order a reader scans by. The prototype lists days in order, which reads better | Amend 5.1: days in order, the current day in place, disabled, with "Now on Day 2" |
| C4 | edit-mode-spec 10 (one verb, **Restore**, on every changes row) | Restore on an "Added" row means remove | Keep one verb with a header line, or per-kind verbs ("Remove", "Put back", "Move back to Day 8"); decide in README 5 |
| C5 | edit-mode-spec 7.4 (a park slug "opens the park's members group") | Silent on which day, and on members already on the trip | Add: "members not on the trip first, each with its best day; members on the trip show their day and no Move button on that day" |
| C6 | edit-mode-spec 2.1 lands on `?edit=1&built=1`; README 3 step 6 says `?edit=1` | Minor: both are right once `built=1` is removed after first paint | Note the removal in README 3 step 6 |

## Contrast of the colour pairs this prototype uses

The prototype's `themes.css` is identical to `web/app/themes.css` (diffed). No green and no purple: the accent is amber,
crit is brick red, and the identity bars are blue, amber, pink and yellow. WCAG AA needs 4.5:1 for text and 3:1 for
large text and UI parts. Approved pairs, light / dark:

| Pair | Use | Light | Dark |
|---|---|---|---|
| `--accent-ink` on `--accent` | filled buttons (Done, Apply, Edit trip) | 6.96 | 6.96 |
| `--accent-text` on `--bg` | links (Edit, Show, Map, Directions, Add a place to Day n) | 5.85 | 8.83 |
| `--accent-text` on `--surface` | links in cards and sheets | 6.33 | 7.99 |
| `--accent-text` on `--accent-soft` | Make it yours heading (9.11) | 5.56 | 7.26 |
| `--ink` on `--accent-soft` | Make it yours text, convert notice | 14.11 | 12.57 |
| `--crit` on `--surface` | Fix warning, Remove from Day n | 6.61 | 7.01 |
| `--crit` on `--bg` | "1 to fix" pill | 6.11 | 7.75 |
| white / `--on-crit-fill` on `--crit-fill` | Drop Day n, Reset (danger) | 5.70 | 5.70 |
| `--warn` on `--warn-soft` | Tight chip, Check banner | 6.11 | 7.84 |
| `--warn` on `--bg` | "Not synced · Retry" | 6.40 | 9.18 |
| `--muted` on `--surface` | meta lines, sync word | 6.94 | 7.45 |
| `--muted` on `--bg` | sync word on the cover | 6.42 | n/a |

Not approved as a boundary: `--line` on `--surface` is 1.35 (light) and 1.42 (dark), as used for the dashed "Add a place
to Day n" border and the row borders. They pass only because each control is named by its text. Keep it that way: never
let a border alone show a control.

## What works (keep it)

- Any stop can be removed (published, added or engine-placed), and Undo returns it to the same position. That is EA1, and
  it was clicked by hand on the built trip.
- The phone item sheet puts **Move to day…** first and Move up and Move down second (Q-BE3, R4). The Move to day sheet
  shows base, free time, driving change and Fits or Tight, and no day is blocked (Q-BE6). See
  `07-move-to-day-390-light.png`.
- A Fix warning appears at rest on its day header with one fix button ("Swap or remove it"). A Check warning is a soft
  line, and neither ever disables an edit (`f7-390-01-day7.png`).
- Each empty day reads "No stops on Day 8. Add a place to Day 8 · Drop Day 8".
- The Drop Day sheet with stops offers move to Day 2, Maybe, or remove, with the danger button naming the day
  (`f6-1440-03-drop-day3.png`).
- The trip menu holds Undo and Redo for phones (TF18). Reset to our plan confirms over three changes with Cancel first
  (R7).
- The convert notice is inline, not a dialog, and uses the vocabulary's exact sentence. The Settings foot reads "Kept in
  this browser. Sign in to keep it on every device." (EM8).
- Copy our trip opens the copy in edit mode with the Make it yours card and the toast "Copied Dolomites to My trips ·
  Undo" (spec 2.2).
- Marks are worded chips ("Added by you", "Moved by you", "Kept on Day 2") and never colour alone (P6).

## Screenshots to show the owner

Show these only after M2, M5 and M7 are fixed and re-shot; until then they are the best available, and each has its known
flaw listed.

| # | File | Shows | Known flaw until fixed |
|---|---|---|---|
| 1 | `/Users/nks/workspace/travel-wt/S2-PR-shots/01-read-copy-390-light.png` | read mode of a copy on a phone: kicker, Edit trip primary, changes line, day rail | "Photos" tab cut at the edge |
| 2 | `/Users/nks/workspace/travel-wt/S2-PRR/web/test-results/shots/prr/f7-390-01-day7.png` | edit mode on a phone: handles, ⋯, a Fix warning with its fix button, "Added by you", an emptied day, Settings · Done | M5 pill over the tabs |
| 3 | `/Users/nks/workspace/travel-wt/S2-PR-shots/07-move-to-day-390-light.png` | Move to day with base, free time, driving change, Fits and Tight | M7 drive figures |
| 4 | `/Users/nks/workspace/travel-wt/S2-PRR/web/test-results/shots/prr/f6-1440-01-item-menu-real.png` | the stop menu at 1440, dark, every action by button | S10 modal weight |
| 5 | `/Users/nks/workspace/travel-wt/S2-PR-shots/08-add-picker-1440-light.png` | Add a place to Day 7: other versions, elsewhere on this trip | S5 chips off; M2 title box |
| 6 | `/Users/nks/workspace/travel-wt/S2-PRR/web/test-results/shots/prr/f6-1440-03-drop-day3.png` | Drop Day 3 and where its 2 stops go | none |
| 7 | `/Users/nks/workspace/travel-wt/S2-PRR/web/test-results/shots/prr/f6-1440-06-convert-real.png` | the convert notice in Settings, dark | S1 two filled buttons |
| 8 | `/Users/nks/workspace/travel-wt/S2-PR-shots/15-make-it-yours-1440-light.png` | a copy with the Make it yours card, sticky row with Undo, Redo, 5 changes, Settings, Done | M2 title box, S1 two Done |

Do not show frames 09, 10, 13, 24 or 26 until they are fixed (M3, M4, M6, S8, M7). Do not show any Mine shot until M1.

## Principles cited

- P3: one changes line and one status line, each opening detail on demand.
- P4: no manual needed. Breached by the unnamed "Move here" day (M4) and by "Restore" on an added row (C4).
- P5: smooth, linked open and close. Breached by the title (M2), the map not following the day (S11), and the toast
  covering content (S2).
- P6: the right metadata at the right moment. Breached by "+287 h" and wrong nights (M3, M7) and by zero counts (S6).
- P7: the 90% goal. Mine must open this page (M1).
- P8 and P9: the picker and Move to day read only the trip's plan model and `near`. There is no new bulk load.

## Change log

| Date | Change |
|---|---|
| 2026-10-28 | Created (travel-design-reviewer, Opus 5.5, model `claude-opus-5-5`) |
