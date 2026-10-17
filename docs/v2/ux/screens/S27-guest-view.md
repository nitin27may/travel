# S27. Guest view (what a link recipient sees)

## Purpose
A grandparent, a friend or the dog-sitter opens a shared link on their phone, signed out, and sees a
clean, read-only version of exactly what was shared, with maps and times, nothing private, and,
when allowed, "Copy to my trips".

## Entry points
A share link (`/s/<token>`), QR code, an image card's link; PIN prompt if set.

## Wireframes

Phone:

```
┌───────────────────────────┐
│ Shared by Nitin · read-only│  ← GuestBanner
│ Dolomites                 │
│ Tue 13 – Mon 26 Jul 2027  │
│ [Days ▾] [Map]            │
│ Day 3 · Thu 15 Jul        │
│ Ortisei                   │
│ 08:30 Seceda ridge        │
│ 13:00 Rifugio Firenze     │
│ 16:30 Ortisei town        │
│ ── map ────────────────── │
│ Expires in 6 days         │
│ [Copy to my trips]        │  ← only if allowed
│ Plan your own trip →      │
└───────────────────────────┘
```

Desktop: the plan document layout read-only (outline · document · map), no AddBoxes, no drag, the
GuestBanner across the top.

Scopes render as: whole trip → document; day range / one day → those days only; list → the list
with map; item → the entity page with the sharer's note; reservation card → title, time with zone,
address, map, (manage link if included); budget summary → category totals only; route → the legs on
a map with "Open in Google Maps"; search → Explore with the filters locked to the shared state.

PIN prompt:

```
│ Enter the 4-digit PIN Nitin gave you │
│ [ _ _ _ _ ]                          │
```

## Regions and components
GuestBanner · GuestView (read-only variants of S09/S07/S06 renderers) · PinPrompt · CopyToMyTrips
(signs in or creates account, then forks the shared scope as a new trip; codes and people never copied).

## Primary action
None required (reading); "Copy to my trips" when allowed.

## States
Expired, revoked, wrong PIN (3 tries then a 15-minute wait), not found, partially hidden fields
("times hidden by the sharer"), offline (the browser cache only; guest views are not offline-packaged).

## Interactions
Days pager on phone; map toggle; tap a place → read-only entity sheet.

## Copy
"Shared by Nitin · read-only · expires in 6 days". Never shows the sharer's email.

## Accessibility
Same rules as the source screens; banner is a landmark.

## Data and operations
`GET /s/<token>` returns the scope rendered through a dedicated read function that applies include
flags and strips private fields (01-domain-model.md privacy rules); view counter increments.

## Acceptance criteria
1. Renders server-side, fast on 3G (< 2 s to first content), no sign-in.
2. Never returns codes, ages, heights, passport dates, attachments or private notes.
3. "Copy to my trips" creates a trip for the recipient without any of the sharer's people or reservations.
