// A built plan-draft/1 for the Step 2 tests (STEP2-C1): a six-night trip-mode plan with two bases, fourteen picks, a last build over
// seven days (Days 1 to 4 at the first base, a move on Day 5, Days 5 and 6 at the second, Day 7 home) and one edited day with a lock.
import { PLAN_DRAFT_SCHEMA, type PlanDayOut, type PlanDraft } from "../../src/schema/plan-draft.ts";
import { ID } from "./helpers.ts";

export const BASE_A = "it-bz-ortisei";
export const BASE_B = "it-bl-cortina";
export const REFS = Array.from({ length: 14 }, (_, i) => `place/p${i}`);

const day = (n: number, base: string | null, refs: string[], move = false): PlanDayOut => ({
  day: n,
  base,
  move,
  items: refs.map((ref, i) => ({ ref, slug: ref.slice(6), name: `Place ${ref.slice(7)}`, startMin: 540 + i * 150, visitMin: 90, driveMin: 20, basis: "estimate", locked: false })),
  returnMin: 25,
  warnings: [],
  reasons: [],
});

export function builtDraft(over: Partial<PlanDraft> = {}): PlanDraft {
  return {
    schema: PLAN_DRAFT_SCHEMA,
    id: ID,
    title: null,
    where: { mode: "trip", cc: "IT", regions: ["it-ne"] },
    nights: 6,
    pace: "standard",
    moves: "balanced",
    month: 7,
    party: "device",
    picks: REFS.map((ref, i) => ({ ref, slug: ref.slice(6), name: `Place ${i}`, must: i === 0 })),
    bases: [
      { town: BASE_A, nights: 4, pinned: true },
      { town: BASE_B, nights: 2, pinned: false },
    ],
    edits: [{ day: 2, refs: ["place/p3", "place/p2"], locked: ["place/p3"] }],
    origin: null,
    seed: null,
    lastBuild: {
      engine: "tb-e1.1",
      basis: "mixed",
      bases: [
        { town: BASE_A, name: "Ortisei", nights: 4, pinned: true, picks: 8, reasons: [] },
        { town: BASE_B, name: "Cortina", nights: 2, pinned: false, picks: 4, reasons: [] },
      ],
      days: [
        day(1, BASE_A, ["place/p0", "place/p1"]),
        day(2, BASE_A, ["place/p2", "place/p3"]),
        day(3, BASE_A, ["place/p4", "place/p5"]),
        day(4, BASE_A, ["place/p6", "place/p7"]),
        day(5, BASE_B, ["place/p8", "place/p9"], true),
        day(6, BASE_B, ["place/p10", "place/p11"]),
        day(7, null, []),
      ],
      didNotFit: [
        { ref: "place/p12", code: "TB_TIME", fix: { kind: "add_days", days: 1 }, reasons: [] },
        { ref: "place/p13", code: "TB_CLOSED", fix: null, reasons: [] },
      ],
      spareDays: 0,
      builtAt: "2026-10-27T10:00:00.000Z",
    },
    createdAt: "2026-10-27T09:00:00.000Z",
    updatedAt: "2026-10-27T10:00:00.000Z",
    ...over,
  };
}
