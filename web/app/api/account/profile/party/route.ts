import { getUser } from '@/lib/auth/server';
import { takeProfile } from '@/lib/account/profile-quota';
import { safeError } from '@/lib/server/safe-error';
import { sameOrigin } from '@/lib/server/same-origin';
import { loadProfile } from '@travel/core/db/profile.ts';
import { isoDay, partyOf } from '@travel/core/schema/travellers.ts';

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * The signed-in person's saved travellers as a plain party, for the sign-in card and Mine to seed the device (ACCT-P2; spec 5.2). Ages
 * today and the adult count only: never a date of birth, `age_as_of` or any other field of the document. `adults: null` = nothing saved.
 * Same-origin POST with `{ userId }` like /api/account/drafts/; `getUser(userId)` answers null for a forged id, so another person's
 * travellers cannot be read. The session is read fresh at Neon (review ACCT-PSEC S1), each call takes one from the user's
 * `account:profile_read` bucket (S6), and a body that is not JSON by its content type is refused (N1). Private, never cached. Logs fixed
 * codes only.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: noStore });
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get('content-type') ?? '')) return Response.json({ error: 'BAD_REQUEST' }, { status: 415, headers: noStore });
  let userId: unknown;
  try {
    ({ userId } = await request.json());
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers: noStore });
  }
  if (typeof userId !== 'string') return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers: noStore });
  const user = await getUser(userId, { fresh: true });
  if (!user) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: noStore });
  const quota = await takeProfile('read', user.id);
  if (quota === 'limited') return Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { ...noStore, 'Retry-After': '60' } });
  if (quota === 'unavailable') {
    console.error('[account] profile_quota_unavailable');
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers: noStore });
  }
  try {
    const profile = await loadProfile(user.id);
    if (!profile.travellers) return Response.json({ adults: null, children: [] }, { headers: noStore });
    const party = partyOf(profile.travellers, isoDay(new Date()));
    return Response.json({ adults: party.adults, children: party.children }, { headers: noStore });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === '42P01') return Response.json({ adults: null, children: [] }, { headers: noStore });
    console.error('[account] party_read_failed', safeError(e));
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers: noStore });
  }
}
