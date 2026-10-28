import 'server-only';
import { PROFILE_LIMITS } from '@travel/core/config/auth-limits.ts';
import { userHash } from '@travel/core/quota/keys.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';

// The travellers writes and the party read (review ACCT-PSEC S6; limits in core/src/config/auth-limits.ts PROFILE_LIMITS), through the
// same atomic quota store as the sign-in guard and the plans routes. The key is `userHash` (an HMAC of the user id under
// AUTH_QUOTA_SECRET mixed with the UTC day): the table never holds a user id. Never logs the id.
export type ProfileQuota = 'ok' | 'limited' | 'unavailable';
export type ProfileQuotaKind = keyof typeof PROFILE_LIMITS;

let pgStore: QuotaStore | undefined;

export interface ProfileQuotaDeps {
  store: () => QuotaStore | null;
  secret: () => string | undefined;
  production: () => boolean;
  now: () => Date;
}

export const defaultProfileQuotaDeps: ProfileQuotaDeps = {
  store: () => (process.env.DATABASE_URL ? (pgStore ??= createPgQuotaStore()) : null),
  secret: () => process.env.AUTH_QUOTA_SECRET,
  production: () => process.env.NODE_ENV === 'production',
  now: () => new Date(),
};

/** Count one call. Fails closed in production when the store or the secret is missing, or the store fails; development and tests skip. */
export async function takeProfile(kind: ProfileQuotaKind, userId: string, deps: ProfileQuotaDeps = defaultProfileQuotaDeps): Promise<ProfileQuota> {
  const secret = deps.secret();
  const store = deps.store();
  if (!store || !secret || secret.length < 16) return deps.production() ? 'unavailable' : 'ok';
  const { bucket, windows } = PROFILE_LIMITS[kind];
  try {
    const key = userHash(secret, userId, deps.now());
    const res = await store.take(windows.map((w) => ({ bucket, key, windowS: w.windowS, limit: w.limit })));
    return res.allowed ? 'ok' : 'limited';
  } catch {
    return 'unavailable';
  }
}
