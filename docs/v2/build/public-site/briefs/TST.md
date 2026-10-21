# TST: the flaky browser tests (phase A)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 4 h.
- **Rows:** 3.63, 3.67g, TODO "Test health" (places-parity).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task A14.
- **Starts:** day 1. **Merges:** first in phase A, so every later lane's e2e runs on the fixed specs.
- **Review:** coordinator only.

## Goal

The six specs that fail under load wait for the settled value instead of a fixed moment, so the R1 screenshot sweep and the quiet full suite are reliable.

## Read first

BACKLOG 3.63 and 3.67 word for word; the six specs; `web/tests/e2e/fixtures.ts`.

## Files you own

`web/tests/e2e/who-it-suits.spec.ts`, `home.spec.ts`, `url-state.spec.ts`, `smart-search.spec.ts`, `trip-day-spy.spec.ts`, `places-parity.spec.ts`, and shared helpers you add to `web/tests/e2e/fixtures.ts` (append only). No other phase A lane edits these files.

## Do not touch

Product code. If a race is a product bug (a value that really changes after it settles), stop, report it, and leave the spec as is; the coordinator gives it to the owning lane.

## Steps

1. `who-it-suits.spec.ts:36`: read a day's title and its line from the same settled state (wait for both, compare once).
2. `home.spec.ts:40`: wait for the suggestion link to be stable before clicking (it re-renders).
3. `url-state.spec.ts:110` and `smart-search.spec.ts:188` (WebKit desktop): wait for the URL or the chip set to settle (`expect.poll`), not a timeout.
4. `trip-day-spy`: assert on the settled current day after scroll ends.
5. `places-parity.spec.ts`: wait for the counts to settle before comparing.
6. Leave the `trip-day-spy.spec.ts:231` WebKit axe skip for SHL2 (row 15.2), which removes it when the gallery fix lands.

## Acceptance checks

| # | Check |
|---|---|
| 1 | Each spec passes 3 runs out of 3 while four other lanes' specs run (a load harness: four parallel `playwright test` processes) |
| 2 | No assertion was loosened: each change is a wait for a settled value, listed in the hand-back |
| 3 | `git diff --name-only` shows only owned paths |

## Server switch

Not applicable (tests only). The specs assert on what the page shows, not on file paths, so they keep working when the data comes from `/api/v1/` in phase B.

## Verification

The specs above on chromium, webkit and firefox, three times under load; `pnpm --dir web typecheck`.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-TST`, branch `public/TST` from `main`. One commit: `web(public/TST): settled-value waits in six specs (3.63)`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; do not push.

## Hand-back

The commit, run counts per spec and browser, and any race that turned out to be a product bug.
