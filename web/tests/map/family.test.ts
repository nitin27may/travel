import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { placePageFamily, resetFamilyWarning, resolveFamily } from '@/lib/map/family';

describe('map family resolution', () => {
  beforeEach(() => resetFamilyWarning());
  afterEach(() => vi.restoreAllMocks());

  it('defaults to maplibre', () => {
    expect(resolveFamily(undefined, {})).toBe('maplibre');
    expect(placePageFamily({}, undefined)).toBe('maplibre');
  });
  it('falls back from a Google family to maplibre when the key is absent, with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveFamily('google-js', {})).toBe('maplibre');
    expect(resolveFamily('google-embed', {})).toBe('maplibre');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('keeps the Google family when a key is present', () => {
    expect(resolveFamily('google-js', { key: 'fake-key' })).toBe('google-js');
    expect(resolveFamily('google-embed', { key: 'fake-key' })).toBe('google-embed');
  });
  it('reads the place page family from the flag, ignoring junk', () => {
    expect(placePageFamily({ key: 'k' }, 'google-embed')).toBe('google-embed');
    expect(placePageFamily({ key: 'k' }, 'bing')).toBe('maplibre');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(placePageFamily({}, 'google-js')).toBe('maplibre');
  });
});

describe('the trip page family (map note 2.1)', () => {
  it('is google-js only with BOTH the key and the Map ID, else maplibre; never the demo Map ID', async () => {
    const { tripPageFamily } = await import('@/lib/map/family');
    expect(tripPageFamily({ key: 'k', mapId: 'm' }, undefined)).toBe('google-js');
    expect(tripPageFamily({ key: 'k' }, undefined)).toBe('maplibre');
    expect(tripPageFamily({ mapId: 'm' }, undefined)).toBe('maplibre');
    expect(tripPageFamily({}, undefined)).toBe('maplibre');
  });
  it('the test override wins, and a Google override still needs a key', async () => {
    const { tripPageFamily } = await import('@/lib/map/family');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(tripPageFamily({ key: 'k', mapId: 'm' }, 'maplibre')).toBe('maplibre');
    expect(tripPageFamily({ key: 'k' }, 'google-js')).toBe('google-js');
    expect(tripPageFamily({}, 'google-js')).toBe('maplibre');
    expect(tripPageFamily({ key: 'k', mapId: 'm' }, 'bing')).toBe('google-js');
  });
});
