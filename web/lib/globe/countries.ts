import { DATA_BASE } from './admin';
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
export function loadCountries(): Promise<CountryBook> {
  return (book ??= Promise.all([
    fetch(`${DATA_BASE}countries-50m.json`).then((r) => r.json() as Promise<Topology>),
    fetch(`${DATA_BASE}countries.json`).then((r) => r.json() as Promise<Record<string, CountryFacts>>),
  ]).then(([world, facts]) => buildCountryBook(world, facts)).catch((e) => { book = null; throw e; }));
}
