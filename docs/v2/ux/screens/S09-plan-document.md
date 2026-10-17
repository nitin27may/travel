# S09. The plan document (desktop)

## Purpose
The main planning surface, after Wanderlog: one scrolling document of lists and days beside a map
that follows what you are reading. Fast at 14 nights with tracks A/B/C (the Rockies 2029 plan), and
quiet when empty. Spec origin: [../../02-experience.md](../../02-experience.md) 6.1.

## Entry points
Trip tab **Plan** (default in plan phase); outline links; command palette "day 6".

## Wireframes

```
┌ ‹ Trips  Rockies 2029 ▾  ↶ ↷   ●Priya ●you   [Share] ⋯ ───────────────────────────────────────┐
├ outline (220) ┬ document (≤760) ─────────────────────────────────┬ map (resizable) ───────────┤
│ Overview      │ ⚑ Next: Moraine shuttle seats release Sat 08:00 MT│ pins numbered to match;   │
│  Bookings 6/9 │ ── Bookings ──────────────────────────────────── │ section in view bold,     │
│  Notes        │ [✈ 2][🛏 4/5 ⚠][🚗 1][🎟 3 to book][📎][✉ Forward]  │ others faded; day route   │
│  Ideas     14 │ ── Notes ────────────────────────────────────── │ drawn for the open day    │
│  Lakes      6 │  Bring bear spray (buy in Banff, not carry-on)   │                            │
│  Food       5 │ ── Lakes (6) ─────────────────────────────────── │                            │
│ Days          │  1 Moraine Lake  shuttle · 25 min · ●●●●          │                            │
│  1 Calgary→   │    why: icon · book shuttle 48 h ahead            │                            │
│    Banff  ✓   │  2 Lake Agnes Tea House 7.4 km ↑400 · ●●●●        │                            │
│  2 Banff   ⚠1 │  [ Add a place, a link, or a note…      ] [🗒][☑]│                            │
│  3 Banff      │  Suggested: [Peyto Lake +][Emerald Lake +] ›     │                            │
│  4 →L.Louise  │ ──────────────── + ───────────────────────────── │                            │
│  …            │ ── Day 2 · Sun 9 Sep · sleep: Banff Inn ── ⌄ ─── │                            │
│ 15 → Calgary  │  drive 1 h 10 · walk 9.8 km ↑560 · sunset 20:14  │                            │
│ Tasks   9/23  │  ⚠ 3 h 40 driving with no break (your rule) [Fix]│                            │
│ Budget        │  [Track A adults][Track B family][Track C easy]  │                            │
│               │  A 1 07:30 Cory Pass loop 13 km ↑915            │                            │
│               │  B 1 09:00 Johnston Canyon to Upper Falls 5.4 km │                            │
│               │  C 1 09:30 Banff Gondola  🎟 booked 09:30        │                            │
│               │    ── 15 min drive ──                            │                            │
│               │  2 13:00 Lunch · Bear St (all)                   │                            │
│               │  [ Add to day 2…                        ] [🗒][☑]│                            │
│               │ ── Day 3 · Mon 10 Sep · sleep: Banff Inn ── › ── │ ← collapsed: one line      │
│               │ ── Budget ────────────────────────────────────── │                            │
│               │  planned $14,900 · actual $2,310 [Add expense]   │                            │
└───────────────┴──────────────────────────────────────────────────┴────────────────────────────┘
```

## Regions and components
- **Outline**: Outline with entries carrying state: list counts, day number + base town + status dot
  (✓ planned, ⚠ warnings, ○ empty), Bookings done/total, Tasks done/total. Scroll-spy highlights the
  section in view; click scrolls; drag a card from the document onto a day entry to move it there.
- **Document**: NextActionBanner · BookingsStrip · Notes (rich text) · lists (ListSection with
  ItemRow/PlaceCard compact, AddBox, Suggested row) · "+" InsertDivider between sections (new list
  here) · DaySection (DayHeader with base, totals, warnings, variant tabs; ItemRow, AnchoredItem,
  LegRow between stops, ChecklistBlock, NoteBlock, AddBox) · Budget section (BudgetBar, expenses).
- **Map**: MapPanel with NumberedPin, day route line, stays as home icons, flights as arcs, the
  DetailSheet over it.

## Primary action
The AddBox at the end of the section in view (focus with `A`).

## States
- **Empty trip**: one Ideas list with an AddBox "Type a place, paste a link, or drop a pin on the
  map"; days collapsed to one line each ("Day 1 · Tue 13 Jul · nothing yet"); no ghost lists.
- **Long trip**: days collapse to their header (base, totals, warnings); the next unplanned day (or
  today) is expanded; virtualised rendering keeps scroll at 60 fps with 60+ items.
- **Warnings**: inline under the DayHeader with a one-tap fix (02-experience.md 6.4); never modal.
- **Unbooked anchored item**: dashed border "not booked yet · book by 1 May".
- **Live edit**: PresenceAvatars on the item someone is editing; remote moves animate (or jump with
  reduced motion) with a polite announcement.
- **Conflict**: ConflictBanner on the field ("Priya changed this note while you were editing. Keep
  mine · Keep Priya's · See both").
- **Offline**: edits queue (clock mark), map tiles from the offline pack, catalog suggestions hidden.
- **Viewer**: no AddBoxes, no drag handles.

## Interactions
- Drag items within a day, between days, from lists to days, from document to outline entries.
- Keyboard: `J/K` next/previous item, `Enter` open, `M` move menu ("Move to… Day 3 · after Lunch ·
  Ideas"), `T` set time, `N` note, `⌘Z/⌘⇧Z` undo/redo, `[` `]` collapse/expand day, `G D` go to day.
- Day ⋯ menu: Fill this day (preview), Reorder to cut driving (preview), Add day before/after, Swap
  with day…, Clear day (to Ideas).
- AddBox: catalog suggestions as you type; Enter adds the first; "Add 'X' as my own" always present;
  a pasted URL becomes a link item with title/coordinates when the link has them; ⊞ menu: note,
  checklist, break, drive, stay, flight.

## Copy
Day header: "Day 2 · Sun 9 Sep · sleep: Banff Inn". Leg rows: "── 15 min drive · 11 km ──".
Variant tabs show who: "Track A · Nitin, Priya".

## Accessibility
Outline is a `nav` with the current section `aria-current`; each DaySection is a region with its
heading; drag has the Move menu; remote changes are announced politely, not assertively.

## Data and operations
`get_trip` (items, lists, day notes, reservations as anchored items, night bases, checks),
`edit_trip` ops (add_item, move_item, set_time, set_variant, add_note, add_checklist...), `draft_days`
preview, `check_trip`; Realtime channel `trip:<id>` for ops and presence.

## Acceptance criteria
1. A 14-night trip with 60 items opens in under 1.5 s and scrolls smoothly.
2. Every drag has an equivalent Move menu path.
3. Day headers show base, totals and warnings even when collapsed.
4. A collaborator's move appears within 1 s on another open screen.
5. No empty list is shown until it has an item.

## Share
Day ⋯ "Share this day", list ⋯ "Share this list", item ⋯ "Share place", Shift-select days → "Share days 3–5", day route ⋯ "Share route" (Google Maps link, GPX) — all through S26.
