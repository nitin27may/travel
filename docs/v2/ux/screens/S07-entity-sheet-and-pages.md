# S07. Entity sheet and full pages (trail, activity, stay, place)

## Purpose
Everything needed to decide and to go, with sources: for a trail every link (official page, map
track, trip reports as links), the trailhead and its parking, the elevation profile, the season, who
in the party it suits; for an activity its limits and booking window; for a stay its check-in rules.
The sheet opens over whatever you were doing; the full page is shareable and indexable.

## Entry points
Tap a card, pin or item anywhere; `/p/<slug>` (full page, SSR, JSON-LD); command palette.

## Wireframes

Desktop sheet (right panel over the map, 440 px), trail example:

```
┌──────────────────────────────────────────────┐
│ ✕   Lake Agnes Tea House trail       [In: Ideas ▾]│
│ [photo strip ▸]                               │
│ Hike · Lake Louise, Banff NP · ✓ stated       │
│ 7.4 km out-and-back · ↑ 400 m · 2–3 h · Mod.  │
│ Fits: ●Nitin ●Priya ●Kai(10) ●Mira(9)       │
│ Why: lake + tea house + family · open Jun–Oct │
│ [About] [Facts] [Getting there] [Photos] [Links]│
│ ── Getting there ─────────────────────────────│
│ Trailhead: Lake Louise lakeshore (51.4166,     │
│   -116.2167) · [Navigate] [Copy]              │
│ Parking: Lake Louise lot · paid · fills ~07:30 │
│   in summer · Parks Canada shuttle alternative │
│   from Park & Ride · toilets at lot            │
│ ── Elevation ─────────────────────────────────│
│   ▁▂▃▄▅▆▇  1,730 → 2,130 m   [profile]         │
│ ── Season & conditions ───────────────────────│
│ Usually snow-free mid-Jun to Oct · tea house   │
│   closes early Oct · bear warnings common      │
│ ── Book ─────────────────────────────────────│
│ Nothing to book for the trail; shuttle seats   │
│   release ~48 h before (sells out in minutes)  │
│ [ + Add to day ▾ ]                             │
└──────────────────────────────────────────────┘
```

Facts tab shows every key fact with its SourceLine: "7.4 km · Parks Canada · read Mar 2026" and
conflicts: "A 2025 trip report says 7.8 km". Links tab:

```
│ Official:  Parks Canada — Lake Agnes trail page ↗ │
│ Map/track: OpenStreetMap relation ↗ · GPX (ODbL) ⤓│
│ Reports:   AllTrails ↗ (link only) · blog ↗        │
│ Status:    Parks Canada trail conditions ↗         │
│ Webcam:    Lake Louise cam ↗                       │
```

Phone: the sheet is a bottom sheet (half → full); tabs become a horizontal scroller; "Navigate" and
"+ Add" are a sticky bottom row.

```
┌───────────────────────────┐
│ ── Lake Agnes Tea House   │
│ 7.4 km · ↑400 m · 2–3 h   │
│ ●●●● fits all             │
│ About Facts Getting there │
│ Trailhead · Parking fills │
│ ~07:30 · shuttle option   │
│ [Navigate]  [+ Add ▾]     │
└───────────────────────────┘
```

Variants by kind:

| Kind | Header facts | Special sections |
|---|---|---|
| Trail | distance, gain, loss, time, type (loop, out-and-back, point-to-point), local grade + house 1–5 | Getting there (TrailheadCard, ParkingCard, shuttle), ElevationProfile, Season, Hazards, Dogs, Links, the GPX download |
| Activity (via ferrata, rafting, zipline, tour) | duration, price, min age / height / weight, fitness | Limits per traveller (who can't, why), Booking window, Operator, Meeting point, What to bring |
| Stay | type, price band, check-in from/until, check-out by | Rooms and beds, parking, breakfast, walk/drive to key places, cancellation norms |
| Place (viewpoint, waterfall, town, museum) | time needed, cost, hours | Best light (sun times), Crowds, Nearby and rainy-day alternatives |
| Eatery | cuisine, price band, hours | Reservations, kid-friendly, dietary |

## Regions and components
DetailSheet · PhotoStrip · KindHeader · FitAvatars · ReasonLine · TrustBadge · Tabs · FactRow with
SourceLine · ConflictNote · TrailheadCard · ParkingCard · ElevationProfile · SeasonBar · LinkList ·
BookingWindowCard · AddButton (list/day picker) · "Suggest a correction".

## Primary action
"+ Add to day ▾" (or "In: Ideas ▾" when already added); "Navigate" on the trailhead in Today mode.

## States
- **Already in trip**: header chip "Day 3 · 09:00" with jump link.
- **Unverified facts**: TrustBadge "unverified" with "Help verify".
- **Missing parking info**: "No parking info yet. Know it? Suggest it." (creates a changeset).
- **Offline**: full content of downloaded entities; others "Needs connection".
- **Retired entity**: "This place is closed (since May 2026, source)" + alternatives.
- **Custom item** (not catalog): shows the user's fields + "Offer to the catalog".

## Interactions
Esc / swipe down closes; ←/→ moves to previous/next result when opened from a list; long-press a fact
→ copy or "Suggest a correction".

## Copy
Facts carry the source and the month read. Never "From the web" without a source.

## Accessibility
Tabs follow the tabs pattern; the elevation profile has a text summary ("climbs 400 m in the first
3.2 km, steepest 18 %"); external links say they open a new site.

## Data and operations
`get` (entity + evidence summary + relations: trailhead_of, near, alternative_to, covered_by),
`media`, `offer` windows, eligibility vs trip travellers, sun times for "best light"; `propose`
(correction changeset).

## Acceptance criteria
1. A trail sheet shows trailhead coordinates, parking (or "no info yet"), and at least the official
   link when the catalog has one.
2. Every numeric fact shows its source and read date on the Facts tab.
3. Fit avatars match the eligibility rules for the trip's travellers on the trip's dates.
4. The full page renders without JavaScript and includes JSON-LD (TouristAttraction / Place).

## Share
"Share" in the sheet header: the public entity page link plus, inside a trip, "with my note and day" (S26, scope item).
