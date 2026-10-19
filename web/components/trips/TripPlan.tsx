'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { Banner } from '@/components/ui/Banner';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import { publishTimeline, registerYoungest } from '@/lib/export/timelineState';
import type { MapHandle } from '@/lib/map/types';
import type { Category } from '@/lib/public/types';
import '@/styles/timeline.css';
import { CategoryStrip } from './CategoryStrip';
import { CategoryView } from './CategoryView';
import { DayRow } from './DayRow';
import { DEPTH_NOTICE } from './format';
import { routeHasPositions, type TripPageModel } from './model';
import { DayTimeline } from './timeline/DayTimeline';
import { orderRoute, timeOfRow } from './timeline/model';
import { PlanBar } from './timeline/PlanBar';
import { ProfileBar } from './timeline/ProfileBar';
import { TripTimeline } from './timeline/TripTimeline';
import { useTimeline } from './timeline/useTimeline';
import { dayFitIds, RouteKey, TripRouteMap } from './TripRouteMap';
import { useTripUrl } from './useTripUrl';

interface Props {
  slug: string;
  model: TripPageModel;
  title: string;
  depth: 'full' | 'summary';
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The "Suggested times" banner, once above the first day (spec 2.12). */
function TimesBanner({ condensed }: { condensed: boolean }) {
  return (
    <Banner kind="notice" className="tl-banner" icon="clock">
      {condensed ? (
        <>
          <b>Parts of the day.</b> This plan was condensed, so each day lists its stops in order with a part of the day, not clock times. Flights and transfers are the plan&apos;s own.
        </>
      ) : (
        <>
          <b>Suggested times.</b> Built from the plan and our rules for your party. Times marked Slot are fixed by the operator; sun times are a range for the season. Check opening hours before you go.
        </>
      )}
    </Banner>
  );
}

/**
 * The trip as a timeline: the "Suggested times" banner, the party profile, the whole trip at a glance, the route map, then each
 * day on a time rail (trip-timeline spec). A picked day highlights on the map; By category regroups the same items and never
 * changes the order inside a day. Trips without schedule data keep the plain day rows.
 */
export function TripPlan({ slug, model, title, depth }: Props) {
  const url = useTripUrl();
  const tlModel = model.timeline;
  if (!tlModel) return <PlainPlan slug={slug} model={model} title={title} depth={depth} />;
  return <TimelinePlan slug={slug} model={model} title={title} depth={depth} tlModel={tlModel} url={url} />;
}

function TimelinePlan({ slug, model, title, depth, tlModel, url }: Props & { tlModel: NonNullable<TripPageModel['timeline']>; url: ReturnType<typeof useTripUrl> }) {
  const api = useTimeline(tlModel, url);
  const showCategory = url.view === 'category';
  const [picked, setPicked] = useState<number | null>(null);
  const [inView, setInView] = useState<number | null>(null);
  const [active, setActive] = useState<Category | null>(null);
  const map = useRef<MapHandle>(null);

  // `#day-3` picks that day, on load and on Back (state adjusted while rendering, not in an effect)
  const [seenDay, setSeenDay] = useState<number | null>(null);
  if (url.day !== seenDay) {
    setSeenDay(url.day);
    if (url.day !== null && tlModel.days.some((d) => d.n === url.day)) setPicked(url.day);
  }

  const route = useMemo(() => orderRoute(model.route, api.timelines), [model.route, api.timelines]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (picked !== null) map.current?.fit(dayFitIds(route, picked));
  }, [picked, route]);

  // an anchor (`#day-5`, `#trails`) scrolls to its target once the right view is on screen; an empty category goes to the strip
  useEffect(() => {
    if (!url.hash) return;
    const id = url.category && !model.sections.find((s) => s.id === url.category)?.count ? 'in-this-trip' : url.hash;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [url.hash, url.view, url.category, model.sections]);

  // scroll-spy: the rail's cell for the day on screen takes the active look
  useEffect(() => {
    if (showCategory) return;
    const days = [...document.querySelectorAll<HTMLElement>('li.tl-day')];
    if (!days.length) return;
    const seen = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(Number((e.target as HTMLElement).id.replace('day-', '')), e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY);
        const best = [...seen].filter(([, t]) => Number.isFinite(t)).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
        if (best) setInView(best[0]);
      },
      { rootMargin: '-25% 0px -60% 0px' },
    );
    days.forEach((d) => io.observe(d));
    return () => io.disconnect();
  }, [showCategory, api.timelines.length]);

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

  // the copy sheet and the calendar file read the timeline the visitor is looking at
  useEffect(() => {
    publishTimeline({
      slug, profile: api.state.profile, defaults: { ...tlModel.defaultProfile, adults: 2 }, overrides: api.state.overrides, added: api.state.added.map((a) => ({ day: a.day, placeSlug: a.slug })),
      timelines: api.timelines, sunPoints: Object.fromEntries(tlModel.days.map((d) => [d.n, d.input.sunPoint])),
    });
    return () => publishTimeline(null);
  }, [slug, tlModel, api.state, api.timelines]);
  const setProfile = api.setProfile;
  const party = api.state.profile.party;
  useEffect(() => {
    registerYoungest((age) => setProfile(age === null ? { party: 'adults', youngest: null } : { party: 'family', youngest: age }));
    return () => registerYoungest(null);
  }, [setProfile, party]);

  const pickDay = useCallback((n: number) => url.go({ view: 'day', hash: `day-${n}` }, 'push'), [url]);
  const sections = useMemo(
    () => model.sections.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, time: timeOfRow(r, r.days[0] ?? 0, api.timelines) ?? r.time })) })),
    [model.sections, api.timelines],
  );
  const p = api.state.profile;
  const planLabel = !api.changed ? 'Plan as written' : `${p.party === 'adults' ? 'Adults' : `Family, youngest ${p.youngest}`} · ${p.pace[0]!.toUpperCase()}${p.pace.slice(1)}`;

  return (
    <div className="tl-wrap">
      <TimesBanner condensed={tlModel.condensed} />
      <ProfileBar model={tlModel} api={api} />
      {!showCategory ? <TripTimeline model={tlModel} timelines={api.timelines} changedDays={api.changedDays} picked={picked} onPick={pickDay} /> : null}

      <section className="trip-sec" aria-labelledby="route-h" id="route" data-print="hide">
        <h2 id="route-h" className="trip-h">The route</h2>
        {!routeHasPositions(route) ? (
          <p className="trip-sec-note" data-testid="route-unplaced">
            Stop positions are not researched yet, so there is no route map for this plan. The days below list every stop.
          </p>
        ) : (
          <>
            <p className="trip-sec-note">
              Every day&apos;s stops as dots, the bases as signposts. Lines are straight estimates between stops; road routes come later.
              {route.unplaced ? ` ${route.unplaced} stops have no map position yet.` : ''} Pick a day below to follow it.
            </p>
            <MapFamilyProvider family="maplibre">
              <TripRouteMap ref={map} route={route} picked={picked} title={title} />
            </MapFamilyProvider>
            <RouteKey />
          </>
        )}
      </section>

      {!showCategory ? <PlanBar model={tlModel} label={planLabel} active={picked ?? inView} onPick={pickDay} /> : null}

      <section className="trip-sec" aria-labelledby="in-trip-h" id="in-this-trip">
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
          <CategoryView sections={sections} />
        ) : (
          <ol className="tl-days">
            {tlModel.days.map((d) => {
              const tl = api.timelines.find((t) => t.day === d.n)!;
              const mine = api.added[d.n] ?? [];
              return (
                <DayTimeline
                  key={d.n}
                  day={d}
                  tl={tl}
                  picked={picked === d.n}
                  changed={api.changedDays.has(d.n) && (api.state.overrides[d.n] !== undefined || mine.length > 0)}
                  candidates={(tlModel.addByDay[d.n] ?? []).map((k) => tlModel.addables[k]!).filter(Boolean)}
                  taken={mine.map((x) => x.key)}
                  addedKeys={new Map(mine.map((x) => [x.item.id, x.key]))}
                  age={p.party === 'family' ? p.youngest : null}
                  onSplit={(on) => api.setProfile({ split: on })}
                  onVariant={(k) => api.setVariant(d.n, k)}
                  onAdd={(k) => api.addPlace(d.n, k)}
                  onRemove={(k) => api.removePlace(d.n, k)}
                />
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/** A trip with no schedule data (a build without data/schedules): the route map and the plain day rows. */
function PlainPlan({ slug, model, title, depth }: Props) {
  const url = useTripUrl();
  const showCategory = url.view === 'category';
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
  const [active, setActive] = useState<Category | null>(null);
  const map = useRef<MapHandle>(null);
  const quiet = useRef(false);

  const pick = useCallback((n: number) => {
    setPicked(n);
    setOpen((prev) => new Set(prev).add(n));
  }, []);
  const [seenDay, setSeenDay] = useState<number | null>(null);
  if (url.day !== seenDay) {
    setSeenDay(url.day);
    if (url.day !== null && model.days.some((d) => d.n === url.day)) pick(url.day);
  }
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (picked !== null) map.current?.fit(dayFitIds(model.route, picked));
  }, [picked, model.route]);
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
    if (open.has(n)) {
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
      <section className="trip-sec" aria-labelledby="in-trip-h" id="in-this-trip">
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
