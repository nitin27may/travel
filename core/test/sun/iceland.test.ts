import { describe, expect, it } from "vitest";
import { fmtClock, sunDay } from "../../src/sun/index.ts";

// Rows of research/trips/iceland-ring-road/timing.md (astronomical dark, sun below -18), UTC+0 all year.
const REYKJAVIK: [number, number] = [64.15, -21.94];
const MYVATN: [number, number] = [65.64, -16.91];
const mins = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const gap = (a: number, b: number): number => Math.abs((((a - b + 720) % 1440) + 1440) % 1440 - 720);

const ROWS: [string, [number, number], string | null, string | null][] = [
  ["2027-08-28", REYKJAVIK, null, null],
  ["2027-09-01", REYKJAVIK, null, null],
  ["2027-09-04", REYKJAVIK, "21:53", "23:10"],
  ["2027-09-08", REYKJAVIK, "21:04", "23:57"],
  ["2027-09-12", REYKJAVIK, "20:32", "00:26"],
  ["2027-09-15", REYKJAVIK, "20:12", "00:43"],
  ["2027-08-28", MYVATN, null, null],
  ["2027-09-01", MYVATN, null, null],
  ["2027-09-04", MYVATN, null, null],
  ["2027-09-08", MYVATN, "22:11", "23:30"],
  ["2027-09-12", MYVATN, "21:19", "00:18"],
  ["2027-09-15", MYVATN, "20:54", "00:41"],
];

// Finding: legacy/iceland-ring-road/dark-times.py passes a west-positive longitude to the east-positive NOAA formula,
// so every clock time in timing.md sits 8 minutes per degree of longitude too early (175 min at Reykjavik, 135 at
// Myvatn). The darkness dates and durations do not depend on longitude and match. The tests pin both facts, so a
// corrected table can drop the shift term.
describe("astronomical darkness against timing.md", () => {
  for (const [date, [lat, lon], from, to] of ROWS) {
    it(`${date} at ${lat}`, () => {
      const a = sunDay(lat, lon, date, "Atlantic/Reykjavik").astronomical;
      if (from === null) {
        expect(a.kind).toBe("never-sets"); // no darkness, the same result as the table
        return;
      }
      if (a.kind !== "normal") throw new Error(`expected darkness, got ${a.kind}`);
      const tableSpan = (mins(to!) - mins(from) + 1440) % 1440;
      const ourSpan = (a.rise - a.set + 1440) % 1440;
      expect(Math.abs(ourSpan - tableSpan)).toBeLessThanOrEqual(1); // duration matches within a minute
      const shift = 8 * Math.abs(lon);
      expect(gap(mins(fmtClock(a.set - shift)), mins(from))).toBeLessThanOrEqual(2);
      expect(gap(mins(fmtClock(a.rise - shift)), mins(to!))).toBeLessThanOrEqual(2);
    });
  }
});
