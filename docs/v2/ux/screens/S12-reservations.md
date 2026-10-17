# S12. Reservations list and booking timeline

## Purpose
Everything booked and still to book, in one list: what, when (both zones), where, status, the next
deadline, and quick actions. We never book; this records what people booked elsewhere
([../../09-reservations.md](../../09-reservations.md)). In the Book phase it reads as a timeline of
what opens when.

## Entry points
Trip tab **Bookings**; the BookingsStrip chips in the plan; NextActionBanner; Inbox reminders.

## Wireframes

Desktop (group switcher: By day · By kind · By status · Timeline):

```
┌ Bookings · Dolomites ───────────── [+ Add ▾] [✉ Forward an email] Group: [By day ▾] ┐
│ TO BOOK (3)                                                                          │
│ ○ 🎟 Seceda lift · Day 3 · on sale Mon 26 Oct 09:00 Rome (03:00 you) · fast   [Book ▸]│
│ ○ 🛏 Rifugio Lagazuoi · night 8 · opens 1 Nov · fills in days       [Remind me ✓]   │
│ ○ 🚗 Car Venice→Venice · Day 2–13 · no window · book by 1 Mar (default)              │
│ BY DAY                                                                               │
│ Tue 13 Jul                                                                           │
│ ✓ ✈ AC 892 YYZ 18:30 → VCE 09:05 (+1) · 4 travellers · seats 23A–D  [code ••• 👁]     │
│ Wed 14 Jul                                                                           │
│ ✓ 🛏 Hotel Ambra, Ortisei · in 15:00 · out Sat 17 10:00 · 3 nights · free cancel to  │
│     31 Dec ⚑                                                                         │
│ …                                                                                    │
│ CANCELLED (1) ›                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Timeline (book phase):

```
 NOW   ● Seceda lift — on sale Mon 26 Oct 09:00 Rome (03:00 Whitby) · sells out in hours
 NOV   ○ Rifugio Lagazuoi — opens 1 Nov · fills in days
 MAR   ○ Car — book by 1 Mar (suggested)
 DEC   ⚑ Hotel Ambra — last day to cancel free: 31 Dec
 BOOKED ✓ AC 892/893 · ✓ Hotel Ambra · ✓ Corvara B&B
```

Phone: one list grouped by day with sticky day headers; each row a ReservationCard; swipe right =
"Mark booked" (to-book rows), swipe left = ⋯; the + floating button opens the add menu.

```
┌───────────────────────────┐
│ Bookings      [+] [✉]     │
│ To book (3)               │
│ ○ Seceda lift · Day 3     │
│   on sale in 9 d · 03:00  │
│ Tue 13 Jul                │
│ ✓ AC 892 YYZ→VCE          │
│   18:30 → 09:05 (+1)      │
│   [code] [ticket] [⋯]     │
│ Wed 14 Jul                │
│ ✓ Hotel Ambra · in 15:00  │
└───────────────────────────┘
```

## Regions and components
GroupSwitcher · ReservationCard (kind icon, title, segments summary with TimeWithZone, travellers,
status chip, next deadline ReminderChip, secret reveal, attachment count) · TimelineRow · AddMenu
(per kind, Paste, Forward, Upload) · EmptyState.

## Primary action
"+ Add ▾" (kinds) ; on a to-book row, "I booked it" (opens S13 pre-filled).

## States
- **Empty**: "Add what you've booked, or what you still need to book. Forward a confirmation to
  trips+k7q2@in.<domain> and it lands here." with the address copy button.
- **Codes hidden** by default; reveal requires trip member role (viewers never see them).
- **Imported from email, unsure fields**: amber "Check 2 fields" chip.
- **Conflicting times with plan**: "This flight lands after your 10:00 item on day 1" with fix.
- **Offline**: full list cached incl. attachments if the trip is downloaded.
- **Cancelled**: folded section, struck through, with refund note.

## Interactions
Click a row → DetailSheet (S13 detail mode); keyboard `B` mark booked; copy code button; drag not
supported (order comes from time).

## Copy
"on sale Mon 26 Oct 09:00 Rome (03:00 your time)"; "free cancellation until Thu 31 Dec 18:00".

## Accessibility
Status uses icon + text; hidden codes have "Reveal code" buttons announced as such.

## Data and operations
`reservations.list` (with segments, travellers, secrets per role), tasks linked; `reservations.update`
status; offer windows for to-book rows.

## Acceptance criteria
1. A to-book reservation with an offer window shows the opening time in both zones.
2. Marking booked closes its Book task and creates follow-up tasks (09-reservations.md 5).
3. Viewers never receive secret fields from the API.

## Share
Row ⋯ "Share details" (title, time with zone, address, map; codes never; manage link only if toggled) via S26; "Share all bookings as PDF" export.
