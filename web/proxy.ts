import type { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth/server';
import { authConfigured } from '@/lib/server/neon-env';

// Signed-out page loads of a private route get an HTTP redirect to /sign-in. This is for the user
// experience only: every Server Component, Route Handler and server action checks the session again
// with getUser() — proxy.ts is not the security boundary. Server Actions skip it (they carry a
// `next-action` header) and answer UNAUTHENTICATED themselves. When auth is unconfigured, the proxy
// steps aside and the page fails closed with its own signed-out state.
let middleware: ReturnType<ReturnType<typeof getAuth>['middleware']> | undefined;

export default function proxy(request: NextRequest) {
  if (request.headers.has('next-action')) return;
  if (!authConfigured()) return;
  middleware ??= getAuth().middleware({ loginUrl: '/sign-in/' });
  return middleware(request);
}

// Only private app pages. /sign-in, /sign-up and the public catalogue are not matched, and the
// /api/* routes answer 401 themselves. Add new private app pages here.
export const config = { matcher: ['/account/:path*'] };
