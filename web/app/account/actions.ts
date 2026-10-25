'use server';

import { getUser } from '@/lib/auth/server';
// The shared runtime transaction helper (non-owner `travel_app` role + `app.user_id` identity,
// RLS enforced) is owned by the database lane and consumed from @travel/core. It returns the
// Postgres transaction id, which the client holds its optimistic change against.
import { withUserTransaction } from '@travel/core/db/index.ts';
import { checkTitle, isUuid } from '@/lib/drafts-shared';
import { safeError } from '@/lib/server/safe-error';

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
