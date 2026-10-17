# S11. Planning on the phone: the day pager

## Purpose
Plan and review one day at a time with one thumb: a vertical timeline per day, swipe between days,
the map as a sheet, lists one tap away.

## Entry points
Trip tab **Plan** on phone; deep links `?day=N`.

## Wireframes

```
┌───────────────────────────┐
│ ‹ Rockies 2029    ●● 🔍 ⋯ │
│ [Lists][1][2][3●][4][5]…  │  ← day chips, scrollable; ● = warning
│ Day 3 · Mon 10 Sep        │
│ sleep: Banff Inn          │
│ drive 1 h 10 · walk 9.8 km│
│ ⚠ No break in 3 h 40 [Fix]│
│ [A adults][B family][C]   │
│ ┌───────────────────────┐ │
│ │ 07:30 Cory Pass loop  │ │
│ │ 13 km ↑915 · A        │ │
│ └───────────────────────┘ │
│   ── 15 min drive ──      │
│ ┌───────────────────────┐ │
│ │ 13:00 Lunch · all     │ │
│ └───────────────────────┘ │
│ [ Add to day 3…      ] [⊞]│
│ ═══ map ▴ ═══════════════ │  ← peek of the map sheet
├───────────────────────────┤
│Overview Plan Bookings Tasks More│
└───────────────────────────┘
```

Lists page (the first chip): the trip's lists stacked with counts and AddBoxes; tap an item → sheet
with "Add to day ▾".

## Regions and components
DayChips · DayHeader (compact) · VariantTabs · ItemRow · AnchoredItem · LegRow · AddBox · Floating ⊞
menu · BottomSheet (map; snap peek/half/full) · DetailSheet.

## Primary action
AddBox for the day (also the floating +).

## States
As S09. Offline queue marks; viewer mode without add controls; empty day: "Nothing on day 4 yet.
Add from your lists (14 ideas) or Fill this day."

## Interactions
Swipe left/right changes day (with day chips as the visible alternative); long-press an item → Move
to… (Day · Ideas · after an item), Set time, Who, Duplicate, Delete (undo); drag handle on the right
edge reorders within the day; pull the map sheet up to see the day route.

## Copy
Same as S09; shorter labels on narrow screens ("walk 9.8 km ↑560").

## Accessibility
Day chips are tabs; swipe has buttons; long-press menus are also reachable via each item's ⋯ button.

## Data and operations
Same as S09.

## Acceptance criteria
1. Every planning action available on desktop is reachable on the phone without drag.
2. Switching days takes under 150 ms from cache.
