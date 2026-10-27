// The placement pass (capture contract 2.7.2): facts and draw sit on the layer that causes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlacementFile } from "../../src/capture/placement.ts";
import { attractionReason } from "../../src/capture/placement.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { DEFAULT_TYPES } from "../../src/capture/tree.ts";
import { REPO } from "./helpers.ts";

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), "utf8")) as T;
const plan = read<PlacementFile>("data/capture/placement.json");
const w = loadWorld(REPO);

describe("placement of facts", () => {
  it("is applied once and lists what stays on the route, with the reason", () => {
    expect(plan.applied).toBe(true);
    expect(plan.review.length).toBeGreaterThan(40);
    for (const r of plan.review) expect(r.why.length, `${r.ref} ${r.field}`).toBeGreaterThan(5);
  });
  it("each moved fact is on its new place's suitability record and gone from the route", () => {
    let n = 0;
    for (const m of plan.field_moves) {
      const to = w.suit.get(m.to)!.rec.suitability as Record<string, unknown>;
      const from = w.suit.get(m.from)!.rec.suitability as Record<string, unknown>;
      for (const f of m.fields) {
        expect(to[f], `${m.to} ${f}`).toBeDefined();
        expect(from[f], `${m.from} ${f}`).toBeUndefined();
        n++;
      }
      expect(w.cap.get(m.to)!.rec.layer, m.to).toBe("place");
    }
    expect(n).toBe(20);
  });
  it("hazards and exposure met along the way stay on the route", () => {
    for (const m of plan.field_moves) expect(m.fields.every((f) => !["hazards", "exposure", "bail_out"].includes(f)), m.from).toBe(true);
  });
  it("a top station is an access place with a suitability record of its own, and the ticket keeps no altitude", () => {
    const tops = plan.field_moves.filter((m) => m.to.includes("#top"));
    expect(tops).toHaveLength(6);
    for (const m of tops) {
      const s = w.suit.get(m.to)!.rec;
      expect([s.kind, s.subkind]).toEqual(["access", "station"]);
      expect(w.cap.get(m.to)!.rec.type).toBe("access.transit.station");
    }
  });
  it("the duplicated access_season and altitude_m are gone from the Lagazuoi tunnels, kept verbatim in the file", () => {
    const t = w.suit.get("part/place/lagazuoi-cable-car-and-tunnels#tunnels")!.rec.suitability as Record<string, unknown>;
    expect(t.access_season).toBeUndefined();
    expect(t.altitude_m).toBeUndefined();
    expect(Object.keys(plan.removed_duplicates[0]!.fields).sort()).toEqual(["access_season", "altitude_m"]);
  });
});

describe("where draw lives", () => {
  it("five lifts' draw and class sit on their top stations; the Montenvers train keeps its own because the ride is the attraction", () => {
    expect(plan.draw_moves).toHaveLength(5);
    for (const m of plan.draw_moves) {
      expect(w.rel.has(m.to), m.to).toBe(true);
      expect(w.rel.has(m.from), m.from).toBe(false);
    }
    const mont = w.cap.get("trip/chamonix-mont-blanc-2028/lift:montenvers train")!.rec;
    expect(mont.route_is_attraction).toBe(true);
    expect(w.rel.has(mont.ref)).toBe(true);
  });
  it("every route that has a relevance record says why the route itself is the thing visited; Tre Cime reconciles with spec example 4", () => {
    const routes = [...w.cap.values()].map((x) => x.rec).filter((r) => r.layer === "route" && w.rel.has(r.ref));
    for (const r of routes) {
      expect(r.route_is_attraction, r.ref).toBe(true);
      expect(r.attraction_reason!.length, r.ref).toBeGreaterThan(20);
    }
    expect(w.cap.get("place/tre-cime-di-lavaredo-loop")!.rec.attraction_reason).toContain("example 4");
  });
  it("no route without a flag holds a relevance record; payoff places and tops hold the rest", () => {
    for (const x of w.cap.values()) if (x.rec.layer === "route" && !x.rec.route_is_attraction) expect(w.rel.has(x.rec.ref), x.rec.ref).toBe(false);
  });
  it("the reason follows the class", () => {
    expect(attractionReason("drive/scenic-parkway")).toContain("scenic drive");
    expect(attractionReason("trail/alpine-loop")).toContain("walk itself");
  });
});

describe("derive reads the right layer", () => {
  it("a route with no judgement reads draw from the place it reaches; a flagged route can be an anchor", () => {
    const d = read<{ items: { ref: string; layer?: string; draw_from?: string; role: string; effective_draw: string; route_is_attraction?: boolean }[] }>("data/relevance/derived/dolomites-2027.json").items;
    const sorapis = d.find((i) => i.ref === "place/lago-di-sorapis")!;
    expect(sorapis.layer).toBe("route");
    expect(sorapis.draw_from).toBe("part/place/lago-di-sorapis#payoff");
    const payoff = d.find((i) => i.ref === sorapis.draw_from)!;
    expect([sorapis.role, sorapis.effective_draw]).toEqual([payoff.role, payoff.effective_draw]);
    const tre = d.find((i) => i.ref === "place/tre-cime-di-lavaredo-loop")!;
    expect(tre.route_is_attraction).toBe(true);
    expect(tre.draw_from).toBeUndefined();
    expect(["anchor", "highlight", "filler", "local_only"]).toContain(tre.role);
  });
});

describe("the new profiles wait for the design reviewer", () => {
  it("all ten are marked review: design, with the verifier's fixes", () => {
    const names = ["river", "motor_water", "dive", "surf", "climb", "canyoning", "play", "theme_park", "access", "amenity"];
    for (const n of names) expect(DEFAULT_TYPES.profiles[n]!.review, n).toBe("design");
    const P = DEFAULT_TYPES.profiles;
    expect(P.play!.operated).toBe("flag");
    expect([P.play!.fields.min_age, P.play!.fields.adult_required]).toEqual(["op", "op"]);
    expect(P.climb!.fields["effort.drivers.gain_m"]).toBe("A");
    expect([P.canyoning!.fields.bail_out, P.canyoning!.fields.adult_time_min, P.canyoning!.fields.on_site_min]).toEqual(["A", "A", "R"]);
    expect([P.motor_water!.fields.min_weight_kg, P.motor_water!.fields.max_weight_kg, P.motor_water!.fields["water_safety.swim_ability"]]).toEqual(["A", "A", "A"]);
    expect([P.dive!.fields["water_safety.current_or_tide"], P.surf!.fields["water_safety.current_or_tide"]]).toEqual(["A", "A"]);
    expect(P.access!.fields.wheelchair).toBe("A");
  });
});

describe("the other fixes", () => {
  it("Kicking Horse is one offer per operator on its river, each with run_by; the family float keeps the variants", () => {
    const kh = "legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float";
    const kids = [...w.cap.values()].map((x) => x.rec).filter((r) => r.variant_of === kh);
    expect(kids.map((k) => k.run_by).sort()).toEqual(["operator/hydra-river-guides", "operator/wild-water-adventures"]);
    // EG-D (entity-graph 11.2): an offer on a river place is at it; on is for routes
    for (const k of kids) expect([k.at, k.on]).toEqual([[w.cap.get(kh)!.rec.at![0]], undefined]);
    expect(w.cap.get(kh)!.rec.run_by).toBeUndefined();
  });
  it("Hielo y Aventura points at its public page, not the API", () => {
    expect(w.operators.get("operator/hielo-y-aventura-s-a")!.derived_from![0]!.url).toBe("https://hieloyaventura.com/excursiones/minitrekking");
  });
  it("the research backlog names the missing places and relations", () => {
    const t = readFileSync(join(REPO, "research/backlog.md"), "utf8");
    for (const w of ["Sulphur Mountain", "Tre Cime", "Rockpile", "shuttle stop", "Larch Valley"]) expect(t, w).toContain(w);
  });
});
