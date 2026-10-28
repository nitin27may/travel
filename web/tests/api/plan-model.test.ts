import { describe, expect, it, vi } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { publicStore } from '@travel/core/catalogue/public-store.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import { STUB_TRIP_RETIRED } from '@travel/core/catalogue/stub/fixture.ts';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { gazetteerOf } from '@travel/core/privacy/towns.ts';
import { tripPlanModel, tripPlanModelLookup, type TripPlanModel } from '@travel/core/schema/api/index.ts';
import { buildTripPageModel, type TripPageModel } from '@/components/trips/model';
import { createApiClient, fetchCalls } from '@/lib/client/api';
import { staticClient } from '@/lib/client/static';
import { callsFromStore, createStubClient } from '@/lib/client/stub';
import { getPlace, getTrip, listPlaces, tripSlugs } from '@/lib/public';
import { folderAliases } from '@/lib/public/aliases';
import { currentSlugOf, retiredSlugs } from '@/lib/server/moved';
import { publicTripPlanModel } from '@/lib/server/planModel';
import { respond } from '@/lib/server/respond';
import { createJsonSource } from '@/lib/server/source';
import { getStore } from '@/lib/server/store';

// STEP2-M (build-plan 3; gap-analysis D6): GET /api/v1/trips/{slug}/plan-model is the model the public trip page embeds, through
// respond() (P9), public and cached by the catalogue revision, and read by DataClient.tripPlanModel on every adapter.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');

const ROCKIES = 'canadian-rockies-2029';
const url = (slug: string, q = '') => `https://example.test/api/v1/trips/${slug}/plan-model/${q}`;
const get = (slug: string, init?: RequestInit, q = '') => respond('tripPlanModel', new Request(url(slug, q), init), { slug });

/** Exactly what web/app/trips/[slug]/page.tsx builds and hands TripPlan, as the wire carries it. */
function pageModel(slug: string): unknown {
  const trip = getTrip(slug)!;
  const lookup = (s: string) => {
    const p = getPlace(s);
    return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
  };
  return JSON.parse(JSON.stringify(buildTripPageModel(trip, lookup, trip.depth === 'overview' ? [] : listPlaces())));
}

describe('GET /api/v1/trips/{slug}/plan-model', () => {
  it('the Rockies body equals the model its public page embeds', async () => {
    const res = await get(ROCKIES);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(pageModel(ROCKIES));
    // a full trip: a timeline with every day, addables, and the route
    const m = body as TripPlanModel;
    expect(m.timeline?.days.length).toBe(getTrip(ROCKIES)!.days.length);
    expect(Object.keys(m.timeline!.addables).length).toBeGreaterThan(0);
    expect(m.days.length).toBe(m.timeline!.days.length);
  });

  it('every listed trip answers its page model, and each parses with the contract', async () => {
    const slugs = tripSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const res = await get(slug);
      expect(res.status, slug).toBe(200);
      const body = await res.json();
      expect(body, slug).toEqual(pageModel(slug));
      const parsed = tripPlanModel.safeParse(body);
      expect(parsed.success, `${slug}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it('is public data only: the privacy detector finds nothing in any body', async () => {
    const gazetteer = await gazetteerOf(getStore());
    for (const slug of tripSlugs()) {
      const body = await (await get(slug)).json();
      expect(privacyHits(body, 20, { gazetteer }), slug).toEqual([]);
    }
  });

  it('is cached by the catalogue revision, and If-None-Match answers 304', async () => {
    const res = await get(ROCKIES);
    const revision = await getStore().revision();
    expect(res.headers.get('etag')).toBe(`"${revision}"`);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=600');
    // the same ETag getTrip answers: one revision for the trip and its model
    const trip = await respond('getTrip', new Request(`https://example.test/api/v1/trips/${ROCKIES}/`), { slug: ROCKIES });
    expect(trip.headers.get('etag')).toBe(res.headers.get('etag'));
    const again = await get(ROCKIES, { headers: { 'if-none-match': res.headers.get('etag')! } });
    expect(again.status).toBe(304);
    expect(again.headers.get('etag')).toBe(res.headers.get('etag'));
  });

  it('an unknown slug is 404 and never cached; a query key is 400', async () => {
    const missing = await get('no-such-trip-zz');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('no-store');
    expect((await missing.json()).error.code).toBe('not_found');
    const stray = await get(ROCKIES, undefined, '?p=family');
    expect(stray.status).toBe(400);
    expect((await stray.json()).error.code).toBe('invalid_input');
  });

  it('a retired slug answers 308 to the current trip\'s plan model', async () => {
    // the real registry retires no trip slug today, so the StubStore's renamed trip stands in (the moved answer comes from getTrip)
    const { from, to } = STUB_TRIP_RETIRED;
    const res = await respond('tripPlanModel', new Request(url(from)), { slug: from }, new StubStore());
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`/api/v1/trips/${to}/plan-model/`);
    expect(await res.json()).toEqual({ moved: to, ref: expect.stringMatching(/^trip\//) });
    // and the real registry's retired trip slugs, when there are any
    for (const retired of retiredSlugs('trips').filter((s) => currentSlugOf(s, 'trips'))) {
      const r = await get(retired);
      expect(r.status, retired).toBe(308);
      expect(r.headers.get('location')).toBe(`/api/v1/trips/${currentSlugOf(retired, 'trips')}/plan-model/`);
    }
  });

  it('the web page model type is the contract type (a compile-time check)', () => {
    const m: TripPageModel = buildTripPageModel(getTrip(ROCKIES)!, () => null, []);
    const typed: TripPlanModel = m;
    expect(typed.days.length).toBe(m.days.length);
  });
});

describe('DataClient.tripPlanModel', () => {
  it('the ApiAdapter fetches one trip once, at the trailing-slash URL, parses it, and answers null for a 404', async () => {
    const body = publicTripPlanModel(ROCKIES);
    const fetch = vi.fn(async (u: string) => (u.includes('/no-such/') ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    try {
      const client = createApiClient(fetchCalls());
      const a = await client.tripPlanModel(ROCKIES);
      const b = await client.tripPlanModel(ROCKIES);
      expect(a).toEqual(body);
      expect(b).toBe(a);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]![0]).toBe(`/api/v1/trips/${ROCKIES}/plan-model/`);
      expect(await client.tripPlanModel('no-such')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the ApiAdapter rejects a body that breaks the contract (development and tests), and forgets the failure', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (calls++ === 0 ? new Response(JSON.stringify({ days: 'nope' }), { status: 200 }) : new Response(JSON.stringify(publicTripPlanModel(ROCKIES)), { status: 200 }))));
    try {
      const client = createApiClient(fetchCalls());
      await expect(client.tripPlanModel(ROCKIES)).rejects.toThrow();
      await expect(client.tripPlanModel(ROCKIES)).resolves.not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the StaticAdapter has no plan model', async () => {
    expect(await staticClient.tripPlanModel(ROCKIES)).toBeNull();
  });

  it('the StubAdapter answers over the StubStore and over JsonStore on the real data', async () => {
    const stub = new StubStore();
    const first = (await stub.listTrips({}, {}));
    const slug = first.ok ? first.data.items[0]!.slug : '';
    const model = await createStubClient(stub).tripPlanModel(slug);
    expect(tripPlanModelLookup.safeParse(model).success).toBe(true);
    expect(await createStubClient(stub).tripPlanModel('no-such-trip-zz')).toBeNull();
    // with the server's own builder the stub answers exactly what the endpoint does
    const json = publicStore(new JsonStore(createJsonSource()), folderAliases());
    const client = createApiClient(callsFromStore(json, true, async (_s, s) => publicTripPlanModel(s) as TripPlanModel | null));
    expect(await client.tripPlanModel(ROCKIES)).toEqual(pageModel(ROCKIES));
  });
});
