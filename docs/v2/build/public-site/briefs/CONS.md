# CONS: consistency, server-ready seams, no hard-coded values (lanes CONS-0 to CONS-3)

- **Agent:** `travel-builder` (Sonnet). The consistency table (step 3.4) is ruled by `travel-design-reviewer` (Opus) before CONS-2.
- **Effort:** about 28 h: CONS-0 6 h (phase A, day 1), CONS-1 6 h (phase B), CONS-2 8 h (phase E, first), CONS-3 8 h (phase E, burn-down).
- **Rows:** 13.1 (seams and placeholders), 13.2 (hard-coding), 13.3 (consistency), 13.4 (contract test kit).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) sections 4.2, 5 and 13. Tasks A0, B5, E1, E15.
- **Principles:** P4 (one obvious control per job), P8 (caps in the function), P9 (one data boundary, server-shaped state).
- **Specs:** [principles.md](../../../design/foundation/principles.md) P8 and P9; [SERVER-SIDE-LAUNDRY-LIST.md](../../SERVER-SIDE-LAUNDRY-LIST.md) sections 2 to 4; [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.7.

## Goal

Every feature reads and writes through one typed interface that a server adapter can implement unchanged; every login or backend feature has an explicit placeholder; no product value (colour, threshold, slug, domain, label, endpoint) is typed in more than one place; and check-all fails when someone adds one.

## Read first

- `web/lib/client/data.ts` (750 lines: every exported function), `web/tests/data/boundary.test.ts`, `web/tests/no-hex.test.ts`.
- `web/lib/site.ts` (`siteOrigin()`), `web/lib/public/origin.ts`, `web/lib/map/palette.ts`, `web/lib/globe/palette.ts`.
- EXECUTION-PLAN 5.3: the measured audit with every file path. Re-run the greps first and record any difference.
- `docs/v2/schema.sql` and the laundry list, for the server shapes.

## Files you own (per sub-lane)

| Sub-lane | Paths |
|---|---|
| CONS-0 | `web/lib/client/contract.ts` (new), `web/lib/client/static.ts` (new), `web/lib/client/data.ts` (turn into re-exports of the static adapter; no behaviour change), `web/lib/capabilities.ts` (new), `web/lib/config/product.ts` (new), `core/src/schema/api/**` (new Zod schemas, exported through `core/src/schema/index.ts` and `data/schema/generated/` by the existing export), `docs/v2/build/public-site/README.md` (env table: names only) |
| CONS-1 | `web/tests/cons/**` (new), `web/lib/client/stub.ts` (new, test-only in-memory adapter), `tools/cons/hardcode_scan.py` (new), `tools/cons/baseline.json` (new), `tools/tests/test_hardcode_scan.py` (new), one line in `tools/check-all.sh`, the `no-hex.test.ts` extension to `rgb(`, `hsl(` and named colours |
| CONS-2 | `core/src/geo/**` (new), `core/src/config/nearby.ts` (new), `core/src/privacy/home.ts` (new), and the replacement edits in `core/src/checks/time.ts`, `core/src/relevance/fit.ts`, `derive.ts`, `inputsCheck.ts`, `web/lib/map/geo.ts`, `web/lib/public/origin.ts`, `web/lib/public/places.ts` (the distance line only), `web/lib/public/relevance.ts` (the constant only), `web/components/trips/timeline/model.ts` (labels), `web/components/ui/KindGlyph.tsx` (labels), `tools/geo.py` (new), `tools/locations.py` (distance only), `tools/cons/baseline.json` |
| CONS-3 | `web/lib/public/slugs.ts`, `web/lib/public/globe.ts` (trip to country map only), `web/lib/public/trips.ts` line 180 area, `web/lib/public/places.ts` line 370 area, `web/lib/public/trail-places.ts`, `web/lib/map/palette.ts`, `web/lib/globe/palette.ts`, `core/src/net/**` (new: `ua.ts`, `endpoints.ts`), `tools/net.py` (new), the UA and endpoint lines in `web/scripts/{fetch-photo-credits,tracks-osm,globe-images,globe-cities,commons-cache,og,legs-ors}.mjs`, `tools/globe_data.py`, `tools/locations.py`, `core/src/relevance/signals.ts`, `core/src/sources/links.ts`, `core/src/schema/export.ts`, `web/lib/export/share.ts`, `tools/theme_tokens.py` (fallback output), `tools/cons/baseline.json` |

CONS-2 and CONS-3 edit files other lanes own. Edit a file only when its owning lane is not running (EXECUTION-PLAN 15), and touch only the lines named.

## Do not touch

- Component behaviour, layouts, copy. This lane changes where values come from, never what the visitor sees. Screenshots before and after must match.
- Generated files (`web/app/themes.css`, `data/schema/**`, `docs/v2/research/capture/**`, `web/redirects.json`): regenerate them with their tools.
- `web/.env.local`: never read it into output, never print it.

## Steps

### CONS-0 (phase A, day 1)

1. Write `DataClient` in `contract.ts`: one method per seam in EXECUTION-PLAN 5.2 (list, count, search, suggest, parse, detail readers used at runtime, globe readers, export, near (`resolveNear`, `nearPlaces`, `townsNear`, `townParts` as stubs that return the documented error shape until LST2c), `reportProblem`, `session`). Types are `z.infer` of the Zod schemas in `core/src/schema/api/`. Every response carries a typed error shape `{ok:false, code, message}`.
2. Move today's implementations into `static.ts` unchanged; `data.ts` re-exports them so no import elsewhere changes.
3. `capabilities.ts`: `signIn`, `saveToTrip`, `guestDrafts`, `tripBuilder`, `collab`, `reportForm`, `serverLists`, `serverNear`, `serverSearch`, `serverDetail`, `serverExport`, `serverRouting`, all `false`, read from one object (a build env can override later; no env var is added now). Each flag's doc comment names its laundry-list item.
4. `config/product.ts`: `reportUrl` (value from Q70; until then `null`, and A3 hides the link), page sizes, shard rows (moved from `lib/entities/shards.ts` by re-export, no value change), budgets (place page JS, Around here bytes, town part gzip). Thresholds for nearby go to `core/src/config/nearby.ts` in CONS-2.
5. Env table in the public-site README: every `process.env` name read in `web/`, `core/`, `tools/`, what it does, whether it is public; no values.

### CONS-1 (phase B)

6. `hardcode_scan.py`: one rule per class in EXECUTION-PLAN 5.3 (colour literals, trip-slug literals, the site host outside `site.ts` and the UA modules, the UA string, external API hosts, `6371`, `_KM =` thresholds, kind-label maps, counts in JSX text, `process.env` names missing from the env table). It prints `file:line rule` and writes or compares `baseline.json`. check-all fails on a finding not in the baseline.
7. Intentional exceptions, written into `baseline.json` with a reason each: the MapLibre worker fetch in `MapLibreMap.tsx`; the household home point module (CONS-2) while the repo is private; motion `_MS` constants (until a foundation ruling); unit conversion constants in `web/lib/format/units.ts`; test fixtures.
8. `stub.ts`: an in-memory `DataClient` over a small fixture (20 places across 3 countries, 2 trips, 10 towns), implementing the caps itself.
9. Contract kit `web/tests/cons/contract/<seam>.test.ts`: one case table per seam run against `static.ts` (on the test build) and `stub.ts`. Required cases: page size never exceeded; list rows carry only allowlist keys; `near` with `r=500` clamps to 100 and says so; an unknown centre returns the error shape and loads nothing; an unscoped near query is refused; export is one item; `reportProblem` returns `{kind:'link'}`; `session()` is `null`.

### CONS-2 (phase E, first; before LST2b, PLC2b, LST2c, TRP2)

10. `core/src/geo/distance.ts`: `haversineKm`, `bearing8`, `bboxOf`, `circleMeetsBbox`. Replace the 8 copies (EXECUTION-PLAN 5.3); `tools/geo.py` mirrors it with a parity test over 20 shared cases.
11. `core/src/config/nearby.ts`: `NEAR_KM=25`, `DAY_TRIP_KM=100`, `RADIUS_PRESETS=[10,25,50,100]`, `RADIUS_CAP=100`, `AREA_DEFAULT_R=50`, `WALK_KM=1.2`, the drive bands and `PAIR_COLLAPSE_M=200`. Replace `NEAR_KM` and `AREA_KM` in `core/src/relevance/derive.ts` and `NEARBY_MAX_KM` in `web/lib/public/relevance.ts` by imports. Values do not change.
12. `core/src/privacy/home.ts`: the public start city and the home point with its radius, read by `web/lib/public/origin.ts` and `core/src/relevance/inputsCheck.ts`.
13. Kind labels: `timeline/model.ts` and `KindGlyph.tsx` read labels from `web/lib/entities/labels.ts` (from `types.json`); glyph paths stay in `Icon.tsx`.
14. Present the consistency table (EXECUTION-PLAN 5.4) to `travel-design-reviewer` for a one-paragraph ruling; record it in `docs/v2/design/foundation/patterns.md` (a short "One component per job" section) if the reviewer agrees.

### CONS-3 (phase E, as owners finish)

15. Slug tables: derive folder-to-slug from `legacy/MANIFEST.json` (or the trip data) and trip-to-country from the trip's stops; remove the special cases at `trips.ts:180`, `places.ts:370`, `trail-places.ts:92` and `:230` in favour of trip data flags (`depth`, `default_area`). `sources.ts:129` stays until 7.11 moves the Rockies data; list it in the baseline with that reason.
16. Palette fallbacks: `theme_tokens.py` also writes a generated `web/lib/map/palette.generated.ts`; the two palette modules read it.
17. One UA and one endpoint list: `core/src/net/ua.ts` and `endpoints.ts`, `tools/net.py`; every script imports them. The UA string itself is unchanged.
18. The site host appears only in `web/lib/site.ts` and the UA modules.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `pnpm --dir web typecheck` passes with every component unchanged after CONS-0 |
| 2 | The boundary test, the contract kit (both adapters) and the scan pass in check-all |
| 3 | A test commit adding `rgb(0 128 0)`, `'dolomites-july-2027'` in a component, or `const X_KM = 25` fails check-all |
| 4 | After CONS-2: `6371` only in the two geo modules; 25 km defined once; the home radius defined once |
| 5 | After CONS-3: the baseline holds only the intentional exceptions |
| 6 | Screenshots at 1440 and 390, light and dark, of home, a trip, a place and the globe match the pre-lane shots (pixel diff under 0.1%) |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

This lane is the switch. Every seam ends with: a `DataClient` method, a Zod request and response in `core/src/schema/api/`, the static implementation, the stub, and the contract cases. A server adapter later implements the same interface; components, URLs, types and tests stay unchanged.

## Verification

`pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test`, `python3 -m pytest tools/tests -q`, then `bash tools/check-all.sh` with `web/.env.local` moved aside to a mode-600 file and put back after. Run only the e2e specs of the pages you touched (`pnpm exec playwright test tests/e2e/<file> --project=chromium`); the coordinator runs the full suite on a quiet machine. Playwright screenshots at 1440 and 390, light and dark (theme set through the site's own control), on the GPU flags (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`), into `web/test-results/shots/CONS/`; read them in 1600 px tiles.

## Commit rules

- Worktree: `git -C /home/nitin27may/workspace/travel worktree add /home/nitin27may/workspace/travel-wt/v2-CONS -b public/CONS main` (one branch per sub-lane: `public/CONS0` and so on). Dev port 3467.
- One commit per step group: `web(public/CONS): ...`, `core(CONS): ...`, `tools(CONS): ...`.
- Stage owned paths only with `git -C <worktree> add <paths>`, never `-A`. End each message with the Co-Authored-By trailer your harness provides.
- Rebase onto `main` before hand-back. Do not push. Kill any server you start by its PID.

## Hand-back

The commits; the `DataClient` method list; the baseline before and after with counts per class; the exceptions with reasons; the contract case count per seam; any finding that needed a behaviour change (there should be none).
