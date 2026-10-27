import 'server-only';
import { isIP } from 'node:net';

/**
 * The client IP for quota keys (EML-Q; email spec 5.2). The value is only ever hashed (core/src/quota/keys.ts), never logged or stored.
 *
 * Source, in order (hotfix A1, review SF8):
 *   1. `x-vercel-forwarded-for`: Vercel's own header, set by its edge from the connection it accepted. Vercel documents it as the one
 *      that survives a proxy in front of the deployment rewriting `x-forwarded-for`. If it ever holds a list, the RIGHT-most entry is
 *      taken: that is the hop Vercel saw, and every entry to its left could have been written by the client.
 *   2. `x-real-ip`: also set by Vercel's edge, the connecting address.
 * Never `x-forwarded-for` (a client can prepend to it), `cf-connecting-ip` (a client can send it straight to Vercel), or `request.url`.
 * Anything missing or not an IP is `unknown`: one shared bucket, the strictest outcome.
 *
 * Gotcha (domain move): with Cloudflare's proxy (orange cloud) in front of Vercel, both headers carry a Cloudflare edge address, so
 * visitors share a few buckets and the per-IP limits bite everyone. Before turning that proxy on, trust `cf-connecting-ip` only from
 * Cloudflare (for example a secret header added by a Cloudflare transform rule and checked here), or keep the record DNS-only.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  const fromVercel = vercel ? (vercel.split(',').pop() ?? '').trim() : '';
  if (fromVercel && isIP(fromVercel)) return fromVercel.toLowerCase();
  const raw = request.headers.get('x-real-ip')?.trim() ?? '';
  return raw && isIP(raw) ? raw.toLowerCase() : 'unknown';
}
