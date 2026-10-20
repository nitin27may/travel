# FIXF: the home search panel (phase A)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 2.5 h.
- **Rows:** 9.1 (clipped panel), 3.66 part (header Search closes on a second tap).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task A1. Cause and repro in [OWNER-ROUND1-plan.md](../OWNER-ROUND1-plan.md) item 1.
- **Principles:** P3 (the way back always visible), P4, P5 (smooth, linked open and close).
- **Starts:** day 1. **Merges:** after CONS-0, first of phase A.
- **Opus review:** none; travel-verifier only.

## Goal

The search panel opens fully inside the viewport, anchored to the viewport and header, whichever button opened it; a second tap on the header Search closes it.

## Read first

- BACKLOG 9.1 word for word (the panel's left edge is at x = -161 at 1100 px and wider when opened from the hero).
- `web/components/search/GlobalSearch.tsx` (the `search-dialog gs gs-panel` element), `web/styles/search.css`, `web/components/home/CoverSearch.tsx`, `web/components/shell/SiteHeader.tsx` (read only).
- `docs/v2/design/lists-stage4-note.md` (the non-modal header search ruling).

## Files you own

`web/components/search/GlobalSearch.tsx`, `web/styles/search.css`, `web/components/home/CoverSearch.tsx`, new `web/tests/e2e/search-panel.spec.ts`.

## Do not touch

`web/components/shell/**` (SHL2), `web/lib/search/**` and `web/lib/client/**` (LST2, CONS), everything else.

## Steps

1. Reproduce at 1000, 1100, 1440 and 1920 px from both buttons; record the panel rect.
2. Position the panel from the viewport and header (a fixed anchor), never from the clicked button's rect; clamp left and right to the viewport with the page gutter.
3. The header Search button toggles: a second tap or click closes the panel and returns focus to the button.
4. Keep the non-modal rules: no scrim, no focus trap, Esc closes, outside click closes.
5. Write `search-panel.spec.ts`: opens from the hero and the header at the four widths and at 390, asserts the whole panel rect is inside the viewport, and asserts the toggle.

## Acceptance checks

| # | Check |
|---|---|
| 1 | The spec passes on chromium, webkit and firefox |
| 2 | Screenshots at 1440 and 390, light and dark, from both buttons, show the panel whole |
| 3 | No new literal caught by the hard-coding scan |
| 4 | `git diff --name-only` shows only owned paths |

## Server switch

Layout only. The panel calls `search()`, `suggest()` and `parseQuery()` through `web/lib/client/data.ts`, unchanged; a server `GET /api/search?q=` returns the same `SearchResult`. Nothing in this lane reads a file.

## Verification

`pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test`, then your spec only (`pnpm exec playwright test tests/e2e/search-panel.spec.ts`); `bash tools/check-all.sh` with `web/.env.local` moved aside (mode 600) and put back. Screenshots at 1440 and 390, light and dark (theme through the site's own control), GPU flags, into `web/test-results/shots/FIXF/`; read them.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-FIXF`, branch `public/FIXF` from `main`, port 3461. One commit `web(public/FIXF): search panel anchored to the viewport, header Search toggles (9.1)`. `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer from your harness; rebase onto `main`; do not push.

## Hand-back

The commit, the before and after rects at each width, the spec result per browser.
