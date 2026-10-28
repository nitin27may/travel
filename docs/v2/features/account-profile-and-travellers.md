# Account: profile, travellers and a page that makes sense

Status: **spec, 27 Oct 2026** (ACCT-P, high priority, owner feedback). Build brief:
[build/public-site/briefs/ACCTP.md](../build/public-site/briefs/ACCTP.md). Backlog 15.348. Owner questions Q-AP1 to Q-AP11
(backlog Q311 to Q321).

> **Amendment, 27 Oct 2026 (owner decision on Q-AP1).** Travellers are stored by **age**, not birth month and year. Each child
> (and, optionally, each adult) is an integer `age` plus `age_as_of`, the date it was entered; the person may add an optional
> date of birth (`dob`), and when it is there the age is derived from it and stays exact. Without a `dob` the age rolls forward one
> year on each anniversary of `age_as_of` (a lower bound: never older than the real age). Adults stay a count; their ages are
> optional. Every section below is updated to this; the rest of the spec stands as recommended. Built by ACCT-PC.

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
| [F01-household-and-profiles.md](F01-household-and-profiles.md) | This is the v1 slice of F01 people: counts and ages (each with the date entered, an optional date of birth), no names. F01's `household` and `person` tables (0002) stay unused; section 9.4 says how this row moves there later |
| [F17-accounts-auth-and-privacy.md](F17-accounts-auth-and-privacy.md) rule 12, 15, 16 | **Amended here.** A new private data class "travellers"; export and delete gain it |
| [trip-kinds-and-interest-profile.md](trip-kinds-and-interest-profile.md) 3.5, 3.6 | The interest profile stays its own document (`account_interests`, bundle F). Party and interests stay separate. The Account page gets a slot for it later (section 3.1) |
| `edit-my-trip.md` (TRIP-EDIT-I, in progress) | A synced copy's party is a snapshot that starts from Travellers (section 7) |

## 0. The decision in one paragraph

`/account/` becomes the person's settings page, in this order: **Profile** (display name), **Travellers** (adults and
children), **Ways to sign in** (GSI-WAYS), **Saved trips**, **Your data**. A new signed-in person with nothing saved sees
a two-step setup first: name, then travellers; both skippable. Travellers are stored in Neon as **a count of adults and
each child's age with the date it was entered** (an optional date of birth per person; adults' ages optional), with no
names, in one owner-only row per user (`account_profile`, migration slug `account_profile`, number 0012 if it merges next). The account is the standing default; **the device party stays the one
thing every page reads**. The account seeds the device party at sign-in and on Account, so the trip party bar, the copy
sheet and the trip builder prefill with no change to their code and no new load on public pages. The name is written
through Neon's `update-user` from a **server action**, so the browser auth proxy keeps answering 404 for that route. The
"Draft title" box goes; drafts are made from a trip or the builder. Realtime leaves the Account page, so the stuck banner
goes with it.

## Decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| AD1 | **Each child as an age plus the date it was entered (`age`, `age_as_of`); a date of birth (`dob`) optional** (owner, 27 Oct 2026; amends the month-and-year recommendation) | An age is what a parent knows and types fastest (P4) and is the least data about a minor. Kept with its date, it rolls forward on each anniversary of entry, so it does not go stale year to year. A person who wants exact ages for age limits ("6+", T4) adds a date of birth, and the age is then derived from it | Without a `dob` the rolled age can lag the real one by up to a year (the birthday falls between anniversaries); it never runs ahead. A "Check ages" notice (2.4) asks once a year. A `dob` is more precise data: optional, owner-only, never in output (AD5). Q-AP1 |
| AD2 | **No traveller names; adults as a count, their ages optional** | Nothing reads names: suitability, the scheduler and the party bar use the adult count and children's ages only (`core/src/trips/party.ts`). Adult ages are allowed (owner, 27 Oct 2026) for later senior and youth fares, but never required and not read by any page yet | F01's "Kai's passport" checks need names later; they come with F01 people, by explicit entry. Q-AP2 |
| AD3 | **Opt-in by an explicit Save with the wording beside it; no checkbox** | Filling the form and pressing "Save travellers" under a sentence that says what is stored is an unambiguous choice; a checkbox adds a tap and a reading task (P4). The time of the first save is kept (`travellers_consented_at`) | A regulator could prefer a separate tick for data about minors. If the owner wants it, it is one checkbox. Q-AP3 |
| AD4 | **The account seeds the device; the device never writes back silently** | Every reader (party bar, copy sheet, builder) already reads `travel.party`; the trip page has about 460 B of start-JS headroom and cannot load account code (P9, MASTER-ORDER 4.5). A party tweak on one trip ("grandma joins") is not a change to the household | A party changed on a trip page is not saved to the account until the person says so on Account (section 5.3). Q-AP4 |
| AD5 | **Travellers never leave the person's own requests**: no public output, URL, log, analytics, export to others, MCP or feedback report | Same rule as the device party (trip-and-places 15, trip-builder 7). The privacy detector gains the new field names | none |
| AD6 | **Name through Neon `update-user`, called server-side only** | One name, in `neon_auth.user.name`, which the header avatar and Account already read. The server SDK sends only `{ name }`; the browser proxy allow-list stays closed (guard MF3) | Depends on the server SDK forwarding the session cookie in a server action; a 1 h spike (ACCT-PS) proves it before the build. Fallback in 4.3. Q-AP5 |
| AD7 | **No Realtime on Account** | Profile and travellers change on one device at a time; the drafts list does not need live updates on this page; Realtime is experimental and its status line was stuck in production (section 8) | A rename on a phone shows on the laptop after a focus or reload, not live. Favourites already work this way (R-71). Q-AP6 |
| AD8 | **One row per user, typed by Zod, no Realtime signal** | One read per page; the row is small (under 1 KB); the same owner-predicate RLS as `plan_draft` | A household of two adults with two accounts keeps two rows (F01 households come later) |
| AD9 | **Remove the create-draft box; keep the user's existing rows** | A title-only draft has nothing to open. Drafts are made by "Copy to my trips" when signed in (TRIP-EDIT-I, CUS-C) and by the builder (`plan_draft`, TB-SY). User rows are never deleted by a migration | The owner deletes the "Nitin" test draft himself (one click). Q-AP7 |

## 1. User stories

| # | As | I want | So that | Principle |
|---|---|---|---|---|
| U1 | a new signed-in person | the page to ask my name and who travels with me, one step at a time, with Skip | I am set up in under a minute without reading anything | P4, P7 |
| U2 | a parent | to save 2 adults and 2 children once, with each child's age (and, if I like, a date of birth) | every trip, copy and plan starts with the right ages on any device, and the ages move on by themselves next year | T4, P6 |
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
| 5 | **My trips** (was "Saved trips"; review ACCT-PR MF1) | count and up to 5 newest rows, the same live rows as Mine's My trips | open the trip; "See all in Mine" (managing stays in Mine) |
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
| 320 | As 390; a child's age select and its "Add date of birth" link stack under "Child 1" instead of side by side |

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
|             Add adults' ages (optional)          |
| Children    [-] 2 [+]                            |
| Child 1   Age [ 7 v ]   Add date of birth        |
| Child 2   Age [ Age v ] Add date of birth        |
|                                                  |
| We save the number of adults and each child's    |
| age, and a date of birth only if you add one. No |
| names. Only you can see it, and you can remove   |
| it at any time.                                  |
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
   prefilled name saves nothing and moves on. Continue is always enabled (amended 27 Oct 2026, review ACCT-PR SF7): an empty
   name moves on and saves nothing, as Skip does; an invalid one shows the field error when Continue is pressed, never while
   typing. Skip moves on. "Two short steps. You can change both later." shows on step 1 only; Back sits beside the step counter
   ("Back · Step 2 of 2"), out of the sticky action bar; the done state keeps the eyebrow "Set up your account" (SF9).
2. Step 2 prefills from the device party when there is one: the adult count and each child's age (an unset age stays
   empty). A line under the heading says "Filled in from this browser: 2 adults, 2 children (6, 9). Check the ages and
   save." With no device party: 2 adults, 0 children (`DEFAULT_PARTY`).
3. Each child has an Age select (Under 1, 1 to 17) and an "Add date of birth" link that opens a native date field in
   place (P2). With a date of birth the age is derived from it and the Age select shows it read-only ("7, from the date of
   birth"); "Remove date of birth" returns to the select. Adults: "Add adults' ages (optional)" opens one optional Age
   field per adult (18 to 120), each with its own optional date of birth. Save travellers is enabled when every child has
   an age (or a date of birth). A missing age, a date of birth in the future, or one that makes the child 18 or older
   shows the field's error only after Save is pressed (P4: no red before the person acts).
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
| A saved child is 18 or older (by `dob`, or by the rolled age) | "Child 2 is now 18. Count them as an adult?" | "Move to adults" (adults + 1, child removed, saved), "Keep as a child" (plans as 17, the party's cap) |
| A child's age was entered more than 12 months ago and has no date of birth (`ageNeedsCheck`) | "Are these ages still right? 7, 9." | "Looks right" (re-saves the shown ages with today's `age_as_of`), "Edit" (opens the editor) |
| Storage blocked on this browser | "Saved to your account. This browser can't keep a copy, so trip pages here use the trip as written." | none |
| Saved on another device since this page loaded (revision conflict, 6.3) | "Your travellers were changed on another device." With the editor open the line sits in the editor above Save, takes focus and adds "Show the latest: your changes here will be replaced." (SF3) | "Show the latest"; in the editor also "Save mine anyway" (primary, re-saves at the row's revision now) |

As built (review ACCT-PR SF1, SF2, 27 Oct 2026): one notice at a time, in the order conflict, differs, grown-up, check ages,
storage blocked (then the read and save failures); every notice action is secondary ("Save this browser's party" became "Save
this party"). While the grown-up notice is open the party line shows the child's real age ("2 adults · 2 children (18, 9)") with
a muted line "Trips plan for the 18-year-old as 17 until you choose below."; the "differs" notice uses the same words.

**Saved trips.** Section 6.

**Your data.** "Download my data" (a JSON file, 6.5) and "Delete my account: email
nitin27may@gmail.com" with today's privacy wording until F17's delete button ships.

### 2.5 Errors and loading

| State | What shows |
|---|---|
| Page loading | Header, then three RowSkeletons per section (the existing Suspense fallback, extended) |
| Profile row cannot be read | Profile still shows the Name row (the name is Neon Auth's, not the row's; review ACCT-PR SF5). Travellers keeps its heading with an ErrorState: "We couldn't load your travellers." Detail: "The service may be briefly unavailable." Link "Try again". The setup card is not shown (fail closed: never ask a set-up person again because a read failed). Ways to sign in and My trips render on their own |
| Save fails (service) | A Banner inside the editor: "We couldn't save. Your changes are still here; try again." The form keeps its values |
| Session lost | `leaveSession()` as today |
| Name too long or invalid | Field error (4.2 strings) |
| Rate limited (name) | Field error: "Too many changes. Try again in a few minutes." |

### 2.6 Accessibility

- One `h1`; each section an `h2`; the setup card's step heading an `h2` inside a `<section aria-labelledby>`.
- Travellers editor: a `<fieldset>` with legend "Who usually travels with you?"; each child a nested `<fieldset>` with
  legend "Child 1"; the age is a native select with the visible label "Age"; "Add date of birth" is a button with
  `aria-expanded` that reveals a native `<input type="date">` labelled "Date of birth (optional)" with `max` of today; the
  derived age ("7, from the date of birth") is plain text tied by `aria-describedby` to the date field.
- Adding a child moves focus to its Age select (the Travellers.tsx pattern). Opening "Add date of birth" moves focus to the
  date field; removing it returns focus to the Age select. Removing the last child returns focus to the Children stepper.
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
| AP-11 | prefill line | Filled in from this browser: {party}. Check the ages and save. |
| AP-12 | steppers | Adults · Children (dec/inc labels "Fewer adults", "More adults", "Fewer children", "More children") · Add adults' ages (optional) · Adult {n} |
| AP-13 | child group | Child {n} · Age · Age (placeholder) · Under 1 · Add date of birth · Date of birth (optional) · Remove date of birth |
| AP-14 | derived age | {n}, from the date of birth · Under 1, from the date of birth |
| AP-15 | privacy line | We save the number of adults, each child's age, adults' ages if you add them, and a date of birth only if you add one. No names. Only you can see it, and you can remove it at any time. (Adults' ages added 27 Oct 2026, review ACCT-PSEC S2.) |
| AP-16 | step 2 buttons | Save travellers · Skip for now |
| AP-17 | done | All set · Trips now plan for {party} wherever you sign in. · Browse trips · Close |
| AP-18 | done, skipped travellers | All set · You can add travellers here at any time. |
| AP-19 | sections | Profile · Travellers · Ways to sign in · My trips · Your data (amended 27 Oct 2026, review ACCT-PR MF1) |
| AP-20 | name row | Name · Not set · Edit · Save · Cancel |
| AP-21 | name errors | Keep it under 60 characters. · Use letters, numbers, spaces and simple punctuation. · Too many changes. Try again in a few minutes. |
| AP-22 | name toast | Name saved. |
| AP-23 | travellers row second line | Ages today. Trips use these, and you can change the party on any trip. |
| AP-24 | travellers empty | No travellers saved. · Add who usually travels with you, and every trip starts from it. · Add travellers |
| AP-25 | child error | Choose an age. · Choose an age, or enter a date of birth. (the date field open and empty, under the pair; SF8) · The date of birth can't be in the future. · A child is 17 or younger. Count older travellers as adults. · An adult is 18 or older. |
| AP-25a | check-ages notice | Are these ages still right? {ages}. · Looks right · Edit |
| AP-26 | remove | More · Remove saved travellers · Remove your saved travellers? This browser keeps its party until you change it. · Remove · Cancel · Travellers removed. · Undo |
| AP-27 | notices | as the table in 2.4 |
| AP-28 | save error | We couldn't save. Your changes are still here; try again. |
| AP-29 | load error | We couldn't load your profile. · The service may be briefly unavailable. · Try again |
| AP-30 | my trips | My trips · {n} · Changed {d MMM} · See all in Mine · No trips in your account yet. · Copy a trip while signed in and it is kept here and in Mine. · Browse trips · (flag `accountTrips` off) Trips you copy stay on this device for now. See them in Mine. · Open Mine · (account out of reach, nothing cached) We can't reach your account right now. Your trips show here when we can. (amended 27 Oct 2026, review ACCT-PR MF1; "saved" is never used for a copy, patterns 3.7) |
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

Amended 27 Oct 2026 (owner, Q-AP1): ages with the date entered, an optional date of birth.

```ts
// core/src/schema/travellers.ts (ACCT-PC; Zod, strict; validated on every read and write through parseTravellers)
type IsoDate = string;                  // "YYYY-MM-DD", a real calendar date
interface AgeEntry {
  age: number;                          // whole years on `age_as_of`: a child 0..17, an adult 18..120
  age_as_of: IsoDate;                   // the day the age was entered or confirmed; never after today
  dob?: IsoDate;                        // optional date of birth; never after today; ageOn(dob, age_as_of) === age
}
interface Travellers {
  schema: "travellers/1";
  adults: number;                       // 1..12 (PARTY_MIN_ADULTS..PARTY_MAX_ADULTS): the count
  adult_ages?: AgeEntry[];              // optional; at most `adults` entries; not read by any page yet
  children: AgeEntry[];                 // max 8 (PARTY_MAX_CHILDREN)
}
```

- Every object is strict (an unknown key is refused). "Today" is the server's UTC day, with one day of tolerance for a
  person ahead of UTC (`TRAVELLERS.dateSkewDays`, `core/src/config/account.ts`).
- A child's `age` is 17 or less **on its `age_as_of`**; a stored child who has since turned 18 is kept and flagged (the
  turned-18 notice), never refused on read. An adult's `age` is 18 or more on its `age_as_of`. The rolled age of any entry
  is at most 120 today. The whole document is at most 2 KB as UTF-8 JSON.
- Order is the order entered. No ids, no names, no labels.
- Functions: `parseTravellers(x, today)`; `ageOn(dob, date)` (whole years; a 29 February birthday falls on 1 March in a
  common year); `ageNow(entry, date)` (`ageOn(dob, date)` with a `dob`, else `age` plus the whole years since
  `age_as_of`: a lower bound, never ahead of the real age); `partyOf(t, date): Party` (children's `ageNow`, clamped to
  0..17); `travellersFromParty(p, date)` (null when a child's age is unset); `sameAsParty(t, p, date)`;
  `grownUp(t, date)` (children 18 or older now); `ageNeedsCheck(t, date)` (an entry with no `dob` whose `age_as_of` is
  more than 12 months old, `TRAVELLERS.recheckMonths`); `refreshAges(t, date)` ("Looks right": each entry re-based to
  today, a child already 18 left as stored).
- `ageNow` is the one age rule. The trip pages keep reading plain ages from `travel.party`; they never see `age_as_of` or
  `dob`.

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

`/api/account/profile/party/` answers `{ adults, children: number[] }` (ages today, never `dob` or `age_as_of`), `Cache-Control:
private, no-store`, POST with `sameOrigin()` and `{ userId }`, like `/api/account/drafts/`.

### 5.3 Device to account

Never automatic. On Account, when the device party differs and has no `src`, the notice offers "Save this browser's
party", which opens the editor prefilled with the device's ages (an unset age empty) and saves only on Save travellers.

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

**Superseded 27 Oct 2026 (review ACCT-PR MF1, built in ACCT-PRF).** The section is **My trips**: the account's live rows exactly as
Mine's My trips reads them (the same `useAccountTrips` hook and engine, so tombstones and title-only rows never show), newest
change first, five, each drawn with Mine's row as a link that opens the trip (no menu; renaming, changing dates and removing stay in
Mine), a fourth line "Changed 24 Oct", then "See all in Mine". The page no longer reads the title-only drafts and has no Rename or
Delete. Title-only rows (the owner's "Nitin" draft) are not shown here; showing them in Mine with Remove only (Q-AP7) is still to
do. The text below is the earlier rule, kept for the record.

`plan_draft` rows, newest first, at most 5, with the existing row (title, "Saved Tue 27 Oct · 1 min ago"), menu
Rename and Delete with Undo. **Only the title-only rows** (`doc is null and deleted_at is null`; amended 27 Oct 2026,
EM-F, review-em-s B1): a synced copy or plan and a tombstone are Mine's, renamed and removed there through the
revision-checked routes and their tombstone, so the read and the Rename and Delete actions never reach them. An Undo
that meets the account's cap of 50 says "Your account already holds 50 trips, the most it can. Remove one in Mine,
then try again." instead of "Couldn't restore the trip." A sixth row or more shows "{n} more" which expands the list in place (no pagination at this
size; P1 caps: NAV-D's 50). After NAV-3, the section shows the 5 newest and "See all in Mine", and editing moves there.

Rows refresh after each own write (the server action returns; the page re-reads through `/api/account/drafts/`) and on
window focus. No live stream.

### 6.3 Where drafts come from

| Source | When | Table |
|---|---|---|
| "Copy to my trips" while signed in | TRIP-EDIT-I / CUS-C | `plan_draft` (doc `trip-custom/1`) |
| The trip builder while signed in | TB-SY | `plan_draft` (its own table, ISO-6) |
| Copies made on this browser before sign-in | the sign-in merge (NAV-3) | `plan_draft` |

Until one of those ships, Saved trips is empty for a new person, and AP-30's empty state says so honestly.

### 6.4 The existing test drafts

Title-only rows made with the old box (the owner's "Nitin" draft among them) stay. They show as rows with Rename and
Delete; there is nothing to open. No migration deletes user rows. The owner deletes his own (Q-AP7).

### 6.5 Download my data

`GET /api/account/export/` (session required, `private, no-store`, `Content-Disposition: attachment;
filename="travel-account.json"`): `{ exportedAt, email, name, travellers (travellers/1 or null, with every age, its
`age_as_of` and any `dob`, as stored), travellersSavedAt, travellersConsentedAt, travellersConsentVersion, setupDoneAt,
drafts: [{ id, title, createdAt, updatedAt }] }`. **Gap for ACCT-P3 (EM-F, review-em-s S6):** once 0013 is live,
`drafts` must also carry each live row's `kind`, `source_trip`, `start`, `days`, `revision` and its whole `doc` (the
person's own data, GDPR access), through the same private responder; a tombstone exports its id, title and
`deletedAt` only. GSI-WAYS adds its ways-to-sign-in list when it ships (google spec 6.4). This is the first piece
of F17 15; the full zip stays F17's. The body is the person's own data and carries keys the privacy detector refuses in
public output (`travellers`, `dob`, `age_as_of`): the route answers through a private responder, never the public
`respond()`, which would fail closed (amended 27 Oct 2026).

**As built (ACCT-P3, 27 Oct 2026).** The route is `GET /api/account/profile/export/` (`web/app/api/account/profile/export/route.ts`).
The body is `{ exportedAt, email, name, travellers, travellersUnreadable, travellersSavedAt, travellersConsentedAt, setupDoneAt,
drafts }` (`drafts` is `null` if the titles could not be read). The user id comes only from the session. It is same-origin (a
`Sec-Fetch-Site: cross-site` request is refused too), limited to 5 an hour per user (`PROFILE_EXPORT` in
`core/src/config/auth-limits.ts`, keyed on an HMAC of the user id), and answers `Cache-Control: private, no-store`,
`Content-Disposition: attachment; filename="travel-account.json"` and `X-Content-Type-Options: nosniff`. It logs fixed codes only.
**Plan documents (`planner_draft` / `plan_draft`, EM-1) are not in the file yet. They join it when plan sync ships**, through this
same private responder, with a test that plants a plan and finds it in the export (review EM-S S6). The "Ways to sign in" delete line
(copy string 51) was removed: "To delete your account, email ..." lives only in Your data (AP-31).

### 6.6 The Revision guard

Each save sends the `revision` it loaded. The update is `where user_id = $1 and revision = $2`; zero rows means another
device saved first: the action answers `CONFLICT`, the page shows the conflict notice (2.4) and keeps the form.

As built (ACCT-PC): `revision` counts changes of the **travellers document** only. It is 0 while none was ever saved,
and `loadProfile` answers 0 for "no row", so a first save from two devices cannot both win. Finishing or skipping setup
does not move it. A save at revision 0 inserts the row or fills a row that never held travellers; a save at any other
revision updates that revision only, and a row deleted elsewhere answers `conflict` (never a silent re-create). Saving an
identical document does not move it. Removing travellers is guarded the same way; removing when nothing is saved is a
no-op.

## 7. Trip copies and their party (consistency with TRIP-EDIT-I)

A copy (`copies/1` on the device, `trip-custom/1` `travellers` on the account) already stores `adults` and
`children: number[]` (navigation-and-mine 3.1, 4.2 rule 2). Rules for this spec and TRIP-EDIT-I:

1. **A copy's party is a snapshot, not a link.** It starts from the device party (which the account seeds), so a new
   copy made while signed in starts from Travellers. Editing Travellers later does not change existing copies: a trip
   planned for a 6-year-old in 2027 stays planned for a 6-year-old.
2. **A copy stores ages, never a date of birth or `age_as_of`.** Ages at the copy's start date when it has one
   (`ageNow(entry, start)` when the seed came from the account), else ages today. A date of birth exists in one row only.
3. A copy's party may differ from Travellers (a friend joins). The copy row shows its own party ("2 adults, 1 child"),
   as on `/mine/` today.
4. A synced copy offers "Use my travellers" in its party editor to re-apply the saved party (TRIP-EDIT-I owns the
   control).
5. Both stores are named on the privacy page (8.2) and both are in export and delete.

**Possible conflict:** if TRIP-EDIT-I chooses a live link from a copy to the profile, or stores dates of birth in copies,
rules 1 and 2 conflict. Q-AP8 asks the owner to confirm the snapshot.

## 8. The live-updates banner: what it was and the rule from now on

**What it is.** The Account drafts list subscribed to Neon Realtime (experimental) on the content-free
`plan_draft_signal` table (migration 0010). `AccountDrafts.tsx` showed "Reconnecting to live updates..." whenever the
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

Built by ACCT-PC as `core/src/db/migrations/0012_account_profile.sql` (slug `account_profile`; MIG-N: renumber at merge if
another migration lands first). The file is the source of truth; in short:

| Column | Type | Written by |
|---|---|---|
| `user_id` | text, primary key, 1 to 255 characters | the caller, from the verified session only |
| `travellers` | jsonb, `travellers/1` or null | `saveTravellers`, `removeTravellers` |
| `travellers_saved_at` | timestamptz | the trigger, when `travellers` changes |
| `travellers_consented_at` | timestamptz | the trigger, on a save that creates travellers (the first ever, or the first after a removal) and names its consent wording; kept by later saves and by a removal |
| `travellers_consent_version` | text, CHECK in an allow-list (`ap15-2026-10-27`) | the save action, from the server constant `TRAVELLERS_CONSENT_VERSION` (`core/src/config/account.ts`), only with `saveTravellers(..., { consent: true })`; the trigger keeps it on every other write (EM-F, review-em-s S3) |
| `setup_done_at` | timestamptz | `finishSetup` or a save with `finishSetup`; the trigger never lets an update clear it |
| `revision` | integer, default 0 | the trigger: 0 or 1 on insert (no travellers or travellers), +1 on each change of `travellers` (6.6) |
| `created_at`, `updated_at` | timestamptz | the trigger |

- **CHECK `account_profile_travellers`** (a second net behind Zod): an object with only `schema`, `adults`,
  `adult_ages`, `children`; `schema` is `travellers/1`; `adults` an integer 1 to 12; at most 8 children and at most
  `adults` adults' ages; every entry an object with only `age`, `age_as_of` and an optional `dob`, a child's age an
  integer 0 to 17 and an adult's 18 to 120, dates shaped `YYYY-MM-DD`; at most 3 KB of jsonb text (`octet_length(travellers::text)`, half again Zod's 2 KB of compact JSON; review acct-psec S7). It is written
  as one CASE so a cast never meets the wrong type, and with jsonpath for the entries. Date logic that needs "today"
  (no future `dob`, `dob` agrees with `age`) is Zod's alone.
- **Trigger `account_profile_touch_t`** (before insert or update) owns the bookkeeping in the table above, so no caller
  can forge a revision or a consent time. A save that would create travellers without a consent wording raises SQLSTATE
  `TC001` (answered `rejected` with `$: consent_required`), so the seed and "Looks right" paths can never make a consent
  where none exists: Save travellers and the Undo of a removal (both beside the AP-15 line) pass `consent: true`;
  "Looks right" and an edit of stored travellers need not. The CHECK's entry filters test each leaf's `.type()` first,
  because lax jsonpath unwraps an array for `like_regex` (`"dob": ["2010-01-01", "x"]` matched before; review N4).
- **RLS**: four owner policies (`select`, `insert`, `update`, `delete`, each `user_id = app_current_user_id()`, update
  with the same WITH CHECK). `revoke all from public`; `grant select, insert, update, delete to travel_app`. No Realtime
  signal, no SECURITY DEFINER function, no foreign key into `neon_auth` (Neon owns that schema). Classified as never
  seeded (`core/src/seed/contract.ts`, class `account`).

Writes go through `withUserTransaction` (`core/src/db/tx.ts`), so `app.user_id` comes from the verified session and RLS
applies under the non-owner `travel_app` role. `core/src/db/profile.ts` holds `loadProfile`, `saveTravellers(userId,
doc, revision, { finishSetup })`, `removeTravellers(userId, revision)`, `finishSetup`, `deleteProfile`, with `user_id`
from the argument only (callers pass the session id). Answers: `{ kind: 'saved', revision } | { kind: 'conflict' } |
{ kind: 'rejected', issues }`.

### 9.2 Tests (on the Docker database and the child branch)

`core/test/db/account-profile.test.ts` (skips without `TEST_DATABASE_URL`): RLS, user B cannot select, insert, update or
delete A's row (with and without a WHERE, since a WHERE also applies the SELECT policy and would hide a weakened UPDATE or
DELETE policy), nor move its own row onto A's id; an unset `app.user_id` sees and writes nothing; the grants are
`travel_app` only; the CHECK refuses another schema, 13 adults, 9 children, a child of 18, a name, a `born` field, an
unknown key, a nested array, too many adults' ages, an adult of 12, a 3 KB document; the revision guard across two
devices; the trigger's bookkeeping. `core/test/db/profile.test.ts` covers the same functions with a fake runner (always
runs). `account_profile` is in the inventory's "every application table has RLS" pin.

### 9.3 Delete and retention

Kept until the person removes it or the account is deleted. The owner's manual account-removal steps (privacy page,
until F17 16) gain, as the owner, after the person's sessions are revoked:

1. `delete from account_profile where user_id = $1`
2. `delete from plan_draft where user_id = $1` (amended 27 Oct 2026, EM-F, review-em-s S6: every copy and plan, its
   document with children's ages, start dates and notes, the title-only drafts and the tombstones;
   `deletePlans(userId)` in `core/src/db/plans.ts` is the same statement for F17)
3. **Run steps 1 and 2 again five minutes later.** `getSession()` serves the SDK's session-data cookie for up to 299 s
   (section 4), so a revoked session can still write for about five minutes; the second run removes anything written in
   that window.

Encrypted nightly backups (R-145) hold a removed row until they age out; the privacy page says so in one clause.

### 9.4 Later: F01 households

When F01 builds households, each entry in `travellers/1` becomes a `person` row with its `dob` in 0002's `birth_date`
when given, else its age and `age_as_of` (two new columns, or `birth_year` estimated from them), the adults stay a count
until adults are invited, and
`account_profile.travellers` becomes a pointer or is dropped. One migration, written then; nothing here blocks it.

## 10. Privacy

### 10.1 Rules

| Rule | Enforced by |
|---|---|
| Owner-only row | RLS four policies; `user_id` from the session; route and action tests with a forged id |
| Never in public output | the privacy detector (`core/src/privacy/detect.ts`, ACCT-PC) refuses the keys `dob`, `born`, any key starting `birth` (`birthDate`, `birth_year`, ...), `age_as_of`, `ageAsOf`, `ages`, `adult_ages`, `travellers_consented_at`, `travellersConsentedAt`, `travellers_saved_at`, `travellersSavedAt` (with `travellers`, already private), and any string equal to `travellers/<n>`, in public payloads and exported pages; tests plant each and fail |
| Never in a URL | the party in links stays `p=` and `a=` (Q296); a test asserts no `dob` or `age_as_of` in any URL the site builds |
| Never in logs | actions and routes log fixed codes only (`safeError`); `LOG_DENY_KEYS` gains `travellers`, `dob`, `born`, `age_as_of`, `ages`, `adult_ages`; a log-scan test with a planted date of birth |
| Never in analytics | no analytics on `/account/` (GSI 7.1); the beacon sees paths only |
| Never in feedback reports | the report body is a path, a kind and free text (`core/src/schema/api/report.ts`), with no structured field to carry travellers; the detector keys above are the only list |
| Not over the wire more than needed | the party route sends ages, never `dob` or `age_as_of`; the Account page sends the document only to its own client component |
| Minors' data minimised | an age and the date entered; a date of birth only when the person adds one; no names; adults as a count, their ages optional |

### 10.2 The privacy page (`web/app/privacy/PrivacyBody.tsx`)

"Cookies and this device", replace the device sentence with: "Your browser also keeps a few things on this device:
light or dark, km or miles, saved views, trips you copy, and who is travelling (the number of adults and children's
ages). They stay on the device. If you sign in, the travellers you save to your account are copied to this browser and
removed from it when you sign out."

"Accounts", after the first paragraph, a new paragraph: "If you choose to save your travellers, we keep the number of
adults and each child's age with the date you entered it, so the ages move on each year, and a date of birth only if
you add one; no names. Adults' ages are optional. Trips then plan for the right ages on any device. Only you can see
them. Trips you save to your account keep the party you planned them for (adults and children's ages). You can
change or remove your travellers on your account page at any time, and download everything we hold about you there.
Removed data leaves our backups when they expire."

"Removing your account": "You can delete any saved trip and remove your saved travellers on your account page." Bump
`PRIVACY_CHANGED`.

## 11. Acceptance criteria (feature level)

1. A new signed-in person on `/account/` sees "Set up your account, Step 1 of 2" first; Skip, Skip leaves a settled page
   that never shows the card again on any device.
2. Saving 2 adults and children aged 7 and 9 on 27 Oct 2026 shows "2 adults · 2 children (7, 9)" and the row holds
   exactly `{schema, adults, children: [{age, age_as_of}, ...]}`; with a date of birth added for one child the entry
   also holds `dob` and its age agrees with it. On 27 Oct 2027 the same row shows "(8, 10)" with no edit.
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
9. No public page, export, URL, log line or feedback report carries a `dob`, an `age_as_of` or a child's age from the
   account (privacy tests).
10. User B cannot read or change user A's row (RLS tests on the child branch).
11. Axe clean and 44 px targets at 320, 390 and 1440, light and dark, in every state of 2.3 and 2.4.
12. Every public page's start JS and HTML budget is unchanged (`pnpm --dir web budget:report`).

## 12. Owner questions (Q-AP1 to Q-AP11; backlog Q311 to Q321)

| ID | Question | Recommended answer |
|---|---|---|
| Q-AP1 | Store each child as birth **month and year**, rather than an age (goes stale) or a birth year only (off by one most of the year)? | **Answered, owner 27 Oct 2026: age, DOB optional.** Each child (and optionally each adult) is stored as an age with the date entered (`age_as_of`), rolled forward each year; a date of birth is optional and, when given, the age is derived from it. (Was recommended: month and year.) |
| Q-AP2 | No names for travellers and no adult ages in v1? | **Yes on names** (nothing uses them yet; they come with F01 people when passport checks need them). **Adults' ages optional** (owner, 27 Oct 2026, with Q-AP1) |
| Q-AP3 | Consent as the explicit Save with the stored-data sentence beside it, no separate checkbox? | **Yes.** Clear and one tap shorter; the first-save time is recorded. A checkbox is a 15-minute change if you prefer it |
| Q-AP4 | The account seeds the browser's party; a party changed on a trip page is saved to the account only when you choose to on Account? | **Yes.** Keeps one source for every page and zero cost on trip pages. Trade-off: no silent write-back |
| Q-AP5 | Change your name through Neon's update-user from our server, keeping that route closed in the browser proxy (fallback: a guarded proxy route if the spike fails)? | **Yes** |
| Q-AP6 | Drop live updates from the Account page (refresh on focus and after each save)? | **Yes.** Removes the stuck banner; the page has nothing that needs live updates |
| Q-AP7 | Keep the old title-only test drafts (your "Nitin" one included) as normal rows that you delete yourself, rather than a cleanup migration? | **Yes.** A migration never deletes user rows; one click deletes yours |
| Q-AP8 | A saved trip copy keeps its own party as ages (a snapshot started from Travellers), never a date of birth and never live-linked to Travellers? (TRIP-EDIT-I must match) | **Yes.** A past plan stays true to who went; dates of birth live in one row only |
| Q-AP9 | A returning Google sign-in that goes straight back to a trip page seeds the browser's party only at the next Account or Mine visit? | **Yes for v1.** Seeding on that redirect needs a client hand-off with a blank flash; revisit if it annoys |
| Q-AP10 | Add "Download my data" (a JSON file) on Account now, before F17's full export? | **Yes.** 30 minutes, and it makes the privacy promise real for children's data |
| Q-AP11 | Everyone, including existing accounts, sees the two-step setup once after this ships? | **Yes.** It is the only way existing accounts find Travellers; Skip is one tap |

## 13. Gotchas

- The SDK's session-data cookie can serve the old name for about 5 minutes after a change; the header initial lags.
- `cleanParty` must keep ignoring unknown keys, or `src` breaks old readers. A unit test pins it.
- A child under one is age 0 ("Under 1"), and the party bar must say "under 1" (UXB-2 M1).
- Without a date of birth the rolled age is a lower bound: a child entered as 6 the day before turning 7 reads 6 until the
  first anniversary of entry. The yearly "Are these ages still right?" notice and an optional date of birth are the fix.
- Daylight and time zones: the client uses the person's local date and the server the UTC day, with one day of tolerance
  for a date of birth or `age_as_of` that is "tomorrow" in UTC (`TRAVELLERS.dateSkewDays`). A birthday can read a day
  late or early for one request.
- The export route must not answer through the public `respond()`: the detector would refuse its own `travellers` key
  (6.5).
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
| F17 rule 12 | New data class "travellers" (adult count, each child's age with the date entered, optional dates of birth, optional adults' ages), owner-only |
| google-and-apple-sign-in.md 6.1 | Name: editable on Account (ACCT-P) |
| F01 | The v1 slice; 9.4 says how it moves to `person` rows |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Written (ACCT-P), with the owner's screenshots of `/account/` and `/mine/` and the TRIP-EDIT-I cross-reference |
| 2026-10-27 | Amended (owner, Q-AP1): ages with `age_as_of` and an optional `dob` replace birth month and year; adults' ages optional. Sections 0, AD1, AD2, U2, 2.2, 2.3, 2.4, 2.6, 2.7, 5.1, 5.2, 5.3, 6.5, 6.6, 7, 9, 10, 11, 12, 13 updated. ACCT-PC built the contracts: migration `0012_account_profile.sql`, `core/src/schema/travellers.ts`, `core/src/db/profile.ts`, `core/src/config/account.ts`, the `src` field in `web/lib/storage/partyKey.ts`, the detector keys |
| 2026-10-27 | EM-F (Opus, branch `public/EM-F`), the security review's fixes before 0012 is applied ([review-em-s-2026-10-27.md](../design/shell/review-em-s-2026-10-27.md)): `travellers_consent_version` and the re-stamp after a removal (9.1, S3); the jsonpath type guards (N4); Saved trips lists and acts on title-only rows (6.2, B1); the removal runbook deletes `plan_draft` rows and runs twice (9.3, S6); the export gap for ACCT-P3 (6.5). **Contract change for ACCT-P2:** `saveTravellers` needs `{ consent: true }` on a save that creates travellers |
| 2026-10-27 | ACCT-PRF (Opus, branch `public/ACCT-PRF`), the design review's fixes ([review-acct-pr-2026-10-27.md](../design/shell/review-acct-pr-2026-10-27.md)): section 5 is My trips, read as Mine reads it (2.1, 6.2, AP-19, AP-30); Continue always on (2.3 rule 1); one notice at a time with secondary actions, the grown-up child's real age, the conflict inside the editor with Save mine anyway (2.4); the Name row survives a failed profile read (2.5); the date-or-age error (AP-25). `saveTravellers` sends `{ consent: true }` on Save and on the Undo of a removal |
