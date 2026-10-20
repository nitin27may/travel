// Backlog 3a.11: attribute-aware substitutes and pair_with ("Nearby, worth adding"), relevance.md 3.2.
// Coordinates are real to a few hundred metres; the records are fixtures that check the code, not data.
import { describe, expect, it } from "vitest";
import { deriveAll } from "../../src/relevance/derive.ts";
import type { PlaceFacts } from "../../src/relevance/derive.ts";
import { relRecord } from "../../src/schema/relevance.ts";
import { rec } from "./helpers.ts";

const LOUISE = { lat: 51.4217, lon: -116.2177 };
const FAIRVIEW = { lat: 51.4153, lon: -116.2193 }; // about 0.7 km
const AGNES = { lat: 51.4395, lon: -116.2301 }; // about 2.3 km
const MORAINE = { lat: 51.3217, lon: -116.186 }; // about 11 km
const PEYTO = { lat: 51.7286, lon: -116.5144 }; // about 45 km

const louise = rec({ ref: "place/lake-louise", class_key: "lake/glacial-turquoise", draw: "world", standing: "top" });
const fairview = rec({ ref: "place/fairview-lookout", kind: "viewpoint", class_key: "viewpoint/short-walk", draw: "local", standing: "good" });
const agnes = rec({ ref: "place/lake-agnes", kind: "trail", class_key: "trail/teahouse", draw: "regional", standing: "top" });
const moraine = rec({ ref: "place/moraine-lake", class_key: "lake/glacial-turquoise", draw: "world", standing: "top" });
const peyto = rec({ ref: "place/peyto-lake", class_key: "lake/glacial-turquoise", draw: "national", standing: "top" });
const ordinary = rec({ ref: "place/car-park-view", kind: "viewpoint", class_key: "viewpoint/short-walk", draw: "local", standing: "ordinary" });

const run = (records: ReturnType<typeof rec>[], facts: Record<string, PlaceFacts>, extra: object = {}) =>
  Object.fromEntries(deriveAll({ records, facts, signals: {}, towns: [], ...extra }).map((d) => [d.ref, d]));

describe("pair_with", () => {
  const facts: Record<string, PlaceFacts> = {
    "place/lake-louise": { point: LOUISE, onSiteMin: 90 },
    "place/fairview-lookout": { point: FAIRVIEW },
    "place/lake-agnes": { point: AGNES, onSiteMin: 240 },
    "place/moraine-lake": { point: MORAINE, onSiteMin: 90 },
    "place/peyto-lake": { point: PEYTO, onSiteMin: 30 },
    "place/car-park-view": { point: FAIRVIEW },
  };

  it("Lake Louise pairs with the short lookout, walking, with an estimated on-site time", () => {
    const d = run([louise, fairview, agnes, moraine, peyto], facts)["place/lake-louise"]!;
    expect(d.pair_with.map((p) => p.ref)).toEqual(["place/fairview-lookout"]);
    const p = d.pair_with[0]!;
    expect(p.how).toBe("walk");
    expect(p.on_site_estimated).toBe(true);
    expect(Math.abs(p.extra_min! - (Math.round(p.km! * 30) + 20))).toBeLessThanOrEqual(1);
  });

  it("a substitute (same class) never pairs, even next door", () => {
    const d = run([louise, moraine], { ...facts, "place/moraine-lake": { point: { lat: 51.4222, lon: -116.2181 }, onSiteMin: 60 } })["place/lake-louise"]!;
    expect(d.pair_with).toEqual([]);
    expect(d.substitutes.near.map((s) => s.ref)).toEqual(["place/moraine-lake"]);
  });

  it("drops a long walk (over 2 h on site) unless it is hand-picked, which also ranks first", () => {
    const auto = run([louise, fairview, agnes], facts)["place/lake-louise"]!;
    expect(auto.pair_with.map((p) => p.ref)).not.toContain("place/lake-agnes");
    const hand = { ...louise, pairs_with: [{ ref: "place/lake-agnes", reason: "the teahouse walk starts at the lake" }] };
    const d = run([hand, fairview, agnes], facts)["place/lake-louise"]!;
    expect(d.pair_with.map((p) => p.ref)).toEqual(["place/lake-agnes", "place/fairview-lookout"]);
    expect(d.pair_with[0]).toMatchObject({ hand_picked: true, reason: "the teahouse walk starts at the lake", on_site_estimated: false });
  });

  it("needs standing top or good", () => {
    const d = run([louise, ordinary], facts)["place/lake-louise"]!;
    expect(d.pair_with).toEqual([]);
  });

  it("the effort gate: a stop above the party's ceiling is left out", () => {
    const f = { ...facts, "place/fairview-lookout": { point: FAIRVIEW, familyEffort: 4 } };
    expect(run([louise, fairview], f)["place/lake-louise"]!.pair_with).toHaveLength(1);
    expect(run([louise, fairview], f, { profile: { maxFamilyEffort: 2 } })["place/lake-louise"]!.pair_with).toEqual([]);
  });

  it("keeps at most 3, ordered by extra time, then standing, then distance", () => {
    const mk = (n: number, standing: "top" | "good") => rec({ ref: `place/stop-${n}`, kind: "viewpoint", class_key: `viewpoint/v${n}`, draw: "local", standing });
    const recs = [louise, mk(1, "good"), mk(2, "top"), mk(3, "good"), mk(4, "good")];
    const f: Record<string, PlaceFacts> = { "place/lake-louise": { point: LOUISE } };
    [1, 2, 3, 4].forEach((n) => (f[`place/stop-${n}`] = { point: { lat: LOUISE.lat + 0.001 * n, lon: LOUISE.lon }, onSiteMin: 30 }));
    const d = run(recs, f)["place/lake-louise"]!;
    expect(d.pair_with.map((p) => p.ref)).toEqual(["place/stop-1", "place/stop-2", "place/stop-3"]);
  });
});

describe("attribute-aware substitutes", () => {
  const f = (over: Record<string, PlaceFacts>): Record<string, PlaceFacts> => ({
    "place/lake-louise": { point: LOUISE, onSiteMin: 90, familyEffort: 2 },
    "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 2 },
    ...over,
  });
  const subs = (over: Record<string, PlaceFacts>, extra: object = {}) => run([louise, moraine], f(over), extra)["place/lake-louise"]!.substitutes.area.map((s) => s.ref);

  it("keeps a like-for-like same-class place", () => {
    expect(subs({})).toEqual(["place/moraine-lake"]);
  });
  it("drops a place whose family effort is two levels apart", () => {
    expect(subs({ "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 4 } })).toEqual([]);
    expect(subs({ "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 3 } })).toEqual(["place/moraine-lake"]);
  });
  it("drops a place whose on-site time is outside 0.5x to 2x", () => {
    expect(subs({ "place/moraine-lake": { point: MORAINE, onSiteMin: 200, familyEffort: 2 } })).toEqual([]);
    expect(subs({ "place/moraine-lake": { point: MORAINE, onSiteMin: 40, familyEffort: 2 } })).toEqual([]);
    expect(subs({ "place/moraine-lake": { point: MORAINE, onSiteMin: 180, familyEffort: 2 } })).toEqual(["place/moraine-lake"]);
  });
  it("needs a shared feature tag when both places have tags", () => {
    const base = { "place/lake-louise": { point: LOUISE, onSiteMin: 90, familyEffort: 2, tags: ["canoe"] } };
    expect(subs({ ...base, "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 2, tags: ["swim"] } })).toEqual([]);
    expect(subs({ ...base, "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 2, tags: ["canoe", "swim"] } })).toEqual(["place/moraine-lake"]);
  });
  it("sorts substitutes that fit the party first", () => {
    const mid = rec({ ref: "place/mid-lake", class_key: "lake/glacial-turquoise", draw: "world", standing: "top" });
    const r = run([louise, moraine, mid], f({ "place/mid-lake": { point: { lat: 51.4, lon: -116.2 }, onSiteMin: 90, familyEffort: 3 }, "place/moraine-lake": { point: MORAINE, onSiteMin: 90, familyEffort: 2 } }), { profile: { maxFamilyEffort: 2 } })["place/lake-louise"]!;
    expect(r.substitutes.area.map((s) => s.ref)).toEqual(["place/moraine-lake", "place/mid-lake"]);
  });
});

describe("pairs_with in the schema", () => {
  it("accepts a reasoned pair and rejects an empty reason", () => {
    expect(relRecord.safeParse({ ...louise, pairs_with: [{ ref: "place/x", reason: "short walk" }] }).success).toBe(true);
    expect(relRecord.safeParse({ ...louise, pairs_with: [{ ref: "place/x", reason: "" }] }).success).toBe(false);
  });
});

describe("pair_with is tight (RVC round 2)", () => {
  const north = (km: number) => ({ lat: LOUISE.lat + km / 111.19, lon: LOUISE.lon });
  const lookout = (ref = "place/a-lookout") => rec({ ref, kind: "viewpoint", class_key: "viewpoint/short-walk", draw: "local", standing: "good" });
  const f = (km: number, over: PlaceFacts = {}): Record<string, PlaceFacts> => ({ "place/lake-louise": { point: LOUISE, onSiteMin: 90 }, "place/a-lookout": { point: north(km), onSiteMin: 20, ...over } });

  it("walks only within 1.5 km of the place's own point", () => {
    expect(run([louise, lookout()], f(1.4))["place/lake-louise"]!.pair_with.map((p) => p.ref)).toEqual(["place/a-lookout"]);
    expect(run([louise, lookout()], f(1.6))["place/lake-louise"]!.pair_with).toEqual([]);
  });
  it("a 7 km straight-line neighbour is pending, not paired, until a real drive time exists", () => {
    const d = run([louise, lookout()], f(7))["place/lake-louise"]!;
    expect(d.pair_with).toEqual([]);
    expect(d.pair_pending.map((p) => p.ref)).toEqual(["place/a-lookout"]);
    const withTime = (min: number) => run([louise, lookout()], f(7), { driveMin: { "place/lake-louise": { "place/a-lookout": min } } })["place/lake-louise"]!;
    expect(withTime(12).pair_with[0]).toMatchObject({ ref: "place/a-lookout", how: "drive", extra_min: 24 + 20 });
    expect(withTime(30).pair_with).toEqual([]);
  });
  it("two records at one point (within 100 m) or a trailhead alias are part_of, never a pair", () => {
    const same = run([louise, lookout()], f(0.05))["place/lake-louise"]!;
    expect(same.pair_with).toEqual([]);
    expect(same.part_of).toEqual(["place/a-lookout"]);
    const alias = run([louise, lookout()], f(1, { aliasOf: "place/lake-louise" }))["place/lake-louise"]!;
    expect(alias.pair_with).toEqual([]);
    expect(alias.part_of).toEqual(["place/a-lookout"]);
  });
  it("a pair must be lighter: no more on site than the place, or at most 90 minutes", () => {
    const heavy = rec({ ref: "place/a-lookout", kind: "sight", class_key: "sight/museum", draw: "local", standing: "top" });
    expect(run([louise, heavy], f(1, { onSiteMin: 100 }))["place/lake-louise"]!.pair_with).toEqual([]);
    expect(run([louise, heavy], f(1, { onSiteMin: 90 }))["place/lake-louise"]!.pair_with).toHaveLength(1);
    const small = { ...f(1, { onSiteMin: 100 }), "place/lake-louise": { point: LOUISE, onSiteMin: 240 } };
    expect(run([louise, heavy], small)["place/lake-louise"]!.pair_with).toHaveLength(1);
  });
});

describe("two anchors pair on foot only", () => {
  const castle = rec({ ref: "place/castle", kind: "sight", class_key: "sight/castle", draw: "world", standing: "top" });
  const at = (km: number): Record<string, PlaceFacts> => ({
    "place/lake-louise": { point: LOUISE, onSiteMin: 120 },
    "place/castle": { point: { lat: LOUISE.lat + km / 111.19, lon: LOUISE.lon }, onSiteMin: 60 },
  });
  it("both are anchors", () => {
    const d = run([louise, castle], at(1));
    expect(d["place/lake-louise"]!.role).toBe("anchor");
    expect(d["place/castle"]!.role).toBe("anchor");
  });
  it("pairs when walkable", () => {
    expect(run([louise, castle], at(1))["place/lake-louise"]!.pair_with.map((p) => p.ref)).toEqual(["place/castle"]);
  });
  it("does not pair by car, even with a real 10 min drive time", () => {
    const d = run([louise, castle], at(6), { driveMin: { "place/lake-louise": { "place/castle": 10 } } })["place/lake-louise"]!;
    expect(d.pair_with).toEqual([]);
  });
  it("a lighter non-anchor still pairs by car with a real drive time", () => {
    const lookout = rec({ ref: "place/castle", kind: "viewpoint", class_key: "viewpoint/short-walk", draw: "local", standing: "good" });
    const d = run([louise, lookout], at(6), { driveMin: { "place/lake-louise": { "place/castle": 10 } } })["place/lake-louise"]!;
    expect(d.pair_with[0]).toMatchObject({ ref: "place/castle", how: "drive" });
  });
});

describe("pair_with: a hand-picked pair with no point (2.33)", () => {
  const facts: Record<string, PlaceFacts> = {
    "place/lake-louise": { point: LOUISE, onSiteMin: 90 },
    "place/lake-agnes": { onSiteMin: 240 }, // the record exists, its point does not
  };
  const hand = { ...louise, pairs_with: [{ ref: "place/lake-agnes", reason: "the teahouse walk starts at the lake" }] };

  it("keeps the pair and shows no distance", () => {
    const d = run([hand, agnes], facts)["place/lake-louise"]!;
    expect(d.pair_with).toHaveLength(1);
    expect(d.pair_with[0]).toMatchObject({ ref: "place/lake-agnes", km: null, how: null, extra_min: null, hand_picked: true, reason: "the teahouse walk starts at the lake" });
  });

  it("keeps it when the subject itself has no point", () => {
    const d = run([hand, agnes], { "place/lake-agnes": { onSiteMin: 240 } })["place/lake-louise"]!;
    expect(d.pair_with.map((p) => p.ref)).toEqual(["place/lake-agnes"]);
    expect(d.pair_with[0]!.km).toBeNull();
  });

  it("a ref with no record at all is still dropped", () => {
    const ghost = { ...louise, pairs_with: [{ ref: "place/nowhere", reason: "does not exist" }] };
    expect(run([ghost], facts)["place/lake-louise"]!.pair_with).toEqual([]);
  });
});

describe("plan_b_pick in the schema", () => {
  it("takes a ref with a reason and an optional source, and refuses an empty reason or a key it does not know", () => {
    expect(relRecord.safeParse({ ...louise, plan_b_pick: { ref: "place/x", reason: "short walk", src: "src-0001" } }).success).toBe(true);
    expect(relRecord.safeParse({ ...louise, plan_b_pick: { ref: "place/x", reason: "" } }).success).toBe(false);
    expect(relRecord.safeParse({ ...louise, plan_b_pick: { ref: "place/x", reason: "r", extra: 1 } }).success).toBe(false);
  });
});
