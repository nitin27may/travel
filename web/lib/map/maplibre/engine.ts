import type { ExpressionSpecification, GeoJSONSource, LngLatBoundsLike, Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl';
import { boundsOf, distanceKm, fitPoints, flyDuration, groupPins, lineFeatures, type PinGroup } from '../geo';
import { prefersReducedMotion } from '../reduced-motion';
import { readPalette, type MapPalette } from '../palette';
import type { CameraState, FlyTarget, LngLat, MapHandle, MapSpec } from '../types';
import { pinImages } from './images';
import { ADMIN_LABEL_MIN_ZOOM, hideBasemapLabel, isStateLabel } from './labels';
import { STYLE_URLS, TERRAIN_FALLBACK, TERRAIN_MIN_ZOOM, TERRAIN_URL, modeOf, type StyleKey } from './styles';

type ML = typeof import('maplibre-gl');

export interface EngineOptions {
  container: HTMLElement;
  spec: MapSpec;
  style: StyleKey;
  onSelect?: (id: string | null) => void;
  onCamera?: (c: CameraState) => void;
  onFail?: (reason: string) => void;
  /** Called once the base style and our layers are in place. */
  onReady?: () => void;
}

export interface MapLibreEngine extends MapHandle {
  update(spec: MapSpec): void;
  setStyle(style: StyleKey): void;
  focusPin(id: string | null): void;
  zoomBy(delta: number): void;
  camera(): CameraState;
  destroy(): void;
  readonly map: MLMap;
}

const HIDE_LABEL_LAYER = /village|suburb|hamlet|neighbo|quarter|label_other|poi|housenumber|aerodrome|airport|ferry|mountain_peak/i;
const HIDE_SOURCE_LAYERS = new Set(['poi', 'housenumber', 'aerodrome_label', 'transportation_name', 'mountain_peak']);
const FIT_PADDING = { top: 56, bottom: 56, left: 56, right: 56 };
/** The legend sits bottom-left over the map (MapChrome): fit with room under the pins for it, so it never covers a pin (3.31). */
function fitPadding(spec: MapSpec, height: number) {
  const legend = spec.legend?.length ? Math.min(32 + 22 * spec.legend.length + 16, Math.round(height * 0.4)) : 0;
  return { ...FIT_PADDING, bottom: FIT_PADDING.bottom + legend };
}

function el(tag: string, css: Partial<CSSStyleDeclaration>, text?: string): HTMLElement {
  const e = document.createElement(tag);
  Object.assign(e.style, css);
  if (text) e.textContent = text;
  return e;
}

export async function createMapLibre(ml: ML, opts: EngineOptions): Promise<MapLibreEngine> {
  const { container } = opts;
  let spec = opts.spec;
  let styleKey = opts.style;
  let palette: MapPalette = readPalette(container, modeOf(styleKey));
  let hoverId: string | null = null;
  let selected: Marker | null = null;
  let cursorMarker: Marker | null = null;
  let fan: Marker[] = [];
  let fanOf: string | null = null;
  let groups: PinGroup[] = groupPins(spec.pins);
  let styleLoaded = false;
  let destroyed = false;
  let fellBack = false;
  let fontStack: string[] = ['Noto Sans Bold'];

  const points = fitPoints(spec, spec.fit && spec.fit !== 'all' ? spec.fit.ids : undefined);
  const bb = boundsOf(points);
  const single = bb && bb[0].lng === bb[1].lng && bb[0].lat === bb[1].lat;
  const init: Record<string, unknown> = {};
  if (spec.camera) { init.center = [spec.camera.lng, spec.camera.lat]; init.zoom = spec.camera.zoom; }
  else if (bb && !single) { init.bounds = [[bb[0].lng, bb[0].lat], [bb[1].lng, bb[1].lat]] as LngLatBoundsLike; init.fitBoundsOptions = { padding: fitPadding(spec, container.clientHeight), maxZoom: 13 }; }
  else if (bb) { init.center = [bb[0].lng, bb[0].lat]; init.zoom = 11; }
  else { init.center = [10, 46]; init.zoom = 4; }

  const map = new ml.Map({
    container,
    style: STYLE_URLS[styleKey],
    attributionControl: false,
    interactive: spec.interactive !== false,
    maxZoom: 17,
    maxPitch: 70,
    canvasContextAttributes: { antialias: true },
    ...init,
  });
  map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-right');
  map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-right');

  const failTimer = window.setTimeout(() => { if (!styleLoaded && !destroyed) opts.onFail?.('The map style did not load.'); }, 15000);

  function recolourBase() {
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
        if (sl === 'waterway') set(l.id, 'paint', 'line-color', palette.waterLine);
        else if (sl === 'boundary') set(l.id, 'paint', 'line-color', palette.border);
        else if (sl === 'transportation') set(l.id, 'paint', 'line-color', palette.contour);
      } else if (l.type === 'symbol') {
        if (HIDE_SOURCE_LAYERS.has(sl) || HIDE_LABEL_LAYER.test(l.id) || hideBasemapLabel(l.id, sl, spec.hideBasemapLabels)) { set(l.id, 'layout', 'visibility', 'none'); continue; }
        // a map that thins its labels shows state and province names only from zoom 5, in both styles (4.6, C6)
        if (spec.hideBasemapLabels?.length && isStateLabel(l.id, sl) && (l.minzoom ?? 0) < ADMIN_LABEL_MIN_ZOOM) { try { map.setLayerZoomRange(l.id, ADMIN_LABEL_MIN_ZOOM, l.maxzoom ?? 24); } catch { /* layer gone */ } }
        // a basemap name keeps clear of our pins and their labels (4.2): the overlay below reserves its space, this keeps theirs apart
        set(l.id, 'layout', 'text-padding', 3);
        set(l.id, 'paint', 'text-color', palette.label);
        set(l.id, 'paint', 'text-halo-color', palette.halo);
        set(l.id, 'paint', 'text-halo-width', 1.5);
      }
    }
  }

  function addRelief() {
    const layers = map.getStyle().layers;
    const firstWater = layers.find((l) => l.type === 'fill' && (l as { 'source-layer'?: string })['source-layer'] === 'water');
    const addHills = () => {
      map.addLayer({
        id: 'hills', type: 'hillshade', source: 'dem-hill',
        paint: {
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 0, 0.05, 5, 0.2, 8, 0.26],
          'hillshade-shadow-color': palette.shade, 'hillshade-highlight-color': palette.high, 'hillshade-accent-color': palette.shade,
          'hillshade-illumination-direction': 315,
        },
      }, firstWater?.id);
    };
    map.addSource('dem-hill', { type: 'raster-dem', url: TERRAIN_URL, tileSize: 512 });
    map.addSource('dem', { type: 'raster-dem', url: TERRAIN_URL, tileSize: 512 });
    addHills();
    const onErr = (e: { sourceId?: string }) => {
      if (fellBack || !e.sourceId?.startsWith('dem')) return;
      fellBack = true;
      console.warn('[map] Mapterhorn failed; falling back to AWS Terrarium tiles.');
      try {
        map.setTerrain(null);
        if (map.getLayer('hills')) map.removeLayer('hills');
        map.removeSource('dem'); map.removeSource('dem-hill');
        map.addSource('dem', TERRAIN_FALLBACK); map.addSource('dem-hill', TERRAIN_FALLBACK);
        addHills(); applyTerrain();
      } catch { /* style changed under us */ }
    };
    map.off('error', onErr as never);
    map.on('error', onErr as never);
  }

  function applyTerrain() {
    if (!map.getSource('dem')) return;
    const want = !!spec.terrain && map.getZoom() >= TERRAIN_MIN_ZOOM;
    const cur = map.getTerrain();
    if (want && !cur) map.setTerrain({ source: 'dem', exaggeration: 1.3 });
    else if (!want && cur) map.setTerrain(null);
  }

  function pinData() {
    return {
      type: 'FeatureCollection' as const,
      features: groups.map((g) => ({
        type: 'Feature' as const,
        id: undefined,
        properties: {
          id: g.id, style: g.style, n: g.pins.length, text: g.text, w: g.text.length,
          label: g.pins.length === 1 && !g.pins[0].quiet ? (g.pins[0].label ?? '') : '',
        },
        geometry: { type: 'Point' as const, coordinates: [g.at.lng, g.at.lat] },
      })),
    };
  }
  const lineData = () => ({ type: 'FeatureCollection' as const, features: lineFeatures(spec.lines) });

  function addOverlay() {
    const layers = map.getStyle().layers;
    const sym = layers.find((l) => l.type === 'symbol' && (l.layout as { 'text-font'?: string[] } | undefined)?.['text-font']);
    const f = (sym?.layout as { 'text-font'?: string[] } | undefined)?.['text-font'];
    if (f) fontStack = f.some((n) => /bold/i.test(n)) ? f : (f.map((n) => n.replace(/Regular|Italic/i, 'Bold')));
    const images = pinImages(palette);
    for (const [k, img] of Object.entries(images)) if (img && !map.hasImage(`pin-${k}`)) map.addImage(`pin-${k}`, img, { pixelRatio: 2 });

    map.addSource('lines', { type: 'geojson', data: lineData() });
    map.addSource('pins', { type: 'geojson', data: pinData() });
    const line = (id: string, filter: unknown, paint: Record<string, unknown>, layout: Record<string, unknown> = {}) =>
      map.addLayer({ id, type: 'line', source: 'lines', filter: filter as never, layout: { 'line-cap': 'round', 'line-join': 'round', ...layout }, paint: paint as never });
    const is = (s: string): ExpressionSpecification => ['==', ['get', 'style'], s];
    line('line-pick-casing', is('route-pick'), { 'line-color': palette.ink, 'line-width': 5.5 });
    line('line-route', is('route'), { 'line-color': palette.route, 'line-width': 2 });
    line('line-pick', is('route-pick'), { 'line-color': palette.routePick, 'line-width': 3.5 });
    line('line-trail', is('trail'), { 'line-color': palette.ink, 'line-width': 3 });
    // a stored line nobody has confirmed: dashed in the muted ink on a light casing, 3:1 or better against the land in both themes (3.31)
    line('line-trail-unconfirmed-casing', is('trail-unconfirmed'), { 'line-color': palette.halo, 'line-width': 5.5, 'line-opacity': 0.75 });
    line('line-trail-unconfirmed', is('trail-unconfirmed'), { 'line-color': palette.muted, 'line-width': 3, 'line-dasharray': [2.2, 1.6] }, { 'line-cap': 'butt' });
    line('line-estimate', is('straight-estimate'), { 'line-color': palette.ink, 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 2] }, { 'line-cap': 'butt' });

    const single = ['all', ['==', ['get', 'n'], 1]];
    map.addLayer({ id: 'pin-stop', type: 'circle', source: 'pins', filter: [...single, is('stop')] as never, paint: { 'circle-radius': 3, 'circle-color': palette.ink, 'circle-stroke-color': palette.halo, 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'pin-numbered', type: 'circle', source: 'pins', filter: [...single, is('stop-numbered')] as never, paint: { 'circle-radius': 11, 'circle-color': palette.ink, 'circle-stroke-color': palette.halo, 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'pin-merged', type: 'circle', source: 'pins', filter: ['>', ['get', 'n'], 1], paint: { 'circle-radius': ['+', 12, ['*', 2.2, ['max', 0, ['-', ['get', 'w'], 2]]]], 'circle-color': palette.ink, 'circle-stroke-color': palette.halo, 'circle-stroke-width': 1.5 } });
    map.addLayer({
      id: 'pin-icons', type: 'symbol', source: 'pins',
      filter: [...single, ['in', ['get', 'style'], ['literal', ['base', 'place', 'trailhead', 'parking', 'trip']]]] as never,
      // our pins draw always but reserve their space: no basemap name sits under one (4.2)
      layout: { 'icon-image': ['concat', 'pin-', ['get', 'style']], 'icon-size': 1, 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-padding': 6 },
    });
    map.addLayer({
      id: 'pin-numerals', type: 'symbol', source: 'pins',
      filter: ['all', ['has', 'text'], ['!=', ['get', 'text'], ''], ['any', ['>', ['get', 'n'], 1], is('stop-numbered')]] as never,
      layout: { 'text-field': ['get', 'text'], 'text-font': fontStack, 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': palette.surface },
    });
    map.addLayer({
      id: 'pin-labels', type: 'symbol', source: 'pins',
      filter: ['all', ['!=', ['get', 'label'], ''], ['==', ['get', 'n'], 1]] as never,
      layout: {
        'text-field': ['get', 'label'], 'text-font': fontStack, 'text-size': ['case', is('base'), 13, 12], 'text-anchor': 'top',
        'text-offset': [0, 1.1], 'text-optional': true, 'text-padding': 6, 'text-max-width': 9,
        'text-transform': 'none', 'symbol-sort-key': ['case', is('base'), 0, 1],
      },
      minzoom: 8,
      paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.6 },
    });
    map.addLayer({ id: 'pin-hover', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], hoverId ?? '\u0000'], paint: { 'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': palette.accent, 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'pin-hit', type: 'circle', source: 'pins', paint: { 'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)', 'circle-opacity': 0 } });
    // The elevation-labelled base legs and zoom-dependent labels are drawn by the page lane; none here.
  }

  function refreshSelected() {
    selected?.remove(); selected = null;
    const g = spec.selectedId ? groups.find((x) => x.id === spec.selectedId || x.pins.some((p) => p.id === spec.selectedId)) : undefined;
    if (!g) return;
    const pin = g.pins.find((p) => p.id === spec.selectedId) ?? g.pins[0];
    const isBase = pin.style === 'base';
    // A pin that is an icon (parking, trailhead, place) is picked out by a ring, so lots stacked beneath it stay visible;
    // numbered stops and bases keep the filled disc that carries their number.
    const ring = pin.number == null && !isBase;
    const e = el('div', {
      width: isBase ? '30px' : ring ? '34px' : '26px', height: isBase ? '30px' : ring ? '34px' : '26px', borderRadius: isBase ? '7px' : '50%',
      background: ring ? 'transparent' : palette.accent, color: palette.accentInk, border: ring ? `3px solid ${palette.accent}` : `2px solid ${palette.halo}`,
      boxShadow: ring ? `0 0 0 1.5px ${palette.halo}, inset 0 0 0 1.5px ${palette.halo}` : `0 0 0 2px ${palette.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '600 11px ui-monospace, monospace', pointerEvents: 'none',
    }, pin.number != null ? String(pin.number) : '');
    e.setAttribute('data-map-selected', pin.id);
    e.setAttribute('aria-hidden', 'true');
    selected = new ml.Marker({ element: e }).setLngLat([pin.at.lng, pin.at.lat]).addTo(map);
  }

  function refreshCursor() {
    cursorMarker?.remove(); cursorMarker = null;
    if (!spec.cursor) return;
    const e = el('div', { width: '14px', height: '14px', borderRadius: '50%', background: palette.accent, border: `2px solid ${palette.surface}`, boxShadow: `0 0 0 1px ${palette.ink}`, pointerEvents: 'none' });
    e.setAttribute('data-map-cursor', '');
    e.setAttribute('aria-hidden', 'true');
    cursorMarker = new ml.Marker({ element: e }).setLngLat([spec.cursor.lng, spec.cursor.lat]).addTo(map);
  }

  function collapseFan() { fan.forEach((m) => m.remove()); fan = []; fanOf = null; }
  function expandFan(g: PinGroup) {
    if (fanOf === g.id) return;
    collapseFan();
    fanOf = g.id;
    const n = g.pins.length, r = 36;
    g.pins.forEach((p, i) => {
      const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const b = el('button', {
        width: '28px', height: '28px', borderRadius: '50%', background: palette.ink, color: palette.surface,
        border: `2px solid ${palette.halo}`, font: '600 11px ui-monospace, monospace', cursor: 'pointer', padding: '0',
      }, p.number != null ? String(p.number) : (p.label ?? '').slice(0, 1));
      (b as HTMLButtonElement).type = 'button';
      b.setAttribute('aria-label', p.label ?? `Stop ${p.number ?? ''}`.trim());
      b.title = p.label ?? '';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); opts.onSelect?.(p.id); collapseFan(); });
      fan.push(new ml.Marker({ element: b, offset: [Math.cos(a) * r, Math.sin(a) * r] }).setLngLat([g.at.lng, g.at.lat]).addTo(map));
    });
  }

  const groupAt = (id: string | undefined) => groups.find((g) => g.id === id);
  const setHover = (id: string | null) => {
    if (hoverId === id) return;
    hoverId = id;
    if (map.getLayer('pin-hover')) map.setFilter('pin-hover', ['==', ['get', 'id'], id ?? '\u0000']);
  };

  map.on('style.load', () => {
    styleLoaded = true;
    window.clearTimeout(failTimer);
    map.setProjection({ type: 'mercator' });
    recolourBase();
    addRelief();
    addOverlay();
    applyTerrain();
    refreshSelected();
    refreshCursor();
    opts.onReady?.();
  });
  map.on('error', (ev) => {
    const e = ev as unknown as { error?: { message?: string }; sourceId?: string };
    if (!styleLoaded && !e.sourceId && !destroyed) opts.onFail?.(e.error?.message ?? 'The map style failed to load.');
  });
  map.on('zoomend', applyTerrain);
  map.on('mousemove', (e) => {
    if (!map.getLayer('pin-hit')) return;
    const f = map.queryRenderedFeatures(e.point, { layers: ['pin-hit'] })[0];
    map.getCanvas().style.cursor = f ? 'pointer' : '';
    const g = groupAt(f?.properties?.id as string | undefined);
    setHover(g?.id ?? null);
    if (g && g.pins.length > 1) expandFan(g);
    else if (fanOf) {
      const gg = groupAt(fanOf);
      if (!gg || map.project([gg.at.lng, gg.at.lat]).dist(e.point) > 70) collapseFan();
    }
  });
  map.on('click', (e) => {
    const f = map.getLayer('pin-hit') ? map.queryRenderedFeatures(e.point, { layers: ['pin-hit'] })[0] : undefined;
    const g = groupAt(f?.properties?.id as string | undefined);
    if (!g) { collapseFan(); opts.onSelect?.(null); return; }
    if (g.pins.length > 1) expandFan(g);
    else opts.onSelect?.(g.pins[0].id);
  });
  map.on('movestart', () => collapseFan());
  map.on('moveend', (e) => {
    if (!(e as { originalEvent?: unknown }).originalEvent && !spec.reportAllMoves) return;
    const c = map.getCenter();
    opts.onCamera?.({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
  });
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') collapseFan(); };
  container.addEventListener('keydown', onKey);

  function fly(target: FlyTarget, o?: { zoom?: number }) {
    const reduced = prefersReducedMotion();
    if ('bounds' in target) {
      const [a, b] = target.bounds;
      const km = distanceKm(a, b);
      map.fitBounds([[a.lng, a.lat], [b.lng, b.lat]], { padding: fitPadding(spec, container.clientHeight), maxZoom: o?.zoom ?? 14, duration: reduced ? 0 : flyDuration(km) });
      return;
    }
    const c = map.getCenter();
    const km = distanceKm({ lng: c.lng, lat: c.lat }, target);
    const zoom = o?.zoom ?? Math.max(map.getZoom(), 11);
    if (reduced) map.jumpTo({ center: [target.lng, target.lat], zoom });
    else map.flyTo({ center: [target.lng, target.lat], zoom, duration: flyDuration(km), essential: false });
  }

  const engine: MapLibreEngine = {
    map,
    flyTo: fly,
    fit(ids) {
      const bnds = boundsOf(fitPoints(spec, ids));
      if (!bnds) return;
      if (bnds[0].lng === bnds[1].lng && bnds[0].lat === bnds[1].lat) fly(bnds[0], { zoom: 12 });
      else fly({ bounds: bnds });
    },
    select(id) { spec = { ...spec, selectedId: id ?? undefined }; refreshSelected(); },
    setCursor(p) { spec = { ...spec, cursor: p }; refreshCursor(); },
    focusPin(id) {
      setHover(id);
      const p = spec.pins.find((x) => x.id === id);
      if (p && !map.getBounds().contains([p.at.lng, p.at.lat])) map.easeTo({ center: [p.at.lng, p.at.lat], duration: prefersReducedMotion() ? 0 : 600 });
    },
    update(next) {
      spec = next;
      groups = groupPins(spec.pins);
      if (styleLoaded && map.getSource('pins')) {
        (map.getSource('pins') as GeoJSONSource).setData(pinData() as never);
        (map.getSource('lines') as GeoJSONSource).setData(lineData() as never);
        applyTerrain();
      }
      refreshSelected();
      refreshCursor();
    },
    setStyle(next) {
      styleKey = next;
      palette = readPalette(container, modeOf(next));
      styleLoaded = false;
      fellBack = false;
      map.setStyle(STYLE_URLS[next] as unknown as StyleSpecification, { diff: false });
    },
    zoomBy(d) { if (prefersReducedMotion()) map.jumpTo({ zoom: map.getZoom() + d }); else map.easeTo({ zoom: map.getZoom() + d, duration: 200 }); },
    camera() { const c = map.getCenter(); return { lng: c.lng, lat: c.lat, zoom: map.getZoom() }; },
    destroy() {
      destroyed = true;
      window.clearTimeout(failTimer);
      container.removeEventListener('keydown', onKey);
      collapseFan(); selected?.remove(); cursorMarker?.remove();
      map.remove();
    },
  };
  return engine;
}

export type { LngLat };
