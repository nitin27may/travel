import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import { HomePointUnsetError } from '@travel/core/config/home.ts';
import { planBuildAnswer, planCandidatePage, type PlanBuildInput } from '@travel/core/schema/api/plan.ts';
import type { DriveEstimate } from '@travel/core/drive/types.ts';
import { handlePlan, routingOn, type PlanRouteDeps } from '@/app/api/v1/plan/shared';
import { createLegService, createMemoryLegCacheStore, type Fetcher } from '@/lib/server/legs';
import { createPlanService, defaultDrive, type PlanReference } from '@/lib/server/planService';
import { getStore } from '@/lib/server/store';

// PLAN_ROUTING (per-request switch for builds) and the home-point-unset signal, over the real leg service with a fake ORS, a memory cache and a
// memory quota: no network, no key, no database.

const NOW = new Date('2026-10-28T12:00:00.000Z');
const ON = { NEXT_PUBLIC_PLAN_BUILDER: '1', NEXT_PUBLIC_TRIP_EDIT: '1' };
const reference: PlanReference = { hub: (id) => (id === 'calgary' ? { lat: 51.0447, lon: -114.0719, cc: 'CA' } : null), airport: () => null, starts: () => ({ hubs: [], airports: [] }), groups: () => [] };
const MODEL: DriveEstimate = { minutes: 99, km: 90, range: [80, 120], confidence: 'modelled', source: 'model', flags: [], attribution: null };

function fakeOrs(fail = false) {
  const calls: { n: number; locations: number[][] }[] = [];
  const fetcher: Fetcher = vi.fn(async (_u, init) => {
    const body = JSON.parse(init.body) as { sources: number[]; destinations: number[]; locations: number[][] };
    calls.push({ n: body.sources.length * body.destinations.length, locations: body.locations });
    if (fail) return { ok: false, status: 503, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        durations: body.sources.map((_, r) => body.destinations.map((_d, c) => 3600 + 60 * (r + c))),
        distances: body.sources.map((_, r) => body.destinations.map((_d, c) => 90_000 + 1000 * (r + c))),
      }),
    };
  });
  return { fetcher, calls };
}

function rig(opts: { allowRouting: boolean; fail?: boolean; dailyCap?: number; writeKey?: Parameters<typeof createLegService>[0]['writeKey']; logs?: string[] }) {
  const ors = fakeOrs(opts.fail);
  const cache = createMemoryLegCacheStore();
  const legs = createLegService({
    cache, quota: createMemoryQuotaStore(), fetcher: ors.fetcher, model: () => MODEL, apiKey: () => 'k-test', retries: 0,
    ...(opts.dailyCap !== undefined ? { dailyCap: opts.dailyCap } : {}),
    ...(opts.writeKey ? { writeKey: opts.writeKey } : {}),
    log: (c) => opts.logs?.push(c),
  });
  const store = getStore();
  const service = createPlanService({ store, legs, reference, drive: defaultDrive, now: () => NOW, allowRouting: opts.allowRouting });
  const deps: PlanRouteDeps = { store, service, quota: () => null, env: () => ON, now: () => NOW };
  return { ors, cache, legs, deps };
}

const BASE = 'https://example.test/api/v1/plan';
async function picks(deps: PlanRouteDeps) {
  const res = await handlePlan('candidates', new Request(`${BASE}/candidates/?m=trip&cc=CA&rg=CA/alberta&pageSize=40`), {}, deps);
  return planCandidatePage.parse(await res.json()).items.filter((r) => r.lat !== null && !r.approx).slice(0, 5).map((r, i) => ({ ref: r.ref, must: i === 0 }));
}
async function build(deps: PlanRouteDeps) {
  const body: PlanBuildInput = {
    where: { mode: 'trip', cc: 'CA', regions: ['CA/alberta'] }, nights: 2, pace: 'standard', moves: 'balanced', month: 7,
    picks: await picks(deps), bases: [], edits: [], origin: null, party: { adults: 2, children: [9, 6], walkKm: null },
  };
  const res = await handlePlan('build', new Request(`${BASE}/build/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {}, deps);
  expect(res.status).toBe(200);
  const text = await res.text();
  return { answer: planBuildAnswer.parse(JSON.parse(text)), text };
}

afterEach(() => vi.restoreAllMocks());

describe('PLAN_ROUTING', () => {
  it('is on only when set to one, read from the env passed in', () => {
    expect(routingOn({ PLAN_ROUTING: '1' })).toBe(true);
    for (const v of [undefined, '', '0', 'true', 'yes', ' 1']) expect(routingOn({ PLAN_ROUTING: v })).toBe(false);
  });

  it('off: a build makes no ORS call and writes nothing; every uncached cell is an estimate', async () => {
    const { ors, cache, deps } = rig({ allowRouting: false });
    const { answer } = await build(deps);
    expect(ors.fetcher).not.toHaveBeenCalled();
    expect(cache.rows.size).toBe(0);
    const n = answer.matrix.refs.length;
    expect(answer.matrix.estimated.length).toBe(n * n - n);
  });

  it('on: missing cells go to ORS once, the rows are written as server rows, the answer keeps its shape', async () => {
    const off = await build(rig({ allowRouting: false }).deps);
    const { ors, cache, deps } = rig({ allowRouting: true });
    const { answer, text } = await build(deps);
    expect(ors.calls.length).toBeGreaterThan(0);
    expect(ors.calls.length).toBeLessThanOrEqual(2);
    expect(cache.rows.size).toBeGreaterThan(0);
    for (const row of cache.rows.values()) expect(row).toMatchObject({ engine: 'ors', mode: 'drive' });
    expect(answer.matrix.estimated.length).toBeLessThan(off.answer.matrix.estimated.length);
    expect(Object.keys(answer).sort()).toEqual(Object.keys(off.answer).sort());
    expect(Object.keys(answer.matrix).sort()).toEqual(Object.keys(off.answer.matrix).sort());
    expect(text).not.toMatch(/"(adults|children|walkKm|party)"/);
  });

  it('on, a second build reads the cache and calls ORS no more', async () => {
    const { ors, deps } = rig({ allowRouting: true });
    await build(deps);
    const first = ors.calls.length;
    await build(deps);
    expect(ors.calls.length).toBe(first);
  });

  it('on, quota exhausted: no ORS call, the build still answers with estimates', async () => {
    const { ors, deps } = rig({ allowRouting: true, dailyCap: 0 });
    const { answer } = await build(deps);
    expect(ors.fetcher).not.toHaveBeenCalled();
    const n = answer.matrix.refs.length;
    expect(answer.matrix.estimated.length).toBe(n * n - n);
  });

  it('on, ORS failing: falls back to the model, nothing written', async () => {
    const { cache, deps } = rig({ allowRouting: true, fail: true });
    const { answer } = await build(deps);
    expect(cache.rows.size).toBe(0);
    expect(answer.matrix.estimated.length).toBeGreaterThan(0);
  });

  it('the visitor start never reaches ORS or the cache in near mode', async () => {
    const { ors, deps } = rig({ allowRouting: true });
    const base = await picks(deps);
    const body = {
      where: { mode: 'near', start: { kind: 'hub', id: 'calgary' }, driveLimitMin: 240 }, nights: 0, pace: 'standard', moves: 'balanced', month: 7,
      picks: base, bases: [], edits: [], origin: null, party: { adults: 2, children: [], walkKm: null },
    };
    const res = await handlePlan('build', new Request(`${BASE}/build/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {}, deps);
    expect(res.status).toBe(200);
    const sent = ors.calls.flatMap((c) => c.locations);
    expect(sent.some(([lon, lat]) => Math.abs(lat! - 51.0447) < 0.001 && Math.abs(lon! + 114.0719) < 0.001)).toBe(false);
    expect(JSON.stringify(planBuildAnswer.parse(await res.json()))).not.toContain('51.0447');
  });
});

describe('the default deps read PLAN_ROUTING per request', () => {
  it('passes allowRouting to the plan service from the env at call time', async () => {
    vi.resetModules();
    const seen: (boolean | undefined)[] = [];
    vi.doMock('@/lib/server/planService', async (orig) => {
      const mod = await orig<typeof import('@/lib/server/planService')>();
      return { ...mod, createPlanService: (d: Parameters<typeof mod.createPlanService>[0]) => { seen.push(d.allowRouting); return mod.createPlanService(d); } };
    });
    const { defaultDeps } = await import('@/app/api/v1/plan/shared');
    vi.stubEnv('PLAN_ROUTING', '');
    defaultDeps();
    vi.stubEnv('PLAN_ROUTING', '1');
    defaultDeps();
    vi.stubEnv('PLAN_ROUTING', '0');
    defaultDeps();
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/server/planService');
    expect(seen).toEqual([false, true, false]);
  });
});

describe('home point unset', () => {
  const unset = () => { throw new HomePointUnsetError('test'); };

  it('logs one fixed code, reports it in status(), and the build still answers with estimates', async () => {
    const logs: string[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ors, cache, legs, deps } = rig({ allowRouting: true, writeKey: unset, logs });
    expect(legs.status().homePoint).toBe('unknown');
    const { answer } = await build(deps);
    await build(deps);
    expect(logs.filter((c) => c === 'home-point-unset')).toEqual(['home-point-unset']);
    expect(legs.status()).toMatchObject({ homePoint: 'unset' });
    expect(ors.fetcher).not.toHaveBeenCalled();
    expect(cache.rows.size).toBe(0);
    const n = answer.matrix.refs.length;
    expect(answer.matrix.estimated.length).toBe(n * n - n);
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/-?\d+\.\d{3}/));
  });

  it('the default logger prints the code only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const legs = createLegService({ cache: createMemoryLegCacheStore(), quota: null, fetcher: fakeOrs().fetcher, model: () => MODEL, apiKey: () => 'k-secret', writeKey: unset });
    const p = (k: string, lat: number) => ({ key: k, lat, lon: -115, cc: 'CA' }) as never;
    await legs.estimateMatrix([p('r:a-place', 51)], [p('r:b-place', 52)], { allowRouting: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[legs] home-point-unset');
  });
});
