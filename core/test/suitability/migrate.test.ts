import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { EXPECTED_IN_SCOPE, EXPECTED_SIGNAL, MIGRATION_DATE, assertSpecCounts, migrate, parseMinutes } from "../../src/suitability/migrate.ts";
import type { Migration } from "../../src/suitability/migrate.ts";
import { loadScope } from "../../src/suitability/refs.ts";
import { RefResolver } from "../../src/suitability/refs.ts";
import { validateDoc } from "../../src/validate/index.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../../src/schema/suitability.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
let m: Migration;
const all = (): SuitabilityRecord[] => [...m.docs.values()].flatMap((d) => d.records);
const find = (ref: string): SuitabilityRecord => {
  const r = all().find((x) => x.ref === ref);
  if (!r) throw new Error(`no record ${ref}`);
  return r;
};
const doc = (rel: string): SuitabilityDoc => m.docs.get(rel)!;

beforeAll(() => {
  process.env.SUITABILITY_TODAY = MIGRATION_DATE;
  m = migrate(REPO);
});

describe("counts of spec 7.1", () => {
  it("finds 207 in-scope refs, all resolved, in 8 files", () => {
    expect(m.reports.reduce((s, r) => s + r.inScope, 0)).toBe(EXPECTED_IN_SCOPE);
    expect(m.reports.every((r) => r.resolved === r.inScope)).toBe(true);
    expect([...m.docs.keys()].filter((k) => k.endsWith("/migrated.json"))).toHaveLength(8);
    const scope = loadScope(REPO)!;
    const resolver = new RefResolver(REPO, scope);
    for (const it of scope.items) expect(resolver.why(it.ref), it.ref).toBeNull();
  });

  it("prints any-signal counts of 19, 76, 0, 0, 0, 0, 0, 0 (spec order)", () => {
    const by = Object.fromEntries(m.reports.map((r) => [r.trip, r.anySignal]));
    expect([by["dolomites-2027"], by["canadian-rockies-2029"], by["iceland-ring-road-2027"], by["utah-five-parks"], by["patagonia-2027"], by["chamonix-mont-blanc-2028"], by["algonquin-muskoka-2026"], by["vermont-fall-2026"]]).toEqual([19, 76, 0, 0, 0, 0, 0, 0]);
    expect(by).toEqual(EXPECTED_SIGNAL);
    expect(() => assertSpecCounts(m)).not.toThrow();
  });

  it("fails loudly when a count is off", () => {
    const bad: Migration = { ...m, reports: m.reports.map((r) => (r.trip === "dolomites-2027" ? { ...r, anySignal: 20 } : r)) };
    expect(() => assertSpecCounts(bad)).toThrow(/dolomites-2027: any signal 20, spec says 19/);
    const short: Migration = { ...m, reports: m.reports.map((r) => (r.trip === "utah-five-parks" ? { ...r, resolved: 20 } : r)) };
    expect(() => assertSpecCounts(short)).toThrow(/utah-five-parks: 20 of 21/);
  });

  it("every record has one ref, once, across the trip's files", () => {
    const seen = new Set<string>();
    for (const r of all()) {
      expect(seen.has(r.ref), r.ref).toBe(false);
      seen.add(r.ref);
    }
  });
});

describe("the migrated files validate", () => {
  it("every file has zero errors, with the refs resolving against the repository", () => {
    for (const [rel, d] of m.docs) {
      const r = validateDoc(d, "sidecar", REPO, { kind: "suitability" });
      expect(r.errors, `${rel}: ${JSON.stringify(r.errors.slice(0, 2))}`).toEqual([]);
      // every migrated record is draft (nothing was researched) and a few carry a migrated figure on a kind that does not ask for it
      const other = r.warnings.filter((w) => !["W_SUIT_CONFLICT", "W_SUIT_BELOW_USABLE", "W_SUIT_NA_FIELD"].includes(w.code));
      expect(other, rel).toEqual([]);
    }
  });
});

describe("nothing is invented", () => {
  it("no migrated limit is a chosen value: none rests on a rule, none is typed as a value", () => {
    const limits = ["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "adult_required", "group_min"] as const;
    for (const r of all()) for (const f of limits) {
      const x = r.suitability[f];
      if (x) expect(x.state, `${r.ref} ${f}`).not.toBe("value");
    }
  });
  it("every migrated value is our_inference and cites a file of this repo", () => {
    const walk = (x: unknown, ids: Set<string>, where: string): void => {
      if (Array.isArray(x)) return x.forEach((y, i) => walk(y, ids, `${where}/${i}`));
      if (!x || typeof x !== "object") return;
      const o = x as Record<string, unknown>;
      if ("state" in o && "src" in o && o.state === "value") {
        expect(o.basis, where).toBe("our_inference");
        expect((o.src as string[]).length, where).toBeGreaterThan(0);
        for (const id of o.src as string[]) expect(ids.has(id), where).toBe(true);
      }
      for (const [k, y] of Object.entries(o)) walk(y, ids, `${where}/${k}`);
    };
    for (const [rel, d] of m.docs) {
      const ids = new Set(d.sources.filter((s) => s.kind === "computed" && s.publisher === "this repo").map((s) => s.id));
      expect(ids.size, rel).toBe(d.sources.length);
      walk(d.records, ids, rel);
    }
  });
  it("no migrated record has a source_grade value, a stroller, a wheelchair value or a carrier value", () => {
    for (const r of all()) {
      expect(r.suitability.effort?.source_grade?.state ?? "gap", r.ref).toBe("gap");
      for (const f of ["stroller", "wheelchair", "carrier_ok", "exposure", "access_season"] as const) expect(r.suitability[f], `${r.ref} ${f}`).toBeUndefined();
    }
  });
  it("records without a signal are empty blocks with a computed flat copy", () => {
    const r = find("trip/vermont-fall-2026/trail:" + doc("vermont-fall-2026/migrated.json").records.find((x) => x.kind === "trail")!.ref.split(":")[1]);
    expect(r.suitability).toEqual({});
    expect(r.flat).toMatchObject({ min_age: null, house_grade: null, kid_fit: "unknown", accessibility: "unknown" });
  });
});

describe("the fixes of spec 7.2", () => {
  const offplan = "canadian-rockies-2029/migrated-offplan.json";
  it("Kicking Horse family float: the 50 lb minimum is a minimum weight, never a maximum", () => {
    const r = find("legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float");
    expect(r.suitability.max_weight_kg).toBeUndefined();
    const mw = r.suitability.min_weight_kg!;
    expect(mw.state).toBe("gap");
    expect(mw.conflicts).toHaveLength(1);
    expect(mw.conflicts![0]).toMatchObject({ v: 22.7, basis: "our_inference" });
    expect(mw.conflicts![0]!.note).toMatch(/booking field/);
    expect(mw.conflicts![0]!.note).toMatch(/MINIMUM/);
    expect(r.flat!.min_weight_kg).toBeNull(); // not a value until R2b re-reads the operator
    expect(doc(offplan).records.some((x) => x.ref === r.ref)).toBe(true);
  });
  it("Kananaskis raft: the 18.1 kg figure is kept as a conflict between a maximum and a minimum", () => {
    const r = find("legacy/canadian-rockies-sept-2029/adventures/kananaskis-river-raft");
    expect(r.suitability.max_weight_kg!.conflicts![0]!.v).toBe(18.1);
    expect(r.suitability.min_weight_kg!.conflicts![0]!.v).toBe(18.1);
    expect(r.suitability.min_weight_kg!.conflicts![0]!.note).toMatch(/minimum/);
    expect(r.suitability.max_weight_kg!.state).toBe("gap");
    expect(r.flat).toMatchObject({ min_weight_kg: null, max_weight_kg: null });
  });
  it("horse rides: the weight limits are policy", () => {
    for (const [id, kg] of [["banff-horse-ride", 104], ["lake-louise-horse", 113]] as const) {
      const r = find(`legacy/canadian-rockies-sept-2029/adventures/${id}`);
      expect(r.suitability.limit_reason).toBe("policy");
      expect(r.suitability.max_weight_kg!.conflicts![0]!.v).toBe(kg);
    }
  });
  it("the four Dolomites ages marked operator but sourced from PLAN.md are recommended ages, not minimums", () => {
    for (const [ref, age] of [["place/lago-di-sorapis", 10], ["part/place/lagazuoi-cable-car-and-tunnels#tunnels", 10], ["place/cinque-torri", 10], ["place/tre-cime-di-lavaredo-loop", 6]] as const) {
      const slug = ref;
      const r = find(ref);
      expect(r.suitability.age_band, slug).toMatchObject({ v: { from: age, to: null }, state: "value", basis: "our_inference" });
      expect(r.suitability.age_band!.note).toMatch(/PLAN\.md is not an operator/);
      expect(r.suitability.min_age, slug).toBeUndefined();
      expect(r.flat!.min_age).toBeNull();
    }
    expect(m.reports.find((r) => r.trip === "dolomites-2027")!.ageBandFromPlan).toBe(4);
  });
  it("place-level minimum ages with no source are conflicts, not rules", () => {
    for (const slug of ["funbob-monte-baranci", "rafting-on-the-rienza"]) {
      const r = find(`place/${slug}`);
      expect(r.suitability.min_age!.state).toBe("gap");
      expect(r.suitability.min_age!.conflicts![0]!.basis).toBe("our_inference");
      expect(r.flat!.min_age).toBeNull();
    }
  });
  it("Rockies easy / moderate / hard is our label: a hint, and source_grade stays a gap", () => {
    const r = find("legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass");
    expect(r.suitability.effort!.source_grade).toMatchObject({ state: "gap", v: null });
    const h = r.hints!.find((x) => x.field === "source_grade")!;
    expect(h.text).toMatch(/our label "hard" is not Parks Canada's grade/);
    expect(r.suitability.effort!.drivers!.distance_km).toMatchObject({ v: 11.2, basis: "our_inference" });
    expect(r.flat).toMatchObject({ walk_km: 11.2, walk_gain_m: 750, house_grade: 3 }); // Larch Valley: band 3 from effort_km 18.7
  });
  it("child_6yo_ok is a hint for the research lane, not a fact", () => {
    const r = find("legacy/canadian-rockies-sept-2029/adventures/norquay-via-ferrata");
    expect(r.suitability.age_band).toBeUndefined();
    expect(r.hints!.some((h) => /child_6yo_ok is "no"/.test(h.text))).toBe(true);
    expect(r.hints!.some((h) => /adult_only/.test(h.text))).toBe(true);
  });
  it("audience on a trail becomes an age_band hint with the plan named", () => {
    const r = find("legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass");
    expect(r.suitability.age_band).toBeUndefined();
    expect(r.hints!.find((h) => h.field === "age_band")!.text).toMatch(/plan's tracks mark this adult_only/);
  });
  it("pushchair sentences are copied verbatim and the stroller stays unset", () => {
    expect(find("place/lago-di-braies").suitability.kid_note).toBe("Not suitable for pushchairs (steps on the east side)");
    expect(find("place/val-fiscalina").suitability.kid_note).toBe("Winter walks with a buggy are listed, so a pushchair works on this track");
    expect(find("place/val-fiscalina").suitability.stroller).toBeUndefined();
  });
  it("a distance that sources disagree on is not chosen", () => {
    const r = find("place/seceda-ridge");
    expect(r.suitability.effort!.drivers!.distance_km).toBeUndefined();
    expect(r.hints!.find((h) => h.field === "distance_km")!.text).toMatch(/sources disagree/);
  });
});

describe("what the sidecars hold for the data lanes", () => {
  it("R lanes start from sidecars that hold only migrated files (no lane file exists yet)", () => {
    const lanes = [...m.docs.values()].map((d) => d.lane);
    expect(new Set(lanes)).toEqual(new Set(["S0-migrated", "S0-migrated-offplan"]));
  });
  it("the committed migrated files have the shape migrate produces, trip by trip", () => {
    for (const [rel, d] of m.docs) {
      const onDisk = JSON.parse(readFileSync(join(REPO, "data/suitability", rel), "utf8")) as SuitabilityDoc;
      expect(onDisk.records.map((r) => r.ref), rel).toEqual(d.records.map((r) => r.ref));
      expect(onDisk.trip).toBe(d.trip);
    }
  });
});

describe("parseMinutes", () => {
  it.each([
    ["5-6 h", [300, 360]], ["1 h", [60, 60]], ["2.5-4 h", [150, 240]], ["3-4 h return", [180, 240]], ["4h28", [268, 268]], ["about 2 h 50", [170, 170]],
    ["30-40 min", [30, 40]], ["20 min from Magog", [20, 20]], ["20-30 min each way", [20, 30]], ["50 min up", [50, 50]], ["1-1.5", [60, 90]], ["3.25", [195, 195]], ["4.5-6", [270, 360]],
    ["3.5-4", [210, 240]], ["1.5 h", [90, 90]],
  ])("%s -> %j", (raw, want) => {
    expect(parseMinutes(raw)).toEqual(want);
  });
  it.each(["2 days", "overnight", "GAP", "1.5-2 days one way", "", "sunrise"])("%s is not a time range", (raw) => {
    expect(parseMinutes(raw)).toBeNull();
  });
});

describe("no household wording and no calendar dates in the sidecars", () => {
  const HOUSEHOLD = /\bparty\b|20 kg|our kids?|\b\d-year-old|\b\d year old|child of about|\b2029 party/i;
  const DATE = /\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b|\b(effective|reopened) [A-Z][a-z]+ \d|\b\d{4}-\d{2}-\d{2}\b/;
  /** every string of a doc outside the provenance fields (read, on, researched, source rows) */
  const strings = (x: unknown, key = "", out: string[] = []): string[] => {
    if (typeof x === "string") { if (!["read", "on", "researched", "checked"].includes(key)) out.push(x); }
    else if (Array.isArray(x)) x.forEach((y) => strings(y, key, out));
    else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) if (k !== "sources") strings(y, k, out);
    return out;
  };
  it("holds in every migrated file", () => {
    for (const [rel, d] of m.docs) {
      for (const t of strings(d.records)) {
        // notes quote "status X, checked <date>" provenance; the checked date of a source row is allowed
        const stripped = t.replace(/(checked|read) (\d{1,2} )?[A-Za-z]{0,9} ?\d{4}(-\d{2}-\d{2})?/g, "$1");
        expect(HOUSEHOLD.test(stripped), `${rel}: ${stripped}`).toBe(false);
        expect(DATE.test(stripped), `${rel}: ${stripped}`).toBe(false);
      }
    }
  });
  it("the notes cite the row's booking field and no unpublished research file", () => {
    expect(JSON.stringify([...m.docs.values()])).not.toMatch(/adventure\.md/);
    expect(find("legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float").suitability.min_weight_kg!.conflicts![0]!.note).toMatch(/booking field/);
  });
});
