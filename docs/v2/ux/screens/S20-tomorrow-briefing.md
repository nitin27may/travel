# S20. Tomorrow briefing

## Purpose
Each evening of the trip: start time, what to pack in the day bag, tomorrow's bookings, the forecast,
anything to do tonight.

## Entry points
A card at the top of Today after 18:00 local (and a push at a user-chosen time, default 19:30);
Inbox item.

## Wireframes

```
┌───────────────────────────┐
│ Tomorrow · Fri 16 Jul      │
│ Start: leave 07:15 for     │
│ Alpe di Siusi (park lot    │
│ fills by 08:30)            │
│ Bookings: none · Plan B:   │
│ Ortisei pool if rain       │
│ ⛅ 12°/19° · rain 60 % pm  │
│ Day bag: rain shells ×4,   │
│ snacks, cash for rifugio   │
│ Tonight: buy lunch · charge│
│ the GPS · fill the tank    │
│ [Open tomorrow] [Got it]   │
└───────────────────────────┘
```

Desktop: the same card in the Overview column.

## Regions and components
BriefingCard (start/leave-by, bookings list, Plan B, WeatherStrip compact, DayBag checklist from
the day's checklists + pack template items marked "day bag", Tonight tasks from on_the_day group).

## Primary action
"Open tomorrow" (Today view for tomorrow).

## States
Nothing planned tomorrow → "Free day tomorrow. Ideas near Ortisei ›". Offline → forecast age shown.
Last day → "Travel day: leave for VCE by 07:35. Check-out by 10:00."

## Interactions
Tick day-bag lines in the card; "Got it" dismisses until next evening.

## Copy
Short sentences; times local.

## Accessibility
Card is a region with heading "Tomorrow, Friday 16 July".

## Data and operations
Tomorrow's items and anchored reservations, weather, checklists, tasks with group on_the_day.

## Acceptance criteria
1. Appears only during the trip, from 18:00 local time (configurable).
2. Includes every reservation segment that starts tomorrow.

## Share
"Share tomorrow's plan" with the party (members get it already; guests via S26 one-day link).
