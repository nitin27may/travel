import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = join(REPO, "data", "seasons");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
/** The first shape ({value, basis} with the old basis words): the frozen pre-normalisation copy the normaliser's golden test reads. */
const legacy = () => JSON.parse(readFileSync(join(REPO, "core/test/normalise/fixtures/golden/season-switzerland-2027.json"), "utf8"));
const run = (doc: unknown, folder: string) => validateDoc(doc, "sidecar", REPO, { family: "sidecar", kind: "seasons", folder });

describe("trip-season-basic/1 (data/seasons)", () => {
  it("--all covers every season file and each one is valid", () => {
    const all = allFiles(REPO);
    for (const f of FILES) {
      expect(all).toContain(join(DIR, f));
      expect(validateFile(join(DIR, f), REPO).errors).toEqual([]);
    }
    expect(FILES.length).toBeGreaterThanOrEqual(6);
  });
  it("is detected from the path and from the schema id", () => {
    expect(detect(join(DIR, FILES[0]!), null, REPO)).toMatchObject({ kind: "seasons" });
    expect(detect(null, { schema: "trip-season-basic/1", trip: "x" }, REPO)).toMatchObject({ kind: "seasons", folder: "x" });
  });
  it("rejects a bad month, a missing basis, an unknown key and a trip that is not the file name (Val shape)", () => {
    const base = load("quebec-2026.json");
    expect("v" in base.season.months).toBe(true);
    const bad = structuredClone(base);
    bad.season.months.v = [13];
    expect(run(bad, "quebec-2026").errors.map((e) => e.path)).toContain("/season/months/v/0");
    const noBasis = structuredClone(base);
    delete noBasis.season.label.basis;
    expect(run(noBasis, "quebec-2026").errors.some((e) => e.path === "/season/label/basis")).toBe(true);
    const extra = structuredClone(base);
    extra.season.weather.rainy = "x";
    expect(run(extra, "quebec-2026").errors.length).toBeGreaterThan(0);
    expect(run(base, "niagara-day-2026").errors.some((e) => e.path === "/trip")).toBe(true);
  });

  it("still accepts the first shape ({value, basis}), and reports its errors by key", () => {
    const old = legacy();
    expect("value" in old.season.months).toBe(true);
    expect(run(old, "switzerland-2027").errors).toEqual([]);
    const bad = structuredClone(old);
    bad.season.months.value = [13];
    expect(run(bad, "switzerland-2027").errors.map((e) => e.path)).toContain("/season/months/value/0");
    const wrongWord = structuredClone(old);
    wrongWord.season.why.basis = "official_info";
    expect(run(wrongWord, "switzerland-2027").errors.some((e) => e.path === "/season/why/basis")).toBe(true);
  });

  it("accepts a file that mixes the two shapes field by field", () => {
    const mixed = legacy();
    mixed.season.why = load("switzerland-2027.json").season.why;
    expect(run(mixed, "switzerland-2027").errors).toEqual([]);
  });

  it("a shown field (months, label, why) must hold a value; a weather Val may be searched_none", () => {
    const base = load("quebec-2026.json");
    const none = { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-25" };
    const label = structuredClone(base);
    label.season.label = none;
    expect(run(label, "quebec-2026").errors.some((e) => e.path.startsWith("/season/label"))).toBe(true);
    const rain = structuredClone(base);
    rain.season.weather.rain = none;
    expect(run(rain, "quebec-2026").errors).toEqual([]);
  });

  it("months_basis plan_months contradicts an official months basis, in either shape", () => {
    const val = load("quebec-2026.json");
    expect(val.months_basis).toBe("plan_months");
    val.season.months.basis = "official_info";
    expect(run(val, "quebec-2026").errors.map((e) => e.path)).toEqual(["/season/months/basis"]);
    const old = legacy();
    old.months_basis = "plan_months";
    old.season.months.basis = "official";
    expect(run(old, "switzerland-2027").errors.map((e) => e.path)).toEqual(["/season/months/basis"]);
    const unknown = load("quebec-2026.json");
    unknown.months_basis = "researched_months";
    expect(run(unknown, "quebec-2026").errors.some((e) => e.path === "/months_basis")).toBe(true);
  });

  it("a weather note with a null basis must be a searched_none claim, and a searched_none claim has no basis", () => {
    const base = load("costa-rica-2027.json");
    const i = base.season.weather.notes.findIndex((n: { state?: string }) => n.state === "searched_none");
    expect(i).toBeGreaterThanOrEqual(0);
    const noState = structuredClone(base);
    delete noState.season.weather.notes[i].state;
    expect(run(noState, "costa-rica-2027").errors.map((e) => e.path)).toEqual([`/season/weather/notes/${i}/basis`]);
    const withBasis = structuredClone(base);
    withBasis.season.weather.notes[i].basis = "official_info";
    expect(run(withBasis, "costa-rica-2027").errors.map((e) => e.path)).toEqual([`/season/weather/notes/${i}/basis`]);
  });
});
