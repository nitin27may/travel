// Review ACCT-PSEC S6: the travellers writes (60 a minute) and the party read (30 a minute) per signed-in user, keyed on an HMAC of the
// user id, failing closed in production.
import { describe, expect, it } from 'vitest';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import { userHash } from '@travel/core/quota/keys.ts';
import { PROFILE_LIMITS, PROFILE_NAME } from '@travel/core/config/auth-limits.ts';
import { takeProfile, type ProfileQuotaDeps } from '@/lib/account/profile-quota';

const SECRET = 'a-quota-secret-long-enough';
const NOW = new Date('2026-10-27T10:00:00Z');
const deps = (over: Partial<ProfileQuotaDeps> = {}): ProfileQuotaDeps => {
  const store = createMemoryQuotaStore(() => NOW);
  return { store: () => store, secret: () => SECRET, production: () => true, now: () => NOW, ...over };
};

describe('PROFILE_LIMITS', () => {
  it('a separate block: own bucket names, 60 writes and 30 reads a minute', () => {
    expect(PROFILE_LIMITS.write).toEqual({ bucket: 'account:profile_write', windows: [{ windowS: 60, limit: 60 }] });
    expect(PROFILE_LIMITS.read).toEqual({ bucket: 'account:profile_read', windows: [{ windowS: 60, limit: 30 }] });
    expect(new Set([PROFILE_LIMITS.write.bucket, PROFILE_LIMITS.read.bucket, PROFILE_NAME.bucket]).size).toBe(3);
  });
});

describe('takeProfile', () => {
  it('allows 60 writes and refuses the 61st, per user; reads count apart', async () => {
    const d = deps();
    for (let i = 0; i < 60; i++) expect(await takeProfile('write', 'u1', d)).toBe('ok');
    expect(await takeProfile('write', 'u1', d)).toBe('limited');
    expect(await takeProfile('write', 'u2', d)).toBe('ok');
    expect(await takeProfile('read', 'u1', d)).toBe('ok');
  });
  it('allows 30 reads and refuses the 31st', async () => {
    const d = deps();
    for (let i = 0; i < 30; i++) expect(await takeProfile('read', 'u1', d)).toBe('ok');
    expect(await takeProfile('read', 'u1', d)).toBe('limited');
  });
  it('keys on userHash: no user id reaches the store', async () => {
    const store = createMemoryQuotaStore(() => NOW);
    await takeProfile('write', 'user-123', deps({ store: () => store }));
    const rows = store.rows();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('user-123');
    expect(rows[0].key).toBe(userHash(SECRET, 'user-123', NOW));
  });
  it('fails closed in production without the store, the secret, or a working store; skips in development', async () => {
    expect(await takeProfile('write', 'u', deps({ store: () => null }))).toBe('unavailable');
    expect(await takeProfile('read', 'u', deps({ secret: () => 'short' }))).toBe('unavailable');
    const broken = { take: async () => { throw new Error('down'); }, peek: async () => 0 };
    expect(await takeProfile('write', 'u', deps({ store: () => broken }))).toBe('unavailable');
    expect(await takeProfile('write', 'u', deps({ store: () => null, production: () => false }))).toBe('ok');
  });
});
