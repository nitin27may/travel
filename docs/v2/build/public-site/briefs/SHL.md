# SHL: shell, home and e2e on the GPU (stage 4)

> **Round 2 (20 Oct 2026):** this stage 4 brief is done. The next round for these files is [SHL2.md](SHL2.md), under [EXECUTION-PLAN.md](../EXECUTION-PLAN.md).

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 4 h.
- **Rows:** 3.34, 2.41 (mobile nav slot), 4.15 (shell part).
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Principles:** P4, P7, T2.
- **Starts:** when D2 has merged. **Merges first** in stage 4.
- **Review:** verifier only. No Opus review before or after; REVIEW4 looks at the result.

## Goal

1. **e2e runs on the GPU (3.34).** The chromium project in `web/playwright.config.ts` launches with the Arc flags `--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`, so the motion and map tests run as the owner sees them. WebKit and Firefox stay as they are.
2. **The phone bottom bar spends no slot on Sign in (2.41, 4.15).** The public site has no login, so the fourth slot becomes **Search**: it opens the header search. Sign in returns when the planner ships. Keep the `/sign-in/` page and its link in the header menu; it already says plainly that the planner is coming (2.13).
3. **The home page at 390 (4.15).** At 390 the globe sits above the search card and the first screen has no heading. Put a visible `h1` and the search card first, with the globe cover after them. Desktop is unchanged.

## Read first

- `web/playwright.config.ts`, `web/tests/e2e/global-setup.ts`.
- `web/components/shell/BottomBar.tsx`, `SiteHeader.tsx`. Search is opened through `GlobalSearch` (owned by LST): read how `SiteHeader` opens it, and reuse that event or prop. Do not edit `components/search/**`.
- `web/app/page.tsx`, `web/components/home/*`.
- `docs/v2/design/foundation/components.md` 1.4 (bottom bar), and `verify-integration.md` section 5, items 19 and 20.
- [README.md](../README.md) 4.2 (working rules) and 8 (gotchas).

## Files you own

`web/playwright.config.ts`, `web/tests/e2e/global-setup.ts`, `web/components/shell/**`, `web/components/home/**` except `CoverSearch.tsx` and `CoverGlobe.tsx`, `web/components/ui/**`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/not-found.tsx`, `web/app/app.css`, `web/app/globals.css`, `tools/theme_tokens.py` and the generated `web/app/themes.css`. Tests: `web/tests/shell/**` (new) and `web/tests/e2e/home*.spec.ts`.

## Do not touch

- `components/search/**`, `components/entity/**`, `CoverSearch.tsx` (LST).
- `CoverGlobe.tsx` and `components/globe/**` (GLB).
- Everything under places, trips and globe.
- `components/ui/**` changes are limited to what this brief needs. Other lanes request UI changes from you, and you list each one in the hand-back.

## Steps

1. Add the launch args to the chromium project only. Then run the whole e2e suite twice, and list every spec that changes result on the GPU. A spec that only passed on SwiftShader is a real fault; report it, and do not loosen it.
2. In `BottomBar`, replace Sign in with Search (the search glyph, the label "Search"). It opens the same search as the header button, with focus in the input. Update the e2e that counts the bar items.
3. Home at under 640 px: `h1`, then the search card, then the cover. Use CSS order or source order, whichever keeps the desktop layout identical. Check that LCP on the phone is still the hero text or the first image, not the globe canvas.
4. Unit and e2e tests for 2 and 3.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `chromium` launches with the four flags. A test reads `chrome://gpu` (or the WebGL renderer string) and finds no "SwiftShader" |
| 2 | The full e2e passes on all four projects; any spec whose result changed is listed |
| 3 | At 390 the bar reads Trips, Places, Globe, Search; Search opens the search with focus in the input; Esc returns focus to the bar button |
| 4 | At 390 the first screen shows the `h1` and the search card above the fold, light and dark |
| 5 | axe is clean on home and on the bar; no horizontal scroll at 390 |
| 6 | `git diff --name-only` shows only owned paths |

## Verification

`pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test && pnpm --dir web build && pnpm --dir web e2e`, then `python3 tools/theme_tokens.py --check`.

Screenshots: home and the bottom bar at 1440 and 390, light and dark, 2x, into `web/test-results/shots/SHL/`. Read them before hand-back. Then travel-verifier re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-SHL`, branch `public/SHL`, dev port 3451.
- **Commits:**
  1. `web(public/SHL): e2e runs chromium on the GPU (3.34)`
  2. `web(public/SHL): phone bar Search slot, home order at 390`
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back. Do not push.

## Hand-back

Keep it short:
- the commits and the test counts;
- the specs whose result changed on the GPU;
- any `components/ui` request you received from another lane, and what you did with it.


## Added 19 Oct: replace the green status colour (row 4.16, Q47 decided)

The owner's rule is no green anywhere, and the coordinator decided the one documented green (`--ok`, `#1D6B3A` light and `#8FD0A0` dark, with `--ok-soft`) goes too.
1. In the token source, replace `--ok`, `--ok-soft` and any green hex with a non-green status pair: a deep slate-blue family that meets AA text contrast (4.5:1) on its soft background in light and dark, and is distinct from the amber accent and the navy header. Regenerate with `python3 tools/theme_tokens.py`. Update `docs/v2/design/foundation/tokens.md` (remove "the only green").
2. The "fits" chip, the rule chip and every `--ok` use keep a check or lock glyph and its text, so colour is never the only signal. Check every place `--ok` is used (`grep -rn "\-\-ok" web`), including suitability chips, the day-fit line and the legend.
3. A test: no theme token resolves to a green hue (hue 80-170 degrees in HSL with saturation above 15%), for light and dark, outside the map's own style file. If the map style has greens (land, wood, water), report them; the globe and map were already made green-free in L2b, so any remaining green is a bug.
4. Shoot the chips in light and dark at 1440 and 390, read them, and run axe on the pages that show them.
