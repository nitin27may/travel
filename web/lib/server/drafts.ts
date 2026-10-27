import 'server-only';

import { rawSql } from '@neon/realtime/server';
import type { SealedLiveQuery } from '@neon/realtime/client';
// The runtime transaction helper and the two shared queries are owned by the database lane and
// exposed through @travel/core (core/src/db). The app lane never duplicates the SQL, the RLS role,
// or the identity GUC — it consumes the one contract so a schema change lands in one place.
import { withUserTransaction, draftsReadQuery, signalLiveQuery } from '@travel/core/db/index.ts';
import { getRealtime } from './realtime';
import type { DraftRow, SignalRow } from '../drafts-shared';

// Title rules, the row types and the uuid guard are shared with the client UI (no server-only there).
export { TITLE_MIN, TITLE_MAX, checkTitle, isUuid } from '../drafts-shared';
export type { DraftRow, SignalRow, TitleCheck } from '../drafts-shared';

// The content-free invalidation stream the Realtime subscription watches (Neon Realtime rejects any
// RLS-enabled relation, so the live path never reads plan_draft directly). `userId` is always the
// verified session id; the `where user_id = $1` predicate is the only authorization Realtime honours.
const SIGNAL_QUERY = signalLiveQuery();
// The RLS-scoped read of the actual drafts, used by the SSR load and the authenticated re-fetch.
const DRAFTS_QUERY = draftsReadQuery();

function signalSql(userId: string) {
  // The shared contract types params as unknown[]; here they are always string bind values.
  return rawSql<SignalRow>(SIGNAL_QUERY.sql, SIGNAL_QUERY.params(userId) as string[]);
}

/** Seal the content-free signal query for a user (used by the SSR load and the renewal handler). */
export function sealSignal(userId: string): Promise<SealedLiveQuery<SignalRow>> {
  return getRealtime().seal({ query: signalSql(userId) });
}

/**
 * Read a user's drafts under RLS (the non-owner `travel_app` role + the `app.user_id` identity).
 * Used by the SSR page load and the authenticated re-fetch the client runs on each signal bump.
 */
export async function readDrafts(userId: string): Promise<DraftRow[]> {
  const { result } = await withUserTransaction(userId, async (ctx) => {
    const res = await ctx.query(DRAFTS_QUERY.sql, DRAFTS_QUERY.params(userId));
    return res.rows as DraftRow[];
  });
  return result;
}

/**
 * Initial account load: read the drafts under RLS and seal the signal stream, so the page renders
 * the real rows immediately and the live subscription watches the content-free signal.
 */
export async function loadDrafts(userId: string): Promise<{ rows: DraftRow[]; sealedQuery: SealedLiveQuery<SignalRow> }> {
  const [rows, sealedQuery] = await Promise.all([readDrafts(userId), sealSignal(userId)]);
  return { rows, sealedQuery };
}
