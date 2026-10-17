# S22. Inbox (reminders and notifications)

## Purpose
One list of every reminder and notification, with state (upcoming, due, done, missed), each linking
straight to the booking page and the task. The place to recover a missed push.

## Entry points
Bottom bar **Inbox** (badge = due now); push and email links; the dashboard "See all".

## Wireframes

```
┌───────────────────────────┐
│ Inbox          Filter ▾   │
│ DUE NOW                   │
│ 🔔 Seceda tickets on sale │
│   in 15 min · 03:00 your  │
│   time · Dolomites        │
│   [Open booking] [Done]   │
│ UPCOMING                  │
│ Fri  Last day to cancel   │
│      Hotel Ambra free     │
│ Mon  Algonquin day permit │
│      opens 07:00          │
│ ACTIVITY                  │
│ Priya booked Corvara B&B  │
│ Claude added 6 items ↶    │
│ From email: AC 892 added  │
│ MISSED (1)                │
│ Rifugio Lagazuoi opened 1 │
│ Nov · did you get it?     │
│ [Yes, booked] [No → plan B]│
└───────────────────────────┘
```

Desktop: two columns: list left, the linked object (reservation, task) right.

## Regions and components
InboxSection · ReminderRow (ReminderChip state, DateRelative, trip, actions) · ActivityRow (actor
avatar or client icon "Claude", Undo for batches) · Filter (trip, kind).

## Primary action
The row's action button (Open booking / Done / Yes, booked).

## States
Empty: "Nothing due. Next reminder: Fri 9:00 (cancel Hotel Ambra)". Notifications off: banner
"Push is off on this device. Turn on" (on iOS: "Install the app to your Home Screen first").

## Interactions
Swipe right = done; swipe left = snooze (1 h, tonight, tomorrow); batch undo for MCP activity.

## Copy
"Did you get it?" follow-ups always have two buttons.

## Accessibility
Sections are headings; badge count has text.

## Data and operations
`reminder` rows (state), `op_event` activity feed, inbound email events; ops `ack_reminder`,
`snooze`, `undo_batch`.

## Acceptance criteria
1. Every sent push also exists here with the same text.
2. A missed opening shows a follow-up with "booked" and "not booked" outcomes.

## Share
Not shareable (personal).
