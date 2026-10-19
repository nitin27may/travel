import { globeCountries, globeCountryFacts } from '@/lib/client/data';
import { bbox, centroid, topoFeatures, type FeatColl, type Topology } from './geometry';
import type { CountryFacts } from './types';

export interface CountryBook {
  fc: FeatColl;
  /** Facts keyed by the zero-padded ISO numeric code, as in countries.json. */
  facts: Record<string, CountryFacts>;
  byA3: Record<string, CountryFacts & { ccn3: string }>;
  /** Lower-case ISO alpha-2 to the shape id and facts. */
  byA2: Record<string, { id: number; facts: CountryFacts & { ccn3: string } }>;
}

export function buildCountryBook(world: Topology, facts: Record<string, CountryFacts>): CountryBook {
  const fc = topoFeatures(world, world.objects.countries);
  fc.features.forEach((f) => {
    f.id = Number(f.id);
    f.properties.ccn3 = String(f.id).padStart(3, '0');
    f._bbox = bbox(f);
    f._c = centroid(f);
  });
  const byA3: CountryBook['byA3'] = {};
  const byA2: CountryBook['byA2'] = {};
  for (const [ccn3, c] of Object.entries(facts)) {
    const withCode = { ...c, ccn3 };
    byA3[c.a3] = withCode;
    const f = fc.features.find((x) => x.properties.ccn3 === ccn3);
    if (f) byA2[c.a2.toLowerCase()] = { id: f.id as number, facts: withCode };
  }
  return { fc, facts, byA3, byA2 };
}

let book: Promise<CountryBook> | null = null;
/** The country shapes at 110m (about 40 KB gz) with the facts: enough for the first paint and the world view. */
export function loadCountries(): Promise<CountryBook> {
  return (book ??= Promise.all([globeCountries('110m'), globeCountryFacts()])
    .then(([world, facts]) => buildCountryBook(world, facts))
    .catch((e) => { book = null; throw e; }));
}

let full: Promise<CountryBook> | null = null;
/** The same book at 50m, for hover and drill-down accuracy. The ids are the same as the 110m shapes'. */
export function loadCountries50(): Promise<CountryBook> {
  return (full ??= Promise.all([globeCountries('50m'), globeCountryFacts()])
    .then(([world, facts]) => buildCountryBook(world, facts))
    .catch((e) => { full = null; throw e; }));
}
