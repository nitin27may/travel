# GLB2: globe fixes (part a, phase A) and city outlines and home look (part b, phase E)

Extends [GLB.md](GLB.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet). Part b's look is designed first by `travel-design-reviewer` (Opus): a note and a mock the owner approves at R1.
- **Effort:** part a about 15 h; part b about 25 h (note and mock 5 h, build 20 h).
- **Rows:** part a: 9.7 (Fly here, landform centres), 9.4 (rivers draw a line), 9.8 and Q52 (Natural features switch, default on). Part b: 9.3 (city outlines from the towns layer), 9.2 (home cover globe look).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks A4 to A6 and E13. Causes in [OWNER-ROUND1-plan.md](../OWNER-ROUND1-plan.md) items 2 to 6.
- **Specs:** [design/globe/spec.md](../../../design/globe/spec.md), [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.6 (one town list, outlines per city).
- **Principles:** P1, P3, P5, T5 (honest maps), P8 (geometry is not the catalogue).
- **Starts:** part a day 1; part b when META-2 (towns) has merged and the owner has approved the mock at R1.
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
| b only | `web/components/home/CoverGlobe.tsx`, `web/public/globe/city/**` (new), the globe sections of `docs/v2/design/globe/spec.md` |
| boundary | an appended section `// globe (GLB2)` in `web/lib/client/data.ts` for `globeLine(id)` and `globeCityOutline(townId)`, plus their `DataClient` entries in `contract.ts`; coordinate with LST2 on rebase |

## Do not touch

`data/reference/towns/**` and `tools/towns.py` (META-2: read them, never build your own town list), `web/redirects.json`, `web/lib/map/**` (TRP2 in E), `web/app/themes.css` (generated; token changes go through `tools/theme_tokens.py` and the design reviewer), everything else.

## Steps

### Part a

1. **One fit model.** Every feature class gets a fit: point (zoom by class), line (fit the simplified line's bbox), area (fit the polygon). The card anchors on it; Fly here animates there and writes `?c=` with `replaceState`.
2. **Landform centres.** Audit every landform and water feature row in the gazetteer: its point must lie inside its bbox. Fix the source of the mismatch in `globe_data.py` (point or bbox from different rows, or a lon and lat swap), regenerate, and report the count fixed.
3. **Rivers and other lines.** A river, range or coast draws its own simplified line (OSM waterway or Natural Earth line, ODbL or public domain, credited), never the parent state. Files per feature, loaded on pick through `globeLine(id)`.
4. **Natural features switch.** Map options gains "Natural features", default on; off removes rivers, ranges, plains, deltas and seas from search and map picking; `nf=0` in the URL, no storage; search groups places, regions and cities first, features last.
5. e2e: pick a river, a plain, a delta, a lake and a range from search; assert the camera ends inside each feature's box and a river draws a line; the switch survives a reload of the link.

### Part b

6. **Design first.** The design reviewer writes `docs/v2/design/globe/home-look-note.md` with a mock for 9.2 (sky or space background that works in light and dark, richer ocean, more labels at rest, no green, contrast AA) and a ruling on the city outline style. The owner approves it at R1.
7. **City outlines.** For each town in `data/reference/towns/` that is listed somewhere (a place within 25 km, a hub or a base; about 300 to 600), fetch the OSM admin boundary by the town's Wikidata QID through Overpass, 20 QIDs a query, sequentially under `flock /tmp/travel-overpass.lock` with the user agent from the one UA module. Simplify to 1 to 3 KB, write `/globe/city/<town-id>.json`. Measure the total first and report it.
8. **Fallback.** A town with no polygon keeps the ring (casing plus amber) and the card says why.
9. **Home look.** Build the approved mock in `CoverGlobe.tsx` and the globe tokens (through `theme_tokens.py`).

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Fly here moves the camera for every class; the camera ends inside the feature box (e2e, 5 classes) | 9.7, P5 |
| 2 | Ganges Plain's centre lies inside its box; the audit count is reported | 9.7, T5 |
| 3 | Ganges, Danube, Nile draw lines; no state outline | 9.4 |
| 4 | `nf=0` removes features from search and picking and survives a reload | 9.8 |
| 5 | Ten cities (Whitby, Banff, Calgary, Quebec City, Canmore, Cortina d'Ampezzo, Chamonix, Reykjavik, Bolzano, Huntsville) each show an outline or the stated ring | 9.3 |
| 6 | City outline files 1 to 2 KB gzip each; the total and count reported; Pages file count stays inside the limit | P8 |
| 7 | Home globe matches the approved mock; contrast AA in both themes; the hue scan finds 0% green | 9.2 |
| 8 | No new literal caught by the hard-coding scan (colours only from tokens) | CONS |
| 9 | `git diff --name-only` shows only owned paths | |

## Server switch

`globeGazetteer()`, `globeCard()`, `globeLine(id)` and `globeCityOutline(townId)` are `DataClient` methods with Zod shapes; today they read per-feature files, later `GET /api/globe/feature/:id`, `/line/:id`, `/city/:id`. The fit model and search ranking are pure modules in `web/lib/globe/`. The `nf`, `c` keys are the same on static and server. Components never fetch a globe file directly.

## Verification

Typecheck, lint, unit tests, your globe specs only (`pnpm exec playwright test tests/e2e/globe` on chromium and webkit), `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. `globe_data.py` has no `--check`; say which subcommand you ran and commit its output. Screenshots at 1440 and 390 (plus 844 x 390), light and dark, on the GPU flags, into `web/test-results/shots/GLB2/`: the Ganges river and plain picks, the switch off, five city outlines, the home cover. Read them in tiles.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-GLB2a` (branch `public/GLB2a`) and later `v2-GLB2b` (branch `public/GLB2b`), both from `main`, port 3463. Commits per step group: `web(public/GLB2): ...`, `tools(GLB2): ...`. Owned paths only, `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push. Overpass strictly one runner.

## Hand-back

Commits; the landform audit count; the city outline count, total size and fallback count; the Overpass run record; the long-task numbers on two flights.
