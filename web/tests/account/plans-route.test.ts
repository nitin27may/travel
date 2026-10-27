import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The auth SDK is never loaded: every handler takes its session through the injected deps.
vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn() }));

import { accountTripsOn, deleteRoute, getRoute, listRoute, mergeRoute, putRoute, PLAN_CODES, type PlansDeps, type PublicTripFacts } from '@/lib/server/plans';
import { PLANS_LIMITS } from '@travel/core/config/auth-limits.ts';
import { PLAN_SYNC } from '@travel/core/config/plans.ts';
import type { MergeInsertResult, PlanWrite, PutResult, DeleteResult, PlanMergeKey } from '@travel/core/db/plans.ts';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';
import {
  ACCOUNT_PLANS_LIMITS,
  ACCOUNT_PLANS_QUOTA_BUCKET,
  accountPlanConflict,
  accountPlanGet,
  accountPlanMergeAnswer,
  accountPlanWritten,
  decideDelete,
  decidePut,
  parseAccountPlanList,
  type AccountPlanRow,
} from '@travel/core/schema/api/account-plans.ts';
import { parsePlanDraft, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { copyOf, templateDraft, COPY_ID } from '../../../core/test/plan/doc-helpers';

// The account plan routes (edit-my-trip 4.1, 4.2, 4.5; EM-1) over an in-memory database that keeps the real module's rules: owner-only
// visibility (RLS), decidePut and decideDelete, the revision bump, the tombstone that clears the document, the 50 cap, and the merge's
// `on conflict (id) do nothing`. The rules of the SQL itself are tested against Postgres in core/test/db/plan-doc.test.ts.

const A = { id: 'user-a', email: 'a@example.test' };
const B = { id: 'user-b', email: 'b@example.test' };
const ID2 = '0b9f2c41-7a3e-4c55-8d21-9e8f7a6b5c4d';
const SECRET = 'q'.repeat(32);
const TRIPS = new Map<string, PublicTripFacts>([
  ['dolomites-2027', { title: 'Dolomites', cc: 'IT', days: 14 }],
  ['canadian-rockies-2029', { title: 'Canadian Rockies', cc: 'CA', days: 15 }],
]);
/** One dated legacy folder and its public alias, as the folder table maps it. */
const ALIAS: Record<string, string> = { 'canadian-rockies-sept-2029': 'canadian-rockies-2029' };

interface Row extends PlanWrite {
  user: string;
  revision: number;
  deleted_at: string | null;
  updated_at: string;
}

function fakeDb(cap: number = ACCOUNT_PLANS_LIMITS.accountPlans) {
  const rows = new Map<string, Row>();
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 9, 27, 12, 0, tick++)).toISOString();
  const seen = (u: string, id: string) => {
    const r = rows.get(id);
    return r && r.user === u ? r : null;
  };
  const live = (u: string) => [...rows.values()].filter((r) => r.user === u && r.deleted_at === null).length;
  const conflictOf = (r: Row) => ({ revision: r.revision, doc: r.deleted_at === null ? r.doc : null, deleted_at: r.deleted_at });
  const calls: string[] = [];
  const db: PlansDeps['db'] = {
    async list(u) {
      calls.push(`list:${u}`);
      return [...rows.entries()]
        .filter(([, r]) => r.user === u)
        .map(([id, r]): AccountPlanRow => ({ id, title: r.title, kind: r.deleted_at ? null : r.kind, source_trip: r.deleted_at ? null : r.source_trip, start: r.deleted_at ? null : r.start, days: r.deleted_at ? null : r.days, revision: r.revision, updated_at: r.updated_at, deleted_at: r.deleted_at }));
    },
    async get(u, id) {
      calls.push(`get:${u}`);
      const r = seen(u, id);
      return r && r.deleted_at === null ? { revision: r.revision, doc: r.doc } : null;
    },
    async put(u, id, base, restore, w): Promise<PutResult> {
      calls.push(`put:${u}`);
      const r = seen(u, id);
      const d = decidePut(base, r ? { revision: r.revision, deleted_at: r.deleted_at } : null, restore);
      if (d === 'not-found') return { kind: 'not-found' };
      if (d === 'conflict') return { kind: 'conflict', row: conflictOf(r!) };
      if (d === 'insert') {
        if (rows.has(id)) return { kind: 'not-found' };
        if (live(u) >= cap) return { kind: 'cap' };
        rows.set(id, { ...w, user: u, revision: 0, deleted_at: null, updated_at: stamp() });
        return { kind: 'written', revision: 0, created: true };
      }
      if (r!.deleted_at !== null && live(u) >= cap) return { kind: 'cap' };
      Object.assign(r!, w, { revision: r!.revision + 1, deleted_at: null, updated_at: stamp() });
      return { kind: 'written', revision: r!.revision, created: false };
    },
    async del(u, id, base): Promise<DeleteResult> {
      calls.push(`del:${u}`);
      const r = seen(u, id);
      const d = decideDelete(base, r ? { revision: r.revision, deleted_at: r.deleted_at } : null);
      if (d === 'not-found') return { kind: 'not-found' };
      if (d === 'already') return { kind: 'already', revision: r!.revision };
      if (d === 'conflict') return { kind: 'conflict', row: conflictOf(r!) };
      Object.assign(r!, { revision: r!.revision + 1, deleted_at: stamp(), doc: null, kind: null, source_trip: null, start: null, days: null, updated_at: stamp() });
      return { kind: 'deleted', revision: r!.revision };
    },
    async mergeKeys(u, pairs): Promise<PlanMergeKey[]> {
      calls.push(`mergeKeys:${u}`);
      return [...rows.entries()]
        .filter(([, r]) => r.user === u && r.deleted_at === null)
        .map(([id, r]) => ({ id, source_trip: r.source_trip, start: r.start, doc: pairs.some((p) => p.trip === r.source_trip && p.start === r.start) ? r.doc : null }));
    },
    async insert(u, list): Promise<MergeInsertResult> {
      calls.push(`insert:${u}`);
      const out: MergeInsertResult = { inserted: [], already: [], overCap: [], refused: [] };
      for (const w of list) {
        const there = rows.get(w.id);
        if (there) {
          (there.user === u ? out.already : out.refused).push(w.id);
          continue;
        }
        if (live(u) >= cap) {
          out.overCap.push(w.id);
          continue;
        }
        rows.set(w.id, { ...w, user: u, revision: 0, deleted_at: null, updated_at: stamp() });
        out.inserted.push(w.id);
      }
      return out;
    },
  };
  return { db, rows, calls };
}

function harness(over: Partial<PlansDeps> & { who?: typeof A | null; cap?: number } = {}) {
  const { db, rows, calls } = fakeDb(over.cap);
  const quota = createMemoryQuotaStore();
  let who: typeof A | null = over.who === undefined ? A : over.who;
  const deps: PlansDeps = {
    enabled: () => true,
    user: vi.fn(async () => who),
    db,
    quota: () => quota,
    env: () => ({ NODE_ENV: 'test', AUTH_QUOTA_SECRET: SECRET }),
    trips: async () => TRIPS,
    aliasOf: (s) => ALIAS[s] ?? s,
    now: () => new Date('2026-10-27T12:00:00Z'),
    ...over,
  };
  return { deps, rows, calls, quota, as: (u: typeof A | null) => (who = u) };
}

const URL_BASE = 'http://localhost:3000/api/account/plans/';
function req(method: string, path = '', body?: unknown, headers: Record<string, string> = {}): Request {
  const init: RequestInit = { method, headers: { host: 'localhost:3000', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(URL_BASE + path, init);
}
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

/** A built-mode draft (the builder's: no template, the device party). */
function builtDraft(id = ID2, title: string | null = null): PlanDraft {
  const rest: Record<string, unknown> = { ...templateDraft({ id, title }) };
  for (const k of ['template', 'start', 'travellers']) delete rest[k];
  const r = parsePlanDraft({ ...rest, party: 'device' });
  if (!r.success) throw new Error(`built fixture: ${r.issues.join('; ')}`);
  return r.data;
}
const putBody = (doc: unknown, base: number | null = null, extra: Record<string, unknown> = {}) => ({ base, title: 'From the client', doc, ...extra });

beforeEach(() => vi.stubEnv('NODE_ENV', 'test'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('the flag (accountTrips)', () => {
  it('is on only with sign-in and NEXT_PUBLIC_ACCOUNT_TRIPS=1', () => {
    expect(accountTripsOn({ signIn: '1', accountTrips: '1' })).toBe(true);
    expect(accountTripsOn({ signIn: '1' })).toBe(false);
    expect(accountTripsOn({ accountTrips: '1' })).toBe(false);
    expect(accountTripsOn({ signIn: '1', accountTrips: 'true' })).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
    vi.stubEnv('NEXT_PUBLIC_ACCOUNT_TRIPS', '');
    expect(accountTripsOn()).toBe(false);
  });

  it('off answers 404 on every route before the session or the database is read', async () => {
    const h = harness({ enabled: () => false });
    const answers = await Promise.all([
      listRoute(req('GET'), h.deps),
      getRoute(req('GET', COPY_ID), COPY_ID, h.deps),
      putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps),
      deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps),
      mergeRoute(req('POST', 'merge', []), h.deps),
    ]);
    for (const r of answers) {
      expect(r.status).toBe(404);
      expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(h.deps.user).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
  });
});

describe('origin and session', () => {
  it.each(['https://evil.test', 'http://localhost:3001', 'null'])('refuses origin %s with 403 before the session', async (origin) => {
    const h = harness();
    for (const r of [
      await listRoute(req('GET', '', undefined, { origin }), h.deps),
      await putRoute(req('PUT', COPY_ID, putBody(templateDraft()), { origin }), COPY_ID, h.deps),
      await mergeRoute(req('POST', 'merge', [], { origin }), h.deps),
    ]) {
      expect(r.status).toBe(403);
      expect(await json(r)).toEqual({ code: PLAN_CODES.forbidden });
    }
    expect(h.deps.user).not.toHaveBeenCalled();
  });

  it('answers 401 without a session, and reads nothing', async () => {
    const h = harness({ who: null });
    expect((await listRoute(req('GET'), h.deps)).status).toBe(401);
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps)).status).toBe(401);
    expect((await mergeRoute(req('POST', 'merge', []), h.deps)).status).toBe(401);
    expect(h.calls).toEqual([]);
  });

  it('takes the user only from the session: a body naming another user is refused, and the store sees the session id', async () => {
    const h = harness();
    const forged = await putRoute(req('PUT', COPY_ID, { ...putBody(templateDraft()), userId: B.id }), COPY_ID, h.deps);
    expect(forged.status).toBe(400);
    const ok = await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    expect(ok.status).toBe(201);
    expect(h.calls).toEqual(['put:user-a']);
    expect(h.rows.get(COPY_ID)?.user).toBe(A.id);
  });

  it('answers 404 for a path id that is not a lower-case UUID v4', async () => {
    const h = harness();
    for (const id of ['x', COPY_ID.toUpperCase(), '../plans', '00000000-0000-0000-0000-000000000000']) {
      expect((await getRoute(req('GET', id), id, h.deps)).status).toBe(404);
      expect((await putRoute(req('PUT', id, putBody(templateDraft())), id, h.deps)).status).toBe(404);
      expect((await deleteRoute(req('DELETE', id, { base: 0 }), id, h.deps)).status).toBe(404);
    }
    expect(h.calls).toEqual([]);
  });
});

describe('PUT, GET and the list', () => {
  it('creates with base null, updates with the revision, and answers 409 with the row for a stale base', async () => {
    const h = harness();
    const created = await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    expect(created.status).toBe(201);
    expect(accountPlanWritten.parse(await created.json())).toEqual({ revision: 0 });

    const changed = templateDraft({ start: '2027-07-10' });
    const updated = await putRoute(req('PUT', COPY_ID, putBody(changed, 0)), COPY_ID, h.deps);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ revision: 1 });

    const stale = await putRoute(req('PUT', COPY_ID, putBody(templateDraft(), 0)), COPY_ID, h.deps);
    expect(stale.status).toBe(409);
    const body = accountPlanConflict.parse(await stale.json());
    expect(body.revision).toBe(1);
    expect(body.deleted_at).toBeNull();
    expect((body.doc as PlanDraft).start).toBe('2027-07-10');

    // a create of an id the caller already holds is a conflict too (never a second row)
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps)).status).toBe(409);

    const got = await getRoute(req('GET', COPY_ID), COPY_ID, h.deps);
    expect(got.status).toBe(200);
    expect(accountPlanGet.parse(await got.json()).revision).toBe(1);
  });

  it('derives the row from the document: a template takes the catalogue title unless the person set one; a built draft keeps the client title', async () => {
    const h = harness();
    await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    expect(h.rows.get(COPY_ID)).toMatchObject({ title: 'Dolomites', kind: 'template', source_trip: 'dolomites-2027', start: '2027-07-03', days: 14 });
    await putRoute(req('PUT', COPY_ID, putBody(templateDraft({ title: 'Summer in the Dolomites' }), 0)), COPY_ID, h.deps);
    expect(h.rows.get(COPY_ID)?.title).toBe('Summer in the Dolomites');

    const built = await putRoute(req('PUT', ID2, putBody(builtDraft())), ID2, h.deps);
    expect(built.status).toBe(201);
    expect(h.rows.get(ID2)).toMatchObject({ title: 'From the client', kind: 'built', source_trip: null, start: null });
  });

  it('lists light rows that parse under the contract and never carry a document', async () => {
    const h = harness();
    await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    await putRoute(req('PUT', ID2, putBody(builtDraft())), ID2, h.deps);
    const r = await listRoute(req('GET'), h.deps);
    expect(r.status).toBe(200);
    const text = await r.clone().text();
    expect(text).not.toContain('"doc"');
    expect(text).not.toContain('travellers');
    const list = parseAccountPlanList(await r.json());
    expect(list.success).toBe(true);
    if (list.success) expect(list.data.items.map((i) => i.id).sort()).toEqual([COPY_ID, ID2].sort());
  });

  it('refuses a template whose trip is not public and listed (422), before any write', async () => {
    const h = harness({ trips: async () => new Map([['canadian-rockies-2029', TRIPS.get('canadian-rockies-2029')!]]) });
    const r = await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    expect(r.status).toBe(422);
    expect(await json(r)).toEqual({ code: PLAN_CODES.tripNotPublic });
    expect(h.calls).toEqual([]);
  });

  it('validates the whole document (R5): the path id, the shape, a newer schema; issues name paths, never values', async () => {
    const h = harness();
    const mismatch = await putRoute(req('PUT', ID2, putBody(templateDraft())), ID2, h.deps);
    expect(mismatch.status).toBe(400);
    expect(await json(mismatch)).toEqual({ code: PLAN_CODES.invalid, issues: ['$.doc.id: the row\'s id'] });

    const secret = 'Pack bear spray at 12 Elm Street';
    const bad = await putRoute(req('PUT', COPY_ID, putBody({ ...templateDraft(), start: secret })), COPY_ID, h.deps);
    expect(bad.status).toBe(400);
    const badText = await bad.text();
    expect(badText).toContain('$.doc.start');
    expect(badText).not.toContain('Elm Street');

    const newer = await putRoute(req('PUT', COPY_ID, putBody({ ...templateDraft(), schema: 'plan-draft/2' })), COPY_ID, h.deps);
    expect(newer.status).toBe(422);
    expect(await json(newer)).toEqual({ code: PLAN_CODES.schema });

    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft(), -1)), COPY_ID, h.deps)).status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it('refuses another content type (415), a body over its cap (413) and text that is not JSON (400)', async () => {
    const h = harness();
    const plain = await putRoute(req('PUT', COPY_ID, JSON.stringify(putBody(templateDraft())), { 'content-type': 'text/plain' }), COPY_ID, h.deps);
    expect(plain.status).toBe(415);
    const form = await mergeRoute(req('POST', 'merge', 'a=1', { 'content-type': 'application/x-www-form-urlencoded' }), h.deps);
    expect(form.status).toBe(415);

    const big = 'x'.repeat(ACCOUNT_PLANS_LIMITS.putBodyBytes + 1);
    expect((await putRoute(req('PUT', COPY_ID, big), COPY_ID, h.deps)).status).toBe(413);
    // a body that lies about its length is still cut at the cap
    expect((await putRoute(req('PUT', COPY_ID, big, { 'content-length': '10' }), COPY_ID, h.deps)).status).toBe(413);
    expect((await deleteRoute(req('DELETE', COPY_ID, JSON.stringify({ base: 0, pad: 'y'.repeat(300) })), COPY_ID, h.deps)).status).toBe(413);
    expect((await mergeRoute(req('POST', 'merge', 'z'.repeat(ACCOUNT_PLANS_LIMITS.mergeBodyBytes + 1)), h.deps)).status).toBe(413);

    expect((await putRoute(req('PUT', COPY_ID, '{"base":'), COPY_ID, h.deps)).status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it('answers 409 PLAN_CAP at the account cap', async () => {
    const h = harness({ cap: 1 });
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps)).status).toBe(201);
    const r = await putRoute(req('PUT', ID2, putBody(builtDraft())), ID2, h.deps);
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ code: PLAN_CODES.cap });
  });
});

describe('another user', () => {
  it('cannot read, overwrite, take over or remove a row: 404 each time, and the row is unchanged', async () => {
    const h = harness();
    await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    h.as(B);
    expect((await getRoute(req('GET', COPY_ID), COPY_ID, h.deps)).status).toBe(404);
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps)).status).toBe(404);
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft(), 0)), COPY_ID, h.deps)).status).toBe(404);
    expect((await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps)).status).toBe(404);
    const list = await json(await listRoute(req('GET'), h.deps));
    expect(list).toEqual({ items: [] });
    expect(h.rows.get(COPY_ID)).toMatchObject({ user: A.id, revision: 0, deleted_at: null });
  });
});

describe('DELETE and restore', () => {
  it('tombstones, is idempotent, hides the document, and a restore with the tombstone revision brings it back', async () => {
    const h = harness();
    await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    const stale = await deleteRoute(req('DELETE', COPY_ID, { base: 5 }), COPY_ID, h.deps);
    expect(stale.status).toBe(409);
    expect(accountPlanConflict.parse(await stale.json()).revision).toBe(0);

    const del = await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps);
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ revision: 1 });
    expect((await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps)).status).toBe(200);

    expect((await getRoute(req('GET', COPY_ID), COPY_ID, h.deps)).status).toBe(404);
    const rows = parseAccountPlanList(await (await listRoute(req('GET'), h.deps)).json());
    expect(rows.success && rows.data.items[0]).toMatchObject({ id: COPY_ID, title: 'Dolomites', start: null });
    expect(rows.success && rows.data.items[0]?.deleted_at).not.toBeNull();

    // an edit from a device that missed the removal learns of it: 409 with no document
    const edit = await putRoute(req('PUT', COPY_ID, putBody(templateDraft(), 1)), COPY_ID, h.deps);
    expect(edit.status).toBe(409);
    const c = accountPlanConflict.parse(await edit.json());
    expect(c.doc).toBeNull();
    expect(c.deleted_at).not.toBeNull();

    const back = await putRoute(req('PUT', COPY_ID, putBody(templateDraft(), 1, { restore: true })), COPY_ID, h.deps);
    expect(back.status).toBe(200);
    expect(await back.json()).toEqual({ revision: 2 });
    expect((await getRoute(req('GET', COPY_ID), COPY_ID, h.deps)).status).toBe(200);
  });

  it('refuses a malformed DELETE body', async () => {
    const h = harness();
    for (const b of [{}, { base: 'x' }, { base: 0, extra: 1 }]) expect((await deleteRoute(req('DELETE', COPY_ID, b), COPY_ID, h.deps)).status).toBe(400);
  });
});

describe('the plans:write quota', () => {
  it('is its own block, keyed per user, at the contract rate', () => {
    expect(PLANS_LIMITS.write.bucket).toBe(ACCOUNT_PLANS_QUOTA_BUCKET);
    expect(PLANS_LIMITS.write.windows).toEqual([{ windowS: 60, limit: PLAN_SYNC.writesPerMinute }]);
  });

  it('answers 429 with Retry-After after the minute limit, per user, and stores only a hash of the user id', async () => {
    const takes: unknown[] = [];
    const mem = createMemoryQuotaStore();
    const quota: QuotaStore = { take: (r) => (takes.push(r), mem.take(r)), peek: mem.peek };
    const h = harness({ quota: () => quota });
    for (let i = 0; i < PLAN_SYNC.writesPerMinute; i++) {
      const r = await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps);
      expect(r.status).toBe(404);
    }
    const limited = await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await json(limited)).toEqual({ code: PLAN_CODES.rateLimited });
    // reads take nothing
    expect((await listRoute(req('GET'), h.deps)).status).toBe(200);
    // another user has a bucket of its own
    h.as(B);
    expect((await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, h.deps)).status).toBe(404);
    const keys = new Set(takes.flatMap((t) => (t as { key: string; bucket: string }[]).map((r) => `${r.bucket}|${r.key}`)));
    expect(keys.size).toBe(2);
    for (const k of keys) {
      expect(k).toMatch(/^plans:write\|[0-9a-f]{32}$/);
      expect(k).not.toContain('user-');
    }
  });

  it('fails closed in production without the store or the secret, and when the store is down', async () => {
    const noSecret = harness({ env: () => ({ NODE_ENV: 'production' }) });
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, noSecret.deps)).status).toBe(503);
    const noStore = harness({ quota: () => null, env: () => ({ NODE_ENV: 'production', AUTH_QUOTA_SECRET: SECRET }) });
    expect((await mergeRoute(req('POST', 'merge', []), noStore.deps)).status).toBe(503);
    const down: QuotaStore = { take: async () => { throw new Error('down'); }, peek: async () => 0 };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = harness({ quota: () => down });
    expect((await deleteRoute(req('DELETE', COPY_ID, { base: 0 }), COPY_ID, broken.deps)).status).toBe(503);
    expect(noSecret.calls).toEqual([]);
    expect(err).toHaveBeenCalled();
    // locally (dev, tests) a missing store is skipped
    const local = harness({ quota: () => null, env: () => ({ NODE_ENV: 'development' }) });
    expect((await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, local.deps)).status).toBe(201);
  });
});

describe('the sign-in merge', () => {
  const C2 = 'a3c5e7f9-1b2d-4f6a-8c0e-2a4b6c8d0e1f';
  const C3 = 'c1d2e3f4-a5b6-4c7d-9e8f-0a1b2c3d4e5f';

  it('inserts the device copies once (idempotent on the id) and answers the contract', async () => {
    const h = harness();
    const copies = [copyOf(), copyOf({ slug: 'canadian-rockies-2029', title: 'Canadian Rockies', cc: 'CA', days: 15, start: '2027-06-25', added: [] }, C2)];
    const first = await mergeRoute(req('POST', 'merge', copies), h.deps);
    expect(first.status).toBe(200);
    const a = accountPlanMergeAnswer.parse(await first.json());
    expect(a.inserted.sort()).toEqual([COPY_ID, C2].sort());
    expect(h.rows.get(COPY_ID)).toMatchObject({ kind: 'template', source_trip: 'dolomites-2027', title: 'Dolomites', start: '2027-07-03', days: 14 });
    expect(parsePlanDraft(h.rows.get(C2)!.doc).success).toBe(true);

    const again = accountPlanMergeAnswer.parse(await (await mergeRoute(req('POST', 'merge', copies), h.deps)).json());
    expect(again.inserted).toEqual([]);
    expect(again.already.sort()).toEqual([COPY_ID, C2].sort());
    expect(h.rows.size).toBe(2);
  });

  it('M3: same trip and start skips identical content and keeps different content beside it, titled from this device', async () => {
    const h = harness();
    await mergeRoute(req('POST', 'merge', [copyOf()]), h.deps);
    const same = accountPlanMergeAnswer.parse(await (await mergeRoute(req('POST', 'merge', [copyOf({}, C2)]), h.deps)).json());
    expect(same.sameTrip).toEqual([C2]);
    expect(h.rows.has(C2)).toBe(false);

    const differs = accountPlanMergeAnswer.parse(await (await mergeRoute(req('POST', 'merge', [copyOf({ overrides: { '5': 'B' } }, C3)]), h.deps)).json());
    expect(differs.inserted).toEqual([C3]);
    expect(differs.both).toEqual([C3]);
    expect(h.rows.get(C3)?.title).toMatch(/\(from this device\)$/);
  });

  it('maps a dated legacy slug to its public alias, refuses a trip that is not public, and leaves copies over the cap', async () => {
    const h = harness({ cap: 1 });
    const legacy = copyOf({ slug: 'canadian-rockies-sept-2029', title: 'Canadian Rockies', cc: 'CA', days: 15, start: '2029-09-01', added: [] }, C2);
    const hidden = copyOf({ slug: 'vermont-fall-2026', title: 'Vermont', cc: 'US', days: 4, start: '2026-10-10', added: [] }, C3);
    const a = accountPlanMergeAnswer.parse(await (await mergeRoute(req('POST', 'merge', [copyOf(), legacy, hidden]), h.deps)).json());
    expect(a.refused).toEqual([C3]);
    expect(a.inserted.length + a.overCap.length).toBe(2);
    expect(a.overCap.length).toBe(1);
    const kept = h.rows.get(a.inserted[0]!)!;
    if (a.inserted[0] === C2) expect(kept.source_trip).toBe('canadian-rockies-2029');
    for (const r of h.rows.values()) expect(JSON.stringify(r.doc)).not.toContain('sept-2029');
  });

  it('refuses a body that is not a list of copies, and answers an empty list without touching the database', async () => {
    const h = harness();
    expect((await mergeRoute(req('POST', 'merge', { items: [] }), h.deps)).status).toBe(400);
    expect((await mergeRoute(req('POST', 'merge', [{ id: COPY_ID }]), h.deps)).status).toBe(400);
    const tooMany = Array.from({ length: ACCOUNT_PLANS_LIMITS.mergeCopies + 1 }, () => copyOf());
    expect((await mergeRoute(req('POST', 'merge', tooMany), h.deps)).status).toBeGreaterThanOrEqual(400);
    const none = await mergeRoute(req('POST', 'merge', []), h.deps);
    expect(await none.json()).toEqual({ inserted: [], already: [], sameTrip: [], both: [], overCap: [], refused: [] });
    expect(h.calls).toEqual([]);
  });

  it('does not report a copy whose id another user holds as merged', async () => {
    const h = harness();
    await mergeRoute(req('POST', 'merge', [copyOf()]), h.deps);
    h.as(B);
    const a = accountPlanMergeAnswer.parse(await (await mergeRoute(req('POST', 'merge', [copyOf()]), h.deps)).json());
    expect(a.inserted).toEqual([]);
    expect(a.already).toEqual([]);
    expect(a.refused).toEqual([COPY_ID]);
  });
});

describe('answers and logs', () => {
  it('every answer is private and never cached', async () => {
    const h = harness();
    for (const r of [
      await listRoute(req('GET'), h.deps),
      await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps),
      await getRoute(req('GET', COPY_ID), COPY_ID, h.deps),
      await getRoute(req('GET', ID2), ID2, h.deps),
      await mergeRoute(req('POST', 'merge', []), h.deps),
    ]) {
      expect(r.headers.get('Cache-Control')).toBe('private, no-store');
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  it('a database failure answers 503 and logs the route, a fixed outcome and the SQLSTATE only', async () => {
    const h = harness();
    const boom = Object.assign(new Error(`relation "planner_draft" ${A.id} Dolomites 2027-07-03`), { code: '57P01' });
    h.deps.db.put = async () => { throw boom; };
    h.deps.db.list = async () => { throw boom; };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await putRoute(req('PUT', COPY_ID, putBody(templateDraft())), COPY_ID, h.deps);
    expect(r.status).toBe(503);
    expect(await json(r)).toEqual({ code: PLAN_CODES.unavailable });
    expect((await listRoute(req('GET'), h.deps)).status).toBe(503);
    const logged = err.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('57P01');
    for (const s of [A.id, 'Dolomites', '2027-07-03', 'travellers', COPY_ID]) expect(logged).not.toContain(s);
  });
});
