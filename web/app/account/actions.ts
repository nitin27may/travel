'use server';

import { authErrorCode, getAuth, getUser } from '@/lib/auth/server';
// The shared runtime transaction helper (non-owner `travel_app` role + `app.user_id` identity,
// RLS enforced) is owned by the database lane and consumed from @travel/core. It returns the
// Postgres transaction id, which the client holds its optimistic change against.
import { legacyDraftRow, PLAN_CAP_SQLSTATE, withUserTransaction } from '@travel/core/db/index.ts';
import { pgErrorCode } from '@travel/core/db/client.ts';
import { checkTitle, isUuid } from '@/lib/drafts-shared';
import { safeError } from '@/lib/server/safe-error';
import { checkName } from '@/lib/account/name';
import { takeNameChange } from '@/lib/account/name-quota';
import { takeProfile } from '@/lib/account/profile-quota';
import { finishSetup as finishSetupRow, removeTravellers as removeTravellersRow, saveTravellers as saveTravellersRow } from '@travel/core/db/profile.ts';

/**
 * Typed results, not throws: in production Next.js hides a thrown error's message. Each write
 * returns its transaction id so the client can hold its optimistic change until the live stream
 * delivers that transaction.
 *
 * SCOPE (review-em-s B1). These three act on the TITLE-ONLY drafts the old box made, never on a synced
 * copy or plan (migration 0013's `doc`) or a tombstone: Rename and Delete add `legacyDraftRow`, so on any
 * other row they match nothing and answer `unchanged`. A synced plan is renamed and removed in Mine,
 * through the revision-checked account plan routes and their tombstone (edit-my-trip 4.1, 4.5).
 */
export type WriteResult =
  | { kind: 'committed'; txid: string }
  | { kind: 'unchanged' } // nothing matched: deleted elsewhere, someone else's id, a synced plan, or a replayed add
  // CAP: the account already holds the most trips (0013's cap trigger, edit-my-trip 3), so the Undo cannot bring the draft back
  | { kind: 'rejected'; reason: 'UNAUTHENTICATED' | 'INVALID_INPUT' | 'CAP' | 'SERVICE_UNAVAILABLE' };

/** Create a draft. The browser supplies the uuid so the optimistic row and the live row share a key. */
export async function createDraft(pageUserId: string, raw: { id: unknown; title: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId); // every action checks the session itself: proxy.ts skips actions
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  const title = checkTitle(raw.title);
  if (!title.ok) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      // `on conflict do nothing` with no target: the key is (user_id, id) (0013), so a replayed Undo, or an id this user already
      // holds as a synced plan, inserts nothing
      const res = await ctx.query(
        `insert into public.plan_draft (id, user_id, title, created_at, updated_at)
         values ($1, $2, $3, now(), now())
         on conflict do nothing
         returning id`,
        [raw.id, user.id, title.title], // user_id from the session only
      );
      return res.rows.length > 0;
    });
    return result ? { kind: 'committed', txid } : { kind: 'unchanged' };
  } catch (e) {
    if (pgErrorCode(e) === PLAN_CAP_SQLSTATE) {
      console.warn('[account] createDraft cap');
      return { kind: 'rejected', reason: 'CAP' };
    }
    console.error('[account] createDraft failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** Rename a title-only draft the user owns. The `user_id` predicate plus RLS reject a forged id; `legacyDraftRow` a synced plan or a tombstone. */
export async function renameDraft(pageUserId: string, raw: { id: unknown; title: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId);
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  const title = checkTitle(raw.title);
  if (!title.ok) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      const res = await ctx.query(
        `update public.plan_draft d set title = $3, updated_at = now()
         where d.id = $1 and d.user_id = $2 and ${legacyDraftRow('d')}
         returning d.id`,
        [raw.id, user.id, title.title], // only the user's own row
      );
      return res.rows.length > 0;
    });
    return result ? { kind: 'committed', txid } : { kind: 'unchanged' };
  } catch (e) {
    console.error('[account] renameDraft failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** Delete a title-only draft the user owns. The `user_id` predicate plus RLS reject a forged id; `legacyDraftRow` a synced plan or a tombstone. */
export async function deleteDraft(pageUserId: string, raw: { id: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId);
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      const res = await ctx.query(
        `delete from public.plan_draft d where d.id = $1 and d.user_id = $2 and ${legacyDraftRow('d')} returning d.id`,
        [raw.id, user.id], // only the user's own row
      );
      return res.rows.length > 0;
    });
    return result ? { kind: 'committed', txid } : { kind: 'unchanged' };
  } catch (e) {
    console.error('[account] deleteDraft failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** The display name (ACCT-P1; spec 4.3). The saved name is the validated one: the SDK's answer carries no user, and `getSession()` still serves the old name for this request. */
export type SaveNameResult =
  | { kind: 'saved'; name: string }
  | { kind: 'rejected'; reason: 'INVALID_INPUT'; field: 'empty' | 'too_long' | 'chars' }
  | { kind: 'rejected'; reason: 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' };

/**
 * Save the signed-in person's display name through Neon's `update-user`, called here on the server so the browser proxy keeps answering
 * 404 for that route. Only `{ name }` is ever passed. Logs fixed codes, never the name.
 */
export async function saveName(pageUserId: string, raw: { name: unknown }): Promise<SaveNameResult> {
  const user = await getUser(pageUserId, { fresh: true }); // proxy.ts skips actions: the session is checked here, at Neon (S1)
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  const checked = checkName(raw?.name);
  if (!checked.ok) return { kind: 'rejected', reason: 'INVALID_INPUT', field: checked.reason };
  const quota = await takeNameChange(user.id);
  if (quota === 'limited') return { kind: 'rejected', reason: 'RATE_LIMITED' };
  if (quota === 'unavailable') {
    console.error('[account] profile_name_quota_unavailable');
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
  try {
    const res = await getAuth().updateUser({ name: checked.name });
    if (res.error) {
      console.error('[account] profile_name_failed', authErrorCode(res.error));
      return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
    }
    console.info('[account] profile_name_saved');
    return { kind: 'saved', name: checked.name };
  } catch (e) {
    console.error('[account] profile_name_failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

// ---- Travellers and the setup card (ACCT-P2; spec 2.3, 2.4, 6.6) ------------------------------------------------------------------
// The user id is the session's, never the body's, read fresh at Neon so a session revoked elsewhere cannot write (review ACCT-PSEC S1).
// Each write takes one from the user's `account:profile_write` bucket (S6). Answers are typed, not thrown. Logs carry fixed codes only:
// never an age, a date of birth or a document.

/** Null to go on, or the refusal: over the limit, or the quota store unavailable (fails closed in production). */
async function profileWriteQuota(userId: string): Promise<{ kind: 'rejected'; reason: 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' } | null> {
  const q = await takeProfile('write', userId);
  if (q === 'ok') return null;
  if (q === 'limited') {
    console.warn('[account] profile_write_limited');
    return { kind: 'rejected', reason: 'RATE_LIMITED' };
  }
  console.error('[account] profile_quota_unavailable');
  return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
}

export type TravellersResult =
  | { kind: 'saved'; revision: number }
  | { kind: 'conflict' }
  | { kind: 'rejected'; reason: 'INVALID_INPUT'; issues: string[] }
  | { kind: 'rejected'; reason: 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' };

/** Save the travellers document at the revision the page loaded (a guarded write). `finishSetup` also ends the setup card. */
export async function saveTravellers(pageUserId: string, raw: { doc: unknown; revision: unknown; finishSetup?: unknown }): Promise<TravellersResult> {
  const user = await getUser(pageUserId, { fresh: true });
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (typeof raw?.revision !== 'number' || !Number.isInteger(raw.revision)) return { kind: 'rejected', reason: 'INVALID_INPUT', issues: ['$: revision'] };
  const limited = await profileWriteQuota(user.id);
  if (limited) return limited;
  try {
    const res = await saveTravellersRow(user.id, raw.doc, raw.revision, { finishSetup: raw.finishSetup === true });
    if (res.kind === 'rejected') return { kind: 'rejected', reason: 'INVALID_INPUT', issues: res.issues };
    if (res.kind === 'conflict') return { kind: 'conflict' };
    console.info('[account] travellers_saved');
    return { kind: 'saved', revision: res.revision };
  } catch (e) {
    console.error('[account] travellers_save_failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** Remove the saved travellers (guarded by revision). Undo is a `saveTravellers` of the same document. */
export async function removeTravellers(pageUserId: string, raw: { revision: unknown }): Promise<TravellersResult> {
  const user = await getUser(pageUserId, { fresh: true });
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (typeof raw?.revision !== 'number' || !Number.isInteger(raw.revision)) return { kind: 'rejected', reason: 'INVALID_INPUT', issues: ['$: revision'] };
  const limited = await profileWriteQuota(user.id);
  if (limited) return limited;
  try {
    const res = await removeTravellersRow(user.id, raw.revision);
    if (res.kind === 'rejected') return { kind: 'rejected', reason: 'INVALID_INPUT', issues: res.issues };
    if (res.kind === 'conflict') return { kind: 'conflict' };
    console.info('[account] travellers_removed');
    return { kind: 'saved', revision: res.revision };
  } catch (e) {
    console.error('[account] travellers_remove_failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** Skip or Close on the setup card: the card never shows again, on any device. */
export async function finishSetup(pageUserId: string): Promise<{ kind: 'done' } | { kind: 'rejected'; reason: 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' }> {
  const user = await getUser(pageUserId, { fresh: true });
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  const limited = await profileWriteQuota(user.id);
  if (limited) return limited;
  try {
    await finishSetupRow(user.id);
    return { kind: 'done' };
  } catch (e) {
    console.error('[account] setup_finish_failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}
