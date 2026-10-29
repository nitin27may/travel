// TB-E2: several bases chosen by the visitor (trip-builder.md 4.5, 4.6). The night shares and base resolution (bases.ts), the move
// check (moves.ts), the switch between K = 1 and several bases, kept stops across bases, Add N days, and the property tests: every
// pick placed once or listed; the nights sum to the trip's; move days only between consecutive bases; determinism.
import { describe, expect, it } from "vitest";
import { BUILDER_BASES } from "../../src/config/builder.ts";
import { resolveBases, shareNights } from "../../src/plan/bases.ts";
import { buildPlan } from "../../src/plan/engine.ts";
import { moveCheck } from "../../src/plan/moves.ts";
import { planBuild, planBuildRules, type PlanBuild, type PlanBuildInput } from "../../src/schema/api/plan.ts";
import { rockies } from "../fixtures/plan/rockies.ts";
import { ONT, mkBuild, mkInput, mkPlace, mkTown, placesMap, seeded } from "./engine-fixture.ts";

const serialise = (out: PlanBuild): string => `${JSON.stringify(out, null, 2)}\n`;
const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const missOf = (out: PlanBuild, ref: string) => out.didNotFit.find((m) => m.ref === ref);

describe("shareNights (4.5)", () => {
  it("the visitor's nights first, the open bases the rest by demand, with the floor", () => {
    expect(shareNights(7, [3, null], [100, 50])).toEqual([3, 4]);
    // floor 2 each, then 3 by the largest remainder of 1.5, 0.75, 0.75
    expect(shareNights(9, [null, null, null], [600, 300, 300])).toEqual([3, 3, 3]);
    // floor 2 each, then 6 as 5.4 and 0.6: 5 and 0, the remainder to the larger fraction
    expect(shareNights(10, [null, null], [900, 100])).toEqual([BUILDER_BASES.nightsFloor + 5, BUILDER_BASES.nightsFloor + 1]);
  });
  it("the floor drops to 1, then 0, when the open nights cannot give every open base 2", () => {
    expect(shareNights(3, [null, null], [10, 10])).toEqual([2, 1]);
    expect(shareNights(1, [null, null], [10, 20])).toEqual([0, 1]);
  });
  it("with no open base, spare nights go to the highest demand (ties: the first)", () => {
    expect(shareNights(6, [2, 2], [10, 30])).toEqual([2, 4]);
    expect(shareNights(6, [2, 2], [30, 30])).toEqual([4, 2]);
  });
  it("clamps a body that asks for more nights than the plan holds, in order", () => {
    expect(shareNights(4, [3, 3], [0, 0])).toEqual([3, 1]);
  });
  it("always sums to the plan's nights, whatever the inputs", () => {
    const r = seeded(7);
    for (let k = 0; k < 300; k++) {
      const n = Math.floor(r() * 22);
      const m = 2 + Math.floor(r() * 3);
      const fixed = Array.from({ length: m }, () => (r() < 0.5 ? null : Math.floor(r() * 5)));
      const demand = Array.from({ length: m }, () => Math.floor(r() * 2000));
      const out = shareNights(n, fixed, demand);
      expect(out.reduce((a, b) => a + b, 0), JSON.stringify({ n, fixed, demand })).toBe(n);
      expect(out.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
    }
  });
});

describe("resolveBases", () => {
  it("keeps the visitor's order, each town once, only candidate towns, at most 4", () => {
    const towns = [...ONT.towns, mkTown("ca-on-ottawa", "Ottawa", 45.42, -75.7), mkTown("ca-on-parry-sound", "Parry Sound", 45.35, -80.04)];
    const out = resolveBases(
      [
        { town: "ca-on-dwight", nights: 1, pinned: true },
        { town: "ca-on-unknown", nights: 1, pinned: false },
        { town: "ca-on-dwight", nights: 2, pinned: false },
        { town: "ca-on-huntsville", nights: null, pinned: false },
        { town: "ca-on-ottawa", nights: null, pinned: false },
        { town: "ca-on-bracebridge", nights: null, pinned: false },
        { town: "ca-on-parry-sound", nights: null, pinned: false },
      ],
      towns,
    );
    expect(out.map((x) => x.town.id)).toEqual(["ca-on-dwight", "ca-on-huntsville", "ca-on-ottawa", "ca-on-bracebridge"]);
    expect(out[0]).toMatchObject({ node: "t:ca-on-dwight", nights: 1, pinned: true });
  });
});

describe("moveCheck", () => {
  const m = { fromName: "A", toName: "B", routed: false, driveMin: 240, dayMin: 630 };
  it("a move within the day's driving: the move only", () => {
    const r = moveCheck({ ...m, min: 180 });
    expect(r.warnings).toEqual([]);
    expect(r.reasons.map((x) => x.text)).toEqual(["Move from A to B: 3 h ≈ of driving"]);
  });
  it("over the day's driving: a Check; over the whole day: a Check and add a base between; no road: W_NO_ROUTE", () => {
    expect(moveCheck({ ...m, min: 300 })).toMatchObject({ warnings: ["W_DRIVE_LIMIT"], reasons: [{ code: "move_day" }, { code: "long_move" }] });
    expect(moveCheck({ ...m, min: 700 })).toMatchObject({ warnings: ["W_DRIVE_LIMIT"], reasons: [{ code: "move_day" }, { code: "move_over_day" }] });
    expect(moveCheck({ ...m, min: null })).toMatchObject({ warnings: ["W_NO_ROUTE"], reasons: [{ code: "no_road_move", text: "No road we know of from A to B" }] });
  });
  it("a routed move carries no ≈", () => {
    expect(moveCheck({ ...m, min: 90, routed: true }).reasons[0]!.text).toBe("Move from A to B: 1 h 30 of driving");
  });
});

// Two clusters three hours apart: Muskoka (Huntsville) and the Ottawa valley.
const OTT = mkTown("ca-on-ottawa", "Ottawa", 45.4215, -75.6972, 1017449, 3);
const TOWNS = [...ONT.towns, OTT];
// (place/parliament-hill is ONT's own far pick: here it is the Ottawa base's)
const OTT_PLACES = [
  mkPlace("place/byward-market", 45.429, -75.692, { kind: "sight", visitMin: 90 }),
  mkPlace("place/pink-lake", 45.4669, -75.8072, { kind: "lake", visitMin: 60 }),
];
const PLACES = placesMap([...ONT.places, ...OTT_PLACES]);
const tripMode: Partial<PlanBuildInput> = { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] } };
const TWO = ["place/arrowhead", "place/oxtongue-lake", "place/dorset-tower", "place/parliament-hill", "place/byward-market", "place/pink-lake"];
const two = (over: Partial<PlanBuildInput> = {}): PlanBuild =>
  buildPlan(
    mkInput(
      mkBuild(TWO, {
        ...tripMode,
        nights: 5,
        bases: [
          { town: "ca-on-huntsville", nights: null, pinned: false },
          { town: "ca-on-ottawa", nights: null, pinned: false },
        ],
        ...over,
      }),
      { places: PLACES, towns: TOWNS },
    ),
  );

describe("K = 1 or several", () => {
  it("one chosen base (or one that resolves) is the K = 1 build, byte for byte", () => {
    const one = buildPlan(mkInput(mkBuild(TWO.slice(0, 3), { ...tripMode, nights: 3, bases: [{ town: "ca-on-huntsville", nights: 3, pinned: true }] }), { places: PLACES, towns: TOWNS }));
    const withUnknown = buildPlan(
      mkInput(
        mkBuild(TWO.slice(0, 3), {
          ...tripMode,
          nights: 3,
          bases: [
            { town: "ca-on-huntsville", nights: 3, pinned: true },
            { town: "ca-on-not-a-town", nights: null, pinned: false },
          ],
        }),
        { places: PLACES, towns: TOWNS },
      ),
    );
    expect(serialise(withUnknown)).toBe(serialise(one));
    expect(one.bases).toHaveLength(1);
  });
  it("two chosen bases: each pick on its nearest base's days, one move day", () => {
    const out = two();
    expect(out.bases.map((b) => b.town)).toEqual(["ca-on-huntsville", "ca-on-ottawa"]);
    expect(out.bases.reduce((n, b) => n + b.nights, 0)).toBe(5);
    expect(out.days.filter((d) => d.move)).toHaveLength(1);
    const ottDays = out.days.filter((d) => d.base === "ca-on-ottawa" || (d.base === null && d.day === 6)).map((d) => d.day);
    for (const r of ["place/parliament-hill", "place/byward-market", "place/pink-lake"]) expect(ottDays).toContain(out.days.find((d) => d.items.some((i) => i.ref === r))!.day);
    expect(planBuild.safeParse(out).success).toBe(true);
    expect(planBuildRules(mkBuild(TWO, { ...tripMode, nights: 5, bases: [{ town: "ca-on-huntsville", nights: null, pinned: false }, { town: "ca-on-ottawa", nights: null, pinned: false }] })).invalid).toEqual([]);
  });
  it("a base the nights do not reach stays listed with no nights and no days, never silently dropped", () => {
    const out = two({ nights: 1 });
    expect(out.bases.map((b) => b.town)).toEqual(["ca-on-huntsville", "ca-on-ottawa"]);
    expect(out.bases.map((b) => b.nights).sort()).toEqual([0, 1]);
    const empty = out.bases.find((b) => b.nights === 0)!;
    expect(empty.reasons[0]!.code).toBe("no_nights");
    expect(out.days.some((d) => d.base === empty.town)).toBe(false);
    expect(out.days.some((d) => d.move)).toBe(false);
  });
  it("a kept stop stays on its day, on the base that day belongs to (TF11)", () => {
    const base = two();
    const lastOtt = base.days.filter((d) => d.base === "ca-on-ottawa").at(-1)!.day;
    const edits: PlanBuildInput["edits"] = [{ day: lastOtt, refs: ["place/dorset-tower"], locked: ["place/dorset-tower"] }];
    const out = two({ edits });
    expect(out.days.find((d) => d.day === lastOtt)!.items.find((i) => i.ref === "place/dorset-tower")).toMatchObject({ locked: true });
    expect(missOf(out, "place/dorset-tower")).toBeUndefined();
  });
  it("Add N days is confirmed for musts over the pace (RB-005): kept on a day, and a rebuild with those nights gives them room", () => {
    const busy = [...TWO, "place/ragged-falls", "route/lake-of-two-rivers-trail"].map((r) => ({ ref: r, must: true }));
    const b = mkBuild(busy, {
      ...tripMode,
      nights: 2,
      bases: [
        { town: "ca-on-huntsville", nights: null, pinned: false },
        { town: "ca-on-ottawa", nights: null, pinned: false },
      ],
    });
    const out = buildPlan(mkInput(b, { places: PLACES, towns: TOWNS }));
    expect(out.didNotFit.filter((x) => x.code === "TB_TIME")).toEqual([]); // a must is never dropped
    for (const r of busy) expect(placed(out)).toContain(r.ref);
    const over = out.days.flatMap((d) => d.reasons).filter((r) => r.code === "over_pace");
    expect(over.length, JSON.stringify(out.days.map((d) => d.reasons))).toBeGreaterThan(0);
    // each over day names the days that give its musts room; the largest gives every one room
    const k = Math.max(...over.map((r) => Number(r.values.addDays)));
    expect(k).toBeGreaterThanOrEqual(1);
    const more = buildPlan(mkInput({ ...b, nights: b.nights + k }, { places: PLACES, towns: TOWNS }));
    for (const r of busy) expect(placed(more)).toContain(r.ref);
    expect(more.days.flatMap((d) => d.reasons).filter((r) => r.code === "over_pace")).toEqual([]);
  });
  it("near mode with two bases starts and ends at the start; the first base says how far it is from it", () => {
    const b = mkBuild(TWO, { nights: 4, bases: [{ town: "ca-on-huntsville", nights: 2, pinned: true }, { town: "ca-on-ottawa", nights: 2, pinned: true }] });
    const out = buildPlan(mkInput(b, { places: PLACES, towns: TOWNS }));
    expect(out.bases[0]!.reasons.map((r) => r.code)).toContain("from_start");
    expect(out.bases[1]!.reasons.map((r) => r.code)).not.toContain("from_start");
    expect(out.days.at(-1)!.base).toBeNull();
  });
});

describe("properties over random multi-base builds (4.11)", () => {
  const POOL = [...PLACES.keys()];
  const r = seeded(20261028);
  const cases: { build: PlanBuildInput; towns: typeof TOWNS }[] = [];
  for (let k = 0; k < 60; k++) {
    const nights = 2 + Math.floor(r() * 12);
    const picks = POOL.filter(() => r() < 0.6).map((ref) => ({ ref, must: r() < 0.25 }));
    if (!picks.length) picks.push({ ref: POOL[0]!, must: false });
    const m = 2 + Math.floor(r() * 3);
    const shuffled = [...TOWNS];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const x = Math.floor(r() * (j + 1));
      [shuffled[j], shuffled[x]] = [shuffled[x]!, shuffled[j]!];
    }
    const chosen = shuffled.slice(0, m);
    let left = nights;
    const bases = chosen.map((t) => {
      const n = r() < 0.5 || left === 0 ? null : 1 + Math.floor(r() * Math.min(3, left));
      if (n !== null) left -= n;
      return { town: t.id, nights: n, pinned: r() < 0.5 };
    });
    const pace = (["relaxed", "standard", "full"] as const)[Math.floor(r() * 3)]!;
    cases.push({ build: mkBuild(picks, { ...tripMode, nights, pace, bases, month: 6 + Math.floor(r() * 4) }), towns: TOWNS });
  }

  it("the random bodies are valid builds", () => {
    for (const c of cases) expect(planBuildRules(c.build).invalid).toEqual([]);
  });

  for (const [i, c] of cases.entries()) {
    it(`case ${i}: picks once or listed, nights sum, moves only between consecutive bases, each base's nights in a row, deterministic`, () => {
      const out = buildPlan(mkInput(c.build, { places: PLACES, towns: c.towns }));
      expect(planBuild.safeParse(out).success).toBe(true);
      // every pick placed once or listed, never both, none lost
      const on = placed(out);
      const missed = out.didNotFit.map((m) => m.ref);
      expect(new Set(on).size).toBe(on.length);
      expect(on.filter((x) => missed.includes(x))).toEqual([]);
      expect([...on, ...missed].sort()).toEqual(c.build.picks.map((p) => p.ref).sort());
      // the nights sum to the trip's, one day more than nights
      expect(out.bases.reduce((n, b) => n + b.nights, 0)).toBe(c.build.nights);
      expect(out.days.map((d) => d.day)).toEqual(Array.from({ length: c.build.nights + 1 }, (_, j) => j + 1));
      // the route: the bases with nights, in the visitor's order; each sleeps its nights in a row
      const route = out.bases.filter((b) => b.nights > 0);
      const sleeps = out.days.slice(0, -1).map((d) => d.base);
      expect(sleeps).toEqual(route.flatMap((b) => Array.from({ length: b.nights }, () => b.town)));
      expect(out.days.at(-1)!.base).toBeNull();
      // a move day only between consecutive bases, and every change of base is a move day
      out.days.forEach((d, j) => {
        if (j === 0 || d.base === null) return expect(d.move).toBe(false);
        const prev = out.days[j - 1]!.base!;
        if (d.move) {
          const a = route.findIndex((b) => b.town === prev);
          expect(route[a + 1]?.town).toBe(d.base);
        } else expect(d.base).toBe(prev);
      });
      expect(out.days.filter((d) => d.move)).toHaveLength(route.length - 1);
      // determinism: twice equal, and with towns and places reordered
      expect(serialise(buildPlan(mkInput(c.build, { places: PLACES, towns: c.towns })))).toBe(serialise(out));
      expect(serialise(buildPlan(mkInput(c.build, { places: placesMap([...PLACES.values()].reverse()), towns: [...c.towns].reverse() })))).toBe(serialise(out));
    });
  }
});

describe("the Rockies golden's input reads as a draft would send it", () => {
  it("passes the build rules", () => {
    expect(planBuildRules(rockies.input.build)).toEqual({ invalid: [], tooLarge: [] });
  });
});
