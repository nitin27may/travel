# Trip builder: design note and mocks for owner approval (TB-N)

Status: **design for approval, not built.** 27 Oct 2026, `travel-design-reviewer` (Opus). Task TB-N of
[features/trip-builder.md](../../features/trip-builder.md) 9.2, with the trip kinds of
[features/trip-kinds-and-interest-profile.md](../../features/trip-kinds-and-interest-profile.md) 1. It turns the planner's
wireframes ([wireframes-phone.md](wireframes-phone.md), [wireframes-desktop.md](wireframes-desktop.md),
[README.md](README.md)) into screens the owner approves before TB-W1 starts. Where this note and the wireframes differ,
**this note wins** (each difference is a finding in section 1). Principles by number from
[foundation/principles.md](../foundation/principles.md) (P1 to P9, T1 to T5).

The foundation additions A1 to A9 are written into [components.md](../foundation/components.md) 9 and the page template
into [patterns.md](../foundation/patterns.md) 3.12, both marked **proposed** until the owner approves. **No new token**:
every colour comes from `web/app/themes.css`; five text pairs that banners and selected tiles already used are added to
[tokens.md](../foundation/tokens.md) 2.2 with their ratios.

## 0. What the owner is asked to approve

1. The flow: **kind first**, then where (trip mode) or where from (near mode), then regions, discover and pick, days and
   pace, bases, build, getting there, review. Steps a kind does not need are shown done on desktop and not counted on a
   phone (section 2).
2. On a phone, the builder is a **focused flow**: its own step header and action bar replace the public header and bottom
   bar while `/plan/` is open (Q-TB-N1).
3. The look of each screen in the mocks (section 9), light and dark, at 390 and 320 px and 1440 px.
4. The ten owner questions in section 10.

Mocks are static images of a throwaway page built from `themes.css` and the self-hosted fonts in a scratch folder outside
the repository; it is not committed and no product HTML was added. Maps in the mocks are **schematic** (shapes drawn with the
map tokens, not tiles); the build uses the MapLibre map (components 7.1). Place names and counts follow the wireframes
(Italy 69 records in the north-east, Ontario thin); the party "2 adults · 1 child (8)" and the Toronto public hub are
illustrative, not household data and not a visitor's start point.

## 1. Review of the wireframes (findings, ranked)

Each finding names the screen, what is wrong, why it matters to a family planning or travelling, and the fix. Every fix
is already drawn in the mocks.

### Critical

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| C1 | P1, P1b, D1 (start) | No trip kind. Step 1 asks "Where" or offers "Travel from home instead"; the kinds spec (1.3, 1.7) makes "What kind of trip?" the first question and the kind sets mode, nights, drive limit and the review's primary action | A parent planning a Saturday out is sent through "Where do you want to go?" and a country field; the near mode hides behind a secondary link (P4, P7) | Step 1 is five kind tiles (Day trip, Weekend, Long weekend, A week, Longer holiday). Short kinds go to "Starting from / How far / Nights / When / Who"; Longer holiday to the country field; A week asks "Drive from home" or "Fly somewhere". Mocks `p01`, `p02`, `p03`, `d01` |
| C2 | P5, D4 (bases map) | Base **drive-time rings** ("60 and 90 min rings ≈") | A circle drawn at 60 min on a mountain map promises reach the roads do not give; a family books a base inside a ring that is really 1 h 40 away by road (T5: draw only what we hold) | No rings. Each pick is joined to its base by a dashed 1 px `--ink` spoke at 55% (3.52:1 light, 5.03:1 dark on `--map-land`); the minutes are in the list ("average 35 min ≈, longest 55 min ≈"). Mocks `p10`, `d04`. Q-TB-N3 |
| C3 | Every phone frame | Chrome stacks: public header 56 + step header 52 + tray peek + bottom action bar 64 + public bottom bar 84. On an 844 px phone that leaves about half the screen for the list | One-handed in a car park (T2, U9) the list shows two rows; the thumb lands on the public bar's Places instead of Next and leaves the flow | **Focused flow**: on `/plan/` under 640 px the step header (58 px, with Back, title, step count, theme and Close) replaces the public header, and the step's action bar (84 px with the home inset) replaces the public bottom bar. Close keeps the draft and returns to where the visitor came from. Mocks: every `p*`. Q-TB-N1 |
| C4 | P3 (pick control A2) | "Must see" is a **second tap** on the same "+" control | A hidden second state is found by accident: a parent taps twice to undo and marks a must instead; nothing on screen says which state it is in (P4: if a control needs explaining it is wrong) | The card's control has two states only, **Pick** and **Picked** (word plus glyph). **Must see** is a separate labelled toggle on each row of the tray (`aria-pressed`, star plus the words). Mocks `p05`, `p08`, `d03` |

### Important

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| I1 | P3 | Swipe right on a card to pick | Collides with the sideways pill row and with the browser's back swipe; picks happen by accident while scrolling with one hand (T2) | No swipe in v1; the Pick button is the one way on a phone (Q-TB-N4) |
| I2 | P1 "1 of 8", P1b "1 of 6", trip-kinds 1.3 "shown done" | The step count disagrees between frames and with TB1 | "Step 2 of 8" when three steps are skipped feels long and dishonest | **Phone counts only the steps that ask** (Day trip 4, Weekend and Long weekend 6, Week by car 6, trip mode 8); **desktop rail shows every step**, skipped ones done with their value ("Regions · within 3 h", "Getting there · the drive"). Mocks `p15`, `p20`, `d08`. Q-TB-N5 |
| I3 | D1 header | A fifth header tab "Plan" | The header holds four tabs at most (components 1.1) and the 90% come to read and copy (P7); a Plan tab promotes the 10% on every public page | No header tab in P1. Entry points are the extension points X7 (copy sheet), X8 (Home or Mine empty state) and the world map link. Q-TB-N2 |
| I4 | D3 to D7 | The primary action moves: bottom of the tray, bottom of the left pane, top right | On desktop the eye has to hunt for Next on every step (P3, P4) | One place: the **right end of the step rail**, sticky, naming the next step ("Next: Days and pace", "Build my days"). The step's secondary tools (Undo, Redo, Rebuild; Copy link, Calendar, PDF) sit just left of it. Mocks `d01` to `d08` |
| I5 | P3, D3 candidate rows | Reason chips lead ("Worth the journey" first), kids third | Components 2.8: the kids chip is the first chip on every surface; a parent scans for "fits" before "famous" (T4) | Order: **kids or fit chip, then safety and booking, then reasons** (draw, season, theme, distance). Phone: two chips plus one reason at rest; desktop: two reasons. Safety and booking never drop (P2 exception) |
| I6 | P6 day trip (not drawn) | A day trip renders as a base day; no leave-by, no home-by, no driving share | The day-trip question is "when do we leave and is the drive worth it" (kinds 2.3, short-trips K4) | Day trip build uses the Today **leave-by number** (`--t-leave`, `--accent-text`), "Home 17:00 · your home-by 19:30 · sunset", the drive-share line, and the caution banner `TK_DRIVE_SHARE` when driving exceeds time on site. Mock `p20` |
| I7 | All phone frames at 320 px | Measured on the mocks: the Pick word pushed the meta line to "Hike · 3 h 3…"; the lock chip beside a title ran off the screen; the bar's summary wrapped (mono never wraps) | 320 px phones lose the distance, the lock state and the summary | Under 360 px the card's Pick control is a 44 x 44 icon button (state by glyph and fill, the word kept for screen readers), the photo 56 px; the lock state is a chip in the chip row, never a right column on a phone; the bar's summary lines truncate with an ellipsis. Mocks `p05-320`, `p11-320` |
| I8 | P2, D2 region map | The map is the main way to read "how much we hold" | A shaded polygon is 1.31:1 (light) against land: the count cannot be read from the shade | The count is always text in the list ("69", "Thin: 3 places", "Not researched yet"); the map shade is a hint and the **selected** region uses the cased amber edge of tokens 5.1. Mocks `p04`, `d02` |

### Polish

| # | Screen | What is wrong | Fix |
|---|---|---|---|
| L1 | P3, P3m, P9 | "Next >" without a destination | Every Next names the step: "Next: Days", "Next: Getting there", "Build my days", "Show 9 places" |
| L2 | P3m, D3 maps | Unpicked candidates drawn as numbered discs | Unpicked: `--map-stop` 6 px dots; picked: 22 px `--ink` disc with a `--surface` check; the row pointed at: `--map-pin-pick` with the select ring. Numbers only on the built day's stops |
| L3 | P7, D6 | "Fares not shown [Search]" reads as an error | A dashed gap chip "Fares not shown" next to the secondary button "Search flights ↗" |
| L4 | P2 | Thin groups look like any other group | Meta line "Thin: 3 places"; empty regions "Not researched yet" gap chip, checkbox at 45%, "Ask us to research it" link |
| L5 | D5 | The drag insertion pill sat on the leg line in the first mock | 16 px above the next row, never over a leg (components 8.1) |

## 2. The flow, per kind

The kind is derived from the nights (kinds TK1); the tile only sets the default. Steps in brackets are shown done on the
desktop rail and not counted on a phone.

| Kind | Phone steps (count) | Desktop rail | Review primary (P7) |
|---|---|---|---|
| Day trip | Start · Discover · Your day · Review (4) | Start · [Regions: within 2 h] · Discover · [Nights: 0] · [Base: none] · Build · [Getting there: the drive] · Review | Add to calendar |
| Weekend, Long weekend | Start · Discover · Nights · Base · Build · Review (6) | Start · [Regions: within 3 h] · Discover · Nights · Base · Build · [Getting there: the drive] · Review | Add to calendar |
| A week, by car | as Weekend (6) | as Weekend | Save to Mine |
| A week by air, Longer holiday | Where · Regions · Discover · Days · Bases · Build · Getting there · Review (8) | all eight; Days and Bases share one screen | Save to Mine |

Rules: Back always returns to the previous **asking** step with its state; every done step on the desktop rail is a link
back to it (P3: the way back is visible); the URL key `s` names the step (trip-builder 2.5) so the browser Back button
does the same. Regions is skipped when the country has one group (trip-builder 2.1).

## 3. Screens

### 3.1 Start (step 1): kind, then where or where from

- **Phone `p01`.** "WHAT KIND OF TRIP?" (`--t-section`), one line of help, five stacked tiles (56 px minimum, radio,
  name in `--t-row`, mono meta). Selected tile: `--accent-soft` fill, 2 px `--accent` border, the radio filled `--ink`
  (the radio and the fill carry the state; the border alone is 2.52:1 on light `--surface`). Under the tiles: "Your
  drafts on this device" rows and the link "Start from one of our trips". Action bar: the kind and its nights, "Next:
  Start".
- **Phone `p02` (short kinds).** Starting from (select of public hubs and airports; "public hub" in mono), "Use my
  location (stays on this device)", "How far will you drive each way?" segmented 1 to 4 h, Nights stepper (2.12), "When?"
  pills (This weekend, Summer, Winter, Spring or autumn, Pick a month), "Who is going" with Edit (the device party,
  read through `readParty()`). The action bar is a **live count**: "9 places · within 3 h ≈ · summer" and "Show 9 places".
- **Phone `p03` (trip mode).** Country field (a region, park or town resolves to its country), a schematic country map
  shaded by our coverage, count chips, month, and the optional "Pin a town" (TB2).
- **Desktop `d01`.** One pane of 780 px: the five tiles in a row, Where and When side by side, Pin a town, our trips as
  three cards, drafts; the country map fills the rest.

### 3.2 Regions (step 2, trip mode)

- **Phone `p04`.** A 170 px map peek on top (tap a group to tick it), then the grouped list (A9): group rows 52 px with a
  checkbox, name (`--t-title`), the areas it holds as meta, the count right, a chevron that expands its regions (44 px
  rows, indented). Thin groups say "Thin: n places"; empty regions are 45% with the gap chip "Not researched yet" and
  "Ask us to research it" (TB9). Action bar "2 regions · 69 places", "Next: Discover".
- **Desktop `d02`.** List pane 460 px, map fluid; hovering a row outlines its region on the map, clicking a region ticks
  the row (P5 linked).

### 3.3 Discover and pick (step 3)

- **Phone `p05`.** Pills row (Filters (n), the active Looking-for and Kids pills, Month, Effort), then the count line:
  live count in `--accent-text` mono 600, the state in words, Clear all. Candidate rows (`cand`): 72 px photo, name,
  one mono meta line (kind · time on site · distance and direction), chips (kids first), and the Pick control (A2) on the
  right. A floating "Map" pill (44 px, `--ink` fill) swaps to the map sheet. The action bar is the **tray peek** (A4):
  "6 picked · Must see 1" / "about 5 days ≈ · 4 h 50 driving ≈", tap opens the tray sheet; "Next: Days".
- **Filters sheet `p06`.** Full-height bottom sheet: Looking for (activity pills with counts; zero counts at 45%, never
  hidden), Effort, Kids (Stepper and the live "Fits 29" chip), Month, Time on site; the honest line "Places that do not
  fit your party or are closed in July are listed at the end with the reason, not hidden"; footer Clear all and "Show 41
  places". The dock rules of components 2.7 apply.
- **Map sheet `p07`.** The map fills the screen; the list becomes a bottom sheet (A3) at half height: "41 places in
  view", a List pill, the selected row with a 2 px `--accent` left bar. Tapping a pin scrolls its row into view (P5).
- **Tray sheet `p08`.** "YOUR PICKS (6)", the estimate sentence, one row per pick: name, kind and time, **Must see**
  toggle (44 px, star and the words; pressed is the `--accent` fill with `--accent-ink`, 6.96:1), Remove (44 px).
- **Desktop `d03`.** Four panes: filters rail 232 px with checkbox facets and counts, the list 500 px (rows with the
  pick pill and "Why this?"), the map fluid (hovered row = amber pin with the select ring), the tray 300 px with Must see
  stars and "Drag a row here or press Space on a row".
- **Near mode `p15`, `d08`.** Same screen, sorted by drive, with band headings ("2 TO 3 H EACH WAY ≈"). A park with three
  or more members is one **park row** (kinds 2.5): drive, member counts, the day-permit window as a caution chip, "Show
  11 places" and "Pick the park". Thin supply says so with "Show 4 h (6 places)" and "Ask us for more" (TB9, Q60).
- **Interests.** The "Your interests" chip, quick picker and interests sheet belong to TK-N and are not drawn here; the
  pills row keeps a slot after Filters for that chip.

### 3.4 Days and pace (step 4) and bases (step 5)

- **Phone `p09`.** A count card "About 6 days" with the sentence it comes from (≈), Days stepper with "4 spare days",
  Pace and Moves segmented controls, Month, Who, and the notice "4 spare days: after the bases are set we suggest places
  near them. Nothing is added without your tap."
- **Phone `p10`.** Map peek with lettered bases (A7) and spokes; "WE SUGGEST 2 BASES · 1 MOVE"; a card per base: letter,
  name (`--t-card`), nights stepper, the numbers line, the **why** list (3 lines at most, each with a number or a source,
  trip-builder 4.9), "Swap town" and "Keep this base" (A8 lock for bases). "Other ways" rows with moves and driving a day
  and a Use button. Action bar "2 bases · 1 move · 1 h 25 driving a day ≈", "Build my days".
- **Desktop `d04`.** Steps 4 and 5 on one screen (wireframe D4, kept): settings top left, base cards and the Compare
  table below, the map right; changing days, pace or moves recomputes the suggestion in place, a locked base never moves.

### 3.5 Build (step 6)

- **Phone `p11`.** Day chips (A: 44 px cells with the day number in `--t-sign-s` and the base letter; current `--accent`),
  the day: sign, base letter, driving ≈; timeline entries (components 4.3: handle, time, title, meta, chips) with legs
  between; a locked item carries the chip "Locked to day 2" in its chip row (A8). **Did not fit** (A6) closes the list.
  The action bar holds Map (secondary) and "Next: Getting there". Every edit raises the Undo toast (5.3) above the bar.
- **Item sheet `p12`.** Tap a row: Move to day…, Swap with…, a switch "Locked to day 2", Details, then after a divider
  "Drop from the plan" in `--crit` (undoable, so no confirm, patterns 4.4). Reorder inside a day is a long press on the
  handle; across days only through "Move to day…" (WCAG 2.5.7).
- **Desktop `d05`.** The Plan grid: outline 256 px on `--well` (bases with letters, days with driving and caution
  triangles, Did not fit at the foot), the day document 640 px, the map fluid with the picked day's route amber over its
  casing and numbered stops. Rail tools: Undo, Redo, Rebuild. The drag shows the insertion line and pill "to Day 2 ·
  before 12:30 · +18 min driving ≈" (8.1). Keys as wireframes-desktop "Desktop interactions".
- **Day trip `p20`.** See I6: leave-by number, home and sunset, driving share, `TK_DRIVE_SHARE` caution banner, one day.

### 3.6 Getting there (step 7) and review (step 8)

- **Phone `p13`, desktop `d06`.** From (airport or public hub, kept on the device), then rows with a glyph: Fly into
  (nearest gateway to base A and alternates), Leave (same airport or open jaw with the saving ≈), Flights ("Fares not
  shown" gap chip and "Search flights ↗"), Car (pickup and the one-way fee note), Transit (only with a region note and
  its source, "Open in Google Maps ↗"). A notice says what changed: "Day 1 is now an arrival day…". The desktop map
  draws the gateway-to-base drive only; **flights are not drawn** (we hold no routes, T5).
- **Phone `p14` and `p21`, desktop `d07`.** Title (`--t-section` phone, `--t-trip` desktop), the meta line with the
  party words, four count cards (3.6), Book ahead rows, the actions with the kind's primary (Save to Mine for a week or
  longer, Add to calendar for short kinds), and the device notice "Saved on this phone only. Sign in to keep it on every
  device. The link carries the places, never who is going."

## 4. States

| State | What the visitor sees | Mock |
|---|---|---|
| Loading candidates | skeleton rows (6.2), the count line says "Counting…" | (as `p17` rows) |
| Building | a status card "Building your days · Working out drive times · 12 of 30" with a determinate bar (`--ink-2` on `--line`), skeleton days; the outline dims to 38%; Next is disabled until the build lands; "Your picks are saved on this device while we work" | `p17`, `d09` |
| Build failed | urgent banner (5.4) "We couldn't build your days." with the reason and Try again; the draft stays | `p18`, `d10` |
| Offline | dashed notice "You are offline. Saved 14:32…"; "Refresh routes" when back | `p18`, `d10` |
| Estimates only (ORS quota) | notice "Drive times are estimates ≈ today; we will refresh them." Every leg keeps ≈ | `p18`, `d10` |
| Paused (`PLAN_BUILDER_PAUSED`) | notice "Planning is paused for now. Your drafts are safe on this device…"; drafts open read-only; Next disabled; a link to Browse trips | `p19`, `d10` |
| No results | empty state (6.1) that names the filters, the nearest match as the primary ("Show Thrills for any age (3)"), "Suggest a place", and the "Not for your party (3)" list with the reason | `p16`, `d11` |
| No picks | tray empty state "Nothing picked yet · Pick places to see how many days they need"; Next disabled with the reason in the bar | `p16`, `d11` |
| Thin supply | notice with the true count and "Show 4 h (n places)", "Ask us for more" | `p15`, `d08` |
| Storage blocked | as Mine (patterns 3.8 item 7): the review leads with Copy link and Download | not drawn (same component) |

## 5. Components and patterns (what is new)

Written into the foundation as **proposed** (components 9, patterns 3.12):

| # | Component | Home (ISO-8) | Built from |
|---|---|---|---|
| A1 | Step header (phone) and step rail (desktop) | `web/components/ui/` (generic) | header tokens; page-tab underline (1.6) |
| A2 | Pick control | `web/components/plan/` | the active-filter look (2.7, 2.8) |
| A3 | Bottom sheet snap points (peek 120 as 5.5, half, full) and scroll handoff | `web/components/ui/` (generic, extends 5.5) | 5.5 |
| A4 | Action bar with the tray peek; tray column and tray sheet | `web/components/plan/` | 5.5, 3.2 rows |
| A5 | Reason chips and "Why this?" | `web/components/ui/` (generic) | chips 2.8, disclosure 6.4 |
| A6 | Did not fit block | `web/components/plan/` | caution well, secondary buttons |
| A7 | Base letter (list) and base pin (map), pick spokes | `web/components/plan/` | `--map-base`, `--map-stop` |
| A8 | Lock affordance (item and base) | `web/components/ui/` (generic) | chip, switch 2.5 |
| A9 | Region chooser | `web/components/plan/` | checkbox 2.5, list rows 3.2, globe shape states 7.2 |
| new | Kind tile | `web/components/plan/` | radio 2.5, card |
| new | Day chips strip (phone) | `web/components/plan/` | day-strip cells (tokens 7 radius 8) |
| pattern | Focused flow on phones, primary in the rail on desktop | patterns 3.12 | |

## 6. Accessibility (beyond README 5)

- Step header: `<header>` with the step title as the page's `h1`; Back and Close are named ("Back to Regions", "Close
  planner, your draft is kept"); the progress segments are `aria-hidden`, the text "Step 3 of 8" carries the state.
- Step rail: `<nav aria-label="Planning steps">`, an ordered list; the current step `aria-current="step"`; done steps
  are links; steps not reached are text with "not reached yet" for screen readers.
- Pick: a `button` with `aria-pressed` and the constant name "Pick Lago di Braies"; Must see the same pattern in the tray.
- Live regions: the count line and the bar summary are polite; build progress is `role="status"`; a failed build is
  `role="alert"`.
- Every drag has a menu path (Move to day…, Swap with…) and keys; swipe is not used (I1).
- Under 360 px the Pick word is hidden visually only; the button keeps its name and state.
- Inputs are 16 px; targets 44 px on phones (pills 36 px with 44 px hit areas, as 2.7), 32 px on desktop.

## 7. Contrast of every pair the mocks use

WCAG 2.x, computed from the values in `web/app/themes.css` (light / dark). Text pairs already in tokens 2.2 are marked;
the five new rows are added there by this task.

| Pair | Where | Light | Dark |
|---|---|---|---|
| `--header-ink` on `--header` | step header title, icons | 14.82 | 17.49 |
| `--header-mute` on `--header` | "Step 3 of 8 · Italy" | 8.98 | 10.60 |
| `--ink` on `--surface` | names, rail current, lock chip | 16.06 | 13.83 |
| `--muted` on `--surface` | meta, rail steps not reached | 6.94 | 7.45 |
| `--muted` on `--bg` | count line state, captions | 6.42 | 8.23 |
| `--ink` on `--surface-2` | rail done disc, hovered row | 13.66 | 12.24 |
| `--surface` on `--ink` | rail current disc, base letter, picked pin check | 16.06 | 13.83 |
| `--accent-text` on `--bg` | live count, leave-by number | 5.85 | 8.83 |
| `--accent-text` on `--surface` | rail current underline (UI) | 6.33 | 7.99 |
| `--accent-text` on `--accent-soft` | Picked control, active pills | 5.56 | 7.26 |
| `--accent-ink` on `--accent` | primary buttons, Must see pressed, current day chip, picked base | 6.96 | 6.96 |
| **new** `--ink` on `--accent-soft` | selected kind tile name | 14.11 | 12.57 |
| **new** `--ink-2` on `--accent-soft` | selected kind tile meta | 10.62 | 9.77 |
| `--ok` on `--ok-soft` | "Fits age 8" | 6.85 | 7.56 |
| `--warn` on `--warn-soft` | caution chips, Did not fit reason | 6.11 | 7.84 |
| **new** `--ink` on `--warn-soft` | Did not fit name, caution banner text | 14.17 | 13.05 |
| `--crit` on `--surface` | "Drop from the plan" | 6.61 | 7.01 |
| **new** `--ink` on `--crit-soft` | failed-build banner text | 13.24 | 12.55 |
| `--crit` on `--crit-soft` | banner icon (and border, UI) | 5.45 | 6.36 |
| **new** `--ink` on `--info-soft` | notice banners | 13.24 | 12.74 |
| `--info` on `--info-soft` | notice icons | 5.91 | 7.61 |
| `--toast-ink` on `--toast-bg` | Undo toast, Map pill | 14.85 | 15.28 |
| UI: `--line-2` on `--surface` | pick, pills, steppers, tiles at rest | 3.67 | 3.42 |
| UI: `--accent` on `--surface` | selected tile and Picked borders | **2.52** (not relied on: the filled radio, the word and the check carry the state) | 6.54 |
| UI: dashed spoke `--ink` at 55% on `--map-land` | pick to base | 3.52 | 5.03 |
| UI: `--ink` base square on `--map-land` | base pin | 13.59 | 13.31 |
| UI: progress `--accent` on `--bg` | current segment (decorative; text carries it) | 2.33 | 7.22 |
| UI: region shade `--ink` 14% on `--map-land` | coverage hint (never the only carrier) | 1.31 | 1.49 |

## 8. Out of scope here

The interests chip, quick picker and sheet, presets and reason chips that come from the profile (TK-N); the world map
hook; the PDF of a draft; the signed-in "My plans" tab (its row is the Mine list row of patterns 3.8). The principles
page's "Not adopted: personalisation" line is left as is until Q-TK3 is answered.

## 9. Mock images

Folder: `/Users/nks/workspace/travel-wt/shots-TBN/` (not committed; 2x, light and dark, dark set by clicking the page's
theme control). Names are `<screen>-<width>-<theme>.png`.

| Screen | Phone 390 | Phone 320 | Desktop 1440 |
|---|---|---|---|
| Start: kind | `p01` | `p01` | `d01` |
| Start: near (weekend) | `p02` | | `d01` |
| Start: trip (country) | `p03` | | `d01` |
| Regions | `p04` | | `d02` |
| Discover | `p05` | `p05` | `d03` |
| Filters sheet | `p06` | | (rail in `d03`) |
| Map sheet | `p07` | | (pane in `d03`) |
| Tray | `p08` | | (column in `d03`) |
| Days and pace | `p09` | | `d04` |
| Bases | `p10` | `p10` | `d04` |
| Build | `p11` | `p11` | `d05` |
| Item actions | `p12` | | (row tools in `d05`) |
| Getting there | `p13` | | `d06` |
| Review, trip | `p14` | `p14` | `d07` |
| Near results, thin | `p15` | `p15` | `d08` |
| No results, no picks | `p16` | | `d11` |
| Building | `p17` | | `d09` |
| Error, offline, estimates | `p18` | | `d10` |
| Paused | `p19` | | `d10` |
| Day trip build | `p20` | | |
| Review, weekend | `p21` | | |

Reference shots of the live shell used to match the header and bottom bar: `shots-TBN/ref/`.

## 10. Owner questions (Q-TB-N1 to Q-TB-N10)

| ID | Question | Recommendation |
|---|---|---|
| Q-TB-N1 | On phones, should `/plan/` be a **focused flow** (its step header and action bar replace the public header and bottom bar; Close keeps the draft)? | **Yes.** It returns about 140 px to the list and keeps the thumb on Next (C3, T2). Trade-off: Trips, Places and Mine are one tap further (Close) while planning |
| Q-TB-N2 | No "Plan" tab in the header for P1; entry from Home, Mine's empty state, the copy sheet ("Start from this trip") and the world map? | **Yes.** Four tabs at most and the 90% first (P7). Revisit with usage data after P1 |
| Q-TB-N3 | Drop the base **drive-time rings**; show dashed spokes from each pick to its base and the minutes in the list? | **Yes.** Rings promise reach we have not routed (T5). If you want an area later, it should be a routed isochrone, which needs ORS isochrone quota |
| Q-TB-N4 | Drop **swipe to pick** in v1? | **Yes.** The Pick button is always there; swipe conflicts with sideways scrolling and back swipe |
| Q-TB-N5 | Phone step count shows only the steps that ask (a day trip is 4 steps); the desktop rail shows all eight with skipped ones done? | **Yes.** Honest length on a phone, the whole shape on desktop (TB1 kept on desktop) |
| Q-TB-N6 | **Must see** as a separate toggle in the tray rather than a second tap on Pick? | **Yes** (C4) |
| Q-TB-N7 | Picked uses the active-filter look (amber well, amber border, the word "Picked" and a check) rather than an ink checkbox? | **Yes.** Picked is "selected", the meaning amber already has; on desktop rows the same pill keeps one control for both platforms |
| Q-TB-N8 | Step 1 asks the **kind first**, with no tile pre-selected on a first visit (one tap required)? | **Yes.** One tap sets mode, nights and drive limit; a silent default would send weekend planners to a country field |
| Q-TB-N9 | Keep days, pace and bases on **one screen on desktop** and two on phones (wireframe D4)? | **Yes.** The trade-off between days and moves is visible as it changes (P3) |
| Q-TB-N10 | The desktop primary action always at the **right end of the step rail** (sticky), not at the bottom of a pane? | **Yes** (I4) |

## Change log

- 2026-10-27: created (TB-N, travel-design-reviewer, Opus). Findings C1 to C4, I1 to I8, L1 to L5 on the wireframes;
  components 9 and patterns 3.12 proposed; tokens 2.2 gains five text pairs; specimen section "PLAN BUILDER"; changes
  row 33; mocks in `shots-TBN/`.
