// PA-C (protected-area-entry 5.1 C1 to C3, C5): the shapes the parks contract adds to capture/1. The entry block parses with strict keys,
// the window's second phase is one level, a price row says who it is for, and an offer's summary has a capture home with a length cap.
import { describe, expect, it } from "vitest";
import { capRecord, entrySpec, priceRow, windowSpec, OFFER_SUMMARY_MAX, VISIT_MODE } from "../../src/schema/capture/records.ts";
import { PRICE_PER_V2, PRICE_RESIDENCY } from "../../src/schema/enums.ts";
import { D8R_CAMPSITE, D8R_OFFERS } from "./entry-helpers.ts";

const ENTRY = { required: "always", needed_for: ["day"], unit: "person", channel: ["online"] };

describe("entrySpec (C2)", () => {
  it("parses the minimal block and the full one", () => {
    expect(entrySpec.safeParse(ENTRY).success).toBe(true);
    const full = {
      ...ENTRY, needed_for: [...VISIT_MODE], valid: { span: 7, unit: "day", from: "first_use" }, proof: "id_check",
      exemptions: [{ who: "resident", note: "residents of the province" }, { who: "camper" }],
      change: { allowed: "fee", until_hours: 24 }, cancel: { refund: "full", until_hours: 72, note: "less a handling fee" },
      quota: { per: "night" }, for_types: ["water.fishing", "mountain.climb"],
    };
    expect(entrySpec.safeParse(full).success).toBe(true);
  });
  it("refuses unknown keys, an empty mode list, an unknown mode or exemption, a bad type id", () => {
    expect(entrySpec.safeParse({ ...ENTRY, fee: 10 }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, needed_for: [] }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, needed_for: ["picnic"] }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, channel: [] }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, exemptions: [{ who: "vip" }] }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, valid: { span: 0, unit: "day", from: "purchase" } }).success).toBe(false);
    expect(entrySpec.safeParse({ ...ENTRY, for_types: ["Water Fishing"] }).success).toBe(false);
  });
});

describe("windowSpec (C3)", () => {
  it("takes the month band, the monthly lead, the closing time, the share and one second phase", () => {
    expect(windowSpec.safeParse({ rule: "lottery", opens_from: "03-01", opens_to: "03-21", then: { rule: "rolling", closes_days_before: 1, closes_time: "15:30", share_pct: 100 } }).success).toBe(true);
    expect(windowSpec.safeParse({ rule: "monthly_release", month_lead_days: 35, opens_time: "09:00", tz: "America/Edmonton" }).success).toBe(true);
    expect(windowSpec.safeParse({ rule: "fixed_date", opens_from: "01-15", opens_to: "02-28", then: { rule: "rolling", days_before: 2, opens_time: "08:00" } }).success).toBe(true);
  });
  it("refuses then.then (one level), a bad month-day, a share above 100 and the old shape's unknown keys", () => {
    expect(windowSpec.safeParse({ rule: "lottery", then: { rule: "rolling", then: { rule: "same_day" } } }).success).toBe(false);
    expect(windowSpec.safeParse({ rule: "fixed_date", opens_from: "13-01" }).success).toBe(false);
    expect(windowSpec.safeParse({ rule: "rolling", share_pct: 120 }).success).toBe(false);
    expect(windowSpec.safeParse({ rule: "rolling", opens_month: 3 }).success).toBe(false);
  });
  it("still parses every pre-PA-C window (the old keys are unchanged)", () => {
    expect(windowSpec.safeParse({ rule: "rolling", days_before: 2, opens_time: "08:00", tz: "America/Edmonton", sellout: { kind: "minutes" }, fallback: "text" }).success).toBe(true);
  });
});

describe("priceRow (C5)", () => {
  it("knows person_night and the residency of a row", () => {
    expect(PRICE_PER_V2).toContain("person_night");
    expect(PRICE_RESIDENCY).toEqual(["resident", "national", "foreign"]);
    expect(priceRow.safeParse({ amount: 12, currency: "CAD", per: "person_night" }).success).toBe(true);
    expect(priceRow.safeParse({ amount: 30, currency: "ARS", per: "adult", residency: "foreign" }).success).toBe(true);
    expect(priceRow.safeParse({ amount: 30, currency: "ARS", per: "adult", residency: "tourist" }).success).toBe(false);
  });
});

describe("capRecord: summary and entry (C1, C2)", () => {
  it("every reshaped D8-R record parses", () => {
    for (const r of [...D8R_OFFERS, D8R_CAMPSITE]) expect(capRecord.safeParse(r).success, String(r.ref)).toBe(true);
  });
  it(`summary is 1 to ${OFFER_SUMMARY_MAX} characters`, () => {
    const base = { ref: "offer/place/x#y", type: "access.pass.entry_fee", layer: "offer" };
    expect(capRecord.safeParse({ ...base, summary: "a".repeat(OFFER_SUMMARY_MAX) }).success).toBe(true);
    expect(capRecord.safeParse({ ...base, summary: "a".repeat(OFFER_SUMMARY_MAX + 1) }).success).toBe(false);
    expect(capRecord.safeParse({ ...base, summary: "" }).success).toBe(false);
  });
  it("entry is a Val (basis, sources, read date)", () => {
    const base = { ref: "offer/place/x#y", type: "access.pass.entry_fee", layer: "offer" };
    expect(capRecord.safeParse({ ...base, entry: ENTRY }).success).toBe(false);
    expect(capRecord.safeParse({ ...base, entry: { v: ENTRY, state: "value", basis: "official_info", src: ["src-0001"] } }).success).toBe(true);
  });
});
