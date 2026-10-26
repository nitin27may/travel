import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TAB_STATE, TRIP_TABS, parseTripView, resolveTripTab, showTabBar, tabOfFragment, tripTabsFor, tripViewValue, withTripView, type TripTab,
} from "../../src/trips/tabs.ts";
import { CATEGORIES } from "../../src/export/publicTypes.ts";
import { PROFILE_KEYS } from "../../src/schedule/profileCodec.ts";

const ALL: TripTab[] = [...TRIP_TABS];

describe("trip tabs: the `view` key (spec 3.4, D3)", () => {
  it("maps every view value, with `category` kept as the Stops alias of old links", () => {
    expect(parseTripView(null)).toBeNull();
    expect(parseTripView("")).toBeNull();
    expect(parseTripView("summary")).toEqual(DEFAULT_TAB_STATE);
    expect(parseTripView("day")).toEqual({ tab: "days", daysView: "list" });
    expect(parseTripView("table")).toEqual({ tab: "days", daysView: "table" });
    expect(parseTripView("all")).toEqual({ tab: "stops", daysView: "list" });
    expect(parseTripView("category")).toEqual({ tab: "stops", daysView: "list" });
    expect(parseTripView("bookings")?.tab).toBe("bookings");
    expect(parseTripView("photos")?.tab).toBe("photos");
  });
  it("falls back on unknown values, never throws (prototype keys included)", () => {
    for (const v of ["map", "DAY", "toString", "__proto__", "constructor", "day "]) expect(parseTripView(v), v).toBeNull();
  });
  it("writes the canonical value, and nothing for the Summary", () => {
    expect(tripViewValue(DEFAULT_TAB_STATE)).toBeNull();
    expect(tripViewValue({ tab: "days", daysView: "list" })).toBe("day");
    expect(tripViewValue({ tab: "days", daysView: "table" })).toBe("table");
    expect(tripViewValue({ tab: "stops", daysView: "list" })).toBe("all");
    expect(tripViewValue({ tab: "bookings", daysView: "list" })).toBe("bookings");
    expect(tripViewValue({ tab: "photos", daysView: "table" })).toBe("photos");
    for (const t of ALL) for (const dv of ["list", "table"] as const) {
      const s = { tab: t, daysView: t === "days" ? dv : "list" } as const;
      expect(parseTripView(tripViewValue(s)) ?? DEFAULT_TAB_STATE).toEqual(s);
    }
  });
  it("is not a profile codec key, so the codec's links are untouched", () => {
    expect((PROFILE_KEYS as readonly string[]).includes("view")).toBe(false);
  });
  it("keeps the fragment list equal to the six categories", () => {
    for (const c of CATEGORIES) expect(tabOfFragment(`#${c}`)).toBe("stops");
    expect(tabOfFragment("#day-11")).toBe("days");
    expect(tabOfFragment("day-3")).toBe("days");
    expect(tabOfFragment("#photos")).toBeNull();
    expect(tabOfFragment("")).toBeNull();
  });
  it("edits only `view` in a query and keeps the codec's commas", () => {
    expect(withTripView("p=family-6&d=5C,9A", { tab: "days", daysView: "list" })).toBe("p=family-6&d=5C,9A&view=day");
    expect(withTripView("?view=category&pace=full&utm=x", { tab: "stops", daysView: "list" })).toBe("pace=full&utm=x&view=all");
    expect(withTripView("view=day&p=adults", DEFAULT_TAB_STATE)).toBe("p=adults");
    expect(withTripView("", DEFAULT_TAB_STATE)).toBe("");
  });
});

describe("tabs by trip state (W1) and the landing precedence (3.4)", () => {
  it("draws a tab only when it has content; a Summary alone has no tab bar", () => {
    expect(tripTabsFor({ days: 15, stops: 90, bookings: 7, photos: 41 })).toEqual(ALL);
    expect(tripTabsFor({ days: 3, stops: 9, bookings: 0, photos: 0 })).toEqual(["summary", "days", "stops"]);
    expect(tripTabsFor({ days: 0, stops: 0, bookings: 0, photos: 17 })).toEqual(["summary", "photos"]);
    const none = tripTabsFor({ days: 0, stops: 0, bookings: 0, photos: 0 });
    expect(none).toEqual(["summary"]);
    expect(showTabBar(none)).toBe(false);
    expect(showTabBar(["summary", "photos"])).toBe(true);
  });
  it("URL first, then the fragment, then this device, then Summary", () => {
    const base = { view: null, hash: "", remembered: null, available: ALL };
    expect(resolveTripTab(base)).toEqual({ ...DEFAULT_TAB_STATE, from: "default" });
    expect(resolveTripTab({ ...base, remembered: "bookings" })).toEqual({ tab: "bookings", daysView: "list", from: "device" });
    expect(resolveTripTab({ ...base, remembered: "days", rememberedDaysView: "table" })).toEqual({ tab: "days", daysView: "table", from: "device" });
    expect(resolveTripTab({ ...base, hash: "#day-4", remembered: "photos" })).toEqual({ tab: "days", daysView: "list", from: "hash" });
    expect(resolveTripTab({ ...base, view: "photos", hash: "#day-4", remembered: "bookings" })).toEqual({ tab: "photos", daysView: "list", from: "url" });
    // an old By category link and its fragment still land on the same list
    expect(resolveTripTab({ ...base, view: "category", hash: "#trails" }).tab).toBe("stops");
  });
  it("never opens a tab the trip does not draw", () => {
    const overview: TripTab[] = ["summary", "photos"];
    expect(resolveTripTab({ view: "day", hash: "#day-2", remembered: "bookings", available: overview })).toEqual({ ...DEFAULT_TAB_STATE, from: "default" });
    expect(resolveTripTab({ view: "bookings", hash: "", remembered: "photos", available: overview }).tab).toBe("photos");
    expect(resolveTripTab({ view: "garbage", hash: "", remembered: null, available: ALL }).from).toBe("default");
  });
  it("has no runtime import: it lives in the trip page's start chunk", () => {
    const src = readFileSync(fileURLToPath(new URL("../../src/trips/tabs.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/^\s*import\s+(?!type\b)/m);
  });
});
