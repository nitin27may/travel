# MCP server: overview

> **Owner decision record, 27 Oct 2026 (recorded 28 Oct; PLAN R-291 supersedes R-124): there is NO public or anonymous MCP
> endpoint.** Every MCP call, read-only catalogue reads included, requires a signed-in account with the same Neon Managed
> Better Auth identity as the web site. There is one remote endpoint, `https://travel-beta-tan.vercel.app/mcp/` (OAuth for
> interactive clients, personal access tokens for headless ones); `/mcp/private/` is not used (QX15). The `catalogue` level
> stays as the lowest signed-in level; `plans_read` and the rest are unchanged. Unauthenticated callers get only what
> sign-in needs: the protected resource metadata, a minimal `server/discover` (versions, server name, `tools` capability, no
> tool list) and a `401` pointing at the metadata, under a small per-IP limit and the WAF rule
> ([identity-and-roles.md](identity-and-roles.md) 1.1). Quotas are per user. If a client cannot complete OAuth (ChatGPT
> is the open case, QX16), it has no MCP access until it can; there is no public fallback. The local stdio server stays
> owner-only. Phase M1 (v0.19) becomes "authenticated catalogue read" and carries the OAuth switch-on, grants, tokens,
> consent, Connected apps and the admin panel; M2 (v0.20) is the user's own plans, read ([BUILD-READINESS.md](BUILD-READINESS.md)).
> Every statement below about a public `/mcp/` with no sign-in, anonymous limits or two URLs is superseded by this record.

> **The MCP plan made build-ready, 28 Oct 2026 (owner direction of 27 Oct: same login and roles as the web UI; built on the
> API; lock any tool from an admin panel at any time; M1 to M5 planned in full).** New pages:
> [identity-and-roles.md](identity-and-roles.md) (one identity, the lookup chain, effective capability, suspension, the
> owner bootstrap, sign-up abuse), [tool-registry-and-admin-controls.md](tool-registry-and-admin-controls.md) (the registry
> as data, locks at every scope with deny winning on the next call, the admin panel, panic and its runbook, audit and
> undo), [tool-catalogue.md](tool-catalogue.md) (all 56 tools, M1 to M5, with schemas, routes and the schema pipeline; it
> wins over the tool lists of the other pages) and [BUILD-READINESS.md](BUILD-READINESS.md) (every task, hours, owned
> files, gates, owner steps; MCP program 322 h). Research: [mcp-best-practice-2026-10-27.md](../../../research/reports/mcp-best-practice-2026-10-27.md).

Status: **draft** (17 Oct 2026). Builds on 03-mcp-and-research.md (the why) and 08-self-hosted.md (the
deployment, now historical). **R-60 (Oct 2026):** the backend is Neon (Postgres, Managed Better Auth
email/password, Realtime). The remote MCP endpoint, its hosting, and its OAuth provider are not
selected or built; everything below is the target design. This folder is the reference a developer builds from and a chat client reads.

> **Sign-in designed 25 Oct 2026 ([auth-and-sign-in.md](auth-and-sign-in.md), PLAN R-123 to R-129).** It supersedes
> sections 2 and 3 where they differ: hosting is Vercel; the public endpoint is `https://travel-beta-tan.vercel.app/mcp/`
> with no sign-in and the private one `.../mcp/private/`; the OAuth server is Neon Managed Better Auth's OAuth provider
> plugin (client ID metadata documents, DCR off, EdDSA JWTs bound to our URL), pending the MCP-0 spike; personal access
> tokens stay for headless clients. Neon offers fixed OAuth scopes only, so the scope names below are kept as
> **capabilities** held in our database (auth-and-sign-in.md 5.1). Nothing is built. The local stdio server
> (`core/bin/mcp.ts`, 15 read tools) is the only MCP that exists. Last verified 25 Oct 2026 against main 4230210.

> **Access levels, 25 Oct 2026 ([auth-and-sign-in.md](auth-and-sign-in.md) section 14, PLAN R-150 to R-156).** The scopes
> in section 3 are grouped into six named access levels, one per connected app (Public catalogue; My plans, read, the
> default; My plans, propose changes; My plans, change; Research, propose; Review and admin, owner only), plus three
> add-ons off by default (booking codes, travellers' details, removals without asking). The user sets them on Account,
> Connected apps and access; write levels need a separate confirmation on our site; sharing, publishing and merging always
> ask on the site. Section 8's mixed tools are proposed to split into read and write tools (Q196), so the count rises
> from 29 to about 38.

> **Remote v1 derived from the API, 26 Oct 2026 (planned; [tools-v1-from-api.md](tools-v1-from-api.md), with the property
> matrix [../features/property-display-matrix.md](../features/property-display-matrix.md)).** Every remote tool is a
> projection of one `/api/v1` or account endpoint, through a transport-neutral endpoint table and guard in `core/src/api/`
> (API-G). It supersedes, for v1: principle 8's `cursor` (the API's `page`, `pageSize`, `nextPage`; MCP page size at most
> 25), section 2's "Hono app" and "`packages/domain`" (the route is `web/app/mcp/route.ts`; the contracts are
> `core/src/schema/api/**`), section 4's limits (auth-and-sign-in.md 6.4 wins), and section 5's error list (adds
> `too_large` and `not_available`, one mapping table with the API codes). The v1 public set is 12 tools (section 3 of that
> page) plus two graph tools when their routes exist; field lists come from `expose.mcp` in the property registry.

> **The MCP as a product, 26 Oct 2026 (owner's second direction; planned; [product.md](product.md)).** Five layers over one
> set of operations: API-derived reads, role-scoped writes through the app's routes, our research method and schemas as
> resources and prompts, validation and previews, and a response format with view hints and MCP Apps views. Users copy and
> customise trips into their Mine and save their own researched plans privately; catalogue changes are staged, approved on
> our site and published only by a release. Section 8's tool list is superseded for v1 by
> [product-roles-and-tools.md](product-roles-and-tools.md) 3; a new bundle H2 (v0.20a writes, v0.20b staging) follows H.

| Page | Contents |
|---|---|
| [identity-and-roles.md](identity-and-roles.md) | **one identity for the site and every AI app (28 Oct 2026):** the lookup chain from token to role, effective capability, the single endpoint and its unauthenticated handshake, per-user MCP access, sign-up abuse, suspension, deletion and export |
| [tool-registry-and-admin-controls.md](tool-registry-and-admin-controls.md) | **locks and the admin panel (28 Oct 2026):** registry and policy, lock scopes and precedence, the per-call check, panic, audit, the `/admin/mcp/` screens and routes |
| [tool-catalogue.md](tool-catalogue.md) | **every tool, M1 to M5 (28 Oct 2026):** 56 tools with level, annotations, route, schemas, caps, errors; the schema pipeline; wins over the lists below |
| [BUILD-READINESS.md](BUILD-READINESS.md) | **build readiness (28 Oct 2026):** tasks per phase with hours, files, contracts, migrations, tiers, gates, owner steps, switches, rollback, definition of ready |
| [product.md](product.md) | **the MCP as a product (26 Oct 2026):** vision, principles MX1 to MX10, R-252 extended, phases M1 to M5, owner questions QX1 to QX12; index of the `product-*` pages: [roles and tools](product-roles-and-tools.md), [method and discovery](product-method-and-discovery.md), [staging and admin writes](product-staging-and-admin-writes.md), [response format](product-response-format.md), [security](product-security.md), [testing and evals](product-testing-and-evals.md), [packaging and phases](product-packaging-and-phases.md) |
| [tools-explore.md](tools-explore.md) | `search`, `get`, `area_guide`, `plan_drive`, `sun`, `weather` |
| [tools-plan.md](tools-plan.md) | `list_trips`, `get_trip`, `create_trip`, `edit_trip`, `draft_days`, `check_trip`, `share` |
| [tools-reservations.md](tools-reservations.md) | `reservations` (list, add, update, attach, set status, reveal codes) |
| [tools-tasks-and-budget.md](tools-tasks-and-budget.md) | `tasks`, `budget`, `household` |
| [tools-templates.md](tools-templates.md) | `list_templates`, `fork_template`, `adapt_trip` |
| [tools-research.md](tools-research.md) | `research_brief`, `start_job`, `propose`, `submit_job`, `bulk_import`, `author_trip` |
| [tools-review-admin.md](tools-review-admin.md) | `review_queue`, `decide`, `merge_entities`, `publish_template`, `coverage`, `backlog` |
| [resources-and-prompts.md](resources-and-prompts.md) | resources (schemas, vocabularies, lane contracts) and prompts (recipes) |
| [client-recipes.md](client-recipes.md) | worked example sessions, call by call |
| [security.md](security.md) | threat model and mitigations |
| [auth-and-sign-in.md](auth-and-sign-in.md) | how each MCP surface signs in (stdio, public, private), Neon OAuth, personal access tokens, capabilities over RLS, build order |
| [tools-v1-from-api.md](tools-v1-from-api.md) | the remote v1 tools (v0.19 public, v0.20 private) as projections of API endpoints: inputs, outputs, field lists from the property matrix, paging, errors, privacy, tests, the API tasks that land first |

## 1. Principles

1. **Task-shaped tools, about 25 in total.** Chat clients choose worse as the tool list grows, and
   thin CRUD tools force long call chains that fail halfway. Each tool does one job a person would
   name ("add this flight", "make the trip 10 nights"), and several write tools take a list of
   operations so a client can do a whole change in one call.
2. **Every tool calls the operation layer.** No tool touches tables directly. The same operation
   (`trip.create`, `item.move`, `reservation.add`...) backs the web UI, the HTTP API (`/api/ops/*`)
   and the MCP tool, so behaviour, validation, permissions and the `op_event` log are identical
   whichever door was used.
3. **Results point back to the app.** Every created or changed object comes back with its `id` and
   an `url` (`https://app.<domain>/t/<trip>/...`) so the client can tell the user "open it here", and
   with a short `summary` line the client can quote. Where sharing is the natural next step (a
   finished day plan, a published template), results include `share_hint` with the existing share
   links (`url`, scope, expiry) so the client can offer them; creating a new link is always a separate
   `share` call confirmed by the user.
4. **Idempotent writes.** Every write tool accepts `client_op_id` (a ULID the client generates). The
   server stores it in `op_event` with a unique key per actor, so a retried call after a timeout
   never adds the flight twice. Repeating a call with the same id returns the first result.
5. **Batches with one undo.** `edit_trip`, `reservations` (`add` with many segments), `tasks` and
   `propose` accept an ordered list; it applies atomically (all or nothing) and is recorded as one
   batch, so the trip's activity feed shows "Claude added 6 items" with one Undo.
6. **Preview before big changes.** Tools that rewrite much of a trip (`draft_days`, `adapt_trip`,
   `fork_template`) default to `mode: "preview"` and return a diff and warnings; the client shows it
   to the user and calls again with `mode: "apply"` and the returned `preview_id`.
7. **Never invent; leave empty.** Tool descriptions tell clients: never make up confirmation codes,
   prices, opening times, distances or sources; leave a field out rather than guess; ask the user when
   a choice changes the plan (which hotel, which day).
8. **Small outputs.** Lists are paginated (`cursor`), entities come in a compact form unless
   `detail: "full"` is asked for, and geometry is omitted unless requested.

### 1.1 Rule: MCP sits on the API layer, never on the database (planned, 26 Oct 2026; PLAN R-252)

The remote MCP tools (public and private) are a second door onto the layer `/api/v1` already uses: the typed
`CatalogueStore` behind the store router (CAT-Q), the Zod contracts in `core/src/schema/api/**`, the operations in
`core/src/ops/**` and the shared server functions the route handlers call. They never reach the database themselves.

| # | Rule | How it is held |
|---|---|---|
| M1 | **No MCP code imports a database client or runs SQL.** Nothing under `web/app/mcp/**`, `web/lib/mcp/**` or `core/src/mcp/**` imports `pg`, `postgres`, `@neondatabase/serverless`, an ORM or query builder, `core/src/db/**` (including `withUserTransaction`) or `core/src/catalogue/postgres/**`, and none holds a SQL string or `sql` template | a test greps those paths for the imports and for SQL keywords at the start of a string (MCP-C writes it for `core/src/mcp/**`; MCP-1 extends it to the web paths; it runs in T1 for every MCP change and in check-all) |
| M2 | **Reads go through the store, writes through the operations.** A public tool calls the same `CatalogueStore` method as its `/api/v1` route; a private tool calls the same server function or operation as the app's route for that action (`trip.create`, `item.move`, ...), which opens `withUserTransaction` itself | the tool-to-route table in MCP-C's contract names, for every tool, the route handler or operation it shares; a tool without one fails the contract test |
| M3 | **`respond()` applies to every MCP response.** The privacy detector and allowlists that guard `/api/v1` bodies run on every tool result, public and private, before it leaves the server | MCP-1 and MCP-2 tests plant household strings and expect a refusal |
| M4 | **Private writes get the same validation and RLS as the app.** Because they run the app's operations inside `withUserTransaction` as the caller, Zod validation, row-level security and the `op_event` log are identical whichever door was used (principle 2 above) | MCP-2's cross-user tests reuse the route handlers' isolation cases |
| M5 | **Access checks live in the shared layer too.** The level and grant check (MCP-G), token resolution (MCP-T) and quotas (the `quota_bucket` module of EML-Q) are server functions outside the MCP folders that the MCP transport calls with the verified identity; the MCP folders hold only transport, tool registry, schemas and mapping | MCP-G and MCP-T own their logic under the shared server layer (for example `core/src/access/**`), not `core/src/mcp/tokens/**` as auth-and-sign-in.md 8 first listed |

**Consequence:** the Postgres cutover (bundle K, SRV-0 seams) is invisible to MCP. When a store method moves from
`JsonStore` to `PostgresStore`, the public tools change with `/api/v1` and need no edit; the early Postgres reads of
private MCP (CATALOGUE-EARLY 5) already arrive through the same router. The local stdio server (`core/bin/mcp.ts`) is
owner-only and reads files; M1 applies to it too (it imports no database client today).

## 2. Transport and endpoint

- **Streamable HTTP** at `https://app.<domain>/mcp`, served by the Hono app inside the Next.js
  app (Vercel frontend hosting selected; the separate MCP deployment remains unbuilt and
  unconfigured; the home-server container behind a Cloudflare Tunnel in 08-self-hosted.md
  is historical).
- One session per client connection; no server-side conversation state beyond the session id.
- Server name `travel`, version from the app release (`2027.1.0`); tool schemas published from the
  Zod definitions in `packages/domain`.
- Local development: the same server on `http://localhost:3000/mcp`; Claude Code connects with a
  personal access token header.

## 3. Authentication

| Method | For | How |
|---|---|---|
| **OAuth 2.1 (Neon Managed Better Auth OAuth provider, proposed 25 Oct)** | Claude, ChatGPT and other remote connectors | our protected resource metadata names Neon's issuer; client ID metadata documents, DCR off; PKCE; our own sign-in and consent pages; JWT verified by JWKS with exact `iss` and `aud` ([auth-and-sign-in.md](auth-and-sign-in.md) 4.3, 5). **Not built**; MCP-0 spike first (the Supabase Auth OAuth server in 08-self-hosted.md 5 is historical) |
| **Personal access token** | Claude Code, scripts, the owner's research runs | created in Settings → Connected apps, shown once, stored hashed; sent as `Authorization: Bearer`; has the same scopes; expiry 90 days by default |

The consent screen lists the client name, the scopes in plain words, and what is never shared
("Claude can read and change your trips. It cannot see confirmation codes or your family's ages
unless you allow it."). Tokens are revocable per client. Every operation records the client
(`mcp:claude`, `mcp:chatgpt`, `pat:research-laptop`) in `op_event`.

### Scopes

| Scope | Allows | Default for |
|---|---|---|
| `catalog:read` | search and read the published catalog, area guides, templates | every signed-in account allowed MCP (no anonymous access since 27 Oct 2026) |
| `trips:read` | read the user's trips (items, reservations without codes, tasks, budget) | signed-in users |
| `trips:write` | create and change trips, reservations, tasks, budget, household preferences | signed-in users |
| `reservations:read` | reveal confirmation codes, PNRs, ticket numbers | off; the user ticks it on the consent screen |
| `people:read` | travellers' ages, heights, passport expiry (for eligibility and document checks) | off; ages are summarised as "child, 9" without it |
| `research:propose` | create research jobs and changesets | owner, researchers |
| `review` | decide on changesets, merge entities | owner, moderators |
| `admin` | publish templates, author curated trips, bulk import, manage coverage and backlog | owner |

Without `people:read`, eligibility still works: tools return "fits" or "does not fit: needs 12+" per
traveller label ("Child 1"), never the birth year.

## 4. Rate limits and budgets

| Who | Limit |
|---|---|
| unauthenticated (sign-in handshake only, since 27 Oct 2026) | 30 requests a minute per IP; no tools |
| signed-in user | 600 calls per hour; 60 writes per minute |
| research tokens | 2,000 calls per hour; `propose` at most 500 changes per changeset |
| routing and weather inside tools | cached first; at most 200 uncached routing calls per user per day |

Limits return error `rate_limited` with `retry_after_s`. Family use will never hit them; they exist so
a looping client cannot run up the routing quota or fill the review queue.

## 5. Error model

Errors are tool results with `isError: true` and a JSON body, so the client can read and act on them:

```json
{ "error": { "code": "validation_failed", "message": "end_day 3 is before day 5",
  "field": "ops[2].end_day", "hint": "Use a span with end_day >= day.", "retryable": false } }
```

| Code | Meaning | Client should |
|---|---|---|
| `validation_failed` | input does not match the schema or a rule | fix the named field |
| `not_found` | id or slug unknown, or not visible to this user | search again; never guess ids |
| `forbidden` | scope or role missing | tell the user which permission is needed |
| `conflict` | the trip changed since `base_version` | re-read the trip and retry the intent |
| `needs_confirmation` | a preview exists; apply needs `preview_id` | show the preview to the user |
| `rate_limited` | too many calls | wait `retry_after_s` |
| `upstream_unavailable` | routing, weather or geocoding service down | continue without it; the field comes back `null` with a note |
| `internal` | bug | report; do not retry more than once |

Warnings (day checks, eligibility, missing stays) are not errors: write tools return them in
`warnings[]` beside a successful result.

## 6. Versioning

- Tool names are stable. New optional fields can appear at any time; removing or renaming a field
  needs a new tool name (`edit_trip_v2`) and the old one stays for 6 months.
- Every trip result carries `version`; write tools accept `base_version` for optimistic concurrency.
  Without it, intent-based operations (move after, add to day) are applied to the current version.
- Resources carry `schema_version`; clients can cache them by that value.

## 7. Never exposed over MCP

- Other users' private trips, households and people.
- Passport expiry, heights, birth dates without `people:read`; passport numbers are never stored.
- Confirmation codes, PNRs, ticket numbers, PINs without `reservations:read`; card numbers are never stored.
- Attachments' contents (tickets, receipts) — a client can attach a file and list attachments, but
  downloading one needs a signed URL opened by the user in the app.
- Raw `op_event` inputs of other actors, auth tables, tokens, service keys.
- Raw research job logs and agent transcripts.
- Share-link tokens of links the caller did not create (owners and editors see all links of their trips).

## 8. Tool list at a glance

| Group | Tools | Scope |
|---|---|---|
| Explore | `search`, `get`, `area_guide`, `plan_drive`, `sun`, `weather` | `catalog:read` |
| Plan | `list_trips`, `get_trip`, `create_trip`, `edit_trip`, `draft_days`, `check_trip`, `share` | `trips:*` |
| Reservations | `reservations` | `trips:*`, codes need `reservations:read` |
| Tasks, budget, household | `tasks`, `budget`, `household` | `trips:*` |
| Templates | `list_templates`, `fork_template`, `adapt_trip` | `catalog:read` + `trips:write` |
| Research | `research_brief`, `start_job`, `propose`, `submit_job`, `bulk_import`, `author_trip` | `research:propose`; the last two `admin` |
| Review and admin | `review_queue`, `decide`, `merge_entities`, `publish_template`, `coverage`, `backlog` | `review` / `admin` |

29 tools. A normal user's client sees only the tools their scopes allow (the server filters
`tools/list` by scope), so a family member's Claude sees about 20.
