import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nearPage } from '@travel/core/schema/api/index.ts';
import { toNearCell } from '@travel/core/config/nearby.ts';
import { respond } from '@/lib/server/respond';
import { createJsonSource } from '@/lib/server/source';
import { getStore } from '@/lib/server/store';
import { createStubClient } from '@/lib/client/stub';
import { staticClient } from '@/lib/client/static';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import { HOME_PROBE, northOfHome } from '../../../core/test/privacy/probe';

// GET /api/v1/near/ (N2, store.ts A41) through respond() over the real public store: the answer's shape and order, the ETag and 304,
// the point centre's privacy (a cell only, never echoed, nothing logged, no oracle near home). The time budget is near-timing.test.ts.

const req = (query: string, headers: Record<string, string> = {}) => new Request(`http://api.test/api/v1/near/?${query}`, { headers });
const body = async (r: Response) => JSON.parse(await r.text());

/** A place with an exact point on the real data, and its cell. */
function anchor() {
  const src = createJsonSource();
  const r = src.placeRows.find((x) => !x.approx && x.lat !== null && x.country === 'CA')!;
  return { slug: r.slug, lat: r.lat!, lon: r.lon!, cell: `point:${toNearCell(r.lat!)},${toNearCell(r.lon!)}` };
}

describe('GET /api/v1/near/ on the real store', () => {
  const a = anchor();
  let logs: string[];
  beforeEach(() => {
    logs = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(' ')));
  });
  afterEach(() => vi.restoreAllMocks());

  it('a place centre answers a NearPage, nearest first, with an ETag that a 304 honours', async () => {
    const res = await respond('near', req(`near=place:${a.slug}&r=50&pageSize=20`));
    expect(res.status).toBe(200);
    const page = nearPage.parse(await body(res));
    expect(page.items[0]!.slug).toBe(a.slug);
    const kms = page.items.map((r) => r.distanceKm);
    expect(kms).toEqual([...kms].sort((x, y) => x - y));
    expect(page.items.every((r) => r.distanceKm <= 50 && r.basis === 'estimate' && r.minutes === null)).toBe(true);
    expect(page.centre).toMatchObject({ kind: 'place', key: `place:${a.slug}` });
    const etag = res.headers.get('etag')!;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get('cache-control')).toContain('public');
    expect((await respond('near', req(`near=place:${a.slug}&r=50&pageSize=20`, { 'if-none-match': etag }))).status).toBe(304);
  });

  it('a kind filter and paging keep the true total', async () => {
    const all = nearPage.parse(await body(await respond('near', req(`near=place:${a.slug}&r=100&pageSize=100`))));
    const kind = all.items.find((r) => r.slug !== a.slug)?.kind ?? all.items[0]!.kind;
    const one = nearPage.parse(await body(await respond('near', req(`near=place:${a.slug}&r=100&kind=${kind}&pageSize=100`))));
    expect(one.items.every((r) => r.kind === kind)).toBe(true);
    expect(one.total).toBe(all.items.filter((r) => r.kind === kind).length);
    const p2 = nearPage.parse(await body(await respond('near', req(`near=place:${a.slug}&r=100&pageSize=3&page=2`))));
    expect(p2.total).toBe(all.total);
    expect(p2.items.map((r) => r.slug)).toEqual(all.items.slice(3, 6).map((r) => r.slug));
    expect((await respond('near', req(`near=place:${a.slug}&pageSize=101`))).status).toBe(413);
  });

  it('a town centre measures from the gazetteer point; an unknown one is 404; no centre is 400', async () => {
    const t = nearPage.parse(await body(await respond('near', req('city=ca-ab-canmore&r=25'))));
    expect(t.centre).toMatchObject({ kind: 'town', key: 'ca-ab-canmore' });
    expect(t.items.length).toBeGreaterThan(0);
    expect((await respond('near', req('city=ca-ab-no-such-town'))).status).toBe(404);
    expect((await respond('near', req('country=CA'))).status).toBe(400);
  });

  it('a point centre is the cell only: measured from it, never echoed, and a finer point is refused without echoing it', async () => {
    const res = await respond('near', req(`near=${encodeURIComponent(a.cell)}&r=10`));
    expect(res.status).toBe(200);
    const text = await res.text();
    const page = nearPage.parse(JSON.parse(text));
    expect(page.centre).toEqual({ kind: 'point', key: 'point', name: '', lat: null, lon: null });
    expect(page.items.slice(0, 5).map((r) => r.slug)).toContain(a.slug);
    expect(text).not.toContain(a.cell);
    const fine = `point:${a.lat.toFixed(4)},${a.lon.toFixed(4)}`;
    const refused = await respond('near', req(`near=${encodeURIComponent(fine)}`));
    expect(refused.status).toBe(400);
    const refusedText = await refused.text();
    expect(refusedText).not.toContain(a.lat.toFixed(4));
    expect(refused.headers.get('cache-control')).toBe('no-store');
    expect(logs, 'near logs nothing on a served or refused request').toEqual([]);
  });

  it('no oracle near home: a cell on the household answers like any other, and nothing is logged', async () => {
    const cellOf = (p: { lat: number; lon: number }) => `point:${toNearCell(p.lat)},${toNearCell(p.lon)}`;
    const home = HOME_PROBE;
    for (const p of [home, northOfHome(1), northOfHome(30)]) {
      const res = await respond('near', req(`near=${encodeURIComponent(cellOf(p))}&r=25`));
      expect(res.status, 'a cell near home is not refused (a refusal would say where home is)').toBe(200);
      const page = nearPage.parse(await body(res));
      expect(page.centre.lat).toBeNull();
    }
    const joined = logs.join('\n');
    expect(joined).not.toContain(String(toNearCell(home.lat)));
    expect(joined).not.toContain(String(toNearCell(home.lon)));
    expect(logs).toEqual([]);
  });

  it('the route uses the process store (publicStore over JsonStore)', async () => {
    const r = await getStore().near({ near: `place:${a.slug}`, r: 5 });
    expect(r.ok).toBe(true);
  });
});

describe('DataClient.nearPage (the adapters)', () => {
  it('the ApiAdapter rounds the point to the cell before the store sees it; a place and a town centre pass through; the static files have none', async () => {
    const asked: unknown[] = [];
    const store = new StubStore();
    const spy = new Proxy(store, { get: (t, k, r) => (k === 'near' ? (q: unknown, p: unknown) => (asked.push(q), t.near(q as never, p as never)) : Reflect.get(t, k, r)) });
    const client = createStubClient(spy);
    const got = await client.nearPage({ centre: { point: { lat: 51.321734, lon: -116.186012 } }, r: 5 }, 1, 10);
    expect(asked[0]).toEqual({ near: 'point:51.32,-116.19', r: 5 });
    expect(got!.items[0]!.slug).toBe('glacier-lake');
    expect(got!.total).toBeGreaterThan(0);
    const lakes = await client.nearPage({ centre: { place: 'glacier-lake' }, r: 100, kinds: ['lake'] }, 1, 10);
    expect(asked[1]).toEqual({ near: 'place:glacier-lake', r: 100, facets: { kind: ['lake'] } });
    expect(lakes!.items.every((r) => r.kind === 'lake')).toBe(true);
    expect(await client.nearPage({ centre: { place: 'no-such-place' }, r: 5 }, 1, 10)).toBeNull();
    expect(await createStubClient(new StubStore({ layers: { near: false } })).nearPage({ centre: { place: 'glacier-lake' }, r: 5 }, 1, 10)).toBeNull();
    expect(await staticClient.nearPage({ centre: { place: 'glacier-lake' }, r: 5 }, 1, 10)).toBeNull();
  });
});
