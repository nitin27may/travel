// `capture.ts migrate`: the one-time migration of step 4. Dry run by default; --write applies it. It refuses to run twice.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planMigration } from "./migrate.ts";
import { captureFiles } from "./records.ts";

export function migrateCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  if (captureFiles(root).length > 0 || existsSync(join(root, "data", "capture", "migration-ledger.json"))) {
    err("already migrated: data/capture/<trip>/ holds capture sidecars. The migration runs once; later changes are edits to the capture sidecars, with `capture.ts build` and the validator.");
    return 1;
  }
  const plan = planMigration(root);
  for (const p of plan.problems) err(`PROBLEM ${p}`);
  const r = plan.report;
  out(JSON.stringify(r, null, 2));
  if (plan.problems.length > 0) return 1;
  if (!argv.includes("--write")) {
    out(`dry run: ${plan.writes.length} file(s) would be written; add --write`);
    return 0;
  }
  for (const w of plan.writes) {
    mkdirSync(dirname(w.path), { recursive: true });
    writeFileSync(w.path, w.text);
  }
  out(`wrote ${plan.writes.length} file(s)`);
  return 0;
}
