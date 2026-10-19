import { describe, expect, it } from 'vitest';
import { readDrawTiers } from '@/lib/public/globe';
import { COUNTRY_PIN_CAP, pinsFor, topPlaces } from '@/lib/globe/model';
import type { GlobeData, LightPin } from '@/lib/globe/types';
import path from 'node:path';
import { WEB } from '../helpers';

const ROOT = path.resolve(WEB, '..');

/** A deterministic 10,000-place world: 1% world, 5% national, 20% regional, 74% local (relevance 6.4, acceptance A3). */
function synthetic(n = 10_000): { data: GlobeData; italy: LightPin[] } {
  const tiers = ['world', ...Array(5).fill('national'), ...Array(20).fill('regional'), ...Array(74).fill('local')] as const;
  const countries = ['it', 'fr', 'es', 'de', 'at', 'ch', 'us', 'ca', 'mx', 'br', 'ar', 'cl', 'pe', 'jp', 'cn', 'in', 'th', 'vn', 'au', 'nz', 'za', 'ke', 'ma', 'eg', 'tr', 'gr', 'pt', 'no', 'is', 'gb'];
  const pins: LightPin[] = [];
  for (let i = 0; i < n; i++) {
    const cc = countries[i % countries.length];
    const state = `s${i % 7}`;
    pins.push({ kind: 'place', slug: `p${i}`, name: `Place ${String(i).padStart(5, '0')}`, lat: 40 + (i % 97) / 10, lon: 10 + (i % 89) / 10, type: 'trail', path: [cc, state, `d${i % 3}`], approx: false, tier: tiers[Math.floor((((i * 2654435761) >>> 0) / 4294967296) * tiers.length)], kindLabel: 'Trail' });
  }
  type TreeNode = GlobeData['index']['continents'][0]['countries'][0];
  const node = (slug: string, kids: TreeNode[] = []): TreeNode => ({ slug, name: slug, places: 0, trips: 0, children: kids });
  const count = (cc: string, st?: string) => pins.filter((p) => p.path[0] === cc && (!st || p.path[1] === st)).length;
  const continents = [{ slug: 'x', name: 'X', places: n, trips: 0, countries: countries.map((cc) => ({ ...node(cc, [...Array(7).keys()].map((k) => ({ ...node(`s${k}`), places: count(cc, `s${k}`) }))), places: count(cc) })) }];
  return { data: { index: { continents, pins }, cards: {} }, italy: pins.filter((p) => p.path[0] === 'it') };
}

describe('pins by draw tier (relevance 6.4, A3)', () => {
  const { data, italy } = synthetic();
  const facts = {};

  it('draws at most 30 place pins at a country, keeps every world pin, and never nears the 400-marker cap', () => {
    const drawn = pinsFor(data, ['it'], facts).filter((p) => p.kind === 'place');
    expect(italy.length).toBeGreaterThan(300);
    expect(drawn.length).toBeLessThanOrEqual(COUNTRY_PIN_CAP);
    const world = italy.filter((p) => p.tier === 'world');
    expect(world.length).toBeGreaterThan(0);
    for (const w of world) expect(drawn.some((d) => d.id === `place:${w.slug}`), w.slug).toBe(true);
    expect(pinsFor(data, ['it'], facts).length).toBeLessThan(400);
  });

  it('draws only world and national places as pins at a country', () => {
    for (const p of pinsFor(data, ['it'], facts).filter((x) => x.kind === 'place')) expect(['world', 'national']).toContain(p.tier);
  });

  it('puts the highest tiers first when more than 30 qualify', () => {
    const picked = topPlaces(italy, 5);
    expect(picked.map((p) => p.tier)).toEqual([...picked.map((p) => p.tier)].sort((a, b) => (a === 'world' ? -1 : b === 'world' ? 1 : 0)));
  });

  it('at a state shows regional and above as pins and local places as quiet dots; a district shows all as pins', () => {
    const state = pinsFor(data, ['it', 's1'], facts).filter((p) => p.kind === 'place');
    expect(state.some((p) => p.quiet)).toBe(true);
    for (const p of state) expect(p.quiet === true).toBe(p.tier === 'local');
    const district = pinsFor(data, ['it', 's1', 'd1'], facts).filter((p) => p.kind === 'place');
    expect(district.every((p) => !p.quiet)).toBe(true);
  });

  it('shows the neighbouring states dimmed at a state', () => {
    const sibs = pinsFor(data, ['it', 's1'], facts).filter((p) => p.kind === 'state');
    expect(sibs.length).toBeGreaterThan(0);
    expect(sibs.every((p) => p.dim)).toBe(true);
  });
});

describe('draw tiers from the relevance sidecars', () => {
  const tiers = readDrawTiers(ROOT);
  it('reads one tier per place name, the highest when a place is in several trips', () => {
    expect(tiers.size).toBeGreaterThan(50);
    expect([...tiers.values()].every((t) => ['world', 'national', 'regional', 'local'].includes(t))).toBe(true);
  });
  it('reads nothing when there is no sidecar folder', () => {
    expect(readDrawTiers('/nonexistent').size).toBe(0);
  });
});
