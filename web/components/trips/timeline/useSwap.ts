'use client';

import { useEffect, useState } from 'react';
import type { DayTimeline } from '@travel/core/schedule/types.ts';

/** Old cards fade out for this long, new cards fade in over IN_MS, 20 ms apart for the first five (design 7). */
export const OUT_MS = 120;
export const IN_MS = 200;
export const STAGGER_MS = 20;

export type SwapPhase = 'idle' | 'out' | 'in';

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Shows the timelines for the profile in the URL with a short cross-fade when who is going or the pace changes (principle P5): the
 * old cards leave, then the new ones arrive. Anything else that changes a timeline (a version, an added place) swaps at once, and so
 * does reduced motion, which jumps. `key` stands for the profile; `pending` is true while the scheduler is still loading.
 */
export function useSwap(timelines: DayTimeline[], key: string, pending: boolean): { shown: DayTimeline[]; phase: SwapPhase } {
  // `swapped` is the profile whose timelines are on screen; while it differs from `key` the old ones are held (and fading out)
  const [swapped, setSwapped] = useState(key);
  const [stale, setStale] = useState(timelines);
  const [entering, setEntering] = useState(false);
  const same = swapped === key;
  if (same && stale !== timelines) setStale(timelines);

  useEffect(() => {
    if (same || pending) return;
    const t = window.setTimeout(() => {
      setSwapped(key);
      setEntering(true);
    }, reduced() ? 0 : OUT_MS);
    return () => window.clearTimeout(t);
  }, [same, pending, key]);
  useEffect(() => {
    if (!entering) return;
    const t = window.setTimeout(() => setEntering(false), IN_MS + STAGGER_MS * 5);
    return () => window.clearTimeout(t);
  }, [entering]);

  return { shown: same ? timelines : stale, phase: !same ? 'out' : entering ? 'in' : 'idle' };
}
