// `capture.ts derive-near [--write | --check] [--json]`: see deriveNear.ts. Dry run by default; --check exits 1 while there is something to write.
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { planNearDerivation } from "./deriveNear.ts";

export function deriveNearCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const plan = planNearDerivation(root);
  for (const p of plan.problems) err(`PROBLEM ${p}`);
  if (plan.problems.length > 0) return 1;
  if (argv.includes("--json")) out(JSON.stringify({ report: plan.report, assignments: plan.assignments.map((a) => ({ ...a, file: relative(root, a.file) })) }, null, 2));
  else out(JSON.stringify(plan.report, null, 2));
  const todo = plan.writes.length;
  if (argv.includes("--check")) {
    out(todo === 0 ? "OK: every exact point has its nearest town" : `${todo} file(s) would change; run: node core/bin/capture.ts derive-near --write`);
    return todo === 0 ? 0 : 1;
  }
  if (!argv.includes("--write")) {
    out(`dry run: ${todo} file(s) would be written; add --write`);
    return 0;
  }
  for (const w of plan.writes) writeFileSync(w.path, w.text);
  out(`wrote ${todo} file(s)`);
  return 0;
}
