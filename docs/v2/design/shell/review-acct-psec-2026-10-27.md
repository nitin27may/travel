# Review: Account profile and travellers, security and privacy (ACCT-PSEC)

Reviewer: independent security review (Opus 5.5), 27 Oct 2026. Task ACCT-PSEC. Read-only on code; this file is the only change.
Scope: `origin/main` @ `0edda5e2` (ACCT-PC, ACCT-P1 and ACCT-P2 merged). Files read:
- `web/app/account/{page,actions,ProfileSection,TravellersSection,TravellersEditor,SetupCard,SignOutButton,YourData,ways-api}.tsx/ts`;
- `web/lib/account/{name,name-quota,seed-party,travellers-form}.ts`, `web/lib/storage/partyKey.ts`, `web/lib/auth/{server,session-lost,guard}.ts`,
  `web/lib/server/{same-origin,safe-error}.ts`, `web/components/shell/{AccountMenu,Beacon}.tsx`, `web/lib/beacon.ts`,
  `web/components/auth/{SignInCard,memory}.ts(x)`, `web/app/mine/MineShell.tsx`;
- `web/app/api/account/profile/party/route.ts`;
- `core/src/db/{profile,tx,runner}.ts`, `core/src/schema/travellers.ts`, `core/src/config/account.ts`, `core/src/privacy/detect.ts`,
  `core/src/db/migrations/{0001,0009,0012,0013}*.sql`, `core/test/db/account-profile.test.ts` (case list only);
- `web/app/privacy/PrivacyBody.tsx`; spec `docs/v2/features/account-profile-and-travellers.md` (4.3, 5, 10, 11); brief `briefs/ACCTP.md`;
- the SDK `@neondatabase/auth` in `web/node_modules` (`dist/server-i57Km2d6.mjs:1096-1110`, the session-data cookie cache).

How it was checked: code read line by line; the jsonpath rules of the 0012 CHECK checked against the PostgreSQL manual; the
bfcache rule checked against Chrome's documentation. No service was called, no database was touched, no secret or `.env*` file was
read, no test was run (the database tests need `TEST_DATABASE_URL`; ACCT-PV runs them, see the checklist).

**Verdict: the server side is sound; the device side and the paperwork are not ready for production.** Identity always comes from
the verified session (`getUser(pageUserId)` in every action and the route), the travellers document is strictly validated twice
(Zod, then the CHECK), RLS is owner-only with grants to `travel_app` alone, the trigger owns revision and consent bookkeeping so a
client cannot forge them, the revision guard is race-free, and nothing logs an age, a date of birth or a name. What stops a release
is: the privacy page says nothing about the travellers (B1), an account-seeded party outlives the session it came from and can be
saved into the next person's account on a shared computer (B2), and 0012 sorts before the already-merged 0013, so the order of
application has to be decided before anything is applied (B3).

## 1. Blockers

**B1. The privacy page does not disclose the travellers, and two sentences are now false (before deploy).**
`web/app/privacy/PrivacyBody.tsx:29-30` lists what the browser keeps without `travel.party`; `:77-79` lists what an account keeps
(email, name, password, drafts) "and for nothing else", with no word of the adult count, children's ages, `age_as_of`, an optional
date of birth or adults' ages; `:84` (Google on) says "We do not show your name on any page", but Account and the menu now show it
(`ProfileSection.tsx:92`, `AccountMenu.tsx:16`); `:112` names drafts only. This is household data about minors stored in the
United States: it must be on the page the day the Account page ships.
Fix (ACCT-P3, spec 10.2): ship the 10.2 wording; change `:84` to "We show your name only to you, on your account page and in the
menu"; bump `PRIVACY_CHANGED`. Do **not** ship the 10.2 sentence "download everything we hold about you there" while
`YourData.tsx:5` has `EXPORT_READY = false`: either ship the export in the same release or drop that clause until it does.

**B2. An account-seeded party survives a session that did not end with Sign out, and the next person can save it as theirs
(before deploy).**
`src: "account"` records where the party came from, not whose account it came from (`partyKey.ts:44-49`). It is cleared only by
the two Sign out buttons (`SignOutButton.tsx:46`, `AccountMenu.tsx:36`). It is not cleared when:
- the session expires, is revoked on another device, or the account is deleted by email;
- a write or renewal answers 401 and the page calls `leaveSession()` (`session-lost.ts:11-13`, used by `TravellersSection.tsx:95,116`,
  `SetupCard.tsx:95,109,134`, `ProfileSection.tsx:76`);
- the next person signs in and has no saved travellers: `seedFromAccount` returns `null` on `adults: null` and leaves the party as
  it is, still marked `src: "account"` (`seed-party.ts:65`).

On a shared computer person B then sees person A's children's ages as "Your party" on every trip page, and B's own Account offers
them: "Add travellers" prefills "Filled in from this browser: 2 adults, children 7, 9" (`TravellersSection.tsx:309-310`), and setup
step 2 does the same (`SetupCard.tsx:196-200`). One Save copies A's children's ages into B's account. This breaks spec 5.4 (V12,
"a shared computer shows nothing of the previous person") and acceptance criterion 6 in every path except the button.
Fix:
1. Tag the owner: `src: "account"` gains `by: <accountHash(userId)>` (the hash `web/lib/mine/sync.ts:910` already computes for the
   Mine cache; never the raw id). `readPartySource()` returns `{ src, by }`.
2. In `seedFromAccount` / `seedParty`: a party with `src: "account"` and a different `by` is replaced by the account's party, or
   **removed** when the account answers `adults: null`. Same check on Account load (`TravellersSection.tsx:62-71`) and on Mine.
3. The two "Filled in from this browser" prefills ignore a party whose `by` is not the current user.
4. `leaveSession()` (or a wrapper used on every 401 path) calls `clearAccountParty()` before navigating.
5. Tests: expiry path (cookie gone, party with `by: A`, B signs in with nothing saved: party removed), 401 path, and the prefill.

**B3. Migration order: 0012 sorts before the merged 0013, and the runner refuses out-of-order (before apply).**
`core/src/db/runner.ts:6-8,102` refuses a new migration that sorts before an applied one, and refuses an applied one whose checksum
changed. `0013_plan_doc.sql` (EM-M) is on `main`; EM-F is editing 0012 concurrently. If 0013 reaches any database (child branch or
production) before 0012, 0012 can never be applied there under its number; if 0012 is applied and then edited, every later run fails.
Fix: freeze 0012 (EM-F's edits merged and this review's pre-apply items S7 to S9 decided) **before** it is applied anywhere; read
the migration ledger on the child branch and on production first; apply 0012 before 0013 everywhere, or, if 0013 is already applied
somewhere, renumber the account migration to the next free number (slugs, not numbers, are the contract: PLAN R-146).

## 2. Should fix

**S1. The session-data cookie cache makes every account check up to 299 s stale (stale name, and a revoked session can still write).**
`getUser()` calls `getAuth().getSession()` with no query (`web/lib/auth/server.ts:37`); the SDK then answers from the signed
`session_data` cookie whenever it is present and valid (`server-i57Km2d6.mjs:1099-1108`), without asking Neon. Consequences:
(a) the ACCT-PS finding: another device's Account page shows the old name for up to 299 s after a save; (b) more serious: a session
revoked by Sign out on another device, or by a manual account deletion, can still run `saveTravellers`, `removeTravellers`,
`saveName` and the party route for up to 299 s.
Fix: a `getUser(pageUserId, { fresh: true })` variant that passes `{ query: { disableCookieCache: 'true' } }` (the guard already
lets that parameter through for the browser: `guard.ts` `QUERY_KEEP`), used by the four account actions, the party route and
`AccountBody` (`page.tsx:88`). One Neon round trip per write and per Account load (the spike measured about 160 ms), free at our
size. The page then shows the fresh name; the header initial still catches up on the next cookie refresh (keep the gotcha).

**S2. The consent wording does not name everything that is stored.**
`STORED_NOTE` (`TravellersEditor.tsx:16`, AP-15) says "the number of adults and each child's age, and a date of birth only if you add
one", but the editor also stores adults' ages and their dates of birth (`travellers.ts:46`, `TravellersEditor.tsx` "Add adults'
ages (optional)"). The line is what the consent time in 0012 records agreement to.
Fix: "We save the number of adults, each child's age, adults' ages if you add them, and a date of birth only if you add one. No
names. Only you can see it, and you can remove it at any time." Update AP-15 in the spec with it.

**S3. The consent record is one timestamp for life, with no wording version (decide before apply).**
The trigger sets `travellers_consented_at` on the first document ever saved and never again (`0012:73,79`), including after
"Remove saved travellers" and a later re-add months on, possibly under different wording. A record that cannot say which text was
agreed to, or that a removal (a withdrawal) happened, is weak evidence.
Fix (cheap now, a new migration later): set `travellers_consented_at := now()` whenever `travellers` goes from null to non-null; add
`travellers_consent_version text`, written by `saveTravellers` from a constant next to `STORED_NOTE` (for example `ap15-2026-10-27`),
with a CHECK that it is not null when `travellers` is not null. Undo of a removal re-records consent, which is acceptable.

**S4. A manual account deletion leaves the travellers row behind.**
By design there is no foreign key into `neon_auth` (`0012:18-19`) and `deleteProfile` (`profile.ts:173`) has no caller. Deletion is
"email the owner" today (`YourData.tsx:19`, `PrivacyBody.tsx:112`), so the person deleting a Neon user by hand must also delete
`account_profile` (and `planner_draft` / plan rows) for that id, or children's ages and dates of birth outlive the account.
Fix: before deploy, a written runbook step (or an `ops` script that calls `deleteProfile` inside `withUserTransaction`) in the
deletion procedure, and a line in `HANDOVER.md`.

**S5. The name is not re-checked on read, contrary to spec 4.3; two character-class gaps.**
Spec 4.3 accepts that a person can call Neon's `update-user` directly "because the name is re-validated before it is rendered
(length cut at 60 on read)". Nothing does that: `page.tsx:130,134` pass `user.name` raw and `AccountMenu.tsx:16` uses it raw; a
Google sign-in also supplies a name `checkName` never saw. React escapes it, so this is not XSS, but a 10 000-character or
bidi-override name breaks the person's own layout and inflates the `session_data` cookie toward the 4 KB limit (their own sign-in).
Fix: one `displayName(raw)` on read (NFC, drop `\p{Cf}` except ZWJ/ZWNJ between letters, cut to 60 code points), used by the header
and Account. In `checkName` (`name.ts:7`): allow U+200C/U+200D between letters (Persian, Malayalam, Devanagari names need them;
`\p{Cf}` refuses them today) and cap combining marks per base character (for example 4) to stop "Zalgo" names; in `AccountMenu.tsx:16`
take `[...name][0]`, not `charAt(0)` (an astral letter is split into a lone surrogate).

**S6. No rate limit on the travellers writes or the party route.**
`saveTravellers`, `removeTravellers`, `finishSetup` (`actions.ts:139-183`) and `POST /api/account/profile/party/` each open a
database transaction (and, after S1, a Neon call) with no quota. A signed-in script can loop them; each save moves `revision` and
rewrites the row.
Fix: one bucket `account:profile_write` (60 per minute) and one `account:profile_read` (30 per minute) in
`core/src/config/auth-limits.ts`, keyed on the HMAC of the session's user id like `PLANS_LIMITS`, taken through the same quota store;
`RATE_LIMITED` maps to the existing "couldn't save" banner.

**S7. The CHECK's size cap measures compressed storage, not the document (decide before apply).**
`pg_column_size(travellers) > 2048` (`0012:42`) is the stored, possibly compressed, size; jsonb above about 2 KB is compressed by
TOAST, so a larger document can pass. The comment and `config/account.ts:15` claim it equals `maxBytes`.
Fix: `octet_length(travellers::text) <= 3072` (jsonb text adds spaces; 0013's `plan_doc` check does the same with half again).

**S8. The CHECK's lax-mode paths accept an array where a date string belongs (decide before apply).**
In lax mode a comparison or `like_regex` unwraps an array and passes if any element matches (PostgreSQL 9.16.2, "Strict and lax
modes"). `@.age_as_of like_regex ...` and `@.dob like_regex ...` (`0012:52-53,58-59`) therefore accept `"age_as_of": ["2026-10-27",
{"x": 1}]`. Zod stops it today; the CHECK exists for the day it does not.
Fix: add `@.age_as_of.type() == "string"` and `(!exists(@.dob) || @.dob.type() == "string")` to both filters (`.type()` is not
unwrapped).

**S9. The trigger does not pin `user_id` on update (before apply, cheap).**
`account_profile_touch` (`0012:76-87`) pins `created_at` but not `user_id`. RLS `WITH CHECK` stops `travel_app`; an owner-role
maintenance query does not run under RLS. Fix: `new.user_id := old.user_id;` (or raise) in the update branch.

## 3. Notes (checked, sound or accepted)

- **N1. The party route.** Same-origin (`route.ts:16`) before any work; a missing `Origin` is allowed (`same-origin.ts:9`), which is
  safe because browsers send `Origin` on every cross-origin POST and the answer is not readable cross-origin anyway. A forged
  `userId` gets the same 401 as a signed-out caller (`server.ts:49` compares, never scopes), so it reveals nothing. `Cache-Control:
  private, no-store` on every answer, POST only. The answer is `partyOf` (ages clamped 0 to 17) and the adult count: no `dob`,
  `age_as_of`, revision or timestamp leaves (`route.ts:29-30`). The 42P01 fallback answers "nothing saved", correct before 0012.
  Optional: refuse a body whose `content-type` is not `application/json` (the route parses any body today, `route.ts:19`).
- **N2. Mass assignment.** None: the document is a strict Zod object (`travellers.ts:38-48`) re-serialised from the parsed value
  (`profile.ts:110`), `finishSetup` is `=== true`, `revision` must be an integer, the user id is the session's, and only `{ name }`
  reaches `updateUser` (`actions.ts:115`).
- **N3. Revision races.** Sound. The update path is `where user_id = $1 and revision = $4` (READ COMMITTED re-checks the predicate on
  the locked row); two concurrent first saves resolve through the primary key and `where p.revision = 0` (`profile.ts:117-126`), the
  loser answering `conflict`; a removal with a stale revision answers `conflict` (`profile.ts:147-153`); a forged revision is ignored
  because the trigger computes it.
- **N4. Date rules.** Future `dob` and `age_as_of` beyond one day of skew are refused, a `dob` must agree with its age on
  `age_as_of`, the rolled age is capped at 120, 29 February is handled (`travellers.ts:75-123`). An `age_as_of` far in the past is
  valid and just shows as grown up; no security effect.
- **N5. Quota.** Fails closed in production when the store or `AUTH_QUOTA_SECRET` is missing (`name-quota.ts:36`); `NODE_ENV` is
  `production` on Vercel previews too, so previews need the secret. The key mixes in the UTC day (`:27-30`), so up to 20 changes fit
  across midnight; harmless. The counter is an HMAC of the user id: the privacy page's attempt-count paragraph does not cover it;
  half a sentence ("and how often you change your name") would.
- **N6. Logs, URLs, analytics, errors.** Actions and the route log fixed codes and `safeError` only; Zod issues carry path and rule,
  never a value (`travellers.ts:102-104`); the only URL state is `?setup=name|travellers` (`SetupCard.tsx:23-31`); the beacon is
  off `/account/*` (`beacon.ts:8`). `LOG_DENY_KEYS` (`detect.ts:118-124`) lacks `ageAsOf` and a `birth*` pattern that the detector
  has (`detect.ts:55-57`): add them for parity.
- **N7. The full document reaches the browser on `/account/` only** (`page.tsx:141`), as spec 10.1 allows; the page is
  `force-dynamic`, so private and uncached.
- **N8. Back after sign-out.** Chrome evicts `no-store` pages from the bfcache when cookies change, so Back cannot restore the
  previous person's `/account/` there; WebKit is not documented. Add the case to ACCT-PV (WebKit, sign out, Back); if it restores,
  add a `pageshow` handler on Account that reloads when `persisted`, and make `leaveSession` use `location.replace`.
- **N9. RLS without FORCE.** As in 0009: the owner role bypasses RLS, and every runtime path drops to `travel_app` in
  `withUserTransaction` (`tx.ts:65-66`). Acceptable; a later hardening could `force row level security` on account tables.
- **N10. Privacy page device keys.** `auth.googleBefore` is described correctly (`memory.ts:17`, a method word only).
  `auth.googleAdd` (`ways-api.ts:48`, a press time, this tab only) is not named; add it beside `auth.googlePending`.

## 4. What EM-F must keep in 0012

Whatever EM-F changes in `0012_account_profile.sql`, these must survive (the database tests pin most of them):
1. `alter table account_profile enable row level security` and the four owner policies on `app_current_user_id()`, with `WITH CHECK`
   on insert and update (`0012:92-104`).
2. `revoke all ... from public` and `grant select, insert, update, delete ... to travel_app` only; no grant to any other role; no
   sequence.
3. The trigger as the only writer of `revision`, `travellers_saved_at`, `travellers_consented_at`, `created_at`, `updated_at`, and
   `setup_done_at` set-once (`0012:65-90`); `set search_path = pg_catalog, public`; **not** `security definer`.
4. The CHECK with its CASE ordering, the strict-mode "every element is an object" lines, the closed key sets
   (`schema, adults, adult_ages, children`; `age, age_as_of, dob`), the caps equal to `core/src/trips/party.ts` and
   `core/src/config/account.ts`; plus S7 and S8 if accepted.
5. No foreign key into `neon_auth`, no Realtime signal, no publication, no SECURITY DEFINER function.
6. `user_id text primary key` with the length check.
7. The file applied before 0013 everywhere, or renumbered (B3); no edit after it is applied anywhere.

## 5. Checklist

**Before 0012 is applied (child branch, then production):**
- [ ] EM-F's edits merged; S3, S7, S8, S9 decided and, if accepted, in the file; then the file frozen.
- [ ] Migration ledger read on the child branch and production; 0012 applied before 0013, or renumbered (B3).
- [ ] `core/test/db/account-profile.test.ts` run against the child branch with `TEST_DATABASE_URL`, all cases passing (RLS four
      ways, unset user, grants, CHECK refusals, revision guard, trigger), output recorded in the run note.
- [ ] `travel_app` confirmed `NOBYPASSRLS` and not the table owner on that branch.
- [ ] Owner approval for production (release rules).

**Before the Account page goes to production:**
- [ ] B1: privacy page per spec 10.2, the Google sentence fixed, `PRIVACY_CHANGED` bumped; no export promise unless the export ships.
- [ ] B2: owner-tagged `src`, clear on 401 and on "nothing saved for a different owner", prefills ignore another owner's party; tests.
- [ ] S1: fresh session read on the account writes, the party route and the Account body.
- [ ] S2: AP-15 wording names adults' ages.
- [ ] S4: deletion runbook deletes `account_profile` (and plan rows) by user id.
- [ ] S5 and S6 done, or recorded as accepted with a date in the spec.
- [ ] `AUTH_QUOTA_SECRET` (16+ characters) and `DATABASE_URL` set for production and preview, or name saves answer "unavailable".
- [ ] Detector and log-scan tests pass (`pnpm --dir core test`, `pnpm --dir web test`), and one manual grep of the built server output
      for `age_as_of` and `"dob"` outside `/account/`.
- [ ] ACCT-PV: shared-computer cases (Sign out; session expiry without Sign out; second account with nothing saved), WebKit Back
      after sign-out (N8), and the network log of a trip page shows no account request.

## Sources

- PostgreSQL 18 manual, 9.16.2 "The SQL/JSON Path Language", strict and lax modes:
  https://www.postgresql.org/docs/current/functions-json.html (read 27 Oct 2026).
- Chrome for Developers, "Back/forward cache for Cache-Control: no-store pages":
  https://developer.chrome.com/docs/web-platform/bfcache-ccns (read 27 Oct 2026).
