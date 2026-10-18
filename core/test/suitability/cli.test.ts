import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { duplicateRefsAcrossFiles, missingCoverage } from "../../src/suitability/refs.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core", "test", "fixtures", "suitability");
const BIN = join(REPO, "core", "bin", "suitability.ts");
const run = (root: string, ...args: string[]) => spawnSync(process.execPath, [BIN, ...args, "--root", root], { encoding: "utf8", env: { ...process.env, SUITABILITY_TODAY: "2026-10-18" } });
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

function scratch(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "suit-cli-"));
  tmp.push(root);
  cpSync(join(FIX, "root", "data"), join(root, "data"), { recursive: true });
  cpSync(join(FIX, "root", "legacy"), join(root, "legacy"), { recursive: true });
  for (const [rel, src] of Object.entries(files)) {
    mkdirSync(join(root, "data/suitability/fixture-trip"), { recursive: true });
    writeFileSync(join(root, "data/suitability/fixture-trip", rel), readFileSync(join(FIX, src), "utf8"));
  }
  return root;
}

describe("suitability check", () => {
  it("passes on the repository", () => {
    const r = run(REPO, "check");
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^OK: 9 suitability file\(s\), 0 error\(s\)/m);
  });
  it("covers every in-scope ref of every migrated trip", () => {
    for (const trip of ["dolomites-2027", "canadian-rockies-2029", "iceland-ring-road-2027", "utah-five-parks", "patagonia-2027", "chamonix-mont-blanc-2028", "algonquin-muskoka-2026", "vermont-fall-2026"]) {
      expect(missingCoverage(REPO, trip), trip).toEqual([]);
      expect(run(REPO, "check", "--coverage", trip).status, trip).toBe(0);
    }
  });
  it("lists the refs of a trip no file covers", () => {
    const root = scratch({ "R1.json": "valid/lake.json" });
    expect(missingCoverage(root, "fixture-trip")).toEqual(["legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass"]);
    const r = run(root, "check", "--coverage", "fixture-trip");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("no record for legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass");
  });
  it("a lane file supersedes a migrated record of the same ref: not a duplicate", () => {
    const root = scratch({ "migrated.json": "valid/lake.json", "R1.json": "valid/lake.json" });
    expect(duplicateRefsAcrossFiles(root, "fixture-trip").size).toBe(0);
    expect(run(root, "check").status).toBe(0);
  });
  it("two lane files with one ref are a duplicate", () => {
    const root = scratch({ "R1.json": "valid/lake.json", "R2.json": "valid/lake.json" });
    expect([...duplicateRefsAcrossFiles(root, "fixture-trip").keys()]).toContain("place/lago-di-braies");
  });
  it("two files that cover different refs pass the coverage check", () => {
    const root = scratch({ "R1.json": "valid/lake.json", "R2.json": "valid/trail-and-activity.json" });
    expect(missingCoverage(root, "fixture-trip")).toEqual([]);
    expect(duplicateRefsAcrossFiles(root, "fixture-trip").size).toBe(0);
    expect(run(root, "check", "--coverage", "fixture-trip").status).toBe(0);
  });
  it("fails on a broken file and prints the code, the file and the pointer", () => {
    const root = scratch({ "R1.json": "broken/E_SUIT_LIMIT_BASIS.json" });
    const r = run(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^ERROR E_SUIT_LIMIT_BASIS data\/suitability\/fixture-trip\/R1\.json#\/records\/0\/suitability\/min_age\/basis: /m);
  });
  it("--json prints one object per file", () => {
    const root = scratch({ "R1.json": "valid/lake.json" });
    const out = JSON.parse(run(root, "check", "--json").stdout) as { file: string; errors: unknown[] }[];
    expect(out).toHaveLength(1);
    expect(out[0]!.file).toBe("data/suitability/fixture-trip/R1.json");
  });
  it("validate --all takes the migrated files too", () => {
    const r = spawnSync(process.execPath, [join(REPO, "core/bin/validate.ts"), "--all", "--root", REPO], { encoding: "utf8" });
    expect(r.status, r.stdout).toBe(0);
  });
  it("is wired into the local gate after the data validation", () => {
    const gate = readFileSync(join(REPO, "tools/check-all.sh"), "utf8");
    expect(gate).toMatch(/validate every data file[\s\S]*suitability\.ts" check/);
  });
});

describe("suitability derive", () => {
  it("prints the computed effort of every record", () => {
    const r = run(REPO, "derive");
    expect(r.stdout).toContain("legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass\tterrain - (-)\teffort_km 18.7\tband 3\tFE3");
    expect(r.status).toBe(0); // the migrated files carry an up-to-date flat copy
  });
  it("exits 1 when a flat copy is stale, and --write fixes it", () => {
    const root = scratch({ "R1.json": "broken/E_SUIT_FLAT_DRIFT.json" });
    expect(run(root, "derive").status).toBe(1);
    const w = run(root, "derive", "--write");
    expect(w.status).toBe(0);
    expect(run(root, "derive").status).toBe(0);
    expect(run(root, "check").status).toBe(0);
  });
  it("--write adds a missing flat copy", () => {
    const root = scratch({ "R1.json": "warn/W_SUIT_FLAT_MISSING.json" });
    expect(run(root, "check").stdout).toContain("0 error(s), 1 warning(s)");
    run(root, "derive", "--write");
    const doc = JSON.parse(readFileSync(join(root, "data/suitability/fixture-trip/R1.json"), "utf8"));
    expect(doc.records[0].flat.min_age).toBe(8);
    expect(run(root, "check").stdout).toContain("0 error(s), 0 warning(s)");
  });
  it("--from-tracks is off until L4b tracks exist, and says so", () => {
    const r = run(REPO, "derive", "--from-tracks");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/no track files/);
  });
});

describe("suitability migrate and codes", () => {
  it("migrate prints the per-trip table and succeeds when it matches spec 7.1", () => {
    const r = run(REPO, "migrate");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/dolomites-2027\t40\t40\t19\t/);
    expect(r.stdout).toMatch(/canadian-rockies-2029\t76\t76\t76\t/);
    expect(r.stdout).toMatch(/off-plan canadian-rockies-2029: 28 adventures, 29 trails, 20 sights/);
  });
  it("migrate --check passes when the committed files are what migrate writes", () => {
    const r = run(REPO, "migrate", "--check");
    expect(r.status, r.stderr).toBe(0);
  });
  it("codes lists every error and warning", () => {
    const out = run(REPO, "codes").stdout.trim().split("\n");
    expect(out).toContain("E_SUIT_LIMIT_BASIS");
    expect(out).toContain("W_SUIT_STALE");
    expect(out.length).toBe(19);
  });
  it("an unknown command is a usage error", () => {
    expect(run(REPO, "frobnicate").status).toBe(2);
  });
});
