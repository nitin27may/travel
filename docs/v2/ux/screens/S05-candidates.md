# S05. Comparing candidate destinations

## Purpose
Before choosing where, compare a few places side by side: travel time from home, best time, length,
rough cost, pros, cons, votes. This is the "Fall colours trip ideas" and "India trip options" tables
from `Plan.md`, made live (each row knows how many things fit the party).

## Entry points
S04 "Not sure yet"; trip Overview in the idea phase; year view "Ideas" row; MCP `edit_trip` adding candidates.

## Wireframes

Desktop (table with a map of the candidates on the right):

```
┌ Fall colours 2027 · choose where ──────────────────────────────────┬ map ─────────────┐
│ [ + Add a candidate ]                         Sort: votes ▾          │  ● Stowe          │
│ ┌────────────────┬────────┬─────────┬──────┬───────┬──────┬────────┐ │  ● White Mtns     │
│ │ Place          │ Drive  │ Best    │ Days │ Cost  │ Fit  │ Votes  │ │  ● Finger Lakes   │
│ ├────────────────┼────────┼─────────┼──────┼───────┼──────┼────────┤ │  ● Shenandoah     │
│ │ Stowe, VT      │ 5 h 40 │ early Oct│ 3–4 │ $1.4k │ 46 ●●●│ ●● +1 │ │                   │
│ │ White Mtns, NH │ 6 h 10 │ early Oct│ 3–4 │ $1.3k │ 38 ●●●│ ●     │ │                   │
│ │ Finger Lakes   │ 4 h 05 │ mid Oct  │ 3   │ $1.1k │ 29 ●●○│       │ │                   │
│ │ Shenandoah     │ 8 h 50 │ mid Oct  │ 2–3 │ $1.2k │ 22 ●●○│       │ │                   │
│ └────────────────┴────────┴─────────┴──────┴───────┴──────┴────────┘ │                   │
│ ▸ Stowe — pros: covered bridges, gondola; cons: leaf-peeper traffic  │                   │
│ [ Choose Stowe ]                                                      │                   │
└──────────────────────────────────────────────────────────────────────┴───────────────────┘
```

Phone: cards stacked, swipe horizontally to compare; a "Compare" toggle shows two cards side by side.

```
┌───────────────────────────┐
│ Choose where (4)    Sort ▾│
│ ┌───────────────────────┐ │
│ │ Stowe, VT    ●● votes │ │
│ │ 5 h 40 drive · 3–4 d  │ │
│ │ early Oct · ~$1.4k    │ │
│ │ 46 things fit ●●●     │ │
│ │ + bridges, gondola    │ │
│ │ − traffic             │ │
│ │ [Vote] [Choose]       │ │
│ └───────────────────────┘ │
└───────────────────────────┘
```

## Regions and components
CandidateTable / CandidateCard · VoteChips (member avatars) · FitCount · ProsCons (inline editable) ·
MapPanel with labelled pins · AddBox ("Add a candidate: place name or 'India — family visit'").

## Primary action
"Choose <place>" (sets the trip's area, keeps others folded under "Other options").

## States
- **Empty**: "Add 2–4 places you're considering. We'll show drive time and what fits your group."
- **Free-text candidate** (no catalog area, e.g. "India — family"): fit shows "—", drive shows "flight".
- **Thin coverage**: fit cell shows "thin" with a tooltip.
- **Offline**: read and edit text; drive and fit show cached values with their age.
- **Conflict**: two people edit the same pros cell → ConflictBanner on the cell.

## Interactions
Click a cell to edit (text cells); drag rows to reorder (keyboard: Alt+↑/↓); tap a vote chip to vote/unvote.

## Copy
"Choose Stowe — the others stay here as notes."

## Accessibility
Real table with header cells; vote buttons say "Vote for Stowe (2 votes, you haven't voted)".

## Data and operations
`trip_candidate` rows; drive time from `leg_cache` (origin = household home); fit count = `search`
with party filters inside the candidate's area; `edit_trip` ops `add_candidate`, `vote`, `choose_candidate`.

## Acceptance criteria
1. Adding a catalog area fills drive time and fit within 2 s online.
2. Choosing a candidate sets the area, keeps the rest, and moves the trip from idea to plan phase.
