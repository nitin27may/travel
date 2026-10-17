# 01. Domain model

The DDL is in [schema.sql](schema.sql). This file explains the shapes and the rules that DDL alone does not show.

## 1. Four areas

```
            CATALOG (shared, public, reviewed)                     PLANS (private by default)
  ┌───────────────────────────────────────────────┐      ┌──────────────────────────────────────┐
  │ area (tree: country > region > park/town)     │      │ trip ── trip_member ── user           │
  │ entity (kind: place, trail, activity, stay,   │◄─────┤   ├─ traveller (ages, limits; private) │
  │         eatery, hub)                          │ refs │   ├─ trip_item (ideas, days, times,    │
  │   ├─ offer (bookable thing + booking window)  │◄─────┤   │     spans, parent, variants)       │
  │   ├─ media                                    │      │   ├─ booking ── attachment            │
  │   ├─ relation (trailhead_of, near, part_of)   │      │   ├─ task ── reminder                 │
  │   └─ evidence (field-level, with source)      │      │   └─ day_note                          │
  │ leg_cache (A→B by mode)                       │      └──────────────────────────────────────┘
  └───────────────────────────────────────────────┘
            ▲ accepted changes                         EVENTS: op_event (every operation, every actor)
  ┌───────────────────────────────────────────────┐
  │ RESEARCH: research_job ── changeset ── change │     PEOPLE: user, profile, role, oauth clients,
  │           coverage, backlog                   │             push subscription, notification pref
  └───────────────────────────────────────────────┘
```

## 2. Catalog

### 2.1 `area`: the geography tree

Country > region > area (park, valley, town, resort). Stored as a tree with a materialised path (`ltree`)
so "everything in Alberta" is one indexed query. Each area has an optional polygon (from OpenStreetMap or
geoBoundaries) and a centre point. Anchored to Wikidata QIDs and ISO 3166 codes so imports dedupe.

### 2.2 `entity`: one table for everything you can visit

| Column group | Contents |
|---|---|
| identity | `id` (ULID), `kind`, `subkind` (viewpoint, waterfall, lake, museum, zipline, hotel, campsite, hut...), `name`, `names` (other languages), `slug`, `wikidata_qid`, `osm_ref` |
| place | `area_id`, `point` (geography), `shape` (line for trails, polygon for lakes or parks; nullable) |
| facts common to all kinds | `summary` (our own words), `tags` (controlled vocabulary), `season` (open months, closures), `hours`, `eligibility` (min age, min height, fitness 1-5, mobility notes), `cost_band`, `duration_min`/`duration_max`, `website` |
| kind-specific | `attrs` (JSONB, validated by the schema for its kind: a trail has distance, gain, loss, loop or out-and-back, local grade, trailhead entity; a stay has type, rooms, check-in time) |
| state | `status` (draft, published, retired), `trust` (unverified, stated, verified), `fresh_until` (earliest staleness date across its fields), `version` |

Why one table: one search index, one editor driven by the kind's schema, one review queue, one set of MCP
tools. The JSONB `attrs` is not a dumping ground: each kind has a Zod schema; the database checks the
kind's required keys with a `CHECK` on a generated column only where it matters for queries (for
example `trail_km` is a generated numeric column, indexed, so "trails under 12 km" is fast).

### 2.3 `offer`: what you book

An offer is a bookable thing attached to an entity: a ticket, permit, shuttle seat, tour slot, room
type, campsite, ferry crossing. It carries price (min, max, currency, read date), operator, booking URL
and a structured **booking window**:

| `window_rule` | Fields | Example |
|---|---|---|
| `fixed_date` | `opens_on`, `opens_time`, `tz` | Parks Canada reservation launch day |
| `rolling` | `days_before`, `opens_time`, `tz` | Algonquin day permit, 5 days ahead |
| `monthly_release` | `day_of_month`, `months_ahead`, `opens_time`, `tz` | Machu Picchu-style releases |
| `lottery` | `apply_from`, `apply_to`, `results_on` | US permit lotteries |
| `same_day` | `opens_time`, `tz` | walk-up only |
| `anytime` | none | most hotels |

Plus `sellout` (minutes, hours, days, weeks, rarely) and `fallback` (free text plus an optional second
window, for example a 48-hour re-release). From these and a trip's dates, the system computes `opens_at`
and `book_by` per booking (section 3.4).

### 2.4 `evidence`: where each value came from

One row per (entity, field path, value, source). `field` is a JSON path such as `attrs.distance_km` or
`season.open_months`. Columns: `value`, `source_id`, `observed_at` (when the source was read), `quote`
(short, our paraphrase; never a long copy), `confidence` (official, operator, community, agent_inferred),
`author_id`, `changeset_id`.

Rules:
- The entity's column holds the **chosen** value. Evidence rows whose value differs from it are
  **conflicts** and show in the review queue and on the entity page ("Parks Canada says 21 km; a 2025
  trip report says 23 km").
- Staleness is per field family (prices 120 days, hours 180, closures 7, geometry 3 years; table
  `freshness_rule`). `fresh_until` on the entity is the minimum, so "what needs refreshing" is an index scan.
- Trust: `stated` needs one official or operator source; `verified` needs a reviewer or two independent
  official sources. Agent-inferred values can never be more than `unverified`.

### 2.5 `relation`: the small graph

`(from_entity, to_entity, kind)` with kinds such as `trailhead_of`, `starts_at`, `part_of` (a trail
section of a longer route), `near`, `alternative_to`, `combo_with`, `serves` (a shuttle serves a lake).
This is all the graph the product needs; see 04-stack.md for why it is not a graph database.

### 2.6 `media`

Entity, storage (Commons URL or a Supabase Storage key), width, height, licence, author, attribution text, source
URL, caption, role (hero, gallery, map, user), status (proposed, approved, hidden), perceptual hash to
catch duplicates. Commons is linked (their thumbnails), not copied; user uploads go to Supabase Storage.

### 2.7 `leg_cache`

(from point, to point, mode) → duration, distance, geometry, provider, computed_at. Routing calls are
rate-limited and cost money at scale, so every computed leg is cached and reused across trips.

"Distance from you" (the Travel Finder's core idea: the location is the lens) uses the same cache
keyed by a rounded origin: the origin is snapped to a ~1 km geohash cell, so every user in the same
part of Whitby shares one set of drive times. The query first filters by straight-line distance in
PostGIS (fast, free), shows straight-line estimates at once, and fills real drive times for the top
results from the cache or the routing service.

### 2.8 `saved_view` (personas)

A saved filter set: name, filters (the same JSON the URL holds), owner (system or user). System views
are the persona quick-starts ("Family with young kids", "Hard hikes", "Rainy-day rescue",
"Accessible day out"); users save their own. No separate persona table.

## 3. Plans

### 3.1 `trip`

| Field | Notes |
|---|---|
| `title`, `slug`, `cover_media_id` | |
| `start_date`, `nights` | both nullable: an idea has neither; a template has `nights` but never dates |
| `date_window` | optional "sometime in Sep 2028" before dates are fixed |
| `home_tz`, `origin` | where the party starts; used for drive legs and reminder times |
| `prefs` | styles (tags), pace (relaxed, balanced, packed), walk limit (km per day, gain per day), budget band, transport (car, transit, camper, mixed), must-do and avoid lists |
| `phase` | idea, plan, book, prepare, go, after, archived; **computed** from dates and progress, with a manual override |
| `visibility` | private, link (anyone with the link, no personal data), public |
| `is_template`, `forked_from` | a template is a trip with no dates and no travellers' personal data |
| `version` | increments on every operation; clients use it to detect changes |

### 3.2 `household`, `person` and `traveller`

The intent notes (`Travel Preferences.md`, the vault intake) show that most of a trip's setup is the
same every time: home base Whitby, a family of four with kids 9-12, car, mid-range, balanced pace,
"waterfalls, lookouts, caves, swimming, splash pads", "avoid unfenced cliff edges with young kids;
long single stretches with nothing to break them up". Asking that per trip is the friction the
vault skill already warns about ("pre-fill, don't re-ask").

- `household`: owned by a user, shared with its adult members. Holds **standing preferences**
  (home base point and address, default day-trip radius in drive minutes, usual transport, budget
  style, pace, interests as tags, avoid rules, dietary) and optional **memberships and passes**
  (Ontario Parks vehicle pass, Parks Canada Discovery Pass, a zoo membership) with expiry dates.
- `person`: a household member: name, birth date or year, height, fitness 1-5, mobility, dietary,
  citizenship, **passport expiry** (date only; never the number). Private to the household.
- `traveller`: a person on a given trip (or an ad-hoc guest with only a name and age band). Ages are
  computed at the trip's dates, so a child who turns 12 before the via ferrata counts as 12.

A new trip copies the household's preferences into `trip.prefs` (then edits are per trip); the
travellers default to the whole household. Passport expiry plus the trip's return date and the
destination's rule ("valid 6 months after return") produce a Documents task automatically, which is
exactly the "check passport expiry dates for all family members" task in `Plan.md`.

### 3.3 `trip_item`: the one flexible thing

| Field | Meaning |
|---|---|
| `kind` | visit, hike, activity, stay, transport, meal, break, note, custom |
| `entity_id`, `offer_id` | catalog references; both nullable (custom items have neither) |
| `title`, `point`, `address`, `url` | override or, for custom items, the only description |
| `day` | null = ideas tray; 1..N = day of the trip |
| `end_day` | for spans (a hut stay, a 4-day trek, a multi-night hotel) |
| `start_time`, `end_time`, `tz` | local wall-clock times in the item's zone; both optional ("morning" is `time_hint`) |
| `time_hint` | sunrise, morning, midday, afternoon, sunset, evening, night |
| `sort_key` | fractional index string, so reordering never rewrites siblings and two people moving items rarely collide |
| `parent_id` | nesting: stages of a trek, stops of a drive day |
| `variant_group`, `variant` | parallel options on the same day: Track A (adults' hike), B (family), C (less walking); exactly one per group can be `chosen`, or all shown |
| `plan_b_for` | this item replaces that one when weather rules fire |
| `who` | traveller ids doing it; empty = everyone |
| `status` | planned, done, skipped (during and after the trip) |
| `notes` | Markdown |
| `cost_estimate`, `currency` | |

Days are not rows. `day_note` holds a title, notes and the night's base for a day number if someone
writes one. With dates set, day N is `start_date + N - 1`; without dates the UI shows "Day N".

### 3.4 `reservation` (replaces `booking`)

What the party booked themselves, or still has to book: flights, stays, cars, trains, ferries,
transfers, activities, restaurants, parking, insurance. Status to_book → held/booked → done, or
cancelled; timed parts are segments with local times and zones; per-traveller seats and tickets;
secret codes in a separate table. Stays set each night's base for routing; flights and cars bound the
days. Full design: **09-reservations.md**.

### 3.5 `task`

Groups: book, buy, pack, documents, prepare, on_the_day. Due is either absolute or relative
(`due_rule`: "90 days before start", "at booking opens_at", "evening before day 3"), resolved to
`due_at` whenever dates change. `source` says why it exists: booking, booking_window, document_rule,
pack_template, conditions, manual; generated tasks keep `source_ref` so regenerating never duplicates
them and never touches one the user edited (`user_edited = true` wins). Owner is a trip member;
status todo, done, skipped, not_needed; proof attachment, link, cost, notes, sort_key.

Reference data that generates tasks: `pack_template` (style + season + age band → items) and
`document_rule` (citizenship + destination → passport validity, eTA or visa, minor consent letters,
insurance). Both are catalog-like, reviewed, and researchable through the MCP.

### 3.6 `reminder`

(task or booking, `fire_at` in UTC, channels: push, email, calendar), state scheduled, sent, failed,
acknowledged, cancelled. Reminders are rows produced from tasks and bookings, never hand-scheduled
jobs, so changing a trip's dates simply recomputes them. Schedule per booking window: 7 days before
`opens_at`, the evening before, 15 minutes before, at opening, and a "did you get it?" 2 hours after;
slow-selling offers get one reminder 7 days before `book_by`.

### 3.7 Scale, candidates, budget and the travel year

**Scale.** `trip.scale` is day_trip, weekend or multi_day. The same model serves all three; the UI
changes (a day trip has one day, no stays, a drive radius from home and a "leave by" time; see
02-experience.md). Most of the intent notes are day trips (40 local destinations, bike day trips),
so day trips are not a mode bolted onto a holiday planner.

**Candidates.** Before a destination is chosen, a trip can hold several `trip_candidate` rows
(destination area or free text, drive or flight time from home, best time, duration, rough cost,
pros, cons, notes, a vote per member). This is the "Fall colours trip ideas" and "India trip
options" tables in `Plan.md`. Choosing one sets the trip's area; the others stay for reference.

**Budget.** `budget_line` per trip: category (getting_there, local_transport, lodging, food,
activities, misc), estimate, actual, currency, per person or per group, linked booking or item. The
buffer percentage (default 12%) is a trip setting. Bookings and items with a cost feed lines
automatically; manual lines are allowed. Totals show in the trip currency and the household's home
currency at a rate stored with its date.

**Expenses.** `expense` records what was actually spent (date, amount, currency and the home-currency
amount, category, optional link to an item or booking, receipt). Budget lines are the plan; expenses
are the truth; the budget view shows both. `paid_by` and `split_between` are optional columns so
"group balances" (who owes whom, Wanderlog's term) can be added for friends' trips without a schema
change; a family trip never sees them.

**Passes.** An `offer` of kind `pass` lists the entities it covers (relation `covered_by`). When a
trip uses several covered places, the budget shows "the Discovery Pass pays for itself after 3 of
these 5 visits"; if the household already holds the pass, those entry fees drop to zero.

**The travel year.** `travel_goal` per household: a year, a rule ("1 international + 1 local
family holiday"), a budget target. `calendar_window` reference data per country and region: public
holidays, long weekends, school breaks (owner-entered for the kids' school board, since there is no
reliable free feed). The year view puts trips, candidates, long weekends and goals on one
timeline, so "Columbus Day weekend: fall colours" is visible in January.

### 3.8 `trip_member`

user (or pending email invite), role owner, editor, viewer; optionally linked to a traveller. Rights
come from here; the database enforces them again with row-level security (04-stack.md).

## 4. Research

- `research_job`: scope (new area, an area to refresh, an entity, a lane), lanes requested, requester,
  runner (chat client via MCP, server agent, import script), status, cost budget and cost spent.
- `changeset`: author, client (web, mcp:<client name>, import:<script>), job, purpose, status (open,
  submitted, accepted, partial, rejected). Holds many `change` rows.
- `change`: op (create, update, retire, merge), target entity or a temporary ref for a new one (so a
  changeset can create a trail and its trailhead together), `patch` (JSON merge patch against the
  entity at `base_version`), evidence rows, per-change decision and reviewer note.
- `coverage`: per area and kind: count, share with media, share fresh, a score thin, usable, good.
- `backlog`: gaps with a priority (trips using it × urgency × severity), fed by coverage, staleness,
  conflicts and user requests ("nothing about food in El Chaltén").

A person editing a catalog entry in the UI also creates a changeset; for an admin it auto-accepts.
That means one review path, one history, and one way to roll back a bad import.

## 5. Events

`op_event`: (id, at, actor user, client, operation name, trip or entity, input, inverse, result
version). Gives undo per user, the trip activity feed ("Priya booked the shuttle"), audit for MCP
clients, sync ordering, and analytics. Retention: forever for catalog, 2 years for trips.

## 6. What the model deliberately leaves out

| Not modelled | Why |
|---|---|
| Flights as structured data with fare search | A different product (and paid APIs). Flights are trip items of kind transport with a booking and a deadline |
| Expense splitting UI (group balances) | the family does not split costs; `expense.paid_by` and `split_between` keep it a UI addition for friends' trips later |
| Social feed, likes, follows | Templates and forks give the sharing that matters; a feed is moderation cost with little planning value |
| Per-user catalog copies | Personal facts are custom items or notes; shared facts go through changesets |
