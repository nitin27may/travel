# LM: the map adapter

Wave 1, parallel with L0 and LD. Agent: `travel-builder` (Sonnet). Effort: about 4 hours.
Plan: [README.md](README.md) section 3. Decision source: `docs/v2/research/map-stack-2026-10-18.md`.

## Goal

One interface every page uses to draw a map, so the map stack can change without rewriting a lane. MapLibre with
OpenFreeMap and Mapterhorn is the default and the only live family today. Google Maps JavaScript API and the Maps
Embed API are wired behind a flag for the place and trail pages and switched on when the owner creates the key.
The adapter enforces **one map family per page** (Google Maps Platform terms 3.2.3(e)).

## Read first

- `docs/v2/research/map-stack-2026-10-18.md` (decision table, "Google terms that make the hybrid legal", gotchas).
- `docs/v2/design/foundation/tokens.md` 5 (map palette, light and dark), components.md 7.1 (map) and 4.4 (the
  elevation cursor synced to the map), patterns.md 6 (fly-to timings, reduced motion).
- `prototype/src/map/MapView.tsx` (OpenFreeMap + Mapterhorn wiring, relief) and `legacy/globe/index.html` lines
  119 to 340 (styles, terrain with the AWS Terrarium fallback, `TERRAIN_MIN_ZOOM`).
- `prototype/src/data/trails.ts` `nav()` (the Google and Apple Maps URL builders already used).

## Files you own

`web/lib/map/**`, `web/components/map/**`, `web/tests/map/**`, and the `maplibre-gl` dependency in
`web/package.json` (pin `6.11.2`, the prototype's version).

## Do not touch

`web/app/**`, `web/components/ui/**` (L0), `web/lib/public/**` (LD), `web/lib/globe/**` (L2), everything outside `web/`.

## The interface

```ts
// web/lib/map/types.ts
export type MapFamily = 'maplibre' | 'google-js' | 'google-embed';
export interface LngLat { lng: number; lat: number }
export type PinStyle = 'stop' | 'stop-numbered' | 'base' | 'place' | 'trailhead' | 'parking' | 'trip';
export interface Pin { id: string; at: LngLat; style: PinStyle; label?: string; number?: number; days?: number[]; kind?: string }
export type LineStyle = 'route' | 'route-pick' | 'trail' | 'straight-estimate';
export interface Line { id: string; coords: LngLat[]; style: LineStyle }
export interface MapSpec {
  pins: Pin[]; lines: Line[];
  fit?: 'all' | { ids: string[] };          // initial camera
  camera?: { lng: number; lat: number; zoom: number };  // from ?c=, overrides fit
  selectedId?: string; cursor?: LngLat | null;          // elevation scrub
  terrain?: boolean; style?: 'relief' | 'light' | 'dark' | 'auto';
  interactive?: boolean; legend?: LegendItem[];
}
export interface MapHandle {
  flyTo(target: LngLat | { bounds: [LngLat, LngLat] }, opts?: { zoom?: number }): void;
  fit(ids?: string[]): void; select(id: string | null): void; setCursor(p: LngLat | null): void;
}
// web/components/map/MapSurface.tsx
<MapSurface spec={...} family?="maplibre" onSelect={(id) => ...} onCamera={(c) => ...} ref={handle} label="Route map of the Dolomites" />
// web/components/map/MapFamilyProvider.tsx
<MapFamilyProvider family="maplibre">...</MapFamilyProvider>   // one per page
// web/lib/map/links.ts
directionsUrl(to: LngLat, opts?: { from?: LngLat; mode?: 'driving' | 'walking' | 'transit' }): string   // Google Maps URLs, no key
searchUrl(name: string, at: LngLat, placeId?: string): string
appleMapsUrl(at: LngLat, name?: string, mode?: 'd' | 'w'): string
// web/lib/map/family.ts
placePageFamily(): MapFamily   // NEXT_PUBLIC_PLACE_MAP_FAMILY, default 'maplibre'; 'google-*' without NEXT_PUBLIC_GOOGLE_MAPS_KEY falls back to 'maplibre' with a console warning
```

## Steps

1. **MapLibre family** (`web/lib/map/maplibre/`): lazy-load `maplibre-gl` client-side only (dynamic import, no SSR);
   style = OpenFreeMap `liberty` (relief) / `positron` (light) / `dark`, re-coloured at load to tokens 5
   (`--map-land`, `--map-water`, `--map-contour`, `--map-halo`, labels reduced: no POI layers, place labels at
   town level and up), plus Mapterhorn hillshade (`https://tiles.mapterhorn.com/tilejson.json`) with the AWS
   Terrarium fallback copied from the legacy globe; `style: 'auto'` follows the page theme and swaps on theme change
   without losing the camera. Pins as one GeoJSON source with circle and symbol layers (6 px dots for `stop`,
   ink circles with mono numerals for `stop-numbered`, ink signposts for `base`, kind glyph for `place`);
   HTML markers only for the selected pin. Co-located pins merge with a "3 · 5" badge and fan out on hover or tap
   (components 7.1). Lines: `route` ink, `route-pick` amber with a 1 px ink casing, `trail` ink 3 px,
   `straight-estimate` dashed ink 50%. Controls per components 7.1 (zoom, Fit, attribution always visible with
   OpenFreeMap, OpenStreetMap contributors, Mapterhorn; scale bar). Keyboard and the on-screen list equivalent
   (`role="application"`, Tab cycles pins, Enter selects). Fly-to 600 to 900 ms by distance; `jumpTo` under
   reduced motion. Offline or tile failure: `--well` with pins and lines only and a notice banner.
2. **Google JS family** (`web/lib/map/google-js/`): loads the Maps JavaScript API with `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
   and a map ID, behind a **click-to-load facade** (a `--well` panel with the point as text, "Load Google map"
   button and the directions links; never a MapLibre preview, which would put two families on the page). Draws
   the same `Pin` and `Line` specs with Advanced Markers and Polylines in tokens 5 colours. `setCursor` moves a
   marker. No Google Places, Routes or Directions API calls, and nothing returned by Google is stored.
3. **Google Embed family** (`web/lib/map/google-embed/`): an iframe `https://www.google.com/maps/embed/v1/place?key=...&q=<lat>,<lng>`
   (or `view` mode with center and zoom), lazy-loaded, `title` set. It cannot draw our lines: the trail page shows
   the route only in the elevation profile and lists the trailhead and parking points under it.
4. **One family per page.** `MapFamilyProvider` registers the page's family; any `MapSurface` with a different
   family throws in development and renders an error panel in production. A build-time test renders every route's
   map usage (lanes add their pages to `web/tests/map/families.test.ts` through an exported registry
   `registerPageFamily(route, family)`) and fails on a mix. The globe page counts as `maplibre`.
5. **Links.** `links.ts` from the prototype's `nav()`: Google Maps URLs (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`,
   `search/?api=1&query=...&query_place_id=...`), Apple Maps (`https://maps.apple.com/?daddr=<lat>,<lng>&dirflg=d`).
   Coordinates with 5 decimals. Unit tests for each builder.
6. **Fake loaders for tests.** A `FakeGoogle` that records calls, so the Google families are tested without a key.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | MapLibre renders the Dolomites stops in light and dark with tokens 5 colours; the theme switch keeps the camera | tokens 5 |
| 2 | Nothing amber at rest; only `route-pick`, the selected pin ring and the cursor are amber | changes-from-preview 23 |
| 3 | Attribution always visible and readable at 11.5 px | tokens 6, components 7.1 |
| 4 | Mixing families on one page throws in dev and fails `families.test.ts` | map-stack research, terms 3.2.3(e) |
| 5 | Without a key, `google-js` and `google-embed` fall back to `maplibre`; with the fake key the facade shows and no Google script loads until the click | research "Usage at under 100 users" |
| 6 | Directions and Apple links point at our stored point, never a Google-sourced coordinate | research, kinds 5 |
| 7 | Reduced motion: no fly animation, no spin | tokens 11 |
| 8 | MapLibre is not in the first-load bundle of any page without a map | patterns 3.1 performance |

## Verification

```
pnpm install
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build
```

Screenshots: a dev-only `web/app/specimen/map/page.tsx` is L0's folder, so instead render the adapter in a
Playwright component page under `web/tests/map/fixtures/` (served by the e2e global setup) and shoot it with the L0
harness at 1440 and 390, light and dark: all pins and line styles, a merged "3 · 5" pin, the selected state, the
Google facade with the fake loader.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-LM`, branch `public/LM`, dev port 3402. Commits: interface and
links; MapLibre family and style; Google families and facade; family guard and tests. `git -C <worktree> add <owned
paths>`, never `-A`. Message `web(public/LM): ...` with your Co-Authored-By trailer. Rebase onto the v2 branch, do
not push. Wave 1 runs in parallel with L0, so take the screenshot harness from L0's branch once it lands, or ship
your own minimal copy under `web/tests/map/` and say so.
