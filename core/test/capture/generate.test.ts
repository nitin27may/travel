import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applicabilityFile, checkDrift, generate, writeAll } from "../../src/capture/generate.ts";
import { DEFAULT_TYPES, countsOf } from "../../src/capture/tree.ts";
import { APPLICABILITY_PATHS } from "../../src/suitability/paths.ts";
import { REPO, scratchRoot } from "./helpers.ts";

const CLI = join(REPO, "core", "bin", "capture.ts");
const cli = (root: string, ...args: string[]) => spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8" });

describe("the generator (step 2)", () => {
  it("the committed generated files match types.json and the registry", () => {
    expect(checkDrift(REPO)).toEqual([]);
  });
  it("is deterministic", () => {
    expect(generate(DEFAULT_TYPES).map((o) => o.text)).toEqual(generate(DEFAULT_TYPES).map((o) => o.text));
  });
  it("writes one contract file per domain, the UI contract, the applicability file and one checklist per domain", () => {
    const paths = generate(DEFAULT_TYPES).map((o) => o.path);
    const domains = DEFAULT_TYPES.nodes.filter((n) => n.level === "domain").length;
    expect(paths.filter((p) => p.startsWith("data/schema/capture/")).length).toBe(domains + 1);
    expect(paths).toContain("data/schema/capture/contract.json");
    expect(paths).toContain("data/schema/suitability-applicability.json");
    expect(paths.filter((p) => p.startsWith("docs/v2/research/capture/")).length).toBe(domains);
  });
  it("generates the applicability file in the shape suitability.ts reads: every profile states every path", () => {
    const app = JSON.parse(applicabilityFile(DEFAULT_TYPES).text) as { profiles: Record<string, { fields: Record<string, string>; match: { kind: string; subkind: string }[] }> };
    expect(Object.keys(app.profiles)).toHaveLength(Object.keys(DEFAULT_TYPES.profiles).length);
    for (const [name, p] of Object.entries(app.profiles)) expect(Object.keys(p.fields).sort(), name).toEqual([...APPLICABILITY_PATHS].sort());
    expect(app.profiles.ferrata).toMatchObject({ operated: "flag" });
    expect(app.profiles.rafting!.match).toContainEqual({ kind: "activity", subkind: "rafting" });
  });
  it("a node that resolves like its parent says so instead of repeating the table", () => {
    const water = JSON.parse(generate(DEFAULT_TYPES).find((o) => o.path === "data/schema/capture/water.json")!.text) as { nodes: Record<string, { inherits?: string; layers?: unknown }> };
    expect(water.nodes["water.paddle.kayak.sea_kayak"]!.inherits).toBe("water.paddle.kayak");
    expect(water.nodes["water.paddle"]!.inherits).toBeUndefined();
    expect(water.nodes["water.paddle"]!.layers).toBeDefined();
  });
  it("an edit to types.json shows up as drift, and build repairs it", () => {
    const root = scratchRoot();
    expect(writeAll(root).written.length).toBeGreaterThan(0);
    expect(checkDrift(root)).toEqual([]);
    const p = join(root, "data/vocab/types.json");
    writeFileSync(p, readFileSync(p, "utf8").replace('"label": "Zip lines"', '"label": "Zip lines and swings"'));
    expect(checkDrift(root).length).toBeGreaterThan(0);
    writeAll(root);
    expect(checkDrift(root)).toEqual([]);
  });
  it("a generated file that was edited by hand fails the check; a stale one is removed", () => {
    const root = scratchRoot();
    writeAll(root);
    writeFileSync(join(root, "data/schema/suitability-applicability.json"), "{}\n");
    writeFileSync(join(root, "data/schema/capture/ghost.json"), "{}\n");
    const drift = checkDrift(root);
    expect(drift).toContainEqual({ path: "data/schema/suitability-applicability.json", reason: "differs" });
    expect(drift).toContainEqual({ path: "data/schema/capture/ghost.json", reason: "stale" });
    expect(writeAll(root).removed).toEqual(["data/schema/capture/ghost.json"]);
  });
});

describe("capture.ts (step 2)", () => {
  it("types prints the counts", () => {
    const c = countsOf(DEFAULT_TYPES);
    expect(cli(REPO, "types").stdout).toContain(`${c.domains} domains, ${c.categories} categories, ${c.ids} type ids (${c.types} types and ${c.subtypes} subtypes)`);
  });
  it("fields --type prints the checklist: R, R? with its condition, A", () => {
    const r = cli(REPO, "fields", "--type", "water.river.tubing");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("water.river.tubing");
    expect(r.stdout).toMatch(/-- offer \(rental\)/);
    expect(r.stdout).toMatch(/R {3}name, type, summary, season, hours/);
    expect(r.stdout).toContain("water_safety.lifejacket");
  });
  it("fields --format json is for crawlers and the MCP resource", () => {
    const j = JSON.parse(cli(REPO, "fields", "--type", "water.river.tubing", "--format", "json").stdout) as { type: string; layers: { offer: { R: { key: string; gap: string; section: string }[] } }; sources_in_order: string[]; suitability: { R: { key: string }[] } };
    expect(j.type).toBe("water.river.tubing");
    expect(j.layers.offer.R.map((x) => x.key)).toContain("price");
    expect(j.layers.offer.R.find((x) => x.key === "price")).toMatchObject({ gap: "Price not published", section: "options" });
    expect(j.sources_in_order).toEqual(["O", "F", "T"]);
    expect(j.suitability.R.map((x) => x.key)).toContain("min_age");
  });
  it("fields resolves an old kind and subkind, an alias and a word", () => {
    expect(JSON.parse(cli(REPO, "fields", "--kind", "activity", "--subkind", "rafting", "--format", "json").stdout).type).toBe("water.river.rafting");
    expect(JSON.parse(cli(REPO, "fields", "--kind", "lake", "--format", "json").stdout).type).toBe("water.body.lake");
    expect(JSON.parse(cli(REPO, "fields", "--type", "sea-doo", "--format", "json").stdout).type).toBe("water.motor.jet_ski");
    expect(cli(REPO, "fields", "--type", "nonsense").status).toBe(2);
  });
  it("explain names the ancestor each mark comes from", () => {
    const out = cli(REPO, "explain", "air.zip.zipline.kids_course").stdout;
    expect(out).toContain("inherits: air > air.zip > air.zip.zipline > air.zip.zipline.kids_course");
    expect(out).toMatch(/adult_required\s+R\s+from air.zip.zipline.kids_course/);
  });
  it("build --check passes on the repository and fails on a scratch root with nothing generated", () => {
    expect(cli(REPO, "build", "--check").status).toBe(0);
    const root = scratchRoot();
    const r = cli(root, "build", "--check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("DRIFT missing");
    expect(cli(root, "build").status).toBe(0);
    expect(cli(root, "build", "--check").status).toBe(0);
  });
  it("is wired into tools/check-all.sh", () => {
    expect(readFileSync(join(REPO, "tools/check-all.sh"), "utf8")).toMatch(/capture\.ts" build --check/);
    void execFileSync;
  });
});
