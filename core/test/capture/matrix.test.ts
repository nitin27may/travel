// PM-G: the property matrix and its rules K1 to K12 (property-display-matrix 10). One passing and one failing fixture per check, the
// allow list that only shrinks, and the build --check wiring.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDrift, generate, writeAll } from "../../src/capture/generate.ts";
import type { AllowFile, Freshness, MatrixInputs, RawMark, TypeMarks } from "../../src/capture/matrix.ts";
import { ALLOWABLE, buildMatrix, checkExposure, checkK3, checkK4, checkK5, checkK6, checkK7, checkK8, checkK9, checkK12, judge, loadAllow, loadMatrixInputs, matrixProblems } from "../../src/capture/matrix.ts";
import { DEFAULT_TYPES } from "../../src/capture/tree.ts";
import { PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import type { PropertyDef } from "../../src/schema/capture/properties.ts";
import { PLACE_ROW_KEYS } from "../../src/schema/api/place.ts";
import { REPO, put, scratchRoot } from "./helpers.ts";

/** The allow list may only shrink: lower this number in the change that removes entries (FA-4 takes it to 0). */
const ALLOW_CEILING = 41;

/**
 * The allowed ids, frozen. The list may only shrink: a new id, or a swap (one entry dropped, another added), fails here even when the
 * count still fits the ceiling. To remove an entry, fix the property, delete its entry from the allow json AND its id from this set
 * in the same commit, then lower ALLOW_CEILING to the set's size. Never add an id.
 */
const PINNED_ALLOWED: ReadonlySet<string> = new Set([
  "K3 cost_band",
  "K4 covered_by",
  "K4 entry",
  "K4 ext.wildlife.stay_in_vehicle",
  "K4 water_safety.lifejacket",
  "K5 effort.drivers.distance_km",
  "K5 effort.drivers.gain_m",
  "K5 season",
  "K6 adult_required",
  "K6 capacity",
  "K6 child_time_min",
  "K6 ext.cave.air_temp_c",
  "K6 ext.cave.tour_m",
  "K6 ext.coaster.driver_rule",
  "K6 ext.coaster.max_load_kg",
  "K6 ext.drive.drive_min",
  "K6 ext.drive.fuel_gap_km",
  "K6 ext.ferrata.approach_min",
  "K6 ext.flight.flight_min",
  "K6 ext.flight.takeoff_run_m",
  "K6 ext.glacier.ice_min",
  "K6 ext.jump.height_m",
  "K6 ext.lift.ride_min",
  "K6 ext.paddle.on_water_min",
  "K6 ext.snow.ski_school_min_age",
  "K6 ext.wildlife.min_distance_m",
  "K6 ext.zip.tandem_under_kg",
  "K6 group_min",
  "K6 participation.driver",
  "K6 solo",
  "K6 water_safety.water_temp_c",
  "K9 access.pass:serves",
  "K9 animals.ride:part_of",
  "K9 culture.show:part_of",
  "K9 culture.tour:part_of",
  "K9 ride.wheel:reaches",
  "K9 water.boat:part_of",
  "K9 water.motor:part_of",
  "K9 water.river:part_of",
  "K9 water.surf:part_of",
  "K9 water.under:part_of",
]);

const prop = (key: string, over: Partial<PropertyDef> = {}): PropertyDef => ({ ...PROPERTY_BY_KEY.get(key)!, ...over });
const withExpose = (p: PropertyDef, e: Partial<PropertyDef["expose"]>): PropertyDef => ({ ...p, expose: { ...p.expose, ...e } });
const fresh: Freshness = { classes: [{ id: "prices", fields: ["price", "window"], stale_after_days: 120 }] };
const type = (base: Record<string, "R" | "R?" | "A">, over: Partial<TypeMarks> = {}): TypeMarks => ({
  id: "x.y", label: "Y", records: ["place"], layers: { place: { offer_class: null, base } }, suitability: {}, sources: ["F"], ...over,
});
const keys = (ps: { key: string }[]) => ps.map((p) => p.key);

describe("K1, K2, K10, K11 are reused from the registry", () => {
  it("the registry passes", () => expect(checkExposure([...PROPERTY_BY_KEY.values()])).toEqual([]));
  it("a household row, an exposed internal row, a homeless exposed row and an MCP-only row fail", () => {
    const bad = [
      prop("name", { privacy: "household" as never }),
      { ...prop("summary"), privacy: "internal" as const },
      withExpose(prop("transit"), { api: "detail" }),
      withExpose(prop("names"), { api: "none", mcp: "public" }),
    ];
    expect(checkExposure(bad).map((p) => p.rule).sort()).toEqual(["K1", "K10", "K11", "K2", "K2"]);
  });
});

describe("K3 required with no home", () => {
  it("passes when the home exists, or the row is reserved", () => {
    expect(checkK3([prop("name")], [type({ name: "R" })])).toEqual([]);
    expect(checkK3([prop("cost_band", { reserved: "RIS-H" })], [type({ cost_band: "R" })])).toEqual([]);
    expect(checkK3([prop("cost_band")], [type({ cost_band: "A" })])).toEqual([]); // optional with no home is the report's business, not K3's
  });
  it("fails R and R? on a property with no home", () => {
    expect(keys(checkK3([prop("cost_band")], [type({ cost_band: "R" })]))).toEqual(["cost_band"]);
    expect(keys(checkK3([prop("cost_band")], [type({ cost_band: "R?" })]))).toEqual(["cost_band"]);
  });
  it("reads the home of the layer (homeByLayer)", () => {
    const p = prop("summary");
    expect(checkK3([p], [type({ summary: "R" }, { records: ["offer"], layers: { offer: { offer_class: "access", base: { summary: "R" } } } })])).toEqual([]);
  });
});

describe("K4 safety and money in a freshness class", () => {
  it("passes for a classed property and for a non-safety one", () => {
    expect(checkK4([prop("window"), prop("names")], fresh)).toEqual([]);
  });
  it("fails a rest! property and a money property in no class", () => {
    expect(keys(checkK4([prop("closures")], fresh))).toEqual(["closures"]);
    expect(keys(checkK4([prop("access_cost")], fresh))).toEqual(["access_cost"]);
  });
});

describe("K5 band and list row keys", () => {
  it("passes for a real row key", () => expect(checkK5([prop("price")], PLACE_ROW_KEYS as readonly string[])).toEqual([]));
  it("fails a band that is not a row key, and a row: exposure that is not", () => {
    const band = prop("price", { filter: { ...prop("price").filter!, scopes: ["x"], control: "enum", label: "x", band: "season_band" } });
    expect(checkK5([band], PLACE_ROW_KEYS as readonly string[])[0]!.detail).toContain("season_band");
    expect(checkK5([withExpose(prop("name"), { list: ["row:nope"] })], PLACE_ROW_KEYS as readonly string[])[0]!.detail).toContain("nope");
  });
});

describe("K6 units", () => {
  it("passes a numeric fact with the suffix unit, and a limit with unit rule", () => {
    expect(checkK6([prop("effort.drivers.gain_m"), prop("min_age"), prop("solo", { unit: "rule" })])).toEqual([]);
  });
  it("fails a number with no unit, a text value with a unit suffix, a wrong unit and a C temperature", () => {
    expect(checkK6([prop("capacity", { unit: undefined })])[0]!.detail).toContain("no unit");
    expect(checkK6([prop("ext.paddle.on_water_min")])[0]!.detail).toContain("value type is text");
    expect(checkK6([prop("effort.drivers.gain_m", { unit: "km" })])[0]!.detail).toContain("does not match");
    expect(checkK6([prop("water_safety.water_temp_c", { unit: "C" })])[0]!.detail).toContain("°C");
  });
});

describe("K7 authored labels", () => {
  it("passes an authored label", () => expect(checkK7([prop("ext.lift.last_up")])).toEqual([]));
  it("fails an empty label and a humanised ext key shown at rest", () => {
    expect(keys(checkK7([prop("name", { label: " " })]))).toEqual(["name"]);
    expect(keys(checkK7([prop("ext.drive.drive_min", { display: ["rest"] })]))).toEqual(["ext.drive.drive_min"]);
    expect(checkK7([prop("ext.drive.drive_min")])).toEqual([]); // detail only: not asked
  });
});

describe("K8 read-model keys", () => {
  const env = { placeRow: { a: { privacy: "public" as const, mcp: "public" as const } }, placeDetail: {}, tripRow: {}, tripDetail: {} };
  const shapes = { placeRow: ["a"], placeDetail: [], tripRow: [], tripDetail: [] };
  it("passes when every key has a row", () => expect(checkK8(env, shapes)).toEqual([]));
  it("fails a Zod key with no row, and a row with no Zod key", () => {
    expect(keys(checkK8(env, { ...shapes, placeRow: ["a", "b"] }))).toEqual(["placeRow.b"]);
    expect(keys(checkK8(env, { ...shapes, placeRow: [] }))).toEqual(["placeRow.a"]);
  });
});

describe("K9 dead marks", () => {
  const raw = (over: Partial<RawMark>): RawMark => ({ from: "n", layer: null, records: ["offer"], key: "reaches", mark: "A", ...over });
  it("passes a mark on a layer the property has, and an N mark", () => {
    expect(checkK9([prop("reaches")], [raw({ records: ["route"] }), raw({ mark: "N" }), raw({ records: ["place", "route"] })])).toEqual([]);
  });
  it("fails a mark only on layers the property excludes", () => {
    expect(keys(checkK9([prop("reaches")], [raw({})]))).toEqual(["n:reaches"]);
    expect(keys(checkK9([prop("reaches")], [raw({ layer: "offer", records: ["route", "offer"] })]))).toEqual(["n:reaches"]);
  });
});

describe("K12 deprecated properties", () => {
  it("passes a live property, and a deprecated one that is off MCP", () => {
    expect(checkK12([prop("name"), withExpose(prop("names", { deprecated: "v0.14" }), { mcp: "none" })])).toEqual([]);
  });
  it("fails a deprecated property still on MCP, and a release that is not a version", () => {
    expect(keys(checkK12([prop("names", { deprecated: "v0.14" })]))).toEqual(["names"]);
    expect(checkK12([prop("names", { deprecated: "soon" })])[0]!.detail).toContain("not a release");
  });
});

describe("the allow list only shrinks", () => {
  const allow = loadAllow(REPO);
  const problems = matrixProblems(loadMatrixInputs(REPO));
  it("every entry has a reason, a rule that can be allowed, and no duplicate", () => {
    for (const e of allow.entries) {
      expect(e.reason.length, `${e.rule} ${e.key}`).toBeGreaterThan(20);
      expect(ALLOWABLE).toContain(e.rule);
    }
    expect(new Set(allow.entries.map((e) => `${e.rule} ${e.key}`)).size).toBe(allow.entries.length);
  });
  it("is no longer than the ceiling (lower the ceiling when entries go)", () => expect(allow.entries.length).toBeLessThanOrEqual(ALLOW_CEILING));
  it("the allowed ids are exactly the pinned set, and the ceiling is its size", () => {
    const ids = allow.entries.map((e) => `${e.rule} ${e.key}`);
    expect(ids.filter((i) => !PINNED_ALLOWED.has(i)), "ids added to the allow list").toEqual([]);
    expect([...PINNED_ALLOWED].filter((i) => !ids.includes(i)), "pinned ids with no entry (delete them from the set)").toEqual([]);
    expect(ALLOW_CEILING).toBe(PINNED_ALLOWED.size);
    expect(ALLOWABLE).not.toContain("K8");
    expect(ids.some((i) => i.startsWith("K8 "))).toBe(false);
  });
  it("a swap (one entry dropped, a planted K6 entry added) is caught by the pin", () => {
    const swapped = [...allow.entries.slice(1), { rule: "K6" as const, key: "planted_swap", reason: "planted entry that is not in the pinned set" }];
    const ids = swapped.map((e) => `${e.rule} ${e.key}`);
    expect(ids.length).toBe(allow.entries.length);
    expect(ids.filter((i) => !PINNED_ALLOWED.has(i))).toEqual(["K6 planted_swap"]);
    expect([...PINNED_ALLOWED].filter((i) => !ids.includes(i))).toHaveLength(1);
  });
  it("a planted K8 entry cannot be allowed", () => {
    const k8: AllowFile = { ...allow, entries: [{ rule: "K8", key: "some_key", reason: "planted privacy gap that must not be allowed" }] };
    const p = { rule: "K8" as const, key: "some_key", detail: "x" };
    expect(judge([p], k8).fresh).toEqual([p]);
  });
  it("today's registry has no break outside the list and no stale entry", () => {
    const j = judge(problems, allow);
    expect(j.fresh).toEqual([]);
    expect(j.stale).toEqual([]);
    expect(j.allowed.length).toBe(allow.entries.length);
  });
  it("a new break fails, an entry that no longer breaks fails, K1 cannot be allowed", () => {
    const planted = { rule: "K6" as const, key: "brand_new_m", detail: "x" };
    expect(judge([...problems, planted], allow).fresh).toEqual([planted]);
    const dropped = problems.slice(1);
    expect(judge(dropped, allow).stale.length).toBe(1);
    const k1: AllowFile = { ...allow, entries: [{ rule: "K1", key: "name", reason: "no" }] };
    expect(judge([{ rule: "K1", key: "name", detail: "x" }], k1).fresh).toHaveLength(1);
  });
});

describe("the generated matrix", () => {
  const inputs: MatrixInputs = loadMatrixInputs(REPO);
  const m = buildMatrix(inputs, "Generated test. Do not edit.", DEFAULT_TYPES.updated);
  const doc = JSON.parse(m.json) as { schema: string; note: string; properties: { key: string; privacy: string; expose: unknown; freshness: string; required: string; display: { order: number } }[]; types: Record<string, unknown>; envelope: unknown[]; surfaces: { api: { row: string[] } } };
  it("has one row per property, one block per type id and one row per read-model key", () => {
    expect(doc.schema).toBe("property-matrix/1");
    expect(doc.properties).toHaveLength(PROPERTY_BY_KEY.size);
    expect(Object.keys(doc.types)).toHaveLength(inputs.types.length);
    expect(doc.envelope.length).toBe(m.counts.envelope);
    expect(doc.properties.every((p) => p.privacy && p.expose && p.freshness && p.required)).toBe(true);
  });
  it("is deterministic and carries the Generated line", () => {
    expect(buildMatrix(inputs, "Generated test. Do not edit.", DEFAULT_TYPES.updated).json).toBe(m.json);
    const files = generate(DEFAULT_TYPES).filter((o) => o.path.includes("property-matrix"));
    expect(files.map((o) => o.path)).toEqual(["data/schema/generated/property-matrix.json", "data/schema/generated/property-matrix.md"]);
    for (const f of files) expect(f.text).toMatch(/Generated .*Do not edit/);
  });
  it("the committed files equal the generator", () => {
    for (const f of generate(DEFAULT_TYPES).filter((o) => o.path.includes("property-matrix"))) expect(readFileSync(join(REPO, f.path), "utf8"), f.path).toBe(f.text);
  });
  it("the marks snapshot of the spec page section 7 regenerates (rows spot-checked)", () => {
    expect(m.md).toContain("| `name` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |");
    expect(m.md).toContain("| `season` | R? | R? |  |  |  | R |  |  | R? | R? | R | R | R |  | R |");
    expect(m.md).toContain("| `window` | R? | R? | R? | R? | R? | A | A | R? | R | R | R? |  | A | A |  |");
  });
  it("the surfaces index matches the per-row exposure", () => {
    expect(doc.surfaces.api.row.sort()).toEqual(inputs.props.filter((p) => p.expose.api === "row").map((p) => p.key).sort());
  });
});

describe("build --check carries the rules", () => {
  it("is green on the repository", () => expect(checkDrift(REPO)).toEqual([]));
  it("reports a new break and a stale allow entry as drift, and the CLI exits 1", () => {
    const allow = loadAllow(REPO);
    const root = scratchRoot();
    writeAll(root);
    expect(checkDrift(root)).toEqual([]);
    put(root, "data/schema/property-matrix-allow.json", { ...allow, entries: [...allow.entries.slice(1), { rule: "K6", key: "name", reason: "planted entry that does not break" }] });
    const drift = checkDrift(root);
    expect(drift.map((d) => d.reason).sort()).toEqual(["allow", "check"]);
    const r = spawnSync("node", [join(REPO, "core", "bin", "capture.ts"), "build", "--check", "--root", root], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("DRIFT check:");
  });
});
