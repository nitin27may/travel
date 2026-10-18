import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { put, tmpRoot, twoLaneRoot, lane, row, val } from "./helpers.ts";

const BIN = join(fileURLToPath(new URL("../..", import.meta.url)), "bin", "sources.ts");
const cli = (root: string, ...args: string[]) => spawnSync("node", [BIN, ...args, "--root", root], { encoding: "utf8" });
const built = () => {
  const root = twoLaneRoot();
  expect(cli(root, "build").status).toBe(0);
  return root;
};

describe("sources CLI", () => {
  it("build writes the registry and --check agrees", () => {
    const root = built();
    const reg = JSON.parse(readFileSync(join(root, "data/sources/registry.json"), "utf8"));
    expect(reg.schema).toBe("sources/1");
    expect(reg.entries).toHaveLength(2);
    expect(cli(root, "build", "--check").status).toBe(0);
  });
  it("check passes on a fresh registry and fails when it is missing", () => {
    const root = twoLaneRoot();
    const missing = cli(root, "check");
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain("does not exist");
    expect(cli(built(), "check").status).toBe(0);
  });
  it("check fails when a lane file gains a source (drift) and when the registry is hand-edited", () => {
    const root = built();
    put(root, "data/suitability/t/R2.json", lane([row("src-0001", "https://new.example/x")], [{ ref: "z", body: { suitability: { age_band: val(["src-0001"]) } } }]));
    const drift = cli(root, "check");
    expect(drift.status).toBe(1);
    expect(drift.stdout).toContain("drifts");
    expect(cli(root, "build").status).toBe(0);
    expect(cli(root, "check").status).toBe(0);
    const p = join(root, "data/sources/registry.json");
    put(root, "data/sources/registry.json", readFileSync(p, "utf8").replace("Pub", "Edited"));
    expect(cli(root, "check").status).toBe(1);
  });
  it("check fails on a bad id even when the file is otherwise derived", () => {
    const root = built();
    const p = join(root, "data/sources/registry.json");
    put(root, "data/sources/registry.json", readFileSync(p, "utf8").replace(/"id": "s-[0-9a-f]{10}"/, '"id": "s-0000000000"'));
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("not the hash");
  });
  it("check fails on a src id its file does not declare", () => {
    const root = tmpRoot();
    put(root, "data/suitability/t/R1.json", lane([row("src-0001", "https://a.com/x")], [{ ref: "r", body: { suitability: { age_band: val(["src-0042"]) } } }]));
    cli(root, "build");
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("src-0042");
  });
  it("who answers by url (any spelling) and by id", () => {
    const root = built();
    const byUrl = cli(root, "who", "HTTPS://example.com/Trail/?utm_medium=z&b=2&a=1");
    expect(byUrl.status).toBe(0);
    expect(byUrl.stdout).toContain("trail/a\tdraw");
    expect(byUrl.stdout).toContain("4 fact(s) rely on it");
    const id = JSON.parse(readFileSync(join(root, "data/sources/registry.json"), "utf8")).entries[1].id as string;
    expect(cli(root, "who", id).stdout).toContain("park.gov");
    expect(cli(root, "who", "https://nowhere.example/").status).toBe(1);
  });
  it("due lists sources past their cadence and ignores local files", () => {
    const root = built();
    // example.com: last read 18 Oct, 180 days (access_season); park.gov: read 1 Oct, 180 days
    expect(cli(root, "due", "--today", "2026-10-18").stdout).toContain("0 source(s) due");
    const later = cli(root, "due", "--today", "2027-04-10");
    expect(later.stdout).toContain("1 source(s) due");
    expect(later.stdout).toContain("park.gov");
    expect(cli(root, "due", "--today", "2027-05-01").stdout).toContain("2 source(s) due");
  });
  it("due --json carries the overdue days", () => {
    const rows = JSON.parse(cli(built(), "due", "--today", "2027-05-01", "--json").stdout) as { overdue_days: number; due: string }[];
    expect(rows.map((r) => r.due)).toEqual(["2027-03-30", "2027-04-16"]);
    expect(rows[0]!.overdue_days).toBe(32);
  });
  it("by-publisher counts sources and facts", () => {
    const r = cli(built(), "by-publisher");
    expect(r.stdout).toContain("2\t5\tPub");
  });
  it("links without --fetch makes no network call and prints the cached state", () => {
    const r = cli(built(), "links");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("unchecked 2");
  });
  it("shows usage and rejects an unknown command", () => {
    expect(cli(tmpRoot(), "--help").stdout).toContain("Usage:");
    expect(cli(tmpRoot(), "bogus").status).toBe(2);
  });
});
