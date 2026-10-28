// plan-draft/1's Step 2 keys (STEP2-C1, gap-analysis D1; absorbs TB-C2): every key is optional, so the documents and fixtures written
// before it parse byte for byte; each new key has its rule; the shape still exports to JSON Schema; the identity keys match the UI's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PLAN_DOC_LIMITS, PLAN_EDIT } from "../../src/config/plans.ts";
import { parsePlanDraft, PLAN_IDENTITY_KEYS, planDraft, type PlanDraft } from "../../src/schema/plan-draft.ts";
import { builtDraft } from "./built-helpers.ts";
import { templateDraft } from "./doc-helpers.ts";
import { sampleDraft } from "./helpers.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const issues = (d: unknown): string[] => {
  const r = parsePlanDraft(d);
  return r.success ? [] : r.issues;
};
const ok = (d: unknown): boolean => parsePlanDraft(d).success;
const T = templateDraft();
const withT = (t: Partial<NonNullable<PlanDraft["template"]>>) => templateDraft({ template: { ...T.template, ...t } });

describe("documents written before Step 2 read exactly as before", () => {
  it("the builder fixture, the copy fixture and the built fixture parse byte for byte", () => {
    for (const d of [sampleDraft(), templateDraft(), builtDraft()]) {
      const r = parsePlanDraft(d);
      expect(r.success).toBe(true);
      expect(r.success && JSON.stringify(r.data)).toBe(JSON.stringify(d));
    }
  });
  it("a draft with every Step 2 key also parses byte for byte", () => {
    const b = builtDraft({
      where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 180, regions: ["CA/ON", "ca-on-cottage"] },
      nights: 6,
      picks: builtDraft().picks.map((p, i) => (i === 13 ? { ...p, added: true as const } : p)),
      edits: [{ day: 2, refs: ["place/p3", "place/p2"], locked: ["place/p3"], placed: ["place/p2"], fromTrip: ["place/p3"] }],
      seed: "dolomites-2027",
      identity: "teal",
      driveDayMin: 150,
      notes: { trip: "Book the cable cars", "3": "Rest day", "place/p4": "Go early" },
      convertedAt: "2026-10-27T11:00:00.000Z",
      opLog: ["o-x1", "o-x2"],
    });
    const r = parsePlanDraft(b);
    expect(r.success ? [] : r.issues).toEqual([]);
    expect(r.success && JSON.stringify(r.data)).toBe(JSON.stringify(b));
  });
  it("still exports to JSON Schema (the subset rule)", () => {
    expect(() => z.toJSONSchema(planDraft, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow();
  });
});

describe("the Step 2 keys and their rules", () => {
  it("placed and from-our-trip refs are in their day, once, and never both", () => {
    const e = (x: object) => builtDraft({ edits: [{ day: 2, refs: ["place/p3", "place/p2"], locked: [], ...x }] });
    expect(ok(e({ placed: ["place/p2"], fromTrip: ["place/p3"] }))).toBe(true);
    expect(issues(e({ placed: ["place/p9"] }))).toContain("$.edits[0].placed: a kept place is in its day");
    expect(issues(e({ fromTrip: ["place/p2", "place/p2"] }))).toContain("$.edits[0].fromTrip: each place once");
    expect(issues(e({ placed: ["place/p2"], fromTrip: ["place/p2"] }))).toContain("$.edits[0]: a place is placed by the person or from our trip, not both");
    expect(issues(builtDraft({ edits: [{ day: 2, refs: ["place/p2", "place/p2"], locked: [] }] }))).toContain("$.edits[0].refs: each place once");
  });
  it("near mode may name regions, each once", () => {
    const near = (regions?: string[]) => sampleDraft({ where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 180, ...(regions ? { regions } : {}) } });
    expect(ok(near())).toBe(true);
    expect(ok(near(["CA/ON", "us-ny"]))).toBe(true);
    expect(issues(near(["CA/ON", "CA/ON"]))).toContain("$.where.regions: each region once");
    expect(ok(near(["Toronto"]))).toBe(false);
  });
  it("identity is one of the trip identity keys, the same list the UI draws (foundation tokens 4)", () => {
    for (const k of PLAN_IDENTITY_KEYS) expect(ok(builtDraft({ identity: k }))).toBe(true);
    expect(ok({ ...builtDraft(), identity: "green" })).toBe(false);
    const chip = readFileSync(path.join(ROOT, "web/components/ui/Chip.tsx"), "utf8");
    const m = /IDENTITY_KEYS = \[([^\]]+)\]/.exec(chip);
    expect(m, "IDENTITY_KEYS in Chip.tsx").not.toBeNull();
    expect(m![1]!.split(",").map((s) => s.trim().replace(/['"]/g, ""))).toEqual([...PLAN_IDENTITY_KEYS]);
  });
  it("driveDayMin is 60 to 480 in steps of 15, built mode only", () => {
    expect(ok(builtDraft({ driveDayMin: 60 }))).toBe(true);
    for (const bad of [45, 485, 100]) expect(ok(builtDraft({ driveDayMin: bad })), String(bad)).toBe(false);
    expect(issues(templateDraft({ driveDayMin: 120 }))).toContain("$.driveDayMin: an engine input, built mode only (R1)");
  });
  it("built notes name the trip, a day of the plan or a pick, within the character cap", () => {
    expect(ok(builtDraft({ notes: { trip: "x", "7": "y", "place/p0": "z" } }))).toBe(true);
    expect(issues(builtDraft({ notes: { "8": "past the last day" } }))).toContain("$.notes: a note names a day or a pick of this draft");
    expect(issues(builtDraft({ notes: { "place/zzz": "not a pick" } }))).toContain("$.notes: a note names a day or a pick of this draft");
    expect(ok(builtDraft({ notes: { "5:moose-lake-loop": "a template key" } }))).toBe(false);
    expect(ok(builtDraft({ notes: { "o-abc": "an inserted day key" } }))).toBe(false);
    expect(issues(builtDraft({ notes: { trip: "a".repeat(PLAN_DOC_LIMITS.noteChars), "1": "b" } }))).toContain(`$.notes: at most ${PLAN_DOC_LIMITS.noteChars} characters in all`);
    const r = issues(builtDraft({ notes: { "Moraine Lake": "call Asha on 555-0100" } }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.join(" ")).not.toMatch(/Moraine|Asha|555/);
  });
  it("a template draft keeps its notes in the block, and is never converted", () => {
    expect(issues(templateDraft({ notes: { trip: "x" } }))).toContain("$.notes: a template draft keeps its notes in template.notes");
    expect(issues(templateDraft({ convertedAt: "2026-10-27T11:00:00.000Z" }))).toContain("$.convertedAt: only on a converted trip (built mode)");
    expect(issues(builtDraft({ convertedAt: "2026-10-27T11:00:00.000Z" }))).toContain("$.seed: a converted trip names our trip");
    expect(ok(templateDraft({ identity: "rose" }))).toBe(true);
    expect(issues(templateDraft({ opLog: ["o-1x"] }))).toContain("$.opLog: a template draft keeps its operation ids in its entries");
    expect(issues(builtDraft({ opLog: ["o-1x", "o-1x"] }))).toContain("$.opLog: each operation id once");
  });
  it("a pick the person added is marked, and only with true", () => {
    const p = (added: unknown) => ({ ...builtDraft(), picks: builtDraft().picks.map((x, i) => (i === 0 ? { ...x, added } : x)) });
    expect(ok(p(true))).toBe(true);
    expect(ok(p(false))).toBe(false);
  });
  it("template stop notes: a published stop by day and schedule id, an added place by its operation id", () => {
    expect(ok(withT({ notes: { "5:moose-lake-loop": "Bear spray", "o-1": "Sunset", "5": "Long day" } }))).toBe(true);
    expect(issues(withT({ notes: { "o-404": "x" } }))).toContain("$.template.notes: a note's inserted day exists");
    expect(ok(withT({ notes: { "5:Moraine Lake": "a name, not an id" } }))).toBe(false);
    expect(issues(withT({ notes: { "5:legacy/quebec-sept-2026/x": "dated" } }))).toContain("$.template.notes: a stop note names a schedule id");
    expect(ok(withT({ notes: { "place/p1": "a built key" } }))).toBe(false);
  });
  it("a dropped day's stops may move to another day that exists and is not dropped", () => {
    expect(ok(withT({ days: [{ op: "o-d", kind: "drop", day: 7, to: 6 }] }))).toBe(true);
    expect(ok(withT({ days: [{ op: "o-i", kind: "insert", after: 3 }, { op: "o-d", kind: "drop", day: 7, to: "o-i" }] }))).toBe(true);
    expect(issues(withT({ days: [{ op: "o-d", kind: "drop", day: 7, to: "o-nope" }] }))).toContain("$.template.days[0].to: an inserted day of this draft");
    expect(issues(withT({ days: [{ op: "o-d", kind: "drop", day: 7, to: 7 }] }))).toContain("$.template.days[0].to: another day");
    expect(issues(withT({ days: [{ op: "o-d", kind: "drop", day: 7, to: 6 }, { op: "o-e", kind: "drop", day: 6 }] }))).toContain("$.template.days[0].to: a day that is not dropped");
  });
});

describe("PLAN_EDIT (edit-mode-spec 18)", () => {
  it("holds the undo depth and the reset confirm threshold", () => {
    expect(PLAN_EDIT).toEqual({ undoSteps: 50, resetConfirmOver: 3, builtOpLog: 64 });
  });
});
