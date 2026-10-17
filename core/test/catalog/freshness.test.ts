import { describe, expect, it } from "vitest";
import { loadCatalog } from "../../src/catalog/common.ts";
import { daysBetween, findIssues, staleRowKeys } from "../../src/catalog/freshness.ts";
import { SRC, row, seed } from "./seed.ts";
import { deps, newStore } from "./util.ts";

const A = "AR/santa-cruz/el-chalten";

async function fixture() {
  const store = newStore();
  await seed(store, [
    // hard limits, 365 days: a minimum age read on 2025-09-01
    { entity: "activities", row: row("activities", `${A}/old-limit`, A, { min_age: 8, field_meta: { min_age: { kind: "operator", read: "2025-09-01", src: ["src-0001"] } } }) },
    // the same limit read recently
    { entity: "activities", row: row("activities", `${A}/new-limit`, A, { min_age: 8, field_meta: { min_age: { kind: "operator", read: "2026-09-01", src: ["src-0001"] } } }) },
    // trail stats: three years, nothing happens; geography never stale
    { entity: "trails", row: row("trails", `${A}/old-trail`, A, { km: 8, trailhead_lat: -49.3, trailhead_lon: -72.9, field_meta: { km: { kind: "official", read: "2025-01-01", src: ["src-0001"] } } }) },
    // eatery hours, 180 days, via the row's last verification
    { entity: "eateries", row: row("eateries", `${A}/cafe`, A, { hours: { "1": [["09:00", "17:00"]] }, last_verified: "2026-01-01" }) },
    // a retired row never counts
    { entity: "eateries", row: row("eateries", `${A}/gone`, A, { hours: { "1": [["09:00", "17:00"]] }, last_verified: "2020-01-01", review_status: "retired" }) },
    { entity: "offers", row: row("offers", "of-p-tour", A, { opens_kind: "rolling-lead", opens_lead_days: 5, field_meta: { opens_kind: { kind: "operator", read: "2026-09-01", src: ["src-0001"] } } }) },
    { entity: "offer_prices", row: { ...row("offer_prices" as any, "of-p-tour#1", A), __cc: "AR", offer_id: "of-p-tour", amount: 100, currency: "ARS", per: "person", read: "2026-04-01", source_id: "src-0001" } },
    { entity: "offer_prices", row: { ...row("offer_prices" as any, "of-p-tour#2", A), __cc: "AR", offer_id: "of-p-tour", amount: 110, currency: "ARS", per: "person", read: "2026-06-01", source_id: "src-0001" } },
  ], [SRC(1)]);
  return { store, data: await loadCatalog(store), d: await deps() };
}

describe("freshness", () => {
  it("flags a hard limit read more than 365 days before the date, and not one read 46 days before", async () => {
    const { data, d } = await fixture();
    const issues = findIssues(data, d, "2026-10-17");
    const limits = issues.filter((i) => i.field === "min_age");
    expect(limits.map((i) => i.id)).toEqual([`${A}/old-limit`]);
    expect(limits[0]).toMatchObject({ class: "hard-limits", read: "2025-09-01", age_days: 411, limit_days: 365 });
  });

  it("is deterministic for a date: the same date gives the same issues, a later date gives more", async () => {
    const { data, d } = await fixture();
    const a = findIssues(data, d, "2026-10-17");
    expect(findIssues(data, d, "2026-10-17")).toEqual(a);
    expect(findIssues(data, d, "2027-10-01").length).toBeGreaterThan(a.length);
    expect(findIssues(data, d, "2026-01-01").filter((i) => i.field === "min_age")).toEqual([]);
  });

  it("only the newest price snapshot of an offer decides whether the price is stale (120 days)", async () => {
    const { data, d } = await fixture();
    expect(findIssues(data, d, "2026-09-01").filter((i) => i.field === "amount")).toEqual([]);
    const late = findIssues(data, d, "2026-10-17").filter((i) => i.field === "amount");
    expect(late.map((i) => [i.id, i.age_days])).toEqual([["of-p-tour#2", 138]]);
  });

  it("uses the row's last verification for hours (180 days) and skips retired rows", async () => {
    const { data, d } = await fixture();
    const hours = findIssues(data, d, "2026-10-17").filter((i) => i.field === "hours");
    expect(hours.map((i) => i.id)).toEqual([`${A}/cafe`]);
    expect(hours[0]!.age_days).toBe(daysBetween("2026-01-01", "2026-10-17"));
  });

  it("trail stats (three years) and geography never mark a row", async () => {
    const { data, d } = await fixture();
    const issues = findIssues(data, d, "2026-10-17");
    expect(issues.filter((i) => i.id.endsWith("old-trail"))).toEqual([]);
    const far = findIssues(data, d, "2030-01-01");
    const trail = far.filter((i) => i.id.endsWith("old-trail"));
    expect(trail.every((i) => i.on_stale.includes("none"))).toBe(true);
    expect(staleRowKeys(far, data).has(`trails:${A}/old-trail`)).toBe(false);
  });

  it("a price issue marks its offer stale", async () => {
    const { data, d } = await fixture();
    const keys = staleRowKeys(findIssues(data, d, "2026-10-17"), data);
    expect([...keys.keys()].sort()).toEqual([`activities:${A}/old-limit`, `eateries:${A}/cafe`, "offers:of-p-tour"]);
  });
});
