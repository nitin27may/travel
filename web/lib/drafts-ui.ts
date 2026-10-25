/**
 * Pure, node-testable UI state for the account drafts list: the optimistic reducer, a durable-write
 * fold, the sort, and the drafts re-fetch interpreter. No React, no DOM, no network call of its own:
 * the component injects `doFetch`, so the one real request stays in the allowlisted component (P9) and
 * every branch here — malformed JSON, network error, non-ok, 401, and a superseded (stale) fetch — is
 * covered by a plain unit test.
 */
import { parseDraftRows, type DraftRow } from './drafts-shared';

export type OptimisticDraft = DraftRow & { pending?: true };
export type OptimisticAction =
  | { type: 'add'; draft: DraftRow }
  | { type: 'rename'; id: string; title: string }
  | { type: 'delete'; id: string };

/**
 * React re-applies the pending actions to every new live snapshot, so each case must be safe to
 * re-run and set absolute values. Marks touched rows `pending` for the dimmed optimistic style.
 */
export function applyOptimistic(rows: readonly OptimisticDraft[], action: OptimisticAction): readonly OptimisticDraft[] {
  switch (action.type) {
    case 'add':
      return rows.some((r) => r.id === action.draft.id) ? rows : [{ ...action.draft, pending: true }, ...rows];
    case 'rename':
      return rows.map((r) => (r.id === action.id && r.title !== action.title ? { ...r, title: action.title, updated_at: new Date(), pending: true } : r));
    case 'delete':
      return rows.filter((r) => r.id !== action.id);
  }
}

/**
 * Fold a *durable* write into the server-truth snapshot, with no `pending` flag. Used when a write
 * committed (we have its txid) but the authenticated re-fetch failed or timed out: the committed item
 * must stay visible, not vanish when the optimistic layer clears. Re-running is safe — add de-dupes by
 * id, rename is a no-op once the title matches, delete is a no-op once the row is gone — so a later
 * successful re-fetch that already carries the change does not double-apply.
 */
export function commitAction(rows: readonly DraftRow[], action: OptimisticAction): DraftRow[] {
  return applyOptimistic(rows, action).map(({ pending: _pending, ...row }) => row);
}

export const newestFirst = (a: OptimisticDraft, b: OptimisticDraft) =>
  b.updated_at.getTime() - a.updated_at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

export type DraftFetchResult =
  | { kind: 'ok'; rows: DraftRow[] }
  | { kind: 'stale' }
  | { kind: 'unauthenticated' }
  | { kind: 'failed' };

/**
 * Run an authenticated drafts re-fetch and interpret the response. `seqRef` guards ordering: a slow
 * re-fetch that a newer one superseded resolves `stale` and the caller drops it (no resurrecting old
 * rows). `json()` and the row parse are inside try/catch, so a malformed success body is a `failed`
 * result with a visible notice — never an unhandled rejection. A 401 means the session has no user or
 * a different user than the page loaded for: `unauthenticated`, the caller unloads.
 */
export async function fetchDrafts(seqRef: { current: number }, doFetch: () => Promise<Response>): Promise<DraftFetchResult> {
  const seq = ++seqRef.current;
  const current = () => seqRef.current;
  let res: Response;
  try {
    res = await doFetch();
  } catch {
    return seq === current() ? { kind: 'failed' } : { kind: 'stale' };
  }
  if (res.status === 401) return { kind: 'unauthenticated' };
  if (!res.ok) return seq === current() ? { kind: 'failed' } : { kind: 'stale' };
  let body: { rows: unknown };
  try {
    body = (await res.json()) as { rows: unknown };
  } catch {
    return seq === current() ? { kind: 'failed' } : { kind: 'stale' };
  }
  // A newer re-fetch started while this one was in flight: drop this (stale) result.
  if (seq !== current()) return { kind: 'stale' };
  try {
    return { kind: 'ok', rows: parseDraftRows(body.rows) };
  } catch {
    return { kind: 'failed' };
  }
}
