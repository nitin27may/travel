import type { AuthAnswer } from '@/lib/auth/auth-errors';

/**
 * The card's calls to the auth proxy (`/api/auth/*`, guarded by lib/auth/guard.ts). Plain same-origin `fetch`, not the Better Auth
 * browser client: the card needs the status, the guard's `code` and `Retry-After`, and must send the Turnstile token as a header.
 * Session cookies come back on the same answer, so a success is followed by a full page load. Paths end in `/` (`trailingSlash`).
 */
export type AuthCall =
  | 'email-otp/send-verification-otp'
  | 'email-otp/request-password-reset'
  | 'email-otp/verify-email'
  | 'email-otp/reset-password'
  | 'sign-in/email-otp'
  | 'sign-in/email'
  | 'sign-up/email'
  /** Continue with Google (GSI-1): answers Google's address and sets the challenge cookie; behind `signInGoogle`. */
  | 'sign-in/social';

export interface AuthReply extends AuthAnswer {
  body: Record<string, unknown> | null;
}

export async function authCall(path: AuthCall, body: Record<string, unknown>, turnstileToken?: string | null): Promise<AuthReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 0, code: 'OFFLINE', retryAfterS: null, body: null };
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (turnstileToken) headers['x-turnstile-token'] = turnstileToken;
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}/`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'same-origin' });
  } catch {
    return { status: 0, code: typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : 'NETWORK', retryAfterS: null, body: null };
  }
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await res.json();
    json = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  const retry = Number(res.headers.get('retry-after'));
  return {
    status: res.status,
    code: typeof json?.code === 'string' ? json.code : '',
    retryAfterS: Number.isFinite(retry) && retry > 0 ? retry : null,
    body: json,
  };
}
