# CONS: consistency and no hard-coded values (lanes CONS-1 to CONS-3)

> **Changed 20 Oct 2026 (owner):** the server seams (the typed `DataClient`, Zod contracts, capability flags, placeholder adapters and the contract kit with its stub) moved to lane API-1 ([API.md](API.md)), because the owner decided to build API-over-JSON now. CONS-0 no longer exists. `web/lib/capabilities.ts` is created by SHL2 in phase A and extended by API-1; `web/lib/config/product.ts` is created by SHL2 (`reportUrl`) and extended by CONS-1.

> **Revised 21 Oct (start sheet).** Order, models, worktrees, ports and preconditions come from [PHASE-B-START.md](../PHASE-B-START.md): CONS-1 runs in slot 1 (after API-0, beside META-0), CONS-2 in slot 5 (after API-2). Changes in this brief: macOS worktree paths and the Metal GPU flag; models by the 21 Oct rubric (both B sub-lanes Sonnet; the CONS-2 privacy step is audited by Opus at G-B); the check-all anchor for the scan line; the README section CONS-1 adds; the slug table rows of CONS-3 now respect the slug registry API-1a creates (decision D-B1); the pre-flight grep is a Haiku task.

- **Agents and models:** `travel-builder` on **Sonnet** for CONS-1 and CONS-2 (guards and consolidation with parity tests, well specified). Escalate one step to Opus only if a hand-back shows a judgement error. The consistency table (step 8) is ruled by `travel-design-reviewer` (**Opus**) before CONS-2 closes. The re-measurement of EXECUTION-PLAN 5.3 before each sub-lane is a **Haiku** `explorer` task (grep counts). CONS-3 (phase E) is Sonnet.
- **Effort:** about 23 h: CONS-1 6 h plus 0.5 h verify (phase B, slot 1), CONS-2 8 h plus 1 h ruling and 0.5 h verify (phase B, slot 5, closed at G-B), CONS-3 8 h (phase E, burn-down).
- **Rows:** 13.2 (hard-coding), 13.3 (consistency). 13.1 and 13.4 are API-1.
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) sections 4.3 and 5. Tasks B4, B5, E14. [PHASE-B-START.md](../PHASE-B-START.md) sections 3 (collisions C1, C2, C6, C9, C19) and 7 (check-all order).
- **Principles:** P4 (one obvious control per job), P8 (caps in the function), P9 (one data boundary, server-shaped state).
- **Specs:** [principles.md](../../../design/foundation/principles.md) P8 and P9; [SERVER-SIDE-LAUNDRY-LIST.md](../../SERVER-SIDE-LAUNDRY-LIST.md) sections 2 to 4; [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.7.

## Goal

No product value (colour, threshold, slug, domain, label, endpoint) is typed in more than one place; and check-all fails when someone adds one.

## Read first

- `web/lib/client/data.ts` (781 lines on 21 Oct: every exported function), `web/tests/data/boundary.test.ts`, `web/tests/no-hex.test.ts`.
- `web/lib/site.ts` (`siteOrigin()`), `web/lib/public/origin.ts` (in `core/src/privacy/` with a re-export after API-2), `web/lib/map/palette.ts`, `web/lib/globe/palette.ts`, `web/lib/entities/labels.ts`.
- EXECUTION-PLAN 5.3: the measured audit with every file path. The Haiku pre-flight re-runs the greps on the current `main`; record any difference in the hand-back. API-0 and API-1 add files after 20 Oct, so counts will have moved.
- `docs/v2/schema.sql` and the laundry list, for the server shapes.

## Files you own (per sub-lane)

| Sub-lane | Paths |
|---|---|
| CONS-1 | `web/tests/cons/**` (new), `web/lib/config/product.ts` (extend: page sizes, budgets), a new "Environment variables" section in `docs/v2/build/public-site/README.md` (API-0 owns the build and run section), `tools/cons/hardcode_scan.py` (new), `tools/cons/baseline.json` (new), `tools/tests/test_hardcode_scan.py` (new), one step line in `tools/check-all.sh` (after "source registry", PHASE-B-START section 7 step 6), the `no-hex.test.ts` extension to `rgb(`, `hsl(` and named colours |
| CONS-2 | `core/src/geo/**` (new), `core/src/config/nearby.ts` (new), `core/src/privacy/home.ts` (new), and the replacement edits in `core/src/checks/time.ts`, `core/src/relevance/fit.ts`, `derive.ts`, `inputsCheck.ts`, `web/lib/map/geo.ts`, `core/src/privacy/` (the scrub after API-2 moved it), `web/lib/public/places.ts` (the distance line only), `web/lib/public/relevance.ts` (the constant only), `web/components/trips/timeline/model.ts` (labels), `web/components/ui/KindGlyph.tsx` (labels), `tools/geo.py` (new), `tools/tests/test_geo_parity.py` (new), `tools/locations.py` (distance only), `tools/cons/baseline.json` |
| CONS-3 | `web/lib/public/slugs.ts` (the trip slug tables only; the place slug functions are re-exports of `core/src/catalogue/slugs.ts` since API-1a), `web/lib/public/globe.ts` (trip to country map only), `web/lib/public/trips.ts` line 180 area, `web/lib/public/places.ts` line 370 area, `web/lib/public/trail-places.ts`, `web/lib/map/palette.ts`, `web/lib/globe/palette.ts`, `core/src/net/**` (new: `ua.ts`, `endpoints.ts`), `tools/net.py` (new), the UA and endpoint lines in `web/scripts/{fetch-photo-credits,tracks-osm,globe-images,globe-cities,commons-cache,og,legs-ors}.mjs`, `tools/globe_data.py`, `tools/locations.py`, `core/src/relevance/signals.ts`, `core/src/sources/links.ts`, `core/src/schema/export.ts`, `web/lib/export/share.ts`, `tools/theme_tokens.py` (fallback output), `tools/cons/baseline.json` |

CONS-2 and CONS-3 edit files other lanes own. Edit a file only when its owning lane is not running (PHASE-B-START section 2 in B; EXECUTION-PLAN 15 in E), and touch only the lines named.

## Do not touch

- Component behaviour, layouts, copy. This lane changes where values come from, never what the visitor sees. Screenshots before and after must match.
- Generated files (`web/app/themes.css`, `data/schema/**`, `research/types/**`, `web/redirects.json`, `data/catalogue/slugs.json`): regenerate them with their tools.
- `web/.env.local`: never read it into output, never print it.
- Any line an open R1 row names.

## Steps

### CONS-1 (phase B, slot 1)

1. `hardcode_scan.py`: one rule per class in EXECUTION-PLAN 5.3 (colour literals, trip-slug literals, the site host outside `site.ts` and the UA modules, the UA string, external API hosts, `6371`, `_KM =` thresholds, kind-label maps, counts in JSX text, `process.env` names missing from the env table). It prints `file:line rule` and writes or compares `baseline.json`. check-all fails on a finding not in the baseline. It scans `core/`, `web/` (not `node_modules`, `.next*`, `.fixture-*`, `public/`), `tools/`, and skips JSON values under `data/` (refs and URLs there are data).
2. Intentional exceptions, written into `baseline.json` with a reason each: the MapLibre worker fetch in `MapLibreMap.tsx`; the household home point module (CONS-2) while the repo is private; motion `_MS` constants (until a foundation ruling); unit conversion constants in `web/lib/format/units.ts`; test fixtures; the 308 and port numbers in the e2e harness.
3. The env table: every `process.env` name read in `web/`, `core/`, `tools/`, what it does and whether it is public, with no values, in the public-site README. It must include the names phase B adds (`NEXT_PUBLIC_DATA_ADAPTER`, `CATALOGUE_STORE`, `SKIP_WEB_BUILD`, `PW_REUSE_SITE`, `PW_SITE_URL`) and the 20 Oct gaps (`NEXT_PUBLIC_CF_BEACON_TOKEN`, `TRAVEL_TODAY`, `HUB_TODAY`, the `*_LOCKED` switches). A test fails on a name missing from it.

### CONS-2 (phase B, slot 5: after API-2 has moved `origin.ts`; before LST2b, PLC2b, LST2c, TRP2)

4. `core/src/geo/distance.ts`: `haversineKm`, `bearing8`, `bboxOf`, `circleMeetsBbox`. Replace the 8 copies (EXECUTION-PLAN 5.3, re-measured); `tools/geo.py` mirrors it with a parity test over 20 shared cases.
5. `core/src/config/nearby.ts`: `NEAR_KM=25`, `DAY_TRIP_KM=100`, `RADIUS_PRESETS=[10,25,50,100]`, `RADIUS_CAP=100`, `AREA_DEFAULT_R=50`, `WALK_KM=1.2`, the drive bands and `PAIR_COLLAPSE_M=200`. Replace `NEAR_KM` and `AREA_KM` in `core/src/relevance/derive.ts` and `NEARBY_MAX_KM` in `web/lib/public/relevance.ts` by imports. API-1's `near()` cap reads `RADIUS_CAP` from here once it exists (until then API-1 keeps its literal in the baseline). Values do not change.
6. `core/src/privacy/home.ts`: the public start city and the home point with its radius, read by the scrub (moved to `core/src/privacy/` by API-2) and `core/src/relevance/inputsCheck.ts`. This is the privacy step: write it so the G-B Opus audit can read the whole change in one diff.
7. Kind labels: `timeline/model.ts` and `KindGlyph.tsx` read labels from `web/lib/entities/labels.ts` (from `types.json`); glyph paths stay in `Icon.tsx`.
8. Present the consistency table (EXECUTION-PLAN 5.4) to `travel-design-reviewer` for a one-paragraph ruling; record it in `docs/v2/design/foundation/patterns.md` (a short "One component per job" section) if the reviewer agrees.

### CONS-3 (phase E, as owners finish)

9. Slug tables: derive folder-to-slug from `legacy/MANIFEST.json` (or the trip data, after TD-2) and trip-to-country from the trip's stops; remove the special cases at `trips.ts:180`, `places.ts:370`, `trail-places.ts:92` and `:230` in favour of trip data flags (`depth`, `default_area`). Place slugs are not CONS-3's: they come from the slug registry (`data/catalogue/slugs.json`) and never change silently. `sources.ts:129` stays until 7.11 moves the Rockies data; list it in the baseline with that reason. Run after TD-2, which also edits `slugs.ts` and `sources.ts`.
10. Palette fallbacks: `theme_tokens.py` also writes a generated `web/lib/map/palette.generated.ts`; the two palette modules read it.
11. One UA and one endpoint list: `core/src/net/ua.ts` and `endpoints.ts`, `tools/net.py`; every script imports them. The UA string itself is unchanged.
12. The site host appears only in `web/lib/site.ts` and the UA modules.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `pnpm --dir web typecheck` passes with every component unchanged |
| 2 | The boundary test and the scan pass in check-all |
| 3 | A test commit adding `rgb(0 128 0)`, `'dolomites-july-2027'` in a component, or `const X_KM = 25` fails check-all |
| 4 | After CONS-2: `6371` only in the two geo modules; 25 km defined once; the home radius defined once; the geo parity test passes 20 of 20 |
| 5 | After CONS-3: the baseline holds only the intentional exceptions |
| 6 | Screenshots at 1440 and 390, light and dark, of home, a trip, a place and the globe match the pre-lane shots (pixel diff under 0.1%) |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

The modules this lane creates (`core/src/geo`, `core/src/config`, `core/src/privacy/home.ts`, `core/src/net`) are pure and framework-free, so `JsonStore`, a handler, the build and a later `SupabaseStore` all use the same values. The seams themselves are API-1's.

## Verification

`pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test`, `python -m pytest tools/tests -q` from the venv (system `python3` has no pytest; PHASE-B-START section 1 names the venv), then `PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside to a mode-600 file and put back after. Run only the e2e specs of the pages you touched (`pnpm exec playwright test tests/e2e/<file> --project=chromium`); the coordinator runs the full suite on a quiet machine. Playwright screenshots at 1440 and 390, light and dark (theme set through the site's own control), on the project's `GPU_ARGS` (on macOS `--use-gl=angle --use-angle=metal --ignore-gpu-blocklist --enable-gpu-rasterization`), into `web/test-results/shots/CONS/`; read them in 1600 px tiles. Never touch port 3440 (preview 1).

## Commit rules

- Worktree: `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-CONS1 -b public/CONS1 main` (one branch per sub-lane: `public/CONS1`, `public/CONS2`, `public/CONS3`), then `pnpm install --frozen-lockfile` at the worktree root. Dev port 3467.
- One commit per step group: `web(public/CONS): ...`, `core(CONS): ...`, `tools(CONS): ...`.
- Stage owned paths only with `git -C <worktree> add <paths>`, never `-A`. End each message with the Co-Authored-By trailer your harness provides.
- Rebase onto `main` before hand-back; keep every other lane's check-all line. Do not push. Kill any server you start by its PID.

## Hand-back

The commits; the model used; the baseline before and after with counts per class (and the Haiku re-measure against EXECUTION-PLAN 5.3); the exceptions with reasons; the parity case count; any finding that needed a behaviour change (there should be none).
