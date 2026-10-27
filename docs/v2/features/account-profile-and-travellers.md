# Account: profile, travellers and a page that makes sense

Status: **spec, 27 Oct 2026** (ACCT-P, high priority, owner feedback). Build brief:
[build/public-site/briefs/ACCTP.md](../build/public-site/briefs/ACCTP.md). Backlog 15.348. Owner questions Q-AP1 to Q-AP11
(backlog Q311 to Q321).

## The owner's feedback (27 Oct 2026, intent as given)

> The live Account page is only a "Draft title" box and a "Create draft" button with a "Reconnecting to live updates..."
> banner; it does not save the profile name or any details. I want a proper step-by-step profile where I can save my name
> and a traveller profile, e.g. 2 adults and 2 children with each child's age, saved to my account so the trip party bar,
> the copy sheet and the trip builder prefill from it.

Seen on `https://travel-beta-tan.vercel.app/account/` the same day: the owner typed his **name** into "Draft title",
which created a draft called "Nitin". The page looks like a profile page and is a drafts test screen. The "Reconnecting to
live updates..." banner never went away. On `/mine/` a copy "Canadian Rockies, 14 nights · 2 adults, 1 child" shows
"On this device"; the owner wants copies saved to the account automatically when signed in (TRIP-EDIT-I, a parallel
spec, `docs/v2/features/edit-my-trip.md`). Section 7 keeps the two consistent.

## Relation to other pages

| Page | Relation |
|---|---|
| [navigation-and-mine.md](navigation-and-mine.md) 4.3 | **Amended here.** Account loses the draft create box now, not at NAV-3; Account leads with Profile and Travellers. NAV-3 still moves the full list to Mine |
| [trip-and-places-ux-fixes.md](trip-and-places-ux-fixes.md) 5.2 to 5.5, 10.2, 15 | **Amended here.** The device party (`travel.party`) can now be seeded from the account; one optional field `src` |
| [trip-builder.md](trip-builder.md) 2.4, 7, 15.1 ISO-3 | **Amended here (rule restated, no contract change).** The draft still names `party: "device"`; for a signed-in person the device party is seeded from the account |
| [google-and-apple-sign-in.md](google-and-apple-sign-in.md) 5.3, 6.1, strings 29 to 51 | Ways to sign in is GSI-WAYS's section on this page; this spec places it and does not reword it. Name row of 6.1: editable now |
| [F01-household-and-profiles.md](F01-household-and-profiles.md) | This is the v1 slice of F01 people: counts and children's birth month and year, no names. F01's `household` and `person` tables (0002) stay unused; section 9.4 says how this row moves there later |
| [F17-accounts-auth-and-privacy.md](F17-accounts-auth-and-privacy.md) rule 12, 15, 16 | **Amended here.** A new private data class "travellers"; export and delete gain it |
| [trip-kinds-and-interest-profile.md](trip-kinds-and-interest-profile.md) 3.5, 3.6 | The interest profile stays its own document (`account_interests`, bundle F). Party and interests stay separate. The Account page gets a slot for it later (section 3.1) |
| `edit-my-trip.md` (TRIP-EDIT-I, in progress) | A synced copy's party is a snapshot that starts from Travellers (section 7) |

## 0. The decision in one paragraph

`/account/` becomes the person's settings page, in this order: **Profile** (display name), **Travellers** (adults and
children), **Ways to sign in** (GSI-WAYS), **Saved trips**, **Your data**. A new signed-in person with nothing saved sees
a two-step setup first: name, then travellers; both skippable. Travellers are stored in Neon as **a count of adults and
each child's birth month and year**, with no names, in one owner-only row per user (`account_profile`, migration slug
`account_profile`, number 0012 if it merges next). The account is the standing default; **the device party stays the one
thing every page reads**. The account seeds the device party at sign-in and on Account, so the trip party bar, the copy
sheet and the trip builder prefill with no change to their code and no new load on public pages. The name is written
through Neon's `update-user` from a **server action**, so the browser auth proxy keeps answering 404 for that route. The
"Draft title" box goes; drafts are made from a trip or the builder. Realtime leaves the Account page, so the stuck banner
goes with it.

## Decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| AD1 | **Children as birth month and year** (`"2019-03"`), not an age and not a full date | An age goes stale (entered in October, wrong by spring); a birth year alone is off by one for most of the year, which matters for age limits ("6+") (T4). Month and year give the exact age at any date to within a month, with no day of birth | More precise than an age. Mitigated: no name, no day, owner-only row, never in output (AD5). Q-AP1 |
| AD2 | **No traveller names and no adult ages in v1** | Nothing reads them: suitability, the scheduler and the party bar use the adult count and children's ages only (`core/src/trips/party.ts`). Data we do not use we do not keep | F01's "Kai's passport" checks need names later; they come with F01 people, by explicit entry. Q-AP2 |
| AD3 | **Opt-in by an explicit Save with the wording beside it; no checkbox** | Filling the form and pressing "Save travellers" under a sentence that says what is stored is an unambiguous choice; a checkbox adds a tap and a reading task (P4). The time of the first save is kept (`travellers_consented_at`) | A regulator could prefer a separate tick for data about minors. If the owner wants it, it is one checkbox. Q-AP3 |
| AD4 | **The account seeds the device; the device never writes back silently** | Every reader (party bar, copy sheet, builder) already reads `travel.party`; the trip page has about 460 B of start-JS headroom and cannot load account code (P9, MASTER-ORDER 4.5). A party tweak on one trip ("grandma joins") is not a change to the household | A party changed on a trip page is not saved to the account until the person says so on Account (section 5.3). Q-AP4 |
| AD5 | **Travellers never leave the person's own requests**: no public output, URL, log, analytics, export to others, MCP or feedback report | Same rule as the device party (trip-and-places 15, trip-builder 7). The privacy detector gains the new field names | none |
| AD6 | **Name through Neon `update-user`, called server-side only** | One name, in `neon_auth.user.name`, which the header avatar and Account already read. The server SDK sends only `{ name }`; the browser proxy allow-list stays closed (guard MF3) | Depends on the server SDK forwarding the session cookie in a server action; a 1 h spike (ACCT-PS) proves it before the build. Fallback in 4.3. Q-AP5 |
| AD7 | **No Realtime on Account** | Profile and travellers change on one device at a time; the drafts list does not need live updates on this page; Realtime is experimental and its status line was stuck in production (section 8) | A rename on a phone shows on the laptop after a focus or reload, not live. Favourites already work this way (R-71). Q-AP6 |
| AD8 | **One row per user, typed by Zod, no Realtime signal** | One read per page; the row is small (under 1 KB); the same owner-predicate RLS as `planner_draft` | A household of two adults with two accounts keeps two rows (F01 households come later) |
| AD9 | **Remove the create-draft box; keep the user's existing rows** | A title-only draft has nothing to open. Drafts are made by "Copy to my trips" when signed in (TRIP-EDIT-I, CUS-C) and by the builder (`plan_draft`, TB-SY). User rows are never deleted by a migration | The owner deletes the "Nitin" test draft himself (one click). Q-AP7 |

## 1. User stories

| # | As | I want | So that | Principle |
|---|---|---|---|---|
| U1 | a new signed-in person | the page to ask my name and who travels with me, one step at a time, with Skip | I am set up in under a minute without reading anything | P4, P7 |
| U2 | a parent | to save 2 adults and 2 children once, with each child's birth month and year | every trip, copy and plan starts with the right ages on any device, and the ages stay right next year | T4, P6 |
| U3 | a parent | to see in one line what is saved ("2 adults · 2 children (6, 9)") and change it in one click | I never wonder what the site thinks my family is | P3 |
| U4 | anyone | to change my display name | the menu and the page greet me correctly | P4 |
| U5 | a careful parent | to see exactly what is stored, download it and remove it | I trust the site with my children's ages | T4, F17 |
| U6 | a person who changed the party on a trip page | to be offered, once, to save it as my standing party, or to put my saved one back | the two never disagree silently | P6 |
| U7 | anyone on Account | no stuck "Reconnecting" message | the page does not look broken | P4 |

## 2. The page

### 2.1 Order and what each section answers

| # | Section | Answers, at rest (P3) | One click opens |
|---|---|---|---|
| 0 | Header | "Account", "Signed in as nitin27may@gmail.com", Sign out | |
| 0a | GSI-2 notice (new account or Google just linked) | unchanged (GSI-2) | Continue to the page it came from |
| 1 | **Set up your account** (first run only, 2.3) | the step you are on | |
| 2 | **Profile** | Name: "Nitin" or "Not set" | inline name editor |
| 3 | **Travellers** | "2 adults · 2 children (6, 9)" or "None saved" | inline travellers editor |
| 4 | **Ways to sign in** | GSI-WAYS's list (Email and password, Google) | GSI-WAYS's actions |
| 5 | **Saved trips** | count and up to 5 newest rows | rename, delete; "See all in Mine" after NAV-3 |
| 6 | **Your data** | "Download my data", "Delete my account" (by email until F17 16) | |

While the setup card is showing, sections 2 and 3 are not shown (the card is them); 4 to 6 are shown below it. After
setup is finished or skipped, the card is gone for good on every device (`setup_done_at` on the row).

Later slots (not in this build): "Your interests" between 3 and 4 (trip-kinds 3.5, bundle F); "Connected apps" after 4
(R-152).

### 2.2 Layout

| Width | Layout |
|---|---|
| 1440 desktop | The existing reading column (`.account-page`, 40rem), left-aligned in the page grid. Each section is a `<section>` with an `h2` in the section style, a hairline above, `--s-6` between sections. The summary row is two columns: label and value on the left, the Edit button on the right. Editors open in place under the summary row (P5: the row grows, the page does not jump; focus moves to the first field) |
| 390 phone | One column, full width with the page gutter. Summary row stacks: label, value, then Edit as a full-width secondary button. In the setup card, Continue and Skip sit in a sticky action bar at the bottom of the viewport (thumb reach, S8); the bar clears the safe-area inset. Every target at least 44 by 44 px |
| 320 | As 390; the children's month and year selects stack under "Child 1" instead of side by side |

Components, all from the foundation: Field, Input, Select (2.3), Stepper (2.12), Button (2.1), Banner (5.4), Toast with
Undo (5.3), EmptyState (6.1), ErrorState (6.3), Menu (5.2), RowSkeleton (6.2). No new component. One new CSS block in
`web/app/account.css` (classes `acct-`); colour only from `themes.css` tokens.

### 2.3 First run: the setup card

Shown when the row has no `setup_done_at`. That is every account today, so on first deploy every existing person sees it
once; the owner sees it with the name prefilled only if Google gave one.

```
+--------------------------------------------------+
| SET UP YOUR ACCOUNT                 Step 1 of 2  |
| Two short steps. You can change both later.      |
|                                                  |
| What should we call you?                         |
| Your name  [ Nitin                     ]         |
| Shown only to you, here and in the menu.         |
|                                                  |
| [ Continue ]  Skip                               |
+--------------------------------------------------+

+--------------------------------------------------+
| SET UP YOUR ACCOUNT                 Step 2 of 2  |
| Who usually travels with you?                    |
| Trips, copies and the trip builder start from    |
| this. You can still change it on any trip.       |
|                                                  |
| Adults      [-] 2 [+]                            |
| Children    [-] 2 [+]                            |
| Child 1   Born [ Mar v ] [ 2019 v ]   7 now      |
| Child 2   Born [ Month v ] [ 2017 v ]            |
|                                                  |
| We save the number of adults and each child's    |
| birth month and year. No names. Only you can see |
| it, and you can remove it at any time.           |
|                                                  |
| [ Save travellers ]  Skip for now    < Back      |
+--------------------------------------------------+

+--------------------------------------------------+
| ALL SET                                          |
| Trips now plan for 2 adults and 2 children       |
| (7, 9) wherever you sign in.                     |
| [ Browse trips ]  Close                          |
+--------------------------------------------------+
```

Rules:

1. Step 1 prefills from `user.name` (Google gives one; email sign-ups have `''`, rule E8). Continue with an unchanged
   prefilled name saves nothing and moves on. Continue is enabled only when the field is valid (4.2). Skip moves on.
2. Step 2 prefills from the device party when there is one: the adult count, and for each child a **year** of
   `thisYear - age` with the month empty. A line under the heading says "Filled in from this browser: 2 adults, 2
   children (6, 9). Choose each child's birth month to save." With no device party: 2 adults, 0 children
   (`DEFAULT_PARTY`).
3. Save travellers is enabled when every child has a month and a year. A child with no year or month shows the field's
   error only after Save is pressed (P4: no red before the person acts).
4. Save writes the row, writes the device party (5.2), and shows the done state. Skip for now sets `setup_done_at`
   without travellers and closes the card. Back returns to step 1 with the name kept.
5. The step lives in the URL (`?setup=name`, `?setup=travellers`, `?setup=done`) with `replace` between steps, so a
   reload keeps the step and Back leaves the page rather than walking steps (P5).
6. Close on the done state, Skip on step 2 and Save all set `setup_done_at`. Nothing else does: leaving the page mid-way
   shows the card again next time.
7. The GSI-2 notice for a new account sits above the card. Its Continue still leaves the page at once; the card waits.
8. Focus: on each step change, focus moves to the step's heading (`tabIndex=-1`); the step counter is announced
   ("Step 2 of 2: Who usually travels with you?") through the page's polite live region.

### 2.4 Settled state

**Profile.** Row "Name" with the value or "Not set" (muted). Edit opens the name field in place with Save and Cancel;
Escape cancels. Saved: the row shows the new value, toast "Name saved." and the header initial updates on the next
navigation (4.3 gotcha).

**Travellers.** Row with the party line from `partyText` (`core/src/trips/partyWords.ts`, the same words as the party
bar, "under 1" for a baby per UXB-2 M1) and a muted second line "Ages today. Trips use these, and you can change the
party on any trip." Edit opens the editor of 2.3 step 2 in place, with Save travellers and Cancel. A Menu "More" on the
row holds "Remove saved travellers" (destructive, separator). Remove asks in place: "Remove your saved travellers? This
browser keeps its party until you change it." with Remove and Cancel; then a toast "Travellers removed." with Undo
(re-saves the same document).

Empty: "No travellers saved." Why: "Add who usually travels with you, and every trip starts from it." Action: "Add
travellers".

**Notices on the Travellers section** (each a Banner `notice` inside the section, never page-wide):

| When | Text | Actions |
|---|---|---|
| The device party differs from the saved one (5.3) | "This browser plans for 1 adult and 1 child (4). Your saved travellers: 2 adults and 2 children (7, 9)." | "Use saved travellers here" (primary), "Save this browser's party" (opens the editor prefilled from the device; months required), Dismiss (until either changes) |
| A saved child is 18 or older | "Child 2 is now 18. Count them as an adult?" | "Move to adults" (adults + 1, child removed, saved), "Keep as a child" (plans as 17, the party's cap) |
| Storage blocked on this browser | "Saved to your account. This browser can't keep a copy, so trip pages here use the trip as written." | none |
| Saved on another device since this page loaded (revision conflict, 6.3) | "Your travellers were changed on another device." | "Show the latest" |

**Saved trips.** Section 6.

**Your data.** "Download my data" (a JSON file, 6.5) and "Delete my account: email
nitin27may@gmail.com" with today's privacy wording until F17's delete button ships.

### 2.5 Errors and loading

| State | What shows |
|---|---|
| Page loading | Header, then three RowSkeletons per section (the existing Suspense fallback, extended) |
| Profile row cannot be read | Profile and Travellers show one ErrorState: "We couldn't load your profile." Detail: "The service may be briefly unavailable." Link "Try again". The setup card is not shown (fail closed: never ask a set-up person again because a read failed). Ways to sign in and Saved trips render on their own |
| Save fails (service) | A Banner inside the editor: "We couldn't save. Your changes are still here; try again." The form keeps its values |
| Session lost | `leaveSession()` as today |
| Name too long or invalid | Field error (4.2 strings) |
| Rate limited (name) | Field error: "Too many changes. Try again in a few minutes." |

### 2.6 Accessibility

- One `h1`; each section an `h2`; the setup card's step heading an `h2` inside a `<section aria-labelledby>`.
- Travellers editor: a `<fieldset>` with legend "Who usually travels with you?"; each child a nested `<fieldset>` with
  legend "Child 1"; month and year are native selects with visible labels "Birth month" and "Birth year" (the visual
  "Born" is the group label); the derived age ("7 now") is plain text tied by `aria-describedby` to the year select.
- Adding a child moves focus to its month select (the Travellers.tsx pattern). Removing the last child returns focus to
  the Children stepper.
- Errors use `aria-invalid` and `aria-describedby`; a failed Save moves focus to the first invalid field.
- Every target at least 44 px at 390; visible focus ring from the foundation; axe clean (`wcag2a`, `wcag2aa`,
  `wcag21aa`, `wcag22aa`) on every state at 320, 390 and 1440 in light and dark.
- Reduced motion: editors open without the height transition.

### 2.7 Copy (every string)

| ID | Where | String |
|---|---|---|
| AP-1 | metadata description | Your account settings. |
| AP-2 | setup title | Set up your account |
| AP-3 | setup counter | Step {n} of 2 |
| AP-4 | setup sub | Two short steps. You can change both later. |
| AP-5 | step 1 heading | What should we call you? |
| AP-6 | name label | Your name |
| AP-7 | name help | Shown only to you, here and in the menu. |
| AP-8 | buttons | Continue · Skip · Back |
| AP-9 | step 2 heading | Who usually travels with you? |
| AP-10 | step 2 sub | Trips, copies and the trip builder start from this. You can still change it on any trip. |
| AP-11 | prefill line | Filled in from this browser: {party}. Choose each child's birth month to save. |
| AP-12 | steppers | Adults · Children (dec/inc labels "Fewer adults", "More adults", "Fewer children", "More children") |
| AP-13 | child group | Child {n} · Born · Birth month · Birth year · Month (placeholder) · Year (placeholder) |
| AP-14 | derived age | {n} now · Under 1 |
| AP-15 | privacy line | We save the number of adults and each child's birth month and year. No names. Only you can see it, and you can remove it at any time. |
| AP-16 | step 2 buttons | Save travellers · Skip for now |
| AP-17 | done | All set · Trips now plan for {party} wherever you sign in. · Browse trips · Close |
| AP-18 | done, skipped travellers | All set · You can add travellers here at any time. |
| AP-19 | sections | Profile · Travellers · Ways to sign in · Saved trips · Your data |
| AP-20 | name row | Name · Not set · Edit · Save · Cancel |
| AP-21 | name errors | Keep it under 60 characters. · Use letters, numbers, spaces and simple punctuation. · Too many changes. Try again in a few minutes. |
| AP-22 | name toast | Name saved. |
| AP-23 | travellers row second line | Ages today. Trips use these, and you can change the party on any trip. |
| AP-24 | travellers empty | No travellers saved. · Add who usually travels with you, and every trip starts from it. · Add travellers |
| AP-25 | child error | Choose the month and year. · A child is 17 or younger. Count older travellers as adults. |
| AP-26 | remove | More · Remove saved travellers · Remove your saved travellers? This browser keeps its party until you change it. · Remove · Cancel · Travellers removed. · Undo |
| AP-27 | notices | as the table in 2.4 |
| AP-28 | save error | We couldn't save. Your changes are still here; try again. |
| AP-29 | load error | We couldn't load your profile. · The service may be briefly unavailable. · Try again |
| AP-30 | saved trips | Saved trips · {n} · No saved trips yet. · Trips you copy or build while signed in are saved here. · Browse trips · See all in Mine |
| AP-31 | your data | Your data · Download my data · To delete your account, email {address}. |
| AP-32 | sign-out toast (5.4) | Signed out. Your travellers are saved in your account. |

## 3. Slots and later sections

### 3.1 What the Account page will hold later

Interests (trip-kinds 3.5), connected apps and MCP access (R-152), notification settings (F17 18), units if they move
off the footer. Each is a new `<section>` in the order of 2.1; none needs a layout change.

## 4. Display name

### 4.1 Where it lives and who reads it

`neon_auth.user.name` (Neon-managed). Read today by the header avatar initial (`AccountMenu.tsx`) and by `getUser()`
(`SessionUser.name`). After this work, also by the Account Profile row. Never in public output, logs, analytics or
emails we send (we send none).

### 4.2 Rules

- Trim, NFC-normalise, collapse runs of spaces. 1 to 60 characters after that, or empty to clear it.
- Letters and marks of any script, digits, spaces, and `' - . ,`. No control characters, no `<`, `>`, `@`, `/`, `:`
  (no addresses, no links, no markup in a string that a future email might print).
- A quota of 10 changes per hour per user through the existing `quota_take` (bucket `profile_name`, key the HMAC of the
  user id under `AUTH_QUOTA_SECRET` mixed with the UTC day, as `core/src/quota/keys.ts`).

### 4.3 How it is written, and the security notes

**Recommended (AD6):** a server action `saveName` in `web/app/account/actions.ts`:

1. `getUser(pageUserId)`; none: `UNAUTHENTICATED`.
2. Validate (4.2); invalid: `INVALID_INPUT`.
3. `quota_take`; over: `RATE_LIMITED`.
4. `getAuth().updateUser({ name })` from `@neondatabase/auth/next/server` (the SDK maps it to `POST update-user` with the
   request's session cookie). Only `name` is ever passed: never `image` or any other field.
5. Log one line with a fixed code (`profile_name_saved` or the error code), never the name.

Why not open `update-user` in the browser proxy (`web/lib/auth/guard.ts`):

- The proxy allow-list (review MF3) answers 404 for every route the card does not call. `update-user` accepts `name`,
  `image` and any additional user field the Neon project enables; a browser entry would need its own body rebuild,
  origin check, session check and quota, which is a second copy of what the server action gives for free.
- A server action is POST-only, same-origin by Next's action ID and origin check, and runs `getUser()` itself.
- Keeping the route closed keeps the guard file unchanged, which is a hot spot (GSI-1, GSI-SEC, EML).

**Known and accepted:** Neon's Auth base URL is public, so a signed-in person can call `update-user` directly with their
own cookie and set any name or an `image` URL on their own record. It changes only their own row; we never read `image`
(GSI-1 test) and the name is re-validated before it is rendered (React escapes it; length is cut at 60 on read).

**Spike first (ACCT-PS, 1 h):** on the child branch, prove (a) `updateUser` from a server action changes the name;
(b) whether the SDK's session-data cookie (about 5 minutes) then serves the old name; (c) that a call with `image` is
not made by our code. If (a) fails, the **fallback** is a guarded proxy route: `ROUTES['update-user'] = { kind:
'profile', fields: ['name'] }`, POST only, origin required, a session required (`get-session` first), the same quota, no
Turnstile, and a guard test for each refusal; the GSI-SEC reviewer signs it off. If (b) shows a stale name, the page
shows the saved value from the action's answer and the header initial catches up on the next session refresh (written
as a gotcha, not fixed).

**ACCT-PS result (27 Oct 2026, Sonnet 5.5): works; the fallback is not needed.** Run on the Neon child branch
`br-damp-breeze-b41mtvn5` only, on `next dev` with the real `getAuth()` (the SDK as in `web/lib/auth/server.ts`) and a
throwaway route handler (not committed), against a synthetic `@travel-e2e.invalid` user (deleted afterwards; the branch
holds 0 users). Evidence: [research/runs/ACCT-PS-spike.md](../../../research/runs/ACCT-PS-spike.md); call shape pinned by
`web/tests/auth/update-user-shape.test.ts`.

- (a) `getAuth().updateUser({ name })` in a Next request answered `{ data: { status: true }, error: null }` in 163 ms
  (the answer carries no user, so the action returns the name it validated), while `POST /api/auth/update-user/` through
  the browser proxy with the same signed-in cookie still answered 404. Neon's own `get-session` (session token only)
  then returned the new name.
- (b) The SDK rewrites both cookies in the same response (`__Secure-neon-auth.local.session_data`, 299 s, and
  `session_token`), so the next request from that browser reads the new name. Inside the same request `getSession()`
  still returns the old name (it reads the cached cookie), and a second device or an unrefreshed cookie keeps the old
  name for up to 299 s. So the action must return the saved name itself and must not re-read the session to show it.
- (c) Our code passes exactly `{ name }` (unit test, `toStrictEqual`).

## 5. Travellers

### 5.1 The document

```ts
// core/src/account/travellers.ts (ACCT-PC; Zod; validated on every read and write)
interface Travellers {
  schema: "travellers/1";
  adults: number;                       // 1..12 (PARTY_MIN_ADULTS..PARTY_MAX_ADULTS)
  children: { born: string }[];         // max 8 (PARTY_MAX_CHILDREN); born "YYYY-MM", age 0..17 on the day it is saved
}
```

- `born` matches `^(19|20)\d{2}-(0[1-9]|1[0-2])$`, is not in the future, and is at most 17 years and 11 months before
  the save date. On read, an older child is kept and flagged (the turned-18 notice).
- Order is the order entered. No ids, no names, no labels.
- Functions: `parseTravellers(x)`, `ageOn(born, date)` (whole years, the birthday taken as the 1st of the month),
  `partyOf(t, date): Party` (ages clamped to 0..17), `travellersFromParty(p, date)` (years only, months empty: the
  editor's prefill, never saved as is), `sameAsParty(t, p, date)`.
- `ageOn` is the one age rule. The trip pages keep reading plain ages from `travel.party`; they never see `born`.

### 5.2 Account to device

The device party (`travel.party`, `{ v: 1, adults, children }`) gains one optional field, `src: "account"`, written only
by the account seed. `v` stays 1: `cleanParty` ignores unknown keys, and an old reader keeps working. Any write by the
party editor or the copy sheet drops `src` (the party becomes this browser's own).

| When | Device has | Result |
|---|---|---|
| Account page loads (signed in, row has travellers) | nothing | write `partyOf(travellers, today)` with `src: "account"`, silently |
| | the same party | rewrite with `src: "account"` (no visible change) |
| | a different party | leave it; show the "differs" notice (2.4) |
| Save travellers on Account | anything | write the new party with `src: "account"` (the person just chose it) |
| Remove saved travellers | `src: "account"` | drop `src`; keep the party (the person may be mid-trip on this browser) |
| Email, password or code sign-in succeeds (the card, before it navigates) | nothing | one POST to `/api/account/profile/party/`; on a party, write it with `src: "account"` |
| | a party | nothing (the notice waits on Account) |
| Google sign-in, returning | | nothing until the next Account or Mine visit (gotcha; Q-AP9) |
| Mine loads, signed in | nothing | same as Account, through the same module |
| Age rollover (a child's birthday passes) | `src: "account"` | the next Account or Mine visit or sign-in rewrites the ages; a trip page in between uses the ages from the last seed (at most a month or so stale; P6 accepts) |

The seed module `web/lib/account/seed-party.ts` is imported only by `/account/`, `/mine/` and the sign-in card's success
path (dynamic import after success). No public page loads it (the N9 rule of navigation-and-mine).

`/api/account/profile/party/` answers `{ adults, children: number[] }` (ages today, never `born`), `Cache-Control:
private, no-store`, POST with `sameOrigin()` and `{ userId }`, like `/api/account/drafts/`.

### 5.3 Device to account

Never automatic. On Account, when the device party differs and has no `src`, the notice offers "Save this browser's
party", which opens the editor prefilled (years from ages, months empty) and saves only on Save travellers.

Why not write back from the trip page: a one-off change for one trip is common (a friend joins, a child stays home) and
is not a change to who usually travels; and the trip page cannot carry account code (AD4).

### 5.4 Sign-out

Sign-out removes `travel.party` when it has `src: "account"` (V12: a shared computer shows nothing of the previous
person) and keeps a party without `src` (the browser's own, from before sign-in). Toast AP-32. This runs in
`SignOutButton` and the header menu's sign-out, before `leaveSession()`.

### 5.5 The trip builder's "party from device only" rule, restated

trip-builder 2.4, 7 and ISO-3 say the draft names `party: "device"` and the build reads the device party at build time.
**This stays exactly as written, and it is now also how a signed-in person's saved travellers reach the builder**: the
account seeds `travel.party`, the builder reads `readParty()`, the POST body carries ages, the draft never stores the
party. Reasons:

1. The builder stays isolated (ISO-3, ISO-6): it reads no account table and no new key; G3 in 15.4 still passes.
2. A synced `plan_draft` (TB-SY) carries no children's data, so the drafts table never becomes a second store of minors'
   ages.
3. The build route stays stateless and per request: it never looks a person up.

No new enum value (`party: "account"`) is added to `plan-draft/1`. If a later builder wants "plan for my saved
travellers even on a browser with another party", that is a `plan-draft/2` question for the TB owner, not this work.

## 6. Saved trips, the create box and Realtime

### 6.1 What goes

- The "Draft title" field and "Create draft" button (`AccountDrafts.tsx` form). The `createDraft` action stays: Undo of a
  delete uses it.
- The live subscription (`RealtimeRoot`, `useLiveQuery`, `/api/account/live-query/` from this page), the "Live" dot and
  the "Reconnecting to live updates..." banner.

### 6.2 What Saved trips shows

`planner_draft` rows, newest first, at most 5, with the existing row (title, "Saved Tue 27 Oct · 1 min ago"), menu
Rename and Delete with Undo. A sixth row or more shows "{n} more" which expands the list in place (no pagination at this
size; P1 caps: NAV-D's 50). After NAV-3, the section shows the 5 newest and "See all in Mine", and editing moves there.

Rows refresh after each own write (the server action returns; the page re-reads through `/api/account/drafts/`) and on
window focus. No live stream.

### 6.3 Where drafts come from

| Source | When | Table |
|---|---|---|
| "Copy to my trips" while signed in | TRIP-EDIT-I / CUS-C | `planner_draft` (doc `trip-custom/1`) |
| The trip builder while signed in | TB-SY | `plan_draft` (its own table, ISO-6) |
| Copies made on this browser before sign-in | the sign-in merge (NAV-3) | `planner_draft` |

Until one of those ships, Saved trips is empty for a new person, and AP-30's empty state says so honestly.

### 6.4 The existing test drafts

Title-only rows made with the old box (the owner's "Nitin" draft among them) stay. They show as rows with Rename and
Delete; there is nothing to open. No migration deletes user rows. The owner deletes his own (Q-AP7).

### 6.5 Download my data

`GET /api/account/export/` (session required, `private, no-store`, `Content-Disposition: attachment;
filename="travel-account.json"`): `{ exportedAt, email, name, travellers (travellers/1 or null), travellersSavedAt,
drafts: [{ id, title, createdAt, updatedAt }] }`. GSI-WAYS adds its ways-to-sign-in list when it ships (google spec
6.4). This is the first piece of F17 15; the full zip stays F17's.

### 6.6 The Revision guard

Each save sends the `revision` it loaded. The update is `where user_id = $1 and revision = $2`; zero rows means another
device saved first: the action answers `CONFLICT`, the page shows the conflict notice (2.4) and keeps the form.

## 7. Trip copies and their party (consistency with TRIP-EDIT-I)

A copy (`copies/1` on the device, `trip-custom/1` `travellers` on the account) already stores `adults` and
`children: number[]` (navigation-and-mine 3.1, 4.2 rule 2). Rules for this spec and TRIP-EDIT-I:

1. **A copy's party is a snapshot, not a link.** It starts from the device party (which the account seeds), so a new
   copy made while signed in starts from Travellers. Editing Travellers later does not change existing copies: a trip
   planned for a 6-year-old in 2027 stays planned for a 6-year-old.
2. **A copy stores ages, never birth months.** Ages at the copy's start date when it has one (`ageOn(born, start)`
   when the seed came from the account), else ages today. The birth month exists in one row only.
3. A copy's party may differ from Travellers (a friend joins). The copy row shows its own party ("2 adults, 1 child"),
   as on `/mine/` today.
4. A synced copy offers "Use my travellers" in its party editor to re-apply the saved party (TRIP-EDIT-I owns the
   control).
5. Both stores are named on the privacy page (8.2) and both are in export and delete.

**Possible conflict:** if TRIP-EDIT-I chooses a live link from a copy to the profile, or stores birth months in copies,
rules 1 and 2 conflict. Q-AP8 asks the owner to confirm the snapshot.

## 8. The live-updates banner: what it was and the rule from now on

**What it is.** The Account drafts list subscribed to Neon Realtime (experimental) on the content-free
`planner_draft_signal` table (migration 0010). `AccountDrafts.tsx` showed "Reconnecting to live updates..." whenever the
subscription status was `connecting` or `stale`, including the very first connect. When the subscription never reaches
`live` (Realtime unreachable, the URL env missing, a sealed query refused, or a long-poll held by the network), the
status stays `connecting` and the banner stays forever. That is what the owner saw.

**Now.** Account has no live stream (AD7), so no live status at all.

**The rule for any live list elsewhere (Mine after NAV-3, or a later page):**

1. Nothing shows while connecting for the first 5 seconds.
2. Still not live after 5 s: one quiet status line under the list heading, not a banner: "Live updates are off. Your
   changes still save; reload to see changes made elsewhere." No spinner, no "Reconnecting" loop.
3. `error`: the same line plus a Reload button.
4. Back to `live`: the line goes; no toast.
5. A page never depends on the stream to show its own writes: each write re-reads through the authenticated route.

ACCT-P1 records in its hand-back why production stayed in `connecting` (env `NEON_REALTIME_URL` set on Vercel
production or not, browser console status), so NAV-3 starts from a known cause.

## 9. Data model and migration

### 9.1 Table

```sql
-- migration slug account_profile (MIG-N: number at merge; 0012 if it merges next)
create table account_profile (
  user_id text primary key,                              -- Better Auth user id, from the session only
  travellers jsonb,                                      -- travellers/1 or null
  travellers_consented_at timestamptz,                   -- first save with the AP-15 wording on screen
  setup_done_at timestamptz,                             -- the setup card is finished or skipped
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profile_travellers check (
    travellers is null or (
      jsonb_typeof(travellers) = 'object'
      and travellers->>'schema' = 'travellers/1'
      and (travellers->>'adults')::int between 1 and 12
      and jsonb_typeof(travellers->'children') = 'array'
      and jsonb_array_length(travellers->'children') <= 8
      and pg_column_size(travellers) <= 1024)));

-- updated_at and revision on every update (the planner_draft_touch pattern)
create or replace function account_profile_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end $$;
create trigger account_profile_touch_t before update on account_profile
  for each row execute function account_profile_touch();

alter table account_profile enable row level security;
create policy account_profile_select on account_profile for select using (user_id = app_current_user_id());
create policy account_profile_insert on account_profile for insert with check (user_id = app_current_user_id());
create policy account_profile_update on account_profile for update
  using (user_id = app_current_user_id()) with check (user_id = app_current_user_id());
create policy account_profile_delete on account_profile for delete using (user_id = app_current_user_id());

revoke all on account_profile from public;
grant select, insert, update, delete on account_profile to travel_app;
-- No Realtime signal, no SECURITY DEFINER function, no foreign key into neon_auth (Neon owns that schema).
```

Writes go through `withUserTransaction` (`core/src/db/tx.ts`), so `app.user_id` comes from the verified session and RLS
applies under the non-owner `travel_app` role. `core/src/db/profile.ts` holds `loadProfile`, `saveTravellers(userId,
doc, revision)`, `removeTravellers`, `finishSetup`, each an upsert or update with `user_id` from the session.

### 9.2 Tests (on the Docker database and the child branch)

RLS: user A cannot select, insert, update or delete B's row (four cases, as `planner_draft`); an unset `app.user_id` sees
nothing; the check constraint refuses a bad schema, 13 adults, 9 children and a 2 KB document; the revision guard; the
touch trigger. The core DB test list gains `account_profile` in the "every application table has RLS" pin.

### 9.3 Delete and retention

Kept until the person removes it or the account is deleted. The owner's manual account-removal steps (privacy page,
until F17 16) gain `delete from account_profile where user_id = $1`. Encrypted nightly backups (R-145) hold a removed
row until they age out; the privacy page says so in one clause.

### 9.4 Later: F01 households

When F01 builds households, each child in `travellers/1` becomes a `person` row with `birth_year` and a new
`birth_month` column (0002 has `birth_date` and `birth_year`), the adults stay a count until adults are invited, and
`account_profile.travellers` becomes a pointer or is dropped. One migration, written then; nothing here blocks it.

## 10. Privacy

### 10.1 Rules

| Rule | Enforced by |
|---|---|
| Owner-only row | RLS four policies; `user_id` from the session; route and action tests with a forged id |
| Never in public output | the privacy detector (`core/src/privacy/detect.ts`) gains `born`, `travellers/1` and `travellers_consented_at` as forbidden in public payloads and exported pages; a test plants them and fails |
| Never in a URL | the party in links stays `p=` and `a=` (Q296); a test asserts no `born` in any URL the site builds |
| Never in logs | actions and routes log fixed codes only (`safeError`); a log-scan test with a planted birth month |
| Never in analytics | no analytics on `/account/` (GSI 7.1); the beacon sees paths only |
| Never in feedback reports | the feedback detector list gains the same keys |
| Not over the wire more than needed | the party route sends ages, never `born`; the Account page sends `born` only to its own client component |
| Minors' data minimised | month and year only, no names, no day, adults as a count |

### 10.2 The privacy page (`web/app/privacy/PrivacyBody.tsx`)

"Cookies and this device", replace the device sentence with: "Your browser also keeps a few things on this device:
light or dark, km or miles, saved views, trips you copy, and who is travelling (the number of adults and children's
ages). They stay on the device. If you sign in, the travellers you save to your account are copied to this browser and
removed from it when you sign out."

"Accounts", after the first paragraph, a new paragraph: "If you choose to save your travellers, we keep the number of
adults and each child's birth month and year, with no names, so trips plan for the right ages on any device. Only you
can see them. Trips you save to your account keep the party you planned them for (adults and children's ages). You can
change or remove your travellers on your account page at any time, and download everything we hold about you there.
Removed data leaves our backups when they expire."

"Removing your account": "You can delete any saved trip and remove your saved travellers on your account page." Bump
`PRIVACY_CHANGED`.

## 11. Acceptance criteria (feature level)

1. A new signed-in person on `/account/` sees "Set up your account, Step 1 of 2" first; Skip, Skip leaves a settled page
   that never shows the card again on any device.
2. Saving 2 adults and children born 2019-03 and 2017-06 shows "2 adults · 2 children (7, 9)" (on 27 Oct 2026) and the
   row holds exactly `{schema, adults, children:[{born}...]}`.
3. After that save, a trip page on the same browser opens with the party bar on "Your party: 2 adults · 2 children (7,
   9)", the copy sheet's Travellers show both ages, and a builder POST body carries ages `[7, 9]`, with no change to
   trip, copy sheet or builder code.
4. On a second browser, signing in with email lands with the device party set from the account.
5. A trip-page party change followed by a visit to Account shows the "differs" notice; neither side changes until a
   button is pressed.
6. Sign-out removes an account-seeded device party and keeps a browser's own.
7. The name saved on Account shows on Account at once and in the header initial after the next session refresh; the
   browser proxy still answers 404 to `POST /api/auth/update-user`.
8. No "Draft title" field and no live-status text exist on `/account/`.
9. No public page, export, URL, log line or feedback report carries `born` or a child's age from the account (privacy
   tests).
10. User B cannot read or change user A's row (RLS tests on the child branch).
11. Axe clean and 44 px targets at 320, 390 and 1440, light and dark, in every state of 2.3 and 2.4.
12. Every public page's start JS and HTML budget is unchanged (`pnpm --dir web budget:report`).

## 12. Owner questions (Q-AP1 to Q-AP11; backlog Q311 to Q321)

| ID | Question | Recommended answer |
|---|---|---|
| Q-AP1 | Store each child as birth **month and year**, rather than an age (goes stale) or a birth year only (off by one most of the year)? | **Month and year.** Exact ages for age limits all year; no day, no name. Trade-off: one more select per child |
| Q-AP2 | No names for travellers and no adult ages in v1? | **Yes.** Nothing uses them yet; names come with F01 people when passport checks need them |
| Q-AP3 | Consent as the explicit Save with the stored-data sentence beside it, no separate checkbox? | **Yes.** Clear and one tap shorter; the first-save time is recorded. A checkbox is a 15-minute change if you prefer it |
| Q-AP4 | The account seeds the browser's party; a party changed on a trip page is saved to the account only when you choose to on Account? | **Yes.** Keeps one source for every page and zero cost on trip pages. Trade-off: no silent write-back |
| Q-AP5 | Change your name through Neon's update-user from our server, keeping that route closed in the browser proxy (fallback: a guarded proxy route if the spike fails)? | **Yes** |
| Q-AP6 | Drop live updates from the Account page (refresh on focus and after each save)? | **Yes.** Removes the stuck banner; the page has nothing that needs live updates |
| Q-AP7 | Keep the old title-only test drafts (your "Nitin" one included) as normal rows that you delete yourself, rather than a cleanup migration? | **Yes.** A migration never deletes user rows; one click deletes yours |
| Q-AP8 | A saved trip copy keeps its own party as ages (a snapshot started from Travellers), never birth months and never live-linked to Travellers? (TRIP-EDIT-I must match) | **Yes.** A past plan stays true to who went; birth months live in one row only |
| Q-AP9 | A returning Google sign-in that goes straight back to a trip page seeds the browser's party only at the next Account or Mine visit? | **Yes for v1.** Seeding on that redirect needs a client hand-off with a blank flash; revisit if it annoys |
| Q-AP10 | Add "Download my data" (a JSON file) on Account now, before F17's full export? | **Yes.** 30 minutes, and it makes the privacy promise real for children's data |
| Q-AP11 | Everyone, including existing accounts, sees the two-step setup once after this ships? | **Yes.** It is the only way existing accounts find Travellers; Skip is one tap |

## 13. Gotchas

- The SDK's session-data cookie can serve the old name for about 5 minutes after a change; the header initial lags.
- `cleanParty` must keep ignoring unknown keys, or `src` breaks old readers. A unit test pins it.
- A child born in the current month is "Under 1" (age 0), and the party bar must say "under 1" (UXB-2 M1).
- Daylight and time zones: `ageOn` uses the person's local date on the client and UTC on the server; a birthday on the
  1st can differ by a day for one request. Harmless at month precision.
- The Neon project must keep additional user fields off; if one is ever enabled, `update-user` accepts it from a direct
  call (4.3).
- GSI-WAYS, GSI-UX and GSI-SEC are in flight on `web/app/account/page.tsx`, `account.css` and `SignInCard.tsx`.
  ACCT-P1 and ACCT-P2 start after they merge (brief).

## Supersedes and amends

| Page | What changes |
|---|---|
| navigation-and-mine.md 4.3 | The create box leaves Account now (ACCT-P), before NAV-3; Account leads with Profile and Travellers |
| trip-and-places-ux-fixes.md 10.2 and 15 | `travel.party` gains optional `src: "account"`; the party may be seeded from the account |
| trip-builder.md 2.4 | The party row: seeded from the account when signed in; the draft rule unchanged |
| F17 rule 12 | New data class "travellers" (adult count, children's birth month and year), owner-only |
| google-and-apple-sign-in.md 6.1 | Name: editable on Account (ACCT-P) |
| F01 | The v1 slice; 9.4 says how it moves to `person` rows |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Written (ACCT-P), with the owner's screenshots of `/account/` and `/mine/` and the TRIP-EDIT-I cross-reference |
