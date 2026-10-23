# GLB2: globe fixes (part a, phase A) and city outlines and home look (part b, phase E)

> **Revised 23 Oct (phase E start sheet).** Part a is merged (phase A, with the R1 fix lanes GLB2c and GLB2d). Part b runs from [PHASE-E-START.md](../PHASE-E-START.md) last in seat A, Sat 31 Oct to Tue 3 Nov, after META-2; it is the first feature cut to after R2 if the allowance runs short (owner decision Q91). Changes in this brief: the task is EXECUTION-PLAN **E12** (not E13); the home-look mock exists (`docs/v2/design/globe/mock/index.html`) and waits for the owner's approval at R1 item 7, so part b's design step is a ruling on the city outline style plus the review after (Opus, about 2 h), not a new mock; if the mock is not approved by the start day, build the city outlines (steps 8 and 9) and leave the home look (step 10) until it is. Every town comes from META-2's `data/reference/towns/` after API-3's `safeTown()` has run, so a town whose outline would come within the home radius is served as the ring; never special-case a town by name. `globeCity` is filled in a new `core/src/catalogue/json/globe-city.ts` with one line in `json/index.ts` (collision E1); `core/src/schema/api/**` is API-3's (E2); the route `web/app/api/v1/globe/city/[townId]/route.ts` exists. The globe card path is `{kind}/{slug}` since API-3. CONS-3 edits the trip-to-country table in `web/lib/public/globe.ts` and the UA lines of `globe-cities.mjs` and `globe_data.py` before part b starts (collision E19). Acceptance 6's "Pages file count" is obsolete (no static export); report the file count and total size instead. Overpass for the outlines runs strictly alone, under the lock (`flock` is not installed on this Mac: `brew install flock` first, or use a script that takes its own lock). Worktree `/Users/nks/workspace/travel-wt/v2-GLB2b`, branch `public/GLB2b`, port 3484. GPU flag on macOS: `--use-angle=metal`.

Extends [GLB.md](GLB.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet). Part b's look is designed first by `travel-design-reviewer` (Opus): a note and a mock the owner approves at R1.
- **Effort:** part a about 19 h (15 h plus 4 h of globe and home polish from the coverage sweep); part b about 25 h (note and mock 5 h, build 20 h).
- **Rows:** part a: 9.7 (Fly here, landform centres), 9.4 (rivers draw a line), 9.8 and Q52 (Natural features switch, default on), and the polish lines R4-H1, R4-H2, 3.65a, 3.65b, VI-1 and the `globe.motion.gpu.spec.ts:270` fixme in [COVERAGE.md](../COVERAGE.md). Part b: 9.3 (city outlines from the towns layer), 9.2 (home cover globe look).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks A4 to A6 and E12 (corrected 23 Oct; was "E13"). Causes in [OWNER-ROUND1-plan.md](../OWNER-ROUND1-plan.md) items 2 to 6.
- **Specs:** [design/globe/spec.md](../../../design/globe/spec.md), [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.6 (one town list, outlines per city).
- **Principles:** P1, P3, P5, T5 (honest maps), P8 (geometry is not the catalogue).
- **Starts:** part a day 1 (no API dependency: call only the existing boundary functions; `globeLine(id)` is appended with its final signature); part b when gate G-B has closed, META-2 (towns) has merged and the owner has approved the mock at R1. Part b reads through the API (`globeCity` on `CatalogueStore`, `GET /api/v1/globe/city/{id}`).
- **Opus review:** part a after; part b before (note and mock) and after.

## Goal

Every globe pick lands where the card says, a line feature draws its line, a visitor can switch natural features off, every listed city has an outline or an honest ring, and the home globe looks designed in light and dark.

## Read first

- BACKLOG 9.2, 9.3, 9.4, 9.7, 9.8 word for word (9.7 has the Ganges Plain repro: `?c=86.951,19.368,3.20`).
- `web/components/globe/SelectionCard.tsx` (`onFly`), `web/lib/globe/controller.ts` (class zoom table), `framing.ts`, `flight.ts`, `search.ts`, `web/lib/public/globe.ts`, `tools/globe_data.py`, `web/scripts/globe-cities.mjs`, `web/public/globe/data/cities-adm8.json` (45 cities today).
- `data/reference/towns/**` and `core/src/derive/near.ts` (META-2) for part b.

## Files you own

| Part | Paths |
|---|---|
| a and b | `web/components/globe/**`, `web/lib/globe/**`, `web/app/globe/**`, `web/app/globe-data/**`, `web/styles/globe.css`, `web/public/globe/**`, `tools/globe_data.py`, `web/scripts/globe-*.mjs`, `data/reference/globe/**`, `web/lib/public/globe.ts` (not the trip-to-country table, which CONS-3 owns), `web/tests/globe/**`, `web/tests/e2e/globe*.spec.ts` |
| a (polish) | `web/components/home/CoverGlobe.tsx` for the hint and the cluster radius |
| b only | `web/components/home/CoverGlobe.tsx`, `core/src/catalogue/json/globe-city.ts`, `web/app/api/v1/globe/city/**`, `web/public/globe/city/**` (new), the globe sections of `docs/v2/design/globe/spec.md` |
| boundary | an appended section `// globe (GLB2)` in `web/lib/client/data.ts` for `globeLine(id)` and `globeCityOutline(townId)`, plus their `DataClient` entries in `contract.ts`; coordinate with LST2 on rebase |

## Do not touch

`data/reference/towns/**` and `tools/towns.py` (META-2: read them, never build your own town list), `web/redirects.json`, `web/lib/map/**` (TRP2 in E), `web/app/themes.css` (generated; token changes go through `tools/theme_tokens.py` and the design reviewer), everything else.

## Steps

### Part a

1. **One fit model.** Every feature class gets a fit: point (zoom by class), line (fit the simplified line's bbox), area (fit the polygon). The card anchors on it; Fly here animates there and writes `?c=` with `replaceState`.
2. **Landform centres.** Audit every landform and water feature row in the gazetteer: its point must lie inside its bbox. Fix the source of the mismatch in `globe_data.py` (point or bbox from different rows, or a lon and lat swap), regenerate, and report the count fixed.
3. **Rivers and other lines.** A river, range or coast draws its own simplified line (OSM waterway or Natural Earth line, ODbL or public domain, credited), never the parent state. Files per feature, loaded on pick through `globeLine(id)`.
4. **Natural features switch.** Map options gains "Natural features", default on; off removes rivers, ranges, plains, deltas and seas from search and map picking; `nf=0` in the URL, no storage; search groups places, regions and cities first, features last.
5. **Polish (coverage lines).** Check each first and report it if already fixed: the phone hint "Tap a pin to open its country" shows only once pins draw (R4-H1); the cover and `/globe/` use one cluster radius (R4-H2); prewarm sprites and shaders at idle and defer the panel re-render to `moveend` on pitched search picks (3.65a), then record the long-task numbers in the `globe.motion.gpu.spec.ts:270` fixme (keep it fixme with numbers if MapLibre's own tasks still break 100 ms); confirm the data growth (gazetteer +41 KB gzip) does not reach the home page (3.65b); label collisions, the translucent Style panel, cluster overlaps and pins below a 24 px target (VI-1).
6. e2e: pick a river, a plain, a delta, a lake and a range from search; assert the camera ends inside each feature's box and a river draws a line; the switch survives a reload of the link.

### Part b

7. **Design first.** The design reviewer writes `docs/v2/design/globe/home-look-note.md` with a mock for 9.2 (sky or space background that works in light and dark, richer ocean, more labels at rest, no green, contrast AA) and a ruling on the city outline style. The owner approves it at R1.
8. **City outlines.** For each town in `data/reference/towns/` that is listed somewhere (a place within 25 km, a hub or a base; about 300 to 600), fetch the OSM admin boundary by the town's Wikidata QID through Overpass, 20 QIDs a query, sequentially under `flock /tmp/travel-overpass.lock` with the user agent from the one UA module. Simplify to 1 to 3 KB, write `/globe/city/<town-id>.json`. Measure the total first and report it.
9. **Fallback.** A town with no polygon keeps the ring (casing plus amber) and the card says why.
10. **Home look.** Build the approved mock in `CoverGlobe.tsx` and the globe tokens (through `theme_tokens.py`).

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Fly here moves the camera for every class; the camera ends inside the feature box (e2e, 5 classes) | 9.7, P5 |
| 2 | Ganges Plain's centre lies inside its box; the audit count is reported | 9.7, T5 |
| 3 | Ganges, Danube, Nile draw lines; no state outline | 9.4 |
| 4 | `nf=0` removes features from search and picking and survives a reload | 9.8 |
| 5 | Ten cities (Whitby, Banff, Calgary, Quebec City, Canmore, Cortina d'Ampezzo, Chamonix, Reykjavik, Bolzano, Huntsville) each show an outline or the stated ring | 9.3 |
| 6 | City outline files 1 to 2 KB gzip each; the total and count reported (the static-host file limit no longer applies, 23 Oct) | P8 |
| 7 | Home globe matches the approved mock; contrast AA in both themes; the hue scan finds 0% green | 9.2 |
| 8 | No new literal caught by the hard-coding scan (colours only from tokens) | CONS |
| 9 | Polish: the hint, one cluster radius, long-task numbers, home bundle unaffected, targets at least 24 px | coverage |
| 10 | `git diff --name-only` shows only owned paths | |

## Server switch

`globeGazetteer()`, `globeCard()`, `globeLine(id)` and `globeCityOutline(townId)` are `DataClient` methods with Zod shapes; today they read per-feature files, later `GET /api/v1/globe/feature/:id`, `/line/:id`, `/city/:id`. The fit model and search ranking are pure modules in `web/lib/globe/`. The `nf`, `c` keys are the same on static and server. Components never fetch a globe file directly.

## Verification

Typecheck, lint, unit tests, your globe specs only (`pnpm exec playwright test tests/e2e/globe` on chromium and webkit), `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. `globe_data.py` has no `--check`; say which subcommand you ran and commit its output. Screenshots at 1440 and 390 (plus 844 x 390), light and dark, on the GPU flags, into `web/test-results/shots/GLB2/`: the Ganges river and plain picks, the switch off, five city outlines, the home cover. Read them in tiles.

## Commit rules

Part b: worktree `/Users/nks/workspace/travel-wt/v2-GLB2b`, branch `public/GLB2b` from `main` (`git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-GLB2b -b public/GLB2b main`, then `pnpm install --frozen-lockfile` at the worktree root), port 3484. Part a used `v2-GLB2a`, now merged. Commits per step group: `web(public/GLB2): ...`, `tools(GLB2): ...`. Owned paths only, `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push. Overpass strictly one runner.

## Hand-back

Commits; the landform audit count; the city outline count, total size and fallback count; the Overpass run record; the long-task numbers on two flights.
