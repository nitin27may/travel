'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { Banner } from '@/components/ui/Banner';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
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
import { dayOfHash } from './timeline/currentDay';
import { DayTimeline } from './timeline/DayTimeline';
import { orderRoute, timeOfRow } from './timeline/model';
import { PlanBar } from './timeline/PlanBar';
import { ProfileBar } from './timeline/ProfileBar';
import { TripSuitProvider } from '@/components/suit/TripSuit';
import { TripTimeline } from './timeline/TripTimeline';
import { useScrollSpy } from './timeline/useScrollSpy';
import { useTimeline } from './timeline/useTimeline';
import { useSwap } from './timeline/useSwap';
import { dayFitIds, RouteKey, TripRouteMap } from './TripRouteMap';
import { useTripUrl } from './useTripUrl';

interface Props {
  slug: string;
  model: TripPageModel;
  title: string;
  depth: 'full' | 'summary';
  /** The season band, drawn below "Plan it for" on a trip with a timeline and first on any other (server-rendered, passed through). */
  season?: ReactNode;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Family, 6 · Standard": who the plan is for right now, never "as written" (the sticky bar and the phone selector say it). */
export function profileLabel(p: { party: string; youngest: number | null; pace: string }): string {
  return `${p.party === 'adults' ? 'Adults' : `Family, ${p.youngest}`} · ${p.pace[0]!.toUpperCase()}${p.pace.slice(1)}`;
}

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
 * day on a time rail (trip-timeline spec). The day at the top of the screen is the current day: it lights the rail, the strip and the day, and the map follows it once scrolling settles; By category regroups the same items and never
 * changes the order inside a day. Trips without schedule data keep the plain day rows.
 */
export function TripPlan({ slug, model, title, depth, season }: Props) {
  const url = useTripUrl();
  const tlModel = model.timeline;
  if (!tlModel) return <PlainPlan slug={slug} model={model} title={title} depth={depth} season={season} />;
  return <TimelinePlan slug={slug} model={model} title={title} depth={depth} season={season} tlModel={tlModel} url={url} />;
}

function TimelinePlan({ slug, model, title, depth, season, tlModel, url }: Props & { tlModel: NonNullable<TripPageModel['timeline']>; url: ReturnType<typeof useTripUrl> }) {
  const api = useTimeline(tlModel, url);
  const [edit, setEdit] = useState(false);
  const pr = api.state.profile;
  const swap = useSwap(api.timelines, `${pr.party}|${pr.youngest}|${pr.pace}|${pr.adults}|${pr.walkKm}`, api.pending);
  const shown = swap.shown;
  const showCategory = url.view === 'category';
  const map = useRef<MapHandle>(null);
  // the hash this page wrote itself while following the scroll or jumping; the hash effect must not scroll to it again
  const ownHash = useRef<string | null>(null);

  // The current day is decided by the scroll position alone (design 3.4); a click or a `#day-N` link scrolls and pins it until the visitor scrolls on.
  // When a scroll settles, the URL follows with replaceState, so Back leaves the page instead of walking back through every day.
  const follow = useCallback(
    (day: number | null) => {
      const now = dayOfHash(window.location.hash);
      if (day === null ? now === null : now === day) return;
      ownHash.current = day === null ? '' : `day-${day}`;
      url.go({ view: 'day', hash: day === null ? undefined : `day-${day}` }, 'replace');
    },
    [url],
  );
  const daySpy = useScrollSpy<number>({
    enabled: !showCategory,
    itemSelector: 'li.tl-day',
    keyOf: (el) => dayOfHash(el.id),
    barSelector: '.tl-planbar',
    onSettle: follow,
  });
  const catSpy = useScrollSpy<Category>({
    enabled: showCategory,
    itemSelector: 'section[data-cat]',
    keyOf: (el) => (el.dataset.cat as Category | undefined) ?? null,
    barSelector: '.cat-strip',
    onSettle: (key) => {
      if (key && window.location.hash !== `#${key}`) {
        ownHash.current = key;
        url.go({ view: 'category', hash: key }, 'replace');
      }
    },
  });
  const current = showCategory ? null : daySpy.current;
  const active = showCategory ? catSpy.current : null;

  const route = useMemo(() => orderRoute(model.route, shown), [model.route, shown]);

  // The map follows the settled current day: the whole trip until Day 1 reaches the focus line, then that day, 350 ms after the scroll settles.
  // "All days" pauses following; "Follow Day N", a rail or strip click, or the Day segment resumes it.
  const [mapDay, setMapDay] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const dayNow = showCategory ? null : daySpy.reached;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setMapDay(dayNow), 350);
    return () => window.clearTimeout(t);
  }, [paused, dayNow]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.current?.fit(mapDay === null ? undefined : dayFitIds(route, mapDay));
  }, [mapDay, route]);
  useEffect(() => {
    if (!sheet) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSheet(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [sheet]);
  const placed = routeHasPositions(route);
  const mapDayModel = mapDay === null ? null : route.days.find((d) => d.n === mapDay) ?? null;
  const mapLabel = mapDayModel ? `Map: Day ${mapDayModel.n}${mapDayModel.base ? `, ${mapDayModel.base}` : ''}, ${mapDayModel.points.length} ${mapDayModel.points.length === 1 ? 'stop' : 'stops'}` : `Map: the whole trip${route.unplaced ? `, ${route.unplaced} stops not on the map` : ''}`;

  // an anchor (`#day-5`, `#trails`) scrolls to its target once the right view is on screen; an empty category goes to the strip
  const goDay = daySpy.goTo;
  const goCat = catSpy.goTo;
  const booted = useRef(false);
  useEffect(() => {
    if (!url.hash || ownHash.current === url.hash) return;
    // the first anchor (a shared link, a reload) lands at once; later ones glide
    const instant = !booted.current;
    booted.current = true;
    const id = url.category && !model.sections.find((s) => s.id === url.category)?.count ? 'in-this-trip' : url.hash;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const day = dayOfHash(id);
      if (day !== null && !showCategory) goDay(el, day, instant);
      else if (showCategory && url.category === id) goCat(el, url.category, instant);
      else if (showCategory) goCat(el, null, instant);
      else goDay(el, null, instant);
    });
    return () => cancelAnimationFrame(frame);
  }, [url.hash, url.view, url.category, model.sections, showCategory, goDay, goCat]);

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

  // A pick scrolls itself (lock, sticky offsets, pin) and writes the hash; the hash effect skips a hash it did not receive from outside.
  const pickDay = useCallback(
    (n: number) => {
      const el = document.getElementById(`day-${n}`);
      if (el) goDay(el, n);
      ownHash.current = `day-${n}`;
      setPaused(false);
      url.go({ view: 'day', hash: `day-${n}` }, 'push');
    },
    [url, goDay],
  );
  const sections = useMemo(
    () => model.sections.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, time: timeOfRow(r, r.days[0] ?? 0, shown) ?? r.time })) })),
    [model.sections, shown],
  );
  const p = api.state.profile;
  const planLabel = profileLabel(p);
  const editPlan = useCallback(() => {
    setEdit(true);
    document.getElementById('plan-for')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }, []);

  return (
    <TripSuitProvider value={{ byPlace: tlModel.suit, youngest: p.party === 'family' ? p.youngest : null }}>
    <div className="tl-wrap">
      <ProfileBar model={tlModel} api={api} edit={edit} setEdit={setEdit} label={planLabel} />
      {season}
      <TimesBanner condensed={tlModel.condensed} />
      {!showCategory ? <TripTimeline model={tlModel} timelines={shown} changedDays={api.changedDays} picked={current} onPick={pickDay} /> : null}

      {!showCategory ? <PlanBar model={tlModel} label={planLabel} active={current} onPick={pickDay} onEdit={editPlan} /> : null}

      <div className="tl-cols" data-map={placed || undefined}>
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
          <ol className="tl-days" data-swap={swap.phase}>
            {tlModel.days.map((d, di) => {
              const tl = shown.find((t) => t.day === d.n)!;
              const mine = api.added[d.n] ?? [];
              return (
                <DayTimeline
                  key={d.n}
                  index={di}
                  engine={api.engine}
                  loadEngine={api.loadEngine}
                  profile={api.state.profile}
                  override={api.state.overrides[d.n] ?? null}
                  addedItems={mine.map((x) => x.item)}
                  day={d}
                  tl={tl}
                  picked={current === d.n}
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
        <aside className="tl-mapcol" id="route" aria-labelledby="route-h" data-print="hide" data-sheet={sheet || undefined}>
          <h2 id="route-h" className="trip-h tl-mapcol-h">The route</h2>
          {!placed ? (
            <p className="trip-sec-note" data-testid="route-unplaced">
              Stop positions are not researched yet, so there is no route map for this plan. The days below list every stop.
            </p>
          ) : (
            <>
              <div className="tl-mapcol-bar">
                <Segmented
                  label="Map shows"
                  size="s"
                  value={paused || mapDay === null ? 'all' : 'day'}
                  onChange={(v) => {
                    if (v === 'all') {
                      setPaused(true);
                      setMapDay(null);
                    } else setPaused(false);
                  }}
                  segments={[
                    { value: 'all', label: 'All days' },
                    { value: 'day', label: mapDay === null ? 'Day' : `Day ${mapDay}`, disabled: !showCategory && dayNow === null && mapDay === null },
                  ]}
                />
                <button type="button" className="tl-mapcol-close" onClick={() => setSheet(false)} aria-label="Close map">
                  <Icon name="close" size={16} />
                </button>
              </div>
              <p className="tl-mapcol-label num" aria-live="polite">
                {paused ? (
                  <>
                    Paused · <button type="button" className="tl-reset" onClick={() => setPaused(false)}>{dayNow !== null ? `Follow Day ${dayNow}` : 'Follow the days'}</button>
                  </>
                ) : (
                  mapLabel
                )}
              </p>
              <MapFamilyProvider family="maplibre">
                <TripRouteMap ref={map} route={route} picked={paused ? null : mapDay} title={title} />
              </MapFamilyProvider>
              <p className="trip-sec-note tl-mapcol-note">Lines are straight estimates between stops; road routes come later.{route.unplaced ? ` ${route.unplaced} stops have no map position yet.` : ''}</p>
              <RouteKey />
            </>
          )}
        </aside>
      </div>
      {placed ? (
        <button type="button" className="tl-mappill" data-print="hide" data-hidden={sheet || undefined} aria-expanded={sheet} aria-controls="route" onClick={() => setSheet(true)}>
          <Icon name="map" size={18} /> {mapDay !== null && !paused ? `Map · Day ${mapDay}` : 'Map · All days'}
        </button>
      ) : null}
    </div>
    </TripSuitProvider>
  );
}

/** A trip with no schedule data (a build without data/schedules): the route map and the plain day rows. */
function PlainPlan({ slug, model, title, depth, season }: Props) {
  const url = useTripUrl();
  const showCategory = url.view === 'category';
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
  const catSpy = useScrollSpy<Category>({
    enabled: showCategory,
    itemSelector: 'section[data-cat]',
    keyOf: (el) => (el.dataset.cat as Category | undefined) ?? null,
    barSelector: '.cat-strip',
  });
  const active = showCategory ? catSpy.current : null;
  const goCat = catSpy.goTo;
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
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (showCategory) goCat(el, url.category === id ? url.category : null);
      else el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [url.hash, url.view, url.category, model.sections, showCategory, goCat]);
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
      {season}
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
