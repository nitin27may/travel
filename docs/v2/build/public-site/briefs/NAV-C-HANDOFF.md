# NAV-C hand-off: requests to NAV-1, NAV-2, NAV-3, CUS-C and ORG-C

Status: written 26 Oct 2026 by travel-builder (Opus) with NAV-C-FIX, from the review
`docs/v2/design/shell/review-nav-c-2026-10-26.md` (branch `public/NAV-C-RV` until it merges) and the owner
decisions the coordinator relayed the same day. Each brief named below carries its section as acceptance. The contract
itself is `core/src/schema/copies.ts` and `core/src/schema/trip-custom.ts`; their file headers are the reference.

## 1. What NAV-C-FIX changed (read before building on the contract)

| Change | Why | What a caller does |
|---|---|---|
| `writeCopies(storage, env, base)` is compare-and-set; returns `newer` or `changed` | review C1: a stale tab overwrote a newer envelope or another tab's change | pass the raw text you read as `base`; prefer `updateCopies(storage, change)`, which re-reads and re-applies once on `changed` |
| `planMerge(input: unknown, account, cap)`, `copyToDraftRow(x: unknown)`, `copyToTripCustom(x: unknown)` parse and return `{success, data}` or `{success: false, issues}` | review C2: the route receives JSON | pass the request body as received; refuse with 400 on `success: false` |
| A test fails on a bare `.parse`/`.safeParse` of `copyItem`, `copiesEnvelope` or `tripCustom` anywhere in `core/src` or `web/` | review C2 | use `parseCopy`, `parseCopyList`, `parseEnvelope`, `readCopies`, `parseTripCustom`, `readTripCustom` |
| `copiedAt`, `noteSeen`, `snoozedUntil`, `merged` values: UTC `Z` only; compared as instants | review M1 | write times with `toISOString()` |
| `markMerged(env, {inserted, already, sameTrip}, h, at)` | review M2 | `inserted` is the route's `returning id`, never the plan's insert list; the toast counts `inserted` |
| The stored origin field is **`fromRef`**, private whatever its value | owner, 26 Oct 2026 (review Q1) | see 2 |
| `needsMerge(env)`: the merge runs whenever the device holds copies; `merged[h]` is a hint (toast suppression), at most 10 accounts | owner, 26 Oct 2026 (review Q2) | see 4 |
| Optional `rev` on copy items and in `trip-custom/1`; `DraftRow.source_revision` | owner, 26 Oct 2026 (review M4) | the copy sheet writes the trip's content revision when it has one |
| `photo` refuses protocol-relative and backslash paths; the envelope is at most 86,016 bytes | review L1, L2 | none |
| A throwing read in the legacy move is `read-failed` | review L5 | none |

## 2. Origin spec: the stored field is `fromRef` (for trip-origin-and-nearest-airport.md, sections 8.1 and 10)

The owner chose a distinct stored key so the detector can treat it as private whatever it holds. Apply to
[trip-origin-and-nearest-airport.md](../../../features/trip-origin-and-nearest-airport.md) in its next docs pass, and in
the ORG-2 and CUS-C briefs:

- `copies/1` and `trip-custom/1` store the visitor's origin as **`fromRef`** (an origin reference: `iata:BOM`,
  `hub:toronto`, `town:<id>`, `gn:<n>`), not `from`. `gw` is unchanged.
- The **URL parameter stays `from`** (`from=bom`, `from=ottawa`), and so does the API query parameter
  (`/getting-there?from=`). Only the stored field changes.
- 8.1 rule 1 reads: `origin/1`, the copies' `fromRef` and `trip-custom/1` `fromRef` are private keys in
  `core/src/privacy/detect.ts`. The value-based rule on `from` stays as a second net.
- ORG-C should consider the same for `origin/1`: its `ref` is a generic key, so the detector catches no `origin/1` body
  today (see 6).

## 3. NAV-2 (My trips, signed out) — review M3, L3, L5

1. **Map legacy drafts leniently.** `fromLegacy` in core is strict today: one bad override value, a `placeSlug` that is
   not a slug, a missing `savedAt` or a child's age outside 0 to 17 rejects the whole draft, which then stays under
   `travel:v1:copy-drafts` where nothing reads it. NAV-2 widens the mapping (in core, through the NAV-C owner, or with a
   core change in its own brief): drop invalid overrides and additions, clamp the party to the schema, take `copiedAt`
   from `savedAt` or the move time, and keep only drafts with no valid `slug` or `start`.
2. **Move once.** While anything is kept, the move runs on every read and refills any slot the visitor frees (Remove,
   then the next read pulls an old draft in, and the toast's Undo then fails on the cap; also review L3, a removed copy
   resurrected after a failed delete). Run the move once per device (a flag in the envelope or its own key) and show
   "N older copies did not fit" from `kept`, rather than moving over-cap drafts later.
3. **Writes go through `updateCopies`.** Never `setItem` the envelope directly; a `newer` result shows the error state of
   nav 3.1 and writes nothing.
4. **Same trip and start skipped at the merge** leave the device with their choices (the account wins, rule 3); the merge
   toast says so ("1 copy matched a trip already in your account").

## 4. NAV-3 (signed in: the merge route) — review C2, M2, L2, Q2, Q3

1. **`source_trip` is checked against the public, listed trips** before insert. A draft pointing at a private or unlisted
   slug is refused, or `/t/<id>/` (CUS-1) becomes a way to load a private trip's template by slug.
2. **Titles come from the catalogue.** The route sets `title` (and refreshes `days`, `cc`, `photo` where it returns them)
   from the catalogue by `source_trip`, not from the client; legacy copies carry the placeholder "Trip".
3. **Cap the request body before `JSON.parse`** at `ENVELOPE_MAX_BYTES` (86,016 bytes; 20 copies of 4 KB plus 4 KB).
4. **`insert ... on conflict (id) do nothing returning id`**; pass the returned ids to the client, which calls
   `markMerged` with them. An id the plan inserted but the server did not return (another account holds it, or the
   NAV-D cap trigger refused it) stays on the device and is counted.
5. **When the merge runs (owner):** whenever the signed-in visitor's device holds copies (`needsMerge`), on `/account/`
   and `/mine/` only (N9), not only when `merged[h]` is absent. `merged[h]` only suppresses a repeated toast.
6. `source_revision` comes from the copy's `rev` (null when the copy has none).

## 5. CUS-C (trip-custom/1 and the custom-draft migration) — review M4, L5

1. **The forward-compatibility rule** (now in the header of both contract files): both objects are strict, so an unknown
   key is `invalid`, not `newer`. CUS-C may add its keys to `/1` only while no `trip-custom/1` doc is stored, that is
   before its migration is applied anywhere. After the first stored doc, any new key is `trip-custom/2`.
2. **`days` collides with the copy's snapshot `days`** (a count). Name the add-or-drop-a-day field `dayEdits` (or similar).
3. **`notes` is a public key in the detector** (a trip or track note). Use a private key for a visitor's notes
   (`customNotes`) and add it, and `custom` (a visitor's point, possibly outside the home radius, which the detector does
   not see), to `PRIVATE_KEYS`.
4. **Op ids.** The merge writes additions as `o-1` to `o-n`. CUS-C's op counter starts after the highest existing op in a
   doc, never at 1.
5. `overrides` keys stop at day 99 while a copy's `days` allows 366; widen together if a trip ever exceeds 99 days.
6. `rev` is reserved in `trip-custom/1`; CUS-C writes it into `source_revision` as well, or drops one of the two with a
   note.

## 6. ORG-C (origin contracts) — review M5

1. **The value-based `from` rule has known misses**, pinned as tests in `core/test/schema/copies.test.ts` so a change is
   deliberate: the URL form (`bom`, `ottawa`), a resolved label ("Mumbai"), a JSON string under `from`, nesting deeper
   than three levels, and a reference under another key (`start.ref` of `intake-detail/1`, `origin`, `ref`). A copy's
   party outside `travellers` (`adults`, `children` on a copy item) is caught only through its sibling keys `copiedAt`
   and `added`. ORG-C adds private keys for `origin/1` and for the intake `start` reference.
2. **`respond()` 500 hazard.** `GET /api/v1/trips/{slug}/getting-there?from=&gw=` goes through `respond()`, which fails
   closed on any detector hit. If `gettingThere/1` echoes the request under `from` in the prefixed form, or uses a `gw`
   key (now private), every call returns 500. Design the payload around it: keys `in` and `out`, no `gw`, no echo of
   `from`; or extend the echo lifting in `detect.ts` for exactly that parameter.

## 7. NAV-1 (shell)

`web/lib/mine/storage.ts` wraps `probeStorage(() => window.localStorage)` and nothing else; the badge reads the envelope
through `readCopies`. No other change.
