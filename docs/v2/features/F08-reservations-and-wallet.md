# F08. Reservations and wallet

Full design: [09-reservations.md](../09-reservations.md). This page is the feature summary with
stories and acceptance criteria.

## Purpose

Everything the party booked (or still has to book) in one place: flights, stays, cars, trains,
ferries, transfers, activities, restaurants, parking, insurance. **We never sell or book anything.**
Recorded reservations drive the plan (night bases, arrival and departure bounds, car windows), create
tasks (check in, free-cancellation deadline, balance due), and live offline in a wallet for the trip.

## User stories

1. As a traveller, I want to forward my Air Canada confirmation and see both legs, both seats and the PNR in the trip, so that I stop searching email.
2. As a planner, I want to add "Jasper hotel, 4 nights, not booked yet", so that it shows on the plan and reminds me to book.
3. As a traveller, I want "last day to cancel free" reminders, so that I don't lose money if plans change.
4. As a traveller at a check-in desk with no signal, I want the confirmation code big on screen and the QR code available, so that check-in is fast.
5. As a chat-client user, I want to paste my hotel email into Claude and have it add the reservation, so that I don't type fields.
6. As a parent, I want each child's seat and ticket on the flight, so that the whole party is recorded, not only the booker.

## Detailed behaviour

1. **Kinds**: flight, stay, car, train, bus, ferry, transfer, activity, restaurant, parking, insurance, other. Each with a form showing only its fields (important first, "More details" for the rest).
2. **Status**: to_book → held or booked → done, or cancelled. To-book needs only a kind and a title; it creates a Book task with a due date (offer window, chosen date, or default by kind) and reminders.
3. **Segments**: each timed part (flight leg, stay check-in to check-out, car pickup to drop-off, activity slot) with local times and zones at both ends, from/to with codes and points, carrier and number.
4. **Travellers**: tick who is on it; per-traveller seat, ticket number, bags, room.
5. **Money**: price, currency, paid, balance due, payment type, refundable, free cancellation until; feeds the budget (F10).
6. **Secrets**: confirmation, PNR, agent reference, PIN in a separate, stricter table; "reveal" and "copy" buttons.
7. **Attachments**: PDF tickets, QR codes, vouchers in private Storage; cached for offline with the trip.
8. **Plan effects**: anchored items with locked times; stays set night bases; flights bound arrival and departure days with buffers; cars bound drive legs (F07 checks `no_stay`, `check_in`, `flight_bound`, `car_bound`).
9. **Generated tasks**: book (to-book), cancellation deadline, balance due, online check-in, save boarding passes, licence for car pickup, tell the hotel a late arrival, download tickets, reconfirm transfers (09-reservations.md 5).
10. **Ways to add**: form; forward an email (per-user address, schema.org markup first, then a pre-filled form); upload a PDF or photo; paste text into "Paste confirmation" (rule-based extraction); from a chat client (`reservations` MCP tool); "I booked it" on a to-book task.
11. **Views**: bookings strip in the plan overview (chips per kind with counts and status); Reservations view grouped by day, kind or status; detail sheet with segments, travellers, attachments, tasks created and history.
12. **Wallet** (Today mode, F13): today's reservations first; full-screen card per reservation with the code large, the QR, the address with Navigate, the contact number; offline.

### Adding through a chat client

13. A user pastes a confirmation into Claude ("add this to my Dolomites trip"). The client calls `get_trip` to find the trip, then `reservations.add` with kind, title, provider, segments (with zones), travellers matched by name, money fields and secrets. The tool's description says: never invent codes or times; leave unknown fields empty; ask the user when a traveller name doesn't match.
14. The result returns the reservation id, a link, and any check warnings caused ("no stay for night 4"), which the client can relay.
15. Clients without the `reservations:read` scope can add a reservation including its codes (write-only) but cannot read codes back.

## Data touched

`reservation`, `reservation_secret`, `reservation_segment`, `reservation_traveller`, `attachment`, `trip_item.segment_id`, `task`, `reminder`, `budget_line`, `expense`, `trip_night_base`.

### Schema additions

- `inbound_email (id, user_id, received_at, from_addr, subject, parsed jsonb, status, reservation_id, expires_at)` with a 30-day purge.
- `user_inbound_address (user_id, token unique)`.
- `reservation.timezone_check boolean` not needed; zones are per segment end.

## Operations and MCP tools

Operations: `reservation.add`, `reservation.update`, `reservation.set_status`, `reservation.add_segment`, `reservation.update_segment`, `reservation.remove_segment`, `reservation.set_travellers`, `reservation.set_secret`, `reservation.attach`, `reservation.cancel`, `reservation.from_email` (worker), `reservation.parse_text` (query, returns a draft).

MCP: `reservations` with actions `list`, `add`, `update`, `attach`, `mark_booked`, `cancel`; codes readable only with `reservations:read`.

## Edge cases

- One email with two reservations (flight + car from an agent): two reservations created, linked to the same inbound email.
- Overnight flight crossing midnight and the date line: segment end date differs; the arrival day is the destination date.
- Stay booked longer than the trip (an extra night): the extra night shows outside the trip with a warning and an offer to extend `nights`.
- A to-book reservation whose offer window cannot be computed (no dates yet): the task waits with "set trip dates to schedule this".
- Email forwarded for a trip that doesn't exist yet: lands in an "Unassigned" inbox in the Reservations view with "create a trip from this".
- Cancellation: segments disappear from the plan; the record and refund note stay; tasks it created become not_needed.

## Acceptance criteria

1. A round-trip, two-passenger flight added by form shows 2 legs with correct local and UTC times (tested with YYZ 18:30 → VCE 09:05+1 = 8 h 35) and 2 seats.
2. A stay from 13 to 16 July sets nights 1-3 base and leaves night 4 with a `no_stay` warning.
3. A forwarded email containing schema.org `LodgingReservation` markup creates a booked stay with check-in and check-out times and the confirmation in secrets.
4. Codes never appear in a viewer link, a template fork, an export to others, or an MCP response without `reservations:read` (privacy test).
5. Marking a to-book reservation booked closes its Book task and creates the follow-up tasks.
6. In airplane mode, the wallet shows today's reservations with codes and attachments after the trip was downloaded.

## Milestone

M3 (forms, statuses, segments, travellers, secrets, tasks, strip and view, email import, MCP tool); wallet offline in M4.

## Open questions

1. Flight lookup by number (fills times) through a paid API later? Default: not in v1.
2. Store the raw email at all? Default: parsed fields only plus the original as an attachment for 30 days, then deleted.
3. Should held reservations block "no stay" warnings? Default: yes, held counts as a stay.
