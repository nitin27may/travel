import 'server-only';
import { getPool } from '@travel/core/db/client.ts';

/**
 * Sign out every session of an account that was created before `before` (EML-Q; EML-0 W2 finding: a password reset by code does NOT
 * revoke earlier sessions on Neon, so a thief with a stolen session would keep it). Called by the auth guard only after Neon answered
 * 200 to `/email-otp/reset-password` for that address, which proves the caller held the emailed code.
 *
 * How: a delete of the account's rows in Neon Auth's own `neon_auth.session` table, over the app's existing pooled connection (the
 * schema owner, which Neon Auth grants DELETE on that table). Verified on the child branch 25 Oct 2026: after the delete, Neon's
 * `get-session` answers null for the old cookie at once, while a session created later stays valid. Our app may still show the old
 * device as signed in for up to the SDK's session-data cookie lifetime (about 5 minutes) before it asks Neon again.
 *
 * Neon Auth's own revoke endpoints need a session of the user, which the reset flow does not have, so this is the supported route
 * that remains. Returns the number of sessions removed. Throws on a database error (the guard logs a code and alerts the owner).
 */
export async function revokeSessionsBefore(email: string, before: Date): Promise<number> {
  const pool = await getPool();
  const { rowCount } = await pool.query(
    'delete from neon_auth.session where "userId" in (select id from neon_auth."user" where lower(email) = lower($1)) and "createdAt" < $2',
    [email, before.toISOString()],
  );
  return rowCount ?? 0;
}
