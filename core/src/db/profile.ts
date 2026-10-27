// The account profile row (migration 0012, `account_profile`): the saved travellers and the setup state, one row per user (ACCT-PC;
// docs/v2/features/account-profile-and-travellers.md 6.6 and 9.1). The only code that reads or writes the table.
//
// IDENTITY. Every function takes the user id from its caller, which passes the verified server session's id (never a request body),
// and runs inside `withUserTransaction`, so the `travel_app` role and owner-only RLS apply: a wrong id reads nothing and writes nothing.
//
// REVISION. `revision` counts changes of the travellers document (0 when none was ever saved, and for "no row"). A save or a removal
// sends the revision it loaded; another device's save in between answers `conflict` and changes nothing (spec 6.6). The trigger in
// 0012 moves the revision and the timestamps; nothing here writes them.
//
// PRIVACY. Nothing here logs. Errors carry the SQLSTATE through the driver's error, never the document; callers log fixed codes only
// (spec 10.1).
import { parseTravellers, isoDay, type Travellers } from "../schema/travellers.ts";
import { withUserTransaction, type TxContext, type TxOutcome } from "./tx.ts";

/** What the Account page, the seed route and the export read. */
export interface AccountProfile {
  /** false when the user has no row yet (every other field then holds its empty value) */
  exists: boolean;
  /** the saved document, or null when none is saved or the stored one no longer parses (see `travellersInvalid`) */
  travellers: Travellers | null;
  /** a stored document failed `parseTravellers` (kept in the row, never shown or seeded); the page offers to save again */
  travellersInvalid: boolean;
  /** ISO timestamps, or null */
  travellersSavedAt: string | null;
  travellersConsentedAt: string | null;
  setupDoneAt: string | null;
  /** send it back with the next save or removal */
  revision: number;
}

export const EMPTY_PROFILE: AccountProfile = {
  exists: false,
  travellers: null,
  travellersInvalid: false,
  travellersSavedAt: null,
  travellersConsentedAt: null,
  setupDoneAt: null,
  revision: 0,
};

/** The answer of a guarded write: the new revision, another device saved first, or the document did not validate. */
export type SaveResult =
  | { kind: "saved"; revision: number }
  | { kind: "conflict" }
  | { kind: "rejected"; issues: string[] };

/** How a function reaches the database: `withUserTransaction` by default; a test passes its own. */
export type UserTx = <T>(userId: string, fn: (ctx: TxContext) => Promise<T>) => Promise<TxOutcome<T>>;

export interface ProfileOptions {
  /** the clock, for "today" in validation (default: now); the server's UTC day */
  now?: Date;
  /** the transaction runner (default: withUserTransaction against the runtime pool) */
  tx?: UserTx;
}

const runner = (o: ProfileOptions): UserTx => o.tx ?? ((userId, fn) => withUserTransaction(userId, fn));
const today = (o: ProfileOptions): string => isoDay(o.now ?? new Date());
const iso = (x: unknown): string | null => (x === null || x === undefined ? null : x instanceof Date ? x.toISOString() : String(x));

interface Row {
  travellers: unknown;
  travellers_saved_at: unknown;
  travellers_consented_at: unknown;
  setup_done_at: unknown;
  revision: number | string;
  [k: string]: unknown;
}

const COLUMNS = "travellers, travellers_saved_at, travellers_consented_at, setup_done_at, revision";

function toProfile(row: Row | undefined, day: string): AccountProfile {
  if (!row) return { ...EMPTY_PROFILE };
  const parsed = row.travellers === null || row.travellers === undefined ? null : parseTravellers(row.travellers, day);
  return {
    exists: true,
    travellers: parsed && parsed.success ? parsed.data : null,
    travellersInvalid: parsed !== null && !parsed.success,
    travellersSavedAt: iso(row.travellers_saved_at),
    travellersConsentedAt: iso(row.travellers_consented_at),
    setupDoneAt: iso(row.setup_done_at),
    revision: Number(row.revision),
  };
}

/** The user's profile, or EMPTY_PROFILE when there is no row. Throws when the database cannot be read (the page fails closed). */
export async function loadProfile(userId: string, opts: ProfileOptions = {}): Promise<AccountProfile> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const { rows } = await ctx.query<Row>(`select ${COLUMNS} from public.account_profile where user_id = $1`, [userId]);
    return rows[0];
  });
  return toProfile(result, today(opts));
}

/**
 * Save the travellers document (Save travellers, Undo of a removal, "Looks right"). `revision` is the one the page loaded (0 for no
 * row or nothing saved yet). The first save creates the row; the trigger records consent on the first document ever saved.
 * `finishSetup` also marks the setup card done in the same write (spec 2.3 rule 6).
 */
export async function saveTravellers(
  userId: string,
  doc: unknown,
  revision: number,
  opts: ProfileOptions & { finishSetup?: boolean } = {},
): Promise<SaveResult> {
  const checked = parseTravellers(doc, today(opts));
  if (!checked.success) return { kind: "rejected", issues: checked.issues };
  if (!Number.isInteger(revision) || revision < 0) return { kind: "conflict" };
  const body = JSON.stringify(checked.data);
  const done = opts.finishSetup === true;
  const { result } = await runner(opts)(userId, async (ctx) => {
    // revision 0: the row may not exist yet. Insert it, or update a row that has never held travellers (a skipped setup).
    // Any other revision: update only that revision of an existing row; a deleted row is a conflict, not a silent re-create.
    const sql =
      revision === 0
        ? `insert into public.account_profile as p (user_id, travellers, setup_done_at)
             values ($1, $2::jsonb, case when $3::boolean then now() end)
           on conflict (user_id) do update
             set travellers = excluded.travellers, setup_done_at = coalesce(p.setup_done_at, excluded.setup_done_at)
             where p.revision = 0
           returning revision`
        : `update public.account_profile
             set travellers = $2::jsonb, setup_done_at = coalesce(setup_done_at, case when $3::boolean then now() end)
             where user_id = $1 and revision = $4
           returning revision`;
    const params = revision === 0 ? [userId, body, done] : [userId, body, done, revision];
    const { rows } = await ctx.query<{ revision: number | string }>(sql, params);
    return rows[0];
  });
  return result ? { kind: "saved", revision: Number(result.revision) } : { kind: "conflict" };
}

/**
 * Remove the saved travellers (the row and its setup state stay; consent time stays as a record of the first save). Guarded like a
 * save. Removing when nothing is saved is a no-op that answers `saved` with the current revision.
 */
export async function removeTravellers(userId: string, revision: number, opts: ProfileOptions = {}): Promise<SaveResult> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const upd = await ctx.query<{ revision: number | string }>(
      `update public.account_profile set travellers = null
         where user_id = $1 and revision = $2 and travellers is not null
       returning revision`,
      [userId, revision],
    );
    if (upd.rows[0]) return { kind: "saved" as const, revision: Number(upd.rows[0].revision) };
    const cur = await ctx.query<{ revision: number | string; empty: boolean }>(
      `select revision, travellers is null as empty from public.account_profile where user_id = $1`,
      [userId],
    );
    const row = cur.rows[0];
    if (!row) return { kind: "saved" as const, revision: 0 };
    return row.empty ? { kind: "saved" as const, revision: Number(row.revision) } : { kind: "conflict" as const };
  });
  return result;
}

/** Mark the setup card finished or skipped (spec 2.3 rule 6). Idempotent: the first time is kept. Returns that time (ISO). */
export async function finishSetup(userId: string, opts: ProfileOptions = {}): Promise<string> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const { rows } = await ctx.query<{ setup_done_at: unknown }>(
      `insert into public.account_profile as p (user_id, setup_done_at) values ($1, now())
         on conflict (user_id) do update set setup_done_at = coalesce(p.setup_done_at, excluded.setup_done_at)
       returning setup_done_at`,
      [userId],
    );
    return rows[0];
  });
  return iso(result?.setup_done_at) as string;
}

/** Delete the user's row (account deletion, spec 9.3). True when a row was removed. */
export async function deleteProfile(userId: string, opts: ProfileOptions = {}): Promise<boolean> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const r = await ctx.query(`delete from public.account_profile where user_id = $1`, [userId]);
    return (r.rowCount ?? 0) > 0;
  });
  return result;
}
