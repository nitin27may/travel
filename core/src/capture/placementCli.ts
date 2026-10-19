import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PLACEMENT_PATH, planPlacement } from "./placement.ts";
import type { PlacementFile } from "./placement.ts";
import { readJson } from "./records.ts";
import { join } from "node:path";

export function placeCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  if (readJson<PlacementFile>(join(root, PLACEMENT_PATH))?.applied) {
    err("already applied: data/capture/placement.json has applied: true.");
    return 1;
  }
  const plan = planPlacement(root);
  for (const p of plan.problems) err(`PROBLEM ${p}`);
  out(JSON.stringify(plan.report, null, 2));
  if (plan.problems.length > 0) return 1;
  if (!argv.includes("--write")) return 0;
  for (const w of plan.writes) {
    mkdirSync(dirname(w.path), { recursive: true });
    writeFileSync(w.path, w.text);
  }
  out(`wrote ${plan.writes.length} file(s)`);
  return 0;
}
