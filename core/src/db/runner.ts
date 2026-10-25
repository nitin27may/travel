// Versioned, checksummed, advisory-locked, transactional migration runner.
//
// The runner is written against a minimal Executor interface so it can be unit-tested with an
// in-memory fake and integration-tested with a real `pg` client. Each pending migration is applied
// in its own transaction; the whole run is guarded by a session advisory lock so two processes
// never migrate at once. It refuses to run when an already-applied migration has changed on disk
// (a destructive edit) or has disappeared (a missing migration), and it refuses to insert a new
// migration *before* one that is already applied (out-of-order).

import { loadMigrations, type Migration } from "./loader.ts";
import { pgErrorCode, type QueryRow } from "./client.ts";

/** A minimal query surface satisfied by `pg.Client`/`pg.PoolClient`. */
export interface Executor {
  query<Row extends QueryRow = QueryRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface AppliedRow {
  version: string;
  name: string;
  checksum: string;
}

export interface MigrationPlan {
  applied: AppliedRow[];
  pending: Migration[];
}

export interface RunResult {
  applied: string[]; // versions applied this run
  alreadyApplied: string[];
}

export class MigrationError extends Error {}

// A fixed 64-bit key so every process locks on the same resource. Chosen once; do not change.
const ADVISORY_LOCK_KEY = 4873559201847n;

const LEDGER_DDL = `
create table if not exists schema_migrations (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);
revoke all on schema_migrations from public;
alter table schema_migrations enable row level security;`;

async function ensureLedger(exec: Executor): Promise<void> {
  await exec.query(LEDGER_DDL);
}

/**
 * Read the applied-migration ledger *without writing anything*. If the ledger table does not exist
 * yet (a brand-new database), returns an empty list rather than creating it — so `plan`/`status` and
 * `dryRun` are strictly read-only. `to_regclass` returns NULL for an absent relation.
 */
async function readApplied(exec: Executor): Promise<AppliedRow[]> {
  const reg = await exec.query<{ reg: string | null }>(
    `select to_regclass('public.schema_migrations') as reg`,
  );
  if (!reg.rows[0]?.reg) return [];
  const { rows } = await exec.query<{ version: string; name: string; checksum: string }>(
    `select version, name, checksum from schema_migrations order by version`,
  );
  return rows.map((r) => ({ version: r.version, name: r.name, checksum: r.checksum }));
}

/**
 * Compare on-disk migrations against the applied ledger and return the plan, or throw a
 * MigrationError describing a destructive/missing/out-of-order situation. Pure given its inputs.
 */
export function plan(migrations: Migration[], applied: AppliedRow[]): MigrationPlan {
  const byVersion = new Map(migrations.map((m) => [m.version, m]));
  for (const row of applied) {
    const file = byVersion.get(row.version);
    if (!file) {
      throw new MigrationError(
        `missing migration: version ${row.version} (${row.name}) is recorded as applied but its ` +
          `file is absent. Refusing to run; restore the file or reconcile the ledger.`,
      );
    }
    if (file.checksum !== row.checksum) {
      throw new MigrationError(
        `checksum drift: migration ${row.version}_${file.name}.sql changed after it was applied ` +
          `(applied ${row.checksum.slice(0, 12)}…, on disk ${file.checksum.slice(0, 12)}…). ` +
          `Applied migrations are immutable; add a new migration instead.`,
      );
    }
  }
  const appliedVersions = new Set(applied.map((a) => a.version));
  const maxApplied = applied.length ? applied[applied.length - 1].version : "";
  const pending: Migration[] = [];
  for (const m of migrations) {
    if (appliedVersions.has(m.version)) continue;
    if (maxApplied && m.version < maxApplied) {
      throw new MigrationError(
        `out-of-order migration: ${m.file} (version ${m.version}) is new but sorts before the ` +
          `last applied version ${maxApplied}. Give it a higher version.`,
      );
    }
    pending.push(m);
  }
  return { applied, pending };
}

/** Compute the plan against a live database. Strictly read-only: never creates or writes the ledger. */
export async function planAgainst(exec: Executor, migrations = loadMigrations()): Promise<MigrationPlan> {
  const applied = await readApplied(exec);
  return plan(migrations, applied);
}

/**
 * Apply all pending migrations. Acquires a session advisory lock for the whole run, then applies
 * each pending migration inside its own transaction and records it in the ledger atomically with
 * its DDL. Set `dryRun` to validate and report the plan without writing anything.
 */
export async function migrate(
  exec: Executor,
  opts: { migrations?: Migration[]; dryRun?: boolean } = {},
): Promise<RunResult> {
  const migrations = opts.migrations ?? loadMigrations();
  // Fail closed: if the advisory lock cannot be acquired, abort *before* any ledger write or DDL,
  // so two processes never migrate at once and a lock error never silently proceeds unlocked.
  await acquireLock(exec);
  try {
    const applied = await readApplied(exec); // read-only; does not create the ledger
    const { pending } = plan(migrations, applied);
    const result: RunResult = {
      applied: [],
      alreadyApplied: applied.map((a) => a.version),
    };
    if (opts.dryRun) {
      // Validation only — report the plan without creating the ledger or writing anything.
      result.applied = pending.map((m) => m.version);
      return result;
    }
    // About to write: make sure the ledger (and its RLS) exists before recording anything.
    await ensureLedger(exec);
    for (const m of pending) {
      await exec.query("begin");
      try {
        await exec.query(m.sql);
        await exec.query(
          `insert into schema_migrations (version, name, checksum) values ($1, $2, $3)`,
          [m.version, m.name, m.checksum],
        );
        await exec.query("commit");
      } catch (err) {
        // Roll back this migration's transaction. If the rollback itself fails, log only the
        // SQLSTATE code (no SQL, params, or secrets), then surface the original failure.
        await exec.query("rollback").catch((rollbackErr: unknown) => {
          console.error(`[db] rollback failed for ${m.file} (sqlstate=${pgErrorCode(rollbackErr)})`);
        });
        throw new MigrationError(
          `migration ${m.file} failed and was rolled back: ${(err as Error).message}`,
        );
      }
      result.applied.push(m.version);
    }
    return result;
  } finally {
    await releaseLock(exec);
  }
}

/**
 * Acquire the session advisory lock. Fails closed: any error (lock busy, permission, connection)
 * propagates and the caller aborts before touching the schema. The fake executors used in tests
 * answer the `pg_advisory_lock` query, so there is no test-only bypass here.
 */
async function acquireLock(exec: Executor): Promise<void> {
  await exec.query(`select pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY.toString()]);
}

async function releaseLock(exec: Executor): Promise<void> {
  // Best-effort: the session releases the lock on close anyway. If it fails, log only the SQLSTATE.
  await exec.query(`select pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY.toString()]).catch(
    (err: unknown) => {
      console.error(`[db] advisory unlock failed (sqlstate=${pgErrorCode(err)})`);
    },
  );
}
