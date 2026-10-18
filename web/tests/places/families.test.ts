import { describe, expect, it } from 'vitest';
import '@/components/places/families';
import { placePageFamily } from '@/lib/map/family';
import { assertOneFamilyPerPage, pageFamilyEntries } from '@/lib/map/registry';

describe('map families on the places pages', () => {
  it('registers the list as maplibre and the place page by the flag, one family each', () => {
    const entries = pageFamilyEntries();
    expect(entries.find((e) => e.route === '/places')?.family).toBe('maplibre');
    expect(entries.filter((e) => e.route === '/places/[slug]').every((e) => e.family === placePageFamily())).toBe(true);
    expect(() => assertOneFamilyPerPage()).not.toThrow();
  });
  it('ships on maplibre until a Google key exists', () => {
    expect(placePageFamily({}, undefined)).toBe('maplibre');
    expect(placePageFamily({}, 'google-js')).toBe('maplibre');
  });
  it('switches to google-js or google-embed when the flag and a (fake) key are set', () => {
    expect(placePageFamily({ key: 'fake' }, 'google-js')).toBe('google-js');
    expect(placePageFamily({ key: 'fake' }, 'google-embed')).toBe('google-embed');
  });
});
