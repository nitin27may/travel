import 'server-only';
import { ALERT_AFTER, AUTH_GUARD, AUTH_LIMITS, AUTH_METRICS, type Window } from '@travel/core/config/auth-limits.ts';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { sendOwnerAlert, type AlertEvent } from '@travel/core/mail/alert.ts';
import type { Mailer } from '@travel/core/mail/mailer.ts';
import { ACCOUNT_TRAVELLER_KEYS, BIRTH_KEY, LOG_DENY_KEYS } from '@travel/core/privacy/detect.ts';
import { quotaAlertBudget } from '@travel/core/quota/alert-budget.ts';
import { addressHash, addressIpHash, ipHash } from '@travel/core/quota/keys.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaRule, QuotaStore } from '@travel/core/quota/store.ts';
import { isIP } from 'node:net';
import { answerHoldMs, monotonicMs, sleep } from '@/lib/auth/answer-hold';
import { authFlagsNow, type AuthFlags } from '@/lib/auth/flags';
import { googleCallbacks } from '@/lib/auth/google';
import { revokeSessionsBefore } from '@/lib/auth/revoke';
import { clientIp } from '@/lib/server/client-ip';
import { getMailer, ownerEmail } from '@/lib/server/mailer';
import { sameOrigin } from '@/lib/server/same-origin';
import { turnstilePassed, verifyTurnstile } from '@/lib/server/turnstile';

/**
 * The auth proxy guard (EML-Q; email spec 5, 9 and 13). Every browser auth call passes `app/api/auth/[...path]/route.ts`, which hands
 * it here before Neon Managed Better Auth sees it. For the calls that send a mail, sign up, check a code or a password, in order:
 *
 *   1. same-origin guard (`lib/server/same-origin.ts`, unchanged): a foreign Origin is refused before any quota is used;
 *   2. body cap 4 KB, JSON object, the address trimmed and lower-cased (Neon refuses an address with spaces, EML-0 S4);
 *   3. Turnstile on every call that makes Neon send a code, and on sign-up;
 *   4. one atomic quota take for every bucket of the call (core/src/config/auth-limits.ts, Phase 1 values);
 *   5. forward to Neon, then fix the answer:
 *      - sends answer one fixed body whatever Neon said about the address (known and unknown look the same);
 *      - sign-up for an existing address answers exactly what a new one answers with Require Verification on (EML-0 U8: Neon's
 *        body leaked `role: null`), and a 422 USER_ALREADY_EXISTS becomes that same answer;
 *      - a successful reset by code signs out every older session (EML-0 W2: Neon keeps them);
 *      - Neon's 429 keeps a Retry-After (the SDK proxy drops Neon's `x-retry-after`);
 *      - a send Neon refuses (429 or 5xx) is counted and becomes SEND_FAILED, with owner alerts (first refusal of a day, three
 *        failures in an hour); our own global cap becomes SEND_UNAVAILABLE with an alert once a day;
 *   6. every answer of a send or sign-up route, refusals from step 2 on included, is held to a fixed minimum time plus jitter
 *      (AUTH_GUARD.answerMinMs, review SF5), so Neon answering faster when it sends nothing cannot tell addresses apart.
 *
 * Code and password checks key their tight per-address bucket on the address and the IP together, under a higher address-only
 * ceiling (SF3), so a guesser on one network cannot keep the owner of an address locked out.
 *
 * Allow-list (hotfix A1, review MF3): only the routes this site calls are proxied: `get-session` (GET), `sign-out` (POST), the
 * seven routes of the sign-in card (ROUTES) and, with the Google flag on, `sign-in/social` (SOCIAL, GSI-1). Every other path and method
 * answers 404 here, whatever plugins are switched on in the
 * Neon console (`organization`, `update-user`, `delete-user`, `forget-password`, `change-email`, ...). Every non-GET call must carry
 * a same-origin `Origin` header: a missing one is refused too (MF1), because a browser always sends it on a POST. This guards our
 * proxy only: Neon's Auth base URL is public and can be called directly, so the production branch must have Better Auth "Allow
 * Localhost" OFF and the `organization` plugin disabled in the Neon console (owner steps, review checklist items 1 and 2).
 *
 * Flags (MF4): with `NEXT_PUBLIC_SIGN_IN` off every path answers 404; with `NEXT_PUBLIC_SIGN_IN_CODE` off a code send of type
 * `sign-in` and `sign-in/email-otp` answer 404, so turning a flag off and redeploying really turns the server side off (spec 11.2).
 * Likewise `sign-in/social` answers 404 unless `NEXT_PUBLIC_SIGN_IN_GOOGLE` is on (Google spec 11, rollback step 1). That turns off our
 * button and this route only: Neon's own `sign-in/social` stays callable while the Google provider exists on the branch, so deleting
 * the provider in the Neon console is the real off switch (review GSI-S S5, spec 11 step 2).
 *
 * Continue with Google (GSI-1): `sign-in/social` takes the same origin check (a missing Origin refused) and body cap, then the body is
 * rebuilt by `googleCallbacks` (lib/auth/google.ts): provider `google` only, `callbackURL` always `<origin>/account/` with the checked
 * `next`, `errorCallbackURL` the starting page; no scope or other field passes. Outside NODE_ENV test and development `<origin>` is
 * SITE_ORIGIN, never the request's, and a request on any other host (another `*.vercel.app` URL of the project) is refused 403
 * (review GSI-S S1). It sends no mail, so no Turnstile (the button stays one press), but every call makes Neon write a state row in
 * our project, so it takes one per-network bucket (`socialIp`, review GSI-S B2) with the same fail-closed rule as the guarded routes.
 * Neon's 429 keeps a Retry-After. Neon's success answer (Google's address and the challenge cookie) is passed on unchanged; an error
 * answer carries Neon's code only.
 *
 * Bodies (SF1): each guarded body is rebuilt from that route's own field list (string values only); anything else, `callbackURL`
 * included (spec 5.1), never reaches Neon, and sign-up always sends `name: ''` (rule E8). Query strings (review GSI-S S2): the SDK
 * proxy copies the request's query onto Neon's URL, and Better Auth reads some values from it, so every forwarded request is rebuilt
 * without one; only `get-session` keeps `disableCookieCache` (QUERY_KEEP). The OAuth verifier exchange is not here: it runs in
 * `proxy.ts` on `/account/*` only.
 *
 * Password sign-in never sends mail through us (MF2): it takes no send bucket and needs no Turnstile, so the Neon setting "Send
 * verification email on sign-in" must stay false. The card asks for a confirmation code through the guarded send route instead.
 *
 * Fail closed: without the quota store or AUTH_QUOTA_SECRET, or without TURNSTILE_SECRET_KEY, guarded calls answer 503 in production; only
 * NODE_ENV test or development may skip them. `AUTH_GUARD=off` (spec 11.2 rollback) skips Turnstile, quotas and counters but keeps
 * steps 1, 2 and 5. Logs are one JSON line per decision with fixed codes only: never an address, a code, a token or an IP.
 *
 * Answers the sign-in card (EML-1) maps to its copy (spec 3.3), all `{ code, message }` with `Cache-Control: no-store`:
 *   403 FORBIDDEN (origin) · 400 VALIDATION_ERROR, INVALID_EMAIL · 413 BODY_TOO_LARGE · 403 TURNSTILE_FAILED ·
 *   503 TURNSTILE_UNAVAILABLE · 429 RATE_LIMITED (+ Retry-After) · 503 SEND_UNAVAILABLE (our cap) · 503 SEND_FAILED (Neon refused) ·
 *   503 GUARD_UNAVAILABLE · 404 NOT_FOUND (a route not offered in v1). Everything else is Neon's own answer.
 */

export type RouteCtx = { params: Promise<{ path: string[] }> };

type Kind = 'send' | 'signup' | 'verify' | 'reset' | 'password';

interface Route {
  id: string;
  kind: Kind;
  /** The fixed body of a successful send, whatever the address. */
  sendOk?: Record<string, unknown>;
  /** Counts as a verified code on success (sender monitoring). */
  verifies?: boolean;
}

interface GuardedRoute extends Route {
  /** The body fields forwarded to Neon (string values only); every other field is dropped (SF1). */
  fields: readonly string[];
  /** Answers 404 unless the code option is on (MF4). */
  codeOnly?: boolean;
}

/**
 * The guarded routes: exactly the seven the sign-in card calls (components/auth/api.ts), lower-case path under /api/auth/, POST only.
 * Not here, so 404: the legacy and link sends (`forget-password/email-otp`, `request-password-reset`, `send-verification-email`,
 * `sign-in/magic-link`), `email-otp/check-verification-otp`, change of email, and every plugin route.
 */
const ROUTES: Record<string, GuardedRoute> = {
  'email-otp/send-verification-otp': { id: 'send_otp', kind: 'send', sendOk: { success: true }, fields: ['email', 'type'] },
  'email-otp/request-password-reset': { id: 'reset_request', kind: 'send', sendOk: { success: true }, fields: ['email'] },
  'sign-up/email': { id: 'sign_up', kind: 'signup', fields: ['email', 'password'] },
  'sign-in/email': { id: 'sign_in_password', kind: 'password', fields: ['email', 'password'] },
  'sign-in/email-otp': { id: 'sign_in_code', kind: 'verify', verifies: true, fields: ['email', 'otp'], codeOnly: true },
  'email-otp/verify-email': { id: 'verify_email', kind: 'verify', verifies: true, fields: ['email', 'otp'] },
  'email-otp/reset-password': { id: 'reset_password', kind: 'reset', verifies: true, fields: ['email', 'otp', 'password'] },
};

/** Unguarded routes the site itself uses (the session read and sign-out), with the one method each accepts. */
const OPEN: Record<string, 'GET' | 'POST'> = { 'get-session': 'GET', 'sign-out': 'POST' };

/** The Google start (GSI-1), POST only, behind `signInGoogle`. Its own branch in `handle`: no address, no Turnstile, one IP bucket. */
const SOCIAL = 'sign-in/social';

/** The query parameters an open route may pass to Neon (S2); every other one, on every route, is dropped. */
const QUERY_KEEP: Record<string, readonly string[]> = { 'get-session': ['disableCookieCache'] };

/** The `type` values the send route accepts (spec 4.5); `change-email` is not offered. */
const OTP_TYPES = new Set(['sign-in', 'email-verification', 'forget-password']);

/** What sign-up answers for every address while verification is required: no token, no user (EML-0 U8). */
const SIGNUP_PENDING = { token: null, user: null };

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Forbidden',
  VALIDATION_ERROR: 'Invalid request',
  INVALID_EMAIL: 'Invalid email address',
  BODY_TOO_LARGE: 'Request too large',
  TURNSTILE_FAILED: 'Browser check failed',
  TURNSTILE_UNAVAILABLE: 'Browser check unavailable',
  RATE_LIMITED: 'Too many requests',
  SEND_UNAVAILABLE: 'Email sending is paused',
  SEND_FAILED: 'The email could not be sent',
  GUARD_UNAVAILABLE: 'Sign-in is unavailable right now',
  NOT_FOUND: 'Not found',
};

function answer(status: number, code: string, headers: Record<string, string> = {}): Response {
  return Response.json({ code, message: MESSAGES[code] ?? code }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Read at most `max` bytes of the body; null when it is larger. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
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
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function hostname(request: Request): string {
  const host = request.headers.get('host') ?? '';
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return '';
  }
}

/** The request's URL without its query, keeping only the `keep` parameters (S2: the SDK proxy copies the query onto Neon's URL). */
export function upstreamUrl(url: string, keep: readonly string[] = []): string {
  const u = new URL(url);
  const kept = new URLSearchParams();
  for (const k of keep) {
    const v = u.searchParams.get(k);
    if (v !== null) kept.set(k, v);
  }
  u.search = kept.toString();
  u.hash = '';
  return u.href;
}

/** A request for Neon with the rewritten body and no query string; the Turnstile token stays here. */
function rebuild(request: Request, body: string): Request {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('x-turnstile-token');
  headers.set('content-type', 'application/json');
  return new Request(upstreamUrl(request.url), { method: request.method, headers, body });
}

/** The SQLSTATE of a quota store failure only (pg.ts puts nothing else in the message): 42P01 or 42883 mean migration 0011 is missing (SF7). */
function sqlstateOf(e: unknown): string | undefined {
  return /sqlstate=([0-9A-Za-z]{5})\)/.exec(e instanceof Error ? e.message : '')?.[1];
}

/** SITE_ORIGIN as an origin, or null when it is unset or not a URL (S1: production never falls back to the request's host). */
function configuredOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const origin = new URL(raw.trim()).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** The pending sign-up answer, built fresh: no header of Neon's (a cookie or request id on one branch only) can tell addresses apart (SF2). */
function signupPending(): Response {
  return Response.json(SIGNUP_PENDING, { status: 200, headers: NO_STORE });
}

function withHeader(upstream: Response, name: string, value: string): Response {
  const headers = new Headers(upstream.headers);
  headers.set(name, value);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

async function jsonOf(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v = await res.clone().json();
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Neon's error code when it is a plain token, else a generic one; Neon's message is never passed on from a send (it may echo input). */
function safeCode(body: Record<string, unknown> | null, fallback: string): string {
  const code = body?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : fallback;
}

// ----- logging ---------------------------------------------------------------------------------------------------------------------

type LogValue = string | number | boolean | undefined;
// The log deny list plus every key of the saved travellers the detector refuses (`ageAsOf`, `travellersConsentedAt`, ...) and any
// `birth*` key (BIRTH_KEY), so the guard's log matches the detector (review ACCT-PSEC N6).
const DENY = new Set([...LOG_DENY_KEYS, ...ACCOUNT_TRAVELLER_KEYS].map((k) => k.toLowerCase()));
/** A key whose value never reaches a guard log line. */
export const deniedLogKey = (k: string): boolean => DENY.has(k.toLowerCase()) || BIRTH_KEY.test(k);

/** One JSON line with fixed codes. A deny-listed key, or a value that looks like an address, a code or an IP, is dropped. */
export function guardLog(level: 'info' | 'warn' | 'error', fields: Record<string, LogValue>): void {
  const safe: Record<string, LogValue> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || deniedLogKey(k)) continue;
    if (typeof v === 'string' && (v.includes('@') || /\d{6}/.test(v) || isIP(v) !== 0 || v.length > 80)) continue;
    safe[k] = v;
  }
  console[level]('[auth-guard]', JSON.stringify(safe));
}

// ----- dependencies ----------------------------------------------------------------------------------------------------------------

export interface GuardDeps {
  /** Neon Auth through the SDK proxy (`getAuth().handler()`). */
  upstream(request: Request, ctx: RouteCtx): Promise<Response>;
  /** The quota store, or null when DATABASE_URL is unset. */
  quota(): QuotaStore | null;
  mailer(): Mailer;
  ownerEmail(): string | undefined;
  revokeSessions(email: string, before: Date): Promise<number>;
  env(): { NODE_ENV?: string; AUTH_GUARD?: string; AUTH_QUOTA_SECRET?: string; TURNSTILE_SECRET_KEY?: string; SITE_ORIGIN?: string };
  now(): Date;
  /** The sign-in flags (lib/auth/flags.ts), read per call. */
  flags(): AuthFlags;
  /** Cloudflare's siteverify (tests inject a fake). */
  turnstileFetch?: typeof fetch;
  /** The answer hold (SF5): a monotonic clock in ms, a wait, and a random number in [0, 1) for the jitter. */
  clockMs(): number;
  sleep(ms: number): Promise<void>;
  random(): number;
}

let pgStore: QuotaStore | undefined;

export function defaultGuardDeps(upstream: GuardDeps['upstream']): GuardDeps {
  return {
    upstream,
    quota: () => (process.env.DATABASE_URL ? (pgStore ??= createPgQuotaStore()) : null),
    mailer: getMailer,
    ownerEmail,
    revokeSessions: revokeSessionsBefore,
    env: () => ({
      NODE_ENV: process.env.NODE_ENV,
      AUTH_GUARD: process.env.AUTH_GUARD,
      AUTH_QUOTA_SECRET: process.env.AUTH_QUOTA_SECRET,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
      SITE_ORIGIN: process.env.SITE_ORIGIN,
    }),
    now: () => new Date(),
    flags: authFlagsNow,
    clockMs: monotonicMs,
    sleep,
    random: () => Math.random(),
  };
}

// ----- the guard -------------------------------------------------------------------------------------------------------------------

function rules(limit: { bucket: string; windows: readonly Window[] }, key: string): QuotaRule[] {
  return limit.windows.map((w) => ({ bucket: limit.bucket, key, windowS: w.windowS, limit: w.limit }));
}

function rulesFor(kind: Kind, addr: string, ip: string, addrIp: string): QuotaRule[] {
  switch (kind) {
    case 'send':
      return [...rules(AUTH_LIMITS.sendAddr, addr), ...rules(AUTH_LIMITS.sendIp, ip), ...rules(AUTH_LIMITS.sendGlobal, '')];
    case 'signup':
      // With Require Verification on, a sign-up sends a code, so it also takes from the send buckets (one take, at most 8 rules).
      return [...rules(AUTH_LIMITS.signupIp, ip), ...rules(AUTH_LIMITS.sendAddr, addr), ...rules(AUTH_LIMITS.sendGlobal, '')];
    case 'verify':
    case 'reset':
      return [...rules(AUTH_LIMITS.verifyAddrIp, addrIp), ...rules(AUTH_LIMITS.verifyAddr, addr), ...rules(AUTH_LIMITS.verifyIp, ip)];
    case 'password':
      return [...rules(AUTH_LIMITS.passwordAddrIp, addrIp), ...rules(AUTH_LIMITS.passwordAddr, addr), ...rules(AUTH_LIMITS.passwordIp, ip)];
  }
}

export type Classified = { path: string; route: GuardedRoute } | { path: string; open: 'GET' | 'POST' } | { path: string; social: true } | null;

/** What a path is: a guarded route, an open one (with its method), the Google start, or null: not offered here, 404 (MF3). */
export function classify(path: readonly string[]): Classified {
  if (path.length === 0 || path.some((s) => s === '' || s === '.' || s === '..')) return null;
  const p = path.join('/').toLowerCase();
  if (Object.hasOwn(ROUTES, p)) return { path: p, route: ROUTES[p] };
  if (Object.hasOwn(OPEN, p)) return { path: p, open: OPEN[p] };
  if (p === SOCIAL) return { path: p, social: true };
  return null;
}

/** The body Neon gets: only the route's own fields with string values; sign-up always without a name (E8). */
function allowedBody(route: GuardedRoute, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of route.fields) if (typeof body[f] === 'string') out[f] = body[f];
  if (route.kind === 'signup') out.name = '';
  return out;
}

/** A non-GET call needs an Origin header that matches the host: missing counts as foreign (MF1). */
function originOk(request: Request): boolean {
  return request.headers.get('origin') !== null && sameOrigin(request);
}

export function createAuthGuard(deps: GuardDeps) {
  async function count(store: QuotaStore | null, metric: { bucket: string; windowS: number }[]): Promise<number[] | null> {
    if (!store) return null;
    try {
      const r = await store.take(metric.map((m) => ({ bucket: m.bucket, key: '', windowS: m.windowS, limit: null })));
      return r.counts;
    } catch {
      guardLog('warn', { event: 'metric_unavailable' });
      return null;
    }
  }

  async function alert(store: QuotaStore | null, event: AlertEvent): Promise<void> {
    if (!store) return;
    const result = await sendOwnerAlert(event, { mailer: deps.mailer(), budget: quotaAlertBudget(store, deps.now), ownerEmail: deps.ownerEmail(), now: deps.now() });
    guardLog(result.sent ? 'info' : 'warn', { event: 'owner_alert', kind: event.kind, outcome: result.sent ? 'sent' : result.reason });
  }

  async function onSendRefused(store: QuotaStore | null, status: number): Promise<void> {
    const counts = await count(store, [AUTH_METRICS.refused, AUTH_METRICS.failed]);
    if (!counts) return;
    const [today, hour] = counts;
    if (today === ALERT_AFTER.refusalsToday) await alert(store, { kind: 'auth-sender-refused', status, refusedToday: today });
    if (hour >= ALERT_AFTER.failuresPerHour) await alert(store, { kind: 'auth-send-failures', failures: hour });
  }

  /**
   * The Google start (GSI-1): flag, origin, the configured site origin (S1), body cap, the body rebuilt from scratch, the per-network
   * bucket (B2), then Neon's answer.
   */
  async function social(request: Request, canonical: RouteCtx, flags: AuthFlags): Promise<Response> {
    const done = (level: 'info' | 'warn' | 'error', outcome: string, extra: Record<string, LogValue> = {}) =>
      guardLog(level, { event: 'auth_guard', route: 'sign_in_social', outcome, ...extra });
    if (!flags.signInGoogle) {
      done('info', 'google_off');
      return answer(404, 'NOT_FOUND');
    }
    if (!originOk(request)) {
      done('warn', 'origin');
      return answer(403, 'FORBIDDEN');
    }
    const env = deps.env();
    const local = env.NODE_ENV === 'test' || env.NODE_ENV === 'development';
    // originOk passed, so the Origin header is present and is this host's own origin. Outside test and development the callback URLs
    // come from SITE_ORIGIN only (S1): another deployment URL of the project is refused, and no SITE_ORIGIN fails closed.
    let origin = new URL(request.headers.get('origin') as string).origin;
    if (!local) {
      const site = configuredOrigin(env.SITE_ORIGIN);
      if (!site) {
        done('error', 'site_origin_not_configured');
        return answer(503, 'GUARD_UNAVAILABLE');
      }
      if (site !== origin) {
        done('warn', 'site_origin');
        return answer(403, 'FORBIDDEN');
      }
      origin = site;
    }
    const raw = await readCapped(request, AUTH_GUARD.bodyMaxBytes);
    if (raw === null) {
      done('warn', 'body_too_large');
      return answer(413, 'BODY_TOO_LARGE');
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      done('info', 'bad_body');
      return answer(400, 'VALIDATION_ERROR');
    }
    const rebuilt = googleCallbacks(body, origin);
    if (!rebuilt) {
      done('info', 'bad_provider');
      return answer(400, 'VALIDATION_ERROR');
    }
    // B2: one per-network bucket, fail closed like the guarded routes; AUTH_GUARD=off (rollback) skips it.
    if (env.AUTH_GUARD !== 'off') {
      const secret = env.AUTH_QUOTA_SECRET;
      const store = deps.quota();
      if (!store || !secret || secret.length < 16) {
        if (!local) {
          done('error', 'quota_not_configured');
          return answer(503, 'GUARD_UNAVAILABLE');
        }
        done('warn', 'quota_skipped_locally');
      } else {
        const take = rules(AUTH_LIMITS.socialIp, ipHash(secret, clientIp(request), deps.now()));
        let result;
        try {
          result = await store.take(take);
        } catch (e) {
          done('error', 'quota_unavailable', { sqlstate: sqlstateOf(e) });
          return answer(503, 'GUARD_UNAVAILABLE');
        }
        if (!result.allowed) {
          const hit = take[result.failed];
          done('info', 'rate_limited', { bucket: hit.bucket, window: hit.windowS });
          return answer(429, 'RATE_LIMITED', { 'Retry-After': String(result.retryAfterS) });
        }
      }
    }
    let upstream: Response;
    try {
      upstream = await deps.upstream(rebuild(request, JSON.stringify(rebuilt)), canonical);
    } catch {
      upstream = Response.json({ code: 'UPSTREAM_ERROR' }, { status: 502 });
    }
    const status = upstream.status;
    if (upstream.ok) {
      done('info', 'ok', { upstream: status });
      return upstream;
    }
    const code = safeCode(await jsonOf(upstream), status >= 500 ? 'SERVICE_UNAVAILABLE' : 'VALIDATION_ERROR');
    done(status >= 500 ? 'warn' : 'info', 'neon_rejected', { upstream: status, code });
    const headers = status === 429 ? { ...NO_STORE, 'Retry-After': String(AUTH_GUARD.upstreamRetryAfterS) } : NO_STORE;
    return Response.json({ code, message: code }, { status, headers });
  }

  async function handle(request: Request, ctx: RouteCtx): Promise<Response> {
    const { path } = await ctx.params;
    const flags = deps.flags();
    // GSI-WAYS: the three Account routes of "Ways to sign in" (their own block at the end of this file).
    const ways = flags.signIn ? waysRoute(path ?? []) : null;
    if (ways) return waysHandle(deps, request, ways, flags);
    const found = flags.signIn ? classify(path ?? []) : null;
    const method = request.method.toUpperCase();
    if (!found || ('open' in found ? found.open !== method : method !== 'POST')) {
      guardLog('info', { event: 'auth_guard', outcome: flags.signIn ? 'not_offered' : 'sign_in_off' });
      return answer(404, 'NOT_FOUND');
    }
    // Neon gets the canonical (lower-case) path the allow-list matched, never the raw one.
    const canonical: RouteCtx = { params: Promise.resolve({ path: found.path.split('/') }) };
    if ('open' in found) {
      const url = upstreamUrl(request.url, QUERY_KEEP[found.path]);
      if (method === 'GET') return deps.upstream(new Request(url, { method, headers: request.headers }), canonical);
      if (!originOk(request)) {
        guardLog('warn', { event: 'auth_guard', route: found.path, outcome: 'origin' });
        return answer(403, 'FORBIDDEN');
      }
      // Sign-out: the same body cap as every other POST (review GSI-S N3), and no query (S2).
      const raw = await readCapped(request, AUTH_GUARD.bodyMaxBytes);
      if (raw === null) {
        guardLog('warn', { event: 'auth_guard', route: found.path, outcome: 'body_too_large' });
        return answer(413, 'BODY_TOO_LARGE');
      }
      const headers = new Headers(request.headers);
      headers.delete('content-length');
      return deps.upstream(new Request(url, { method, headers, body: raw }), canonical);
    }
    if ('social' in found) return social(request, canonical, flags);
    const route = found.route;
    if (route.codeOnly && !flags.signInCode) {
      guardLog('info', { event: 'auth_guard', route: route.id, outcome: 'code_off' });
      return answer(404, 'NOT_FOUND');
    }

    // 1. Origin, before anything else (no quota is spent on a forged cross-site call); a missing Origin is refused too.
    if (!originOk(request)) {
      guardLog('warn', { event: 'auth_guard', route: route.id, outcome: 'origin' });
      return answer(403, 'FORBIDDEN');
    }

    // 6. The answer hold (SF5) wraps steps 2 to 5 of the send and sign-up routes, whatever the outcome.
    const t0 = deps.clockMs();
    const res = await guarded(request, route, flags, canonical);
    if (route.kind === 'send' || route.kind === 'signup') await deps.sleep(answerHoldMs(deps.clockMs() - t0, deps.random()));
    return res;
  }

  async function guarded(request: Request, route: GuardedRoute, flags: AuthFlags, canonical: RouteCtx): Promise<Response> {
    const started = deps.now();
    const env = deps.env();
    const local = env.NODE_ENV === 'test' || env.NODE_ENV === 'development';
    const done = (level: 'info' | 'warn' | 'error', outcome: string, extra: Record<string, LogValue> = {}) =>
      guardLog(level, { event: 'auth_guard', route: route.id, outcome, ...extra });

    // 2. Body: capped, JSON, the address canonical.
    const raw = await readCapped(request, AUTH_GUARD.bodyMaxBytes);
    if (raw === null) {
      done('warn', 'body_too_large');
      return answer(413, 'BODY_TOO_LARGE');
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      done('info', 'bad_body');
      return answer(400, 'VALIDATION_ERROR');
    }
    const email = canonicalAddress(body.email);
    if (!email) {
      done('info', 'bad_email');
      return answer(400, 'INVALID_EMAIL');
    }
    body.email = email;
    if (route.id === 'send_otp' && !OTP_TYPES.has(String(body.type))) {
      done('info', 'bad_type');
      return answer(400, 'VALIDATION_ERROR');
    }
    if (route.id === 'send_otp' && body.type === 'sign-in' && !flags.signInCode) {
      done('info', 'code_off');
      return answer(404, 'NOT_FOUND');
    }
    body = allowedBody(route, body);

    // 3 and 4. Turnstile and quotas, unless the guard is switched off (rollback only).
    const guardOn = env.AUTH_GUARD !== 'off';
    let store: QuotaStore | null = null;
    if (guardOn) {
      const ip = clientIp(request);
      if (route.kind === 'send' || route.kind === 'signup') {
        const t = await verifyTurnstile({
          token: request.headers.get('x-turnstile-token'),
          hostname: hostname(request),
          remoteIp: ip,
          secret: env.TURNSTILE_SECRET_KEY,
          nodeEnv: env.NODE_ENV,
          fetch: deps.turnstileFetch,
        });
        if (!turnstilePassed(t)) {
          done('warn', 'turnstile', { detail: t });
          return t === 'timeout' || t === 'unavailable' || t === 'not_configured' ? answer(503, 'TURNSTILE_UNAVAILABLE') : answer(403, 'TURNSTILE_FAILED');
        }
        if (t === 'skipped') done('warn', 'turnstile_skipped_locally');
      }
      const secret = env.AUTH_QUOTA_SECRET;
      const candidate = deps.quota();
      if (!candidate || !secret || secret.length < 16) {
        if (!local) {
          done('error', 'quota_not_configured');
          return answer(503, 'GUARD_UNAVAILABLE');
        }
        done('warn', 'quota_skipped_locally');
      } else {
        store = candidate;
        const now = deps.now();
        const addr = addressHash(secret, email, now);
        const addrIp = addressIpHash(secret, email, ip, now);
        if (!addr || !addrIp) {
          done('info', 'bad_email');
          return answer(400, 'INVALID_EMAIL');
        }
        const take = rulesFor(route.kind, addr, ipHash(secret, ip, now), addrIp);
        let result;
        try {
          result = await store.take(take);
        } catch (e) {
          done('error', 'quota_unavailable', { sqlstate: sqlstateOf(e) });
          return answer(503, 'GUARD_UNAVAILABLE');
        }
        if (!result.allowed) {
          const hit = take[result.failed];
          if (hit.bucket === AUTH_LIMITS.sendGlobal.bucket) {
            done('warn', 'global_cap', { bucket: hit.bucket, window: hit.windowS });
            await alert(store, { kind: 'auth-global-cap', limit: hit.limit ?? 0, window: hit.windowS >= 86400 ? 'day' : 'hour' });
            return answer(503, 'SEND_UNAVAILABLE', { 'Retry-After': String(result.retryAfterS) });
          }
          done('info', 'rate_limited', { bucket: hit.bucket, window: hit.windowS });
          return answer(429, 'RATE_LIMITED', { 'Retry-After': String(result.retryAfterS) });
        }
      }
    }

    // 5. Forward, then fix the answer. The proxy always waits for Neon, known address or not (no early answer on our side).
    let upstream: Response;
    try {
      upstream = await deps.upstream(rebuild(request, JSON.stringify(body)), canonical);
    } catch {
      upstream = Response.json({ code: 'UPSTREAM_ERROR' }, { status: 502 });
    }
    const status = upstream.status;
    const retry = { 'Retry-After': String(AUTH_GUARD.upstreamRetryAfterS) };

    switch (route.kind) {
      case 'send': {
        if (upstream.ok) {
          await count(store, [AUTH_METRICS.sent]);
          done('info', 'sent', { upstream: status });
          return Response.json(route.sendOk, { status: 200, headers: NO_STORE });
        }
        if (status === 429 || status >= 500) {
          done('warn', 'neon_refused', { upstream: status });
          await onSendRefused(store, status);
          return answer(503, 'SEND_FAILED', status === 429 ? retry : {});
        }
        const code = safeCode(await jsonOf(upstream), 'VALIDATION_ERROR');
        done('info', 'neon_rejected', { upstream: status, code });
        return Response.json({ code, message: code }, { status, headers: NO_STORE });
      }
      case 'signup': {
        const json = await jsonOf(upstream);
        if (upstream.ok && json && json.token == null) {
          // Verification required: the same answer for a new and an existing address. Neon sent a code only for a new one.
          if (json.user && typeof json.user === 'object' && (json.user as Record<string, unknown>).role != null) await count(store, [AUTH_METRICS.sent]);
          done('info', 'signup_pending', { upstream: status });
          return signupPending();
        }
        if (status === 422 && /^USER_ALREADY_EXISTS/.test(safeCode(json, ''))) {
          done('info', 'signup_pending', { upstream: status });
          return signupPending();
        }
        if (upstream.ok) {
          // Verification not required yet (before O-E1): a new account is signed in at once; that cannot look like anything else.
          done('info', 'signup_session', { upstream: status });
          return upstream;
        }
        const code = safeCode(json, status >= 500 ? 'SERVICE_UNAVAILABLE' : 'VALIDATION_ERROR');
        done(status >= 500 ? 'warn' : 'info', 'neon_rejected', { upstream: status, code });
        return Response.json({ code, message: code }, { status, headers: status === 429 ? { ...NO_STORE, ...retry } : NO_STORE });
      }
      case 'reset': {
        if (upstream.ok) {
          try {
            const n = await deps.revokeSessions(email, started);
            done('info', 'reset_revoked', { upstream: status, revoked: n });
          } catch {
            done('error', 'revoke_failed', { upstream: status });
            const counts = await count(store, [AUTH_METRICS.revokeFailed]);
            if (counts) await alert(store, { kind: 'auth-revoke-failed', failures: counts[0] });
          }
          await count(store, [AUTH_METRICS.verified]);
          return upstream;
        }
        done('info', 'neon_rejected', { upstream: status });
        return status === 429 ? withHeader(upstream, 'Retry-After', retry['Retry-After']) : upstream;
      }
      case 'verify':
      case 'password': {
        if (upstream.ok && route.verifies) await count(store, [AUTH_METRICS.verified]);
        // An unverified account: the card now asks for a code through the guarded send route (MF2). If this answer ever comes with a
        // mail of Neon's, the console setting "send verification email on sign-in" is on, which it must not be; the log line shows it.
        const unverified = route.kind === 'password' && status === 403 && safeCode(await jsonOf(upstream), '') === 'EMAIL_NOT_VERIFIED';
        done(status >= 500 ? 'warn' : 'info', upstream.ok ? 'ok' : unverified ? 'email_not_verified' : 'neon_rejected', { upstream: status });
        return status === 429 ? withHeader(upstream, 'Retry-After', retry['Retry-After']) : upstream;
      }
    }
  }

  return { handle };
}

// ===== Ways to sign in on Account (GSI-WAYS) ===========================================================================================
// A separate block, appended: the allow-list entries and the handler of the three Account routes behind "Ways to sign in" (copy page
// 2.5, strings 29 to 51; Google spec 5.1 L4 to L6). `handle` above sends them here before its own allow-list, with one line.
//
//   list-accounts  GET   rows of the signed-in user, cut to `{ providerId, createdAt }` (no row id, Google subject, user id or scopes)
//   link-social    POST  Add Google: `{ provider: 'google' }` in, Google's address out; behind NEXT_PUBLIC_SIGN_IN_GOOGLE
//   unlink-account POST  Remove Google: `{ providerId: 'google' }` in; the guard picks the rows itself; behind NEXT_PUBLIC_SIGN_IN_GOOGLE
//
// Every call, in order: method, flag, same origin (a POST must carry Origin; a GET may omit it, as browsers do, but a foreign Origin or
// a cross-site Sec-Fetch-Site is refused), body cap and shape, the session cookie (401 before Neon without it), the per-IP bucket
// (AUTH_WAYS, fail closed without the store in production), then Neon with the path the allow-list names, never the browser's query
// string and never a body field the browser chose. `link-social` builds both callback URLs from SITE_ORIGIN (the request origin only in
// development and test without it) and refuses a request from any other origin. `unlink-account` reads the session (a sign-in at most
// AUTH_WAYS.removeFreshS ago, else 403 REAUTH_REQUIRED) and the rows, and refuses to remove the last one (409 LAST_METHOD) before Neon
// is asked; Neon's own refusal (FAILED_TO_UNLINK_LAST_ACCOUNT) maps to the same answer. Neon's error text is never passed on, only a
// plain code; logs carry fixed codes only.
import { AUTH_WAYS as WAYS_LIMITS, GOOGLE_SIGN_IN as WAYS_GOOGLE } from '@travel/core/config/auth-limits.ts';
import { googleAuthorizeUrl as waysGoogleUrl } from '@/lib/auth/google';
import { parseNeonRows, publicRows, removalPlan, sessionFresh, type NeonWayRow } from '@/lib/auth/ways';
import { siteOrigin } from '@/lib/site';

export interface WaysRoute {
  path: 'list-accounts' | 'link-social' | 'unlink-account';
  id: 'list_accounts' | 'link_social' | 'unlink_account';
  method: 'GET' | 'POST';
  /** Answers 404 unless NEXT_PUBLIC_SIGN_IN_GOOGLE is on (rows stay read-only when it is off, copy string 50). */
  google: boolean;
  /** Takes from the write bucket instead of the read one. */
  write: boolean;
}

const WAYS: Record<string, WaysRoute> = {
  'list-accounts': { path: 'list-accounts', id: 'list_accounts', method: 'GET', google: false, write: false },
  'link-social': { path: 'link-social', id: 'link_social', method: 'POST', google: true, write: true },
  'unlink-account': { path: 'unlink-account', id: 'unlink_account', method: 'POST', google: true, write: true },
};

/** The Account route a path names, or null (then `classify` decides, and anything else is 404). */
export function waysRoute(path: readonly string[]): WaysRoute | null {
  if (path.length !== 1) return null;
  const p = path[0].toLowerCase();
  return Object.hasOwn(WAYS, p) ? WAYS[p] : null;
}

/** The session cookie is present (its value is Neon's to check). */
function hasSessionCookie(request: Request): boolean {
  const raw = request.headers.get('cookie') ?? '';
  return raw.split(';').some((part) => {
    const eq = part.indexOf('=');
    return eq > 0 && part.slice(0, eq).trim() === WAYS_LIMITS.sessionCookie && part.slice(eq + 1).trim() !== '';
  });
}

/** A GET may omit Origin (browsers do on same-origin reads); a present one must be ours, and a cross-site fetch is refused. */
function readOriginOk(request: Request): boolean {
  if (!sameOrigin(request)) return false;
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
}

/** The origin both Add Google callbacks use: SITE_ORIGIN, or the request's own in development and test without it; null: not set. */
function callbackOrigin(requestOrigin: string, nodeEnv: string | undefined): string | null {
  if (process.env.SITE_ORIGIN?.trim()) {
    try {
      return new URL(siteOrigin()).origin;
    } catch {
      return null;
    }
  }
  return nodeEnv === 'development' || nodeEnv === 'test' ? requestOrigin : null;
}

async function waysHandle(deps: GuardDeps, request: Request, route: WaysRoute, flags: AuthFlags): Promise<Response> {
  const done = (level: 'info' | 'warn' | 'error', outcome: string, extra: Record<string, LogValue> = {}) =>
    guardLog(level, { event: 'auth_guard', route: route.id, outcome, ...extra });
  const env = deps.env();
  const local = env.NODE_ENV === 'test' || env.NODE_ENV === 'development';

  if (request.method.toUpperCase() !== route.method) {
    done('info', 'not_offered');
    return answer(404, 'NOT_FOUND');
  }
  if (route.google && !flags.signInGoogle) {
    done('info', 'google_off');
    return answer(404, 'NOT_FOUND');
  }
  if (route.method === 'POST' ? !originOk(request) : !readOriginOk(request)) {
    done('warn', 'origin');
    return answer(403, 'FORBIDDEN');
  }

  let body: Record<string, unknown> = {};
  if (route.method === 'POST') {
    const raw = await readCapped(request, AUTH_GUARD.bodyMaxBytes);
    if (raw === null) {
      done('warn', 'body_too_large');
      return answer(413, 'BODY_TOO_LARGE');
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      done('info', 'bad_body');
      return answer(400, 'VALIDATION_ERROR');
    }
    const named = route.id === 'link_social' ? body.provider : body.providerId;
    if (named !== WAYS_GOOGLE.provider) {
      done('info', 'bad_provider');
      return answer(400, 'VALIDATION_ERROR');
    }
  }

  if (!hasSessionCookie(request)) {
    done('info', 'no_session');
    return answer(401, 'UNAUTHORIZED');
  }

  // The per-IP bucket, with the guarded routes' fail-closed rule; AUTH_GUARD=off (rollback) skips it.
  if (env.AUTH_GUARD !== 'off') {
    const secret = env.AUTH_QUOTA_SECRET;
    const store = deps.quota();
    if (!store || !secret || secret.length < 16) {
      if (!local) {
        done('error', 'quota_not_configured');
        return answer(503, 'GUARD_UNAVAILABLE');
      }
      done('warn', 'quota_skipped_locally');
    } else {
      const take = rules(route.write ? WAYS_LIMITS.writeIp : WAYS_LIMITS.readIp, ipHash(secret, clientIp(request), deps.now()));
      let result;
      try {
        result = await store.take(take);
      } catch {
        done('error', 'quota_unavailable');
        return answer(503, 'GUARD_UNAVAILABLE');
      }
      if (!result.allowed) {
        done('info', 'rate_limited', { bucket: take[result.failed].bucket, window: take[result.failed].windowS });
        return answer(429, 'RATE_LIMITED', { 'Retry-After': String(result.retryAfterS) });
      }
    }
  }

  // Neon, by the path the allow-list names: a fresh request with no query string of the browser's and our own body.
  const call = async (path: string, method: 'GET' | 'POST', payload?: Record<string, unknown>, search = ''): Promise<Response> => {
    const url = new URL(`/api/auth/${path}/`, request.url);
    url.search = search;
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    if (payload) headers.set('content-type', 'application/json');
    try {
      return await deps.upstream(new Request(url, { method, headers, body: payload ? JSON.stringify(payload) : undefined }), { params: Promise.resolve({ path: [path] }) });
    } catch {
      return Response.json({ code: 'UPSTREAM_ERROR' }, { status: 502 });
    }
  };
  const refused = async (upstream: Response, outcome: string): Promise<Response> => {
    const status = upstream.status;
    const code = status === 401 ? 'UNAUTHORIZED' : safeCode(await jsonOf(upstream), status >= 500 ? 'SERVICE_UNAVAILABLE' : 'VALIDATION_ERROR');
    done(status >= 500 ? 'warn' : 'info', outcome, { upstream: status, code });
    const headers = status === 429 ? { ...NO_STORE, 'Retry-After': String(AUTH_GUARD.upstreamRetryAfterS) } : NO_STORE;
    return Response.json({ code, message: code }, { status, headers });
  };

  // Removal is the sensitive one: a recent sign-in first (the re-authentication), read from Neon past the SDK's 5-minute cookie cache.
  if (route.id === 'unlink_account') {
    const s = await call('get-session', 'GET', undefined, '?disableCookieCache=true');
    const json = s.ok ? await jsonOf(s) : null;
    const session = json?.session && typeof json.session === 'object' ? (json.session as Record<string, unknown>) : null;
    if (!session) {
      if (s.ok || s.status === 401) {
        done('info', 'no_session', { upstream: s.status });
        return answer(401, 'UNAUTHORIZED');
      }
      return refused(s, 'neon_rejected');
    }
    if (!sessionFresh(session.createdAt, deps.now().getTime())) {
      done('info', 'reauth_required');
      return answer(403, 'REAUTH_REQUIRED');
    }
  }

  const listed = await call('list-accounts', 'GET');
  if (!listed.ok) return refused(listed, 'list_rejected');
  let rawRows: unknown = null;
  try {
    rawRows = await listed.clone().json();
  } catch {
    rawRows = null;
  }
  const rows: NeonWayRow[] | null = parseNeonRows(rawRows);
  if (!rows) {
    done('warn', 'rows_unreadable');
    return answer(502, 'SERVICE_UNAVAILABLE');
  }

  if (route.id === 'list_accounts') {
    done('info', 'ok', { rows: rows.length });
    return Response.json({ accounts: publicRows(rows) }, { status: 200, headers: NO_STORE });
  }

  if (route.id === 'link_social') {
    if (rows.some((r) => r.providerId === WAYS_GOOGLE.provider)) {
      done('info', 'already_added');
      return answer(409, 'ALREADY_ADDED');
    }
    // originOk passed, so Origin is present and equals this host.
    const requestOrigin = new URL(request.headers.get('origin') as string).origin;
    const origin = callbackOrigin(requestOrigin, env.NODE_ENV);
    if (!origin) {
      done('error', 'origin_not_configured');
      return answer(503, 'GUARD_UNAVAILABLE');
    }
    if (origin !== requestOrigin) {
      done('warn', 'origin_mismatch');
      return answer(403, 'FORBIDDEN');
    }
    const back = `${origin}${WAYS_GOOGLE.landingPath}?${WAYS_LIMITS.addedParam}=${WAYS_GOOGLE.provider}`;
    const upstream = await call('link-social', 'POST', { provider: WAYS_GOOGLE.provider, callbackURL: back, errorCallbackURL: back });
    if (!upstream.ok) return refused(upstream, 'neon_rejected');
    const url = waysGoogleUrl(await jsonOf(upstream));
    if (!url) {
      done('warn', 'bad_url', { upstream: upstream.status });
      return answer(502, 'SERVICE_UNAVAILABLE');
    }
    // Only Google's address goes back, with Neon's cookies (the OAuth state); nothing else of Neon's answer.
    const headers = new Headers(NO_STORE);
    for (const cookie of upstream.headers.getSetCookie()) headers.append('set-cookie', cookie);
    done('info', 'ok', { upstream: upstream.status });
    return Response.json({ url }, { status: 200, headers });
  }

  // unlink_account: the rows are chosen here, never by the browser; the last one is never removed.
  const plan = removalPlan(rows);
  if (!plan.ok) {
    done('info', plan.reason);
    return answer(409, plan.reason === 'last_method' ? 'LAST_METHOD' : plan.reason === 'not_linked' ? 'NOT_LINKED' : 'VALIDATION_ERROR');
  }
  for (const id of plan.ids) {
    // Better Auth 1.7: the body is the account row's `id` (spec 18, owner check W2).
    const upstream = await call('unlink-account', 'POST', { accountId: id });
    if (upstream.ok) continue;
    const code = safeCode(await jsonOf(upstream), '');
    if (code === 'FAILED_TO_UNLINK_LAST_ACCOUNT') {
      done('info', 'last_method', { upstream: upstream.status });
      return answer(409, 'LAST_METHOD');
    }
    if (code === 'SESSION_NOT_FRESH') {
      done('info', 'reauth_required', { upstream: upstream.status });
      return answer(403, 'REAUTH_REQUIRED');
    }
    return refused(upstream, 'neon_rejected');
  }
  done('info', 'removed', { rows: plan.ids.length });
  return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
}
