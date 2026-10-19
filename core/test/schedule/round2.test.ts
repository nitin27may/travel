import { describe, expect, it } from "vitest";
import { toMin } from "../../src/checks/time.ts";
import { resolveLeg } from "../../src/schedule/legs.ts";
import { addItem, scheduleDay } from "../../src/schedule/schedule.ts";
import { at, day, family, fixture, item, profile, variant } from "./helpers.ts";

describe("round two: the review's must-fixes", () => {
  it("measures the day cap on time away from base: a long rest and dinner at the base do not count", () => {
    const d = day([variant("main", [item("a", "visit", "Falls", { durationMin: 120, durationSource: "plan", start: at("09:00") })])]);
    const t = scheduleDay(d, family(6));
    expect(t.span.minutes).toBeGreaterThan(10 * 60);
    expect(t.warnings.find((w) => w.code === "S_DAY_CAP")).toBeUndefined();
    const easy = scheduleDay(fixture("rockies-day5.json"), family(6), { variant: "C" });
    expect(easy.warnings.find((w) => w.code === "S_DAY_CAP")).toBeUndefined();
  });
  it("a place with a coordinate gets a straight-line leg, never a fixed 10 minutes", () => {
    const hub = { lat: 52.87, lon: -118.08 };
    const far = { ids: ["far"], point: { lat: 51.66, lon: -116.47 } };
    const l = resolveLeg({ ids: ["x"], point: null }, far, [], hub);
    expect(l.minutes).toBeGreaterThan(60);
    expect(l.basis).toBe("estimate");
    expect(resolveLeg({ ids: ["x"], point: null }, { ids: ["y"], point: null }, [], hub).minutes).toBe(10);
    expect(resolveLeg({ ids: ["base"], point: hub }, { ids: ["y"], point: null }, [], hub).minutes).toBe(10);
  });
  it("the leg out of a placed stop to a place with no coordinate runs back through the base, not a copy of the leg in", () => {
    const hub = { lat: 52.87, lon: -118.08 };
    const added = { ids: ["add-falls"], point: { lat: 52.66, lon: -117.88 } };
    const stored = [{ from: "base", to: "cruise", mode: "drive" as const, minutes: 60, km: null, basis: "plan" as const, estimate: true, symmetric: true }];
    const into = resolveLeg({ ids: ["base"], point: hub }, added, stored, hub);
    const out = resolveLeg(added, { ids: ["cruise"], point: null }, stored, hub);
    expect(out.minutes).toBe(Math.round((resolveLeg(added, { ids: ["base"], point: hub }, [], hub).minutes + 60) / 5) * 5);
    expect(out.minutes).toBeGreaterThan(into.minutes + 50);
    expect(out.basis).toBe("estimate");
  });
  it("adding a coffee or a rest draws no drive; a placed stop is reached by a straight-line estimate", () => {
    const base = fixture("rockies-day5.json");
    const before = scheduleDay(base, family(6));
    const coffee = addItem(base, family(6), {}, item("add-coffee-break", "break", "Coffee and a snack", { sub: "coffee", durationMin: 20, durationSource: "data" })).timeline;
    expect(coffee.entries.filter((e) => e.kind === "leg").length).toBe(before.entries.filter((e) => e.kind === "leg").length);
    const lake = item("add-lake", "visit", "A lake", { sub: "lake", point: { lat: 52.9, lon: -118.0 }, durationMin: 45, durationSource: "data" });
    const withLake = addItem({ ...base, base: { ...base.base!, point: { lat: 52.8737, lon: -118.0814 } } }, family(6), {}, lake).timeline;
    const into = withLake.entries.find((e) => e.kind === "leg" && e.to?.name === "A lake")!;
    expect(into.leg).toMatchObject({ basis: "estimate" });
    expect(into.leg!.km).not.toBeNull();
    expect(into.durationMin).not.toBe(10);
  });
  it("shows every generated start on a 5 minute mark and every generated duration in 5 minutes", () => {
    for (const p of [family(6), family(8, { pace: "relaxed" }), profile({ pace: "full" })]) {
      for (const split of [false, true]) {
        const t = scheduleDay(fixture("rockies-day5.json"), { ...p, split });
        for (const e of t.entries.filter((x) => !x.time.pinned && x.kind !== "leg" && x.kind !== "sun" && x.addedBy !== "author")) {
          expect(toMin(e.start)! % 5, `${e.title} ${e.start}`).toBe(0);
          if (e.kind !== "end") expect(e.durationMin % 5, `${e.title} ${e.durationMin}`).toBe(0);
        }
      }
    }
  });
  it("draws the on-trail lunch inside the trail, before the drive back", () => {
    const t = scheduleDay(fixture("rockies-day5.json"), profile());
    const i = t.entries.findIndex((e) => e.style === "on-trail");
    const trail = t.entries.findIndex((e) => e.id === "bald-hills");
    const back = t.entries.findIndex((e) => e.kind === "leg" && e.title.startsWith("Back to"));
    expect(trail).toBeGreaterThanOrEqual(0);
    if (i >= 0) {
      expect(i).toBeGreaterThan(trail);
      expect(i).toBeLessThan(back);
    }
  });
  it("lets go of a plan time the day cannot reach and says so once, instead of overlapping times", () => {
    const d = day([variant("main", [
      item("long", "trail", "Long loop", { durationMin: 270, durationSource: "plan", start: at("11:30"), stats: { distanceKm: 10, gainM: 450 } }),
      item("view", "visit", "Viewpoint", { durationMin: 60, durationSource: "plan", start: at("16:30") }),
    ])]);
    const t = scheduleDay(d, family(4));
    const long = t.entries.find((e) => e.id === "long")!;
    const view = t.entries.find((e) => e.id === "view")!;
    expect(toMin(view.start)!).toBeGreaterThanOrEqual(toMin(long.end)!);
    expect(t.warnings.filter((w) => w.code === "W_OVERLAP")).toEqual([]);
    expect(t.warnings.filter((w) => w.code === "S_FIXED_MISSED")).toHaveLength(1);
    expect(view.time.pinned).toBe(false);
    // an operator's slot is never let go
    const slot = day([variant("main", [item("long", "trail", "Long loop", { durationMin: 270, durationSource: "plan", start: at("11:30") }), item("view", "visit", "Tour", { durationMin: 60, durationSource: "operator", start: at("14:30", "fixed", "operator") })])]);
    expect(scheduleDay(slot, profile()).entries.find((e) => e.id === "view")!.start).toBe("14:30");
  });
  it("a condensed plan has parts of the day, a real flight or transfer, and no invented legs, meals or rests", () => {
    const d = day([variant("main", [
      item("fly", "transfer", "Fly to Ushuaia", { sub: "flight", durationMin: 210, durationSource: "plan" }),
      item("walk", "visit", "Harbour walk", { sub: "town", durationMin: 60, durationSource: "plan" }),
      item("eat", "meal", "Evening parrilla", { sub: "dinner", durationMin: 90, durationSource: "plan", start: at("20:00") }),
    ])], { blocks: true });
    const t = scheduleDay(d, profile());
    expect(t.blocks).toBe(true);
    expect(t.entries.map((e) => [e.kind, e.block])).toEqual([["leg", "Morning"], ["visit", "Afternoon"], ["meal", "Afternoon"]]);
    expect(t.entries[0]).toMatchObject({ title: "Fly to Ushuaia", durationMin: 210 });
    expect(t.entries[0]!.leg).toMatchObject({ mode: "flight" });
    expect(t.entries.some((e) => e.kind === "rest" || e.kind === "break" || (e.kind === "leg" && e.sub === "drive"))).toBe(false);
    expect(t.warnings.filter((w) => w.code === "S_DAY_CAP" || w.code === "W_OVERLAP")).toEqual([]);
  });
});
