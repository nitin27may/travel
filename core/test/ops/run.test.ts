import { describe, expect, it } from "vitest";
import { runOp } from "../../src/ops/run.ts";
import type { Failure, WriteOk } from "../../src/ops/run.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import { ACTOR, NOW, ROOT, SLUG, TODAY, TRIP_PATH, baseDoc, check, newStore, run } from "./util.ts";

const updateInput = { slug: SLUG, trip: { subtitle: "A new subtitle" } };

describe("runOp", () => {
  it("rejects a write without actor", async () => {
    const store = newStore();
    const before = store.text(TRIP_PATH);
    const res = (await runOp(store, "trip.update", updateInput, { now: NOW, today: TODAY })) as Failure;
    expect(res.ok).toBe(false);
    expect(res.code).toBe("E_ACTOR");
    expect(res.message).toContain("actor");
    expect(store.text(TRIP_PATH)).toBe(before);
  });

  it("rejects an unknown operation and an invalid input", async () => {
    const store = newStore();
    expect(((await runOp(store, "trip.nope", {})) as Failure).code).toBe("E_UNKNOWN_OP");
    const bad = (await run(store, "trip.update", { slug: SLUG, trip: { nights: "many" } })) as Failure;
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe("E_SCHEMA");
  });

  it("writes nothing when the result fails validation", async () => {
    const store = newStore();
    const before = store.text(TRIP_PATH);
    const res = (await run(store, "trip.update", { slug: SLUG, trip: { nights: 99 } })) as Failure;
    expect(res.ok).toBe(false);
    expect(res.code).toBe("E_NIGHTS_SUM");
    expect(res.message).toContain("Nothing was written");
    expect(store.text(TRIP_PATH)).toBe(before);
  });

  it("applies trip.update with a changelog row and an inverse that restores the exact bytes", async () => {
    const { r } = await check("trip.update", updateInput);
    expect(r.changed).toContain("trip:" + SLUG);
    expect(r.replayed).toBeUndefined();
  });

  it("replaying a client_op_id returns the first result and writes nothing", async () => {
    const store = newStore();
    const first = (await run(store, "trip.update", { ...updateInput, client_op_id: "c-1" })) as WriteOk;
    expect(first.ok).toBe(true);
    const text = store.text(TRIP_PATH);
    const again = (await run(store, "trip.update", { slug: SLUG, trip: { subtitle: "something else" }, client_op_id: "c-1" })) as WriteOk;
    expect(again.ok).toBe(true);
    expect(again.replayed).toBe(true);
    expect(again.changelog_seq).toBe(first.changelog_seq);
    expect(store.text(TRIP_PATH)).toBe(text);
    expect(baseDoc().trip.subtitle).not.toBe("A new subtitle");
  });

  it("returns E_STALE with the current rev when expected_rev is old", async () => {
    const store = newStore();
    const rev0 = (await store.rev(TRIP_PATH))!;
    const a = (await run(store, "trip.update", { ...updateInput, expected_rev: rev0 })) as WriteOk;
    expect(a.ok).toBe(true);
    expect(a.rev).not.toBe(rev0);
    const b = (await run(store, "trip.update", { slug: SLUG, trip: { subtitle: "late" }, expected_rev: rev0 })) as Failure;
    expect(b.ok).toBe(false);
    expect(b.code).toBe("E_STALE");
    expect(b.rev).toBe(a.rev);
    const c = (await run(store, "trip.update", { slug: SLUG, trip: { subtitle: "on time" }, expected_rev: a.rev })) as WriteOk;
    expect(c.ok).toBe(true);
  });

  it("trip.create makes a trip with N+1 days and a provisional base, and refuses an existing slug", async () => {
    const d = baseDoc();
    const input = {
      trip: { ...d.trip, slug: "demo-trip", title: "Demo trip", nights: 3, duration_shape: "short-break" },
      profile: d.profile, travellers: d.travellers, trip_tags: d.trip_tags, editions: [],
    };
    const store = new MemoryStore(ROOT);
    const { after } = await check("trip.create", input, { store, tripPath: "data/trips/demo-trip/trip.json" });
    expect(after).toContain(`"id": "demo-trip"`);
    const store2 = new MemoryStore(ROOT);
    expect((await run(store2, "trip.create", input)).ok).toBe(true);
    const doc = JSON.parse(store2.text("data/trips/demo-trip/trip.json")!);
    expect(doc.days.map((x: any) => x.n)).toEqual([1, 2, 3, 4]);
    expect(doc.bases).toHaveLength(1);
    expect(((await run(store2, "trip.create", input)) as Failure).code).toBe("E_EXISTS");
  });

  it("trip.create with zero nights is a one-day trip without bases", async () => {
    const d = baseDoc();
    const store = new MemoryStore(ROOT);
    const res = await run(store, "trip.create", {
      trip: { ...d.trip, slug: "one-day", title: "One day", nights: 0, duration_shape: "day-trip" },
      profile: d.profile, travellers: d.travellers, trip_tags: d.trip_tags,
    });
    expect(res.ok).toBe(true);
    const doc = JSON.parse(store.text("data/trips/one-day/trip.json")!);
    expect(doc.bases).toEqual([]);
    expect(doc.days).toHaveLength(1);
  });

  it("the actor is recorded in the changelog row", async () => {
    const store = newStore();
    await runOp(store, "trip.update", { ...updateInput, actor: { id: "agent:logistics", via: "mcp" } }, { now: NOW, today: TODAY });
    const row = JSON.parse(store.text(TRIP_PATH)!).changelog.at(-1);
    expect(row).toMatchObject({ actor_id: "agent:logistics", actor_via: "mcp", op: "trip.update" });
    expect(ACTOR.id).toBe("u_owner");
  });
});
