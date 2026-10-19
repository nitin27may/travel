# TRP: trip page polish (stage 4)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 14 h, in four parts:
  - scheduler items, 4 h
  - page and strip, 5 h
  - the map that follows the day, 3 h
  - links, thumbnails and tests, 2 h
- **Rows:**
  - 4.4 (L3c Opus review, stage-4 list)
  - 4.10 (L3c polish leftovers)
  - 3.35 (code part: the Day 6 time-zone marker, the Day 9 and Day 15 pins)
  - 3.54 and 3.57 (kind-aware stop-to-page lookup)
  - 2.41 (repeated day thumbnails)
  - 2.45 (Rockies and Dolomites route maps)
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Specs:** [features/trip-timeline.md](../../../features/trip-timeline.md), [design/trip-page/timeline-design.md](../../../design/trip-page/timeline-design.md) (sections 4.6, 4.7, 7), [review-L3c.md](../../../design/trip-page/review-L3c.md) ("Fix in stage 4", the deviation rulings, rounds 2 and 3 deferred rulings).
- **Principles:** P2, P3, P5, P6, T1, T3, T4.
- **Starts:** when D2 has merged.
- **Merges:** third, after PLC, because your links need PLC's final page set.
- **Opus review:**
  - **Before:** `travel-design-reviewer` rules in one short note (`docs/v2/design/trip-page/stage4-map-note.md`) on the sticky map column at 1024 px and up, the phone "Map · Day N" pill, and the strip's hour ticks. Build those three after the note; start everything else at once.
  - **After:** the full review.

## Goal

The trip page keeps every L3c and TS1 behaviour. It also:
- tells the cost of a change before you make it;
- keeps the plan the same whichever view you choose;
- animates every swap;
- keeps the map on the day you are reading;
- links every named stop to its page.

## Read first

- review-L3c.md, all of it, for the reasons behind each item below.
- BACKLOG 4.4, 4.10, 3.35, 3.54, 3.57, word for word.
- `web/components/trips/TripPlan.tsx`, `TripRouteMap.tsx`, `DayRow.tsx`, `timeline/*` (including `currentDay.ts` and `useScrollSpy.ts` from TS1; keep the focus-line behaviour).
- `core/src/schedule/**`, and the bundle size test (13,308 of 13,312 bytes: **trim before adding**).
- `web/lib/public/trips.ts` (stop-to-page lookup), `timeline.ts`, `prose.ts`.
- `data/schedules/canadian-rockies-2029.json`; `legacy/canadian-rockies-sept-2029/data/itinerary.json` and the Rockies research for the Day 9 canoe and Day 15 flight times.

## Files you own

| Area | Paths |
|---|---|
| Trip page | `web/app/trips/[slug]/**`, `web/components/trips/**` except `TripsMap.tsx`, `TripCover.tsx`, `types.ts` and `tags/**`; `web/styles/timeline.css` and the trip-page styles |
| Adapter, trip part | `web/lib/public/trips.ts`, `timeline.ts`, `prose.ts`, `quantities.ts`, `legs-pairs.ts`; an additive block `// TRP (stage 4)` in `types.ts` |
| Scheduler and data | `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `data/schedules/**` |
| Copy and export | `web/lib/export/**`, `web/components/actions/**` (only if a change here needs it) |
| Tests | `web/tests/trips/timeline*`, `web/tests/data/prose*`, `web/tests/e2e/trip-*.spec.ts`, and the trip-page `describe` blocks of `trips.spec.ts` and `trips.test.ts` |

## Do not touch

- **LST:** the trips list (`app/trips/page.tsx`, `rows.ts`, `layout.tsx`, `TripsMap.tsx`, `TripCover.tsx`, `components/trips/types.ts`, `tags/**`, and the list `describe` blocks).
- **PLC:** `components/places/**`, `components/suit/**` (timeline chips render through it; ask PLC for a change), `lib/public/places.ts`, `seeds.ts`.
- **PLC:** `lib/map/**` is additive only, and any change is listed in your hand-back.
- **SHL:** `components/ui/**` is by request.
- `data/capture/**` is read only. CS7d adds the three Rockies stop points.

## Steps

### Part 1. Scheduler (core first)

1. **Trim the bundle** under 12,800 bytes before any feature, and record what went.
2. **Show both lanes without changing the plan.** Schedule the 14:00 rejoin wait in both lane views, so the times and the warning match whichever view is shown (L3c I-1, round 3 ruling (a)). Add a test: the default and `split=1` give the same entry times for both lanes.
3. **Adds that run past midnight** are not offered. If an add would push the day past 23:00, the panel says so plainly ("Ends after 23:00, not added") instead of clamping at 23:59.
4. **A leg routed through the base** (a stop with no point) reads as one leg "via Jasper", or shows the base stop, never as two "Drive to X" legs.
5. **The cost before adding (round 3 ruling (c)):** each candidate in the Add panel shows "adds about 2 h of driving" from the same ladder the scheduler uses.
6. **Rockies data (3.35, C8).**
   - A Day 6 time-zone change marker at Mount Robson (BC is one hour behind Alberta) in the time gutter, with a test that the times after it read in local time.
   - The Day 9 last canoe rental as a fixed pin.
   - The Day 15 flight-dependent times as anchored entries, labelled "depends on your flight".
   - Take the values from the Rockies research and cite the file in the schedule's source field. If a value is not in the research, leave it out and list it in the hand-back. **Never invent it.**

### Part 2. Page and strip

7. **Fade the day cards on a Who or Pace change:** out 120 ms, in 200 ms, 20 ms stagger up to 5 cards; animate the strip bars. Reduced motion jumps.
8. **The whole-trip strip.**
   - No clipped drive text: a car glyph and "2 h 30".
   - 06, 12 and 18 hour ticks.
   - Hide the variant column when every row has the same value.
   - Keep the drive figure on the phone.
9. **Variant menu:** a consequence line and a fit note for each option (design 4.6).
10. **Phone day header:** fold the sun line into the meta row, put the chip inline, clamp the summary to 2 lines; target under 260 px before the first time (it is about 520 px today).
11. **"Plan it for" above the season band** (Q7 decision); collapsed to one line on the phone.
12. **The sticky plan bar names the profile** ("Family, 6 · Standard · Edit"), never "Plan as written".
13. **Polish list (4.10):**
    - the kind glyph instead of the empty grey thumb;
    - the right glyph for "Bear spray and groceries";
    - a space in "≈ Drive";
    - the screen-reader label "to Back to Jasper";
    - "4h15" formatted as "4 h 15";
    - no empty band beside the segmented controls;
    - "Longest walk" in the unit chosen.
14. **Repeated day thumbnails (2.41).** No two consecutive days, and no more than two days in a trip, use the same photo. A day with no photo of its own uses its main stop's photo, then the kind glyph; never a bare placeholder.

### Part 3. The map follows the day

15. **The map follows the day**, per the Opus note:
    - At 1024 px and up, the route map becomes a sticky column that shows the current day (TS1's focus-line day) once the day settles.
    - On the phone, a "Map · Day N" pill opens the map inline (not modal), on that day.
16. **Open the route map fitted to all days at rest** (not zoomed on one dot), on Rockies, Dolomites and Vermont.
17. **Check the Rockies and Dolomites route maps (2.45)** in a GPU browser: real lines, no Europe framing.

### Part 4. Links

18. **Kind-aware stop-to-page lookup (3.54, 3.57).** In `trips.ts`, a named stop prefers a sight or place page, and a trail item prefers the trail page. Then:
    - Kinney Lake and Peyto Lake Lookout each link the right page;
    - the Dolomites trip links its 5 capture pages;
    - a test pins all of these.
    - Re-run the test after PLC has merged, because duplicates and lodging leave the page set.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | The scheduler bundle is under 12,800 bytes, and every old schedule test passes | 4.4 |
| 2 | Rockies Day 5, default and `split=1`: the same times for each lane, the same warning | I-1, P4 |
| 3 | No add is offered or placed past 23:00; the Add panel shows the cost of each candidate | 4.4, P6 |
| 4 | A Who change cross-fades the cards (frames sampled in e2e); reduced motion jumps | P5 |
| 5 | The strip shows ticks and no truncated text at 1440 and 390 | 4.4 |
| 6 | The phone day header is under 260 px before the first time | T2 |
| 7 | At 1440 the map column stays in view and changes day as the reading day changes (TS1's focus line); on the phone the pill opens the right day | P5 |
| 8 | Each route map opens fitted to all positioned stops | T5 |
| 9 | Day 6 shows the time-zone marker; Day 9 and Day 15 show their pins or are listed as missing | 3.35, T1 |
| 10 | Kinney Lake, Peyto Lake Lookout and the 5 Dolomites stops link pages; no link 404s (a test over `web/out`) | 3.54, 3.57 |
| 11 | No consecutive repeated day photo and no bare placeholder on the Dolomites, Rockies and Iceland pages | 2.41 |
| 12 | The marker sweep, privacy and dateless tests still pass | L3c 9, 14 |
| 13 | axe clean, with the panel and the map pill open and closed; no horizontal scroll at 390 | WCAG AA |
| 14 | The trip page JS grows by under 5 KB gzip | README 6 |
| 15 | `git diff --name-only` shows only owned paths | 2.1 |

## Verification

```
pnpm --dir core test && pnpm --dir core typecheck
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
```

Screenshots at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/TRP/`, read in tiles:
- Rockies: full page, `#day-5`, `?split=1#day-5`, Day 6, the Add panel;
- Dolomites: `#day-3`;
- Patagonia: `#day-2`;
- Vermont (done);
- the phone map pill open.

Then `travel-design-reviewer` (Opus) reviews, and `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-TRP`, branch `public/TRP`, dev port 3453.
- **Commits:**
  1. `core(schedule): trim, rejoin in both views, no past-midnight adds, via-base legs`
  2. `data(schedules): Rockies Day 6 zone, Day 9 and Day 15 pins (3.35)`
  3. `web(public/TRP): strip, variant menu, phone header, plan bar, polish (4.4, 4.10)`
  4. `web(public/TRP): map follows the day, fitted route maps (4.4, 2.45)`
  5. `web(public/TRP): kind-aware stop links, day photos (3.54, 3.57, 2.41)`
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. Co-Authored-By trailer from your harness.
- Rebase onto the latest v2 branch (after PLC) before the final shots. Do not push.

## Hand-back

- the commits, the test counts and the bundle sizes;
- every Rockies time not placed (3.35);
- any `lib/map` additions;
- any request sent to PLC or SHL.
