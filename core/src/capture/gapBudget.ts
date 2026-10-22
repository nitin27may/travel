// The gap budget (META-0, capture contract 3.7): data/capture/gap-budget.json holds, per placement and tier code, how many records had
// the finding when the rule landed. `capture.ts gaps --budget --check` (tools/check-all.sh) fails when a count rises; DATA lanes lower
// the counts as they fill. A count is raised only with a written reason (`--write --reason`), which is logged in the file.
//
// The same file pins the records that existed when the rule landed (`pinned.refs`): their placement and tier findings are warnings
// until the migration (META-1) and the research passes clear them. Every other record in data/capture gets errors from day one, so
// the gap cannot grow. A code listed in `strict` is an error on pinned records too (W_PLACE_POINT after META-1, nearby spec 3.5 step 6).
import { writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { loadPlacement, PLACEMENT_CODES, placementFindings } from "./placementBlock.ts";
import type { PlacementWorld } from "./placementBlock.ts";
import { loadWorld, readJson } from "./records.ts";
import type { World } from "./records.ts";
import { recordTier } from "./tiers.ts";

export const GAP_BUDGET_PATH = "data/capture/gap-budget.json";
export const GAP_BUDGET_SCHEMA = "capture-gap-budget/1";
/** Every code the budget counts: the placement codes, then the tier code. */
export const BUDGET_CODES = [...PLACEMENT_CODES, "W_TIER_REQUIRED"] as const;
export type BudgetCode = (typeof BUDGET_CODES)[number];
/** The finer count beside W_TIER_REQUIRED: required keys unanswered over all records, so one filled key shows. */
export const TIER_KEYS_COUNT = "W_TIER_REQUIRED.keys";

export interface Raise { on: string; code: string; from: number; to: number; reason: string }
export interface GapBudget {
  schema: typeof GAP_BUDGET_SCHEMA;
  note: string;
  updated: string;
  pinned: { on: string; note: string; refs: string[] };
  strict: string[];
  counts: Record<string, number>;
  raised: Raise[];
  baseline?: Record<string, unknown>;
}

export function loadBudget(root: string): GapBudget | null {
  return readJson<GapBudget>(join(root, GAP_BUDGET_PATH));
}

export interface Severity {
  pinned: Set<string>;
  strict: Set<string>;
  townsLayer: boolean;
}

export function severityOf(root: string, townsLayer: boolean): Severity {
  const b = loadBudget(root);
  return { pinned: new Set(b?.pinned?.refs ?? []), strict: new Set(b?.strict ?? []), townsLayer };
}

/** Whether a file is a capture sidecar in the store (data/capture/<trip>/<lane>.json); a draft outside it only gets warnings. */
export function inStore(root: string, file: string | undefined): boolean {
  if (!file) return false;
  const r = relative(resolve(root), resolve(file)).split(sep).join("/");
  return /^data\/capture\/(?!splits\/|runs\/)[^/]+\/[^/]+\.json$/.test(r);
}

/**
 * error or warning for a placement or tier finding. A draft outside the store warns (it is not a record yet). W_PLACE_TOWN warns until
 * the towns layer exists, because nobody can fill it before. A pinned record warns unless the code is strict. A new record errors.
 */
export function levelOf(code: string, refs: string[], store: boolean, sev: Severity): "error" | "warning" {
  if (!store) return "warning";
  if (code === "W_PLACE_TOWN" && !sev.townsLayer) return "warning";
  if (refs.some((r) => sev.pinned.has(r))) return sev.strict.has(code) ? "error" : "warning";
  return "error";
}

/** Today's counts per code over every capture record (records with the finding), plus the unanswered required keys. */
export function budgetCounts(pw: PlacementWorld): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(BUDGET_CODES.map((c) => [c, 0]));
  counts[TIER_KEYS_COUNT] = 0;
  for (const { rec } of pw.world.cap.values()) {
    for (const code of new Set(placementFindings(pw, rec).map((f) => f.code))) counts[code] = (counts[code] ?? 0) + 1;
    const t = recordTier(pw.world, rec.ref);
    if (t && t.requiredMissing.length > 0) {
      counts.W_TIER_REQUIRED = (counts.W_TIER_REQUIRED ?? 0) + 1;
      counts[TIER_KEYS_COUNT] = (counts[TIER_KEYS_COUNT] ?? 0) + t.requiredMissing.length;
    }
  }
  return counts;
}

export interface BudgetCheck { ok: boolean; rows: { code: string; budget: number; now: number; verdict: "rose" | "fell" | "same" }[]; issues: string[] }

/** Compares today's counts with the budget. A rise fails; a fall passes and asks for the budget to be lowered. */
export function checkBudget(root: string, world?: World): BudgetCheck {
  const w = world ?? loadWorld(root);
  const pw = loadPlacement(root, w);
  const issues = pw.pointsIssues.map((i) => `${i.file}#${i.path}: ${i.message}`);
  const b = loadBudget(root);
  if (!b) return { ok: false, rows: [], issues: [...issues, `${GAP_BUDGET_PATH} is missing. Write it with: node core/bin/capture.ts gaps --budget --write`] };
  if (b.schema !== GAP_BUDGET_SCHEMA) issues.push(`${GAP_BUDGET_PATH}: schema must be "${GAP_BUDGET_SCHEMA}".`);
  const now = budgetCounts(pw);
  const rows = [...BUDGET_CODES, TIER_KEYS_COUNT].map((code) => {
    const budget = b.counts?.[code] ?? 0;
    const n = now[code] ?? 0;
    return { code, budget, now: n, verdict: (n > budget ? "rose" : n < budget ? "fell" : "same") as "rose" | "fell" | "same" };
  });
  return { ok: issues.length === 0 && rows.every((r) => r.verdict !== "rose"), rows, issues };
}

/**
 * Writes today's counts. A count may only fall, unless `reason` is given: then the rise is logged in `raised` with the reason (PHASE-B-START
 * section 9, soft rollback). `pin` (the first write only) pins every record that exists now.
 */
export function writeBudget(root: string, opts: { today: string; reason?: string; pin?: boolean; baseline?: Record<string, unknown> }): { written: boolean; rose: string[] } {
  const w = loadWorld(root);
  const pw = loadPlacement(root, w);
  const now = budgetCounts(pw);
  const old = loadBudget(root);
  const rose = old ? Object.keys(now).filter((k) => (now[k] ?? 0) > (old.counts?.[k] ?? 0)) : [];
  if (rose.length > 0 && !opts.reason) return { written: false, rose };
  const refs = opts.pin || !old ? [...w.cap.keys()].sort() : old.pinned.refs;
  const doc: GapBudget = {
    schema: GAP_BUDGET_SCHEMA,
    note: old?.note ?? "",
    updated: opts.today,
    strict: old?.strict ?? [],
    counts: now,
    raised: [...(old?.raised ?? []), ...rose.map((code) => ({ on: opts.today, code, from: old?.counts?.[code] ?? 0, to: now[code] ?? 0, reason: opts.reason! }))],
    ...(opts.baseline ?? old?.baseline ? { baseline: opts.baseline ?? old!.baseline } : {}),
    // the long list last, so the counts stay at the top of the file
    pinned: opts.pin || !old ? { on: opts.today, note: old?.pinned?.note ?? "", refs } : old.pinned,
  };
  writeFileSync(join(root, GAP_BUDGET_PATH), JSON.stringify(doc, null, 2) + "\n");
  return { written: true, rose };
}
