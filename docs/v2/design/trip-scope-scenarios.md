# Trip scope: scenarios and acceptance checks (18 Oct 2026)

Every design direction, the Fable design-system review and the prototype changes are checked against this
page before anything is applied. It records the owner's requirement:
- Plan, bookings, tasks and budget belong to one trip, and the user must always know which trip they are working on.
- A household often has two or three trips in progress at once and moves between them in one sitting.

## The household on 18 Oct 2026 (use this data in every preview)

| Trip | Dates | Phase | What is live this month |
|---|---|---|---|
| Elora Gorge day trip | Sat 24 Oct 2026 | Preparing | tubing slot opens online Mon 19 Oct; leave by 08:10 on the day |
| Patagonia | 26 Feb - 11 Mar 2027 | Booking | international flight and El Chaltén lodging by **31 Oct**; domestic flights and car by 15 Nov; Piratour and minitrekking by 30 Nov |
| Dolomites | 13 - 26 Jul 2027 | Booking | Ortisei stay by 15 Mar; Tre Cime toll slot opens 15 Jun; Seceda lift slot 1 Jun |
| Costa Rica | 13 - 23 Feb 2027 | Planning | second base not chosen (Monteverde or La Fortuna) |
| Iceland, Chamonix, Rockies, Norway, Peru | 2027-2029 | Planning or Idea | no deadlines this year |
| Algonquin, Vermont, Île d'Orléans | Sep - Oct 2026 | Done | templates; "how did it go" corrections |

Patagonia and Dolomites are booked in the same weeks, and Elora happens in between. That overlap is the
case the design has to make easy.

## Rules the design must satisfy

1. **One trip in context at a time, always visible.**
   - Every trip-scoped screen (Plan, Today, Bookings, Tasks, Budget, Share) shows the trip's name, its identity colour or photo, and its dates in a fixed place.
   - The header on desktop and the top bar on phone.
   - It stays visible when scrolling, opening a sheet or opening a form.
2. **Switching is one action and keeps your place.**
   - The trip switcher lists in-progress trips first, soonest first, each with its next deadline.
   - Switching from Dolomites Bookings to Patagonia lands on Patagonia Bookings, not on its Plan.
   - Each trip remembers its last tab, its scroll position and its map day.
3. **Every trip has an identity.**
   - A hero photo and a colour (from a fixed, colour-blind-safe set) appear in the switcher, the header, cards, notifications and cross-trip lists.
   - Two trips are never told apart by name alone.
4. **Nothing is ever silently put in the wrong trip.**
   - Adding a booking, task or expense from inside a trip files it in that trip, and the form header names the trip.
   - Adding from a cross-trip place (Home, the notification centre, a forwarded email) requires a trip.
   - The suggested trip comes from the dates (a hotel for 1-5 Mar 2027 suggests Patagonia), and a one-tap change is offered.
   - Moving an item to another trip is an explicit action that can be undone.
5. **Cross-trip views summarise; the trip is where work happens.**
   - Home's "Needs you this week" shows the next deadlines from every trip, grouped by trip, sorted by due date.
   - Each row carries the trip's colour and name, and allows only tick, snooze and open.
   - Opening a row lands inside that trip on the right tab with the item open.
   - A Year view shows every trip's spend and the booking windows on one timeline.
6. **Person-level items are shared, not duplicated.**
   - Passports, memberships and passes belong to people.
   - A trip shows them as linked checks ("Aarav's passport valid to Oct 2027: too short for Dolomites").
   - Fixing one fixes it everywhere.
7. **Today belongs to the trip in progress.**
   - On a travel day, Today opens that trip automatically, even if another trip was last selected, and says so.
   - Planning another trip while travelling is allowed, and the header makes the switch obvious.
8. **Reminders and notifications always name the trip and open it in context.**
   - Example: "Patagonia · Book El Chaltén lodging · due Sat 31 Oct".
9. **URLs carry the trip.**
   - For example `/trips/patagonia-2027/bookings/r-123`.
   - A shared or bookmarked link never opens the wrong trip.

## Scenarios (each preview and the prototype must pass all of them)

| # | Scenario | Pass when |
|---|---|---|
| S1 | Monday evening: open the app with nothing selected | Home shows the 3 nearest deadlines across Elora, Patagonia and Dolomites, each tagged with the trip's colour and name, plus "open" goes straight to the item inside its trip |
| S2 | Book the Patagonia flight, then the Dolomites Ortisei hotel, in one sitting | two switches, each one tap, landing on Bookings both times; the form header names the trip; nothing appears in the other trip |
| S3 | Forward a hotel confirmation email for 1-5 Mar 2027 | it lands in a review step that suggests Patagonia from the dates; the user confirms or picks another trip |
| S4 | A task "Renew Aarav's passport" | it lives on the person; Dolomites and Patagonia both show it as a linked check; ticking it once clears both |
| S5 | Sat 24 Oct, at Elora, with Dolomites last selected | Today opens Elora with a clear "Today: Elora Gorge" header; switching back to Dolomites planning is one tap and clearly labelled |
| S6 | Tasks tab inside Dolomites | only Dolomites tasks plus linked person checks; a link "2 more due this week in other trips" goes to the cross-trip list |
| S7 | Budget in February with Costa Rica and Patagonia overlapping in money | each trip's budget is its own; the Year view totals both, with the currency of each |
| S8 | Phone, one hand, in a car park | the trip name, the next action and the switcher are reachable with the thumb; no trip-scoped screen hides which trip it is |
| S9 | A shared link to a Patagonia booking opened by the partner | it opens Patagonia, Bookings, that booking, with the partner's permissions |
| S10 | A done trip (Vermont) | hidden from the switcher's in-progress list, reachable under "Done", opens read-only with "Use as a template" |

## How this page is used

1. The redesign previews show S1, S2 and S5, at least as static frames.
2. The Fable review checks the design system and every component against the rules above, and lists any rule a component breaks.
3. Before applying a design to the prototype, the owner's assistant walks S1-S10 in the previews and in the prototype. It records pass or fail with screenshots in `docs/v2/design/scenario-check.md`. Failures are fixed in the design first.
