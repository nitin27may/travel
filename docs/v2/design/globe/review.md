# Globe review (18 Oct 2026)

Reviewer: travel-design-reviewer. Scope: the live globe at https://nks-travel.pages.dev/globe/ (`legacy/globe/index.html`,
commit a36fd68), lane L2's brief and code (`docs/v2/build/public-site/L2-globe.md`, worktree `travel-wt/v2-L2`, uncommitted
as of 13:05 EDT), and the foundation (patterns 3.2, components 7.2, tokens 5 and 11). The enhancement spec that follows
from this review is [spec.md](spec.md).

How it was rendered. Playwright with Chromium 1248 and `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
at 1440 x 900, 1024 x 768, 390 x 844 and 844 x 390, all at 2x. The live page was driven through its `window.__map` and
`#c=`/`&s=` hash. L2 had no dev server on 3412, so its static export (`web/out`, built 13:00) was copied to `/tmp` and
served read-only on 3498; the worktree was not touched. Frame rate numbers from SwiftShader are meaningless (1.3 fps for
everything), so performance below is judged from payloads, request counts and code, not from measured fps. Shots are in
[shots/](shots/).

## 1. What the live globe does well

Keep all of this (it is also what keep-from-live-site.md lists):

- One canvas, one interaction grammar: drag spins, scroll zooms, hover tells, click flies in. The globe projection with
  atmosphere, hillshade that strengthens with zoom and 3D terrain from zoom 3.5 is the right stack and already costs $0.
- Drill-down works and is honest: country, then state (Natural Earth 10m), then district (geoBoundaries), with the chosen
  shape kept bright and everything else dimmed, counts of saved places per shape, and "2 not inside a mapped state" when
  the data does not nest. [live-italy-1440.jpg](shots/live-italy-1440.jpg), [live-state-1440.jpg](shots/live-state-1440.jpg)
- The hover tooltip for a country has real facts (region, flag, capital, population, saved count).
  [live-hover-brazil.jpg](shots/live-hover-brazil.jpg)
- Basemap features are first-class: rivers, lakes and seas, peaks, parks and towns can be hovered and selected, with a
  highlight layer per class and a feature card (Fly here, Wikipedia, Wikidata). [live-feature-select-sea.jpg](shots/live-feature-select-sea.jpg)
- Styles share one tile source, so Relief, Light and Dark switch without refetching; prefs persist in localStorage.
- Search covers 13,741 names (7,342 cities, 4,589 states, 1,267 landforms, 294 seas and oceans, 249 countries) and flies
  at a zoom that fits the feature's rank. `/` focuses it.
- The geometry code is sound: antimeridian-aware bbox, point-in-polygon with holes, Terrarium fallback for terrain,
  cancellation when the user moves on while admin files load.
- The look is coherent: dark stage, signpost type, mono labels, hairline cards. The owner likes it; the colours are the
  only open point.

## 2. Findings on the live globe

Ranked critical (blocks the owner's goal "full screen, rotate, select, smooth"), important (hurts a family using it to
explore or find a saved place), polish.

### Critical

| # | Where | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| C1 | World, 1440 and 1024 | The globe is a 560 px disc in an 1,180 px canvas: zoom 1.35 and centre lat 25 regardless of viewport; two thirds of the screen is empty dark green. At 1024 it is the same disc. [live-world-1440.jpg](shots/live-world-1440.jpg), [live-world-1024.jpg](shots/live-world-1024.jpg) | This is the entry point; it reads as a widget, not a world. Labels at zoom 1.35 are too small to be clickable targets. | Camera from viewport: zoom so the disc diameter is 0.86 x the shorter side of the free canvas (the canvas minus floating panels), centre lat 18 to 22, recomputed on resize. Spec 3.1. |
| C2 | Any zoom, over land | Rivers, peaks, parks and towns cannot be hovered or clicked unless the user has drilled to a state. At world or country level the country or state fill owns the pointer: hovering the Rio Gardena at zoom 9.2 shows the Italy tooltip, and clicking it flies back out to the whole of Italy. [live-dolomites-hover-river.jpg](shots/live-dolomites-hover-river.jpg), [live-dolomites-select-river.jpg](shots/live-dolomites-select-river.jpg) | The owner's list (rivers, lakes, seas, peaks, ranges, parks) is only reachable through a hidden path. Seas work because no fill covers water. | Hit priority by zoom and class, not by level: points and lines win above zoom 5; a country fill only takes the click when nothing named is under the pointer. Spec 4.1. |
| C3 | Everywhere | Amber is the resting colour of everything: 63 pins (amber, teal for planned or visited), the current crumb, five control buttons, the eyebrow, the hover fill and the selection outline. Pin on water is 1.35:1. [live-world-1440.jpg](shots/live-world-1440.jpg) | Nothing stands out when something is selected; tokens 5 and changes-from-preview 23 already decided ink at rest, amber only for hover and selection. | L2 does this (ink discs, `--globe-pin-pick`). Verify after the L2 canvas bug below is fixed. |
| C4 | Phone 390 and landscape 844 x 390 | The canvas is 62vh with the panel scrolling below; the attribution wraps to two lines and sits on top of the hint; crumb and search stack over the globe's top; in landscape the search bar crosses the globe and the controls overlap the hint. [live-world-390.jpg](shots/live-world-390.jpg), [live-world-landscape.jpg](shots/live-world-landscape.jpg) | Most visitors to a public travel site are on phones. | Full-bleed canvas, peek sheet, one Map options button, a landscape layout. L2 steps 8 and 2; spec 3.2 and 3.3. |
| C5 | Deep links | State and district links are by display name in a hash (`#c=ITA&s=Trentino-Alto Adige`) and fail when the data name differs (`Trentino-Alto Adige/Südtirol`): the link lands on Italy. No camera in the URL, so a shared zoom is lost. | A shared link to a region is the main way a family passes the globe around. | Path URLs with stable slugs plus optional `?c=` (patterns 1.2). L2 does this; the slug must come from the data node, never from the shape's name alone. Spec 4.7. |

### Important

| # | Where | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| I1 | Feature card | A selected river, sea or peak shows only its name, class and a Wikipedia search link. No elevation for ranges, no length, no photo, no "saved places near here". Peaks never appear above zoom 9 (OpenFreeMap puts `mountain_peak` at zoom 11+, probe returned none at 9.2). | Selecting is the owner's second verb; the card is where the reward is. | Card per class with Wikidata-fed facts and nearby saved places (L2 has the nearby list). Spec 4.3, 7. |
| I2 | World spin | Spin is a constant 4 deg/s `jumpTo` every frame; it pauses only on country hover and pointer down and resumes after 10 s; it never decays, so a stop is a jolt. | Smoothness is in the owner's three words. | L2 `motion.ts` already decays over 400 ms and resumes after 20 s. Keep, add inertia on drag release. Spec 5. |
| I3 | Country fly-in | `fitBounds` with fixed padding, no tilt, terrain pops on at zoom 3.5 without easing; wide countries (Russia, Canada) jump to zoom 2.6 and stop. | The fly-in is the moment that sells the globe. | Zoom then tilt (patterns 6), terrain fades in, wide countries fly to their populated centroid. Spec 5.3. |
| I4 | Side panel, world | Lists every region of the world with countries by population ("Africa · 59, Nigeria 211.4 m") under the saved-places list. | Population tables are not what a travel site's visitor came for; they push the saved places and trips down. | Panel is places and trips by continent and country only (L2 does this); facts move to the tooltip and the country card. |
| I5 | Search | No saved places or trips in search; results list is a `listbox` with no focus management; no empty-state message. | The visitor types "Braies" and gets the lake from the gazetteer, not our place page. | L2 search puts cards first. Add an empty state and `aria-activedescendant` (L2 has it). |
| I6 | Keyboard and screen reader | The canvas is not focusable; pins and shapes cannot be reached by keyboard; the tooltip is not announced; no Esc; the only reduced-motion handling is disabling spin. | WCAG 2.1.1 and 2.4.3 fail for the main interaction. | L2 step 9; spec 4.6. |
| I7 | Payload | 717 KB over 49 requests before any tile; `countries-50m.json` 756 KB (236 KB gzip), `gazetteer.json` 803 KB (275 KB gzip, lazy), MapLibre 1.7 MB vendor; `USA-ADM2.json` 948 KB (278 KB gzip) on drilling into any US state. | A phone on a trailhead signal waits 5 to 10 s. | Budgets and loading order in spec 8; gzip is on, Brotli and a 110m world for the first paint are the wins. |
| I8 | Phone tap | Tapping the globe on a phone at world level does not select the country under the finger; it moves the camera (no hover, so the first tap is a drag). [live-phone-tapped.jpg](shots/live-phone-tapped.jpg) | On touch, hover does not exist; the first tap must act. | Tap selects, long-press shows "what is here". Spec 4.1. |
| I9 | Hover fill | Hover is accent at 32% over the basemap; the selected country gets a 2.2 px `#ffd27a` outline; the panel's hover on a state row highlights the shape (good) but there is no reverse: hovering a shape does not highlight its row. | Two-way linkage is what makes a list and a map one thing. | Spec 4.4. |

### Polish

| # | Where | What is wrong | Fix |
|---|---|---|---|
| P1 | Controls | Style, terrain, pins, Auto-spin and the relief slider are re-rendered inside the panel at every level, above the content. The slider goes to 3x (spec says 2x). | One control card bottom-left (components 7.2); 0.5x to 2x. |
| P2 | Nav controls | MapLibre's GlobeControl is exposed, so a visitor can switch to Mercator by accident; the compass control serves no purpose at world level. | Remove GlobeControl; zoom in and out only, plus "reset north" that appears when bearing or pitch is non-zero. |
| P3 | Hint bar | Lowercase mono text at 4.47:1 on the stage (`--muted-2` on `--bg`); never goes away. | Toast tokens (14.85:1), hide after the first interaction, re-show per level for two seconds. |
| P4 | Breadcrumb | "World" is amber even when it is the only crumb. | Ink crumb, amber nothing (components 1.5). |
| P5 | Status | "loading states and provinces…" sits top-right under the search on phone. | One status pill under the search; also the panel's heading shows a skeleton. |
| P6 | Dark style | Pins and the hover fill keep the light-style colours; adm1 lines switch to grey; labels stay white on black. [live-world-dark-1440.jpg](shots/live-world-dark-1440.jpg) | Tokens 5 dark column for every layer. |
| P7 | Attribution | 10 px mono, two lines on phone, under the hint. | Mono 11.5 (tokens 7), one line, always clear of every other floating element. |

## 3. L2 against the live globe and the owner's goals

L2's brief is the right shape: full-bleed canvas, floating control card, side panel, selection card, path URLs, spin
timings from patterns 6, phone sheets, keyboard. The code is well structured (engine, controller, pure motion and model
modules, unit tests for geometry, model, motion and URL, 13 e2e checks). These are the gaps.

### 3.1 Must change in L2 now (before merge)

| # | What | Evidence | Fix |
|---|---|---|---|
| L2-1 | **The map has no height.** `.globe-map { position:absolute; inset:0 }` is overridden by MapLibre's own `.maplibregl-map { position:relative; overflow:hidden }`, so the map div is 1440 x 0, the WebGL canvas falls back to 1440 x 300 and is clipped away, and every marker projects into a 1440 x 300 space: Iceland, Norway and Canada sit at y = 9 to 16 under the header. The page shows a grey well and no pins at any size. [l2-world-1440.jpg](shots/l2-world-1440.jpg), [l2-world-390.jpg](shots/l2-world-390.jpg) | Measured with `getBoundingClientRect` on the served export: `.globe-root` 1440 x 840, `.globe-canvas` 1440 x 840, `.globe-map` 1440 x **0**, `.maplibregl-canvas` 1440 x 300. 12 `.globe-pin` buttons exist with x 345 to 700, y 9 to 392. | `.globe-map.maplibregl-map { position:absolute; inset:0; width:100%; height:100% }` (or load `globe.css` after `maplibre-gl.css`). Add an e2e check that `.maplibregl-canvas` is at least 400 px tall and that every pin's `y` is inside `.globe-root`. The current e2e suite blocks tiles and never looks at the canvas, which is why this passed. |
| L2-2 | **Hit priority copies the live bug (C2).** `shapeAt` runs before `basemapAt` in both `mousemove` and `click`, so a river, peak or park under a country or state fill is never hoverable until the state is open. | `engine.ts` lines 362 to 386. | Order by zoom and class: above zoom 5 query the basemap hit layers first and fall through to shapes; below zoom 5 shapes first. Spec 4.1 has the table. |
| L2-3 | **World camera is a constant.** `WORLD_CAMERA` is zoom 1.95 on desktop and 1.0 on phone with centre lat 22, so at 1440 x 840 the disc (about 1,980 px) overflows the viewport and both poles are cut; at 1024 x 768 the overflow is worse; at 390 the disc is 512 px in a 390 px canvas. | `controller.ts` line 34; `padding()` assumes a 410 px right panel even when the panel is collapsed. | Compute the world camera from the free canvas on load and resize (spec 3.1 formula); padding from the panels that are actually open. |
| L2-4 | **Hover fill token has no contrast.** The spec's "`--accent-soft` at 35%" blended over `--map-land` is `#F3EDE1`, 1.01:1 against the land; it is invisible. L2 uses `accent` at 30%, which is 1.29:1 light and 1.89:1 dark: visible but weak. The 2 px amber outline is 2.13:1 on light land and 1.14:1 on light water. | Computed from tokens.md 5 values. | Hover: `--accent` at 35% fill plus a 1.5 px `--accent` line with a 0.5 px `--ink` casing; selected: 2 px `--accent` with 1 px `--ink` casing (the same casing rule as `--map-route-pick`). Update tokens 5 to say so. Spec 6.3 gives the ratios. |
| L2-5 | **Countries without content lose their facts.** `describe()` shows region, places and trips or "Nothing saved here yet"; the capital only when nothing is saved; no population, area or languages anywhere; the panel for such a country is empty. | `controller.ts` lines 79 to 102; `GlobePanel.tsx`. | Keep the live facts (capital, population, area, languages, flag) in the tooltip's second line and in an empty-state country card: "Nothing saved in Portugal yet. Capital Lisbon · 10.3 m people · Wikipedia". keep-from-live-site says "hover a country for facts". |
| L2-6 | **Landscape phone is the desktop layout.** The breakpoint is width 639, so an 844 x 390 phone gets the 316 px control card, the 360 px panel and the hint over a 330 px tall canvas. [l2-world-landscape.jpg](shots/l2-world-landscape.jpg) | `globe.css` media query. | Add `(max-height: 500px)` to the phone rules; in landscape the sheet becomes a right-side peek (spec 3.3). |
| L2-7 | **Relief and Light may look the same.** `recolourBase()` paints every fill `palette.land`, every waterway `palette.water` and every road `palette.contour`, hides POI and small place labels, in all three styles. Liberty's parks, woods and farmland become one tint; only hillshade separates Relief from Light. | `engine.ts` lines 171 to 195. Could not be checked visually because of L2-1. | Keep landuse and park greens as `--map-land` steps (tokens 5 needs `--map-park` and `--map-wood`), or make "Relief" the hypsometric tint from tokens 5 (`--map-land` to `--map-high` by elevation). Verify with shots once L2-1 is fixed; a Light and a Relief shot must differ clearly at zoom 6. |

### 3.2 Gaps L2 does not plan, for L2b (the spec)

| Area | Live | L2 brief and code | Gap |
|---|---|---|---|
| Lakes as shapes | `water_name` label hit only | same | A lake is a polygon; hover should fill it, not ring its label. Needs the `water` source layer with names (OpenMapTiles has `name` on lakes at zoom 8+ only) or a Natural Earth 10m lakes layer. |
| Ranges | gazetteer `physical` by point | same, plus a feature card from search | No range outline; Natural Earth 10m "geography regions" polygons give ranges and plateaus. |
| Parks | `park` outline on hover | same | No park card (area, designation, country), no filter. Wikidata `wikidata` tag exists on OpenMapTiles parks. |
| Cities | basemap `place` hit | same, hidden below `city` rank | Tap a city: card with country, population, our places nearby. |
| Long-press "what is here" | none | none | Spec 4.1. |
| Filters (trips only, places by kind) | Pins on/off | none | Spec 7.2. |
| Random / inspire | none | none | Spec 7.3. |
| Immersive mode (hide all chrome) | none | panel collapses to a tab | Spec 3.4. |
| Clustering at world scale | one dot per place | one disc per country (good); places merge only when co-located | Spec 6.5: supercluster-style at state level when a state has more than 30 places. |
| Night and atmosphere | `atmosphere-blend` ramp | same | Spec 6.6: star field off, sky tint per theme, no day-night terminator (fake, and misleading for trip planning). |
| Offline | none | none | Spec 8.4: cache the world shapes and the visited admin files in the PWA; show "tiles need a connection". |
| Reduced motion | spin off | fades, jumps, spin off | fine |

### 3.3 Things L2 does better than the live globe (keep)

Country discs with counts as the way in; co-located pins merge and fan out; the selection card with photo, area chain,
kind chip and one primary action; path URLs with `?c=` camera restored on reload; Esc and Back step one level; the
panel is the list equivalent of the canvas with `aria-current`; the sr-only list of every card; the hint hides after
the first interaction; spin decays and resumes; terrain gate kept; attribution moves clear of the panel.

## 4. Performance and accessibility

### 4.1 Measured on the live globe (1440, cold cache, swiftshader so fps not reported)

| Measure | Value | Note |
|---|---|---|
| DOMContentLoaded | 278 ms | static HTML, module script |
| Bytes before tiles | 717 KB over 49 requests | fonts, MapLibre 1.7 MB uncompressed (vendor), countries-50m 236 KB gz, facts 80 KB, places 28 KB |
| Gazetteer | 275 KB gz, fetched on search focus | fine |
| Admin files | ITA-ADM1 48 KB, ITA-ADM2 25 KB; USA-ADM2 278 KB gz; CAN-ADM2 388 KB raw; IND-ADM2 353 KB raw | 180 countries have ADM2; the US and Canada files are the heavy ones |
| Total data on disk | 21 MB admin + 1.7 MB data + 1.7 MB vendor | copied into `web/public/globe` by L2 (23 MB) |
| Spin | `jumpTo` per frame at 4 deg/s | each frame re-renders the whole globe; fine on desktop GPUs, 30 to 40 fps on a 2022 mid phone by experience, not measured here |

Budgets and the loading order are in spec 8.

### 4.2 Accessibility

| Check | Live | L2 | Target |
|---|---|---|---|
| Keyboard reaches pins and shapes | no | pins yes (buttons), shapes no | pins, country list, search; shapes through the panel list and search, never required on the canvas (WCAG 2.1.1 via the list equivalent) |
| Focus visible | browser default | 2 px `--accent` outline, 4 px offset ring on pins | keep; on `--accent` fills use `--focus` (ink) |
| Tooltip announced | no | `role="status"` on the tooltip | keep; throttle to one announcement per 800 ms so a sweep across Europe does not read 20 names |
| Canvas role | none | `role="application"`, `aria-roledescription="map"`, label | keep |
| Reduced motion | spin off | spin off, jumps, 120 ms fades, note on the switch | keep; also no hover-fill transition |
| Contrast, text | hint 4.47:1 (fails AA for 11 px mono by intent? no, it is 10.9 px: fails), card text 8.55:1 | tooltip ink on surface 16.06:1, hint toast 14.85:1, pin count 16.06:1 | all text at or above AA; list in spec 6.3 |
| Contrast, non-text | amber pin on water 1.35:1 | ink pin on light water 5.58:1, dark pin on dark water 3.93:1, amber outline on light water 1.14:1 | 3:1 for every pin, ring and outline against both land and water, in both themes: add ink casings (spec 6.3) |
| Touch targets | 7 px pins | 14 px dots with a 44 px `::after` hit area; 44 px rows | keep |
| Phone one-hand reach | search and crumb at the top | search top, crumb bottom-left above the sheet, Map options bottom-right | spec 3.2 keeps Back and search within thumb reach |

## 5. Verdict

The live globe is a strong technical base and a weak layout: a third of the screen, hover-only, amber everywhere, no
phone layout, and its best feature (named rivers, seas and peaks) is hidden behind the drill-down. L2 fixes the layout,
tokens, URLs, phone sheets and motion on paper, but today it draws nothing because of one CSS rule (L2-1), and it carries
the hit-priority bug forward (L2-2). Fix L2-1 to L2-7 in L2; everything in 3.2 is the L2b spec.
