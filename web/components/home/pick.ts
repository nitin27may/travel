import type { GlobeIndex, PublicPlaceCard } from '@/lib/public';

const RANK = { complete: 2, usable: 1, draft: 0 } as const;

const country = (p: PublicPlaceCard) => p.areaChain.find((a) => a.level === 'country')?.slug ?? '';

/**
 * "Places worth a trip": a stable rule, no randomness. Photo first (the adapter only sets `photo` when the
 * credit is known), then completeness, then name. Candidates are dealt out one country at a time so no
 * country takes a second slot before every country with a candidate has one. Places without a photo show
 * the kind glyph and come last. (Few places reach Usable today, so the Usable bar ranks rather than filters.)
 */
export function pickPlaces(places: readonly PublicPlaceCard[], n = 8): PublicPlaceCard[] {
  const order = (a: PublicPlaceCard, b: PublicPlaceCard) =>
    Number(!!b.photo) - Number(!!a.photo) || RANK[b.completeness.level] - RANK[a.completeness.level] || a.name.localeCompare(b.name);
  const by = new Map<string, PublicPlaceCard[]>();
  for (const p of [...places].sort(order)) {
    const c = country(p);
    by.set(c, [...(by.get(c) ?? []), p]);
  }
  const lanes = [...by.values()].sort((x, y) => order(x[0], y[0]));
  const out: PublicPlaceCard[] = [];
  for (let round = 0; out.length < n; round++) {
    let took = false;
    for (const lane of lanes) {
      if (lane[round] && out.length < n) {
        out.push(lane[round]);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

export interface CoverPin {
  cc: string;
  name: string;
  count: number;
  lat: number;
  lon: number;
}

/** One pin per country: the mean of its pins' positions, with places plus trips as the count. */
export function countryPins(globe: GlobeIndex): CoverPin[] {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const out: CoverPin[] = [];
  for (const c of globe.continents) {
    for (const node of c.countries) {
      const pins = globe.pins.filter((p) => p.path[0] === node.slug);
      if (!pins.length) continue;
      // real spots first; approximate pins (a country centre) only when nothing else is known
      const real = pins.filter((p) => !p.approx);
      const use = real.length ? real : pins;
      out.push({
        cc: node.slug,
        name: node.name.length <= 3 ? (names.of(node.slug.toUpperCase()) ?? node.name) : node.name,
        count: node.places + node.trips,
        lat: use.reduce((s, p) => s + p.lat, 0) / use.length,
        lon: use.reduce((s, p) => s + p.lon, 0) / use.length,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
