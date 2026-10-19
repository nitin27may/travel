# L2b globe experience: design review (19 Oct 2026)

Branch `public/L2b` at 7d5d5d9, built with `pnpm build` and served static. GPU Chromium only (`--use-gl=angle --use-angle=gl`, Arc A770M); dark set through the header theme button. 1440, 1024, 390 x 844 and 844 x 390, light and dark, `/globe/` and the home cover. Shots and frame sheets are in `/tmp/l2b-review/`.

## Verdict

**Not ready to merge; close.** Rendering, first paint, spin, drag and the short flights are what the owner asked for. Five faults block: long flights cut instead of flying, cities cannot be selected (so F3 is unreachable), three overlaps, the landscape card hides its primary action, and a green pattern on the Relief style.

## What works (measured)

- First paint: the halo disc is in the HTML at 11 ms, the canvas fades in on the first idle (about 3.7 s here), and the pins come after it (`fp-light-1440-02.jpg`, `-18.jpg`).
- Spin runs at 3.87 deg/s with frames at p50/p95 16.7/16.8 ms. Hover slows it to 0.97 deg/s (25%).
- Drag goes 25 degrees with 2 degrees of inertia in 200 ms, then rests, and it never drills in.
- Every flight under the cap is one `flyTo` with zoom and pitch together. Italy takes 1.1 s, South Tyrol 1.3 s (p95 16.7 ms), and Esc out is one flight (`fly-it-light-sheet.jpg`).
- No long task over 50 ms after idle while drilling into Italy, South Tyrol, Trentino and Canada.
- The cards are image-first with a credit, and the no-photo card uses the compact header (no empty well). "Draft" never appears, the phone sheet has one close, and the tooltip hides while a card is open (`card-photo-light-1440x900.jpg`, `card-nophoto-dark-1440x900.jpg`).
- The home cover pauses off-screen (0 deg moved) and spins at 16.7 ms.
- P9: no `fetch` under `lib/globe` or `components/globe`.

Approved ratios (measured): dark land on dark ocean 1.32:1 (a fill difference; borders carry the edge); amber 6.97:1 on dark ocean, 5.27:1 on dark land; ink disc 8.88:1 on light ocean; dark-mode disc 14.75:1 on dark ocean, count 14.4:1; `--ink-2` labels 8.65:1 dark, 7.84:1 light. Amber alone on light land is 2.05:1, so selection lines keep their `--ink` casing (13.09:1).

## Must-fix before merge

| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | **Long flights are hard cuts (P5).** These all land in one frame: Reset view, Home and the World crumb from a state; a search pick from the world to a place; a panel row from Italy to a place. MapLibre jumps when its modelled duration exceeds `maxDuration`, which the spec warned about in 5.3. | `fly-reset-light-sheet.jpg`; zoom 8.3 to 2.44 between two samples, 5.07 to 12 likewise (p3b, p11) | In `engine.ts` pass `duration: min(model, cap)` instead of relying on `maxDuration`, with a cap of 2,000 to 2,400 ms for world to place and for stepping out. Add an e2e that needs at least 5 intermediate zoom samples for world to place and for state to world. |
| M2 | **Cities cannot be selected, so F3 cannot be reached.** A click on the "Trento" label selects the Adige river, "Florence" drills into Tuscany, and "Kitchener" picks a park. A city search result flies but opens no card. A state label (Tyrol) shows "Boundary not loaded". The builder's `city-no-boundary` shot is a river. | `city-area-trento-light-1440.jpg`, `city-click-Cortina-light-1440.jpg`, `city-Kitchener-light-1440.jpg` | Apply the 4.1 hit order: cities before lakes, rivers and parks, with a 12 px touch box. A city result opens its feature card on `moveend`. Show the boundary line only for class `city`, `town` and `village`. Shoot `city-firenze-area` and a true no-boundary city. |
| M3 | **Overlaps (check 3, F5).** Three cases: the feature card sits under the search box and over the crumb at 1440; at 390 the World crumb draws over the first search result; at 1024 the place card covers the crumb by 10 px. | `city-click-Cortina-light-1440.jpg`, `phone-search-light-390x844.jpg`, `card-photo-light-1024x768.jpg` | Put the results list above the crumb in z-order. Count the search and crumb rects as occupied in the card flip. Start the dock at the crumb's bottom plus 8 px. |
| M4 | **Landscape card hides Open place (P7, P3).** The dock is 212 px tall with 404 px of content, so Open place sits at y 481 of 390. The dock also covers the attribution (261 x 28). | `card-photo-light-844x390.jpg` | Make the actions row a sticky footer, use a 96 px photo in landscape, keep the dock clear of the attribution, and drop the panel to its peek while a card is open. |
| M5 | **Green on the canvas.** Relief at zoom 12 still draws Liberty's wood pattern sprites (hue about 117 degrees, saturation about 20%). | `crop-green-1024.jpg` from `card-photo-light-1024x768.jpg` | In `recolourBase()` remove `fill-pattern` on the landcover and park layers, or swap in a `--map-wood` sprite. Run check 18 at zoom 12 as well as zoom 6. |

## Stage-4 fixes

| # | Finding | Evidence | Fix |
|---|---|---|---|
| S1 | The panel lists the country's trips at every level: Canadian Rockies under Waterloo, Algonquin under Banff National Park. Ontario, which has no places, gets no empty state (P1, T5). | `city-Kitchener-light-1440.jpg`, `ca-ontario-light-1440.jpg` | Filter trips to those with a base inside the level; show the 4.4 empty-state card. |
| S2 | Levels without content are not exported, so `/globe/ca/ontario/`, `/globe/br/` and district URLs return 404 on reload or share. | probe p12 | Add a `_redirects` rule `/globe/*  /globe/  200`, or export an empty shell per admin-1 level. |
| S3 | Discs hide basemap names instead of moving them: Italy, France, Germany and Norway disappear at world level (check 20). | `world-spin-light-1440.jpg` | Offset the disc toward the sea by `discSize/2 + 8` (6.5). |
| S4 | Home cover: the 52 disc overlaps its neighbour, as do 26 and 29; in dark, "Data from" is unreadable and the cover has no halo. | `sheet-home.jpg` | Run the same clustering pass on the cover; use the /globe attribution and halo rules. |
| S5 | An approximate pin uses the country camera while the crumb names the district (Cortina, Lago Federa). | `phone-search-pick-light-390x844.jpg` | Use the district camera when the district is known. |
| S6 | The census divisions cannot be seen at rest, and the hover fill has no cased line. | `ca-ontario-hover-cd-light-1440.jpg` | Draw 0.5 px district lines once a state is open; add the 1.5 px cased hover line (6.3). |
| S7 | Search misses local names: "Firenze" returns nothing (P4). | p5 | Index `name:<local>` as aliases. |
| S8 | Immersive mode keeps the site header, so it is not the full-screen globe the owner asked for. | `immersive-key-3s-light-1440x900.jpg` | In immersive, add a Fullscreen API button or collapse the header. |
| S9 | Small overlaps: on the phone the attribution "i" sits over its text; in landscape, Map options and the Show controls pill sit over the scale bar. | `world-dark-390x844.jpg`, `sheet-phone-landscape.jpg` | Truncate with an ellipsis; move the scale bar left of the rail. |
| S10 | Most cards show 0 or 1 facts, and the photos are 960 px where the spec says 320 or 640 (P3, P8). | card payloads | Fill the facts from CS7 data; serve the 640 rendition. |
| S11 | Two long tasks before idle are over the 120 ms budget (125 and 139 ms). | p4 | Move the 50m world parse into the worker. |

## Fine as built

Everything under "What works", plus: clustering in Italy (five discs for seven regions, `it-dark-1440x900.jpg`), the dim above the labels, the opaque Map options panel, Reset view in the rail at every size, and deep links to a state and a place.

## Rulings on the builder's deviations

1. **The card as a left dock (landscape, and 1024).** Accepted: it keeps the right panel and the pin visible, which a right sheet could not. It is conditional on M3 and M4. Record it in spec 3.2.
2. **Immersive by `.` and a Hide controls button, no double-tap.** Accepted. Double-tap is MapLibre's zoom on touch (4.1 rule 5) and would fight it. Update 3.4, and take up S8.
3. **Items not done:**
   - City boundary lines within 40 km at 60%: deferred to stage 4, but only after M2. The ring and "Boundary not loaded" must first work for real cities.
   - `?show=` and `?kind=`: deferred. They are Should items, and they matter for P1 once there are about 300 places.
   - The P pin sweep: deferred. The hidden list of pins covers keyboard and screen-reader users meanwhile.
4. **Q6, dark land derived in the engine.** Accepted for this merge only. The result (rendered `#25313D`) matches the proposal (`#263241`) and touches only the globe. It breaks brief step 3, though: the Q6 answer must be a token change. Ask the owner Q6 now, then add `--globe-land` and `--globe-wood` through `theme_tokens.py` and delete the `mix()` in `scheme()`. The 3:1 casing concern does not arise: the globe's water is `--globe-ocean`, and amber reaches 6.97:1 on it.

## Scores

| Principle | Score | Note |
|---|---|---|
| P1 scale | Partial | Clusters and tiers work; S1, S3 |
| P2 progressive | Pass | Card, then Open place |
| P3 glance | Partial | M4, S10 |
| P4 no manual | Partial | M3 (phone search), S7 |
| P5 smooth, linked | **Fail** | M1; short flights pass |
| P6 metadata | Pass | Kicker, area chain, Used in |
| P7 primary goal | Partial | M4 |
| P8 catalogue | Pass | Light payload; S10 weight |
| P9 server-ready | Pass | No direct fetch |
| T1 when | Partial | Best months only where held |
| T2 field | Partial | Phone works; S2 links 404 |
| T3 trust | Pass | Credits, "Facts: OpenStreetMap" |
| T4 families | n/a | Suitability is S1's work |
| T5 honest maps | Partial | "Location approximate" is shown; M2, S1 |
