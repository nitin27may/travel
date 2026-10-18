# Components (18 Oct 2026)

Every component in the foundation: anatomy, variants, sizes, states, motion, keyboard, screen reader,
touch, do and don't. Values are tokens from [tokens.md](tokens.md); the rendered set is
[specimen.html](specimen.html). Shared rules that apply to every interactive component:

- **States** every control has: default, hover, focus-visible, pressed, selected (where it can be),
  disabled, loading, error (inputs), empty (containers). Hover never changes layout. Pressed is a 1 px
  translate down or a darker fill, 120 ms. Disabled is 45% opacity plus `cursor: not-allowed`, never a
  colour swap that could pass for a state.
- **Focus** is the ring in tokens.md 8. Focus moves deliberately (into a sheet's heading, back to the
  opener on close) and is never lost to `body`.
- **Touch**: 44 x 44 px minimum, 8 px between targets; dense desktop rows are 36 px tall with a 44 px hit
  area via padding.
- **Motion**: durations and easings from tokens.md 11; reduced motion collapses to 120 ms fades.
- **Copy**: verbs on buttons, trip named in every form header, dates "Sat 31 Oct · in 13 days".
- **Urgency colour** on any due date, deadline or window follows tokens.md 3.1 and nothing else: `--crit`
  within 7 days (or a window opening within 48 h, or missed), `--warn` 8 to 30 days or a window open,
  `--muted` beyond. No component defines its own threshold.

## 1. Shell and navigation

### 1.1 App header and section tabs

Anatomy: brand (Big Shoulders 24, "TRIP PLANS"), section tabs, spacer, right cluster. 60 px, `--header`,
2 px `--accent` bottom rule, sticky, `--z-header`.

| Variant | Tabs | Right cluster |
|---|---|---|
| public (signed out) | Trips · Places · Globe | search icon (opens search, `/`), theme toggle, **Sign in** (ghost, header colours) |
| signed in | Home · Trips · Places · Globe | trip chip (switcher), bell with count badge, theme, avatar menu (People, Inbox, Settings, Sign out) |
| guest by link | Trips · Places · Globe | "Shared by Nitin · view only" info chip, Copy to my trips, Sign in |

Tabs: `--t-tab` (mono 13.5/500) `--header-mute`, 12 px side padding, full height; current tab `--header-ink`
600 with a 2 px `--header-ink` underline sitting on the amber rule. Hover: ink at 100%, no underline. Focus: header
ring. Keyboard: Tab to the tab list, arrows move, Enter opens; `aria-current="page"`. At tablet the tabs
stay; on phone the header is 56 px with brand and the right cluster only, tabs move to the bottom bar.
Do: keep four tabs or fewer. Don't: put trip tabs here.

### 1.2 Trip header (trip bar) and trip tabs

Anatomy: photo 56 x 40, radius 6, with the 4 px identity bar and keyline; name Big Shoulders 40 (one line,
truncate); meta mono 12.5 `--muted` one line (dates · nights · travellers); phase chip; countdown chip
(neutral); trip tabs; actions (Share, Offline as small secondary buttons). Height 88 px fixed, `--well`
background, 1 px `--line` bottom, sticky under the header, `--z-tripbar`.

Trip tabs: Plan · Today · Bookings · Tasks · Budget · Share, `--t-tab` `--muted`, with a mono 11.5
count after the label (14 days, 3/9, 1/12, 43%). Current: `--ink` 600, 3 px `--accent` underline
flush with the bar's bottom line. Hover: `--ink`. Today shows a `--accent` dot while a trip day is in
progress. Keyboard as 1.1. The bar never scrolls away and drawers open below it (review I3). At 200% text
it wraps to two rows (identity row, tabs row) and grows to 128 px. Phone: see 1.4.

Do: truncate the name before the bar wraps. Don't: hide tabs behind "More" on desktop.

### 1.3 Trip switcher and ⌘K

Trigger: the trip chip in the header (photo 34 px in the identity ring, name `--t-row` (Big Shoulders 21),
chevron; 42 px pill `--header-2`) or the photo in the phone bottom bar. ⌘K / Ctrl K opens the same menu with a
search field focused; typing filters trips, then tabs ("pata book" → Patagonia · Bookings), then places.

Menu: 440 px, `--surface`, radius 12, `--e-2`, `--z-menu`, scrim at 45%. Sections with cap labels: **In
progress · soonest first**, **Planning**, footer "switching keeps the tab you are on · Done (3) →". Row:
photo 52 x 38 in the identity ring, name `--t-row`, second line mono 11.5 (next deadline, coloured by
tokens.md 3.1: `--crit` inside 7 days or a window opening inside 48 h, `--warn` 8 to 30 days, else
`--muted`; on 18 Oct Elora is `--crit`, Patagonia `--warn`, Dolomites `--muted`), right slot: "✓ here" for the current trip or "Bookings →" (`--accent-text`) on hover
and focus naming the tab you will land on. Row height 56; hover `--surface-2`; selected row (keyboard)
`--surface-2` plus the focus ring.

Behaviour: picking keeps the current tab and restores that trip's last scroll and map day; a toast "Dolomites
stays on Bookings, Day 9 · Back" for 8 s; ⌘[ returns. Esc closes and returns focus to the chip. Phone: full
height bottom sheet with the same rows at 60 px, search field at the top above the keyboard.

Screen reader: `role="dialog"` named "Switch trip", listbox rows "Patagonia, 26 Feb, flight and lodging
by Sat 31 Oct, opens Bookings". Live region after a switch: "Now in Patagonia, Bookings".

### 1.4 Phone top bar and bottom bar

Top bar (trip screens): 64 px, photo 52 x 40 with keyline, name Big Shoulders 26 (one line), mono 11.5
sub-line (dates · in 268 days, or TODAY · Sat 24 Oct · day trip), a 38 px icon button "Switch trip" at the
right, 2 px identity rule at the bottom. Sticky. Outside a trip: title Big Shoulders 26 and the search icon.

Bottom bar: 84 px including a 26 px home-indicator inset, `--header`, 1 px `--header-line` top,
`--z-header`. Items 56 px wide minimum, icon 22 px, label mono 11.5 `--header-mute`; current item
`--header-ink` with the icon in `--accent`. Trip screens: **[trip photo] Plan · Today · Bookings · More**;
the photo is 28 px in a 2 px identity ring with keyline, label "Switch", first position (thumb reach, S8).
Outside a trip: Home · Trips · Places · Globe · Me (public: Trips · Places · Globe · Sign in). Badge on
Home/Me and on the header bell: 18 px `--crit-fill` disc, `--on-crit-fill` mono 11.5/600 count, when
something is urgent (tokens 3.1). The bar hides while a
bottom sheet is above half height and while the keyboard is open.

### 1.5 Breadcrumbs

Mono 12.5 `--muted`, " · " separators, current item `--ink`; used on place and trail pages (Places ·
Italy · Sesto Dolomites) and in the globe chip (World › Italy › South Tyrol). Each crumb is a link with a
36 px hit height. Collapses to the last two crumbs on phone with a leading "…" menu.

## 2. Controls

### 2.1 Buttons

| Variant | Fill | Border | Text | Use |
|---|---|---|---|---|
| primary | `--accent` | none | `--accent-ink` mono 13/600 | one per view: Plan a trip, Add a booking, Save to Patagonia, Copy to my trips, Navigate |
| secondary | transparent | 1 px `--line-2` | `--ink` mono 13/500 | everything else |
| ghost | transparent | none | `--ink` (or `--header-ink` in the header) | toolbars, header, inline actions |
| danger | `--crit-fill` | none | `--on-crit-fill` | Delete trip, Revoke link; always behind a confirm |
| icon | as secondary or ghost | | 17 px icon, `aria-label` required | theme, bell, switch, reverse sort |

Sizes: md 38 px (padding 0 14), sm 30 px (0 10, 12 px text), lg 50 px (phone primary actions in Today),
icon 38 x 38 (sm 30 x 30; hit area padded to 44 on touch). Radius 8. Icon-with-label gap 8.

States: hover secondary and ghost: border `--ink`, text `--ink`, background `--surface-2` at 60%;
hover primary: `--accent-hover` (5.96:1 with `--accent-ink`); pressed: translateY(1px); focus: ring;
disabled 45%; loading: label swapped for a 16 px spinner, width locked, `aria-busy`. Labels are at most
three words, sentence case, verb first.

### 2.2 Inputs

Text, number, textarea, search. Height 42 (phone 46), padding 0 12, radius 8, `--bg` fill on `--surface`
panels (`--surface` on `--bg` pages), 1 px `--line-2`, text serif 16 (mono 13.5 for codes, times, money
via `.mono`), placeholder `--muted`. Label above: mono 12/500 `--muted`, 5 px gap. Help text serif 14.5
below. Required mark "·" after the label, never an asterisk alone.

States: hover border `--ink`; focus border `--accent` 2 px (drawn as a 1 px border plus an inset 1 px) and
the focus ring; error border `--crit`, message below in `--crit` with a triangle icon, `aria-describedby`;
disabled 45% with `--well` fill; read-only `--well` fill, no border change, copy icon; loading (async
validation) a 14 px spinner inside the right edge. Prefix and suffix slots for units (km, €, CAD), mono.
Clear button appears on search inputs with content.

### 2.3 Select

A button styled like an input with a chevron (`.selbox` in the previews): 34 px in toolbars, 42 in forms;
opens a menu (5.2) with a type-ahead; current value `--ink`, placeholder `--muted`. Native `<select>` on
phone when there are more than 12 options. Multi-select renders chosen values as removable chips inside the
field; the field grows to two rows then scrolls.

### 2.4 Date and time pickers

Date: input showing "Sat 31 Oct 2026" (mono); opens a popover calendar, one month on phone, two on
desktop. Calendar cells 40 x 40 (phone 44), mono 13; day names cap 11.5; today has a 2 px `--line-2`
ring; selected `--accent` fill with `--accent-ink`; range fill `--accent-soft` between ends. **Shading
(F03)**: weekends `--well` cells; long weekends (statutory holiday adjacent to a weekend, from the
household's region calendar) `--info-soft` with a 3 px `--info` top bar and a tooltip naming the holiday;
school breaks `--warn-soft` hatched (2 px lines at 135°, 20% `--warn`) with the break's name in the month
header. Legend row under the grid: three swatches with labels. Keyboard: arrows move a day, PageUp/Down a
month, Home/End week ends, Enter selects, Esc closes; `role="grid"`, cells named "Saturday 10 October,
weekend, long weekend: Thanksgiving" with each qualifier only when true (long weekends come from the
statutory calendar: Thanksgiving Mon 12 Oct 2026, Family Day Mon 15 Feb 2027; Halloween is not one).

Time: input "11:30" with a popover of 15-minute rows (scrolled to the nearest); typing "1130", "11.30"
or "11:30 am" all parse. Zone shown after the time when it differs from the device ("09:05 Venice ·
03:05 your time"). Date-time range for bookings shows duration and "+1" automatically.

### 2.5 Checkbox, radio, switch

Checkbox 20 x 20 (hit 44), radius 4, 1.5 px `--line-2`; checked `--ink` fill with a `--surface` check;
indeterminate a 10 x 2 bar. Task rows use a 24 px round check (3.5): off is a 1.5 px `--line-2` ring on
`--surface`; **done is `--ok-soft` fill, `--ok` border and a `--ok` check glyph** (5.53:1 light, 7.87:1
dark; a white glyph on `--ok` is 1.8:1 in dark and is not allowed). Radio 20 px circle, dot
10 px `--ink`. Switch 44 x 24, thumb 20, off `--line-2` track, on `--accent` track; the thumb stays
`--surface` with a 1 px `--line-2` keyline; label to the right, state word after it for screen readers only.
Hover darkens the border to `--ink`; focus ring; disabled 45%. Animations: check draw 120 ms, switch thumb
200 ms `--e-std`.

### 2.6 Slider

Track 4 px `--line-2`, filled part `--accent`, thumb 20 px `--surface` with a 2 px `--ink` border (hit 44).
Value in a mono tooltip while dragging and in a mono readout beside the slider ("1.3×"). Ticks optional at
`--line`. Keyboard arrows step, Shift+arrow 10 steps. Used for relief strength and map opacity.

### 2.7 Filter pills with menus

Pill 36 px, radius full, 1 px `--line-2`, mono 13 `--ink-2`, label plus chevron; active (a value chosen)
becomes `--accent-soft` fill, `--accent` border, `--accent-text` text, label "Kind · Trail, Lake" (two
values then "+2") and an × that clears it (28 px hit inside the pill). Hover border `--ink`. Menu (5.2) with
checkboxes and live counts per option ("Trail · 18"), search field when more than 8 options, "Clear"
footer. Pills wrap to a second row on desktop; on phone they scroll horizontally with a fade and a
"Filters (3)" button that opens a full-height sheet with Apply.

### 2.8 Chips

24 px, radius full, mono 11.5/500, padding 0 9, optional 13 px icon. Never interactive unless they say
so (removable chips show ×).

| Kind | Look |
|---|---|
| neutral (countdown "In 131 days", "14 days", nights, phase) | 1 px `--line-2`, `--ink-2`; phase chips carry the identity square 10 px with keyline |
| kind (Trail, Lake, Stay) | neutral with the kind icon; no hue |
| selected or active filter | `--accent-soft`, `--accent` border, `--accent-text` |
| to book | neutral outline, ticket icon |
| caution: window open, or due in 8 to 30 days when a chip is drawn (tokens 3.1) | `--warn-soft`, `--warn` text, triangle |
| urgent: due within 7 days, window opens within 48 h, missed (tokens 3.1) | `--crit-soft`, `--crit` text, clock icon |
| held | neutral outline, clock icon |
| booked, done | `--ok-soft`, `--ok` text, check |
| idea | 1 px **dashed** `--line-2`, `--muted` |
| honesty: Unverified, No source yet, Location unconfirmed, Dates open, Sources disagree | 1 px dashed `--crit`, `--crit` text, triangle; on a suitability row, never in the three slots |
| notice (Offline, Read-only, Template) | `--info-soft`, `--info`, icon |
| trip identity | 20 px photo in the ring plus name, or the 10 px square plus name; never colour alone |

**Suitability chips** (from design/suitability-display.md 3; existing tokens only). They answer "for whom" and "how
hard" on cards, day rows and place pages in up to three slots: slot 1 is the limit or the fit, slots 2 and 3 are
values for the kind. Ratios light / dark.

| Kind | Look | Glyph | Text pair | When |
|---|---|---|---|---|
| **rule** (hard limit, "No minimum age", guide required) | `--surface-2` fill, no border, `--ink` 600 | lock 13 px | `--ink` on `--surface-2` 13.66 / 12.24 AAA | slot 1 when any operator or official rule exists; the lock and the fill together say "rule" without colour |
| **advice** (age band, our judgement: "From about 6") | 1 px `--line-2`, `--ink-2` 500 | person 13 px | `--ink-2` on `--surface` 12.09 / 10.76 AAA | slot 1 when no rule exists; detail rows |
| **value** ("Moderate · CAI E · 3–4 h", "Class I–III · 2 h on water") | neutral: 1 px `--line-2`, `--ink-2` | the kind glyph | as advice | slots 2 and 3 |
| **gap** ("Not checked yet") | 1 px **dashed** `--line-2`, `--muted` | none | `--muted` on `--surface` 6.94 / 7.45 AA | a missing field's row, or the whole row when nothing was checked; it replaces italic prose |
| **fits** ("Fits a 6-year-old") | `--ok-soft`, `--ok` | check | 5.53 / 7.87 AA | slot 1 with a party profile, when every rule and our advice pass |
| **advice fail** ("Not suited to a 3-year-old") | `--warn-soft`, `--warn` text | triangle | 6.11 / 7.84 AA | slot 1 with a profile, when our advice says no and no rule does |
| **rule fail** ("Not for under 8 · operator rule") | `--crit-soft`, `--crit` text | none, the words carry it | 5.45 / 6.36 AA | slot 1 with a profile, when a rule excludes the youngest |

Rules for the set. A chip never wraps inside itself; a limits chip holds at most three values and "+n", and if it
would still overflow it truncates with an ellipsis and a `title` on cards only; on a day row or a place page it takes
the full row width instead. The kids chip is the first chip on every surface. No codes ("FE3"): the family-effort
name goes on the chip, the number stays in the filter's `title`. Nothing in the set is amber; green appears only on
fits; coral only on a rule fail and on honesty chips; `--warn` is text on `--warn-soft`, never a fill (tokens 3).

### 2.9 Segmented control

Cards / List / Table / Map; All days / Day 03 / Bases; Compact / Comfortable; By day / By category.
Container 1 px `--line-2`, radius 8, segments 40 px (34 on maps and toolbars; 32 on the phone category
strip), mono 13, `--ink-2`,
1 px `--line-2` dividers; selected `--accent` fill, `--accent-ink`, 600. The selected fill slides 200 ms
`--e-std`. `role="radiogroup"`; arrows move and select. On phone segments are icon-only with
`aria-label` when more than three.

### 2.10 Search with `/`

42 px input, 300 px (full width on phone), serif 16 like every input, search icon left, `kbd` "/" right
(mono 12, 1 px `--line-2`, radius 4); `/` focuses it from anywhere except inside another input; Esc clears then blurs. Results update
on the first character; the live count ("12 trips") updates in a polite live region. In ⌘K and the add box
the same field drives grouped results (This trip, Near tonight's base, Elsewhere, Add "…" as my own).

## 3. Cards and rows

### 3.1 Cards (trip, public trip, place, trail)

Anatomy: photo 16:10 (object-fit cover, focus point from data) with the 4 px identity bar and keyline (trip
cards) or no bar (places, public trips use `--line-2`); body padding 14 16 16; title Big Shoulders 24, two
lines max; meta mono 12.5 `--muted`, **one line, truncate**; chip row (**wraps to a second row rather than
truncating a chip**; a chip never truncates except the one limits-chip case in 2.8; place and trip cards carry the
kids chip first, then effort); serif 16 summary (3 lines max,
ellipsis); footer (readiness bar and next deadline on trip cards, the deadline line coloured by tokens 3.1;
"Place page · Globe" links on place cards; "DAY 03" quiet sign on public day cards). `--surface`, 1 px `--line`, radius 12. Whole card is one
link; inner links (footer) are separate focus stops.

States: hover photo scales 1.03 over 400 ms `--e-out` and the border becomes `--line-2`; focus ring on the
card; selected (in map view sync) 2 px `--accent` border; done trips desaturate the photo 40%; idea cards
use a dashed border; loading skeleton (6.6); empty photo shows the kind glyph (22 px `--ink`) on `--well`.

Place card footer: "No source yet" or "Instagram post +1" left (mono 11.5), "Place page · Globe" right.

### 3.2 List rows

56 px, 1 px `--line` between, no card border: kind glyph 26 px on `--well`, serif 17/600 title, mono 12.5
meta, chips right, chevron. Hover `--surface-2`; selected 2 px `--accent` left bar; focus ring inside.

### 3.3 Needs-you row

Inside a per-trip column: due line mono 12 coloured by tokens 3.1 ("Sat 31 Oct · in 13 days" is `--warn`;
"Mon 19 Oct · tomorrow" is `--crit`), what
serif 16/600, three actions only: round check (30 px, hit 44) "Done", "Snooze" small secondary, "Open in
Bookings →" small secondary. Done animates the row out (200 ms height collapse) with an Undo toast;
Snooze opens a menu (Tomorrow, Next week, Pick a date); Open lands inside the trip on the item.
Columns are headed by the trip photo 36 px in its ring plus the name in `--t-row` and dates; a person
column uses a 36 px initial disc and "linked to [square] Dolomites, [square] Patagonia".

### 3.4 Booking card

Grid: kind glyph 44 px on `--well` · title serif 16.5/600 + mono 12.5 when · status column (status chip
over a mono 12.5 "Book by Sat 31 Oct" coloured by tokens 3.1; the chip itself stays "To book" neutral until
the window opens) · money mono 14 right-aligned ("≈ CAD 5,400" with ≈ for estimates). 1 px `--line`,
radius 12 (`--r-4`), `--surface`. Grouped under quiet day signs. Selected
(open in the drawer) 2 px `--accent` border. Secret codes render as "••••" with a Reveal button.

### 3.5 Task row

24 px round check (done look in 2.5: `--ok-soft` fill, `--ok` border and glyph), title serif 16, due mono
12.5 ("Sat 31 Oct · in 13 days", coloured by tokens 3.1), source chip (Plan, Email, Me), owner avatar
20 px, reminder chip (8.2). Grouped by month (not by category) with a drawn booking window where one
exists. Linked person checks show the person's initial disc and "shared with Patagonia"; ticking clears
everywhere with a toast naming both trips. Swipe right on phone = done, left = snooze, both with the visible
buttons as equivalents. **Cross-trip link** (S6): the Tasks page ends with one mono 13 line, "2 more due
this week in other trips →", linking to Home's Needs-you filtered to this week; it is omitted when the count
is zero and never lists the other trips' tasks inline (rule 5). Page template: patterns.md 4.8 N1.

## 4. Data display

### 4.1 Readiness bar

One 6 px bar, `--line` track, `--ink-2` fill, radius 3, label mono 12 "Book 4 of 9 · next Sat 31 Oct". On
hover or focus it splits into the four stages (Plan, Book, Prepare, Go) with 4 px gaps and a tooltip per
segment. `role="progressbar"` with `aria-valuetext` equal to the label.

### 4.2 Data table

`--surface`, 1 px `--line`, radius 12, head row `--well` with mono 12 labels, sortable heads show a 14 px
arrow on hover and the active sort arrow in `--ink`; sticky head (`--z-sticky`) and sticky group rows
(`--t-row` country name, mono 12 count right, collapse chevron). Rows 44 px comfortable, 36 px
compact; cells serif 15.5, mono 13 for kind, elevation (right-aligned), sources; status column uses a
filled `--ink` dot for Planned, a dashed ring for Idea, a check for Done. Tools row: Saved views (menu with
named views, Save current), Columns (checkbox menu with drag order), Density segment, Export CSV (downloads
the current filter and columns), spacer, "Add to a trip" (signed in). Row hover `--surface-2`; selected rows
(checkbox column appears on hover or Shift+click) 2 px `--accent` left bar; keyboard: Tab to the table,
arrows move the cell focus, Enter opens the row. Table scrolls inside its container with the first column
sticky; never horizontal page scroll. Empty: a one-row empty state (6.5). Loading: 8 skeleton rows.

### 4.3 Day timeline row (plan item)

Grid 24 px handle · 50 px time · 26 px kind glyph · content · 96 x 68 photo. Padding 10 0, radius 8
(`--r-3`) when lifted. Time mono 13.5/600; title serif 17/600 with optional status chip; meta mono 12 `--muted`;
note serif italic 15.5 `--ink-2`. Legs between rows: mono 12 `--muted`, icon, "55 min · 41 km via
Dobbiaco", indented to the content column; walking legs under 15 min show the trail icon. Hover: handle
turns `--ink`, row `--surface-2` at 50%. Selected (pin clicked): 2 px `--accent` left bar. Conflict
("arrives 9 min after 16:30") a `--warn` line under the leg. Editing by someone else: 2 px ring in their
presence colour on the photo. Queued offline: a 14 px clock after the title.

**Public trip page (timeline entry).** The same anatomy is the public day card's entry (design/trip-page/
timeline-design.md 4.2 and 4.3: time rail in `--t-time`, typed entries, legs as connectors, sun rows, "Know before
you go"), so the planner row and the public entry share one component. On an entry the suitability chips (2.8) lead
the chip row, before honesty, idea and To book, and the mono meta drops the child rule because the chips carry it.
**Chips may wrap to a second line on a phone entry**, limits chip first: the one exception to "mono never wraps"
besides the selector footer (recorded in timeline-design 10 and suitability-display 3.3).

### 4.4 Elevation profile

SVG, 160 px tall, **`--ink` 2 px line with a 10% `--ink` area** (public surface: nothing amber at rest);
gridlines `--line`, mono 11.5 axis labels (km below, m right); hut markers 8 px `--bg` circles with a 2 px
`--ink` border and a label list under the chart (serif 15 name, mono 12 km · m). Hover or scrub shows the
one amber element: a vertical 1.5 px `--accent` cursor with an 8 px `--accent` dot on the line (the current
position = "now"), a mono readout "4.2 km · 2,405 m" in `--ink`, and a synced marker on the map. `role="img"` with a text summary ("10 km, 450 m
climb, high point 2,454 m at 2.6 km"). Reduced motion: no cursor animation.

### 4.5 Photo gallery and lightbox

Grid of 16:10 tiles (3 columns desktop, 2 phone), gap 8, radius 8; each tile's credit on hover as a
`--scrim` strip with mono 11.5 (title · author · licence). Lightbox: full-screen `--header` background,
image letterboxed, caption serif 16 with the credit line mono 12.5 and the licence linked, previous/next
48 px ghost buttons, close top right, counter "4 / 42". Keyboard: arrows, Esc; swipe on phone; focus
trapped; `aria-roledescription="carousel"`. Open and close 200 ms fade and scale from the tile (shared
element), or a fade under reduced motion.

## 5. Overlays

### 5.1 Side sheet (drawer)

Desktop: **460 px** wide (tokens.json `side-sheet-w`; the specimen draws the same), right edge, from the
trip bar's bottom to the viewport bottom, `--surface`, 1 px `--line-2` left, `--e-3`, `--z-drawer`,
non-modal (the page stays scrollable, no scrim) for detail sheets; modal with scrim for forms. Header:
**140 px** photo of the trip with the gradient (10% to 85%), cap kicker in `--kicker-on-photo` (white at
80%, as the cover kickers; never amber on a photo) "NEW BOOKING IN PATAGONIA", `--t-section` (32) title,
4 px identity bar. Body padding
18 22 with sections (5.4). Footer pinned: primary "Save to Patagonia", secondary Cancel, mono 12 "Ctrl Z
undoes". Open 260 ms slide `--e-out`, close 200 ms `--e-in`. Esc closes (asks only if the form is dirty
and not autosaved); focus moves to the title on open and back to the opener on close. Phone: bottom sheet
(5.5) at full height. URL gains `?focus=`.

### 5.2 Popover and menu

Menu: `--surface`, 1 px `--line-2`, radius 12, `--e-2`, padding 8, min 200 px; items 40 px (phone 48),
mono 13 or serif 15.5 for sentences, icon 16 left, shortcut mono 11.5 right; destructive items `--crit`
and placed last after a divider. Open 200 ms fade + 4 px rise. Arrow keys, Home/End, type-ahead, Esc;
`role="menu"`. Popover (date picker, tooltip-with-actions): same box, arrow-free, anchored with 8 px
offset, flips to stay in view. Tooltips: `--toast-bg`/`--toast-ink`, mono 12, 600 ms delay, never the
only way to read a value.

### 5.3 Toast with Undo

Bottom centre, 20 px up (above the bottom bar on phone), `--toast-bg` pill, `--toast-ink` mono 13, optional
28 px trip photo, message, **Undo** underlined 600 (hit 44). 6 s with Undo, 4 s without, 8 s for a trip
switch ("Dolomites stays on Bookings, Day 9 · Back"). Pauses on hover and focus; stacks at most two; polite
live region; Undo reachable by Tab before it leaves. Enter 200 ms rise, exit 160 ms fade.

### 5.4 Banners

Full width of their column, radius 8 (`--r-3`), 10 14 padding, icon 16, serif 15.5. Kinds: **next action**
(`--surface`, 1 px `--line`, mono text, the date coloured by tokens 3.1, one button right: "Next: Ortisei
stay by Mon 15 Mar · Bookings"),
**urgent** (`--crit-soft`, `--crit` border and text), **caution** (`--warn-soft`), **notice** (`--info-soft`;
offline uses a dashed `--line-2` border and the saved time), **travel-day override** (`--surface-2` with the
other trip's identity square and a one-tap button, S5). Dismiss = snooze until the condition changes; never
a plain ×.

### 5.5 Bottom sheet (phone)

`--surface`, top radius 18, 1 px `--line-2` top, grab bar 40 x 5 `--line-2`; snap points peek 120, half
50%, full (under the top bar). Drag with velocity; buttons "Expand" and "Collapse" for keyboard; never
scrolls the page beneath at peek; collapses when the keyboard opens. The map sheet peek shows the day's
route strip and base names.

## 6. States of containers

### 6.1 Empty states

Illustration-free: a kind glyph 32 px on a `--well` disc, serif 17/600 title that says what is missing,
serif 15.5 one line why, one primary verb that does the thing ("Add the first stay"), optional secondary.
Centred, 48 px padding. Never "No data".

### 6.2 Skeleton loading

`--surface-2` blocks matching the component's shape (card: photo block + two text bars; row: glyph disc +
bar; table: 8 rows; map: `--well` with a centred mono "Loading map"). Shimmer 1.4 s linear gradient of
`--surface` at 40%, off under reduced motion. Cross-fade 200 ms to content; never a spinner for a region.

### 6.3 Error and permission

Error inline, in place of the region: triangle, serif 16 "We couldn't load the places. Try again or keep
reading offline.", Retry button, cached data under it when any. Permission: a notice banner "You can view
this trip. Ask Nitin to let you edit." with Request access. 404: page title "Not here", search field,
links to Trips, Places, Globe.

## 7. Map and globe

### 7.1 Map

Container `--well`, 1 px `--line`, radius 12 inside pages, full-bleed in Plan. Layers and tokens in
tokens.md 5. Controls: top-left a segmented control (All 14 days / Day 03 / Bases; on phone All · Day ·
Bases), top-right zoom ± and "Fit trip" (34 px icon buttons on `--surface`), bottom-left legend card
(`--surface` at 92%, radius 8, mono 12: every day by road; the picked day; base), bottom-right attribution
(mono 11.5 `--muted` with links: OpenFreeMap, OpenStreetMap contributors, Mapterhorn) always visible, scale
bar above it. Pins: ink circles with mono numerals for the picked day; 6 px dots for other days; bases as ink
signposts; the picked base amber; co-located stops one pin with a "3 · 5" badge that fans out on hover/tap;
clusters at low zoom with counts; hover or focus a pin → 2 px amber ring and the row highlights; click
scrolls the document and opens the detail sheet. Keyboard: the map is `role="application"` with a list
equivalent on screen; arrows pan, +/- zoom, Tab cycles pins, Enter opens. Fly-to on section change
600 to 900 ms by distance; jump under reduced motion. Day filter chip in the legend repeats the current
filter and clears it. Offline: PMTiles pack or `--well` with routes and pins only, notice banner.

`MapSpec` options the pages set (`web/lib/map/types.ts`):

- `style: 'relief' | 'light' | 'dark' | 'auto'`. **`auto` is the default for every page map**: Relief in the light
  theme, Dark in the dark theme, switching with the theme (tokens 5.2). A page names a style only when the content
  needs it (a trail page may pin Relief).
- `hideBasemapLabels: ('towns' | 'regions' | 'countries')[]`. Hides the basemap's own place names of that rank where
  the page's pins and labels would sit on them (a place map hides `towns` around a labelled trailhead; a trip map at
  country zoom hides `regions`). Our labels always win over the basemap's; the basemap's never fight a pin.
- `Pin.quiet`. The pin is drawn, its label is kept for assistive tech, the selection card and the fan-out, but no text
  is drawn beside it. Used for crowded pins (parking stacked under a trailhead) and the members of a numbered cluster.
  A quiet pin still gets the hover ring and the row highlight.

### 7.2 Globe controls

Full-bleed canvas under the header. Floating control card bottom-left (`--surface` at 92%, radius 12,
padding 12, `--e-2`): Style segment (Relief · Light · Dark), **3D terrain** switch with the relief slider
(0.5× to 2×) revealed when on, **Auto-spin** switch (disabled under reduced motion with "Off: reduced
motion"). Search field top-centre 420 px ("Search a country, state, city, sea or range"). Breadcrumb chip
top-left (World › Italy › South Tyrol) with Back. Hint bar bottom-centre mono 12 on `--toast-bg` at 85%
("drag to spin · scroll to zoom · click a pin to open"), hides after the first interaction. Side panel right
360 px (collapsible to a 44 px tab): saved places and published trips by country with flags and counts;
rows 44 px; selecting a country flies in and lists its places; selecting a place opens a selection card
(photo, name, area chain, kind chip, "Open place" primary) anchored to the pin on desktop and as a peek
sheet on phone. Pins (tokens 5): country-level pins at rest are **`--ink` discs with `--surface` mono 600
counts**, 28 to 44 px by count, 2 px `--map-halo` edge; the **hovered or selected pin alone** becomes
`--accent` with an `--accent-ink` count and the 2 px `--map-select-ring`. Place pins at state level and below
are `--map-stop` ink dots with the kind glyph on hover. Signed-in trip pins sit in their identity ring, never
amber. **Hover a shape** (country, state, district; lake and park the same): `--accent` fill at 35% plus a
1.5 px `--accent` line over a 0.5 px `--map-casing`, and a facts tooltip. **Selected**: no fill, a 2 px `--accent`
line over a 1 px `--map-casing`; every other shape at that level is covered by `--globe-dim`, drawn above the
basemap labels so neighbours' names dim with their land. The casing is what makes the edge legal on water
(tokens 5.1 has the ratios); never wider than 1 px. Nothing on the globe is amber until the visitor points at it.
Canvas: the style `background` is `--globe-ocean`; behind it the `.globe-halo` element draws the `--globe-halo`
atmosphere and the 1 px `--globe-edge` limb, and doubles as the first-paint placeholder. The three styles and
`auto` are as 7.1. A basemap feature (river, sea, peak, park, city) can be selected too: its card floats and the
URL gains `?f=<class>:<id>` (patterns 1.2); the "Showing" filter row (All · Trips · Places, then a kind menu) is
`?show=` / `?kind=`. The rest of the globe (What is here, immersive mode, the landscape layout, the zoom-by-class
fly table, the keyboard table) is specified in design/globe/spec.md 3 to 5 and 7 and is not repeated here.
Keyboard: Tab reaches the search, the panel and pins in list order; Enter flies in; Esc steps back one
level; Home or Shift+Esc resets to the world. Motion in patterns.md 6.

## 8. Trip-specific

### 8.1 Drag handle, insertion line, drag pill

Handle: six dots 18 px, `--muted`, in a 24 x 44 target (28 x 44 phone) at the row's left edge; `--ink` on
row hover; `--accent-text` while dragging; `cursor: grab`/`grabbing`. Lift: the row becomes the ghost at
scale 1.02, `--surface-2`, `--e-2`, rotate -0.8°, 120 ms; the origin stays at 32% opacity. Insertion
line: 2 px `--accent` from the content column to the right edge with 8 px end dots; the pill sits at the
line's left end: `--accent` fill, `--accent-ink` mono 11.5/600, "to Day 3 · before 11:30", plus a delta
when known ("+42 min driving"). Hovering a collapsed day opens it after 400 ms; hovering an outline day
jumps there. Drop: spring settle, legs and totals count 300 ms, Undo toast. Keyboard: Space picks up,
arrows move within the day, PageUp/PageDown between days, Space drops, Esc cancels; every step announced
("Seceda, Day 12, position 2 of 4"). Phone: long-press 300 ms (haptic where supported) or Move to… in the
row menu (Day, position) which is always present.

### 8.2 Task reminder chip

States: upcoming (neutral outline, bell icon, "Reminds Sat 24 Oct 09:00"), due (`--warn-soft`), missed
(`--crit-soft`), snoozed (neutral, "zz" glyph, until date), done (`--ok-soft`). Tapping opens a menu:
change time, channel (push, email), snooze, remove. Reminder ladders (T-30, T-7, T-1, open day) render as
a small mono table inside the task's expanded state, each row with its chip.

### 8.3 Today components

Leave-by card: cap label "LEAVE HOME BY", Big Shoulders 78 `--accent-text` time, mono 14 "in 42 min ·
2 h 05 · 182 km", serif 15 instruction, two 50 px buttons (primary Navigate, secondary ticket code).
The leave-by card is a card (radius 12). Running-late strip: cap label, four 44 px toggles (radius 8)
"+15 min" (first shows the unit; all have
`aria-label="plus 15 minutes"`), selected `--accent`; consequence list under it with `--crit` triangle,
neutral phone, `--ok` check lines; two 46 px buttons Shift the day / This stop only. Timeline: 48 px time
column mono 13.5/600, 12 px node ring (filled `--accent` for now), serif 15.5/600 title, mono 11.5 note;
done stops at 50% with a check. Offline banner: dashed, with the saved time and what is cached. Sunlight
theme toggle in the top bar menu.

### 8.4 Booking form sections

Section = cap label + fields; sections for each kind: Kind (chip radios with icons), Who or what (airline
and route; property; company), When (date-time with zones, duration and +1 computed), Travellers (toggle
chips with ages), Money (amount, currency select, paid/held/estimate), Window (opens, closes, remind me),
Codes (secret fields), Files under (the trip chip 26 px in its ring, "matched by the dates", **Change**
link). Paste a confirmation: a textarea that parses and pre-fills, highlighting fields to "check 2 fields".
Save button names the trip. Autosave drafts; Ctrl Z undoes a save.

### 8.5 Pagination or infinite scroll

Decision: **no infinite scroll.** Lists show 48 cards or 100 rows per page with a pager (mono buttons
"‹ 1 2 3 ›", current `--accent`) and the count ("49 to 64 of 64"); the URL carries `?page=`. Reason: the
public site is read and shared by link, the footer (credits, attribution) must stay reachable, and the
table's CSV export and group collapse need a bounded set. Collapsed country groups load on expand.
