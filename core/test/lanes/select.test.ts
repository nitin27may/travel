import { describe, expect, it } from "vitest";
import { isCityOver500k } from "../../src/lanes/cities.ts";
import { LANES, selectLanes } from "../../src/lanes/select.ts";

/** the Patagonia worked example of plan 7.3 */
const patagonia = (over: Record<string, any> = {}) => ({
  trip: { primary_style: "active-nature", duration_shape: "multi-week", movement_shape: "multi-base", countries: ["AR"], nights: 13, ...(over.trip ?? {}) },
  trip_tags: [{ tag_id: "adventure" }, { tag_id: "family" }],
  profile: { pace: 3, comfort: "mid", kids_mode: "teen", transport: ["domestic-flight", "rental-car"], must_do: [{ text: "Laguna de los Tres", ref: null }], lanes_extra: [], lanes_skip: ["city-culture"], ...(over.profile ?? {}) },
  bases: [{ name: "Buenos Aires" }, { name: "Ushuaia" }, { name: "El Chalten" }, { name: "El Calafate" }],
});

describe("lanes.select", () => {
  it("Patagonia selects exactly overview, sights, trails, adventure, stays, timing, logistics, entry, fares, community", () => {
    const s = selectLanes(patagonia());
    expect(s.lanes.map((l) => l.lane)).toEqual(["overview", "sights", "trails", "adventure", "stays", "timing", "logistics", "entry", "fares", "community"]);
  });

  it("gives a reason for every lane, kept or left out", () => {
    const s = selectLanes(patagonia());
    const why = Object.fromEntries([...s.lanes, ...s.dropped].map((l) => [l.lane, l.reason]));
    expect(why.trails).toBe("style adventure");
    expect(why.adventure).toBe("style adventure");
    expect(why.entry).toBe("AR is not CA");
    expect(why.stays).toBe("13 nights");
    expect(why["relax-luxury"]).toContain("no relax, luxury or romantic style");
    expect(why["hidden-gems"]).toContain("no hidden-gems tag");
    expect(why["road-trip"]).toContain("multi-base");
    expect(why["city-culture"]).toContain("profile.lanes_skip (it would have run: base Buenos Aires is a city of more than 500,000)");
    expect(s.lanes.length + s.dropped.length).toBe(LANES.length);
  });

  it("without the skip, Buenos Aires adds city-culture", () => {
    const s = selectLanes(patagonia({ profile: { lanes_skip: [] } }));
    expect(s.lanes.map((l) => l.lane)).toContain("city-culture");
  });

  it("a day trip keeps only the day-trip set", () => {
    const day = { trip: { primary_style: "adventure", duration_shape: "day-trip", movement_shape: "single-base", countries: ["CA"], nights: 0 }, trip_tags: [], profile: { lanes_extra: [], lanes_skip: [] }, bases: [] };
    expect(selectLanes(day).lanes.map((l) => l.lane)).toEqual(["overview", "trails", "timing"]);
    const sight = { ...day, trip: { ...day.trip, primary_style: "city-culture" } };
    expect(selectLanes(sight).lanes.map((l) => l.lane)).toEqual(["overview", "sights", "timing"]);
    expect(selectLanes(day, { driveMinutes: 120 }).lanes.map((l) => l.lane)).toEqual(["overview", "trails", "road-trip", "timing"]);
    const dropped = selectLanes(day).dropped.map((l) => l.lane);
    for (const l of ["stays", "logistics", "entry", "fares", "community"]) expect(dropped).toContain(l);
  });

  it("lanes_extra adds a lane and lanes_skip removes one", () => {
    const s = selectLanes(patagonia({ profile: { lanes_extra: ["hidden-gems"], lanes_skip: ["fares", "city-culture"] } }));
    const names = s.lanes.map((l) => l.lane);
    expect(names).toContain("hidden-gems");
    expect(names).not.toContain("fares");
    expect(s.lanes.find((l) => l.lane === "hidden-gems")!.reason).toBe("added by profile.lanes_extra");
  });

  it("styles and movement trigger their lanes: relax, road trip, hidden gems at a slow pace", () => {
    const relax = selectLanes({ trip: { primary_style: "luxury-relax", duration_shape: "week", movement_shape: "road-trip", countries: ["CA"], nights: 6 }, trip_tags: [], profile: { comfort: "splurge", pace: 2 }, bases: [] });
    const names = relax.lanes.map((l) => l.lane);
    expect(names).toEqual(["overview", "sights", "relax-luxury", "road-trip", "stays", "timing", "logistics", "fares", "community"]);
    const slow = selectLanes({ trip: { primary_style: "scenic-relaxed", duration_shape: "week", movement_shape: "single-base", countries: ["CA"], nights: 3 }, trip_tags: [], profile: { pace: 2 }, bases: [] });
    expect(slow.lanes.map((l) => l.lane)).toContain("hidden-gems");
    expect(slow.lanes.map((l) => l.lane)).toContain("trails");
  });

  it("recognises large cities by name and not the small ones", () => {
    expect(["Buenos Aires", "Toronto", "Zürich".replace("ü", "u")].map(isCityOver500k)).toEqual([true, true, false]);
    expect(isCityOver500k("Calgary, AB")).toBe(true);
    expect(isCityOver500k("Banff")).toBe(false);
  });
});
