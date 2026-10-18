'use client';

import './map.css';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { googleEnv } from '@/lib/map/family';
import { boundsOf, fitPoints } from '@/lib/map/geo';
import { loadGoogleMaps } from '@/lib/map/google-js/loader';
import type { GMap, GMarker, GPolyline, GoogleMapsApi } from '@/lib/map/google-js/types';
import { pageIsDark, readPalette, type MapPalette } from '@/lib/map/palette';
import { formatPoint } from '@/lib/map/links';
import type { MapHandle, Pin } from '@/lib/map/types';
import { Controls, Well } from './MapChrome';
import { PointLinks } from './PointLinks';
import type { MapFamilyProps } from './MapLibreMap';

function pinElement(p: Pin, pal: MapPalette, picked: boolean): HTMLElement {
  const e = document.createElement('div');
  const big = p.style === 'stop-numbered' || p.style === 'base' || picked;
  const size = picked ? 26 : p.style === 'stop' ? 8 : big ? 22 : 18;
  Object.assign(e.style, {
    width: `${size}px`, height: `${size}px`, borderRadius: p.style === 'base' ? '6px' : '50%',
    background: picked ? pal.accent : pal.ink, color: picked ? pal.accentInk : pal.surface,
    border: `2px solid ${pal.halo}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: '600 11px ui-monospace, monospace',
  });
  if (p.number != null && big) e.textContent = String(p.number);
  return e;
}

const LINE_WEIGHT = { route: 2, 'route-pick': 3.5, trail: 3, 'straight-estimate': 2 } as const;

export default function GoogleJsMap({ spec, label, onSelect, handleRef, className = '' }: MapFamilyProps) {
  const env = googleEnv();
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const map = useRef<GMap | null>(null);
  const overlays = useRef<{ markers: GMarker[]; lines: GPolyline[]; cursor: GMarker | null }>({ markers: [], lines: [], cursor: null });
  const [phase, setPhase] = useState<'facade' | 'loading' | 'ready' | 'error'>('facade');
  const [error, setError] = useState('');

  const draw = useCallback(() => {
    const g = api.current, m = map.current;
    if (!g || !m) return;
    const o = overlays.current;
    o.markers.forEach((x) => { x.map = null; });
    o.lines.forEach((x) => x.setMap(null));
    if (o.cursor) o.cursor.map = null;
    const pal = readPalette(box.current, pageIsDark() ? 'dark' : 'light');
    o.lines = spec.lines.map((l) => {
      const dashed = l.style === 'straight-estimate';
      const pl = new g.Polyline({
        path: l.coords, map: m, geodesic: false,
        strokeColor: l.style === 'route-pick' ? pal.routePick : pal.route,
        strokeWeight: LINE_WEIGHT[l.style], strokeOpacity: dashed ? 0 : 1,
        icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.5, strokeColor: pal.route, scale: 2 }, offset: '0', repeat: '8px' }] : undefined,
      });
      return pl;
    });
    o.markers = spec.pins.map((p) => {
      const mk = new g.marker.AdvancedMarkerElement({
        map: m, position: p.at, title: p.label ?? p.style, content: pinElement(p, pal, p.id === spec.selectedId),
        gmpClickable: true,
      }) as GMarker & { addListener?: (e: string, f: () => void) => void };
      mk.addListener?.('click', () => onSelect?.(p.id));
      return mk;
    });
    if (spec.cursor) {
      const dot = document.createElement('div');
      Object.assign(dot.style, { width: '14px', height: '14px', borderRadius: '50%', background: pal.accent, border: `2px solid ${pal.surface}` });
      o.cursor = new g.marker.AdvancedMarkerElement({ map: m, position: spec.cursor, content: dot });
    } else o.cursor = null;
  }, [spec, onSelect]);

  const fit = useCallback((ids?: string[]) => {
    const g = api.current, m = map.current;
    if (!g || !m) return;
    const pts = fitPoints(spec, ids);
    const b = boundsOf(pts);
    if (!b) return;
    if (b[0].lng === b[1].lng && b[0].lat === b[1].lat) { m.panTo(b[0]); m.setZoom(14); return; }
    const gb = new g.LatLngBounds();
    pts.forEach((p) => gb.extend(p));
    m.fitBounds(gb, 48);
  }, [spec]);

  useImperativeHandle(handleRef, (): MapHandle => ({
    flyTo: (t, o) => {
      const m = map.current; if (!m) return;
      if ('bounds' in t) { fit(); return; }
      m.panTo(t); if (o?.zoom) m.setZoom(o.zoom);
    },
    fit,
    select: () => undefined,
    setCursor: (p) => {
      const o = overlays.current; if (o.cursor && p) o.cursor.position = p;
    },
  }), [fit]);

  const load = async () => {
    if (!env.key) return;
    setPhase('loading');
    try {
      api.current = await loadGoogleMaps({ key: env.key, mapId: env.mapId });
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google Maps could not load.');
      setPhase('error');
    }
  };

  // The container exists only in the ready phase, so the map is created after that render.
  useEffect(() => {
    const g = api.current;
    if (phase !== 'ready' || !g || !box.current || map.current) return;
    const b = boundsOf(fitPoints(spec));
    const center = spec.camera ?? (b ? { lat: (b[0].lat + b[1].lat) / 2, lng: (b[0].lng + b[1].lng) / 2, zoom: 12 } : { lat: 46, lng: 10, zoom: 5 });
    map.current = new g.Map(box.current, {
      center: { lat: center.lat, lng: center.lng }, zoom: center.zoom, mapId: env.mapId ?? 'DEMO_MAP_ID',
      gestureHandling: 'cooperative', streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
    });
    draw();
    if (!spec.camera) fit(spec.fit && spec.fit !== 'all' ? spec.fit.ids : undefined);
    // Runs when the map first becomes ready; later spec changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => { if (phase === 'ready' && map.current) draw(); }, [draw, phase]);

  if (phase === 'facade' || phase === 'loading' || phase === 'error') {
    return (
      <Well label={label} className={className}>
        <div data-map-family="google-js" data-map-facade className="flex flex-col gap-3">
          <p className="m-0 font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
            {spec.pins.length} point{spec.pins.length === 1 ? '' : 's'}
            {spec.pins[0] ? ` · ${formatPoint(spec.pins[0].at)}` : ''}
          </p>
          <PointLinks spec={spec} />
          <div>
            <button
              type="button"
              disabled={phase === 'loading'}
              onClick={load}
              className="inline-flex min-h-10 items-center rounded-lg border px-4 font-mono text-[13px] font-semibold disabled:opacity-60"
              style={{ background: 'var(--surface)', borderColor: 'var(--ink)', color: 'var(--ink)', fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}
            >
              {phase === 'loading' ? 'Loading Google map' : 'Load Google map'}
            </button>
          </div>
          {phase === 'error' && <p role="alert" className="m-0 font-mono text-[12px]">{error} The links above still work.</p>}
        </div>
      </Well>
    );
  }

  return (
    <div className={`map-surface relative flex flex-col gap-2 ${className}`} data-map-family="google-js">
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-xl border" style={{ background: 'var(--well)', borderColor: 'var(--line)' }} role="application" aria-roledescription="map" aria-label={label}>
        <div ref={box} className="absolute inset-0" />
        <Controls onZoom={(d) => map.current?.setZoom((map.current.getZoom() ?? 10) + d)} onFit={() => fit()} />
      </div>
      <PointLinks spec={spec} list={false} />
    </div>
  );
}
