// TB-G1: the build-time budget (trip-builder.md 4.11: 300 ms per build). Opt-in, because wall-clock time is a property of the machine,
// not of the code: `TB_TIMING=1 pnpm --dir core golden:timing`. Skipped in the default unit run and in check-all.
import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/plan/engine.ts";
import { GOLDENS } from "../fixtures/plan/index.ts";
import { REVIEW_TRIPS } from "../fixtures/plan/review.ts";
import { mkBuild, mkInput, mkPlace, mkTown, placesMap, seeded } from "./engine-fixture.ts";

const BUDGET_MS = 300;
const ON = process.env.TB_TIMING === "1";

/** The median of `runs` timed builds after a warm-up, so one GC pause or JIT compile does not decide it. */
function medianMs(run: () => unknown, runs = 9): number {
  run();
  const t: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    run();
    t.push(performance.now() - s);
  }
  return t.sort((a, b) => a - b)[Math.floor(runs / 2)]!;
}

describe.skipIf(!ON)(`build time, median of 9, budget ${BUDGET_MS} ms`, () => {
  for (const c of GOLDENS) {
    it(`golden ${c.name}`, () => {
      expect(medianMs(() => buildPlan(c.input))).toBeLessThan(BUDGET_MS);
    });
  }
  for (const f of REVIEW_TRIPS) {
    const c = f();
    it(`review trip ${c.name} (the real drive model)`, () => {
      expect(medianMs(() => buildPlan(c.input))).toBeLessThan(BUDGET_MS);
    });
  }
  it("the largest auto build: 40 picks over two regions, the service's 120 towns, 21 nights (the plan chooses up to 4 bases)", () => {
    const r = seeded(11);
    const ps = Array.from({ length: 40 }, (_, i) => mkPlace(`place/wide-${i}`, 44.5 + r() * 2.5, -80 + r() * 4, { visitMin: 30 + Math.floor(r() * 150) }));
    const towns = Array.from({ length: 120 }, (_, i) => mkTown(`ca-on-wide-${i}`, `Wide ${i}`, 44.5 + r() * 2.5, -80 + r() * 4, 1000 + i));
    const input = mkInput(mkBuild(ps.map((p) => p.ref), { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 21, moves: "shorter" }), { places: placesMap(ps), towns });
    expect(medianMs(() => buildPlan(input))).toBeLessThan(BUDGET_MS);
  });
  it("the largest build: 40 picks, 40 towns, 14 nights", () => {
    const r = seeded(7);
    const ps = Array.from({ length: 40 }, (_, i) => mkPlace(`place/perf-${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, { visitMin: 30 + Math.floor(r() * 150) }));
    const towns = Array.from({ length: 40 }, (_, i) => mkTown(`ca-on-town-${i}`, `Town ${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, 1000 + i));
    const input = mkInput(mkBuild(ps.map((p) => p.ref), { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 14 }), { places: placesMap(ps), towns });
    expect(medianMs(() => buildPlan(input))).toBeLessThan(BUDGET_MS);
  });
});
