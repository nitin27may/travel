# L3c: trip timeline and party profile

Wave 3. It runs in parallel with L3b (trip tags and filters), L2b (globe) and L4b (trail tracks).
- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 24 hours, in four parts:
  - core scheduler, 8 h
  - data and adapter, 6 h
  - UI, 8 h
  - copy and ICS, 2 h
- **Spec:** [features/trip-timeline.md](../../features/trip-timeline.md). Section numbers below refer to it.
- **Design:** [design/trip-page/timeline-design.md](../../design/trip-page/timeline-design.md) (Fable). Layout, spacing and motion come from it; the data and the rules come from the spec.
- **Starts after:** L3 is merged (done, 49e8280) and the stage 2 integration pass.

## Goal

The public trip page becomes a timeline at two levels, for a party chosen once at the top:

1. **A profile selector** at the top: Adults, or Family with the youngest's age; Relaxed, Standard or Full. It replaces the per-day Track A · B · C segment.
2. **A whole-trip timeline**, Day 1 to N. Each day shows its span, variant, drive share and warnings.
3. **A per-day timeline** of typed entries with times. Each time shows its confidence (fixed, anchored or suggested) and its source. There are legs, meals, breaks, rest, check-in and sun markers.
4. **Times from a pure, tested scheduler in `core/src/schedule/`**, plus authored overrides stored as data. The Dolomites and the Rockies get real schedules. The six summary trips get rule-based schedules labelled suggested.
5. **Per-day overrides and "Add to this day"**, with re-flow, all in URL state. Both carry into Copy and into the ICS of a dated copy.
6. **Clean public prose:** no INFERENCE, CALC or GAP markers; units in prose follow the preference; long notes become "Know before you go".

## Read first

- The spec, all of it. Sections 1.2 (types), 2.3 to 2.11 (rules and validation), 3 (profile), 5 (prose) and 6 (edge cases) are the contract.
- `core/src/checks/days.ts`, `codes.ts` and `time.ts`: reuse `toMin`, `fmtMin`, `fmtDuration`, `haversineM` and `PACE_MIN`. Do not copy them.
- `core/src/sun/index.ts` (`sunDay`). `core/src/schema/trip.ts`: `items`, `day_tracks` and `profile`, for the planner mapping.
- `web/lib/public/trips.ts` (the Rockies and Dolomites day builders, `parseDriveMin`), `types.ts`, and `dateless.ts` (`DATE_TEXT`, `sunRange`).
- `web/components/trips/TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `useTripUrl.ts`, `model.ts`.
- `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts`, and `web/components/actions/CopySheet.tsx`.
- `prototype/src/lib/geo.ts`: the straight-line leg rule, to port.
- `legacy/canadian-rockies-sept-2029/data/itinerary.json`, `trails.json`, `sights.json`, `adventures.json`, `bases.json`.
- [public-trips-dateless.md](../../design/public-trips-dateless.md). [README.md](README.md) sections 4.2 (working rules) and 8 (gotchas).

## Files you own

| Area | Paths |
|---|---|
| Core scheduler | `core/src/schedule/**` (new), `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts` (new) |
| Schedule data | `data/schedules/**` (new): `<slug>.json` overrides, `legs/<slug>.json` ORS cache, `README.md` with the `trip-schedule/1` and `trip-legs/1` schemas |
| Legs script | `web/scripts/legs-ors.mjs` (new) |
| Adapter, timeline part | `web/lib/public/timeline.ts` (new), `web/lib/public/prose.ts` (new), and the day-building code in `web/lib/public/trips.ts` (the `days`, `bases` and `categories` sections). Additive fields only in `web/lib/public/types.ts` and `honesty.ts` |
| Trip page | `web/app/trips/[slug]/page.tsx`, `web/components/trips/timeline/**` (new), `web/components/trips/TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `StopStats.tsx`, `TripRouteMap.tsx`, `useTripUrl.ts`, `model.ts`, `web/styles/timeline.css` (new) |
| Copy and ICS, for wave 3 | `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts`, `types.ts` (additive), `web/components/actions/CopySheet.tsx` (traveller prefill only) |
| Tests | `web/tests/trips/timeline*.test.ts`, `web/tests/data/prose*.test.ts`, `web/tests/e2e/trip-timeline*.spec.ts`; in `web/tests/e2e/trips.spec.ts`, `trips.shots.spec.ts` and `web/tests/trips/trips.test.ts` only the **trip page** `describe` blocks |

## Do not touch

- **L3b:**
  - `web/app/trips/page.tsx`, `web/app/trips/rows.ts`, `web/app/trips/layout.tsx`
  - `web/components/trips/types.ts`, `TripsMap.tsx`, `TripCover.tsx`, `web/components/trips/tags/**`
  - `web/lib/entities/descriptors/trip.tsx`, `web/styles/trips.css`, `data/vocab/tags.json`
  - the list `describe` blocks in the trips tests

  L3b computes tags in its own `web/lib/public/tags.ts` and calls it from `index.ts`. It does not edit `trips.ts`.
- **L2b:** `web/lib/globe/**`, `web/components/globe/**`, `web/styles/globe.css`, `web/public/globe/**`.
- **L4b:** `web/components/places/**`, the trail code in `web/lib/public/places.ts`, track data.
- **L0:** `web/components/ui/**` and `web/components/entity/**`. Ask in the hand-back; new icons go in `web/components/trips/timeline/icons.tsx`.
- `web/lib/map/**`: additive only, listed in the report.
- `format.ts`, `SeasonBand.tsx`, `TripEnd.tsx`, `TripActions.tsx`, `LazyGallery.tsx`: read only.
- `legacy/`, `prototype/`, `core/src/checks/**`, `core/src/schema/**`: read only.

## Steps

### Part 1. The core scheduler (first, before any UI)

1. **Types and rules.**
   - `core/src/schedule/types.ts`: exactly spec 1.2 and 3.2.
   - `rules.ts`: the duration table 2.3, the multipliers 2.4 and the meal windows 2.6, each with its `id`.
   - `legs.ts`: the ladder 2.5 and the straight-line rule from `prototype/src/lib/geo.ts`.
   - `sun.ts`: season-window ranges with `sunDay`.

   - `suitability.ts`: the `Suitability` contract from spec 3.11, with null-safe reads.
   - The types carry `origin`, `leave-home`, `at-home` and the home-by window from spec 3.12. The code `S_HOME_BY` is included, with a fixture: a Niagara-like day trip with a home-by of 21:00.

   No I/O, no `Date.now`, no locale.
2. **`select.ts`:** `selectVariant(day, profile)` per spec 3.3. It returns `{ variant, parallel, fits, reason }`.
3. **`schedule.ts`:** `scheduleDay(input, profile, overrides)` and `scheduleTrip(...)`. Follow the ten steps in spec 2.9: pins, back-solved start, forward pass, meals, back-pressure, close, round, totals. `addItem(...)` uses cheapest insertion.
4. **`validate.ts`:** the codes in spec 2.11. **`toItems.ts`:** maps a `DayTimeline` to planner `items` rows.
5. **`profileCodec.ts`:** parses and serialises the URL keys in spec 3.8, in key order. Invalid values fall back to the default.
6. **`core/bin/schedule.ts`:**
   - Command: `node core/bin/schedule.ts --input <scheduleInput.json> --day 5 --profile family-6 --pace standard [--json]`
   - It prints the day as a table: time, confidence, lane, kind, title, duration, source.
   - It is the review tool for overrides.
7. **Tests** (`core/test/schedule/`, vitest). Fixtures are JSON inputs under `core/test/fixtures/schedule/`:
   - **Golden fixtures:**
     - Rockies Day 5 for `family-6 standard` matches spec 1.4 entry by entry (times within ±5 min, kinds, lanes, the `S_DAY_CAP` warning);
     - Rockies Day 5 for `adults full` is Track A and has no split row;
     - Dolomites Day 3 keeps the 11:30 authored slot and the 16:30 Cadini time.
   - **Determinism:** the same input run twice gives a deep-equal result. The input order is preserved for authored items.
   - **Pins:** a fixed entry never moves. Back-pressure drops a generated coffee before it raises `S_FIXED_MISSED`.
   - **Each validation code** has a fixture that raises it and one that does not.
   - **Selection:**
     - `family-14` gets A where A fits;
     - `family-3` gets `fits: false` with the reason naming the walk;
     - relaxed falls to C when B is over the relaxed budget.
   - **Legs:** the ORS cache wins over the plan, the plan over the matrix, the matrix over the estimate. The estimate equals the prototype rule for three pairs.
   - **Meals:** lunch lands inside the window; a trail spanning the window gives an on-trail lunch with `insideOf`; dinner sits at the base.
   - **Sun:** Jasper's sunset range for 8 to 22 Sep is 19:54 to 20:28 (±2 min against `core/bin/sun.ts`). The Norway June fixture gives `no-sunset` and no `W_DAYLIGHT`.
   - **Planner parity:** for each fixture, `checkDays(toItems(timeline))` raises every `W_` code that `validate` raises.
   - **Codec:** round trip; key order; garbage falls back to defaults.
   - **Size:** the bundle of `core/src/schedule` (esbuild, minified, gzip) is under 12 kB.

### Part 2. Data and adapter

8. **`data/schedules/README.md`:** the schemas `trip-schedule/1` (spec 2.10) and `trip-legs/1` (from, to, mode, km, minutes, profile, fetched as an ISO date in the file header only, attribution).
9. **`data/schedules/canadian-rockies-2029.json`:**
   - Lift the authored times out of the track notes and the `rejoin` text for all 15 days: starts ("Leave Jasper 07:30"), slots ("Book a 10:00 cruise", the Moraine shuttle 06:30), rejoins, and last rides ("last ride up 19:30").
   - Use a throwaway helper script outside the repo, if you like. The committed file is hand-checked.
   - Set the variant labels and the default profile (`family`, 6, standard, 2 adults).
   - Mark optional items ("if the child wants more").
   - List in the hand-back every time you could not place.
10. **`data/schedules/dolomites-2027.json`:**
    - slots (Tre Cime toll road, Seceda lift);
    - sun anchors (Braies at first light);
    - the Day 4 A/B variant audiences;
    - `defaultProfile` (adults or family, from the prototype trip's party; check the allow-list: **no traveller names or ages from the household data**; use the plan's stated audience).
11. **`web/scripts/legs-ors.mjs`:**
    - It reads `ORS_API_KEY` from the environment and loads `web/.env.local` if needed. It sends the key only as the `Authorization` header and never prints, logs or writes it.
    - It runs sequentially, at most 30 requests a minute, with `driving-car`, or `foot-hiking` for walk legs under 1.2 km straight-line.
    - Input: the Dolomites consecutive item pairs with coordinates. Output: `data/schedules/legs/dolomites-2027.json`.
    - `--check` fails when a pair is missing. The build never calls ORS.
    - Run it once.
12. **`web/lib/public/timeline.ts`:** builds `PublicDay.variants` and `PublicDay.scheduleInput` from the trip sources and `data/schedules/<slug>.json`.
    - Dolomites: items with times and durations, place points, base points, legs from the cache.
    - Rockies: tracks become variants with relation from `needs_split`; trail `km`, `gain_m` and `hours`; sight `time_needed_hours`; adventure `min_age` and `child_6yo_ok`; per-leg minutes from the `drive` text (out and back); the base matrix.
    - Summary trips: one `main` variant from the stops' `durationMin`, and the day `driveMin` split evenly over the out and back legs (≈).

    Then call `scheduleTrip` for the default profile into `PublicTrip.schedule`. Additive types: `DayVariant`, `ScheduleInput`, `PublicTrip.schedule`. New `HonestyId`s: `estimate`, `not_known`, `sources_disagree`, `low_confidence`.
13. **`web/lib/public/prose.ts`:**
    - markers become chips (spec 5.1);
    - quantity runs (5.2), with the name allow-list;
    - Know before you go grouping (5.3).

    Run it over every public string the adapter emits: titles, summaries, notes, `decision_rule`, `wet_weather`, `status_flags`, booking notes. Item and day notes become `ProseRun[]` plus `chips` plus `knowBefore`.
14. **Tests** (`web/tests/data/prose*.test.ts`, `web/tests/trips/timeline*.test.ts`):
    - The marker sweep: no adapter string for any trip matches `/\b(INFERENCE|CALC|GAP)\b|low confidence/`.
    - The quantity parser on 20 real Rockies strings: "1.9 km", "500 m" as elevation, "Highway 93" unchanged, ranges.
    - Know before you go on Rockies Day 5: the groups and their order.
    - Every `data/schedules/*.json` validates, has no calendar date (`DATE_TEXT`), and every key resolves to an item or a place.
    - The default timelines exist for the 8 full and summary trips and none for the 6 overview trips.
    - The privacy test (`web/tests/privacy.test.ts`) still passes with the new fields.

### Part 3. The trip page UI

15. **`useTripUrl.ts`:** add the profile keys through `core/src/schedule/profileCodec.ts`. Keep `view` and `#day-N`. Profile changes push history, so Back restores them.
16. **`timeline/ProfileBar.tsx`** (spec 3.1):
    - Adults or Family with a youngest-age stepper; pace segment; "More" with adults, longest walk and split.
    - The summary line with the day counts and "Written for ...", and Reset.
    - Phone: the summary line plus Edit, opening an inline panel (not modal).
    - Hidden on overview trips.
17. **`timeline/TripTimeline.tsx`:** the whole trip, Day 1 to N. Each item shows the day number, base, span bar (start to end on a common 05:00 to 23:00 scale), variant chip, drive share, warning mark and "changed" mark.
    - Tapping a day scrolls to it and writes `#day-N`.
    - On a phone it becomes the vertical list of day rows (the old collapsed `DayRow` content plus the span bar).
18. **`timeline/DayTimeline.tsx` and `Entry.tsx`:**
    - The day header (spec 3.10), the variant chip menu (3.6) and the warnings count.
    - Entries in order, with legs as connectors showing minutes, ≈ and the mode.
    - Meals, breaks and rest as compact rows; sun markers in the time gutter.
    - The three time styles with the 1.3 wording.
    - The expanded entry: notes as `<Prose>`, Know before you go, the place link, the sources of the time and duration, alternatives.
    - Split days: the split option row; with `split=1`, two lanes (layout from the design page; on a phone, stacked lanes with a lane toggle).
    - No-fit days: the chip and the first-row explanation (3.5).
19. **`timeline/AddToDay.tsx`** (spec 3.7):
    - Candidates come from the day's other variants, the trip's places on that base, and `listPlaces()` within 30 km. Pass a pre-filtered candidate list per day from the server, not the whole catalog.
    - It calls `addItem` and highlights the diff (added, moved by N min, new warnings).
    - Remove is per added item.
20. **Wire it into the page.**
    - `TripPlan.tsx`: the order is the banner (2.12), ProfileBar, TripTimeline, then the days. Remove the Track A · B · C segment from `DayRow.tsx`.
    - `CategoryView.tsx` day signs use the timeline's time for the current profile ("Day 5 · 10:00").
    - `TripRouteMap.tsx` highlights the picked day's entries in order.
    - The page renders the default profile on the server and re-runs `scheduleTrip` on the client only when the URL profile differs.
21. **`web/styles/timeline.css`:** tokens only (the no-hex test). Nothing amber at rest except the focused day sign and route-pick (L3 check 7).

### Part 4. Copy and ICS

22. **`draft.ts`:** `CopyDraft` gains `profile`, `overrides` and `added` (spec 3.9). Old drafts without them still load.
23. **`CopySheet.tsx`:** prefill the travellers from the profile. Editing the children's ages updates the page's profile (the youngest). No other change to L5's sheet.
24. **`build.server.ts` and `ics.ts`:**
    - The export for a dated copy takes the chosen profile's timelines.
    - Timed VEVENTs per spec 3.9, with "Fixed slot", "Suggested time" or "Sun-timed" plus the source at the start of each description.
    - Sun-anchored events are recomputed for the real date with `core/src/sun`.
    - "Full detail" adds breaks and rest.
    - Overview trips are unchanged.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | `core/test/schedule` passes, including the Rockies Day 5 golden fixture and determinism; `node core/bin/schedule.ts` prints Day 5 as in spec 1.4 | spec 1.4, 2.9 |
| 2 | Every full and summary trip page shows the profile bar, a whole-trip timeline and per-day timelines with times; overview pages show none of them and keep their banner | spec 3.1, 6 |
| 3 | `/trips/canadian-rockies-2029` defaults to `family-6`: B on each day, a split option on the 7 split days; `?p=adults` gives A on every day that has one; `?p=family-3` shows no-fit chips with reasons; `?p=family-14` gives A where A fits | spec 3.3, 3.5 |
| 4 | `?split=1` on Day 5 draws two lanes that rejoin at 14:00 at the boathouse car park; `a=1` removes the split option | spec 6 |
| 5 | `d=5C` swaps Day 5 to the easy version with "Changed for this day · Reset"; the summary line counts it | spec 3.6 |
| 6 | Adding a place to Day 5 re-flows the day, keeps every fixed slot, marks the diff, shows the cap warning with numbers when over, and survives reload and a copied link | spec 3.7, 3.8 |
| 7 | Each time shows fixed, anchored or suggested in the 1.3 style and, expanded, its source and duration basis; the "Suggested times" banner is present once | spec 1.3, 2.12 |
| 8 | Dolomites Day 3 keeps 11:30 and 16:30; legs show ORS minutes (no ≈) where the cache has them, and ≈ elsewhere | spec 2.5 |
| 9 | No INFERENCE, CALC, GAP or "low confidence" anywhere in `web/out/trips/**`; Rockies Day 1 notes show the sunset range, not "20:16 CALC" | spec 5.1 |
| 10 | With miles chosen, the notes and the item lines agree ("1.2 mi" in both places); "Highway 93" is unchanged | spec 5.2 |
| 11 | Long notes render as Know before you go, grouped in the fixed order, 3 visible | spec 5.3 |
| 12 | Back and Forward restore the profile, overrides and additions; the key order is as spec 3.8 | spec 3.8 |
| 13 | A dated copy's ICS has timed events at the computed times with confidence in the description; no coffee or sun events unless "Full detail" | spec 3.9 |
| 14 | No calendar date appears in any public timeline or schedule file | dateless page |
| 15 | The ORS key appears in no file under the repo, no log and no `web/out` file (`git grep` on the key's first 8 characters, run locally and not printed) | map-stack, README 8 |
| 16 | `git diff --name-only` shows only owned paths; the additive edits to `types.ts`, `honesty.ts` and `web/lib/map` are listed | README 4.1 |
| 17 | axe clean on the trip page with the panel open and closed; no horizontal scroll at 390; the timeline is readable by a screen reader in order (time, kind, title, duration) | WCAG AA |
| 18 | First paint of `/trips/canadian-rockies-2029` is not more than 100 ms slower than before (Lighthouse, mid-range profile) and the page JS grows by under 30 kB gzip | README 6 |

## Verification

```
pnpm --dir core test && pnpm --dir core typecheck
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
node web/scripts/legs-ors.mjs --check
python3 tools/theme_tokens.py --check
```

E2E (`web/tests/e2e/trip-timeline.spec.ts`):
- acceptance checks 2 to 9 and 11 to 13;
- the URL round trip;
- Back and Forward;
- the add-and-remove flow;
- the phone panel;
- axe.

Screenshots: use the L0 harness at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/L3c/`. Read tall pages in 1600 px tiles.

| Page | Shots |
|---|---|
| `/trips/canadian-rockies-2029` | full page; `#day-5` default; `#day-5?split=1`; `?p=adults#day-5`; `?p=family-3#day-6` (no fit); the AddToDay flow on Day 5, before and after |
| `/trips/dolomites-2027` | `#day-3` and `#day-4` (A/B variants) |
| `/trips/patagonia-2027` | `#day-2` (summary, suggested only) |
| `/trips/switzerland-2027` | overview, unchanged |
| phone | the profile panel open |

Then `travel-design-reviewer` (Fable) reviews against the design page, and `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-L3c`, branch `public/L3c`, dev port 3423.
- **Commits, in this order:**
  1. `core(schedule): types, rules, legs, sun`
  2. `core(schedule): select, schedule, validate, codec, CLI` (with the fixtures)
  3. `data(schedules): Rockies and Dolomites overrides, Dolomites ORS legs`
  4. `web(public/L3c): adapter timeline and prose cleaner`
  5. `web(public/L3c): profile bar, trip and day timelines`
  6. `web(public/L3c): overrides and add to day`
  7. `web(public/L3c): copy and ICS carry the profile`
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back. Do not push.
- **Merge order in wave 3:** L3c before L3b, because both edit the trips tests in different `describe` blocks.

## Hand-back report

Keep it short. Include:
- the commits;
- the test counts;
- every Rockies time not placed (step 9);
- the bundle sizes (check 18);
- the additive edits to shared files;
- any foundation or L0 request: the patterns 1.2 URL keys and the patterns 3.4 Track segment removal (these are coordinator edits).
