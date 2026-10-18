// What the applicability table changes in derive, the gates and the projections (applicability spec 5.3, 5.4, M9):
// kind defaults that fire, the water class as the paddling grade, the carried gate where it applies, and N fields
// that no projection reads.
import { describe, expect, it } from "vitest";
import * as E from "../../src/schema/enums.ts";
import { KIND_TERRAIN, deriveEffort, familyEffortOf, kidsFromOf, projectFlat, strollerOkOf } from "../../src/suitability/derive.ts";
import { fits } from "../../src/suitability/gates.ts";
import { projectForSchedule } from "../../src/suitability/project.ts";
import { rec, sg, v, walk } from "./helpers.ts";

const cls = (system: "whitewater" | "flatwater", value: string) => v({ system, value }, "official_grade");
const check = (res: ReturnType<typeof fits>, gate: string) => res.checks.find((c) => c.gate === gate)?.status;
const toddler = { youngestAge: 2 };

describe("kind defaults (the S0 keys matched no vocabulary value)", () => {
  it("every key of KIND_TERRAIN is a value of SUIT_SUBKIND", () => {
    for (const key of Object.keys(KIND_TERRAIN)) expect(E.SUIT_SUBKIND as readonly string[], key).toContain(key);
  });
  it("the two keys that never fired now do: coaster and cave", () => {
    expect(deriveEffort({ kind: "activity", subkind: "coaster", block: {} })).toMatchObject({ terrain: 1, terrain_basis: "kind_default" });
    expect(deriveEffort({ kind: "sight", subkind: "cave", block: {} })).toMatchObject({ terrain: 1, terrain_basis: "kind_default" });
  });
  it("the old names are gone", () => {
    expect(Object.keys(KIND_TERRAIN)).not.toContain("mountain-coaster");
    expect(Object.keys(KIND_TERRAIN)).not.toContain("show-cave");
    expect(deriveEffort({ kind: "activity", subkind: "mountain-coaster", block: {} }).terrain).toBeNull();
  });
  it.each([["activity", "zipline", 2], ["activity", "boat-tour", 1], ["activity", "cruise", 1], ["sight", "museum", 1], ["sight", "castle", 1], ["sight", "landmark", 1], ["activity", "wildlife", 1], ["lift", "gondola", 1]] as const)(
    "%s/%s has terrain %i with nothing else stored", (kind, subkind, terrain) => {
      expect(deriveEffort({ kind, subkind, block: {} })).toMatchObject({ terrain, terrain_basis: "kind_default" });
    },
  );
  it("a stored grade or driver still beats the default", () => {
    expect(deriveEffort({ kind: "activity", subkind: "zipline", block: { effort: { override: { grade: 4, reason: "x", by: "t", on: "2026-10-18" } } } })).toMatchObject({ terrain: 4, terrain_basis: "override" });
  });
});

describe("A10: the water class is the effort grade for paddling", () => {
  const raft = (c: string) => rec({ water_safety: { class: cls("whitewater", c) } }, { kind: "activity", subkind: "rafting", ext: { kind: "paddle" } });
  it("derive reads water_safety.class on a paddle profile", () => {
    expect(deriveEffort({ kind: "activity", subkind: "rafting", block: raft("III").suitability }).terrain).toBe(4);
    expect(deriveEffort({ kind: "activity", subkind: "canoe", block: { water_safety: { class: cls("flatwater", "I") } } }).terrain).toBeNull(); // flatwater has no map rows
  });
  it("the flat copy and the projection carry it", () => {
    expect(projectFlat(raft("II")).house_grade).toBe(3);
    expect(projectForSchedule(raft("III"))).toMatchObject({ familyEffort: 4, sourceGrade: { system: "whitewater", value: "III" } });
  });
  it("a hike ignores a class, and a trail grade is not read on a raft", () => {
    expect(deriveEffort({ kind: "trail", subkind: "hike", block: { water_safety: { class: cls("whitewater", "III") } } }).terrain).toBeNull();
    const r = rec({ effort: { source_grade: sg("sac", "T4") } }, { kind: "activity", subkind: "rafting" });
    expect(projectFlat(r).house_grade).toBeNull(); // source_grade is N on rafting: the mask drops it before it is read
  });
});

describe("flat: suit_level and the N fields", () => {
  it("carries suit_level, draft for an empty record", () => {
    expect(projectFlat(rec({}, { kind: "lake", subkind: "lake" })).suit_level).toBe("draft");
  });
  it("skips the fields the profile marks N: a lake has no min_age or grade, a bungee has no walk", () => {
    const lake = rec({ min_age: v(8), effort: { source_grade: sg("sac", "T2"), drivers: { distance_km: v(2, "official_info") } } }, { kind: "lake", subkind: "lake" });
    expect(projectFlat(lake)).toMatchObject({ min_age: null, house_grade: null, walk_km: 2 });
    const bungee = rec(walk(3, 100, { min_age: v(14), min_weight_kg: v(45) }), { kind: "activity", subkind: "bungee" });
    expect(projectFlat(bungee)).toMatchObject({ min_age: 14, min_weight_kg: 45, walk_km: null, walk_gain_m: null, house_grade: null });
  });
  it("accessibility reads wheelchair only where the profile asks for it", () => {
    expect(projectFlat(rec({ wheelchair: v("step_free", "official_info") }, { kind: "activity", subkind: "rafting" })).accessibility).toBe("unknown");
    expect(projectFlat(rec({ wheelchair: v("step_free", "official_info") }, { kind: "lake", subkind: "lake" })).accessibility).toBe("step-free");
  });
  it("kinds with effort N get no house grade even when a kind default exists", () => {
    expect(projectFlat(rec({}, { kind: "lift", subkind: "gondola" })).house_grade).toBeNull();
    expect(projectFlat(rec({}, { kind: "activity", subkind: "cruise" })).house_grade).toBeNull();
  });
  it("a record with no subkind has no profile and is read whole (the S0 behaviour)", () => {
    expect(projectFlat(rec({ min_age: v(8) }, { kind: "lake" }))).toMatchObject({ min_age: 8, suit_level: "draft" });
  });
});

describe("kids_from, family_effort and stroller_ok (spec 5.3)", () => {
  it("kidsFromOf is the larger of the rule minimum and the band start; null when neither is known", () => {
    const boat = (block: object, extra = {}) => rec(block, { kind: "activity", subkind: "boat-tour", ...extra });
    expect(kidsFromOf(boat({}))).toBeNull();
    expect(kidsFromOf(boat({ min_age: v(6) }))).toBe(6);
    expect(kidsFromOf(boat({ min_age: v(6), age_band: v({ from: 8, to: null }, "our_inference") }))).toBe(8);
    expect(kidsFromOf(boat({ age_band: v({ from: 5, to: null }, "our_inference") }))).toBe(5);
    expect(kidsFromOf(boat({ min_age: v(10), age_rule: "recommendation" }))).toBeNull(); // advice does not exclude
  });
  it("with offers, the most permissive rule is the one a party can book", () => {
    const r = rec({}, { kind: "activity", subkind: "rafting", offers: [
      { name: "Family", suitability: { min_age: v(8) } }, { name: "Class III", suitability: { min_age: v(12) } },
    ] });
    expect(kidsFromOf(r)).toBe(8);
  });
  it("a lake skips min_age (N), a rafting record skips nothing it asks for", () => {
    expect(kidsFromOf(rec({ min_age: v(8) }, { kind: "lake", subkind: "lake" }))).toBeNull();
  });
  it("familyEffortOf is null for the profiles whose effort is N", () => {
    expect(familyEffortOf(rec({}, { kind: "activity", subkind: "bungee" }))).toBeNull();
    expect(familyEffortOf(rec({}, { kind: "lift", subkind: "gondola" }))).toBeNull();
    expect(familyEffortOf(rec(walk(5, 100, { effort: { source_grade: sg("sac", "T2") } }), { kind: "trail", subkind: "hike" }))).toBe(3); // SAC T2
  });
  it("strollerOkOf reads the surface for places and the carriage rule for conveyances, and null for the rest", () => {
    expect(strollerOkOf(rec({ stroller: v("smooth", "official_info"), stroller_extent: { scope: "whole" } }, { kind: "trail", subkind: "walk" }))).toBe("yes");
    expect(strollerOkOf(rec({ stroller: v("all_terrain", "our_inference") }, { kind: "trail", subkind: "hike" }))).toBe("partly");
    expect(strollerOkOf(rec({ stroller: v("none", "official_info") }, { kind: "trail", subkind: "hike" }))).toBe("no");
    expect(strollerOkOf(rec({ stroller_on_board: v("no", "operator_rule") }, { kind: "activity", subkind: "cruise" }))).toBe("no");
    expect(strollerOkOf(rec({ stroller_on_board: v("folded", "operator_rule") }, { kind: "lift", subkind: "gondola" }))).toBe("partly");
    expect(strollerOkOf(rec({ stroller_on_board: v("yes", "operator_rule") }, { kind: "lift", subkind: "gondola" }))).toBe("yes");
    expect(strollerOkOf(rec({ stroller: v("smooth", "official_info") }, { kind: "activity", subkind: "bungee" }))).toBeNull(); // N: not read
    expect(strollerOkOf(rec({}, { kind: "trail", subkind: "hike" }))).toBeNull();
  });
});

describe("gates: the carried check runs only where the profile applies it (PC9)", () => {
  it("a toddler on a cruise is checked on the carriage rule, not on carrier and stroller", () => {
    const cruise = (block: object) => rec(block, { kind: "activity", subkind: "cruise" });
    const unknown = fits(cruise({}), toddler);
    expect(check(unknown, "carried")).toBeUndefined();
    expect(check(unknown, "on_board")).toBe("unknown");
    expect(unknown.checks.map((c) => c.detail).join(" ")).not.toContain("carrier and stroller not known");
    expect(check(fits(cruise({ stroller_on_board: v("folded", "operator_rule") }), toddler), "on_board")).toBe("ok");
    expect(check(fits(cruise({ stroller_on_board: v("leave_at_dock", "operator_rule") }), toddler), "on_board")).toBe("ok");
    const no = fits(cruise({ stroller_on_board: v("no", "operator_rule") }), toddler);
    expect(check(no, "on_board")).toBe("advice");
    expect(no.advice).toContain("no strollers on board");
    expect(no.fits).toBe("yes"); // a stroller ban is advice: it never excludes a child
  });
  it("a toddler at a bungee jump is not checked on carrying at all; the minimum age excludes", () => {
    const bungee = rec({ min_age: v(14), stroller: v("none", "official_info"), carrier_ok: v(false, "our_inference") }, { kind: "activity", subkind: "bungee" });
    const r = fits(bungee, toddler);
    expect(check(r, "carried")).toBeUndefined();
    expect(check(r, "on_board")).toBeUndefined();
    expect(check(r, "min_age")).toBe("fail");
    expect(r.fits).toBe("no");
  });
  it("a trail is still checked for a toddler on carrier and stroller", () => {
    const hike = (block: object) => rec(block, { kind: "trail", subkind: "hike" });
    expect(check(fits(hike({}), toddler), "carried")).toBe("unknown");
    expect(check(fits(hike({ carrier_ok: v(true, "our_inference") }), toddler), "carried")).toBe("ok");
    expect(check(fits(hike({ carrier_ok: v(false, "our_inference"), stroller: v("none", "official_info") }), toddler), "carried")).toBe("fail");
  });
  it("a show cave that bans carriers fails a toddler when no stroller works either", () => {
    const cave = rec({ carrier_ok: v(false, "operator_rule"), stroller: v("none", "operator_rule") }, { kind: "sight", subkind: "cave" });
    expect(check(fits(cave, toddler), "carried")).toBe("fail");
  });
  it("a record with no subkind keeps the S0 behaviour: the check runs", () => {
    expect(check(fits(rec({}, { kind: "activity" }), toddler), "carried")).toBe("unknown");
  });
  it("a field the profile marks N is never read by the gates", () => {
    // min_age is N on a lake: a stray value there cannot exclude a child
    const lake = rec({ min_age: v(12) }, { kind: "lake", subkind: "lake" });
    expect(check(fits(lake, { youngestAge: 6 }), "min_age")).toBeUndefined();
    expect(fits(lake, { youngestAge: 6 }).fits).toBe("yes");
  });
  it("older children are not gated on carrying", () => {
    expect(check(fits(rec({}, { kind: "activity", subkind: "cruise" }), { youngestAge: 8 }), "on_board")).toBeUndefined();
  });
});

describe("projectForSchedule skips N fields", () => {
  it("a lift projects no stroller (a surface), a rafting record no wheelchair or carrier", () => {
    const lift = projectForSchedule(rec({ stroller: v("smooth", "official_info"), carrier_ok: v(true, "our_inference"), wheelchair: v("step_free", "official_info") }, { kind: "lift", subkind: "gondola" }));
    expect(lift).toMatchObject({ stroller: null, carrierOk: true, wheelchair: "yes" }); // carrier_ok is A on a lift
    const raft = projectForSchedule(rec({ wheelchair: v("step_free", "official_info"), carrier_ok: v(true, "our_inference"), min_age: v(8) }, { kind: "activity", subkind: "rafting" }));
    expect(raft).toMatchObject({ wheelchair: null, carrierOk: null, minAge: 8 });
  });
  it("a lake projects no limits and no effort even if some were stored", () => {
    const s = projectForSchedule(rec({ min_age: v(8), max_weight_kg: v(100), effort: { source_grade: sg("sac", "T3") } }, { kind: "lake", subkind: "lake" }));
    expect(s).toMatchObject({ minAge: null, maxWeightKg: null, rule: null, familyEffort: null, sourceGrade: null });
    expect(s.ruleByField).toEqual({});
  });
  it("a profile with no effort projects no terrain or effort km either", () => {
    const g = rec(walk(5, 100, { effort: { source_grade: sg("sac", "T2") } }), { kind: "activity", subkind: "boat-tour" });
    expect(projectForSchedule(g)).toMatchObject({ terrain: null, effortKm: null, familyEffort: null });
    expect(projectForSchedule(rec(walk(5, 100, { effort: { source_grade: sg("sac", "T2") } }), { kind: "trail", subkind: "hike" })).effortKm).not.toBeNull();
  });
  it("child time our rule is written only where child_time_min applies", () => {
    expect(projectForSchedule(rec({}, { kind: "trail", subkind: "hike" })).provenance).toContain("child time our rule");
    expect(projectForSchedule(rec({}, { kind: "activity", subkind: "bungee" })).provenance).not.toContain("child time");
    expect(projectForSchedule(rec({}, { kind: "lift", subkind: "gondola" })).provenance).toBe("");
  });
  it("a boat has no family effort; a hike keeps it", () => {
    const g = { effort: { source_grade: sg("sac", "T2") } };
    expect(projectForSchedule(rec(g, { kind: "activity", subkind: "boat-tour" })).familyEffort).toBeNull();
    expect(projectForSchedule(rec(g, { kind: "trail", subkind: "hike" })).familyEffort).toBe(3);
  });
  it("a record with no subkind is read whole", () => {
    expect(projectForSchedule(rec({ min_age: v(8) }, { kind: "lake" })).minAge).toBe(8);
  });
  it("the provenance line is built from the same masked block", () => {
    const s = projectForSchedule(rec({ min_age: v(8) }, { kind: "lake", subkind: "lake" }));
    expect(s.provenance).toBe(""); // min_age is N on a lake, and so is child_time_min: neither line is written
  });
});
