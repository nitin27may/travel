// The two read routes the /review/ page needs, kept out of bin/serve.ts so the server only gains a call:
//   GET /api/v1/catalog/proposals          every catalog proposal, newest first, with all changes
//   GET /api/v1/catalog/summary[?date=]    pending counts per area, coverage per area, the top of the backlog
// Writes go through POST /api/v1/ops/catalog.apply | catalog.reject | catalog.undo | catalog.edit like any operation.
import { catalogProposal, settle } from "./proposal.ts";
import type { CatalogProposal } from "./proposal.ts";
import { backlogFor, coverageFor } from "./reports.ts";
import { toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";

export async function listProposals(store: Store): Promise<CatalogProposal[]> {
  const out: CatalogProposal[] = [];
  for (const p of await store.list("data/catalog/proposals/")) {
    if (!p.endsWith(".json")) continue;
    const parsed = catalogProposal.safeParse(JSON.parse(toText((await store.read(p))!)));
    if (parsed.success) {
      settle(parsed.data);
      out.push(parsed.data);
    }
  }
  return out.sort((a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id));
}

export async function summary(store: Store, today: string) {
  const proposals = await listProposals(store);
  const pending: Record<string, { open: number; auto: number; review: number; duplicates: number; conflicts: number }> = {};
  for (const p of proposals) {
    for (const c of p.changes) {
      if (c.status !== "open") continue;
      const area = c.area_id ?? "(no area)";
      const row = (pending[area] ??= { open: 0, auto: 0, review: 0, duplicates: 0, conflicts: 0 });
      row.open++;
      if (c.auto) row.auto++;
      else row.review++;
      if (c.flags.includes("possible-duplicate")) row.duplicates++;
      if (c.flags.includes("conflict")) row.conflicts++;
    }
  }
  const coverage = await coverageFor(store, today);
  const backlog = await backlogFor(store, today);
  return { today, pending, coverage: coverage.areas, targets: coverage.targets, backlog: backlog.filter((b) => b.status === "open").slice(0, 60), backlog_total: backlog.length };
}

/** returns null when the path is not a catalog route */
export async function catalogGet(store: Store, pathname: string, params: URLSearchParams, today: string): Promise<{ status: number; body: unknown } | null> {
  if (pathname === "/api/v1/catalog/proposals") return { status: 200, body: { ok: true, proposals: await listProposals(store) } };
  if (pathname === "/api/v1/catalog/summary") return { status: 200, body: { ok: true, ...(await summary(store, params.get("date") ?? today)) } };
  return null;
}
