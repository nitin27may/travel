'use client';

import { Button } from '@/components/ui/Button';
import { EmptyState as EmptyBlock } from '@/components/ui/EmptyState';
import { activeFilters, clearAll, filterRows } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  rows: readonly Row[];
  labelOf: (param: FacetParam, value: string) => string;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** Never a dead end: names the filters that removed the rows and offers one-tap ways back (components 6.1). */
export function EmptyState<Row>({ d, state, rows, labelOf, onState }: Props<Row>) {
  const chips = activeFilters(state, d, labelOf);
  const options = chips
    .map((c) => ({ chip: c, n: filterRows(rows, c.without, d).length }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const withoutQuery = state.q.trim() ? filterRows(rows, { ...state, q: '' }, d).length : 0;
  const nothingToFilter = !chips.length && !state.q.trim();

  if (nothingToFilter) return <EmptyBlock glyph="search" title={`No ${d.noun.many} yet`} why="When some are added they will show up here." />;
  return (
    <EmptyBlock
      glyph="search"
      title={`No ${d.noun.many} match`}
      why={d.emptyHint}
      action={
        <Button variant="primary" onClick={() => onState(clearAll(state), 'push')}>
          Clear all filters
        </Button>
      }
      secondary={
        <ul className="empty-list">
          {withoutQuery > 0 ? (
            <li>
              <Button onClick={() => onState({ ...state, q: '', focus: null }, 'push')}>
                Clear the search to see {withoutQuery} {withoutQuery === 1 ? d.noun.one : d.noun.many}
              </Button>
            </li>
          ) : null}
          {options.map(({ chip, n }) => (
            <li key={chip.key}>
              <Button onClick={() => onState(chip.without, 'push')}>
                Remove &ldquo;{chip.label}&rdquo; to see {n} {n === 1 ? d.noun.one : d.noun.many}
              </Button>
            </li>
          ))}
        </ul>
      }
    />
  );
}
