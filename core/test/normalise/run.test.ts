// The engine on a scratch repository (RIS-N): read-only --check, --write, idempotency, the family filter, the ledger guard.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyReport, normaliseText, planNormalise } from "../../src/normalise/run.ts";
import { normaliseCommand } from "../../src/normalise/cli.ts";
import { capDoc, copyFixture, place, put, run, tmpRoot, val } from "./helpers.ts";

/** A scratch root with one lane of each family the rules touch. */
function fixtureRoot(): string {
  const root = tmpRoot();
  copyFixture(root, "capture-lane.json", "data/capture/canadian-rockies-2029/migrated.json");
  copyFixture(root, "points.json", "data/capture/points.json");
  copyFixture(root, "migration-ledger.json", "data/capture/migration-ledger.json");
  copyFixture(root, "season-switzerland-2027.json", "data/seasons/switzerland-2027.json");
  copyFixture(root, "windows-first.json", "data/windows/canadian-rockies-2029.json");
  copyFixture(root, "base-plans-first.json", "data/base-plans/canadian-rockies-2029.json");
  copyFixture(root, "suitability-estimate.json", "data/suitability/canadian-rockies-2029/R2a.json");
  return root;
}

const snapshot = (root: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[p.slice(root.length)] = readFileSync(p, "utf8");
    }
  };
  walk(root);
  return out;
};

const cli = (root: string, ...argv: string[]) => {
  const lines: string[] = [];
  const errs: string[] = [];
  const code = normaliseCommand(argv, root, (s) => lines.push(s), (s) => errs.push(s));
  return { code, out: lines.join("\n"), err: errs.join("\n") };
};

describe("--check and --report are read-only", () => {
  it("exit 1 while there is something to change, and not one byte on disk moves", () => {
    const root = fixtureRoot();
    const before = snapshot(root);
    const check = cli(root, "--check", "--no-placement");
    expect(check.code).toBe(1);
    expect(check.out).toContain("CHANGE point_src");
    expect(check.out).toContain("CHANGE basis");
    expect(check.out).toContain("NOT NORMALISED");
    const report = cli(root, "--report", "--no-placement");
    expect(report.code).toBe(0);
    expect(report.out).toMatch(/points\s+1\s+1\s+points_schema 1, point_src 8/);
    expect(snapshot(root)).toEqual(before);
  });

  it("--report prints counts per file family", () => {
    const root = fixtureRoot();
    const { out } = cli(root, "--report", "--no-placement");
    for (const fam of ["capture", "suitability", "points", "windows", "base-plans", "seasons"]) expect(out).toContain(fam);
    expect(out).toContain("findings:");
    expect(out).toContain("totals:");
  });
});

describe("--write", () => {
  it("writes the changed files, then --check exits 0 for what it can change", () => {
    const root = fixtureRoot();
    const w = cli(root, "--write", "--no-placement");
    expect(w.code).toBe(0);
    const c = cli(root, "--check", "--quiet", "--no-placement");
    expect(c.out).toContain("0 would change");
    expect(c.code).toBe(0);
  });

  it("a second --write changes no byte", () => {
    const root = fixtureRoot();
    cli(root, "--write", "--no-placement");
    const once = snapshot(root);
    const second = cli(root, "--write", "--no-placement");
    expect(second.out).toContain("wrote 0 file(s)");
    expect(snapshot(root)).toEqual(once);
  });

  it("changes only the files that need it", () => {
    const root = fixtureRoot();
    put(root, "data/capture/other/lane.json", capDoc([place("p", { near_town_km: val(5) })]));
    const before = snapshot(root);
    cli(root, "--write", "--no-placement");
    const after = snapshot(root);
    expect(after["/data/capture/other/lane.json"]).toBe(before["/data/capture/other/lane.json"]);
    expect(after["/data/seasons/switzerland-2027.json"]).not.toBe(before["/data/seasons/switzerland-2027.json"]);
  });

  it("--family limits the run", () => {
    const root = fixtureRoot();
    const before = snapshot(root);
    cli(root, "--write", "--family", "points", "--no-placement");
    const after = snapshot(root);
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
    expect(changed).toEqual(["/data/capture/points.json"]);
    expect(cli(root, "--check", "--family", "nonsense").code).toBe(2);
  });

  it("--file limits the run to one file", () => {
    const root = fixtureRoot();
    const rep = planNormalise({ root, files: ["data/seasons/switzerland-2027.json"], placement: false });
    expect(rep.files.map((f) => f.file)).toEqual(["data/seasons/switzerland-2027.json"]);
  });

  it("applyReport writes exactly what the report said it would", () => {
    const root = fixtureRoot();
    const rep = planNormalise({ root, placement: false });
    const wanted = rep.files.filter((f) => f.after !== f.before).map((f) => f.file).sort();
    expect(applyReport(rep, { placement: false }).sort()).toEqual(wanted);
    for (const f of rep.files) expect(readFileSync(join(root, f.file), "utf8")).toBe(f.after);
  });
});

describe("the migration ledger rule", () => {
  it("never lets a rule change a leaf of a suitability record: the document is left as it was", () => {
    const doc = {
      schema: "suitability/1", trip: "t", lane: "t", researched: "2026-10-18", agent: "x", model: "n", sources: [],
      records: [{ ref: "legacy/x/trails/a", kind: "trail", subkind: "hike", suitability: { effort: { drivers: { distance_km: val("5 mi") } } } }],
    };
    const r = run("suitability", doc);
    expect(r.out.records[0].suitability.effort.drivers.distance_km.v).toBe("5 mi");
    expect(r.findings.map((f) => f.code)).toContain("E_NORM_LEDGER");
    expect(r.changes).toEqual([]);
    expect(r.text).toBe(JSON.stringify(doc, null, 2) + "\n");
  });
});

describe("files it must not read", () => {
  it("ignores run records, splits, changesets and files of other schemas", () => {
    const root = tmpRoot();
    put(root, "data/capture/runs/r.json", { schema: "capture-run/1", results: [] });
    put(root, "data/capture/splits/t.json", { schema: "capture-splits/1", splits: [] });
    put(root, "data/capture/trip-x/other.json", { schema: "something-else/1" });
    put(root, "data/relevance/signals/s.json", { schema: "relevance/1", records: [] });
    expect(planNormalise({ root, placement: false }).files).toEqual([]);
  });

  it("reports a file that is not JSON instead of throwing", () => {
    const bad = normaliseText("{ not json", { family: "capture", file: "x.json" });
    expect(bad.findings.map((f) => f.code)).toEqual(["E_NORM_PARSE"]);
    expect(bad.text).toBe("{ not json");
    expect(normaliseText("[1]", { family: "capture", file: "x.json" }).findings.map((f) => f.code)).toEqual(["E_NORM_PARSE"]);
  });
});
