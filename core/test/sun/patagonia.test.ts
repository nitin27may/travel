import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fmtClock, sunDay } from "../../src/sun/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// legacy/patagonia-feb-mar-2027/sun-times.py holds the Norway script, so the four places come from here
// (town-centre coordinates; the table was computed at UTC-3 all year).
const PLACES: Record<string, [number, number]> = {
  "El Calafate": [-50.3379, -72.2648],
  "El Chalten": [-49.3315, -72.8863],
  Ushuaia: [-54.8019, -68.303],
  "Buenos Aires": [-34.6037, -58.3816],
};
const DATES = ["2027-02-26", "2027-03-05", "2027-03-11"];

const mins = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const gap = (a: number, b: number): number => Math.abs(((a - b + 720) % 1440 + 1440) % 1440 - 720);

function table(): Map<string, string[][]> {
  const text = readFileSync(join(ROOT, "research/trips/patagonia-feb-mar-2027/sun.md"), "utf8");
  const out = new Map<string, string[][]>();
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length === 4 && cells[0]! in PLACES) out.set(cells[0]!, cells.slice(1).map((c) => c.split("/").map((t) => t.trim())));
  }
  return out;
}

describe("sun times reproduce research/trips/patagonia-feb-mar-2027/sun.md", () => {
  const t = table();
  it("finds the four places by three dates", () => {
    expect([...t.keys()].sort()).toEqual(Object.keys(PLACES).sort());
  });
  for (const [place, [lat, lon]] of Object.entries(PLACES)) {
    DATES.forEach((date, i) => {
      it(`${place} ${date}`, () => {
        const want = t.get(place)![i]!;
        const d = sunDay(lat, lon, date, "America/Argentina/Buenos_Aires");
        if (d.civil.kind !== "normal" || d.sunrise.kind !== "normal") throw new Error("expected normal days");
        const got = [d.civil.rise, d.sunrise.rise, d.sunrise.set, d.civil.set].map(fmtClock);
        got.forEach((g, k) => expect(gap(mins(g), mins(want[k]!)), `${place} ${date} column ${k}: expected ${want[k]}, got ${g}`).toBeLessThanOrEqual(1));
      });
    });
  }
});
