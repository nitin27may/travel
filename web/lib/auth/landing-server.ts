import 'server-only';
import { cache } from 'react';
import { accountRows } from './account-rows';
import type { SessionUser } from './server';
import { googleLanding, type Landing } from './landing';

/**
 * The landing for this signed-in user (GSI-2; copy page strings 23 to 28), from Neon's account rows read on the server with the
 * session cookie. Never from the address. Once per request: the page decides the redirect and the body shows the notice.
 *
 * Fails closed: an error, a throw or rows without `providerId` and `createdAt` (copy page UC3) is `unknown`, which keeps the visitor
 * on Account instead of following `next`, so a link is never passed over in silence. Logs a fixed code only.
 */
const landingFor = cache(async (userId: string, userCreatedAt: string | number | null): Promise<Landing> => {
  // The rows are read once per request and shared with "Ways to sign in" (GSI-WAYS, account-rows.ts); it logs its own failures.
  const res = await accountRows(userId);
  if (!res.ok) return 'unknown';
  const landing = googleLanding({ userCreatedAt, accounts: res.data, now: Date.now() });
  if (landing === 'unknown') console.warn('[account] list-accounts answer unreadable');
  return landing;
});

/** `createdAt` of the session user, as a cache-friendly primitive (`SessionUser` does not declare it; Neon sends it). */
function createdAtOf(user: SessionUser): string | number | null {
  const raw = (user as SessionUser & { createdAt?: unknown }).createdAt;
  if (raw instanceof Date) return raw.getTime();
  return typeof raw === 'string' || typeof raw === 'number' ? raw : null;
}

export function accountLanding(user: SessionUser): Promise<Landing> {
  return landingFor(user.id, createdAtOf(user));
}
