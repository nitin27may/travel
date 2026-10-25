// The normaliser's budget: what the repository's files still need, pinned so the counts may only fall (RIS-N; the same idea as
// data/capture/gap-budget.json and core/test/schema/keep-budget.json). `check-all` runs `normalise.ts --budget --check`: a count that
// rises fails; RIS-J brings every count to zero with `--write`, after which the stage switches to a plain `--check`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { NormaliseReport } from "./types.ts";

export const BUDGET_PATH = "core/test/normalise/normalise-budget.json";

export interface Budget {
  schema: "normalise-budget/1";
  note: string;
  /** changes the run would make, by `<family>.<rule>` */
  changes: Record<string, number>;
  /** warnings and errors found, by code (information findings are not budgeted) */
  findings: Record<string, number>;
}

const NOTE = "What `node core/bin/normalise.ts --check` finds on the repository's files, pinned so the counts only fall (RIS-N). RIS-J runs `--write` and lowers these to the unavoidable findings; a rise needs a reason in the change that raises it. Update with `node core/bin/normalise.ts --budget --update` (it refuses to raise a count).";

/** The counts of a report in budget form. */
export function budgetOf(report: NormaliseReport): Budget {
  const changes: Record<string, number> = {};
  const findings: Record<string, number> = {};
  for (const [fam, s] of Object.entries(report.families)) for (const [rule, n] of Object.entries(s.changes)) if (n) changes[`${fam}.${rule}`] = n;
  for (const f of report.files.flatMap((r) => r.findings)) if (f.level !== "info") findings[f.code] = (findings[f.code] ?? 0) + 1;
  const sort = (o: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return { schema: "normalise-budget/1", note: NOTE, changes: sort(changes), findings: sort(findings) };
}

export function readBudget(root: string): Budget | null {
  const p = `${root}/${BUDGET_PATH}`;
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Budget) : null;
}

/** The counts that rose above the pinned budget (a key the budget does not hold counts from zero). Empty when the budget holds. */
export function budgetRises(now: Budget, pinned: Budget): string[] {
  const out: string[] = [];
  for (const part of ["changes", "findings"] as const) {
    for (const [k, n] of Object.entries(now[part])) if (n > (pinned[part][k] ?? 0)) out.push(`${part}.${k}: ${n} now, budget ${pinned[part][k] ?? 0}`);
  }
  return out;
}

/** The budget file text with every count lowered to `now` (or created); throws when a count rose. */
export function updatedBudget(now: Budget, pinned: Budget | null): string {
  if (pinned) {
    const rises = budgetRises(now, pinned);
    if (rises.length > 0) throw new Error(`a count rose; fix the data or justify it in the change:\n  ${rises.join("\n  ")}`);
  }
  return JSON.stringify(now, null, 2) + "\n";
}

export function writeBudget(root: string, text: string): void {
  writeFileSync(`${root}/${BUDGET_PATH}`, text);
}
