// `capture.ts gaps --trip <trip> [--level usable|complete]`: per record, the properties the contract requires that no value answers.
// It is the brief of a research pass (capture contract 10.5): the pass starts where this list stops.
import { completeness } from "./engine.ts";
import type { Completeness } from "./engine.ts";
import { loadWorld } from "./records.ts";

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};

export function gapsReport(root: string, trip: string, level: "usable" | "complete"): { rows: Completeness[]; byLevel: Record<string, number> } {
  const w = loadWorld(root);
  const rows: Completeness[] = [];
  for (const ref of w.trips.get(trip) ?? []) {
    const c = completeness(w, ref);
    if (c) rows.push(c);
  }
  const byLevel: Record<string, number> = {};
  for (const c of rows) byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
  const need = (c: Completeness): string[] => (level === "usable" ? [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing] : [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing, ...c.missingApplicable]);
  return { rows: rows.filter((c) => need(c).length > 0), byLevel };
}

export function gapsCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const trip = arg(argv, "--trip");
  if (!trip) {
    err("gaps needs --trip <trip>, for example: gaps --trip dolomites-2027");
    return 2;
  }
  const level = (arg(argv, "--level") ?? "usable") as "usable" | "complete";
  const { rows, byLevel } = gapsReport(root, trip, level);
  if (argv.includes("--json")) {
    out(JSON.stringify(rows.map((c) => ({ ref: c.ref, type: c.type, layer: c.layer, level: c.level, missing: [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing], ...(level === "complete" ? { missing_applicable: c.missingApplicable } : {}), unknown_condition: c.conditionUnknown })), null, 2));
    return 0;
  }
  for (const c of rows) {
    const miss = [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing];
    out(`${c.ref}\t${c.type}\t${c.layer}\t${c.level}\tmissing ${miss.length}: ${miss.slice(0, 8).join(", ")}${miss.length > 8 ? `, +${miss.length - 8} more` : ""}`);
  }
  out(`${rows.length} record(s) of ${Object.values(byLevel).reduce((a, b) => a + b, 0)} below ${level} in ${trip}; by level: ${Object.entries(byLevel).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  return 0;
}
