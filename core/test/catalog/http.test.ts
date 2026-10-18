import { describe, expect, it } from "vitest";
import { catalogGet, listProposals } from "../../src/catalog/http.ts";
import { newStore, propose } from "./util.ts";
import { SIDECARS } from "./util.ts";

describe("catalog read routes for /review/", () => {
  it("lists proposals with change names and the pending counts per area", async () => {
    const store = newStore();
    await propose(store, SIDECARS.trails);
    const list = await listProposals(store);
    expect(list).toHaveLength(1);
    expect(list[0]!.changes.every((c) => c.name.length > 0)).toBe(true);
    const got = await catalogGet(store, "/api/v1/catalog/summary", new URLSearchParams(), "2026-10-17");
    expect(got?.status).toBe(200);
    const body = got!.body as { pending: Record<string, { open: number }> };
    expect(Object.values(body.pending).reduce((n, r) => n + r.open, 0)).toBe(3);
  });

  it("returns null for a path that is not a catalog route", async () => {
    expect(await catalogGet(newStore(), "/api/v1/other", new URLSearchParams(), "2026-10-17")).toBeNull();
  });
});
