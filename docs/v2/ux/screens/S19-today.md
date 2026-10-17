# S19. Today mode

## Purpose
07:40 at a trailhead with one bar of signal: what's next, when to leave, how to get there, today's
tickets, light and weather, Plan B, running late, quick notes; all offline.

## Entry points
Opening a trip during its dates (default); the Overview tab becomes **Today**; a reminder ("Leave for
Seceda by 08:10").

## Wireframes

Phone:

```
┌───────────────────────────┐
│ Day 3 · Thu 15 Jul  ☁︎ off│  ← offline badge when offline
│ Ortisei · 🌅 05:46 🌇 21:04│
│ ┌───────────────────────┐ │
│ │ NEXT                  │ │
│ │ Seceda lift (Ortisei) │ │
│ │ 🎟 08:30 slot         │ │
│ │ Leave by 08:10        │ │
│ │ 12 min walk · 950 m   │ │
│ │ [Navigate] [Ticket]   │ │
│ └───────────────────────┘ │
│ ⛅ 14°/22° · gusts 25 km/h│
│ Rule: if gusts >50 at 07:00│
│ → Plan B (Museum Gherdëina)│
│ [Plan B ○]                 │
│ ── Today ───────────────── │
│ ✓ 07:30 Breakfast          │
│ ● 08:30 Seceda ridge 9 km  │
│ ○ 13:00 Rif. Firenze lunch │
│ ○ 16:30 Ortisei town       │
│ [Running late] [+ Note] [+€]│
├───────────────────────────┤
│Today Plan Bookings Tasks More│
└───────────────────────────┘
```

Desktop / tablet landscape: timeline left, map right with the next leg drawn, the NEXT card above
the timeline. Landscape phone: same split.

## Regions and components
TodayHeader (day, base, sun times, OfflineBadge) · NextCard (title, anchored time, LeaveBy, travel
mode and time, Navigate, Ticket → wallet) · WeatherStrip (forecast + rule + PlanBToggle) · DayTimeline
(ItemRow with done/skip, current highlighted) · RunningLateSheet · QuickNote · ExpenseQuickAdd.

## Primary action
"Navigate" on the NEXT card (opens Google Maps or Apple Maps with the destination; the user's choice
is remembered).

## States
- **Before the first item**: NEXT = first item with leave-by from the night's base.
- **Between items**: NEXT moves when the current is marked done or its end time passes (asks "Done
  with Seceda ridge?" rather than assuming).
- **Plan B on**: affected items swap visibly with "Plan B" labels; toggle back anytime.
- **Running late**: "Shift the rest of today by [15][30][45][60] min" → preview of what no longer
  fits ("Rif. Firenze kitchen closes 14:30", "sunset before Ortisei walk ends") → Apply (one undo).
- **Travel day**: NEXT shows "Leave for VCE by 07:35" (check-out, drive, airport buffer).
- **Offline**: everything from the downloaded copy; forecast shows its age ("from 06:12"); navigation
  opens the maps app (which may have its own offline maps).
- **Not downloaded**: banner "Download today for offline use (6 MB)" if online.
- **No items today**: "A free day. Ideas nearby: 4 ›" (from the trip's lists, near the base).

## Interactions
Tap an item → sheet; swipe right on an item = done; long-press = skip/move to tomorrow; shake-free:
no gesture-only actions.

## Copy
"Leave by 08:10" (never "ETD"). Sun times labelled with icons and words for screen readers.

## Accessibility
High-contrast "sunlight" mode toggle in the header ⋯; NEXT card is the first heading; live region
announces when NEXT changes.

## Data and operations
Trip offline copy (IndexedDB), anchored reservations, night base, `leg_cache` legs, sun (core sun
module), Open-Meteo forecast cached, day weather rule, `day_state` (actual times, done, delay); ops
`mark_done`, `shift_day`, `toggle_plan_b`, `add_note`, `add_expense` queued offline.

## Acceptance criteria
1. In airplane mode, Today shows NEXT, leave-by, tickets and the timeline from the downloaded trip.
2. "Running late" lists every conflict before applying.
3. The leave-by time includes the travel leg and any parking or check-in buffer.

## Share
"Share my day" (today's plan, read-only, expiring tonight) and "Send live ETA" (text with leave-by
and destination via the native share sheet) from ⋯ — through the Share sheet (S26), scope "one day".
