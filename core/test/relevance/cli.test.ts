import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { doc, rec } from "./helpers.ts";

const CORE = fileURLToPath(new URL("../..", import.meta.url));
const BIN = join(CORE, "bin", "relevance.ts");
const FIX_ROOT = join(CORE, "test", "fixtures", "relevance", "root");
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "rel-cli-"));
  tmp.push(root);
  cpSync(FIX_ROOT, root, { recursive: true });
  return root;
}
const put = (root: string, rel: string, body: unknown) => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
};
const cli = (root: string, ...args: string[]) => spawnSync("node", [BIN, ...args, "--root", root], { encoding: "utf8", env: { ...process.env, RELEVANCE_TODAY: "2026-10-18" } });

describe("relevance CLI", () => {
  it("check passes on an empty data/relevance (the state of the repo before the lanes run)", () => {
    const r = cli(repo(), "check");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("0 relevance file(s)");
  });
  it("check passes on a valid lane file and fails on a broken one, naming the code", () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec()], { trip: "t" }));
    expect(cli(root, "check").status).toBe(0);
    put(root, "data/relevance/t/R2.json", doc([rec({ ref: "place/moraine-lake" }), { ...rec({ ref: "place/fenland-loop" }), role: "anchor" } as never], { trip: "t", lane: "R2" }));
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_REL_TYPED_DERIVED");
  });
  it("check reports a ref shared by two lane files of a trip", () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec()], { trip: "t" }));
    put(root, "data/relevance/t/R2.json", doc([rec()], { trip: "t", lane: "R2" }));
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_REL_DUP_REF");
  });
  it("derive --write stores a deterministic file and --check detects drift", () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec({ ref: "place/fenland-loop", draw: "local", standing: "good" })], { trip: "t" }));
    put(root, "data/relevance/inputs/points.json", { schema: "relevance-points/1", points: { "place/fenland-loop": { lat: 51.183, lon: -115.561 } }, towns: [{ id: "banff", name: "Banff", lat: 51.1784, lon: -115.5708, has_stay: true }] });
    expect(cli(root, "derive", "--check").status).toBe(1); // nothing stored yet
    expect(cli(root, "derive", "--write").status).toBe(0);
    const path = join(root, "data/relevance/derived/t.json");
    const first = readFileSync(path, "utf8");
    const j = JSON.parse(first);
    expect(j.schema).toBe("relevance-derived/1");
    expect(j.items[0].role).toBe("filler");
    expect(cli(root, "derive", "--check").status).toBe(0);
    cli(root, "derive", "--write");
    expect(readFileSync(path, "utf8")).toBe(first);
    writeFileSync(path, first.replace("filler", "anchor"));
    const drift = cli(root, "derive", "--check");
    expect(drift.status).toBe(1);
    expect(drift.stderr).toContain("derive --write");
  });
  it("derive refuses a hub that is not marked public (household data)", () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec()], { trip: "t" }));
    put(root, "data/relevance/inputs/hub-matrix.json", { schema: "hub-matrix/1", hubs: [{ id: "home", name: "x", lat: 1, lon: 2, public: false }], minutes: {} });
    const r = cli(root, "derive", "--check");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("E_REL_HOUSEHOLD");
  });
  it("derive --check on an empty data/relevance passes", () => {
    expect(cli(repo(), "derive", "--check").status).toBe(0);
  });
  it("signals refuses to run without --fetch and writes nothing", () => {
    const root = repo();
    const r = cli(root, "signals");
    expect(r.status).toBe(2);
    expect(existsSync(join(root, "data/relevance/signals"))).toBe(false);
  });
  it("calibrate prints a table", () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec()], { trip: "t" }));
    const r = cli(root, "calibrate");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("within one tier");
  });
  it("codes lists every E_REL and W_REL code", () => {
    const r = cli(repo(), "codes");
    expect(r.stdout).toContain("E_REL_COPIED_RATING");
    expect(r.stdout).toContain("W_REL_DRAW_GAP");
  });
});
