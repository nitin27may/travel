import { describe, expect, it } from 'vitest';
import { loadPlaces } from '@/lib/data/places';
import { loadDataTrips, loadListedTrips, loadTrips } from '@/lib/data/trips';
import { builtOnly, isBuilt, isIndexable, isListed, listedOnly, parseVisibility } from '@/lib/visibility';
import { FIXTURE_ROOT } from './helpers';

describe('visibility rule (plan 1.3)', () => {
  it('parses the three words and fails closed on anything else', () => {
    expect(parseVisibility('public')).toBe('public');
    expect(parseVisibility('unlisted')).toBe('unlisted');
    expect(parseVisibility('private')).toBe('private');
    for (const bad of [undefined, null, '', 'Public', 'hidden', 1, {}]) expect(parseVisibility(bad)).toBe('private');
  });

  it('builds public and unlisted, lists and indexes only public', () => {
    expect([isBuilt('public'), isBuilt('unlisted'), isBuilt('private')]).toEqual([true, true, false]);
    expect([isListed('public'), isListed('unlisted'), isListed('private')]).toEqual([true, false, false]);
    expect([isIndexable('public'), isIndexable('unlisted'), isIndexable('private')]).toEqual([true, false, false]);
    const items = [{ visibility: 'public' as const }, { visibility: 'unlisted' as const }, { visibility: 'private' as const }];
    expect(builtOnly(items)).toHaveLength(2);
    expect(listedOnly(items)).toHaveLength(1);
  });
});

describe('loaders honour visibility', () => {
  it('never returns the private trip', () => {
    const slugs = loadDataTrips(FIXTURE_ROOT).map((t) => t.slug);
    expect(slugs).toContain('public-trip');
    expect(slugs).toContain('unlisted-trip');
    expect(slugs).not.toContain('private-trip');
  });

  it('lists only public data trips plus the legacy rows', () => {
    process.env.LEGACY_TRIPS_JSON = `${FIXTURE_ROOT}/legacy-trips.json`;
    try {
      expect(loadListedTrips(FIXTURE_ROOT).map((t) => t.slug).sort()).toEqual(['legacy-one', 'legacy-two', 'public-trip']);
      expect(loadTrips(FIXTURE_ROOT).map((t) => t.slug)).toContain('unlisted-trip');
    } finally {
      delete process.env.LEGACY_TRIPS_JSON;
    }
  });

  it('works with zero data trips', () => {
    process.env.LEGACY_TRIPS_JSON = `${FIXTURE_ROOT}/legacy-trips.json`;
    try {
      // the repo root has no data/trips folder yet
      expect(loadDataTrips(`${FIXTURE_ROOT}/legacy`)).toEqual([]);
    } finally {
      delete process.env.LEGACY_TRIPS_JSON;
    }
  });

  it('does not name or count a trip that is not public', () => {
    process.env.LEGACY_TRIPS_JSON = `${FIXTURE_ROOT}/legacy-trips.json`;
    try {
      const places = loadPlaces(FIXTURE_ROOT);
      for (const p of places) {
        expect(p.trip === null || p.trip === 'public-trip').toBe(true);
        expect(p.trip_title === null || !/Private|Unlisted/.test(p.trip_title)).toBe(true);
      }
    } finally {
      delete process.env.LEGACY_TRIPS_JSON;
    }
  });
});
