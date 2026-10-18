'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { decodeState, encodeState, hashToQuery, pageAfter } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';

const EVENT = 'travel:url';

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('popstate', cb);
  };
}

const snapshot = () => window.location.search;
const serverSnapshot = () => '';

/** True when the last focus change pushed a history entry, so closing can go back instead of stacking. */
let pushedFocus = false;
export const focusWasPushed = () => pushedFocus;

/**
 * List state lives in the query string. A legacy hash (#country=CA&view=grid, from the old list page
 * and the globe) is rewritten to the query string once on load.
 */
export function useUrlState(): [ListState, (next: ListState, mode?: 'push' | 'replace') => void] {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const state = useMemo(() => decodeState(search), [search]);

  useEffect(() => {
    const fromHash = hashToQuery(window.location.hash);
    if (!fromHash) return;
    const params = new URLSearchParams(window.location.search);
    new URLSearchParams(fromHash).forEach((value, key) => params.set(key, value));
    const merged = encodeState(decodeState(params.toString()));
    window.history.replaceState(null, '', `${window.location.pathname}${merged ? `?${merged}` : ''}`);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const set = useCallback((requested: ListState, mode: 'push' | 'replace' = 'replace') => {
    // anything that changes which rows show starts again at page 1
    const next = { ...requested, page: pageAfter(decodeState(window.location.search), requested) };
    const q = encodeState(next);
    const url = `${window.location.pathname}${q ? `?${q}` : ''}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    const focusing = Boolean(next.focus) && !decodeState(window.location.search).focus;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    if (focusing) pushedFocus = mode === 'push';
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [state, set];
}
