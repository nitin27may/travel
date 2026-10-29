// TB-G1: the build-time budget (trip-builder.md 4.11: 300 ms per build). Opt-in, because wall-clock time is a property of the machine,
// not of the code: `TB_TIMING=1 pnpm --dir core golden:timing`. Skipped in the default unit run and in check-all.
import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/plan/engine.ts";
import { GOLDENS } from "../fixtures/plan/index.ts";
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
  it("the largest build: 40 picks, 40 towns, 14 nights", () => {
    const r = seeded(7);
    const ps = Array.from({ length: 40 }, (_, i) => mkPlace(`place/perf-${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, { visitMin: 30 + Math.floor(r() * 150) }));
    const towns = Array.from({ length: 40 }, (_, i) => mkTown(`ca-on-town-${i}`, `Town ${i}`, 45 + r() * 1.2, -79.6 + r() * 1.6, 1000 + i));
    const input = mkInput(mkBuild(ps.map((p) => p.ref), { where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] }, nights: 14 }), { places: placesMap(ps), towns });
    expect(medianMs(() => buildPlan(input))).toBeLessThan(BUDGET_MS);
  });
});
