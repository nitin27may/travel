'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { EmptyState as MapPlaceholder } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PAGE_SIZE, Pager } from '@/components/ui/Pager';
import type { Applied } from '@/lib/search/applied';
import type { ParsedQuery } from '@/lib/search/parse/types';
import type { UncheckedRowsProps } from '@/components/search/UncheckedRows';
import { listPlacesChecked, listTrips, peekPlacesChecked, registerList, registerShardedList } from '@/lib/client/data';
import type { PlacesAnswer } from '@/lib/client/data';
import { manifestCounts } from '@/lib/entities/shards';
import type { ListManifest } from '@/lib/entities/shards';
import type { UncheckedGroup } from '@/lib/entities/gaps';
import { registry } from '@/lib/entities/registry';
import { fallbackLabel } from '@/lib/entities/valueLabels';
import { activeGroup, groupRows } from '@/lib/entities/sort';
import type { EntityDescriptor, EntityType, FacetParam, ViewName } from '@/lib/entities/types';
import { mergeCountries } from './whereModel';
import { CardsView } from './CardsView';
import type { DetailSheetProps } from './DetailSheet';
import { EmptyState } from './EmptyState';
import { FilterBar, partitionFacets } from './FilterBar';
import { PhoneSummary } from './PhoneSummary';
import { useMediaQuery } from './useMediaQuery';
import { ListSkeleton } from './ListSkeleton';
import { ListView } from './ListView';
import type { ViewProps } from './viewTypes';
import { focusWasPushed, useUrlState } from './useUrlState';
import { MAP_DISABLED_NOTE } from './ViewSwitcher';
import { dropDependents } from '@/lib/entities/filter';
import { stillApplies, undoState } from '@/lib/search/applied';

// The table (TanStack Table and Virtual) and the detail sheet load when first needed, which keeps
// the list pages inside the JS budget. dynamic() drops the generic parameter, so it is restored here.
const TableView = dynamic(() => import('./TableView').then((m) => m.TableView), { ssr: false, loading: () => <p className="muted table-loading">Loading table</p> }) as unknown as <Row>(props: ViewProps<Row>) => ReactElement | null;
const DetailSheet = dynamic(() => import('./DetailSheet').then((m) => m.DetailSheet), { ssr: false }) as unknown as <Row>(props: DetailSheetProps<Row>) => ReactElement | null;

// "Not checked yet" (H1) loads when a filter leaves rows with no answer, never with the first paint
const UncheckedRows = dynamic(() => import('@/components/search/UncheckedRows'), { ssr: false }) as unknown as <Row>(props: UncheckedRowsProps<Row>) => ReactElement | null;

type Answer<Row> = Omit<PlacesAnswer, 'rows' | 'unchecked'> & { rows: Row[]; unchecked: UncheckedGroup<Row>[] };

const VIEW_TITLES: Record<ViewName, string> = { cards: 'Cards view', list: 'List view', table: 'Table view', map: 'Map view' };

interface Props<Row> {
  type: EntityType;
  /** Every row of a short list (Trips); the first page of a sharded one (Places). */
  rows: Row[];
  /** A sharded list's manifest: the rows beyond `rows` are files the data module loads for the query (backlog 3.59). */
  shards?: ListManifest;
  lede: string;
}

/** Reads the URL, filters once, and hands the same rows to whichever view is active. */
export function EntityPage<Row>({ type, rows, shards, lede }: Props<Row>) {
  const d = registry[type] as EntityDescriptor<Row>;
  const [state, setState] = useUrlState();
  const searchRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [sheetEver, setSheetEver] = useState(false);
  // a reading the search box applied, until the visitor undoes it or changes those filters by hand (backlog 3.43)
  const [applied, setApplied] = useState<Applied | null>(null);
  // the reading the box shows before Enter: the list is held, not filtered by the sentence (backlog 3.43 review M1)
  const [reading, setReading] = useState<ParsedQuery | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Back and Forward restore the undo line (SQ1b S2): the reading rides in the history entry it created. When the URL changes under us, take
  // the entry's reading if it still holds, and drop ours if it no longer does.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    const saved = typeof window === 'undefined' ? null : ((window.history.state as { travelApplied?: Applied } | null)?.travelApplied ?? null);
    if (saved && stillApplies(state, saved)) setApplied(saved);
    else if (applied && !stillApplies(state, applied)) setApplied(null);
  }
  useEffect(() => {
    const here = window.history.state as { travelApplied?: Applied } | null;
    if ((here?.travelApplied ?? null) === applied) return;
    window.history.replaceState({ ...here, travelApplied: applied }, '');
  }, [applied, state]);

  // the list answers come from the data module, in the shape a server will answer (principle P9)
  const version = shards ? registerShardedList(d, rows, shards) : registerList(d, rows);
  const asked = useMemo(() => (reading ? { ...state, q: '' } : state), [state, reading]);
  const view: ViewName = state.view === 'map' ? 'map' : state.view;
  const pageSize = PAGE_SIZE[view];
  // the map needs every match; the other views read one page, which for the plain list is a run of the row files
  const windowSize = view === 'map' ? undefined : pageSize;
  const [arrived, setArrived] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<number | null>(null);
  const answer = useMemo((): Answer<Row> | null => {
    void version;
    void arrived;
    if (d.type === 'trip') return { ...listTrips(asked), unchecked: [] } as unknown as Answer<Row>;
    return peekPlacesChecked(asked, undefined, windowSize) as unknown as Answer<Row> | null;
  }, [version, arrived, asked, windowSize, d]);
  // an answer waits on the files of its scope: ask for them, and look again when they are in
  useEffect(() => {
    if (answer) return;
    let live = true;
    listPlacesChecked(asked, undefined, windowSize).then(
      () => live && setArrived((n) => n + 1),
      () => live && setFailed(attempt),
    );
    return () => {
      live = false;
    };
  }, [answer, asked, windowSize, attempt]);
  // while the next answer loads, the filter bar keeps the options of the last one (set during render, the pattern React asks for)
  const [lastCounts, setLastCounts] = useState(shards ? manifestCounts(shards) : {});
  if (answer && answer.counts !== lastCounts) setLastCounts(answer.counts);
  const unchecked = answer?.unchecked ?? [];
  const matched = answer?.matched ?? 0;
  // grouping by country with one country chosen would head the whole list with that country's name again: no header then
  const chosen = activeGroup(state, d);
  const group = chosen?.id === 'country' && (state.facets.country?.length ?? 0) === 1 ? null : chosen;
  // 48 cards or 100 rows a page, with `?page=` in the URL (components 8.5)
  const pages = Math.max(1, Math.ceil(matched / pageSize));
  const page = Math.min(state.page, pages);
  const paged = useMemo(() => {
    if (!answer) return [] as Row[];
    return view === 'map' ? answer.rows : answer.rows.slice((page - 1) * pageSize - answer.offset, page * pageSize - answer.offset);
  }, [answer, view, page, pageSize]);
  const groups = useMemo(() => groupRows(paged, group), [paged, group]);
  // the Where menu's country level is the manifest's list, with the exact counts of the countries that are loaded
  const counts = useMemo(() => {
    const held = answer?.counts ?? lastCounts;
    return shards && d.type === 'place' ? mergeCountries(held, manifestCounts(shards).country, state) : held;
  }, [answer, lastCounts, shards, d, state]);
  const notes = answer?.notes ?? [];
  // value -> label for every facet, from the rows we hold and the options we know, so a chip keeps its name when its rows are filtered out
  const labels = useMemo(() => {
    const map: Record<string, Map<string, string>> = {};
    for (const f of d.facets) {
      const m = new Map<string, string>();
      for (const r of rows) for (const o of f.options(r)) if (!m.has(o.value)) m.set(o.value, o.label);
      for (const list of [counts[f.param], shards ? manifestCounts(shards)[f.param] : undefined]) for (const o of list ?? []) if (!m.has(o.value)) m.set(o.value, o.label);
      map[f.param] = m;
    }
    return map;
  }, [rows, shards, counts, d]);
  const labelOf = (param: FacetParam, value: string) => labels[param]?.get(value) ?? fallbackLabel(param, value);
  const focusRow = state.focus && d.primary === 'sheet' ? (rows.find((r) => d.id(r) === state.focus) ?? null) : null;
  if (focusRow && !sheetEver) setSheetEver(true); // load the sheet code the first time a row is focused

  // under 640 px the bar scrolls away and a 52 px summary takes its place once it has (lists-stage4-note section 1)
  const phone = useMediaQuery('(max-width: 639px)');
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !phone) return;
    const io = new IntersectionObserver(([e]) => setScrolledPast(!!e && !e.isIntersecting && e.boundingClientRect.top < 56), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [phone]);
  const compact = phone && scrolledPast;

  // the table's sticky header sits under the sticky filter bar (on a phone, under the summary line while it shows)
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--bar-h', phone ? (compact ? '52px' : '0px') : `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone, compact]);

  const liveReading = applied && stillApplies(state, applied) ? applied : null;
  const { primary, more } = partitionFacets(d, state, counts);
  const kindValues = state.facets.k?.length === 1 ? state.facets.k : state.facets.kind?.length === 1 ? state.facets.kind : [];
  const scopeNoun = kindValues.length === 1 && !state.facets.k?.[1] ? labelOf((state.facets.k?.length ? 'k' : 'kind') as FacetParam, kindValues[0]!).toLowerCase() : d.noun.many;

  // a deep link to ?focus=<id> scrolls the row into view once
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!state.focus || scrolled.current === state.focus) return;
    scrolled.current = state.focus;
    const el = document.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(state.focus)}"]`);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state.focus, view]);

  // tell screen readers what changed when the view or the count changes (a live region speaks changes, not what was there at load)
  const announce = answer ? `${VIEW_TITLES[view]}, ${matched} ${matched === 1 ? d.noun.one : d.noun.many}` : '';

  const onOpen = (id: string, el: HTMLElement) => {
    trigger.current = el;
    setState({ ...state, focus: id }, 'push');
  };
  const onClose = () => {
    if (focusWasPushed()) window.history.back();
    else setState({ ...state, focus: null }, 'replace');
  };

  const viewProps = { d, groups, state, onState: setState, onOpen };

  return (
    <>
      <header className="page-head">
        <h1>{d.heading}</h1>
        <p className="lede">{lede}</p>
      </header>

      <div className="filter-sticky bar-phone-flow" ref={barRef}>
        <FilterBar d={d} state={state} counts={counts} labelOf={labelOf} shown={answer ? matched : null} scope={answer?.scope ?? shards?.total ?? rows.length} scopeNoun={scopeNoun} unchecked={unchecked.reduce((a, g) => a + g.rows.length, 0)} gaps={answer?.gaps ?? {}} searchRef={searchRef} notes={notes} smart={{ applied, onApplied: setApplied, onReading: setReading, slot, holding: reading !== null }} onState={setState} />
      </div>

      <div className="smart-slot" ref={setSlot} />
      <div className="bar-sentinel" ref={sentinel} aria-hidden="true" />
      {phone ? (
        <PhoneSummary
          d={d}
          state={state}
          show={compact}
          shown={answer ? matched : null}
          counts={counts}
          gaps={answer?.gaps ?? {}}
          primary={primary}
          hasMore={more.length > 0}
          labelOf={labelOf}
          reading={liveReading ? { filters: Object.keys(liveReading.parsed.facets).length, undo: () => { setState(undoState(liveReading), 'replace'); setApplied(null); } } : null}
          setFacet={(param, values) => {
            const next = { ...state, facets: { ...state.facets }, focus: null };
            if (values.length) next.facets[param] = values;
            else {
              delete next.facets[param];
              dropDependents(next.facets, d, param);
            }
            setState(next, 'push');
          }}
          onState={setState}
        />
      ) : null}

      <section className="results" aria-labelledby="results-heading" data-view={view}>
        <h2 id="results-heading" className="sr-only">
          {VIEW_TITLES[view]}, {answer ? `${matched} ${matched === 1 ? d.noun.one : d.noun.many}` : 'counting'}
        </h2>
        {!answer ? (
          <ListSkeleton view={view} count={pageSize} failed={failed === attempt} onRetry={() => setAttempt((n) => n + 1)} />
        ) : matched === 0 ? (
          <EmptyState<Row> d={d} state={state} labelOf={labelOf} applied={applied} onApplied={setApplied} uncheckedCount={unchecked.reduce((a, g) => a + g.rows.length, 0)} onState={setState} />
        ) : view === 'cards' ? (
          <CardsView {...viewProps} />
        ) : view === 'list' ? (
          <ListView {...viewProps} />
        ) : view === 'table' ? (
          <TableView {...viewProps} />
        ) : d.renderMap ? (
          d.renderMap(answer.rows, state)
        ) : (
          <MapPlaceholder
            glyph="map"
            title={MAP_DISABLED_NOTE}
            why="The same filters will apply on the map. For now, use cards, list or table."
            action={
              <Button variant="primary" onClick={() => setState({ ...state, view: 'cards' }, 'push')}>
                Back to cards
              </Button>
            }
          />
        )}
        {answer && matched > 0 && view !== 'map' ? <Pager page={page} pageSize={pageSize} total={matched} onPage={(p) => setState({ ...state, page: p }, 'push')} /> : null}
        {unchecked.length > 0 && view !== 'map' ? <UncheckedRows d={d} groups={unchecked} /> : null}
      </section>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      {sheetEver ? <DetailSheet d={d} row={focusRow} onClose={onClose} trigger={trigger} /> : null}
    </>
  );
}
