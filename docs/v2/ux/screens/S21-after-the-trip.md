# S21. After the trip

## Purpose
Close the loop: what really happened (pre-filled from Today mode), notes and photos kept, corrections
offered to the catalog as changesets, and optionally publish as a template others can fork.

## Entry points
Overview in the after phase (the day after the last day); Inbox "How did the Dolomites go?".

## Wireframes

```
┌ How did it go? · Dolomites ───────────────────────────────────────────────┐
│ 41 of 48 items done · 5 skipped · 2 Plan B                                │
│ Day 3 · ✓ Seceda ridge · ✓ Rif. Firenze · ✗ Ortisei walk (rain)            │
│   note: "Lift queue 40 min at 08:30; go at opening" [→ suggest to catalog]│
│ CORRECTIONS (3) — help the next family                                    │
│  ☐ Seceda lift opened 08:00, not 08:30 (your note, Day 3)                 │
│  ☐ Lago di Braies parking now €38 (your expense, Day 2)                   │
│  ☐ Rifugio Lagazuoi: closed Mon (you skipped it)                           │
│  [Send selected for review]                                               │
│ PUBLISH AS TEMPLATE                                                       │
│  Preview what others see → [Preview]  (no people, ages, codes, tickets,   │
│  receipts or private notes)                                               │
│  Item priorities: set must / should / nice to help others shorten it      │
│  [Publish template]                                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

Phone: the same sections stacked; day review as a swipe-through of days.

## Regions and components
OutcomeSummary · DayReview (ItemRow with done/skipped, notes, photos) · CorrectionList (each a
proposed changeset with its evidence: the user's note or expense) · PublishPanel (privacy preview,
priority editor, validity: months it works, min/max nights, party notes).

## Primary action
"Send selected for review"; then "Publish template".

## States
Nothing to correct → section hidden. Template already published → "Update template" with a diff.
Offline → read only; sending queues.

## Interactions
Priority editor: each item gets Must · Should · Nice (bulk by day).

## Copy
"Help the next family" (corrections); "Others will see the plan, not your family."

## Accessibility
Preview opens in a new view with a heading "What others will see".

## Data and operations
`day_state`, items status, notes, media, expenses; `propose` changesets with source = user visit;
`publish_template` (strips personal data, copies item priorities and validity).

## Acceptance criteria
1. Published template contains no traveller, member, reservation secret, attachment or private note.
2. Corrections become changesets visible in admin review with the user's note as evidence.

## Share
"Share our trip" (read-only recap link with photos the user chose, via S26 scope "whole trip",
include toggles default off for times and costs) and "Share template" once published.
