// Read operations over a Store. The MCP handlers (core/src/mcp/handlers.ts) cover the reads that scan files under the
// repository root; this table overrides the two that need the real book-by and sun providers and the Store.
import { fsCatalog } from "../checks/context.ts";
import { HANDLERS, ToolError } from "../mcp/handlers.ts";
import { resolveEdition } from "../derive/edition.ts";
import { toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { OpError } from "./types.ts";
import type { Row } from "./types.ts";

export interface ReadEnv {
  store: Store;
  root: string;
  today: string;
}
export type ReadHandler = (input: any, env: ReadEnv) => unknown | Promise<unknown>;

async function loadTripDoc(store: Store, slug: string): Promise<Row | null> {
  const b = await store.read(`data/trips/${slug}/trip.json`);
  return b ? JSON.parse(toText(b)) : null;
}

async function tripSlugs(store: Store): Promise<string[]> {
  const files = await store.list("data/trips/");
  return files.map((f) => /^data\/trips\/([^/]+)\/trip\.json$/.exec(f)?.[1]).filter((s): s is string => !!s);
}

export const READ_HANDLERS: Record<string, ReadHandler> = {
  ...(Object.fromEntries(Object.entries(HANDLERS).map(([k, h]) => [k, (input: any, env: ReadEnv) => h(input, { root: env.root, today: env.today })])) as Record<string, ReadHandler>),

  "trip.get": async ({ slug, edition, resolve }, { store, root, today }) => {
    const doc = await loadTripDoc(store, slug);
    if (!doc) throw new OpError("E_NOT_FOUND", `no trip "${slug}". Trips are the folders under data/trips/ (${(await tripSlugs(store)).join(", ") || "none yet"}).`);
    if (!resolve) return { trip: doc };
    if (edition && !(doc.editions ?? []).some((e: Row) => e.id === edition)) {
      throw new OpError("E_NOT_FOUND", `trip "${slug}" has no edition "${edition}". Its editions are: ${(doc.editions ?? []).map((e: Row) => e.id).join(", ") || "none"}.`);
    }
    return { trip: { ...doc, resolved: resolveEdition(doc, { edition, today, catalog: fsCatalog(root) }) } };
  },

  "bookings.due": async ({ within_days, trip }, { store, root, today }) => {
    const horizon = new Date(Date.parse(today) + within_days * 86400000).toISOString().slice(0, 10);
    const catalog = fsCatalog(root);
    const out: Row[] = [];
    for (const slug of trip ? [trip] : await tripSlugs(store)) {
      const doc = await loadTripDoc(store, slug);
      if (!doc) continue;
      const resolved = resolveEdition(doc, { today, catalog });
      const byId = new Map<string, Row>((doc.trip_bookings ?? []).map((b: Row) => [b.id, b]));
      for (const r of resolved.bookings) {
        if (r.state === "booked" || r.state === "cancelled" || r.state === "sold-out") continue;
        if (r.book_by_date && r.book_by_date > horizon) continue;
        const b = byId.get(r.id)!;
        out.push({
          trip: slug, id: r.id, item: b.item ?? b.offer_id, status: b.status, priority: b.priority, book_by: r.book_by_date, book_by_basis: r.book_by_basis,
          opens: r.opens_date, state: r.state, gap: r.gap, overdue: r.book_by_date !== null && r.book_by_date < today,
        });
      }
    }
    out.sort((a, b) => String(a.book_by ?? "9999").localeCompare(String(b.book_by ?? "9999")) || String(a.id).localeCompare(String(b.id)));
    return { bookings: out };
  },
};

export { ToolError };
