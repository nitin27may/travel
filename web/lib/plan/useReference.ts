'use client';

// The public lists the stages read, one call each through the data boundary (lib/client/data.ts), loaded when a stage opens:
// the countries we hold, the areas of a country, the hubs and airports to start from.
import { useEffect, useState } from 'react';
import type { PlanRegions, PlanStarts } from '@travel/core/schema/api/plan.ts';

export type Loaded<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'unavailable' } | { status: 'error'; code: string };

function useLoad<T>(key: string | null, load: () => Promise<T | null>): [Loaded<T>, () => void] {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new key starts a new load, and the screen says so
    setState({ status: 'loading' });
    load().then(
      (d) => live && setState(d === null ? { status: 'unavailable' } : { status: 'ok', data: d }),
      (e: unknown) => live && setState({ status: 'error', code: (e as { code?: string }).code ?? 'internal' }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by `key` and the retry counter
  }, [key, attempt]);
  return [state, () => setAttempt((n) => n + 1)];
}

export interface CountryOption {
  cc: string;
  name: string;
  places: number;
}

/** Countries with researched places, most places first (the globe tree is one small call; country slugs are the lower-case codes). */
export function useCountries(): [Loaded<CountryOption[]>, () => void] {
  return useLoad<CountryOption[]>('countries', async () => {
    const { globeTree } = await import('@/lib/client/data');
    const tree = await globeTree();
    return tree.continents
      .flatMap((c) => c.countries)
      .filter((c) => /^[a-z]{2}$/.test(c.slug) && c.places > 0)
      .map((c) => ({ cc: c.slug.toUpperCase(), name: c.name, places: c.places }))
      .sort((a, b) => b.places - a.places || a.name.localeCompare(b.name));
  });
}

export function useRegions(cc: string | null): [Loaded<PlanRegions>, () => void] {
  return useLoad<PlanRegions>(cc, async () => {
    const { planRegions } = await import('@/lib/client/data');
    return planRegions(cc!);
  });
}

export function useStarts(): [Loaded<PlanStarts>, () => void] {
  return useLoad<PlanStarts>('starts', async () => {
    const { planStarts } = await import('@/lib/client/data');
    return planStarts();
  });
}
