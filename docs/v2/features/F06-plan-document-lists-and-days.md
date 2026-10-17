# F06. Plan document, lists and days

## Purpose

The place where a trip takes shape: one scrolling document beside a map (Wanderlog's best idea),
with named lists of possibilities and the days in order. Anything can be added by hand, from the
catalog, from a link or from a chat client, and moved freely between lists and days.

## User stories

1. As a planner, I want to type a place, paste a link or drop a pin at the end of any list or day, so that adding is instant.
2. As a planner, I want lists like "Places to visit", "Restaurants" and "Maybe", so that I can collect before scheduling.
3. As a planner, I want to drag an item from a list into Day 3 and reorder within the day, so that shaping the days is direct.
4. As a parent, I want Track A (adults' big hike), B (family) and C (less walking) on the same day, each with its people, so that the Rockies plan works the way we travel.
5. As a planner, I want Plan B for weather-sensitive items, so that a wet day already has an answer.
6. As a planner on a 14-night trip, I want the page to stay fast, so that I don't fight the tool.
7. As anyone, I want undo for every change, so that I am never afraid to drag.

## Detailed behaviour

### Structure

1. Sections in order: **Overview** (next action, bookings strip, budget summary, notes), **Lists** (Ideas is the default list; more lists created by the user or on first item), **Days** (Day 1..N, dated when the trip has dates), **Budget** (F10), **Considered** (candidates not chosen, F03).
2. **Outline** (left column, desktop): scroll-spy table of contents. Each entry shows state: list counts, each day's sleep base and warning dot, bookings done/total, tasks done/total. Empty lists do not appear.
3. **Map** (right column, desktop): numbered pins matching the document; the section in view is bold, other pins faded; the selected day's route drawn with legs; the trip's area on first open (never the viewer's IP location).

### Adding

4. Every list and every day ends in an **add box**. Typing searches the catalog (with the trip's lens and fit); "Add '<text>' as my own" creates a custom item; a pasted URL is fetched for title and coordinates (Google Maps links, operator pages, OSM links); a menu (⊞) adds a note, a checklist, a break, a drive, a stay placeholder, a transport placeholder, a meal.
5. A "+" divider between sections inserts a new list there (named inline).
6. Items added from Explore cards go to Ideas or the chosen list or day.
7. A dropped pin on the map creates a custom item at that point, named afterwards (reverse geocoded suggestion).

### Items

8. An item card shows: number, name, kind icon, time or time hint, duration, who (avatars; empty = everyone), status, cost, notes preview, reservation status (booked tick, dashed if to-book), photo (catalog), and warnings from checks.
9. Inline edits: time (start, end, or a hint: sunrise, morning, midday, afternoon, sunset, evening, night), duration, who, notes (Markdown), cost, priority (must, should, nice; used by F12 adaptation and F07 drafting), variant, Plan B link, list or day.
10. **Between consecutive items in a day**: the leg (mode, time, distance) from the previous item or from the night's base for the first item; tap to change mode (drive, walk, transit, bike, ferry) or to add a stop.
11. **Spans**: stays and multi-day items (a 4-day trek, a hut night) span `day` to `end_day`; they show at the top of each covered day as a bar and in the outline as the sleep base.
12. **Nesting**: an item can have children (trek stages, stops of a drive day). Children show indented; collapsing the parent hides them.
13. **Anchored items** come from reservations (F08): ticket mark, locked times; editing times opens the reservation.
14. **Checklists and notes** are items of kind checklist or note; they can sit in a list or on a day; a checklist line can be promoted to a task (F09).

### Days

15. Day header: date and day number, title (editable, e.g. "Venice → Ortisei"), sleep base (from the stay reservation or a placeholder), totals (driving time, walking km and gain, sunrise and sunset, bookings count), warnings count, actions (Fill this day, Reorder to cut driving, Plan B toggle, collapse).
16. Days collapse to their header line; on open the next unplanned day (or today during the trip) is expanded, others collapsed. Only expanded days render their items; the document is virtualised.
17. Adding or removing nights: changing `nights` adds empty days at the end or asks what to do with items on removed days (move to Ideas, or to the previous day).
18. Changing `start_date` re-dates everything; times stay wall-clock local; reservations are not moved (they are facts) and conflicts are flagged.

### Variants (tracks)

19. A day can contain variant groups: items share a `variant_group` id and each has a `variant` label (A, B, C or names) and its `who`. The document shows them as parallel columns within the day on desktop, tabs on phone. The day's totals show per variant.
20. "Choose one" mode: only the chosen variant counts in totals and Today mode; "all" mode: the party splits and each person sees their own track in Today mode.

### Plan B

21. Any item can have a Plan B item (`plan_b_for`) and a weather rule on the day (`day_note.weather_rule`, e.g. "gusts over 50 km/h at 07:00" or "rain probability over 60%"). The day header has a Plan B toggle that swaps them in the plan, the map and Today mode.

### Moving and ordering

22. Drag and drop with dnd-kit: within a day, between days, between lists and days. Keyboard: a "Move to..." menu on every item (Day N, list, after item X). Phone: long-press then "Move to...".
23. Ordering uses fractional `sort_key` strings: a move writes one row; concurrent moves rarely conflict.
24. Multi-select (shift-click, or a select mode on phone) to move or delete several items at once; one undo.

### Undo and history

25. Every operation returns an inverse; Undo and Redo in the top bar (⌘Z, ⇧⌘Z); an activity panel lists recent changes by person or client ("Claude added 6 items") with per-batch undo.

### Board view and phone pager

26. Board (second desktop view): columns Ideas and Day 1..N; for big rearranging; same items, same operations.
27. Phone: a day pager (swipe between days), each a vertical timeline; lists as their own tab; map as a bottom sheet; the add box pinned at the bottom of the current day.

### Performance budget

28. A trip with 14 days, 3 variants per day and 150 items opens in under 2 s on a mid-range phone (cached) and keeps drag interactions under 50 ms per frame. This is the Wanderlog failure case (07-competitors.md 2).

## Data touched

`trip`, `trip_list`, `trip_item`, `day_note`, `reservation_segment` (anchors), `leg_cache`, `op_event`, `trip_night_base` view.

### Schema additions

- `trip_item.priority text check (priority in ('must','should','nice')) default 'should'`.
- `trip_item.duration_min int` (when no end time).
- `trip_item.weather_sensitive boolean default false`.
- `trip_item.mode_from_prev text` (override of the leg mode) and `trip_item.leg_note text`.
- `day_note.title` already exists; add `day_note.variant_mode text check (variant_mode in ('choose_one','all')) default 'all'`.

## Operations and MCP tools

Operations: `list.create`, `list.rename`, `list.reorder`, `list.delete`, `item.add`, `item.add_custom`, `item.add_from_link`, `item.update`, `item.move` (to list or day, after item), `item.remove`, `item.set_variant`, `item.set_plan_b`, `item.set_priority`, `day.set_title`, `day.set_weather_rule`, `day.toggle_plan_b`, `trip.set_nights`, `trip.set_start_date`, `op.undo`, `op.redo`.

MCP: `edit_trip` (an ordered list of these operations applied atomically, one undo), `get_trip` (document shape: lists, days, items, legs, warnings), `check_trip`.

## Edge cases

- Two people drag the same item at the same moment: the server applies the first; the second client receives the broadcast and its local move is rebased onto the new position or rejected with a toast.
- Removing a day that holds anchored reservation items: those items cannot move; the change asks to edit the reservation or cancel.
- A custom item without a point: it shows in the document but not on the map, with "add location".
- Pasted link that cannot be read (login wall): item created with the URL as the link and the page title if available, else "Untitled link".
- Very long notes: collapsed after 4 lines.

## Acceptance criteria

1. Typing "Moraine Lake" in a day's add box and pressing Enter adds the catalog entity to that day with a leg from the previous item.
2. Pasting a Google Maps place URL creates an item with the correct coordinates (within 50 m) and name.
3. Dragging an item from Ideas to Day 3 writes exactly one operation, broadcasts to other open clients, and Undo restores it.
4. A day with variants A, B, C shows per-variant totals, and Today mode shows each traveller only their variant.
5. The 150-item test trip meets the performance budget in item 28 in a Playwright performance test.

## Milestone

M2.

## Open questions

1. Default list names on a new trip: only Ideas, or Ideas + Restaurants? Default: only Ideas; others appear when used.
2. Show the board view on phone at all? Default: no; the pager replaces it.
3. Should items have per-item photos uploaded by users in v1? Default: no, notes and links only; photos arrive with F14 memories.
