import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Page, Request, Route } from '@playwright/test';
import { ROOT, startNext, type Server } from './fixtures';

/**
 * Network mocks for the sign-in card specs (EML-1): a fake auth proxy answering the guard's codes, and a fake Cloudflare Turnstile
 * script. No request leaves the browser for Neon or Cloudflare, and no email is sent.
 *
 * The card exists only in a build with the sign-in flags on. The specs run against `web/.fixture-auth`, built with
 *   NEXT_PUBLIC_SIGN_IN=1 NEXT_PUBLIC_SIGN_IN_CODE=1 NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
 *     node scripts/build-fixture.mjs .fixture-auth
 * and skip when that build is missing (the default e2e build keeps sign-in off).
 */
export const AUTH_DIST = '.fixture-auth';
export const authBuildPresent = (): boolean => existsSync(path.join(ROOT, 'web', AUTH_DIST, 'BUILD_ID'));

export async function startAuthSite(): Promise<Server> {
  return startNext(AUTH_DIST);
}

export const GOOD_CODE = '482913';
export const GOOD_PASSWORD = 'right-password-123';

export interface AuthCallLog {
  path: string;
  body: Record<string, unknown>;
  turnstile: string | null;
}

type Answer = { status: number; body?: unknown; headers?: Record<string, string> };
export type Override = (body: Record<string, unknown>, n: number) => Answer | undefined;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Answer => ({ status, body, headers });

/** The default answers of the guarded proxy for a known account with GOOD_PASSWORD and a code GOOD_CODE. */
function defaults(path: string, body: Record<string, unknown>): Answer {
  switch (path) {
    case 'email-otp/send-verification-otp':
    case 'email-otp/request-password-reset':
      return json(200, { success: true });
    case 'sign-in/email-otp':
    case 'email-otp/verify-email':
      return body.otp === GOOD_CODE ? json(200, { token: 'tok', user: { id: 'u1' } }) : json(400, { code: 'INVALID_OTP', message: 'Invalid OTP' });
    case 'email-otp/reset-password':
      return body.otp === GOOD_CODE ? json(200, { success: true }) : json(400, { code: 'INVALID_OTP', message: 'Invalid OTP' });
    case 'sign-in/email':
      return body.password === GOOD_PASSWORD ? json(200, { token: 'tok', user: { id: 'u1' } }) : json(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
    case 'sign-up/email':
      return json(200, { token: null, user: null });
    default:
      return json(404, { code: 'NOT_FOUND' });
  }
}

/** Fake Turnstile: renders nothing visible and hands out cf-token-1, cf-token-2, ... (a new one after each reset). */
const TURNSTILE_JS = `window.turnstile = { n: 0, cb: null,
  render(el, o) { this.cb = o.callback; const t = 'cf-token-' + (++this.n); setTimeout(() => this.cb && this.cb(t), 20); return 'w1'; },
  reset() { const t = 'cf-token-' + (++this.n); setTimeout(() => this.cb && this.cb(t), 20); },
  remove() { this.cb = null; } };`;

/** Mock the proxy and Turnstile on this page. `overrides[path]` answers first; `undefined` falls back to the default. */
export async function mockAuth(page: Page, overrides: Record<string, Override> = {}): Promise<AuthCallLog[]> {
  const calls: AuthCallLog[] = [];
  const counts = new Map<string, number>();
  await page.route('https://challenges.cloudflare.com/**', (route: Route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: TURNSTILE_JS }));
  await page.route('**/api/auth/**', async (route: Route, request: Request) => {
    const url = new URL(request.url());
    const p = url.pathname.replace(/^\/api\/auth\//, '').replace(/\/$/, '');
    let body: Record<string, unknown> = {};
    try {
      body = (request.postDataJSON() as Record<string, unknown>) ?? {};
    } catch {
      body = {};
    }
    const n = (counts.get(p) ?? 0) + 1;
    counts.set(p, n);
    calls.push({ path: p, body, turnstile: request.headers()['x-turnstile-token'] ?? null });
    const a = overrides[p]?.(body, n) ?? defaults(p, body);
    await route.fulfill({ status: a.status, contentType: 'application/json', headers: a.headers, body: JSON.stringify(a.body ?? {}) });
  });
  return calls;
}
