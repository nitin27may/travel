# S06. Explore: map + cards, filters, persona chips, zero-result rescue

## Purpose
Find what fits, fast: "lakes under 8 km for kids 9+ within 45 min of Lake Louise". Works signed out
(the day-trip finder), from inside a trip (adds go to that trip), and as the area guide.

## Entry points
Bottom bar **Explore**; a trip's "Add places" / "Suggested for this list → more"; an area guide link;
command palette search; a shared URL (state lives in the URL).

## Wireframes

Desktop (split, synced):

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ From: [● Lake Louise base ▾]  [ 🔍 lakes for kids under 8 km                      ]  ⌘K  │
│ [Family 9+][Hard hikes][Rainy day][Accessible][Sunrise spots]   ← persona chips           │
│ lake ✕ · ≤ 8 km ✕ · ages 9+ ✕ · ≤ 45 min ✕ · open Sep 10–24 ✕   [Filters (5)]  Sort: drive│
├───────────────────────────────────────────┬──────────────────────────────────────────────┤
│ 23 places · Cards ▾                        │                                              │
│ ┌──────────────┐ ┌──────────────┐          │     ①       ②                                │
│ │[photo]       │ │[photo]       │          │        ③ ●base                               │
│ │Lake Agnes    │ │Moraine Lake  │          │               ④                              │
│ │7.4 km·400 m  │ │shuttle only  │          │                    [Search this area]         │
│ │12 min · free │ │25 min · $8   │          │                                              │
│ │●●●● fits all │ │●●●● fits all │          │                                              │
│ │lake·tea house│ │lake·icon     │          │                                              │
│ │why: lake+fam │ │why: lake+fam │          │                                              │
│ │ · Sep open   │ │ · book shuttle│         │                                              │
│ │[+ Add ▾]     │ │[+ Add ▾]     │          │                                              │
│ └──────────────┘ └──────────────┘          │                                              │
└───────────────────────────────────────────┴──────────────────────────────────────────────┘
```

Phone (map with a draggable sheet; three snap points: peek, half, full):

```
┌───────────────────────────┐
│ 🔍 lakes for kids…    ⚙(5)│
│ [Family 9+][Hard][Rainy]  │
│        map with pins       │
│   ①    ②   ●base          │
│ ┌───────────────────────┐ │
│ │ ─── 23 places         │ │  ← sheet, drag up for list
│ │ Lake Agnes · 12 min   │ │
│ │ 7.4 km · ●●●● · [+]   │ │
│ └───────────────────────┘ │
│              [Map | List] │
└───────────────────────────┘
```

Views: Cards · List (dense rows) · Table (sortable columns: distance, gain, drive, cost, season) · Map only.

## Regions and components
LocationLens ("From": home, trip base, a day's base, current position, a pin) · OmniSearch (typed
query → FilterChips) · PersonaChips · FilterChips · FilterSheet (distance, what, vibe, who, how,
when, cost, trust) · ViewToggle · PlaceCard (with FitAvatars, ReasonLine, TrustBadge, AddButton) ·
MapPanel (clusters, NumberedPin, "Search this area") · SortMenu · ZeroResultRescue.

## Primary action
**+ Add** on a card (default target: the trip's Ideas list; the ▾ offers another list or a day).
Signed out: **+ Add** creates a local draft trip on first use.

## States
- **Loading**: skeleton cards; straight-line distances render first, drive times fill in (a small
  "≈" mark until the real time arrives).
- **Zero results**: never empty. "Nothing matches all 5 filters. Closest misses:" then 3 near misses
  with the failing filter highlighted, and one-tap loosen buttons: "Drop 'ages 9+' (4 more)" ·
  "Widen to 60 min (7 more)".
- **Thin coverage**: banner "We know little about this area yet. Request research" (backlog item).
- **No location**: "Showing the trip's area" inside a trip; signed out "Showing near Toronto · set
  your location".
- **Offline**: search limited to the downloaded trip's area; banner "Searching offline copy".
- **Error**: cached results with "Couldn't refresh".

## Interactions
Hover card ↔ pin highlight; click pin → mini card; map pan shows "Search this area"; drag a card onto
a day in the outline (desktop, inside a trip); keyboard: `/` focuses search, `F` opens filters, `M`
toggles map, arrows move between cards, `A` adds the focused card.

## Copy
Reason lines, always visible: "Matches lake + family · open in September · 12 min from your base ·
7.4 km, within your limit." Misfits are explicit: "Not for Nonna: 400 m of gain."

## Accessibility
Results count is a live region; the map has the list as its equivalent; filter chips are buttons with
"Remove filter: lake".

## Data and operations
`search` (text, kinds, tags, near/along, date range, party fit, limits) returning items with reason
and fit per traveller; `leg_cache` for drive times; `saved_view` for persona chips; `edit_trip`
`add_item` on add.

## Acceptance criteria
1. Typing "waterfall near Elora for kids under 2 hours" produces visible, editable chips and results.
2. Zero results always shows near misses and at least one loosen action.
3. Filter state survives reload and is shareable by URL.
4. Adding from Explore inside a trip shows the item in the trip immediately (optimistic).
