'use client';

// The route map column: label row, key, the map, Directions (map note 3 to 10). This whole file is a dynamic chunk of the trip page
// (TripPlan loads it with next/dynamic), so none of it counts against the page's start JS (D-E9).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MapSurface } from '@/components/map/MapSurface';
import { tripPageFamily } from '@/lib/map/family';
import { registerPageFamily } from '@/lib/map/registry';
import type { MapHandle } from '@/lib/map/types';
import { dayDirections } from './directions';
import { dayBases, mapBus, type DayMap } from './mapPins';
import type { RouteModel } from './model';
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

/** The key above the map: only what the map draws in this view, then one sentence about the lines. On a phone, one line and "Map key" for the rest. */
export function RouteKey({ state }: { state: KeyState }) {
  const narrow = useNarrow();
  const [asked, setAsked] = useState(false);
  const open = !narrow || asked;
  const items = open ? state.items : state.items.filter((i) => i.id === 'estimate' || i.id === 'road').slice(0, 1);
  return (
    <div className="trip-map-key" data-print="hide">
      <ul id="trip-map-key-list" className="trip-map-key-list" aria-label="Map key">
        {items.map((k) => (
          <li key={k.id}>
            <span className="key-swatch" data-key={k.id} aria-hidden="true">{k.id === 'stop' ? '1' : null}</span>
            {k.label}
          </li>
        ))}
      </ul>
      {open && state.sentence ? <p className="trip-map-key-note">{state.sentence}</p> : null}
      {narrow ? (
        <button type="button" className="trip-map-key-toggle" aria-expanded={asked} aria-controls="trip-map-key-list" onClick={() => setAsked((v) => !v)}>
          Map key
        </button>
      ) : null}
    </div>
  );
}

export interface TripRouteMapProps {
  route: RouteModel;
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

export default function TripRouteMap({ route, models, picked, paused, dayNow, onResume, sheet, sheetSeen, onPickDay }: TripRouteMapProps) {
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

  const base = useMemo(() => routeSpec({ bases: route.bases, models, picked, wide }), [route.bases, models, picked, wide]);
  const spec = useMemo(() => ({ ...base, hover }), [base, hover]);
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
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const seen = inView || typeof IntersectionObserver === 'undefined';
  const armed = !google || ((!narrow || sheetSeen) && seen);
  const mount = !google || (armed && (!saving || forced));

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
  const label = labelOf({ day: picked, baseName: route.days.find((d) => d.n === picked)?.base ?? null, baseOnMap: !!night, model: day, trip, paused: paused && picked === null });
  const key = useMemo(() => keyOf(base), [base]);
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
            {' · '}
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
