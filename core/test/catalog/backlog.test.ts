import { describe, expect, it } from "vitest";
import { buildBacklog, severityOf } from "../../src/catalog/backlog.ts";
import { loadCatalog, loadDeps, loadLocationDoc, loadLocations } from "../../src/catalog/common.ts";
import { backlogFor, writeBacklog } from "../../src/catalog/reports.ts";
import { SRC, row, seed } from "./seed.ts";
import { newStore } from "./util.ts";

const A = "AR/santa-cruz/el-chalten";
const U = "AR/tierra-del-fuego/ushuaia";
const TRAIL = `${A}/laguna-de-los-tres`;

const trip = (start: string, extra: Record<string, unknown> = {}) => ({
  trip: { slug: "t" }, editions: [{ status: "chosen", start }], items: [{ trail_id: TRAIL }], trip_bookings: [], ...extra,
});

async function fixture(trips: unknown[] = [], existing: unknown[] = []) {
  const store = newStore();
  await seed(store, [
    { entity: "trails", row: row("trails", TRAIL, A, { field_meta: { hazards: { confidence: "gap", gap_reason: "not stated" }, km: { confidence: "conflict", kind: "official", read: "2026-10-01", src: ["src-0001"] } } }) },
    { entity: "offers", row: row("offers", "of-p-icewalk", A, { opens_kind: "rolling-lead", opens_lead_days: 5, field_meta: { opens_kind: { kind: "operator", read: "2025-01-01", src: ["src-0001"] } } }) },
  ], [SRC(1)]);
  const inp = {
    data: await loadCatalog(store), deps: await loadDeps(store),
    locations: { ...(await loadLocations(store)), ...(await loadLocationDoc(store)) } as any,
    placeRows: ((await loadLocationDoc(store)).places ?? []) as any[], today: "2026-10-17", trips: trips as any[], existing: existing as any[],
  };
  return { store, rows: buildBacklog(inp) };
}

describe("backlog", () => {
  it("lists GAP fields, conflicts, stale fields and thin types, each with a reason and a lane", async () => {
    const { rows } = await fixture();
    const by = (reason: string) => rows.filter((r) => r.reason === reason);
    expect(by("gap").map((r) => [r.subject_id, r.field, r.lane])).toEqual([[TRAIL, "hazards", "trails"]]);
    expect(by("conflict").map((r) => [r.subject_id, r.field])).toEqual([[TRAIL, "km"]]);
    expect(by("stale").map((r) => [r.subject_id, r.field, r.lane])).toEqual([["of-p-icewalk", "opens_kind", "adventure"]]);
    const thin = by("low-coverage");
    expect(thin.filter((r) => r.area_id === U).map((r) => r.field).sort()).toEqual(["activities", "eateries", "guide", "legs", "sights", "stays", "trails"]);
    expect(thin.find((r) => r.area_id === A && r.field === "stays")!.lane).toBe("stays");
    expect(rows.every((r) => r.status === "open" && r.created === "2026-10-17" && r.done === null)).toBe(true);
  });

  it("priority is max(1, trips using) * urgency * severity; unused areas stay above zero", async () => {
    const { rows } = await fixture();
    // no trip: floor of 1 trip, urgency 1: severity 1 for a gap on hazards, 3 for a stale booking window
    expect(rows.find((r) => r.reason === "gap")!.priority).toBe(1);
    expect(rows.find((r) => r.reason === "stale")!.priority).toBe(3);
    expect(rows.every((r) => r.priority >= 1)).toBe(true);
    expect(rows.filter((r) => r.area_id === U).every((r) => r.priority >= 1)).toBe(true);
  });

  it("a trip using the trail with a chosen edition inside 120 days multiplies by 3; two trips by 2", async () => {
    const { rows } = await fixture([trip("2026-12-01"), trip("2027-02-01", { trip: { slug: "u" } })]);
    const km = rows.find((r) => r.reason === "conflict")!;
    // trips_using 2, urgency 3 (the nearest start is 45 days away), severity 2 for trail stats
    expect(km.priority).toBe(2 * 3 * 2);
    const gap = rows.find((r) => r.reason === "gap")!;
    expect(gap.priority).toBe(2 * 3 * 1);
    // the area of the trail counts the same trips for its low-coverage items
    expect(rows.find((r) => r.reason === "low-coverage" && r.area_id === A && r.field === "eateries")!.priority).toBe(2 * 3 * 1);
  });

  it("urgency is 2 within a year and 1 beyond", async () => {
    const within = await fixture([trip("2027-06-01")]);
    expect(within.rows.find((r) => r.reason === "gap")!.priority).toBe(2);
    const later = await fixture([trip("2029-06-01")]);
    expect(later.rows.find((r) => r.reason === "gap")!.priority).toBe(1);
  });

  it("severity: hard limits, booking windows and must-book prices 3; hours and stats 2; the rest 1", () => {
    expect(["min_age", "max_weight_kg", "opens_kind", "sellout_lead_days"].map((f) => severityOf(f, false))).toEqual([3, 3, 3, 3]);
    expect(severityOf("amount", true)).toBe(3);
    expect(severityOf("amount", false)).toBe(1);
    expect(["hours", "km", "gain_m", "local_grade"].map((f) => severityOf(f, false))).toEqual([2, 2, 2, 2]);
    expect(severityOf("notes", false)).toBe(1);
    expect(severityOf(null, false)).toBe(1);
  });

  it("ids are stable for the same subject and reason across runs and across dates", async () => {
    const a = await fixture();
    const b = await fixture();
    expect(b.rows.map((r) => r.id)).toEqual(a.rows.map((r) => r.id));
    expect(a.rows.every((r) => /^bl-[0-9a-f]{12}$/.test(r.id))).toBe(true);
    expect(new Set(a.rows.map((r) => r.id)).size).toBe(a.rows.length);
  });

  it("keeps owner-added rows and rows that were claimed, finished or set aside", async () => {
    const first = await fixture();
    const gap = first.rows.find((r) => r.reason === "gap")!;
    const owner = { id: "bl-0123456789ab", subject_entity: null, subject_id: null, area_id: U, reason: "user-request", field: "restaurants", lane: "relax-luxury", priority: 0, status: "open", claimed_by: null, created: "2026-10-01", done: null };
    const claimed = { ...gap, status: "claimed", claimed_by: "run-7", created: "2026-10-05" };
    const wont = { ...first.rows.find((r) => r.reason === "conflict")!, status: "wont-do" };
    const { rows } = await fixture([], [owner, claimed, wont]);
    expect(rows.find((r) => r.id === owner.id)).toMatchObject({ reason: "user-request", priority: 1 });
    expect(rows.find((r) => r.id === gap.id)).toMatchObject({ status: "claimed", claimed_by: "run-7", created: "2026-10-05" });
    expect(rows.find((r) => r.id === wont.id)!.status).toBe("wont-do");
  });

  it("an open item never has priority 0, and the file is written sorted and only when it changes", async () => {
    const { store } = await fixture();
    const w1 = await writeBacklog(store, "2026-10-17");
    expect(w1.changed).toBe(true);
    const text = store.text("data/catalog/backlog.json")!;
    const doc = JSON.parse(text);
    expect(doc.backlog.every((r: any) => r.priority >= 1)).toBe(true);
    const prios = doc.backlog.map((r: any) => r.priority);
    expect(prios).toEqual([...prios].sort((a: number, b: number) => b - a));
    expect((await writeBacklog(store, "2026-10-17")).changed).toBe(false);
    expect((await backlogFor(store, "2026-10-17")).map((r) => r.id)).toEqual(doc.backlog.map((r: any) => r.id));
  });
});
