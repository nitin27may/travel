# 04. Stack and architecture: the decisions, argued

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
| Realtime (row changes pushed to clients) | nice to have | trip `version` + Server-Sent Events or a 20-s poll while a trip is open; ElectricSQL later if live collaboration matters | small |
| `pg_cron` inside the database | yes (reminders, staleness) | Cloudflare Workers Cron Triggers (free plan: 5 per account) | small, but see 1.4 |
| Queues (pgmq) | later | a `job` table polled by the cron Worker; Cloudflare Queues if it grows | small |
| Edge Functions | no | Cloudflare Workers | none |
| Studio (table editor, SQL editor) | handy | Neon console has a SQL editor and table view; Drizzle Studio locally | none |
| Automatic backups | yes | Neon keeps a restore window (short on the free plan); plus our own nightly `pg_dump` to R2 in every option | small |

**What we would genuinely miss with Neon + Better Auth:**
1. A ready-made **user management screen** on day one (we build one page).
2. **One dashboard and one bill** for data, auth and files (we get three: Neon, Cloudflare, an email sender).
3. **Realtime out of the box** (we use version polling; fine for planning, not for Google Docs-style co-editing).
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

## 2. The rest of the stack

| Concern | Choice | Alternatives considered | Why |
|---|---|---|---|
| Language | **TypeScript everywhere** (domain, API, MCP, web, workers) | Python for research tooling | one type system from Zod schema to UI; the existing `core/` is TS; Python stays only in legacy tools until retired |
| Schema and validation | **Zod 4** as the single source; JSON Schema exported for MCP resources and docs | TypeBox, Valibot | already in `core/`; MCP SDK speaks Zod |
| Database access | **Drizzle ORM** + plain SQL for spatial queries; **drizzle-kit** migrations | Prisma, Kysely | lightweight, works on Workers with Neon's serverless driver, SQL-shaped, Better Auth has a Drizzle adapter |
| DB driver | **@neondatabase/serverless** (HTTP for one-shot queries, WebSocket for transactions); `pg` locally | Hyperdrive + `pg` | made for Workers; Hyperdrive optional later for pooling |
| Operation layer | `defineOp({ name, input, output, auth, run })` in a `domain` package; every op logs `op_event` and returns an inverse | tRPC, ad-hoc handlers | the operation is the unit for API, MCP, CLI, undo, audit and offline replay |
| HTTP API | **Hono** on Cloudflare Workers; **oRPC** (or Hono's OpenAPI middleware) to expose ops with an OpenAPI 3.1 spec | Express, Fastify, tRPC | Hono runs on Workers, Node and Bun; oRPC generates OpenAPI from Zod |
| MCP server | **@modelcontextprotocol/sdk**, Streamable HTTP transport, mounted at `/mcp` in the same Worker; auth by Better Auth MCP plugin | separate service | same ops, same deploy; see 03-mcp-and-research.md |
| Web framework | **React 19 + React Router 7 (framework mode)** on Workers: SSR for public pages (templates, area guides, entity pages: SEO, JSON-LD), client-heavy app for planning | keep **Next.js 16** (already in `web/`) via OpenNext on Workers; SvelteKit; TanStack Start | runs natively on Workers without an adapter layer; the planning UI is mostly client-side anyway. **Keeping Next.js is a defensible alternative** (06-questions Q4): the existing components port either way |
| UI kit | **Tailwind 4** + **Base UI** primitives (shadcn-style components we own) + **Lucide** | MUI, Chakra | already in `web/`; accessible primitives; no runtime CSS |
| Client data | **TanStack Query** with an IndexedDB persister; offline **op queue** in IndexedDB (Dexie) | Zero, PowerSync, ElectricSQL, Replicache | simplest thing that gives offline reads and queued writes through our ops; a sync engine is a later swap if real-time co-editing is wanted |
| Drag and drop | **dnd-kit** | react-beautiful-dnd (unmaintained) | accessible, touch, keyboard |
| Ordering | **fractional indexing** (`sort_key` strings) | integer positions | moves never rewrite siblings; concurrent moves rarely collide |
| Maps | **MapLibre GL JS** + **OpenFreeMap** vector tiles (free, no key) for online; **Protomaps PMTiles** extracts on R2 for offline trip areas | Mapbox, Google | no keys, no per-load cost, offline possible |
| Terrain and hillshade | Mapterhorn / AWS Terrain Tiles | Mapbox terrain | free |
| Routing (drive times) | **OpenRouteService** free API (keyed, daily quota) behind `leg_cache`; self-hosted **Valhalla** when quotas bite | Google Distance Matrix, Mapbox | free start, cached forever per cell pair; Google's terms forbid storing results |
| Geocoding | **Nominatim** (1 request/second, attribution) + Wikidata for named places | Google | free; places are mostly anchored to Wikidata/OSM ids anyway |
| Search | Postgres **full-text + pg_trgm + unaccent**; **pgvector** later for "places like this" | Meilisearch, Typesense, Algolia | enough to millions of rows; no second system |
| Sun and twilight | existing `core/src/sun` | | already correct and tested |
| Weather | **Open-Meteo** (free, no key, non-commercial; commercial plan if we sell) | OpenWeather | free forecast for Today mode |
| Files | **Cloudflare R2**; images resized in the browser before upload (two sizes) | Cloudflare Images (paid), Supabase Storage | free egress, signed URLs for private tickets |
| Email | **Resend** (free tier ~3,000/month) or Amazon SES | Postmark | transactional reminders and digest; swap via one interface |
| Push | **Web Push** with VAPID (`web-push`-compatible signing in the Worker) | OneSignal, FCM direct | free, standard, no vendor |
| Calendar | ICS feed per trip at a secret URL, plus one-off `.ics` per deadline | | |
| Scheduling | **Cloudflare Workers Cron** every minute reading `next_fire_at` from KV (1.4) | pg_cron, Vercel Cron (once a day on Hobby) | minute precision, free, keeps Neon asleep |
| Long jobs (imports, server research) | CLI and **GitHub Actions** at first; a small container (Fly.io or a VPS) when server-run research starts | Workers (CPU-time limits) | research runs minutes, not milliseconds |
| Hosting | **Cloudflare Workers + static assets** for web, API and MCP; legacy pages stay on Cloudflare Pages | Vercel | Vercel Hobby forbids commercial use; Cloudflare's free plan does not, and it is where the legacy site already lives |
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
 ┌──────────────────────── Cloudflare Worker: app ────────────────────────┐
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

## 4. Security and privacy rules

1. Authorisation in the operation layer (who may run this op on this trip), **and** row-level
   security in Postgres as a second wall: each request runs in a transaction that sets
   `app.user_id`; policies check `trip_member` and `household_member`.
2. MCP tokens carry scopes: `catalog:read`, `trips:read`, `trips:write`, `research:propose`,
   `review` (moderators only). Research scopes can only create changesets.
3. People data (ages, heights, passport expiry, attachments) is never returned by public or link
   views; those use a dedicated read function that returns the template shape.
4. Rate limits per user and per MCP client (Workers rate-limit binding or a KV counter).
5. Secrets in Workers secrets; no service key ever reaches a browser.
6. Export and delete per user (GDPR-style), including the household.

## 5. Cost model

| Stage | Monthly | What it buys |
|---|---|---|
| Build and private use | **$0** + domain (~$1/mo) | Neon free, Workers free, R2 free, Resend free, OpenFreeMap, ORS free key, Sentry free |
| First outside users | **~$5-25** | Neon Launch (usage), maybe Workers Paid ($5) for more cron/CPU |
| Server-run research for others | variable | model tokens per job with a hard budget per job and per user (B4: owner only at first) |

The single biggest cost risk is not hosting; it is **paid APIs inside loops** (routing, geocoding,
model calls). Every one sits behind a cache table and a budget.
