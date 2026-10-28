'use client';

// Edit mode is a mode of the page (edit-mode-spec 3; patterns 3.13 item 1): `edit=1` in the address, added and removed with pushState so
// Back leaves the mode at the same tab, day and scroll. This file is in the page's start code, so it is tiny; everything edit mode does
// loads from components/trips/edit/EditLayer.tsx when the mode is first asked for.
import { useCallback, useSyncExternalStore } from 'react';
import { EDIT_KEY } from './keys';

// the trip page's own event (components/trips/useTripUrl.ts), so its tab and day state read the new address
const EVENT = 'travel:trip-url';

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('popstate', cb);
  };
}
const snapshot = (): boolean => new URLSearchParams(window.location.search).get(EDIT_KEY) === '1';

/** The address with `edit=1` set or removed, the other keys and the fragment as they were. */
export function withEdit(href: URL, on: boolean): string {
  const q = new URLSearchParams(href.search);
  if (on) q.set(EDIT_KEY, '1');
  else q.delete(EDIT_KEY);
  const s = q.toString();
  return `${href.pathname}${s ? `?${s}` : ''}${href.hash}`;
}

export function useEditMode(): { on: boolean; set: (on: boolean, how?: 'push' | 'replace') => void } {
  const on = useSyncExternalStore(subscribe, snapshot, () => false);
  const set = useCallback((next: boolean, how: 'push' | 'replace' = 'push') => {
    const url = withEdit(new URL(window.location.href), next);
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (how === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { on, set };
}
