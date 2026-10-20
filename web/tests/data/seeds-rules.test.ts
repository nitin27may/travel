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

  it('builds no page for an empty shell', () => {
    expect(places().some((p) => p.slug === 'banff-horseback-rides')).toBe(false);
    expect(realData().getPlace('banff-horseback-rides')).toBeFalsy();
  });
});

/** A repo root whose capture data is a copy with `same_place_as` set on one record. */
function dupRoot(secondRef: string, firstRef: string): string {
  const root = fixtureRoot(manifestWith({}));
  rmSync(path.join(root, 'data'));
  mkdirSync(path.join(root, 'data'));
  for (const name of readdirSync(path.join(REPO, 'data'))) if (name !== 'capture') symlinkSync(path.join(REPO, 'data', name), path.join(root, 'data', name));
  cpSync(path.join(REPO, 'data', 'capture'), path.join(root, 'data', 'capture'), { recursive: true });
  const file = path.join(root, 'data', 'capture', 'canadian-rockies-2029', 'migrated.json');
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { records: { ref: string; same_place_as?: string }[] };
  const rec = doc.records.find((r) => r.ref === secondRef);
  if (!rec) throw new Error(`fixture: no record ${secondRef}`);
  rec.same_place_as = firstRef;
  writeFileSync(file, JSON.stringify(doc));
  return root;
}

describe('second records of one place (3.55)', () => {
  const FIRST = 'legacy/canadian-rockies-sept-2029/sights/radium-hot-springs';
  const SECOND = 'legacy/canadian-rockies-sept-2029/adventures/radium-hot-springs';
  const real = buildPlaces(loadSources());
  const fixture = buildPlaces(loadSources({ root: dupRoot(SECOND, FIRST) }));

  it('collapses nothing without a mark', () => {
    expect(real.bySlug.has('radium-hot-springs')).toBe(true);
    expect([...real.legacyPaths.values()].includes('radium-hot-springs')).toBe(false);
  });

  it('builds one page for the pair and points the second slug at it', () => {
    const slug = fixture.byCaptureRef.get(FIRST)!;
    expect(slug).toBe('radium-hot-springs');
    expect(fixture.byCaptureRef.get(SECOND)).toBe(slug);
    expect([...fixture.legacyPaths].filter(([, to]) => to === slug)).toEqual([['/places/radium-hot-springs-pools/', slug]]);
    expect(fixture.bySlug.has('radium-hot-springs-pools')).toBe(false);
    expect(fixture.places.filter((p) => p.name.startsWith('Radium Hot Springs'))).toHaveLength(1);
  });

  it('lets the second name find the first page, so a trip stop and search land on one entry', () => {
    expect(fixture.byName.get('radium hot springs pools')).toEqual(['radium-hot-springs']);
    expect(fixture.byName.get('radium hot springs')).toEqual(['radium-hot-springs']);
  });

  it('writes no redirect when the first record has no page', () => {
    const lone = buildPlaces(loadSources({ root: dupRoot(SECOND, 'trip/patagonia-2027/town:harbour walk') }));
    expect(lone.legacyPaths.size).toBe(real.legacyPaths.size);
  });
});
