// TRP-GL-C: booking windows in the trip export contract (MUST-6; T1, P6, P8). The words, the order, the stop link, the CSV column and the
// contract's shape, on a small model; the real trips are checked against the page in web/tests/export/trip-routes.test.ts.
import { describe, expect, it } from "vitest";
import { bookAheadText, bookRuleText, type BookRuleInput, NOTHING_TO_BOOK, publicBookingNote, tripBookings, withStopBookings, type BookingSource } from "../../src/export/bookings.ts";
import { TRIP_CSV_HEADER, tripCsv } from "../../src/export/csv.ts";
import type { ExportStop, TripExport } from "../../src/export/types.ts";
import { isDated } from "../../src/privacy/dateless.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { exportBooking, tripExportModel } from "../../src/schema/api/index.ts";

const row = (over: Partial<BookingSource> & Pick<BookingSource, "key" | "name">): BookingSource => ({ placeSlug: null, days: [], bookRule: null, bookNote: null, ...over });

const ROWS: BookingSource[] = [
  row({ key: "stays:a", name: "Hotel A", days: [1, 2] }),
  row({ key: "logistics:slot", name: "Toll road slot", placeSlug: "loop", days: [3], bookRule: { daysBefore: 30, dayN: 3, time: null, tz: "Europe/Rome" } }),
  row({ key: "logistics:pass", name: "Park pass", days: [2, 1], bookNote: "INFERENCE 2029: buy online before the first park gate." }),
  row({ key: "logistics:any", name: "Car hire", bookNote: "Reserve with free cancellation." }),
  row({ key: "logistics:lift", name: "Lift, 08:30 slot", placeSlug: "ridge", days: [5], bookRule: { daysBefore: 60, dayN: null, time: "08:00", tz: null }, bookNote: "Non-refundable" }),
  row({ key: "logistics:blank", name: "Nothing to book", days: [4], bookNote: "   " }),
  row({ key: "logistics:walk-in", name: "Canyon parking", days: [2], bookNote: "INFERENCE 2029: no booking expected; arrive before 08:00." }),
  row({ key: "logistics:bears", name: "Wildlife orders", days: [2], bookNote: "Check bulletins in the week before; carry bear spray." }),
  row({ key: "logistics:group", name: "Group-of-four rule", days: [4], bookNote: "INFERENCE 2029: a family of 3 cannot hike when the rule is mandatory unless joining others; whether a 6-year-old counts is GAP." }),
];

const stop = (over: Partial<ExportStop> & Pick<ExportStop, "id" | "day">): ExportStop => ({
  order: 0, name: over.id, kind: "trail", category: "trails", area: null, time: null, durationMin: null, lane: null, note: null, placeSlug: null, links: [], point: null, ...over,
});

describe("bookRuleText: the page's words for a window, dateless", () => {
  it("relative to a day, with the time and 'local' only when the plan has them", () => {
    expect(bookRuleText({ daysBefore: 30, dayN: 3, time: null, tz: null })).toBe("Opens 30 days before Day 3");
    expect(bookRuleText({ daysBefore: 60, dayN: null, time: "08:00", tz: "America/Edmonton" })).toBe("Opens 60 days ahead at 08:00 local");
  });
  it("'local' never dangles: a zone with no time adds nothing (TRP-GL, review F7)", () => {
    expect(bookRuleText({ daysBefore: 30, dayN: 3, time: null, tz: "Europe/Rome" })).toBe("Opens 30 days before Day 3");
    expect(bookRuleText({ daysBefore: 30, dayN: 3, time: "09:00", tz: "Europe/Rome" })).toBe("Opens 30 days before Day 3 at 09:00 local");
  });
  it("no kind of window says 'local' unless a clock time stands before it (UXB-6, UI-NOTES 26 Oct)", () => {
    const base = { daysBefore: 0, dayN: 3, time: null, tz: "Europe/Rome" };
    const phases: BookRuleInput[] = [
      { ...base, daysBefore: 30 },
      { ...base, kind: "same_day" as const },
      { ...base, kind: "fixed_date" as const, months: [4, 4] as [number, number] },
      { ...base, kind: "monthly_release" as const, monthLeadDays: 60 },
      { ...base, kind: "lottery" as const, months: [3, 3] as [number, number] },
      { ...base, kind: "anytime" as const },
      { ...base, kind: "on_arrival" as const },
      { ...base, daysBefore: 30, then: { ...base, daysBefore: 2 } },
    ];
    for (const p of phases) expect(bookRuleText(p), JSON.stringify(p)).not.toMatch(/local/);
    for (const p of phases.filter((x) => !["lottery", "anytime", "on_arrival"].includes(x.kind ?? ""))) {
      const withTime = bookRuleText({ ...p, time: "08:00", then: p.then ? { ...p.then, time: "09:00" } : undefined });
      expect(withTime, JSON.stringify(p)).toMatch(/\d\d:\d\d local/);
      expect(withTime.replace(/\d\d:\d\d local/g, ""), JSON.stringify(p)).not.toMatch(/local/);
    }
  });
  it("bookAheadText joins the rule and the note, and is empty with neither", () => {
    expect(bookAheadText({ rule: "Opens 2 days before Day 1", note: "Non-refundable" })).toBe("Opens 2 days before Day 1; Non-refundable");
    expect(bookAheadText({ rule: null, note: "Buy online" })).toBe("Buy online");
    expect(bookAheadText({ rule: null, note: null })).toBe("");
  });
});

describe("bookRuleText: singular and same-day windows (review F16)", () => {
  it("says '1 day', and 'on Day N' for a window that opens on the day", () => {
    expect(bookRuleText({ daysBefore: 1, dayN: 2, time: null, tz: null })).toBe("Opens 1 day before Day 2");
    expect(bookRuleText({ daysBefore: 1, dayN: null, time: "08:00", tz: null })).toBe("Opens 1 day ahead at 08:00");
    expect(bookRuleText({ daysBefore: 0, dayN: 4, time: "07:00", tz: null })).toBe("Opens on Day 4 at 07:00");
    expect(bookRuleText({ daysBefore: 0, dayN: null, time: null, tz: null })).toBe("Opens on the day");
  });
});

describe("publicBookingNote: the export's scrub of a booking note (review F1)", () => {
  it("strips the bare year the page's marker strip leaves, never a clock", () => {
    expect(publicBookingNote("2029: buy a few weeks ahead for the chosen day. Maligne Road is open.")).toBe("Buy a few weeks ahead for the chosen day. Maligne Road is open.");
    expect(publicBookingNote("Buy ahead. 2029: seats open at 08:00 two days before.")).toBe("Buy ahead. Seats open at 08:00 two days before.");
    expect(publicBookingNote("Opens at 08:00: be ready.")).toBe("Opens at 08:00: be ready.");
  });
  it("strips the research marker and a bare GAP, keeps the rest in its words", () => {
    expect(publicBookingNote("INFERENCE 2029: buy a few weeks ahead for the chosen day.")).toBe("Buy a few weeks ahead for the chosen day.");
    expect(publicBookingNote("INFERENCE 2029: road should be open in September; pre-book icefield tour for chosen day (GAP on lead time).")).toBe("Road should be open in September; pre-book icefield tour for chosen day.");
    expect(publicBookingNote("INFERENCE 2029: call or check each lodge's site; child policy GAP.")).toBe("Call or check each lodge's site.");
    expect(publicBookingNote("INFERENCE 2029: do not rely on it; no information on later editions (GAP).")).toBe("Do not rely on it; no information on later editions.");
    expect(publicBookingNote("Child policy GAP.")).toBeNull();
  });
  it("drops a clause that states the household's make-up, and keeps a rule for everyone", () => {
    expect(publicBookingNote("INFERENCE 2029: a family of 3 cannot hike when the rule is mandatory unless joining others; whether a 6-year-old counts is GAP.")).toBeNull();
    expect(publicBookingNote("Book once the schedule is posted; hike suitability for a 6-year-old GAP.")).toBe("Book once the schedule is posted.");
    expect(publicBookingNote("Late Jan; unrealistic with a 6-year-old unless short trips.")).toBe("Late Jan.");
    expect(publicBookingNote("Max 3 nights, 2 reservations per household per season.")).toBe("Max 3 nights, 2 reservations per household per season.");
    expect(publicBookingNote("Children under 6 ride free.")).toBe("Children under 6 ride free.");
    expect(publicBookingNote("Book the lodge early; our kids loved it.")).toBe("Book the lodge early.");
    expect(publicBookingNote("Book the boat; the 300-year-old church is next to the pier.")).toBe("Book the boat; the 300-year-old church is next to the pier.");
    expect(publicBookingNote("Buy the annual family pass.")).toBe("Buy the annual family pass.");
  });
  it("knows a note that says there is nothing to book", () => {
    for (const t of ["No booking expected; arrive before 08:00.", "No advance booking needed beyond timed ticket.", "Buy online on the day.", "Check bulletins in the week before; carry bear spray.", "No booking."]) expect(NOTHING_TO_BOOK.test(t), t).toBe(true);
    for (const t of ["Book on launch day.", "Reserve with free cancellation once lodging is booked.", "Buy a few weeks ahead for the chosen day."]) expect(NOTHING_TO_BOOK.test(t), t).toBe(false);
  });
  it("is null for no note", () => {
    expect(publicBookingNote(null)).toBeNull();
    expect(publicBookingNote("  ")).toBeNull();
  });
});

describe("tripBookings", () => {
  const out = tripBookings(ROWS);
  it("keeps only rows with a rule or a public note, never a stay, a blank note, a 'nothing to book' note or a household-only note", () => {
    expect(out.map((b) => b.ref)).toEqual(["logistics:pass", "logistics:slot", "logistics:lift", "logistics:any"]);
  });
  it("the day is the rule's own day, then the first day it is for (review F10)", () => {
    const [b] = tripBookings([row({ key: "logistics:late", name: "Late", days: [3, 5], bookRule: { daysBefore: 7, dayN: 5, time: null, tz: null } })]);
    expect(b!.day).toBe(5);
  });
  it("a rule keeps its row even when its note says there is nothing more to book", () => {
    const [b] = tripBookings([row({ key: "logistics:r", name: "R", days: [2], bookRule: { daysBefore: 2, dayN: 2, time: null, tz: null }, bookNote: "INFERENCE 2029: no booking expected beyond the seat." })]);
    expect(b).toEqual({ name: "R", rule: "Opens 2 days before Day 2", note: "No booking expected beyond the seat.", day: 2, ref: "logistics:r", kind: "booking", park: null, link: null });
  });
  it("is in day order (first day it is for), a booking with no day last", () => {
    expect(out.map((b) => b.day)).toEqual([1, 3, 5, null]);
  });
  it("carries the page's name, the rule in words, and the note", () => {
    expect(out[1]).toEqual({ name: "Toll road slot", rule: "Opens 30 days before Day 3", note: null, day: 3, ref: "logistics:slot", kind: "booking", park: null, link: null });
    expect(out[0]).toEqual({ name: "Park pass", rule: null, note: "Buy online before the first park gate.", day: 1, ref: "logistics:pass", kind: "booking", park: null, link: null });
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
    expect(out.map((s) => s.bookAhead ?? null)).toEqual(["Opens 30 days before Day 3", null, "Opens 60 days ahead at 08:00; Non-refundable", null]);
    expect("bookAhead" in out[1]!).toBe(false);
  });
});

describe("tripCsv: the 'Book ahead' column", () => {
  const model: TripExport = {
    type: "trip", version: 2, slug: "t", title: "T", url: "https://x.invalid/trips/t/", depth: "full", nights: 4, tz: null, seasonLabel: null, skipped: 0, waypoints: [], lines: [],
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
      "1,,Park pass,booking,,,,,,,,Buy online before the first park gate.",
      "3,,Toll road slot,booking,,,,,,,,Opens 30 days before Day 3",
      "3,~09:00,Loop,trail,Trails,,,,,,,Opens 30 days before Day 3",
      '5,,"Lift, 08:30 slot",booking,,,,,,,,Opens 60 days ahead at 08:00; Non-refundable',
      "5,08:30,Ridge,trail,Trails,,,,,,,Opens 60 days ahead at 08:00; Non-refundable",
      ",,Car hire,booking,,,,,,,,Reserve with free cancellation.",
    ]);
    expect(lines.at(-1)).toContain("Source: Trip Plans");
  });
  it("a trip with no bookings has an empty column and no booking row", () => {
    const none = tripCsv({ ...model, bookings: [], stops: model.stops.map(({ bookAhead: _b, ...s }) => s) });
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
