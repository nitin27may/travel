import { describe, expect, it } from 'vitest';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';
import { nameKey, takeNameChange, type NameQuotaDeps } from '@/lib/account/name-quota';

const SECRET = 'a-quota-secret-long-enough';
const NOW = new Date('2026-10-27T10:00:00Z');
const deps = (over: Partial<NameQuotaDeps> = {}): NameQuotaDeps => {
  const store = createMemoryQuotaStore(() => NOW);
  return { store: () => store, secret: () => SECRET, production: () => true, now: () => NOW, ...over };
};

describe('takeNameChange (10 an hour per user)', () => {
  it('allows 10 and refuses the 11th, per user', async () => {
    const d = deps();
    for (let i = 0; i < 10; i++) expect(await takeNameChange('u1', d)).toBe('ok');
    expect(await takeNameChange('u1', d)).toBe('limited');
    expect(await takeNameChange('u2', d)).toBe('ok');
  });
  it('keys on a hash: no user id reaches the store', async () => {
    const store = createMemoryQuotaStore(() => NOW);
    await takeNameChange('user-123', deps({ store: () => store }));
    const rows = store.rows();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('user-123');
    expect(rows[0].key).toBe(nameKey(SECRET, 'user-123', NOW));
    expect(rows[0].key).toMatch(/^[0-9a-f]{32}$/);
  });
  it('fails closed in production without the store or secret, skips in development', async () => {
    expect(await takeNameChange('u', deps({ store: () => null }))).toBe('unavailable');
    expect(await takeNameChange('u', deps({ secret: () => undefined }))).toBe('unavailable');
    expect(await takeNameChange('u', deps({ store: () => null, production: () => false }))).toBe('ok');
  });
  it('fails closed when the store throws', async () => {
    const broken = { take: async () => { throw new Error('down'); }, peek: async () => 0 };
    expect(await takeNameChange('u', deps({ store: () => broken }))).toBe('unavailable');
  });
});
