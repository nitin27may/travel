# 07. Wanderlog and TripIt: what to take, what to beat

The owner likes Wanderlog most. Checked 17 Oct 2026 from reviews and comparisons (secondary sources;
prices vary by source). Sources at the end.

## 1. What each is actually good at

| | Wanderlog | TripIt |
|---|---|---|
| Core job | **planning**: a trip as one scrolling document beside a map | **logistics**: an itinerary assembled from confirmation emails |
| Best idea | lists of places and days in one page, with the map following your scroll; drag between lists and days; travel time shown between stops | forward a confirmation to an address (or connect the inbox) and the flight, hotel and car appear in the right place |
| Collaboration | real-time co-editing, shared trips | sharing, an "inner circle" that sees your plans |
| Paid tier | Pro ~$40/year: **offline**, route optimisation, Gmail scanning, Google Maps export | Pro ~$49/year: flight status and disruption alerts, check-in reminders, seat tracking, points tracking |
| Place data | Google Places (rich for restaurants and hotels; can be wrong) | none; it is not a discovery tool |

## 2. Where they are weak (what users complain about)

- **Wanderlog slows down on long itineraries**, adding items gets laggy, and some users report lost
  plans with support that is hard to reach. For a 14-night, 3-track Rockies plan this is the exact
  failure case.
- **Offline is paid** on Wanderlog. Offline at the trailhead is our default, free.
- **Recommendations are unreliable**: Google-sourced facts with no source or date; drive times
  sometimes badly off.
- **No party fit**: neither checks a 9-year-old against a 12+ via ferrata, a walking limit, or the
  household's own "avoid" rules.
- **No booking windows**: neither knows the Moraine Lake shuttle releases on a given morning, or that
  an Algonquin permit opens 5 days ahead. TripIt knows a booking only after you made it.
- **No preparation**: no task list, packing, documents or passport-expiry checks (a review of
  Wanderlog says so explicitly).
- **No research loop**: what a traveller learns never improves the shared knowledge.

## 3. What we take

| From | Idea | Where it lands |
|---|---|---|
| Wanderlog | **The trip as one scrolling document beside a map**: Overview (notes, links, checklists), place lists ("Places to visit", "Restaurants", "Maybe"), then Day 1…N. The map shows whatever section you are reading | becomes the **default desktop Plan view** (02-experience.md 6.1); the column board stays as a second view for big rearranging |
| Wanderlog | Travel time and distance **between consecutive stops**, inline, with the mode | day timeline (already planned in 6.1 totals; now also between each pair) |
| Wanderlog | **Multiple named lists**, not just one "Ideas" tray | `trip_list` (name, colour, sort) and `trip_item.list_id`; Ideas is the default list |
| Wanderlog | "Optimise route" for a day | the Draft preview gains "reorder this day to cut driving", one undo; free |
| Wanderlog | Export a day to Google Maps | already in M4 |
| TripIt | **Forward a confirmation email** to `trips@<our domain>` → a booking with times, address and confirmation number, attached to the right trip by date | new M3 item (section 4) |
| TripIt | Check-in and departure reminders for transport items | reminder kinds `check_in`, `leave_for_airport` on transport items |
| Both | One-tap share with a non-user, read-only | already the viewer link |

## 4. Email import, designed cheaply

1. **Inbound**: Cloudflare Email Routing to an Email Worker (free); one address per user
   (`<token>@in.<domain>`), so no inbox access and no Google verification process.
2. **Parse, cheapest first**: most airline, hotel and car confirmations embed **schema.org reservation
   markup** (`FlightReservation`, `LodgingReservation`, `RentalCarReservation`, `EventReservation`) in
   the HTML, which Gmail itself uses. Read that first: free and exact.
3. **Fallback**: a small set of hand-written parsers for common senders, then "we couldn't read
   this, here is the email, fill these 4 fields" (manual, one screen). An LLM parse is a later,
   budgeted option; the user's own chat client can also do it through the MCP.
4. **Match** to a trip by dates and place; ask when ambiguous. Create the booking (status booked),
   the trip item (transport or stay) and its attachment. Never keep the raw email longer than 30 days.

Connecting Gmail directly (as Wanderlog Pro does) needs Google's restricted-scope security
assessment, which costs money and time; forwarding gets most of the value without it.

## 5. Where we should not copy Wanderlog

- **Do not compete on restaurant and hotel breadth.** Their place data is Google's; Google's terms do
  not let us store Places content. Our catalog wins on depth where it matters for the trips in this
  repo (trails, viewpoints, booking windows, limits, seasons), and for the long tail a user pastes a
  link and gets a custom item. Saying this plainly avoids a product that is thin where it imitates.
- **Do not make the scrolling document the only view.** It is pleasant at 4 days and sluggish at 14
  days with tracks; the board view and the phone day-pager stay.
- **Do not paywall offline or reminders.** They are the reasons to switch.

## 6. The one-line positioning

*Wanderlog's planning page, TripIt's email import, plus what neither has: researched facts with
sources, a fit check for every person in the party, booking-window alarms, a prep checklist, and a
Today view that works with no signal.*

## 7. Wanderlog UI review (owner's screenshots, 17 Oct 2026)

Screenshots (removed before the repository went public, PUBLIC-SCRUB 25 Oct 2026: they were a third party's
UI): a new 15-day trip, empty, and Venice added to Places to visit.

### What the flow does
1. A three-column page: outline sidebar (Overview: Explore, Notes, Places to visit, other lists;
   Itinerary: one entry per date), the scrolling plan document, and a full-height map.
2. Overview starts with a reservations strip (Flight, Lodging, Rental car, Train, Attachment, Other)
   and a budget card, then Notes, then lists. "+ New list" and a ghost "Add a title (e.g.
   Restaurants)" invite more lists.
3. Every list and every day ends in an **"Add a place"** box, with two small buttons beside it (add a
   note, add a checklist).
4. A place becomes a numbered card (number = map pin): name, "Add notes, links, etc.", a "From the
   web" description, a photo, "Mark as visited", "Add time", "Attach" (paid), "Add cost", "Added by you".
5. Under the list, a **"Recommended places"** carousel (Grand Canal, Piazza San Marco...) with + buttons.
6. Clicking a place opens a **panel over the bottom of the map**: About, Photos, Mentions; "Added ▾"
   (which list), Mark as visited, Ask AI, suggested questions; Open in Tripadvisor, Google, Google Maps.
7. Each day has "Add subheading", **"Auto-fill day"**, **"Optimize route"** (paid), and a nudge
   "Looks like you don't have lodging for Nov 4-18 yet. Book hotels".
8. Undo and Redo sit in the top bar; Share and "Trip plan ▾" (switch between plan, budget...) beside them.

### Take (and how it lands in 02-experience.md 6.1)

| Wanderlog | Ours |
|---|---|
| Outline sidebar as a table of contents | same, but **each entry shows state** (count, base town, warning dot, done/total) |
| One add box per list and per day | same, and the box also takes a **pasted link** or a note |
| Numbered cards = numbered pins | same; the section in view is highlighted on the map |
| Reservations strip at the top of the plan | same strip, plus **Forward an email** (07 section 4); feeds the booking timeline |
| Budget card | same, by category (01 section 3.7) |
| Recommended places under a list | same, but each card shows **why** and **who it fits** |
| Place panel over the map with "which list" and "open in Google Maps" | same, plus a **Facts** tab with sources and read dates, eligibility per traveller, booking window |
| Auto-fill day, Optimize route | both, **free**, always as a preview with one undo |
| "No lodging for these nights" | same check, the fix opens our Stays list, no booking ad |
| Undo/Redo in the top bar | same, backed by operation inverses; collaborator avatars beside them |

### Do not take

1. **The map ignores the trip.** The trip is "Trip to Dolomite" but the empty map shows Birmingham,
   Alabama, and the empty state suggests "Best attractions in Birmingham". Our map always opens on the
   trip's area (or its candidates); the viewer's location is used only for "distance from you".
2. **Upsell inside the plan**: a large AI Assistant button, PRO badges on Export, Attach and Optimize,
   and a hotel-booking banner inside Day 1. The planning surface should carry only the plan.
3. **"From the web" text with no source or date.** Ours shows where a fact came from and when it was
   read, and paraphrases instead of pasting.
4. **Empty scaffolding**: an "Untitled" list in the sidebar, a ghost list title, and empty days with
   their own add boxes make a long, hollow page (later days do collapse to headers, see below). Ours creates a list on its first item and collapses
   empty days to one line.
5. **Dates without content in the outline** ("Wed 11/4", "Thu 11/5"...). Ours shows where you sleep
   and whether the day has a problem.
6. **A five-step tip carousel** on first open. Ours teaches through empty states that do the thing
   ("Type a place, paste a link, or drop a pin").

### More screenshots (a list with a checklist, and budgeting; removed with the others)

- Beside each add box: **Add note** and **Add checklist** buttons. A checklist is a block inside a
  list or a day ("pack for the gondola: jackets, cash"). → we add item kind `checklist` (schema.sql),
  distinct from trip **tasks**: a checklist is local to a place or day; a task has a due date, an owner
  and a reminder. A checklist line can be promoted to a task with one tap.
- A **"+" divider** between sections inserts a new list there. → same; it replaces our always-visible
  "New list" button, which keeps the page quieter.
- **Days after the planned ones collapse to their headers** (Mon 16th, Tue 17th, Wed 18th). This
  corrects point 4 above in part: Wanderlog does collapse empty days. Our version adds the base town
  and warnings to that collapsed line.
- **Budgeting is a section at the end of the same document**: total, Set budget, Group balances, View
  breakdown, Add tripmate, Settings, and an Expenses list sorted by date with "Add expense". → we
  keep Budget as a section of the plan document too (and as its own view on the phone), with
  **planned vs actual by category**, and a new `expense` table. **Group balances (splitting) is out of
  v1** because the audience is the family; the columns exist so it is a UI addition later.
- "Add tripmate" lives inside Budgeting, which mixes people with money. Ours keeps people in one
  place (the People view), and the budget only asks "who paid" when splitting is turned on.

### Still to check in Wanderlog (try these before we design further)
- Their **phone app** day view and offline behaviour (the key moment for us).
- How "Auto-fill day" chooses and explains its picks.
- What happens on a 14-day trip with 60 places: scroll speed, and whether the map stays readable.
- The Budget view and the "Trip plan ▾" switcher (what other views exist).

## Sources
- Pilot vs Wanderlog comparison: https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison
- Stippl vs Wanderlog (2026): https://app.stippl.io/blog/stippl-vs-wanderlog
- Wanderlog review, Endless Travel Plans: https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review
- Wanderlog on Trustpilot: https://www.trustpilot.com/review/wanderlog.com
- Wanderlog Google Play feedback analysis: https://kimola.com/reports/unlock-insights-with-the-wanderlog-app-feedback-analysis-google-play-en-us-154237
- TripIt review, Pilot: https://www.pilotplans.com/blog/review-of-tripit
- TripIt on the App Store: https://apps.apple.com/us/app/-/id311035142
