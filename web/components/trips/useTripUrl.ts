'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CATEGORIES } from '@/lib/public/types';
import type { Category } from '@/lib/public/types';

const EVENT = 'travel:trip-url';

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('popstate', cb);
  window.addEventListener('hashchange', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('popstate', cb);
    window.removeEventListener('hashchange', cb);
  };
}

export type TripView = 'day' | 'category';
export interface TripUrl {
  view: TripView;
  /** The fragment without '#': `day-3`, `trails`, or ''. */
  hash: string;
  /** Day number when the fragment is `day-N`. */
  day: number | null;
  category: Category | null;
  /** Change the view and/or fragment. `push` makes Back undo it. */
  go: (next: { view: TripView; hash?: string }, mode?: 'push' | 'replace') => void;
}

/** Parses `?view=category` and `#day-3` / `#stays` ... (patterns 1.2). A category fragment implies the By category view. */
export function parseTripUrl(search: string, hash: string): Pick<TripUrl, 'view' | 'hash' | 'day' | 'category'> {
  const h = hash.replace(/^#/, '');
  const category = (CATEGORIES as readonly string[]).includes(h) ? (h as Category) : null;
  const m = /^day-(\d+)$/.exec(h);
  const view: TripView = new URLSearchParams(search).get('view') === 'category' || category ? 'category' : 'day';
  return { view, hash: h, day: m ? Number(m[1]) : null, category };
}

/** The trip page's own URL state: not list state, so it does not share `useUrlState`. */
export function useTripUrl(): TripUrl {
  const raw = useSyncExternalStore(
    subscribe,
    () => `${window.location.search}${window.location.hash}`,
    () => '',
  );
  const parsed = useMemo(() => {
    const i = raw.indexOf('#');
    return parseTripUrl(i === -1 ? raw : raw.slice(0, i), i === -1 ? '' : raw.slice(i));
  }, [raw]);
  const go = useCallback<TripUrl['go']>((next, mode = 'push') => {
    const url = `${window.location.pathname}${next.view === 'category' ? '?view=category' : ''}${next.hash ? `#${next.hash}` : ''}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { ...parsed, go };
}
