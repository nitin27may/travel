// `capture.ts gaps`: what the contract asks that no value answers.
//   gaps --trip <trip> [--level usable|complete] [--json]     per record, the missing required properties; the brief of a research pass (10.5)
//   gaps --placement [--trip <trip>] [--json]                  the placement block per trip, then the records (nearby spec 3.3, contract 3.7)
//   gaps --tier required|enrichment [--layer <l>] [--type <prefix>] [--trip <trip>] [--json]
//                                                              the per-kind matrix of EXECUTION-PLAN 6.4 and each tier key asked, answered, missing
//   gaps --budget --check | --write [--reason "<why>"] [--json]
//                                                              the gap budget (data/capture/gap-budget.json): counts may only fall
//   gaps --family <f> [--tier required|enrichment] [--trip <trip>] [--json]
//                                                              the tier report of one research family (location-type-requirements 6.3)
//   gaps --promote <key> --family <f> [--mark R|R?] [--json]   the ratchet gate (5.4): exits 1 when the promotion adds an unanswered key
import { completeness } from "./engine.ts";
import type { Completeness } from "./engine.ts";
import { BUDGET_CODES, checkBudget, GAP_BUDGET_PATH, loadBudget, TIER_KEYS_COUNT, writeBudget } from "./gapBudget.ts";
import { loadPlacement, PLACEMENT_CODES, placementRow } from "./placementBlock.ts";
import type { PlacementRow, PlacementWorld } from "./placementBlock.ts";
import { loadWorld } from "./records.ts";
import type { World } from "./records.ts";
import { kindTiers, MATRIX_COLUMNS, MATRIX_ROWS, matrixCells, recordTier } from "./tiers.ts";
import type { MatrixColumn, RecordTier } from "./tiers.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import { CAP_FAMILY } from "../schema/capture/typesFile.ts";
import { promotion, PromoteError } from "./promote.ts";
import type { Promotion, PromoteMark } from "./promote.ts";
import { categoriesOfFamily, familyOf, loadTypes, treeOf } from "./tree.ts";

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

/** Every capture record once (its first trip), optionally one trip's. */
function records(w: World, trip: string | null): { rec: CaptureRecord; trip: string }[] {
  const out: { rec: CaptureRecord; trip: string }[] = [];
  for (const { rec, trip: t } of w.cap.values()) if (!trip || t === trip) out.push({ rec, trip: t });
  return out.sort((a, b) => a.trip.localeCompare(b.trip) || a.rec.ref.localeCompare(b.rec.ref));
}

// ------------------------------------------------------------------------------------------------------------------ placement
export interface PlacementSummary { trip: string; records: number; no_area: number; no_point: number; approximate: number; no_town: number; outside_area: number; orphans: number }

export function placementReport(root: string, trip: string | null, pw?: PlacementWorld): { summaries: PlacementSummary[]; rows: PlacementRow[] } {
  const p = pw ?? loadPlacement(root, loadWorld(root));
  const rows = records(p.world, trip).map(({ rec, trip: t }) => placementRow(p, rec, t));
  const trips = [...new Set(rows.map((r) => r.trip))];
  const has = (r: PlacementRow, code: string): boolean => r.findings.some((f) => f.code === code);
  const summaries = trips.map((t) => {
    const rs = rows.filter((r) => r.trip === t);
    return {
      trip: t,
      records: rs.length,
      no_area: rs.filter((r) => has(r, "E_PLACE_AREA")).length,
      no_point: rs.filter((r) => has(r, "W_PLACE_POINT")).length,
      approximate: rs.filter((r) => r.point?.approx).length,
      no_town: rs.filter((r) => has(r, "W_PLACE_TOWN")).length,
      outside_area: rs.filter((r) => has(r, "E_PLACE_FAR")).length,
      orphans: rs.filter((r) => has(r, "E_PLACE_ORPHAN")).length,
    };
  });
  return { summaries, rows };
}

const WORDS: Record<string, string> = { E_PLACE_AREA: "no area", E_PLACE_ORPHAN: "says nowhere", W_PLACE_POINT: "no point", W_PLACE_APPROX: "approx, no note", E_PLACE_FAR: "outside its area", W_PLACE_TOWN: "no nearest town" };

function printPlacement(rep: ReturnType<typeof placementReport>, out: (s: string) => void): void {
  for (const s of rep.summaries) {
    out(`Placement gaps: ${s.trip}`);
    out(`records ${s.records} · no area ${s.no_area} · no point ${s.no_point} · approximate ${s.approximate} · no nearest town ${s.no_town} · outside its area ${s.outside_area} · offers saying nowhere ${s.orphans}`);
    for (const r of rep.rows.filter((x) => x.trip === s.trip && x.findings.some((f) => f.code !== "W_PLACE_TOWN"))) {
      for (const f of r.findings.filter((x) => x.code !== "W_PLACE_TOWN")) {
        out(`  ${r.ref.padEnd(60)} ${WORDS[f.code]!.padEnd(16)} role ${r.role.padEnd(11)}${f.hint ? ` hint: ${f.hint}` : ""}`);
      }
    }
    out("");
  }
  const t = (k: keyof PlacementSummary): number => rep.summaries.reduce((a, s) => a + (s[k] as number), 0);
  out(`all: records ${t("records")} · no area ${t("no_area")} · no point ${t("no_point")} · approximate ${t("approximate")} · no nearest town ${t("no_town")} (derived by META-2) · outside its area ${t("outside_area")} · offers saying nowhere ${t("orphans")}`);
}

// ------------------------------------------------------------------------------------------------------------------ tiers
export interface TierReport {
  tier: "required" | "enrichment";
  filter: { layer: string | null; type: string | null; trip: string | null; family: string | null };
  /** the categories of the family filter, empty without one */
  categories: string[];
  /** EXECUTION-PLAN 6.4: per layer (trails split out), how many records answer each column */
  matrix: { row: string; cells: Record<MatrixColumn, number> }[];
  kinds: ReturnType<typeof kindTiers>;
  records: { ref: string; type: string; kind: string; missing: string[] }[];
}

export function tierReport(root: string, tier: "required" | "enrichment", filter: { layer?: string | null; type?: string | null; trip?: string | null; family?: string | null } = {}, pw?: PlacementWorld): TierReport {
  const p = pw ?? loadPlacement(root, loadWorld(root));
  const types = loadTypes(root);
  const tree = treeOf(types);
  const recs = records(p.world, filter.trip ?? null).map((x) => x.rec).filter((r) => (!filter.layer || r.layer === filter.layer) && (!filter.type || r.type === filter.type || r.type.startsWith(`${filter.type}.`)) && (!filter.family || familyOf(tree, r.type) === filter.family));
  const matrix = MATRIX_ROWS.map((row) => {
    const rs = recs.filter((r) => (row === "route:trails" ? r.layer === "route" && /^nature\.trail(\.|$)/.test(r.type) : r.layer === row));
    const cells = Object.fromEntries(MATRIX_COLUMNS.map((c) => [c, 0])) as Record<MatrixColumn, number>;
    for (const r of rs) {
      const m = matrixCells(p, r);
      for (const c of MATRIX_COLUMNS) if (m[c]) cells[c] += 1;
    }
    return { row, cells };
  }).filter((x) => x.cells.records > 0);
  const tiers = recs.map((r) => recordTier(p.world, r.ref)).filter((t): t is RecordTier => t !== null);
  return {
    tier,
    filter: { layer: filter.layer ?? null, type: filter.type ?? null, trip: filter.trip ?? null, family: filter.family ?? null },
    categories: filter.family ? categoriesOfFamily(types, filter.family) : [],
    matrix,
    kinds: kindTiers(tiers, tier),
    records: tiers.map((t) => ({ ref: t.ref, type: t.type, kind: t.kind, missing: tier === "required" ? t.requiredMissing : t.enrichmentMissing })).filter((x) => x.missing.length > 0),
  };
}

function printTier(rep: TierReport, out: (s: string) => void): void {
  const f = rep.filter;
  out(`Tier: ${rep.tier}${f.family ? ` · family ${f.family} (${rep.categories.join(", ")})` : ""}${f.layer ? ` · layer ${f.layer}` : ""}${f.type ? ` · type ${f.type}` : ""}${f.trip ? ` · trip ${f.trip}` : ""}`);
  out("");
  out(`Per layer (EXECUTION-PLAN 6.4 columns; records answering each)`);
  out(["layer".padEnd(13), ...MATRIX_COLUMNS.map((c) => c.padStart(Math.max(c.length, 4)))].join(" "));
  for (const m of rep.matrix) out([m.row.padEnd(13), ...MATRIX_COLUMNS.map((c) => String(m.cells[c]).padStart(Math.max(c.length, 4)))].join(" "));
  for (const k of rep.kinds) {
    out("");
    out(`${k.kind.replace("_", " ")}: ${k.records} record(s), ${k.complete} with the ${rep.tier} tier complete`);
    for (const s of k.keys) out(`  ${s.key.padEnd(36)} asked ${String(s.asked).padStart(4)}  answered ${String(s.answered).padStart(4)}  missing ${String(s.missing).padStart(4)}`);
  }
}

// ------------------------------------------------------------------------------------------------------------------ promote
function printPromotion(p: Promotion, out: (s: string) => void): void {
  out(`Promotion: ${p.key} to ${p.mark} on family ${p.family} (${p.categories.join(", ")})`);
  out(`records of the family ${p.records} · records that would gain an unanswered required key ${p.rows.length} · keys added ${p.keysAdded}`);
  out(`W_TIER_REQUIRED ${p.budget.records.now} -> ${p.budget.records.promoted} · W_TIER_REQUIRED.keys ${p.budget.keys.now} -> ${p.budget.keys.promoted}`);
  for (const r of p.rows) out(`  ${r.ref.padEnd(64)} ${r.type.padEnd(34)} + ${r.added.join(", ")}`);
  if (p.ok) out(`OK: the promotion adds no unanswered required key. Write it in data/vocab/types.json, run capture.ts build, then gaps --budget --check and --write in the same commit.`);
  else out(`BLOCKED: the promotion would add ${p.keysAdded} unanswered required key(s). Fill each record first (a value, or searched_none with "on" and "tried"), then promote in the same commit; never raise the budget for a promotion (location-type-requirements 5.4).`);
}

function promoteCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const key = arg(argv, "--promote");
  const family = arg(argv, "--family");
  const mark = (arg(argv, "--mark") ?? "R") as PromoteMark;
  if (!key || key.startsWith("--") || !family) {
    err(`gaps --promote needs a key and a family, for example: gaps --promote address --family stay (families: ${CAP_FAMILY.join(", ")}; a link kind is links.<kind>)`);
    return 2;
  }
  if (mark !== "R" && mark !== "R?") {
    err(`--mark is R or R?, not ${mark}`);
    return 2;
  }
  let p: Promotion;
  try {
    p = promotion(loadWorld(root), loadTypes(root), key, family, mark);
  } catch (e) {
    if (e instanceof PromoteError) {
      err(e.message);
      return 2;
    }
    throw e;
  }
  if (argv.includes("--json")) out(JSON.stringify(p, null, 2));
  else printPromotion(p, out);
  return p.ok ? 0 : 1;
}

// ------------------------------------------------------------------------------------------------------------------ budget
function budgetCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  if (argv.includes("--write")) {
    const reason = arg(argv, "--reason");
    const today = arg(argv, "--today") ?? new Date().toISOString().slice(0, 10);
    const res = writeBudget(root, { today, ...(reason ? { reason } : {}), pin: argv.includes("--pin") });
    if (!res.written) {
      err(`not written: ${res.rose.join(", ")} rose. A count may only fall; raise it only with a written reason: gaps --budget --write --reason "<why>"`);
      return 1;
    }
    out(`wrote ${GAP_BUDGET_PATH}${res.rose.length ? ` (raised with a reason: ${res.rose.join(", ")})` : ""}`);
    return 0;
  }
  const res = checkBudget(root);
  if (argv.includes("--json")) {
    out(JSON.stringify(res, null, 2));
    return res.ok ? 0 : 1;
  }
  for (const i of res.issues) out(`ERROR ${i}`);
  for (const r of res.rows) out(`${r.verdict === "rose" ? "ROSE" : r.verdict === "fell" ? "fell" : "    "} ${r.code.padEnd(22)} budget ${String(r.budget).padStart(5)}  now ${String(r.now).padStart(5)}`);
  const fell = res.rows.filter((r) => r.verdict === "fell");
  if (!res.ok) out(`FAILED: a gap count rose (or the budget file is broken). Fill the record, or raise the count with a written reason: node core/bin/capture.ts gaps --budget --write --reason "<why>"`);
  else out(`OK: no gap count rose${fell.length ? `; ${fell.length} fell, so lower the budget: node core/bin/capture.ts gaps --budget --write` : ""}`);
  return res.ok ? 0 : 1;
}

export function gapsCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const json = argv.includes("--json");
  const trip = arg(argv, "--trip");
  if (argv.includes("--budget")) {
    if (!argv.includes("--check") && !argv.includes("--write")) {
      const b = loadBudget(root);
      out(JSON.stringify(b ? { counts: b.counts, strict: b.strict, pinned: b.pinned.refs.length, raised: b.raised } : null, null, 2));
      return b ? 0 : 1;
    }
    return budgetCommand(argv, root, out, err);
  }
  if (argv.includes("--placement")) {
    const rep = placementReport(root, trip);
    if (trip && rep.rows.length === 0) {
      err(`no capture records for trip ${trip}. Trips: ${[...new Set(placementReport(root, null).rows.map((r) => r.trip))].join(", ")}`);
      return 2;
    }
    if (json) out(JSON.stringify({ codes: PLACEMENT_CODES, summaries: rep.summaries, records: rep.rows.filter((r) => r.findings.length > 0) }, null, 2));
    else printPlacement(rep, out);
    return 0;
  }
  if (argv.includes("--promote")) return promoteCommand(argv, root, out, err);
  const family = arg(argv, "--family");
  if (argv.includes("--family") && (!family || !(CAP_FAMILY as readonly string[]).includes(family))) {
    err(`gaps --family needs one of ${CAP_FAMILY.join(", ")}, for example: gaps --family park --tier required`);
    return 2;
  }
  const tier = arg(argv, "--tier") ?? (family ? "required" : null);
  if (argv.includes("--tier") || family) {
    if (tier !== "required" && tier !== "enrichment") {
      err("gaps --tier needs required or enrichment, for example: gaps --tier required --layer route --type nature.trail --json");
      return 2;
    }
    const rep = tierReport(root, tier, { layer: arg(argv, "--layer"), type: arg(argv, "--type"), trip, family });
    if (json) out(JSON.stringify(rep, null, 2));
    else printTier(rep, out);
    return 0;
  }
  if (!trip) {
    err("gaps needs --trip <trip>, --placement, --tier required|enrichment, --family <f>, --promote <key> --family <f> or --budget --check. Example: gaps --trip dolomites-2027");
    return 2;
  }
  const level = (arg(argv, "--level") ?? "usable") as "usable" | "complete";
  const { rows, byLevel } = gapsReport(root, trip, level);
  if (json) {
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

void BUDGET_CODES; void TIER_KEYS_COUNT;
