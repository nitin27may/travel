import 'server-only';
import { createHmac } from 'node:crypto';
import { PROFILE_NAME } from '@travel/core/config/auth-limits.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import type { QuotaStore } from '@travel/core/quota/store.ts';

// The 10-changes-an-hour limit on the display name (spec 4.2), through the same atomic quota store as the sign-in guard. The key is an
// HMAC of the user id under AUTH_QUOTA_SECRET mixed with the UTC day (as core/src/quota/keys.ts): the table never holds a user id.
export type NameQuota = 'ok' | 'limited' | 'unavailable';

let pgStore: QuotaStore | undefined;

export interface NameQuotaDeps {
  store: () => QuotaStore | null;
  secret: () => string | undefined;
  production: () => boolean;
  now: () => Date;
}

export const defaultNameQuotaDeps: NameQuotaDeps = {
  store: () => (process.env.DATABASE_URL ? (pgStore ??= createPgQuotaStore()) : null),
  secret: () => process.env.AUTH_QUOTA_SECRET,
  production: () => process.env.NODE_ENV === 'production',
  now: () => new Date(),
};

export function nameKey(secret: string, userId: string, at: Date): string {
  const day = Math.floor(at.getTime() / 86_400_000);
  return createHmac('sha256', secret).update(`profile_name\u0000${day}\u0000${userId}`).digest('hex').slice(0, 32);
}

/** Count one change. Fails closed in production when the store or the secret is missing; only development and tests skip the limit. */
export async function takeNameChange(userId: string, deps: NameQuotaDeps = defaultNameQuotaDeps): Promise<NameQuota> {
  const secret = deps.secret();
  const store = deps.store();
  if (!store || !secret || secret.length < 16) return deps.production() ? 'unavailable' : 'ok';
  try {
    const key = nameKey(secret, userId, deps.now());
    const res = await store.take(PROFILE_NAME.windows.map((w) => ({ bucket: PROFILE_NAME.bucket, key, windowS: w.windowS, limit: w.limit })));
    return res.allowed ? 'ok' : 'limited';
  } catch {
    return 'unavailable';
  }
}
