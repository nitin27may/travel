import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = join(REPO, "data", "seasons");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
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
  it("rejects a bad month, a missing basis, an unknown key and a trip that is not the file name", () => {
    const base = load("quebec-2026.json");
    const bad = structuredClone(base);
    bad.season.months.value = [13];
    expect(run(bad, "quebec-2026").errors.length).toBeGreaterThan(0);
    const noBasis = structuredClone(base);
    delete noBasis.season.label.basis;
    expect(run(noBasis, "quebec-2026").errors.some((e) => e.path.includes("label"))).toBe(true);
    const extra = structuredClone(base);
    extra.season.weather.rainy = "x";
    expect(run(extra, "quebec-2026").errors.length).toBeGreaterThan(0);
    expect(run(base, "niagara-day-2026").errors.some((e) => e.path === "/trip")).toBe(true);
  });
});
