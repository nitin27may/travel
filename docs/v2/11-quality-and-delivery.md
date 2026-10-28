# 11. Quality, delivery and operations (working draft)

How the platform is tested, released and kept running. Complements 05-roadmap.md (what to build) and
04-stack.md (what it runs on).

> **Status, 24 Oct 2026 (R-60).** The home-server operations below were written for the self-hosted Supabase plan
> (08-self-hosted.md), now **historical**: Neon Postgres, Managed Better Auth and Neon Realtime are selected and
> provisioned; Vercel is selected for frontend hosting (project setup/deployment after merge-ready, PLAN R-61), while
> object storage, functions, the worker and the backup mechanism are **not selected**. Read
> sections 2, 3, 4 and 6 as proposals to adapt for Vercel; the test layers, the release gates, backup
> retention and restore tests, and the security routine remain requirements. What exists today: ten checksummed
> migrations, RLS on 86 application tables and the ledger (the content-free `plan_draft_signal` is the one
> coordinator-approved exception, with no app grants), email and password accounts, and a private account draft whose
> real-service E2E (14 checks, including cross-user isolation) passed in an earlier independent run recorded, not rerun,
> in the final verification ([NEON-VERIFICATION.md](build/public-site/NEON-VERIFICATION.md)). The child-branch DB
> integration suite is **blocked** (no `TEST_DATABASE_URL`), so its cases count as skipped, not passed.
>
> **Last verified 25 Oct 2026 against main 4230210** ([audit](MASTER-PLAN-AUDIT-2026-10-25.md)): the child-branch suite
> now passes 29 of 29 against `br-damp-breeze-b41mtvn5`; the real-service E2E is blocked by the origin guard until an
> HTTPS origin exists; production is Vercel project `travel` (one environment: Preview and Production both use the
> production Neon branch; the child branch is for spikes and DB tests only); previews sit behind Vercel Authentication;
> GitHub Actions secrets exist but no workflow file does, so CI (section 3) is not running. Task 0.7 (OAuth spike for
> MCP) is now MCP-0 in [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md).

## 1. Test layers

> **Planned 25 Oct 2026 ([build/TEST-STRATEGY.md](build/TEST-STRATEGY.md), R-210 to R-214):** the "Runs" column below
> becomes a tier: the unit, schema, contract and research layers run at T0 and T1 only for the paths a change touches
> (selected by `tools/gate/map.json`), in full at T2 per stack of branches and at T3; UI end to end, accessibility and
> performance run at T2 (mapped specs and the smoke set) and T3 (the full e2e). "Every commit" no longer means every
> suite on every commit once TS-2 ships.

| Layer | What it covers | Tool | Runs |
|---|---|---|---|
| Domain unit | pure functions: sun, book-by, day checks, planner, adapt-template, budget maths, fractional ordering, op reducer | Vitest | every commit, < 30 s |
| Schema | every Zod schema against fixtures; JSON Schema export unchanged unless intended | Vitest | every commit |
| Operations | every op against **real Postgres + PostGIS** in a throwaway container: input validation, effect, inverse (apply then undo leaves the database identical), idempotent replay by `client_op_id`, `op_event` row | Vitest + testcontainers | every commit |
| Security | RLS with two users and a guest link: user B cannot read or write user A's trip, person, reservation secret or attachment; guest link returns only its includes; MCP token without `reservations:read` never sees codes | Vitest on Postgres | every commit; a failing test blocks merge |
| API and MCP contract | OpenAPI and MCP tool schemas generated from ops are snapshot-tested; one call per tool through the real HTTP handler | Vitest | every commit |
| Realtime | two clients on one trip: an op on one appears on the other; a gap triggers "ops since version N" | Playwright (two browser contexts) | nightly and before release |
| UI end to end | the flows that matter: create trip → add place → move to day → add reservation → task appears → share guest link → open as guest; Today mode offline (service worker, airplane mode simulation) | Playwright | before release |
| Accessibility | axe on every screen in light and dark; keyboard-only run of the plan document and share sheet | Playwright + axe | before release |
| Performance | a 14-night, 3-track trip (the Rockies import) opens in < 2 s on a mid-range phone profile; drag stays at 60 fps; search answers in < 300 ms | Playwright traces | before release |
| Data quality | nightly job: dangling references, stale fields, broken links (`entity_link.http_status`), duplicate candidates | worker | nightly, results in `/admin` |
| Research | each lane contract has validator tests; a sample changeset per lane must pass | Vitest | every commit |

Rules: no mocks for the database; fixtures are real trips from this repo (Dolomites, Rockies, Algonquin);
a bug fix lands with the test that would have caught it.

## 2. Environments

| Env | Where | Data |
|---|---|---|
| dev | laptop: Next.js dev server against a Neon development branch (the Supabase CLI and compose stacks are historical) | seed: 64 places, Banff catalog sample, three trips (no loader yet) |
| test | CI containers | created per run |
| production | Neon for data, auth and realtime; the app host is Vercel (project `travel`, `https://travel-beta-tan.vercel.app`, no production deployment yet); the Ubuntu box behind a Cloudflare Tunnel is the historical plan | real |
| preview (optional) | a second compose project on the same box on another port, for trying a branch with a copy of last night's backup | restored copy |

## 3. CI and release

1. GitHub Actions on every push: install, typecheck, lint, unit, schema, ops and RLS tests on Postgres,
   contract snapshots, build.
2. On merge to `main`: build container images (`web`, `worker`), tag with the commit, push to GitHub
   Container Registry.
3. Release (written for the historical home server; adapt to the chosen host): `backup now` → `docker compose pull` → run migrations (they must be
   additive or come with a written down-path) → `up -d` → smoke check `/health`, sign-in, one MCP call.
   One script (`infra/release.sh`), run by hand at first.
4. Rollback: previous image tags plus the backup taken in step 3.
5. Migrations are reviewed like code; destructive ones need two steps across two releases (add new, move
   data, drop old later).

## 4. Observability on one machine

- Structured JSON logs from web and worker to the Docker log driver; a weekly rotated file.
- Error tracking: Sentry free tier (or self-hosted GlitchTip if preferred) for web, worker and browser.
- Health: `/health` checks database, storage and the worker's last heartbeat; Healthchecks.io pings for
  the nightly backup and the reminder loop; UptimeRobot (or similar) on the public URL to the owner's phone.
- Product signals from `op_event`: trips created, items added, reminders sent and acknowledged, MCP calls
  per client, research changesets accepted.

## 5. Backups and recovery

Nightly database dump (all schemas) and storage sync to an offsite bucket, kept 14 daily and 8 weekly,
encrypted client-side (rclone crypt). A monthly restore into the preview stack, checked by a script that
counts rows per table and opens one trip. Recovery target for family use: lose at most one day, back up
within two hours.

## 6. Security routine

Monthly: update images (backup first), review Neon, Better Auth and Next.js advisories, rotate the MCP personal
tokens that are older than 90 days, check that no admin console or owner database connection is reachable from
the browser or the public internet. Secrets live only in an ignored local env file, the chosen host's secret store
and GitHub Actions secrets; none in the repo.

## 7. M0 broken into tasks

| # | Task | Done when |
|---|---|---|
| 0.1 | Monorepo layout (`apps/web`, `apps/worker`, `packages/domain`, `packages/db`, `packages/ui`, `infra/`) | `pnpm -r typecheck` passes |
| 0.2 | Dev stack: Neon development branch + PostGIS (was Supabase local, historical), seed script | `pnpm dev` shows a page reading one seeded place (seed not built) |
| 0.3 | Migrations from `schema.sql` and the schema diff (built as plain SQL with a checksummed runner, not Drizzle); RLS policies | migration applies on an empty stack; RLS tests pass with two users (done for the account draft only; membership policies to come) |
| 0.4 | `defineOp` registry, `op_event`, inverses, idempotent replay; ops: create_trip, add_item, move_item, add_note, undo | ops tests green on Postgres |
| 0.5 | Hono API at `/api/ops/*` with OpenAPI; Managed Better Auth session in Next.js (session done; was Supabase Auth) | a signed-in user creates a trip through the API (not yet: only a private draft) |
| 0.6 | MCP at `/mcp`: `search`, `get`, `create_trip`, `edit_trip`; personal access tokens | Claude Code adds an item to a trip with a token |
| 0.7 | OAuth 2.1 spike for MCP on Managed Better Auth (the self-hosted auth image is historical) | Claude's connector signs in, or the gap is written down with the token fallback |
| 0.8 | Realtime: private channel per trip, broadcast after commit, client reducer (today only a per-user draft signal with authenticated re-fetch) | two browsers see each other's moves |
| 0.9 | Production host (not selected; the home server is historical): rotated secrets, no public admin surface, backup + restore test, health checks | the M0 exit test in 05-roadmap.md passes in production |
| 0.10 | CI pipeline (section 3, steps 1-2) | green on `main` |
