import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { buildShards, manifestCounts } from '@/lib/entities/shards';
import { emptyState } from '@/lib/entities/url';
import { buildSearchIndex } from '@/lib/search/build';
import { buildTextIndex, cardText, searchTexts, stem, terms } from '@/lib/search/fulltext';
import { createSearcher } from '@/lib/search/search';
import { createPublicData } from '@/lib/public';
import { placeRows } from '../places/support';

// These tests pin the StaticAdapter (the files the build wrote); the API default has its own tests in tests/api.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');

// Backlog 3.60 (SQ2s): the words the parser leaves over are looked up in the text a place card shows, instead of an empty list.
// Also the search alias of a merged duplicate page (PLC hand-back).

describe('the text index', () => {
  it('stems a plural and an -ing ending, drops stop words, ignores case and accents', () => {
    expect(terms('The Horseback Riding of Cafés and lakes')).toEqual(['horseback', 'riding', 'cafe', 'lake']);
    expect(stem('falls')).toBe('fall');
    expect(stem('glass')).toBe('glass');
  });
  it('ranks by BM25, needs half of the distinct query terms, and scores the same however the catalogue is split', () => {
    const docs = [
      { id: 'a', text: 'Quiet lake with a boat rental' },
      { id: 'b', text: 'Quiet viewpoint above the town' },
      { id: 'c', text: 'Busy town square' },
      { id: 'd', text: 'Quiet quiet quiet lake' },
    ];
    const whole = buildTextIndex(docs);
    const split = [buildTextIndex(docs.slice(0, 2)), buildTextIndex(docs.slice(2))];
    const a = searchTexts([whole], 'quiet lake boat');
    expect(a.map((h) => h.id)).toEqual(['a', 'd']);
    expect(searchTexts(split, 'quiet lake boat').map((h) => [h.id, h.score.toFixed(6)])).toEqual(a.map((h) => [h.id, h.score.toFixed(6)]));
    // one term of three is under half: nothing
    expect(searchTexts([whole], 'quiet zebra giraffe')).toEqual([]);
    expect(searchTexts([whole], 'the of')).toEqual([]);
  });
  it('stores terms as pairs, so a word such as "notes" is data and never an object key', () => {
    const ix = buildTextIndex([{ id: 'x', text: 'notes about access and links' }]);
    expect(Array.isArray(ix.terms)).toBe(true);
    expect(Object.keys(ix).sort()).toEqual(['ids', 'len', 'terms', 'v']);
  });
});

describe('a merged duplicate stays searchable (PLC hand-back)', () => {
  const searcher = createSearcher(buildSearchIndex());
  const first = (q: string) => searcher.search(q).groups.flatMap((g) => g.hits).map((h) => h.record.h);
  it('finds the page that kept the place by the name of the page that was merged into it', () => {
    expect(first('Canmore Nordic Centre provincial park')).toContain('/places/canmore-nordic-centre-summer/');
    expect(first('radium hot springs pools')).toContain('/places/radium-hot-springs/');
  });
});

describe('the list falls back to the full text when no name holds the words', () => {
  const rows = placeRows();
  const built = buildShards(rows, d, (r) => r.country);
  const cards = new Map(createPublicData().listPlaces().map((c) => [c.slug, c]));
  const text = Object.fromEntries(Object.entries(built.files).map(([id, f]) => [id, buildTextIndex(f.map((r) => ({ id: r.slug, text: cardText(cards.get(r.slug)!) })))]));
  // a word of a summary that the row's own search text does not hold
  const pick = () => {
    for (const r of rows) {
      const summary = cards.get(r.slug)?.summary ?? '';
      const hay = d.search(r).toLowerCase();
      const w = summary.toLowerCase().match(/[a-z]{7,}/g)?.find((x) => !hay.includes(x) && rows.every((o) => !d.search(o).toLowerCase().includes(x)));
      if (w) return { slug: r.slug, word: w };
    }
    return null;
  };
  const fetched: string[] = [];
  beforeEach(() => {
    fetched.length = 0;
    vi.resetModules();
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      const m = /^\/(list\/places|search\/text)\/([^/]+)\/data\.json$/.exec(url);
      const body = m ? (m[1] === 'search/text' ? text[decodeURIComponent(m[2]!)] : built.files[decodeURIComponent(m[2]!)]) : null;
      return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => null };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists the places whose description holds the word, says so, and loads the text only when the names found nothing', async () => {
    const hit = pick();
    expect(hit, 'the data has a summary word no name holds').not.toBeNull();
    const data = await import('@/lib/client/data');
    data.registerShardedList(d, built.head, built.manifest);
    const got = await data.listPlaces({ ...emptyState(), q: hit!.word });
    expect(got.rows.map((r) => r.slug)).toContain(hit!.slug);
    expect(got.notes.join(' ')).toMatch(/matched on descriptions/);
    expect(fetched.some((u) => u.startsWith('/search/text/'))).toBe(true);
    // a word a name holds never reads the text
    fetched.length = 0;
    vi.resetModules();
    const again = await import('@/lib/client/data');
    again.registerShardedList(d, built.head, built.manifest);
    await again.listPlaces({ ...emptyState(), q: rows[0]!.name.split(' ')[0]! });
    expect(fetched.some((u) => u.startsWith('/search/text/'))).toBe(false);
  });
  it('shows the plain empty answer when no description holds the words either, and when the text will not load', async () => {
    const data = await import('@/lib/client/data');
    data.registerShardedList(d, built.head, built.manifest);
    expect((await data.listPlaces({ ...emptyState(), q: 'zzqxv' })).rows).toEqual([]);
    vi.stubGlobal('fetch', async (url: string) => (url.startsWith('/search/text/') ? { ok: false, status: 500, json: async () => null } : { ok: true, status: 200, json: async () => built.files[decodeURIComponent(url.replace(/^\/list\/places\/|\/data\.json$/g, ''))] }));
    vi.resetModules();
    const broken = await import('@/lib/client/data');
    broken.registerShardedList(d, built.head, built.manifest);
    expect((await broken.listPlaces({ ...emptyState(), q: 'zzqxv' })).matched).toBe(0);
    void manifestCounts;
  });
});
