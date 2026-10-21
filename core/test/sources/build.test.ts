import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistry, registryText, srcUses } from "../../src/sources/build.ts";
import { sourceEntry } from "../../src/schema/sources.ts";
import { lane, put, row, tmpRoot, twoLaneRoot, val } from "./helpers.ts";

describe("buildRegistry", () => {
  it("merges the same page across files and spellings into one entry", () => {
    const { registry, lanes, rows } = buildRegistry(twoLaneRoot());
    expect(lanes).toBe(2);
    expect(rows).toBe(3);
    expect(registry.entries.map((e) => e.url)).toEqual(["https://example.com/Trail?a=1&b=2", "https://park.gov/rules"]);
  });
  it("merges used_by from the per-value src ids, folds conflicts into their value and de-duplicates", () => {
    const e = buildRegistry(twoLaneRoot()).registry.entries.find((x) => x.url.startsWith("https://example.com"))!;
    expect(e.used_by).toEqual([
      { file: "data/relevance/t/R6.json", ref: "trail/a", field: "draw" },
      { file: "data/relevance/t/R6.json", ref: "trail/b", field: "draw" },
      { file: "data/suitability/t/R1.json", ref: "trail/a", field: "suitability.access_season" },
      { file: "data/suitability/t/R1.json", ref: "trail/a", field: "suitability.min_age" },
    ]);
  });
  it("takes read dates, title and kind from the rows", () => {
    const e = buildRegistry(twoLaneRoot()).registry.entries[0]!;
    expect([e.first_read, e.last_read]).toEqual(["2026-10-01", "2026-10-18"]);
    expect(e.kind).toBe("editorial"); // official vs blog (editorial) tie one to one; the alphabetical first wins
    expect(e.recheck).toEqual({ cadence_days: 180, fact_type: "seasons_closures" });
    expect(e.link).toEqual({ status: "unchecked", checked: null });
  });
  it("is deterministic: the same inputs give the same bytes", () => {
    const root = twoLaneRoot();
    expect(registryText(buildRegistry(root).registry)).toBe(registryText(buildRegistry(root).registry));
  });
  it("produces entries the schema accepts", () => {
    for (const e of buildRegistry(twoLaneRoot()).registry.entries) expect(sourceEntry.safeParse(e).success).toBe(true);
  });
  it("reports a src id that its own file does not declare", () => {
    const root = tmpRoot();
    put(root, "data/suitability/t/R1.json", lane([row("src-0001", "https://a.com/x")], [{ ref: "r", body: { suitability: { age_band: val(["src-0009"]) } } }]));
    const { problems } = buildRegistry(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toContain("src-0009");
  });
  it("reports a duplicate source id inside one file", () => {
    const root = tmpRoot();
    put(root, "data/suitability/t/R1.json", lane([row("src-0001", "https://a.com/x"), row("src-0001", "https://a.com/y")], []));
    expect(buildRegistry(root).problems[0]!.message).toContain("twice");
  });
  it("marks repo paths local and keeps them out of link checks", () => {
    const root = tmpRoot();
    put(root, "data/suitability/t/R1.json", lane([row("src-0001", "legacy/x/PLAN.md", { kind: "computed", publisher: "this repo" })], []));
    const e = buildRegistry(root).registry.entries[0]!;
    expect(e.kind).toBe("reference");
    expect(e.link.status).toBe("local");
  });
  it("applies a cached link result", () => {
    const root = twoLaneRoot();
    const e = buildRegistry(root).registry.entries[1]!;
    const links = { schema: "source-links/1" as const, links: { [e.id]: { url: e.url, status: "broken" as const, http: 404, final: null, checked: "2026-10-18" } } };
    expect(buildRegistry(root, links).registry.entries[1]!.link).toEqual({ status: "broken", checked: "2026-10-18" });
  });
  it("skips derived, signals and inputs folders of data/relevance", () => {
    const root = twoLaneRoot();
    put(root, "data/relevance/derived/t.json", { sources: [row("src-0001", "https://zzz.com/")] });
    put(root, "data/relevance/signals/x.json", { sources: [row("src-0001", "https://yyy.com/")] });
    expect(buildRegistry(root).registry.entries).toHaveLength(2);
  });
});

describe("srcUses", () => {
  it("returns the dotted path of every value with a src list", () => {
    const uses = srcUses({ ref: "x", draw: val(["a"]), suitability: { effort: { drivers: { gain_m: { ...val(["b"]), conflicts: [{ src: ["c"] }] } } } }, hints: [{ field: "f", src: ["d"] }] });
    expect(uses).toEqual([
      { field: "draw", ids: ["a"] },
      { field: "suitability.effort.drivers.gain_m", ids: ["b"] },
      { field: "suitability.effort.drivers.gain_m", ids: ["c"] },
      { field: "hints", ids: ["d"] },
    ]);
  });
});

describe("the committed registry", () => {
  it("is what the lane files derive (the drift gate, also run by check-all)", () => {
    const root = join(import.meta.dirname, "..", "..", "..");
    expect(readFileSync(join(root, "data/sources/registry.json"), "utf8")).toBe(registryText(buildRegistry(root).registry));
  });
});

import { pruneOrphanLinks } from "../../src/sources/build.ts";
describe("pruneOrphanLinks (2.33)", () => {
  it("drops link results whose source no lane file uses and keeps the rest", () => {
    const rec = (url: string) => ({ url, status: "ok" as const, http: 200, final: null, checked: "2026-10-18" });
    const file = { schema: "source-links/1" as const, links: { "s-aaaaaaaaaa": rec("https://a.example/"), "s-bbbbbbbbbb": rec("https://b.example/") } };
    expect(pruneOrphanLinks(file, ["s-aaaaaaaaaa"])).toEqual(["s-bbbbbbbbbb"]);
    expect(Object.keys(file.links)).toEqual(["s-aaaaaaaaaa"]);
    expect(pruneOrphanLinks(file, ["s-aaaaaaaaaa"])).toEqual([]);
  });
});

import { notesFor } from "../../src/sources/notes.ts";
describe("automated access (capture contract 9.2)", () => {
  it("marks link-only platforms forbidden, open-data hosts allowed and the rest unknown", () => {
    expect(notesFor("https://www.alltrails.com/trail/x").automated).toBe("forbidden");
    expect(notesFor("https://www.wikiloc.com/x").automated).toBe("forbidden");
    expect(notesFor("https://www.tripadvisor.ca/x").automated).toBe("forbidden");
    expect(notesFor("https://www.wikidata.org/wiki/Q1").automated).toBe("allowed");
    expect(notesFor("https://overpass-api.de/api").automated).toBe("allowed");
    expect(notesFor("https://parks.canada.ca/x").automated).toBe("unknown");
    expect(notesFor("research/method/suitability.md").automated).toBe("allowed");
  });
});

describe("trip base points (backlog 3.41) and the Drei Zinnen page (3.30)", () => {
  const root = join(import.meta.dirname, "..", "..", "..");
  const { registry } = buildRegistry(root);
  it("registers the source of each of the nine trip pins (the four of the globe lane, backlog 3.46, included) and ties it to its trip", () => {
    const used = registry.entries.filter((e) => e.used_by.some((u) => u.file === "data/trips/base-points.json"));
    expect(used.map((e) => e.url).sort()).toEqual([
      "https://www.openstreetmap.org/node/1485292613",
      "https://www.openstreetmap.org/node/360010114",
      "https://www.openstreetmap.org/way/272966214",
      "https://www.wikidata.org/wiki/Q145948",
      "https://www.wikidata.org/wiki/Q2051042",
      "https://www.wikidata.org/wiki/Q4191",
      "https://www.wikidata.org/wiki/Q482508",
      "https://www.wikidata.org/wiki/Q6529888",
      "https://www.wikidata.org/wiki/Q922740",
    ]);
    for (const e of used) expect(e.used_by[0]!.ref).toMatch(/^trip\//);
  });
  it("registers the suedtirol.info Drei Zinnen page, used by the Tre Cime loop", () => {
    const e = registry.entries.find((x) => x.url.includes("summer-walk-around-the-drei-zinnen"))!;
    expect(e.kind).toBe("official");
    expect(e.used_by.some((u) => u.ref === "place/tre-cime-di-lavaredo-loop")).toBe(true);
  });
});
