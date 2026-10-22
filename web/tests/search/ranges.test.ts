import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from '@/lib/search/parse/parse';
import { indexNames, relatedAreas, resolveRange } from '@/lib/search/parse/areas';
import { filterRows } from '@/lib/entities/filter';
import { decodeState } from '@/lib/entities/url';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { buildSearchParts } from '@/lib/search/build';
import { registerList, relaxText, relaxToResults } from '@/lib/client/data';
import { GENERIC_AREA_WORDS, RANGES } from '@/lib/search/parse/phrases';
import type { SearchRecord } from '@/lib/search/types';
import { loadVocab, searchRecords } from './support';
import { placeRows } from '../places/support';

// These tests pin the StaticAdapter (the files the build wrote); the API default has its own tests in tests/api.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');

// REVIEW4 4.20, 4.21 and 4.29: a place word resolves to every area that carries it, a range word to the places of the trips that name it,
// a leftover word never filters, and a reading that gives nothing is relaxed instead of shown as "0 places" under neat chips.

const records = searchRecords();
const vocab = loadVocab();
const rows = placeRows();
const p = (q: string, opts?: Parameters<typeof parse>[3]) => parse(q, vocab, records, opts);
const rowsFor = (q: string, opts?: Parameters<typeof parse>[3]) => filterRows(rows, decodeState(p(q, opts).href.split('?')[1] ?? ''), placeDescriptor);

const area = (path: string, name: string): SearchRecord => ({ k: 'area', h: `/globe/${path}/`, n: name, s: '', x: '' });

describe('4.20: a place word resolves to every area that carries the name', () => {
  it('Banff is also filed as Banff National Park, and the chip says what it matched', () => {
    const got = p('hikes near Banff');
    expect(got.facets.area).toEqual(['banff', 'banff-national-park']);
    expect(got.facets.region).toEqual(['alberta']);
    expect(got.chips.find((c) => c.id === 'where')!.label).toBe('Banff area, Alberta');
    expect(got.didYouMean.map((d) => d.label).join()).not.toContain('Banff National Park');
  });

  it('"easy hike with kids near Banff" gives trails (it gave 0 of 75)', () => {
    const got = p('easy hike with kids near Banff');
    expect(got.chips.some((c) => c.ask)).toBe(true);
    const found = rowsFor('easy hike with kids near Banff');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((r) => r.area === 'banff' || r.area === 'banff-national-park')).toBe(true);
  });

  it('whole words only, and a generic word never joins two areas', () => {
    const ix = indexNames([area('ca/ab/lake', 'Lake'), area('ca/ab/lake-louise', 'Lake Louise'), area('ca/ab/lake-of-bays', 'Lake of Bays'), area('ca/ab/national-park', 'National Park'), area('ca/ab/yoho-national-park', 'Yoho National Park'), area('ca/ab/banff', 'Banff'), area('ca/ab/banff-national-park', 'Banff National Park'), area('ca/ab/banffshire', 'Banffshire'), area('ca/ab/jasper', 'Jasper')]);
    const of = (n: string) => relatedAreas(ix, ix.list.find((a) => a.rec.n === n)!).map((a) => a.rec.n);
    expect(of('Lake')).toEqual([]);
    expect(of('National Park')).toEqual([]);
    expect(of('Banff')).toEqual(['Banff National Park']);
    expect(of('Banff National Park')).toEqual(['Banff']);
    expect(of('Yoho National Park')).toEqual([]);
    expect(of('Jasper')).toEqual([]);
  });

  it('in the real data, areas only join through a word that names a place', () => {
    const ix = indexNames(records);
    const generic = new Set(GENERIC_AREA_WORDS);
    for (const a of ix.list) for (const b of relatedAreas(ix, a)) {
      const shared = a.norm.split(' ').filter((w) => ` ${b.norm} `.includes(` ${w} `));
      expect(shared.some((w) => w.length > 2 && !generic.has(w)), `${a.norm} / ${b.norm}`).toBe(true);
      expect(b.path[0]).toBe(a.path[0]);
    }
  });
});

describe('range words are not vocabulary words', () => {
  it('no range word is also a type, a filler or a unit, so a range can never steal a word the grammar owns', () => {
    const known = new Set(Object.values(vocab.t).flatMap((v) => Object.values(v).flat()));
    for (const r of Object.values(RANGES)) for (const w of r.words) for (const part of [w, ...w.split(' ').filter((x) => x.length > 3)]) expect(known.has(part), part).toBe(false);
  });
});

describe('4.21: a range word is read through the places of the trips that name it', () => {
  it('"lake for a 6 year old in the Dolomites" gives lakes in South Tyrol and in Veneto (it gave 0 of 10)', () => {
    const found = rowsFor('lake for a 6 year old in the Dolomites');
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found.map((r) => r.region)).size).toBeGreaterThan(1);
    expect(found.every((r) => r.country === 'IT')).toBe(true);
    const areas = p('lake for a 6 year old in the Dolomites').facets.area!;
    expect(p('lake for a 6 year old in the Dolomites').chips.map((c) => c.label)).toContain(`Dolomites range (${areas.length} areas)`);
  });

  it('the Rockies, Alps and Patagonia are ranges too, and a gateway city is not part of one', () => {
    const ix = indexNames(records);
    expect(resolveRange(ix, 'rockies')!.paths.length).toBeGreaterThan(10);
    expect(resolveRange(ix, 'rocky mountains')!.paths).toEqual(resolveRange(ix, 'rockies')!.paths);
    expect(resolveRange(ix, 'alps')!.paths.some((x) => x.startsWith('fr/'))).toBe(true);
    expect(resolveRange(ix, 'alps')!.paths.some((x) => x.startsWith('it/'))).toBe(true);
    // Buenos Aires is where the Patagonia trip lands, not Patagonia
    expect(resolveRange(ix, 'patagonia')!.paths.some((x) => x.includes('buenos-aires') || x.includes('san-telmo'))).toBe(false);
    expect(resolveRange(ix, 'lake')).toBeNull();
    expect(resolveRange(ix, 'national')).toBeNull();
  });

  it('on Trips a range stays text, with the country when there is one', () => {
    const got = p('rockies 10 days september');
    expect(got.target).toBe('trips');
    expect(got.q).toBe('rockies');
    expect(got.facets.country).toEqual(['CA']);
    expect(got.facets.area).toBeUndefined();
  });

  it('a trip-shaped ask on the Places box is offered to Trips with one link, never filtered as text', () => {
    const got = p('rockies 10 days september', { target: 'places' });
    expect(got.q).toBe('');
    expect(got.didYouMean.map((d) => d.label)).toContain('Search trips instead');
  });

  it('a word that matches nothing is shown as not used and never filters', () => {
    const got = p('stroller friendly lake');
    expect(got.unused).toContain('friendly');
    expect(got.q).toBe('');
    expect(got.href).not.toContain('q=');
    expect(rowsFor('stroller friendly lake').length).toBe(rowsFor('stroller lake').length);
  });
});

// ---- 4.29: never an empty state under a good reading ----
const { manifest, parts } = buildSearchParts();
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/search/vocab.json') return Response.json(vocab);
    if (url === '/search/manifest.json') return Response.json(manifest);
    const m = /^\/search\/([^/]+)\/data\.json$/.exec(url);
    if (m && parts[decodeURIComponent(m[1]!)]) return Response.json(parts[decodeURIComponent(m[1]!)]);
    return new Response('nope', { status: 404 });
  });
  registerList(placeDescriptor, rows);
});
afterAll(() => vi.unstubAllGlobals());

describe('4.29: a sentence that gives nothing is relaxed, narrowest first, and says so', () => {
  it('"easy hike with kids near Banff in September" gives 0, so September goes and the rest stands', async () => {
    const full = p('easy hike with kids near Banff in September');
    expect(filterRows(rows, decodeState(full.href.split('?')[1]!), placeDescriptor)).toHaveLength(0);
    const r = await relaxToResults(full);
    expect(r).not.toBeNull();
    expect(r!.dropped.map((c) => c.id)).toEqual(['season']);
    expect(r!.n).toBeGreaterThan(0);
    expect(r!.parsed.facets.season).toBeUndefined();
    expect(r!.parsed.facets.area).toEqual(['banff', 'banff-national-park']);
    expect(relaxText(r!, 'places')).toBe(`No match for all ${r!.total}; showing places that match ${r!.total - 1}`);
    // the link gives exactly the rows it counted
    expect(filterRows(rows, decodeState(r!.parsed.href.split('?')[1]!), placeDescriptor)).toHaveLength(r!.n);
  });

  it('keeps going until rows appear, and never drops a question or the kind first', async () => {
    const r = await relaxToResults(p('via ferrata for a 12 year old in the Dolomites'));
    if (r) {
      expect(r.n + r.unchecked).toBeGreaterThan(0);
      expect(r.dropped.length).toBeGreaterThan(0);
      expect(r.dropped[0]!.id).not.toBe('k');
    }
  });

  it('is null when the reading already gives rows, or is a name', async () => {
    expect(await relaxToResults(p('lake for a 6 year old in the Dolomites'))).toBeNull();
    expect(await relaxToResults(p('Niagara Falls'))).toBeNull();
  });
});
