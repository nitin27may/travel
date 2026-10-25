// The normaliser's budget on the real repository (RIS-N): read-only. What the files still need may only fall; RIS-J brings it to
// zero with `node core/bin/normalise.ts --write` and lowers normalise-budget.json with `--budget --update`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { budgetOf, budgetRises, updatedBudget, type Budget } from "../../src/normalise/budget.ts";
import { planNormalise } from "../../src/normalise/run.ts";
import { REPO } from "./helpers.ts";

const pinned = JSON.parse(readFileSync(join(REPO, "core/test/normalise/normalise-budget.json"), "utf8")) as Budget;

describe("normalise budget", () => {
  const report = planNormalise({ root: REPO, placement: false });
  const now = budgetOf(report);

  it("reads the lane files and the trip-level files of the repository", () => {
    expect(pinned.schema).toBe("normalise-budget/1");
    expect(report.totals.files).toBeGreaterThan(60);
  });

  it("no count rises above the pinned budget, and no new kind of change or finding appears", () => {
    expect(budgetRises(now, pinned), "a count rose: normalise the files (node core/bin/normalise.ts --write) or justify the rise").toEqual([]);
  });

  it("is read-only: planning writes nothing", () => {
    const before = readFileSync(join(REPO, "data/capture/points.json"), "utf8");
    planNormalise({ root: REPO, placement: false });
    expect(readFileSync(join(REPO, "data/capture/points.json"), "utf8")).toBe(before);
  });
});

describe("budget arithmetic", () => {
  const mk = (changes: Record<string, number>, findings: Record<string, number> = {}): Budget => ({ schema: "normalise-budget/1", note: "", changes, findings });

  it("a rise, or a key the budget does not hold, is reported", () => {
    expect(budgetRises(mk({ "a.x": 3 }), mk({ "a.x": 3 }))).toEqual([]);
    expect(budgetRises(mk({ "a.x": 2 }), mk({ "a.x": 3 }))).toEqual([]);
    expect(budgetRises(mk({ "a.x": 4 }), mk({ "a.x": 3 }))).toHaveLength(1);
    expect(budgetRises(mk({ "a.y": 1 }), mk({ "a.x": 3 }))).toHaveLength(1);
    expect(budgetRises(mk({}, { E_X: 1 }), mk({}))).toHaveLength(1);
  });

  it("--update lowers a count and refuses to raise one", () => {
    expect(JSON.parse(updatedBudget(mk({ "a.x": 1 }), mk({ "a.x": 3 }))).changes).toEqual({ "a.x": 1 });
    expect(() => updatedBudget(mk({ "a.x": 5 }), mk({ "a.x": 3 }))).toThrow(/a count rose/);
    expect(JSON.parse(updatedBudget(mk({ "a.x": 5 }), null)).changes).toEqual({ "a.x": 5 });
  });
});
