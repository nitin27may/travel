'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import type { MapHandle } from '@/lib/map/types';
import type { Category } from '@/lib/public/types';
import { CategoryStrip } from './CategoryStrip';
import { CategoryView } from './CategoryView';
import { DayRow } from './DayRow';
import { DEPTH_NOTICE } from './format';
import { routeHasPositions, type TripPageModel } from './model';
import { dayFitIds, RouteKey, TripRouteMap } from './TripRouteMap';
import { useTripUrl } from './useTripUrl';

interface Props {
  slug: string;
  model: TripPageModel;
  title: string;
  depth: 'full' | 'summary';
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The route map and "In this trip": the category strip, the By day / By category segment, the uniform day rows.
 * A picked day highlights on the map; By category regroups the same items and never changes the order inside a day.
 */
export function TripPlan({ slug, model, title, depth }: Props) {
  const url = useTripUrl();
  const showCategory = url.view === 'category';
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
  const [active, setActive] = useState<Category | null>(null);
  const map = useRef<MapHandle>(null);
  const top = useRef<HTMLElement>(null);
  // opening a row writes `#day-N` so the link can be shared; the page must not jump to a row the reader just clicked
  const quiet = useRef(false);

  const pick = useCallback(
    (n: number) => {
      setPicked(n);
      setOpen((prev) => new Set(prev).add(n));
    },
    [],
  );

  // `#day-3` opens and picks that day, on load and on Back (state adjusted while rendering, not in an effect)
  const [seenDay, setSeenDay] = useState<number | null>(null);
  if (url.day !== seenDay) {
    setSeenDay(url.day);
    if (url.day !== null && model.days.some((d) => d.n === url.day)) pick(url.day);
  }

  // fly to the picked day
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (picked !== null) map.current?.fit(dayFitIds(model.route, picked));
  }, [picked, model.route]);

  // an anchor (`#day-5`, `#trails`) scrolls to its target once the right view is on screen; an empty category goes to the strip
  useEffect(() => {
    if (!url.hash) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    const id = url.category && !model.sections.find((s) => s.id === url.category)?.count ? 'in-this-trip' : url.hash;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [url.hash, url.view, url.category, model.sections]);

  // scroll-spy in By category: the chip for the section in view takes the active look
  useEffect(() => {
    if (url.view !== 'category') return;
    const sections = [...document.querySelectorAll<HTMLElement>('section[data-cat]')];
    if (!sections.length) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set((e.target as HTMLElement).dataset.cat as string, e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY);
        const best = [...seen].filter(([, t]) => Number.isFinite(t)).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
        if (best) setActive(best[0] as Category);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [url.view, model.sections]);

  const toggle = (n: number) => {
    const isOpen = open.has(n);
    if (isOpen) {
      setOpen((prev) => {
        const next = new Set(prev);
        next.delete(n);
        return next;
      });
      return;
    }
    pick(n);
    quiet.current = true;
    url.go({ view: 'day', hash: `day-${n}` }, 'replace');
  };

  return (
    <>
      <section className="trip-sec" aria-labelledby="route-h" id="route" data-print="hide">
        <h2 id="route-h" className="trip-h">The route</h2>
        {!routeHasPositions(model.route) ? (
          <p className="trip-sec-note" data-testid="route-unplaced">
            Stop positions are not researched yet, so there is no route map for this plan. The days below list every stop.
          </p>
        ) : (
        <>
        <p className="trip-sec-note">
          Every day&apos;s stops as dots, the bases as signposts. Lines are straight estimates between stops; road routes come later.
          {model.route.unplaced ? ` ${model.route.unplaced} stops have no map position yet.` : ''} Pick a day below to follow it.
        </p>
        <MapFamilyProvider family="maplibre">
          <TripRouteMap ref={map} route={model.route} picked={picked} title={title} />
        </MapFamilyProvider>
        <RouteKey />
        </>
        )}
      </section>

      <section className="trip-sec" aria-labelledby="in-trip-h" id="in-this-trip" ref={top}>
        <h2 id="in-trip-h" className="trip-h">In this trip</h2>
        {depth === 'summary' ? (
          <p className="trip-depth">
            <Chip kind="honest">{DEPTH_NOTICE.summary}</Chip>
          </p>
        ) : null}
        <div data-print="hide">
        <Segmented
          label="Group the trip"
          size="md"
          value={showCategory ? 'category' : 'day'}
          onChange={(v) => url.go({ view: v, hash: undefined }, 'push')}
          segments={[
            { value: 'day', label: 'By day' },
            { value: 'category', label: 'By category' },
          ]}
          className="trip-seg"
        />
        </div>
        <CategoryStrip sections={model.sections} active={showCategory ? active : null} sticky={showCategory} onPick={(id) => url.go({ view: 'category', hash: id }, 'push')} />
        {model.sections.filter((s) => s.count === 0).map((s) => (
          <span key={s.id} id={s.id} className="anchor-top" />
        ))}
        {showCategory ? (
          <CategoryView sections={model.sections} />
        ) : (
          <ol className="day-list">
            {model.days.map((d) => (
              <DayRow key={d.n} trip={{ slug, title }} day={d} open={open.has(d.n)} picked={picked === d.n} onToggle={toggle} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
