# TRP1: trip page polish (phase A)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 8 h.
- **Rows:** REVIEW4 fix-soon R4-T1 to R4-T4, 3.62b, 3.67d, 3.35a, 3.35b, 15.5 (lines in [COVERAGE.md](../COVERAGE.md)).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task A13. Spec of each item: [review-stage4-whole-site.md](../../../design/review-stage4-whole-site.md) "Fix soon: Trips list and trip page" and "Where the lanes' work clashes".
- **Principles:** P2, P3, P4, P6, T3, T5.
- **Starts:** day 1. **Merges:** after GLB2a in phase A. Phase E's TRP2 takes these files afterwards.
- **Opus review:** after.

## Goal

Every trip page reads true at a glance on a phone and on a desktop: no control on top of another, no wrong cover, no raw values, text that matches its buttons, and no stop dropped by a merged duplicate.

## Read first

- The review sections above, word for word, and BACKLOG 3.35, 3.62, 3.67.
- `web/components/trips/TripPlan.tsx`, `TripRouteMap.tsx`, `DayRow.tsx`, `timeline/*`, `TripCover.tsx` (read only, LST2a owns it), `web/lib/public/trips.ts`, `timeline.ts`, `prose.ts`, `data/schedules/canadian-rockies-2029.json`, the core stop-count pin (207) in `core/test/schedule/**`.

## Files you own

`web/app/trips/[slug]/**`; `web/components/trips/**` except `TripsMap.tsx`, `TripCover.tsx`, `types.ts` and `tags/**`; `web/lib/public/trips.ts`, `timeline.ts`, `prose.ts`; `data/schedules/**`; `core/src/schedule/**` (pins and markers only); `core/test/schedule/**`; `web/styles/timeline.css`; `web/tests/trips/**`; `web/tests/e2e/trip-hero.spec.ts`, `trip-polish.spec.ts`, `trip-timeline.spec.ts`.

## Do not touch

`trip-day-spy.spec.ts` (TST owns it in phase A); `web/lib/client/**`; `components/places/**`, `components/entity/**`, `components/globe/**`; `data/capture/**` (a cover photo is picked from the trip's existing gallery, not researched); everything else.

## Steps

Check each item on the current build first; if it is already fixed, report it with a screenshot and move on.

1. **Phone map pill (R4-T1):** hide "Map · All days" until Day 1 reaches the focus line; it never covers the Plan it for card or the season heading.
2. **Patagonia (R4-T2):** a Patagonia cover from the trip's own gallery; Day 2 says "1 stop not on the map" instead of "0 stops"; drop "level None" values.
3. **Switzerland overview (R4-T3):** the text matches the buttons that exist ("Copy it to plan your own dates" only if Copy is there); "Season not set yet" once; photo tiles load (lazy loading fixed or the tile shows the kind glyph).
4. **Dolomites Day 4 (R4-T4):** show stated limits only ("Age 3+"); never "weight not stated · height not stated +4".
5. **Merged duplicate (3.62b):** a trip stop whose ref was merged into another page resolves through the second record's name; the Rockies stop is linked again; re-pin core's count from 207 to 206.
6. **Re-read (3.67d):** Dolomites `#day-3`, Patagonia `#day-2`, and the 1024 view; fix what is wrong, report what is fine.
7. **Rockies markers (3.35a, 3.35b):** the Day 6 time-zone change marker (Mount Robson, from the research already held) and the Day 9 canoe last-rental conflict pin, in `data/schedules/`; the inference is flagged for the owner at R1.

## Acceptance checks

| # | Check |
|---|---|
| 1 | Each item fixed, or shown already fixed, at 1440, 1024 and 390, light and dark |
| 2 | Core schedule tests pass with the stop count at 206 |
| 3 | No new literal caught by the hard-coding scan |
| 4 | `git diff --name-only` shows only owned paths |

## Server switch

The page reads `getTrip()` through the adapter; from phase B the same model comes from `GET /api/v1/trips/{slug}`. Nothing here reads a file from a component. Schedule pins are data the store serves unchanged.

## Verification

Typecheck, lint, unit tests, `pnpm --dir core test`, your trip specs only, `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. Screenshots of the Rockies (top at 390, day 6, day 9), Patagonia (top, day 2), Switzerland, Dolomites day 3 and day 4, at 1440, 1024 and 390, light and dark, GPU flags, into `web/test-results/shots/TRP1/`; read them in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-TRP1`, branch `public/TRP1` from `main`, port 3470. One commit per step group: `web(public/TRP1): ...`, `data(TRP1): Rockies day 6 and day 9 markers`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits; per item: fixed, or already fixed (with the shot); the stop-count change; the Mount Robson note for the owner.
