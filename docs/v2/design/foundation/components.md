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
| public | Trips · Places · Globe | search icon (opens search, `/`), theme toggle, **Mine** (`layers` 18 px and the label from 900 px, icon only from 640 to 899 px, mounted after hydration into reserved width), then **Sign in** (ghost, header colours) or, signed in, the avatar menu (Account, Sign out) |
| signed in, planner stage | Home · Trips · Places · Globe | trip chip (switcher), bell with count badge, theme, Mine, avatar menu (People, Inbox, Settings, Sign out) |
| guest by link | Trips · Places · Globe | "Shared by Nitin · view only" info chip, Copy to my trips, Sign in |

Tabs: `--t-tab` (mono 13.5/500) `--header-mute`, 12 px side padding, full height; current tab `--header-ink`
600 with a 2 px `--header-ink` underline sitting on the amber rule. Hover: ink at 100%, no underline. Focus: header
ring. Keyboard: Tab to the tab list, arrows move, Enter opens; `aria-current="page"`. At tablet the tabs
stay; on phone the header is 56 px with brand and the right cluster only, tabs move to the bottom bar.
Do: keep four tabs or fewer. Don't: put trip tabs here.

**Mine in the cluster** (NAV-F, 26 Oct 2026). Ghost header button, 38 px, `--header-ink`; current on `/mine/**`
(`aria-current="page"`): icon `--accent`, label 600. It carries the Mine dot of 1.4. The avatar menu never repeats Mine.
Measured at 640 px with Mine icon-only and Sign in: 23 px between the last tab and the cluster, so nothing else joins
the cluster below 900 px without re-measuring.

**Phone header** (below 640 px; owner Q203, NAV-F). Brand, then **Search · Sign in or Account · Theme**, each a **44 x 44
visual** ghost button with an 18 px glyph, 8 px apart (not 38 px with a padded hit area: padded neighbours sit 2 px
apart). The account control is a link with the `user` glyph: signed out to `/sign-in/`, named "Sign in"; signed in to
`/account/`, named "Account", with the glyph inside a 30 px circle drawn as a 1.5 px `--header-mute` ring (state by
shape). Both links are server-rendered and swapped by `html[data-signed-in]`, so the control costs no start JS; no
avatar menu below 640 px. Current (on its own page only): glyph `--accent`. Measured at 320: brand 98.4 px, tools
148 px, 33.6 px spare inside the 292 px content width; if a change ever leaves less than 0, the brand steps down to
`--t-row` before any target shrinks, and the tools never wrap. With sign-in off, the account link is absent. Full
measurements, contrast and checks: [mine-and-bar-spec.md](../shell/mine-and-bar-spec.md) 2 and 4.

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

The public trip page's tabs (Summary · Days · Stops · Bookings · Photos) are a different component: 1.6.

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

Bottom bar: 84 px including a 26 px home-indicator inset (8 px top and 4 px side padding), `--header`, 1 px
`--header-line` top, `--z-header`, equal auto-flow columns. Items 56 x 56 minimum, icon 22 px, label mono 11.5
(`--t-chip`) `--header-mute`, one line (at 200% zoom it may wrap to two inside the item, never truncate); current item
`--header-ink` with the icon in `--accent`. Trip screens: **[trip photo] Plan · Today · Bookings · More**;
the photo is 28 px in a 2 px identity ring with keyline, label "Switch", first position (thumb reach, S8).

| Bar | Items | Status |
|---|---|---|
| public (signed out or in) | **Trips · Places · Globe · Search · Mine** (`cards`, `pin`, `globe`, `search` as a button that opens the header search, `layers`) | NAV-1; replaces the interim ACCT-PH "Sign in / Account" item 1:1 |
| signed in, planner stage | Home · Trips · Places · Mine · More (Globe first in More) | later, NAV-M (nav spec 7, Q207) |
| inside a trip | [photo] Plan · Today · Bookings · More | planner |
| your trip in edit mode (`/t/<id>/?edit=1`) | none: the **edit bar** (8.6) Undo · Redo · Settings · Done replaces this bar while edit mode is on | Step 2 |
| builder stages 0 to 4 (`/plan/`) | none: the builder's action bar (9.4) replaces this bar | builder |

Mine's label and icon never change with the session (no session read in the bar). Mine is current on `/mine/**`
(`aria-current="page"`) and on `/account/**`, `/sign-in/**`, `/sign-up/**` (`aria-current="true"`, same look), computed
from the path. Measured at 320: five items of 62.4 x 56; at 390, 76.4 x 56.

**The Mine dot** (not a count): a 7 px `--accent` disc with a 2 px `--header` ring at the top right of the icon (top
-2 px, right -4 px), set when a copy or favourite is added on this device and cleared when `/mine/` opens; the item's
name becomes "Mine, new items" and the dot is `aria-hidden`; it appears with a 200 ms scale, none under reduced motion.
Same dot on the desktop Mine button (1.1). It is dropped rather than raise the trip page's start-JS budget.

**Count badge** (urgent only): on Home and on the header bell, an 18 px `--crit-fill` disc with an `--on-crit-fill`
mono 11.5/600 count, when something is urgent (tokens 3.1). Mine never shows a count until a dated copy has a booking
window opening within 7 days (planner stage). The bar hides while a bottom sheet is above half height and while the
keyboard is open. Measurements and checks: [mine-and-bar-spec.md](../shell/mine-and-bar-spec.md) 3.

### 1.5 Breadcrumbs

Mono 12.5 `--muted`, " · " separators, current item `--ink`; used on place and trail pages (Places ·
Italy · Sesto Dolomites) and in the globe chip (World › Italy › South Tyrol). Each crumb is a link with a
36 px hit height. Collapses to the last two crumbs on phone with a leading "…" menu.

### 1.6 Page tabs (public trip page)

UXB-N, 26 Oct 2026 (decision and measurements: [uxb-components-2026-10-26.md](../trip-page/uxb-components-2026-10-26.md)
1 and 2; template: patterns 3.10). The trip page's five tabs **Summary · Days · Stops · Bookings · Photos**; only tabs with
content are drawn, and a trip with only a Summary has no tab bar.

Anatomy: a row 48 px tall on `--bg` with a 1 px `--line` hairline under it (decorative). Labels `--t-tab`, at rest
`--muted` (6.42 light / 8.23 dark on `--bg`), hover `--ink`; current `--ink` at `--t-tab-current-weight` with a **3 px
underline in `--accent-text`** (5.85 / 8.83). Not `--accent`: it is 2.33:1 on `--bg` in light, under the 3:1 a state
indicator needs; the label's colour and weight carry the state too. Counts (mono `--t-meta` `--muted`) only from 640 px,
and only where they add a fact (Stops, Bookings, Photos; owner Q304 pending), in the name as "Bookings, 7".

Widths (IBM Plex Mono, measured in Chromium and WebKit): side padding 4 px under 360 px, 8 px from 360 to 639 px, 12 px
from 640 px; every tab at least 44 px wide. Five English labels then take 287 px of 292 at 320 and 323 of 362 at 390,
so the row never scrolls at 100% text. On phones the tabs share the row (`flex: 1 1 auto`); on desktop they sit at their
natural width, left aligned. Overflow fallback (200% text, a longer label): the row scrolls sideways with snap per tab, a
24 px fade at the right edge and the current tab scrolled into view, as `CategoryStrip`. Never more than five tabs.

Keyboard and screen reader: `role="tablist"` named "Trip sections"; tabs are buttons with `role="tab"`, `aria-selected`,
`aria-controls`; roving `tabindex`; Left and Right move focus, Home and End jump, **Enter or Space activates (manual
activation**, because three panels load a chunk and each activation is a `pushState`); focusing a tab prefetches its
chunk. Panels `role="tabpanel"`, `aria-labelledby`, `tabindex="-1"`; a loading panel has `aria-busy` and a `role="status"`
line. Links into a tab from elsewhere are real `<a href>` links (patterns 3.10).

Sticky: patterns 3.10 (on phones only one row sticks under the header). Motion: the underline slides `--d-fast`
`--e-std`; the panel swaps without animation; reduced motion jumps. Focus ring inset 3 px.

Do: hide a tab that would be empty. Don't: use the segmented look (2.9) for page tabs: five never fit at 320 (369 px), and
a sticky amber block sits beside the primary action at rest. Don't: replace the tabs with a select on phones.

Props sketch: `PageTabs({ label, tabs: { value, label, count?, href }[], value, onActivate, onFocusTab?, idPrefix,
countsFrom })` in `web/components/ui/PageTabs.tsx`; it shares its roving-focus helper with Mine's tabs.

## 2. Controls

### 2.1 Buttons

| Variant | Fill | Border | Text | Use |
|---|---|---|---|---|
| primary | `--accent` | none | `--accent-ink` mono 13/600 | one per view: Plan a trip, Add a booking, Save to Patagonia, Copy to my trips, Edit trip (your own trip), Done (edit mode), Navigate. In edit mode Done is the only one on screen: the cover's Done is secondary, and a sheet whose consequence notice is open makes its Continue primary and its Apply secondary (patterns 3.13 item 3) |
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
`--surface`; **done is `--ok-soft` fill, `--ok` border and a `--ok` check glyph** (6.85:1 light, 7.56:1
dark; a white glyph on `--ok` is 2.1:1 in dark and is not allowed). Radio 20 px circle, dot
10 px `--ink`. Switch 44 x 24, thumb 20, off `--line-2` track, on `--accent` track; the thumb stays
`--surface` with a 1 px `--line-2` keyline; label to the right, state word after it for screen readers only.
Hover darkens the border to `--ink`; focus ring; disabled 45%. Animations: check draw 120 ms, switch thumb
200 ms `--e-std`. **The thumb position is the on-state indicator**, together with the state word for screen readers: the
on track (`--accent`) is 2.52:1 on `--surface` in light (6.54 dark), under the 3:1 UI minimum, so the track colour is
never the only carrier of the state, and a switch never stands without its label (review TB-N2R; approved at G-S2,
28 Oct 2026; no change to the look).

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

**Phone menus dock** (KIND-FILTER-FIX, merged 26 Oct 2026, recorded by UXB-N). Under 640 px a pill's menu is not anchored
to the pill: it docks above the bottom bar at full width, as tall as the room and never taller, with the top radius of a
sheet; its options scroll inside it (`overscroll-behavior: contain`), a sticky head names the facet and "n selected", the
footer with Clear and Done stays in view, every option row is at least 44 px, and the page behind does not scroll while it
is open. Filters inside trip tabs (Stops, and Bookings above 12 rows) use the same pills and the same docking
(uxb-components 7).

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
| honesty: Unverified, No details available, Location unconfirmed, Dates open, Sources disagree | 1 px dashed `--crit`, `--crit` text, triangle; on a suitability row, never in the three slots |
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
| **fits** ("Fits a 6-year-old") | `--ok-soft`, `--ok` | check | 6.85 / 7.56 AA | slot 1 with a party profile, when every rule and our advice pass |
| **advice fail** ("Not suited to a 3-year-old") | `--warn-soft`, `--warn` text | triangle | 6.11 / 7.84 AA | slot 1 with a profile, when our advice says no and no rule does |
| **rule fail** ("Not for under 8 · operator rule") | `--crit-soft`, `--crit` text | none, the words carry it | 5.45 / 6.36 AA | slot 1 with a profile, when a rule excludes the youngest |

Rules for the set. A chip never wraps inside itself; a limits chip holds at most three values and "+n", and if it
would still overflow it truncates with an ellipsis and a `title` on cards only; on a day row or a place page it takes
the full row width instead. The kids chip is the first chip on every surface. No codes ("FE3"): the family-effort
name goes on the chip, the number stays in the filter's `title`. Nothing in the set is amber; `--ok` (blue, with a check glyph) appears only on
fits; coral only on a rule fail and on honesty chips; `--warn` is text on `--warn-soft`, never a fill (tokens 3).

### 2.9 Segmented control

Cards / List / Table / Map; All days / Day 03 / Bases; Compact / Comfortable; By day / By category.
Container 1 px `--line-2`, radius 8, segments 40 px (34 on maps and toolbars; 32 on the phone category
strip), mono 13, `--ink-2`,
1 px `--line-2` dividers; selected `--accent` fill, `--accent-ink`, 600. The selected fill slides 200 ms
`--e-std`. `role="radiogroup"`; arrows move and select. On phone segments are icon-only with
`aria-label` when more than three. **Tab variant** (Mine's My trips · Favourites): the same look with `role="tablist"`,
each segment a `tab` with `aria-selected` and `aria-controls`, arrows move and select, Home and End jump; label plus a
mono 11.5 count ("My trips 2"); 44 px tall and full width on phone (two equal segments), 40 px on desktop. Use the tab
variant only when the segments switch panels and the URL; filters and views stay radiogroups. The tab variant is for two
or three panels inside a page (Mine); page-level tabs with more are 1.6. Days' List | Table and Everything | Stops only
(patterns 3.10) are views, so they are radiogroups.

### 2.10 Search with `/`

42 px input, 300 px (full width on phone), serif 16 like every input, search icon left, `kbd` "/" right
(mono 12, 1 px `--line-2`, radius 4); `/` focuses it from anywhere except inside another input; Esc clears then blurs. Results update
on the first character; the live count ("12 trips") updates in a polite live region. In ⌘K and the add box
the same field drives grouped results (This trip, Near tonight's base, Elsewhere, Add "…" as my own).

### 2.11 Favourite toggle (heart)

An icon toggle button that keeps a place or a trip in the visitor's favourites (visitor spec, FAV-1). Secondary button
look: `--surface` fill, 1 px `--line-2`, radius 8; 38 x 38 visual with the padded 44 px hit area from 640 px, 44 x 44
visual below 640. Glyph 18 px heart (stroke 1.75; the path lives in the favourites chunk, never in `Icon.tsx`). Rest:
outline `--ink` (16.06 light / 13.83 dark on `--surface`). Pressed: filled and stroked `--accent-text` (6.33 / 7.99),
`aria-pressed="true"`; told apart by fill, not colour alone. Hover, focus, pressed-down as 2.1; never disabled. Name is
constant, "Favourite <name>", with the state in `aria-pressed`; `title` "Favourite". Motion: fill 120 ms and a 1 to 1.15
to 1 scale over 200 ms `--e-out`; reduced motion: fill only. Mounted after hydration, never in server HTML. Placement
and toasts: patterns 3.9. Cards never carry the toggle; a favourited card shows an `aria-hidden` badge: 18 px filled
heart in `--accent-text` on a 26 px `--surface` disc with a 1 px `--line-2` keyline, top right of the photo, 8 px in.

### 2.12 Stepper

UXB-N, 26 Oct 2026 (uxb-components 4). One number that moves by one inside a small range: adults (1 to 12) and children
(0 to 8) in the party editor and the copy sheet, the youngest age in the Kids filter. It replaces three steppers with
three looks (`tl-stepper`, `trav-step`, `age-step`).

Anatomy: visible label left; then a 44 x 44 secondary button (2.1) with the `minus` glyph 16 px `--ink`, an `<output>`
40 px wide with the value in mono `--t-tab` 600 `--ink` (16.06 light / 13.83 dark on `--surface`), and a 44 x 44 `plus`
button; 8 px between the parts. Borders `--line-2` (3.67 / 3.42). The same size on every width (it lives in forms, not
toolbars).

States: hover and pressed as 2.1; **at a bound the button keeps focus**: `aria-disabled="true"` at 45% opacity, never
`disabled`, because a disabled button under the pointer drops focus to `body`. Optional `format(n)` ("Under 1" for 0).

Keyboard and screen reader: `role="group"` named by the label; the buttons are named "Fewer adults" and "More adults";
the output is `aria-live="polite"`; Enter or Space steps, and Up and Down step from either button. Not a `spinbutton`: two
real buttons serve switch and voice users better. Values with more than about 12 steps that a person sets once (a child's
age, 0 to 17) use a native select (2.3, `ui/Select`), which gives the phone's own picker.

Props sketch: `Stepper({ label, value, min, max, onChange, decLabel, incLabel, format? })` in
`web/components/ui/Stepper.tsx`.

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

Place card footer: "No details available" or "Instagram post +1" left (mono 11.5), "Place page · Globe" right.

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

### 3.6 Count card

UXB-N, 26 Oct 2026 (uxb-components 9.1). A Summary card that states one count and leads to the tab or section that lists
it: "4 bases · 14 nights", "33 trails · 186.5 km, all versions", "7 to book ahead · none has a published opening date
yet", "41 photos".

Anatomy: `--surface`, `--b-hairline`, `--r-3`, padding 12 14, at least 72 px tall. Value in `--t-row` `--ink` (16.06 /
13.83), sub in mono `--t-meta` `--muted` (6.94 / 7.45), at most two lines; a 16 px chevron `--muted` at the right.
**The whole card is one `<a href>`** to the filtered tab (`?view=all#trails`, `?view=bookings`); no button inside it.
Hover: border `--line-2`; focus ring on the card; pressed 1 px down. Grid `repeat(auto-fit, minmax(160px, 1fr))` on
desktop, two columns on phones. A card with nothing to count is not drawn; a total always names its coverage ("climb known
for 27 of 33"). Server-rendered.

### 3.7 Highlight card

UXB-N, 26 Oct 2026 (uxb-components 9.2). A place marked "Worth the journey" in a trip's Summary. Anatomy: photo 4:3 (the
place's own licensed photo, else the trip gallery section with the same name, else the kind glyph 22 px on `--well` with
"No licensed photo yet" in `--t-small` `--muted`, 6.02 / 8.58); name `--t-card`, two lines; day signs in mono `--t-meta`
("Day 11", "Days 3 and 10"). The card is one link to the place page; each day sign is its own link to Days at that day
(`?view=day#day-11`), a separate focus stop above the card's stretched link (3.1). Desktop: two rows of four; phones: a
2 x 2 grid, "Show 4 more" (static disclosure, 6.4) and "See all 13" to Stops filtered to the relevance value (owner Q306
pending; never a sideways row that hides cards). Photo credits go to the page's credits footer. Hover and focus as 3.1.

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

**Slots on your own trip (Step 2, patterns 3.10 item 10 and 3.13).** The entry has four slots; read mode on `/trips/`
and `/t/` fills only the last two, so the public entry is unchanged.

| Slot | Read mode | Edit mode |
|---|---|---|
| Leading (24 x 44 desktop, 28 x 44 phone), before the time rail | not drawn: the rail starts at the card's left edge as today | the six-dot handle (8.1), `--muted` (6.94 / 7.45 on `--surface`), `--ink` on row hover |
| Trailing (44 x 44), after the photo | not drawn | the `⋯` button (icon ghost, 8.7), named "Actions for Seceda, Day 3" |
| Mark line, under the title | the stop's marks as neutral chips (2.8, `--ink-2` on `--surface` 12.09 / 10.76): Added by you, Moved from Day 3, Moved by you, From our trip, Kept on Day 4, Changed on another device. At most two; a third goes into the item sheet's header line. Words, never colour alone | the same |
| Action line, in the content column | Map: <name>, Directions, AllTrails (R59-1), as on the public entry | the same; on a phone "Map: <name>" shortens to "Map" so the line stays one row |

Entering edit mode adds the leading and trailing slots and narrows the content column by their widths. The page keeps the
entry nearest the top of the viewport at the same height on screen (scroll anchoring on that entry), and the slots fade
in over `--d-fast` (a jump under reduced motion); the cover, party bar and tabs do not move (patterns 3.13 item 2). A Fix
warning on an entry is a line under the leg in `--crit` with the `warn` triangle and its one fix button; a Check warning
is `--warn` text on `--warn-soft`; never a fill (patterns 3.13 item 10).

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

**Large galleries (the trip page's Photos tab, 6 or more photos; UXB-N).** Grouped by the gallery's sections, each with a
heading that links to its place and day signs when they match, and "Nearby, not in this plan" (`--t-meta` `--muted`) for
sections the plan does not visit. **Each tile shows its credit line under it at rest**: author · licence, mono 11.5
`--muted` (6.42 / 8.23 on `--bg`), one truncating line; the full title, author and linked licence stay in the lightbox and
the credits footer. Phones have no hover, and every photo needs its credit. Images are lazy with fixed 16:10 boxes (no
shift); the gallery's chunk loads when the tab opens. Masonry and carousels are not used (uxb-components 8).

### 4.6 Day table

UXB-N, 26 Oct 2026 (uxb-components 6; spec trip-and-places-ux-fixes 7). The Days tab's Table view: **one `<table>` per day**,
chronological, a lighter sibling of 4.2 with no tools row, sort, selection or cell focus.

Anatomy: `<caption>` in `--t-row` ("DAY 04 · Lake Louise to Jasper townsite · 07:30 to 19:00 · 2 h 55 driving"); head row
`--well`, mono 12 `--muted` labels (6.02 / 8.58), `<th scope="col">`; the time cell is `<th scope="row">` in `--t-time`
with the timeline's confidence wording ("~08:45"); cells serif 15.5 `--ink` on `--surface` (16.06 / 13.83); drive legs are
indented rows in `--muted` (6.94 / 7.45). Takes is mono 13, never wrapping ("45 min"). Rows 44 px. Frame and radius as 4.2.

Columns: Time · What · Kind · Where · Takes · Notes, book from 640 px. **Under 640 px three columns, Time · What · Takes,
with Kind, Where and Notes folded into lines under the title in the What cell** (mono `--t-meta` `--muted`): the three
`th` and `td` are `display: none` and the folded lines show; from 640 px the reverse, and the folded lines are
`aria-hidden`. Never sideways scroll. Sticky head only from 640 px, under the page's sticky band; on phones the caption is
enough. Print uses the six columns, repeats the head per page and keeps a day on one page when it fits. Rows and time text
come from the same function as the CSV and the print (`printTime`), so "Stops only" equals the CSV.

### 4.7 Month strip

UXB-N, 26 Oct 2026 (uxb-components 5). Twelve months with the best, also-good, the plan's own, avoid and unresearched
months, in the Summary's "When to go" and anywhere a season is drawn. Replaces the single-letter strip.

Layout by the strip's own width (a container query): **12 x 1 with three-letter names** from 400 px (a legend under the strip
names the patterns); **6 x 2** under 400 px (every phone: 46 px cells at 320, 58 px at 390), with the state word inside each
cell, because three letters fill a 26 px cell edge to edge and 6 x 2 is no taller than 12 x 1 plus its legend (UXB-4 review
P1); from 705 px the strip spans the section, so its right edge lines up with the four cards, and the word is in the cell
again. Single letters are never drawn (they repeat J, M, A).

| State | Look | Pair (light / dark) |
|---|---|---|
| best for this plan | `--ink` fill, label `--surface` 600, word "best" | 16.06 / 13.83 |
| also good, with trade-offs | `--surface` cell with a 6 px foot band hatched in 2 px `--line-2` stripes at 135 deg; word "good" | label 16.06 / 13.83, stripes 3.67 / 3.42 |
| the plan's months (no "best" researched) | `--surface`, 2 px `--ink` border | 16.06 / 13.83 |
| avoid (only with a sourced reason) | `--surface`, label `--muted`, a 6 px foot band cross-hatched in 1.5 px `--ink-2` lines, word "avoid" | 6.94 / 7.45; lines 12.09 / 10.76 |
| not researched | `--surface`, 1 px `--line-2` border, label `--muted` | 6.94 / 7.45 |

Labels never sit on stripes (the old full-cell hatch was 2.13:1). Under 400 px and from 705 px the word is in the cell and the
legend keeps one line, "Blank: not checked for this plan" (a blank cell has no word, UXB-4 review I5); from 400 to 704 px
the legend names every pattern in use as well. Screen reader: a summary line first ("Best: September. Also
good: June, August.") then an ordered list of twelve items with hidden full text ("September, best for this plan"); the
visible names are `aria-hidden`. Server-rendered, no JS.

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

Bottom centre, 20 px up (above the bottom bar, the edit bar (8.6) or the builder's action bar on phone), width at most
min(100% − 32 px, 560 px), `--toast-bg` pill, `--toast-ink` mono 13 (14.85 / 15.28), optional 28 px trip photo,
message, **Undo** underlined 600 (hit 44). The " · " separator sits only between parts of the message ("Moved Seceda to
Day 4 · kept there"); Undo is the button, never text after a separator. 6 s with Undo, 4 s without, 8 s for a trip
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

### 6.4 Disclosure (collapsible section)

UXB-N, 26 Oct 2026 (uxb-components 3). A section or a list tail that opens in place. Two kinds, one look:

| Kind | Element | When |
|---|---|---|
| **static** | native `<details>` / `<summary>` | server-rendered text that needs no state: "Other weeks that work" and "Worth knowing" on phones, "Know before you go: 4 more", the lead's "More", "Show 4 more" highlights, place pages' Facts and sources and a long gap block. Zero JS; a find in page opens it in Chrome |
| **live** | a `button` with `aria-expanded` and `aria-controls` | the content is a lazy chunk, follows the party or is remembered: The trip's shape (and each of its count phrases), "Plan it for" |

Anatomy: the summary or button is the whole row, at least 44 px tall: label (`--t-row` for a section, `--t-label` for a
list tail) `--ink`, a count in mono `--muted` ("(3)"), a 16 px chevron at the left that turns up when open. Content grows
in place, height by grid rows 0fr to 1fr over `--d-base` `--e-std`; reduced motion jumps. A live disclosure whose chunk is
loading shows a `role="status"` line ("Loading the days").

Rules: **a hazard, closure or mandatory rule is never inside a closed disclosure** (P2 exception); it stays at rest above
it. Remembered state (live only) is per trip in the device key `travel.tripui` through `web/lib/storage/safe.ts`; storage
blocked means the default each time. Print: one `beforeprint` handler opens every static disclosure and `afterprint`
restores it; a live disclosure prints its server-rendered summary (the shape prints its ribbon and count line). Base UI
Collapsible is not used on the trip page (start JS).

### 6.5 "Not checked yet" block

UXB-N, 26 Oct 2026 (uxb-components 10; spec trip-and-places-ux-fixes 8.3 and 8.4). Every non-safety gap of a place page
in one block at the end, before Facts and sources. A section with no value and no safety gap is not drawn; a safety gap
(minimum age, height or weight, closures, permits and timed slots, main hazards) keeps its own row with the gap chip (2.8)
where the decision is made.

Anatomy: heading `--t-cap` `--muted` "Not checked yet" with `id="not-checked"`; a `<dl>`: each section name as `<dt>` in
mono `--t-label` `--ink-2` (11.18 / 11.88 on `--bg`), its gaps as one `<dd>` in `--t-small` `--muted` (6.42 / 8.23),
comma-separated ("When to go: best weeks, best time of day, snow-free window"). No box. More than five lines: the rest
in a static disclosure "Show 3 more sections". Basics-only pages: one line, "Not researched yet: season, parking, getting
there, fee, hazards, summary, photo, links". The completeness chip's "What is not checked" is a link to `#not-checked`,
not a popover. Server-rendered, no JS. Not an empty state (6.1): the page has content; this lists what it lacks.

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
line's left end: `--accent` fill, `--accent-ink` mono 11.5/600 (6.96), "to Day 3 · before 11:30", plus a delta
when known ("+42 min driving ≈"). Hovering a collapsed day opens it after 400 ms; on your trip's Days (Step 2) a stop
dropped on a day cell of the plan bar's day rail moves to the end of that day, and hovering a cell 400 ms scrolls to that
day. Drop: spring settle, legs and totals count 300 ms, Undo toast. Cancel: Esc, or dropping where it started.

**Start** (thresholds in `TRIP_EDIT_UI`): desktop, a press on the handle and 4 px of movement, or a press anywhere on the
row and 8 px; phone, a **long-press of `TRIP_EDIT_UI.longPressMs` (300 ms) on the handle only**, with haptic where
supported, and only **within the open day** (owner Q-BE3, Step 2 ruling R4): a press on the row body scrolls the page as
normal, and to another day the person uses **Move to day…**, the first row of the item sheet (8.7), which is always
present (WCAG 2.5.7). Autoscroll in the top and bottom 64 px of the viewport. Reduced motion: no lift scale, rotation or
settle; the line and pill only.

**Keyboard** (ruling R5): **Space or Enter** lifts the focused entry and drops it; arrows move it within the day;
PageUp and PageDown to the previous or next day; Home and End to the top or bottom of the day; **Esc** cancels and puts it
back; Alt+Up and Alt+Down move it without lifting. Every step is announced in a polite live region ("Seceda, Day 3,
position 2 of 4"). The rest of the edit-mode keys are in patterns 1.3.

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

### 8.6 Edit bar (phone)

Step 2 (approved at G-S2, 28 Oct 2026; patterns 3.13 item 4; FLOW TF18 as amended by ruling R2). Under 640 px, while your
trip is in edit mode (`/t/<id>/?edit=1`), the edit bar **replaces** the public bottom bar (1.4); the two never show
together, and there is no second editor bar.

Anatomy: fixed to the bottom above the safe area, `--surface`, 1 px `--line-2` top (decorative: the buttons carry their
names), padding 12 px 14 px 30 px (home inset), height about 84 px (the bottom bar's `phone-bottombar-h`, so the page's
bottom padding does not change), `--z-header`. Four controls, 8 px apart at least: **Undo** and **Redo** at the left (ghost icon buttons, 44 px wide by 50 px high, the existing `undo` and `redo` glyphs at 20 px, `aria-label` "Undo: Remove Lake Louise from Day 2" naming the step, disabled while the stack is empty), then two `lg` 50 px buttons that share the rest: **Settings** (left of the pair)
(secondary: `--ink` on `--surface` 16.06 / 13.83, 1 px `--line-2`) opens the Settings sheet at full height; **Done** at
the right (primary: `--accent-ink` on `--accent` 6.96 / 6.96), the one filled button on the screen (ruling C1), which
leaves edit mode (`pushState` removes `edit=1`) and swaps the public bar back. Undo and Redo sit in the bar because the toast lasts 6 s: a mistake found later is one tap away, not a scroll to the cover's `⋯` (P3; they stay in the `⋯` too). At 360 px the four fit (44 + 44 + 110 + 110 + 3 gaps of 8 in 332). The "n changes" link is not in the bar (it would crowd the labels); it stays in the cover's `⋯` and at the top of the Summary. Nothing else sits in the bar; the fix count is its own button under the
sticky row (patterns 3.13 item 4).

Behaviour: it enters with the bottom bar's 200 ms rise when edit mode starts (a jump under reduced motion); it hides while
a bottom sheet is above half height and while the keyboard is open, as the bottom bar does; the back-to-top button hides
while it shows; toasts stack above it (5.3). At 200% text a label may wrap to two lines inside its button, never truncate.
Screen reader: a `role="group"` named "Editing Canadian Rockies"; the cover's polite announcement covers entering and
leaving.

Do: keep exactly two buttons. Don't: add Undo, a changes count or a third action; don't show the public bar under it.
From 640 px there is no edit bar: the same controls join the sticky row (patterns 3.13 item 4).

### 8.7 Item sheet (stop, day and trip actions)

Step 2 (approved at G-S2; patterns 3.13 item 5; edit-mode-spec 5, 6). One component for three menus: a stop's `⋯`
(4.3 trailing slot), a day header's `⋯`, and the trip's `⋯` on the cover. **Phone** (under 640 px): a bottom sheet (5.5)
opening at half height (full when its rows need it), with a header of the name in `--t-title` `--ink` and one mono
`--t-meta` `--muted` line (6.94 / 7.45 on `--surface`): "Day 3 · 11:30 · Base: Jasper", plus a stop's third mark if it has
one; rows 48 px. **From 640 px**: the same rows as an anchored menu (5.2): `role="menu"`, no scrim, 8 px from its `⋯`,
flipping to stay in view, items 40 px with a 44 px hit area. Labels are the vocabulary's ([step2/README.md](../step2/README.md)
5.2); rows that do not apply to the trip's mode are not drawn (never disabled for that reason).

Stop rows, in this order: **Move to day…** (always the first row) · **Move up** and **Move down** (one row of two 44 px
buttons on a phone; disabled with a reason line when there is nothing to pass: "Seceda is the only stop on Day 2") ·
**Swap with…** · **Swap for a nearby place** (opens the add picker for this stop) · **Add to Maybe** (copies) · **Add a
note** · **Keep on Day 3** (switch with its reason line, built; 9.8) · **Must see** (switch, built) · **Open place page**
· divider · **Remove from Day 3** (`--crit`, 6.61 / 7.01 on `--surface`; last, no confirm, patterns 4.4). Destructive rows
always sit last after the divider (5.2), whatever order a spec lists them in.

**Move to day…** replaces the sheet's rows with the day list in the same sheet (a Back button in its header; on desktop a
popover beside the menu). Days stay in order, each row "Day 4 · Thu 1 Jul", "Base: Jasper", "2 h 10 free", the driving
change "+35 min driving ≈" from the same leg model as the day card, and a chip **Fits** (neutral) or **Tight** (`--warn` on
`--warn-soft`, 6.11 / 7.84); a day that would raise a Fix-level warning says why in `--crit` ("Closed on Thursdays") and
stays choosable. The current day is in its place, disabled, "Now on Day 3" (ruling C3). Inserted days read "Day 6
(added)". A long trip scrolls inside the sheet.

Day rows: **Add a day after Day 5** · **Add a note** · **Version of Day 5** (copies, before conversion) · **Move Day 5
earlier** and **later** (built, within one base's run) · **Reset Day 5** (copies) · divider · **Drop Day 5** (`--crit`;
the stops question or the booking confirm of patterns 4.4).

Trip rows (the cover's `⋯` on your trip): **Undo** · **Redo** (also in the phone edit bar, 8.6) · **Make
it yours** (copies) · **Rebuild** (built) · **Reset to our plan** (copies; confirms over 3 changes, patterns 4.4) ·
**Print** · divider · **Remove from My trips** (`--crit`).

Behaviour: an action closes the sheet or menu and raises its toast with Undo (5.3); a switch keeps it open and changes its
state word; Esc, the close button or a tap on the scrim (phone) closes it, and focus returns to the `⋯` that opened it.
Keyboard as 5.2 (arrows, Home and End, type-ahead). Screen reader: the sheet is a `role="dialog"` and the menu a
`role="menu"`, both named by the opener's name ("Actions for Seceda, Day 3", "Actions for Day 5", "Trip actions").
Reduced motion: the sheet and menu jump.

Do: keep Move to day… first on a phone (Q-BE3: buttons before drag). Don't: use a modal panel with a full-page scrim on
desktop, or bordered 52 px rows (review STEP2-PR S10).

## 9. Plan builder (`/plan/`), approved as amended by Step 2 (G-S2, 28 Oct 2026)

From [trip-builder/design-note-TBN.md](../trip-builder/design-note-TBN.md) (mocks and findings there). Additions A1 to
A9 of [trip-builder/README.md](../trip-builder/README.md) 4, plus two small builder parts. **No new token.** Generic ones
(A1, A3, A5, A8) go to `web/components/ui/` as new files with their own CSS; the rest live in `web/components/plan/`
(trip-builder ISO-8). Ratios light / dark.

**Aligned with [trip-builder/FLOW.md](../trip-builder/FLOW.md) (27 Oct 2026, PLAN-SYNC)** for stages 0 to 4, with reviews
TB-N2 (M1, M4, S3, F-Q4) and TB-N2R (R1, the switch note) applied below. **Amended by [Step 2](../step2/README.md)
ruling R2:** the stages are 0 Kind, 1 Start, 2 Where, 3 Pick, 4 Days and driving, then **Build my days** hands the trip to
the trip details page at `/t/<id>/?edit=1` (patterns 3.12 item 1, 3.13). There is no editor and no Review screen under
`/plan/`; FLOW's stages 5 to 8 are that page's Days, Summary and Bookings tabs. Approved: 9.1 to 9.3, 9.5, 9.7, 9.9, 9.10
as written; 9.1, 9.4, 9.6, 9.8, 9.11 and 9.12 as amended below; 9.13 is written into 2.5.

### 9.1 Step header (phone) and step rail (desktop) (A1)

- **Step header**, under 640 px on `/plan/` only (patterns 3.12 focused flow): 58 px, `--header`, 2 px `--accent` bottom
  rule, `--z-header`. Back (44 x 44 ghost, `back` glyph), the title block (step name in `--t-row` uppercase
  `--header-ink`, 14.82 / 17.49; under it mono `--t-chip` `--header-mute` "Step 3 of 8 · Italy, north-east", 8.98 /
  10.60, one truncating line), the theme toggle and Close (both 44 x 44). Under it a progress row of 4 px segments, 3 px
  apart, 14 px side margins: done `--ink-2`, current `--accent`, ahead `--line`; `aria-hidden` (the text carries the
  step). The count is the number of stages 1 to 4 that **ask** for the kind (FLOW 2.1: Day trip 2, Weekend 3, the rest
  4), sub-line "July · On this phone" (TB-N2R L-R2). The step header ends at Build my days: **the first build lands on
  the trip details page in edit mode** (patterns 3.12 item 1), which uses the page's own cover with its `⋯` (8.7) and
  the edit bar (8.6), not a step header.
- **Step rail**, 640 px and up: 56 px, `--surface`, 1 px `--line` bottom, sticky under the header. Left: the draft's
  name in `--t-row` and a mono sub-line, divided by a 1 px `--line`. Then an ordered list: a 20 px number disc and the
  label in `--t-tab`. Done: disc `--surface-2` with a check, label `--ink-2`, a link. Current: disc `--ink` with
  `--surface` numeral, label `--ink` 600, a 3 px `--accent-text` underline as page tabs (1.6), `aria-current="step"`.
  Not reached: `--muted`, not a link. Skipped for the kind: done look plus its value in mono ("Regions · within 3 h").
  The rail lists stages 0 to 4 and **ends at Build my days** (amended by Step 2: the "Your plan" node is not drawn,
  review STEP2-PR S15); the trip details page has no rail.
  Right end: the step's tools (ghost and secondary buttons) and **the one primary**, which names the next step.
- Tablet (640 to 1023): the rail scrolls sideways with the current step kept in view (as `CategoryStrip`); the primary
  stays pinned at the right.

### 9.2 Pick control (A2)

A pill button with two states and a constant name ("Pick Lago di Braies") plus `aria-pressed`. Phone 44 px tall, desktop
32 px (44 px hit). Rest: `--surface`, 1 px `--line-2` (3.67 / 3.42), `plus` glyph and "Pick" in `--ink` mono 13. Picked:
`--accent-soft` fill, 1 px `--accent` border, `check` glyph and "Picked" in `--accent-text` 600 (5.56 / 7.26); the word
and glyph carry the state, not the border (2.52:1 on light `--surface`). Under 360 px the word is visually hidden and the
button is 44 x 44 (glyph and fill carry the state). Toggling raises no toast; the tray count updates in a polite live
region. No swipe gesture. Never a third state: "Must see" is the tray's toggle (9.4).

### 9.3 Bottom sheet snap points (A3, extends 5.5)

Snap points **peek 120 px** (as 5.5: grab bar and one summary line), **half** (50% of the viewport), **full** (under the step
header). Scroll handoff: while the sheet is below full, a vertical drag on its content moves the sheet; at full, the
content scrolls, and a downward drag at scroll top moves the sheet again. "Expand" and "Collapse" buttons for keyboard
and switch users; Escape collapses one step. The map sheet holds the list over a full-screen map (the map is never
required, T2). Motion `--d-sheet` `--e-out`; reduced motion jumps.

### 9.4 Action bar, tray peek, tray column and tray sheet (A4)

- **Action bar** (phone, replaces the public bottom bar on `/plan/`): `--surface`, 1 px `--line-2` top, 12 px 14 px 30 px
  padding (home inset), height about 84 px. On Pick (stage 3): left a secondary "Map" button (so no floating pill covers
  a row, TB-N2 S7), centre a two-line summary, line 1 mono 13/600 `--ink` ("6 picked · Must see 1"), line 2 `--t-meta`
  `--muted` ("about 5 days (4 nights) ≈"); both truncate, never wrap; right the primary, `lg` 50 px, naming the next
  stage ("Next: Days", or "Build my day" for a day trip). Tap on the summary opens the tray sheet.
- **After the build: one bar, the edit bar** (FLOW TF18 as amended by Step 2 ruling R2). The action bar ends at Build
  my days. On the trip details page in edit mode the phone bar is the **edit bar, Undo · Redo · Settings · Done** (8.6); there is no
  Review button (no Review screen) and no second editor bar. **Undo is never a bar button**: it lives in the Undo toast
  (5.3) and in the cover's `⋯` (8.7: Undo, Redo, Make it yours, Rebuild, Reset to our plan, Print, Remove from My trips).
  Nothing needs "Close plan": Done leaves edit mode, and every edit is already kept.
- **Tray sheet**: "YOUR PICKS (6)", the estimate sentence, rows (title, kind and time on site, the **Must see** toggle,
  Remove). Must see: 44 px pill, `star` glyph and "Must see"; pressed `--accent` fill, `--accent-ink` (6.96).
- **Tray column** (desktop, 280 to 320 px, right of the map): header with the cap label, "About 5 days ≈" in `--t-title`
  and the driving line; rows 48 px with an icon-only Must see (named "Must see Lago di Braies", `aria-pressed`) and
  Remove; a footer line with the drag and Space hints. Empty: the 6.1 empty state, "Nothing picked yet".

### 9.5 Reason chips and "Why this?" (A5)

Reason chips are neutral chips (2.8) with a glyph: draw (`route`, the relevance badge; "Worth the journey" has a 1 px
`--ink` border and 600 weight as on Places), season (`cal`), theme, distance (`car`). Order on any row: **kids or fit
chip, safety and booking chips, then reasons** in the order draw, season, theme, distance. Phone shows one reason at
rest, desktop two; safety and booking never drop. A reason is drawn only when it carries a number or a source
(trip-builder 4.9). "Why this?" is a text button (mono 12.5, underlined) that opens a live disclosure (6.4) under the row
listing the score parts in words; on phones it is in the place sheet.

### 9.6 Did not fit block (A6)

A `--warn-soft` well, radius 12, padding 12 14: cap label "DID NOT FIT (n)" in `--warn` (6.11 / 7.84), then per item the
name in `--t-title` `--ink` (14.17 / 13.05) and the reason as a mono line with the triangle in `--warn` ("No room: days 6
to 9 are at the standard pace's limit"), then **one or two fixes** as small secondary buttons on `--surface` ("Add 1
day", "Swap with…", "Add a base near it", "Change month"). On the trip details page (Step 2): in the Summary with the
Checks, and on Days after the last day, at every width (there is no outline). A fix reruns the engine and confirms with a
toast with Undo. Words come from trip-builder 4.7.

### 9.7 Base letter, base pin and pick spokes (A7)

- **Base letter** (lists, outline, day heads): a 22 px `--ink` square, radius 6, the letter mono 12/600 `--surface`
  (16.06 / 13.83); picked base `--accent` with `--accent-ink` (6.96).
- **Base pin** (map): `--map-base` (26 px `--ink` rounded square) with the **letter** instead of the house glyph, mono 13/600
  `--surface`, 1.5 px `--map-halo` edge, the town name in `--t-sign-s` with halo; picked base `--map-base-pick`.
- **Spokes**: only while the plan's Bases card is expanded (there is no bases step, FLOW TF1), a dashed (3 3) 1 px line from each pick (`--map-stop` dot) to its base, `--ink` at
  55% (3.52 / 5.03 on `--map-land`). **No drive-time rings** (T5; design note C2). The minutes are in the base card.

### 9.8 Lock affordance (A8)

On an item (review TB-N2R R1; Step 2: built trips and converted copies only, never a template copy): **one switch,
"Keep on Day 2"**, in the item sheet or the desktop menu (8.7). It is on
for items the person placed by hand and for locked items, with the reason under it ("On because you placed it. Turn off
to let the plan move it."); off is the `release` operation, on is `lock`. When on, a neutral chip with the `lock` glyph
and the words "Kept on Day 2" (`--ink` on `--surface`, 16.06 / 13.83) leads the item's chip row (on phones never in a
right column); the screen-reader name carries the reason ("placed by you" or "locked"). On desktop rows an icon button
(`unlock` at rest, `--muted`; kept shows the chip) toggles it; key `L` while focus is on a stop (patterns 1.3). The
mark "Placed by you" is never shown: the switch carries that meaning (ruling R6). On a
base: "Keep this base" (secondary, `unlock` glyph) becomes "Kept" with the `lock` glyph; a kept base is never moved by a
rebuild. State is in words, never in colour.

### 9.9 Region chooser (A9)

Group rows 52 px on `--surface`: checkbox (2.5), name `--t-title`, the areas it covers as meta, the count right (mono 13
`--ink-2`), a chevron that expands its regions (44 px rows, indented 46 px, serif 16). Checking a group checks its
regions; a partly checked group shows the indeterminate bar. Thin groups say "Thin: n places" in meta; a region with no
researched places is at 45% with the gap chip "Not researched yet" and an "Ask us to research it" link to the request
form (TB9). The map beside or above it uses admin-1 shapes: rest `--map-land`, coverage as `--ink` at 4% and 14% (a hint
only, 1.31:1, never the only carrier), hover and selected as the globe's shape states (7.2, tokens 5.1).

### 9.10 Kind tile and day chips (builder parts)

- **Kind tile**: `--surface`, 1 px `--line-2`, radius 12, at least 56 px tall (phone, stacked) or 84 px (desktop, **six**
  in a row, FLOW TF2); radio mark (2.5), the kind in `--t-row` uppercase (`--t-sign-s` on desktop), the nights and "by
  car" or "fly somewhere" in mono meta (TB-N2 S8). Each tile is a **button and a tap advances** to Start (FLOW TF2, L4);
  nothing is marked on a first visit. Selected (shown on Back): `--accent-soft` fill, 2 px `--accent` border, filled
  radio mark; name `--ink` (14.11 / 12.57), meta `--ink-2` (10.62 / 9.77). A group labelled "What kind of trip?"; the
  selected tile carries `aria-pressed="true"`.
- **Day chips** (phone build): 44 x 44 minimum cells, radius 8, 1 px `--line-2`, `--surface`; the day in `--t-sign-s`,
  the base letter in mono 11.5 under it; current `--accent` fill with `--accent-ink`. A sideways strip with snap and the
  current day kept in view; tap jumps (P5, no reload).

### 9.11 Make it yours card (copies; review TB-N2 S3)

A fresh copy of one of our trips opens on the trip details page in edit mode (`/t/<id>/?edit=1`, patterns 3.7) with a
**non-modal card** inline **above Day 1** on the Days tab on first open, never a sheet; focus lands on its heading: `--accent-soft` fill, radius 12, padding 14; heading "Make it yours" in `--accent-text` 600 (5.56 / 7.26), text
`--ink` (14.11 / 12.57), three text buttons "Change places · Your driving and pace · Where you start", and the dismiss
"Keep it as it is". The 1 px `--accent` border is decoration (2.52:1 on light `--surface`; the heading names the card).
Dates and who are not on the card (Settings › Dates and Who is going). "Change places" opens the add picker on Day 1;
"Your driving and pace" and "Where you start" open Settings at that section (the engine sections convert the copy first,
patterns 3.13 item 13). After dismissal it is a section of Settings and a row of the cover's `⋯` (8.7). Desktop: inline
above Day 1 in the Days column, never a fifth column; Settings is the sticky row's one Settings button.

### 9.12 State line, not a save button (owner decision F-Q4, amended by Step 2)

**Amended by Step 2 (rulings R2, R9; owner OQ2).** There is no Review screen. Where the trip is kept shows as **a state
word, not a button**: the sync word of patterns 3.13 item 12 ("On this device" signed out, "In your account" signed in,
"Syncing", "Not synced yet", "Not synced · Retry"), mono 12.5 `--muted` (6.94 / 7.45 on `--surface`) at the cover's right
and in the sticky row. Never "Save to Mine", "Keep in Mine" or "Saved": the draft is in Mine from its first pick (FLOW
TF13), so a save button would do nothing (T3). On your own trip the primary is **Edit trip**; **Add to calendar** (dated)
or **Add dates** (undated) is the first secondary; then Export and Share; signed out, Settings' foot says "Kept in this
browser. Sign in to keep it on every device." This replaces the design note's "Save to Mine for a week or longer" and
the earlier "In Mine · on this phone" line.

### 9.13 Note for 2.5 (switch), from review TB-N2R

Approved at G-S2 (28 Oct 2026) and written into 2.5: the thumb position is the on-state indicator. Not repeated here.
