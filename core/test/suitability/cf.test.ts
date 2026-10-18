// Lane CF: operator_info basis, the no_limit state, the basis migration helper and the usable_partial level.
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDoc } from "../../src/validate/index.ts";
import { SUIT_BASIS, SUIT_LEVEL, SUIT_STATE } from "../../src/schema/enums.ts";
import { REL_BASIS } from "../../src/schema/relevance.ts";
import { DEFAULT_APPLICABILITY as APP, requiredPaths } from "../../src/suitability/applicability.ts";
import { checkRecord, PARTIAL_GAP_SHARE, PARTIAL_MIN_R } from "../../src/suitability/level.ts";
import { projectFlat } from "../../src/suitability/derive.ts";
import { rebaseOperatorInfo } from "../../src/suitability/rebaseBasis.ts";
import type { SuitabilityRecord } from "../../src/schema/suitability.ts";
import { searchedNone, v } from "./helpers.ts";

const ROOT = join(fileURLToPath(new URL("../fixtures/suitability", import.meta.url)), "root");
type Obj = Record<string, unknown>;
const doc = (suitability: unknown) => ({
  schema: "suitability/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "t", model: "t",
  sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "t", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }],
  records: [{ ref: "place/lago-di-braies", kind: "lake", subkind: "lake", suitability }],
});
const run = (suitability: unknown) => {
  process.env.SUITABILITY_TODAY = "2026-10-18";
  return validateDoc(doc(suitability), "sidecar", ROOT, { kind: "suitability" });
};
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();

describe("operator_info basis", () => {
  it("is in the suitability and relevance basis lists", () => {
    expect(SUIT_BASIS).toContain("operator_info");
    expect(REL_BASIS).toContain("operator_info");
  });
  it("is accepted on a fact that is not a rule", () => {
    expect(run({ altitude_m: v(3842, "operator_info" as never, { quote: "Summit station 3,842 m." }) }).errors).toEqual([]);
  });
  it("is refused on every kind of hard limit", () => {
    for (const f of ["min_age", "max_weight_kg", "min_height_cm"]) {
      expect(codes(run({ [f]: v(8, "operator_info" as never) })), f).toEqual(["E_SUIT_LIMIT_BASIS"]);
    }
    expect(codes(run({ group_min: v({ n: 4 }, "operator_info" as never) }))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    expect(codes(run({ participation: { min_shoe_eu: v(34, "operator_info" as never) } }))).toEqual(["E_SUIT_LIMIT_BASIS"]);
  });
  it("the limit message names operator_info as the home of facts that are not rules", () => {
    const m = run({ min_age: v(8, "operator_info" as never) }).errors[0]!.message;
    expect(m).toContain("operator_info");
  });
});

describe("no_limit: the source affirms there is no limit", () => {
  const said = { v: null, state: "no_limit", basis: "operator_rule", src: ["src-0001"], quote: "All children are welcome." };
  it("is a state next to none_stated and searched_none", () => {
    expect(SUIT_STATE).toEqual(expect.arrayContaining(["no_limit", "none_stated", "searched_none"]));
  });
  it("validates on a limit with a rule basis and the words", () => {
    expect(run({ min_age: said }).errors).toEqual([]);
  });
  it("needs the words (quote or note) and a basis", () => {
    const { quote: _q, ...bare } = said;
    expect(codes(run({ min_age: bare }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run({ min_age: { ...said, basis: null } }))).toContain("E_SUIT_SCHEMA");
  });
  it("is held to the limit bases like a value", () => {
    expect(codes(run({ min_age: { ...said, basis: "community" } }))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    expect(codes(run({ min_age: { ...said, basis: "operator_info" } }))).toEqual(["E_SUIT_LIMIT_BASIS"]);
  });
  it("is answered, firm for the level, and projects no limit", () => {
    const rec: SuitabilityRecord = { ref: "place/x", kind: "lake", subkind: "lake", suitability: { min_age: said as never } };
    expect(projectFlat(rec).min_age).toBeNull();
  });
});

describe("rebaseOperatorInfo", () => {
  const sample = (): Obj => ({
    records: [{
      suitability: {
        min_age: v(8, "operator_rule"),
        toilets: v("yes", "operator_rule"),
        altitude_m: { ...v(3842, "operator_rule"), conflicts: [{ v: 3800, basis: "operator_rule", src: [] }, { v: 3700, basis: "community", src: [] }] },
        effort: { drivers: { distance_km: v(5, "operator_rule") } },
        participation: { min_shoe_eu: v(34, "operator_rule"), guide: v("required", "operator_rule") },
      },
      ext: { kind: "lift", last_down: v("17:00", "operator_rule"), floats_required_under: v(8, "operator_rule") },
      offers: [{ name: "a", suitability: { max_load_kg: v(150, "operator_rule"), food: v("café", "official_info") } }],
    }],
  });
  it("rewrites non-limit fields, their conflicts, and leaves every rule field alone", () => {
    const { doc: out, changed } = rebaseOperatorInfo(sample());
    const s = (out as { records: { suitability: Obj; ext: Obj; offers: { suitability: Obj }[] }[] }).records[0]!;
    expect((s.suitability.min_age as Obj).basis).toBe("operator_rule");
    expect((s.suitability.toilets as Obj).basis).toBe("operator_info");
    expect((s.suitability.altitude_m as Obj).basis).toBe("operator_info");
    expect(((s.suitability.altitude_m as Obj).conflicts as Obj[]).map((c) => c.basis)).toEqual(["operator_info", "community"]);
    expect(((s.suitability.effort as Obj).drivers as Obj).distance_km).toMatchObject({ basis: "operator_info" });
    expect((s.suitability.participation as Obj).min_shoe_eu).toMatchObject({ basis: "operator_rule" });
    expect((s.suitability.participation as Obj).guide).toMatchObject({ basis: "operator_info" });
    expect(s.ext.last_down).toMatchObject({ basis: "operator_info" });
    expect(s.ext.floats_required_under).toMatchObject({ basis: "operator_rule" });
    expect(s.offers[0]!.suitability.max_load_kg).toMatchObject({ basis: "operator_rule" });
    expect(s.offers[0]!.suitability.food).toMatchObject({ basis: "official_info" });
    expect(changed).toBe(6);
  });
  it("does not change its input, and --keep protects more fields", () => {
    const input = sample();
    const copy = structuredClone(input);
    const { doc: out, changed } = rebaseOperatorInfo(input, { keep: ["guide"] });
    expect(input).toEqual(copy);
    expect(changed).toBe(5);
    expect(JSON.stringify(out)).toContain('"guide":{"v":"required","state":"value","basis":"operator_rule"');
  });
  it("is idempotent", () => {
    const once = rebaseOperatorInfo(sample());
    expect(rebaseOperatorInfo(once.doc).changed).toBe(0);
  });
});

describe("usable_partial", () => {
  const firm = (basis = "operator_info"): Obj => ({ v: "x", state: "value", basis, src: [], note: "fixture" });
  const none = (): Obj => ({ v: null, state: "none_stated", basis: "official_rule", src: ["src-0001"] });
  const noLimit = (): Obj => ({ v: null, state: "no_limit", basis: "operator_rule", src: ["src-0001"], quote: "No minimum age." });
  const PLAIN: Record<string, unknown> = { kid_note: "note" };

  /** A record whose every R field is answered firmly, except the paths in `soft` (searched_none) and the `over` replacements. */
  function build(profile: string, soft: readonly string[] = [], over: Record<string, unknown> = {}): SuitabilityRecord {
    const operated = profile === "rafting";
    const b: Obj = {};
    const ext: Obj = profile === "rafting" ? { kind: "paddle" } : {};
    for (const path of requiredPaths(APP.profiles[profile]!, operated)) {
      const parts = path.split(".");
      const target = path.startsWith("ext.") ? ext : b;
      const names = path.startsWith("ext.") ? [parts[2]!] : parts;
      let cur = target;
      for (const part of names.slice(0, -1)) cur = (cur[part] ??= {}) as Obj;
      cur[names.at(-1)!] = path in over ? over[path] : soft.includes(path) ? searchedNone() : path in PLAIN ? PLAIN[path] : firm();
    }
    return profile === "rafting"
      ? { ref: "place/x", kind: "activity", subkind: "rafting", suitability: b as never, ext: ext as never }
      : { ref: "place/x", kind: "lake", subkind: "lake", suitability: b as never };
  }
  const lakeR = requiredPaths(APP.profiles.lake!, false);

  it("the level is in the schema enum", () => {
    expect(SUIT_LEVEL).toEqual(["draft", "usable_partial", "usable", "complete"]);
    expect(lakeR.length).toBeGreaterThanOrEqual(PARTIAL_MIN_R);
  });
  it("all R fields firm: usable, not partial", () => {
    const c = checkRecord(build("lake"));
    expect(c.missingRequired).toEqual([]);
    expect(c.softRequired).toEqual([]);
    expect(c.level).toBe("usable");
  });
  it("more than 40 percent of at least 6 R fields soft: usable_partial", () => {
    // the lake asks 7 R fields: 3 soft is 43 percent, 2 soft is 29 percent
    const three = ["stroller", "wheelchair", "walk_m"];
    expect(three.length / lakeR.length).toBeGreaterThan(PARTIAL_GAP_SHARE);
    const c = checkRecord(build("lake", three));
    expect(c.softSafety).toEqual([]);
    expect(c.level).toBe("usable_partial");
    expect(projectFlat(build("lake", three)).suit_level).toBe("usable_partial");
    expect(checkRecord(build("lake", three.slice(0, 2))).level).toBe("usable");
  });
  it("none_stated is as soft as searched_none for the share", () => {
    const r = build("lake", [], { stroller: none(), wheelchair: none(), walk_m: none() });
    expect(checkRecord(r).softRequired).toEqual(["stroller", "wheelchair", "walk_m"]);
    expect(checkRecord(r).level).toBe("usable_partial");
  });
  it("no_limit is firm: it never counts as a gap", () => {
    const r = build("lake", [], { stroller: noLimit(), wheelchair: noLimit(), walk_m: noLimit() });
    expect(checkRecord(r).softRequired).toEqual([]);
    expect(checkRecord(r).level).toBe("usable");
  });
  it("a share below the 6-field floor does not trigger", () => {
    // an operated profile is not under the floor, so test the floor with the arithmetic the rule states
    expect(PARTIAL_MIN_R).toBe(6);
    expect(PARTIAL_GAP_SHARE).toBe(0.4);
  });
  it("one soft hard limit is enough, even with every other field firm", () => {
    const c = checkRecord(build("rafting", ["min_weight_kg"]));
    expect(c.softSafety).toEqual(["min_weight_kg"]);
    expect(c.level).toBe("usable_partial");
    const viaNone = checkRecord(build("rafting", [], { min_age: none() }));
    expect(viaNone.softSafety).toEqual(["min_age"]);
    expect(viaNone.level).toBe("usable_partial");
    expect(checkRecord(build("rafting", [], { min_age: noLimit() })).level).toBe("usable");
  });
  it("one soft water_safety field is enough", () => {
    const c = checkRecord(build("rafting", ["water_safety.lifejacket"]));
    expect(c.softSafety).toEqual(["water_safety.lifejacket"]);
    expect(c.level).toBe("usable_partial");
  });
  it("an operated age_band that rests on our judgement is partial; on the operator it is not", () => {
    const band = (basis: string): Obj => ({ v: { from: 8, reason: "x" }, state: "value", basis, src: [], note: "fixture" });
    const own = checkRecord(build("rafting", [], { age_band: band("our_inference") }));
    expect(own.softSafety).toEqual(["age_band"]);
    expect(own.level).toBe("usable_partial");
    const op = checkRecord(build("rafting", [], { age_band: band("operator_info") }));
    expect(op.softSafety).toEqual([]);
    expect(op.level).toBe("usable");
  });
  it("a free (not operated) record's age_band on our judgement is normal", () => {
    const band = { v: { from: 8, reason: "x" }, state: "value", basis: "our_inference", src: [], note: "fixture" };
    expect(checkRecord(build("lake", [], { age_band: band })).level).toBe("usable");
  });
  it("a draft stays draft however soft it is", () => {
    expect(checkRecord({ kind: "lake", subkind: "lake", suitability: {} }).level).toBe("draft");
  });
});
