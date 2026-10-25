// `capture.ts derive-area [--check | --write] [--trip <id>] [--json] [--accuracy]`: see deriveArea.ts. Dry run by default; --check exits 1
// while a record the rule can place has no area_id (or a derived one is stale); --write applies it. --accuracy prints the hold-out test on
// the records that already have an authored area_id, and --write refuses to run when its precision is under AREA_DERIVATION.minPrecision.
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { AREA_DERIVATION } from "../config/area.ts";
import { holdOutAccuracy, loadAreaInput, planAreaDerivation } from "./deriveArea.ts";
import type { Accuracy } from "./deriveArea.ts";

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const line = (a: Accuracy): string => `hold-out (${a.mode === "one" ? "each record alone" : "each record with its family"}): ${a.known} known, ${a.answered} answered, ${a.matched} match; precision ${pct(a.precision)}, coverage ${pct(a.coverage)}; abstained ${JSON.stringify(a.abstained)}`;

export function deriveAreaCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const trip = arg(argv, "--trip");
  const plan = planAreaDerivation(root, { trip });
  for (const p of plan.problems) err(`PROBLEM ${p}`);
  if (plan.problems.length > 0) return 1;
  const { input } = loadAreaInput(root);
  const acc = [holdOutAccuracy(input, "one"), holdOutAccuracy(input, "family")];
  const gate = acc[1]!;
  const rel = (f: string): string => relative(root, f);
  if (argv.includes("--json")) {
    out(JSON.stringify({ per_trip: plan.perTrip, changes: plan.changes.map((c) => ({ ...c, file: rel(c.file) })), unresolved: plan.unresolved, proposals: plan.proposals, accuracy: acc }, null, 2));
  } else {
    out("per trip (place and route records):");
    for (const [t, r] of Object.entries(plan.perTrip).sort()) if (!trip || t === trip) out(`  ${t}: ${r.place_route} records, ${r.had_area} authored, ${r.derived_parent} from a parent, ${r.derived_point} from the point, ${r.unresolved} unresolved ${JSON.stringify(r.unresolved_by_reason)}`);
    if (argv.includes("--accuracy") || argv.includes("--write")) for (const a of acc) {
      out(line(a));
      for (const c of a.confusion) out(`    ${c.ref}: known ${c.known}, derived ${c.derived} (${c.via}${c.from ? ` from ${c.from}` : ""})`);
    }
    if (plan.proposals.length > 0) {
      out("no registry area reaches these points (a new area is an owner decision, then the location skill):");
      for (const p of plan.proposals) out(`  ${p.region}: ${p.refs.length} record(s); nearest towns ${p.towns.join(", ") || "none"}`);
    }
    for (const c of plan.changes) out(`  ${c.from ? `${c.from} -> ` : ""}${c.to ?? "(removed)"}  ${c.ref}  (${c.via ?? "no longer derivable"}${c.source ? ` from ${c.source}` : ""})`);
  }
  const todo = plan.writes.length;
  if (argv.includes("--check")) {
    out(todo === 0 ? "OK: every place and route the rule can place has its area_id" : `${plan.changes.length} area_id change(s) in ${todo} file(s); run: node core/bin/capture.ts derive-area --write`);
    return todo === 0 ? 0 : 1;
  }
  if (!argv.includes("--write")) {
    out(`dry run: ${plan.changes.length} area_id change(s), ${todo} file(s) would be written; add --write`);
    return 0;
  }
  if (gate.precision < AREA_DERIVATION.minPrecision) {
    err(`REFUSED: the hold-out precision ${pct(gate.precision)} is under ${pct(AREA_DERIVATION.minPrecision)} (core/src/config/area.ts); nothing written`);
    return 1;
  }
  for (const w of plan.writes) writeFileSync(w.path, w.text);
  out(`wrote ${plan.changes.length} area_id change(s) in ${todo} file(s)`);
  return 0;
}
