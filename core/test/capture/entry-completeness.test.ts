// PA-C (protected-area-entry 5.1 C7, C8, C11; 13): what the completeness engine asks of requirements and parks. Access offers are never
// asked for access_cost (the offer is the cost); `summary` is read from the capture record on offers and from relevance `why` elsewhere;
// a park with requirement offers has a firm access_cost; a system pass answers the offer layer's `at`. Also the registry rows (S7).
import { describe, expect, it } from "vitest";
import { completeness, readProperty } from "../../src/capture/engine.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { resolveNode } from "../../src/capture/resolve.ts";
import { homeOf, PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import { put } from "./helpers.ts";
import { D8R_OFFERS, MORAINE, PASS, PLACE_RECORDS, SOURCES, doc, parksRoot } from "./entry-helpers.ts";

const FEE = D8R_OFFERS[1] as Record<string, any>;
const world = (records: unknown[], rel: unknown[] = []) => {
  const r = parksRoot();
  put(r, "data/capture/fixture-trip/pa.json", doc(records));
  if (rel.length) put(r, "data/relevance/fixture-trip/r.json", { schema: "relevance/1", trip: "fixture-trip", lane: "r", researched: "2026-10-26", agent: "test", model: "none", sources: SOURCES, records: rel });
  return loadWorld(r);
};
const read = (w: ReturnType<typeof world>, key: string, ref: string) => readProperty(w, key, ref, w.cap.get(ref)!.rec, w.rel.get(ref)?.rec);

describe("marks (C8)", () => {
  it("an access.pass offer asks summary and entry, never access_cost; hours only on a timed entry; a lift pass's entry is optional", () => {
    for (const t of ["access.pass.entry_fee", "access.pass.park_pass", "access.pass.vehicle_permit", "access.pass.shuttle_seat", "access.pass.activity_permit"]) {
      const base = resolveNode(t)!.layers.offer!.base;
      expect(base.access_cost, t).toBeUndefined();
      expect(base.summary, t).toBe("R");
      expect(base.entry, t).toBe("R");
      expect(base.hours, t).toBe("A");
      expect(base.covered_by, t).toBe("A");
      expect(base.parks_for, t).toBeUndefined();
    }
    expect(resolveNode("access.pass.timed_entry")!.layers.offer!.base.hours).toBe("R?");
    expect(resolveNode("access.pass.lift_pass")!.layers.offer!.base.entry).toBe("A");
  });
  it("a protected area may list covers_areas and run_by (enrichment until the parks carry operators: PA-R-CA, PA-MUS)", () => {
    const base = resolveNode("nature.protected.national_park")!.layers.place!.base;
    expect(base.covers_areas).toBe("A");
    expect(base.run_by).toBe("A");
  });
  it("the class park/protected-area exists for nature.protected (C9)", () => {
    expect(resolveNode("nature.protected.national_park")!.relevance_class).toEqual(["park/*"]);
  });
});

describe("summary: one property, a home per layer (C1, C7)", () => {
  it("the registry gives offers a capture home and everyone else the relevance why", () => {
    const def = PROPERTY_BY_KEY.get("summary")!;
    expect(homeOf(def, "offer")).toEqual({ in: "capture", path: "summary" });
    expect(homeOf(def, "place")).toEqual({ in: "relevance", path: "why" });
    expect(homeOf(def, "route")).toEqual({ in: "relevance", path: "why" });
  });
  it("an access offer is answered by its capture summary and has no access_cost gap", () => {
    const w = world([...PLACE_RECORDS, FEE, { ...FEE, ref: "offer/place/banff-national-park#no-summary", summary: undefined, covered_by: undefined }]);
    expect(read(w, "summary", FEE.ref)).toBe("firm");
    expect(read(w, "summary", "offer/place/banff-national-park#no-summary")).toBe("gap");
    const c = completeness(w, FEE.ref)!;
    expect([...c.missingBase, ...c.conditionalMissing]).toEqual([]);
    expect(completeness(w, "offer/place/banff-national-park#no-summary")!.missingBase).toEqual(["summary"]);
  });
  it("a place reads its relevance why, and an offer with its own relevance record is answered by that why", () => {
    const ticket = { ...FEE, ref: "offer/place/lake-louise#ticket", type: "access.pass.lift_pass", at: ["place/lake-louise"], summary: undefined, covered_by: undefined };
    const w = world([...PLACE_RECORDS, ticket], [{ ref: "place/lake-louise", why: "A lake under a glacier." }, { ref: ticket.ref, why: "A gondola with a view." }]);
    expect(read(w, "summary", "place/lake-louise")).toBe("firm");
    expect(read(w, "summary", MORAINE)).toBe("gap");
    expect(read(w, "summary", ticket.ref)).toBe("firm");
  });
});

describe("access_cost on a protected area (C11)", () => {
  it("is firm when a requirement offer is at the park, a gap otherwise", () => {
    const w = world([...PLACE_RECORDS, FEE]);
    expect(read(w, "access_cost", "place/banff-national-park")).toBe("firm");
    expect(read(w, "access_cost", "place/yoho-national-park")).toBe("gap");
    // a lake is not a protected area: its access_cost stays its own (relevance)
    expect(read(w, "access_cost", "place/lake-louise")).toBe("gap");
  });
});

describe("the system pass answers the offer layer's at (QP1)", () => {
  it("once a fee names it in covered_by", () => {
    const pass = D8R_OFFERS[0]!;
    expect(read(world([...PLACE_RECORDS, pass, FEE]), "at", PASS)).toBe("firm");
    expect(read(world([...PLACE_RECORDS, pass]), "at", PASS)).toBe("gap");
  });
});

describe("registry value types (EG-R0 S7)", () => {
  it("variant_of is one ref; covers_areas holds area ids, not relation refs", () => {
    expect(PROPERTY_BY_KEY.get("variant_of")!.value).toBe("ref");
    expect(PROPERTY_BY_KEY.get("covers_areas")!.value).toBe("area_list");
    expect(PROPERTY_BY_KEY.get("run_by")!.value).toBe("ref");
  });
  it("entry is a registry property homed on the capture record, offers only, shown at rest", () => {
    const e = PROPERTY_BY_KEY.get("entry")!;
    expect(e.home).toEqual({ in: "capture", path: "entry" });
    expect(e.layers).toEqual(["offer"]);
    expect(e.display).toEqual(["rest!"]);
    expect(e.keep).toEqual(expect.arrayContaining(["check", "money"]));
  });
});
