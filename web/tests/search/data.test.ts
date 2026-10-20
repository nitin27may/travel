import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSearchParts } from '@/lib/search/build';
import { parseQuery, registerList, relaxQuery, searchVocab } from '@/lib/client/data';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';
import { fixtures, loadVocab, pairs } from './support';
import { placeRows } from '../places/support';
import { parse } from '@/lib/search/parse/parse';
import { filterRows } from '@/lib/entities/filter';
import { decodeState } from '@/lib/entities/url';
import { searchRecords } from './support';

// P9 and acceptance 7: the parser is reached through lib/client/data.ts, costs one new request (vocab.json) on the first query, and sends
// nothing to a third party.

const { manifest, parts } = buildSearchParts();
const urls: string[] = [];

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    if (url === '/search/vocab.json') return Response.json(loadVocab());
    if (url === '/search/manifest.json') return Response.json(manifest);
    const m = /^\/search\/([^/]+)\/data\.json$/.exec(url);
    if (m && parts[decodeURIComponent(m[1]!)]) return Response.json(parts[decodeURIComponent(m[1]!)]);
    return new Response('nope', { status: 404 });
  });
});
afterAll(() => vi.unstubAllGlobals());

describe('parseQuery (lib/client/data.ts)', () => {
  it('answers the same as the pure parser', async () => {
    const got = await parseQuery(fixtures[0]!.query);
    expect(pairs(got.href)).toEqual(pairs(fixtures[0]!.url));
    expect(got).toEqual(parse(fixtures[0]!.query, loadVocab(), searchRecords()));
  });

  it('asks for vocab.json once, and only for our own files', async () => {
    urls.length = 0;
    await parseQuery('lakes in Iceland');
    await parseQuery('hot springs in winter');
    await searchVocab();
    expect(urls.filter((u) => u === '/search/vocab.json')).toHaveLength(0); // already held from the first call
    expect(urls.every((u) => u.startsWith('/search/'))).toBe(true);
  });

  it('the parser is its own chunk: data.ts imports it lazily, so the first load of a page does not carry it', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(new URL('../../lib/client/data.ts', import.meta.url), 'utf8');
    expect(text).not.toMatch(/^import .*search\/parse\/parse['"]/m);
    expect(text).toMatch(/import\('@\/lib\/search\/parse\/parse'\)/);
  });
});

describe('relaxQuery: the empty answer offers the chip that costs the most', () => {
  const p = (q: string) => parse(q, loadVocab(), searchRecords());

  it('names the chip and the count it would give back, and the link gives that count', async () => {
    registerList(placeDescriptor, placeRows());
    const offers = (
      await Promise.all(
        fixtures
          .filter((f) => f.target === 'places')
          .map((f) => ({ f, parsed: p(f.query) }))
          .map(async ({ f, parsed }) => ({ f, parsed, got: await relaxQuery(parsed) })),
      )
    ).filter((x) => x.got);
    expect(offers.length).toBeGreaterThan(0);
    for (const { f, parsed, got } of offers) {
      expect(got!.label, f.query).toMatch(/^Without .+: \d+ places?$/);
      const n = Number(/: (\d+) place/.exec(got!.label)![1]);
      expect(n).toBeGreaterThan(0);
      // the link really gives that many rows, and each is more than the empty answer
      const state = decodeState(got!.href.split('?')[1] ?? '');
      expect(filterRows(placeRows(), state, placeDescriptor)).toHaveLength(n);
      expect(parsed.chips.length).toBeGreaterThan(1);
    }
  });

  it('is null for a name search, an answer that is not empty, a single chip, or an unregistered list', async () => {
    registerList(placeDescriptor, placeRows());
    expect(await relaxQuery(p('Niagara Falls'))).toBeNull();
    expect(await relaxQuery(p('short walk under 3 km with a toddler'))).toBeNull(); // 15 rows
    expect(await relaxQuery(p('kayaking'))).toBeNull();
    expect(await relaxQuery(p('weekend trip with kids in October'))).toBeNull(); // no trip list registered here
    void tripDescriptor;
  });
});
