import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import { RESOLVE_MAX, resolveAnswer } from '@travel/core/schema/api/index.ts';
import { createApiClient, fetchCalls } from '@/lib/client/api';
import { RESOLVE_MAX_CLIENT } from '@/lib/client/contract';
import { staticClient } from '@/lib/client/static';
import { callsFromStore, createStubClient } from '@/lib/client/stub';
import { respond } from '@/lib/server/respond';
import { createJsonSource } from '@/lib/server/source';
import { cap, homeWord } from '../../../core/test/catalogue/contract/townGuard.cases';

// FAV-1W: DataClient.resolveRefs on each adapter, and respond()'s handling of the `asked` echo. The contract cases themselves run on
// the stores and through the handler in contract*.test.ts (core/test/catalogue/contract/resolveRefs.cases.ts).
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DataClient.resolveRefs', () => {
  it('the client cap is core RESOLVE_MAX', () => {
    expect(RESOLVE_MAX_CLIENT).toBe(RESOLVE_MAX);
  });

  it('answers one row per value in the order asked, repeats included, over the StubStore', async () => {
    const client = createStubClient();
    const refs = ['trip:stub-rockies-loop', 'place:glacier-lake', 'place:no-such-place-zz', 'trip:stub-rockies-loop'];
    const rows = await client.resolveRefs(refs);
    expect(rows!.map((r) => [r.asked, r.state])).toEqual([
      ['trip:stub-rockies-loop', 'current'],
      ['place:glacier-lake', 'current'],
      ['place:no-such-place-zz', 'unknown'],
      ['trip:stub-rockies-loop', 'current'],
    ]);
    expect(await client.resolveRefs([])).toEqual([]);
  });

  it('answers over JsonStore on the real data with light rows that parse', async () => {
    const source = createJsonSource();
    const client = createApiClient(callsFromStore(new JsonStore(source)));
    const place = source.placeRows[0]!;
    const rows = await client.resolveRefs([`place:${place.slug}`, place.ref]);
    expect(resolveAnswer.safeParse({ items: rows }).success).toBe(true);
    expect(rows!.map((r) => [r.state, r.slug, r.name])).toEqual([
      ['current', place.slug, place.name],
      ['current', place.slug, place.name],
    ]);
  });

  it('refuses more than 48 distinct values without a request, and rejects a value the store refuses', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const client = createApiClient(fetchCalls());
    await expect(client.resolveRefs(Array.from({ length: RESOLVE_MAX + 1 }, (_, i) => `place:x-${i}`))).rejects.toThrow(RangeError);
    expect(fetch).not.toHaveBeenCalled();
    // 48 distinct values asked twice each is fine: the request carries each once
    await expect(createStubClient().resolveRefs([...Array.from({ length: RESOLVE_MAX }, (_, i) => `place:x-${i}`), 'place:x-0'])).resolves.toHaveLength(RESOLVE_MAX + 1);
    await expect(createStubClient().resolveRefs(['loc:abc123'])).rejects.toThrow(/invalid_input/);
  });

  it('the static adapter has no resolve answer: null, so a list keeps its stored snapshots', async () => {
    expect(await staticClient.resolveRefs(['place:glacier-lake'])).toBeNull();
  });

  it('a store that answers not_available gives null through the StubAdapter', async () => {
    const store = new StubStore();
    store.resolveRefs = async () => ({ ok: false, error: { code: 'not_available', message: 'off' } });
    expect(await createStubClient(store).resolveRefs(['place:glacier-lake'])).toBeNull();
  });

  it('the browser asks GET /api/v1/resolve/ with each distinct value once, sorted (one cache key per set), and maps rows back in order', async () => {
    const store = new StubStore();
    const fetch = vi.fn(async (url: string) => {
      const u = new URL(url, 'http://site.test');
      const r = await store.resolveRefs({ refs: u.searchParams.getAll('ref') });
      return new Response(JSON.stringify(r.ok ? r.data : { error: r.error }), { status: r.ok ? 200 : 400 });
    });
    vi.stubGlobal('fetch', fetch);
    const client = createApiClient(fetchCalls());
    const rows = await client.resolveRefs(['trip:stub-rockies-loop', 'place:glacier-lake', 'trip:stub-rockies-loop']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('/api/v1/resolve/?ref=place%3Aglacier-lake&ref=trip%3Astub-rockies-loop');
    expect(rows!.map((r) => r.asked)).toEqual(['trip:stub-rockies-loop', 'place:glacier-lake', 'trip:stub-rockies-loop']);
  });

  it('the browser reads 501 as not available (null) and any other failure as a rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 501 })));
    expect(await createApiClient(fetchCalls()).resolveRefs(['place:a'])).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 413 })));
    await expect(createApiClient(fetchCalls()).resolveRefs(['place:a'])).rejects.toThrow(/413/);
  });
});

describe('respond() and the resolve echo (store.ts A40 applied to `asked`; the detector\'s echo key, FAV-1X)', () => {
  const REV = 'a'.repeat(64);
  const row = (asked: string, extra: Record<string, unknown> = {}) => ({ asked, state: 'unknown', space: 'place', slug: null, ref: null, name: null, kind: null, cc: null, ...extra });
  const store = (items: unknown[]) => ({ revision: async () => REV, resolveRefs: async () => ({ ok: true, data: { items }, revision: REV }) }) as never;
  const req = (...refs: string[]) => new Request(`http://api.test/api/v1/resolve/?${refs.map((r) => `ref=${encodeURIComponent(r)}`).join('&')}`);

  it('answers 200 when `asked` is the request value, even the home town as a slug', async () => {
    const res = await respond('resolveRefs', req(`place:${homeWord}`), {}, store([row(`place:${homeWord}`)]));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/^public/);
    expect(res.headers.get('etag')).toBe(`"${REV}"`);
  });

  it('fails closed when `asked` holds words the request did not send, or another field holds the words, or a private key is there', async () => {
    expect((await respond('resolveRefs', req('place:lake'), {}, store([row(`place:${homeWord}`)]))).status).toBe(500);
    expect((await respond('resolveRefs', req(`place:${homeWord}`), {}, store([row(`place:${homeWord}`, { name: cap(homeWord) })]))).status).toBe(500);
    expect((await respond('resolveRefs', req(`place:${homeWord}`), {}, store([row(`place:${homeWord}`, { slug: homeWord })]))).status).toBe(500);
    expect((await respond('resolveRefs', req('place:lake'), {}, store([row('place:lake', { favouredAt: '2026-10-26T00:00:00Z' })]))).status).toBe(500);
  });

  it('the home town as a slug or a ref is indistinguishable from any other unknown value on the real stores (status, headers, body)', async () => {
    for (const s of [new StubStore(), new JsonStore(createJsonSource())]) {
      for (const [home, other] of [
        [`place:${homeWord}`, 'place:never-was-a-place-zz'],
        [`trip:${homeWord}`, 'trip:never-was-a-trip-zz'],
        [`place/${homeWord}`, 'place/never-was-a-place-zz'],
        [`trip/${homeWord}`, 'trip/never-was-a-trip-zz'],
      ]) {
        const a = await respond('resolveRefs', req(home), {}, s);
        const b = await respond('resolveRefs', req(other), {}, s);
        expect([a.status, b.status], home).toEqual([200, 200]);
        expect(a.headers.get('cache-control')).toBe(b.headers.get('cache-control'));
        expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
        const items = async (r: Response) => ((await r.json()) as { items: Record<string, unknown>[] }).items;
        const [ia, ib] = [await items(a), await items(b)];
        expect(ia[0]!.asked).toBe(home);
        expect(ia.map((i) => ({ ...i, asked: '' }))).toEqual(ib.map((i) => ({ ...i, asked: '' })));
      }
    }
  });

  it('refuses a key other than ref, and more than 48 values, before the store is asked', async () => {
    const asked = vi.fn();
    const spy = { revision: async () => REV, resolveRefs: asked } as never;
    expect((await respond('resolveRefs', new Request('http://api.test/api/v1/resolve/?ref=place:a&q=x'), {}, spy)).status).toBe(400);
    expect((await respond('resolveRefs', req(...Array.from({ length: RESOLVE_MAX + 1 }, (_, i) => `place:x-${i}`)), {}, spy)).status).toBe(413);
    expect(asked).not.toHaveBeenCalled();
  });
});
