# Step 2 final verify (STEP2 LUNCH closeout), 28 Oct 2026

Branch `step2/LUNCH` from `main` 5f6d0db4. Every spec was run alone (`--project` named), one at a time, against a production
build (`images --prebuild`, `og --prebuild`, `next build`, `images --verify`) served by `next start` on port 4637, with the decoy
household point `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5` and no `.env.local`. The server was stopped by its PID.
Model: Claude Opus 5.5.

## What this lane changed

| Item | Cause | Fix |
|---|---|---|
| Double lunch (Rockies Day 8 + Cavell Meadows) | The add went in before the plan's own lunch row (`icefield-lunch`). `runLane`'s lunch rules only knew that lunch was done once they reached a lunch row, so the rule "lunch is due where we stand" generated a picnic at 12:05 and the plan's row still followed at 17:20 | `core/src/schedule/schedule.ts`: while a plan lunch row lies ahead in the lane no rule generates a lunch; when lunch is due on arrival at a stop the person added and only added stops stand between it and an unpinned plan lunch row, that row is pulled forward (the plan's own order is kept). Dead `src` variable removed. Scheduler bundle 13,401 B gzip; cap raised once by 128 B to 13,440 with the reason in `core/test/schedule/size.test.ts` |
| ER-022 sticky bar height | Two lines at every laptop width (patterns 3.13 item 4), the sync word in the row | `PlanBar` measures (ResizeObserver on the bar and each part): the tools sit on the strip's line when every day, every tool and Export fit, first with the party words, then without them; else the second line. Quiet sync word only in the cover meta; "Not synced · Retry" stays in the tools. 15-day Rockies copy: 57 px at 1440 and 1760 (was 95), 95 px at 1280. Public bar unchanged |
| 768 day rail, cut right-hand day | The strip clipped a cell mid-number (a "12" read "1"); the phone fade did the same at 390 | `PlanBar` marks each cell: a cell cut by the strip's edge is not drawn (opacity 0, still focusable; focus scrolls it in), the last whole day before more days is dimmed. Replaces the phone mask, at every width |
| "… ·" after a truncated party | The separator was loose text between the party and pace spans | The separator is the pace span's first word, so it shrinks away with the pace |
| Phone public bar | With the shorter party line the strip stayed on the first row at 28 px | The party line is the phone bar's whole first row (`party-bar.css`) |

## E2E, flag on (`NEXT_PUBLIC_TRIP_EDIT=1`)

| Spec | Project | Result |
|---|---|---|
| t-edit-add | chromium | 8 pass |
| t-edit-chrome | chromium | 7 pass (laptop 1280/1440/1760 rewritten for the measured bar, a 768 rail test added) |
| t-edit-days | chromium | 18 pass |
| t-edit-drag | chromium | 12 pass |
| t-edit-erfix | chromium | 13 pass |
| t-edit-export | chromium | 3 pass after a test fix (see below) |
| t-edit-flow | chromium | 1 pass |
| t-edit-keyboard | chromium | 8 pass |
| t-edit-remove | chromium | 9 pass |
| t-edit-ui2 | chromium | 7 pass |
| t-edit-undo | chromium | 4 pass (the sync word is now read in the cover meta) |
| t-edit-warnings | chromium | 5 pass |
| t-read | chromium | 8 pass, 1 skip |
| mine-shell | chromium | 32 pass, 13 skip |
| mine-trips | chromium | 22 pass |
| mine-sync | chromium | 14 skip (needs its own dist: `NEXT_PUBLIC_SIGN_IN=1 NEXT_PUBLIC_ACCOUNT_TRIPS=1 NEXT_DIST_DIR=...`; not built here) |
| export | chromium | 5 pass |
| party-bar | chromium | 34 pass (B2 test now also checks no loose separator) |
| trip-polish | chromium | 14 pass |
| trip-routes | chromium | 17 pass |
| trip-timeline | chromium | 17 pass |
| trip-golive | chromium | 3 pass, **1 fail, fails on base too** |
| t-edit-drag | webkit-iphone | 4 pass, 8 skip |
| party-bar | webkit-iphone | 34 pass |
| mine-shell | webkit-iphone | 30 pass, 15 skip |
| mine-trips | webkit-iphone | 22 pass |

## E2E, flag off

| Spec | Project | Result |
|---|---|---|
| t-edit-* (12 specs), t-read | chromium | all skip (they need the flag-on build) |
| mine-shell | chromium | 32 pass, 13 skip |
| mine-trips | chromium | 22 pass |
| mine-sync | chromium | 14 skip (own dist, as above) |
| export | chromium | 5 pass |
| party-bar | chromium | 34 pass |
| trip-polish | chromium | 14 pass |
| trip-routes | chromium | 17 pass |
| trip-timeline | chromium | 17 pass |
| trip-golive | chromium | 3 pass, **1 fail, fails on base too** |
| t-edit-drag | webkit-iphone | 12 skip |
| party-bar | webkit-iphone | 34 pass |
| mine-shell | webkit-iphone | 30 pass, 15 skip |
| mine-trips | webkit-iphone | 22 pass |

## Remaining failures

| Failure | Repro | Base |
|---|---|---|
| trip-golive MUST-6 "Book ahead section after the meta line, before Day 1" | `npx playwright test tests/e2e/trip-golive.spec.ts --project=chromium` against any build. The print view (`web/components/actions/TripPrintView.tsx`) puts the `print-model-book` sections after the days (`H1, P, P, parks, day x15, book x3, source`); the spec wants Book ahead first | fails on a flag-off build of `main` 5f6d0db4 too; not this lane's (no print file changed). Either the print order or the spec must change: an owner/spec call |

Fixed while verifying: `t-edit-export` picked a row of the add picker before its fit lines had been worked out, then clicked
`.first()` again; once "Jasper bike rentals" turned "Day full" the click added Maligne Canyon instead (the same on the base
scheduler). The spec now waits for the fits and clicks the row by its name.

## Unit suites

| Suite | Result | Against the known set |
|---|---|---|
| web unit project | 3,269 pass, 7 fail | sign-in-notice, adapters-renditions, api/images (2), legs-home-radius, signout.browser: known. travellers.browser failed under load and passes alone (with signout.browser): not new. server-trace passed |
| core | 3,618 pass, 1 fail | drive keys "home refusal": known |
| add-invariants | 3 tests pass | the double-lunch skip is gone; every candidate on every Rockies and Dolomites day, alone, by insertion and after each stop; add/remove and move/move-back round trips byte-identical |

Gates: core and web `tsc --noEmit` clean; `tools/gate/check_map.py`, `tools/tree_check.py --check`,
`tools/cons/hardcode_scan.py --check` OK.

Screenshots (2x, not committed): `/Users/nks/workspace/travel-wt/S2-LUNCH-shots/final-edit-{390,768,1280,1440,1760}-{light,dark}.png`
and `final-public-{390,768,1440}-{light,dark}.png`.
