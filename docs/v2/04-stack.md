# 04. Stack and architecture: the decisions, argued

> **Current state, last verified 25 Oct 2026 against main f2dee4b** ([audit](MASTER-PLAN-AUDIT-2026-10-25.md)). This
> box wins over the 24 Oct banner below where they differ.
>
> | Concern | Now | Status |
> |---|---|---|
> | Hosting | **Vercel**, project `travel` (Hobby), root `web`, Node 22; public address `https://travel-beta-tan.vercel.app` (no custom domain, owner 25 Oct) | project created and env set 25 Oct; previews behind Vercel Authentication; **no production deployment**; production needs the owner's approval of a named commit (Q43, R-61) |
> | Database | **Neon** project `damp-queen-64719841`, Free plan; production branch `br-soft-glade-b4mkqyvd`, child `br-damp-breeze-b41mtvn5` for spikes and DB tests | 10 migrations, RLS on 86 tables plus the ledger; `planner_draft_signal` the one content-free exception (owner ruling still open) |
> | Auth | **Neon Managed Better Auth** (Free plan includes 60,000 monthly active users): email and password built; email codes spiked (EML-0, gate M1 passed); Google with the owner's own OAuth client on both branches (UI not built); Apple **skipped** (no Neon provider, USD 99 a year); one environment (Preview and Production on production values) | R-58 merged into `main` 25 Oct; R-81, R-100, R-101 planned; EML-1 in progress |
> | Realtime | **Neon Realtime**, only for the private draft signal followed by an RLS re-fetch | built |
> | Email | Account mail through **Neon's shared sender** in Phase 1; **Resend** (sandbox, owner alerts only; key in Vercel and GitHub secrets) | Phase 1 planned (R-100 to R-107); custom SMTP and templates after a mail domain (Q148) |
> | Public catalogue | `JsonStore` behind `/api/v1` | `PostgresStore`, loader and cutover not built (SRV-0) |
> | MCP | local stdio server `core/bin/mcp.ts` (15 read tools, no sign-in) | remote public and private endpoints designed in [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md) (R-123 to R-129); not built |
> | Not selected | object storage, scheduled jobs and the reminder worker, live co-editing transport, backups beyond Neon's restore window | proposals below |
>
> Supabase is gone (R-58, R-60): every Supabase row below is the reasoning record, not a plan.

> **Current stack (updated 24 Oct 2026, R-60).** Selected and provisioned: **Neon** Postgres, **Neon Managed Better
> Auth** and **Neon Realtime** (owner, 24 Oct; [NEON-SETUP.md](build/public-site/NEON-SETUP.md)). Ten migrations are
> applied ([NEON-MIGRATIONS.md](build/public-site/NEON-MIGRATIONS.md)): 86 application tables plus the migration ledger
> have RLS; the one exception is the content-free `planner_draft_signal`, with no app-role grants, approved by the
> coordinator. Implemented and verified on the uncommitted session branch (PLAN R-58): email and password accounts, a private account draft (create, rename, delete, persistence)
> and live invalidation by a sealed per-user Realtime signal followed by an authenticated, RLS-scoped re-fetch. **Not
> implemented:** the household and trip planner, collaboration and presence, MCP OAuth, and the catalogue in Postgres
> (public reads still use `JsonStore`; a `PostgresStore` and its loader are proposed). **Not selected:** frontend
> hosting, object storage, serverless functions and jobs; the rows below that name them are proposals. (Stale since
> 24 to 25 Oct: Vercel is selected and the project exists; R-58 is merged into `main`; MCP sign-in is designed. See the
> box above.)
>
> **Historical (superseded).** The 17 Oct self-hosted Supabase decision (08-self-hosted.md: Postgres, Auth with OAuth 2.1
> for MCP, Realtime and Storage on the home server or Supabase Cloud; Next.js and a worker in containers; Cloudflare
> Tunnel) replaced the earlier Neon, Better Auth, Vercel and Cloudflare Workers answers, and is itself superseded for the
> database, auth and realtime by the Neon choice. Sections 1.1-1.9 are the reasoning record. Section 2's rows for
> language, Zod, the operation layer, UI kit, client data, dnd-kit, fractional ordering, maps, routing, geocoding,
> search, weather, email, push and tests still hold as direction. The Drizzle and DB-driver rows are superseded by
> what was built: plain SQL migrations through a checksummed runner (`core/bin/db-migrate.ts`) and `pg`. Its rows for
> hosting, scheduling, files and live co-editing are proposals until chosen.

Every choice below is open source or free at our scale, and each says what we give up. Prices and
limits were checked on 17 Oct 2026 from secondary sources that partly disagree; recheck the vendor's
own pricing page on the day of signing up.

## 1. The big one: Supabase, or Neon + Better Auth?

### 1.1 Reframe the question first

"Supabase or Neon" mixes two decisions that should be separate:

1. **Where auth lives** (who users are, sessions, OAuth for MCP clients, user management).
2. **Who hosts the Postgres.**

If auth is tied to the host (Supabase Auth's `auth.users` and `auth.uid()` in every RLS policy),
changing host later means migrating users, sessions, password hashes and every policy. If auth lives
in our own tables (Better Auth), the host is a connection string and can change in an afternoon with
`pg_dump`. **Decide auth first; the host then becomes a reversible choice.**

### 1.2 What Supabase gives, item by item, and what replaces it without Supabase

| Supabase feature | Do we need it? | Without Supabase | Effort to replace |
|---|---|---|---|
| Postgres + PostGIS + pgvector | yes | Neon (same extensions), or any Postgres | none |
| **Auth** (email, magic link, social, MFA) | yes | **Better Auth** (MIT): email and password, magic link, Google and Apple, passkeys, 2FA | small: config + 4 screens (we design those screens either way) |
| **Auth dashboard** (list users, ban, reset) | yes, from the first outside user | Better Auth **admin plugin** (roles, ban with expiry, impersonation, revoke sessions); we build one admin page | small to medium: a table page in `/admin` |
| Organisations and teams | yes (households, trip collaborators) | Better Auth **organization plugin** (members, roles, invitations) or our own `household_member` and `trip_member` tables (already in schema.sql) | small |
| **OAuth 2.1 server for MCP clients** | yes, core to the product | Better Auth **MCP plugin** (OAuth provider; dynamic client registration opt-in; client ID metadata documents via `@better-auth/cimd`) | small |
| Storage (images, tickets) | yes | **Cloudflare R2** (S3-compatible, ~10 GB free, no egress fees) with signed URLs | small |
| Auto-generated REST API (PostgREST) + RLS from the browser | **no** | not needed: all writes go through our operation layer by design (README rule 3), so the browser never talks to the database | none |
| Realtime (row changes pushed to clients) | **yes** (owner chose live co-editing) | committed operations broadcast through one Cloudflare Durable Object per trip (1.8) | medium |
| `pg_cron` inside the database | yes (reminders, staleness) | Cloudflare Workers Cron Triggers (free plan: 5 per account) | small, but see 1.4 |
| Queues (pgmq) | later | a `job` table polled by the cron Worker; Cloudflare Queues if it grows | small |
| Edge Functions | no | Cloudflare Workers | none |
| Studio (table editor, SQL editor) | handy | Neon console has a SQL editor and table view; Drizzle Studio locally | none |
| Automatic backups | yes | Neon keeps a restore window (short on the free plan); plus our own nightly `pg_dump` to R2 in every option | small |

**What we would genuinely miss with Neon + Better Auth:**
1. A ready-made **user management screen** on day one (we build one page).
2. **One dashboard and one bill** for data, auth and files (we get three: Neon, Cloudflare, an email sender).
3. **Realtime out of the box** (we build a per-trip room that broadcasts operations, 1.8).
4. **Being always on** (Neon scales to zero: the first request after 5 minutes idle waits for a cold
   start, typically well under a second; Supabase stays warm until the 7-day pause).
5. Security patches to auth are Better Auth releases we must apply, not a hosted service's.

**What we would genuinely lose with Supabase:**
1. **Portability of users** (Supabase Auth's tables and JWTs shape every policy).
2. **Free-plan reliability**: projects pause after 7 days without activity and stay down until
   someone restores them in the dashboard; no automatic backups on the free plan.
3. **Branching** per pull request (Neon's branches are copy-on-write and free; Supabase branching is
   a paid feature) for testing migrations against real data.
4. A **$25/month step** (Pro) the moment we want backups and no pausing, versus Neon's usage-based
   Launch plan that is likely a few dollars a month at our load.

### 1.3 "What if we just run the free version for the first year?"

There is no Supabase trial; there is a **free plan** that does not expire. So yes, year one can be
free on either host. The real question is what breaks while it is free:

| Risk on the free plan | Supabase free | Neon free |
|---|---|---|
| Goes offline by itself | **paused after 7 days without requests**; needs a manual restore | never pauses; scales to zero and wakes on the next request |
| Hard limit hit | 500 MB database, 1 GB files, 50,000 monthly active users | 0.5 GB storage, **100 compute-hours per month**: when used up, the compute **suspends until the month resets** (a real outage) |
| Backups | **none automatic** | short restore window (sources say 6 h to 1 day) |
| Branches for testing | no | yes (10 per project) |
| Projects | 2 active | up to 100 |

Both are fine **while it is the owner and a few friends**, provided we run our own nightly
`pg_dump` to R2 (planned anyway). Neither is fine once strangers rely on booking reminders:
a paused Supabase project or a suspended Neon compute both mean a missed "Moraine Lake opens in 15
minutes". The plan therefore says: **free for building and private use; move to a paid tier
(Neon Launch, or Supabase Pro) the week the first outside user signs up for reminders.** Because the
data layer is plain Postgres plus Better Auth, that move is a plan upgrade, not a migration.

### 1.4 The gotcha that would quietly break Neon's free plan

A reminder cron that **queries the database every minute keeps Neon's compute awake all the time**
(it suspends only after 5 idle minutes). At the smallest size (0.25 CU) that is about 0.25 × 730 h
≈ 180 compute-hours a month, beyond the 100-hour free allowance, so the database would suspend late in
the month. Design around it from day one:
- The cron Worker reads **`next_fire_at` from Cloudflare KV** every minute (free, no database).
- Only when a reminder is due does it open a database connection, send, and write the new
  `next_fire_at` back to KV.
- Any operation that changes reminders updates KV in the same request.

Result: the database wakes only when people use the app or a reminder is actually due. (On Supabase
this problem does not exist, because its compute is always on; this is a point in its favour.)

### 1.5 Options compared

| | A. Supabase all-in | B. Supabase as plain Postgres + Better Auth | **C. Neon + Better Auth + R2 + Workers** |
|---|---|---|---|
| Cost year one | $0 (with pause and no-backup risk) | $0 (same) | $0 (watch compute hours) |
| Cost with real users | $25/mo Pro | $25/mo Pro | ~$5-20/mo Neon Launch (usage), Workers free or $5 |
| Lock-in | high (auth, RLS on `auth.uid()`, storage API) | low | **low** |
| Build effort | lowest at first | low | low-medium (one admin page, one KV trick) |
| MCP OAuth | Supabase OAuth 2.1 server (new; check maturity) | Better Auth MCP plugin | Better Auth MCP plugin |
| Test migrations on real data | no (paid branching) | no | **yes, free branches** |
| Realtime | built in | built in (if used) | build (polling/SSE) |

**Recommendation: C, Neon + Better Auth**, with B as the fallback if Neon disappoints: same code,
different connection string. The deciding reasons are portability of users, free branching, and a
cheaper first paid step. The deciding counter-argument is that Supabase would save us a user
admin page and a realtime layer; both are small against being able to leave.

Owner's call (see 06-questions.md Q1): if you value **one dashboard and less to build in the first
two months** above cost and portability, choose **B** (still Better Auth, so leaving later stays easy).
I would not choose A.

### 1.6 And Neo4j?

If "Neo" in the brief meant Neon, ignore this. If it meant Neo4j: **no**. The relationships here are
shallow and few (trip → item → entity; area tree; trailhead, near, alternative, covered-by). They fit
a `relation` table and recursive queries. The hard queries are **spatial** ("within 5 km of the
route, every 2 hours of driving"), where PostGIS is far ahead of Neo4j's spatial support. A second
database doubles hosting, backups and consistency work. If graph traversal is ever needed, Apache AGE
adds openCypher to Postgres without a second system.

### 1.7 Decided 17 Oct 2026

> **Revised the same day: self-hosted Supabase on the owner's home server** (08-self-hosted.md). That
> replaced the Neon, Better Auth, Cloudflare-room and Vercel answers below; sections 1.1-1.9 stay as
> the reasoning record. The rest of this file (section 2 onward) still applies except the rows 08 lists.
>
> **Superseded 24 Oct 2026 (owner):** Neon Postgres, Neon Managed Better Auth and Neon Realtime are selected and
> provisioned; the self-hosted Supabase decision is historical. Hosting, storage, functions and the live co-editing
> design are not decided by that choice (see the banner at the top).

| Question | Owner's answer |
|---|---|
| Data host and auth | **Neon + Better Auth** (option C) |
| Audience in year one | **Family first, public later** |
| Co-editing | **Live, like Wanderlog** (section 1.8) |
| Framework and hosting | **Next.js on Vercel**, asked as a question; answered in 1.9 and accepted with the conditions there |

### 1.8 Live co-editing without breaking the cost model

The obvious way to do live sync (ElectricSQL or Zero streaming Postgres changes) needs **logical
replication from Neon**. A replication connection never goes idle, so Neon's compute **never scales to
zero**: ~180 compute-hours a month at the smallest size, over the free 100, about $15-20/month on
Launch, and a second always-on server (the sync service) to host. That is a lot of cost for "Priya's
change appears instantly".

The design instead **broadcasts operations**, which we already have:
1. A client sends an operation (`move_item`, `set_time`, ...) to the API as today.
2. The API commits it to Postgres (`op_event`, new trip `version`) and then posts the operation and the
   new version to the trip's **room**: one **Cloudflare Durable Object per trip** holding the open
   WebSockets (SQLite-backed Durable Objects are on the Workers free plan; the hibernation API means
   idle rooms cost nothing).
3. Every other open client applies the same operation locally with the same reducer it uses for
   optimistic updates and offline replay, so the screen changes in well under a second, and the
   database is not read again.
4. A client that misses versions (sleep, bad signal) asks for "ops since version N", or refetches
   the trip if the gap is large.
5. The room also carries **presence**: who has the trip open, and which item each person is editing
   (a small avatar on the item), so two people rarely edit the same thing at once.

Conflicts: operations are intent-based (move X after Y on day 3), ordering uses fractional keys, so
most concurrent edits commute. The server is the order of record; a rejected op (the item was deleted
meanwhile) rolls back on that client with a message. The one weak spot is **two people typing in the
same note at the same moment** (last write wins on a field). If that proves annoying, notes become a
Yjs text field synced through the same room, without changing anything else.

Cost: $0 at family scale (free plan: 100,000 Durable Object requests a day). Neon stays asleep
between real edits. The room works the same whether the web app is hosted on Vercel or Cloudflare.

### 1.8a Does Supabase Realtime give us Wanderlog-style sync?

**Partly. It gives the pipe, not the sync.** Supabase Realtime has three parts:

| Part | What it does | Fit here |
|---|---|---|
| **Postgres Changes** | pushes row inserts, updates and deletes to subscribed clients, filtered by RLS | works, but Supabase's own docs steer high-traffic apps to Broadcast, because every change is checked against every subscriber's policies; payloads past the plan limit arrive with large fields stripped |
| **Broadcast** | low-latency messages on a channel (our "op committed, version N" message) | the same job as the Durable Object room in 1.8 |
| **Presence** | who is online in a channel | the same job as presence in 1.8 |

Free plan (official limits page): 200 concurrent connections, 100 messages a second, 256 KB per
broadcast. Plenty for a family.

What it does **not** do, and Wanderlog's feel needs: apply the change to the open screen, merge two
people's edits, queue edits made offline, recover after a gap. That is the client op reducer, the
fractional ordering and the "ops since version N" call, and **we build those in every option**.
So Supabase Realtime replaces only the room (step 2 of 1.8, roughly a day of work), not the hard part.

What using it costs us with the decisions already made (Neon + Better Auth):
- **Postgres Changes cannot watch Neon**: it reads Supabase's own database. With Neon as the
  database only Broadcast and Presence apply, so a whole Supabase project would sit beside Neon just
  to relay messages.
- **Auth bridge**: private channels are authorised with Supabase JWTs or a third-party provider that
  signs with asymmetric keys and publishes a JWKS endpoint. Better Auth's JWT plugin can likely do
  this, but no guide confirms it (unverified, 17 Oct 2026).
- **Free-plan pause**: a Supabase project with no database activity for 7 days pauses, which would
  stop the live updates too.

| Option | Live sync | What it costs us |
|---|---|---|
| **Neon + Better Auth + a Cloudflare room (current)** | op broadcast + presence | ~1 day to build the room; $0; no extra vendor |
| Neon + Better Auth + Supabase Realtime Broadcast | same | a second vendor for relaying only, an auth bridge to prove, pause risk |
| Supabase as the database (option B) + Realtime | Postgres Changes or Broadcast | gives up Neon branching and the cheaper paid step; Realtime would then be "free" |
| Supabase all-in (option A) | everything native | lock-in from 1.2; still no merge, offline or gap logic |

**Recommendation: keep the Cloudflare room.** Supabase Realtime is good, but it saves about a day
here, and taking it means either a second vendor beside Neon or reopening Q1. If the owner wants to
reopen Q1 for other reasons (one dashboard, built-in user screens), option B plus Realtime is then the
consistent choice, and the client sync code is the same either way.

### 1.9 Next.js on Vercel?

**Yes for year one, with three conditions.** The question was "Next.js is good for server-side code
too?": it is. Route handlers, server actions and server components run real Node code, and Vercel
gives the best Next.js hosting, preview deploys per pull request, and a native Neon integration that
can create a database branch per preview.

What changes my earlier recommendation (React Router on Cloudflare) is the audience answer: **family
first means personal, non-commercial use, which Vercel's free Hobby plan allows.** The objection was
commercial use, and that comes later.

The conditions:
1. **Keep the domain out of Next.js.** Operations, checks, planner and auth live in `packages/`; the
   API and the MCP are a **Hono app mounted inside one Next route handler** (`app/api/[[...route]]`
   with Hono's Vercel adapter). Server actions call the same ops. Then moving off Vercel, or off
   Next.js, never touches the business logic.
2. **Time-critical background work stays on Cloudflare.** Vercel Hobby runs cron once a day, so the
   minute-level reminder cron (1.4) and the live rooms (1.8) are two small Cloudflare Workers. That is
   two platforms, but each does one job.
3. **Budget the move to Pro ($20/month) or to Cloudflare** the day it becomes a product with outside
   users (Hobby's terms forbid commercial use). OpenNext deploys the same Next.js app to Cloudflare
   Workers if Vercel Pro is not wanted then.

What we give up versus React Router on Cloudflare: one more platform, Vercel lock-in for a few
Next-specific features (image optimisation, ISR; avoid relying on them), and a heavier framework for
an app that is mostly client-side once you are inside a trip. What we gain: the existing `web/` code
and its tests carry straight over, and the most mature React server framework.

## 2. The rest of the stack

| Concern | Choice | Alternatives considered | Why |
|---|---|---|---|
| Language | **TypeScript everywhere** (domain, API, MCP, web, workers) | Python for research tooling | one type system from Zod schema to UI; the existing `core/` is TS; Python stays only in legacy tools until retired |
| Schema and validation | **Zod 4** as the single source; JSON Schema exported for MCP resources and docs | TypeBox, Valibot | already in `core/`; MCP SDK speaks Zod |
| Database access | **Drizzle ORM** + plain SQL for spatial queries; **drizzle-kit** migrations | Prisma, Kysely | lightweight, works on Workers with Neon's serverless driver, SQL-shaped, Better Auth has a Drizzle adapter |
| DB driver | **@neondatabase/serverless** (HTTP for one-shot queries, WebSocket for transactions); `pg` locally | Hyperdrive + `pg` | made for Workers; Hyperdrive optional later for pooling |
| Operation layer | `defineOp({ name, input, output, auth, run })` in a `domain` package; every op logs `op_event` and returns an inverse | tRPC, ad-hoc handlers | the operation is the unit for API, MCP, CLI, undo, audit and offline replay |
| HTTP API | **Hono** mounted in a Next.js route handler (Vercel); **oRPC** (or Hono's OpenAPI middleware) to expose ops with an OpenAPI 3.1 spec | Express, Fastify, tRPC | Hono runs on Workers, Node and Bun; oRPC generates OpenAPI from Zod |
| MCP server | **@modelcontextprotocol/sdk**, Streamable HTTP transport, mounted at `/mcp` in the same Hono app; auth by Better Auth MCP plugin. **25 Oct:** stateless Next.js route handlers `/mcp/` (public, no sign-in) and `/mcp/private/`; auth by Neon Managed Better Auth's OAuth provider plugin (JWT via JWKS) or our own personal access tokens; the self-managed Better Auth MCP plugin is the fallback only ([mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md)) | separate service | same ops, same deploy; see 03-mcp-and-research.md |
| Web framework | **Next.js 16** (App Router) on **Vercel Hobby** for year one (1.9): server components for public pages (templates, area guides, entity pages: SEO, JSON-LD), client components for planning | React Router 7 on Workers; SvelteKit; TanStack Start | owner's choice; `web/` carries over; Hobby allows personal use; OpenNext keeps a path to Cloudflare |
| UI kit | **Tailwind 4** + **Base UI** primitives (shadcn-style components we own) + **Lucide** | MUI, Chakra | already in `web/`; accessible primitives; no runtime CSS |
| Client data | **TanStack Query** with an IndexedDB persister; offline **op queue** in IndexedDB (Dexie); one **op reducer** shared by optimistic updates, offline replay and live updates | Zero, PowerSync, ElectricSQL, Replicache | offline reads and queued writes through our ops, without logical replication (1.8) |
| Live co-editing | **one Cloudflare Durable Object per trip** (WebSocket room, hibernation API) broadcasting committed ops and presence (1.8) | ElectricSQL, Zero, Liveblocks, Pusher | instant updates at $0 without keeping Neon awake |
| Drag and drop | **dnd-kit** | react-beautiful-dnd (unmaintained) | accessible, touch, keyboard |
| Ordering | **fractional indexing** (`sort_key` strings) | integer positions | moves never rewrite siblings; concurrent moves rarely collide |
| Maps | **MapLibre GL JS** + **OpenFreeMap** vector tiles (free, no key) for online; **Protomaps PMTiles** extracts on R2 for offline trip areas | Mapbox, Google | no keys, no per-load cost, offline possible |
| Terrain and hillshade | Mapterhorn / AWS Terrain Tiles | Mapbox terrain | free |
| Routing (drive times) | **OpenRouteService** free API (keyed, daily quota) behind `leg_cache`; self-hosted **Valhalla** when quotas bite | Google Distance Matrix, Mapbox | free start, cached forever per cell pair; Google's terms forbid storing results |
| Geocoding | **Nominatim** (1 request/second, attribution) + Wikidata for named places, for research and batch resolution. **Interactive place search (25 Oct 2026):** openrouteservice autocomplete through a signed-in server route, Photon as fallback; never Nominatim for type-ahead (its policy forbids it) ([requests-and-custom-places.md](features/requests-and-custom-places.md) 4.3) | Google | free; places are mostly anchored to Wikidata/OSM ids anyway |
| Search | Postgres **full-text + pg_trgm + unaccent**; **pgvector** later for "places like this" | Meilisearch, Typesense, Algolia | enough to millions of rows; no second system |
| Sun and twilight | existing `core/src/sun` | | already correct and tested |
| Weather | **Open-Meteo** (free, no key, non-commercial; commercial plan if we sell) | OpenWeather | free forecast for Today mode |
| Files | **Cloudflare R2**; images resized in the browser before upload (two sizes) | Cloudflare Images (paid), Supabase Storage | free egress, signed URLs for private tickets |
| Email | **Resend** (free tier ~3,000/month) or Amazon SES | Postmark | transactional reminders and digest; swap via one interface. **25 Oct:** account mail goes through Neon's shared sender in Phase 1; Resend's sandbox carries owner alerts only until a mail domain exists (R-100 to R-107, Q148) |
| Push | **Web Push** with VAPID (`web-push`-compatible signing in the Worker) | OneSignal, FCM direct | free, standard, no vendor |
| Calendar | ICS feed per trip at a secret URL, plus one-off `.ics` per deadline | | |
| Scheduling | **Cloudflare Workers Cron** every minute reading `next_fire_at` from KV (1.4) | pg_cron, Vercel Cron (once a day on Hobby) | minute precision, free, keeps Neon asleep |
| Long jobs (imports, server research) | CLI and **GitHub Actions** at first; a small container (Fly.io or a VPS) when server-run research starts | Workers (CPU-time limits) | research runs minutes, not milliseconds |
| Hosting | **Vercel Hobby** for the Next.js app, API and MCP; **Cloudflare Workers** for the reminder cron and the trip rooms; legacy pages stay on Cloudflare Pages | all on Cloudflare (OpenNext) | owner's choice for year one; move to Vercel Pro or Cloudflare when it turns commercial (1.9). **25 Oct:** Vercel project `travel` exists (R-61); the Workers rows are proposals, not selected |
| Errors and logs | **Sentry** free tier + Workers logs | Highlight, self-hosted GlitchTip | |
| Analytics | **Cloudflare Web Analytics** (no cookies) + `op_event` for product metrics | Plausible, PostHog | free, private |
| Tests | **Vitest** (domain, ops against a real Postgres in Docker or a Neon branch), **Playwright** + axe (UI, accessibility) | | ops are tested against real SQL, never mocks |
| CI | **GitHub Actions**: typecheck, lint, unit, ops-on-Postgres, Playwright smoke, migration dry-run on a Neon branch | | |
| Monorepo | **pnpm workspaces** (already set up) | Turborepo, Nx | enough |

## 3. Shape of the system

```
 phone / desktop browser (PWA)                  chat clients (Claude, ChatGPT, any MCP client)
   React app, TanStack Query + IndexedDB             │  OAuth 2.1 (Better Auth MCP plugin)
   offline op queue, MapLibre, PMTiles               │
        │ HTTPS (session cookie)                     │ Streamable HTTP
        ▼                                            ▼
 ┌──────────── Next.js on Vercel (app, Hono /api, /mcp) ─────────────┐
 │  SSR pages ─┐   /api/ops/*  (OpenAPI)   /mcp  (tools, resources, prompts)│
 │             └──────────────┬──────────────────┘                         │
 │                    domain package: defineOp registry                    │
 │        auth (Better Auth) · checks · planner · sun · book-by · tasks    │
 └────────────┬────────────────────────┬──────────────────────┬────────────┘
              │ Drizzle / SQL           │ signed URLs           │ KV next_fire_at
              ▼                         ▼                       ▼
     Postgres + PostGIS (Neon)     Cloudflare R2          Cron Worker (every minute)
     catalog · plans · research    images, tickets,       → due reminders → Web Push / email
     op_event · auth tables        nightly pg_dump        → staleness, coverage, digests
              ▲
              │ same ops, CLI or job runner
     research runners: owner's Claude Code / chat client via MCP · GitHub Actions · (later) a container
```

Read this sketch as the 17 Oct target. Since 25 Oct: the MCP OAuth box is Neon Managed Better Auth's OAuth provider (not
a Better Auth plugin we run), Hono, Drizzle, R2 and the Cron Worker are not built or selected, and the API is Next.js
route handlers at `/api/v1` ([mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md) section 1 has the current MCP picture).

## 4. Security and privacy rules

1. Authorisation in the operation layer (who may run this op on this trip), **and** row-level
   security in Postgres as a second wall: each request runs in a transaction that sets
   `app.user_id`; policies check `trip_member` and `household_member`. Built so far (24 Oct): the
   transaction-local `app.user_id`, a non-owner `NOBYPASSRLS` runtime role, and an owner policy on
   `planner_draft` only; trip and household tables are RLS-enabled with no policy (deny) until their
   membership policies are written and tested.
2. MCP tokens carry scopes: `catalog:read`, `trips:read`, `trips:write`, `research:propose`,
   `review` (moderators only). Research scopes can only create changesets. (25 Oct: Neon's OAuth scopes are fixed, so
   these are capabilities stored per client grant or token and checked with the role on every call;
   [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md) 5.1.)
3. People data (ages, heights, passport expiry, attachments) is never returned by public or link
   views; those use a dedicated read function that returns the template shape.
4. Rate limits per user and per MCP client (Workers rate-limit binding or a KV counter). (25 Oct: Postgres
   `quota_bucket`, shared with the auth and mail limits, plus the one Vercel WAF rule Hobby allows.)
5. Secrets in Workers secrets; no service key ever reaches a browser.
6. Export and delete per user (GDPR-style), including the household.

## 5. Cost model

| Stage | Monthly | What it buys |
|---|---|---|
| Build and private use | **$0** + domain (~$1/mo; no domain for now, owner 25 Oct) | Neon free, Workers free, R2 free, Resend free, OpenFreeMap, ORS free key, Sentry free |
| First outside users | **~$5-25** | Neon Launch (usage), maybe Workers Paid ($5) for more cron/CPU |
| Server-run research for others | variable | model tokens per job with a hard budget per job and per user (B4: owner only at first) |

The single biggest cost risk is not hosting; it is **paid APIs inside loops** (routing, geocoding,
model calls). Every one sits behind a cache table and a budget.
