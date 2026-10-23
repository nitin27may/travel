import { describe, expect, it } from 'vitest';
import { runContractTargets } from '../../../core/test/catalogue/contract/run.ts';
import { CONTRACT_TABLES } from '../../../core/test/catalogue/contract/index.ts';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { householdHits } from '../../../core/test/catalogue/contract/kit';
import { respond } from '@/lib/server/respond';
import { nearHome } from '@/lib/public/origin';
import { HOME_PROBE, northOfHome } from '../../../core/test/privacy/probe';
import { echoProbes } from '../../../core/test/catalogue/contract/echo.cases';
import { cap, homeWord } from '../../../core/test/catalogue/contract/townGuard.cases';
import { publicGazetteer } from '@travel/core/privacy/towns.ts';
import { HandlerStore } from './handlerStore';
import { PHASE_E, jsonTarget } from './targets';

// The contract kit's tables through the route handlers (respond()), in process, no network (API brief step 21): the URL codec, the
// status mapping, the ETag, the 304 and the row allowlist run on every case the store runner runs.
const { target, source } = jsonTarget();
const through = {
  ...target,
  name: 'json through respond()',
  make: () => new HandlerStore(target.make() as JsonStore),
  makeChanged: () => new HandlerStore(target.makeChanged!() as JsonStore),
  rowReads: undefined,
  plant: async (p: Parameters<NonNullable<typeof target.plant>>[0]) => new HandlerStore((await target.plant!(p)) as JsonStore),
  pending: Object.fromEntries([...CONTRACT_TABLES.near!, ...CONTRACT_TABLES.nearbyForPlace!].map((c) => [`${c.method}:${c.id}`, PHASE_E])),
};
runContractTargets([through], { handlerLayer: true });

describe('respond() fails closed', () => {
  const poisoned = (body: unknown) => ({ revision: async () => 'a'.repeat(64), globeTree: async () => ({ ok: true, data: body, revision: 'a'.repeat(64) }) }) as never;
  it('never sends a body with the home town, and never rewrites it', async () => {
    const res = await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned({ continents: [{ name: cap(homeWord) }] }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text.toLowerCase()).not.toContain(homeWord);
    expect(JSON.parse(text).error.code).toBe('internal');
  });
  it('never sends a private key or a point near the home point', async () => {
    for (const body of [{ continents: [], sourceTypes: ['instagram'] }, { continents: [], added: '2026-10-16' }]) {
      expect((await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned(body))).status).toBe(500);
    }
    expect((await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned({ at: { lat: HOME_PROBE.lat, lon: HOME_PROBE.lon } }))).status).toBe(500);
  });
  it('answers an echo of the request with 200 and the same words anywhere else with 500 (K29, store.ts A40)', async () => {
    const REV = 'a'.repeat(64);
    const searching = (data: (q: string) => unknown) => ({ revision: async () => REV, search: async (q: { q: string }) => ({ ok: true, data: data(q.q), revision: REV }) }) as never;
    const result = (query: string, hit?: string) => ({ counts: { trips: 0, places: hit ? 1 : 0, areas: 0 }, groups: hit ? [{ id: 'places', label: 'Places', total: 1, hits: [{ n: hit }] }] : [], query, partial: false });
    for (const q of echoProbes()) {
      const req = () => new Request(`http://api.test/api/v1/search/?q=${encodeURIComponent(q)}`);
      expect((await respond('search', req(), {}, searching((asked) => result(asked)))).status).toBe(200);
      // the request's words in a field the request did not fill
      expect((await respond('search', req(), {}, searching((asked) => result(asked, asked)))).status).toBe(500);
      // an echo key holding words the request did not send
      const other = new Request('http://api.test/api/v1/search/?q=lake');
      expect((await respond('search', other, {}, searching(() => result(q)))).status).toBe(500);
    }
  });
  it('reads a town point near home as public only when it is the store gazetteer point (store.ts A33)', async () => {
    const REV = 'a'.repeat(64);
    const p = northOfHome(0.5);
    const town = { id: `ca-zz-${homeWord}`, name: cap(homeWord), lat: p.lat, lon: p.lon, pop: 1, cc: 'ca', region: null, places: null, distanceKm: 1, bearing: 'N' };
    const gz = publicGazetteer([town]);
    const store = (row: typeof town, withGazetteer = true) => ({ revision: async () => REV, towns: async () => ({ ok: true, data: { items: [row], truncated: false, clamped: false }, revision: REV }), ...(withGazetteer ? { publicTowns: () => gz } : {}) }) as never;
    const req = () => new Request(`http://api.test/api/v1/towns/?near=place:x`);
    expect((await respond('towns', req(), {}, store(town))).status).toBe(200);
    expect((await respond('towns', req(), {}, store({ ...town, lat: town.lat + 0.001 }))).status).toBe(500);
    expect((await respond('towns', req(), {}, store(town, false))).status).toBe(500);
  });
  it('blocks a row with a key outside the allowlist', async () => {
    const store = { revision: async () => 'a'.repeat(64), listPlaces: async () => ({ ok: true, data: { items: [{ slug: 'x', notes: 'y' }], total: 1, page: 1, pageSize: 48, nextPage: null }, revision: 'a'.repeat(64) }) } as never;
    expect((await respond('listPlaces', new Request('http://api.test/api/v1/places/'), {}, store)).status).toBe(500);
  });
});

describe('K7 home point on the real data (C6)', () => {
  it('no served point lies within 2 km of the home point, and no unlisted trip is served', async () => {
    const store = new HandlerStore(target.make() as JsonStore);
    const hits: string[] = [];
    for (const r of source.placeRows) {
      const d = source.placeDetail(r.slug)!;
      for (const p of [r, d.point, d.access?.trailhead, ...(d.access?.parking ?? [])]) if (p && p.lat !== null && p.lon !== null && nearHome(p.lat, p.lon)) hits.push(r.slug);
    }
    expect(hits).toEqual([]);
    const trips = await store.listTrips({}, { pageSize: 100 });
    if (!trips.ok) throw new Error('trips');
    for (const t of trips.data.items) {
      const d = await store.getTrip(t.slug);
      expect(d.ok && 'visibility' in d.data ? d.data.visibility : 'public', t.slug).toBe('public');
      expect(householdHits(d, t.slug)).toEqual([]);
    }
  });
});

describe('respond() request limits and headers', () => {
  const big = 'x'.repeat(5000);
  it('refuses an oversized report body before holding it, as invalid_input (GB-A-2)', async () => {
    const res = await respond('report', new Request('http://api.test/api/v1/report/', { method: 'POST', body: JSON.stringify({ page: '/places/x/', text: big }) }), {}, new JsonStore(source));
    expect(res.status).toBe(400);
    expect(JSON.parse(await res.text()).error.code).toBe('invalid_input');
  });
  it('refuses a body whose declared length is over the cap without reading it', async () => {
    const req = new Request('http://api.test/api/v1/report/', { method: 'POST', headers: { 'content-length': '99999999' }, body: '{"page":"/x/"}' });
    expect((await respond('report', req, {}, new JsonStore(source))).status).toBe(400);
  });
  it('refuses a query key on a path-only endpoint, and a report with one (GB-A-1)', async () => {
    const store = new JsonStore(source);
    expect((await respond('health', new Request('http://api.test/api/v1/health/?x=1'), {}, store)).status).toBe(400);
    expect((await respond('report', new Request('http://api.test/api/v1/report/?x=1', { method: 'POST', body: '{"page":"/x/"}' }), {}, store)).status).toBe(400);
  });
  it('keeps the query on a 308 for a moved trip and its legs (GB-A-13, store.ts A32)', async () => {
    const store = new HandlerStore(target.make() as JsonStore);
    const { from, to } = target.facts.tripRetired!;
    const moved = await store.request(`/api/v1/trips/${from}/?p=family&split=1`);
    expect(moved.status).toBe(308);
    expect(moved.headers.get('location')).toBe(`/api/v1/trips/${to}/?p=family&split=1`);
  });
  it('answers the API-3 reads with 200 and the contract shapes (parsed counts, unchecked rows, card search, trip legs)', async () => {
    const store = new HandlerStore(target.make() as JsonStore);
    const word = source.placeRows[0]!.name.split(/[^A-Za-z]+/).sort((a, b) => b.length - a.length)[0]!;
    for (const path of ['/api/v1/places/unchecked/?season=7', `/api/v1/places/cards/?q=${encodeURIComponent(word)}`, `/api/v1/trips/${target.facts.tripSlug}/legs/`, '/api/v1/places/counts/?parsed.kind=lake']) {
      const res = await store.request(path);
      expect(res.status, path).toBe(200);
      expect(JSON.parse(res.text), path).toBeTypeOf('object');
    }
  });
  it('sends an export as the JSON envelope without a content-disposition (GB-A-3)', async () => {
    const store = new JsonStore(source);
    const slug = source.placeRows[0]!.slug;
    const res = await respond('getExport', new Request(`http://api.test/api/v1/export/place/${slug}/?format=gpx`), { type: 'place', slug }, store);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toBeNull();
  });
});
