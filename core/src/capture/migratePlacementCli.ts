// `capture.ts migrate-placement [--write | --check] [--json]`: see migratePlacement.ts. Dry run by default.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { planPlacementMigration } from "./migratePlacement.ts";

export function migratePlacementCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const plan = planPlacementMigration(root);
  for (const p of plan.problems) err(`PROBLEM ${p}`);
  if (plan.problems.length > 0) return 1;
  if (argv.includes("--json")) out(JSON.stringify({ report: plan.report, gaps: plan.gaps, areas: plan.areas.map((a) => ({ ...a, file: relative(root, a.file) })), trailheads: plan.trailheads }, null, 2));
  else {
    out(JSON.stringify(plan.report, null, 2));
    for (const g of plan.gaps.filter((x) => x.why === "parents_disagree")) out(`AMBIGUOUS ${g.ref}: its parents sit in different areas, so no area_id was chosen`);
  }
  const todo = plan.writes.length;
  if (argv.includes("--check")) {
    out(todo === 0 ? "OK: nothing left to migrate that held data can answer" : `${todo} file(s) would change; run: node core/bin/capture.ts migrate-placement --write`);
    return todo === 0 ? 0 : 1;
  }
  if (!argv.includes("--write")) {
    out(`dry run: ${todo} file(s) would be written; add --write`);
    return 0;
  }
  for (const w of plan.writes) {
    mkdirSync(dirname(w.path), { recursive: true });
    writeFileSync(w.path, w.text);
  }
  out(`wrote ${todo} file(s)`);
  return 0;
}
