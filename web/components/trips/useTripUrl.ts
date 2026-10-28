'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { PROFILE_KEYS } from '@travel/core/schedule/profileCodec.ts';
import { DEFAULT_TAB_STATE, parseTripView, tripViewValue, VIEW_KEY, type TabState } from '@travel/core/trips/tabs.ts';
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

export interface TripUrl {
  /** The query's `view` value as written (`day`, `all`, an old `category`), or null. `resolveTripTab` turns it into the page's tab. */
  view: string | null;
  /** The fragment without '#': `day-3`, `trails`, or ''. */
  hash: string;
  /** Day number when the fragment is `day-N`. */
  day: number | null;
  category: Category | null;
  /** The timeline keys of the query (p, pace, a, walk, split, d, add) in the codec's order, without `view`; '' when none. */
  timeline: string;
  /** Change the tab, the fragment and/or the timeline keys (patterns 1.2). A missing `tab` keeps the tab the URL names now. `push` makes Back undo it. */
  go: (next: { tab?: TabState; hash?: string; timeline?: string }, mode?: 'push' | 'replace') => void;
}

/** Parses `?p=family-6&pace=relaxed&d=5C&add=5.moraine-lake&view=all` and `#day-3` / `#stays` ... (patterns 1.2, spec 3.8). Which tab it means is `resolveTripTab`'s rule (view, fragment, device, Summary). */
export function parseTripUrl(search: string, hash: string): Pick<TripUrl, 'view' | 'hash' | 'day' | 'category' | 'timeline'> {
  const h = hash.replace(/^#/, '');
  const category = (CATEGORIES as readonly string[]).includes(h) ? (h as Category) : null;
  const m = /^day-(\d+)$/.exec(h);
  const q = new URLSearchParams(search);
  const view = q.get(VIEW_KEY) || null;
  const timeline = PROFILE_KEYS.filter((k) => q.has(k)).map((k) => `${k}=${q.get(k)}`).join('&');
  return { view, hash: h, day: m ? Number(m[1]) : null, category, timeline };
}

/** The query string for a tab and the timeline keys: the timeline keys first, then `view` (left out for the Summary), then any other key the link carried (`extra`, e.g. a campaign tag). */
export function tripQuery(tab: TabState, timeline: string, extra = ''): string {
  const v = tripViewValue(tab);
  const parts = [timeline, v ? `${VIEW_KEY}=${v}` : '', extra].filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : '';
}

// STEP2-T1: a `mine=<id>` link (not the older `mine=1` marker) goes to the copy's own page. The lazy module answers only with `tripEdit` on.
const useRedirectMine = (): void =>
  useEffect(() => {
    if (/[?&]mine=(?!1(&|$))/.test(window.location.search)) void import('@/lib/trip-edit/redirect').then((m) => m.followMineLink());
  }, []);

/** The trip page's own URL state: not list state, so it does not share `useUrlState`. */
export function useTripUrl(): TripUrl {
  useRedirectMine();
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
    const now = parseTripUrl(window.location.search, '');
    const timeline = next.timeline ?? now.timeline;
    const tab = next.tab ?? parseTripView(now.view) ?? DEFAULT_TAB_STATE;
    // keys that are not the trip's own (a campaign tag, a share id) survive a hash or view change
    const own = new Set<string>([...PROFILE_KEYS, VIEW_KEY]);
    const extra = [...new URLSearchParams(window.location.search)].filter(([k]) => !own.has(k)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${window.location.pathname}${tripQuery(tab, timeline, extra)}${next.hash ? `#${next.hash}` : ''}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { ...parsed, go };
}
