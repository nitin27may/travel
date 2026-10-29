// The builder's API contract (trip-builder.md 5, 7, 15.1 ISO-4): request and response schemas, caps, error codes, and the privacy line
// (no party, origin, coordinate of the start or private ref in any answer; the party only in the build body).
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_ERROR_CODES, API_ERROR_STATUS } from "../../src/schema/api/common.ts";
import { PLACE_ROW_KEYS } from "../../src/schema/api/place.ts";
import {
  PLAN_CANDIDATE_ROW_KEYS,
  PLAN_ERROR_CODES,
  PLAN_LIMITS,
  planApiError,
  planBuild,
  planBuildInput,
  planBuildRules,
  planCandidatePage,
  planCandidateRow,
  planCandidatesHttpQuery,
  planCandidatesQuery,
  planHttpStatus,
  planMatrixRules,
  planRegions,
  planRegionsInput,
  planResult,
  type PlanBuildInput,
} from "../../src/schema/api/plan.ts";
import { PRIVATE_KEYS } from "../../src/privacy/detect.ts";
import { sampleDraft } from "./helpers.ts";

const body = (over: Partial<PlanBuildInput> = {}): PlanBuildInput => {
  const d = sampleDraft();
  return {
    where: d.where,
    nights: 2,
    pace: d.pace,
    moves: d.moves,
    month: d.month,
    picks: d.picks.map(({ ref, must }) => ({ ref, must })),
    bases: d.bases,
    edits: d.edits,
    origin: null,
    party: { adults: 2, children: [6, 9], walkKm: null },
    ...over,
  };
};
const okBody = (b: unknown) => planBuildInput.safeParse(b).success;

/** Every key at any depth of a JSON Schema's `properties`. */
function propertyKeys(s: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(s)) s.forEach((x) => propertyKeys(x, out));
  else if (s && typeof s === "object") {
    for (const [k, v] of Object.entries(s)) {
      if (k === "properties" && v && typeof v === "object") for (const p of Object.keys(v)) out.add(p);
      propertyKeys(v, out);
    }
  }
  return out;
}

const RESPONSES = { planRegions, planCandidatePage, planBuild } as const;

describe("every plan schema exports to JSON Schema (OpenAPI, hook X3)", () => {
  for (const [name, s] of Object.entries({ ...RESPONSES, planRegionsInput, planCandidatesQuery, planCandidatesHttpQuery, planBuildInput, planApiError, result: planResult(planBuild) })) {
    it(name, () => expect(() => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow());
  }
});

describe("the privacy line (7)", () => {
  const PARTY_AND_ORIGIN = ["party", "adults", "children", "ages", "walkKm", "youngest", "from", "fromRef", "origin", "start", "home", "lat_home"];
  for (const [name, s] of Object.entries(RESPONSES)) {
    it(`${name} has no key for the party, an origin or a private field`, () => {
      const keys = propertyKeys(z.toJSONSchema(s, { target: "draft-2020-12", io: "output" }));
      expect([...keys].filter((k) => PARTY_AND_ORIGIN.includes(k) || PRIVATE_KEYS.includes(k))).toEqual([]);
    });
  }
  it("the party is accepted in the build body only, as numbers and never with names", () => {
    expect(okBody(body())).toBe(true);
    expect(okBody(body({ party: { adults: 2, children: [6], walkKm: 8, names: ["A"] } as never }))).toBe(false);
    expect(okBody(body({ party: { adults: 0, children: [], walkKm: null } }))).toBe(false);
    expect(okBody(body({ party: { adults: 2, children: [18], walkKm: null } }))).toBe(false);
  });
  it("the candidates query carries a party band at most, never ages, and an origin token never a point", () => {
    const near = { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 180 };
    expect(planCandidatesQuery.safeParse({ ...near, party: "family-6" }).success).toBe(true);
    expect(planCandidatesQuery.safeParse({ ...near, party: "6,9" }).success).toBe(false);
    expect(planCandidatesQuery.safeParse({ ...near, children: [6] }).success).toBe(false);
    expect(planCandidatesHttpQuery.safeParse({ m: "near", from: "hub:toronto", r: "180" }).success).toBe(true);
    expect(planCandidatesHttpQuery.safeParse({ m: "near", from: "43.65,-79.38" }).success).toBe(false);
    expect(planCandidatesHttpQuery.safeParse({ m: "near", from: "loc:home" }).success).toBe(false);
    expect(planCandidatesHttpQuery.safeParse({ a: "2", ages: "6,9" }).success).toBe(false);
  });
  it("a private or dated ref is refused in a build body and in an answer", () => {
    expect(okBody(body({ picks: [{ ref: "legacy/canadian-rockies-sept-2029/sights/bow-lake", must: true }] }))).toBe(false);
    expect(okBody(body({ picks: [{ ref: "loc:abc", must: true }] }))).toBe(false);
    const m = { refs: ["proto:1"], minutes: [[0]], estimated: [] };
    expect(planBuild.shape.matrix.safeParse(m).success).toBe(false);
  });
});

describe("build body: caps and rules", () => {
  it("at least one pick", () => expect(okBody(body({ picks: [] }))).toBe(false));
  it("more than 40 picks or 4 bases is too_large with the cap (a result-size cap), not invalid_input", () => {
    const picks = Array.from({ length: PLAN_LIMITS.picks + 1 }, (_, i) => ({ ref: `place/p${i}`, must: false }));
    const b = body({ picks, edits: [] });
    expect(okBody(b)).toBe(true);
    expect(planBuildRules(b).tooLarge).toEqual([{ path: "$.picks", max: 40 }]);
    const bases = ["a", "b", "c", "d", "e"].map((x) => ({ town: `it-21-${x}`, nights: null, pinned: true }));
    expect(planBuildRules(body({ bases, nights: 13, where: { mode: "trip", cc: "IT", regions: ["it-ne"] } })).tooLarge).toEqual([{ path: "$.bases", max: 4 }]);
  });
  it("shares the draft's input rules", () => {
    expect(planBuildRules(body()).invalid).toEqual([]);
    expect(planBuildRules(body({ edits: [{ day: 1, refs: ["place/elsewhere"], locked: [] }] })).invalid).toContain("$.edits[0].refs: only picks");
    expect(planBuildRules(body({ nights: 12 })).invalid).toContain("$.nights: near mode plans at most 9 nights");
  });
  it("nights are required and capped at 21; a stored kind is refused", () => {
    expect(okBody({ ...body(), nights: null })).toBe(false);
    expect(okBody(body({ nights: 22 }))).toBe(false);
    expect(okBody({ ...body(), kind: "weekend" })).toBe(false);
  });
  it("a draft's inputs map onto a body field by field (one set of sub-schemas)", () => {
    const d = sampleDraft();
    const { schema: _s, id: _i, title: _t, party: _p, seed: _seed, lastBuild: _l, createdAt: _c, updatedAt: _u, picks, nights, ...rest } = d;
    expect(okBody({ ...rest, nights: nights!, picks: picks.map(({ ref, must }) => ({ ref, must })), party: { adults: 1, children: [], walkKm: null } })).toBe(true);
  });
});

describe("candidates: scope and page cap", () => {
  it("trip mode names a country and at least one region; near mode a start and a limit", () => {
    expect(planCandidatesQuery.safeParse({ mode: "trip", cc: "IT", regions: ["it-ne"] }).success).toBe(true);
    expect(planCandidatesQuery.safeParse({ mode: "trip", cc: "IT", regions: [] }).success).toBe(false);
    expect(planCandidatesQuery.safeParse({ mode: "trip", regions: ["it-ne"] }).success).toBe(false);
    expect(planCandidatesQuery.safeParse({ mode: "near", start: { kind: "town", id: "ca-on-whitby" } }).success).toBe(false);
  });
  it("40 rows a page", () => expect(PLAN_LIMITS.candidatePage).toEqual({ default: 40, max: 40 }));
  it("a row is a Places row (the P8 allowlist) plus the builder's ranking fields only", () => {
    const extra = PLAN_CANDIDATE_ROW_KEYS.filter((k) => !(PLACE_ROW_KEYS as readonly string[]).includes(k));
    expect(extra.sort()).toEqual(["driveBasis", "driveMin", "durationBand", "fit", "placeable", "pointBasis", "score", "seasonState", "townId", "visitMin", "why"]);
    expect(PLACE_ROW_KEYS.every((k) => (PLAN_CANDIDATE_ROW_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(Object.keys(planCandidateRow.shape.score.shape)).toEqual(["draw", "fit", "season", "theme", "distance", "quality", "total"]);
  });
});

describe("matrix rules", () => {
  it("square, one row and column per unique ref, estimates inside it", () => {
    expect(planMatrixRules({ refs: ["place/a", "place/b"], minutes: [[0, 20], [21, 0]], estimated: [1] })).toEqual([]);
    expect(planMatrixRules({ refs: ["place/a", "place/b"], minutes: [[0, 20]], estimated: [] })).toContain("$.matrix.minutes: one row and one column per ref");
    expect(planMatrixRules({ refs: ["place/a", "place/a"], minutes: [[0, 0], [0, 0]], estimated: [4] })).toEqual(["$.matrix.refs: each pick once", "$.matrix.estimated: an index inside the matrix"]);
  });
});

describe("errors (respond() conventions plus the kill switch)", () => {
  it("keeps every public code and status, and adds plan_paused 503 and rate_limited 429", () => {
    for (const c of API_ERROR_CODES) expect(planHttpStatus(c)).toBe(API_ERROR_STATUS[c]);
    expect(PLAN_ERROR_CODES.filter((c) => !(API_ERROR_CODES as readonly string[]).includes(c))).toEqual(["plan_paused", "rate_limited"]);
    expect(planHttpStatus("plan_paused")).toBe(503);
    expect(planHttpStatus("rate_limited")).toBe(429);
  });
  it("an error result parses; an unknown code does not", () => {
    const r = planResult(planRegions);
    expect(r.safeParse({ ok: false, error: { code: "plan_paused", message: "Planning is paused." } }).success).toBe(true);
    expect(r.safeParse({ ok: false, error: { code: "teapot", message: "x" } }).success).toBe(false);
  });
});

describe("answers parse", () => {
  it("regions of one country", () => {
    expect(planRegionsInput.safeParse({ cc: "IT" }).success).toBe(true);
    expect(planRegionsInput.safeParse({ cc: "it" }).success).toBe(false);
    const ans = { cc: "IT", name: "Italy", total: 77, ungrouped: [], groups: [{ id: "it-ne", name: "Northern Italy, east", count: 69, offered: true, regions: [{ id: "IT/veneto", name: "Veneto", count: 34 }] }] };
    expect(planRegions.safeParse(ans).success).toBe(true);
    expect(planRegions.safeParse({ ...ans, groups: [{ ...ans.groups[0], children: [] }] }).success).toBe(false);
  });
  it("a build answer: the draft's outputs plus the matrix, without the build time", () => {
    const { builtAt: _b, ...outputs } = sampleDraft().lastBuild!;
    const m = { refs: ["route/lake-of-two-rivers-trail", "place/arrowhead"], minutes: [[0, 30], [31, 0]], estimated: [1, 2] };
    expect(planBuild.safeParse({ ...outputs, matrix: m }).success).toBe(true);
    expect(planBuild.safeParse({ ...outputs, matrix: m, polylines: [] }).success).toBe(false);
  });
});
