# MCP product: personas, roles and the tool catalogue

Part of [product.md](product.md). Status: spec only, planned (26 Oct 2026). Every tool below names the route or operation
it shares with the web app (MX1); inputs are the route's Zod input, tightened; outputs are projections of the route's
answer in the response contract of [product-response-format.md](product-response-format.md). Read tools are specified in
detail in [tools-v1-from-api.md](tools-v1-from-api.md) 3 to 6; this page adds discovery, validation, user writes, research
and admin tools, and the role matrix.

## 1. Personas

| Persona | Client | Goal | Phase |
|---|---|---|---|
| **Visitor** (no account) | ChatGPT, Claude, any MCP client, no sign-in | "Find family hikes near Lake Louise in September"; "show me the Dolomites trip, day 4"; "what do I need to book?" | M1 |
| **Planner** (signed in) | the same clients, connected with OAuth | "Copy the Rockies trip for 5 September 2029, drop day 9, add a rest day"; "save these three lakes"; "suggest Bruce Peninsula to the site" | M2 read, M3 write |
| **Self-researcher** (signed in) | Claude or ChatGPT with web access | "We are going to Newfoundland; research Gros Morne the way this site does and make it my plan" | M3 |
| **Developer and power user** | Claude Code, Cursor, VS Code | the same tools plus discovery and validation in a scripted loop; later the research toolkit | M1 to M3 |
| **Owner (admin)** | Claude Code with a PAT, claude.ai | "Research Algonquin's campgrounds into staging", "fill the required gaps of the Rockies trip", "refresh prices older than 120 days", "triage the request queue" | M4 |
| **Researcher (invited, later)** | as owner | stage research batches for review; never publish | after M4 (QX11) |

## 2. Roles to access levels

The six access levels and three add-ons of [auth-and-sign-in.md](auth-and-sign-in.md) 14.2 are kept. Roles are a user's
maximum; a connected app holds one level at or below it, chosen by the user on Connected apps; `MCP_MAX_LEVEL` caps
everyone per environment.

| Role | Endpoint | Highest level | Add-ons available | Notes |
|---|---|---|---|---|
| Anonymous | `/mcp/` | `catalogue` | none | no `Authorization` header (a request with one gets 400) |
| Signed-in user | `/mcp/private/` | `plans_write` | `codes` (later, planner), `people`, `removals` | default level `plans_read` (auth Q190); writes need the 14.4 confirmation on our site |
| Researcher (invited) | `/mcp/private/` | `research` (plus the user's own levels) | none | later (QX11) |
| Owner | `/mcp/private/` | `owner_admin` | all | bootstrapped by MCP-G's CLI from `OWNER_EMAIL` (auth 14.2a); `owner_admin` tokens 30 days at most |

## 3. The tool matrix

Lowest level that lists each tool; annotations R read-only, D destructive, I idempotent, O open-world (auth 14.3 B4).
"Phase" is when it ships. "Route or op" is the shared path (MX1).

| Group | Tool | Level | R D I O | Route or op | Phase |
|---|---|---|---|---|---|
| Find | `search` | catalogue | R | `GET /api/v1/search` | M1 |
| Find | `list_places` | catalogue | R | `GET /api/v1/places` | M1 |
| Find | `near` | catalogue | R | `GET /api/v1/near` | M1 |
| Find | `find_towns` | catalogue | R | `GET /api/v1/towns` | M1 |
| Find | `list_public_trips` | catalogue | R | `GET /api/v1/trips` | M1 |
| Read | `get_place` | catalogue | R | `GET /api/v1/places/{slug}/facts` (API-P) | M1 |
| Read | `place_nearby` | catalogue | R | `GET /api/v1/places/{slug}/nearby` | M1 |
| Read | `get_public_trip` | catalogue | R | `GET /api/v1/trips/{slug}` (+ `/getting-there`) | M1 |
| Read | `get_day` | catalogue | R | `GET /api/v1/trips/{slug}` projected to one day | M1 |
| Read | `trip_bookings` | catalogue | R | `GET /api/v1/trips/{slug}` projected to `categories` book rows (PA-X kinds) | M1 |
| Read | `trip_legs` | catalogue | R | `GET /api/v1/trips/{slug}/legs` | M1 |
| Read | `nearest_airports` | catalogue | R | `GET /api/v1/airports` (ORG-A) | M1 |
| Read | `sun` | catalogue | R | `GET /api/v1/sun` (API-S) | M1 |
| Graph | `get_related`, `place_needs` | catalogue | R | ENTITY and PA-Q routes | M1 if the routes exist, else next |
| Discover | `get_type` | catalogue | R | `GET /api/v1/types[/{id}]` (API-T) | M1 |
| Discover | `get_format` | catalogue | R | `GET /api/v1/method/formats/{id}` (MTH-1) | M1 |
| Discover | `get_example` | catalogue | R | `GET /api/v1/method/examples/{type}` (MTH-1) | M1 |
| Discover | `get_method` | catalogue | R | `GET /api/v1/method/{doc}#section` (MTH-1) | M1 |
| Check | `validate` | catalogue | R I | `POST /api/v1/validate` (API-V) | M1 |
| Check | `gap_report` | catalogue | R I | `POST /api/v1/validate` with `report: "gaps"` | M1 |
| Me | `whoami` | plans_read | R | MCP-G resolve function | M2 |
| Mine | `list_my_trips`, `get_my_trip` | plans_read | R | `GET /api/account/drafts[/{id}]` (CUS-C), copies (NAV-D) | M2 |
| Mine | `list_my_favourites` | plans_read | R | `GET /api/account/favourites` (FAV-D) | M2 |
| Mine | `list_my_requests` | plans_read | R | `GET /api/account/submissions` (FBK-2) | M2 |
| Plan | `copy_trip` | plans_propose | I | `POST /api/account/drafts` with `source_trip` (CUS-C; op `trip.copy`) | M3 |
| Plan | `edit_my_trip` | plans_propose | D I | `PATCH /api/account/drafts/{id}` with `trip-custom` ops (CUS-C, REQ-E-C: move, insert day, drop day, notes, title, start, variants, add from catalogue, add private place) | M3 |
| Plan | `create_plan` | plans_propose | I | `POST /api/account/plans` (UPL-C, new) | M3 |
| Plan | `add_private_place` | plans_propose | I | `POST /api/account/plans/{id}/places` (UPL-C; a `capture/1` subset, privacy household) | M3 |
| Plan | `preview_change`, `apply_change` | plans_propose; apply at plans_write | I | the preview handle of the draft route (server-minted, 30 minutes) | M3 |
| Plan | `remove_my_trip` | plans_write + `removals` | D I | `DELETE /api/account/drafts/{id}` (soft delete with inverse) | M3 |
| Mine | `save_favourite`, `remove_favourite` | plans_propose | I | `POST`/`DELETE /api/account/favourites` (FAV-2) | M3 |
| Ask | `suggest_place`, `request_trip`, `report_problem` | plans_propose | I | `POST /api/v1/submissions` signed in (FBK-1; no email step for a signed-in account) | M3 |
| Research | `research_brief` | research | R | `GET /api/v1/method/brief?type=&ref=` (MTH-1 + capture `fields`, `gaps`) | M4 |
| Research | `work_list` | research | R | `GET /api/admin/worklist?kind=gaps\|stale\|requests&trip=` (STG-1; `capture.ts gaps`, freshness classes) | M4 |
| Research | `stage_batch` | research | I | `POST /api/admin/stage` (STG-C, STG-1: `research-batch/1`) | M4 |
| Research | `list_my_batches`, `get_batch` | research | R | `GET /api/admin/stage[/{id}]` | M4 |
| Review | `review_queue` | owner_admin | R | `GET /api/admin/stage?state=submitted` and intake (REQ-M) | M4 |
| Review | `diff_batch` | owner_admin | R | `GET /api/admin/stage/{id}/diff` | M4 |
| Review | `decide_batch` | owner_admin | D I | `POST /api/admin/stage/{id}/decision` (accept per change, reject, ask); publish is **always** an approval on our site (Q198 rule) | M4 |
| Review | `list_submissions`, `show_submission`, `decide_submission` | owner_admin | R; D I | intake routes (REQ-M); never `intake_contact` | M4 |
| Review | `coverage` | owner_admin | R | `GET /api/admin/coverage` (`catalog.coverage`) | M4 |

Counts per level (with the graph tools): `catalogue` 21, `plans_read` 26, `plans_propose` 37, `plans_write` 38 (with
`removals`), `research` 26 (the catalogue tools plus five research tools; `research` never reaches the user's plans, auth
14.10), `owner_admin` 50. That is above README principle 1's "about 25"; a level sees only its tools (filtered `tools/list`,
deterministic order, `ttlMs` and `cacheScope: "private"` per 2026-07-28), and descriptions start with a verb and the job
("Copy a public trip into your Mine"), which keeps selection reliable. Conflict noted in
[product-packaging-and-phases.md](product-packaging-and-phases.md) 7.

## 4. The tool catalogue: inputs and outputs

Common rules: inputs are strict objects (unknown keys refused, auth 6.5); every write takes `client_op_id` (ULID,
idempotency, README principle 4); results follow the response contract (text summary, `structuredContent` with
`view`, resource links to the page). Read tools: [tools-v1-from-api.md](tools-v1-from-api.md) 3, 5, 6.

### 4.1 Read additions to the v1 read set

| Tool | Input | Output (`structuredContent.data`) | View hint |
|---|---|---|---|
| `get_day` | `{slug, day: 1..99, profile?}` | one `publicDay` projected (items with time, duration, stats, access, suit chips; know bullets as text; base; drive) | `day_timeline` |
| `trip_bookings` | `{slug, profile?}` | rows `{name, kind: booking\|pass\|check\|task, rule_text, note, day, link, park}` (PA-X `ExportBooking`), counted "to book ahead" excludes `check` (QP3) | `booking_list` |
| `get_public_trip` | as tools-v1 | trip summary first: shape, bases, parks, highlights, when to go, counts; days as one line each; drill down with `get_day` | `trip_card` then `day_list` |

### 4.2 Discovery and checking (M1)

| Tool | Input | Output |
|---|---|---|
| `get_type` | `{id?}` (a type id, or a word such as "canoe rental", resolved by `resolveWord`) | without `id`: the tree (ids, labels, layers); with `id`: the checklist: properties by group with label, value type, unit, mark R, R? (with trigger), A, gap wording, section; links R and A; source order; suitability profile |
| `get_format` | `{id}`: `capture/1`, `suitability/1`, `relevance/1`, `capture-changeset/1`, `research-batch/1`, `trip-custom/1`, `user-plan/1`, `windowSpec`, `priceRow`, `entry` | the JSON Schema (from `data/schema/generated/**`), a one-paragraph explanation and the rules a schema cannot hold (cross-field validators, by code) |
| `get_example` | `{type}` | one complete, valid synthetic record set for the type (record, suitability, relevance, run record, sources), from the fixtures (`core/test/fixtures/**`, PA-FX parks), never a real household record |
| `get_method` | `{doc, section?}`: `research-readme`, `capture-contract`, `lane/<name>`, `kind/<name>`, `sources-and-licences`, `suitability`, `relevance`, `trip-types` | the section as Markdown, with its version and the links to related sections |
| `validate` | `{format, doc}` (≤ 256 KB) or `{format: "batch", docs: [...]}` (≤ 1 MB, ≤ 200 records) | `{ok, errors: [{code, path, message}], warnings: [...], completeness: {level, missing_required, missing_applicable}, licence: [...]}`; codes are the validator codes (`E_CAP_*`, `W_*`) |
| `gap_report` | `{format: "batch", docs}` or `{ref}` (a public record) | per record: required gaps, conditional gaps with their trigger, safety gaps first, the research cost hint (C0 to C4) and the lane to use |

### 4.3 User-scope writes (M3)

```ts
// copy_trip: the app's copy action, signed in (CUS-C account route; op trip.copy semantics)
input  { source_trip: slug, start?: ISODate, profile?: TimelineProfile, title?: string, client_op_id: ULID }
output { draft_id, title, start, days: number, url: "https://.../t/<draft_id>/", next: ["edit_my_trip", "get_my_trip"] }

// edit_my_trip: a batch of trip-custom operations, all or nothing, one undo (README principle 5)
input  { draft_id, base_version: number, mode: "preview" | "apply", preview_id?: string, client_op_id: ULID,
         ops: Array<
           | { op: "move_item", item: string, to_day: number, after?: string }
           | { op: "remove_item", item: string }               // needs `removals` at plans_write, else a proposal
           | { op: "insert_day", after: number, title?: string }
           | { op: "drop_day", day: number }                   // as remove_item
           | { op: "set_variant", day: number, variant: "A" | "B" | "C" }
           | { op: "add_from_catalogue", ref: CatalogueRef, day: number, time?: "HH:MM" }
           | { op: "add_private_place", place_id: string, day: number }
           | { op: "set_start", start: ISODate | null }
           | { op: "set_title", title: string }               // stored as untrusted text
           | { op: "set_note", day: number, text: string } > }
output { mode, preview_id?, diff: [{op, summary}], warnings: [{code, text}] /* day checks */, version, url }

// create_plan: a new plan in our format (UPL-C), not a copy
input  { title, country: ISO2, region?, nights?: number, start?: ISODate, days?: [{ title?, base_place_id?, items: [{ ref? | place_id?, time? }] }],
         client_op_id }
output { plan_id, version, url, validation: {errors, warnings, completeness} }

// add_private_place: a capture/1 subset kept private to the user (UPL-C `user-place/1`)
input  { plan_id, record: { name, type: TypeId, point?: {lat, lon, approx}, summary?, links?: [{kind, url}],
         facts?: { [registryKey]: Val }, sources?: [{url, title?, quote? (≤300 chars), read: ISODate}] }, client_op_id }
output { place_id, validation, suggest_hint: "suggest_place can offer it to the site" }
```

Rules: a draft or plan belongs to the caller (RLS through the route); `travellers` and `fromRef` only with `people`
(QX-matrix QM8); `start` at `plans_read` and above; previews are server-minted handles stored with the draft (2026-07-28
removed sessions: handles are ordinary arguments); `apply` at `plans_propose` becomes a pending change approved on our site
(MCP-P), at `plans_write` it applies; day checks come back as `warnings`, never as errors.

### 4.4 Research and admin (M4)

```ts
// research_brief: what to collect for one record or one new destination, from our method
input  { type: TypeId, ref?: string, destination?: { name, country: ISO2, region? } }
output { checklist /* get_type */, lanes: [{lane, sources_in_order, link_table}], gaps? /* when ref */, rules: ["facts in our words",
         "quote at most 300 characters", "link-only platforms are links, never data", "never Google for coordinates", ...],
         format: "research-batch/1", example_ref }

// stage_batch: a research batch into staging (STG-C); never a catalogue write
input  { batch: ResearchBatch /* research-batch/1 */, client_op_id }
output { batch_id, state: "draft" | "submitted", validation, diff_summary: {new_records, changed_fields, removed}, review_url }

// decide_batch (owner_admin): per change accept or reject; accept of anything is a request; publish asks on our site
input  { batch_id, decisions: [{change_id, decision: "accept" | "reject" | "ask", note?}], client_op_id }
output { batch_id, state: "approved" | "partly" | "rejected", approval_url /* the site confirmation */, next: "publish runs in the release" }
```

`research-batch/1` and the publish path: [product-staging-and-admin-writes.md](product-staging-and-admin-writes.md).

## 5. Composite flows (what a client does, call by call)

| Job | Calls |
|---|---|
| "Family hikes near Lake Louise in September" | `find_towns {prefix:"Lake Louise", cc:"CA", region:"alberta"}` → `near {city, facets:{kid:["6"], season:["9"], k:["nature.trail"]}}` → `get_place` for the top three |
| "Show the Rockies trip, then day 4, then what to book" | `list_public_trips {q:"rockies"}` → `get_public_trip` → `get_day {day:4}` → `trip_bookings` |
| "Copy it for 5 Sep 2029 and drop day 9" | `copy_trip {start}` → `edit_my_trip {mode:"preview", ops:[drop_day 9]}` → user agrees → `apply_change` |
| "Research Gros Morne like this site and make it my plan" | `get_type {id:"nature.protected.national_park"}` → `get_example` → (client researches the web) → `create_plan` → `add_private_place` × n → `validate` → optional `suggest_place` |
| Owner: "Fill the required gaps of the Rockies trip" | `work_list {kind:"gaps", trip}` → `research_brief` per record → (client researches) → `validate` → `stage_batch` → owner reviews on the site |

## Change log

- 26 Oct 2026: written (travel-planner, Opus 5.5).
