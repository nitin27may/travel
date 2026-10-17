import { describe, expect, it } from "vitest";
import { MATCH, matchRecord, placeRows } from "../../src/catalog/match.ts";
import { loadLocations, similarity } from "../../src/catalog/common.ts";
import { newStore } from "./util.ts";

const rec = (entity: string, row: Record<string, any>, match: Record<string, any> = {}) => ({ entity: entity as any, id: row.id ?? null, row, match });
/** metres north of a latitude */
const north = (lat: number, m: number): number => lat + m / 111195;

const mirador = { id: "AR/santa-cruz/el-chalten/mirador-de-los-condores", name: "Mirador de los Condores", lat: -49.3312, lon: -72.8869 };

describe("places, stays and eateries: coordinates plus trigram name similarity", () => {
  it("a deliberately duplicated place 120 m away with the same name is the same entity", async () => {
    const places = placeRows((await loadLocations(newStore())).places);
    const m = matchRecord(rec("places", { name: "Mirador de los Condores", lat: north(-49.3312, 120), lon: -72.8869 }), places);
    expect(m.kind).toBe("same");
    expect(m.id).toBe(mirador.id);
    expect(m.by).toBe("geo+name");
    expect(m.distance_m).toBeGreaterThan(100);
    expect(m.distance_m).toBeLessThan(140);
  });

  it("ignores accents and punctuation in the name", () => {
    const existing = [{ id: "s1", name: "Hosteria El Pilar", lat: -49.27, lon: -72.91 }];
    expect(matchRecord(rec("stays", { name: "Hostería El Pilar!", lat: -49.27, lon: -72.91 }), existing).kind).toBe("same");
  });

  it("'Mirador' against 'Mirador Fitz Roy' 2 km apart is not merged", () => {
    expect(similarity("Mirador", "Mirador Fitz Roy")).toBeLessThan(MATCH.possible_similarity);
    const existing = [{ id: "p1", name: "Mirador Fitz Roy", lat: north(-49.33, 2000), lon: -72.88 }];
    const m = matchRecord(rec("places", { name: "Mirador", lat: -49.33, lon: -72.88 }), existing);
    expect(m.kind).toBe("new");
    expect(m.candidates).toEqual([]);
  });

  it("a similarity of 0.83 is a possible duplicate, never the same entity", () => {
    expect(similarity("Hosteria Pilar", "Hosteria El Pilar")).toBeGreaterThan(0.6);
    expect(similarity("Hosteria Pilar", "Hosteria El Pilar")).toBeLessThan(0.85);
    const existing = [{ id: "s1", name: "Hosteria El Pilar", lat: -49.27, lon: -72.91 }];
    const m = matchRecord(rec("stays", { name: "Hosteria Pilar", lat: north(-49.27, 200), lon: -72.91 }), existing);
    expect(m.kind).toBe("possible");
    expect(m.id).toBe("s1");
    expect(m.similarity).toBeGreaterThanOrEqual(0.6);
  });

  it("the same name beyond 300 m is a possible duplicate, beyond 1 km it is new", () => {
    const existing = [{ id: "s1", name: "Hosteria El Pilar", lat: -49.27, lon: -72.91 }];
    expect(matchRecord(rec("stays", { name: "Hosteria El Pilar", lat: north(-49.27, 600), lon: -72.91 }), existing).kind).toBe("possible");
    expect(matchRecord(rec("stays", { name: "Hosteria El Pilar", lat: north(-49.27, 5000), lon: -72.91 }), existing).kind).toBe("new");
  });

  it("a row without coordinates matches only by id or external id", () => {
    const existing = [{ id: "s1", name: "Hosteria El Pilar", lat: null, lon: null }];
    expect(matchRecord(rec("stays", { name: "Hosteria El Pilar", lat: -49.27, lon: -72.91 }), existing).kind).toBe("new");
    expect(matchRecord(rec("stays", { id: "s1", name: "Anything" }), existing)).toMatchObject({ kind: "same", by: "id" });
  });

  it("picks the closest of several candidates", () => {
    const existing = [
      { id: "far", name: "Hosteria El Pilar", lat: north(-49.27, 250), lon: -72.91 },
      { id: "near", name: "Hosteria El Pilar", lat: north(-49.27, 30), lon: -72.91 },
    ];
    const m = matchRecord(rec("stays", { name: "Hosteria El Pilar", lat: -49.27, lon: -72.91 }), existing);
    expect(m.id).toBe("near");
    expect(m.candidates.map((c) => c.id)).toEqual(["near", "far"]);
  });
});

describe("exact id and external ids", () => {
  it("matches an id absorbed by an earlier merge", () => {
    const existing = [{ id: "keep", name: "A", merged_from: ["old-id"] }];
    expect(matchRecord(rec("trails", { id: "old-id", name: "Z" }), existing)).toMatchObject({ kind: "same", id: "keep", by: "merged-id" });
  });

  it("matches a wikidata id, an OSM relation and an operator URL by host and path", () => {
    const existing = [
      { id: "w", name: "Q", field_meta: { external: { wikidata: "Q1367398" } } },
      { id: "t", name: "R", geometry_source: "osm", geometry_source_id: "4485261" },
      { id: "o", name: "S", book_url: "https://www.example.org/tours/icewalk/" },
    ];
    expect(matchRecord(rec("stays", { name: "Other name" }, { wikidata: "Q1367398" }), existing)).toMatchObject({ id: "w", by: "wikidata" });
    expect(matchRecord(rec("trails", { name: "Other name" }, { osm_relation: 4485261 }), existing)).toMatchObject({ id: "t", by: "osm_relation" });
    expect(matchRecord(rec("activities", { name: "Other", book_url: "http://example.org/tours/icewalk?utm=1#top" }), existing)).toMatchObject({ id: "o", by: "book_url" });
    expect(matchRecord(rec("activities", { name: "Other", book_url: "https://example.org/tours/other" }), existing).kind).toBe("new");
  });
});

describe("trails and offers", () => {
  const trail = { id: "t1", name: "Laguna de los Tres", trailhead_lat: -49.3335, trailhead_lon: -72.8858 };
  it("a trailhead within 500 m and the same name is the same trail; 600 m is a possible duplicate", () => {
    expect(matchRecord(rec("trails", { name: "Laguna de los Tres", trailhead_lat: north(-49.3335, 400), trailhead_lon: -72.8858 }), [trail]).kind).toBe("same");
    expect(matchRecord(rec("trails", { name: "Laguna de los Tres", trailhead_lat: north(-49.3335, 600), trailhead_lon: -72.8858 }), [trail]).kind).toBe("possible");
    expect(matchRecord(rec("trails", { name: "Laguna Torre", trailhead_lat: -49.3335, trailhead_lon: -72.8858 }), [trail]).kind).toBe("new");
  });

  const offer = { id: "of-x-banff-gondola", provider: "Banff Jasper Collection", name: "Banff Gondola" };
  it("provider plus product name: equal is the same, 0.67 similar is possible, another provider is new", () => {
    expect(matchRecord(rec("offers", { name: "Banff Gondola", provider: "Banff Jasper Collection" }, { provider: "Banff Jasper Collection", product: "Banff Gondola" }), [offer]).kind).toBe("same");
    const p = matchRecord(rec("offers", { name: "Banff Gondola Ticket", provider: "Banff Jasper Collection" }, { provider: "Banff Jasper Collection", product: "Banff Gondola Ticket" }), [offer]);
    expect(p.kind).toBe("possible");
    expect(p.by).toBe("provider+product");
    expect(matchRecord(rec("offers", { name: "Banff Gondola", provider: "Someone Else" }, { provider: "Someone Else", product: "Banff Gondola" }), [offer]).kind).toBe("new");
  });
});
