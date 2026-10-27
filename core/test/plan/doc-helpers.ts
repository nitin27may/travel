// Fixtures for the editable trip document (edit-my-trip EM-C): a device copy, the template draft it maps to, and seeded generators.
import { addCopy, emptyCopies, type CopyInput, type CopyItem } from "../../src/schema/copies.ts";
import { PLAN_DRAFT_SCHEMA, type PlanTemplateDraft } from "../../src/schema/plan-draft.ts";

export const COPY_ID = "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b";
export const COPIED_AT = "2026-10-25T14:02:11.000Z";

export const COPY_INPUT: CopyInput = {
  slug: "dolomites-2027",
  title: "Dolomites",
  days: 14,
  cc: "IT",
  photo: "/img/trips/dolomites/cover-400.webp",
  start: "2027-07-03",
  adults: 2,
  children: [6],
  profile: { party: "family", youngest: 6, pace: "standard", adults: 2, walk: null, split: false },
  overrides: { "5": "C" },
  added: [{ day: 5, placeSlug: "pyramid-lake" }],
};

/** A parsed copy made through the device mutation, so it is exactly what the copy sheet stores. */
export function copyOf(over: Partial<CopyInput> = {}, id = COPY_ID): CopyItem {
  const r = addCopy(emptyCopies(), { ...COPY_INPUT, ...over }, { now: new Date(COPIED_AT), newId: () => id });
  if (!r.ok) throw new Error(`copy fixture: ${JSON.stringify(r)}`);
  return r.item;
}

/** The template draft `COPY_INPUT` maps to. */
export function templateDraft(over: Partial<PlanTemplateDraft> = {}): PlanTemplateDraft {
  return {
    schema: PLAN_DRAFT_SCHEMA,
    id: COPY_ID,
    title: null,
    where: { mode: "trip", cc: "IT", regions: [] },
    nights: 13,
    pace: "standard",
    moves: "balanced",
    month: 7,
    party: "trip",
    picks: [],
    bases: [],
    edits: [],
    origin: null,
    seed: null,
    lastBuild: null,
    createdAt: COPIED_AT,
    updatedAt: COPIED_AT,
    template: {
      trip: "dolomites-2027",
      rev: null,
      profile: { party: "family", youngest: 6, pace: "standard", adults: 2, walk: null, split: false },
      window: null,
      overrides: { "5": "C" },
      added: [{ op: "o-1", day: 5, ref: "place/pyramid-lake" }],
      removed: [],
      moved: [],
      days: [],
      notes: {},
      maybe: [],
    },
    start: "2027-07-03",
    travellers: { adults: 2, children: [6] },
    ...over,
  };
}

/** A seeded generator (mulberry32): a failing property names its seed and reruns the same. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
export const int = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
