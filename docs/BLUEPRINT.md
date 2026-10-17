# Travel platform: clean-slate blueprint (18 Oct 2026)

Status: PROPOSAL for the owner. Written from scratch, not from the current repo layout. Section 9 says how the current work migrates into it.

The brief, in the owner's words: a product where anyone can plan a trip around their interests, group, ages and kind of trip, step by step; add anything by hand (trails, stops, days, notes, in chronological order) or browse and pick from suggestions; and a detailed MCP so any chat client can research a destination (new or existing), refresh what is known, and create a plan that then appears in the app. It should grow into a product as research data accumulates.

---

## 1. Principles

1. **Knowledge and plans are different things.** A shared *catalog* of what is true about the world (places, trails, activities, stays, offers, conditions) and private or shared *plans* that reference it. Plans never copy facts; they point at them and add choices.
2. **Every fact is a claim with evidence.** "Laguna de los Tres is 21 km" is stored as a claim with a source, a date read, a confidence and an author (person or agent). The value shown is derived from the claims. Research then never overwrites: it adds claims, and conflicts and staleness become visible. This is what makes "research updates the reference" safe and auditable.
3. **One domain API, many front doors.** Every action (search, create trip, add day, propose a trail, start research, accept a claim) is one typed operation. The web UI, the HTTP API, the MCP server and background agents all call the same operations. Nothing writes around them.
4. **Manual first, AI optional.** Everything the AI can do, a person can do in the UI by hand. AI makes it faster, never required.
5. **Suggestions are explainable.** "Suggested because: matches hiking + kid-fit, open in September, 40 min from your base, 6 km within your walking limit."
6. **Works at the trailhead.** A trip can be downloaded and used offline.
7. **Open data in, attribution out.** OpenStreetMap, Wikidata, Wikimedia Commons, park open data; licences recorded per fact and per image.

## 2. The domain model

| Area | Entities | Notes |
|---|---|---|
| Geography | `country`, `region`, `area`, `place_ref` | Stable ids anchored to Wikidata and ISO codes; areas are parks, valleys, towns, resorts. Polygons in PostGIS. |
| Catalog (shared knowledge) | `poi` with a `kind` (viewpoint, waterfall, lake, town, museum, beach, ...), `trail`, `activity` (zipline, rafting, tour), `stay`, `eatery`, `offer` (anything bookable: ticket, permit, tour slot, room type), `route_leg` (A to B by mode with time and distance), `area_guide` | One table per kind of thing that needs its own fields; shared columns for name, geometry, hierarchy, tags, eligibility, season. |
| Evidence | `claim` (entity, attribute, value, source, observed_at, confidence, author, status), `source` (URL, publisher, licence, read date) | The single place where facts live. A view materialises the current best value per attribute. |
| Media | `media` (entity, URL or storage key, thumb, width, height, licence, author, source URL, caption, role hero or gallery, status) | Commons first; user uploads with moderation. |
| Taxonomy | `tag` (with kind: style, activity, feature, audience), `difficulty_scale` (house 1-5 plus the local grade), `trip_style` | Controlled vocabulary with aliases. |
| People | `user`, `traveller_profile` (age band or birth year, height, fitness, mobility, dietary, citizenship; private) | Ages and heights decide eligibility. |
| Plans | `trip` (title, slug, status, visibility, owner, forked_from), `edition` (real dates for one run of the trip), `party` (travellers on this trip), `preferences` (style, pace, walking limit, budget, must-do, avoid), `day`, `item` (time or window, duration, type, catalog reference or custom, notes, track A/B/C, Plan B link), `leg` (between items), `stay_night`, `booking` (offer reference, status, deadline, confirmation), `note`, `checklist_item`, `trip_member` (collaborators and roles) | Trip status: draft, planning, booked, done, archived. A done or published trip can be a **template** anyone can fork. |
| Research | `research_job` (destination or entity, lanes, requested by, status, cost), `finding` (raw extract), `proposal` (set of claims and new entities to review), `coverage` (per area per kind, freshness) , `backlog_item` | The machinery that grows the catalog. |
| Audit | `event_log` (every operation: actor, op, input hash, before and after ids) | Undo, attribution, analytics. |

Custom items are first-class: an `item` may reference a catalog entity or carry its own name, pin, kind and notes; a custom item can later be proposed to the catalog.

## 3. How a trip is planned (the product flow)

| Step | What the user does | What the system does |
|---|---|---|
| 1. Intent | Where (or "surprise me" by region), when (month, season or dates), how long, who (party with ages), style (adventure, relax, luxury, culture, road trip, family), pace, walking limit, budget, transport | Saves preferences; shows a live count of what fits ("38 things, 12 suit a 10-year-old"); coverage warning if the area is thin |
| 2. Browse and pick | Cards, list, table or map of catalog items filtered by the intent; save to a "maybe" tray; search; add anything custom by name or by dropping a pin | Eligibility per traveller, season and opening checks, distance from likely bases |
| 3. Draft | "Make me a draft" or build it by hand | Deterministic planner: bases by geography, days by daylight and travel time, pace budget, Plan B per weather-sensitive item; explanations per item |
| 4. Shape | Drag items across days, set times, add notes, reorder, add breaks every N hours on drive days, choose tracks for different fitness | Day checks (overlaps, travel fits, daylight, closures, too long for the pace, someone in the party cannot do it) with one-tap fixes |
| 5. Book | See every bookable thing with its booking window, sell-out speed, price read date and book-by date | Timeline of deadlines; reminders; status per booking |
| 6. Go | Phone view by day, offline download, sun times, weather, conditions check | Conditions routine before departure with one verdict |
| 7. After | Mark done, add what really happened, publish as a template | Visits feed back to the catalog (visited, notes, corrections as proposals) |

## 3A. Experience design: practical, before, during and after the trip

The product is judged on two moments: the evening at home planning on a laptop, and 07:40 at a trailhead with one bar of signal and a child asking where the toilet is. Design for both, phone first.

### 3A.1 The trip has four phases, and the app changes with them

| Phase | When | What the app leads with |
|---|---|---|
| Plan | from idea until the itinerary is settled | Intent, browse and pick, day board with the map, suggestions with reasons |
| Book | from the first booking window until everything is booked | The booking timeline: what opens when, what to book now, what sells out |
| Prepare | the last weeks | Tasks: documents, packing, shopping, downloads for offline, a conditions check |
| Go | the travel days | Today mode on the phone |
| After | once home | Mark done, keep memories and corrections, publish as a template |

A trip shows a **readiness bar** (Plan, Book, Prepare, Go) on its dashboard and in the trip list, so a person sees at a glance where each trip stands.

### 3A.2 The trip dashboard

One screen per trip, the place every visit starts:
- **Next action**, one line, the most urgent thing: "Moraine Lake shuttle seats release Sat 15 Apr at 08:00 MT. Book within the hour; they sell out in minutes."
- **Readiness**: days planned 12 of 14; bookings 6 of 9 (next deadline in 12 days); documents 2 of 3; packing 40 percent.
- **Upcoming**: the next three deadlines and openings.
- **Party**: who is going, ages, who can do what.
- Links to the day board, tasks, bookings, map, documents.

### 3A.3 Tasks: the trip as a to-do list

Every trip has tasks, grouped **Book, Buy, Pack, Documents, Prepare, On the day**.

| Field | Meaning |
|---|---|
| title, group | "Book Moraine Lake shuttle", Book |
| due | a date, or relative to the trip ("90 days before") resolved per edition; shown as "in 12 days" |
| source | `booking`, `booking_window`, `document_rule`, `packing_template`, `conditions`, `manual` |
| owner | which traveller does it |
| status | to do, done, skipped, not needed |
| cost, link | what it costs, where to do it |
| proof | confirmation number, ticket file, receipt photo (private) |
| notes | free text |

Tasks are created automatically and can always be edited or added by hand:
- every bookable item in the plan creates a **Book** task with its book-by date;
- every offer with a booking window creates an **opening** reminder;
- the party's citizenship and the destination create **Documents** tasks (passport validity six months after return, eTA or visa, letters for minors, insurance);
- the trip style and season create a **Pack** list from a template (hut trip, glacier, beach, city, kids), which the user edits;
- **Buy** tasks come from the pack list ("crampons for a 10-year-old") or are added by hand;
- **Prepare** covers offline downloads, the conditions check, currency, phone plan.

Checking a task off is one tap, with an undo, and it moves the readiness bar.

### 3A.4 Booking windows and reminders

Bookable things carry their booking window from research: opens on a fixed date, opens N days before, released monthly on a given day and hour, by lottery, or same day only; how fast it sells out; the fallback when missed (for example a 48-hour release). For a trip edition the app computes:
- **opens_at** in the operator's time zone, and in the traveller's;
- **book_by**, from the opening and the sell-out speed;
- the **reminder schedule**: a week before opening, the evening before, fifteen minutes before, at opening, and a "did you get it?" follow-up; for slow-selling items, one reminder before the book-by date.

Reminders reach people three ways, chosen per trip:
- **Calendar subscription** (an ICS feed per trip with alarms): the most reliable on any phone, works without an app install;
- **Push** from the installed web app (supported on Android and on iOS for installed web apps);
- **Email**, including a weekly digest during Book and Prepare.

The notification centre in the app lists every reminder with its state (upcoming, due, done, missed), and every reminder links straight to the booking page and to the task to check off.

### 3A.5 Today mode (the phone during the trip)

During the trip's dates the app opens on **today**:
- the **next stop**, with "leave by 07:10" computed from the travel leg and parking notes, and one tap to navigate in Google or Apple Maps;
- the **day as a timeline**, items checking off as they happen; the current one highlighted;
- **tickets and confirmations** for today one tap away, available offline;
- **light and weather**: sunrise, sunset, last light, forecast, conditions alerts, and the day's weather rule ("if gusts over 50 km/h at 07:00, switch to Plan B");
- **Plan B** as a toggle that swaps the day's affected items;
- **running late**: shift the rest of the day by the delay; the app warns about anything that no longer fits (a closing time, a booked slot, daylight);
- **quick note or photo**, attached to the stop;
- an **offline badge** and what is cached.

In the evening a **tomorrow briefing** card: the start time, what to pack in the day bag, bookings tomorrow, the forecast, and anything to do tonight.

### 3A.6 Planning on desktop and on phone

| Task | Desktop | Phone |
|---|---|---|
| Browse and pick | Filter bar on top, cards or table beside a map | Filters in a sheet, cards, map as a toggle |
| Build days | Day board (columns of days) with the map beside it; drag items between days | One day at a time, swipe between days, map as a bottom sheet, long-press to move |
| Add by hand | Search box with "add as custom", or click the map | Search, or drop a pin on the map |
| Notes | Inline on any trip, day or item | Same, one tap |
| Check the plan | Day checks as inline warnings with fixes | Same, as a list on the day |

### 3A.7 Rules that keep it intuitive

1. One primary action per screen, written as a verb ("Book the shuttle", "Add a day").
2. Show the number where the decision is made (distance, time, cost, how many fit).
3. Nothing basic behind an account or AI; sign-in is needed only to save or share.
4. Every suggestion shows its reason; every warning offers a fix.
5. Nothing is lost: autosave, undo everywhere, offline edits sync later.
6. Dates are always relative and absolute ("in 12 days, Sat 15 Apr").
7. Large touch targets, one-handed reachability on phones, readable in sunlight (contrast AA or better), works with reduced motion and screen readers.

### 3A.8 What this adds to the domain model

`task` (fields above), `reminder` (task or offer, channel, fire_at, state), `notification_pref` (per user and trip), `packing_template` and `document_rule` (reference data), `day_state` during the trip (actual times, done items, delay), and `attachment` (tickets and receipts, private). Booking windows live on `offer` as structured fields (rule, opens date or offset, release hour and zone, sell-out speed, fallback).

## 4. The MCP: a first-class product surface

The MCP server is generated from the same operation catalogue as the API, plus resources and prompts. Any MCP client (Claude, ChatGPT with MCP, local clients) can research and plan; results appear in the app immediately.

| Group | Tools (examples) |
|---|---|
| Explore | `search` (text, kind, tags, near point, within area, along route), `get_entity`, `get_area_guide`, `list_coverage`, `get_schema` |
| Plan | `create_trip`, `set_preferences`, `add_traveller`, `suggest_items`, `draft_itinerary`, `add_day`, `add_item`, `move_item`, `add_note`, `add_custom_item`, `suggest_breaks`, `validate_trip`, `list_deadlines`, `fork_template` |
| Research | `start_research(destination or entity, lanes)`, `submit_findings(job, claims, entities, media)`, `propose_entity`, `propose_claims`, `refresh(entity or area, lanes)`, `list_backlog`, `claim_status` |
| Review (owner or moderators) | `list_proposals`, `accept`, `reject`, `merge_entities` |

Resources: the JSON Schema of every entity, the taxonomy, the difficulty scale, the research lane definitions and source rules. Prompts: research recipes per lane ("trails lane: return distance, gain, geometry source, difficulty with the local grade, parking, closures, sources with read dates").

Security: remote MCP over HTTP with OAuth (each user authorises a client; every operation records the actor and the client); research tools can write only proposals, never verified facts; rate and cost limits per user.

## 5. Research as a system

- **Lanes** (destination overview, trails, adventure with limits, sights and viewpoints, hidden gems, stays, food, relax and luxury, road trip and legs, timing and light, entry and documents, fares and costs, media, community reality checks). Each lane has a contract: required fields, preferred sources, what counts as evidence.
- **Two ways research runs**: (a) a user's chat client calls the MCP research tools and submits findings; (b) the server runs a research job with its own agent workers (Claude Agent SDK) for the owner or for paying users, with a cost budget per job.
- **Onboarding a new destination** is a job: geography (area polygons from OpenStreetMap or geoBoundaries), candidate POIs from Wikidata and OpenStreetMap, then the lanes, then review. Coverage turns from thin to usable to good.
- **Refresh** is driven by staleness rules per attribute (prices 120 days, hours 180, closures 7, geometry rarely) and by the backlog.
- **Trust**: claims start as `proposed`; low-risk additions with an official source auto-accept as `stated`; `verified` needs review or two independent official sources. The UI shows trust badges.

## 6. Architecture

| Layer | Choice | Why |
|---|---|---|
| Database | **Postgres with PostGIS** (Supabase) | Real multi-user data, row-level security per trip and per user, spatial queries (near, within, along a route corridor for "a break every 2 hours"), full-text and trigram search, JSONB for flexible claim values. Supabase adds Auth, Storage for images and research files, queues (pgmq) and edge functions, and it is already the owner's stack with RLS-first rules. |
| Domain layer | TypeScript package: Zod schemas, operations (commands and queries), planner, day checks, sun, book-by | Already largely built in `core/`; becomes the single implementation used by API, MCP and workers. |
| API | HTTP API with an OpenAPI spec generated from the operations | Integrations and the web app. |
| MCP | Remote MCP server generated from the same operations (plus resources and prompts), OAuth | Chat-first planning and research. |
| Web | Next.js (App Router), Tailwind, Base UI or shadcn, TanStack Table, MapLibre with OpenFreeMap tiles and Mapterhorn terrain | Already built for the list views; becomes dynamic (server components reading Postgres) instead of a static export. |
| Workers | Queue-driven research and refresh jobs (pgmq or Cloudflare Queues), scheduled conditions checks, notifications | Research and reminders without blocking the UI. |
| Hosting | Web and API on Vercel or Cloudflare Workers; database on Supabase; images on Supabase Storage behind a CDN | Low ops, scales from one user. |
| Offline | PWA: downloaded trip in IndexedDB, cached tiles for the trip area, GPX and ICS exports | Trailheads. |
| Git | Code only, plus nightly data exports for backup and history; research Markdown archived in Storage with a git mirror if wanted | The database is the source of truth once there is more than one writer. |

## 7. Management and operations

- **Admin console**: review queue, coverage map, backlog, research jobs and their cost, moderation of user images and contributions, user management.
- **Quality**: schema validation on every write (database constraints plus the domain validator), day checks, a nightly integrity job (dangling references, stale facts), tests per operation.
- **Observability**: structured logs and error monitoring, operation metrics, research cost dashboards.
- **Privacy**: private traveller data never leaves its trip; public pages show templates without personal data; export and delete per user.
- **Licensing**: per claim and per image; an attribution page generated from the sources actually shown.

## 8. Build order (vertical slices, each usable)

| Slice | Delivers | Proves |
|---|---|---|
| S0 Foundations | Supabase project, PostGIS schema from the domain model, RLS, auth, operation layer on Postgres, OpenAPI and MCP generated, seed import of today's 64 places and the vocabulary | One source of truth, one API, MCP working |
| S1 One destination end to end | Banff and Lake Louise (or Patagonia): onboarding job via MCP research tools, trails with maps and galleries, activities with limits, stays; review queue | The flywheel on real data |
| S2 Trip builder | Intent step, browse and pick, manual add, day board, notes, day checks, trip page in the chosen design, offline download | The core product |
| S3 Templates and sharing | Status, done hidden by default, publish and fork templates, collaborators | Opens it to others |
| S4 Bookings and going | Deadlines timeline, reminders, conditions check, ICS and GPX | Real trips |
| S5 Scale research | More destinations through the backlog; refresh by staleness; cost controls | Product growth |
| S6 Planner and routing | Deterministic draft generation, breaks along a route, routing service | Intelligence without AI cost |

## 9. Migration from what exists

| Existing | Becomes |
|---|---|
| `core/` Zod schemas, operations, day checks, sun, book-by, ops catalogue, MCP stdio server | The domain layer, kept; the store adapter gains a Postgres implementation; the schemas map to tables; the MCP becomes remote |
| `data/locations/` (64 places, collections, tags) and `data/catalog/` | Imported into Postgres through the operations, as claims with their existing sources |
| Research Markdown in `research/` | Archived as research files; key facts imported as claims during S1 |
| `web/` (app shell, list views, filters, design tokens) | Kept; switches from build-time JSON to server reads; restyled with the chosen design |
| `legacy/` trip pages | Served unchanged at their URLs until each is rebuilt as a trip in the new model |
| Git JSON as source of truth, nightly D1 export (plan D28) | Replaced by Postgres as truth with nightly exports to git |

## 10. Decisions this asks of the owner

| # | Decision | Recommendation |
|---|---|---|
| B1 | Move the source of truth from JSON in git to Postgres (Supabase) now | Yes, before importing more data (P4c) |
| B2 | Hosting: Vercel or Cloudflare Workers for the app; Supabase for data | Supabase plus Vercel for speed of building; Cloudflare stays for the legacy pages until migrated |
| B3 | First vertical slice destination | Banff and Lake Louise (trails well mapped in OpenStreetMap, the owner's 2029 plan) |
| B4 | Server-run research agents for other users (cost) | Owner only at first; others use their own MCP client |
| B5 | Accounts now or later | Now (Supabase Auth), because templates, MCP OAuth and collaborators need them |
