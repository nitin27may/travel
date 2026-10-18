import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  accessLoad, badgeOf, dayTripFit, drawSuggested, effectiveDraw, fameTier, passingFit, roleOf, seasonsOverlap, vacationFit, weekendFit,
} from "../../src/relevance/fit.ts";
import type { FitFacts } from "../../src/relevance/fit.ts";

const f = (o: Partial<FitFacts> = {}): FitFacts => ({ ed: "regional", standing: "good", distinction: "common", weather: "any_weather", load: "easy", detourMin: 5, onSiteMin: 60, ...o });

describe("fame tier (3.1 rule 1)", () => {
  it("takes the higher of languages and views", () => {
    expect(fameTier(25, null)).toBe("world");
    expect(fameTier(24, null)).toBe("national");
    expect(fameTier(10, null)).toBe("national");
    expect(fameTier(9, null)).toBe("regional");
    expect(fameTier(3, null)).toBe("regional");
    expect(fameTier(2, null)).toBe("local");
    expect(fameTier(1, 40000)).toBe("world");
    expect(fameTier(1, 10000)).toBe("national");
    expect(fameTier(1, 2000)).toBe("regional");
    expect(fameTier(1, 1999)).toBe("local");
    expect(fameTier(null, null)).toBe("local");
    expect(fameTier(3, 40000)).toBe("world");
  });
});

describe("draw_suggested floors (3.1 rules 2 to 4)", () => {
  const base = { languages: 1, views: null, editorial: [] };
  it("own UNESCO or national park gives at least national; a parent one gives nothing", () => {
    expect(drawSuggested({ ...base, designations: [{ type: "unesco_whs", name: "x", scope: "own" }] })).toBe("national");
    expect(drawSuggested({ ...base, designations: [{ type: "national_park", name: "x", scope: "own" }] })).toBe("national");
    expect(drawSuggested({ ...base, designations: [{ type: "unesco_whs", name: "x", scope: "parent" }, { type: "national_park", name: "y", scope: "parent" }] })).toBe("local");
  });
  it("an official highlight gives regional, or national under a world parent", () => {
    const h = { type: "official_highlight" as const, name: "x", scope: "own" as const };
    expect(drawSuggested({ ...base, designations: [h] })).toBe("regional");
    expect(drawSuggested({ ...base, designations: [h], parentFame: "world" })).toBe("national");
    expect(drawSuggested({ ...base, designations: [h, { type: "unesco_whs", name: "p", scope: "parent" }] })).toBe("national");
  });
  it("only a national or global top list raises the floor", () => {
    const m = (reach?: "regional" | "national" | "global", list: "top_list" | "listed" = "top_list") => ({ publisher: "G", title: "T", year: 2025, list, ...(reach ? { reach } : {}) });
    expect(drawSuggested({ ...base, designations: [], editorial: [m("national")] })).toBe("national");
    expect(drawSuggested({ ...base, designations: [], editorial: [m("global")] })).toBe("national");
    expect(drawSuggested({ ...base, designations: [], editorial: [m("regional")] })).toBe("local");
    expect(drawSuggested({ ...base, designations: [], editorial: [m()] })).toBe("local");
    expect(drawSuggested({ ...base, designations: [], editorial: [m("national", "listed")] })).toBe("local");
  });
  it("never lowers a high fame tier", () => {
    expect(drawSuggested({ languages: 37, views: null, designations: [{ type: "official_highlight", name: "x", scope: "own" }], editorial: [] })).toBe("world");
  });
});

describe("effective draw and seasons", () => {
  const peak = { tier: "national" as const, from: "09-20", to: "10-15" };
  it("overlaps by day, including windows that wrap the new year", () => {
    expect(seasonsOverlap(peak, { from: "10-10", to: "10-31" })).toBe(true);
    expect(seasonsOverlap(peak, { from: "10-16", to: "11-30" })).toBe(false);
    expect(seasonsOverlap({ from: "12-01", to: "02-28" }, { from: "01-10", to: "01-20" })).toBe(true);
    expect(seasonsOverlap({ from: "12-01", to: "02-28" }, { from: "06-01", to: "06-30" })).toBe(false);
    expect(seasonsOverlap({ from: "12-01", to: "02-28" }, { from: "02-27", to: "03-05" })).toBe(true);
  });
  it("uses the peak tier only when the window overlaps, and never lowers the base", () => {
    expect(effectiveDraw("regional", peak, { from: "10-01", to: "10-04" })).toBe("national");
    expect(effectiveDraw("regional", peak, { from: "07-01", to: "07-04" })).toBe("regional");
    expect(effectiveDraw("regional", peak, null)).toBe("regional");
    expect(effectiveDraw("regional", null, { from: "10-01", to: "10-04" })).toBe("regional");
    expect(effectiveDraw("world", { tier: "regional", from: "01-01", to: "12-31" }, { from: "10-01", to: "10-04" })).toBe("world");
  });
});

describe("access load (3.3)", () => {
  it("none is easy; a booking is plan; a lottery, 4WD or a month-ahead sell-out is hard", () => {
    expect(accessLoad([])).toBe("easy");
    expect(accessLoad([{ type: "seasonal_road" }, { type: "long_walk_in" }])).toBe("easy");
    expect(accessLoad([{ type: "day_permit", book_ahead_days: 5 }])).toBe("plan");
    expect(accessLoad([{ type: "shuttle_only" }])).toBe("plan");
    expect(accessLoad([{ type: "daily_cap", book_ahead_days: 30 }])).toBe("hard");
    expect(accessLoad([{ type: "permit_lottery" }])).toBe("hard");
    expect(accessLoad([{ type: "high_clearance_4wd" }])).toBe("hard");
    expect(accessLoad([{ type: "boat_or_ferry" }])).toBe("plan");
    expect(accessLoad([{ type: "timed_entry" }], "hard")).toBe("hard");
    expect(accessLoad([], "plan")).toBe("plan");
  });
});

describe("vacation fit (3.4 table)", () => {
  it("plan_around: world, or national and top", () => {
    expect(vacationFit(f({ ed: "world", standing: "ordinary" })).fit).toBe("plan_around");
    expect(vacationFit(f({ ed: "national", standing: "top" })).fit).toBe("plan_around");
    expect(vacationFit(f({ ed: "national", standing: "good" })).fit).toBe("worth_it");
  });
  it("worth_it: regional and top and not common", () => {
    expect(vacationFit(f({ ed: "regional", standing: "top", distinction: "rare" })).fit).toBe("worth_it");
    expect(vacationFit(f({ ed: "regional", standing: "top", distinction: "unique" })).fit).toBe("worth_it");
    expect(vacationFit(f({ ed: "regional", standing: "top", distinction: "common" })).fit).toBe("if_nearby");
  });
  it("if_nearby for local top or good within 20 min, skip beyond or ordinary", () => {
    expect(vacationFit(f({ ed: "local", standing: "top", detourMin: 20 })).fit).toBe("if_nearby");
    expect(vacationFit(f({ ed: "local", standing: "good", detourMin: 20 })).fit).toBe("if_nearby");
    expect(vacationFit(f({ ed: "local", standing: "good", detourMin: 21 })).fit).toBe("skip");
    expect(vacationFit(f({ ed: "local", standing: "ordinary", detourMin: 1 })).fit).toBe("skip");
    expect(vacationFit(f({ ed: "local", standing: "top", detourMin: null })).fit).toBe("skip");
  });
  it("drops one step for hard access, except plan_around", () => {
    expect(vacationFit(f({ ed: "national", standing: "good", load: "hard" })).fit).toBe("if_nearby");
    expect(vacationFit(f({ ed: "world", load: "hard" })).fit).toBe("plan_around");
    expect(vacationFit(f({ ed: "regional", load: "hard" })).fit).toBe("skip");
  });
  it("drops one step for clear_only, and both drops stack, never below skip", () => {
    expect(vacationFit(f({ ed: "world", weather: "clear_only" })).fit).toBe("worth_it");
    expect(vacationFit(f({ ed: "national", standing: "good", weather: "clear_only", load: "hard" })).fit).toBe("skip");
    expect(vacationFit(f({ ed: "local", standing: "ordinary", weather: "clear_only" })).fit).toBe("skip");
  });
  it("role and flags follow the fit", () => {
    expect(["plan_around", "worth_it", "if_nearby", "skip"].map((x) => roleOf(x as never))).toEqual(["anchor", "highlight", "filler", "local_only"]);
  });
});

describe("weekend fit", () => {
  const w = (o: Partial<Parameters<typeof weekendFit>[0]> = {}) => weekendFit({ ...f(), nearestHubMin: 180, areaCluster: false, ...o });
  it("needs a hub 1.5 to 4 h away", () => {
    expect(w({ nearestHubMin: 89 }).fit).toBe("skip");
    expect(w({ nearestHubMin: 90 }).fit).toBe("worth_it");
    expect(w({ nearestHubMin: 240 }).fit).toBe("worth_it");
    expect(w({ nearestHubMin: 241 }).fit).toBe("skip");
    expect(w({ nearestHubMin: null }).fit).toBe("skip");
  });
  it("plan_around needs the cluster and a top place of draw regional or above", () => {
    expect(w({ standing: "top", areaCluster: true }).fit).toBe("plan_around");
    expect(w({ standing: "good", areaCluster: true }).fit).toBe("worth_it");
    expect(w({ ed: "local", standing: "top" }).fit).toBe("if_nearby");
    expect(w({ ed: "local", standing: "good" }).fit).toBe("skip");
  });
});

describe("day trip fit", () => {
  const d = (h: number, o: Partial<FitFacts> = {}) => dayTripFit({ ...f({ standing: "top", ...o }), hubMin: h });
  it("plan_around: regional top within 3 h, and the day fits in 12 h", () => {
    expect(d(60).fit).toBe("plan_around");
    expect(d(180, { onSiteMin: 360 }).fit).toBe("plan_around");
    expect(d(180, { onSiteMin: 361 }).fit).not.toBe("plan_around");
    expect(d(181).fit).toBe("skip");
    expect(d(60, { ed: "local" }).fit).toBe("worth_it");
  });
  it("worth_it and if_nearby by standing and distance", () => {
    expect(d(120, { standing: "good" }).fit).toBe("worth_it");
    expect(d(121, { standing: "good" }).fit).toBe("skip");
    expect(d(60, { standing: "good", ed: "local" }).fit).toBe("worth_it");
    expect(d(46, { standing: "ordinary" }).fit).toBe("skip");
    expect(d(45, { standing: "ordinary" }).fit).toBe("if_nearby");
    expect(d(10, { standing: "ordinary", ed: "local" }).fit).toBe("if_nearby");
  });
});

describe("passing-through fit", () => {
  it("applies the ladder of detour, draw, on-site time and easy access", () => {
    expect(passingFit(f({ ed: "national", detourMin: 30, onSiteMin: 120 })).fit).toBe("plan_around");
    expect(passingFit(f({ ed: "regional", detourMin: 20, onSiteMin: 90 })).fit).toBe("worth_it");
    expect(passingFit(f({ ed: "local", detourMin: 10, onSiteMin: 45 })).fit).toBe("if_nearby");
    expect(passingFit(f({ ed: "local", detourMin: 11, onSiteMin: 45 })).fit).toBe("skip");
    expect(passingFit(f({ ed: "regional", detourMin: 31 })).fit).toBe("skip");
  });
  it("any booking skips it", () => {
    expect(passingFit(f({ ed: "world", detourMin: 0, load: "plan" })).fit).toBe("skip");
  });
});

describe("badge (3.6)", () => {
  it("one chip with the precedence journey, detour, local favourite", () => {
    expect(badgeOf("anchor", "top", "world")).toBe("Worth the journey");
    expect(badgeOf("highlight", "top", "regional")).toBe("Worth a detour");
    expect(badgeOf("filler", "top", "regional")).toBe("Local favourite");
    expect(badgeOf("filler", "good", "regional")).toBeNull();
    expect(badgeOf("local_only", "top", "local")).toBe("Local favourite");
    expect(badgeOf("highlight", "top", "national")).toBe("Worth a detour");
  });
  it("the vacation lens never shows Local favourite; the day lens never shows Worth a detour and needs the band", () => {
    expect(badgeOf("filler", "top", "regional", "vacation")).toBeNull();
    expect(badgeOf("highlight", "top", "regional", "day", "worth_it")).toBe("Local favourite");
    expect(badgeOf("anchor", "top", "world", "day", "plan_around")).toBe("Worth the journey");
    expect(badgeOf("filler", "top", "regional", "day", "skip")).toBeNull();
    expect(badgeOf("filler", "top", "regional", "day")).toBeNull();
  });
});

describe("derive and fit have no network", () => {
  const src = (name: string) => readFileSync(fileURLToPath(new URL(`../../src/relevance/${name}`, import.meta.url)), "utf8");
  for (const name of ["fit.ts", "derive.ts", "inputs.ts", "refs.ts"]) {
    it(`${name} does not import the signals client or make a request`, () => {
      const s = src(name);
      expect(s).not.toMatch(/signals\.ts/);
      expect(s).not.toMatch(/\bfetch\s*\(/);
      expect(s).not.toMatch(/node:(http|https|net)/);
      expect(s).not.toMatch(/https?:\/\//);
    });
  }
  it("the validator does not import the signals client either", () => {
    const s = readFileSync(fileURLToPath(new URL("../../src/validate/relevance.ts", import.meta.url)), "utf8");
    expect(s).not.toMatch(/relevance\/signals\.ts/);
    expect(s).not.toMatch(/\bfetch\s*\(/);
  });
});
