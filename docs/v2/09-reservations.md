# 09. Reservations: everything booked (or still to book) in one place

**Scope, decided 17 Oct 2026:** we never sell or book anything. People book wherever they like and
record the details here, so that every flight, stay, car, ticket and table is **in one place, works
offline, drives the routing, and reminds them** of what is still to do. Anything not yet booked is a
reservation in status *to book* with a task and a reminder.

## 1. Why this is more than a notes field

What Wanderlog users report (07-competitors.md): check-in and check-out times are not shown, so people
paste them into notes; a four-passenger flight imported only one name; attachments are "not a
document vault"; offline is paid. TripIt is strong on flights and weak on everything that is not an
email. The bar: **every detail you would otherwise dig out of email, at the moment you need it, with
no signal, for every person in the party.**

## 2. Kinds and their fields

Common to all (columns on `reservation`): kind, status, title, provider, booked via (an agent such as
Expedia), price, currency, paid, balance due date, payment (paid, deposit, pay later, free),
refundable, **free cancellation until** (a date and time), cancellation policy text, contact phone and
email, "manage booking" link, notes, attachments, and the catalog entity when there is one.
Secret codes (confirmation, PNR, agent reference, PIN) live in `reservation_secret` (section 6).

Timed parts are **segments** (`reservation_segment`): each has a start and an end in local time with
the IANA zone at each end, a from and a to (label, code, map point, catalog entity), carrier and
number, terminals, cabin, and kind-specific details.

| Kind | Segments | Kind-specific fields | Per traveller |
|---|---|---|---|
| **flight** | one per leg (a round trip or a connection is one reservation, several legs) | airline, flight number, airports (IATA), terminals, cabin, baggage allowance | seat, ticket number, bags |
| **stay** | one: check-in → check-out at the property | room type, beds, breakfast, check-in from/until, check-out by, parking, key pickup, Wi-Fi | room assignment |
| **car** | one: pickup → drop-off (places may differ) | company, class, insurance and excess, fuel policy, one-way fee, driver(s), mileage | named drivers |
| **train / bus / ferry** | one per leg | operator, service number, stations or ports, coach, vehicle on ferry | seat, coach, berth |
| **transfer** | one | company, pickup point, driver contact, sign name | |
| **activity** (tour, ticket, lift, permit, show, park entry) | one per slot | time slot, meeting point, what to bring, minimum age or height (from the catalog offer) | ticket per person, name on ticket |
| **restaurant** | one | party size, special requests | |
| **parking** | one | lot, entry code, plate | |
| **insurance** | none (a period) | policy number, provider phone, cover, excess | covered people |
| **other** | optional | free fields | |

Kind-specific fields sit in `details` (JSON), each kind validated by its own Zod schema, so the form,
the API and the MCP tool all agree. The form shows only the fields of that kind, with the important
ones first and the rest under "More details".

## 3. Status: from "to book" to "done"

```
 to book ──(booked it)──► booked ──(trip day passes)──► done
    │   └─(reserved, pay later)─► held ─┘        │
    └───────────────(decided against)────────────┴──► cancelled
```

- **To book**: the minimum is a kind and a title ("Jasper hotel, 4 nights"). It creates a **Book**
  task. Its due date is, in order of preference: the catalog offer's window (`opens_at`/`book_by`,
  01-domain-model.md 2.3), a date the user picks, or a default by kind (stays 90 days before, flights
  120, popular activities 60). Reminders follow 02-experience.md section 9. It still appears on its
  day, drawn as dashed ("not booked yet"), so the plan reads correctly.
- **Booked**: filling details (or forwarding the email) closes the Book task automatically and
  generates the follow-up tasks in section 5.
- **Held**: reserved but not final (pay at property, provisional hold); keeps a reminder on the
  balance or hold expiry.
- **Done** is automatic after the last segment ends; **cancelled** keeps the record (and any refund
  note) out of the plan.

## 4. How reservations drive the plan and the routing

A reservation is the **source of truth for its times**. Its segments appear in the itinerary as
**anchored items** (`trip_item.segment_id`): shown with a ticket mark, times locked (edit them on the
reservation, and the item follows), draggable only to change the note or the order of unanchored items
around them.

| Reservation | What the plan does with it |
|---|---|
| **Stay** | sets **each night's base** (`trip_night_base` view, schema.sql): every day's route starts and ends there; drive and walk times on the day are computed from it; the outline and collapsed day headers show "sleep: Hotel Ambra". Check: **"no stay for night 4"** with a fix (add a stay, or mark the night as travel/camping/family) |
| **Check-in and check-out times** | the day of arrival can't plan the room before check-in (warning, with "luggage storage?" note); check-out day starts at the old base and must leave by the check-out time or plan a bag drop |
| **Flight** | **arrival day** starts at arrival time + buffers (immigration for international 45-60 min, bags 20, car pickup 30, all editable); **departure day** ends at "be at the airport by" = departure − 3 h international or 2 h domestic − drive from the night's base. Today mode shows **"Leave for VCE by 07:35"**. Shown on the map as an arc |
| **Car** | defines when the party can drive: legs outside the rental window switch to transit or walking, with a warning if an item needs a car; pickup and drop-off appear as items |
| **Train, bus, ferry** | anchored transport items; connections checked ("only 12 min to change at Bolzano") |
| **Activity** | anchored at its slot; meeting point is the item's location; eligibility checked against each traveller on the ticket |
| **Restaurant** | anchored meal |

Time zones: every time is stored local plus zone, so an overnight flight shows "dep 18:30 Toronto, arr
09:05 Venice (+1), 8 h 35" correctly (checked in schema.sql against sample data).

## 5. Tasks and reminders that reservations create

| From | Task | When |
|---|---|---|
| to book | Book it | offer window or chosen date; reminders at opening (section 3) |
| free cancellation | "Last day to cancel Hotel Ambra free" | 3 days before and the morning of `free_cancel_until` |
| balance due | "Pay balance to …" | on `balance_due_on` |
| flight | "Check in online" | typically opens 24 h before (airline default editable) |
| flight | "Save boarding passes offline" | after check-in |
| car | "Bring licence and the credit card used" (and IDP if needed) | the day before pickup |
| stay | "Tell the hotel your arrival time" when arrival is after the check-in window closes | 2 days before |
| activity | "Download tickets" when the reservation has no attachment | 3 days before |
| any | "Reconfirm" for transfers and small operators | 2 days before |

All generated tasks follow the rule in 01-domain-model.md 3.5: regenerating never duplicates them and
never overwrites one the user edited.

## 6. Privacy and security

- Confirmation codes and PNRs let anyone change or cancel a booking, so they live in
  **`reservation_secret`** with a stricter row policy: trip members only (not viewers), never in
  link or public views, templates, exports to others, or MCP responses unless the token has the
  `reservations:read` scope. Copy-to-clipboard and "reveal" buttons, not shown by default on shared
  screens.
- We do not store passport numbers, card numbers or frequent-flyer passwords. A frequent-flyer
  number is optional and private.
- Attachments (tickets, QR codes, vouchers) are private Storage objects with signed URLs; cached on the
  phone for offline use when the trip is downloaded.
- Forking a trip as a template drops all reservations except "to book" placeholders without details
  ("book a stay in Ortisei, 3 nights, 90 days ahead").

## 7. Ways to add a reservation

| Way | Notes |
|---|---|
| **Form per kind** | smart fields: airport and station search (OurAirports, public domain, gives code, point and time zone), place search for stays (catalog first, then address search), dates with the trip's days pre-selected, travellers ticked by default |
| **Forward the confirmation email** | per-user address; schema.org reservation markup read first; unknown formats become a pre-filled form to finish (07-competitors.md section 4) |
| **Upload a PDF or photo** | stored as the attachment; the form opens beside it to fill the key fields (no paid OCR in v1) |
| **Paste text** | into the form's "Paste confirmation" box; recognises codes, dates, times and airports with rules; anything unsure is left for the user |
| **From a chat client (MCP)** | `reservations` tool: add, update, attach; a client can read an email the user pastes and fill the fields |
| **From a to-book placeholder** | "I booked it" on the task or the dashed item opens the form pre-filled |

Flight lookup by number (filling times from a flight data service) needs a paid API; left out of v1,
listed as a later option.

## 8. Screens

- **Bookings strip** at the top of the plan document (02-experience.md 6.1): one chip per kind with
  counts and status ("Stays 3/4 ⚠", "Flights ✓", "Activities 2 to book"); tap to add or open.
- **Reservations view**: grouped by day in trip order (default) or by kind or by status; each row
  shows what, when (both time zones when they differ), where, status, the next deadline, and quick
  actions (reveal code, call, navigate, open ticket).
- **Wallet in Today mode**: today's reservations first, each opening to a full-screen card with the
  code large enough to read out at a desk, the QR or barcode attachment, the address with one-tap
  navigation, and the contact number; all offline.
- **Detail sheet**: the full record, segments, travellers with seats, attachments, the tasks it
  created, and history (who changed what).

## 9. MCP

`reservations` (scopes `trips:read` / `trips:write`; codes need `reservations:read`): list by trip,
add (kind + fields + segments + travellers), update, attach a file, mark booked or cancelled. The
tool's description tells clients never to invent confirmation codes and to leave unknown fields empty.

## 10. What changes elsewhere

- `booking` in schema.sql is replaced by `reservation`, `reservation_secret`, `reservation_segment`,
  `reservation_traveller`, and the `trip_night_base` view; `trip_item.segment_id` anchors items.
- 01-domain-model.md 3.4, 02-experience.md section 7, 03 Plan tools and 05 M3 point here.
- The catalog `offer` keeps the knowledge (what can be booked, its window, how fast it sells); a
  reservation is one party's actual booking, optionally pointing at the offer.
