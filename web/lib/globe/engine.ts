import type { ExpressionSpecification, GeoJSONSource, Map as MLMap, Marker, MapMouseEvent } from 'maplibre-gl';
import { prefersReducedMotion } from '@/lib/map/reduced-motion';
import { normaliseColour, readPalette, type MapPalette } from '@/lib/map/palette';
import { STYLE_URLS, TERRAIN_FALLBACK, TERRAIN_MIN_ZOOM, TERRAIN_URL, modeOf, type StyleKey } from '@/lib/map/maplibre/styles';
import { centreOf, spanLon, type Bbox, type FeatColl, type Pt } from './geometry';
import { FLY_MS, SPIN_MAX_ZOOM, TILT_MS, initialSpin, stepSpin, touchSpin, type SpinState } from './motion';
import type { Camera } from './types';

type ML = typeof import('maplibre-gl');

export interface HoverInfo { kicker: string; title: string; sub?: string }
export type HitLayer = 'country' | 'adm1' | 'adm2';
export interface BasemapFeature { sourceLayer: string; kind: string; name: string; extra: string; lngLat: Pt; wikidata: string | null }

export interface Focus { country: number | null; s: number | null; d: number | null }
export interface Padding { top: number; right: number; bottom: number; left: number }

export interface GlobeHandlers {
  onReady?(): void;
  onFail?(reason: string): void;
  onShape?(layer: HitLayer, id: number): void;
  onBasemap?(f: BasemapFeature | null): void;
  onBackground?(): void;
  describe?(layer: HitLayer, id: number): HoverInfo | null;
  /** The camera came to rest. `user` is true for a drag, scroll or pinch, false for a fly or jump we started. */
  onCamera?(c: Camera, user: boolean): void;
  onInteract?(): void;
}

export interface MarkerSpec {
  key: string;
  lng: number;
  lat: number;
  anchor?: 'center' | 'left' | 'right' | 'top' | 'bottom';
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

export interface FlyOptions { maxZoom?: number; tilt?: boolean }

export interface GlobeEngine {
  readonly map: MLMap;
  setStyle(style: StyleKey): void;
  setTerrain(on: boolean, exaggeration: number): void;
  setAdmin(level: 'adm1' | 'adm2', fc: FeatColl | null): void;
  setFocus(f: Focus): void;
  setFeature(f: BasemapFeature | null): void;
  setPadding(p: Padding): void;
  setSpin(enabled: boolean, worldView: boolean): void;
  flyToBox(b: Bbox, o?: FlyOptions): void;
  flyToPoint(p: Pt, zoom: number, o?: { tilt?: boolean }): void;
  /** Snaps to a camera with no animation (a restored `?c=` or reduced motion). */
  jumpTo(c: Camera): void;
  camera(): Camera;
  zoomBy(d: number): void;
  /** Keeps the markers of one namespace in step with `specs` and returns their elements by key, for React to portal into. */
  syncMarkers(ns: string, specs: MarkerSpec[]): Map<string, HTMLElement>;
  isTerrainOn(): boolean;
  destroy(): void;
}

// Peaks, rivers, seas, parks and towns stay in the style: they are what the visitor can hover and pick.
const HIDE_LABEL_LAYER = /village|suburb|hamlet|neighbo|quarter|label_other|poi|housenumber|aerodrome|airport|ferry/i;
const HIDE_SOURCE_LAYERS = new Set(['poi', 'housenumber', 'aerodrome_label', 'transportation_name']);
const HIT_SOURCE_LAYERS = new Set(['waterway', 'water_name', 'mountain_peak', 'park', 'place']);
const NONE = '\u0000';

const featureName = (p: Record<string, unknown>): string => String(p['name:en'] || p.name_en || p.name || '');

function describeBasemap(sourceLayer: string, p: Record<string, unknown>): { kind: string; extra: string } {
  const cls = String(p.class || '').replace(/_/g, ' ');
  if (sourceLayer === 'waterway') return { kind: cls || 'river', extra: p.intermittent ? 'intermittent' : '' };
  if (sourceLayer === 'water_name') return { kind: cls || 'water', extra: '' };
  if (sourceLayer === 'mountain_peak') return { kind: cls || 'peak', extra: p.ele ? `${Number(p.ele).toLocaleString('en-CA')} m` : '' };
  if (sourceLayer === 'park') return { kind: cls || 'park', extra: '' };
  return { kind: cls || 'place', extra: p.capital === 2 ? 'capital' : '' };
}

/** Reads a colour token off the container as a string MapLibre parses. */
function tokenColour(el: Element, name: string, fallback: string): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  return normaliseColour(raw || fallback, fallback);
}

export function createGlobe(ml: ML, opts: GlobeEngineOptions): GlobeEngine {
  const { container, handlers } = opts;
  let styleKey = opts.style;
  let terrainOn = opts.terrain;
  let exaggeration = opts.exaggeration;
  let palette: MapPalette = readPalette(container, modeOf(styleKey));
  let accent = tokenColour(container, '--accent', 'rgb(224 154 28)');
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
  let padding: Padding = { top: 80, right: 80, bottom: 80, left: 80 };
  let flyToken = 0;
  let spin: SpinState = initialSpin();
  let spinEnabled = false;
  let worldView = true;
  let raf = 0;
  let last = performance.now();
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
  map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-right');
  map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-right');

  const tip = document.createElement('div');
  tip.className = opts.tooltipClass ?? 'globe-tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  container.appendChild(tip);

  const failTimer = window.setTimeout(() => { if (!styleLoaded && !destroyed) handlers.onFail?.('The map style did not load.'); }, 15000);

  // ---- tooltip -------------------------------------------------------------------------------------------
  function showTip(e: { point: { x: number; y: number } }, info: HoverInfo, owner: string): void {
    tip.replaceChildren();
    const k = document.createElement('div'); k.className = 'globe-tip-k'; k.textContent = info.kicker;
    const t = document.createElement('div'); t.className = 'globe-tip-t'; t.textContent = info.title;
    tip.append(k, t);
    if (info.sub) { const s = document.createElement('div'); s.className = 'globe-tip-s'; s.textContent = info.sub; tip.append(s); }
    tip.hidden = false;
    const w = container.clientWidth, tw = tip.offsetWidth;
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
  function recolourBase(): void {
    const style = map.getStyle();
    if (!style?.layers) return;
    const set = (id: string, kind: 'paint' | 'layout', prop: string, v: unknown) => {
      try { if (kind === 'paint') map.setPaintProperty(id, prop as never, v as never); else map.setLayoutProperty(id, prop as never, v as never); } catch { /* property not on this layer */ }
    };
    for (const l of style.layers) {
      const sl = (l as { 'source-layer'?: string })['source-layer'] ?? '';
      if (l.type === 'background') set(l.id, 'paint', 'background-color', palette.land);
      else if (l.type === 'fill') {
        set(l.id, 'paint', 'fill-color', sl === 'water' ? palette.water : sl === 'building' ? palette.high : palette.land);
        set(l.id, 'paint', 'fill-outline-color', palette.land);
      } else if (l.type === 'line') {
        if (sl === 'waterway') set(l.id, 'paint', 'line-color', palette.water);
        else if (sl === 'boundary') set(l.id, 'paint', 'line-color', palette.border);
        else if (sl === 'transportation') set(l.id, 'paint', 'line-color', palette.contour);
      } else if (l.type === 'symbol') {
        // Our own pins carry the world view; keep only large place names and water names from the base.
        if (HIDE_SOURCE_LAYERS.has(sl) || HIDE_LABEL_LAYER.test(l.id)) { set(l.id, 'layout', 'visibility', 'none'); continue; }
        set(l.id, 'paint', 'text-color', palette.label);
        set(l.id, 'paint', 'text-halo-color', palette.halo);
        set(l.id, 'paint', 'text-halo-width', 1.5);
      }
    }
  }

  function addHills(beforeId: string | undefined): void {
    if (map.getLayer('hills')) return;
    map.addLayer({
      id: 'hills', type: 'hillshade', source: 'dem-hill',
      paint: {
        // Faint on the globe where tiles meet in seams, full relief once a country fills the view.
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 0, 0.08, 2.5, 0.2, 5, 0.42, 8, 0.55],
        'hillshade-shadow-color': palette.shade, 'hillshade-highlight-color': palette.high, 'hillshade-accent-color': palette.shade,
        'hillshade-illumination-direction': 315,
      },
    }, beforeId);
  }

  function applyTerrain(): void {
    if (!map.getSource('dem')) return;
    const want = terrainOn && map.getZoom() >= TERRAIN_MIN_ZOOM;
    const cur = map.getTerrain();
    if (want && (!cur || cur.exaggeration !== exaggeration)) map.setTerrain({ source: 'dem', exaggeration });
    else if (!want && cur) map.setTerrain(null);
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

  function addLayers(firstSymbolId: string | undefined, firstWaterId: string | undefined): void {
    const land = palette.land;
    map.addSource('countries', { type: 'geojson', data: opts.countries as never });
    map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries', paint: { 'fill-color': accent, 'fill-opacity': ['case', sel('selected'), 0, sel('hover'), 0.3, 0] } }, firstWaterId);
    map.addLayer({ id: 'country-dim', type: 'fill', source: 'countries', paint: { 'fill-color': land, 'fill-opacity': ['case', sel('dim'), 0.55, 0] } }, firstSymbolId);
    map.addLayer({ id: 'country-line', type: 'line', source: 'countries', paint: { 'line-color': accent, 'line-width': ['case', sel('selected'), 2, sel('hover'), 1.4, 0], 'line-opacity': 0.95 } }, firstSymbolId);

    map.addSource('adm1', { type: 'geojson', data: (adm1 ?? EMPTY) as never });
    map.addLayer({ id: 'adm1-fill', type: 'fill', source: 'adm1', paint: { 'fill-color': ['case', sel('hover'), accent, palette.ink], 'fill-opacity': ['case', sel('selected'), 0, sel('dim'), 0.02, sel('hover'), 0.28, 0.06] } }, firstSymbolId);
    map.addLayer({ id: 'adm1-line', type: 'line', source: 'adm1', paint: { 'line-color': ['case', sel('selected'), accent, palette.border], 'line-width': ['case', sel('selected'), 2, sel('hover'), 1.6, 0.8], 'line-opacity': ['case', sel('dim'), 0.3, 0.9] } }, firstSymbolId);

    map.addSource('adm2', { type: 'geojson', data: (adm2 ?? EMPTY) as never });
    map.addLayer({ id: 'adm2-fill', type: 'fill', source: 'adm2', paint: { 'fill-color': ['case', sel('hover'), accent, palette.ink], 'fill-opacity': ['case', sel('selected'), 0, sel('dim'), 0.02, sel('hover'), 0.3, 0.05] } }, firstSymbolId);
    map.addLayer({ id: 'adm2-line', type: 'line', source: 'adm2', paint: { 'line-color': ['case', sel('selected'), accent, palette.border], 'line-width': ['case', sel('selected'), 2, 0.9], 'line-opacity': ['case', sel('dim'), 0.25, 0.85] } }, firstSymbolId);
    map.addLayer({
      id: 'adm2-label', type: 'symbol', source: 'adm2', minzoom: 6,
      layout: { 'text-field': ['get', 'name'], 'text-font': fontStack, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 13], 'text-padding': 6 },
      paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.4, 'text-opacity': ['case', sel('dim'), 0.3, 1] },
    });

    // Named basemap things (rivers, seas, peaks, parks, towns) can be hovered and picked; the pick is outlined here.
    const none: ExpressionSpecification = ['==', ['get', 'name'], NONE];
    map.addLayer({ id: 'hl-river', type: 'line', source: vectorSource, 'source-layer': 'waterway', filter: none, paint: { 'line-color': accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.2, 10, 5], 'line-opacity': 0.9 } }, firstSymbolId);
    map.addLayer({ id: 'hl-peak', type: 'circle', source: vectorSource, 'source-layer': 'mountain_peak', filter: none, paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': accent, 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'hl-label', type: 'circle', source: vectorSource, 'source-layer': 'water_name', filter: none, paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': accent, 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'hl-park', type: 'line', source: vectorSource, 'source-layer': 'park', filter: none, paint: { 'line-color': accent, 'line-width': 2.5 } }, firstSymbolId);
  }

  function applyFocus(): void {
    if (!styleLoaded) return;
    const touch = (source: string, fc: FeatColl | null, f: (id: number) => Record<string, boolean>) => {
      if (!fc || !map.getSource(source)) return;
      fc.features.forEach((x) => map.setFeatureState({ source, id: x.id as number }, f(x.id as number)));
    };
    touch('countries', opts.countries, (id) => ({ dim: focus.country !== null && id !== focus.country, selected: id === focus.country, hover: false }));
    touch('adm1', adm1, (id) => ({ selected: focus.s === id, dim: focus.s !== null && id !== focus.s, hover: false }));
    touch('adm2', adm2, (id) => ({ selected: focus.d === id, dim: focus.d !== null && id !== focus.d, hover: false }));
    hoverRef = null;
  }

  function applyFeatureHighlight(): void {
    if (!styleLoaded) return;
    const none: ExpressionSpecification = ['==', ['get', 'name'], NONE];
    const f = feature ?? hovered;
    const byName: ExpressionSpecification | null = f ? ['any', ['==', ['get', 'name'], f.name], ['==', ['get', 'name:en'], f.name]] : null;
    const set = (id: string, on: boolean) => { if (map.getLayer(id)) map.setFilter(id, on && byName ? byName : none); };
    set('hl-river', !!f && f.sourceLayer === 'waterway');
    set('hl-peak', !!f && f.sourceLayer === 'mountain_peak');
    set('hl-label', !!f && (f.sourceLayer === 'water_name' || f.sourceLayer === 'place'));
    set('hl-park', !!f && f.sourceLayer === 'park');
  }

  map.on('style.load', () => {
    styleLoaded = true;
    window.clearTimeout(failTimer);
    map.setProjection({ type: 'globe' });
    map.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 2.5, 0.35, 5, 0] });
    recolourBase();
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
    addLayers(firstSymbol?.id, firstWater?.id);
    applyTerrain();
    applyFocus();
    applyFeatureHighlight();
    handlers.onReady?.();
  });
  map.on('error', (ev) => {
    const e = ev as unknown as { error?: { message?: string }; sourceId?: string };
    if (!styleLoaded && !e.sourceId && !destroyed) handlers.onFail?.(e.error?.message ?? 'The map style failed to load.');
  });
  map.on('zoomend', applyTerrain);

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

  function basemapAt(point: { x: number; y: number }): BasemapFeature | null {
    if (!hitLayers.length) return null;
    const pad = 5;
    const hits = map.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], { layers: hitLayers }).filter((f) => featureName(f.properties));
    if (!hits.length) return null;
    const order: Record<string, number> = { mountain_peak: 0, place: 1, water_name: 2, waterway: 3, park: 4 };
    hits.sort((a, b) => (order[a.sourceLayer ?? ''] ?? 9) - (order[b.sourceLayer ?? ''] ?? 9));
    const h = hits[0];
    const d = describeBasemap(h.sourceLayer ?? '', h.properties);
    return { sourceLayer: h.sourceLayer ?? '', kind: d.kind, name: featureName(h.properties), extra: d.extra, lngLat: [0, 0], wikidata: (h.properties.wikidata as string) ?? null };
  }

  const onPin = (e: { originalEvent?: Event }) => !!(e.originalEvent?.target as Element | undefined)?.closest?.('[data-globe-pin]');

  map.on('mousemove', (e: MapMouseEvent) => {
    if (onPin(e)) { setHover(null, null); hideTip(); return; }
    const hit = shapeAt(e.point);
    if (hit) {
      const src = hit.layer === 'country' ? 'countries' : hit.layer;
      setHover(src, hit.id);
      const info = handlers.describe?.(hit.layer, hit.id);
      if (info) showTip(e, info, 'shape');
      spin = touchSpin(spin, performance.now());
      return;
    }
    setHover(null, null);
    const f = basemapAt(e.point);
    if (!f) { if (tipOwner) hideTip(); if (hovered) { hovered = null; applyFeatureHighlight(); } return; }
    if (hovered?.name !== f.name || hovered.sourceLayer !== f.sourceLayer) { hovered = f; applyFeatureHighlight(); }
    showTip(e, { kicker: f.kind, title: f.name, sub: `${f.extra ? `${f.extra} · ` : ''}click to select` }, 'basemap');
  });
  container.addEventListener('mouseleave', () => { setHover(null, null); hideTip(); if (hovered) { hovered = null; applyFeatureHighlight(); } });
  map.on('click', (e: MapMouseEvent) => {
    if (onPin(e)) return;
    const hit = shapeAt(e.point);
    if (hit) { handlers.onShape?.(hit.layer, hit.id); return; }
    const f = basemapAt(e.point);
    if (f) { f.lngLat = [e.lngLat.lng, e.lngLat.lat]; handlers.onBasemap?.(f); } else handlers.onBackground?.();
  });

  // ---- camera --------------------------------------------------------------------------------------------
  for (const ev of ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const) {
    map.on(ev, () => { flyToken++; spin = touchSpin(spin, performance.now()); handlers.onInteract?.(); });
  }
  map.on('moveend', (e) => {
    const ev = e as { originalEvent?: unknown; spin?: boolean; ours?: boolean };
    if (ev.spin) return;
    const c = map.getCenter();
    handlers.onCamera?.({ lng: c.lng, lat: c.lat, zoom: map.getZoom() }, !!ev.originalEvent);
  });

  const reduced = (): boolean => prefersReducedMotion();
  const camera = (): Camera => { const c = map.getCenter(); return { lng: c.lng, lat: c.lat, zoom: map.getZoom() }; };

  function tiltAfter(token: number, tilt: boolean): void {
    if (!tilt || !terrainOn || reduced()) return;
    map.once('moveend', () => {
      if (token !== flyToken || destroyed || map.getZoom() < TERRAIN_MIN_ZOOM) return;
      map.easeTo({ pitch: 45, duration: TILT_MS });
    });
  }

  const engine: GlobeEngine = {
    map,
    setStyle(next) {
      if (next === styleKey) return;
      styleKey = next;
      palette = readPalette(container, modeOf(next));
      accent = tokenColour(container, '--accent', accent);
      styleLoaded = false;
      hoverRef = null;
      hideTip();
      map.setStyle(STYLE_URLS[next], { diff: false });
    },
    setTerrain(on, ex) {
      terrainOn = on; exaggeration = ex;
      if (!on) map.easeTo({ pitch: 0, duration: reduced() ? 0 : TILT_MS });
      applyTerrain();
    },
    setAdmin(level, fc) {
      if (level === 'adm1') adm1 = fc; else adm2 = fc;
      const src = map.getSource(level) as GeoJSONSource | undefined;
      src?.setData((fc ?? EMPTY) as never);
      if (fc && styleLoaded) fc.features.forEach((x) => map.setFeatureState({ source: level, id: x.id as number }, { selected: false, dim: false, hover: false }));
      applyFocus();
    },
    setFocus(f) { focus = f; setHover(null, null); applyFocus(); },
    setFeature(f) { feature = f; applyFeatureHighlight(); },
    setPadding(p) { padding = p; },
    setSpin(enabled, world) { spinEnabled = enabled; worldView = world; },
    flyToBox(b, o = {}) {
      const token = ++flyToken;
      const tilt = o.tilt !== false;
      if (spanLon(b) > 170) {
        const c = centreOf(b);
        if (reduced()) map.jumpTo({ center: c, zoom: 2.6, pitch: 0, bearing: 0 });
        else map.flyTo({ center: c, zoom: 2.6, pitch: 0, bearing: 0, duration: FLY_MS, essential: false });
        return;
      }
      const cam = map.cameraForBounds([b[0], b[1]], { padding, maxZoom: o.maxZoom ?? 8 });
      if (!cam?.center) return;
      const center = cam.center as { lng: number; lat: number };
      const zoom = cam.zoom ?? 5;
      if (reduced()) { map.jumpTo({ center, zoom, pitch: 0, bearing: 0 }); return; }
      map.flyTo({ center, zoom, pitch: 0, bearing: 0, duration: FLY_MS, essential: false });
      tiltAfter(token, tilt && zoom >= TERRAIN_MIN_ZOOM);
    },
    flyToPoint(p, zoom, o = {}) {
      const token = ++flyToken;
      if (reduced()) { map.jumpTo({ center: p, zoom }); return; }
      map.flyTo({ center: p, zoom, pitch: 0, bearing: 0, duration: FLY_MS, essential: false, padding });
      tiltAfter(token, !!o.tilt && zoom >= TERRAIN_MIN_ZOOM);
    },
    jumpTo(c) { flyToken++; map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom }); },
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
        const marker = new ml.Marker({ element: el, anchor: s.anchor ?? 'center', offset: s.offset ?? [0, 0] }).setLngLat([s.lng, s.lat]).addTo(map);
        markers.set(id, { marker, el, sig });
        out.set(s.key, el);
      }
      return out;
    },
    isTerrainOn: () => !!map.getTerrain(),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(failTimer);
      for (const m of markers.values()) m.marker.remove();
      markers.clear();
      tip.remove();
      map.remove();
    },
  };

  // The spin: one revolution in 90 s, decaying over 400 ms on touch, resuming after 20 s idle (patterns 6).
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(50, now - last);
    last = now;
    if (destroyed || document.hidden) return;
    const active = spinEnabled && worldView && !reduced() && styleLoaded && map.getZoom() < SPIN_MAX_ZOOM && !map.isMoving();
    const next = stepSpin(spin, dt, now, active);
    spin = next.state;
    if (next.dLng && active) {
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng + next.dLng, c.lat] }, { spin: true });
    }
  };
  raf = requestAnimationFrame(tick);
  return engine;
}
