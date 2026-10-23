import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkInputs } from "../../src/relevance/inputsCheck.ts";
import { northOfHome } from "../privacy/probe.ts";

// The household point is core/src/privacy/home.ts: the relevance input check uses it even where no private-origin.local.json exists.
function root(points: unknown): string {
  const r = mkdtempSync(join(tmpdir(), "inputs-"));
  mkdirSync(join(r, "data", "relevance", "inputs"), { recursive: true });
  writeFileSync(join(r, "data", "relevance", "inputs", "points.json"), JSON.stringify(points));
  return r;
}

describe("checkInputs and the home point", () => {
  it("flags a point inside the exclusion radius, with no local origin file", () => {
    const p = northOfHome(0.4);
    const issues = checkInputs(root({ schema: "relevance-points/1", points: { "place/x": { lat: p.lat, lon: p.lon, coord_src: "wikidata:P625" } }, towns: [] }));
    expect(issues.map((i) => i.code)).toContain("E_REL_HOUSEHOLD");
    expect(JSON.stringify(issues)).not.toContain(String(p.lat).slice(0, 6));
  });
  it("accepts a public point", () => {
    expect(checkInputs(root({ schema: "relevance-points/1", points: { "place/x": { lat: 51.1, lon: -115.5, coord_src: "wikidata:P625" } }, towns: [] }))).toEqual([]);
  });
});
