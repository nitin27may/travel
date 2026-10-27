// RIS-H: capture homes for the seven properties of DATA-PLAN row 24 (docs/v2/features/catalogue-intake-and-storage.md 5.3):
// duration_min, activity_min, book_url, closures, check_in_out, fills_by, groceries. Each test covers the registry home, the
// value shape (a valid value passes, a wrong unit or type fails), where the property applies, and what the engine now reads.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import { capRecord } from "../../src/schema/capture/records.ts";
import { homedValueFindings } from "../../src/validate/capture.ts";
import { validateDoc } from "../../src/validate/index.ts";
import { completeness } from "../../src/capture/engine.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { resolveNode } from "../../src/capture/resolve.ts";
import { REPO, capDoc, scope, scratchRoot } from "./helpers.ts";

const HOMED = ["duration_min", "activity_min", "book_url", "closures", "check_in_out", "fills_by", "groceries"] as const;
const val = (v: unknown, over: Record<string, unknown> = {}) => ({ v, state: "value", basis: "our_inference", src: [], note: "fixture", ...over });
const raft = (over: Record<string, unknown> = {}) => ({ ref: "offer/place/lago-di-braies#raft", type: "water.river.rafting", layer: "offer", name: "Raft", at: ["place/lago-di-braies"], ...over });
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies", ...over });
const hotel = (over: Record<string, unknown> = {}) => ({ ref: "offer/place/lago-di-braies#rooms", type: "stay.room.hotel", layer: "offer", name: "Rooms", at: ["place/lago-di-braies"], ...over });
/** parse one property on a minimal record; true when the schema accepts it */
const ok = (key: string, v: unknown): boolean => capRecord.safeParse({ ...lake(), [key]: val(v) }).success;

const root = () => scratchRoot({ "data/suitability/scope.json": scope(["lago-di-braies"]) });
const run = (r: string, records: unknown[]) => validateDoc(capDoc(records), "sidecar", r, { kind: "capture" as never });
const codes = (res: { errors: { code: string }[] }) => [...new Set(res.errors.map((e) => e.code))].sort();
const warnsAt = (res: { warnings: { code: string; path: string }[] }, code: string) => res.warnings.filter((w) => w.code === code).map((w) => w.path);

describe("registry homes (RIS-H)", () => {
  it("each of the seven has a capture home at its own key, a value type, an honest gap line and a freshness class", () => {
    const fresh = JSON.parse(readFileSync(join(REPO, "data/schema/freshness.json"), "utf8")) as { classes: { id: string; fields: string[] }[] };
    const classOf = (k: string) => fresh.classes.find((c) => c.fields.includes(k))?.id;
    const expected: Record<(typeof HOMED)[number], { value: string; unit?: string; layers?: string[]; fresh: string }> = {
      duration_min: { value: "range", unit: "min", layers: ["offer"], fresh: "hours" },
      activity_min: { value: "range", unit: "min", layers: ["offer"], fresh: "hours" },
      book_url: { value: "text", layers: ["offer"], fresh: "booking-windows" },
      closures: { value: "object_list", fresh: "closures" },
      check_in_out: { value: "object", layers: ["offer"], fresh: "hours" },
      fills_by: { value: "object", layers: ["place"], fresh: "booking-windows" },
      groceries: { value: "text", layers: ["place"], fresh: "summaries" },
    };
    for (const k of HOMED) {
      const p = PROPERTY_BY_KEY.get(k)!;
      expect(p.home, k).toEqual({ in: "capture", path: k });
      expect(Object.keys(capRecord.shape), k).toContain(k);
      expect(p.value, k).toBe(expected[k].value);
      expect(p.unit, k).toBe(expected[k].unit);
      expect(p.layers, k).toEqual(expected[k].layers);
      expect(p.gap, k).not.toBe("Not recorded");
      expect(classOf(k), k).toBe(expected[k].fresh);
      expect(p.keep.length, k).toBeGreaterThan(0);
    }
  });
  it("the marks are unchanged: R on experience offers (duration, activity, booking page), R on lodging (check-in), R? closures on trails", () => {
    expect(resolveNode("water.river.rafting")!.layers.offer!.base).toMatchObject({ duration_min: "R", activity_min: "R", book_url: "R" });
    expect(resolveNode("stay.room.hotel")!.layers.offer!.base).toMatchObject({ check_in_out: "R" });
    expect(resolveNode("nature.trail.hike")!.layers.route!.base).toMatchObject({ closures: "R?" });
  });
});

describe("value shapes: a valid value passes, a wrong unit or type fails", () => {
  it("duration_min and activity_min: whole minutes as [low, high]", () => {
    for (const k of ["duration_min", "activity_min"]) {
      expect(ok(k, [120, 180]), k).toBe(true);
      expect(ok(k, [90, 90]), k).toBe(true);
      expect(ok(k, "2-3 h"), k).toBe(false); // text, not minutes
      expect(ok(k, [2.5, 3]), k).toBe(false); // hours as a fraction: minutes are whole
      expect(ok(k, [0, 60]), k).toBe(false); // zero minutes is no duration
      expect(ok(k, [120]), k).toBe(false);
      expect(ok(k, { from: 120, to: 180 }), k).toBe(false);
    }
  });
  it("book_url: an http(s) URL", () => {
    expect(ok("book_url", "https://www.banffjaspercollection.com/attractions/maligne-lake-cruise/tickets/")).toBe(true);
    expect(ok("book_url", "www.example.com/tickets")).toBe(false);
    expect(ok("book_url", "call the office")).toBe(false);
    expect(ok("book_url", ["https://a.example/"])).toBe(false);
  });
  it("closures: at least one row with a date form, a status and a reason", () => {
    expect(ok("closures", [{ from: "2026-05-01", to: "2026-10-31", status: "closed", why: "Bridge replacement" }])).toBe(true);
    expect(ok("closures", [{ from: "2005", status: "closed", why: "Trail decommissioned" }])).toBe(true); // open-ended
    expect(ok("closures", [{ from: "12-01", to: "04-30", status: "limited", why: "Winter: upper section only" }])).toBe(true);
    expect(ok("closures", [])).toBe(false); // "none published" is none_stated, never an empty list
    expect(ok("closures", [{ from: "1 May 2026", status: "closed", why: "x" }])).toBe(false);
    expect(ok("closures", [{ from: "2026-05-01", status: "shut", why: "x" }])).toBe(false);
    expect(ok("closures", [{ from: "2026-05-01", status: "closed" }])).toBe(false);
    expect(ok("closures", "closed in winter")).toBe(false);
  });
  it("check_in_out: local times HH:MM", () => {
    expect(ok("check_in_out", { check_in: "16:00", check_out: "11:00" })).toBe(true);
    expect(ok("check_in_out", { check_in: "16:00", check_out: "11:00", check_in_until: "23:00", note: "Late arrival by phone" })).toBe(true);
    expect(ok("check_in_out", { check_in: "4pm", check_out: "11:00" })).toBe(false);
    expect(ok("check_in_out", { check_in: "16:00" })).toBe(false);
    expect(ok("check_in_out", "16:00 / 11:00")).toBe(false);
  });
  it("fills_by: a local time or sunrise, optionally narrowed by days and months", () => {
    expect(ok("fills_by", { by: "07:00" })).toBe(true);
    expect(ok("fills_by", { by: "sunrise", days: "every_day", months: [7, 8, 9] })).toBe(true);
    expect(ok("fills_by", { by: "7am" })).toBe(false);
    expect(ok("fills_by", { by: "07:00", months: [13] })).toBe(false);
    expect(ok("fills_by", "before sunrise")).toBe(false);
  });
  it("groceries: own words, at most 200 characters", () => {
    expect(ok("groceries", "IGA on Banff Avenue, open every day")).toBe(true);
    expect(ok("groceries", "")).toBe(false);
    expect(ok("groceries", "x".repeat(201))).toBe(false);
    expect(ok("groceries", true)).toBe(false);
  });
});

describe("validator rules the schema cannot hold", () => {
  const rec = (o: Record<string, unknown>) => capRecord.parse({ ...raft(), ...o });
  it("E_CAP_SCHEMA: a range high to low, an activity longer than the door-to-door time", () => {
    expect(homedValueFindings(rec({ duration_min: val([120, 180]), activity_min: val([60, 90]) }))).toEqual([]);
    expect(homedValueFindings(rec({ duration_min: val([180, 120]) })).map((f) => [f.code, f.key])).toEqual([["E_CAP_SCHEMA", "duration_min"]]);
    expect(homedValueFindings(rec({ duration_min: val([60, 90]), activity_min: val([60, 120]) })).map((f) => [f.code, f.key])).toEqual([["E_CAP_SCHEMA", "activity_min"]]);
    // a searched_none activity is not compared
    expect(homedValueFindings(rec({ duration_min: val([60, 90]), activity_min: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-26", tried: ["https://a.example/"] } }))).toEqual([]);
  });
  it("E_CAP_SCHEMA: a closure that ends before it starts, or mixes a yearly date with a calendar date; a winter MM-DD wrap is fine", () => {
    const c = (rows: unknown[]) => homedValueFindings(rec({ closures: val(rows) })).map((f) => f.code);
    expect(c([{ from: "2026-05-01", to: "2026-10-31", status: "closed", why: "x" }])).toEqual([]);
    expect(c([{ from: "12-01", to: "03-31", status: "closed", why: "winter" }])).toEqual([]);
    expect(c([{ from: "2026", to: "2026-06", status: "closed", why: "x" }])).toEqual([]);
    expect(c([{ from: "2026-10-31", to: "2026-05-01", status: "closed", why: "x" }])).toEqual(["E_CAP_SCHEMA"]);
    expect(c([{ from: "05-01", to: "2026-10-31", status: "closed", why: "x" }])).toEqual(["E_CAP_SCHEMA"]);
  });
  it("E_CAP_LINK_ONLY: a booking page on a reseller or OTA", () => {
    expect(homedValueFindings(rec({ book_url: val("https://www.viator.com/tours/Banff/x") })).map((f) => f.code)).toEqual(["E_CAP_LINK_ONLY"]);
    expect(homedValueFindings(rec({ book_url: val("https://www.wildwater.com/book/") }))).toEqual([]);
  });
  it("the provenance rules apply to every homed value: a value with an unknown src fails, searched_none needs on and tried", () => {
    const r = root();
    expect(codes(run(r, [lake(), raft({ book_url: val("https://www.wildwater.com/book/", { basis: "operator_info", src: ["src-0009"] }) })]))).toEqual(["E_CAP_SRC"]);
    expect(codes(run(r, [lake({ groceries: { v: null, state: "searched_none", basis: null, src: [] } })]))).toEqual(["E_CAP_SCHEMA"]);
    expect(codes(run(r, [lake(), raft({ duration_min: val([180, 120]) })]))).toEqual(["E_CAP_SCHEMA"]);
  });
});

describe("applicability and the completeness engine", () => {
  it("W_CAP_NA_FIELD: a homed value on a type that never asks for it (check-in on a lake, a duration on a lake)", () => {
    const r = root();
    const res = run(r, [lake({ check_in_out: val({ check_in: "16:00", check_out: "11:00" }), duration_min: val([60, 90]) })]);
    expect(codes(res)).toEqual([]);
    expect(warnsAt(res, "W_CAP_NA_FIELD").sort()).toEqual(["/records/0/check_in_out", "/records/0/duration_min"]);
    // the experience offer asks for all three: no W_CAP_NA_FIELD
    const ok3 = run(r, [lake(), raft({ duration_min: val([120, 180]), activity_min: val([90, 120]), book_url: val("https://www.wildwater.com/book/") })]);
    expect(warnsAt(ok3, "W_CAP_NA_FIELD")).toEqual([]);
  });
  it("an experience offer that holds duration, activity and booking page no longer lists them as missing; a lodging offer reads check-in", () => {
    const r = scratchRoot({
      "data/suitability/scope.json": scope(["lago-di-braies"]),
      "data/capture/fixture-trip/a.json": capDoc([
        lake(),
        raft({ duration_min: val([120, 180]), activity_min: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-26", tried: ["https://a.example/"] }, book_url: val("https://www.wildwater.com/book/") }),
        raft({ ref: "offer/place/lago-di-braies#raft-2" }),
        hotel({ check_in_out: val({ check_in: "16:00", check_out: "11:00" }) }),
      ]),
    });
    const w = loadWorld(r);
    const miss = (ref: string) => { const c = completeness(w, ref)!; return [...c.missingBase, ...c.conditionalMissing]; };
    const answered = miss("offer/place/lago-di-braies#raft");
    for (const k of ["duration_min", "activity_min", "book_url"]) expect(answered, k).not.toContain(k);
    expect(completeness(w, "offer/place/lago-di-braies#raft")!.soft).toContain("activity_min"); // searched_none is a soft answer
    const bare = miss("offer/place/lago-di-braies#raft-2");
    for (const k of ["duration_min", "activity_min", "book_url"]) expect(bare, k).toContain(k);
    expect(miss("offer/place/lago-di-braies#rooms")).not.toContain("check_in_out");
  });
});
