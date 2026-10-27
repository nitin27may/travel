import { getUser } from '@/lib/auth/server';
import { takeExport } from '@/lib/account/export-quota';
import { readDrafts } from '@/lib/server/drafts';
import { safeError } from '@/lib/server/safe-error';
import { sameOrigin } from '@/lib/server/same-origin';
import { loadProfile } from '@travel/core/db/profile.ts';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } as const;
const FILENAME = 'travel-account.json';

/**
 * PRIVATE responder (spec 6.5, amended 27 Oct 2026): the body is the person's own data and carries keys the privacy detector refuses in
 * public output (`travellers`, `dob`, `age_as_of`), so it never goes through the public `respond()` allow-list. Errors are fixed codes.
 */
const fail = (error: string, status: number, extra: Record<string, string> = {}): Response =>
  Response.json({ error }, { status, headers: { ...PRIVATE_HEADERS, ...extra } });

const file = (body: object): Response =>
  new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status: 200,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${FILENAME}"` },
  });

/**
 * "Download my data" (ACCT-P3; spec 6.5 and 10). The signed-in person's own profile as a JSON file: email, name, the saved travellers
 * (as stored, with any date of birth), and when they were saved and consented. The user id comes only from the session, never from the
 * request. Same-origin (a cross-site request is refused, and so is a browser that says it is cross-site), 5 an hour per user, and
 * nothing of the document reaches a log.
 *
 * Plan documents (`planner_draft` / `plan_draft`) are NOT exported yet: they join this file when plan sync ships (EM-1 and the
 * export note in docs/v2/features/account-profile-and-travellers.md 6.5).
 */
export async function GET(request: Request): Promise<Response> {
  if (!sameOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site') return fail('FORBIDDEN', 403);
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 401);
  const quota = await takeExport(user.id);
  if (quota === 'limited') return fail('RATE_LIMITED', 429, { 'Retry-After': '3600' });
  if (quota === 'unavailable') {
    console.error('[account] profile_export_quota_unavailable');
    return fail('SERVICE_UNAVAILABLE', 503);
  }
  try {
    const profile = await loadProfile(user.id);
    // The saved-trip titles (spec 6.5). A failed read leaves `drafts: null` rather than failing the file the person asked for.
    const drafts = await readDrafts(user.id).then(
      (rows) => rows.map((d) => ({ id: d.id, title: d.title, createdAt: new Date(d.created_at).toISOString(), updatedAt: new Date(d.updated_at).toISOString() })),
      () => null,
    );
    const body = {
      exportedAt: new Date().toISOString(),
      email: user.email,
      name: user.name ?? null,
      travellers: profile.travellers,
      travellersUnreadable: profile.travellersInvalid,
      travellersSavedAt: profile.travellersSavedAt,
      travellersConsentedAt: profile.travellersConsentedAt,
      setupDoneAt: profile.setupDoneAt,
      drafts,
    };
    return file(body);
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === '42P01') {
      // The table is not there yet: the person has no profile to export.
      return file({ exportedAt: new Date().toISOString(), email: user.email, name: user.name ?? null, travellers: null });
    }
    console.error('[account] profile_export_failed', safeError(e));
    return fail('SERVICE_UNAVAILABLE', 503);
  }
}
