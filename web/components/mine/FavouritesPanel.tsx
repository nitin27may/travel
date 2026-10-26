'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pager } from '@/components/ui/Pager';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { useMediaQuery } from '@/components/entity/useMediaQuery';
import { HeartGlyph } from '@/lib/favourites/glyph';
import { counts, NO_FILTERS, pageOf, parsePage, rowName, view, PAGE_SIZE } from '@/lib/favourites/panel';
import type { Filters, Scope } from '@/lib/favourites/panel';
import { refreshPage } from '@/lib/favourites/resolve';
import { removeHeart, restoreHeart } from '@/lib/favourites/store';
import type { Failure } from '@/lib/favourites/store';
import * as say from '@/lib/favourites/toast';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import { handleOf } from '@travel/core/favourites/envelope.ts';
import { FavouritesRow } from './FavouritesRow';
import './favourites.css';

// Kind and Country carry the popover library and Filters (phone) the bottom sheet: they load after the tab paints
const FavouritesFilters = dynamic(() => import('./FavouritesFilters'), { ssr: false });

interface Props {
  items: readonly FavItem[];
  storage: StorageLike;
  /** Re-read the list after a write (the shell recounts the tab). */
  onChanged: () => void;
}

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const failMessage = (r: Failure | 'absent'): string => (r === 'quota' ? say.outOfSpace : r === 'changed' ? say.changedElsewhere : say.cannotChange);

/**
 * The Favourites tab (mine-and-bar-spec 5.3, visitor spec 4.5): All, Places and Trips with counts; Kind, Country and Sort; list rows of
 * 48 a page with the page in the URL; each visible page asked once per visit through `resolveRefs`, so a renamed page takes its new name
 * and a withdrawn one reads "No longer listed" with Remove. The hearts in the rows remove with Undo. Everything here is the visitor's own
 * list in this browser (P9: no catalogue bulk load; the resolve call carries at most 48 handles and returns light rows).
 */
export function FavouritesPanel({ items, storage, onChanged }: Props) {
  const { toast } = useToast();
  const phone = !useMediaQuery('(min-width: 640px)');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(() => parsePage(new URLSearchParams(location.search).get('page')));
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const focusNext = useRef<{ handle: string | null } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => view(items, filters), [items, filters]);
  const shown = useMemo(() => pageOf(rows, page), [rows, page]);
  const scopeCounts = useMemo(() => counts(items), [items]);

  // the visible page, asked once per visit; a failed answer leaves the list as it is
  const handleKey = shown.rows.map(handleOf).join(',');
  useEffect(() => {
    let live = true;
    void refreshPage(storage, shown.rows, { force: attempt > 0 }).then((r) => {
      if (!live) return;
      setFailed(r.kind === 'failed');
      if (r.kind === 'done' && r.changed) onChanged();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the handles on the page are the dependency, not the row objects
  }, [handleKey, attempt, storage]);

  // after Remove or Undo focus goes to a row's link; with none left, to the empty state's action, then the tab
  useEffect(() => {
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    const q = (sel: string) => root.current?.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel);
    const el = (want.handle ? q(`[data-handle="${want.handle}"] .frow-link, [data-handle="${want.handle}"] .frow-act button`) : null) ?? q('.empty a') ?? q('#mine-tab-favourites');
    el?.focus();
  }, [items]);

  const choose = useCallback((next: number) => {
    setPage(next);
    const url = new URL(location.href);
    if (next > 1) url.searchParams.set('page', String(next));
    else url.searchParams.delete('page');
    history.replaceState(history.state, '', url);
    root.current?.scrollIntoView({ block: 'start' });
  }, []);

  const change = (f: Filters) => {
    setFilters(f);
    if (page !== 1) choose(1);
  };

  const remove = useCallback(
    (item: FavItem) => {
      const name = rowName(item);
      const at = shown.rows.findIndex((x) => handleOf(x) === handleOf(item));
      const next = shown.rows[at + 1] ?? shown.rows[at - 1] ?? null;
      setCollapsing(handleOf(item));
      setTimeout(
        () => {
          let res = removeHeart(item.space, item.slug);
          // another tab wrote between our read and our write: read again and retry once, silently
          if (!res.ok && res.reason === 'changed') res = removeHeart(item.space, item.slug);
          setCollapsing(null);
          if (!res.ok) {
            if (res.reason === 'absent') onChanged();
            else toast({ message: failMessage(res.reason) });
            return;
          }
          focusNext.current = { handle: next ? handleOf(next) : null };
          onChanged();
          toast({
            message: say.removed(name),
            actionLabel: 'Undo',
            duration: say.UNDO_MS,
            onAction: () => {
              if (restoreHeart(res.removed)) {
                setRestored(handleOf(res.removed));
                focusNext.current = { handle: handleOf(res.removed) };
                onChanged();
              } else toast({ message: say.cannotRestore(name) });
            },
          });
        },
        reduced() ? 0 : 200,
      );
    },
    [shown.rows, onChanged, toast],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        quiet
        glyph="search"
        glyphNode={<HeartGlyph size={32} />}
        title="No favourites yet"
        why="Tap the heart on a place or a trip to keep it here."
        action={<ButtonLink href="/places/" variant="primary">Browse places</ButtonLink>}
        secondary={<ButtonLink href="/trips/" variant="ghost">Browse trips</ButtonLink>}
      />
    );
  }

  const scopes: { value: Scope; label: string }[] = [
    { value: 'all', label: `All ${scopeCounts.all}` },
    { value: 'place', label: `Places ${scopeCounts.place}` },
    { value: 'trip', label: `Trips ${scopeCounts.trip}` },
  ];

  return (
    <div ref={root} className="favs">
      {failed ? <ErrorState className="favs-error" title="We couldn't refresh your favourites." detail="Showing the list on this device." onRetry={() => setAttempt((n) => n + 1)} /> : null}
      <div className="favs-filters">
        <Segmented
          size={phone ? 'md' : 's'}
          label="Show"
          segments={scopes}
          value={filters.scope}
          onChange={(scope) => change({ ...filters, scope, kinds: [], countries: [] })}
          className="favs-scope"
        />
        <FavouritesFilters items={items} filters={filters} onChange={change} phone={phone} shown={rows.length} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          quiet
          glyph="search"
          title="No favourites match"
          why="Try another kind or country."
          action={<Button onClick={() => change({ ...NO_FILTERS, scope: filters.scope })}>Clear filters</Button>}
        />
      ) : (
        <ul className="favs-list">
          {shown.rows.map((i) => (
            <FavouritesRow key={handleOf(i)} item={i} collapsing={collapsing === handleOf(i)} restored={restored === handleOf(i)} onRemove={remove} />
          ))}
        </ul>
      )}
      <Pager page={shown.page} pageSize={PAGE_SIZE} total={rows.length} onPage={choose} className="favs-pager" />
    </div>
  );
}
