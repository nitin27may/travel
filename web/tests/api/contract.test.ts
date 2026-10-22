import { describe, expect, it } from 'vitest';
import { runContractTargets } from '../../../core/test/catalogue/contract/run.ts';
import { CONTRACT_TABLES } from '../../../core/test/catalogue/contract/index.ts';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { householdHits } from '../../../core/test/catalogue/contract/kit';
import { respond } from '@/lib/server/respond';
import { nearHome } from '@/lib/public/origin';
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
  pending: Object.fromEntries([...CONTRACT_TABLES.near!, ...CONTRACT_TABLES.nearbyForPlace!].map((c) => [`${c.method}:${c.id}`, PHASE_E])),
};
runContractTargets([through], { handlerLayer: true });

describe('respond() fails closed', () => {
  const poisoned = (body: unknown) => ({ revision: async () => 'a'.repeat(64), globeTree: async () => ({ ok: true, data: body, revision: 'a'.repeat(64) }) }) as never;
  it('never sends a body with the home town, and never rewrites it', async () => {
    const res = await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned({ continents: [{ name: 'Whitby' }] }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(/whitby/i);
    expect(JSON.parse(text).error.code).toBe('internal');
  });
  it('never sends a private key or a point near the home point', async () => {
    for (const body of [{ continents: [], sourceTypes: ['instagram'] }, { continents: [], added: '2026-10-16' }]) {
      expect((await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned(body))).status).toBe(500);
    }
    expect((await respond('globeTree', new Request('http://api.test/api/v1/globe/tree/'), {}, poisoned({ at: { lat: 10.5, lon: -140.5 } }))).status).toBe(500);
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
