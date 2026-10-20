import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlaces } from '@/lib/public/places';
import { MISTYPED_LODGING, SIGHT_OVERRIDES, typeTable } from '@/lib/public/seeds';
import { loadSources } from '@/lib/public/sources';
import { REPO, fixtureRoot, manifestWith, realData } from './support';

// Backlog 3.58 (seed rules) and 3.55 (second records of one place collapse into one page with a 301).
const places = () => realData().internals.places;

describe('seed rules (3.58)', () => {
  it('reads lodging from the stay subtree of the type tree, not from names', () => {
    const table = typeTable(REPO);
    for (const id of ['stay.room.hotel', 'stay.mountain.hut', 'stay.camp.campground', 'stay.self.cabin_cottage']) {
      expect(table.get(id)?.lodging, id).toBe(true);
      expect(table.get(id)?.visitable, id).toBe(false);
    }
    expect(table.get('culture.heritage.landmark')?.lodging).toBe(false);
  });

  it('builds no lodging page: the Prince of Wales Hotel is not a place', () => {
    const slugs = new Set(places().map((p) => p.slug));
    expect(slugs.has('prince-of-wales-hotel')).toBe(false);
    expect(Object.keys(MISTYPED_LODGING).every((ref) => ref.includes('/'))).toBe(true);
    for (const p of places()) expect(p.kind, p.slug).not.toBe('stay');
  });

  it('gives each base-town sight override a page, with a reason in the list', () => {
    for (const [slug, ref] of [['reykjavik-old-harbour', 'town:reykjavik old harbour'], ['san-telmo-market', 'town:san telmo market']] as const) {
      const p = realData().getPlace(slug);
      expect(p, slug).toBeTruthy();
      expect(p?.kind).toBe('sight');
      expect(SIGHT_OVERRIDES[ref]?.reason.length).toBeGreaterThan(10);
    }
  });

  it('builds a page for a record that holds something, and none for one that holds only its name and type', () => {
    // CS7d batch A filled the horseback records, so their pages exist; a bare record added to a copy of the data does not get one
    expect(realData().getPlace('banff-horseback-rides')).toBeTruthy();
    const root = cloneRoot((doc) => doc.records.push({ ref: 'legacy/canadian-rockies-sept-2029/adventures/plc-fixture-shell', type: 'animals.ride.horse_ride', layer: 'offer', name: 'Fixture horse ride' }), 'capture');
    const built = buildPlaces(loadSources({ root }));
    expect(built.seedSkips.find((x) => x.ref.endsWith('plc-fixture-shell'))?.why).toMatch(/^empty shell/);
    expect(built.places.some((p) => p.name === 'Fixture horse ride')).toBe(false);
    expect(built.seedSkips.filter((x) => x.why.startsWith('empty shell')).map((x) => x.ref)).not.toContain('legacy/canadian-rockies-sept-2029/adventures/banff-horse-ride');
  });
});

/** A repo root whose `data/<dir>` is a copy; `edit` changes the Canadian Rockies migrated file of that dir (capture) or adds nothing (relevance). */
function cloneRoot(edit: (doc: { records: Record<string, unknown>[] }) => void, dir: 'capture' | 'relevance'): string {
  const root = fixtureRoot(manifestWith({}));
  rmSync(path.join(root, 'data'));
  mkdirSync(path.join(root, 'data'));
  for (const name of readdirSync(path.join(REPO, 'data'))) if (name !== dir) symlinkSync(path.join(REPO, 'data', name), path.join(root, 'data', name));
  cpSync(path.join(REPO, 'data', dir), path.join(root, 'data', dir), { recursive: true });
  const file = path.join(root, 'data', dir, 'canadian-rockies-2029', dir === 'capture' ? 'migrated.json' : 'PLC-fixture.json');
  const doc = dir === 'capture' ? (JSON.parse(readFileSync(file, 'utf8')) as { records: Record<string, unknown>[] }) : { schema: 'relevance/1', trip: 'canadian-rockies-2029', lane: 'PLC-fixture', researched: '2026-10-19', agent: 'test', model: 'test', sources: [], records: [] as Record<string, unknown>[] };
  edit(doc);
  writeFileSync(file, JSON.stringify(doc));
  return root;
}

/** A root with one more relevance record: `same_place_as` and a draw state, as CS7d writes a duplicate pair. */
function dupRoot(secondRef: string, firstRef: string, draw: string = 'not_applicable'): string {
  return cloneRoot((doc) => doc.records.push({ ref: secondRef, same_place_as: firstRef, draw: { state: draw } }), 'relevance');
}

describe('second records of one place (3.55)', () => {
  const real = buildPlaces(loadSources());

  it('collapses the four pairs CS7d marked: one page each, the second slug redirects', () => {
    const redirects = JSON.parse(readFileSync(path.join(REPO, 'web', 'redirects.json'), 'utf8')) as { from: string; to: string; status: number }[];
    for (const [from, to] of [
      ['/places/radium-hot-springs-pools/', '/places/radium-hot-springs/'],
      ['/places/waterton-red-rock-parkway/', '/places/red-rock-parkway-and-red-rock-canyon/'],
      ['/places/lake-louise-sightseeing/', '/places/lake-louise-summer-gondola/'],
      ['/places/canmore-nordic-centre-provincial-park/', '/places/canmore-nordic-centre-summer/'],
    ]) {
      expect(redirects.find((r) => r.from === from), from).toEqual({ from, to, status: 301 });
      expect(real.legacyPaths.get(from)).toBe(to.replace('/places/', '').replace(/\/$/, ''));
      expect(real.bySlug.has(from.replace('/places/', '').replace(/\/$/, ''))).toBe(false);
      expect(real.bySlug.has(to.replace('/places/', '').replace(/\/$/, ''))).toBe(true);
    }
  });

  it('keeps the two horseback operators as two pages (different operators, about 55 km apart)', () => {
    expect(real.bySlug.has('banff-horseback-rides')).toBe(true);
    expect(real.bySlug.has('brewster-stables-lake-louise-horseback')).toBe(true);
  });

  const FIRST = 'legacy/canadian-rockies-sept-2029/adventures/banff-horse-ride';
  const SECOND = 'legacy/canadian-rockies-sept-2029/adventures/lake-louise-horse';
  const fixture = buildPlaces(loadSources({ root: dupRoot(SECOND, FIRST) }));

  it('builds one page for a marked pair and points the second slug at it (fixture)', () => {
    const slug = fixture.byCaptureRef.get(FIRST)!;
    expect(slug).toBe('banff-horseback-rides');
    expect(fixture.byCaptureRef.get(SECOND)).toBe(slug);
    expect(fixture.legacyPaths.get('/places/brewster-stables-lake-louise-horseback/')).toBe(slug);
    expect(fixture.bySlug.has('brewster-stables-lake-louise-horseback')).toBe(false);
    expect(fixture.places.length).toBe(real.places.length - 1);
  });

  it('sends a link by the second ref to the first page, and the second name finds the same page, so a trip stop that uses it keeps its link and its own item', () => {
    expect(fixture.byCaptureRef.get(SECOND)).toBe('banff-horseback-rides');
    expect(fixture.byName.get('brewster stables lake louise horseback')).toEqual(['banff-horseback-rides']);
    expect(fixture.byName.get('banff horseback rides')).toEqual(['banff-horseback-rides']);
  });

  it('keeps two pages when same_place_as means an activity at a place (the draw is not not_applicable)', () => {
    const activity = buildPlaces(loadSources({ root: dupRoot(SECOND, FIRST, 'value') }));
    expect(activity.places.length).toBe(real.places.length);
    expect(activity.bySlug.has('brewster-stables-lake-louise-horseback')).toBe(true);
  });

  it('writes no redirect when the first record has no page', () => {
    const lone = buildPlaces(loadSources({ root: dupRoot(SECOND, 'trip/patagonia-2027/town:harbour walk') }));
    expect(lone.legacyPaths.size).toBe(real.legacyPaths.size);
    expect(lone.bySlug.has('brewster-stables-lake-louise-horseback')).toBe(true);
  });
});
