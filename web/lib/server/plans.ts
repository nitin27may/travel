import 'server-only';

// The account plan routes (`/api/account/plans/**`; edit-my-trip.md 4.1, 4.2, 4.5, 7; task EM-1). A signed-in person's copies of our
// trips and builder plans, kept in their account: the light list, one document, the revision-checked write, the tombstone and the
// sign-in merge. The route files only call the handlers here; every rule lives in this file, the route contract
// (core/src/schema/api/account-plans.ts) and the database module (core/src/db/plans.ts).
//
// SECURITY, in the order each handler applies it:
//   1. the flag `accountTrips` (NEXT_PUBLIC_ACCOUNT_TRIPS=1 with NEXT_PUBLIC_SIGN_IN=1); off answers 404 before anything is read;
//   2. same origin (the account routes' rule, lib/server/same-origin.ts);
//   3. a verified session (`getUser()`); the user id comes ONLY from it, never from a path, a query or a body;
//   4. writes: `application/json` only, the body read in pieces up to its cap (16 KB + 1 KB for a PUT, 256 B for a DELETE, 84 KB for
//      the merge), then the per-user `plans:write` bucket (HMAC of the user id; a minute, an hour and a day window; fail closed in
//      production): one unit for a PUT or DELETE, one per copy for a merge (review-em-s S5), taken before any database work;
//   5. the WHOLE document parsed on every write (R5), its id equal to the path's, its light columns derived from it here, a template's
//      trip re-read from the catalogue (public and listed, else refused) and its row title taken from there unless the person set one;
//   6. owner-only RLS underneath (core/src/db/tx.ts), and ids per user (0013's key is (user_id, id); review-em-s S1): no answer depends
//      on another account's rows, so none says whether another account holds an id.
// Answers are `private, no-store`, carry fixed codes only, and are never routed through the public respond() (no allow-list, ETag or
// cache there knows these bodies). Logs name the route, the outcome and at most a SQLSTATE: never a user id, a title or a document,
// and every log line passes LOG_DENY_KEYS (core/src/privacy/detect.ts) as a second net (review-em-s S7).
// No Realtime: the device refetches (EM7).
//
// This file imports the plan document and the plan mapper, so it is one of the builder fence's extension points
// (web/tests/plan/isolation.test.ts EXTENSION_IMPORTERS, X-EM1).
import { getUser, type SessionUser } from '@/lib/auth/server';
import { folderAliases } from '@/lib/public/aliases';
import { safeError } from './safe-error';
import { sameOrigin } from './same-origin';
import { getStore } from './store';
import { publicRef } from '@travel/core/catalogue/alias.ts';
import { PLANS_LIMITS } from '@travel/core/config/auth-limits.ts';
import { LOG_DENY_KEYS } from '@travel/core/privacy/detect.ts';
import {
  deletePlan,
  getPlan,
  insertPlans,
  listPlans,
  mergeKeys,
  putPlan,
  type DeleteResult,
  type MergeInsertResult,
  type PlanMergeKey,
  type PlanWrite,
  type PutResult,
} from '@travel/core/db/plans.ts';
import { draftContentKey, planCopyMerge, planRowFields, type AccountPlanKey, type PlanRow } from '@travel/core/plan/doc.ts';
import { userHash } from '@travel/core/quota/keys.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';
import {
  ACCOUNT_PLANS_LIMITS,
  accountPlanId,
  parseAccountPlanDelete,
  parseAccountPlanPut,
  type AccountPlanMergeAnswer,
  type AccountPlanRow,
} from '@travel/core/schema/api/account-plans.ts';
import { parseCopyList } from '@travel/core/schema/copies.ts';
import { parsePlanDraft, PLAN_DRAFT_SCHEMA, type PlanDraft } from '@travel/core/schema/plan-draft.ts';

/** The fixed codes these routes answer with (`{ code }`, plus `issues` on a validation error). */
export const PLAN_CODES = {
  notFound: 'NOT_FOUND',
  forbidden: 'FORBIDDEN',
  unauthenticated: 'UNAUTHENTICATED',
  badRequest: 'BAD_REQUEST',
  mediaType: 'UNSUPPORTED_MEDIA_TYPE',
  tooLarge: 'PAYLOAD_TOO_LARGE',
  invalid: 'VALIDATION_ERROR',
  schema: 'UNSUPPORTED_SCHEMA',
  tripNotPublic: 'TRIP_NOT_PUBLIC',
  cap: 'PLAN_CAP',
  rateLimited: 'RATE_LIMITED',
  unavailable: 'SERVICE_UNAVAILABLE',
} as const;
export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

/** Most validation issues one answer lists (each is a path and a rule, never a value). */
const MAX_ISSUES = 20;

/** What the catalogue says of a public, listed trip. */
export interface PublicTripFacts {
  title: string;
  /** ISO 3166-1 alpha-2, or null when the catalogue does not say */
  cc: string | null;
  days: number | null;
}

/** Everything a handler reaches outside itself; tests pass their own. */
export interface PlansDeps {
  enabled(): boolean;
  user(): Promise<SessionUser | null>;
  db: {
    list: (userId: string) => Promise<AccountPlanRow[]>;
    get: (userId: string, id: string) => Promise<{ revision: number; doc: unknown } | null>;
    put: (userId: string, id: string, base: number | null, restore: boolean, w: PlanWrite) => Promise<PutResult>;
    del: (userId: string, id: string, base: number) => Promise<DeleteResult>;
    mergeKeys: (userId: string, pairs: readonly { trip: string; start: string }[]) => Promise<PlanMergeKey[]>;
    insert: (userId: string, rows: readonly ({ id: string } & PlanWrite)[]) => Promise<MergeInsertResult>;
  };
  /** The quota store, or null when DATABASE_URL is unset. */
  quota(): QuotaStore | null;
  env(): { NODE_ENV?: string; AUTH_QUOTA_SECRET?: string; ACCOUNT_TRIPS_WRITES?: string };
  /** The public, listed trips by slug. */
  trips(): Promise<ReadonlyMap<string, PublicTripFacts>>;
  /** A dated legacy folder as its public alias (public-ref-aliases 4); anything else unchanged. */
  aliasOf(slug: string): string;
  now(): Date;
}

/**
 * The `accountTrips` flag (edit-my-trip 8, Q-EM3): `NEXT_PUBLIC_ACCOUNT_TRIPS=1`, and only where sign-in is on. Off by default. The
 * `NEXT_PUBLIC_` names are written out so a Next build inlines them (the client sync, EM-2, reads the same name) and tests can stub
 * them. Kept out of lib/capabilities.ts here: EM-2 owns the client side of the flag.
 */
export function accountTripsOn(env: { signIn?: string; accountTrips?: string } = {
  signIn: process.env.NEXT_PUBLIC_SIGN_IN,
  accountTrips: process.env.NEXT_PUBLIC_ACCOUNT_TRIPS,
}): boolean {
  return env.signIn === '1' && env.accountTrips === '1';
}

// ----- answers ---------------------------------------------------------------------------------------------------------------------------

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } as const;

/** Every answer of these routes: private, never cached. */
export function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...PRIVATE, ...headers } });
}
const fail = (status: number, code: PlanCode, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response =>
  reply(status, { code, ...extra }, headers);

type RouteName = 'list' | 'get' | 'put' | 'delete' | 'merge';

const DENY = new Set(LOG_DENY_KEYS.map((k) => k.toLowerCase()));

/** One log line: the route, a fixed outcome, at most a SQLSTATE (safeError). Never a user id, a title or a document; a deny-listed key is dropped. */
function log(level: 'warn' | 'error', route: RouteName, outcome: string, e?: unknown): void {
  const fields: Record<string, unknown> = { route, outcome, ...(e === undefined ? {} : { error: safeError(e) }) };
  for (const k of Object.keys(fields)) if (DENY.has(k.toLowerCase())) delete fields[k];
  console[level]('[account-plans]', JSON.stringify(fields));
}

// ----- the gates -------------------------------------------------------------------------------------------------------------------------

/** Flag, origin, session: the user, or the answer that ends the request. */
async function gate(request: Request, deps: PlansDeps): Promise<SessionUser | Response> {
  if (!deps.enabled()) return fail(404, PLAN_CODES.notFound);
  if (!sameOrigin(request)) return fail(403, PLAN_CODES.forbidden);
  const user = await deps.user();
  if (!user) return fail(401, PLAN_CODES.unauthenticated);
  return user;
}

/** The body as text, read in pieces up to `max` bytes; null when it is longer. */
export async function boundedText(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

const isJson = (request: Request): boolean => /^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')?.trim() ?? '');

/** A write's JSON body under its cap, or the answer that ends the request. */
async function jsonBody(request: Request, max: number): Promise<{ value: unknown } | Response> {
  if (!isJson(request)) return fail(415, PLAN_CODES.mediaType);
  let text: string | null;
  try {
    text = await boundedText(request, max);
  } catch {
    return fail(400, PLAN_CODES.badRequest);
  }
  if (text === null) return fail(413, PLAN_CODES.tooLarge);
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return fail(400, PLAN_CODES.badRequest);
  }
}

/**
 * `units` takes from the user's `plans:write` bucket (every window each time); null to go on, or the answer. A merge passes one per copy
 * (S5), so it costs what the writes it may make would cost: the quota store takes one unit per call, so the units are taken one after
 * another, stopping at the first refusal (the units already counted stay counted: a refused merge is not free). Fails closed in
 * production.
 */
async function takeWrite(route: RouteName, userId: string, deps: PlansDeps, units = 1): Promise<Response | null> {
  const env = deps.env();
  // The runtime kill switch (review-em-s N9): the flag is inlined at build, so turning writes off without a rebuild is this
  // server-only variable, read per request. Reads stay up; every write answers 503 before any database work.
  if (env.ACCOUNT_TRIPS_WRITES === '0') {
    log('warn', route, 'writes_off');
    return fail(503, PLAN_CODES.unavailable);
  }
  const secret = env.AUTH_QUOTA_SECRET;
  const store = deps.quota();
  if (!store || !secret || secret.length < 16) {
    if (env.NODE_ENV === 'production') {
      log('error', route, 'quota_not_configured');
      return fail(503, PLAN_CODES.unavailable);
    }
    return null; // a local run without the quota store (dev, tests)
  }
  const { bucket, windows } = PLANS_LIMITS.write;
  const key = userHash(secret, userId, deps.now());
  const rules = windows.map((w) => ({ bucket, key, windowS: w.windowS, limit: w.limit }));
  try {
    for (let i = 0; i < units; i++) {
      const r = await store.take(rules);
      if (!r.allowed) return fail(429, PLAN_CODES.rateLimited, {}, { 'Retry-After': String(r.retryAfterS) });
    }
    return null;
  } catch (e) {
    log('error', route, 'quota_unavailable', e);
    return fail(503, PLAN_CODES.unavailable);
  }
}

const issues = (list: readonly string[]) => ({ issues: list.slice(0, MAX_ISSUES) });
const validId = (id: string): boolean => accountPlanId.safeParse(id).success;
const clipTitle = (t: string): string => t.slice(0, ACCOUNT_PLANS_LIMITS.titleMax);

/**
 * The row a document becomes: its light columns (planRowFields) and the title the list shows. A template's trip must be public and
 * listed; its title is the person's own, else the catalogue's current title (never the client's).
 */
function rowOf(doc: PlanDraft, clientTitle: string, trips: ReadonlyMap<string, PublicTripFacts>): PlanWrite | null {
  const f = planRowFields(doc);
  if (f.kind === 'template') {
    const trip = f.source_trip === null ? undefined : trips.get(f.source_trip);
    if (!trip) return null;
    return { ...f, title: clipTitle(doc.title ?? trip.title), doc };
  }
  return { ...f, title: clipTitle(doc.title ?? clientTitle), doc };
}

// ----- handlers ----------------------------------------------------------------------------------------------------------------------------

/** `GET /api/account/plans`: the light rows, live and the tombstones of the last 30 days (never a document). */
export async function listRoute(request: Request, deps: PlansDeps = defaultPlansDeps()): Promise<Response> {
  const user = await gate(request, deps);
  if (user instanceof Response) return user;
  try {
    return reply(200, { items: await deps.db.list(user.id) });
  } catch (e) {
    log('error', 'list', 'db_failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
}

/** `GET /api/account/plans/{id}`: `{ revision, doc }`; 404 for an id the caller does not hold, a tombstone, or a titled draft. */
export async function getRoute(request: Request, id: string, deps: PlansDeps = defaultPlansDeps()): Promise<Response> {
  const user = await gate(request, deps);
  if (user instanceof Response) return user;
  if (!validId(id)) return fail(404, PLAN_CODES.notFound);
  try {
    const row = await deps.db.get(user.id, id);
    return row ? reply(200, { revision: row.revision, doc: row.doc }) : fail(404, PLAN_CODES.notFound);
  } catch (e) {
    log('error', 'get', 'db_failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
}

/** `PUT /api/account/plans/{id}` `{ base, title, doc, restore? }`: `{ revision }`, `409` with the row, `409 PLAN_CAP`, or `404`. */
export async function putRoute(request: Request, id: string, deps: PlansDeps = defaultPlansDeps()): Promise<Response> {
  const user = await gate(request, deps);
  if (user instanceof Response) return user;
  if (!validId(id)) return fail(404, PLAN_CODES.notFound);
  const body = await jsonBody(request, ACCOUNT_PLANS_LIMITS.putBodyBytes);
  if (body instanceof Response) return body;
  const limited = await takeWrite('put', user.id, deps);
  if (limited) return limited;

  const schema = (body.value as { doc?: { schema?: unknown } } | null)?.doc?.schema;
  if (typeof schema === 'string' && /^plan-draft\/\d+$/.test(schema) && schema !== PLAN_DRAFT_SCHEMA) return fail(422, PLAN_CODES.schema);
  const parsed = parseAccountPlanPut(body.value, id, parsePlanDraft);
  if (!parsed.success) return fail(400, PLAN_CODES.invalid, issues(parsed.issues));
  const { base, title, restore, doc } = parsed.data;

  let write: PlanWrite | null;
  try {
    write = rowOf(doc, title, await deps.trips());
  } catch (e) {
    log('error', 'put', 'catalogue_failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
  if (!write) return fail(422, PLAN_CODES.tripNotPublic);

  let r: PutResult;
  try {
    r = await deps.db.put(user.id, id, base, restore, write);
  } catch (e) {
    log('error', 'put', 'db_failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
  switch (r.kind) {
    case 'written':
      return reply(r.created ? 201 : 200, { revision: r.revision });
    case 'conflict':
      return reply(409, { revision: r.row.revision, doc: r.row.doc, deleted_at: r.row.deleted_at });
    case 'cap':
      return fail(409, PLAN_CODES.cap);
    case 'not-found':
      return fail(404, PLAN_CODES.notFound);
  }
}

/** `DELETE /api/account/plans/{id}` `{ base }`: the tombstone; `{ revision }`, `409` with the row, or `404`. Idempotent. */
export async function deleteRoute(request: Request, id: string, deps: PlansDeps = defaultPlansDeps()): Promise<Response> {
  const user = await gate(request, deps);
  if (user instanceof Response) return user;
  if (!validId(id)) return fail(404, PLAN_CODES.notFound);
  const body = await jsonBody(request, ACCOUNT_PLANS_LIMITS.deleteBodyBytes);
  if (body instanceof Response) return body;
  const limited = await takeWrite('delete', user.id, deps);
  if (limited) return limited;
  const parsed = parseAccountPlanDelete(body.value);
  if (!parsed.success) return fail(400, PLAN_CODES.invalid, issues(parsed.issues));

  let r: DeleteResult;
  try {
    r = await deps.db.del(user.id, id, parsed.data.base);
  } catch (e) {
    log('error', 'delete', 'db_failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
  switch (r.kind) {
    case 'deleted':
    case 'already':
      return reply(200, { revision: r.revision });
    case 'conflict':
      return reply(409, { revision: r.row.revision, doc: r.row.doc, deleted_at: r.row.deleted_at });
    case 'not-found':
      return fail(404, PLAN_CODES.notFound);
  }
}

/**
 * `POST /api/account/plans/merge` with the device's `copies/1` items (at most 20): which copies the account now holds (4.2 M1 to M4).
 * The device passes `inserted`, `already` and `sameTrip` to `markMerged`; `overCap` and `refused` stay on the device.
 */
export async function mergeRoute(request: Request, deps: PlansDeps = defaultPlansDeps()): Promise<Response> {
  const user = await gate(request, deps);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, ACCOUNT_PLANS_LIMITS.mergeBodyBytes);
  if (body instanceof Response) return body;
  const limited = await takeWrite('merge', user.id, deps, mergeUnits(body.value));
  if (limited) return limited;
  const copies = parseCopyList(body.value);
  if (!copies.success) return fail(400, PLAN_CODES.invalid, issues(copies.issues));
  const empty: AccountPlanMergeAnswer = { inserted: [], already: [], sameTrip: [], both: [], overCap: [], refused: [] };
  if (copies.data.length === 0) return reply(200, empty);

  try {
    const trips = await deps.trips();
    const publicSlug = (s: string): string | null => {
      if (trips.has(s)) return s;
      const a = deps.aliasOf(s);
      return trips.has(a) ? a : null;
    };
    // M3 compares a copy with the account rows of the same trip and start; an undated copy (copies/2) matches none (the rows with no
    // start are not read), so it is always inserted as its own row: never lost, at worst beside an undated row of the same trip
    const pairs = copies.data.flatMap((c) => {
      const trip = publicSlug(c.slug);
      return trip === null || c.start === null ? [] : [{ trip, start: c.start }];
    });
    const keys = await deps.db.mergeKeys(user.id, pairs);
    const account: AccountPlanKey[] = keys.map((k) => ({ id: k.id, source_trip: k.source_trip, start: k.start, content: contentOf(k.doc) }));
    const plan = planCopyMerge(copies.data, account, {
      publicSlug,
      facts: (s) => {
        const t = trips.get(s);
        return t && t.cc && t.days ? { cc: t.cc, days: t.days } : null;
      },
      cap: ACCOUNT_PLANS_LIMITS.accountPlans,
    });
    if (!plan.success) return fail(400, PLAN_CODES.invalid, issues(plan.issues));
    const rows = plan.data.insert.map((r: PlanRow) => {
      const trip = r.source_trip === null ? undefined : trips.get(r.source_trip);
      return { id: r.id, title: clipTitle(r.doc.title ?? trip?.title ?? r.title), doc: r.doc, kind: r.kind, source_trip: r.source_trip, start: r.start, days: r.days };
    });
    const done = await deps.db.insert(user.id, rows);
    const inserted = new Set(done.inserted);
    const answer: AccountPlanMergeAnswer = {
      inserted: done.inserted,
      already: [...plan.data.already, ...done.already],
      sameTrip: plan.data.sameTrip,
      both: plan.data.both.filter((id) => inserted.has(id)),
      overCap: [...plan.data.overCap, ...done.overCap],
      refused: [...plan.data.refused, ...done.refused],
    };
    return reply(200, answer);
  } catch (e) {
    log('error', 'merge', 'failed', e);
    return fail(503, PLAN_CODES.unavailable);
  }
}

/** What a merge costs in `plans:write` units (S5): one per copy it carries, at least one, at most the copies one merge may hold. */
export function mergeUnits(body: unknown): number {
  const n = Array.isArray(body) ? body.length : 1;
  return Math.min(Math.max(1, n), ACCOUNT_PLANS_LIMITS.mergeCopies);
}

/** A stored document's M3 content key: null for no document, one that no longer parses, or a built draft. */
function contentOf(doc: unknown): string | null {
  if (doc === null || doc === undefined) return null;
  const d = parsePlanDraft(doc);
  return d.success ? draftContentKey(d.data) : null;
}

// ----- the real dependencies ---------------------------------------------------------------------------------------------------------------

let pgStore: QuotaStore | undefined;
const tripsMemo = new WeakMap<object, Promise<ReadonlyMap<string, PublicTripFacts>>>();

/** The public, listed trips of the one catalogue store, read once per store (the catalogue is fixed for a process). */
async function readTrips(): Promise<ReadonlyMap<string, PublicTripFacts>> {
  const store = getStore();
  let hit = tripsMemo.get(store);
  if (!hit) {
    hit = (async () => {
      const out = new Map<string, PublicTripFacts>();
      for (let page = 1; page < 100; page++) {
        const r = await store.listTrips({}, { page, pageSize: 100 });
        if (!r.ok) throw new Error(`listTrips ${r.error.code}`);
        for (const t of r.data.items) out.set(t.slug, { title: t.title, cc: t.country || null, days: t.days });
        if (page * r.data.pageSize >= r.data.total) break;
      }
      return out;
    })();
    hit.catch(() => tripsMemo.delete(store));
    tripsMemo.set(store, hit);
  }
  return hit;
}

export function defaultPlansDeps(): PlansDeps {
  return {
    enabled: () => accountTripsOn(),
    user: () => getUser(),
    db: {
      list: (u) => listPlans(u),
      get: (u, id) => getPlan(u, id),
      put: (u, id, base, restore, w) => putPlan(u, id, base, restore, w),
      del: (u, id, base) => deletePlan(u, id, base),
      mergeKeys: (u, pairs) => mergeKeys(u, pairs),
      insert: (u, rows) => insertPlans(u, rows),
    },
    quota: () => (process.env.DATABASE_URL ? (pgStore ??= createPgQuotaStore()) : null),
    env: () => ({ NODE_ENV: process.env.NODE_ENV, AUTH_QUOTA_SECRET: process.env.AUTH_QUOTA_SECRET, ACCOUNT_TRIPS_WRITES: process.env.ACCOUNT_TRIPS_WRITES }),
    trips: readTrips,
    aliasOf: (s) => publicRef(s, folderAliases()),
    now: () => new Date(),
  };
}
