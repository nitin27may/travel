// The drift contract: the shape of a `db:verify` result (spec 2.3, 2.6) and the comparison behind it. Pure.
//
// `db:verify --target t` builds the seed of the commit in memory, reads every seed table of the target read-only, and compares per
// table: the row count and the table hash (./hash.ts tableHash over `record id -> content hash`) of the rows the seed owns. LOCAL-3's
// gate stage and the rehearsal (LOCAL-5) consume the result. Exit 0 when `ok`, 1 otherwise.
//
// What counts as drift, per table:
//   missing   a seed row the target lacks
//   changed   a row in both whose content hash differs (on a retiring table, also a seeded row the target has retired)
//   extra     a target row the seed lacks, on a table that deletes; on a retiring table, a LIVE row the seed lacks
// Not drift: `retained` rows (a kept table's or append-only table's rows the seed no longer has, and already retired rows), because
// a sync leaves them there on purpose (retire, never delete).
import { z } from "zod";
import { PLAN_SAMPLE_IDS } from "../config/database.ts";
import { SEED_CONTRACT_VERSION, SEED_TABLES, assertSeedTable, type SeedTableSpec } from "./contract.ts";
import { tableHash } from "./hash.ts";
import type { TargetRow } from "./plan.ts";
import { targetFactsSchema } from "./guard.ts";

export const DRIFT_SCHEMA = "seed-drift/1";
export const DRIFT_STATUS = ["equal", "differ", "missing_table"] as const;
export type DriftStatus = (typeof DRIFT_STATUS)[number];

const count = z.number().int().nonnegative();
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const ids = z.array(z.string()).max(PLAN_SAMPLE_IDS);

export const driftTableSchema = z.strictObject({
  table: z.string(),
  status: z.enum(DRIFT_STATUS),
  /** the seed's rows and table hash */
  seed: z.strictObject({ rows: count, hash: hex64 }),
  /** the target's rows in the seed's scope (retained rows left out) and their table hash; null when the table does not exist */
  target: z.strictObject({ rows: count, hash: hex64, retained: count }).nullable(),
  /** up to PLAN_SAMPLE_IDS record ids each, sorted */
  sample: z.strictObject({ missing: ids, changed: ids, extra: ids }),
  counts: z.strictObject({ missing: count, changed: count, extra: count }),
});
export type DriftTable = z.infer<typeof driftTableSchema>;

export const driftResultSchema = z.strictObject({
  schema: z.literal(DRIFT_SCHEMA),
  contract_version: z.number().int().positive(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  /** name, kind and host only: never a URL, user or password */
  target: targetFactsSchema,
  checked_at: z.iso.datetime(),
  /** migration versions the seed needs, the target's applied versions, and the needed ones it lacks */
  migrations: z.strictObject({ required: z.array(z.string()), applied: z.array(z.string()), missing: z.array(z.string()) }),
  tables: z.array(driftTableSchema),
  totals: z.strictObject({ tables: count, differing: count, missing: count, changed: count, extra: count }),
  ok: z.boolean(),
});
export type DriftResult = z.infer<typeof driftResultSchema>;

/** Compare one table. `target` is null when the table does not exist on the target. */
export function compareTable(
  table: string | SeedTableSpec,
  seed: ReadonlyMap<string, string>,
  target: ReadonlyMap<string, TargetRow> | null,
  sample = PLAN_SAMPLE_IDS,
): DriftTable {
  const spec = typeof table === "string" ? assertSeedTable(table) : table;
  const seedHash = tableHash(seed.entries());
  const empty = { missing: [] as string[], changed: [] as string[], extra: [] as string[] };
  if (target === null) {
    const missing = [...seed.keys()].sort();
    return {
      table: spec.table, status: "missing_table", seed: { rows: seed.size, hash: seedHash }, target: null,
      sample: { ...empty, missing: missing.slice(0, sample) }, counts: { missing: missing.length, changed: 0, extra: 0 },
    };
  }
  const missing: string[] = [];
  const changed: string[] = [];
  const extra: string[] = [];
  const inScope: [string, string][] = [];
  let retained = 0;
  for (const [id, h] of seed) {
    const t = target.get(id);
    if (!t) missing.push(id);
    else if (t.hash !== h || (spec.onMissing === "retire" && t.retired)) changed.push(id);
  }
  for (const [id, t] of target) {
    if (seed.has(id)) {
      inScope.push([id, t.hash]);
      continue;
    }
    const kept = spec.mode === "append_only" || spec.onMissing === "keep" || (spec.onMissing === "retire" && t.retired === true);
    if (kept) retained++;
    else extra.push(id);
  }
  for (const id of extra) inScope.push([id, target.get(id)!.hash]);
  missing.sort();
  changed.sort();
  extra.sort();
  const differ = missing.length + changed.length + extra.length > 0;
  return {
    table: spec.table,
    status: differ ? "differ" : "equal",
    seed: { rows: seed.size, hash: seedHash },
    target: { rows: inScope.length, hash: tableHash(inScope), retained },
    sample: { missing: missing.slice(0, sample), changed: changed.slice(0, sample), extra: extra.slice(0, sample) },
    counts: { missing: missing.length, changed: changed.length, extra: extra.length },
  };
}

/** The whole result, tables in apply order; `ok` only when every table is equal and no needed migration is missing. */
export function driftResult(args: {
  commit: string;
  target: DriftResult["target"];
  checkedAt: Date;
  requiredMigrations: readonly string[];
  appliedMigrations: readonly string[];
  tables: readonly DriftTable[];
}): DriftResult {
  const order = new Map(SEED_TABLES.map((t, i) => [t.table, i]));
  for (const t of args.tables) assertSeedTable(t.table);
  const tables = [...args.tables].sort((a, b) => order.get(a.table)! - order.get(b.table)!);
  const applied = new Set(args.appliedMigrations);
  const missingMigrations = args.requiredMigrations.filter((v) => !applied.has(v));
  const sum = (k: "missing" | "changed" | "extra"): number => tables.reduce((n, t) => n + t.counts[k], 0);
  const differing = tables.filter((t) => t.status !== "equal").length;
  return driftResultSchema.parse({
    schema: DRIFT_SCHEMA,
    contract_version: SEED_CONTRACT_VERSION,
    commit: args.commit,
    target: args.target,
    checked_at: args.checkedAt.toISOString(),
    migrations: { required: [...args.requiredMigrations], applied: [...args.appliedMigrations].sort(), missing: missingMigrations },
    tables,
    totals: { tables: tables.length, differing, missing: sum("missing"), changed: sum("changed"), extra: sum("extra") },
    ok: differing === 0 && missingMigrations.length === 0,
  });
}

/** Exit codes of `db:verify`: 0 equal, 1 any difference (spec 2.3). */
export const driftExitCode = (r: DriftResult): number => (r.ok ? 0 : 1);

/** The one-line summary a rehearsal records (`verify` in seed-rehearsal/1). */
export const driftSummary = (r: DriftResult): { ok: boolean; tables: number; differing: number } => ({
  ok: r.ok,
  tables: r.totals.tables,
  differing: r.totals.differing,
});

/** The text `db:verify` prints: one line per table, then the verdict. */
export function formatDrift(r: DriftResult): string {
  const w = Math.max(5, ...r.tables.map((t) => t.table.length));
  const out = [`verify ${r.target.name} (${r.target.kind}) ${r.target.host} against ${r.commit}`];
  if (r.migrations.missing.length) out.push(`migrations missing: ${r.migrations.missing.join(", ")}`);
  for (const t of r.tables) {
    const tgt = t.target ? `${t.target.rows}${t.target.retained ? ` (+${t.target.retained} retained)` : ""}` : "no table";
    out.push(`${t.table.padEnd(w)}  ${t.status.padEnd(13)} seed ${t.seed.rows}  target ${tgt}  missing ${t.counts.missing}  changed ${t.counts.changed}  extra ${t.counts.extra}`);
  }
  out.push(r.ok ? "verify: equal" : `verify: ${r.totals.differing} table(s) differ`);
  return out.join("\n");
}
