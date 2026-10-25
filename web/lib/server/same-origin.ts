/**
 * Same-origin guard for the account route handlers, enforced before any auth or data work. A browser
 * always sends `Origin` on a cross-site POST, so a present-but-mismatched origin is a forged/CSRF-style
 * call and gets rejected. A missing `Origin` is a deliberate allow: legitimate direct API clients
 * (server-to-server, curl) send none, and the session cookie is still required by the caller.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    const source = new URL(origin);
    // Next may construct request.url with its listening hostname (localhost), even when the
    // browser used 127.0.0.1, and its protocol can come from X-Forwarded-Proto. Authorize neither
    // from that URL nor forwarded headers: Host must match, including the port.
    const host = request.headers.get('host');
    if (!host || source.host !== host.toLowerCase()) return false;
    const local = source.hostname === 'localhost' || source.hostname === '127.0.0.1' || source.hostname === '[::1]';
    const development = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    // Local dev/test is HTTP-only; every other host/environment is HTTPS-only.
    return source.protocol === (local && development ? 'http:' : 'https:');
  } catch {
    return false;
  }
}
