# Core interactions (working draft)

Each interaction lists what the person does, what they see at each moment, and the rules that keep it
fast and predictable. The prototype implements these; differences are noted in prototype.md.

## 1. Predictive search and add (the add box)

**Where:** at the end of every list and every day; the universal **+** (`/` on desktop) opens the same
box as a palette.

1. Typing starts matching on the **first character**, with no submit. Results update within one frame
   for the local catalog (prefix + fuzzy on name, aliases, area; diacritics ignored: "lago di braies"
   matches "Pragser Wildsee").
2. Results are grouped and ranked: **This trip** (already in a list, so you move instead of duplicating)
   → **Catalog near this day's base** (sorted by drive time from the base) → **Elsewhere** → **Add "…" as
   my own place** (always last, always present) → a pasted link is recognised and becomes the first row.
3. Every row shows what decides the pick without opening it: kind glyph, name, area, **drive time from
   tonight's base**, and a fit line ("fits all" or "Aarav 10: needs 12+").
4. Arrow keys move, Enter adds, Tab cycles groups, Esc closes; on phone the box opens full-screen with
   the keyboard and results above it (thumb reach).
5. Adding: the row **flies** to its slot in the day (shared-element move), the pin **drops** on the map
   at the same moment, the day's legs and totals **recount**, and a toast offers **Undo** for 6 s.
6. Typing a time first ("9:30 seceda") sets the item's time. Typing a day ("seceda day 12") targets
   that day from anywhere.

## 2. Set a base (where we sleep)

1. Each day header shows **Sleep: <place>** or **Set where you sleep**.
2. Choosing it opens the add box filtered to stays and towns, ranked by how central they are to the
   day's items (sum of drive times), with that sum shown on each row.
3. Picking a base: a house pin in `--glow` drops; the day's route **redraws from the base and back**;
   every leg and the day's driving total animate to their new values; the outline shows the base town.
4. Applying to a run of nights: "Sleep here nights 2-4" is one choice; days that share a base show it
   once in the outline with a bracket.
5. A recorded stay reservation sets the base automatically and shows a ticket mark; changing that base
   by hand asks whether to change the reservation or only this day's plan.

## 3. Moving things: drag in the document

1. **Desktop:** grab anywhere on a card (or its handle) and the card lifts (scale 1.02, shadow,
   `--glow` outline). Other items slide apart smoothly to show the drop slot.
2. Hovering a **collapsed day** opens it after 400 ms; hovering the **outline** entry of a day jumps the
   document there (drop straight onto "Day 9" in the outline).
3. While dragging, the map shows **where it would go**: the target day's route with a dashed new leg,
   and the predicted change ("+42 min driving").
4. Drop: the card settles with a spring; legs and totals recount; Undo toast.
5. **Keyboard:** focus a card, Space to pick up, arrows to move (up/down within a day, PageUp/PageDown
   between days), Space to drop, Esc to cancel; every step announced ("Seceda, day 12, position 2 of 4").
6. **Phone:** long-press 300 ms (with a light haptic where supported) lifts the card; the page
   auto-scrolls near the edges; or use **Move to…** in the item menu (Day, list, position), which is the
   reliable path on small screens.

## 4. Moving things on the map

1. **Drag a pin** of a custom place to correct its position: legs to and from it update live during the
   drag (throttled to animation frames), the item's coordinates save on release, Undo offered.
   Catalog places cannot be dragged (their location is shared); the gesture offers "Suggest a
   correction" instead.
2. **Drop a pin:** long-press (phone) or right-click (desktop) on the map → "Add a place here" with the
   nearest known catalog places listed first ("Did you mean Rifugio Lagazuoi, 120 m away?").
3. **Drag a pin onto a day** in the outline or a day header to move that item to that day.
4. Clicking a pin selects the item, scrolls the document to it and opens its panel; hovering a card
   lifts its pin (and the reverse).

## 5. Distances and recalculation

1. Legs are computed between consecutive items with a location, starting and ending at the night's base.
2. Each leg shows **mode, time, distance** between the two cards ("Drive 38 min · 24 km"); walking legs
   under 15 min show walking.
3. The day header shows totals that decide feasibility: **driving**, **walking km and climb**,
   **daylight left** at the last item, **bookings**. A total over the trip's pace limit turns `--warn`
   with the reason.
4. Recalculation is instant from the leg cache; a missing leg shows an estimate (straight line ×
   terrain factor, marked "≈") immediately and swaps to the routed value when it arrives, animating the
   number. Nothing waits on the network to respond to a drop.
5. Numbers animate from old to new value (300 ms) so a change is noticed; the change also appears once
   as a delta chip ("+18 min").

## 6. Undo and history

Every change is one operation with an inverse: the toast's **Undo**, `Ctrl/Cmd+Z` and the history
panel all use it. A batch (an MCP edit, "fill this day") is one undo.

## 7. Transitions between views

| From → to | Transition |
|---|---|
| Card → place panel | panel slides in over the map (desktop) or sheet rises (phone); the card stays highlighted |
| Outline click → day | document scrolls (smooth, 300-600 ms), the map flies to the day's bounds |
| Plan → Today | cross-fade; next stop card grows into place |
| List view ↔ board view | items move to their new positions (layout animation), no fade-out |

## 8. Phone layout gestures

- Plan: one day per page, swipe left and right between days; the map is a **bottom sheet** with three
  snap points (peek 120 px showing the day's route strip, half, full); dragging the sheet never scrolls
  the page underneath.
- Pull down on a day to see the day header and totals; the add button sits bottom-right within thumb
  reach, above the sheet's peek.
- Edge cases: the keyboard pushes the add box above it; the sheet collapses when the keyboard opens.
