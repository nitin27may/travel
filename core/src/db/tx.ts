// Shared runtime transaction helper — the contract the app lane consumes.
//
// Every write or owner-scoped read runs inside `withUserTransaction`, which:
//   1. checks out a pooled connection,
//   2. BEGINs a transaction,
//   3. drops to the non-owner, NOBYPASSRLS application role for the transaction
//      (`set local role "travel_app"`), so row-level security actually applies,
//   4. sets the transaction-local identity `app.user_id` from the *server-verified* session id
//      (never a request body) with `set_config('app.user_id', <uid>, true)`, and, in the same statement, transaction-local
//      statement, lock and idle-in-transaction timeouts (USER_TX_TIMEOUTS; review-em-s S4), so a stuck request cannot hold a
//      row lock or the per-user cap lock, or a pooled connection, until the platform kills the function,
//   5. runs the caller's function,
//   6. COMMITs and returns the result together with the transaction id (`txid_current()`),
//      or ROLLBACKs on error.
//
// RLS policies on owner-scoped tables (e.g. plan_draft) read `current_setting('app.user_id', true)`,
// so a transaction can only see and change its own user's rows. Because `set local` is scoped to the
// transaction, a pooled connection never leaks identity to the next checkout.
//
// Realtime: Neon Realtime does NOT enforce application RLS and rejects any subscription to an
// RLS-enabled relation, so the live path subscribes to the content-free `plan_draft_signal`
// stream (see `signalLiveQuery`) and re-fetches the drafts through `draftsReadQuery` under RLS.

import { getPool, pgErrorCode, type PgClientLike, type QueryResultLike, type QueryRow } from "./client.ts";

/** The application runtime role: non-owner, NOBYPASSRLS. Created by migration 0001. */
export const APP_ROLE = "travel_app";

/** GUC that carries the transaction-local, server-verified user id. */
export const USER_ID_SETTING = "app.user_id";

/**
 * Every user transaction's limits (review-em-s S4), set transaction-local so a pooled connection keeps nothing. A statement that runs
 * longer fails with SQLSTATE 57014, a lock wait (a row `for update`, the cap's advisory lock) with 55P03, and a transaction left idle
 * is ended by the server (25P03); the routes answer each with 503, as any database failure. Generous for these small, indexed,
 * per-user queries; a Neon cold start is paid at connect, before the first statement.
 */
export const USER_TX_TIMEOUTS = {
  statement: "5s",
  lock: "3s",
  idleInTransaction: "10s",
} as const;

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
    await client.query(
      `select set_config($1, $2, true), set_config('statement_timeout', $3, true), set_config('lock_timeout', $4, true),
              set_config('idle_in_transaction_session_timeout', $5, true)`,
      [USER_ID_SETTING, userId, USER_TX_TIMEOUTS.statement, USER_TX_TIMEOUTS.lock, USER_TX_TIMEOUTS.idleInTransaction],
    );
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
 *
 * Only the TITLE-ONLY live rows (`doc is null and deleted_at is null`; LEGACY_DRAFT_ROW), the ones the
 * old `/account/` box made (review-em-s B1). A synced copy or plan (0013's `doc`) and a tombstone belong
 * to Mine and the account plan routes: the `/account/` Rename and Delete know nothing of their revision
 * or their tombstone, so they never see them.
 */
export function draftsReadQuery(): { sql: string; params: (userId: string) => unknown[] } {
  return {
    sql:
      `select id, user_id, title, created_at, updated_at ` +
      `from public.plan_draft d where user_id = $1 and ${legacyDraftRow("d")} order by updated_at desc`,
    params: (userId: string) => [userId],
  };
}

/**
 * The rows the `/account/` Saved trips list and its Rename and Delete act on (review-em-s B1): a title with no document that is not a
 * tombstone (`doc is null and deleted_at is null`). Every one of those statements adds it, so none can reach a synced plan or a
 * tombstone. Written through the row as JSON, so a missing column reads as null (a table without `doc` holds legacy rows only). The
 * table itself is `plan_draft` only from migration 0013 on (renamed from 0009's name), so a build with this SQL deploys with or after
 * that apply, never before. `alias` names the table in the statement.
 */
export function legacyDraftRow(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(alias)) throw new Error(`unsafe alias: ${alias}`);
  return `(to_jsonb(${alias}) ->> 'doc') is null and (to_jsonb(${alias}) ->> 'deleted_at') is null`;
}

/**
 * Build the Realtime subscription query — the content-free invalidation stream, not the drafts.
 * Neon Realtime (pre-GA) rejects any subscription to an RLS-enabled relation, so the live path reads
 * `plan_draft_signal` (RLS off, no draft content: only user_id + monotonic version). The sealed
 * `where user_id = $1` predicate is the per-subscriber authorization (the app passes the verified
 * session id). On a version bump the client re-fetches the drafts through `draftsReadQuery` under
 * RLS. A full session change must unload prior-user client state.
 */
export function signalLiveQuery(): { sql: string; params: (userId: string) => unknown[] } {
  return {
    sql: `select user_id, version from public.plan_draft_signal where user_id = $1`,
    params: (userId: string) => [userId],
  };
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(ident)) throw new Error(`unsafe identifier: ${ident}`);
  return `"${ident}"`;
}
