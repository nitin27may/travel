'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import { activeFilters, clearAll, dropDependents } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState, ViewName } from '@/lib/entities/types';
import { FacetPopover } from './FacetMenu';
import type { PhoneFilterProps } from './PhoneFilterSheet';
import { useMediaQuery } from './useMediaQuery';
import { FacetLabel, ViewOptions } from './ViewOptions';
import { ViewSwitcher } from './ViewSwitcher';

export interface FilterBarProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  counts: Record<string, FacetCount[]>;
  labelOf: (param: FacetParam, value: string) => string;
  shown: number;
  total: number;
  searchRef: RefObject<HTMLInputElement | null>;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

function visibleFacets<Row>(d: EntityDescriptor<Row>, state: ListState): FacetDef<Row>[] {
  return d.facets.filter((f) => !f.dependsOn || (state.facets[f.dependsOn]?.length ?? 0) > 0);
}

// generic components lose their type parameter through dynamic(); restore it
const PhoneFilterSheet = dynamic(() => import('./PhoneFilterSheet'), { ssr: false }) as unknown as <Row>(props: PhoneFilterProps<Row>) => ReactElement | null;

export function FilterBar<Row>(props: FilterBarProps<Row>) {
  const { d, state, counts, labelOf, shown, total, searchRef, onState } = props;
  const phone = useMediaQuery('(max-width: 719px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEver, setSheetEver] = useState(false);
  const facets = visibleFacets(d, state);
  const chips = activeFilters(state, d, labelOf);
  const filtered = chips.length > 0 || state.q.trim().length > 0;
  const setFacet = (param: FacetParam, values: string[]) => {
    const next = { ...state, facets: { ...state.facets }, focus: null };
    if (values.length) next.facets[param] = values;
    else delete next.facets[param];
    // changing a parent facet resets what depends on it
    if (!values.length) dropDependents(next.facets, d, param);
    onState(next, 'push');
  };
  const changeView = (view: ViewName) => onState({ ...state, view, focus: null }, 'push');
  const activeCount = chips.length;

  return (
    <div className="filter-bar" role="search" aria-label={`Filter ${d.noun.many}`}>
      <div className="filter-row">
        <div className="search-field">
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${d.noun.many}`}
            aria-label={`Search ${d.noun.many}`}
            aria-keyshortcuts="/"
            autoComplete="off"
            value={state.q}
            onChange={(e) => onState({ ...state, q: e.target.value, focus: null }, 'replace')}
          />
          <kbd className="kbd" aria-hidden="true">
            /
          </kbd>
        </div>

        {phone ? (
          <>
            <button type="button" className="facet-btn filters-btn" data-active={activeCount > 0 || undefined} aria-haspopup="dialog" onClick={() => {
                setSheetEver(true);
                setSheetOpen(true);
              }}>
              <Icon name="filter" size={16} />
              <span>{activeCount ? `Filters (${activeCount})` : 'Filters'}</span>
            </button>
            {sheetEver ? (
              <PhoneFilterSheet d={d} state={state} facets={facets} counts={counts} shown={shown} filtered={filtered} open={sheetOpen} onOpenChange={setSheetOpen} setFacet={setFacet} onState={onState} />
            ) : null}
          </>
        ) : (
          <div className="facet-group" role="group" aria-label="Filters">
            {facets.map((f) => (
              <FacetPopover
                key={f.param}
                facet={f}
                options={counts[f.param] ?? []}
                selected={state.facets[f.param] ?? []}
                summary={<FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} />}
                onChange={(v) => setFacet(f.param, v)}
              />
            ))}
          </div>
        )}

        <ViewSwitcher view={state.view} onChange={changeView} />
      </div>

      <div className="filter-row filter-row-2">
        <p className="count" role="status" aria-live="polite">
          <strong className="num">{shown}</strong>
          {filtered ? <span className="of"> of {total}</span> : null} {total === 1 && !filtered ? d.noun.one : d.noun.many}
        </p>
        {chips.length ? (
          <ul className="chips" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" className="chip" onClick={() => onState(c.without, 'push')} aria-label={`Remove filter ${c.label}`}>
                  {c.label}
                  <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {filtered ? (
          <button type="button" className="link-btn" onClick={() => onState(clearAll(state), 'push')}>
            Clear all
          </button>
        ) : null}
        {!phone ? (
          <div className="row-end">
            <ViewOptions d={d} state={state} onState={onState} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
