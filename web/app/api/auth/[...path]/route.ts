import { getAuth } from '@/lib/auth/server';
import { authConfigured } from '@/lib/server/neon-env';

// Proxies every Managed Better Auth request through the app, so no auth secret reaches the browser.
// Fails closed (404) when auth is unconfigured, rather than throwing at module load.
type Ctx = { params: Promise<{ path: string[] }> };

async function off(): Promise<Response> {
  return new Response('Not found', { status: 404 });
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  if (!authConfigured()) return off();
  return getAuth().handler().GET(req, ctx);
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  if (!authConfigured()) return off();
  return getAuth().handler().POST(req, ctx);
}
