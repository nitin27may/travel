// The packer of the trip builder engine (TB-E1; trip-builder.md 4.6): kept stops stay, every stop lands once or is left out, each day
// within its budget and driving cap, exact orders are optimal, and the same input packs the same way.
import { describe, expect, it } from "vitest";
import { heldKarp, packDays, twoOpt, type PackDay, type PackStop } from "../../src/plan/pack.ts";
import { seeded } from "./engine-fixture.ts";

/** Points on a plane, minutes = 1.5 x the distance in grid units, rounded (asymmetric-free). */
function grid(points: Record<string, [number, number]>): (a: string, b: string) => number | null {
  return (a, b) => {
    const p = points[a];
    const q = points[b];
    if (!p || !q) return null;
    return Math.round(1.5 * Math.hypot(p[0] - q[0], p[1] - q[1]));
  };
}

const routeCost = (from: string, to: string, refs: readonly string[], c: (a: string, b: string) => number): number => {
  let t = 0;
  let at = from;
  for (const r of refs) {
    t += c(at, r);
    at = r;
  }
  return t + c(at, to);
};

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

describe("exact and approximate day orders", () => {
  it("Held-Karp finds the shortest order (checked against every permutation)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = seeded(seed);
      const pts: Record<string, [number, number]> = { B: [50, 50] };
      const refs = Array.from({ length: 2 + (seed % 5) }, (_, i) => `s${i}`);
      for (const x of refs) pts[x] = [r() * 100, r() * 100];
      const c = (a: string, b: string) => grid(pts)(a, b)!;
      const best = Math.min(...permutations(refs).map((p) => routeCost("B", "B", p, c)));
      expect(routeCost("B", "B", heldKarp("B", "B", refs, c), c)).toBe(best);
    }
  });

  it("2-opt never returns a route longer than nearest neighbour and always ends", () => {
    const r = seeded(99);
    const pts: Record<string, [number, number]> = { B: [0, 0] };
    const refs = Array.from({ length: 16 }, (_, i) => `s${i}`);
    for (const x of refs) pts[x] = [r() * 100, r() * 100];
    const c = (a: string, b: string) => grid(pts)(a, b)!;
    const out = twoOpt("B", "B", refs, c);
    expect([...out].sort()).toEqual([...refs].sort());
    expect(routeCost("B", "B", out, c)).toBeLessThanOrEqual(routeCost("B", "B", refs, c));
  });
});

describe("packDays", () => {
  const pts: Record<string, [number, number]> = { B: [0, 0], a: [10, 0], b: [12, 2], c: [-10, 0], d: [-11, -3], e: [0, 30], far: [400, 400] };
  const cost = grid(pts);
  const day = (n: number, over: Partial<PackDay> = {}): PackDay => ({ day: n, from: "B", to: "B", budgetMin: 300, driveCapMin: 240, ...over });
  const stop = (ref: string, over: Partial<PackStop> = {}): PackStop => ({ ref, visitMin: 60, must: false, score: 50, bearing: null, ...over });

  it("puts every stop on one day once, or leaves it out", () => {
    const res = packDays({ stops: ["a", "b", "c", "d", "e", "far"].map((r) => stop(r)), days: [day(1), day(2)], cost });
    const on = res.days.flatMap((d) => d.refs);
    expect(new Set(on).size).toBe(on.length);
    expect([...on, ...res.unplaced].sort()).toEqual(["a", "b", "c", "d", "e", "far"]);
    expect(res.unplaced).toEqual(["far"]); // beyond the driving cap of every day
  });

  it("keeps each day within its budget and its driving cap", () => {
    const res = packDays({ stops: ["a", "b", "c", "d", "e"].map((r) => stop(r, { visitMin: 120 })), days: [day(1), day(2)], cost });
    for (const d of res.days) {
      expect(d.loadMin).toBeLessThanOrEqual(300);
      expect(d.extraDriveMin).toBeLessThanOrEqual(240);
    }
    expect(res.unplaced.length).toBeGreaterThan(0);
  });

  it("a must takes the room before a nice-to-have", () => {
    const stops = [stop("a", { visitMin: 200, score: 90 }), stop("c", { visitMin: 200, must: true, score: 10 })];
    const res = packDays({ stops, days: [day(1)], cost });
    expect(res.days[0]!.refs).toEqual(["c"]);
    expect(res.unplaced).toEqual(["a"]);
  });

  it("kept stops keep their day and their order, even over the budget", () => {
    const stops = [stop("a", { fixed: { day: 2, rank: 1 }, visitMin: 400 }), stop("b", { fixed: { day: 2, rank: 0 } }), stop("c")];
    const res = packDays({ stops, days: [day(1), day(2)], cost });
    const d2 = res.days.find((d) => d.day === 2)!.refs;
    expect(d2.indexOf("b")).toBeLessThan(d2.indexOf("a"));
    expect(res.days.flatMap((d) => d.refs)).toContain("c");
  });

  it("groups close stops on the same day (sweep, then relocations that cut the driving)", () => {
    const stops = ["a", "b", "c", "d"].map((r) => stop(r, { bearing: r === "a" || r === "b" ? 90 : 270 }));
    const res = packDays({ stops, days: [day(1), day(2)], cost });
    const together = (x: string, y: string) => res.days.some((d) => d.refs.includes(x) && d.refs.includes(y));
    expect(together("a", "b")).toBe(true);
    expect(together("c", "d")).toBe(true);
  });

  it("is deterministic and ignores the input order of the stops", () => {
    const stops = ["a", "b", "c", "d", "e"].map((r, i) => stop(r, { score: 10 * i, bearing: i * 70 }));
    const one = packDays({ stops, days: [day(1), day(2), day(3)], cost });
    const two = packDays({ stops: [...stops].reverse(), days: [day(3), day(1), day(2)], cost });
    expect(two.days).toEqual(one.days);
  });

  it("an edge day carries the way in: its budget counts only the driving beyond it", () => {
    const pts2 = { ...pts, S: [-100, 0] as [number, number] };
    const res = packDays({ stops: [stop("c", { visitMin: 30 })], days: [day(1, { from: "S", to: "B", budgetMin: 60 })], cost: grid(pts2) });
    expect(res.days[0]!.refs).toEqual(["c"]); // c lies on the way from S to B
    expect(res.days[0]!.extraDriveMin).toBeLessThanOrEqual(60);
  });
});
