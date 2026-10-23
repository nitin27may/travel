import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORIGIN_KEYS_PATH, SLUG_REGISTRY_PATH, aliasKey, assignPlaceSlugs, assignSeedSlugs, currentSlug, emptyOriginKeys, emptyRegistry, isWithdrawn,
  kebab, mergeKey, migrateOrigins, movedTo, originDrift, originKeysText, originProblems, parseOriginKeys, parseRegistry, registryDrift,
  registryProblems, registryText, renameSlug, reoriginKey, resolveRef, resolveRegion, updateOriginKeys, updateRegistry, withdrawKey,
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
  // an unpinned wishlist or prototype page is assigned under its private origin key, in memory only (A24); pinned keys are refs
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
    expect(assignPlaceSlugs([{ ...c, key: "place/bow-lake", name: "Bow Lake Lodge" }], reg({ "place/bow-lake": "bow-lake" })).get("place/bow-lake")).toBe("bow-lake");
  });
  it("a newcomer whose name clashes with a pinned slug takes the suffix; the incumbent is never renamed (D-B1)", () => {
    const got = assignPlaceSlugs([{ ...a, key: "place/moss-glen-falls" }, b], reg({ "place/moss-glen-falls": "moss-glen-falls" }));
    expect(got.get("place/moss-glen-falls")).toBe("moss-glen-falls");
    expect(got.get("loc:b")).toBe("moss-glen-falls-granville");
  });
  it("a newcomer never takes a retired or withdrawn slug; a withdrawn key that comes back gets its slug again", () => {
    expect(assignPlaceSlugs([c], reg({ "place/x": "bow-lake-new" }, { retired: { "bow-lake": "place/x" } })).get("proto:c")).toBe("bow-lake-banff");
    expect(assignPlaceSlugs([c], reg({}, { withdrawn: { "place/gone": "bow-lake" } })).get("proto:c")).toBe("bow-lake-banff");
    expect(assignPlaceSlugs([{ ...c, key: "place/bow-lake-old" }], reg({}, { withdrawn: { "place/bow-lake-old": "bow-lake-old" } })).get("place/bow-lake-old")).toBe("bow-lake-old");
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
    // A24: the registry may be published, so a private origin key anywhere in it is a problem, and the message never quotes the key
    for (const bad of [reg({ "loc:CA/secret": "x" }), reg({ "place/x": "x" }, { withdrawn: { "proto:secret": "y" } }), reg({ "place/x": "x" }, {}, { formerKeys: { "loc:secret": "place/x" } })]) {
      const p = registryProblems(bad).join("\n");
      expect(p).toMatch(/private origin key/);
      expect(p).not.toMatch(/secret/);
    }
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
    // a wishlist page (`place/x`, A24) gains a capture record, which is later renamed
    const r = renameSlug(reg({ "place/x": "x" }), "place/x", "x2");
    const one = aliasKey(r, "place/x", "route/a");
    expect(one.places.slugs).toEqual({ "route/a": "x2" });
    expect(one.places.retired).toEqual({ x: "route/a" });
    expect(one.formerKeys).toEqual({ "place/x": "route/a" });
    const two = aliasKey(one, "route/a", "route/a2");
    expect(two.formerKeys).toEqual({ "place/x": "route/a2", "route/a": "route/a2" });
    expect(resolveRef(two, "place/x")).toEqual({ key: "route/a2", slug: "x2", space: "places" });
    expect(registryProblems(two)).toEqual([]);
    expect(() => aliasKey(two, "place/x", "route/b")).toThrow(/has no slug/);
    // A24: an origin key never enters the registry, not even as a former key
    expect(() => aliasKey(two, "route/a2", "loc:CA/x")).toThrow(/origin key/);
    expect(() => aliasKey(reg({ "proto:x": "x" }), "proto:x", "place/x")).toThrow(/origin key/);
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
  it("names no wishlist or prototype origin: no loc: or proto: anywhere, the pages with no capture record are place/<slug> (A24)", () => {
    expect(text).not.toMatch(/\b(?:loc|proto):/);
    const origins = parseOriginKeys(readFileSync(join(ROOT, ORIGIN_KEYS_PATH), "utf8"));
    expect(originProblems(origins, r)).toEqual([]);
    expect(originKeysText(origins)).toBe(readFileSync(join(ROOT, ORIGIN_KEYS_PATH), "utf8"));
    const refs = Object.values(origins.keys);
    expect(refs.length).toBe(115);
    // minted from the first pinned slug; none renamed yet, so every one still equals its slug
    for (const ref of refs) expect(r.places.slugs[ref], ref).toBe(ref.slice("place/".length));
  });
});

describe("the private origin keys (A24)", () => {
  const registry = reg({ "place/alpha": "alpha", "place/beta": "beta", "route/c": "gamma" });
  const o = { ...emptyOriginKeys(), keys: { "loc:CA/x/alpha": "place/alpha", "proto:beta": "place/beta" } };
  it("checks against the registry: a ref the registry lacks, two origins on one ref; messages never quote an origin", () => {
    expect(originProblems(o, registry)).toEqual([]);
    const bad = { ...o, keys: { ...o.keys, "loc:secret": "place/alpha", "proto:secret2": "place/nowhere" } };
    const p = originProblems(bad, registry).join("\n");
    expect(p).toMatch(/two origins share the ref place\/alpha/);
    expect(p).toMatch(/place\/nowhere is not a place key/);
    expect(p).not.toMatch(/secret/);
    // a former key still counts: the page became a capture page and the old ref resolves through formerKeys
    expect(originProblems(o, aliasKey(registry, "place/beta", "route/b"))).toEqual([]);
  });
  it("update pins new origins and refuses a changed one; drift names the missing pin", () => {
    const s = { ...snap({ "place/alpha": "alpha" }), origins: { "loc:CA/x/alpha": "place/alpha", "loc:new": "place/new" } };
    const u = updateOriginKeys(o, s);
    expect(u.problems).toEqual([]);
    expect(u.added).toBe(1);
    expect(u.originKeys.keys["loc:new"]).toBe("place/new");
    expect(updateOriginKeys(o, { ...s, origins: { "proto:beta": "place/other" } }).problems.join()).toMatch(/pinned to place\/beta/);
    expect(originDrift(o, s, registry).join()).toMatch(/origin of place\/new is not pinned/);
  });
  it("reorigin moves a pin and keeps the ref; migrate rekeys loc:/proto: keys to place/<slug> without former keys", () => {
    const moved = reoriginKey(o, "loc:CA/x/alpha", "loc:CA/y/alpha");
    expect(moved.keys).toEqual({ "loc:CA/y/alpha": "place/alpha", "proto:beta": "place/beta" });
    expect(() => reoriginKey(o, "loc:none", "loc:z")).toThrow(/not pinned/);
    expect(() => reoriginKey(o, "loc:CA/x/alpha", "place/z")).toThrow(/must start/);
    const legacy: SlugRegistry = { ...emptyRegistry(), places: space({ "loc:CA/x/alpha": "alpha", "proto:b": "beta-two", "route/c": "gamma" }, { retired: { beta: "proto:b" }, merged: { "route/c": "loc:CA/x/alpha" } }) };
    const m = migrateOrigins(legacy);
    expect(m.moved).toBe(2);
    expect(m.registry.places.slugs).toEqual({ "place/alpha": "alpha", "place/beta-two": "beta-two", "route/c": "gamma" });
    expect(m.registry.places.retired).toEqual({ beta: "place/beta-two" });
    expect(m.registry.places.merged).toEqual({ "route/c": "place/alpha" });
    expect(m.registry.formerKeys).toEqual({});
    expect(m.originKeys.keys).toEqual({ "loc:CA/x/alpha": "place/alpha", "proto:b": "place/beta-two" });
    expect(registryText(m.registry)).not.toMatch(/\b(?:loc|proto):/);
    expect(() => migrateOrigins({ ...legacy, places: space({ "loc:a": "alpha", "place/alpha": "other" }) })).toThrow(/registry key already/);
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
  const base = snap({ "place/alpha": "alpha", "place/beta": "beta" }, { regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } }, origins: { "loc:CA/x/alpha": "place/alpha", "proto:b": "place/beta" } });
  const read = (root: string) => parseRegistry(readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8"));
  const readOrigins = (root: string) => parseOriginKeys(readFileSync(join(root, ORIGIN_KEYS_PATH), "utf8"));

  it("build writes the registry; --check passes; a new key fails --check until build; a vanished key needs alias", () => {
    const root = tmpRoot();
    const s1 = file(root, base);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s1])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s1])).toBe(0);
    expect(readOrigins(root).keys).toEqual(base.origins);
    expect(readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8")).not.toMatch(/\b(?:loc|proto):/);
    expect(main(["--check", "--root", root, "--snapshot", file(root, { ...base, places: { ...base.places, "place/gamma": "gamma" } })])).toBe(1);
    // a new wishlist place: the ref is pinned in the registry and its origin in the private file, both by build
    const s2 = file(root, { ...base, places: { ...base.places, "place/gamma": "gamma" }, origins: { ...base.origins, "loc:CA/x/gamma": "place/gamma" } });
    expect(main(["build", "--root", root, "--snapshot", s2])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s2])).toBe(0);
    // an origin pinned in the registry but missing from the private file fails --check
    expect(main(["--check", "--root", root, "--snapshot", file(root, { ...base, places: { ...base.places, "place/gamma": "gamma" }, origins: { ...base.origins, "loc:CA/x/other": "place/gamma" } })])).toBe(1);
    // the wishlist page gains a capture record: alias, and the old ref resolves through formerKeys
    const s3 = file(root, { ...base, places: { "route/a": "alpha", "place/beta": "beta", "place/gamma": "gamma" }, origins: { "proto:b": "place/beta", "loc:CA/x/gamma": "place/gamma" } });
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", s3])).toBe(1);
    expect(main(["alias", "place/alpha", "route/a", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", s3])).toBe(0);
    expect(read(root).formerKeys).toEqual({ "place/alpha": "route/a" });
    expect(main(["alias", "loc:CA/x/gamma", "route/g", "--root", root])).toBe(1);
  });

  it("rename and merge redirect; a survivor cannot be withdrawn", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    expect(main(["rename", "place/beta", "beta-two", "--root", root])).toBe(0);
    expect(movedTo(read(root), "beta")).toEqual({ slug: "beta-two", key: "place/beta" });
    // the ref is minted once: a rename keeps it, and --check agrees once the builder gives the new slug under the same ref
    expect(main(["--check", "--root", root, "--snapshot", file(root, { ...base, places: { "place/alpha": "alpha", "place/beta": "beta-two" } })])).toBe(0);
    expect(main(["merge", "place/beta", "place/alpha", "--root", root])).toBe(0);
    expect(movedTo(read(root), "beta-two")).toEqual({ slug: "alpha", key: "place/alpha" });
    expect(main(["withdraw", "place/alpha", "--root", root])).toBe(1);
    expect(main(["rename", "nope", "x", "--root", root])).toBe(1);
    expect(main(["frobnicate", "--root", root])).toBe(2);
  });

  it("withdraw lets a vanished key pass --check, and build restores it when it returns", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    const without = file(root, { ...base, places: { "place/alpha": "alpha" }, origins: { "loc:CA/x/alpha": "place/alpha" } });
    expect(main(["--check", "--root", root, "--snapshot", without])).toBe(1);
    expect(main(["withdraw", "place/beta", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", without])).toBe(0);
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    expect(read(root).places.slugs["place/beta"]).toBe("beta");
  });

  it("reorigin keeps the ref when a wishlist id changes; migrate-origins runs once", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    const moved = file(root, { ...base, origins: { "loc:CA/y/alpha": "place/alpha", "proto:b": "place/beta" } });
    expect(main(["--check", "--root", root, "--snapshot", moved])).toBe(1);
    expect(main(["reorigin", "loc:CA/x/alpha", "loc:CA/y/alpha", "--root", root])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", moved])).toBe(0);
    expect(main(["migrate-origins", "--root", root])).toBe(1);
    const legacy = tmpRoot();
    const old: SlugRegistry = { ...emptyRegistry(), places: space({ "loc:CA/x/alpha": "alpha", "proto:b": "beta" }), regions: { "ca/alberta": { name: "Alberta", aliases: ["AB"] } } };
    mkdirSync(join(legacy, "data", "catalogue"), { recursive: true });
    writeFileSync(join(legacy, SLUG_REGISTRY_PATH), JSON.stringify(old));
    expect(main(["migrate-origins", "--root", legacy])).toBe(0);
    expect(main(["--check", "--root", legacy, "--snapshot", file(legacy, base)])).toBe(0);
    expect(readOrigins(legacy).keys).toEqual(base.origins);
  });
});
