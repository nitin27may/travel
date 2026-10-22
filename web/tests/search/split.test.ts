import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSearchIndex, buildSearchParts } from '@/lib/search/build';
import { createSearcher } from '@/lib/search/search';
import type { SearchRecord } from '@/lib/search/types';

// These tests pin the StaticAdapter (the files the build wrote); the API default has its own tests in tests/api.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');

// Backlog 2.20: the index is split by kind and country and each part loads on demand (principle P1).

const whole = buildSearchIndex();
const { manifest, parts } = buildSearchParts();
const QUERIES = ['l', 'la', 'lake', 'dolo', 'dolomites', 'banff', 'ital', 'trail', 'lago braies', 'louise', 'canada', 'dolomtes', 'utah', 'park', 'xyzqw', 'bear'];

describe('the split index', () => {
  it('has one part per kind and country, listed in the manifest with the right counts', () => {
    expect(manifest.v).toBe(1);
    expect(manifest.parts.length).toBeGreaterThan(5);
    for (const ref of manifest.parts) {
      expect(ref.id).toBe(`${ref.k}-${ref.cc}`);
      expect(parts[ref.id]).toHaveLength(ref.n);
      expect(parts[ref.id].every((r) => r.k === ref.k)).toBe(true);
    }
    expect(Object.keys(parts).sort()).toEqual(manifest.parts.map((p) => p.id).sort());
  });
  it('lists trips first, then areas, then places: the small parts load first', () => {
    const order = manifest.parts.map((p) => p.k);
    expect(order.indexOf('place')).toBeGreaterThan(order.lastIndexOf('area'));
    expect(order.indexOf('area')).toBeGreaterThan(order.lastIndexOf('trip'));
  });
  it('holds every record of the whole index exactly once', () => {
    const all = Object.values(parts).flat();
    expect(all).toHaveLength(whole.length);
    expect(new Set(all.map((r) => `${r.k}:${r.h}`)).size).toBe(all.length);
  });
  it('answers every query exactly as the whole index does (aliases and ranks included)', () => {
    const a = createSearcher(whole);
    const b = createSearcher(Object.values(parts).flat());
    for (const q of QUERIES) {
      const ra = a.search(q);
      const rb = b.search(q);
      expect(rb.counts, q).toEqual(ra.counts);
      expect(rb.groups.map((g) => g.hits.map((h) => h.record.h)), q).toEqual(ra.groups.map((g) => g.hits.map((h) => h.record.h)));
    }
  });
  it('sizes: no part is bigger than half of the whole, and the parts add up to about the whole', () => {
    const bytes = (v: unknown) => JSON.stringify(v).length;
    const total = bytes(whole);
    const sum = Object.values(parts).reduce((n, p) => n + bytes(p), 0) + bytes(manifest);
    const biggest = Math.max(...Object.values(parts).map(bytes));
    console.log(`search index: whole ${total} B, parts ${sum} B in ${manifest.parts.length} files, biggest ${biggest} B`);
    expect(biggest).toBeLessThan(total / 2);
    expect(sum).toBeLessThan(total * 1.15);
  });
});

describe('search stays fast as the catalogue grows', () => {
  it('answers a keystroke over 10,000 synthetic places in under 25 ms', () => {
    const kinds = ['lake', 'trail', 'viewpoint', 'town', 'waterfall', 'sight'];
    const syn: SearchRecord[] = Array.from({ length: 10_000 }, (_, i) => ({
      k: 'place', h: `/places/p${i}/`, n: `Place ${i.toString(36)} ${kinds[i % 6]} of the valley`, s: `${kinds[i % 6]} · Area ${i % 300}`, x: `${kinds[i % 6]} Area ${i % 300} Region ${i % 40} Country ${i % 12}`, kind: kinds[i % 6],
    }));
    const s = createSearcher([...whole, ...syn]);
    const qs = ['l', 'la', 'lak', 'lake', 'valley', 'lake valley', 'ital'];
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) for (const q of qs) s.search(q);
    const per = (performance.now() - t0) / (5 * qs.length);
    console.log(`search over ${whole.length + syn.length} records: ${per.toFixed(1)} ms a keystroke`);
    expect(per).toBeLessThan(25);
  });
});

describe('the client data module loads parts on demand', () => {
  const fetched: string[] = [];
  beforeEach(() => {
    fetched.length = 0;
    vi.resetModules();
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      const body = url === '/search/manifest.json' ? manifest : parts[decodeURIComponent(url.replace(/^\/search\/|\/data\.json$/g, ''))];
      return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => null };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a country scope fetches the manifest and that country only', async () => {
    const data = await import('@/lib/client/data');
    const records = await data.loadSearchRecords({ country: 'ca' });
    const ca = manifest.parts.filter((p) => p.cc === 'ca');
    expect(fetched.sort()).toEqual(['/search/manifest.json', ...ca.map((p) => `/search/${p.id}/data.json`)].sort());
    expect(records).toHaveLength(ca.reduce((n, p) => n + p.n, 0));
    expect(fetched.length).toBeLessThan(manifest.parts.length);
  });
  it('a kind scope fetches only that kind', async () => {
    const data = await import('@/lib/client/data');
    await data.loadSearchRecords({ kind: 'trip' });
    expect(fetched.slice(1).every((u) => u.startsWith('/search/trip-'))).toBe(true);
  });
  it('reports records as each part arrives, and loads each part once', async () => {
    const data = await import('@/lib/client/data');
    const sizes: number[] = [];
    await data.loadSearchRecords(undefined, (soFar) => sizes.push(soFar.length));
    expect(sizes).toHaveLength(manifest.parts.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(sizes.at(-1)).toBe(whole.length);
    const n = fetched.length;
    await data.loadSearchRecords();
    expect(fetched).toHaveLength(n);
  });
  it('retries a failed part on the next call', async () => {
    const data = await import('@/lib/client/data');
    const id = manifest.parts[0].id;
    const real = globalThis.fetch;
    let fail = true;
    vi.stubGlobal('fetch', async (url: string) => (fail && url.includes(id) ? { ok: false, status: 500, json: async () => null } : real(url)));
    await expect(data.loadSearchRecords()).rejects.toThrow();
    fail = false;
    await expect(data.loadSearchRecords()).resolves.toHaveLength(whole.length);
  });
  it('lists the parts of a scope from the manifest alone', async () => {
    const data = await import('@/lib/client/data');
    expect((await data.searchParts({ kind: 'place' })).every((p) => p.k === 'place')).toBe(true);
    expect(fetched).toEqual(['/search/manifest.json']);
  });
});

describe('globe features in the header search (seas, oceans and ranges)', () => {
  const s = createSearcher(Object.values(parts).flat());
  it('"alps", "atlantic" and "mediterranean" each return a globe hit', () => {
    for (const q of ['alps', 'atlantic', 'mediterranean']) {
      const hits = s.search(q).groups.find((g) => g.id === 'areas')?.hits ?? [];
      expect(hits.some((h) => h.record.h.startsWith('/globe/?c=')), q).toBe(true);
    }
    expect(s.search('alps').groups.find((g) => g.id === 'areas')!.hits[0].record.n).toBe('Alps');
  });
  it('lives in its own part, so a country scope does not load it', () => {
    expect(manifest.parts.some((p) => p.id === 'area-sea')).toBe(true);
    expect(manifest.parts.some((p) => p.id === 'area-land')).toBe(true);
    for (const id of ['area-sea', 'area-land']) expect(JSON.stringify(parts[id]).length, id).toBeLessThan(50_000);
  });
});

describe('ranking and aliases', () => {
  const s = createSearcher(Object.values(parts).flat());
  it('"rockies" finds the Rocky Mountains', () => {
    const hits = s.search('rockies').groups.flatMap((g) => g.hits);
    expect(hits.some((h) => h.record.n === 'Rocky Mountains')).toBe(true);
  });
  it('a range or sea is the first hit of its name, ahead of a plain prefix match', () => {
    const first = (q: string) => s.search(q).groups[0].hits[0].record.n;
    expect(first('alps')).toBe('Alps');
    expect(first('mediterranean')).toBe('Mediterranean Sea');
    expect(first('himalayas')).toBe('Himalayas');
  });
  it('globe hits frame the feature: zoom 4 or more, and a marker name', () => {
    for (const r of [...parts['area-land'], ...parts['area-sea']]) {
      const m = /^\/globe\/\?c=(-?[\d.]+),(-?[\d.]+),([\d.]+)&m=/.exec(r.h);
      expect(m, r.h).toBeTruthy();
      expect(Number(m![3]), r.h).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('search() loads by query, after the first keystroke', () => {
  const fetched: string[] = [];
  beforeEach(() => {
    fetched.length = 0;
    vi.resetModules();
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      const body = url === '/search/manifest.json' ? manifest : parts[decodeURIComponent(url.replace(/^\/search\/|\/data\.json$/g, ''))];
      return { ok: true, status: 200, json: async () => body };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches nothing until search is called, then the parts that can match first', async () => {
    const data = await import('@/lib/client/data');
    expect(fetched).toEqual([]);
    const r = await data.search('lago braies');
    expect(r.groups.flatMap((g) => g.hits).some((h) => h.record.n.includes('Braies'))).toBe(true);
    const first = fetched.slice(1);
    const can = manifest.parts.filter((p) => ['lag', 'bra'].every((g) => p.w!.some((w) => w.startsWith(g))));
    expect(can.length).toBeLessThan(manifest.parts.length);
    expect(first.slice(0, can.length).sort()).toEqual(can.map((p) => `/search/${p.id}/data.json`).sort());
  });
  it('says partial while the other parts load, and tells listeners when they land', async () => {
    const data = await import('@/lib/client/data');
    const grown = new Promise<void>((resolve) => data.onSearchGrow(resolve));
    const r = await data.search('zz');
    expect(r.partial).toBe(true);
    await grown;
    expect((await data.search('lago')).partial).toBe(false);
  });
  it('a country scope never loads outside it', async () => {
    const data = await import('@/lib/client/data');
    await data.search('lake', { country: 'ca' });
    expect(fetched.slice(1).every((u) => /-ca\//.test(u))).toBe(true);
  });
});

describe('suggest() in the data module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', async (url: string) => {
      const body = url === '/search/manifest.json' ? manifest : parts[decodeURIComponent(url.replace(/^\/search\/|\/data\.json$/g, ''))];
      return { ok: true, status: 200, json: async () => body };
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('turns "family trail italy" into the filtered Places link once every part is in', async () => {
    const data = await import('@/lib/client/data');
    expect((await data.search('family trail italy')).groups).toEqual([]);
    expect(await data.suggest('family trail italy')).toEqual({ label: 'Kid-friendly trails in Italy: open the filtered Places list', href: '/places/?country=IT&kind=trail&kid=yes' });
    expect(await data.suggest('xyzq')).toBeNull();
  });
});
