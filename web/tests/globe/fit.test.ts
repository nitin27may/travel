import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitMove, inBox4, type FeatureFit } from '@/lib/globe/fit';
import { norm, search, type GazRow } from '@/lib/globe/search';
import { nfQueryCases } from './nf-cases';
import { parseNatural, withNatural } from '@/lib/globe/url';
import { WEB } from '../helpers';

const GAZ = path.join(WEB, 'public', 'globe', 'data', 'gazetteer.json');
const rows = JSON.parse(readFileSync(GAZ, 'utf8')) as GazRow[];
const natural = rows.filter((r) => r[0] === 'physical' || r[0] === 'marine' || r[0] === 'river');

describe('one fit model (backlog 9.7)', () => {
  const plain: FeatureFit = { bbox: [76.6, 21.7, 91.3, 30.5], lineId: 'ganges-plain', cls: 'area', rank: 2 };
  it('fits a box for a line or an area, with more room in context than tight', () => {
    const ctx = fitMove(plain, [84, 26], 'context');
    const tight = fitMove(plain, [84, 26], 'tight');
    expect(ctx.type).toBe('box');
    expect(tight.type).toBe('box');
    if (ctx.type !== 'box' || tight.type !== 'box') return;
    expect(ctx.box[0][0]).toBeLessThan(tight.box[0][0]);
    expect(ctx.box[1][1]).toBeGreaterThan(tight.box[1][1]);
    expect(ctx.maxZoom).toBeLessThan(tight.maxZoom);
  });
  it('goes to a class zoom for a feature with no box', () => {
    const m = fitMove({ bbox: null, lineId: null, cls: 'area', rank: 5 }, [146, -43.5], 'tight');
    expect(m).toEqual({ type: 'point', at: [146, -43.5], zoom: 10 });
  });
  it('keeps a shape wider than 170 degrees on the globe', () => {
    const m = fitMove({ bbox: [-180, -60, 180, 60], lineId: null, cls: 'sea', rank: 0 }, [0, 0], 'tight');
    expect(m.type === 'box' && m.wide).toBe(true);
  });
  it('tests a point in a box across the antimeridian', () => {
    expect(inBox4([170, -20, 190, -10], -175, -15)).toBe(true);
    expect(inBox4([170, -20, 190, -10], 150, -15)).toBe(false);
  });
});

describe('landform centres lie inside their boxes (backlog 9.7, T5)', () => {
  it('has a box on every landform, sea and river row that draws a shape, and the row point is inside it', () => {
    const withBox = natural.filter((r) => r[9]);
    expect(withBox.length).toBeGreaterThan(1300);
    const outside = withBox.filter((r) => !inBox4(r[9]!, r[2], r[3])).map((r) => r[1]);
    expect(outside).toEqual([]);
  });
  it('puts the Ganges Plain centre inside its box', () => {
    const r = natural.find((x) => x[1] === 'Ganges Plain')!;
    expect(inBox4(r[9]!, r[2], r[3])).toBe(true);
  });
  it('gives Ganges, Danube and Nile a line file each, within the size budget (P8)', () => {
    for (const name of ['Ganges', 'Danube', 'Nile']) {
      const r = natural.find((x) => x[0] === 'river' && x[1] === name);
      expect(r, name).toBeTruthy();
      const file = path.join(WEB, 'public', 'globe', 'line', `${r![10]}.json`);
      expect(existsSync(file), file).toBe(true);
      const doc = JSON.parse(readFileSync(file, 'utf8'));
      expect(doc.kind).toBe('line');
      expect(doc.geometry.type).toBe('MultiLineString');
      expect(gzipSync(readFileSync(file)).length).toBeLessThan(6 * 1024);
    }
  });
  it('every line id in the gazetteer has a file of at most 3 KB gzip', () => {
    for (const r of natural.filter((x) => x[10])) {
      const file = path.join(WEB, 'public', 'globe', 'line', `${r[10]}.json`);
      expect(existsSync(file), String(r[10])).toBe(true);
      expect(gzipSync(readFileSync(file)).length, String(r[10])).toBeLessThan(3 * 1024);
    }
  });
});

describe('Natural features switch (backlog 9.8, Q52)', () => {
  const g = (row: unknown, name: string) => ({ row: row as never, n: norm(name) });
  const gaz = [
    g(['river', 'Rhone', 5, 45, null, 'river', 2, null, null, [4, 43, 8, 47], 'rhone'], 'Rhone'),
    g(['physical', 'Rhone Valley', 7, 46, null, 'Valley', 4, null, null, [6, 45, 8, 47], 'rhone-valley'], 'Rhone Valley'),
    g(['city', 'Rhone City', 1, 1, 'USA', 'X', 5], 'Rhone City'),
    g(['marine', 'Rhone Bay', 3, 43, null, 'bay', 5, null, null, [2, 42, 4, 44], null], 'Rhone Bay'),
  ];
  const src = { gazetteer: gaz, own: [], countriesByA3: {} };
  it('lists places, regions and cities before features, however the names match', () => {
    const names = search('rhone', src).map((h) => h.name);
    expect(names[0]).toBe('Rhone City');
    expect(names.slice(1).sort()).toEqual(['Rhone', 'Rhone Bay', 'Rhone Valley']);
  });
  it('drops rivers, landforms and seas when the switch is off', () => {
    expect(search('rhone', src, 12, { features: false }).map((h) => h.name)).toEqual(['Rhone City']);
  });
  it('carries the box and line id on a feature hit', () => {
    const hit = search('rhone', src).find((h) => h.name === 'Rhone')!;
    expect(hit.action.type === 'feature' && hit.action.fit).toEqual({ bbox: [4, 43, 8, 47], lineId: 'rhone', cls: 'river', rank: 2 });
  });
  it('writes nf=0 into a link and reads it back; on means no key', () => {
    expect(parseNatural('?c=1,2,3&nf=0')).toBe(false);
    expect(parseNatural('?c=1,2,3')).toBe(true);
    for (const c of nfQueryCases) expect(withNatural(c.url, c.on)).toBe(c.out);
  });
});

describe('card corner for a fitted feature (review M1)', () => {
  it('goes to the free corner that clears the feature box, never its middle', async () => {
    const { farCorner } = await import('@/lib/globe/anchor');
    const free = { left: 0, top: 80, right: 1056, bottom: 860 };
    // a feature filling the left and middle: the card goes to the right-hand side
    const c = farCorner({ w: 300, h: 150 }, free, { left: 100, top: 300, right: 700, bottom: 700 }, []);
    expect(c.x).toBeGreaterThan(500);
    // a corner held by a control is not chosen
    const c2 = farCorner({ w: 300, h: 150 }, free, { left: 100, top: 300, right: 700, bottom: 700 }, [{ left: 700, top: 80, right: 1056, bottom: 300 }]);
    expect(c2.y).toBeGreaterThan(300);
  });
});

describe('search with natural features off (review M3)', () => {
  it('finds a natural feature on a second pass, so the empty result can say why', () => {
    const gaz = [{ row: ['river', 'Ganges', 83, 25, null, 'river', 3, null, null, [78, 22, 90, 31], 'ganges'] as never, n: norm('Ganges') }];
    const src = { gazetteer: gaz, own: [], countriesByA3: {} };
    expect(search('Ganges', src, 12, { features: false })).toEqual([]);
    expect(search('Ganges', src, 12, { features: true })[0].action.type).toBe('feature');
  });
});
