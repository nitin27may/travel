// The seed engine (LOCAL-2; spec 2.1, 6.3 to 6.5, build notes LOCAL-C 12.5 and 12.6). One code path for every target: build the
// seed rows from a FileSource, read the target's rows back over the same column set, classify every record id (LOCAL-C's planTable),
// and apply the difference in ONE transaction under the seed advisory lock. A second run of the same commit plans 0 writes because
// both sides are hashed from the same columns (hash.ts) and an unchanged row is never touched.
//
// Safety, all enforced here and tested:
//   - every statement goes through `run`, which calls assertSeedTable first: a private or unclassified table is refused before the
//     driver is called (spec 6.2); deletes also call assertDeletable and never TRUNCATE;
//   - a retired or kept table's rows are never deleted (contract onMissing), they are counted as retained;
//   - the apply order is the contract's: inserts and updates top to bottom, deletes in DELETE_ORDER, the commit stamp last;
//   - the transaction takes pg_try_advisory_xact_lock(SEED_ADVISORY_LOCK_KEY) and fails closed when it is held;
//   - dry runs and verifies run in a read only transaction, so they cannot write whatever the code does.
import { PLAN_SAMPLE_IDS, SEED_ADVISORY_LOCK_KEY } from "../../../config/database.ts";
import type { QueryRow } from "../../../db/client.ts";
import { loadMigrations } from "../../../db/loader.ts";
import {
  DELETE_ORDER, SEED_COMMIT_KEY, SeedContractError, assertDeletable, assertSeedTable, classifyRow, compareTable, contentHash, driftResult,
  createdTables, planTable, rowId, seedPlan,
  type ChangeKind, type DriftResult, type SeedPlan, type TablePlan, type TargetFacts, type TargetRow,
} from "../../../seed/index.ts";
import type { ColumnDef, Row, TableData } from "./reference.ts";

/** What the engine needs of a connection: `pg.Client` and `pg.PoolClient` satisfy it. */
export interface Db {
  query<R extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

export class SeedEngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SeedEngineError";
  }
}

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const q = (id: string): string => {
  if (!IDENT_RE.test(id)) throw new SeedEngineError("E_SEED_IDENT", `unsafe identifier ${JSON.stringify(id)}`);
  return `"${id}"`;
};

/** Rows per statement. One jsonb parameter per statement; 4,000 towns are a handful of statements. */
export const BATCH_ROWS = 500;

/** The one place a statement is sent: refuses a table the contract does not own before the driver sees the statement. */
export async function run<R extends QueryRow>(db: Db, table: string, sql: string, params?: readonly unknown[]): Promise<{ rows: R[] }> {
  assertSeedTable(table);
  return db.query<R>(sql, params);
}

// ---- hashing -----------------------------------------------------------------------------------------------------------------------
const hashedRow = (data: TableData, row: Row): Row =>
  data.hashColumns ? Object.fromEntries(data.hashColumns.map((c) => [c, row[c]])) : row;

/** record id -> content hash of the seed's rows. */
export function seedMap(data: TableData): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of data.rows) {
    const id = rowId(data.spec, row);
    if (m.has(id)) throw new SeedEngineError("E_SEED_DUPLICATE", `${data.spec.table}: two seed rows with the id ${id}`);
    m.set(id, contentHash(data.spec, hashedRow(data, row)));
  }
  return m;
}

const selectList = (cols: readonly ColumnDef[]): string => cols.map((c) => `${c.read ?? q(c.name)} as ${q(c.name)}`).join(", ");

/** record id -> hash of the target's rows, read over the columns the seed writes; null when the table does not exist. */
export async function readTarget(db: Db, data: TableData): Promise<Map<string, TargetRow> | null> {
  const table = data.spec.table;
  const reg = await run<{ reg: string | null }>(db, table, `select to_regclass($1) as reg`, [`public.${table}`]);
  if (!reg.rows[0]?.reg) return null;
  const cols = data.hashColumns ? data.columns.filter((c) => data.hashColumns!.includes(c.name)) : data.columns;
  const { rows } = await run<Row>(db, table, `select ${selectList(cols)} from ${q(table)}`);
  const out = new Map<string, TargetRow>();
  for (const row of rows) out.set(rowId(data.spec, row), { hash: contentHash(data.spec, hashedRow(data, row)) });
  return out;
}

// ---- classification ----------------------------------------------------------------------------------------------------------------
export interface TableDiff {
  insert: string[];
  update: string[];
  retire: string[];
  delete: string[];
}

/** Full id lists per write kind (the plan prints only a sample). Uses LOCAL-C's classifyRow, the one rule. */
export function diffTable(data: TableData, seed: ReadonlyMap<string, string>, target: ReadonlyMap<string, TargetRow>): TableDiff {
  const diff: TableDiff = { insert: [], update: [], retire: [], delete: [] };
  for (const id of new Set([...seed.keys(), ...target.keys()])) {
    const kind: ChangeKind = classifyRow(data.spec, seed.get(id), target.get(id));
    if (kind === "insert" || kind === "update" || kind === "retire" || kind === "delete") diff[kind].push(id);
  }
  for (const k of Object.keys(diff) as (keyof TableDiff)[]) diff[k].sort();
  return diff;
}

export interface Planned {
  plan: SeedPlan;
  diffs: Map<string, TableDiff>;
  tables: Map<string, { data: TableData; seed: Map<string, string>; target: Map<string, TargetRow> | null }>;
}

export interface RunFacts {
  commit: string;
  target: TargetFacts;
}

/** Read the target and plan every table. Throws E_SEED_NO_TABLE when a table is missing (migrate first). */
export async function planSeed(db: Db, built: readonly TableData[], facts: RunFacts, sample = PLAN_SAMPLE_IDS): Promise<Planned> {
  const plans: TablePlan[] = [];
  const diffs = new Map<string, TableDiff>();
  const tables: Planned["tables"] = new Map();
  for (const data of built) {
    const seed = seedMap(data);
    const target = await readTarget(db, data);
    tables.set(data.spec.table, { data, seed, target });
    if (target === null) throw new SeedEngineError("E_SEED_NO_TABLE", `${data.spec.table} does not exist on the target; run the migrations first (pnpm db:migrate)`);
    plans.push(planTable(data.spec, seed, target, sample));
    diffs.set(data.spec.table, diffTable(data, seed, target));
  }
  return { plan: seedPlan(facts.commit, facts.target, plans), diffs, tables };
}

// ---- statements --------------------------------------------------------------------------------------------------------------------
const recordset = (cols: readonly ColumnDef[]): string => `jsonb_to_recordset($1::jsonb) as x(${cols.map((c) => `${q(c.name)} ${c.type}`).join(", ")})`;
const valueOf = (c: ColumnDef): string => c.write ?? `x.${q(c.name)}`;
const pick = (row: Row, cols: readonly ColumnDef[]): Row => Object.fromEntries(cols.map((c) => [c.name, row[c.name] ?? null]));

function chunks<T>(items: readonly T[], size = BATCH_ROWS): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function insertRows(db: Db, data: TableData, rows: readonly Row[]): Promise<void> {
  const t = data.spec.table;
  const sql = `insert into ${q(t)} (${data.columns.map((c) => q(c.name)).join(", ")}) select ${data.columns.map(valueOf).join(", ")} from ${recordset(data.columns)}`;
  for (const batch of chunks(rows)) await run(db, t, sql, [JSON.stringify(batch.map((r) => pick(r, data.columns)))]);
}

async function updateRows(db: Db, data: TableData, rows: readonly Row[]): Promise<void> {
  const t = data.spec.table;
  const set = data.columns.filter((c) => !data.key.includes(c.name));
  if (set.length === 0) return;
  const where = data.key.map((k) => `t.${q(k)} = x.${q(k)}`).join(" and ");
  const sql = `update ${q(t)} t set ${set.map((c) => `${q(c.name)} = ${valueOf(c)}`).join(", ")} from ${recordset(data.columns)} where ${where}`;
  for (const batch of chunks(rows)) await run(db, t, sql, [JSON.stringify(batch.map((r) => pick(r, data.columns)))]);
}

async function deleteRows(db: Db, data: TableData, keys: readonly Row[]): Promise<void> {
  const t = data.spec.table;
  assertDeletable(t);
  const cols = data.columns.filter((c) => data.key.includes(c.name));
  const where = data.key.map((k) => `t.${q(k)} = x.${q(k)}`).join(" and ");
  const sql = `delete from ${q(t)} t using ${recordset(cols)} where ${where}`;
  for (const batch of chunks(keys)) await run(db, t, sql, [JSON.stringify(batch)]);
}

/** Split a composite record id back into its key columns (a single-column key is the id itself). */
function keyRow(data: TableData, id: string): Row {
  const values: unknown[] = data.key.length === 1 ? [id] : (JSON.parse(id) as unknown[]);
  return Object.fromEntries(data.key.map((k, i) => [k, values[i]]));
}

// ---- apply -------------------------------------------------------------------------------------------------------------------------
export interface ApplyResult {
  plan: SeedPlan;
  /** rows written per table: inserts + updates + deletes */
  written: Record<string, number>;
  elapsedMs: number;
}

/**
 * Plan inside the transaction (after the lock, so the plan is the state the writes meet), then write. One transaction for the run:
 * it commits whole or not at all. `stampCommit` writes the commit under SEED_COMMIT_KEY last, so a reader never sees a stamp for
 * rows that are not there.
 */
export async function applySeed(db: Db, built: readonly TableData[], facts: RunFacts, opts: { now?: () => number } = {}): Promise<ApplyResult> {
  const now = opts.now ?? Date.now;
  const started = now();
  await db.query("begin");
  try {
    const lock = await db.query<{ ok: boolean }>(`select pg_try_advisory_xact_lock($1::bigint) as ok`, [SEED_ADVISORY_LOCK_KEY.toString()]);
    if (!lock.rows[0]?.ok) throw new SeedEngineError("E_SEED_LOCKED", "another seed or sync holds the seed lock on this database; try again when it finishes");
    const planned = await planSeed(db, built, facts);
    const written: Record<string, number> = {};
    const byTable = (t: string): { data: TableData; seed: Map<string, string> } => planned.tables.get(t)!;
    for (const data of built) {
      const diff = planned.diffs.get(data.spec.table)!;
      const byId = new Map(data.rows.map((r) => [rowId(data.spec, r), r]));
      const ins = diff.insert.map((id) => byId.get(id)!);
      const upd = diff.update.map((id) => byId.get(id)!);
      // Parents before children: `data.rows` is already in dependency order, so keep that order for the inserts.
      const order = new Map(data.rows.map((r, i) => [rowId(data.spec, r), i]));
      ins.sort((a, b) => order.get(rowId(data.spec, a))! - order.get(rowId(data.spec, b))!);
      await insertRows(db, data, ins);
      await updateRows(db, data, upd);
      written[data.spec.table] = ins.length + upd.length;
    }
    for (const table of DELETE_ORDER) {
      const entry = planned.tables.get(table);
      if (!entry) continue;
      const diff = planned.diffs.get(table)!;
      if (diff.delete.length === 0) continue;
      await deleteRows(db, byTable(table).data, diff.delete.map((id) => keyRow(entry.data, id)));
      written[table] = (written[table] ?? 0) + diff.delete.length;
    }
    await stampCommit(db, facts.commit);
    await db.query("commit");
    return { plan: planned.plan, written, elapsedMs: now() - started };
  } catch (err) {
    await db.query("rollback").catch(() => undefined);
    throw err;
  }
}

/** The commit marker. A stamp, not content: it moves only when the value differs, and it is not a planned write. */
async function stampCommit(db: Db, commit: string): Promise<void> {
  await run(
    db, "catalogue_meta",
    `insert into catalogue_meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value where catalogue_meta.value is distinct from excluded.value`,
    [SEED_COMMIT_KEY, commit],
  );
}

/** Run `fn` in a read only transaction: a plan or a verify cannot write, whatever the code does. */
export async function readOnly<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.query("begin read only");
  try {
    return await fn();
  } finally {
    await db.query("rollback").catch(() => undefined);
  }
}

// ---- seed on an empty target -------------------------------------------------------------------------------------------------------
/** `db:seed` is for an empty catalogue: the seed tables that exist and hold a row make it refuse (use db:sync). */
export async function nonEmptyTables(db: Db, built: readonly TableData[]): Promise<string[]> {
  const out: string[] = [];
  for (const data of built) {
    const t = data.spec.table;
    const reg = await run<{ reg: string | null }>(db, t, `select to_regclass($1) as reg`, [`public.${t}`]);
    if (!reg.rows[0]?.reg) continue;
    const r = await run<{ n: number }>(db, t, `select count(*)::int as n from (select 1 from ${q(t)} limit 1) s`);
    if ((r.rows[0]?.n ?? 0) > 0) out.push(t);
  }
  return out;
}

// ---- verify ------------------------------------------------------------------------------------------------------------------------
/** The migration versions whose SQL creates a table of the built seed (what the seed needs before it can run). */
export function requiredMigrations(built: readonly TableData[]): string[] {
  const wanted = new Set(built.map((d) => d.spec.table));
  const out = new Set<string>();
  for (const m of loadMigrations()) if (createdTables(m.sql, m.version).some((t) => wanted.has(t.name))) out.add(m.version);
  return [...out].sort();
}

async function appliedVersions(db: Db): Promise<string[]> {
  const reg = await db.query<{ reg: string | null }>(`select to_regclass('public.schema_migrations') as reg`);
  if (!reg.rows[0]?.reg) return [];
  const { rows } = await db.query<{ version: string }>(`select version from schema_migrations order by version`);
  return rows.map((r) => r.version);
}

/** The seed-drift/1 result: per table, the seed's rows and table hash against the target's (spec 2.3, 2.6). Read only. */
export async function verifySeed(db: Db, built: readonly TableData[], facts: RunFacts, checkedAt = new Date()): Promise<DriftResult> {
  const tables = [];
  for (const data of built) {
    tables.push(compareTable(data.spec, seedMap(data), await readTarget(db, data)));
  }
  return driftResult({
    commit: facts.commit, target: facts.target, checkedAt, requiredMigrations: requiredMigrations(built), appliedMigrations: await appliedVersions(db), tables,
  });
}

export { SeedContractError };
