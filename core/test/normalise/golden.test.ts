// A golden test on a small copy of real data (RIS-N): the files in fixtures/golden are slices of today's lane files (8 of the 185
// points with 4 of the ledger's pinned refs, two split records and a priced offer from the Rockies capture lane, the Sarrail
// suitability record, the Switzerland season file whole, one window, one strategy and one swap). They are frozen copies, so the
// test keeps its meaning after RIS-J has normalised the real files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyReport, planNormalise } from "../../src/normalise/run.ts";
import { capturePointsFile } from "../../src/schema/capture/points.ts";
import { rowMeta } from "../../src/schema/rowMeta.ts";
import { keepFindings } from "../../src/validate/keep.ts";
import { FIX, copyFixture, tmpRoot } from "./helpers.ts";

const root = tmpRoot();
copyFixture(root, "capture-lane.json", "data/capture/canadian-rockies-2029/migrated.json");
copyFixture(root, "points.json", "data/capture/points.json");
copyFixture(root, "migration-ledger.json", "data/capture/migration-ledger.json");
copyFixture(root, "season-switzerland-2027.json", "data/seasons/switzerland-2027.json");
copyFixture(root, "windows-first.json", "data/windows/canadian-rockies-2029.json");
copyFixture(root, "base-plans-first.json", "data/base-plans/canadian-rockies-2029.json");
copyFixture(root, "suitability-estimate.json", "data/suitability/canadian-rockies-2029/R2a.json");

const report = planNormalise({ root, placement: false });
const file = (rel: string) => report.files.find((f) => f.file === rel)!;
const out = (rel: string) => JSON.parse(file(rel).after);
const fixture = (name: string) => readFileSync(join(FIX, name), "utf8");

describe("golden: counts on the frozen slices", () => {
  it("reports exactly these changes per family", () => {
    const c = (f: keyof typeof report.families) => report.families[f].changes;
    expect(c("points")).toEqual({ points_schema: 1, point_src: 8 });
    expect(c("capture")).toEqual({ origin: 2, price_year: 1, meta: 3 });
    expect(c("suitability")).toEqual({ estimate: 1, meta: 1 });
    expect(c("windows")).toEqual({ basis: 11, meta: 1 });
    expect(c("base-plans")).toEqual({ basis: 7, method: 4, meta: 1 });
    expect(c("seasons")).toEqual({ basis: 14, season_shape: 6, method: 1, meta: 1 });
  });

  it("finds no error: every finding is a review item", () => {
    expect(report.totals.errors).toBe(0);
    const codes = new Set(report.files.flatMap((f) => f.findings.map((x) => x.code)));
    expect([...codes].sort()).toEqual(["I_NORM_CONFLICT_KEPT", "W_KEEP_UNREAD", "W_QUOTE_LONG"]);
  });
});

describe("golden: points", () => {
  const points = out("data/capture/points.json");

  it("the file is capture-points/2 and parses", () => {
    expect(points.schema).toBe("capture-points/2");
    expect(capturePointsFile.safeParse(points).success).toBe(true);
    expect(Object.keys(points.points)).toHaveLength(8);
  });

  it("every ledger-pinned ref keeps its old string in point_src.legacy, and no other row does unless the text was too long", () => {
    const ledger = JSON.parse(fixture("migration-ledger.json")) as { points: Record<string, unknown> };
    const old = JSON.parse(fixture("points.json")) as { points: Record<string, { point_source: string }> };
    expect(Object.keys(ledger.points)).toHaveLength(4);
    for (const [ref, row] of Object.entries<any>(points.points)) {
      if (ledger.points[ref]) expect(row.point_src.legacy, ref).toBe(old.points[ref]!.point_source);
      else if (row.point_src.legacy !== undefined) expect(row.point_src.quote, ref).toBeUndefined();
    }
  });

  it("coordinates, roles and approximate flags are byte-for-byte what they were", () => {
    const old = JSON.parse(fixture("points.json")) as { points: Record<string, any> };
    for (const [ref, row] of Object.entries<any>(points.points)) {
      for (const k of ["lat", "lon", "coord_src", "point_role", "approx", "approx_note"]) expect(row[k], `${ref} ${k}`).toEqual(old.points[ref][k]);
    }
  });

  it("every meta block passes RowMeta and the keep pass", () => {
    for (const row of Object.values<any>(points.points)) expect(rowMeta.safeParse(row.meta).success).toBe(true);
    expect(keepFindings(points, null).filter((f) => !f.warning)).toEqual([]);
  });

  it("an official row keeps its URL; a row with a lane keeps it as the run id", () => {
    const skaf = points.points["trip/iceland-ring-road-2027/trail:skaftafell svartifoss"];
    expect(skaf.point_src.provider).toBe("Vatnajokull National Park");
    expect(skaf.point_src.url).toContain("vatnajokulsthjodgardur.is");
    expect(skaf.meta.run_id).toBe("DATA-D1b");
  });
});

describe("golden: capture, suitability and the trip-level files", () => {
  it("the capture lane: origin moved, price year added, the Python float untouched", () => {
    const text = file("data/capture/canadian-rockies-2029/migrated.json").after;
    expect(text).toContain('"amount": 0.0,');
    const lane = out("data/capture/canadian-rockies-2029/migrated.json");
    for (const r of lane.records.slice(0, 2)) {
      expect(r.origin).toBeUndefined();
      expect(r.meta.origin.from).toMatch(/^legacy\//);
      expect(rowMeta.safeParse(r.meta).success).toBe(true);
    }
    expect(lane.records[2].price.applies_to).toBe("2026");
    expect(keepFindings(lane, null).filter((f) => !f.warning)).toEqual([]);
  });

  it("the Sarrail estimate is flagged", () => {
    const rec = out("data/suitability/canadian-rockies-2029/R2a.json").records[0];
    const flagged: string[] = [];
    const walk = (x: any, p: string): void => {
      if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${p}/${i}`));
      else if (x && typeof x === "object") {
        if (x.estimate === true) flagged.push(p);
        for (const [k, y] of Object.entries(x)) walk(y, `${p}/${k}`);
      }
    };
    walk(rec, "");
    expect(flagged).toEqual(["/suitability/effort/drivers/distance_km"]);
  });

  it("the season file is Vals now and every claim's basis is a SUIT_BASIS value", () => {
    const s = out("data/seasons/switzerland-2027.json");
    expect(s.season.months).toMatchObject({ v: [7, 8], state: "value", basis: "our_inference" });
    const bases = new Set<string>();
    const walk = (x: any): void => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === "object") {
        if (typeof x.basis === "string") bases.add(x.basis);
        Object.values(x).forEach(walk);
      }
    };
    for (const f of ["data/seasons/switzerland-2027.json", "data/windows/canadian-rockies-2029.json", "data/base-plans/canadian-rockies-2029.json"]) walk(out(f));
    expect([...bases].every((b) => ["official_info", "official_rule", "operator_info", "operator_rule", "our_inference"].includes(b))).toBe(true);
  });
});

describe("golden: write, check, write again", () => {
  it("--write then a fresh plan has nothing left; a second write is a no-op", () => {
    const written = applyReport(report, { placement: false });
    expect(written.length).toBe(report.files.filter((f) => f.after !== f.before).length);
    const again = planNormalise({ root, placement: false });
    expect(again.totals.changedFiles).toBe(0);
    expect(again.totals.changes).toBe(0);
    expect(applyReport(again, { placement: false })).toEqual([]);
    for (const f of again.files) expect(f.after).toBe(f.before);
  });
});
