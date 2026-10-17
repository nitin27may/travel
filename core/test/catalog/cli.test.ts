import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO, SIDECARS, TODAY, tmpRoot } from "./util.ts";

const run = (root: string, ...args: string[]): string =>
  execFileSync("node", [join(REPO, "core/bin/catalog.ts"), ...args, "--root", root, "--date", TODAY], { encoding: "utf8", env: { ...process.env, TRAVEL_NOW: `${TODAY}T15:00:00Z`, TRAVEL_TODAY: TODAY } });

describe("core/bin/catalog.ts", () => {
  const root = tmpRoot();

  it("normalise and match print the records", () => {
    expect(run(root, "normalise", SIDECARS.trails)).toContain("3 record(s)");
    expect(run(root, "match", SIDECARS.trails)).toMatch(/trails\s+AR\/santa-cruz\/el-chalten\/laguna-de-los-tres\s+new/);
  });

  it("propose, apply, then propose again is empty", () => {
    const out = run(root, "propose", SIDECARS.trails);
    const id = /proposal (cp-[^:]+):/.exec(out)![1]!;
    expect(out).toContain("3 change(s), 3 auto-accepted");
    expect(run(root, "apply", id, "--actor", "agent:trails")).toContain("OK catalog.apply");
    expect(existsSync(join(root, "data/catalog/trails/AR.json"))).toBe(true);
    expect(run(root, "propose", SIDECARS.trails)).toContain("nothing to propose");
  });

  it("freshness, coverage and backlog report and write deterministic files", () => {
    expect(run(root, "freshness", "--date", "2027-06-01")).toContain("expired field(s)");
    run(root, "coverage", "--write");
    run(root, "backlog", "--write");
    const cov1 = readFileSync(join(root, "data/catalog/coverage.json"), "utf8");
    const bl1 = readFileSync(join(root, "data/catalog/backlog.json"), "utf8");
    run(root, "coverage", "--write");
    run(root, "backlog", "--write");
    expect(readFileSync(join(root, "data/catalog/coverage.json"), "utf8")).toBe(cov1);
    expect(readFileSync(join(root, "data/catalog/backlog.json"), "utf8")).toBe(bl1);
    expect(JSON.parse(cov1).areas.some((a: any) => a.area_id === "AR/santa-cruz/el-chalten" && a.level === "area")).toBe(true);
  });

  it("an unknown step fails with the usage", () => {
    expect(() => run(root, "nonsense")).toThrow();
  });
});
