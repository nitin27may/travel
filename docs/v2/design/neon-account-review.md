# Neon account path: design review and approved minimal design

Reviewer: Fable (design foundation owner). Model: **Opus** (chosen for design taste; no other
agents launched). Date: 24 Oct 2026.

Scope reviewed: the **UI** section of `docs/v2/build/public-site/NEON-SETUP.md`, against the
Trailhead foundation (`docs/v2/design/foundation/*`), the current sign-in placeholder
(`web/app/sign-in/page.tsx`), the public header (`web/components/shell/SiteHeader.tsx`) and the
capability gate (`web/lib/capabilities.ts`). This is a review-and-approve document for a small,
real account/draft path that proves Postgres + Managed Better Auth + Realtime end to end. It is
**not** the full planner. No app code is written here.

Grounded in render, not code: the current `/sign-in/` notice and the public header were captured
at 2x, at 1440 and 390, in light and dark, with dark set through the site's own theme toggle
(`web/test-results/shots/signin-{1440,390}-{light,dark}.png`). Both themes are correct and the
header already gates **Sign in** behind `capabilities.signIn`, which is the right hook for this
work.

---

## Blocker decision

**Not blocked. Proceed.** The brief's UI section is buildable entirely from existing Trailhead
components, tokens and both themes. It requires **no new palette** and **no full planner
navigation**. Two bounded additions are needed, and I rule on them below so the build is not
blocked:

1. A private **`/account/`** route (the brief's "account page"). There is no account template in
   the foundation today; N1–N6 (`patterns.md` 4.8) do not cover one. This document is the approved
   spec for it.
2. A **reduced signed-in header variant**: the three public tabs unchanged, with the **Sign in**
   link replaced by an avatar menu holding only **Account** and **Sign out**. The full signed-in
   header in `components.md` 1.1 (Home tab, trip chip, bell, People/Inbox/Settings) is planner
   surface and must **not** appear; it would invent planner navigation the brief forbids.

Both sit inside existing component rules, so they are design rulings, not open questions. After the
build lands, fold the approved `/account/` template and this reduced header variant into
`components.md` 1.1 and `patterns.md` (new 4.0 "Account"), and keep `tokens.*`, `components.md`,
`patterns.md`, `specimen.html` and `changes-from-preview.md` in step. No token changes are needed;
every pair below already exists and passes AA.

Principles that frame the whole path: **P7** (the public 90% come with no account; the account path
is the 10% and must stay out of the public surfaces' way), **P4** (the forms must work on first use
with no manual), **P8/P9** (the draft list is light, per-user, server-shaped and goes through the
one data boundary; a live subscription is a server feature, not a client bulk load), and **P5**
(live inserts animate smoothly, reduced motion jumps).

---

## Findings, ranked

### Critical

**C1 — "Live status" must never be green and never amber at rest.**
Screen: account draft list. The brief asks for a "live status". A developer will reach for a green
"connected" dot; the system has **no green anywhere** (`tokens.md` 3, owner rule Q47) and amber is
reserved for selected/now/primary action (`changes-from-preview.md` 1, 23). Why it matters: a family
scanning their saved drafts must read status by role, and a stray green or amber trains the eye
wrongly on every other screen. Fix: connected = a quiet **`--muted`** dot plus the word "Live"
(`--muted` on `--surface` 6.94:1 light / 7.45:1 dark, AA/AAA); reconnecting = an **`--info`** notice
banner; error = **`--crit`** inline (details in the design below). No `--ok` for "connected" either:
`--ok` means done/booked/fits, not a socket state.

**C2 — Destructive draft delete and sign-out must be confirmed and undoable.**
Screen: account draft list and header menu. Deleting a draft and signing out both lose state.
Why it matters: a one-tap delete on a touch row is an easy mis-tap and the row is the only copy.
Fix: delete goes behind the confirm-and-undo pattern (`patterns.md` 4.4) — a **danger** button
(`--crit-fill`, `--on-crit-fill` 5.70:1 AA both themes) inside a small confirm, then a toast with
**Undo** (`components.md` 5.3, 6 s). Sign-out is a plain **secondary** button, not danger, but a
full session change must unload all prior-user client state (brief's own rule) — the design states
this.

**C3 — Private routes fail closed; anonymous never sees private UI.**
Screen: `/account/`, and the header when signed out. The brief requires public pages usable with
Neon unconfigured and private routes to fail closed. Why it matters: a blank or half-rendered
private page is both a trust and a security failure. Fix: when `capabilities.signIn` is off,
`/account/` is not reachable UI and `/sign-in/` stays today's noindex notice; when it is on but the
session is absent, `/account/` shows the signed-out state (a sign-in prompt), never a draft list;
Realtime queries are sealed by the server-verified user id (brief's contract), so no row from
another user can paint even for an instant.

### Important

**I1 — Distinguish wrong credentials from an unreachable service.**
Screen: sign-in / sign-up forms. The brief says "clear service errors". Why it matters (P4, honesty):
"wrong password" and "the service is down" need different user actions. Fix: wrong credentials =
**urgent** banner (`--crit-soft` fill, `--crit` border and text; `--crit` on `--crit-soft` 5.45:1
light / 6.36:1 dark, AA) reading "We couldn't sign you in. Check your email and password." A service
failure = **notice** banner (`--info-soft`; `--info` on `--info-soft` 5.91:1 / 7.61:1) reading
"Sign-in is unavailable right now. Try again shortly." Never show a credentials error when the
service never answered.

**I2 — Keep the signed-in header reduced; do not grow planner nav.**
Screen: header, signed in. Covered in the blocker ruling. Why it matters: the brief says this is
service integration, not the planner, and `product-direction` keeps the public, no-login site first.
Fix: tabs stay **Trips · Places · Globe**; the right cluster is search, theme, then an **avatar
menu** (`components.md` 5.2 popover) with exactly **Account** and **Sign out**. No bell, no trip
chip, no Home tab.

**I3 — Be honest about email verification limits in the UI.**
Screen: sign-up success. The brief says report verification limits honestly. Why it matters (T3,
trust): if Managed Better Auth is not sending verification mail, a "Check your email" message lies.
Fix: the sign-up confirmation states exactly what happens next for this deployment — if no
verification mail is sent, say "Your account is ready. Sign in." rather than promising an email.

**I4 — The draft list is a polite live region with announced changes.**
Screen: account draft list. Why it matters (accessibility; P5 keeps context): a screen-reader user
must hear a live insert, rename or delete without losing place. Fix: the list is
`aria-live="polite"`; inserts announce "Draft 'Patagonia ideas' added", renames "Renamed to …",
deletes "Draft removed. Undo available." Undo stays reachable by Tab before the toast leaves
(`components.md` 5.3).

### Polish

**P-1 — Count label mirrors the tab-count style.** Title block "ACCOUNT · 3 drafts" using the
established count convention (`components.md` 1.2 tab counts), not a bare heading.

**P-2 — Timestamps use the foundation's mono one-line style.** "Saved Sat 24 Oct · 2 min ago" in
mono, never wrapping (`changes-from-preview.md` 11), `--muted` (6.94:1 / 7.45:1).

**P-3 — Constrain the account content column.** The current placeholder leaves a large empty band in
dark (seen in the 390 dark render). Hold the account content to the reading column (~40 rem) so a
short list does not read as a broken page.

---

## Approved minimal design

Build only from the components named. Reduced motion collapses every transition to a 120 ms fade
(`components.md` shared rules). All touch targets 44 x 44 with 8 px gaps. Focus is the ring in
`tokens.md` 8, moved deliberately and never lost to `body`.

### Routes

- **`/sign-in/`** — becomes a real form **only when `capabilities.signIn` is on**; otherwise it
  stays today's noindex notice for old links.
- **`/sign-up/`** — registration, same shell as sign-in, noindex.
- **`/account/`** — private; signed-out state when there is no session; fails closed when Neon is
  unconfigured (C3).

These stay outside the public URL table's planner space (`patterns.md` 1.2); public
`/trips`, `/places`, `/globe` are untouched and work with no account.

### Header

Signed out: unchanged public variant (`components.md` 1.1) — the **Sign in** ghost link appears when
`capabilities.signIn` is on. Signed in: the reduced variant in I2. Avatar is the user's initial on a
`--surface` disc with a 1 px `--line-2` keyline (keyline rule, `changes-from-preview.md` 4); the menu
is `role="menu"`, Esc returns focus to the avatar.

### Sign-in / sign-up form

- Layout: one reading column (P-3), title block "SIGN IN" (Big Shoulders) with a one-line serif
  subtitle.
- Fields (`components.md` 2.2): **Email** (`type=email`, `autocomplete=email`) and **Password**
  (`autocomplete=current-password` on sign-in, `new-password` on sign-up). Labels above, mono 12/500
  `--muted`, required mark "·" after the label (never a lone asterisk). Help text serif 14.5 below.
  Input border `--line-2` (3.67:1 / 3.42:1 non-text UI, ≥3:1). Focus: `--accent` 2 px border plus the
  ring.
- Primary button **Sign in** / **Create account** (`components.md` 2.1): `--accent` fill,
  `--accent-ink` text (6.96:1 AA both; hover `--accent-hover` 5.96:1 AA). Loading state swaps the
  label for a 16 px spinner, locks the width, sets `aria-busy` — this is the "loading state" the
  brief requires.
- Secondary link to the other form ("Create an account" / "Already have one? Sign in"), ghost.
- Errors: banner above the form per I1. Field-level validation uses the input error state
  (`--crit` border, message below with the triangle icon, `aria-describedby`).
- Submit on Enter; the error banner is focused on failure so it is announced.

### Account page (`/account/`)

**First view (P2/P3)** answers two things at a glance: you are signed in as X, and here are your
drafts.

1. **Identity + session row.** Title "ACCOUNT · N drafts" (P-1). Below it, mono line "Signed in as
   name@example.com" (`--muted`). Right: **Sign out** secondary button (`--ink` on `--surface`
   16.06:1 / 13.83:1 AAA) — full session change unloads prior-user state (C2).

2. **Create-draft form.** A single text input labelled "Draft title ·" (required), 1–160 characters,
   help text "A short name only." Primary button **Create draft** (verb first). Empty or over-160 is
   invalid: button disabled at empty, inline error over 160 ("Keep the title under 160 characters.")
   using the input error state. User identity is taken from the server session, never the form
   (brief contract). On success the input clears and focus returns to it.

3. **Live status line.** A `--muted` dot + "Live" when the subscription is connected (C1). The whole
   list is the live region (I4).

4. **Draft list** — list rows (`components.md` 3.2): title serif 16/600 one line (truncate), second
   line mono 11.5 "Saved Sat 24 Oct · 2 min ago" `--muted` (P-2), right slot a 44 px row-menu icon
   button (`aria-label` "Draft actions") opening a popover (`components.md` 5.2) with **Rename** and
   **Delete**. Row hover `--surface-2`; selected (keyboard) `--surface-2` + ring.
   - **Rename** turns the title into the text input in place (same 1–160 rule), Enter saves, Esc
     cancels, focus returns to the row.
   - **Delete** is danger-confirmed and undoable (C2): confirm, then toast with Undo.

5. **List states** (all required by the brief):
   - **Loading**: skeleton rows (`components.md` 6.2) — glyph disc + bar, shimmer off under reduced
     motion, 200 ms cross-fade to content; never a spinner for the region.
   - **Empty**: empty state (`components.md` 6.1) — a draft glyph on a `--well` disc, "No drafts
     yet.", one line "Create your first draft above.", no second action. Never "No data".
   - **Reconnecting**: an `--info` notice banner (`components.md` 5.4) "Reconnecting to live
     updates…" above the list; the last-known rows stay visible (do not blank the list).
   - **Error**: inline error in place of the list (`components.md` 6.3) — triangle, "We couldn't
     load your drafts. Try again.", **Retry** button; any cached rows stay under it.

### Motion (P5)

A live insert from the same user's second session rises and fades in over 200 ms (toast-enter
easing) with a brief `--surface-2` highlight that settles to `--surface`; a live rename cross-fades
the title; a delete collapses the row height over 160 ms. Reduced motion: all of these jump, keeping
the same before/after state and the same live-region announcement.

### Accessibility summary

Labels above with `aria-describedby` for help and error; required mark is the dot, not an asterisk;
focus ring from `tokens.md` 8; list is `aria-live="polite"` (I4); row menus and the avatar menu are
real menus that return focus to their opener on Esc; Undo reachable by Tab; all targets 44 px;
contrast pairs listed below.

---

## Contrast pairs approved (all AA or better)

| Pair | Where | Light | Dark |
|---|---|---|---|
| `--accent-ink` on `--accent` | primary button fill | 6.96:1 AA | 6.96:1 AA |
| `--accent-ink` on `--accent-hover` | primary button hover | 5.96:1 AA | 5.96:1 AA |
| `--ink` on `--surface` | Sign out / row title | 16.06:1 AAA | 13.83:1 AAA |
| `--ink-2` on `--surface` | body copy | 12.09:1 AAA | 10.76:1 AAA |
| `--muted` on `--surface` | labels, timestamps, "Live" | 6.94:1 AA | 7.45:1 AAA |
| `--crit` on `--surface` | field error text | 6.61:1 AA | 7.01:1 AAA |
| `--crit` on `--crit-soft` | wrong-credentials banner | 5.45:1 AA | 6.36:1 AA |
| `--on-crit-fill` on `--crit-fill` | delete confirm button | 5.70:1 AA | 5.70:1 AA |
| `--info` on `--info-soft` | reconnecting banner | 5.91:1 AA | 7.61:1 AAA |
| `--info` on `--surface` | reconnecting icon/text on page | 7.16:1 AAA | 8.26:1 AAA |
| `--line-2` on `--surface` (non-text UI, ≥3:1) | input / row border | 3.67:1 | 3.42:1 |

Connected status uses `--muted` text and dot only; no green and no `--ok` (C1). Amber appears only on
the one primary action per view (`changes-from-preview.md` 1), never on status at rest.

---

## What the build must not do

- No new colour, no green, no amber for status (C1; owner rule, `product-direction`).
- No planner header, Home tab, trip chip or bell (I2); no new planner routes.
- No public page gated behind the account; `/trips`, `/places`, `/globe` stay no-login.
- No client-side bulk load; the draft list is a per-user live subscription through the one data
  boundary (P8/P9).
- No hard-coded private data to make the demo pass; identity always from the server session.

---

## Post-implementation review — ship/hold

Reviewer: Fable (design foundation owner). Model: **Opus**. Date: 24 Oct 2026. No other agents
launched; no code or app changes made; this file is the only edit.

Scope: the built account path in the worktree — `web/app/sign-in/`, `web/app/sign-up/`,
`web/app/account/` (`page.tsx`, `AccountDrafts.tsx`, `SignOutButton.tsx`), `web/app/account.css`,
`web/components/auth/AuthForm.tsx`, `web/components/shell/AccountNav.tsx` — against the approved
design above and the Trailhead foundation. Grounded in render: the twelve shots in
`web/test-results/shots/{sign-in,sign-up,account-signed-in}-{1440x900,390x844}-{light,dark}.png`,
read at 2x, 1440 and 390, light and dark (dark via the site's own toggle — confirmed in the shots).
No server was live on :3000, so I read the committed renders plus the source for the states the
error shot does not exercise. The signed-in account shots show the **service-error state** because
the Realtime/Postgres tables are still being wired in app lane `b095e1b1`; per the brief I do **not**
treat that missing-table render as the final account UI, only as the error branch, and the error
branch itself renders correctly.

### Decision: **SHIP.** No blockers in the bounded service path.

Every ruling from the approved design is implemented and renders correctly. No new colour, no green,
no amber-at-rest, no planner nav. Contrast pairs are unchanged from the approved table and all pass
AA; the build introduces no new pairs.

### Verified against the approved findings

- **C1 (status never green/amber).** `account.css` `.live-dot { background: var(--muted) }` plus the
  word "Live" in `.draft-status` (`--muted` mono). No `--ok`, no green, no amber. `--muted` on
  `--surface` 6.94:1 light / 7.45:1 dark, AA/AAA. Pass.
- **C2 (destructive confirm + undo; sign-out plain and unloading).** Delete is a two-step inline
  confirm with a **danger** button, then `toast({ actionLabel: 'Undo' })` that re-creates the exact
  row (`AccountDrafts.onDelete`). Sign-out is a **secondary** button (`SignOutButton`, and the header
  menu entry) that calls `signOut()` then `leaveSession()` for a full page change that unloads
  prior-user state. Pass. Per the brief, ordinary sign-out needs no confirmation and draft delete is
  safely confirmed-and-undoable — both satisfied.
- **C3 (fail closed).** `AccountPage` renders `SignedOut` when `capabilities.signIn` is off;
  `AccountBody` awaits `getUser()` and renders `SignedOut` (a sign-in prompt, never a list) when
  there is no session; `export const dynamic = 'force-dynamic'` and `connection()` keep the page off
  the build/cache. Anonymous never sees a draft row. Pass.
- **I1 (wrong credentials vs unreachable service).** `AuthForm.classify()` splits 5xx/0/network
  codes to a **notice** banner ("Sign-in is unavailable right now…") from credential failures to an
  **urgent** banner ("We couldn't sign you in…"). The banner is focused on failure for announcement.
  Pass.
- **I2 (reduced signed-in header).** `AccountNav` renders tabs Trips / Places / Globe unchanged and
  a right cluster of search, theme, then an avatar **menu** with exactly **Account** and **Sign
  out** — no bell, no trip chip, no Home tab. Confirmed in the signed-in shots (avatar disc "E",
  `--ink` on `--surface` with a 1 px `--line-2` keyline, 3.67:1 / 3.42:1 non-text). Pass.
- **I3 (honest verification).** Sign-up success reads "Account created. Sign in to continue." and
  only mentions email verification conditionally; it promises no mail. Pass.
- **I4 (polite live region, announced changes).** An `sr-only aria-live="polite"` region announces
  "Draft '…' added", "Renamed to …", "Draft removed. Undo available." Pass.
- **Title/metadata polish (P-1, P-2, P-3).** "ACCOUNT · N drafts" count in mono (shown only when
  loaded, correctly absent in the error state); `savedLabel` renders mono one-line "Saved … · … ago";
  `.account-page { max-width: 40rem }` holds the reading column. Pass.
- **Motion (P5).** `draft-settle` runs once on row mount (keyed rows do not remount on re-sort) and
  is disabled under `prefers-reduced-motion`. Pass.

### Non-blocking polish (log for the fold-in, do not hold the ship)

1. **Row-actions trigger is a text ellipsis, not an icon.** `AccountDrafts` uses `&hellip;` as the
   menu trigger glyph where the approved spec named a row-menu icon button. It is a 44 px
   `btn-icon` with `aria-label="Draft actions"`, so it is accessible and sized; swap to a kebab/row
   icon when folding the account template into `components.md`. Polish.
2. **Two live regions.** Both the `sr-only` announcer and the `<ul aria-live="polite">` are live.
   The announcer carries the exact phrases; the list being live as well can double-announce on
   re-sort. Drop `aria-live` from the `<ul>` and keep the announcer as the single source. Polish.
3. **"Try again" is a link, not a Button.** The page-level error state (`ErrorState` "We couldn't
   load your drafts.") uses a `Link` where 6.3 named a Retry button. Clear and accessible as built;
   align to the button form in the template fold-in. Polish.
4. **Sign-up "Name" is optional with no help line.** It falls back to the email as the display name
   (`name || email`). Acceptable; add a one-line help ("Optional.") when folding the form into the
   foundation so the missing required dot reads as intentional. Polish.

None of these lose state, mislead a planning or travelling family, or touch colour, so they are
polish, not blockers.

### Foundation fold-in still owed (tracked, not part of this ship)

The approved `/account/` template and the reduced signed-in header variant must still be folded into
`components.md` 1.1 and `patterns.md` (new 4.0 "Account"), keeping `tokens.md`, `tokens.json`,
`components.md`, `patterns.md`, `specimen.html` and `changes-from-preview.md` in step. No token
changes are needed. This is a documentation task after the backend lands, not a ship gate for the
account path.

### Bottom line

Ship the account path. The service-error render in the signed-in shots is the backend-in-progress
branch and is itself correct; re-shoot the loaded list, empty, reconnecting and live-insert states
once `b095e1b1` wires the tables, and confirm the muted "Live" dot and the undo toast against render
before the foundation fold-in.
