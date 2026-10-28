// The built-mode operations and the conversion (STEP2-C1, gap-analysis D2, D9; edit-mode-spec 5, 6, 8, 13): each operation and its
// inverse, the mode fence, resends, the placement rule, and three properties: apply then the inverse is the identity for every new
// operation, `convert` then its inverse gives the template draft back byte for byte, and two devices' non-overlapping built operations
// both survive a rebase in either order.
import { describe, expect, it } from "vitest";
import { applyOp, applyOps, builtDayOf, builtDays, BUILT_OP_KINDS, parsePlanOp, PLAN_OP_KINDS, rebase, SHARED_OP_KINDS, TEMPLATE_OP_KINDS, type PlanOp } from "../../src/plan/ops.ts";
import { PLAN_EDIT } from "../../src/config/plans.ts";
import { emptyPlanTemplate, parsePlanDraft, type PlanDraft } from "../../src/schema/plan-draft.ts";
import { BASE_A, BASE_B, builtDraft, REFS } from "./built-helpers.ts";
import { int, pick, rng, templateDraft } from "./doc-helpers.ts";
import { sampleDraft } from "./helpers.ts";

const must = (d: PlanDraft, op: PlanOp): { doc: PlanDraft; inverse: PlanOp[]; changed: boolean } => {
  const r = applyOp(d, op);
  if (!r.ok) throw new Error(`${op.kind}: ${r.reason} ${r.issues.join("; ")}`);
  return r;
};
/** Content without the sync ledger (undo leaves `opLog` as it is, by design). */
const content = (d: PlanDraft): PlanDraft => {
  const { opLog: _l, ...rest } = d;
  return rest as PlanDraft;
};
/** The inverse applied, as content. */
const undo = (d: PlanDraft, inverse: PlanOp[]): PlanDraft => {
  const r = applyOps(d, inverse);
  expect(r.skipped).toEqual([]);
  return content(r.doc);
};
const B0 = builtDraft();
const day = (d: PlanDraft, n: number) => builtDays(d).find((x) => x.day === n)!;

describe("the operation set (gap-analysis D2) and the mode fence (D9)", () => {
  it("every kind is template-only, built-only or shared, exactly once", () => {
    const all = [...TEMPLATE_OP_KINDS, ...BUILT_OP_KINDS, ...SHARED_OP_KINDS];
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...PLAN_OP_KINDS].sort());
    for (const k of ["addPick", "removePick", "swapItems", "replacePick", "lock", "unlock", "release", "setMust", "moveDay", "setPace", "setNights", "setBase"]) expect(BUILT_OP_KINDS).toContain(k);
    expect(TEMPLATE_OP_KINDS).toContain("convert");
  });
  it("built operations refuse a template draft; template operations refuse a built one; convert is the bridge", () => {
    const T = templateDraft();
    for (const op of [
      { kind: "addPick", id: "o-1", ref: "place/x", slug: "x", name: "X" },
      { kind: "removePick", id: "o-1", ref: "place/x" },
      { kind: "lock", id: "o-1", ref: "place/x" },
      { kind: "setPace", id: "o-1", pace: "full" },
      { kind: "moveDay", id: "o-1", day: 1, to: 2 },
      { kind: "moveItem", id: "o-1", ref: "place/x", toDay: 2 },
      { kind: "toTemplate", id: "o-1", template: emptyPlanTemplate("dolomites-2027"), nights: 13, cc: "IT" },
    ] as PlanOp[]) expect(applyOp(T, op), op.kind).toMatchObject({ ok: false, reason: "mode" });
    for (const op of [
      { kind: "setVariant", id: "o-1", day: 2, variant: "B" },
      { kind: "addPlace", id: "o-1", day: 2, ref: "place/x" },
      { kind: "setRev", id: "o-1", rev: "r2" },
      { kind: "moveItem", id: "o-1", day: 2, item: "x", toDay: 3 },
      { kind: "convert", id: "o-1", at: "2026-10-27T11:00:00.000Z", picks: [], bases: [], edits: [] },
    ] as PlanOp[]) expect(applyOp(B0, op), op.kind).toMatchObject({ ok: false, reason: "mode" });
  });
  it("an operation's own rules: one form of a move, two different stops, another day", () => {
    expect(parsePlanOp({ kind: "moveItem", id: "o-1", ref: "place/x", day: 2, item: "x", toDay: 3 }).success).toBe(false);
    expect(parsePlanOp({ kind: "moveItem", id: "o-1", ref: "place/x", toDay: 3, afterRef: "place/y", first: true }).success).toBe(false);
    expect(parsePlanOp({ kind: "moveItem", id: "o-1", day: 2, item: "x", toDay: 3, first: true }).success).toBe(false);
    expect(parsePlanOp({ kind: "swapItems", id: "o-1", a: "place/x", b: "place/x" }).success).toBe(false);
    expect(parsePlanOp({ kind: "moveDay", id: "o-1", day: 2, to: 2 }).success).toBe(false);
    expect(parsePlanOp({ kind: "addPick", id: "o-1", ref: "place/x", slug: "x", name: "X", afterRef: "place/y" }).success).toBe(false);
    expect(parsePlanOp({ kind: "release", id: "o-1", refs: [] }).success).toBe(false);
  });
});

describe("the placement: edits where a day has them, else the last build", () => {
  it("resolves the fixture", () => {
    expect(builtDays(B0).map((b) => [b.day, b.refs, b.edited])).toEqual([
      [1, ["place/p0", "place/p1"], false],
      [2, ["place/p3", "place/p2"], true],
      [3, ["place/p4", "place/p5"], false],
      [4, ["place/p6", "place/p7"], false],
      [5, ["place/p8", "place/p9"], false],
      [6, ["place/p10", "place/p11"], false],
      [7, [], false],
    ]);
    expect(builtDayOf(B0, "place/p12")).toBeNull();
    expect(day(B0, 2).locked).toEqual(["place/p3"]);
  });
  it("a removed pick leaves the build's day; an edited day wins over the build", () => {
    const d = builtDraft({ picks: B0.picks.filter((p) => p.ref !== "place/p0"), edits: [{ day: 3, refs: ["place/p1", "place/p4"], locked: [] }] });
    expect(day(d, 1).refs).toEqual([]);
    expect(day(d, 3).refs).toEqual(["place/p1", "place/p4"]);
    expect(builtDayOf(d, "place/p5")).toBeNull();
  });
});

describe("each built operation and its inverse", () => {
  it("moveItem: across days after a stop, first, at the end; it is then placed, and a lock travels with it", () => {
    const a = must(B0, { kind: "moveItem", id: "o-m1", ref: "place/p4", toDay: 2, afterRef: "place/p3" });
    expect(day(a.doc, 2)).toMatchObject({ refs: ["place/p3", "place/p4", "place/p2"], placed: ["place/p4"] });
    expect(day(a.doc, 3).refs).toEqual(["place/p5"]);
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    const b = must(B0, { kind: "moveItem", id: "o-m2", ref: "place/p3", toDay: 4, first: true });
    expect(day(b.doc, 4)).toMatchObject({ refs: ["place/p3", "place/p6", "place/p7"], locked: ["place/p3"], placed: ["place/p3"] });
    expect(day(b.doc, 2).locked).toEqual([]);
    expect(undo(b.doc, b.inverse)).toEqual(content(B0));
    const c = must(B0, { kind: "moveItem", id: "o-m3", ref: "place/p12", toDay: 6 });
    expect(day(c.doc, 6).refs).toEqual(["place/p10", "place/p11", "place/p12"]);
    expect(must(c.doc, { kind: "moveItem", id: "o-m3", ref: "place/p12", toDay: 6 }).changed).toBe(false);
  });
  it("moveItem skips: a pick that is gone, a stop to follow that moved, a day past the plan", () => {
    expect(applyOp(B0, { kind: "moveItem", id: "o-1", ref: "place/zz", toDay: 2 })).toMatchObject({ ok: false, reason: "gone" });
    expect(applyOp(B0, { kind: "moveItem", id: "o-1", ref: "place/p4", toDay: 2, afterRef: "place/p9" })).toMatchObject({ ok: false, reason: "gone" });
    expect(applyOp(B0, { kind: "moveItem", id: "o-1", ref: "place/p4", toDay: 8 })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("addPick: added by you, on a day or not; a resend changes nothing; a place already picked is a duplicate", () => {
    const a = must(B0, { kind: "addPick", id: "o-a1", ref: "place/new", slug: "new", name: "New", day: 3, afterRef: "place/p4" });
    expect(a.doc.picks.at(-1)).toEqual({ ref: "place/new", slug: "new", name: "New", must: false, added: true });
    expect(day(a.doc, 3)).toMatchObject({ refs: ["place/p4", "place/new", "place/p5"], placed: ["place/new"] });
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    expect(must(a.doc, { kind: "addPick", id: "o-a1", ref: "place/new", slug: "new", name: "New", day: 3, afterRef: "place/p4" }).changed).toBe(false);
    expect(applyOp(a.doc, { kind: "addPick", id: "o-a2", ref: "place/new", slug: "new", name: "New", day: 5 })).toMatchObject({ ok: false, reason: "duplicate" });
    const free = must(B0, { kind: "addPick", id: "o-a3", ref: "place/free", slug: "free", name: "Free", must: true });
    expect(builtDayOf(free.doc, "place/free")).toBeNull();
    let d = B0;
    for (let i = 0; d.picks.length < 40; i++) d = must(d, { kind: "addPick", id: `o-c${i}`, ref: `place/c${i}`, slug: `c${i}`, name: "C" }).doc;
    expect(applyOp(d, { kind: "addPick", id: "o-c99", ref: "place/c99", slug: "c99", name: "C" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("removePick: any stop (a must, the engine's, a locked one), with its note; removing it again changes nothing", () => {
    const noted = must(B0, { kind: "setNote", id: "o-n", key: "place/p3", text: "Early" }).doc;
    for (const ref of ["place/p0", "place/p3", "place/p12"]) {
      const r = must(noted, { kind: "removePick", id: "o-r", ref });
      expect(r.doc.picks.some((p) => p.ref === ref)).toBe(false);
      expect(builtDays(r.doc).some((b) => b.refs.includes(ref) || b.locked.includes(ref))).toBe(false);
      expect(undo(r.doc, r.inverse)).toEqual(content(noted));
      expect(must(r.doc, { kind: "removePick", id: "o-r", ref }).changed).toBe(false);
    }
    expect(must(noted, { kind: "removePick", id: "o-r", ref: "place/p3" }).doc.notes).toBeUndefined();
  });
  it("swapItems: across days and in one day; both are then placed; locks travel; a resend changes nothing", () => {
    const a = must(B0, { kind: "swapItems", id: "o-s1", a: "place/p3", b: "place/p8" });
    expect(day(a.doc, 2)).toMatchObject({ refs: ["place/p8", "place/p2"], placed: ["place/p8"], locked: [] });
    expect(day(a.doc, 5)).toMatchObject({ refs: ["place/p3", "place/p9"], placed: ["place/p3"], locked: ["place/p3"] });
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    expect(must(a.doc, { kind: "swapItems", id: "o-s1", a: "place/p3", b: "place/p8" }).changed).toBe(false);
    const b = must(B0, { kind: "swapItems", id: "o-s2", a: "place/p0", b: "place/p1" });
    expect(day(b.doc, 1)).toMatchObject({ refs: ["place/p1", "place/p0"] });
    expect(applyOp(B0, { kind: "swapItems", id: "o-s3", a: "place/p0", b: "place/p12" })).toMatchObject({ ok: false, reason: "gone" });
  });
  it("replacePick: the new place takes the day, position and lock; the old note goes", () => {
    const noted = must(B0, { kind: "setNote", id: "o-n", key: "place/p3", text: "Early" }).doc;
    const r = must(noted, { kind: "replacePick", id: "o-x", ref: "place/p3", with: { ref: "place/near", slug: "near", name: "Near" } });
    expect(day(r.doc, 2)).toMatchObject({ refs: ["place/near", "place/p2"], locked: ["place/near"], placed: ["place/near"] });
    expect(r.doc.picks.find((p) => p.ref === "place/near")).toEqual({ ref: "place/near", slug: "near", name: "Near", must: false, added: true });
    expect(r.doc.notes).toBeUndefined();
    expect(undo(r.doc, r.inverse)).toEqual(content(noted));
    expect(must(r.doc, { kind: "replacePick", id: "o-x", ref: "place/p3", with: { ref: "place/near", slug: "near", name: "Near" } }).changed).toBe(false);
    expect(applyOp(B0, { kind: "replacePick", id: "o-y", ref: "place/p3", with: { ref: "place/p4", slug: "p4", name: "P4" } })).toMatchObject({ ok: false, reason: "duplicate" });
  });
  it("lock, unlock, release (Keep on Day n and Let the plan move it) and setMust", () => {
    const l = must(B0, { kind: "lock", id: "o-l", ref: "place/p5" });
    expect(day(l.doc, 3)).toMatchObject({ refs: ["place/p4", "place/p5"], locked: ["place/p5"], edited: true });
    expect(undo(l.doc, l.inverse)).toEqual(content(B0));
    expect(applyOp(B0, { kind: "lock", id: "o-l", ref: "place/p12" })).toMatchObject({ ok: false, reason: "gone" });
    const u = must(B0, { kind: "unlock", id: "o-u", ref: "place/p3" });
    expect(day(u.doc, 2).locked).toEqual([]);
    expect(undo(u.doc, u.inverse)).toEqual(content(B0));
    const moved = must(B0, { kind: "moveItem", id: "o-m", ref: "place/p3", toDay: 3 }).doc;
    const rel = must(moved, { kind: "release", id: "o-rl", refs: ["place/p3", "place/p12"] });
    expect(day(rel.doc, 3)).toMatchObject({ locked: [], placed: [] });
    expect(rel.doc.edits.every((e) => e.placed === undefined)).toBe(true);
    expect(undo(rel.doc, rel.inverse)).toEqual(content(moved));
    const m = must(B0, { kind: "setMust", id: "o-mu", ref: "place/p1", must: true });
    expect(m.doc.picks[1]!.must).toBe(true);
    expect(undo(m.doc, m.inverse)).toEqual(content(B0));
  });
  it("insertDay: an empty day with the base of the day before; later days, notes and the build renumber", () => {
    const noted = must(B0, { kind: "setNote", id: "o-n", key: "5", text: "Move day" }).doc;
    const i = must(noted, { kind: "insertDay", id: "o-i", after: 4 });
    expect(i.doc.nights).toBe(7);
    expect(i.doc.lastBuild!.days.map((b) => [b.day, b.base, b.items.length])).toEqual([
      [1, BASE_A, 2],
      [2, BASE_A, 2],
      [3, BASE_A, 2],
      [4, BASE_A, 2],
      [5, BASE_A, 0],
      [6, BASE_B, 2],
      [7, BASE_B, 2],
      [8, null, 0],
    ]);
    expect(i.doc.notes).toEqual({ "6": "Move day" });
    expect(i.doc.opLog).toEqual(["o-n", "o-i"]);
    expect(must(i.doc, { kind: "insertDay", id: "o-i", after: 4 }).changed).toBe(false);
    expect(undo(i.doc, i.inverse)).toEqual(content(noted));
    expect(applyOp(builtDraft({ nights: 21 }), { kind: "insertDay", id: "o-j", after: 3 })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("dropDay: its stops move to another day (placed) or leave the trip; base nights stay within the plan's", () => {
    const a = must(B0, { kind: "dropDay", id: "o-d", day: 3, to: 2 });
    expect(a.doc.nights).toBe(5);
    expect(day(a.doc, 2)).toMatchObject({ refs: ["place/p3", "place/p2", "place/p4", "place/p5"], placed: ["place/p4", "place/p5"] });
    expect(day(a.doc, 3).refs).toEqual(["place/p6", "place/p7"]);
    expect(a.doc.bases).toEqual([
      { town: BASE_A, nights: 3, pinned: true },
      { town: BASE_B, nights: 2, pinned: false },
    ]);
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    expect(must(a.doc, { kind: "dropDay", id: "o-d", day: 3, to: 2 }).changed).toBe(false);
    const b = must(B0, { kind: "dropDay", id: "o-e", day: 6 });
    expect(b.doc.picks.map((p) => p.ref)).not.toContain("place/p10");
    expect(b.doc.lastBuild!.days.map((x) => x.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(b.doc.bases[1]!.nights).toBe(1);
    expect(undo(b.doc, b.inverse)).toEqual(content(B0));
    expect(applyOp(B0, { kind: "dropDay", id: "o-f", day: 8 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyOp(builtDraft({ nights: 0, bases: [], edits: [], lastBuild: null }), { kind: "dropDay", id: "o-g", day: 1 })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("moveDay: inside one base's run only, and only after a build", () => {
    const a = must(B0, { kind: "moveDay", id: "o-v", day: 1, to: 3 });
    expect(builtDays(a.doc).slice(0, 3).map((b) => b.refs)).toEqual([["place/p3", "place/p2"], ["place/p4", "place/p5"], ["place/p0", "place/p1"]]);
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    expect(must(a.doc, { kind: "moveDay", id: "o-v", day: 1, to: 3 }).changed).toBe(false);
    expect(applyOp(B0, { kind: "moveDay", id: "o-w", day: 4, to: 5 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyOp(B0, { kind: "moveDay", id: "o-w", day: 6, to: 7 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyOp(builtDraft({ lastBuild: null }), { kind: "moveDay", id: "o-w", day: 1, to: 2 })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("setNote (built): the trip, a day, a pick; a template key is refused", () => {
    const a = must(B0, { kind: "setNote", id: "o-n1", key: "place/p2", text: "Tickets" });
    expect(a.doc.notes).toEqual({ "place/p2": "Tickets" });
    expect(undo(a.doc, a.inverse)).toEqual(content(B0));
    expect(applyOp(B0, { kind: "setNote", id: "o-n2", key: "5:moose", text: "x" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyOp(B0, { kind: "setNote", id: "o-n3", key: "place/nope", text: "x" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("the engine inputs: setPace, setNights, setBase, setOrigin, setWhere, setDriveDay; and setBuild", () => {
    for (const op of [
      { kind: "setPace", id: "o-1", pace: "relaxed" },
      { kind: "setBase", id: "o-2", town: BASE_B, base: { town: "it-bl-arabba", nights: 2, pinned: true } },
      { kind: "setBase", id: "o-3", town: BASE_B, base: null },
      { kind: "setBase", id: "o-4", town: "it-tn-canazei", base: { town: "it-tn-canazei", nights: null, pinned: true } },
      { kind: "setOrigin", id: "o-5", origin: { kind: "airport", iata: "VCE" } },
      { kind: "setWhere", id: "o-6", where: { mode: "trip", cc: "IT", regions: ["it-ne", "IT/veneto"] } },
      { kind: "setDriveDay", id: "o-7", driveDayMin: 120 },
      { kind: "setBuild", id: "o-8", lastBuild: null },
      { kind: "setIdentity", id: "o-9", identity: "sky" },
    ] as PlanOp[]) {
      const r = must(B0, op);
      expect(r.changed, op.kind).toBe(true);
      expect(undo(r.doc, r.inverse), op.kind).toEqual(content(B0));
    }
    const short = must(B0, { kind: "setNights", id: "o-n", nights: 3 });
    expect(short.doc.lastBuild!.days.map((b) => b.day)).toEqual([1, 2, 3, 4]);
    expect(short.doc.bases.map((b) => b.nights)).toEqual([3, 0]);
    expect(undo(short.doc, short.inverse)).toEqual(content(B0));
    expect(must(B0, { kind: "setNights", id: "o-n", nights: 8 }).doc.lastBuild).toEqual(B0.lastBuild);
    expect(applyOp(sampleDraft(), { kind: "setNights", id: "o-n", nights: 12 })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("never mutates its input; every inverse parses", () => {
    const before = JSON.stringify(B0);
    const r = applyOp(B0, { kind: "dropDay", id: "o-d", day: 3, to: 2 });
    expect(JSON.stringify(B0)).toBe(before);
    for (const op of r.ok ? r.inverse : []) expect(parsePlanOp(op).success).toBe(true);
  });
});

describe("convert and toTemplate (edit-mode-spec 13.2)", () => {
  const T = templateDraft({
    identity: "blue",
    template: { ...templateDraft().template, notes: { "5": "Long day", "o-1": "Sunset", "6:seceda-ridge": "Cable car" } },
  });
  const AT = "2026-10-27T12:00:00.000Z";
  const payload = (): PlanOp => ({
    kind: "convert",
    id: "o-cv",
    at: AT,
    picks: [
      { ref: "place/seceda", slug: "seceda", name: "Seceda", must: false },
      { ref: "place/lago-di-braies", slug: "lago-di-braies", name: "Lago di Braies", must: false },
      { ref: "place/pyramid-lake", slug: "pyramid-lake", name: "Pyramid Lake", must: false, added: true },
    ],
    bases: [{ town: BASE_A, nights: 13, pinned: true }],
    edits: [
      { day: 5, refs: ["place/pyramid-lake", "place/lago-di-braies"], locked: [], placed: ["place/pyramid-lake"], fromTrip: ["place/lago-di-braies"] },
      { day: 6, refs: ["place/seceda"], locked: [], fromTrip: ["place/seceda"] },
    ],
    notes: { "5": "Long day", "place/pyramid-lake": "Sunset", "place/seceda": "Cable car" },
  });

  it("makes the copy the person's own trip: built mode, our trip as the seed, every stop kept", () => {
    const c = must(T, payload());
    expect(c.doc.template).toBeUndefined();
    expect(c.doc).toMatchObject({ seed: "dolomites-2027", convertedAt: AT, identity: "blue", party: "trip", start: "2027-07-03", lastBuild: null });
    expect(builtDays(c.doc).find((b) => b.day === 6)).toMatchObject({ refs: ["place/seceda"], fromTrip: ["place/seceda"] });
    expect(parsePlanDraft(c.doc).success).toBe(true);
  });
  it("its inverse gives the template draft back byte for byte, and redo gives the converted trip back", () => {
    const c = must(T, payload());
    expect(c.inverse).toHaveLength(1);
    const back = must(c.doc, c.inverse[0]!);
    expect(JSON.stringify(back.doc)).toBe(JSON.stringify(T));
    expect(JSON.stringify(back.doc.template)).toBe(JSON.stringify(T.template));
    expect(JSON.stringify(undo(back.doc, back.inverse))).toBe(JSON.stringify(c.doc));
  });
  it("round trips after built edits too, and a resend of the conversion changes nothing", () => {
    let d = must(T, payload()).doc;
    expect(must(d, payload()).changed).toBe(false);
    for (const op of [
      { kind: "insertDay", id: "o-b1", after: 2 },
      { kind: "setDriveDay", id: "o-b2", driveDayMin: 180 },
      { kind: "setOrigin", id: "o-b3", origin: { kind: "airport", iata: "VCE" } },
    ] as PlanOp[]) d = must(d, op).doc;
    const reset = must(d, { kind: "toTemplate", id: "o-rt", template: emptyPlanTemplate("dolomites-2027", "r9"), nights: 13, cc: "IT" });
    expect(reset.doc).toMatchObject({ seed: null, picks: [], origin: null, lastBuild: null, template: { trip: "dolomites-2027", rev: "r9" } });
    expect(reset.doc.convertedAt).toBeUndefined();
    expect(reset.doc.driveDayMin).toBeUndefined();
    expect(undo(reset.doc, reset.inverse)).toEqual(content((d)));
  });
  it("toTemplate refuses a builder plan that was never a copy, or another trip", () => {
    expect(applyOp(B0, { kind: "toTemplate", id: "o-x", template: emptyPlanTemplate("dolomites-2027"), nights: 6, cc: "IT" })).toMatchObject({ ok: false, reason: "invalid" });
    const c = must(T, payload()).doc;
    expect(applyOp(c, { kind: "toTemplate", id: "o-x", template: emptyPlanTemplate("canadian-rockies-2029"), nights: 9, cc: "CA" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("a copy longer than a built plan can hold does not convert (R2)", () => {
    expect(applyOp(templateDraft({ nights: 30 }), payload())).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("template additions (STEP2-C1)", () => {
  const T = templateDraft();
  it("setRev records the revision of our trip the person has seen", () => {
    const r = must(T, { kind: "setRev", id: "o-r", rev: "2026-11-03" });
    expect(r.doc.template!.rev).toBe("2026-11-03");
    expect(undo(r.doc, r.inverse)).toEqual(content(T));
  });
  it("dropDay with `to`: a published day keeps it on its entry; an inserted day hands its stops over", () => {
    const p = must(T, { kind: "dropDay", id: "o-d", day: 7, to: 6 });
    expect(p.doc.template!.days).toEqual([{ op: "o-d", kind: "drop", day: 7, to: 6 }]);
    expect(undo(p.doc, p.inverse)).toEqual(content(T));
    let d: PlanDraft = must(T, { kind: "insertDay", id: "o-i", after: 4 }).doc;
    d = must(d, { kind: "moveItem", id: "o-1", added: "o-1", toDay: "o-i" }).doc;
    d = must(d, { kind: "setNote", id: "o-n", key: "o-i", text: "Spare" }).doc;
    const drop = must(d, { kind: "dropDay", id: "o-x", day: "o-i", to: 6 });
    expect(drop.doc.template!.added).toEqual([{ op: "o-1", day: 6, ref: "place/pyramid-lake" }]);
    expect(drop.doc.template!.days).toEqual([]);
    expect(drop.doc.template!.notes).toEqual({});
    expect(undo(drop.doc, drop.inverse)).toEqual(content(d));
    expect(applyOp(T, { kind: "dropDay", id: "o-y", day: 7, to: "o-nope" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("a stop note: a published stop by day and schedule id, an added place by its id; removing the place takes its note, and undo returns both", () => {
    const n = must(T, { kind: "setNote", id: "o-n1", key: "5:moose-lake-loop", text: "Bear spray" }).doc;
    const m = must(n, { kind: "setNote", id: "o-n2", key: "o-1", text: "Sunset" }).doc;
    const r = must(m, { kind: "removePlace", id: "o-r", added: "o-1" });
    expect(r.doc.template!.notes).toEqual({ "5:moose-lake-loop": "Bear spray" });
    expect(undo(r.doc, r.inverse)).toEqual(content(m));
    const all = must(m, { kind: "reset", id: "o-z", day: null });
    expect(all.doc.template!.notes).toEqual({ "5:moose-lake-loop": "Bear spray" });
    expect(undo(all.doc, all.inverse)).toEqual(content(m));
    expect(applyOp(T, { kind: "setNote", id: "o-n3", key: "place/p1", text: "x" })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("setIdentity on either mode", () => {
    const r = must(T, { kind: "setIdentity", id: "o-id", identity: "vermillion" });
    expect(r.doc.identity).toBe("vermillion");
    expect(undo(r.doc, r.inverse)).toEqual(content(T));
  });
});

// ---- properties ----

const NEW = Array.from({ length: 8 }, (_, i) => `place/q${i}`);
const BUILT_KINDS = ["moveItem", "addPick", "removePick", "swapItems", "replacePick", "lock", "unlock", "release", "setMust", "setNote", "insertDay", "dropDay", "moveDay", "setPace", "setNights", "setBase", "setDriveDay", "setIdentity", "setTitle", "setDates"] as const;

/** A random built operation on `d`: refs from `refs` and `fresh`, days from `days` (or any day of the plan when `days` is null). */
function randomBuiltOp(r: () => number, d: PlanDraft, n: number, refs: readonly string[], fresh: readonly string[], days: readonly number[] | null, kinds: readonly string[] = BUILT_KINDS): PlanOp {
  const id = `o-b${n}x${Math.floor(r() * 1e6).toString(36)}`;
  const last = (d.nights ?? 0) + 1;
  const dayIn = (): number => (days ? pick(r, days) : int(r, 1, last));
  const ref = (): string => pick(r, refs);
  const placedOn = (k: number): string[] => builtDays(d).find((b) => b.day === k)?.refs.filter((x) => refs.includes(x) || fresh.includes(x)) ?? [];
  switch (pick(r, kinds)) {
    case "moveItem": {
      const to = dayIn();
      const there = placedOn(to);
      const q = r();
      return { kind: "moveItem", id, ref: ref(), toDay: to, ...(q < 0.3 && there.length ? { afterRef: pick(r, there) } : q < 0.5 ? { first: true } : {}) } as PlanOp;
    }
    case "addPick": {
      const f = pick(r, fresh);
      return { kind: "addPick", id, ref: f, slug: f.slice(6), name: "Fresh", ...(r() < 0.6 ? { day: dayIn() } : {}) };
    }
    case "removePick":
      return { kind: "removePick", id, ref: r() < 0.5 ? ref() : pick(r, fresh) };
    case "swapItems": {
      const a = ref();
      const b = pick(r, refs.filter((x) => x !== a));
      return { kind: "swapItems", id, a, b };
    }
    case "replacePick": {
      const f = pick(r, fresh);
      return { kind: "replacePick", id, ref: ref(), with: { ref: f, slug: f.slice(6), name: "Fresh" } };
    }
    case "lock":
      return { kind: "lock", id, ref: ref() };
    case "unlock":
      return { kind: "unlock", id, ref: ref() };
    case "release":
      return { kind: "release", id, refs: [ref(), ref()] };
    case "setMust":
      return { kind: "setMust", id, ref: ref(), must: r() < 0.5 };
    case "setNote":
      return { kind: "setNote", id, key: r() < 0.5 ? String(dayIn()) : ref(), text: r() < 0.3 ? null : `note ${n}` };
    case "insertDay":
      return { kind: "insertDay", id, after: int(r, 0, last) };
    case "dropDay":
      return { kind: "dropDay", id, day: int(r, 1, last), ...(r() < 0.5 ? { to: int(r, 1, last) } : {}) } as PlanOp;
    case "moveDay":
      return { kind: "moveDay", id, day: int(r, 1, last), to: int(r, 1, last) };
    case "setPace":
      return { kind: "setPace", id, pace: pick(r, ["relaxed", "standard", "full"] as const) };
    case "setNights":
      return { kind: "setNights", id, nights: int(r, 2, 9) };
    case "setBase":
      return r() < 0.5
        ? { kind: "setBase", id, town: BASE_B, base: r() < 0.3 ? null : { town: BASE_B, nights: int(r, 0, 2), pinned: r() < 0.5 } }
        : { kind: "setBase", id, town: "it-tn-canazei", base: { town: "it-tn-canazei", nights: null, pinned: true } };
    case "setDriveDay":
      return { kind: "setDriveDay", id, driveDayMin: r() < 0.3 ? null : 60 + 15 * int(r, 0, 20) };
    case "setIdentity":
      return { kind: "setIdentity", id, identity: r() < 0.3 ? null : pick(r, ["blue", "rose", "teal"] as const) };
    case "setTitle":
      return { kind: "setTitle", id, title: r() < 0.3 ? null : `Trip ${n}` };
    default:
      return { kind: "setDates", id, start: r() < 0.2 ? null : `2027-07-1${int(r, 0, 9)}` };
  }
}

/** Content with the pick list sorted by ref: equal when two orders of the same operations agree. */
const normal = (d: PlanDraft): unknown => ({ ...content(d), picks: [...d.picks].sort((a, b) => (a.ref < b.ref ? -1 : 1)) });

describe("properties", () => {
  it("apply then the inverse gives the draft back (content); the inverse's inverse redoes it", () => {
    let tested = 0;
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const r = rng(seed);
      let d: PlanDraft = builtDraft();
      for (let n = 0; n < 40; n++) {
        const op = randomBuiltOp(r, d, n, [...REFS, ...NEW.slice(0, 2)], NEW, null);
        const res = applyOp(d, op);
        if (!res.ok || !res.changed) continue;
        tested++;
        kinds.add(op.kind);
        const at = `seed ${seed} op ${n} ${op.kind}`;
        const back = applyOps(res.doc, res.inverse);
        expect(back.skipped, at).toEqual([]);
        expect(content(back.doc), at).toEqual(content(d));
        const redo = applyOps(back.doc, back.inverse);
        expect(redo.skipped, `${at} redo`).toEqual([]);
        expect(content(redo.doc), `${at} redo`).toEqual(content(res.doc));
        expect(parsePlanDraft(res.doc).success, at).toBe(true);
        d = res.doc;
      }
    }
    expect(tested).toBeGreaterThan(2000);
    expect([...kinds].sort()).toEqual([...BUILT_KINDS].sort());
  });

  it("rebase: two devices' built operations on different days and places both survive, whichever reaches the server first", () => {
    const local = ["moveItem", "addPick", "removePick", "swapItems", "replacePick", "lock", "unlock", "release", "setMust", "setNote"];
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const base = builtDraft();
      const make = (days: number[], refs: string[], fresh: string[], tag: string): PlanOp[] => {
        let d: PlanDraft = base;
        const ops: PlanOp[] = [];
        for (let n = 0; ops.length < int(r, 1, 6) && n < 60; n++) {
          const op = { ...randomBuiltOp(r, d, n, refs, fresh, days, local), id: `o-${tag}${n}x${seed}` } as PlanOp;
          // a device moves and swaps only its own stops, onto its own days
          if (op.kind === "moveItem" || op.kind === "swapItems") {
            const target = op.kind === "moveItem" ? [op.ref!] : [op.a, op.b];
            if (target.some((x) => !days.includes(builtDayOf(d, x) ?? -1))) continue;
          }
          const res = applyOp(d, op);
          if (res.ok && res.changed) {
            ops.push(op);
            d = res.doc;
          }
        }
        return ops;
      };
      const a = make([1, 2, 3], ["place/p0", "place/p1", "place/p2", "place/p3", "place/p4", "place/p5"], ["place/a0", "place/a1", "place/a2"], "a");
      const b = make([5, 6], ["place/p8", "place/p9", "place/p10", "place/p11"], ["place/b0", "place/b1", "place/b2"], "b");
      const server = applyOps(base, a);
      expect(server.skipped, `seed ${seed}`).toEqual([]);
      const rebased = rebase(server.doc, b);
      expect(rebased.skipped, `seed ${seed}`).toEqual([]);
      expect(rebased.applied, `seed ${seed}`).toHaveLength(b.length);
      const other = rebase(applyOps(base, b).doc, a);
      expect(other.skipped, `seed ${seed}`).toEqual([]);
      expect(normal(rebased.doc), `seed ${seed}`).toEqual(normal(other.doc));
      expect(content(rebase(rebased.doc, b).doc), `seed ${seed} resend`).toEqual(content(rebased.doc));
      checked += a.length + b.length;
    }
    expect(checked).toBeGreaterThan(600);
  });

  it("a resend of a day operation or a swap after a lost answer changes nothing (opLog), up to PLAN_EDIT.builtOpLog of them", () => {
    let d: PlanDraft = builtDraft({ nights: 3, lastBuild: null, edits: [], bases: [{ town: BASE_A, nights: 3, pinned: true }] });
    const ops: PlanOp[] = [];
    for (let i = 0; i < PLAN_EDIT.builtOpLog + 5; i++) {
      const op: PlanOp = i % 2 ? { kind: "dropDay", id: `o-z${i}`, day: 1 } : { kind: "insertDay", id: `o-z${i}`, after: 0 };
      ops.push(op);
      d = must(d, op).doc;
    }
    expect(d.opLog).toHaveLength(PLAN_EDIT.builtOpLog);
    const tail = ops.slice(-PLAN_EDIT.builtOpLog);
    expect(rebase(d, tail).doc).toBe(d);
  });
});
