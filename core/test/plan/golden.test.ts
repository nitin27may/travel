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
import { GOLDENS, algonquin, daytrip, infeasibleClosed, infeasibleTime, quebec, type GoldenCase } from "../fixtures/plan/index.ts";
import { ALGONQUIN_PARK } from "../fixtures/plan/algonquin.ts";
import { mkBuild, mkInput, mkPlace, placesMap } from "./engine-fixture.ts";

const DIR = new URL("../fixtures/plan/", import.meta.url);
const fileOf = (c: GoldenCase): URL => new URL(`${c.name}.expected.json`, DIR);
/** The pinned form: two-space JSON and a final newline. */
const serialise = (out: PlanBuild): string => `${JSON.stringify(out, null, 2)}\n`;
const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const missOf = (out: PlanBuild, ref: string) => out.didNotFit.find((m) => m.ref === ref);
const allReasons = (out: PlanBuild) => [...out.bases.flatMap((b) => b.reasons), ...out.days.flatMap((d) => d.reasons), ...out.didNotFit.flatMap((m) => m.reasons)];

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

    it("places every pick once, or lists it in Did not fit, never both", () => {
      const on = placed(out);
      const missed = out.didNotFit.map((m) => m.ref);
      expect(new Set(on).size).toBe(on.length);
      expect(new Set(missed).size).toBe(missed.length);
      expect(on.filter((r) => missed.includes(r))).toEqual([]);
      // a locked stop may sit on a day without being a pick; a pick is always one or the other
      expect([...on, ...missed].filter((r) => b.picks.some((p) => p.ref === r)).sort()).toEqual(b.picks.map((p) => p.ref).sort());
    });

    it("holds each day to its cap (a day with the way in or out may add one leg each)", () => {
      const cap = dayCapMin(profileOf(b.party, b.pace));
      for (const d of out.days) {
        const load = d.items.reduce((n, i) => n + i.visitMin + (i.driveMin ?? 0), 0) + (d.returnMin ?? 0);
        const edge = d.day === 1 || d.day === b.nights + 1 ? 2 * 480 : 0;
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
  // ENGINE GAP (TB-PIN R1, BACKLOG 15.354): TB-E1 has no notion of an area pick. A protected-area pick should be the trip's area, never a
  // stop with a visit time. Today it is scheduled like a place (a 180 min visit on the last day). Flip to `it` when the engine pins it.
  it.fails("the park pick is never a stop on a day (TB-PIN)", () => {
    expect(placed(out)).not.toContain(ALGONQUIN_PARK);
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
  it("too many must-sees: the unplaced are TB_TIME with an Add N days that fits, or TB_TOO_FAR", () => {
    const picks = infeasibleTime.input.build.picks.map((p) => p.ref);
    const on = placed(time);
    expect(on.length).toBeGreaterThan(0);
    expect(time.didNotFit.map((m) => m.ref).sort()).toEqual(picks.filter((r) => !on.includes(r)).sort());
    for (const m of time.didNotFit) {
      expect(["TB_TIME", "TB_TOO_FAR"]).toContain(m.code);
      expect(m.reasons.length).toBeGreaterThan(0);
      if (m.code === "TB_TIME") expect(m.fix).toMatchObject({ kind: "add_days" });
    }
    expect(missOf(time, "place/parliament-hill")).toMatchObject({ code: "TB_TOO_FAR", fix: { kind: "add_base", town: "ca-on-ottawa" } });
    expect(missOf(time, "place/parliament-hill")!.reasons[0]!.text).toContain("≈");
  });
  it("the smallest Add N days really fits it (rebuild with those nights)", () => {
    const m = time.didNotFit.find((x) => x.code === "TB_TIME" && x.fix?.kind === "add_days")!;
    const more = buildPlan({ ...infeasibleTime.input, build: { ...infeasibleTime.input.build, nights: infeasibleTime.input.build.nights + m.fix!.days! } });
    expect(placed(more)).toContain(m.ref);
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
  // see the hand-back of TB-G1; core/src/plan is not edited by this task
  it.fails("an area pick (kind park, no visit time) is not given a visit time (TB-PIN)", () => {
    const park = mkPlace("place/some-park", 45.5, -78.4, { kind: "park", type: "protected-area", visitMin: null });
    const out = buildPlan(mkInput(mkBuild(["place/some-park", "place/arrowhead"]), { places: placesMap([park, mkPlace("place/arrowhead", 45.39, -79.21)]) }));
    expect(placed(out)).not.toContain("place/some-park");
  });
});
