import 'server-only';
import { TURNSTILE } from '@travel/core/config/auth-limits.ts';

/**
 * Cloudflare Turnstile, server side (EML-Q; email spec 5.3). The sign-in card sends the widget's token in `x-turnstile-token`; this
 * checks it with Cloudflare's siteverify before the guard forwards a mail-sending call. Checks `success`, the hostname (it must be the
 * host the request came to, which the same-origin guard already ties to `Origin`) and the action (`auth_send`). Single use is
 * Cloudflare's: a reused token answers `timeout-or-duplicate`, reported here as `reused`.
 *
 * Fail closed: a missing secret in production, a timeout or a Cloudflare error is never `ok`. Only under NODE_ENV test or development
 * may a missing secret be skipped (`skipped`). Cloudflare's published test secrets are refused in production; elsewhere their answers
 * (hostname `example.com`, no action) skip the hostname and action checks.
 */
export type TurnstileOutcome =
  | 'ok'
  | 'skipped'
  | 'missing'
  | 'failed'
  | 'reused'
  | 'hostname'
  | 'action'
  | 'timeout'
  | 'unavailable'
  | 'not_configured';

export interface TurnstileCheck {
  token: string | null;
  /** The hostname the request came to (from `Host`). */
  hostname: string;
  /** The client IP, or `unknown` (then not sent to Cloudflare). */
  remoteIp: string;
  secret: string | undefined;
  nodeEnv: string | undefined;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const TOKEN_MAX = 2048;

export function turnstilePassed(outcome: TurnstileOutcome): boolean {
  return outcome === 'ok' || outcome === 'skipped';
}

export async function verifyTurnstile(check: TurnstileCheck): Promise<TurnstileOutcome> {
  const local = check.nodeEnv === 'test' || check.nodeEnv === 'development';
  const secret = check.secret?.trim();
  if (!secret) return local ? 'skipped' : 'not_configured';
  const testSecret = (TURNSTILE.testSecrets as readonly string[]).includes(secret);
  if (testSecret && !local) return 'not_configured';
  const token = check.token?.trim();
  if (!token) return 'missing';
  if (token.length > TOKEN_MAX) return 'failed';

  const form = new URLSearchParams({ secret, response: token });
  if (check.remoteIp && check.remoteIp !== 'unknown') form.set('remoteip', check.remoteIp);
  let res: Response;
  try {
    res = await (check.fetch ?? fetch)(TURNSTILE.url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(check.timeoutMs ?? TURNSTILE.timeoutMs),
    });
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    return name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable';
  }
  if (!res.ok) return 'unavailable';
  let body: { success?: unknown; hostname?: unknown; action?: unknown; 'error-codes'?: unknown };
  try {
    body = await res.json();
  } catch {
    return 'unavailable';
  }
  const codes = Array.isArray(body['error-codes']) ? (body['error-codes'] as unknown[]) : [];
  if (body.success !== true) {
    if (codes.includes('timeout-or-duplicate')) return 'reused';
    if (codes.includes('internal-error')) return 'unavailable';
    return 'failed';
  }
  if (testSecret) return 'ok';
  if (typeof body.hostname !== 'string' || body.hostname.toLowerCase() !== check.hostname.toLowerCase()) return 'hostname';
  if (body.action !== TURNSTILE.action) return 'action';
  return 'ok';
}
