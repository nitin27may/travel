import 'server-only';
import { isIP } from 'node:net';

/**
 * The client IP for quota keys (EML-Q; email spec 5.2), from Vercel's `x-real-ip`, which Vercel's edge overwrites with the connecting
 * address (a browser cannot set it). Not `x-forwarded-for` (a client can prepend to it) and not `request.url`. Anything missing or not
 * an IP is `unknown`: one shared bucket, the strictest outcome. The value is only ever hashed (core/src/quota/keys.ts), never logged or
 * stored.
 */
export function clientIp(request: Request): string {
  const raw = request.headers.get('x-real-ip')?.trim() ?? '';
  return raw && isIP(raw) ? raw.toLowerCase() : 'unknown';
}
