import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { report } from "../../bin/sun.ts";

// Pinned from core/src/sun (east-positive longitude); each is also within a few minutes of published almanac values
// for the town. Regressions in the longitude sign would move every row by hours.
const mins = (s: string | null): number => (s === null ? NaN : Number(s.slice(0, 2)) * 60 + Number(s.slice(3)));
const near = (got: string | null, want: string): void => {
  const d = Math.abs(((mins(got) - mins(want) + 720 + 1440) % 1440) - 720);
  expect(d, `${got} vs ${want}`).toBeLessThanOrEqual(1);
};

describe("sun CLI report", () => {
  it("Reykjavik, Sep 2027: UTC+0, 2h53 of astronomical dark", () => {
    const r = report(64.15, -21.94, "Atlantic/Reykjavik", "2027-09-08");
    near(r.sunrise, "06:28");
    near(r.sunset, "20:24");
    near(r.astronomicalDusk, "23:59");
    near(r.astronomicalDawn, "02:52");
    expect(Math.abs(r.darknessMin - 173)).toBeLessThanOrEqual(2);
  });
  it("Reykjavik 1 Sep 2027 and 15 Jul 2027: no astronomical night", () => {
    expect(report(64.15, -21.94, "Atlantic/Reykjavik", "2027-09-01").astronomicalDawn).toBeNull();
    expect(report(64.15, -21.94, "Atlantic/Reykjavik", "2027-07-15").civilDawn).toBeNull();
  });
  it("Bergen, July 2028: CEST (UTC+2), no nautical night", () => {
    const r = report(60.39, 5.32, "Europe/Oslo", "2028-07-08");
    near(r.sunrise, "04:26");
    near(r.sunset, "23:01");
    expect(r.nauticalDawn).toBeNull();
  });
  it("Banff, Sep 2029: MDT (UTC-6), western hemisphere", () => {
    const r = report(51.18, -115.57, "America/Edmonton", "2029-09-08");
    near(r.sunrise, "07:05");
    near(r.sunset, "20:16");
    near(r.civilDusk, "20:50");
    near(r.astronomicalDawn, "05:05");
  });
  it("Ushuaia (south, west) and Sydney (south, east)", () => {
    const u = report(-54.8, -68.3, "America/Argentina/Ushuaia", "2027-03-01");
    near(u.sunrise, "06:55");
    near(u.sunset, "20:37");
    const s = report(-33.87, 151.21, "Australia/Sydney", "2027-01-15");
    near(s.sunrise, "05:59");
    near(s.sunset, "20:09");
  });
  it("Tromso, 24 Jun 2028: the sun never sets", () => {
    const r = report(69.65, 18.96, "Europe/Oslo", "2028-06-24");
    expect(r.sunState).toBe("never sets");
    expect(r.sunrise).toBeNull();
    expect(r.dayLengthMin).toBe(1440);
    expect(r.darknessMin).toBe(0);
  });
});

describe("sun CLI process", () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ["core/bin/sun.ts", ...args], { cwd: new URL("../../..", import.meta.url), encoding: "utf8" });
  it("prints a table and JSON", () => {
    const a = ["--lat", "60.39", "--lon", "5.32", "--zone", "Europe/Oslo", "--date", "2028-07-08"];
    expect(run(...a).stdout).toContain("sunrise 04:26");
    const j = JSON.parse(run(...a, "--json").stdout) as { sunset: string }[];
    expect(j[0]?.sunset).toBe("23:01");
  });
  it("exits 2 on bad input", () => {
    expect(run("--lat", "x").status).toBe(2);
  });
});
