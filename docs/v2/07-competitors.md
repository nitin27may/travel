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

## Sources
- Pilot vs Wanderlog comparison: https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison
- Stippl vs Wanderlog (2026): https://app.stippl.io/blog/stippl-vs-wanderlog
- Wanderlog review, Endless Travel Plans: https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review
- Wanderlog on Trustpilot: https://www.trustpilot.com/review/wanderlog.com
- Wanderlog Google Play feedback analysis: https://kimola.com/reports/unlock-insights-with-the-wanderlog-app-feedback-analysis-google-play-en-us-154237
- TripIt review, Pilot: https://www.pilotplans.com/blog/review-of-tripit
- TripIt on the App Store: https://apps.apple.com/us/app/-/id311035142
