import { describe, expect, it } from "vitest";
import { runOp } from "../../src/ops/run.ts";
import type { Failure, ReadOk } from "../../src/ops/run.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import { ROOT, SLUG, baseText, newStore } from "./util.ts";

const read = async (store: MemoryStore, name: string, input: Record<string, unknown>, today = "2026-10-17"): Promise<any> => {
  const r = (await runOp(store, name, input, { now: `${today}T12:00:00Z`, today })) as ReadOk | Failure;
  if (!r.ok) throw new Error(JSON.stringify(r));
  return (r as ReadOk).result;
};

describe("read operations", () => {
  it("trip.get returns the stored trip, with resolved dates, ages and book-by dates on request", async () => {
    const store = newStore();
    const plain = await read(store, "trip.get", { slug: SLUG });
    expect(plain.trip.resolved).toBeUndefined();
    const res = await read(store, "trip.get", { slug: SLUG, resolve: true });
    expect(res.trip.resolved.start).toBe("2027-02-26");
    expect(res.trip.resolved.days[7]).toMatchObject({ n: 8, date: "2027-03-05", weekday: "Friday" });
    expect(res.trip.resolved.travellers.find((t: any) => t.id === "t3").age).toBe(13);
    expect(res.trip.resolved.bookings.find((b: any) => b.id === "bk-piratour")).toMatchObject({ book_by_date: "2027-01-15", state: "not-yet-open" });
  });

  it("trip.get for an unknown trip or edition fails clearly", async () => {
    const store = newStore();
    const a = (await runOp(store, "trip.get", { slug: "nope" })) as Failure;
    expect(a).toMatchObject({ ok: false, code: "E_NOT_FOUND" });
    const b = (await runOp(store, "trip.get", { slug: SLUG, resolve: true, edition: "e1999" })) as Failure;
    expect(b.message).toContain("e2027");
  });

  it("bookings.due orders open bookings by resolved book-by date with their state", async () => {
    const store = newStore();
    const r = await read(store, "bookings.due", { within_days: 365 }, "2026-12-01");
    expect(r.bookings.map((b: any) => b.id)).toEqual(["bk-piratour", "bk-chalten-lodging"].filter((id) => r.bookings.some((b: any) => b.id === id)));
    const p = r.bookings.find((b: any) => b.id === "bk-piratour");
    expect(p).toMatchObject({ trip: SLUG, book_by: "2027-01-15", state: "open", overdue: false });
    const late = await read(store, "bookings.due", { within_days: 0 }, "2027-02-01");
    expect(late.bookings.find((b: any) => b.id === "bk-piratour")).toMatchObject({ overdue: true, state: "urgent" });
  });

  it("rows.query and search work against the repository root", async () => {
    const store = new MemoryStore(ROOT, { [`data/trips/${SLUG}/trip.json`]: baseText() });
    const q = await read(store, "rows.query", { type: "locations.places", limit: 2 });
    expect(q.rows.length).toBeLessThanOrEqual(2);
    expect(q.total).toBeGreaterThan(0);
    const s = await read(store, "search", { q: "chalten" });
    expect(s.groups.length).toBeGreaterThan(0);
  });
});
