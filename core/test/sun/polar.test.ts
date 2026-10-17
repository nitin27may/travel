import { describe, expect, it } from "vitest";
import { sunDay, sunFor, sunPosition } from "../../src/sun/index.ts";

describe("polar cases", () => {
  it("Tromso at midsummer: the sun never sets", () => {
    expect(sunDay(69.65, 18.96, "2028-06-24", "Europe/Oslo").sunrise.kind).toBe("never-sets");
    expect(sunFor(69.65, 18.96, "2028-06-24", "Europe/Oslo")).toBeNull();
  });
  it("Tromso at midwinter: the sun never rises", () => {
    expect(sunDay(69.65, 18.96, "2028-12-21", "Europe/Oslo").sunrise.kind).toBe("never-rises");
  });
  it("daylight saving follows the zone: Toronto in July is UTC-4", () => {
    const summer = sunFor(43.65, -79.38, "2027-07-01", "America/Toronto")!;
    const winter = sunFor(43.65, -79.38, "2027-01-01", "America/Toronto")!;
    expect(summer.sunrise).toBe("05:39");
    expect(winter.sunrise).toBe("07:51");
  });
  it("azimuth and elevation: noon in July at 45N is high and southerly", () => {
    const p = sunPosition(45, 0, "2027-07-01", 12 * 60 - 4, "UTC");
    expect(p.elevation).toBeGreaterThan(65);
    expect(Math.abs(p.azimuth - 180)).toBeLessThan(5);
    const dawn = sunPosition(45, 0, "2027-07-01", 5 * 60, "UTC");
    expect(dawn.azimuth).toBeGreaterThan(40);
    expect(dawn.azimuth).toBeLessThan(80);
  });
});
