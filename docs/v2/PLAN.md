# The plan: one page for the travel product

**Also new (25 Oct, feedback):** R-90 to R-96, the Report or suggest sheet (report a problem on a trail, trip, day, stop, place, stay base or photo; suggest a place or trail; ask for a trip; site feedback), an email required and confirmed by link, signed-in prefill, anti-spam extended for email, a takedown lane, triage into the skills ([spec](features/feedback-and-reports.md)); merges with R-72 to R-75; planned only.

**Also new (25 Oct, sign-in):** R-81 to R-85, Google sign-in and sign-up on Managed Better Auth, the account-linking policy, OAuth environments and owner setup, the privacy page; Sign in with Apple deferred because Neon Managed Auth does not offer it and it costs USD 99 a year ([spec](features/google-and-apple-sign-in.md)); planned only.

**Also new (25 Oct, stays):** R-76 to R-80, stay bases and stay optimisation for every trip: the plan's own stays plus 0 to 3 researched ways to stay (fewer moves, lower cost, one base), per-base swaps, message rules, a Where to stay tab, signed-in tweaks ([spec](features/stay-bases-and-optimisation.md)); planned only; research D9-R (Rockies) after the Banff agent hands back.

**Also new (25 Oct):** R-70 to R-75, visitor favourites (on this device first, then synced to the account), place suggestions and trip requests with anti-spam ([spec](features/visitor-suggestions-and-favourites.md)); planned only.

**Newest requirements (25 Oct):** R-62 to R-67, best time to go, the trip overview, thumbnails, customisation and admin photos ([spec](features/trip-overview-and-customisation.md)); planned, queued after the closure queue and R-59.

**Current platform decisions:** Neon Postgres, Managed Better Auth and Neon Realtime are provisioned; the owner selected Vercel for frontend hosting on 24 Oct. The 86 application tables and migration ledger have RLS; `planner_draft_signal` is the sole content-free, coordinator-approved exception ([NEON-SETUP.md](build/public-site/NEON-SETUP.md)). The private account integration (email/password sign-in, private draft persistence, live invalidation and cross-user isolation) was independently verified on the uncommitted session branch ([NEON-VERIFICATION.md](build/public-site/NEON-VERIFICATION.md)); child-branch DB integration is blocked (no `TEST_DATABASE_URL`). The public catalogue still serves from `JsonStore`: the catalogue loader, a proposed `PostgresStore`, per-method parity and cutover are not implemented. Vercel project setup, encrypted environment configuration and deployment are deferred until this branch is merge-ready (R-61); no deployment has occurred. Object storage, serverless functions, jobs and full planner/collaboration remain unselected or undelivered. Supabase references in older documents are historical or, where labelled, future alternatives.

**We are building Next.js API-over-JSON routes, with the UI fixes first, so the backend move will be fast.** (Owner, 21 Oct 2026; provider revised to Neon)

UI fixes (phase A, review R1) -> Next.js `/api/v1` route handlers over `CatalogueStore` + `JsonStore`, with Zod contracts and OpenAPI (phase B) -> features on the API (phase E) -> a Postgres-backed store on Neon later, as a parity-gated store swap (SRV-0; proposed `PostgresStore`, not implemented).

Written 21 Oct 2026 by travel-planner (Opus). This is the single entry point: read it first, then follow the links. It brings together about 25 planning files and drops none of their decisions. The files it replaces in part are listed in section 7, and each carries a banner that points here.

**Authority.** This page decides the requirements, the order, the status, the rules and the open decisions. [EXECUTION-PLAN.md](build/public-site/EXECUTION-PLAN.md) decides task-level detail: owned files, efforts, acceptance checks, the API contract, the gate checklists and the owner scripts. [COVERAGE.md](build/public-site/COVERAGE.md) maps every pending item, and [BACKLOG.md](build/public-site/BACKLOG.md) holds the status of each row. When two documents disagree, this page and EXECUTION-PLAN win over everything older. Fix the losing document the same day.

```mermaid
flowchart LR
  classDef core fill:#1F4E79,stroke:#163A5A,color:#FFFFFF
  classDef data fill:#2A7F8F,stroke:#1E5F6B,color:#FFFFFF
  classDef ext fill:#B7791F,stroke:#8A5A12,color:#FFFFFF
  classDef gate fill:#C05621,stroke:#8C3E17,color:#FFFFFF
  classDef infra fill:#5A6772,stroke:#3E4850,color:#FFFFFF

  DONE["Done: stages 1-4<br/>main is the product"]:::infra
  A["Phase A<br/>UI fixes"]:::core
  R1["Gate R1<br/>owner review"]:::gate
  B["Phase B<br/>/api/v1 over JsonStore<br/>Zod, OpenAPI"]:::core
  GB["Gate G-B<br/>internal audit"]:::infra
  E["Phase E<br/>features and data<br/>on the API"]:::data
  R2["Gate R2<br/>owner review, Q43"]:::gate
  D["Phase D<br/>readiness checklist"]:::infra
  S["SRV-0<br/>PostgresStore (proposed)"]:::ext
  H["Hosting chosen<br/>then deploy"]:::infra

  DONE --> A --> R1 --> B --> GB --> E --> R2 --> D --> H
  E --> S
```

## 1. Product goal and the rules that do not bend

**Goal.** A public, read-only travel site with no login. Visitors search trips and places of every kind, come in through a full-screen globe, open full detail pages and copy or export them. About 90% of visitors read and copy, and about 10% plan (P7). The signed-in planner is the second product and comes after this one. Year one has fewer than 100 users, so choose free tiers and only note the step to 1,000 users ([product-direction-2026-10-18.md](design/product-direction-2026-10-18.md)).

| Area | Rule | Source |
|---|---|---|
| Colour | No green anywhere, status colours included. Trailhead direction: stone paper, slate ink, a navy header with an amber rule. Colour lives only in generated tokens (`web/app/themes.css`) | owner 18 Oct; Q47 19 Oct; design C 271e014 |
| Privacy | No household data on the public site: no party, no traveller ages, no home town, no dates, no personal status, no stay ideas, no booking state. Public text says who a plan suits, never who travelled. Whitby may appear only in towns-layer rows and near chips (Q50), and a test pins that | STATUS decisions; Q50 |
| Privacy | The household home point lives in one module (`core/src/privacy/home.ts` after CONS-2). It is a listed exception while the repo is private and must move to a secret before any visibility change | EXECUTION-PLAN 5.3 |
| Trips | Public trips are dateless templates: Day 1 to N, a length and a season window. Every trip is public for now (owner, 19 Oct), and the fail-closed visibility code stays | TODO Done 20 Oct; 19 Oct |
| Honesty | A gap is never a yes. An empty place section stays visible as "Not checked yet" | owner 18-19 Oct |
| P8 | Protect the catalogue: no bulk files, light list rows on an allowlist, exports per item, page-size caps and no unscoped near query, all enforced inside the store methods. Exports stay per item and public until sign-in exists (Q46) | principles.md P8 |
| P9 | One data boundary: components read only through `web/lib/client/data.ts` (`DataClient`), and no new client-side bulk loads. Every task names its boundary function, its API contract and what stays the same at the switch | principles.md P9; D6 |
| Server-ready | All 10 server-switch rules in EXECUTION-PLAN 4.3 apply: shared Zod contracts, identical URL keys, pure logic in `core/`, stable ids, versions and provenance carried through | D6, D8 |
| UX | Read P1-P9 and T1-T5 in [principles.md](design/foundation/principles.md) before any design, build or review, and cite them by number. Overlays are non-modal and motion is smooth | owner 18 Oct |
| Maps | MapLibre on the globe. Google Maps JS on place pages and the trip route map (Q51). Never two map families on one page. Directions use Maps URLs; legs come from ORS. Coordinates never come from Google | map-stack 18 Oct; Q51 |
| Sources | AllTrails, Google, Tripadvisor and Komoot are links only, never data. OSM, Overpass, Wikidata and Commons calls run one at a time, one runner per service under `flock /tmp/travel-<service>.lock`, with the no-email user agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. Never search Commons from parallel agents | CLAUDE.md; 12 Oct 429 |
| Taxonomy | Complete and extensible: a new type is one entry in `data/vocab/types.json`, and a new property is a registry change. One capture contract tells every researcher what to collect | owner 18 Oct |
| Models | Opus plans, researches, reviews design and audits code (`travel-planner`, `travel-researcher`, `travel-design-reviewer`). Sonnet builds and verifies (`travel-builder`, `travel-verifier`). **Never Fable.** Every UI round ends with the design reviewer, then the verifier | owner 18 Oct |
| Process | Every finding goes into BACKLOG first, with an ID, and is marked done with its commit. Every owner request becomes an Open row in [TODO.md](TODO.md) the same day. Parallel lanes own disjoint files. Builders run only their own specs; the coordinator runs the full e2e on a quiet machine | owner 18 Oct |
| Safety | Confirm every deletion with the owner. Kill servers by PID, never by name. Never print or commit secrets. Stage only owned paths with `git -C <abs> add <paths>`, never `-A`. Nothing about travel goes in the Obsidian notes vault | memory notes |
| Release | Nothing goes live without the owner's approval of a named commit (Q43, at R2 exit). Vercel is selected; project setup and deployment wait until this branch is merge-ready (R-61). Never run `./publish.sh` in a mode that deploys | Q43; R-61 |
| No new HTML | The web app is the only product surface. A request to change how a page looks is a `web/` change. A trip or a fact is data written to the schema (`data/trips/<id>/trip.json` through the ops CLI, schedules, `capture/1` records and sidecars). `legacy/**` is frozen except for moving data out, until backlog 7.11 | owner 21 Oct; [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 6 |
| Skills | Skills live only in `.claude/skills/<name>/SKILL.md`, the one folder Claude Code loads: `trip`, `research` and `location`, each a thin wrapper that points into `research/README.md` | owner 21 Oct; cleanup D20 |

## 2. Every owner requirement

Status: **done** (shipped), **in force** (a standing rule), **next** (a task is defined and can start), **later** (a task exists for after R2 or the planner), **open** (waiting on the owner). "Delivered by" uses the EXECUTION-PLAN task IDs.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-1 | The public read-only site comes first, with no login; the planner comes second | product direction 18 Oct | phases A, B, E, D | in force |
| R-2 | Keep what works on the live site: photo cards, filter pills, four views, table tools, honesty markers, the globe's relief, styles and drill-down | keep-from-live-site 18 Oct | built in L1-L5; checked at R1 and R2 | done, re-checked |
| R-3 | No green anywhere, status colours included; Trailhead design | 18 Oct; Q47 | SHL (done); green-pixel check on the trips map at R2 | in force |
| R-4 | Free tiers for under 100 users in year one | 18 Oct | every choice; Vercel/Neon operating-cost review in R-61 | in force |
| R-5 | UI fixes first, with their own review gate | D10, 20 Oct | phase A (A1-A14), gate R1 | next |
| R-6 | Build API-over-JSON now: `/api/v1` handlers over `CatalogueStore` + `JsonStore`, Zod contracts, OpenAPI, the API adapter as default | D8, 20 Oct; headline 21 Oct | B1 (API-0), B2 (API-1), B3 (API-2) | next |
| R-7 | A Postgres store later as a store swap, not now (provider now Neon, R-58; originally Supabase); run the read-only schema diff first as a risk check | D9 | A10 (SRV-D), SRV-0 | next / later |
| R-8 | Deploy the Next.js server build on the owner-selected Vercel host; no static-export assumption | owner, 24 Oct; D7 | B1 removes `output: 'export'`; R-61; phase D | Vercel selected; configure and deploy when merge-ready |
| R-9 | Every item is designed for the server switch | D6 | server-switch column in every task; contract kit (4.6) | in force |
| R-10 | Metadata for every place and activity is the foundation (placement block, a point with its role, the area chain, the nearest town) | D4; 8.3 | B6 (META-0), E1, E2, DATA D1-D6 | next |
| R-11 | Consistency and no hard-coded values | D5 | B4, B5 (CONS-1, CONS-2), E14 (CONS-3) | next |
| R-12 | Phase C as full gates with entry criteria, checklists, roles and owner scripts | D3 | R1 (EXECUTION-PLAN 8), G-B (9), R2 (11) | next |
| R-13 | Research unpaused for all phase E data work | D2; Q58 | DATA D1-D6 (E3-E7b) | next Status 25 Oct: D1 points done on `public/DATA-D1` (`W_PLACE_POINT` 84 to 6); follow-ups and order in R-69. |
| R-14 | Go with all recommendations Q1-Q64 | 19-20 Oct, D1 | recorded in BACKLOG | done |
| R-15 | Home search panel is not clipped; header Search closes on a second tap | 9.1, 3.66a | A1 (FIXF) | next |
| R-16 | Hide Sign in until the planner exists | 11.1, Q64 | A2 (SHL2) | next |
| R-17 | Report a problem on every page goes to a public feedback repo, never to an email | 11.2, Q63, Q70 | A3 (SHL2); the repo must exist first | open (repo); 25 Oct: proposed to be superseded by R-90 (Q133) |
| R-18 | Globe: Fly here works, rivers draw lines, a Natural features switch that defaults on | 9.7, 9.4, 9.8, Q52 | A4, A5, A6, A4b (GLB2a) | next |
| R-19 | Globe city outlines and a better home globe (background, water, labels) | 9.3, 9.2 | E12 (GLB2b); mock approved at R1 | later in E |
| R-20 | Where filter: country, then state or province, then city | 8.1, Q54, Q61, Q62 | A7 (N0) in phase A; E8 city level and Trips by province | next |
| R-21 | Nearby places; "near Whitby" includes Oshawa and Ajax; radius 10, 25, 50 or 100 km (cap 100); drive-time bands | 8.2, 8.4, Q50, Q55-Q57 | E2 towns, E9 Around here, E10 near mode, E13 ORS matrices | later in E |
| R-22 | Every record maps to country, state and city and carries a GPS point | 8.3 | B6, E1, E3 | next |
| R-23 | Trail pages show length, gain and the other facts, with "Not checked yet" for gaps | 10.1 | A8 (PLC2a); E5 fills them | next |
| R-24 | Proper trail data | 10.2 | E5 (DATA D3) | later in E |
| R-25 | An AllTrails link on every trail: direct where supplied, otherwise a labelled search link | 10.3, Q53 | A9 (PLC2a) | next |
| R-26 | One or two credited images per trail | 10.4 | E7 (DATA D5) | later in E |
| R-27 | Map points for every trail | 10.5 | E3 (DATA D1) | later in E |
| R-28 | Google Maps on the trip route map (re-raised by the owner at R1, 23 Oct) | 9.5, Q51 | E11: TRP2a first in E, shown at M1; routed legs in TRP2b | map done (M1); routed legs merged (6d319c4), fix round TRP2b2 in progress |
| R-29 | Export the whole trip (print/PDF, calendar, CSV, KML, GPX) | 9.6, Q46 | E11: TRP2b, after API-3 | merged (6d319c4); fix round TRP2b2 in progress; MUST-6 booking windows before go-live |
| R-30 | Trip page polish and every visible defect from the coverage sweep (84 UI lines, 55 of them in phase A) | REVIEW4; COVERAGE | A2b, A4b, A7b, A8b, A13 (TRP1) | next |
| R-31 | Flaky tests fixed by waiting for settled values; the `/specimen/` axe failure | TODO 18 Oct; 3.63 | A14 (TST); `/specimen` removed in D item 5 | next |
| R-32 | Trip page as a chronological, categorised timeline with a party profile | TODO 18 Oct | L3c b02f4a4 | done (L3d is later, 3.1c) |
| R-33 | Full-screen globe as a major feature | TODO 18 Oct | L2, L2b, GLB, FIXD | done; R-18 and R-19 continue it |
| R-34 | "Who it suits" suitability for every place, and relevance ("worth the journey") | TODO 18 Oct | S0, S0b, R1-R6, S1, RV0, RVC | done |
| R-35 | A capture contract with a complete, extensible taxonomy | 18 Oct | CC eaa5684; META-0 extends it | done; extends in B |
| R-36 | Smart search with no model bill | 3.15, Q34-Q40 | SQ1 phase 1 done; phases 2 and 3 are L9 | done / open (L9) |
| R-37 | Short trips: day trips, overnights and weekends | TODO 18 Oct | 3.1c, 3.13, 3.14 in phase F; the hub matrix is in E13 | later |
| R-38 | Smart trip builder: choose a destination, see what is nearby, pick by distance | 8.5, 8.6, Q59, Q60 | phase F (planner); flags and `/plan/` reserved | later |
| R-39 | Owner reviews only at the gates: R1 and R2, not before | 19 Oct; D10 | R1, R2 | in force |
| R-40 | Approval of a named commit before anything goes live | Q43 | R2 exit | in force |
| R-41 | Legacy pages retired behind redirects: 302 for a week, then 301 | Q25, Q45 | D item 3 (redirect map as data) | later in D |
| R-42 | Google key restricted, daily quota, Map ID with POIs off, the unused Map ID variable removed | 7.2, 7.3, Q48 | D item 7 | later in D |
| R-43 | A custom domain bought through Cloudflare Registrar, name to come | Q44, Q71 | deferred until after Vercel project setup (R-61) | open (domain name) |
| R-44 | Remove merged worktrees and stale tunnels as one listed batch | Q49 | readiness cleanup (MASTER-PLAN 7, step 39), with confirmation; remote branches done 21 Oct | partly done |
| R-45 | Close PR #7 and delete the old remote branches | L7 | done 21 Oct: PR #7 closed; branches archived as `archive/*` tags | done |
| R-46 | One combined plan with all the latest requirements | owner 21 Oct | this page | done |
| R-47 | A person confirms held trail data (Braies P1, Monte Piana, Fanes, Seceda, Nuvolau, Lago d'Antorno) | TODO 18 Oct; L4 | optional at R2 | open (owner) |
| R-48 | Enforce completeness per kind (validator, badge, skill, MCP) | TODO 18 Oct; L3 | META-0 validator and tiers; badge and skill later | next / later |
| R-49 | Fill the empty place sections (parking, fees, swimming, best time of day) with provenance | L8 | DATA D1-D6 for E's needs; the rest in phase F | later |
| R-50 | Planner items: school year calendar (F03), person-level items, bookings wallet on stored bookings, Explore map labels, redesign applied to the prototype | TODO 18 Oct; L1, L2, L6 | [SERVER-SIDE-LAUNDRY-LIST.md](build/SERVER-SIDE-LAUNDRY-LIST.md) | later (planner) |
| R-51 | Server-side decisions: where the backend lives, sign-in method, who may sign in, guest planning, household privacy under RLS | Q65-Q69 | laundry list section 1; R-58/R-61 | partly decided: Q65 Neon for Postgres, Managed Better Auth and Realtime; Vercel selected for frontend hosting; object storage/functions unselected. Q66 email/password implemented, other methods not; Q67-Q69 open |
| R-52 | Map stack set up by the owner: Google Cloud project, a restricted key with a cap, an ORS key, an R2 bucket | TODO 18 Oct | keys exist on the first machine; restrictions in D item 7; R2 bucket is L5 (planner) | partly done |
| R-53 | Repo cleanup: no duplicate folders or files; v1 docs archived; `prototype/` retired; one globe writer; a folder-contract guard in check-all | owner 21 Oct; cleanup D1-D10 | CLN-1 to CLN-7 ([CLEANUP-PLAN.md](CLEANUP-PLAN.md)) | CLN-1 done (329bb99); CLN-2 to CLN-7 next |
| R-54 | One research home: the root `research/` holds the method, the per-type checklists, output formats and templates, the inbox, what each trip is planning, run notes, audits and reports. Skills and the researcher agent stay in `.claude/` as thin wrappers pointing to `research/README.md` | owner 21 Oct (cleanup D7 replaced by D11) | CLN-1 (moves, map, thin skills), CLN-R (generator and tests write `research/`), CLN-5 (guard rules) | done (CLN-1 329bb99, CLN-R a1ceff8); guard rules in CLN-5 |
| R-55 | SRV-D schema decisions: two tiers (lossless source docs keyed by `ref`, plus a serving tier written by the same core code as `JsonStore`); `entity.id` is the `ref` verbatim; `locations.json` collections and Instagram saves stay private; town ids are `<cc>-<admin1>-<slug>` (`ca-on-whitby`) | owner 21 Oct (SRV-D 13.1-13.4) | API-1 contract changes (SRV-D 13.1), META-0 (town id in nearby spec 3.1), SRV-0 migrations M1-M15 | decided; feeds B and S |
| R-56 | **No new HTML; the web app is the only product; only data is generated, from the schema.** A trip is `data/trips/<id>/trip.json` written through the ops CLI, plus `data/schedules/<id>.json` and the `capture/1` records with their sidecars. A page change is a `web/` change. `legacy/` is frozen except for moving data out. The web app must render a data-only trip (gaps G1-G6) | owner 21 Oct (direction 2) | CLN-7 (the rule); TD-0 (B); TD-1, TD-2, TD-3 (E); TD-4, TD-6 (after R2, with 7.11) ([SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 5) | in force; CLN-7 next; TD tasks scheduled |
| R-57 | **All skills in one skills folder**, research and planning included: `.claude/skills/` with `trip` (replaces `trip-planner`), `research` (new) and `location`. Cleanup D18 is superseded: the HTML half of `trip-planner` is retired, not moved | owner 21 Oct (direction 1) | CLN-7a (Sonnet), CLN-7b (Haiku) | next (now, before R1 entry) |

| R-58 | **Neon backend instead of Supabase:** provision Postgres, Managed Better Auth and Realtime in the existing owner-specified project; migrate all application tables; wire real authenticated persistence and live updates; prove build and service flows | owner, this session | [NEON-SETUP.md](build/public-site/NEON-SETUP.md); [NEON-VERIFICATION.md](build/public-site/NEON-VERIFICATION.md); BACKLOG 15.47 | private account integration independently verified on the uncommitted session branch (final public check-all passed; real Neon E2E 14/14 in the prior independent run; configured sign-in-on place-size budget 1.2497437331, 19 B headroom); not committed, so not done. Child-branch DB integration blocked: `TEST_DATABASE_URL` unavailable, 7 cases skipped, not independently passed. Public catalogue loader, `PostgresStore`, parity and cutover not implemented (`JsonStore` serves) |

| R-59 | **Visible trip navigation and base-aware routes:** trail-provider and per-stop map/directions links in the timeline; complete combined-day navigation; base changes recalculate driving and dependent schedule with explicit conflicts | owner, 24 Oct | [TRIP-NAVIGATION-PLAN.md](build/public-site/TRIP-NAVIGATION-PLAN.md); BACKLOG 15.48 | planned only; after Neon and the existing closure queue |

| R-60 | **Reconcile all live Supabase-specific specifications with Neon Postgres, Managed Better Auth and related service/function architecture.** Update the existing backend/planner plans rather than introducing a competing plan; preserve product requirements, privacy and acceptance; distinguish implemented capabilities from proposals | owner, 24 Oct | TODO; BACKLOG 15.49; [NEON-SETUP.md](build/public-site/NEON-SETUP.md) R-60 | **Done 25 Oct:** reconciliation and consistency audit complete; committed and merged into `main` with the Neon foundation (see HANDOVER) |
| R-61 | **Create and configure a new Vercel project, deploy the merge-ready app and verify the Neon-backed release before continuing the queue** | owner, 24 Oct | TODO; BACKLOG 15.50; EXECUTION-PLAN 13.2 | deferred until merge-ready; project not created, secrets not transferred, deployment not performed |
| R-68 | **Every location has the basics, trip or not; photos from every licensed source; easy location adding (owner, 25 Oct).** Basics tier for the 74 stored places (66 tied to no trip): city, state, country, point, parking, trail numbers, booking, links, a licensed image each; Openverse, Flickr CC, Geograph and agency media added to Commons; `quick-add`, `basics --report`; same shape loads into Neon. AllTrails stays link-only (hand-typed basics are Q-LOC-1); unlicensed images are not taken | owner, this session | [DATA-LOC.md](build/public-site/briefs/DATA-LOC.md); BACKLOG 3.68 | spec written; L1 to L5 not started |
| R-69 | **DATA batch order after D1 (25 Oct).** D1b points follow-up first (Opus: retry the 6 without a point, replace the 41 approximate points with sourced trailheads and meeting points, the 3 missing destination parts, the Fanes track, D1's 5 operator questions, a final ruling on 3 source conflicts, a 20-point check needing 18 right within 100 m); it works in its own worktree, never in `v2-DATA-D1`. D6a seasons, D3a trail facts, D4a activities and D7-R Rockies windows may run at the same time; photos (D5a, D5b) wait for D1b. D1 ran on Sonnet, so an Opus read of its rulings is part of D1b | owner, 25 Oct | DATA-AGENT-PROMPTS.md (D1b, order); DATA.md | planned; D1b prompt on `main` (dee1e4c) |
| R-70 | **Rockies bases and stay-sets (owner, 25 Oct).** Three bases (Jasper, Lake Louise, Banff or Canmore) cut check-ins from 5 to 3 for about 15 min a day more driving; Golden is off the Icefields Parkway and the wrong third base; end at Banff, Canmore or Lake Louise for an easy Calgary return; Canmore is a cheaper, quieter Banff swap (price blog-only, not stored). Trip page: the Stays tab becomes Where to base, the plan's bases strip plus alternative stay-set cards, area-level only, no hotels or booking state. New data `data/stays/<trip>.json` (`trip-stays/1`) | owner, this session | [trip-bases-and-stays.md](features/trip-bases-and-stays.md); [base-strategies.md](../../research/trips/canadian-rockies-sept-2029/base-strategies.md); BACKLOG 3.70 | research and spec written; ST-1 to ST-4 not started; Q-BASE-1 to 3 open |

Owner request of 25 Oct 2026 (Rockies as the example), one effort in three phases; spec [features/trip-overview-and-customisation.md](features/trip-overview-and-customisation.md), brief [briefs/OVR.md](build/public-site/briefs/OVR.md). The public rows (R-62 to R-64) ship first and need no login (R-1 holds). The code queues after the closure queue and R-59 (owner, 23-24 Oct: one item at a time); the research batches (R-67) are data only and can start on the owner's go.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-62 | **Best time to go per trip:** 2 to 4 researched windows, each a start week of a month (never a date), with plus and minus points, crowd level, events as rules, items that may be closed; sourced and dated; picking a window re-runs sun times and marks closures. Rockies first as the pattern, then every trip | owner, 25 Oct | DATA D7; OVR-Ca, OVR-Cb, OVR-1 (BACKLOG 15.51) | planned; D7-R can start on the owner's go |
| R-63 | **One overview of everything in a trip:** Trails, Sights, Activities, Bookings (and Stays, Food, Getting around) with counts; scopes in the plan, also researched, nearby within 30 km of a base; filters by kind, effort, duration, suits, booking, day, base, season fit; replaces the By category view; light rows through `DataClient` and `/api/v1`, lazy chunk, start JS net zero | owner, 25 Oct | OVR-N, OVR-Ca, OVR-Cb, OVR-0, OVR-2 (15.52) | planned; after R-59 |
| R-64 | **A credited thumbnail on every trail card** (then every item card), Commons first, NPS public domain for US parks, honest "No licensed photo yet"; Flickr not now (a key appears to need paid Pro; Q93) | owner, 25 Oct | DATA D5b; OVR-3 (15.53) | planned; D5b after D1 |
| R-65 | **Customisation, signed in:** a private copy of a public trip (`planner_draft` delta, migration 0011), add and remove items, nearby suggestions, re-flow with the existing warnings, undo, autosave; nothing reaches public output | owner, 25 Oct | CUS-C, CUS-1, CUS-2 (15.54) | planned; after the phase 1 owner preview, the R-61 HTTPS preview and the `planner_draft_signal` ruling |
| R-66 | **Update photos from the admin console:** pin, pick the thumbnail, reorder, hide, "no suitable photo"; an override research never replaces; audit trail | owner, 25 Oct | PHO-0 now (local pin command); PHO-1 console (15.55) | PHO-0 planned; PHO-1 after SRV-0 cutover and F17 roles (Q97) |
| R-67 | **Capture the missing data for these views:** windows for 14 trips, per-item access season, booking state, durations and effort, thumbnails for all 118 trails | owner, 25 Oct | DATA D7, D8, D5b (15.56) | planned; measured gaps in the spec section 8 |

Owner request of 25 Oct 2026 (visitor favourites, suggestions and trip requests: "less friction, the user gets most of it, and at the same time we avoid spam"); spec [features/visitor-suggestions-and-favourites.md](features/visitor-suggestions-and-favourites.md). Step 1 needs no backend; steps 2 to 4 need the R-61 HTTPS preview and Neon trusted origins. Numbers R-70 up so they cannot collide with R-62 to R-67.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-70 | **Favourites on this device, no account:** heart on place and trip pages, badge on cards, `/favourites/` with local filters, one calm first-save note, session-only fallback when storage is blocked; +0 bytes of place HTML, at most 0.15 KB trip start JS; new `resolveRefs` read method for renamed, merged and withdrawn items | owner, 25 Oct | FAV-C, FAV-1, FAV-R, FAV-V (BACKLOG 15.70) | planned; after OVR-0 (Q106) |
| R-71 | **Favourites sync to the account:** private `account_favourite` table under owner-predicate RLS, merge once per device and account (union, account wins, cap 500), sync on focus without Realtime, sign-out clears the cache, export and Remove all | owner, 25 Oct | FAV-D, FAV-2, FAV-2E (15.71) | planned; after the R-61 HTTPS preview and Neon trusted origins |
| R-72 | **Suggest a place, anonymous or signed in:** name, where, kind, one link, a note; public duplicates answered with a link; private duplicates never revealed (PRIV1); never public until researched and added through the `location` skill | owner, 25 Oct | INT-C, INT-1, INT-2, INT-3 (15.72) | planned; after R-71's environment; Q101, Q102 |
| R-73 | **Ask us to plan a trip, signed in:** destination, length, months, party chips, note; 2 open per account; status on `/account/`; published for everyone via the `trip` skill, without the requester's name | owner, 25 Oct | INT-4 (15.73) | planned; Q103 (ties to Q67) |
| R-74 | **Anti-spam and intake security:** strict same-origin, form-age token, honeypot, Turnstile, Postgres quotas (IP, network, account, global), blocks, disposable domains, text and URL rules, PII redaction, no server fetch of submitted links, retention | owner, 25 Oct | INT-C, INT-1, INT-S (15.74) | planned with R-72 |
| R-75 | **Moderation and hand-off:** owner CLI `core/bin/intake.ts` now (list, decide, brief to `research/inbox/`, added, block, stats, purge); console tab in F16 later; stored reports on the same pipeline when `reportForm` turns on | owner, 25 Oct | INT-3 now; INT-5, REP-1 later (15.75) | CLI planned with R-72; console after F17 roles and SRV-0 |

Owner request of 25 Oct 2026 (stay bases, Rockies as the example: "should we just create 3 bases: Jasper, Golden, and then Banff ... Canmore is a good option if you want to save some money ... decrease the number of check-ins and check-outs"; follow-up: "applicable to all trips ... a good way to tweak and show different stay options ... Do not miss it"); spec [features/stay-bases-and-optimisation.md](features/stay-bases-and-optimisation.md). The public rows (R-76 to R-78) need no login. Code queues after the closure queue, R-59 and the OVR contract (STY-Ca after OVR-Ca, STY-1 after OVR-2); the research (R-80) is data only and can start on the owner's go. Numbers R-76 up so they cannot collide with R-62 to R-75.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-76 | **Where to stay on the trip page, public:** the plan's stays, check-ins and moves at rest; 0 to 3 researched ways to stay and per-base swaps compared in the overview's Stays tab (phone compact table, map Bases mode); picking one (`st`, `sw`) re-runs the days with chips and the R-59 directions; lazy chunk, trip start JS +0 B, place HTML +0 B | owner, 25 Oct | STY-N, STY-1, STY-Q, STY-R, STY-V (BACKLOG 15.76) | planned; after OVR-2 |
| R-77 | **Stay optimisation messages:** rules M1 to M7 (repeat town, one-night stop, lower cost nearby, fewer check-ins, easier last day, minimum stay, gateway), silence rules S1 to S7, wording rules, at most two at rest, never a banner; no cost claim without comparable sourced bands | owner, 25 Oct | STY-E (`core/src/stays/messages.ts`), STY-1 (15.77) | planned |
| R-78 | **Base-plan data and town base facts:** `trip-base-plans/1` in `data/base-plans/<trip>.json` (validator, `review` gate), a `base` property group on settlement records, one evaluator for counts, drive per day and cost ranges, `tripBasePlans` and `tripBasePlanDays` through `DataClient` and `/api/v1`, routed base legs; no property names, budget or booking state in public output | owner, 25 Oct | STY-P, STY-Ca, STY-E, STY-L, STY-Cb (15.78) | planned; STY-P can run before OVR (Q115) |
| R-79 | **Tweak a base plan, signed in:** keep a way to stay, move a night, merge two bases, undo, in the customised copy (`trip-custom/1` `stays` operations), through the R-59 base-change recomputation | owner, 25 Oct | STY-2C, STY-2, STY-2V (15.79) | planned; after CUS-1 and R-59 part 3 |
| R-80 | **Research the stay bases:** D9-R Rockies (Jasper, Golden, Banff, Lake Louise village, Canmore, Kananaskis Village, Calgary; four ways to stay, three swaps, the Jasper-first day map, the open-jaw note), then Dolomites, Utah, Chamonix, Patagonia, and the silence checks for Iceland, Algonquin, Vermont | owner, 25 Oct | DATA D9-R, D9, D9-H (15.80) | planned; D9-R after the Banff agent hands back (Q115) |

Owner request of 25 Oct 2026 ("add one plan for adding sign-up with Google and Apple too, which should work with Better Auth"); spec [features/google-and-apple-sign-in.md](features/google-and-apple-sign-in.md). Neon Managed Better Auth offers Google, GitHub and Vercel only (CLI 8.11.1), so Google is planned and Apple is deferred (Q117). The spike GSI-0 needs no deploy; the build needs the R-61 HTTPS preview and queues before FAV-2 (Q124). Numbers R-81 up so they cannot collide with R-76 to R-80.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-81 | **Continue with Google on sign-in and sign-up:** Google's button rules inside the lazy auth chunk (public start JS +0 B), `callbackURL` always `/account/` with a sanitised `next`, error banners for cancel, missing email, existing unverified account, link conflicts, closed sign-up and service failure; `signInGoogle` flag; email and password unchanged | owner, 25 Oct | GSI-0, GSI-T, GSI-1, GSI-R, GSI-VF (BACKLOG 15.81) | planned; GSI-0 first (no deploy needed); build after the R-61 preview |
| R-82 | **Account linking policy and Ways to sign in:** same verified email links to one account; an unverified email/password account is never linked implicitly (CVE-2026-53516 gate, test L1); Add Google and Remove on `/account/` while one method remains; drafts and favourites keyed by user id, so nothing moves | owner, 25 Oct | GSI-0, GSI-2, GSI-V2 if Q121 (15.82) | planned; L1 is a hard gate |
| R-83 | **OAuth environments and owner setup:** shared Neon Google credentials removed from production (O-0), Google Cloud project with `travel-dev` and `travel-prod` clients registered per Neon branch, exact trusted domains, a stable preview alias, Preview on the child branch, `SITE_ORIGIN` per environment; the client secret only in Neon | owner, 25 Oct | owner O-0 to O-7 (15.83) | O-0 recommended now (Q123); the rest after GSI-0 |
| R-84 | **Privacy and security for Google sign-in:** scopes `openid email profile` only, profile photo never read, no `travel_app` grant on `neon_auth.*`, log deny-list, `/privacy/` page, export and delete lines in F17; independent security review and real-service checks on the HTTPS preview (also unblocks `neon-e2e.mjs`, HANDOVER item 2) | owner, 25 Oct | GSI-P, GSI-S, GSI-E (15.84) | planned |
| R-85 | **Sign in with Apple:** not built; re-plan (APL-0) only when Neon offers Apple and the owner accepts USD 99 a year | owner, 25 Oct | APL-0 (15.85) | deferred; Q117 |

Owner request of 25 Oct 2026 (feedback forms: "report something about a selected trail, trip or location, or ask to add a new location, trail or trip ... an email id at least to submit it; if they are already logged in, fill name and email ... avoid actual spam"); spec [features/feedback-and-reports.md](features/feedback-and-reports.md). It merges with and amends R-72 to R-75 (one intake model, one sheet, one route family; email now required, which changes V5, 5.1 and Q104 of the visitor spec). Signed-in reporting needs no domain and can ship first; guest submissions need a registered domain and a mail sender (Q132). Numbers R-90 up so they cannot collide with R-81 to R-85.

| # | Requirement | Source | Delivered by | Status |
|---|---|---|---|---|
| R-90 | **Report or suggest sheet and entry points:** one form shell (modal side sheet on desktop, bottom sheet on phone), steps what, details, email, sent, pre-selected from context; entries in the footer (context-aware), place sections, the lightbox, trip day menus with a stop picker, stay base cards, zero results, 404, About, `/feedback/`; prefill of target ref, section, day, stop and path only (never the query string); place HTML +0 B, trip start JS at most 0.1 KB, sheet chunk at most 18 KB | owner, 25 Oct | FBK-N, FBK-2, FBK-R, FBK-V (BACKLOG 15.90) | planned; after FBK-1 and OVR-0 |
| R-91 | **One intake model:** types report, place (trails included), trip, feedback; target kinds and typed reasons per kind (wrong, closed or changed, price or hours, unsafe, missing, broken link, photo, photo credit, privacy and copyright takedowns, other); `visitor_submission` extended, `intake_contact`, `intake_token`, `intake_event`, `intake_suppression`, `intake_setting`; `/api/v1/submissions*`; `CatalogueStore.report()` and `/api/v1/report` retired | owner, 25 Oct | FBK-C, FBK-1 (15.91) | planned; supersedes INT-C, INT-1, REP-1 |
| R-92 | **Email required, name optional, verified by link:** prefilled from the Neon session when signed in; guests and unverified accounts confirm by a POST from `/confirm/` (token in the fragment; no GET side effects); only confirmed items reach the queue; remembered browser for 180 days; disposable domains refused; minimal retention, never marketing, delete link in every mail; Resend free from `mail.<domain>` with SPF, DKIM, DMARC | owner, 25 Oct | FBK-M, FBK-1, FBK-O (15.92) | planned; guest mail needs the domain (Q71, Q132) |
| R-93 | **Anti-spam extended for email:** kill switch without redeploy, confirm-mail caps against mail bombing, per-email, per-target, open-at-once and takedown buckets, flood and copy-paste detection, reputation tiers, shortener and blocked-pattern rules, owner alerts, degrade to signed-in only or paused | owner, 25 Oct | FBK-C, FBK-1, FBK-S (15.93) | planned with R-91 |
| R-94 | **Triage and closing the loop:** states add unconfirmed, fixed, no_change; CLI list by takedown, cluster and age, decide per cluster, brief, notify, ask, forget, mode; fixes through ops, capture, the `research`, `location` and `trip` skills, PHO-0 and DATA batches; honest response targets; outcome mail; PRIV1 kept | owner, 25 Oct | FBK-3 now; INT-5 console later (15.94) | planned |
| R-95 | **Owner setup for intake:** register the domain, Resend account and DNS, a Turnstile widget with the preview alias and production host, encrypted Vercel variables | owner, 25 Oct | FBK-O (15.95) | waits for the owner (Q132) |
| R-96 | **Research hand-off safety:** visitor text fenced as untrusted data in every brief; links unchecked and opened only from official domains or with the owner's go; no personal data in briefs; the claim is a hypothesis; one pointer line in research README 9 and the three skills | owner, 25 Oct | FBK-3 (15.96) | planned |

## Execution rule reaffirmed by the owner, 24 Oct 2026

Finish one queue item before starting the next. Before implementation, expand the
item's existing specification into a detailed execution plan: current evidence,
scope, dependencies, ordered changes, acceptance criteria and tests. Keep this
document as the single plan index; do not create competing roadmaps.

Every code change requires coverage of its changed behavior and relevant failure
paths. Each item's acceptance matrix must name backend/unit/integration checks,
UI/component checks and end-to-end user flows, identifying genuinely unaffected
layers explicitly rather than claiming coverage that was not run. Include
authorization, privacy and cross-user isolation where data or identity changes.
Run the affected regression checks, typecheck/build and existing applicable CI
checks so breakages are caught promptly. Surface failing checks and blockers
immediately; do not conceal them with skips, weaker assertions or mock-only proof
of an external service. A green build alone is not end-to-end acceptance.

For UI changes, complete design review and independent verification before calling
the item done. Record evidence and residual gaps against the item. If an external
blocker prevents completion, mark it blocked and report it explicitly; do not
silently advance the queue or imply completion.

## 3. Phases, gates and status (23 Oct 2026)

| Step | What | Gate | Status | Detail |
|---|---|---|---|---|
| Stages 1-4 | Foundation, data adapter, maps, home, globe, trips, places, export, timeline, suitability, relevance, capture contract, smart search parser, stage 4 polish, REVIEW4 and its fixes | design review, verifier, quiet e2e (699 passed, 2 fixed) | **done** | STATUS "Merged so far"; BACKLOG stages 0-4 |
| main is the product | v2 fast-forwarded to `main`; old site tagged `legacy-final` (74b97ad); live site unchanged | owner, 20 Oct | **done** | HANDOVER 1 |
| Plan | Execution plan rewritten after D1-D10; COVERAGE (244 lines, 0 unmapped); this page | none | **done** | EXECUTION-PLAN 1, 21 |
| Branch cleanup | Remote branches deleted and archived as tags `archive/*`; PR #7 closed | owner, 21 Oct | **done** | HANDOVER 4 |
| **A** | UI fixes: A1-A14 plus SRV-D (A10); about 75 h | **R1** (owner) | **done (merged); R1 entry done; the owner's review R1 is still open** (preview 1 on :3440; the tunnel is not started and needs the owner's go) | EXECUTION-PLAN 3, 8; [R1-HANDOVER.md](build/public-site/R1-HANDOVER.md) |
| Cleanup, CLN-1 to CLN-6 and CLN-R | Repo cleanup and one research home (owner, 21 Oct). CLN-1 now, beside phase A: `docs/v2/research/`, `docs/research/` and the sun audit move into the root `research/` (`method/`, `runs/`, `reports/`, `audits/`); `research/README.md`, `tools.md`, `formats/`, the trip index; thin skills and agents; v1 docs archived; removals D2-D4. It touches no file a running lane owns or has changed (measured in the 7 worktrees). CLN-1a Haiku scan, 1b Sonnet scripted moves, 1c Opus authoring, 1d Sonnet verify. CLN-R after TRP1 merges and before B6 META-0: the capture generator writes `research/types/`, the backlog and tag report move, template tests (Sonnet). CLN-2 at R1 entry; CLN-3, CLN-4, CLN-5 in the phase B gap; CLN-6 with backlog 7.11. **CLN-7 (revision 3): skills consolidation and the no-HTML rule.** It runs now, beside phase A, and merges before R1 entry, because CLN-2 edits `CLAUDE.md` and `README.md`. It touches no file of a phase A lane, API-0, API-1 or META-0. 7a is `travel-planner` on Sonnet, 7b is `travel-verifier` on Haiku. About 30 h in total | cleanup D1-D22 (D18 superseded, D17 applied); G-B audits CLN-5 | **CLN-1 and CLN-R done (329bb99, a1ceff8); next: CLN-7 now, CLN-2 at R1 entry** | [CLEANUP-PLAN.md](CLEANUP-PLAN.md) |
| Trip data (TD, R-56) | The web app renders trips written as data. TD-0: the trip data contract and template (docs, Opus, 3 h), in phase B beside the B lanes. TD-1: `items.ref`, sub-regions and the cover format in the core trip schema (`travel-builder` on Opus, 6 h). TD-2: trip pages from `data/trips/<id>/trip.json` (Sonnet, 11 h with review). TD-3: galleries and covers move to `data/trips/` (Sonnet, 5 h). TD-1 to TD-3 are one serial E lane: after G-B, because META-0 owns `core/src/validate/codes.ts` in B; TD-2 after B2 and E1, and before CONS-3 edits `sources.ts` and `slugs.ts`. TD-4 (import the 14 old trips, 24 h) and TD-6 (the orientation block, 8 h) come after R2, with 7.11 | TD-2 ends with design review and verifier | TD-0 waits on CLN-7; TD-1 on G-B | [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 5, 9 |
| **B** | API-0, API-1 (1a contract on Opus, 1b implementation on Sonnet), API-2, CONS-1, CONS-2, META-0 (Opus); about 88 h, plus about 20.5 h of cleanup (CLN-2 to CLN-5) and TD-0 in the second seat of each slot. Seven slots of at most two lanes, because the weekly usage allowance is nearly spent: slot 0 API-0 (Sonnet; before the 25 Oct reset only if R1 fixes leave room), then META-0 with CONS-1, API-1a with CLN-4, API-1b with CLN-3, API-2 with CLN-5, CONS-2 with TD-0, then G-B. DATA D3, D4 and D6 move to after G-B. Starts on the owner's go; R1 entry is done (Q72) | **G-B** (internal) | **done 23 Oct 2026; G-B PASSED at main 653407f** (CHECK-ALL OK; full e2e 745 passed, 27 skipped, 0 failed on Chromium; pixel diff against preview 1: 0 unexplained; sitemap 380 URLs, 0 slug changes; static fallback smoke 335 passed with 2 named failures, one expects `/api/v1`, one fixed by GBFIX; API p50 2.5 to 4.7 ms on 359 places; in-process 10,000-place clone: list 21 ms, filtered count about 60 ms, first call 2.9 s). Merged: API-0, META-0, CONS-1, API-1a with its fix round, API-1b, API-1c, API-2, CONS-2, GBFIX; cleanup CLN-1, CLN-R, CLN-2, CLN-3 (`prototype/` retired, tag `archive/prototype-2026-10-22`), CLN-4, CLN-5, CLN-7; TD-0; PRIV1; E2E, E2E2; GLB2d. Audits: [audit-GB-output.md](build/public-site/audit-GB-output.md) (pass with fixes; its one must was fixed in GBFIX), [review-API1a-contract.md](build/public-site/review-API1a-contract.md); verifier [verify-GB.md](build/public-site/verify-GB.md). Deferrals are BACKLOG 15.20 to 15.31 | [PHASE-B-START.md](build/public-site/PHASE-B-START.md) (order, models, collisions, preconditions, rollback); EXECUTION-PLAN 4, 9 |
| **E** | **TRP2 first** (the owner's 23 Oct remark: the trip page still has no Google map, row 9.5). Two seats, never more than two lanes, from the 25 Oct usage reset: seat A TRP2-N (Opus note), TRP2a (Google map), **M1 owner preview on :3476**, META-1, TRP2b (routed legs, Export trip), LST2b, LST2c, GLB2b; seat B API-3 (the contract-change queue: Opus 3a, Sonnet 3b), HYG, META-2, DATA D1, PLC2b, CONS-3, DATA D3a/D4a/D5a/D6a (the R2 data bar), MX; then E15. About 160 h (Opus about 40.5 h). DATA D2 and the rest of D3-D6 (about 24 h Opus) and TD-1 to TD-3 move to after R2 (Q90, Q80) | **M1** (owner, 10 min, Tue 27 Oct); **R2** (owner, Q43, about Thu 5 Nov) | **under way (23 Oct): merged TRP2-N, TRP2a (+TRP2a2), META-1, API-3 (3a, 3b, 3c), FIXE, META-2, HYG, TRP2b; M1 accepted ('map is ok'); main 27e55e7, e2e 770 passed at 2d6e4b5. In progress: fix round TRP2b2. Next: LST2b, LST2c, GLB2b, DATA D1, PLC2b** (G-B passed; R1 may stay open, R1 fixes win shared files) | [PHASE-E-START.md](build/public-site/PHASE-E-START.md) (order, models, collisions, preconditions, rollback, calendar); EXECUTION-PLAN 10, 11 |
| **D** | Readiness checklist, hosting-agnostic | none | waiting on R2 | EXECUTION-PLAN 13 |
| **S** | SRV-0: proposed `PostgresStore` on Neon Postgres with the catalogue loader, contract kit green per method, privacy checks, rollback, flags off; off the R2 critical path | contract kit | waiting on E features; not implemented (`JsonStore` serves) | EXECUTION-PLAN 4.8 |
| Hosting | Configure a new Vercel project for the Next.js monorepo, secure runtime environment, deploy and verify against Neon | owner, 24 Oct | after merge-ready | R-61; EXECUTION-PLAN 13.2 |

Calendar (EXECUTION-PLAN 17): about 23 working days to readiness, about 396 h. Day 1 is the day the phase A lanes start. The 20 Oct estimate of "readiness about 20 Nov" assumed 21 Oct as day 1. This machine still needs its env file and a green check-all first (section 4, task 1), so count from the real start day.

## 4. The first 10 tasks (phase A, history) and what is next

What is next (23 Oct 2026): section 4.4. The table below is the phase A start list, all merged.

Every lane works from its brief in [briefs/](build/public-site/briefs/). Tasks 2 to 9 run in parallel on disjoint files. Merge order: TST, FIXF, SHL2, GLB2a, TRP1, LST2a, PLC2a.

| # | Task | Owner (agent) | Model | Files it owns | Acceptance |
|---|---|---|---|---|---|
| 1 | Baseline on this machine: `bash tools/check-all.sh` with no `web/.env.local` present; confirm Playwright WebGL runs on a real GPU on macOS and not on SwiftShader; record the result in STATUS | coordinator, `travel-verifier` | Sonnet | none (STATUS line only) | `CHECK-ALL OK`; WebGL renderer string recorded; no SwiftShader |
| 2 | A14 TST: settled-value waits in the six racy specs | `travel-builder` | Sonnet | `who-it-suits.spec.ts`, `home.spec.ts`, `url-state.spec.ts`, `smart-search.spec.ts`, `trip-day-spy*.spec.ts`, `places-parity.spec.ts` | each passes 3 of 3 under a four-lane load; no assertion loosened |
| 3 | A1 FIXF: search panel clamped to the viewport; header Search toggles | `travel-builder` | Sonnet | `web/components/search/GlobalSearch.tsx`, `web/styles/search.css`, `web/components/home/CoverSearch.tsx`, new `search-panel.spec.ts` | panel rect inside the viewport at 390, 1000, 1100, 1440 and 1920 from both buttons; a second tap closes it |
| 4 | A2, A3, A2b SHL2: Sign in behind the `signIn` flag; Report a problem link (merged with the link off until the repo exists); gallery tile names on WebKit | `travel-builder` | Sonnet | `web/components/shell/**`, `web/app/sign-in/page.tsx`, `web/lib/capabilities.ts`, `SiteFooter.tsx`, `web/lib/config/product.ts`, `reportProblem()` in `data.ts`, `web/components/ui/Gallery.tsx` | no Sign in at 1440 and 390; the link carries `?page=<path>`; privacy test finds no email; axe passes on WebKit |
| 5 | A4, A5, A6, A4b GLB2a: one fit model, Fly here, river lines, the `nf` switch, globe and home polish | `travel-builder`; `travel-design-reviewer` after | Sonnet; Opus review | `web/components/globe/**`, `web/lib/globe/**`, `web/app/globe*/**`, `tools/globe_data.py`, `web/public/globe/**`, `CoverGlobe.tsx` (phase A only) | camera ends inside the box for a river, plain, delta, lake and range; Ganges, Danube and Nile draw lines; `nf=0` survives the link |
| 6 | A13 TRP1: trip page polish | `travel-builder`; design review after | Sonnet; Opus review | `web/app/trips/[slug]/**`, `web/components/trips/**` except the TRP2 exclusions, `timeline.ts`, `prose.ts`, `data/schedules/**`, `web/styles/timeline.css` | each item fixed at 1440, 1024 and 390 in light and dark; Rockies stop count pinned at 206 |
| 7 | A7, A7b LST2a: Where pill (country, province, parks and areas) and list polish | `travel-builder`; design review after | Sonnet; Opus review | `WhereMenu.tsx` (new), `FilterBar.tsx` pill slot, `descriptors/place.tsx`, `web/styles/filters.css`, list specs | nearby spec N0 checks 1-9; each polish item shown fixed or already fixed |
| 8 | A8, A9, A8b PLC2a: trail facts strip, AllTrails on all 122 trails, place page polish | `travel-builder`; design review after | Sonnet; Opus review | `web/components/places/**` except the rows, map, footer and cluster files; `sections.ts`, `contract.ts`; `web/lib/map/links.ts` | Fenland Loop shows every slot; 122 of 122 trails have the link |
| 9 | A10 SRV-D: read-only diff of `schema.sql` against the capture contract | `travel-planner` | Opus | `research/reports/schema-diff-2026-10.md` (new) | every layer, property group, sidecar and locations table is mapped or listed as a gap with a proposal |
| 10 | A11 and R1 entry: merge in order, quiet full e2e, screenshot sweep at 1440, 390 and 844 x 390 in light and dark, output audit, preview 1, the owner hand-over | coordinator, `travel-verifier`, Opus auditor | Sonnet; Opus | `docs/v2/build/public-site/verify-R1.md` | EXECUTION-PLAN 8.1 criteria 1-9 met |

Each builder verifies with `tsc`, the unit tests for its area, and Playwright screenshots at 1440 and 390 in light and dark, read in tiles. Each one commits only its owned paths with the Co-Authored-By trailer.

### 4.1 How every lane runs

| Step | Rule |
|---|---|
| Start | Read this page, the lane's brief and the principles it cites. Create a worktree from `main`: `git -C <repo> worktree add <repo parent>/travel-wt/v2-<lane> -b public/<lane> main`. Use the dev port the brief gives |
| Check first | For "check first" items, take a screenshot before changing anything. An item that is already fixed closes with that screenshot |
| Build | Touch only owned files. If a change is needed in another lane's file, write the request in the hand-back |
| Verify | `pnpm --dir web typecheck`, lint, the lane's unit tests and its own e2e specs, never the full suite. Screenshots at 1440 x 900 and 390 x 844, light and dark, set through the site's theme control; read tall pages in tiles. WebGL checks run on a real GPU |
| Review | UI lanes: `travel-design-reviewer` (Opus), then `travel-verifier` (Sonnet) |
| Commit | `git -C <worktree> add <owned paths>`, never `-A`; messages `web(public/<lane>): ...`; end with the Co-Authored-By trailer; rebase onto `main`; do not push. The coordinator merges with a merge commit and pushes after each verified merge |
| Record | The coordinator marks the BACKLOG row done with the commit, moves the TODO row, and updates the spec page if the build differs from it |

### 4.2 The API at a glance (phase B)

```
component -> DataClient (web/lib/client/data.ts)
               ApiAdapter (default) -> /api/v1/* route handler -> respond() -> CatalogueStore
               StaticAdapter (fallback, prerendered JSON)
CatalogueStore: JsonStore now | StubStore in tests | PostgresStore (proposed) in SRV-0
contracts: Zod in core/src/schema/api/ -> OpenAPI 3.1 at /api/v1/openapi.json
```

Phase A components keep calling today's `data.ts` exports with the same names and signatures. API-1 puts the adapter behind those exports, so phase A work is not redone. The store interface, endpoints, error codes, caps and the contract kit are in EXECUTION-PLAN 4.2 to 4.6. The JSON-to-Postgres switch order is in 14.2.

### 4.3 Phase B start (21 Oct 2026)

Phase A is merged and R1 entry is done, so the first-10 table above is history. Phase B starts from [PHASE-B-START.md](build/public-site/PHASE-B-START.md): the slot order with models, worktrees and ports, the owned-file collisions with CLN-2 to CLN-5 and TD-0 and the rule for each, the hard preconditions, the contract cases K1 to K19, the server-build check-all and e2e harness, rollback per lane, about 108.5 agent-hours, the G-B checks and the go/no-go list. It also decides the slug-stability rule (a pinned slug registry), refs on every row, the canonical `region` value (`alberta`, as shipped), one API provenance schema that emits registry source ids, the sort key and a content revision. The owner decides B-1 to B-4 there.

### 4.4 What is next (23 Oct 2026)

**Owner update, 23 Oct (sequential closure approved):** finish half-done work before
opening the next lane. The current branch's detailed queue and acceptance checks are
in [REMAINING-CLOSURE-PLAN.md](build/public-site/REMAINING-CLOSURE-PLAN.md):
TRP2b2, API/HYG review loose ends, LST2b, then CONS-3. Decisions A29 to A40
are already restored in main (`47bf9ab`), not a remaining task. The TRP2b2
re-review approves a preview only; go-live/server gaps remain explicit. The branch
has not been integrated into main.

Phase B is done and G-B passed at `main` 653407f. In order:

| # | Next | Who | Notes |
|---|---|---|---|
| 1 | Owner review R1 on preview 1 (`127.0.0.1:3440`, commit 92d74d1) | owner | The tunnel is not started and needs the owner's go. Pending owner decisions are in section 5 |
| 2 | Before META-2: BACKLOG 15.21 (Q50 home-town rule for the towns layer) | API-3 (Opus contract, 23 Oct) | **Done 23 Oct** (owner ruling, Q87 reopened, final): towns shown exactly as the public gazetteer; API-3c, A33, merged 91c9cd6. The D-E3 safe-geometry plan is superseded. META-2 remains (BACKLOG 15.35) |
| 3 | Phase E from [PHASE-E-START.md](build/public-site/PHASE-E-START.md) (section 4.5) | per the start sheet | TRP2a first, M1 preview for the owner on Tue 27 Oct; G-B deferrals 15.21, 15.23, 15.27 to 15.29 are in API-3 and HYG |
| 4 | R2: decide the place-size budget (+25% median) or lazy sections | owner | BACKLOG 15.30; planned as D-E8 (lazy sections now), ruled at R2 (Q88) |
| 5 | Go-live checklist additions | owner | Maps key referrer restriction (15.25), rate limit on `/api/v1/*` (15.22) |

### 4.5 Phase E start (23 Oct 2026)

Phase E starts from [PHASE-E-START.md](build/public-site/PHASE-E-START.md). It supersedes EXECUTION-PLAN 10's order (TRP2 becomes TRP2a first and TRP2b after API-3), 11.1's "6.5 met" (R2 needs the minimum viable data set; 6.5 rows 7 to 10 in full move to readiness), 15 and 17 (two seats from Sun 25 Oct), PHASE-B-START D-B6 (the revision is hashed from inputs) and the 21 Oct recommendation for Q80 (TD-1 to TD-3 after R2). It adds lane API-3 (the one author of phase E contract changes: `json` export, `print` as text, parsed counts, unchecked rows, card search, `tripLegs`, the globe card path, the town guard, `nearTown`, a cheap revision), lane HYG, the owner milestone M1 (the Google trip map on `127.0.0.1:3476`, about Tue 27 Oct), collisions E1 to E21, decisions D-E1 to D-E12, contract cases K20 to K28, about 160 agent-hours and owner decisions Q87 to Q92. EXECUTION-PLAN 10, 11, 15 and 17 and nearby spec 5.2 and 5.6 still carry the old text and need a banner pointing here (outside this change).

## 5. Open owner decisions (only the open ones)

| ID | Decision | Recommendation | Trade-off |
|---|---|---|---|
| Q70 follow-up | May the coordinator create the public repo `nitin27may/travel-feedback` now with `gh` (issues only, one issue form with the page path prefilled)? | Yes, before A3 turns its link on | A public repo under your name; reporters need a GitHub account until a server form exists |
| ENV | Supply `web/.env.local` on this machine (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `NEXT_PUBLIC_PLACE_MAP_FAMILY`, `ORS_API_KEY`): copy it from the first machine, or issue new keys | Copy it from the first machine (mode 600, never through chat) and restrict the key to localhost meanwhile | Without it, place and trip maps fall back to MapLibre and the MX matrices cannot run; phase A can start, but preview 1 needs the maps key |
| L9 | Free AI features (embedding search, CLIP photo picks, similar places): go now? | Not now; keep them in phase F and revisit near 1,000 places with summaries | the spike measured no gain at today's size |
| Q66-Q69 | Further sign-in methods (email/password is implemented; magic link, Google, passkeys, MFA, MCP OAuth are not), who may sign in (a working sign-up is not admission approval), guest planning, household authorization under RLS. Q65 is decided for the database, identity and realtime only (Neon, R-58); hosting, storage and functions stay open | Answer when the planner work starts; SRV-0 does not need them | none until then |
| Hosting | Which host (it must run Next.js route handlers); then Q71's domain name | Decide after R2 | Lighthouse numbers stay tunnel numbers until then |
| R1 items | Approve the home globe mock; the Mount Robson time-zone marker; the default list order | Answered at R1 | none |
| O-1 | Confirm the reading of the 21 Oct direction: "all of the HTML planning" moves into the skills as data rules, and the HTML page format is retired, not kept ([SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 10) | Yes | Nobody can hand-build a page from documentation again; the tag keeps the old skill |
| O-2 | TD-1 to TD-3 (trip pages from data) in phase E, or after R2 | In E | R2 about one calendar day later; after R2, a trip planned before then has no page |
| O-3 | The two HTML-only past trips (Quebec, New Hampshire stopover): import overview data at TD-4, or drop them from the new site | Import overview data | About 1 h of TD-4 |
| O-5 (cleanup D17) | Confirm D17 as applied: CLAUDE.md "Trips" already points to `research/trips/README.md` | Yes | none |
| O-6 | Rename `trip-planner` to `trip` | Yes | `/trip-planner` stops working; "plan a trip" still triggers `trip` |
| GB-B-3 (`loc:` ref ruling) | The 74 `loc:<id>` refs reveal which places came from the owner's wishlist. Use opaque `place/<slug>` refs through the pinned slug registry? ([BACKLOG](build/public-site/BACKLOG.md) 15.24) | Yes; a contract change (Opus), best done before the contract is public | Existing consumers of the refs change; the registry must stay pinned |
| GB-C-6 | The home-point module holds two decimal places, so the 2 km circle is off-centre by up to several hundred metres. Keep or offset? (15.26) | Owner choice | Precision of the privacy circle against how well the home point is hidden |
| Q83, Q84 | Slot 0 timing and DATA D3, D4, D6 timing (BACKLOG) | Q83 is moot (phase B ran); Q84 stands: after G-B, so now | none |
| Q88 | Place-size budget at R2: keep +25% with lazy sections (D-E8), or +35% for filled data? | Keep +25%, lazy sections | One request on open and fewer crawlable links, against heavier pages for good |
| Q89 | Before M1: Map ID with POIs off; key referrers include `127.0.0.1:3476` and `:3488` | Yes, now | Without it the M1 map fails or shows POIs |
| Q90 | R2 with the minimum viable data set; 6.5 rows 7 to 10 in full move to readiness | Yes | Fewer photos and facts at R2, all honest; about 24 h of Opus saved |
| Q91 | GLB2b inside E (last), or after R2 if the allowance runs short | Inside E; after R2 only above 70% weekly use | After R2 drops R2 check 5 |
| Q92 | M1 over a tunnel for the iPhone | Mac only for M1; tunnel at R2 | The phone map waits for R2 |
| Q80 (re-asked 23 Oct) | TD-1 to TD-3 in E or after R2 | **After R2** (changed, usage limit) | A data-only trip before R2 has no page; none is queued |
| Q101-Q108 (25 Oct) | Visitor favourites and suggestions: anonymous suggestions (Q101), Turnstile or BotID (Q102), open sign-up for light account features while the planner stays invite-only (Q103, ties to Q67), email to submitters (Q104), retention (Q105), queue position (Q106), public credit (Q107), favourite scope and cap (Q108) | As in [the spec](features/visitor-suggestions-and-favourites.md) section 17: yes; Turnstile; yes; no; as written; after OVR-0 and R-61; no; places and trips, 500 | Listed per question there |
| Q117-Q124 (25 Oct) | Google and Apple sign-in: Apple at all (Q117), stable preview alias or custom domain (Q118), which Google account owns the project and the test account (Q119), open sign-up now (Q120, ties to Q67 and Q103), email OTP verification before Google (Q121), unbranded consent screen at first (Q122), remove Neon's shared Google credentials from production now (Q123), Google before favourites sync (Q124) | As in [the spec](features/google-and-apple-sign-in.md) section 15: not now; alias now; personal account plus a separate test Gmail; yes for light features, planner gated; yes; unbranded until the custom domain; yes, now; before | Listed per question there |
| Q130-Q137 (25 Oct) | Feedback and reports: confirm guest emails by link (Q130), name optional (Q131), register the domain now and use Resend free (Q132), drop the public GitHub feedback repo (Q133, supersedes the Q70 follow-up), response targets (Q134), no photo uploads in v1 (Q135), owner-only triage (Q136), confirmed guests may ask for a trip and senders get an outcome email (Q137, amends the visitor spec's V5 and reverses Q104) | As in [the spec](features/feedback-and-reports.md) section 14: yes; optional; yes; drop; 2 working days for takedowns, 7 days for safety, no promise otherwise; no; owner only; yes to both | Listed per question there |
| Q109-Q116 (25 Oct) | Stay bases: no property names in public output (Q109), named hut and public campground nights (Q110), signed-out tweaks by URL only (Q111), whole-day reorder in a strategy (Q112), operator-sample price bands (Q113), the three-base Rockies plan as alternative or default (Q114), start D9-R and STY-P now (Q115), at-rest placement (Q116) | As in [the spec](features/stay-bases-and-optimisation.md) section 18: yes; yes; yes; yes; accept, labelled Estimate; alternative first; yes; one line, at most two messages | Listed per question there |
| Q93-Q100 (25 Oct) | Trip overview and customisation: Flickr (Q93), window granularity (Q94), plan versus researched counts (Q95), signed-out removal (Q96), admin console before the cutover (Q97), who may customise (Q98), windows for overview trips (Q99), start D7-R now (Q100) | As in [the spec](features/trip-overview-and-customisation.md) section 10: no Flickr; weeks; default In this plan; no; wait for the cutover; invite-only; yes; now | Listed per question there |

Answered since 21 Oct: Q85 (slugs stay first-come and `region=alberta` stays, unless the owner objects), Q86 (the `prototype/` deletion was confirmed and done in CLN-3), D17 and D18 follow-ups (applied in CLN-1c and CLN-7), the private-saves question (PRIV1, decided 22 Oct: the owner's wishlist saves `sourceTypes` and `added` are removed from all public output). Q79 to Q82 (O-1, O-2, O-3, O-6) have no recorded answer in BACKLOG; the rows above stay open.

Decided and no longer open: Q1-Q64, Q70-Q72, D1-D10 (EXECUTION-PLAN), L7 (21 Oct), and these, decided by the owner on 21 Oct:

| Decision | What was decided | Recorded in |
|---|---|---|
| SRV-D 13.1 | Two tiers for SRV-0: a lossless source tier (`dataset_file`, `record_doc` keyed by `ref`, `source_local`, `capture_supersede`) and a serving tier (entity, offer, relation, link, media, area, town, `place_row`, `place_page`) written by the loader running the same core code as `JsonStore` | [schema-diff-2026-10.md](../../research/reports/schema-diff-2026-10.md) 14 (moves to `research/reports/` in CLN-1) |
| SRV-D 13.2 | `entity.id` is the `ref` verbatim; no ULID surrogate for catalogue rows (ULIDs stay for planner rows a client creates). API-1 adds `ref` to every row and detail | same |
| SRV-D 13.3 | `locations.json` collections (5) and Instagram saves (24) are private household data: RLS on, no policy, not loaded (M14) | same |
| SRV-D 13.4 | Town ids are `<cc>-<admin1>-<slug>` (`ca-on-whitby`). META-0 changes nearby spec 3.1 to match | same; [features/nearby-and-regions.md](features/nearby-and-regions.md) 3.1 (META-0) |
| Cleanup D1-D6, D8-D10 | As recommended: retire `prototype/` after a tag (phase B), remove `.claude/plans/`, `research/places/PRIORITIES.md` and the 75 uncited screenshots after a tag, new folder contract, agent fixes, a check-all folder guard, legacy `PLAN.md` files move at 7.11, no history rewrite | [CLEANUP-PLAN.md](CLEANUP-PLAN.md) 6 |
| Cleanup D7 to D11 | Not option B. One research home at the root `research/`; skills and agents stay in `.claude/` as thin wrappers (D15); scripts stay with their packages and are indexed in `research/tools.md` (D14) | [CLEANUP-PLAN.md](CLEANUP-PLAN.md) 2, 6 |
| Cleanup D18, D20-D22 (21 Oct, late) | The owner's direction: one skills folder, no new HTML, only data from the schema. D18 is superseded: the HTML half of `trip-planner` is retired, not moved, and `TRIP-PAGE.md` is never written. D20: skills only in `.claude/skills/` (`trip`, `research`, `location`). D21: `legacy/**` frozen; page changes go to `web/`. D22: a trip is data in the core trip format plus a schedule | [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 1; [CLEANUP-PLAN.md](CLEANUP-PLAN.md) 6 |

## 6. Superseded statements

| Statement | Where it was | Now |
|---|---|---|
| The site is a static export for Cloudflare Pages; "Pages caps files at 25 MiB"; `_redirects`/`_headers` as design constraints | build README 1, 5, 8; STAGE4-plan 5-6; GLB2 check 6; BACKLOG Q38 | A server build with route handlers (B1); hosting is chosen later (D7) |
| One owner review at stage 6, then stage 7 go-live on Pages | STAGE4-plan 5-6; REPORT-2026-10-20 5, 6, 9; STATUS "Running now" | R1 after A, R2 after E, phase D readiness, no deploy scheduled |
| E ships after go-live; N1-N3 "week 1 after go-live" | MASTER-PLAN (old), nearby spec 7, OWNER-ROUND1 3 | E before R2 |
| Integration branch `claude/serene-goldberg-wtn3di`, worktree `travel-wt/v2` | STATUS, build README 4.2 and 5, memory notes, CLAUDE.md | Deleted 21 Oct and archived as the tag `archive/claude-serene-goldberg-wtn3di`; all work branches from `main` |
| Fable reviews the design | build README 4 and 6, memory `travel-v2-ui-review-loop`, product direction | Never Fable; `travel-design-reviewer` runs on Opus |
| LST2a and PLC2a in phase B | LST2 and PLC2 brief titles | Phase A (A7, A7b, A8, A8b, A9); briefs corrected 21 Oct |
| Go-live about 16 Nov, then readiness about 20 Nov | REPORT banner, the first EXECUTION-PLAN | No date until hosting is chosen; readiness is about 23 working days from the phase A start |
| "Use the `trip-planner` skill for any new or revised trip: the research process, the HTML format and design system, link and photo conventions, and the publish step"; "each trip is one folder `legacy/<slug>/` with `index.html` as the deliverable" | CLAUDE.md lines 5 and 7; `.claude/skills/trip-planner/SKILL.md`; README "Build and publish" | A trip is data; the `trip`, `research` and `location` skills; no new HTML (R-56, R-57); CLN-7 rewrites those lines |
| Cleanup D18: the HTML half of `trip-planner` moves to `legacy/_system/TRIP-PAGE.md` | CLEANUP-PLAN 1.2, 2.6, 2.8, CLN-6; BACKLOG Q78; R1-HANDOVER D18 row | Retired, not moved ([SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) 3) |
| R-17: "Report a problem on every page goes to a public feedback repo, never to an email"; create `nitin27may/travel-feedback` (Q70 follow-up) | R-17 above; section 5 Q70 follow-up; EXECUTION-PLAN A3 and 18 | Proposed 25 Oct, pending Q133: Report a problem opens the private Report or suggest sheet ([feedback-and-reports.md](features/feedback-and-reports.md)); no public repo; still no email address published on the site |
| Anonymous place suggestions take no email; trip requests need an account; submitters are not emailed (Q104) | [visitor-suggestions-and-favourites.md](features/visitor-suggestions-and-favourites.md) V5, 5.1, 17 | An email confirmed by link is required for every submission; confirmed guests may ask for a trip; outcome mail when asked ([feedback-and-reports.md](features/feedback-and-reports.md) section 11, Q137) |
| Towns layer served with safe geometry: moved centre, 4.5 km offset, vertex dropping, `approx` flag; or exclude the home town (Q87) | PHASE-E-START D-E3, E3 and API-3 item 6; PLAN Q87 row; BACKLOG Q87 and 15.21; briefs/META.md item 15 | Owner ruling 23 Oct (final): towns shown exactly as the public GeoNames/OSM data; the check accepts a point equal to the gazetteer point for its town id (A33, API-3c, 91c9cd6). META-2 writes the towns file only from the GeoNames download, verbatim, with a checksum manifest and a privacy scan |

## 7. Where detail lives

| Document | Still the authority for | State |
|---|---|---|
| [build/public-site/EXECUTION-PLAN.md](build/public-site/EXECUTION-PLAN.md) | Task tables A, B, E; the API shape (4.1-4.8); CONS (5); META tiers and acceptance numbers (6); stage 5 checks (7); gate checklists and owner scripts (8, 9, 11); phase D checklist (13); data order and the switch-over runbook (14); parallelism (15); risks (16); calendar (17) | current |
| [build/public-site/COVERAGE.md](build/public-site/COVERAGE.md) | Every pending item (244 lines) mapped to a task and phase | current; L7 closed 21 Oct |
| [build/public-site/BACKLOG.md](build/public-site/BACKLOG.md) | Row status and commit for every finding; the owner questions Q1-Q72 with decisions | current |
| [build/public-site/briefs/](build/public-site/briefs/) | One self-contained brief per lane: TST, FIXF, SHL2, GLB2, TRP1, LST2, PLC2, SRV, API, CONS, META, DATA, TRP2, MX, GO-LIVE (readiness). SHL, PLC, TRP, GLB, LST and CS7d are stage 4 records | current (worktree paths are from the first machine; see section 8) |
| [build/public-site/STATUS.md](build/public-site/STATUS.md) | The merged-lane record, decisions in force, key specs | partly stale: "Where things are", "Running now" and "Services" are history |
| [build/public-site/MASTER-PLAN.md](build/public-site/MASTER-PLAN.md) | The item list by phase with backlog rows; owner decisions table (section 8) | superseded as the entry point by this page |
| [build/public-site/STAGE4-plan.md](build/public-site/STAGE4-plan.md) | Record of stage 4 lanes, REVIEW4, conflicts C1-C11; the stage 5 pass rules (section 4) still define each check | sections 4-6 superseded |
| [build/public-site/OWNER-ROUND1-plan.md](build/public-site/OWNER-ROUND1-plan.md) | The causes and acceptance checks of the owner's 17 reported items | sections 3 and 4 superseded |
| [build/public-site/REPORT-2026-10-20.md](build/public-site/REPORT-2026-10-20.md) | The design and stage state on 20 Oct, morning | sections 5, 6, 7 and 9 superseded |
| [build/public-site/README.md](build/public-site/README.md) | Wave 1 and 2 build decisions: why `web/`, data adapter, kind to category, photos, maps by surface; gotchas (GPU, WebKit deps, basemaps in e2e) | sections 1 (static export), 4.2, 5, 6 and 7 superseded |
| [features/nearby-and-regions.md](features/nearby-and-regions.md) | Where filter, Nearby, near mode, towns layer, the data rule, the smart trip builder; wireframes and empty states | current except 5.7 mechanics (the fallback adapter) and 7 timing |
| [build/SERVER-SIDE-LAUNDRY-LIST.md](build/SERVER-SIDE-LAUNDRY-LIST.md) | Everything that needs login or a backend; Q65-Q69 | current |
| [design/foundation/principles.md](design/foundation/principles.md) | P1-P9, T1-T5 | current |
| [design/product-direction-2026-10-18.md](design/product-direction-2026-10-18.md), [design/keep-from-live-site.md](design/keep-from-live-site.md), [design/trip-scope-scenarios.md](design/trip-scope-scenarios.md) | Product order, what to keep, scenario rules | current ("Fable-reviewed" there means the 18 Oct foundation; reviews are Opus now) |
| [research/capture-contract.md](../../research/method/capture-contract.md) | The one data contract | current; moves to `/research/method/capture-contract.md` in CLN-1 (the rewriter updates this link) |
| [CLEANUP-PLAN.md](CLEANUP-PLAN.md) | The repo layout, the one research home, phases CLN-1 to CLN-7 and CLN-R, the folder contract and its guard rules, cleanup decisions D1-D22 | current (revision 3, 21 Oct, late) |
| [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) | The skills home and set, with their texts; the `trip-planner` disposition; trip-as-data walkthrough; gaps G1-G8 and tasks TD-0 to TD-6 with briefs; the no-HTML freeze rule; the redundancy inventory and removal order; the proposed CLAUDE.md text; the CLN-7 brief | current (21 Oct, late) |
| [/research/README.md](../../research/README.md) | The map of the research system: jobs, per-type checklists, formats, validators, gaps, merge, the rules that do not bend | current (CLN-1, 329bb99) |
| [TODO.md](TODO.md) | Owner requests, Open and Done | current |
| [/HANDOVER.md](../../HANDOVER.md) and [HANDOVER-DETAIL-2026-10-23.md](HANDOVER-DETAIL-2026-10-23.md) | The entry document: current state, setup, rules with reasons, traps, services, the plan forward, open decisions, usage; the detail file holds the gate and generators, every trap, the lane table and calendar, readiness, SRV-0 parity and the document index | current (23 Oct, evening; status here lags it) |
| [build/handover/memory/](build/handover/memory/) | Owner decisions and working rules, with reasons | history; this page wins where they differ |
| [README.md](README.md) and 01-11 | The planner product and platform draft | working draft; not the public site's plan |

## 8. Risks and gotchas

| Risk or gotcha | Effect | What to do |
|---|---|---|
| This machine is macOS (`/Users/nks/workspace/travel`); the first machine was Linux (`/home/nitin27may/workspace`, Arc GPU) | Brief worktree paths, `ss -ltnp` and the Arc GPU flags do not apply as written | Use `<repo parent>/travel-wt/v2-<lane>`; find a port's PID with `lsof -iTCP:<port> -sTCP:LISTEN`; check the WebGL renderer string before judging motion |
| `web/.env.local` is missing here | No Google maps, no ORS runs, preview 1 incomplete | Owner decision ENV; check-all runs without it anyway |
| The feedback repo does not exist yet | A3 cannot turn its link on | Merge A3 with the link behind config, off, until the repo exists |
| Dropping `output: 'export'` breaks the harness (11 tests read `web/out`; e2e stages `.site/`) | Red check-all for days | B1 is its own lane and merges only with check-all and the quiet e2e green |
| e2e flakes under load | Wasted rounds | TST first; builders run only their own specs; the full suite runs on a quiet machine |
| Commons 429 on one shared IP | DATA D5 stalls | One runner under the lock; never parallel |
| Privacy in API output | Household strings in JSON the HTML never showed | Scrub and allowlist in `respond()`; audit 5.2 covers the API |
| Google key opened for testing | Abuse | Restrict to localhost and the preview host now; readiness item 7 |
| Schema drift between the JSON and `schema.sql` | SRV-0 finds reshaping late | SRV-D on day 1 feeds the API-1 contracts |
| Old docs still say static export, stage 6, Fable or the old branch | Agents follow stale orders | Banners point here; this page and EXECUTION-PLAN win |
| `nks-travel.pages.dev` still serves the old site, and old deployments' paths persist | Confusion when hosting changes | Decide its fate in 13.2 |
| Phase A grew from 42 h to 75 h | R1 about a day later | Parallel lanes; "check first" items close with a screenshot, not a rebuild |

More risks: EXECUTION-PLAN 16.

## 9. Change log

| Date | Change |
|---|---|
| 2026-10-25 (feedback) | Owner request: feedback forms for trails, trips and places, add requests, an email to submit, signed-in prefill, no spam. R-90 to R-96, spec [feedback-and-reports.md](features/feedback-and-reports.md), BACKLOG 15.90 to 15.96, questions Q130 to Q137. Amends R-72 to R-75 (visitor spec banner; INT-C, INT-1, INT-S, INT-2, INT-4 UI and REP-1 folded into FBK tasks); proposes superseding R-17's public repo (section 6, Q133); aligned with the sign-in spec's `/privacy/` (GSI-P) and Q121. EXECUTION-PLAN A3, 5.2 and 14.2 row 4 are refined in the spec, to be applied by the coordinator |
| 2026-10-25 (sign-in) | Owner request: sign-up with Google and Apple on Better Auth. R-81 to R-85, spec [google-and-apple-sign-in.md](features/google-and-apple-sign-in.md), BACKLOG 15.81 to 15.85, questions Q117 to Q124. Supersedes F17's edge case "Google with the same email links to the same user" (now only when the existing email is verified). Found read-only on 25 Oct: Neon's shared Google credentials are enabled on both branches; production email/password has Require Verification off. No other decision changed |
| 2026-10-25 (stays) | Owner request: stay bases and stay optimisation (Rockies example, all trips). R-76 to R-80, spec [stay-bases-and-optimisation.md](features/stay-bases-and-optimisation.md), DATA D9, BACKLOG 15.76 to 15.80, questions Q109 to Q116. No existing decision changed. Flagged for the coordinator (spec section 16): a pointer in the overview spec 3.2 (Stays tab becomes Where to stay; property names still never appear), the R-59 relation (authored strategies are read-only and precomputed), and the TD-1/TD-4 allowlist classification of a future `base_plans` table |
| 2026-10-25 (favourites) | Owner request: visitor favourites, place suggestions and trip requests. R-70 to R-75, spec [visitor-suggestions-and-favourites.md](features/visitor-suggestions-and-favourites.md), BACKLOG 15.70 to 15.75, questions Q101 to Q108. No existing decision changed; Q67 to Q69 stay open (Q103 re-asks Q67 for the light account features); EXECUTION-PLAN 14.2 row 4 (reports table) is refined in the spec, to be applied by the coordinator |
| 2026-10-25 (later) | Owner request (Rockies example): R-62 to R-67, spec [trip-overview-and-customisation.md](features/trip-overview-and-customisation.md), brief OVR, DATA D7, D8, D5b, BACKLOG 15.51 to 15.56, questions Q93 to Q100. No existing decision changed; the media report's Flickr "No for now" (its Q8) stands |
| 2026-10-25 | Neon foundation (R-58 implementation, origin-guard fix) and R-60 docs committed and merged into `main`; HANDOVER rewritten with one current state and a detailed not-done list. Child-branch DB integration and the post-fix real-service E2E remain open; R-61 Vercel not started |
| 2026-10-24 | Owner selected Vercel for frontend hosting and directed project configuration/deployment once the branch is merge-ready; recorded as R-61/BACKLOG 15.50. No project created or deployment made |
| 2026-10-24 | R-60 started after final independent Neon verification and reconciled across the existing architecture, roadmap, planner/UX/MCP, and public-site store specs. Relative Markdown links, scoped Supabase-reference classification and diff checks pass. R-58 remains uncommitted; R-60 changes are complete on the uncommitted session branch and remain unshipped because no commit was requested |
| 2026-10-23 (handover) | Plan synced to main 27e55e7: META-2, HYG and TRP2b merged (section 3 row E, R-28, R-29); fix round TRP2b2 and accent folding (BACKLOG 15.43, 15.44); handover rewritten |
| 2026-10-23 (evening) | Phase E progress and the Q87 ruling: section 3 row E, 4.4 row 2, 4.5, section 5 (Q87 removed, answered), section 6 (safe geometry superseded by A33, API-3c). BACKLOG 15.34 to 15.42 added. Q80 stays open |
| 2026-10-23 (later) | Phase E start sheet: section 3 row E (TRP2 first, two seats, M1, about 160 h), section 4.4 rows 2 to 4, new 4.5, section 5 Q87 to Q92 and Q80 re-asked; [PHASE-E-START.md](build/public-site/PHASE-E-START.md) written; briefs TRP2 (split into TRP2a and TRP2b), META, DATA, LST2, PLC2, GLB2, MX, CONS, SRV revised |
| 2026-10-23 | Phase B done and G-B passed at main 653407f: section 3 (A, B, G-B and E rows), section 4.4 (what is next), section 5 (GB-B-3, GB-C-6, answered decisions). BACKLOG rows 14.2, 14.3, 14.4, 15.1 and the B parts of 13.1, 13.2, 13.4, 13.5 closed; deferrals added as 15.20 to 15.31 |
| 2026-10-21 (late) | The owner's direction "skills in one folder; no new HTML; only data from the schema": rules "No new HTML" and "Skills" in section 1; R-56 and R-57; R-53 and R-54 statuses (CLN-1 and CLN-R merged); the Cleanup row with CLN-7 and a new "Trip data (TD)" row in section 3; D17 and D18 moved out of the open decisions (D17 applied, D18 superseded), with O-1, O-2, O-3, O-5 and O-6 added; two superseded statements; [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) added to section 7 |
| 2026-10-21 (evening) | Owner decisions recorded: SRV-D 13.1-13.4 (R-55) and cleanup D1-D10 with D7 replaced by one research home (R-53, R-54); the Cleanup row in section 3 rescheduled (CLN-1 now, CLN-R after TRP1); cleanup D17 and D18 added as open owner decisions |
| 2026-10-21 | First version: one entry point combining EXECUTION-PLAN, COVERAGE, STATUS, MASTER-PLAN, BACKLOG, STAGE4-plan, OWNER-ROUND1-plan, REPORT-2026-10-20, the build README, the nearby spec, the laundry list and the owner memory; owner headline; R-1 to R-52; banners on the partly superseded files; L7 closed |
