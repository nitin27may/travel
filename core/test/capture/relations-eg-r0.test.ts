// The EG-R0 review fixes (docs/v2/build/review-eg-c-2026-10-27.md), assigned to PA-C: M1 (two parks over one area do not contain each
// other), S1 (relation target severity by the known list only), S2 (a stale known entry fails the budget check), S4 (a merge loop of
// stages), S5 (part_of the record's own alias), S10 (a repeated target is reported and never counts toward cardinality). The fixtures
// are core/test/fixtures/graph/eg-r0/ (README there).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkBudget, levelOfLink, loadBudget, staleKnown } from "../../src/capture/gapBudget.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { stageChainProblem } from "../../src/validate/capture.ts";
import { validateDoc } from "../../src/validate/index.ts";
import type { CaptureRecord } from "../../src/schema/capture/records.ts";
import { REPO, capDoc, put, scope, scratchRoot } from "./helpers.ts";

const DIR = fileURLToPath(new URL("../fixtures/graph/eg-r0/", import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(join(DIR, name), "utf8")) as { records: Record<string, any>[] } & Record<string, unknown>;
const LANE = "data/capture/graph-fixture/eg-r0.json";

function rootFor(records: Record<string, any>[], budget: Record<string, unknown> = {}): string {
  const slugs = new Set<string>();
  for (const r of records) for (const ref of [r.ref, ...(r.aliases ?? [])]) if (/^place\//.test(ref)) slugs.add(ref.slice(6));
  return scratchRoot({
    "data/suitability/scope.json": scope([...slugs, "moraine-lake"]),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-26", operators: [] },
    "data/locations/locations.json": { countries: [{ code: "ZZ" }], regions: [{ id: "ZZ/S1" }], areas: [{ id: "ZZ/S1/delta", region_id: "ZZ/S1" }], places: [] },
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-26", strict: [], counts: {}, raised: [], pinned: { on: "2026-10-21", note: "", refs: [] }, ...budget },
  });
}
const validate = (root: string, d: unknown) => validateDoc(d, "sidecar", root, { kind: "capture" }, join(root, LANE));
const codes = (list: { code: string }[], re = /^(E|W)_CAP_(REL_|STAGE)/) => [...new Set(list.map((e) => e.code))].filter((c) => re.test(c)).sort();

describe("M1: a record with covers_areas is never an area member of another protected area", () => {
  const f = fixture("two-parks-one-area.json");
  it("two parks covering one area raise no containment loop", () => {
    const res = validate(rootFor(f.records), f);
    expect(res.errors.filter((e) => e.code === "E_CAP_REL_CYCLE"), JSON.stringify(res.errors.map((e) => e.message))).toEqual([]);
    expect(codes(res.errors)).toEqual([]);
  });
  it("real loops still error: an explicit part_of loop, and a park part_of a record that is its area member", () => {
    const explicit = [{ ...f.records[0], part_of: ["place/delta-peace-park"] }, { ...f.records[1], part_of: ["place/delta-national-park"] }];
    expect(codes(validate(rootFor(explicit), capDoc(explicit, { trip: "graph-fixture" })).errors)).toEqual(["E_CAP_REL_CYCLE"]);
    // the reserve has no covers_areas, so it is an area member of the park; the park part_of the reserve closes a loop
    const viaArea = [{ ...f.records[0], part_of: ["place/delta-peace-park"] }, { ...f.records[1], covers_areas: undefined }];
    expect(codes(validate(rootFor(viaArea), capDoc(viaArea, { trip: "graph-fixture" })).errors)).toEqual(["E_CAP_REL_CYCLE"]);
  });
});

describe("S1: relation target severity is decided by the known list only", () => {
  const sev = (pinned: string[], known: string[], strict: string[] = []) => ({ pinned: new Set(pinned), strict: new Set(strict), townsLayer: false, known: new Set(known) });
  it("a pinned record's link that is not known errors; a known link warns; strict errors; a draft warns", () => {
    expect(levelOfLink("E_CAP_REL_TARGET", ["a"], "on", "b", true, sev(["a"], []))).toBe("error");
    expect(levelOfLink("E_CAP_REL_TARGET", ["a"], "on", "b", true, sev([], ["E_CAP_REL_TARGET|a|on|b"]))).toBe("warning");
    expect(levelOfLink("E_CAP_REL_TARGET", ["a"], "on", "b", true, sev([], ["E_CAP_REL_TARGET|a|on|b"], ["E_CAP_REL_TARGET"]))).toBe("error");
    expect(levelOfLink("E_CAP_REL_TARGET", ["a"], "on", "b", false, sev(["a"], []))).toBe("warning");
  });
});

describe("S2: a known entry that matches no live finding fails the budget check", () => {
  const lake = { ref: "place/moraine-lake", type: "water.body.lake", layer: "place", name: "Moraine Lake" };
  const raft = { ref: "offer/place/moraine-lake#raft", type: "water.river.rafting", layer: "offer", name: "Raft", at: ["place/moraine-lake"] };
  const parking = (to: string[]) => ({ ref: "part/place/moraine-lake#parking", type: "access.park.parking", layer: "place", name: "Parking", parks_for: to });
  const fault = { code: "E_CAP_REL_TARGET", ref: "part/place/moraine-lake#parking", rel: "parks_for", target: "offer/place/moraine-lake#raft" };
  const setup = (to: string[]) => {
    const r = rootFor([lake], { known: [fault] });
    put(r, "data/capture/graph-fixture/a.json", capDoc([lake, raft, parking(to)], { trip: "graph-fixture" }));
    return r;
  };
  it("a live fault is not stale", () => {
    const r = setup(["offer/place/moraine-lake#raft"]);
    expect(staleKnown(loadWorld(r), [fault])).toEqual([]);
    expect(checkBudget(r).issues.filter((i) => i.includes("known fault"))).toEqual([]);
  });
  it("a fixed link leaves a stale entry, and the check fails naming it", () => {
    const r = setup(["place/moraine-lake"]);
    expect(staleKnown(loadWorld(r), [fault])).toEqual([fault]);
    const res = checkBudget(r);
    expect(res.ok).toBe(false);
    expect(res.issues.join("\n")).toMatch(/known fault E_CAP_REL_TARGET part\/place\/moraine-lake#parking parks_for -> offer\/place\/moraine-lake#raft matches no live finding/);
  });
  it("every known entry of the shipped budget is live", () => {
    expect(staleKnown(loadWorld(REPO), loadBudget(REPO)?.known ?? [])).toEqual([]);
  });
});

describe("S4: a merge loop of stages is not one chain", () => {
  const f = fixture("merge-loop.json");
  const stages = f.records.filter((r) => String(r.ref).startsWith("part/")) as unknown as CaptureRecord[];
  it("A to B, B to C, C back to B: two stages end where one starts", () => {
    expect(stageChainProblem(stages)).toBe("part/place/merge-trek#stage-2 starts where 2 stages end (part/place/merge-trek#stage-1, part/place/merge-trek#stage-3)");
    const res = validate(rootFor(f.records), f);
    expect(codes(res.warnings)).toEqual(["W_CAP_STAGE_ORDER"]);
  });
  it("A to B, B to C chains", () => {
    expect(stageChainProblem(stages.slice(0, 2))).toBeNull();
  });
});

describe("S5 and S10: aliases and repeated targets", () => {
  const f = fixture("alias-self.json");
  const res = validate(rootFor(f.records), f);
  it("part_of the record's own alias is a self-link", () => {
    const self = res.errors.filter((e) => e.code === "E_CAP_REL_REF");
    expect(self.map((e) => e.path)).toEqual(["/records/1/part_of"]);
    expect(self[0]!.message).toMatch(/place\/alias-lake-old is its own alias/);
  });
  it("one park named three times (once by alias) is one parent: a W_CAP_REL_DUP, never W_CAP_REL_PARENTS", () => {
    expect(res.warnings.filter((e) => e.code === "W_CAP_REL_DUP").map((e) => e.path)).toEqual(["/records/2/part_of"]);
    expect(res.warnings.filter((e) => e.code === "W_CAP_REL_PARENTS")).toEqual([]);
  });
  it("three different parents still warn W_CAP_REL_PARENTS", () => {
    const parks = ["a", "b", "c"].map((s) => ({ ref: `place/park-${s}`, type: "nature.protected.state_provincial_park", layer: "place", name: s }));
    const pond = { ref: "place/pond", type: "water.body.lake", layer: "place", name: "Pond", part_of: parks.map((p) => p.ref) };
    const r = validate(rootFor([...parks, pond]), capDoc([...parks, pond], { trip: "graph-fixture" }));
    expect(codes(r.warnings)).toEqual(["W_CAP_REL_PARENTS"]);
  });
});
