// The contract kit's runner, shared by core/test/catalogue/contract.test.ts (stores) and web/tests/api/*.test.ts (JsonStore on the real
// data, and the route handlers): every case table against every target. A pending or not-applicable case is an `it.todo` that names why,
// so the count is visible and nothing is skipped silently.
import { describe, it } from "vitest";
import { CONTRACT_TABLES, type ContractCase, type ContractTarget } from "./index.ts";

/** Why a case does not run on a target, or null when it runs. */
function notRun(t: ContractTarget, c: ContractCase, handlerLayer: boolean): string | null {
  if (c.layer === "handler" && !handlerLayer) return "runs through respond() in web/tests/api/contract.test.ts";
  return t.pending?.["*"] ?? t.pending?.[`${c.method}:${c.id}`] ?? t.pending?.[c.id] ?? t.notApplicable?.[c.id] ?? null;
}

export interface RunOptions {
  /** True where `handler`-layer cases (K18, K19 through respond()) can run. */
  handlerLayer?: boolean;
  /** The `describe` title; default `contract on <target>`. */
  title?: (t: ContractTarget) => string;
}

/** Registers a describe block per target; returns the counts so a caller can assert the todo list stays what the sheet says. */
export function runContractTargets(targets: readonly ContractTarget[], opts: RunOptions = {}): { name: string; run: number; todo: { id: string; why: string }[] }[] {
  const tally: { name: string; run: number; todo: { id: string; why: string }[] }[] = [];
  for (const t of targets) {
    const row = { name: t.name, run: 0, todo: [] as { id: string; why: string }[] };
    tally.push(row);
    describe(opts.title?.(t) ?? `contract on ${t.name}`, () => {
      for (const [table, cases] of Object.entries(CONTRACT_TABLES)) {
        describe(table, () => {
          for (const c of cases) {
            const why = notRun(t, c, opts.handlerLayer ?? false);
            if (why) {
              row.todo.push({ id: `${c.method}:${c.id}`, why });
              it.todo(`${c.id} ${c.title} [not run: ${why}]`);
            } else {
              row.run++;
              it(`${c.id} ${c.title}`, async () => c.run(await t.make(), t), 120_000);
            }
          }
        });
      }
    });
  }
  return tally;
}
