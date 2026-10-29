'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShapeFacts } from './summary/shapeTypes';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { TAB_LABEL, type TripTab } from '@travel/core/trips/tabs.ts';
import { Banner } from '@/components/ui/Banner';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { PageTabs } from '@/components/ui/PageTabs';
import { Segmented } from '@/components/ui/Segmented';
import { flightEntries, localEntries } from './timeline/marks';
import { publishTimeline } from '@/lib/export/timelineState';
import { tripPageFamily } from '@/lib/map/family';
import '@/styles/timeline.css';
import '@/styles/trip-tabs.css';
import '@/styles/day-tables.css';
import { DayRow } from './DayRow';
import { DEPTH_NOTICE } from './format';
import { dayMapFromRoute, dayMapOf, entryKey, mapBus, pointLookup } from './mapPins';
import { routeHasPositions, type TripPageModel } from './model';
import { dayOfHash } from './timeline/currentDay';
import { DayTimeline } from './timeline/DayTimeline';
import { MapLinkContext, type MapLinkValue } from './timeline/MapLink';
import { timeOfRow } from './timeline/model';
import { ProfileBar } from './timeline/ProfileBar';
import { TripSuitProvider } from '@/components/suit/TripSuit';
import { TripPanel } from './tabs/TripPanel';
import { followLink, useTripTabs } from './tabs/useTripTabs';
import { useScrollSpy } from './timeline/useScrollSpy';
import { useTimeline, type TimelineSource } from './timeline/useTimeline';
import { useTableRows } from './timeline/useTableRows';
import { useTimelineExtras } from './timeline/editSlots';
import { useSwap } from './timeline/useSwap';
import { useTripUrl } from './useTripUrl';

// The map column is its own chunk: it loads after the page, and the trip page's start JS does not carry it (D-E9).
const TripRouteMap = dynamic(() => import('./TripRouteMap'), {
  ssr: false,
  loading: () => (
    <div role="status" className="trip-map-surface tl-mapph">
      Loading the map
    </div>
  ),
});

// The Stops tab (the category chips, the by-category list and their scroll spy) is its own chunk: it loads on the first Stops choice or a
// direct view=all, never in the start JS (OVR-0, P1, budget v0.3; spec D12). Hovering or focusing the tab loads it ahead (`prefetchTab`).
const stopsChunk = () => import('./tabs/StopsPanel').then((m) => m.StopsPanel);
const StopsPanel = dynamic(stopsChunk, {
  ssr: false,
  loading: () => (
    <div role="status" className="cat-view">
      Loading the stops
    </div>
  ),
});
// The sticky plan bar is needed on Days only: it loads after the page, so the tab shell costs the trip page's start JS nothing net (spec D12). The
// bar's shell holds its place meanwhile.
const planBarChunk = () => import('./timeline/PlanBar').then((m) => m.PlanBar);
const PlanBar = dynamic(planBarChunk, {
  ssr: false,
  loading: () => <nav className="tl-planbar" aria-label="Days" data-print="hide" data-loading="" />,
});
// The trip's shape (UXB-3) is a lazy chunk that still renders on the server: its ribbon and count line are in the page's HTML, and its table is a
// further chunk that loads on the first open (summary/TripShape.tsx).
const tablesChunk = () => import('./timeline/DayTables');
const DayTables = dynamic(() => tablesChunk().then((m) => m.DayTables), {
  ssr: false,
  loading: () => (
    <p role="status" className="dt-loading">
      Loading the tables
    </p>
  ),
});
const TableTools = dynamic(() => tablesChunk().then((m) => m.TableTools), { ssr: false });
// the flag is written out here so a build with it off folds the hook away (the public page has no edit mode)
const useEditing: () => boolean = process.env.NEXT_PUBLIC_TRIP_EDIT === '1' ? () => !!useTimelineExtras()?.edit : () => false;
// what edit mode puts above Day 1 (the Make it yours card of a new copy)
const useBeforeDays: () => ReactNode = process.env.NEXT_PUBLIC_TRIP_EDIT === '1' ? () => useTimelineExtras()?.edit?.beforeDays?.() ?? null : () => null;
const TripShape = dynamic(() => import('./summary/TripShape').then((m) => m.TripShape));
/** A tab took focus: its lazy chunk loads now, so the press that follows opens it at once (components 1.6). */
const prefetchTab = (t: TripTab): void => {
  if (t === 'stops') void stopsChunk();
  else if (t === 'days') void planBarChunk();
  else if (t === 'photos') void import('@/components/ui/Gallery');
};

interface Props {
  slug: string;
  model: TripPageModel;
  title: string;
  depth: 'full' | 'summary';
  /** The season band: "When to go" in the Summary (server-rendered, passed through). */
  season?: ReactNode;
  /** The tabs the trip draws (`tripTabsFor`) and the counts the labels carry from 640 px. */
  tabs: { available: TripTab[]; counts: Partial<Record<TripTab, number>> };
  /** The server-rendered parts of the Summary, the Bookings panel and the Photos panel. */
  slots: { summaryTop: ReactNode; summaryBottom: ReactNode; bookings: ReactNode; photos: ReactNode };
  /** The facts the trip's shape needs besides the timelines; null draws no shape (a trip with no schedule). */
  shape: ShapeFacts | null;
  /** STEP2-T1: where the profile, versions and additions live, and the person's chrome around them. Absent: the address (the published plan). */
  source?: TimelineSource;
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
 * The trip as a timeline: the "Suggested times" banner, the party profile, the trip's shape (in the Summary), the route map, then each
 * day on a time rail (trip-timeline spec). The day at the top of the screen is the current day: it lights the rail, the strip and the day, and the map follows it once scrolling settles; By category regroups the same items and never
 * changes the order inside a day. Trips without schedule data keep the plain day rows.
 */
export function TripPlan(props: Props) {
  const url = useTripUrl();
  const tlModel = props.model.timeline;
  if (!tlModel) return <PlainPlan {...props} />;
  return <TimelinePlan {...props} tlModel={tlModel} url={url} />;
}

/** The published day an added day follows (it borrows that day's add list: the places near the base it sleeps at); Day 1's when none precedes it. */
function previousPublished(days: readonly { n: number; ref?: number | string }[], at: number): number {
  for (let i = at; i >= 0; i--) {
    const r = days[i]?.ref;
    if (typeof r === 'number') return r;
  }
  return 1;
}

/** The tab bar of the full page: labels from core, counts only where they add a fact. */
function Tabs({ tabs, api }: { tabs: Props['tabs']; api: ReturnType<typeof useTripTabs> }) {
  return (
    <PageTabs
      label="Trip sections"
      idPrefix="trip"
      tabs={tabs.available.map((t) => ({ value: t, label: TAB_LABEL[t], count: tabs.counts[t] ?? null, ...(t === 'stops' ? { hint: 'places in this trip, stops and options' } : {}) }))}
      value={api.tab}
      onActivate={api.select}
      onFocusTab={prefetchTab}
    />
  );
}

function TimelinePlan({ slug, model: pageModel, depth, season, tabs, slots, shape, tlModel: baseModel, url, source: given }: Props & { tlModel: NonNullable<TripPageModel['timeline']>; url: ReturnType<typeof useTripUrl> }) {
  // the person's own trip passes a source; a build with the flag off folds this to `undefined` (STEP2-T1F; the name is written out, see useTripUrl)
  const source = process.env.NEXT_PUBLIC_TRIP_EDIT === '1' ? given : undefined;
  const api = useTimeline(baseModel, url, source);
  // a copy whose person inserted or dropped a day draws the days the scheduler answered, numbered in order (STEP2-E4); every other page is unchanged
  const eff = api.eff;
  const tlModel = useMemo(() => (eff ? { ...baseModel, days: eff.days } : baseModel), [baseModel, eff]);
  const model = useMemo(
    () => (eff ? { ...pageModel, route: eff.route(pageModel.route), sections: pageModel.sections.map((c) => ({ ...c, rows: c.rows.map((r) => ({ ...r, days: r.days.flatMap((n) => eff.nOf(n) ?? []) })) })) } : pageModel),
    [pageModel, eff],
  );
  const tabApi = useTripTabs(slug, url, tabs.available);
  const tab = tabApi.tab;
  const onDays = tab === 'days';
  // Days, Stops and Bookings sit beside the route map; the Summary and the Photos do not (the map is mounted only where it is shown)
  const inLists = tab === 'days' || tab === 'stops' || tab === 'bookings';
  const [edit, setEdit] = useState(false);
  const pr = api.state.profile;
  const swap = useSwap(api.timelines, `${pr.party}|${pr.youngest}|${pr.pace}|${pr.adults}|${pr.walkKm}`, api.pending);
  const shown = swap.shown;
  // the hash this page wrote itself while following the scroll or jumping; the hash effect must not scroll to it again
  const ownHash = useRef<string | null>(null);

  // The current day is decided by the scroll position alone (design 3.4); a click or a `#day-N` link scrolls and pins it until the visitor scrolls on.
  // When a scroll settles, the URL follows with replaceState, so Back leaves the page instead of walking back through every day.
  const follow = useCallback(
    (day: number | null) => {
      const now = dayOfHash(window.location.hash);
      if (day === null ? now === null : now === day) return;
      ownHash.current = day === null ? '' : `day-${day}`;
      url.go({ tab: { tab: 'days', daysView: tabApi.daysView }, hash: day === null ? undefined : `day-${day}` }, 'replace');
    },
    [url, tabApi.daysView],
  );
  // the Table is a lazy chunk: an anchor waits until its tables are on screen, or it would scroll to the List's day that is about to be replaced
  const asTable = onDays && tabApi.daysView === 'table';
  const [tablesUp, setTablesUp] = useState(false);
  if (!asTable && tablesUp) setTablesUp(false);
  const viewReady = !asTable || tablesUp;
  const daySpy = useScrollSpy<number>({
    enabled: onDays && viewReady,
    itemSelector: 'li.tl-day',
    keyOf: (el) => dayOfHash(el.id),
    barSelector: '.tl-planbar',
    onSettle: follow,
  });
  const current = onDays ? daySpy.current : null;

  const route = model.route;
  // the pins of each day, numbered in the order of the day list; the rows and the map both read this
  const pointOf = useMemo(() => pointLookup(route), [route]);
  const maps = useMemo(() => shown.map((t) => dayMapOf(t, pointOf)), [shown, pointOf]);

  // The map follows the settled current day: the whole trip until Day 1 reaches the focus line, then that day, 350 ms after the scroll settles.
  // "All days" pauses following; "Follow Day N", a rail or strip click, or the Day segment resumes it.
  const [mapDay, setMapDay] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sheetSeen, setSheetSeen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const openSheet = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSheet(true);
    setSheetSeen(true);
  }, []);
  const closeSheet = useCallback(() => {
    setSheet(false);
    opener.current?.focus({ preventScroll: true });
  }, []);
  const dayNow = onDays ? daySpy.reached : null;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setMapDay(dayNow), 350);
    return () => window.clearTimeout(t);
  }, [paused, dayNow]);
  useEffect(() => {
    if (!sheet) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [sheet, closeSheet]);
  const placed = routeHasPositions(route);
  // an anchor (`#day-5`) scrolls to its day once Days is on screen; a followed link then moves focus to the day's heading (a category fragment is the Stops panel's)
  const goDay = daySpy.goTo;
  const booted = useRef(false);
  const focusPending = tabApi.focusPending;
  useEffect(() => {
    if (!onDays || !viewReady || !url.hash || ownHash.current === url.hash) return;
    // the first anchor (a shared link, a reload) lands at once; later ones glide
    const instant = !booted.current;
    booted.current = true;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(url.hash);
      if (!el) return;
      goDay(el, dayOfHash(url.hash), instant);
      if (focusPending.current) {
        focusPending.current = false;
        const h = el.querySelector<HTMLElement>('h2, h3, caption') ?? el;
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [onDays, viewReady, url.hash, goDay, focusPending]);

  // the copy sheet and the calendar file read the timeline the visitor is looking at
  useEffect(() => {
    publishTimeline({
      slug, profile: api.state.profile, defaults: { ...tlModel.defaultProfile, adults: 2 }, overrides: api.state.overrides, added: api.state.added.map((a) => ({ day: a.day, placeSlug: a.slug })),
      timelines: api.timelines, display: api.timelines.map((t) => { const d = tlModel.days.find((x) => x.n === t.day); return { ...t, entries: localEntries(flightEntries(t.entries, d?.flight), d?.zone) }; }),
      sunPoints: Object.fromEntries(tlModel.days.map((d) => [d.n, d.input.sunPoint])), route: model.route,
    });
    return () => publishTimeline(null);
  }, [slug, tlModel, api.state, api.timelines, model.route]);
  // A pick scrolls itself (lock, sticky offsets, pin) and writes the hash; the hash effect skips a hash it did not receive from outside.
  const goUrl = url.go;
  const daysView = tabApi.daysView;
  const pickDay = useCallback(
    (n: number, entry?: string) => {
      const el = (entry ? document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(entry)}"]`) : null) ?? document.getElementById(`day-${n}`);
      if (el) goDay(el, n);
      ownHash.current = `day-${n}`;
      setPaused(false);
      goUrl({ tab: { tab: 'days', daysView }, hash: `day-${n}` }, 'push');
    },
    [goUrl, goDay, daysView],
  );
  const sections = useMemo(
    () => model.sections.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, time: timeOfRow(r, r.days[0] ?? 0, shown) ?? r.time })) })),
    [model.sections, shown],
  );
  // Days as List or as Table (UXB-5): the same timelines, a view of the same question. The Table is a lazy chunk and read-only; the day in view stays in view.
  const editing = useEditing();
  const beforeDays = useBeforeDays();
  const [rowsMode, setRowsMode] = useTableRows(slug, asTable);
  const areas = useMemo(() => Object.fromEntries(sections.flatMap((s) => s.rows).filter((r) => r.placeSlug && r.area).map((r) => [r.placeSlug!, r.area!])), [sections]);
  const keepDay = useRef<number | null>(null);
  const restoreDay = useCallback(() => {
    const n = keepDay.current;
    keepDay.current = null;
    if (n === null) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`day-${n}`);
      if (el) goDay(el, n, true);
    });
  }, [goDay]);
  useEffect(() => {
    if (daysView === 'list') restoreDay();
  }, [daysView, restoreDay]);
  const hashNow = url.hash;
  const setView = useCallback(
    (v: 'list' | 'table') => {
      if (v === daysView) return;
      keepDay.current = current;
      goUrl({ tab: { tab: 'days', daysView: v }, hash: dayOfHash(hashNow) === null ? undefined : hashNow }, 'push');
    },
    [daysView, goUrl, current, hashNow],
  );
  // the day list's side of the link to the map: numbers on the rows, "not on the map", and what a press on a number does
  const shownDay = paused ? null : mapDay;
  const live = useRef({ shownDay, sheet });
  useEffect(() => {
    live.current = { shownDay, sheet };
  });
  const link = useMemo<MapLinkValue>(() => {
    const numbers = new Map<string, number>();
    const pins = new Map<string, string>();
    const missing = new Set<string>();
    for (const m of maps) {
      for (const pin of m.pins) for (const id of pin.entryIds) {
        numbers.set(entryKey(m.day, id), pin.n);
        pins.set(entryKey(m.day, id), pin.id);
      }
      for (const u of m.unplaced) missing.add(entryKey(m.day, u.id));
    }
    return {
      numbers,
      pins,
      missing,
      mapDay: shownDay,
      show: (day, pinId) => {
        // another day's number picks that day; this day's number rings its pin, opening the sheet first on a phone or tablet
        if (day !== live.current.shownDay) {
          pickDay(day);
          return;
        }
        if (window.matchMedia('(max-width: 1023px)').matches && !live.current.sheet) openSheet();
        mapBus.emit({ type: 'ring', pin: pinId });
      },
    };
  }, [maps, shownDay, pickDay, openSheet]);
  // a row under the pointer or in focus rings its pin on the map: events on the map's bus, not React state, so the list does not re-render
  const hoverRow = useCallback((e: React.SyntheticEvent, on: boolean) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li.tl-entry[data-pin]');
    if (!li || Number(li.dataset.entry?.split(':')[0]) !== live.current.shownDay) return;
    const to = (e as React.MouseEvent).relatedTarget as Node | null;
    if (!on && to && li.contains(to)) return;
    mapBus.emit({ type: 'hover', pin: on ? (li.dataset.pin ?? null) : null });
  }, []);
  const p = api.state.profile;
  const planLabel = profileLabel(p);
  const editPlan = useCallback(() => {
    setEdit(true);
    document.getElementById('plan-for')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }, []);

  const onMap = placed ? () => (sheet ? closeSheet() : openSheet()) : undefined;
  const has = (t: TripTab): boolean => tabs.available.includes(t);

  return (
    <TripSuitProvider value={{ byPlace: tlModel.suit, youngest: p.party === 'family' ? p.youngest : null }}>
    <MapLinkContext.Provider value={placed ? link : null}>
    <div className="tl-wrap trip-tabs" data-tab={tab} onClick={(e) => followLink(e, tabApi.follow)}>
      {source?.chrome ? source.chrome.party({ model: tlModel, api, edit, setEdit }) : <ProfileBar model={tlModel} api={api} edit={edit} setEdit={setEdit} label={planLabel} />}
      <Tabs tabs={tabs} api={tabApi} />

      <TripPanel tab="summary" current={tab}>
        {slots.summaryTop}
        {season}
        {shape ? <TripShape slug={slug} facts={shape} days={tlModel.days} timelines={shown} changedDays={api.changedDays} /> : null}
        {slots.summaryBottom}
      </TripPanel>

      <div className="tl-lists" hidden={!inLists}>
        {onDays ? <TimesBanner condensed={tlModel.condensed} /> : null}
        {onDays ? <PlanBar slug={slug} model={tlModel} label={planLabel} active={current} onPick={pickDay} onEdit={editPlan} onMap={onMap} mapOpen={sheet} lead={source?.chrome?.lead} /> : null}

        <div className="tl-cols" data-map={(placed && inLists) || undefined} data-sheet-open={sheet || undefined}>
          <div className="tl-main">
            <TripPanel tab="days" current={tab}>
              <h2 className="sr-only">Days</h2>
              {depth === 'summary' ? (
                <p className="trip-depth">
                  <Chip kind="honest">{DEPTH_NOTICE.summary}</Chip>
                </p>
              ) : null}
              <div className="tl-viewbar" data-print="hide">
                <Segmented
                  label="Days view"
                  size="s"
                  value={daysView}
                  onChange={setView}
                  segments={[
                    { value: 'list', label: 'List', dataView: 'list' },
                    { value: 'table', label: 'Table', dataView: 'table' },
                  ]}
                />
                {asTable ? <TableTools mode={rowsMode} onMode={setRowsMode} /> : null}
              </div>
              {beforeDays}
              {asTable ? (
                <DayTables days={tlModel.days} timelines={shown} areas={areas} mode={rowsMode} editing={editing} onList={() => setView('list')} onShown={() => { setTablesUp(true); restoreDay(); }} />
              ) : (
              <ol className="tl-days" data-swap={swap.phase} onMouseOver={(e) => hoverRow(e, true)} onMouseOut={(e) => hoverRow(e, false)} onFocus={(e) => hoverRow(e, true)} onBlur={(e) => hoverRow(e, false)}>
                {tlModel.days.map((d, di) => {
                  const tl = shown.find((t) => t.day === d.n);
                  // the document names a day by its published number or an added day's id; the page shows Day n
                  const ref = (d as { ref?: number | string }).ref ?? d.n;
                  const pub = typeof ref === 'number' ? ref : null;
                  const mine = (pub !== null && api.added[pub]) || [];
                  if (!tl) return null;
                  return (
                    <DayTimeline
                      key={d.n}
                      index={di}
                      engine={api.engine}
                      loadEngine={api.loadEngine}
                      profile={api.state.profile}
                      override={(pub !== null && api.state.overrides[pub]) || null}
                      addedItems={mine.map((x) => x.item)}
                      day={d}
                      tl={tl}
                      picked={current === d.n}
                      changed={pub !== null && api.changedDays.has(pub) && (api.state.overrides[pub] !== undefined || mine.length > 0)}
                      candidates={(tlModel.addByDay[pub ?? previousPublished(tlModel.days, di)] ?? []).map((k) => tlModel.addables[k]!).filter(Boolean)}
                      taken={mine.map((x) => x.key)}
                      addedKeys={new Map(mine.map((x) => [x.item.id, x.key]))}
                      age={p.party === 'family' ? p.youngest : null}
                      onSplit={(on) => api.setProfile({ split: on })}
                      onVariant={(k) => pub !== null && api.setVariant(pub, k)}
                      onAdd={(k) => api.addPlace(ref as number, k)}
                      onRemove={(k) => api.removePlace(ref as number, k)}
                    />
                  );
                })}
              </ol>
              )}
            </TripPanel>
            {has('stops') && tabApi.seen.has('stops') ? (
              <TripPanel tab="stops" current={tab}>
                <h2 className="sr-only">Stops</h2>
                <StopsPanel sections={sections} active={tab === 'stops'} condensed={depth === 'summary'} url={url} onMap={onMap} mapOpen={sheet} focusRef={focusPending} />
              </TripPanel>
            ) : null}
            {has('bookings') ? <TripPanel tab="bookings" current={tab}>{slots.bookings}</TripPanel> : null}
          </div>
          {inLists ? (
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
                        { value: 'day', label: mapDay === null ? 'Day' : `Day ${mapDay}`, disabled: !onDays && mapDay === null },
                      ]}
                    />
                    <button type="button" className="tl-mapcol-close" onClick={closeSheet} aria-label="Close map">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <MapFamilyProvider family={tripPageFamily()}>
                    <TripRouteMap
                      slug={slug}
                      route={route}
                      dayRows={model.days}
                      models={maps}
                      picked={shownDay}
                      paused={paused}
                      dayNow={dayNow}
                      onResume={() => setPaused(false)}
                      sheet={sheet}
                      sheetSeen={sheetSeen}
                      onPickDay={pickDay}
                    />
                  </MapFamilyProvider>
                </>
              )}
            </aside>
          ) : null}
        </div>
      </div>

      {has('photos') && tabApi.seen.has('photos') ? <TripPanel tab="photos" current={tab}>{slots.photos}</TripPanel> : null}
    </div>
    </MapLinkContext.Provider>
    </TripSuitProvider>
  );
}

/** A trip with no schedule data (a build without data/schedules): the route map and the plain day rows, in the same tabs. */
function PlainPlan({ slug, model, title, depth, season, tabs, slots }: Props) {
  const url = useTripUrl();
  const tabApi = useTripTabs(slug, url, tabs.available);
  const tab = tabApi.tab;
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
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
  const maps = useMemo(() => model.route.days.map(dayMapFromRoute), [model.route.days]);
  useEffect(() => {
    if (tab !== 'days' || !url.hash) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => document.getElementById(url.hash)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [tab, url.hash]);
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
    url.go({ tab: { tab: 'days', daysView: 'list' }, hash: `day-${n}` }, 'replace');
  };
  const has = (t: TripTab): boolean => tabs.available.includes(t);
  return (
    <div className="tl-wrap trip-tabs" data-tab={tab} onClick={(e) => followLink(e, tabApi.follow)}>
      <Tabs tabs={tabs} api={tabApi} />
      <TripPanel tab="summary" current={tab}>
        {slots.summaryTop}
        {season}
        {slots.summaryBottom}
      </TripPanel>
      <TripPanel tab="days" current={tab}>
        {tab === 'days' ? (
          <section className="trip-sec" aria-labelledby="route-h" id="route" data-print="hide">
            <h2 id="route-h" className="trip-h">The route</h2>
            {!routeHasPositions(model.route) ? (
              <p className="trip-sec-note" data-testid="route-unplaced">
                Stop positions are not researched yet, so there is no route map for this plan. The days below list every stop.
              </p>
            ) : (
              <>
                <p className="trip-sec-note">
                  Every day&apos;s stops as dots, the bases as signposts. Dashed lines are straight lines between stops, not routes; road routes come later.
                  {model.route.unplaced ? ` ${model.route.unplaced} stops have no map position yet.` : ''} Pick a day below to follow it.
                </p>
                <MapFamilyProvider family={tripPageFamily()}>
                  <TripRouteMap slug={slug} route={model.route} dayRows={model.days} models={maps} picked={picked} paused={false} dayNow={picked} onResume={() => undefined} sheet={false} sheetSeen onPickDay={pick} />
                </MapFamilyProvider>
              </>
            )}
          </section>
        ) : null}
        <section className="trip-sec" aria-label="Days">
          {depth === 'summary' ? (
            <p className="trip-depth">
              <Chip kind="honest">{DEPTH_NOTICE.summary}</Chip>
            </p>
          ) : null}
          <ol className="day-list">
            {model.days.map((d) => (
              <DayRow key={d.n} trip={{ slug, title }} day={d} open={open.has(d.n)} picked={picked === d.n} onToggle={toggle} />
            ))}
          </ol>
        </section>
      </TripPanel>
      {has('stops') && tabApi.seen.has('stops') ? (
        <TripPanel tab="stops" current={tab}>
          <h2 className="sr-only">Stops</h2>
          <section className="trip-sec" aria-label="Stops">
            <StopsPanel sections={model.sections} active={tab === 'stops'} condensed={depth === 'summary'} url={url} focusRef={tabApi.focusPending} />
          </section>
        </TripPanel>
      ) : null}
      {has('bookings') ? <TripPanel tab="bookings" current={tab}>{slots.bookings}</TripPanel> : null}
      {has('photos') && tabApi.seen.has('photos') ? <TripPanel tab="photos" current={tab}>{slots.photos}</TripPanel> : null}
    </div>
  );
}
