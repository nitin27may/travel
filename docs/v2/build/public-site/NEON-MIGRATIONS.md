# Neon migrations (database lane)

Owner of this file and of `core/src/db/**`, `core/bin/db-*.ts`, `core/test/db/**`: the database /
migration lane. Supersedes the catalogue-half input of `research/reports/schema-diff-2026-10.md`
only where this file applies the accepted decisions as real DDL. Written 24 Oct 2026. Model: **Opus**
(cross-cutting: a shared contract, security/RLS, identity adaptation, >3 interdependent files —
"Model by task complexity" in `CLAUDE.md`).

## What this lane delivers

1. A **migration runner as code** — versioned, checksummed, advisory-locked and transactional
   (`core/src/db/loader.ts`, `runner.ts`, CLI `core/bin/db-migrate.ts`).
2. **Nine SQL migrations** that create every application table — the 62 proposal tables of
   `docs/v2/schema.sql` (minus the `auth.users` test stub) **plus** the tables introduced by the
   accepted schema diff (M1–M15) **plus** the `planner_draft` integration contract — with
   **row-level security enabled on every one** before use.
3. **Text application identities** compatible with Managed Better Auth. The provider schema
   `neon_auth` (`neon_auth.user`, `session`, `account`, …) is **never created or altered here**.
4. A **least-privilege runtime role** (`travel_app`: non-owner, `NOBYPASSRLS`, no `LOGIN`, no CREATE),
   **no PUBLIC grants** on application tables, and **owner-predicate RLS** on `planner_draft` keyed on
   a transaction-local, server-verified identity.
5. A **shared runtime transaction helper** (`core/src/db/tx.ts`) that the app lane consumes.

Public catalogue serving stays on JsonStore: creating the catalogue tables here is **not** a claim
that the PostgresStore cutover is done. No data is loaded.

## Identity model (text, Better Auth)

- `app_user.id` is **`text`** — the verified Better Auth user id as a string. No foreign key to the
  provider table (the provider owns `neon_auth.user`, keyed as `uuid`); we store the id verbatim.
- Every former `uuid` user-identity column (`owner_id`, `user_id`, `created_by`, `author_id`,
  `actor_id`, `requested_by`, `reviewed_by`, `uploaded_by`, `dismissed_by`, `owner_user`, `added_by`)
  is now **`text references app_user(id)`** (or bare `text` where the original had no FK).
- Runtime identity flows **only** from the verified server session into the transaction-local setting
  `app.user_id` — never from a request body. RLS reads it via `app_current_user_id()`.

## The runner

`core/src/db/loader.ts` reads `core/src/db/migrations/NNNN_name.sql`, parses the version/name, and
computes a sha256 over the exact file bytes. `core/src/db/runner.ts`:

- acquires a **session advisory lock** (`pg_advisory_lock`) for the whole run, so two processes never
  migrate at once; it **fails closed** — if the lock cannot be taken, it aborts *before* any DDL or
  ledger write (no silent unlocked fallback);
- keeps `plan`/`status` and `dryRun` **strictly read-only**: it reads the ledger via
  `to_regclass` and returns an empty list when the ledger does not exist yet, so inspection never
  creates or writes anything;
- when applying, ensures a `schema_migrations` ledger (`version, name, checksum, applied_at,
  applied_by`) with PUBLIC revoked **and RLS enabled** (owner-only; no policy, no `travel_app` grant,
  so the ledger is as locked down as every application table);
- **refuses to run** when an applied migration's on-disk checksum has changed (destructive edit), when
  an applied migration's file is missing, or when a new migration is inserted before an applied one
  (out-of-order);
- applies each pending migration **in its own transaction**, recording the ledger row atomically with
  its DDL; a failure rolls that migration back and stops. A failed rollback or advisory-unlock logs
  only the SQLSTATE code — never SQL, parameters, or connection secrets.

CLI (load secrets from the ignored env file; connect over the **direct/unpooled** owner connection):

```
node --env-file=.env.local core/bin/db-migrate.ts status   # applied vs pending
node --env-file=.env.local core/bin/db-migrate.ts plan     # dry run, no writes
node --env-file=.env.local core/bin/db-migrate.ts up       # apply pending
```

## Migrations

| # | File | Creates |
|---|---|---|
| 0001 | `bootstrap` | extensions (postgis, pg_trgm, unaccent, ltree), `unaccent_immutable`, `app_current_user_id()`, the `travel_app` role, schema lockdown (revoke PUBLIC, default-privilege revokes) |
| 0002 | `people` | `app_user`, `household`, `household_member`, `person`, `membership` (RLS, no policy) |
| 0003 | `catalogue` | vocab (`type_node`, `tag`, `relevance_class`), `area`, `town`, `operator`, `entity` (id = ref), `entity_alias`, `saved_place`, `offer` (1:1 on entity), `relation`, `entity_link`, `track`, `condition_report`, `event_occurrence`, `source`, source tier (`dataset_file`, `record_doc`, `source_local`, `capture_supersede`), `evidence`, `freshness_rule`, `media`, `leg_cache`, `saved_view`, `suitability`, `relevance`, `relevance_derived`, `relevance_signal`, `catalogue_meta` + public-read policies/grants |
| 0004 | `plans` | `trip` and trip-owned tables, reservations, `trip_item`, `trip_night_base` (security_invoker), `day_note`, `task`, `reminder`, `attachment`, `budget_line`, `expense` (RLS, no policy) |
| 0005 | `reference` | reference/notifications/sharing/trip-state tables (RLS, no policy) |
| 0006 | `research` | research & review queue, `lane`, `trip_type`, `coverage`, `backlog`, `op_event` (RLS, no policy) |
| 0007 | `projections` | `place_row`, `place_page`, `trip_row`, `trip_page` (public read; empty until the loader runs) |
| 0008 | `household_private` | `saved_source`, `visit`, `collection`, `collection_place` (RLS, no policy, nothing loaded) |
| 0009 | `planner_draft` | the integration table, owner-predicate policies, grants, `updated_at` trigger |
| 0010 | `planner_draft_signal` | a content-free invalidation stream for the live draft list (no RLS on it: the Neon Realtime rule in its header) |
| 0011 | `quota` | fixed-window quota counters for the auth guard and the owner-alert budget (EML-Q); keys are HMACs, never raw |

**Numbers taken:** 0001 to 0011 are on main. A migration added later takes the next free number when its branch merges (MIG-N, PLAN R-146); specs name it by slug, never by number.

## RLS and least privilege

- **Public-read serving tier** (`PUBLIC_READ_TABLES` in `core/src/db/inventory.ts`): `for select`
  policy and a `select` grant to `travel_app`; `entity` gated to `status='published'`, `media` to
  `status='approved'`.
- **Source-tier / internal** tables: RLS on, no policy, no grant (deny).
- **Household & planner** (37 proposal + 4 private + reference): RLS on, no policy, no grant (deny).
- **`planner_draft`**: owner-predicate policies for select/insert/update/delete using
  `user_id = app_current_user_id()` (insert/update also `with check`), and a `select,insert,update,
  delete` grant to `travel_app`.
- **No PUBLIC grants** on any application table (asserted in the integration test).
- `travel_app` is `NOBYPASSRLS`, `NOSUPERUSER`, no `LOGIN`, no CREATE. The owner connection drops to
  it per transaction (`set local role travel_app`), so RLS is enforced on all application traffic;
  migrations and the offline loader run as the owner (full access).

## Shared runtime contract (for the app lane)

Exported from `core/src/db/index.ts`:

- `getPool(url?)` — lazy, cached `pg.Pool` (the `pg` driver is imported dynamically; **the app lane
  owns the `pg`/`@types/pg` dependency**). Reads `DATABASE_URL` (pooled) by default.
- `withUserTransaction(userId, fn, poolUrl?) → { result, txid }` — checks out a pooled connection,
  `begin`, `set local role travel_app`, binds `app.user_id` from the **server-verified** `userId`,
  runs `fn(ctx)`, commits, and returns the result with the Postgres transaction id (`txid_current()`).
  Rolls back on error. Identity never comes from client input.
- `sealedDraftQuery()` — `{ sql, params(userId) }` for the **Realtime** subscription. Realtime does
  **not** enforce application RLS, so the live query embeds `where user_id = $1` as its own
  authorization. The app passes the verified session id; a full session change must unload prior-user
  client state.
- `APP_ROLE` (`"travel_app"`), `USER_ID_SETTING` (`"app.user_id"`).

Connection intents: **migrations** use `DATABASE_URL_UNPOOLED` (direct, owner); **runtime** uses
`DATABASE_URL` (pooled) and drops to `travel_app` per transaction.

## Schema deviations from `docs/v2/schema.sql` (surfaced, not silently dropped)

Applied from the accepted diff (M1–M15) and the identity brief:

- **Identities → text** everywhere (above); the `auth` schema and `auth.users` stub are **removed**
  (Managed Better Auth owns identity; `neon_auth` is provider-owned).
- **`entity`**: `id` holds the `ref` verbatim; added `layer` (not null, replaces the `entity_kind`
  enum, which is dropped), `type_id`, `point_role`, `point_approx`, `point_src`, `near_town_id`,
  `near_town_km`, `route_is_attraction`, `attraction_reason`, `origin`, `doc`; `slug` nullable unique;
  `kind` nullable text; `wikidata_qid` **UNIQUE dropped** (plain index); generated `trail_km` /
  `trail_gain_m` **dropped** (they read a path holding no data).
- **`offer`**: primary key is now `entity_id` (1:1 extension of `entity`); `kind`/`window_rule`/
  `sellout` enums replaced by `offer_class` + `price jsonb` + `"window" jsonb`; `run_by` → `operator`.
  `reservation.offer_id` and `trip_item.offer_id` now reference `offer(entity_id)`.
- **`entity_link`**: `url` nullable with `check (state <> 'filled' or url is not null)`; added `state`,
  `query`, `checked_on`, `src[]`; uniqueness is `unique nulls not distinct (entity_id, kind, url)`.
- **`track`**: `entity_id` nullable; `source`/`...` checks widened; added `meta`, `elevation`.
- **`source`**: `kind` check widened (editorial/agency admitted); added registry/link-check columns.
- **`coverage.kind`**: `text` (the `entity_kind` enum was dropped).
- **`area`**: added `slug`, `iso_a3`; **new** `town`, `operator`, `type_node`, `tag`,
  `relevance_class`, `entity_alias`, source tier, `suitability`/`relevance`(+derived/signal),
  `capture_supersede`, projections, and the private `saved_source`/`visit`/`collection`/
  `collection_place`.
- **`trip_night_base`** view created `with (security_invoker = true)` so it respects RLS (PG15+).

Note `area.path ltree not null`: labels are built with `-`→`_` and `/`→`.`; no rows are loaded yet.

## Verification (isolated child branch, 24 Oct 2026)

Branch: **`srv-migrate-verify`** (id `br-damp-breeze-b41mtvn5`) off `production`, project
`damp-queen-64719841`, region aws-us-east-2. Postgres **18.6**. No checkout switch; root `.env.local`
untouched. The branch connection string is kept only in a local, uncommitted file.

- `db-migrate up` on a clean branch applied all 9 migrations; a second run reported "up to date"
  (idempotent); `status` shows 9 applied, 0 pending.
- **Inventory**: all 86 application tables (62 proposal + 24 new) present, each with
  `rowsecurity = true`. No application table grants to PUBLIC. `travel_app` holds `select` only on the
  serving tier, nothing on `trip`/`household`.
- **planner_draft isolation** through `withUserTransaction`: user A sees only A's drafts, B only B's;
  B cannot update/delete A's rows (0 affected) nor forge an A-owned row (RLS `WITH CHECK`, SQLSTATE
  42501); the empty title is rejected (check constraint 23514); the app role is denied any read of a
  household table (42501); each write returns a numeric `txid`.
- Tests: `core/test/db/{loader,inventory,runner}.test.ts` (pure, 21 cases — including fail-closed
  lock and read-only `plan`/`dryRun` guards) and `core/test/db/integration.test.ts` (5 cases, run
  with `TEST_DATABASE_URL` against the branch) all pass; `pnpm --dir core typecheck` is clean; the
  full core suite passes with the integration suite skipped offline.

## Production application (applied 24 Oct 2026)

**Applied to production** under explicit user authorization, after the isolated-branch verification
above. Production branch `production`, project `damp-queen-64719841`, org `org-fancy-dream-16320709`,
region aws-us-east-2, Postgres **18.6**. Applied over the **direct/unpooled owner** connection from
root `.env.local` (no secrets committed). Application is **additive only** — no drops, no destructive
reset.

```
node --env-file=.env.local core/bin/db-migrate.ts plan   # applied: 0, pending: 9 (read-only; wrote nothing)
node --env-file=.env.local core/bin/db-migrate.ts up     # applied 9: 0001…0009
node --env-file=.env.local core/bin/db-migrate.ts up     # up to date; nothing to apply (idempotent)
node --env-file=.env.local core/bin/db-migrate.ts status # applied: 9, pending: 0
```

Post-application checks against production:

- **86 application tables** all present with `rowsecurity = true`; the `schema_migrations` ledger is
  RLS-enabled too (87 RLS tables). The only non-RLS relation is PostGIS `spatial_ref_sys` (system
  table), as expected.
- `travel_app` is confirmed `NOBYPASSRLS` and `NOLOGIN` (`rolbypassrls = f`, `rolcanlogin = f`).
- `core/test/db/integration.test.ts` run with `TEST_DATABASE_URL` = production (5 cases) passes:
  inventory, no-PUBLIC-grants, serving-tier-only `select`, `planner_draft` per-user isolation through
  `withUserTransaction`, and household deny. Synthetic rows used unique `itest-…` ids and were deleted
  in teardown; a follow-up count of `planner_draft where user_id like 'itest-%'` returned **0**.

The runner's drift/missing/out-of-order guards make any re-run safe. Private household, traveller,
booking and saved-location tables are created empty and receive no public read grant; no private
repository data was uploaded.
