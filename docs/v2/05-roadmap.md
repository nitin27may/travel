# 05. Roadmap and migration

Vertical slices: each ends with something a person can use end to end, on real data, deployed.
Sizes are relative (S, M, L) because the pace depends on how many agent sessions run in parallel.

## 1. Repo layout (new code beside the old, nothing deleted until replaced)

```
apps/
  app/              React Router 7 app + Hono API + MCP, one Cloudflare Worker (web, /api, /mcp)
  cron/             Cron Worker: reminders, staleness, digests
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
- Monorepo packages above; local Postgres + PostGIS in Docker (`docker compose up`); Neon project with
  `main` and a `dev` branch; Drizzle migrations from `schema.sql`.
- Better Auth (email magic link + Google), roles, admin plugin; `household`, `person`.
- `defineOp` registry with `op_event`, inverse, idempotent `client_op_id`; first ops: create trip,
  add item, move item, add note, undo.
- API at `/api/ops/*` with the OpenAPI spec; MCP at `/mcp` exposing `search`, `get`, `create_trip`,
  `edit_trip` with OAuth; tested from Claude.
- CI: typecheck, lint, ops tests on Postgres, migration check on a Neon branch.
- Nightly `pg_dump` to R2.

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
- Intent sheet with household defaults; candidates compare; browse-and-pick with **+ Add** to Ideas or a day.
- Day board (desktop) and day pager (phone), dnd-kit, variants, Plan B, spans, nested items.
- Day checks with one-tap fixes; the deterministic "Draft my days" preview.
- Universal **+**: catalog search, custom item, pasted link, dropped pin.
- Day-trip flow from home with drive-time ranking (ORS + `leg_cache`).
- Read-only share link; invite an editor.

**Exit:** the owner rebuilds the **Canadian Rockies 2029** trip in the app (14 nights, 3 tracks per
day) faster than editing the legacy page, and the result's day checks match what PLAN.md says.

### M3. Book, tasks and reminders (M)
- Offers with booking windows; `opens_at`/`book_by`; the booking timeline; mark booked with proof.
- Tasks: generated (bookings, windows, document rules for Canadian citizens, packing templates) and manual.
- Reminders: Web Push, email, ICS feed and per-deadline `.ics`; cron Worker with the KV `next_fire_at`
  trick; Inbox.
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
| `web/` (Next.js list views) | components ported into `apps/app` | if the owner keeps Next.js (Q4), `web/` becomes `apps/app` instead |
| `publish.sh`, `tools/publish.py` | legacy only | the new app deploys with `wrangler deploy` from CI |
| `docs/PLAN-platform.md` phases P4b, P4c, P5+ | **paused** where they write to the file store | P4c (bulk import into JSON files) would be wasted work; its importers are rewritten against Postgres in M1 |

## 4. What stays manual for the owner during the move

Nothing is lost on day one: the legacy site keeps working, `publish.sh` keeps deploying it, and the
trip-planner skill keeps producing pages until M2's exit shows the app is better for a real trip.
