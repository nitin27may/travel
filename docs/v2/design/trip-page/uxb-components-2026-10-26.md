# UXB-N: which tabs, and which components (design note, 26 Oct 2026)

Written 26 Oct 2026 by `travel-design-reviewer` (Opus 5.5) for task UXB-N, after the owner approved the trip and places UX
design (gate G-UXA, Q293 to Q302). Design only: no product code, no change under `web/`. It turns
[the spec](../../features/trip-and-places-ux-fixes.md) (sections 3 to 8) and
[the wireframes](ux-feedback-wireframes-2026-10-26.md) (W1 to W10) into component choices the builders follow, and it
records the foundation entries those choices add: [components.md](../foundation/components.md) 1.6, 2.12, 3.6, 3.7, 4.6,
4.7, 6.4, 6.5 and [patterns.md](../foundation/patterns.md) 3.10, 3.11 (change log row 32 in
[changes-from-preview.md](../foundation/changes-from-preview.md)).

The brief in the spec (13.1) names the file `ux-fixes-note.md`; the coordinator's task named this one. This is that note.

Principles are cited by number from [principles.md](../foundation/principles.md): P1 to P9 and T1 to T5.

## Contents

0. What was rendered and measured
1. **The trip page's tabs: which ones earn a place** (the owner's 26 Oct question, answered first)
2. Element 1: the tab bar as a component
3. Element 2: collapsible sections
4. Element 3: the party editor
5. Element 4: the month strip and the best-time hero
6. Element 5: the Table view
7. Element 6: filters inside tabs
8. Element 7: the Photos tab
9. Element 8: count cards and highlight cards
10. Element 9: place-page templates and the one "Not checked yet" block
11. Foundation additions versus reuse
12. Rejected alternatives (the audit list)
13. Where this note differs from the approved spec, and owner questions Q303 to Q307
14. Changes to the UXB briefs
15. Risks
16. Contrast of every colour pair this note approves

---

## 0. What was rendered and measured

Rendered with Playwright from `web/` (Chromium on the Metal GPU flags, and WebKit), at 2x, light and dark set through
the site's theme button, screenshots in `web/test-results/shots/uxbn/` (not committed):

- The live trip page (`/trips/canadian-rockies-2029/`, release v0.1, the build the owner reviewed) at 1440 and 390, read
  in tiles: cover, "Plan it for", the season band, the glance, the sticky plan bar with the day rail, "In this trip", the
  By day / By category segment and the category chips.
- Place pages `maligne-lake-and-spirit-island` and `akureyri` at 1440 and 390.
- Probes injected into the live trip page (the page's own fonts and tokens, nothing saved): five candidate tab strips and
  two month-strip layouts at 320 and 390, in both engines and both themes.
- The sticky stack on Days at 320 x 640, 390 x 844 and 1440 x 900 (computed positions of every sticky and fixed element).
- The new entries drawn in [specimen.html](../foundation/specimen.html) (section "Trip page tabs, stepper, disclosure,
  month strip, day table, cards, gap block"), rendered at 2x in its light and dark panes (the specimen has no theme
  control; it draws both). That render found two faults now fixed in the entries: a diagonal "avoid" stroke crossed the
  month's label (now a cross-hatched foot band, like "good"), and durations wrapped in the 390 table (now never wrap).
- Mine's tabs could not be rendered (the local NAV build that served `/mine/` has lost its styles); their look is taken
  from the code (`web/app/mine/MineTabs.tsx`, `ui.css` `.seg`) and the specimen's "MINE" section, which was rendered.

Measurements that decide choices below (identical in Chromium and WebKit, because the tab and chip faces are monospaced):

| Measure | 320 (content 292 px) | 390 (content 362 px) | Decides |
|---|---|---|---|
| Five labels "Summary Days Stops Bookings Photos", `--t-tab`, text only | 243 px | 243 px | |
| Same, 12 px side padding (the `pl-tab` and trip-bar look) | 363 px: **does not fit at 390 either** | 363 px: 1 px over | the spec's "fits at 390" holds only with 8 px padding |
| Same, 8 px side padding | 323 px: does not fit | 323 px: fits, 39 px spare | 390 is one row |
| Same, 4 px side padding, Days widened to the 44 px minimum | 287 px: **fits, 5 px spare** | | 320 is one row too, no scroll |
| With counts "Days 15, Stops 76, Bookings 7, Photos 41", 12 px padding | 452 px | 452 px | counts only from 640 px |
| Segmented look (1 px dividers, 12 px padding) | 369 px | 369 px | segmented never fits five at 320 |
| Six labels (adding "Stays") at 4 px padding | 335 px | | a sixth tab breaks 320 |
| Month strip 12 x 1, three letters "Sep", `--t-chip` | cell 21.6 px: **clips** ("Ma", "Ap") | cell 27.4 px: fits | three letters from 340 px content |
| Month strip 6 x 2, three letters plus a state word | cell 46.2 px: fits | 57.8 px: fits | 6 x 2 below 340 px |
| Sticky stack on Days today, phone | header 56 + plan bar 89 = 145 px; bottom bar 84 | same | a sticky tab bar would add 48: 277 of 640 px at 320 is chrome |
| Hatched "possible" month, `--ink` at 35% stripes on `--surface` | 2.13:1 light, 2.87:1 dark | | the hatch is under 3:1; labels drawn on it are hard to read (seen in the probe) |

---

## 1. The trip page's tabs: which ones earn a place

The owner asked (26 Oct) to "think carefully about the trip details design, especially which tabs make more sense". This
section is my own reasoning, not a restatement of the spec. Where I agree with the approved spec I say why; where I do not,
it is listed in section 13 as a proposed change for the owner to confirm. Nothing here changes scope on its own.

### 1.1 The test

A tab earns its place only if all four hold:

1. **Question.** It answers a distinct question a visitor arrives with.
2. **Weight.** It has enough content on at least the two full trips (Rockies, Dolomites) to be worth a click.
3. **Not a filter or a section.** It cannot be done as a filter of another tab, or as a section of another tab, without
   losing something the visitor needs.
4. **Fits.** It still works on a 320 px phone with five tabs or fewer (measured in section 0: five fit at 320 only with
   4 px padding; a sixth does not).

Who is asking, and when (from the spec's personas, P7): **V** a visitor on a phone, arriving from search or a shared link,
deciding whether the trip is for them (the 90%); **P** a planner copying the trip to plan their own dates; **G** a group
member checking logistics before or during the trip, often one-handed with poor signal (T2).

### 1.2 Each candidate

| Candidate | Question | 1 Question | 2 Weight (Rockies / Dolomites) | 3 Not a filter or section | 4 Fits | Verdict |
|---|---|---|---|---|---|---|
| **Summary** | What is this trip, is it for me? | yes: the first screen for V, from search or a share | lead, 5 count cards, 8 of 13 highlights, when to go, the shape, who it suits / lead, 4 cards, 5 highlights, when to go, shape | yes: it is the landing; every other tab assumes the visitor already said "maybe" | yes | **Keep, first and default** |
| **Days** (itinerary) | What happens when, in order? | yes: P's working view and G's field view | 15 day cards with timelines / 14 | no other tab can be the schedule; Table is a second view of the same question, so it lives inside Days | yes | **Keep** |
| **Stops** (by category) | Show me all the trails, stays, sights | yes: "how many trails, which suit us" (owner: "the category view which is good") | 76 distinct items in six categories / 35 | **borderline**: it regroups the Days items. It survives because it is a different list: distinct places (a lake on Days 3 and 10 is one row), with counts per category and, from OVR-2, filters by effort, suits, booking and base. A "Group by" switch inside Days is what the owner has today and found hard to read (shot 11: chips that look like controls) | yes | **Keep** |
| **Bookings** | What must I reserve, when, how much? | yes: P's must-do list; V's "how much admin is this" | 7 rows, none with a published opening date / **3 rows** | **weakest**: 3 rows could be a Summary section, and OVR-2 adds a Booking filter to Stops. It survives because bookings are not all places (car hire, the parks pass, the Moraine Lake shuttle are Logistics items), because the rows need their own order (book first, then ahead, then on the day), and because the planner's trip bar has a Bookings tab (components 1.2): one word for one job across public and planner pages. The owner also named it | yes | **Keep, drawn only when the trip has at least one booking** |
| **Photos** | What does it look like? | yes: V's inspiration | 41 photos in 14 sections / 22 in 8 | as a Summary section it would be 41 tiles long; the highlights already carry the best photos at rest. The owner asked for it | yes | **Keep, drawn only with 6 or more licensed photos** (proposed threshold, Q307; every gallery today has 17 or more, so nothing changes now) |
| Map | Where is everything? | yes | | **fails 3**: the map explains the list beside it. As a tab it would separate the map from the day it shows (P5: the map follows the timeline) | | **Not a tab**: a column beside Days, Stops and Bookings on desktop; a Map button and sheet on phones (as today) |
| Stays, where to stay | Where do we sleep? | yes | 5 stays / 4 | **fails 3**: the Summary's bases ribbon answers it at a glance, and Stays is the first chip in Stops. **fails 4**: a sixth tab does not fit at 320 (335 px in 292) | no | **Not a tab.** Revisit when OVR's "Where to stay" (bundle E) brings open-jaw choices; if it does, it replaces a tab, never adds a sixth |
| Notes, tips, packing | What could go wrong, what to bring? | partly | a handful of trip notes; no packing data | **fails 2 and 3**: trip notes are "Know before you go" in the Summary, day notes live in each day, and safety stays at rest (P2 exception) | | **Not a tab** |
| Season, when to go | When should we go? | yes | one section | **fails 3**: it is part of "is it for me", so it belongs to the Summary (T1: when is part of every answer) | | **Not a tab**: a Summary section |
| Table | All of Day 5 in a grid | no: same question as Days | | a view of Days | | **Inside Days** (List or Table) |

**Result: five tabs, Summary · Days · Stops · Bookings · Photos. I agree with Q293.** The reasons differ slightly from the
spec's: Bookings is kept for consistency with the planner and for the non-place items, not for its row count, and Photos
needs a minimum.

### 1.3 Labels

No usability test has been run; these are judged against plain-language rules (P4: no manual needed) and against words
the site already uses. UXB-V1's first-use walk adds a five-second test: shown the tab bar alone, can a first-time reader
say where the trails are and where the bookings are?

| Slot | Chosen | Alternatives | Why |
|---|---|---|---|
| 1 | **Summary** | Overview | "Overview" is already a trip state ("an overview trip" has no days) and the name of the OVR work; it would say two things. Summary is one common word |
| 2 | **Days** | Itinerary, Plan, Schedule | "Plan" collides with "Plan it for" above the tabs and with the planner's Plan tab; "Itinerary" is 9 letters (+8 px at 320, which does not fit) and harder for non-native readers; the page already says DAY 01. Days is the shortest and matches the day signs |
| 3 | **Stops** (Q302) | Places, Explore, By category | "Places" would point at the site's Places section; "Explore" says nothing about what is inside; "By category" is a mechanism, not a thing. Stops is weak for stays (you sleep at a stay, you do not stop) but reads right for 90% of the rows. I agree with Q302 |
| 4 | **Bookings** | Book, To book | matches the planner tab and the count card's "7 to book ahead" |
| 5 | **Photos** | Gallery | plain |

Translation: the site is English only. If a language is added, longer labels (German "Übersicht · Tage · Stopps ·
Buchungen · Fotos" is about 40 characters) fall back to the scrolling row (section 2.3), which is why the fallback stays
specified even though English fits.

### 1.4 Counts on the tabs

| Tab | Count | Helps? |
|---|---|---|
| Summary | none | |
| Days | "15" | **no**: the cover says "14 nights · 15 days" two lines above and the day rail shows 15 cells; it repeats |
| Stops | "76" | yes: the size of the catalogue in this trip, and the answer to "how many things" |
| Bookings | "7" | yes: the owner's "how many bookings they have to do" (UXF-23) |
| Photos | "41" | mildly: it says the tab is worth opening |

Counts show from 640 px only (they do not fit on phones: 452 px). **Proposal (Q304): drop the Days count**; keep Stops,
Bookings and Photos. The spec's W1 draws all four. The phone gets its numbers from the Summary's count cards, which are
links into the tabs.

### 1.5 Each trip state ends with 2 to 5 tabs

| Trip | State | Tabs | Why |
|---|---|---|---|
| Canadian Rockies | full | Summary · Days · Stops · Bookings · Photos | 7 bookings, 41 photos |
| Dolomites | full | Summary · Days · Stops · Bookings · Photos | 3 bookings, 22 photos |
| Utah, Iceland, Patagonia, Chamonix | summary | Summary · Days · Stops · (Bookings when the export has any) · Photos | galleries of 21 to 42 |
| Algonquin, Vermont | summary | Summary · Days · Stops · (Bookings when any) | no gallery |
| Costa Rica, Norway, Switzerland | overview | Summary · Photos | no days, so no Days, Stops or Bookings |
| New Hampshire, Niagara, Quebec | overview, no gallery | **no tab bar**; the Summary is the page | a tablist with one tab is noise |

A two-tab bar (Summary · Photos) is kept: it passes the test (17 to 24 photos) and matches Mine's two tabs.

### 1.6 First visit, return, copy, share, print

- **First visit**: Summary, whatever the source (search, share without `view`, the Trips list). P7: the 90% first ask
  "what is this".
- **Return**: the last tab for that trip, from `travel.tripui` through `safe.ts`, when the URL has no `view` and no
  `#day-N`. Precedence: URL, then the remembered tab, then Summary (spec 3.4; I agree with Q294). Storage blocked:
  Summary every time.
- **Copying and customising**: Copy to my trips stays in the cover (P7 primary). Customising (CUS, bundle F) edits days,
  so it lives in Days; the tab bar never carries edit controls.
- **Share links**: the URL key is **`view`** (spec D3), not `tab`: `tab=` is already OVR's sub-tab inside Stops, and the
  profile codec's keys (`p`, `pace`, `a`, `walk`, `split`, `d`, `add`) apply on every tab. Share copies the current URL,
  so a link shared from Bookings opens Bookings. (The coordinator's message said `?tab=`; I keep the spec's `view`.)
- **Print**: prints the Summary and the Days (List, or Table when Table is chosen) whatever tab is on screen, never
  Photos, never Stops (it repeats the days' items). **Proposal (Q305): print the Bookings list after the days** when the
  trip has bookings: it is the page a family carries to the desk. The spec prints Summary and Days only.
- **Export** (CSV, GPX, calendar, PDF) is per trip and independent of the tab (P8).

### 1.7 The tab bar against the day rail and the sticky bars

Today on a phone, Days has a sticky stack of header 56 + plan bar 89 = 145 px, with the 84 px bottom bar below (measured).
A sticky tab bar on top of that would make 277 of the 640 px at 320 x 640 chrome: 43% of the screen.

**Rule (proposed, Q303): on phones (under 640 px) only one row sticks under the header.** It is the panel's own navigation
row when the panel has one, and the tab bar otherwise:

| Tab | Phone: sticks under the header | Desktop: sticks under the header |
|---|---|---|
| Summary | the tab bar (48) | the tab bar |
| Days | the plan bar with the day rail (89, as today); the tab bar scrolls away with the content above it | the tab bar, then the plan bar under it (60 + 48 + about 57) |
| Stops | the category strip (as today in By category); the tab bar scrolls away | the tab bar, then the category strip |
| Bookings | the tab bar, with the Map button at its right end | the tab bar |
| Photos | the tab bar | the tab bar |

To change tabs from Day 9 on a phone, the visitor taps the back-to-top button (TOTOP, already built, above the bottom bar),
which returns to the tab bar; P3 "the way back is always visible". A scroll-up-to-reveal tab bar was considered and
rejected (section 12): it costs start JS the page does not have and jitters with the iOS bounce.

Desktop has room (160 of 900 px with both rows).

### 1.8 Keyboard and screen reader plan

- `role="tablist"` labelled "Trip sections"; five `button`s with `role="tab"`, `id="trip-tab-<view>"`,
  `aria-selected`, `aria-controls="trip-panel-<view>"`; roving `tabindex` (the selected tab is 0, the others -1).
- **Manual activation** (a change from spec 3.4's automatic activation): Left and Right move focus, Home and End jump,
  Enter or Space activates. Two reasons. (1) Three panels load a chunk (Stops, Table, Photos); the WAI-ARIA Authoring
  Practices say to use manual activation when a panel cannot show at once. (2) Each activation is a `pushState` (Back
  returns to the previous tab, P5); with automatic activation, arrowing from Summary to Photos would push four history
  entries. Focusing a tab prefetches its chunk, so activation is usually instant.
- Each panel is `role="tabpanel"`, `aria-labelledby` its tab, `tabindex="-1"` (a programmatic focus target, not a tab
  stop). Tab from the tablist goes to the panel's first control.
- A lazy panel, while its chunk loads: `aria-busy="true"` and a `role="status"` line, "Loading the photos".
- **Deep links from the Summary** are real links (`<a href="?view=all#trails">`, `?view=bookings`,
  `?view=day#day-11`) so they work without script, open in a new tab and can be copied. With script, a click switches
  the tab with `pushState`, scrolls so the tab bar stays at its line, and moves focus to the target heading (a day's
  heading, a category heading, the Bookings heading), each with `tabindex="-1"`.
- Arriving by URL (`?view=bookings`, `#day-11`): the tab is selected before paint where the server knows it (`view`);
  hash targets focus the heading after hydration.
- No script: all panels render in order with their headings; the tablist becomes in-page links (spec 3.4).
- The day scroll spy runs only while Days is visible (spec gotcha).

---

## 2. Element 1: the tab bar as a component

### 2.1 Candidates

| | A. Underline tabs (trip-bar look, components 1.2) | B. Segmented tabs (Mine look, 2.9 tab variant) | C. Select on phones |
|---|---|---|---|
| Fit with the foundation | the trip bar's tab look already exists for trip areas | exists for 2 to 3 panel switches | a select is a form control, not navigation |
| Five at 320 | fits at 4 px padding (287 of 292) | never fits (369) | fits |
| Amber at rest | a 3 px underline under one label | a 40 to 44 px amber block, sticky, on every screen, beside the primary "Copy to my trips" and, on Days, the amber current-day cell: three amber blocks at rest (against changes-from-preview 1) | none |
| Shows all options | yes | yes, until it overflows | **no**: options hidden behind a tap, the same class of fault as the Kind filter (UXF-14) |
| ARIA | tabs | tabs | combobox or native select, and the panel relation is lost |
| JS | small (roving focus) | same | none |
| Reuse | the roving logic of `MineTabs` | `MineTabs` as is | `ui/Select` |

**Chosen: A, underline tabs**, as a new component "Page tabs" (components 1.6). B stays for in-panel switches of two or
three (Mine; Days' List | Table is a view, so it stays a radiogroup, 2.9). C is rejected.

### 2.2 Anatomy and states

```
1440  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
      │ Summary     Days     Stops 76     Bookings 7     Photos 41                                   │ 48 px, --bg
      │ ═══════                                                                                      │ 3 px --accent-text under the current
      └──────────────────────────────────────────────────────────────────────────────────────────────┘ 1 px --line hairline (decorative)
390   │ Summary │ Days │ Stops │ Bookings │ Photos │      tabs share the row (flex 1 1 auto), 8 px padding, 323 of 362 px
      │ ═══════                                    │
320   │Summary│Days│Stops│Bookings│Photos│           4 px padding, Days min 44 px: 287 of 292 px
```

- Label `--t-tab` (mono 13.5/500), rest `--muted`, hover `--ink`, current `--ink` at `--t-tab-current-weight` (600) with a
  **3 px underline in `--accent-text`** (5.85:1 light, 8.83:1 dark on `--bg`). Not `--accent`: `--accent` on `--bg` is
  2.33:1 in light, under the 3:1 a state indicator needs. The current state is also carried by colour and weight of the
  label, never the underline alone.
- Count (640 px and up, Stops, Bookings, Photos): mono `--t-meta` `--muted` after the label; in the accessible name as
  "Bookings, 7".
- Height 48; every tab at least 44 px wide (Days is the only label that needs widening at 320).
- Focus: the focus ring inset 3 px (as `.seg-btn:focus-visible`).
- Overflow fallback (200% text, a longer label, a language): the row scrolls sideways with snap per tab and a 24 px
  fade at the right edge, and the current tab scrolls into view on load (as `CategoryStrip`). English at 100% never
  needs it.
- Sticky rule: section 1.7. `--z-sticky`, `--bg` behind it.
- Motion: the underline slides `--d-fast` `--e-std` between tabs; the panel swaps without animation; reduced motion jumps.
- Print and no-script: spec 3.4 and section 1.6.

### 2.3 Props sketch

```ts
interface PageTab<V extends string> { value: V; label: string; count?: number | null; href: string }
interface PageTabsProps<V extends string> {
  label: string;                       // "Trip sections"
  tabs: PageTab<V>[];                  // only tabs with content are passed (never a dead tab)
  value: V;
  onActivate: (v: V) => void;          // manual activation: Enter, Space, click
  onFocusTab?: (v: V) => void;         // prefetch the panel's chunk
  idPrefix: string;                    // "trip" gives trip-tab-<v> and trip-panel-<v>
  countsFrom?: number;                 // 640: counts are drawn from this width
}
```

Lives in `web/components/ui/PageTabs.tsx` (UXB-1). The roving-focus logic is the same as `MineTabs`; UXB-1 extracts it so
both use one helper (Mine adopts it later, a UI-NOTES row, no change to Mine now).

### 2.4 Where it sits

Cover · "Plan it for" bar (collapsed, W3) · **tab bar** · panel · "Take this plan with you" · credits. The party bar is
above the tabs because the party changes Summary (who it suits), Days and Stops (suits).

---

## 3. Element 2: collapsible sections

Sections that open and close: The trip's shape (collapsed by default, remembered), "Plan it for" (the editor), "Other
weeks that work" and "Worth knowing" on phones, "Know before you go" beyond three, the lead's "More" on phones, Facts and
sources and the "Not checked yet" block on place pages.

### 3.1 Candidates

| | A. Native `<details>` / `<summary>` | B. Button disclosure (`aria-expanded`, `aria-controls`) | C. Base UI Collapsible |
|---|---|---|---|
| JS | 0 B; works before hydration | a few lines; the region can be a lazy chunk | the primitive's code in the chunk that renders it |
| Content that loads a chunk or depends on the party | awkward: the content must already be in the HTML | natural: render on open | natural |
| Remembered state | needs script to set `open` after hydration | same | same |
| Find in page | Chrome opens a closed `details` on a match | hidden content is not found | as B |
| Print | a closed `details` prints closed; needs a `beforeprint` handler | the print decides what to render | as B |
| Animation | `::details-content` with `interpolate-size` in Chrome; Safari jumps | grid-rows 0fr to 1fr, every engine | built in |
| Accessibility | announced as a disclosure by every reader | correct when the attributes are right | correct |
| Start JS on the trip page (about 460 to 530 B headroom) | none | small | **too much for the start chunk** |

**Chosen: two kinds of one component, "Disclosure" (components 6.4).**

- **Static disclosure = A**, for server-rendered text that needs no state: "Other weeks", "Worth knowing" (phone), "Know
  before you go: n more", the lead's "More", place pages' Facts and sources and the long gap block. Zero JS, finds in page,
  place HTML budget friendly (P8, P9).
- **Live disclosure = B**, when the content is a lazy chunk, follows the party, or is remembered: The trip's shape (rows
  render from the current profile), "Plan it for" (the editor chunk loads on Edit).
- C is rejected for the trip page's budget; it remains fine inside chunks that already carry Base UI (the copy sheet).

### 3.2 States and behaviour

| State | Static (details) | Live (button) |
|---|---|---|
| Closed | summary row: label, count "(3)", chevron down; `--t-row` heading size or `--t-label` for small ones | button with the same look, `aria-expanded="false"` |
| Open | chevron up; content | `aria-expanded="true"`; content, or a `role="status"` "Loading the days" while the chunk loads |
| Remembered | no | per trip in `travel.tripui` (`shapeOpen`, `partyOpen`) |
| Safety content | a hazard or closure line is never inside a closed disclosure; it stays at rest (P2 exception) | same |
| Print | a `beforeprint` handler opens every static disclosure and `afterprint` restores it (one listener, in the existing print code) | the shape prints its ribbon and count line (server HTML), not the per-day table (the days follow) |
| Motion | height via grid rows 0fr to 1fr, `--d-base` `--e-std`; reduced motion jumps | same |
| Target | the whole summary row, at least 44 px tall | the button, at least 44 px |

The count phrases of The trip's shape ("4 long drive days") are each a live disclosure button that opens the table
filtered to those days, with "Show all days" in the table's caption row.

---

## 4. Element 3: the party editor

### 4.1 Candidates per control

| Control | Stepper | Select (native) | Segmented | Number input |
|---|---|---|---|---|
| Adults 1 to 12 | **chosen**: 1 or 2 taps for the usual 1 to 4; value visible | 12 options for a value that moves by one | 12 segments do not fit | keypad covers half the screen; needs validation |
| Children 0 to 8 | **chosen**: each + appends a child row | possible, but the age rows appear far from the control | no | no |
| Each child's age 0 to 17 | up to 17 taps per child; 8 stacked steppers are heavy | **chosen**: one tap opens the phone's own picker (wheel on iOS, list on Android), type-ahead on desktop; "Under 1" for 0 | 18 segments no | no |
| Pace | | | **chosen** (exists, radiogroup) | |

Mobile numeric keypad versus wheel: the native select gives the wheel on iOS and a list on Android, both one-handed, no
keyboard, no invalid entry. A number input was rejected: the keypad hides the editor, accepts "7.5" and "-1" and needs
error states the select does not.

### 4.2 The Stepper component (new, components 2.12)

Three steppers exist today with three looks: the Youngest stepper in `ProfileBar` (`tl-stepper`, 40 px), the copy sheet's
children (`trav-step`, `Button size="sm"`) and the filters' `AgeControl` (`age-step`, 44 px). The editor needs two more.
**One component replaces them**: `web/components/ui/Stepper.tsx`.

```
┌─────────────────────────────┐
│ Adults          [ − ]  2  [ + ] │  44 x 44 buttons, 8 px apart from the value, value mono 600 --t-tab in a 40 px output
│ Children        [ − ]  1  [ + ] │
│ Child 1 age     [ 10         ▾] │  ui/Select, 46 px on phones (inputs 2.2), "Choose age" until set
└─────────────────────────────┘
```

```ts
interface StepperProps {
  label: string;                // visible label, also the group's name: "Adults"
  value: number; min: number; max: number;
  onChange: (n: number) => void;
  decLabel: string; incLabel: string;   // "Fewer adults", "More adults"
  format?: (n: number) => string;       // "Under 1" for 0 when used for an age
}
```

- `role="group"` labelled by the visible label; the value is an `<output aria-live="polite">`.
- **At a bound the button stays focusable** with `aria-disabled="true"` and 45% opacity; it is never `disabled`, because a
  disabled button under the finger loses focus to `body` (components: focus is never lost to `body`).
- Buttons: secondary look (2.1), 44 x 44 visual on every width (they sit in a form, not a dense toolbar), glyphs `minus`
  and `plus` 16 px `--ink`.
- Keyboard: Tab to each button; Enter or Space steps; the group also takes Up and Down on either button (one step), Page
  Up and Page Down are not needed at these ranges.
- No spinbutton role: the two real buttons are easier for switch and voice users ("click More adults").

### 4.3 Editor states

| State | Shows |
|---|---|
| Collapsed (default) | "PLAN IT FOR  2 adults · 1 child (10) · Standard pace  [pencil Edit]" (W3) |
| Open | adults, children, one age select per child, pace, More (Longest walk, Split days), the live profile line, the device note, Done |
| Child added | a new "Child n age [Choose age]" row; focus moves to its select; the profile line says "age not set, planning for 10" (FAMAGE10) |
| Child removed | the last row goes; focus stays on "Fewer children" |
| Shared link | "Shared plan: family, youngest 6" with "Use my party (2 adults, 2 children)" (W3) |
| Storage blocked | works for the session; the device note says "This browser is not keeping data" |

Validation: no invalid value is possible (steppers bound, selects closed lists); the only gap is an unset age, which plans
as 10 and says so. The copy sheet's adults select goes from 1 to 10 today; the shared `Travellers` block (UXB-2) makes it
1 to 12 so the sheet and the page agree (Q296).

Motion: the editor grows from the bar `--d-base` `--e-std` (live disclosure, 3.2); reduced motion jumps. Done or Escape
closes and returns focus to Edit.

---

## 5. Element 4: the month strip and the best-time hero

### 5.1 Layouts

| Content width | Layout | Cell | Words |
|---|---|---|---|
| 340 px and up (390 phones, tablets) | 12 x 1, three-letter names | 27 px at 390 | state words in a legend under the strip |
| under 340 px (320 phones) | 6 x 2, three-letter names | 46 px wide, 44 px tall | the state word inside the cell ("best", "good") |
| desktop | 12 x 1 at a fixed 56 px per cell (705 px with gaps) | 56 px | the state word inside the cell |

Single letters are never used (finding I7). This differs from W4 390, which allowed letters with a legend: the probe shows
three letters fit at 390, so letters are not needed. The switch is a container query on the strip, not a viewport query,
so the strip is right in the desktop map-column layouts too.

### 5.2 States, without colour alone

```
desktop   Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
          [  ][  ][  ][  ][  ][  ][  ][  ][██][  ][  ][  ]
                                good       best                 (hatched band under Jun, solid Sep, words in the cells)
```

| State | Look | Pair (light / dark) |
|---|---|---|
| best for this plan | `--ink` fill, label `--surface` 600, word "best" | 16.06 / 13.83 |
| also good, with trade-offs | `--surface` cell; a 6 px band at its foot hatched with 2 px `--line-2` stripes at 135 deg; word "good" | label 16.06 / 13.83; stripes 3.67 / 3.42 |
| the plan's months (no windows file says "best") | `--surface`, 2 px `--ink` border | 16.06 / 13.83 |
| avoid (only with a sourced reason) | `--surface`, label `--muted`, a 6 px foot band cross-hatched in 1.5 px `--ink-2` lines, word "avoid" | 6.94 / 7.45; lines 12.09 / 10.76 |
| not researched | `--surface`, 1 px `--line-2` border, label `--muted` | 6.94 / 7.45 |

Today's hatch (`--ink` at 35% over the whole cell, 2.13:1 light) carries the label on the stripes; the band keeps every
label on a solid fill. No new token: the stripes use `--line-2`.

Screen reader: an ordered list of twelve items, each with hidden text "September, best for this plan"; the visible
three-letter names are `aria-hidden`. A summary line before it ("Best: September. Also good: June, August.") so a reader
does not have to walk twelve items. Replaces `SeasonStrip`'s `role="img"`.

### 5.3 Hero and cards

- Hero: kicker "Best time for this plan" (`--t-cap` `--muted`), the window in `--t-trip` `--accent-text` (5.85 / 8.83,
  large text), one sentence `--t-body-l`.
- Four equal cards (Temperature, Rain and snow, Daylight, Crowds): `repeat(4, 1fr)` from 640 px, `repeat(2, 1fr)` below;
  `--surface`, `--r-3`, `--b-hairline`; key `--t-cap` `--muted`, value `--t-body`. "Crowds: not checked" uses the gap chip
  (2.8) inside the card.
- Worth knowing: `info` glyph for advice, `warn` only for a closure or hazard (I9).
- Weather links: "Forecast: Banff, Jasper... (Environment Canada)" as ordinary links with the publisher named and "(opens
  in a new tab)" hidden text.

Component: **Month strip** (components 4.7), in `web/components/ui/SeasonStrip.tsx` rewritten by UXB-4; server-rendered,
no JS.

---

## 6. Element 5: the Table view

### 6.1 Candidates

| | A. One `<table>` per day, three columns on phones with folded lines | B. Definition-list cards on phones, table on desktop | C. One table with sideways scroll (DataTableShell) | D. One table with day group rows |
|---|---|---|---|---|
| Screen reader | a table per day; the reader's table list is the day list | two structures, two tests | one table | one table of 200 rows |
| Phone | no sideways scroll (Q299) | no scroll | hidden columns: options off screen, the fault the owner saw in Kind | no scroll only if folded |
| Print and CSV parity | the same rows; print uses six columns | two renderers to keep equal | one | one |
| Page breaks | one day never splits when it fits | | | breaks inside days |
| JS | lazy chunk | lazy, larger | lazy, plus TanStack | lazy |

**Chosen: A** (as the spec, D9), as a new component **Day table** (components 4.6), a lighter sibling of the data table 4.2:
no tools row, no sorting, no selection, no cell focus.

### 6.2 Anatomy

```
1440  DAY 04 · Lake Louise to Jasper townsite · 07:30 to 19:00 · 2 h 55 driving            <caption>, --t-row
      ┌───────┬─────────────────────────────┬───────────┬──────────────────┬─────────┬──────────────┐
      │ Time  │ What                        │ Kind      │ Where            │ Takes   │ Notes, book  │ head --well, mono 12 --muted
      ├───────┼─────────────────────────────┼───────────┼──────────────────┼─────────┼──────────────┤
      │ 08:15 │ Bow Lake                    │ lake      │ Icefields Pkwy   │ 45 min  │              │ rows 44 px
      │ 07:30 │   Drive to Bow Lake         │ drive     │                  │ 30 min  │              │ drive rows indented, --muted
390   ┌──────┬──────────────────────┬──────┐
      │ Time │ What                 │Takes │
      │08:15 │ Bow Lake             │45 m  │
      │      │ lake · Icefields Pk  │      │   folded line: --t-meta --muted
```

- Takes is mono 13 and never wraps ("45 min" wrapped to two lines in the specimen render before this rule).
- Time cell is `<th scope="row">` in `--t-time`, with the timeline's confidence wording ("~08:45").
- Under 640 px the Kind, Where and Notes `th` and `td` are `display: none` and the folded lines in What are shown; from
  640 px the opposite, and the folded lines are `aria-hidden`. The header row and the cells always match in count.
- **Sticky head only from 640 px**, at the line under the tab bar and the plan bar (a CSS variable for the sticky band's
  height). On phones the caption names the columns well enough, and a third sticky row would cover the rows (1.7).
- Print: `@media print` uses the six-column layout, repeats the header per page, `break-inside: avoid` per table.
- Above the tables: `[List | Table]` (Segmented, radiogroup, `view=table`) and `Show [Everything | Stops only]`
  (Segmented `s`, `rows=stops`, remembered), "Print this table", Export menu (existing).
- Empty: a day with only a transfer still has its rows (leave, drive, arrive); no empty state needed.

---

## 7. Element 6: filters inside tabs

Where filters appear: Stops (OVR-2, bundle E: Effort, Duration, Booking, Day, Base, Suits, Season fit, Kind) and Bookings
only above 12 rows (spec 3.3, P1: no filter bar for 7 rows).

### 7.1 Candidates

| | A. Filter pills with menus (2.7, `FacetPill`) | B. One "Filters (n)" sheet | C. Chips as toggles | D. A listbox popover |
|---|---|---|---|---|
| State visible at rest (P4) | yes: "Effort · Easy" on the pill | only the count on the button | yes | no |
| Phone | the KIND-FILTER-FIX (merged 26 Oct, `01c82b44`) docks every pill menu above the bottom bar under 640 px: as tall as the room, options scroll inside, a sticky head with "n selected", Done in view, the page behind locked | the bottom sheet (5.5) | wraps or scrolls; many values hide | the anchored popover that could not scroll is the fault UXF-14 fixed |
| Counts per option | yes (`PillOptions`) | yes | possible | yes |
| Reuse | `FacetPill`, `PillOptions`, `BottomSheet` | `BottomSheet` | `Chip` would become interactive | Base UI Select |

**Chosen: A on desktop, A or B on phones by count, the places page's pattern:** up to four pills in the bar (P4's four, six
with a chosen Kind), the rest under "More filters"; on phones, one "Filters (n)" button opening the full-height sheet
with live counts when there are more than two pills, else the pills themselves with the docked menus. One "Clear all".
Counts update as options change. Zero results: the empty state (6.1) "No trails match these filters" with **Clear
filters**.

The category chips in Stops stay what they are: navigation with counts (`CategoryStrip`), not filters.

**Bookings today: no filter row.** Rockies has 7 rows and Dolomites 3. W7 draws "[Day v] [Kind v]" over the Rockies' 7
rows; that contradicts spec 3.3's own rule and is dropped (section 14, UXB-6).

Components: no new entry; components 2.7 gains one paragraph recording the docked phone menu (it was built but not
written down).

---

## 8. Element 7: the Photos tab

### 8.1 Candidates

| | A. Grid by section (existing `Gallery`, 16:10, 3 columns, 2 on phones) | B. Masonry | C. Carousel |
|---|---|---|---|
| Shows everything | yes | yes | no: one at a time, most photos hidden |
| Reading and focus order | row by row, matches the eye | columns: focus jumps up and down | linear |
| Layout shift while loading | none (fixed ratio, width and height set) | shift as images load unless sizes are known | none |
| JS | the existing lazy chunk | a library or CSS masonry (not in Safari) | a carousel script and its ARIA |
| Credits | under each tile | awkward with uneven tiles | one at a time |

**Chosen: A**, grouped by the gallery's sections, each section heading linking to its place when one matches and its day
signs ("Day 11"); sections the plan does not visit say "Nearby, not in this plan" in `--t-meta` `--muted`.

### 8.2 Credits on every photo

Components 4.5 shows a tile's credit only on hover or focus. A phone has no hover, so in the Photos tab **each tile carries
its credit line under it at rest**: author · licence, mono `--t-chip` `--muted` (6.42 / 8.23 on `--bg`), one truncating
line, with the full title, author and linked licence in the lightbox caption and in the page's Credits footer. This is an
amendment to 4.5 for galleries of 6 or more (the Photos tab); small inline galleries keep the hover strip.

### 8.3 Loading and the lightbox

- The tab's chunk loads on activation (prefetched on tab focus); images `loading="lazy"`, `decoding="async"`, `srcset`
  and `sizes` as `Gallery` does now, fixed 16:10 boxes so nothing shifts.
- Lightbox: the existing one (Base UI Dialog, arrows, swipe, Escape, focus returns to the tile). No change needed for
  this work; the shared-element move stays unbuilt.
- Counter in the tab header: "41 photos · 14 places".

---

## 9. Element 8: count cards and highlight cards (Summary)

### 9.1 Count card (components 3.6, new)

```
┌──────────────────────┐
│ 33 trails          › │   value --t-row (Big Shoulders 21) --ink; chevron 16 --muted
│ 186.5 km, all        │   sub mono --t-meta --muted, at most 2 lines
│ versions             │
└──────────────────────┘   --surface, --b-hairline, --r-3, min 72 px tall (44 px target met)
```

- **The whole card is one link** (`<a href>` as in 1.8), no inner "See trails" button: W2 draws one inside each card,
  which would make two targets for one destination. The chevron says "goes somewhere".
- Hover: border `--line-2`, background unchanged; focus ring on the card; pressed 1 px down.
- Grid: five or six in a row on desktop (`repeat(auto-fit, minmax(160px, 1fr))`), 2 x 3 on phones.
- A card with no data is not drawn (W2 Costa Rica); a total always carries its coverage ("climb known for 27 of 33").
- Server-rendered; no JS.

### 9.2 Highlight card (components 3.7, new)

```
┌─────────────────┐
│ [photo 4:3]     │   gallery photo by name, or the kind glyph on --well with "No licensed photo yet"
│ Moraine Lake    │   --t-card two lines max
│ Day 11          │   day links: mono --t-meta, each a separate link to ?view=day#day-11
└─────────────────┘
```

- The card is one link to the place page (components 3.1: whole card one link); the day signs are separate focus stops
  above it (the card's link is a stretched link under them).
- Desktop: two rows of four. **Phone: a 2 x 2 grid with "Show 4 more" (a static disclosure) and "See all 13" linking to
  Stops filtered to "Worth the journey"** (proposal Q306). W2 draws a sideways snap row of 160 px cards; a sideways row
  hides five of eight cards off screen, which is the class of problem the owner reported for Kind (UXF-14), and P1 asks
  for counts and grouping rather than carousels.
- Photo credits: the page's Credits footer lists every highlight photo (plan 2.5); the card has no hover strip.

---

## 10. Element 9: place-page templates and the one "Not checked yet" block

### 10.1 Choices

| Piece | Component | Why |
|---|---|---|
| Sections drawn only with a value or a safety gap | existing section shell (`.ps`), with the hide rule in the model (`hasValue`, `safety`, UXB-C) | no new component; the rule is data |
| Safety gap row | the suitability **gap** chip (2.8): dashed `--line-2`, `--muted`, "Minimum age: not checked yet" | exists; at rest (P2 exception) |
| The gap block | **new: "Not checked yet" block** (components 6.5) | one place for every non-safety gap |
| "What is not checked" from the completeness chip | an in-page link to `#not-checked`, not a popover | 0 JS, the place HTML headroom is 113 B, and Back returns |
| Facts and sources | static disclosure (6.4, `details`) | sources only, collapsed |
| Links by group | `LinksTabs` when two or more groups have links; **a plain list when one group has links**; no tab for an empty group | a tablist of one tab is noise; empty tabs are the "five empty link tabs" finding |
| Basics template | identity, actions, map, nearby, trips, one "Not researched yet" line | the same block component with one line |
| Empty states | not used on place pages | a gap is not an empty container |

### 10.2 The block

```
NOT CHECKED YET                                                       h2, --t-cap --muted, id="not-checked"
Route          track high point, turnaround points                    name mono --t-label --ink-2; items --t-small --muted
When to go     best weeks, best time of day, snow-free window
Facilities     toilets, drinking water, shade, phone signal
[Show 2 more sections]                                                static disclosure when more than 5 lines
```

- A `<dl>`: section name as `<dt>`, the gap names as one `<dd>`. On `--bg`, no box, at the end before Facts and sources.
- Pairs: `--ink-2` on `--bg` 11.18 / 11.88; `--muted` on `--bg` 6.42 / 8.23.
- Basics pages: one line "Not researched yet: season, parking, getting there, fee, hazards, summary, photo, links".
- Zero JS; it removes more bytes than it adds (spec 8.7).

---

## 11. Foundation additions versus reuse

| Element | Reuse | New foundation entry |
|---|---|---|
| Tab bar | roving focus of `MineTabs`; trip-bar tab look (1.2) | **components 1.6 Page tabs (public trip)**; patterns **3.10** (template, sticky rule, URL) |
| Collapsible sections | `details`; the `tl-more` button pattern | **components 6.4 Disclosure** (static and live) |
| Party editor | `ui/Select`, `Segmented`, `Banner` | **components 2.12 Stepper** (replaces three) |
| Month strip, hero | `SeasonStrip` file (rewritten) | **components 4.7 Month strip** |
| Table view | data table look (4.2), `Segmented` | **components 4.6 Day table** |
| Filters | `FacetPill`, `PillOptions`, `BottomSheet`, `EmptyState` | components 2.7 gains the docked phone menu paragraph |
| Photos | `Gallery`, `Lightbox`, `Credits` | components 4.5 gains the visible credit line |
| Count and highlight cards | Card 3.1 rules | **components 3.6 Count card, 3.7 Highlight card** |
| Place templates | section shell, gap chip, `LinksTabs`, `details` | **components 6.5 "Not checked yet" block**; patterns **3.11** (hierarchy, hide-empty, templates) |
| URL | | patterns 1.2: the trip row gains `view` values and `rows` |
| Motion | | patterns 6: page tab, disclosure, party editor rows |

No new token. No new colour. The amber underline uses `--accent-text`, the hatch uses `--line-2`, the "avoid" band
`--ink-2`. `tokens.md` and `tokens.json` are unchanged; the specimen draws every new entry in both themes.

---

## 12. Rejected alternatives (the audit list)

| Rejected | For | Reason |
|---|---|---|
| A sixth tab, Stays or Map | tabs | fails test 3; a sixth does not fit at 320 (335 px in 292) |
| Itinerary, Plan, Overview, Places, Explore as labels | tabs | 1.3 |
| Segmented-look page tabs | tab bar | never fits five at 320 (369 px); three amber blocks at rest on Days |
| A select instead of tabs on phones | tab bar | hides the options behind a tap (the UXF-14 class of fault); loses tab semantics |
| A scrolling tab row at 320 as the default | tab bar | five fit at 4 px padding; scrolling stays only as the overflow fallback |
| Automatic activation | tab keyboard | lazy panels and one history entry per arrow press (1.8) |
| A sticky tab bar on top of the day rail on phones | sticky stack | 277 of 640 px of chrome at 320 x 640 |
| A tab bar that hides on scroll down and returns on scroll up | sticky stack | start JS the page does not have; scroll-linked jitter with the iOS bounce; back-to-top already returns to the tabs |
| Base UI Collapsible on the trip page | disclosure | its code in the start chunk for what `details` and a button do |
| Only `details` everywhere | disclosure | the shape's rows and the party editor are lazy chunks that follow the profile |
| Steppers for each child's age | party | up to 17 taps per child; 8 stacked steppers |
| Number inputs for ages | party | the keypad covers the editor; invalid values need errors |
| Single-letter months at 390 | month strip | three letters fit (27.4 px cells); single letters repeat J, M, A (I7) |
| The full-cell hatch for "also good" | month strip | 2.13:1 stripes with the label on them |
| Definition-list cards on phones | table | two structures to keep equal; screen readers lose the table |
| Sideways scroll for the table | table | hidden columns on phones (Q299) |
| One table with day group rows | table | one 200-row table; days split across pages |
| A listbox popover for filters | filters | the anchored popover is the fault UXF-14 fixed |
| Chips as filter toggles | filters | chips are never interactive unless they say so (2.8); many values hide |
| Filters on Bookings at 7 rows | filters | spec 3.3's own rule: more than 12 |
| Masonry photos | photos | focus order jumps, shift while loading, no Safari CSS masonry |
| A photo carousel | photos | hides most photos; more ARIA and script |
| Credit on hover only in the Photos tab | photos | no hover on phones; every photo needs its credit line |
| A "See trails" button inside each count card | count card | two targets for one destination |
| A sideways highlight row on phones | highlight card | five of eight cards off screen (Q306) |
| A popover for "What is not checked" on place pages | place page | JS and bytes on a page with 113 B headroom; an anchor does it |
| A tablist with a single link group | place page | a tab of one is noise |

---

## 13. Where this note differs from the approved spec, and owner questions

### 13.1 Agreements

Q293 (five tabs, Table inside Days, map beside the lists): **agree**, reasons in 1.2. Q294 (Summary default, last tab
remembered): **agree**. Q302 (Stops): **agree**, 1.3. The `view` key (D3) rather than `tab`: **agree**.

### 13.2 Differences that need the owner (next free numbers on `main`: Q303 to Q307)

| Q | Question | Recommendation | Trade-off | Spec place it changes |
|---|---|---|---|---|
| Q303 | On phones, only one row sticks under the header: on Days the day rail (as today) and on Stops the category strip, while the tab bar scrolls away with the content above; back-to-top returns to the tabs. Desktop keeps both rows sticky | **Yes** | changing tabs from deep in Days on a phone is one extra tap (back to top) | 3.4 "sticky under the header", W1 |
| Q304 | Counts on the tabs on desktop for Stops, Bookings and Photos only; drop "Days 15" (the cover and the day rail already say it) | **Yes** | one number fewer | W1 |
| Q305 | Print adds the Bookings list after the days when the trip has bookings | **Yes** | about one more printed page on the Rockies | 3.4 Print |
| Q306 | Highlights on phones as a 2 x 2 grid with "Show 4 more" and "See all 13", not a sideways row | **Yes** | a taller Summary on phones (about 420 px for four cards) | W2 390 |
| Q307 | The Photos tab is drawn only with 6 or more licensed photos; fewer go into the Summary as a small strip | **Yes** | none today (every gallery has 17 or more) | 3.1, W1 tabs by state |

### 13.3 Differences that do not need the owner (folded into the briefs, section 14)

- Manual activation of tabs instead of automatic (1.8): an accessibility detail inside the approved design.
- Tab padding 4 px at 320, 8 px at 390, 12 px from 640, which makes five tabs fit on one row at 320 (the spec expected a
  scrolling row at 320 and "measure" at 390); the scroll stays as a fallback.
- The current-tab underline in `--accent-text`, not `--accent` (contrast, section 16).
- Month strip: three letters at 390 (W4 allowed letters), 6 x 2 under 340 px, the hatch as a band.
- No filter row on Bookings at 7 rows (W7 contradicted 3.3).
- No inner button in count cards (W2).
- A tablist of one link group becomes a list on place pages.

---

## 14. Changes to the UXB briefs

Noted in the spec's briefs as "UXB-N notes" lines (no restructuring):

| Brief | Change |
|---|---|
| UXB-1 | Page tabs per components 1.6 in `web/components/ui/PageTabs.tsx` (new, owned by UXB-1); manual activation; padding rule; `--accent-text` underline; counts from 640 px; the phone sticky rule if Q303 is yes; count cards and highlight cards per 3.6 and 3.7 (whole-card links; phone highlight grid if Q306 is yes); print adds Bookings if Q305 is yes |
| UXB-2 | `web/components/ui/Stepper.tsx` (new, owned by UXB-2) replaces the three steppers it touches (`ProfileBar`, the copy sheet's children); `AgeControl` adopts it later (UI-NOTES); the copy sheet's adults go to 12 |
| UXB-3 | The shape's open and close is a live disclosure (6.4); count phrases are disclosure buttons; print shows the ribbon and the count line |
| UXB-4 | Month strip per 4.7: three letters at 340 px content and up, 6 x 2 below, the "also good" hatch as a 6 px `--line-2` band, an ordered list with hidden full names, a summary line first |
| UXB-5 | Day table per 4.6: sticky head only from 640 px; print uses six columns |
| UXB-6 | Bookings: no filter row while the trip has 12 or fewer; Photos: the credit line under each tile at rest (4.5 amendment); the tab drawn at 6 or more photos if Q307 is yes |
| UXB-7 | The completeness chip's "What is not checked" is an anchor to `#not-checked`; the block per 6.5; Facts and sources a static disclosure; a single link group renders as a list |

---

## 15. Risks

| Risk | Where | Mitigation |
|---|---|---|
| Trip start JS: the tab shell adds roving focus to a chunk with about 460 to 530 B headroom | UXB-1 | the By day / By category `Segmented` and `CategoryStrip` leave the start chunk (Stops is lazy), and the party editor's `Segmented` and steppers move to the editor chunk (UXB-2); measure with `budget:report` in both builds; manual activation needs no extra code |
| The 320 fit has 5 px to spare | UXB-1 | a later label change or a font swap overflows; the scroll fallback catches it; the e2e at 320 asserts no overflow in English |
| Two sticky rows on desktop Days cover 160 px | UXB-1 | measured 18% of 900 px; the map column's top follows the same CSS variable |
| `details` printing closed | UXB-1, UXB-7 | the `beforeprint` handler; a print e2e |
| Remembered open states shift layout after hydration | UXB-2, UXB-3 | both default closed and open below the fold; the shift is in the Summary's middle, not above the first screen |
| The hide-on-Days sticky rule surprises a returning visitor | UXB-1 | if Q303 is no, the fallback is both rows sticky with the plan bar's party line dropped on phones (89 to 52 px) |
| Manual activation feels slower | UXB-1 | prefetch on focus; activation on click is immediate |
| Credit lines under 41 tiles add height | UXB-6 | one 16 px line each; it is the licence's requirement |

---

## 16. Contrast of every colour pair this note approves

Computed from `web/app/themes.css` (WCAG 2.x relative luminance). Light / dark. AA is 4.5 for text, 3 for large text and
for non-text indicators.

| Pair | Use | Light | Dark | Passes |
|---|---|---|---|---|
| `--muted` on `--bg` | tab label at rest, tab count, photo credit line, gap items | 6.42 | 8.23 | AA |
| `--ink` on `--bg` | current tab label, disclosure summary, captions | 14.85 | 15.28 | AAA |
| `--accent-text` on `--bg` | current-tab underline (non-text), best-time window (large text) | 5.85 | 8.83 | AA, 3:1 |
| `--accent` on `--bg` | **not approved** as the tab underline | 2.33 | 7.22 | fails 3:1 in light |
| `--ink-2` on `--bg` | gap block section names | 11.18 | 11.88 | AAA |
| `--ink` on `--surface` | card values, table cells, stepper glyphs and values, month labels | 16.06 | 13.83 | AAA |
| `--ink-2` on `--surface` | month "avoid" cross-hatch band | 12.09 | 10.76 | AAA |
| `--muted` on `--surface` | card subs, folded table lines, drive rows, unresearched months | 6.94 | 7.45 | AA |
| `--surface` on `--ink` | "best" month label | 16.06 | 13.83 | AAA |
| `--line-2` on `--surface` | stepper and card hover borders, month cell borders, hatch stripes (non-text) | 3.67 | 3.42 | 3:1 |
| `--line-2` on `--bg` | table frame where on the page (non-text) | 3.39 | 3.78 | 3:1 |
| `--muted` on `--well` | table head labels, "No licensed photo yet" | 6.02 | 8.58 | AA |
| `--ink-2` on `--well` | the shape's driving bar (non-text) | 10.48 | 12.39 | 3:1 |
| `--ink` on `--surface-2` | bases ribbon names | 13.66 | 12.24 | AAA |
| `--line-2` on `--surface-2` | ribbon dividers (non-text) | 3.12 | 3.02 | 3:1 |
| `--accent-ink` on `--accent` | List / Table segment selected (existing) | 6.96 | 6.96 | AA |
| `--accent-text` on `--accent-soft` | active filter pill (existing) | 5.56 | 7.26 | AA |
| `--info` on `--info-soft` | Suggested times banner (existing) | 5.91 | 7.61 | AA |
| `--line` on `--bg` | tab hairline | 1.25 | 1.56 | decorative only; carries no state |
| `--ink` at 35% on `--surface` | **not approved**: today's full-cell hatch | 2.13 | 2.87 | fails 3:1 |

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | Written by travel-design-reviewer (Opus 5.5) for UXB-N; the tabs analysis (section 1) added first at the owner's request relayed by the coordinator; foundation entries components 1.6, 2.12, 3.6, 3.7, 4.6, 4.7, 6.4, 6.5 and patterns 3.10, 3.11; owner questions Q303 to Q307 |
