# Globe experience review (18 Oct 2026, L2 build)

Reviewer: travel-design-reviewer. Subject: the L2 globe served at `http://127.0.0.1:3430/globe/` (static export of
`public/L2`, commit b0de27d, source `travel-wt/v2-L2/web`), judged against the live globe it replaces, the
benchmarks in [benchmarks-raw.md](benchmarks-raw.md), the owner's feedback F1 to F7 in
[owner-feedback-2026-10-18.md](owner-feedback-2026-10-18.md), and the foundation. The earlier
[review.md](review.md) and [spec.md](spec.md) stand; this document deepens them and the spec has been updated from
it. Shots are `shots/xp-*`.

How it was measured. Playwright, Chromium 1248 on the Intel Arc A770M (`--use-gl=angle --use-angle=gl
--ignore-gpu-blocklist`; WebGL reports "ANGLE (Intel, Mesa Intel(R) Arc(tm) A770M Graphics (DG2))"), 1440 x 900 and
390 x 844 and 844 x 390 at 2x, light and dark, with `prefers-reduced-motion` once. Frame times come from a patched
`requestAnimationFrame`, long tasks from `PerformanceObserver('longtask')`, camera values from the MapLibre map
instance (captured through a prototype hook, since the engine exposes none) and the `?c=` URL. SwiftShader was tried
first and discarded: the same scene ran at 1.7 fps there and 60 fps on the GPU, so every number below is a GPU number.

## 1. Verdict

The L2 globe is a correct skeleton with the wrong feel. The engine side is strong where it counts: the idle spin
holds 16.7 ms per frame with p95 16.8 ms, hover answers in 3 ms, the fly-in zoom curve is MapLibre's van Wijk curve
and looks it, reduced motion jumps, and the URL, panel and keyboard model are sound. But the owner's three words,
"render, spin, details", each fail today:

- **Spin and drag.** Dragging the world does nothing, and letting go drills into whatever country is under the
  pointer (Sudan, Niger, Algeria, Chad in four tries). The spin loop calls `map.jumpTo` every frame during the
  400 ms after the pointer goes down, and every `jumpTo` resets MapLibre's gesture handlers. This alone makes the
  page feel broken on a desktop. A hovering mouse also freezes the spin dead, so the globe stops whenever the
  pointer rests on land.
- **Rendering.** For the first one to three seconds the page shows a flat beige disc with black pins on it and no
  map; then the tiles arrive at once. There is no atmosphere, no edge, no sky: the disc is a hard cut-out on the
  page well. The Relief style keeps Liberty's green woods and farmland (the palette rule says no green), the ocean is
  a flat saturated teal, labels are bilingual (Arabic, Amharic, Cyrillic second lines) at world scale, and the Dark
  style shows every state and province name in capitals across the whole globe with an ocean brighter than the land.
- **Details.** The place card is a 150 px empty grey well, a title, "Braies, Italy", three chips (one of them
  "Draft") and a button. Five state discs sit on top of each other over Veneto. The river card hides the river it
  describes. On the phone the sheet title repeats the card title and there are two close buttons. Nothing on the
  card says why the place is worth a trip.

Fixing M1 to M4 below (drag, first paint, atmosphere and palette, label rules) turns the page from "broken" to
"clean". M5 to M10 (choreography, discs, cards, chrome, phone, long tasks) are what makes it premium. The spec is
updated so the L2b builder has one document.

## 2. What the benchmarks do that we do not

| What they do | Who | We do today | Source |
|---|---|---|---|
| Space colour and halo change with zoom: navy `#010b19` at z4 to sky `#367ab9` at z7, halo 0.2 to 0.1, stars fade out z5 to z6 | Mapbox globe | `atmosphere-blend` ramp only; sky colours left at MapLibre defaults, which are invisible on our light well | [Mapbox fog spec](https://docs.mapbox.com/style-spec/reference/fog/) |
| A soft halo sphere behind the globe hides the aliased limb; dots fade by distance to kill moire | GitHub globe | Hard disc edge on `--well`; discs stay 100% to the limb and are culled by `isLocationOccluded` only | [How we built the GitHub globe](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/) |
| SVG placeholder, then a 600 ms crossfade (scale 0.8 to 1) to the canvas on the first rendered frame | GitHub globe | Beige disc with pins, then tiles pop in | same |
| Quality ladder: when fps drops under 55.5 over 50 frames, cut pixel ratio 2.0 to 1.5, then detail | GitHub globe | Fixed `devicePixelRatio`; nothing adapts | same |
| `antialias: false` on WebGL fixes high-DPI laptops without a discrete GPU; animation pauses when scrolled away | Stripe globe | `antialias: true`; spin runs while `document.hidden` is false even off-screen (home cover) | [Stripe globe](https://stripe.com/blog/globe) |
| Coarse parent tile stays on screen while children load, skirts hide cracks: no holes, no pop | Cesium | Vector tiles pop in per tile; the DEM below z3.5 is hillshade only, so terrain pops at the gate | [Cesium Globe](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html) |
| Pan inertia: linearity 0.3, `bezier(0,0,0.3,1)`, deceleration 2500, max 1400 px/s, 160 ms buffer | MapLibre and Mapbox defaults | Inertia never runs because the drag never starts (M1) | [handler_inertia.ts](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/handler_inertia.ts) |
| Spin as one `easeTo` per second with linear easing, interrupted by the user's own gesture, resumed on `moveend` | MapLibre spinning-globe example | `jumpTo` per frame from a rAF loop, which calls `stop()` and resets the gesture handlers | [MapLibre example](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/) |
| Label collision fade 300 ms, raster fade 300 ms, halo set by the style (spec default 0) | MapLibre defaults | Defaults kept; halo 1.5 px white on every label at every zoom, bilingual names | [MapLibre layers spec](https://maplibre.org/maplibre-style-spec/layers/) |
| Compass that resets north, zoom in and out, "fly to" as the basic verbs; load progress shown | Google Earth web | Zoom in and out only; no reset view (F5); no progress | [Google Earth web help](https://developers.google.com/maps/documentation/earth/discover-places-change-view) |
| Zoom to a selection opens the globe; the phone gets a simplified "select and zoom one country" flow | Our World in Data | Same gesture set on phone and desktop; the phone's first tap on a disc works, on land it does nothing until a second tap | [OWID maps](https://ourworldindata.org/new-features-better-maps) |
| R-tree collision, several candidate positions per label, minimum repeat distance | Felt | MapLibre's collision only; our DOM discs ignore it and cover basemap names ("52" sits on Italy) | [Felt graphics post](https://felt.com/blog/map-computer-graphics) |
| One readout on tap, state in the URL hash, SVG globe under a canvas | earth.nullschool | Tooltip on hover only; `?c=` in the URL (good) | [cambecc/earth](https://github.com/cambecc/earth) |
| Place cards lead with a photo, then reviews and actions | Apple Maps web | Card leads with an empty well when the place has no credited photo (F6) | [Apple newsroom](https://www.apple.com/newsroom/2024/07/apple-maps-on-the-web-launches-in-beta/) |

## 3. Findings

Ranked **must** (the owner's goal fails without it), **should** (clearly below the benchmarks), **could** (polish).
Each gives what was seen, the cause in code, and the fix with values. Colours are tokens; new tokens are listed in
section 6 and in spec 10.

### Must

**M1. Dragging the world does nothing, and the release drills into a country.**
Seen: a 200 px drag at world level left the globe where it was (the Italy disc moved 687 to 683 px, which is the
spin, not the drag) and the page navigated to `/globe/sd/`, `/globe/ne/`, `/globe/dz/`, `/globe/td/` on four tries.
[xp-after-drag-1440.jpg](shots/xp-after-drag-1440.jpg). The same drag on the live globe pans and coasts. At country
level, where the spin is off, the drag works.
Cause: `engine.ts:596-608` runs `map.jumpTo` from a `requestAnimationFrame` loop while `next.dLng` is non-zero.
`motion.ts:34-41` decays the speed over 400 ms after `touchSpin`, so for 400 ms after `mousedown` the loop keeps
calling `jumpTo`. MapLibre's `jumpTo` calls `stop()`, which calls `HandlerManager.stop()`, which calls `reset()` on
every handler: the trace shows `mapEvent.reset` and `mousePan.reset` every 16 ms from `mousedown` to `mouseup`. The
pan handler never gets past its first point and `MapEventHandler` loses `_mousedownPos`, so the browser's `click`
after the drag is accepted and `onShape` drills in (`engine.ts:430-436`).
Fix: (a) on `mousedown`, `touchstart` and `wheel` set the spin speed to 0 at once (no decay while a pointer is down;
the decay belongs to hover and to the auto-pause, not to a grab) and skip the tick while any pointer is down; (b)
stop using per-frame `jumpTo` for the spin. Use MapLibre's own pattern: `map.easeTo({center: [lng + 4, lat],
duration: 1000, easing: t => t, essential: false})` chained on `moveend`, which the user's gesture interrupts
through the normal `stop()` path once, not sixty times a second; (c) resume 2 s after a gesture ends at world, 20 s
after a hover (spec 5.2); (d) keep `dragPan` inertia at the MapLibre defaults and verify it runs (acceptance 9.1
check 9b). An e2e test must drag 200 px at world and assert the URL is still `/globe/` and the centre moved by at
least 20 degrees.

**M2. First paint is a beige disc with pins, then the map pops in.**
Seen: at 0.6 s the canvas shows a flat `rgb(236 231 219)` disc with twelve black discs on it and no coastline; the
tiles arrive between 1 and 3 s and the picture changes in one frame.
[xp-load-1s-1440.jpg](shots/xp-load-1s-1440.jpg) then [xp-spin-1440-f00.jpg](shots/xp-spin-1440-f00.jpg). On the
phone the same. [xp-phone-load-390.jpg](shots/xp-phone-load-390.jpg).
Cause: `recolourBase()` (`engine.ts:196`) paints the style `background` with the land colour, so the empty globe is
land-coloured; `GlobeShell.tsx:255` mounts `PinLayer` as soon as the engine exists, before `style.load`; nothing waits
for the first `idle`.
Fix: a placeholder disc drawn in CSS at the computed diameter (`worldFrame().diameter`), `--globe-ocean` fill with
the `--globe-halo` ring, under the canvas; the canvas starts at `opacity: 0` and fades in over 600 ms `--e-out` on
the first `idle` event after `style.load` (GitHub's crossfade); pins mount after that same `idle` and fade in over
200 ms, staggered 15 ms per pin by latitude. The style `background` is `--globe-ocean`, never land. Under reduced
motion the fade is 120 ms. Budget: the placeholder is visible within 300 ms of navigation.

**M3. No atmosphere, no edge, no sky.**
Seen: the disc is a hard edge against `--well` in both themes; the only softening is a faint white smear at the top
limb from the default `sky-color`. [xp-spin-1440-f00.jpg](shots/xp-spin-1440-f00.jpg),
[xp-world-1440-dark.jpg](shots/xp-world-1440-dark.jpg).
Cause: `engine.ts:327` sets only `atmosphere-blend`; `sky-color`, `horizon-color` and `fog-color` stay at MapLibre's
defaults (`#88C6FC`, `#ffffff`), which vanish on a light page; there is no halo behind the canvas.
Fix (values in 6.1): `setSky` with per-theme colours and a blend ramp 1 at z0, 0.6 at z2.5, 0 at z5; a CSS halo
behind the canvas (`.globe-halo`, radial gradient from `--globe-halo` at the disc radius to transparent at radius
plus 6% of the diameter), repositioned with the disc on resize and faded out with the same ramp as the atmosphere
(opacity 1 at z0 to 0 at z4, read from `zoom` events, throttled to one rAF); a 1 px limb line (`--globe-edge`) drawn
by the same element. In dark the halo is `#2A4A66` to transparent (2.05:1 on `--well`, soft on purpose); in light
`#CFE0EC` (1.17:1, a glow, not a line) with the 1 px `--line-2` limb (3.18:1) so the disc does not bleed into the
page.

**M4. The palette breaks the foundation: green land, a loud ocean, an inverted dark theme.**
Seen: Relief paints woods and farmland `rgb(208 219 190)` (green) over Europe and Africa; the ocean is `--map-water`
`#6F9FB4` at full saturation; in Dark the ocean `#3F7C8F` is brighter than the land `#1A2330` (3.38:1 the wrong way)
so the continents read as holes. [xp-italy-rest-1440.jpg](shots/xp-italy-rest-1440.jpg),
[xp-world-1440-dark.jpg](shots/xp-world-1440-dark.jpg).
Cause: `engine.ts:181-185` `scheme()`; `palette.ts` FALLBACK dark water.
Fix: section 6.2 palette. Light: ocean `#A9C4D3`, land `#EEE9DF`, wood and park `#E4E0D4` (a warmer step of land,
no hue shift), borders `#8E99A6`. Dark: ocean `#0F1A26`, land `#263241`, wood `#2B3845`, hillshade highlight
`#34434F`. Ink discs stay 8.81:1 on the light ocean and 13.27:1 on light land; `--ink` discs become `--surface`
discs in dark (14.77:1 on ocean, 10.94:1 on land). Green remains only for the done, booked and fits states on
cards, as tokens 3 says.

**M5. Labels are noisy at every scale and in both themes.**
Seen: at world, Liberty shows "Belarus Беларусь", "Saudi Arabia السعودية", "Ethiopia ኢትዮጲያ"; Dark shows "NUNAVUT",
"FERGANA PROVINCE", "TIRIS ZEMMOUR", "WESTERN CAPE" in capitals over the whole disc; at country level Dark shows
every German Land and Polish voivodeship in capitals around Italy; at state level "Trentino-Alto Adige" is drawn
four times. [xp-world-1440-dark.jpg](shots/xp-world-1440-dark.jpg), [xp-italy-1440-dark.jpg](shots/xp-italy-1440-dark.jpg),
[xp-select-river-1440.jpg](shots/xp-select-river-1440.jpg).
Cause: `recolourBase()` (`engine.ts:205-211`) only recolours symbol layers and hides a regex of ids; it never touches
`text-field`, `text-transform`, `text-size` or `minzoom`, so each of the three OpenFreeMap styles keeps its own label
logic.
Fix (6.3 label rules): one label pass for all three styles. `text-field` becomes `['coalesce', ['get', 'name:en'],
['get', 'name:latin'], ['get', 'name']]` on every symbol layer; `text-transform: none`; country labels only at
rank 1 and 2 below z2.5, all countries z2.5 to 4.5; `place` class `state`, `province` and `region` hidden below z5
and never in capitals; cities rank 1 to 2 from z3, rank 3 to 4 from z4.5, towns from z7; `text-size` 11 to 14 by
zoom; `text-halo-width` 1.2 (0.9 in dark); `text-letter-spacing` 0.02; `text-padding` 8 so basemap names avoid
our discs (discs register a collision box through an invisible `symbol` layer with `icon-size` matching
`discSize`, see M6). Font: the style's Noto Sans for basemap names, `--font-mono` 12 for ours (tokens 5).

**M6. Pins pile up and cover what they stand for.**
Seen: at country level over Italy five discs overlap within 25 px (South Tyrol 41 px, Veneto 39, Trentino 31,
Trentino-Alto Adige 31, Dolomites trip 26): "16" sits on "2" sits on the trip pin. At world the 43 px "52" covers
Italy entirely and the "3" covers "France". On the phone the same pile sits on the tilted frame.
[xp-italy-rest-1440.jpg](shots/xp-italy-rest-1440.jpg), [xp-phone-italy-390.jpg](shots/xp-phone-italy-390.jpg).
Cause: `model.ts pinsFor()` makes one disc per node with places; `groupColocated()` merges only pins within 11 m;
the data tree has South Tyrol, Trentino and Trentino-Alto Adige as three sibling nodes for one admin-1 region (a
data problem that F4 also hits for Canada).
Fix: (a) screen-space clustering at every level: after each `moveend` (and during flights every 100 ms), merge any
two discs whose centres are closer than `(r1 + r2) + 6` px into one disc with the summed count and the label of the
larger; clicking a merged disc zooms by 1.5 around it (as spec 6.5 does for places); (b) discs sit at the node's
pins' mean but are offset off the country label's anchor when the two overlap, by `discSize/2 + 8` px towards the
nearest sea, and the basemap label gets `text-optional: true`; (c) the data audit (spec 11, new rows) merges
Trentino-Alto Adige's children under one admin-1 node so a region appears once; (d) place dots at state level grow
from 14 to 18 px and carry a 1.5 px `--map-halo`, so they read on relief.

**M7. The fly-in choreography is right in shape and wrong in composition.**
Seen, measured at 100 ms: Italy zoom 2.47 to 4.98 over 1.06 s (van Wijk, good), then 470 ms of nothing, then pitch 0
to 45 in 110 ms (`easeTo` 500 ms, measured near-instant because the frame budget was free); Italy lands in the lower
third with Ireland and Belarus in the frame; stepping into South Tyrol untilts from 42.8 to 0 while zooming, then
re-tilts to 45 in 400 ms (a see-saw); Esc back repeats it in reverse. The world does not spin again after returning.
[xp-fly-italy-1440-f08.jpg](shots/xp-fly-italy-1440-f08.jpg), [xp-italy-rest-1440.jpg](shots/xp-italy-rest-1440.jpg),
frames `xp-fly-st-1440-f*`.
Cause: `engine.ts:452-458` `tiltAfter` waits for `moveend` then eases pitch; `flyToBox` always passes `pitch: 0`
(`engine.ts:552`), so a flight from a tilted view flattens first; `cameraForBounds` is computed for pitch 0 and the
tilt afterwards pushes the shape down the frame; `motion.ts:36` keeps `held` for 20 s after the last touch, so the
spin does not resume after Esc.
Fix (motion table, section 5): one `flyTo` per step with the target pitch inside it (`pitch` in `FlyToOptions`),
duration by distance (`speed 1.2`, `curve 1.42`, `maxDuration 1800`), the centre shifted north by `0.18 x the free
height` in screen space when the target pitch is 45 so the shape sits in the upper-middle; country level pitch 20
(not 45: at zoom 5 a 45 degree tilt shows half of Europe), state 45, district and place 55; stepping out keeps the
current pitch until the zoom is 60% done and eases it to the target in the last 40%; world resumes spinning 2 s after
arrival.

**M8. No reset, and the way back is hidden (owner F5).**
Seen: at city zoom the selection card covers the "World" crumb; the zoom stack has + and - only; Esc at a card
closes the card, then steps one level at a time; the world needs three presses from a district.
[xp-card-place-1440.jpg](shots/xp-card-place-1440.jpg) (the crumb moved to row 2 under the search, the card sits at
the pin).
Fix: a third button in the zoom stack, "Reset view" (globe glyph, 36 px, `aria-label="Reset to the world"`), always
visible, that calls `goArea([])` and `frameWorld(true)`; `Home` does the same; `Shift+Esc` too; a "reset north" button
appears above it only when bearing or pitch is non-zero (pitch to 0 and bearing to 0 over 300 ms). The crumb chip
and the card never overlap: the card's flip logic (spec 3.2) treats the crumb's rect as occupied, and on the phone
the crumb sits above the sheet, never under a card.

**M9. The place card is empty where it should sell the place (owner F6).**
Seen: Lago di Braies: a 150 px grey well with a 16 px lake glyph, "LAGO DI BRAIES", "Braies, Italy", chips "Lake",
"Draft", "Location approximate", "Open place". On the phone the sheet header says "Lago di Braies" and the card says
"LAGO DI BRAIES" under it, with two close buttons. The trip card is the same shape with no dates or bases.
[xp-card-place-1440.jpg](shots/xp-card-place-1440.jpg), [xp-phone-place-390.jpg](shots/xp-phone-place-390.jpg),
[xp-card-trip-1440.jpg](shots/xp-card-trip-1440.jpg).
Cause: `SelectionCard.tsx:11-41` renders `card.photo` or `EntityImage`'s fallback; `data.ts buildGlobeData()`
carries no summary, facts, trip use or gallery; `GlobeShell.tsx:329` puts the card inside a `BottomSheet` with its
own title and close.
Fix: section 4 cards. Image first with the fallback chain photo, trip gallery, Wikidata P18 or Commons image with
credit, and finally a 96 px header with the kind glyph on a mini-map crop of the basemap around the pin (a second
tiny MapLibre canvas is too heavy; use a static image rendered at build time from the same tiles, 320 x 96, or the
kind glyph on `--surface-2` with the area chain, never an empty well). Then summary (one line, 120 chars), three
facts, "Used in <trip>", Open place primary, Directions and Share secondary. Completeness is the place page's badge
("Usable, 13 of 15") or nothing; "Draft" never appears in public. On the phone the sheet has no title of its own
when it holds a card; the card's close is the only close. The tooltip hides while a card is open.

**M10. The feature card hides its feature and says almost nothing.**
Seen: selecting the Eisack shows a card at top-left over the river's highlighted stretch; the card has the kicker,
the name, four nearby places and "Fly here". No length, source, outflow, no Wikipedia. The park hover worked
(`NATIONAL PARK Naturpark Texelgruppe`) but a park click has the same card. No peaks were hittable at zoom 9.2 or 11.6
(no `mountain_peak` tooltip in 1,400 sampled points), so a peak cannot be selected until the gazetteer peaks ship
(spec 4.2). [xp-select-river-1440.jpg](shots/xp-select-river-1440.jpg), [xp-hover-river-1440.jpg](shots/xp-hover-river-1440.jpg).
Cause: `FeatureCard` in `SelectionCard.tsx:46-69`; fixed position `.globe-feature { left: 12px; top: 64px }`
(`globe.css:142`); `BasemapFeature.wikidata` is read but only linked.
Fix: the feature card anchors to the click point like the place card (a marker at `lngLat`, flipped to keep the
feature visible: for a line, anchor on the side of the pointer away from the line's screen-space direction), with
the facts rows from spec 4.3 filled by Wikidata (length P2043, outflow P403, source P885 for rivers; area P2046 and
IUCN P814 for parks; elevation P2044 and range P4552 for peaks; area and max depth for lakes), skeleton rows while
loading, "Facts: Wikidata" in the footer, Wikipedia from the `enwiki` sitelink.

**M11. Chrome owns too much of the picture.**
Seen at 1440 x 900: panel 360 px open, control card 316 x 236 open, hint bar 411 px, attribution 459 px, search
420 px, crumb; the free canvas is about 1,044 x 780, and the disc 702 px. At 1024 the hint is hidden by a media
query because it collides. The control card shows four controls that a visitor touches once.
[xp-spin-1440-f00.jpg](shots/xp-spin-1440-f00.jpg).
Cause: `GlobeShell.tsx:275-297`, `globe.css:93-105`.
Fix: the control card is collapsed to the "Map options" pill by default (`cardOpen` false; open state in
`sessionStorage`); the hint shows once for 4 s then fades (`--d-base`), never again in the session; attribution
compact (MapLibre `compact: true`) with the full line on hover or tap, mono 11.5; the panel stays open on desktop
at 340 px (not 360) with the heading in `--t-card` 20 px rather than a 22 px uppercase display line; the scale bar
hides below z6. Immersive mode (spec 3.4) stays.

**M12. Main-thread stalls at load and on every drill-down.**
Seen: six long tasks of 93 to 169 ms in the first 2 s on every load (world, phone, dark); 357 ms when Italy opens;
376 ms when a wheel zoom crosses into Sudan (ADM1 load); 398 ms on the phone's Italy fly. Frames otherwise 16.7 ms.
Cause: `controller.ts:226-230` awaits `loadAdmin` then runs `tally()` (point-in-polygon of every place against every
state, `geometry.ts:133-143`) and `setData` on the main thread; `engine.ts:292-302` `applyFocus` calls
`setFeatureState` once per feature of three sources on every focus change, and `setAdmin` repeats it; the first two
seconds parse `countries-50m.json` (236 KB gz) and build the country book in React state.
Fix: parse and tally admin files in a Web Worker (the geometry module is pure, so it moves as is) and post the
tallied FeatureCollection; `setData(..., {waitForCompletion: true})` and apply focus once after it resolves; replace
the per-feature `setFeatureState` loop with a data-driven paint on a `dim` property set in the worker plus feature
state only for the one hovered and the one selected id; ship `countries-110m.json` for the world and swap at z3
(spec 8.2). Budget: no long task over 50 ms after the first `idle`; none over 120 ms before it.

**M13. Phone layout collides and the first tap on land does nothing.**
Seen at 390 x 844: the attribution wraps to two lines and the "List" button sits on it; "Map options" sits on Libya;
the crumb chip "World › Italy › South Ty" is cut by the options button; the sheet header carries three icon buttons
(up, down, close) plus the handle; a tap on a disc flies in (good); a 650 ms press on land drilled into Alta
Pusteria instead of showing "what is here" (spec 4.1 rule 6 is not built). At 844 x 390 the place card covers the
search and the panel, and the attribution runs under the Map options pill.
[xp-phone-italy-390.jpg](shots/xp-phone-italy-390.jpg), [xp-phone-st-390.jpg](shots/xp-phone-st-390.jpg),
[xp-land-place-844.jpg](shots/xp-land-place-844.jpg).
Cause: `globe.css:150-182`; `BottomSheet` header; no long-press handler.
Fix: spec 3.2 table (updated): attribution one line, 11 px mono, truncated with an ellipsis, above the sheet and
clear of every button; the Map options and List buttons become one 44 px icon rail bottom-right (layers, list, reset
view) with the crumb chip on the left at the same baseline, both above the sheet peek; the sheet header shows the
handle and one close only, with the snap controlled by drag; long-press 500 ms opens What is here; in landscape the
card is the right sheet at full and the search collapses to an icon when a card is open.

**M14. Dimming does not focus; selection outlines read as black.**
Seen: with Sudan open the neighbours are barely dimmer than Sudan; at state level South Tyrol's outline is a 4 px
near-black line with amber barely visible on it; in Dark the selected outline is white. [xp-after-drag-1440.jpg](shots/xp-after-drag-1440.jpg),
[xp-st-rest-1440.jpg](shots/xp-st-rest-1440.jpg), [xp-st-1440-dark.jpg](shots/xp-st-1440-dark.jpg).
Cause: `country-dim` is the land colour at 55% (`engine.ts:264`) over a basemap whose labels and hillshade stay at
full strength; `country-casing` is `--ink` at 4 px under a 2 px accent line (`engine.ts:266-267`).
Fix: dim with `--globe-dim` (light `#F3F1EC` at 70%, dark `#0B1119` at 60%) and fade basemap labels outside the
open shape to 35% (`text-opacity` by a `within` expression is not available; use the dim fill above the labels'
layer for countries, and `text-opacity` on our own labels); selected outline 2.5 px `--accent` over a 1 px `--ink`
casing (not 4), hover 1.5 over 0.5; in dark the casing is `#0B1119` and the line `--accent` dark `#EBA830`
(6.3:1 on land). The selected shape itself keeps full basemap strength, which is what focuses the eye.

### Should

| # | Seen | Cause | Fix |
|---|---|---|---|
| S1 | A hovering mouse over any country freezes the spin at once (0.01 deg/s). It feels sticky; the globe stops whenever the pointer rests. | `engine.ts:420` `touchSpin` on every shape hover | Hover slows the spin to 25% over 400 ms and the tooltip follows; only pointer down, wheel and focus stop it. Under reduced motion there is no spin anyway. |
| S2 | Country-level tilt of 45 degrees at zoom 5 shows a wedge of the planet with Italy at the bottom. [xp-italy-rest-1440.jpg](shots/xp-italy-rest-1440.jpg) | `tiltAfter` fixed 45 | Pitch by level: country 20, state 45, district and place 55, trip 40 (section 5). |
| S3 | Wheel zoom lands wherever it lands and, over a country, a stray click after it drills in; 6 notches went z2.44 to 5.15 at world, then the drag bug (M1) took the page into Sudan. | MapLibre default `scrollZoom` rate; M1 | Keep the default rate; `wheel` sets the spin speed to 0 (M1 fix). |
| S4 | The search placeholder "Search a country, state, city, sea or range" omits the one thing we own: places and trips. | `GlobeSearch.tsx` | "Search places, trips, countries, towns, seas". |
| S5 | Zoom buttons are 30 px at the far bottom-right with the attribution under them; the scale bar appears between them and the panel. | `globe.css:100` | A 36 px vertical rail (zoom in, zoom out, reset view, reset north when needed), 12 px from the free edge, 72 px from the bottom; scale bar bottom-left of the free width, hidden below z6. |
| S6 | The world camera sits at lat 20 with Africa centred and most of the Americas and Asia on the limb; Canada (26) and the US (28) are foreshortened at the edge. | `framing.ts WORLD_LAT 20`, `WORLD_LNG -35` | Open on the visitor's region when known (`Intl.DateTimeFormat().resolvedOptions().timeZone` to a longitude, as GitHub does), else lng -35; lat 22; the spin passes every continent within 45 s anyway. |
| S7 | Light style under a dark page gives a dark control card over a white map; the Dark style under a light page gives the reverse. [xp-italy-light-style-1440.jpg](shots/xp-italy-light-style-1440.jpg) | `effectiveStyle` | The floating chrome follows the map style's mode, not the page: `data-globe-style` already exists on the canvas; scope the surface tokens to it. |
| S8 | `Image "circle-11" could not be loaded` on every Dark load; `calculateFogMatrix is not supported on globe projection` and `terrain is not fully supported on vertical perspective projection` on every flight. | Dark style sprite references; MapLibre 6.11 with globe plus terrain | Add the missing sprite image or hide the layer; the two MapLibre warnings are known limits, keep terrain off below z3.5 (already) and set `fog` only in Mercator (never, on this page). |
| S9 | The state and district outlines at z8 are straight segments; the Lake Ontario shore in Canada ADM2 is cut by lines (owner F4); Canada ADM2 are 76 economic regions, not 293 census divisions; names truncated with `*`. | geoBoundaries ADM2 | Spec 11: Statistics Canada census divisions; audit of every ADM2 we ship for level meaning, truncation and shoreline fidelity; simplify to 0.001 degrees, never coarser than the 50m coast. |
| S10 | A selected city (Whitby) shows no area (owner F3). | No admin_level 8 polygons | Spec 4.2 city row: pre-built OSM admin_level 8 polygons for cities with our content; a soft 2 px `--accent` ring at the label plus the basemap `boundary` admin_level 8 lines highlighted for the rest, and the card says "Boundary not loaded" honestly. |
| S11 | Hillshade at world is a faint grey wash that makes Africa look dirty; at z8 it is strong and good. | `hillshade-exaggeration` ramp from 0.08 | 0 below z2, 0.15 at z4, 0.45 at z7, 0.55 at z9; `hillshade-illumination-anchor: map` so the light does not swing with bearing. |
| S12 | The panel heading "PLACES AND TRIPS" in 22 px uppercase display type competes with the page title. | `globe.css:111` | `--t-card` 20 px, sentence case, count in `--t-meta` to its right. |

### Could

| # | Seen | Fix |
|---|---|---|
| C1 | Emoji flags render in the system's emoji font, so Switzerland's flag is a red square with a soft white cross and Canada's leaf is blurry at 22 px. | Twemoji-style SVG flags from `flag-icons` (MIT), 20 x 15, in the panel and tooltip. |
| C2 | The tooltip kicker "AFRICA · MIDDLE AFRICA" is louder than the title. | Kicker in `--muted`, title 16 px 600, facts in `--t-meta`; the flag before the title at 16 px. |
| C3 | "drag to spin · scroll to zoom · click a pin to open" is lowercase mono in a toast. | Sentence case in `--t-meta`, shown once for 4 s. |
| C4 | The relief slider shows "1.0×" but changes nothing until the view is above z3.5. | Disable the slider below z3.5 with a note "Zoom in to see relief". |
| C5 | Trip pins are rounded squares with a route glyph; at 26 px the glyph is 14 px and unreadable on relief. | 30 px square, 16 px glyph, 2 px `--map-halo`; the label tag shows the trip title and nights on hover. |

## 4. Selection cards

One component, image-first, three sizes (desktop 320 px anchored to the pin; phone sheet at half, 100% wide;
landscape right sheet 300 px). Header area 150 px desktop, 132 px phone, 96 px when it is the compact header. No
sheet title and no second close when a card is in a sheet. The tooltip is hidden while a card is open. Fields in
order; a field with no value is omitted, never shown as "unknown".

### 4.1 Saved place

```
+----------------------------------------------+
| [photo 320x150, credit bottom-left 11px mono]|   fallback: trip gallery photo > Wikidata P18 /
|                                         [x]  |   Commons image with credit > compact header
+----------------------------------------------+   (kind glyph 24px on --surface-2, 96px tall,
| LAKE · Braies, South Tyrol, Italy             |    area chain as a second line)
| Lago di Braies                                |   title --t-card 20px, not uppercase
| A turquoise lake under the Croda del Becco;   |   summary 1 line, 120 chars, --t-meta, --ink-2
| the boat house is the photo everyone takes.   |
| Best Jun-Sep   Kids yes   1,496 m             |   3 facts, --t-cap labels, values 14px 500
| Used in  Dolomites 2027 (day 3)               |   link row, route glyph
| [ Open place -> ]  Directions   Share         |   primary; secondary ghost buttons
| Usable · 13 of 15                             |   completeness badge from the page, or nothing
+----------------------------------------------+
```
Field order: image, kind and area chain, title, summary, facts (best months, kids, elevation or length), used in,
actions, completeness. "Location approximate" stays as the honest chip, after the facts, only when true.

### 4.2 Trip

```
+----------------------------------------------+
| [cover 320x150]                          [x] |
+----------------------------------------------+
| TRIP · Italy                                 |
| Dolomites, 13 nights                          |
| 13-26 Jul 2027 · 4 bases · 25 places          |   or "Dates open · 4 bases · 25 places"
| Sesto 3 · Alta Badia 4 · Val Gardena 4 · ...  |   bases row, numbered on the map
| [ Open trip -> ]  Show route   Share          |   Show route draws the dashed base line
| Full plan                                     |   depth badge
+----------------------------------------------+
```
Field order: cover, kind and country, title, dates and counts, bases, actions, depth. The map shows numbered base
pins (`--map-pin`) and the dashed `--map-route-dim` line while the card is open.

### 4.3 Country (no content or with content)

```
+----------------------------------------------+
| [flag 20x15]  COUNTRY · Southern Europe       |
| Italy                                         |
| 51 places · 1 trip                            |   or "Nothing saved here yet"
| Capital Rome   59.0 m people   301,340 km²    |
| Italian                                       |
| [ Fly in -> ]  Wikipedia                      |   Fly in drills to /globe/it/
+----------------------------------------------+
```
No image (flags are enough; photos of countries are postcards). This card is the tooltip's richer sibling and the
panel's empty state (spec 4.4). Fields: flag and region, name, our counts, capital and population and area,
languages, actions.

### 4.4 State, province, district

```
+----------------------------------------------+
| PROVINCE · Italy                              |
| South Tyrol                                   |
| Bozen - Bolzano (local name)                  |
| 25 places · 1 trip · 10 districts             |
| [ Fly in -> ]  Wikidata                       |
+----------------------------------------------+
```

### 4.5 River, lake, sea

```
+----------------------------------------------+
| RIVER · South Tyrol, Italy                    |
| Eisack - Isarco                               |
| 96 km · flows into the Adige                  |   Wikidata P2043, P403 (skeleton rows while loading)
| Saved places near here                        |
|   Adolf Munkel Weg                     26 km  |   up to 4 rows, each opens that card
|   Alpe di Siusi                        31 km  |
| [ Fly here ]  Wikipedia   Copy link           |   Fly here primary only when off-screen
| Facts: OpenStreetMap, Wikidata                |
+----------------------------------------------+
```
Lake: area, elevation, max depth. Sea: area, bordering countries. The card anchors at the click point and flips to
keep the highlighted feature in view.

### 4.6 Peak, range, park

```
+----------------------------------------------+
| PEAK · Dolomites, Italy                       |
| Croda del Becco                               |
| 2,810 m · prominence 500 m · Pragser Dolomites|
| Saved places near here ...                    |
| [ Fly here ]  Wikipedia   Copy link           |
+----------------------------------------------+
```
Park: designation, area, IUCN category, our places inside.

### 4.7 City or town

```
+----------------------------------------------+
| TOWN · Ontario, Canada                        |
| Whitby                                        |
| 138,500 people · 100 m                         |
| Boundary not loaded                           |   only when we have no admin_level 8 polygon
| Saved places within 25 km ...                 |
| [ Fly here ]  Wikipedia                       |
+----------------------------------------------+
```

Transitions: a card enters over 200 ms `--e-out` (opacity and 6 px slide from its anchor side); switching from one
card to another cross-fades 160 ms without moving the anchor if both are pins in view; close exits 120 ms `--e-in`.
Back closes the card before stepping a level; a deep link to `/globe/place/<slug>` opens the card after the flight
lands (`moveend`), not during it.

## 5. Motion spec

| Action | Duration | Easing | Interruptible | Reduced motion |
|---|---|---|---|---|
| Idle spin | 1 rev per 90 s (4 deg/s), as 1 s `easeTo` steps, linear | `t => t` | yes: any gesture, wheel, key, card open, level change; speed to 0 at once on pointer down | off; switch disabled with note |
| Spin slow-down on hover over land | 400 ms to 25% | `--e-std` | yes | n/a |
| Spin resume | 2 s after a gesture ends at world; 20 s after the last hover; 2 s after arriving back at world; ramp 0 to 1 over 600 ms | `--e-out` | yes | n/a |
| Drag | 1:1 | none | yes | 1:1 |
| Drag release inertia | MapLibre defaults (deceleration 2500, max 1400, linearity 0.3) | `bezier(0,0,.3,1)` | yes | off (MapLibre honours the OS setting) |
| Wheel and pinch zoom | MapLibre default | default | yes | default |
| Zoom buttons | 300 ms, by 1 | `--e-std` | yes | jump |
| Fly to country | `flyTo` speed 1.2, curve 1.42, max 1800 ms; pitch to 20 inside the flight; centre shifted north 0.12 x free height | van Wijk | yes | jump, pitch 0 |
| Fly to state | same, max 1600 ms; pitch 45; shift 0.18 | van Wijk | yes | jump |
| Fly to district, place | same, max 1600 ms; pitch 55 for places with terrain on, 0 for approximate pins; zoom 12 (place), 10 (district) | van Wijk | yes | jump |
| Fly to trip | max 1600 ms, fits the bases, pitch 40 | van Wijk | yes | jump |
| Fly to feature (Fly here) | 900 ms to the class zoom (river 8, lake 11, sea by rank 2.2 to 6, peak 12, park 10, city 11); pitch 45 for peaks and lakes | van Wijk | yes | jump |
| Step out (Back, Esc, crumb) | same flight, pitch eases to the target over the last 40% of the zoom; world resumes spin after 2 s | van Wijk | yes | jump |
| Reset view | 1200 ms to the world frame, pitch and bearing to 0 | van Wijk | yes | jump |
| Reset north | 300 ms | `--e-std` | yes | jump |
| Terrain exaggeration on | ramps 0 to the pref over the last 400 ms of a flight that ends above z3.5 | linear | yes | at once |
| Hover style (fill, line, ring) | 120 ms | `--e-std` | n/a | 0 |
| Tooltip | shows after 80 ms, follows at once, hides at once | n/a | n/a | same |
| Card enter / switch / exit | 200 / 160 / 120 ms | `--e-out` / linear / `--e-in` | yes | 120 ms fade |
| Panel open / collapse | 200 ms; the camera re-frames over 400 ms | `--e-out`, van Wijk | yes | 120 ms fade, camera jumps |
| Phone sheet travel | 260 ms open, 200 ms close | `--e-out` | yes (drag) | 120 ms fade |
| First paint crossfade | 600 ms canvas in, pins 200 ms staggered 15 ms by latitude | `--e-out` | n/a | 120 ms |
| Immersive mode | 200 ms fade of all chrome | `--e-std` | yes | 120 ms |

Every flight uses one `flyTo` with pitch and bearing included; nothing waits for `moveend` to start a second move.
Every animation is cancelled from its current frame by a gesture (MapLibre's `stop()` on the gesture's first frame,
and only then).

## 6. Rendering spec

### 6.1 Atmosphere, sky and edge

| Setting | Light (Relief and Light styles) | Dark |
|---|---|---|
| `sky-color` | `#CFE0EC` | `#1A2E44` |
| `horizon-color` | `#F2F6F9` | `#2A4A66` |
| `fog-color` | `#F2F6F9` | `#0F1A26` |
| `atmosphere-blend` | 1 at z0, 0.6 at z2.5, 0 at z5 | same |
| `sky-horizon-blend` / `horizon-fog-blend` | 0.8 / 0.6 | 0.8 / 0.7 |
| CSS halo `--globe-halo` (behind the canvas, radial from the disc radius to radius + 6% of the diameter) | `#CFE0EC` to transparent | `#2A4A66` to transparent |
| Halo opacity | 1 at z0 to 0 at z4 | same |
| Limb line `--globe-edge` | 1 px `--line-2` `#7A8794` (3.18:1 on `--well`) | 1 px `rgba(255,255,255,.08)` |
| Stage behind the globe | `--well` `#ECEFF3` | `--well` `#0B1119` |
| Stars | none | none |
| Day-night terminator | none | none |

### 6.2 Palette per theme

| Token | Light | Dark | Ratios |
|---|---|---|---|
| `--globe-ocean` (style `background` and `water` fills) | `#A9C4D3` | `#0F1A26` | ink disc 8.81:1 light; surface disc 14.77:1 dark; label `--ink-2` 6.63:1 light, `#C9D2DC` 11.48:1 dark |
| `--map-land` | `#EEE9DF` | `#263241` | ink disc 13.27:1; surface disc 10.94:1; labels 9.99:1 / 8.51:1 |
| `--map-wood` and `--map-park` (replaces Liberty's greens) | `#E4E0D4` | `#2B3845` | a step of land, same hue |
| `--map-high` (hillshade highlight) | `#FFFFFF` | `#34434F` | |
| `--map-shade` | `rgba(23,34,48,.35)` | `rgba(0,0,0,.55)` | |
| `--map-border` | `#8E99A6` 0.8 px, 1.2 at z5+ | `#5E748E` | 2.39:1 on land: a hairline by design |
| `--map-water` (rivers, lakes) | `#7FA6B9` | `#2E5A6B` | darker than the ocean so they read on land |
| `--globe-pin` / `--globe-pin-ink` | `--ink` / `--surface` | `--surface` `#E7ECF1` / `--ink` `#172230` | 16.06:1 / 13.51:1 |
| `--globe-pin-pick` / ink | `--accent` `#E09A1C` / `--accent-ink` | `#EBA830` / `#172230` | 6.96:1 |
| Hover fill | `--accent` 35% (blend `#E9CD9B`, 1.27:1 vs land) plus 1.5 px `--accent` line with 0.5 px `--ink` casing | same with `#0B1119` casing | the casing carries the 3:1 edge |
| Selected line | 2.5 px `--accent` over 1 px casing | same | |
| `--globe-dim` (siblings when a shape is open) | `#F3F1EC` at 70% | `#0B1119` at 60% | |
| Roads | hidden below z9; `--map-contour` above | same | |

No green anywhere on the canvas. Buildings `--map-high`. Relief differs from Light by hillshade strength (0.55 vs
0.2 at z8) and the hypsometric band (`--map-land` to `--map-high` by `color-relief` at z6+ in Relief only).

### 6.3 Label rules

- `text-field` `['coalesce', ['get','name:en'], ['get','name:latin'], ['get','name']]` on every basemap symbol
  layer; `text-transform: none`; one script per label.
- Country names: rank 1 and 2 below z2.5; all countries z2.5 to z4.5; size 11 to 14 by zoom; `text-max-width` 7.
- `place` class state, province and region: hidden below z5; z5 to z7 size 11 `--muted` colour; capitals never.
- Cities: rank 1 and 2 from z3, 3 and 4 from z4.5, all from z6; towns from z7; villages from z10; POI never.
- Water names from z3 (oceans z0), rivers from z6, peaks from z7 (gazetteer) and z11 (tiles), parks from z7.
- Halo 1.2 px `--map-halo` (0.9 in dark), `text-letter-spacing` 0.02, `text-padding` 8, `fadeDuration` 300.
- Our discs register collision boxes through a hidden symbol layer so basemap names move off them.
- Our place labels: `--font-mono` 12, `--ink-2`, halo, `text-optional: true`, hidden below z7 except on hover.

### 6.4 Performance budget

| Measure | Budget | Measured today (GPU) |
|---|---|---|
| Frame time p50 / p95 during spin, drag, fly | 16.7 / 20 ms | 16.7 / 16.8 (spin and fly) |
| Long task after the first `idle` | none over 50 ms | 357 ms (Italy), 376 ms (Sudan ADM1), 398 ms (phone Italy) |
| Long task before the first `idle` | none over 120 ms | 6 of 93 to 169 ms |
| Placeholder disc visible | under 300 ms after navigation | no placeholder |
| Canvas crossfade complete | under 2.5 s desktop, 4 s phone (Fast 3G, 4x CPU) | tiles pop at 1 to 3 s |
| Data before the globe starts | 120 KB gz (110m world 60, facts 25, pins and cards 35) | 236 KB gz for the 50m world alone |
| Admin chunk | 80 KB gz per file; the four big ADM2 files split per state | USA ADM2 278 KB gz |
| Wikidata per card | one request, 1,500 ms timeout, cached 30 days | none yet |
| Markers | 400 DOM markers max, clustered above | fine |
| Memory after 10 min | under 400 MB desktop, 250 MB phone | not measured |

## 7. Acceptance checks

Run with the GPU flags above (SwiftShader numbers are not accepted for motion), at 1440 x 900, 1024 x 768, 390 x 844
and 844 x 390, light and dark. These add to spec 9.1; numbers refer to that table.

| # | Check | Pass when |
|---|---|---|
| 9b | Drag at world: `mouse.down` over ocean, 8 moves of 25 px, `mouse.up` | URL unchanged, centre longitude changed by 20 degrees or more, inertia moves the centre a further 0.5 degree or more within 300 ms, no `click` reaches `onShape` |
| 9c | Spin resets gestures never: count `HandlerManager.stop` calls between `mousedown` and `mouseup` | at most 1 |
| 9d | Spin resume: after a drag ends at world the longitude changes again within 2 to 3 s; after hovering a country the spin slows to 1 deg/s or less within 400 ms and does not stop | timings as the motion table |
| 16 | First paint: a `.globe-placeholder` disc of the computed diameter is visible within 300 ms; the canvas opacity goes 0 to 1 over 600 ms starting at the first `idle`; no `.globe-pin` is visible before that frame | frame sequence at 100 ms |
| 17 | Atmosphere: the mean colour of a 40 px ring just outside the disc is within 12 per channel of `--globe-halo` blended 50% on `--well` at z0, and equals `--well` at z4 | pixel read |
| 18 | No green: no pixel in a 200 x 200 crop over the Alps at z6 has a hue between 75 and 165 degrees with saturation over 12% in any style | pixel read |
| 19 | Labels: at z1.5 no visible label contains non-Latin script or capitals; at z5 over Germany no Land name is in capitals | OCR or `queryRenderedFeatures` on symbol layers checking `text-field` output |
| 20 | Discs: no two `.globe-pin` discs overlap by more than 6 px at any level; the Italy country disc does not cover the "Italy" basemap label (label still rendered per `queryRenderedFeatures`) | geometry |
| 21 | Fly composition: after flying to Italy the country's bbox centre is between 35% and 50% of the free height from the top, pitch 20 within 1; after South Tyrol pitch 45 and bbox centre 30% to 45% | camera and `project()` |
| 22 | Reset: the reset-view button exists at every level and size, is never overlapped, and returns to `/globe/` with the world frame zoom within 0.05 | geometry, URL |
| 23 | Cards: a place with no photo shows no element taller than 96 px with a background and no children; "Draft" never appears; the phone sheet has one close button | DOM |
| 24 | Feature card: after selecting a river, the highlighted line has at least 200 px visible outside the card's rect | `queryRenderedFeatures` of `hl-river` against the card rect |
| 25 | Long tasks: none over 50 ms from the first `idle` through drilling into Italy, Texas and Ontario | `PerformanceObserver` |
| 26 | Phone: the attribution is one line, and the pairwise intersection of crumb, buttons rail, attribution, sheet and card is empty | geometry |
| 27 | What is here: a 500 ms press on land at z9 opens the sheet with a country, a state and at least one feature row, and does not drill | touch via CDP |

## 8. Not assessed headless

- Perceived smoothness on the owner's own GPU and on a mid-range phone: frame times here are from a desktop Arc GPU
  at 60 Hz. The spin and flights are 16.7 ms steady, so what remains is subjective easing, which the owner should
  judge on the preview after M1 and M7 land.
- Touch inertia and pinch feel: Playwright's touch is a single point and no velocity.
- Fonts: the Big Shoulders and Source Serif webfonts load in headless; the system emoji font differs from the
  owner's.
- Real network: tiles came over this machine's connection; the budgets in 6.4 need the CI throttle job.
- Wikidata latency and image fallbacks: not built, so not measured.
