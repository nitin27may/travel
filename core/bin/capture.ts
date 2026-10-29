#!/usr/bin/env node
// The capture contract CLI (research/method/capture-contract.md 5.2): what a record of a type must carry, where each mark comes
// from, the generated outputs and their drift check, the gaps of a trip, and the crawl-run record check.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROPERTY_BY_KEY } from "../src/schema/capture/properties.ts";
import { checkDrift, writeAll } from "../src/capture/generate.ts";
import { explain, resolveNode, suitMark } from "../src/capture/resolve.ts";
import type { Layer, ResolvedNode } from "../src/capture/resolve.ts";
import { completeness } from "../src/capture/engine.ts";
import { loadWorld } from "../src/capture/records.ts";
import { countsOf, loadTypes, resolveWord, treeOf } from "../src/capture/tree.ts";
import { TRIGGERS } from "../src/capture/triggers.ts";
import { validateFile } from "../src/validate/index.ts";
import { defaultPointRole, PLACEMENT_RULES } from "../src/capture/placementBlock.ts";

const USAGE = `Usage: node core/bin/capture.ts <command> [options]

Commands:
  fields --type <id> [--layer place|route|offer|event] [--format json]
                          the exact checklist for a type: R, R? (with its condition), A and N per group, the sources in order, the
                          honest-gap wording, and the link checklist. --kind <old name> and --kind K --subkind S resolve through the
                          aliases and the old kind/subkind pairs. --ref <ref> adds what is still missing on that record.
  explain <type>          where each mark comes from (the node or the ancestor that set it)
  types [--tree]          the counts of the tree (domains, categories, type ids); with --tree print it
  build [--check]         write the generated files (data/schema/capture/*, the applicability file, research/types/*);
                          --check exits 1 on drift. Runs in tools/check-all.sh.
  gaps --trip <trip> [--level usable|complete] [--json]
                          per record, the missing required properties; the brief of a research pass
  gaps --placement [--trip <trip>] [--json]
                          the placement block per trip (area, point with its role, nearest town), then the records and a hint
  gaps --tier required|enrichment [--layer <l>] [--type <prefix>] [--trip <trip>] [--json]
                          the per-kind matrix (EXECUTION-PLAN 6.4 columns) and each tier key asked, answered and missing
  gaps --budget --check | --write [--reason "<why>"]
                          data/capture/gap-budget.json: --check exits 1 when a gap count rose (runs in tools/check-all.sh);
                          --write lowers the counts, and raises one only with a written reason
  ledger-point --ref <ref> [--ref <ref> ...] --reason "<why>" [--write] | --check
                          the one exception to the migration ledger's point pin: replace a derived trailhead ("trailhead X at
                          <ref>") by the record's own OSM point in data/capture/points.json, logged in the ledger's \`replaced\`;
                          run it after storing the point and before relevance.ts points --build; --check verifies every entry
  migrate-placement [--write | --check] [--json]
                          fill area_id (locations store, Wikidata, parent; never a guess) and trailheads from held tracks; idempotent,
                          dry run by default, --check exits 1 while there is something to write
  derive-near [--write | --check] [--json]
                          write near_town and near_town_km on every place and route with an exact point, from the towns layer
                          (data/reference/towns, tools/towns.py); idempotent, never touches an override, dry run by default
  derive-area [--write | --check] [--trip <trip>] [--accuracy] [--json]
                          set area_id on places and routes from their parent, else from their sourced point against the areas of
                          the locations store (never an id the store lacks; data/capture/derived-areas.json records what it wrote);
                          idempotent, never touches an authored area_id, dry run by default, --check exits 1 while a record the
                          rule can place has none; --accuracy prints the hold-out test on the records that already have one
  place [--write]         apply data/capture/placement.json (facts and draw to the layer that causes them); runs once
  run --check <file>      validate a crawl run record (capture-run/1)
  codes                   list the E_CAP_*, W_CAP_*, E_PLACE_*, W_PLACE_* and W_TIER_* codes

Options:
  --root <dir>   repository root (default: two levels above this file)
`;

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};
const out = (s: string): void => void process.stdout.write(s + "\n");
const err = (s: string): void => void process.stderr.write(s + "\n");

function typeArg(argv: string[], root: string): string | null {
  const file = loadTypes(root);
  const tree = treeOf(file);
  const ref = arg(argv, "--ref");
  if (ref) return loadWorld(root).cap.get(ref)?.rec.type ?? null;
  const t = arg(argv, "--type");
  if (t) return tree.byId.has(t) ? t : resolveWord(tree, t);
  const kind = arg(argv, "--kind");
  if (kind) {
    const sub = arg(argv, "--subkind");
    if (sub) return tree.legacy.get(`${kind}/${sub}`) ?? null;
    return resolveWord(tree, kind) ?? [...tree.legacy.entries()].find(([k]) => k.startsWith(`${kind}/`))?.[1] ?? null;
  }
  return null;
}

interface FieldRow { key: string; mark: string; label: string; group: string; section: string; gap: string; trigger?: string; unit?: string; value: string }

/** The placement block a record of this type must leave with (capture contract 3.7), first in `fields`. */
export function placementBlock(node: ResolvedNode, layers: Layer[]): Record<string, unknown> {
  const per: Record<string, unknown> = {};
  for (const l of layers) {
    if (l === "offer" || l === "event") {
      per[l] = { inherits: l === "event" ? "at or part_of" : "at, on or starts_at", rule: "names the place or route it happens at; that record carries the block (E_PLACE_ORPHAN)", own_point: l === "offer" ? "only a meeting point the operator names (point_role meeting)" : "none" };
      continue;
    }
    per[l] = {
      area_id: "R. CC/REGION/area-slug, an id of the locations store's areas; country and region are read from it. From the locations store, then the trip, then the parent (part_of, at, starts_at) (E_PLACE_AREA)",
      point: { mark: "R", role: defaultPointRole(node.id, l), home: "data/capture/points.json by ref", fields: "lat, lon, coord_src (osm, wikidata, official, manual), point_source, point_role", sources: "D: OSM node or way, Wikidata P625; F: the land manager's page; manual last. Never Google (W_PLACE_POINT)" },
      approx: "true only for a centroid or a guess, with approx_note saying why (W_PLACE_APPROX); it counts for Where, never for distances",
      near_town: `computed (META-2): the nearest settlement of at least ${PLACEMENT_RULES.townMinPopulation} people within ${PLACEMENT_RULES.townRadiusKm} km, as a town id like ca-on-whitby, with near_town_km; override only when the operator names a town (W_PLACE_TOWN)`,
      far: `a point more than ${PLACEMENT_RULES.farKm} km outside its area is an error (E_PLACE_FAR); for a member of a protected area that covers its area, the park's point and its other members' exact points widen the area`,
    };
  }
  return { note: "Every record you add or touch leaves with this block (capture contract 3.7). New records error on a gap; records pinned in data/capture/gap-budget.json warn.", layers: per };
}

export function fieldsReport(node: ResolvedNode, layer: Layer | null): Record<string, unknown> {
  const layers = layer ? [layer] : node.records;
  const per: Record<string, unknown> = {};
  for (const l of layers) {
    const rl = node.layers[l];
    if (!rl) continue;
    const rows: FieldRow[] = Object.entries(rl.base).map(([key, mark]) => {
      const d = PROPERTY_BY_KEY.get(key)!;
      return { key, mark, label: d.label, group: d.group, section: d.section, gap: d.gap, value: d.value, ...(d.trigger && mark === "R?" ? { trigger: d.trigger } : {}), ...(d.unit ? { unit: d.unit } : {}) };
    });
    per[l] = { offer_class: rl.offer_class, carries_suitability: rl.carries_suitability, R: rows.filter((r) => r.mark === "R"), "R?": rows.filter((r) => r.mark === "R?"), A: rows.filter((r) => r.mark === "A") };
  }
  const suit = (m: "R" | "A" | "op"): FieldRow[] => Object.entries(node.suitability).filter(([, v]) => v === m).map(([key, mark]) => {
    const d = PROPERTY_BY_KEY.get(key)!;
    return { key, mark, label: d.label, group: d.group, section: d.section, gap: d.gap, value: d.value, ...(d.unit ? { unit: d.unit } : {}) };
  });
  return {
    placement: placementBlock(node, layers),
    type: node.id, label: node.label, records: node.records, profile: node.profile, operated: node.operated, extension: node.ext,
    effort_scales: node.effort.scales, relevance_class: node.relevance_class, sources_in_order: node.sources, slot3: node.display.slot3,
    links: node.links, layers: per, suitability: { R: suit("R"), "R when operated": suit("op"), A: suit("A") },
    note: "A property that is not listed is never asked, shown or counted (N). A gap says 'Not checked yet'; a searched_none says the gap wording of the property.",
  };
}

function printFields(rep: Record<string, unknown>): void {
  const r = rep as { type: string; label: string; records: string[]; profile: string | null; operated: string; extension: string | null; effort_scales: string[]; sources_in_order: string[]; slot3: string | null; links: { R: string[]; "R?": string[]; A: string[] }; layers: Record<string, { offer_class: string | null; carries_suitability: boolean; R: FieldRow[]; "R?": FieldRow[]; A: FieldRow[] }>; suitability: { R: FieldRow[]; "R when operated": FieldRow[]; A: FieldRow[] } };
  const pb = (rep as { placement: { layers: Record<string, Record<string, unknown>> } }).placement;
  out("Placement (every record)");
  for (const [l, b] of Object.entries(pb.layers)) {
    if ("inherits" in b) {
      out(`   ${l}: inherits through ${String(b.inherits)}; ${String(b.rule)}`);
      continue;
    }
    const pt = b.point as { role: string; sources: string };
    out(`   ${l}: area_id R · point R, role ${pt.role} (data/capture/points.json; ${pt.sources}) · approx only with a note · near_town computed, override only when the operator names a town`);
  }
  out("");
  out(`${r.type}  ${r.label}`);
  out(`records: ${r.records.join(", ")}; suitability profile: ${r.profile ?? "none"} (${r.operated}${r.extension ? `, extension ${r.extension}` : ""}); effort scales: ${r.effort_scales.join(", ") || "none"}; sources in order: ${r.sources_in_order.join(" ") || "none"}${r.slot3 ? `; slot 3: ${r.slot3}` : ""}`);
  const line = (rows: FieldRow[]): string => rows.map((x) => `${x.key}${x.trigger ? ` [${x.trigger}]` : ""}`).join(", ") || "-";
  for (const [l, v] of Object.entries(r.layers)) {
    out(`\n-- ${l}${v.offer_class ? ` (${v.offer_class})` : ""}`);
    out(`   R   ${line(v.R)}`);
    out(`   R?  ${line(v["R?"])}`);
    out(`   A   ${line(v.A)}`);
  }
  out("\n-- suitability block");
  out(`   R   ${line(r.suitability.R)}`);
  out(`   R when operated  ${line(r.suitability["R when operated"])}`);
  out(`   A   ${line(r.suitability.A)}`);
  out(`\nlinks: official; R? ${r.links["R?"].join(", ") || "-"}; A ${r.links.A.join(", ") || "-"}`);
}

function fields(argv: string[], root: string): number {
  const id = typeArg(argv, root);
  if (!id) {
    err("fields needs --type <id>, --kind <name> [--subkind <name>] or --ref <ref>. Try: node core/bin/capture.ts types --tree");
    return 2;
  }
  const node = resolveNode(id, loadTypes(root));
  if (!node) {
    err(`no type ${id}`);
    return 1;
  }
  const ref = arg(argv, "--ref");
  const rep = fieldsReport(node, (arg(argv, "--layer") as Layer | null) ?? (ref ? (loadWorld(root).cap.get(ref)?.rec.layer ?? null) : null));
  if (ref) {
    const c = completeness(loadWorld(root), ref);
    if (c) (rep as Record<string, unknown>).record = { ref, level: c.level, missing: [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing], missing_applicable: c.missingApplicable, condition_unknown: c.conditionUnknown, soft: c.soft };
  }
  if (arg(argv, "--format") === "json") out(JSON.stringify(rep, null, 2));
  else {
    printFields(rep);
    const r = (rep as { record?: { level: string; missing: string[]; missing_applicable: string[] } }).record;
    if (r) out(`\n-- ${ref}: ${r.level}\n   still missing (R): ${r.missing.join(", ") || "nothing"}\n   not yet answered (A): ${r.missing_applicable.join(", ") || "nothing"}`);
  }
  return 0;
}

function typesCmd(argv: string[], root: string): number {
  const file = loadTypes(root);
  const c = countsOf(file);
  out(`${c.domains} domains, ${c.categories} categories, ${c.ids} type ids (${c.types} types and ${c.subtypes} subtypes); ${c.nodes} nodes`);
  if (argv.includes("--tree")) for (const n of file.nodes) out(`${"  ".repeat(n.id.split(".").length - 1)}${n.id}  ${n.label}${n.records ? `  [${n.records.join(",")}]` : ""}`);
  return 0;
}

function build(argv: string[], root: string): number {
  const file = loadTypes(root);
  if (argv.includes("--check")) {
    const drift = checkDrift(root, file);
    for (const d of drift) out(`DRIFT ${d.reason}: ${d.path}`);
    out(drift.length === 0 ? "OK: the generated capture files match data/vocab/types.json" : `${drift.length} generated file(s) out of date; run: node core/bin/capture.ts build`);
    return drift.length === 0 ? 0 : 1;
  }
  const { written, removed } = writeAll(root, file);
  out(`wrote ${written.length} file(s), removed ${removed.length}`);
  for (const w of written) out(`  ${w}`);
  return 0;
}

function runCheck(argv: string[], root: string): number {
  const p = arg(argv, "--check");
  if (!p) {
    err("run needs --check <run.json>");
    return 2;
  }
  const res = validateFile(resolve(p), root);
  for (const e of res.errors) out(`ERROR ${e.code} ${relative(root, resolve(p))}#${e.path}: ${e.message}`);
  for (const w of res.warnings) out(`WARN ${w.code} ${relative(root, resolve(p))}#${w.path}: ${w.message}`);
  out(`${res.errors.length === 0 ? "OK" : "FAILED"}: ${res.errors.length} error(s), ${res.warnings.length} warning(s)`);
  return res.errors.length === 0 ? 0 : 1;
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("--help")) {
    out(USAGE.trimEnd());
    return 0;
  }
  const root = resolve(arg(argv, "--root") ?? fileURLToPath(new URL("../..", import.meta.url)));
  switch (argv[0]) {
    case "fields": return fields(argv, root);
    case "explain": {
      const id = argv[1] && !argv[1].startsWith("--") ? argv[1] : null;
      const file = loadTypes(root);
      const tree = treeOf(file);
      const resolved = id ? (tree.byId.has(id) ? id : resolveWord(tree, id)) : null;
      const node = resolved ? resolveNode(resolved, file) : null;
      if (!node) {
        err(`explain needs a type id, for example: explain air.zip.zipline.kids_course`);
        return 2;
      }
      for (const l of explain(node)) out(l);
      return 0;
    }
    case "types": return typesCmd(argv, root);
    case "build": return build(argv, root);
    case "gaps": {
      const { gapsCommand } = await import("../src/capture/gapsCli.ts");
      return gapsCommand(argv, root, out, err);
    }
    case "migrate": {
      const { migrateCommand } = await import("../src/capture/migrateCli.ts");
      return migrateCommand(argv, root, out, err);
    }
    case "ledger-point": {
      const { ledgerPointCommand } = await import("../src/capture/ledgerPoints.ts");
      return ledgerPointCommand(argv, root, out, err);
    }
    case "migrate-placement": {
      const { migratePlacementCommand } = await import("../src/capture/migratePlacementCli.ts");
      return migratePlacementCommand(argv, root, out, err);
    }
    case "derive-area": {
      const { deriveAreaCommand } = await import("../src/capture/deriveAreaCli.ts");
      return deriveAreaCommand(argv, root, out, err);
    }
    case "derive-near": {
      const { deriveNearCommand } = await import("../src/capture/deriveNearCli.ts");
      return deriveNearCommand(argv, root, out, err);
    }
    case "place": {
      const { placeCommand } = await import("../src/capture/placementCli.ts");
      return placeCommand(argv, root, out, err);
    }
    case "run": return runCheck(argv, root);
    case "codes": {
      const { CAP_ERROR_LIST, CAP_WARNING_LIST, CAP_ERROR_CODES, CAP_WARNING_CODES } = await import("../src/validate/codes.ts");
      for (const c of CAP_ERROR_LIST) out(`${c}\t${CAP_ERROR_CODES[c]}`);
      for (const c of CAP_WARNING_LIST) out(`${c}\t${CAP_WARNING_CODES[c]}`);
      const { PLACE_ERROR_LIST, PLACE_WARNING_LIST, PLACE_ERROR_CODES, PLACE_WARNING_CODES } = await import("../src/validate/codes.ts");
      for (const c of PLACE_ERROR_LIST) out(`${c}\t${PLACE_ERROR_CODES[c]}`);
      for (const c of PLACE_WARNING_LIST) out(`${c}\t${PLACE_WARNING_CODES[c]}`);
      const { PARK_ERROR_LIST, PARK_WARNING_LIST, PARK_ERROR_CODES, PARK_WARNING_CODES } = await import("../src/validate/codes.ts");
      for (const c of PARK_ERROR_LIST) out(`${c}\t${PARK_ERROR_CODES[c]}`);
      for (const c of PARK_WARNING_LIST) out(`${c}\t${PARK_WARNING_CODES[c]}`);
      return 0;
    }
    default:
      err(`Unknown command ${argv[0]}.\n${USAGE}`);
      return 2;
  }
}

void existsSync; void readFileSync; void dirname; void join; void TRIGGERS; void suitMark;
// exitCode, not exit(): a large --json report piped to another process must be flushed before node ends
main(process.argv.slice(2)).then((c) => void (process.exitCode = c), (e) => {
  err(String(e instanceof Error ? e.stack ?? e.message : e));
  process.exit(1);
});
