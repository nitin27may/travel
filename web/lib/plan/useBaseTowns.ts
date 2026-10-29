'use client';

// The towns a trip could sleep in (FLOW stage 4 "Where the trip sleeps"): the towns of the towns layer around a few of the picks, nearest
// first from each, merged, the busiest first. One small public read per pick through the data boundary (P9), at most four, none for a plan
// with no pick; nothing of the visitor's goes with it. Loaded when the chooser opens.
import { useEffect, useMemo, useState } from 'react';
import type { PlanPick } from '@travel/core/schema/plan-draft.ts';
import type { Town } from '@travel/core/schema/api/index.ts';

export type BaseTowns = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; towns: Town[] } | { status: 'unavailable' } | { status: 'error' };

/** The picks to read around: the first, the last and two between, at most `n`, once each. */
export function spreadOf<T>(list: readonly T[], n: number): T[] {
  if (list.length <= n) return [...list];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]!);
  return [...new Set(out)];
}

/** Merged towns: one row per id (the nearest sighting), the ones with the most places around first, then the larger, then by name. */
export function mergeTowns(lists: readonly (readonly Town[])[]): Town[] {
  const by = new Map<string, Town>();
  for (const l of lists)
    for (const t of l) {
      const had = by.get(t.id);
      if (!had || (t.distanceKm ?? 1e9) < (had.distanceKm ?? 1e9)) by.set(t.id, t);
    }
  return [...by.values()].sort((a, b) => (b.places ?? 0) - (a.places ?? 0) || (b.pop ?? 0) - (a.pop ?? 0) || a.name.localeCompare(b.name));
}

export function useBaseTowns(picks: readonly PlanPick[], on: boolean): BaseTowns {
  const slugs = useMemo(() => spreadOf(picks, 4).map((p) => p.slug), [picks]);
  const key = slugs.join('|');
  const [state, setState] = useState<BaseTowns>({ status: 'idle' });
  useEffect(() => {
    if (!on || !slugs.length) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new set of picks starts a new read, and the screen says so
    setState({ status: 'loading' });
    void (async () => {
      try {
        const { townsAround } = await import('@/lib/client/data');
        const got = await Promise.all(slugs.map((place) => townsAround({ place, r: 60 }, ac.signal)));
        if (ac.signal.aborted) return;
        if (got.every((g) => g === null)) setState({ status: 'unavailable' });
        else setState({ status: 'ok', towns: mergeTowns(got.filter((g): g is Town[] => g !== null)) });
      } catch {
        if (!ac.signal.aborted) setState({ status: 'error' });
      }
    })();
    return () => ac.abort();
    // keyed by the slugs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, on]);
  return state;
}
