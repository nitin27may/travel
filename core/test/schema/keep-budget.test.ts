// The keep budget (RIS-C): what today's files trip under the keep rule and RowMeta, pinned so the counts may only fall. RIS-J
// rewrites the files and lowers keep-budget.json; a rise means new text broke a limit (shorten it) or needs a stated reason.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allFiles } from "../../src/validate/index.ts";
import { keepCounts } from "../../src/validate/keep.ts";
import { REPO } from "../capture/helpers.ts";

const budget = JSON.parse(readFileSync(join(REPO, "core/test/schema/keep-budget.json"), "utf8")) as { schema: string; codes: Record<string, number>; origin_key: number; point_source_rows: number };

describe("keep budget", () => {
  const now = keepCounts(REPO, allFiles(REPO));
  it("reads the lane files and the points file", () => {
    expect(budget.schema).toBe("keep-budget/1");
    expect(now.files).toBeGreaterThan(40);
  });
  it("no code's count rises above the budget, and no new code appears", () => {
    for (const [code, n] of Object.entries(now.codes)) expect(n, `${code}: ${n} now, budget ${budget.codes[code] ?? 0}`).toBeLessThanOrEqual(budget.codes[code] ?? 0);
  });
  it("the migration counts RIS-J works down only fall: capture origin keys and free-text point_source rows", () => {
    expect(now.origin_key).toBeLessThanOrEqual(budget.origin_key);
    expect(now.point_source_rows).toBeLessThanOrEqual(budget.point_source_rows);
  });
});
