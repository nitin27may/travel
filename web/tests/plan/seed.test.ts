import { describe, expect, it } from 'vitest';
import type { Town } from '@travel/core/schema/api/index.ts';
import { areaWords, majorityCountry, regionIdOf, seedState, SEED_MAX_PICKS, type SeedParts, type SeedRow } from '@/lib/plan/seed';
import { townOfBase } from '@/lib/plan/seedLoad';
import { draftOf } from '@/lib/plan/draft';
import { ID, T0 } from './helpers';

const row = (n: number, country = 'CA', region = 'alberta'): SeedRow => ({ ref: `place/s${n}`, slug: `s${n}`, name: `Stop ${n}`, country, region });
const names = (cc: string) => (cc === 'CA' ? 'Canada' : cc);
const parts = (over: Partial<SeedParts> = {}): SeedParts => ({
  slug: 'a-public-trip',
  title: 'A public trip',
  days: 8,
  order: ['s1', 's2', 's3', 's4'],
  rows: [row(1), row(2), row(3, 'CA', 'british-columbia'), row(4)],
  offeredRegions: new Set(['CA/alberta', 'CA/british-columbia']),
  bases: [
    { town: 'ca-ab-banff', name: 'Banff', lat: 51.18, lon: -115.57, nights: 4 },
    { town: 'ca-ab-jasper', name: 'Jasper', lat: 52.87, lon: -118.08, nights: 3 },
  ],
  ...over,
});

describe('Start from this trip (X7)', () => {
  it('seeds the places in the trip\'s order, its areas, nights and bases', () => {
    const { state, skipped } = seedState(parts(), ID, T0, names);
    expect(skipped).toBe(0);
    expect(state.picks.map((p) => p.slug)).toEqual(['s1', 's2', 's3', 's4']);
    expect(state.cc).toBe('CA');
    expect(state.ccName).toBe('Canada');
    expect(state.regions).toEqual(['CA/alberta', 'CA/british-columbia']);
    expect(state.nights).toBe(7);
    expect(state.kind).toBe('week_air');
    expect(state.bases).toEqual([{ town: 'ca-ab-banff', nights: 4, pinned: true }, { town: 'ca-ab-jasper', nights: 3, pinned: true }]);
    expect(state.baseInfo!['ca-ab-banff']!.name).toBe('Banff');
    expect(state.stage).toBe(1);
    expect(state.seed).toBe('a-public-trip');
    expect(state.pickAreas!['place/s3']).toBe('British Columbia');
  });

  it('the plan is the visitor\'s: no start, no origin, no party; our trip is only named as the seed', () => {
    const { state } = seedState(parts(), ID, T0, names);
    expect(state.origin).toBeNull();
    expect(state.start).toBeNull();
    const doc = draftOf(state, 'blue')!;
    expect(doc.seed).toBe('a-public-trip');
    expect(doc.party).toBe('device');
    expect(doc.lastBuild).toBeNull();
  });

  it('cuts the bases\' nights to the trip, keeps one country, and counts the places that are not in our list', () => {
    const { state, skipped } = seedState(parts({ days: 5, order: ['s1', 's2', 's9', 's5'], rows: [row(1), row(2), row(5, 'US', 'utah')] }), ID, T0, names);
    expect(state.nights).toBe(5);
    expect(state.bases.reduce((n, b) => n + (b.nights ?? 0), 0)).toBeLessThanOrEqual(5);
    expect(state.picks.map((p) => p.slug)).toEqual(['s1', 's2']);
    expect(skipped).toBe(2);
  });

  it('keeps every area when the offered list could not be read, and drops the ones the country does not offer', () => {
    expect(seedState(parts({ offeredRegions: null }), ID, T0, names).state.regions).toHaveLength(2);
    expect(seedState(parts({ offeredRegions: new Set(['CA/alberta']) }), ID, T0, names).state.regions).toEqual(['CA/alberta']);
  });

  it('holds at most 40 places', () => {
    const many = Array.from({ length: 50 }, (_, i) => row(i + 1));
    const { state, skipped } = seedState(parts({ order: many.map((r) => r.slug), rows: many, days: 12 }), ID, T0, names);
    expect(state.picks).toHaveLength(SEED_MAX_PICKS);
    expect(skipped).toBe(10);
    expect(state.kind).toBe('holiday');
  });

  it('helpers', () => {
    expect(majorityCountry([row(1), row(2, 'US'), row(3)])).toBe('CA');
    expect(majorityCountry([])).toBeNull();
    expect(regionIdOf('CA', 'british-columbia')).toBe('CA/british-columbia');
    expect(areaWords('british-columbia')).toBe('British Columbia');
  });
});

describe('the town of a trip base', () => {
  const town = (id: string, name: string, lat: number, lon: number): Town => ({ id, name, lat, lon, pop: null, cc: 'ca', region: 'alberta', places: null, distanceKm: null, bearing: null });
  const towns = [town('ca-ab-canmore', 'Canmore', 51.09, -115.36), town('ca-ab-banff', 'Banff', 51.18, -115.57), town('ca-ab-lake-louise', 'Lake Louise', 51.43, -116.18)];
  it('takes the town that carries the base\'s name, even with a word added', () => {
    expect(townOfBase(towns, { name: 'Banff', lat: 0, lon: 0 })!.id).toBe('ca-ab-banff');
    expect(townOfBase(towns, { name: 'Banff townsite', lat: 0, lon: 0 })!.id).toBe('ca-ab-banff');
  });
  it('else the nearest within 25 km, else none', () => {
    expect(townOfBase(towns, { name: 'Johnston Canyon Inn', lat: 51.2, lon: -115.6 })!.id).toBe('ca-ab-banff');
    expect(townOfBase(towns, { name: 'Far away', lat: 40, lon: -100 })).toBeNull();
  });
});
