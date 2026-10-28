// A removed generated row in the plan document (STEP2-E1B): no schema change. It is an entry of `template.removed` whose item is
// `rule:` and the row's rule key, so the existing operations hold it: removePlace records it, deleteEntry puts it back, reset clears it,
// setNote keys a note on it; applying any of them then its inverse gives the document back byte for byte.
import { describe, expect, it } from "vitest";
import { applyOp, applyOps, type PlanOp } from "../../src/plan/ops.ts";
import { parsePlanDraft, type PlanDraft } from "../../src/schema/plan-draft.ts";
import { templateDraft } from "./doc-helpers.ts";

const T0 = templateDraft();
const must = (d: PlanDraft, op: PlanOp) => {
  const r = applyOp(d, op);
  if (!r.ok) throw new Error(`${op.kind}: ${r.reason} ${r.issues.join("; ")}`);
  return r;
};
const roundTrip = (d: PlanDraft, ops: PlanOp[]): void => {
  let doc = d;
  const inverses: PlanOp[][] = [];
  for (const op of ops) {
    const r = must(doc, op);
    doc = r.doc;
    inverses.push(r.inverse);
  }
  for (const inv of inverses.reverse()) {
    const r = applyOps(doc, inv);
    expect(r.skipped).toEqual([]);
    doc = r.doc;
  }
  expect(JSON.stringify(doc)).toBe(JSON.stringify(d));
};

const KEYS = ["rule:all-car-hire", "rule:all-meal-lunch", "rule:all-checkin", "rule:all-end", "rule:all-rest-at-base-dinner", "rule:A-break-coffee-seceda", "rule:all-booking-slot-maligne-lake-cruise"];

describe("a removed generated row", () => {
  it("is a removePlace of a published day and a `rule:` item; the document still parses", () => {
    const r = must(T0, { kind: "removePlace", id: "o-g1", day: 1, item: "rule:all-car-hire" });
    expect(r.doc.template!.removed).toEqual([{ op: "o-g1", day: 1, item: "rule:all-car-hire" }]);
    expect(parsePlanDraft(r.doc).success).toBe(true);
    expect(r.inverse).toMatchObject([{ kind: "deleteEntry", target: "o-g1" }]);
  });
  it("removing it twice is one entry; Put it back (deleteEntry) and Reset clear it", () => {
    const a = must(T0, { kind: "removePlace", id: "o-g1", day: 3, item: "rule:all-meal-lunch" });
    const again = applyOp(a.doc, { kind: "removePlace", id: "o-g2", day: 3, item: "rule:all-meal-lunch" });
    expect(again.ok && again.doc.template!.removed.length).toBe(1);
    const back = must(a.doc, { kind: "deleteEntry", id: "o-g3", target: "o-g1" });
    expect(back.doc.template!.removed).toEqual([]);
    const reset = must(a.doc, { kind: "reset", id: "o-g4", day: null });
    expect(reset.doc.template!.removed).toEqual([]);
    const day = must(a.doc, { kind: "reset", id: "o-g5", day: 3 });
    expect(day.doc.template!.removed).toEqual([]);
  });
  it("takes a note keyed `<day>:rule:<key>`", () => {
    const n = must(T0, { kind: "setNote", id: "o-n1", key: "2:rule:all-meal-lunch" as never, text: "Picnic by the lake" });
    expect(n.doc.template!.notes).toEqual({ "2:rule:all-meal-lunch": "Picnic by the lake" });
    expect(parsePlanDraft(n.doc).success).toBe(true);
  });
  it("property: any sequence of removals, restores and resets, then their inverses, gives the document back byte for byte", () => {
    for (let seed = 0; seed < 40; seed++) {
      const ops: PlanOp[] = [];
      for (let i = 0; i < 6; i++) {
        const k = (seed * 7 + i * 3) % KEYS.length;
        const day = ((seed + i) % 9) + 1;
        if ((seed + i) % 5 === 4) ops.push({ kind: "reset", id: `o-s${seed}x${i}`, day: (seed + i) % 2 ? null : day });
        else ops.push({ kind: "removePlace", id: `o-s${seed}x${i}`, day, item: KEYS[k]! });
      }
      roundTrip(T0, ops);
    }
  });
});
