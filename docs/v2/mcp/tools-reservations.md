# Reservations tool

One tool, `reservations`, with an `action`. Design of the data: 09-reservations.md. We never book
anything; this records what the user booked or still has to book.

Scopes: `trips:read` for `list`/`get`, `trips:write` for changes, **`reservations:read`** to see or
set confirmation codes, PNRs, ticket numbers and PINs (`reveal`, and `secret` fields on `add`/`update`).
A client without `reservations:read` can still add a reservation; the codes it sends are refused
with `forbidden` and the user is asked to type them in the app.

## Actions

| Action | Does |
|---|---|
| `list` | reservations of a trip, filterable by kind, status, day |
| `get` | one reservation with segments, travellers, attachments list, tasks it created, history |
| `add` | create one or more reservations (with segments, travellers, optional secret) |
| `update` | change fields, segments or travellers |
| `set_status` | `to_book`, `held`, `booked`, `cancelled`, `done` |
| `attach` | attach a file the client has (base64, max 10 MB) or a URL to fetch once |
| `reveal` | return the secret codes (needs `reservations:read`) |
| `remove` | delete (only `to_book` or `cancelled`; booked ones must be cancelled first) |

## Input

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | enum | yes | above |
| `trip` | string | yes | |
| `id` | string | for get/update/set_status/attach/reveal/remove | |
| `filter` | `{kinds?, status?, day?}` | list | |
| `items` | Reservation[] | add | 1-20 reservations |
| `patch` | Reservation (partial) | update | merge patch; `segments` and `travellers` replace when given |
| `status` | enum | set_status | |
| `file` | `{name, mime, base64}` \| `{url}` | attach | |
| `client_op_id` | string | writes | |

`Reservation`:

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `kind` | enum | yes | `flight`, `stay`, `car`, `train`, `bus`, `ferry`, `transfer`, `activity`, `restaurant`, `parking`, `insurance`, `other` |
| `status` | enum | no | default `booked` when segments with times are given, else `to_book` |
| `title` | string | yes | "AC 892/893 Toronto ⇄ Venice" |
| `provider`, `booked_via` | string | no | airline or hotel; agent such as Expedia |
| `entity_id` | string | no | catalog hotel, station, attraction |
| `offer_id` | string | no | catalog offer, for its booking window |
| `price` | `{total, currency, paid?, balance_due_on?, payment?}` | no | |
| `cancellation` | `{refundable?, free_until?, policy?}` | no | `free_until` creates a reminder task |
| `contact` | `{phone?, email?, manage_url?}` | no | |
| `segments` | Segment[] | no | |
| `travellers` | `{traveller, seat?, ticket_no?, baggage?}[]` | no | `traveller` = traveller id or label ("Adult 2"); default everyone |
| `details` | object | no | kind-specific (room type, car class, meeting point...), validated per kind |
| `secret` | `{confirmation?, pnr?, agent_ref?, pin?}` | no | needs `reservations:read` |
| `book_by` | datetime | no | for `to_book` |
| `notes` | string | no | |

`Segment`: `{seq?, start:{local:"2029-09-08T09:05", tz:"America/Edmonton"}, end:{local, tz},
from:{label?, code?, point?, entity_id?}, to:{...}, carrier?, number?, terminal_from?, terminal_to?,
cabin?, details?}`. A stay has one segment whose `from` is the property and `start`/`end` are check-in
and check-out.

## Output

`add`/`update`: `{results:[{id, title, status, url, anchored_items:[{day, item_id}],
tasks_created:[{title, due_at}]}], warnings:[...], version}`. Warnings include `no_stay` nights still
open, `check_in_out` clashes, `flight_bounds` ("Day 1 items before 11:05 are before you land"),
`duplicate_suspected` (same flight number and date already on the trip).

`get`: the full record; `secret` only with `reveal`.

## Example: a round-trip flight for four from a pasted email

```json
{"tool":"reservations","arguments":{"action":"add","trip":"trp_dolo27","client_op_id":"01JB...","items":[{
  "kind":"flight","title":"AC 892/893 Toronto ⇄ Venice","provider":"Air Canada",
  "price":{"total":5412.36,"currency":"CAD","payment":"paid"},
  "segments":[
   {"seq":1,"start":{"local":"2027-07-12T18:30","tz":"America/Toronto"},"end":{"local":"2027-07-13T09:05","tz":"Europe/Rome"},
    "from":{"code":"YYZ"},"to":{"code":"VCE"},"carrier":"AC","number":"892","terminal_from":"1","cabin":"economy"},
   {"seq":2,"start":{"local":"2027-07-26T11:50","tz":"Europe/Rome"},"end":{"local":"2027-07-26T15:10","tz":"America/Toronto"},
    "from":{"code":"VCE"},"to":{"code":"YYZ"},"carrier":"AC","number":"893"}],
  "travellers":[{"traveller":"Adult 1","seat":"23A"},{"traveller":"Adult 2","seat":"23B"},{"traveller":"Child 1","seat":"23C"},{"traveller":"Child 2","seat":"23D"}],
  "secret":{"confirmation":"ABC123"}}]}}
```

```json
{"results":[{"id":"res_14","title":"AC 892/893 Toronto ⇄ Venice","status":"booked","url":"https://app.<domain>/t/dolomites-2027/reservations/res_14",
  "anchored_items":[{"day":1,"item_id":"itm_80"},{"day":15,"item_id":"itm_81"}],
  "tasks_created":[{"title":"Check in online for AC 892","due_at":"2027-07-11T22:30:00Z"},{"title":"Save boarding passes offline","due_at":"2027-07-12T12:00:00Z"}]}],
 "warnings":[{"code":"flight_bounds","day":1,"message":"Day 1 starts after landing 09:05 + 60 min buffer"}],"version":12}
```

## Errors

`validation_failed` (segment end before start in absolute time; unknown airport code: hint lists
matches), `forbidden` (secret without scope), `not_found` (traveller label), `conflict`.

## Ops

`reservation.add`, `reservation.update`, `reservation.set_status`, `reservation.attach`,
`reservation.reveal`, `reservation.remove`; they also run `tasks.regenerate` and `checks.run` for the
affected days.

## Notes for clients

- **Never invent** confirmation codes, seat numbers, prices or times. If the email does not say,
  leave the field out.
- Convert times exactly as written in the confirmation, with the zone of each airport or station;
  do not convert to the user's zone.
- If a pasted email contains several bookings, add them in one call and list what you found before
  saving if anything is ambiguous (two hotels on overlapping dates).
- Passenger names in emails map to travellers: ask when unsure who is who. Never store passport
  numbers or card numbers even if the email contains them.
- For "remind me to book X", add a `to_book` reservation with `book_by` (or the catalog `offer_id`),
  not a bare task: it then appears dashed on its day and its task closes when booked.
