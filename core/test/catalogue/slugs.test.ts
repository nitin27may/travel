import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLUG_REGISTRY_PATH, aliasKey, assignPlaceSlugs, assignSeedSlugs, emptyRegistry, kebab, movedTo, parseRegistry, registryDrift,
  registryProblems, registryText, renameSlug, resolveRegion, updateRegistry, type SlugRegistry, type SlugSnapshot,
} from "../../src/catalogue/slugs.ts";
import { main } from "../../bin/slugs.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const reg = (places: Record<string, string>, extra: Partial<SlugRegistry> = {}): SlugRegistry => ({ ...emptyRegistry(), places, ...extra });

describe("kebab (patterns 1.2, moved from web)", () => {
  it("folds accents, ampersands and apostrophes", () => {
    expect(kebab("Lac d’Émeraude & Co's")).toBe("lac-demeraude-and-cos");
    expect(kebab("  --Moss Glen Falls--  ")).toBe("moss-glen-falls");
  });
});

describe("assignPlaceSlugs", () => {
  const a = { key: "loc:a", name: "Moss Glen Falls", areaSlug: "stowe" };
  const b = { key: "loc:b", name: "Moss Glen Falls", areaSlug: "granville" };
  const c = { key: "proto:c", name: "Bow Lake", areaSlug: "banff" };

  it("without a registry: colliding names all take their area, independent of input order", () => {
    const one = assignPlaceSlugs([a, b, c]);
    expect(one).toEqual(assignPlaceSlugs([c, b, a]));
    expect(one.get("loc:a")).toBe("moss-glen-falls-stowe");
    expect(one.get("loc:b")).toBe("moss-glen-falls-granville");
    expect(one.get("proto:c")).toBe("bow-lake");
  });

  it("a pinned key keeps its slug, even when its name changes", () => {
    const got = assignPlaceSlugs([{ ...c, name: "Bow Lake Lodge" }], reg({ "proto:c": "bow-lake" }));
    expect(got.get("proto:c")).toBe("bow-lake");
  });

  it("a newcomer whose name clashes with a pinned slug takes the suffix; the incumbent is never renamed (D-B1)", () => {
    const pinned = reg({ "loc:a": "moss-glen-falls" });
    const got = assignPlaceSlugs([a, b], pinned);
    expect(got.get("loc:a")).toBe("moss-glen-falls");
    expect(got.get("loc:b")).toBe("moss-glen-falls-granville");
  });

  it("a newcomer never takes a retired slug", () => {
    const r = reg({ "loc:x": "bow-lake-new" }, { retired: { "bow-lake": "loc:x" } });
    expect(assignPlaceSlugs([c], r).get("proto:c")).toBe("bow-lake-banff");
  });

  it("orders unpinned keys by `order` when given, so the key form of before the registry still decides", () => {
    const x = { key: "z-ref", order: "a", name: "Same", areaSlug: "" };
    const y = { key: "a-ref", order: "b", name: "Same", areaSlug: "" };
    const got = assignPlaceSlugs([y, x]);
    expect(got.get("z-ref")).toBe("same");
    expect(got.get("a-ref")).toBe("same-2");
  });
});

describe("assignSeedSlugs", () => {
  const seed = (ref: string, name: string, district = "lakes") => ({ ref, name, areaChain: [{ slug: "ca" }, { slug: "ab" }, { slug: district }], typeLabel: "Lake" });
  it("fills free names in ref order, places before parts, and keeps pinned refs", () => {
    const used = new Set(["moraine-lake"]);
    const out = assignSeedSlugs([seed("b", "Bow Lake"), seed("a", "Moraine Lake"), seed("part/c", "Moraine Lake")], used);
    expect(out.get("b")).toBe("bow-lake");
    expect(out.get("a")).toBe("moraine-lake-lakes");
    expect(out.get("part/c")).toBe("moraine-lake-lakes-lake");
    const pinned = assignSeedSlugs([seed("b", "Renamed Lake")], new Set(), reg({ b: "bow-lake" }));
    expect(pinned.get("b")).toBe("bow-lake");
  });
  it("never takes a reserved slug of the registry", () => {
    const out = assignSeedSlugs([seed("n", "Bow Lake")], new Set(), reg({ other: "bow-lake" }));
    expect(out.get("n")).toBe("bow-lake-lakes");
  });
});

describe("the registry", () => {
  it("names its own problems: a slug on two keys, a retired slug in use or pointing nowhere", () => {
    expect(registryProblems(reg({ a: "x", b: "x" }))[0]).toMatch(/two keys/);
    expect(registryProblems(reg({ a: "x" }, { retired: { x: "a" } }))[0]).toMatch(/also pinned/);
    expect(registryProblems(reg({ a: "x" }, { retired: { y: "gone" } }))[0]).toMatch(/has no slug/);
    expect(registryProblems(reg({ a: "Not A Slug" })).length).toBeGreaterThan(0);
    expect(registryProblems(reg({ a: "x" }))).toEqual([]);
  });

  it("update pins new keys, keeps pinned ones, merges region aliases, and refuses a vanished key", () => {
    const snap: SlugSnapshot = { places: { a: "x", b: "y" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["CA-AB"] } } };
    const first = updateRegistry(emptyRegistry(), snap);
    expect(first.problems).toEqual([]);
    expect(first.registry.places).toEqual({ a: "x", b: "y" });
    const next = updateRegistry(first.registry, { places: { a: "x", b: "y", c: "z" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } });
    expect(next.added).toEqual(["c"]);
    expect(next.registry.regions["ca/alberta"]!.aliases).toEqual(["AB", "CA-AB"]);
    const gone = updateRegistry(first.registry, { places: { a: "x" }, regions: snap.regions });
    expect(gone.problems.join("\n")).toMatch(/b \(slug y\) has no record any more: run .*alias/);
  });

  it("drift: a slug that would change, an unpinned key, a vanished key, a new region or alias", () => {
    const r = reg({ a: "x" }, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } });
    const ok: SlugSnapshot = { places: { a: "x" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } };
    expect(registryDrift(r, ok)).toEqual([]);
    expect(registryDrift(r, { ...ok, places: { a: "x2" } })[0]).toMatch(/registry pins x/);
    expect(registryDrift(r, { ...ok, places: { a: "x", b: "y" } })[0]).toMatch(/b \(slug y\) is not pinned/);
    expect(registryDrift(r, { ...ok, places: {} })[0]).toMatch(/has no record/);
    expect(registryDrift(r, { ...ok, regions: { ...ok.regions, "ca/ontario": { name: "Ontario", aliases: [] } } })[0]).toMatch(/region ca\/ontario is not pinned/);
    expect(registryDrift(r, { ...ok, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB", "Alta"] } } })[0]).toMatch(/aliases Alta/);
  });

  it("rename retires the old slug, which then answers with the new one; renaming back leaves no chain", () => {
    const r1 = renameSlug(reg({ a: "old" }), "a", "new");
    expect(r1.places.a).toBe("new");
    expect(movedTo(r1, "old")).toEqual({ slug: "new", key: "a" });
    expect(movedTo(r1, "new")).toBeNull();
    const r2 = renameSlug(r1, "a", "newer");
    expect(movedTo(r2, "old")).toEqual({ slug: "newer", key: "a" });
    expect(movedTo(r2, "new")).toEqual({ slug: "newer", key: "a" });
    const back = renameSlug(r2, "a", "old");
    expect(back.retired.old).toBeUndefined();
    expect(registryProblems(back)).toEqual([]);
    expect(() => renameSlug(reg({ a: "x", b: "y" }), "a", "y")).toThrow(/pinned or retired/);
  });

  it("alias carries a slug to a new key and repoints its retired slugs", () => {
    const r = renameSlug(reg({ "loc:a": "x" }), "loc:a", "x2");
    const moved = aliasKey(r, "loc:a", "place/a");
    expect(moved.places).toEqual({ "place/a": "x2" });
    expect(moved.retired).toEqual({ x: "place/a" });
    expect(() => aliasKey(moved, "loc:a", "place/b")).toThrow(/has no slug/);
  });

  it("resolveRegion answers every alias with the canonical key, narrowed by country (D-B3)", () => {
    const r = reg({}, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB", "CA-AB", "Alta"] }, "us/arizona": { name: "Arizona", aliases: ["AZ", "US-AZ"] }, "xx/ab": { name: "Ab", aliases: [] } } });
    for (const v of ["alberta", "Alberta", "AB", "ab", "CA-AB", "ca-ab", "Alta"]) expect(resolveRegion(r, v, "CA"), v).toEqual(["ca/alberta"]);
    expect(resolveRegion(r, "ab")).toEqual(["ca/alberta", "xx/ab"]);
    expect(resolveRegion(r, "Ontario")).toEqual([]);
    expect(resolveRegion(r, "")).toEqual([]);
  });

  it("the file text round-trips and is stable", () => {
    const r = reg({ b: "y", a: "x" }, { regions: { "ca/alberta": { name: "Alberta", aliases: ["CA-AB", "AB", "AB"] } } });
    const text = registryText(r);
    expect(registryText(parseRegistry(text))).toBe(text);
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    expect(parseRegistry(text).regions["ca/alberta"]!.aliases).toEqual(["AB", "CA-AB"]);
  });
});

describe("data/catalogue/slugs.json, as committed", () => {
  const text = readFileSync(join(ROOT, SLUG_REGISTRY_PATH), "utf8");
  const r = parseRegistry(text);
  it("parses, has no problem of its own, and is in canonical form (written by slugs.ts, never by hand)", () => {
    expect(registryProblems(r)).toEqual([]);
    expect(registryText(r)).toBe(text);
  });
  it("pins today's 363 keys (359 pages and 4 merged records) and 41 regions; Alberta answers to its ISO code", () => {
    expect(Object.keys(r.places).length).toBe(363);
    expect(new Set(Object.values(r.places)).size).toBe(363);
    expect(Object.keys(r.regions).length).toBe(41);
    expect(resolveRegion(r, "CA-AB", "CA")).toEqual(["ca/alberta"]);
  });
  it("holds no household string: refs carry nothing private (G-B 12)", () => {
    expect(text).not.toMatch(/whitby/i);
  });
});

describe("node core/bin/slugs.ts", () => {
  const tmpRoot = () => mkdtempSync(join(tmpdir(), "slugs-"));
  const snapFile = (dir: string, snap: SlugSnapshot) => {
    const f = join(dir, "snap.json");
    writeFileSync(f, JSON.stringify(snap));
    return f;
  };
  const snap: SlugSnapshot = { places: { "loc:a": "alpha", "proto:b": "beta" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } };

  it("build writes the registry; --check passes; a new key fails --check until build; a vanished key needs alias", () => {
    const root = tmpRoot();
    const s1 = snapFile(root, snap);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s1])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(0);
    const s2 = snapFile(root, { ...snap, places: { ...snap.places, "loc:c": "gamma" } });
    expect(main(["--check", "--root", root, "--snapshot", s2])).toBe(1);
    const s3 = snapFile(root, { ...snap, places: { "place/a": "alpha", "proto:b": "beta" } });
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["alias", "loc:a", "place/a", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(0);
  });

  it("rename retires the old slug; the builder's new slug then passes --check", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", snapFile(root, snap)])).toBe(0);
    expect(main(["rename", "proto:b", "beta-two", "--root", root])).toBe(0);
    const r = parseRegistry(readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8"));
    expect(movedTo(r, "beta")).toEqual({ slug: "beta-two", key: "proto:b" });
    expect(main(["--check", "--root", root, "--snapshot", snapFile(root, { ...snap, places: { "loc:a": "alpha", "proto:b": "beta-two" } })])).toBe(0);
    expect(main(["rename", "nope", "x", "--root", root])).toBe(1);
    expect(main(["frobnicate", "--root", root])).toBe(2);
  });
});
