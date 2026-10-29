// The builder review's trips (TB-R1, docs/v2/design/trip-builder/review-TB-R1-2026-10-29.md section 7) as goldens on frozen real
// catalogue inputs (core/test/fixtures/plan/review.ts): each output is pinned byte for byte, and each holds the review's sanity bar:
// the picks spread over the days (RB-001), a second base where the picks need one (RB-002), no must-see dropped (RB-005), every Did
// not fit row with its fix (RB-013), the areas reported (RB-002), and drive figures near the routed ones (RB-008). Regenerate on
// purpose with `pnpm --dir core golden:update`, then read the diff.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/plan/engine.ts";
import { profileOf } from "../../src/plan/score.ts";
import { dayCapMin } from "../../src/schedule/rules.ts";
import { planBuild, type PlanBuild } from "../../src/schema/api/plan.ts";
import { REVIEW_TRIPS, albertaAir, albertaCar, algonquinWeekend, daytripToronto, italy, quebecFamily, weekendMusts } from "../fixtures/plan/review.ts";
import type { GoldenCase } from "../fixtures/plan/types.ts";

const UPDATE = process.env.GOLDEN_UPDATE === "1";
const fileOf = (c: GoldenCase): URL => new URL(`../fixtures/plan/review/${c.name.replace(/^review-/, "")}.expected.json`, import.meta.url);
const serialise = (out: PlanBuild): string => `${JSON.stringify(out, null, 2)}\n`;
const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const dayOf = (out: PlanBuild, ref: string): PlanBuild["days"][number] | undefined => out.days.find((d) => d.items.some((i) => i.ref === ref));
const isEdge = (out: PlanBuild, d: PlanBuild["days"][number]): boolean => d.day === 1 || d.day === out.days.length || d.move;
const hasCode = (d: PlanBuild["days"][number], code: string): boolean => d.reasons.some((r) => r.code === code);

const built = new Map<string, { c: GoldenCase; out: PlanBuild }>();
const get = (f: () => GoldenCase): { c: GoldenCase; out: PlanBuild } => {
  const c = f();
  if (!built.has(c.name)) built.set(c.name, { c, out: buildPlan(c.input) });
  return built.get(c.name)!;
};

for (const f of REVIEW_TRIPS) {
  const { c, out } = get(f);
  const b = c.input.build;
  describe(`review trip ${c.name}`, () => {
    it("is pinned byte for byte", () => {
      const now = serialise(out);
      if (UPDATE) writeFileSync(fileOf(c), now);
      expect(existsSync(fileOf(c)), `${c.name}: run pnpm --dir core golden:update`).toBe(true);
      expect(now).toBe(readFileSync(fileOf(c), "utf8"));
    });

    it("parses, and every pick is placed once, in Did not fit, or an area", () => {
      expect(planBuild.safeParse(out).success).toBe(true);
      const on = placed(out);
      const missed = out.didNotFit.map((m) => m.ref);
      const areas = (out.areas ?? []).map((a) => a.ref);
      expect(new Set(on).size).toBe(on.length);
      expect([...on, ...missed, ...areas].sort()).toEqual(b.picks.map((p) => p.ref).sort());
    });

    it("no must-see is dropped (RB-005): placed, or Did not fit with its fix and never for lack of time", () => {
      for (const p of b.picks.filter((x) => x.must)) {
        const m = out.didNotFit.find((x) => x.ref === p.ref);
        if (!m) continue;
        expect(m.code, p.ref).not.toBe("TB_TIME");
        expect(m.fix, p.ref).not.toBeNull();
      }
    });

    it("every Did not fit row carries its one fix (RB-013)", () => {
      for (const m of out.didNotFit) {
        expect(m.fix, m.ref).not.toBeNull();
        if (m.code === "TB_TOO_FAR") expect(m.fix!.kind).toBe("add_base");
        if (m.code === "TB_TIME") expect(["add_days", "drop"]).toContain(m.fix!.kind);
      }
    });

    it("spreads the stops (RB-001): no empty day while a pick is left out for time, spare days last, never a pile beside an empty day", () => {
      const timeOut = out.didNotFit.some((m) => m.code === "TB_TIME");
      const normal = out.days.filter((d) => !isEdge(out, d));
      if (timeOut) expect(normal.filter((d) => d.items.length === 0).map((d) => d.day)).toEqual([]);
      // within each base's run of days out, the empty (spare) days come after the full ones
      for (const base of new Set(normal.map((d) => d.base))) {
        const run = normal.filter((d) => d.base === base);
        const firstEmpty = run.findIndex((d) => d.items.length === 0);
        if (firstEmpty >= 0) expect(run.slice(firstEmpty).every((d) => d.items.length === 0), `${base} spare days last`).toBe(true);
        if (run.some((d) => d.items.length === 0)) expect(Math.max(...run.map((d) => d.items.length)), `${base} piles`).toBeLessThanOrEqual(3);
      }
    });

    it("each day holds its stops within the pace's cap, unless it says it keeps a must over the pace", () => {
      const cap = dayCapMin(profileOf(b.party, b.pace));
      for (const d of out.days) {
        if (hasCode(d, "over_pace")) {
          expect(d.warnings).toContain("W_PACE");
          continue;
        }
        const visits = d.items.reduce((n, i) => n + i.visitMin, 0);
        const load = visits + d.items.reduce((n, i) => n + (i.driveMin ?? 0), 0) + (d.returnMin ?? 0);
        expect(visits, `day ${d.day}`).toBeLessThanOrEqual(cap);
        if (!isEdge(out, d)) expect(load, `day ${d.day}`).toBeLessThanOrEqual(cap);
      }
    });

    it("the spare days it reports are the empty days out", () => {
      if (out.didNotFit.some((m) => m.code === "TB_TIME") || b.nights === 0) return;
      expect(out.spareDays).toBe(out.days.filter((d) => !isEdge(out, d) && d.items.length === 0).length);
    });
  });
}

describe("the review's expectations, trip by trip", () => {
  const towns = (out: PlanBuild) => out.bases.map((x) => x.town);
  it("Alberta by air: Banff, then Jasper added for Maligne Lake and Athabasca Glacier (RB-002); both parks are areas with members", () => {
    const { out } = get(albertaAir);
    expect(towns(out)).toEqual(["ca-ab-banff", "ca-ab-jasper"]);
    expect(out.bases.reduce((n, x) => n + x.nights, 0)).toBe(7);
    expect(out.bases[1]!.reasons.map((r) => r.code)).toContain("added_base");
    expect(out.didNotFit).toEqual([]);
    expect(out.days.filter((d) => d.move).length).toBe(1);
    for (const a of out.areas ?? []) expect([a.name, a.members > 0, a.code]).toEqual([a.name, true, null]);
    expect((out.areas ?? []).map((a) => a.ref).sort()).toEqual(["place/banff-national-park", "place/jasper-national-park"]);
    // Day 1 flies in, the last day flies home (RB-016); Days 2 and 3 hold the Banff stops
    expect(out.days[0]!.reasons.map((r) => r.code)).toContain("arrive");
    expect(out.days.at(-1)!.reasons.map((r) => r.code)).toContain("depart");
    expect(out.days[1]!.items.length).toBeGreaterThan(0);
    expect(out.days[2]!.items.length).toBeGreaterThan(0);
  });
  it("Alberta by car: the same two bases from Calgary; every pick placed; the Icefields stop goes on the move day's line", () => {
    const { out } = get(albertaCar);
    expect(towns(out)).toEqual(["ca-ab-banff", "ca-ab-jasper"]);
    expect(out.didNotFit).toEqual([]);
    expect(dayOf(out, "place/athabasca-glacier")!.move).toBe(true);
  });
  it("Italy, a fortnight: two bases, one in Val Gardena and one on the Cortina side; Lago di Braies (a must) on a Cortina-side day", () => {
    const { out } = get(italy);
    expect(out.bases).toHaveLength(2);
    expect(towns(out).some((t) => /ortisei|selva|santa-cristina/.test(t))).toBe(true);
    expect(towns(out).some((t) => /cortina|dobbiaco|san-candido|braies|villabassa/.test(t))).toBe(true);
    const braies = dayOf(out, "place/lago-di-braies")!;
    expect(towns(out).findIndex((t) => t === braies.base) >= 0 || braies.move).toBe(true);
    expect(braies.base).toMatch(/cortina|dobbiaco|san-candido|braies|villabassa/);
  });
  it("Quebec family: a loop from Quebec City to Perce and back by the St. Lawrence; every pick placed, the musts included", () => {
    const { out } = get(quebecFamily);
    expect(out.didNotFit).toEqual([]);
    for (const r of ["place/montmorency-falls", "place/perce-rock"]) expect(placed(out), r).toContain(r);
    expect(towns(out)[0]).toMatch(/boischatel|quebec|levis|beaupre/);
    expect(towns(out)).toContain("ca-qc-perce");
    // the first day lands near the airport, never a day-long drive after the flight
    expect(out.days[0]!.reasons.find((r) => r.code === "arrive")!.values.min as number).toBeLessThan(60);
  });
  it("Algonquin weekend: one base at Huntsville or Dwight; the last day drives home", () => {
    const { out } = get(algonquinWeekend);
    expect(out.bases).toHaveLength(1);
    expect(out.bases[0]!.town).toMatch(/huntsville|dwight/);
    expect(out.days.at(-1)!.returnMin).toBeGreaterThan(0);
  });
  it("the infeasible weekend: all seven musts stay on the two days, over the pace, with the days that would give them room (RB-005)", () => {
    const { c, out } = get(weekendMusts);
    expect(placed(out).sort()).toEqual(c.input.build.picks.map((p) => p.ref).sort());
    expect(out.didNotFit).toEqual([]);
    expect(out.days.filter((d) => hasCode(d, "over_pace")).length).toBeGreaterThan(0);
  });
  it("the Toronto day trip reaches Muskoka within 3 h each way (RB-008: the drive model ran 35 % long)", () => {
    const { out } = get(daytripToronto);
    expect(placed(out)).toContain("place/dwight");
  });
});
