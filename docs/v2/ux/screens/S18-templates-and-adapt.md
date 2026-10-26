# S18. Templates: gallery, preview, fork and adapt

## Purpose
Reuse a planned trip, the owner's curated ones or any public template, as it is or adapted to a
different length, month and party. The adapt step is where the product earns its keep: it re-times
days for daylight, swaps season-closed items for their alternatives, re-checks eligibility for the
new party, recomputes booking windows, and shows every change before anything is created.

## Entry points
Rail **Templates** (phone You → Templates); S02 empty state; S04 "Start from a template"; a public
template page; "Make template" on own trip (⋯); MCP `fork_template`.

## Wireframes

Gallery (desktop):

```
┌ Templates ───────────── [🔍 Rockies]  Length [any ▾] Month [Sep ▾] Party [kids 6+ ▾] Type [Family ▾] ┐
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                                │
│ │[hero]            │ │[hero]            │ │[hero]            │                                │
│ │Canadian Rockies  │ │Iceland Ring Road │ │Utah five parks   │                                │
│ │14 nights · Sep   │ │11 nights · camper│ │10 nights · paved │                                │
│ │family, child ~6  │ │adults · Sep      │ │family            │                                │
│ │3 tracks per day  │ │aurora window     │ │before 1 Oct      │                                │
│ │✓ curated · 2029  │ │✓ curated         │ │✓ curated         │                                │
│ │fits Sep · 8–22   │ │fits Sep 4–22 only│ │fits Apr–Sep      │                                │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Template preview: the plan document read-only (no people, codes or attachments), with "Use this
template" as the primary button and a "Best for" box (months it works, party it suits, min/max nights).

Adapt flow (sheet, 3 short steps then a change summary):

```
┌ Use "Canadian Rockies, 14 nights" ─────────────────────────────┐
│ 1 When   [Sat 12 Sep 2026] → 10 nights (template: 14)           │
│ 2 Who    ●Nitin ●Priya ●Kai 9 ●Mira 7  (template: 2 adults + child 6)│
│ 3 Keep   (•) adapt for me  ( ) copy exactly                     │
│ [See changes]                                                   │
├─────────────────────────────────────────────────────────────────┤
│ What will change (17)                                [Accept all]│
│ Length 14 → 10 nights                                           │
│  − Drops Kananaskis base (3 nights) and day 9 Jasper spare day  │
│    (lowest priority: "nice")                                    │
│  ↔ Merges days 5–6 Lake Louise into one, keeps Moraine sunrise  │
│ Month (same) · daylight: sunsets 12 min earlier on day 8 → hike │
│    start 08:00 → 07:45                                          │
│ Season: Larch Valley stays (peak ~20 Sep)                       │
│ Party: Track A via ferrata: Kai 9 < 12 → moved to adults only│
│ Bookings: Moraine shuttle opens ~48 h before → reminder set     │
│ Each change: [✓ keep] [✕ skip] [view day]                       │
│ [Create my trip]                                                │
└─────────────────────────────────────────────────────────────────┘
```

Phone: the same three steps as full screens; the change list grouped by kind (Length · Daylight ·
Season · Party · Bookings) with toggles.

## Regions and components
TemplateCard (hero, title, length, type, party, "fits" line from validity months, curated badge) ·
FilterChips · TemplatePreview (S09 read-only) · AdaptSteps · ChangeList (ChangeRow with kind icon,
reason, keep/skip, link to the day) · DiffView (day before/after).

## Primary action
"Use this template" → "Create my trip".

## States
- **Out of season**: "This template is for September. In July: 3 items close or change (Larch Valley
  has no colour). Adapt anyway?" — still allowed.
- **Shorter than minimum**: "Templates below 8 nights drop whole regions. Suggested: 10."
- **Template updated after fork**: on the forked trip, a banner "The template changed: 3 updates
  (new trail closure, new shuttle window). Review" → ChangeList again; never auto-applied.
- **Copy exactly**: no adaptation, only dates shifted; warnings appear afterwards as day checks.
- **Offline**: gallery from cache; creating needs connection (server adapts).

## Interactions
Each change toggles; "view day" opens a DiffView for that day; back steps keep choices.

## Copy
Changes always say why: "dropped because it's marked 'nice' and the trip is 4 nights shorter".

## Accessibility
ChangeList is a list of checkboxes with full sentences.

## Data and operations
Template = trip with `is_template`, item priorities (must/should/nice), validity (months, min/max
nights, party notes); `adapt_trip` preview (server) returning change set; `fork_template` creates the
trip with chosen changes as one operation with an undo; template version tracking for update notices.

## Acceptance criteria
1. Shortening a 14-night template to 10 drops only "nice"/"should" items and says which and why.
2. Party changes re-check every item's eligibility and move ineligible items to the right track.
3. No personal data from the source trip appears in the template or the fork.

## Share
"Share template" (public link, ⋯ on a card) via the Share sheet (S26); scope "template".
