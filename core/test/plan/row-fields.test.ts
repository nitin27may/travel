// The account row's derived `source_trip` (EM-M; edit-mode-spec 13.2): a template draft names the trip it follows, a converted copy
// keeps naming the trip it came from through `seed`, and a builder draft that only started from a trip (seed set, never converted)
// stays a plan of its own (null), as before.
import { describe, expect, it } from "vitest";
import { applyOp, type PlanOp } from "../../src/plan/ops.ts";
import { planRowFields } from "../../src/plan/doc.ts";
import { BASE_A } from "./built-helpers.ts";
import { templateDraft } from "./doc-helpers.ts";
import { sampleDraft } from "./helpers.ts";

const AT = "2026-10-27T12:00:00.000Z";

describe("planRowFields source_trip", () => {
  it("a template draft: the trip it follows", () => {
    expect(planRowFields(templateDraft()).source_trip).toBe("dolomites-2027");
  });

  it("a converted copy: the seed, not null", () => {
    const op: PlanOp = {
      kind: "convert",
      id: "o-cv",
      at: AT,
      picks: [{ ref: "place/seceda", slug: "seceda", name: "Seceda", must: false }],
      bases: [{ town: BASE_A, nights: 13, pinned: true }],
      edits: [{ day: 6, refs: ["place/seceda"], locked: [], fromTrip: ["place/seceda"] }],
    };
    const r = applyOp(templateDraft(), op);
    if (!r.ok) throw new Error(r.reason);
    expect(r.doc.template).toBeUndefined();
    expect(r.doc.convertedAt).toBe(AT);
    expect(planRowFields(r.doc)).toMatchObject({ kind: "built", source_trip: "dolomites-2027" });
  });

  it("a builder draft seeded from a trip but never converted: null, as before", () => {
    expect(planRowFields(sampleDraft({ seed: "dolomites-2027" })).source_trip).toBeNull();
    expect(planRowFields(sampleDraft()).source_trip).toBeNull();
  });
});
