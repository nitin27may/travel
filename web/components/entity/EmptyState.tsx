'use client';

import { Button } from '@/components/ui/Button';
import { EmptyState as EmptyBlock } from '@/components/ui/EmptyState';
import { activeFilters, filterRows } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  rows: readonly Row[];
  labelOf: (param: FacetParam, value: string) => string;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/**
 * Never a dead end (components 6.1, principle P4). Names the nearest match first: the single change that brings results back
 * and keeps the most of what was asked, which is the removal that leaves the fewest rows. The bar's own "Clear all" stays the
 * only Clear all on the page; this block offers it only when no one change would help.
 */
export function EmptyState<Row>({ d, state, rows, labelOf, onState }: Props<Row>) {
  const chips = activeFilters(state, d, labelOf);
  const options = chips
    .map((c) => ({ chip: c, n: filterRows(rows, c.without, d).length }))
    .filter((o) => o.n > 0)
    .sort((a, b) => a.n - b.n)
    .slice(0, 3);
  const withoutQuery = state.q.trim() ? filterRows(rows, { ...state, q: '' }, d).length : 0;
  const nothingToFilter = !chips.length && !state.q.trim();
  const noun = (n: number) => (n === 1 ? d.noun.one : d.noun.many);

  if (nothingToFilter) return <EmptyBlock glyph="search" title={`No ${d.noun.many} yet`} why="When some are added they will show up here." />;
  const [nearest, ...others] = options;
  return (
    <EmptyBlock
      glyph="search"
      title={`No ${d.noun.many} match`}
      why={nearest ? 'Nothing fits all of these. The closest match is one filter away.' : 'No single change brings places back. Take off filters one at a time, or use Clear all above.'}
      action={
        nearest ? (
          <Button variant="primary" onClick={() => onState(nearest.chip.without, 'push')}>
            Remove &ldquo;{nearest.chip.label}&rdquo; to see {nearest.n} {noun(nearest.n)}
          </Button>
        ) : withoutQuery > 0 ? (
          <Button variant="primary" onClick={() => onState({ ...state, q: '', focus: null }, 'push')}>
            Clear the search to see {withoutQuery} {noun(withoutQuery)}
          </Button>
        ) : undefined
      }
      secondary={
        <ul className="empty-list">
          {nearest && withoutQuery > 0 ? (
            <li>
              <Button onClick={() => onState({ ...state, q: '', focus: null }, 'push')}>
                Clear the search to see {withoutQuery} {noun(withoutQuery)}
              </Button>
            </li>
          ) : null}
          {others.map(({ chip, n }) => (
            <li key={chip.key}>
              <Button onClick={() => onState(chip.without, 'push')}>
                Remove &ldquo;{chip.label}&rdquo; to see {n} {noun(n)}
              </Button>
            </li>
          ))}
        </ul>
      }
    />
  );
}
