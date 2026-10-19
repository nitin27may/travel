import { describe, expect, it } from "vitest";
import { PROPERTIES, PROPERTY_BY_KEY, UNKNOWN_SUIT_ROWS } from "../../src/schema/capture/properties.ts";
import * as E from "../../src/schema/enums.ts";
import { APPLICABILITY_PATHS } from "../../src/suitability/paths.ts";
import { DEFAULT_TYPES, chainOf, countsOf, descendants, resolveWord, treeOf } from "../../src/capture/tree.ts";
import { explain, resolveNode, suitMark } from "../../src/capture/resolve.ts";

const tree = treeOf(DEFAULT_TYPES);

describe("the type tree (backlog 3a.12 step 1)", () => {
  it("the counts come from the file: a new type is one entry and needs no edit here", () => {
    const n = DEFAULT_TYPES.nodes;
    const by = (l: string) => n.filter((x) => x.level === l).length;
    const own = n.filter((x) => x.level === "domain" && x.category).length;
    expect(countsOf(DEFAULT_TYPES)).toEqual({ domains: by("domain"), categories: by("category") + own, types: by("type"), subtypes: by("subtype"), ids: by("type") + by("subtype"), nodes: n.length });
    expect(own).toBe(2); // settlement and event are their own category
  });
  it("the spec's first cut (18 Oct 2026) had 15 domains, 61 categories and 324 ids; the tree may only have grown since", () => {
    const c = countsOf(DEFAULT_TYPES);
    expect(c.domains).toBeGreaterThanOrEqual(15);
    expect(c.categories).toBeGreaterThanOrEqual(61);
    expect(c.ids).toBeGreaterThanOrEqual(324);
  });
  it("every id is unique and sits under its parent", () => {
    expect(new Set(DEFAULT_TYPES.nodes.map((n) => n.id)).size).toBe(DEFAULT_TYPES.nodes.length);
    for (const n of DEFAULT_TYPES.nodes) if (n.parent) expect(n.id.startsWith(`${n.parent}.`), n.id).toBe(true);
  });
  it("settlement and event are their own category, so 15 domains carry 61 categories", () => {
    expect(tree.byId.get("settlement")!.category).toBe(true);
    expect(tree.byId.get("event")!.category).toBe(true);
    expect(descendants(tree, "settlement")).toContain("settlement.cluster");
  });
  it("names the types the owner asked for", () => {
    for (const id of ["play.playground.playground", "play.playground.splash_pad", "play.adventure.adventure_park", "water.swim.beach", "access.amenity.picnic_area", "stay.camp.campground", "play.farm.pick_your_own", "animals.see.zoo", "animals.see.aquarium", "play.amusement.theme_park", "play.amusement.water_park", "food.market.market", "snow.ski.ski_area.ski_hill", "nature.viewpoint.lookout_tower", "nature.trek.hut_trek", "nature.summit.summit", "mountain.ferrata.via_ferrata", "mountain.climb.crag", "water.paddle.canoe", "water.boat.cruise", "air.zip.zipline.single_line", "water.motor.jet_ski", "settlement.cluster"]) {
      expect(tree.byId.has(id), id).toBe(true);
    }
  });
  it("resolves old words and kind/subkind pairs through aliases", () => {
    expect(resolveWord(tree, "pwc")).toBe("water.motor.jet_ski");
    expect(resolveWord(tree, "Sea-Doo")).toBe("water.motor.jet_ski");
    expect(resolveWord(tree, "klettersteig")).toBe("mountain.ferrata.via_ferrata");
    expect(resolveWord(tree, "activity/rafting")).toBe("water.river.rafting");
    expect(resolveWord(tree, "lake/lake")).toBe("water.body.lake");
    expect(resolveWord(tree, "no such thing")).toBeNull();
  });
  it("claims every legacy (kind, subkind) pair of the applicability vocabulary once", () => {
    const pairs = new Set<string>();
    for (const n of DEFAULT_TYPES.nodes) for (const l of n.legacy ?? []) {
      expect(pairs.has(`${l.kind}/${l.subkind}`)).toBe(false);
      pairs.add(`${l.kind}/${l.subkind}`);
    }
    for (const s of E.SUIT_SUBKIND) expect([...pairs].some((p) => p.endsWith(`/${s}`)), s).toBe(true);
  });
});

describe("inheritance (CC3)", () => {
  it("a subtype inherits its parents and overrides only what differs: the kids' zip course of 8.2", () => {
    const zip = resolveNode("air.zip.zipline", DEFAULT_TYPES)!;
    const kids = resolveNode("air.zip.zipline.kids_course", DEFAULT_TYPES)!;
    expect(kids.chain).toEqual(["air", "air.zip", "air.zip.zipline", "air.zip.zipline.kids_course"]);
    expect(kids.profile).toBe("zipline");
    expect(kids.records).toEqual(["offer"]);
    expect(kids.layers.offer!.base.price).toBe(zip.layers.offer!.base.price);
    // the four overrides of 8.2
    expect(suitMark(zip, "adult_required", true)).toBe("R");
    expect(suitMark(kids, "max_age", true)).toBe("R");
    expect(suitMark(zip, "max_age", true)).toBe("N");
    expect(suitMark(kids, "max_height_cm", true)).toBe("A");
    expect(suitMark(kids, "ext.zip.between_lines", true)).toBe("A");
    expect(kids.display.slot3).toBe("adult_required");
    expect(zip.display.slot3).toBe("ext.zip.braking");
  });
  it("the jet ski of 8.2 asks for the driver rule and nothing else changes", () => {
    const motor = resolveNode("water.motor", DEFAULT_TYPES)!;
    const jet = resolveNode("water.motor.jet_ski", DEFAULT_TYPES)!;
    expect(jet.profile).toBe("motor_water");
    expect(suitMark(jet, "participation.driver", true)).toBe("R");
    expect(jet.display.slot3).toBe("participation.driver");
    expect(motor.layers.offer!.offer_class).toBe("experience");
    expect(JSON.stringify(jet.layers)).toBe(JSON.stringify(motor.layers));
  });
  it("the hut stage of 8.2 is a route that must end at a hut and sit in a trek", () => {
    const stage = resolveNode("nature.trek.trek_stage.hut_stage", DEFAULT_TYPES)!;
    expect(stage.records).toEqual(["route"]);
    expect(stage.layers.route!.base.part_of).toBe("R");
    expect(stage.layers.route!.base.ends_at).toBe("R");
    expect(stage.layers.route!.base.window).toBe("R?");
    expect(stage.links.R).toContain("booking");
    expect(stage.effort.scales).toContain("sac");
    expect(stage.profile).toBe("hike");
  });
  it("a type takes its parent's effort scales unless it names its own", () => {
    expect(resolveNode("nature.trail.snowshoe_route", DEFAULT_TYPES)!.effort.scales).toEqual(["sac-wt"]);
    expect(resolveNode("nature.trail.hike", DEFAULT_TYPES)!.effort.scales).toContain("sac");
    expect(resolveNode("mountain.climb.bouldering", DEFAULT_TYPES)!.effort.scales).toEqual(["font", "v-scale"]);
    expect(resolveNode("mountain.climb.crag", DEFAULT_TYPES)!.effort.scales).toEqual(["yds-rock", "french", "uiaa"]);
    expect(resolveNode("water.boat.cruise", DEFAULT_TYPES)!.effort.scales).toEqual([]);
  });
  it("every effort scale is a grade system", () => {
    for (const n of DEFAULT_TYPES.nodes) for (const s of n.effort?.scales ?? []) expect(E.GRADE_SYSTEM as readonly string[], n.id).toContain(s);
  });
  it("a lift is a route with a ticket offer; the suitability block sits on the offer", () => {
    const lift = resolveNode("ride.lift.gondola", DEFAULT_TYPES)!;
    expect(lift.records).toEqual(["route", "offer"]);
    expect(lift.layers.offer!.offer_class).toBe("ticket");
    expect(lift.layers.offer!.carries_suitability).toBe(true);
    expect(lift.layers.route!.carries_suitability).toBe(false);
    expect(lift.layers.offer!.base.hours).toBe("R");
    expect(lift.layers.route!.base.hours).toBeUndefined();
  });
  it("offer classes change the base contract (3.3)", () => {
    const exp = resolveNode("air.zip.zipline", DEFAULT_TYPES)!.layers.offer!;
    const ticket = resolveNode("culture.museum.museum", DEFAULT_TYPES)!.layers.offer!;
    const access = resolveNode("access.pass.timed_entry", DEFAULT_TYPES)!.layers.offer!;
    const lodging = resolveNode("stay.room.hotel", DEFAULT_TYPES)!.layers.offer!;
    expect(exp.base.run_by).toBe("R");
    expect(exp.base.duration_min).toBe("R");
    expect(ticket.base.class_key).toBeUndefined(); // a ticket inherits its place's relevance
    expect(ticket.base.point).toBeUndefined(); // an offer has no point of its own (it uses the meeting place)
    expect(access.base.window).toBe("R");
    expect(access.base.photos).toBeUndefined();
    expect(lodging.base.check_in_out).toBe("R");
  });
  it("a place is not asked for route facts and a route is not asked for an operator", () => {
    const hike = resolveNode("nature.trail.hike", DEFAULT_TYPES)!.layers.route!;
    const museum = resolveNode("culture.museum.museum", DEFAULT_TYPES)!.layers.place!;
    expect(hike.base.geometry).toBe("R");
    expect(hike.base.starts_at).toBe("R");
    expect(hike.base.hours).toBeUndefined();
    expect(hike.base.run_by).toBeUndefined();
    expect(museum.base.geometry).toBeUndefined();
    expect(museum.base.reaches).toBeUndefined();
  });
  it("explain says where a mark comes from", () => {
    const text = explain(resolveNode("air.zip.zipline.kids_course", DEFAULT_TYPES)!).join("\n");
    expect(text).toContain("inherits: air > air.zip > air.zip.zipline > air.zip.zipline.kids_course");
    expect(text).toMatch(/adult_required\s+R\s+from air.zip.zipline.kids_course/);
    expect(text).toMatch(/min_age\s+R\s+from profile:zipline/);
  });
});

describe("the property registry (CC6)", () => {
  it("has unique keys and a definition for every suitability path", () => {
    expect(new Set(PROPERTIES.map((p) => p.key)).size).toBe(PROPERTIES.length);
    for (const p of APPLICABILITY_PATHS) expect(PROPERTY_BY_KEY.has(p), p).toBe(true);
    expect(UNKNOWN_SUIT_ROWS).toEqual([]);
  });
  it("every property names a section of the fixed 14, and every filter a control", () => {
    expect(E.CAP_SECTION).toHaveLength(14);
    for (const p of PROPERTIES) {
      expect(E.CAP_SECTION as readonly string[], p.key).toContain(p.section);
      expect(p.gap.length, p.key).toBeGreaterThan(0);
      if (p.filter) expect(["range", "enum", "bool"]).toContain(p.filter.control);
      if (p.base === "R?") expect(p.trigger, p.key).toBeTruthy();
    }
  });
  it("every filter scope is a node of the tree or an intent", () => {
    for (const p of PROPERTIES) for (const sc of p.filter?.scopes ?? []) expect(sc.startsWith("intent:") || treeOf(DEFAULT_TYPES).byId.has(sc), `${p.key} ${sc}`).toBe(true);
  });
  it("every mark in the tree names a property", () => {
    for (const n of DEFAULT_TYPES.nodes) for (const k of Object.keys(n.marks ?? {})) expect(PROPERTY_BY_KEY.has(k.replace(/^(place|route|offer|event)\./, "")), `${n.id} ${k}`).toBe(true);
    for (const rule of Object.values(DEFAULT_TYPES.layers)) for (const k of [...(rule.R ?? []), ...(rule.A ?? []), ...(rule.N ?? [])]) expect(PROPERTY_BY_KEY.has(k), k).toBe(true);
  });
  it("chainOf walks from the domain to the node", () => {
    expect(chainOf(tree, "water.paddle.kayak.sea_kayak").map((n) => n.id)).toEqual(["water", "water.paddle", "water.paddle.kayak", "water.paddle.kayak.sea_kayak"]);
    expect(chainOf(tree, "nope")).toEqual([]);
  });
});
