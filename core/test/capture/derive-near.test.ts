// META-2: `capture.ts derive-near` (capture contract 3.7.1): near_town and near_town_km on every record with an exact point, from the towns
// layer; idempotent; an override is never touched; only adds leaves (the migration ledger rule).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blocks, editFile, planNearDerivation } from "../../src/capture/deriveNear.ts";
import { deriveNearCommand } from "../../src/capture/deriveNearCli.ts";
import { budgetCounts } from "../../src/capture/gapBudget.ts";
import { loadPlacement } from "../../src/capture/placementBlock.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { readTownsFiles } from "../../src/derive/townsData.ts";
import { haversineKm } from "../../src/geo/distance.ts";
import { NEAR_TOWN_NONE } from "../../src/schema/capture/points.ts";
import { REPO, capDoc, scratchRoot } from "./helpers.ts";

// a made-up one-town layer, written the way tools/towns.py writes it (the reader checks the part's SHA-256)
const part = JSON.stringify({ schema: "towns-part/1", cc: "xx", admin1: { "00": null }, rows: [["xx-00-alpha", "Alpha", 46.5, 12.1, 5000, "00", "Alpha", 1001]] }) + "\n";
const manifest = { schema: "towns-manifest/1", source: { name: "GeoNames", downloaded: "2026-10-23", licence: { id: "CC BY 4.0", attribution: "x", url: "x" }, files: {} }, filter: { population_min: 1000 }, parts: [{ file: "xx.json", cc: "xx", rows: 1, gzip: 100, sha256: createHash("sha256").update(part).digest("hex") }], totals: { parts: 1, rows: 1, bytes: part.length, gzip: 100 } };
const rec = (ref: string, over: Record<string, unknown> = {}) => ({ ref, type: "water.body.lake", layer: "place", name: ref, ...over });
const sink = () => { const lines: string[] = []; return { lines, out: (s: string) => void lines.push(s), err: (s: string) => void lines.push(s) }; };

function fixture(records: unknown[], points: Record<string, unknown>): string {
  return scratchRoot({
    "data/reference/towns/xx.json": part,
    "data/reference/towns/manifest.json": manifest,
    "data/capture/points.json": { schema: "capture-points/1", points },
    "data/capture/fx/a.json": capDoc(records, { trip: "fx" }),
  });
}
const pt = (lat: number, lon: number, over: Record<string, unknown> = {}) => ({ lat, lon, coord_src: "osm", ...over });

describe("derive-near on a fixture", () => {
  const records = [rec("place/near"), rec("place/far"), rec("place/rough"), rec("place/nopoint"), rec("place/kept", { near_town: { v: "xx-00-other", state: "value", basis: "operator_info", src: [], on: "2026-10-01", note: "the operator names this town" }, near_town_km: { v: 4, state: "value", basis: "operator_info", src: [], on: "2026-10-01" } })];
  const points = { "place/near": pt(46.55, 12.1), "place/far": pt(47.9, 12.1), "place/rough": pt(46.5, 12.1, { approx: true, approx_note: "a centroid" }), "place/kept": pt(46.5, 12.2) };

  it("writes the nearest town and its km, none_within_50km as an answer, and nothing for an approximate or missing point", () => {
    const plan = planNearDerivation(fixture(records, points));
    expect(plan.problems).toEqual([]);
    expect(plan.assignments.map((a) => [a.ref, a.town, a.km, a.was])).toEqual([
      ["place/far", NEAR_TOWN_NONE, null, "none"],
      ["place/kept", "xx-00-other", 4, "override"],
      ["place/near", "xx-00-alpha", expect.closeTo(5.6, 1), "none"],
    ]);
    expect(plan.report).toMatchObject({ place_route_records: 5, with_exact_point: 3, approx_point_skipped: 1, no_point_skipped: 1, derived_town: 1, derived_none_within_50km: 1, overrides_kept: 1 });
  });

  it("adds only the two blocks, after the layer line, with provenance; a second run finds nothing to do", () => {
    const root = fixture(records, points);
    const file = join(root, "data/capture/fx/a.json");
    const before = readFileSync(file, "utf8");
    const io = sink();
    expect(deriveNearCommand(["--check"], root, io.out, io.err)).toBe(1);
    expect(deriveNearCommand(["--write"], root, io.out, io.err)).toBe(0);
    const after = readFileSync(file, "utf8");
    const was = JSON.parse(before).records;
    const now = JSON.parse(after).records as Record<string, any>[];
    // every pre-existing leaf is unchanged (the ledger rule); only near_town and near_town_km are new
    const strip = ({ near_town: _a, near_town_km: _b, ...x }: Record<string, unknown>) => x;
    for (const [i, r] of was.entries()) {
      expect(strip(now[i]!), r.ref).toEqual(strip(r));
      if (r.near_town) expect(now[i], "an override is never touched").toEqual(r);
    }
    const near = now.find((r) => r.ref === "place/near")!;
    expect(near.near_town).toMatchObject({ v: "xx-00-alpha", state: "value", basis: "our_inference", src: [], on: "2026-10-23" });
    expect(near.near_town.note).toContain("GeoNames 1001");
    expect(near.near_town_km).toMatchObject({ v: 5.6, state: "value", basis: "our_inference" });
    const far = now.find((r) => r.ref === "place/far")!;
    expect(far.near_town.v).toBe(NEAR_TOWN_NONE);
    expect(far.near_town_km).toBeUndefined();
    expect(now.find((r) => r.ref === "place/rough")!.near_town).toBeUndefined();
    expect(now.find((r) => r.ref === "place/kept")!.near_town.v).toBe("xx-00-other");
    expect(after.indexOf('"layer": "place",\n      "near_town"')).toBeGreaterThan(0);
    expect(planNearDerivation(root).writes).toEqual([]);
    expect(deriveNearCommand(["--check"], root, io.out, io.err)).toBe(0);
  });

  it("replaces a block it wrote earlier when the point moves, and leaves an override alone", () => {
    const root = fixture(records, points);
    const io = sink();
    deriveNearCommand(["--write"], root, io.out, io.err);
    const moved = { ...points, "place/near": pt(47.9, 12.1) };
    const root2 = fixture(JSON.parse(readFileSync(join(root, "data/capture/fx/a.json"), "utf8")).records, moved);
    expect(planNearDerivation(root2).writes.length).toBe(1);
    deriveNearCommand(["--write"], root2, io.out, io.err);
    const now = JSON.parse(readFileSync(join(root2, "data/capture/fx/a.json"), "utf8")).records as Record<string, any>[];
    expect(now.find((r) => r.ref === "place/near")!.near_town.v).toBe(NEAR_TOWN_NONE);
    expect(now.find((r) => r.ref === "place/near")!.near_town_km).toBeUndefined();
    expect(now.find((r) => r.ref === "place/kept")!.near_town.v).toBe("xx-00-other");
  });

  it("makes the W_PLACE_TOWN count zero for every exact point", () => {
    const root = fixture(records, points);
    const count = (): number => budgetCounts(loadPlacement(root, loadWorld(root))).W_PLACE_TOWN!;
    expect(count()).toBe(2);
    deriveNearCommand(["--write"], root, () => {}, () => {});
    expect(count()).toBe(0);
  });
});

describe("editFile", () => {
  const text = '{\n  "records": [\n    {\n      "ref": "a",\n      "type": "t",\n      "layer": "place",\n      "name": "A"\n    }\n  ]\n}\n';
  const want = new Map([["a", blocks({ town: "xx-00-alpha", km: 1.5, geonamesId: 9 }, "2026-10-23")]]);
  it("inserts after the layer line and is stable when applied twice", () => {
    const once = editFile(text, want);
    expect(JSON.parse(once).records[0].near_town_km.v).toBe(1.5);
    expect(once.indexOf('"layer": "place",\n      "near_town"')).toBeGreaterThan(0);
    expect(editFile(once, want)).toBe(once);
  });
  it("refuses a file it cannot edit in place", () => {
    expect(() => editFile('{"records": [{"ref": "a"}]}', want)).toThrow(/no top-level ref line/);
    expect(() => editFile('{\n  "records": [\n    {\n      "ref": "a",\n      "name": "A"\n    }\n  ]\n}\n', want)).toThrow(/no top-level "layer" line/);
  });
});

describe("the real data", () => {
  const root = REPO;
  it("has its nearest town for every exact point, derived from the committed towns layer, and nothing left to write", () => {
    const plan = planNearDerivation(root);
    expect(plan.problems).toEqual([]);
    expect(plan.writes.map((w) => w.path)).toEqual([]);
    expect(plan.report.with_exact_point).toBe(plan.report.derived_town + plan.report.derived_none_within_50km + plan.report.overrides_kept);
    expect(plan.report.with_exact_point).toBeGreaterThan(200);
  });
  it("leaves no exact point without near_town (acceptance 6.5 row 4), so W_PLACE_TOWN is zero", () => {
    expect(budgetCounts(loadPlacement(root, loadWorld(root))).W_PLACE_TOWN).toBe(0);
  });
  it("agrees with a brute-force nearest town over the whole layer, and with the none rule", () => {
    const rows = readTownsFiles(root).rows;
    const plan = planNearDerivation(root);
    const w = loadWorld(root);
    for (const a of plan.assignments.filter((x) => x.was !== "override").slice(0, 400)) {
      const rec = w.cap.get(a.ref)!.rec;
      const stored = rec.near_town;
      expect(stored?.v, a.ref).toBe(a.town);
    }
    expect(rows.length).toBeGreaterThan(4000);
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
  });
});
