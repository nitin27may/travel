import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), finish: vi.fn() }));
vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn(), getAuth: () => ({}), authErrorCode: () => 'unknown' }));
vi.mock('@/lib/account/name-quota', () => ({ takeNameChange: vi.fn() }));
vi.mock('@travel/core/db/index.ts', () => ({ withUserTransaction: vi.fn() }));
vi.mock('@travel/core/db/profile.ts', () => ({ saveTravellers: db.save, removeTravellers: db.remove, finishSetup: db.finish }));

import { getUser } from '@/lib/auth/server';
import { finishSetup, removeTravellers, saveTravellers } from '@/app/account/actions';

const USER = { id: 'user-a', email: 'a@example.test' };
const doc = { schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: '2026-10-27', dob: '2019-03-15' }] };
const as = (u: unknown) => (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(u);

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
});
