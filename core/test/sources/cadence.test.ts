import { describe, expect, it } from "vitest";
import { addDays, CADENCE_DAYS, daysBetween, factTypeOf, recheckOf } from "../../src/sources/cadence.ts";

describe("cadence by fact type", () => {
  it("uses 90, 180, 365 and 730 days", () => {
    expect(CADENCE_DAYS).toMatchObject({ prices_hours: 90, seasons_closures: 180, rules: 365, grades_geography: 730 });
  });
  it("classifies fields", () => {
    expect(factTypeOf("access_cost")).toBe("prices_hours");
    expect(factTypeOf("ext.last_up")).toBe("prices_hours");
    expect(factTypeOf("suitability.access_season")).toBe("seasons_closures");
    expect(factTypeOf("draw_peak")).toBe("seasons_closures");
    expect(factTypeOf("suitability.min_age")).toBe("rules");
    expect(factTypeOf("offers.suitability.participation.waiver")).toBe("rules");
    expect(factTypeOf("suitability.effort.drivers.gain_m")).toBe("grades_geography");
    expect(factTypeOf("wikidata")).toBe("grades_geography");
  });
  it("does not match a word inside a longer field name", () => {
    expect(factTypeOf("suitability.passenger_count")).toBe("grades_geography");
  });
  it("gives a source the shortest cadence among the facts that rely on it", () => {
    expect(recheckOf(["wikidata", "suitability.min_age", "access_cost"])).toEqual({ cadence_days: 90, fact_type: "prices_hours" });
    expect(recheckOf(["wikidata", "suitability.min_age"])).toEqual({ cadence_days: 365, fact_type: "rules" });
    expect(recheckOf(["wikidata"])).toEqual({ cadence_days: 730, fact_type: "grades_geography" });
  });
  it("gives an unused source the general cadence", () => {
    expect(recheckOf([])).toEqual({ cadence_days: 365, fact_type: "general" });
  });
  it("does date arithmetic in whole days", () => {
    expect(addDays("2026-10-18", 90)).toBe("2027-01-16");
    expect(daysBetween("2026-10-18", "2026-11-18")).toBe(31);
  });
});
