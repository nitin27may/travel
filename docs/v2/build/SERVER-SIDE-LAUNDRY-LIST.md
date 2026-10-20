# Server-side laundry list (everything that needs login or a backend)

The second list. [MASTER-PLAN.md](public-site/MASTER-PLAN.md) holds the public site with no login. This file holds everything that needs a server, an account or a database: the planner, and the server versions of things the public site does statically today. **It starts after the public-site work and go-live are done** (owner, 20 Oct 2026). Nothing here is started.

Rules: this file links, it does not hold detail. New items go into `public-site/BACKLOG.md` first (rows 12.x), then here. Specs: the planner pages [features/F01 to F17](../features/README.md), [04-stack.md](../04-stack.md), [08-self-hosted.md](../08-self-hosted.md), [10-sharing.md](../10-sharing.md), [schema.sql](../schema.sql), and principle P9 in [principles.md](../design/foundation/principles.md).

## 1. Decisions that come first

| ID | Decision | Why it matters | Recommended |
|---|---|---|---|
| Q65 | Where the backend lives. The planner docs assume **self-hosted Supabase on the home server** ([08-self-hosted.md](../08-self-hosted.md)). The public site is on Cloudflare Pages, under 100 users in year one, free tiers preferred. Options: (a) Supabase cloud free tier, (b) self-hosted Supabase at home, (c) Cloudflare Workers, D1 and R2 | Decides cost, uptime (a home server sleeps, a free Supabase project pauses after 7 idle days), backups and the whole build | (a) Supabase cloud free tier to start, with a keep-alive and the same schema, so (b) stays possible; revisit at 1,000 users |
| Q66 | Sign-in method: email link, Google, passkeys | Family first; fewest passwords | Email link plus Google |
| Q67 | Who may sign in: invite only, or open | Abuse, cost, privacy | Invite only at first |
| Q68 | Guest planning (in memory, share by link) before sign-in | Lets people try the planner | Yes (Q59) |
| Q69 | The household data model: people, ages, passports, passes stay private to the household, never public | Privacy rule already in force | Yes, enforced by row-level security |

## 2. Foundation (S0)

| # | Item | Source | Depends on | Notes |
|---|---|---|---|---|
| 1 | Accounts, roles, sign-in and sign-out, session handling | F17 | Q65 to Q67 | Row-level security before any app code touches a table (house rule) |
| 2 | Database schema: apply `schema.sql`, migrations, generated types | [schema.sql](../schema.sql), [01-domain-model.md](../01-domain-model.md) | Q65 | `supabase migration new`, local first, never direct SQL on remote |
| 3 | The operation layer as the only writer, with undo and an event log | P4a, `core/src/ops/` | 2 | Already exists locally; becomes the API |
| 4 | API (`/api`) and the MCP front door (`/mcp`) with OAuth and tokens | F17, [03-mcp-and-research.md](../03-mcp-and-research.md) | 1, 3 | Read-only MCP exists locally today |
| 5 | Hosting, environments, secrets in a vault, never in the repo | [04-stack.md](../04-stack.md) | Q65 | Keys for Google, ORS, GeoNames stay server-side |
| 6 | Backups, restore test, retention, export and delete my data | F17 | 2 | Required before real users |
| 7 | Rate limits, bot protection and abuse controls on the API | public-site row 7.6 | 4 | Edge settings need the custom domain (Q44) |
| 8 | Observability: logs, errors, health checks, cost alerts | [11-quality-and-delivery.md](../11-quality-and-delivery.md) | 5 | |
| 9 | Privacy and terms for accounts: what is stored, cookies, consent | F17 | 1 | The public site stores nothing today |

## 3. The public site moves to the server (P9 step by step)

Everything the public site reads goes through `web/lib/client/data.ts`, so each of these replaces a static file with an API call and keeps the file as a cache.

| # | Item | Today | Server version | Source |
|---|---|---|---|---|
| 10 | Places list and filters | Row shards per country, filtered in the browser | `GET /api/places?filters` with paging | [lists note](../design/lists-stage4-note.md) |
| 11 | Nearby | Shards whose bounding box meets the radius | `GET /api/places?near=&r=` (PostGIS) | [nearby spec](../features/nearby-and-regions.md) 5.7 |
| 12 | Search | Split lazy index, parser in the browser | Server search with the same parser; semantic ranking if it earns its place | [smart search](../features/smart-search.md), [spike](../research/smart-search-spike.md) |
| 13 | Globe pins and cards | Per-country and per-card static files | API with the same shapes | globe-data |
| 14 | Exports (GPX, KML, CSV, calendar) | Built per item at build time | Generated on request, rate limited; sign-in for bulk (P8) | public-site 7.9, Q46 |
| 15 | Protect the catalogue | Design rules plus edge limits | Per-user and per-IP quotas, scraping detection | P8 |
| 16 | Images | Self-hosted renditions built at deploy | Storage bucket and image service | public-site 2.38 |
| 17 | Source of truth for data | JSON files in the repo | Postgres tables fed from the same capture contract, JSON stays the review format | [capture contract](../research/capture-contract.md) |
| 18 | Research pipeline writes through the API | Lanes write JSON | Crawler and researcher jobs with review queue | F16, [onboarding-and-refresh.md](../research/onboarding-and-refresh.md) |

## 4. The planner features (S1 to S4), from the feature pages

| # | Item | Page | Milestone | Needs |
|---|---|---|---|---|
| 19 | Household and profiles: home base, people, ages, passes, standing preferences | [F01](../features/F01-household-and-profiles.md) | M0, M2 | 1, 9 |
| 20 | Trip creation and trip types | [F02](../features/F02-trip-creation-and-trip-types.md) | M2 | 19 |
| 21 | Candidates and the travel year | [F03](../features/F03-candidates-and-travel-year.md) | M2, M3 | 20 |
| 22 | Explore, search and suggestions inside the planner, drive time from a base | [F04](../features/F04-explore-search-and-suggestions.md) | M1 | 11, 12 |
| 23 | Smart trip builder: destination, base, days, what is nearby, choose and order | [nearby spec section 6](../features/nearby-and-regions.md), public-site 8.5, 8.6 | M2 | 11, 20 |
| 24 | Catalog entity pages in the planner (richer than the public pages) | [F05](../features/F05-catalog-entity-pages.md) | M1 | 17 |
| 25 | Plan document: lists, days, items, variants, Plan B, board and phone pager | [F06](../features/F06-plan-document-lists-and-days.md) | M2 | 3, 20 |
| 26 | Day checks, drafting and route optimising | [F07](../features/F07-day-checks-drafting-and-route-optimising.md) | M2, M7 | 25, drive matrix |
| 27 | Reservations and wallet (we never book; people record) | [F08](../features/F08-reservations-and-wallet.md), [09-reservations.md](../09-reservations.md) | M3 | 25 |
| 28 | Tasks, checklists and reminders (push, email, calendar) | [F09](../features/F09-tasks-checklists-and-reminders.md) | M3 | 25, notifications |
| 29 | Budget and expenses | [F10](../features/F10-budget-and-expenses.md) | M3 | 25 |
| 30 | Collaboration, live editing and sharing | [F11](../features/F11-collaboration-live-editing-and-sharing.md), [10-sharing.md](../10-sharing.md) | M3 | 1, realtime |
| 31 | Templates: sample trips, fork, adapt to length, season, weather and party | [F12](../features/F12-templates-reuse-and-adaptation.md) | M5 | 25 |
| 32 | Today mode and offline | [F13](../features/F13-today-mode-and-offline.md) | M4 | 25, offline tiles |
| 33 | After the trip: memories, corrections to the catalogue, publish as a template | [F14](../features/F14-after-the-trip.md) | M5 | 25 |
| 34 | Maps, routing and exports in the planner (drive times cached, tracks, offline tiles) | [F15](../features/F15-maps-routing-and-exports.md) | M1 to M4 | Q51, ORS |
| 35 | Admin console: review queue, research jobs, coverage, publishing, moderation | [F16](../features/F16-admin-console.md) | M1, M5, M6 | 17, 18 |
| 36 | The public Sign in button, Save to a trip, and trip import from the public site | public-site 11.1 | with 1 | 1 |

## 5. Order

S0 foundation (items 1 to 9, after Q65 to Q69), then S1 the public site's server version for the heavy paths (10, 11, 15) so protection stops depending on design alone, then S2 the household and trips (19, 20, 25), S3 the checks, reservations, tasks and budget (26 to 29), S4 collaboration, offline and templates (30 to 33), S5 the admin console and the research pipeline (35, 18). Milestone names (M0 to M7) are from [05-roadmap.md](../05-roadmap.md).

## 6. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version, from the planner feature pages and the P9 server-ready path |
