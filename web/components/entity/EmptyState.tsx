'use client';

import { Button } from '@/components/ui/Button';
import { EmptyState as EmptyBlock } from '@/components/ui/EmptyState';
import { stillApplies, undoState } from '@/lib/search/applied';
import type { Applied } from '@/lib/search/applied';
import { relaxQuery } from '@/lib/client/data';
import { activeFilters, filterRows } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';
import { decodeState } from '@/lib/entities/url';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  rows: readonly Row[];
  labelOf: (param: FacetParam, value: string) => string;
  /** A reading the search box applied (backlog 3.43): the empty answer then offers to drop the chip that costs the most. */
  applied?: Applied | null;
  onApplied?: (a: Applied | null) => void;
  /** Rows listed apart as "not checked yet": they have no answer for a constraint, so they are not matches. */
  uncheckedCount?: number;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/**
 * Never a dead end (components 6.1, principle P4). Names the nearest match first: the single change that brings results back
 * and keeps the most of what was asked, which is the removal that leaves the fewest rows. The bar's own "Clear all" stays the
 * only Clear all on the page; this block offers it only when no one change would help.
 */
export function EmptyState<Row>({ d, state, rows, labelOf, applied, onApplied, uncheckedCount = 0, onState }: Props<Row>) {
  const chips = activeFilters(state, d, labelOf);
  const options = chips
    .map((c) => ({ chip: c, n: filterRows(rows, c.without, d).length }))
    .filter((o) => o.n > 0)
    .sort((a, b) => a.n - b.n)
    .slice(0, 3);
  const withoutQuery = state.q.trim() ? filterRows(rows, { ...state, q: '' }, d).length : 0;
  const nothingToFilter = !chips.length && !state.q.trim();
  const noun = (n: number) => (n === 1 ? d.noun.one : d.noun.many);

  const live = applied && stillApplies(state, applied) ? applied : null;
  if (live) {
    const relax = relaxQuery(live.parsed);
    const kept = relax ? decodeState(relax.href.split('?')[1] ?? '').facets : null;
    const relaxed: ListState | null = kept
      ? { ...state, facets: Object.fromEntries(Object.entries(state.facets).filter(([k]) => !(k in live.parsed.facets) || k in kept)), focus: null }
      : null;
    const back = relax ? Number(/: (\d+) /.exec(relax.label)?.[1]) : 0;
    return (
      <EmptyBlock
        glyph="search"
        title={`No ${d.noun.many} match all of this`}
        why={
          <>
            {relax && back > 0 ? `Nothing has every one of these answers yet. Drop the one that costs the most and ${back} ${noun(back)} come back.` : 'Nothing has every one of these answers yet. Remove a chip above to widen it.'}
            {uncheckedCount ? ` ${uncheckedCount} more have no answer yet and are listed apart below.` : ''}
          </>
        }
        action={
          relax && relaxed ? (
            <Button variant="primary" onClick={() => onState(relaxed, 'push')}>
              {relax.label}
            </Button>
          ) : undefined
        }
        secondary={
          <Button
            onClick={() => {
              onState(undoState(live), 'push');
              onApplied?.(null);
            }}
          >
            Search the words instead
          </Button>
        }
      />
    );
  }
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
