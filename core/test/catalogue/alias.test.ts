// Public ref aliases (public-ref-aliases 4.1, 4.3; REF-C acceptance A1): the eight pinned pairs, and the four properties of `publicRef`
// over EVERY ref in data/capture, data/suitability, data/relevance and data/catalogue/graph (total, injective, invertible, idempotent).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DATED_FOLDER_NAME_RE, aliasDeep, aliasOfFolder, fromPublicInput, isDated, NO_DATED_FOLDER_RE, privateRef, publicRef,
} from "../../src/catalogue/alias.ts";
import { folderAliasesOf, parseRegistry, SLUG_REGISTRY_PATH } from "../../src/catalogue/slugs.ts";
import { REF_RE } from "../../src/schema/api/common.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const REG = parseRegistry(readFileSync(join(ROOT, SLUG_REGISTRY_PATH), "utf8"));
const TABLE = folderAliasesOf(REG);

/** The spec's table (4.1), pinned once by `slugs.ts build`. */
const PINNED: Record<string, string> = {
  "algonquin-muskoka-oct-2026": "algonquin-muskoka-2026",
  "canadian-rockies-sept-2029": "canadian-rockies-2029",
  "chamonix-mont-blanc-sept-2028": "chamonix-mont-blanc-2028",
  "costa-rica-feb-2027": "costa-rica-2027",
  "dolomites-july-2027": "dolomites-2027",
  "niagara-day-aug-2026": "niagara-day-2026",
  "patagonia-feb-mar-2027": "patagonia-2027",
  "quebec-sept-2026": "quebec-2026",
};

function* jsonFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonFiles(p);
    else if (e.name.endsWith(".json")) yield p;
  }
}

/** Every string value and object key shaped like a ref (`<layer>/...`) in the four data folders. */
function allRefs(): Set<string> {
  const out = new Set<string>();
  const visit = (x: unknown): void => {
    if (typeof x === "string") {
      if (REF_RE.test(x)) out.add(x);
    } else if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if (REF_RE.test(k)) out.add(k);
        visit(v);
      }
    }
  };
  // data/trips/** too (REF-REVIEW): the `trip/<folder>` keys of base-points.json and stop-refs.json, and the ref of every data trip
  // (`data/trips/<id>/` is `trip/<id>`). When TD-3 creates `data/trips/canadian-rockies-2029/`, `trip/canadian-rockies-2029` meets the folder
  // key `trip/canadian-rockies-sept-2029`, whose alias is the same string: the injectivity test then fails, which is the point.
  for (const d of ["data/capture", "data/suitability", "data/relevance", "data/catalogue/graph", "data/trips"]) {
    if (!existsSync(join(ROOT, d))) continue; // data/catalogue/graph arrives with EG-I, which is not in every branch
    for (const f of jsonFiles(join(ROOT, d))) visit(JSON.parse(readFileSync(f, "utf8")));
  }
  for (const e of readdirSync(join(ROOT, "data/trips"), { withFileTypes: true })) if (e.isDirectory()) out.add(`trip/${e.name}`);
  return out;
}

describe("the folder table (4.1, 4.3)", () => {
  it("holds exactly the eight pinned pairs of the spec", () => {
    expect(TABLE).toEqual(PINNED);
  });
  it("each pair is the rule's own output, and no alias holds a month", () => {
    for (const [f, a] of Object.entries(TABLE)) {
      expect(aliasOfFolder(f), f).toBe(a);
      expect(DATED_FOLDER_NAME_RE.test(f), f).toBe(true);
      expect(isDated(a), a).toBe(false);
    }
  });
  it("each alias equals the trip slug the site already shows (web TRIP_SLUGS, read as text: core never imports web)", () => {
    const text = readFileSync(join(ROOT, "web/lib/public/slugs.ts"), "utf8");
    const block = /export const TRIP_SLUGS[^{]*\{([\s\S]*?)\};/.exec(text)?.[1] ?? "";
    const tripSlugs = Object.fromEntries([...block.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/g)].map((m) => [m[1]!, m[2]!]));
    for (const [f, a] of Object.entries(TABLE)) expect(tripSlugs[f], f).toBe(a);
  });
  it("a folder with no month is its own alias", () => {
    for (const f of ["iceland-ring-road", "usa-southwest-rockies", "vermont-fall-2026", "switzerland-2027", "norway-summer"]) expect(aliasOfFolder(f)).toBe(f);
  });
});

describe("publicRef and privateRef on the shapes refs take (4.1)", () => {
  const F = "canadian-rockies-sept-2029";
  const cases: [string, string][] = [
    [`legacy/${F}/sights/bow-lake`, "legacy/canadian-rockies-2029/sights/bow-lake"],
    [`part/legacy/${F}/hikes/x#top`, "part/legacy/canadian-rockies-2029/hikes/x#top"],
    [`offer/legacy/${F}/lifts/banff-gondola#ticket`, "offer/legacy/canadian-rockies-2029/lifts/banff-gondola#ticket"],
    [`trip/${F}`, "trip/canadian-rockies-2029"],
    [`offer-legacy-${F}-lifts-banff-gondola`, "offer-legacy-canadian-rockies-2029-lifts-banff-gondola"],
    ["legacy%2Fcanadian-rockies-sept-2029%2Fsights", "legacy%2Fcanadian-rockies-2029%2Fsights"],
    ["Canadian-Rockies-Sept-2029", "canadian-rockies-2029"],
    ["legacy/patagonia-feb-mar-2027/x", "legacy/patagonia-2027/x"],
  ];
  it("S2: reads the encodings the detector reads (%252F, %2D) and rewrites them instead of leaving a dated ref", () => {
    for (const i of [`legacy%252F${F}%252Fsights`, "legacy%2Fcanadian%2Drockies%2Dsept%2D2029%2Fsights", "x?u=legacy%252Fcanadian%252Drockies%252Dsept%252D2029"]) {
      const o = publicRef(i, TABLE);
      expect(isDated(decodeURIComponent(decodeURIComponent(o))), i).toBe(false);
      expect(isDated(o), i).toBe(false);
      expect(publicRef(o, TABLE), i).toBe(o); // idempotent
    }
    expect(publicRef("a%20b%26c", TABLE)).toBe("a%20b%26c"); // no folder: untouched, not re-encoded
  });
  it("replaces a pinned folder as a whole token, in every wrapper, encoded or in any case", () => {
    for (const [i, o] of cases) expect(publicRef(i, TABLE), i).toBe(o);
  });
  it("leaves a string with no pinned folder as the same string, and a folder inside a longer word alone", () => {
    for (const s of ["route/johnston-canyon", "place/lake-louise", "trip/canadian-rockies-2029/sight:x", "xcanadian-rockies-sept-2029"]) expect(publicRef(s, TABLE)).toBe(s);
  });
  it("inverts only after legacy/: trip/<alias> is a real data-trip ref and stays", () => {
    expect(privateRef("legacy/canadian-rockies-2029/sights/bow-lake", TABLE)).toBe(`legacy/${F}/sights/bow-lake`);
    expect(privateRef("offer/legacy/canadian-rockies-2029/lifts/x#ticket", TABLE)).toBe(`offer/legacy/${F}/lifts/x#ticket`);
    expect(privateRef("trip/canadian-rockies-2029", TABLE)).toBe("trip/canadian-rockies-2029");
    expect(privateRef("trip/canadian-rockies-2029/sight:bow lake", TABLE)).toBe("trip/canadian-rockies-2029/sight:bow lake");
  });
  it("fromPublicInput: a dated ref is unknown (null), whatever the month; an alias maps back", () => {
    expect(fromPublicInput(`legacy/${F}/sights/bow-lake`, TABLE)).toBeNull();
    expect(fromPublicInput("legacy/canadian-rockies-jan-2029/sights/bow-lake", TABLE)).toBeNull();
    expect(fromPublicInput("legacy/canadian-rockies-2029/sights/bow-lake", TABLE)).toBe(`legacy/${F}/sights/bow-lake`);
    expect(fromPublicInput("route/johnston-canyon", TABLE)).toBe("route/johnston-canyon");
  });
  it("aliasDeep rewrites values and keys, and returns an untouched branch as the same object", () => {
    const clean = { a: ["route/x"], b: { c: 1 } };
    const body = { ref: `legacy/${F}/sights/x`, refSlugs: { [`legacy/${F}/sights/x`]: "x" }, clean };
    const out = aliasDeep(body, TABLE);
    expect(out).toEqual({ ref: "legacy/canadian-rockies-2029/sights/x", refSlugs: { "legacy/canadian-rockies-2029/sights/x": "x" }, clean });
    expect(out.clean).toBe(clean);
    expect(aliasDeep(clean, TABLE)).toBe(clean);
  });
});

describe("publicRef over every ref in the data (4.1 properties)", () => {
  const refs = [...allRefs()];
  const dated = refs.filter((r) => Object.keys(TABLE).some((f) => r.includes(f)));

  it("reads the real data: hundreds of refs, the Rockies and Dolomites ones among them", () => {
    expect(refs.length).toBeGreaterThan(500);
    expect(dated.length).toBeGreaterThan(200);
    expect(dated.some((r) => r.includes("dolomites-july-2027"))).toBe(true);
  });
  it("total: no ref holds a dated folder after publicRef, and each public form passes the schemas' refusal", () => {
    const bad = refs.filter((r) => isDated(publicRef(r, TABLE)) || !NO_DATED_FOLDER_RE.test(publicRef(r, TABLE)));
    expect(bad).toEqual([]);
  });
  it("injective: distinct refs stay distinct", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const r of refs) {
      const p = publicRef(r, TABLE);
      const had = seen.get(p);
      if (had !== undefined && had !== r) clashes.push(`${had} and ${r} -> ${p}`);
      seen.set(p, r);
    }
    expect(clashes).toEqual([]);
  });
  it("invertible: privateRef(publicRef(r)) === r for every ref that names a legacy folder", () => {
    const bad = refs.filter((r) => r.includes("legacy/") && privateRef(publicRef(r, TABLE), TABLE) !== r).map((r) => `${r} -> ${publicRef(r, TABLE)} -> ${privateRef(publicRef(r, TABLE), TABLE)}`);
    expect(bad).toEqual([]);
  });
  it("idempotent: publicRef(publicRef(s)) === publicRef(s)", () => {
    for (const r of refs) {
      const p = publicRef(r, TABLE);
      expect(publicRef(p, TABLE), r).toBe(p);
    }
  });
  it("a ref with no dated folder is unchanged, so no other public id moves", () => {
    for (const r of refs.filter((x) => !isDated(x))) expect(publicRef(r, TABLE)).toBe(r);
  });
});
