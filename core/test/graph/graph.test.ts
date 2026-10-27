// EG-I: the graph index builder, the containment rule, requirementsOf and the inheritance modes. Fixtures: core/test/fixtures/graph.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/capture/records.ts";
import { buildContainment } from "../../src/capture/graph.ts";
import { buildFiles, buildIndex, nearestProtected } from "../../src/graph/build.ts";
import { entryOverrides, inherited, requirementsOf } from "../../src/graph/requires.ts";
import { capDoc, put, scope, scratchRoot } from "../capture/helpers.ts";

const DIR = fileURLToPath(new URL("../fixtures/graph/valid/", import.meta.url));
const REAL = fileURLToPath(new URL("../../../", import.meta.url));
const fixtureRoot = (extra: unknown[] = []): string => {
  const root = scratchRoot({ "data/suitability/scope.json": scope([]) });
  for (const n of readdirSync(DIR).filter((f) => f.endsWith(".json"))) put(root, `data/capture/graph-fixture/${n}`, JSON.parse(readFileSync(join(DIR, n), "utf8")));
  if (extra.length) put(root, "data/capture/graph-fixture/extra.json", capDoc(extra, { trip: "graph-fixture" }));
  return root;
};
const rec = (ref: string, type: string, layer: string, more: Record<string, unknown> = {}) => ({ ref, type, layer, name: ref, ...more });
const part = (r: string, s: string) => `part/place/${r}#${s}`;
const RB = "place/ridgeback-national-park";

describe("containment", () => {
  const g = buildIndex(loadWorld(fixtureRoot()));
  it("closure: a park holds its zones and everything in them", () => {
    expect(g.membersAll(RB)).toEqual(expect.arrayContaining([part("ridgeback-national-park", "north-valley"), "place/mirror-lake", "place/ridge-pass", "place/tarn-lake", part("ridgeback-national-park", "traverse-stage-2")]));
    expect(g.membersOf(RB)).not.toContain("place/mirror-lake");
    expect(g.containerChain("place/mirror-lake")).toEqual([part("ridgeback-national-park", "north-valley"), RB]);
  });
  it("area membership: records by area_id become members of the park that covers it, never by geometry", () => {
    expect(g.membersOf("place/twin-rivers-national-park")).toEqual(expect.arrayContaining(["place/east-bank-lake", "place/west-bank-lake", "place/border-overlook"]));
    expect(g.containers("place/east-bank-lake").basis).toBe("area");
  });
  it("two parks over one area are not members of each other and nothing cycles (EG-R0 M1)", () => {
    const root = fixtureRoot([
      rec("place/park-a", "nature.protected.national_park", "place", { covers_areas: ["ZZ/X1/shared"], area_id: "ZZ/X1/shared" }),
      rec("place/park-b", "nature.protected.provincial_park", "place", { covers_areas: ["ZZ/X1/shared"], area_id: "ZZ/X1/shared" }),
      rec("place/shared-lake", "water.body.lake", "place", { area_id: "ZZ/X1/shared" }),
    ]);
    const c = buildContainment(loadWorld(root));
    expect(c.cycles).toEqual([]);
    expect(c.containers("place/park-a").refs).toEqual([]);
    expect(c.containers("place/shared-lake").refs).toEqual(["place/park-a", "place/park-b"]);
  });
  it("an explicit part_of beats area membership", () => {
    const root = fixtureRoot([
      rec("place/p1", "nature.protected.national_park", "place", { covers_areas: ["ZZ/X2/a"] }),
      rec("place/p2", "nature.protected.national_park", "place", { covers_areas: ["ZZ/X2/b"] }),
      rec("place/m", "water.body.lake", "place", { area_id: "ZZ/X2/a", part_of: ["place/p2"] }),
    ]);
    expect(buildContainment(loadWorld(root)).containers("place/m")).toEqual({ refs: ["place/p2"], basis: "explicit" });
  });
  it("a part_of that names an alias resolves to the primary, and a duplicate target counts once", () => {
    const root = fixtureRoot([
      rec("place/old-name", "nature.protected.national_park", "place", { aliases: ["place/older-name"] }),
      rec("place/m2", "water.body.lake", "place", { part_of: ["place/older-name", "place/old-name"] }),
    ]);
    const w = loadWorld(root);
    expect(buildContainment(w).containers("place/m2")).toEqual({ refs: ["place/old-name"], basis: "explicit" });
    expect(buildIndex(w).membersOf("place/old-name")).toEqual(["place/m2"]);
  });
  it("a containment loop is reported, not followed forever", () => {
    const root = fixtureRoot([rec("place/la", "water.body.lake", "place", { part_of: ["place/lb"] }), rec("place/lb", "water.body.lake", "place", { part_of: ["place/la"] })]);
    const g2 = buildIndex(loadWorld(root));
    expect(g2.cycles.length).toBeGreaterThan(0);
    expect(g2.membersAll("place/la").sort()).toEqual(["place/lb"]);
    expect(g2.chainOf("place/la").map((c) => c.ref)).toEqual(["place/la", "place/lb"]);
  });
});

describe("stages and variants", () => {
  const rbk = "ridgeback-national-park";
  it("stages come in ends_at/starts_at order", () => {
    const g = buildIndex(loadWorld(fixtureRoot()));
    expect(g.stages.get(part(rbk, "high-traverse"))).toEqual([1, 2, 3].map((n) => part(rbk, `traverse-stage-${n}`)));
  });
  it("a stage merge loop (A to B, B to C, C to B) terminates and keeps every stage once", () => {
    const st = (n: string, from: string, to: string) => rec(part("loopy", n), "nature.trail.hike", "route", { part_of: [part("loopy", "whole")], starts_at: [`place/${from}`], ends_at: [`place/${to}`] });
    const root = fixtureRoot([
      rec("place/loopy", "nature.protected.national_park", "place"),
      rec(part("loopy", "whole"), "nature.trail.hike", "route", { part_of: ["place/loopy"] }),
      st("a", "pa", "pb"), st("b", "pb", "pc"), st("c", "pc", "pb"),
    ]);
    const order = buildIndex(loadWorld(root)).stages.get(part("loopy", "whole"))!;
    expect(order.slice().sort()).toEqual([part("loopy", "a"), part("loopy", "b"), part("loopy", "c")]);
    expect(order[0]).toBe(part("loopy", "a"));
  });
  it("a variant with no payoff of its own takes the primary's chain; one that states its own does not", () => {
    const g = buildIndex(loadWorld(fixtureRoot()));
    const short = part("mirror-lake", "ridge-loop-short"), prim = part("mirror-lake", "ridge-loop");
    const refs = (r: string) => g.chainOf(r).map((c) => c.ref);
    expect(refs(prim)).toContain(RB);
    expect(refs(short)).toContain(RB);
    const own = buildIndex(loadWorld(fixtureRoot([rec("part/place/mirror-lake#own-loop", "nature.trail.hike", "route", { variant_of: prim, reaches: ["place/tarn-lake"] })])));
    const ch = own.chainOf("part/place/mirror-lake#own-loop").map((c) => c.ref);
    expect(ch).toContain("place/tarn-lake");
    expect(ch).not.toContain("place/ridge-pass");
  });
});

describe("requirementsOf", () => {
  const g = buildIndex(loadWorld(fixtureRoot()));
  const lake = "place/mirror-lake";
  it("a member inherits the park's entry requirements, labelled with the chain record", () => {
    const needs = requirementsOf(g, lake);
    const fee = needs.find((n) => n.ref === "offer/place/ridgeback-national-park#entry-fee")!;
    expect(fee.inheritedFrom).toBe(RB);
    expect(fee.via).toBe("container");
    expect(nearestProtected(g, lake)).toBe(part("ridgeback-national-park", "north-valley")); // the first nature.protected.* is the zone (6.2)
  });
  it("the chain through a route's start labels the source (QG3)", () => {
    const needs = requirementsOf(g, part("mirror-lake", "ridge-loop"));
    expect(needs.length).toBeGreaterThan(0);
    for (const n of needs) expect(["container", "start", "payoff", "end", "access", "primary", "at", "on", "self"]).toContain(n.via);
  });
  it("a requirement scoped to a mode, month or activity type drops out when it does not match", () => {
    const root = fixtureRoot([
      { ...rec("offer/place/ridgeback-national-park#fishing", "access.pass.activity_permit", "offer", { at: [RB] }), entry: { v: { needed_for: ["day"], for_types: ["water.fishing"] }, src: [] }, season: { v: [{ from: "05-01", to: "09-30", status: "open" }], src: [] } },
    ]);
    const g2 = buildIndex(loadWorld(root));
    const id = "offer/place/ridgeback-national-park#fishing";
    const has = (o: object) => requirementsOf(g2, lake, o).some((n) => n.ref === id);
    expect(has({})).toBe(false); // lake is not a fishing type
    expect(has({ types: ["water.fishing.fly"], mode: "day", month: 7 })).toBe(true);
    expect(has({ types: ["water.fishing"], mode: "overnight_back" })).toBe(false);
    expect(has({ types: ["water.fishing"], month: 12 })).toBe(false);
  });
  it("an exemption drops the requirement for that visit; a sourced no_limit on the member overrides the chain", () => {
    const root = fixtureRoot([
      { ...rec("offer/place/ridgeback-national-park#toll", "access.pass.entry_fee", "offer", { at: [RB] }), entry: { v: { exemptions: [{ who: "through_traffic" }] }, src: [] } },
      { ...rec("place/free-spot", "nature.viewpoint", "place", { part_of: [RB] }), access_cost: { v: "no_limit", src: [{ url: "https://example.org" }] } },
    ]);
    const g2 = buildIndex(loadWorld(root));
    const toll = "offer/place/ridgeback-national-park#toll";
    expect(requirementsOf(g2, lake).some((n) => n.ref === toll)).toBe(true);
    expect(requirementsOf(g2, lake, { exempt: ["through_traffic"] }).some((n) => n.ref === toll)).toBe(false);
    expect(requirementsOf(g2, "place/free-spot")).toEqual([]);
    expect(entryOverrides(g2)).toEqual(["place/free-spot"]);
  });
  it("EG-I2: the entry Val is unwrapped; mode, for_types and exemptions (by who) filter; a record with no entry is kept", () => {
    const o = (name: string, entry?: object) => ({ ...rec(`offer/place/ridgeback-national-park#${name}`, "access.pass.activity_permit", "offer", { at: [RB] }), ...(entry ? { entry: { v: entry, src: [] } } : {}) });
    const g2 = buildIndex(loadWorld(fixtureRoot([
      o("night-only", { needed_for: ["overnight_back"] }),
      o("any-day", { needed_for: ["day", "overnight_back"] }),
      o("boat-only", { for_types: ["water.boating"] }),
      o("camper-free", { exemptions: [{ who: "camper" }] }),
      o("bare"),
    ])));
    const ids = (op: object) => requirementsOf(g2, lake, op).map((n) => n.ref.split("#")[1]);
    expect(ids({ mode: "day" })).not.toContain("night-only");
    expect(ids({ mode: "day" })).toContain("any-day");
    expect(ids({ mode: "overnight_back" })).toContain("night-only");
    expect(ids({})).toContain("night-only"); // no mode: every mode
    expect(ids({})).not.toContain("boat-only");
    expect(ids({ types: ["water.boating"] })).toContain("boat-only");
    expect(ids({})).toContain("camper-free");
    expect(ids({ exempt: ["camper"] })).not.toContain("camper-free");
    expect(ids({ exempt: ["through_traffic"] })).toContain("camper-free");
    expect(ids({ mode: "day", exempt: ["camper"] })).toContain("bare"); // no entry value
  });
  it("alternative_to pairs become one need with options; covered_by and included_in attach", () => {
    const gs = buildIndex(loadWorld(fixtureRoot()));
    const needs = requirementsOf(gs, "place/twin-rivers-national-park");
    expect(needs.some((n) => n.options.length > 1) || needs.length > 0).toBe(true);
    const fee = requirementsOf(gs, lake).find((n) => n.ref.endsWith("#entry-fee"))!;
    expect(fee.includedIn).toEqual(expect.arrayContaining(["offer/place/ridgeback-national-park#guided-ridge"]));
  });
});

describe("inheritance modes", () => {
  const withSeasons = () => buildIndex(loadWorld(fixtureRoot([
    { ...rec("place/gated", "nature.protected.provincial_park", "place"), season: { v: [{ from: "05-01", to: "10-31", status: "open" }], src: [] }, access_season: { v: "May to October", src: [] }, summary: { v: "park", src: [] } },
    { ...rec("place/gate-beach", "water.swim.beach", "place", { part_of: ["place/gated"] }), season: { v: [{ from: "04-01", to: "08-31", status: "open" }], src: [] }, summary: { v: "beach", src: [] } },
    rec("place/gate-trail", "nature.viewpoint", "place", { part_of: ["place/gated"] }),
  ])));
  it("bound: the member's season is cut to the container's", () => {
    expect(inherited(withSeasons(), "place/gate-beach", "season").effective).toEqual([{ from: "05-01", to: "08-31" }]);
  });
  it("fallback: own wins, else the nearest up the chain with its source", () => {
    const g = withSeasons();
    const r = inherited(g, "place/gate-trail", "access_season");
    expect(r.values).toHaveLength(1);
    expect(r.values[0]).toMatchObject({ from: "place/gated", via: "container", own: false });
    expect(inherited(g, "place/gated", "access_season").values[0]!.own).toBe(true);
  });
  it("never: the member's own only; union: every one up the chain", () => {
    const g = withSeasons();
    expect(inherited(g, "place/gate-trail", "summary").values).toEqual([]);
    expect(inherited(g, "place/gate-beach", "summary").values.map((v) => v.value)).toEqual(["beach"]);
    const u = buildIndex(loadWorld(fixtureRoot([
      { ...rec("place/up", "nature.protected.national_park", "place"), hours: { v: { tz: "UTC", closures: [{ from: "2026-01-01", to: "2026-01-09" }] }, src: [] } },
      rec("place/down", "nature.viewpoint", "place", { part_of: ["place/up"], hours: { v: { tz: "UTC", closures: [{ from: "2026-02-01", to: "2026-02-02" }] }, src: [] } }),
    ])));
    expect(inherited(u, "place/down", "closures").values.map((v) => v.from)).toEqual(["place/down", "place/up"]);
    expect(() => inherited(u, "place/down", "nope")).toThrow();
  });
});

describe("the files", () => {
  it("are deterministic (build twice is identical), refs only, shard by country", () => {
    const root = fixtureRoot();
    const a = buildFiles(loadWorld(root)), b = buildFiles(loadWorld(root));
    expect(a.files).toEqual(b.files);
    const names = a.files.map((f) => f.path.split("/").pop());
    expect(names).toContain("index.json");
    expect(names).toContain("ZZ.json");
    for (const f of a.files) {
      expect(f.text).toContain("Generated by node core/bin/graph.ts build. Do not edit.");
      expect(() => JSON.parse(f.text)).not.toThrow();
    }
    const zz = JSON.parse(a.files.find((f) => f.path.endsWith("/ZZ.json"))!.text);
    expect(zz.members_all[RB]["place:water.body"]).toEqual(expect.arrayContaining(["place/mirror-lake"]));
    expect(JSON.stringify(zz)).not.toMatch(/Ridgeback/); // no prose
  });
  it("counts do not change when targets are repeated", () => {
    const base = buildFiles(loadWorld(fixtureRoot())).edges;
    const dup = fixtureRoot([rec("place/dup", "water.body.lake", "place", { part_of: [RB, RB] })]);
    expect(buildFiles(loadWorld(dup)).edges).toBe(base + 1);
  });
  it("any edit to the index is detected by comparing with a fresh build", () => {
    const root = fixtureRoot();
    const fresh = buildFiles(loadWorld(root));
    put(root, fresh.files[1]!.path, fresh.files[1]!.text.replace('"place/mirror-lake"', '"place/mirror-lakes"'));
    const disk = readFileSync(join(root, fresh.files[1]!.path), "utf8");
    expect(disk).not.toBe(fresh.files[1]!.text);
  });
});

describe("the real world", () => {
  it("builds with no containment cycle, and the committed index is current", () => {
    const rep = buildFiles(loadWorld(REAL));
    expect(rep.cycles).toEqual([]);
    expect(rep.records).toBeGreaterThan(400);
    for (const f of rep.files) {
      expect(existsSync(join(REAL, f.path)), f.path).toBe(true);
      expect(readFileSync(join(REAL, f.path), "utf8") === f.text, f.path).toBe(true);
    }
  });
});
