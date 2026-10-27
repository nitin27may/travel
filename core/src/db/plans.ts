// The account plans (migration 0013 `plan_doc` on `plan_draft`; edit-my-trip.md 3, 4.1, 4.2, 4.5; tasks EM-M and EM-1): the light
// list, one document, the revision-checked write, the tombstone, and the sign-in merge's reads and inserts. The only code that reads or
// writes the document columns.
//
// IDENTITY. Every function takes the user id from its caller, which passes the verified server session's id (never a request body),
// and runs inside `withUserTransaction`, so the `travel_app` role and owner-only RLS apply. The key is `(user_id, id)` (0013, review-em-s
// S1): ids are per user, so another account holding the same id is invisible here (no existence signal, no squatting), and every
// statement names the user as well as the id.
//
// DOCUMENT. The caller has parsed the whole document (R5) and derived the light columns from it (core/src/plan/doc.ts planRowFields);
// this file does not import the plan document (the builder fence, web/tests/plan/isolation.test.ts G1). It decides with the pure
// `decidePut` and `decideDelete` of the route contract, inside the transaction, on the row read `for update`.
//
// PRIVACY. Nothing here logs. Errors carry the SQLSTATE through the driver's error, never the document; callers log fixed codes only
// (edit-my-trip 7). A tombstone keeps its id and title only: the document and its household columns are cleared by the delete (and
// 0013's CHECK plan_draft_tombstone refuses anything else).
//
// BOUNDS (review-em-s B2). At most ACCOUNT_PLANS_LIMITS.accountPlans live rows (the cap trigger) and PLAN_SYNC.tombstoneCap tombstones
// per user (deletePlan drops the oldest beyond it in the same transaction); the list reads the live rows and the tombstones apart, so
// tombstones can never push a live row out of the answer.
import { PLAN_SYNC } from "../config/plans.ts";
import { ACCOUNT_PLANS_LIMITS, decideDelete, decidePut, type AccountPlanKind, type AccountPlanRow, type PlanRowNow } from "../schema/api/account-plans.ts";
import { pgErrorCode } from "./client.ts";
import { withUserTransaction, type TxContext } from "./tx.ts";
import type { UserTx } from "./profile.ts";

/** The SQLSTATE the cap trigger raises (0013 `plan_draft_cap`). */
export const PLAN_CAP_SQLSTATE = "TP001";

/** The columns a write stores: the document and what was derived from it. */
export interface PlanWrite {
  title: string;
  /** the parsed document; stored as jsonb */
  doc: unknown;
  kind: AccountPlanKind;
  source_trip: string | null;
  /** ISO date */
  start: string | null;
  days: number | null;
}

/** A 409's content (contract `accountPlanConflict`): the row as it is now. `doc` is null for a tombstone. */
export interface PlanConflict {
  revision: number;
  doc: unknown | null;
  deleted_at: string | null;
}

export type PutResult =
  | { kind: "written"; revision: number; created: boolean }
  | { kind: "conflict"; row: PlanConflict }
  | { kind: "not-found" }
  | { kind: "cap" };

export type DeleteResult = { kind: "deleted"; revision: number } | { kind: "already"; revision: number } | { kind: "conflict"; row: PlanConflict } | { kind: "not-found" };

/** One live row as the merge reads it (M3): `doc` only for the rows whose trip and start a device copy names. */
export interface PlanMergeKey {
  id: string;
  source_trip: string | null;
  start: string | null;
  doc: unknown | null;
}

/** What the merge's inserts did, per copy id (contract `accountPlanMergeAnswer`; the route adds the plan's own lists). */
export interface MergeInsertResult {
  /** `returning id`: in the account now */
  inserted: string[];
  /** the caller already holds the id, live or a tombstone (removed in the account, so the device may drop it); never counted in the cap */
  already: string[];
  /** the cap trigger refused it */
  overCap: string[];
  /** a CHECK refused it: it stays on the device. Never "another user holds the id": ids are per user (S1) */
  refused: string[];
}

export interface PlansOptions {
  /** the transaction runner (default: withUserTransaction against the runtime pool) */
  tx?: UserTx;
  /** tombstone retention in days (default PLAN_SYNC.tombstoneDays) */
  tombstoneDays?: number;
  /** tombstones one user keeps, newest first (default PLAN_SYNC.tombstoneCap) */
  tombstoneCap?: number;
}

const runner = (o: PlansOptions): UserTx => o.tx ?? ((userId, fn) => withUserTransaction(userId, fn));
const keepDays = (o: PlansOptions): number => o.tombstoneDays ?? PLAN_SYNC.tombstoneDays;
const iso = (x: unknown): string | null => (x === null || x === undefined ? null : x instanceof Date ? x.toISOString() : new Date(String(x)).toISOString());
const isCap = (e: unknown): boolean => pgErrorCode(e) === PLAN_CAP_SQLSTATE;

interface NowRow {
  revision: number | string;
  deleted_at: unknown;
  [k: string]: unknown;
}
const rowNow = (r: NowRow | undefined): PlanRowNow | null => (r ? { revision: Number(r.revision), deleted_at: iso(r.deleted_at) } : null);

/** The caller's own tombstones older than the retention go first (under RLS: only the caller's rows can match). */
async function purgeOwn(ctx: TxContext, userId: string, days: number): Promise<void> {
  await ctx.query(`delete from public.plan_draft where user_id = $1 and deleted_at < now() - make_interval(days => $2::int)`, [userId, days]);
}

/** The caller's tombstones beyond the newest `keep` (B2): dropped, oldest first, so one account's tombstones stay bounded. */
async function capTombstones(ctx: TxContext, userId: string, keep: number): Promise<void> {
  await ctx.query(
    `delete from public.plan_draft
      where user_id = $1 and deleted_at is not null
        and id not in (select id from public.plan_draft where user_id = $1 and deleted_at is not null
                        order by deleted_at desc, id desc limit $2)`,
    [userId, keep],
  );
}

async function current(ctx: TxContext, userId: string, id: string): Promise<PlanConflict | null> {
  const { rows } = await ctx.query<NowRow & { doc: unknown }>(
    `select revision, deleted_at, doc from public.plan_draft where user_id = $1 and id = $2`,
    [userId, id],
  );
  const r = rows[0];
  return r ? { revision: Number(r.revision), deleted_at: iso(r.deleted_at), doc: r.deleted_at === null ? (r.doc ?? null) : null } : null;
}

const LIST_COLUMNS = `id::text as id, title, kind, source_trip, to_char(start, 'YYYY-MM-DD') as start, days, revision, updated_at, deleted_at`;

/**
 * The light list (4.1, P8: never the document): every live row (at most ACCOUNT_PLANS_LIMITS.accountPlans, newest first), THEN the
 * newest tombstones of the retention window (at most ACCOUNT_PLANS_LIMITS.listTombstones). Two bounded reads, so however many rows a
 * person removed, no live row is pushed out of the answer and no device is told to drop it (review-em-s B2). Read only.
 */
export async function listPlans(userId: string, opts: PlansOptions = {}): Promise<AccountPlanRow[]> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const live = await ctx.query<Record<string, unknown>>(
      `select ${LIST_COLUMNS} from public.plan_draft
         where user_id = $1 and deleted_at is null
         order by updated_at desc, id
         limit $2`,
      [userId, ACCOUNT_PLANS_LIMITS.accountPlans],
    );
    const tombs = await ctx.query<Record<string, unknown>>(
      `select ${LIST_COLUMNS} from public.plan_draft
         where user_id = $1 and deleted_at is not null and deleted_at >= now() - make_interval(days => $2::int)
         order by deleted_at desc, id
         limit $3`,
      [userId, keepDays(opts), ACCOUNT_PLANS_LIMITS.listTombstones],
    );
    return [...live.rows, ...tombs.rows];
  });
  return result.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    kind: (r.kind ?? null) as AccountPlanKind | null,
    source_trip: (r.source_trip ?? null) as string | null,
    start: (r.start ?? null) as string | null,
    days: r.days === null || r.days === undefined ? null : Number(r.days),
    revision: Number(r.revision),
    updated_at: iso(r.updated_at) as string,
    deleted_at: iso(r.deleted_at),
  }));
}

/** One live document and its revision; null for no row the caller can see, a tombstone, or a titled draft with no document. */
export async function getPlan(userId: string, id: string, opts: PlansOptions = {}): Promise<{ revision: number; doc: unknown } | null> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const { rows } = await ctx.query<{ revision: number | string; doc: unknown }>(
      `select revision, doc from public.plan_draft where user_id = $1 and id = $2 and deleted_at is null and doc is not null`,
      [userId, id],
    );
    return rows[0];
  });
  return result ? { revision: Number(result.revision), doc: result.doc } : null;
}

/**
 * The PUT (4.1, 4.5): `base: null` creates, a number updates that revision, `restore` with a tombstone's revision brings it back.
 * Decided by `decidePut` on the row read `for update`. A create of an id the caller already holds is a `conflict` with the row; another
 * user's rows play no part (the key is per user, S1), so the answer never depends on them.
 */
export async function putPlan(userId: string, id: string, base: number | null, restore: boolean, w: PlanWrite, opts: PlansOptions = {}): Promise<PutResult> {
  const doc = JSON.stringify(w.doc);
  try {
    const { result } = await runner(opts)(userId, async (ctx): Promise<PutResult> => {
      await purgeOwn(ctx, userId, keepDays(opts));
      const found = await ctx.query<NowRow>(`select revision, deleted_at from public.plan_draft where user_id = $1 and id = $2 for update`, [userId, id]);
      const decision = decidePut(base, rowNow(found.rows[0]), restore);
      if (decision === "not-found") return { kind: "not-found" };
      if (decision === "conflict") return { kind: "conflict", row: (await current(ctx, userId, id))! };
      if (decision === "insert") {
        const ins = await ctx.query<{ revision: number | string }>(
          `insert into public.plan_draft (id, user_id, title, doc, kind, source_trip, start, days)
             values ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7::date, $8)
           on conflict (user_id, id) do nothing
           returning revision`,
          [id, userId, w.title, doc, w.kind, w.source_trip, w.start, w.days],
        );
        if (ins.rows[0]) return { kind: "written", revision: Number(ins.rows[0].revision), created: true };
        // Nothing inserted: another request of this user created it since the read above.
        const now = await current(ctx, userId, id);
        return now ? { kind: "conflict", row: now } : { kind: "not-found" };
      }
      const upd = await ctx.query<{ revision: number | string }>(
        `update public.plan_draft
            set title = $3, doc = $4::jsonb, kind = $5, source_trip = $6, start = $7::date, days = $8,
                deleted_at = case when $9::boolean then null else deleted_at end
          where user_id = $10 and id = $1::uuid and revision = $2
          returning revision`,
        [id, base, w.title, doc, w.kind, w.source_trip, w.start, w.days, restore, userId],
      );
      if (upd.rows[0]) return { kind: "written", revision: Number(upd.rows[0].revision), created: false };
      return { kind: "conflict", row: (await current(ctx, userId, id))! };
    });
    return result;
  } catch (e) {
    if (isCap(e)) return { kind: "cap" };
    throw e;
  }
}

/**
 * The DELETE (4.5): a tombstone for the revision the device last saw. The document and its household columns are cleared; the title
 * stays so another device can name what was removed. A second delete is `already` (idempotent); a stale base is a conflict. The
 * caller's tombstones beyond PLAN_SYNC.tombstoneCap (the oldest) are dropped in the same transaction (B2).
 */
export async function deletePlan(userId: string, id: string, base: number, opts: PlansOptions = {}): Promise<DeleteResult> {
  const { result } = await runner(opts)(userId, async (ctx): Promise<DeleteResult> => {
    await purgeOwn(ctx, userId, keepDays(opts));
    const found = await ctx.query<NowRow>(`select revision, deleted_at from public.plan_draft where user_id = $1 and id = $2 for update`, [userId, id]);
    const now = rowNow(found.rows[0]);
    const decision = decideDelete(base, now);
    if (decision === "not-found") return { kind: "not-found" };
    if (decision === "already") return { kind: "already", revision: now!.revision };
    if (decision === "conflict") return { kind: "conflict", row: (await current(ctx, userId, id))! };
    const upd = await ctx.query<{ revision: number | string }>(
      `update public.plan_draft
          set deleted_at = now(), doc = null, kind = null, source_trip = null, start = null, days = null
        where user_id = $3 and id = $1::uuid and revision = $2 and deleted_at is null
        returning revision`,
      [id, base, userId],
    );
    if (!upd.rows[0]) return { kind: "conflict", row: (await current(ctx, userId, id))! };
    await capTombstones(ctx, userId, opts.tombstoneCap ?? PLAN_SYNC.tombstoneCap);
    return { kind: "deleted", revision: Number(upd.rows[0].revision) };
  });
  return result;
}

/**
 * The merge's view of the account (4.2): every live row's id, trip and start (for the cap and M1), and the document of the rows whose
 * trip and start match one of `pairs` (M3 compares their content).
 */
export async function mergeKeys(userId: string, pairs: readonly { trip: string; start: string }[], opts: PlansOptions = {}): Promise<PlanMergeKey[]> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const { rows } = await ctx.query<Record<string, unknown>>(
      `select d.id::text as id, d.source_trip, to_char(d.start, 'YYYY-MM-DD') as start,
              case when exists (select 1 from unnest($2::text[], $3::date[]) as p(trip, start)
                                 where p.trip = d.source_trip and p.start = d.start)
                   then d.doc end as doc
         from public.plan_draft d
        where d.user_id = $1 and d.deleted_at is null
        order by d.updated_at desc, d.id`,
      [userId, pairs.map((p) => p.trip), pairs.map((p) => p.start)],
    );
    return rows;
  });
  return result.map((r) => ({
    id: String(r.id),
    source_trip: (r.source_trip ?? null) as string | null,
    start: (r.start ?? null) as string | null,
    doc: r.doc ?? null,
  }));
}

/**
 * The merge's inserts (M1, M4): one transaction, a savepoint per row so a refused row (the cap, a CHECK) does not undo the others.
 * Each id is looked up first: one the caller already holds, live or a tombstone, is `already` without an insert, so a copy the person
 * removed in the account is never reported `overCap` at the cap (review-em-s N2: the cap trigger fires before ON CONFLICT). The insert
 * is still `on conflict (user_id, id) do nothing`, for a create racing in from another tab (`already` too).
 */
export async function insertPlans(userId: string, rows: readonly ({ id: string } & PlanWrite)[], opts: PlansOptions = {}): Promise<MergeInsertResult> {
  const out: MergeInsertResult = { inserted: [], already: [], overCap: [], refused: [] };
  if (rows.length === 0) return out;
  const { result } = await runner(opts)(userId, async (ctx) => {
    await purgeOwn(ctx, userId, keepDays(opts));
    for (const r of rows) {
      const held = await ctx.query(`select 1 from public.plan_draft where user_id = $1 and id = $2`, [userId, r.id]);
      if (held.rows.length > 0) {
        out.already.push(r.id);
        continue;
      }
      await ctx.query("savepoint plan_merge_row");
      try {
        const ins = await ctx.query<{ id: string }>(
          `insert into public.plan_draft (id, user_id, title, doc, kind, source_trip, start, days)
             values ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7::date, $8)
           on conflict (user_id, id) do nothing
           returning id::text as id`,
          [r.id, userId, r.title, JSON.stringify(r.doc), r.kind, r.source_trip, r.start, r.days],
        );
        await ctx.query("release savepoint plan_merge_row");
        (ins.rows[0] ? out.inserted : out.already).push(r.id);
      } catch (e) {
        await ctx.query("rollback to savepoint plan_merge_row");
        await ctx.query("release savepoint plan_merge_row");
        (isCap(e) ? out.overCap : out.refused).push(r.id);
      }
    }
    return out;
  });
  return result;
}

/**
 * Every row of the user, live, title-only and tombstoned (account deletion, F17; the owner's manual removal steps until F17 16 run the
 * same statement as the owner: account-profile-and-travellers.md 9.3, review-em-s S6). Returns the number of rows removed. Under RLS
 * it can only ever remove the caller's own rows.
 */
export async function deletePlans(userId: string, opts: PlansOptions = {}): Promise<number> {
  const { result } = await runner(opts)(userId, async (ctx) => {
    const r = await ctx.query(`delete from public.plan_draft where user_id = $1`, [userId]);
    return r.rowCount ?? 0;
  });
  return result;
}

/** The owner-side purge (review-em-s B2 point 4, S2): what a runner of `plan_draft_purge()` needs. */
export interface PurgeExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{ rows: Row[] }>;
}

/**
 * Everyone's tombstones older than `days` (default PLAN_SYNC.tombstoneDays), through 0013's `plan_draft_purge()`, which only the
 * table owner may execute: `exec` must be an OWNER connection (the runtime pool's own login, never inside withUserTransaction; or the
 * migration client). Returns the number of rows dropped. Content-free: it reads and returns a count only.
 */
export async function purgeAllTombstones(exec: PurgeExecutor, days: number = PLAN_SYNC.tombstoneDays): Promise<number> {
  if (!Number.isInteger(days) || days < 1) throw new RangeError("purge: days is a whole number of at least 1");
  const { rows } = await exec.query<{ n: number | string }>("select plan_draft_purge($1) as n", [days]);
  return Number(rows[0]?.n ?? 0);
}
