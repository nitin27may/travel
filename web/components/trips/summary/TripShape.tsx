'use client';

import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { tripShape } from '@travel/core/trips/shape.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { Icon } from '@/components/ui/Icon';
import type { TimelineDayModel } from '../timeline/model';
import '@/styles/trip-shape.css';
import { CountLine, Ribbon } from './ShapeParts';
import type { ShapeFacts, ShapePhraseKey } from './shapeTypes';

// The per-day table is its own chunk: it loads on the first open, or when a press is about to open it (pointer or focus on the toggle or a
// phrase), and never in the page's start JS (UXB-3 budget). This shell is itself a lazy chunk of the trip page, server-rendered.
const loadRows = () => import('./TripShapeRows');
const Rows = lazy(loadRows);

type Filter = Exclude<ShapePhraseKey, 'days'>;

interface Props {
  slug: string;
  facts: ShapeFacts;
  days: TimelineDayModel[];
  /** The timelines on screen: the plan as written on the server, the visitor's once the party differs. */
  timelines: DayTimeline[];
  changedDays: ReadonlySet<number>;
}

/** Remembers the open or closed state for this trip on this device (`travel.tripui`). The module loads on demand; blocked storage is silent. */
const remember = (slug: string, shapeOpen: boolean): void => {
  void import('@/lib/storage/tripUi').then((m) => m.writeTripEntry(slug, { shapeOpen }));
};

/** The shape of the timelines on screen. A day names the title of the version on screen; the plan's own drive figure stands in on a condensed day. */
export function buildShape(days: TimelineDayModel[], facts: ShapeFacts, timelines: readonly DayTimeline[], changedDays: ReadonlySet<number>) {
  const byDay = new Map(timelines.map((t) => [t.day, t]));
  return tripShape({
    days: days.map((d) => {
      const key = byDay.get(d.n)?.variant.key;
      return { n: d.n, title: d.variants.find((v) => v.key === key)?.title ?? d.title, base: d.base, plannedDriveMin: facts.planned[d.n] ?? null, variants: d.variants, flight: d.flight };
    }),
    bases: facts.bases,
    timelines,
    bookingDays: facts.bookingDays,
    highlightSlugs: facts.highlightSlugs,
    highlightVersions: facts.highlightVersions,
    changedDays,
  });
}

/**
 * The trip's shape (spec 4.2 to 4.5, W5): where you sleep, a count line, and on demand a table of the days. Closed by default at every
 * width; open or closed is remembered per trip. Each count phrase and the toggle are live disclosure buttons (components 3.2) (P2, P3, P6).
 */
export function TripShape({ slug, facts, days, timelines, changedDays }: Props) {
  const rid = `${useId().replace(/:/g, '')}-rows`;
  const model = useMemo(() => buildShape(days, facts, timelines, changedDays), [days, facts, timelines, changedDays]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [animate, setAnimate] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const [slow, setSlow] = useState(false);
  const touched = useRef(false);

  // landing: this trip's remembered state, unless the visitor has already pressed something
  useEffect(() => {
    let live = true;
    void import('@/lib/storage/tripUi').then((t) => {
      if (!live || touched.current || !t.readTripEntry(slug).shapeOpen) return;
      setWanted(true);
      setOpen(true);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  // a filter the party's timelines no longer have days for falls back to every day
  const f: Filter | null = filter && model.sets[filter].length ? filter : null;
  const intent = useCallback(() => void loadRows(), []);
  const onReady = useCallback(() => setReady(true), []);
  // the press changes state inside a transition: while the rows chunk loads the closed shape stays on screen, with no fallback to reveal late
  // (review UXB-3 M3); "Loading the days" shows only when the wait is long (a slow network)
  const set = (next: boolean, to: Filter | null) => {
    touched.current = true;
    start(() => {
      setAnimate(true);
      setFilter(to);
      setOpen(next);
      if (next) setWanted(true);
    });
    remember(slug, next);
    const of = to ? model.phrases.find((p) => p.key === to)?.text : null;
    setMsg(!next ? 'The days are hidden' : of ? `Showing ${model.sets[to!].length} of ${model.days} days: ${of}` : `Showing all ${model.days} days`);
  };
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setSlow(true), 300);
    return () => {
      window.clearTimeout(t);
      setSlow(false);
    };
  }, [pending]);
  const phrase = (key: ShapePhraseKey) => {
    const to = key === 'days' ? null : key;
    set(!(open && f === to), to);
  };
  const clearFilter = () => {
    set(true, null);
    // the button that cleared the filter goes with the filter; focus moves to the line's "all days" phrase
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#trip-shape [data-phrase="days"]')?.focus());
  };

  const shown = open && ready;
  const active: ShapePhraseKey | null = open ? (f ?? 'days') : null;
  return (
    <section id="trip-shape" className="sum-sec shape" aria-labelledby="shape-h" data-open={shown || undefined}>
      <div className="sum-sec-head">
        <h2 id="shape-h" className="trip-kicker-h">The trip&apos;s shape</h2>
        <button type="button" className="shape-toggle" aria-expanded={open} aria-controls={rid} onClick={() => set(!open, null)} onPointerEnter={intent} onFocus={intent} data-print="hide">
          {open ? 'Hide the days' : `Show all ${model.days} ${model.days === 1 ? 'day' : 'days'}`}
          <Icon name="chevronDown" size={16} className="shape-chev" />
        </button>
      </div>
      <Ribbon m={model} />
      <CountLine m={model} active={active} controls={rid} onPhrase={phrase} onIntent={intent} />
      <div id={rid} className="shape-body" data-open={shown || undefined} data-instant={!animate || undefined} data-print="hide">
        <div className="shape-body-in">
          {wanted ? (
            <Suspense fallback={null}>
              <Rows model={model} timelines={timelines} filter={f} onClear={clearFilter} onReady={onReady} />
            </Suspense>
          ) : null}
        </div>
      </div>
      {slow ? (
        <p role="status" className="shape-loading" data-print="hide">
          Loading the days
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {msg}
      </p>
    </section>
  );
}
