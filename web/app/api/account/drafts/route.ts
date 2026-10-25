import { getUser } from '@/lib/auth/server';
import { readDrafts } from '@/lib/server/drafts';
import { safeError } from '@/lib/server/safe-error';
import { sameOrigin } from '@/lib/server/same-origin';

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Authenticated re-fetch of a user's drafts under RLS. The live subscription watches the content-free
 * signal stream (Neon Realtime rejects any RLS relation, so it never carries draft content); when the
 * signal version bumps, the client calls this route to pull the actual rows. Every request re-verifies
 * the session and reads through `withUserTransaction` (the `travel_app` role + `app.user_id` GUC), so a
 * user can only ever read their own drafts — the signal stream is never trusted for content. Private,
 * never cached.
 */
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
  // getUser(userId) returns null when there is no session or it belongs to a different user, so a
  // forged body can never read another user's drafts.
  const user = await getUser(userId);
  if (!user) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: noStore });
  try {
    const rows = await readDrafts(user.id);
    return Response.json({ rows }, { headers: noStore });
  } catch (e) {
    console.error('[account] readDrafts failed', safeError(e));
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers: noStore });
  }
}
