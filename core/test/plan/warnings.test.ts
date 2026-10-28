// Warning levels (STEP2-C1, gap-analysis D3; edit-mode-spec 11.1): every day-check code and every builder did-not-fit code has a level,
// so a new check fails here before a screen can meet a code with no level (STEP2-E5's acceptance).
import { describe, expect, it } from "vitest";
import { WARN_CODE_LIST } from "../../src/checks/codes.ts";
import { isDayCheck, LEVELLED_CODES, PENDING_WARN_CODES, WARN_LEVEL, WARN_LEVELS, warnCounts, warnLevel } from "../../src/plan/warnings.ts";
import { PLAN_MISS_CODES, PLAN_WARNING_RE } from "../../src/schema/plan-draft.ts";

describe("WARN_LEVEL", () => {
  it("gives every day-check code a level", () => {
    const missing = WARN_CODE_LIST.filter((c) => !LEVELLED_CODES.includes(c));
    expect(missing, "add each new code of core/src/checks/codes.ts to WARN_LEVEL in core/src/plan/warnings.ts").toEqual([]);
  });
  it("gives every builder did-not-fit code a level", () => {
    expect(PLAN_MISS_CODES.filter((c) => !LEVELLED_CODES.includes(c))).toEqual([]);
  });
  it("levels nothing else: each key is a day check, a builder code or a code specified ahead of its check", () => {
    const known = new Set<string>([...WARN_CODE_LIST, ...PLAN_MISS_CODES, ...PENDING_WARN_CODES]);
    expect(LEVELLED_CODES.filter((c) => !known.has(c))).toEqual([]);
    for (const c of PENDING_WARN_CODES) expect(PLAN_WARNING_RE.test(c), c).toBe(true);
  });
  it("uses only the three levels, and two-level codes name both", () => {
    for (const [code, v] of Object.entries(WARN_LEVEL)) {
      const levels = typeof v === "string" ? [v] : [v.rule, v.advice];
      for (const l of levels) expect(WARN_LEVELS, code).toContain(l);
    }
  });
  it("matches edit-mode-spec 11.1", () => {
    for (const c of ["W_HOURS", "W_DEADLINE", "W_BOOKING_DAY", "W_NO_ROUTE", "TB_CLOSED"]) expect(warnLevel(c), c).toBe("fix");
    for (const c of ["W_DRIVE_LIMIT", "W_DAYLIGHT", "W_PACE", "W_CEILING", "W_EARLY", "W_OVERLAP"]) expect(warnLevel(c), c).toBe("check");
    for (const c of ["W_ORDER", "W_LEG_MISSING", "W_LEG_DRIFT", "W_NO_COORDS", "W_TZ_MISSING", "W_FIT_UNKNOWN"]) expect(warnLevel(c), c).toBe("hidden");
    expect(warnLevel("W_FIT", "rule")).toBe("fix");
    expect(warnLevel("W_FIT", "advice")).toBe("check");
    expect(warnLevel("W_FIT"), "a caller that cannot tell gets the safety reading").toBe("fix");
  });
  it("answers null for a code it does not know, and counts only shown levels", () => {
    expect(warnLevel("W_FROM_THE_FUTURE")).toBeNull();
    expect(warnLevel("toString")).toBeNull();
    expect(warnCounts(["W_HOURS", "W_PACE", "W_PACE", "W_ORDER", "W_UNKNOWN", { code: "W_FIT", basis: "advice" }, { code: "W_FIT" }])).toEqual({ fix: 2, check: 3 });
    expect(isDayCheck("W_HOURS")).toBe(true);
    expect(isDayCheck("TB_CLOSED")).toBe(false);
  });
});
