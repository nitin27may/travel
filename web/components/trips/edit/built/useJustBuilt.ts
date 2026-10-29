'use client';

// `built=1` on the address (Build my days, README ruling C6): read once into state, the trip opens on its Days (the tab the build lands on,
// edit-mode-spec 2.1), and the key is removed with `replaceState` once the trip has been painted, so a reload or a shared link never
// shows the just-built line again. The line stays for this page view.
import { useEffect, useRef, useState } from 'react';

/** Set when Build my days opened this page view; the just-built line takes it once to scroll and focus (it may remount later, and must not scroll again). */
export const landing = { pending: false };

const EVENT = 'travel:trip-url';
const BUILT = 'built';

/** The address with `built` removed (the other keys and the fragment as they were); with `view=day` when the address names no tab. */
export function consumeBuilt(href: URL, keepKey: boolean): string {
  const q = new URLSearchParams(href.search);
  const had = q.get(BUILT) === '1';
  if (had && !q.has('view')) q.set('view', 'day');
  if (!keepKey) q.delete(BUILT);
  else if (had) {
    q.delete(BUILT);
    q.set(BUILT, '1');
  }
  const s = q.toString();
  return `${href.pathname}${s ? `?${s}` : ''}${href.hash}`;
}

/** True for the page view that Build my days opened. `ready`: the trip is on screen. */
export function useJustBuilt(ready: boolean): boolean {
  const [flag, setFlag] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get(BUILT) !== '1') return;
    landing.pending = true;
    // read after the commit, not in an initialiser: a client-side navigation from the builder renders this page before the address has changed
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlag(true);
    // the Days tab before the trip is drawn, so it never shows the Summary first
    const next = consumeBuilt(u, true);
    if (next !== `${u.pathname}${u.search}${u.hash}`) window.history.replaceState(null, '', next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  useEffect(() => {
    if (!ready || done.current) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get(BUILT) !== '1') return;
    done.current = true;
    const id = requestAnimationFrame(() => {
      window.history.replaceState(null, '', consumeBuilt(new URL(window.location.href), false));
      window.dispatchEvent(new Event(EVENT));
    });
    return () => cancelAnimationFrame(id);
  }, [ready]);
  return flag;
}
