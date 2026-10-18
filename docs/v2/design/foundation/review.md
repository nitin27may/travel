# Trailhead review (18 Oct 2026)

Scope: the eight Trailhead previews in `docs/v2/design/redesign/trailhead/`, rendered on 18 Oct 2026 with
Chromium at 2x, 1440 px wide, light and dark, read in 1600 px tiles; the three phone pages at their drawn
390 px frames; the live site pages for the must-keep list; the prototype on :5191 for behaviour. This page
is the input to [tokens.md](tokens.md), [components.md](components.md), [patterns.md](patterns.md) and
[specimen.html](specimen.html). What changed from the previews is summarised in
[changes-from-preview.md](changes-from-preview.md).

Verdict: **build it.** The structure is right (header with trip chip, sticky trip bar, outline, day signs,
photo cards, honesty markers, four views), the type pairing works, and both themes are legible. The
problems are concentrated in one place: colour is doing too many jobs. Fixing that, and finishing the two
public pages the owner cares about most (globe, trip detail), turns a good set of previews into a foundation.

## 1. What works

- **Light first, slate not black.** `#F5F6F8` paper with `#172230` ink reads as a printed map, not a form.
  Dark mode `#0F1620` keeps the same surfaces one step lighter; photos stay rich at 92% brightness.
- **The trip is always named.** Header chip, trip bar with photo and colour rule, phone top bar, bottom bar
  photo, form header, save button, toast. Rule 1 and rule 4 of trip-scope-scenarios.md are visible in every
  frame, not just claimed.
- **Needs you this week as columns per trip** (home). Ranked by date, coral only on the one row that is
  actually inside 7 days, three verbs only. This is the right answer to the critique's "pink slab".
- **Day sign + Big Shoulders title + mono facts** gives the plan a signpost rhythm. The item row (time,
  kind glyph, serif title, mono meta, italic note, 96 px photo) is the best row in the system.
- **Honesty markers** survive unchanged: dashed coral chips, source counts, "None yet" in the Sources column.
- **Running late shows consequences** before committing (today-phone frame 2). Keep exactly this.
- **Credits on every page** that shows a photo.
- **Public trip cover and season band**: the cover sells the plan; the month strip (solid vs hatched) is
  the clearest version of the season idea so far.

## 2. What does not work, ranked

Severity: **Critical** = a rule, the owner's brief or a reading failure; **Important** = costs a family
time or trust; **Polish** = visible roughness.

### Critical

| # | Screen | What is wrong | Why it matters | Fix (now in the foundation) |
|---|---|---|---|---|
| C1 | all | **Amber means at least nine things.** On `plan.html` alone: primary button, selected view segment, selected tab underline, countdown chip ("In 268 days"), "to book" chip, every expanded day sign, the picked day on the map, all four base pins, the active filter chip, the leave-by number, the cover kicker text. directions.md promised "amber means one thing". | A parent scanning Bookings cannot tell "selected" from "needs booking" from "this is a day". Colour stops carrying meaning and the page gets louder with every feature. | Amber = **selected, now, primary action** only. Countdown chip becomes neutral. "To book" becomes a neutral outline chip; it turns caution (ochre text) when its window is open and urgent (coral) inside 7 days. Only the **focused** day sign is amber; the others are quiet (`--surface-2`). Bases on the map are ink signposts; amber marks the picked day's route and pins only. Cover kickers are white at 80%. Globe controls: only the active option is filled. See tokens.md 3 and components.md "Chips". |
| C2 | public-trip | **The trip detail is chronological only, not categorised.** product-direction says content is categorised (stays, trails, sights, food, logistics) *and* the day by day is chronological. The preview also switches shape halfway: six photo cards, then eight plain rows. | The public page is the selling point. A reader who wants "where do they sleep" or "which trails" has to read fourteen days. | Public trip template (patterns.md 3.4): cover, season band, route map, **"In this trip" category strip** (Stays 4, Trails 9, Sights 6, Food 3, Logistics 5) that opens a categorised list, then **Day by day** as fourteen uniform day rows with a 96 px thumbnail each. One segmented control, By day / By category, over one data set. |
| C3 | all public pages | **Anonymous visitors see "Open a trip", a bell and no way to sign in.** The product is read-only without login first. | Confusing, and it hides the one action a visitor might want (Sign in) behind controls that do nothing for them. | Two header variants (components.md 1.1): public = brand, Trips, Places, Globe, search, theme, **Sign in** (ghost). Signed in adds Home, the trip chip, the bell and the avatar. |
| C4 | places (globe panel) | **The globe is not designed.** The preview shows the live green page as a screenshot. It is the public entry point and the owner asked for full screen with better animation. | The most-wanted public surface has no spec in the chosen direction. | Globe template and controls specified (patterns.md 3.2, components.md 7.2): full-bleed under the 60 px header, floating control card bottom-left (style segment, terrain switch with slider, auto-spin switch), collapsible side panel right, pins as country counts, selection card, fly-in choreography and reduced-motion rules. |
| C5 | plan, public-trip, plan-phone | **Map pins overlap and the "all days" view shows 40 numbered pins.** Misurina shows 3 and 5 stacked, Passo Gardena 8/8/8, Cortina 5/5/3. | On a phone this is unreadable; on desktop the numbers say nothing because fourteen days share them. | All-days view draws routes and bases plus **6 px dots** for stops; numbered pins appear only for the picked day. Co-located stops merge into one pin with a "3 · 5" badge and fan out on hover or tap (components.md 7.1). |
| C6 | trail (glance), home, places | **Green is used for things that are not "done".** Source dots on the trail facts are green for "operator", amber for "community", grey for "plan"; Costa Rica's teal identity ring sits next to teal kind glyphs. | The owner rejected green as a palette colour; green now means only booked, done, fits. Teal kind glyphs collide with the Costa Rica identity. | Provenance is a **text label**, not a dot ("operator · read 18 Oct"). Kind glyphs are ink on a well, no hue. Green stays only in `--ok` (done, booked, fits), justified in tokens.md 3. |

### Important

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| I1 | all | **No focus-visible, pressed, disabled or loading state is drawn anywhere.** | Keyboard users and anyone on a slow connection get an undefined experience; implementers invent their own. | Every component in components.md has all states; the focus ring is a 2 px ink ring with a 2 px paper gap (tokens.md 8). specimen.html shows them. |
| I2 | plan, plan-phone | **Drag handle is a 17 px glyph with no hit area**, 16 px on the phone. | The owner accepted "drag by a visible handle". A handle this small fails the 44 px rule and is hard with a thumb. | Handle is a 24 x 44 px target (28 x 44 on phone), six dots 18 px, `--muted`, becomes `--ink` on row hover and `--accent-text` while dragging. Long-press 300 ms on phone; Move to… menu always present. |
| I3 | bookings-switch frame 2 | **The form drawer covers the end of the trip tab row** (Tasks, Budget) and starts at 143 px, above the trip bar's bottom. Patagonia's meta wraps to two lines and pushes the tabs. | Rule 1: the trip bar stays visible and whole. | Trip bar is one fixed 88 px band with a one-line truncating meta; drawers open below it, full height of the content area (components.md 1.2, 5.1). |
| I4 | home, places | **Mono wraps.** Card meta "Sat 24 Oct 2026, day trip from whitby" runs to two lines; the Needs-you subtitle is a mono sentence; "whitby" is lower-cased by code. | The direction's own rule: mono never sets more than one line. Wrapped mono reads as code. | Card meta is one line, truncated with a title tooltip; the second fact line moves to serif. Section subtitles are serif 15 px. |
| I5 | home | **Readiness is four unlabelled 4 px bars.** | A parent cannot read "what is left to do"; the critique called this out and it is still unreadable. | Readiness becomes one 6 px bar with a mono label "Book 4 of 9 · next Sat 31 Oct"; four segments only on hover/focus with labels (components.md 4.1). |
| I6 | home, trail | **Trip identity colours disappear on white.** Chamonix yellow `#F0E442` and Iceland sky `#56B4E9` are 1.3:1 and 2.3:1 against the card. Only a 4 px bar carries them. | Rule 3: two trips are never told apart by name alone. Yellow fails that on every white surface. | Every identity swatch (ring, bar, square) gets a 1 px `--line-2` keyline. Identity never appears alone, never carries text, and is always next to the photo or the name (tokens.md 4). |
| I7 | plan | **180 px of chrome before content** (header 60 + trip bar 120). On a 900 px window Day 1 starts at 420 px after the Next banner and the add box. | Dense views need their height. | Trip bar 88 px; the Next banner collapses to one 40 px line; add box 44 px. Day 1 starts at about 290 px. |
| I8 | public-trip, trail | **Amber mono kicker on photo** ("PUBLISHED PLAN · SOUTH TYROL") is low contrast on sky. | First line a visitor reads. | Kickers on photos are `#F4F6F8` at 80% with the dark gradient; measured 7:1 on the gradient's darkest band. |
| I9 | places table | **"Planned" dot is amber, "Idea" is a dashed ring; "Comfortable rows" is a toggle that reads as a label.** | Amber here means status, not selection (C1). The density toggle does not show its state. | Status: Planned = filled ink dot, Idea = dashed ring, Done = check. Density is a segmented control (Compact / Comfortable) with the current one filled. |
| I10 | today-phone, plan-phone | **Bottom bar labels are 10.5 px mono; the "Switch" photo is 26 px.** | Thumb-reach switcher is the S8 answer; it should be the most legible item, not the smallest. | Bottom bar: 11.5 px labels, 28 px photo in a 2 px ring with keyline, 56 px items, 84 px bar including the home indicator (components.md 1.4). |
| I11 | plan | **Map legend says "the picked day" but the amber route (Day 3) is drawn even in "All 14 days".** | The legend and the segment disagree. | In All days no route is amber. Picking a day (outline, map chip, day header) is one state shared by document and map. |
| I12 | public-trip | **Weather tiles truncate** ("8–24 °C in the valleys" wraps under a fixed height; the tile title is cut in the tile boundary at 1600 px). | Public readers. | Tiles size to content; the value is Big Shoulders 24 px, the note serif 14.5 px, no fixed height. |

### Polish

| # | Screen | What is wrong | Fix |
|---|---|---|---|
| P1 | home | "Monday 18 October" — 18 Oct 2026 is a Sunday. | Copy comes from the date, never typed. |
| P2 | plan | Insertion line endpoints overlap the pill label; label text "drop here · before 11:30 · the day recalculates" is a sentence. | Pill reads "to Day 3 · before 11:30"; the line runs from the pill's right edge. |
| P3 | plan | Outline rows at 30 px with 14 px serif and a 6 px warning dot; the dot has no text. | Row 32 px; the dot gets a tooltip and an `aria-label` ("1 warning: drive over 2 h"). |
| P4 | bookings | "Held" chip dashed like "Idea". | Held = outline with a clock icon; dashed is reserved for Idea and honesty markers. |
| P5 | all | Buttons are mono, which reads as code in sentences ("Forward a confirmation"). | Buttons stay mono but labels are at most three words in sentence case; longer actions move to a menu. |
| P6 | public-trip | Six day cards then eight rows (see C2). | Uniform day rows. |
| P7 | trail | "All 12 links" header in a 400 px sidebar pushes hazards and links below the fold. | Links become a tabbed group (Official, Booking, Route, Conditions, Report) with counts; hazards move above the fold next to the glance strip. |
| P8 | today-phone | Delay buttons "+15 +30 +45 +60" carry no unit. | "+15 min" on the first only, or an `aria-label` on each; shown in components.md 8.3. |
| P9 | dark map | Contours and rivers are near-invisible at 2x; route halo is `#0F1620` on `#0F1620`-ish relief. | Dark map tokens: contour `#3A4A5C`, water `#3F7C8F`, halo `#0B1119` at 90%, route `#E7ECF1` (tokens.md 5). |

## 3. Colour, light and dark

- **Base.** Paper `#F5F6F8` / ink `#172230` is 14.85:1; dark `#0F1620` / `#E7ECF1` is 15.28:1. Both are AAA.
  Muted text is 6.42:1 and 8.23:1. All 36 allowed text pairs are listed with ratios in tokens.md 2; the
  lowest is 5.45:1 (coral on its soft well, light).
- **Chrome.** Navy header `#172230` with the 2 px amber rule in light; `#0B1119` in dark. The header does
  not change hue between themes, so the brand reads the same on both.
- **Amber.** `#D9962B` carries `#241703` text at 6.96:1; as text it is `#8A5300` (5.85:1) in light and
  `#E8A94A` (8.83:1) in dark. The 2 px underline on a tab is 2.33:1 against paper and is never the only
  indicator (the selected tab is also bold ink).
- **Coral urgent.** `#A8341F` / `#F28E80`, 6.11:1 and 7.75:1 on page. Danger buttons fill `#B3402A` with
  white text (5.70:1) in both themes.
- **Green ok.** `#1D6B3A` / `#8FD0A0`, 6.04:1 and 10.12:1. Kept only for done, booked, fits. Justification:
  "booked" and "fits" are the two states a family checks most and green is the one colour every traveller
  already reads as "yes". It is never a brand colour, never a fill behind a title, never a surface tint.
- **Caution ochre** `#7A5200` / `#E0B15C` and **info slate** `#3D5A78` / `#9DBBDA` are new (tokens.md 3).
  Caution is text plus a triangle on a pale well and never a fill, so it cannot be mistaken for the amber
  accent, which is always a fill.
- **Trip identity** stays Okabe-Ito. Blue `#0072B2` on the dark header is 3.65:1 (passes 3:1 for UI);
  yellow and sky need the keyline (I6). Orange `#E69F00` and vermillion `#D55E00` are the closest to amber
  and coral; they never carry text and never fill a control, so the collision is a ring beside a photo at
  worst. Verified on the home page: Patagonia's orange ring beside the amber "In 131 days" chip is the one
  spot that looks like one hue; the countdown chip is now neutral, which removes it.
- **Map.** Light: stone relief, warm-grey contours, ink routes with a white halo; the picked day in amber
  with a 1 px ink casing so it holds on bright relief. Dark: slate relief, routes in `#E7ECF1`, halo well.
  Pins are ink with white numerals (16:1), amber with ink numerals when picked (6.4:1). Trip colour is used
  nowhere on the map.

## 4. Hierarchy, density, typography

- **Scale.** Seven display sizes are in use (120, 104, 88, 52, 40, 34, 30) and three more for signs
  (22, 19, 15). tokens.md 6 fixes it to eight steps: 96 cover, 72 page, 40 trip, 32 section, 24 card,
  19 sign, 15 small sign, plus the 78 leave-by. Nothing else is Big Shoulders.
- **Body** is Source Serif 4 at 16/1.5; card summaries 16/1.4; meta mono 12.5. On the phone body stays
  16 (iOS zoom). Mono is 11.5 to 13.5 and one line.
- **Density zones.** Reading (public trip, trail, cards): 16 to 24 px padding. Scanning (outline, table,
  bookings rows, needs-you): 8 to 12 px, 32 to 44 px rows. The previews already do this; the foundation
  names the two densities so no screen invents a third.
- **Imagery.** 16:10 card photos with the 4 px identity bar; 96 x 68 item thumbnails; 620 px cover with the
  gradient from 10% to 88% navy. Dark mode dims images to 92%. Kind glyph wells replace missing photos.

## 5. Motion

The previews are static; motion exists only in the README and the prototype. The foundation fixes it
(tokens.md 11, patterns.md 6): 120 ms feedback, 200/260 ms sheets, a spring (stiffness 520, damping 40)
for reorder, distance-scaled fly-to 600 to 900 ms, globe fly-in 1200 ms, count-up 300 ms. What never
animates: text colour on status change, table rows, the trip bar. Reduced motion: fades of 120 ms and jumps.

## 6. Intuitiveness of each flow

| Flow | Verdict | Notes |
|---|---|---|
| Find a trip or place without login | Pass with C3 fixed | Search with `/`, pills, four views and the count are all on the first screen. The header must not show signed-in controls. |
| Use the globe | Not drawn (C4) | Spec written. Pins as country counts, select to open a list card, fly-in on select, hint bar, breadcrumb chip, search. |
| Read a trip day by day | Pass with C2 | Uniform day rows; the categorised strip answers "where do they sleep". |
| Switch trips | Pass | Chip in the header, photo in the bottom bar, ⌘K, ⌘[ and the Back toast. Switching keeps the tab (frame 3 proves it). |
| Add a booking | Pass with I3 | Drawer below the trip bar, photo header naming the trip, "Files under" with Change, "Save to Patagonia". |
| Plan a day | Pass with I2, C5 | Insertion line and pill, predicted change, map follows. The handle needs its hit area. |
| Today on a phone | Pass | Leave-by number, Navigate in the lower half, running-late consequences, offline banner with saved time. S5 note with one-tap back. |

## 7. Accessibility

| Check | Result |
|---|---|
| Contrast, text | All pairs AA; 30 of 36 AAA. Listed in tokens.md 2. |
| Contrast, UI | Input borders raised to `#7A8794` (3.67:1 on white) and `#5E748E` (3.42:1 on dark surface); the preview's `#8C99A8` was 2.9:1. |
| Focus | Not drawn in previews (I1). Fixed: 2 px `--ink` ring, 2 px offset, on every interactive element; inside the navy header the ring is `--header-ink`. |
| Keyboard | Specified per component: `/`, ⌘K, ⌘[, N; Space/arrows for drag; Esc closes and returns focus; roving tabindex in tabs, segments and day strips. |
| Screen reader | Landmarks, `aria-current`, live regions for counts, toasts and remote edits; pins named "3, Tre Cime di Lavaredo loop, 10 km"; local names carry `lang`. |
| Reduced motion | Fades and jumps; no auto-spin; no shimmer. |
| Touch | 44 px minimum, 8 px between targets; day strip chips 48 x 56 with 8 px gap; bottom bar items 56 px. The preview's 6 px gap and 16 px handle are corrected. |
| Text at 200% | Trip bar wraps to two rows; tables scroll in their container with a sticky first column. |

## 8. Rules in trip-scope-scenarios.md

| Rule | Result | Evidence |
|---|---|---|
| 1 One trip in context, always visible | **Pass, with I3** | Trip bar on every trip frame; phone top bar on every phone frame. The drawer overlap is fixed in the foundation. |
| 2 Switching is one action and keeps your place | Pass | bookings-switch frames 1 to 3; the switcher lists in progress first with next deadlines. |
| 3 Every trip has an identity | **Pass, with I6** | Photo and colour on cards, chips, switcher, top bars. Yellow and sky fail on white without the keyline. |
| 4 Nothing silently in the wrong trip | Pass | Form header, "Files under · matched by the dates · Change", "Save to Patagonia". |
| 5 Cross-trip views summarise | Pass | Needs you: tick, snooze, open only. Year view is spec, not drawn. |
| 6 Person-level items shared | Pass | Aarav column linked to Dolomites and Patagonia. |
| 7 Today belongs to the trip in progress | Pass | today-phone frame 1. |
| 8 Reminders name the trip | Pass in spec | Toast and Needs-you rows name the trip; push and email text is in patterns.md 4.5. |
| 9 URLs carry the trip | Pass in spec | `/trips/<slug>/<tab>/<id>`; not visible in static frames. |

S1 to S10: S1, S2, S4, S5, S8, S10 pass as drawn (with I2, I10 on S8); S3, S6, S7, S9 pass in spec. No
scenario fails; S8 is the one that needed component-level fixes to pass honestly (handle size, bottom bar
legibility).

## 9. Must-keep list (keep-from-live-site.md)

| Item | Result | Where |
|---|---|---|
| Real hero photos on cards | Pass | home, public-trip |
| Display title, two lines when long | Pass | home ("Chamonix and Mont Blanc" wraps) |
| Dates, nights, route in small mono | **Pass with I4** | one line, truncate |
| Countdown chip, link chip | **Pass, re-coloured** | countdown is neutral now (C1); "Public page" link chip stays |
| One-sentence serif summary | Pass | |
| Search with `/`, live count | Pass | count in Big Shoulders amber-text (one of the allowed "now and count" uses) |
| Filter pills When, Source; Country, Kind, Status, Kids, Season, Tag, Plan | Pass | |
| Group by, Sort by with direction, group headings with counts | Pass | |
| Cards, List, Table, Map; selected view solid accent | Pass | |
| Top bar: brand, section tabs underlined, theme toggle | **Pass with C3** | public and signed-in variants |
| Place cards with kind glyph when no photo | **Pass, re-coloured** | glyph is ink on a well, not teal (C6) |
| Area chain on the card | Pass | |
| Chips: kind with icon and colour, status (Idea dashed), season, kids | **Partial** | kind chips keep the icon and lose the hue (C6). Kind is carried by icon and word; hue is reserved for trip identity and status. |
| Honesty markers | Pass | |
| Footer links on a card (Place page, Globe) | Pass in spec | components.md 4.2 |
| Grouped by country, sticky header and count | Pass | |
| Table: saved views, columns, density, CSV, collapsible groups, right-aligned elevation | **Pass with I9** | density as a segment |
| Map view with URL state | Pass in spec | |
| 3D globe: relief, drag, zoom, hover facts, fly-in, drill | **Not drawn (C4)**, specified | patterns.md 3.2 |
| Style switcher, 3D terrain, relief slider, auto-spin | Specified | components.md 7.2 |
| Saved-place pins and side panel by country | Specified | |
| Globe search, breadcrumb chip, hint bar | Specified | |

## 10. Rendering notes

Rendered with `prototype/node_modules/playwright-core` and Chromium 1248 at 1440 x 900, 2x, `?theme=light`
and `?theme=dark`, full page, then cut into 1600 px tiles. The three phone pages are drawn as 390 px frames
on a desktop canvas; the desktop pages are not responsive (`home.html` scrolls 1196 px wide at 390 px), which
is expected of static previews and is why patterns.md fixes the phone layouts in words and the specimen
shows the phone components at their real sizes.
