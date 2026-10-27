import { authFlagsNow } from '@/lib/auth/flags';
import { createAuthGuard, defaultGuardDeps, type RouteCtx } from '@/lib/auth/guard';
import { getAuth } from '@/lib/auth/server';
import { authConfigured } from '@/lib/server/neon-env';

// Proxies the Managed Better Auth requests this site uses through the app, so no auth secret reaches the browser, and runs the auth
// guard (lib/auth/guard.ts: an allow-list of routes, same-origin, Turnstile, quotas, identical answers, session revocation after a
// reset). Fails closed (404) when auth is unconfigured or sign-in is switched off (`NEXT_PUBLIC_SIGN_IN`, hotfix A1 MF4), rather than
// throwing at module load.

async function off(): Promise<Response> {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
}

let guard: ReturnType<typeof createAuthGuard> | undefined;

function getGuard(): ReturnType<typeof createAuthGuard> {
  return (guard ??= createAuthGuard(
    defaultGuardDeps((req, ctx) => (req.method === 'GET' ? getAuth().handler().GET(req, ctx) : getAuth().handler().POST(req, ctx))),
  ));
}

const live = () => authConfigured() && authFlagsNow().signIn;

export async function GET(req: Request, ctx: RouteCtx): Promise<Response> {
  if (!live()) return off();
  return getGuard().handle(req, ctx);
}

export async function POST(req: Request, ctx: RouteCtx): Promise<Response> {
  if (!live()) return off();
  return getGuard().handle(req, ctx);
}
