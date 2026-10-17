// Entry point for the CLI and the local server: the catalog operations, the lane selection read, and the freshness pass.
import { selectLanes } from "../lanes/select.ts";
import { OPS_BY_NAME } from "../ops/catalogue.ts";
import type { RunResult } from "../ops/run.ts";
import { toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { clone } from "./common.ts";
import type { Entity } from "./common.ts";
import { findIssues, staleRowKeys } from "./freshness.ts";
import { CATALOG_OPS, Session, diffRow, runCatalogOp } from "./ops.ts";
import type { CatalogRunOptions } from "./ops.ts";

export const isCatalogOp = (name: string): boolean => (CATALOG_OPS as readonly string[]).includes(name) || name === "lanes.select";

export async function runAnyCatalogOp(store: Store, name: string, input: unknown, opts: CatalogRunOptions = {}): Promise<RunResult> {
  return name === "lanes.select" ? runLanesSelect(store, input) : runCatalogOp(store, name, input, opts);
}

// ----------------------------------------------------------------------------- freshness, written
/** Mark the rows that carry an expired field as stale (plan 0A.1). Deterministic for a given date. */
export async function freshenCatalog(store: Store, opts: { today: string; now?: string; actor?: { id: string; via: string } }): Promise<{ marked: string[]; fields: Record<string, string[]> }> {
  const s = new Session(store, opts.actor ?? { id: "agent:freshness", via: "cli" }, opts.now ?? `${opts.today}T00:00:00Z`, opts.today);
  await s.load();
  const keys = staleRowKeys(findIssues(s.data, s.deps, opts.today), s.data);
  const marked: string[] = [];
  const fields: Record<string, string[]> = {};
  for (const [key, issues] of [...keys].sort(([a], [b]) => a.localeCompare(b))) {
    const [entity, ...rest] = key.split(":") as [Entity, ...string[]];
    const id = rest.join(":");
    const hit = s.data.findRow(entity, id);
    if (!hit || !["verified", "proposed"].includes(hit.row.review_status)) continue;
    s.dirty.add(hit.file.path);
    const old = clone(hit.row);
    const names = [...new Set(issues.map((i) => i.field))].sort();
    hit.row.field_meta = { ...(hit.row.field_meta ?? {}), stale: { since: opts.today, was: hit.row.review_status, fields: names } };
    hit.row.review_status = "stale";
    hit.row.updated = opts.today;
    const d = diffRow(old, hit.row);
    s.note(entity, id, "edit", d.before, d.after, `freshness: ${names.join(", ")} expired`, null, []);
    marked.push(key);
    fields[key] = names;
  }
  await s.commit();
  return { marked, fields };
}


async function runLanesSelect(store: Store, rawInput: unknown): Promise<RunResult> {
  const parsed = OPS_BY_NAME.get("lanes.select")!.input.safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, code: "E_SCHEMA", message: parsed.error.issues.map((x) => `${x.path.join(".") || "input"}: ${x.message}`).join("; ") };
  const { slug, drive_minutes } = parsed.data as { slug: string; drive_minutes?: number };
  const b = await store.read(`data/trips/${slug}/trip.json`);
  if (!b) return { ok: false, code: "E_NOT_FOUND", message: `no trip "${slug}". Trips are the folders under data/trips/.` };
  return { ok: true, result: selectLanes(JSON.parse(toText(b)), { driveMinutes: drive_minutes }) };
}
