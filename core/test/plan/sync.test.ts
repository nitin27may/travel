// The device outbox and the conflict step (edit-my-trip.md 4.3 to 4.7; task EM-C).
import { describe, expect, it } from "vitest";
import { PLAN_SYNC } from "../../src/config/plans.ts";
import { applyOp, type PlanOp } from "../../src/plan/ops.ts";
import {
  confirm,
  discardDraft,
  emptyPlanOutbox,
  enqueue,
  onConflict,
  parsePlanOutbox,
  pendingCounts,
  pendingFor,
  planRowState,
  readPlanOutbox,
  type PlanOutbox,
  type PlanPendingChange,
} from "../../src/plan/sync.ts";
import { COPY_ID, templateDraft } from "./doc-helpers.ts";

const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";
const AT = "2026-10-27T10:00:00.000Z";
const change = (op: PlanOp, draft = COPY_ID, base: number | null = 3): PlanPendingChange => ({ draft, op, base, at: AT });
const v = (id: string, day = 6): PlanOp => ({ kind: "setVariant", id, day, variant: "B" });
const q = (o: PlanOutbox, c: PlanPendingChange): PlanOutbox => {
  const r = enqueue(o, c);
  if (!r.ok) throw new Error(r.reason);
  return r.outbox;
};

describe("the outbox (4.3)", () => {
  it("queues changes in order per draft, once per operation id", () => {
    let o = emptyPlanOutbox();
    o = q(o, change(v("o-1")));
    o = q(o, change(v("o-2"), OTHER, null));
    o = q(o, change(v("o-3", 7)));
    const again = enqueue(o, change(v("o-1")));
    expect(again).toMatchObject({ ok: true, added: false });
    expect(pendingFor(o, COPY_ID).map((x) => x.id)).toEqual(["o-1", "o-3"]);
    expect(pendingCounts(o)).toEqual([{ draft: COPY_ID, count: 2 }, { draft: OTHER, count: 1 }]);
  });
  it("confirm removes only what the server took; discard drops one draft's changes (tombstone, or sign out and discard)", () => {
    let o = emptyPlanOutbox();
    for (const c of [change(v("o-1")), change(v("o-2"), OTHER), change(v("o-3", 7))]) o = q(o, c);
    expect(pendingFor(confirm(o, COPY_ID, ["o-1"]), COPY_ID).map((x) => x.id)).toEqual(["o-3"]);
    expect(confirm(o, OTHER, ["o-1"]).items).toHaveLength(3);
    const d = discardDraft(o, COPY_ID);
    expect(d.outbox.items.map((x) => x.draft)).toEqual([OTHER]);
    expect(d.discarded).toHaveLength(2);
  });
  it("is capped and strict; reads absent as empty and corrupt, newer and invalid values as errors it never rewrites", () => {
    let o = emptyPlanOutbox();
    for (let i = 0; i < PLAN_SYNC.outboxOps; i++) o = { ...o, items: [...o.items, change(v(`o-${i}`))] };
    expect(parsePlanOutbox(o).success).toBe(true);
    expect(enqueue(o, change(v("o-x")))).toMatchObject({ ok: false, reason: "full" });
    expect(parsePlanOutbox({ ...emptyPlanOutbox(), items: [{ ...change(v("o-1")), note: "x" }] }).success).toBe(false);
    expect(parsePlanOutbox({ ...emptyPlanOutbox(), items: [change(v("o-1")), change(v("o-1"))] })).toMatchObject({ success: false, issues: ["$.items[1].op.id: once per draft"] });
    expect(parsePlanOutbox({ ...emptyPlanOutbox(), items: [change({ kind: "removePlace", id: "o-1", day: 5, item: "a", added: "o-2" })] })).toMatchObject({
      success: false,
      issues: ["$.items[0].op: a published stop (day and item) or an added place, not both"],
    });
    expect(readPlanOutbox(null)).toEqual({ ok: true, outbox: emptyPlanOutbox(), fresh: true });
    expect(readPlanOutbox(JSON.stringify(q(emptyPlanOutbox(), change(v("o-1")))))).toMatchObject({ ok: true, fresh: false });
    expect(readPlanOutbox("{")).toMatchObject({ ok: false, reason: "corrupt" });
    expect(readPlanOutbox(JSON.stringify({ schema: "plan-outbox/2", items: [], more: 1 }))).toMatchObject({ ok: false, reason: "newer" });
    expect(readPlanOutbox(JSON.stringify({ schema: "plan-outbox/1", items: [{ draft: "x" }] }))).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("the conflict step (4.4)", () => {
  it("rebases the pending operations onto the server's document, with its revision as the new base, and gives up after the rounds", () => {
    const server = templateDraft({ template: { ...templateDraft().template, overrides: { "5": "C", "9": "A" } } });
    const pending: PlanOp[] = [v("o-p1", 6), { kind: "removePlace", id: "o-p2", added: "o-404" }];
    const r = onConflict({ revision: 8, doc: server }, pending, 1);
    expect(r.base).toBe(8);
    expect(r.doc.template!.overrides).toEqual({ "5": "C", "6": "B", "9": "A" });
    expect(r.skipped.map((s) => [s.op.id, s.reason])).toEqual([["o-p2", "gone"]]);
    expect(r.giveUp).toBe(false);
    expect(onConflict({ revision: 9, doc: server }, pending, PLAN_SYNC.rebaseRounds).giveUp).toBe(true);
    const own = applyOp(server, v("o-p1", 6));
    expect(own.ok && onConflict({ revision: 9, doc: own.doc }, [v("o-p1", 6)], 1).doc).toEqual(own.ok && own.doc);
  });
});

describe("row states (4.7)", () => {
  const s = { signedIn: true, onDeviceOnly: false, pending: 0, online: true, failed: false, sendingMs: null };
  it("quiet by default, a chip only when it says something", () => {
    expect(planRowState({ ...s, signedIn: false, pending: 2, failed: true })).toBe("quiet");
    expect(planRowState(s)).toBe("quiet");
    expect(planRowState({ ...s, pending: 1, sendingMs: 400 })).toBe("quiet");
    expect(planRowState({ ...s, pending: 1, sendingMs: 1500 })).toBe("syncing");
    expect(planRowState({ ...s, pending: 1, online: false })).toBe("offline");
    expect(planRowState({ ...s, pending: 1, failed: true })).toBe("retry");
    expect(planRowState({ ...s, onDeviceOnly: true, failed: true })).toBe("device");
  });
});
