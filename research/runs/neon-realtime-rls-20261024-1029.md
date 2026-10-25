# neon-realtime-rls — Live subscription blocked by RLS on `planner_draft`

Run id: `neon-realtime-rls-20261024-1029` · lane: web (app) · model: Opus

## Summary

After the schema lane applied all 9 migrations to production (table `public.planner_draft`
present, `travel_app` role ready), the account **write path and auth path work end to end**, but the
**live subscription is rejected by Neon Realtime** with `upstream rejected`. The root cause is a
current Neon Realtime limitation, not an app-lane bug:

> **Neon Realtime rejects any subscription to a table that has Row-Level Security enabled.**

Migration `0009_planner_draft.sql` runs `alter table planner_draft enable row level security`
(plus owner-predicate policies). That is exactly what blocks the live list.

## Evidence (reproducible, headless, against production branch)

1. Browser E2E against `next start` on `:3000`, two contexts of one user: the write **reaches the
   DB** (row present in `public.planner_draft`), but the watcher never receives it and the writer's
   own row disappears after the sync timeout. The account UI shows **"Live updates stopped."**
2. WebSocket frames on the real subscription:
   - `← {"type":"ready"}`
   - `→ {"type":"subscribe","request_id":"1","authorization":"***"}`
   - `← {"type":"subscribe_rejected","code":"upstream_rejected","message":"upstream rejected"}`
3. DB introspection: `wal_level=logical` ✓, `planner_draft` replica identity = default (`d`, PK) ✓
   — the official doc says *"a primary key is all Realtime needs"* — `travel_app` has
   SELECT/INSERT/UPDATE/DELETE ✓. **No publication is required** (Neon Realtime manages its own).
4. **Isolating probe** (headless, seal with `@neon/realtime/server` + subscribe with
   `@neon/realtime/client`), throwaway table, dropped after:
   - Table **without** RLS → subscription goes **`live`**, 1 row. ✓
   - Same table **with** `enable row level security` + a permissive `using (true)` policy →
     **`upstream rejected`**. ✗
   The policy content is irrelevant; merely enabling RLS triggers the rejection.

This matches the Neon Realtime docs (realtime/guides/queries): RLS *"isn't our recommended approach
to auth … we aim to implement support before GA."* The sanctioned pattern (and the official
`realtime_next_todos` example) does **not** enable RLS; it authorizes reads via the embedded
sealed-query predicate (`where user_id = $1`) and scopes writes to the verified session id.

## Impact

The entire account live list is blocked: `AccountDrafts` enters `status === 'error'` and renders the
"Live updates stopped" block instead of the list, so **loaded / empty / live-insert states cannot
render** and those screenshots cannot be captured while RLS is on. CRUD still commits to the DB.

## Recommended remedy (schema lane / coordinator — NOT the web lane)

The web lane (`web/**`, deps/lock) cannot fix this: it needs a DB-structure change owned by the
schema lane (`core/src/db/migrations/0009_planner_draft.sql`) and/or a security-model decision by the
coordinator. Options, least invasive first:

1. **Drop RLS on `planner_draft`** (align with the Neon-recommended pattern the official example
   uses). Reads are authorized by the sealed `where user_id = $1`; writes by the server actions,
   which always bind `user_id`/predicate from the verified session (`and user_id = $2`,
   `on conflict do nothing`) under the least-privilege `travel_app` role.
2. If DB-level write ownership must be kept without RLS, **replace the RLS policies with a
   `before insert or update` trigger** that raises when `new.user_id <> app_current_user_id()`.
   A trigger does not block Realtime; RLS does. This preserves the forged-write rejection the
   isolation proof asserts, while letting the live subscription connect.
3. Wait for Neon Realtime RLS support (pre-GA) — not viable now.

Note for the isolation E2E: step `neon-e2e.mjs` currently proves cross-user rejection by issuing an
update **without** a `user_id` predicate as user B and expecting 0 rows (pure RLS). If the remedy is
option 1 (drop RLS), that assertion must change to drive the **server action** as user B (which
carries the `and user_id = $2` predicate) — the app-level guard — since raw-SQL RLS is gone. If the
remedy is option 2 (trigger), the current raw-SQL assertion stays valid.

## App-lane status (verified ready, pending the DB decision)

- `npm run build` (root → web via `with-root-env.mjs`): green, `NEXT_PUBLIC_SIGN_IN=1`.
- `tsc --noEmit` web + core: clean. Unit tests: 37/37 (`tests/account`, `tests/shell`).
- Write path reaches `public.planner_draft` through the shared `withUserTransaction` (travel_app +
  `app.user_id`). Auth: signup→session, anonymous `/account/`→`/sign-in/`, same-origin renewal gate
  (403 cross-origin), 401 after sign-out — all confirmed live.
- The live list is the only blocked piece, and it is blocked entirely by the RLS/Realtime conflict
  above.
