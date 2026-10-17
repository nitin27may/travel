'use client';

import { activeFilters, clearAll, filterRows } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';
import { Icon } from '@/components/ui/Icon';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  rows: readonly Row[];
  labelOf: (param: FacetParam, value: string) => string;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** Never a dead end: names the filters that removed the rows and offers one-tap ways back. */
export function EmptyState<Row>({ d, state, rows, labelOf, onState }: Props<Row>) {
  const chips = activeFilters(state, d, labelOf);
  const options = chips
    .map((c) => ({ chip: c, n: filterRows(rows, c.without, d).length }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const withoutQuery = state.q.trim() ? filterRows(rows, { ...state, q: '' }, d).length : 0;
  const nothingToFilter = !chips.length && !state.q.trim();

  return (
    <div className="empty" role="status">
      <Icon name="search" size={28} />
      {nothingToFilter ? (
        <>
          <h2>No {d.noun.many} yet</h2>
          <p>When some are added they will show up here.</p>
        </>
      ) : (
        <>
          <h2>No {d.noun.many} match</h2>
          <p>{d.emptyHint}</p>
          <ul className="empty-actions">
            {withoutQuery > 0 ? (
              <li>
                <button type="button" className="btn" onClick={() => onState({ ...state, q: '', focus: null }, 'push')}>
                  Clear the search to see {withoutQuery} {withoutQuery === 1 ? d.noun.one : d.noun.many}
                </button>
              </li>
            ) : null}
            {options.map(({ chip, n }) => (
              <li key={chip.key}>
                <button type="button" className="btn" onClick={() => onState(chip.without, 'push')}>
                  Remove &ldquo;{chip.label}&rdquo; to see {n} {n === 1 ? d.noun.one : d.noun.many}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="btn btn-primary" onClick={() => onState(clearAll(state), 'push')}>
                Clear all filters
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
