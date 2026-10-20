# SHL2: Sign in hidden, Report a problem (phase A)

Extends [SHL.md](SHL.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 3 h.
- **Rows:** 11.1 (Q64: hide), 11.2 (Q63: issue link first, Q70: where it goes).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks A2, A3.
- **Principles:** P4 (no dead ends), P7, privacy rule (no personal address).
- **Starts:** after CONS-0 merges (needs `capabilities.ts` and `config/product.ts`). **Merges:** second in phase A.
- **Opus review:** none; travel-verifier.

## Goal

The header and phone bar offer nothing that cannot be used, and every page has a plain way to report a problem that never shows a personal email.

## Read first

- `web/components/shell/SiteHeader.tsx` (lines 26 and 66: the Sign in link), `BottomBar.tsx`, `SiteFooter.tsx`, `web/app/sign-in/page.tsx`, `web/app/about/**`.
- `web/lib/capabilities.ts` and `web/lib/config/product.ts` (CONS-0).
- BACKLOG 11.1, 11.2, Q63, Q64, Q70.

## Files you own

`web/components/shell/**`, `web/app/sign-in/page.tsx`, `web/app/about/**` (the report link only), `web/tests/shell/**`, new `web/tests/e2e/shell-report.spec.ts`.

## Do not touch

`web/lib/capabilities.ts`, `web/lib/config/**` (CONS; request a key), `web/app/sitemap.ts` (LST2; ask the coordinator to drop `/sign-in/` from the sitemap if it is listed), everything else.

## Steps

1. Render the header Sign in link only when `capabilities.signIn` is true. Keep `/sign-in/` as the existing noindex "Sign-in comes with the planner" page for old links.
2. Add "Report a problem" to `SiteFooter.tsx` and one line in About. It is a small client component that builds `reportUrl` plus `?page=<pathname>` (no other data, no email). It calls `reportProblem()` from the boundary, which returns `{kind:'link', url}` today.
3. If `reportUrl` is `null` (Q70 not settled), the link is not rendered; the test covers both states.
4. Unit tests for both flags; e2e at 1440 and 390: no Sign in; the report link opens a new tab with the page path.

## Acceptance checks

| # | Check |
|---|---|
| 1 | No Sign in in header or phone bar at 1440 and 390; the flag on in a test shows it |
| 2 | The report link carries `?page=/places/moraine-lake/` on that page; the privacy test finds no email in `web/out` |
| 3 | Screenshots of header, footer and About at 1440 and 390, light and dark |
| 4 | `git diff --name-only` shows only owned paths |

## Server switch

Two placeholder seams: `auth` (`session()` returns `null`, `capabilities.signIn=false`; laundry list items 1 and 36) and `report` (`reportProblem(input)` returns `{kind:'link', url}`; a server returns `{kind:'submitted', id}` from `POST /api/report` with the same Zod input). Components read only the flag and the boundary result, so the switch changes neither.

## Verification

As every lane: typecheck, lint, unit tests, your e2e specs only, check-all with `web/.env.local` moved aside and restored, screenshots at 1440 and 390 light and dark on the GPU flags into `web/test-results/shots/SHL2/`, read.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-SHL2`, branch `public/SHL2` from `main` after CONS-0 merges, port 3462. Commits: `web(public/SHL2): Sign in behind the signIn flag (11.1)`, `web(public/SHL2): Report a problem link (11.2)`. Owned paths only, `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits, test counts, shots, and whether `/sign-in/` is still in the sitemap.
