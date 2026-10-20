import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaceListRow } from '@/components/places/rows';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { filterRows } from '@/lib/entities/filter';
import { HEAD_ROWS, SHARD_ROWS, buildShards, isPlain, manifestCounts, pageWindow, shardsForScope } from '@/lib/entities/shards';
import { defaultOrder, sortRows } from '@/lib/entities/sort';
import type { ListState } from '@/lib/entities/types';
import { decodeState, emptyState } from '@/lib/entities/url';
import { placeRows } from '../places/support';

// Backlog 3.59 and 3.56 (principles P1, P8, P9): the Places list is not inlined whole; its rows are files by country, loaded for the query.

const real = placeRows();
const ccOf = (r: PlaceListRow) => r.country;
const built = buildShards(real, d, ccOf);

const synthetic = (n: number): PlaceListRow[] =>
  Array.from({ length: n }, (_, i) => {
    const base = real[i % real.length]!;
    // 12 countries, uneven: country 0 is large enough to need several files
    const c = i % 4 === 0 ? 0 : 1 + (i % 11);
    return { ...base, id: `s${i}`, slug: `s${i}`, name: `Place ${i}`, country: `C${c}`.toUpperCase(), country_name: `Country ${String(c).padStart(2, '0')}`, image: i % 5 === 0 ? base.image : null };
  });

describe('the shards of the real list', () => {
  it('hold every row exactly once, in the default order, and no file holds the list', () => {
    const all = Object.values(built.files).flat();
    expect(all).toHaveLength(real.length);
    expect(new Set(all.map((r) => r.slug)).size).toBe(real.length);
    expect(built.manifest.shards.length).toBeGreaterThan(1);
    for (const f of Object.values(built.files)) expect(f.length).toBeLessThan(real.length);
    // the files, read in the manifest's order, are the default order of the whole list
    const flat = built.manifest.shards.flatMap((s) => built.files[s.id]!.map((r) => r.slug));
    expect(flat).toEqual(defaultOrder(real, d).map((r) => r.slug));
    expect(built.head.map((r) => r.slug)).toEqual(flat.slice(0, HEAD_ROWS));
    expect(built.head).toHaveLength(HEAD_ROWS);
  });
  it('are scoped by country: a file holds one country, and the manifest counts match the files', () => {
    for (const s of built.manifest.shards) {
      const rows = built.files[s.id]!;
      expect(rows).toHaveLength(s.n);
      expect(new Set(rows.map((r) => r.country.toLowerCase())), s.id).toEqual(new Set([s.cc]));
      expect(s.n).toBeLessThanOrEqual(SHARD_ROWS);
    }
    expect(built.manifest.total).toBe(real.length);
    expect(built.manifest.shards.reduce((a, s) => a + s.n, 0)).toBe(real.length);
  });
  it('carry the counts of the unfiltered list, so the filter bar is complete before any file loads', () => {
    expect(manifestCounts(built.manifest).country?.reduce((a, o) => a + o.count, 0)).toBe(real.length);
    expect(manifestCounts(built.manifest).kind?.length).toBeGreaterThan(0);
  });
  it('the first four cards of the default order have photos (3.56)', () => {
    expect(built.head.slice(0, 4).every((r) => r.image)).toBe(true);
  });
});

describe('the photo tie-break (3.56)', () => {
  it('puts a photo first inside a country, and countries with a photo first, and moves no row out of its country', () => {
    const rows = synthetic(400);
    const ordered = defaultOrder(rows, d);
    expect(ordered).toHaveLength(rows.length);
    // one run per country
    const runs = ordered.filter((r, i) => i === 0 || r.country !== ordered[i - 1]!.country).map((r) => r.country);
    expect(new Set(runs).size).toBe(runs.length);
    // inside a run every photo comes before every photoless row
    for (const c of runs) {
      const imgs = ordered.filter((r) => r.country === c).map((r) => r.image !== null);
      expect(imgs, c).toEqual([...imgs].sort((a, b) => Number(b) - Number(a)));
    }
    expect(ordered[0]!.image).not.toBeNull();
  });
  it('is ignored by an explicit sort, and the tie-break never hides a row', () => {
    const rows = synthetic(60);
    const byName = sortRows(rows, decodeState('sort=name'), d);
    expect(byName.map((r) => r.name)).toEqual([...rows].map((r) => r.name).sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })));
    expect(sortRows(rows, emptyState(), d)).toHaveLength(rows.length);
  });
});

describe('what a query needs', () => {
  const m = built.manifest;
  const q = (s: string): ListState => decodeState(s);
  it('knows the plain list', () => {
    expect(isPlain(q(''))).toBe(true);
    expect(isPlain(q('page=3&view=table&group=region'))).toBe(true);
    for (const s of ['q=lake', 'country=CA', 'sort=name', 'ids=a,b', 'bbox=1,2,3,4', 'kind=park']) expect(isPlain(q(s)), s).toBe(false);
  });
  it('a page of the plain list is a run of files, and the first page needs none', () => {
    expect(pageWindow(m, 1, 48).files).toEqual([]);
    const w = pageWindow(m, 4, 48);
    expect(w.offset).toBe(144);
    const rows = w.files.flatMap(({ ref, start }) => built.files[ref.id]!.slice(Math.max(0, w.offset - start), Math.min(ref.n, w.offset + w.count - start)));
    expect(rows.map((r) => r.slug)).toEqual(defaultOrder(real, d).slice(144, 144 + w.count).map((r) => r.slug));
    // only the files the page touches
    expect(w.files.length).toBeLessThan(m.shards.length);
  });
  it('a page past the end is the last page', () => {
    const w = pageWindow(m, 999, 48);
    expect(w.offset).toBe(Math.floor((m.total - 1) / 48) * 48);
    expect(w.count).toBeGreaterThan(0);
  });
  it('a query naming a country needs only its files; any other filter needs them all', () => {
    const ca = shardsForScope(m, q('country=CA'));
    expect(ca.length).toBeGreaterThan(0);
    expect(ca.every((s) => s.cc === 'ca')).toBe(true);
    expect(shardsForScope(m, q('country=CA,IT')).every((s) => ['ca', 'it'].includes(s.cc))).toBe(true);
    expect(shardsForScope(m, q('kind=park'))).toHaveLength(m.shards.length);
    expect(shardsForScope(m, q('q=lake'))).toHaveLength(m.shards.length);
  });
});

describe('the shards at 10,000 places', () => {
  it('split a large country into files of at most 300 rows, and keep the default order', () => {
    const rows = synthetic(10_000);
    const t0 = performance.now();
    const b = buildShards(rows, d, ccOf);
    const ms = performance.now() - t0;
    console.log(`buildShards over 10,000 rows: ${ms.toFixed(0)} ms, ${b.manifest.shards.length} files, head ${b.head.length} rows, manifest ${JSON.stringify(b.manifest).length} B`);
    expect(b.manifest.total).toBe(10_000);
    expect(Math.max(...b.manifest.shards.map((s) => s.n))).toBeLessThanOrEqual(SHARD_ROWS);
    expect(Math.max(...Object.values(b.files).map((f) => f.length))).toBeLessThan(10_000 / 4);
    const flat = b.manifest.shards.flatMap((s) => b.files[s.id]!.map((r) => r.slug));
    expect(flat).toEqual(defaultOrder(rows, d).map((r) => r.slug));
  });
});

// The data module: files load for the query, and the answer is the one the whole list gives.
describe('the data module over shards', () => {
  const fetched: string[] = [];
  beforeEach(() => {
    fetched.length = 0;
    vi.resetModules();
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      const id = decodeURIComponent(url.replace(/^\/list\/places\/|\/data\.json$/g, ''));
      const body = built.files[id];
      return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => null };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const fresh = async () => {
    const data = await import('@/lib/client/data');
    data.registerShardedList(d, built.head, built.manifest);
    return data;
  };

  it('answers the first page of the plain list from the page itself: no request', async () => {
    const data = await fresh();
    const got = data.peekPlaces(emptyState(), 48)!;
    expect(got.rows.map((r) => r.slug)).toEqual(built.head.map((r) => r.slug));
    expect(got.matched).toBe(real.length);
    expect(got.counts).toEqual(manifestCounts(built.manifest));
    expect((await data.listPlaces(emptyState(), 48)).rows).toHaveLength(48);
    expect(fetched).toEqual([]);
  });
  it('a later page of the plain list loads only the files it touches', async () => {
    const data = await fresh();
    const s = decodeState('page=6');
    expect(data.peekPlaces(s, 48)).toBeNull();
    const got = await data.listPlaces(s, 48);
    expect(got.rows.map((r) => r.slug)).toEqual(defaultOrder(real, d).slice(240, 288).map((r) => r.slug));
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.length).toBeLessThan(built.manifest.shards.length);
  });
  it('a country scope loads that country alone; an unscoped filter loads every file, and counts are null until they are in', async () => {
    const data = await fresh();
    const ca = decodeState('country=CA');
    expect(data.countList('place', ca)).toBeNull();
    await data.listPlaces(ca);
    expect(fetched.every((u) => /\/list\/places\/ca(-\d+)?\//.test(u))).toBe(true);
    expect(data.countList('place', ca)!.n).toBe(real.filter((r) => r.country === 'CA').length);
    const lake = decodeState('q=lake');
    expect(data.countList('place', lake)).toBeNull();
    await data.listPlaces(lake);
    expect(fetched.length).toBe(built.manifest.shards.length);
    expect(data.countList('place', lake)!.n).toBe(filterRows(real, lake, d).length);
  });
  it('the country menu keeps every country while one is chosen', async () => {
    const data = await fresh();
    const got = await data.listPlaces(decodeState('country=CA'));
    const menu = got.counts.country!;
    expect(menu.map((o) => o.value).sort()).toEqual(manifestCounts(built.manifest).country!.map((o) => o.value).sort());
    expect(menu.find((o) => o.value === 'CA')!.count).toBe(real.filter((r) => r.country === 'CA').length);
    // with another filter set, only the countries we hold are counted: never a guess
    const filtered = await data.listPlaces(decodeState('country=CA&kind=park'));
    expect(filtered.counts.country!.map((o) => o.value)).toEqual(['CA']);
  });
  it('gives the same rows, counts and order as the whole list for 20 URLs, page 1 and page 2 (parity)', async () => {
    const data = await fresh();
    const urls = [
      '', 'page=2', 'page=3&view=table', 'page=7&q=lake', 'q=lake', 'country=CA', 'country=IT&page=2', 'country=CA&region=AB', 'kind=park', 'kind=trail&season=7',
      'country=US&kind=park', 'sort=name', 'sort=-km&page=2', 'group=region', 'kid=6', 'country=CA,IT', 'q=falls&country=IS', 'tag=hiking', 'trip=none', 'view=map',
    ];
    expect(urls).toHaveLength(20);
    for (const u of urls) {
      const s = decodeState(u);
      const size = s.view === 'table' ? 100 : 48;
      const want = sortRows(filterRows(real, s, d), s, d);
      const got = await data.listPlaces(s, s.view === 'map' ? undefined : size);
      const pages = Math.max(1, Math.ceil(want.length / size));
      const page = Math.min(s.page, pages);
      const slice = (rows: PlaceListRow[], offset: number) => rows.slice((page - 1) * size - offset, page * size - offset).map((r) => r.slug);
      expect(got.matched, u).toBe(want.length);
      if (s.view === 'map') expect(got.rows.map((r) => r.slug), u).toEqual(want.map((r) => r.slug));
      else expect(slice(got.rows, got.offset), u).toEqual(slice(want, 0));
    }
  });
  it('no one file holds every row, and the files sum to the list', () => {
    const sum = Object.values(built.files).reduce((a, f) => a + f.length, 0);
    expect(sum).toBe(real.length);
    for (const [id, f] of Object.entries(built.files)) expect(f.length, id).toBeLessThan(real.length);
  });
});
