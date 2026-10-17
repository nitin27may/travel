# 11. Quality, delivery and operations (working draft)

How the platform is tested, released and kept running on the home server. Complements 05-roadmap.md
(what to build) and 08-self-hosted.md (where it runs).

## 1. Test layers

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
| dev | laptop: Supabase CLI stack or Docker compose, Next.js dev server | seed: 64 places, Banff catalog sample, three trips |
| test | CI containers | created per run |
| home (production) | the Ubuntu box, behind the Cloudflare Tunnel | real |
| preview (optional) | a second compose project on the same box on another port, for trying a branch with a copy of last night's backup | restored copy |

## 3. CI and release

1. GitHub Actions on every push: install, typecheck, lint, unit, schema, ops and RLS tests on Postgres,
   contract snapshots, build.
2. On merge to `main`: build container images (`web`, `worker`), tag with the commit, push to GitHub
   Container Registry.
3. Release on the home server: `backup now` → `docker compose pull` → run migrations (they must be
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

Monthly: update images (backup first), review Supabase and Next.js advisories, rotate the MCP personal
tokens that are older than 90 days, check that Studio is not reachable from outside. Secrets live only in
the server's `.env` (mode 600) and GitHub Actions secrets; none in the repo.

## 7. M0 broken into tasks

| # | Task | Done when |
|---|---|---|
| 0.1 | Monorepo layout (`apps/web`, `apps/worker`, `packages/domain`, `packages/db`, `packages/ui`, `infra/`) | `pnpm -r typecheck` passes |
| 0.2 | Dev stack: Supabase local + PostGIS, seed script | `pnpm dev` shows a page reading one seeded place |
| 0.3 | Drizzle schema and first migration from `schema.sql`; RLS policies | migration applies on an empty stack; RLS tests pass with two users |
| 0.4 | `defineOp` registry, `op_event`, inverses, idempotent replay; ops: create_trip, add_item, move_item, add_note, undo | ops tests green on Postgres |
| 0.5 | Hono API at `/api/ops/*` with OpenAPI; Supabase Auth session in Next.js | a signed-in user creates a trip through the API |
| 0.6 | MCP at `/mcp`: `search`, `get`, `create_trip`, `edit_trip`; personal access tokens | Claude Code adds an item to a trip with a token |
| 0.7 | OAuth 2.1 spike on the pinned self-hosted auth image (or Cloud) | Claude's connector signs in, or the gap is written down with the token fallback |
| 0.8 | Realtime: private channel per trip, broadcast after commit, client reducer | two browsers see each other's moves |
| 0.9 | Home server: compose with rotated secrets, tunnel, Studio LAN-only, backup + restore test, health checks | the M0 exit test in 05-roadmap.md passes on the real box |
| 0.10 | CI pipeline (section 3, steps 1-2) | green on `main` |
