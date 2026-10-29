import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import { planBuildAnswer, planCandidatePage, planRegions, planStarts, PLAN_LIMITS, type PlanBuildInput, type PlanCandidatesQuery } from '@travel/core/schema/api/plan.ts';
import type { DriveEstimate, DrivePoint } from '@travel/core/drive/types.ts';
import { createApiClient, fetchCalls } from '@/lib/client/api';
import { staticClient } from '@/lib/client/static';
import { decodeCandidates, handlePlan, planBuilderOn, type PlanRoute, type PlanRouteDeps } from '@/app/api/v1/plan/shared';
import { defaultDrive, createPlanService, type PlanReference } from '@/lib/server/planService';
import { getStore } from '@/lib/server/store';
import type { LegService } from '@/lib/server/legs';

// TB-API: the builder's three routes (/api/v1/plan/{regions,candidates,build}) through handlePlan, over the real public store with a fake
// reference (hub, group) and a fake leg service: no network, no key, no database. Covers the flag, the pause, validation both ways, the
// caps, the rate limit, the privacy rules (no party echoed, the start never reaching the leg service) and the DataClient adapters.

const ON = { NEXT_PUBLIC_PLAN_BUILDER: '1', NEXT_PUBLIC_TRIP_EDIT: '1' };
const NOW = new Date('2026-10-28T12:00:00.000Z');
const CALGARY = { lat: 51.0447, lon: -114.0719, cc: 'CA' };

const reference: PlanReference = {
  hub: (id) => (id === 'calgary' ? CALGARY : null),
  airport: () => null,
  starts: () => ({ hubs: [{ id: 'calgary', name: 'Calgary', cc: 'CA' }], airports: [{ iata: 'YYC', name: 'Calgary International', cc: 'CA' }] }),
  groups: (cc) => (cc === 'CA' ? [{ id: 'ca-west', name: 'Western Canada', regions: ['alberta', 'british-columbia'] }, { id: 'ca-none', name: 'Nowhere', regions: ['nowhere-land'] }] : []),
};

interface Spy {
  calls: { sources: DrivePoint[]; targets: DrivePoint[]; allowRouting: boolean }[];
}
/** A leg service whose cache holds every pair at 77 minutes (a routed cell), recording what it was asked. */
function fakeLegs(spy: Spy, routed = true): Pick<LegService, 'estimateMatrix'> {
  return {
    async estimateMatrix(sources, targets, opts) {
      spy.calls.push({ sources, targets, allowRouting: opts.allowRouting });
      const cell: DriveEstimate = { minutes: routed ? 77 : 200, km: 90, range: null, confidence: routed ? 'routed' : 'modelled', source: routed ? 'cache' : 'model', flags: [], attribution: null };
      return { cells: sources.map(() => targets.map(() => cell)), basis: routed ? 'routed' : 'estimate', reason: null, cached: 0, fresh: 0 };
    },
  };
}

function deps(over: Partial<Omit<PlanRouteDeps, 'env'>> & { env?: Record<string, string | undefined>; spy?: Spy; legs?: Pick<LegService, 'estimateMatrix'> | null } = {}): PlanRouteDeps {
  const store = getStore();
  const spy = over.spy ?? { calls: [] };
  return {
    store,
    service: createPlanService({ store, legs: over.legs === undefined ? fakeLegs(spy) : over.legs, reference, drive: defaultDrive, now: () => NOW }),
    quota: () => null,
    env: () => ({ ...ON, ...over.env }),
    now: () => NOW,
    ...(over.quota ? { quota: over.quota } : {}),
  };
}

const BASE = 'https://example.test/api/v1/plan';
const get = (route: PlanRoute, path: string, params: Record<string, string> = {}, d = deps(), init?: RequestInit) => handlePlan(route, new Request(`${BASE}${path}`, init), params, d);
const post = (body: unknown, d = deps(), headers: Record<string, string> = {}) =>
  handlePlan('build', new Request(`${BASE}/build/`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), {}, d);

const tripQuery = (extra = '') => `/candidates/?m=trip&cc=CA&rg=CA/alberta${extra}`;

async function someCandidates(n = 6): Promise<{ ref: string; slug: string }[]> {
  const res = await get('candidates', tripQuery('&pageSize=40'));
  const page = planCandidatePage.parse(await res.json());
  return page.items.filter((r) => r.lat !== null && !r.approx).slice(0, n).map((r) => ({ ref: r.ref, slug: r.slug }));
}

const party = { adults: 2, children: [9, 6], walkKm: null };
const buildBody = (picks: { ref: string }[], over: Partial<PlanBuildInput> = {}): PlanBuildInput => ({
  where: { mode: 'trip', cc: 'CA', regions: ['CA/alberta'] },
  nights: 2,
  pace: 'standard',
  moves: 'balanced',
  month: 7,
  picks: picks.map((p, i) => ({ ref: p.ref, must: i === 0 })),
  bases: [],
  edits: [],
  origin: null,
  party,
  ...over,
});

describe('the flag and the pause', () => {
  it('planBuilder needs the build flag and tripEdit', () => {
    expect(planBuilderOn({})).toBe(false);
    expect(planBuilderOn({ NEXT_PUBLIC_PLAN_BUILDER: '1' })).toBe(false);
    expect(planBuilderOn({ NEXT_PUBLIC_TRIP_EDIT: '1' })).toBe(false);
    expect(planBuilderOn(ON)).toBe(true);
  });

  it('every route is a 404 without the flag, as if it did not exist', async () => {
    for (const env of [{ NEXT_PUBLIC_PLAN_BUILDER: '0' }, { NEXT_PUBLIC_TRIP_EDIT: '0' }]) {
      const d = deps({ env });
      for (const res of [await get('regions', '/regions/CA/', { cc: 'CA' }, d), await get('candidates', tripQuery(), {}, d), await post({}, d)]) {
        expect(res.status).toBe(404);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect((await res.json()).error.code).toBe('not_found');
      }
    }
  });

  it('PLAN_BUILDER_PAUSED=1 answers 503 plan_paused', async () => {
    const res = await get('candidates', tripQuery(), {}, deps({ env: { PLAN_BUILDER_PAUSED: '1' } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('plan_paused');
  });
});

describe('GET /api/v1/plan/starts', () => {
  it('lists the public hubs and airports by name, with no point, cacheable', async () => {
    const res = await get('starts', '/starts/');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = planStarts.parse(await res.json());
    expect(body.hubs).toEqual([{ id: 'calgary', name: 'Calgary', cc: 'CA' }]);
    expect(body.airports[0]).toEqual({ iata: 'YYC', name: 'Calgary International', cc: 'CA' });
    expect(JSON.stringify(body)).not.toMatch(/lat|lon/);
  });

  it('answers empty lists while the reference files are absent, and refuses a query string and a flag that is off', async () => {
    const none = deps();
    none.service = createPlanService({ store: getStore(), legs: null, reference: { hub: () => null, airport: () => null, groups: () => [] }, drive: defaultDrive, now: () => NOW });
    expect(planStarts.parse(await (await get('starts', '/starts/', {}, none)).json())).toEqual({ hubs: [], airports: [] });
    expect((await get('starts', '/starts/?x=1')).status).toBe(400);
    expect((await get('starts', '/starts/', {}, deps({ env: { NEXT_PUBLIC_PLAN_BUILDER: '0' } }))).status).toBe(404);
  });
});

describe('GET /api/v1/plan/regions/{cc}', () => {
  it('answers the regions and groups of a country, cached by revision', async () => {
    const res = await get('regions', '/regions/CA/', { cc: 'CA' });
    expect(res.status).toBe(200);
    const etag = res.headers.get('etag')!;
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = planRegions.parse(await res.json());
    expect(body.cc).toBe('CA');
    expect(body.total).toBeGreaterThan(0);
    const west = body.groups.find((g) => g.id === 'ca-west')!;
    expect(west.regions.map((r) => r.id)).toEqual(expect.arrayContaining(['CA/alberta']));
    expect(west.count).toBe(west.regions.reduce((n, r) => n + r.count, 0));
    expect(west.offered).toBe(true);
    // a group whose regions the catalogue lacks is not listed; regions in no group are `ungrouped`
    expect(body.groups.find((g) => g.id === 'ca-none')).toBeUndefined();
    expect(body.ungrouped.every((r) => !west.regions.some((m) => m.id === r.id))).toBe(true);
    const again = await get('regions', '/regions/CA/', { cc: 'CA' }, deps(), { headers: { 'if-none-match': etag } });
    expect(again.status).toBe(304);
  });

  it('a country with no researched place is not_found; a bad code or a query key is invalid_input', async () => {
    expect((await get('regions', '/regions/ZZ/', { cc: 'ZZ' })).status).toBe(404);
    expect((await get('regions', '/regions/ca/', { cc: 'ca' })).status).toBe(400);
    expect((await get('regions', '/regions/CA/?x=1', { cc: 'CA' })).status).toBe(400);
  });
});

describe('GET /api/v1/plan/candidates', () => {
  it('trip mode: a page of at most 40 scored rows, sorted, within the gzip budget', async () => {
    const res = await get('candidates', tripQuery('&mo=7&p=family-6'));
    expect(res.status).toBe(200);
    const text = await res.text();
    const page = planCandidatePage.parse(JSON.parse(text));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.length).toBeLessThanOrEqual(PLAN_LIMITS.candidatePage.max);
    const totals = page.items.map((r) => r.score.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    expect(page.items.every((r) => r.country === 'CA')).toBe(true);
    expect(gzipSync(text).length).toBeLessThanOrEqual(PLAN_LIMITS.candidateGzipBytes);
  });

  it('a region group expands to its regions', async () => {
    const direct = planCandidatePage.parse(await (await get('candidates', '/candidates/?m=trip&cc=CA&rg=CA/alberta,CA/british-columbia&pageSize=40')).json());
    const grouped = planCandidatePage.parse(await (await get('candidates', '/candidates/?m=trip&cc=CA&rg=ca-west&pageSize=40')).json());
    expect(grouped.items.map((r) => r.ref)).toEqual(direct.items.map((r) => r.ref));
    expect(grouped.total).toBe(direct.total);
    const none = await get('candidates', '/candidates/?m=trip&cc=CA&rg=ca-unknown');
    expect(none.status).toBe(400);
  });

  it('near mode: rows within the drive limit of a public hub, and `near` around a pick', async () => {
    const res = await get('candidates', '/candidates/?m=near&from=hub:calgary&r=120');
    expect(res.status).toBe(200);
    const page = planCandidatePage.parse(await res.json());
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((r) => r.driveMin !== null && r.driveMin <= 120)).toBe(true);
    const pick = page.items[0]!;
    // the real JsonStore answers `near` (N2, store.ts A41): a strip of at most `limit` rows around the pick, never the pick itself
    const strip = await get('candidates', `/candidates/?m=near&from=hub:calgary&r=120&near=${pick.slug}&limit=6`);
    const stripBody = await strip.json();
    expect(strip.status, JSON.stringify(stripBody.error)).toBe(200);
    const stripPage = planCandidatePage.parse(stripBody);
    expect(stripPage.items.length).toBeLessThanOrEqual(6);
    expect(stripPage.items.length).toBeGreaterThan(0);
    expect(stripPage.items.some((r) => r.slug === pick.slug)).toBe(false);
  });

  it('a town start resolves to the public gazetteer point through near(city=) and answers like a hub start there (N2)', async () => {
    const town = await getStore().near({ city: 'ca-ab-calgary', r: 1 }, { page: 1, pageSize: 1 });
    expect(town.ok).toBe(true);
    const res = await get('candidates', '/candidates/?m=near&from=town:ca-ab-calgary&r=120');
    const body = await res.json();
    expect(res.status, JSON.stringify(body.error)).toBe(200);
    const page = planCandidatePage.parse(body);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((r) => r.driveMin !== null && r.driveMin <= 120)).toBe(true);
    // the start is never echoed in the answer (the detector's `from` rule)
    expect(JSON.stringify(body)).not.toContain('ca-ab-calgary');
    const unknown = await get('candidates', '/candidates/?m=near&from=town:ca-ab-no-such-town&r=120');
    expect(unknown.status).toBe(501);
  });

  it('a build with a town start and a town origin builds (N2)', async () => {
    const picks = await someCandidates(3);
    const res = await post(buildBody(picks, { where: { mode: 'near', start: { kind: 'town', id: 'ca-ab-calgary' }, driveLimitMin: 240 }, nights: 0, origin: { kind: 'town', id: 'ca-ab-calgary' } }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body.error)).toBe(200);
    expect(planBuildAnswer.safeParse(body).success).toBe(true);
  });

  it('bases given by town id resolve through near(city=), so a two-base build answers 2 bases with nights; an unknown town base is left out and never echoed (TEA)', async () => {
    // `towns({city})` lists the towns AROUND a town and leaves the town out; both bases are towns the picks' own query may not list
    for (const id of ['ca-ab-calgary', 'ca-ab-edmonton']) expect((await getStore().near({ city: id, r: 1 }, { page: 1, pageSize: 1 })).ok, id).toBe(true);
    const picks = await someCandidates(4);
    const two = [{ town: 'ca-ab-calgary', nights: 2, pinned: true }, { town: 'ca-ab-edmonton', nights: 2, pinned: true }];
    const res = await post(buildBody(picks, { nights: 4, bases: two }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body.error)).toBe(200);
    const answer = planBuildAnswer.parse(body);
    expect(answer.bases.map((x) => x.town)).toEqual(['ca-ab-calgary', 'ca-ab-edmonton']);
    expect(answer.bases.map((x) => x.nights)).toEqual([2, 2]);
    // an unknown town base is skipped: the known one is kept, the unknown id is not in the answer
    const mixed = await post(buildBody(picks, { nights: 2, bases: [{ town: 'ca-ab-no-such-town', nights: 1, pinned: true }, { town: 'ca-ab-calgary', nights: 1, pinned: true }] }));
    const mb = await mixed.json();
    expect(mixed.status, JSON.stringify(mb.error)).toBe(200);
    expect(JSON.stringify(mb)).not.toContain('no-such-town');
    expect(planBuildAnswer.parse(mb).bases.map((x) => x.town)).not.toContain('ca-ab-no-such-town');
  });

  it('a start no public file knows is not_available, never guessed', async () => {
    const res = await get('candidates', '/candidates/?m=near&from=hub:nowhere&r=120');
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('not_available');
  });

  it('validation and caps: unknown keys, a bad origin token, a page above 40, a limit above 40', async () => {
    const bad = async (q: string, status: number, code: string) => {
      const res = await get('candidates', `/candidates/?${q}`);
      expect(res.status, q).toBe(status);
      expect((await res.json()).error.code, q).toBe(code);
    };
    await bad('m=trip&cc=CA&rg=CA/alberta&zzz=1', 400, 'invalid_input');
    await bad('m=trip&cc=CA', 400, 'invalid_input');
    await bad('m=near&from=51.0,-114.0&r=120', 400, 'invalid_input');
    await bad('m=near&from=hub:calgary&r=125', 400, 'invalid_input');
    await bad('m=trip&cc=CA&rg=CA/alberta&mo=13', 400, 'invalid_input');
    await bad('m=trip&cc=CA&rg=CA/alberta&p=family-6&p=adults', 400, 'invalid_input');
    await bad('m=trip&cc=CA&rg=CA/alberta&limit=41', 400, 'invalid_input');
    await bad('m=trip&cc=CA&rg=CA/alberta&pageSize=41', 413, 'too_large');
    await bad('cc=CA', 400, 'invalid_input');
    const big = await get('candidates', '/candidates/?m=trip&cc=CA&rg=CA/alberta&pageSize=41');
    expect((await big.json()).error.details).toEqual({ max: 40 });
  });

  it('decodes the URL keys of the contract', () => {
    const d = decodeCandidates(new URL('https://x.test/c?m=near&from=iata:YYC&r=90&rg=CA/alberta&kind=lake,trail&mo=7&p=adults&list=closed&page=2&pageSize=10').searchParams);
    expect(d).toEqual({
      ok: true,
      query: { mode: 'near', start: { kind: 'airport', iata: 'YYC' }, driveLimitMin: 90, regions: ['CA/alberta'], facets: { kind: ['lake', 'trail'] }, month: 7, party: 'adults', list: 'closed', page: 2, pageSize: 10 },
    });
  });
});

describe('POST /api/v1/plan/build', () => {
  it('builds from picks the candidates named: parses with its schema, no-store, builtAt from the service clock', async () => {
    const picks = await someCandidates(6);
    expect(picks.length).toBeGreaterThanOrEqual(3);
    const res = await post(buildBody(picks));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('etag')).toBeNull();
    const text = await res.text();
    const out = planBuildAnswer.parse(JSON.parse(text));
    expect(out.builtAt).toBe(NOW.toISOString());
    expect(out.days.length).toBe(3);
    expect(out.matrix.refs.length).toBeGreaterThan(0);
    expect(gzipSync(text).length).toBeLessThanOrEqual(PLAN_LIMITS.buildGzipBytes);
    // the party never comes back
    expect(text).not.toMatch(/"(adults|children|walkKm|party)"/);
  });

  it('is deterministic for the same body', async () => {
    const picks = await someCandidates(5);
    const a = await (await post(buildBody(picks))).json();
    const b = await (await post(buildBody(picks))).json();
    expect(a).toEqual(b);
  });

  it('reads routed cells from the leg service (cache only) and falls back to estimates when it is down', async () => {
    const picks = await someCandidates(5);
    const spy: Spy = { calls: [] };
    const routed = planBuildAnswer.parse(await (await post(buildBody(picks), deps({ spy }))).json());
    expect(spy.calls.length).toBeGreaterThan(0);
    expect(spy.calls.every((c) => c.allowRouting === false)).toBe(true);
    expect(routed.basis).not.toBe('estimate');
    const throwing: Pick<LegService, 'estimateMatrix'> = { estimateMatrix: () => Promise.reject(new Error('cache down')) };
    const est = await post(buildBody(picks), deps({ legs: throwing }));
    expect(est.status).toBe(200);
    expect(planBuildAnswer.parse(await est.json()).basis).toBe('estimate');
    expect((await post(buildBody(picks), deps({ legs: null }))).status).toBe(200);
  });

  it('near mode resolves the start from a public hub and never lets it reach the leg service', async () => {
    const picks = await someCandidates(4);
    const spy: Spy = { calls: [] };
    const body = buildBody(picks, { where: { mode: 'near', start: { kind: 'hub', id: 'calgary' }, driveLimitMin: 240 }, nights: 0 });
    const res = await post(body, deps({ spy }));
    expect(res.status).toBe(200);
    const text = await res.text();
    planBuildAnswer.parse(JSON.parse(text));
    for (const c of spy.calls) for (const p of [...c.sources, ...c.targets]) expect([p.lat, p.lon]).not.toEqual([CALGARY.lat, CALGARY.lon]);
    expect(text).not.toContain(String(CALGARY.lat));
    // an unknown hub is not_available
    const unknown = await post({ ...body, where: { mode: 'near', start: { kind: 'hub', id: 'nowhere' }, driveLimitMin: 240 } });
    expect(unknown.status).toBe(501);
  });

  it('a pick the catalogue does not list is a did-not-fit, not an error', async () => {
    const picks = await someCandidates(3);
    const res = await post(buildBody([...picks, { ref: 'place/no-such-place-anywhere' }]));
    expect(res.status).toBe(200);
    const out = planBuildAnswer.parse(await res.json());
    expect(out.didNotFit.some((m) => m.ref === 'place/no-such-place-anywhere' && m.code === 'TB_UNKNOWN')).toBe(true);
  });

  it('validation names paths and codes, never a value', async () => {
    const secret = 'zz-planted-party-text';
    const res = await post({ ...buildBody([{ ref: 'place/x' }]), [secret]: 1, party: { adults: 0, children: [secret], walkKm: 7 } });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain(secret);
    const err = JSON.parse(text).error;
    expect(err.code).toBe('invalid_input');
    expect(err.details.issues.length).toBeGreaterThan(0);
    for (const i of err.details.issues) expect(Object.keys(i).sort()).toEqual(['code', 'path']);
    expect((await post('not json')).status).toBe(400);
    expect((await post(buildBody([]))).status).toBe(400); // at least one pick
    // the draft's cross-field rules: regions of another country
    const cross = await post(buildBody([{ ref: 'place/x' }], { where: { mode: 'trip', cc: 'CA', regions: ['IT/veneto'] } }));
    expect(cross.status).toBe(400);
  });

  it('result-size caps answer too_large with the cap', async () => {
    const picks = Array.from({ length: PLAN_LIMITS.picks + 1 }, (_, i) => ({ ref: `place/p-${i}` }));
    const res = await post(buildBody(picks));
    expect(res.status).toBe(413);
    expect((await res.json()).error.details).toMatchObject({ max: PLAN_LIMITS.picks });
    const bases = Array.from({ length: PLAN_LIMITS.bases + 1 }, (_, i) => ({ town: `ca-ab-t${i}`, nights: 1, pinned: true }));
    const r2 = await post(buildBody([{ ref: 'place/x' }], { bases }));
    expect(r2.status).toBe(413);
  });

  it('a body above the byte cap is too_large before it is parsed', async () => {
    const huge = JSON.stringify({ pad: 'x'.repeat(PLAN_LIMITS.buildBodyBytes + 10) });
    const res = await post(huge);
    expect(res.status).toBe(413);
    expect((await res.json()).error.details).toEqual({ max: PLAN_LIMITS.buildBodyBytes });
  });

  it('refuses a cross-site call and a non-JSON content type', async () => {
    const picks = [{ ref: 'place/x' }];
    const cross = await post(buildBody(picks), deps(), { origin: 'https://evil.example', host: 'example.test' });
    expect(cross.status).toBe(400);
    const wrong = await handlePlan('build', new Request(`${BASE}/build/`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), {}, deps());
    expect(wrong.status).toBe(400);
  });

  it('rate limits builds per client: 30 an hour, then 429 with Retry-After', async () => {
    const quota = createMemoryQuotaStore(() => NOW);
    const d = deps({ quota: () => quota, env: { AUTH_QUOTA_SECRET: 'a-test-secret-of-sufficient-length' } });
    const send = () => post({ bad: true }, d, { 'x-real-ip': '203.0.113.9' });
    for (let i = 0; i < PLAN_LIMITS.buildsPerHour; i++) expect((await send()).status).toBe(400);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = await limited.json();
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.details.retryAfterS).toBeGreaterThan(0);
    // another client has its own bucket
    expect((await post({ bad: true }, d, { 'x-real-ip': '203.0.113.10' })).status).toBe(400);
    // the rows hold hashes, never the address
    for (const r of quota.rows()) expect(r.key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('fails closed in production without a quota store', async () => {
    const res = await post({}, deps({ env: { NODE_ENV: 'production' } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('plan_paused');
  });

  it('logs no body, query or point on a failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = deps();
    broken.service = { regions: async () => { throw new Error('boom 51.0447,-114.0719'); }, starts: async () => { throw new Error('boom'); }, candidates: async () => { throw new Error('boom'); }, build: async () => { throw new Error(`boom ${JSON.stringify(party)}`); } };
    const res = await post(buildBody([{ ref: 'place/x' }]), broken);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('internal');
    expect(JSON.stringify(err.mock.calls)).not.toMatch(/boom|51\.04|adults/);
    err.mockRestore();
  });
});

describe('DataClient plan methods', () => {
  const query: PlanCandidatesQuery = { mode: 'trip', cc: 'CA', regions: ['CA/alberta'], month: 7, party: 'family-6', pageSize: 10 };

  /** The browser's fetch, answered by the route handler. */
  function serve(d: PlanRouteDeps) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(url), 'https://example.test');
      const route: PlanRoute = u.pathname.startsWith('/api/v1/plan/regions') ? 'regions' : u.pathname.startsWith('/api/v1/plan/starts') ? 'starts' : u.pathname.startsWith('/api/v1/plan/candidates') ? 'candidates' : 'build';
      const cc = /regions\/([^/]+)/.exec(u.pathname)?.[1];
      return handlePlan(route, new Request(u, init), cc ? { cc } : {}, d);
    });
  }

  it('the ApiAdapter calls the routes and returns parsed answers', async () => {
    const fetchMock = serve(deps());
    vi.stubGlobal('fetch', fetchMock);
    try {
      const client = createApiClient(fetchCalls());
      const regions = await client.planRegions('CA');
      expect(regions?.cc).toBe('CA');
      const page = await client.planCandidates(query);
      expect(page?.items.length).toBeGreaterThan(0);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('/api/v1/plan/candidates/?m=trip&cc=CA&rg=CA%2Falberta&mo=7&p=family-6&pageSize=10');
      const picks = page!.items.slice(0, 4).map((r, i) => ({ ref: r.ref, must: i === 0 }));
      const built = await client.planBuild(buildBody(picks, { picks }));
      expect(built?.days.length).toBe(3);
      const [, init] = fetchMock.mock.calls[2]!;
      expect(init?.method).toBe('POST');
      // the party travels in the body only
      expect(String(fetchMock.mock.calls[2]![0])).not.toContain('adults');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('answers null with the flag off, and rejects with the code for a refusal', async () => {
    vi.stubGlobal('fetch', serve(deps({ env: { NEXT_PUBLIC_PLAN_BUILDER: '0' } })));
    try {
      const client = createApiClient(fetchCalls());
      expect(await client.planRegions('CA')).toBeNull();
      expect(await client.planCandidates(query)).toBeNull();
      expect(await client.planBuild(buildBody([{ ref: 'place/x' }]))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    const quota = createMemoryQuotaStore(() => NOW);
    const limited = deps({ quota: () => quota, env: { AUTH_QUOTA_SECRET: 'a-test-secret-of-sufficient-length' } });
    vi.stubGlobal('fetch', serve(limited));
    try {
      const client = createApiClient(fetchCalls());
      for (let i = 0; i < PLAN_LIMITS.buildsPerHour; i++) await client.planBuild(buildBody([{ ref: 'place/x' }])).catch(() => undefined);
      const failure = await client.planBuild(buildBody([{ ref: 'place/x' }])).catch((e: unknown) => e);
      expect(failure).toMatchObject({ name: 'PlanCallError', code: 'rate_limited', status: 429 });
      expect((failure as { retryAfterS: number }).retryAfterS).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the StaticAdapter and an adapter without plan calls answer not available', async () => {
    expect(await staticClient.planRegions('CA')).toBeNull();
    expect(await staticClient.planCandidates(query)).toBeNull();
    expect(await staticClient.planBuild(buildBody([{ ref: 'place/x' }]))).toBeNull();
    const without = { ...fetchCalls(), plan: undefined };
    expect(await createApiClient(without).planRegions('CA')).toBeNull();
  });
});
