import 'server-only';
import { ALERT_AFTER, AUTH_GUARD, AUTH_LIMITS, AUTH_METRICS, type Window } from '@travel/core/config/auth-limits.ts';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { sendOwnerAlert, type AlertEvent } from '@travel/core/mail/alert.ts';
import type { Mailer } from '@travel/core/mail/mailer.ts';
import { LOG_DENY_KEYS } from '@travel/core/privacy/detect.ts';
import { quotaAlertBudget } from '@travel/core/quota/alert-budget.ts';
import { addressHash, ipHash } from '@travel/core/quota/keys.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaRule, QuotaStore } from '@travel/core/quota/store.ts';
import { isIP } from 'node:net';
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
 *        failures in an hour); our own global cap becomes SEND_UNAVAILABLE with an alert once a day.
 *
 * Fail closed: without the quota store or AUTH_QUOTA_SECRET, or without TURNSTILE_SECRET, guarded calls answer 503 in production; only
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

/** Guarded Neon Auth routes (lower-case path under /api/auth/). Everything else passes through untouched. */
const ROUTES: Record<string, Route> = {
  'email-otp/send-verification-otp': { id: 'send_otp', kind: 'send', sendOk: { success: true } },
  'email-otp/request-password-reset': { id: 'reset_request', kind: 'send', sendOk: { success: true } },
  'forget-password/email-otp': { id: 'reset_request_legacy', kind: 'send', sendOk: { success: true } },
  'request-password-reset': { id: 'reset_request_link', kind: 'send', sendOk: { status: true } },
  'send-verification-email': { id: 'verify_resend_link', kind: 'send', sendOk: { status: true } },
  'sign-in/magic-link': { id: 'magic_link', kind: 'send', sendOk: { status: true } },
  'sign-up/email': { id: 'sign_up', kind: 'signup' },
  'sign-in/email': { id: 'sign_in_password', kind: 'password' },
  'sign-in/email-otp': { id: 'sign_in_code', kind: 'verify', verifies: true },
  'email-otp/verify-email': { id: 'verify_email', kind: 'verify', verifies: true },
  'email-otp/check-verification-otp': { id: 'check_code', kind: 'verify' },
  'email-otp/reset-password': { id: 'reset_password', kind: 'reset', verifies: true },
};

/** Routes not offered in v1 (change of email A8, link reset): refused here so nothing unguarded can send mail. */
const BLOCKED = ['reset-password', 'change-email', 'email-otp/change-email', 'email-otp/request-email-change'];

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

/** A request for Neon with the rewritten body; the Turnstile token stays here. */
function rebuild(request: Request, body: string): Request {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('x-turnstile-token');
  headers.set('content-type', 'application/json');
  return new Request(request.url, { method: request.method, headers, body });
}

/** A copy of an upstream answer with a new JSON body, keeping its cookies and safe headers. */
function withBody(upstream: Response, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  const headers = new Headers(upstream.headers);
  for (const h of ['content-length', 'content-encoding']) headers.delete(h);
  headers.set('content-type', 'application/json');
  headers.set('Cache-Control', 'private, no-store');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
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
const DENY = new Set(LOG_DENY_KEYS.map((k) => k.toLowerCase()));

/** One JSON line with fixed codes. A deny-listed key, or a value that looks like an address, a code or an IP, is dropped. */
export function guardLog(level: 'info' | 'warn' | 'error', fields: Record<string, LogValue>): void {
  const safe: Record<string, LogValue> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || DENY.has(k.toLowerCase())) continue;
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
  env(): { NODE_ENV?: string; AUTH_GUARD?: string; AUTH_QUOTA_SECRET?: string; TURNSTILE_SECRET?: string };
  now(): Date;
  /** Cloudflare's siteverify (tests inject a fake). */
  turnstileFetch?: typeof fetch;
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
      TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
    }),
    now: () => new Date(),
  };
}

// ----- the guard -------------------------------------------------------------------------------------------------------------------

function rules(limit: { bucket: string; windows: readonly Window[] }, key: string): QuotaRule[] {
  return limit.windows.map((w) => ({ bucket: limit.bucket, key, windowS: w.windowS, limit: w.limit }));
}

function rulesFor(kind: Kind, addr: string, ip: string): QuotaRule[] {
  switch (kind) {
    case 'send':
      return [...rules(AUTH_LIMITS.sendAddr, addr), ...rules(AUTH_LIMITS.sendIp, ip), ...rules(AUTH_LIMITS.sendGlobal, '')];
    case 'signup':
      // With Require Verification on, a sign-up sends a code, so it also takes from the send buckets (one take, at most 8 rules).
      return [...rules(AUTH_LIMITS.signupIp, ip), ...rules(AUTH_LIMITS.sendAddr, addr), ...rules(AUTH_LIMITS.sendGlobal, '')];
    case 'verify':
    case 'reset':
      return [...rules(AUTH_LIMITS.verifyAddr, addr), ...rules(AUTH_LIMITS.verifyIp, ip)];
    case 'password':
      return [...rules(AUTH_LIMITS.passwordAddr, addr), ...rules(AUTH_LIMITS.passwordIp, ip)];
  }
}

export function classify(path: readonly string[]): Route | 'blocked' | null {
  if (path.some((s) => s === '' || s === '.' || s === '..')) return 'blocked';
  const p = path.join('/').toLowerCase();
  if (BLOCKED.some((b) => p === b || p.startsWith(`${b}/`))) return 'blocked';
  return ROUTES[p] ?? null;
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

  async function handle(request: Request, ctx: RouteCtx): Promise<Response> {
    const { path } = await ctx.params;
    const route = classify(path ?? []);
    if (route === 'blocked') {
      guardLog('info', { event: 'auth_guard', outcome: 'blocked' });
      return answer(404, 'NOT_FOUND');
    }
    if (!route || request.method !== 'POST') return deps.upstream(request, ctx);

    const started = deps.now();
    const env = deps.env();
    const local = env.NODE_ENV === 'test' || env.NODE_ENV === 'development';
    const done = (level: 'info' | 'warn' | 'error', outcome: string, extra: Record<string, LogValue> = {}) =>
      guardLog(level, { event: 'auth_guard', route: route.id, outcome, ...extra });

    // 1. Origin, before anything else (no quota is spent on a forged cross-site call).
    if (!sameOrigin(request)) {
      done('warn', 'origin');
      return answer(403, 'FORBIDDEN');
    }

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
          secret: env.TURNSTILE_SECRET,
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
        if (!addr) {
          done('info', 'bad_email');
          return answer(400, 'INVALID_EMAIL');
        }
        const take = rulesFor(route.kind, addr, ipHash(secret, ip, now));
        let result;
        try {
          result = await store.take(take);
        } catch {
          done('error', 'quota_unavailable');
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
      upstream = await deps.upstream(rebuild(request, JSON.stringify(body)), ctx);
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
          return withBody(upstream, 200, SIGNUP_PENDING);
        }
        if (status === 422 && /^USER_ALREADY_EXISTS/.test(safeCode(json, ''))) {
          done('info', 'signup_pending', { upstream: status });
          return withBody(upstream, 200, SIGNUP_PENDING);
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
        done(status >= 500 ? 'warn' : 'info', upstream.ok ? 'ok' : 'neon_rejected', { upstream: status });
        return status === 429 ? withHeader(upstream, 'Retry-After', retry['Retry-After']) : upstream;
      }
    }
  }

  return { handle };
}
