// SW-022 (sweep-2026-10-28): the times on a day's rail add up. On the Dolomites Day 3 the header said "1 h 35 driving" over legs drawn
// as 50 + 10 + 40, and 20 minutes sat silently before the 16:30 Cadini stop, 10 before the Tre Cime start. Now the header is the sum of
// the drives as drawn, every wait over FREE_ROW_MIN is a row, and the walk from the car park to a trailhead is a leg. Both published
// trips, every day, several parties.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FREE_ROW_MIN } from "../../src/config/schedule.ts";
import { fmtHM, shownMin } from "../../src/schedule/rules.ts";
import { scheduleDay, scheduleTrip } from "../../src/schedule/schedule.ts";
import { toItems } from "../../src/schedule/toItems.ts";
import type { DayTimeline, Profile, ScheduleDayInput, TimelineEntry } from "../../src/schedule/types.ts";
import { family, profile } from "./helpers.ts";

const load = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as ScheduleDayInput[];
const TRIPS = { rockies: load("rockies-trip"), dolomites: load("dolomites-trip") };
const PARTIES: Record<string, Profile> = {
  adults: profile(),
  family6: family(6),
  family10: family(10),
  relaxed: profile({ pace: "relaxed" }),
  full: profile({ pace: "full" }),
  split: family(8, { split: true }),
};
const min = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** The rail of the party's lane as drawn: no sun rows, nothing inside another entry, no after-dark block. */
const rail = (t: DayTimeline): TimelineEntry[] => {
  const lane = t.lanes[0] ?? "all";
  return t.entries.filter((e) => e.kind !== "sun" && !e.insideOf && !e.block && (e.lane === "all" || e.lane === lane));
};

describe("Dolomites Day 3 (SW-022)", () => {
  const t = scheduleDay(TRIPS.dolomites.find((d) => d.day === 3)!, profile());
  const legs = t.entries.filter((e) => e.kind === "leg");
  it("the header is the drives as drawn: 50 + 10 + 40 = 1 h 40", () => {
    expect(legs.filter((e) => e.leg?.mode === "drive").map((e) => fmtHM(e.durationMin))).toEqual(["50 min", "10 min", "40 min"]);
    expect(t.totals.driveMin).toBe(100);
    expect(fmtHM(t.totals.driveMin)).toBe("1 h 40");
  });
  it("draws the walk in to Tre Cime and the 20 minutes before Cadini", () => {
    const i = t.entries.findIndex((e) => e.sourceItemId === "i5");
    expect(t.entries[i - 1]).toMatchObject({ kind: "leg", sub: "walk", durationMin: 10, start: "11:18" });
    const cadini = t.entries.findIndex((e) => e.sourceItemId === "i6");
    expect(t.entries[cadini - 1]).toMatchObject({ kind: "rest", sub: "free-time", start: "16:10", durationMin: 20 });
    expect(t.entries[cadini]).toMatchObject({ start: "16:30" });
  });
  it("the planner rows read the drive and the walk in as one way by car", () => {
    const row = toItems(t).find((r) => r.id === "i5")!;
    expect(row).toMatchObject({ leg_mode: "drive", leg_minutes: 58, leg_basis: "ors" });
  });
});

describe("every published day reads without a silent gap", () => {
  for (const [trip, days] of Object.entries(TRIPS)) {
    for (const [party, p] of Object.entries(PARTIES)) {
      it(`${trip}, ${party}`, () => {
        for (const t of scheduleTrip(days, p)) {
          if (t.blocks) continue;
          const drives = t.entries.filter((e) => e.kind === "leg" && e.leg?.mode === "drive" && (e.lane === "all" || e.lane === (t.lanes[0] ?? "all")));
          expect(t.totals.driveMin, `day ${t.day} drive total`).toBe(drives.reduce((n, e) => n + shownMin(e.durationMin), 0));
          expect(Number.isFinite(t.totals.driveMin) && Number.isFinite(t.totals.activeMin)).toBe(true);
          const r = rail(t);
          for (let i = 1; i < r.length; i++) {
            const a = r[i - 1]!;
            const b = r[i]!;
            const gap = min(b.start) - (min(a.start) + a.durationMin);
            expect(gap, `day ${t.day}: ${a.title} (${a.end}) to ${b.title} (${b.start})`).toBeLessThanOrEqual(FREE_ROW_MIN);
          }
        }
      });
    }
  }
});
