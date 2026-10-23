# Design review: TRP2a, the Google trip route map (23 Oct 2026)

Reviewer: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Review only: no app code changed, nothing built or run (the full e2e was running on this machine).

**Verdict: ship after fixes.** The structure is right: the column fits the window, the key sits above the map with the exact wording, the numbers on the rows match the pins, Google's attribution is never covered, the loading, failure and Save-Data states are in place, and nothing we draw is green. Five fixes must land before M1. The worst is the estimate line: it draws 8 px beads, not a 2.5 px dash, so it is the loudest thing on the map and does not match its own key. Counts: **5 must, 7 should, 8 later.**

## 0. What this is based on

- **Screenshots**, read at full size and in crops (all in `/Users/nks/workspace/travel-wt/v2-TRP2a/web/test-results/shots/TRP2a/`), at 2x on the Metal GPU flags with dark set through the header control:
  - `canadian-d6-*`, `canadian-d8-*` and `dolomites-d4-*` at 1440 x 900, 1024 x 768 and 390 x 844, light and dark (18 shots; I read 14 in full, plus crops of the day 8 map in both themes)
  - `place-before.png` and `place-after.png`, which are byte-identical (same md5)
- **Code**: `git diff ae9981b...HEAD -- web core` on `main` (merge 97d17b0). File and line references below are to that tree.
- **Authority**: [google-map-note.md](google-map-note.md) (TRP2-N), [TRP2.md](../../build/public-site/briefs/TRP2.md), [principles.md](../foundation/principles.md), tokens from `web/app/themes.css`.

These shots are **not in the set**: Rockies day 9, Dolomites day 3 (day 4 was shot instead), a hover, the "not on the map" list open, the phone key open, All days, and Lake Louise at zoom 14 (the POI check). Section 1 marks the checklist items they leave open.

## 1. The 33-item checklist, re-ticked

Status key: **pass** (seen, or proven in code); **pass (tests)** (covered by a unit or e2e test only, with no shot); **partial**; **fail**.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Family is `google-js` only with key and Map ID; override; registration uses the resolved family | pass | `web/lib/map/family.ts` `tripPageFamily()`; `TripRouteMap.tsx` `registerPageFamily('/trips/[slug]', tripPageFamily())`; `TripPlan.tsx` `MapFamilyProvider family={tripPageFamily()}`; `family.test.ts:31,38` |
| 2 | Never `DEMO_MAP_ID` | pass | `tripPageFamily` requires `env.mapId`; `GoogleTripMap.tsx` passes `mapId` only from the env |
| 3 | `colorScheme`, `disableDefaultUI`, `clickableIcons: false`, `cooperative` | pass | `GoogleTripMap.tsx` map options. All shots show only our + / - / Fit and no Google zoom pair. Dark shots render Google's dark scheme |
| 4 | Theme toggle re-creates the map and keeps the camera | pass (tests) | `key={dark ? 'dark' : 'light'}` on the box, `cam.current` kept on `idle`; e2e `a theme change makes a new map`. The dark shots were taken after the toggle and show a dark map |
| 5 | Loads on view (desktop), on sheet open (phone/tablet); Save-Data facade | pass (tests) | `TripRouteMap.tsx` IntersectionObserver `rootMargin: '200px'`, `armed`/`mount`; e2e phone, tablet and Save-Data cases |
| 6 | One instance; a day change redraws overlays only; hand-back reports loads per view | partial | Code is right (`gen` effect; e2e `a day change redraws overlays on the same map`). The load count per page view is not in the hand-back I was given. It is 1, plus 1 per theme toggle |
| 7 | Loading and Failed wording, no layout shift | pass | `role="status"` "Loading the map"; `role="alert"` with the exact 10 sentence and "Try again"; the box is at its final size |
| 8 | No Advanced Markers gives "Our pins cannot be drawn on this map" | pass (tests) | `getMapCapabilities().isAdvancedMarkersAvailable === false` on the first idle; e2e line 269 |
| 9 | Google logo and attribution fully visible at 1440, 1024 and 390 | pass | Every one of the 18 shots shows "Google" bottom left and "Map Data ©2026 Google · Terms · Report a map error" bottom right, uncovered |
| 10 | Column fitted to the viewport; key above the map; old note gone | pass | `canadian-d8-1440-light`: the map runs from y 324 to 839 CSS px, Directions sits at about y 866, all inside 900. `tl-mapcol-note` is removed |
| 11 | Key shows only what is drawn, exact labels and sentence | **fail** (one swatch) | Labels and sentence are exact (`routeSpec.ts` `KEY_LABEL`, `KEY_NO_ROUTE`; every desktop shot). But on Dolomites day 4 the only base drawn is the picked base in **amber**, while the key swatch is an **ink** square (`dolomites-d4-1440-light`, `-dark`). See MUST-4 |
| 12 | Numbered pins follow timeline order; roads and drives are never pins | pass (departure accepted) | `canadian-d8-1440-*`: pins 1 Athabasca Falls and 2 Sunwapta Falls run north to south, with no Icefields Parkway pin. There is no pin 3 because Toe of the Athabasca Glacier has no point (data gap, section 4) |
| 13 | Label row counts match the pins (Rockies 8 and 9, Dolomites 3) | partial | Day 8 reads "2 stops on the map · 1 not on the map" over 2 pins; day 6 reads "3 stops" over 3; Dolomites day 4 reads "2 stops" over 2. Rockies 9 and Dolomites 3 were not shot. Unit test `route-spec.test.ts:99` |
| 14 | A 20 px badge on each pinned row, same number; a shared spot gets one number | pass | Badges 1 and 2 on the day 8 rows and 1 and 2 on Dolomites day 4, matching the pins. Shared spot: unit-tested in `mapPins.ts` `byCell` |
| 15 | Pin styles per 4.2 in light and dark; overlapping pins become a "2·3" pill | partial | Discs are ink with a surface edge and a mono numeral in both themes (`canadian-d8-1440-*`). The pill is unit-tested only (`camera.test.ts:11`); no shot shows one |
| 16 | Markers hide the Google labels they cover; stop labels only on maps 560 px or wider | **fail** | Stop labels are absent at 1024 and 390, as ruled. But our labels sit outside the marker's box, so Google's labels print through them: "Versciaco" under "Funbob, Monte Baranci" (`dolomites-d4-1440-light`, `-dark`), "Jasper" and the park name under "Jasper SkyTram" (`canadian-d6-1440-dark`), and a road shield under "Sunwapta Falls" (`canadian-d8-1440-light`). The base label also draws on narrow maps and runs under Fit. See MUST-2 and MUST-3 |
| 17 | "N not on the map" is a button with an outside list; entries say "· not on the map" | partial | The button shows on day 8 at 1440, 1024 and 390. The list open and the row meta are not in any shot (the row is below the fold). e2e line 97 |
| 18 | Estimates dashed ink 2.5 px with halo; no other-day lines in Day view; dots at 50% | **fail** | Colour and visibility rules hold: ink, not amber, not solid, no other-day lines; the 50% dots are visible on `canadian-d6-1440-light`. **The weight is wrong**: `legParts` sets `strokeWeight: 8 + extra` on the dash symbol, so every dash is an 8 px round bead (10 px with halo) at a 14 px pitch. See MUST-1 |
| 19 | A fixture leg with geometry draws solid amber with casing; key shows "Road route" | pass (tests), deferred | `leg-parts.test.ts` "a routed picked day..."; `route-spec.test.ts:34,81`. No leg has geometry; re-check in TRP2b |
| 20 | Morning base, then stops, then night base; one line per leg | pass | `dolomites-d4-1440-*`: San Candido to 1, to 2, back to San Candido, each leg its own polyline (`dayLegs`). The Rockies have no base points |
| 21 | Day fit with 6.2 padding and maxZoom 13; All days, Fit, Follow; no queued fits | partial | Padding and cap are in `routeSpec.ts` `FIT_PADDING`, `DAY_MAX_ZOOM` and `fitSeq`. But `canadian-d6-1440-light` frames day 6 about one zoom level looser than `-dark` (the three pins fill about 40% of the map width). See SHOULD-5 |
| 22 | A day with no placed stop frames the base or shows the whole trip, with 6.3 wording | pass (tests) | `labelOf`; `route-spec.test.ts:102` |
| 23 | Hover both ways, with no overlay rebuild | pass (tests) | `spec = {...base, hover}` keeps `pins` and `lines` identity; the separate ring effect; e2e line 110 asserts no marker re-creation |
| 24 | A pin click scrolls, flashes 1.5 s and focuses without expanding; lands above the sheet on the phone | pass (tests) | `revealEntry.ts`; e2e line 110 |
| 25 | The picked day's pins are tab stops in number order; Enter equals click; bases and dots are not tab stops | pass (tests) | `gmpClickable` only on `stop-numbered`; e2e line 137 |
| 26 | Badge rings the pin and pans only if off view; phone opens the sheet first | pass (tests) | `flyTo` checks `getBounds().contains`; `link.show` opens the sheet; `mapBus.takePending` |
| 27 | Tablet uses the sheet with the Map button; list bottom padding; Esc and Close return focus; no trap | pass (tests) | `timeline.css` `max-width: 1023px` sheet, `[data-sheet-open]` padding; `openSheet`/`closeSheet` keep the opener; e2e lines 219, 247 |
| 28 | Reduced motion | pass (tests) | `moveCamera` path, the CSS fade, `revealEntry` instant; e2e line 206 |
| 29 | Directions from our coordinates, up to 9 waypoints; All days says "Pick a day for directions" | pass (tests) | `directions.ts`; `route-spec.test.ts:112-135`; the link shows in every Day shot |
| 30 | Place pages unchanged | pass (with caveat) | `GoogleJsMap.tsx` is not in the diff; `MapSurface` routes to `GoogleTripMap` only when `spec.load === 'visible'`. The pair is byte-identical, but it is MapLibre with tiles blocked, light only, at 1x, so it proves the MapLibre path only |
| 31 | Trip page start JS not larger than `main` | builder-reported | `TripRouteMap` is a `next/dynamic` import; `mapPins.ts` stays in start JS by design. Not re-measured (machine kept quiet) |
| 32 | No new colour literal; nothing we draw is green | pass | `map.css` uses tokens only; `rgbaParts` only splits a token's alpha. Ours: ink pins, ink line, amber picked base and ring. The green in the shots is all Google's basemap (section 6) |
| 33 | The full screenshot set, read in tiles | partial | 18 shots exist; day 9, Dolomites day 3, hover, the list open, the phone key open, All days and zoom 14 are missing. See MUST-5 |

Tally: 21 pass (11 of them by tests only), 1 builder-reported, 7 partial, 4 fail (11, 16, 18 and 33's gaps, which MUST-1 to MUST-5 close).

## 2. Judgement by area

### 2.1 Hierarchy (P3: a glance, then a few clicks)

The intended order is: picked pins, then the picked base, then the line, then other-day dots, then the basemap. Today the line is first. At 1440 the bead chain from Athabasca Falls to Sunwapta Falls is the heaviest mark on the map, and on Dolomites day 4 the out-and-back legs (San Candido to 1, 1 to 2) lie almost on top of each other as a double row of beads, which reads as a caterpillar, not a route. The pins themselves are crisp and well sized in both themes. Fixing the line weight (MUST-1) restores the order; nothing else in the hierarchy needs to change.

### 2.2 Pin legibility

- **Light**: the ink disc with its white edge holds on Google's forest (12.89:1), snow (16.06:1) and water (10.28:1).
- **Dark**: the `#E7ECF1` disc with its `#16202C` numeral reads at 13.83:1 and stands out on the teal forest (8.24:1).
- **At 1024 and 390** only numbers are drawn, as ruled. Rockies day 6 pins 1 and 2 touch at 390 (`canadian-d6-390-dark`: centres about 24 CSS px apart, so just over the 20 px pill threshold). They are legible, but their 36 px coarse-pointer targets overlap (LATER-2).
- **Stop labels** at 1440 are legible on the halo. They become garbled only where a Google label sits under them (MUST-2), or in dark where a white bead runs through the label ("Croda del Becco" on `dolomites-d4-1440-dark`, which MUST-1 cures).

### 2.3 Line style (T5)

Colour and pattern logic are right:
- ink at rest, never amber, never solid
- other days' lines hidden in Day view
- the hover leg turns amber over the casing but stays dashed (`legParts` `hot`)

The geometry is wrong (MUST-1). The key swatch is a true 2.5 px CSS dash (`trips.css` `.key-swatch[data-key='estimate']`), so the key and the map show two different pictures of the same thing.

### 2.4 Key wording and honesty with every leg an estimate

This is the strongest part of the lane. "Straight line, not a route" plus "Road routes are not drawn yet. Lines join each day's stops in order; use Directions for the drive." turns an all-dashed map into a stated decision, and the Directions link sits right under the map as the thing to do. The timeline keeps "≈ Drive 30 min", so the map makes no time claim. Two honesty gaps remain:
- the base swatch (MUST-4)
- on the Rockies, "Directions for Day 8" opens only Athabasca Falls to Sunwapta Falls, a 25-minute leg, because there are no base points, while the family's day is Jasper to Lake Louise (SHOULD-3)

### 2.5 Map and timeline linking (P5)

The numbers on the rows are the right link. They use the same picture as the pins, and they are buttons with the name "Show stop N on the map", with 32 px and 44 px hit areas through `::before`. Hover goes through a plain event bus with no React re-render, and pin clicks scroll and focus without expanding (change 3). Inert badges on other days use `--ink-2` on `--surface-2` with a `--line-2` edge, which is calm and still readable. I could not see the hover ring or the row fill in any shot (MUST-5), so that is judged on code and e2e alone.

### 2.6 The mobile sheet

The frame is right:
- 416 px tall, non-modal, with the strip and day visible above it
- Close is 44 px, and Esc and focus return work
- the bottom padding lets the last row clear the sheet

Two costs at 390:
- the map gets only about 200 of the 416 px, because "Map key" takes its own 44 px row under the one-line key (SHOULD-1)
- the label row's ellipsis cuts away the count, leaving "Day 8 · Lake Louise village … · 1 not on the map" (`canadian-d8-390-light`), so the reader sees what is missing but not what is shown (SHOULD-2)

### 2.7 Accessibility

- The wrapper is `role="region"` with "Route map, Day 8" (no `role="application"`).
- Pins are tab stops for the picked day only (P1: bounded by the day's count), and their `title` is the accessible name ("1 · Athabasca Falls").
- Badges are named buttons, the label row takes focus when the sheet opens, and the failure state is `role="alert"`.
- **The map is never the only way to the information.** Every stop is a row, unplaced stops are listed by name, the Save-Data facade lists the stops as text, and the failure text says so.

One gap: `.tl-mapcol-label:focus { outline: none }` means the programmatic focus on sheet open shows no ring. That is acceptable for a non-interactive label, because the ring appears on keyboard focus-visible.

### 2.8 Consistency with the place-page map and the rest of the trip page

The place-page Google path is untouched (`GoogleJsMap.tsx` is not in the diff), and the MapLibre place map is byte-identical. The trip map's controls reuse `MapChrome` `Controls`, and on the trip map only they are sized 34 px fine and 44 px coarse. The amber Day segment, the badges and the plan bar agree with the timeline's own vocabulary. The `place-after.png` legend overlapping route labels predates this lane (not a TRP2a finding).

### 2.9 No-green on our overlays

Pass. Every mark we draw comes from `--ink`, `--surface`, `--accent`, `--accent-ink`, `--map-casing`, `--map-halo` or `--map-shade`. No `--ok`, `--warn` or `--id-*` is used. The green on screen is Google's:
- forest and park fills (light `#C3F1D5`; dark teal)
- the green peak POI icons (Evelyn Peak, Clevis Peak, Queen Elizabeth Ranges, Croda dei Toni)
- the green italic "Parco naturale Tre Cime" label
- the green Yellowhead 16 shields

Section 6 says exactly what the owner sets.

## 3. Colour pairs approved (WCAG 2.x ratios, computed from `web/app/themes.css`)

| Pair | Light | Dark | Use | Passes as |
|---|---|---|---|---|
| `--surface` numeral on `--ink` disc | 16.06 | 13.83 | pin, row badge, key swatch | text AAA |
| `--ink-2` on `--surface-2` | 10.28 | 9.52 | inert badge (other day) | text AAA |
| `--line-2` edge on `--surface-2` | 3.12 | 3.02 | inert badge outline | non-text 3:1 |
| `--ink` on `--surface-2` | 13.66 | 12.24 | hovered or flashed row | text AAA |
| `--ink-2` on `--bg` | 11.18 | 11.88 | key labels, label row | text AAA |
| `--muted` on `--bg` | 6.42 | 8.23 | key sentence, "· not on the map", "Pick a day for directions" | text AA |
| `--muted` on `--well` | 6.02 | 8.58 | Loading and Failed states | text AA |
| `--accent-text` on `--bg` | 5.85 | 8.83 | "1 not on the map" button | text AA |
| `--accent-ink` on `--accent` | 6.96 | 6.96 | Day segment, picked base glyph | text AA |
| `--ink` on `--bg` | 14.85 | 15.28 | Directions link | text AAA |
| `--accent` to `--map-casing` | **6.38** | 7.53 | ring, picked base outline | non-text |
| `--accent` to `--surface` | 2.52 | 6.54 | ring inner gap | light carried by the casing (6.38) |
| `--ink` on Google forest (`#C3F1D5`; dark `#164A55`) | 12.89 | 8.24 | pins and line today | non-text |
| `--ink` on `--map-wood` (after Q-A) | 12.17 | 10.07 | pins and line after the style | non-text |
| `--muted` on `--map-wood` (park labels after Q-A) | 5.26 | 5.42 | Google park label colour the owner sets | text AA |
| `--ink-2` on `--surface` (halo at 90% approximates it) | 12.09 | 12.39 | stop labels on the halo | text AAA |

**Correction to the note**: TRP2-N section 15 gives `--accent` to `--map-casing` as 7.53 in both themes. Light casing is `#172230`, which gives **6.38**. It still passes; carry 6.38 into tokens.md 5.1 when the next foundation change lands.

## 4. Rulings on the builder's departures

| Departure | Ruling | Reason |
|---|---|---|
| Rockies day 8 shows pins 1 and 2 only (Toe of the Athabasca Glacier has no point) | **Accept** | The label row says "1 not on the map" and the button lists it, which is honest (T5). Checklist 12's "1, 2, 3" assumed a point that does not exist. Data fix: D1, with the base points |
| Pin tooltips omit the time | **Accept; LATER-1** | The number links to the row, which carries the time. `DayPin` has no time field, and adding one is cheap but not needed for M1 |
| Positions from the route model by place slug (`pointLookup`) | **Accept** | One data boundary (P9): the map and the badges both read the route model, so counts cannot drift. The first point per slug wins, which is right for a place |
| Roads detected by name (`isRoadLike`) | **Accept for M1; SHOULD-4** | It removes the Icefields Parkway pin (F3). But a name test on `drive\|road\|parkway\|highway` can silently drop a real stop, and that stop is then counted neither as a pin nor as "not on the map". Narrow it and pin it with a test; replace it by kind or subkind when META-1 lands |
| Directions built in `web/components/trips/directions.ts` with `directionsUrl` and `formatPoint` | **Accept** | It imports from `links.ts` without editing it (PLC2 ownership respected), uses coordinates only and follows note 9 |
| "Stop" dot swatch in All days | **Accept** | It is what All days draws; the key stays true |
| Nit: "San Candido" runs under the Fit button at 390 | **Change: MUST-3** | Also at 1024 (`dolomites-d4-1024-dark`: "San Cal..." cut off by the control column). The note said narrow maps draw numbers only; apply that to the base label too |
| Nit: Rockies day 6 pins stay two discs on the sheet | **Accept; LATER-2** | They touch but do not overlap (about 24 px apart against the 20 px threshold). Their 36 px tap targets do overlap; raise the threshold on a coarse pointer later |
| Green basemap with Google POIs | **Accept as an owner console task** | Not a code defect (note 2.2). `clickableIcons: false` keeps them inert. Section 6 |

## 5. Findings

### MUST (before M1)

| # | Rank | Screen | Defect | Why it matters to a family | Fix | Evidence |
|---|---|---|---|---|---|---|
| MUST-1 | critical | Every Day view, all widths, both themes | The estimate is drawn as 8 px round beads (10 px with the halo) at a 14 px pitch, not a 2.5 px dash 8 gap 6. In `GoogleTripMap.tsx` `legParts`, `dash()` sets `strokeWeight: 8 + extra` on the symbol; a Symbol's `strokeWeight` is in pixels and is not scaled by `scale` | The guess becomes the loudest mark on the map, louder than the stops (P3, T5). It does not look like its own key swatch, and on out-and-back days it piles into a double chain that hides the pins and labels | In `dash()`: ink `strokeWeight: weight` (2.5 Day view, 2 All days); halo `strokeWeight: weight + 2`; keep the path `M 0,-1 0,1` with `scale` set so the **visible** dash is about 8 px including round caps (start at `scale: 2.75` for the ink, `3.25` for the halo) and `repeat: '14px'`. Extend `leg-parts.test.ts` to assert `strokeWeight` 2.5 and 4.5 (2 and 4 in All days). Re-shoot and measure the dash on screen | `canadian-d8-1440-light` (crop: beads about 16 device px wide at 2x), `dolomites-d4-1440-dark`, `canadian-d6-1024-dark` |
| MUST-2 | important | 1440 Day view, light and dark | Our stop and base labels are absolutely positioned outside the marker's box (`.tp-label { position: absolute; left: calc(50% + 15px) }`), so `REQUIRED_AND_HIDES_OPTIONAL` hides only what sits under the 22 px disc. Google's labels and shields print through our names | "Funbob, Monte Baranci" overprints "Versciaco", and "Jasper SkyTram" overprints "Jasper" and the park name. Our stop names are the reason for the labels, and right now they are the garbled ones | Put the label in flow inside `.tp-hit` (a flex row: disc, then label), and add an `aria-hidden` transparent spacer of the label's width on the left, so the disc stays on the anchor point while the marker's box covers the label. Then the collision rule hides the Google labels under it. Keep `translate(0, 50%)` for vertical centring | `dolomites-d4-1440-light`, `-dark`; `canadian-d6-1440-dark`; `canadian-d8-1440-light` (shield under "Sunwapta Falls") |
| MUST-3 | important | 390 sheet and 1024 column, Dolomites | The picked base label is drawn on narrow maps, and the narrow fit padding (right 60) does not clear it, so "San Candido" runs under the + / - / Fit column | The base name is unreadable at the default fit on phone and tablet, on the one trip that has bases | In `pinContent`, draw the base label only when `o.wide` (the same 560 px rule as stop labels, note 4.2). The label row already names the base | `dolomites-d4-390-light`, `dolomites-d4-1024-dark` |
| MUST-4 | important | Day view key, Dolomites (any trip with a picked base) | The key's "Base for the night" swatch is an ink square, but the only base drawn on the map is the picked base, which is amber with a casing | Amber elsewhere means "the selected thing" or a routed day. An amber square the key does not explain breaks "the legend true to what is drawn" (brief step 3, checklist 11) | In `keyOf`, when the picked base is drawn, give the item `pick: true`. In `trips.css`, add `.key-swatch[data-key='base'][data-pick]` with `background: var(--accent); outline: 1px solid var(--map-casing)` and a small house glyph in `--accent-ink`. Keep the ink square when an unpicked base is also drawn. Label unchanged | `dolomites-d4-1440-light`, `-dark`, `dolomites-d4-1024-dark` |
| MUST-5 | important | Verification set | Checklist 33's set is incomplete: no Rockies day 9, no Dolomites day 3, no hover, no "not on the map" list open, no phone key open, no All days, and no Lake Louise at zoom 14 | The hover ring, the list and the POI check have only been judged from code; the owner will see them at M1 | After MUST-1 to MUST-4, `travel-verifier` shoots exactly that list at 1440 and 390, light and dark, through the theme control on the Metal flags, and reads them in tiles | Section 0 |

### SHOULD (in TRP2a if time allows, else first in TRP2b)

| # | Rank | Screen | Defect | Fix |
|---|---|---|---|---|
| SHOULD-1 | important | 390 sheet | The map gets about 200 of the sheet's 416 px; "Map key" sits on its own 44 px row | Put the "Map key" toggle at the right end of the one-line key row (`display: flex; justify-content: space-between` on `.trip-map-key` below 1024). This gives the map about 44 px more. Keep the 32 px chip height with a 44 px hit area through `::before` |
| SHOULD-2 | important | 390 sheet, label row | The ellipsis cuts "2 stops on the map" and leaves "Day 8 · Lake Louise village … · 1 not on the map" | Below 1024, drop the base name from `labelOf`'s text (the day card names it): "Day 8 · 2 stops on the map · 1 not on the map" |
| SHOULD-3 | important | Rockies, every day (no base points) | "Directions for Day 8" opens Athabasca Falls to Sunwapta Falls only, but the day runs Jasper to Lake Louise | When either end falls back to a stop, label it by its ends: "Directions: Athabasca Falls to Sunwapta Falls ↗". Keep "Directions for Day N" only when both bases are points. Add a case to `route-spec.test.ts` |
| SHOULD-4 | important | All trips | `isRoadLike` matches any title with drive, road, parkway, highway or hwy and drops it uncounted | Test only `kind === 'visit'` entries (never `trail`). Add a unit test that lists every Rockies and Dolomites title it removes today (expected: the Icefields Parkway scenic drive only), so a new false positive fails CI. Replace it with the kind or subkind check after META-1 |
| SHOULD-5 | polish | 1440 light, Rockies day 6 | The day fit is about one zoom level looser than the same day in dark | Reproduce with a fresh load at `#day-6`. A likely cause is that the first `fitTo` runs in `requestAnimationFrame` before the column has its final height. Refit once on the first `idle` if the box size changed since the fit. Assert the zoom in the fake-Google e2e |
| SHOULD-6 | polish | Day view key | "Other days" is listed even when no dimmed dot is inside the frame | Accept for M1. Later, test the dots against the fitted bounds, or leave it as a trip-level item; a low priority |
| SHOULD-7 | polish | Hand-back | Google loads per page view are not reported | Report "1 per page view, +1 per theme toggle, 0 on a phone until the sheet opens" in the TRP2a hand-back and in the quota note for Q-C |

### LATER

| # | Item | Owner |
|---|---|---|
| LATER-1 | Pin tooltip "2 · Sunwapta Falls · 09:35": carry the entry time on `DayPin` | TRP2b |
| LATER-2 | Pill threshold 36 px on a coarse pointer, so tap targets never overlap | TRP2b |
| LATER-3 | Put the stop label on the side of the pin away from its legs, so a line never runs under the text | TRP2b |
| LATER-4 | Rockies base points (no base square, no base-to-base lines, no full-day Directions today) | D1 |
| LATER-5 | "Icefields Parkway (Hwy 93N) scenic drive": no point, or a line in TRP2b | D1 / META-1 |
| LATER-6 | Toe of the Athabasca Glacier point | D1 |
| LATER-7 | Place-page Google wrapper `role="application"` to `region` (note 13) | PLC follow-up |
| LATER-8 | Add the section 3 on-map pairs, with 6.38 light for accent to casing, to `tokens.md` 5.1 at the next foundation change | foundation |

## 6. Owner questions Q-A to Q-D, answered from the screenshots

**Q-A (restyle the Map ID): yes, before M1.** Every Rockies and Dolomites shot is about half green in light and teal in dark. The owner's current Map ID still shows POIs at zoom 8: green peak markers (Evelyn Peak, Clevis Peak, Brussels Peak, Queen Elizabeth Ranges and Shackle Peak on Rockies day 8; Croda dei Toni on Dolomites day 4) and green italic park names ("Parco naturale Tre Cime"). The peak markers are pin-shaped and sit beside our numbered pins, which is exactly the confusion F2 predicted. Exactly what to set in Google Cloud console, Map Management, the style attached to `NEXT_PUBLIC_GOOGLE_MAP_ID`:
1. Map type JavaScript, Vector; one style with a light and a dark variant.
2. Points of interest: **all off**, including Recreation, Parks and Lodging.
3. Natural land cover, forest, grass, scrub and park fills: `#E4E0D4` light, `#2B3845` dark.
4. Park and natural-feature label text: `#4D5B6B` light, `#A3B0BE` dark (5.26:1 and 5.42:1 on those fills).
5. Leave roads, place names, water, ice and relief as Google's. Publish.

**Q-B (highway shields): keep.** The green Yellowhead 16 maple-leaf shields show on Rockies day 6 (`canadian-d6-1440-light`, `-390-dark`) and cannot be recoloured, only hidden. The route numbers 16, 93 and 93A are what the driver follows. They are Google's mark, like its logo, not our overlay.

**Q-C (load on view, quota 300 a day): yes.** Every desktop shot shows the map without a click. That is the fix for "the day plan does not show the Google map". The phone loads nothing until the Map button opens the sheet (e2e line 219). Cost: 1 load per desktop page view, +1 per theme toggle, 0 for a phone visitor who never opens the map. At under 100 users this sits well inside the 10,000 free monthly loads; keep the 300 daily cap.

**Q-D (restrict the key): yes, before the M1 link leaves this Mac.** The screenshots cannot show the key's restrictions. It is a browser key, so it is in every page. Restrict it to the Maps JavaScript API and the referrers `127.0.0.1:3476`, `127.0.0.1:3477`, `127.0.0.1:3488`, `localhost`, `nks-travel.pages.dev` and the go-live host.

## 7. What the owner will see at M1

After MUST-1 to MUST-5, on `127.0.0.1:3476`:
- **A Google map on the trip page without a click**, beside the day list on desktop and in the Map sheet on phone and tablet.
- **Numbered dark pins** that match the numbers on the day's rows. Hovering a row rings its pin, and clicking a pin scrolls to its row.
- **Every line dashed.** No leg has a road route yet, and the key says so in words: "Road routes are not drawn yet... use Directions for the drive." A "Directions for Day N" link opens Google Maps with that day's stops.
- **Rockies day 8 shows 2 pins, not 3.** Toe of the Athabasca Glacier has no map position yet and is listed under "1 not on the map". No Rockies day has a base square or a line from the hotel, because the Rockies bases have no points yet. On the Rockies, Directions runs from the first stop to the last stop.
- **The Dolomites show the base** (amber house square, San Candido) and lines that start and end there.
- **The basemap stays half green, with Google's peak and park markers, until the Map ID style in section 6 is published.** That is a console setting, not the build. Google's markers do nothing when clicked.

**Note to send with the preview link:**

> This is M1 of the trip page map. It is now Google Maps, it loads by itself next to the day plan, and on a phone it opens from the Map button. Our stops are the numbered dark pins, and the same numbers are on the rows: hover or click either to move between them. Every line is dashed on purpose. Road routes are not drawn yet (they come in the next step), so each day has a "Directions" link that opens the drive in Google Maps. On the Rockies, day 8 shows two pins, because the glacier toe has no map position yet; it is listed under "not on the map". The Rockies hotels have no positions yet either, so the lines start at the first stop. The green fill and Google's own peak and park markers are still showing because the map style is not set in the Google console yet (steps in the review, section 6). Once it is published they go and the map turns our neutral colours. Before this link is shared beyond this Mac, please restrict the Maps key to the listed sites.
