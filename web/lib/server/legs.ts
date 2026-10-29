import 'server-only';

// THE SERVER LEG SERVICE (TB-L with DT-L; driving-time-model.md 4.1, 5.6 and 6.1; the `Routing` interface of SRC). The only runtime code
// that calls OpenRouteService. Layers, in order, for each cell of a matrix:
//   L0  a `leg_cache` row younger than DRIVE_CACHE.maxAgeDays of the one engine in use;
//   L1  one ORS matrix request for the misses, when routing is allowed, the key is set, the daily guard has room and the breaker is closed;
//   L2  `modelDrive` (core/src/drive/model.ts) whenever any of that is not so, marked `modelled` with the reason in `basis`.
// Every failure degrades to L2 at once: this service never throws for a routing reason, only for a caller error (a matrix over the cap).
//
// PRIVACY (spec 5.6, Q-DT4): the visitor's start is a VisitorDrivePoint. It is sent to ORS inside one request as a coordinate and then
// dropped: it has no key, so it is never read from or written to `leg_cache`; no log line holds a coordinate, a key or a name (fixed codes
// only). Cache writes go through `writableLegKey`, which refuses an end within HOME_RADIUS_KM of home (fail closed when the home point is
// unset). Responses are DriveEstimates and a basis code: no point, no household datum.
//
// Config: core/src/config/drive.ts DRIVE_ROUTING (cap, guard, timeout, retries, breaker). Env: ORS_API_KEY (README env table). Neon:
// the table grants of migration 0014 (HELD for the owner).
import { getPool } from '@travel/core/db/client.ts';
import type { PgLike } from '@travel/core/db/client.ts';
import { APP_ROLE } from '@travel/core/db/tx.ts';
import { DRIVE_CACHE, DRIVE_ROUTING } from '@travel/core/config/drive.ts';
import { createModel } from '@travel/core/drive/model.ts';
import { indexDriveData } from '@travel/core/drive/model.ts';
import { loadDriveData } from '@travel/core/drive/load.ts';
import { writableLegKey } from '@travel/core/drive/keys.ts';
import type {
  CacheKey, DriveEstimate, DriveEstimator, DrivePoint, EstimateOptions, LegCacheRow, ModelOptions, ModelPoint, PublicDrivePoint,
} from '@travel/core/drive/types.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';
import { travelRoot } from '@/lib/data/root';

/** Why a cell is not routed (`basis.reason`); fixed codes, safe to log. */
export type LegReason = 'not-allowed' | 'no-key' | 'quota' | 'breaker' | 'timeout' | 'error' | 'no-route';

/** The estimate basis of one matrix answer: `routed` all cells routed or cached, `mixed`, or `estimate` (every cell from the model). */
export interface LegBasis {
  basis: 'routed' | 'mixed' | 'estimate';
  /** the first reason a cell fell back to the model, when any did */
  reason: LegReason | null;
  /** cells answered from `leg_cache` and from a fresh ORS request, for the caller's budget and the tests */
  cached: number;
  fresh: number;
}

export interface LegMatrixResult extends LegBasis {
  cells: DriveEstimate[][];
}

/** SRC's `Routing`: the leg service contract. */
export interface LegService extends DriveEstimator {
  /** Same as estimateDriveMatrix, with the basis flag the builder shows ("Estimated" sheet, P6). */
  estimateMatrix(sources: DrivePoint[], targets: DrivePoint[], opts: EstimateOptions): Promise<LegMatrixResult>;
  /** Breaker and key state only; no datum of any trip or person. */
  status(): { breaker: 'closed' | 'open' | 'half-open'; keyPresent: boolean };
}

// ----- the cache store ----------------------------------------------------------------------------------------------------------------

export interface CachedLeg { seconds: number; metres: number; flags: string[] }
export interface LegCacheStore {
  /** Fresh rows (younger than maxAgeDays, same engine) for the given key pairs, by `from|to`. */
  read(pairs: ReadonlyArray<{ from: CacheKey; to: CacheKey }>): Promise<Map<string, CachedLeg>>;
  write(rows: readonly LegCacheRow[]): Promise<void>;
}
export const pairId = (from: string, to: string): string => `${from}|${to}`;

/** The Postgres store: the app role, one short transaction per call, the grants and policies of migration 0014. */
export function createPgLegCacheStore(url?: string): LegCacheStore {
  const run = async <T>(fn: (c: Awaited<ReturnType<PgLike['connect']>>) => Promise<T>): Promise<T> => {
    const pool = await getPool(url);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local role "${APP_ROLE}"`);
      await client.query("set local statement_timeout = '3s'");
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  return {
    async read(pairs) {
      const out = new Map<string, CachedLeg>();
      if (pairs.length === 0) return out;
      await run(async (c) => {
        const { rows } = await c.query<{ from_cell: string; to_cell: string; seconds: number; metres: number; flags: string[] }>(
          `select l.from_cell, l.to_cell, l.seconds, l.metres, l.flags from leg_cache l
             join unnest($1::text[], $2::text[]) as p(f, t) on l.from_cell = p.f and l.to_cell = p.t
            where l.mode = 'drive' and l.profile = $3 and l.engine = $4 and l.computed_at > now() - make_interval(days => $5::int)`,
          [pairs.map((p) => p.from), pairs.map((p) => p.to), DRIVE_ROUTING.profile, DRIVE_ROUTING.engine, DRIVE_CACHE.maxAgeDays],
        );
        for (const r of rows) out.set(pairId(r.from_cell, r.to_cell), { seconds: Number(r.seconds), metres: Number(r.metres), flags: r.flags ?? [] });
        // prune-by-last_used input; best effort inside the same short transaction
        await c.query(
          `update leg_cache l set hits = hits + 1, last_used = now()
             from unnest($1::text[], $2::text[]) as p(f, t) where l.from_cell = p.f and l.to_cell = p.t and l.mode = 'drive'`,
          [pairs.map((p) => p.from), pairs.map((p) => p.to)],
        );
      });
      return out;
    },
    async write(rows) {
      if (rows.length === 0) return;
      await run(async (c) => {
        await c.query(
          `insert into leg_cache (from_cell, to_cell, mode, profile, engine, engine_version, seconds, metres, flags, provider, computed_at, last_used)
             select r.f, r.t, 'drive', $3, $4, $5, r.s, r.m, '{}', $4, now(), now()
               from unnest($1::text[], $2::text[], $6::int[], $7::int[]) as r(f, t, s, m)
             on conflict (from_cell, to_cell, mode) do update
               set seconds = excluded.seconds, metres = excluded.metres, engine = excluded.engine, engine_version = excluded.engine_version,
                   provider = excluded.provider, profile = excluded.profile, computed_at = now(), last_used = now()`,
          [rows.map((r) => r.from_cell), rows.map((r) => r.to_cell), DRIVE_ROUTING.profile, DRIVE_ROUTING.engine, rows[0]!.engine_version,
            rows.map((r) => r.seconds), rows.map((r) => r.metres)],
        );
      });
    },
  };
}

/** An in-memory store for tests and for a server with no database. */
export function createMemoryLegCacheStore(): LegCacheStore & { rows: Map<string, LegCacheRow> } {
  const rows = new Map<string, LegCacheRow>();
  return {
    rows,
    async read(pairs) {
      const out = new Map<string, CachedLeg>();
      for (const p of pairs) {
        const r = rows.get(pairId(p.from, p.to));
        if (r) out.set(pairId(p.from, p.to), { seconds: r.seconds, metres: r.metres, flags: r.flags });
      }
      return out;
    },
    async write(list) {
      for (const r of list) rows.set(pairId(r.from_cell, r.to_cell), r);
    },
  };
}

// ----- the ORS client -----------------------------------------------------------------------------------------------------------------

export type Fetcher = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean; status: number; json(): Promise<unknown>;
}>;

interface OrsMatrix { durations: (number | null)[][]; distances: (number | null)[][] }

class OrsFailure extends Error {
  constructor(readonly reason: 'timeout' | 'error') { super(`ors ${reason}`); }
}

/** One ORS matrix request. Returns durations (s) and distances (m); a null is an unroutable pair. Throws OrsFailure with a fixed reason. */
async function orsMatrix(
  fetcher: Fetcher, key: string, locations: [number, number][], sources: number[], destinations: number[], timeoutMs: number,
): Promise<OrsMatrix> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetcher(`${DRIVE_ROUTING.baseUrl}/${DRIVE_ROUTING.profile}`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': DRIVE_ROUTING.userAgent },
      body: JSON.stringify({ locations, sources, destinations, metrics: ['duration', 'distance'], units: 'm' }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new OrsFailure('error');
    const j = (await res.json()) as Partial<OrsMatrix> | null;
    if (!j || !Array.isArray(j.durations) || !Array.isArray(j.distances)) throw new OrsFailure('error');
    return { durations: j.durations, distances: j.distances };
  } catch (e) {
    if (e instanceof OrsFailure) throw e;
    throw new OrsFailure(ctl.signal.aborted ? 'timeout' : 'error'); // the thrown error may hold a URL or body: only the code leaves
  } finally {
    clearTimeout(timer);
  }
}

// ----- the service --------------------------------------------------------------------------------------------------------------------

export interface LegServiceDeps {
  cache: LegCacheStore;
  quota: QuotaStore | null;
  fetcher: Fetcher;
  /** L2, synchronous */
  model: (a: ModelPoint, b: ModelPoint, opts?: ModelOptions) => DriveEstimate;
  /** the key; read per call so a rotated key needs no restart. null: unset */
  apiKey: () => string | null;
  now?: () => number;
  /** overrides of DRIVE_ROUTING (tests) */
  dailyCap?: number;
  guardShare?: number;
  timeoutMs?: number;
  retries?: number;
  breaker?: { failures: number; openMs: number };
  log?: (code: string) => void;
}

const isPublic = (p: DrivePoint): p is PublicDrivePoint => (p as { visitor?: unknown }).visitor === undefined && typeof (p as { key?: unknown }).key === 'string';
const toModel = (p: DrivePoint): ModelPoint => p as ModelPoint;

function routed(seconds: number, metres: number, source: 'cache' | 'ors', flags: string[]): DriveEstimate {
  return {
    minutes: Math.round(seconds / 60), km: Math.round(metres / 1000), range: null, confidence: 'routed', source,
    flags: flags.filter((f): f is DriveEstimate['flags'][number] => f === 'ferry' || f === 'border' || f === 'unpaved'),
    attribution: DRIVE_ROUTING.attribution,
  };
}

export function createLegService(deps: LegServiceDeps): LegService {
  const now = deps.now ?? Date.now;
  const cap = deps.dailyCap ?? DRIVE_ROUTING.dailyCap;
  const limit = Math.floor(cap * (deps.guardShare ?? DRIVE_ROUTING.guardShare));
  const timeoutMs = deps.timeoutMs ?? DRIVE_ROUTING.timeoutMs;
  const retries = deps.retries ?? DRIVE_ROUTING.retries;
  const br = deps.breaker ?? DRIVE_ROUTING.breaker;
  const log = deps.log ?? ((code: string) => console.warn(`[legs] ${code}`));
  let failures = 0;
  let openedAt: number | null = null;
  let probing = false;

  const breakerState = (): 'closed' | 'open' | 'half-open' => {
    if (openedAt === null) return 'closed';
    return now() - openedAt >= br.openMs ? 'half-open' : 'open';
  };

  async function matrix(sources: DrivePoint[], targets: DrivePoint[], opts: EstimateOptions): Promise<LegMatrixResult> {
    if (sources.length > DRIVE_CACHE.matrixMax || targets.length > DRIVE_CACHE.matrixMax) {
      throw new RangeError(`E_LEGS_MATRIX: at most ${DRIVE_CACHE.matrixMax} by ${DRIVE_CACHE.matrixMax}`);
    }
    const mo: ModelOptions = { month: opts.month, vehicle: opts.vehicle };
    const cells: DriveEstimate[][] = sources.map((s) => targets.map((t) => deps.model(toModel(s), toModel(t), mo)));
    let cached = 0;
    let fresh = 0;
    let reason: LegReason | null = null;
    const note = (r: LegReason): void => { reason ??= r; };
    const same = (i: number, j: number): boolean => sources[i]!.lat === targets[j]!.lat && sources[i]!.lon === targets[j]!.lon;

    // L0: cache, for public pairs only
    const pending = new Set<string>();
    const keyed: { i: number; j: number; from: CacheKey; to: CacheKey }[] = [];
    for (let i = 0; i < sources.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        if (same(i, j)) continue;
        const a = sources[i]!;
        const b = targets[j]!;
        if (isPublic(a) && isPublic(b) && writableLegKey(a, b)) keyed.push({ i, j, from: a.key, to: b.key });
        pending.add(`${i}|${j}`);
      }
    }
    if (keyed.length > 0) {
      try {
        const hit = await deps.cache.read(keyed.map((k) => ({ from: k.from, to: k.to })));
        for (const k of keyed) {
          const row = hit.get(pairId(k.from, k.to));
          if (!row) continue;
          cells[k.i]![k.j] = routed(row.seconds, row.metres, 'cache', row.flags);
          pending.delete(`${k.i}|${k.j}`);
          cached++;
        }
      } catch { log('cache-read-failed'); }
    }

    // L1: one request for the misses
    if (pending.size > 0) {
      const gate = await gateOrs(opts.allowRouting);
      if (gate !== 'ok') note(gate);
      else {
        const rows = [...new Set([...pending].map((k) => Number(k.split('|')[0])))].sort((x, y) => x - y);
        const cols = [...new Set([...pending].map((k) => Number(k.split('|')[1])))].sort((x, y) => x - y);
        // distinct locations: sources then targets (a shared point is sent twice, which keeps the indexes trivial)
        const locations: [number, number][] = [...rows.map((i) => [sources[i]!.lon, sources[i]!.lat] as [number, number]), ...cols.map((j) => [targets[j]!.lon, targets[j]!.lat] as [number, number])];
        const srcIdx = rows.map((_, n) => n);
        const dstIdx = cols.map((_, n) => rows.length + n);
        const key = deps.apiKey()!;
        let res: OrsMatrix | null = null;
        for (let attempt = 0; attempt <= retries && !res; attempt++) {
          try { res = await orsMatrix(deps.fetcher, key, locations, srcIdx, dstIdx, timeoutMs); } catch (e) {
            const why = e instanceof OrsFailure ? e.reason : 'error';
            if (attempt === retries) { recordFailure(); note(why); }
          }
        }
        if (res) {
          recordSuccess();
          const writes: LegCacheRow[] = [];
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < cols.length; c++) {
              const i = rows[r]!;
              const j = cols[c]!;
              if (!pending.has(`${i}|${j}`)) continue;
              const s = res.durations[r]?.[c];
              const m = res.distances[r]?.[c];
              if (typeof s !== 'number' || typeof m !== 'number' || !Number.isFinite(s) || !Number.isFinite(m)) { note('no-route'); continue; }
              cells[i]![j] = routed(s, m, 'ors', []);
              fresh++;
              const a = sources[i]!;
              const b = targets[j]!;
              if (isPublic(a) && isPublic(b)) {
                let k: ReturnType<typeof writableLegKey> = null;
                try { k = writableLegKey(a, b); } catch { k = null; } // home point unset: fail closed, no write
                if (k) writes.push({ ...k, mode: 'drive', profile: 'driving-car', engine: 'ors', engine_version: null, seconds: Math.round(s), metres: Math.round(m), flags: [] });
              }
            }
          }
          if (writes.length > 0) await deps.cache.write(writes).catch(() => log('cache-write-failed'));
        }
      }
    }
    const total = sources.length * targets.length;
    const routedCells = cached + fresh;
    return { cells, basis: finalBasis(total, same2(sources, targets), routedCells), reason, cached, fresh };
  }

  async function gateOrs(allowRouting: boolean): Promise<'ok' | LegReason> {
    if (!allowRouting) return 'not-allowed';
    if (!deps.apiKey()) return 'no-key';
    const st = breakerState();
    if (st === 'open' || (st === 'half-open' && probing)) return 'breaker';
    if (!deps.quota) return 'quota';
    try {
      const t = await deps.quota.take([{ bucket: DRIVE_ROUTING.quotaBucket, key: '', windowS: DRIVE_ROUTING.quotaWindowS, limit }]);
      if (!t.allowed) return 'quota';
    } catch { log('quota-unavailable'); return 'quota'; } // fail closed: no count, no call
    if (st === 'half-open') probing = true;
    return 'ok';
  }
  function recordFailure(): void {
    probing = false;
    failures++;
    if (failures >= br.failures || openedAt !== null) { openedAt = now(); log('breaker-open'); }
  }
  function recordSuccess(): void { probing = false; failures = 0; openedAt = null; }

  return {
    estimateMatrix: matrix,
    estimateDriveMatrix: async (s, t, o) => (await matrix(s, t, o)).cells,
    estimateDrive: async (a, b, o) => (await matrix([a], [b], o)).cells[0]![0]!,
    status: () => ({ breaker: breakerState(), keyPresent: Boolean(deps.apiKey()) }),
  };
}

function same2(sources: DrivePoint[], targets: DrivePoint[]): number {
  let n = 0;
  for (const s of sources) for (const t of targets) if (s.lat === t.lat && s.lon === t.lon) n++;
  return n;
}
function finalBasis(total: number, identical: number, routedCells: number): LegBasis['basis'] {
  const needed = total - identical;
  if (routedCells === 0) return 'estimate';
  return routedCells >= needed ? 'routed' : 'mixed';
}

// ----- the default service ------------------------------------------------------------------------------------------------------------

let shared: LegService | undefined;

/** The process-wide service: Postgres cache and quota when DATABASE_URL is set, memory otherwise; ORS over global fetch; the key from ORS_API_KEY. */
export function getLegService(): LegService {
  if (shared) return shared;
  const loaded = loadDriveData(travelRoot());
  const model = createModel(indexDriveData(loaded.data));
  const db = Boolean(process.env.DATABASE_URL);
  shared = createLegService({
    cache: db ? createPgLegCacheStore() : createMemoryLegCacheStore(),
    quota: db ? createPgQuotaStore() : null,
    fetcher: (url, init) => fetch(url, init),
    model,
    apiKey: () => process.env[DRIVE_ROUTING.keyEnv]?.trim() || null,
  });
  return shared;
}

// ----- the batch runner ---------------------------------------------------------------------------------------------------------------

/**
 * The one ORS runner for batches (builder plans, hub pairs): splits a large source and target list into matrices of at most
 * DRIVE_CACHE.matrixMax, runs them one after another (never in parallel, so the daily guard and the breaker see each call), and joins the cells.
 */
export async function runLegBatch(svc: LegService, sources: DrivePoint[], targets: DrivePoint[], opts: EstimateOptions): Promise<LegMatrixResult> {
  const step = DRIVE_CACHE.matrixMax;
  const cells: DriveEstimate[][] = sources.map(() => []);
  let cached = 0;
  let fresh = 0;
  let reason: LegReason | null = null;
  let anyRouted = false;
  let allRouted = true;
  for (let i = 0; i < sources.length; i += step) {
    const rows = sources.slice(i, i + step);
    for (let j = 0; j < targets.length; j += step) {
      const part = await svc.estimateMatrix(rows, targets.slice(j, j + step), opts);
      part.cells.forEach((r, n) => cells[i + n]!.push(...r));
      cached += part.cached;
      fresh += part.fresh;
      reason ??= part.reason;
      if (part.basis !== 'estimate') anyRouted = true;
      if (part.basis !== 'routed') allRouted = false;
    }
  }
  return { cells, cached, fresh, reason, basis: !anyRouted ? 'estimate' : allRouted ? 'routed' : 'mixed' };
}
