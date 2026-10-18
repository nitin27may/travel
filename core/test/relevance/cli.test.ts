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
    put(root, "data/relevance/inputs/points.json", { schema: "relevance-points/1", points: { "place/fenland-loop": { lat: 51.183, lon: -115.561, coord_src: "wikidata:P625" } }, towns: [{ id: "banff", name: "Banff", lat: 51.1784, lon: -115.5708, has_stay: true }] });
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

describe("check validates the inputs", () => {
  const tor = { id: "toronto", name: "Toronto City Hall", lat: 43.6534, lon: -79.3841, public: true };
  const pts = (over: Record<string, unknown> = {}) => ({ schema: "relevance-points/1", points: { "place/x": { lat: 51.1, lon: -115.5, coord_src: "wikidata:P625" } }, towns: [], ...over });
  it("accepts a public allowlisted hub and a point with a coord_src", () => {
    const root = repo();
    put(root, "data/relevance/inputs/hub-matrix.json", { schema: "hub-matrix/1", hubs: [tor], minutes: { "place/x": { toronto: 55 } } });
    put(root, "data/relevance/inputs/points.json", pts());
    const r = cli(root, "check");
    expect(r.status, r.stdout).toBe(0);
  });
  it("refuses a hub that is not public, or public but off the allowlist", () => {
    for (const hub of [{ ...tor, public: false }, { ...tor, id: "elsewhere", name: "Elsewhere" }]) {
      const root = repo();
      put(root, "data/relevance/inputs/hub-matrix.json", { schema: "hub-matrix/1", hubs: [hub], minutes: {} });
      const r = cli(root, "check");
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("E_REL_HOUSEHOLD");
    }
  });
  it("refuses a point, town, hub or base within 2 km of a private origin, and skips quietly when there is none", () => {
    const root = repo();
    put(root, "data/relevance/inputs/points.json", pts({ towns: [{ id: "t", name: "T", lat: 51.1005, lon: -115.5005, has_stay: true }] }));
    expect(cli(root, "check").status).toBe(0); // no private-origin.local.json: nothing to compare
    put(root, "data/relevance/inputs/private-origin.local.json", { lat: 51.1, lon: -115.5 });
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/point "place\/x" lies within 2 km/);
    expect(r.stdout).toMatch(/town "T" lies within 2 km/);
    // 2.5 km away is fine
    put(root, "data/relevance/inputs/points.json", pts({ points: { "place/x": { lat: 51.1225, lon: -115.5, coord_src: "osm:node/1" } } }));
    expect(cli(root, "check").status).toBe(0);
  });
  it("the private origin file is gitignored", () => {
    const g = readFileSync(join(CORE, "..", ".gitignore"), "utf8");
    expect(g).toContain("data/relevance/inputs/private-origin.local.json");
  });
  it("needs a coord_src that is not Google", () => {
    const root = repo();
    put(root, "data/relevance/inputs/points.json", pts({ points: { "place/x": { lat: 51.1, lon: -115.5 } } }));
    expect(cli(root, "check").stdout).toContain("coord_src");
    put(root, "data/relevance/inputs/points.json", pts({ points: { "place/x": { lat: 51.1, lon: -115.5, coord_src: "google maps pin" } } }));
    const r = cli(root, "check");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_REL_LINK_ONLY_SRC");
  });
  it("rejects household keys in the inputs", () => {
    const root = repo();
    put(root, "data/relevance/inputs/points.json", pts({ home: { lat: 1, lon: 2 } }));
    expect(cli(root, "check").stdout).toContain("E_REL_HOUSEHOLD");
  });
});

describe("freshness and the calendar", () => {
  const setup = () => {
    const root = repo();
    put(root, "data/relevance/t/R1.json", doc([rec({ ref: "place/fenland-loop", draw: "world", standing: "top" })], { trip: "t", researched: "2026-10-01" }));
    return root;
  };
  it("derive --write pins as_of, and --check on a later date still passes, with a warning count", () => {
    const root = setup();
    expect(cli(root, "derive", "--write", "--today", "2026-10-18").status).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "data/relevance/derived/t.json"), "utf8")).as_of).toBe("2026-10-18");
    const later = cli(root, "derive", "--check", "--today", "2031-01-01");
    expect(later.status).toBe(0);
    expect(later.stdout).toMatch(/WARN \d+ value\(s\) went stale/);
    const same = cli(root, "derive", "--check", "--today", "2026-10-19");
    expect(same.status).toBe(0);
    expect(same.stdout).not.toContain("WARN");
  });
  it("a real change in the data still fails --check", () => {
    const root = setup();
    cli(root, "derive", "--write", "--today", "2026-10-18");
    put(root, "data/relevance/t/R1.json", doc([rec({ ref: "place/fenland-loop", draw: "local", standing: "top" })], { trip: "t", researched: "2026-10-01" }));
    expect(cli(root, "derive", "--check", "--today", "2031-01-01").status).toBe(1);
  });
  it("stale values are gaps in a file written at a late date", () => {
    const root = setup();
    cli(root, "derive", "--write", "--today", "2031-01-01");
    const j = JSON.parse(readFileSync(join(root, "data/relevance/derived/t.json"), "utf8"));
    expect(j.items[0].stale).toContain("draw");
  });
  it("freshness lists stale values and never fails", () => {
    const root = setup();
    const r = cli(root, "freshness", "--today", "2031-01-01");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("place/fenland-loop\tdraw");
    expect(cli(root, "freshness", "--today", "2026-10-18").stdout).toContain("0 stale value(s)");
  });
});
