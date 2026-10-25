// Shared runtime transaction helper — the contract the app lane consumes.
//
// Every write or owner-scoped read runs inside `withUserTransaction`, which:
//   1. checks out a pooled connection,
//   2. BEGINs a transaction,
//   3. drops to the non-owner, NOBYPASSRLS application role for the transaction
//      (`set local role "travel_app"`), so row-level security actually applies,
//   4. sets the transaction-local identity `app.user_id` from the *server-verified* session id
//      (never a request body) with `set_config('app.user_id', <uid>, true)`,
//   5. runs the caller's function,
//   6. COMMITs and returns the result together with the transaction id (`txid_current()`),
//      or ROLLBACKs on error.
//
// RLS policies on owner-scoped tables (e.g. planner_draft) read `current_setting('app.user_id', true)`,
// so a transaction can only see and change its own user's rows. Because `set local` is scoped to the
// transaction, a pooled connection never leaks identity to the next checkout.
//
// Realtime: Neon Realtime does NOT enforce application RLS and rejects any subscription to an
// RLS-enabled relation, so the live path subscribes to the content-free `planner_draft_signal`
// stream (see `signalLiveQuery`) and re-fetches the drafts through `draftsReadQuery` under RLS.

import { getPool, pgErrorCode, type PgClientLike, type QueryResultLike, type QueryRow } from "./client.ts";

/** The application runtime role: non-owner, NOBYPASSRLS. Created by migration 0001. */
export const APP_ROLE = "travel_app";

/** GUC that carries the transaction-local, server-verified user id. */
export const USER_ID_SETTING = "app.user_id";

export interface TxContext {
  /** Run a query inside the user transaction. */
  query<Row extends QueryRow = QueryRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResultLike<Row>>;
}

export interface TxOutcome<T> {
  result: T;
  /** The Postgres transaction id, surfaced so the app can return it per write (brief contract). */
  txid: string;
}

function assertUserId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 255) {
    throw new Error("withUserTransaction requires a non-empty server-verified user id");
  }
}

/**
 * Run `fn` inside a transaction scoped to `userId`. The identity comes from the caller (the verified
 * server session), never from client input. Returns the function result and the transaction id.
 */
export async function withUserTransaction<T>(
  userId: string,
  fn: (ctx: TxContext) => Promise<T>,
  poolUrl?: string,
): Promise<TxOutcome<T>> {
  assertUserId(userId);
  const pool = await getPool(poolUrl);
  const client: PgClientLike = await pool.connect();
  try {
    await client.query("begin");
    // Drop privilege for this transaction so RLS applies, then bind the verified identity.
    await client.query(`set local role ${quoteIdent(APP_ROLE)}`);
    await client.query(`select set_config($1, $2, true)`, [USER_ID_SETTING, userId]);
    const ctx: TxContext = { query: (sql, params) => client.query(sql, params) };
    const result = await fn(ctx);
    const { rows } = await client.query<{ txid: string }>(`select txid_current()::text as txid`);
    await client.query("commit");
    return { result, txid: rows[0].txid };
  } catch (err) {
    // Roll back, but do not mask the original error. If the rollback itself fails, log only the
    // SQLSTATE code — never the query, parameters, or connection secrets — then rethrow `err`.
    await client.query("rollback").catch((rollbackErr: unknown) => {
      console.error(`[db] rollback failed after error (sqlstate=${pgErrorCode(rollbackErr)})`);
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Build the RLS-scoped READ query for a user's planner drafts. Used by the SSR load and the
 * authenticated re-fetch, both inside `withUserTransaction` (travel_app role + app.user_id), so RLS
 * authorizes the read. The user id is bound as a parameter.
 */
export function draftsReadQuery(): { sql: string; params: (userId: string) => unknown[] } {
  return {
    sql:
      `select id, user_id, title, created_at, updated_at ` +
      `from public.planner_draft where user_id = $1 order by updated_at desc`,
    params: (userId: string) => [userId],
  };
}

/**
 * Build the Realtime subscription query — the content-free invalidation stream, not the drafts.
 * Neon Realtime (pre-GA) rejects any subscription to an RLS-enabled relation, so the live path reads
 * `planner_draft_signal` (RLS off, no draft content: only user_id + monotonic version). The sealed
 * `where user_id = $1` predicate is the per-subscriber authorization (the app passes the verified
 * session id). On a version bump the client re-fetches the drafts through `draftsReadQuery` under
 * RLS. A full session change must unload prior-user client state.
 */
export function signalLiveQuery(): { sql: string; params: (userId: string) => unknown[] } {
  return {
    sql: `select user_id, version from public.planner_draft_signal where user_id = $1`,
    params: (userId: string) => [userId],
  };
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(ident)) throw new Error(`unsafe identifier: ${ident}`);
  return `"${ident}"`;
}
