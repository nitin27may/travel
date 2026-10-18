import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ERROR_CODE_LIST, REL_ERROR_CODES, REL_ERROR_LIST, REL_WARNING_LIST, SUIT_ERROR_LIST, allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";
import { REGISTRY } from "../../src/schema/index.ts";
import { relevance } from "../../src/schema/relevance.ts";
import { doc, rec, rv } from "./helpers.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core", "test", "fixtures", "relevance");
const ROOT = join(FIX, "root");
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const names = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));
const run = (d: unknown, today = "2026-10-18", root = ROOT) => {
  process.env.RELEVANCE_TODAY = today;
  return validateDoc(d, "sidecar", root, { kind: "relevance" as never });
};

describe("registration", () => {
  it("relevance is a document table of the schema registry and exports to JSON Schema", () => {
    expect(REGISTRY.map((t) => t.key)).toContain("sidecar.relevance");
    expect(relevance.meta.single).toBe(true);
  });
  it("detects lane files and leaves signals, derived and inputs out", () => {
    expect(detect(join(REPO, "data/relevance/canadian-rockies-2029/R2a.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "relevance" });
    expect(detect(join(REPO, "data/relevance/signals/wikidata.json"), {}, REPO)).toBeNull();
    expect(detect(join(REPO, "data/relevance/derived/x.json"), {}, REPO)).toBeNull();
    expect(detect(null, { schema: "relevance/1" }, REPO)).toEqual({ family: "sidecar", kind: "relevance" });
  });
  it("--all takes lane files and skips generated folders", () => {
    const root = mkdtempSync(join(tmpdir(), "rel-all-"));
    tmp.push(root);
    for (const p of ["data/relevance/t", "data/relevance/signals", "data/relevance/derived", "data/relevance/inputs"]) mkdirSync(join(root, p), { recursive: true });
    for (const p of ["t/R1.json", "signals/wikidata.json", "derived/t.json", "inputs/points.json"]) writeFileSync(join(root, "data/relevance", p), "{}");
    const files = allFiles(root).map((f) => f.slice(root.length + 1));
    expect(files).toContain("data/relevance/t/R1.json");
    expect(files.filter((f) => f.includes("relevance"))).toEqual(["data/relevance/t/R1.json"]);
  });
  it("the relevance codes are a block apart from the structural and suitability ones", () => {
    expect(ERROR_CODE_LIST.some((c) => c.startsWith("E_REL"))).toBe(false);
    expect(SUIT_ERROR_LIST.some((c) => c.startsWith("E_REL"))).toBe(false);
    expect(REL_WARNING_LIST.every((c) => c.startsWith("W_REL_"))).toBe(true);
  });
});

describe("valid fixtures", () => {
  for (const n of names(join(FIX, "valid"))) {
    it(`valid/${n}.json has zero errors`, () => {
      const r = validateFile(join(FIX, "valid", `${n}.json`), ROOT);
      expect(r.errors, JSON.stringify(r.errors, null, 1)).toEqual([]);
    });
  }
});

describe("one failing fixture for every error code", () => {
  const broken = names(join(FIX, "broken"));
  it("has exactly one fixture per E_REL code", () => {
    expect(broken).toEqual([...REL_ERROR_LIST].sort());
  });
  for (const code of broken) {
    it(`${code} yields that code and no other error`, () => {
      const r = validateFile(join(FIX, "broken", `${code}.json`), ROOT);
      expect(codes(r), JSON.stringify(r.errors, null, 1)).toEqual([code]);
    });
  }
  it("every message says what is wrong and gives an example or a way out", () => {
    for (const code of broken) {
      for (const e of validateFile(join(FIX, "broken", `${code}.json`), ROOT).errors) {
        expect(e.path === "" || e.path.startsWith("/"), `${code} path ${e.path}`).toBe(true);
        expect(e.message.length).toBeGreaterThan(30);
        expect(/Example|Remove|Keep|Add|Pick|Say|Move|Cite|Give|Re-check|Use/.test(e.message), `${code}: ${e.message}`).toBe(true);
      }
    }
  });
  it("every code has a description", () => {
    for (const c of REL_ERROR_LIST) expect(REL_ERROR_CODES[c].length).toBeGreaterThan(20);
  });
});

describe("the R6 block: no ratings, review counts or ranks from the link-only platforms", () => {
  const hosts = ["https://www.alltrails.com/trail/x", "https://www.google.com/maps/place/x", "https://maps.google.ca/x", "https://www.tripadvisor.ca/Attraction", "https://www.komoot.com/highlight/1", "https://www.komoot.de/x"];
  for (const url of hosts) {
    it(`rejects ${new URL(url).hostname} as a source`, () => {
      const d = doc([rec()], { sources: [{ id: "src-0001", url, title: "t", publisher: "p", kind: "community", read: "2026-10-12" }] });
      expect(codes(run(d))).toEqual(["E_REL_LINK_ONLY_SRC"]);
    });
  }
  const texts = ["4.8 stars on AllTrails", "rated 4.5", "4.8/5 from hikers", "12,345 reviews", "#3 of 41 things to do", "ranked #2 in Banff", "9 out of 10 locals"];
  for (const t of texts) {
    it(`rejects "${t}" in a note`, () => {
      const d = doc([{ ...rec(), standing: rv("top", `fixture: ${t}`) }]);
      expect(codes(run(d))).toEqual(["E_REL_COPIED_RATING"]);
    });
  }
  it("rejects a rating in an editorial title, a designation name and an access note", () => {
    const d = doc([
      rec({ editorial: [{ publisher: "A Guide", title: "Top 10, 4.9 stars", year: 2025, list: "top_list" }], designations: [{ type: "national_park", name: "Park, 3,400 reviews", scope: "parent" }], access: [{ type: "timed_entry", note: "ranked #1 online" }] }),
    ]);
    const r = run(d);
    expect(codes(r)).toEqual(["E_REL_COPIED_RATING"]);
    expect(r.errors).toHaveLength(3);
  });
  it("leaves ordinary figures alone", () => {
    const d = doc([{ ...rec(), why: "Rockpile loop 0.7 km, a 10 minute walk.", standing: rv("top", "37 Wikipedia languages, 1.3 km one way") }]);
    expect(run(d).errors).toEqual([]);
  });
  it("has no field in the schema that could hold a rating, a count or a rank", () => {
    const fields = Object.keys((relevance.shape.records as unknown as { element?: { shape?: Record<string, unknown> } }).element?.shape ?? {});
    for (const f of fields) expect(/rating|review|rank|stars/.test(f), f).toBe(false);
  });
});

describe("pairs_with (3a.11)", () => {
  it("accepts a resolvable ref with a known source and rejects a self pair, a bad ref and an unknown source", () => {
    const base = rec({ ref: "place/lago-di-braies" });
    const withPair = (pw: unknown) => run(doc([{ ...base, pairs_with: [pw] } as never]));
    const scope = JSON.parse(readFileSync(join(ROOT, "data/suitability/scope.json"), "utf8")) as { places: string[] };
    const other = scope.places.find((p) => p !== "lago-di-braies")!;
    expect(codes(withPair({ ref: `place/${other}`, reason: "ten minutes on foot", src: "src-0001" }))).toEqual([]);
    expect(codes(withPair({ ref: "place/lago-di-braies", reason: "x" }))).toEqual(["E_REL_REF"]);
    expect(codes(withPair({ ref: "place/does-not-exist", reason: "x" }))).toEqual(["E_REL_REF"]);
    expect(codes(withPair({ ref: `place/${other}`, reason: "x", src: "src-9999" }))).toEqual(["E_REL_SRC"]);
  });
});

describe("derived fields are never typed", () => {
  for (const k of ["draw_suggested", "role", "fits", "badge", "substitutes", "similar_osm_25km", "far_pointer", "pair_with", "plan_b", "detour_min", "from_hubs", "flags"]) {
    it(`rejects ${k}`, () => {
      const d = doc([{ ...rec(), [k]: "x" } as never]);
      expect(codes(run(d))).toEqual(["E_REL_TYPED_DERIVED"]);
    });
  }
});

describe("household data", () => {
  it("rejects an origin key and household wording", () => {
    expect(codes(run(doc([{ ...rec(), home: { lat: 1, lon: 2 } } as never])))).toEqual(["E_REL_HOUSEHOLD"]);
    expect(codes(run(doc([{ ...rec(), why: "Near our home address." }])))).toEqual(["E_REL_HOUSEHOLD"]);
  });
});

describe("judged-field rules", () => {
  it("a draw note must name a signal", () => {
    expect(codes(run(doc([{ ...rec(), draw: rv("regional", "pretty") }])))).toEqual(["E_REL_DRAW_NOTE"]);
    expect(run(doc([{ ...rec(), draw: rv("regional", "NPS calls it a headline (official_highlight)") }])).errors).toEqual([]);
  });
  it("an own area designation is refused on every kind that is not itself an area", () => {
    const own = [{ type: "national_park" as const, name: "Banff National Park", scope: "own" as const }];
    for (const kind of ["trail", "lake", "sight", "canyon", "drive", "viewpoint", "waterfall", "town", "gorge"]) {
      expect(codes(run(doc([rec({ kind, designations: own })]))), kind).toEqual(["E_REL_INHERITED_DESIGNATION"]);
    }
    for (const type of ["unesco_whs", "provincial_or_state_park", "conservation_area", "dark_sky", "ramsar"] as const) {
      expect(codes(run(doc([rec({ kind: "lake", designations: [{ type, name: "x", scope: "own" }] })]))), type).toEqual(["E_REL_INHERITED_DESIGNATION"]);
    }
  });
  it("an area kind may own one, and any place may hold the same status as parent", () => {
    const own = [{ type: "national_park" as const, name: "Banff National Park", scope: "own" as const }];
    for (const kind of ["park", "region", "protected_area"]) expect(run(doc([rec({ kind, designations: own })])).errors, kind).toEqual([]);
    expect(run(doc([rec({ kind: "lake", designations: [{ ...own[0]!, scope: "parent" }] })])).errors).toEqual([]);
    expect(run(doc([rec({ kind: "lake", designations: [{ type: "natural_monument", name: "x", scope: "own" }, { type: "official_highlight", name: "y", scope: "own" }] })])).errors).toEqual([]);
  });
  it("a vague draw note fails; a note that names a signal passes", () => {
    for (const n of ["a nice guide says it is great", "pretty", "popular with visitors", "very official looking", "37 Wikipedia languages", "booking is easy"]) {
      expect(codes(run(doc([{ ...rec(), draw: rv("regional", n) }]))), n).toEqual(["E_REL_DRAW_NOTE"]);
    }
    for (const n of ["inside the Canadian Rocky Mountain Parks WHS (inherited)", "shuttle-only access still sells out", "the tourism board top-list names it", "NPS headline (official_highlight)", "needs a lottery permit"]) {
      expect(run(doc([{ ...rec(), draw: rv("regional", n) }])).errors, n).toEqual([]);
    }
  });
  it("rejects a link-only platform named as a publisher or a title, in sources and in editorial mentions", () => {
    const srcDoc = doc([rec()], { sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "Tripadvisor traveller ranking", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }] });
    expect(codes(run(srcDoc))).toEqual(["E_REL_LINK_ONLY_SRC"]);
    const pub = doc([rec({ editorial: [{ publisher: "AllTrails", title: "Best hikes", year: 2025, list: "listed" }] })]);
    expect(codes(run(pub))).toEqual(["E_REL_LINK_ONLY_SRC"]);
    const title = doc([rec({ editorial: [{ publisher: "A Guide", title: "Google Maps picks", year: 2025, list: "listed" }] })]);
    expect(codes(run(title))).toEqual(["E_REL_LINK_ONLY_SRC"]);
  });
  it("warns on a top_list with no reach", () => {
    const r = run(doc([rec({ editorial: [{ publisher: "G", title: "T", year: 2025, list: "top_list" }] })]));
    expect(r.warnings.map((w) => w.code)).toContain("W_REL_NO_REACH");
    const ok = run(doc([rec({ editorial: [{ publisher: "G", title: "T", year: 2025, list: "top_list", reach: "global" }] })]));
    expect(ok.warnings.map((w) => w.code)).not.toContain("W_REL_NO_REACH");
  });
  it("household prose: where they live, party size, children's ages", () => {
    for (const w of ["We live in Whitby, 40 min away.", "Day trip from our home town of Whitby.", "Good for a family of 4.", "kids aged 5 and 8", "our 6 year old loved it", "our 6-year-old loved it", "Our kids liked it.", "a party of 3 adults"]) {
      expect(codes(run(doc([{ ...rec(), why: w }]))), w).toEqual(["E_REL_HOUSEHOLD"]);
    }
    for (const k of ["party", "kids", "children", "ages"]) expect(codes(run(doc([{ ...rec(), [k]: [5, 8] } as never]))), k).toEqual(["E_REL_HOUSEHOLD"]);
    expect(run(doc([{ ...rec(), why: "Children under 8 need an adult; 1 adult per 2 children." }])).errors).toEqual([]);
  });
  it("a draw_peak must raise the tier", () => {
    expect(run(doc([rec({ draw: "regional", peak: { tier: "national", from: "09-20", to: "10-15", why: "colour" } })])).errors).toEqual([]);
  });
  it("at most three editorial mentions and a why of 120 characters", () => {
    const m = { publisher: "G", title: "T", year: 2025, list: "listed" as const };
    expect(codes(run(doc([rec({ editorial: [m, m, m, m] })])))).toEqual(["E_REL_SCHEMA"]);
    expect(codes(run(doc([{ ...rec(), why: "x".repeat(121) }])))).toEqual(["E_REL_SCHEMA"]);
  });
  it("a value without a source needs our_inference and a note", () => {
    const bad = { ...rec(), standing: { v: "top", state: "value", basis: "official_info", src: [] } };
    expect(codes(run(doc([bad as never])))).toEqual(["E_REL_SRC"]);
  });
  it("accepts the editorial basis", () => {
    const d = doc([rec({ editorial: [{ publisher: "G", title: "T", year: 2025, list: "top_list", reach: "national" }] })]);
    expect(run(d).errors).toEqual([]);
  });
});

describe("warnings", () => {
  it("W_REL_NO_QID when the QID is a gap", () => {
    const r = run(doc([rec({ qid: null })]));
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("W_REL_NO_QID");
  });
  it("W_REL_STALE after three years for judged fields, one for access cost", () => {
    const r = run(doc([rec({ access: [{ type: "timed_entry" }] })], { researched: "2022-01-01" }));
    const paths = r.warnings.filter((w) => w.code === "W_REL_STALE").map((w) => w.path);
    expect(paths).toContain("/records/0/draw");
    expect(paths).toContain("/records/0/access_cost");
    const fresh = run(doc([rec({ access: [{ type: "timed_entry" }] })], { researched: "2026-06-01" }));
    expect(fresh.warnings.filter((w) => w.code === "W_REL_STALE")).toEqual([]);
  });
  it("W_REL_DRAW_GAP uses the parent QID like derive does", () => {
    const root = mkdtempSync(join(tmpdir(), "rel-gap2-"));
    tmp.push(root);
    cpSync(ROOT, root, { recursive: true });
    mkdirSync(join(root, "data/relevance/signals"), { recursive: true });
    writeFileSync(join(root, "data/relevance/signals/wikidata.json"), JSON.stringify({ schema: "x", source: "x", items: { Q7: { read: "2026-10-01", sitelinks: { count: 7, langs: [] } }, Q8: { read: "2026-10-01", sitelinks: { count: 50, langs: [] } } } }));
    const d = [{ type: "official_highlight" as const, name: "NPS page", scope: "own" as const }, { type: "national_park" as const, name: "Zion", scope: "parent" as const, wikidata: "Q8" }];
    // 7 languages: regional; the highlight under a world parent: national. Local is 2 tiers below, regional is 1.
    const near = run(doc([rec({ qid: "Q7", draw: "regional", drawNote: "NPS headline (official_highlight)", designations: d })]), "2026-10-18", root);
    expect(near.warnings.map((w) => w.code)).not.toContain("W_REL_DRAW_GAP");
    const far = run(doc([rec({ qid: "Q7", draw: "local", drawNote: "NPS headline (official_highlight)", designations: d })]), "2026-10-18", root);
    expect(far.warnings.map((w) => w.code)).toContain("W_REL_DRAW_GAP");
    const noParent = run(doc([rec({ qid: "Q7", draw: "local", drawNote: "NPS headline (official_highlight)", designations: d.slice(0, 1) })]), "2026-10-18", root);
    expect(noParent.warnings.map((w) => w.code)).not.toContain("W_REL_DRAW_GAP"); // regional against local is 1 tier
  });
  it("W_REL_DRAW_GAP reads the cached signals and accepts an explaining note", () => {
    const root = mkdtempSync(join(tmpdir(), "rel-gap-"));
    tmp.push(root);
    cpSync(ROOT, root, { recursive: true });
    mkdirSync(join(root, "data/relevance/signals"), { recursive: true });
    writeFileSync(join(root, "data/relevance/signals/wikidata.json"), JSON.stringify({ schema: "x", source: "x", items: { Q999: { read: "2026-10-01", sitelinks: { count: 40, langs: [] } } } }));
    const gap = run(doc([rec({ qid: "Q999", draw: "local", drawNote: "the land manager has no page for it" })]), "2026-10-18", root);
    expect(gap.warnings.map((w) => w.code)).toContain("W_REL_DRAW_GAP");
    const ok = run(doc([rec({ qid: "Q999", draw: "local", drawNote: "the land manager has no page; the signals over-score a roadside stop" })]), "2026-10-18", root);
    expect(ok.warnings.map((w) => w.code)).not.toContain("W_REL_DRAW_GAP");
    const near = run(doc([rec({ qid: "Q999", draw: "national", drawNote: "official page lists it" })]), "2026-10-18", root);
    expect(near.warnings.map((w) => w.code)).not.toContain("W_REL_DRAW_GAP");
  });
});
