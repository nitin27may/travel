import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { CATEGORIES, type Category } from '@/lib/public/types';
import { TRIP_SLUGS } from '@/lib/public/slugs';
import { fixtureRoot, manifestWith, realData } from './support';

const d = realData();

describe('trips', () => {
  it('lists every public trip and nothing else (all 14 today)', () => {
    const slugs = d.listTrips().map((t) => t.slug).sort();
    expect(slugs).toEqual(Object.values(TRIP_SLUGS).sort());
  });

  it('follows the manifest: a private flag removes the trip from every function', () => {
    const root = fixtureRoot(manifestWith({ 'patagonia-feb-mar-2027': { private: true }, 'vermont-fall-2026': { visibility: 'unlisted' } }));
    const f = createPublicData({ root, hubRows: [] });
    expect(f.listTrips().map((t) => t.slug)).not.toContain('patagonia-2027');
    expect(f.tripSlugs()).not.toContain('patagonia-2027');
    expect(f.getTrip('patagonia-2027')).toBeNull();
    // unlisted: built and reachable, but not listed
    expect(f.listTrips().map((t) => t.slug)).not.toContain('vermont-fall-2026');
    expect(f.getTrip('vermont-fall-2026')?.visibility).toBe('unlisted');
    // every public function: lists, pages of both kinds, the globe and the redirects (the API, search, exports and sitemap: private-trip-scan.test.ts)
    const json = JSON.stringify({ a: f.listTrips(), b: f.listPlaces(), c: f.globeIndex(), d: f.tripSlugs(), p: f.placeSlugs().map((s) => f.getPlace(s)), t: f.tripSlugs().map((s) => f.getTrip(s)), g: f.globePaths(), r: f.legacyPlaceRedirects() });
    expect(json).not.toContain('patagonia-2027');
    expect(json).not.toContain('patagonia-feb-mar-2027');
    expect(json).not.toMatch(/Patagonia with kids/);
  });

  it('fails closed: a folder missing from the manifest, or an odd flag, is not built', () => {
    const folders = manifestWith({ 'iceland-ring-road': { private: 'yes' }, 'costa-rica-feb-2027': { visibility: 'everyone' } }).filter((f) => f.slug !== 'switzerland-2027');
    const f = createPublicData({ root: fixtureRoot(folders), hubRows: [] });
    const slugs = f.tripSlugs();
    for (const s of ['iceland-ring-road-2027', 'costa-rica-2027', 'switzerland-2027']) expect(slugs).not.toContain(s);
    expect(slugs).toContain('dolomites-2027');
  });

  it('a private place-store trip link never names the trip on a place', () => {
    const f = createPublicData({ root: fixtureRoot(manifestWith({ 'vermont-fall-2026': { private: true } })), hubRows: [] });
    const stowe = f.getPlace('stowe');
    expect(stowe).not.toBeNull();
    expect(JSON.stringify(stowe)).not.toMatch(/vermont-fall|Vermont foliage/i);
    expect(stowe!.trips).toEqual([]);
  });

  it('dolomites has 14 ordered days, each with a base and items; categories hold distinct items in the fixed order', () => {
    const t = d.getTrip('dolomites-2027')!;
    expect(t.depth).toBe('full');
    expect(t.days.map((x) => x.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    for (const day of t.days.slice(0, 13)) {
      expect(day.base).toBeTruthy();
      expect(day.items.length).toBeGreaterThan(0);
    }
    expect(Object.keys(t.categories)).toEqual([...CATEGORIES]);
    expect(CATEGORIES).toEqual(['stays', 'trails', 'sights', 'activities', 'food', 'logistics']);
    for (const c of CATEGORIES) {
      const keys = t.categories[c as Category].map((x) => x.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    // an item on two days is one entry: Venice airport is day 1 and day 14
    const vce = t.categories.logistics.find((x) => /Marco Polo/.test(x.name))!;
    expect(vce.days).toEqual([1, 14]);
    // stays come from the bases, with nights, and never name an example hotel
    expect(t.categories.stays.map((s) => s.nights)).toEqual([4, 4, 4, 1]);
    expect(t.categories.stays[0].detail).toBe('4 nights');
    expect(JSON.stringify(t)).not.toMatch(/Example (hotel|guesthouse)/i);
  });

  it('a car park is folded into the walk it serves, not counted as an item', () => {
    const t = d.getTrip('dolomites-2027')!;
    const day6 = t.days[5];
    const lot = day6.items.find((i) => i.kind === 'parking')!;
    expect(lot.category).toBeNull();
    const target = day6.items.find((i) => i.id === lot.foldedInto)!;
    expect(target.access).toMatch(/Park at Passo Tre Croci/);
    expect(t.categories.logistics.some((r) => /Tre Croci/.test(r.name))).toBe(false);
  });

  it('rockies has 15 days with tracks, Lake Louise and Kananaskis stays with nights, and no Waterton', () => {
    const t = d.getTrip('canadian-rockies-2029')!;
    expect(t.days).toHaveLength(15);
    expect(t.days.every((x) => x.tracks && x.tracks.length > 0)).toBe(true);
    expect(t.days[0].tracks!.map((x) => x.id)).toEqual(['B', 'C']);
    const stays = t.categories.stays;
    expect(stays.find((s) => /Lake Louise/.test(s.name))?.nights).toBe(1);
    expect(stays.filter((s) => /Lake Louise/.test(s.name)).map((s) => s.nights).sort()).toEqual([1, 4]);
    expect(stays.find((s) => /Kananaskis/.test(s.name))?.nights).toBe(3);
    expect(stays.reduce((n, s) => n + (s.nights ?? 0), 0)).toBe(14);
    expect(JSON.stringify({ d: t.days, c: t.categories, b: t.bases })).not.toMatch(/waterton/i);
  });

  it('summary trips have condensed days, overview trips have none and an empty category strip', () => {
    const p = d.getTrip('patagonia-2027')!;
    expect(p.depth).toBe('summary');
    expect(p.days.length).toBe(14);
    expect(p.honesty.map((h) => h.id)).toContain('condensed');
    const drive = p.days.flatMap((x) => x.items).filter((i) => (i.kind as string) === 'drive');
    expect(drive).toEqual([]); // a drive stop is the day's drive, not a row
    const c = d.getTrip('costa-rica-2027')!;
    expect(c.depth).toBe('overview');
    expect(c.days).toEqual([]);
    for (const k of CATEGORIES) expect(c.categories[k]).toEqual([]);
    expect(c.honesty.map((h) => h.id)).toContain('overview_only');
  });

  it('no trip carries a status computed from the household\'s real trip date (PRIV-TD)', () => {
    for (const t of d.listTrips()) expect(Object.keys(t), t.slug).not.toContain('isDone');
    for (const t of d.internals.trips) expect(Object.keys(t), t.slug).not.toContain('isDone');
  });
});

describe('places', () => {
  it('every place has a unique stable slug and a redirect from every old place URL', () => {
    const slugs = d.placeSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    const redirects = d.legacyPlaceRedirects();
    const real = d.internals.places.filter((p) => p.sources.includes('locations'));
    // every saved place has its old nested URL; a merged duplicate (3.55) adds one flat /places/<slug>/ rule on top
    const merged = redirects.filter((r) => /^\/places\/[^/]+\/$/.test(r.from));
    expect(redirects.length - merged.length).toBe(real.length);
    for (const m of merged) expect(slugs).not.toContain(m.from.replace(/^\/places\/|\/$/g, ''));
    for (const r of redirects) expect(slugs).toContain(r.to.replace(/^\/places\/|\/$/g, ''));
    expect(createPublicData({ hubRows: [] }).placeSlugs()).toEqual(slugs);
  });

  it('prototype places carry the area chain table and never a Google point', () => {
    for (const p of d.internals.places) {
      expect(p.areaChain).toHaveLength(3);
      if (p.point) expect(p.point.pointSource).not.toMatch(/google/i);
      for (const a of [p.access?.trailhead, ...(p.access?.parking ?? [])]) if (a) expect(a.pointSource).not.toMatch(/google/i);
    }
    expect(d.getPlace('tre-cime-di-lavaredo-loop')?.areaChain.map((a) => a.slug)).toEqual(['it', 'veneto', 'auronzo']);
  });

  it('every line says whether it can be exported; unconfirmed routes are held back', () => {
    const seceda = d.getPlace('seceda-ridge')!;
    expect(seceda.honesty.map((h) => h.id)).toContain('location_unconfirmed');
    const withLines = d.internals.places.filter((p) => p.lines.length);
    expect(withLines.length).toBeGreaterThan(5);
    for (const l of withLines.flatMap((p) => p.lines)) expect(typeof l.exportable).toBe('boolean');
    expect(d.getPlace('fanes-falls') ?? d.internals.places.find((p) => /Fanes/.test(p.name))!.lines.every((l) => !l.exportable)).toBeTruthy();
  });

  it('only airports, parking and example stays are left out of the places', () => {
    const names = d.internals.places.map((p) => p.name).join('|');
    expect(names).not.toMatch(/Marco Polo|Example/);
    expect(names).toMatch(/Lago di Braies/);
  });
});

describe('photos', () => {
  it('every photo has an author and a licence; none without', () => {
    const all = [
      ...d.internals.places.flatMap((p) => p.photos),
      ...d.internals.trips.flatMap((t) => [...t.gallery, ...(t.cover ? [t.cover] : [])]),
    ];
    expect(all.length).toBeGreaterThan(100);
    for (const p of all) {
      expect(p.author.length).toBeGreaterThan(0);
      expect(p.licence.length).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.+\?width=\d+$/);
    }
  });
});

describe('globe', () => {
  it('counts places and trips by continent, country, state and district, and lists paths with content', () => {
    const g = d.globeIndex();
    expect(g.continents.map((c) => c.name)).toContain('Europe');
    expect(g.continents.every((c) => c.name !== 'Other')).toBe(true);
    const paths = d.globePaths().map((p) => p.join('/'));
    expect(paths).toContain('it');
    expect(paths).toContain('it/south-tyrol');
    expect(paths.length).toBe(new Set(paths).size);
    expect(g.pins.filter((p) => p.kind === 'trip').length).toBeGreaterThan(8);
  });
});
