# 02. Experience design

The product is judged at two moments: **the evening at home on a laptop**, choosing and arranging,
and **07:40 at a trailhead with one bar of signal** and a child asking where the toilet is. Design for
both, phone first. A third moment matters for the family in the intent notes: **January, deciding
the year** (which long weekend, which trip, what budget).

## 1. Principles that decide arguments

1. **The location is the lens.** Every distance is from where you are (home, the trip's base, or
   your live position on the trip), in drive time where we have it, straight-line until we do.
2. **Finding beats browsing.** Search and filters are instant, forgiving and visible as chips.
   Never a dead end: zero results always offers a one-tap loosen ("drop 'cave' or widen to 1 h 30?").
3. **One primary action per screen, written as a verb.** "Book the shuttle", "Add a day", "Leave by 07:10".
4. **Show the number where the decision is made.** Distance, time, cost, how many fit, days left.
5. **Every suggestion shows its reason; every warning offers a fix.**
6. **Nothing is lost.** Autosave, undo everywhere (from the operation inverses), offline edits sync later.
7. **Dates are relative and absolute.** "in 12 days, Sat 15 Apr".
8. **Nothing basic needs an account or AI.** Browsing, a day-trip finder, and a draft trip all work
   signed out (stored locally); signing in saves and shares.
9. **Reachable, readable, accessible.** 44 px targets, primary actions in thumb reach, AA contrast
   readable in sunlight, keyboard and screen reader complete, reduced motion honoured.
10. **Calm, not an "AI look".** The owner rejected the warm-ivory-and-coral palette from the Travel
    Finder notes; the visual direction comes from the design previews already commissioned. Colour
    carries meaning (category, status, urgency), not decoration.

## 2. Information architecture

```
/                         Home: signed out = discover near you; signed in = your trips + next actions
/explore                  Discover: map + cards + filters, URL holds all state (shareable)
/explore/<area>           Area guide (Banff, El Chaltén): highlights, seasons, coverage badge
/p/<entity-slug>          Entity page (trail, place, stay...), opens as a sheet over the current view
/year                     The travel year: goals, long weekends, trips and candidates on a timeline
/trips                    All trips by phase; done trips folded into "Past"
/t/<trip>                 Trip dashboard (phase-aware)
/t/<trip>/plan            Day board + map (desktop) / day pager (phone)
/t/<trip>/book            Booking timeline
/t/<trip>/tasks           Tasks by group
/t/<trip>/today           Today mode (default during the trip)
/t/<trip>/budget          Budget by category
/t/<trip>/people          Travellers, members, who-can-do-what
/templates                Public templates to fork
/inbox                    Every reminder and notification with its state
/settings/household       Home base, people, passes, standing preferences
/admin                    Review queue, coverage, backlog, research jobs (role-gated)
/llms.txt, /api/docs      For agents and integrations
```

**Navigation.** Phone: bottom bar **Trips · Explore · Inbox · You**; inside a trip it becomes
**Today/Overview · Plan · Book · Tasks · More** (the first tab switches to Today during the trip).
Desktop: left rail with the same items; inside a trip, tabs across the top and the map docked right.
A command palette (`/` or `⌘K`) everywhere: jump to a trip, add an item, search the catalog, run an action.

## 3. Starting a trip

### 3.1 Three entry points, one result

| Entry | For | What happens |
|---|---|---|
| **"Plan a trip"** | most people | the intent sheet (3.2) |
| **"Day trip from home"** | a free Saturday | radius + outing type, straight to a ranked shortlist; one tap turns a pick into a one-day trip with a "leave by" time |
| **Fork a template** | "do what they did" | pick dates and party; items, bookings, tasks copy over with deadlines recomputed |
| *(also)* From a chat client | MCP users | the trip appears in the list, tagged with the client that made it |

### 3.2 The intent sheet (5 short steps, every one skippable)

Pre-filled from the household; the user edits only what differs. A live line at the bottom answers
"is this worth it": **"38 things fit · 12 suit a 9-year-old · coverage: good"**, or a warning:
**"We know little about food in El Chaltén yet (thin). You can still add your own."**

| Step | Inputs (chips and sliders, not forms) |
|---|---|
| Where | a destination, or "not sure yet" → candidates (3.3), or "surprise me within 5 h drive" |
| When | exact dates · a month · "a long weekend" (picks from the year's windows) · not sure |
| Who | the household (tick who goes) + guests; ages shown, computed at travel dates |
| Style | vibes (relax, super-fun, adventure, nature, culture, food, romantic, family), activities, must-do, avoid |
| How | pace (slow, balanced, packed), walking limit per day (km and gain), budget band, transport, base strategy (one base with day trips, or move) |

Express path: "Just start" after Where and When; the rest stays at household defaults.

### 3.3 Not sure where yet: compare candidates

A table of candidate destinations with travel time from home, best time, duration, rough cost, pros,
cons and a vote per member. Exactly the "Fall colours trip ideas" table the family keeps today, but
each row can open the area guide and show how many things fit the party there. "Choose" turns the
trip toward that area; the others stay folded underneath.

## 4. Browse and pick

**Layout.** Desktop: filter bar on top, cards or table on the left, map on the right, fully synced
(hover a card → its pin lifts; pan the map → "Search this area"). Phone: full-screen map with a
bottom sheet of cards (drag up for list, down for map); filters in a full-height sheet.

**Filters** as removable chips with counts: distance (drive time from the lens), what (feature
tags), vibe, who (ages, accessible, stroller, dog), how (difficulty, indoor, walking distance, gain),
when (open in my dates, good this season, "good right now"), cost. Persona quick-starts set a bundle
of chips in one tap. Typed queries become chips you can see and edit ("waterfall near Ajax for kids
under 2 hours" → `waterfall` `from: Ajax` `age 9+` `≤ 2 h`); v1 parses with rules, no LLM.

**Cards** answer "is this for us?" at a glance: photo, name, the drive-time badge, two or three tags,
cost band, **fit per traveller** (a row of small avatars: green fits, amber "needs 12+", grey "not for
Grandma: 900 m of gain"), trust badge, and **+ Add**. The reason line is always visible:
*"Matches waterfall + family · open in September · 40 min from your base · 6 km, within your limit."*

**+ Add** asks one question: **Ideas** (the default) or **Day N**. Items in Ideas are not lost and not
scheduled; they show on the map in a lighter colour.

**Entity sheet**: facts with their source and read date in small type ("21 km · Parks Canada · read
Mar 2026"), conflicts shown honestly ("a 2025 trip report says 23 km"), season, eligibility, what to
book and when it opens, nearby and rainy-day alternatives, gallery, and "Suggest a correction"
(creates a changeset).

## 5. Add anything by hand

The universal **+** (and the palette) accepts, in one box:
- a catalog search ("Moraine Lake");
- **"Add 'Dinner at Grandma's' as my own"**: a custom item, no catalog needed;
- a pasted URL (a Google Maps link, an operator page): we read the title and the coordinates when
  the link has them, and create a custom item with the link;
- a **pin dropped on the map**, named afterwards;
- a note, a break, a drive, a flight, a ferry, a stay, a meal: each a kind with the right fields.

Custom items behave exactly like catalog items (times, notes, who, bookings, tasks). The owner of a
custom item can offer it to the catalog (a changeset) with one tap.

## 6. Shape the days

### 6.1 Desktop: the plan document (default) and the board

**Plan document (default, after Wanderlog; see 07-competitors.md section 7 for the screenshot review).**

```
┌ top bar ───────────────────────────────────────────────────────────────────────────────────────┐
│ ← Trips   Dolomites, 13-26 Jul 2027 ▾   ↶ Undo ↷ Redo   ● Priya ● you   Share   ⋯             │
├ outline ──────┬ document ─────────────────────────────────────┬ map ──────────────────────────┤
│ Overview      │ ⚑ Next: Seceda lift opens for booking in 9 d   │  pins numbered per section,    │
│  Bookings  2/7│ ── Bookings ────────────────────────────────── │  section in view highlighted,  │
│  Notes        │ [✈ Flight][🛏 Stay][🚗 Car][🚆 Train][🎟 Ticket] │  others faded; day route line  │
│  Places   12  │   [📎 File][✉ Forward an email]  Budget $4,820  │                                │
│  Food      5  │ ── Notes ───────────────────────────────────── │                                │
│ Days          │ ── Places to visit (12) ────────────────────── │  starts on the trip's area,    │
│  1 Venice  ✓  │  1 Seceda ridge    2.1 km · 1 h 40 · 9+ ✓      │  never on the viewer's IP      │
│  2 → Ortisei ⚠│     why: lookout + family · lift Jun-Oct        │                                │
│  3 Ortisei    │     [+ Day ▾] [time] [who] [cost] [notes]       │  ┌ place panel ─────────────┐ │
│  …            │  [ Add a place, a link, or a note…         ] ⊞ │  │ About · Facts · Photos   │ │
│ Ideas      4  │  Suggested for this list → [card +][card +]…   │  │ 21 km · Parks site · Mar │ │
│ Tasks    9/23 │ ── Day 2 · Thu 15 Jul · Venice → Ortisei ───── │  │ fits: ●●● ○ (Nonna: gain)│ │
│               │  drive 3 h 10 · walk 4 km · sunset 20:58  ⚠1   │  │ [In: Places ▾] [Open in] │ │
│               │  1 08:30 Leave Venice ── 2 h 05 drive ──        │  └──────────────────────────┘ │
│               │  2 Lago di Braies ...                           │                                │
│               │  [ Add to day 2…                           ] ⊞ │                                │
└───────────────┴─────────────────────────────────────────────────┴────────────────────────────────┘
```

- **Outline (left)**: a scroll-spy table of contents. Each entry carries its state, not just its name:
  counts for lists, the base town and a warning dot for days, done/total for bookings and tasks.
  Empty lists do not appear (no "Untitled").
- **Document (centre)**: Overview (next action, bookings strip, budget, notes), the named lists, then
  the days. Every list and day ends in one **add box** that takes a place name, a pasted link, or a
  note, with a small menu (⊞) for note, checklist, break, drive, stay. Between consecutive stops:
  travel time, distance and mode. Drag from any list into any day.
- **Map (right)**: pins numbered to match the document; the section in view is bold, the rest faded;
  a place opens in a **panel over the map** (About, Facts with sources, Photos), with "In: list ▾",
  mark visited, open in Google or Apple Maps.
- **Long trips stay fast**: days collapse to their header line (base, totals, warnings); only expanded
  days render, and the list is virtualised. A 14-night trip opens with today's or the next unplanned
  day expanded.
- **Per day**: "Fill this day" (draft from the trip's lists, preview first) and "Reorder to cut
  driving", both free; a missing-stay check per night ("no stay for nights 4-5") with a fix that opens
  the Stays list, not an ad.

**Board (second view, for rearranging).** Columns: **Ideas**, then **Day 1 … Day N** (with dates when set), the map on the right showing the
selected day's route. Drag items between days and within a day (dnd-kit, with a keyboard move menu
for accessibility). Each day header shows the totals that decide feasibility: **driving 2 h 40 ·
walking 9 km / 450 m · sunset 19:52 · 3 bookings**. Spans (a hut night, a 4-day trek) draw as bars
across columns; nested stages open inside the parent.

### 6.2 Phone: one day at a time

A pager of days (swipe), each a vertical timeline; the map as a bottom sheet; long-press to move an
item ("Move to… Day 3 · Ideas · after Lunch"). Same totals in a compact header.

### 6.3 Time, variants and Plan B

- Times are optional; a time hint (morning, sunset) is enough for ordering.
- **Variants**: a day can hold Track A (adults' big hike), B (family) and C (less walking), each with
  its travellers; the board shows them as parallel lanes. This is how the Rockies plan already works.
- **Plan B**: any weather-sensitive item can carry a replacement and a rule ("gusts over 50 km/h at
  07:00"). A toggle on the day swaps them.

### 6.4 Day checks with one-tap fixes

Run on every change, shown inline on the day, never as a blocking dialog.

| Check | Example message | Fix offered |
|---|---|---|
| Overlap | Lunch overlaps the boat tour by 30 min | shift lunch to 13:30 |
| Travel doesn't fit | 1 h 50 drive between items with 45 min gap | move the next item later / swap order |
| Daylight | Hike ends 40 min after sunset | start 08:00 / swap with tomorrow |
| Closed | Gondola closes 13 Sep; this is 14 Sep | move to day 2 / pick the alternative |
| Too much | 3 h 50 driving and 14 km walking on a balanced pace | move X to Ideas |
| Party can't | Via ferrata needs 12+; Kai is 9 on this date | give him the family track / remove |
| Breaks | 3 h drive with nothing to break it (the household's own avoid rule) | add a stop (suggests one near the 1 h 30 mark) |
| Booking risk | Shuttle not booked; window opened 3 days ago | open the booking |

### 6.5 Draft for me (optional)

"Draft my days" places Ideas onto days by geography, daylight, travel time and pace, with a reason
per placement, as a **preview the user accepts or discards** (it is one operation with one undo).
v1 is a deterministic planner; a chat client can do richer drafting through the MCP and the result
arrives the same way.

## 7. Book

The booking timeline is the screen for the Book phase.

```
 NOW      ● Moraine Lake shuttle — opens Sat 15 Apr 08:00 MT (10:00 your time) · sells out in minutes
          ○ Lake O'Hara lottery — closes in 6 days · apply
 MAY      ○ Jasper hotel, 4 nights — book by 1 May (prices rise) · $1,240 est.
 JUN      ○ Via ferrata Loen — book by 10 Jun · 2 seats, ages 12+
 BOOKED   ✓ Calgary rental car · conf. AB12C · ticket attached
```

Each row: what, when it opens (operator's zone and yours), how fast it sells, the price and its read
date, the fallback if missed, the booking link, and **Mark booked** (asks for a confirmation number
and an optional file). Status chips: watching, open, booked, waitlisted, failed. Failed shows the
fallback plan.

## 8. Tasks: the trip as a to-do list

Groups **Book · Buy · Pack · Documents · Prepare · On the day**, each with a progress count. Most
tasks are generated (bookings, booking windows, passport and visa rules, packing templates by style,
season and ages, offline downloads before departure) and every one can be edited, reassigned,
skipped or added by hand. Checking off is one tap with undo; it moves the readiness bar. Tasks show
"in 12 days, Sat 15 Apr" and the owner's avatar. A household-level list holds tasks without a trip
("renew Kai's passport before 2027").

## 9. Reminders

| Channel | Role | Notes |
|---|---|---|
| **Web Push** | primary for time-critical openings | works on Android and desktop; on iOS only when the app is installed to the Home Screen (iOS 16.4+), so the app prompts install at the first booking with a short window |
| **Email** | primary fallback, and a weekly digest in Book and Prepare | one email per reminder for openings; digest for the rest |
| **Calendar feed (ICS)** | backstop and overview | per-trip secret URL with alarms; calendar apps refresh subscribed feeds on their own schedule (often hours), so it never carries a 15-minute warning alone. "Add to calendar" on a single deadline downloads one `.ics` with its alarm, which is immediate |

Default schedule for a booking window: 7 days before, the evening before, 15 minutes before, at
opening, "did you get it?" 2 hours after. Quiet hours per user (but an opening at 08:00 overrides
them unless muted). The Inbox lists every reminder with its state; each links to the booking page
and the task.

## 10. Prepare and Go

**Readiness bar** on every trip card and dashboard: Plan · Book · Prepare · Go, each with a count
("bookings 6 of 9, next deadline in 12 days").

**Make available offline** (a Prepare task, nudged 3 days before): the whole trip (items, notes,
tickets, attachments), map tiles for the trip's area at useful zooms, trail tracks, sun times. The
download shows its size first and what is not included. Mountain trips often hit the tile budget;
then trails and pins still show on a plain background, which is stated, not hidden.

**Today mode** (default during the trip's dates):
- **Next stop** with **"Leave by 07:10"** (travel time plus parking notes) and one tap to open
  Google Maps or Apple Maps with the destination.
- The day as a timeline; the current item highlighted; tap to mark done or skipped.
- **Tickets for today** one tap away, offline.
- **Light and weather**: sunrise, sunset, last light, the forecast (fetched when online, cached), and
  the day's weather rule with the Plan B toggle.
- **Running late**: "shift the rest of today by 45 min"; warns about anything that no longer fits (a
  closing time, a booked slot, daylight).
- **Quick note or photo** on the stop (kept private, synced later).
- An offline badge and "last synced 07:12".

**Tomorrow briefing** each evening: start time, what to pack in the day bag, tomorrow's bookings,
forecast, anything to do tonight (charge the GPS, buy lunch).

## 11. After

"How did it go?" marks items done or skipped (pre-filled from Today mode), adds notes and photos,
and offers corrections to the catalog ("the trail was closed", "parking now costs $15") as
changesets. The trip can be **published as a template**: the owner previews exactly what others see
(no travellers, no ages, no confirmations, no attachments, no private notes) before publishing.

## 12. The travel year

A horizontal timeline for the year: public holidays and long weekends (from reference data), school
breaks (entered once per household), trips as bars coloured by phase, candidates as dashed bars, the
goals ("1 international + 1 local") with a tick when a trip covers them, and the budget used against
the year's target. From here: "Plan a trip for Thanksgiving weekend" opens the intent sheet with those
dates.

## 13. Sharing and collaboration

Invite by email as editor or viewer; a viewer link for grandparents (no account needed, read-only,
no personal data beyond first names). Edits from others show in a small activity feed ("Priya booked
the shuttle · 2 min ago") and a soft live update when the trip version changes. Comments on items are
deliberately left out of v1 (notes cover it); added only if collaborators ask.

## 14. Admin and research review

- **Review queue**: changesets grouped by job, each change as a diff (old → new) with its evidence
  and source, accept, edit-then-accept or reject per change, bulk-accept for low-risk additions with
  official sources.
- **Coverage map**: areas coloured thin, usable, good per kind; click → backlog for that area.
- **Backlog** ranked by priority; "Research this" creates a job a chat client or a server agent picks up.
- **Jobs**: status, cost, changesets produced.
- **Moderation**: user photos and corrections.

## 15. States to design, not discover

Loading (skeletons, results stream in), empty (every list has a "here's how to start" with one
action), zero results (rescue with one-tap loosen), offline (cached data with its age; queued edits
counted), conflict (someone else changed the same field: show both, keep mine or theirs), error
(retry, and nothing typed is lost), signed out (local draft with "sign in to keep this").

## 16. Visual system (direction, not final)

- Tokens only (`--surface`, `--accent`, `--warn`, `--ok`, `--muted`), defined per theme; light and
  dark from day one (dark matters at a campsite at night).
- Type: one sans for UI (self-hosted, for example Inter or Source Sans 3), optional serif for long
  reading on area guides; tabular numbers for times and distances.
- Icons: Lucide. Maps: MapLibre with a calm basemap; categories by shape and colour so they read for
  colour-blind users.
- Motion: 150-250 ms, only to show where something went (an item flying into a day).
- The final palette and type come from the design previews the owner reviews; this file sets the
  rules they must satisfy.
