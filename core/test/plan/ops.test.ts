// The edit operations (edit-my-trip.md 4.4; task EM-C): each one, its inverse, idempotent resends, the skip reasons, and two
// properties: applying an operation then its inverse gives the draft back exactly, and rebasing one device's operations onto another
// device's non-overlapping ones keeps both.
import { describe, expect, it } from "vitest";
import { applyOp, applyOps, parsePlanOp, PLAN_OP_KINDS, rebase, touchDraft, type PlanOp } from "../../src/plan/ops.ts";
import { parsePlanDraft, type PlanDraft, type PlanTemplate } from "../../src/schema/plan-draft.ts";
import { int, pick, rng, templateDraft } from "./doc-helpers.ts";
import { sampleDraft } from "./helpers.ts";

const must = (d: PlanDraft, op: PlanOp): { doc: PlanDraft; inverse: PlanOp[]; changed: boolean } => {
  const r = applyOp(d, op);
  if (!r.ok) throw new Error(`${op.kind}: ${r.reason} ${r.issues.join("; ")}`);
  return r;
};
const undo = (d: PlanDraft, inverse: PlanOp[]): PlanDraft => {
  const r = applyOps(d, inverse);
  expect(r.skipped).toEqual([]);
  return r.doc;
};
const T0 = templateDraft();

describe("each operation and its inverse", () => {
  it("covers the set of 4.4 item 1 and the two entry forms", () => {
    expect([...PLAN_OP_KINDS].sort()).toEqual(
      ["setTitle", "setDates", "setParty", "setVariant", "setNote", "setWindow", "addPlace", "removePlace", "moveItem", "insertDay", "dropDay", "addMaybe", "reset", "deleteEntry", "restoreEntry"].sort(),
    );
  });
  it("setTitle, setDates (the month follows the start), setParty (the profile and pace follow the travellers, bug B1)", () => {
    const a = must(T0, { kind: "setTitle", id: "o-t1", title: "Summer in the Dolomites" });
    expect(a.doc.title).toBe("Summer in the Dolomites");
    expect(undo(a.doc, a.inverse)).toEqual(T0);
    const b = must(T0, { kind: "setDates", id: "o-t2", start: "2027-08-14" });
    expect([b.doc.start, b.doc.month]).toEqual(["2027-08-14", 8]);
    expect(undo(b.doc, b.inverse)).toEqual(T0);
    const undated = must(T0, { kind: "setDates", id: "o-t3", start: null });
    expect("start" in undated.doc).toBe(false);
    expect(undo(undated.doc, undated.inverse)).toEqual(T0);
    const adults = { party: "adults", youngest: null, pace: "full", adults: 2, walk: null, split: false } as const;
    const c = must(T0, { kind: "setParty", id: "o-t4", travellers: { adults: 2, children: [] }, profile: adults });
    expect(c.doc).toMatchObject({ party: "trip", travellers: { adults: 2, children: [] }, pace: "full", template: { profile: adults } });
    expect(undo(c.doc, c.inverse)).toEqual(T0);
    const dev = must(T0, { kind: "setParty", id: "o-t5", travellers: null, profile: null });
    expect(dev.doc.party).toBe("device");
    expect("travellers" in dev.doc).toBe(false);
    expect(undo(dev.doc, dev.inverse)).toEqual(T0);
  });
  it("setVariant, setNote, setWindow", () => {
    const a = must(T0, { kind: "setVariant", id: "o-v1", day: 7, variant: "B" });
    expect(a.doc.template!.overrides).toEqual({ "5": "C", "7": "B" });
    expect(undo(a.doc, a.inverse)).toEqual(T0);
    const b = must(T0, { kind: "setVariant", id: "o-v2", day: 5, variant: null });
    expect(b.doc.template!.overrides).toEqual({});
    expect(undo(b.doc, b.inverse)).toEqual(T0);
    const n = must(T0, { kind: "setNote", id: "o-n1", key: "5", text: "Pack bear spray" });
    expect(n.doc.template!.notes).toEqual({ "5": "Pack bear spray" });
    expect(undo(n.doc, n.inverse)).toEqual(T0);
    const w = must(T0, { kind: "setWindow", id: "o-w1", window: "larch-season" });
    expect(undo(w.doc, w.inverse)).toEqual(T0);
  });
  it("addPlace, removePlace (a published stop or an added place), moveItem, addMaybe", () => {
    const a = must(T0, { kind: "addPlace", id: "o-a1", day: 6, ref: "place/moraine-lake", after: "lake-louise-canoe" });
    expect(a.doc.template!.added.at(-1)).toEqual({ op: "o-a1", day: 6, ref: "place/moraine-lake", after: "lake-louise-canoe" });
    expect(undo(a.doc, a.inverse)).toEqual(T0);
    const r = must(T0, { kind: "removePlace", id: "o-r1", day: 5, item: "moose-lake-loop" });
    expect(r.doc.template!.removed).toEqual([{ op: "o-r1", day: 5, item: "moose-lake-loop" }]);
    expect(undo(r.doc, r.inverse)).toEqual(T0);
    const ra = must(T0, { kind: "removePlace", id: "o-r2", added: "o-1" });
    expect(ra.doc.template!.added).toEqual([]);
    expect(undo(ra.doc, ra.inverse)).toEqual(T0);
    const m = must(T0, { kind: "moveItem", id: "o-m1", day: 6, item: "d6-a-2", toDay: 6, after: "d6-a-4" });
    expect(m.doc.template!.moved).toEqual([{ op: "o-m1", day: 6, item: "d6-a-2", toDay: 6, after: "d6-a-4" }]);
    const m2 = must(m.doc, { kind: "moveItem", id: "o-m2", day: 6, item: "d6-a-2", toDay: 7 });
    expect(m2.doc.template!.moved).toEqual([{ op: "o-m2", day: 6, item: "d6-a-2", toDay: 7 }]);
    expect(undo(m2.doc, m2.inverse)).toEqual(m.doc);
    const ma = must(T0, { kind: "moveItem", id: "o-m3", added: "o-1", toDay: 8 });
    expect(ma.doc.template!.added).toEqual([{ op: "o-1", day: 8, ref: "place/pyramid-lake" }]);
    expect(undo(ma.doc, ma.inverse)).toEqual(T0);
    const y = must(T0, { kind: "addMaybe", id: "o-y1", ref: "place/opal-hills" });
    expect(undo(y.doc, y.inverse)).toEqual(T0);
  });
  it("insertDay and dropDay change the nights; dropping an inserted day takes what was on it, and its inverse brings all back", () => {
    const i = must(T0, { kind: "insertDay", id: "o-d1", after: 7 });
    expect(i.doc.nights).toBe(T0.nights! + 1);
    const on = must(i.doc, { kind: "addPlace", id: "o-a9", day: "o-d1", ref: "place/johnston-canyon" });
    const noted = must(on.doc, { kind: "setNote", id: "o-n9", key: "o-d1", text: "Rest day" });
    const drop = must(noted.doc, { kind: "dropDay", id: "o-d2", day: "o-d1" });
    expect(drop.doc.nights).toBe(T0.nights);
    expect(drop.doc.template!.days).toEqual([]);
    expect(drop.doc.template!.added.map((a) => a.op)).toEqual(["o-1"]);
    expect(drop.doc.template!.notes).toEqual({});
    expect(undo(drop.doc, drop.inverse)).toEqual(noted.doc);
    const pub = must(T0, { kind: "dropDay", id: "o-d3", day: 4 });
    expect(pub.doc.nights).toBe(T0.nights! - 1);
    expect(undo(pub.doc, pub.inverse)).toEqual(T0);
    // an inserted day with something on it cannot be removed by its entry alone (the note would point nowhere)
    expect(applyOp(noted.doc, { kind: "deleteEntry", id: "o-x", target: "o-d1" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("reset a day, and reset everything to the published plan; each inverse restores exactly", () => {
    let d: PlanDraft = T0;
    for (const op of [
      { kind: "setVariant", id: "o-1v", day: 6, variant: "B" },
      { kind: "removePlace", id: "o-2r", day: 5, item: "moose-lake-loop" },
      { kind: "moveItem", id: "o-3m", day: 6, item: "a", toDay: 5 },
      { kind: "insertDay", id: "o-4i", after: 2 },
      { kind: "setNote", id: "o-5n", key: "o-4i", text: "Free" },
      { kind: "setNote", id: "o-6n", key: "trip", text: "Book the canoe early" },
      { kind: "dropDay", id: "o-7d", day: 9 },
      { kind: "addMaybe", id: "o-8y", ref: "place/opal-hills" },
      { kind: "setWindow", id: "o-9w", window: "larch-season" },
    ] as PlanOp[]) d = must(d, op).doc;
    const day5 = must(d, { kind: "reset", id: "o-r5", day: 5 });
    const t5 = day5.doc.template!;
    expect(t5.overrides).toEqual({ "6": "B" });
    expect(t5.added).toEqual([]);
    expect(t5.removed).toEqual([]);
    expect(t5.moved).toEqual([]);
    expect(undo(day5.doc, day5.inverse)).toEqual(d);
    const all = must(d, { kind: "reset", id: "o-rr", day: null });
    const ta: PlanTemplate = all.doc.template!;
    expect({ ...ta }).toEqual({ ...ta, overrides: {}, added: [], removed: [], moved: [], days: [], maybe: [], window: null, notes: { trip: "Book the canoe early" } });
    expect(all.doc.nights).toBe(T0.nights);
    expect(undo(all.doc, all.inverse)).toEqual(d);
  });
  it("a resend changes nothing (the operation id is already there); a duplicate place is skipped", () => {
    const a = must(T0, { kind: "addPlace", id: "o-a1", day: 6, ref: "place/moraine-lake" });
    const again = must(a.doc, { kind: "addPlace", id: "o-a1", day: 6, ref: "place/moraine-lake" });
    expect(again.changed).toBe(false);
    expect(again.doc).toBe(a.doc);
    expect(applyOp(a.doc, { kind: "addPlace", id: "o-a2", day: 7, ref: "place/moraine-lake" })).toMatchObject({ ok: false, reason: "duplicate" });
    expect(must(T0, { kind: "setVariant", id: "o-q", day: 5, variant: "C" }).changed).toBe(false);
  });
  it("skip reasons: gone, mode, invalid-op, invalid (a cap)", () => {
    expect(applyOp(T0, { kind: "removePlace", id: "o-z", added: "o-404" })).toMatchObject({ ok: false, reason: "gone" });
    expect(applyOp(sampleDraft(), { kind: "setVariant", id: "o-z", day: 2, variant: "B" })).toMatchObject({ ok: false, reason: "mode" });
    expect(applyOp(T0, { kind: "removePlace", id: "o-z", day: 5, item: "a", added: "o-1" } as PlanOp)).toMatchObject({ ok: false, reason: "invalid-op" });
    expect(applyOp(T0, { kind: "addPlace", id: "bad", day: 5, ref: "place/x" } as PlanOp)).toMatchObject({ ok: false, reason: "invalid-op" });
    let d: PlanDraft = T0;
    for (let i = 0; i < 29; i++) d = must(d, { kind: "addPlace", id: `o-c${i}`, day: 1, ref: `place/c${i}` }).doc;
    expect(applyOp(d, { kind: "addPlace", id: "o-c30", day: 1, ref: "place/c30" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("a built draft takes the title, dates and its own party, nothing else", () => {
    const b = sampleDraft();
    const t = must(b, { kind: "setTitle", id: "o-1", title: "Weekend" });
    expect(undo(t.doc, t.inverse)).toEqual(b);
    const p = must(b, { kind: "setParty", id: "o-2", travellers: { adults: 2, children: [4] } });
    expect(p.doc).toMatchObject({ party: "trip", travellers: { adults: 2, children: [4] } });
    expect(undo(p.doc, p.inverse)).toEqual(b);
    expect(applyOp(b, { kind: "setParty", id: "o-3", travellers: { adults: 2, children: [] }, profile: { party: "adults", youngest: null, pace: "full", adults: 2, walk: null, split: false } })).toMatchObject({ ok: false, reason: "mode" });
  });
  it("never mutates its input, and inverse ids are deterministic (or the caller's)", () => {
    const before = JSON.stringify(T0);
    const a = applyOp(T0, { kind: "removePlace", id: "o-r1", day: 5, item: "x" });
    expect(JSON.stringify(T0)).toBe(before);
    expect(a).toEqual(applyOp(T0, { kind: "removePlace", id: "o-r1", day: 5, item: "x" }));
    const b = applyOp(T0, { kind: "removePlace", id: "o-r1", day: 5, item: "x" }, { newId: () => "o-mine" });
    expect(b.ok && b.inverse[0]!.id).toBe("o-mine");
    for (const op of a.ok ? a.inverse : []) expect(parsePlanOp(op).success).toBe(true);
  });
  it("touchDraft stamps updatedAt, never before createdAt", () => {
    expect(touchDraft(T0, new Date("2026-10-27T12:00:00Z")).updatedAt).toBe("2026-10-27T12:00:00.000Z");
    expect(touchDraft(T0, new Date("2020-01-01T00:00:00Z")).updatedAt).toBe(T0.createdAt);
  });
});

// ---- properties ----

const ITEMS = Array.from({ length: 8 }, (_, i) => `stop-${i}`);
const VARIANTS = ["A", "B", "C", null] as const;

/** A random operation on `d` (day numbers in `days`, places from `refs`), sometimes naming an entry the draft holds. */
function randomOp(r: () => number, d: PlanDraft, n: number, days: readonly number[], refs: readonly string[], all = true): PlanOp {
  const t = d.template!;
  const id = `o-p${n}x${Math.floor(r() * 1e6).toString(36)}`;
  const day = pick(r, days);
  const inserted = t.days.flatMap((x) => (x.kind === "insert" ? [x.op] : []));
  const anyDay = inserted.length && r() < 0.3 ? pick(r, inserted) : day;
  const kinds = all
    ? ["setTitle", "setDates", "setParty", "setVariant", "setNote", "setWindow", "addPlace", "removePlace", "moveItem", "insertDay", "dropDay", "addMaybe", "reset", "deleteEntry"]
    : ["setVariant", "setNote", "addPlace", "removePlace", "moveItem", "insertDay", "dropDay", "addMaybe"];
  switch (pick(r, kinds)) {
    case "setTitle":
      return { kind: "setTitle", id, title: r() < 0.3 ? null : `Trip ${n}` };
    case "setDates":
      return { kind: "setDates", id, start: r() < 0.2 ? null : `2027-0${int(r, 1, 9)}-1${int(r, 0, 9)}` };
    case "setParty":
      return r() < 0.3
        ? { kind: "setParty", id, travellers: { adults: int(r, 1, 3), children: [] }, profile: { party: "adults", youngest: null, pace: pick(r, ["relaxed", "standard", "full"] as const), adults: 2, walk: null, split: false } }
        : { kind: "setParty", id, travellers: { adults: 2, children: [int(r, 0, 17)] }, ...(r() < 0.5 ? { profile: null } : {}) };
    case "setVariant":
      return { kind: "setVariant", id, day, variant: pick(r, VARIANTS) };
    case "setNote":
      return { kind: "setNote", id, key: all && r() < 0.3 ? "trip" : String(anyDay), text: r() < 0.3 ? null : `note ${n}` };
    case "setWindow":
      return { kind: "setWindow", id, window: r() < 0.5 ? null : "larch-season" };
    case "addPlace":
      return { kind: "addPlace", id, day: anyDay, ref: pick(r, refs), ...(r() < 0.5 ? { after: pick(r, ITEMS) } : {}) };
    case "removePlace":
      return t.added.length && r() < 0.5 ? { kind: "removePlace", id, added: pick(r, t.added).op } : { kind: "removePlace", id, day, item: pick(r, ITEMS) };
    case "moveItem":
      return t.added.length && r() < 0.4
        ? { kind: "moveItem", id, added: pick(r, t.added).op, toDay: anyDay }
        : { kind: "moveItem", id, day, item: pick(r, ITEMS), toDay: anyDay, ...(r() < 0.5 ? { after: pick(r, ITEMS) } : {}) };
    case "insertDay":
      return { kind: "insertDay", id, after: day };
    case "dropDay":
      return { kind: "dropDay", id, day: inserted.length && r() < 0.5 ? pick(r, inserted) : day };
    case "addMaybe":
      return { kind: "addMaybe", id, ref: pick(r, refs) };
    case "reset":
      return { kind: "reset", id, day: r() < 0.3 ? null : day };
    default: {
      const ops = [...t.days, ...t.added, ...t.removed, ...t.moved, ...t.maybe].map((e) => e.op);
      return { kind: "deleteEntry", id, target: ops.length ? pick(r, ops) : "o-none" };
    }
  }
}

/** A draft's content with every template list sorted by operation id: equal when two orders of the same operations agree. */
function normal(d: PlanDraft): unknown {
  const t = d.template!;
  const s = <T extends { op: string }>(xs: readonly T[]) => [...xs].sort((a, b) => (a.op < b.op ? -1 : 1));
  return { ...d, template: { ...t, added: s(t.added), removed: s(t.removed), moved: s(t.moved), days: s(t.days), maybe: s(t.maybe) } };
}

describe("properties", () => {
  it("apply then the inverse gives the draft back exactly; the inverse's inverse redoes it", () => {
    const refs = Array.from({ length: 12 }, (_, i) => `place/p${i}`);
    let tested = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const r = rng(seed);
      let d: PlanDraft = templateDraft();
      for (let n = 0; n < 40; n++) {
        const op = randomOp(r, d, n, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], refs);
        const res = applyOp(d, op);
        if (!res.ok || !res.changed) continue;
        tested++;
        const back = applyOps(res.doc, res.inverse);
        expect(back.skipped, `seed ${seed} op ${n} ${op.kind}`).toEqual([]);
        expect(back.doc, `seed ${seed} op ${n} ${op.kind}`).toEqual(d);
        const redo = applyOps(back.doc, back.inverse);
        expect(redo.skipped, `seed ${seed} op ${n} ${op.kind} redo`).toEqual([]);
        expect(redo.doc, `seed ${seed} op ${n} ${op.kind} redo`).toEqual(res.doc);
        expect(parsePlanDraft(res.doc).success).toBe(true);
        d = res.doc;
      }
    }
    expect(tested).toBeGreaterThan(2000);
  });

  it("rebase: two devices' operations on different days and places both survive, whichever reaches the server first", () => {
    const refsA = Array.from({ length: 10 }, (_, i) => `place/a${i}`);
    const refsB = Array.from({ length: 10 }, (_, i) => `place/b${i}`);
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const base = templateDraft({ template: { ...templateDraft().template, added: [] } });
      const make = (days: number[], refs: string[], tag: string): PlanOp[] => {
        let d: PlanDraft = base;
        const ops: PlanOp[] = [];
        for (let n = 0; ops.length < int(r, 1, 6) && n < 40; n++) {
          const op = randomOp(r, d, n, days, refs, false);
          const res = applyOp(d, { ...op, id: `${op.id}${tag}` } as PlanOp);
          if (res.ok && res.changed) {
            ops.push({ ...op, id: `${op.id}${tag}` } as PlanOp);
            d = res.doc;
          }
        }
        return ops;
      };
      const a = make([1, 2, 3, 4, 5, 6], refsA, "a");
      const b = make([7, 8, 9, 10, 11, 12], refsB, "b");
      const server = applyOps(base, a);
      expect(server.skipped, `seed ${seed}`).toEqual([]);
      const rebased = rebase(server.doc, b);
      expect(rebased.skipped, `seed ${seed}`).toEqual([]);
      expect(rebased.applied, `seed ${seed}`).toHaveLength(b.length);
      const other = rebase(applyOps(base, b).doc, a);
      expect(other.skipped, `seed ${seed}`).toEqual([]);
      expect(normal(rebased.doc), `seed ${seed}`).toEqual(normal(other.doc));
      // a resend of the device's own operations changes nothing
      expect(rebase(rebased.doc, b).doc, `seed ${seed}`).toEqual(rebased.doc);
    }
  });

  it("rebase lists what it could not apply: a place removed on another device", () => {
    const server = must(T0, { kind: "removePlace", id: "o-s1", added: "o-1" }).doc;
    const pending: PlanOp[] = [
      { kind: "moveItem", id: "o-p1", added: "o-1", toDay: 6 },
      { kind: "setVariant", id: "o-p2", day: 6, variant: "B" },
    ];
    const r = rebase(server, pending);
    expect(r.skipped).toEqual([{ op: pending[0], reason: "gone" }]);
    expect(r.applied).toEqual([pending[1]]);
    expect(r.doc.template!.overrides).toEqual({ "5": "C", "6": "B" });
  });
});
