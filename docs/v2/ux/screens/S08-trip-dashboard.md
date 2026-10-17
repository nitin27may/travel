# S08. Trip dashboard (Overview)

## Purpose
The place every visit to a trip starts: the one most urgent thing, readiness across Plan · Book ·
Prepare · Go, upcoming deadlines, the party, and doors to everything else. Changes with the phase.

## Entry points
Opening a trip in phases idea, book, prepare, after (README §3); the Overview tab.

## Wireframes

Desktop (map on the right shows all bases and the route):

```
┌ Dolomites · Tue 13 – Mon 26 Jul 2027 · 13 nights · in 269 days ───┬ map ───────────────┐
│ ⚑ NEXT: Seceda lift tickets go on sale in 9 days (Mon 26 Oct 09:00 │  Venice ─ Ortisei   │
│   Rome = 03:00 Whitby). [Set reminder ✓] [Open]                    │   ─ Corvara ─       │
│                                                                    │   Cortina ─ Venice  │
│ READINESS                                                          │                     │
│ Plan     ▰▰▰▰▰▰▰▰▱▱  11 of 13 days planned · 2 warnings           │                     │
│ Book     ▰▰▰▱▱▱▱▱▱▱  3 of 9 reservations · next deadline 9 d      │                     │
│ Prepare  ▱▱▱▱▱▱▱▱▱▱  0 of 14 tasks                                 │                     │
│ Go       — opens 3 days before                                     │                     │
│                                                                    │                     │
│ UPCOMING                                                           │                     │
│  Mon 26 Oct  Seceda lift tickets on sale                           │                     │
│  Sun 15 Nov  Book Rifugio Lagazuoi (opens 1 Nov, fills fast)       │                     │
│  Thu 31 Dec  Last day to cancel Hotel Ambra free                   │                     │
│                                                                    │                     │
│ PARTY  ●Nitin ●Priya ●Kai 10 ●Mira 10   [Who can do what]        │                     │
│ BUDGET  $11,240 planned · $3,820 paid      [Budget]                │                     │
│ [Plan] [Bookings] [Tasks] [People] [Share]                         │                     │
└────────────────────────────────────────────────────────────────────┴─────────────────────┘
```

Phone:

```
┌───────────────────────────┐
│ ‹ Dolomites        ●● ⋯   │
│ 13–26 Jul · in 269 d      │
│ ┌───────────────────────┐ │
│ │⚑ Seceda tickets on    │ │
│ │ sale in 9 d · 03:00   │ │
│ │ your time [Open]      │ │
│ └───────────────────────┘ │
│ Plan    ▰▰▰▰▰▰▰▰▱ 11/13   │
│ Book    ▰▰▰▱▱▱▱▱▱ 3/9     │
│ Prepare ▱▱▱▱▱▱▱▱▱ 0/14    │
│ Upcoming ›                │
│ Party ●●●● ›  Budget ›    │
├───────────────────────────┤
│Overview Plan Bookings Tasks More│
└───────────────────────────┘
```

Phase variants: **idea** leads with "Choose where" (S05); **plan** with the next unplanned day and day
warnings; **book** with the booking timeline top 3; **prepare** with open tasks and "Make available
offline (84 MB)"; **go** is Today (S19); **after** with "How did it go?" and "Publish as template".

## Regions and components
TripHeader (title, dates, DateRelative, PresenceAvatars, ⋯) · NextActionBanner · ReadinessBar ×4 ·
UpcomingList (ReminderChip per row) · PartyStrip (FitAvatars) · BudgetBar · MapPanel (bases, legs).

## Primary action
The NextActionBanner's button (verb from the action: "Open booking", "Book the shuttle", "Download offline").

## States
- **No dates**: readiness Book/Prepare hidden; banner "Set dates to get booking deadlines".
- **Everything done**: banner "Nothing urgent. Next: tickets on sale Mon 26 Oct."
- **Live edit by another member**: a toast "Priya booked Hotel Ambra" and the bar animates.
- **Offline**: cached; banner time-stamped.
- **Viewer role**: no edit buttons; "You're viewing Priya's trip".

## Interactions
Click a readiness row → that tab filtered (Plan → days with warnings). Keyboard: `1`–`5` jump tabs.

## Copy
Times always in both zones when they differ: "09:00 Rome = 03:00 Whitby".

## Accessibility
Readiness bars have text; banner is the first heading after the trip title.

## Data and operations
`get_trip` summary: phase, counts, next action (ranked: overdue → opening within 24 h → book_by → free
cancel deadline → task due), reservations, tasks, budget totals; Realtime presence.

## Acceptance criteria
1. The next action is the earliest actionable deadline, never a completed one.
2. Time-zone pairs appear whenever the operator zone differs from home.
3. Phase variants render the right lead section for each phase.

## Share
Header "Share" → S26 with scope whole trip; members list and active links visible there.
