import { describe, expect, it } from "vitest";
import { computeBookBy, deadlineOf, firstUsedOffset } from "../../src/bookings/bookBy.ts";
import { addDays, isoWeekday } from "../../src/checks/time.ts";

const offer = (o: Record<string, unknown>) => ({
  category: "tour", opens_kind: "unknown", opens_lead_days: null, opens_rule: null, sellout_kind: "unknown", sellout_lead_days: null, same_day: "unknown", ...o,
});
const used = (days: number[], extra: Record<string, unknown> = {}) => ({ used_days: days, ...extra });

describe("computeBookBy: every row of the plan 2.3 table", () => {
  it("U is the offset of the first used day (Day 1 = 0)", () => {
    expect(firstUsedOffset([3, 5])).toBe(2);
    expect(firstUsedOffset([0])).toBe(-1);
    expect(firstUsedOffset([])).toBe(0);
  });

  it("minutes-after-release: the opening offset itself", () => {
    const r = computeBookBy(offer({ opens_kind: "rolling-lead", opens_lead_days: 90, sellout_kind: "minutes-after-release" }), used([8]));
    expect(r).toMatchObject({ offset: 7 - 90, basis: "computed", gap: false, rule: "minutes-after-release" });
  });

  it("rolling-lead: max(U - opens_lead, U - sellout_lead - 14)", () => {
    const o = offer({ opens_kind: "rolling-lead", opens_lead_days: 120, sellout_kind: "weeks", sellout_lead_days: 30 });
    expect(computeBookBy(o, used([3])).offset).toBe(2 - 44); // sell-out protection is later than the opening
    const wide = offer({ opens_kind: "rolling-lead", opens_lead_days: 30, sellout_kind: "months", sellout_lead_days: 90 });
    expect(computeBookBy(wide, used([3])).offset).toBe(2 - 30); // cannot book before it opens
  });

  it("rolling-lead with no sell-out figure: the opening itself", () => {
    const r = computeBookBy(offer({ opens_kind: "rolling-lead", opens_lead_days: 60, sellout_kind: "days" }), used([3]));
    expect(r).toMatchObject({ offset: 2 - 60, opens_offset: 2 - 60, rule: "rolling-lead" });
  });

  it("fixed-date, monthly-release and lottery: the date goes to deadline_date", () => {
    for (const kind of ["fixed-date", "monthly-release", "lottery"]) {
      const r = computeBookBy(offer({ opens_kind: kind, opens_rule: "opens 2026-12-01 at 09:00 ET", sellout_kind: "days" }), used([3]), );
      expect(r.gap).toBe(true); // no edition start: the date cannot become an offset
    }
    const r = computeBookBy(offer({ opens_kind: "fixed-date", opens_rule: "opens 2026-12-01 at 09:00 ET", sellout_kind: "days" }), { used_days: [3], editionStart: "2027-02-26" });
    expect(r).toMatchObject({ deadline_date: "2026-12-01", offset: -87, basis: "computed", gap: false });
    expect(deadlineOf(r, "2027-02-26")).toBe("2026-12-01");
  });

  it("fixed-date with no parsable date is a gap", () => {
    const r = computeBookBy(offer({ opens_kind: "lottery", opens_rule: "lottery in winter", category: "permit" }), { used_days: [3], editionStart: "2027-02-26" });
    expect(r).toMatchObject({ gap: true, basis: "inference", offset: 2 - 60 });
  });

  it("never sells out: a week ahead, a day ahead when walk-up exists, never before it opens", () => {
    expect(computeBookBy(offer({ opens_kind: "always-open", sellout_kind: "never" }), used([3])).offset).toBe(2 - 7);
    expect(computeBookBy(offer({ opens_kind: "always-open", sellout_kind: "never", same_day: "yes" }), used([3])).offset).toBe(2 - 1);
    expect(computeBookBy(offer({ opens_kind: "rolling-lead", opens_lead_days: 3, sellout_kind: "never" }), used([3])).offset).toBe(2 - 3);
  });

  it("unknown: 120 for flights and lodging in a peak month, 60 for tours, 30 otherwise, always flagged", () => {
    const start = "2027-07-10"; // July is a peak month
    const peak = computeBookBy(offer({ category: "lodging" }), { used_days: [1], editionStart: start });
    expect(peak).toMatchObject({ offset: -120, basis: "inference", gap: true });
    expect(computeBookBy(offer({ category: "flight-intl" }), { used_days: [1], editionStart: "2027-03-01" }).offset).toBe(-30);
    expect(computeBookBy(offer({ category: "tour" }), { used_days: [1], editionStart: start }).offset).toBe(-60);
    expect(computeBookBy(offer({ category: "restaurant" }), { used_days: [1], editionStart: start }).offset).toBe(-30);
  });

  it("no offer: falls back to the booking category", () => {
    expect(computeBookBy(null, { used_days: [1], category: "flight-intl", editionStart: "2027-12-20" })).toMatchObject({ offset: -120, gap: true });
    expect(computeBookBy(null, { used_days: [1], category: "tour", editionStart: "2027-03-01" }).offset).toBe(-60);
  });
});

describe("Patagonia edition starting 2027-02-26", () => {
  it("offsets -118 and -88 are Sat 31 Oct 2026 and Mon 30 Nov 2026", () => {
    const a = addDays("2027-02-26", -118);
    const b = addDays("2027-02-26", -88);
    expect([a, b]).toEqual(["2026-10-31", "2026-11-30"]);
    expect(isoWeekday(a)).toBe(6);
    expect(isoWeekday(b)).toBe(1);
  });
});
