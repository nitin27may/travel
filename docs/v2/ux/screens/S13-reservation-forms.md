# S13. Reservation forms and the paste, forward and upload flows

## Purpose
Record a flight, stay, car, train, ferry, transfer, activity, restaurant, parking or insurance in
under a minute, with only that kind's fields, for every traveller, with times in the right zones.
Or capture it without typing: forward the email, paste the text, upload the PDF, or let a chat
client fill it.

## Entry points
"+ Add ▾" in Bookings; BookingsStrip chip; "I booked it" on a to-book row or a dashed item; ⊞ in an
AddBox (flight, stay); the forward address; MCP `reservations`.

## Wireframes

Add menu:

```
┌ Add a reservation ─────────────────────────┐
│ [✈ Flight] [🛏 Stay] [🚗 Car] [🚆 Train]     │
│ [🚌 Bus] [⛴ Ferry] [🚐 Transfer] [🎟 Activity]│
│ [🍽 Restaurant] [🅿 Parking] [🛡 Insurance] [⋯ Other]│
│ ── or ─────────────────────────────────────│
│ [📋 Paste a confirmation] [📎 Upload PDF/photo]│
│ ✉ Forward to trips+k7q2@in.<domain>  [Copy]│
│ □ Not booked yet (add as "to book")        │
└────────────────────────────────────────────┘
```

Flight form (desktop sheet; phone full screen):

```
┌ Flight · AC 892 / 893 ────────────────────────────────────┐
│ Status  (•) Booked ( ) Held ( ) To book                    │
│ Airline [Air Canada ▾]   Booked via [Direct ▾]             │
│ Confirmation (PNR) [ ABC123 ] 🔒 only trip members         │
│ ── Leg 1 ───────────────────────────────────────────────── │
│ From [YYZ Toronto Pearson ▾] T1   To [VCE Venice ▾]        │
│ Depart [Mon 12 Jul 2027] [18:30] Toronto time              │
│ Arrive [Tue 13 Jul 2027] [09:05] Venice time  → 8 h 35, +1 │
│ Flight no. [AC][892]  Cabin [Economy ▾]                    │
│ [+ Add leg]  (return: AC 893 VCE→YYZ Sat 24 Jul 11:50)     │
│ ── Travellers ──────────────────────────────────────────── │
│ ☑ Nitin  seat [23A] ticket [014…]  bags [1×23 kg]          │
│ ☑ Priya  seat [23B] …                                      │
│ ☑ Aarav  seat [23C] …   ☑ Mira seat [23D] …                │
│ ── Money & rules ───────────────────────────────────────── │
│ Price [4,880] [CAD]  Paid [all ▾]  Refundable [No ▾]       │
│ Manage booking link [ https://… ]                          │
│ Attachments [📎 e-tickets.pdf]                              │
│ Notes [ … ]                    More details ▾              │
│ [Save]                                                     │
└────────────────────────────────────────────────────────────┘
```

Stay form highlights: property (catalog search → address search fallback), check-in date + time
from/until, check-out date + by time, nights computed, room/beds, breakfast, parking, **free
cancellation until** (date + time), balance due, contact, key pickup. Car: company, pickup place +
time, drop-off place + time (one-way warning), class, insurance/excess, drivers (travellers). Train /
bus / ferry: operator, legs with stations and zones, coach/seat per traveller, vehicle (ferry).
Activity: catalog offer search (fills limits and meeting point), slot start/end, tickets per traveller
with eligibility check ("Mira is 10; via ferrata needs 12+"). Restaurant: time, party size, requests.
Parking: lot, entry code, plate. Insurance: provider, policy (secret), phone, period, covered people.

Paste flow:

```
┌ Paste a confirmation ──────────────────────────────┐
│ [ big text area: paste the email or SMS here ]     │
│ [Read it]                                          │
│ We found: Flight · AC 892 · 13 Jul · YYZ→VCE ·     │
│ code ABC123 · 4 names                              │
│ Check: arrival time (not found)  ← highlighted     │
│ [Open the form with these]                         │
└────────────────────────────────────────────────────┘
```

Forward flow: the per-user address; arrivals appear in Bookings with "From email · check 1 field";
an Inbox item says "Hotel Ambra added to Dolomites from your email". Ambiguous trip → "Which trip?"
chooser. Upload flow: the PDF opens on the left, the form on the right (desktop) or above/below
(phone); no OCR in v1.

## Regions and components
KindPicker · FormSection · AirportField / StationField / PlaceField (catalog → address) ·
DateTimeZoneField (shows zone, computes duration and +1) · SegmentList (add/remove legs) ·
TravellerRows · SecretField (lock icon, member-only) · MoneyFields · CancelUntilField ·
AttachmentField · PasteParser result · TripChooser.

## Primary action
"Save" (sticky at the bottom on phone).

## States
- **To book** chosen: only kind, title, rough day(s) and "book by" (pre-filled from the offer window or
  kind default) are shown; Save creates the Book task.
- **Validation**: arrival before departure → "Arrival is before departure. Is it the next day?" with
  "+1 day" fix; check-out not after check-in → error; car drop-off before pickup → error.
- **Overlap**: a stay overlapping another stay for the same nights → warning, allowed (split party).
- **Plan impact preview**: on save, a summary "This sets day 1 to start after 10:35 (arrival + 90 min)
  and nights 2–4 to Hotel Ambra" with Undo.
- **Offline**: forms work; saved locally; email/paste parsing that needs the server queues.
- **Unknown airport/station**: free text allowed with a zone picker.

## Interactions
Tab order follows the visual order; Enter in the last field of a leg adds a leg; the zone is inferred
from the airport/station/place and editable.

## Copy
"Toronto time" / "Venice time" beside time fields; "+1" for next-day arrival; "only trip members can
see this" under secret fields.

## Accessibility
Each segment is a fieldset ("Leg 1, Toronto to Venice"); errors are linked to fields; the PDF viewer
has a "Skip to form" link.

## Data and operations
`reservations.add/update` (reservation, segments, travellers, secret, attachments); OurAirports for
codes, points and zones; catalog `search` for stays and offers; email inbound parser
(schema.org markup first); tasks generated per 09-reservations.md 5.

## Acceptance criteria
1. A round-trip family flight with 4 travellers and seats can be entered in under 2 minutes.
2. Every traveller on the booking is stored (no "only one name").
3. Times round-trip across zones correctly (dep 18:30 Toronto, arr 09:05 Venice = 8 h 35).
4. A forwarded email with reservation markup creates a reservation without opening the form.

## Share
Not on the form; after save, the detail sheet has "Share details" (S26).
