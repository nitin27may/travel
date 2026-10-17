# S03. The travel year

## Purpose
The January decision ("which long weekend, which trip, what budget"), from `Plan.md`: one timeline
with public holidays, long weekends, school breaks, trips by phase, candidates, the year's goals and
budget used.

## Entry points
Desktop rail **Year**; phone **You → Year**; "Plan a trip for this weekend" links from the home screen.

## Wireframes

Desktop:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 2027 ◂ ▸     Goals: ✓ 1 international (Patagonia)  ○ 1 local 3–4 days      Budget $9.4k/$16k │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│        Jan     Feb     Mar     Apr     May     Jun     Jul     Aug     Sep     Oct   Nov  Dec│
│ Holid. ▮Fam.Day       ▮Good Fri       ▮Victoria      ▮Canada ▮Civic  ▮Labour▮Thanks.       │
│ School        ███March break                    █████████████ summer ██      ▮PA day        │
│ Trips      ████Patagonia████                           ███Dolomites███   ███Iceland███    │
│ Ideas                                  ┄┄Nova Scotia?┄┄                                     │
│ Long w/e  ○      ○        ○        ○       ●Victoria  ○        ○       ○      ●Thanksgiving │
└──────────────────────────────────────────────────────────────────────────────────────────┘
 Selected: Victoria Day weekend · Sat 22 – Mon 24 May · no trip
 [ Plan a trip for these dates ]  [ Day trip ideas ]
```

Phone: a vertical month list; each month a row of chips (holidays, school break, trips); tap a chip
to open the same "Selected" sheet at the bottom.

```
┌───────────────────────────┐
│ 2027        $9.4k / $16k  │
│ ✓ International ○ Local   │
│ JAN                       │
│  Fam. Day (Mon 15)        │
│ FEB                       │
│  ███ Patagonia 26 Feb →   │
│ MAR  March break 13–21    │
│ MAY  ● Victoria w/e 22–24 │
│      [Plan a trip]        │
└───────────────────────────┘
```

## Regions and components
YearHeader (year switcher, GoalChips, BudgetBar) · TimelineRows (holiday, school, trips, candidates,
long weekends) · TripBar (phase colour + pattern) · CandidateBar (dashed) · SelectionSheet.

## Primary action
"Plan a trip for these dates" (opens S04 with the dates pre-filled).

## States
- **No household region**: "Which province or state? Holidays depend on it." (select once).
- **No school breaks**: "Add your school breaks" row with a button (owner-entered; no reliable feed).
- **No goals**: "Set a goal for 2027" ghost chip.
- **Offline**: read-only from cache.
- **Partial**: trips without dates appear in a side list "No dates yet (2)".

## Interactions
Drag across days on the timeline (desktop) or tap start then end (phone) to select a range; click a
trip bar → trip; ←/→ keys move a day, Shift extends the selection.

## Copy
"Victoria Day long weekend · 3 days · no trip yet". Goals read as sentences: "1 international family
holiday: done (Patagonia)".

## Accessibility
The timeline has a table alternative ("View as list") with month, item, dates; trip bars use pattern
plus colour by phase.

## Data and operations
`calendar_window` (public holidays from reference data, school breaks per household), `trip` dates
and phase, `trip_candidate` with date windows, `travel_goal`, budget totals from `budget_line` and
`expense`.

## Acceptance criteria
1. Ontario 2027 statutory holidays and derived long weekends show without setup once the region is set.
2. Selecting a range and "Plan a trip" opens the intent sheet with those exact dates.
3. Goals tick automatically when a trip of the matching kind exists in the year.
