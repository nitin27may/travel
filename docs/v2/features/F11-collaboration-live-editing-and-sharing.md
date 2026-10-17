# F11. Collaboration, live editing and sharing

This is the **sharing feature page**. The full sharing design (share objects, audiences, guest links,
exports, MCP) is [10-sharing.md](../10-sharing.md); this page summarises it, links each shareable
object to its feature page, and specifies collaboration and live editing in detail.

## Purpose

Plan together in real time like Wanderlog (decided: live co-editing), share a read-only view with
grandparents, and always know who changed what. Built on the operation layer plus Supabase Realtime
broadcast and presence (08-self-hosted.md 4), not on a separate sync engine.

## User stories

1. As two parents on two laptops, we want each other's changes to appear within a second, so that we plan in the same evening without overwriting each other.
2. As an editor, I want to see who else has the trip open and which item they are editing, so that we don't collide.
3. As the owner, I want to invite my partner as an editor and grandparents as viewers, so that each sees the right amount.
4. As a grandparent without an account, I want a link that shows the days and places, so that I know where the family is.
5. As anyone, I want an activity feed ("Priya booked the shuttle · 2 min ago"; "Claude added 6 items"), with undo for my own changes.

## Detailed behaviour

### Roles

1. **Owner**: everything including delete and transfer; **Editor**: edit plan, reservations, tasks, budget; sees reservation codes; **Viewer**: read the plan, no codes, no attachments, no traveller details beyond first names. Roles live in `trip_member`; RLS enforces them.
2. Invite by email (pending until accepted), or by a one-time invite link with a role. Removing a member revokes access immediately (their open session gets a broadcast "access removed").

### Live editing

3. A client sends an operation; the server commits it (op layer, RLS), inserts `op_event`, increments `trip.version`, and broadcasts `{op, input, result, version, actor, client}` on the private Realtime channel `trip:<id>`.
4. Other clients apply the op with the shared reducer (same code as optimistic updates and offline replay). If a client sees a version gap, it asks for `ops since N`; if the gap exceeds 200 ops, it refetches the trip.
5. **Optimistic updates**: the acting client applies immediately; on server rejection it rolls back with a short message ("Item was deleted by Priya").
6. **Ordering and conflicts**: the server is the order of record; moves use fractional keys; field edits are last-writer-wins per field; text notes being edited by two people at once show a soft warning ("Priya is editing this note"). Upgrade path: Yjs per note field over the same channel.
7. **Presence**: avatars at the top (who has the trip open), a small avatar on the item someone is editing, and the day someone is viewing in the outline.
8. Channel authorisation: RLS on `realtime.messages` allows joining `trip:<id>` only for members.

### Sharing outward (summary of 10-sharing.md)

9. **Audiences**: members (owner, editor, viewer, with accounts); **guest links** (no account, read-only, expiring, revocable, optional PIN); **public** (templates only, F12); **exports** (PDF, ICS, GPX, Google Maps link, image card via the Web Share API; F15); **chat clients** through the MCP with scopes (F17).
10. **Share objects** and where each is specified:

| Object | Feature page |
|---|---|
| Whole trip, day range, one day, one list, one item | F06 |
| Explore search | F04 |
| Entity (place, trail, activity) and area guide | F05, F04 |
| Reservation card, ticket attachment | F08 |
| Task (by assignment), pack list, checklist | F09 |
| Budget summary | F10 |
| Template | F12 |
| Today's plan, next stop | F13 |
| Trip story (after) | F14 |
| Route, GPX, ICS, PDF, Maps links | F15 |

11. **Guest link rules**: a secret URL (`/s/<token>`) scoped to one object; expiry (default 30 days, or the trip end + 7 days), revocable and rotatable, optional 4-6 digit PIN; include toggles for costs, notes and reservation times; **never** codes, ages, heights, passport data or attachments unless the sharer explicitly chooses a ticket or code with a warning. Items and notes marked private are always excluded. Each open is logged (count and last opened, no tracking of the viewer).
12. **Public**: only templates; never a live trip.
13. **Print view**: a clean day-by-day page, also the PDF export (F15).

### Activity feed

12. Panel listing ops grouped by actor and minute: "Priya moved Seceda to Day 3", "Claude (MCP) added 6 items to Ideas"; each batch by the current user has Undo; owners can undo any batch.
13. Notifications for changes by others are off by default; an editor can turn on "tell me when someone changes bookings".

## Data touched

`trip_member`, `op_event`, `trip.version`, `realtime.messages` policies, `share_link` (new), all trip tables via ops.

### Schema additions

- `share_link` as defined in 10-sharing.md (object type and id, scope such as a day range, token, expiry, PIN hash, include toggles, created_by, revoked_at, open count, last opened). This page assumes that definition.
- `trip_item.private boolean default false` and `day_note.private boolean default false` for notes hidden from viewers.
- `op_event.batch_id text` to group the ops of one `edit_trip` or one drag.

## Operations and MCP tools

Operations: `member.invite`, `member.accept`, `member.set_role`, `member.remove`, `trip.transfer_owner`, `share_link.create` (object, scope, expiry, PIN, includes), `share_link.update`, `share_link.revoke`, `share_link.resolve` (guest read), `op.ops_since` (query), `op.undo_batch`.

MCP: changes made by a client broadcast like any other; `get_trip` returns `version` so a client can detect concurrent edits; `edit_trip` accepts `expected_version` (optional) to fail fast if the trip changed.

## Edge cases

- Offline edits replayed after a teammate's conflicting change: ops are intent-based and mostly commute; non-commuting ones (edit of a deleted item) are rejected and listed in a "couldn't apply" tray with copy-to-clipboard.
- Realtime disconnected (home server unreachable): the client shows "live updates paused" and polls on reconnect.
- A viewer link opened after the trip ended: still works until revoked; shows "past trip".
- Rapid drags (10 ops/s) by one user: client coalesces moves of the same item within 300 ms into one op.

## Acceptance criteria

1. Two browsers on the same trip: a move in one appears in the other in under 1 s on the home network (p95), without a page reload.
2. A removed member's open tab loses access within 5 s.
3. A guest link never returns codes, attachments, ages or private notes unless explicitly included, honours expiry and PIN, and stops working within 5 s of revocation (privacy test with sentinels).
4. Undo of a batch made by Claude restores the trip exactly (snapshot compare).
5. A client that missed 50 ops catches up with `ops_since` and ends in the same state as a fresh load.

## Milestone

M2 (members, roles, live broadcast, presence, viewer link, activity feed). Yjs notes only if needed.

## Open questions

1. Can viewers see the budget? Default: hidden, toggle per link.
2. Comments on items in v1? Default: no; notes cover it.
3. Should editors be able to invite others? Default: no, owner only.
