import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth and shared database boundaries so these tests never touch Managed Better Auth or
// Postgres. The transaction helper (role switch + app.user_id + RLS) is owned and tested by the
// database lane (@travel/core); here we verify the app-lane adapter: session checks, input
// validation, that the session user id scopes every statement, and the committed/unchanged mapping.
const sdk = vi.hoisted(() => ({ updateUser: vi.fn(async (_b: Record<string, unknown>) => ({ data: { status: true }, error: null as unknown })) }));
const quota = vi.hoisted(() => ({ take: vi.fn(async (_id: string) => 'ok' as 'ok' | 'limited' | 'unavailable') }));
vi.mock('@/lib/auth/server', () => ({ getUser: vi.fn(), getAuth: () => ({ updateUser: sdk.updateUser }), authErrorCode: () => 'unknown' }));
vi.mock('@/lib/account/name-quota', () => ({ takeNameChange: quota.take }));
vi.mock('@travel/core/db/index.ts', async () => {
  const tx = await vi.importActual<typeof import('@travel/core/db/tx.ts')>('@travel/core/db/tx.ts');
  return { withUserTransaction: vi.fn(), legacyDraftRow: tx.legacyDraftRow, PLAN_CAP_SQLSTATE: 'TP001' };
});

import { getUser } from '@/lib/auth/server';
import { withUserTransaction } from '@travel/core/db/index.ts';
import { createDraft, renameDraft, deleteDraft, saveName } from '@/app/account/actions';

const OWNER = { id: 'user-owner', email: 'owner@example.test' };
const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

type Captured = { sql: string; params: unknown[] };

/**
 * A withUserTransaction stand-in that runs `fn` against a fake tx context, captures every query,
 * records the scoped user id, and returns the shared `{ result, txid }` outcome. `rows` controls
 * whether the write reports a changed row.
 */
function fakeTx(rows: unknown[] = [{ id: ID }], txid = '770') {
  const calls: Captured[] = [];
  const meta: { scopedUserId?: string } = {};
  (withUserTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (userId: string, fn: (c: unknown) => Promise<unknown>) => {
    meta.scopedUserId = userId;
    const ctx = { query: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows }; } };
    const result = await fn(ctx);
    return { result, txid };
  });
  return { calls, meta };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetAllMocks());

describe('account write actions', () => {
  describe('anonymous denial', () => {
    it('refuses create/rename/delete with no session and never opens a transaction', async () => {
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      expect(await createDraft('user-x', { id: ID, title: 'Hi' })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
      expect(await renameDraft('user-x', { id: ID, title: 'Hi' })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
      expect(await deleteDraft('user-x', { id: ID })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
      expect(withUserTransaction).not.toHaveBeenCalled();
    });
  });

  describe('invalid input', () => {
    beforeEach(() => (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER));
    it('rejects a bad uuid', async () => {
      fakeTx();
      expect(await createDraft(OWNER.id, { id: 'nope', title: 'Hi' })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT' });
      expect(await deleteDraft(OWNER.id, { id: 'nope' })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT' });
      expect(withUserTransaction).not.toHaveBeenCalled();
    });
    it('rejects an empty or over-160 title', async () => {
      fakeTx();
      expect(await createDraft(OWNER.id, { id: ID, title: '   ' })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT' });
      expect(await renameDraft(OWNER.id, { id: ID, title: 'a'.repeat(161) })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT' });
      expect(withUserTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ownership: identity comes from the session, every write scopes by user_id', () => {
    beforeEach(() => (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER));

    it('insert uses the session user id, not the request argument', async () => {
      const { calls, meta } = fakeTx();
      await createDraft('attacker-supplied-id', { id: ID, title: 'Mine' });
      // getUser is handed the page's claimed id (only compared, never trusted to scope).
      expect(getUser).toHaveBeenCalledWith('attacker-supplied-id');
      // The scoped transaction and the inserted user_id are the verified session id.
      expect(meta.scopedUserId).toBe(OWNER.id);
      expect(calls[0].params[1]).toBe(OWNER.id);
      expect(calls[0].sql).toMatch(/insert into public\.plan_draft/i);
    });

    it('update and delete carry a user_id predicate bound to the session id', async () => {
      const r = fakeTx();
      await renameDraft(OWNER.id, { id: ID, title: 'New name' });
      expect(r.calls[0].sql).toMatch(/where d\.id = \$1 and d\.user_id = \$2/i);
      expect(r.calls[0].params).toEqual([ID, OWNER.id, 'New name']);

      const d = fakeTx();
      await deleteDraft(OWNER.id, { id: ID });
      expect(d.calls[0].sql).toMatch(/delete from public\.plan_draft d where d\.id = \$1 and d\.user_id = \$2/i);
      expect(d.calls[0].params).toEqual([ID, OWNER.id]);
    });

    it('B1: rename and delete reach title-only live rows only, never a synced plan or a tombstone', async () => {
      const r = fakeTx();
      await renameDraft(OWNER.id, { id: ID, title: 'New name' });
      const d = fakeTx();
      await deleteDraft(OWNER.id, { id: ID });
      for (const sql of [r.calls[0].sql, d.calls[0].sql]) {
        expect(sql).toContain("(to_jsonb(d) ->> 'doc') is null");
        expect(sql).toContain("(to_jsonb(d) ->> 'deleted_at') is null");
      }
    });
  });

  describe('results', () => {
    beforeEach(() => (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER));
    it('returns committed with the transaction id when a row changed', async () => {
      fakeTx([{ id: ID }], '12345');
      expect(await createDraft(OWNER.id, { id: ID, title: 'Hi' })).toEqual({ kind: 'committed', txid: '12345' });
    });
    it("returns unchanged when nothing matched (e.g. another user's row, blocked by RLS/predicate)", async () => {
      fakeTx([]);
      expect(await deleteDraft(OWNER.id, { id: ID })).toEqual({ kind: 'unchanged' });
      expect(await renameDraft(OWNER.id, { id: ID, title: 'x' })).toEqual({ kind: 'unchanged' });
    });
    it('B1: the Undo at the account cap answers CAP (a reason the page words), not SERVICE_UNAVAILABLE', async () => {
      (withUserTransaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error('PLAN_CAP'), { code: 'TP001' }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await createDraft(OWNER.id, { id: ID, title: 'Hi' })).toEqual({ kind: 'rejected', reason: 'CAP' });
      expect(warn).toHaveBeenCalled();
    });
    it('fails closed to SERVICE_UNAVAILABLE when the transaction throws', async () => {
      (withUserTransaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection refused'));
      expect(await createDraft(OWNER.id, { id: ID, title: 'Hi' })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    });
  });
});

describe('saveName (ACCT-P1, spec 4.3)', () => {
  beforeEach(() => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER);
    sdk.updateUser.mockResolvedValue({ data: { status: true }, error: null });
    quota.take.mockResolvedValue('ok');
  });
  it('refuses with no session before the quota or the SDK', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await saveName('x', { name: 'Nitin' })).toEqual({ kind: 'rejected', reason: 'UNAUTHENTICATED' });
    expect(quota.take).not.toHaveBeenCalled();
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });
  it('refuses an invalid name before the quota is spent', async () => {
    expect(await saveName(OWNER.id, { name: '<b>' })).toEqual({ kind: 'rejected', reason: 'INVALID_INPUT', field: 'chars' });
    expect(await saveName(OWNER.id, { name: 'x'.repeat(61) })).toMatchObject({ field: 'too_long' });
    expect(quota.take).not.toHaveBeenCalled();
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });
  it('answers RATE_LIMITED and never calls the SDK when over the limit', async () => {
    quota.take.mockResolvedValue('limited');
    expect(await saveName(OWNER.id, { name: 'Nitin' })).toEqual({ kind: 'rejected', reason: 'RATE_LIMITED' });
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });
  it('fails closed when the quota is unavailable', async () => {
    quota.take.mockResolvedValue('unavailable');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await saveName(OWNER.id, { name: 'Nitin' })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    log.mockRestore();
  });
  it('sends exactly { name } for the session user and returns the validated name (no session re-read)', async () => {
    expect(await saveName(OWNER.id, { name: '  Nitin   Singh ' })).toEqual({ kind: 'saved', name: 'Nitin Singh' });
    expect(sdk.updateUser).toHaveBeenCalledTimes(1);
    expect(sdk.updateUser.mock.calls[0][0]).toStrictEqual({ name: 'Nitin Singh' });
    expect(quota.take).toHaveBeenCalledWith(OWNER.id);
    expect(getUser).toHaveBeenCalledTimes(1);
  });
  it('maps an SDK error answer and a throw to SERVICE_UNAVAILABLE and logs no name', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sdk.updateUser.mockResolvedValueOnce({ data: null as never, error: { code: 'X', message: 'Nitin Secret' } });
    expect(await saveName(OWNER.id, { name: 'Nitin Secret' })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    sdk.updateUser.mockRejectedValueOnce(new Error('Nitin Secret'));
    expect(await saveName(OWNER.id, { name: 'Nitin Secret' })).toEqual({ kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('Nitin Secret');
    log.mockRestore();
  });
});
