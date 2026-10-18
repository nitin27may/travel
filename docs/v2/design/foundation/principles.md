# UX principles (owner, 18 Oct 2026)

These come before any pattern, component or token. Every design, every build brief and every review is
checked against them. Reviewers cite them by number.

## P1. Design for scale

The test of the UI is how easily a visitor finds the one thing they want when there are 10,000 places and
trips, not 100. Lists, search, filters and the globe are judged at that size:
- result counts
- grouping
- clustering
- empty states
- performance

## P2. Show everything, progressively

Nothing important is hidden for good, and nothing is shown all at once. Each screen has a first view that
answers the visitor's main question. Detail opens step by step, on demand.
- The trip page leads with the shape of the trip: the timeline at a glance, then the days.
- A visitor deep-diving one day can then answer, one click at a time:
  - should we go there?
  - how long will it take?
  - how steep is the trail?
  - is there a booking we are missing?

## P3. A glance, then a few clicks

The first view must be readable at a glance. Any deeper fact is a few clicks away ("tick, tick, click,
click"), never a hunt.
- Each level of detail is one tap or click from the level above.
- The way back is always visible.

## P4. No manual needed

Search and filters must be understood on first use, without help text or documentation:
- plain labels
- visible current state (chips, counts)
- one obvious way to clear
- results that update as you choose

If a control needs explaining, the control is wrong.

## P5. Every open and close is smooth and linked

Components that open, close, expand or move between views do so with short, consistent motion:
- the map follows the timeline
- the card grows from the pin
- the day expands in place

Context is kept: no jump to the top, no lost scroll, no lost selection. Reduced motion jumps but keeps the
same links.

## P6. The right metadata at the right moment

Each fact has a place where it matters and is shown there first:
- Effort and age on the day row.
- The trail's steepness when the trail is opened.
- Booking windows where the booking is due.

Metadata is shown as chips and short values, never as paragraphs. Provenance stays one step away.

## P7. Know the primary goal

About 90% of visitors come to search, read a trip or a place, and copy it with their own dates. About 10%
plan. The public pages are designed for the 90% first, and every screen names its primary action.

## How the principles are used

- **Fable design reviews** score each screen against P1-P7 and list each breach with a fix.
- **Build briefs** state which principles a lane must satisfy and how its acceptance checks measure them,
  for example "every day row answers effort, time and bookings at rest" (P2, P6).
- **The verifier sweep** includes a first-use walk with no prior knowledge (P4) and a large-data check (P1).
