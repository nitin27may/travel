// TRP-GL-C: booking windows in the trip export contract (MUST-6; T1, P6, P8). The words, the order, the stop link, the CSV column and the
// contract's shape, on a small model; the real trips are checked against the page in web/tests/export/trip-routes.test.ts.
import { describe, expect, it } from "vitest";
import { bookAheadText, bookRuleText, tripBookings, withStopBookings, type BookingSource } from "../../src/export/bookings.ts";
import { TRIP_CSV_HEADER, tripCsv } from "../../src/export/csv.ts";
import type { ExportStop, TripExport } from "../../src/export/types.ts";
import { isDated } from "../../src/privacy/dateless.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { exportBooking, tripExportModel } from "../../src/schema/api/index.ts";

const row = (over: Partial<BookingSource> & Pick<BookingSource, "key" | "name">): BookingSource => ({ placeSlug: null, days: [], bookRule: null, bookNote: null, ...over });

const ROWS: BookingSource[] = [
  row({ key: "stays:a", name: "Hotel A", days: [1, 2] }),
  row({ key: "logistics:slot", name: "Toll road slot", placeSlug: "loop", days: [3], bookRule: { daysBefore: 30, dayN: 3, time: null, tz: "Europe/Rome" } }),
  row({ key: "logistics:pass", name: "Park pass", days: [2, 1], bookNote: "Buy online on the day." }),
  row({ key: "logistics:any", name: "Car hire", bookNote: "Reserve with free cancellation." }),
  row({ key: "logistics:lift", name: "Lift, 08:30 slot", placeSlug: "ridge", days: [5], bookRule: { daysBefore: 60, dayN: null, time: "08:00", tz: null }, bookNote: "Non-refundable" }),
  row({ key: "logistics:blank", name: "Nothing to book", days: [4], bookNote: "   " }),
];

const stop = (over: Partial<ExportStop> & Pick<ExportStop, "id" | "day">): ExportStop => ({
  order: 0, name: over.id, kind: "trail", category: "trails", area: null, time: null, durationMin: null, lane: null, note: null, placeSlug: null, links: [], point: null, ...over,
});

describe("bookRuleText: the page's words for a window, dateless", () => {
  it("relative to a day, with the time and 'local' only when the plan has them", () => {
    expect(bookRuleText({ daysBefore: 30, dayN: 3, time: null, tz: null })).toBe("Opens 30 days before Day 3");
    expect(bookRuleText({ daysBefore: 60, dayN: null, time: "08:00", tz: "America/Edmonton" })).toBe("Opens 60 days ahead at 08:00 local");
  });
  it("bookAheadText joins the rule and the note, and is empty with neither", () => {
    expect(bookAheadText({ rule: "Opens 2 days before Day 1", note: "Non-refundable" })).toBe("Opens 2 days before Day 1; Non-refundable");
    expect(bookAheadText({ rule: null, note: "Buy online" })).toBe("Buy online");
    expect(bookAheadText({ rule: null, note: null })).toBe("");
  });
});

describe("tripBookings", () => {
  const out = tripBookings(ROWS);
  it("keeps only rows with a rule or a note, never a stay or a blank note", () => {
    expect(out.map((b) => b.ref)).toEqual(["logistics:pass", "logistics:slot", "logistics:lift", "logistics:any"]);
  });
  it("is in day order (first day it is for), a booking with no day last", () => {
    expect(out.map((b) => b.day)).toEqual([1, 3, 5, null]);
  });
  it("carries the page's name, the rule in words, and the note", () => {
    expect(out[1]).toEqual({ name: "Toll road slot", rule: "Opens 30 days before Day 3 local", note: null, day: 3, ref: "logistics:slot" });
    expect(out[0]).toEqual({ name: "Park pass", rule: null, note: "Buy online on the day.", day: 1, ref: "logistics:pass" });
  });
  it("each booking parses as the contract's exportBooking, and none holds a calendar date", () => {
    for (const b of out) {
      expect(exportBooking.safeParse(b).success).toBe(true);
      for (const t of [b.name, b.rule, b.note]) if (t) expect(isDated(t)).toBe(false);
    }
    expect(tripBookings([])).toEqual([]);
  });
});

describe("withStopBookings: a window rides on the stop whose place and day it names", () => {
  const stops = [stop({ id: "a", day: 3, placeSlug: "loop" }), stop({ id: "b", day: 4, placeSlug: "loop" }), stop({ id: "c", day: 5, placeSlug: "ridge" }), stop({ id: "d", day: 3, name: "Toll road" })];
  const out = withStopBookings(stops, ROWS);
  it("only on the same place and day; a booking with no place is never guessed onto a stop", () => {
    expect(out.map((s) => s.bookRule ?? null)).toEqual(["Opens 30 days before Day 3 local", null, "Opens 60 days ahead at 08:00; Non-refundable", null]);
    expect("bookRule" in out[1]!).toBe(false);
  });
});

describe("tripCsv: the 'Book ahead' column", () => {
  const model: TripExport = {
    type: "trip", slug: "t", title: "T", url: "https://x.invalid/trips/t/", depth: "full", nights: 4, tz: null, seasonLabel: null, skipped: 0, waypoints: [], lines: [],
    days: [1, 2, 3, 4, 5].map((n) => ({ n, title: `Day ${n}`, base: null })),
    stops: withStopBookings([stop({ id: "Loop", day: 3, placeSlug: "loop", time: "~09:00", order: 0 }), stop({ id: "Ridge", day: 5, placeSlug: "ridge", time: "08:30", order: 1 })], ROWS),
    bookings: tripBookings(ROWS),
  };
  const lines = tripCsv(model).replace(/^﻿/, "").trimEnd().split("\r\n");
  it("is the last column of the header", () => {
    expect(TRIP_CSV_HEADER.at(-1)).toBe("Book ahead");
    expect(lines[0]).toBe(TRIP_CSV_HEADER.join(","));
  });
  it("one booking row at the head of its day, the stop's own window on its row, a dayless booking last, then the source line", () => {
    expect(lines.slice(1, -1)).toEqual([
      "1,,Park pass,booking,,,,,,,Buy online on the day.",
      "3,,Toll road slot,booking,,,,,,,Opens 30 days before Day 3 local",
      "3,~09:00,Loop,trail,Trails,,,,,,Opens 30 days before Day 3 local",
      '5,,"Lift, 08:30 slot",booking,,,,,,,Opens 60 days ahead at 08:00; Non-refundable',
      "5,08:30,Ridge,trail,Trails,,,,,,Opens 60 days ahead at 08:00; Non-refundable",
      ",,Car hire,booking,,,,,,,Reserve with free cancellation.",
    ]);
    expect(lines.at(-1)).toContain("Source: Trip Plans");
  });
  it("a trip with no bookings has an empty column and no booking row", () => {
    const none = tripCsv({ ...model, bookings: [], stops: model.stops.map(({ bookRule: _b, ...s }) => s) });
    expect(none).not.toMatch(/,booking,/);
    for (const l of none.trimEnd().split("\r\n").slice(1, -1)) expect(l.endsWith(",")).toBe(true);
  });
  it("the model parses as the contract's trip model with its bookings, and the detector passes", () => {
    const parsed = tripExportModel.safeParse(model);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 2))).toBe(true);
    expect(tripExportModel.safeParse({ ...model, bookings: undefined }).success, "bookings is required ([] when none)").toBe(false);
    expect(privacyHits(model)).toEqual([]);
    expect(isDated(tripCsv(model))).toBe(false);
  });
});
