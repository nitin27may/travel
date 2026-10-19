import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DayVariant, Profile, ScheduleDayInput, ScheduleItem } from "../../src/schedule/types.ts";

const FIX = fileURLToPath(new URL("../fixtures/schedule/", import.meta.url));
export const fixture = <T = ScheduleDayInput>(name: string): T => JSON.parse(readFileSync(`${FIX}${name}`, "utf8")) as T;

export const profile = (over: Partial<Profile> = {}): Profile => ({ party: "adults", youngest: null, pace: "standard", adults: 2, walkKm: null, split: false, ...over });
export const family = (age: number, over: Partial<Profile> = {}): Profile => profile({ party: "family", youngest: age, ...over });

export const item = (id: string, kind: ScheduleItem["kind"], title: string, over: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id, kind, sub: null, title, placeSlug: null, point: null, rule: null, durationMin: null, durationRange: null, durationSource: null, stats: null, start: null, needs: null,
  window: null, checkinMin: null, optional: false, note: null, minAge: null, minAgeRule: null, needsDaylight: false, honesty: [], ...over,
});

export const variant = (key: DayVariant["key"], items: ScheduleItem[], over: Partial<DayVariant> = {}): DayVariant => ({
  key, label: key === "main" ? "The plan's day" : `Version ${key}`, audience: "any", relation: "alternative", items, rank: key === "A" ? 3 : key === "C" ? 1 : 2, ...over,
});

export const day = (variants: DayVariant[], over: Partial<ScheduleDayInput> = {}): ScheduleDayInput => ({
  day: 1, kind: "normal", tz: "America/Edmonton", base: { name: "Base", placeSlug: null, point: null }, nextBase: null, sunPoint: null, sunWindow: null, variants, legs: [],
  start: null, origin: null, homeBy: null, splitNote: null, ...over,
});

export const at = (hhmm: string, confidence: "fixed" | "suggested" = "suggested", source: "plan" | "operator" = "plan") => ({ time: hhmm, confidence, source });
