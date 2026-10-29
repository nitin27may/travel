// PA-X: the export and API contract for park entry (protected-area-entry 5.2, 6.2, 6.3; BACKLOG 15.223d). Every wording of 5.2 is
// pinned, old rolling rows read exactly as before (parity), capture windows map to rules, a requirement gives one row per ridden day when
// its window counts from the day of use, rows carry a kind, and only booking rows are counted "to book ahead" (QP3).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookingCounts, bookingKindOf, bookRuleText, tripBookings, withStopBookings, type BookingSource, type BookRuleInput } from "../../src/export/bookings.ts";
import { bookRuleFromWindow, NO_RESERVATION, requirementKind, requirementLink, requirementRows, singleDay, WINDOW_NOT_PUBLISHED } from "../../src/export/requirements.ts";
import { tripCsv } from "../../src/export/csv.ts";
import { BOOK_RULE_KINDS, BOOKING_KINDS, EXPORT_MODEL_VERSION, type TripExport } from "../../src/export/types.ts";
import { WINDOW_RULE, VISIT_MODE } from "../../src/schema/capture/records.ts";
import { bookRule, exportBooking, exportModel, tripDetail, tripExportModel, tripPark } from "../../src/schema/api/index.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { PARTY_LEAK } from "../../src/privacy/party.ts";

const FIX = JSON.parse(readFileSync(new URL("../fixtures/parks/rockies-style.json", import.meta.url), "utf8")) as { records: Record<string, any>[] };
const rec = (ref: string) => FIX.records.find((r) => r.ref === ref)!;
const SHUTTLE = rec("offer/place/moraine-lake#shuttle-seat");
const OHARA = rec("offer/place/yoho-national-park#lake-ohara-day-use-bus");
const SUPER = rec("offer/place/moraine-lake#super-pass");
const KAN = rec("offer/place/kananaskis-country#conservation-pass");
const PARKING = rec("offer/place/lake-louise#parking");
const BANFF_FEE = rec("offer/place/banff-national-park#daily-admission");
const DISCOVERY = rec("offer/operator/parks-canada#discovery-pass");

const r = (over: Partial<BookRuleInput>): BookRuleInput => ({ daysBefore: 0, dayN: null, time: null, tz: null, ...over });

describe("bookRuleText: every wording of 5.2", () => {
  it("rolling (unchanged)", () => {
    expect(bookRuleText(r({ kind: "rolling", daysBefore: 2, dayN: 10, time: "08:00", tz: "America/Edmonton" }))).toBe("Opens 2 days before Day 10 at 08:00 local");
  });
  it("fixed_date", () => {
    expect(bookRuleText(r({ kind: "fixed_date", months: [4, 4], time: "08:00", tz: "America/Edmonton" }))).toBe("Opens on launch day, usually in April at 08:00 local");
    expect(bookRuleText(r({ kind: "fixed_date", months: [3, 5] }))).toBe("Opens on launch day, usually between March and May");
    expect(bookRuleText(r({ kind: "fixed_date" }))).toBe("Opens on launch day each year");
  });
  it("lottery, with the leftover seats", () => {
    expect(bookRuleText(r({ kind: "lottery", months: [3, 3], dayN: 9, then: r({ kind: "anytime", dayN: 9, closes: { daysBefore: 1, time: "15:30" } }) }))).toBe(
      "Lottery: apply usually in March; leftover seats until 15:30 the day before Day 9",
    );
    expect(bookRuleText(r({ kind: "lottery", months: [3, 3] }))).toBe("Lottery: apply usually in March");
  });
  it("monthly_release", () => {
    expect(bookRuleText(r({ kind: "monthly_release", monthLeadDays: 35, time: "09:00", tz: "America/Edmonton" }))).toBe("Opens monthly, about 35 days before the month, at 09:00 local");
    expect(bookRuleText(r({ kind: "monthly_release" }))).toBe("Opens monthly");
  });
  it("same_day", () => {
    expect(bookRuleText(r({ kind: "same_day", dayN: 4, time: "07:00", tz: "Europe/Rome" }))).toBe("Opens on Day 4 at 07:00 local");
  });
  it("anytime, with and without a close", () => {
    expect(bookRuleText(r({ kind: "anytime", dayN: 1 }))).toBe("Buy any time before Day 1");
    expect(bookRuleText(r({ kind: "anytime", dayN: 12, closes: { daysBefore: 0, time: "23:59" } }))).toBe("Buy by 23:59 on Day 12");
    expect(bookRuleText(r({ kind: "anytime" }))).toBe("Buy any time before the trip");
  });
  it("on_arrival", () => {
    expect(bookRuleText(r({ kind: "on_arrival", dayN: 10 }))).toBe("Pay on arrival");
  });
  it("two phases: a launch day, then the rolling release (6.3, the shuttle)", () => {
    expect(bookRuleText(r({ kind: "fixed_date", months: [4, 4], time: "08:00", tz: "America/Edmonton", dayN: 10, then: r({ kind: "rolling", daysBefore: 2, dayN: 10, time: "08:00", tz: "America/Edmonton" }) }))).toBe(
      "Opens on launch day, usually in April at 08:00 local; then 2 days before Day 10 at 08:00",
    );
  });
  it("a share of seats and a close on a rolling phase", () => {
    expect(bookRuleText(r({ kind: "fixed_date", months: [4, 4], sharePct: 40, then: r({ kind: "rolling", daysBefore: 2, dayN: 10, sharePct: 60 }) }))).toBe(
      "Opens on launch day, usually in April (40% of seats); then 2 days before Day 10 (60%)",
    );
    expect(bookRuleText(r({ kind: "rolling", daysBefore: 3, dayN: 5, closes: { daysBefore: 1, time: "18:00" } }))).toBe("Opens 3 days before Day 5, until 18:00 the day before Day 5");
  });
  it("is dateless: no year, no ISO date, in any wording", () => {
    const all = [
      r({ kind: "fixed_date", months: [1, 12], time: "08:00", tz: "x" }), r({ kind: "lottery", months: [2, 2] }), r({ kind: "monthly_release", monthLeadDays: 1 }),
      r({ kind: "anytime", dayN: 3, closes: { daysBefore: 4, time: "10:00" } }),
    ].map(bookRuleText);
    for (const t of all) expect(t).not.toMatch(/\b(?:19|20)\d{2}\b|\d{4}-\d{2}-\d{2}/);
  });
});

describe("parity: a rule written before PA-X (no kind) reads exactly as before", () => {
  // the words of the pre-PA-X function, inlined so the test pins them, not the new code against itself
  const before = (x: { daysBefore: number; dayN: number | null; time: string | null; tz: string | null }): string => {
    const days = `${x.daysBefore} day${x.daysBefore === 1 ? "" : "s"}`;
    const when = x.daysBefore === 0 ? (x.dayN !== null ? `on Day ${x.dayN}` : "on the day") : x.dayN !== null ? `${days} before Day ${x.dayN}` : `${days} ahead`;
    return `Opens ${when}${x.time ? ` at ${x.time}${x.tz ? " local" : ""}` : ""}`;
  };
  it("for every combination of lead, day, time and zone", () => {
    for (const daysBefore of [0, 1, 2, 30]) for (const dayN of [null, 1, 9]) for (const time of [null, "08:00"]) for (const tz of [null, "Europe/Rome"]) {
      const x = { daysBefore, dayN, time, tz };
      expect(bookRuleText(x)).toBe(before(x));
      expect(bookRuleText({ ...x, kind: "rolling" })).toBe(before(x));
    }
  });
  it("an old row is a booking, and a note saying there is nothing to book still drops it", () => {
    const rows: BookingSource[] = [
      { key: "a", name: "A", placeSlug: null, days: [3], bookRule: { daysBefore: 30, dayN: 3, time: null, tz: null }, bookNote: null },
      { key: "b", name: "B", placeSlug: null, days: [4], bookRule: null, bookNote: "No booking expected." },
    ];
    expect(tripBookings(rows)).toEqual([{ name: "A", rule: "Opens 30 days before Day 3", note: null, day: 3, ref: "a", kind: "booking", park: null, link: null }]);
  });
});

describe("kinds and counts (QP3)", () => {
  const rows: BookingSource[] = [
    { key: "shuttle:d10", name: "Shuttle", placeSlug: "lake-louise", days: [10], bookRule: r({ kind: "rolling", daysBefore: 2, dayN: 10 }), bookNote: null, bookKind: "booking", park: "Banff National Park", link: "https://example.org/b" },
    { key: "pass", name: "Pass", placeSlug: null, days: [1], bookRule: r({ kind: "anytime", dayN: 1 }), bookNote: null, bookKind: "pass" },
    { key: "lot", name: "Lot", placeSlug: "lake-louise", days: [10], bookRule: null, bookNote: "No booking; the lot fills before sunrise.", bookKind: "check" },
    { key: "car", name: "Rental car", placeSlug: null, days: [1], bookRule: null, bookNote: "Reserve with free cancellation.", bookKind: "task" },
    { key: "arrive", name: "Toll", placeSlug: null, days: [2], bookRule: r({ kind: "on_arrival", dayN: 2 }), bookNote: null },
  ];
  const out = tripBookings(rows);
  it("each row carries its kind, park and link; an explicit check keeps a 'no booking' note; on_arrival with no kind is a check", () => {
    expect(out.map((b) => [b.ref, b.kind])).toEqual([["pass", "pass"], ["car", "task"], ["arrive", "check"], ["shuttle:d10", "booking"], ["lot", "check"]]);
    expect(out.find((b) => b.ref === "shuttle:d10")).toMatchObject({ park: "Banff National Park", link: "https://example.org/b" });
    expect(bookingKindOf({ bookRule: r({ kind: "on_arrival" }) })).toBe("check");
    expect(bookingKindOf({ bookRule: null })).toBe("booking");
  });
  it("counts: only booking rows are to book; checks are listed and never counted", () => {
    expect(bookingCounts(out)).toEqual({ toBook: 1, booking: 1, pass: 1, check: 2, task: 1 });
  });
  it("every row parses as the contract's exportBooking", () => {
    for (const b of out) expect(exportBooking.safeParse(b).success, b.ref).toBe(true);
    expect(exportBooking.safeParse({ ...out[0], kind: "maybe" }).success).toBe(false);
    expect(exportBooking.safeParse({ name: "X", rule: null, note: "n", day: 1, ref: "x" }).success, "kind, park and link are required").toBe(false);
  });
  it("the CSV's Kind column takes the row kind", () => {
    const model: TripExport = {
      type: "trip", version: EXPORT_MODEL_VERSION, slug: "t", title: "T", url: "https://x.invalid/trips/t/", depth: "full", nights: 9, tz: null, seasonLabel: null, skipped: 0, waypoints: [], lines: [],
      days: [], stops: [], bookings: out,
    };
    const csv = tripCsv(model).split("\n");
    expect(csv.find((l) => l.includes(",Lot,"))).toMatch(/^10,,Lot,check,/);
    expect(csv.find((l) => l.includes(",Pass,"))).toMatch(/^1,,Pass,pass,/);
    expect(csv.find((l) => l.includes("Rental car"))).toMatch(/^1,,Rental car,task,/);
    expect(csv.find((l) => l.includes(",Shuttle,"))).toMatch(/^10,,Shuttle,booking,/);
  });
  it("a check row's text rides on its stop like any booking", () => {
    const [s] = withStopBookings([{ day: 10, placeSlug: "lake-louise" }], rows);
    expect(s!.bookAhead).toBe("Opens 2 days before Day 10; No booking; the lot fills before sunrise.");
  });
});

describe("bookRuleFromWindow: the capture windowSpec as a rule (15.223d)", () => {
  it("the two-phase shuttle, read from a sourced value", () => {
    expect(bookRuleFromWindow(SHUTTLE.window, 10)).toEqual({
      kind: "fixed_date", daysBefore: 0, dayN: 10, time: "08:00", tz: "America/Edmonton", months: [4, 4],
      then: { kind: "rolling", daysBefore: 2, dayN: 10, time: "08:00", tz: "America/Edmonton" },
    });
  });
  it("a lottery whose second phase has a close and no lead is 'leftover seats until ...'", () => {
    expect(bookRuleText(bookRuleFromWindow(OHARA.window, 9)!)).toBe("Lottery: apply usually in March; leftover seats until 15:30 the day before Day 9");
  });
  it("monthly release, anytime with a close, on arrival, a bare value", () => {
    expect(bookRuleText(bookRuleFromWindow(SUPER.window, 11)!)).toBe("Opens monthly, about 35 days before the month, at 09:00 local");
    expect(bookRuleText(bookRuleFromWindow(KAN.window, 12)!)).toBe("Buy by 23:59 on Day 12");
    expect(bookRuleText(bookRuleFromWindow(PARKING.window, 10)!)).toBe("Pay on arrival");
    expect(bookRuleFromWindow({ rule: "rolling", days_before: 30 }, 3)).toEqual({ kind: "rolling", daysBefore: 30, dayN: 3, time: null, tz: null });
  });
  it("no rule from a gap, searched_none, an unknown rule, or a rolling window with no lead and no close", () => {
    expect(bookRuleFromWindow({ v: null, state: "searched_none", basis: null, src: [] }, 3)).toBeNull();
    expect(bookRuleFromWindow({ v: { rule: "rolling", days_before: 2 }, state: "gap", basis: null, src: [] }, 3)).toBeNull();
    expect(bookRuleFromWindow({ rule: "whenever" }, 3)).toBeNull();
    expect(bookRuleFromWindow({ rule: "rolling" }, 3)).toBeNull();
    expect(bookRuleFromWindow(undefined, 3)).toBeNull();
  });
  it("the rule kinds equal the capture window rules, and the API's visit modes the capture's", () => {
    expect([...BOOK_RULE_KINDS].sort()).toEqual([...WINDOW_RULE].sort());
    expect(tripPark.shape.modes.element.options.slice().sort()).toEqual([...VISIT_MODE].sort());
    expect([...BOOKING_KINDS]).toEqual(["booking", "pass", "check", "task"]);
  });
});

describe("requirementRows: rows from requirement records (6.2, 6.3)", () => {
  it("one row per ridden day: the shuttle on days 10 and 11 gives two rows, each with its own Day N (6.3)", () => {
    const rows = requirementRows(SHUTTLE, { key: "need:shuttle", days: [11, 10], park: "Banff National Park", placeSlug: "moraine-lake" });
    const out = tripBookings(rows);
    expect(out.map((b) => [b.ref, b.day, b.kind, b.rule])).toEqual([
      ["need:shuttle:d10", 10, "booking", "Opens on launch day, usually in April at 08:00 local; then 2 days before Day 10 at 08:00"],
      ["need:shuttle:d11", 11, "booking", "Opens on launch day, usually in April at 08:00 local; then 2 days before Day 11 at 08:00"],
    ]);
    expect(out[0]).toMatchObject({ park: "Banff National Park", link: "https://example.org/shuttle/book", name: "Moraine Lake and Lake Louise shuttle seat" });
  });
  it("a window that does not count from the day of use, or a pass valid for longer, gives one row for its days", () => {
    expect(requirementRows(SUPER, { key: "k", days: [10, 11] }).map((x) => [x.key, x.days])).toEqual([["k", [10, 11]]]); // a monthly batch is not day relative
    const week = { ...SHUTTLE, entry: { ...SHUTTLE.entry, v: { ...SHUTTLE.entry.v, valid: { span: 7, unit: "day", from: "first_use" } } } };
    expect(requirementRows(week, { key: "k", days: [10, 11] }).map((x) => x.key)).toEqual(["k"]); // valid a week: one row
    const noValid = { ...SHUTTLE, entry: { ...SHUTTLE.entry, v: { ...SHUTTLE.entry.v, valid: undefined } } };
    expect(requirementRows(noValid, { key: "k", days: [10, 11] }).map((x) => x.key)).toEqual(["k"]); // validity unknown: one row
  });
  it("everything else is one row counted from the first day", () => {
    const kan = tripBookings(requirementRows(KAN, { key: "need:kan", days: [12, 13, 14, 15] }));
    expect(kan).toEqual([{ name: "Conservation pass", rule: "Buy by 23:59 on Day 12", note: null, day: 12, ref: "need:kan", kind: "pass", park: null, link: null }]);
    const fee = tripBookings(requirementRows(BANFF_FEE, { key: "need:fee", days: [3, 4, 5], park: "Banff National Park" }));
    expect(fee).toMatchObject([{ rule: "Buy any time before Day 3", kind: "pass", day: 3, link: "https://example.org/banff-national-park/fees" }]);
  });
  it("kinds by window rule and type (6.2)", () => {
    expect(requirementKind(SHUTTLE)).toBe("booking");
    expect(requirementKind(OHARA)).toBe("booking");
    expect(requirementKind(KAN)).toBe("pass");
    expect(requirementKind(DISCOVERY)).toBe("pass");
    expect(requirementKind(PARKING)).toBe("check");
    expect(requirementKind({ type: "access.park.parking" })).toBe("check");
    expect(requirementKind({ type: "access.pass.entry_fee" })).toBe("pass");
    expect(requirementKind({ type: "access.pass.timed_entry" })).toBe("booking");
    expect(requirementKind({ type: "access.pass.vehicle_permit", window: { rule: "rolling", days_before: 5 } })).toBe("booking");
  });
  it("a check row says why it is listed; a searched_none window says it is not published; neither is counted to book", () => {
    const lot = tripBookings(requirementRows({ type: "access.park.parking", name: "Lot" }, { key: "lot", days: [10] }));
    expect(lot).toMatchObject([{ kind: "check", rule: null, note: NO_RESERVATION }]);
    const open = tripBookings(requirementRows({ type: "access.pass.backcountry_permit", name: "Permit", window: { v: null, state: "searched_none", basis: null, src: [] } }, { key: "bp", days: [2] }));
    expect(open).toMatchObject([{ kind: "booking", rule: null, note: WINDOW_NOT_PUBLISHED }]);
    expect(bookingCounts([...lot, ...open]).toBook).toBe(1);
  });
  it("singleDay and the booking link", () => {
    expect(singleDay(SHUTTLE)).toBe(true);
    expect(singleDay(DISCOVERY)).toBe(false);
    expect(singleDay({ entry: { valid: { span: 1, unit: "slot" } } })).toBe(true);
    expect(singleDay({})).toBe(false);
    expect(requirementLink(DISCOVERY)).toBe("https://example.org/discovery-pass/buy");
    expect(requirementLink(SHUTTLE)).toBe("https://example.org/shuttle/book");
    expect(requirementLink({})).toBeNull();
  });
  it("no record ref reaches a row unless the caller passes one as the key", () => {
    const rows = requirementRows(SHUTTLE, { key: "need:shuttle", days: [10] });
    expect(JSON.stringify(tripBookings(rows))).not.toMatch(/"(?:place|part|offer|legacy)\//);
  });
});

describe("API contract (additive) and the model version", () => {
  it("bookRule: old rows parse, every new key parses, a third phase does not", () => {
    expect(bookRule.safeParse({ daysBefore: 30, dayN: 3, time: null, tz: null }).success).toBe(true);
    const shuttle = bookRuleFromWindow(SHUTTLE.window, 10)!;
    expect(bookRule.safeParse(shuttle).success).toBe(true);
    expect(bookRule.safeParse(bookRuleFromWindow(OHARA.window, 9)).success).toBe(true);
    expect(bookRule.safeParse({ ...shuttle, then: { ...shuttle.then, then: shuttle.then } }).success).toBe(false);
    expect(bookRule.safeParse({ daysBefore: 0, dayN: 1, time: null, tz: null, kind: "someday" }).success).toBe(false);
    expect(bookRule.safeParse({ daysBefore: 0, dayN: 1, time: null, tz: null, months: [0, 13] }).success).toBe(false);
  });
  it("tripDetail no longer carries legacyUrl (old folder names encode real travel months)", () => {
    expect(Object.keys(tripDetail.shape)).not.toContain("legacyUrl");
    expect(Object.keys(tripDetail.shape)).toContain("parks");
  });
  it("the export model has a version, and a body without one is refused", () => {
    const body = { type: "trip", version: EXPORT_MODEL_VERSION, slug: "t", title: "T", url: "u", depth: "full", nights: 0, days: [], stops: [], bookings: [], waypoints: [], lines: [], tz: null, seasonLabel: null, skipped: 0 };
    expect(tripExportModel.safeParse(body).success).toBe(true);
    expect(exportModel.safeParse({ ...body, version: undefined }).success).toBe(false);
    expect(EXPORT_MODEL_VERSION).toBe(2);
  });
});

describe("privacy: derived rows and park lines carry no household data", () => {
  it("the detector finds nothing in rows built from the fixture, and no party clause survives", () => {
    const rows = [SHUTTLE, OHARA, SUPER, KAN, PARKING, BANFF_FEE].flatMap((x, i) => requirementRows(x, { key: `need:${i}`, days: [9, 10, 11], park: "Banff National Park" }));
    const out = tripBookings(rows);
    expect(privacyHits(out)).toEqual([]);
    for (const b of out) expect(PARTY_LEAK.test(`${b.rule ?? ""} ${b.note ?? ""}`), b.ref).toBe(false);
    const planted = tripBookings(requirementRows(PARKING, { key: "p", days: [10], note: "Fine for a family of 3 with a 6-year-old; lot fills early." }));
    expect(planted[0]!.note ?? "").not.toMatch(/family of 3|6-year-old/);
  });
});
