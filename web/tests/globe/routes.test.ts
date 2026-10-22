import { describe, expect, it } from 'vitest';
import GlobePage, { metadata } from '@/app/globe/page';
import * as globePath from '@/app/globe/[...path]/page';
import * as globePlace from '@/app/globe/place/[slug]/page';
import * as globeTrip from '@/app/globe/trip/[slug]/page';

// The globe itself is drawn by the layout; the route files give each URL its static params and metadata.
describe('globe routes', () => {
  it('/globe/ renders nothing of its own and has metadata', () => {
    expect(GlobePage()).toBeNull();
    expect(metadata.title).toBeTruthy();
  });
  for (const [name, mod] of [['place', globePlace], ['trip', globeTrip]] as const) {
    it(`/globe/${name}: pre-renders at least one param and refuses unknown ones`, () => {
      expect(mod.generateStaticParams().length).toBeGreaterThan(0);
      expect(mod.dynamicParams).toBe(false);
    });
  }
  it('/globe/path: pre-renders the levels with content and renders any other level on request (server mode; tests/e2e/globe.levels.spec.ts)', () => {
    expect(globePath.generateStaticParams().length).toBeGreaterThan(0);
    expect(globePath.dynamicParams).toBe(true);
  });
  it('a place URL is noindex (the place has its own indexed page)', async () => {
    const m = await globePlace.generateMetadata({ params: Promise.resolve({ slug: 'lago-di-braies' }) });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
