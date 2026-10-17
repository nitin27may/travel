import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WARN_CODE_LIST } from "../../src/checks/index.ts";
import { validateDoc } from "../../src/validate/index.ts";

const FIX = fileURLToPath(new URL("../fixtures", import.meta.url));
const ROOT = join(FIX, "root");
const files = readdirSync(join(FIX, "warn")).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(FIX, "warn", f), "utf8"));
const run = (f: string) => {
  process.env.TRAVEL_TODAY = "2026-10-17";
  return validateDoc(load(f), "trip", ROOT);
};

describe("warning code fixtures", () => {
  it("has one fixture per declared W_ code, plus the Patagonia Day 8 example", () => {
    const codes = files.filter((f) => f.startsWith("W_")).map((f) => f.replace(/\.json$/, ""));
    expect(codes).toEqual([...WARN_CODE_LIST].sort());
    expect(files).toContain("example-patagonia-day8.json");
    expect(WARN_CODE_LIST).toHaveLength(16);
    expect(WARN_CODE_LIST).toContain("W_FIT_UNKNOWN");
  });

  for (const f of files.filter((x) => x.startsWith("W_"))) {
    const code = f.replace(/\.json$/, "");
    it(`${code}: a valid trip whose one condition raises ${code}`, () => {
      const r = run(f);
      expect(r.errors).toEqual([]);
      expect([...new Set(r.warnings.map((w) => w.code))]).toEqual([code]);
    });
  }

  it("Patagonia Day 8 yields W_PACE on Track A (680 min against 540) and nothing else", () => {
    const r = run("example-patagonia-day8.json");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatchObject({ code: "W_PACE", path: "/days/7" });
    expect(r.warnings[0]!.message).toContain("Track A on day 8 has 680 min");
    expect(r.warnings[0]!.message).toContain("budget of 540 min");
    expect(r.warnings[0]!.message).toContain("accepted on day 8");
  });

  it("the clean base raises nothing", () => {
    // W_PACE.json differs from the base only by profile.pace, so lifting it again must give a clean trip
    const d = load("W_PACE.json");
    d.profile.pace = 5;
    process.env.TRAVEL_TODAY = "2026-10-17";
    expect(validateDoc(d, "trip", ROOT).warnings).toEqual([]);
  });
});
