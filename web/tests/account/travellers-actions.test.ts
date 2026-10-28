import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), finish: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn(), getAuth: () => ({}), authErrorCode: () => 'unknown' }));
vi.mock('@/lib/account/name-quota', () => ({ takeNameChange: vi.fn() }));
const quota = vi.hoisted(() => ({ take: vi.fn() }));
vi.mock('@/lib/account/profile-quota', () => ({ takeProfile: quota.take }));
vi.mock('@travel/core/db/index.ts', () => ({ withUserTransaction: vi.fn() }));
vi.mock('@travel/core/db/profile.ts', () => ({ saveTravellers: db.save, removeTravellers: db.remove, finishSetup: db.finish, loadProfile: db.load }));

import { getUser } from '@/lib/auth/server';
import { finishSetup, removeTravellers, saveTravellers } from '@/app/account/actions';

const USER = { id: 'user-a', email: 'a@example.test' };
const doc = { schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: '2026-10-27', dob: '2019-03-15' }] };
const as = (u: unknown) => (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(u);

beforeEach(() => quota.take.mockResolvedValue('ok'));
afterEach(() => vi.resetAllMocks());

describe('travellers actions', () => {
  it('refuse a missing or different session before touching the database', async () => {
    as(null);
    expect(await saveTravellers('user-b', { doc, revision: 0 })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
    expect(await removeTravellers('user-b', { revision: 0 })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
    expect(await finishSetup('user-b')).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
    expect(db.save).not.toHaveBeenCalled();
    expect(db.remove).not.toHaveBeenCalled();
    expect(db.finish).not.toHaveBeenCalled();
  });

  it('save passes the SESSION id, the revision and finishSetup; answers saved with the next revision', async () => {
    as(USER);
    db.save.mockResolvedValue({ kind: 'saved', revision: 1 });
    expect(await saveTravellers(USER.id, { doc, revision: 0, finishSetup: true })).toEqual({ kind: 'saved', revision: 1 });
    expect(db.save).toHaveBeenCalledWith('user-a', doc, 0, { finishSetup: true });
  });

  it('maps conflict and rejected; a bad revision is refused; a thrown error is a service answer with no document in the log', async () => {
    as(USER);
    db.save.mockResolvedValueOnce({ kind: 'conflict' }).mockResolvedValueOnce({ kind: 'rejected', issues: ['$.children[0].dob: future'] });
    expect(await saveTravellers(USER.id, { doc, revision: 3 })).toEqual({ kind: 'conflict' });
    expect(await saveTravellers(USER.id, { doc, revision: 3 })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT', issues: ['$.children[0].dob: future'] });
    expect(await saveTravellers(USER.id, { doc, revision: 'x' })).toMatchObject({ kind: 'rejected', reason: 'INVALID_INPUT' });
    const logs: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => void logs.push(a));
    db.save.mockRejectedValueOnce(Object.assign(new Error('boom 2019-03-15'), { code: '08006' }));
    expect(await saveTravellers(USER.id, { doc, revision: 1 })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(logs)).not.toContain('2019-03-15');
    expect(JSON.stringify(logs)).not.toContain('travellers/1');
  });

  it('remove and finish use the session id', async () => {
    as(USER);
    db.remove.mockResolvedValue({ kind: 'saved', revision: 2 });
    db.finish.mockResolvedValue('2026-10-27T00:00:00.000Z');
    expect(await removeTravellers(USER.id, { revision: 1 })).toEqual({ kind: 'saved', revision: 2 });
    expect(db.remove).toHaveBeenCalledWith('user-a', 1);
    expect(await finishSetup(USER.id)).toEqual({ kind: 'done' });
    expect(db.finish).toHaveBeenCalledWith('user-a');
  });

  it('read the session fresh at Neon, not the 300 s cookie (review ACCT-PSEC S1)', async () => {
    as(USER);
    db.save.mockResolvedValue({ kind: 'saved', revision: 1 });
    db.remove.mockResolvedValue({ kind: 'saved', revision: 2 });
    await saveTravellers(USER.id, { doc, revision: 0 });
    await removeTravellers(USER.id, { revision: 1 });
    await finishSetup(USER.id);
    expect((getUser as ReturnType<typeof vi.fn>).mock.calls).toEqual([[USER.id, { fresh: true }], [USER.id, { fresh: true }], [USER.id, { fresh: true }]]);
  });

  it('take one from the write bucket each, by the session id; over the limit answers RATE_LIMITED before the database (S6)', async () => {
    as(USER);
    quota.take.mockResolvedValue('limited');
    expect(await saveTravellers(USER.id, { doc, revision: 0 })).toEqual({ kind: 'rejected', reason: 'RATE_LIMITED' });
    expect(await removeTravellers(USER.id, { revision: 1 })).toEqual({ kind: 'rejected', reason: 'RATE_LIMITED' });
    expect(await finishSetup(USER.id)).toEqual({ kind: 'rejected', reason: 'RATE_LIMITED' });
    expect(quota.take.mock.calls).toEqual([['write', 'user-a'], ['write', 'user-a'], ['write', 'user-a']]);
    expect(db.save).not.toHaveBeenCalled();
    expect(db.remove).not.toHaveBeenCalled();
    expect(db.finish).not.toHaveBeenCalled();
  });

  it('an unavailable quota store fails closed as SERVICE_UNAVAILABLE; a signed-out call takes nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    as(USER);
    quota.take.mockResolvedValue('unavailable');
    expect(await saveTravellers(USER.id, { doc, revision: 0 })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    expect(await finishSetup(USER.id)).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    expect(db.save).not.toHaveBeenCalled();
    quota.take.mockClear();
    as(null);
    await saveTravellers('x', { doc, revision: 0 });
    expect(quota.take).not.toHaveBeenCalled();
  });

  it('consent (review-em-s S3): only `consent: true` reaches the database, as `{ consent: true }`; anything else sends none', async () => {
    as(USER);
    db.save.mockResolvedValue({ kind: 'saved', revision: 1 });
    await saveTravellers(USER.id, { doc, revision: 0, consent: true });
    await saveTravellers(USER.id, { doc, revision: 0, consent: 'yes' });
    await saveTravellers(USER.id, { doc, revision: 0, finishSetup: true, consent: true });
    expect(db.save.mock.calls.map((c) => c[3])).toEqual([{ finishSetup: false, consent: true }, { finishSetup: false }, { finishSetup: true, consent: true }]);
  });

  it('a conflict answers the revision the row holds now (SF3: "Save mine anyway"), or none when it cannot be read', async () => {
    as(USER);
    db.save.mockResolvedValue({ kind: 'conflict' });
    db.load.mockResolvedValueOnce({ revision: 7 }).mockRejectedValueOnce(new Error('db down 2019-03-15'));
    expect(await saveTravellers(USER.id, { doc, revision: 3, consent: true })).toEqual({ kind: 'conflict', revision: 7 });
    expect(db.load).toHaveBeenCalledWith('user-a');
    const logs: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => void logs.push(a));
    expect(await saveTravellers(USER.id, { doc, revision: 3, consent: true })).toEqual({ kind: 'conflict' });
    expect(JSON.stringify(logs)).not.toContain('2019-03-15');
  });
});
