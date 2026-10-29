// A stop moved to another day gets a real drive estimate (STEP2-C2 known gap, build-plan C2). The Rockies records carry no point in the
// published days (their legs are the plan's), so a stop moved to a day at another base used to take the ladder's 10 minute local move
// from that base. Now: point to point from the place page's map point (`placePoint`), else the stored way from its own base plus the
// drive between the two bases, else a conservative guess, always marked ≈. The published days and a stop moved back are unchanged.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOVED_STOP_LEGS } from "../../src/config/schedule.ts";
import { estimateLeg, resolveLeg } from "../../src/schedule/legs.ts";
import { scheduleTrip } from "../../src/schedule/schedule.ts";
import { emptyDayEdit, emptyTemplateDelta, moveItem, scheduleTemplate, stopsOf, type EditedDay } from "../../src/schedule/template.ts";
import type { DayTimeline, Profile, ScheduleDayInput, TemplateDelta, TimelineEntry } from "../../src/schedule/types.ts";
import { day, family, item, profile, variant } from "./helpers.ts";

const load = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as ScheduleDayInput[];
const ROCKIES = load("rockies-trip");
const DOLOMITES = load("dolomites-trip");
const FAMILY = family(10);
const ADULTS = profile();
const delta = (over: Partial<TemplateDelta>): TemplateDelta => ({ ...emptyTemplateDelta(), ...over });
const legTo = (t: DayTimeline, title: string): TimelineEntry | undefined => t.entries.find((e) => e.kind === "leg" && e.to?.name === title && !/^Drive on to/.test(e.title));
const moved = (days: ScheduleDayInput[], p: Profile, item: string, from: number, to: number, after?: string, overrides: Record<string, string> = {}): DayTimeline =>
  scheduleTemplate(days, delta({ overrides, moved: [{ op: "m1", day: from, item, toDay: to, ...(after ? { after } : {}) }] }), p).days.find((d) => d.ref === to)!.timeline;
/** The days with one stop's map point taken away: the rungs below point to point, on a real stop (DG2F gave the cruises and canoes theirs). */
const withoutPoint = (days: ScheduleDayInput[], id: string): ScheduleDayInput[] =>
  days.map((d) => ({ ...d, variants: d.variants.map((v) => ({ ...v, items: v.items.map((i) => (i.id === id ? { ...i, placePoint: null } : i)) })) }));
const NO_CANOE = withoutPoint(ROCKIES, "moraine-lake-canoe");
const sane = (t: DayTimeline): void => {
  for (const e of t.entries) {
    expect(Number.isFinite(e.durationMin), `${e.id} minutes`).toBe(true);
    expect(e.start, `${e.id} start`).toMatch(/^\d\d:\d\d$/);
  }
  expect(Number.isFinite(t.totals.driveMin) && Number.isFinite(t.totals.activeMin)).toBe(true);
};

describe("the page model carries the map points for edits only", () => {
  it("Rockies stops with a place page have a placePoint and no point: the published days read the plan's legs", () => {
    const items = ROCKIES.flatMap((d) => d.variants.flatMap((v) => v.items));
    expect(items.filter((i) => i.placePoint).length).toBeGreaterThan(50);
    expect(items.every((i) => i.point === null)).toBe(true);
  });
});

describe("a Rockies stop moved to a day at another base", () => {
  it("Moraine Lake (Lake Louise) to the start of a Kananaskis day: point to point, about two hours, never the 10 minute local move", () => {
    const t = moved(ROCKIES, FAMILY, "moraine-lake", 11, 13);
    sane(t);
    const leg = t.entries.find((e) => e.kind === "leg" && e.to?.placeSlug === "moraine-lake")!;
    expect(leg.leg).toMatchObject({ mode: "drive", basis: "estimate" });
    expect(leg.honesty).toContain("drive_estimated");
    expect(leg.durationMin).toBeGreaterThanOrEqual(90);
    expect(leg.durationMin).toBeLessThanOrEqual(150);
    // the way on to the day's next stop (both halves of a drive with a stretch break) is estimated too, not 10 minutes
    const on = t.entries.filter((e) => e.kind === "leg" && e.from?.placeSlug === "moraine-lake" && e.leg?.mode === "drive");
    expect(on.reduce((n, e) => n + e.durationMin, 0)).toBeGreaterThan(60);
    expect(on.every((e) => e.honesty.includes("drive_estimated"))).toBe(true);
  });

  it("a stop with no place page takes its own capture record's point (the Moraine canoe's OSM node, DG2F): point to point, ≈", () => {
    const canoe = ROCKIES[10]!.variants.flatMap((v) => v.items).find((i) => i.id === "moraine-lake-canoe")!;
    expect(canoe.placeSlug).toBeNull();
    expect(canoe.placePoint).toBeTruthy();
    const t = moved(ROCKIES, FAMILY, "moraine-lake-canoe", 11, 13, "kananaskis-lakes-day-use");
    sane(t);
    const leg = legTo(t, "Moraine Lake canoe")!;
    expect(leg.leg?.basis).toBe("estimate");
    expect(leg.honesty).toContain("drive_estimated");
    expect(leg.durationMin).toBeGreaterThanOrEqual(60);
  });

  it("a stop with no point takes the stored way from its own base plus the drive between the bases", () => {
    const t = moved(NO_CANOE, FAMILY, "moraine-lake-canoe", 11, 13, "kananaskis-lakes-day-use");
    sane(t);
    const leg = legTo(t, "Moraine Lake canoe")!;
    const between = estimateLeg(ROCKIES[12]!.base!.point!, ROCKIES[10]!.base!.point!).minutes;
    expect(leg.leg?.basis).toBe("estimate");
    expect(leg.honesty).toContain("drive_estimated");
    // through the base: the base leg (between + 30 stored) plus the 40 stored minutes from the base to the lakes
    expect(leg.durationMin).toBeGreaterThanOrEqual(between + 30);
    const back = t.entries.find((e) => e.kind === "leg" && e.from?.name === "Moraine Lake canoe")!;
    expect(back.durationMin, "the base leg is the same both ways").toBe(Math.max(5, Math.round((between + 30) / 5) * 5));
  });

  it("a stop with no point and no stored way is near its own base: the drive between the bases plus the configured guess", () => {
    const stop = stopsOf({ input: ROCKIES[1]!, base: { variant: "B" }, edit: emptyDayEdit() }, ADULTS).find((s) => s.item.id === "lake-minnewanka-cruise");
    expect(stop).toBeTruthy();
    const bare = withoutPoint(ROCKIES, "lake-minnewanka-cruise");
    const from = bare[1]!;
    const lone = { ...from, legs: from.legs.filter((l) => l.from !== "lake-minnewanka-cruise" && l.to !== "lake-minnewanka-cruise") };
    const days = bare.map((d) => (d.day === 2 ? lone : d));
    const t = moved(days, ADULTS, "lake-minnewanka-cruise", 2, 5, undefined, { "2": "B" });
    sane(t);
    const between = estimateLeg(ROCKIES[4]!.base!.point!, ROCKIES[1]!.base!.point!).minutes;
    // placed at the start of the day: the first leg is the one from the base
    const out = t.entries.find((e) => e.kind === "leg")!;
    expect(out.to?.name).toBe(stop!.item.title);
    expect(out.durationMin + t.entries.filter((e) => e.kind === "leg" && e.title.startsWith("Drive on to") && e.to?.name === stop!.item.title).reduce((n, e) => n + e.durationMin, 0))
      .toBe(Math.round((between + MOVED_STOP_LEGS.nearOwnBaseMin) / 5) * 5);
    expect(out.leg?.basis).toBe("estimate");
  });

  it("with no base points it is the conservative guess, still ≈", () => {
    const a = item("a", "visit", "Somewhere", { durationMin: 60 });
    const b = item("b", "visit", "Here", { durationMin: 60 });
    const d1 = day([variant("main", [a])], { day: 1, base: { name: "North", placeSlug: null, point: null } });
    const d2 = day([variant("main", [b])], { day: 2, base: { name: "South", placeSlug: null, point: null }, legs: [{ from: "base", to: "b", mode: "drive", minutes: 20, km: null, basis: "plan", estimate: true }] });
    const r = moveItem({ input: d1, base: {}, edit: emptyDayEdit() }, { input: d2, base: {}, edit: emptyDayEdit() }, ADULTS, "a", { after: "b" })!;
    sane(r.to.timeline);
    const out = r.to.timeline.entries.find((e) => e.kind === "leg" && e.to?.name === "Somewhere")!;
    expect(out.durationMin).toBe(20 + MOVED_STOP_LEGS.unknownMin);
    expect(out.honesty).toContain("drive_estimated");
    expect(r.to.timeline.entries.find((e) => e.kind === "leg" && e.from?.name === "Somewhere")!.durationMin).toBe(MOVED_STOP_LEGS.unknownMin);
  });

  it("never reads the start of an arrival day (the origin): a way only through it does not count", () => {
    const a = item("a", "visit", "Far", { durationMin: 30 });
    const north = { lat: 51.18, lon: -115.57 };
    const south = { lat: 50.92, lon: -115.15 };
    const d1 = day([variant("main", [a])], {
      day: 1, kind: "arrival", base: { name: "North", placeSlug: null, point: north }, origin: { name: "Airport", placeSlug: null, point: { lat: 51.13, lon: -114.01 } },
      legs: [{ from: "origin", to: "a", mode: "drive", minutes: 5, km: 3, basis: "plan", estimate: true }],
    });
    const d2 = day([variant("main", [])], { day: 2, base: { name: "South", placeSlug: null, point: south } });
    const r = moveItem({ input: d1, base: {}, edit: emptyDayEdit() }, { input: d2, base: {}, edit: emptyDayEdit() }, ADULTS, "a", "start")!;
    const added = r.to.day.input.legs;
    expect(added.every((l) => l.from !== "origin" && l.to !== "origin")).toBe(true);
    expect(added.find((l) => l.to === "a")!.minutes).toBe(Math.round((estimateLeg(south, north).minutes + MOVED_STOP_LEGS.nearOwnBaseMin) / 5) * 5);
  });
});

describe("a stop with no point moved to a day at the same base (DG2F)", () => {
  // Emerald Lakeshore, Day 9 to Day 12 (both leave Lake Louise), with its map point taken away: it used to take the ladder's 10 minute
  // local move each way. Now it is as far from the base as on its own day: Day 9 stores the Emerald Lake canoe to the base 35 (routed,
  // S2D-LEG) and the canoe to the lakeshore 0, shorter than base to Natural Bridge 45 and on to the lakeshore 5.
  const bare = withoutPoint(ROCKIES, "emerald-lakeshore");
  it("takes the shortest stored way from the base on its own day, marked ≈, and the way on to the next stop goes through the base", () => {
    const t = moved(bare, FAMILY, "emerald-lakeshore", 9, 12, undefined, { "9": "B" });
    sane(t);
    const inn = t.entries.find((e) => e.kind === "leg" && e.to?.name === "Emerald Lakeshore")!;
    expect(inn.durationMin).toBe(35);
    expect(inn.leg?.basis).toBe("estimate");
    expect(inn.honesty).toContain("drive_estimated");
    // on to the groceries in Canmore: back through the base (35) plus the plan's 60 from the base, never 10 minutes
    const on = t.entries.find((e) => e.kind === "leg" && e.from?.name === "Emerald Lakeshore" && e.to?.name === "Groceries in Canmore")!;
    expect(on.durationMin).toBe(95);
    expect(on.honesty).toContain("drive_estimated");
  });
  it("with its point, a stop with no point on the new day reaches it through the base over the day's stored ways, never a straight 50 min", () => {
    // Day 12 stores base 60 groceries 10 Grassi 10 Nordic Centre: the Nordic Centre is 80 min from Lake Louise, Emerald Lakeshore the estimate
    const pt = ROCKIES[8]!.variants.flatMap((v) => v.items).find((i) => i.id === "emerald-lakeshore")!.placePoint!;
    const s = scheduleTemplate(ROCKIES, delta({ overrides: { "9": "B" }, moved: [{ op: "m", day: 9, item: "emerald-lakeshore", toDay: 12, after: "canmore-nordic-centre" }] }), FAMILY);
    const d = s.days.find((x) => x.ref === 12)!;
    sane(d.timeline);
    const via = d.input.legs.find((l) => l.from === "emerald-lakeshore" && l.to === "canmore-nordic-centre")!;
    const base = Math.round(estimateLeg(ROCKIES[11]!.base!.point!, pt).minutes / 5) * 5;
    expect(via).toMatchObject({ basis: "estimate", estimate: true, minutes: base + 80 });
  });
  it("with no stored way on its own day it is the configured near-base guess, never the 10 minute local move", () => {
    const a = item("a", "visit", "Lakeshore", { durationMin: 60 });
    const b = item("b", "visit", "Falls", { durationMin: 60 });
    const lake = { name: "Lake", placeSlug: null, point: { lat: 51.42, lon: -116.18 } };
    const d1 = day([variant("main", [a])], { day: 1, base: lake });
    const d2 = day([variant("main", [b])], { day: 2, base: lake, legs: [{ from: "base", to: "b", mode: "drive", minutes: 20, km: null, basis: "plan", estimate: true }] });
    const r = moveItem({ input: d1, base: {}, edit: emptyDayEdit() }, { input: d2, base: {}, edit: emptyDayEdit() }, ADULTS, "a", "start")!;
    sane(r.to.timeline);
    const inn = r.to.timeline.entries.find((e) => e.kind === "leg" && e.to?.name === "Lakeshore")!;
    expect(inn.durationMin).toBe(MOVED_STOP_LEGS.nearOwnBaseMin);
    expect(inn.honesty).toContain("drive_estimated");
    expect(r.to.day.input.legs.find((l) => l.from === "a" && l.to === "b")!.minutes).toBe(MOVED_STOP_LEGS.nearOwnBaseMin + 20);
  });
  it("a stored base leg the stop brings from its own day still wins (the plan's road time from the same base)", () => {
    const a = item("a", "visit", "Lakeshore", { durationMin: 60 });
    const lake = { name: "Lake", placeSlug: null, point: { lat: 51.42, lon: -116.18 } };
    const d1 = day([variant("main", [a])], { day: 1, base: lake, legs: [{ from: "base", to: "a", mode: "shuttle", minutes: 25, km: null, basis: "plan", estimate: true }] });
    const d2 = day([variant("main", [])], { day: 2, base: lake });
    const r = moveItem({ input: d1, base: {}, edit: emptyDayEdit() }, { input: d2, base: {}, edit: emptyDayEdit() }, ADULTS, "a", "start")!;
    expect(r.to.day.input.legs.filter((l) => l.basis === "estimate")).toEqual([]);
    expect(r.to.timeline.entries.find((e) => e.kind === "leg" && e.to?.name === "Lakeshore")!.durationMin).toBe(25);
  });
});

describe("legs are symmetric where they should be", () => {
  it("the straight-line estimate is the same both ways", () => {
    const pts = ROCKIES.flatMap((d) => d.variants.flatMap((v) => v.items.flatMap((i) => (i.placePoint ? [i.placePoint] : [])))).slice(0, 25);
    for (const a of pts) for (const b of pts) expect(estimateLeg(a, b).minutes).toBe(estimateLeg(b, a).minutes);
  });
  it("an estimated base leg of a moved stop resolves the same both ways", () => {
    const from: EditedDay = { input: NO_CANOE[10]!, base: {}, edit: emptyDayEdit() };
    const to: EditedDay = { input: NO_CANOE[12]!, base: {}, edit: emptyDayEdit() };
    const r = moveItem(from, to, FAMILY, "moraine-lake-canoe", "start")!;
    const legs = r.to.day.input.legs.filter((l) => l.basis === "estimate");
    expect(legs.length).toBeGreaterThan(0);
    for (const l of legs) {
      const a = { ids: [l.from], point: null };
      const b = { ids: [l.to], point: null };
      expect(resolveLeg(a, b, legs).minutes).toBe(resolveLeg(b, a, legs).minutes);
      expect(l.minutes % 5).toBe(0);
    }
  });
});

describe("moving a stop and moving it back restores the published days exactly", () => {
  const cases: [string, ScheduleDayInput[], Profile][] = [["Rockies", ROCKIES, FAMILY], ["Rockies adults", ROCKIES, ADULTS], ["Dolomites", DOLOMITES, ADULTS]];
  for (const [name, days, p] of cases) {
    it(name, () => {
      const published = scheduleTrip(days, p);
      let n = 0;
      days.forEach((d, i) => {
        const stops = stopsOf({ input: d, base: {}, edit: emptyDayEdit() }, p).filter((s) => s.lane === "main");
        stops.forEach((s, k) => {
          // three target days spread over the trip: the next one, one far ahead and one behind
          for (const j of [...new Set([(i + 1) % days.length, (i + 7) % days.length, (i + days.length - 4) % days.length])]) {
            if (j === i) continue;
            const prev = stops[k - 1]?.item.id;
            const there = scheduleTemplate(days, delta({ moved: [{ op: "a", day: d.day, item: s.item.id, toDay: days[j]!.day }] }), p);
            for (const t of there.days) sane(t.timeline);
            const back = scheduleTemplate(days, delta({
              moved: [
                { op: "a", day: d.day, item: s.item.id, toDay: days[j]!.day },
                { op: "b", day: days[j]!.day, item: s.item.id, toDay: d.day, ...(prev ? { after: prev } : {}) },
              ],
            }), p);
            expect(back.skipped, `${s.item.id} ${d.day} -> ${days[j]!.day} and back`).toEqual([]);
            expect(back.days.map((x) => x.timeline), `${s.item.id} ${d.day} -> ${days[j]!.day} and back`).toEqual(published);
            n += 1;
          }
        });
      });
      expect(n).toBeGreaterThan(20);
    }, 120000);
  }
});
