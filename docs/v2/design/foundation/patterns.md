# Patterns (18 Oct 2026)

Navigation, layout, page templates, flows, states and choreography. Components are in
[components.md](components.md); values in [tokens.md](tokens.md). The public read-only site is the primary
surface and is specified first; the planner reuses every template.

## 1. Navigation

### 1.1 Decision: top bar, not a rail

Both the public site and the planner use the **60 px top bar** (components 1.1). The desktop rail from the
prototype is dropped: it mixed global and trip areas into fourteen equal icons and truncated the trip name.
Trip areas live in the **trip bar** (components 1.2) under the header. Reasons: the public pages already use
a top bar and the owner likes them; a rail costs 76 px of width on Plan where the map needs it; the trip
chip in the header is a better switcher than a rail module.

| Surface | Header tabs | Trip areas | Phone |
|---|---|---|---|
| public | Trips · Places · Globe | none (public trip page has in-page anchors) | bottom bar Trips · Places · Globe · Sign in |
| signed in, outside a trip | Home · Trips · Places · Globe | none | bottom bar Home · Trips · Places · Globe · Me |
| signed in, inside a trip | same, with the trip chip | trip bar: Plan · Today · Bookings · Tasks · Budget · Share | top bar names the trip; bottom bar [photo] Plan · Today · Bookings · More |

"Discover" from the recommendation is renamed **Trips**: for a visitor the published trips *are* the
trips. The signed-in household's own trips are **Home**. Names people already know beat a new noun.

### 1.2 URLs

Public: `/trips`, `/trips/<slug>` (`#day-3`, `#stays` anchors), `/places`, `/places/<slug>`, `/globe`,
`/globe/<country>/<state>`. Every list carries its state: `?q=lake&kind=trail,lake&view=table&group=country&sort=area&page=2`.
Planner: `/home`, `/t/<trip-slug>/plan?day=3&focus=itm_…`, `/t/<slug>/bookings/<id>`, `/t/<slug>/today`,
`/t/<slug>/tasks`, `/t/<slug>/budget`, `/t/<slug>/share`. Sheets add `?focus=`; Back closes them. A link
never opens the wrong trip (rule 9).

### 1.3 Keyboard layer (desktop)

`/` search · ⌘K switcher and jump · ⌘[ previous trip · N add in the current trip (booking, task or
expense by tab) · ⌘Z / ⌘⇧Z undo and redo · ⌘1 to ⌘6 trip tabs · ? shows the list. Shortcuts never fire
inside inputs.

## 2. Layout grids

- **Public list pages** (Trips, Places): page title block (title 72, intro serif 19, actions right) ·
  toolbar (search 300, pills, view segment right) · subbar (count, group by, sort by, direction) ·
  groups with sticky headings · grid 4/3/2/1 or table · pager · credits footer.
- **Plan** (desktop): outline 256 (`--well`) · document 620 to 680 · map fluid (≥ 38%). The divider is
  draggable and remembered; the map collapses to a 48 px strip, never hidden. Tablet: document + map, the
  outline becomes a day strip under the trip bar. Phone: one day per page with the day strip, map as a
  bottom sheet.
- **Trip tabs other than Plan**: a 12-column page with a 620 to 900 px content column; drawers open on
  the right under the trip bar.
- **Detail pages** (public trip, place, trail): full-bleed cover · glance strip overlapping the cover by
  46 px · two columns 1fr / 400 px (phone one column; the sidebar's "In Dolomites" card and map move to
  the top).
- **Globe**: full-bleed canvas under the header; everything else floats (components 7.2).
- Max content 1376 px; 32 px margins; 14 px on phone. No horizontal page scroll at any width.

## 3. Page templates, public

### 3.1 Home / inspiration (`/`)

Cover: the globe, live, at 60% height with the search field centred and the hint bar; pins by continent.
Under it: "Trips" strip (6 published trip cards, newest first, "All 14 trips →"), "Places worth a trip"
strip (8 place cards with the kind glyph and area chain), "About the data" one paragraph with the honesty
markers explained. No sign-in prompt above the fold; "Sign in" is in the header only. First paint under
1.5 s on a mid-range phone: the globe loads after the first strip.

### 3.2 Globe (`/globe`), full screen

Canvas under the header, controls as components 7.2. States: **World** (auto-spin on, pins as country
counts), **Country** (flown in, state pins, panel lists the country's places), **State** (district pins),
**Place selected** (selection card). Search flies to any country, state, city, sea or range. Selecting a
pin opens the selection card, never a new page; "Open place" or "Open trip" goes to the detail page and
Back returns to the same camera. Signed in: the household's trips appear as pins in their identity rings
("Patagonia · 26 Feb"). Phone: the panel is a peek sheet (120 px) listing countries; the control card is a
single "Map options" button opening a sheet.

### 3.3 Trips search (`/trips`)

The live Trips page, re-coloured. Toolbar: search, When, Source (and Country, Kids added), four views.
Groups: Upcoming, Past as templates (desaturated photos, "Use as a template" when signed in). Cards: photo,
title, meta (dates, nights, route) one line, neutral countdown chip and "Public page" link chip, serif
summary. Table view columns: title, dates, nights, countries, bases, drive per day, kids, copied. Map view:
one pin per trip at its first base with the cover photo in the selection card.

### 3.4 Trip detail (`/trips/<slug>`), categorised and chronological

1. **Cover** 620 px (phone 420): photo, gradient 10% to 88%, kicker white 80% ("Published plan · South
   Tyrol and Veneto, Italy"), title 96, standfirst serif 21, chips (14 days, 4 bases, drive 1 h 10 a day,
   moderate, ages 8+, by Nitin · copied 41 times), actions: **Copy to my trips** (primary), Export
   (menu: PDF, GPX, CSV, calendar), Share.
2. **Season band**: "This plan is valid for" + Big Shoulders 52 window, why, the 12-month strip (solid as
   written, hatched possible), weather tiles (sized to content), warnings.
3. **The route**: map, all days by road, bases named, 6 px stop dots; picking a day in the day list
   highlights it.
4. **In this trip**: a category strip of five chips with counts — **Stays 4 · Trails 9 · Sights 6 · Food 3
   · Logistics 5** — above a segmented control **By day / By category**.
   - By day (default): fourteen uniform **day rows** (quiet sign DAY 03, 96 x 68 thumbnail, Big Shoulders
     24 title, mono base · drive, serif stop list), each expandable to its stops with legs; `#day-3`
     anchors.
   - By category: five sections in the strip's order; each item is a list row (components 3.2) with its
     kind glyph, name, area, the day sign it belongs to ("Day 3 · 11:30") and a link to its place page.
     Stays show nights and check-in; Logistics holds flights, car, tolls, slots and passes.
5. **Copy and export** repeated at the end, then credits and attribution.

Chronological order is never changed by the category view; category only regroups the same items.

### 3.5 Places search (`/places`)

The live Places page, re-coloured: pills Country, Kind, Status, Kids, Season, Tag, Plan; four views; count;
group by country with sticky headers; cards with the kind glyph when there is no photo, area chain, chips
(kind, status, season, kids), honesty markers, footer links; table with the tools row; map with URL state.

### 3.6 Place and trail detail (`/places/<slug>`)

Cover 560 (trail) or 420 (place), kicker white 80% (Trail · Auronzo · Sesto Dolomites), title, summary,
actions: public **Save to a trip** (opens the switcher for signed-in users; for visitors a notice "Sign in
to add this to a trip" with Copy link and GPX), GPX, Share. Glance strip: six facts, each with a value and
a **text** provenance line ("operator · read 18 Oct 2026"). Left: The route (elevation profile + hut list)
· Trailhead and parking (photo, facts, booking window callout with Remind me) · When to go · Who it suits
(fit chips, honesty chip). Right: "In Dolomites · Day 3" card (signed in, when planned), mini map, Hazards,
Links as tabs (Official 3 · Booking 1 · Route 4 · Conditions 3 · Report 1) with "every link checked
18 Oct 2026". Places of other kinds use the same frame with their own facts (lake: swim, boats, parking;
viewpoint: light, walk from the car; stay: nights, check-in, cancellation; activity: ages, duration,
booking window).

### 3.7 Copy and export

**Copy to my trips** (signed in): a sheet asking only the start date (date picker with the shading; the
valid window pre-highlighted) and who is going (traveller toggles); the copy keeps days, not dates, and
lands on the new trip's Plan with a toast "Copied Dolomites · 14 days from Tue 13 Jul · Undo". Visitors see
the same sheet with a "Sign in to save it" footer and the export options active. **Export**: PDF (the
public page's reading order, credits included), GPX (routes and stops), CSV (stops with day, time, kind,
coordinates, links), calendar (.ics, one all-day event per day plus timed bookings).

## 4. Planner templates

### 4.1 Home (signed in)

Title block ("Sunday 18 October. Three trips are moving; one needs you tomorrow." from data), Needs you
this week as per-trip columns, toolbar, groups In progress · Planning and ideas · Done (templates), the
**Year** view as a fifth view segment: a horizontal timeline of every trip with its booking windows and
spend per currency (CAD and USD stay separate).

### 4.2 Plan

Outline (bases with photos and nights, days with drive time and warning dots, lists) · document (one-line
Next banner, add box, collapsed and open days, items, legs) · map. Picking a day anywhere (outline, map
chip, day header) sets the one focused day: amber sign, amber route and pins, outline row `--surface-2`.

### 4.3 Add and edit flows

- **Add from inside a trip** (N, the add box, "+"): the form opens as a drawer under the trip bar with the
  trip's photo header; Save names the trip.
- **Add from a cross-trip place** (Home, Inbox, a forwarded email): the first field is **Files under**
  with the trip suggested from the dates and a Change link; Save is disabled until a trip is chosen.
- **Edit in place**: titles, times, notes and facts edit inline on click (serif 17 → an input of the same
  size, no layout shift); Enter saves, Esc reverts; a pencil icon appears on hover and is always present
  on touch.
- **Move to another trip**: an explicit menu action with a confirmation sheet naming both trips; undoable.

### 4.4 Confirm and undo

Reversible actions never ask; they show a toast with Undo (6 s) and support ⌘Z. Only irreversible actions
confirm, inline and specific: delete a trip ("Delete Dolomites and its 9 bookings? It stays in Trash for 30
days."), revoke a share link, remove a person. The confirm sheet's primary is a danger button with the
object named; Cancel is first in tab order.

### 4.5 Reminders and notifications

Every notification names the trip first and opens it in context: "Patagonia · Book El Chaltén lodging ·
due Sat 31 Oct". Push: title is the trip, body is the task and due; tapping opens `/t/patagonia/tasks/<id>`.
Email: subject "Patagonia: book El Chaltén lodging by Sat 31 Oct", one button. Inbox rows carry the trip
photo in its ring.

### 4.6 Offline and Today mode

Offline is a state the whole screen expresses: the dashed notice banner with the saved time and what is
cached; anything unavailable is shown greyed with "Needs connection"; queued edits get a clock mark; the
trip card shows "Offline ready · 84 MB · 2 days ago". Today mode: the leave-by card first, Navigate in the
lower half, running-late consequences before committing, sunlight theme available, the travel-day override
note (S5). On a travel day Today opens the trip in progress regardless of the last-selected trip.

### 4.7 Error and permission states

Inline errors replace the region, keep cached data visible and say what to do. Permission: viewers see the
trip bar with a "view only" chip and no add controls; editors see everything; a guest by link sees the
guest banner and Copy to my trips. Expired links: "This link expired on 1 May. Ask Nitin for a new one."

## 5. Density and reading

Two densities, named: **reading** (public pages, cards, detail sidebars: 16 to 24 px padding, serif 16)
and **scanning** (outline, tables, bookings, needs-you, switcher: 8 to 12 px, rows 32 to 44, mono meta).
A screen uses one density per region and never a third.

## 6. Animation choreography

| Moment | What moves | Duration and curve |
|---|---|---|
| Page change (tab, list ↔ detail) | content cross-fades; header and trip bar stay | 220 ms `--e-out`; shared element for a card photo → cover when the image is the same |
| Sheet open / close | slides from the right (desktop) or bottom (phone); scrim fades | 260 / 200 ms, `--e-out` / `--e-in` |
| Menu, switcher, ⌘K | fade + 4 px rise | 200 ms |
| List reorder, move between days | items slide apart to open the slot (layout animation); the dragged ghost follows the pointer; drop settles with the spring; legs and totals count | spring 520/40; counts 300 ms |
| Add from search | the result row flies to its slot; the pin drops on the map at the same moment; the day's totals count | 300 ms move, pin drop 260 ms + settle |
| Map fly-to (outline click, day pick) | camera eases to the day's bounds; the picked route fades to amber as the others dim | 600 to 900 ms by distance; route colour 200 ms |
| Map pins | hover ring 120 ms; cluster split 200 ms; co-located fan-out 200 ms | |
| Globe | auto-spin 1 revolution per 90 s; on pointer down spin decays over 400 ms; fly-in to a country 1200 ms with zoom then tilt (terrain on) | resumes after 20 s idle; off under reduced motion |
| Today | the next-stop card grows into place on arrival; leave-by counts when it changes | 300 ms |
| Toast | rise 200 ms, fade 160 ms | |
| Theme switch | surfaces cross-fade; images do not flash | 200 ms |

Never animated: text and border colour on status change, table rows, the trip bar, form validation.
Everything is interruptible; a second input cancels the first animation and starts from the current frame.
Reduced motion: fades of 120 ms, camera jumps, no spin, no shimmer.
