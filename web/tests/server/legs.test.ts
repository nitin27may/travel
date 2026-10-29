import { describe, expect, it, vi } from 'vitest';
import { DRIVE_CACHE, DRIVE_ROUTING } from '@travel/core/config/drive.ts';
import { aliasKey, townKey } from '@travel/core/drive/keys.ts';
import type { DriveEstimate, DrivePoint, PublicDrivePoint, VisitorDrivePoint } from '@travel/core/drive/types.ts';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import { createLegService, createMemoryLegCacheStore, runLegBatch, type Fetcher, type LegServiceDeps } from '@/lib/server/legs';

// TB-L / DT-L: the server leg service with a fake ORS (no network, no key). Layers L0 cache, L1 ORS, L2 model; privacy; guard; breaker.
const pt = (ref: string, lat: number, lon: number): PublicDrivePoint => ({ key: aliasKey(ref), lat, lon, cc: 'CA' });
const A = pt('banff-townsite', 51.1784, -115.5708);
const B = pt('lake-louise', 51.4254, -116.1773);
const C = pt('jasper-townsite', 52.8737, -118.0814);
const HOMEISH: PublicDrivePoint = pt('decoy-near-home', 10.5, -140.5); // the test-setup home point
const VISITOR: VisitorDrivePoint = { visitor: true, lat: 43.7, lon: -79.4, cc: 'CA' };

const MODEL: DriveEstimate = { minutes: 99, km: 90, range: [80, 120], confidence: 'modelled', source: 'model', flags: [], attribution: null };

function fakeOrs(opts: { fail?: 'status' | 'throw' | 'hang' | 'null' } = {}) {
  const calls: { body: { locations: number[][]; sources: number[]; destinations: number[] }; headers: Record<string, string> }[] = [];
  const fetcher: Fetcher = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ body, headers: init.headers });
    if (opts.fail === 'throw') throw new Error('socket hang up https://x?key=SECRET');
    if (opts.fail === 'hang') await new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    if (opts.fail === 'status') return { ok: false, status: 503, json: async () => ({}) };
    return {
      ok: true, status: 200,
      json: async () => ({
        durations: body.sources.map((_: number, r: number) => body.destinations.map((_d: number, c: number) => (opts.fail === 'null' ? null : 3600 + 60 * (r * 10 + c)))),
        distances: body.sources.map((_: number, r: number) => body.destinations.map((_d: number, c: number) => (opts.fail === 'null' ? null : 90_000 + 1000 * (r * 10 + c)))),
      }),
    };
  });
  return { fetcher, calls };
}

function make(over: Partial<LegServiceDeps> = {}, ors = fakeOrs()) {
  const cache = createMemoryLegCacheStore();
  const quota = createMemoryQuotaStore();
  let t = 1_000_000;
  const logs: string[] = [];
  const svc = createLegService({
    cache, quota, fetcher: ors.fetcher, model: () => MODEL, apiKey: () => 'k-test', now: () => t, log: (c) => logs.push(c), ...over,
  });
  return { svc, cache, quota, ors, logs, tick: (ms: number) => { t += ms; } };
}
const allow = { allowRouting: true } as const;

describe('LegService (TB-L)', () => {
  it('routes a miss with one ORS request, answers routed, and writes the pair under public keys', async () => {
    const { svc, cache, ors } = make();
    const r = await svc.estimateMatrix([A], [B, C], allow);
    expect(ors.calls).toHaveLength(1);
    expect(r.cells[0]![0]).toMatchObject({ confidence: 'routed', source: 'ors', minutes: 60, km: 90, range: null, attribution: DRIVE_ROUTING.attribution });
    expect(r).toMatchObject({ basis: 'routed', fresh: 2, cached: 0, reason: null });
    expect([...cache.rows.keys()].sort()).toEqual([`${A.key}|${B.key}`, `${A.key}|${C.key}`].sort());
    expect(ors.calls[0]!.headers.Authorization).toBe('k-test');
  });

  it('answers the second ask from the cache with no request (L0)', async () => {
    const { svc, ors } = make();
    await svc.estimateDrive(A, B, allow);
    const again = await svc.estimateDrive(A, B, allow);
    expect(ors.calls).toHaveLength(1);
    expect(again).toMatchObject({ confidence: 'routed', source: 'cache' });
  });

  it('asks only for the missing cells', async () => {
    const { svc, ors } = make();
    await svc.estimateDrive(A, B, allow);
    const r = await svc.estimateMatrix([A], [B, C], allow);
    expect(r).toMatchObject({ cached: 1, fresh: 1, basis: 'routed' });
    expect(ors.calls[1]!.body.locations).toHaveLength(2); // one source, one destination
  });

  it('falls back to the model with basis estimate when routing is not allowed, and reads the cache still', async () => {
    const { svc, ors } = make();
    const r = await svc.estimateMatrix([A], [B], { allowRouting: false });
    expect(ors.calls).toHaveLength(0);
    expect(r).toMatchObject({ basis: 'estimate', reason: 'not-allowed' });
    expect(r.cells[0]![0]).toMatchObject({ confidence: 'modelled', source: 'model' });
    await svc.estimateDrive(A, B, allow);
    expect((await svc.estimateDrive(A, B, { allowRouting: false })).source).toBe('cache');
  });

  it('falls back without a key and never calls ORS', async () => {
    const { svc, ors } = make({ apiKey: () => null });
    const r = await svc.estimateMatrix([A], [B], allow);
    expect(r).toMatchObject({ basis: 'estimate', reason: 'no-key' });
    expect(ors.calls).toHaveLength(0);
    expect(svc.status().keyPresent).toBe(false);
  });

  it('stops at the daily guard (80% of the cap) and answers modelled', async () => {
    const { svc, ors } = make({ dailyCap: 5, guardShare: 0.8 }); // 4 requests
    for (let i = 0; i < 4; i++) await svc.estimateDrive(A, pt(`stop-${i}`, 51.2 + i / 10, -115.6), allow);
    expect(ors.calls).toHaveLength(4);
    const r = await svc.estimateMatrix([A], [pt('stop-9', 51.9, -115.9)], allow);
    expect(ors.calls).toHaveLength(4);
    expect(r).toMatchObject({ basis: 'estimate', reason: 'quota' });
  });

  it('fails closed when the quota store is down', async () => {
    const quota = { take: async () => { throw new Error('down'); }, peek: async () => 0 };
    const { svc, ors } = make({ quota });
    expect((await svc.estimateMatrix([A], [B], allow)).reason).toBe('quota');
    expect(ors.calls).toHaveLength(0);
  });

  it('degrades on an ORS error, a throw and a timeout; no retry by default; no secret in the log', async () => {
    for (const fail of ['status', 'throw'] as const) {
      const { svc, ors, logs } = make({}, fakeOrs({ fail }));
      const r = await svc.estimateMatrix([A], [B], allow);
      expect(r).toMatchObject({ basis: 'estimate', reason: 'error' });
      expect(ors.calls).toHaveLength(1);
      expect(JSON.stringify(logs)).not.toMatch(/SECRET|k-test/);
    }
    const hang = make({ timeoutMs: 20 }, fakeOrs({ fail: 'hang' }));
    expect((await hang.svc.estimateMatrix([A], [B], allow)).reason).toBe('timeout');
  });

  it('retries only when configured', async () => {
    const { svc, ors } = make({ retries: 2 }, fakeOrs({ fail: 'status' }));
    await svc.estimateMatrix([A], [B], allow);
    expect(ors.calls).toHaveLength(3);
  });

  it('opens the breaker after the configured failures, then half-opens and closes on success', async () => {
    const ors = fakeOrs({ fail: 'status' });
    const { svc, tick } = make({ breaker: { failures: 2, openMs: 1000 } }, ors);
    await svc.estimateDrive(A, B, allow);
    await svc.estimateDrive(A, B, allow);
    expect(svc.status().breaker).toBe('open');
    const r = await svc.estimateMatrix([A], [B], allow);
    expect(r.reason).toBe('breaker');
    expect(ors.calls).toHaveLength(2);
    tick(1500);
    expect(svc.status().breaker).toBe('half-open');
  });

  it('closes again when the trial request succeeds', async () => {
    let bad = true;
    const good = fakeOrs();
    const fetcher: Fetcher = (u, i) => (bad ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) : good.fetcher(u, i));
    const { svc, tick } = make({ fetcher, breaker: { failures: 1, openMs: 1000 } });
    await svc.estimateDrive(A, B, allow);
    expect(svc.status().breaker).toBe('open');
    tick(1001);
    bad = false;
    expect((await svc.estimateDrive(A, B, allow)).confidence).toBe('routed');
    expect(svc.status().breaker).toBe('closed');
  });

  it('keeps the model for an unroutable pair and does not cache it', async () => {
    const { svc, cache } = make({}, fakeOrs({ fail: 'null' }));
    const r = await svc.estimateMatrix([A], [B], allow);
    expect(r).toMatchObject({ basis: 'estimate', reason: 'no-route' });
    expect(cache.rows.size).toBe(0);
  });

  it('refuses a matrix over the cap', async () => {
    const { svc } = make();
    const many = Array.from({ length: DRIVE_CACHE.matrixMax + 1 }, (_, i) => pt(`p-${i}`, 51 + i / 1000, -115));
    await expect(svc.estimateDriveMatrix(many, [A], allow)).rejects.toThrow(/E_LEGS_MATRIX/);
  });
});

describe('LegService privacy (DT-L)', () => {
  it('routes a visitor start from the exact point and writes no row, reads no row', async () => {
    const { svc, cache, ors } = make();
    const r = await svc.estimateMatrix([VISITOR], [A, B], allow);
    expect(r.cells[0]![0]).toMatchObject({ confidence: 'routed', source: 'ors' });
    expect(cache.rows.size).toBe(0);
    expect(ors.calls[0]!.body.locations[0]).toEqual([VISITOR.lon, VISITOR.lat]);
    const again = await svc.estimateMatrix([VISITOR], [A, B], allow);
    expect(again.cached).toBe(0);
    expect(ors.calls).toHaveLength(2);
  });

  it('with the guard tripped, a visitor start is modelled in memory and nothing is stored', async () => {
    const { svc, cache } = make({ dailyCap: 0 });
    const r = await svc.estimateMatrix([VISITOR], [A], allow);
    expect(r.cells[0]![0]!.source).toBe('model');
    expect(cache.rows.size).toBe(0);
  });

  it('never writes a pair with an end within the household radius', async () => {
    const { svc, cache } = make();
    const r = await svc.estimateMatrix([HOMEISH], [A, B], allow);
    expect(r.fresh).toBe(2); // the visitor still gets the routed answer
    expect(cache.rows.size).toBe(0);
    await svc.estimateMatrix([A], [HOMEISH], allow);
    expect(cache.rows.size).toBe(0);
  });

  it('writes only keys of the grammar, never a coordinate or a name', async () => {
    const town: PublicDrivePoint = { key: townKey(5907364), lat: 51.18, lon: -115.57, cc: 'CA' };
    const { svc, cache } = make();
    await svc.estimateMatrix([town], [A], allow);
    for (const row of cache.rows.values()) {
      expect(row.from_cell).toMatch(/^(r:|t:|g:)/);
      expect(Object.keys(row).sort()).toEqual(['engine', 'engine_version', 'flags', 'from_cell', 'metres', 'mode', 'profile', 'seconds', 'to_cell']);
    }
  });

  it('logs and returns no coordinate on failure', async () => {
    const { svc, logs } = make({}, fakeOrs({ fail: 'throw' }));
    const r = await svc.estimateMatrix([VISITOR], [A], allow);
    expect(JSON.stringify(logs)).not.toMatch(/43\.7|-79\.4|51\.17/);
    expect(JSON.stringify(r.cells)).not.toMatch(/43\.7|-79\.4/);
  });
});

describe('runLegBatch', () => {
  it('splits a large batch into matrices of at most the cap and joins the cells', async () => {
    const n = DRIVE_CACHE.matrixMax + 5;
    const src: DrivePoint[] = Array.from({ length: n }, (_, i) => pt(`s-${i}`, 45 + i / 100, -100));
    const { svc, ors } = make({ dailyCap: 100 });
    const r = await runLegBatch(svc, src, [A], allow);
    expect(r.cells).toHaveLength(n);
    expect(r.cells.every((row) => row.length === 1)).toBe(true);
    expect(ors.calls).toHaveLength(2);
    expect(r.basis).toBe('routed');
  });
});
