# S10. Board view (desktop and tablet)

## Purpose
Big rearranging: see all days as columns, drag across them, spot overloaded days. A second view of
the same plan; the document stays the default.

## Entry points
View switcher in the Plan top bar ("Document | Board"); remembered per user per trip.

## Wireframes

```
┌ Plan · Board ─────────────────────────────────────────────────── [Document|Board]  Map ▸ ┐
│ Ideas (14)   │ Day 1 Tue 13 Jul │ Day 2 Wed 14 │ Day 3 Thu 15 │ Day 4 Fri 16 │ Day 5 …    │
│ Venice → Ort.│ Venice           │ →Ortisei     │ Ortisei      │ Ortisei      │            │
│              │ drive 0 · walk 6 │ drive 2h40 ⚠ │ walk 11 ↑700 │ walk 4       │            │
│ [Seceda]     │ ✈ arr 09:05 🎟   │ 08:30 leave  │ 08:30 Seceda │ Alpe di Siusi│            │
│ [Lago Braies]│ Rialto           │ Lago Braies  │ ridge ●●●●   │ ...          │            │
│ [Tre Cime]   │ San Marco        │ 🛏 Ambra 15:00│ Rif. Firenze │              │            │
│ [+ add]      │ [+ add]          │ [+ add]      │ [+ add]      │ [+ add]      │            │
│              │ ═══════ Hotel Ambra (nights 2–4) ═══════════════╡              │            │
└──────────────┴──────────────────┴──────────────┴──────────────┴──────────────┴────────────┘
```

Spans (stays, a 4-day trek, the car rental) draw as bars under the columns. Variants show as stacked
lanes inside a column with their traveller avatars.

Tablet: 3 columns visible, horizontal scroll with snap; phone: not offered (S11 instead).

## Regions and components
BoardColumn (DayHeader compact, ItemCard compact, AddBox) · SpanBar · IdeasColumn · Map toggle
(collapsible right panel showing the hovered day's route).

## Primary action
Drag an item to a day.

## States
Same as S09 (empty, warnings, conflict, offline, viewer). A column turns amber when its totals exceed
the pace budget, with the reason on hover/focus.

## Interactions
Drag with auto-scroll at edges; Shift-drag selects several; keyboard: arrows move focus, Space picks
up, arrows move, Space drops, Esc cancels (dnd-kit keyboard sensor); column ⋯ = day menu.

## Copy
Over-budget: "Day 2 is over your balanced pace: 2 h 40 driving + 9 km walking."

## Accessibility
Columns are lists with headings; drag announcements: "Picked up Seceda. Day 3, position 1 of 3."

## Data and operations
Same `get_trip` and `edit_trip` ops as S09.

## Acceptance criteria
1. Dropping an item on a column produces one `move_item` op with one undo.
2. Span bars match reservation segments and multi-day items exactly.
