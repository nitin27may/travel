// A valid plan-draft/1 for the plan tests: a near-mode weekend with two picks, one base, a locked edit and a last build.
import { PLAN_DRAFT_SCHEMA, type PlanDraft } from "../../src/schema/plan-draft.ts";

export const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
export const ID2 = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";

export function sampleDraft(over: Partial<PlanDraft> = {}): PlanDraft {
  return {
    schema: PLAN_DRAFT_SCHEMA,
    id: ID,
    title: null,
    where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 180 },
    nights: 2,
    pace: "standard",
    moves: "balanced",
    month: 7,
    party: "device",
    picks: [
      { ref: "route/lake-of-two-rivers-trail", slug: "lake-of-two-rivers-trail", name: "Lake of Two Rivers trail", must: true },
      { ref: "place/arrowhead", slug: "arrowhead", name: "Arrowhead", must: false },
    ],
    bases: [{ town: "ca-on-huntsville", nights: 2, pinned: false }],
    edits: [{ day: 2, refs: ["place/arrowhead"], locked: ["place/arrowhead"] }],
    origin: null,
    seed: null,
    lastBuild: {
      engine: "tb-e1.1",
      basis: "estimate",
      bases: [{ town: "ca-on-huntsville", name: "Huntsville", nights: 2, pinned: false, picks: 2, reasons: [{ code: "covers_picks", values: { n: 2, avgMin: 35 }, text: "Closest town to 2 of your picks (avg 35 min ≈)" }] }],
      days: [
        {
          day: 1,
          base: "ca-on-huntsville",
          move: false,
          items: [{ ref: "route/lake-of-two-rivers-trail", slug: "lake-of-two-rivers-trail", name: "Lake of Two Rivers trail", startMin: 600, visitMin: 120, driveMin: 45, basis: "estimate", locked: false }],
          returnMin: 45,
          warnings: ["W_DAYLIGHT"],
          reasons: [],
        },
      ],
      didNotFit: [{ ref: "place/arrowhead", code: "TB_TIME", fix: { kind: "add_days", days: 1 }, reasons: [] }],
      spareDays: 0,
      builtAt: "2026-10-27T10:00:00.000Z",
    },
    createdAt: "2026-10-27T09:00:00.000Z",
    updatedAt: "2026-10-27T10:00:00.000Z",
    ...over,
  };
}

