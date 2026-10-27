# Review: My-trips sync, security and privacy (EM-S), before 0012/0013 are applied and before `accountTrips` is on

Reviewer: independent security review (Opus 5.5), 27 Oct 2026. Task EM-S. Read-only on code; this file is the only change.
Scope: `origin/main` @ `102eb354` (merge of EM-M and EM-1). Files read:
- `core/src/db/migrations/{0001,0009,0010,0011,0012,0013}*.sql`, `core/src/db/{tx,client,plans,profile,runner}.ts`;
- `core/src/schema/api/account-plans.ts`, `core/src/schema/{plan-draft,travellers,copies}.ts`, `core/src/plan/{doc,sync}.ts`
  (`ops.ts` skimmed: pure rebase, no I/O), `core/src/config/{plans,auth-limits}.ts`, `core/src/quota/keys.ts`,
  `core/src/privacy/detect.ts`, `core/src/favourites/account.ts` (`accountHash`);
- `web/lib/server/{plans,same-origin,safe-error,drafts}.ts`, `web/app/api/account/{plans/**,drafts/route.ts}`,
  `web/app/account/{actions.ts,SavedTrips.tsx}`, `web/lib/auth/server.ts` (`getUser`);
- tests: `core/test/db/plan-doc.test.ts` (titles), `web/tests/account/plans-route.test.ts` (origin and log blocks);
- specs: `docs/v2/features/edit-my-trip.md` 3 to 7, `docs/v2/features/account-profile-and-travellers.md` 4 to 6, 9, 10.

How it was checked: code read line by line against the specs; PostgreSQL behaviour checked against the vendor docs (links at the end).
No database was touched, no service called, no secret or `.env*` read.

**Verdict.** The identity model is right and consistently applied: every route and module takes the user id only from
`getUser()` and runs under `withUserTransaction` (`travel_app`, NOBYPASSRLS, `app.user_id` bound per transaction), the document is
a strict Zod object (no server column can be mass-assigned through it), the light columns are derived server-side, revision and
consent times are trigger-owned, the purge is closed to the app role, the cap race is correctly serialised, and every error body is a
fixed code. There is **no IDOR and no RLS bypass** in the reviewed code. What stops the switch-on is around the edges: the old
`/account/` draft actions now operate on synced plans and tombstones without knowing about them, and a single account can grow
tombstones and WAL without bound on a free-tier database. Two cheap schema fixes should go into 0013 now, because the runner is
checksummed with no down migrations (`core/src/db/runner.ts:87`): after apply, every fix is a new migration.

## 1. Blockers

### B1. The old `/account/` draft actions and list now act on synced plans and tombstones (before flag on)

- `readDrafts` uses `draftsReadQuery` (`core/src/db/tx.ts:89-96`), which has no `deleted_at` or `doc` filter. Once 0013 is in and
  the flag is on, Saved trips (`web/app/account/SavedTrips.tsx`) lists every synced copy **and every tombstone** of the last 30 days,
  each with Rename and Delete.
- `deleteDraft` (`web/app/account/actions.ts:80`) is a hard `delete`. On a synced plan it destroys the document with no tombstone, so
  (a) another device never learns of the removal (4.5 is bypassed), its outbox PUT gets 404, and the next sign-in merge on a device
  still holding the copy **re-inserts it** (the id is free again); (b) the toast's Undo calls `createDraft`
  (`actions.ts:33`), which recreates a **title-only** row: the document is lost for good. On a tombstone it erases the removal signal
  early.
- `renameDraft` (`actions.ts:58`) on a synced plan changes `title` without touching `doc`; the trigger bumps `revision`, so every
  device's next PUT is a 409, and the rename is silently overwritten by the next write (the route re-derives the title from the
  document, `web/lib/server/plans.ts:227-235`). On a tombstone it renames a removed row.
- `createDraft` at the cap gets TP001 from 0013's trigger and answers `SERVICE_UNAVAILABLE` (`actions.ts:42-44`) with an error log,
  not a cap message.

Fix (pick one, before the flag): restrict the three actions and the read to legacy rows: `... and doc is null and deleted_at is null`
on rename and delete, `where user_id = $1 and deleted_at is null` in `draftsReadQuery`; synced rows on `/account/` link to Mine
(spec 6.2 "See all in Mine"). Or route Delete through `deletePlan` (tombstone) and drop Rename for `doc is not null`. Map
`pgErrorCode(e) === 'TP001'` in `createDraft` to a `CAP` reason. Add a route/action test per case.

### B2. Unbounded growth from one account: tombstones, WAL and the list window (before flag on)

- The only write limit is `plans:write` at **120 a minute, no hour or day window** (`core/src/config/auth-limits.ts:210-212`). That is
  172,800 writes a day per account, and accounts are free to create.
- The cap counts live rows only (`0013_plan_doc.sql:83-90`). Create-then-delete leaves a tombstone each time: about 86,000 tombstones
  a day per account, kept 30 days, and purged only by the same user's next write (`core/src/db/plans.ts:91-93`) because no job calls
  `planner_draft_purge()` (nothing in `core/bin`, `web/scripts` or CI references it).
- Each PUT rewrites a document of up to 16 KB: 120 a minute is about 2.7 GB of row churn a day. Neon Free is 1 GB of storage per
  project and 1 GB-month of change history (Neon plans page). One hostile or buggy client (an outbox loop) can take the shared
  database read-only for every user.
- Correctness side effect: `listPlans` orders tombstones and live rows together by `updated_at` with `limit 200`
  (`plans.ts:110-114`, `account-plans.ts:37`). More than 150 recent tombstones push older **live** rows out of the answer, and
  `diffPlanList` (`account-plans.ts:208`) then tells every device to **drop** them as "purged". A heavy legitimate user hits this too.

Fix: (1) add an hour and a day window to `PLANS_LIMITS.write` (for example 600/hour, 3,000/day) and weight the merge by its row count
(below, S5); (2) cap tombstones per user (refuse or purge-oldest beyond, say, 200 in the `deletePlan` transaction); (3) list live rows
and tombstones in two bounded queries (all live rows, at most 50; then the newest N tombstones), so a tombstone can never hide a live
row; (4) schedule `planner_draft_purge()` daily as the owner (see S2). Load-test (2) and (3) on the child branch.

## 2. Should fix

### S1. Global id namespace: the cross-user existence signal and id squatting (decide before apply)

`planner_draft.id` is a global primary key chosen by the client (`0009:12`, spec 3 "id stays client-made"). Under RLS,
`insert ... on conflict (id) do nothing` silently skips a row another user holds (PostgreSQL CREATE POLICY: only the proposed row is
checked, never the existing one), so:
- **Existence oracle.** PUT create of a known id answers 404 if another user holds it and 201 if not (`plans.ts:165-168`,
  `web/lib/server/plans.ts:304-305`); the merge answers `refused` vs `inserted` (`plans.ts:265-266`). Cheap only for someone who
  already knows the id, but spec 5.2 (`edit-my-trip.md:295-301`) plans to put the id in a public URL (`?mine=<id>`), which reaches
  history, Referer-less shares, server logs and any path-level analytics. The spec's "a random id that means nothing on another
  device" is not true while the key is global.
- **Squatting.** Whoever learns a device copy's id before its owner signs in can PUT it into their own account. The owner's merge then
  answers `refused` forever and the copy is stuck "On this device" (M4), with no way to recover.

Fix, cheapest now: make the key per user in 0013: `primary key (user_id, id)` (drop the old PK, keep a non-unique index on `id` if a
query needs it; change `on conflict (id)` to `on conflict (user_id, id)` in `plans.ts:161,256` and `actions.ts:35`). The cross-user
"refused" case disappears and so does the oracle; RLS is unchanged. If the global key must stay, at least: answer a cross-user
collision on PUT create with the same 409-shaped "pick a new id" code as an own collision, and have the merge re-key a refused copy
server-side (return `{ old, new }`). Either way, keep the plan id out of URLs (use an opaque per-device handle, or `#mine=` in the
fragment so it is never sent to a server). Changing the key after apply is a table rewrite and a new migration; do it now.

### S2. Enforce the tombstone privacy invariant and pin bookkeeping in the database (before apply)

0013's header says a tombstone keeps neither the document nor the household columns (`0013_plan_doc.sql:19`) and that the CHECKs
refuse "columns that disagree with the document" (line 8). Only the route enforces the first (`plans.ts:203`), and `start` and `days`
are not checked against the document at all. A future code path (an admin script, the merge, a new route) can tombstone a row and
leave a child's age and a start date in it for 30 days; or set `deleted_at` to a past date (instant purge) or the far future (never
purged, never counted in the cap).
Fix in 0013:
- CHECK `deleted_at is null or (doc is null and kind is null and source_trip is null and start is null and days is null)`;
- CHECK `doc is null or to_char(start, 'YYYY-MM-DD') is not distinct from (doc->>'start')` (text compare, no cast that can throw);
- in `planner_draft_revision()` on UPDATE: `new.id := old.id; new.user_id := old.user_id;` and
  `if old.deleted_at is null and new.deleted_at is not null then new.deleted_at := now(); elsif old.deleted_at is not null and new.deleted_at is not null then new.deleted_at := old.deleted_at; end if;`
  so no caller can backdate, extend or move a tombstone.
- Ship the purge job with the flag (B2 point 4): today a user who deletes and never writes again keeps titled tombstones forever,
  which breaks the 30-day promise in spec 4.5 and 7.

### S3. Consent record: integrity is fine, meaning is thin (before the ACCT-P2 write routes)

The trigger makes `travellers_consented_at` unforgeable (`0012_account_profile.sql:73,79`), which is right. But it records "the first
non-null save", not "consent to wording X": any future write path that sets `travellers` stamps it whether or not AP-15 was on screen,
and a save after a removal keeps the old timestamp (`coalesce(old...)`), so a re-consent under new wording is not recorded. For minors'
data, the record should show what was agreed to.
Fix: add `travellers_consent_version text` (set by the action from a server constant, never the client, checked against a short
allow-list); on a save that follows a removal (old travellers null, new not null) restamp `travellers_consented_at` and the version;
keep the first-ever time in a separate column if the owner wants history. Only the Account save action may pass the version; the
seed and "Looks right" paths must not create a consent where none exists.

### S4. No statement or lock timeouts on user transactions

`getPool` creates `new Pool({ max: 10 })` with no `statement_timeout`, `lock_timeout` or `idle_in_transaction_session_timeout`
(`core/src/db/client.ts:98`). The cap trigger waits on a per-user advisory lock and the write path holds `for update` row locks; a
stuck request (slow function cold start, a hung catalogue read is outside the transaction, but a slow Neon wake is not) holds them
until the platform kills the function, and the 10-connection pool drains.
Fix: in `withUserTransaction` after `begin`, `set local statement_timeout = '5s'; set local lock_timeout = '3s';
set local idle_in_transaction_session_timeout = '10s'`; map 55P03/57014 to 503 in the routes (they already answer 503 on a throw).

### S5. The merge is one quota take for up to 20 inserts

`mergeRoute` takes once (`web/lib/server/plans.ts:348`) and then attempts up to 20 inserts, each with a savepoint, the cap trigger and
a follow-up select. That is a 20x amplifier on the per-minute bucket (2,400 insert attempts a minute). Fix: take `max(1, items)` units
(or a separate `plans:merge` bucket at a few a minute), before parsing the body's rows.

### S6. Account deletion and export do not cover the plans yet

- The manual account-removal steps gain `delete from account_profile` (`account-profile-and-travellers.md:579-580`) but nothing for
  `planner_draft`, which now holds children's ages, start dates and notes. `edit-my-trip.md` 7 says "account deletion deletes the
  rows" with no step that does it. Fix: add `delete from planner_draft where user_id = $1` (as the owner) to the same runbook and the
  privacy page's removal paragraph, and a `deletePlans(userId)` in `core/src/db/plans.ts` for F17.
- The export design (`account-profile-and-travellers.md:470-476`) lists `drafts: [{ id, title, createdAt, updatedAt }]`. Once 0013
  is live, the person's own export must include each live `doc` (it is their data; GDPR access), through the private responder, never
  the public `respond()` (which would correctly fail closed on `travellers`, `start`, `template`). Update the spec before the export is
  built.
- Note the session cache: `getSession()` reads the SDK's session-data cookie for up to 299 s (`account-profile-and-travellers.md:337-340`),
  so a revoked session can still write for about five minutes. The deletion job must run after session revocation plus that window,
  or run twice.

### S7. Log deny-list does not name the plan document's keys

Spec 7 says children's ages are "never logs (deny-list)". `LOG_DENY_KEYS` (`core/src/privacy/detect.ts:98-125`) has `travellers`,
`dob`, `age_as_of` etc., but not `doc`, `children`, `template`, `notes`, `start`, `fromRef`, `gw`, and its only consumer is the auth
guard (`web/lib/auth/guard.ts:252`). The plan routes are safe today because they log fixed codes only (`web/lib/server/plans.ts:134-136`,
tested at `plans-route.test.ts:518-540`). Fix: add those keys, and add a log-scan test to the plan routes that plants a child age, a
start date and a note in a PUT and a merge body and asserts none appears in captured `console.*` output on every outcome (200, 400,
409, 413, 503).

## 3. Notes

- **N1. Cap race: correct.** `pg_advisory_xact_lock` keyed on the user (`0013:89`) plus a VOLATILE plpgsql body that takes a fresh
  snapshot per statement (PostgreSQL "Function Volatility Categories") means the second of two racing transactions counts the
  first's committed row. It holds through PgBouncer transaction pooling (transaction-level lock). In `insertPlans` a failed row's
  savepoint rollback releases only that row's lock; a successful row's lock stays with the parent until commit. It depends on
  READ COMMITTED: confirm `default_transaction_isolation` on the Neon role (checklist). Run the race test on the pooled child-branch
  endpoint, not only Docker.
- **N2. The cap fires before ON CONFLICT.** BEFORE INSERT triggers run for every proposed row (PostgreSQL INSERT docs). At 50 live
  rows, a merge of a copy whose id is the caller's own **tombstone** answers `overCap` instead of `already`
  (`plans.ts:267-270`; tombstones are not in `mergeKeys`, `plans.ts:226`), so the device keeps a copy the person removed. Fix: in
  `insertPlans`, look the id up under RLS first and skip the insert when the caller holds it.
- **N3. Trigger functions are not SECURITY DEFINER; good.** `planner_draft_revision` and `planner_draft_cap` run as the caller, so the
  cap's count is RLS-scoped (and equals `user_id = new.user_id` because WITH CHECK pins it; WITH CHECK runs after BEFORE triggers, so a
  forged `user_id` locks a stranger's advisory key for one statement and then fails: harmless). The purge is plain SQL with EXECUTE
  revoked from PUBLIC and never granted to `travel_app`; if someone grants it later it still only sees the caller's rows. The one
  SECURITY DEFINER in the path is 0010's signal trigger, unchanged and content-free.
- **N4. 0012 CHECK, second-net gaps.** The entry filters use lax jsonpath (`0012:50-60`). Lax mode unwraps a one-element array
  for comparisons, and the predicate evaluator very likely does the same for `like_regex` (the docs do not say; not run here), so
  `"dob": ["2010-01-01"]` or `"age_as_of": ["..."]` may pass the CHECK: add both to the CHECK's refusal tests on Docker. Zod refuses
  both, so only a bug path reaches it. Fix either way: add
  `@.age_as_of.type() == "string" && (!exists(@.dob) || @.dob.type() == "string")` (`.type()` does not unwrap) or use `strict $...`.
  Also `pg_column_size(travellers) > 2048` measures binary jsonb, Zod measures UTF-8 text: test the largest valid document (8 children
  and 12 adult ages, each with a `dob`) against the CHECK so a valid save cannot fail with 23514.
- **N5. CHECKs and NULL.** Both migrations handle the NULL trap correctly: the CASE in `planner_draft_doc` (`0013:36-45`) and the
  `coalesce(..., false)` in `planner_draft_kind_of_doc` (`0013:53-54`) never yield NULL for a non-null document; 0012's CASE returns
  only true or false once `travellers` is not null.
- **N6. CSRF and origin.** `sameOrigin` allows a missing `Origin` (`web/lib/server/same-origin.ts:9`). Acceptable here: every write
  requires `application/json` (`plans.ts:176-180`), which a cross-site form cannot send and a cross-site `fetch` cannot send without a
  CORS preflight we never grant; browsers send `Origin` on every non-GET fetch. Reads are not cross-origin readable. Keep the JSON
  requirement as a tested invariant.
- **N7. Built-mode drafts may carry children's ages.** `planModeRules` (`core/src/schema/plan-draft.ts:620-621`) allows
  `party: "trip"` with `travellers` in built mode, while account-profile 5.5 rule 2 (`account-profile-and-travellers.md:428-429`)
  promises "a synced draft carries no children's data" for the builder. Either refuse `travellers` when `template` is absent, or amend
  5.5 to match edit-my-trip 7. Also `planTravellers.children` allows 12 (`plan-draft.ts:363`) where the party and 0012 allow 8.
- **N8. Untrusted fields re-entering later.** `lastBuild` (builder output) and `notes` are client-supplied and stored verbatim. Nothing
  renders them as trusted today (React escapes), but any future server-side use (a build that trusts `lastBuild`, the private MCP or
  an AI summary reading `notes`) must treat them as user input: re-validate or rebuild, never feed to a model without delimiting
  (prompt injection), consistent with spec 7's consent screen rule.
- **N9. The flag is build-time.** `accountTripsOn` reads `NEXT_PUBLIC_*` (`web/lib/server/plans.ts:113-118`), which Next inlines at
  build. Turning the routes off means a rebuild and redeploy. Consider a server-only runtime kill switch (for example
  `ACCOUNT_TRIPS_WRITES=0` read per request) that makes writes answer 503 while reads stay up.
- **N10. Catalogue memo.** `readTrips` caches the public trip list per process (`plans.ts:410-429`); a trip made private keeps
  accepting new copies on warm instances until they recycle. Fine at this scale; worth a TTL if unlisting becomes urgent.
- **N11. Device keys.** `accountHash` is an unkeyed SHA-256 of the user id cut to 16 hex (`core/src/favourites/account.ts:12-15`). It
  links a browser profile to an account id for anyone with the device; acceptable (ids are not public). Spec 4.6 keeps the outbox
  (documents with children's ages) on a device after a session **expires** until the next sign-in: on a shared computer that can be
  indefinite. EM-2 should cap it (for example, discard after 30 days without a sign-in, with the same dialog when it next can).
- **N12. Reads are not rate-limited.** `GET /api/account/plans` and `/{id}` take no quota. Low risk (own data, RLS, small rows), but
  the client's 60 s refetch times tabs times devices is the read load; a per-user read bucket at a generous limit is cheap insurance.

## 4. Must be true before apply (Neon child branch, then production)

1. S1 decided and, if taken, the composite key is in 0013 (the file is checksummed; there is no down migration).
2. S2's CHECKs and trigger pins are in 0013; N4's jsonpath type guards are in 0012.
3. `core/test/db/plan-doc.test.ts` and `core/test/db/account-profile.test.ts` pass with `TEST_DATABASE_URL` on Docker **and** on the
   child branch's pooled endpoint (the cap race and the cross-user suite through PgBouncer), with the results in the hand-back.
4. On the child branch after apply, as the owner: `relrowsecurity` is true on `planner_draft` and `account_profile`; four policies
   each; `has_table_privilege('travel_app', ...)` is select/insert/update/delete only; `has_function_privilege('travel_app',
   'planner_draft_purge(integer)', 'execute')` is false; no SECURITY DEFINER function was added (`prosecdef` on the new functions is
   false); `show default_transaction_isolation` is `read committed` for the runtime role.
5. The migration role owns `planner_draft` (ALTER TABLE needs it); a branch snapshot of production is taken immediately before the
   production apply; the apply order is 0012 then 0013.
6. Existing title-only rows (the owner's test drafts, spec 6.4) still read: `doc`, `kind` null, `revision` 0, all CHECKs pass.

## 5. Must be true before `NEXT_PUBLIC_ACCOUNT_TRIPS=1`

1. B1 fixed: the `/account/` actions and list ignore synced rows and tombstones (or tombstone through `deletePlan`), with tests.
2. B2 fixed: hour and day windows on `plans:write`, a tombstone bound per user, live rows listed apart from tombstones, and the daily
   `planner_draft_purge()` job scheduled and run once on the child branch.
3. S4 timeouts in `withUserTransaction`; S5 merge weighting; S7 deny-list keys and the plan-route log-scan test.
4. `AUTH_QUOTA_SECRET` (16+ characters) and `DATABASE_URL` set in production; with either missing the routes answer 503 by design
   (`web/lib/server/plans.ts:200-204`), so verify a 200 on the deployed preview before switching production.
5. The privacy page paragraph of edit-my-trip 7 is live, and the account-removal runbook deletes `planner_draft` rows (S6).
6. The detector test plants a `plan-draft/1` (with `travellers`, `start`, `template.notes`) in a public body and fails, as spec 7
   requires.
7. EM-2's device side reviewed for 4.3 and 4.6: account-hashed keys deleted at sign-out and user switch, the outbox dialog, and no plan
   id in any URL the site builds (S1).
8. A rollback plan exists: the flag off needs a rebuild (N9); writes made while on stay in the account and are read by the next on.

## Sources

- PostgreSQL, CREATE POLICY (ON CONFLICT and RLS; WITH CHECK runs after BEFORE triggers):
  https://www.postgresql.org/docs/current/sql-createpolicy.html
- PostgreSQL, Function Volatility Categories (VOLATILE functions take a fresh snapshot per query):
  https://www.postgresql.org/docs/current/xfunc-volatility.html
- PostgreSQL, INSERT (BEFORE INSERT triggers run for rows later skipped by ON CONFLICT):
  https://www.postgresql.org/docs/current/sql-insert.html
- PostgreSQL, SQL/JSON path language (lax mode unwraps arrays for comparisons and methods; `.type()` and `.size()` do not):
  https://www.postgresql.org/docs/current/functions-json.html#FUNCTIONS-SQLJSON-PATH
- Neon, Plans (Free: 1 GB storage per project, 6 h restore window capped at 1 GB-month of history): https://neon.com/docs/introduction/plans
