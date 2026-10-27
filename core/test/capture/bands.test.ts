// bandsOf (capture contract 7.3): a trail, a lift read through its ticket offer, a raft offer, a lake and a sight with no hours.
import { describe, expect, it } from "vitest";
import { bandsOf, bookingOf, priceBandOf, timeBandOf, walkBandOf } from "../../src/capture/bands.ts";
import { BAND_KEYS, MAX_FLAGS, NO_BANDS } from "../../src/capture/bandKeys.ts";
import { emptyIncoming } from "../../src/capture/records.ts";
import type { Incoming, World } from "../../src/capture/records.ts";
import type { CaptureRecord } from "../../src/schema/capture/records.ts";
import type { SuitabilityRecord } from "../../src/schema/suitability.ts";
import { sg, v, walk } from "../suitability/helpers.ts";

const noInc = (): Incoming => emptyIncoming();
const cv = <T>(x: T) => ({ v: x, state: "value" as const, basis: "operator_rule" as const, src: ["src-0001"] });

function world(caps: CaptureRecord[], suits: SuitabilityRecord[]): World {
  const cap = new Map(caps.map((r) => [r.ref, { rec: r, trip: "t", file: "" }]));
  const suit = new Map(suits.map((r) => [r.ref, { rec: r, trip: "t", file: "" }]));
  const incoming = new Map<string, Incoming>();
  for (const r of caps) {
    for (const t of r.at ?? []) incoming.set(t, { ...(incoming.get(t) ?? noInc()), at: [...(incoming.get(t)?.at ?? []), r.ref] });
    for (const t of r.on ?? []) incoming.set(t.ref, { ...(incoming.get(t.ref) ?? noInc()), on: [...(incoming.get(t.ref)?.on ?? []), r.ref] });
  }
  return { root: "", cap, suit, rel: new Map(), points: {}, operators: new Map(), alias: new Map(), incoming, trips: new Map() };
}

describe("band edges", () => {
  it("time", () => {
    expect([30, 60, 119, 120, 240, 241, 420, 421, 720, 721].map(timeBandOf)).toEqual(["<1h", "1-2h", "1-2h", "2-4h", "2-4h", "half-day", "half-day", "full-day", "full-day", "multi-day"]);
  });
  it("price: free is zero, an unknown currency is no band", () => {
    expect(priceBandOf(0, "CAD")).toBe("free");
    expect(priceBandOf(10, "CAD")).toBe("$");
    expect(priceBandOf(25, "CAD")).toBe("$");
    expect(priceBandOf(26, "CAD")).toBe("$$");
    expect(priceBandOf(200, "CAD")).toBe("$$$");
    expect(priceBandOf(10, "XXX")).toBeNull();
    expect(priceBandOf(0, "XXX")).toBe("free");
  });
  it("booking", () => {
    expect(bookingOf({ rule: "on_arrival" })).toBe("none");
    expect(bookingOf({ rule: "rolling", sellout: { kind: "never" } })).toBe("recommended");
    expect(bookingOf({ rule: "rolling", sellout: { kind: "weeks" } })).toBe("required");
    expect(bookingOf({ rule: "lottery" })).toBe("required");
    expect(bookingOf(null)).toBeNull();
  });
});

describe("walk, shape and best time", () => {
  it("walk bands", () => {
    expect([0, 199, 200, 599, 600, 1499, 1500, 5000].map(walkBandOf)).toEqual(["lt200", "lt200", "200-600", "200-600", "600-1500", "600-1500", "1500+", "1500+"]);
  });
  it("read off the record's own values, null for a gap", () => {
    const ref = "place/view";
    const w = world(
      [{ ref, type: "nature.viewpoint.viewpoint", layer: "place", name: "View", best_time: cv([{ slot: "sunrise" as const, why: "light" as const }]) }],
      [{ ref, kind: "viewpoint", subkind: "viewpoint", suitability: { walk_m: v(450, "official_info") } }],
    );
    expect(bandsOf(w, ref)).toMatchObject({ walk_band: "200-600", best_time: "sunrise", shape: null });
    const t = world([{ ref: "place/t", type: "nature.trail.hike", layer: "route", name: "T" }], [{ ref: "place/t", kind: "trail", subkind: "hike", suitability: {}, ext: { kind: "trail", shape: "loop" } }]);
    expect(bandsOf(t, "place/t")).toMatchObject({ shape: "loop", walk_band: null, best_time: null });
  });
});

describe("bandsOf", () => {
  it("a trail: effort, kids, time from the adult time, stroller and dogs flags", () => {
    const ref = "place/tre-cime";
    const w = world(
      [{ ref, type: "nature.trail.hike", layer: "route", name: "Tre Cime" }],
      [{
        ref, kind: "trail", subkind: "hike",
        suitability: {
          ...walk(8.8, 550, { effort: { source_grade: sg("sac", "T2") }, adult_time_min: cv([180, 240] as [number, number]), age_band: v({ from: 8, to: null }, "our_inference"), stroller: v("none", "official_info") }),
        },
        ext: { kind: "trail", dogs: v("leash", "official_info") },
      }],
    );
    const b = bandsOf(w, ref);
    expect(b.effort).toBe("Moderate");
    expect(b.kids_from).toBe(8);
    expect(b.kids_basis).toBe("advice");
    expect(b.time_band).toBe("2-4h");
    expect(b.flags).toEqual(["dogs", "!stroller"]);
    expect(b.price_band).toBeNull();
    expect(b.booking).toBeNull();
  });

  it("a lift, read through offer/<ref>#ticket: price, booking and kids from the ticket", () => {
    const ref = "place/lagazuoi";
    const ticket = "offer/place/lagazuoi#ticket";
    const w = world(
      [
        { ref, type: "ride.lift.cable_car", layer: "route", name: "Lagazuoi cable car" },
        {
          ref: ticket, type: "ride.lift.cable_car", layer: "offer", on: [{ ref }],
          price: cv([{ amount: 30, currency: "EUR", per: "adult" as const }, { amount: 15, currency: "EUR", per: "child" as const, age_from: 6, age_to: 14 }]),
          window: cv({ rule: "on_arrival" as const }),
          duration_min: cv([10, 15] as [number, number]),
        },
      ],
      [{ ref: ticket, kind: "lift", subkind: "gondola", suitability: { min_age: v(4), stroller_on_board: v("folded", "operator_rule") } }],
    );
    const b = bandsOf(w, ref);
    expect(b.effort).toBeNull();
    expect(b.kids_from).toBe(4);
    expect(b.kids_basis).toBe("rule");
    expect(b.price_band).toBe("$$");
    expect(b.booking).toBe("none");
    expect(b.time_band).toBe("<1h");
    expect(b.flags).toEqual(["stroller_part"]);
  });

  it("a raft offer: strictest window, lowest adult price, rule age", () => {
    const ref = "offer/place/bow#raft";
    const w = world(
      [{ ref, type: "water.paddle.raft", layer: "offer", name: "Family float", price: cv([{ amount: 0, currency: "CAD", per: "person" as const }]), window: cv({ rule: "rolling" as const, sellout: { kind: "days" as const } }), duration_min: cv([180, 240] as [number, number]) }],
      [{ ref, kind: "activity", subkind: "rafting", suitability: { min_age: v(8), participation: { guide: v("required", "operator_rule") } } }],
    );
    const b = bandsOf(w, ref);
    expect(b.price_band).toBe("free");
    expect(b.booking).toBe("required");
    expect(b.kids_from).toBe(8);
    expect(b.time_band).toBe("2-4h");
    expect(b.flags).toEqual(["guided"]);
  });

  it("a lake: a lifeguard and swimming give flags, effort stays null", () => {
    const ref = "place/lake";
    const w = world(
      [{ ref, type: "water.swim.beach", layer: "place", name: "Lake" }],
      [{ ref, kind: "lake", subkind: "lake", suitability: { water_safety: { lifeguard: v(true, "official_info") }, toilets: v(["start"], "official_info") }, ext: { kind: "water", swimming: v("allowed", "official_info") } }],
    );
    const b = bandsOf(w, ref);
    expect(b.effort).toBeNull();
    expect(b.flags).toEqual(["swim", "lifeguard", "toilets"]);
  });

  it("a lake where swimming is discouraged is not a swimming lake", () => {
    const ref = "place/lake";
    const w = world(
      [{ ref, type: "water.body.lake", layer: "place", name: "Lake" }],
      [{ ref, kind: "lake", subkind: "lake", suitability: {}, ext: { kind: "water", swimming: v("discouraged", "official_info") } }],
    );
    expect(bandsOf(w, ref).flags).toEqual(["!swim"]);
  });

  it("a sight with no hours and no values: every band is null, never a guess", () => {
    const ref = "place/museum";
    const w = world([{ ref, type: "culture.museum.museum", layer: "place", name: "Museum" }], []);
    expect(bandsOf(w, ref)).toEqual(NO_BANDS);
  });

  it("a sight's time is the on-site time", () => {
    const ref = "place/otzi";
    const w = world([{ ref, type: "culture.museum.museum", layer: "place", name: "Museum" }], [{ ref, kind: "sight", subkind: "museum", suitability: { on_site_min: cv([90, 120] as [number, number]) } }]);
    expect(bandsOf(w, ref).time_band).toBe("1-2h");
  });

  it("flags never exceed six ids, and a gap stores neither the id nor its negation", () => {
    const ref = "place/x";
    const w = world([{ ref, type: "water.swim.beach", layer: "place", name: "X" }], [{
      ref, kind: "lake", subkind: "lake",
      suitability: {
        water_safety: { lifeguard: v(false, "official_info") }, toilets: v(["none"], "official_info"), change_rooms: v(false, "official_info"),
        wheelchair: v("none", "official_info"), exposure: v({ level: "some", fenced: "unfenced" }, "official_info"), stroller: v("none", "official_info"),
      },
      ext: { kind: "water", swimming: v("banned", "official_info") },
    }]);
    const b = bandsOf(w, ref);
    expect(b.flags.length).toBeLessThanOrEqual(MAX_FLAGS);
    expect(b.flags.every((f) => f.startsWith("!"))).toBe(true);
    expect(b.flags).not.toContain("!dogs");
  });

  it("a band is a label: no band value carries a source, a note or an object", () => {
    const ref = "place/t";
    const w = world([{ ref, type: "nature.trail.hike", layer: "route", name: "T" }], [{ ref, kind: "trail", subkind: "hike", suitability: walk(3, 100, { effort: { source_grade: sg("sac", "T1") } }) }]);
    const b = bandsOf(w, ref);
    expect(Object.keys(b).sort()).toEqual([...BAND_KEYS].sort());
    for (const val of Object.values(b)) expect(typeof val === "string" || typeof val === "number" || val === null || (Array.isArray(val) && val.every((x) => typeof x === "string"))).toBe(true);
  });
});
