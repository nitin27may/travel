'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { PROFILE_KEYS } from '@travel/core/schedule/profileCodec.ts';
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
  /** The timeline keys of the query (p, pace, a, walk, split, d, add) in the codec's order, without `view`; '' when none. */
  timeline: string;
  /** Change the view, the fragment and/or the timeline keys (patterns 1.2). `push` makes Back undo it. */
  go: (next: { view: TripView; hash?: string; timeline?: string }, mode?: 'push' | 'replace') => void;
}

/** Parses `?p=family-6&pace=relaxed&d=5C&add=5.moraine-lake&view=category` and `#day-3` / `#stays` ... (patterns 1.2, spec 3.8). A category fragment implies the By category view. */
export function parseTripUrl(search: string, hash: string): Pick<TripUrl, 'view' | 'hash' | 'day' | 'category' | 'timeline'> {
  const h = hash.replace(/^#/, '');
  const category = (CATEGORIES as readonly string[]).includes(h) ? (h as Category) : null;
  const m = /^day-(\d+)$/.exec(h);
  const q = new URLSearchParams(search);
  const view: TripView = q.get('view') === 'category' || category ? 'category' : 'day';
  const timeline = PROFILE_KEYS.filter((k) => q.has(k)).map((k) => `${k}=${q.get(k)}`).join('&');
  return { view, hash: h, day: m ? Number(m[1]) : null, category, timeline };
}

/** The query string for a view and the timeline keys: the timeline keys first, then `view`, then any other key the link carried (`extra`, e.g. a campaign tag). */
export function tripQuery(view: TripView, timeline: string, extra = ''): string {
  const parts = [timeline, view === 'category' ? 'view=category' : '', extra].filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : '';
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
    const timeline = next.timeline ?? parseTripUrl(window.location.search, '').timeline;
    // keys that are not the trip's own (a campaign tag, a share id) survive a hash or view change
    const own = new Set<string>([...PROFILE_KEYS, 'view']);
    const extra = [...new URLSearchParams(window.location.search)].filter(([k]) => !own.has(k)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${window.location.pathname}${tripQuery(next.view, timeline, extra)}${next.hash ? `#${next.hash}` : ''}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { ...parsed, go };
}
