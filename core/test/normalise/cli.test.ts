// The command line (RIS-N): help, argument errors, the budget mode, dupes and prose-links.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseCommand, parseFamilies } from "../../src/normalise/cli.ts";
import { findDuplicates } from "../../src/normalise/dupes.ts";
import { checkProseLinks } from "../../src/normalise/proseLinks.ts";
import { stampImportedFrom, sha256 } from "../../src/normalise/stamp.ts";
import { rowMeta } from "../../src/schema/rowMeta.ts";
import { capDoc, copyFixture, place, put, tmpRoot, val } from "./helpers.ts";

const cli = (root: string, ...argv: string[]) => {
  const lines: string[] = [];
  const errs: string[] = [];
  const code = normaliseCommand(argv, root, (s) => lines.push(s), (s) => errs.push(s));
  return { code, out: lines.join("\n"), err: errs.join("\n") };
};

describe("help and arguments", () => {
  it("--help documents every mode and rule", () => {
    const h = cli(tmpRoot(), "--help").out;
    for (const w of ["--check", "--report", "--write", "--family", "--budget", "dupes", "prose-links", "point_src", "estimate", "season_shape", "W_KEEP_UNREAD"]) expect(h).toContain(w);
  });

  it("no mode is an error with a hint; an unknown family is an error", () => {
    expect(cli(tmpRoot(), "--no-placement", "--run", "X").code).toBe(2);
    expect(cli(tmpRoot(), "--check", "--family", "nope").err).toContain("unknown family");
    expect(parseFamilies("trip-level")).toEqual(["windows", "base-plans", "seasons"]);
    expect(parseFamilies("capture,points")).toEqual(["capture", "points"]);
    expect(cli(tmpRoot(), "--check", "--read-default", "yesterday").code).toBe(2);
    expect(cli(tmpRoot(), "--check", "--run", "bad run!").code).toBe(2);
  });

  it("an empty repository is clean", () => {
    const r = cli(tmpRoot(), "--check", "--no-placement");
    expect(r.code).toBe(0);
    expect(r.out).toContain("OK: the files are in the contract");
  });

  it("--json prints the report and --check keeps its exit code", () => {
    const root = tmpRoot();
    copyFixture(root, "points.json", "data/capture/points.json");
    const j = cli(root, "--check", "--json", "--no-placement");
    expect(j.code).toBe(1);
    expect(JSON.parse(j.out).families.points.changes.point_src).toBe(8);
  });

  it("--run and --read-default reach the written meta", () => {
    const root = tmpRoot();
    copyFixture(root, "points.json", "data/capture/points.json");
    cli(root, "--write", "--run", "RIS-J", "--read-default", "2026-10-10", "--no-placement");
    const doc = JSON.parse(readFileSync(join(root, "data/capture/points.json"), "utf8"));
    const row = doc.points["legacy/canadian-rockies-sept-2029/adventures/banff-gondola"];
    expect(row.meta.run_id).toBe("RIS-J");
    expect(row.point_src.read).toBe("2026-10-10");
  });
});


describe("--budget", () => {
  it("--update creates the budget, --check passes, and a worse tree fails", () => {
    const root = tmpRoot();
    copyFixture(root, "points.json", "data/capture/points.json");
    mkdirSync(join(root, "core/test/normalise"), { recursive: true });
    expect(cli(root, "--budget", "--check", "--no-placement").code).toBe(1); // no budget file yet
    expect(cli(root, "--budget", "--update", "--no-placement").code).toBe(0);
    expect(cli(root, "--budget", "--check", "--no-placement").code).toBe(0);
    put(root, "data/capture/t/lane.json", capDoc([place("p", { origin: { from: "x/y", reason: "split" } })]));
    const worse = cli(root, "--budget", "--check", "--no-placement");
    expect(worse.code).toBe(1);
    expect(worse.out).toContain("RISE changes.capture.origin");
    expect(cli(root, "--budget", "--update", "--no-placement").code).toBe(1); // refuses to raise
    cli(root, "--write", "--no-placement");
    expect(cli(root, "--budget", "--update", "--no-placement").code).toBe(0); // lowering is allowed
  });
});

describe("dupes (S2)", () => {
  const lane = (records: unknown[]) => capDoc(records);
  const pts = (rows: Record<string, unknown>) => ({ schema: "capture-points/1", points: rows });

  it("finds the same OSM element, the same Wikidata item and the same name nearby; never writes", () => {
    const root = tmpRoot();
    put(root, "data/capture/t/lane.json", lane([
      place("a/one", { name: "Lake Agnes Tea House", type: "food.cafe.tea_house", osm_ref: "node/1" }),
      place("b/one", { name: "Lake Agnes Teahouse", type: "food.cafe.tea_house", osm_ref: "node/1" }),
      place("c/far", { name: "Lake Agnes Tea House", type: "food.cafe.tea_house" }),
      place("d/q1", { name: "Mount X", type: "nature.summit.summit" }),
      place("e/q1", { name: "Peak X", type: "nature.summit.summit" }),
      place("f/rel", { name: "Lake Agnes Tea House", type: "food.cafe.tea_house", reaches: ["a/one"] }),
    ]));
    put(root, "data/capture/points.json", pts({
      "a/one": { lat: 51.4, lon: -116.2, coord_src: "osm", point_source: "OSM node 11 x" },
      "b/one": { lat: 51.40005, lon: -116.20005, coord_src: "osm", point_source: "OSM node 12 y" },
      "c/far": { lat: 52.4, lon: -116.2, coord_src: "osm", point_source: "OSM node 13 z" },
      "d/q1": { lat: 50, lon: -115, coord_src: "wikidata", point_source: "Wikidata Q42 P625" },
      "e/q1": { lat: 50.5, lon: -115.5, coord_src: "wikidata", point_source: "Wikidata Q42 P625" },
      "f/rel": { lat: 51.4, lon: -116.2, coord_src: "osm", point_source: "OSM node 14 w" },
    }));
    const found = findDuplicates(root);
    const key = (d: { a: string; b: string; reason: string }) => `${d.reason} ${d.a} ${d.b}`;
    expect(found.map(key).sort()).toEqual(["name_near a/one b/one", "name_near b/one f/rel", "osm_ref a/one b/one", "wikidata d/q1 e/q1"]);
    // f/rel names a/one in `reaches`, so that pair is not a candidate (b/one and f/rel still are); c/far is 111 km away
    expect(found.some((d) => d.a === "a/one" && d.b === "f/rel")).toBe(false);
    expect(found.some((d) => d.a === "c/far" || d.b === "c/far")).toBe(false);
    const out = cli(root, "dupes");
    expect(out.code).toBe(0);
    expect(out.out).toContain("4 candidate pair(s)");
  });

  it("a pair the slug registry merged is not offered again", () => {
    const root = tmpRoot();
    put(root, "data/capture/t/lane.json", lane([place("a/x", { osm_ref: "way/5" }), place("b/x", { osm_ref: "way/5" })]));
    expect(findDuplicates(root)).toHaveLength(1);
    put(root, "data/catalogue/slugs.json", { schema: "catalogue-slugs/2", places: { slugs: {}, merged: { "a/x": "b/x" } } });
    expect(findDuplicates(root)).toEqual([]);
  });
});

describe("prose-links (4.4)", () => {
  it("fails on a RECORDED marker naming a missing record or file, and on a research_ref to a missing file", () => {
    const root = tmpRoot();
    put(root, "data/capture/t/lane.json", capDoc([place("real/ref", { meta: { schema_version: 1, research_ref: ["research/runs/x.md#a", "research/runs/missing.md"] } })]));
    mkdirSync(join(root, "research/runs"), { recursive: true });
    writeFileSync(join(root, "research/runs/x.md"), "# a\nRECORDED real/ref data/capture/t/lane.json 2026-10-25\nRECORDED ghost/ref data/capture/t/lane.json 2026-10-25\nRECORDED real/ref data/nope.json 2026-10-25\n");
    const kinds = checkProseLinks(root).map((i) => i.kind).sort();
    expect(kinds).toEqual(["recorded_path", "recorded_ref", "research_ref"]);
    expect(cli(root, "prose-links", "--check").code).toBe(1);
    expect(cli(root, "prose-links").code).toBe(0);
  });
});

describe("what the loader stamps", () => {
  it("imported_from is the path and the sha256 of the file read, and the block passes RowMeta; the normaliser never writes it", () => {
    const text = '{"a":1}\n';
    const meta = stampImportedFrom({ schema_version: 1, review_state: "agent_checked" }, "data/capture/points.json", text, "RIS-L", new Date("2026-10-26T00:00:00Z"));
    expect(meta.imported_from).toEqual({ file: "data/capture/points.json", sha256: sha256(text) });
    expect(rowMeta.safeParse(meta).success).toBe(true);
    const root = tmpRoot();
    copyFixture(root, "points.json", "data/capture/points.json");
    cli(root, "--write", "--no-placement");
    expect(readFileSync(join(root, "data/capture/points.json"), "utf8")).not.toContain("imported_from");
  });
});
