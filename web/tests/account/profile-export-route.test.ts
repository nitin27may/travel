import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn() }));
vi.mock('@travel/core/db/profile.ts', () => ({ loadProfile: vi.fn() }));
vi.mock('@/lib/server/drafts', () => ({ readDrafts: vi.fn() }));
vi.mock('@/lib/account/export-quota', () => ({ takeExport: vi.fn() }));

import { getUser } from '@/lib/auth/server';
import { loadProfile } from '@travel/core/db/profile.ts';
import { readDrafts } from '@/lib/server/drafts';
import { takeExport } from '@/lib/account/export-quota';
import { GET } from '@/app/api/account/profile/export/route';
import { PROFILE_EXPORT } from '@travel/core/config/auth-limits.ts';
import { createMemoryQuotaStore } from '@travel/core/quota/memory.ts';

const m = <T extends (...a: never[]) => unknown>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const req = (headers: Record<string, string> = {}, url = 'http://localhost:3000/api/account/profile/export/?userId=evil') =>
  new Request(url, { method: 'GET', headers: { host: 'localhost:3000', ...headers } });

const DOB = '2014-05-05';
const profile = {
  exists: true,
  travellers: { schema: 'travellers/1', adults: 2, children: [{ age: 6, age_as_of: '2026-01-01', dob: DOB }] },
  travellersInvalid: false,
  travellersSavedAt: '2026-10-20T00:00:00.000Z',
  travellersConsentedAt: '2026-10-19T00:00:00.000Z',
  setupDoneAt: '2026-10-19T00:00:00.000Z',
  revision: 3,
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  m(getUser).mockResolvedValue({ id: 'u1', email: 'a@x.test', name: 'Ann' });
  m(takeExport).mockResolvedValue('ok');
  m(loadProfile).mockResolvedValue(profile);
  m(readDrafts).mockResolvedValue([{ id: 'd1', title: 'Dolomites', created_at: new Date('2026-10-01T00:00:00Z'), updated_at: new Date('2026-10-02T00:00:00Z') }]);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/account/profile/export/', () => {
  it('answers the person\'s own document as a private, no-store, nosniff attachment', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="travel-account.json"');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = JSON.parse(await res.text());
    expect(body.email).toBe('a@x.test');
    expect(body.name).toBe('Ann');
    expect(body.travellers.children[0].dob).toBe(DOB);
    expect(body.travellersConsentedAt).toBe('2026-10-19T00:00:00.000Z');
    expect(body.drafts).toEqual([{ id: 'd1', title: 'Dolomites', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' }]);
    // plan documents are not exported until plan sync ships
    expect(Object.keys(body)).not.toContain('plans');
  });

  it('reads the user id from the session only: a userId in the query or a header changes nothing', async () => {
    await GET(req({ 'x-user-id': 'someone-else' }));
    expect(getUser).toHaveBeenCalledWith();
    expect(loadProfile).toHaveBeenCalledWith('u1');
    expect(readDrafts).toHaveBeenCalledWith('u1');
    expect(takeExport).toHaveBeenCalledWith('u1');
  });

  it('401s without a session, with private headers, and reads nothing', async () => {
    m(getUser).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Content-Disposition')).toBeNull();
    expect(takeExport).not.toHaveBeenCalled();
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('403s a foreign origin and a cross-site fetch before any auth', async () => {
    expect((await GET(req({ origin: 'https://evil.test' }))).status).toBe(403);
    expect((await GET(req({ 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
    expect((await GET(req({ 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
  });

  it('429s when the quota is full and reads nothing; 503s when the quota cannot be checked', async () => {
    m(takeExport).mockResolvedValueOnce('limited');
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(loadProfile).not.toHaveBeenCalled();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m(takeExport).mockResolvedValueOnce('unavailable');
    expect((await GET(req())).status).toBe(503);
  });

  it('a person with no row gets an empty profile; a missing table still answers; a failed read is 503', async () => {
    m(loadProfile).mockResolvedValueOnce({ ...profile, exists: false, travellers: null, travellersConsentedAt: null });
    expect((await (await GET(req())).json()).travellers).toBeNull();
    m(loadProfile).mockRejectedValueOnce(Object.assign(new Error('x'), { code: '42P01' }));
    expect((await GET(req())).status).toBe(200);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m(loadProfile).mockRejectedValueOnce(new Error('db down'));
    expect((await GET(req())).status).toBe(503);
  });

  it('a failed drafts read leaves drafts null and still answers the file', async () => {
    m(readDrafts).mockRejectedValueOnce(new Error('db down'));
    expect((await (await GET(req())).json()).drafts).toBeNull();
  });

  it('logs nothing of the document: a planted date of birth never reaches the console', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => undefined));
    await GET(req());
    m(loadProfile).mockRejectedValueOnce(Object.assign(new Error(`bad ${DOB}`), { code: '23505' }));
    await GET(req());
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(DOB);
    expect(logged).not.toContain('age_as_of');
    expect(logged).not.toContain('a@x.test');
  });

  it('does not answer through the public respond() allow-list', () => {
    const src = readFileSync(path.join(fileURLToPath(new URL('../../', import.meta.url)), 'app', 'api', 'account', 'profile', 'export', 'route.ts'), 'utf8');
    expect(src).not.toMatch(/import[^;]*\brespond\b/);
    expect(src).not.toMatch(/\b(?:console\.\w+)\([^)]*(profile|travellers|dob)\b/);
  });
});

describe('the export quota (5 an hour per user)', () => {
  it('is its own block, 5 an hour, and keys on an HMAC (no user id in the store)', async () => {
    expect(PROFILE_EXPORT.bucket).toBe('account:profile_export');
    expect(PROFILE_EXPORT.windows).toEqual([{ windowS: 3600, limit: 5 }]);
    const { takeExport: real, exportKey } = await vi.importActual<typeof import('@/lib/account/export-quota')>('@/lib/account/export-quota');
    const NOW = new Date('2026-10-27T10:00:00Z');
    const store = createMemoryQuotaStore(() => NOW);
    const deps = { store: () => store, secret: () => 'a-quota-secret-long-enough', production: () => true, now: () => NOW };
    for (let i = 0; i < 5; i++) expect(await real('user-123', deps)).toBe('ok');
    expect(await real('user-123', deps)).toBe('limited');
    expect(await real('user-456', deps)).toBe('ok');
    expect(JSON.stringify(store.rows())).not.toContain('user-123');
    expect(store.rows()[0].key).toBe(exportKey('a-quota-secret-long-enough', 'user-123', NOW));
    expect(await real('u', { ...deps, store: () => null })).toBe('unavailable');
    expect(await real('u', { ...deps, store: () => null, production: () => false })).toBe('ok');
  });
});
