/**
 * The bounced verifier (review GSI-S S7). When the verifier exchange on `/account/` fails (no challenge cookie: cookies blocked, or
 * another browser), the SDK's middleware redirects to `/sign-in/` and copies every query parameter, the verifier included. That second
 * address would then sit in the platform's request logs and in the address bar of a page that renders. The proxy keeps the parameter
 * (the card reads its presence as "didn't finish", string 16) but empties its value, so the verifier itself goes nowhere.
 *
 * The verifier still arrives once in the `/account/` request Neon sends the browser to; that log line is accepted (spec 7.1).
 */
export const VERIFIER_PARAM = 'neon_auth_session_verifier';

/** `location` with the verifier's value emptied, or null when it carries no verifier value (nothing to change). */
export function withoutVerifierValue(location: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(location, base);
  } catch {
    return null;
  }
  if (!url.searchParams.getAll(VERIFIER_PARAM).some((v) => v !== '')) return null;
  url.searchParams.delete(VERIFIER_PARAM);
  url.searchParams.append(VERIFIER_PARAM, '');
  return url.href;
}

/** A redirect answer of the middleware with the verifier's value emptied from its Location; any other answer unchanged. */
export function scrubVerifierRedirect<T extends Response | undefined>(response: T, requestUrl: string): T {
  if (!response || response.status < 300 || response.status > 399) return response;
  const location = response.headers.get('location');
  const clean = location ? withoutVerifierValue(location, requestUrl) : null;
  if (!clean) return response;
  try {
    response.headers.set('location', clean);
    return response;
  } catch {
    // Response.redirect() has immutable headers: answer a copy instead (Set-Cookie lines kept one by one).
    const headers = new Headers(response.headers);
    headers.set('location', clean);
    return new Response(null, { status: response.status, headers }) as T;
  }
}
