'use server';

import { authErrorCode, getAuth, getUser } from '@/lib/auth/server';
// The shared runtime transaction helper (non-owner `travel_app` role + `app.user_id` identity,
// RLS enforced) is owned by the database lane and consumed from @travel/core. It returns the
// Postgres transaction id, which the client holds its optimistic change against.
import { withUserTransaction } from '@travel/core/db/index.ts';
import { checkTitle, isUuid } from '@/lib/drafts-shared';
import { safeError } from '@/lib/server/safe-error';
import { checkName } from '@/lib/account/name';
import { takeNameChange } from '@/lib/account/name-quota';

/**
 * Typed results, not throws: in production Next.js hides a thrown error's message. Each write
 * returns its transaction id so the client can hold its optimistic change until the live stream
 * delivers that transaction.
 */
export type WriteResult =
  | { kind: 'committed'; txid: string }
  | { kind: 'unchanged' } // nothing matched: deleted elsewhere, someone else's id, or a replayed add
  | { kind: 'rejected'; reason: 'UNAUTHENTICATED' | 'INVALID_INPUT' | 'SERVICE_UNAVAILABLE' };

/** Create a draft. The browser supplies the uuid so the optimistic row and the live row share a key. */
export async function createDraft(pageUserId: string, raw: { id: unknown; title: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId); // every action checks the session itself: proxy.ts skips actions
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  const title = checkTitle(raw.title);
  if (!title.ok) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      const res = await ctx.query(
        `insert into public.planner_draft (id, user_id, title, created_at, updated_at)
         values ($1, $2, $3, now(), now())
         on conflict (id) do nothing
         returning id`,
        [raw.id, user.id, title.title], // user_id from the session only
      );
      return res.rows.length > 0;
    });
    return result ? { kind: 'committed', txid } : { kind: 'unchanged' };
  } catch (e) {
    console.error('[account] createDraft failed', safeError(e));
    return { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' };
  }
}

/** Rename a draft the user owns. The `user_id` predicate plus RLS reject a forged id. */
export async function renameDraft(pageUserId: string, raw: { id: unknown; title: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId);
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  const title = checkTitle(raw.title);
  if (!title.ok) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      const res = await ctx.query(
        `update public.planner_draft set title = $3, updated_at = now()
         where id = $1 and user_id = $2
         returning id`,
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

/** Delete a draft the user owns. The `user_id` predicate plus RLS reject a forged id. */
export async function deleteDraft(pageUserId: string, raw: { id: unknown }): Promise<WriteResult> {
  const user = await getUser(pageUserId);
  if (!user) return { kind: 'rejected', reason: 'UNAUTHENTICATED' };
  if (!isUuid(raw.id)) return { kind: 'rejected', reason: 'INVALID_INPUT' };
  try {
    const { result, txid } = await withUserTransaction(user.id, async (ctx) => {
      const res = await ctx.query(
        `delete from public.planner_draft where id = $1 and user_id = $2 returning id`,
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
  const user = await getUser(pageUserId); // proxy.ts skips actions: the session is checked here
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
