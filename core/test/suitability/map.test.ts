import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDoc } from "../../src/validate/index.ts";
import { DEFAULT_MAP, gradesOf, modeFactor, terrainFromGrade } from "../../src/suitability/map.ts";
import type { GradeSystem } from "../../src/suitability/types.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core", "test", "fixtures", "suitability");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

// Every grade of every table in research/method/suitability.md section 2, with the terrain the spec gives it.
const TABLE: [GradeSystem, string, number][] = [
  ["sac", "T1", 2], ["sac", "T2", 3], ["sac", "T3", 4], ["sac", "T4", 5], ["sac", "T5", 5], ["sac", "T6", 5],
  ["cai", "T", 1], ["cai", "E", 3], ["cai", "EE", 4], ["cai", "EEA", 5],
  ["yds", "Class 1", 2], ["yds", "Class 2", 4], ["yds", "Class 3", 5], ["yds", "Class 4", 5], ["yds", "Class 5", 5],
  ["parks-canada", "Easy", 1], ["parks-canada", "Moderate", 2], ["parks-canada", "Difficult", 4], ["parks-canada", "Route", 5],
  ["nps", "Easy", 1], ["nps", "Moderate", 2], ["nps", "Strenuous", 3], ["nps", "Very strenuous", 4],
  ["apn", "Medium", 2],
  ["imba", "white", 1], ["imba", "green", 2], ["imba", "blue", 3], ["imba", "black", 4], ["imba", "double-black", 5],
  ["sts", "S0", 2], ["sts", "S1", 3], ["sts", "S2", 4], ["sts", "S3", 5], ["sts", "S4", 5], ["sts", "S5", 5],
  ["trailforks", "white", 1], ["trailforks", "green", 2], ["trailforks", "blue", 3], ["trailforks", "black", 4], ["trailforks", "double-black", 5], ["trailforks", "proline", 5],
  ["whistler", "green", 2], ["whistler", "blue", 3], ["whistler", "black", 4], ["whistler", "double-black", 5],
  ["bike-path", "car_free_paved", 1], ["bike-path", "car_free_gravel", 2], ["bike-path", "quiet_road", 3], ["bike-path", "shared_road", 4],
  ["schall", "A", 4], ["schall", "B", 4], ["schall", "C", 5], ["schall", "D", 5], ["schall", "E", 5],
  ["huesler", "K1", 4], ["huesler", "K2", 4], ["huesler", "K3", 5], ["huesler", "K6", 5],
  ["cai-ferrata", "F", 4], ["cai-ferrata", "PD", 4], ["cai-ferrata", "D", 5], ["cai-ferrata", "MD", 5], ["cai-ferrata", "ED", 5],
  ["osm-ferrata", "1", 4], ["osm-ferrata", "2", 4], ["osm-ferrata", "3", 5], ["osm-ferrata", "6", 5],
  ["whitewater", "I", 2], ["whitewater", "II", 3], ["whitewater", "III", 4], ["whitewater", "IV", 5], ["whitewater", "V", 5], ["whitewater", "VI", 5],
  ["flatwater", "sheltered", 1], ["flatwater", "open", 2], ["flatwater", "sea_sheltered", 2], ["flatwater", "sea_open", 3],
  ["piste-eu", "green", 1], ["piste-eu", "blue", 2], ["piste-eu", "red", 3], ["piste-eu", "black", 4], ["piste-eu", "off-piste", 5],
  ["piste-at-ch", "blue", 2], ["piste-at-ch", "red", 3], ["piste-at-ch", "black", 4],
  ["piste-na", "green", 2], ["piste-na", "blue", 3], ["piste-na", "black", 4], ["piste-na", "double-black", 5],
  ["piste-jp", "green", 2], ["piste-jp", "red", 3], ["piste-jp", "black", 4],
];

describe("difficulty-map v2", () => {
  it.each(TABLE)("%s %s maps to terrain %i", (system, value, want) => {
    expect(terrainFromGrade(DEFAULT_MAP, system, value, false)).toBe(want);
  });

  it("maps the flat row of SAC T1 and YDS Class 1 to 1 only when the surface is made and level", () => {
    expect(terrainFromGrade(DEFAULT_MAP, "sac", "T1", true)).toBe(1);
    expect(terrainFromGrade(DEFAULT_MAP, "sac", "T1", false)).toBe(2);
    expect(terrainFromGrade(DEFAULT_MAP, "yds", "Class 1", true)).toBe(1);
    expect(terrainFromGrade(DEFAULT_MAP, "sac", "T2", true)).toBe(3); // no flat row: the plain one
  });

  it("every system of the grade enum is in the file, and a grade outside a system maps to nothing", () => {
    const ids = DEFAULT_MAP.systems.map((s) => s.id);
    for (const s of ["cai", "schall", "huesler", "cai-ferrata", "osm-ferrata", "imba", "sts", "trailforks", "whistler", "bike-path", "whitewater", "flatwater", "piste-eu", "piste-at-ch", "piste-na", "piste-jp"]) expect(ids).toContain(s);
    expect(terrainFromGrade(DEFAULT_MAP, "sac", "T9", false)).toBeNull();
    expect(terrainFromGrade(DEFAULT_MAP, "local", "easy", false)).toBeNull();
  });

  it("systems with no mapping accept any word", () => {
    expect(gradesOf(DEFAULT_MAP, "local")).toBeNull();
    expect(gradesOf(DEFAULT_MAP, "operator")).toBeNull();
    expect(gradesOf(DEFAULT_MAP, "cai")).toEqual(["T", "E", "EE", "EEA"]);
  });

  it("has the mode factors, walk 1 and ride 0.25", () => {
    expect(modeFactor(DEFAULT_MAP, "walk")).toBe(1);
    expect(modeFactor(DEFAULT_MAP, "ride")).toBe(0.25);
  });

  it("gives every mapping row a source and a read date", () => {
    for (const s of DEFAULT_MAP.systems) for (const m of s.mappings) {
      expect(m.source, `${s.id} ${m.local}`).toBeTruthy();
      expect(m.read, `${s.id} ${m.local}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("validates as a file, version 2", () => {
    expect(validateDoc(read(join(REPO, "data/schema/difficulty-map.json")), "sidecar", REPO, { kind: "difficulty-map" }).errors).toEqual([]);
  });

  it("still validates version 1 (the file as committed before S0)", () => {
    const r = validateDoc(read(join(FIX, "difficulty-map-v1.json")), "sidecar", REPO, { kind: "difficulty-map" });
    expect(r.errors).toEqual([]);
  });

  it("rejects a version 2 mapping without a source or a read date, and without modes", () => {
    const bad = structuredClone(read(join(REPO, "data/schema/difficulty-map.json")));
    delete bad.systems[0].mappings[0].source;
    delete bad.systems[0].mappings[1].read;
    bad.modes = null;
    const r = validateDoc(bad, "sidecar", REPO, { kind: "difficulty-map" });
    expect(r.errors.map((e) => e.path).sort()).toEqual(["/modes", "/systems/0/mappings/0/source", "/systems/0/mappings/1/read"].sort());
  });

  it("accepts a source that is a URL, a docs/ path or a research/ path, and nothing else", () => {
    const sources = (s0: string, s1: string) => {
      const doc = structuredClone(read(join(REPO, "data/schema/difficulty-map.json")));
      doc.systems[0].mappings[0].source = s0;
      doc.systems[0].mappings[1].source = s1;
      return validateDoc(doc, "sidecar", REPO, { kind: "difficulty-map" }).errors.map((e) => e.path);
    };
    expect(sources("research/method/suitability.md", "docs/v2/plan.md")).toEqual([]);
    expect(sources("research/method/suitability.md", "https://example.org/x")).toEqual([]);
    expect(sources("legacy/foo/PLAN.md", "researchers/x.md")).toEqual(["/systems/0/mappings/0/source", "/systems/0/mappings/1/source"]);
  });
});
