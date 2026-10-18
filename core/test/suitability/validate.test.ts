import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ERROR_CODE_LIST, SUIT_ERROR_CODES, SUIT_ERROR_LIST, SUIT_WARNING_CODES, SUIT_WARNING_LIST, allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";
import { suitability } from "../../src/schema/suitability.ts";
import { REGISTRY } from "../../src/schema/index.ts";
import { gap, v } from "./helpers.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core", "test", "fixtures", "suitability");
const ROOT = join(FIX, "root");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const names = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

// the base document of the generator, rebuilt here for the inline cases
const base = () => ({
  schema: "suitability/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "t", model: "t",
  sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "t", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }],
  records: [{ ref: "place/lago-di-braies", kind: "lake", suitability: {} }],
});
const withBlock = (suitability: unknown) => ({ ...base(), records: [{ ref: "place/lago-di-braies", kind: "lake", suitability }] });
const run = (doc: unknown, today = "2026-10-18") => {
  process.env.SUITABILITY_TODAY = today;
  return validateDoc(doc, "sidecar", ROOT, { kind: "suitability" });
};

describe("registration", () => {
  it("suitability is a document table of the schema registry", () => {
    expect(REGISTRY.map((t) => t.key)).toContain("sidecar.suitability");
    expect(suitability.meta.single).toBe(true);
  });
  it("detects a file under data/suitability/<trip>/ and a document by its schema id", () => {
    expect(detect(join(REPO, "data/suitability/dolomites-2027/R1.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "suitability" });
    expect(detect(null, { schema: "suitability/1" }, REPO)).toEqual({ family: "sidecar", kind: "suitability" });
  });
  it("--all takes suitability files of a trip folder and leaves scope.json out", () => {
    const root = mkdtempSync(join(tmpdir(), "suit-all-"));
    tmp.push(root);
    mkdirSync(join(root, "data/suitability/fixture-trip"), { recursive: true });
    writeFileSync(join(root, "data/suitability/scope.json"), "{}");
    writeFileSync(join(root, "data/suitability/fixture-trip/R1.json"), "{}");
    const files = allFiles(root).map((f) => f.slice(root.length + 1));
    expect(files).toContain("data/suitability/fixture-trip/R1.json");
    expect(files).not.toContain("data/suitability/scope.json");
  });
  it("the suitability codes are kept apart from the structural ones", () => {
    expect(ERROR_CODE_LIST.some((c) => c.startsWith("E_SUIT"))).toBe(false);
  });
});

describe("valid fixtures", () => {
  for (const n of names(join(FIX, "valid"))) {
    it(`valid/${n}.json has zero errors`, () => {
      const r = validateFile(join(FIX, "valid", `${n}.json`), ROOT);
      expect(r.errors, JSON.stringify(r.errors, null, 1)).toEqual([]);
    });
  }
});

describe("one failing fixture for every error code", () => {
  const broken = names(join(FIX, "broken"));
  it("has exactly one fixture per E_SUIT code", () => {
    expect(broken).toEqual([...SUIT_ERROR_LIST].sort());
    expect(SUIT_ERROR_LIST).toHaveLength(Object.keys(SUIT_ERROR_CODES).length);
  });
  for (const code of broken) {
    it(`${code} yields that code and no other error`, () => {
      const r = validateFile(join(FIX, "broken", `${code}.json`), ROOT);
      expect(codes(r), JSON.stringify(r.errors, null, 1)).toEqual([code]);
    });
  }
  it("every message says what is wrong and gives an example or a way out", () => {
    for (const code of broken) {
      for (const e of validateFile(join(FIX, "broken", `${code}.json`), ROOT).errors) {
        expect(e.path === "" || e.path.startsWith("/"), `${code} path ${e.path}`).toBe(true);
        expect(e.message.length, code).toBeGreaterThan(40);
        expect(/Example|Run:|Add |Remove|Keep|Move|Give|Say|Cite|Check|Re-read/.test(e.message), `${code}: ${e.message}`).toBe(true);
      }
    }
  });
});

describe("one fixture for every warning code", () => {
  const warn = names(join(FIX, "warn"));
  it("has exactly one fixture per W_SUIT code", () => {
    expect(warn).toEqual([...SUIT_WARNING_LIST].sort());
    expect(SUIT_WARNING_LIST).toHaveLength(Object.keys(SUIT_WARNING_CODES).length);
  });
  for (const code of warn) {
    it(`${code} warns and does not fail`, () => {
      process.env.SUITABILITY_TODAY = "2026-10-18";
      const r = validateFile(join(FIX, "warn", `${code}.json`), ROOT);
      expect(r.errors, JSON.stringify(r.errors)).toEqual([]);
      expect(r.warnings.map((w) => w.code)).toContain(code);
    });
  }
});

describe("hard limits (K3)", () => {
  it.each(["official_grade", "official_info", "community", "our_inference"])("a min_age on %s is an error", (basis) => {
    const r = run(withBlock({ min_age: v(8, basis as never, { src: ["src-0001"], note: "x" }), age_rule: "rule" }));
    expect(codes(r)).toEqual(["E_SUIT_LIMIT_BASIS"]);
  });
  it.each(["operator_rule", "official_rule"])("a min_age on %s is fine", (basis) => {
    expect(run(withBlock({ min_age: v(8, basis as never) })).errors).toEqual([]);
  });
  it("every limit field is covered, and none_stated needs a rule basis too", () => {
    for (const f of ["max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg"]) {
      expect(codes(run(withBlock({ [f]: v(5, "community") })))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    }
    const none = { v: null, state: "none_stated", basis: "community", src: ["src-0001"] };
    expect(codes(run(withBlock({ min_age: none })))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    expect(run(withBlock({ min_age: { ...none, basis: "operator_rule" } })).errors).toEqual([]);
  });
  it("a conflict may rest on anything: it is never the chosen value", () => {
    const r = run(withBlock({ min_age: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 8, basis: "community", src: ["src-0001"] }] } }));
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("W_SUIT_CONFLICT");
  });
  it("group_min is an official rule only", () => {
    expect(codes(run(withBlock({ group_min: v({ n: 4 }, "operator_rule") })))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    expect(run(withBlock({ group_min: v({ n: 4 }, "official_rule") })).errors).toEqual([]);
  });
  it("the age on board of a boat tour and a rider age are rules too", () => {
    expect(codes(run(withBlock({ water_safety: { min_age_on_board: v(5, "community") } })))).toEqual(["E_SUIT_LIMIT_BASIS"]);
    const doc = { ...base(), records: [{ ref: "place/lago-di-braies", kind: "activity", suitability: {}, ext: { kind: "ride", min_rider_age: v(8, "community") } }] };
    expect(codes(run(doc))).toEqual(["E_SUIT_LIMIT_BASIS"]);
  });
  it("offers are checked like the record", () => {
    const doc = { ...base(), records: [{ ref: "place/lago-di-braies", kind: "activity", suitability: {}, offers: [{ name: "A", suitability: { min_age: v(8, "community") } }] }] };
    const r = run(doc);
    expect(r.errors[0]?.path).toBe("/records/0/offers/0/suitability/min_age/basis");
  });
});

describe("value states", () => {
  it("a value needs v and a basis; other states need v null", () => {
    expect(codes(run(withBlock({ stroller: { v: null, state: "value", basis: "official_info", src: ["src-0001"] } })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(withBlock({ stroller: { v: "smooth", state: "value", basis: null, src: ["src-0001"] } })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(withBlock({ stroller: { v: "smooth", state: "gap", basis: null, src: [] } })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(withBlock({ stroller: { v: null, state: "none_stated", basis: null, src: [] } })))).toEqual(["E_SUIT_SCHEMA"]);
  });
  it("searched_none needs the date and at least one page tried", () => {
    expect(codes(run(withBlock({ min_age: { v: null, state: "searched_none", basis: null, src: [], tried: ["a"] } })))).toEqual(["E_SUIT_SEARCHED_NONE"]);
    expect(codes(run(withBlock({ min_age: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: [] } })))).toEqual(["E_SUIT_SEARCHED_NONE"]);
    expect(run(withBlock({ min_age: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: ["a", "b"] } })).errors).toEqual([]);
  });
  it("a value without a source must be our_inference with a note", () => {
    expect(codes(run(withBlock({ shade: { v: "full", state: "value", basis: "community", src: [] } })))).toEqual(["E_SUIT_SRC"]);
    expect(codes(run(withBlock({ shade: { v: "full", state: "value", basis: "our_inference", src: [] } })))).toEqual(["E_SUIT_SRC"]);
    expect(run(withBlock({ shade: { v: "full", state: "value", basis: "our_inference", src: [], note: "tree cover on the map" } })).errors).toEqual([]);
  });
  it("gap and not_applicable need no source", () => {
    expect(run(withBlock({ shade: gap(), signal: { v: null, state: "not_applicable", basis: null, src: [] } })).errors).toEqual([]);
  });
  it("an unknown key anywhere is rejected (strict objects)", () => {
    expect(codes(run(withBlock({ stroller: { ...v("smooth", "official_info"), extra: 1 } })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(withBlock({ made_up: 1 })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run({ ...base(), extra: 1 }))).toEqual(["E_SUIT_SCHEMA"]);
  });
  it("a wrong schema id or a bad trip slug is rejected", () => {
    expect(codes(run({ ...base(), schema: "suitability/2" }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run({ ...base(), trip: "Not A Slug" }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run("nope"))).toEqual(["E_SUIT_SCHEMA"]);
  });
  it("the ext union is discriminated on kind", () => {
    const doc = (ext: unknown) => ({ ...base(), records: [{ ref: "place/lago-di-braies", kind: "trail", suitability: {}, ext }] });
    expect(run(doc({ kind: "trail", shape: "loop" })).errors).toEqual([]);
    expect(codes(run(doc({ kind: "teleport" })))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(doc({ kind: "trail", craft: "raft" })))).toEqual(["E_SUIT_SCHEMA"]); // a paddle field on a trail
  });
  it("access_season dates are MM-DD", () => {
    const season = (from: string) => withBlock({ access_season: v([{ from, to: "09-30", status: "open", via: "road" }], "official_info", { applies_to: "2026" }) });
    expect(run(season("06-15")).errors).toEqual([]);
    expect(codes(run(season("6/15")))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run(season("13-01")))).toEqual(["E_SUIT_SCHEMA"]);
  });
});

describe("sources", () => {
  const withSrc = (url: string, extra = {}) => ({ ...base(), sources: [{ ...base().sources[0]!, url, ...extra }] });
  it.each([
    "https://www.alltrails.com/trail/x", "https://www.komoot.com/tour/1", "https://www.komoot.de/tour/1", "https://www.gaiagps.com/x",
    "https://www.outdooractive.com/en/route/1", "https://www.wikiloc.com/hiking-trails/1", "https://www.google.com/maps/x", "https://maps.google.ca/x",
    "https://www.tripadvisor.com/x", "https://www.booking.com/hotel/x", "https://www.viator.com/tours/x",
    "https://www.strava.com/routes/1", "https://www.hikingproject.com/trail/1", "https://www.mtbproject.com/trail/1", "https://fatmap.com/x", "https://maps.me/x",
  ])("%s is link-only", (url) => {
    expect(codes(run(withSrc(url)))).toEqual(["E_SUIT_LINK_ONLY_SRC"]);
  });
  it("an official host that merely contains a platform name in its path is fine", () => {
    expect(run(withSrc("https://parks.canada.ca/alltrails-advice")).errors).toEqual([]);
  });
  it("Trailforks is a source for community values only", () => {
    const doc = (basis: string) => ({ ...withSrc("https://www.trailforks.com/trails/x"), records: [{ ref: "place/lago-di-braies", kind: "trail", suitability: { shade: { v: "partial", state: "value", basis, src: ["src-0001"] } } }] });
    expect(run(doc("community")).errors).toEqual([]);
    expect(codes(run(doc("official_info")))).toEqual(["E_SUIT_LINK_ONLY_SRC"]);
  });
  it("a repo path is a fine source (kind computed)", () => {
    expect(run(withSrc("legacy/canadian-rockies-sept-2029/data/trails.json", { kind: "computed", publisher: "this repo" })).errors).toEqual([]);
  });
  it("a source without a read date, or a malformed one, is E_SUIT_SRC_READ", () => {
    const d = base();
    delete (d.sources[0] as Record<string, unknown>).read;
    expect(codes(run(d))).toEqual(["E_SUIT_SRC_READ"]);
    expect(codes(run(withSrc("https://parks.canada.ca/x", { read: "last Tuesday" })))).toEqual(["E_SUIT_SRC_READ"]);
  });
  it("duplicate source ids are an error", () => {
    const d = base();
    d.sources.push({ ...d.sources[0]! });
    expect(codes(run(d))).toEqual(["E_SUIT_SRC"]);
  });
  it("a hint names a known source", () => {
    const d = { ...base(), records: [{ ref: "place/lago-di-braies", kind: "lake", suitability: {}, hints: [{ field: "age_band", text: "t", src: ["src-9"] }] }] };
    expect(codes(run(d))).toEqual(["E_SUIT_SRC"]);
  });
});

describe("units, ranges, grades, step-free", () => {
  it.each(["50 lb", "44 in", "3 ft", "2 mi", "40 pounds", "44 inches", "5 miles", '44"'])("a quote of %s needs a conversion note", (quote) => {
    expect(codes(run(withBlock({ min_weight_kg: v(1, "operator_rule", { quote }) })))).toEqual(["E_SUIT_UNIT"]);
  });
  it("metric quotes and words that merely contain the letters need none", () => {
    expect(run(withBlock({ min_weight_kg: v(40, "operator_rule", { quote: "minimum 40 kg, must be in good health" }) })).errors).toEqual([]);
    expect(run(withBlock({ min_height_cm: v(120, "operator_rule", { quote: "120 cm" }) })).errors).toEqual([]);
  });
  it("a converted weight or height warns as marginal", () => {
    const r = run(withBlock({ min_weight_kg: v(22.7, "operator_rule", { quote: "50 lb", note: "50 lb = 22.7 kg" }) }));
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("W_SUIT_MARGINAL_CONVERSION");
  });
  it("a minimum above its maximum is a range error, for age, height and weight", () => {
    expect(codes(run(withBlock({ min_age: v(12), max_age: v(8) })))).toEqual(["E_SUIT_RANGE"]);
    expect(codes(run(withBlock({ min_height_cm: v(130), max_height_cm: v(120) })))).toEqual(["E_SUIT_RANGE"]);
    expect(run(withBlock({ min_weight_kg: v(40), max_weight_kg: v(40) })).errors).toEqual([]);
  });
  it("ranges that run backwards: age band, times, child times", () => {
    expect(codes(run(withBlock({ age_band: v({ from: 12, to: 8 }, "our_inference") })))).toEqual(["E_SUIT_RANGE"]);
    expect(codes(run(withBlock({ adult_time_min: v([240, 180], "our_inference") })))).toEqual(["E_SUIT_RANGE"]);
    expect(codes(run(withBlock({ on_site_min: v([90, 60], "our_inference") })))).toEqual(["E_SUIT_RANGE"]);
    expect(codes(run(withBlock({ child_time_min: v([{ from_age: 6, to_age: 4, range: [100, 200] }], "official_info") })))).toEqual(["E_SUIT_RANGE"]);
    expect(codes(run(withBlock({ child_time_min: v([{ from_age: 6, to_age: null, range: [300, 200] }], "official_info") })))).toEqual(["E_SUIT_RANGE"]);
  });
  it("a grade must belong to its system; unmapped systems take any word", () => {
    const g = (system: string, value: string) => withBlock({ effort: { source_grade: v({ system, value }, "official_grade") } });
    expect(codes(run(g("sac", "T7")))).toEqual(["E_SUIT_GRADE"]);
    expect(codes(run(g("whitewater", "VII")))).toEqual(["E_SUIT_GRADE"]);
    expect(run(g("sac", "T4")).errors).toEqual([]);
    expect(run(g("local", "pleasant")).errors).toEqual([]);
    expect(run(g("operator", "Level 2")).errors).toEqual([]);
    expect(codes(run(withBlock({ water_safety: { class: v({ system: "whitewater", value: "VIII" }, "official_grade") } })))).toEqual(["E_SUIT_GRADE"]);
  });
  it("step_free needs official_info; partial does not", () => {
    expect(codes(run(withBlock({ wheelchair: v("step_free", "our_inference") })))).toEqual(["E_SUIT_STEP_FREE"]);
    expect(run(withBlock({ wheelchair: v("step_free", "official_info") })).errors).toEqual([]);
    expect(run(withBlock({ wheelchair: v("partial", "community") })).errors).toEqual([]);
  });
});

describe("family effort is computed, never typed", () => {
  it.each(["family_effort", "terrain", "terrain_basis", "effort_km", "band"])("%s in a file is E_SUIT_TYPED_EFFORT and nothing else", (key) => {
    const r = run(withBlock({ effort: { [key]: key === "terrain_basis" ? "mapped" : 3 } }));
    expect(codes(r)).toEqual(["E_SUIT_TYPED_EFFORT"]);
  });
  it("also on an offer", () => {
    const doc = { ...base(), records: [{ ref: "place/lago-di-braies", kind: "activity", suitability: {}, offers: [{ name: "A", suitability: { effort: { family_effort: 2 } } }] }] };
    expect(run(doc).errors[0]).toMatchObject({ code: "E_SUIT_TYPED_EFFORT", path: "/records/0/offers/0/suitability/effort/family_effort" });
  });
  it("the JSON schema has no property for it", () => {
    const text = JSON.stringify(read(join(REPO, "data/schema/generated/schema.json")).$defs["sidecar.suitability"]);
    expect(text).not.toContain("family_effort");
    expect(text).not.toContain('"effort_km"');
  });
});

describe("refs", () => {
  const ref = (r: string) => ({ ...base(), records: [{ ref: r, kind: "trail", suitability: {} }] });
  it.each([
    "place/lago-di-braies", "legacy/canadian-rockies-sept-2029/trails/lake-agnes", "legacy/canadian-rockies-sept-2029/sights/moraine-lake",
    "legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float", "trip/fixture-trip/trail:tre cime",
    "offer/place/lago-di-braies#family-float",
  ])("%s resolves", (r) => {
    expect(run(ref(r)).errors).toEqual([]);
  });
  it.each([
    "place/nowhere", "legacy/canadian-rockies-sept-2029/trails/nope", "legacy/canadian-rockies-sept-2029/hotels/x", "legacy/no-folder/trails/x",
    "legacy/canadian-rockies-sept-2029/trails", "trip/fixture-trip/trail:nothing", "offer/place/nowhere#x", "offer/place/lago-di-braies", "braies", "thing/x",
  ])("%s does not", (r) => {
    expect(codes(run(ref(r)))).toEqual(["E_SUIT_REF"]);
  });
  it("without a scope manifest, place and trip refs cannot resolve", () => {
    const empty = mkdtempSync(join(tmpdir(), "suit-noscope-"));
    tmp.push(empty);
    const r = validateDoc(ref("place/lago-di-braies"), "sidecar", empty, { kind: "suitability" });
    expect(r.errors[0]?.message).toContain("scope.json");
  });
});

describe("staleness (freshness classes)", () => {
  const stale = (block: unknown, readDate: string, today = "2026-10-18") => {
    const d = { ...withBlock(block), sources: [{ ...base().sources[0]!, read: readDate }] };
    return run(d, today).warnings.map((w) => w.code);
  };
  it("a limit older than 365 days is stale", () => {
    expect(stale({ min_age: v(8) }, "2025-10-18")).not.toContain("W_SUIT_STALE");
    expect(stale({ min_age: v(8) }, "2025-10-17")).toContain("W_SUIT_STALE");
  });
  it("grades and stats last three years, facilities two, the access season one", () => {
    const grade = { effort: { source_grade: v({ system: "sac" as const, value: "T2" }, "official_grade") } };
    expect(stale(grade, "2023-10-19")).not.toContain("W_SUIT_STALE");
    expect(stale(grade, "2023-10-01")).toContain("W_SUIT_STALE");
    expect(stale({ toilets: v(["start"], "official_info") }, "2024-10-19")).not.toContain("W_SUIT_STALE");
    expect(stale({ toilets: v(["start"], "official_info") }, "2024-10-01")).toContain("W_SUIT_STALE");
    const season = { access_season: v([{ from: "06-01", to: "09-30", status: "open", via: "road" }], "official_info", { applies_to: "2026" }) };
    expect(stale(season, "2025-10-01")).toContain("W_SUIT_STALE");
  });
  it("our own inference never goes stale", () => {
    expect(stale({ age_band: v({ from: 8, to: null }, "our_inference") }, "2001-01-01")).not.toContain("W_SUIT_STALE");
  });
  it("a read date on the value wins over an older source date", () => {
    const d = withBlock({ min_age: v(8, "operator_rule", { read: "2026-10-01" }) });
    d.records.length;
    expect(run({ ...d, sources: [{ ...base().sources[0]!, read: "2020-01-01" }] }).warnings.map((w) => w.code)).not.toContain("W_SUIT_STALE");
  });
});

describe("the flat catalogue copy (K9)", () => {
  const flatOf = (block: Record<string, unknown>) => ({ min_age: null, max_age: null, min_height_cm: null, max_height_cm: null, min_weight_kg: null, max_weight_kg: null, house_grade: null, kid_fit: "unknown", accessibility: "unknown", walk_km: null, walk_gain_m: null, ...block });
  const doc = (flat: unknown, block: unknown = {}) => ({ ...base(), records: [{ ref: "place/lago-di-braies", kind: "lake", suitability: block, flat }] });
  it("an up-to-date copy passes", () => {
    expect(run(doc(flatOf({}))).errors).toEqual([]);
    expect(run(doc(flatOf({ min_age: 8 }), { min_age: v(8) })).errors).toEqual([]);
  });
  it("a copy that differs fails with the fields named", () => {
    const r = run(doc(flatOf({ min_age: 9 }), { min_age: v(8) }));
    expect(codes(r)).toEqual(["E_SUIT_FLAT_DRIFT"]);
    expect(r.errors[0]!.message).toContain("min_age");
  });
  it("a limit that rests on no rule is absent from the copy", () => {
    expect(codes(run(doc(flatOf({ min_age: 8 }), { min_age: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 8, basis: "our_inference", src: [] }] } })))).toEqual(["E_SUIT_FLAT_DRIFT"]);
  });
  it("a missing copy is only a warning", () => {
    expect(run(withBlock({})).warnings.map((w) => w.code)).toContain("W_SUIT_FLAT_MISSING");
  });
});

describe("two files of a trip", () => {
  it("the check command reports a ref that is in both", () => {
    const root = mkdtempSync(join(tmpdir(), "suit-dup-"));
    tmp.push(root);
    cpSync(join(ROOT, "data"), join(root, "data"), { recursive: true });
    cpSync(join(ROOT, "legacy"), join(root, "legacy"), { recursive: true });
    mkdirSync(join(root, "data/suitability/fixture-trip"), { recursive: true });
    const one = read(join(FIX, "valid", "lake.json"));
    writeFileSync(join(root, "data/suitability/fixture-trip/R1.json"), JSON.stringify(one));
    writeFileSync(join(root, "data/suitability/fixture-trip/R2.json"), JSON.stringify({ ...one, lane: "other" }));
    const out = spawnCheck(root);
    expect(out.status).toBe(1);
    expect(out.stdout).toContain("E_SUIT_DUP_REF");
    expect(out.stdout).toContain("place/lago-di-braies");
  });
});

import { spawnSync } from "node:child_process";
function spawnCheck(root: string, ...extra: string[]) {
  return spawnSync(process.execPath, [join(REPO, "core/bin/suitability.ts"), "check", "--root", root, ...extra], { encoding: "utf8" });
}
void basename;
