// The plan of a sync: per table, what changes and why (spec 6.3, 6.4). Pure. The engine builds the seed's `id -> content hash` map
// and reads the target's, then calls planTable for each seed table in apply order; `db:sync --dry-run` prints formatPlan and exits
// with planExitCode. The same classification is the idempotency rule: a second sync of the same commit plans 0 writes.
import { z } from "zod";
import { PLAN_SAMPLE_IDS } from "../config/database.ts";
import { targetFactsSchema } from "./guard.ts";
import { SEED_CONTRACT_VERSION, SEED_TABLES, SeedContractError, assertSeedTable, type SeedTableSpec } from "./contract.ts";

/**
 * insert     in the seed, not in the target
 * update     in both, content hash differs (or the target row is retired and the seed has it again)
 * retire     not in the seed, live in the target, table retires (the row and every reference to it stay)
 * delete     not in the seed, in the target, table deletes
 * unchanged  in both, same content hash
 * retained   not in the seed, in the target, and left alone: a kept table, append-only history, or a row already retired
 */
export const CHANGE_KINDS = ["insert", "update", "retire", "delete", "unchanged", "retained"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
/** The kinds that write a row. */
export const WRITE_KINDS: readonly ChangeKind[] = ["insert", "update", "retire", "delete"];

/** What the engine knows of a target row: its content hash (./hash.ts, same columns as the seed) and, on a retiring table, whether it is retired. */
export interface TargetRow {
  hash: string;
  retired?: boolean;
}

/** The classification of one record id. Throws on an append-only row whose content changed under the same key. */
export function classifyRow(spec: SeedTableSpec, seedHash: string | undefined, target: TargetRow | undefined): ChangeKind {
  if (seedHash !== undefined && target === undefined) return "insert";
  if (seedHash !== undefined && target !== undefined) {
    if (spec.mode === "append_only") {
      if (seedHash !== target.hash) {
        throw new SeedContractError("E_SEED_APPEND_ONLY", `${spec.table}: an append-only row changed under the same key; a new reading is a new row`);
      }
      return "unchanged";
    }
    if (target.retired) return "update";
    return seedHash === target.hash ? "unchanged" : "update";
  }
  if (target !== undefined) {
    if (spec.mode === "append_only" || spec.onMissing === "keep") return "retained";
    if (spec.onMissing === "retire") return target.retired ? "retained" : "retire";
    return "delete";
  }
  throw new SeedContractError("E_SEED_PLAN", `${spec.table}: a record id with no seed row and no target row`);
}

export const tablePlanSchema = z.strictObject({
  table: z.string(),
  counts: z.strictObject(Object.fromEntries(CHANGE_KINDS.map((k) => [k, z.number().int().nonnegative()])) as Record<ChangeKind, z.ZodNumber>),
  /** up to PLAN_SAMPLE_IDS record ids per write kind, sorted */
  ids: z.strictObject({ insert: z.array(z.string()), update: z.array(z.string()), retire: z.array(z.string()), delete: z.array(z.string()) }),
});
export type TablePlan = z.infer<typeof tablePlanSchema>;

export const seedPlanSchema = z.strictObject({
  schema: z.literal("seed-plan/1"),
  contract_version: z.number().int().positive(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  /** the target as the guard printed it: name, kind and host only, never a URL, user or password */
  target: targetFactsSchema,
  tables: z.array(tablePlanSchema),
  totals: tablePlanSchema.shape.counts,
});
export type SeedPlan = z.infer<typeof seedPlanSchema>;

const emptyCounts = (): Record<ChangeKind, number> => ({ insert: 0, update: 0, retire: 0, delete: 0, unchanged: 0, retained: 0 });

/** The plan of one table from the seed's and the target's `record id -> hash` maps. */
export function planTable(
  table: string | SeedTableSpec,
  seed: ReadonlyMap<string, string>,
  target: ReadonlyMap<string, TargetRow>,
  sample = PLAN_SAMPLE_IDS,
): TablePlan {
  const spec = typeof table === "string" ? assertSeedTable(table) : table;
  const counts = emptyCounts();
  const ids: Record<"insert" | "update" | "retire" | "delete", string[]> = { insert: [], update: [], retire: [], delete: [] };
  const all = new Set<string>([...seed.keys(), ...target.keys()]);
  for (const id of [...all].sort()) {
    const kind = classifyRow(spec, seed.get(id), target.get(id));
    counts[kind]++;
    if (kind !== "unchanged" && kind !== "retained" && ids[kind].length < sample) ids[kind].push(id);
  }
  return { table: spec.table, counts, ids };
}

/** The whole plan, tables in apply order. Every table must be a seed table; an unknown one throws before anything is planned. */
export function seedPlan(commit: string, target: SeedPlan["target"], tables: readonly TablePlan[]): SeedPlan {
  const order = new Map(SEED_TABLES.map((t, i) => [t.table, i]));
  for (const t of tables) assertSeedTable(t.table);
  const sorted = [...tables].sort((a, b) => order.get(a.table)! - order.get(b.table)!);
  const totals = emptyCounts();
  for (const t of sorted) for (const k of CHANGE_KINDS) totals[k] += t.counts[k];
  return seedPlanSchema.parse({ schema: "seed-plan/1", contract_version: SEED_CONTRACT_VERSION, commit, target, tables: sorted, totals });
}

/** Rows a plan writes. 0 for a second sync of the same commit (the idempotency rule). */
export const planWrites = (plan: Pick<SeedPlan, "totals">): number => WRITE_KINDS.reduce((n, k) => n + plan.totals[k], 0);

/** Exit codes of `db:sync --dry-run` (spec 6.4): 0 no difference, 3 a difference; 1 is an error, raised by the caller. */
export const PLAN_EXIT = { same: 0, error: 1, differs: 3 } as const;
export const planExitCode = (plan: SeedPlan): number => (planWrites(plan) === 0 ? PLAN_EXIT.same : PLAN_EXIT.differs);

/**
 * The dry-run text (spec 6.4): one line per table `table  +inserts  ~updates  -retires  xdeletes  =unchanged` (retained rows are
 * counted in `=` and named in brackets), then up to PLAN_SAMPLE_IDS record ids per change kind, then the totals and the commit.
 */
export function formatPlan(plan: SeedPlan): string {
  const w = Math.max(5, ...plan.tables.map((t) => t.table.length));
  const line = (name: string, c: Record<ChangeKind, number>): string =>
    `${name.padEnd(w)}  +${c.insert}  ~${c.update}  -${c.retire}  x${c.delete}  =${c.unchanged + c.retained}` +
    (c.retained ? ` (${c.retained} retained)` : "");
  const out: string[] = [`target ${plan.target.name} (${plan.target.kind}) ${plan.target.host}`];
  for (const t of plan.tables) {
    out.push(line(t.table, t.counts));
    for (const k of ["insert", "update", "retire", "delete"] as const) {
      if (t.ids[k].length) out.push(`  ${k}: ${t.ids[k].join(", ")}${t.counts[k] > t.ids[k].length ? ` (+${t.counts[k] - t.ids[k].length} more)` : ""}`);
    }
  }
  out.push(line("total", plan.totals));
  out.push(`commit ${plan.commit}; ${planWrites(plan)} row(s) would be written; contract v${plan.contract_version}`);
  return out.join("\n");
}
