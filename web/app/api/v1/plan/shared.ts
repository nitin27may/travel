import { gazetteerOf } from '@travel/core/privacy/towns.ts';
import { ipHash } from '@travel/core/quota/keys.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';
import { FACET_KEY_RE, API_LIMITS } from '@travel/core/schema/api/index.ts';
import {
  PLAN_CANDIDATE_ROW_KEYS,
  PLAN_LIMITS,
  parsePlanBuildInput,
  parsePlanCandidatesQuery,
  planHttpStatus,
  planRegionsInput,
  type PlanApiError,
  type PlanCandidatesQuery,
  type PlanErrorCode,
  type PlanResult,
} from '@travel/core/schema/api/plan.ts';
import { originOfToken } from '@travel/core/schema/plan-draft.ts';
import { ownHosts } from '@/lib/config/product';
import { clientIp } from '@/lib/server/client-ip';
import { createPlanService, defaultDrive, fileReference, type PlanService } from '@/lib/server/planService';
import { getLegService } from '@/lib/server/legs';
import { privacyHits, rowOutsideAllowlist } from '@/lib/server/privacy';
import { sameOrigin } from '@/lib/server/same-origin';
import { getStore } from '@/lib/server/store';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';

// The three builder routes' one handler (TB-API; trip-builder.md 5, 7; api/plan.ts header): `/api/v1/plan/regions/{cc}`, `/candidates` and
// `/build`. Same shape as respond() (web/lib/server/respond.ts): decode, call the service, check the answer against its contract and the
// privacy detector (a body that fails is never sent: 500 `internal`), ETag from the store's revision for the two GETs, status from the
// code. Order of checks, cheapest and most private first:
//   1. flag `planBuilder` (NEXT_PUBLIC_PLAN_BUILDER=1, which needs tripEdit: NEXT_PUBLIC_TRIP_EDIT=1): off answers 404 as if there were no route;
//   2. the run-time pause PLAN_BUILDER_PAUSED=1: 503 `plan_paused`;
//   3. a build: same origin, JSON content type, the per-IP hourly bucket, then the body read in pieces up to its byte cap;
//   4. validation (a path and a code per issue, never a value: the body holds the party), the service, the answer parsed by its schema.
// A build answers `no-store`. Logs hold the route name and a fixed code, never a body, a query, an IP or a point.
// RB-010: `/candidates` is a GET only for public queries (trip mode, no party band): cacheable, with an ETag. A query that names a start
// (near mode) or a party band is a POST with the decoded query as its JSON body (JSON only, at most candidateBodyBytes), answered
// `no-store` with the same page shape; the GET refuses `from`, `p` and `m=near`.

export type PlanRoute = 'regions' | 'starts' | 'candidates' | 'build';

export interface PlanRouteDeps {
  service: PlanService;
  store: CatalogueStore;
  /** the per-IP bucket store; null: none (a local run). In production a missing store or secret fails closed. */
  quota: () => QuotaStore | null;
  env: () => Record<string, string | undefined>;
  now: () => Date;
}

/** The flag: the builder needs the trip pages' edit mode (the plan: planBuilder requires tripEdit). Read per call so a test can set it. */
export const planBuilderOn = (env: Record<string, string | undefined> = process.env): boolean => env.NEXT_PUBLIC_PLAN_BUILDER === '1' && env.NEXT_PUBLIC_TRIP_EDIT === '1';

const CACHE_DATA = 'public, max-age=60, stale-while-revalidate=600';
const NO_STORE = 'no-store';
const BUCKET = 'plan:build';
const HOUR_S = 3600;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

function failure(code: PlanErrorCode, message: string, details?: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  const error: PlanApiError = { code, message, ...(details ? { details } : {}) };
  return json(planHttpStatus(code), { error }, { 'cache-control': NO_STORE, ...headers });
}

/** The body of a POST as text, read in pieces up to `max` bytes: null when it is longer. */
async function boundedText(r: Request, max: number): Promise<string | null> {
  const declared = Number(r.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = r.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// ---- the candidates URL -------------------------------------------------------------------------------------------------------------

const LIST_KEYS = new Set(['m', 'cc', 'rg', 'from', 'r', 'mo', 'p', 'list', 'page', 'pageSize', 'near', 'limit']);
/** The candidates keys that are private (RB-010; trip-builder 7): the start and the party band. A GET carrying one is refused. */
export const PRIVATE_CANDIDATE_KEYS = ['from', 'p'] as const;
const INT = /^[0-9]{1,6}$/;

/** The flat URL of api/plan.ts `planCandidatesHttpQuery` to the decoded query, or the keys that failed. Facet keys are `FACET_KEY_RE`; each value is a comma list. */
export function decodeCandidates(params: URLSearchParams): { ok: true; query: PlanCandidatesQuery } | { ok: false; error: PlanApiError } {
  const bad = (keys: string[]): { ok: false; error: PlanApiError } => ({ ok: false, error: { code: 'invalid_input', message: `Check these query parameters: ${keys.join(', ')}.`, details: { keys } } });
  const keys = [...new Set(params.keys())];
  const unknown = keys.filter((k) => !LIST_KEYS.has(k) && !FACET_KEY_RE.test(k));
  if (unknown.length) return bad(unknown.slice(0, 20));
  const repeated = keys.filter((k) => params.getAll(k).length > 1);
  if (repeated.length) return bad(repeated);
  const get = (k: string) => params.get(k) ?? undefined;
  const failed: string[] = [];
  const int = (k: string): number | undefined => {
    const v = get(k);
    if (v === undefined) return undefined;
    if (!INT.test(v)) failed.push(k);
    return Number(v);
  };
  const facets: Record<string, string[]> = {};
  for (const k of keys) {
    if (LIST_KEYS.has(k)) continue;
    const vals = params.get(k)!.split(',').map((x) => x.trim()).filter(Boolean);
    if (vals.length > API_LIMITS.query.valuesPerKey) failed.push(k);
    else if (vals.length) facets[k] = vals;
  }
  const common = {
    ...(Object.keys(facets).length ? { facets } : {}),
    ...(get('mo') !== undefined ? { month: int('mo') } : {}),
    ...(get('p') !== undefined ? { party: get('p') } : {}),
    ...(get('list') !== undefined ? { list: get('list') } : {}),
    ...(get('page') !== undefined ? { page: int('page') } : {}),
    ...(get('pageSize') !== undefined ? { pageSize: int('pageSize') } : {}),
    ...(get('near') !== undefined ? { near: get('near') } : {}),
    ...(get('limit') !== undefined ? { limit: int('limit') } : {}),
  };
  const rg = get('rg') ? get('rg')!.split(',').filter(Boolean) : undefined;
  const mode = get('m');
  let raw: unknown;
  if (mode === 'trip') raw = { mode, cc: get('cc'), regions: rg ?? [], ...common };
  else if (mode === 'near') {
    const from = get('from');
    const start = from ? originOfToken(from) : null;
    if (!start) failed.push('from');
    raw = { mode, start, driveLimitMin: int('r'), ...(rg ? { regions: rg } : {}), ...common };
  } else return bad(['m']);
  if (failed.length) return bad([...new Set(failed)]);
  const parsed = parsePlanCandidatesQuery(raw);
  if (parsed.ok) return { ok: true, query: parsed.data };
  // name the URL key an issue belongs to
  const urlKey: Record<string, string> = { regions: 'rg', start: 'from', driveLimitMin: 'r', month: 'mo', party: 'p', facets: 'f' };
  const names = parsed.issues.map((i) => urlKey[/^\$\.([A-Za-z]+)/.exec(i.path)?.[1] ?? ''] ?? /^\$\.([A-Za-z]+)/.exec(i.path)?.[1] ?? 'm');
  return bad([...new Set(names)]);
}

// ---- defaults and the handler ---------------------------------------------------------------------------------------------------------

/** The run-time routing switch: PLAN_ROUTING set to one lets a build ask the router for cells the cache lacks (daily guard, server rows, model fallback). Anything else: cache reads only. Read per request. */
export const routingOn = (env: Record<string, string | undefined>): boolean => env.PLAN_ROUTING === '1';

let pgQuota: QuotaStore | undefined;

export function defaultDeps(): PlanRouteDeps {
  const store = getStore();
  return {
    store,
    service: createPlanService({ store, legs: getLegService(), reference: fileReference(), drive: defaultDrive, now: () => new Date(), allowRouting: routingOn(process.env) }),
    quota: () => (process.env.DATABASE_URL ? (pgQuota ??= createPgQuotaStore()) : null),
    env: () => process.env,
    now: () => new Date(),
  };
}

/** The per-IP hourly build bucket. Null to go on, or the answer. Fails closed in production without a store or a secret. */
async function takeBuild(req: Request, deps: PlanRouteDeps): Promise<Response | null> {
  const env = deps.env();
  const secret = env.AUTH_QUOTA_SECRET;
  const store = deps.quota();
  if (!store || !secret || secret.length < 16) {
    if (env.NODE_ENV === 'production') {
      console.error('plan build: quota not configured');
      return failure('plan_paused', 'Planning is paused. Your drafts are safe on this device.');
    }
    return null; // a local run without the quota store
  }
  try {
    const key = ipHash(secret, clientIp(req), deps.now());
    const r = await store.take([{ bucket: BUCKET, key, windowS: HOUR_S, limit: PLAN_LIMITS.buildsPerHour }]);
    if (!r.allowed) return failure('rate_limited', 'Too many builds. Try again later.', { retryAfterS: r.retryAfterS }, { 'retry-after': String(r.retryAfterS) });
    return null;
  } catch {
    console.error('plan build: quota unavailable');
    return failure('plan_paused', 'Planning is paused. Your drafts are safe on this device.');
  }
}

const matches = (header: string | null, etag: string): boolean => !!header && (header.trim() === '*' || header.split(',').some((t) => t.trim().replace(/^W\//, '') === etag));

/** Send a service result: errors by code; data after the privacy detector, with an ETag for the cacheable ones (never a POST: no-store). */
async function send<T>(name: PlanRoute, req: Request, result: PlanResult<T>, deps: PlanRouteDeps, rows?: ReadonlySet<string>): Promise<Response> {
  if (!result.ok) return failure(result.error.code, result.error.message, result.error.details);
  const data = result.data as unknown as Record<string, unknown>;
  const stray = rows ? rowOutsideAllowlist(data.items, rows) : null;
  const hits = privacyHits(data, 20, { gazetteer: await gazetteerOf(deps.store), echo: [], ownHosts: ownHosts() });
  if (stray || hits.length) {
    console.error(`plan ${name}: privacy detector blocked the answer`, stray ? `row key ${stray}` : JSON.stringify(hits.slice(0, 5)));
    return failure('internal', 'The response could not be served.');
  }
  if (name === 'build' || req.method === 'POST') return json(200, data, { 'cache-control': NO_STORE });
  const etag = `"${result.revision}"`;
  const headers = { 'cache-control': CACHE_DATA, etag };
  if (matches(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
  return json(200, data, headers);
}

export async function handlePlan(name: PlanRoute, req: Request, params: Record<string, string> = {}, deps: PlanRouteDeps = defaultDeps()): Promise<Response> {
  const env = deps.env();
  if (!planBuilderOn(env)) return failure('not_found', 'Not found.');
  if (env.PLAN_BUILDER_PAUSED === '1') return failure('plan_paused', 'Planning is paused. Your drafts are safe on this device.');
  try {
    if (name === 'regions') {
      const input = planRegionsInput.safeParse({ cc: params.cc ?? '' });
      if (!input.success) return failure('invalid_input', 'The country must be two capital letters.', { keys: ['cc'] });
      if ([...new URL(req.url).searchParams.keys()].length) return failure('invalid_input', 'This endpoint takes no query parameter.');
      return send(name, req, await deps.service.regions(input.data.cc), deps);
    }
    if (name === 'starts') {
      if ([...new URL(req.url).searchParams.keys()].length) return failure('invalid_input', 'This endpoint takes no query parameter.');
      return send(name, req, await deps.service.starts(), deps);
    }
    if (name === 'candidates' && req.method !== 'POST') {
      const params = new URL(req.url).searchParams;
      // RB-010: a start (near mode) and a party band are private; they travel in a POST body, never in a URL a log or a cache keeps
      const secret = PRIVATE_CANDIDATE_KEYS.filter((k) => params.has(k));
      if (secret.length || params.get('m') === 'near') return failure('invalid_input', 'A query with a start or a party goes in a POST body, not the address.', { keys: secret.length ? secret : ['m'] });
      const q = decodeCandidates(params);
      if (!q.ok) return failure(q.error.code, q.error.message, q.error.details);
      return send(name, req, await deps.service.candidates(q.query), deps, new Set<string>(PLAN_CANDIDATE_ROW_KEYS));
    }
    // the POSTs: candidates with a private query (RB-010) and build. Both take JSON only, so a browser on another site must pass a CORS
    // preflight this route never answers. The candidates POST is a read like its GET (no quota, no cookie), so it skips the origin check
    // the build's bucket needs.
    if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return failure('invalid_input', 'The body must be JSON.');
    if (name === 'candidates') {
      if ([...new URL(req.url).searchParams.keys()].length) return failure('invalid_input', 'A candidates POST takes its query in the body only.');
      const text = await boundedText(req, PLAN_LIMITS.candidateBodyBytes);
      if (text === null) return failure('too_large', 'The request is too large.', { max: PLAN_LIMITS.candidateBodyBytes });
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return failure('invalid_input', 'The body must be JSON.');
      }
      const parsed = parsePlanCandidatesQuery(body);
      if (!parsed.ok) return failure('invalid_input', 'The request does not match the contract.', { issues: parsed.issues });
      return send(name, req, await deps.service.candidates(parsed.data), deps, new Set<string>(PLAN_CANDIDATE_ROW_KEYS));
    }
    if (!sameOrigin(req)) return failure('invalid_input', 'Cross-site requests are not accepted.');
    const limited = await takeBuild(req, deps);
    if (limited) return limited;
    const text = await boundedText(req, PLAN_LIMITS.buildBodyBytes);
    if (text === null) return failure('too_large', 'The request is too large.', { max: PLAN_LIMITS.buildBodyBytes });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return failure('invalid_input', 'The body must be JSON.');
    }
    const parsed = parsePlanBuildInput(body);
    if (!parsed.ok) return failure('invalid_input', 'The request does not match the contract.', { issues: parsed.issues });
    return send(name, req, await deps.service.build(parsed.data), deps);
  } catch {
    console.error(`plan ${name} failed`);
    return failure('internal', 'The request could not be answered.');
  }
}
