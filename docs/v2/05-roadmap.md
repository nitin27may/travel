# 05. Roadmap and migration

Vertical slices: each ends with something a person can use end to end, on real data, deployed.
Sizes are relative (S, M, L) because the pace depends on how many agent sessions run in parallel.

> **Status, 24 Oct 2026 (R-60).** This roadmap was written for the 17 Oct self-hosted Supabase decision, which is now
> **historical**. The owner selected Neon for Postgres, Managed Better Auth and Realtime; those are provisioned, with ten
> migrations applied and RLS on 86 application tables plus the ledger (one content-free signal table excepted;
> [NEON-MIGRATIONS.md](build/public-site/NEON-MIGRATIONS.md)). Of M0, only email and password accounts and a private
> account draft with live re-fetch exist; the rest of M0 to M7 is unbuilt. Hosting, storage, functions, the worker and
> backups are not selected; where the milestones below name Supabase, Docker or the home server, read them as the
> superseded proposal, while their exit tests and requirements still stand. Current order: [PLAN.md](PLAN.md).

## 1. Repo layout (new code beside the old, nothing deleted until replaced)

```
apps/
  web/              Next.js 16 app (host not selected); Hono API + MCP at /api and /mcp (grows out of today's web/)
  worker/           Node container: reminders, staleness, digests, email import
infra/              (historical proposal) docker compose override for self-hosted Supabase + web, worker, backup, cloudflared (08-self-hosted.md)
packages/
  domain/           ops registry, Zod schemas, checks, planner, sun, book-by, tasks (grows out of core/)
  db/               Drizzle schema + migrations (from docs/v2/schema.sql), seed, test helpers
  ui/               design tokens and components
  importers/        OSM, Wikidata, Commons, legacy-repo importers (CLI)
legacy/             unchanged; still deployed to Cloudflare Pages until each trip is rebuilt
core/, web/, tools/ frozen except fixes; retired piece by piece as packages/ replaces them
docs/v2/            this plan
```

## 2. Milestones

### M0. Foundations (M)
- Monorepo packages above; a Neon project with secrets outside the repo (done; this replaces the superseded
  self-hosted Supabase stack of 08-self-hosted.md); development and tests on Neon child branches (planned: the
  child-branch DB integration suite is blocked until `TEST_DATABASE_URL` exists); versioned SQL migrations (done: ten
  migrations from the `schema.sql` proposal plus the accepted schema diff). App hosting and a public URL are not
  selected.
- Accounts on Neon Managed Better Auth (done: email and password; magic link and Google still open, Q66), roles on
  `app_user`, user admin in `/admin`; `household`, `person`; RLS on the 86 private-content application tables and
  migration ledger (done, deny by default), with the content-free `planner_draft_signal` as the one
  coordinator-approved non-RLS exception. Household membership policies are not tested (not yet: only the account
  draft has an owner policy, cross-user isolation verified).
- `defineOp` registry with `op_event`, inverse, idempotent `client_op_id`; first ops: create trip,
  add item, move item, add note, undo.
- API at `/api/ops/*` with the OpenAPI spec; MCP at `/mcp` exposing `search`, `get`, `create_trip`,
  `edit_trip` with OAuth; tested from Claude.
- CI: typecheck, lint, ops tests against a throwaway Postgres + PostGIS container, migration check (apply on a copy of the latest backup).
- Nightly `pg_dump` (database and auth data) and a copy of stored files to an offsite location; one restore test (mechanism not chosen; Neon's own restore window does not replace the restore test).

**Exit:** sign in on a phone, create a trip, add a custom item; from Claude, add an item to the same
trip and see it appear in the app with "added by Claude" and a working undo.

### M1. The catalog with one destination (M)
- Importers: area tree and polygons, POIs and trails from Wikidata/OSM for **Banff and Lake Louise**.
- Import today's 64 places and the Rockies `data/*.json` (48 sights, 62 trails, 33 bookings, 43
  adventures) as entities, offers and evidence with their existing sources.
- Changesets and the review queue in `/admin`; research tools in the MCP (`research_brief`,
  `start_job`, `propose`, `submit_job`); one real research run through Claude on Lake Louise trails.
- Explore page: map + cards + filters + persona chips + zero-result rescue; entity sheet with
  evidence and trust; Commons media.

**Exit:** a Banff area guide with good coverage, built by importers plus one MCP research run that
went through review; search "lakes under 8 km, kids 9+" returns the right things with reasons.

### M2. Trip builder (L)
- Plan document view (Wanderlog-style lists + days beside the map) as the default desktop view; named lists.
- Intent sheet with household defaults; candidates compare; browse-and-pick with **+ Add** to Ideas or a day.
- Day board (desktop) and day pager (phone), dnd-kit, variants, Plan B, spans, nested items.
- Day checks with one-tap fixes; the deterministic "Draft my days" preview.
- Universal **+**: catalog search, custom item, pasted link, dropped pin.
- Day-trip flow from home with drive-time ranking (ORS + `leg_cache`).
- Read-only share link; invite an editor; **live co-editing**: a private per-trip channel broadcasting committed ops, presence avatars on items, gap recovery by version (transport to be designed; today Neon Realtime is used only to invalidate a user's own account draft, followed by an authenticated re-fetch).

**Exit:** two phones open the same trip; a move on one shows on the other in under a second, and
the owner rebuilds the **Canadian Rockies 2029** trip in the app (14 nights, 3 tracks per
day) faster than editing the legacy page, and the result's day checks match what PLAN.md says.

### M3. Book, tasks and reminders (M)
- Reservations (09-reservations.md): forms per kind, segments, travellers, secrets, anchored items, night bases, flight and car bounds on days; to-book placeholders with tasks; the booking timeline; the wallet.
- Offers with booking windows; `opens_at`/`book_by` for to-book reservations.
- Tasks: generated (bookings, windows, document rules for Canadian citizens, packing templates) and manual.
- Reminders: Web Push, email, ICS feed and per-deadline `.ics`; a scheduled worker polls due reminders every 30 s (runtime not selected); Inbox.
- Email import (07-competitors.md 4): forward a confirmation, get a booking and item; schema.org markup first.
- Readiness bar and the phase-aware trip dashboard; the travel year view with long weekends.

**Exit:** the Algonquin-style "day permit opens 5 days ahead at 07:00" produces a push at 06:45 and
07:00 on a real phone, and a "did you get it?" two hours later.

### M4. Go: offline and Today mode (M)
- PWA install, IndexedDB trip cache, offline op queue with replay, PMTiles area extract, attachments cached.
- Today mode: next stop with "leave by", timeline, running late, tickets, sun and Open-Meteo weather,
  Plan B toggle, quick notes; tomorrow briefing.
- GPX and ICS exports; Google Maps multi-stop link.

**Exit:** a full day of the Algonquin or Vermont trip runs in airplane mode on a phone, and the notes
taken offline appear on the laptop afterwards.

### M5. Templates, sharing, after (S)
- Publish as template with a privacy preview; fork with new dates; public template pages with
  JSON-LD and `llms.txt`.
- "How did it go?" with corrections as changesets.
- Landing page for the public site.

**Exit:** a stranger forks the Rockies template into their own account with their own dates and
party, and none of the owner's family data is visible anywhere in the result.

### M6. Grow the catalog (ongoing)
Backlog-driven research per destination already planned (Patagonia, Iceland, Norway, Dolomites,
Chamonix, Utah, Switzerland, Algonquin/Muskoka, Vermont, Québec), conditions checks before each trip,
staleness refresh. Server-run research only when the owner decides (B4).

### M7. Smarter planning (later)
Route-corridor stop suggestions, a scored planner (v2), pgvector "places like this", self-hosted
Valhalla if ORS quotas bite.

## 3. Migration of what exists

| Today | Becomes | How |
|---|---|---|
| `core/src/sun`, `bookings/bookBy.ts`, `checks/` | `packages/domain` | moved with their tests; pure functions survive the change of store |
| `core/src/schema` (Zod), `ops/`, `store/` | partly reused | the schemas map onto the new tables where they match; the file store and the 16 file-based ops are replaced by ops on Postgres. **The trip shape changes** (no `edition`, items with optional day/time/span/parent), so this is a port, not a copy |
| `core/src/mcp` (read-only stdio MCP) | replaced by the remote `/mcp` | tool names change to the grouped set in 03 |
| `data/locations/locations.json` (64 places), `data/vocab/tags.json` | entities, evidence and the tag vocabulary | importer; `locations.py` stays working until M1 ends, then the `location` skill calls the MCP instead |
| `data/catalog/*` | entities, offers, legs | importer |
| `legacy/canadian-rockies-sept-2029/data/*.json` | a real trip + catalog rows | importer in M1, rebuilt and checked in M2 |
| Other legacy pages (hand-written HTML) | stay live on Cloudflare Pages at their URLs | rebuilt as trips only when the trip is next revised; no bulk conversion |
| `research/` Markdown | stays in git as research history | key facts enter as evidence when a trip is rebuilt |
| `web/` (Next.js list views) | becomes `apps/web` | owner chose Next.js: the app, its components and Playwright tests carry over; static export is dropped for server rendering; Vercel selected as host, deployment after merge-ready (PLAN R-61) |
| `publish.sh`, `tools/publish.py` | legacy only | the new app deploys on Vercel after merge-ready; these scripts remain the frozen old-site path (the home-server containers plan is historical) |
| `docs/archive/v1/PLAN-platform.md` (archived) phases P4b, P4c, P5+ | **paused** where they write to the file store | P4c (bulk import into JSON files) would be wasted work; its importers are rewritten against Postgres in M1 |

## 4. What stays manual for the owner during the move

Nothing is lost on day one: the legacy site keeps working, `publish.sh` keeps deploying it, and the
trip-planner skill keeps producing pages until M2's exit shows the app is better for a real trip.
