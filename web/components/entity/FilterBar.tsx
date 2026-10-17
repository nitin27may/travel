'use client';

import { Dialog } from '@base-ui/react/dialog';
import type { RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import { activeFilters, clearAll, dropDependents } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import { parseSort, serialiseSort } from '@/lib/entities/sort';
import type { EntityDescriptor, FacetDef, FacetParam, ListState, ViewName } from '@/lib/entities/types';
import { FacetOptions, FacetPopover } from './FacetMenu';
import { useMediaQuery } from './useMediaQuery';
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

/** The button says what it filters and how many values are on; the chips below say which. */
function FacetLabel({ label, n }: { label: string; n: number }) {
  return (
    <>
      <span>{label}</span>
      {n > 0 ? (
        <span className="facet-n num">
          {n}
          <span className="sr-only"> selected</span>
        </span>
      ) : null}
    </>
  );
}

function visibleFacets<Row>(d: EntityDescriptor<Row>, state: ListState): FacetDef<Row>[] {
  return d.facets.filter((f) => !f.dependsOn || (state.facets[f.dependsOn]?.length ?? 0) > 0);
}

/** Group and sort pickers, shared by the bar (desktop) and the phone sheet. */
function ViewOptions<Row>({ d, state, onState }: Pick<FilterBarProps<Row>, 'd' | 'state' | 'onState'>) {
  const keys = parseSort(state.sort);
  const first = keys[0];
  const group = state.group ?? d.defaultGroup;
  return (
    <div className="view-options">
      <label className="select-field">
        <span>Group by</span>
        <select value={d.groupBy.some((g) => g.id === group) ? group : 'none'} onChange={(e) => onState({ ...state, group: e.target.value === d.defaultGroup ? null : e.target.value })}>
          {d.groupBy.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
          <option value="none">No grouping</option>
        </select>
      </label>
      <div className="select-field sort-field">
        <label>
          <span>Sort by</span>
          <select
            value={first?.id ?? ''}
            onChange={(e) => onState({ ...state, sort: e.target.value ? serialiseSort([{ id: e.target.value, desc: first?.desc ?? false }]) : [] })}
          >
            <option value="">{d.defaultSortLabel}</option>
            {Object.entries(d.sorts).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-btn"
          disabled={!first}
          aria-label={first?.desc ? 'Sorted descending. Switch to ascending' : 'Sorted ascending. Switch to descending'}
          title={first?.desc ? 'Descending' : 'Ascending'}
          onClick={() => first && onState({ ...state, sort: serialiseSort([{ id: first.id, desc: !first.desc }, ...keys.slice(1)]) })}
        >
          <Icon name="sort" size={16} className={first?.desc ? 'flip' : undefined} />
        </button>
      </div>
    </div>
  );
}

export function FilterBar<Row>(props: FilterBarProps<Row>) {
  const { d, state, counts, labelOf, shown, total, searchRef, onState } = props;
  const phone = useMediaQuery('(max-width: 719px)');
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
          <Dialog.Root>
            <Dialog.Trigger className="facet-btn filters-btn" data-active={activeCount > 0 || undefined}>
              <Icon name="filter" size={16} />
              <span>{activeCount ? `Filters (${activeCount})` : 'Filters'}</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="scrim" />
              <Dialog.Popup className="sheet sheet-bottom" aria-label="Filters">
                <header className="sheet-head">
                  <Dialog.Title className="sheet-title">Filters</Dialog.Title>
                  <Dialog.Close className="icon-btn" aria-label="Close filters">
                    <Icon name="close" size={18} />
                  </Dialog.Close>
                </header>
                <div className="sheet-body">
                  {facets.map((f) => (
                    <details key={f.param} className="sheet-facet" open={(state.facets[f.param]?.length ?? 0) > 0 || undefined}>
                      <summary>
                        <span className="summary-label">
                          <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} />
                        </span>
                        <Icon name="chevronDown" size={16} />
                      </summary>
                      <FacetOptions facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} />
                    </details>
                  ))}
                  <ViewOptions d={d} state={state} onState={onState} />
                </div>
                <footer className="sheet-foot">
                  <button type="button" className="btn" disabled={!filtered} onClick={() => onState(clearAll(state), 'push')}>
                    Clear all
                  </button>
                  <Dialog.Close className="btn btn-primary">
                    Show {shown} {shown === 1 ? d.noun.one : d.noun.many}
                  </Dialog.Close>
                </footer>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
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
