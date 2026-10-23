'use client';

import './map.css';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { googleEnv } from '@/lib/map/family';
import { boundsOf, fitPoints } from '@/lib/map/geo';
import { cameraFor, clusterNumbered, type Padding } from '@/lib/map/camera';
import { loadGoogleMaps, resetGoogleLoader } from '@/lib/map/google-js/loader';
import type { GMap, GMarker, GPolyline, GoogleMapsApi } from '@/lib/map/google-js/types';
import { normaliseColour, readPalette, type MapPalette } from '@/lib/map/palette';
import { prefersReducedMotion } from '@/lib/map/reduced-motion';
import type { Line, MapHandle, Pin } from '@/lib/map/types';
import { Controls } from './MapChrome';
import type { MapFamilyProps } from './MapLibreMap';
import { usePageDark } from './usePageDark';

/** The trip route map on Google (map note 2, 4, 5, 10, 11, 12). It draws our pins and lines on a Google basemap and never asks Google about a place. */
export interface TripMapProps extends MapFamilyProps {
  onHover?: (id: string | null) => void;
}

const loadTimeout = 10_000;
const DEFAULT_PAD = 48;
const LABEL_MIN_WIDTH = 560;
const LABEL_MAX_CHARS = 24;
const DASH_SCALE = 2.75;
const HOUSE = 'M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3Z';

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (cls: string, text?: string): HTMLDivElement => {
  const d = document.createElement('div');
  d.className = cls;
  if (text !== undefined) d.textContent = text;
  return d;
};
const shorten = (s: string): string => (s.length > LABEL_MAX_CHARS ? `${s.slice(0, LABEL_MAX_CHARS - 1)}…` : s);

function rgbaParts(c: string): { color: string; opacity: number } {
  const m = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  // the colour as #rrggbb with the alpha apart: a polyline takes no alpha in its colour
  return m ? { color: `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`, opacity: Number(m[4]) } : { color: c, opacity: 1 };
}

interface Rec { id: string; mk: GMarker; node: HTMLElement }
interface LineRec { id: string; line: Line; parts: GPolyline[] }

/**
 * A label inside the marker's own box, so Google's collision rule hides the basemap labels under our text and not only under the disc.
 * A hidden copy of the text sits on the other side, so the disc stays at the centre of the box and therefore on the anchor point.
 */
function withLabel(hit: HTMLElement, mark: HTMLElement, label: HTMLElement): void {
  const mirror = el(`${label.className} tp-mirror`, label.textContent ?? '');
  mirror.setAttribute('aria-hidden', 'true');
  hit.replaceChildren(mirror, mark, label);
}

/** The pin as an element. Colours and sizes live in map.css on tokens, so the page theme styles it and nothing is hard-coded here. */
function pinContent(p: Pin, o: { picked: boolean; wide: boolean }): HTMLElement {
  const hit = el('tp-hit');
  hit.dataset.pin = p.id;
  hit.style.transform = 'translate(0, 50%)';
  if (p.style === 'stop-numbered') {
    const nums = p.numbers ?? (p.number != null ? [p.number] : []);
    const d = el('tp', nums.join('·'));
    d.dataset.numbered = '';
    if (nums.length > 1 || String(nums[0] ?? '').length > 1) d.dataset.pill = '';
    hit.dataset.numbered = '';
    hit.append(d);
    if (o.wide && !p.quiet && p.label && !p.numbers) withLabel(hit, d, el('tp-label', shorten(p.label)));
  } else if (p.style === 'base') {
    const b = el('tp-base');
    if (o.picked) b.dataset.pick = '';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', HOUSE);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    b.append(svg);
    hit.append(b);
    // like stop labels, only on a map wide enough to keep it clear of the controls (note 4.2): the label row already names the base
    if (o.picked && o.wide && p.label) withLabel(hit, b, el('tp-label tp-label-base', shorten(p.label)));
  } else {
    const d = el('tp-dot');
    if (p.dim) d.dataset.dim = '';
    hit.append(d);
  }
  return hit;
}

/** The ring on a pin is an attribute the stylesheet draws; toggling it never touches the marker. */
function setRing(node: HTMLElement, on: boolean): void {
  if (on) node.setAttribute('data-ring', '');
  else node.removeAttribute('data-ring');
}

function tooltip(p: Pin): string {
  if (p.style === 'stop-numbered') return `${(p.numbers ?? [p.number]).join('·')} · ${p.label ?? 'Stop'}`;
  if (p.style === 'base') return `Base: ${p.label ?? ''}`.trim();
  return p.label ?? 'Stop';
}

/** The polylines that make up one leg. An estimate is dashed ink with a halo and is never amber or solid; amber over a casing is a routed picked day. */
export function legParts(l: Line, pal: MapPalette, casing: string, emphasised: boolean, hot: boolean): Record<string, unknown>[] {
  const halo = rgbaParts(pal.halo);
  // A symbol's strokeWeight is in pixels and is not scaled: it is the line's thickness. The dash's length is the symbol's own path (2 x scale), so a 2.5 px line gets a path of about 8 px.
  const dash = (weight: number, color: string, opacity: number, z: number, extra: number) => ({
    strokeOpacity: 0,
    zIndex: z,
    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: opacity, strokeColor: color, scale: DASH_SCALE + extra / 4, strokeWeight: weight + extra }, offset: '0', repeat: '14px' }],
  });
  const solid = (weight: number, color: string, opacity: number, z: number) => ({ strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, zIndex: z });
  if (l.style === 'route-pick') return [solid(5.5, casing, 1, 1), solid(3.5, hot ? pal.accent : pal.routePick, 1, 2)];
  if (l.style === 'route') return [solid(4, halo.color, halo.opacity, 1), solid(2, hot ? pal.accent : pal.route, 1, 2)];
  const weight = emphasised ? 2.5 : 2;
  return [
    dash(weight, hot ? rgbaParts(casing).color : halo.color, hot ? 1 : halo.opacity, 1, 2),
    dash(weight, hot ? pal.accent : pal.route, 1, 2, 0),
  ];
}

export default function GoogleTripMap({ spec, label, onSelect, onHover, handleRef, className = '' }: TripMapProps) {
  const env = googleEnv();
  const dark = usePageDark();
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<GoogleMapsApi | null>(null);
  const map = useRef<GMap | null>(null);
  const recs = useRef<Rec[]>([]);
  const lineRecs = useRef<LineRec[]>([]);
  const cam = useRef<{ center: { lat: number; lng: number }; zoom: number } | null>(null);
  const fitSeq = useRef(0);
  const fitBox = useRef<{ w: number; h: number } | null>(null);
  const specRef = useRef(spec);
  const cbs = useRef({ onSelect, onHover });
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [gen, setGen] = useState(0);
  const [zoom, setZoom] = useState(8);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    specRef.current = spec;
    cbs.current = { onSelect, onHover };
  });

  // One load per page view: the script is requested once (the loader keeps its promise) and a day change only redraws overlays.
  useEffect(() => {
    let dead = false;
    const timer = window.setTimeout(() => {
      if (dead) return;
      setFailure('The map could not load. Every stop is in the day list, and Directions still works.');
      setPhase('failed');
    }, loadTimeout);
    (async () => {
      try {
        if (!env.key) throw new Error('no key');
        const g = await loadGoogleMaps({ key: env.key, mapId: env.mapId });
        if (dead) return;
        api.current = g;
        setPhase('ready');
      } catch {
        if (dead) return;
        setFailure('The map could not load. Every stop is in the day list, and Directions still works.');
        setPhase('failed');
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => { dead = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key and Map ID are inlined at build time
  }, [attempt]);

  useEffect(() => {
    const f = frame.current;
    if (!f || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWide(f.clientWidth >= LABEL_MIN_WIDTH));
    ro.observe(f);
    return () => ro.disconnect();
  }, []);

  const fitTo = useCallback((ids?: string[]) => {
    const g = api.current, m = map.current;
    if (!g || !m) return;
    const s = specRef.current;
    const pts = fitPoints(s, ids ?? (s.fit && s.fit !== 'all' ? s.fit.ids : undefined));
    const b = boundsOf(pts);
    if (!b) return;
    const seq = ++fitSeq.current;
    fitBox.current = box.current ? { w: box.current.clientWidth, h: box.current.clientHeight } : null;
    const pad: Padding = s.fitPadding ?? { top: DEFAULT_PAD, right: DEFAULT_PAD, bottom: DEFAULT_PAD, left: DEFAULT_PAD };
    const cap = s.maxZoom;
    const reduced = prefersReducedMotion();
    const centre = { lat: (b[0].lat + b[1].lat) / 2, lng: (b[0].lng + b[1].lng) / 2 };
    if (b[0].lng === b[1].lng && b[0].lat === b[1].lat) {
      const z = cap ?? 13;
      if (reduced && m.moveCamera) m.moveCamera({ center: centre, zoom: z });
      else { m.panTo(centre); m.setZoom(z); }
      return;
    }
    if (reduced && m.moveCamera && box.current) {
      const c = cameraFor(b, { w: box.current.clientWidth, h: box.current.clientHeight }, pad, cap);
      m.moveCamera({ center: c.center, zoom: c.zoom });
      return;
    }
    const gb = new g.LatLngBounds();
    pts.forEach((p) => gb.extend(p));
    m.fitBounds(gb, pad);
    if (cap !== undefined) {
      // the animated fit may land closer than the cap; a newer fit makes this one stale
      const once = m.addListener('idle', () => {
        once.remove();
        if (seq === fitSeq.current && (m.getZoom() ?? 0) > cap) m.setZoom(cap);
      });
    }
  }, []);

  useImperativeHandle(handleRef, (): MapHandle => ({
    // a point that is already on screen is left where it is: the camera moves only to show something that is off the map
    flyTo: (t) => {
      const m = map.current; if (!m) return;
      if ('bounds' in t) { fitTo(); return; }
      if (m.getBounds?.()?.contains(t) === false) m.panTo(t);
    },
    fit: (ids) => fitTo(ids),
    select: () => undefined,
    setCursor: () => undefined,
  }), [fitTo]);

  // The map is created once ready, and again when the page theme changes (colorScheme is fixed at creation): the camera is kept.
  useEffect(() => {
    const g = api.current;
    if (phase !== 'ready' || !g || !box.current) return;
    const first = cam.current === null;
    const b = boundsOf(fitPoints(specRef.current));
    const start = cam.current ?? { center: b ? { lat: (b[0].lat + b[1].lat) / 2, lng: (b[0].lng + b[1].lng) / 2 } : { lat: 46, lng: 10 }, zoom: 6 };
    const m = new g.Map(box.current, {
      center: start.center, zoom: start.zoom, ...(env.mapId ? { mapId: env.mapId } : {}),
      colorScheme: dark ? 'DARK' : 'LIGHT', disableDefaultUI: true, clickableIcons: false, gestureHandling: 'cooperative', keyboardShortcuts: true,
    });
    map.current = m;
    let checked = false;
    let refitted = false;
    const idle = m.addListener('idle', () => {
      const c = m.getCenter();
      const z = m.getZoom();
      if (c && z !== undefined) cam.current = { center: { lat: c.lat(), lng: c.lng() }, zoom: z };
      // the first fit can run before the column has its final height: fit once more when the box has changed since
      const fb = fitBox.current;
      if (!refitted && fb && box.current && (Math.abs(box.current.clientWidth - fb.w) > 2 || Math.abs(box.current.clientHeight - fb.h) > 2)) {
        refitted = true;
        fitTo();
      }
      // a Map ID that is not a vector JavaScript one cannot draw our pins: say so instead of leaving a map without them
      if (!checked) {
        checked = true;
        if (m.getMapCapabilities?.().isAdvancedMarkersAvailable === false) {
          setFailure('Our pins cannot be drawn on this map.');
          setPhase('failed');
        }
      }
    });
    const zoomed = m.addListener('zoom_changed', () => setZoom(Math.round(m.getZoom() ?? 8)));
    setGen((n) => n + 1);
    if (first) requestAnimationFrame(() => fitTo());
    return () => {
      idle.remove();
      zoomed.remove();
      recs.current.forEach((r) => { r.mk.map = null; });
      lineRecs.current.forEach((r) => r.parts.forEach((p) => p.setMap(null)));
      recs.current = [];
      lineRecs.current = [];
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitTo is stable; the Map ID is inlined at build time
  }, [phase, dark]);

  // Two stops closer than 20 px on screen become one "2·3" pill at the current zoom.
  const pins = useMemo(() => clusterNumbered(spec.pins, zoom), [spec.pins, zoom]);
  const selectedId = spec.selectedId;
  const lines = spec.lines;

  // Pins and lines are drawn from the spec and nothing else: a hover is applied by the next effect and never redraws them.
  useEffect(() => {
    const g = api.current, m = map.current;
    if (!g || !m) return;
    recs.current.forEach((r) => { r.mk.map = null; });
    lineRecs.current.forEach((r) => r.parts.forEach((p) => p.setMap(null)));
    const pal = readPalette(box.current, dark ? 'dark' : 'light');
    const casing = normaliseColour(box.current ? getComputedStyle(box.current).getPropertyValue('--map-casing').trim() : '', pal.ink);
    const emphasised = pins.some((p) => p.style === 'stop-numbered');
    lineRecs.current = lines.map((l) => ({
      id: l.id,
      line: l,
      parts: legParts(l, pal, casing, emphasised, false).map((o) => new g.Polyline({ map: m, path: l.coords, geodesic: false, clickable: false, ...o })),
    }));
    recs.current = pins.map((p) => {
      const picked = p.id === selectedId;
      const node = pinContent(p, { picked, wide });
      const clickable = p.style === 'stop-numbered';
      const mk = new g.marker.AdvancedMarkerElement({
        map: m, position: p.at, title: tooltip(p), content: node, gmpClickable: clickable,
        zIndex: p.style === 'stop-numbered' ? 30 : p.style === 'base' ? 20 : 10, collisionBehavior: 'REQUIRED_AND_HIDES_OPTIONAL',
      });
      const first = p.id.split('+')[0]!;
      if (clickable) {
        mk.addEventListener?.('gmp-click', () => cbs.current.onSelect?.(first));
        mk.addEventListener?.('focusin', () => cbs.current.onHover?.(p.id));
        mk.addEventListener?.('focusout', () => cbs.current.onHover?.(null));
        node.addEventListener('mouseenter', () => cbs.current.onHover?.(p.id));
        node.addEventListener('mouseleave', () => cbs.current.onHover?.(null));
      } else if (p.style === 'stop' && !p.dim) {
        // All days: a dot picks its day. Not a tab stop (the number of tab stops stays the day's pin count, P1), so it is a pointer target only.
        node.style.pointerEvents = 'auto';
        node.style.cursor = 'pointer';
        node.addEventListener('click', () => cbs.current.onSelect?.(p.id));
      }
      return { id: p.id, mk, node };
    });
    return () => {
      recs.current.forEach((r) => { r.mk.map = null; });
      lineRecs.current.forEach((r) => r.parts.forEach((p) => p.setMap(null)));
      recs.current = [];
      lineRecs.current = [];
    };
  }, [gen, pins, lines, selectedId, wide, dark]);

  // The ring on the hovered pin and the amber leg into it: attributes and options on the markers and lines that already exist.
  const hoverPin = spec.hover?.pin ?? null;
  const hoverLeg = spec.hover?.leg ?? null;
  useEffect(() => {
    for (const r of recs.current) {
      const on = hoverPin !== null && (r.id === hoverPin || r.id.split('+').includes(hoverPin));
      setRing(r.node, on);
    }
    const pal = readPalette(box.current, dark ? 'dark' : 'light');
    const casing = normaliseColour(box.current ? getComputedStyle(box.current).getPropertyValue('--map-casing').trim() : '', pal.ink);
    const emphasised = recs.current.some((r) => r.node.dataset.numbered !== undefined);
    for (const r of lineRecs.current) {
      const parts = legParts(r.line, pal, casing, emphasised, r.id === hoverLeg);
      r.parts.forEach((p, i) => p.setOptions?.(parts[i]!));
    }
  }, [hoverPin, hoverLeg, gen, pins, lines, selectedId, wide, dark]);

  return (
    <div ref={frame} className={`map-surface relative flex flex-col ${className}`} data-map-family="google-js" data-trip-map data-phase={phase}>
      <div
        className="relative min-h-[320px] flex-1 overflow-hidden rounded-xl border"
        style={{ background: 'var(--well)', borderColor: 'var(--line)' }}
        role="region"
        aria-label={label}
      >
        <div key={dark ? 'dark' : 'light'} ref={box} className="absolute inset-0" />
        {phase === 'ready' ? <Controls onZoom={(d) => map.current?.setZoom((map.current.getZoom() ?? 10) + d)} onFit={() => fitTo()} /> : null}
        {phase === 'loading' ? (
          <div role="status" className="gtm-state">Loading the map</div>
        ) : null}
        {phase === 'failed' ? (
          <div role="alert" className="gtm-state">
            <span>{failure}</span>
            <button
              type="button"
              className="gtm-retry"
              onClick={() => {
                resetGoogleLoader();
                cam.current = null;
                setPhase('loading');
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
