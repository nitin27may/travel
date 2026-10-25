# Neon Realtime live list — blocker resolved end to end (invalidation stream)

Run id: neon-realtime-invalidation-20261024-1420
Model: Opus (shared security architecture)
Date: 2026-10-24

## Objective

Make the account live-draft list work over Neon Realtime **without weakening RLS** on any private
table, then prove it with a real browser E2E and screenshots.

## Verified blocker (prior run, reconfirmed)

Neon Realtime (pre-GA) rejects any subscription whose sealed query resolves to an RLS-enabled
relation (`upstream_rejected`) — base table and both view security modes. There is no view/authorized
escape. `planner_draft` has RLS, so Realtime cannot read it directly.

## Resolution (coordinator-approved G2 exception)

Invalidation-only stream + authenticated re-fetch:

- `planner_draft` keeps RLS. New `planner_draft_signal (user_id, version, changed_at)` holds **no
  content** — RLS intentionally off (the only RLS-off app relation). `travel_app` has **no grant** on
  it. A `SECURITY DEFINER` trigger on `planner_draft` bumps the signal in the **same transaction** as
  the write, so its txid lands on the stream for `awaitTxId`.
- The client subscribes to a sealed `where user_id = $1` signal query, and on each version bump calls
  the authenticated, same-origin `/api/account/drafts/` route to re-read the drafts through
  `withUserTransaction` under RLS. No draft content ever travels over Realtime.

## Evidence

### Database (production branch `br-soft-glade-b4mkqyvd`, migration 0010 applied)
- `planner_draft.relrowsecurity = true` (RLS preserved); `planner_draft_signal.relrowsecurity = false`.
- Signal columns: `user_id, version, changed_at` (content-free). `travel_app` grants on signal: none.
- Triggers on `planner_draft`: `planner_draft_signal_t`, `planner_draft_touch_t`.

### Realtime delivery (isolated Node probe, throwaway synthetic user, deleted in finally)
- insert → materialized `data` version "1"; update → "2"; delete → removed. Delivery + materialization
  work for the non-RLS signal table. (The initial false negative was the probe reading `.rows`/`.state`
  instead of the SDK's `.data`/`.status`.)

### Origin allowlist (the real browser-side gate)
- The browser WebSocket handshake to the Realtime endpoint returned **403** when the app was served on
  `:3200` (not an allowed origin). `neon.ts` declares `realtime.allowedOrigins = [http://localhost:3000,
  http://127.0.0.1:3000]` (deployed; production branch "already matches policy"). Serving on **:3000**
  resolves it. No secret rotation, no production config change needed.
- Also fixed: the client fetched `/api/account/{live-query,drafts}` without a trailing slash →
  `trailingSlash` 308 redirect; added the trailing slashes.

### Real browser E2E (`neon-e2e.mjs`, real Neon auth + Realtime + Postgres, no mocks), 12/12:
- same-user live insert / rename / delete propagate to a second context (no reload) — via signal +
  re-fetch;
- draft persists across a full reload; sign-in UI reaches `/account/`; renewal after sign-out → 401;
- cross-user RLS isolation: user B cannot update/delete A's row (0 rows), A's row intact, B sees none
  of A's drafts.

### Screenshots (web/test-results/shots/, 1440x900 + 390x844, light + dark, 2x, GPU Metal)
- `account-signed-in-{1440x900,390x844}-{light,dark}.png` — loaded list with the "Live" indicator
  connected; no overlap/clipping/contrast issues. (plus sign-in / sign-up.)

## Tests
- core: typecheck clean; db unit 22/22; integration 7/7 on child branch `br-damp-breeze-b41mtvn5`
  (signal RLS-off/content-free/app-role-denied; trigger bumps only acting user, monotonic).
- web: typecheck clean; account unit (title/parseDraftRows, live-query, drafts-route, actions) + boundary
  + env-table + hardcode-scan green. Root `npm run build` passes.

## Notes / leftover
- 3 content-free signal rows remain for the E2E's synthetic users (the E2E deletes drafts only; a
  user who deletes all drafts legitimately keeps a signal row). No content, no leak.
- Full live subscription is only exercisable on the production compute (Realtime is pinned there);
  DB mechanics are verified on the child branch.
- No commits made (per task). Independent verifier plus docs and spec alignment follow as separate tasks.
