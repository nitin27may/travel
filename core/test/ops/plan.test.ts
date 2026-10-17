import { describe, expect, it } from "vitest";
import { ACTOR, FakeBackend, ROOT, SLUG, TRIP_PATH, baseDoc, check, must, newStore, run } from "./util.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import type { Failure } from "../../src/ops/run.ts";

const doc = (store: MemoryStore): any => JSON.parse(store.text(TRIP_PATH)!);
const item = (over: Record<string, unknown>) => ({
  id: "d05-i01", day: 5, track: null, seq: 1, start: "09:00", window_start: null, window_end: null, tz: null, duration_min: 60, type: "sight", optional: false, pinned: false,
  title: "Mirador", place_id: null, trail_id: null, activity_id: null, eatery_id: null, custom_item_id: null, base_id: null, booking_id: null, lat: null, lon: null,
  address: null, leg_id: null, leg_mode: null, leg_km: null, leg_minutes: null, leg_basis: null, leg_notes: "", cost_amount: null, cost_currency: null, cost_per: null,
  open_from: null, open_to: null, closed_weekdays: [], needs_daylight: false, plan_b_item_id: null, override: null, notes: "", links: [], ...over,
});

describe("trip.copy", () => {
  it("copies references only: no private data, no booking statuses, no edition", async () => {
    const store = newStore();
    // give the source something private
    const d = doc(store);
    d.trip_bookings[0].status = "booked";
    d.trip_bookings[0].confirmation = "ABC123";
    d.travellers[0].age_years = 41;
    const { serializeTrip } = await import("../../src/store/index.ts");
    await store.write(TRIP_PATH, new TextEncoder().encode(serializeTrip(d)));
    const { r } = await check("trip.copy", { from_slug: SLUG, new_slug: "patagonia-copy", include: ["items"] }, { store, tripPath: "data/trips/patagonia-copy/trip.json" });
    expect(r.changed).toEqual(["patagonia-copy"]);
    const c = JSON.parse(store.text("data/trips/patagonia-copy/trip.json")!);
    expect(c.editions).toEqual([]);
    expect(c.travellers.every((t: any) => t.age_years === null && t.height_cm === null)).toBe(true);
    expect(c.trip_bookings.every((b: any) => b.status === "todo" && b.confirmation === null && b.edition_id === null)).toBe(true);
    expect(c.items.length).toBe(d.items.length);
    expect(c.changelog).toHaveLength(1);
    expect(c.trip).toMatchObject({ slug: "patagonia-copy", status: "idea", visibility: "private", web_published: false });
    expect(((await run(store, "trip.copy", { from_slug: SLUG, new_slug: "patagonia-copy" })) as Failure).code).toBe("E_EXISTS");
  });

  it("leaves items and notes out unless asked", async () => {
    const store = newStore();
    await must(store, "trip.copy", { from_slug: SLUG, new_slug: "bare-copy" });
    const c = JSON.parse(store.text("data/trips/bare-copy/trip.json")!);
    expect(c.items).toEqual([]);
    expect(c.notes).toEqual([]);
  });
});

describe("trip.adopt_place", () => {
  it("delegates the place write to the backend and queues a stop candidate", async () => {
    const backend = new FakeBackend();
    const { r } = await check("trip.adopt_place", { slug: SLUG, place_id: "CA/ON/niagara/niagara-falls" }, { backend });
    expect(r.changed).toContain("CA/ON/niagara/niagara-falls");
    // check() ran the inverse, which put the place back through the backend
    expect(backend.edits.map((e) => e.change)).toEqual([
      { status: "planned", trip: SLUG }, { status: "idea", trip: null }, { status: "planned", trip: SLUG },
    ]);
  });

  it("fails without a backend, and for an unknown place", async () => {
    const store = newStore();
    expect(((await run(store, "trip.adopt_place", { slug: SLUG, place_id: "CA/ON/niagara/niagara-falls" })) as Failure).code).toBe("E_NO_BACKEND");
    expect(((await run(store, "trip.adopt_place", { slug: SLUG, place_id: "XX/nowhere" }, new FakeBackend())) as Failure).code).toBe("E_NOT_FOUND");
  });
});

describe("editions", () => {
  const second = { conditions_trigger: null, id: "e2028", label: "Feb-Mar 2028", year: 2028, start: "2028-02-25", end: "2028-03-05", status: "candidate", why: "Next year", fare_window_id: null };
  it("edition.add", async () => {
    await check("edition.add", { slug: SLUG, row: second });
  });
  it("edition.add rejects a length that disagrees with the days", async () => {
    const res = (await run(newStore(), "edition.add", { slug: SLUG, row: { ...second, end: "2028-03-20" } })) as Failure;
    expect(res.code).toBe("E_EDITION_LENGTH");
  });
  it("edition.update stores conditions_trigger", async () => {
    await check("edition.update", { slug: SLUG, id: "e2027", patch: { conditions_trigger: "2027-02-22T09:00:00-03:00" } });
  });
  it("edition.choose demotes the other chosen edition", async () => {
    const store = newStore();
    await must(store, "edition.add", { slug: SLUG, row: second });
    const { r } = await check("edition.choose", { slug: SLUG, id: "e2028" }, { store });
    expect(r.changed).toEqual(["e2028", "e2027"]);
    expect(doc(store).editions.map((e: any) => [e.id, e.status])).toEqual([["e2027", "candidate"], ["e2028", "chosen"]]);
  });
  it("edition.choose refuses while another edition is booked", async () => {
    const store = newStore();
    await must(store, "edition.add", { slug: SLUG, row: second });
    await must(store, "edition.update", { slug: SLUG, id: "e2027", patch: { status: "booked" } });
    expect(((await run(store, "edition.choose", { slug: SLUG, id: "e2028" })) as Failure).code).toBe("E_EDITION_CHOSEN");
  });
});

describe("base.set", () => {
  it("replaces the night split", async () => {
    const d = baseDoc();
    const bases = d.bases.map((b: any) => ({ ...b }));
    bases.find((b: any) => b.id === "el-chalten").nights = 5;
    const calafate = bases.find((b: any) => b.id === "el-calafate");
    calafate.night_from = 8;
    calafate.nights = 2;
    // the fixture's days stay valid: the last night is night 9
    await check("base.set", { slug: SLUG, bases });
  });
  it("rejects a split that leaves a night uncovered", async () => {
    const d = baseDoc();
    const bases = d.bases.map((b: any) => ({ ...b }));
    bases.find((b: any) => b.id === "el-chalten").nights = 3;
    const res = (await run(newStore(), "base.set", { slug: SLUG, bases })) as Failure;
    expect(["E_BASE_COVER", "E_NIGHTS_SUM"]).toContain(res.code);
  });
});

describe("days", () => {
  const dayRow = (n: number, over: Record<string, unknown> = {}) => ({
    n, title: "New day", kind: "mixed", base_id: null, summary: "", prose: null, flexible_group: null, decision_rules: [], plan_b_title: "", plan_b_text: null, sun_note: null,
    day_of_links: [], accepted_warnings: [], ...over,
  });
  it("day.add appends a day: one more night at the last base, the edition end follows", async () => {
    const { r, store } = await check("day.add", { slug: SLUG, row: dayRow(11) });
    expect(r.changed).toEqual(["day:11"]);
    const d = doc(store);
    expect(d.trip.nights).toBe(10);
    expect(d.editions[0].end).toBe("2027-03-08");
    expect(d.days.at(-2).base_id).toBe("el-calafate");
    expect(d.days.at(-1).base_id).toBeNull();
  });
  it("day.add inserts in the middle and moves later days and their items down", async () => {
    const store = newStore();
    await check("day.add", { slug: SLUG, row: dayRow(5) }, { store, variant: "insert" });
    const d = doc(store);
    expect(d.items.find((i: any) => i.id === "d08-i01").day).toBe(9);
    expect(d.days.map((x: any) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("day.add refuses a gap", async () => {
    expect(((await run(newStore(), "day.add", { slug: SLUG, row: dayRow(14) })) as Failure).code).toBe("E_DAYS_CONTIGUOUS");
  });
  it("day.update", async () => {
    await check("day.update", { slug: SLUG, n: 3, patch: { title: "Fitz Roy approach", kind: "hike" } });
  });
  it("day.swap swaps days with their items and keeps each night at its base", async () => {
    const store = newStore();
    await check("day.swap", { slug: SLUG, a: 3, b: 8 }, { store });
    const d = doc(store);
    expect(d.items.find((i: any) => i.id === "d03-i01").day).toBe(8);
    expect(d.items.find((i: any) => i.id === "d08-i02").day).toBe(3);
    expect(d.days.find((x: any) => x.n === 3).base_id).toBe("el-chalten");
  });
  it("day.remove deletes the day and its items, moves later days up and shrinks a night", async () => {
    const store = newStore();
    const { r } = await check("day.remove", { slug: SLUG, n: 8 }, { store });
    expect(r.changed).toContain("d08-i02");
    const d = doc(store);
    expect(d.days.map((x: any) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(d.trip.nights).toBe(8);
    expect(d.items.some((i: any) => i.day === 8 && i.id.startsWith("d08"))).toBe(false);
    expect(d.items.find((i: any) => i.id === "d10-i01").day).toBe(9);
    expect(d.editions[0].end).toBe("2027-03-06");
  });
});

describe("items", () => {
  it("item.add puts the item at its seq and renumbers the group", async () => {
    const store = newStore();
    const { r } = await check("item.add", { slug: SLUG, row: item({ id: "d08-i10", day: 8, track: "A", seq: 1, title: "Early coffee" }) }, { store });
    expect(r.changed).toEqual(["d08-i10"]);
    const a = doc(store).items.filter((i: any) => i.day === 8 && i.track === "A").sort((x: any, y: any) => x.seq - y.seq);
    expect(a.map((i: any) => [i.id, i.seq])).toEqual([["d08-i10", 1], ["d08-i02", 2]]);
  });
  it("item.add refuses a duplicate id", async () => {
    expect(((await run(newStore(), "item.add", { slug: SLUG, row: item({ id: "d03-i01", day: 3 }) })) as Failure).code).toBe("E_PK_DUP");
  });
  it("item.update", async () => {
    await check("item.update", { slug: SLUG, id: "d03-i01", patch: { title: "Check in at the lodge", duration_min: 45 } });
  });
  it("item.move keeps seq contiguous on both days", async () => {
    const store = newStore();
    await must(store, "item.add", { slug: SLUG, row: item({ id: "d05-i01", day: 5, seq: 1 }) });
    await must(store, "item.add", { slug: SLUG, row: item({ id: "d05-i02", day: 5, seq: 2, start: "11:00", title: "Lunch" }) });
    await check("item.move", { slug: SLUG, id: "d05-i01", day: 6 }, { store, variant: "to-other-day" });
    const d = doc(store);
    expect(d.items.filter((i: any) => i.day === 5).map((i: any) => [i.id, i.seq])).toEqual([["d05-i02", 1]]);
    expect(d.items.filter((i: any) => i.day === 6).map((i: any) => [i.id, i.seq])).toEqual([["d05-i01", 1]]);
  });
  it("item.move within a group moves down as well as up", async () => {
    const store = newStore();
    await must(store, "item.add", { slug: SLUG, row: item({ id: "d05-i01", day: 5, seq: 1 }) });
    await must(store, "item.add", { slug: SLUG, row: item({ id: "d05-i02", day: 5, seq: 2, start: "11:00", title: "Lunch" }) });
    await must(store, "item.add", { slug: SLUG, row: item({ id: "d05-i03", day: 5, seq: 3, start: "14:00", title: "Walk" }) });
    await check("item.move", { slug: SLUG, id: "d05-i01", seq: 3 }, { store, variant: "down" });
    expect(doc(store).items.filter((i: any) => i.day === 5).sort((a: any, b: any) => a.seq - b.seq).map((i: any) => i.id)).toEqual(["d05-i02", "d05-i03", "d05-i01"]);
  });
  it("item.remove closes the gap and clears plan B links", async () => {
    const store = newStore();
    await check("item.remove", { slug: SLUG, id: "d08-i01" }, { store });
    expect(doc(store).items.find((i: any) => i.id === "d08-i09").seq).toBe(1);
  });
  it("item.pin and item.unpin", async () => {
    const store = newStore();
    await check("item.pin", { slug: SLUG, id: "d03-i01" }, { store });
    expect(doc(store).items.find((i: any) => i.id === "d03-i01").pinned).toBe(true);
    await check("item.unpin", { slug: SLUG, id: "d03-i01" }, { store });
  });
});

describe("tracks and trails", () => {
  it("track.set adds and replaces a day track", async () => {
    const row = { day: 3, track: "A", audience: "adult-only", title: "Long way round", notes: "", split: true };
    await check("track.set", { slug: SLUG, row });
  });
  it("trail.link links a catalog trail with a role", async () => {
    const d = baseDoc();
    const t = d.trip_trails[0];
    await check("trail.link", { slug: SLUG, row: { ...t, verdict: "Changed verdict" } });
  });
});

it("uses the owner actor in fixtures", () => {
  expect(ACTOR.id).toBe("u_owner");
  expect(ROOT).toContain("fixtures");
});
