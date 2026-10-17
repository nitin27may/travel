import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkDays, fsCatalog, makeContext } from "../../src/checks/index.ts";
import { bookingState, resolveEdition } from "../../src/derive/edition.ts";
import { computeBookBy } from "../../src/bookings/bookBy.ts";

const FIX = fileURLToPath(new URL("../fixtures", import.meta.url));
const ROOT = join(FIX, "root");
const load = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));

describe("resolveEdition", () => {
  const trip = load("warn/example-patagonia-day8.json");
  const catalog = fsCatalog(ROOT);

  it("gives dates and weekdays for every day", () => {
    const r = resolveEdition(trip, { today: "2026-10-17", catalog });
    expect(r.start).toBe("2027-02-26");
    expect(r.days.find((d) => d.n === 1)).toMatchObject({ date: "2027-02-26", weekday: "Friday" });
    expect(r.days.find((d) => d.n === 8)).toMatchObject({ date: "2027-03-05", weekday: "Friday" });
  });

  it("resolves the book-by date and a state per booking", () => {
    const r = resolveEdition(trip, { today: "2026-10-17", catalog });
    const piratour = r.bookings.find((b) => b.id === "bk-piratour")!;
    expect(piratour.book_by_offset).toBe(-42);
    expect(piratour.book_by_date).toBe("2027-01-15");
    expect(piratour.opens_date).toBe("2026-10-31");
    expect(piratour.state).toBe("not-yet-open");
    expect(resolveEdition(trip, { today: "2026-11-15", catalog }).bookings.find((b) => b.id === "bk-piratour")!.state).toBe("open");
    expect(resolveEdition(trip, { today: "2027-01-10", catalog }).bookings.find((b) => b.id === "bk-piratour")!.state).toBe("urgent");
    expect(resolveEdition(trip, { today: "2027-02-01", catalog }).bookings.find((b) => b.id === "bk-piratour")!.state).toBe("urgent"); // past
    expect(r.bookings.find((b) => b.id === "bk-glaciares-flexipass")!.state).toBe("booked");
  });

  it("derives booked, sold-out and cancelled states from the status", () => {
    const r = computeBookBy(null, { used_days: [3], category: "tour", editionStart: "2027-02-26" });
    for (const [status, state] of [["paid", "booked"], ["sold-out", "sold-out"], ["cancelled", "cancelled"], ["todo", "open"]] as const) {
      expect(bookingState({ status }, r, "2027-02-26", "2026-10-17").state).toBe(state);
    }
  });

  it("owner offsets are kept", () => {
    const t = JSON.parse(JSON.stringify(trip));
    const b = t.trip_bookings.find((x: any) => x.id === "bk-piratour");
    b.book_by_basis = "owner";
    b.book_by_offset = -88;
    const r = resolveEdition(t, { today: "2026-10-17", catalog });
    expect(r.bookings.find((x) => x.id === "bk-piratour")!.book_by_date).toBe("2026-11-30");
  });

  it("works without a chosen edition", () => {
    const t = JSON.parse(JSON.stringify(trip));
    t.editions = [];
    const r = resolveEdition(t, { today: "2026-10-17", catalog });
    expect(r.start).toBeNull();
    expect(r.days[0]!.date).toBe("");
  });
});

describe("the real providers in the day checks", () => {
  it("W_DAYLIGHT uses the real sun: 07:15 + 9 h ends 16:15, before the 20:38 sunset on 5 Mar", () => {
    const trip = load("warn/example-patagonia-day8.json");
    const ctx = makeContext({ root: ROOT, trip, today: "2026-10-17" });
    expect(checkDays(trip, ctx).filter((w) => w.code === "W_DAYLIGHT")).toEqual([]);
    const sun = ctx.sun(8, -49.3315, -72.8863, "America/Argentina/Rio_Gallegos")!;
    expect(["20:38", "20:39"]).toContain(sun.sunset); // the table says 20:38; a half-minute rounds either way
  });

  it("W_DAYLIGHT fires when the walk ends after the real sunset", () => {
    const trip = load("warn/example-patagonia-day8.json");
    const it = trip.items.find((i: any) => i.needs_daylight && i.day === 8)!;
    it.start = "17:30";
    const ctx = makeContext({ root: ROOT, trip, today: "2026-10-17" });
    expect(checkDays(trip, ctx).some((w) => w.code === "W_DAYLIGHT")).toBe(true);
  });
});
