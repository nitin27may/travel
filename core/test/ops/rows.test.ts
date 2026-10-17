import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MemoryStore } from "../../src/store/memory.ts";
import type { Failure } from "../../src/ops/run.ts";
import { ROOT, SLUG, TRIP_PATH, baseDoc, baseText, check, newStore, run } from "./util.ts";

const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

const base = baseDoc();
const first = (table: string): Record<string, any> => JSON.parse(JSON.stringify(base[table][0]));
const byId = (table: string, id: string): Record<string, any> => JSON.parse(JSON.stringify(base[table].find((r: any) => r.id === id)));
const doc = (store: ReturnType<typeof newStore>): any => JSON.parse(store.text(TRIP_PATH)!);

describe("row upserts replace by primary key and add new rows", () => {
  const cases: [string, string, Record<string, unknown>, Record<string, unknown> | null][] = [
    ["trip_activity.set", "trip_activities", { verdict: "optional", why: "Weather dependent" }, null],
    ["hazard.upsert", "hazards", { severity: 3, mitigation: "Turn back at the lake" }, { id: "h-cold", category: "cold", title: "Cold snaps" }],
    ["weather_rule.upsert", "weather_rules", { value: 60 }, { id: "wr-2", metric: "wind_kmh" }],
    ["budget.upsert", "budget", { group_high_amount: 5000 }, { id: "bd-lodging", category: "lodging", item: "Chalten lodging" }],
    ["document.upsert", "documents", { status: "done" }, { id: "doc-eta", item: "eta", rule: "Check requirements" }],
    ["emergency.upsert", "emergency", { number: "911" }, { base_id: "ushuaia" }],
    ["route.set", "routes", { corridor_km: 12 }, { id: "r2" }],
  ];
  for (const [op, table, patch, fresh] of cases) {
    it(`${op} replaces an existing row`, async () => {
      await check(op, { slug: SLUG, row: { ...first(table), ...patch } });
    });
    if (fresh) {
      it(`${op} adds a new row`, async () => {
        await check(op, { slug: SLUG, row: { ...first(table), ...fresh } }, { variant: "new" });
      });
    }
  }
});

describe("add operations refuse an existing id", () => {
  const cases: [string, string, Record<string, unknown>][] = [
    ["question.add", "questions", { id: "q-new", text: "Is the Piratour minimum age 8?" }],
    ["knowledge.add", "knowledge", { id: "k-new", claim: "Buses run daily in March", status: "inference" }],
    ["gotcha.add", "gotchas", { id: "g-new", text: "Cards are refused at the hostel" }],
    ["fare.add_window", "fare_windows", { id: "fw-2028", label: "2028 window", depart: "2028-02-25", return: "2028-03-06" }],
    ["fare.add_quote", "fare_quotes", { id: "fq-2", total_amount: 4100 }],
    ["custom_item.add", "custom_items", { id: "cx-mate-stop", name: "Mate shop" }],
    ["note.add", "notes", { id: "n-new", text: "Bring cash" }],
  ];
  for (const [op, table, fresh] of cases) {
    it(op, async () => {
      await check(op, { slug: SLUG, row: { ...first(table), ...fresh } });
      const dup = (await run(newStore(), op, { slug: SLUG, row: first(table) })) as Failure;
      expect(dup.ok).toBe(false);
      expect(dup.code).toBe("E_PK_DUP");
    });
  }
});

describe("question.answer, note.update, note.remove, custom_item.update", () => {
  it("question.answer", async () => {
    const { store } = await check("question.answer", { slug: SLUG, id: first("questions").id, answer: "Yes, 8 and up." });
    expect(doc(store).questions[0]).toMatchObject({ status: "answered", answer: "Yes, 8 and up." });
  });
  it("note.update stamps `updated`", async () => {
    const { store } = await check("note.update", { slug: SLUG, id: first("notes").id, patch: { text: "Changed" } });
    expect(doc(store).notes[0]).toMatchObject({ text: "Changed", updated: "2026-10-17T15:00:00Z" });
  });
  it("note.remove", async () => {
    const { store } = await check("note.remove", { slug: SLUG, id: first("notes").id });
    expect(doc(store).notes).toEqual([]);
  });
  it("custom_item.update", async () => {
    await check("custom_item.update", { slug: SLUG, id: first("custom_items").id, patch: { notes: "Closed on Mondays" } });
  });
  it("an unknown id is E_NOT_FOUND", async () => {
    expect(((await run(newStore(), "note.remove", { slug: SLUG, id: "nope" })) as Failure).code).toBe("E_NOT_FOUND");
  });
});

describe("bookings", () => {
  const piratour = (over: Record<string, unknown> = {}) => ({ ...byId("trip_bookings", "bk-piratour"), ...over });
  it("trip_booking.upsert recomputes the book-by from the offer window", async () => {
    // the fixture stores -88 as a computed value; the offer opens 120 days ahead and sells out in weeks (30)
    const { store } = await check("trip_booking.upsert", { slug: SLUG, row: piratour({ book_by_offset: null, used_days: [3] }) });
    expect(doc(store).trip_bookings.find((b: any) => b.id === "bk-piratour")).toMatchObject({ book_by_offset: -42, book_by_basis: "computed" });
  });
  it("trip_booking.upsert keeps an owner's offset", async () => {
    const { store } = await check("trip_booking.upsert", { slug: SLUG, row: piratour({ book_by_offset: -88, book_by_basis: "owner" }) }, { variant: "owner" });
    expect(doc(store).trip_bookings.find((b: any) => b.id === "bk-piratour")).toMatchObject({ book_by_offset: -88, book_by_basis: "owner" });
  });
  it("trip_booking.upsert without an offer uses the inference default and says so", async () => {
    const row = { ...piratour({ id: "bk-flight", offer_id: null, item: "YYZ-EZE", category: "flight-intl", used_days: [1], book_by_offset: null, status: "todo" }) };
    const { store } = await check("trip_booking.upsert", { slug: SLUG, row }, { variant: "inference" });
    // Day 1 is 26 Feb 2027, not a peak month: 30 days
    expect(doc(store).trip_bookings.find((b: any) => b.id === "bk-flight")).toMatchObject({ book_by_offset: -30, book_by_basis: "inference" });
  });
  it("trip_booking.set_status", async () => {
    const { store } = await check("trip_booking.set_status", { slug: SLUG, id: "bk-piratour", status: "booked" });
    expect(doc(store).trip_bookings.find((b: any) => b.id === "bk-piratour").status).toBe("booked");
  });
});

describe("research.add_ref", () => {
  const withExtra = (): ReturnType<typeof newStore> => {
    const root = mkdtempSync(join(tmpdir(), "p4a-refs-"));
    tmp.push(root);
    cpSync(ROOT, root, { recursive: true });
    writeFileSync(join(root, "research/trips/patagonia-fixture/lodging.md"), "# Lodging lane\n");
    writeFileSync(join(root, "research/trips/patagonia-fixture/lodging.json"), "{}\n");
    return new MemoryStore(root, { [TRIP_PATH]: baseText() });
  };
  it("indexes a research file with its sidecar and a sha256", async () => {
    const { store } = await check("research.add_ref", { slug: SLUG, path: "research/trips/patagonia-fixture/lodging.md", lane: "lodging", title: "Lodging lane" }, { store: withExtra() });
    const refs = doc(store).research_refs;
    expect(refs).toHaveLength(2);
    expect(refs[1]).toMatchObject({ id: "rr-lodging-lodging", lane: "lodging", sidecar: "research/trips/patagonia-fixture/lodging.json", added: "2026-10-17", synthesised: null });
    expect(refs[1].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("re-indexing the same path updates the row instead of adding one", async () => {
    const store = newStore();
    await check("research.add_ref", { slug: SLUG, path: "research/trips/patagonia-fixture/trails.md", lane: "trails", title: "Renamed" }, { store, variant: "reindex" });
    expect(doc(store).research_refs).toHaveLength(1);
    expect(doc(store).research_refs[0]).toMatchObject({ id: "rr-1", title: "Renamed", added: "2026-10-13" });
  });
  it("a missing file is E_RESEARCH_PATH", async () => {
    expect(((await run(newStore(), "research.add_ref", { slug: SLUG, path: "research/trips/patagonia-fixture/nope.md", lane: "x", title: "x" })) as Failure).code).toBe("E_RESEARCH_PATH");
  });
});
