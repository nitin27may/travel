// TB-G1: golden fixtures for the trip builder engine (core/test/fixtures/plan/, README.md there). Each case builds from a fixed input
// and is compared byte for byte with its pinned `<name>.expected.json`. Regenerate deliberately: `pnpm --dir core golden:update`
// (GOLDEN_UPDATE=1), then read the diff. The engine is deterministic, so a diff is a behaviour change, never noise.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveHomePoint } from "../../src/config/home.ts";
import { buildPlan } from "../../src/plan/engine.ts";
import { profileOf } from "../../src/plan/score.ts";
import { dayCapMin } from "../../src/schedule/rules.ts";
import { planBuild, planMatrixRules, type PlanBuild } from "../../src/schema/api/plan.ts";
import { GOLDENS, algonquin, daytrip, infeasibleClosed, infeasibleMove, infeasibleTime, quebec, roadtrip, rockies, type GoldenCase } from "../fixtures/plan/index.ts";
import { ALGONQUIN_PARK } from "../fixtures/plan/algonquin.ts";
import { mkBuild, mkInput, mkPlace, placesMap } from "./engine-fixture.ts";

const DIR = new URL("../fixtures/plan/", import.meta.url);
const fileOf = (c: GoldenCase): URL => new URL(`${c.name}.expected.json`, DIR);
/** The pinned form: two-space JSON and a final newline. */
const serialise = (out: PlanBuild): string => `${JSON.stringify(out, null, 2)}\n`;
const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const missOf = (out: PlanBuild, ref: string) => out.didNotFit.find((m) => m.ref === ref);
const allReasons = (out: PlanBuild) => [
  ...out.bases.flatMap((b) => b.reasons),
  ...(out.areas ?? []).flatMap((a) => a.reasons),
  ...out.days.flatMap((d) => d.reasons),
  ...out.didNotFit.flatMap((m) => m.reasons),
];

const UPDATE = process.env.GOLDEN_UPDATE === "1";
if (UPDATE) mkdirSync(DIR, { recursive: true });

/** Every key and string in the answer, depth first. */
function walk(v: unknown, f: (k: string | null, v: unknown) => void, k: string | null = null): void {
  f(k, v);
  if (Array.isArray(v)) for (const x of v) walk(x, f, null);
  else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) walk(x, f, kk);
}

for (const c of GOLDENS) {
  describe(`golden ${c.name}`, () => {
    const out = buildPlan(c.input);
    const b = c.input.build;

    it("is pinned byte for byte", () => {
      const now = serialise(out);
      if (UPDATE) writeFileSync(fileOf(c), now);
      expect(existsSync(fileOf(c)), `${c.name}.expected.json is missing: run pnpm --dir core golden:update`).toBe(true);
      expect(now).toBe(readFileSync(fileOf(c), "utf8"));
    });

    it("parses as the build answer with a square matrix", () => {
      const r = planBuild.safeParse(out);
      expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
      expect(planMatrixRules(out.matrix)).toEqual([]);
    });

    it("places every pick once, lists it in Did not fit, or pins it as an area: exactly one of the three", () => {
      const on = placed(out);
      const missed = out.didNotFit.map((m) => m.ref);
      const areas = (out.areas ?? []).map((a) => a.ref);
      expect(new Set(on).size).toBe(on.length);
      expect(new Set(missed).size).toBe(missed.length);
      expect(on.filter((r) => missed.includes(r))).toEqual([]);
      expect(areas.filter((r) => on.includes(r) || missed.includes(r))).toEqual([]);
      // a locked stop may sit on a day without being a pick; a pick is always one of the three
      expect([...on, ...missed, ...areas].filter((r) => b.picks.some((p) => p.ref === r)).sort()).toEqual(b.picks.map((p) => p.ref).sort());
    });

    it("holds each day to its cap (a day with the way in or out, or a move, may add one leg each)", () => {
      const cap = dayCapMin(profileOf(b.party, b.pace));
      for (const d of out.days) {
        const load = d.items.reduce((n, i) => n + i.visitMin + (i.driveMin ?? 0), 0) + (d.returnMin ?? 0);
        const edge = d.day === 1 || d.day === b.nights + 1 || d.move ? 2 * 480 : 0;
        expect(load, `day ${d.day}`).toBeLessThanOrEqual(cap + edge);
        let last = -1;
        for (const i of d.items) {
          expect(i.visitMin).toBeGreaterThanOrEqual(0);
          if (i.startMin !== null) {
            expect(i.startMin).toBeGreaterThanOrEqual(last);
            last = i.startMin;
          }
        }
      }
    });

    it("explains with numbers, and marks every estimated figure with ≈", () => {
      const rs = allReasons(out);
      expect(rs.length).toBeGreaterThan(0);
      for (const r of rs) {
        expect(r.text.length).toBeGreaterThan(0);
        expect(Object.keys(r.values).length).toBeGreaterThan(0);
        if (out.basis === "estimate" && /\d+ (?:min|h)\b|\d h \d\d/.test(r.text)) expect(r.text, r.code).toContain("≈");
      }
    });

    it("is deterministic: twice equal, and the same whatever order the inputs arrive in", () => {
      expect(serialise(buildPlan(c.input))).toBe(serialise(out));
      const shuffled = { ...c.input, towns: [...c.input.towns].reverse(), places: placesMap([...c.input.places.values()].reverse()) };
      expect(serialise(buildPlan(shuffled))).toBe(serialise(out));
    });

    it("carries no home point, start or coordinate anywhere in the answer", () => {
      const home = resolveHomePoint();
      const json = serialise(out);
      expect(json).not.toContain(String(home.lat));
      expect(json).not.toContain(String(home.lon));
      if (c.input.start) {
        expect(json).not.toContain(String(c.input.start.lat));
        expect(json).not.toContain(String(c.input.start.lon));
      }
      walk(out, (k, v) => {
        if (k !== null) expect(k, k).not.toMatch(/^(?:lat|lon|lng|latitude|longitude|coordinates?|point|start|home|origin|party)$/i);
        if (typeof v === "number") expect(String(v), `${k}`).not.toMatch(/\.\d{3,}$/); // a coordinate-like number
      });
    });
  });
}

describe("golden quebec: near mode, one base, a kids party, summer", () => {
  const out = buildPlan(quebec.input);
  it("builds one base for both nights and a day for each", () => {
    expect(out.bases).toHaveLength(1);
    expect(out.bases[0]!.nights).toBe(2);
    expect(out.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(out.days.every((d) => d.move === false)).toBe(true);
    expect(out.bases[0]!.reasons[0]!.code).toBe("covers_picks");
  });
  it("places the must; the age-limited picks are TB_FIT with the youngest's age, not dropped silently", () => {
    expect(placed(out)).toContain("place/old-quebec");
    expect(missOf(out, "place/canyon-sainte-anne")).toMatchObject({ code: "TB_FIT", reasons: [{ text: "Needs age 10; youngest is 7" }] });
    expect(missOf(out, "place/chute-montmorency-zipline")).toMatchObject({ code: "TB_FIT", reasons: [{ text: "Needs age 12; youngest is 7" }] });
    expect(out.didNotFit.map((m) => m.ref).sort()).toEqual(["place/canyon-sainte-anne", "place/chute-montmorency-zipline"]);
  });
  it("the Montreal start appears only as an estimated drive to the base", () => {
    expect(out.basis).toBe("estimate");
    expect(out.bases[0]!.reasons.find((r) => r.code === "from_start")!.text).toMatch(/from your start to .*/);
  });
});

describe("golden algonquin: trails are stops, the park is the area", () => {
  const out = buildPlan(algonquin.input);
  it("places the trails", () => {
    const on = placed(out);
    for (const t of ["route/hardwood-lookout-trail", "route/track-and-tower-trail", "route/mizzy-lake-trail", "route/lookout-trail"]) expect(on).toContain(t);
  });
  it("October is the trails' shoulder month: open, not Did not fit", () => {
    expect(out.didNotFit.filter((m) => m.code === "TB_CLOSED")).toEqual([]);
  });
  it("every trail stop has a time, a drive leg and a visit of more than zero", () => {
    for (const i of out.days.flatMap((d) => d.items).filter((i) => i.ref.startsWith("route/"))) {
      expect(i.visitMin).toBeGreaterThan(0);
      expect(i.driveMin).not.toBeNull();
    }
  });
  // TB-PIN (R1, BACKLOG 15.354): the protected-area pick is the trip's area, never a stop with a visit time, never Did not fit.
  it("the park pick is never a stop on a day (TB-PIN)", () => {
    expect(placed(out)).not.toContain(ALGONQUIN_PARK);
    expect(out.didNotFit.map((m) => m.ref)).not.toContain(ALGONQUIN_PARK);
    expect(out.matrix.refs).not.toContain(ALGONQUIN_PARK);
  });
  it("the park is the area, and its four trails are the stops (Oxtongue Lake lies outside it)", () => {
    expect(out.areas).toEqual([
      {
        ref: ALGONQUIN_PARK,
        slug: "algonquin-provincial-park",
        name: "Algonquin Provincial Park",
        members: 4,
        code: null,
        reasons: [{ code: "area_pinned", values: { area: "Algonquin Provincial Park", n: 4 }, text: "Algonquin Provincial Park is your area; its 4 trails are the stops" }],
      },
    ]);
  });
});

describe("golden daytrip: nights 0, one day, a visitor start that is never routed", () => {
  const out = buildPlan(daytrip.input);
  it("has no base, one day and no overnight", () => {
    expect(out.bases).toEqual([]);
    expect(out.days).toHaveLength(1);
    expect(out.days[0]!.base).toBeNull();
    expect(out.spareDays).toBe(0);
  });
  it("drives out from and back to the start, all estimated", () => {
    expect(out.days[0]!.items[0]!.driveMin).toBeGreaterThan(0);
    expect(out.days[0]!.returnMin).toBeGreaterThan(0);
    expect(out.days[0]!.items.every((i) => i.basis === "estimate")).toBe(true);
  });
  it("a start cell in the routed map is ignored (the start is never keyed)", () => {
    const withStartCells = buildPlan({ ...daytrip.input, routed: new Map([["s>p:place/elora-gorge", 1], ["p:place/elora-gorge>s", 1]]) });
    expect(serialise(withStartCells)).toBe(serialise(out));
  });
  it("a pick beyond the one-way limit is TB_TOO_FAR, the rest are placed", () => {
    expect(out.didNotFit.map((m) => [m.ref, m.code])).toEqual([["place/bruce-peninsula-tobermory", "TB_TOO_FAR"]]);
    expect(placed(out).sort()).toEqual(["place/elora-gorge", "place/rattlesnake-point", "place/st-jacobs-market"]);
  });
});

describe("golden infeasible: Did not fit lists exactly the unplaced, with reasons", () => {
  const time = buildPlan(infeasibleTime.input);
  const closed = buildPlan(infeasibleClosed.input);
  it("too many must-sees: none is dropped (RB-005); they stay on the days, over the pace, and only the far one is TB_TOO_FAR", () => {
    const picks = infeasibleTime.input.build.picks.map((p) => p.ref);
    const on = placed(time);
    expect(time.didNotFit.map((m) => m.ref).sort()).toEqual(picks.filter((r) => !on.includes(r)).sort());
    expect(time.didNotFit.map((m) => m.code)).toEqual(["TB_TOO_FAR"]);
    for (const r of picks.filter((x) => x !== "place/parliament-hill")) expect(on, r).toContain(r);
    const over = time.days.filter((d) => d.reasons.some((r) => r.code === "over_pace"));
    expect(over.length).toBeGreaterThan(0);
    for (const d of over) {
      expect(d.warnings).toContain("W_PACE");
      expect(d.reasons.find((r) => r.code === "over_pace")!.text).toMatch(/^Over your pace: \d must-sees? kept on this day; /);
    }
    expect(missOf(time, "place/parliament-hill")).toMatchObject({ code: "TB_TOO_FAR", fix: { kind: "add_base", town: "ca-on-ottawa" } });
    expect(missOf(time, "place/parliament-hill")!.reasons[0]!.text).toContain("≈");
  });
  it("the days an over-pace day names really give its musts room (rebuild with those nights)", () => {
    const t = Math.max(...time.days.flatMap((d) => d.reasons).filter((r) => r.code === "over_pace" && typeof r.values.addDays === "number").map((r) => Number(r.values.addDays)));
    expect(t).toBeGreaterThanOrEqual(1);
    const more = buildPlan({ ...infeasibleTime.input, build: { ...infeasibleTime.input.build, nights: infeasibleTime.input.build.nights + t } });
    const nearOnes = infeasibleTime.input.build.picks.map((p) => p.ref).filter((r) => r !== "place/parliament-hill");
    for (const r of nearOnes) expect(placed(more)).toContain(r);
    // a must over the pace with no "N more days" says even 3 more would not do; every other gets room in t more days
    const stillOver = more.days.flatMap((d) => d.reasons).filter((r) => r.code === "over_pace");
    for (const r of stillOver) expect(r.values.addDays === undefined || Number(r.values.addDays) >= 1).toBe(true);
  });
  it("a closed season is TB_CLOSED with Change month, and the open places are still planned", () => {
    for (const r of ["place/arrowhead", "place/oxtongue-lake", "place/ragged-falls"]) {
      expect(missOf(closed, r)).toMatchObject({ code: "TB_CLOSED", fix: { kind: "change_month" }, reasons: [{ code: "closed", text: "Closed in January" }] });
    }
    expect(placed(closed).sort()).toEqual(["place/ice-fishing-huts", "place/sugar-bush"]);
    expect(closed.didNotFit).toHaveLength(3);
  });
});

describe("minimal repros of engine gaps found while pinning the goldens", () => {
  it("an area pick (kind park, no visit time) is not given a visit time (TB-PIN)", () => {
    const park = mkPlace("place/some-park", 45.5, -78.4, { kind: "park", type: "protected-area", visitMin: null });
    const out = buildPlan(mkInput(mkBuild(["place/some-park", "place/arrowhead"]), { places: placesMap([park, mkPlace("place/arrowhead", 45.39, -79.21)]) }));
    expect(placed(out)).not.toContain("place/some-park");
  });
});

// ---- TB-E2: several bases the visitor chose -------------------------------------------------------------------------------------

const daysAt = (out: PlanBuild, town: string): number[] => out.days.filter((d) => d.base === town).map((d) => d.day);
const dayOf = (out: PlanBuild, ref: string): number | undefined => out.days.find((d) => d.items.some((i) => i.ref === ref))?.day;
const reasonOf = (rs: readonly { code: string; text: string }[], code: string) => rs.find((r) => r.code === code);

describe("golden rockies-two-base: Banff pinned for 3 nights, Jasper's nights shared out, one move day", () => {
  const out = buildPlan(rockies.input);
  it("keeps the visitor's bases in their order, and the open nights go to Jasper (3 + 4 = 7)", () => {
    expect(out.bases.map((x) => [x.town, x.nights, x.pinned])).toEqual([
      ["ca-ab-banff", 3, true],
      ["ca-ab-jasper", 4, false],
    ]);
    expect(out.bases.reduce((n, x) => n + x.nights, 0)).toBe(rockies.input.build.nights);
  });
  it("sleeps three nights at Banff, then moves on day 4 and sleeps four at Jasper; the last day flies home", () => {
    expect(daysAt(out, "ca-ab-banff")).toEqual([1, 2, 3]);
    expect(daysAt(out, "ca-ab-jasper")).toEqual([4, 5, 6, 7]);
    expect(out.days.filter((d) => d.move).map((d) => d.day)).toEqual([4]);
    expect(out.days.at(-1)!.base).toBeNull();
  });
  it("each pick sits on a day of the base nearest to it", () => {
    for (const r of ["place/lake-louise", "place/moraine-lake", "place/banff-gondola", "place/lake-minnewanka", "place/peyto-lake"]) expect(dayOf(out, r), r).toBeLessThanOrEqual(3);
    for (const r of ["route/maligne-canyon", "place/maligne-lake", "place/jasper-skytram", "place/miette-hot-springs", "place/athabasca-falls"]) expect(dayOf(out, r), r).toBeGreaterThanOrEqual(4);
  });
  it("says why per base: Base 2: Jasper, 4 nights, n of your picks within m", () => {
    expect(out.bases[1]!.reasons[0]!.text).toMatch(/^Base 2: Jasper, 4 nights, 5 of your 11 picks within \d+ min ≈$/);
    expect(out.bases[0]!.reasons.map((r) => r.code)).toEqual(["base_share", "pinned_base", "lodging"]);
  });
  it("the move day names the drive, and a move over the day's driving is a Check (W_DRIVE_LIMIT)", () => {
    const move = out.days.find((d) => d.move)!;
    expect(reasonOf(move.reasons, "move_day")!.text).toMatch(/^Move from Banff to Jasper: \d h \d\d ≈ of driving$/);
    expect(reasonOf(move.reasons, "long_move")).toBeDefined();
    expect(move.warnings).toContain("W_DRIVE_LIMIT");
    const driven = move.items.reduce((n, i) => n + (i.driveMin ?? 0), 0) + (move.returnMin ?? 0);
    expect(driven).toBeGreaterThan(240); // the move itself, with any stop on its line
  });
  it("spread over the days (RB-001), every pick fits: Johnston Canyon, once left out, is on a Banff day", () => {
    expect(out.didNotFit).toEqual([]);
    expect(dayOf(out, "route/johnston-canyon")).toBeLessThanOrEqual(3);
  });
});

describe("golden roadtrip-three-base: three bases, a long move day, a pick beyond every base", () => {
  const out = buildPlan(roadtrip.input);
  it("2 + 2 + 2 nights, moves on days 3 and 5 only, each between two consecutive bases", () => {
    expect(out.bases.map((x) => [x.town, x.nights])).toEqual([
      ["ca-on-ottawa", 2],
      ["ca-qc-quebec", 2],
      ["ca-qc-tadoussac", 2],
    ]);
    expect(out.days.filter((d) => d.move).map((d) => [d.day, out.days[d.day - 2]!.base, d.base])).toEqual([
      [3, "ca-on-ottawa", "ca-qc-quebec"],
      [5, "ca-qc-quebec", "ca-qc-tadoussac"],
    ]);
  });
  it("the Ottawa to Quebec City move is over the 4 h a day: a Check with the reason; the shorter move is not", () => {
    const [long, short] = out.days.filter((d) => d.move);
    expect(long!.warnings).toContain("W_DRIVE_LIMIT");
    expect(reasonOf(long!.reasons, "long_move")!.text).toContain("over your 4 h of driving a day");
    expect(reasonOf(short!.reasons, "long_move")).toBeUndefined();
    expect(reasonOf(short!.reasons, "move_day")!.text).toMatch(/^Move from Quebec City to Tadoussac: /);
  });
  it("every must is placed, on its own base's days", () => {
    expect(dayOf(out, "place/parliament-hill")).toBeLessThanOrEqual(2);
    expect([3, 4]).toContain(dayOf(out, "place/old-quebec"));
    expect(dayOf(out, "place/tadoussac-whale-watching")).toBeGreaterThanOrEqual(5);
  });
  it("Niagara Falls is TB_TOO_FAR from every base, naming the nearest (Ottawa) and a town near it; Ottawa counts it", () => {
    expect(missOf(out, "place/niagara-falls")).toMatchObject({ code: "TB_TOO_FAR", fix: { kind: "add_base", town: "ca-on-st-catharines" } });
    expect(missOf(out, "place/niagara-falls")!.reasons[0]!.text).toMatch(/^Too far from your bases: .* ≈ from Ottawa, the nearest, over the 2 h each way your 4 h of driving a day allows$/);
    expect(reasonOf(out.bases[0]!.reasons, "out_of_reach")).toMatchObject({ values: { n: 1, radiusMin: 120 } });
    expect(out.didNotFit.map((m) => m.ref)).toEqual(["place/niagara-falls"]);
  });
});

describe("golden infeasible-move: a move longer than a whole day", () => {
  const out = buildPlan(infeasibleMove.input);
  const move = out.days.find((d) => d.move)!;
  it("keeps the move day (never a silent drop), with nothing else on it, a Check and Add a base between", () => {
    expect(move.day).toBe(3);
    expect(move.items).toEqual([]);
    expect(move.warnings).toContain("W_DRIVE_LIMIT");
    expect(reasonOf(move.reasons, "move_over_day")!.text).toMatch(/longer than a whole day at your pace \(10 h 30\): add a base between$/);
  });
  it("each base's picks are still planned on its own days", () => {
    expect(dayOf(out, "place/arrowhead")).toBeLessThanOrEqual(2);
    expect(dayOf(out, "place/kakabeka-falls")).toBeGreaterThanOrEqual(4);
    expect(out.didNotFit).toEqual([]);
  });
});
