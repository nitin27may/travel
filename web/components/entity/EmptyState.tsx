'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState as EmptyBlock } from '@/components/ui/EmptyState';
import { stillApplies, undoState } from '@/lib/search/applied';
import type { Applied } from '@/lib/search/applied';
import { countListAsync, parseQuery, relaxQuery, search } from '@/lib/client/data';
import { activeFilters } from '@/lib/entities/filter';
import { hasWhere, whereChips } from './whereModel';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';
import { decodeState, encodeState } from '@/lib/entities/url';
import type { ActiveFilter } from '@/lib/entities/filter';
import type { DidYouMean } from '@/lib/search/parse/types';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
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
export function EmptyState<Row>({ d, state, labelOf, applied, onApplied, uncheckedCount = 0, onState }: Props<Row>) {
  const chips = whereChips(activeFilters(state, d, labelOf), labelOf, hasWhere(d));
  const live = applied && stillApplies(state, applied) ? applied : null;
  // what each way out would bring back: counted from the list files of the wider scope, so it arrives a moment after the block
  const [ways, setWays] = useState<{ key: string; options: { chip: ActiveFilter; n: number }[]; withoutQuery: number } | null>(null);
  // for words typed in the list's box: a typo that has an answer, and a name the list does not hold as a row (an area, a trip) (SQ1b S3, 4.14)
  const [words, setWords] = useState<{ key: string; typo: { label: string; to: ListState } | null; name: { label: string; href: string; area: ListState | null } | null } | null>(null);
  const [relaxState, setRelax] = useState<{ key: string; got: DidYouMean | null } | null>(null);
  const key = encodeState(state);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const counted = await Promise.all(whereChips(activeFilters(state, d, labelOf), labelOf, hasWhere(d)).map(async (c) => ({ chip: c, n: (await countListAsync(d.type, c.without))?.n ?? 0 })));
      const withoutQuery = state.q.trim() ? ((await countListAsync(d.type, { ...state, q: '' }))?.n ?? 0) : 0;
      const options = counted.filter((o) => o.n > 0).sort((a, b) => a.n - b.n).slice(0, 3);
      if (alive) setWays({ key, options, withoutQuery });
    })();
    return () => {
      alive = false;
    };
    // `key` stands for `state`; the labels and descriptor do not change under a mounted block
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, d]);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    void relaxQuery(live.parsed).then((got) => alive && setRelax({ key, got }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live?.parsed]);
  useEffect(() => {
    const q = state.q.trim();
    if (!q || live) return;
    let alive = true;
    void (async () => {
      let typo: { label: string; to: ListState } | null = null;
      let name: { label: string; href: string; area: ListState | null } | null = null;
      try {
        const parsed = await parseQuery(q, { target: d.type === 'trip' ? 'trips' : 'places' });
        const fix = parsed.didYouMean.find((x) => !x.label.includes(',') && !x.label.includes(' '));
        if (fix) {
          const got = decodeState(fix.href.split('?')[1] ?? '');
          const to: ListState = { ...state, q: got.q, facets: { ...state.facets, ...got.facets }, focus: null };
          if (((await countListAsync(d.type, to))?.n ?? 0) > 0) typo = { label: fix.label, to };
        }
        const found = await search(q);
        const hit = found.groups.flatMap((g) => g.hits)[0]?.record;
        if (hit) {
          const parts = /^\/globe\/([a-z]{2})(?:\/([^/]+))?(?:\/([^/]+))?\/$/.exec(hit.h);
          if (hit.k === 'area' && parts && d.type === 'place') {
            const facets: ListState['facets'] = { country: [parts[1]!.toUpperCase()] };
            if (parts[2]) facets.region = [parts[2]];
            if (parts[3]) facets.area = [parts[3]];
            name = { label: `${hit.n} is an area: show its places`, href: hit.h, area: { ...state, q: '', facets, focus: null } };
          } else if (hit.k !== 'area') name = { label: `${hit.n}: open its page`, href: hit.h, area: null };
        }
      } catch {
        // the search files did not load: the other ways out still stand
      }
      if (alive) setWords({ key, typo, name });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, d, live]);
  const heard = words?.key === key ? words : null;
  const options = ways?.key === key ? ways.options : [];
  const withoutQuery = ways?.key === key ? ways.withoutQuery : 0;
  const nothingToFilter = !chips.length && !state.q.trim();
  const noun = (n: number) => (n === 1 ? d.noun.one : d.noun.many);

  if (live) {
    const relax = relaxState?.key === key ? relaxState.got : null;
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
              onState(undoState(live), 'replace');
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
  // a Kind chosen on its own and nothing in it (3.66d): say so as a fact about the catalogue, not as a failed search
  const lone = chips.length === 1 && !state.q.trim() && /^(k|kind):/.test(chips[0]!.key) ? chips[0]! : null;
  if (lone) {
    const what = lone.label.replace(/^[^:]+:\s*/, '').toLowerCase();
    const total = nearest?.n ?? 0;
    return (
      <EmptyBlock
        glyph="search"
        title={`No ${what} here yet`}
        why={`Nothing in the catalogue is filed under ${what} so far. A gap is not a no: we simply have not added any.`}
        action={
          <Button variant="primary" onClick={() => onState(lone.without, 'push')}>
            {total > 0 ? `Show all ${total} ${noun(total)}` : `Clear ${what}`}
          </Button>
        }
      />
    );
  }
  return (
    <EmptyBlock
      glyph="search"
      title={`No ${d.noun.many} match`}
      why={nearest ? 'Nothing fits all of these. The closest match is one filter away.' : 'No single change brings places back. Take off filters one at a time, or use Clear all above.'}
      action={
        heard?.typo ? (
          <Button variant="primary" onClick={() => onState(heard.typo!.to, 'push')}>
            Did you mean &ldquo;{heard.typo.label}&rdquo;?
          </Button>
        ) : nearest ? (
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
          {heard?.name ? (
            <li>
              {heard.name.area ? (
                <Button onClick={() => onState(heard.name!.area!, 'push')}>{heard.name.label}</Button>
              ) : (
                <a className="btn" href={heard.name.href}>
                  {heard.name.label}
                </a>
              )}
            </li>
          ) : null}
          {heard?.typo && nearest ? (
            <li>
              <Button onClick={() => onState(nearest.chip.without, 'push')}>
                Remove &ldquo;{nearest.chip.label}&rdquo; to see {nearest.n} {noun(nearest.n)}
              </Button>
            </li>
          ) : null}
          {(nearest || heard?.typo) && withoutQuery > 0 ? (
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
