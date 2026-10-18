import { globeIndex, listPlaces, listTrips } from '@/lib/public';
import type { GlobeNode } from '@/lib/public';
import type { SearchRecord } from './types';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function areaRecords(node: GlobeNode, path: string[], parents: string[], out: SearchRecord[]): void {
  const here = [...path, node.slug];
  const counts = [node.trips ? plural(node.trips, 'trip') : '', node.places ? plural(node.places, 'place') : ''].filter(Boolean).join(' · ');
  const level = here.length === 1 ? 'Country' : here.length === 2 ? 'State or region' : 'District';
  out.push({
    k: 'area',
    h: `/globe/${here.join('/')}/`,
    n: node.name,
    s: [parents.length ? parents.join(', ') : level, counts].filter(Boolean).join(' · '),
    x: parents.join(' '),
  });
  for (const c of node.children) areaRecords(c, here, [node.name, ...parents], out);
}

/**
 * The search index, from the public adapter only: listed trips, every place, and the globe's areas. Private
 * trips are never in listTrips(), so they cannot reach the index (README 2.3).
 */
export function buildSearchIndex(): SearchRecord[] {
  const out: SearchRecord[] = [];
  for (const t of listTrips()) {
    out.push({
      k: 'trip',
      h: `/trips/${t.slug}/`,
      n: t.title,
      s: [t.region, t.daysCount ? plural(t.daysCount, 'day') : ''].filter(Boolean).join(' · '),
      x: [t.region, t.subtitle, t.firstBase ?? ''].join(' '),
    });
  }
  for (const p of listPlaces()) {
    out.push({
      k: 'place',
      h: `/places/${p.slug}/`,
      n: p.name,
      s: [p.kindLabel, p.areaLabel].filter(Boolean).join(' · '),
      x: [p.kindLabel, p.kind, p.subkind ?? '', ...p.areaChain.map((a) => a.name), ...p.tags].join(' '),
      kind: p.kind,
    });
  }
  for (const c of globeIndex().continents) for (const country of c.countries) areaRecords(country, [], [], out);
  return out;
}
