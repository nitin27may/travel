# Features

One page per feature area. Each page has the same sections: Purpose, User stories, Detailed
behaviour, Data touched (with Schema additions where the draft schema needs more), Operations and
MCP tools, Edge cases, Acceptance criteria, Milestone, Open questions.

Backend baseline (R-60, Oct 2026): Neon Postgres, Managed Better Auth and Neon Realtime are
selected and provisioned, with 10 migrations applied. What is implemented is only the account
foundation: email/password sign-up, sign-in and sign-out, private `planner_draft` CRUD under RLS, and
live invalidation through one content-free, non-RLS `planner_draft_signal` relation
(coordinator-approved exception) followed by an authenticated, RLS-scoped re-fetch. The full
planner, household membership policies, guest drafts, sharing, presence, trip collaboration, admin,
OAuth/MFA, consent flows, object storage and serverless functions are proposed and unimplemented.
Vercel is selected for frontend hosting, with project setup/deployment deferred until merge-ready
(PLAN R-61); object storage and functions remain unselected. The earlier self-hosted Supabase stack
is historical.

Decisions every page assumes (from the numbered docs): Next.js with Hono for `/api` and `/mcp`
(proposed); the operation layer is the only writer; live co-editing of committed operations
(future; mechanism not yet designed on Neon); family first; **we never book anything** (people record reservations); no expense-splitting UI in v1; the MCP
is a first-class front door. Sharing rules come from [10-sharing.md](../10-sharing.md); every page with something shareable has a **Sharing** subsection.

| Page | Scope | Milestone | Status |
|---|---|---|---|
| [F01 Household and profiles](F01-household-and-profiles.md) | Home base, people, ages, passports, passes, standing preferences that pre-fill every trip | M0, M2 | draft |
| [F02 Trip creation and trip types](F02-trip-creation-and-trip-types.md) | Intent sheet, express path, and what each trip type (day trip ... friends) changes | M2 | draft |
| [F03 Candidates and the travel year](F03-candidates-and-travel-year.md) | Comparing destinations before choosing; the year timeline with goals, long weekends, budget | M2, M3 | draft |
| [F04 Explore, search and suggestions](F04-explore-search-and-suggestions.md) | Map + cards + filters, drive time from the lens, personas, reasons, zero-result rescue | M1 | draft |
| [F05 Catalog entity pages](F05-catalog-entity-pages.md) | Trail, activity, stay, eatery and place pages: every link, trailhead, parking, permits, limits, evidence | M1 | draft |
| [F06 Plan document, lists and days](F06-plan-document-lists-and-days.md) | The Wanderlog-style scrolling plan, named lists, days, items, variants, Plan B, board and phone pager | M2 | draft |
| [F07 Day checks, drafting and route optimising](F07-day-checks-drafting-and-route-optimising.md) | Feasibility checks with fixes, "fill this day", "reorder to cut driving", breaks on drive days | M2, M7 | draft |
| [F08 Reservations and wallet](F08-reservations-and-wallet.md) | Recorded bookings, to-book placeholders, email and chat-client entry, wallet in Today mode | M3 | draft |
| [F09 Tasks, checklists and reminders](F09-tasks-checklists-and-reminders.md) | Generated and manual tasks, inline checklists, push/email/ICS reminders, inbox | M3 | draft |
| [F10 Budget and expenses](F10-budget-and-expenses.md) | Planned vs actual by category, expenses, passes, home currency | M3 | draft |
| [F11 Collaboration, live editing and sharing](F11-collaboration-live-editing-and-sharing.md) | **The sharing feature page** (summarises [10-sharing.md](../10-sharing.md)); members and roles, live updates and presence, activity feed, guest links | M2 | draft |
| [F12 Templates, reuse and adaptation](F12-templates-reuse-and-adaptation.md) | Curated sample trips, fork as-is, adapt to length, season, weather and party, template updates | M5 | draft |
| [F13 Today mode and offline](F13-today-mode-and-offline.md) | The phone during the trip: next stop, leave-by, running late, wallet, offline download and sync | M4 | draft |
| [F14 After the trip](F14-after-the-trip.md) | What happened, corrections to the catalog, memories, publish as template | M5 | draft |
| [F15 Maps, routing and exports](F15-maps-routing-and-exports.md) | Basemaps, drive times and caching, tracks, offline tiles, GPX, ICS, Maps links, My Maps CSV | M1-M4 | draft |
| [F16 Admin console](F16-admin-console.md) | Review queue, research jobs, coverage, backlog, publishing curated trips and templates, moderation | M1, M5, M6 | draft |
| [F17 Accounts, auth and privacy](F17-accounts-auth-and-privacy.md) | Sign-in, roles, MCP OAuth and tokens, row-level security, export and delete (only the email/password and private-draft account foundation is built) | M0 | draft |
| [Trip timeline and party profile](trip-timeline.md) | Public trip page: whole-trip and per-day timelines with times and confidence, the core scheduler, trip-level party profile replacing per-day A/B/C, prose cleaning | public site, wave 3 (L3c, L3d) | spec |
| [Short trips](short-trips.md) | Day trips, overnights and weekends (0 to 3 nights): length class from nights, weekday pattern, the outing frame (leave by, home by, both drives, permits, go/no-go, Plan B, bring list), the compact page, drive from a public hub, origin privacy | public site wave 3 (L3b, L3e); creation flow in the planner | spec |
| [Smart search](smart-search.md) | Search that reads a human query with no paid model: a deterministic parser to the existing filter keys with chips, "Did you mean" and a "Not checked yet" group; a gte-small semantic ranking spike (browser first; server inference runtime not chosen; RRF); CLIP and similar places later | public site stage 3 (3.15, lane SQ1 3.43); phase 3 in L9 | spec |

## Schema additions proposed across pages

Collected here so `schema.sql` can be updated in one pass once the owner reviews.

**Applied to schema.sql on 17 Oct 2026:** priority, weather_sensitive, min_daylight_min, source_item_id,
actual times, trip_types, check_overrides, budget_target, food_per_person_day, template_version /
forked_from_version / template_meta, share_link, private flags, op_event.batch_id, user_settings,
mcp_token, inbound_address / inbound_email, fx_rate, check_dismissal, day_state, item_memory,
template_update_decision, person.weight_kg, entity_link (from research R2). Naming settled with
research/README.md: parking is place subkind **`parking`** (not `parking_lot`), and the trip-type
reference table is **`trip_type`** (not `trip_type_profile`). Still proposals: trip_lesson, visit_stat,
offline_package, routing_budget, ops_health, change.duplicate_of, task.relative_to.

| Table / column | Proposed by | Purpose |
|---|---|---|
| `trip_item.priority` (must, should, nice) | F06, F12 | which items survive when a trip is shortened |
| `trip_item.weather_sensitive`, `trip_item.min_daylight` | F07, F12 | Plan B and daylight checks |
| `trip.trip_types text[]` | F02 | day_trip, weekend, vacation, family, couple, luxury, adventure, road_trip, camper, multi_gen, solo, friends |
| `trip_type_profile` (reference) | F02 | defaults and rules per trip type |
| `entity.attrs` keys for trails: `links[]`, `trailhead_entity`, `parking[]`, `permits[]`, `hazards[]`, `dogs`, `stroller` | F05 | trail page content (validated by the trail Zod schema) |
| `parking` as entity subkind `parking_lot` (kind `place`) with `attrs.capacity`, `fee`, `fills_by`, `shuttle`, `toilets`, `ev` | F05 | parking is shared across trails |
| `template_meta` on `trip` (min_nights, max_nights, good_months, party_fit, version, published_at, curated) | F12 | curated templates and adaptation |
| `trip.template_version_seen` | F12 | "updates available" for forks |
| `trip_item.source_item_id` | F12 | maps a forked item back to the template item |
| `trip_event_note` / `item_memory` (photo, note, rating) | F14 | after-trip memories |
| `user_settings` (units, language, quiet hours default) | F17 | per-user preferences |
| `mcp_token` (personal access tokens, scopes, last used) | F17 | MCP fallback auth |
| `share_link` (as defined in 10-sharing.md), `trip_item.private`, `day_note.private`, `op_event.batch_id` | F11 | guest links, private notes, batch undo |
| `check_dismissal`, `trip.check_overrides` | F07 | dismissed checks, per-trip thresholds |
| `fx_rate`, `trip.budget_target`, `trip.food_per_person_day`, `trip.fuel` | F10 | currencies and estimates |
| `inbound_email`, `user_inbound_address` | F08 | forwarded confirmations |
| `template_version`, `template_update_decision`, `trip.forked_version` | F12 | versions and fork updates |
| `day_state`, `trip_item.actual_start/actual_end`, `offline_package` | F13 | during-trip state, offline |
| `item_memory`, `trip_lesson`, `visit_stat` | F14 | memories, lessons, visit aggregates |
| `entity_link` table, subkinds `trailhead` and `parking_lot` | F05 | links with checking, parking shared by trails |
| `leg_cache.geometry` as `geography(LineString)`, `routing_budget` | F07, F15 | corridor search, quota |
| `research_job.template`, `research_job.gaps`, `change.duplicate_of`, `ops_health` | F16 | jobs and admin health |
| `person.weight_kg`, `trip_candidate.date_window`, `travel_goal.match`, `task.relative_to/offset_minutes`, `user_settings`, `oauth_client_seen` | F01, F03, F09, F17 | as described on those pages |
