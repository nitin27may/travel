'use client';

import { useSyncExternalStore } from 'react';
import { METRIC, PREFS_KEY, parsePrefs } from './units';
import type { Prefs } from './units';
import { readLocal, writeLocal } from '@/lib/storage/safe';

const EVENT = 'travel:prefs';
let cachedRaw: string | null | undefined;
let cached: Prefs = METRIC;

function snapshot(): Prefs {
  const raw = readLocal(PREFS_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parsePrefs(raw, navigator.language);
  }
  return cached;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Units and density. Server render and first paint are metric; the stored or locale default follows. */
export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => METRIC);
  const update = (patch: Partial<Prefs>) => {
    // storage blocked or full: the change lasts until reload
    writeLocal(PREFS_KEY, JSON.stringify({ ...snapshot(), ...patch }));
    window.dispatchEvent(new Event(EVENT));
  };
  return [prefs, update];
}
