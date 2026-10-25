import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn() }));
vi.mock('@/lib/server/drafts', () => ({ readDrafts: vi.fn() }));

import { getUser } from '@/lib/auth/server';
import { readDrafts } from '@/lib/server/drafts';
import { POST } from '@/app/api/account/drafts/route';

const req = (body: unknown) => new Request('http://localhost/api/account/drafts', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

const reqFromOrigin = (origin: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/account/drafts', {
    method: 'POST',
    headers: { origin, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => vi.stubEnv('NODE_ENV', 'test'));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('authenticated drafts re-fetch route', () => {
  it.each([
    'https://evil.test',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    'https://127.0.0.1:3000',
    'null',
    'not an origin',
  ])('403s origin %s before any auth or read', async (origin) => {
    const res = await POST(reqFromOrigin(origin, { userId: 'user-a' }, {
      host: '127.0.0.1:3000',
      'x-forwarded-host': origin.replace(/^https?:\/\//, ''),
      'x-forwarded-proto': 'https',
    }));
    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
    expect(readDrafts).not.toHaveBeenCalled();
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each(['localhost:3000', '127.0.0.1:3000'])('allows same-origin %s through to auth despite Next URL normalization', async (host) => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(reqFromOrigin(`http://${host}`, { userId: 'user-a' }, { host }));
    expect(res.status).toBe(401);
    expect(getUser).toHaveBeenCalledWith('user-a');
    expect(readDrafts).not.toHaveBeenCalled();
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('rejects an Origin-bearing request without Host', async () => {
    const res = await POST(reqFromOrigin('http://localhost:3000', { userId: 'user-a' }));
    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
    expect(readDrafts).not.toHaveBeenCalled();
  });

  describe.each(['localhost:3000', '127.0.0.1:3000', '[::1]:3000'])('protocol policy for %s', (host) => {
    it.each([
      ['development', 'http', 401],
      ['test', 'http', 401],
      ['development', 'https', 403],
      ['test', 'https', 403],
      ['production', 'http', 403],
      ['production', 'https', 401],
    ] as const)('%s: %s Origin ignores spoofed forwarded protocol and rewritten URL', async (env, protocol, status) => {
      vi.stubEnv('NODE_ENV', env);
      vi.mocked(getUser).mockResolvedValue(null);
      for (const forwarded of ['http', 'https']) {
        // Reproduce Next's request.url rewrite from X-Forwarded-Proto, not just the header.
        const res = await POST(new Request(`${forwarded}://localhost:3000/api/account/drafts`, {
          method: 'POST',
          headers: { host, origin: `${protocol}://${host}`, 'x-forwarded-proto': forwarded },
          body: JSON.stringify({ userId: 'user-a' }),
        }));
        expect(res.status).toBe(status);
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      }
      expect(getUser).toHaveBeenCalledTimes(status === 401 ? 2 : 0);
      expect(readDrafts).not.toHaveBeenCalled();
    });
  });

  it.each(['development', 'test', 'production'])('%s requires HTTPS for non-loopback hosts regardless of URL/forwarded protocol', async (env) => {
    vi.stubEnv('NODE_ENV', env);
    vi.mocked(getUser).mockResolvedValue(null);
    for (const protocol of ['http', 'https']) {
      const res = await POST(reqFromOrigin(`${protocol}://app.example.test`, { userId: 'user-a' }, {
        host: 'app.example.test', 'x-forwarded-proto': 'http',
      }));
      expect(res.status).toBe(protocol === 'https' ? 401 : 403);
    }
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(readDrafts).not.toHaveBeenCalled();
  });

  it('401s an anonymous request and never reads', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(req({ userId: 'user-a' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(readDrafts).not.toHaveBeenCalled();
  });

  it('401s when the page was loaded for a different user (getUser compares the id)', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(req({ userId: 'someone-else' }));
    expect(res.status).toBe(401);
    expect(getUser).toHaveBeenCalledWith('someone-else');
    expect(readDrafts).not.toHaveBeenCalled();
  });

  it('400s a malformed body', async () => {
    const res = await POST(req('not json'));
    expect(res.status).toBe(400);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('400s when userId is missing or not a string', async () => {
    const res = await POST(req({ userId: 123 }));
    expect(res.status).toBe(400);
  });

  it('reads the drafts for the verified session user and does not cache', async () => {
    const rows = [{ id: 'd1', title: 'Rome', created_at: new Date('2026-01-01T00:00:00Z'), updated_at: new Date('2026-01-02T00:00:00Z') }];
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-a', email: 'a@example.test' });
    (readDrafts as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
    const res = await POST(req({ userId: 'user-a' }));
    expect(res.status).toBe(200);
    expect(readDrafts).toHaveBeenCalledWith('user-a');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = (await res.json()) as { rows: { id: string }[] };
    expect(body.rows.map((r) => r.id)).toEqual(['d1']);
  });

  it('503s when the read fails (fail closed)', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-a', email: 'a@example.test' });
    (readDrafts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
    const res = await POST(req({ userId: 'user-a' }));
    expect(res.status).toBe(503);
  });
});
