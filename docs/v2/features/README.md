# Features

One page per feature area. Each page has the same sections: Purpose, User stories, Detailed
behaviour, Data touched (with Schema additions where the draft schema needs more), Operations and
MCP tools, Edge cases, Acceptance criteria, Milestone, Open questions.

Decisions every page assumes (from the numbered docs): self-hosted Supabase (Postgres + PostGIS,
Auth, Realtime, Storage) on the home server; Next.js with Hono for `/api` and `/mcp`; the operation
layer is the only writer; live co-editing through Realtime broadcast of committed operations; family
first; **we never book anything** (people record reservations); no expense-splitting UI in v1; the MCP
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
| [F17 Accounts, auth and privacy](F17-accounts-auth-and-privacy.md) | Sign-in, roles, MCP OAuth and tokens, row-level security, export and delete | M0 | draft |

## Schema additions proposed across pages

Collected here so `schema.sql` can be updated in one pass once the owner reviews.

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
