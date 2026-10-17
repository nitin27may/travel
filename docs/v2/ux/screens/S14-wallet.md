# S14. Wallet

## Purpose
At the check-in desk, the gate, the rental counter or the gondola: today's codes, tickets and QR
codes, big and readable, offline, one tap away.

## Entry points
Today mode "Tickets" button; Bookings → row → "Show at desk"; a reminder ("Check in at Hotel Ambra
from 15:00") → wallet card.

## Wireframes

Phone (primary device):

```
┌───────────────────────────┐
│ ‹ Today's tickets   2 of 3│
│ ┌───────────────────────┐ │
│ │ 🛏 Hotel Ambra        │ │
│ │ Check-in from 15:00   │ │
│ │                       │ │
│ │   ABC-48213           │ │  ← code, 32 px, monospace
│ │   [Copy] [Read aloud] │ │
│ │ Name: Nitin Singh     │ │
│ │ Str. Rezia 12 Ortisei │ │
│ │ [Navigate] [Call]     │ │
│ │ [📎 Voucher.pdf]      │ │
│ └───────────────────────┘ │
│   ● ● ○   swipe for next  │
│ All tickets for the trip ›│
└───────────────────────────┘
```

QR/barcode attachments render full-width with screen brightness boosted (where the platform allows)
and a "Keep screen on" toggle.

Desktop: a printable "Trip documents" page: every reservation with codes, addresses, phone numbers,
and attachments listed, one per block, page breaks between days.

## Regions and components
WalletCard (kind, title, time with zone, code display, names, address, actions, attachments) · Pager
dots · AttachmentViewer (PDF/image, offline) · PrintLayout.

## Primary action
Show the code (the card itself); "Navigate" second.

## States
- **Nothing today**: "No tickets today. Tomorrow: AC 893 at 11:50." 
- **Not downloaded**: "Download this trip to see tickets offline" (button) — online it still works.
- **Attachment missing**: "No ticket file. Code only." and a task suggestion if the operator needs a
  printed ticket.
- **Viewer role**: wallet unavailable (codes are member-only).

## Interactions
Swipe between cards; tap code = copy; "Read aloud" uses speech synthesis with NATO spelling option.

## Copy
Codes shown exactly, grouped for reading ("ABC-48213"), never truncated.

## Accessibility
Codes have `aria-label` spelled out character by character; high contrast by default.

## Data and operations
Reservations with segments touching today (local date at the segment's zone), secrets for members,
cached attachments (IndexedDB + Cache Storage).

## Acceptance criteria
1. In airplane mode, a downloaded trip shows today's codes and attachments within 1 s.
2. A card for a check-in shows the check-in window and the address with navigation.
