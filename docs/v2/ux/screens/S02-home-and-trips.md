# S02. Home and the trips list

## Purpose
Signed out: answer "what's near me worth doing" (the Travel Finder idea: the location is the lens).
Signed in: show every trip by phase with its single next action, so one glance tells the family what
needs doing this week.

## Entry points
App launch; the logo; bottom-bar **Trips**; after sign-in.

## Wireframes

Desktop, signed in:

```
┌ rail ┬─────────────────────────────────────────────────────────────────────────────────────┐
│Trips │ Trips                                     [ + Plan a trip ]  [ Day trip from home ]  │
│Explore│                                                                                    │
│Year  │ NEEDS YOU THIS WEEK                                                                  │
│Templ.│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│Inbox │ │⚑ Algonquin day permit opens Tue 6 Oct 07:00 · in 2 days   [Open booking]          │ │
│      │ │⚑ Chamonix: last day to cancel Hôtel du Bois free · Fri    [Review]                │ │
│      │ └──────────────────────────────────────────────────────────────────────────────────┘ │
│      │ GOING SOON                                                                           │
│      │ ┌────────────────────┐ ┌────────────────────┐                                        │
│      │ │[hero photo]        │ │[hero photo]        │                                        │
│      │ │Algonquin & Muskoka │ │Vermont foliage     │                                        │
│      │ │Sat 10 – Mon 12 Oct │ │Thu 1 – Sun 4 Oct   │                                        │
│      │ │in 23 days · 2 nts  │ │in 14 days · 3 nts  │                                        │
│      │ │▰▰▰▱ Book 4/5       │ │▰▰▰▰ Prepare        │                                        │
│      │ │● Offline ready     │ │Next: download maps │                                        │
│      │ └────────────────────┘ └────────────────────┘                                        │
│      │ PLANNING                                                                             │
│      │ [Iceland van, Sep 2027] [Patagonia, Feb 2027] [Dolomites, Jul 2027] [Chamonix 2028]  │
│      │ IDEAS  [Norway summer 2028] [Peru · no dates]                                        │
│      │ PAST ▸ (6)                                                                           │
└──────┴─────────────────────────────────────────────────────────────────────────────────────┘
```

Phone, signed in:

```
┌───────────────────────────┐
│ Trips              🔍  ●N  │
│ ┌───────────────────────┐ │
│ │⚑ Algonquin permit     │ │
│ │  opens Tue 07:00 · 2d │ │
│ │  [Open booking]       │ │
│ └───────────────────────┘ │
│ Going soon                │
│ ┌───────────────────────┐ │
│ │[photo] Algonquin      │ │
│ │Sat 10 Oct · in 23 d   │ │
│ │▰▰▰▱ Book 4/5          │ │
│ └───────────────────────┘ │
│ Planning ›   Ideas ›      │
│ Past (6) ›                │
│                       (+) │
├───────────────────────────┤
│ Trips Explore Inbox  You  │
└───────────────────────────┘
```

Signed out (both sizes): a location line "Near Whitby, ON · change", persona chips, "Good right now"
strip (fall colours this weekend, Elora tubing closed for the season), a grid of nearby day trips
ranked by drive time, and "Plan a trip" as the primary button.

## Regions and components
NextActionBanner (aggregated across trips, max 3, "See all" → Inbox) · TripCard (hero, title, dates,
DateRelative, nights, ReadinessBar, next action line, OfflineBadge) · SectionHeader with count ·
PersonaChips and PlaceCard (signed out) · Floating + (phone).

## Primary action
"Plan a trip". Secondary: "Day trip from home".

## States
- **Empty (signed in, no trips)**: "Plan your first trip" with three starts: Plan a trip · Day trip
  from home · Start from a template (shows 3 public templates, e.g. "Canadian Rockies 14 nights,
  family with a young child").
- **Loading**: three skeleton cards; NextActionBanner hidden until loaded (no flash of "nothing to do").
- **Offline**: cached list with "Offline · from 07:12"; cards for trips not downloaded show "Not
  available offline" when tapped.
- **Error**: "Couldn't load your trips. Retry." with cached data if any.
- **Shared trips**: trips where the user is an editor or viewer appear in the same sections with the
  owner's avatar.
- **Past**: collapsed by default (done trips hidden, per the brief); expanding shows year groups.

## Interactions
Tap a card → trip (lands per phase, README §3). Long-press (phone) or ⋯ (desktop) → Duplicate · Make
template · Archive · Leave trip. Pull to refresh on phone. Keyboard: arrow keys move between cards.

## Copy
"in 23 days · Sat 10 Oct". Sections named by what the user does, not by status codes: "Needs you this
week", "Going soon", "Planning", "Ideas", "Past".

## Accessibility
Each card is one link with an accessible name combining title, dates and next action; the readiness
bar has text ("Bookings 4 of 5").

## Data and operations
`list_trips` with phase, readiness counts, next action (computed server-side from tasks and
reservations); reminders due in 7 days.

## Acceptance criteria
1. A trip with an open booking window in the next 7 days appears in "Needs you this week".
2. Done trips never show outside Past unless pinned.
3. The list renders from cache within 300 ms on a repeat visit, offline included.

## Share
Trip card ⋯ → "Share" opens the Share sheet (S26) with scope "whole trip"; signed-out day-trip results have "Share this search".
