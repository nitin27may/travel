// META-2: the committed towns layer (data/reference/towns, written only by tools/towns.py from the GeoNames dump) as the core reader sees it.
// The python tests (tools/tests/test_towns.py) pin the rows to the dump; these pin that the reader refuses anything that is not the manifest's.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readTownsFiles, TOWNS_DIR, hasTownsFiles } from "../../src/derive/townsData.ts";
import { TOWN_ID_RE } from "../../src/schema/capture/points.ts";
import { REPO } from "../capture/helpers.ts";

const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));
const copy = (): string => {
  const root = mkdtempSync(join(tmpdir(), "towns-"));
  tmp.push(root);
  cpSync(join(REPO, TOWNS_DIR), join(root, TOWNS_DIR), { recursive: true });
  return root;
};

describe("readTownsFiles", () => {
  const layer = readTownsFiles(REPO);
  it("reads every part the manifest lists, with CC BY 4.0 on record", () => {
    expect(hasTownsFiles(REPO)).toBe(true);
    expect(layer.rows.length).toBe(layer.manifest.totals.rows);
    expect(layer.manifest.source.licence.id).toBe("CC BY 4.0");
    expect(layer.manifest.source.licence.attribution).toBe("Contains data from GeoNames, CC BY 4.0");
  });
  it("holds unique, well-formed ids, and a country on every row", () => {
    const ids = new Set(layer.rows.map((r) => r.id));
    expect(ids.size).toBe(layer.rows.length);
    for (const r of layer.rows) {
      expect(r.id, r.id).toMatch(TOWN_ID_RE);
      expect(r.id.startsWith(`${r.cc}-${r.admin1}-`), r.id).toBe(true);
      expect(r.pop).toBeGreaterThanOrEqual(layer.manifest.filter.population_min);
    }
  });
  it("resolves the named towns by id", () => {
    const by = new Map(layer.rows.map((r) => [r.id, r]));
    for (const id of ["ca-on-whitby", "ca-on-oshawa", "ca-on-ajax", "ca-ab-canmore", "it-34-cortina-d-ampezzo"]) expect(by.has(id), id).toBe(true);
    expect(by.get("ca-ab-canmore")!.admin1Name).toBe("Alberta");
  });
  it("keeps every part under the gzip budget the manifest states", () => {
    for (const p of layer.manifest.parts) expect(p.gzip, p.file).toBeLessThanOrEqual(20_000);
  });
  it("refuses a part whose bytes are not the manifest's (a hand-edited point)", () => {
    const root = copy();
    const file = join(root, TOWNS_DIR, "ca.json");
    writeFileSync(file, readFileSync(file, "utf8").replace(/(\d+\.\d+)/, (m) => String(Number(m) + 0.00001)));
    expect(() => readTownsFiles(root)).toThrow(/differs from the manifest/);
  });
  it("refuses a missing manifest and a missing part", () => {
    const root = copy();
    rmSync(join(root, TOWNS_DIR, readdirSync(join(root, TOWNS_DIR)).find((f) => f.startsWith("is"))!));
    expect(() => readTownsFiles(root)).toThrow();
    rmSync(join(root, TOWNS_DIR, "manifest.json"));
    expect(() => readTownsFiles(root)).toThrow(/manifest\.json is missing/);
  });
});
