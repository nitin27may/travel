# Prototypes: what is not real yet (the to-do prototype list)

Status: **list, docs only** (27 Oct 2026, travel-planner, Opus, task PROTO-TODO). Owner instruction of 27 Oct 2026:
"whatever things are not completed or hard-coded in the prototype, add those into a to-do prototype list ... put the
remaining items as a list". PLAN R-283; BACKLOG 15.356. Companion pages:
[FINDINGS-2026-10-27.md](FINDINGS-2026-10-27.md) (bugs fixed, findings that stand, enhancements 1 to 29: **not repeated
here**) and [BRAINSTORM-edit-trip.md](BRAINSTORM-edit-trip.md) (open design questions for editing a copy).

This page adds what FINDINGS does not hold: **each hard-coded value named by file and constant, each faked engine set
against the real one, the missing states and flows, and for every item the owner, the size and whether it blocks the
first useful builder slice FS-1** ([build/builder-dependency-map.md](../build/builder-dependency-map.md) 6.4: near mode
and single-base trips, honest drive times, edits by rebuilding, device save, share link; bundle D). Where FINDINGS
already names a gap, the row says "F:" with its section or item number and adds only the file, owner and size.

Principles are cited by number from [foundation/principles.md](../design/foundation/principles.md) (P1 to P9, T1 to T5).

## How to read the tables

| Column | Values |
|---|---|
| Owner | **builder** (travel-builder lane, code in `web/`, `core/`), **data** (research or data seat), **design** (planner or design reviewer: spec, frames, review), **owner** (Nitin decides) |
| Size | **S** up to 2 h, **M** 2 to 8 h, **L** over 8 h. The effort to close the gap; most of it sits inside the planned task named in "Becomes product", so this list adds no hours unless the row says **new** |
| When | **FS-1**: blocks the first useful builder slice. **D**: same bundle, not FS-1. **Later (E, F)**: after FS-1. **Proto**: matters only for the next prototype round (R-280) |
| Needs | what turns it into product: owner decision, data, backend, design review |

## 0. The ten biggest gaps

| # | Gap | Rows |
|---|---|---|
| 1 | The drive figures are one formula (`drive()`, haversine x 1.3 or 1.7), not `core/src/drive`'s layered model with confidence; every plan, reach filter and warning rests on it | B-E1 |
| 2 | The itinerary engine is a greedy, client-side stand-in (nearest neighbour, fixed lunch and start times, own pace table); the spec's `core/src/plan/` pipeline and `scheduleDay` are not modelled | B-E2 to B-E6 |
| 3 | The two prototypes do not share a document: the builder's `fromTrip` drops every stop whose id is not a `PLACES` key, so "Edit plan" on a planner trip opens with empty days, and the first builder edit overwrites the planner's bookings, checklist, costs and notes | X-1, X-2 |
| 4 | A copy of "our trip" is rebuilt by the engine from `OUR_TRIP.picks`, so the published days and their versions A, B, C are lost at copy time (the opposite of template mode, EM3) | B-F6; brainstorm Q1, Q2 |
| 5 | The party is stored in the draft with names and needs (`decider`, `stroller`, `first`), against ISO-3 (built drafts never store the party) and ACCT-P AD2 (no names) | X-4 |
| 6 | The catalogue is a list of 60 invented records filtered in the browser; the product reads light rows through `planCandidates` (P8, P9) | B-H1, B-E7 |
| 7 | "Today" is pinned to 27 Oct 2026 in two apps, and "next weekend" and book-by years are hard-coded | X-3 |
| 8 | States the flow specifies are missing: quota out (legs ≈), stale engine, storage blocked, candidates failed, conflict, newer document, paused | B-S1 to B-S4 |
| 9 | No account, no sync, no shared link that works on another device | B-F4, P-F2, P-F4 |
| 10 | Reorder on a phone has no touch path other than the item sheet; no keyboard lift model or announcements (F: builder 5) | B-A1 to B-A3 |

## 1. Cross-cutting

| Id | What is not real | Where (file, constant) | Becomes product through | Needs | Owner | Size | When |
|---|---|---|---|---|---|---|---|
| X-1 | Two document shapes. The builder keeps its own state blob (`proto.builder.blobs`, `PERSIST` list) and writes a planner shape with `toTrip`; the planner seeds a different shape (`P.seedTrips`). `fromTrip` maps `it.id or it.slug` to `PL` and drops misses: seeded planner items (`P.uid('i')` ids) and every item of a trip duplicated in the planner (`index.js` "dup" rewrites item ids) vanish when opened in the builder | `builder/builder.js` `fromTrip`, `toTrip`; `planner/shared.js` `P.seedTrips`; `planner/index.js` dup | One document `plan-draft/1` with template and built modes ([edit-my-trip](../features/edit-my-trip.md) EM1, EM-C built) | none (decided); the next prototype round reads and writes one shape | design | M | Proto |
| X-2 | The first builder edit on a planner trip replaces it wholesale: `save()` writes `toTrip(S)`, which rebuilds bookings from `bookAhead` (done ticks lost, `S.done` empty), checklist from `S.checklist` (null for opened trips, so empty), costs from prices, and drops trip notes, item notes and Today's `done` flags | `builder/builder.js` `save`, `openDraft`; `engine.js` `toTrip` | Ops with inverses on one document (`core/src/ops`, EM-C); the editor never rewrites fields it did not change | none | builder (ED) | M | Later (ED, E or F); Proto now |
| X-3 | Fixed dates. Builder `TODAY = new Date(2026, 9, 27)`; "Next weekend" is 6 to 8 Nov 2026 and "This weekend" 30 Oct to 1 Nov inside `whenInfo`; `bookAhead` picks the year with `w.month <= 10 ? 2027 : 2026`; calendar opens on 1 Nov 2026 (`initCal`). Parks `today()` is the 27th of a month in 2026 (`park.js`, `ctl.pm`). F: planner "demo data disagrees" | `builder/engine.js` `TODAY`, `whenInfo`, `bookAhead`; `builder/builder.js` `initCal`; `parks-app/park.js` `today` | Real clock in the browser for labels; book-by dates from `core/src/bookings` on the server (T1) | none | builder | S | FS-1 |
| X-4 | The party is saved into the draft and the planner trip with names, a "Deciding" flag and needs (`stroller`, `stepfree`, `dog`, `first`; planner `NEEDS`: Step-free, Short walks only, Child seat, Dietary, Carries a baby). Default party is "Nitin" plus an adult and a child of 6 (`newState`) | `builder/builder.js` `newState`, `PERSIST`, sheet `party`; `engine.js` `toTrip`; `planner/trip.js` `NEEDS`, `NEED_FX` | Built drafts: `party: "device"`, read through `readParty()` at build time, seeded from the account ([account](../features/account-profile-and-travellers.md) 5.5, ISO-3). Copies: `travellers` as counts and ages (EM-C). No names (AD2). A needs field is "later, one party model first" (FLOW factor 1b) | **owner**: does a party needs field exist, and on the account or per trip (F: enhancement 13)? Is "Deciding" wanted (FLOW factor 8 says later)? | owner, then design | M | FS-1 for the rule "the draft stores no party"; needs field Later (E) |
| X-5 | No network, no server, no account. Six `localStorage` keys: `proto.trips`, `proto.draft`, `proto.builder.blobs`, `proto.saved`, `proto.fav`, `proto.planner` | all three apps | `DataClient` (P9); `/api/v1/` candidates and build routes (TB-API, TB-L); device list `travel.plans.local` (EM-5); account table `plan_draft` (EM-M) | backend | builder | L | FS-1 for the device draft and the API; sync D (EM-2) |
| X-6 | Every fact is invented (`data.js` headers in builder and parks-app say so). F: cross-cutting | `builder/data.js`, `parks-app/data.js`, `planner/shared.js` seed | Catalogue rows and sidecars per [trip-builder-location-metadata](../features/trip-builder-location-metadata.md) and [destination-data-coverage](../features/destination-data-coverage.md) | data | data | L | FS-1 on today's data (QB2, QB3 answered: research later) |
| X-7 | Identity colours as literal hex in the planner (`pal` in `index.js` dup: `#0072B2`, `#D55E00` ...) and in the seed | `planner/index.js`, `planner/shared.js` | Identity keys from tokens 4 (TF19); guard G5 bans literal colour in builder UI | none | builder | S | FS-1 (TB-W1) |

## 2. Builder (`builder/`)

### 2.1 Hard-coded data and conditions

| Id | What is hard-coded | Where | Becomes product through | Needs | Owner | Size | When |
|---|---|---|---|---|---|---|---|
| B-H1 | `PLACES` (60 records) with invented flags: `s` stroller, `st` step-free, `dg` dogs, `in` indoor, `ic` iconic, `kids` youngest age, `diff` 1 to 3, `dur` minutes, `bk` [label, days], `cl` closed months, `pr` price | `builder/data.js` `PLACES`, `mk` | Light candidate rows with suitability (`TB_FIT`), `resolveDuration`, season windows, booking rules, prices with read dates | data; TB-MD metadata contract | data, builder | L | FS-1 |
| B-H2 | `CITIES` (10) and `AIRPORTS` (26), typed by hand; "Use my location" always returns Toronto after 700 ms | `builder/data.js`; `builder.js` `useloc` | Origin ladder O3, O4 and public hubs (MX `hubs.json`), ORG-D airports, real geolocation that stays on the device ([trip-origin](../features/trip-origin-and-nearest-airport.md)) | data (hubs, airports, both planned in C) | builder, data | M | FS-1 |
| B-H3 | `COUNTRIES` macro-regions, `REGIONS` with gateways `gw`, suggested `rec`, car notes; `AREAS` near-mode narrowing; `HINTS` per country by month (open, busy) | `builder/data.js` | Region-groups file (metadata M1, TB-RG with DC-5); season hints derived from the records (T1) | data | data, builder | M | Later (E, TB-P2) except the season line on stage 1 (FS-1, derive or drop) |
| B-H4 | `SUNSET`: one sunset per month for every latitude | `builder/data.js` `SUNSET`; `engine.js` `sunsetMin` | `core/src/sun` per base and date (longitude positive east) | none | builder | S | FS-1 |
| B-H5 | `PACE` table: visit 300, 420, 540 min; multipliers 1.2, 1, 0.85; drive 180, 240, **300** | `builder/engine.js` `PACE` | `PACE_RULES` in `core/src/schedule/rules.ts`: drive 180, 240, **360**; multiplier 1.25 relaxed; caps by party | none | builder | S | FS-1 |
| B-H6 | `KINDS` (nights, reach, band) and `VIBES` (six "Looking for" chips as regular expressions on names); the kind is stored in the draft (`S.kind` in `PERSIST`) | `builder/engine.js`; `builder.js` | Kinds derived, never stored (TK1, TF2); activity tags from the type tree, not names ([trip-kinds](../features/trip-kinds-and-interest-profile.md)) | none | builder | M | D if ready, else E (dependency map 6.4) |
| B-H7 | `PARKS` (4) and `ensurePark`, which guesses near or trip by a slug pattern (`/bruce|killarney|algonquin|ontario/`) | `builder/data.js`; `builder.js` `ensurePark` | TB-PIN (BACKLOG 15.354): a park pick pins the area through `within`; the hub comes from the origin ladder | none | builder | S | FS-1 (inside TB-W1) |
| B-H8 | `OUR_TRIP` is the only trip that can be copied (`?copy=dolomites`), and `SAVED` four fixed saved places | `builder/data.js` | Any public trip in template mode (EM-C, C1 to C5); Favourites and the locations list | none | builder | M | Later (EM-3 in D, ED in E or F) |
| B-H9 | Costs: currency guessed from the first stop's country (`cur`), children counted at half price, `pr: null` treated as unknown | `builder/engine.js` `planStats` | Known costs only, each dated, Free chip, "N of M priced" (TF16); no invented child factor | data (prices with read dates) | builder | S | FS-1 |
| B-H10 | Default checklist lines and the "Check entry rules" line | `builder/builder.js` `defaultChecklist` | One sourced line abroad (FLOW factor 7); checklist and packing later (F09) | none | builder | S | FS-1 (one line); rest Later |
| B-H11 | Links: share is `https://example.invalid/p/#<id>`; flights "Search flights" is a toast; booking links `'#'` in `toTrip` | `builder/builder.js` `copyLink`, sheet `getting`; `engine.js` `toTrip` | Share keys of trip-builder 2.5 (public refs only, never party, start or dates); booking links from records | none | builder | M | FS-1 (share); flights Later (F) |

### 2.2 Faked engines, against the real ones

| Id | Prototype | Real (exists or planned) | Gap to close | Owner | Size | When |
|---|---|---|---|---|---|---|
| B-E1 | `drive(a, b)`: haversine x 1.3, or x 1.7 inside two boxes (`mtn()`: Dolomites, Rockies), at 60, 80 or 95 km/h by distance, rounded to 5; `airDrive` x 1.3 at 65 km/h. No confidence, no range, no ferries, borders or closures | `core/src/drive/` exists (`model.ts`, `modifiers.ts`, `calibrate.ts`, `golden.ts`, `display.ts`): `modelDrive` (L2) and the planned `estimateDrive` over L0 to L3 with `confidence`, `range`, `flags` ([driving-time-model](../features/driving-time-model.md) 4, 6.1). Measured: the naive model is 30% off on average and 56% on short mountain legs | Route the plan legs (L0, L1), model only for filters and "about N days"; show ≈, bands and ranges (4.6); quota guard notice "Some drive times are estimates" | builder (DT-1, DT-L, TB-L, DT-UI); **owner**: ORS key in the server env | L | FS-1 |
| B-E2 | Near reach filter: `drive(origin, p) <= reachH x 60` over every place | `modelDrive` with the keep factor 0.75 (recall 100% on the golden set), then a routed matrix for the top 40 (4.2) | Optimistic filter, route the survivors, band until routed | builder (TB-E1) | M | FS-1 |
| B-E3 | Bases: greedy add of towns within 170 min of the picks' centroid plus a brute-force order over all permutations; K from "moves" (N/6, N/4, N/3, at most 4) | trip-builder 4.4: up to 40 candidate towns (towns layer, base towns, pins), p-median for K = 1..Kmax; near kinds a loop from the start (TF8) | FS-1 is K = 1 only: one base chosen from candidate towns with reasons (4.9); multi-base is TB-P3 | builder (TB-E1; TB-E2 later) | M (K = 1); L (multi) | FS-1 for K = 1; multi-base Later (F) |
| B-E4 | Nights per base: proportional to stops plus one | trip-builder 4.5, nights by demand | none for K = 1 | builder | S | Later (F) |
| B-E5 | Day packing: nearest-neighbour chain from the base, a per-day item cap, a budget of 40%, 85%, 75%, 70% of the visit day by day type; start 08:30; air arrival 13:00; lunch 45 min if the clock is between 12:30 and 14:30; a "light stop" on Day 1 | trip-builder 4.6 `pack.ts` (sweep, exact order, local search) and the existing `scheduleDay` (`core/src/schedule`: times, meal windows, `ageRules`, day caps, sun) | Pack with routed legs, time every day through `scheduleDay`; golden fixtures on our researched trips (4.11) | builder (TB-E1) | L | FS-1 |
| B-E6 | Warnings: over the drive limit, after the monthly sunset, long day (115% of the visit budget), closed in the month (`cl`). Did not fit has two reasons | `TB_*` checks, opening days by date, booking windows (`core/src/bookings`), `feasible.ts` with one fix each (4.7) | Date-aware checks; honest reasons | builder | M | FS-1 |
| B-E7 | Candidates: `allCandidates` and `candidates` filter and sort the whole `PLACES` list in the browser | `planCandidates` server query, 40 light rows a page, `near` and `limit` (TB-API, P8, P9) | Server query; the client never holds the list | builder (TB-API) | L | FS-1 |
| B-E8 | Build progress is a timer with random steps ("Working out drive times · n of m"); `failNext` simulates failure | Real build with progress or an honest indeterminate state; cold build up to 4 s (TF8) | Progress from the matrix calls, or no count | builder | S | FS-1 |
| B-E9 | "About N days": sum of `dur x mult + 25` over `vis x 0.9` (`estimateDays`) | L2 model, ±30% budget, shown ≈ (4.2) | Use `modelDrive` | builder | S | FS-1 |
| B-E10 | Client re-flow: `fitHint`, `roomDay`, `simMove`, `fillRows` copy and recalculate the whole plan per row | The 30 KB re-flow chunk over the picks matrix only; `modelDrive` for a newly added place (TF, trip-builder 4.10) | Matrix-bound re-flow | builder (ED) | M | Later (ED); FS-1 edits by rebuilding |
| B-E11 | Calendar file: no `DTSTAMP`, no escaping, all-day events (`icsOf`); the planner's `P.ics` is closer | Per-draft ICS export (P8), book-by events from `core/src/bookings` | One ICS writer | builder | S | FS-1 (Review primary is Add to calendar, F-Q4) |

### 2.3 Missing states

The prototype simulates five through its controls (`U.flags`): location refused, next build fails, device cap, stale
place on resume, shared link with private places. FLOW stage 7 "States" and stage 0 to 4 "Empty and error" name more.

| Id | State | Spec | Owner | Size | When |
|---|---|---|---|---|---|
| B-S1 | Quota out or routing down: every new leg ≈, the notice "Some drive times are estimates" and "Refresh times" next day | driving-time-model 4.2; FLOW stage 7 | builder, design (frame) | M | FS-1 |
| B-S2 | Stale engine or data revision on resume: "Rebuild to refresh drive times and closures"; resume never builds (TF14) | FLOW TF14 | builder | S | FS-1 |
| B-S3 | Loading and failure of candidates (skeleton rows; "We could not load places · Retry"); storage blocked (the Mine notice); offline while building | FLOW stage 0 and 3 | builder, design | M | FS-1 |
| B-S4 | Conflict from another device, newer document (read-only), paused (read-only), a lock or placement that no longer fits | FLOW stage 7; edit-my-trip 4.4, 5.5 | builder (ED, EM-2), design | M | Later (D for sync states, ED for the rest) |

### 2.4 Missing or partial flows

| Id | Flow | What the prototype does | What the product needs | Needs | Owner | Size | When |
|---|---|---|---|---|---|---|---|
| B-F1 | Starting city | pick one of 10 cities or a simulated location | the origin ladder and a town or airport search (OR11), location kept on the device | data (hubs, airports) | builder | M | FS-1 |
| B-F2 | Getting there (trip mode) | `flyMode` flies when the destination centroid is over 700 km away; gateways from `REGIONS.gw`; open jaw re-orders bases on the client (`reverseBases`) | origin OR7 thresholds (6 h, 10 h, 15% hysteresis); server base order with locks kept (TB-E5); Day 1 and last-day cards | data (airports, gateways) | builder | L | Later (F, TB-P4) |
| B-F3 | Interest profile | six regex chips; "First-timer" ranks iconic places first | profile that ranks and never gates (F: enhancement 13), from the type tree | design, data | builder | L | Later (E) |
| B-F4 | Signed-in save and account sync | `localStorage` only; "Sign in to keep it on every device" is text | outbox, `plan_draft`, the merge at sign-in, Mine chips (EM-2, TB-SY) | backend | builder | L | D (EM-2) for copies; builder drafts E (TB-P2) |
| B-F5 | Party from the account | not read; default party in `newState` | `readParty()` seeded by ACCT-P | none | builder | S | FS-1 |
| B-F6 | Copy of a public trip | engine rebuild of `OUR_TRIP.picks` with `fromTrip` chips; "Make it yours" card and convert sheet | template-mode draft that renders the published days for the person's party and dates (versions kept), shape-keeping edits, convert on the first engine action (C1 to C5) | owner (brainstorm Q1, Q2, Q7) | builder (EM-3, ED) | L | Later |
| B-F7 | Shared link, recipient side | none in the builder; the planner's link opens only in the same browser (P-F4) | URL keys with public refs; the recipient rebuilds with their own party and can "Use this plan" (FLOW 6) | none | builder | M | FS-1 |
| B-F8 | Map | schematic SVG (F: builder) | lazy map sheet, list works without it (T2, T5) | **owner**: may FS-1 ship list-only? | builder | M | Later unless the owner says FS-1 |
| B-F9 | Desktop layout | a `?desk` toggle, not breakpoints | frames W0 to W8, WE (wireframes-desktop) | design review TB-R1 | builder, design | M | FS-1 |

### 2.5 Accessibility and mobile gestures

| Id | Gap | Where | Spec | Owner | Size | When |
|---|---|---|---|---|---|---|
| B-A1 | Reorder on touch: HTML5 `draggable` only (`dragstart`, `dragover`, `drop`), which touch browsers do not fire; no handle on phones, no long-press 300 ms, no autoscroll. The item sheet (Move to day, Up and Down) is the working phone path. F: builder 5 | `builder/builder.js` drag block, sheet `item` | components 8.1; FLOW 7.1; brainstorm Q3 | builder (ED) | M | Later (ED) |
| B-A2 | Keyboard: only Esc and Ctrl or Cmd+Z; no Space lift, arrows, PageUp and PageDown; no scoped single-letter keys or `?` list (WCAG 2.1.4). F: enhancement 6 | keydown handler | FLOW 7.1 | builder (ED) | M | Later (ED) |
| B-A3 | Announcements and focus: two `role="status"` regions; no "position 2 of 4" lines, no focus move after Remove, no 6 s "moved" marker under reduced motion | `itemRow`, `A.remove` | FLOW 7.1 rules; edit-my-trip 5.6 | builder | S | Later (ED); stages 0 to 4 announcements FS-1 |
| B-A4 | Sheets: Esc closes and focus returns in some paths only; no focus trap checked; nested sheets (`U.sheets` stack) | `renderSheets`, `closeSheet` | foundation components 5 (overlays) | builder, verifier | S | FS-1 |
| B-A5 | Undo history lives in memory (`HIST`), is reset on open, has no 50-step cap and is lost on reload | `histReset`, `commit` | FLOW 7.1 rules (per draft, per session, 50); brainstorm Q4 | builder | S | Later (ED) |

## 3. Planner (`planner/`)

| Id | What is not real | Where | Becomes product through | Needs | Owner | Size | When |
|---|---|---|---|---|---|---|---|
| P-H1 | Seeded trips (Algonquin, Dolomites, Banff) with item times as fixed strings, park slugs the other apps do not hold (`puez-odle-nature-park`, `tre-cime-nature-park` ...), `by` as days before | `planner/shared.js` `P.seedTrips` | Timeline computed from the document by `scheduleDay` | data | builder | M | Later (planner is priority two) |
| P-H2 | Reality checks with fixed thresholds: over 300 min of driving, ends after 20:30, step-free guessed from the words trail, ridge, hike, summit, a child under 8 and a stop of 4 h or more | `P.checks` | `core/src/checks` day checks, suitability sidecars, opening days | data | builder | M | Later |
| P-H3 | Sun from an approximate formula at latitude 46.5 or 49 by the "abroad" flag. F: planner | `P.sun`, `today.js` | `core/src/sun` at the day's base | none | builder | S | Later |
| P-H4 | Weather is static text. F: planner | `today.js` | a forecast source and a Plan B rule | **owner**: which free forecast source (free tier, terms) | owner, builder | M | Later |
| P-H5 | Money: `P.money` prints "$" in `en-CA` for every amount, so euro costs read as dollars | `P.money` | currency per cost, read date per price (T3) | none | builder | S | Later |
| P-H6 | Packing from words in stop names and the month | `P.packing` | checklist and packing (F09) | design | builder | M | Later |
| P-H7 | Map from random points seeded by the trip id. F: planner | `trip.js` `overview` | the day route map (T5) | none | builder | M | Later |
| P-F1 | The itinerary is read-only in the planner; "Edit plan" goes to the builder (and hits X-1, X-2) | `trip.js` `itinerary` | one editor at `/t/<id>/` (F-Q2) | none | builder (ED) | L | Later (ED) |
| P-F2 | No account and no sync states: no "Syncing", "Not synced · Retry", rebase notice, removal across devices, template-changed notice | all | edit-my-trip 4.4 to 4.7, 5.5 | backend | builder (EM-2, EM-3) | L | D |
| P-F3 | Change dates relabels only: the nights field changes `t.nights` but no day is added or dropped; nothing re-times | `P.addDatesSheet` | brainstorm Q5 | owner (Q5) | builder | M | Later |
| P-F4 | Share link `trip.html?id=..&shared=1` reads the same browser's store, so it opens nothing on another device; `view()` hides `priv` and `stale` items | `P.shareUrl`, `trip.js` `view` | server-rendered shared view, public refs only, "N not public" line (FLOW 6, stage 8) | backend | builder | M | Later (planner); FS-1 for the builder's link (B-F7) |
| P-F5 | Offline is a flag (`st.offline` or `navigator.onLine`); nothing is cached. F: planner | `today.js` | a service worker scope for Mine and Today (T2) | **owner**: offline scope for year one | owner, builder | M | Later |
| P-A1 | Tabs use `role="tablist"` without arrow-key roving; menus use `role="menu"` without arrow keys; day and trip notes write on every keystroke with no debounce | `trip.js`, `index.js` | foundation components 2 and 5 | none | builder | S | Later |

## 4. Parks (`parks-app/`)

| Id | What is not real | Where | Becomes product through | Needs | Owner | Size | When |
|---|---|---|---|---|---|---|---|
| K-H1 | Twelve park entries: three full, one basics, six list-only, Algonquin flagged placeholder; fees, windows and camping rows typed by hand, read "2026-10-27". F: parks | `parks-app/data.js` `PARKS` | park rows per [park-page data-map](../design/park-page/data-map.md); pilot fill (F: enhancement 15) | data | data | L | Later (PA-2) |
| K-H2 | Drive minutes per park typed by hand (`drive: { calgary: 90 }`); `HUBS` only Toronto and Calgary | `data.js` `drive`, `HUBS` | MX hub batch and `modelDrive` bands (driving-time-model 6.2) | data | builder, data | M | Later |
| K-H3 | Map view places pins by scaling lat and lon into a box. F: parks | `index.js` `mapHtml` | map component with honest pins (T5) | none | builder | M | Later |
| K-H4 | Pager is static text "‹ 1 ›"; results are never paged | `index.js` `pager` | pagination at 40 rows (components 8.5, P1) | none | builder | S | Later |
| K-H5 | Save and Favourite write `proto.saved` and `proto.fav`; "Plan a trip from these" opens the builder with `?saved=1` | `app.js`, `park.js` `favs` | Favourites (FAV-2 sync) and "Add to a plan asks which plan" (scenario rule 4) | none | builder | M | Later |
| K-H6 | Plan a visit links point at the builder prototype (`?m=near&n=..&p=`) | `park.js` `actions` | `/plan/` parser fixtures in TB-PIN (15.354) | none | builder | S | FS-1 (inside TB-W1) |
| K-S1 | States exist only as URL controls (month, season data, forced stale, forced closure) | `park.js` `controls` | the states of [park-page states](../design/park-page/states.md), driven by data read dates | data | builder | S | Later |

## 5. What FS-1 needs from this list

FS-1 rows, in build order: X-5, X-6, B-H1, B-E7 (data and API); B-E1, B-E2, B-E9, B-S1 (drive model and its states);
B-E3 (K = 1), B-E5, B-E6, B-H4, B-H5 (engine); B-H2, B-F1, B-F5, X-4 rule (start and party); B-H7, K-H6 (park pin);
X-3, X-7, B-H9, B-H10, B-H11, B-E8, B-E11, B-F7, B-S2, B-S3, B-F9, B-A4 (flow, Review, share, states, layout). All sit
inside planned FS-1 tasks (DT-C, DT-1, DT-L, DT-UI, TB-L, TB-E1, TB-API, TB-W1, TB-R1/V1); this list adds **no hours**.
Owner answers that FS-1 waits on: X-4 (no party in a built draft is decided; the needs field can wait) and B-F8 (may FS-1
ship without a map).

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Created (PROTO-TODO, travel-planner, Opus) from a read of all three prototypes against FLOW, edit-my-trip, trip-builder, account-profile and the driving-time model; overlaps with FINDINGS-2026-10-27 marked "F:" |
