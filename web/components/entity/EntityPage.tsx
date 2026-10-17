'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { facetCounts, filterRows } from '@/lib/entities/filter';
import { registry } from '@/lib/entities/registry';
import { activeGroup, groupRows, sortRows } from '@/lib/entities/sort';
import type { EntityDescriptor, EntityType, FacetParam, ViewName } from '@/lib/entities/types';
import { CardsView } from './CardsView';
import { DetailSheet } from './DetailSheet';
import { EmptyState } from './EmptyState';
import { FilterBar } from './FilterBar';
import { ListView } from './ListView';
import { TableView } from './TableView';
import { focusWasPushed, useUrlState } from './useUrlState';
import { MAP_DISABLED_NOTE } from './ViewSwitcher';

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

  const filtered = useMemo(() => filterRows(rows, state, d), [rows, state, d]);
  const sorted = useMemo(() => sortRows(filtered, state, d), [filtered, state, d]);
  const group = activeGroup(state, d);
  const groups = useMemo(() => groupRows(sorted, group), [sorted, group]);
  const counts = useMemo(() => facetCounts(rows, state, d), [rows, state, d]);
  const labelOf = (param: FacetParam, value: string) => counts[param]?.find((o) => o.value === value)?.label ?? value;
  const focusRow = state.focus && d.primary === 'sheet' ? (rows.find((r) => d.id(r) === state.focus) ?? null) : null;
  const view: ViewName = state.view === 'map' ? 'map' : state.view;

  // "/" jumps to search, like most data tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <FilterBar d={d} state={state} counts={counts} shown={filtered.length} total={rows.length} searchRef={searchRef} onState={setState} />
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
        ) : (
          <div className="empty">
            <Icon name="map" size={28} />
            <h2>{MAP_DISABLED_NOTE}</h2>
            <p>The same filters will apply on the map. For now, use cards, list or table.</p>
            <button type="button" className="btn btn-primary" onClick={() => setState({ ...state, view: 'cards' }, 'push')}>
              Back to cards
            </button>
          </div>
        )}
      </section>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      <DetailSheet d={d} row={focusRow} onClose={onClose} trigger={trigger} />
    </>
  );
}
