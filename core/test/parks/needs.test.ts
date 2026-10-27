// PA-D: entryNeeds and entryFor (protected-area-entry 6.2, 6.5, 12) over the synthetic graph, parks and PA-FX fixtures. Nothing real.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/capture/records.ts";
import { buildIndex } from "../../src/graph/build.ts";
import { entryFor, entryNeeds } from "../../src/parks/needs.ts";
import { capDoc, put, scope, scratchRoot } from "../capture/helpers.ts";

const FIX = (d: string) => fileURLToPath(new URL(`../fixtures/${d}/`, import.meta.url));
const SOURCES: [string, string][] = [[FIX("graph/valid"), "graph-fixture"], [FIX("parks"), "parks-fixture"], [FIX("protected-areas/valid"), "park-fixture"]];

function index(extra: unknown[] = []) {
  const root = scratchRoot({ "data/suitability/scope.json": scope([]) });
  for (const [dir, lane] of SOURCES) for (const n of readdirSync(dir).filter((f) => f.endsWith(".json"))) put(root, `data/capture/${lane}/${n}`, JSON.parse(readFileSync(join(dir, n), "utf8")));
  if (extra.length) put(root, "data/capture/graph-fixture/extra.json", capDoc(extra, { trip: "graph-fixture" }));
  return buildIndex(loadWorld(root));
}
const g = index();
const names = (r: { rows: { name: string }[] }) => r.rows.map((x) => x.name).sort();

const BANFF = "place/banff-national-park";
const HIGH = "place/highcrest-national-park";
const BASIN = "part/place/highcrest-national-park#glacier-basin";
const PINE = "place/pinewater-provincial-park";

const ONE_REC = (ref: string, type: string, layer: string, name: string, more: object = {}) => ({ ref, type, layer, name, ...more });
const val = (v: unknown) => ({ v, state: "value", basis: "official_info", src: [] });

describe("entryNeeds: day, overnight and backcountry (6.5)", () => {
  it("day visit: fee, timed entry and the day permits of the park; no campsite, no backcountry permit", () => {
    const r = entryNeeds(g, PINE, { mode: "day", month: 7 });
    expect(r.state).toBe("requirements");
    const words = r.rows.map((x) => x.words).sort();
    expect(words).toEqual(["day-use permit", "vehicle permit"]);
    expect(r.rows.find((x) => x.words === "vehicle permit")!.coveredBy.map((p) => p.name)).toEqual(["annual vehicle pass"]);
    expect(r.rows.some((x) => x.words === "campsite" || x.words === "backcountry permit")).toBe(false);
  });
  it("front-country night: the park's campgrounds' campsites join the rows, labelled with their campground", () => {
    const r = entryNeeds(g, PINE, { mode: "overnight_front", month: 7 });
    const camp = r.rows.find((x) => x.words === "campsite")!;
    expect(camp.source).toMatchObject({ name: expect.stringContaining("North Campground"), kind: "place", via: "self" });
    expect(camp.kind).toBe("booking");
    expect(r.rows.some((x) => x.words === "day-use permit")).toBe(false); // needed_for day only
    expect(r.rows.some((x) => x.words === "backcountry permit")).toBe(false);
  });
  it("backcountry night: the permit (a lottery) and no front-country campsite", () => {
    const r = entryNeeds(g, PINE, { mode: "overnight_back", month: 7 });
    const permit = r.rows.find((x) => x.words === "backcountry permit")!;
    expect(permit.rule).toMatch(/^Lottery/);
    expect(permit.kind).toBe("booking");
    expect(r.rows.some((x) => x.words === "campsite")).toBe(false);
  });
});

describe("seasons, closures and months", () => {
  it("off-season: a requirement whose season does not cover the date drops out; the park fee stays", () => {
    const summer = entryNeeds(g, HIGH, { mode: "day", date: "2026-07-15", visiting: [BASIN] });
    expect(names(summer)).toEqual(["basin lottery bus", "daily admission", "valley shuttle"]);
    const late = entryNeeds(g, HIGH, { mode: "day", date: "2026-11-15", visiting: [BASIN] });
    expect(names(late)).toEqual(["daily admission"]);
    // the shuttle runs 06-01 to 10-12 in 2026 only: a 2027 date has no row for that year, so it is kept (unknown, not "off-season")
    expect(names(entryNeeds(g, HIGH, { mode: "day", date: "2027-11-15" }))).toContain("valley shuttle");
  });
  it("a month query keeps what the season touches; a closed-status row does not count", () => {
    expect(names(entryNeeds(g, HIGH, { mode: "day", month: 6, visiting: [BASIN] }))).toContain("basin lottery bus");
    expect(names(entryNeeds(g, HIGH, { mode: "day", month: 2, visiting: [BASIN] }))).toEqual(["daily admission"]);
  });
  it("the park's own season and standing closures say whether you can get in (a limited season, a closed date)", () => {
    expect(entryNeeds(g, PINE, { mode: "day", date: "2026-07-01" }).access.state).toBe("open");
    const winter = entryNeeds(g, PINE, { mode: "day", date: "2026-12-01" });
    expect(winter.access).toMatchObject({ state: "limited", notes: [{ text: "gate closed, walk in", from: PINE }] });
    const gx = index([
      ONE_REC("place/shut-park", "nature.protected.national_park", "place", "Shut Park", { covers_areas: ["ZZ/S9/shut"], closures: val([{ from: "03-01", to: "03-31", status: "closed", why: "spring clean" }, { from: "2031-05-10", to: "2031-05-12", status: "limited", why: "road works" }]) }),
    ]);
    expect(entryNeeds(gx, "place/shut-park", { mode: "day", date: "2026-03-10" }).closures).toEqual([{ text: "spring clean", status: "closed", from: "place/shut-park" }]);
    expect(entryNeeds(gx, "place/shut-park", { mode: "day", date: "2026-03-10" }).access.state).toBe("closed");
    expect(entryNeeds(gx, "place/shut-park", { mode: "day", date: "2031-05-11" }).closures.map((c) => c.status)).toEqual(["limited"]);
    expect(entryNeeds(gx, "place/shut-park", { mode: "day", date: "2026-04-10" }).closures).toEqual([]);
  });
  it("a malformed date or month is refused, not guessed", () => {
    expect(() => entryNeeds(g, HIGH, { mode: "day", date: "15/07/2026" })).toThrow(/YYYY-MM-DD/);
    expect(() => entryNeeds(g, HIGH, { mode: "day", month: 13 })).toThrow(/1 to 12/);
  });
});

describe("party: exemptions by who and the free child", () => {
  it("a free band frees a child-only party from the fee; a mixed party pays for the adult only", () => {
    const kids = entryNeeds(g, HIGH, { mode: "day", date: "2026-07-15", party: { ages: [8, 10] } });
    expect(names(kids)).toEqual(["valley shuttle"]);
    expect(kids.exempted.map((e) => [e.row.name, e.why])).toEqual([["daily admission", "free for this party"]]);
    const mixed = entryNeeds(g, HIGH, { mode: "day", date: "2026-07-15", party: { ages: [41, 9] } });
    expect(mixed.rows.find((x) => x.name === "daily admission")!.partyPays).toEqual({ paying: 1, free: 1 });
  });
  it("an exemption by who moves the row to exempted, with the reason; other kinds leave it", () => {
    const camper = entryNeeds(g, PINE, { mode: "overnight_front", month: 7, party: { who: ["camper"] } });
    expect(camper.exempted.map((e) => [e.row.words, e.why])).toEqual([["vehicle permit", "camper"]]);
    expect(camper.rows.some((x) => x.words === "vehicle permit")).toBe(false);
    expect(entryNeeds(g, PINE, { mode: "overnight_front", month: 7, party: { who: ["through_traffic"] } }).rows.some((x) => x.words === "vehicle permit")).toBe(true);
    const holder = entryNeeds(g, HIGH, { mode: "day", month: 7, party: { who: ["pass_holder"] } });
    expect(holder.rows.some((x) => x.name === "daily admission")).toBe(false);
  });
  it("residency picks the price rows (a row with none applies to all)", () => {
    const foreign = entryNeeds(g, "place/ember-ridge-national-park", { mode: "day", month: 7, party: { residency: "foreign" } });
    expect(foreign.rows.find((x) => x.name === "resident foreign fee")!.price.map((p) => p.amount)).toEqual([40, 0]); // the resident and national rows drop; the child row has no residency
  });
});

describe("honest states (4.5) and what is to book (QP3)", () => {
  it("a park with no requirement record: Entry not checked yet", () => {
    const r = entryNeeds(g, "place/open-meadow-reserve", { mode: "day", month: 7 });
    expect(r).toMatchObject({ state: "not_checked", rows: [], summary: "Entry not checked yet" });
  });
  it("a sourced no_limit is none_needed; requirements none of whose modes match is none_needed too", () => {
    const gx = index([ONE_REC("place/free-park", "nature.protected.forest", "place", "Free Forest", { covers_areas: ["ZZ/S9/free"], access_cost: val("no_limit") })]);
    expect(entryNeeds(gx, "place/free-park", { mode: "day", month: 7 })).toMatchObject({ state: "none_needed", rows: [] });
    expect(entryNeeds(g, "place/pinewater-lakeside-campground", { mode: "overnight_back", month: 7 }).state).toBe("requirements"); // inherits the park's backcountry permit
    const only = index([
      ONE_REC("place/night-park", "nature.protected.forest", "place", "Night Forest", { covers_areas: ["ZZ/S9/night"] }),
      ONE_REC("offer/place/night-park#permit", "access.pass.backcountry_permit", "offer", "Night permit", { at: ["place/night-park"], entry: val({ needed_for: ["overnight_back"] }) }),
    ]);
    expect(entryNeeds(only, "place/night-park", { mode: "day", month: 7 })).toMatchObject({ state: "none_needed", rows: [], summary: "Nothing to enter or book for this visit" });
  });
  it("a half-filled permit says its window is not published; a pay-on-arrival fee is a check", () => {
    const r = entryNeeds(g, "place/ember-ridge-national-park", { mode: "day", month: 7 });
    expect(r.rows.find((x) => x.name === "half filled permit")!.rule).toBe("Booking window not published; book as early as possible");
    expect(r.rows.find((x) => x.name === "resident foreign fee")!.kind).toBe("check");
  });
  it("checks are never counted as to book: counts and summary", () => {
    const r = entryNeeds(g, "place/lake-louise", { mode: "day", month: 9 });
    const checks = r.rows.filter((x) => x.kind === "check");
    expect(checks.length).toBeGreaterThanOrEqual(1);
    expect(r.counts).toMatchObject({ check: checks.length, toBook: r.rows.filter((x) => x.kind === "booking").length });
    const gx = index([
      ONE_REC("place/lot-park", "nature.protected.forest", "place", "Lot Forest", { covers_areas: ["ZZ/S9/lot"] }),
      ONE_REC("offer/place/lot-park#lot", "access.park.parking", "offer", "Lot", { at: ["place/lot-park"] }),
    ]);
    const lot = entryNeeds(gx, "place/lot-park", { mode: "day", month: 7 });
    expect(lot.rows.map((x) => x.kind)).toEqual(["check"]);
    expect(lot).toMatchObject({ counts: { toBook: 0, check: 1 }, summary: "Nothing to book ahead" });
  });
});

describe("the Rockies-shaped park: pass folding and the saving line (QP5)", () => {
  it("the fee is covered by the pass; the pass names itself in coveredBy, not as a row", () => {
    const r = entryNeeds(g, BANFF, { mode: "day", month: 9 });
    expect(r.rows.map((x) => [x.name, x.kind, x.coveredBy.map((p) => p.name)])).toEqual([["Banff daily admission", "pass", ["Discovery Pass"]]]);
    expect(r.rows[0]!.rule).toMatch(/^Buy any time/);
  });
  it("the saving only with the day count, and only when the prices compare", () => {
    expect(entryNeeds(g, BANFF, { mode: "day", month: 9 }).saving).toBeNull();
    expect(entryNeeds(g, BANFF, { mode: "day", month: 9, dayCount: 10 }).saving).toBe("For 10 park days, the Discovery Pass is likely cheaper than the daily entry fee (family price)");
    expect(entryNeeds(g, BANFF, { mode: "day", month: 9, dayCount: 2 }).saving).toBeNull();
    // Highcrest: pass is per family, the fee per adult: units differ, so no claim
    expect(entryNeeds(g, HIGH, { mode: "day", month: 7, dayCount: 20 }).saving).toBeNull();
  });
  it("a zone's own needs are listed under elsewhere until the visitor goes there, then labelled with the zone", () => {
    const park = entryNeeds(g, "place/yoho-national-park", { mode: "day", month: 9 });
    expect(park.elsewhere).toEqual([{ ref: "part/place/yoho-national-park#lake-ohara", name: "Lake O'Hara", count: 1 }]);
    const there = entryNeeds(g, "place/yoho-national-park", { mode: "day", month: 9, visiting: ["part/place/yoho-national-park#lake-ohara"] });
    expect(there.elsewhere).toEqual([]);
    expect(there.rows.find((x) => x.words === "shuttle seat")!.source).toMatchObject({ kind: "zone", name: "Lake O'Hara", label: "Lake O'Hara" });
  });
  it("one row per ridden day for a one-day seat; one row for the days of a pass (checks count 0 to book)", () => {
    const shuttle = entryFor(g, "place/moraine-lake", { mode: "day", month: 9, days: [11, 12] });
    const seat = shuttle.rows.find((x) => x.words === "shuttle seat")!;
    expect(seat.bookings.map((b) => b.days)).toEqual([[11], [12]]);
    const fee = entryNeeds(g, BANFF, { mode: "day", month: 9, days: [3, 4, 5] }).rows[0]!;
    expect(fee.bookings.map((b) => b.days)).toEqual([[3, 4, 5]]);
    const parking = entryFor(g, "place/lake-louise", { mode: "day", month: 9, days: [10] }).rows.find((x) => x.words === "parking");
    expect(parking?.kind).toBe("check");
    expect(parking?.bookings[0]?.bookKind).toBe("check");
  });
});

describe("entryFor: a member inherits from the park, overrides it, and carries its own", () => {
  const MIRROR = "place/mirror-lake";
  const RB = "place/ridgeback-national-park";
  it("a lake inherits the park's fee and vehicle permit, each labelled with the park", () => {
    const r = entryFor(g, MIRROR, { mode: "day", month: 7 });
    const fee = r.rows.find((x) => x.words === "entry fee")!;
    expect(fee.source).toMatchObject({ ref: RB, via: "container", kind: "park", label: "Ridgeback National Park" });
    expect(r.rows.some((x) => x.words === "vehicle permit")).toBe(true);
    expect(r.rows.some((x) => x.words === "timed entry")).toBe(false); // the Glacier Basin gate is a different zone
  });
  it("a member in the gated zone also carries the zone's timed entry, labelled with the zone", () => {
    const r = entryFor(g, "place/tarn-lake", { mode: "day", month: 7 });
    expect(r.rows.find((x) => x.words === "timed entry")!.source).toMatchObject({ kind: "zone", name: "Glacier Basin (gated sub-area)", via: "container" });
    expect(r.rows.some((x) => x.words === "entry fee")).toBe(true);
  });
  it("a sourced no_limit on the member overrides everything the chain asks (7.1)", () => {
    const gx = index([ONE_REC("place/free-spot", "nature.viewpoint.viewpoint", "place", "Free spot", { part_of: [RB], access_cost: { v: "no_limit", state: "value", basis: "official_info", src: ["src-0001"] } })]);
    expect(entryFor(gx, "place/free-spot", { mode: "day", month: 7 })).toMatchObject({ state: "none_needed", rows: [] });
    expect(entryFor(gx, MIRROR, { mode: "day", month: 7 }).rows.length).toBeGreaterThan(0);
  });
  it("a member of a park whose own record says no fee is none_needed, not unchecked", () => {
    const gx = index([
      ONE_REC("place/free-park", "nature.protected.forest", "place", "Free Forest", { covers_areas: ["ZZ/S9/free"], access_cost: val("no_limit") }),
      ONE_REC("place/free-glade", "water.body.pond_reservoir", "place", "Glade Pond", { area_id: "ZZ/S9/free" }),
    ]);
    expect(entryFor(gx, "place/free-glade", { mode: "day", month: 7 }).state).toBe("none_needed");
    expect(entryFor(g, "place/open-meadow-reserve", { mode: "day", month: 7 }).state).toBe("not_checked");
  });
  it("a trail reached through a shuttle access point carries the shuttle seat, labelled with the trail's start", () => {
    const STOP = "part/place/mirror-lake#shuttle-stop";
    const gx = index([ONE_REC("offer/place/mirror-lake#shuttle-seat", "access.pass.shuttle_seat", "offer", "Mirror Lake shuttle seat", { at: [STOP], entry: val({ needed_for: ["day"], required: "always", unit: "person", valid: { span: 1, unit: "day", from: "slot_start" } }), window: val({ rule: "rolling", days_before: 2 }) })]);
    const loop = entryFor(gx, "part/place/mirror-lake#ridge-loop", { mode: "day", month: 7, days: [4, 5] });
    const seat = loop.rows.find((x) => x.words === "shuttle seat")!;
    expect(seat.source).toMatchObject({ ref: STOP, via: "start", kind: "place", label: "Mirror Lake shuttle stop, the trail's start" });
    expect(seat.bookings.map((b) => b.days)).toEqual([[4], [5]]);
    // the park's own fee comes through the same chain, labelled as reached through the trail's start
    expect(loop.rows.find((x) => x.words === "entry fee")!.source.label).toMatch(/^Ridgeback National Park/);
    // the lake itself does not need the seat (the stop only serves it: not its requirement unless reached through a trail)
    expect(entryFor(g, MIRROR, { mode: "day", month: 7 }).rows.some((x) => x.words === "shuttle seat")).toBe(false);
  });
  it("a route's activity permit applies to the route and its stages (on), not to a lake", () => {
    const stage = entryFor(g, "part/place/ridgeback-national-park#traverse-stage-2", { mode: "overnight_back", month: 7 });
    expect(stage.rows.some((x) => x.words === "activity permit")).toBe(true);
    expect(entryFor(g, MIRROR, { mode: "overnight_back", month: 7 }).rows.some((x) => x.words === "activity permit")).toBe(false);
  });
  it("alternatives (an alternative_to pair) are one row with its alternative named, each with its source", () => {
    const r = entryFor(g, "place/twin-rivers-national-park", { mode: "day", month: 7 });
    const alt = r.rows.filter((x) => x.alternatives.length);
    for (const a of alt) expect(a.alternatives[0]!.source.label).toBeTruthy();
  });
  it("an unknown record is refused", () => {
    expect(() => entryFor(g, "place/nowhere", { mode: "day", month: 7 })).toThrow(/unknown record/);
  });
});
