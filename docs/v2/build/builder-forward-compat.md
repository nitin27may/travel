# Builder forward-compatibility: a checklist for current work

Status: binding from 27 Oct 2026 (owner direction; BACKLOG 15.343). Every builder, designer and reviewer of a task that is
**not** a trip-builder (TB) task reads this page before starting. The trip builder
([features/trip-builder.md](../features/trip-builder.md)) is coming: visitors will create their own trips, not only copy
ours. Its isolation rules are trip-builder.md section 15; this page says what current work must do, or avoid, so the
builder slots in later with no rework. Principles by number from
[foundation/principles.md](../design/foundation/principles.md).

A brief that touches a row below quotes the row id (F1 to F14) in its acceptance checks. A review that finds a breach
files it as a must-fix.

## 1. The checklist

| # | Do (or avoid) now | Why the builder needs it | Check |
|---|---|---|---|
| F1 | **Cards, rows, chips and filter pills take data by props only.** No component in `web/components/{places,entity,ui}/**` fetches, reads storage or assumes the page it sits on; actions go in an optional `trailing` (or `actions`) slot, default empty | The builder's candidate list reuses them with a pick control in the slot (A2) | `git grep -nE "fetch\(\|readLocal\|useTripUrl" -- web/components/places web/components/entity web/components/ui` adds no line in your diff |
| F2 | **Facet and URL keys stay one registry.** New list filters go through `web/lib/entities/facets/**` and the URL codec of `lib/entities/url.ts`; never a page-local key parser. Never reuse a key the builder reserves on `/plan/` with a different meaning: `m cc rg from r n p f d pace mv mo b o gw s draft seed` | The builder's `f=` key is the Places keys verbatim (2.5) | review: no new `searchParams.get(` outside the codec in your diff |
| F3 | **Mine tabs are a list, not a union.** NAV-3 (and any Mine change) turns `MineTab` and `MineShell`'s panels into a small array of `{ value, label, count, panel: dynamic(...), enabled }` so "My plans" is one entry | Extension point X6 becomes one line, and Mine stays a serial hot spot for one row, not a refactor | review of NAV-3 |
| F4 | **Envelopes stay versioned and additive.** `copies/1`, `trip-custom/1`, `favourites`, `visits/1`: add optional fields only; an unknown or newer `schema` is left untouched, never rewritten. Never add a plan field to them | The builder seeds from a copy (read once) and keeps its own `plan-draft/1` (ISO-6, ISO-7) | `git diff` of `core/src/schema/{copies,trip-custom,favourites}.ts` shows no removed or renamed field |
| F5 | **Keep the party in one place.** The device party is `travel.party` via `web/lib/storage/keys.ts`; its shape and words are `core/src/trips/party.ts`. No new party store, no party copy in another key | The builder reads the same party (ISO-3); two stores would disagree | `git grep -n "adults" -- web/lib ':!web/lib/storage' ':!web/lib/mine'` adds no new store in your diff |
| F6 | **The scheduler stays pure and server-callable.** `core/src/schedule/**` has no DOM, no storage, no fetch, no clock (`Date.now()` only from an argument), no import from `web/`; new behaviour is a pure function with inputs | The builder calls `scheduleDay` on the server and in a lazy client chunk (4.6, 4.10) | `git grep -nE "window\.\|document\.\|fetch\(\|Date\.now\(\)\|from '@/" -- core/src/schedule` prints nothing new |
| F7 | **Catalogue queries are general.** Any store or API filter added now accepts sets and paging: a set of areas (admin-1 ids), kind, season month, suitability band, `near` (centre, radius, minutes), `within` (park), page and page size from `PAGE_SIZE`; capped inside the store (P8) | `PlanService` builds candidates from these without a new `store.ts` method (ISO-5) | contract kit case for each new filter with a set value and a page beyond the first |
| F8 | **Regions and areas are complete and stable.** Every place carries `area_id` (AREA-2), a point, `near_town`; area ids and public slugs change only through `slugs.ts rename` or `alias` (public aliases, no month or year) | Share links name picks by slug and regions by id (2.5); a rename must still resolve | `slugs.ts --check`, `capture.ts derive-area --check` |
| F9 | **Trip-specific values come from data.** No `Rockies`, `Dolomites`, a trip slug, a base town or a gateway as a literal in new UI or engine code; read them from the trip, the base plan or `core/src/config/` | The builder shows the same components for any country | `git grep -nE "[Rr]ockies\|[Dd]olomit\|canadian-rockies" -- web/components web/app ':!web/app/specimen' ':!**/*.test.*'` adds nothing in your diff |
| F10 | **Day and stop renderers take engine output, not the trip page model.** New day, table and booking views type their input as `ScheduledDay` / schedule entries from `core/src/schedule/types.ts` (plus a small view model), not `TripPlan` internals | The builder's Build step shows a plan that has no trip page behind it | review: no import from `web/components/trips/model.ts` in a new generic renderer |
| F11 | **Exports and copy contracts are additive and per item.** Calendar, PDF, CSV and share text take a plan-shaped input (days with entries, a title, a party band), one plan at a time; never a list of all trips | "Add to calendar" and PDF of a draft reuse them (TB-P5c, P8) | `core/src/export/**` signatures accept an input object, not a trip slug lookup |
| F12 | **Layout primitives serve both platforms.** Sheets (`BottomSheet` with `sheetSnap.ts`), `SideSheet`, panes and the Plan grid stay generic components with tokens from `tokens.md`; no new page-specific sheet | Phone-native and desktop-native builder screens (TB11) are built from them | design review |
| F13 | **No new client bulk load and one data boundary.** New data reaches components only through `web/lib/client/data.ts`; no new full-list JSON, no graph or capture file in a client chunk (P8, P9) | The builder's candidates and builds are paged server calls; a bulk file now would be copied by the builder later | `web/tests/data/boundary.test.ts`, `light-data.test.ts` |
| F14 | **Leave `/plan`, `travel.plans.*`, `planBuilder`, `plan_draft` and `/api/v1/plan/**` unused.** No route, key, flag, table or endpoint of another feature takes these names | The builder's namespace (ISO-1 to ISO-6) | `git grep -nE "travel\.plans\.\|planBuilder\|plan_draft\|/api/v1/plan" -- web core` prints nothing outside the TB paths |

In the page source, `\|` inside a table cell is the markdown escape for `|`; type `|` when you run the command.

## 2. Notes for tasks in flight or next (what each leaves as an extension point)

| Task | Bundle | Leave this | Rows |
|---|---|---|---|
| UXB-5 Table view (`timeline/DayTables.tsx`) | C | Columns from a column spec fed by schedule entries, so a plan's days can use the same table on desktop | F10, F1 |
| UXB-7 place pages (`web/components/places/**`, `sections.ts`) | C | Place card and list row with a `trailing` slot and no page assumptions; section render rules as pure functions of the record | F1, F13 |
| LST2b and LST2b-C (city level, counts) | C | The area and city filters accept a set; counts per area are a store call the builder can reuse for Regions (step 2) | F7, F2 |
| PA-W (Book ahead rows) | C | Book ahead rows derived from records and park requirements by a pure function of a list of stops, not of a trip slug | F10, F11 |
| ORG-C, ORG-1 (origin, airports) | C | The origin picker as a component with props and `origin/1` as its own envelope; the airports layer behind a store call | F1, F4, F7 |
| EG-Q (`within`, `PlaceContext`) | E | `within` as a list filter on the place query, not only a place-page join | F7 |
| STY-E (stays evaluator) | E | Evaluator input is a base set plus stops, not a trip id; pure and server-callable | F6, F10 |
| CUS-C, CUS-1 (customise) | F | `trip-custom/1` additive only; no plan fields; "Open in the builder" is a later link in `web/app/t/**` that the TB task adds after CUS-2 | F4, F14 |
| NAV-3, NAV-D (signed-in Mine, sync) | F | Mine tabs as a list (F3); the sign-in merge keyed by envelope `schema`, so `plan-draft/1` adds a branch and changes nothing else | F3, F4 |
| REQ-F1, REQ-F2, REQ-E | D, G | Request forms accept pre-filled country, regions and refs from a query (the builder's "Ask us"); own stops (REQ-E) as refs a plan can hold | F2, F4 |
| MCP-C, UPL-C (MCP, user places) | H, H2 | Plan tools later call the same `/api/v1/plan/**` routes and write `plan-draft/1`; `user_place` refs usable as picks; UPL-C's `plan_draft.kind` is not used for plans (trip-builder QI1) | F14, F4 |
| WM (world map) | after F | "Plan a trip here" is a plain link to `/plan/?cc=<ISO>`; `visits/1` stays device-only and is read, never written, by the builder | F4, F14 |

## Change log

- 2026-10-27: created (BUILDER-ISOLATION, travel-planner, Opus) from the owner's direction of the same day.
