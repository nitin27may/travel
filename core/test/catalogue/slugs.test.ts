import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORIGIN_KEYS_PATH, RESERVED_API_WORDS, SLUG_REGISTRY_PATH, aliasKey, assignPlaceSlugs, assignSeedSlugs, currentSlug, emptyOriginKeys, emptyRegistry, isWithdrawn,
  kebab, mergeKey, migrateOrigins, movedTo, originDrift, originKeysText, originProblems, parseOriginKeys, parseRegistry, registryDrift,
  registryProblems, registryText, renameSlug, reoriginKey, reservedSlugs, resolveRef, resolveRegion, unmintKey, updateOriginKeys, updateRegistry, withdrawKey,
  folderAliasProblems, folderAliasWarnings, folderAliasesOf, legacyFoldersIn, pinFolderAliases,
  type SlugRegistry, type SlugSnapshot, type SlugSpace,
} from "../../src/catalogue/slugs.ts";
import { baseRef, main } from "../../bin/slugs.ts";

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

describe("reserved API words (A38)", () => {
  const seed = (ref: string, name: string, district = "lakes") => ({ ref, name, areaChain: [{ slug: "ca" }, { slug: "ab" }, { slug: district }], typeLabel: "Lake" });
  it("reservedSlugs holds counts, unchecked and cards for places only", () => {
    for (const w of RESERVED_API_WORDS) {
      expect(reservedSlugs(reg({}), "places").has(w)).toBe(true);
      expect(reservedSlugs(reg({}), "trips").has(w)).toBe(false);
    }
  });
  it("a newcomer named like a path word gets another slug", () => {
    const out = assignSeedSlugs([seed("a", "Counts"), seed("b", "Unchecked"), seed("c", "Cards", "ridge")], new Set());
    for (const w of RESERVED_API_WORDS) expect([...out.values()], w).not.toContain(w);
  });
  it("a rename cannot take a path word", () => {
    expect(() => renameSlug(reg({ a: "x" }), "a", "counts")).toThrow(/pinned, retired or withdrawn/);
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

describe("unmintKey (SLUG-FIX: a pin that was never public)", () => {
  const origins = { ...emptyOriginKeys(), keys: { "loc:IS/w/a/snaefellsjokull": "place/sn-fellsjokull", "loc:CA/x/alpha": "place/alpha" } };
  const released = reg({ "place/alpha": "alpha" }, { retired: { "alpha-old": "place/alpha" }, withdrawn: { "place/gone": "gone" } });
  it("drops the key and its origin, retires nothing, so build mints it again from today's rule", () => {
    const now = reg({ "place/alpha": "alpha", "place/sn-fellsjokull": "sn-fellsjokull" });
    const m = unmintKey(now, origins, "place/sn-fellsjokull", released);
    expect(m.slug).toBe("sn-fellsjokull");
    expect(m.origins).toBe(1);
    expect(m.registry.places.slugs).toEqual({ "place/alpha": "alpha" });
    expect(m.registry.places.retired).toEqual({});
    expect(m.registry.formerKeys).toEqual({});
    expect(m.originKeys.keys).toEqual({ "loc:CA/x/alpha": "place/alpha" });
    const again = updateRegistry(m.registry, snap({ "place/alpha": "alpha", "place/snaefellsjokull": "snaefellsjokull" }));
    expect(again.problems).toEqual([]);
    expect(again.registry.places.slugs["place/snaefellsjokull"]).toBe("snaefellsjokull");
    expect(reservedSlugs(again.registry).has("sn-fellsjokull")).toBe(false);
  });
  it("refuses a key or a slug the released registry holds: those are permanent and change only through rename", () => {
    expect(() => unmintKey(reg({ "place/alpha": "alpha" }), origins, "place/alpha", released)).toThrow(/released registry/);
    expect(() => unmintKey(reg({ "place/new": "alpha-old" }), origins, "place/new", released)).toThrow(/slug alpha-old is in the released registry/);
    expect(() => unmintKey(reg({ "place/back": "gone" }), origins, "place/back", released)).toThrow(/slug gone is in the released registry/);
    expect(() => unmintKey(reg({ "place/gone": "other" }), origins, "place/gone", released)).toThrow(/place\/gone is in the released registry/);
  });
  it("refuses a key with history here (a retired slug, a merge, a former key) and a key with no slug", () => {
    const none = emptyRegistry();
    expect(() => unmintKey(reg({ "place/b": "b2" }, { retired: { b: "place/b" } }), origins, "place/b", none)).toThrow(/retired/);
    expect(() => unmintKey(reg({ "place/b": "b", "place/c": "c" }, { merged: { "place/c": "place/b" } }), origins, "place/b", none)).toThrow(/merge/);
    expect(() => unmintKey(reg({ "place/b": "b" }, {}, { formerKeys: { "route/old": "place/b" } }), origins, "place/b", none)).toThrow(/former key/);
    expect(() => unmintKey(reg({}), origins, "place/b", none)).toThrow(/has no slug/);
  });
});

describe("data/catalogue/slugs.json, as committed", () => {
  const text = readFileSync(join(ROOT, SLUG_REGISTRY_PATH), "utf8");
  const r = parseRegistry(text);
  it("parses, has no problem of its own, and is in canonical form (written by slugs.ts, never by hand)", () => {
    expect(registryProblems(r)).toEqual([]);
    expect(registryText(r)).toBe(text);
  });
  it("pins today's 439 place keys (434 before PA-R-CA added the 5 parks) with the 3 merged records recorded and the 5 folded offer pages (DATA-D4a) withdrawn, every trip, and 48 regions (AREA-2 added 76 store places and 7 regions); merged slugs answer moved (R-1)", () => {
    expect(Object.keys(r.places.slugs).length).toBe(439);
    expect(Object.keys(r.places.merged).length).toBe(3);
    expect(Object.keys(r.places.withdrawn).length).toBe(5);
    for (const [k, survivor] of Object.entries(r.places.merged)) expect(movedTo(r, r.places.slugs[k]!)?.slug).toBe(r.places.slugs[survivor]);
    expect(Object.keys(r.trips.slugs).length).toBeGreaterThan(5);
    expect(Object.keys(r.regions).length).toBe(48);
    expect(resolveRegion(r, "CA-AB", "CA")).toEqual(["ca/alberta"]);
  });
  it("holds none of the slugs the old slugifier broke (SLUG-FIX), and the Icelandic pages carry their spelled-out slugs", () => {
    for (const bad of ["sn-fellsjokull", "reykjahli", "grundarfjor-ur", "kirkjub-jarklaustur"]) expect(reservedSlugs(r).has(bad), bad).toBe(false);
    for (const good of ["snaefellsjokull", "reykjahlid", "grundarfjordur", "kirkjubaejarklaustur"]) expect(r.places.slugs[`place/${good}`], good).toBe(good);
  });
  it("keeps every entry of the deployed release/v0.1 registry unchanged (permanent slugs); skipped where the tag is absent", () => {
    const run = spawnSync("git", ["-C", ROOT, "show", `release/v0.1:${SLUG_REGISTRY_PATH}`], { encoding: "utf8" });
    if (run.status !== 0) return;
    const rel = parseRegistry(run.stdout);
    for (const name of ["places", "trips"] as const) {
      for (const sec of ["slugs", "retired", "merged", "withdrawn"] as const) for (const [k, v] of Object.entries(rel[name][sec])) expect(r[name][sec][k], `${name}.${sec} ${k}`).toBe(v);
    }
    for (const [k, v] of Object.entries(rel.formerKeys)) expect(r.formerKeys[k]).toBe(v);
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
    expect(refs.length).toBe(196); // 191 before PA-R-CA's 5 park store places
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

  it("unmint drops a pin the release never had (no 308), refuses a released one, and needs the release named", () => {
    const root = tmpRoot();
    expect(main(["build", "--root", root, "--snapshot", file(root, base)])).toBe(0);
    const rel = join(root, "released.json");
    writeFileSync(rel, registryText(reg({ "place/alpha": "alpha" })));
    expect(main(["unmint", "place/beta", "--root", root])).toBe(1);
    expect(main(["unmint", "place/alpha", "--root", root, "--released-file", rel])).toBe(1);
    expect(main(["unmint", "place/beta", "--root", root, "--released-file", rel])).toBe(0);
    expect(read(root).places.slugs["place/beta"]).toBeUndefined();
    expect(read(root).places.retired).toEqual({});
    expect(readOrigins(root).keys).toEqual({ "loc:CA/x/alpha": "place/alpha" });
    const remint = file(root, { ...base, places: { "place/alpha": "alpha", "place/beta-fixed": "beta-fixed" }, origins: { "loc:CA/x/alpha": "place/alpha", "proto:b": "place/beta-fixed" } });
    expect(main(["build", "--root", root, "--snapshot", remint])).toBe(0);
    expect(main(["--check", "--root", root, "--snapshot", remint])).toBe(0);
    expect(read(root).places.slugs["place/beta-fixed"]).toBe("beta-fixed");
  });
});

describe("folder aliases (public-ref-aliases 4.3)", () => {
  const withTable = (table: Record<string, string>, trips: Record<string, string> = {}): SlugRegistry => ({
    ...emptyRegistry(),
    trips: { slugs: trips, retired: {}, merged: {}, withdrawn: {}, folderAliases: table },
  });
  const codes = (r: SlugRegistry, folders: string[], base: SlugRegistry | null = null) => folderAliasProblems(r, folders, base).map((p) => p.code);

  it("build pins every dated folder by the rule, once, and leaves undated folders and pinned entries alone", () => {
    const { registry, added } = pinFolderAliases(emptyRegistry(), ["x-sept-2029", "y-feb-mar-2027", "vermont-fall-2026", "iceland-ring-road"]);
    expect(folderAliasesOf(registry)).toEqual({ "x-sept-2029": "x-2029", "y-feb-mar-2027": "y-2027" });
    expect(added).toHaveLength(2);
    // a pinned entry is never recomputed, even if it is not what the rule gives today (4.2)
    const kept = pinFolderAliases(withTable({ "x-sept-2029": "x-2029" }), ["x-sept-2029", "z-oct-2026"]);
    expect(folderAliasesOf(kept.registry)).toEqual({ "x-sept-2029": "x-2029", "z-oct-2026": "z-2026" });
    expect(pinFolderAliases(registry, ["x-sept-2029"]).registry).toBe(registry);
  });
  it("E_SLUG_ALIAS_PINNED: an entry edited or removed against the committed registry, or edited away from the rule", () => {
    const base = withTable({ "x-sept-2029": "x-2029" });
    expect(codes(base, ["x-sept-2029"], base)).toEqual([]);
    expect(codes(withTable({}), [], base)).toEqual(["E_SLUG_ALIAS_PINNED"]);
    expect(codes(withTable({ "x-sept-2029": "x-trip-2029" }), ["x-sept-2029"], base)).toEqual(["E_SLUG_ALIAS_PINNED", "E_SLUG_ALIAS_PINNED"]);
    // no base (a fresh clone of a committed edit): the rule still catches the edit
    expect(codes(withTable({ "x-sept-2029": "x-trip-2029" }), ["x-sept-2029"])).toEqual(["E_SLUG_ALIAS_PINNED"]);
  });
  it("E_SLUG_ALIAS_DATED: an alias that still holds a month and a year", () => {
    // three months: the rule removes the two next to the year, and what is left is still dated, so build refuses it
    expect(codes(withTable({ "x-may-jun-jul-2027": "x-may-2027" }), ["x-may-jun-jul-2027"])).toEqual(["E_SLUG_ALIAS_DATED"]);
    expect(codes(withTable({ "x-sept-2029": "x-sept-2029" }), ["x-sept-2029"])).toContain("E_SLUG_ALIAS_DATED");
    const built = updateRegistry(emptyRegistry(), snap({ "legacy/x-may-jun-jul-2027/sights/a": "a" }));
    expect(built.problems.join("\n")).toMatch(/E_SLUG_ALIAS_DATED/);
  });
  it("E_SLUG_ALIAS_COLLIDE: two folders on one alias, or an alias that is another legacy folder's name", () => {
    expect(codes(withTable({ "x-sept-2029": "x-2029", "x-oct-2029": "x-2029" }), ["x-sept-2029", "x-oct-2029"])).toEqual(["E_SLUG_ALIAS_COLLIDE"]);
    expect(codes(withTable({ "x-sept-2029": "x-2029" }), ["x-sept-2029", "x-2029"])).toEqual(["E_SLUG_ALIAS_COLLIDE"]);
    const built = updateRegistry(emptyRegistry(), snap({ "legacy/x-sept-2029/a": "a", "legacy/x-oct-2029/b": "b" }));
    expect(built.problems.join("\n")).toMatch(/E_SLUG_ALIAS_COLLIDE/);
  });
  it("E_SLUG_ALIAS_MISSING: a dated legacy folder with no entry; drift says so and build fills it", () => {
    expect(codes(emptyRegistry(), ["x-sept-2029", "iceland-ring-road"])).toEqual(["E_SLUG_ALIAS_MISSING"]);
    const s = snap({ "legacy/x-sept-2029/sights/a": "a" });
    expect(registryDrift(emptyRegistry(), s).drift.join("\n")).toMatch(/E_SLUG_ALIAS_MISSING/);
    const u = updateRegistry(emptyRegistry(), s);
    expect(u.problems).toEqual([]);
    expect(folderAliasesOf(u.registry)).toEqual({ "x-sept-2029": "x-2029" });
    expect(registryDrift(u.registry, s).drift).toEqual([]);
  });
  it("a key that is not a dated folder is refused by the registry schema", () => {
    expect(registryProblems(withTable({ "iceland-ring-road": "iceland-ring-road" })).join()).toMatch(/trips\.folderAliases\.iceland-ring-road: Invalid key/);
  });
  it("finds legacy folders inside refs and file text; a trip rename only warns (the alias stays)", () => {
    expect(legacyFoldersIn(["part/legacy/a-sept-2029/x#top", "legacy/b/y", "trip/c-oct-2026/z", '"offer/legacy/d-may-2027/q#ticket"'])).toEqual(["a-sept-2029", "b", "d-may-2027"]);
    const r = withTable({ "x-sept-2029": "x-2029" }, { "trip/x-2029": "x-2029" });
    expect(folderAliasWarnings(r)).toEqual([]);
    const renamed = renameSlug(r, "trip/x-2029", "x-rockies-2029");
    expect(folderAliasesOf(renamed)).toEqual({ "x-sept-2029": "x-2029" });
    expect(folderAliasWarnings(renamed)).toHaveLength(1);
  });
  it("the table survives every registry edit and the file text round-trip", () => {
    const r = withTable({ "x-sept-2029": "x-2029" }, { "trip/x-2029": "x-2029" });
    expect(parseRegistry(registryText(r))).toEqual(r);
    expect(folderAliasesOf(withdrawKey(r, "trip/x-2029"))).toEqual({ "x-sept-2029": "x-2029" });
    expect(folderAliasesOf(aliasKey(r, "trip/x-2029", "trip/x-new"))).toEqual({ "x-sept-2029": "x-2029" });
  });
  it("the committed registry: every dated folder of legacy/MANIFEST.json is pinned and no rule fails", () => {
    const committed = parseRegistry(readFileSync(join(ROOT, SLUG_REGISTRY_PATH), "utf8"));
    const manifest = JSON.parse(readFileSync(join(ROOT, "legacy", "MANIFEST.json"), "utf8")) as { folders: { slug: string }[] };
    expect(folderAliasProblems(committed, manifest.folders.map((f) => f.slug), committed)).toEqual([]);
    expect(Object.keys(folderAliasesOf(committed))).toHaveLength(8);
    expect(folderAliasWarnings(committed)).toEqual([]);
  });
});

describe("node core/bin/slugs.ts: folder aliases", () => {
  const tmpRoot = () => mkdtempSync(join(tmpdir(), "slugs-alias-"));
  const write = (dir: string, name: string, x: unknown) => {
    const f = join(dir, name);
    writeFileSync(f, typeof x === "string" ? x : JSON.stringify(x));
    return f;
  };
  const s = snap({ "legacy/x-sept-2029/sights/a": "a", "route/b": "b" }, { trips: { "trip/x-2029": "x-2029" } });
  const readReg = (root: string) => parseRegistry(readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8"));
  const edit = (root: string, change: (r: SlugRegistry) => SlugRegistry) => writeFileSync(join(root, SLUG_REGISTRY_PATH), registryText(change(readReg(root))));

  it("build pins the alias; --check refuses an edit, a removal, a collision, a dated alias and a missing folder", () => {
    const root = tmpRoot();
    const sf = write(root, "snap.json", s);
    expect(main(["build", "--root", root, "--snapshot", sf])).toBe(0);
    expect(folderAliasesOf(readReg(root))).toEqual({ "x-sept-2029": "x-2029" });
    const committed = write(root, "base.json", readFileSync(join(root, SLUG_REGISTRY_PATH), "utf8"));
    const check = () => main(["--check", "--root", root, "--snapshot", sf, "--base-file", committed]);
    expect(check()).toBe(0);
    const t = (table: Record<string, string>) => (r: SlugRegistry): SlugRegistry => ({ ...r, trips: { ...r.trips, folderAliases: table } });
    // an edit (E_SLUG_ALIAS_PINNED)
    edit(root, t({ "x-sept-2029": "x-trip-2029" }));
    expect(check()).toBe(1);
    // a removal (E_SLUG_ALIAS_PINNED against the committed file, and E_SLUG_ALIAS_MISSING)
    edit(root, t({}));
    expect(check()).toBe(1);
    // a dated alias (E_SLUG_ALIAS_DATED)
    edit(root, t({ "x-sept-2029": "x-oct-2029" }));
    expect(check()).toBe(1);
    // a collision (E_SLUG_ALIAS_COLLIDE): a second folder on the same alias
    edit(root, t({ "x-sept-2029": "x-2029", "x-oct-2029": "x-2029" }));
    expect(check()).toBe(1);
    // restored: green again; a new dated folder in the data needs build
    edit(root, t({ "x-sept-2029": "x-2029" }));
    expect(check()).toBe(0);
    mkdirSync(join(root, "data", "capture", "z"), { recursive: true });
    write(join(root, "data", "capture", "z"), "r.json", { records: [{ ref: "legacy/z-may-2027/sights/q" }] });
    expect(check()).toBe(1);
    expect(main(["build", "--root", root, "--snapshot", sf])).toBe(0);
    expect(folderAliasesOf(readReg(root))["z-may-2027"]).toBe("z-2027");
  });

  it("S5: --check compares with origin/main by default, so a removal that is committed on the branch still fails; HEAD would pass it", () => {
    const root = tmpRoot();
    const git = (...a: string[]) => spawnSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" });
    const sf = write(root, "snap.json", s);
    expect(main(["build", "--root", root, "--snapshot", sf])).toBe(0);
    git("init", "-q", "-b", "main");
    git("add", SLUG_REGISTRY_PATH);
    git("commit", "-q", "-m", "registry");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    const t = (table: Record<string, string>) => (r: SlugRegistry): SlugRegistry => ({ ...r, trips: { ...r.trips, folderAliases: table } });
    edit(root, t({}));
    git("commit", "-q", "-am", "remove the alias");
    expect(baseRef(root, []).ref).toBe("origin/main");
    // the "removed" half of E_SLUG_ALIAS_PINNED needs a base that still holds the alias: HEAD (the commit under test) has lost it
    const run = (...extra: string[]): { code: number; text: string } => {
      let text = "";
      const w = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((c: string | Uint8Array) => ((text += String(c)), true)) as typeof process.stderr.write;
      try {
        return { code: main(["--check", "--root", root, "--snapshot", sf, ...extra]), text };
      } finally {
        process.stderr.write = w;
      }
    };
    expect(run("--base", "HEAD").text).not.toMatch(/was removed; a pinned alias is permanent/);
    const dflt = run();
    expect(dflt.code).toBe(1);
    expect(dflt.text).toMatch(/was removed; a pinned alias is permanent/); // the default (origin/main) closes the hole
    expect(run("--base", "no-such-ref").code).toBe(1); // an unreadable explicit base is an error, not a skip
    process.env.SLUGS_BASE = "HEAD";
    try {
      expect(baseRef(root, []).ref).toBe("HEAD");
    } finally {
      delete process.env.SLUGS_BASE;
    }
  });
});
