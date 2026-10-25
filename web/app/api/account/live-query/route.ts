import { getUser } from '@/lib/auth/server';
import { sealSignal } from '@/lib/server/drafts';
import { safeError } from '@/lib/server/safe-error';
import { sameOrigin } from '@/lib/server/same-origin';

const noStore = { 'Cache-Control': 'private, no-store' };

// Renewal is a read, so it is a Route Handler (a Server Action would queue behind pending writes).
// The browser sends the user id the page was loaded for; a session with no user or a different user
// gets 401, which tells the client to unload. The sealed query is a bearer token: never cached.
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: noStore });
  }
  let userId: unknown;
  try {
    ({ userId } = await request.json());
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers: noStore });
  }
  if (typeof userId !== 'string') {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers: noStore });
  }
  const user = await getUser(userId);
  if (!user) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: noStore });
  try {
    return Response.json(await sealSignal(user.id), { headers: noStore });
  } catch (e) {
    console.error('[account] sealSignal failed', safeError(e));
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers: noStore });
  }
}
