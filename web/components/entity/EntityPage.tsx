'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { EmptyState as MapPlaceholder } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PAGE_SIZE, Pager } from '@/components/ui/Pager';
import { listPlaces, listTrips, registerList } from '@/lib/client/data';
import { registry } from '@/lib/entities/registry';
import { activeGroup, groupRows } from '@/lib/entities/sort';
import type { EntityDescriptor, EntityType, FacetParam, ViewName } from '@/lib/entities/types';
import { CardsView } from './CardsView';
import type { DetailSheetProps } from './DetailSheet';
import { EmptyState } from './EmptyState';
import { FilterBar } from './FilterBar';
import { ListView } from './ListView';
import type { ViewProps } from './viewTypes';
import { focusWasPushed, useUrlState } from './useUrlState';
import { MAP_DISABLED_NOTE } from './ViewSwitcher';

// The table (TanStack Table and Virtual) and the detail sheet load when first needed, which keeps
// the list pages inside the JS budget. dynamic() drops the generic parameter, so it is restored here.
const TableView = dynamic(() => import('./TableView').then((m) => m.TableView), { ssr: false, loading: () => <p className="muted table-loading">Loading table</p> }) as unknown as <Row>(props: ViewProps<Row>) => ReactElement | null;
const DetailSheet = dynamic(() => import('./DetailSheet').then((m) => m.DetailSheet), { ssr: false }) as unknown as <Row>(props: DetailSheetProps<Row>) => ReactElement | null;

const VIEW_TITLES: Record<ViewName, string> = { cards: 'Cards view', list: 'List view', table: 'Table view', map: 'Map view' };

interface Props<Row> {
  type: EntityType;
  rows: Row[];
  lede: string;
}

/** Reads the URL, filters once, and hands the same rows to whichever view is active. */
export function EntityPage<Row>({ type, rows, lede }: Props<Row>) {
  const d = registry[type] as EntityDescriptor<Row>;
  const [state, setState] = useUrlState();
  const searchRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [announce, setAnnounce] = useState('');
  const [sheetEver, setSheetEver] = useState(false);

  // the list answers come from the data module, in the shape a server will answer (principle P9)
  const version = registerList(d, rows);
  const answer = useMemo(() => (void version, d.type === 'trip' ? listTrips(state) : listPlaces(state)) as unknown as ReturnType<typeof listPlaces> & { rows: Row[] }, [version, state, d]);
  const sorted = answer.rows as Row[];
  const filtered = sorted;
  // grouping by country with one country chosen would head the whole list with that country's name again: no header then
  const chosen = activeGroup(state, d);
  const group = chosen?.id === 'country' && (state.facets.country?.length ?? 0) === 1 ? null : chosen;
  // 48 cards or 100 rows a page, with `?page=` in the URL (components 8.5)
  const view: ViewName = state.view === 'map' ? 'map' : state.view;
  const pageSize = PAGE_SIZE[view];
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(state.page, pages);
  const paged = useMemo(() => (view === 'map' ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize)), [sorted, view, page, pageSize]);
  const groups = useMemo(() => groupRows(paged, group), [paged, group]);
  const counts = answer.counts;
  const notes = answer.notes;
  // value -> label for every facet, from all rows, so a chip keeps its name when its rows are filtered out
  const labels = useMemo(() => {
    const map: Record<string, Map<string, string>> = {};
    for (const f of d.facets) {
      const m = new Map<string, string>();
      for (const r of rows) for (const o of f.options(r)) if (!m.has(o.value)) m.set(o.value, o.label);
      map[f.param] = m;
    }
    return map;
  }, [rows, d]);
  const labelOf = (param: FacetParam, value: string) => labels[param]?.get(value) ?? value;
  const focusRow = state.focus && d.primary === 'sheet' ? (rows.find((r) => d.id(r) === state.focus) ?? null) : null;
  if (focusRow && !sheetEver) setSheetEver(true); // load the sheet code the first time a row is focused

  // the table's sticky header sits under the sticky filter bar
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a deep link to ?focus=<id> scrolls the row into view once
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!state.focus || scrolled.current === state.focus) return;
    scrolled.current = state.focus;
    const el = document.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(state.focus)}"]`);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state.focus, view]);

  // tell screen readers what changed when the view or the count changes
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAnnounce(`${VIEW_TITLES[view]}, ${filtered.length} ${filtered.length === 1 ? d.noun.one : d.noun.many}`);
  }, [view, filtered.length, d]);

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

      <div className="filter-sticky" ref={barRef}>
        <FilterBar d={d} state={state} counts={counts} labelOf={labelOf} shown={filtered.length} total={rows.length} searchRef={searchRef} notes={notes} onState={setState} />
      </div>

      <section className="results" aria-labelledby="results-heading" data-view={view}>
        <h2 id="results-heading" className="sr-only">
          {VIEW_TITLES[view]}, {filtered.length} {filtered.length === 1 ? d.noun.one : d.noun.many}
        </h2>
        {filtered.length === 0 ? (
          <EmptyState d={d} state={state} rows={rows} labelOf={labelOf} onState={setState} />
        ) : view === 'cards' ? (
          <CardsView {...viewProps} />
        ) : view === 'list' ? (
          <ListView {...viewProps} />
        ) : view === 'table' ? (
          <TableView {...viewProps} />
        ) : d.renderMap ? (
          d.renderMap(filtered, state)
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
        {filtered.length > 0 && view !== 'map' ? <Pager page={page} pageSize={pageSize} total={sorted.length} onPage={(p) => setState({ ...state, page: p }, 'push')} /> : null}
      </section>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      {sheetEver ? <DetailSheet d={d} row={focusRow} onClose={onClose} trigger={trigger} /> : null}
    </>
  );
}
