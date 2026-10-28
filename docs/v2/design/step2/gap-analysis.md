# Step 2 gap analysis: what exists, what the designs assume, what must change

Status: **plan, docs only** (27 Oct 2026, travel-planner, Opus, STEP2-PLAN). Read on `main` ee3cd32f. Every "exists"
below was checked in the code named; nothing is assumed from a spec alone. Master plan: [README.md](README.md).

## 1. What is already done (prerequisites Step 2 builds on)

| Piece | State on main | Where | Note |
|---|---|---|---|
| One editable document `plan-draft/1`, template and built modes, rules R1 to R7 | **built** (EM-C, d2776eae) | `core/src/schema/plan-draft.ts`, `core/src/plan/doc.ts` | template block holds `overrides`, `added`, `removed`, `moved`, `days`, `notes`, `maybe`; built mode holds `picks`, `bases`, `edits`, `lastBuild`. No top-level `notes`, no `edits[].placed`, no `identity` yet (TB-C2 not built) |
| Operations with inverses and `rebase` | **built** (EM-C) | `core/src/plan/ops.ts` | `setTitle`, `setDates`, `setParty`, `setVariant`, `setNote`, `setWindow`, `addPlace`, `removePlace`, `moveItem`, `insertDay`, `dropDay`, `addMaybe`, `reset` (a day or all), `deleteEntry`, `restoreEntry`. **All but the first three are template-only** (`TEMPLATE_ONLY`); no built-mode edit op exists |
| Doc limits and sync numbers | **built** | `core/src/config/plans.ts` (`PLAN_DOC_LIMITS`, `PLAN_SYNC`) | device 20, account 50, 16 KB, added 30, removed 40, moved 40, day ops 10, notes 2,000 characters |
| Account table `plan_draft` with `doc`, `kind`, `source_trip`, `start`, `days`, `revision`, `deleted_at`; the rename from `planner_draft` | **built as migrations** 0012 (`account_profile`) and 0013 (`plan_doc`) | `core/src/db/migrations/0012_account_profile.sql`, `0013_plan_doc.sql` | the coordinator's brief says both are applied ("live"); the repo cannot show an apply, so STEP2-GO re-checks before any flag flip |
| Routes `/api/account/plans/**` (list, get, put, delete, merge) | **built** (EM-1, EM-F), behind `NEXT_PUBLIC_ACCOUNT_TRIPS` | `web/app/api/account/plans/**`, `web/lib/server/plans.ts` (extension point X-EM1) | off in production |
| Signed-in Mine sync: cache, outbox, rebase, chips, sign-out question | **built** (EM-2), behind the same flag | `web/lib/mine/sync.ts` (X-EM2), `useSync.ts`, `web/lib/mine/flag.ts` | the merge runs on `/mine/` only; "Keep on this device only" not built |
| A copy opens with its own party; "Your copy" label | **built** (EM-B) | `web/lib/mine/copies.ts`, `rows.ts` (`mine=1` in the query), `partyLogic.ts` | Open still goes to `/trips/<slug>/?...&mine=1`; edits after Open are not saved (G1) |
| Account profile and travellers seeding the device party | **built** (ACCT-PC, P1 to P3) | `web/lib/account/seed-party.ts` | |
| Trip page tabs, Summary, party bar, shape, When to go, Bookings and Photos | **built** (UXB-1 to UXB-4, UXB-6 with fixes) | `web/components/trips/**` | UXB-5 (Table view) and UXB-7 (place pages) not built |
| Scheduler in the browser for party, versions and visitor adds | **built** | `core/src/schedule/schedule.ts` (`scheduleDay`, `scheduleTrip(days, profile, overrides, added)`, `addItem`), `useTimeline.ts` | **no** `removeItem`, `moveItem`, `insertDay`, `dropDay`: `scheduleTrip` takes only overrides and adds |
| Builder contract | **built** (TB-C, 5bf40b20; DT-C) | `core/src/schema/plan-draft.ts`, `core/src/schema/api/plan.ts`, `web/tests/plan/isolation.test.ts` | no `/plan/` route, no engine, no `web/lib/plan/**` yet (FS-1 in bundle D) |

## 2. Per surface

### 2.1 Trip details page, public (`/trips/<slug>/`)

| Concern | Today in `web/` | Prototypes assume | Must change for Step 2 | Package |
|---|---|---|---|---|
| Route | static params, `dynamicParams = false` (`web/app/trips/[slug]/page.tsx`); server HTML | n/a | nothing | |
| Cover actions | `TripActions.tsx`: **Copy to my trips** (primary), Export, Share, heart | builder `?copy=dolomites` makes an engine rebuild of `OUR_TRIP.picks` (TODO B-F6), losing the published days and versions | the copy sheet's commit opens `/t/<id>/?edit=1` instead of the done step (storage blocked keeps the done step) | STEP2-P3 |
| "You have a copy" | nothing | nothing | one lazy line under the cover actions when this device's copies or the account's light rows hold `source_trip = slug`: "You have a copy of this trip · Open it" (dynamic import after hydration; +0 B start JS) | STEP2-P3 |
| Party bar, Version of Day N, Add a place to Day N, Remove (visitor adds) | built; state in the URL (`p`, `pace`, `a`, `walk`, `split`, `d`, `add`) | n/a | **unchanged.** They stay view-state for visitors who never copy (Q96: no `rm=` on public links). The same components gain an injected state source on `/t/` (2.2) | none here |
| `mine=1` marker | EM-B writes `mine=1` into the query from Mine's Open | n/a | `mine=` on `/trips/` redirects on the client to `/t/<id>/` when the id resolves on this device or account; otherwise the plain public page and the existing "not on this device" notice (edit-my-trip 5.5) | STEP2-T1 |
| Print | `TripPrintView.tsx` | planner print | nothing | |

### 2.2 Trip details page, yours (`/t/<id>/`): new

| Concern | Today | Assumed by FLOW and the builder prototype | Step 2 decision | Package |
|---|---|---|---|---|
| Route | none (`web/app/t/` does not exist) | FLOW TF9: `/t/<id>/` with its own editor (Plan grid) | `web/app/t/[id]/page.edit.tsx`: dynamic, `noindex`, `Cache-Control: private, no-store`, no OG image, out of the sitemap; a client shell that reads the document (device store or account) and renders the **same** `TripCover`, `TripPlan`, tabs and panels as `/trips/`. `notFound()` when `tripEdit` is off | STEP2-T1 |
| Where the page model comes from (template) | the public page builds `TripPageModel` on the server (`buildTripPageModel(trip, lookup, listPlaces())`) and hydrates it | the prototype reads `proto.trips` | a public, cacheable `GET /api/v1/trips/{slug}/plan-model` returning the same model the public page embeds (days' scheduler inputs, addables per day, defaults, gallery refs): per trip, through `respond()`, read by a new `DataClient.tripPlanModel(slug)` (P8: one trip, P9: one boundary). The person's delta is applied on the device by the scheduler; nothing private goes to the server | STEP2-M |
| Where the page model comes from (built) | none | the prototype's `fromTrip` drops stops whose id is not a `PLACES` key (TODO X-1) | a pure adapter `tripPageModelForBuilt(draft, rows)` in core maps `lastBuild` (bases, days, items with `startMin`, `visitMin`, `driveMin`) to `TripPageModel`; names, kinds and photos come from `resolveRefs` (exists, 48 refs a call) for the picks only | STEP2-M |
| Cover | public kicker "Published plan · ..." | builder header with identity colour | kicker "Your copy · from our Canadian Rockies trip" (the trip name links to `/trips/<slug>/`) or "Your trip" (built) or "Your trip · from our Dolomites trip" (converted); chips dates or "No date", nights, party words; actions **Edit trip** (primary, OQ2), Add to calendar or Add dates, Export, Share, `⋯` | STEP2-T1 |
| Sticky identity | the public page has none | builder header | the sticky row (tab bar, plan bar or category strip) gains a 32 px identity cell (photo in its identity ring, else the identity square) and the truncated title, plus the sync word at the right (scenario rule 1) | STEP2-T1 |
| Party bar | writes the URL and `travel.party` | builder Start sheet | on `/t/` it writes `setParty` (travellers and profile together, B1) and never `travel.party` | STEP2-T1 |
| Version menu, Add a place, Remove an added place | write the URL | n/a | on `/t/` they write `setVariant`, `addPlace`, `removePlace` through the injected state source (the "bridge" of EM-3, on the new URL) | STEP2-T1 |
| Edit mode | none | builder editor E0 to E7, WE | edit-mode-spec | STEP2-E1 to E6, B2, B3 |
| Default tab | Summary (patterns 3.10) | n/a | Days for Mine's Open (`view=day`, unchanged); Summary for a direct `/t/<id>/` | STEP2-T1 |
| Start-JS budget | the public trip page has under 1 KB headroom | builder `/plan/` 90 KB | `/t/` has its own line, `TRIP_EDIT_JS_BUDGET_KB` in `web/lib/config/product.ts`, measured at STEP2-T1's baseline; the edit chunk is lazy (loaded by Edit trip or `edit=1`) | STEP2-T1, STEP2-E1 |

### 2.3 Builder (`/plan/`)

| Concern | FLOW and prototype | Step 2 decision | Package |
|---|---|---|---|
| Stages 0 to 4 | FLOW stages 0 to 4; prototype `builder/` | unchanged (FS-1, TB-W1) | FS-1 |
| The plan screen (stages 5 to 7) | FLOW: `/plan/?draft=<id>&s=plan` before ED, `/t/<id>/` editor after; Plan grid outline 256 · day 640 · map | **not built.** Build my days goes to `/t/<id>/?edit=1` (ruling R2). TB-W1 loses "the just-built landing in `/plan/?s=plan`" and gains the hand-off (`history.replaceState` to `/t/<id>/?edit=1&built=1`) | STEP2-B1; TB-W1 scope |
| Stage 8 Review and prepare | F8, W8 | becomes the details page: the Summary's state line, Checks, Did not fit, Known costs; the Bookings tab's Book ahead; cover actions | STEP2-B1 |
| Settings after the build | FLOW: sheets for Start, Where, Days and driving, Getting there, Make it yours | the details page's **Settings** sheet (edit-mode-spec 8) mounts the builder's stage components lazily through extension point X10 (`web/components/plan/stages/**` exported for the sheet) | STEP2-B2 |
| Flag | `planBuilder` | `planBuilder` on requires `tripEdit` on (the hand-off has nowhere else to land) | STEP2-B1 |

### 2.4 Park page and place pages (`/places/<slug>`)

| Concern | Today in `web/` | Park design assumes | Must change | Package |
|---|---|---|---|---|
| Save to a trip | `SaveToTrip.tsx`: opens a note "Saving to a trip comes with the planner, which is not open yet" with Copy link and GPX | PN7: the single filled primary on every park page; patterns 3.6: "opens the switcher for signed-in users" | **the trip picker**: a bottom sheet (phone) or side sheet (desktop) titled "Add Moraine Lake to a trip", listing My trips (light rows: identity photo, name, dates; P8, at most 50), each row "Add to this trip"; last row **Start a new trip with Moraine Lake** (`/plan/?p=<slug>`, with `planBuilder`; else not drawn). Choosing a trip goes to `/t/<id>/?edit=1&add=<slug>`, where the add picker opens with the place chosen and the fitting days listed (edit-mode-spec 7.4). No trips: "No trips yet" with Browse trips and Plan a visit (parks) | STEP2-P1 |
| A park in a trip | not modelled | R1 (TB-PIN): a protected-area pick is the trip's area, never a stop with a visit time | Save to a trip on a **park** page names it "Add places in Banff to a trip"; the add picker opens filtered to the park's members (`within=<slug>`, the existing facet once EG-Q ships; until then the trip's stops at that base and the nearby rows). The park itself is never added as a stop | STEP2-P1 |
| "In your trips" | the place page has "In <trip> · Day n" for public trips (`PlaceContext.inTrips`, data-map "In public trips") | patterns 3.6: "In Dolomites · Day 3" card, signed in, when planned | a lazy line "In your copy of Canadian Rockies · Day 5" or "In your trip Dolomites": computed on the device from (a) My trips light rows' `source_trip` ∩ the page's public `inTrips` (days from our plan) and (b) documents already cached on this device. **Never fetches a document** (P8, P9). Marked "≈ your copy may differ" when only (a) applies | STEP2-P1 |
| Plan a visit | not built (PA-2) | four links into `/plan/` | unchanged; ships with PA-2 after G-PA | PA-2 |
| Heart | built | | unchanged: a heart never adds to a trip; Save to a trip never adds a favourite (patterns 3.9) | |

### 2.5 Parks index (`/parks`)

Nothing in Step 2: the index has no trip action (PN14). Its rows link to park pages, which carry Save to a trip. PA-IX
builds it after G-PA.

### 2.6 Mine (`/mine/`)

| Concern | Today | Must change | Package |
|---|---|---|---|
| Lists | one My trips list from `travel.copies.local` (`copies/1`) and, signed in with the flag, the account rows | one device list for copies and plans: `travel.copies.local` moved once into `plan-drafts/1` under `travel.plans.local` (EM-5 folded); the builder's separate "My plans" tab (X6) is not built (ruling R8) | STEP2-P2 |
| Row Open | `/trips/<slug>/?...&mine=1` (`rows.ts`) | `/t/<id>/?view=day` when `tripEdit` is on; unchanged when off | STEP2-T1 |
| Row menu | Open · Add to calendar · Print · Change dates · Remove (`CopyRow.tsx`) | adds **Edit** after Open (`/t/<id>/?edit=1`) | STEP2-P2 |
| Draft chip | none | a built draft with no build reads "Draft · ready to build" and opens `/plan/?draft=<id>&s=4` (FLOW TF13, TF14) | STEP2-P2 |
| Converted copy label | n/a | "Dolomites · your trip · from our Dolomites trip" (FLOW C5) | STEP2-B3 |
| Empty state | "No trips copied yet" | "No trips yet · Copy one of our trips or plan your own. It stays here." with Browse trips and Plan your own trip (with `planBuilder`) | STEP2-P2 |

### 2.7 Planner Today and print

| Concern | Prototype | Step 2 | Package |
|---|---|---|---|
| Print of your own trip | planner `print.html` | `TripPrintView` with the trip's own title, party words and "Your copy of ..." line; same sections as the public print (patterns 3.10 item 8) | STEP2-E6 |
| Calendar | planner `ics.js` timed events | the existing per-trip ICS export, fed by the person's timelines (dates, party, delta); book-by events from `core/src/bookings` | STEP2-E6 |
| Today view | planner `today.html` | **later** (F13): not in Step 2 | |

## 3. What the details page must change to host edit mode

| # | Change | Files (today) | Why |
|---|---|---|---|
| H1 | An **injected state source** for the timeline: `useTimeline` reads and writes through a `TimelineSource` interface (URL source on `/trips/`, document source on `/t/`); the URL source is today's code moved, byte for byte in behaviour | `web/components/trips/timeline/useTimeline.ts`, `TripPlan.tsx` (one prop) | one renderer, two sinks (edit-my-trip 8: "an injected state source, not a rewrite") |
| H2 | The scheduler takes the whole template delta: removed, moved, inserted and dropped days | `core/src/schedule/schedule.ts` (new `removeItem`, `moveItem`, `insertDay`, `dropDay`; `scheduleTemplate`) | delete any stop, move, days |
| H3 | `Entry.tsx` gains two slots: a leading handle slot and a trailing `⋯` slot, both empty in read mode and on `/trips/`; `DayTimeline.tsx` gains a day-header `⋯` slot and the add-row slot | `web/components/trips/timeline/Entry.tsx`, `DayTimeline.tsx`, `AddToDay.tsx` | edit chrome is mounted only in edit mode, from a lazy chunk |
| H4 | Remove is offered on **every** stop in edit mode, not only `addedBy === 'visitor'` | `Entry.tsx` (the `onRemove` condition) | the owner's requirement |
| H5 | Marks on an entry ("Added by you", "Moved from Day 3", "From our trip", "Kept on Day 4") read from the document, shown in read mode too | `Entry.tsx` (a mark slot; the words come from `web/lib/trip-edit/marks.ts`, new; the existing `timeline/marks.ts` is the time-zone helper and is not touched) | Q-BE1 inline marks |
| H6 | A status area above Day 1 and in the Summary: changes line, "We updated this trip", just-built line, Make it yours card, rebase notice | `TripPlan.tsx` (slot), `summary/Summary.tsx` (slot) | edit-mode-spec 10, 11 |
| H7 | Warnings at two levels on the day header and a count in the sticky row | `DayTimeline.tsx`, `PlanBar.tsx` | Q-BE6 |
| H8 | The sticky row carries identity and the sync word on `/t/` | `PlanBar.tsx`, `tabs/OverviewTabs.tsx`, `CategoryStrip.tsx` | scenario rule 1 |
| H9 | Stops panel rows gain "Add to Day n", "Remove from the trip" and "Move to day…" in edit mode | `tabs/StopsPanel.tsx`, `CategoryView.tsx` | edit-my-trip 5.4 step 5 |
| H10 | The Table view stays read-only; in edit mode the Days segment switches to List with a line "Editing works in List" | UXB-5 files | one editing surface |

All of H1 to H10 are slots or one-line conditions in the shared files; the edit UI itself lives in
`web/components/trips/edit/**` and `web/lib/trip-edit/**`, loaded only on `/t/`.

## 4. Data contract changes

| # | Change | Kind | Where | Package |
|---|---|---|---|---|
| D1 | `plan-draft/1` gains, optional, before the first draft is stored: top-level `notes` (built mode; template keeps `template.notes`), `edits[].placed` and `edits[].fromTrip` (refs placed by the person, refs placed from our trip at conversion), `identity`, `driveDayMin`, near `where.regions` (TB-C2's keys), and `convertedAt` (the conversion's time, for Mine's label) | widen `/1` (allowed until stored) | `core/src/schema/plan-draft.ts` | STEP2-C1 (absorbs TB-C2) |
| D2 | Built-mode operations with inverses: `moveItem` (built form: `edits`), `addPick`, `removePick`, `swapItems`, `replacePick`, `lock`, `unlock`, `release`, `setMust`, `insertDay` and `dropDay` (built), `moveDay` (built, inside one base's run), `setNote` (built), `setPace`, `setBase` and `setNights` (engine inputs, Apply line), and `convert` (template → built in place; inverse restores the template block) | new ops | `core/src/plan/ops.ts` | STEP2-C1 |
| D3 | Warning levels: a table `WARN_LEVEL` mapping each day-check and builder code to `fix`, `check` or `hidden` (author-only data codes) | new table | `core/src/plan/warnings.ts` (new) | STEP2-C1 |
| D4 | A new day-check code `W_NO_ROUTE` (no road between two stops on the drive model) with its fixture | new code | `core/src/checks/codes.ts`, `core/test/fixtures/warn/W_NO_ROUTE.json` | STEP2-C2 |
| D5 | `scheduleTemplate(model, template, profile)` applying overrides, added, removed, moved and day ops to the published days; `removeItem`, `moveItem`, `insertDay`, `dropDay` | new functions | `core/src/schedule/**` | STEP2-C2 |
| D6 | `GET /api/v1/trips/{slug}/plan-model` (public, cacheable by the catalogue revision, no household data) and its Zod shape | new public route | `core/src/schema/api/trip.ts`, `web/app/api/v1/trips/[slug]/plan-model/route.ts`, `web/lib/client/{contract,api,static,stub}.ts`. Built (STEP2-M): not a `CatalogueStore` method; the `respond()` entry runs `web/lib/server/planModel.ts`, which asks the store's `getTrip` for the trip (moved, unknown) and the revision, then builds with the page's own `buildTripPageModel`; the OpenAPI path is added in `core/src/catalogue/openapi.ts` beside the contract's; the static adapter answers null | STEP2-M |
| D7 | `tripPageModelForBuilt(draft, rows)` | new pure adapter | `core/src/plan/pageModel.ts` (new, inside the builder fence; read through X-S2). Built (STEP2-M) as `tripPageModelForBuilt(draft, rows, { tz })`: resolve rows carry names and kinds but no photos or points, so a built model has no thumbs, gallery, map points or addables (the route counts its stops as unplaced); day-check codes stay on `lastBuild` for E5 | STEP2-M |
| D8 | **`trip-custom/1` retired**: deprecated in place by EM-C; nothing stores it. Step 2 adds no reader. CUS, STY and REQ specs read "the template block of `plan-draft/1`" | none (record only) | `core/src/schema/trip-custom.ts` (unchanged) | |
| D9 | Template versus built mode: unchanged rule (`planModeOf` by the `template` key). Built ops refuse a template draft (`mode`), template ops refuse a built draft; `convert` is the only bridge | rule | `core/src/plan/ops.ts` | STEP2-C1 |
| D10 | Device keys: `travel.copies.local` moved once into `travel.plans.local` (`plan-drafts/1`, cap 20 for both, Q-EM12); the undo stack in `sessionStorage` under one key per trip, named in `web/lib/trip-edit/keys.ts` (the one keys file of the new folder, listed in `web/lib/storage/keys.ts`'s index comment) | device | `web/lib/mine/**`, `web/lib/plan/keys.ts` (builder's keys file, X-point), `web/lib/trip-edit/keys.ts` | STEP2-P2, STEP2-E1 |
| D11 | No database migration in Step 2: the document lives in `plan_draft.doc` (jsonb); `kind`, `source_trip`, `start`, `days` already exist | none | | |
| D12 | Isolation: extension point **X-S2**, `web/lib/trip-edit/**` may import `core/src/plan/ops.ts`, `sync.ts`, `doc.ts`, `pageModel.ts`, `warnings.ts` and `plan-draft.ts`; it is a lazy chunk loaded only on `/t/`. **X10** (FLOW TF9) is re-pointed: `web/components/trips/edit/settings/**` may import `web/components/plan/stages/**` | fence | `web/tests/plan/isolation.test.ts` `EXTENSION_IMPORTERS` | STEP2-C1 |

**As built (STEP2-C1, 28 Oct 2026).** D1, D2, D3, D9 and D12 are in `core/src/schema/plan-draft.ts`, `core/src/plan/ops.ts`,
`core/src/plan/warnings.ts`, `core/src/config/plans.ts` (`PLAN_EDIT`) and `web/tests/plan/isolation.test.ts`. Differences from the
rows above, all optional keys of `/1`: `picks[].added` (true for a pick the person added after a build or a conversion: the built
"Added by you" mark needs it); `opLog` (built mode: the last `PLAN_EDIT.builtOpLog` = 64 operation ids, so a resend after a lost
answer is skipped instead of applied twice; template entries already carry their ids); a template drop's `to` (the day its stops
move to; the Maybe choice is `addMaybe` entries in the same step); template stop notes keyed `<day>:<item>` for a published stop
and by the entry's operation id for an added place; built notes keyed `trip`, a day or a pick's ref. Operations beyond D2:
`setOrigin`, `setWhere`, `setDriveDay` (edit-mode-spec 8), `setBuild` (a build or re-flow result, so Rebuild has Undo),
`setIdentity`, `setRev` (11.3 "OK records the new rev"), `toTemplate` (the inverse of `convert`, and "Reset to our plan" on a
converted trip), and the inverse form `restoreFields`. `builtDays(draft)` in ops.ts is the one placement rule (an `edits` entry where
a day has one, else the last build) for STEP2-M and STEP2-B2. `convert` sets `seed` to our trip; `planRowFields`
(`core/src/plan/doc.ts`, not in C1's paths) still derives `source_trip` from `template.trip` only, so a converted row's `source_trip`
reads null until STEP2-B3 (or a doc.ts follow-up) reads `seed` when `convertedAt` is set. (Fixed in STEP2-C2: `planRowFields` reads
`seed` when `convertedAt` is set.)

**As built (STEP2-C2, 28 Oct 2026).** D5 is `core/src/schedule/template.ts`: `scheduleTemplate(days, delta, profile)` with a plain
`TemplateDelta` in `core/src/schedule/types.ts` (the template block's lists; an added place carries its resolved `ScheduleItem`), and
the day functions `editDay`, `removeItem`, `moveItem`, `insertDay`, `dropDay`, `stopsOf`. Differences from D5 and the brief: the
day functions live in `template.ts`, not `schedule.ts`, because the page entry (`browser.ts`) had 113 bytes left under its 13 kB cap;
`schedule.ts` gained one hook only (`ScheduleOptions.selection` and `visitor`, +33 bytes). The version is chosen from the published
versions before any edit, so a removal never swaps the version; the fit is re-read after. Generated ids keep the published day
number (an inserted day takes a number after the last published day; `TemplateDay.n` is the number to show), so ids a delta names
survive inserted and dropped days. An added place with no `after` is placed by cheapest insertion, as today (the schema text says
"the end of the day"); a moved stop with no `after` goes to the start. A dropped day's stops go to the end of `to` (a visitor's
cheapest-insertion additions are placed that way again); the parallel lane of a dropped split day goes with the day. An entry that
cannot apply is returned in `skipped` (`no-day`, `not-on-day`), not thrown. **D4 (`W_NO_ROUTE`) is not built:** the day checks in
`core/src/checks/days.ts` would have to raise it for the fixture to pass `codes.test.ts` (which also pins 16 codes), and nothing in
the data says "no road" (the drive model and `StoredLeg` have no such answer); it needs `days.ts`, `core/test/fixtures/make.ts` and
`core/test/checks/codes.test.ts` in a package's paths and a definition of the condition. The level stays pending in
`core/src/plan/warnings.ts`.

## 5. Pending trip-page enhancements: in Step 2, later, or dropped

Every open item that touches the trip details page or its rows, with its id and a ruling.

| Id | What | Ruling | Reason |
|---|---|---|---|
| UXB-5 (15.282, R-264) | Table view of each day | **In Step 2, before STEP2-E1** (unchanged scope, 6 h as briefed) | same Days panel; doing it after edit mode means a second pass over the day components. Table stays read-only (H10) |
| UXB-R1, UXB-V1 (15.284) | review and verify of the trip page round | **In Step 2, before STEP2-E1** | closes the round edit mode builds on |
| UXB-F (15.287) | fixes from the four reviews, including UI-NOTES "Fits age 0" wording | **In Step 2, before STEP2-E1** | the marks and chips edit mode adds sit beside these strings |
| UXB-7 (15.285, R-265) | place pages show what is known | **Not Step 2** (bundle C, unchanged); it precedes PA-2 | not the trip page; Step 2 only changes Save to a trip on place pages (STEP2-P1), which mounts beside it |
| R59-N, R59-C, R59-1 (15.225, R-59) | visible stop actions (Map: Interlakes Trail, Directions, AllTrails), day route at each day header | **In Step 2, serial with STEP2-E1 on `Entry.tsx`**; whichever starts first, the other rebases. R59-N's note adopts edit-mode-spec 4 (the stop row anatomy) | both define the stop row; visible read-mode actions stay visible in edit mode, edit actions go into `⋯` |
| R59-3C, R59-3 UI | base-aware day routes when a base changes | **Later, with STEP2-B2** (a base change is an engine action) | needs `setBase` |
| ORG-1, ORG-2 (origin spec) | getting there on Day 1 and the last day | **Later** (bundle F, TB-P4); Step 2 reserves the Day 1 and last-day card slot (H6) | needs airports and the origin ladder |
| OVR-1 | When to go window choice changes the plan | **Later** (v0.12); `setWindow` exists in ops; the Settings sheet shows it only when the trip has windows | data D7 |
| OVR-2 | Stops filters with live counts | **Later**; edit mode uses the current Stops panel | read-mode enhancement |
| OVR-3, PHO-R | thumbnails and record photos | **Later**; marks never depend on photos | |
| "See all 13" highlights (UI-NOTES UXB-1F) | restore after OVR-2 | **Later**, with OVR-2 | |
| Q307 Summary photo strip (UI-NOTES UXB-6F) | fewer than 6 photos | **Dropped** | no public trip has 1 to 5 photos |
| Q305 print order (UI-NOTES UXB-6F) | Book ahead after the days in print | **In Step 2, inside STEP2-E6** (print of own trips touches the same model) | one print model |
| PA-W 15.291b | `placeSlug` on booking rows | **Later** (data, PA-W) | |
| STY-1 | Where to stay tab | **Later** (v0.13), unchanged | read-mode tab |
| STY-2, STY-2C | signed-in base tweaks on a copy (template `stays` op) | **Dropped as specified; replaced** by convert-then-`setBase` (ruling R10, OQ6) | one base-change path |
| CUS-C | `trip-custom/1` columns | **Superseded** by EM-C and 0013 (done) | |
| CUS-1, CUS-2, CUS-R, REQ-E UI, REQ-E-C (15.173) | customise flow and copy edits | **Folded into STEP2-C2 and STEP2-E1 to E6** | |
| EM-3, EM-RV (15.352) | the bridge on `/trips/` | **Superseded** by STEP2-T1 (ruling R3) | |
| EM-4 (15.352), ED (FLOW 9), TB-W3 editor half | the editor | **Superseded** by STEP2-E1 to E6, B2, B3 | |
| EM-5 (15.352) | one device list | **Folded into STEP2-P2** | |
| REQ-P, REQ-S, REQ-L | stops we do not have (`custom`), signed in | **Later** (bundle G) | `custom` is left to `plan-draft/2` (EM-C note) |
| TD-2 | trip pages from `data/trips/` | **Later**, independent | the plan-model endpoint reads the same adapter whatever its source |
| FAV "Favourites (n)" pill (UI-NOTES FAV-1) | | **Dropped** (as the note says) | |
| X6 "My plans" Mine tab | | **Dropped** (ruling R8) | |
| "Keep on this device only" (EM-2 not built) | | **Later**, if asked | no evidence anyone needs it |
| Today mode, packing, reminders (F13, F09) | | **Later** | not part of create or edit |

## 6. Prototype gaps this plan closes or carries

From [prototypes/TODO.md](../../prototypes/TODO.md); only rows Step 2 owns.

| Row | Gap | Step 2 |
|---|---|---|
| X-1, X-2 | two document shapes; the builder overwrites the planner's fields | one document, ops never rewrite fields they did not change (STEP2-C1); the prototype round STEP2-PR reads and writes one shape |
| B-F6 | a copy rebuilt by the engine | template mode renders our plan (STEP2-T1); Q-BE1 |
| B-A1 to B-A3, B-A5 | touch drag, keyboard lift, announcements, undo history | STEP2-E1, E2 |
| B-S4 | conflict, newer document, paused, a placement that no longer fits | STEP2-E1 (sync states), STEP2-B2 |
| P-F1 | itinerary read-only in the planner; Edit plan hits X-1 | one page with edit mode |
| P-F2 | no sync states | STEP2-E1 header word over EM-2's engine |
| P-F3 | Change dates relabels only | edit-mode-spec 9.2 (ask where days go) |
| K-H5 | Save and Favourite in the parks prototype | STEP2-P1 |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Created (STEP2-PLAN, travel-planner, Opus) |
| 2026-10-28 | "As built" note under section 4 (STEP2-C1): the extra optional keys and operations, and the `source_trip` follow-up |
| 2026-10-28 | "As built" note under section 4 (STEP2-C2): `scheduleTemplate` and the day functions; D4 `W_NO_ROUTE` not built, and why |
