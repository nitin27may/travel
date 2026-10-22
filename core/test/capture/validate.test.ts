import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAP_ERROR_LIST, CAP_WARNING_LIST, allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";
import { REPO, capDoc, put, scope, scratchRoot } from "./helpers.ts";

const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const warns = (r: { warnings: { code: string }[] }) => [...new Set(r.warnings.map((e) => e.code))].sort();

/** a scratch repository with a scope that resolves two places, an operator and a trail */
function root(extra: Record<string, unknown> = {}): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(["lago-di-braies", "moraine-lake", "banff-gondola"], [{ ref: "trip/fixture-trip/trail:larch valley", name: "Larch Valley", trip: "fixture-trip" }]),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-18", operators: [{ ref: "operator/wild-water", name: "Wild Water Adventures", url: "https://www.wildwater.com/" }] },
    ...extra,
  });
}
const run = (r: string, doc: unknown, kind = "capture") => validateDoc(doc, "sidecar", r, { kind: kind as never });
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies", ...over });

describe("registration and detection", () => {
  it("detects capture sidecars, the types file, operators and run records by path and by schema id", () => {
    expect(detect(join(REPO, "data/capture/dolomites-2027/migrated.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "capture" });
    expect(detect(join(REPO, "data/vocab/types.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "capture-types" });
    expect(detect(join(REPO, "data/capture/operators.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "capture-operators" });
    expect(detect(join(REPO, "data/capture/runs/a.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "capture-run" });
    expect(detect(null, { schema: "capture/1" }, REPO)?.kind).toBe("capture");
    expect(detect(null, { schema: "capture-run/1" }, REPO)?.kind).toBe("capture-run");
  });
  it("--all takes the capture sidecars and the types file, and leaves splits and the type map out", () => {
    const r = root({ "data/capture/fixture-trip/a.json": capDoc([lake()]), "data/capture/splits/fixture-trip.json": {}, "data/capture/type-map.json": {}, "data/capture/runs/r.json": {} });
    const files = allFiles(r).map((f) => f.slice(r.length + 1));
    expect(files).toContain("data/vocab/types.json");
    expect(files).toContain("data/capture/operators.json");
    expect(files).toContain("data/capture/fixture-trip/a.json");
    expect(files).toContain("data/capture/runs/r.json");
    expect(files.some((f) => f.includes("data/capture/splits/") || f.endsWith("type-map.json"))).toBe(false);
  });
  it("keeps the capture codes apart from the structural ones, each with a case below", () => {
    expect(CAP_ERROR_LIST.every((c) => c.startsWith("E_CAP_"))).toBe(true);
    expect(CAP_WARNING_LIST.every((c) => c.startsWith("W_CAP_"))).toBe(true);
  });
});

describe("data/vocab/types.json", () => {
  it("the shipped file is valid", () => {
    const r = validateFile(join(REPO, "data/vocab/types.json"), REPO);
    expect(r.errors, JSON.stringify(r.errors.slice(0, 3))).toEqual([]);
  });
  const mutate = (fn: (t: { nodes: { id: string; parent: string | null; marks?: Record<string, string>; profile?: string; relevance_class?: string[]; effort?: { scales: string[] } }[]; profiles: Record<string, { fields: Record<string, string> }> }) => void) => {
    const t = JSON.parse(readFileSync(join(REPO, "data/vocab/types.json"), "utf8"));
    fn(t);
    return validateDoc(t, "sidecar", REPO, { kind: "capture-types" });
  };
  it("E_CAP_TREE: a duplicate id, a missing parent, an unknown mark key, an unknown profile, an unknown relevance class", () => {
    expect(codes(mutate((t) => void t.nodes.push({ ...t.nodes[20]! })))).toEqual(["E_CAP_TREE"]);
    expect(codes(mutate((t) => void (t.nodes[20]!.parent = "nope.nothing")))).toEqual(["E_CAP_TREE"]);
    expect(codes(mutate((t) => void (t.nodes[20]!.marks = { not_a_property: "R" })))).toEqual(["E_CAP_TREE"]);
    expect(codes(mutate((t) => void (t.nodes[20]!.profile = "no_such_profile")))).toContain("E_CAP_TREE");
    expect(codes(mutate((t) => void (t.nodes[20]!.relevance_class = ["lake/not-a-class"])))).toEqual(["E_CAP_TREE"]);
    expect(codes(mutate((t) => void (t.nodes[20]!.effort = { scales: ["no-such-scale"] })))).toContain("E_CAP_SCHEMA");
  });
  it("E_CAP_PROFILE: a profile row that breaks the applicability rules", () => {
    const r = mutate((t) => void delete t.profiles.hike!.fields["ext.trail.shape"]);
    expect(r.errors.length).toBe(0); // a missing cell is N, which is explicit in the generated file
    const r2 = mutate((t) => void (t.profiles.hike!.fields["ext.zip.braking"] = "R"));
    expect(codes(r2)).toEqual(["E_CAP_PROFILE"]);
  });
  it("E_CAP_SCHEMA: a structural fault", () => {
    expect(codes(mutate((t) => void ((t as unknown as { schema: string }).schema = "capture-types/2")))).toContain("E_CAP_SCHEMA");
  });
});

describe("capture/1 sidecars (step 3)", () => {
  it("a record with a name, a type and a layer is valid; ref forms part/ and offer/ resolve through their parent", () => {
    const r = root();
    const doc = capDoc([lake(), { ref: "part/place/lago-di-braies#shore", type: "nature.trail.walk", layer: "route", name: "Shore walk", starts_at: ["place/lago-di-braies"] }, { ref: "offer/place/lago-di-braies#rowing", type: "water.boat.boat_rental.rowboat", layer: "offer", name: "Rowing boats", at: ["place/lago-di-braies"] }]);
    const res = run(r, doc);
    expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
  });
  it("E_CAP_REF and E_CAP_DUP_REF", () => {
    const r = root();
    expect(codes(run(r, capDoc([lake({ ref: "place/nowhere" })])))).toEqual(["E_CAP_REF"]);
    expect(codes(run(r, capDoc([lake(), lake()])))).toEqual(["E_CAP_DUP_REF"]);
  });
  it("E_CAP_TYPE: an unknown type, a category instead of a type, a type that contradicts the suitability record", () => {
    const r = root();
    expect(codes(run(r, capDoc([lake({ type: "water.nothing.here" })])))).toEqual(["E_CAP_TYPE"]);
    expect(codes(run(r, capDoc([lake({ type: "water.body" })])))).toEqual(["E_CAP_TYPE"]);
    put(r, "data/suitability/fixture-trip/R1.json", { schema: "suitability/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", agent: "t", model: "t", sources: [], records: [{ ref: "place/lago-di-braies", kind: "lake", subkind: "lake", suitability: {} }] });
    expect(codes(run(r, capDoc([lake({ type: "culture.museum.museum" })])))).toEqual(["E_CAP_TYPE"]);
    expect(codes(run(r, capDoc([lake()])))).toEqual([]);
  });
  it("E_CAP_LAYER: the layer must be one the type allows", () => {
    const r = root();
    expect(codes(run(r, capDoc([lake({ layer: "offer" })])))).toEqual(["E_CAP_LAYER"]);
    expect(codes(run(r, capDoc([lake({ layer: "route" })])))).toEqual(["E_CAP_LAYER"]);
  });
  it("E_CAP_REL_REF, E_CAP_REL_KIND and E_CAP_REL_DERIVED", () => {
    const r = root();
    expect(codes(run(r, capDoc([lake({ part_of: ["place/nowhere"] })])))).toEqual(["E_CAP_REL_REF"]);
    expect(codes(run(r, capDoc([lake({ part_of: ["place/lago-di-braies"] })])))).toEqual(["E_CAP_REL_REF"]);
    expect(codes(run(r, capDoc([lake({ reaches: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_KIND"]);
    expect(codes(run(r, capDoc([lake({ reached_by: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_DERIVED"]);
    expect(codes(run(r, capDoc([lake({ part_of: ["place/moraine-lake"] })])))).toEqual([]);
  });
  it("E_CAP_OPERATOR: run_by must be a record of data/capture/operators.json", () => {
    const r = root();
    const offer = { ref: "offer/place/lago-di-braies#rowing", type: "water.boat.boat_rental.rowboat", layer: "offer", at: ["place/lago-di-braies"] };
    expect(codes(run(r, capDoc([{ ...offer, run_by: "operator/nobody" }])))).toEqual(["E_CAP_OPERATOR"]);
    expect(codes(run(r, capDoc([{ ...offer, run_by: "operator/wild-water" }])))).toEqual([]);
  });
  it("E_CAP_SRC, E_CAP_METHOD and E_CAP_LINK_ONLY", () => {
    const r = root();
    const val = (src: string[]) => ({ v: [{ from: "06-01", to: "09-30", status: "open" }], state: "value", basis: "operator_info", src });
    expect(codes(run(r, capDoc([lake({ season: val(["src-0001"]) })])))).toEqual(["E_CAP_SRC"]);
    const src = (over: Record<string, unknown>) => ({ id: "src-0001", url: "https://www.wildwater.com/", title: "t", publisher: "Wild Water", kind: "operator", read: "2026-10-18", ...over });
    expect(codes(run(r, capDoc([lake({ season: val(["src-0001"]) })], { sources: [src({})] })))).toEqual([]);
    expect(codes(run(r, capDoc([lake()], { sources: [src({ method: "crawl" })] })))).toEqual(["E_CAP_METHOD"]);
    expect(codes(run(r, capDoc([lake()], { sources: [src({ method: "read", run: "crawl-1" })] })))).toEqual(["E_CAP_METHOD"]);
    expect(codes(run(r, capDoc([lake()], { sources: [src({ method: "crawl", run: "crawl-1" })] })))).toEqual([]);
    expect(codes(run(r, capDoc([lake()], { sources: [src({ url: "https://www.alltrails.com/trail/x" })] })))).toEqual(["E_CAP_LINK_ONLY"]);
    expect(codes(run(r, capDoc([lake({ links: [{ kind: "official", url: "https://www.google.com/maps/x", state: "filled" }] })])))).toEqual(["E_CAP_LINK_ONLY"]);
  });
  it("E_CAP_SCHEMA: an unknown field, and a value state that contradicts its v", () => {
    const r = root();
    expect(codes(run(r, capDoc([lake({ colour: "blue" })])))).toEqual(["E_CAP_SCHEMA"]);
    expect(codes(run(r, capDoc([lake({ season: { v: null, state: "value", basis: "operator_info", src: [] } })])))).toEqual(["E_CAP_SCHEMA", "E_CAP_SRC"]);
    expect(codes(run(r, capDoc([lake({ links: [{ kind: "google-maps", state: "filled" }] })])))).toEqual(["E_CAP_SCHEMA"]);
  });
  it("W_CAP_NA_FIELD: a value the type never asks for", () => {
    const r = root();
    const season = { v: [{ from: "06-01", to: "09-30", status: "open" }], state: "value", basis: "our_inference", note: "fixture", src: [] };
    const res = run(r, capDoc([{ ref: "part/place/lago-di-braies#shore", type: "nature.trail.walk", layer: "route", season }]));
    expect(codes(res)).toEqual([]);
    expect(warns(res)).toContain("W_CAP_NA_FIELD");
  });
  it("W_CAP_BELOW_USABLE: the completeness engine names the required properties no value answers; a complete-enough record has none", () => {
    const r = root();
    const res = run(r, capDoc([lake()]));
    // the placement and tier codes (placement-block.test.ts) also warn on this bare record; the capture block has one warning
    expect(warns(res).filter((c) => c.startsWith("W_CAP_"))).toEqual(["W_CAP_BELOW_USABLE"]);
    const below = res.warnings.find((w) => w.code === "W_CAP_BELOW_USABLE")!;
    expect(below.message).toMatch(/water\.body\.lake \(place\) is draft: \d+ required propert/);
    expect(below.message).toContain("capture.ts fields --ref place/lago-di-braies");
  });
});

describe("operators and run records", () => {
  it("E_CAP_OPERATORS: a duplicate ref; E_CAP_LINK_ONLY: a link-only URL", () => {
    const r = root();
    const op = { ref: "operator/a", name: "A", url: "https://a.example/" };
    expect(codes(run(r, { schema: "capture-operators/1", updated: "2026-10-18", operators: [op, op] }, "capture-operators"))).toEqual(["E_CAP_OPERATORS"]);
    expect(codes(run(r, { schema: "capture-operators/1", updated: "2026-10-18", operators: [{ ...op, url: "https://www.tripadvisor.com/x" }] }, "capture-operators"))).toEqual(["E_CAP_LINK_ONLY"]);
  });
  const runDoc = (over: Record<string, unknown> = {}) => ({
    schema: "capture-run/1", run: "crawl-2026-10-21-ontario-parks", started: "2026-10-21", agent: "travel-researcher", model: "opus",
    scope: { types: ["nature.protected.state_provincial_park"], refs: ["place/lago-di-braies"] },
    hosts: [{ host: "www.ontarioparks.ca", requests: 14, robots: "allowed", terms: "allowed", status: "ok" }, { host: "reservations.ontarioparks.ca", requests: 0, robots: "allowed", terms: "forbidden", status: "blocked" }],
    results: [
      { ref: "place/lago-di-braies", field: "hours", outcome: "filled", src: "src-0012" },
      { ref: "place/lago-di-braies", field: "toilets", outcome: "searched_none", tried: ["https://www.ontarioparks.ca/park/algonquin/facilities"] },
      { ref: "place/lago-di-braies", field: "window", outcome: "blocked", host: "reservations.ontarioparks.ca", reason: "terms" },
      { ref: "place/lago-di-braies", field: "price", outcome: "conflict", src: ["src-0012", "src-0013"] },
    ],
    ...over,
  });
  it("the run record of the spec (9.6) is valid", () => {
    const res = run(root(), runDoc(), "capture-run");
    expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
  });
  it("E_CAP_RUN: a field that is not a property, a blocked result with no reason, a searched_none with nothing tried, a ref outside the scope, a forbidden host crawled", () => {
    const r = root();
    const withResult = (x: Record<string, unknown>) => runDoc({ results: [{ ref: "place/lago-di-braies", ...x }] });
    expect(codes(run(r, withResult({ field: "nope", outcome: "gap" }), "capture-run"))).toEqual(["E_CAP_RUN"]);
    expect(codes(run(r, withResult({ field: "window", outcome: "blocked" }), "capture-run"))).toEqual(["E_CAP_RUN"]);
    expect(codes(run(r, withResult({ field: "toilets", outcome: "searched_none" }), "capture-run"))).toEqual(["E_CAP_RUN"]);
    expect(codes(run(r, runDoc({ results: [{ ref: "place/moraine-lake", field: "hours", outcome: "gap" }] }), "capture-run"))).toEqual(["E_CAP_RUN"]);
    expect(codes(run(r, runDoc({ hosts: [{ host: "x.example", requests: 3, robots: "forbidden", terms: "allowed", status: "ok" }] }), "capture-run"))).toEqual(["E_CAP_RUN"]);
  });
  it("capture.ts run --check validates a file", async () => {
    const { spawnSync } = await import("node:child_process");
    const r = root();
    put(r, "data/capture/runs/a.json", runDoc());
    const ok = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "run", "--check", join(r, "data/capture/runs/a.json"), "--root", r], { encoding: "utf8" });
    expect(ok.stdout).toContain("OK");
    put(r, "data/capture/runs/b.json", runDoc({ results: [{ ref: "place/lago-di-braies", field: "nope", outcome: "gap" }] }));
    const bad = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "run", "--check", join(r, "data/capture/runs/b.json"), "--root", r], { encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("E_CAP_RUN");
  });
});

describe("where draw lives (relevance 3.7)", () => {
  const rel = (ref: string) => ({
    schema: "relevance/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", sources: [],
    records: [{ ref, kind: "trail", wikidata: { v: null, state: "gap", basis: null, src: [] }, class_key: "trail/alpine-loop", draw: { v: "regional", state: "value", basis: "our_inference", src: [], note: "x" }, why: "A loop.", standing_scope: "x", standing: { v: "top", state: "value", basis: "our_inference", src: [], note: "x" }, distinction: { v: "rare", state: "value", basis: "our_inference", src: [], note: "x" }, easy_payoff: { v: "part", state: "value", basis: "our_inference", src: [], note: "x" }, weather: { v: "any_weather", state: "value", basis: "our_inference", src: [], note: "x" }, access_cost: { v: [], state: "value", basis: "our_inference", src: [], note: "x" }, signals: { designations: { v: null, state: "gap", basis: null, src: [] }, editorial: { v: null, state: "gap", basis: null, src: [] } } }],
  });
  const walk = (over: Record<string, unknown> = {}) => ({ ref: "place/moraine-lake", type: "nature.trail.hike", layer: "route", name: "Loop", ...over });
  it("E_CAP_DRAW_LAYER: a route with draw needs route_is_attraction and a reason; the flag is only for routes", () => {
    const r = root({ "data/relevance/fixture-trip/R1.json": rel("place/moraine-lake") });
    expect(codes(run(r, capDoc([walk()])))).toEqual(["E_CAP_DRAW_LAYER"]);
    expect(codes(run(r, capDoc([walk({ route_is_attraction: true })])))).toEqual(["E_CAP_DRAW_LAYER"]);
    expect(codes(run(r, capDoc([walk({ route_is_attraction: true, attraction_reason: "The loop is the experience." })])))).toEqual([]);
    expect(codes(run(r, capDoc([lake({ route_is_attraction: true, attraction_reason: "x" })])))).toEqual(["E_CAP_DRAW_LAYER"]);
  });
  it("a route whose judgement sits on the place it reaches needs no flag", () => {
    const r = root();
    expect(codes(run(r, capDoc([walk({ reaches: ["place/lago-di-braies"] })])))).toEqual([]);
  });
});
