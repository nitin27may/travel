// The applicability file and the rules built on it (docs/v2/research/suitability-applicability.md): the table, its
// lookups, suit_level, and the validator codes that read it. The fixtures for each new code are in
// fixtures/suitability/{broken,warn}; validate.test.ts runs them. These tests cover what a fixture cannot.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as E from "../../src/schema/enums.ts";
import { suitabilityBlock } from "../../src/schema/suitability.ts";
import type { SuitabilityRecord } from "../../src/schema/suitability.ts";
import {
  DEFAULT_APPLICABILITY as APP, applicablePaths, answerOf, hasEffort, isOperated, markOf, maskNotApplicable, notApplicablePaths,
  profileOf, profileOfPair, profilesClaiming, requiredPaths, subkindsOfKind,
} from "../../src/suitability/applicability.ts";
import { checkRecord, fieldsOf, suitLevel } from "../../src/suitability/level.ts";
import { APPLICABILITY_PATHS, BLOCK_NON_PATHS, BLOCK_PATHS, EXT_KINDS } from "../../src/suitability/paths.ts";
import { validateDoc, validateFile } from "../../src/validate/index.ts";
import { gap, searchedNone, v } from "./helpers.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const ROOT = join(REPO, "core", "test", "fixtures", "suitability", "root");
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const warnCodes = (r: { warnings: { code: string }[] }) => [...new Set(r.warnings.map((e) => e.code))].sort();

describe("the applicability file", () => {
  const profiles = Object.entries(APP.profiles);
  it("has a row for every profile of SUIT_PROFILE (37 old and 10 new with the type tree), and no other", () => {
    expect(Object.keys(APP.profiles).sort()).toEqual([...E.SUIT_PROFILE].sort());
    expect(profiles.length).toBe(Object.keys(E.SUIT_PROFILE).length);
  });
  it("every profile states every field path (N is explicit) and no other", () => {
    expect(APPLICABILITY_PATHS).toHaveLength(153); // 148 + change_rooms, showers, picnic, baby_change, participation.driver
    for (const [name, p] of profiles) expect(Object.keys(p.fields).sort(), name).toEqual([...APPLICABILITY_PATHS].sort());
  });
  it("every cell is R, A, N or op", () => {
    for (const [name, p] of profiles) for (const [path, m] of Object.entries(p.fields)) expect(E.APPLICABILITY as readonly string[], `${name} ${path}`).toContain(m);
  });
  it("maps every (kind, subkind) pair to exactly one profile and claims every subkind of the vocabulary", () => {
    const seen = new Map<string, string[]>();
    for (const [name, p] of profiles) for (const m of p.match) seen.set(`${m.kind}/${m.subkind}`, [...(seen.get(`${m.kind}/${m.subkind}`) ?? []), name]);
    for (const [pair, who] of seen) expect(who, pair).toHaveLength(1);
    const claimed = new Set([...seen.keys()].map((k) => k.split("/")[1]));
    for (const s of E.SUIT_SUBKIND) expect(claimed.has(s), s).toBe(true);
    for (const [pair] of seen) {
      const [kind, subkind] = pair.split("/");
      expect(E.SUIT_KIND as readonly string[], pair).toContain(kind);
      expect(E.SUIT_SUBKIND as readonly string[], pair).toContain(subkind);
    }
  });
  it("a profile's ext is the one extension whose fields it asks for", () => {
    for (const [name, p] of profiles) {
      const used = new Set(Object.entries(p.fields).filter(([k, m]) => k.startsWith("ext.") && m !== "N").map(([k]) => k.split(".")[1]));
      expect(used.size, name).toBeLessThanOrEqual(1);
      expect(p.ext, name).toBe([...used][0] ?? null);
      if (p.ext) expect(EXT_KINDS).toContain(p.ext);
    }
  });
  it("a profile that is never operated asks for no participation field", () => {
    for (const [name, p] of profiles) {
      if (p.operated !== "never") continue;
      expect(Object.entries(p.fields).filter(([k, m]) => k.startsWith("participation.") && m !== "N"), name).toEqual([]);
    }
  });
  it("covers every field of the schema: no shared-block key is left without a path", () => {
    const groups = new Set([...BLOCK_PATHS.map((p) => p.split(".")[0]!), ...BLOCK_NON_PATHS]);
    for (const key of Object.keys(suitabilityBlock.shape)) expect(groups.has(key), `shared-block key ${key} has no applicability path`).toBe(true);
    const have = new Set(BLOCK_PATHS.map((p) => p.split(".")[0]));
    for (const [group, inner] of [["participation", "participation"], ["water_safety", "water_safety"]] as const) {
      const shape = ((suitabilityBlock.shape as unknown as Record<string, { unwrap: () => { shape: Record<string, unknown> } }>)[group]!).unwrap().shape;
      for (const k of Object.keys(shape)) expect(BLOCK_PATHS as readonly string[], `${inner}.${k}`).toContain(`${inner}.${k}`);
    }
    expect(have.has("effort")).toBe(true);
  });
  it("validates with no error, and matches what the spec says for 35 profiles", () => {
    const r = validateFile(join(REPO, "data/schema/suitability-applicability.json"), REPO);
    expect(r.errors).toEqual([]);
    expect(Object.keys(APP.profiles)).toContain("river_hike");
  });
  it("a copy of the file with a broken map is rejected with E_SUIT_PROFILE_MAP", () => {
    const mut = (f: (a: typeof APP) => void) => {
      const a = structuredClone(APP);
      f(a);
      return validateDoc(a, "sidecar", ROOT, { kind: "suitability-applicability" });
    };
    expect(codes(mut((a) => void delete a.profiles.eatery))).toEqual(["E_SUIT_PROFILE_MAP"]); // a profile missing
    expect(codes(mut((a) => void delete a.profiles.hike!.fields["min_age"]))).toEqual(["E_SUIT_PROFILE_MAP"]); // a path missing
    expect(codes(mut((a) => void (a.profiles.hike!.fields["made_up"] = "R")))).toEqual(["E_SUIT_PROFILE_MAP"]); // a path the schema lacks
    expect(codes(mut((a) => void a.profiles.lake!.match.pop()))).toEqual(["E_SUIT_PROFILE_MAP"]); // a subkind no profile claims
    expect(codes(mut((a) => void a.profiles.swim!.match.push({ kind: "lake", subkind: "lake" })))).toEqual(["E_SUIT_PROFILE_MAP"]); // a pair on two profiles
    expect(codes(mut((a) => void (a.profiles.rafting!.ext = "zip")))).toEqual(["E_SUIT_PROFILE_MAP"]); // ext disagrees with the marks
    expect(codes(mut((a) => void (a.profiles.viewpoint!.fields["participation.guide"] = "R")))).toEqual(["E_SUIT_PROFILE_MAP"]); // never operated but asks
    expect(codes(mut((a) => void (a.profiles.rafting!.fields["ext.zip.braking"] = "R")))).toEqual(["E_SUIT_PROFILE_MAP"]); // two extensions
  });
});

describe("the subkind vocabulary", () => {
  it("is closed, has no duplicate, and covers the stay kinds", () => {
    expect(new Set(E.SUIT_SUBKIND).size).toBe(E.SUIT_SUBKIND.length);
    for (const s of E.STAY_KIND) expect(E.SUIT_SUBKIND as readonly string[]).toContain(s);
  });
  it("kind drive exists with the scenic_drive subkind", () => {
    expect(E.SUIT_KIND as readonly string[]).toContain("drive");
    expect(profilesClaiming(APP, "drive", "scenic_drive")).toEqual(["drive"]);
  });
  it("subkindsOfKind lists the subkinds a kind accepts", () => {
    expect(subkindsOfKind(APP, "town").sort()).toEqual(["city", "town", "village"]);
    expect(subkindsOfKind(APP, "lake")).toEqual(["lake"]);
  });
});

describe("the lookup", () => {
  const rec = (kind: string, subkind?: string, operated?: boolean) => ({ kind, subkind, operated });
  it("profileOf maps a record by kind and subkind", () => {
    expect(profileOf(rec("trail", "hike"))!.name).toBe("hike");
    expect(profileOf(rec("trail", "walk"))!.name).toBe("walk");
    expect(profileOf(rec("trail", "river_hike"))!.name).toBe("river_hike");
    expect(profileOf(rec("activity", "guided-hike"))!.name).toBe("hike");
    expect(profileOf(rec("activity", "heli-hike"))!.name).toBe("hike");
    expect(profileOf(rec("activity", "float"))!.name).toBe("float");
    expect(profileOf(rec("activity", "vehicle-tour"))!.name).toBe("vehicle_tour");
    expect(profileOf(rec("activity", "scenic-flight"))!.name).toBe("air_tour");
    expect(profileOf(rec("sight", "park"))!.name).toBe("area");
    expect(profileOf(rec("sight", "area"))!.name).toBe("area");
    expect(profileOf(rec("activity", "boat-shuttle"))!.name).toBe("boat");
    expect(profileOf(rec("swim_spot", "hot_spring"))!.name).toBe("hot_spring");
    expect(profileOf(rec("activity", "hot-springs"))!.name).toBe("hot_spring");
    expect(profileOf(rec("swim_spot", "beach"))!.name).toBe("beach");
    expect(profileOf(rec("sight", "cave"))!.name).toBe("show_cave");
    expect(profileOf(rec("lift", "rack_railway"))!.name).toBe("lift");
    expect(profileOf(rec("stay", "hut"))!.name).toBe("stay");
  });
  it("a missing subkind, an unknown one or a subkind of another kind has no profile", () => {
    expect(profileOf(rec("trail"))).toBeNull();
    expect(profileOf(rec("trail", "teleport"))).toBeNull();
    expect(profileOf(rec("lake", "hike"))).toBeNull();
    expect(profileOfPair("lake", undefined)).toBeNull();
  });
  it("a bungee jump asks for no stroller, toilets or effort; a boat asks for the carriage rule, not the surface", () => {
    const bungee = profileOf(rec("activity", "bungee"))!.profile;
    for (const p of ["stroller", "toilets", "effort.source_grade", "carrier_ok", "stroller_on_board"]) expect(markOf(bungee, p, true), p).toBe("N");
    expect(markOf(bungee, "min_weight_kg", true)).toBe("R");
    expect(markOf(bungee, "participation.pregnancy", true)).toBe("R");
    const boat = profileOf(rec("activity", "cruise"))!.profile;
    expect(markOf(boat, "stroller", true)).toBe("N");
    expect(markOf(boat, "stroller_on_board", true)).toBe("R");
    expect(markOf(boat, "toilets", true)).toBe("A");
  });
  it("the spec's notes hold: group_min R on a hike, carrier_ok R in a show cave, altitude A on a lift (placement moved it to the top station), wheelchair A on a zip line", () => {
    expect(markOf(profileOf(rec("trail", "hike"))!.profile, "group_min", false)).toBe("R");
    expect(markOf(profileOf(rec("sight", "cave"))!.profile, "carrier_ok", false)).toBe("R");
    expect(markOf(profileOf(rec("lift", "gondola"))!.profile, "altitude_m", true)).toBe("A");
    expect(markOf(profileOf(rec("activity", "zipline"))!.profile, "wheelchair", true)).toBe("A");
    expect(markOf(profileOf(rec("activity", "canoe"))!.profile, "water_safety.water_temp_c", true)).toBe("R");
    expect(markOf(profileOf(rec("activity", "paragliding"))!.profile, "ext.flight.weight_by_slot", true)).toBe("R");
  });
  it("the operated layer: op cells are R when operated and N when not, and participation cells follow", () => {
    const hike = profileOf(rec("trail", "hike"))!.profile;
    expect(hike.operated).toBe("flag");
    expect(isOperated(hike, undefined)).toBe(false);
    expect(isOperated(hike, true)).toBe(true);
    expect(markOf(hike, "adult_required", false)).toBe("N");
    expect(markOf(hike, "adult_required", true)).toBe("R");
    expect(markOf(hike, "participation.guide", false)).toBe("N");
    expect(markOf(hike, "participation.guide", true)).toBe("R");
    expect(markOf(hike, "participation.kit_provided", true)).toBe("N"); // a hike never provides kit
    const canoe = profileOf(rec("activity", "canoe"))!.profile;
    expect(markOf(canoe, "participation.waiver", false)).toBe("N");
    expect(markOf(canoe, "participation.waiver", true)).toBe("A");
    const raft = profileOf(rec("activity", "rafting"))!.profile;
    expect(raft.operated).toBe("always");
    expect(isOperated(raft, false)).toBe(true); // the flag cannot switch a fixed profile off
    expect(markOf(raft, "participation.waiver", isOperated(raft, false))).toBe("R");
    const wildlife = profileOf(rec("activity", "wildlife"))!.profile;
    expect(markOf(wildlife, "min_age", false)).toBe("N");
    expect(markOf(wildlife, "min_age", true)).toBe("R");
    const view = profileOf(rec("viewpoint", "viewpoint"))!.profile;
    expect(isOperated(view, true)).toBe(false);
  });
  it("requiredPaths and applicablePaths grow with the operator layer and never overlap N", () => {
    const hike = profileOf(rec("trail", "hike"))!.profile;
    const off = requiredPaths(hike, false);
    const on = requiredPaths(hike, true);
    expect(on.length).toBeGreaterThan(off.length);
    expect(on).toEqual(expect.arrayContaining(off));
    for (const p of [...on, ...applicablePaths(hike, true)]) expect(notApplicablePaths(hike, true)).not.toContain(p);
    expect(off).toEqual(expect.arrayContaining(["group_min", "exposure", "hazards", "access_season", "ext.trail.navigation"]));
  });
  it("river_hike is the hike row plus the water fields (owner decision, Q1)", () => {
    const river = profileOf(rec("trail", "river_hike"))!.profile;
    const hike = profileOf(rec("trail", "hike"))!.profile;
    expect(river.ext).toBe("trail");
    expect(markOf(river, "water_safety.current_or_tide", false)).toBe("R");
    expect(markOf(river, "water_safety.water_temp_c", false)).toBe("R");
    expect(markOf(hike, "water_safety.current_or_tide", false)).toBe("N");
    for (const [path, m] of Object.entries(hike.fields)) if (!path.startsWith("water_safety.")) expect(river.fields[path], path).toBe(m);
  });
  it("hasEffort: trails, ferrata and paddle profiles have an effort; boat, bungee and lift do not", () => {
    const has = (kind: string, subkind: string) => hasEffort(profileOf({ kind, subkind })!.profile, true);
    expect([has("trail", "hike"), has("activity", "via-ferrata"), has("activity", "rafting"), has("activity", "canoe"), has("activity", "bike-park")]).toEqual([true, true, true, true, true]);
    expect([has("activity", "cruise"), has("activity", "bungee"), has("lift", "gondola"), has("lake", "lake"), has("activity", "zipline")]).toEqual([false, false, false, false, false]);
  });
  it("fieldsOf prints the R, A and N lists of a record (the lane command)", () => {
    const f = fieldsOf({ kind: "activity", subkind: "bungee" })!;
    expect(f.profile).toBe("bungee");
    expect(f.R).toContain("min_weight_kg");
    expect(f.N).toContain("stroller");
    expect(f.R.length + f.A.length + f.N.length).toBe(APPLICABILITY_PATHS.length);
    expect(fieldsOf({ kind: "trail" })).toBeNull();
  });
});

describe("the vehicle_tour and area profiles, and the swing height", () => {
  const mark = (kind: string, subkind: string, path: string) => markOf(profileOf({ kind, subkind })!.profile, path, true);
  it("a vehicle tour asks for the carriage rule and the weather, not for a flight time", () => {
    const vt = profileOf({ kind: "activity", subkind: "vehicle-tour" })!;
    expect(vt.name).toBe("vehicle_tour");
    expect(vt.profile.operated).toBe("always");
    expect(vt.profile.ext).toBeNull();
    for (const p of ["min_age", "on_site_min", "stroller_on_board", "wheelchair", "access_season", "participation.weather_cancel"]) expect(mark("activity", "vehicle-tour", p), p).toBe("R");
    expect(mark("activity", "vehicle-tour", "toilets")).toBe("A");
    expect(mark("activity", "vehicle-tour", "ext.flight.flight_min")).toBe("N");
    expect(mark("activity", "heli", "ext.flight.flight_min")).toBe("R");
  });
  it("an area asks for the child note, time on site, season and hazards; the child trails carry the effort", () => {
    const area = profileOf({ kind: "sight", subkind: "park" })!;
    expect(area.profile.operated).toBe("never");
    expect(area.profile.ext).toBe("area");
    expect(requiredPaths(area.profile, false).sort()).toEqual(["access_season", "hazards", "kid_note", "on_site_min"]);
    for (const p of ["stroller", "wheelchair", "accessible_toilet", "toilets", "food", "water", "signal", "altitude_m", "group_min", "limited_capacity_note", "ext.area.pass", "ext.area.access_road", "ext.area.stay_on_site", "ext.area.child_trails"]) expect(mark("sight", "area", p), p).toBe("A");
    expect(hasEffort(area.profile, false)).toBe(false);
    expect(mark("sight", "area", "effort.source_grade")).toBe("N");
  });
  it("an area record carries the area extension", () => {
    const rec = { ref: "place/lago-di-braies", kind: "sight", subkind: "park", suitability: {}, ext: { kind: "area", pass: v("permit", "official_info"), access_road: v("gravel", "official_info"), stay_on_site: v(["camping"], "official_info"), child_trails: v(["place/lago-di-braies"], "our_inference") } };
    const r = validateDoc({ schema: "suitability/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "t", model: "t", sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "t", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }], records: [rec] }, "sidecar", ROOT, { kind: "suitability" });
    expect(r.errors).toEqual([]);
  });
  it("min_height_cm is A for the swing subkinds (it shares the bungee profile)", () => {
    expect(mark("activity", "swing", "min_height_cm")).toBe("A");
    expect(mark("activity", "bungee", "min_weight_kg")).toBe("R");
    expect(mark("activity", "swing", "max_height_cm")).toBe("N");
  });
});

describe("maskNotApplicable", () => {
  it("drops the fields the profile marks N, at any depth, without changing the input", () => {
    const block = { stroller: v("smooth", "official_info"), min_age: v(8), effort: { source_grade: v({ system: "sac" as const, value: "T2" }), drivers: { surface: v(["paved"], "official_info"), distance_km: v(3, "official_info") } } };
    const frozen = structuredClone(block);
    const lake = profileOf({ kind: "lake", subkind: "lake" });
    const out = maskNotApplicable(block as never, lake, undefined) as typeof block;
    expect(out.min_age).toBeUndefined(); // N on a lake
    expect(out.stroller).toBeDefined(); // R on a lake
    expect(out.effort.source_grade).toBeUndefined(); // N on a lake
    expect(out.effort.drivers.distance_km).toBeDefined(); // A on a lake
    expect(block).toEqual(frozen);
  });
  it("is the identity with no profile", () => {
    const b = { min_age: v(8) };
    expect(maskNotApplicable(b, null, undefined)).toBe(b);
  });
  it("drops participation unless the record is operated", () => {
    const b = { participation: { guide: v("required" as const, "operator_rule") }, min_age: v(8) };
    const hike = profileOf({ kind: "trail", subkind: "hike" });
    expect((maskNotApplicable(b as never, hike, false) as typeof b).participation).toBeUndefined();
    expect((maskNotApplicable(b as never, hike, true) as typeof b).participation).toBeDefined();
  });
});

// ---- answered and suit_level ----------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const NON_VAL: Record<string, unknown> = {
  kid_note: "Fill note.",
  stroller_extent: { scope: "whole" },
  limited_capacity_note: "Fill note.",
  access_detail: { surface: searchedNone() },
  "ext.ferrata.kit_weight_note": "Fill note.",
  "ext.trail.shape": "loop",
};
const firmVal = (): Obj => ({ v: "fixture", state: "value", basis: "operator_info", src: [], note: "fixture" });
/** Answer a path with a firm value (or the plain value a non-Val field takes); `soft` answers it with a searched_none. */
function answer(rec: SuitabilityRecord, path: string, soft = false): void {
  const target = path.startsWith("ext.") ? ((rec.ext ??= { kind: path.split(".")[1] } as never) as unknown as Obj) : (rec.suitability as unknown as Obj);
  const parts = path.startsWith("ext.") ? [path.split(".")[2]!] : path.split(".");
  let cur = target;
  for (const part of parts.slice(0, -1)) cur = (cur[part] ??= {}) as Obj;
  cur[parts[parts.length - 1]!] = path in NON_VAL ? NON_VAL[path] : soft ? searchedNone() : firmVal();
}
const fill = (rec: SuitabilityRecord, paths: string[], soft: readonly string[] = []): SuitabilityRecord => {
  for (const p of paths) answer(rec, p, soft.includes(p));
  return rec;
};
const lake = (): SuitabilityRecord => ({ ref: "place/lago-di-braies", kind: "lake", subkind: "lake", suitability: {} });

describe("answerOf", () => {
  it("a value, none_stated and searched_none answer; a gap does not", () => {
    expect(answerOf(v(8))).toBe("answered");
    expect(answerOf({ v: null, state: "none_stated", basis: "operator_rule", src: [] })).toBe("answered");
    expect(answerOf(searchedNone())).toBe("answered");
    expect(answerOf(gap())).toBe("open");
    expect(answerOf(undefined)).toBe("open");
  });
  it("not_applicable is an exemption only with a note", () => {
    expect(answerOf({ v: null, state: "not_applicable", basis: null, src: [], note: "no walk at the top" })).toBe("exempt");
    expect(answerOf({ v: null, state: "not_applicable", basis: null, src: [] })).toBe("bad_exempt");
    expect(answerOf({ v: null, state: "not_applicable", basis: null, src: [], note: "  " })).toBe("bad_exempt");
  });
  it("plain fields answer when they hold content", () => {
    expect(answerOf("a note")).toBe("answered");
    expect(answerOf("")).toBe("open");
    expect(answerOf({ scope: "whole" })).toBe("answered");
    expect(answerOf({ surface: gap() })).toBe("open");
  });
});

describe("suit_level: Usable counts only R, Complete counts A", () => {
  it("an empty record is draft and names its unanswered R fields", () => {
    const c = checkRecord(lake());
    expect(c.level).toBe("draft");
    expect(c.missingRequired).toEqual(expect.arrayContaining(["age_band", "kid_note", "stroller", "wheelchair", "on_site_min", "access_season"]));
    expect(c.missingRequired).not.toContain("toilets"); // A on a lake
  });
  it("answering every R field makes it usable, even with every A field open", () => {
    const rec = fill(lake(), requiredPaths(APP.profiles.lake!, false));
    const c = checkRecord(rec);
    expect(c.missingRequired).toEqual([]);
    expect(c.level).toBe("usable");
    expect(c.missingApplicable.length).toBeGreaterThan(5);
    expect(suitLevel(rec)).toBe("usable");
  });
  it("one R field short is still draft", () => {
    const paths = requiredPaths(APP.profiles.lake!, false);
    const rec = fill(lake(), paths.slice(1));
    expect(suitLevel(rec)).toBe("draft");
    expect(checkRecord(rec).missingRequired).toEqual([paths[0]]);
  });
  it("answering every A field as well makes it complete", () => {
    const rec = fill(lake(), [...requiredPaths(APP.profiles.lake!, false), ...applicablePaths(APP.profiles.lake!, false)]);
    expect(suitLevel(rec)).toBe("complete");
  });
  it("a gap is not an answer", () => {
    const rec = fill(lake(), requiredPaths(APP.profiles.lake!, false));
    (rec.suitability as Obj).wheelchair = gap();
    expect(suitLevel(rec)).toBe("draft");
  });
  it("a not_applicable with a note exempts an R field; without a note it does not", () => {
    const rec = fill(lake(), requiredPaths(APP.profiles.lake!, false));
    (rec.suitability as Obj).wheelchair = { v: null, state: "not_applicable", basis: null, src: [], note: "private shore, no public access" };
    expect(suitLevel(rec)).toBe("usable");
    (rec.suitability as Obj).wheelchair = { v: null, state: "not_applicable", basis: null, src: [] };
    const c = checkRecord(rec);
    expect(c.level).toBe("draft");
    expect(c.badExempt.map((x) => x.path)).toEqual(["wheelchair"]);
    expect(c.badExempt[0]!.ptr).toBe("/suitability/wheelchair");
  });
  it("an N field never counts: filling it neither helps nor hurts the level, and it is reported", () => {
    const rec = fill(lake(), requiredPaths(APP.profiles.lake!, false));
    (rec.suitability as Obj).stroller_on_board = v("no", "operator_rule");
    expect(suitLevel(rec)).toBe("usable");
    expect(checkRecord(rec).naPresent.map((x) => x.path)).toEqual(["stroller_on_board"]);
  });
  it("a gap in an N field is not reported", () => {
    const rec = lake();
    (rec.suitability as Obj).stroller_on_board = gap();
    expect(checkRecord(rec).naPresent).toEqual([]);
  });
  it("the operated flag adds the participation fields to the required list", () => {
    const hike = (operated?: boolean): SuitabilityRecord => ({ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", ...(operated === undefined ? {} : { operated }), suitability: {} });
    const free = fill(hike(), requiredPaths(APP.profiles.hike!, false));
    expect(suitLevel(free)).toBe("usable");
    const guided = hike(true);
    guided.suitability = structuredClone(free.suitability);
    guided.ext = structuredClone(free.ext);
    expect(suitLevel(guided)).toBe("draft");
    expect(checkRecord(guided).missingRequired).toEqual(expect.arrayContaining(["participation.guide", "participation.waiver", "adult_required"]));
    fill(guided, requiredPaths(APP.profiles.hike!, true));
    expect(suitLevel(guided)).toBe("usable");
  });
  it("offers: an offer-level R field is answered when the offer or the record answers it, for every offer", () => {
    const raft = (): SuitabilityRecord => ({
      ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", suitability: {},
      offers: [{ name: "Family", suitability: {} }, { name: "Class III", suitability: {} }],
    });
    const rec = raft();
    const paths = requiredPaths(APP.profiles.rafting!, true);
    const limits = ["min_age", "min_weight_kg"];
    fill(rec, paths.filter((p) => !limits.includes(p)));
    expect(checkRecord(rec).missingRequired).toEqual(expect.arrayContaining(limits));
    (rec.offers![0]!.suitability as Obj).min_age = v(8);
    expect(checkRecord(rec).missingRequired).toContain("min_age"); // the second offer still lacks it
    (rec.offers![1]!.suitability as Obj).min_age = v(12);
    expect(checkRecord(rec).missingRequired).not.toContain("min_age");
    (rec.suitability as Obj).min_weight_kg = searchedNone(); // a record-level answer covers every offer
    expect(checkRecord(rec).missingRequired).not.toContain("min_weight_kg");
  });
  it("a record with no valid subkind has no profile and stays draft", () => {
    const c = checkRecord({ kind: "lake", suitability: {} });
    expect(c.located).toBeNull();
    expect(c.level).toBe("draft");
  });
});

// ---- the validator codes ----------------------------------------------------------------------------------------------

const baseDoc = (records: unknown[]) => ({
  schema: "suitability/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "t", model: "t",
  sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "t", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }],
  records,
});
const run = (records: unknown[]) => {
  process.env.SUITABILITY_TODAY = "2026-10-18";
  return validateDoc(baseDoc(records), "sidecar", ROOT, { kind: "suitability" });
};
const braies = (over: Obj = {}) => ({ ref: "place/lago-di-braies", kind: "lake", subkind: "lake", suitability: {}, ...over });

describe("E_SUIT_SUBKIND", () => {
  it("fires when the subkind is missing, outside the vocabulary, or not a subkind of the kind", () => {
    const missing = run([{ ref: "place/lago-di-braies", kind: "lake", suitability: {} }]);
    expect(codes(missing)).toEqual(["E_SUIT_SUBKIND"]);
    expect(missing.errors[0]!.path).toBe("/records/0/subkind");
    expect(missing.errors[0]!.message).toContain('"lake"');
    expect(codes(run([braies({ subkind: "pond" })]))).toEqual(["E_SUIT_SUBKIND"]);
    const wrong = run([braies({ subkind: "hike" })]);
    expect(codes(wrong)).toEqual(["E_SUIT_SUBKIND"]);
    expect(wrong.errors[0]!.message).toContain("is not a subkind of kind");
  });
  it("the S0 activity types that are not in the vocabulary are rejected", () => {
    for (const old of ["other", "glacier", "guided_hike", "via_ferrata", "mountain-coaster", "show-cave"]) expect(codes(run([braies({ kind: "activity", subkind: old })])), old).toEqual(["E_SUIT_SUBKIND"]);
  });
  it("a valid subkind of each kind passes", () => {
    for (const [kind, subkind] of [["lake", "lake"], ["trail", "walk"], ["lift", "funicular"], ["drive", "scenic_drive"], ["swim_spot", "beach"], ["stay", "campsite"], ["eatery", "cafe"], ["sight", "wildlife_viewing"]]) {
      expect(codes(run([braies({ kind, subkind })])), `${kind}/${subkind}`).toEqual([]);
    }
  });
});

describe("E_SUIT_EXT_KIND", () => {
  it("fires on a record whose ext is not its profile's extension, and on an offer", () => {
    const r = run([braies({ ext: { kind: "trail" } })]);
    expect(codes(r)).toEqual(["E_SUIT_EXT_KIND"]);
    expect(r.errors[0]!.path).toBe("/records/0/ext/kind");
    expect(r.errors[0]!.message).toContain('"water"');
    const offer = run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", suitability: {}, ext: { kind: "paddle" }, offers: [{ name: "A", suitability: {}, ext: { kind: "zip" } }] }]);
    expect(codes(offer)).toEqual(["E_SUIT_EXT_KIND"]);
    expect(offer.errors[0]!.path).toBe("/records/0/offers/0/ext/kind");
  });
  it("a profile with no extension accepts none, and the right extension passes", () => {
    expect(codes(run([{ ref: "place/lago-di-braies", kind: "town", subkind: "town", suitability: {}, ext: { kind: "water" } }]))).toEqual(["E_SUIT_EXT_KIND"]);
    expect(codes(run([braies({ ext: { kind: "water", swimming: v("allowed", "official_info") } })]))).toEqual([]);
  });
});

describe("E_SUIT_NA_EXEMPT", () => {
  const na = (note?: string) => ({ v: null, state: "not_applicable", basis: null, src: [], ...(note ? { note } : {}) });
  it("fires on a not_applicable R or A field without a note, with the pointer of the field", () => {
    const r = run([braies({ suitability: { wheelchair: na(), toilets: na() } })]);
    expect(codes(r)).toEqual(["E_SUIT_NA_EXEMPT"]);
    expect(r.errors.map((e) => e.path).sort()).toEqual(["/records/0/suitability/toilets", "/records/0/suitability/wheelchair"]);
  });
  it("a note makes it a valid exemption", () => {
    expect(run([braies({ suitability: { wheelchair: na("private shore") } })]).errors).toEqual([]);
  });
  it("on an offer the pointer names the offer", () => {
    const r = run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", suitability: {}, offers: [{ name: "A", suitability: { min_age: na() } }] }]);
    expect(r.errors[0]!.path).toBe("/records/0/offers/0/suitability/min_age");
  });
  it("on an extension field the pointer names the field", () => {
    const r = run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", suitability: {}, ext: { kind: "paddle", sections: na() } }]);
    expect(r.errors.map((e) => e.path)).toEqual(["/records/0/ext/sections"]);
  });
});

describe("W_SUIT_NA_FIELD", () => {
  it("names the profile and the field, and is a warning, not an error", () => {
    const r = run([braies({ suitability: { stroller_on_board: v("no", "operator_rule") } })]);
    expect(r.errors).toEqual([]);
    const w = r.warnings.find((x) => x.code === "W_SUIT_NA_FIELD")!;
    expect(w.path).toBe("/records/0/suitability/stroller_on_board");
    expect(w.message).toContain('"lake"');
    expect(w.message).toContain("Remove it");
  });
  it("fires for nested paths, offers and extension fields", () => {
    const r = run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "bungee", suitability: { effort: { drivers: { surface: v(["paved"], "official_info") } } }, offers: [{ name: "A", suitability: { stroller: v("none", "official_info") } }], ext: { kind: "jump", harness: v("body", "operator_rule") } }]);
    expect(r.warnings.filter((w) => w.code === "W_SUIT_NA_FIELD").map((w) => w.path).sort()).toEqual([
      "/records/0/offers/0/suitability/stroller", "/records/0/suitability/effort/drivers/surface",
    ]);
  });
  it("a gap in an N field is not a warning; participation is N until the record is operated", () => {
    expect(warnCodes(run([braies({ suitability: { stroller_on_board: gap() } })]))).not.toContain("W_SUIT_NA_FIELD");
    const part = { participation: { guide: v("required", "operator_rule") } };
    const hike = (operated: boolean) => ({ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", operated, suitability: part });
    expect(warnCodes(run([hike(false)]))).toContain("W_SUIT_NA_FIELD");
    expect(warnCodes(run([hike(true)]))).not.toContain("W_SUIT_NA_FIELD");
  });
  it("the S0 hazards of the trail extension are gone: a typed shared field replaces them", () => {
    const r = run([{ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", suitability: {}, ext: { kind: "trail", hazards: ["bears"] } }]);
    expect(codes(r)).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run([{ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", suitability: { hazards: v([{ category: "wildlife", note: "bears on the lower trail" }], "official_info") } }]))).toEqual([]);
    expect(codes(run([{ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", suitability: { hazards: v([{ category: "bears", note: "x" }], "official_info") } }]))).toEqual(["E_SUIT_SCHEMA"]);
  });
});

describe("W_SUIT_BELOW_USABLE", () => {
  it("names the profile and the first unanswered R fields, once per record", () => {
    const r = run([braies()]);
    const ws = r.warnings.filter((w) => w.code === "W_SUIT_BELOW_USABLE");
    expect(ws).toHaveLength(1);
    expect(ws[0]!.path).toBe("/records/0");
    expect(ws[0]!.message).toContain('"lake"');
    expect(ws[0]!.message).toContain("age_band");
    expect(ws[0]!.message).toMatch(/\+\d+ more/);
  });
  it("is absent once every R field is answered", () => {
    const paths = requiredPaths(APP.profiles.lake!, false);
    const rec = fill(lake(), paths, paths); // searched_none everywhere: schema-valid for every field
    const r = run([{ ...rec, flat: undefined }]);
    expect(r.errors).toEqual([]);
    expect(warnCodes(r)).not.toContain("W_SUIT_BELOW_USABLE");
  });
});

describe("W_SUIT_OPERATED_DEFAULT", () => {
  it("fires when operated is set on a profile where it is fixed, in either direction", () => {
    for (const rec of [braies({ operated: true }), { ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", operated: false, suitability: {}, ext: { kind: "paddle" } }]) {
      const r = run([rec]);
      expect(warnCodes(r)).toContain("W_SUIT_OPERATED_DEFAULT");
      expect(r.errors.map((e) => e.code)).not.toContain("E_SUIT_SCHEMA");
    }
  });
  it("is silent where the flag is the point, or absent", () => {
    expect(warnCodes(run([{ ref: "place/lago-di-braies", kind: "trail", subkind: "hike", operated: true, suitability: {} }]))).not.toContain("W_SUIT_OPERATED_DEFAULT");
    expect(warnCodes(run([braies()]))).not.toContain("W_SUIT_OPERATED_DEFAULT");
  });
});

describe("the new shared fields and extensions", () => {
  it("solo, stroller_on_board, hazards, participation and walk_m validate on the profiles that ask for them", () => {
    const lift = { ref: "place/lago-di-braies", kind: "lift", subkind: "chairlift", suitability: {
      solo: v({ min_age: 8, min_height_cm: 120 }), stroller_on_board: v("folded", "operator_rule"), toilets: v(["station"], "official_info"),
      participation: { weather_cancel: v({ causes: ["wind", "maintenance"], policy: "refund" }, "operator_rule") },
    }, ext: { kind: "lift", cabin: v("open_chair", "official_info"), last_down: v([{ from: "06-01", to: "09-30", time: "16:30" }], "operator_rule") } };
    const r = run([lift]);
    expect(r.errors).toEqual([]);
    expect(warnCodes(r)).not.toContain("W_SUIT_NA_FIELD");
    const view = { ref: "place/lago-di-braies", kind: "viewpoint", subkind: "viewpoint", suitability: { walk_m: v(300, "official_info") } };
    expect(codes(run([view]))).toEqual([]);
  });
  it("closed lists reject a value outside them", () => {
    const p = (participation: unknown) => run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "rafting", suitability: { participation }, ext: { kind: "paddle" } }]);
    expect(codes(p({ medical: v({ excluded: ["heart"], ask_doctor: ["asthma"] }, "operator_rule") }))).toEqual([]);
    expect(codes(p({ medical: v({ excluded: ["gout"], ask_doctor: [] }, "operator_rule") }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(p({ kit_provided: v(["pfd", "helmet"], "operator_rule") }))).toEqual([]);
    expect(codes(p({ kit_provided: v(["parachute"], "operator_rule") }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(p({ wear: v(["swimwear"], "operator_rule") }))).toEqual([]);
    expect(codes(p({ weather_cancel: v({ causes: ["meteor"], policy: null }, "operator_rule") }))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(p({ pregnancy: v("sometimes", "operator_rule") }))).toEqual(["E_SUIT_SCHEMA"]);
  });
  it("min_age_on_board is gone, craft boat_tour is gone, toilets gain on_board and station", () => {
    expect(codes(run([braies({ suitability: { water_safety: { min_age_on_board: v(5) } } })]))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "kayak", suitability: {}, ext: { kind: "paddle", craft: v("boat_tour", "operator_rule") } }]))).toEqual(["E_SUIT_SCHEMA"]);
    expect(codes(run([{ ref: "place/lago-di-braies", kind: "activity", subkind: "cruise", suitability: { toilets: v(["on_board"], "official_info") } }]))).toEqual([]);
  });
  it("each of the ten new extensions is a discriminant", () => {
    for (const k of ["lift", "boat", "zip", "jump", "coaster", "horse", "glacier", "flight", "wildlife", "drive"]) expect(EXT_KINDS, k).toContain(k);
    expect(EXT_KINDS).toContain("area");
    expect(EXT_KINDS).toHaveLength(18);
  });
  it("the shared enum lists exist with their closed values", () => {
    expect(E.MEDICAL).toHaveLength(12);
    expect(E.KIT).toContain("crampons");
    expect(E.WEAR).toContain("swimwear");
    expect(E.WEATHER_CAUSE).toContain("river_level");
    expect(E.SUIT_LEVEL).toEqual(["draft", "usable_partial", "usable", "complete"]);
  });
});

describe("the repository's own file passes the fixtures it ships", () => {
  it("reads the real file for a fixture root that has none", () => {
    const r = validateFile(join(ROOT, "..", "valid", "coaster.json"), ROOT);
    expect(r.errors).toEqual([]);
    expect(readFileSync(join(REPO, "data/schema/suitability-applicability.json"), "utf8")).toContain('"coaster"');
  });
});
