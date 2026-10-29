import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import { createPublicData } from '@/lib/public';
import { TRIP_SLUGS } from '@/lib/public/slugs';
import { normName } from '@/lib/public/places';
import { publicWorld, scopeOf } from '@/lib/public/world';
import { REPO, fixtureRoot, manifestWith } from './support';

// PV-PRIV: a trip that is not built vanishes from EVERY public output, not only from the trip list. Catalogue places carry derived
// pointers (Similar nearby, pairs, Plan B, "Coming from far?", parts, parks-for, same-place) to trip records; the adapter's world is cut
// at load (lib/public/world.ts publicView), so none of them can name a hidden trip's record. These tests build the public data with
// trips flagged private and scan the serialised output of every public function for any trace: the trip's slug and folder, its title,
// its capture refs, and the names of places that exist only in that trip.

const FOLDER = 'patagonia-feb-mar-2027';
const SLUG = TRIP_SLUGS[FOLDER]!;

const raw = loadWorld(REPO);

/**
 * Names of records that exist only in `slug`'s capture files: not a name of any other record, and not written anywhere in the records
 * of other trips and the catalogue or in the saved places (a catalogue page may name "the Beagle Channel" from its own research).
 */
function onlyInTrip(slug: string): string[] {
  const elsewhere = new Set<string>();
  const texts: string[] = [readFileSync(path.join(REPO, 'data', 'locations', 'locations.json'), 'utf8')];
  for (const m of [raw.cap, raw.suit, raw.rel]) for (const { rec, trip } of m.values()) if (trip !== slug) texts.push(JSON.stringify(rec));
  for (const { rec, trip } of raw.cap.values()) if (trip !== slug && rec.name) elsewhere.add(normName(rec.name));
  const text = texts.join('\n').toLowerCase();
  const own = [...raw.cap.values()].filter((l) => l.trip === slug).flatMap((l) => (l.rec.name ? [l.rec.name] : []));
  // a name that is a word of the language ("Coastal path") is not a trace; a proper name is
  return [...new Set(own)].filter((n) => !elsewhere.has(normName(n)) && !text.includes(n.toLowerCase()) && /[A-Z][a-z]+ .*[A-Z]|[A-Z][a-z]{4,}/.test(n.replace(/^[A-Z]/, '')));
}

/** Every trace of a hidden trip a serialised output may hold. */
function traces(folder: string): RegExp[] {
  const slug = TRIP_SLUGS[folder]!;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`\\b(?:trip|legacy)/${esc(slug)}\\b`),
    new RegExp(`\\b(?:trip|legacy)/${esc(folder)}\\b`),
    new RegExp(`["/]${esc(slug)}["/]`),
    new RegExp(esc(folder)),
  ];
}

const dump = (f: ReturnType<typeof createPublicData>) =>
  JSON.stringify({
    trips: f.listTrips(),
    tripSlugs: f.tripSlugs(),
    tripPages: f.tripSlugs().map((s) => f.getTrip(s)),
    places: f.listPlaces(),
    placePages: f.placeSlugs().map((s) => f.getPlace(s)),
    globe: f.globeIndex(),
    paths: f.globePaths(),
    redirects: f.legacyPlaceRedirects(),
  });

describe('a private trip leaves no trace in the adapter (every public function)', () => {
  const f = createPublicData({ root: fixtureRoot(manifestWith({ [FOLDER]: { private: true } })), hubRows: [] });
  const out = dump(f);

  it('found trip-only names to look for', () => {
    expect(onlyInTrip(SLUG).length).toBeGreaterThan(4);
  });

  it('no slug, folder, capture ref or title of the trip', () => {
    for (const re of traces(FOLDER)) expect(out, String(re)).not.toMatch(re);
    expect(out).not.toMatch(/Patagonia with kids/);
  });

  it('no name that exists only in the trip (the Similar nearby, pairs and pointers of catalogue pages included)', () => {
    const lower = out.toLowerCase();
    expect(onlyInTrip(SLUG).filter((n) => lower.includes(n.toLowerCase()))).toEqual([]);
  });

  it('the catalogue pages that pointed into the trip are still built, with the pointers gone', () => {
    const chalten = f.getPlace('el-chalten')!;
    expect(chalten).not.toBeNull();
    const rel = chalten.relevance!;
    for (const r of [...rel.similar, ...rel.similarArea, ...rel.pairs, ...rel.partOf, ...(rel.pointer ? [rel.pointer] : []), ...(rel.planB ? [rel.planB] : [])]) {
      expect(r.ref).not.toMatch(/trip\/patagonia/);
    }
    expect(Object.keys(chalten.refSlugs ?? {}).filter((r) => /patagonia-2027/.test(r))).toEqual([]);
  });

  it('the cut world holds no record of the trip and no ref to one', () => {
    const w = publicWorld(fixtureRoot(manifestWith({ [FOLDER]: { private: true } })));
    expect(scopeOf(w)?.tripHidden(SLUG)).toBe(true);
    expect([...w.cap.values(), ...w.suit.values(), ...w.rel.values()].filter((l) => l.trip === SLUG)).toEqual([]);
    const text = JSON.stringify({ cap: [...w.cap.values()].map((l) => l.rec), suit: [...w.suit.values()].map((l) => l.rec), rel: [...w.rel.values()].map((l) => l.rec), inc: [...w.incoming], alias: [...w.alias], points: w.points });
    expect(text).not.toMatch(/(?:trip|legacy)\/patagonia/);
  });
});

describe('with every trip private, no trip record reaches a public output', () => {
  const all = Object.fromEntries(Object.keys(TRIP_SLUGS).map((f) => [f, { private: true }]));
  const f = createPublicData({ root: fixtureRoot(manifestWith(all)), hubRows: [] });
  const out = dump(f);

  it('no trip is built and no capture ref of a trip is anywhere', () => {
    expect(f.tripSlugs()).toEqual([]);
    expect(out).not.toMatch(/\b(?:part\/|offer\/)?(?:trip|legacy)\/[a-z0-9-]+\//);
    for (const folder of Object.keys(TRIP_SLUGS)) expect(out, folder).not.toContain(folder);
  });

  it('the cut world keeps the catalogue only', () => {
    const w = publicWorld(fixtureRoot(manifestWith(all)));
    expect(new Set([...w.cap.values()].map((l) => l.trip))).toEqual(new Set(['catalogue']));
  });
});

describe('with every trip built, nothing is cut (the public world is the raw one)', () => {
  it('the same records, inverses and aliases', () => {
    const w = publicWorld(REPO);
    expect(w.cap.size).toBe(raw.cap.size);
    expect(w.suit.size).toBe(raw.suit.size);
    expect(w.rel.size).toBe(raw.rel.size);
    expect(w.alias.size).toBe(raw.alias.size);
    expect(scopeOf(w)?.tripHidden(SLUG)).toBe(false);
  });
});

// The outputs built on top of the adapter: the API store (lists, pages, nearby, near, search, parse, cards, exports, globe, resolve), the
// plan builder's candidates, the place shards and search parts, and the sitemap. They read the default root, so TRAVEL_ROOT points it
// at a fixture whose manifest marks the trip private, and the modules are loaded fresh.
describe('a private trip leaves no trace in the API, the plan candidates, the search parts or the sitemap', () => {
  const before = process.env.TRAVEL_ROOT;
  let text = '';
  const okCount = { exports: 0, pages: 0, candidates: 0 };
  beforeAll(async () => {
    process.env.TRAVEL_ROOT = fixtureRoot(manifestWith({ [FOLDER]: { private: true } }));
    vi.resetModules();
    const { getStore, setStore } = await import('@/lib/server/store');
    setStore(null);
    const store = getStore();
    const pub = await import('@/lib/public');
    const { placeShards, placeTextShards } = await import('@/app/places/shards');
    const { buildSearchParts } = await import('@/lib/search/build');
    const { buildGlobeFiles } = await import('@/lib/globe/data');
    const { sitemapInput } = await import('@/lib/sitemap');
    const { createPlanService, defaultDrive } = await import('@/lib/server/planService');
    const parts: unknown[] = [];
    const add = (v: unknown) => parts.push(v);
    const slugs = pub.placeSlugs();
    add(await store.listPlaces({}, { page: 1, pageSize: 100 }));
    for (let p = 2; p <= Math.ceil(slugs.length / 100); p++) add(await store.listPlaces({}, { page: p, pageSize: 100 }));
    add(await store.listTrips({}, { page: 1, pageSize: 100 }));
    for (const s of slugs) {
      const page = await store.getPlace(s);
      if (page.ok) okCount.pages++;
      add(page);
      add(await store.nearbyForPlace(s));
      for (const format of ['json', 'gpx', 'kml', 'csv'] as const) {
        const r = await store.getExport({ type: 'place', slug: s, format });
        if (r.ok) okCount.exports++;
        add(r);
      }
    }
    for (const s of pub.tripSlugs()) {
      add(await store.getTrip(s));
      for (const format of ['json', 'ics', 'gpx'] as const) add(await store.getExport({ type: 'trip', slug: s, format }));
      add(await store.tripLegs(s));
    }
    for (const s of [SLUG, FOLDER, 'laguna-de-los-tres', 'mirador-de-los-condores']) {
      add(await store.getPlace(s));
      add(await store.getTrip(s));
      for (const format of ['json', 'ics', 'csv', 'kml', 'gpx', 'print'] as const) add(await store.getExport({ type: 'trip', slug: s, format }));
    }
    for (const q of ['patagonia', 'laguna', 'mirador', 'chalten', 'fitz roy', 'ushuaia', 'glacier']) {
      add(await store.search({ q }));
      add(await store.searchCards({ q }));
      add(await store.parse({ q }));
      add(await store.listPlaces({ q }, { page: 1, pageSize: 100 }));
    }
    add(await store.near({ near: 'place:el-chalten', r: 100 }, { page: 1, pageSize: 100 }));
    add(await store.resolveRefs({ refs: [`trip:${SLUG}`, 'place:el-chalten', 'place:laguna-de-los-tres'] }));
    add(await store.globeTree());
    add(await store.globePins('ar'));
    const service = createPlanService({ store, legs: null, reference: { hub: () => null, airport: () => null, groups: () => [] }, drive: defaultDrive, now: () => new Date('2026-10-28T12:00:00Z') });
    for (const rg of ['AR/santa-cruz', 'AR/tierra-del-fuego', 'AR/buenos-aires']) add(await service.candidates({ mode: 'trip', cc: 'AR', regions: [rg] } as never).then((r) => (r.ok && okCount.candidates++, r)));
    add(placeShards());
    add(placeTextShards());
    add(buildSearchParts());
    add(buildGlobeFiles());
    add(sitemapInput(pub.placeSlugs(), pub.listTrips().map((t) => t.slug)));
    text = JSON.stringify(parts);
  }, 240_000);
  afterAll(async () => {
    if (before === undefined) delete process.env.TRAVEL_ROOT;
    else process.env.TRAVEL_ROOT = before;
    const { setStore } = await import('@/lib/server/store');
    setStore(null);
    vi.resetModules();
  });

  it('scanned real answers (the catalogue Patagonia pages are still served)', () => {
    expect(text.length).toBeGreaterThan(100_000);
    expect(text).toContain('el-chalten');
    expect(okCount.pages).toBeGreaterThan(300);
    expect(okCount.exports).toBeGreaterThan(100);
    expect(okCount.candidates).toBeGreaterThan(0);
  });

  it('no slug, folder, capture ref or title of the trip', () => {
    for (const re of traces(FOLDER)) expect(text, String(re)).not.toMatch(re);
    expect(text).not.toMatch(/Patagonia with kids/);
  });

  it('no name that exists only in the trip', () => {
    const lower = text.toLowerCase();
    expect(onlyInTrip(SLUG).filter((n) => lower.includes(n.toLowerCase()))).toEqual([]);
  });
});

it('the trip-only names are read from the capture files (sanity of the scan itself)', () => {
  const files = readdirSync(path.join(REPO, 'data', 'capture', SLUG)).filter((n) => n.endsWith('.json'));
  expect(files.length).toBeGreaterThan(0);
  expect(onlyInTrip(SLUG)).toContain('Mirador de los Condores');
});
