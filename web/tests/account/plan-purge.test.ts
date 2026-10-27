import { describe, expect, it, vi } from 'vitest';
import { authorised, purgeRoute, PURGE_SECRET_MIN, type PurgeDeps } from '@/lib/server/plan-purge';

// The daily tombstone purge route (review-em-s B2 point 4): off unless enabled and called with the cron bearer, 404 otherwise with
// nothing read; a count on success; 503 with a SQLSTATE only on failure. The SQL itself is core/test/db/plan-doc.test.ts.

const SECRET = 's'.repeat(PURGE_SECRET_MIN);
const req = (auth?: string) => new Request('http://localhost:3000/api/internal/plan-purge', { headers: auth ? { authorization: auth } : {} });

function deps(env: ReturnType<PurgeDeps['env']>, rows: Record<string, unknown>[] = [{ n: 4 }]) {
  const queries: { sql: string; params?: readonly unknown[] }[] = [];
  const owner = vi.fn(async () => ({
    query: async (sql: string, params?: readonly unknown[]) => {
      queries.push({ sql, params });
      return { rows } as never;
    },
  }));
  return { d: { env: () => env, owner } satisfies PurgeDeps, owner, queries };
}

describe('plan purge route', () => {
  it('answers 404 and reads nothing when off, without a secret, with a short secret, or with the wrong bearer', async () => {
    for (const [env, auth] of [
      [{}, `Bearer ${SECRET}`],
      [{ CRON_SECRET: SECRET }, `Bearer ${SECRET}`],
      [{ PLAN_PURGE_ENABLED: '1' }, 'Bearer '],
      [{ PLAN_PURGE_ENABLED: '1', CRON_SECRET: 'short' }, 'Bearer short'],
      [{ PLAN_PURGE_ENABLED: '1', CRON_SECRET: SECRET }, undefined],
      [{ PLAN_PURGE_ENABLED: '1', CRON_SECRET: SECRET }, `Bearer ${SECRET}x`],
      [{ PLAN_PURGE_ENABLED: '1', CRON_SECRET: SECRET }, SECRET],
    ] as const) {
      const t = deps(env);
      const r = await purgeRoute(req(auth), t.d);
      expect(r.status).toBe(404);
      expect(t.owner).not.toHaveBeenCalled();
    }
  });

  it('runs planner_draft_purge on the owner connection and answers the count, privately', async () => {
    const t = deps({ PLAN_PURGE_ENABLED: '1', CRON_SECRET: SECRET });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const r = await purgeRoute(req(`Bearer ${SECRET}`), t.d);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ purged: 4 });
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(t.queries).toEqual([{ sql: 'select planner_draft_purge($1) as n', params: [30] }]);
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });

  it('answers 503 and logs a SQLSTATE only when the database fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d: PurgeDeps = {
      env: () => ({ PLAN_PURGE_ENABLED: '1', CRON_SECRET: SECRET }),
      owner: async () => ({ query: async () => { throw Object.assign(new Error('relation "planner_draft" user-a'), { code: '42883' }); } }),
    };
    const r = await purgeRoute(req(`Bearer ${SECRET}`), d);
    expect(r.status).toBe(503);
    const logged = err.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('42883');
    expect(logged).not.toContain('user-a');
    err.mockRestore();
  });

  it('compares the bearer in constant time and refuses near misses', () => {
    expect(authorised(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(authorised(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(authorised(null, SECRET)).toBe(false);
    expect(authorised(`Bearer ${SECRET}`, undefined)).toBe(false);
  });
});
