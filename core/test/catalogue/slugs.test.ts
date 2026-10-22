import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLUG_REGISTRY_PATH, aliasKey, assignPlaceSlugs, assignSeedSlugs, currentSlug, emptyRegistry, isWithdrawn, kebab, mergeKey, movedTo,
  parseRegistry, registryDrift, registryProblems, registryText, renameSlug, resolveRef, resolveRegion, updateRegistry, withdrawKey,
  type SlugRegistry, type SlugSnapshot, type SlugSpace,
} from "../../src/catalogue/slugs.ts";
import { main } from "../../bin/slugs.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const space = (slugs: Record<string, string>, extra: Partial<SlugSpace> = {}): SlugSpace => ({ slugs, retired: {}, merged: {}, withdrawn: {}, ...extra });
const reg = (places: Record<string, string>, extra: Partial<SlugSpace> = {}, rest: Partial<SlugRegistry> = {}): SlugRegistry => ({ ...emptyRegistry(), places: space(places, extra), ...rest });
const snap = (places: Record<string, string>, more: Partial<SlugSnapshot> = {}): SlugSnapshot => ({ places, merged: {}, trips: {}, regions: {}, ...more });

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
    expect(assignPlaceSlugs([{ ...c, name: "Bow Lake Lodge" }], reg({ "proto:c": "bow-lake" })).get("proto:c")).toBe("bow-lake");
  });
  it("a newcomer whose name clashes with a pinned slug takes the suffix; the incumbent is never renamed (D-B1)", () => {
    const got = assignPlaceSlugs([a, b], reg({ "loc:a": "moss-glen-falls" }));
    expect(got.get("loc:a")).toBe("moss-glen-falls");
    expect(got.get("loc:b")).toBe("moss-glen-falls-granville");
  });
  it("a newcomer never takes a retired or withdrawn slug; a withdrawn key that comes back gets its slug again", () => {
    expect(assignPlaceSlugs([c], reg({ "loc:x": "bow-lake-new" }, { retired: { "bow-lake": "loc:x" } })).get("proto:c")).toBe("bow-lake-banff");
    expect(assignPlaceSlugs([c], reg({}, { withdrawn: { "loc:gone": "bow-lake" } })).get("proto:c")).toBe("bow-lake-banff");
    expect(assignPlaceSlugs([c], reg({}, { withdrawn: { "proto:c": "bow-lake-old" } })).get("proto:c")).toBe("bow-lake-old");
  });
  it("orders unpinned keys by `order` when given, so the key form of before the registry still decides", () => {
    const got = assignPlaceSlugs([{ key: "a-ref", order: "b", name: "Same", areaSlug: "" }, { key: "z-ref", order: "a", name: "Same", areaSlug: "" }]);
    expect(got.get("z-ref")).toBe("same");
    expect(got.get("a-ref")).toBe("same-2");
  });
});

describe("assignSeedSlugs", () => {
  const seed = (ref: string, name: string, district = "lakes") => ({ ref, name, areaChain: [{ slug: "ca" }, { slug: "ab" }, { slug: district }], typeLabel: "Lake" });
  it("fills free names in ref order, places before parts, and keeps pinned refs", () => {
    const out = assignSeedSlugs([seed("b", "Bow Lake"), seed("a", "Moraine Lake"), seed("part/c", "Moraine Lake")], new Set(["moraine-lake"]));
    expect(out.get("b")).toBe("bow-lake");
    expect(out.get("a")).toBe("moraine-lake-lakes");
    expect(out.get("part/c")).toBe("moraine-lake-lakes-lake");
    expect(assignSeedSlugs([seed("b", "Renamed Lake")], new Set(), reg({ b: "bow-lake" })).get("b")).toBe("bow-lake");
  });
  it("never takes a reserved slug of the registry", () => {
    expect(assignSeedSlugs([seed("n", "Bow Lake")], new Set(), reg({ other: "bow-lake" })).get("n")).toBe("bow-lake-lakes");
  });
});

describe("the registry", () => {
  it("names its own problems", () => {
    expect(registryProblems(reg({ a: "x", b: "x" }))[0]).toMatch(/two keys/);
    expect(registryProblems(reg({ a: "x" }, { retired: { x: "a" } }))[0]).toMatch(/also pinned/);
    expect(registryProblems(reg({ a: "x" }, { retired: { y: "gone" } }))[0]).toMatch(/has no slug/);
    expect(registryProblems(reg({ a: "x" }, { merged: { a: "b" } })).join()).toMatch(/merged into b, which has no slug/);
    expect(registryProblems(reg({ a: "x" }, { withdrawn: { b: "x" } }))[0]).toMatch(/two keys/);
    expect(registryProblems(reg({ a: "x" }, {}, { formerKeys: { a: "a2" } })).join()).toMatch(/still has a slug/);
    expect(registryProblems(reg({ a: "Not A Slug" })).length).toBeGreaterThan(0);
    expect(registryProblems(reg({ a: "x" }))).toEqual([]);
  });

  it("update pins new keys, merges and trips, keeps pinned ones, merges region aliases, and refuses a vanished key", () => {
    const first = updateRegistry(emptyRegistry(), snap({ a: "x", b: "y" }, { trips: { "trip/t": "t" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["CA-AB"] } } }));
    expect(first.problems).toEqual([]);
    expect(first.registry.places.slugs).toEqual({ a: "x", b: "y" });
    expect(first.registry.trips.slugs).toEqual({ "trip/t": "t" });
    const next = updateRegistry(first.registry, snap({ a: "x", b: "y", c: "z" }, { merged: { b: "a" }, trips: { "trip/t": "t" }, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } }));
    expect(next.problems).toEqual([]);
    expect(next.added).toEqual(["c", "merge b"]);
    expect(next.registry.places.merged).toEqual({ b: "a" });
    expect(next.registry.regions["ca/alberta"]!.aliases).toEqual(["AB", "CA-AB"]);
    const gone = updateRegistry(first.registry, snap({ a: "x" }, { trips: { "trip/t": "t" } }));
    expect(gone.problems.join("\n")).toMatch(/b \(slug y\) has no record any more: run .*alias.*merge.*withdraw/);
  });

  it("an emptied region only warns, in build and in --check (R-20)", () => {
    const r = reg({ a: "x" }, {}, { regions: { "ca/alberta": { name: "Alberta", aliases: [] } } });
    const u = updateRegistry(r, snap({ a: "x" }));
    expect(u.problems).toEqual([]);
    expect(u.warnings[0]).toMatch(/ca\/alberta has no place now/);
    expect(u.registry.regions["ca/alberta"]).toBeDefined();
    const d = registryDrift(r, snap({ a: "x" }));
    expect(d.drift).toEqual([]);
    expect(d.warnings.length).toBe(1);
  });

  it("drift: a slug that would change, an unpinned key, a vanished key, a merge, a trip, a new region or alias", () => {
    const r = reg({ a: "x" }, {}, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } });
    const ok = snap({ a: "x" }, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } });
    expect(registryDrift(r, ok).drift).toEqual([]);
    expect(registryDrift(r, { ...ok, places: { a: "x2" } }).drift[0]).toMatch(/registry pins x/);
    expect(registryDrift(r, { ...ok, places: { a: "x", b: "y" } }).drift[0]).toMatch(/b \(slug y\) is not pinned/);
    expect(registryDrift(r, { ...ok, places: {} }).drift[0]).toMatch(/has no record/);
    expect(registryDrift(r, { ...ok, places: { a: "x", b: "y" }, merged: { b: "a" } }).drift.join()).toMatch(/merge b -> a is not in the registry/);
    expect(registryDrift(r, { ...ok, trips: { "trip/t": "t" } }).drift[0]).toMatch(/trip\/t \(slug t\) is not pinned/);
    expect(registryDrift(r, { ...ok, regions: { ...ok.regions, "ca/ontario": { name: "Ontario", aliases: [] } } }).drift[0]).toMatch(/region ca\/ontario is not pinned/);
    expect(registryDrift(r, { ...ok, regions: { "ca/alberta": { name: "Alberta", aliases: ["AB", "Alta"] } } }).drift[0]).toMatch(/aliases Alta/);
  });

  it("rename retires the old slug, which answers with the new one; renaming back leaves no chain; trips rename too", () => {
    const r1 = renameSlug(reg({ a: "old" }), "a", "new");
    expect(r1.places.slugs.a).toBe("new");
    expect(movedTo(r1, "old")).toEqual({ slug: "new", key: "a" });
    expect(movedTo(r1, "new")).toBeNull();
    const r2 = renameSlug(r1, "a", "newer");
    expect(movedTo(r2, "old")).toEqual({ slug: "newer", key: "a" });
    expect(movedTo(r2, "new")).toEqual({ slug: "newer", key: "a" });
    const back = renameSlug(r2, "a", "old");
    expect(back.places.retired.old).toBeUndefined();
    expect(registryProblems(back)).toEqual([]);
    expect(() => renameSlug(reg({ a: "x", b: "y" }), "a", "y")).toThrow(/pinned, retired or withdrawn/);
    const t = renameSlug({ ...emptyRegistry(), trips: space({ "trip/x": "alps-2026" }) }, "trip/x", "alps-2027");
    expect(movedTo(t, "alps-2026", "trips")).toEqual({ slug: "alps-2027", key: "trip/x" });
    expect(movedTo(t, "alps-2026")).toBeNull();
  });

  it("merge sends the merged record's slug, and its retired slugs, to the survivor (R-1)", () => {
    let r = renameSlug(reg({ a: "alpha", b: "beta" }), "b", "beta-two");
    r = mergeKey(r, "b", "a");
    expect(movedTo(r, "beta-two")).toEqual({ slug: "alpha", key: "a" });
    expect(movedTo(r, "beta")).toEqual({ slug: "alpha", key: "a" });
    expect(resolveRef(r, "b")).toEqual({ key: "a", slug: "alpha", space: "places" });
    expect(registryProblems(r)).toEqual([]);
    expect(() => mergeKey(r, "a", "a")).toThrow(/itself/);
  });

  it("alias carries a slug to a new key, keeps the old one in formerKeys, and collapses chains (R-2)", () => {
    const r = renameSlug(reg({ "loc:a": "x" }), "loc:a", "x2");
    const one = aliasKey(r, "loc:a", "place/a");
    expect(one.places.slugs).toEqual({ "place/a": "x2" });
    expect(one.places.retired).toEqual({ x: "place/a" });
    expect(one.formerKeys).toEqual({ "loc:a": "place/a" });
    const two = aliasKey(one, "place/a", "place/a2");
    expect(two.formerKeys).toEqual({ "loc:a": "place/a2", "place/a": "place/a2" });
    expect(resolveRef(two, "loc:a")).toEqual({ key: "place/a2", slug: "x2", space: "places" });
    expect(registryProblems(two)).toEqual([]);
    expect(() => aliasKey(two, "loc:a", "place/b")).toThrow(/has no slug/);
  });

  it("withdraw tombstones a key: its slug stays reserved, answers nothing, and build restores it (R-3)", () => {
    const r = withdrawKey(reg({ a: "alpha", b: "beta" }), "b");
    expect(isWithdrawn(r, "beta")).toBe(true);
    expect(movedTo(r, "beta")).toBeNull();
    expect(currentSlug(r, "beta")).toBeNull();
    expect(resolveRef(r, "b")).toBeNull();
    expect(registryDrift(r, snap({ a: "alpha" })).drift).toEqual([]);
    const back = updateRegistry(r, snap({ a: "alpha", b: "beta" }));
    expect(back.problems).toEqual([]);
    expect(back.registry.places.slugs.b).toBe("beta");
    expect(back.registry.places.withdrawn).toEqual({});
    expect(() => withdrawKey(mergeKey(reg({ a: "x", b: "y" }), "b", "a"), "a")).toThrow(/survivor/);
  });

  it("currentSlug resolves a saved slug: live, retired, merged, withdrawn, unknown (R-19)", () => {
    let r = renameSlug(reg({ a: "alpha", b: "beta", c: "gamma", d: "delta" }), "a", "alpha-two");
    r = mergeKey(r, "b", "c");
    r = withdrawKey(r, "d");
    expect(currentSlug(r, "gamma")).toBe("gamma");
    expect(currentSlug(r, "alpha")).toBe("alpha-two");
    expect(currentSlug(r, "beta")).toBe("gamma");
    expect(currentSlug(r, "delta")).toBeNull();
    expect(currentSlug(r, "nope")).toBeNull();
  });

  it("resolveRegion answers every alias with the canonical key, narrowed by country; a shared alias lists both (D-B3, R-20)", () => {
    const r = reg({}, {}, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB", "CA-AB", "Alta"] }, "us/arizona": { name: "Arizona", aliases: ["AZ", "US-AZ"] }, "xx/ab": { name: "Ab", aliases: [] } } });
    for (const v of ["alberta", "Alberta", "AB", "ab", "CA-AB", "ca-ab", "Alta"]) expect(resolveRegion(r, v, "CA"), v).toEqual(["ca/alberta"]);
    expect(resolveRegion(r, "ab")).toEqual(["ca/alberta", "xx/ab"]);
    expect(resolveRegion(r, "Ontario")).toEqual([]);
    expect(resolveRegion(r, "")).toEqual([]);
  });

  it("the file text round-trips and is stable; a version 1 file is refused", () => {
    const r = reg({ b: "y", a: "x" }, {}, { regions: { "ca/alberta": { name: "Alberta", aliases: ["CA-AB", "AB", "AB"] } } });
    const text = registryText(r);
    expect(registryText(parseRegistry(text))).toBe(text);
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    expect(parseRegistry(text).regions["ca/alberta"]!.aliases).toEqual(["AB", "CA-AB"]);
    expect(() => parseRegistry(JSON.stringify({ schema: "catalogue-slugs/1", places: {}, regions: {}, retired: {} }))).toThrow();
  });
});

describe("data/catalogue/slugs.json, as committed", () => {
  const text = readFileSync(join(ROOT, SLUG_REGISTRY_PATH), "utf8");
  const r = parseRegistry(text);
  it("parses, has no problem of its own, and is in canonical form (written by slugs.ts, never by hand)", () => {
    expect(registryProblems(r)).toEqual([]);
    expect(registryText(r)).toBe(text);
  });
  it("pins today's 363 place keys with the 4 merged records recorded, every trip, and 41 regions; merged slugs answer moved (R-1)", () => {
    expect(Object.keys(r.places.slugs).length).toBe(363);
    expect(Object.keys(r.places.merged).length).toBe(4);
    for (const [k, survivor] of Object.entries(r.places.merged)) expect(movedTo(r, r.places.slugs[k]!)?.slug).toBe(r.places.slugs[survivor]);
    expect(Object.keys(r.trips.slugs).length).toBeGreaterThan(5);
    expect(Object.keys(r.regions).length).toBe(41);
    expect(resolveRegion(r, "CA-AB", "CA")).toEqual(["ca/alberta"]);
  });
  it("holds no household string: refs carry nothing private (G-B 12)", () => {
    expect(text).not.toMatch(/whitby/i);
  });
});

describe("node core/bin/slugs.ts", () => {
  const tmpRoot = () => mkdtempSync(join(tmpdir(), "slugs-"));
  let n = 0;
  const file = (dir: string, s: SlugSnapshot) => {
    const f = join(dir, `snap-${n++}.json`);
    writeFileSync(f, JSON.stringify(s));
    return f;
  };
  const base = snap({ "loc:a": "alpha", "proto:b": "beta" }, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } });
  const read = (root: string) => parseRegistry(readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8"));

  it("build writes the registry; --check passes; a new key fails --check until build; a vanished key needs alias", () => {
    const root = tmpRoot();
    const s1 = file(root, base);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s1])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", file(root, { ...base, places: { ...base.places, "loc:c": "gamma" } })])).toBe(1);
    const s3 = file(root, { ...base, places: { "place/a": "alpha", "proto:b": "beta" } });
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["alias", "loc:a", "place/a", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(0);
    expect(read(root).formerKeys).toEqual({ "loc:a": "place/a" });
  });

  it("rename and merge redirect; a survivor cannot be withdrawn", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    expect(main(["rename", "proto:b", "beta-two", "--root", root])).toBe(0);
    expect(movedTo(read(root), "beta")).toEqual({ slug: "beta-two", key: "proto:b" });
    expect(main(["merge", "proto:b", "loc:a", "--root", root])).toBe(0);
    expect(movedTo(read(root), "beta-two")).toEqual({ slug: "alpha", key: "loc:a" });
    expect(main(["withdraw", "loc:a", "--root", root])).toBe(1);
    expect(main(["rename", "nope", "x", "--root", root])).toBe(1);
    expect(main(["frobnicate", "--root", root])).toBe(2);
  });

  it("withdraw lets a vanished key pass --check, and build restores it when it returns", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    const without = file(root, { ...base, places: { "loc:a": "alpha" } });
    expect(main(["--check", "--root", root, "--snapshot", without])).toBe(1);
    expect(main(["withdraw", "proto:b", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", without])).toBe(0);
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    expect(read(root).places.slugs["proto:b"]).toBe("beta");
  });
});
