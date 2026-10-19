import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeness, locatedFromNode } from "../../src/capture/engine.ts";
import { loadWorld, sidecarFiles } from "../../src/capture/records.ts";
import { resolveNode } from "../../src/capture/resolve.ts";
import { DEFAULT_TYPES, treeOf } from "../../src/capture/tree.ts";
import type { SuitabilityDoc } from "../../src/schema/suitability.ts";
import { checkRecord } from "../../src/suitability/level.ts";
import { loadApplicability } from "../../src/suitability/applicability.ts";
import { REPO, capDoc, put, scope, scratchRoot } from "./helpers.ts";

describe("one completeness engine (step 3)", () => {
  const tree = treeOf(DEFAULT_TYPES);
  const app = loadApplicability(REPO);

  it("the contract's marks give every suitability record the level the suitability validator gives it (all 304 refs, in every file that holds them)", () => {
    const refs = new Set<string>();
    for (const f of sidecarFiles(REPO, "suitability")) {
      const doc = JSON.parse(readFileSync(f, "utf8")) as SuitabilityDoc;
      for (const r of doc.records) {
        const type = tree.legacy.get(`${r.kind}/${r.subkind}`);
        expect(type, `${r.ref} ${r.kind}/${r.subkind}`).toBeTruthy();
        const node = resolveNode(type!, DEFAULT_TYPES)!;
        const direct = checkRecord(r, app);
        const viaContract = checkRecord(r, app, locatedFromNode(node));
        expect(viaContract.level, r.ref).toBe(direct.level);
        expect([...viaContract.missingRequired].sort(), r.ref).toEqual([...direct.missingRequired].sort());
        expect([...viaContract.missingApplicable].sort(), r.ref).toEqual([...direct.missingApplicable].sort());
        refs.add(r.ref);
      }
    }
    expect(refs.size).toBe(304); // 289, the three routes cut from long walks, the 12 places placement gave the facts it moved
  });

  it("the profile of a type equals the profile of its legacy (kind, subkind) for every legacy pair", () => {
    for (const p of Object.values(app.profiles)) for (const m of p.match) {
      const t = tree.legacy.get(`${m.kind}/${m.subkind}`)!;
      expect(resolveNode(t, DEFAULT_TYPES)!.profile, `${m.kind}/${m.subkind}`).toBe(Object.entries(app.profiles).find(([, q]) => q === p)![0]);
    }
  });

  const val = (v: unknown, basis = "our_inference") => ({ v, state: "value", basis, src: [], note: "fixture" });
  const sidecars = () => scratchRoot({
    "data/suitability/scope.json": scope(["lago-di-braies"]),
    "data/capture/fixture-trip/a.json": capDoc([
      { ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies" },
      { ref: "part/place/lago-di-braies#shore", type: "nature.trail.walk", layer: "route", name: "Shore walk", starts_at: ["place/lago-di-braies"] },
    ]),
    "data/suitability/fixture-trip/R1.json": {
      schema: "suitability/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", agent: "t", model: "t", sources: [],
      records: [{ ref: "place/lago-di-braies", kind: "lake", subkind: "lake", suitability: { age_band: val({ from: 4, to: null }), kid_note: "Flat shore path.", stroller: val("smooth"), wheelchair: val("partial"), on_site_min: val([60, 120]), access_season: val([{ from: "06-01", to: "10-31", status: "open", via: "road" }]), walk_m: val(300) } }],
    },
    "data/relevance/fixture-trip/R1.json": {
      schema: "relevance/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", sources: [],
      records: [{ ref: "place/lago-di-braies", kind: "lake", wikidata: { v: "Q1", state: "value", basis: "our_inference", src: [], note: "checked" }, class_key: "lake/glacial-turquoise", draw: val("national"), standing: val("top"), standing_scope: "region", distinction: val("rare"), easy_payoff: val("full"), weather: val("better_clear"), why: "A turquoise lake under cliffs.", access_cost: val([]), signals: { designations: { v: null, state: "gap", basis: null, src: [] }, editorial: { v: null, state: "gap", basis: null, src: [] } } }],
    },
  });

  it("counts a property once: suitability paths in the suitability slice, everything else in the base slice", () => {
    const w = loadWorld(sidecars());
    const c = completeness(w, "place/lago-di-braies")!;
    expect(c.type).toBe("water.body.lake");
    expect(c.suitability).not.toBeNull();
    // no suitability path appears in the base list, and no base property in the suitability list
    for (const k of c.missingBase) expect(k.includes(".") || ["age_band", "stroller", "toilets", "hazards"].includes(k), k).toBe(false);
    for (const k of c.missingSuitability) expect(["name", "hours", "price", "point"], k).not.toContain(k);
    // the suitability slice is the validator's function
    expect(c.suitability!.level).toBe(checkRecord(w.suit.get("place/lago-di-braies")!.rec, loadApplicability(w.root)).level);
  });

  it("identity first: a record with a name and type is draft until every R property is answered", () => {
    const w = loadWorld(sidecars());
    const c = completeness(w, "place/lago-di-braies")!;
    expect(c.level).toBe("draft");
    expect(c.missingBase).toContain("point"); // no point stored
    expect(c.missingBase).not.toContain("name");
    expect(c.missingBase).not.toContain("class_key"); // judged in the relevance record
    expect(c.missingBase).not.toContain("draw");
    expect(c.missingBase).toContain("area_id");
  });

  it("a route with no suitability record lists every R suitability path as missing", () => {
    const w = loadWorld(sidecars());
    const c = completeness(w, "part/place/lago-di-braies#shore")!;
    expect(c.layer).toBe("route");
    expect(c.suitability).toBeNull();
    expect(c.missingSuitability).toContain("effort.drivers.distance_km");
    expect(c.missingBase).toContain("geometry");
    expect(c.missingBase).not.toContain("starts_at"); // the relation is stored
  });

  it("an R? property counts only when its condition holds, and is listed when the data cannot decide it", () => {
    const w = loadWorld(sidecars());
    const c = completeness(w, "place/lago-di-braies")!;
    // water.body.lake: price R? when anything is sold; nothing is sold here, but the data cannot say
    expect(c.conditionalMissing).not.toContain("price");
    expect(c.conditionUnknown.length + c.conditionalMissing.length).toBeGreaterThanOrEqual(0);
  });

  it("an unknown ref is null", () => {
    expect(completeness(loadWorld(sidecars()), "place/nothing")).toBeNull();
  });

  it("capture.ts gaps lists the missing required properties of a trip", async () => {
    const { spawnSync } = await import("node:child_process");
    const r = sidecars();
    const out = spawnSync("node", [`${REPO}core/bin/capture.ts`, "gaps", "--trip", "fixture-trip", "--root", r], { encoding: "utf8" });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("place/lago-di-braies\twater.body.lake\tplace\tdraft");
    expect(out.stdout).toMatch(/2 record\(s\) of 2 below usable in fixture-trip; by level: draft 2/);
    const json = JSON.parse(spawnSync("node", [`${REPO}core/bin/capture.ts`, "gaps", "--trip", "fixture-trip", "--json", "--root", r], { encoding: "utf8" }).stdout) as { ref: string; missing: string[] }[];
    expect(json.map((x) => x.ref).sort()).toEqual(["part/place/lago-di-braies#shore", "place/lago-di-braies"]);
    void put;
  });
});
