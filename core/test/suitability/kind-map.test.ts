// The S0b migration (applicability spec 7, M1-M10): every record gets a subkind from the reviewed kind-map, the Rockies
// "sights" that are lakes, falls and drives are reclassified, Lagazuoi is cut in two, and nothing is lost or invented.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as E from "../../src/schema/enums.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../../src/schema/suitability.ts";
import { DEFAULT_APPLICABILITY as APP, profileOf } from "../../src/suitability/applicability.ts";
import { kindMapProblems, loadKindMap } from "../../src/suitability/kindMap.ts";
import type { KindMap } from "../../src/suitability/kindMap.ts";
import { MIGRATION_DATE, migrate } from "../../src/suitability/migrate.ts";
import type { Migration } from "../../src/suitability/migrate.ts";
import { RefResolver, loadScope, missingCoverage } from "../../src/suitability/refs.ts";
import { validateDoc } from "../../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const ROCK = "legacy/canadian-rockies-sept-2029/";
let map: KindMap;
let m: Migration;
const all = (): SuitabilityRecord[] => [...m.docs.values()].flatMap((d) => d.records);
const find = (ref: string): SuitabilityRecord => {
  const r = all().find((x) => x.ref === ref);
  if (!r) throw new Error(`no record ${ref}`);
  return r;
};
const kindOf = (ref: string): string => `${find(ref).kind}/${find(ref).subkind}`;

beforeAll(() => {
  process.env.SUITABILITY_TODAY = MIGRATION_DATE;
  map = loadKindMap(REPO);
  m = migrate(REPO);
});

describe("kind-map.json", () => {
  it("is consistent with the vocabulary and the applicability file", () => {
    expect(kindMapProblems(map, APP)).toEqual([]);
  });
  it("holds one reviewed entry per record of the pre-S0b sidecars: 284, each with a reason", () => {
    expect(map.entries).toHaveLength(284);
    expect(new Set(map.entries.map((e) => e.ref)).size).toBe(284);
    for (const e of map.entries) expect(e.reason.length, e.ref).toBeGreaterThan(8);
  });
  it("its `from` is what the scope and the old rows said: in-scope kinds match scope.json", () => {
    const scope = loadScope(REPO)!;
    const kindOfRef = new Map(scope.items.map((i) => [i.ref, i.kind]));
    for (const e of map.entries) if (kindOfRef.has(e.ref)) expect(e.from.kind, e.ref).toBe(kindOfRef.get(e.ref));
  });
  it("is free of household wording", () => {
    const HOUSEHOLD = /\bparty\b|20 kg|our kids?|\b\d-year-old|\b\d year old|child of about|\b2029 party|Nitin/i;
    for (const e of [...map.entries, ...map.split]) expect(HOUSEHOLD.test(e.reason), e.ref).toBe(false);
    expect(HOUSEHOLD.test(map.note)).toBe(false);
  });
  it("a bad entry is reported", () => {
    const bad: KindMap = { ...map, entries: [{ ...map.entries[0]!, subkind: "teleport" }, { ...map.entries[1]!, kind: "lake", subkind: "hike" }, { ...map.entries[2]!, reason: "" }, map.entries[2]!], split: [] };
    const problems = kindMapProblems(bad, APP);
    expect(problems.some((p) => p.includes("teleport"))).toBe(true);
    expect(problems.some((p) => p.includes("maps to 0 profiles"))).toBe(true);
    expect(problems.some((p) => p.includes("no reason"))).toBe(true);
    expect(problems.some((p) => p.includes("appears twice"))).toBe(true);
  });
});

describe("counts are preserved", () => {
  it("284 records become 289: the five extras are the Lagazuoi tunnels and the four lake walks", () => {
    expect(all()).toHaveLength(289);
    const before = new Set(map.entries.map((e) => e.ref));
    const extra = all().filter((r) => !before.has(r.ref));
    expect(extra.map((r) => r.ref).sort()).toEqual([
      "part/place/lago-di-braies#walk", "part/place/lago-di-dobbiaco#walk", "part/place/lago-di-limides#walk", "part/place/lago-federa#walk",
      "part/place/lagazuoi-cable-car-and-tunnels#tunnels",
    ].sort());
    for (const ref of before) expect(all().some((r) => r.ref === ref), ref).toBe(true);
  });
  it("the 207 in-scope refs, their per-trip counts and the 77 off-plan rows are unchanged", () => {
    expect(m.reports.reduce((s, r) => s + r.inScope, 0)).toBe(207);
    expect(m.offPlan.reduce((s, o) => s + o.adventures + o.trails + o.sights, 0)).toBe(77);
    for (const trip of m.reports.map((r) => r.trip)) expect(missingCoverage(REPO, trip), trip).toEqual([]);
  });
  it("every record keeps one ref, once", () => {
    expect(new Set(all().map((r) => r.ref)).size).toBe(289);
  });
});

describe("every record has a subkind of the vocabulary and a profile", () => {
  it("none lacks a subkind, none is outside the closed list, every pair maps to a profile", () => {
    for (const r of all()) {
      expect(r.subkind, r.ref).toBeTruthy();
      expect(E.SUIT_SUBKIND as readonly string[], r.ref).toContain(r.subkind);
      expect(profileOf(r), r.ref).not.toBeNull();
    }
  });
  it("every migrated file validates with zero errors (no E_SUIT_SUBKIND, no E_SUIT_EXT_KIND, no E_SUIT_NA_EXEMPT)", () => {
    for (const [rel, d] of m.docs) {
      const r = validateDoc(d, "sidecar", REPO, { kind: "suitability" });
      expect(r.errors, `${rel}: ${JSON.stringify(r.errors.slice(0, 2))}`).toEqual([]);
    }
  });
  it("the committed migration files are what the migration writes; lane files may sit beside them and check clean", () => {
    for (const [rel, d] of m.docs) {
      const p = join(REPO, "data", "suitability", rel);
      expect(existsSync(p), rel).toBe(true);
      expect(JSON.parse(readFileSync(p, "utf8")), rel).toEqual(JSON.parse(JSON.stringify(d)));
    }
    const dirs = readdirSync(join(REPO, "data", "suitability"), { withFileTypes: true }).filter((e) => e.isDirectory());
    const files = dirs.flatMap((d) => readdirSync(join(REPO, "data", "suitability", d.name)).map((f) => `${d.name}/${f}`));
    const extra = files.filter((f) => !m.docs.has(f));
    for (const f of extra) expect(f, "only research lane files (R<n>*.json) may sit beside the migration output").toMatch(/^[^/]+\/R\d+[^/]*\.json$/);
    for (const f of extra) {
      const r = validateDoc(JSON.parse(readFileSync(join(REPO, "data", "suitability", f), "utf8")), "sidecar", REPO, { kind: "suitability" });
      expect(r.errors, `${f}: ${JSON.stringify(r.errors.slice(0, 2))}`).toEqual([]);
    }
    expect(files.filter((f) => m.docs.has(f)).sort()).toEqual([...m.docs.keys()].sort());
  });
  it("the refs of the new record resolve", () => {
    expect(new RefResolver(REPO).why("part/place/lagazuoi-cable-car-and-tunnels#tunnels")).toBeNull();
    expect(new RefResolver(REPO).why("part/place/no-such-place#x")).not.toBeNull();
    expect(new RefResolver(REPO).why("part/place/lagazuoi-cable-car-and-tunnels")).toContain("part/<parent ref>#<slug>");
    expect(new RefResolver(REPO).why("part/place/lagazuoi-cable-car-and-tunnels#")).toContain("slug is not empty");
    expect(new RefResolver(REPO).why("part/place/lagazuoi-cable-car-and-tunnels# ")).toContain("slug is not empty");
  });
});

describe("M1: subkinds assigned by rule", () => {
  const ruleTrails = () => map.entries.filter((e) => e.from.kind === "trail" && e.from.subkind === null && !e.by);
  it("trails become hike, or walk when the data is short and flat; towns town; the rest by name", () => {
    const by = (kind: string) => map.entries.filter((e) => e.from.kind === kind && e.from.subkind === null);
    expect(by("trail")).toHaveLength(104);
    for (const e of ruleTrails()) expect(["trail/hike", "trail/walk"]).toContain(`${e.kind}/${e.subkind}`);
    expect(by("town").filter((e) => e.subkind === "town")).toHaveLength(25); // Akureyri botanical garden is an attraction
  });
  it("a walk is a trail of at most 3 km and 100 m climb, and its reason says so", () => {
    const walks = ruleTrails().filter((e) => e.subkind === "walk");
    expect(walks.length).toBeGreaterThanOrEqual(10);
    for (const e of walks) {
      const d = find(e.ref).suitability.effort?.drivers;
      expect(d?.distance_km?.v, e.ref).toBeLessThanOrEqual(3);
      expect(d?.gain_m?.v, e.ref).toBeLessThanOrEqual(100);
      expect(e.reason, e.ref).toMatch(/at most 3 km and 100 m/);
    }
    for (const e of ruleTrails().filter((x) => x.subkind === "hike")) {
      const d = find(e.ref).suitability.effort?.drivers;
      const short = typeof d?.distance_km?.v === "number" && typeof d?.gain_m?.v === "number" && d.distance_km.v <= 3 && d.gain_m.v <= 100;
      expect(short, e.ref).toBe(false);
    }
  });
  it("a lane override is explicit: `by` names the lane, the reason opens with that lane and a date", () => {
    const overrides = map.entries.filter((e) => e.by);
    expect(overrides.length).toBeGreaterThan(0);
    for (const e of overrides) {
      expect(e.by, e.ref).toMatch(/^lane R\d+$/);
      expect(e.reason.startsWith(`${e.by!.slice(5)} (20`), e.ref).toBe(true);
      expect(e.reason.length, e.ref).toBeGreaterThan(40);
    }
  });
  it("every entry that is not a rule assignment carries the override: a rule-trail outside hike/walk, or a lane-written reason", () => {
    for (const e of map.entries) {
      const laneReason = /^R\d+ \(\d{4}-\d{2}-\d{2}\)/.test(e.reason);
      if (laneReason) expect(e.by, `${e.ref}: lane reason without \`by\``).toBeTruthy();
      if (e.from.kind === "trail" && e.from.subkind === null && !["trail/hike", "trail/walk"].includes(`${e.kind}/${e.subkind}`)) expect(e.by, `${e.ref}: reclassified trail without \`by\``).toBeTruthy();
      if (e.by) expect(laneReason, `${e.ref}: \`by\` without a lane reason`).toBe(true);
    }
  });
  it("a lane-override walk gives its distance in the reason, or says why the 3 km / 100 m rule does not apply", () => {
    const walks = map.entries.filter((e) => e.by && e.kind === "trail" && e.subkind === "walk");
    expect(walks.length).toBeGreaterThan(0);
    for (const e of walks) expect(e.reason, e.ref).toMatch(/\d+(\.\d+)? ?(km|mi\b|mile)|paved|flat|level|short made path/i);
  });
  it("241 records had no subkind; every one has one now, 5 had the invalid `other` and 1 the invalid `glacier`", () => {
    expect(map.entries.filter((e) => e.from.subkind === null)).toHaveLength(241);
    expect(map.entries.filter((e) => e.from.subkind === "other")).toHaveLength(5);
    expect(map.entries.filter((e) => e.from.subkind === "glacier")).toHaveLength(1);
    for (const e of map.entries) if (e.from.subkind !== null && e.from.subkind !== e.subkind) expect(e.reason.length, e.ref).toBeGreaterThan(8);
  });
  it("lifts, the Dolomites activities and Myvatn are assigned by name", () => {
    expect(kindOf("trip/chamonix-mont-blanc-2028/lift:aiguille du midi")).toBe("lift/cable_car");
    expect(kindOf("trip/chamonix-mont-blanc-2028/lift:montenvers train")).toBe("lift/rack_railway");
    expect(kindOf("place/lagazuoi-cable-car-and-tunnels")).toBe("lift/cable_car");
    expect(kindOf("place/funbob-monte-baranci")).toBe("activity/coaster");
    expect(kindOf("place/rafting-on-the-rienza")).toBe("activity/rafting");
    expect(kindOf("place/drava-cycle-path-to-lienz")).toBe("activity/cycling");
    expect(kindOf("trip/patagonia-2027/activity:minitrekking on the glacier")).toBe("activity/glacier-walk");
    expect(kindOf("trip/iceland-ring-road-2027/activity:myvatn nature baths")).toBe("activity/hot-springs");
  });
});

describe("M2: the Rockies sights that are not sights", () => {
  const sights = (): { ref: string; now: string }[] => map.entries.filter((e) => e.from.kind === "sight" && e.ref.startsWith(ROCK)).map((e) => ({ ref: e.ref, now: `${e.kind}/${e.subkind}` }));
  it("47 Rockies rows were sights; 37 are another kind now and 10 stay sights (4 parks, 2 areas, 4 attractions or landmarks)", () => {
    expect(sights()).toHaveLength(47);
    expect(sights().filter((s) => !s.now.startsWith("sight/"))).toHaveLength(37);
    expect(sights().filter((s) => s.now.startsWith("sight/"))).toHaveLength(10);
  });
  it("lakes, waterfalls and canyons, viewpoints, hot springs, drives, towns and the gondola", () => {
    expect(kindOf(`${ROCK}sights/moraine-lake`)).toBe("lake/lake");
    expect(kindOf(`${ROCK}sights/takakkaw-falls`)).toBe("waterfall/waterfall");
    expect(kindOf(`${ROCK}sights/johnston-canyon`)).toBe("waterfall/canyon");
    expect(kindOf(`${ROCK}sights/peyto-lake`)).toBe("viewpoint/viewpoint");
    expect(kindOf(`${ROCK}sights/miette-hot-springs`)).toBe("swim_spot/hot_spring");
    expect(kindOf(`${ROCK}sights/smith-dorrien-trail`)).toBe("drive/scenic_drive");
    expect(kindOf(`${ROCK}sights/icefields-parkway-drive`)).toBe("drive/scenic_drive");
    expect(kindOf(`${ROCK}sights/jasper-townsite`)).toBe("town/town");
    expect(kindOf(`${ROCK}sights/banff-gondola`)).toBe("lift/gondola");
    expect(kindOf("place/lake-louise")).toBe("lake/lake");
  });
  it("by name: 11 lakes (12 with Lake Louise; Magog and the Kananaskis lakes are areas), 10 waterfalls or canyons, 3 viewpoints, 3 hot springs, 5 drives, 2 towns, the gondola, a heli transfer and the Nordic Centre", () => {
    const n = (kind: string) => sights().filter((s) => s.now.startsWith(`${kind}/`)).length;
    expect([n("lake"), n("waterfall"), n("viewpoint"), n("swim_spot"), n("drive"), n("town"), n("lift"), n("activity"), n("sight")]).toEqual([11, 10, 3, 3, 5, 2, 1, 2, 10]);
  });
  it("the sight rows that stay are real sights", () => {
    for (const s of sights().filter((x) => x.now.startsWith("sight/"))) expect(["sight/attraction", "sight/historic_site", "sight/landmark", "sight/park", "sight/area"]).toContain(s.now);
  });
  it("every reclassified record carries its new kind", () => {
    for (const e of map.entries.filter((x) => x.from.kind !== x.kind)) expect(find(e.ref).kind, e.ref).toBe(e.kind);
  });
});

describe("M3 and M4: the five `other` adventures and the subkinds that change profile", () => {
  it("the five `other` adventures get real kinds", () => {
    expect(kindOf(`${ROCK}adventures/banff-springs-spa`)).toBe("activity/spa");
    expect(kindOf(`${ROCK}adventures/glacier-skywalk`)).toBe("sight/attraction");
    expect(kindOf(`${ROCK}adventures/golden-skybridge`)).toBe("sight/attraction");
    expect(kindOf(`${ROCK}adventures/jasper-dark-sky`)).toBe("sight/attraction");
    expect(kindOf(`${ROCK}adventures/red-rock-parkway`)).toBe("drive/scenic_drive");
    expect(all().filter((r) => r.subkind === "other")).toEqual([]);
  });
  it("the Ice Explorer is a vehicle tour, the Bow River a float, the shuttle a boat shuttle, the Nordic Centre mountain biking, the icewalk a glacier walk", () => {
    expect(kindOf(`${ROCK}adventures/columbia-icefield-ice-explorer`)).toBe("activity/vehicle-tour");
    expect(profileOf(find(`${ROCK}adventures/columbia-icefield-ice-explorer`))!.name).toBe("vehicle_tour");
    expect(kindOf(`${ROCK}adventures/bow-river-raft`)).toBe("activity/float");
    expect(profileOf(find(`${ROCK}adventures/bow-river-raft`))!.name).toBe("float");
    expect(kindOf(`${ROCK}adventures/crypt-lake-shuttle`)).toBe("activity/boat-shuttle");
    expect(kindOf(`${ROCK}adventures/canmore-nordic-centre`)).toBe("activity/mtb");
    expect(kindOf(`${ROCK}adventures/athabasca-icewalks`)).toBe("activity/glacier-walk");
    expect(kindOf(`${ROCK}adventures/heli-hiking`)).toBe("activity/heli-hike");
    expect(kindOf(`${ROCK}adventures/heli-flight-canmore`)).toBe("activity/heli");
  });
  it("the other rafts stay whitewater rafting", () => {
    for (const id of ["kananaskis-river-raft", "kicking-horse-class3-4", "kicking-horse-family-float"]) expect(kindOf(`${ROCK}adventures/${id}`), id).toBe("activity/rafting");
  });
  it("the Beagle Channel boat, recorded as a lake, is a boat tour", () => {
    expect(kindOf("trip/patagonia-2027/lake:beagle channel boat")).toBe("activity/boat-tour");
  });
  it("sights that are the same place as an adventure take the adventure's profile (M5)", () => {
    for (const [sight, adventure] of [["banff-gondola", "banff-gondola"], ["miette-hot-springs", "miette-hot-springs"], ["radium-hot-springs", "radium-hot-springs"], ["red-rock-parkway", "red-rock-parkway"], ["canmore-nordic-centre", "canmore-nordic-centre"]] as const) {
      expect(profileOf(find(`${ROCK}sights/${sight}`))!.name, sight).toBe(profileOf(find(`${ROCK}adventures/${adventure}`))!.name);
    }
  });
});

describe("reviewer fixes: unguided, drives, areas, lake walks", () => {
  it("the Sulphur Mountain switchback trail is an unguided trail", () => {
    expect(kindOf(`${ROCK}adventures/sulphur-mountain-trail`)).toBe("trail/hike");
    expect(profileOf(find(`${ROCK}adventures/sulphur-mountain-trail`))!.name).toBe("hike");
  });
  it("the covered bridge loop is a drive, the Akureyri botanical garden an attraction", () => {
    expect(kindOf("trip/vermont-fall-2026/sight:covered bridge loop")).toBe("drive/scenic_drive");
    expect(kindOf("trip/iceland-ring-road-2027/town:akureyri botanical garden")).toBe("sight/attraction");
  });
  it("the Dolomites range, the parks and the day-use lakes use the area profile", () => {
    for (const ref of ["place/dolomites", `${ROCK}sights/lake-magog`, `${ROCK}sights/kananaskis-lakes-day-use`, `${ROCK}sights/beauvais-lake-pp`, `${ROCK}sights/castle-provincial-park`, `${ROCK}sights/elk-lakes-park`, `${ROCK}sights/top-of-the-world-pp`, "trip/utah-five-parks/sight:goblin valley"]) {
      expect(profileOf(find(ref))!.name, ref).toBe("area");
    }
  });
  it("walk-shaped Dolomites records are trails; lakes that are also places keep a lake record and a walk record", () => {
    expect(kindOf("place/seceda-ridge")).toBe("trail/walk");
    expect(kindOf("place/cinque-torri")).toBe("trail/walk");
    expect(kindOf("place/cadini-di-misurina-viewpoint")).toBe("trail/walk");
    expect(kindOf("place/lago-di-landro")).toBe("lake/lake"); // no walk data
    for (const [slug, sub, km] of [["lago-di-braies", "walk", 3.7], ["lago-di-dobbiaco", "walk", 3.5], ["lago-di-limides", "walk", 2], ["lago-federa", "hike", 7.9]] as const) {
      expect(kindOf(`place/${slug}`), slug).toBe("lake/lake");
      expect(find(`place/${slug}`).suitability.effort).toBeUndefined();
      expect(kindOf(`part/place/${slug}#walk`), slug).toBe(`trail/${sub}`);
      expect(find(`part/place/${slug}#walk`).suitability.effort?.drivers?.distance_km?.v, slug).toBe(km);
    }
    expect(find("place/lago-di-braies").suitability.kid_note).toMatch(/pushchairs/); // a surface note stays with the lake
  });
  it("the four W_SUIT_NA_FIELD warnings of the first cut are gone", () => {
    for (const [rel, d] of m.docs) {
      const r = validateDoc(d, "sidecar", REPO, { kind: "suitability" });
      expect(r.warnings.filter((w) => w.code === "W_SUIT_NA_FIELD"), rel).toEqual([]);
    }
  });
});

describe("M6: Lagazuoi is a lift and a walk", () => {
  const lift = (): SuitabilityRecord => find("place/lagazuoi-cable-car-and-tunnels");
  const walk = (): SuitabilityRecord => find("part/place/lagazuoi-cable-car-and-tunnels#tunnels");
  it("the cable car is a lift with no walk fields; the tunnels are a walk record that holds them", () => {
    expect(lift()).toMatchObject({ kind: "lift", subkind: "cable_car" });
    expect(walk()).toMatchObject({ kind: "trail", subkind: "walk" });
    expect(lift().suitability).toEqual({});
    expect(lift().hints).toBeUndefined();
    expect(walk().suitability.effort?.drivers?.distance_km?.v).toBe(3);
    expect(walk().suitability.effort?.drivers?.loss_m?.v).toBe(647);
    expect(walk().suitability.adult_time_min?.v).toEqual([90, 90]);
    expect(walk().suitability.age_band?.v).toEqual({ from: 10, to: null });
    expect(walk().hints?.map((h) => h.field)).toEqual(["source_grade", "exposure"]);
  });
  it("neither record has a field its profile marks N: no migration warning is left on them", () => {
    for (const rec of [lift(), walk()]) {
      const d: SuitabilityDoc = { ...m.docs.get("dolomites-2027/migrated.json")!, records: [rec] };
      const r = validateDoc(d, "sidecar", REPO, { kind: "suitability" });
      expect(r.warnings.map((w) => w.code), rec.ref).not.toContain("W_SUIT_NA_FIELD");
    }
  });
  it("the recommended age is still counted once (4 Dolomites ages from PLAN.md)", () => {
    expect(m.reports.find((r) => r.trip === "dolomites-2027")!.ageBandFromPlan).toBe(4);
  });
});

describe("no value is lost, none invented", () => {
  const leaves = (docs: SuitabilityDoc[]) => {
    let vals = 0, conflicts = 0, hints = 0;
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        if ("state" in o && "src" in o && "v" in o) {
          vals++;
          if (Array.isArray(o.conflicts)) conflicts += o.conflicts.length;
        }
        for (const [k, y] of Object.entries(o)) if (k !== "flat") walk(y);
      }
    };
    for (const d of docs) for (const r of d.records) {
      walk(r.suitability);
      walk(r.ext);
      hints += (r.hints ?? []).length;
    }
    return { vals, conflicts, hints };
  };
  it("the migrated values, conflicts and hints equal the counts before S0b: 340, 19 and 248", () => {
    expect(leaves([...m.docs.values()])).toEqual({ vals: 340, conflicts: 19, hints: 248 });
  });
  it("every migrated value is still our_inference with a source in this repo", () => {
    for (const r of all()) {
      const json = JSON.stringify(r.suitability);
      for (const hit of json.matchAll(/"state":"value","basis":"([a-z_]+)"/g)) expect(hit[1], r.ref).toBe("our_inference");
    }
  });
  it("a limit is still never a chosen value, and the mask changes nothing in the stored block", () => {
    for (const r of all()) for (const f of ["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "adult_required", "group_min", "solo"] as const) {
      const x = r.suitability[f];
      if (x) expect(x.state, `${r.ref} ${f}`).not.toBe("value");
    }
  });
  it("no sidecar carries household wording or a calendar date because of the new fields", () => {
    const HOUSEHOLD = /\bparty\b|20 kg|our kids?|\b\d-year-old|\b\d year old|child of about|\b2029 party/i;
    for (const r of all()) {
      const strings: string[] = [];
      const walk = (x: unknown): void => {
        if (typeof x === "string") strings.push(x);
        else if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === "object") Object.values(x).forEach(walk);
      };
      walk(r.suitability);
      walk(r.hints);
      for (const s of strings.filter((t) => !/prototype\.json|locations\.json|trails\.json|adventures\.json|PLAN\.md|conf |src /.test(t))) expect(HOUSEHOLD.test(s), `${r.ref}: ${s}`).toBe(false);
    }
  });
});

describe("M7: suit_level in the flat copy", () => {
  it("every record has it, and every migrated record is draft (nothing was researched)", () => {
    for (const r of all()) expect(r.flat!.suit_level, r.ref).toBe("draft");
  });
  it("the migration is deterministic", () => {
    expect(JSON.stringify([...migrate(REPO).docs])).toBe(JSON.stringify([...m.docs]));
  });
});
