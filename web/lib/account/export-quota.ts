import 'server-only';
import { createHmac } from 'node:crypto';
import { PROFILE_EXPORT } from '@travel/core/config/auth-limits.ts';
import { createPgQuotaStore } from '@travel/core/quota/pg.ts';
import { defaultNameQuotaDeps, type NameQuota, type NameQuotaDeps } from './name-quota';

// The "Download my data" limit (5 an hour per user), through the same atomic quota store as the name limit. The key is an HMAC of the
// user id under AUTH_QUOTA_SECRET mixed with the UTC day and a bucket label of its own: the table never holds a user id.
export type ExportQuota = NameQuota;

export const defaultExportQuotaDeps: NameQuotaDeps = {
  ...defaultNameQuotaDeps,
  store: () => (process.env.DATABASE_URL ? (exportStore ??= createPgQuotaStore()) : null),
};
let exportStore: ReturnType<typeof createPgQuotaStore> | undefined;

export function exportKey(secret: string, userId: string, at: Date): string {
  const day = Math.floor(at.getTime() / 86_400_000);
  return createHmac('sha256', secret).update(`profile_export\u0000${day}\u0000${userId}`).digest('hex').slice(0, 32);
}

/** Count one download. Fails closed in production when the store or the secret is missing; only development and tests skip the limit. */
export async function takeExport(userId: string, deps: NameQuotaDeps = defaultExportQuotaDeps): Promise<ExportQuota> {
  const secret = deps.secret();
  const store = deps.store();
  if (!store || !secret || secret.length < 16) return deps.production() ? 'unavailable' : 'ok';
  try {
    const key = exportKey(secret, userId, deps.now());
    const res = await store.take(PROFILE_EXPORT.windows.map((w) => ({ bucket: PROFILE_EXPORT.bucket, key, windowS: w.windowS, limit: w.limit })));
    return res.allowed ? 'ok' : 'limited';
  } catch {
    return 'unavailable';
  }
}
