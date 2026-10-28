// The whole template delta (STEP2-C2; gap-analysis H2, D5): golden tests on the Rockies and the Dolomites, as the public pages schedule
// them (core/test/schedule/fixtures/*-trip.json are the pages' ScheduleDayInput[] for both trips, frozen on 28 Oct 2026 as
// `getTrip(slug).days.map((d) => d.scheduleInput)` of web/lib/public, public data only; re-dump them the same way when the trips'
// days change). Each edit re-flows only the days it touches; every other day is the public page's timeline, entry for entry.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scheduleDay, scheduleTrip } from "../../src/schedule/schedule.ts";
import {
  dropDay, emptyDayEdit, emptyTemplateDelta, insertDay, moveItem, removeItem, scheduleEdited, scheduleTemplate, stopsOf, type EditedDay,
} from "../../src/schedule/template.ts";
import type { DayTimeline, Profile, ScheduleDayInput, TemplateDelta, TemplateSchedule } from "../../src/schedule/types.ts";
import { day, family, item, profile, variant } from "./helpers.ts";

const load = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as ScheduleDayInput[];
const ROCKIES = load("rockies-trip");
const DOLOMITES = load("dolomites-trip");
const FAMILY = family(6);
const ADULTS = profile();

const delta = (over: Partial<TemplateDelta>): TemplateDelta => ({ ...emptyTemplateDelta(), ...over });
const ids = (t: DayTimeline): string[] => t.entries.filter((e) => e.sourceItemId).map((e) => e.sourceItemId!);
const ofRef = (s: TemplateSchedule, ref: number | string) => s.days.find((d) => d.ref === ref)!;

/** Every day whose ref is not in `touched` is the public page's timeline exactly; every touched day differs from it. */
function onlyTouched(days: ScheduleDayInput[], p: Profile, s: TemplateSchedule, touched: (number | string)[]): void {
  const base = new Map(scheduleTrip(days, p).map((t) => [t.day, t]));
  for (const d of s.days) {
    if (touched.includes(d.ref)) {
      if (!d.inserted) expect(d.timeline, `day ${d.ref} re-flows`).not.toEqual(base.get(d.ref as number));
      expect(d.changed, `day ${d.ref} is marked changed`).toBe(true);
    } else {
      expect(d.timeline, `day ${d.ref} is untouched`).toEqual(base.get(d.ref as number));
      expect(d.changed).toBe(false);
    }
  }
}

describe("an empty delta schedules exactly what the public page does", () => {
  for (const [name, days, p] of [["Rockies, family", ROCKIES, FAMILY], ["Rockies, adults with a split", ROCKIES, family(8, { split: true })], ["Dolomites, adults", DOLOMITES, ADULTS]] as const) {
    it(name, () => {
      const s = scheduleTemplate(days, emptyTemplateDelta(), p);
      expect(s.days.map((d) => d.timeline)).toEqual(scheduleTrip(days, p));
      expect(s.days.map((d) => d.n)).toEqual(days.map((d) => d.day));
      expect(s.skipped).toEqual([]);
    });
  }
  it("a version override and an addition by cheapest insertion are today's scheduleTrip", () => {
    const add = item("pyramid-island", "visit", "Pyramid Island", { durationMin: 45, durationSource: "plan" });
    const s = scheduleTemplate(ROCKIES, delta({ overrides: { "6": "C" }, added: [{ op: "o-1", day: 7, item: add }] }), FAMILY);
    expect(s.days.map((d) => d.timeline)).toEqual(scheduleTrip(ROCKIES, FAMILY, { 6: "C" }, { 7: [add] }));
    onlyTouched(ROCKIES, FAMILY, s, [6, 7]);
  });
});

describe("Rockies, a family with a youngest of 6", () => {
  it("removes a published stop: only Day 5 re-flows, the version stays", () => {
    const s = scheduleTemplate(ROCKIES, delta({ removed: [{ op: "o-r", day: 5, item: "mary-schaffer-loop" }] }), FAMILY);
    onlyTouched(ROCKIES, FAMILY, s, [5]);
    const d5 = ofRef(s, 5).timeline;
    expect(ids(d5)).not.toContain("mary-schaffer-loop");
    expect(ids(d5)).toContain("maligne-lake-cruise");
    expect(d5.variant).toEqual(scheduleTrip(ROCKIES, FAMILY)[4]!.variant);
  });

  it("moves a booked stop across days: the booking slot follows it, both days re-flow, the road time from the base stays the plan's", () => {
    const s = scheduleTemplate(ROCKIES, delta({ moved: [{ op: "o-m", day: 5, item: "maligne-lake-cruise", toDay: 6 }] }), FAMILY);
    onlyTouched(ROCKIES, FAMILY, s, [5, 6]);
    const d5 = ofRef(s, 5).timeline;
    const d6 = ofRef(s, 6).timeline;
    expect(ids(d5)).not.toContain("maligne-lake-cruise");
    expect(d5.entries.some((e) => e.bookingOf === "maligne-lake-cruise")).toBe(false);
    expect(ids(d6)[0]).toBe("maligne-lake-cruise");
    expect(d6.entries.find((e) => e.bookingOf === "maligne-lake-cruise")).toMatchObject({ kind: "booking", day: 6 });
    expect(d6.entries.find((e) => e.id === "maligne-lake-cruise")).toMatchObject({ start: "10:00", addedBy: "author" });
    const out = d6.entries.find((e) => e.kind === "leg")!;
    expect(out.to?.name).toBe(d6.entries.find((e) => e.id === "maligne-lake-cruise")!.title);
    expect(out.leg).toMatchObject({ basis: "plan", mode: "drive" });
    expect(out.durationMin).toBe(60);
  });

  it("moves a stop within its day after another (a reorder)", () => {
    const s = scheduleTemplate(ROCKIES, delta({ moved: [{ op: "o-m", day: 9, item: "natural-bridge", toDay: 9, after: "takakkaw-falls-walk" }] }), FAMILY);
    onlyTouched(ROCKIES, FAMILY, s, [9]);
    expect(ids(ofRef(s, 9).timeline).slice(0, 2)).toEqual(["takakkaw-falls-walk", "natural-bridge"]);
  });

  it("a rest comes back when a stop leaves a full day (trip-overview 5.2)", () => {
    const before = scheduleTrip(ROCKIES, FAMILY)[12]!;
    expect(before.entries.some((e) => e.kind === "rest" && e.sub === "at-base")).toBe(false);
    const s = scheduleTemplate(ROCKIES, delta({ removed: [{ op: "o-r", day: 13, item: "rawson-lake" }] }), FAMILY);
    expect(ofRef(s, 13).timeline.entries.some((e) => e.kind === "rest" && e.sub === "at-base")).toBe(true);
  });

  it("inserts a day: empty, at the base of the day before, numbered after it; the days after keep their timelines", () => {
    const s = scheduleTemplate(ROCKIES, delta({ days: [{ op: "o-i", kind: "insert", after: 6 }] }), FAMILY);
    onlyTouched(ROCKIES, FAMILY, s, ["o-i"]);
    expect(s.days).toHaveLength(16);
    const ins = ofRef(s, "o-i");
    expect(ins).toMatchObject({ n: 7, inserted: true });
    expect(ins.input).toMatchObject({ kind: "normal", base: { name: "Jasper" }, day: 16 });
    expect(ids(ins.timeline)).toEqual([]);
    expect(ins.timeline.entries.map((e) => e.kind)).toEqual(expect.arrayContaining(["start", "meal", "end"]));
    expect(ofRef(s, 7)).toMatchObject({ n: 8 });
    expect(ofRef(s, 7).timeline.day).toBe(7);
  });

  it("an inserted day after a transfer day sits at the base the transfer reached", () => {
    const s = scheduleTemplate(ROCKIES, delta({ days: [{ op: "o-i", kind: "insert", after: 3 }] }), FAMILY);
    expect(ofRef(s, "o-i").input.base?.name).toBe("Lake Louise");
  });

  it("drops a day and moves its stops to the day before: Day 7 goes, Day 6 takes its stops at the end, the rest stay", () => {
    const s = scheduleTemplate(ROCKIES, delta({ days: [{ op: "o-d", kind: "drop", day: 7, to: 6 }] }), FAMILY);
    expect(s.days).toHaveLength(14);
    expect(s.days.some((d) => d.ref === 7)).toBe(false);
    expect(s.days.map((d) => d.n)).toEqual([...Array(14).keys()].map((i) => i + 1));
    onlyTouched(ROCKIES, FAMILY, s, [6]);
    const d6 = ofRef(s, 6).timeline;
    expect(ids(d6)).toEqual(expect.arrayContaining(["mount-robson-viewpoint", "jasper-errands", "miette-hot-springs", "lake-annette-loop", "jasper-dark-sky"]));
    expect(d6.entries.find((e) => e.id === "jasper-dark-sky")).toMatchObject({ block: "After dark" });
  });

  it("drops a day with no target: its stops go with it", () => {
    const s = scheduleTemplate(ROCKIES, delta({ days: [{ op: "o-d", kind: "drop", day: 7 }] }), FAMILY);
    expect(s.days).toHaveLength(14);
    onlyTouched(ROCKIES, FAMILY, s, []);
    expect(s.days.flatMap((d) => ids(d.timeline))).not.toContain("miette-hot-springs");
  });

  it("removes the adults' stop of a split day: the parallel lane goes", () => {
    const p = family(6, { split: true });
    expect(scheduleTrip(ROCKIES, p)[4]!.lanes).toEqual(["B", "A"]);
    const s = scheduleTemplate(ROCKIES, delta({ removed: [{ op: "o-r", day: 5, item: "bald-hills" }] }), p);
    expect(ofRef(s, 5).timeline.lanes).toEqual(["all"]);
    expect(ids(ofRef(s, 5).timeline)).not.toContain("bald-hills");
  });
});

describe("Dolomites, two adults", () => {
  it("removes a published stop: only Day 8 re-flows", () => {
    const s = scheduleTemplate(DOLOMITES, delta({ removed: [{ op: "o-r", day: 8, item: "i17" }] }), ADULTS);
    onlyTouched(DOLOMITES, ADULTS, s, [8]);
    expect(ids(ofRef(s, 8).timeline)).toEqual(["i16", "i18"]);
  });
  it("moves the evening lake from Day 8 to Day 7, after the sight", () => {
    const s = scheduleTemplate(DOLOMITES, delta({ moved: [{ op: "o-m", day: 8, item: "i18", toDay: 7, after: "i15" }] }), ADULTS);
    onlyTouched(DOLOMITES, ADULTS, s, [7, 8]);
    expect(ids(ofRef(s, 7).timeline)).toEqual(["i14", "i15", "i18"]);
    expect(ids(ofRef(s, 8).timeline)).toEqual(["i16", "i17"]);
  });
  it("inserts a day after Day 4 and drops Day 6 into Day 7, in one delta", () => {
    const s = scheduleTemplate(DOLOMITES, delta({ days: [{ op: "o-i", kind: "insert", after: 4 }, { op: "o-d", kind: "drop", day: 6, to: 7 }] }), ADULTS);
    expect(s.days.map((d) => d.ref)).toEqual([1, 2, 3, 4, "o-i", 5, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(s.days.map((d) => d.n)).toEqual([...Array(14).keys()].map((i) => i + 1));
    onlyTouched(DOLOMITES, ADULTS, s, ["o-i", 7]);
    expect(ofRef(s, "o-i").input.base?.name).toBe("San Candido");
    expect(ids(ofRef(s, 7).timeline)).toEqual(["i14", "i15", "i13"]);
  });
  it("moves a stop to an inserted day, and adds a place there", () => {
    const add = item("lago-di-landro", "visit", "Lago di Landro", { durationMin: 30, durationSource: "plan" });
    const s = scheduleTemplate(
      DOLOMITES,
      delta({ days: [{ op: "o-i", kind: "insert", after: 2 }], moved: [{ op: "o-m", day: 3, item: "i6", toDay: "o-i" }], added: [{ op: "o-a", day: "o-i", item: add }] }),
      ADULTS,
    );
    onlyTouched(DOLOMITES, ADULTS, s, [3, "o-i"]);
    expect(ids(ofRef(s, "o-i").timeline).sort()).toEqual(["i6", "lago-di-landro"]);
    expect(ofRef(s, "o-i").timeline.entries.find((e) => e.id === "lago-di-landro")).toMatchObject({ addedBy: "visitor" });
  });
});

describe("op order and what cannot apply", () => {
  it("a stop removed, then moved, is not moved (removed first); unknown days and stops are listed, nothing else changes", () => {
    const s = scheduleTemplate(
      ROCKIES,
      delta({
        removed: [{ op: "o-1", day: 5, item: "pyramid-lake" }, { op: "o-2", day: 5, item: "kinney-lake" }, { op: "o-3", day: 40, item: "x" }],
        moved: [{ op: "o-4", day: 5, item: "pyramid-lake", toDay: 6 }, { op: "o-5", day: 5, item: "moose-lake-loop", toDay: "o-nope" }],
        added: [{ op: "o-6", day: "o-nope", item: item("x", "visit", "X") }],
        days: [{ op: "o-7", kind: "drop", day: 9, to: 99 }, { op: "o-8", kind: "insert", after: 77 }, { op: "o-9", kind: "drop", day: 41 }],
      }),
      FAMILY,
    );
    expect(s.skipped).toEqual(
      expect.arrayContaining([
        { op: "o-2", reason: "not-on-day" }, { op: "o-3", reason: "no-day" }, { op: "o-4", reason: "not-on-day" }, { op: "o-5", reason: "no-day" },
        { op: "o-6", reason: "no-day" }, { op: "o-7", reason: "no-day" }, { op: "o-8", reason: "no-day" }, { op: "o-9", reason: "no-day" },
      ]),
    );
    expect(s.skipped).toHaveLength(8);
    expect(s.days).toHaveLength(15);
    onlyTouched(ROCKIES, FAMILY, s, [5]);
  });
  it("a stop moved into a day that is then dropped goes on with that day's stops", () => {
    const s = scheduleTemplate(
      DOLOMITES,
      delta({ moved: [{ op: "o-m", day: 3, item: "i6", toDay: 6 }], days: [{ op: "o-d", kind: "drop", day: 6, to: 7 }] }),
      ADULTS,
    );
    expect(ids(ofRef(s, 7).timeline)).toEqual(["i14", "i15", "i6", "i13"]);
  });
  it("an added place with a position goes after that stop and times as the visitor's", () => {
    const add = item("pragser", "visit", "Prags", { durationMin: 40, durationSource: "plan" });
    const s = scheduleTemplate(DOLOMITES, delta({ added: [{ op: "o-a", day: 8, item: add, after: "i16" }] }), ADULTS);
    expect(ids(ofRef(s, 8).timeline)).toEqual(["i16", "pragser", "i17", "i18"]);
    expect(ofRef(s, 8).timeline.entries.find((e) => e.id === "pragser")).toMatchObject({ addedBy: "visitor", time: { source: "visitor" } });
  });
});

describe("the day functions", () => {
  const hard = item("via-ferrata", "trail", "Via ferrata", { durationMin: 120, durationSource: "plan", minAge: 12, minAgeRule: "hard" });
  const walk = item("meadow", "trail", "Meadow walk", { durationMin: 60, durationSource: "plan" });
  const d1 = day([variant("main", [hard, walk])]);

  it("a removal re-reads the fit: the day fits the family once the hard-age stop is gone", () => {
    const before = scheduleDay(d1, FAMILY);
    expect(before.fits).toBe(false);
    const r = removeItem({ input: d1, base: {}, edit: emptyDayEdit() }, FAMILY, "via-ferrata")!;
    expect(r.timeline.fits).toBe(true);
    expect(r.timeline.notes.some((n) => n.kind === "no-fit")).toBe(false);
    expect(r.day.edit.removed).toEqual(["via-ferrata"]);
    expect(removeItem(r.day, FAMILY, "via-ferrata")).toBeNull();
  });

  it("removing a visitor's addition takes it off their list, not the plan's", () => {
    const add = item("cafe", "visit", "Cafe", { durationMin: 30, durationSource: "plan" });
    const r = removeItem({ input: d1, base: { added: [add] }, edit: emptyDayEdit() }, ADULTS, "cafe")!;
    expect(r.day.base.added).toEqual([]);
    expect(r.day.edit.removed).toEqual([]);
    expect(r.timeline).toEqual(scheduleDay(d1, ADULTS));
  });

  it("moveItem returns both days; a stop not on the day is null", () => {
    const d2 = day([variant("main", [item("lake", "visit", "Lake", { durationMin: 60, durationSource: "plan" })])], { day: 2 });
    const from: EditedDay = { input: d1, base: {}, edit: emptyDayEdit() };
    const to: EditedDay = { input: d2, base: {}, edit: emptyDayEdit() };
    const r = moveItem(from, to, ADULTS, "meadow", "end")!;
    expect(ids(r.from.timeline)).toEqual(["via-ferrata"]);
    expect(ids(r.to.timeline)).toEqual(["lake", "meadow"]);
    expect(stopsOf(r.to.day, ADULTS).map((x) => x.item.id)).toEqual(["lake", "meadow"]);
    expect(moveItem(from, to, ADULTS, "nowhere", "end")).toBeNull();
  });

  it("dropDay carries the plan's stops to the end and the visitor's by cheapest insertion; with no target nothing is carried", () => {
    const add = item("cafe", "visit", "Cafe", { durationMin: 30, durationSource: "plan" });
    const d2 = day([variant("main", [item("lake", "visit", "Lake", { durationMin: 60, durationSource: "plan" })])], { day: 2 });
    const r = dropDay({ input: d1, base: { added: [add] }, edit: emptyDayEdit() }, { input: d2, base: {}, edit: emptyDayEdit() }, ADULTS);
    expect(r.carried.map((c) => c.item.id)).toEqual(["via-ferrata", "meadow"]);
    expect(r.to!.day.base.added).toEqual([add]);
    expect(ids(r.to!.timeline).sort()).toEqual(["cafe", "lake", "meadow", "via-ferrata"]);
    expect(dropDay({ input: d1, base: {}, edit: emptyDayEdit() }, null, ADULTS)).toEqual({ to: null, carried: [] });
  });

  it("insertDay before Day 1 takes Day 1's base; it never invents stops", () => {
    const first = ROCKIES[0]!;
    const d = insertDay(null, first, 16);
    expect(d).toMatchObject({ day: 16, kind: "normal", base: first.base, origin: null, nextBase: null });
    expect(d.variants).toHaveLength(1);
    expect(d.variants[0]!.items).toEqual([]);
    expect(() => insertDay(null, null, 1)).toThrow();
  });

  it("a condensed day applies the edits too, and marks a placed addition as the visitor's", () => {
    const c = day([variant("main", [hard, walk])], { blocks: true });
    const add = item("cafe", "visit", "Cafe", { durationMin: 30, durationSource: "plan" });
    const t = scheduleEdited({ input: c, base: {}, edit: { removed: ["via-ferrata"], placed: [{ item: add, addedBy: "visitor", at: "start" }] } }, FAMILY);
    expect(t.blocks).toBe(true);
    expect(ids(t)).toEqual(["cafe", "meadow"]);
    expect(t.entries[0]).toMatchObject({ addedBy: "visitor" });
  });
});
