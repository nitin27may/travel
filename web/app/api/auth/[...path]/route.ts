import { createAuthGuard, defaultGuardDeps, type RouteCtx } from '@/lib/auth/guard';
import { getAuth } from '@/lib/auth/server';
import { authConfigured } from '@/lib/server/neon-env';

// Proxies every Managed Better Auth request through the app, so no auth secret reaches the browser, and runs the auth guard
// (lib/auth/guard.ts: same-origin, Turnstile, quotas, identical answers, session revocation after a reset) on the calls that send mail
// or check a code or a password. Fails closed (404) when auth is unconfigured, rather than throwing at module load.

async function off(): Promise<Response> {
  return new Response('Not found', { status: 404 });
}

let guard: ReturnType<typeof createAuthGuard> | undefined;

function getGuard(): ReturnType<typeof createAuthGuard> {
  return (guard ??= createAuthGuard(
    defaultGuardDeps((req, ctx) => (req.method === 'GET' ? getAuth().handler().GET(req, ctx) : getAuth().handler().POST(req, ctx))),
  ));
}

export async function GET(req: Request, ctx: RouteCtx): Promise<Response> {
  if (!authConfigured()) return off();
  return getGuard().handle(req, ctx);
}

export async function POST(req: Request, ctx: RouteCtx): Promise<Response> {
  if (!authConfigured()) return off();
  return getGuard().handle(req, ctx);
}
