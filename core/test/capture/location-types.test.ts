// LT-C (docs/v2/features/location-type-requirements.md 5, 6, 9.1): the address property, osm_ref as a Val, per-kind link tier keys, the
// point_to_point and gpx_offered triggers, the research families and the ratchet gate, all gap-neutral when they land.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completeness, evalTrigger, linkKey, linkTierKinds, readLink } from "../../src/capture/engine.ts";
import { budgetCounts, loadBudget, TIER_KEYS_COUNT } from "../../src/capture/gapBudget.ts";
import { gapsCommand, tierReport } from "../../src/capture/gapsCli.ts";
import { generate } from "../../src/capture/generate.ts";
import { loadPlacement } from "../../src/capture/placementBlock.ts";
import { promoteFile, promotion, PromoteError } from "../../src/capture/promote.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { resolveNode } from "../../src/capture/resolve.ts";
import { recordTier } from "../../src/capture/tiers.ts";
import { categoriesOfFamily, checkTree, DEFAULT_TYPES, familyOf, loadTypes, treeOf } from "../../src/capture/tree.ts";
import { TRIGGERS } from "../../src/capture/triggers.ts";
import { PROPERTIES, PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import { address, capRecord, osmRefOf } from "../../src/schema/capture/records.ts";
import type { CaptureRecord } from "../../src/schema/capture/records.ts";
import { CAP_FAMILY } from "../../src/schema/capture/typesFile.ts";
import type { TypesFile } from "../../src/schema/capture/typesFile.ts";
import { validateDoc } from "../../src/validate/index.ts";
import { REPO, capDoc, scope, scratchRoot } from "./helpers.ts";

const types = (): TypesFile => JSON.parse(readFileSync(join(REPO, "data/vocab/types.json"), "utf8")) as TypesFile;
const postal = { kind: "postal", lines: ["111 Lake Louise Dr"], locality: "Lake Louise", postcode: "T0L 1E0" };
const valOf = (v: unknown) => ({ v, state: "value", basis: "official_info", src: ["src-0001"], read: "2026-10-28" });
const none = (tried = ["operator page", "Wikidata P6375"]) => ({ v: null, state: "searched_none", basis: null, src: [], on: "2026-10-28", tried });
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies", ...over });

describe("the address value (5.1)", () => {
  it("parses a postal and a nearest-road address, and a dated searched_none inside the Val", () => {
    expect(address.safeParse(postal).success).toBe(true);
    expect(address.safeParse({ kind: "nearest_road", lines: ["Highway 1A"], locality: "Lake Louise", postcode: null }).success).toBe(true);
    expect(capRecord.safeParse(lake({ address: valOf(postal) })).success).toBe(true);
    expect(capRecord.safeParse(lake({ address: none() })).success).toBe(true);
  });
  it("refuses no line, four lines, a country or region field, an unknown kind and a long postcode", () => {
    for (const bad of [{ ...postal, lines: [] }, { ...postal, lines: ["a", "b", "c", "d"] }, { ...postal, country: "CA" }, { ...postal, region: "AB" }, { ...postal, kind: "geocoded" }, { ...postal, postcode: "x".repeat(17) }, { ...postal, lines: [""] }]) {
      expect(address.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it("the validator holds a searched_none address to its date and what was tried, and warns where the type never asks it", () => {
    const r = scratchRoot({ "data/suitability/scope.json": scope(["lago-di-braies"]) });
    const run = (rec: unknown) => validateDoc(capDoc([rec]), "sidecar", r, { kind: "capture" as never });
    const codes = (x: { errors: { code: string }[] }) => [...new Set(x.errors.map((e) => e.code))];
    const ok = run(lake({ address: none() }));
    expect(codes(ok), JSON.stringify(ok.errors.slice(0, 3))).toEqual([]);
    expect(codes(run(lake({ address: { v: null, state: "searched_none", basis: null, src: [] } })))).toContain("E_CAP_SCHEMA");
    const town = run({ ref: "place/lago-di-braies", type: "settlement.town", layer: "place", name: "Braies", address: valOf(postal) });
    expect(town.warnings.some((w) => w.code === "W_CAP_NA_FIELD" && w.path.endsWith("/address"))).toBe(true);
  });
});

describe("osm_ref as a bare id or a Val (5.2)", () => {
  it("both forms parse, so the ledger's old bare ids stay valid and searched_none is storable", () => {
    expect(capRecord.safeParse(lake({ osm_ref: "relation/123" })).success).toBe(true);
    expect(capRecord.safeParse(lake({ osm_ref: valOf("way/42") })).success).toBe(true);
    expect(capRecord.safeParse(lake({ osm_ref: none(["Overpass by name near the point"]) })).success).toBe(true);
    expect(capRecord.safeParse(lake({ osm_ref: "relation/abc" })).success).toBe(false);
    expect(capRecord.safeParse(lake({ osm_ref: valOf("area/1") })).success).toBe(false);
  });
  it("osmRefOf reads both forms; a searched_none is no element", () => {
    expect(osmRefOf({ osm_ref: "node/1" })).toBe("node/1");
    expect(osmRefOf({ osm_ref: valOf("relation/9") })).toBe("relation/9");
    expect(osmRefOf({ osm_ref: none() })).toBeNull();
    expect(osmRefOf({})).toBeNull();
  });
  it("every stored osm_ref still parses and reads (the migration ledger pins the old values)", () => {
    const w = loadWorld(REPO);
    let n = 0;
    for (const { rec } of w.cap.values()) {
      if (rec.osm_ref === undefined) continue;
      // a dated searched_none (contract since LT-C) is no element; it reads as null and has no id to check
      const o = rec.osm_ref as unknown;
      if (typeof o === "object" && o !== null && (o as { state?: string }).state !== "value") {
        expect(osmRefOf(rec), rec.ref).toBeNull();
        continue;
      }
      n++;
      expect(osmRefOf(rec), rec.ref).toMatch(/^(node|way|relation)\/\d+$/);
    }
    expect(n).toBeGreaterThan(0);
  });
});

describe("the registry row (5.1)", () => {
  const a = PROPERTY_BY_KEY.get("address")!;
  it("identity group, object, N in the base, place layer only, lanes O F D, home on the capture record", () => {
    expect({ group: a.group, value: a.value, base: a.base, layers: a.layers, lanes: a.lanes, home: a.home, section: a.section, display: a.display }).toEqual({
      group: "identity", value: "object", base: "N", layers: ["place"], lanes: ["O", "F", "D"], home: { in: "capture", path: "address" }, section: "access", display: ["rest"],
    });
  });
  it("exposure: page rest, trip day, print, csv and the ICS override, api detail, public mcp, never a list row (P8)", () => {
    expect(a.expose).toEqual({ page: "rest", trip: ["day"], list: [], export: ["print", "csv", "ics"], api: "detail", mcp: "public" });
    expect(a.privacy).toBe("public");
    // the ICS override is address's alone: public trips are dateless
    expect(PROPERTIES.filter((p) => p.expose.export.includes("ics")).map((p) => p.key)).toEqual(["address"]);
  });
  it("is drawn by the page since LT-M: the public contract carries its marks, the research checklist keeps them, no pageTask waits", () => {
    expect(a.pageTask).toBeUndefined();
    const out = generate(DEFAULT_TYPES, REPO);
    const domains = out.filter((o) => /^data\/schema\/capture\/[a-z]+\.json$/.test(o.path) && !o.path.endsWith("contract.json"));
    expect(domains.length).toBeGreaterThan(10);
    expect(domains.filter((d) => d.text.includes('"address"')).map((d) => d.path.split("/").pop()).sort()).toEqual(["access.json", "animals.json", "culture.json", "food.json", "nature.json", "play.json", "snow.json", "stay.json", "water.json"]);
    expect(out.find((o) => o.path === "research/types/culture.md")!.text).toContain("address");
  });
  it("the two new triggers are named, and sit on ends_at and gpx_licence (no mark names them yet)", () => {
    expect(TRIGGERS).toContain("point_to_point");
    expect(TRIGGERS).toContain("gpx_offered");
    expect(PROPERTY_BY_KEY.get("ends_at")!.trigger).toBe("point_to_point");
    expect(PROPERTY_BY_KEY.get("gpx_licence")!.trigger).toBe("gpx_offered");
    expect(PROPERTY_BY_KEY.get("ends_at")!.base).toBe("N");
    expect(PROPERTY_BY_KEY.get("gpx_licence")!.base).toBe("N");
  });
});

describe("phase-1 marks (5.3)", () => {
  const markOf = (id: string, layer: "place" | "route" | "offer"): string => resolveNode(id, DEFAULT_TYPES)?.layers[layer]?.base.address ?? "N";
  it("A on door places, access points and natural places; N on towns and on every offer, route and event; nothing R", () => {
    for (const id of ["culture.museum.museum", "culture.heritage.castle_fort", "animals.see.zoo", "water.thermal.hot_spring", "stay.room.hotel", "stay.camp.campground", "food.eat.restaurant", "access.park.parking", "access.start.trailhead", "access.transit.shuttle_stop", "nature.protected.national_park", "water.body.lake", "water.falls.waterfall", "nature.viewpoint.viewpoint", "play.playground.playground", "snow.ski.ski_area"]) {
      expect(markOf(id, "place"), id).toBe("A");
    }
    expect(markOf("settlement.town", "place")).toBe("N");
    expect(markOf("culture.museum.museum", "offer")).toBe("N");
    expect(markOf("nature.trail.hike", "route")).toBe("N");
    for (const n of DEFAULT_TYPES.nodes) for (const [k, m] of Object.entries(n.marks ?? {})) if (k.endsWith("address")) expect(m === "A" || m === "N", n.id).toBe(true);
  });
  it("the per-kind link keys add nothing at landing (D4): the one type with a required kind but official has no record", () => {
    const extra = DEFAULT_TYPES.nodes.map((n) => [n.id, linkTierKinds(resolveNode(n.id, DEFAULT_TYPES)!)] as const).filter(([, k]) => k.length > 0);
    // a hut stage asks for its booking page (types.json links.R); the spec's "every links.R is official" holds for every type in use
    expect(extra).toEqual([["nature.trek.trek_stage.hut_stage", ["booking"]]]);
    const used = new Set([...loadWorld(REPO).cap.values()].map((x) => x.rec.type));
    for (const [id] of extra) expect(used.has(id), id).toBe(false);
  });
  it("gap-neutral: the required tier of every record is the same without the LT-C marks, and W_TIER_REQUIRED.keys equals the budget", () => {
    const before = types();
    for (const n of before.nodes) {
      delete n.family;
      if (n.marks) delete n.marks.address;
    }
    const after = loadTypes(REPO);
    const w = loadWorld(REPO);
    let keys = 0;
    for (const ref of w.cap.keys()) {
      const a = recordTier(w, ref, after), b = recordTier(w, ref, before);
      expect([...(a?.required ?? [])].sort(), ref).toEqual([...(b?.required ?? [])].sort());
      expect([...(a?.requiredMissing ?? [])].sort(), ref).toEqual([...(b?.requiredMissing ?? [])].sort());
      expect(completeness(w, ref, after)?.level, ref).toBe(completeness(w, ref, before)?.level);
      keys += a?.requiredMissing.length ?? 0;
    }
    const counts = budgetCounts(loadPlacement(REPO, w));
    expect(counts[TIER_KEYS_COUNT]).toBe(keys);
    expect(counts[TIER_KEYS_COUNT]).toBeLessThanOrEqual(loadBudget(REPO)!.counts[TIER_KEYS_COUNT]!);
  });
});

describe("per-kind link keys (D4)", () => {
  const cap = (links: CaptureRecord["links"]): Pick<CaptureRecord, "links"> => ({ links });
  it("readLink: filled is firm, found_in_search firm for a link-only kind and soft otherwise, searched_none soft, none a gap", () => {
    expect(readLink(cap([{ kind: "alltrails", state: "filled", url: "https://www.alltrails.com/trail/x" }]), "alltrails")).toBe("firm");
    expect(readLink(cap([{ kind: "alltrails", state: "found_in_search", on: "2026-10-28", query: "larch valley" }]), "alltrails")).toBe("firm");
    expect(readLink(cap([{ kind: "official", state: "found_in_search" }]), "official")).toBe("soft");
    expect(readLink(cap([{ kind: "alltrails", state: "searched_none", on: "2026-10-28" }]), "alltrails")).toBe("soft");
    expect(readLink(cap([{ kind: "official", state: "filled" }]), "alltrails")).toBe("gap");
    expect(linkKey("alltrails")).toBe("links.alltrails");
  });
  it("a kind in links.R becomes its own required key, answered by a found_in_search or a dated searched_none", () => {
    const file = promoteFile(types(), "links.alltrails", "trail");
    const trail = (links: unknown[]) => scratchRoot({
      "data/vocab/types.json": file,
      "data/suitability/scope.json": scope(["larch-valley"]),
      "data/capture/fixture-trip/a.json": capDoc([{ ref: "place/larch-valley", type: "nature.trail.hike", layer: "route", name: "Larch Valley", links }]),
    });
    const tierOf = (links: unknown[]) => {
      const r = trail(links);
      return recordTier(loadWorld(r), "place/larch-valley", loadTypes(r))!;
    };
    expect(tierOf([]).required).toContain("links.alltrails");
    expect(tierOf([]).requiredMissing).toContain("links.alltrails");
    expect(tierOf([{ kind: "alltrails", state: "found_in_search", on: "2026-10-28" }]).requiredMissing).not.toContain("links.alltrails");
    expect(tierOf([{ kind: "alltrails", state: "searched_none", on: "2026-10-28" }]).requiredMissing).not.toContain("links.alltrails");
    // the official link keeps its own key: an AllTrails link never answers it
    expect(tierOf([{ kind: "alltrails", state: "filled", url: "https://www.alltrails.com/trail/x" }]).requiredMissing).toContain("links");
  });
});

describe("the triggers point_to_point and gpx_offered (4.1)", () => {
  const world = (rec: Record<string, unknown>, shape?: string) => {
    const r = scratchRoot({
      "data/suitability/scope.json": scope(["larch-valley"]),
      "data/capture/fixture-trip/a.json": capDoc([{ ref: "place/larch-valley", type: "nature.trail.hike", layer: "route", name: "Larch Valley", ...rec }]),
      ...(shape ? { "data/suitability/fixture-trip/R1.json": { schema: "suitability/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", agent: "t", model: "t", sources: [], records: [{ ref: "place/larch-valley", kind: "trail", subkind: "hike", suitability: {}, ext: { kind: "trail", shape } }] } } : {}),
    });
    const w = loadWorld(r);
    const cap = w.cap.get("place/larch-valley")!.rec;
    const node = resolveNode(cap.type, loadTypes(r))!;
    return (t: string) => evalTrigger(w, t, cap.ref, node, cap.layer, cap, w.suit.get(cap.ref)?.rec, w.rel.get(cap.ref)?.rec);
  };
  it("point_to_point: the shape decides; else distinct start and end records; else unknown", () => {
    expect(world({}, "point-to-point")("point_to_point")).toBe(true);
    expect(world({ starts_at: ["a"], ends_at: ["b"] }, "loop")("point_to_point")).toBe(false);
    expect(world({ starts_at: ["a"], ends_at: ["b"] })("point_to_point")).toBe(true);
    expect(world({ starts_at: ["a"], ends_at: ["a"] })("point_to_point")).toBe(false);
    expect(world({})("point_to_point")).toBeNull();
  });
  it("gpx_offered: a filled gpx_download link; a searched_none one says no; none is unknown", () => {
    expect(world({ links: [{ kind: "gpx_download", state: "filled", url: "https://parks.example/x.gpx" }] })("gpx_offered")).toBe(true);
    expect(world({ links: [{ kind: "gpx_download", state: "searched_none", on: "2026-10-28" }] })("gpx_offered")).toBe(false);
    expect(world({})("gpx_offered")).toBeNull();
  });
});

describe("families (D1, 5.2)", () => {
  const tree = treeOf(DEFAULT_TYPES);
  it("every one of the 61 categories carries one of the nine families, and only categories do", () => {
    const cats = DEFAULT_TYPES.nodes.filter((n) => n.level === "category" || (n.level === "domain" && n.category));
    expect(cats.length).toBe(61);
    for (const c of cats) expect(CAP_FAMILY as readonly string[], c.id).toContain(c.family);
    for (const n of DEFAULT_TYPES.nodes) if (!cats.includes(n)) expect(n.family, n.id).toBeUndefined();
    expect(new Set(cats.map((c) => c.family))).toEqual(new Set(CAP_FAMILY));
  });
  it("a type's family is its category's: trail, park, sight, stay, eat, activity, access, event, town", () => {
    expect(familyOf(tree, "nature.trail.hike")).toBe("trail");
    expect(familyOf(tree, "nature.protected.national_park")).toBe("park");
    expect(familyOf(tree, "culture.museum.museum")).toBe("sight");
    expect(familyOf(tree, "stay.mountain.hut")).toBe("stay");
    expect(familyOf(tree, "food.eat.restaurant")).toBe("eat");
    expect(familyOf(tree, "water.boat.boat_tour")).toBe("activity");
    expect(familyOf(tree, "access.park.parking")).toBe("access");
    expect(familyOf(tree, "event.festival")).toBe("event");
    expect(familyOf(tree, "settlement.town")).toBe("town");
    expect(categoriesOfFamily(DEFAULT_TYPES, "stay")).toEqual(["stay.room", "stay.self", "stay.mountain", "stay.camp"]);
  });
  it("a planted category without a family fails the tree check, and so does a family on a type", () => {
    const env = { propertyKeys: new Set(PROPERTIES.map((p) => p.key)) };
    expect(checkTree(DEFAULT_TYPES, env)).toEqual([]);
    const noFamily = types();
    delete noFamily.nodes.find((n) => n.id === "food.eat")!.family;
    expect(checkTree(noFamily, env).map((i) => i.id)).toEqual(["food.eat"]);
    const onType = types();
    onType.nodes.find((n) => n.id === "food.eat.cafe")!.family = "eat";
    expect(checkTree(onType, env).map((i) => i.id)).toEqual(["food.eat.cafe"]);
    const r = validateDoc(noFamily, "sidecar", REPO, { kind: "capture-types" as never });
    expect(r.errors.map((e) => e.code)).toContain("E_CAP_TREE");
  });
  it("gaps --family is the tier report of the family's records only", () => {
    const rep = tierReport(REPO, "required", { family: "park" });
    expect(rep.categories).toEqual(["nature.protected", "nature.garden", "access.pass"]);
    expect(rep.records.every((r) => familyOf(tree, r.type) === "park")).toBe(true);
    const all = tierReport(REPO, "required", {});
    const parks = all.records.filter((r) => familyOf(tree, r.type) === "park");
    expect(rep.records.map((r) => r.ref).sort()).toEqual(parks.map((r) => r.ref).sort());
  });
});

describe("the ratchet gate: gaps --promote (5.4)", () => {
  // LT-2 (28 Oct 2026) answered address on every stay record, so the real-data case moved to the access points, which still lack many
  it("promoting address on access counts the access points without one and fails", () => {
    const p = promotion(loadWorld(REPO), loadTypes(REPO), "address", "access");
    expect(p.ok).toBe(false);
    expect(p.keysAdded).toBeGreaterThan(0);
    expect(p.keysAdded).toBe(p.rows.length);
    expect(p.rows.every((r) => r.type.startsWith("access.") && r.layer === "place" && r.added.join() === "address")).toBe(true);
    expect(p.budget.keys.promoted - p.budget.keys.now).toBe(p.keysAdded);
    const lines: string[] = [];
    expect(gapsCommand(["gaps", "--promote", "address", "--family", "access"], REPO, (s) => void lines.push(s), () => undefined)).toBe(1);
    expect(lines.at(-1)).toMatch(/^BLOCKED: the promotion would add \d+ unanswered required key/);
  });
  it("a promotion whose records are all answered passes (exit 0); the simulation never edits the file it reads", () => {
    const r = scratchRoot({
      "data/suitability/scope.json": scope(["hotel-a"]),
      "data/capture/fixture-trip/a.json": capDoc([{ ref: "place/hotel-a", type: "stay.room.hotel", layer: "place", name: "Hotel A", address: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-28", tried: ["operator page"] } }]),
    });
    const file = loadTypes(r);
    const copy = JSON.stringify(file);
    const p = promotion(loadWorld(r), file, "address", "stay");
    expect(p).toMatchObject({ ok: true, keysAdded: 0, records: 1 });
    expect(JSON.stringify(file)).toBe(copy);
    expect(gapsCommand(["gaps", "--promote", "address", "--family", "stay"], r, () => undefined, () => undefined)).toBe(0);
  });
  it("raises the A marks below the categories, layer-qualified ones too, and leaves an N alone", () => {
    const f = promoteFile(types(), "run_by", "park");
    const protectedNode = f.nodes.find((n) => n.id === "nature.protected")!;
    expect(protectedNode.marks!.run_by).toBe("R");
    expect(protectedNode.marks!["place.run_by"]).toBe("R");
    expect(resolveNode("nature.protected.national_park", f)!.layers.place!.base.run_by).toBe("R");
    const s = promoteFile(types(), "address", "town");
    expect(resolveNode("settlement.town", s)!.layers.place!.base.address).toBe("R");
  });
  it("a link kind moves into links.R of the family's categories only", () => {
    const f = promoteFile(types(), "links.alltrails", "trail");
    expect(resolveNode("nature.trail.hike", f)!.links.R).toEqual(["official", "alltrails"]);
    expect(resolveNode("nature.trail.hike", f)!.links.A).not.toContain("alltrails");
    expect(resolveNode("culture.museum.museum", f)!.links.R).toEqual(["official"]);
  });
  it("refuses an unknown family, an unknown key, official and an R? suitability path", () => {
    expect(() => promoteFile(types(), "address", "parks")).toThrow(PromoteError);
    expect(() => promoteFile(types(), "street", "stay")).toThrow(PromoteError);
    expect(() => promoteFile(types(), "links.official", "stay")).toThrow(PromoteError);
    expect(() => promoteFile(types(), "links.nope", "stay")).toThrow(PromoteError);
    expect(() => promoteFile(types(), "wheelchair", "stay", "R?")).toThrow(PromoteError);
    expect(gapsCommand(["gaps", "--promote", "address"], REPO, () => undefined, () => undefined)).toBe(2);
    expect(gapsCommand(["gaps", "--promote", "address", "--family", "parks"], REPO, () => undefined, () => undefined)).toBe(2);
  });
});
