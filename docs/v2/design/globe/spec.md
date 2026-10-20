# Globe enhancement spec (L2b)

Target for the public `/globe` after lane L2 merges. Written 18 Oct 2026 from [review.md](review.md); revised the same
evening from [experience-review.md](experience-review.md) (the GPU-measured experience review) and the owner's feedback
F1 to F7 in [owner-feedback-2026-10-18.md](owner-feedback-2026-10-18.md). It extends patterns 3.2, components 7.2 and
tokens 5 and 11; where it changes them, section 10 lists the foundation edits. A Sonnet builder should be able to
implement each numbered rule and check it with section 9. Sections changed in the revision are marked **[changed]**;
section numbers are stable. Where this spec and the experience review differ, this spec wins; the review holds the
evidence (shots, traces, ratios).

Changed in the revision: 1 (ranking), 3.2 (reset view, rails, attribution, control card default), 4.1 (tooltip and
card, long-press), 4.2 (city row), 4.3 (image-first cards), 5.1 (inertia), 5.2 (spin implementation), 5.3 (one
flight with pitch, pitch by level, composition), 6.1 (no green), 6.2 (label rules), 6.3 (casing widths), 6.4 (dim),
6.5 (clustering at every level), 6.6 (atmosphere values), 8.1 (long-task budget), 8.3 (first paint), 9.1 (checks 9b
to 9d and 16 to 27), 10 (new tokens), 11 (Canada census divisions, ADM2 audit, city polygons, card payload).

The owner's goal in one line: anyone opens `/globe`, the world fills the screen and turns, and everything with a name
(country, state, district, river, lake, sea, peak, range, park, city, our saved places, our trips) can be pointed at,
tapped and opened, smoothly, on a phone as well as on a desktop.

References looked at, not copied: Google Earth web (fly-in choreography that zooms then tilts, the search-first entry,
knowledge cards anchored to the place), Apple Maps globe (atmosphere and label fading, no chrome until needed), Mapbox and
MapLibre globe examples (`setProjection`, atmosphere blend by zoom, spin that pauses on interaction), Windy (one floating
control card, everything else is the picture), earth.nullschool (spin inertia and a single "what is here" readout on tap),
Felt (a collapsible side list that is the map's equivalent, pins that are quiet until pointed at).

## 1. Ranking

| Rank | Item | Section |
|---|---|---|
| **Must for launch** | Drag works at world level and never drills in; spin as chained `easeTo`, speed 0 on pointer down (review M1) | 5.2 |
| Must | First paint: placeholder disc, canvas crossfade on first `idle`, pins after (review M2) | 8.3 |
| Must | Atmosphere, halo and limb per theme; no green; label rules; dark palette with land lighter than ocean (review M3 to M5) | 6.1, 6.2, 6.6 |
| Must | Discs cluster in screen space at every level; data tree has one node per admin-1 region (review M6) | 6.5, 11 |
| Must | One flight per step with pitch inside it; pitch by level; subject in the upper-middle (review M7) | 5.3 |
| Must | Reset view button in the rail, Home key; crumb never covered (F5) | 3.2, 4.6 |
| Must | Image-first selection card with fallback chain, summary, three facts, Used in, Directions and Share; no "Draft" (F6) | 4.3 |
| Must | Full-screen framing by viewport; panel collapse; phone and landscape layouts | 3 |
| Must | Hit priority by zoom and class so rivers, lakes, seas, peaks, parks and cities are selectable at any level | 4.1 |
| Must | Tap selects on touch; long-press "what is here" | 4.1 |
| Must | Selection card per class with data source per field | 4.3 |
| Must | Two-way hover between panel rows and shapes; selection and drill-down rules | 4.4, 4.5 |
| Must | Camera and motion: viewport camera, inertia, spin rules, fly-in zoom then tilt, terrain fade | 5 |
| Must | Hover and selection styles with casings that pass 3:1 on land and water, light and dark | 6.3 |
| Must | Search everything clickable, with saved places and trips first | 7.1 |
| Must | Performance budgets and loading order; 110m world for first paint | 8 |
| Must | Acceptance checks run in CI with tiles allowed in one shot job | 9 |
| Must | No long task over 50 ms after the first `idle`; admin files parsed and tallied in a worker (review M12) | 8.1, 8.3 |
| Must | Canada ADM2 replaced by census divisions; ADM2 audit for level, truncation and shoreline (F4) | 11 |
| **Should** | City areas from OSM admin_level 8 for cities with our content; honest ring and "Boundary not loaded" for the rest (F3) | 4.2 |
| Should | Hover slows the spin to 25% rather than stopping it (review S1) | 5.2 |
| Should | Lakes as polygons, parks with cards, cities with cards | 4.2, 7 |
| Should | Filters: trips only, places by kind; immersive mode | 7.2, 3.4 |
| Should | Clustering at state level above 30 places | 6.5 |
| Should | Offline: shapes and visited admin files cached; tiles notice | 8.4 |
| Should | Keyboard sweep of pins on the canvas (arrows between pins) | 4.6 |
| **Later** | Ranges and plateaus as outlines (Natural Earth geography regions) | 4.2, 11 |
| Later | Random / inspire; "places like this" on a feature card | 7.3 |
| Later | Night style with a sky tint per theme; label language switch | 6.6 |
| Later | Signed-in trips in identity rings (planner phase) | patterns 3.2 |

## 2. States and vocabulary

| State | URL | Camera | Pins drawn | Panel |
|---|---|---|---|---|
| World | `/globe` | viewport camera (3.1), spinning | one disc per country with content | continents and countries with counts |
| Country | `/globe/<cc>` | fits the country (5.3) | state discs, the country's trips | states and regions, trips, places |
| State | `/globe/<cc>/<state>` | fits the state | district discs (2+ places) and place dots | districts, trips, places |
| District | `/globe/<cc>/<state>/<district>` | fits the district | place dots | trips, places |
| Place selected | `/globe/place/<slug>` | flies to the pin at zoom 12 (trail: fits its line when we have it) | as the level it sits in | the same, row marked `aria-current` |
| Trip selected | `/globe/trip/<slug>` | fits the trip's bases at zoom 8 or less | the trip's base pins and its places | the trip's places by day |
| Feature selected | the level URL plus `?f=<class>:<wikidata or name>` | unchanged, or Fly here | unchanged | unchanged; the feature card floats |
| Camera | any of the above plus `?c=lng,lat,zoom[,pitch,bearing]` | restored on load | | |

`?f=` is new: a basemap selection (a river, a sea) must be shareable too. It is optional and never needed to resolve a page
(patterns 1.2). Pitch and bearing join `?c=` because the fly-in tilts.

## 3. Full-screen use

The canvas is always the whole area under the header (60 px; 56 on phone) and above the phone bottom bar. Nothing else
has a background that touches an edge; everything floats with 12 px insets (8 on phone) and respects
`env(safe-area-inset-*)`.

### 3.1 Framing

World camera, computed on load and on resize (debounced 150 ms), never a constant:

```
free = canvas minus the open panels' footprints (panel 360 + 24 on the right when open; control card 316 x 240 bottom-left is ignored because the disc sits above it)
d    = 0.86 * min(free.width, free.height)          // disc diameter in CSS px
zoom = log2(d / 512)                                 // MapLibre globe: diameter at zoom z is 512 * 2^z px
centre = [lng of the last camera or -35, 20]; pitch 0, bearing 0
```

The disc's centre is placed at the centre of `free`, not of the canvas, so with the panel open the globe sits left of it
and nothing is hidden. 1440 x 840 with the panel open: free 1,044 x 816, d 702, zoom 0.46 above the current 1.35 look
of the live site because the live disc is 560 px; at 1024 x 708 free 628 x 684, d 540; at 390 x 672 (phone, under the
peek sheet) free 390 x 552, d 335; landscape 844 x 334 free 544 x 334 with the side peek, d 287.

Minimum zoom is the world camera's zoom minus 0.2 (the disc can never shrink below 80% of the frame). Maximum 17.

### 3.2 What floats where

| Element | 1440 and 1024 | 390 portrait | 844 x 390 landscape |
|---|---|---|---|
| Breadcrumb chip with Back | top-left, 12 px; collapses to "… › South Tyrol" when wider than 40% of the free width | bottom-left above the sheet's peek, 8 px; "… › last" always | top-left |
| Search | top-centre of the free width, 420 px | full width under the header, 8 px insets; becomes a 44 px icon button once the visitor has interacted (tap re-expands) | top-centre, 320 px |
| Status pill | under the search, centred | under the search | under the search |
| Control card **[changed]** | collapsed by default to a "Map options" pill bottom-left (36 px, layers glyph); opens to the 316 px card (components 7.2); open state in `sessionStorage` | hidden; the Map options button in the icon rail opens a half sheet | in the right rail |
| Rail: zoom in, zoom out, **Reset view**, reset north **[changed]** | vertical rail of 36 px buttons, 12 px from the free right edge, bottom 72; Reset view (globe glyph, `aria-label="Reset to the world"`) is always present at every level; reset north appears above it only when bearing or pitch is non-zero | a 44 px icon rail bottom-right above the sheet peek: layers (Map options), list, Reset view; reset north when needed; no zoom buttons | right rail, same order |
| Hint toast **[changed]** | bottom-centre of the free width, sentence case `--t-meta`, shown once per session for 4 s then fades `--d-base`; never after the first gesture | the sheet's peek carries the hint text for two seconds per level | hidden |
| Side panel **[changed]** | right, 340 px, top 12 bottom 36; heading `--t-card` 20 px sentence case with the count in `--t-meta`; collapses to a 44 px tab (3.3) | bottom sheet: peek 120, half 50%, full under the header (components 5.5); the sheet header is the handle plus one close, snaps by drag | right side sheet 300 px with a peek of 56 px (a vertical tab with the count), half and full |
| Selection card **[changed]** | anchored to the pin, 320 px, flips left or above when it would leave the free area or cover the crumb chip (the crumb rect counts as occupied); the panel stays; the tooltip is hidden while a card is open | bottom sheet at half, replacing the list sheet, with no sheet title of its own (the card's title and close are the only ones); closing returns to the list at peek | right side sheet at full; the search collapses to an icon while a card is open |
| Feature card **[changed]** | anchored to the click point like the selection card, 300 px, flipped so the highlighted feature stays visible (for a line, on the side away from the line's screen direction) | above the sheet peek, full width | right sheet at half |
| Attribution and scale **[changed]** | bottom-right of the free width, MapLibre `compact: true` expanding on hover or tap, mono 11.5, one line; the scale bar bottom-left of the free width, hidden below z6 | one line above the sheet peek, 11 px mono, truncated with "…", expands on tap; never under a button | bottom-right, clear of the rail |

Rules. No two floating elements may overlap at any size in the acceptance shots. The free width is the canvas minus the
open panel; every "centred" element centres on the free width, so opening the panel slides the search and hint 170 px
left over 200 ms `--e-out` (L2 already does this for the hint). The crumb chip and the phone icon rail share one
baseline above the sheet peek; the crumb truncates to "… › last" before it can touch the rail.

**Landscape card dock (accepted 19 Oct 2026, review L2b ruling 1).** At 1024 wide and on a landscape phone (844 x 390) the
selection card is a left dock instead of a card riding on its pin or a right sheet: it keeps the right panel and the pin
visible, which a right sheet could not. The dock starts 8 px under the crumb's measured bottom (`--globe-dock-top`), its
actions row is a sticky footer so "Open place" never scrolls away, the photo is 64 px in landscape, and the panel drops to
its tab while a card is open. The attribution and the scale bar are never under it: on a phone they sit on the left and ride
above the card sheet (`--globe-card-sheet-h`), in landscape the scale bar sits left of Map options and the rail.

### 3.3 Collapse and expand

- The panel tab (44 x 96, right edge) shows a chevron and the count of what is listed ("51"). Click or Enter opens it;
  the camera re-frames to the new free area over 400 ms (world: recompute 3.1; a level: `fitBounds` again) so the
  subject never ends up under the panel.
- Phone sheet snaps: peek shows the level name, the count and the first row; drag or the Expand button for half and
  full; at full the canvas is still there behind at 20% so the visitor knows where they are. Opening a card swaps the
  list sheet for the card sheet; Back or the card's close returns to the list at the snap it had.
- The control card remembers nothing except what prefs already store (style, terrain, exaggeration, spin). The panel's
  open or closed state is stored in `sessionStorage`, not in the URL.

### 3.4 Immersive mode

A button in the control card ("Hide controls", keyboard `.`) toggle immersive (no double-tap: it is MapLibre's zoom on touch, 4.1 rule 5): every
floating element fades out over 200 ms except attribution (always visible, legal) and a 32 px "Show controls" pill
bottom-centre that itself fades to 40% after 3 s and returns to 100% on pointer move. Immersive is off on load, not in
the URL, and ends on Esc, on any search shortcut, or when a card opens. Immersive is full screen (review S8): the site header
and the phone bottom bar collapse (`html[data-globe-immersive]`) and the globe takes the whole viewport; where the browser has the
Fullscreen API it also takes the browser's own chrome, and leaving full screen with the browser's key ends immersive.

## 4. Interaction model

### 4.1 Pointing, tapping and the hit order

One rule decides what the pointer is over, evaluated on `mousemove` (desktop), `click`, `tap` and `long-press`:

| Zoom | Order of layers queried (first non-empty wins) |
|---|---|
| below 3 | our pins (DOM, always first) › country fill |
| 3 to 5 | pins › peaks and cities (`mountain_peak`, `place` at rank ≤ 4) › sea and lake labels (`water_name`) › rivers (`waterway`) › state fill (if open) › country fill |
| 5 and above | pins › peaks › cities and towns › lakes (polygon, 4.2) › rivers › parks › seas (`water_name`) › district fill (if open) › state fill › country fill |

Rules:

1. A fill never takes the pointer when a named point or line is within the hit box (5 px desktop, 12 px touch). This
   fixes review C2 and L2-2.
2. Inside an open country, the open shape itself is not a target at its own level (as today); its children are.
3. Hover (desktop only): tooltip after 80 ms, follows the pointer with a 16 px offset, flips to stay inside the canvas,
   `role="status"` throttled to one announcement per 800 ms. The hovered shape or feature takes the hover style (6.3)
   immediately with a 120 ms fade.
4. Click or tap: on a pin opens its card; on a shape drills in (country › state › district) and pushes a URL; on a
   feature selects it (feature card, `?f=`); on nothing clears the feature, then the card, then nothing (never steps a
   level: Back and Esc do that).
5. Touch has no hover, so the first tap acts. Double-tap zooms in (MapLibre default); the tap handler waits 250 ms for
   a second tap only when the first tap hit a shape, never for a pin (pins respond at once).
6. Long-press (500 ms, finger still within 8 px) or right-click shows **What is here**: a sheet or popover at the point
   listing, nearest first, the country, state and district under the point, the named features within the hit box
   (river, lake, park, peak, city), the elevation at the point (from the DEM via `map.queryTerrainElevation`, rounded
   to 10 m) and our saved places within 25 km (up to 5). Each row is a button that selects or opens. This is the
   phone's path to everything hover gives the desktop.
7. Pointer cursor on anything hittable; grab and grabbing during drag.
8. **[changed]** The tooltip is hidden while a selection card or feature card is open, and while a pointer is down.
   A press of 500 ms on touch never drills in; it opens What is here (rule 6). The L2 build drilled into Alta
   Pusteria on a 650 ms press (review M13).
9. **[changed]** A drag never produces a click. MapLibre guarantees this on its own as long as nothing calls
   `map.stop()` between `mousedown` and `mouseup`; see 5.2 for the spin rule that broke it in L2 (review M1).

### 4.2 Feature classes

| Class | Hover and tap target | Shape highlighted | Source of the shape | Card fields (4.3) |
|---|---|---|---|---|
| Country | Natural Earth 50m fill (110m at world until zoom 3, 8.2) | outline and fill | our `countries-50m.json` | flag, name, official name, capital, population, area, languages, region, places and trips, Wikipedia |
| State or province | NE 10m admin-1 fill, when its country is open or above zoom 4.5 | outline and fill | `*-ADM1.json` | name, local name, type, ISO code, places and trips, Wikidata |
| District | geoBoundaries ADM2 fill, when its state is open | outline and fill | `*-ADM2.json` | name, places, Wikipedia search |
| River | `waterway` line, zoom 3+ | the whole named line (`hl-river` by name as today) | OpenMapTiles | name, class, intermittent, length and outflow from Wikidata (P2043, P403) when `wikidata` tag exists |
| Lake | zoom 5+: `water` polygon with a name (OpenMapTiles has names on lakes from zoom 8; below that NE 10m lakes polygons, 11) | fill at 35% plus outline | OpenMapTiles `water` or NE lakes | name, area, elevation, max depth (Wikidata P2046, P2044, P4511) |
| Sea or ocean | `water_name` label hit; the sea has no polygon in the tiles | 10 px ring on the label plus a 2 px ring 36 px around it | OpenMapTiles | name, class, area (Wikidata P2046), bordering countries |
| Peak | `mountain_peak` point, zoom 7+ (tiles start at 11; from 7 to 11 use the gazetteer `physical` points of class peak) | 9 px ring | OpenMapTiles plus gazetteer | name, elevation (`ele`, else Wikidata P2044), range (P4552), first ascent (P61? no: P1619 is "date of official opening"; use P2949 only if present, else omit), prominence (P2660) |
| Range or plateau | gazetteer point (today); NE 10m geography regions polygon (later) | ring; later the polygon outline | gazetteer; NE | name, highest point (P610), countries |
| Park or protected area | `park` polygon, zoom 5+ | outline 2.5 px plus fill 20% | OpenMapTiles | name, designation (`class`), area (Wikidata P2046), IUCN category (P814), our places inside (point-in-polygon on our pins) |
| City or town **[changed]** (F3) | `place` point, rank ≤ 4 below zoom 7, all classes `city`, `town` above | for cities with our content: the OSM `admin_level=8` polygon pre-built at build time (`cities-adm8.json`, section 11), filled 20% and outlined like a district; for every other city: a 2 px `--accent` ring 36 px around the label plus the basemap `boundary` lines with `admin_level` 8 within 40 km highlighted at 60%, and the card says "Boundary not loaded" | pre-built OSM polygons; OpenMapTiles `boundary` | name, country and state, population (P1082), elevation, our places within 25 km, "Boundary not loaded" when applicable |
| Saved place (ours) | DOM pin | pin turns `--globe-pin-pick` with the select ring | LD `globeIndex()` | as L2: photo with credit, name, area chain, kind chip, completeness badge, Location approximate chip, Open place |
| Trip (ours) | DOM pin at the first base; selected: all base pins and a dashed `--map-route-dim` line between bases | pin pick style; bases numbered | LD `getTrip()` | cover, title, dates or "undated", nights, bases, countries, Open trip |

Towns below rank 4 at world and country level are not targets (too dense); search reaches them.

### 4.3 Selection card **[changed]**

One component, image-first, two anchors (pin-anchored on desktop and landscape, sheet on phone). The wireframes and
field order per class are in experience-review.md section 4 and the direction mock is `mock/index.html`; this is the
rule set.

Header. Saved place: the place photo (320 x 150 desktop, 132 tall on phone, `object-fit: cover`, credit bottom-left
in 11 px mono over a 40% `--ink` gradient). Fallback chain, in order: the place's own credited photo; the first
gallery photo of a published trip that uses the place; the Wikidata `P18` image (or the Commons category's first
image) with its credit and licence; and last a **compact header** 96 px tall on `--surface-2` with the kind glyph at
24 px and the area chain, never an empty well. Trip: the cover with the same chain. Country, state, district, feature
and city cards have no image; the country card carries the flag at 20 x 15.

Body, in order: kicker (`--t-cap`, kind in `--ink-2`, then the area chain or country and state in `--muted`; for
features the chain comes from point-in-polygon against our loaded shapes or the gazetteer's `a3`); title (`--t-card`
20 px, sentence case, never uppercase); summary (one line, up to 120 characters, `--ink-2`; places and trips only);
facts (three, as a row with `--t-cap` labels: places show best months, kids and elevation or length; trips show
dates or "Dates open", bases and places; features as 4.2); **Used in <trip>, day n** for places; **Saved places near
here** for features and cities (within 25 km for points, inside for polygons, up to 4, each a row that opens that
card); actions; the honesty chip "Location approximate" only when true; the completeness badge.

Actions per class: ours get **Open place** or **Open trip** (primary, amber), **Directions** (a Google Maps
directions link built from the pin's coordinates, which is allowed because no map is drawn) and **Share** (the Web
Share API, else Copy link); trips also get **Show route** (draws the dashed base line). Features get **Fly here**
(primary only when the feature is off-screen), **Wikipedia** (from the Wikidata `enwiki` sitelink when we have the
QID, else a search link marked as such) and **Copy link** (the `?f=` URL). Every external link opens a new tab with
`rel="noopener"`.

Completeness shows as the place page's own badge ("Usable · 13 of 15", `--ok` dot, the one place green is allowed) or
not at all. The word "Draft" and the household status (idea, shortlisted, planned, visited, dropped) never appear on
a public card (F6, F7). The card payload (`buildGlobeData()`) gains `summary`, `facts`, `usedIn` and `image` with
its source and credit, so the client needs no second fetch for our own places.

Transitions: enter 200 ms `--e-out` with a 6 px slide from the anchor side; switching between two pins in view
cross-fades 160 ms without moving; close 120 ms `--e-in`. A deep link opens its card on `moveend`, not during the
flight.

Data sources per field, honestly labelled. Facts from the tile properties are instant; Wikidata facts load after the card
opens (one `wbgetentities` call per QID, cached in `localStorage` for 30 days, 1,500 ms timeout) and show as skeleton
rows that fill in; if the call fails the rows disappear, nothing says "unknown". A field from Wikidata carries a tiny
"Wikidata" source mark on hover (title attribute) and the card footer says "Facts: OpenStreetMap, Wikidata" when any
loaded. Never show population or area without its source.

### 4.4 Panel and canvas are one thing

- Hovering a row highlights its shape or pin with the hover style; hovering a shape or pin marks its row (`data-hot`)
  and scrolls it into view only if the panel is open and the row is off-screen (smooth, 200 ms).
- Selecting a row does exactly what clicking the shape or pin does, including the URL push.
- The panel heading is the level name with the count; below it, sections in this order: children (states, districts),
  trips, places. Empty level: an empty-state card (components 6.1) with the country facts and "Nothing saved here yet.
  Search a place or pick another country".

### 4.5 Selection and drill-down

- Opening a place or trip card does not change the level unless the pin is outside the open area; then the controller
  opens the pin's own path first (L2 does this) and flies.
- Drilling in clears a feature selection and a card; stepping out (Back, Esc, crumb) keeps a card if its pin is still
  inside the new level, else closes it.
- A feature selection survives zoom and pan; it clears on drill-down, on Esc, on a click on nothing, and on selecting
  anything else.
- Esc order: close What is here › close feature › close card › step up one level › nothing at world.

### 4.6 Keyboard

| Key | Action |
|---|---|
| `/` | focus search |
| Tab order | header › crumb (Back, crumbs) › search › canvas (`role="application"`) › control card › zoom › panel tab or panel rows |
| In the canvas | arrows pan 80 px (Shift: 320), `+` `-` zoom, `[` `]` rotate 15 deg, `Home` world camera, `Enter` selects the shape under the canvas centre, `Space` toggles spin at world |
| `Home`, `Shift+Esc`, Reset view button **[changed]** (F5) | from any level or card: close the card, clear the feature, `goArea([])` and `frameWorld(true)` in one flight (5.3 stepping out), pitch and bearing to 0; the button sits in the rail (3.2), is focusable in the rail's Tab order, announces "World" on arrival; `N` resets north only |
| `P` then arrows | pin sweep: `P` focuses the pin nearest the centre, arrows move to the nearest pin in that direction, Enter opens, Esc returns focus to the canvas (should) |
| Esc | as 4.5 |
| `.` | immersive mode |
| `?` | shortcut list (patterns 1.3) |

The canvas announces its state on focus: "Globe. World. 12 countries with places and trips. Use the list to browse."
and after each level change: "Italy. 8 regions, 51 places, 1 trip."

### 4.7 URLs and history

As patterns 1.2 plus `?f=` (section 2). Rules: drill-down and card open are `pushState`; camera moves are
`replaceState` of `?c=` at most every 400 ms after `moveend`; a feature selection is `replaceState` of `?f=`; Back
returns to the previous state with the previous camera (store the camera in `history.state`). Slugs for states and
districts come from the LD node when it exists (`south-tyrol`) and otherwise from `slugify(shape name)`; the resolver
accepts both and also the ISO code (`it-32`) so a renamed node keeps old links working.

## 5. Motion and camera

Durations and curves from tokens 11 (`--d-globe` 1200, `--d-fly` 600 to 900, `--e-out`, `--e-std`). Everything is
interruptible: pointer down, wheel, a new fly or Esc cancels the running animation from its current frame (L2's
`flyToken` pattern).

### 5.1 Drag, inertia, zoom

- Drag rotates the globe at 1:1 with the pointer at the disc's centre (MapLibre default); on release MapLibre's
  `dragPan` inertia stays on with `deceleration` 2500 and `maxSpeed` 1400 so the globe keeps turning briefly, the way
  earth.nullschool does, and comes to rest within 600 ms. **[changed]** Nothing may call `map.jumpTo`, `easeTo`,
  `flyTo` or `stop()` while a pointer is down: each of those resets MapLibre's gesture handlers, which is why L2's drag
  never started and its release drilled into a country (review M1). Acceptance 9.1 check 9b and 9c guard this.
- Wheel zoom is around the pointer; pinch zoom around the midpoint; double-tap zooms by 1 around the tap.
- Pitch is allowed only above zoom 3.5 (terrain gate) and up to 70 deg; below 3.5 pitch eases back to 0 over 300 ms.
- At the world level the camera's latitude is clamped to -60 to 72 so the visitor cannot park the view on a pole where
  the globe looks like a cap.

### 5.2 Spin

| Rule | Value |
|---|---|
| Rate | 1 revolution per 90 s (4 deg/s), westward to eastward (lng increases) |
| Where | world level only; zoom below `SPIN_MAX_ZOOM` 3.2; no card, no feature selected; document visible |
| Pause **[changed]** | pointer down, touch start, wheel, a keyboard camera key, a card opening or a level change: speed goes to **0 at once** (no decay while a gesture may follow). Hovering a country or feature slows the spin to 25% over 400 ms `--e-std` and does not stop it (review S1) |
| Resume **[changed]** | 2 s after a gesture ends at world level, 20 s after the last hover left the canvas, 2 s after arriving back at world (Back, Esc, Reset view): speed ramps 0 to 1 over 600 ms `--e-out`; never while a card or feature is open |
| Switch | Auto-spin in the control card; off persists in prefs; disabled under reduced motion with the note |
| Implementation **[changed]** | MapLibre's own pattern, not a per-frame `jumpTo`: `map.easeTo({center: [lng + 4 * speed, lat], duration: 1000, easing: t => t, essential: false}, {spin: true})` chained on `moveend` while active, so a gesture interrupts it once through the normal `stop()` and the handlers are never reset mid-gesture; `moveend` events carrying `spin` do not write the URL; the chain stops when `document.hidden`, when the view leaves the world level or passes `SPIN_MAX_ZOOM`, and when a pointer is down. The speed ramps (25%, 0 to 1) are applied to the step's longitude delta at each 1 s step and to the step's easing where a smoother ramp is wanted (`t => t` within a step is fine at 4 deg/s) |

### 5.3 Fly-in choreography **[changed]**

One `flyTo` per step with the target pitch and bearing inside it. No step waits for `moveend` to start a second
move: L2's zoom, 470 ms pause, then a 500 ms tilt is the see-saw the owner felt (review M7). Durations come from
MapLibre's distance model (`speed` 1.2, `curve` 1.42) capped with `maxDuration`; the cap never triggers a jump
because the model's duration for any hop on this page is under it.

| Step | Country | State | District, place | Trip | Feature (Fly here) |
|---|---|---|---|---|---|
| Camera | `cameraForBounds` of the shape with the layout padding, then the centre shifted north in screen space by 0.12 x the free height so the shape sits in the upper-middle once pitched | same, shift 0.18 | district: bounds, shift 0.18; place: zoom 12 (trail with a line: fit the line at 14 max), shift 0.22; approximate pin: the country camera | fits the bases at zoom 8 or less, shift 0.15 | the class zoom: river 8, lake 11, sea by rank 2.2 to 6, peak 12, park 10, city 11 |
| Pitch | 20 (45 at country zoom shows half a continent) | 45 when terrain is on and zoom is 3.5 or more, else 0 | 55 with terrain on, 0 for approximate pins | 40 | 45 for peaks and lakes, 0 for seas and rivers |
| `maxDuration` | 1800 ms | 1600 | 1600 | 1600 | 900 |
| Terrain | `setTerrain` is applied at the start of the fly with exaggeration ramped 0 to the pref over the last 400 ms of the zoom (`setTerrain` each frame at 60 fps costs nothing measurable; if it jitters, ramp in 5 steps) | same | same | same | same |
| Wide shapes | span over 170 deg of longitude (Russia, Canada, the US with Alaska, France with territories): fly to the mainland bbox (precomputed in `countries.json` as `mainland_bbox`) at zoom 2.6 to 3.2, pitch 0 | n/a | n/a | n/a | n/a |
| Stepping out (Back, Esc, crumb, Reset view) | the same single flight to the parent's camera; pitch stays until 60% of the flight and eases to the parent's pitch over the last 40% (MapLibre interpolates pitch linearly, so pass the parent's pitch and let the curve carry it; if it reads as a see-saw, split pitch into the flight's `easing` with a delay); at world the spin resumes after 2 s, not 20 | | | | |

Bearing is always 0 on a flight unless the visitor rotated the view; then it is kept. Reduced motion: every fly is a
`jumpTo` with the target pitch applied at once; terrain applies at once; fades 120 ms.

### 5.4 Terrain

- 3D terrain on by default on desktop and off by default on phones with `navigator.hardwareConcurrency` of 4 or less or
  `deviceMemory` of 4 or less (the heaviest thing the globe does); the switch is always available.
- Gate: on only when zoom is 3.5 or more (seams on the globe below), applied on `zoomend` and during fly-ins (5.3).
- Exaggeration 0.5x to 2x, default 1.2x (the live 1.3x looked right for the Alps; 1.0 flattens the Dolomites).
- Hillshade always on in Relief and Dark, off in Light above zoom 10 (streets read better).

## 6. Visual layers

### 6.1 Styles

Three styles, one tile source: **Relief** (Liberty recoloured to tokens 5 with hillshade and the hypsometric tint
`--map-land` to `--map-high` by elevation band, parks and woods as `--map-wood`), **Light** (Positron recoloured, no
hillshade above zoom 10), **Dark** (OpenFreeMap dark recoloured with the dark column, hillshade). `auto` follows the
page theme: Relief in light, Dark in dark. Relief and Light must differ visibly at zoom 6 (9.1 check 7).

**[changed]** No green on the canvas in any style: Liberty's landcover, landuse and park fills become `--map-wood`,
a warmer step of `--map-land` with the same hue (light `#E4E0D4`, dark `#2B3845`); the style `background` is
`--globe-ocean`, never land, so an unloaded globe reads as sea. In Dark the land (`#263241`) is lighter than the
ocean (`#0F1A26`), the way Apple's dark map reads, instead of L2's bright teal sea around near-black continents.
Full palette with ratios: experience-review.md 6.2 and section 10 here. The floating chrome follows the map style's
mode (`data-globe-style`), not the page theme, so a Light map never carries a dark control card (review S7).

### 6.2 Labels per zoom

| Zoom | Shown from the basemap | Ours |
|---|---|---|
| 0 to 2.5 | country names (rank 1 and 2 only), oceans | country discs |
| 2.5 to 4.5 | all country names, seas, capital cities | country discs, then state discs when a country is open |
| 4.5 to 7 | states, cities rank ≤ 4, large lakes and rivers (rank ≤ 3), ranges from the gazetteer as mono labels (`--map-label`) | state discs, place dots with no label |
| 7 to 10 | towns, rivers, lakes, parks, peaks from the gazetteer | place dots with labels on hover; district labels (`adm2-label`) |
| 10+ | everything the style has except POI and house numbers | place labels always (`--map-label`, halo) |

Label font is the style's own (Noto Sans) for basemap names; ours use `--font-mono` 12 px with `--map-halo`. Our labels
never collide with a pin: `text-optional` and `text-padding` 6 as today; pins are DOM and always win.

**[changed]** One label pass is applied to all three styles after `style.load` (review M5), since each OpenFreeMap
style keeps its own label logic otherwise:

- `text-field` `['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]` on every symbol layer;
  `text-transform: none`; one script per label (no "Belarus Беларусь").
- `place` class `state`, `province` and `region` hidden below zoom 5; from 5 to 7 size 11 in `--muted`; never capitals.
- Country names rank 1 and 2 below zoom 2.5; `text-size` 11 at zoom 1 to 14 at zoom 5; `text-max-width` 7.
- Cities rank 1 and 2 from zoom 3, 3 and 4 from 4.5, all from 6; towns from 7; villages from 10; POI never.
- `text-halo-width` 1.2 (0.9 in Dark), `text-letter-spacing` 0.02, `text-padding` 8, `fadeDuration` 300.
- Our discs register collision boxes through a hidden `symbol` layer (an `icon-image` of a transparent 1 px sprite
  with `icon-size` scaled to `discSize`) so basemap names move off them; the Italy disc must not cover "Italy".

### 6.3 Hover and selection styles, with ratios

Tokens 5 is right about the colours and wrong about one blend. Final rules (light / dark ratios computed from
tokens.md values; land `#EEECE6` / `#1A2330`, water `#6F9FB4` / `#3F7C8F`):

| Thing | At rest | Hover | Selected |
|---|---|---|---|
| Country, state, district fill **[changed]** | none (country), `--ink` at 6% (states), 5% (districts) | `--accent` at 35% (`#E9CD9B` light over `#EEE9DF`, 1.27:1 vs land; dark `#5D4B2E`, 1.89:1) **plus** a 1.5 px `--accent` line with a 0.5 px casing (`--ink` light, `#0B1119` dark), so the edge passes 3:1 on both land and water | fill 0, **2.5 px `--accent` line over a 1 px casing**, never a 4 px casing (L2's read as a black border, review M14); siblings dimmed with `--globe-dim` (6.4) |
| River | style colour | `--accent` 2.2 to 5 px by zoom with 1 px `--ink` casing | same, plus a 60% opacity "glow" line 2x wide at 25% |
| Lake, park | style colour | fill `--accent` 20% plus 1.5 px cased outline | fill 10%, 2 px cased outline |
| Sea | label | 10 px ring on the label | the ring plus a 36 px ring at 2 px |
| Peak, city | style symbol | 9 px ring, `--accent` 2 px with `--ink` casing | same, 11 px |
| Country disc (ours) | `--ink` disc, `--surface` count, 2 px `--map-halo` edge (count 16.06:1 light, 13.83:1 dark; disc on light water 5.58:1, dark disc on dark water 3.93:1) | `--globe-pin-pick` (`--accent` disc, `--accent-ink` count 6.96:1) with the 2 px `--map-select-ring` at 4 px offset | same, ring stays; the row is `aria-current` |
| Place dot | `--map-stop` 6 px with 1.5 px halo (14 px with the halo in L2) | kind glyph tag beside it (`--surface`, `--ink`, `--line-2` border) and the pick colour | pick colour, ring, label tag hidden (the card names it) |
| Trip pin | `--ink` 26 px rounded square, `--surface` route glyph | pick colour and ring | pick colour; bases numbered `--map-pin`; dashed `--map-route-dim` between bases |

Nothing on the canvas is amber at rest (changes-from-preview 23). Hover transitions 120 ms; none under reduced motion.

### 6.4 Dimming

**[changed]** When a country is open, every other country is covered with `--globe-dim` (light `#F3F1EC` at 70%,
dark `#0B1119` at 60%), drawn **above** the basemap's label layers so names and hillshade outside the open shape dim
with the land (L2 drew the dim fill under the labels and the neighbours stayed as loud as the subject, review M14);
the same for sibling states and districts. The open shape keeps full basemap strength, which is what focuses the eye.
Our pins outside the open area fade to 35% opacity but stay clickable (L2's `applyPinFocus` idea). Our own labels
outside the open area fade to 40%.

### 6.5 Pins and clustering

- World: one disc per country with content, 28 to 44 px by `log2(count)` (L2 `discSize`), positioned at the country's
  `latlng` from the facts file, moved to the mean of its pins when the facts point is off the mainland.
- Country: one disc per state with content at the mean of its pins; trips as trip pins at the first base.
- **[changed]** Screen-space clustering at **every** level, not only above 30 places: after each `moveend`, and
  every 100 ms during a flight, any two discs or pins whose centres are closer than `(r1 + r2) + 6` px merge into one
  disc with the summed count and the larger one's label; a merged disc zooms by 1.5 around itself on click, or fans
  out (as the co-located rule below) when the zoom is already at the level's maximum. L2 drew five Italian state
  discs within 25 px of each other (review M6). A disc that would cover its own country's basemap label is offset by
  `discSize / 2 + 8` px towards the nearest sea.
- **[changed]** One node per admin-1 region in the data tree: South Tyrol, Trentino and Trentino-Alto Adige must not
  be three siblings (section 11, data audit).
- **[changed]** Place dots at state level: 18 px `--map-stop` with a 1.5 px `--map-halo` (L2's 14 px vanished on relief).
- State: a disc per district with 2 or more places; single places as dots. If a state has more than 30 places below
  district level, cluster dots with a grid of 48 px at the current zoom (recomputed on `zoomend`, like supercluster but
  on the 50 to 300 points we have, no library) into discs with counts; clicking a cluster zooms by 2 around it.
- Co-located pins (same 11 m key) merge into one disc with a count and fan out at 44 px radius on click (L2). The fan
  closes on any other click.
- Pins are DOM markers (`Marker`), so they stay crisp, focusable and portaled from React; cap at 400 visible markers
  and cluster beyond.

### 6.6 Atmosphere, sky, night

**[changed]** L2 set only `atmosphere-blend` and left MapLibre's default sky colours, which vanish on a light page,
so the disc was a hard cut-out (review M3). Final values:

| Setting | Light (Relief, Light) | Dark |
|---|---|---|
| `sky-color` | `#CFE0EC` | `#1A2E44` |
| `horizon-color` | `#F2F6F9` | `#2A4A66` |
| `fog-color` | `#F2F6F9` | `#0F1A26` |
| `atmosphere-blend` | 1 at zoom 0, 0.6 at 2.5, 0 at 5 | same |
| `sky-horizon-blend` / `horizon-fog-blend` | 0.8 / 0.6 | 0.8 / 0.7 |
| CSS halo `.globe-halo` behind the canvas: radial gradient from the disc radius to radius + 6% of the diameter | `--globe-halo` `#CFE0EC` to transparent | `#2A4A66` to transparent |
| Halo opacity | 1 at zoom 0 to 0 at 4, from `zoom` events throttled to one rAF | same |
| Limb `--globe-edge`, drawn by the halo element | 1 px `--line-2` (3.18:1 on `--well`) | 1 px `rgba(255,255,255,.08)` |
| Stage | `--well` | `--well` |

- The halo element is positioned from `worldFrame()` (centre of the free area, the computed diameter) and
  re-measured on resize and on panel toggle; it is also the first-paint placeholder (8.3).
- No star field (noise behind the world competes with pins). No day-night terminator: it would suggest the time at
  a destination, which this page does not know.
- Dark style: ocean `--globe-ocean` `#0F1A26`, land `--map-land` `#263241`, wood `#2B3845`, hillshade highlight
  `--map-high` `#34434F`, rivers `--map-water` `#2E5A6B`. Light: ocean `#A9C4D3`, land `#EEE9DF`, wood `#E4E0D4`,
  rivers `#7FA6B9`, borders `#8E99A6` at 0.8 px (1.2 from zoom 5). Hillshade exaggeration 0 below zoom 2, 0.15 at 4,
  0.45 at 7, 0.55 at 9, `hillshade-illumination-anchor: map`.

## 7. Search and discovery

### 7.1 Search everything clickable

Sources, in result order: our places and trips (LD cards, prefix then contains); countries; states and provinces;
cities (rank order); seas and oceans; landforms (peaks, ranges, lakes, parks when the gazetteer gains them, 11). 12
results, grouped with a `--t-cap` group label when more than one group appears. Empty state: "Nothing called 'xyz'. Try
a country, a town or one of our 108 places." Each result row: flag or kind glyph, name, kind label, where.

Picking a result performs the same action as clicking the thing on the globe (4.1 rule 4), so a city result drills to
its district and flies, a sea result flies and opens the feature card with `?f=`. Recent picks (5) show on focus with
an empty field, stored in `localStorage`.

### 7.2 Filters

A "Showing" chip row at the top of the panel (and in the phone sheet's head): **All · Trips · Places** and, when
Places is on, a kind menu (Trail, Lake, Viewpoint, Sight, Stay, Town, Activity, Food from `data/vocab`). Filters change
which pins and rows are drawn at every level and the discs' counts; they live in the URL as `?show=trips` or
`?kind=trail,lake` (list-state order rule, patterns 1.2) so a filtered globe is shareable. Default: All.

### 7.3 Random and inspire (later)

A dice button in the control card flies to a random published trip or a random place with a photo, opens its card,
and shows "Another" in the card. Reduced motion: jumps. Also on a feature card: "Places like this" (same kind within
300 km) when at least two exist.

## 8. Performance and data

### 8.1 Budgets

Measured in the CI shot job with network throttling "Fast 3G" and a 4x CPU slowdown for the phone row (Playwright's
CDP `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate`).

| Measure | Desktop 1440 | Phone 390 |
|---|---|---|
| First paint of the page shell (header, search, panel skeleton) | under 1.0 s | under 1.5 s |
| Globe visible with country shapes (tiles may still be loading) | under 2.5 s | under 4.0 s |
| Time to interactive (first hover or tap answered) | under 3.0 s | under 5.0 s |
| JS before the globe starts | 250 KB gz including MapLibre | same |
| Data before the globe starts | 120 KB gz (110m world 60 KB, facts 25 KB, pins and cards 35 KB) | same |
| Spin frame rate | 60 fps on a 2021 laptop with an integrated GPU | 40 fps or more on a 2022 mid-range Android (checked by hand twice a release, not in CI) |
| Long task after the first `idle` (drilling into Italy, Texas, Ontario; wheel into a new country; theme switch) **[changed]** | none over 50 ms (L2: 357 to 398 ms, review M12) | none over 50 ms |
| Long task before the first `idle` **[changed]** | none over 120 ms (L2: six of 93 to 169 ms) | none over 150 ms |
| Frame time p50 / p95 during spin, drag and flights **[changed]** | 16.7 / 20 ms on a 2021 laptop with an integrated GPU (L2 measures 16.7 / 16.8 on the Arc) | 16.7 / 25 on a 2022 mid-range Android |
| Memory after 10 minutes of browsing | under 400 MB | under 250 MB |

### 8.2 Loading order

1. HTML with the shell, the panel's first list (continents and countries) server-rendered so the page is useful before
   any script runs.
2. MapLibre and the globe code as one chunk; `countries-110m.json` (new, 60 KB gz) for the world's hit shapes and
   outlines; `countries.json` facts; pins and cards inline in the page.
3. After `style.load`: `countries-50m.json` replaces 110m when the zoom passes 3 or on the first drill-down (one
   `setData`; the user never sees the swap at world scale).
4. Admin files on demand per country (`*-ADM1.json` on country open, `*-ADM2.json` on state open), cached with
   `Cache-Control: immutable` and a content hash in the file name; the four biggest ADM2 files (USA 278 KB gz, CAN,
   IND, BRA) are split per state at build time so Texas does not download Alaska.
5. Gazetteer on search focus (275 KB gz); split into a 40 KB "top" file (countries, states, cities rank ≤ 2, seas,
   major ranges) loaded first and the rest after.
6. Wikidata facts only when a card opens (4.3).

Serve everything from `web/public/globe` with Brotli (Cloudflare Pages does this) and long cache headers; MapLibre's
worker from the same origin (L2 does this).

### 8.3 Rendering

- **[changed] First paint.** The `.globe-halo` element doubles as the placeholder: it draws the `--globe-ocean`
  disc with the halo and limb within 300 ms of navigation, before MapLibre loads. The canvas starts at `opacity: 0`
  and fades in over 600 ms `--e-out` on the first `idle` event after `style.load`; pins mount after that same `idle`
  and fade in over 200 ms, staggered 15 ms by latitude. Nothing else draws on the globe before that frame (L2 showed
  a land-coloured disc with black pins for one to three seconds, review M2). Reduced motion: 120 ms fades.
- **[changed] Workers.** Admin files are fetched, parsed, tallied (point-in-polygon of our places) and bbox'd in a
  Web Worker (`geometry.ts` is pure and moves as is); the main thread receives a ready FeatureCollection with a `dim`
  and `n` property per feature and calls `setData(fc, {waitForCompletion: true})` once; focus is applied after it
  resolves. Hover and selection use `setFeatureState` for the one hovered and the one selected id only; dim is a
  data-driven paint on the `dim` property, never a loop over every feature (L2's `applyFocus` looped three sources
  on every change).
- One `GeoJSONSource` per level with `promoteId`-style numeric ids (as today); `setFeatureState` for hover and
  selection; never rebuild a layer to change a colour.
- Pins as DOM markers capped at 400; above that, cluster (6.5).
- Spin with `jumpTo` from one rAF loop; pause when `document.hidden`; stop the loop entirely when spin is off and no
  animation runs.
- Terrain off by default on weak phones (5.4); hillshade exaggeration curve stays as the live globe's.
- Hit testing: `queryRenderedFeatures` with a 5 px box per move, throttled to one per animation frame.

### 8.4 Offline

The PWA (tech.md) caches the globe route shell, MapLibre, the 110m and 50m world, facts, pins and cards, and every
admin file the visitor has opened. Without a connection the globe draws its shapes on the `--well` stage with the
message "Map tiles need a connection; countries, places and trips still work" in the status pill; search works for
countries, states and our places (the gazetteer is cached after its first load). Tiles are never cached by us
(OpenFreeMap's terms: 3,000 tiles or 50 MB per download; and no PMTiles pack for the whole world is realistic).

## 9. Acceptance checks

Run with Playwright, Chromium at `~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, flags `--use-gl=angle
--use-angle=swiftshader --enable-unsafe-swiftshader`, viewports 1440 x 900, 1024 x 768, 390 x 844, 844 x 390, 2x.
Two jobs: the existing tile-blocked suite for logic, and one **shot job with tiles allowed** (OpenFreeMap and Mapterhorn
reachable; mark it `allow-network`) that saves the shots below for the reviewer. Keep each probe under 60 s; take frame
sequences with `page.screenshot` every 150 ms for motion checks rather than video.

### 9.1 Checks

| # | Check | How |
|---|---|---|
| 1 | The map has size: `.maplibregl-canvas` height is at least 400 px at every viewport, and every `.globe-pin` centre lies inside `.globe-root` | geometry via `getBoundingClientRect` |
| 2 | Framing: at world, the disc diameter is 0.86 x min(free width, free height) within 5%; the disc centre is within 8 px of the free area's centre; with the panel collapsed it re-frames within 500 ms | read `map.getZoom()` and compute; two shots |
| 3 | No overlaps: pairwise `getBoundingClientRect` intersection of crumb, search, status, control card, zoom, hint, panel or sheet, card, feature card, attribution is empty at every viewport and level (world, Italy, South Tyrol, place card, feature card) | assertion, shots |
| 4 | Hit priority: at `?c=11.9,46.55,9.2` hovering the Rio Gardena shows a river tooltip and clicking opens a river feature card with `?f=`; at `?c=-35,22,1.2` clicking Brazil drills to `/globe/br/` | `queryRenderedFeatures` to find a river pixel (as the review probe did), hover, click, assert URL and card text |
| 5 | Touch: a tap on Italy at world level drills to `/globe/it/`; a 600 ms press on the Dolomites opens What is here with a country, a state and at least one feature row | touchscreen tap and `touchscreen.tap` with a held pointer via CDP `Input.dispatchTouchEvent` |
| 6 | Tokens: at rest no element on the canvas has `--accent` as background or border (`getComputedStyle` over `.globe-pin`, highlight layer filters are `NONE`); after hover exactly one pin or shape does | DOM plus `map.getFilter` and `map.getFeatureState` |
| 7 | Styles differ: the mean RGB of a 200 x 200 crop over the Alps at zoom 6 differs between Relief and Light by at least 12 per channel, and Dark's land is within 10 of `#1A2330` | shots and pixel read |
| 8 | Motion: 10 frames at 150 ms during a fly-in to Italy show monotonically increasing zoom then a pitch that reaches 45 within 1.8 s; reduced motion (`emulateMedia`) lands in one frame and never pitches | frame sequence, `map.getZoom`/`getPitch` per frame |
| 9 | Spin: longitude changes by 4 deg/s within 10% over 3 s at world; stops within one frame of `mouse.down`; after a drag ends it moves again within 2 to 3 s; after a hover leaves the canvas, within 20 to 21 s **[changed]** | read `map.getCenter().lng` at timestamps |
| 9b **[new]** | Drag at world: `mouse.down` over ocean, 8 moves of 25 px at 16 ms, `mouse.up` | URL still `/globe/`; centre longitude changed by 20 degrees or more; the centre moves a further 0.5 degree or more within 300 ms (inertia); `onShape` not called |
| 9c **[new]** | Count `HandlerManager.stop` (or `map.stop`) calls between `mousedown` and `mouseup` during 9b | at most 1 |
| 9d **[new]** | Hover over a country at world: the spin slows to 1 deg/s or less within 400 ms and does not reach 0 | longitude samples |
| 10 | URLs: `/globe/it/south-tyrol/?c=11.5,46.6,8,45,20` restores zoom 8, pitch 45, bearing 20; `/globe/place/lago-di-braies/` opens the card; `?f=sea:Q5...` opens the feature card; Back after a drill-down returns to the previous level and camera | navigate, assert |
| 11 | Keyboard: Tab from the search reaches the canvas; arrows pan; Esc steps up; `P` and arrows move between pins (should); focus ring visible in a shot | keyboard and shots |
| 12 | Phone sheet: peek 120 px, half 50%, full under the header; card sheet replaces list sheet and the list returns at the same snap on close; landscape uses the side peek | geometry and shots |
| 13 | Budgets (8.1) under throttling: shell under 1.0/1.5 s, globe under 2.5/4.0 s, data before start under 120 KB gz, no long task over 200 ms while drilling into Italy and Texas | CDP Performance and `PerformanceObserver('longtask')` |
| 14 | Accessibility: axe has no violations on world, country, card and feature card; tooltip `role="status"` updates at most once per 800 ms during a 2 s sweep | axe, count mutations |
| 15 | Attribution visible and one line at every viewport; contains OpenFreeMap, OpenStreetMap, Mapterhorn (or the Terrarium text when fallen back) | text and geometry |
| 16 **[new]** | First paint: `.globe-halo` disc of the computed diameter visible within 300 ms; canvas opacity 0 to 1 over 600 ms from the first `idle`; no `.globe-pin` visible before that frame | frame sequence at 100 ms |
| 17 **[new]** | Atmosphere: the mean colour of a 40 px ring just outside the disc is within 12 per channel of `--globe-halo` blended 50% on `--well` at zoom 0 and equals `--well` at zoom 4 | pixel read |
| 18 **[new]** | No green: no pixel in a 200 x 200 crop over the Alps at zoom 6 has hue 75 to 165 with saturation over 12%, in any style | pixel read |
| 19 **[new]** | Labels: at zoom 1.5 no rendered label contains non-Latin script or is in capitals; at zoom 5 over Germany no Land name is in capitals | `queryRenderedFeatures` on symbol layers, evaluate `text-field` |
| 20 **[new]** | Discs: no two `.globe-pin` discs overlap by more than 6 px at any level; the Italy disc does not suppress the "Italy" basemap label | geometry, `queryRenderedFeatures` |
| 21 **[new]** | Fly composition: after Italy the bbox centre is 35% to 50% of the free height from the top and pitch is 20 within 1; after South Tyrol pitch 45 and 30% to 45%; one `flyTo` per step (no second `easeTo`) | camera, `project()`, call count |
| 22 **[new]** | Reset view exists at every level and size, never overlapped, returns to `/globe/` with the world frame zoom within 0.05; `Home` does the same | geometry, URL |
| 23 **[new]** | Cards: a place with no photo shows no element taller than 96 px with a background and no children; "Draft" and household status never appear; the phone sheet has exactly one close button; the tooltip is hidden while a card is open | DOM |
| 24 **[new]** | Feature card: after selecting a river at `?c=11.9,46.55,9.2`, at least 200 px of the `hl-river` line is rendered outside the card's rect | `queryRenderedFeatures` against the card rect |
| 25 **[new]** | Long tasks: none over 50 ms from the first `idle` through drilling into Italy, Texas and Ontario and a theme switch | `PerformanceObserver('longtask')` |
| 26 **[new]** | Phone: attribution is one line; pairwise intersection of crumb, icon rail, attribution, sheet and card is empty at 390 and 844 x 390 | geometry |
| 27 **[new]** | What is here: a 500 ms press on land at zoom 9 opens the sheet with a country, a state and a feature row and does not change the URL | CDP touch |

Motion checks (8, 9, 9b to 9d, 21) run on a GPU (the Arc here: `--use-gl=angle --use-angle=gl
--ignore-gpu-blocklist`); SwiftShader numbers are not accepted for them.

### 9.2 Reviewer shots to produce

`world` (spin paused), `world-panel-collapsed`, `world-immersive`, `it`, `it-south-tyrol`, `place-lago-di-braies`,
`trip-dolomites-2027`, `feature-river`, `feature-sea`, `feature-peak`, `what-is-here`, `controls-terrain-on`, in light
and dark, at 1440, 1024, 390 and 844 x 390 where the layout differs. Named `<state>-<theme>-<width>.jpg`, quality 82.

## 10. Foundation edits this spec needs

| File | Change |
|---|---|
| tokens.md 5, tokens.json **[changed]** | Hover fill is `--accent` at 35% with a 1.5 px cased line, not `--accent-soft` at 35% (1.01:1, invisible). Replace the earlier `--map-park` green with `--map-wood` (`#E4E0D4` light, `#2B3845` dark: a warmer step of land, same hue; no green on the map at all). Add `--globe-ocean` (`#A9C4D3` / `#0F1A26`), `--globe-halo` (`#CFE0EC` / `#2A4A66`), `--globe-edge` (`--line-2` / `rgba(255,255,255,.08)`), `--globe-dim` (`#F3F1EC` 70% / `#0B1119` 60%), `--map-casing` (`--ink` / `#0B1119`, 0.5 to 1 px under amber lines). Change the dark column: `--map-land` `#263241`, `--map-high` `#34434F`, `--map-water` `#2E5A6B`; light `--map-land` `#EEE9DF`, `--map-water` `#7FA6B9`, `--map-border` `#8E99A6`. Dark `--globe-pin` is `--surface` with `--ink` counts. Ratios: ink disc 8.81:1 on light ocean, 13.27:1 on light land; surface disc 14.77:1 / 10.94:1 dark; labels 6.63:1 light ocean, 9.99:1 light land, 11.48:1 / 8.51:1 dark; accent 6.3:1 on dark land. |
| components.md 7.2 | Add What is here, immersive mode, the Showing filter row, `?f=`, the landscape layout, the zoom-by-class fly table, the keyboard table. Replace "hovered country fills `--accent-soft` at 35%" with the 6.3 rule. |
| patterns.md 1.2 | Add `?f=<class>:<id>` and `?show=`/`?kind=` to the globe rows; `?c=` gains pitch and bearing. |
| patterns.md 6 | Globe row: add inertia (deceleration 2500, rest within 600 ms), tilt overlapping the last 15% of the zoom, terrain ramp over the last 400 ms, resume 2 s after stepping out to world. |
| changes-from-preview.md | New row: globe hover fill corrected for contrast; `?f=` added. |

## 11. Data we do not have yet

| Need | Source | Licence | Size | Build step |
|---|---|---|---|---|
| World at 110m for first paint | Natural Earth 1:110m admin-0 countries (`ne_110m_admin_0_countries`) | public domain | about 60 KB gz as TopoJSON | `tools/globe_data.py` (exists for the 50m file) gains a 110m output with the same ids (`ccn3`) |
| Mainland bbox for wide countries | computed from the 50m shapes: the largest polygon's bbox, overridden by a small hand list (US mainland, France metropole, Netherlands, Norway without Svalbard) | ours | in `countries.json` | same script |
| Lakes as polygons below zoom 8 | Natural Earth 1:10m lakes (`ne_10m_lakes`) with `name` and `wikidataid` | public domain | about 400 KB gz; ship the 1,000 largest by area as 150 KB | new `lakes-10m.json`; hit layer `lake-fill` |
| Ranges and plateaus as outlines | Natural Earth 1:10m geography regions polygons (`ne_10m_geography_regions_polys`, ranges, plateaus, deserts, peninsulas) | public domain | about 300 KB gz | later; `regions-10m.json`; also feeds the gazetteer |
| Peaks between zoom 7 and 11 | gazetteer `physical` rows of class peak already exist (from NE geography regions points); add OSM `natural=peak` with `prominence` 300 m or more for the countries we have places in, via the Overpass API at build time | NE public domain; OSM ODbL (attribution already shown) | about 80 KB gz for 8 countries | gazetteer build |
| Parks in search | OSM `boundary=national_park` and `protected_area` with `protect_class` 1 to 6 for our countries, centroid and Wikidata id | ODbL | about 60 KB gz | gazetteer build; class `park` |
| Facts for feature cards | Wikidata `wbgetentities` at run time for QIDs found in tile properties, gazetteer rows or NE `wikidataid`; properties P1082 population, P2046 area, P2044 elevation, P2660 prominence, P4511 max depth, P2043 length, P403 outflow, P4552 range, P610 highest point, P814 IUCN, `enwiki` sitelink | CC0 | per card | client fetch with a 30-day `localStorage` cache; `Accept: application/json`, `User-Agent` header set as Wikidata asks |
| Elevation at a point | Mapterhorn DEM already loaded: `map.queryTerrainElevation` when terrain is on; else one Terrarium tile fetch and decode | Mapterhorn (terms unstated, review map-stack risk), AWS Terrarium (Mapzen, open) | none | client |
| Country facts | `countries.json` (world-countries, Wikidata) exists | world-countries (ODC-By? the repo says ODbL-compatible; verify and credit), Wikidata CC0 | 80 KB | keep; add `mainland_bbox`, `wiki` |
| Trip base lines | `getTrip()` bases with coordinates (LD) | ours | inline | L2b draws the dashed line between bases |
| Canada ADM2 **[new]** (F4) | Statistics Canada census divisions (293), not geoBoundaries' 76 economic regions; names in full | Open Government Licence Canada | about 350 KB gz, split per province | `tools/globe_data.py` gains a per-country ADM2 override; Whitby lands in Durham |
| ADM2 audit **[new]** (F4) | every country we ship: does the level mean districts, are names truncated (`*`), is the simplification coarser than the 50m coastline (compare each shoreline vertex to the 50m coast, flag over 0.05 degrees) | n/a | report in `docs/v2/research/globe-adm2-audit.md` | before L2b merges; a failing country falls back to ADM1 only |
| Admin-1 tree **[new]** | one node per admin-1 region: merge South Tyrol, Trentino and Trentino-Alto Adige under Trentino-Alto Adige with the two provinces as children | ours | inline | `data/locations` area chain fix plus a build check that no two sibling nodes resolve to the same NE admin-1 shape |
| City polygons **[new]** (F3) | OSM `boundary=administrative` `admin_level=8` for every city or town that holds one of our places or is a trip base, via Overpass at build time, simplified to 0.0005 degrees | ODbL | about 60 KB gz for the current data | `cities-adm8.json`; hit layer `city-fill` (4.2) |
| Card payload **[new]** (F6) | `summary` (120 chars), `facts` (best months, kids, elevation or length), `usedIn` (trip slug, title, day), `image` with source and credit after the fallback chain (place photo, trip gallery, Wikidata P18 or Commons) | ours; Wikidata CC0; Commons per file | inline in the page data | `buildGlobeData()`; the P18 lookup runs at build time, never in the browser |
| Trail lines for place pins | lanes/trails.md stores OSM trail geometry per place when researched | ODbL | per place | when present, the place card's Fly here fits the line |

Attribution line gains "Natural Earth" and, when a card loaded facts, "Wikidata". geoBoundaries CC BY 4.0 stays
credited as today.

## 12. Out of scope here

Signed-in trip pins in identity rings and the household's trips (planner phase); Google 3D tiles (costed and rejected
in map-stack 2026-10-18); a day-night terminator; street-level detail beyond what OpenFreeMap serves; routing on the
globe (the trip page has it).
