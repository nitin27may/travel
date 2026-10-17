import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freshenCatalog, isCatalogOp, runAnyCatalogOp } from "../../src/catalog/dispatch.ts";
import { coverageFor } from "../../src/catalog/reports.ts";
import { FIXROOT, REPO, op, newStore, must } from "./util.ts";
import { SRC, row, seed } from "./seed.ts";

const A = "AR/santa-cruz/el-chalten";

describe("freshenCatalog", () => {
  async function fixture() {
    const store = newStore();
    await seed(store, [
      { entity: "eateries", row: row("eateries", `${A}/cafe`, A, { hours: { "1": [["09:00", "17:00"]] }, last_verified: "2026-01-01" }) },
      { entity: "eateries", row: row("eateries", `${A}/bar`, A, { hours: { "1": [["09:00", "17:00"]] }, last_verified: "2026-09-01", review_status: "proposed" }) },
      { entity: "eateries", row: row("eateries", `${A}/raw`, A, { hours: { "1": [["09:00", "17:00"]] }, last_verified: "2025-01-01", review_status: "raw" }) },
    ], [SRC(1)]);
    return store;
  }

  it("marks rows with an expired field stale, remembers what they were, and logs it", async () => {
    const store = await fixture();
    const r = await freshenCatalog(store, { today: "2026-10-17" });
    expect(r.marked).toEqual([`eateries:${A}/cafe`]);
    const rows = JSON.parse(store.text("data/catalog/eateries/AR.json")!).eateries;
    const cafe = rows.find((x: any) => x.id.endsWith("cafe"));
    expect(cafe.review_status).toBe("stale");
    expect(cafe.field_meta.stale).toEqual({ since: "2026-10-17", was: "verified", fields: ["hours"] });
    expect(rows.find((x: any) => x.id.endsWith("bar")).review_status).toBe("proposed");
    expect(rows.find((x: any) => x.id.endsWith("raw")).review_status).toBe("raw");
    const log = JSON.parse(store.text("data/catalog/changes/2026-10.jsonl")!.trim());
    expect(log).toMatchObject({ op: "edit", id: `${A}/cafe`, reason: "freshness: hours expired", before: { review_status: "verified" }, after: { review_status: "stale" } });
  });

  it("is a no-op the second time and for an earlier date", async () => {
    const store = await fixture();
    expect((await freshenCatalog(store, { today: "2026-03-01" })).marked).toEqual([]);
    await freshenCatalog(store, { today: "2026-10-17" });
    const snap = JSON.stringify(store.snapshot());
    expect((await freshenCatalog(store, { today: "2026-10-17" })).marked).toEqual([]);
    expect(JSON.stringify(store.snapshot())).toBe(snap);
  });

  it("a stale verified row counts half in coverage", async () => {
    const store = await fixture();
    const before = (await coverageFor(store, "2026-10-17")).areas.find((a) => a.area_id === A && a.level === "area")!;
    await freshenCatalog(store, { today: "2026-10-17" });
    const after = (await coverageFor(store, "2026-10-17")).areas.find((a) => a.area_id === A && a.level === "area")!;
    expect(after.types.eateries.weighted).toBe(before.types.eateries.weighted);
    expect(after.types.eateries.weighted).toBe(0.5 + 0.3 + 0.3);
  });
});

describe("dispatch", () => {
  it("knows the catalog operations and lanes.select", () => {
    expect(["catalog.apply", "catalog.undo", "backlog.add", "lanes.select"].every(isCatalogOp)).toBe(true);
    expect(isCatalogOp("trip.update")).toBe(false);
  });

  it("lanes.select reads a stored trip", async () => {
    const trip = readFileSync(join(REPO, "core/test/fixtures/trips/patagonia-fixture/trip.json"), "utf8");
    const store = newStore({ "data/trips/patagonia-fixture/trip.json": trip });
    const r: any = must(await runAnyCatalogOp(store, "lanes.select", { slug: "patagonia-fixture" }));
    expect(r.result.lanes.map((l: any) => l.lane)).toEqual(expect.arrayContaining(["overview", "timing"]));
    expect(await runAnyCatalogOp(store, "lanes.select", { slug: "nope" })).toMatchObject({ ok: false, code: "E_NOT_FOUND" });
  });

  it("backlog.add keeps owner rows and refuses a duplicate id", async () => {
    const store = newStore();
    const rowIn = { id: "bl-aaaaaaaaaaaa", subject_entity: null, subject_id: null, area_id: "AR/santa-cruz/el-chalten", reason: "user-request", field: "restaurants", lane: "relax-luxury", priority: 2, status: "open", claimed_by: null, created: "2026-10-17", done: null };
    must(await op(store, "backlog.add", { row: rowIn }));
    expect(JSON.parse(store.text("data/catalog/backlog.json")!).backlog).toEqual([rowIn]);
    expect(await op(store, "backlog.add", { row: rowIn })).toMatchObject({ ok: false, code: "E_EXISTS" });
    void FIXROOT;
  });
});
