import type { MapFamily } from './types';

/**
 * Pages declare which map family they use. `families.test.ts` fails when one route registers two
 * families, because Google Maps Platform terms 3.2.3(e) forbid a Google map and a non-Google map in the
 * same customer application view. google-js and google-embed are both Google, but a page still picks one.
 */
const entries: { route: string; family: MapFamily }[] = [
  // The globe is always MapLibre (L2).
  { route: '/globe', family: 'maplibre' },
];

export function registerPageFamily(route: string, family: MapFamily): void {
  entries.push({ route, family });
}
export function pageFamilyEntries(): readonly { route: string; family: MapFamily }[] { return entries; }

/** Returns the routes that use more than one family. */
export function findMixedRoutes(list: readonly { route: string; family: MapFamily }[] = entries): { route: string; families: MapFamily[] }[] {
  const by = new Map<string, Set<MapFamily>>();
  for (const e of list) by.set(e.route, (by.get(e.route) ?? new Set()).add(e.family));
  return [...by].filter(([, s]) => s.size > 1).map(([route, s]) => ({ route, families: [...s] }));
}

export function assertOneFamilyPerPage(list: readonly { route: string; family: MapFamily }[] = entries): void {
  const mixed = findMixedRoutes(list);
  if (mixed.length) throw new Error(`Mixed map families on one page: ${mixed.map((m) => `${m.route} (${m.families.join(' + ')})`).join(', ')}`);
}
