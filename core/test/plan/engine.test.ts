// The trip builder engine v1 (TB-E1; trip-builder.md 4.2 to 4.11): K = 1 builds, did-not-fit codes and fixes, kept stops, the answer
// shape, determinism, and the property tests of 4.11 (every pick on one day or in Did not fit, never both; days within their caps; no
// negative times; the same input gives the same plan).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDER_ENGINE, BUILDER_PACK, BUILDER_SCORE } from "../../src/config/builder.ts";
import { buildPlan, dayDriveMin, dayTripRadiusMin } from "../../src/plan/engine.ts";
import { buildChecks, knownCosts } from "../../src/plan/summary.ts";
import { dayCapMin } from "../../src/schedule/rules.ts";
import { planBuild, planMatrixRules, type PlanBuild, type PlanBuildInput } from "../../src/schema/api/plan.ts";
import { PLAN_ENGINE_RE } from "../../src/schema/plan-draft.ts";
import { profileOf } from "../../src/plan/score.ts";
import { ONT, mkBuild, mkInput, mkPlace, mkTown, placesMap, seeded } from "./engine-fixture.ts";

const ALL = ONT.places.map((p) => p.ref);
const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const missOf = (out: PlanBuild, ref: string) => out.didNotFit.find((m) => m.ref === ref);

describe("the spec's numbers live in config/builder.ts (4.3, 4.4)", () => {
  it("score parts and the day-trip radius", () => {
    expect(BUILDER_SCORE.draw).toEqual({ journey: 40, detour: 25, local: 10, unknown: 15 });
    expect(BUILDER_SCORE.fit.pass).toBe(30);
    expect(BUILDER_SCORE.season.in).toBe(20);
    expect(BUILDER_PACK.dayTripRadiusCapMin).toBe(120);
    expect(PLAN_ENGINE_RE.test(BUILDER_ENGINE)).toBe(true);
  });
  it("the radius is half the day's driving, capped at 2 h one way (TF7)", () => {
    expect(dayTripRadiusMin({ pace: "relaxed" })).toBe(90);
    expect(dayTripRadiusMin({ pace: "standard" })).toBe(120);
    expect(dayTripRadiusMin({ pace: "full" })).toBe(120);
    expect(dayTripRadiusMin({ pace: "full", driveDayMin: 120 })).toBe(60);
    expect(dayDriveMin({ pace: "standard", driveDayMin: 300 })).toBe(300);
  });
});

describe("a K = 1 build", () => {
  const out = buildPlan(mkInput(mkBuild(ALL, { party: { adults: 2, children: [6], walkKm: null } })));

  it("parses as the build answer, with a square matrix", () => {
    const r = planBuild.safeParse(out);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    expect(planMatrixRules(out.matrix)).toEqual([]);
    expect(out.engine).toBe(BUILDER_ENGINE);
    expect(out.basis).toBe("estimate"); // no routed cell given: every leg is the model's (≈)
  });

  it("one base for every night, slept at on days 1 to nights, none after the last day", () => {
    expect(out.bases).toHaveLength(1);
    expect(out.bases[0]!.nights).toBe(2);
    expect(out.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(out.days.map((d) => d.base)).toEqual([out.bases[0]!.town, out.bases[0]!.town, null]);
    expect(out.days.every((d) => d.move === false)).toBe(true);
  });

  it("explains the base with numbers, never without", () => {
    const codes = out.bases[0]!.reasons.map((r) => r.code);
    expect(codes[0]).toBe("covers_picks");
    expect(codes).toContain("from_start");
    for (const r of [...out.bases.flatMap((b) => b.reasons), ...out.days.flatMap((d) => d.reasons), ...out.didNotFit.flatMap((m) => m.reasons)]) {
      expect(Object.keys(r.values).length).toBeGreaterThan(0);
    }
    expect(out.bases[0]!.reasons[0]!.text).toMatch(/≈/); // estimated figures say so
  });

  it("the far pick is TB_TOO_FAR with Add a base; the age-limited one TB_FIT; the rest are placed", () => {
    expect(missOf(out, "place/parliament-hill")).toMatchObject({ code: "TB_TOO_FAR", fix: { kind: "add_base" } });
    expect(missOf(out, "place/zipline-park")).toMatchObject({ code: "TB_FIT", reasons: [{ text: "Needs age 12; youngest is 6" }] });
    expect(placed(out).sort()).toEqual(["place/arrowhead", "place/dorset-tower", "place/oxtongue-lake", "place/ragged-falls", "route/lake-of-two-rivers-trail"]);
  });

  it("the same input gives the same plan, whatever order the towns and places arrive in", () => {
    const b = mkBuild(ALL, { party: { adults: 2, children: [6], walkKm: null } });
    const again = buildPlan(mkInput(b, { towns: [...ONT.towns].reverse(), places: placesMap([...ONT.places].reverse()) }));
    expect(JSON.stringify(again)).toBe(JSON.stringify(out));
  });

  it("never reads the home point, the environment or a clock", () => {
    for (const f of ["engine.ts", "score.ts", "candidates.ts", "pack.ts", "reasons.ts", "driveTable.ts", "summary.ts", "engineTypes.ts", "area.ts"]) {
      const src = readFileSync(new URL(`../../src/plan/${f}`, import.meta.url), "utf8");
      expect(src, f).not.toMatch(/from\s+["'][^"']*(?:privacy\/home|drive\/keys)|process\.env|Date\.now|new Date\(|Math\.random/);
    }
  });
});

describe("did not fit: each honest code with one fix (4.7)", () => {
  it("TB_UNKNOWN: a pick we no longer list (Remove it), and one with no point (Ask us)", () => {
    const places = placesMap([...ONT.places, mkPlace("place/no-point", null, null)]);
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead", "place/gone", "place/no-point"]), { places }));
    expect(missOf(out, "place/gone")).toMatchObject({ code: "TB_UNKNOWN", fix: { kind: "drop" }, reasons: [{ code: "not_listed" }] });
    expect(missOf(out, "place/no-point")).toMatchObject({ code: "TB_UNKNOWN", fix: { kind: "ask_us" }, reasons: [{ code: "no_location" }] });
  });

  it("TB_CLOSED in the chosen month, with Change month; open in the shoulder month", () => {
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead", "place/oxtongue-lake"], { month: 1 })));
    expect(missOf(out, "place/arrowhead")).toMatchObject({ code: "TB_CLOSED", fix: { kind: "change_month" }, reasons: [{ text: "Closed in January" }] });
    const shoulder = buildPlan(mkInput(mkBuild(["place/arrowhead"], { month: 4 })));
    expect(shoulder.didNotFit).toEqual([]);
  });

  it("advice is not a rule: an advised age keeps the place on a day", () => {
    const places = placesMap([...ONT.places, mkPlace("place/soft-limit", 45.35, -79.15, { suitability: { ...ONT.places[6]!.suitability!, rule: "advice" } })]);
    const out = buildPlan(mkInput(mkBuild(["place/soft-limit"], { party: { adults: 2, children: [6], walkKm: null } }), { places }));
    expect(placed(out)).toEqual(["place/soft-limit"]);
  });

  it("TB_TIME with the smallest Add N days the engine confirmed, else Drop", () => {
    const many = Array.from({ length: 9 }, (_, i) => mkPlace(`place/stop-${i}`, 45.33 + i * 0.01, -79.1, { visitMin: 180 }));
    const out = buildPlan(mkInput(mkBuild(many.map((p) => p.ref), { nights: 1 }), { places: placesMap(many) }));
    const time = out.didNotFit.filter((m) => m.code === "TB_TIME");
    expect(time.length).toBeGreaterThan(0);
    for (const m of time) expect(m.fix?.kind === "add_days" ? m.fix.days : 0).toBeGreaterThanOrEqual(1);
    const bigger = buildPlan(mkInput(mkBuild(many.map((p) => p.ref), { nights: 1 + Math.max(...time.map((m) => m.fix!.days ?? 0)) }), { places: placesMap(many) }));
    expect(bigger.didNotFit.filter((m) => time.some((t) => t.ref === m.ref))).toEqual([]);
  });

  it("an infeasible must: TB_TOO_FAR with a town near it; nothing else moves", () => {
    const base = mkBuild(["place/arrowhead", "place/oxtongue-lake", "place/dorset-tower"]);
    const towns = [...ONT.towns, mkTown("ca-on-ottawa", "Ottawa", 45.4215, -75.6972, 1000000)];
    const without = buildPlan(mkInput(base, { towns }));
    const withFar = buildPlan(mkInput({ ...base, picks: [...base.picks, { ref: "place/parliament-hill", must: true }] }, { towns }));
    expect(missOf(withFar, "place/parliament-hill")).toMatchObject({ code: "TB_TOO_FAR", fix: { kind: "add_base", town: "ca-on-ottawa" } });
    expect(withFar.days.map((d) => d.items.map((i) => i.ref))).toEqual(without.days.map((d) => d.items.map((i) => i.ref)));
  });
});

describe("bases, modes and kept stops", () => {
  it("a pinned base is kept and says so", () => {
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead", "place/oxtongue-lake"], { bases: [{ town: "ca-on-bracebridge", nights: 2, pinned: true }] })));
    expect(out.bases[0]).toMatchObject({ town: "ca-on-bracebridge", pinned: true });
    expect(out.bases[0]!.reasons[0]!.code).toBe("pinned_base");
  });

  it("a near-mode day trip has no base, one day, and drives there and back", () => {
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead"], { nights: 0 })));
    expect(out.bases).toEqual([]);
    expect(out.days).toHaveLength(1);
    expect(out.days[0]!.base).toBeNull();
    expect(out.days[0]!.items[0]!.driveMin).toBeGreaterThan(0);
    expect(out.days[0]!.returnMin).toBeGreaterThan(0);
    expect(out.spareDays).toBe(0);
  });

  it("a trip-mode plan with no gateway still builds around a base", () => {
    const b = mkBuild(["place/arrowhead", "place/oxtongue-lake", "place/dorset-tower"], { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 3 });
    const out = buildPlan(mkInput(b));
    expect(out.bases).toHaveLength(1);
    expect(out.days).toHaveLength(4);
    expect(out.didNotFit).toEqual([]);
    expect(planBuild.safeParse(out).success).toBe(true);
  });

  it("a light plan leaves spare days, offered and never filled (4.5)", () => {
    const b = mkBuild(["place/arrowhead"], { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 6 });
    const out = buildPlan(mkInput(b));
    expect(placed(out)).toEqual(["place/arrowhead"]);
    expect(out.spareDays).toBeGreaterThanOrEqual(4);
  });

  it("locked and placed-by-you stops keep their day and order on every rebuild (TF11)", () => {
    const edits: PlanBuildInput["edits"] = [
      { day: 3, refs: ["place/dorset-tower", "place/arrowhead"], locked: ["place/arrowhead"], placed: ["place/dorset-tower"] },
    ];
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead", "place/oxtongue-lake", "place/dorset-tower", "place/ragged-falls"], { edits })));
    const day3 = out.days.find((d) => d.day === 3)!.items.map((i) => i.ref);
    expect(day3.indexOf("place/dorset-tower")).toBeGreaterThanOrEqual(0);
    expect(day3.indexOf("place/dorset-tower")).toBeLessThan(day3.indexOf("place/arrowhead"));
    expect(out.days.find((d) => d.day === 3)!.items.find((i) => i.ref === "place/arrowhead")!.locked).toBe(true);
    expect(out.days.find((d) => d.day === 3)!.reasons.map((r) => r.code)).toContain("kept_items");
  });

  it("a kept stop stays placed even beyond the radius (the day checks say so)", () => {
    const edits: PlanBuildInput["edits"] = [{ day: 2, refs: ["place/parliament-hill"], locked: ["place/parliament-hill"] }];
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead", "place/parliament-hill"], { edits })));
    expect(out.days[1]!.items.map((i) => i.ref)).toContain("place/parliament-hill");
    expect(missOf(out, "place/parliament-hill")).toBeUndefined();
  });

  it("routed cells are used where the leg cache has them, the model elsewhere (≈), and the start is never routed", () => {
    const b = mkBuild(["place/arrowhead"], { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 1, bases: [{ town: "ca-on-huntsville", nights: 1, pinned: true }] });
    const routed = new Map([
      ["t:ca-on-huntsville>p:place/arrowhead", 9],
      ["p:place/arrowhead>t:ca-on-huntsville", 9],
    ]);
    const out = buildPlan(mkInput(b, { routed }));
    const item = out.days.flatMap((d) => d.items).find((i) => i.ref === "place/arrowhead")!;
    expect(item).toMatchObject({ driveMin: 9, basis: "routed" });
    expect(out.basis).toBe("routed");
    const nearDay = buildPlan(mkInput(mkBuild(["place/arrowhead"], { nights: 0 }), { routed: new Map([["s>p:place/arrowhead", 1]]) }));
    expect(nearDay.days[0]!.items[0]!.basis).toBe("estimate");
  });
});

describe("summary lines (Checks, Known costs)", () => {
  const out = buildPlan(mkInput(mkBuild(ALL)));
  it("checks count the driving and the levels", () => {
    const c = buildChecks(out);
    expect(c.days).toBe(3);
    expect(c.driveTotalMin).toBeGreaterThan(0);
    expect(c.driveDayMaxMin).toBeGreaterThanOrEqual(c.driveDayAvgMin);
    expect(c.estimated).toBe(true);
    expect(c.didNotFit).toBe(out.didNotFit.length);
  });
  it("known costs count bands over placed stops only", () => {
    const k = knownCosts(out, (ref) => (ref === "place/arrowhead" ? "free" : ref === "place/oxtongue-lake" ? "$" : null));
    expect(k).toEqual({ priced: placed(out).includes("place/oxtongue-lake") ? 2 : 1, of: placed(out).length, free: 1 });
  });
});

// ---- property tests (4.11) -------------------------------------------------------------------------------------------------------

function randomCase(seed: number): { build: PlanBuildInput; places: Map<string, ReturnType<typeof mkPlace>> } {
  const r = seeded(seed);
  const n = 3 + Math.floor(r() * 18);
  const ps = Array.from({ length: n }, (_, i) =>
    mkPlace(`place/p${seed}-${i}`, 44.9 + r() * 1.0, -79.6 + r() * 1.4, {
      visitMin: 20 + Math.floor(r() * 200),
      kind: r() < 0.3 ? "trail" : "lake",
      season: r() < 0.1 ? [1, 2] : [5, 6, 7, 8, 9],
      suitability: r() < 0.1 ? { ...ONT.places[6]!.suitability! } : null,
      draw: (["journey", "detour", "local", null] as const)[Math.floor(r() * 4)]!,
    }),
  );
  const nights = Math.floor(r() * 6);
  const near = r() < 0.6;
  const picks = ps.map((p) => ({ ref: p.ref, must: r() < 0.2 }));
  const lockDay = 1 + Math.floor(r() * (nights + 1));
  const edits: PlanBuildInput["edits"] = r() < 0.4 && ps.length > 2 ? [{ day: lockDay, refs: [ps[0]!.ref, ps[1]!.ref], locked: [ps[0]!.ref] }] : [];
  const build = mkBuild(picks, {
    nights,
    pace: (["relaxed", "standard", "full"] as const)[Math.floor(r() * 3)]!,
    where: near ? { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 180 + 15 * Math.floor(r() * 8) } : { mode: "trip", cc: "CA", regions: ["CA/ontario"] },
    party: r() < 0.5 ? { adults: 2, children: [3 + Math.floor(r() * 10)], walkKm: null } : { adults: 2, children: [], walkKm: null },
    edits,
    ...(r() < 0.5 ? { driveDayMin: 120 + 15 * Math.floor(r() * 12) } : {}),
  });
  return { build, places: placesMap(ps) };
}

describe("properties over 60 generated plans", () => {
  const cases = Array.from({ length: 60 }, (_, i) => ({ seed: 1000 + i, ...randomCase(1000 + i) }));

  for (const c of cases) {
    it(`seed ${c.seed}`, () => {
      const input = mkInput(c.build, { places: c.places, start: c.build.where.mode === "near" ? ONT.start : null });
      const out = buildPlan(input);
      // the answer is valid
      expect(planBuild.safeParse(out).success).toBe(true);
      const onDays = placed(out);
      // every placed stop is on one day, once
      expect(new Set(onDays).size).toBe(onDays.length);
      // Did not fit lists exactly the unplaced picks: none lost, none in both
      const missed = out.didNotFit.map((m) => m.ref);
      expect(new Set([...onDays, ...missed]).size).toBe(onDays.length + missed.length);
      expect([...onDays, ...missed].sort()).toEqual(c.build.picks.map((p) => p.ref).sort());
      // no negative times; starts climb within a day; visits within one day
      const profile = profileOf(c.build.party, c.build.pace);
      for (const d of out.days) {
        let last = -1;
        for (const it of d.items) {
          expect(it.visitMin).toBeGreaterThanOrEqual(0);
          if (it.driveMin !== null) expect(it.driveMin).toBeGreaterThanOrEqual(0);
          if (it.startMin !== null) {
            expect(it.startMin).toBeGreaterThanOrEqual(0);
            expect(it.startMin).toBeGreaterThanOrEqual(last);
            last = it.startMin;
          }
        }
        if (d.returnMin !== null) expect(d.returnMin).toBeGreaterThanOrEqual(0);
      }
      // a day the engine packed itself (nothing kept on it, no must over the pace) stays within the day's cap
      const keptDays = new Set(c.build.edits.map((e) => e.day));
      const cap = dayCapMin(profile);
      for (const d of out.days) {
        if (keptDays.has(d.day) || (c.build.where.mode === "near" && c.build.nights === 0)) continue;
        if (d.reasons.some((r) => r.code === "over_pace")) {
          expect(d.warnings).toContain("W_PACE"); // RB-005: a must kept over the pace is a Check on its day
          continue;
        }
        const load = d.items.reduce((n, i) => n + i.visitMin + (i.driveMin ?? 0), 0) + (d.returnMin ?? 0);
        // the packer holds visits and the driving beyond the way in or out within the cap; the way in or out itself is the trip's
        const edge = d.day === 1 || d.day === c.build.nights + 1 ? 2 * 480 : 0;
        expect(load).toBeLessThanOrEqual(cap + edge);
      }
      // a must is never left out without a fix (RB-005): placed, or Did not fit with the one fix its code allows
      for (const p of c.build.picks.filter((x) => x.must)) {
        const m = out.didNotFit.find((x) => x.ref === p.ref);
        if (m) {
          expect(m.code).not.toBe("TB_TIME");
          expect(m.fix).not.toBeNull();
        }
      }
      // locked stops keep their day
      for (const e of c.build.edits) for (const r of e.locked) if (onDays.includes(r)) expect(out.days.find((d) => d.day === e.day)!.items.map((i) => i.ref)).toContain(r);
      // the same input, the same plan
      expect(JSON.stringify(buildPlan(input))).toBe(JSON.stringify(out));
    });
  }
});

describe("size (4.11)", () => {
  it("40 picks, 40 towns, 14 nights build a valid plan (the 300 ms budget is TB-G1's timing check)", () => {
    const r = seeded(7);
    const ps = Array.from({ length: 40 }, (_, i) => mkPlace(`place/perf-${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, { visitMin: 30 + Math.floor(r() * 150) }));
    const towns = Array.from({ length: 40 }, (_, i) => mkTown(`ca-on-town-${i}`, `Town ${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, 1000 + i));
    const b = mkBuild(ps.map((p) => p.ref), { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 14 });
    const out = buildPlan(mkInput(b, { places: placesMap(ps), towns }));
    expect(planBuild.safeParse(out).success).toBe(true);
    expect(placed(out).length + out.didNotFit.length).toBe(40);
  });
});
