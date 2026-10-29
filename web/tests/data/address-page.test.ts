import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { REPO } from './support';

// LT-M end to end: a stored address and map sheet survive the page builder's text scrub (which blanks a street address by shape and strips a URL),
// and reach the place object the page and the API read. The root is a temporary copy of data/capture with two fixture values written into it; the
// rest of the repository is linked, and nothing in data/ is changed.
const root = mkdtempSync(path.join(tmpdir(), 'ltm-root-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
for (const n of ['legacy', 'research']) symlinkSync(path.join(REPO, n), path.join(root, n));
const dataDir = path.join(root, 'data');
mkdirSync(dataDir);
for (const n of readdirSync(path.join(REPO, 'data'))) if (n !== 'capture') symlinkSync(path.join(REPO, 'data', n), path.join(dataDir, n));
cpSync(path.join(REPO, 'data', 'capture'), path.join(dataDir, 'capture'), { recursive: true });

const val = (v: unknown) => ({ state: 'value', v, basis: 'official_page', src: [], on: '2026-10-28' });
const find = (o: unknown, ref: string): Record<string, unknown> | null => {
  if (Array.isArray(o)) for (const x of o) { const r = find(x, ref); if (r) return r; }
  else if (o && typeof o === 'object') {
    const rec = o as Record<string, unknown>;
    if (rec.ref === ref && 'type' in rec) return rec;
    for (const v of Object.values(rec)) { const r = find(v, ref); if (r) return r; }
  }
  return null;
};
const edit = (file: string, ref: string, fn: (r: Record<string, unknown>) => void) => {
  const p = path.join(dataDir, 'capture', file);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  fn(find(doc, ref)!);
  writeFileSync(p, JSON.stringify(doc));
};
edit('canadian-rockies-2029/CS7.json', 'part/place/lake-louise#parking', (r) => {
  r.address = val({ kind: 'postal', lines: ['Lake Louise Lakeshore car park', '3200 Old Faithful Loop Road'], locality: 'Lake Louise', postcode: 'T0L 1E0' });
});
edit('canadian-rockies-2029/migrated.json', 'place/lake-louise', (r) => {
  r.osm_ref = val('relation/1234567');
  r.links = [...(r.links as unknown[]), { kind: 'map_sheet', url: 'https://example.test/lake-louise-map.pdf', state: 'filled', on: '2026-10-28', src: [] }];
});

describe('a stored address on the built place', () => {
  const place = createPublicData({ root }).getPlace('lake-louise')!;
  it('keeps the street address whole, through the text scrub that blanks a street shape in prose', () => {
    expect(place.sections?.address).toMatchObject({ kind: 'postal', lines: ['Lake Louise Lakeshore car park', '3200 Old Faithful Loop Road'], locality: 'Lake Louise', postcode: 'T0L 1E0' });
  });
  it('keeps the map sheet link and the OpenStreetMap element', () => {
    expect(place.sections?.mapSheet).toBe('https://example.test/lake-louise-map.pdf');
    expect(place.sections?.osmRef).toBe('relation/1234567');
  });
  it('another place, with no address data, carries none of the three', () => {
    const other = createPublicData({ root }).getPlace('athabasca-falls')!;
    expect(other.sections?.address).toBeUndefined();
    expect(other.sections?.mapSheet).toBeUndefined();
  });
});
