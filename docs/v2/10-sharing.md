# 10. Sharing

Asked by the owner on 17 Oct 2026: sharing wherever it applies. A trip is rarely planned or travelled
alone: a partner edits it, grandparents want to know where the kids are sleeping on day 4, a friend
asks "send me that Dolomites plan", a teenager needs today's plan on their own phone. Sharing is
therefore one system with one rule set, reachable from every screen that shows something worth
sending.

## 1. What can be shared

| Object | Typical use | Notes |
|---|---|---|
| **Whole trip** | partner, co-travellers, grandparents | the common case |
| **Day range or one day** | "here is our plan for Day 3"; a babysitter for the days we're away | a guest link limited to those days |
| **Today's plan** | a teenager, a friend joining for one day | link that follows "today" during the trip and expires after it |
| **A list** | "our restaurant shortlist for Venice" | |
| **An item or a place** | "meet us here at 14:00" | includes the map pin and navigation link |
| **A reservation card** | send the hotel's address, dates and phone to the grandparents | codes off by default |
| **A ticket attachment** | a companion's boarding pass or museum ticket | one file, expiring link |
| **Budget summary** | totals per category for a co-traveller | members only; never in guest links unless included |
| **A template** | "fork our Rockies plan" | public page, no personal data |
| **An area guide or entity page** | "look at this trail" | always public catalog pages |
| **An explore search** | "family hikes under 8 km near Banff" | the URL holds the filters |
| **A route** | a day's drive | Google Maps or Apple Maps multi-stop link; GPX |
| **The trip calendar** | someone wants it in their own calendar | ICS feed, read-only, revocable |

## 2. Audiences

| Audience | Account | Can do | Sees |
|---|---|---|---|
| **Owner** | yes | everything, including deleting and transferring | everything |
| **Editor** (member) | yes | edit plan, reservations, tasks, budget; invite viewers if the owner allows | everything except other people's private notes |
| **Viewer** (member) | yes | read; check off tasks assigned to them; add their own private notes | everything except reservation codes, attachments, private notes, budget unless granted |
| **Traveller without an account** (a child, a grandparent on the trip) | no | read their link; check off their own tasks if granted | what the link includes |
| **Guest link** | no | read only; "copy to my trips" only if allowed | only what the link includes (section 3) |
| **Public** | no | read; fork a template | template shape only: no people, dates optional, no reservations, no costs unless chosen, no private notes |
| **Chat client (MCP)** | the user's own token | what the token's scopes allow | never codes without `reservations:read`; never other people's private notes |

## 3. What a guest link includes

Chosen when the link is made, with a **live preview of exactly what the recipient will see**.

| Include | Default | Notes |
|---|---|---|
| Plan items, times, places, map | on | |
| Notes | on, except notes marked private | private notes never leave the member group |
| Stays and transport (times, places, phone) | on for family links, off for public | |
| Reservation codes | **off**; per reservation, never in bulk | shown only behind a "reveal" tap |
| Attachments (tickets) | off; one at a time | each a separate expiring link |
| Costs and budget | off | |
| Travellers | first names only; never ages, heights, passport dates | |
| Tasks | off; on for "helper" links (someone feeding the cat gets the house tasks) | |

Link settings: scope (trip, days, today, list, item, reservation, ticket), expiry (24 h, 7 days, end of
trip, never), optional PIN (4-6 digits; rate-limited), allow "copy to my trips" (on/off), and a name
for the link ("Grandparents"). Every link shows its views and last-viewed time, and can be revoked
instantly. Tokens are random and long; only their hash is stored.

## 4. How sharing is offered in the interface

- **One Share button** on every screen where something is shareable (trip dashboard, plan document
  header, the ⋯ menu of every day, list and item, entity sheets, explore results, reservation cards and
  wallet, budget, templates, Today mode, after-trip story). It opens the **share sheet** pre-set to that
  object.
- The share sheet: audience (invite people by email, or create a link), scope, include toggles with the
  live preview, expiry, PIN; then **copy link, QR code, or the phone's share menu** (Web Share API:
  WhatsApp, Messages, email), with a preview card (trip title, dates, map thumbnail) generated for
  link previews.
- **Manage sharing** on the trip: members and roles, active links with views and revoke, calendar feed,
  public template status.
- **Guest view**: a clean read-only page, phone-first, signed out, with a small banner ("Shared by
  Nitin · view only · expires Sun 12 Oct"), offline-capable after the first open (the guest can add it
  to their home screen), and "copy to my trips" when allowed.

## 5. Sharing and privacy rules (enforced, not just hidden)

1. Guest and public reads go through **dedicated read functions** that build the response from the
   link's scope and includes; they never read people, codes or attachments unless included. Row-level
   security still applies underneath.
2. Private notes (`private = true` on items and day notes) are excluded from every shared view and
   every export except the author's own.
3. Ages, heights, birth dates, citizenship and passport dates never appear in any shared view.
4. Reservation codes appear only to members with the right role, or behind an explicit per-reservation
   include on a link.
5. Every share action is an operation: logged in `op_event`, undoable (revoking restores nothing a
   recipient already saw, which the UI says plainly).
6. Chat clients creating a guest or public link must confirm with the user first (stated in the MCP
   tool description).

## 6. Exports (sharing as files)

PDF (printable trip book: day pages with maps, stays, reservations without codes unless chosen) ·
ICS (whole trip or one day) · GPX (trails and day routes) · Google Maps and Apple Maps links (a day's
stops in order) · My Maps CSV · an image card of a day or a place for messaging apps. Exports apply the
same include rules as guest links.

## 7. Schema additions (applied to schema.sql)

- `share_link`: id, trip_id, token_hash, name, scope (jsonb: kind trip | days | today | list | item |
  reservation | attachment, plus ids or day range), includes (jsonb), allow_copy, pin_hash, expires_at,
  revoked_at, created_by, created_at, view_count, last_viewed_at.
- `private boolean` on `trip_item` and `day_note`.
- `trip_member.can_invite` (editors inviting viewers), `trip_member.budget_access`.

## 8. MCP

`share` tool (scope `trips:write`): create a guest link with scope and includes, list and revoke
links, invite or remove members. It never returns reservation codes, and its description tells clients
to confirm with the user before creating guest or public links (03-mcp-and-research.md; details in
mcp/).

## 9. Milestones

M2: members (owner, editor, viewer), invite by email, guest link for the whole trip with includes,
revoke, live preview. M3: reservation cards and ticket links, calendar feed. M4: today link, offline
guest view, PDF and image card. M5: public templates and fork.
