# Neon implementation — final independent verification

> **Update, 25 Oct 2026** (master-plan audit, main f2dee4b): this 24 Oct record stands as written. Since then the work is
> merged into `main`, and the child-branch suite `core/test/db` passed 29 of 29 with 0 skipped against
> `br-damp-breeze-b41mtvn5` (HANDOVER item 1). The real-service E2E is blocked by the origin guard until an HTTPS origin
> exists (HANDOVER item 2).

Date: 24 Oct 2026. Final verifier model: **GPT-5**. Worktree: `nitin27may-musical-parakeet`, branch `nitin27may-phase-e-remaining-plan`; implementation remains user-owned and uncommitted. This report supersedes the earlier report that incorrectly called the configured HTML budget failure non-blocking and recorded only 12 real-service checks.

## Verdict: PASS for the repaired scope; child DB integration BLOCKED

The configured HTML budget and durable-write/failed-refresh browser gates were independently passed before the final HANDOVER wording and account CSS/layout-test repair. Those service/build checks are unaffected and **not rerun** in this final pass, as requested. Fresh full regression, isolated real-browser layout checks and visual inspection now pass. This is not a deployment approval or a claim that child-branch DB integration was independently completed.

## Final checks (fresh runs after account repair)

| Check / command | Result | Evidence |
| --- | --- | --- |
| `SKIP_WEB_BUILD=1 pnpm --dir web exec vitest run tests/account/layout.browser.test.ts` | PASS | 1 file, **12/12 tests**, exit 0; 58.17 s |
| `PATH=/tmp/v/bin:$PATH bash tools/check-all.sh` | PASS | **CHECK-ALL OK**, exit 0 |
| Python tests, through check-all | PASS | **265 passed, 3 skipped**; 8.89 s |
| Core tests, through check-all | PASS | 99 files passed, 1 skipped; **1991 passed, 7 skipped, 21 todo** |
| Core typecheck, through check-all | PASS | `tsc --noEmit`, exit 0 |
| Folder contract, through check-all | PASS | **11 rules, 4420 files, 83 baselined exceptions, 112 legacy files pinned** |
| Web typecheck, through check-all | PASS | `tsc --noEmit`, exit 0 |
| Web lint, through check-all | PASS | **0 errors, 19 warnings** |
| Web public build and tests, through check-all | PASS | **159 files, 1755 passed, 1 skipped, 23 todo**; includes account browser tests and public budget/place-size/OG suites |
| Data and generated-file validators, through check-all | PASS | Locations, schema, capture/gap budget, towns, all data, suitability/relevance/sources, snapshots, hardcode scan, OpenAPI and slugs passed |
| Local server smoke, through check-all | PASS | Home, health with revision and OpenAPI responded; script terminated its server by exact PID |
| Current 2x account screenshot inspection | PASS | All 12 fresh images in `web/test-results/shots/account-overflow/` inspected; tall empty-phone pages also read in tiles |
| Child-branch `core/test/db/integration.test.ts` | BLOCKED | `TEST_DATABASE_URL` unavailable; 7 cases skipped, not passed |
| Helper cleanup and final build state | PASS | No helpers from this verification remain; port 3000 free; final `.next` is public/sign-in OFF |

Full regression output is available in this session tool artifact:
`/var/folders/s2/xrdzg7w91p58jfcrvmy83x3w0000gn/T/1792879134731-copilot-tool-output-57176-ec1acb13-bab0-4c44-a267-fadb7c200570.txt`.

## Browser assertions and visual approval

`layout.browser.test.ts` uses Chromium from `web/` with ANGLE/Metal, GPU rasterization and the OS Playwright browser cache. It renders actual account page/client components and CSS, substitutes service/request boundaries, and mounts the real interactive `ThemeToggle` through a temporary local Vite server. It makes no production writes. These are browser layout/interaction tests, **not a replacement for the prior real-service E2E**.

All combinations of empty, loaded and page-load-service-error states at **390x844** and **1440x900**, light and dark, pass:

- Document and body horizontal overflow are both exactly **0 px**.
- Sign-out remains visible, enabled, inside the viewport, keyboard focusable and trial-clickable.
- The email column shrinks and ellipsizes on phone without crossing sign-out.
- The sign-out face remains **38 px** high; phone pseudo-element target is at least **44x44 px**, with both extended vertical edges independently hit-tested.
- Dark cases click the actual theme control, verify changed theme/background and local storage, and wait for the theme transition to finish.

**Visual approval:** the repaired account identity, sign-out and content column remain contained on phone; desktop layout is intact. Empty, loaded and error content, focus indication and both themes remain legible. This closes the earlier P3/P4 phone-overflow failure and satisfies the foundation component touch-target requirement. Status/metadata remain placed with their content (P6), and the public-first scope is unchanged (P7). P8/P9 catalogue boundaries are unchanged. Trip-scope scenarios do not apply to this bounded account repair. No new frame-time or motion-smoothness claim is made (P5).

Fresh artifacts (all 2x):
`web/test-results/shots/account-overflow/{empty,loaded,degraded}-{390x844,1440x900}-{light,dark}.png`.
Desktop images are 2880x1800; phone loaded/error images are 780x1688; phone empty images are 780x1720, with additional `empty-390x844-{light,dark}-tile{1,2}.png` inspection tiles. Here “degraded” means page-load service error, not the saved-but-refetch-failed state. The isolated fixture does not hydrate the authenticated avatar or footer; those are not newly service-certified by these screenshots. Unchanged sign-in/up screens were visually inspected in the preceding independent sweep at both sizes and themes.

## Prior independent checks — unaffected, NOT RERUN

Only HANDOVER prose, account CSS and its layout test changed after these successful independent checks; no server actions, data/RLS queries, live-stream logic, icon markup or HTML budget thresholds changed.

| Prior command / check | Result | Evidence |
| --- | --- | --- |
| Root `npm run build`, Neon configured/sign-in ON | PASS — prior, unaffected, not rerun | Next build, images and OG complete, exit 0 |
| `SKIP_WEB_BUILD=1 pnpm --dir web exec vitest run tests/data/place-size.test.ts tests/og.test.ts` on configured output | PASS — prior, unaffected, not rerun | **7/7**; median `cinque-torri` **93877 B / 75117 B = 1.2497437331 <= 1.25**; **19 B headroom**; largest ratio **1.2335856140** |
| Configured-output provenance | PASS — prior, unaffected, not rerun | Sign-in anchor confirmed in measured HTML. Initial automatic public rebuild was detected, configured build restored, then suites rerun with `SKIP_WEB_BUILD=1`. Tests read the export-shaped view of `.next`, not stale output |
| `NEON_E2E=1 node web/scripts/with-root-env.mjs node web/scripts/neon-e2e.mjs` against configured `next start` on port 3000 | PASS — prior, unaffected, not rerun | **14/14**, real Managed Better Auth, Realtime and Postgres |
| Affected core DB unit suites | PASS — prior; also covered by fresh full regression | **22/22** |
| Account/boundary/shell suites | PASS — prior; also covered by fresh full regression | **70/70** before adding 12 browser layout cases |
| Synthetic draft cleanup | PASS — prior, not rerun | Read-only confirmation: **0 drafts from the verification window remain**; **1 older unrelated synthetic draft preserved** |

The 14 real-service assertions include same-user live insert/rename/delete in a second context, full-reload persistence, anonymous redirect, actual sign-in UI, renewal 401 after sign-out and cross-user RLS update/delete isolation. Crucially, a real durable create followed by an intercepted **re-fetch-only HTTP 500** leaves the committed row visible with **“Saved. The live list could not refresh — reload to see the latest.”** A fresh owner-scoped RLS database read confirms that row is durable. Thus the old rendered-degraded-UX coverage gap is closed, not merely covered by a pure-function proxy.

Prior real-browser saved-notice evidence remains under:
`web/test-results/shots/verify-final-account-degraded-{390x844,1440x900}-{light,dark}.png`.
Those earlier phone images also document the now-resolved overflow; use the fresh account-overflow images for current layout approval.

## Earlier failures and resolution

1. **Configured HTML budget:** earlier median **1.2505691 > 1.25** was a blocker, not a non-blocking delta. Removing unnecessary nonloading icon-button label spans reclaimed 62 B per place. Independent configured measurement and 7/7 tests passed at the unchanged threshold, with 19 B headroom.
2. **Saved-but-refetch-failed rendered coverage:** previously missing. The independently passing real E2E now intercepts the refresh only and proves notice + visible committed row + DB durability.
3. **Full check-all:** earlier `tools/tests/test_tree_check.py::test_real_tree_passes_and_is_fast` failed (264 passed, 3 skipped, 1 failed), because HANDOVER slash-separated core-and-web prose was parsed as a nonexistent path. Wording now says “core and web”; the validator was not weakened. Fresh Python 265-pass and full CHECK-ALL OK confirm resolution.
4. **Phone account overflow:** earlier empty, loaded and saved-notice screens extended past 390 px. The header/content flex child now shrinks, the email ellipsizes and sign-out cannot shrink. The follow-up adds a token-based 44 px phone hit target. Fresh 12/12 browser tests and visual inspection approve the repair after reviewer approval reported by the coordinator.

No current check failed; no failure is being dismissed as flaky or pre-existing.

## Residual limits and scope

## 25 Oct merge-readiness follow-up — account origin guard

A subsequent independent merge-readiness sweep found that authenticated account
requests from the documented `127.0.0.1:3000` origin returned 403. The origin
guard compared against Next's normalized request URL. After that was corrected,
a second probe showed that Next derives that URL's protocol from
`X-Forwarded-Proto`; comparing against it would still trust a forwarded header.

The guard now compares Origin authority against `Host` and applies an explicit
scheme policy without reading `request.url` or forwarded headers: loopback
origins (`localhost`, `127.0.0.1`, `[::1]`) use HTTP only in development/test;
all other origins and every production origin require HTTPS. An Origin-bearing
request without Host is rejected. Missing-Origin behavior is unchanged.

| Check | Result | Evidence |
| --- | --- | --- |
| `drafts-route.test.ts` + `live-query.test.ts` | PASS | 73/73 tests; covers both loopback names, rewritten URL and forwarded-protocol spoof, production HTTP rejection, external host and port mismatch |
| Web typecheck | PASS | `pnpm --dir web exec tsc --noEmit` |
| Full repository regression | PASS (builder run) | `bash tools/check-all.sh`: CHECK-ALL OK; web 1811 passed |
| Runtime origin probe | PASS (builder run) | Credential-free Next dev server, **16/16**; both account endpoints and loopback hosts, spoofed forwarded schemes do not bypass policy |
| Final independent review | PASS for the origin fix | Reconfirmed 73/73 route tests, web typecheck and the scheme/authority rules; no visual surface changed |
| Child-branch DB integration | PASS (25 Oct) | `core/test/db` against child branch `srv-migrate-verify` (`br-damp-breeze-b41mtvn5`), never production: 4 files, 29 tests passed, 0 skipped. Connection string came from `neon connection-string` and was not printed or stored |

No production Neon access, migrations, deployment, commit or push occurred for
this follow-up. The earlier real-service 14/14 evidence was not rerun.

- Child-branch DB integration remains **BLOCKED**, not independently verified 7/7. No production URL was substituted; no migration was run.
- Configured place HTML retains only **19 B** headroom. Future shared-markup growth must remeasure the configured variant; no threshold was raised.
- Build still emits **5 dynamic filesystem-tracing warnings**; lint reports 19 warnings, zero errors.
- The prior security report recorded 86 RLS-protected application tables plus the ledger; the single content-free `planner_draft_signal` RLS exemption has no app-role grants. This posture was **not re-queried** in the final CSS/docs verification. It remains a coordinator exception, not explicit owner security approval; provider-spec alignment and public-catalogue PostgresStore parity are not claimed complete.
- This final pass did not contact production, rerun real-service E2E, create/delete synthetic accounts or drafts, alter credentials, provision services, migrate schema, deploy, or change frontend hosting. Older unrelated synthetic data was untouched.
- Only this report was edited; code and other docs were not modified by the verifier. Screenshots/tiles are disposable ignored artifacts. Local Vite/browser helpers closed in teardown; check-all stopped its smoke server by PID. Port 3000 is free. An existing Playwright test-server listener at port 58552 belongs to the separate `/Users/nks/workspace/travel` checkout (PID 52881); it was not started or stopped here.
