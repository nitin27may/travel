import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GlobePage from '@/app/globe/page';
import GlobePathPage, * as globePath from '@/app/globe/[...path]/page';
import GlobePlacePage, * as globePlace from '@/app/globe/place/[slug]/page';
import GlobeTripPage, * as globeTrip from '@/app/globe/trip/[slug]/page';
import PlaceStub, * as placeStub from '@/app/places/[slug]/page';
import TripStub, * as tripStub from '@/app/trips/[slug]/page';

// Every public route in patterns 1.2 is a page or a stub that renders its title and a skeleton; the owning lane fills
// generateStaticParams. Until then each builds one noindex placeholder page (`output: export` rejects an empty list).
const dynamicStubs = [
  { name: 'trips/[slug]', mod: tripStub, page: TripStub, params: { slug: 'dolomites-2027' }, title: 'Dolomites 2027' },
  { name: 'places/[slug]', mod: placeStub, page: PlaceStub, params: { slug: 'tre-cime-loop' }, title: 'Tre Cime Loop' },
  { name: 'globe/[...path]', mod: globePath, page: GlobePathPage, params: { path: ['it', 'south-tyrol'] }, title: 'It South Tyrol' },
  { name: 'globe/place/[slug]', mod: globePlace, page: GlobePlacePage, params: { slug: 'lago-di-braies' }, title: 'Lago Di Braies' },
  { name: 'globe/trip/[slug]', mod: globeTrip, page: GlobeTripPage, params: { slug: 'patagonia-2027' }, title: 'Patagonia 2027' },
];

describe('route stubs', () => {
  for (const s of dynamicStubs) {
    it(`${s.name}: one placeholder param, dynamicParams off, renders title and skeleton`, async () => {
      expect(s.mod.generateStaticParams()).toEqual([s.name.includes('...') ? { path: ['stub'] } : { slug: 'stub' }]);
      expect(s.mod.metadata.robots).toEqual({ index: false, follow: false });
      expect(s.mod.metadata.openGraph).toBeTruthy();
      expect(s.mod.dynamicParams).toBe(false);
      const html = renderToString(await (s.page as (p: { params: Promise<unknown> }) => Promise<React.ReactElement>)({ params: Promise.resolve(s.params) }));
      expect(html).toContain(s.title);
      expect(html).toContain('data-stub="' + s.name + '"');
      expect(html).toContain('aria-busy="true"');
    });
  }
  it('globe: renders its title and a skeleton', () => {
    const html = renderToString(GlobePage());
    expect(html).toContain('Globe');
    expect(html).toContain('data-stub="globe"');
  });
});
