import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn() }));
vi.mock('@travel/core/db/profile.ts', () => ({ loadProfile: vi.fn() }));

import { getUser } from '@/lib/auth/server';
import { loadProfile } from '@travel/core/db/profile.ts';
import { POST } from '@/app/api/account/profile/party/route';

const req = (body: unknown, origin = 'http://localhost:3000') =>
  new Request('http://localhost:3000/api/account/profile/party/', { method: 'POST', headers: { origin, host: 'localhost:3000' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => vi.stubEnv('NODE_ENV', 'test'));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/account/profile/party/', () => {
  it('403s a foreign origin before any auth', async () => {
    const res = await POST(req({ userId: 'u' }, 'https://evil.test'));
    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('answers 401 for a forged user id and reads nothing', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(req({ userId: 'someone-else' }));
    expect(res.status).toBe(401);
    expect(getUser).toHaveBeenCalledWith('someone-else');
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('answers 400 for a body without a user id', async () => {
    expect((await POST(req('nope'))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
  });

  it('answers ages today and the adult count only: no dob, no age_as_of, no document keys', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', email: 'a@x.test' });
    (loadProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      travellers: { schema: 'travellers/1', adults: 2, children: [{ age: 6, age_as_of: '2020-01-01', dob: '2014-05-05' }, { age: 3, age_as_of: '2025-10-27' }] },
    });
    const res = await POST(req({ userId: 'u1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await res.text();
    const body = JSON.parse(text) as { adults: number; children: number[] };
    expect(Object.keys(body).sort()).toEqual(['adults', 'children']);
    expect(body.adults).toBe(2);
    expect(body.children).toHaveLength(2);
    for (const k of ['dob', 'age_as_of', 'schema', '2014-05-05']) expect(text).not.toContain(k);
    expect(loadProfile).toHaveBeenCalledWith('u1');
  });

  it('nothing saved, or the table missing: adults null; a failed read is 503', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', email: 'a@x.test' });
    (loadProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ travellers: null });
    expect(await (await POST(req({ userId: 'u1' }))).json()).toEqual({ adults: null, children: [] });
    (loadProfile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('x'), { code: '42P01' }));
    expect(await (await POST(req({ userId: 'u1' }))).json()).toEqual({ adults: null, children: [] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (loadProfile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    expect((await POST(req({ userId: 'u1' }))).status).toBe(503);
  });
});
