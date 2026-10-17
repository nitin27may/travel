# S17. People (trip) and household

## Purpose
Who is going, their ages on the trip's dates, what each can do (eligibility and walking limits), who
can edit; and the household's standing people, passes and preferences that pre-fill every trip.

## Entry points
Trip More → People (phone) or tab (desktop); dashboard "Who can do what"; Settings → Household; S04 step 3.

## Wireframes

Trip people (desktop):

```
┌ People · Dolomites ────────────────────────────────────────────────── [Invite] ┐
│ TRAVELLERS                                                                     │
│ ●Nitin  42 · fitness 4 · limit 15 km/1,000 m · editor (owner)                  │
│ ●Priya  40 · fitness 3 · limit 12 km/800 m · editor                            │
│ ●Kai  10 on 13 Jul · 152 cm · fitness 3 · limit 10 km/600 m                  │
│ ●Mira   10 on 13 Jul · 138 cm · fitness 2 · limit 8 km/400 m                   │
│ [+ Guest]                                                                      │
│ WHO CAN DO WHAT                                                                │
│ ┌───────────────────────────┬──────┬──────┬──────┬──────┐                      │
│ │ Item                      │Nitin │Priya │Kai │ Mira │                      │
│ │ Via ferrata Brigata Tridentina│ ✓ │  ✓  │  ✓   │ ✗ 12+│                      │
│ │ Seceda ridge 9 km ↑350    │  ✓   │  ✓   │  ✓   │  ✓   │                      │
│ │ Tre Cime loop 10 km ↑500  │  ✓   │  ✓   │  ✓   │ ⚠ gain│                      │
│ └───────────────────────────┴──────┴──────┴──────┴──────┘                      │
│ MEMBERS (can open the trip)  Nitin owner · Priya editor · Nonna viewer (link)  │
└────────────────────────────────────────────────────────────────────────────────┘
```

Household (Settings → Household):

```
│ Home base   Whitby, ON · day-trip radius 2 h · car                       │
│ People      Nitin · Priya · Kai (2017) · Mira (2019)  [+ Person]        │
│             passport expiry per person (date only) · heights optional     │
│ Passes      Ontario Parks vehicle pass · expires 31 Mar 2027              │
│ Defaults    mid-range · balanced · waterfalls, lookouts, caves, swimming  │
│ Avoid       unfenced cliff edges with young kids · long drives without a  │
│             break every 2 h                                               │
│ School breaks  March break 13–21 Mar 2027 · summer 26 Jun – 7 Sep [+]     │
```

Phone: the matrix becomes per-item cards ("Via ferrata: Mira can't (12+)").

## Regions and components
TravellerRow (FitAvatars colour, age-at-travel, limits) · EligibilityMatrix · MemberRow (role
selector) · InviteSheet (email, role, or a viewer link) · HouseholdForm sections · PassList.

## Primary action
"Invite" (trip); "Save" (household, autosave with toast).

## States
- **Missing data for a rule**: "Height needed for this activity (min 130 cm). Add Mira's height?" —
  heights are optional and only asked when a rule needs them.
- **Guest without age**: fit shows "?" with "Add age band".
- **Viewer link**: shows first names only; no ages, no heights, no codes.
- **Pending invite**: "Invited · resend · revoke".

## Interactions
Tap a cell in the matrix → the rule and source ("Via ferrata Brigata Tridentina: minimum 12 years, operator site, read Mar 2026").

## Copy
"Kai is 10 on 13 Jul 2027"; "✗ needs 12+"; "⚠ 500 m gain, over Mira's 400 m limit".

## Accessibility
Matrix is a table with row and column headers; ✓/✗/⚠ have text equivalents.

## Data and operations
`household`, `person`, `membership`, `traveller`, `trip_member`, eligibility from entity/offer
`eligibility` and traveller limits; ops `add_traveller`, `invite_member`, `set_role`.

## Acceptance criteria
1. Ages are computed at the trip's start date (and per item date for long trips).
2. No personal data (age, height, passport date) appears in viewer, link or public views.

## Share
"Invite" is the members path of S26; the eligibility matrix is never shared by link (ages).
