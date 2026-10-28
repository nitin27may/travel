// Generated rows a person removes (STEP2-E1B): the rule key of each row, hiding it through the template delta, the re-flow, and three
// properties over every generated row of the Rockies and the Dolomites: removing one changes only its day and takes the row away;
// removing then putting it back is byte for byte the public page; scheduling the same delta twice gives the same days.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isRuleItem, ruleItemOf, ruleKeyOf, rowsOfKeys } from "../../src/schedule/ruleRows.ts";
import { scheduleTrip } from "../../src/schedule/schedule.ts";
import { emptyDayEdit, emptyTemplateDelta, removeItem, scheduleTemplate, type EditedDay } from "../../src/schedule/template.ts";
import type { DayTimeline, Profile, ScheduleDayInput, TemplateDelta, TimelineEntry } from "../../src/schedule/types.ts";
import { family, profile } from "./helpers.ts";

const load = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as ScheduleDayInput[];
const ROCKIES = load("rockies-trip");
const DOLOMITES = load("dolomites-trip");
const FAMILY = family(6);

const removed = (day: number, ...items: string[]): TemplateDelta => ({ ...emptyTemplateDelta(), removed: items.map((item, i) => ({ op: `o-r${i}`, day, item })) });
const dayOf = (days: ScheduleDayInput[], delta: TemplateDelta, p: Profile, n: number): DayTimeline => scheduleTemplate(days, delta, p).days.find((d) => d.ref === n)!.timeline;
const byId = (t: DayTimeline, id: string): TimelineEntry | undefined => t.entries.find((e) => e.id === id);

describe("the rule key of a row", () => {
  const d1 = scheduleTrip(ROCKIES, FAMILY)[0]!;
  it("names each generated row of the Rockies arrival day; stops, legs and the sun have none", () => {
    const keys = Object.fromEntries(d1.entries.map((e) => [e.id, ruleKeyOf(e)]));
    expect(keys).toMatchObject({
      "1-all-start-land-start": "all-start",
      "1-all-visit-car-hire-start": "all-car-hire",
      "1-all-checkin-stay-bear-spray-groceries": "all-checkin",
      "1-all-meal-lunch": "all-meal-lunch",
      "1-all-rest-at-base-dinner": "all-rest-at-base-dinner",
      "1-all-meal-dinner": "all-meal-dinner",
      "1-all-end-at-base-close": "all-end",
      "fenland-loop": null,
      "1-all-leg-drive-fenland-loop": null,
    });
    for (const e of d1.entries.filter((x) => x.kind === "sun" || x.kind === "leg" || x.sourceItemId)) expect(ruleKeyOf(e), e.id).toBeNull();
  });
  it("is a schedule id the plan document takes, with `rule:` before it", () => {
    expect(ruleItemOf("all-car-hire")).toBe("rule:all-car-hire");
    expect(isRuleItem("rule:all-car-hire")).toBe(true);
    expect(isRuleItem("fenland-loop")).toBe(false);
  });
  it("the end of the day takes the drive to it after the last stop, never a drive between stops", () => {
    const rows = rowsOfKeys(d1.entries, ["all-end"]).map((e) => e.id);
    expect(rows).toEqual(["1-all-leg-drive-close", "1-all-end-at-base-close"]);
  });
});

describe("removing a generated row (Rockies Day 1, a family)", () => {
  const pub = scheduleTrip(ROCKIES, FAMILY);
  it("removing the hire car takes its hour away: the drive to Banff stays and starts at landing", () => {
    const d = dayOf(ROCKIES, removed(1, "rule:all-car-hire"), FAMILY, 1);
    expect(byId(d, "1-all-visit-car-hire-start")).toBeUndefined();
    const drive = byId(d, "1-all-leg-drive-bear-spray-groceries")!;
    expect(drive.start).toBe("10:00");
    expect(byId(pub[0]!, "1-all-leg-drive-bear-spray-groceries")!.start).toBe("11:00");
  });
  it("removing lunch re-flows the stops after it earlier", () => {
    const d = dayOf(ROCKIES, removed(1, "rule:all-meal-lunch"), FAMILY, 1);
    expect(d.entries.some((e) => e.kind === "meal" && e.sub === "lunch")).toBe(false);
    expect(byId(d, "bear-spray-groceries")!.start < byId(pub[0]!, "bear-spray-groceries")!.start).toBe(true);
  });
  it("removing check-in keeps the drive to the stay; removing the end takes the drive back with it", () => {
    const c = dayOf(ROCKIES, removed(1, "rule:all-checkin"), FAMILY, 1);
    expect(c.entries.some((e) => e.kind === "checkin")).toBe(false);
    expect(byId(c, "1-all-leg-drive-bear-spray-groceries")?.title).toBe("Drive to Banff");
    const e = dayOf(ROCKIES, removed(1, "rule:all-end"), FAMILY, 1);
    expect(e.entries.some((x) => x.kind === "end")).toBe(false);
    expect(byId(e, "1-all-leg-drive-close")).toBeUndefined();
    expect(byId(e, "1-all-leg-drive-dinner")).toBeDefined();
  });
  it("a rest keeps its time: the row goes, dinner stays in its window", () => {
    const d = dayOf(ROCKIES, removed(1, "rule:all-rest-at-base-dinner"), FAMILY, 1);
    expect(byId(d, "1-all-rest-at-base-dinner")).toBeUndefined();
    expect(byId(d, "1-all-meal-dinner")!.start).toBe(byId(pub[0]!, "1-all-meal-dinner")!.start);
  });
  it("every row of a day can go, one after another: the day ends with a zero span, not an infinite one", () => {
    // a removal can bring a new rule row (a rest before the end once the stops are gone): the person removes that one too
    const items = pub[0]!.entries.filter((e) => e.sourceItemId && e.kind !== "sun").map((e) => e.id);
    let d = pub[0]!;
    for (let round = 0; round < 6; round++) {
      items.push(...d.entries.map(ruleKeyOf).filter((k): k is string => k !== null).map(ruleItemOf).filter((k) => !items.includes(k)));
      d = dayOf(ROCKIES, removed(1, ...items), FAMILY, 1);
    }
    expect(d.entries.filter((e) => e.kind !== "sun")).toEqual([]);
    expect(d.span.minutes).toBe(0);
  });
  it("removeItem on one day: null for a key the day does not hold", () => {
    const day: EditedDay = { input: ROCKIES[0]!, base: {}, edit: emptyDayEdit() };
    expect(removeItem(day, FAMILY, "rule:all-checkout")).toBeNull();
    const r = removeItem(day, FAMILY, "rule:all-car-hire")!;
    expect(r.day.edit.hidden).toEqual(["all-car-hire"]);
    expect(r.timeline.entries.some((e) => e.sub === "car-hire")).toBe(false);
    // once hidden it is no longer on the day
    expect(removeItem(r.day, FAMILY, "rule:all-car-hire")).toBeNull();
  });
});

describe("the rule row stays removed when the day re-flows", () => {
  it("removing a stop of the same day afterwards keeps lunch away", () => {
    const delta: TemplateDelta = { ...emptyTemplateDelta(), removed: [{ op: "o-1", day: 1, item: "rule:all-meal-lunch" }, { op: "o-2", day: 1, item: "fenland-loop" }] };
    const d = dayOf(ROCKIES, delta, FAMILY, 1);
    expect(d.entries.some((e) => e.kind === "meal" && e.sub === "lunch")).toBe(false);
    expect(d.entries.some((e) => e.id === "fenland-loop")).toBe(false);
  });
  it("a row that precedes a stop moved in later is still hidden (removals apply before moves)", () => {
    const pub = scheduleTrip(ROCKIES, FAMILY);
    const moveIn = { op: "o-m", day: 5, item: "maligne-lake-cruise", toDay: 6 } as const;
    const moved = scheduleTemplate(ROCKIES, { ...emptyTemplateDelta(), moved: [moveIn] }, FAMILY).days.find((d) => d.ref === 6)!.timeline;
    const slot = moved.entries.find((e) => e.bookingOf === "maligne-lake-cruise")!;
    const key = ruleKeyOf(slot)!;
    expect(pub[5]!.entries.some((e) => ruleKeyOf(e) === key)).toBe(false);
    const both = scheduleTemplate(ROCKIES, { ...emptyTemplateDelta(), removed: [{ op: "o-r", day: 6, item: ruleItemOf(key) }], moved: [moveIn] }, FAMILY);
    const d6 = both.days.find((d) => d.ref === 6)!.timeline;
    expect(d6.entries.some((e) => e.bookingOf === "maligne-lake-cruise")).toBe(false);
    expect(d6.entries.some((e) => e.id === "maligne-lake-cruise")).toBe(true);
    expect(both.skipped).toEqual([]);
  });
});

describe("properties over every generated row (Rockies family, Rockies split, Dolomites adults)", () => {
  for (const [name, days, p] of [["Rockies, family", ROCKIES, FAMILY], ["Rockies, split", ROCKIES, family(8, { split: true })], ["Dolomites, adults", DOLOMITES, profile()]] as const) {
    it(name, () => {
      const pub = scheduleTrip(days, p);
      const bytes = JSON.stringify(scheduleTemplate(days, emptyTemplateDelta(), p).days.map((d) => d.timeline));
      expect(bytes).toBe(JSON.stringify(pub));
      let tried = 0;
      for (const t of pub) {
        const keys = [...new Set(t.entries.map(ruleKeyOf).filter((k): k is string => k !== null))];
        for (const key of keys) {
          tried += 1;
          const delta = removed(t.day, ruleItemOf(key));
          const s = scheduleTemplate(days, delta, p);
          // the row is gone from its day, every other day is the public page's, the change is counted on its day only
          for (const d of s.days) {
            if (d.ref === t.day) {
              expect(d.timeline.entries.some((e) => ruleKeyOf(e) === key), `${name} day ${t.day} ${key}`).toBe(false);
              expect(d.changed).toBe(true);
            } else expect(d.timeline).toEqual(pub[(d.ref as number) - 1]);
          }
          // re-flow is stable: the same delta schedules the same days
          expect(JSON.stringify(scheduleTemplate(days, delta, p))).toBe(JSON.stringify(s));
          // putting it back (the delta without the entry) is byte for byte the public page
          const back = scheduleTemplate(days, { ...delta, removed: [] }, p);
          expect(JSON.stringify(back.days.map((d) => d.timeline))).toBe(bytes);
        }
      }
      expect(tried).toBeGreaterThan(20);
    });
  }
});
