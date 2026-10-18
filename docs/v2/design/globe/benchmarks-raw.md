# Official Docs Research: What makes premium interactive globes and maps feel premium (2025-2026), benchmarked for a MapLibre GL globe
SOURCE_TYPE: official-docs
CONFIDENCE: MEDIUM
GENERATED: 2026-10-18T12:00:00+05:30

## Summary

The engine-level numbers are well documented and checked against source code: MapLibre and Mapbox share the same camera and inertia defaults (flyTo curve 1.42, speed 1.2, easeTo 500 ms, default easing `bezier(0.25, 0.1, 0.25, 1)`, pan inertia `bezier(0, 0, 0.3, 1)` with deceleration 2500 and maxSpeed 1400). Both also use a 300 ms label-collision fade and a 300 ms raster fade. The atmosphere models differ. Mapbox `fog` uses zoom-interpolated defaults: stars fade out between z5 and z6, and space colour shifts from navy to blue between z4 and z7. MapLibre `sky` uses flat blend defaults of 0.8 and recommends you interpolate `atmosphere-blend` yourself. The "premium" marketing globes (GitHub, Stripe) look polished because of craft decisions their engineers wrote up: no textures, instanced dots, a back-face halo shader to hide aliasing, a 600 ms SVG-to-canvas crossfade, and an FPS-driven quality ladder. Consumer products (Google Earth web, Apple Maps, Felt, Windy, OWID) publish almost no visual numbers. For those, this file records only the documented behaviour and lists the rest as gaps.

## Key Findings

### 1. Atmosphere and sky

| Engine | Property | Default (verbatim) | Notes |
|---|---|---|---|
| Mapbox GL JS `fog` | `range` | `[0.5, 10]` | Fade distances from map centre; range -20 to 20 |
| Mapbox | `color` | `#ffffff` | Atmosphere just below and above the horizon |
| Mapbox | `high-color` | `#245cdf` | Upper atmosphere; opacity 0 removes it |
| Mapbox | `space-color` | `["interpolate",["linear"],["zoom"],4,"#010b19",7,"#367ab9"]` | Near-black navy at z4, sky blue at z7 |
| Mapbox | `horizon-blend` | `["interpolate",["linear"],["zoom"],4,0.2,7,0.1]` | Halo thickness: 0.2 at z4, 0.1 at z7 |
| Mapbox | `star-intensity` | `["interpolate",["linear"],["zoom"],5,0.35,6,0]` | Stars gone by z6 |
| Mapbox | `vertical-range` | `[0,0]` | No vertical constraint |
| MapLibre `sky` | `sky-color` | `#88C6FC` | |
| MapLibre | `horizon-color` | `#ffffff` | |
| MapLibre | `fog-color` | `#ffffff` | Needs 3D terrain |
| MapLibre | `fog-ground-blend` | `0.5` | 0 = centre, 1 = horizon |
| MapLibre | `horizon-fog-blend` | `0.8` | |
| MapLibre | `sky-horizon-blend` | `0.8` | |
| MapLibre | `atmosphere-blend` | `0.8` | Spec says interpolating it is recommended with globe; spec example stops are z0 1, z10 1, z12 0 |
| MapLibre example "globe with atmosphere" | `atmosphere-blend` | z0-5 = 1, fades to 0 by z7 | Light anchored to map, position `[1.5, 90, 80]` |
| Stadia MapLibre globe tutorial | container CSS | `background: hsl(0, 0%, 2%)` | Near-black page background so the globe reads as realistic |

SOURCES:
- https://docs.mapbox.com/style-spec/reference/fog/
- https://docs.mapbox.com/mapbox-gl-js/guides/globe/ (the guide confirms horizon-blend 0.2 and star-intensity 0.35 at low zoom, and that most current Mapbox styles ship with globe and an atmosphere by default)
- https://maplibre.org/maplibre-style-spec/sky/ (the spec calls the whole sky definition "experimental")
- https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/
- https://docs.stadiamaps.com/tutorials/3d-globe-view-with-maplibre-gl-js/

- FINDING: Mapbox fades the space look into a sky look over z4 to z7, and removes stars over z5 to z6. MapLibre ships constant blends and leaves the zoom fade to the style author. A MapLibre globe with no `atmosphere-blend` interpolation keeps the same halo strength at every zoom.
  SOURCE: https://docs.mapbox.com/style-spec/reference/fog/ ; https://maplibre.org/maplibre-style-spec/sky/

### 2. CesiumJS atmosphere, HDR, anti-aliasing

| Class.property | Default | Source |
|---|---|---|
| `SkyAtmosphere.atmosphereLightIntensity` | 50.0 | https://cesium.com/learn/cesiumjs/ref-doc/SkyAtmosphere.html |
| `SkyAtmosphere.atmosphereRayleighCoefficient` | `Cartesian3(5.5e-6, 13.0e-6, 28.4e-6)` | same |
| `SkyAtmosphere.atmosphereMieCoefficient` | `Cartesian3(21e-6, 21e-6, 21e-6)` | same |
| `SkyAtmosphere.atmosphereRayleighScaleHeight` / `MieScaleHeight` | 10000.0 m / 3200.0 m | same |
| `SkyAtmosphere.atmosphereMieAnisotropy` | 0.9 | same |
| `SkyAtmosphere.hueShift/saturationShift/brightnessShift` | 0.0 each | same |
| `SkyAtmosphere.perFragmentAtmosphere` | false | same |
| `Globe.showGroundAtmosphere` | true on WGS84, false otherwise | https://cesium.com/learn/cesiumjs/ref-doc/Globe.html |
| `Globe.atmosphereLightIntensity` | 10.0 | same |
| `Globe.lightingFadeOutDistance` / `FadeInDistance` | pi/2 x min radius / pi x min radius | same |
| `Globe.nightFadeOutDistance` / `FadeInDistance` | pi/2 x min radius / 5pi/2 x min radius | same |
| `Globe.enableLighting` | false | same |
| `Globe.dynamicAtmosphereLighting` / `...FromSun` | true / false | same |
| `Globe.maximumScreenSpaceError` | 2 | same |
| `Globe.tileCacheSize` | 100 | same |
| `Globe.preloadAncestors` / `preloadSiblings` | true / false | same |
| `Globe.loadingDescendantLimit` | 20 | same |
| `Globe.showSkirts` | true | same |
| `Scene.highDynamicRange` | false (HDR supported flag: true) | https://cesium.com/learn/cesiumjs/ref-doc/Scene.html |
| `Scene.gamma` | 2.2, used only with HDR | same |
| `Scene.msaaSamples` | 4 (set 1 to disable) | same |
| `Scene.requestRenderMode` | false | same |
| `PostProcessStageCollection.fxaa` | Runs after all other stages when enabled; default on/off not stated on page | https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html |
| `PostProcessStageCollection.exposure` | 1.0 | same |
| Tonemapper default | `Tonemapper.PBR_NEUTRAL` | same |

- FINDING: Cesium's `preloadAncestors: true` keeps a coarse parent tile on screen while children load, so you get no holes. `showSkirts: true` hides cracks between tiles. Together they are the documented "no pop-in" mechanism.
  SOURCE: https://cesium.com/learn/cesiumjs/ref-doc/Globe.html
- FINDING: `requestRenderMode` (default false) renders a frame only when the scene changes. It is the documented idle-power saver.
  SOURCE: https://cesium.com/learn/cesiumjs/ref-doc/Scene.html

### 3. Camera: flyTo and easeTo

| Parameter | MapLibre GL JS | Mapbox GL JS | Source |
|---|---|---|---|
| flyTo `curve` (rho) | 1.42 | 1.42 | https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/ ; https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/ui/camera.ts |
| flyTo `speed` | 1.2 | 1.2 | same |
| flyTo duration formula | `duration = 1000 * S / V`, where V = speed (or screenSpeed / rho) and S = path length in rho-screenfuls | same model | https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/camera.ts |
| flyTo `maxDuration` | no default; if exceeded, duration becomes 0 (instant jump) | same | FlyToOptions page above |
| easeTo `duration` | 500 ms | 500 ms | both camera.ts files |
| default easing | `bezier(0.25, 0.1, 0.25, 1)` (CSS `ease`) | `ease` from util, values not shown in camera.ts | https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/util/util.ts |
| reduced motion | non-essential easeTo gets duration 0; non-essential flyTo is delegated to easeTo | duration 0 when reduced motion applies | MapLibre camera.ts; Mapbox camera.ts |
| globe specifics | flyTo path maths delegated to `cameraHelper.handleFlyTo`; "On a globe the camera is left where it is" when raising for pitch | easeTo has a globe branch; globe/mercator switch happens in `_cameraForBounds` at the midpoint of the globe zoom thresholds | both camera.ts files |
| v6 fix | "Fix camera jump in flyTo when minZoom is set" (#7743) | n/a | https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0 |

- FINDING: Both engines are tuned to the van Wijk and Nuij smooth zoom-and-pan model (rho = 1.42). Long hops take proportionally longer, and nothing caps them unless you set `maxDuration`. Setting `maxDuration` too low makes the camera teleport rather than shortening the flight.
  SOURCE: https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/camera.ts
- FINDING: Pass `essential: true` only for flights the user asked for. Otherwise the engine drops them for users who prefer reduced motion. This is the built-in accessibility path.
  SOURCE: https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/camera.ts

### 4. Drag inertia

| Gesture | linearity | easing | deceleration | maxSpeed | Source |
|---|---|---|---|---|---|
| Pan | 0.3 | `bezier(0, 0, 0.3, 1)` | 2500 | 1400 | https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/handler_inertia.ts |
| Zoom | 0.3 | `bezier(0, 0, 0.3, 1)` | 20 | 1400 | same |
| Bearing | 0.3 | `bezier(0, 0, 0.3, 1)` | 1000 | 360 | same |
| Pitch | 0.3 | `bezier(0, 0, 0.3, 1)` | 1000 | 90 | same |
| Buffer cutoff | 160 ms (`BUFFER_CUTOFF`) | | | | same |
| Velocity window | 60 ms (`VELOCITY_WINDOW`) | | | | same |
| Mapbox GL JS | identical values; cutoff `160 //msec` | | | | https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/ui/handler_inertia.ts |
| MapLibre `reduceMotion` map option | `undefined`, meaning "gesture inertia defaults to the user's device settings" | | | | https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ |

- FINDING: The MapOptions page says `dragPan` accepts an object passed to `DragPanHandler.enable`, but it does not document the object's shape. The keys above (linearity, easing, deceleration, maxSpeed) come from source, not from the API reference.
  SOURCE: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/
- FINDING: The v6.0.0 notes fix "camera jump on dragend with globe + terrain at low pitch" (#7736). That was a known inertia glitch on globes before v6.
  SOURCE: https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0

### 5. Labels, collision, fade, typography

| Setting | MapLibre default | Mapbox default | Source |
|---|---|---|---|
| `fadeDuration` (label collision fade in/out) | 300 ms | 300 ms | https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ ; https://docs.mapbox.com/mapbox-gl-js/api/map/ |
| `crossSourceCollisions` | true | not checked | MapLibre MapOptions |
| `text-font` | `["Open Sans Regular","Arial Unicode MS Regular"]` | not checked | https://maplibre.org/maplibre-style-spec/layers/ |
| `text-size` | 16 | | same |
| `text-halo-width` / `text-halo-blur` | 0 / 0 px | | same |
| `text-padding` | 2 px | | same |
| `text-max-width` | 10 (ems) | | same |
| `text-letter-spacing` | 0 | | same |
| `symbol-spacing` | 250 | | same |
| `text-allow-overlap` | false | | same |
| Protomaps basemap glyphs | "Noto Sans Regular" in the example fontstack; flavours `light`, `dark`, `white`, `black`, `grayscale`; `lang` option | | https://docs.protomaps.com/basemaps/maplibre |

- FINDING: The spec default halo is 0 px. Any legibility halo over imagery or a dark globe has to be set by the style author. The spec does not recommend a value.
  SOURCE: https://maplibre.org/maplibre-style-spec/layers/
- FINDING: Felt (2021 engineering post) describes R-tree collision checks, several candidate positions per label, and a minimum repeat distance between duplicate labels. It gives no numbers.
  SOURCE: https://felt.com/blog/map-computer-graphics
- FINDING: Collision checks are "computationally intensive" with many features. Turning on overlap skips them, which trades clutter for frame time.
  SOURCE: https://maplibre.org/maplibre-gl-js/docs/guides/large-data/

### 6. Terrain shading and hillshade (MapLibre)

| Property | Default | Source |
|---|---|---|
| `hillshade-exaggeration` | 0.5 | https://maplibre.org/maplibre-style-spec/layers/ |
| `hillshade-shadow-color` | `#000000` | same |
| `hillshade-highlight-color` | `#FFFFFF` | same |
| `hillshade-accent-color` | `#000000` | same |
| `hillshade-illumination-direction` | 335 | same |
| `hillshade-illumination-altitude` | 45 | same |
| `hillshade-illumination-anchor` | `viewport` | same |
| `hillshade-method` | `standard` (also `basic`, `combined`, `igor`, `multidirectional`) | same |
| `color-relief-opacity` | 1 (layer type `color-relief`, colour ramp via interpolate) | same |
| `raster-resampling` | `linear` (or `nearest`) | same |
| v6.0.0 | "Improve 3D terrain performance" (#7549), WebGL2 required | https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0 |

- FINDING: Apple describes its globe in marketing terms only: "rich and interactive 3D globe", "amazing textures and contours", "vibrant details of mountain ranges, deserts, forests, oceans". It publishes no shading parameters.
  SOURCE: https://www.apple.com/maps/

### 7. Coastline crispness and anti-aliasing

| Product | Setting | Value | Source |
|---|---|---|---|
| MapLibre | `canvasContextAttributes.antialias` | false | https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ |
| Mapbox | `antialias` | false, "as a performance optimization" | https://docs.mapbox.com/mapbox-gl-js/api/map/ |
| MapLibre | `fill-antialias` | true (per-layer fill edge AA, independent of MSAA) | https://maplibre.org/maplibre-style-spec/layers/ |
| MapLibre | `line-blur` | 0 | same |
| MapLibre | `pixelRatio` | `devicePixelRatio` | MapLibre MapOptions |
| MapLibre | `maxCanvasSize` | `[4096, 4096]` | same |
| CesiumJS | `msaaSamples` | 4 | https://cesium.com/learn/cesiumjs/ref-doc/Scene.html |
| GitHub globe | WebGL antialias off; jagged limb hidden by a halo sphere scaled 1.15, tilted, gradient on its back face; per-dot alpha fade by camera distance to kill moire | n/a | https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/ |
| Stripe globe | `antialias: false` on `WebGLRenderer` fixed performance on high-DPI laptops without discrete GPUs | n/a | https://stripe.com/blog/globe |

- FINDING: No official source documents a coastline casing width for any of the candidate products. That is a style choice, recorded here as a gap.
  SOURCE: n/a (gap)

### 8. Marketing-globe craft: GitHub, Stripe, cobe

| Topic | GitHub homepage globe (Dec 2020) | Stripe globe (2020) | cobe (README example values) |
|---|---|---|---|
| Stack | three.js, WebGL | three.js, D3 `geoInterpolate`, Lodash | Own WebGL, "~5KB", zero deps |
| Layers | halo, globe, regions, blue spikes (open PRs), pink arcs (merged PRs) | semi-transparent ocean sphere (~50 segments), dot sphere, arcs | single shader globe, markers, arcs |
| Land | ~12,000 five-sided circles in one `InstancedMesh`; drawn where a PNG mask alpha >= 90/255 | 60,000 sunflower-spiral dots, filtered to ~20,000; `CircleGeometry(2, 5)` | `mapSamples: 16000`, `mapBrightness: 6` |
| Lighting | "no textures: we point four lights at a sphere" | lighting and gradients mentioned, no setup given | `diffuse: 1.2`, `dark: 0`, `baseColor: [0.3,0.3,0.3]`, `glowColor: [1,1,1]` |
| Arcs | `CubicBezierCurve3`, three orbit heights by distance, `TubeBufferGeometry` animated with `setDrawRange()` | `CubicBezierCurve3`, control points at 0.25/0.75 of the great arc, height `dist*0.5 + radius`, tube radius 0.5, 8 sides, 44 segments, drawn over 2.5 s | `arcWidth: 0.5`, `arcHeight: 0.3`, `markerElevation: 0.02` |
| Landing effect | ring scales up 6% of the remaining distance per frame (ease-out), opacity = 1 - scale | n/a | n/a |
| Spin | initial rotation from device timezone offset (no IP lookup) | rotates on load; scroll spin `rotation.y += delta * 0.0016`, throttled to 16 ms | `onRender` sets `state.phi = phi; phi += 0.01` per frame |
| Loading | SVG gradient placeholder, crossfades to canvas on first frame: 600 ms, scale 0.8 to 1, Web Animations API | rotates on load; static-image fallback planned, never used | n/a |
| Frame budget | degrade when "we fail to maintain 55.5 FPS over the last 50 frames"; 4 tiers: pixel ratio 2.0 to 1.5, fewer PRs, raycast every +4 frames, land density x0.65 (~12k to ~8k) | target 60 fps; other animations pause during scroll; off-screen past `window.innerHeight` stops animating and moves out with `translateX(100vw)` | `devicePixelRatio: 2` in example |
| Hover | raycast; card shows PR, repo, timestamp, language, locations; arcs clickable | n/a | n/a |

SOURCES:
- https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/
- https://stripe.com/blog/globe
- https://github.com/shuding/cobe

- FINDING: The cobe README publishes example values, not documented defaults. Treat the column above as one recommended configuration.
  SOURCE: https://github.com/shuding/cobe

### 9. Loading states and tile fade

| Mechanism | Value | Source |
|---|---|---|
| MapLibre `raster-fade-duration` | 300 ms | https://maplibre.org/maplibre-style-spec/layers/ |
| MapLibre `fadeDuration` (symbols) | 300 ms | MapLibre MapOptions |
| MapLibre `cancelPendingTileRequestsWhileZooming` | true | same |
| MapLibre `maxTileCacheSize` | null, sized from viewport via `maxTileCacheZoomLevels` | same |
| MapLibre `refreshExpiredTiles` | true | same |
| MapLibre globe data | reuses the same Mercator vector and raster tiles, reprojected on the client | https://maplibre.org/roadmap/maplibre-gl-js/globe-view |
| Cesium | `preloadAncestors` true, `loadingDescendantLimit` 20, `showSkirts` true | https://cesium.com/learn/cesiumjs/ref-doc/Globe.html |
| Google Earth web | load progress shown bottom-left; Settings > "Rendering quality" lowers size for slow machines | https://developers.google.com/maps/documentation/earth/discover-places-change-view (updated 2026-10-16) |
| GitHub | SVG placeholder plus 600 ms crossfade | GitHub blog above |

### 10. Performance: workers, rAF, DOM markers vs symbol layers

| Recommendation | Detail | Source |
|---|---|---|
| Hover and selection via feature-state | `setFeatureState` avoids "re-parsing all the geometries at each state change"; works only with data-driven paint properties | https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/ |
| Split static and dynamic GeoJSON | "any update to it requires Mapbox GL JS to reprocess the entire set of data"; keep the moving features in a small second source | same |
| Group similar layers | layers sharing type, source, source-layer, zoom, filter and layout render faster; only paint should differ | same |
| Cheap expressions | `==` beats `match` for one value; `has` before comparisons | same |
| GeoJSON point sources | `maxzoom` 12 "strikes a good balance"; cluster with `clusterMaxZoom: 14`, `clusterRadius: 50`; coordinates to ~6 decimals | https://maplibre.org/maplibre-gl-js/docs/guides/large-data/ |
| v5.13 GeoJSON | diff updates, `waitForCompletion` on `setData`/`updateData` | changelog via https://lists.openstreetmap.org/pipermail/rails-dev/2025-December/046174.html (secondary) |
| v6 feature-state | "up to a 3.4X speedup" | https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0 |
| DOM Marker defaults | anchor `center`, colour `#3FB1CE`, 27x41 px at scale 1, `opacityWhenCovered: 0.2`, `subpixelPositioning: false` | https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/ |
| Globe back-side markers | class `maplibregl-marker-covered` is toggled when a marker is "on the back of a globe"; docs example sets `pointer-events: none` | https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/ |
| Mapbox globe batching | "GL JS aims to batch multiple layers together" during globe and terrain rendering | https://docs.mapbox.com/mapbox-gl-js/api/map/ |
| Cesium idle | `requestRenderMode` renders only on change | Cesium Scene |
| earth.nullschool | SVG globe under an animation canvas plus an overlay canvas; globe mask redrawn to a detached canvas; bilinear interpolation of the 1 degree GFS grid, "quite costly"; state in URL hash | https://github.com/cambecc/earth |

- FINDING: Neither MapLibre nor Mapbox official docs give a marker count at which DOM markers become too slow. Official guidance points to clustering, feature-state and symbol layers instead.
  SOURCE: https://maplibre.org/maplibre-gl-js/docs/guides/large-data/ ; https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/

### 11. Selection panels, hover and product behaviour (consumer products)

| Product | Documented behaviour | Source |
|---|---|---|
| Google Earth web | drag to move; +/- or right-drag to zoom; Ctrl+drag to look around; 2D/3D toggle, compass (reset north), My Location (flies there) at bottom right; Map Style for labels, borders, roads, gridlines, animated clouds | https://developers.google.com/maps/documentation/earth/discover-places-change-view |
| Apple Maps on the web | public beta launched 24 Jul 2024 at beta.maps.apple.com; place cards with photos and reviews, actions such as ordering food, Guides; Safari/Chrome on Mac and iPad, Chrome/Edge on Windows; English only at launch | https://www.apple.com/newsroom/2024/07/apple-maps-on-the-web-launches-in-beta/ |
| Apple Maps 3D globe (native) | "rich and interactive 3D globe" | https://www.apple.com/maps/ |
| Our World in Data grapher | 10 Jun 2025: zoom-to-selection opens a 3D globe; rotate, zoom to continents; 3D/2D switch; continent and income filters; mobile simplified to select and zoom one country | https://ourworldindata.org/new-features-better-maps |
| Windy 3D globe | beta in the 2021 staff thread; all layers except Radar, Satellite and warnings; max zoom equals 2D zoom 6; desktop first; planned Premium-only | https://community.windy.com/topic/16541/windy-3d-mode-is-back |
| Felt | R-tree collision and multi-candidate placement (2021); batching cut base map render time ~20% and data render time ~55% | https://felt.com/blog/map-computer-graphics |
| GitHub | hover card: PR, repo, timestamp, language, locations | GitHub blog above |

## Code / Config

MapLibre atmosphere zoom fade, values taken from the MapLibre globe example (z5 to z7) and the style-spec stops (z10 to z12). Assembled here, not copied verbatim:
```json
"sky": { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
"light": { "anchor": "map", "position": [1.5, 90, 80] }
```
SOURCE: https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/

Mapbox fog defaults, written out as an explicit object built from the spec table:
```json
"fog": {
  "range": [0.5, 10], "color": "#ffffff", "high-color": "#245cdf",
  "space-color": ["interpolate",["linear"],["zoom"],4,"#010b19",7,"#367ab9"],
  "horizon-blend": ["interpolate",["linear"],["zoom"],4,0.2,7,0.1],
  "star-intensity": ["interpolate",["linear"],["zoom"],5,0.35,6,0]
}
```
SOURCE: https://docs.mapbox.com/style-spec/reference/fog/

MapLibre inertia defaults (verbatim from source):
```ts
const defaultInertiaOptions = { linearity: 0.3, easing: bezier(0, 0, 0.3, 1) };
const defaultPanInertiaOptions = extend({ deceleration: 2500, maxSpeed: 1400 }, defaultInertiaOptions);
const BUFFER_CUTOFF = 160;
```
SOURCE: https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/handler_inertia.ts

MapLibre default easing (verbatim):
```ts
export const defaultEasing: (t: number) => number = bezier(0.25, 0.1, 0.25, 1);
```
SOURCE: https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/util/util.ts

cobe README example values (fragments; the full block was too long to capture):
```js
const globe = createGlobe(canvas, {
  devicePixelRatio: 2, width: 1000, height: 1000, phi: 0, theta: 0, dark: 0, diffuse: 1.2,
  mapSamples: 16000, mapBrightness: 6,
  baseColor: [0.3, 0.3, 0.3], markerColor: [1, 0.5, 1], glowColor: [1, 1, 1],
  onRender: (state) => { state.phi = phi; phi += 0.01 },
});
```
SOURCE: https://github.com/shuding/cobe

## Caveats / Gaps

- MapLibre version: globe shipped in 5.0.0 (January 2025). v6.0.0 shipped 22 July 2026: ESM-only, WebGL2 required, `Map` composes `Camera`, `map.transform` removed. It lists no sky or atmosphere changes. The defaults above were read from `main` source on 2026-10-18. Pin a tag before quoting them as contractual. Sources: https://maplibre.org/roadmap/maplibre-gl-js/globe-view ; https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0
- The MapLibre `sky` spec is labelled experimental. Defaults may change.
- In the current MapLibre projection spec page, only `mercator` and `vertical-perspective` appear as named values, plus the z10 to z12 interpolate example. The roadmap describes the globe as "adaptive composite" with a Mercator switch at high zoom but gives no threshold. https://maplibre.org/maplibre-style-spec/projection/
- Mapbox GL JS globe-to-Mercator thresholds: the source references "the midpoint of the globe zoom thresholds", but the official guide gives no numbers.
- No official source found for: Google Earth web atmosphere or star rendering parameters; Apple Maps globe on the web (the 2024 web beta announcement does not mention a globe); Apple, Google, Felt or Windy label fonts, halo widths, hover latency, or panel transition durations; coastline casing widths for any product; the Stripe homepage's current globe (the blog post describes the 2020 build); cobe documented defaults (only example values); Cesium FXAA default state (the page does not say).
- Windy: no engineering blog. The only official material is a staff thread on the community forum.
- Felt: the "renders faster with MapLibre" post returned 404, and only a third-party summary exists, so it is excluded.
- GitHub and Stripe posts date from 2020. The techniques still apply, but the live homepages may differ.
- Hover latency and selection-card layout are not published as numbers by any candidate. Treat them as items for a design decision, not benchmarks.

## Sources

- https://docs.mapbox.com/style-spec/reference/fog/ — Mapbox Style Spec: fog
- https://docs.mapbox.com/mapbox-gl-js/guides/globe/ — Mapbox GL JS: Globe guide
- https://docs.mapbox.com/mapbox-gl-js/api/map/ — Mapbox GL JS: Map API
- https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/ui/camera.ts — Mapbox GL JS camera source
- https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/ui/handler_inertia.ts — Mapbox GL JS inertia source
- https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/ — Mapbox: Improve the performance of Mapbox GL JS maps
- https://maplibre.org/maplibre-style-spec/sky/ — MapLibre Style Spec: Sky
- https://maplibre.org/maplibre-style-spec/projection/ — MapLibre Style Spec: Projection
- https://maplibre.org/maplibre-style-spec/layers/ — MapLibre Style Spec: Layers
- https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/ — MapLibre GL JS: FlyToOptions
- https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ — MapLibre GL JS: MapOptions
- https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/ — MapLibre GL JS: Marker
- https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/ — MapLibre GL JS: MarkerOptions
- https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/ — MapLibre example: Display a globe with an atmosphere
- https://maplibre.org/maplibre-gl-js/docs/guides/large-data/ — MapLibre GL JS: Optimising performance with large GeoJSON
- https://maplibre.org/roadmap/maplibre-gl-js/globe-view — MapLibre roadmap: Globe View
- https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/camera.ts — MapLibre camera source
- https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/ui/handler_inertia.ts — MapLibre inertia source
- https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/util/util.ts — MapLibre util source
- https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0 — MapLibre GL JS v6.0.0 release
- https://lists.openstreetmap.org/pipermail/rails-dev/2025-December/046174.html — OSM dependency bump quoting the MapLibre 5.13 changelog (secondary)
- https://docs.stadiamaps.com/tutorials/3d-globe-view-with-maplibre-gl-js/ — Stadia Maps: 3D globe view with MapLibre GL JS
- https://docs.protomaps.com/basemaps/maplibre — Protomaps: Basemaps with MapLibre
- https://cesium.com/learn/cesiumjs/ref-doc/SkyAtmosphere.html — CesiumJS: SkyAtmosphere
- https://cesium.com/learn/cesiumjs/ref-doc/Globe.html — CesiumJS: Globe
- https://cesium.com/learn/cesiumjs/ref-doc/Scene.html — CesiumJS: Scene
- https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html — CesiumJS: PostProcessStageCollection
- https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/ — GitHub Blog: How we built the GitHub globe
- https://stripe.com/blog/globe — Stripe Blog: To design and develop an interactive globe
- https://github.com/shuding/cobe — cobe README
- https://github.com/cambecc/earth — earth (earth.nullschool.net) README
- https://developers.google.com/maps/documentation/earth/discover-places-change-view — Google Earth: Discover places and change your view
- https://www.apple.com/maps/ — Apple Maps
- https://www.apple.com/newsroom/2024/07/apple-maps-on-the-web-launches-in-beta/ — Apple Newsroom: Apple Maps on the web launches in beta
- https://ourworldindata.org/new-features-better-maps — Our World in Data: Announcing new features: better interactive maps
- https://community.windy.com/topic/16541/windy-3d-mode-is-back — Windy Community: Windy 3D mode is back
- https://felt.com/blog/map-computer-graphics — Felt: Map computer graphics
