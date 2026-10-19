import type { ExpressionSpecification, GeoJSONSource, Map as MLMap, Marker, MapMouseEvent } from 'maplibre-gl';
import { distanceKm } from '@/lib/map/geo';
import { prefersReducedMotion } from '@/lib/map/reduced-motion';
import { mix, readGlobePalette, type GlobePalette } from './palette';
import { PITCH_MIN_ZOOM, WIDE_ZOOM, boxCentre, fitZoom, flightDuration, flightPlan, pitchAt, shiftPx, terrainRamp, wideZoom, type FlightPlan } from './flight';
import { isNameLayer, planLabel, type LayerLike } from './labels';
import { STYLE_URLS, TERRAIN_FALLBACK, TERRAIN_URL, modeOf, type StyleKey } from '@/lib/map/maplibre/styles';
import { forRender, hitRank, type Bbox, type Feat, type FeatColl, type Pt } from './geometry';
import { SPIN_AFTER_GESTURE_MS, SPIN_AFTER_HOVER_MS, SPIN_EASE_MS, SPIN_HOVER_SPEED, isClick, spinAllowed, spinSpeedToward, spinStepDeg } from './motion';
import type { Camera } from './types';

type ML = typeof import('maplibre-gl');

export interface HoverInfo { kicker: string; title: string; sub?: string; sub2?: string; sub3?: string }
export type HitLayer = 'country' | 'adm1' | 'adm2';
export interface BasemapFeature { sourceLayer: string; kind: string; name: string; extra: string; lngLat: Pt; wikidata: string | null }

export interface Focus { country: number | null; s: number | null; d: number | null }
export interface Padding { top: number; right: number; bottom: number; left: number }

/** What a visitor reads when the style or tiles cannot be had; the technical reason goes to the console only. */
export const TILES_DOWN = 'The globe tiles are not available right now. The list of places still works.';

export interface GlobeHandlers {
  /** The exact world frame landed once the style loaded; the controller adopts its zoom as the world zoom. */
  onWorldFramed?(zoom: number): void;
  onReady?(): void;
  /** The first `idle` after the style loaded: the canvas may fade in and the pins may mount (spec 8.3). */
  onFirstIdle?(): void;
  onFail?(reason: string): void;
  onShape?(layer: HitLayer, id: number): void;
  onBasemap?(f: BasemapFeature | null): void;
  onBackground?(): void;
  describe?(layer: HitLayer, id: number): HoverInfo | null;
  /** The camera came to rest. `user` is true for a drag, scroll or pinch, false for a fly or jump we started. */
  onCamera?(c: Camera, user: boolean): void;
  onInteract?(): void;
  /** A 500 ms press or a right-click: "what is here" (spec 4.1 rule 6). */
  onWhatIsHere?(p: { x: number; y: number; lngLat: Pt }): void;
}

export interface MarkerSpec {
  key: string;
  lng: number;
  lat: number;
  anchor?: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offset?: [number, number];
  className?: string;
}

export interface GlobeEngineOptions {
  container: HTMLElement;
  style: StyleKey;
  terrain: boolean;
  exaggeration: number;
  camera: Camera;
  countries: FeatColl;
  handlers: GlobeHandlers;
  /** Used for the pointer tooltip. */
  tooltipClass?: string;
  /** False for the home-page cover: no pointer or touch handling, just the picture. */
  interactive?: boolean;
}

export interface FlyOptions {
  plan: FlightPlan;
  maxZoom?: number;
  /** The shape spans more than 170 degrees: stay on the globe at zoom 2.6 to 3.2, flat. */
  wide?: boolean;
}

export interface GlobeEngine {
  readonly map: MLMap;
  setStyle(style: StyleKey): void;
  setTerrain(on: boolean, exaggeration: number): void;
  /** `render` is the GeoJSON text a worker already wrote (so the main thread neither builds nor parses it); without it the shapes are written here. */
  setAdmin(level: 'adm1' | 'adm2', fc: FeatColl | null, render?: string): void;
  /** Swaps the country shapes (110m for the first paint, 50m later). Ids are the same in both. */
  setCountries(fc: FeatColl, render?: string): void;
  setFocus(f: Focus): void;
  /** Draws one city's outline (OSM admin level 8), or none. */
  setCityArea(f: Feat | null): void;
  /** Runs `cb` once the camera has come to rest (or after 3.5 s at most): a result opens its card when the flight lands, not during it. */
  afterMove(cb: () => void): void;
  /** The Natural Earth lake polygons (zoom 3 to 8, where the tiles name no lake): `render` is the GeoJSON text a worker wrote. */
  setLakes(render: string): void;
  setFeature(f: BasemapFeature | null): void;
  setPadding(p: Padding): void;
  setSpin(enabled: boolean, worldView: boolean): void;
  /** Stops the spin loop entirely (a cover scrolled out of view) and starts it again. */
  setActive(on: boolean): void;
  flyToBox(b: Bbox, o: FlyOptions): void;
  flyToPoint(p: Pt, zoom: number, o: { plan: FlightPlan }): void;
  /** False while a selection or feature card is open: the pointer tooltip would sit on top of it. */
  setTooltipEnabled(on: boolean): void;
  /** The discs drawn as DOM pins, so the map can keep its own labels off them (collision boxes). */
  setDiscs(list: { lng: number; lat: number; size: number }[]): void;
  setMinZoom(z: number): void;
  /** Frames the whole disc in the free area: `pad` is what the open panels cover (disc centre goes to the middle of the rest). */
  frameWorld(c: { lng: number; lat: number; zoom: number; diameter?: number }, pad: Padding, animate: boolean): number;
  /** Snaps to a camera with no animation (a restored `?c=` or reduced motion). */
  jumpTo(c: Camera): void;
  camera(): Camera;
  zoomBy(d: number): void;
  /** Keeps the markers of one namespace in step with `specs` and returns their elements by key, for React to portal into. */
  syncMarkers(ns: string, specs: MarkerSpec[]): Map<string, HTMLElement>;
  isTerrainOn(): boolean;
  /** The named things within the hit box of a point, nearest class first, up to five. */
  featuresAt(point: { x: number; y: number }, touch?: boolean): BasemapFeature[];
  /** Metres at a point from the terrain, rounded to 10; null with terrain off. */
  elevationAt(lngLat: Pt): number | null;
  /** Where a point is on the canvas, or null when it is behind the globe or well off the canvas: what the clustering works from. */
  project(lng: number, lat: number): { x: number; y: number } | null;
  destroy(): void;
}

// Peaks, rivers, seas, parks and towns stay in the style: they are what the visitor can hover and pick.
const HIDE_LABEL_LAYER = /suburb|hamlet|neighbo|quarter|label_other|(^|[_-])poi([_-]|$)|housenumber|aerodrome|airport|ferry/i;
const HIDE_SOURCE_LAYERS = new Set(['poi', 'housenumber', 'aerodrome_label', 'transportation_name']);
const HIT_SOURCE_LAYERS = new Set(['waterway', 'water_name', 'mountain_peak', 'park', 'place']);
const NONE = '\u0000';
/** A shape round a pole has its edge on the tile limit; its outline would draw as a ring at 85 degrees, so only its fill shows. */
const NOT_POLAR = ['!=', ['get', 'polar'], true] as never;
const ZERO_PAD = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDE_MAX = WIDE_ZOOM.max;

const featureName = (p: Record<string, unknown>): string => String(p['name:en'] || p.name_en || p.name || '');

function describeBasemap(sourceLayer: string, p: Record<string, unknown>): { kind: string; extra: string } {
  const cls = String(p.class || '').replace(/_/g, ' ');
  if (sourceLayer === 'waterway') return { kind: cls || 'river', extra: p.intermittent ? 'intermittent' : '' };
  if (sourceLayer === 'water_name') return { kind: cls || 'water', extra: '' };
  if (sourceLayer === 'mountain_peak') return { kind: cls || 'peak', extra: p.ele ? `${Number(p.ele).toLocaleString('en-CA')} m` : '' };
  if (sourceLayer === 'park') return { kind: cls || 'park', extra: '' };
  if (sourceLayer === 'lakes') return { kind: 'lake', extra: '' };
  return { kind: cls || 'place', extra: p.capital === 2 ? 'capital' : '' };
}

export function createGlobe(ml: ML, opts: GlobeEngineOptions): GlobeEngine {
  const { container, handlers } = opts;
  let styleKey = opts.style;
  let terrainOn = opts.terrain;
  let exaggeration = opts.exaggeration;
  let pal: GlobePalette = readGlobePalette(container, modeOf(styleKey));
  let destroyed = false;
  let styleLoaded = false;
  let fellBack = false;
  let fontStack: string[] = ['Noto Sans Regular'];
  let vectorSource = 'openmaptiles';
  let hitLayers: string[] = [];
  let focus: Focus = { country: null, s: null, d: null };
  let adm1: FeatColl | null = null;
  let adm2: FeatColl | null = null;
  let feature: BasemapFeature | null = null;
  let hovered: BasemapFeature | null = null;
  let hoverRef: { source: string; id: number } | null = null;
  let tipOwner: string | null = null;
  let tipsOff = false;
  let padding: Padding = { top: 80, right: 80, bottom: 80, left: 80 };
  let flyToken = 0;
  /** The spin waits until this time; Infinity while a pointer is down. */
  let holdUntil = 0;
  let pointerDown = false;
  let loopActive = true;
  let pressAt: { x: number; y: number } | null = null;
  let dragged = false;
  const hold = (ms: number): void => { holdUntil = Math.max(holdUntil === Infinity ? 0 : holdUntil, performance.now() + ms); spinSpeed = 0; };
  let spinSpeed = 1;
  let hoverSlowUntil = 0;
  const slowSpin = (): void => { hoverSlowUntil = performance.now() + SPIN_AFTER_HOVER_MS; };
  let spinEnabled = false;
  let worldView = true;
  let raf = 0;
  const markers = new Map<string, { marker: Marker; el: HTMLElement; sig: string }>();

  const map = new ml.Map({
    container,
    style: STYLE_URLS[styleKey],
    center: [opts.camera.lng, opts.camera.lat],
    zoom: opts.camera.zoom,
    minZoom: 0.6,
    maxZoom: 17,
    interactive: opts.interactive !== false,
    maxPitch: 70,
    attributionControl: false,
    canvasContextAttributes: { antialias: true },
  });
  // A handle for the browser tests and probes (camera reads, projected positions); nothing in the app reads it.
  (container as unknown as { __map?: MLMap }).__map = map;
  map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-right');
  // The scale bar has no meaning (it reads NaN) on the globe's far view; show it once the map is flat enough to measure.
  const syncScale = (): void => { const el = container.querySelector<HTMLElement>('.maplibregl-ctrl-scale'); if (el) el.hidden = map.getZoom() < 4.5; };
  map.on('zoom', syncScale); map.on('load', syncScale);

  const tip = document.createElement('div');
  tip.className = opts.tooltipClass ?? 'globe-tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  container.appendChild(tip);

  const failTimer = window.setTimeout(() => { if (!styleLoaded && !destroyed) { console.warn('[globe] the map style did not load in 15 s'); handlers.onFail?.(TILES_DOWN); } }, 15000);

  // ---- tooltip -------------------------------------------------------------------------------------------
  function showTip(e: { point: { x: number; y: number } }, info: HoverInfo, owner: string): void {
    // No tooltip while a card is open or a pointer is down (spec 4.1 rule 8): it would sit on top of the card.
    if (tipsOff || pointerDown) { hideTip(); return; }
    tip.replaceChildren();
    const k = document.createElement('div'); k.className = 'globe-tip-k'; k.textContent = info.kicker;
    const t = document.createElement('div'); t.className = 'globe-tip-t'; t.textContent = info.title;
    tip.append(k, t);
    for (const line of [info.sub, info.sub2, info.sub3]) if (line) { const s = document.createElement('div'); s.className = 'globe-tip-s'; s.textContent = line; tip.append(s); }
    tip.hidden = false;
    // The free canvas ends where the open side panel starts (--globe-clip-right), so the panel never clips a tooltip.
    const clip = parseFloat(getComputedStyle(container).getPropertyValue('--globe-clip-right')) || 0;
    const w = container.clientWidth - clip, tw = tip.offsetWidth;
    const x = e.point.x + 16 + tw > w ? e.point.x - 16 - tw : e.point.x + 16;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${e.point.y + 16}px)`;
    tipOwner = owner;
    map.getCanvas().style.cursor = 'pointer';
  }
  function hideTip(): void {
    tip.hidden = true; tipOwner = null;
    if (!destroyed) map.getCanvas().style.cursor = '';
  }

  // ---- base style ----------------------------------------------------------------------------------------
  /** Relief, Light and Dark are three looks, not one recolour: relief keeps woods and full hillshade, light is paler with faint shading, dark follows the dark tokens. Every colour is a token (no literals). */
  function scheme(): { land: string; wood: string; water: string; hill: number } {
    if (styleKey === 'relief') return { land: pal.land, wood: pal.wood, water: pal.ocean, hill: 1.15 };
    if (styleKey === 'light') return { land: mix(pal.land, pal.surface, 0.6), wood: mix(pal.wood, pal.surface, 0.5), water: mix(pal.ocean, pal.surface, 0.25), hill: 0.35 };
    // Dark: land lighter than the sea (spec 6.6, M4); both are tokens, so the owner's answer to Q6 is a token change.
    return { land: pal.land, wood: pal.wood, water: pal.ocean, hill: 1 };
  }

  function recolourBase(): void {
    const style = map.getStyle();
    if (!style?.layers) return;
    const sc = scheme();
    const road = mix(sc.land, pal.ink, 0.16);
    const set = (id: string, kind: 'paint' | 'layout', prop: string, v: unknown) => {
      try { if (kind === 'paint') map.setPaintProperty(id, prop as never, v as never); else map.setLayoutProperty(id, prop as never, v as never); } catch { /* property not on this layer */ }
    };
    for (const l of style.layers) {
      const sl = (l as { 'source-layer'?: string })['source-layer'] ?? '';
      // The style background is the sea, so a globe whose tiles have not arrived reads as water with our own land on it. The tiles
      // draw no land polygon (OpenMapTiles has only water), so past zoom 4 the background turns to land and the tiles' water draws the sea.
      if (l.type === 'background') set(l.id, 'paint', 'background-color', ['interpolate', ['linear'], ['zoom'], 3, pal.ocean, 4.5, sc.land]);
      // Liberty's shaded-relief raster is tinted green at the far zooms; the hillshade layer carries the relief instead.
      else if (l.type === 'raster') set(l.id, 'layout', 'visibility', 'none');
      else if (l.type === 'fill') {
        const wooded = sl === 'landcover' || sl === 'park' || sl === 'landuse';
        const fill = sl === 'water' ? sc.water : sl === 'building' ? pal.high : wooded ? sc.wood : sc.land;
        // Liberty fills woods and parks with a sprite pattern (hue about 117, green) from zoom 12: the colour alone carries them here
        set(l.id, 'paint', 'fill-pattern', undefined);
        set(l.id, 'paint', 'fill-color', fill);
        // The outline matches its own fill: a land-coloured outline on water drew a white ring at the 85 degree edge of the tiles.
        set(l.id, 'paint', 'fill-outline-color', fill);
      } else if (l.type === 'fill-extrusion') {
        set(l.id, 'paint', 'fill-extrusion-color', pal.high);
      } else if (l.type === 'line') {
        if (sl === 'waterway') set(l.id, 'paint', 'line-color', pal.river);
        else if (sl === 'boundary') set(l.id, 'paint', 'line-color', pal.border);
        else if (sl === 'transportation') set(l.id, 'paint', 'line-color', road);
        // Liberty outlines parks in green (park_outline): a quiet step of the wood colour instead
        else if (sl === 'park' || sl === 'landcover' || sl === 'landuse') set(l.id, 'paint', 'line-color', mix(sc.wood, pal.ink, 0.15));
      } else if (l.type === 'symbol') {
        // Our own pins carry the world view; keep only large place names and water names from the base.
        if (HIDE_SOURCE_LAYERS.has(sl) || HIDE_LABEL_LAYER.test(l.id)) { set(l.id, 'layout', 'visibility', 'none'); continue; }
        set(l.id, 'paint', 'text-color', pal.label);
        set(l.id, 'paint', 'text-halo-color', pal.halo);
        set(l.id, 'paint', 'text-halo-width', styleKey === 'dark' ? 0.9 : 1.2);
      }
    }
  }

  /**
   * One label pass for all three styles (spec 6.2): one script per name, no capitals, state names from zoom 5, cities by rank.
   * The decisions are in labels.ts; this applies them to the loaded style.
   */
  function applyLabels(): void {
    const layers = map.getStyle().layers as (LayerLike & { filter?: unknown; minzoom?: number; maxzoom?: number })[];
    const set = (id: string, prop: string, v: unknown, kind: 'layout' | 'paint' = 'layout') => {
      try { if (kind === 'layout') map.setLayoutProperty(id, prop as never, v as never); else map.setPaintProperty(id, prop as never, v as never); } catch { /* not on this layer */ }
    };
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (!isNameLayer(l)) continue;
      const plan = planLabel(l);
      if (plan.hide) { set(l.id, 'visibility', 'none'); continue; }
      for (const [k, v] of Object.entries(plan.layout)) set(l.id, k, v);
      if (plan.muted) set(l.id, 'text-color', mix(pal.label, scheme().land, 0.35), 'paint');
      if (plan.minzoom !== undefined || plan.maxzoom !== undefined) map.setLayerZoomRange(l.id, plan.minzoom ?? l.minzoom ?? 0, plan.maxzoom ?? l.maxzoom ?? 24);
      if (!plan.bands) continue;
      const next = layers[i + 1]?.id;
      const rank: ExpressionSpecification = ['coalesce', ['get', 'rank'], 99];
      plan.bands.forEach((b, k) => {
        const band: ExpressionSpecification = ['all', ['>=', rank, b.minRank], ['<=', rank, b.maxRank]];
        const filter = (l.filter ? ['all', l.filter, band] : band) as ExpressionSpecification;
        if (k === 0) { map.setFilter(l.id, filter); map.setLayerZoomRange(l.id, b.minzoom, 24); return; }
        const spec = (map.getStyle().layers.find((x) => x.id === l.id) ?? l) as never as Record<string, unknown>;
        try { map.addLayer({ ...spec, id: `${l.id}${b.suffix}`, filter, minzoom: b.minzoom } as never, next); } catch { /* the style changed under us */ }
      });
    }
  }

  function hillCurve(): ExpressionSpecification {
    const h = scheme().hill;
    const stops: (number)[] = [0, 0, 2, 0, 4, 0.15 * h, 7, 0.45 * h, 9, 0.55 * h];
    if (styleKey === 'light') stops.push(10, 0.4 * h, 11, 0);
    return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as ExpressionSpecification;
  }

  function addHills(beforeId: string | undefined): void {
    if (map.getLayer('hills')) return;
    map.addLayer({
      id: 'hills', type: 'hillshade', source: 'dem-hill',
      paint: {
        // None on the far globe where tiles meet in seams (spec 6.6), full relief once a country fills the view; Light fades out above zoom 10.
        'hillshade-exaggeration': hillCurve(),
        'hillshade-shadow-color': pal.shade, 'hillshade-highlight-color': pal.high, 'hillshade-accent-color': pal.shade,
        'hillshade-illumination-direction': 315, 'hillshade-illumination-anchor': 'map',
      },
    }, beforeId);
  }

  /** Relief grows in as the camera passes the terrain gate: five steps by zoom, so a fly-in ramps the exaggeration instead of popping it on (spec 5.3). */
  function applyTerrain(): void {
    if (!map.getSource('dem')) return;
    const ex = terrainOn ? terrainRamp(map.getZoom(), exaggeration) : 0;
    const cur = map.getTerrain();
    if (ex > 0 && (!cur || cur.exaggeration !== ex)) map.setTerrain({ source: 'dem', exaggeration: ex });
    else if (ex === 0 && cur) map.setTerrain(null);
  }

  function addRelief(firstWaterId: string | undefined): void {
    map.addSource('dem-hill', { type: 'raster-dem', url: TERRAIN_URL, tileSize: 512 });
    map.addSource('dem', { type: 'raster-dem', url: TERRAIN_URL, tileSize: 512 });
    addHills(firstWaterId);
  }

  const onDemError = (e: { sourceId?: string }): void => {
    if (fellBack || !e.sourceId?.startsWith('dem')) return;
    fellBack = true;
    console.warn('[globe] Mapterhorn failed; falling back to AWS Terrarium tiles.');
    try {
      map.setTerrain(null);
      if (map.getLayer('hills')) map.removeLayer('hills');
      map.removeSource('dem'); map.removeSource('dem-hill');
      map.addSource('dem', TERRAIN_FALLBACK); map.addSource('dem-hill', TERRAIN_FALLBACK);
      addHills(undefined); applyTerrain();
    } catch { /* style changed under us */ }
  };
  map.on('error', onDemError as never);

  // ---- our layers ----------------------------------------------------------------------------------------
  const sel = (key: string): ExpressionSpecification => ['boolean', ['feature-state', key], false];
  const EMPTY = { type: 'FeatureCollection' as const, features: [] };
  /** Selected: a 2.5 px amber line between two 1 px casings; hover: 1.5 px with a 0.5 px casing (spec 6.3), so the edge reads on land and on water. */
  const lineWidth = (rest: number): ExpressionSpecification => ['case', sel('selected'), 2.5, sel('hover'), 1.5, rest];
  const casingWidth = ['case', sel('selected'), 4.5, sel('hover'), 2.5, 0] as ExpressionSpecification;

  function addLayers(firstSymbolId: string | undefined, firstWaterId: string | undefined, bottomId: string | undefined): void {
    map.addSource('countries', { type: 'geojson', data: countriesData as never });
    // Our own land at the far zooms (the tiles carry none): the 110m or 50m countries in the land colour, fading out as the tiles' land background takes over.
    map.addLayer({ id: 'land-fill', type: 'fill', source: 'countries', paint: { 'fill-color': scheme().land, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 1, 4.5, 0], 'fill-antialias': true } }, bottomId);
    map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries', paint: { 'fill-color': pal.accentSel, 'fill-opacity': ['case', sel('selected'), 0, sel('hover'), 0.35, 0] } }, firstWaterId);

    map.addSource('adm1', { type: 'geojson', data: admData.adm1 as never });
    map.addLayer({ id: 'adm1-fill', type: 'fill', source: 'adm1', paint: { 'fill-color': ['case', sel('hover'), pal.accentSel, pal.ink], 'fill-opacity': ['case', sel('selected'), 0, sel('hover'), 0.35, 0.06] } }, firstSymbolId);
    map.addSource('adm2', { type: 'geojson', data: admData.adm2 as never });
    map.addLayer({ id: 'adm2-fill', type: 'fill', source: 'adm2', paint: { 'fill-color': ['case', sel('hover'), pal.accentSel, pal.ink], 'fill-opacity': ['case', sel('selected'), 0, sel('hover'), 0.35, 0.05] } }, firstSymbolId);

    // The dim sits above the basemap labels, so names and hillshade outside the open shape fade with the land (spec 6.4, review M14).
    // Its opacity is a plain expression on the shape's id, set when the focus changes: no loop over features, no feature-state.
    for (const [id, source] of [['country-dim', 'countries'], ['adm1-dim', 'adm1'], ['adm2-dim', 'adm2']] as const) {
      map.addLayer({ id, type: 'fill', source, paint: { 'fill-color': pal.dim, 'fill-opacity': 0 } });
    }
    map.addLayer({ id: 'country-casing', type: 'line', source: 'countries', filter: NOT_POLAR, paint: { 'line-color': pal.casingSel, 'line-width': casingWidth, 'line-opacity': 1 } });
    map.addLayer({ id: 'country-line', type: 'line', source: 'countries', filter: NOT_POLAR, paint: { 'line-color': pal.accentSel, 'line-width': lineWidth(0), 'line-opacity': 1 } });
    map.addLayer({ id: 'adm1-line-rest', type: 'line', source: 'adm1', paint: { 'line-color': pal.border, 'line-width': 0.8, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'adm1-casing', type: 'line', source: 'adm1', paint: { 'line-color': pal.casingSel, 'line-width': casingWidth, 'line-opacity': 1 } });
    map.addLayer({ id: 'adm1-line', type: 'line', source: 'adm1', paint: { 'line-color': pal.accentSel, 'line-width': lineWidth(0), 'line-opacity': 1 } });
    map.addLayer({ id: 'adm2-line-rest', type: 'line', source: 'adm2', paint: { 'line-color': pal.border, 'line-width': 0.9, 'line-opacity': 0.85 } });
    map.addLayer({ id: 'adm2-casing', type: 'line', source: 'adm2', paint: { 'line-color': pal.casingSel, 'line-width': casingWidth, 'line-opacity': 1 } });
    map.addLayer({ id: 'adm2-line', type: 'line', source: 'adm2', paint: { 'line-color': pal.accentSel, 'line-width': lineWidth(0), 'line-opacity': 1 } });
    // Lakes as polygons below zoom 8 (spec 4.2): invisible, so they are only something to point at; the tiles draw the water.
    map.addSource('lakes', { type: 'geojson', data: lakesData as never });
    map.addLayer({ id: 'lake-fill', type: 'fill', source: 'lakes', minzoom: 2.5, maxzoom: 8, paint: { 'fill-color': pal.accentSel, 'fill-opacity': 0.01 } });
    if (!hitLayers.includes('lake-fill')) hitLayers.push('lake-fill');
    // The one city area shown at a time: the OSM admin level 8 outline of a selected city that holds our content (spec 4.2, F3).
    map.addSource('city', { type: 'geojson', data: (cityArea ? { type: 'FeatureCollection', features: [cityArea] } : EMPTY) as never });
    map.addLayer({ id: 'city-fill', type: 'fill', source: 'city', paint: { 'fill-color': pal.accentSel, 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'city-casing', type: 'line', source: 'city', paint: { 'line-color': pal.casingSel, 'line-width': 4.5 } });
    map.addLayer({ id: 'city-line', type: 'line', source: 'city', paint: { 'line-color': pal.accentSel, 'line-width': 2.5 } });
    map.addLayer({
      id: 'adm2-label', type: 'symbol', source: 'adm2', minzoom: 6,
      layout: { 'text-field': ['get', 'name'], 'text-font': fontStack, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 13], 'text-padding': 8, 'text-transform': 'none' },
      paint: { 'text-color': pal.label, 'text-halo-color': pal.halo, 'text-halo-width': 1.2, 'text-opacity': 1 },
    });

    // Named basemap things (rivers, seas, peaks, parks, towns) can be hovered and picked; the pick is outlined here, with its casing.
    const none: ExpressionSpecification = ['==', ['get', 'name'], NONE];
    map.addLayer({ id: 'hl-lake-fill', type: 'fill', source: 'lakes', minzoom: 2.5, maxzoom: 8, filter: none, paint: { 'fill-color': pal.accentSel, 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'hl-lake-line', type: 'line', source: 'lakes', minzoom: 2.5, maxzoom: 8, filter: none, paint: { 'line-color': pal.accentSel, 'line-width': 2 } });
    map.addLayer({ id: 'hl-park-fill', type: 'fill', source: vectorSource, 'source-layer': 'park', filter: none, paint: { 'fill-color': pal.accentSel, 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'hl-river-casing', type: 'line', source: vectorSource, 'source-layer': 'waterway', filter: none, paint: { 'line-color': pal.casingSel, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4.2, 10, 7], 'line-opacity': 1 } });
    map.addLayer({ id: 'hl-river', type: 'line', source: vectorSource, 'source-layer': 'waterway', filter: none, paint: { 'line-color': pal.accentSel, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.2, 10, 5], 'line-opacity': 1 } });
    // The base styles draw no layer for mountain_peak, and queryRenderedFeatures only sees style layers: an invisible one makes peaks targets.
    map.addLayer({ id: 'hit-peak', type: 'circle', source: vectorSource, 'source-layer': 'mountain_peak', minzoom: 9, paint: { 'circle-radius': 12, 'circle-color': pal.ink, 'circle-opacity': 0.01 } });
    // The dark style labels only line-shaped water; seas and lakes are points in the tiles, so they get a hit layer too.
    map.addLayer({ id: 'hit-water', type: 'circle', source: vectorSource, 'source-layer': 'water_name', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 14, 'circle-color': pal.ink, 'circle-opacity': 0.01 } });
    for (const id of ['hit-peak', 'hit-water']) if (!hitLayers.includes(id)) hitLayers.push(id);
    const ring = (id: string, source: string, radius: number) => {
      map.addLayer({ id: `${id}-casing`, type: 'circle', source, 'source-layer': id === 'hl-peak' ? 'mountain_peak' : 'water_name', filter: none, paint: { 'circle-radius': radius, 'circle-color': 'transparent', 'circle-stroke-color': pal.casingSel, 'circle-stroke-width': 4 } });
      map.addLayer({ id, type: 'circle', source, 'source-layer': id === 'hl-peak' ? 'mountain_peak' : 'water_name', filter: none, paint: { 'circle-radius': radius, 'circle-color': 'transparent', 'circle-stroke-color': pal.accentSel, 'circle-stroke-width': 2 } });
    };
    ring('hl-peak', vectorSource, 9);
    ring('hl-label', vectorSource, 10);
    map.addLayer({ id: 'hl-park-casing', type: 'line', source: vectorSource, 'source-layer': 'park', filter: none, paint: { 'line-color': pal.casingSel, 'line-width': 4.5 } });
    map.addLayer({ id: 'hl-park', type: 'line', source: vectorSource, 'source-layer': 'park', filter: none, paint: { 'line-color': pal.accentSel, 'line-width': 2.5 } });

    // Our discs are DOM markers the map cannot see; this symbol layer (a transparent 1 px image scaled to each disc) gives them collision
    // boxes, so a basemap name moves off the disc instead of hiding under it: the Italy disc must not cover "Italy" (spec 6.2).
    if (!map.hasImage('globe-blank')) map.addImage('globe-blank', { width: 1, height: 1, data: new Uint8Array(4) });
    map.addSource('discs', { type: 'geojson', data: discData() as never });
    map.addLayer({ id: 'disc-collider', type: 'symbol', source: 'discs', layout: { 'icon-image': 'globe-blank', 'icon-size': ['get', 'size'], 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-padding': 4 }, paint: { 'icon-opacity': 0 } });
  }

  let cityArea: Feat | null = null;
  let lakesData: unknown = EMPTY;
  // What each shape source holds: GeoJSON, or the object URL of GeoJSON a worker wrote (MapLibre then reads it in its own worker).
  let countriesData: unknown = forRender(opts.countries);
  const admData: Record<'adm1' | 'adm2', unknown> = { adm1: EMPTY, adm2: EMPTY };
  const blobs: Record<string, string> = {};
  const dataOf = (key: string, fc: FeatColl | null, render?: string): unknown => {
    if (blobs[key]) { URL.revokeObjectURL(blobs[key]); delete blobs[key]; }
    if (render) return (blobs[key] = render.startsWith('blob:') ? render : URL.createObjectURL(new Blob([render], { type: 'application/json' })));
    return fc ? forRender(fc) : EMPTY;
  };
  let discs: { lng: number; lat: number; size: number }[] = [];
  const discData = () => ({ type: 'FeatureCollection' as const, features: discs.map((d) => ({ type: 'Feature' as const, properties: { size: d.size }, geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] } })) });

  const selected: Record<string, number | null> = { countries: null, adm1: null, adm2: null };
  function setSelected(source: string, id: number | null): void {
    if (!map.getSource(source)) return;
    const prev = selected[source];
    if (prev !== null && prev !== undefined && prev !== id) { try { map.setFeatureState({ source, id: prev }, { selected: false }); } catch { /* source replaced */ } }
    if (id !== null) map.setFeatureState({ source, id }, { selected: true });
    selected[source] = id;
  }

  function applyFocus(): void {
    if (!styleLoaded) return;
    const dim = (layer: string, id: number | null): void => {
      if (map.getLayer(layer)) map.setPaintProperty(layer, 'fill-opacity', (id === null ? 0 : ['case', ['==', ['id'], id], 0, pal.dimAlpha]) as never);
    };
    dim('country-dim', focus.country);
    dim('adm1-dim', focus.country !== null ? focus.s : null);
    dim('adm2-dim', focus.s !== null ? focus.d : null);
    setSelected('countries', focus.country);
    setSelected('adm1', focus.s);
    setSelected('adm2', focus.d);
    if (map.getLayer('adm2-label')) map.setPaintProperty('adm2-label', 'text-opacity', (focus.d === null ? 1 : ['case', ['==', ['id'], focus.d], 1, 0.4]) as never);
    hoverRef = null;
  }

  function applyFeatureHighlight(): void {
    if (!styleLoaded) return;
    const none: ExpressionSpecification = ['==', ['get', 'name'], NONE];
    const f = feature ?? hovered;
    const byName: ExpressionSpecification | null = f ? ['any', ['==', ['get', 'name'], f.name], ['==', ['get', 'name:en'], f.name]] : null;
    const set = (id: string, on: boolean) => { if (map.getLayer(id)) map.setFilter(id, on && byName ? byName : none); };
    const lake = !!f && f.sourceLayer === 'lakes';
    const river = !!f && f.sourceLayer === 'waterway', peak = !!f && f.sourceLayer === 'mountain_peak', label = !!f && (f.sourceLayer === 'water_name' || f.sourceLayer === 'place'), park = !!f && f.sourceLayer === 'park';
    set('hl-river', river); set('hl-river-casing', river);
    set('hl-peak', peak); set('hl-peak-casing', peak);
    set('hl-label', label); set('hl-label-casing', label);
    set('hl-park', park); set('hl-park-casing', park); set('hl-park-fill', park);
    if (map.getLayer('hl-lake-fill')) map.setFilter('hl-lake-fill', lake && byName ? byName : none);
    if (map.getLayer('hl-lake-line')) map.setFilter('hl-lake-line', lake && byName ? byName : none);
    // selected is larger than hovered (spec 6.3: 11 px against 9)
    // a city or town with no outline of ours gets a 36 px ring (spec 4.2); everything else a 9 px ring, 11 selected
    const r = feature ? (feature.sourceLayer === 'place' ? 18 : 11) : 9;
    for (const id of ['hl-peak', 'hl-peak-casing', 'hl-label', 'hl-label-casing']) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-radius', r);
    if (map.getLayer('hl-park-fill')) map.setPaintProperty('hl-park-fill', 'fill-opacity', feature ? 0.1 : 0.2);
  }

  map.on('style.load', () => {
    styleLoaded = true;
    window.clearTimeout(failTimer);
    map.setProjection({ type: 'globe' });
    if (pendingFrame && pendingFrame.token === flyToken) {
      const { c, pad } = pendingFrame;
      const z = measuredZoom(c, pad);
      map.jumpTo({ center: [c.lng, c.lat], zoom: z, pitch: 0, bearing: 0, padding: pad });
      opts.handlers.onWorldFramed?.(z);
    }
    pendingFrame = null;
    // Sky, horizon and fog by theme (spec 6.6): MapLibre's default sky vanishes on a light page and the disc read as a cut-out.
    map.setSky({
      'sky-color': pal.sky, 'horizon-color': pal.horizon, 'fog-color': pal.fog,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 2.5, 0.6, 5, 0],
      'sky-horizon-blend': 0.8, 'horizon-fog-blend': pal.mode === 'dark' ? 0.7 : 0.6,
    });
    recolourBase();
    applyLabels();
    const layers = map.getStyle().layers;
    const firstSymbol = layers.find((l) => l.type === 'symbol');
    const f = (firstSymbol?.layout as { 'text-font'?: string[] } | undefined)?.['text-font'];
    if (f) fontStack = f;
    const firstWater = layers.find((l) => l.type === 'fill' && (l as { 'source-layer'?: string })['source-layer'] === 'water');
    const vsrc = layers.find((l) => (l as { 'source-layer'?: string })['source-layer'] === 'waterway') as { source?: string } | undefined;
    vectorSource = vsrc?.source ?? 'openmaptiles';
    hitLayers = layers.filter((l) => HIT_SOURCE_LAYERS.has((l as { 'source-layer'?: string })['source-layer'] ?? '')).map((l) => l.id);
    fellBack = false;
    addRelief(firstWater?.id);
    addLayers(firstSymbol?.id, firstWater?.id, layers.find((l) => l.type !== 'background')?.id);
    // Read the layers again now that the rank-band clones and ours exist: a stale list left cities out of every hit test (review M2).
    hitLayers = [...map.getStyle().layers.filter((l) => HIT_SOURCE_LAYERS.has((l as { 'source-layer'?: string })['source-layer'] ?? '') && !l.id.startsWith('hl-')).map((l) => l.id), 'hit-peak', 'hit-water', 'lake-fill'].filter((id, i, a) => !!map.getLayer(id) && a.indexOf(id) === i);
    applyTerrain();
    applyFocus();
    applyFeatureHighlight();
    handlers.onReady?.();
    warmAndReveal();
    if (!warmPending) runQueued();
  });
  map.on('error', (ev) => {
    const e = ev as unknown as { error?: { message?: string }; sourceId?: string };
    if (!styleLoaded && !e.sourceId && !destroyed) { console.warn('[globe] style error:', e.error?.message); handlers.onFail?.(TILES_DOWN); } // the raw AJAXError text stays in the console
  });
  map.on('zoom', applyTerrain);

  // The CSS halo behind the canvas fades from 1 at zoom 0 to 0 at zoom 4 (spec 6.6), one write per frame.
  const haloHost = container.parentElement;
  let haloQueued = false;
  const syncHalo = (): void => {
    haloQueued = false;
    if (destroyed || !haloHost) return;
    haloHost.style.setProperty('--globe-halo-o', String(Math.max(0, Math.min(1, 1 - map.getZoom() / 4)).toFixed(3)));
  };
  const queueHalo = (): void => { if (!haloQueued) { haloQueued = true; requestAnimationFrame(syncHalo); } };
  map.on('zoom', queueHalo);
  map.on('load', syncHalo);

  // ---- hit testing ---------------------------------------------------------------------------------------
  function setHover(source: string | null, id: number | null): void {
    const cur = hoverRef;
    if (cur && (cur.source !== source || cur.id !== id)) { try { map.setFeatureState(cur, { hover: false }); } catch { /* source gone */ } hoverRef = null; }
    if (source && id !== null) { hoverRef = { source, id }; map.setFeatureState(hoverRef, { hover: true }); }
  }

  /** The shape under the pointer, deepest level first. Inside a drilled-in country the country itself is not a target. */
  function shapeAt(point: { x: number; y: number }): { layer: HitLayer; id: number } | null {
    const layers: string[] = [];
    if (focus.country !== null) {
      if (adm2 && focus.s !== null) layers.push('adm2-fill');
      if (adm1) layers.push('adm1-fill');
    }
    layers.push('country-fill');
    const present = layers.filter((l) => map.getLayer(l));
    if (!present.length) return null;
    for (const f of map.queryRenderedFeatures([point.x, point.y], { layers: present })) {
      const id = f.id as number;
      if (f.layer.id === 'adm2-fill') return { layer: 'adm2', id };
      if (f.layer.id === 'adm1-fill') { if (focus.d !== null && id === focus.s) continue; return { layer: 'adm1', id }; }
      if (f.layer.id === 'country-fill') { if (focus.country !== null && id === focus.country) continue; return { layer: 'country', id }; }
    }
    return null;
  }

  /**
   * Named basemap things under the pointer, ordered by class (spec 4.1): peaks and cities, then lakes and seas
   * (`water_name`), rivers, parks from zoom 5. Hit box 5 px for a mouse, 12 px for a finger.
   */
  function basemapList(point: { x: number; y: number }, touch = false): BasemapFeature[] {
    if (!hitLayers.length) return [];
    const z = map.getZoom();
    const pad = touch ? 12 : 5;
    const sl = (f: { sourceLayer?: string; layer: { id: string } }): string => (f.layer.id === 'lake-fill' ? 'lakes' : (f.sourceLayer ?? ''));
    const ranked = map.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], { layers: hitLayers })
      .filter((f) => featureName(f.properties))
      .map((f) => ({ f, r: hitRank(z, sl(f), f.properties) }))
      .filter((x): x is { f: typeof x.f; r: number } => x.r !== null);
    ranked.sort((a, b) => a.r - b.r);
    const seen = new Set<string>();
    const out: BasemapFeature[] = [];
    for (const { f: h } of ranked) {
      const name = featureName(h.properties);
      if (seen.has(`${sl(h)}:${name}`)) continue;
      seen.add(`${sl(h)}:${name}`);
      const d = describeBasemap(sl(h), h.properties);
      out.push({ sourceLayer: sl(h), kind: d.kind, name, extra: d.extra, lngLat: [0, 0], wikidata: ((h.properties.wikidata ?? h.properties.wd) as string) ?? null });
    }
    return out;
  }
  const basemapAt = (point: { x: number; y: number }, touch = false): BasemapFeature | null => basemapList(point, touch)[0] ?? null;

  const isTouch = (e: { originalEvent?: Event }) => (e.originalEvent as PointerEvent | undefined)?.pointerType === 'touch' || (e.originalEvent?.type ?? '').startsWith('touch');

  const onPin = (e: { originalEvent?: Event }) => !!(e.originalEvent?.target as Element | undefined)?.closest?.('[data-globe-pin]');

  /** Spec 4.1: below zoom 3 the shapes are the only targets; from 3 up a named point or line within the hit box beats any fill. */
  type Pick = { kind: 'feature'; f: BasemapFeature } | { kind: 'shape'; layer: HitLayer; id: number } | null;
  function pick(e: MapMouseEvent): Pick {
    if (map.getZoom() >= 3) {
      const f = basemapAt(e.point, isTouch(e));
      if (f) return { kind: 'feature', f };
    }
    const hit = shapeAt(e.point);
    return hit ? { kind: 'shape', ...hit } : null;
  }

  map.on('mousemove', (e: MapMouseEvent) => {
    if (onPin(e)) { setHover(null, null); hideTip(); return; }
    const p = pick(e);
    if (p?.kind === 'shape') {
      if (hovered) { hovered = null; applyFeatureHighlight(); }
      setHover(p.layer === 'country' ? 'countries' : p.layer, p.id);
      const info = handlers.describe?.(p.layer, p.id);
      if (info) showTip(e, info, 'shape');
      slowSpin();
      return;
    }
    setHover(null, null);
    if (!p) { if (tipOwner) hideTip(); if (hovered) { hovered = null; applyFeatureHighlight(); } return; }
    const f = p.f;
    if (hovered?.name !== f.name || hovered.sourceLayer !== f.sourceLayer) { hovered = f; applyFeatureHighlight(); }
    showTip(e, { kicker: f.kind, title: f.name, sub: `${f.extra ? `${f.extra} · ` : ''}click to select` }, 'basemap');
    slowSpin();
  });
  container.addEventListener('mouseleave', () => { setHover(null, null); hideTip(); if (hovered) { hovered = null; applyFeatureHighlight(); } });
  map.on('click', (e: MapMouseEvent) => {
    if (onPin(e)) return;
    // The release of a drag is not a click.
    if (!isClick(pressAt, e.point, dragged)) return;
    hideTip();
    const p = pick(e);
    if (p?.kind === 'shape') { handlers.onShape?.(p.layer, p.id); return; }
    if (p) { p.f.lngLat = [e.lngLat.lng, e.lngLat.lat]; handlers.onBasemap?.(p.f); } else handlers.onBackground?.();
  });

  // ---- camera --------------------------------------------------------------------------------------------
  // A grab stops the spin at once and nothing moves the camera while a pointer is down; the spin resumes after a quiet moment.
  for (const ev of ['mousedown', 'touchstart'] as const) {
    map.on(ev, (e) => { flyToken++; pointerDown = true; spinSpeed = 0; holdUntil = Infinity; dragged = false; pressAt = (e as MapMouseEvent).point ?? null; handlers.onInteract?.(); });
  }
  // What is here: a finger held 500 ms within 8 px, or a right-click. A press that opens it is not a click (spec 4.1 rules 6 and 8).
  let pressTimer = 0;
  const cancelPress = (): void => { window.clearTimeout(pressTimer); pressTimer = 0; };
  map.on('touchstart', (e) => {
    cancelPress();
    if (opts.interactive === false || (e as { points?: unknown[] }).points?.length !== 1) return;
    const { point, lngLat } = e as unknown as { point: { x: number; y: number }; lngLat: { lng: number; lat: number } };
    pressTimer = window.setTimeout(() => { pressTimer = 0; dragged = true; hideTip(); handlers.onWhatIsHere?.({ x: point.x, y: point.y, lngLat: [lngLat.lng, lngLat.lat] }); }, 500);
  });
  map.on('touchmove', (e) => { const p = (e as unknown as { point: { x: number; y: number } }).point; if (pressAt && Math.hypot(p.x - pressAt.x, p.y - pressAt.y) > 8) cancelPress(); });
  map.on('touchend', cancelPress);
  map.on('touchcancel', cancelPress);
  map.on('contextmenu', (e: MapMouseEvent) => { e.preventDefault(); if (opts.interactive !== false) handlers.onWhatIsHere?.({ x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat] }); });
  map.on('wheel', () => { flyToken++; hold(SPIN_AFTER_GESTURE_MS); handlers.onInteract?.(); });
  map.on('dragstart', () => { dragged = true; flyToken++; handlers.onInteract?.(); });
  const release = (): void => { if (!pointerDown) return; pointerDown = false; holdUntil = performance.now() + SPIN_AFTER_GESTURE_MS; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  const onEsc = (ev: KeyboardEvent): void => { if (ev.key === 'Escape') holdUntil = 0; };
  window.addEventListener('keydown', onEsc);
  map.on('moveend', (e) => {
    const ev = e as { originalEvent?: unknown; spin?: boolean; ours?: boolean };
    if (ev.spin || container.dataset.warming === 'true') return; // the shader warm-up borrows the camera; it is not the visitor's view
    handlers.onCamera?.(camera(), !!ev.originalEvent);
    // Pitch only shows above the terrain gate: below it a tilted camera eases back to flat in 300 ms (spec 5.1). Never with a pointer down.
    if (!pointerDown && map.getPitch() > 0.5 && map.getZoom() < PITCH_MIN_ZOOM) map.easeTo({ pitch: 0, duration: reduced() ? 0 : 300 });
  });

  const reduced = (): boolean => prefersReducedMotion();
  const camera = (): Camera => {
    const c = map.getCenter();
    const pitch = map.getPitch(), bearing = map.getBearing();
    return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), ...(pitch > 0.5 ? { pitch } : {}), ...(Math.abs(bearing) > 0.5 ? { bearing } : {}) };
  };

  /**
   * One flight per step (spec 5.3): the target pitch is inside the flight, the subject sits in the upper-middle of the free area
   * (`offset`), and the duration comes from MapLibre's distance model capped by the plan. Nothing waits for `moveend` to start a
   * second move, which is the see-saw the owner felt. Reduced motion jumps with the target pitch at once.
   */
  function fly(center: Pt, zoom: number, plan: FlightPlan, keepPadding = false): void {
    const token = ++flyToken;
    void token;
    const pitch = pitchAt(plan.pitch, zoom);
    const pad = keepPadding ? padding : ZERO_PAD;
    const up = shiftPx(container.clientHeight - padding.top - padding.bottom, plan.shift);
    if (reduced()) {
      map.jumpTo({ center, zoom, pitch, padding: pad });
      if (up) map.panBy([0, up], { duration: 0 });
      applyTerrain();
      return;
    }
    const here = map.getCenter();
    const km = distanceKm({ lng: here.lng, lat: here.lat }, { lng: center[0], lat: center[1] });
    map.flyTo({ center, zoom, pitch, padding: pad, offset: [0, -up], speed: plan.speed, curve: plan.curve, duration: flightDuration(zoom - map.getZoom(), km, plan), essential: false });
  }

  /** Markers behind the globe or off the canvas are not drawn, not focusable and not in the way of a tap. */
  let cullQueued = false;
  function cullMarkers(): void {
    cullQueued = false;
    if (destroyed) return;
    const w = container.clientWidth, h = container.clientHeight;
    const tr = (map as unknown as { transform?: { isLocationOccluded?(l: unknown): boolean } }).transform;
    let changed = false;
    for (const m of markers.values()) {
      const ll = m.marker.getLngLat();
      const pt = map.project(ll);
      const hidden = pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20 || !!tr?.isLocationOccluded?.(ll);
      const v = hidden ? 'hidden' : '';
      if (m.el.style.visibility !== v) { m.el.style.visibility = v; changed = true; }
    }
    if (changed) container.dispatchEvent(new CustomEvent('globe-culled')); // the cover's roving tab stop moves to a pin that can take focus
  }
  const queueCull = (): void => { if (!cullQueued) { cullQueued = true; requestAnimationFrame(cullMarkers); } };
  map.on('move', queueCull);
  map.on('resize', queueCull);
  map.on('idle', queueCull);

  /**
   * A fly asked for before the style has loaded (a deep link such as /globe/it/ calls it as soon as the engine exists).
   * The shader warm-up stops every move when the style loads, which used to cancel it and leave the camera at the world
   * frame, so the move waits here and runs once the warm-up has put the camera back.
   */
  let queuedMove: (() => void) | null = null;
  const runQueued = (): void => { const q = queuedMove; queuedMove = null; q?.(); };
  let pendingFrame: { c: { lng: number; lat: number; zoom: number; diameter?: number }; pad: Padding; token: number } | null = null;
  /**
   * MapLibre's globe size depends on its padding and viewport, so one silent measure-and-correct pass lands the disc at the
   * wanted diameter: jump there, read the rendered radius off a point 90 degrees from the centre, restore the camera.
   */
  function measuredZoom(c: { lng: number; lat: number; zoom: number; diameter?: number }, pad: Padding): number {
    const from = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
    map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: 0, bearing: 0, padding: pad });
    const o = map.project([c.lng, c.lat]);
    const limb = map.project([c.lng + 180, Math.min(89, 90 - c.lat)]);
    const measured = 2 * Math.hypot(limb.x - o.x, limb.y - o.y);
    map.jumpTo(from);
    return measured > 20 && c.diameter ? c.zoom + Math.log2(c.diameter / measured) : c.zoom;
  }

  /**
   * Shader warm-up and the reveal (spec 8.3, 1.14). The first fly-in used to hitch for 250 to 430 ms while the driver linked
   * the programs of the zoomed-in layers. While the canvas is still transparent, draw one zoomed-in frame, put the camera
   * back, and only then tell the page the world has painted (`onFirstIdle`): the canvas fades in and the pins mount. The warm
   * never calls `map.stop()` with a pointer down (5.1), and gives up after 1.8 s so a slow network cannot hold the globe back.
   */
  let warmed = false;
  let warmPending = false;
  let firstIdleSent = false;
  function warmAndReveal(): void {
    const reveal = (): void => { if (firstIdleSent || destroyed) return; firstIdleSent = true; handlers.onFirstIdle?.(); };
    if (warmed || opts.interactive === false || !map.getCanvas()) { map.once('idle', reveal); return; }
    warmed = true;
    warmPending = true;
    holdUntil = Infinity; // nothing may move the camera while we borrow it
    const release = (): void => { if (holdUntil === Infinity && !pointerDown) holdUntil = performance.now() + 500; };
    if (!pointerDown) map.stop();
    const token = flyToken;
    const from = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
    container.dataset.warming = 'true';
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      warmPending = false;
      if (!destroyed) {
        if (token === flyToken) map.jumpTo(from);
        delete container.dataset.warming;
        map.once('idle', reveal);
        window.setTimeout(reveal, 1200); // tiles that never settle must not hold the globe back
        release();
        runQueued();
      }
    };
    const timer = window.setTimeout(finish, 1800);
    map.jumpTo({ center: [12.5, 43], zoom: 6.5, pitch: 0, bearing: 0, padding: ZERO_PAD });
    map.once('idle', finish);
  }

  const engine: GlobeEngine = {
    map,
    setStyle(next) {
      if (next === styleKey) return;
      styleKey = next;
      pal = readGlobePalette(container, modeOf(next));
      styleLoaded = false;
      hoverRef = null;
      hideTip();
      map.setStyle(STYLE_URLS[next], { diff: false });
    },
    setTerrain(on, ex) {
      terrainOn = on; exaggeration = ex;
      if (!on) map.easeTo({ pitch: 0, duration: reduced() ? 0 : 500 });
      applyTerrain();
    },
    setAdmin(level, fc, render) {
      if (level === 'adm1') adm1 = fc; else adm2 = fc;
      admData[level] = dataOf(level, fc, render);
      const src = map.getSource(level) as GeoJSONSource | undefined;
      src?.setData(admData[level] as never);
      // Feature state belongs to the source and survives setData, so a new set of shapes starts clean (no loop over features).
      if (styleLoaded && map.getSource(level)) { map.removeFeatureState({ source: level }); selected[level] = null; }
      applyFocus();
    },
    setCountries(fc, render) {
      opts.countries = fc;
      countriesData = dataOf('countries', fc, render);
      (map.getSource('countries') as GeoJSONSource | undefined)?.setData(countriesData as never);
      applyFocus();
    },
    setFocus(f) { focus = f; setHover(null, null); applyFocus(); },
    setFeature(f) { feature = f; applyFeatureHighlight(); },
    setPadding(p) { padding = p; },
    setLakes(render) {
      lakesData = dataOf('lakes', null, render);
      (map.getSource('lakes') as GeoJSONSource | undefined)?.setData(lakesData as never);
    },
    afterMove(cb) {
      let done = false;
      const run = (): void => { if (done || destroyed) return; done = true; cb(); };
      map.once('moveend', run);
      window.setTimeout(run, 3500);
    },
    setCityArea(f) {
      cityArea = f;
      (map.getSource('city') as GeoJSONSource | undefined)?.setData((f ? { type: 'FeatureCollection', features: [f] } : EMPTY) as never);
    },
    setSpin(enabled, world) {
      // Back at the world level the spin waits 2 s before it ramps up again (spec 5.2).
      if (world && !worldView) { holdUntil = Math.max(holdUntil === Infinity ? 0 : holdUntil, performance.now() + SPIN_AFTER_GESTURE_MS); spinSpeed = 0; }
      spinEnabled = enabled; worldView = world;
    },
    setActive(on) {
      loopActive = on;
      cancelAnimationFrame(raf);
      if (on && !destroyed) raf = requestAnimationFrame(tick);
      else if (!on && map.isMoving() && !pointerDown) map.stop(); // an ease already running is the spin's own
    },
    setMinZoom(z) { map.setMinZoom(Math.max(0, z)); },
    frameWorld(c, pad, animate) {
      queuedMove = null;
      const token = ++flyToken;
      let zoom = c.zoom;
      // The globe projection only exists once the style has loaded; measuring before that reads a flat map. Until then use
      // the formula and queue the exact frame for style.load (unless the camera is moved by something else first).
      if (c.diameter) {
        if (styleLoaded) zoom = measuredZoom(c, pad);
        else pendingFrame = { c, pad, token };
      }
      zoom = Math.max(map.getMinZoom(), zoom);
      const cam = { center: [c.lng, c.lat] as [number, number], zoom, pitch: 0, bearing: 0, padding: pad };
      // Reset view and stepping out to the world are one flight too (spec 5.3), at the same speed as every other.
      const plan = flightPlan('country', { terrain: false });
      const here = map.getCenter();
      const km = distanceKm({ lng: here.lng, lat: here.lat }, { lng: cam.center[0], lat: cam.center[1] });
      if (!animate || reduced()) map.jumpTo(cam); else map.flyTo({ ...cam, speed: plan.speed, curve: plan.curve, duration: flightDuration(zoom - map.getZoom(), km, plan), essential: false });
      return zoom;
    },
    flyToBox(b, o) {
      if (!styleLoaded || warmPending) { queuedMove = () => engine.flyToBox(b, o); return; }
      const free = { w: container.clientWidth - padding.left - padding.right, h: container.clientHeight - padding.top - padding.bottom };
      const z = fitZoom(b, free.w, free.h, o.wide ? WIDE_MAX : (o.maxZoom ?? 8));
      // A country wider than 170 degrees stays on the globe at zoom 2.6 to 3.2 and does not tilt.
      fly(boxCentre(b), o.wide ? wideZoom(z) : z, o.wide ? { ...o.plan, pitch: 0, shift: 0 } : o.plan, true);
    },
    flyToPoint(p, zoom, o) {
      if (!styleLoaded || warmPending) { queuedMove = () => engine.flyToPoint(p, zoom, o); return; }
      fly(p, zoom, o.plan, true);
    },
    setTooltipEnabled(on) { tipsOff = !on; if (!on) hideTip(); },
    setDiscs(list) {
      discs = list;
      (map.getSource('discs') as GeoJSONSource | undefined)?.setData(discData() as never);
    },
    jumpTo(c) { queuedMove = null; flyToken++; map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: c.pitch ?? 0, bearing: c.bearing ?? 0, padding: ZERO_PAD }); },
    camera,
    zoomBy(d) { flyToken++; if (reduced()) map.jumpTo({ zoom: map.getZoom() + d }); else map.easeTo({ zoom: map.getZoom() + d, duration: 200 }); },
    syncMarkers(ns, specs) {
      const keep = new Set(specs.map((s) => `${ns}:${s.key}`));
      for (const [k, m] of markers) if (k.startsWith(`${ns}:`) && !keep.has(k)) { m.marker.remove(); markers.delete(k); }
      const out = new Map<string, HTMLElement>();
      for (const s of specs) {
        const id = `${ns}:${s.key}`;
        const sig = `${s.lng},${s.lat},${s.anchor ?? 'center'},${s.offset?.join(',') ?? ''}`;
        const have = markers.get(id);
        if (have && have.sig === sig) { out.set(s.key, have.el); continue; }
        have?.marker.remove();
        const el = have?.el ?? document.createElement('div');
        if (s.className) el.className = s.className;
        const marker = new ml.Marker({ element: el, opacityWhenCovered: '0', anchor: s.anchor ?? 'center', offset: s.offset ?? [0, 0] }).setLngLat([s.lng, s.lat]).addTo(map);
        markers.set(id, { marker, el, sig });
        out.set(s.key, el);
      }
      queueCull();
      return out;
    },
    isTerrainOn: () => !!map.getTerrain(),
    featuresAt: (pt, touch = false) => basemapList(pt, touch).slice(0, 5),
    elevationAt(ll) { const e = map.queryTerrainElevation(ll); return e === null || e === undefined ? null : Math.round(e / 10) * 10; },
    project(lng, lat) {
      const pt = map.project([lng, lat]);
      const tr = (map as unknown as { transform?: { isLocationOccluded?(l: unknown): boolean } }).transform;
      const w = container.clientWidth, h = container.clientHeight;
      if (pt.x < -60 || pt.y < -60 || pt.x > w + 60 || pt.y > h + 60 || tr?.isLocationOccluded?.(new ml.LngLat(lng, lat))) return null;
      return { x: pt.x, y: pt.y };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(failTimer);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onEsc);
      rm?.removeEventListener('change', restartLoop);
      for (const m of markers.values()) m.marker.remove();
      markers.clear();
      for (const u of Object.values(blobs)) URL.revokeObjectURL(u);
      tip.remove();
      map.remove();
    },
  };

  // The spin: one revolution in 90 s as chained one-second linear eases (MapLibre's own pattern). A user gesture interrupts an
  // ease once through the normal path; no jumpTo or stop() is called per frame, so drags and clicks keep their handler state.
  const canSpin = (): boolean => spinAllowed({ active: loopActive, enabled: spinEnabled, world: worldView, reduced: reduced(), styleLoaded, zoom: map.getZoom(), pointerDown, destroyed, hidden: document.hidden });
  // The speed is a multiplier: 0 the moment a gesture starts, 1 at rest, 0.25 while a country or feature is hovered and for 20 s after,
  // and it moves toward its target by half a step each step so a start or a stop is never a jump (spec 5.2).
  function spinOnce(): void {
    if (!canSpin() || performance.now() < holdUntil || map.isMoving()) return;
    spinSpeed = spinSpeedToward(spinSpeed, performance.now() < hoverSlowUntil ? SPIN_HOVER_SPEED : 1);
    const c = map.getCenter();
    map.easeTo({ center: [c.lng + spinStepDeg(SPIN_EASE_MS) * spinSpeed, c.lat], duration: SPIN_EASE_MS, easing: (t) => t, essential: false }, { spin: true });
  }
  map.on('moveend', (e) => { if ((e as { spin?: boolean }).spin) spinOnce(); });
  // Under reduced motion nothing spins, so the frame loop stops altogether instead of waking 60 times a second to do nothing;
  // it starts again if the setting changes.
  const tick = (): void => {
    if (reduced()) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    spinOnce();
  };
  const rm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const restartLoop = (): void => { if (!destroyed && loopActive && !raf) raf = requestAnimationFrame(tick); };
  rm?.addEventListener('change', restartLoop);
  raf = reduced() ? 0 : requestAnimationFrame(tick);
  return engine;
}
