# STEP2-VER: independent verification of edit mode on main 06822e9d (28 Oct 2026)

Model: Sonnet 5.5. Worktree `S2-VER` (branch `step2/VER`). Production builds (`pnpm build`) with decoy `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5`: one with `NEXT_PUBLIC_TRIP_EDIT=1`, one without (`NEXT_DIST_DIR=.next-off`); each served by `next start` on a free port (4871 on, 4872 off); every spec run alone with `PW_REUSE_SITE=1`; servers stopped by PID. No root `.env.local`, no secrets used.

## Test-only fixes made

| File | Why |
|---|---|
| `web/tests/e2e/export.spec.ts` | the copy sheet link is "Open your trip" to `/t/<id>/` with the flag on; the spec now reads `NEXT_PUBLIC_TRIP_EDIT` as `mine-trips.spec.ts` does. Flag-off expectation unchanged |
| `web/tests/e2e/t-edit-remove.spec.ts` | the phone edit bar holds Undo and Redo icon buttons since UI1 (I11); the spec expected only Settings and Done. Now: labelled buttons are Settings and Done, Undo and Redo are present |

## Specs (flag ON build, port 4871)

Command shape: `PW_REUSE_SITE=1 PW_SITE_URL=... pnpm exec playwright test --project=<p> <spec>`. `export` also matches `t-edit-export`. No `t-built` spec exists in this tree; no separate print spec (print is in `t-edit-export`, `trip-routes`).

| Spec | chromium | webkit-iphone |
|---|---|---|
| t-edit-add | 8 pass (first run failed only because a stray earlier run wiped `test-results`; clean rerun passes) | not configured |
| t-edit-chrome | 6 pass | not configured |
| t-edit-days | 18 pass | not configured |
| t-edit-drag | 12 pass | 4 pass, 8 skip (desktop-mouse block skips on mobile by design) |
| t-edit-export | 3 pass | not configured |
| t-edit-flow | 1 pass | not configured |
| t-edit-keyboard | FLAKY: 7 or 6 of 8 pass; see bug B1 | not configured |
| t-edit-remove | 9 pass after the spec fix (the phone test failed before it) | not configured |
| t-edit-undo | 4 pass | not configured |
| t-edit-warnings | 5 pass | not configured |
| t-read | 8 pass, 1 skip (the screenshots block) | not configured |
| mine-shell | 32 pass, 13 skip | 30 pass, 15 skip |
| mine-trips | 22 pass | 22 pass |
| export | 8 pass after the spec fix (the "Open in Mine" test failed before it) | not configured |
| party-bar | FAIL 2 (390 and 320 layout); see bug B2 | FAIL 2 (same) |
| trip-polish | 14 pass | not configured |
| trip-routes (builds its own fake-key Google-family dist and inherits the flag; needs no extra setup) | 17 pass, 12 skip | 17 pass |

## Flag OFF build (port 4872)

| Check | Result |
|---|---|
| `/t/` and `/t/<id>/` | 404 (curl and `t-read` probe) |
| All `t-edit-*` and `t-read` specs | all skip on the 404 probe (0 fail) |
| mine-shell / mine-trips / export / trip-polish / trip-routes, chromium | pass (32 / 22 / 5 + 3 skip / 14 / 17) |
| mine-shell / mine-trips, webkit-iphone | pass (30 / 22) |
| party-bar | same 2 failures as flag on, so flag-independent (B2) |
| Edit chunk requested | none. Browser network log over `/`, `/trips/<slug>/` (+ `?view=day`), `/mine/`, `/mine/?show=trips`, `/t/x/?edit=1`: no loaded script contains `drag-handle`, "Changes from our plan", "Reset to our plan" or "Editing ". The same strings are in 3 chunks of the flag-on build and in none of the flag-off build. Flag-on trip and Mine pages do not request them either (the layer loads only on a copy in edit mode). Residual: one shared timeline chunk in the flag-off build still holds the inert slot code (`tl-edit-trail`, "Add a place to Day") |
| Budget (flag on `budget:report`) | start JS heaviest trip page 193.8 KB (limit 200); place size median 1.2542 of 1.25 (headroom -317 B), the open item I14 from the integration pass, not a Step 2 regression |

## EA rows

| Row | Result | Evidence |
|---|---|---|
| EA1 remove any stop, Undo to same position | PASS | t-edit-remove 9/9 |
| EA2 Add a place to Day n, picker | PASS | t-edit-add 8/8 |
| EA3 buttons at 390; long-press drag; row body scrolls | PASS | t-edit-remove phone, t-edit-drag chromium 12 and webkit-iphone phone block |
| EA4 keyboard lift, move, drop, cancel, announced | PARTIAL: flaky | t-edit-keyboard fails intermittently (focus not back on the handle after a drop; Alt+Up second press silent). B1 |
| EA5 50 undo steps survive reload; 51st drops oldest | PASS | t-edit-undo |
| EA6 changes sheet, Reset Day, Reset to our plan confirm at 4+ | PASS | t-edit-undo, t-edit-remove |
| EA7 date and party change | PASS | t-edit-days 18/18 |
| EA8 warnings at rest, collapse, never disable | PASS | t-edit-warnings 5/5 |
| EA9 convert notice, Continue, Undo | PASS | t-edit-export 3/3 |
| EA10 two contexts as one account | BLOCKED | needs Neon credentials, see below |
| EA11 signed-out device copy fully editable, nothing sent | PARTIAL | the device copy edits are exercised in every t-edit spec with no sign-in, and t-read asserts no party write; the "nothing sent to the server" network assertion against a real backend is blocked (below) |
| EA12 `/trips/` unchanged; `/t/` in budget | PASS | t-read EA12 test; budget report; flag-off table above. `/t/` start JS 299 KB at INT (under 325); not remeasured per page here |
| EA13 noindex, no-store, no sitemap, no OG, other account's id not-found | PASS for the device/anonymous side | t-read test (headers, `noindex, nofollow`, 0 `/t/` entries in sitemap, no og tags); the "another account's id" and privacy scan with trips present need an account, blocked |
| EA14 screenshots 1440 and 390, light and dark | NOT DONE here | belongs to the design review ERV |

## Other checks

| Check | Result |
|---|---|
| `tools/gate/check_map.py` | OK (5562 files, 69 rules, 93 e2e specs attached) |
| `tools/tree_check.py --check` | OK |
| `tools/cons/hardcode_scan.py --check` | OK (186 baselined, 92 env names documented) |
| `tsc --noEmit` web | clean |
| `tsc --noEmit` core | clean |

## Web unit project (9 failures in 8 files; 3226 pass)

Known pre-existing set seen: sign-in-notice, adapters-renditions, api/images (2 tests), legs-home-radius, signout.browser. (`server-trace` did not fail this run.)

NEW (not in the known set):

| Test | Cause | Verdict |
|---|---|---|
| `tests/data/boundary.test.ts` (P9: only the data module calls fetch) | `components/trips/edit/add/source.ts` (E3) calls `fetch` on `/api/v1/places` itself | real: B3 |
| `tests/plan/isolation.test.ts` G1 (only the builder and extension points import builder code) | `components/trips/edit/add/fit.ts` imports `@travel/core/plan/warnings.ts`; `lib/export/own.ts` (E6) imports the plan-draft schema | real: B4 (fence needs registered extension points or a move) |
| `tests/account/travellers.browser.test.ts` SF7 | `getByText('Step 2 of 2')` matches two elements (label and the sr-only live status); passes alone (31/31 in 90 s) | flaky under load (the live region appears only after the step change); not Step 2 |

## Real product bugs (not fixed; no one-file obvious fix)

| # | Where | Repro | Notes |
|---|---|---|---|
| B1 | `components/trips/edit/drag/DragLayer.tsx` `focusBack` (80 ms `setTimeout`) and the post-drop focus timer | flag-on build; `playwright test --project=chromium t-edit-keyboard --repeat-each=3`: "Space lifts ... drops" fails in 2 of 3 runs (`document.activeElement.dataset.dragHandle` is empty after the drop), and "Alt+Up ... already first" fails (second Alt+Up is silent because focus left the row) | a keyboard user loses their place after a move (WCAG 2.4.3, EA4). Cause looks like a fixed timer racing the re-render that reorders the rows; the focus should be restored in an effect after the commit |
| B2 | public trip page sticky bar `.tl-planbar-party` (`styles/party-bar.css:46`, `flex: none`; text from SW-006, 4c39d0e3) | `/trips/canadian-rockies-2029/?view=day` at 390 or 320, open the party editor, add 8 children: `document.documentElement.scrollWidth` is 903 against 390; the party text (right edge 892) and pace (907) overflow | flag-independent; fails `party-bar.spec` layout tests on chromium and webkit, flag on and off. The bar needs to wrap or truncate the party line |
| B3 | `components/trips/edit/add/source.ts` | boundary test above | P9: route the places read through `lib/client/data.ts`, or add a reasoned entry to the test's allow-list if the owner accepts a direct same-origin read |
| B4 | `fit.ts`, `lib/export/own.ts` | isolation test above | register extension points in `tests/plan/isolation.test.ts` (with the spec line the test asks for) or move the shared types out of the builder paths |

## Blocked items: EA10 and EA11 (need Neon credentials)

Not run: no credentials were used or printed.

A person with credentials, on a preview deployment (or locally with the Neon Auth env set), should:

1. EA10: sign in as one test account in two Playwright contexts (A, B) and open the same copy at `/t/<id>/?edit=1`. In A remove a stop and add a place; assert B shows both within the refetch period without a reload. Then in B remove a stop A is about to move, make A's move after, and assert the op is listed in the conflict list (Changes sheet), not dropped. Check `/api/account/plans/` request/response in the network log: only the account's own document, no other id.
2. EA13 remainder: with a second account, request the first account's `/t/<id>/` and assert the same not-found state as an unknown id; run the privacy scan over public routes while a signed-in trip exists and assert no document field appears.
3. EA11: signed out, make a device copy and edit it (remove, add, move, date change); in the network log assert there is no request to `/api/account/` or any write beyond static assets and `/api/v1/` reads; reload and confirm the edits stay.
4. Run `t-read`'s signed-in/synced cases and `mine-trips` with a real session once, as the owner does for Google sign-in.

Run order note: run each spec alone on its own port. A second Playwright process in the same `web/` wipes `test-results` and fails the other run (seen once on `t-edit-add`).
