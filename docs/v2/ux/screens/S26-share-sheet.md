# S26. Share sheet

## Purpose
One sheet for sharing anything, everywhere: pick what (scope), with whom (audience), what they will
see (include toggles with a live preview), for how long (expiry, optional PIN), and how (copy link,
QR, native share, export). Lists active links with views and revoke. Product rules live in
[../../10-sharing.md](../../10-sharing.md); this page is the screen.

## Entry points (every one opens this sheet with the scope pre-set)

| Screen | Share entry | Default scope |
|---|---|---|
| S08 dashboard | header "Share" | whole trip |
| S09/S11 plan | day ⋯ "Share this day", list ⋯ "Share this list", item ⋯ "Share place", range select "Share days 3–5" | day / list / item / day range |
| S07 entity sheet | "Share" in header | item / place |
| S06 explore | "Share this search" | explore search (URL state) |
| S12/S14 reservation card, wallet | "Share details" | reservation card (no code by default) / ticket |
| S15 tasks | "Assign" → member picker; "Share list" for a pack list | task list |
| S16 budget | "Share summary" | budget summary |
| S18 templates | "Share template" | template |
| S19 today | "Share my day", "Send ETA" | one day / text |
| S21 after | "Share our trip" (recap) | whole trip |
| Area guide | "Share guide" | area guide |
| Route (a day's legs) | "Share route" | route (Google Maps link / GPX) |

## Wireframes

Desktop (centred sheet 560 px) / phone (full-height bottom sheet):

```
┌ Share ─────────────────────────────────────────────────────┐
│ What   [Whole trip ▾]  (Whole trip · Days… · Day 3 · List  │
│         "Lakes" · Lake Agnes · Reservation · Budget …)      │
│ With   (•) People in the trip   ( ) Anyone with a link     │
│        ( ) Public (template)    ( ) Export a file          │
│                                                            │
│ ── People in the trip ──                                   │
│ ●Priya editor ●Nonna viewer   [Invite by email]            │
│                                                            │
│ ── Link settings (when "Anyone with a link") ──           │
│ They will see:                                             │
│  [✓] Plan and places   [✓] Times    [ ] Costs              │
│  [ ] Travellers' first names        [ ] Notes              │
│  [ ] Reservations (no codes)        [✗] Codes, tickets,    │
│      ages, passports — never shared by link                │
│ Expires  [7 days ▾]  PIN [ ] 4 digits   Allow "copy to my   │
│ trips" [✓]                                                 │
│ ┌ Preview: what they'll see ───────────────────────────┐   │
│ │ Dolomites · 13–26 Jul · 13 days                      │   │
│ │ Day 3 · Seceda ridge 08:30 · Rif. Firenze 13:00 …    │   │
│ └──────────────────────────────────────────────────────┘   │
│ [Copy link] [QR] [Share…]                                  │
│                                                            │
│ ── Exports ── [PDF] [Calendar (.ics)] [GPX] [Google Maps]  │
│              [Image card]                                  │
│ ── Active links (3) ──                                     │
│ Whole trip · 7 d left · 12 views · last 2 h ago  [Revoke]  │
│ Day 3 · expires tonight · 1 view                 [Revoke]  │
└────────────────────────────────────────────────────────────┘
```

## Regions and components
ShareSheet · ScopePicker · AudiencePicker · IncludeToggles (with locked never-shared row) ·
SharePreview (renders the GuestView component with the chosen toggles) · ExpiryPicker · PinField ·
ShareActions (Copy, QR, native Web Share API) · ExportButtons · LinkRow list.

## Primary action
"Copy link" (desktop) / "Share…" (phone native sheet).

## States
- **Viewer role**: can share only public objects (templates, catalog places, searches); trip links
  need editor or owner.
- **Reservation scope**: codes never in links; "Share details" sends title, time, address and the
  manage link only if toggled.
- **Offline**: copy of an existing link works; creating a new link queues ("Will create when online").
- **Revoked link**: row moves to "Revoked" with date; recipients see "This link was turned off".
- **Expired**: recipients see "This link expired. Ask Nitin for a new one."

## Interactions
Toggling includes updates the preview immediately; QR opens full-screen; Esc closes.

## Copy
"They will see…" (never "permissions"); the never-shared row states it plainly.

## Accessibility
Preview is a labelled region; toggles are checkboxes; the QR has the URL as text below it.

## Data and operations
`share_link` (scope, target id, include flags, expiry, PIN hash, allow_copy, views, revoked_at), ops
`create_share_link`, `revoke_share_link`, `invite_member`, export endpoints (PDF, ICS, GPX, Maps URL,
image card).

## Acceptance criteria
1. Every screen in the entry table opens the sheet with the right scope.
2. The preview matches exactly what a recipient's request returns.
3. Codes, ages, heights, passports and attachments never appear in a link view regardless of toggles.
4. Revoking blocks the next request.
