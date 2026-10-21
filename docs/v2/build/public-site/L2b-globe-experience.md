# L2b: the globe experience

Wave 3, stage 3. It runs in parallel with L3c, L3b, L4b and CS7; it shares no file with them except one appended section of `web/lib/client/data.ts`, so it can merge whenever it passes.
- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 28 hours, in five parts:
  - audit of what stage 1 already fixed, 1 h
  - rendering and first paint, 7 h
  - motion, clustering and labels, 7 h
  - cards, features and data (F3, F4, F6), 9 h
  - P9 tidy, performance, tests and shots, 4 h
- **Backlog:** 3.3, 3.3b, 3.4, 3.5, 3.6; owner feedback F1 to F7; the globe items of 2.41 (label collisions, the translucent Style panel, small pin targets); 2.49 (P9 geo fetch tidy); relevance 6.4 (pins by draw tier).
- **Spec:** [design/globe/spec.md](../../design/globe/spec.md) is the build spec; section numbers below refer to it. Evidence: [experience-review.md](../../design/globe/experience-review.md) (M1-M14, S1-S12). Owner: [owner-feedback-2026-10-18.md](../../design/globe/owner-feedback-2026-10-18.md). Direction mock: `design/globe/mock/index.html`. Where the spec and the review differ, the spec wins.
- **Principles:** P1 (10,000 places), P3, P5 (smooth and linked), P8, P9, T5.
- **Starts:** now. L2 (4777821) and SW-B (1b5f42d) are merged.

## Goal

Anyone opens `/globe`, the world fills the screen and turns, and everything with a name can be pointed at, tapped and opened, smoothly, on a phone and on a desktop (spec, opening line). Concretely, the spec's **Must** rows that stage 1 did not finish:

1. **First paint without pop-in** (8.3): the `.globe-halo` placeholder disc within 300 ms, the canvas fading in on the first `idle`, pins after (M2).
2. **Rendering** (6.1, 6.6): atmosphere, halo and limb per theme; **no green anywhere** (3.3b: `engine.ts` hardcodes `rgb(208 219 190)` for wood and the land colour; read `--map-wood` and `--map-land`); the dark palette with land lighter than ocean (M3, M4).
3. **Labels** (6.2): one label pass for all three styles, one script per label, no capitals, our discs registered as collision boxes (M5, 2.41 label collisions).
4. **Clustering at every level** (6.5) and one node per admin-1 region (M6, section 11); **pins by draw tier** (relevance 6.4).
5. **One flight per step** with pitch inside it, pitch by level, the subject in the upper-middle (5.3, M7).
6. **Image-first selection cards** (4.3, F6, 3.6): the photo fallback chain, summary, three facts, "Used in <trip>", Open place, Directions, Share; the completeness badge, never "Draft"; the tooltip hidden while a card is open.
7. **Feature cards** that keep the feature visible and carry Wikidata facts (4.2, 4.3, M10).
8. **City areas** from OSM `admin_level=8` for cities with our content, an honest ring and "Boundary not loaded" for the rest (4.2, F3, 3.4).
9. **Canada ADM2** as the 293 Statistics Canada census divisions, and the ADM2 audit of every country we ship (section 11, F4, 3.5).
10. **Chrome that lets the canvas dominate** (3.2, M11): the control card collapsed to a Map options pill, an opaque Style panel (2.41), pin targets of at least 44 px on touch (2.41).
11. **Dimming that focuses**, selection lines with a 1 px casing, not a black border (6.3, 6.4, M14).
12. **No long task over 50 ms after the first `idle`** (8.1, 8.3, M12): admin files parsed and tallied in a worker.
13. **Phone and landscape layouts** that never collide (3.2, M13), and the 844 x 390 fly-in that lands on the selected place (3.3b).
14. **P9** (2.49): the static geo reference reads in `lib/globe/countries.ts`, `admin.ts` and `search.ts` go through `web/lib/client/data.ts`.

## Read first

- The spec, all of it. Sections 3 to 9 and 11 are the contract. Section 10 lists foundation edits; you request them, you do not make them.
- The experience review section 3 (each M item has its cause with file and line) and sections 4 to 6 (cards, motion, rendering values).
- `web/lib/globe/engine.ts`, `controller.ts`, `motion.ts`, `framing.ts`, `geometry.ts`, `data.ts`, `store.ts`, `admin.ts`, `countries.ts`, `search.ts`, `types.ts`.
- `web/components/globe/*`, `web/styles/globe.css`, `web/public/globe/README.md`, `tools/globe_data.py`.
- **What SW-B changed** (1b5f42d): the pin list left the page HTML. `web/app/globe-data/index.json`, `pins/[cc]/data.json` and `card/[kind]/[slug]/data.json` are per-country and per-card files; `lib/globe/store.ts` (`ensureCountry`, `ensureCard`) loads them through `globePins` and `globeCard` in `web/lib/client/data.ts`. Photos are served from our own 320/640/960 WebP renditions: `web/scripts/images.mjs` rewrites every Commons `Special:FilePath` URL it finds in the export (HTML and JSON), so a card image is a `Special:FilePath` URL at 320 or 640 in the card data and nothing else.
- `web/lib/public/globe.ts` (`buildGlobe`), `web/lib/client/data.ts`, `web/tests/data/boundary.test.ts`.
- [research/relevance.md](../../../../research/method/relevance.md) 6.4 and `data/relevance/derived/*.json` (`effective_draw`).
- [README.md](README.md) 4.2, 8 and the gotchas on GPU rendering, basemaps in the e2e and deep links.

## Files you own

| Area | Paths |
|---|---|
| Globe app | `web/app/globe/**`, `web/app/globe-data/**` |
| Globe code | `web/lib/globe/**`, `web/components/globe/**` (including `GlobeCover.tsx`), `web/styles/globe.css` |
| Globe data | `web/public/globe/**`, `tools/globe_data.py` (110m world, mainland bboxes, the Canada ADM2 override, per-state ADM2 splits, the admin-1 tree check), `web/scripts/globe-cities.mjs` (new: OSM admin_level 8 polygons), `web/scripts/globe-images.mjs` (new: Wikidata P18 and Commons credits for card fallbacks), `data/reference/globe/**` (new: committed P18 and credit cache, city polygon sources) |
| Adapter, globe part | `web/lib/public/globe.ts` (the card payload: `summary`, `facts`, `usedIn`, `image`, the draw tier per pin) |
| Data boundary | a new section at the end of `web/lib/client/data.ts` headed `// globe reference geo (2.49)`: `globeCountries()`, `globeAdmin(a3, level)`, `globeAdminManifest()`, `globeGazetteer(part)`; and the globe allowances in `web/tests/data/boundary.test.ts` |
| Audit report | `research/reports/globe-adm2-audit.md` (new; spec 11) |
| Tests | `web/tests/globe/**`, `web/tests/e2e/globe*.spec.ts` |

## Do not touch

- **L3c** (building now in `v2-L3c`; everything it owns):
  - `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts`
  - `data/schedules/**`, `web/scripts/legs-ors.mjs`
  - `web/lib/public/timeline.ts`, `prose.ts`, and the `days`, `bases` and `categories` code in `web/lib/public/trips.ts`; L3c's additive blocks in `types.ts` and `honesty.ts`
  - `web/app/trips/[slug]/page.tsx`, `web/components/trips/timeline/**`, `TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `StopStats.tsx`, `TripRouteMap.tsx`, `useTripUrl.ts`, `model.ts`, `web/styles/timeline.css`
  - `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts`, `types.ts`, `web/components/actions/CopySheet.tsx`
  - `web/tests/trips/timeline*.test.ts`, `web/tests/data/prose*.test.ts`, `web/tests/e2e/trip-timeline*.spec.ts`, and the trip page `describe` blocks
- **L3b:** `web/lib/entities/**`, `web/components/entity/FilterBar.tsx`, `MoreFilters*.tsx`, `FacetMenu.tsx`, `PhoneFilterSheet.tsx`, `web/lib/public/tags.ts`, `bands.ts`, `world.ts`, `index.ts`, the trips list files, `web/components/places/rows.ts`, `core/src/capture/bands.ts`, `core/src/derive/**`.
- **L4b:** `data/tracks/**`, `web/scripts/tracks-osm.mjs`, `web/lib/public/tracks.ts`, `places.ts`, `slugs.ts`, `honesty-overrides.ts`, `web/components/places/**`, `web/lib/export/gpx.ts`, `kml.ts`, `licence.ts`.
- **S1:** `web/lib/public/contract.ts`, `suitability.ts`, `relevance.ts`, `sections.ts`, `party.ts`, `web/components/suit/**`.
- **CS7:** `data/capture/**`, `data/suitability/**`, `data/relevance/**` (read `derived/` only), `data/sources/**`.
- The rest of `web/lib/client/data.ts`: append your section only.
- `web/lib/map/**` (LM): the globe keeps its own layers, as L2 did; additive only if you must, listed.
- Foundation: `tools/theme_tokens.py`, `web/app/themes.css`, `web/components/ui/**`, `docs/v2/design/foundation/**`. Spec section 10's token and pattern edits are coordinator and design-reviewer work: ask in the hand-back. The globe tokens (`--globe-ocean`, `--globe-halo`, `--globe-edge`, `--globe-dim`, `--map-wood`, `--map-casing`) exist already (2.26).
- `web/components/home/**`: the home cover is `GlobeCover`, which you own; do not edit the home page around it.

## Steps

### Part 1. Audit

1. Run the spec 9.1 checks against the merged branch on the Arc GPU and write the result into the top of your hand-back: which pass already (stage 1 fixed M1, F2, F5, reset, Home and Esc, the drag, the phone sheet over Reset, GlobeCover pausing), which fail. Build only what fails. Do not re-open a fix that passes its check.

### Part 2. Rendering and first paint

2. **Palette and no green** (6.1, 3.3b): every fill in `engine.ts` `scheme()` reads a token through the existing palette reader. The style `background` is `--globe-ocean`. Landcover, landuse and park fills are `--map-wood`. Relief, Light and Dark differ visibly at zoom 6 (check 7). Check 18 (no hue 75 to 165 above 12% saturation) runs in every style.
3. **Dark palette** (6.6) pending Q6: build with the proposed values as tokens, and raise the selection casing so amber and the casing each reach 3:1 on the dark water (the design review measured 2.99:1 and 2.52:1 on the proposal). If Q6 is still open at hand-back, the values stay token-driven so the answer is a token change.
4. **Atmosphere** (6.6): sky, horizon and fog colours and blends by theme; the `.globe-halo` element positioned from `worldFrame()`, its opacity from 1 at zoom 0 to 0 at zoom 4; the limb. No star field, no terminator.
5. **First paint** (8.3): the halo disc is the placeholder within 300 ms; the canvas starts at opacity 0 and fades in over 600 ms on the first `idle` after `style.load`; pins mount after that `idle`, staggered by latitude. Load `countries-110m.json` (new, about 60 KB gz) first and swap to 50m past zoom 3 or on the first drill-down. Reduced motion: 120 ms fades.
6. **Pre-warm** the shader programs before the first fly-in (1.14 should: the 250-430 ms stall on WebGL program link), without calling `map.stop()` while a pointer is down (5.1).

### Part 3. Motion, clustering, labels

7. **Fly-in** (5.3): one `flyTo` per step with the target pitch and bearing; the per-level pitch, shift and `maxDuration` table; wide countries to their `mainland_bbox`; stepping out in one flight. Fix the 844 x 390 landscape case where a selected place kept the world view (3.3b).
8. **Spin** (5.2): hover slows to 25% and never stops it; resume timings; the chained `easeTo` pattern stays (M1 is fixed; check 9b and 9c keep it fixed).
9. **Labels** (6.2): one pass after `style.load` for all three styles; `name:en`, then `name:latin`, then `name`; no capitals; state labels hidden below zoom 5; our discs register collision boxes through a hidden symbol layer so the Italy disc never hides "Italy" (2.41).
10. **Clustering** (6.5): screen-space merge at every level after `moveend` and every 100 ms in a flight; the merged disc takes its highest-draw member's label; one node per admin-1 region (the South Tyrol, Trentino and Trentino-Alto Adige case) with a build check that no two siblings resolve to the same NE shape; place dots 18 px.
11. **Pins by draw tier** (relevance 6.4): world shows trips and country discs; country shows `world` and `national` pins, at most 30 a country; state adds `regional` and draws `local` as quiet dots that cluster at 48 px; area shows all. The tier comes from `data/relevance/derived` through `web/lib/public/globe.ts` as one light field per pin (P8: no judgement notes or signals). A place with no relevance record counts as `local`.
12. **Dimming and selection** (6.3, 6.4): the dim layer above the basemap labels; selected outline 2.5 px `--accent` over a 1 px `--map-casing`; hover fill `--accent` at 35% with the cased 1.5 px line; pins outside the open area at 35% and still clickable.

### Part 4. Cards, features and data

13. **Card payload** (4.3, 11): `buildGlobe` adds `summary` (120 characters), `facts` (best months, kids, elevation or length), `usedIn` (trip slug, title, day) and `image` after the fallback chain:
    1. the place's own credited photo;
    2. the first gallery photo of a published trip that uses the place;
    3. the Wikidata P18 image with its Commons credit, from `data/reference/globe/p18.json`;
    4. none: the 96 px compact header with the kind glyph and the area chain.

    Every image is a Commons `Special:FilePath` URL at width 320 or 640, so `images.mjs` turns it into our own WebP rendition. A photo without author and licence is not shown.
14. **`web/scripts/globe-images.mjs`:** the P18 lookup and the Commons `imageinfo` credits for the places that reach step 3 of the chain. Wikidata by QID only, one request a second; Commons in batches of 50 titles, sequential, a couple of seconds apart, backing off on 429 and stopping after the second. User-Agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`, never an email. **Commons is one runner for the whole machine:** wrap the run in `flock /tmp/travel-commons.lock` and do not start it while CS7 holds that lock. The result is committed; the build never calls Wikidata or Commons.
15. **Selection card** (4.3): image-first, pin-anchored on desktop and landscape, a half sheet on phone with one close; enter, switch and close transitions; the completeness badge ("Usable · 13 of 15") or nothing; never "Draft" or a household status; Directions from our coordinates; Share; the tooltip hidden while open.
16. **Feature card** (4.2, 4.3): anchored so the feature stays visible (check 24); Wikidata facts after open, one `wbgetentities` call per QID, cached 30 days in `localStorage`, 1,500 ms timeout, skeleton rows, rows removed on failure; "Facts: OpenStreetMap, Wikidata" in the footer. Lakes as polygons from NE 10m below zoom 8 (`lakes-10m.json`, the 1,000 largest, about 150 KB gz).
17. **City areas** (F3, 3.4): `web/scripts/globe-cities.mjs` fetches OSM `boundary=administrative` `admin_level=8` for every city or town that holds one of our places or is a trip base, simplified to 0.0005 degrees, into `web/public/globe/data/cities-adm8.json` with its ODbL credit. Overpass is sequential, one request at a time, cached outside git, the same User-Agent, inside `flock /tmp/travel-overpass.lock` (shared with L4b and CS7). Other cities get the 36 px ring, the basemap admin_level 8 lines within 40 km at 60%, and "Boundary not loaded" on the card. The household's home town must not be singled out: a city is in the file only because a public place or a public trip base is in it, and the privacy test runs over the file.
18. **Canada ADM2 and the audit** (F4, 3.5): `tools/globe_data.py` gains a per-country ADM2 override and uses the 293 Statistics Canada census divisions (Open Government Licence Canada, credited), split per province. Then audit every ADM2 file we ship: level meaning, truncated names (`*`), shoreline vertices more than 0.05 degrees from the 50m coast. Write `research/reports/globe-adm2-audit.md`; a failing country falls back to ADM1 only. Check: Whitby resolves to Durham, not "Toronto". Add a `check` subcommand that rebuilds the shipped files from the cached sources into a temp dir and fails on any difference, and ask in the hand-back for it to join `tools/check-all.sh` (not yours to edit).
19. **Chrome** (3.2, 3.3, 3.4): the control card collapsed to "Map options" by default, open state in `sessionStorage`; the Style panel opaque on `--surface` (2.41: the translucent panel); pin hit targets of at least 44 px on touch with the visual size unchanged (2.41); immersive mode; attribution compact and one line.

### Part 5. P9, performance, tests

20. **P9 tidy** (2.49): `countries.ts`, `admin.ts` and `search.ts` stop calling `fetch()`; they call the new functions in your section of `web/lib/client/data.ts`. `boundary.test.ts` fails when any module under `web/lib/globe` or `web/components/globe` calls `fetch` directly.
21. **Workers** (8.3): admin files fetched, parsed, tallied and bbox'd in a Web Worker (`geometry.ts` moves as is); one `setData(..., {waitForCompletion: true})`; dim as a data-driven paint; hover and selection by `setFeatureState` only.
22. **Tests:** the spec 9.1 checks 1 to 27 as unit tests (pure functions: framing, clustering, tiers, label expressions, the fallback chain, the ADM2 override, the P9 boundary) and Playwright (the tile-blocked suite for logic; one shot job with tiles allowed). Motion checks (8, 9, 9b to 9d, 21) run on the Arc GPU only.

## Acceptance checks

The spec's section 9.1, checks 1 to 27, all pass, plus:

| # | Check | Against |
|---|---|---|
| A1 | The audit (step 1) is in the hand-back, and every check that failed there passes now | spec 9.1 |
| A2 | No green pixel in any style (check 18); `engine.ts` holds no colour literal for land, wood or water | 3.3b, tokens 5 |
| A3 | With 10,000 synthetic places (1% world, 5% national, 20% regional, 74% local), Italy draws at most 30 place pins, every world pin is visible, and the 400-marker cap is never reached at country level | relevance 6.4, P1 |
| A4 | A place with no photo shows the compact header, never an empty well; a card image is served from `/img/` in the built site, never from Commons | F6, 2.38 |
| A5 | Whitby resolves to Durham; no ADM2 name in the shipped files ends in `*`; the audit report lists every country checked | F4 |
| A6 | A city with our content shows its OSM area; any other city shows the ring and "Boundary not loaded" | F3 |
| A7 | No module under `web/lib/globe` or `web/components/globe` calls `fetch` directly | 2.49, P9 |
| A8 | Globe HTML stays under 20 KB; data before the globe starts stays under 120 KB gz; JS before the globe starts stays under 250 KB gz including MapLibre | 8.1, SW-B |
| A9 | Frame time p50 and p95 during spin, drag and three flights on the Arc GPU: 16.7 / 20 ms or better; no long task over 50 ms after the first `idle` | 8.1 |
| A10 | The privacy test passes over `web/public/globe/**` and the globe-data files: no household origin, no status, no party | privacy |
| A11 | `git diff --name-only` shows only owned paths; the appended `data.ts` section is the only change in that file | README 4.1 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
python3 tools/globe_data.py check   # new subcommand (step 18): rebuild into a temp dir from the cached sources and diff
python3 tools/theme_tokens.py --check
bash tools/check-all.sh   # with web/.env.local moved aside
```

Browser checks run on the Arc GPU: `--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`. Never judge motion, smoothness or frame time under SwiftShader. Keep each probe under 60 s; take frame sequences at 150 ms, not video. The shot job allows the tile hosts (`test.use({ allowRemote: true })`).

Screenshots: the spec 9.2 list (`world`, `world-panel-collapsed`, `world-immersive`, `it`, `it-south-tyrol`, `place-lago-di-braies`, `trip-dolomites-2027`, `feature-river`, `feature-sea`, `feature-peak`, `what-is-here`, `controls-terrain-on`), in light and dark, at 1440, 1024, 390 and 844 x 390 where the layout differs, into `web/test-results/shots/L2b/`, named `<state>-<theme>-<width>.jpg`. Add `city-banff-area` (a city with our content), `city-no-boundary`, `place-no-photo` and `ca-adm2-durham`. The Whitby-in-Durham check is a unit test only: no shot, label or fixture name on the public site singles out the household's town. Zoom in on each: read the shots in tiles at 2x and check edges, labels and casings.

Then `travel-design-reviewer` (Opus, never Fable) reviews against the spec, the mock and P1-P9, T1-T5; `travel-verifier` re-runs the checks on the Arc GPU, including the frame times.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-L2b`, branch `public/L2b`, dev port 3422.
- **Commits, in this order:**
  1. `web(public/L2b): palette from tokens, no green, atmosphere and first paint`
  2. `web(public/L2b): one flight per step, labels, clustering, pins by draw tier`
  3. `data(globe): 110m world, Canada census divisions, ADM2 audit, city areas`
  4. `web(public/L2b): image-first selection cards and feature cards`
  5. `web(public/L2b): chrome, phone and landscape layouts`
  6. `web(public/L2b): globe reference reads through the data module, admin work in a worker`
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back. Do not push.
- **Merge order:** no file overlap with L3c, L4b or L3b, so it merges whenever it passes; the default slot is after L3b and before S1. If S1 is ready first, S1 goes first and you rebase.

## Hand-back report

Keep it short. Include:
- the audit table (step 1);
- the commits and the test counts;
- frame times p50 and p95 and the long-task list (A9);
- the ADM2 audit summary and every country that fell back to ADM1;
- the P18 lookups and credit fetches run, with any 429;
- the size figures (A8);
- requests: the spec section 10 foundation edits (tokens.md 5, components 7.2, patterns 1.2 and 6), and the Q6 values if they changed.
