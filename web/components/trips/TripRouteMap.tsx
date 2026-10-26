'use client';

// The route map column: label row, key, the map, Directions (map note 3 to 10). This whole file is a dynamic chunk of the trip page
// (TripPlan loads it with next/dynamic), so none of it counts against the page's start JS (D-E9).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { OSM_COPYRIGHT_URL } from '@travel/core/export/licence.ts';
import { MapSurface } from '@/components/map/MapSurface';
import { tripLegs } from '@/lib/client/data';
import { tripPageFamily } from '@/lib/map/family';
import { registerPageFamily } from '@/lib/map/registry';
import type { MapHandle } from '@/lib/map/types';
import { dayDirections } from './directions';
import { hasRoutedLegs, legGeometry } from './legGeometry';
import { dayBases, mapBus, pointLookup, type DayMap } from './mapPins';
import type { DayRowModel, RouteModel } from './model';
import { keyOf, labelOf, routeSpec, type KeyState } from './routeSpec';
import { revealEntry } from './revealEntry';

registerPageFamily('/trips/[slug]', tripPageFamily());

const subscribeNarrow = (cb: () => void) => {
  const q = window.matchMedia('(max-width: 1023px)');
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
const narrowNow = () => window.matchMedia('(max-width: 1023px)').matches;
const useNarrow = (): boolean => useSyncExternalStore(subscribeNarrow, narrowNow, () => false);

/** A visitor who asked to save data gets the stops as text first and loads the map by choice (note 10, T2). */
function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData || window.matchMedia('(prefers-reduced-data: reduce)').matches;
}

const ringMs = 1500;
/** How long the line layer and the key's sentence wait for the legs request (review SHOULD-3). */
export const linesHoldMs = 1200;

/**
 * The key above the map: only what the map draws in this view, then one sentence about the lines. On a phone it is one line and "Map key";
 * opened, the rest is a panel laid OVER the top of the map (not above it), so the map keeps its height (review B3, P3, P5). The panel stops
 * short of the zoom column, scrolls inside its own height, closes with its button, Escape or the toggle, and hands focus back to the toggle.
 */
export function RouteKey({ state }: { state: KeyState }) {
  const narrow = useNarrow();
  const [asked, setAsked] = useState(false);
  const [more, setMore] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // collapsed on a phone: one line, the line that is drawn longest (road or straight estimate), so it names what the eye finds on the map
  const items = [state.items.find((i) => i.id === (state.lead ?? 'road')) ?? state.items.find((i) => i.id === 'road') ?? state.items.find((i) => i.id === 'estimate')].filter((i): i is NonNullable<typeof i> => !!i);
  const [short, ...rest] = (state.sentence ?? '').split(/(?<=\.) /);
  // the open panel sits over the bottom of the map, so it is a child of the map box (a portal; events still reach this component), and
  // falls back to its place in the key's row when there is no box
  const [host, setHost] = useState<Element | null>(null);
  const open = () => { setHost(toggle.current?.closest('.tl-mapcol')?.querySelector('.tl-mapkey-slot') ?? null); setAsked(true); };
  const place = (panel: ReactElement) => (host ? createPortal(panel, host) : panel);
  const close = () => { setAsked(false); setMore(false); toggle.current?.focus({ preventScroll: true }); };
  const list = (its: typeof state.items, id?: string, held?: boolean) => (
    <ul id={id} className="trip-map-key-list" aria-label="Map key" data-held={held || undefined}>
      {its.map((k) => (
        <li key={k.id} data-line={k.style === 'straight-estimate' || k.style === 'route' || k.style === 'route-pick' ? '' : undefined}>
          <span className="key-swatch" data-key={k.id} data-pick={k.pick || undefined} data-all={k.style === 'route' || undefined} aria-hidden="true">{k.id === 'stop' ? '1' : null}</span>
          {k.label}
        </li>
      ))}
    </ul>
  );
  if (!narrow) {
    return (
      <div className="trip-map-key" data-print="hide">
        {list(state.items, 'trip-map-key-list')}
        {state.sentence ? <p className="trip-map-key-note">{state.sentence}</p> : null}
      </div>
    );
  }
  return (
    <div className="trip-map-key" data-print="hide" data-open={asked || undefined} onKeyDown={(e) => { if (e.key === 'Escape' && asked) { e.stopPropagation(); close(); } }}>
      {list(items, undefined, asked)}
      <button ref={toggle} type="button" className="trip-map-key-toggle" aria-expanded={asked} aria-controls="trip-map-key-panel" onClick={() => (asked ? close() : open())}>
        Map key
      </button>
      {asked ? place(
        <div id="trip-map-key-panel" className="trip-map-key-panel" role="group" aria-label="Map key, in full" data-testid="trip-map-key-panel">
          <div className="trip-map-key-head">
            <button type="button" className="trip-map-key-close" onClick={close}>Close</button>
          </div>
          {list(state.items, 'trip-map-key-list')}
          {state.sentence ? (
            <p className="trip-map-key-note">
              {short}
              {more && rest.length ? ` ${rest.join(' ')}` : ''}
              {rest.length ? (
                <>
                  {' '}
                  <button type="button" className="trip-map-key-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'Less' : 'More'}</button>
                </>
              ) : null}
            </p>
          ) : null}
        </div>,
      ) : null}
    </div>
  );
}

export interface TripRouteMapProps {
  /** The trip's slug: the routed legs are read for it when the map mounts. */
  slug: string;
  route: RouteModel;
  /** The day rows: each stop's item id and place, which is how a routed leg finds its pins. */
  dayRows: DayRowModel[];
  models: DayMap[];
  /** The day the map shows, or null for All days. */
  picked: number | null;
  paused: boolean;
  /** The day the reader is on: what "Follow Day N" resumes. */
  dayNow: number | null;
  onResume: () => void;
  /** The phone and tablet sheet is open. */
  sheet: boolean;
  /** The sheet has been opened at least once: only then does a phone or tablet load the Google map (note 10). */
  sheetSeen: boolean;
  /** Pick a day, scrolling to one of its entries (`<day>:<entry id>`) when given. */
  onPickDay: (n: number, entry?: string) => void;
}

export default function TripRouteMap({ slug, route, dayRows, models, picked, paused, dayNow, onResume, sheet, sheetSeen, onPickDay }: TripRouteMapProps) {
  const family = tripPageFamily();
  const google = family === 'google-js';
  const narrow = useNarrow();
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const [wide, setWide] = useState(true);
  const [inView, setInView] = useState(false);
  const [forced, setForced] = useState(false);
  const [hover, setHover] = useState<{ pin: string | null; leg: string | null } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const ringing = useRef(false);
  const [saving] = useState(() => saveData());

  const [legs, setLegs] = useState<TripLegs | null>(null);
  // the line layer and the key's sentence wait for the legs request to settle, or 1.2 s, so a page view never draws dashes and then flips to amber (P5)
  const [settled, setSettled] = useState(false);
  // routed legs by the map's leg id; none until the legs arrive (or ever, for a trip with no legs file), and then every step is a dashed estimate
  const slugOf = useMemo(() => {
    const by = new Map<string, string>();
    for (const d of dayRows) for (const s of [...d.stops, ...(d.tracks ?? []).flatMap((t) => t.stops)]) if (s.placeSlug) by.set(s.id, s.placeSlug);
    return (k: string) => by.get(k) ?? null;
  }, [dayRows]);
  const geometry = useMemo(() => (legs ? legGeometry(legs.legs, models, route.bases, slugOf, pointLookup(route)) : undefined), [legs, models, slugOf, route]);
  const base = useMemo(() => routeSpec({ bases: route.bases, models, picked, geometry, wide }), [route.bases, models, picked, geometry, wide]);
  const day = picked === null ? null : models.find((m) => m.day === picked) ?? null;
  const { morning, night } = picked === null ? { morning: undefined, night: undefined } : dayBases(route.bases, picked);

  // ---- when the Google map is requested: in view on a desktop, after the sheet opens on a phone or tablet, never before a Save-Data visitor asks ----
  useEffect(() => {
    const el = box.current;
    if (!el || !google) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setInView(true); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [google]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // a frame later, outside the observer callback, so a width-driven re-render cannot trigger the loop error
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWide(el.clientWidth >= 560));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const seen = inView || typeof IntersectionObserver === 'undefined';
  const armed = !google || ((!narrow || sheetSeen) && seen);
  const mount = !google || (armed && (!saving || forced));

  // ---- the routed legs: one request when the map mounts, never with the trip (D-E5). A failure leaves the estimates ----
  useEffect(() => {
    if (!mount) return;
    let live = true;
    const settle = () => { if (live) setSettled(true); };
    const timer = window.setTimeout(settle, linesHoldMs);
    tripLegs(slug).then((r) => live && setLegs(r)).catch(() => undefined).finally(() => { window.clearTimeout(timer); settle(); });
    return () => { live = false; window.clearTimeout(timer); };
  }, [mount, slug]);

  const held = mount && !settled;
  // while held the pins draw at once and the lines are left out; the camera is fitted from `base`'s ids, so lines arriving later never move it
  const spec = useMemo(() => ({ ...base, ...(held ? { lines: [] } : {}), hover }), [base, hover, held]);

  // ---- the camera follows the day; the first fit is made when the map is created ----
  const lastFit = useRef<string | null>(null);
  const fitIds = base.fit && base.fit !== 'all' ? base.fit.ids : undefined;
  const fitKey = `${picked}|${models.length}|${fitIds?.join(',') ?? 'all'}`;
  useEffect(() => {
    if (lastFit.current === null) { lastFit.current = fitKey; return; }
    if (lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    handle.current?.fit(fitIds);
  }, [fitKey, fitIds]);

  // ---- hover and click, both ways (note 7) ----
  const legFor = useCallback((pin: string | null): string | null => {
    if (!pin || picked === null) return null;
    const first = pin.split('+')[0]!;
    const n = day?.pins.find((p) => p.id === first)?.n;
    const id = n ? `leg:${picked}:${n}` : null;
    return id && base.lines.some((l) => l.id === id) ? id : null;
  }, [day, picked, base.lines]);
  const rowsFor = useCallback((pin: string | null) => {
    document.querySelectorAll('[data-hover]').forEach((e) => e.removeAttribute('data-hover'));
    if (!pin) return;
    for (const id of pin.split('+')) document.querySelectorAll(`[data-pin="${CSS.escape(id)}"]`).forEach((e) => e.setAttribute('data-hover', ''));
  }, []);
  useEffect(() => {
    let timer = 0;
    const ring = (pin: string) => {
      window.clearTimeout(timer);
      ringing.current = true;
      let waited = 0;
      // the sheet may have just opened and the Google map still be loading: the ring starts when the map is there (or after 8 s, never)
      const go = () => {
        if (google && waited < 8000 && !document.querySelector('[data-trip-map][data-phase="ready"]')) {
          waited += 150;
          timer = window.setTimeout(go, 150);
          return;
        }
        setHover({ pin, leg: null });
        const at = base.pins.find((p) => p.id === pin)?.at;
        if (at) handle.current?.flyTo(at);
        timer = window.setTimeout(() => { ringing.current = false; setHover(null); }, ringMs);
      };
      go();
    };
    const off = mapBus.on((e) => {
      if (e.type === 'ring') { ring(e.pin); return; }
      // a tap makes the browser send a mouseover and then a mouseout for the row: the ring a number asked for outlasts them
      if (ringing.current && !e.pin) return;
      ringing.current = false;
      window.clearTimeout(timer);
      setHover(e.pin ? { pin: e.pin, leg: legFor(e.pin) } : null);
    });
    const early = mapBus.takePending();
    if (early?.type === 'ring') ring(early.pin);
    return () => { off(); window.clearTimeout(timer); };
  }, [legFor, base.pins, google]);
  const onHover = useCallback((id: string | null) => {
    rowsFor(id);
    setHover(id ? { pin: id, leg: legFor(id) } : null);
  }, [legFor, rowsFor]);
  useEffect(() => () => rowsFor(null), [rowsFor, picked]);
  const onSelect = useCallback((id: string | null) => {
    if (!id) return;
    if (id.startsWith('dot:')) {
      const d = base.pins.find((p) => p.id === id)?.days?.[0];
      if (d === undefined) return;
      const pin = models.find((x) => x.day === d)?.pins.find((p) => p.id.endsWith(id.slice(3)));
      onPickDay(d, pin?.entryIds[0] ? `${d}:${pin.entryIds[0]}` : undefined);
      return;
    }
    const d = Number(id.split(':')[1]);
    const e = models.find((x) => x.day === d)?.pins.find((p) => p.id === id)?.entryIds[0];
    if (e) revealEntry(`${d}:${e}`);
  }, [base.pins, models, onPickDay]);

  // the sheet opens with the label row focused: the heading is hidden on a phone, and a screen reader should land on what the map shows
  useEffect(() => {
    if (sheet && narrow) labelRef.current?.focus({ preventScroll: true });
  }, [sheet, narrow]);

  // ---- the text around the map ----
  const trip = useMemo(() => ({ stops: base.pins.filter((p) => p.style === 'stop').length, missing: models.reduce((n, m) => n + m.missing, 0) }), [base.pins, models]);
  const label = labelOf({ day: picked, // the day card names the base; on a phone the one-line label keeps the count instead
    baseName: narrow && day?.pins.length ? null : (route.days.find((d) => d.n === picked)?.base ?? null), baseOnMap: !!night, model: day, trip, paused: paused && picked === null, compact: narrow });
  // held: the key names the pins only and says nothing about lines yet, so it never claims "not drawn yet" and then changes its mind
  const key = useMemo(() => {
    if (!held) return keyOf(base);
    const k = keyOf({ ...base, lines: [] });
    return { items: k.items, sentence: null, lead: null };
  }, [base, held]);
  const unplaced = picked === null ? models.flatMap((m) => m.unplaced.map((u) => ({ ...u, day: m.day }))) : (day?.unplaced ?? []).map((u) => ({ ...u, day: picked }));
  const dir = day ? dayDirections(day.day, day.pins.map((p) => p.at), morning ? { lng: morning.lng, lat: morning.lat } : null, night ? { lng: night.lng, lat: night.lat } : null) : null;

  return (
    <>
      <p className="tl-mapcol-label num" aria-live="polite" ref={labelRef} tabIndex={-1}>
        <span className="tl-mapcol-text">
          {paused ? (
            <>
              Paused · <button type="button" className="tl-reset" onClick={onResume}>{dayNow !== null ? `Follow Day ${dayNow}` : 'Follow the days'}</button> · {label.text}
            </>
          ) : (
            label.text
          )}
        </span>
        {label.missing > 0 ? (
          <span className="tl-mapcol-missing">
            {'\u00a0·\u00a0'}
            {unplaced.length ? (
              <button type="button" className="tl-reset" aria-expanded={listOpen} aria-controls="tl-nomap-list" onClick={() => setListOpen((v) => !v)}>
                {label.missing} not on the map
              </button>
            ) : (
              <span>{label.missing} not on the map</span>
            )}
          </span>
        ) : null}
      </p>
      {listOpen && unplaced.length ? (
        <ul id="tl-nomap-list" className="tl-nomap-list" data-print="hide">
          {unplaced.map((u) => (
            <li key={`${u.day}:${u.id}`}>
              <button type="button" className="tl-reset" onClick={() => revealEntry(`${u.day}:${u.id}`)}>
                <span aria-hidden="true">– </span>
                {picked === null ? `Day ${u.day} · ` : ''}
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <RouteKey state={key} />
      <div ref={box} className="tl-mapbox">
        {/* first in the DOM so Tab goes from the Map key toggle straight to the open panel (review M1, WCAG 2.4.3) */}
        <div className="tl-mapkey-slot" />
        {mount && geometry && hasRoutedLegs(geometry) && base.lines.some((l) => l.style === 'route' || l.style === 'route-pick') ? (
          <p className="tl-credit num" data-testid="route-credit" title={legs?.attribution || undefined}>
            {wide ? 'Route lines © ' : 'Routes © '}
            <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">{wide ? 'OpenStreetMap contributors' : 'OpenStreetMap'}</a>
          </p>
        ) : null}
        {mount ? (
          <MapSurface ref={handle} spec={spec} label={picked === null ? 'Route map, all days' : `Route map, Day ${picked}`} className="trip-map-surface" onHover={onHover} onSelect={onSelect} />
        ) : armed && saving ? (
          <div className="tl-facade" data-trip-facade>
            <ol className="tl-facade-list">
              {(day?.pins ?? []).map((p) => (
                <li key={p.id}>
                  <span className="num">{p.n}</span> {p.name}
                </li>
              ))}
            </ol>
            <button type="button" className="tl-facade-load" onClick={() => setForced(true)}>Load the map</button>
          </div>
        ) : (
          <div role="status" className="trip-map-surface tl-mapph">Loading the map</div>
        )}
      </div>
      <p className="tl-mapcol-actions" data-print="hide">
        {picked === null ? (
          <span className="tl-directions-off">Pick a day for directions</span>
        ) : dir ? (
          <a className="tl-directions" href={dir.url} target="_blank" rel="noopener noreferrer">
            {dir.label} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="tl-directions-off">No directions for Day {picked}: it has fewer than two places on the map</span>
        )}
      </p>
    </>
  );
}
