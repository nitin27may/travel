// plan-draft/1 (trip-builder.md 2.4, 15.1 ISO-3, ISO-6; trip-kinds TK1): the envelope accepts a real draft and refuses what a draft must
// never hold (a kind, a coordinate, the party, a private or dated ref), the caps hold, the reader leaves bad and newer values untouched,
// and nothing outside the plan-draft module calls `.parse` on the raw schemas.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ACTIVE_BUDGET_MIN } from "../../src/schedule/rules.ts";
import {
  emptyPlanDrafts,
  originOfToken,
  originToken,
  parsePlanDraft,
  parsePlanDrafts,
  PLAN_DRAFT_SCHEMA,
  PLAN_DRAFTS_SCHEMA,
  PLAN_KINDS,
  PLAN_LIMITS,
  PLAN_PACES,
  planDraft,
  planDrafts,
  planKindOf,
  type PlanDraft,
  readPlanDrafts,
} from "../../src/schema/plan-draft.ts";
import { ID2, sampleDraft } from "./helpers.ts";

const ok = (d: unknown) => parsePlanDraft(d).success;
const issues = (d: unknown) => {
  const r = parsePlanDraft(d);
  return r.success ? [] : r.issues;
};

describe("plan-draft/1 accepts", () => {
  it("a near-mode draft with picks, a base, a locked edit and a last build", () => {
    expect(issues(sampleDraft())).toEqual([]);
  });
  it("a trip-mode draft before step 2 (no regions, no nights yet) and after it", () => {
    expect(ok(sampleDraft({ where: { mode: "trip", cc: "IT", regions: [] }, nights: null, bases: [], edits: [], lastBuild: null }))).toBe(true);
    expect(ok(sampleDraft({ where: { mode: "trip", cc: "IT", regions: ["it-ne", "IT/veneto"] }, nights: 13, origin: { kind: "airport", iata: "YYZ" }, seed: "dolomites-2027" }))).toBe(true);
  });
  it("a pinned base with no nights yet (pin at any step, TB2)", () => {
    expect(ok(sampleDraft({ bases: [{ town: "ca-on-huntsville", nights: null, pinned: true }] }))).toBe(true);
  });
  it("every origin kind, as a reference only", () => {
    for (const start of [{ kind: "hub", id: "toronto" }, { kind: "airport", iata: "YYZ" }, { kind: "town", id: "ca-on-whitby" }] as const) {
      expect(ok(sampleDraft({ where: { mode: "near", start, driveLimitMin: 120 } })), start.kind).toBe(true);
    }
  });
  it("exports to JSON Schema (the subset rule: no refine or transform)", () => {
    for (const s of [planDraft, planDrafts]) expect(() => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow();
  });
});

describe("plan-draft/1 refuses what a draft never holds", () => {
  it("a stored kind: the kind is derived from the nights (TK1)", () => {
    expect(ok({ ...sampleDraft(), kind: "weekend" })).toBe(false);
  });
  it("a coordinate anywhere: an origin is a reference, never a point", () => {
    expect(ok(sampleDraft({ where: { mode: "near", start: { kind: "point", lat: 43.6, lon: -79.4 } as never, driveLimitMin: 180 } }))).toBe(false);
    expect(ok(sampleDraft({ origin: { kind: "town", id: "ca-on-whitby", lat: 43.9, lon: -78.9 } as never }))).toBe(false);
    expect(ok({ ...sampleDraft(), lat: 43.6, lon: -79.4 })).toBe(false);
    expect(ok(sampleDraft({ where: { mode: "near", start: { kind: "town", id: "43.65,-79.38" } as never, driveLimitMin: 180 } }))).toBe(false);
  });
  it("the party: only its source is named, never a copy (2.4)", () => {
    expect(ok({ ...sampleDraft(), party: { adults: 2, children: [6, 9] } })).toBe(false);
    expect(ok({ ...sampleDraft(), adults: 2 })).toBe(false);
    expect(ok({ ...sampleDraft(), travellers: { adults: 2, children: [] } })).toBe(false);
  });
  it("a private or dated ref in a pick, an edit or a build (public-ref-aliases 5.2)", () => {
    const pick = (ref: string, slug = "x") => sampleDraft({ picks: [{ ref, slug, name: "X", must: false }], edits: [], lastBuild: null });
    for (const bad of ["loc:abc", "place/loc:abc", "proto:12", "legacy/canadian-rockies-sept-2029/sights/bow-lake", "offer/legacy/dolomites-july-2027/x#ticket", "Lake Louise", "place/a\nb"]) {
      expect(ok(pick(bad)), bad).toBe(false);
    }
    for (const good of ["legacy/canadian-rockies-2029/sights/bow-lake", "route/johnston-canyon", "place/lake-louise", "trip/algonquin/sight:ragged falls"]) {
      expect(ok(pick(good)), good).toBe(true);
    }
    expect(ok(pick("place/x", "quebec-sept-2026"))).toBe(false);
    expect(ok(sampleDraft({ seed: "canadian-rockies-sept-2029" }))).toBe(false);
  });
  it("an unknown key anywhere (strict: a newer field is never dropped on a rewrite)", () => {
    expect(ok({ ...sampleDraft(), extra: 1 })).toBe(false);
    const d = sampleDraft();
    expect(ok({ ...d, picks: [{ ...d.picks[0]!, note: "x" }, d.picks[1]] })).toBe(false);
  });
});

describe("plan-draft/1 caps and cross-field rules", () => {
  const picks = (n: number) => Array.from({ length: n }, (_, i) => ({ ref: `place/p${i}`, slug: `p${i}`, name: `P ${i}`, must: false }));
  it("40 picks, 4 bases, 21 nights; one more of each is refused", () => {
    const base = { edits: [], lastBuild: null, where: { mode: "trip" as const, cc: "IT", regions: ["it-ne"] } };
    expect(ok(sampleDraft({ ...base, picks: picks(PLAN_LIMITS.picks), bases: [] }))).toBe(true);
    expect(ok(sampleDraft({ ...base, picks: picks(PLAN_LIMITS.picks + 1), bases: [] }))).toBe(false);
    const towns = ["it-21-ortisei", "it-25-cortina", "it-21-bolzano", "it-21-brunico", "it-21-merano"].map((town) => ({ town, nights: 2, pinned: false }));
    expect(ok(sampleDraft({ ...base, nights: 21, bases: towns.slice(0, 4) }))).toBe(true);
    expect(ok(sampleDraft({ ...base, nights: 21, bases: towns }))).toBe(false);
    expect(ok(sampleDraft({ ...base, nights: 22, bases: [] }))).toBe(false);
  });
  it("near mode: at most 9 nights and a drive limit of 30 to 480 minutes in 15-minute steps", () => {
    const near = (nights: number, driveLimitMin: number) => sampleDraft({ nights, bases: [], edits: [], lastBuild: null, where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin } });
    expect(ok(near(9, 480))).toBe(true);
    expect(ok(near(10, 240))).toBe(false);
    expect(ok(near(2, 500))).toBe(false);
    expect(ok(near(2, 100))).toBe(false);
    expect(ok(near(2, 15))).toBe(false);
  });
  it("regions belong to the draft's country, once each", () => {
    expect(issues(sampleDraft({ where: { mode: "trip", cc: "IT", regions: ["CA/ON"] }, lastBuild: null }))).toContain("$.where.regions[0]: a region of the draft's country");
    expect(issues(sampleDraft({ where: { mode: "trip", cc: "IT", regions: ["it-ne", "it-ne"] }, lastBuild: null }))).toContain("$.where.regions: each region once");
  });
  it("picks once each; edits name picks; locks sit in their day; a place on one day; days inside the plan", () => {
    const d = sampleDraft();
    expect(issues({ ...d, picks: [d.picks[0], d.picks[0]] })).toContain("$.picks: each place once");
    expect(issues({ ...d, edits: [{ day: 1, refs: ["place/elsewhere"], locked: [] }] })).toContain("$.edits[0].refs: only picks");
    expect(issues({ ...d, edits: [{ day: 1, refs: [], locked: ["place/arrowhead"] }] })).toContain("$.edits[0].locked: a locked place is in its day");
    expect(issues({ ...d, edits: [{ day: 1, refs: ["place/arrowhead"], locked: [] }, { day: 2, refs: ["place/arrowhead"], locked: [] }] })).toContain("$.edits: a place is on one day at most");
    expect(issues({ ...d, edits: [{ day: 4, refs: [], locked: [] }] })).toContain("$.edits[0].day: a day of the plan");
  });
  it("bases: a day trip has none; their nights add up to at most the plan's", () => {
    expect(issues(sampleDraft({ nights: 0, edits: [], lastBuild: null }))).toContain("$.bases: a day trip has no base");
    expect(issues(sampleDraft({ bases: [{ town: "ca-on-huntsville", nights: 3, pinned: false }] }))).toContain("$.bases: base nights add up to at most the plan's nights");
  });
  it("a draft over 16 KB is refused, and the issue names no value", () => {
    const big = sampleDraft({ title: "T", lastBuild: { ...sampleDraft().lastBuild!, days: Array.from({ length: 3 }, (_, i) => ({ ...sampleDraft().lastBuild!.days[0]!, day: i + 1, items: Array.from({ length: 40 }, () => sampleDraft().lastBuild!.days[0]!.items[0]!) })) } });
    const r = issues(big);
    expect(r).toContain(`$: a draft is at most ${PLAN_LIMITS.draftBytes} bytes`);
    expect(r.join(" ")).not.toMatch(/Lake of Two Rivers|huntsville/i);
  });
});

describe("the device list plan-drafts/1", () => {
  it("holds at most 10 drafts with their own ids", () => {
    const ten = Array.from({ length: 10 }, (_, i) => sampleDraft({ id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000` }));
    expect(parsePlanDrafts({ schema: PLAN_DRAFTS_SCHEMA, items: ten }).success).toBe(true);
    expect(parsePlanDrafts({ schema: PLAN_DRAFTS_SCHEMA, items: [...ten, sampleDraft({ id: ID2 })] }).success).toBe(false);
    const dup = parsePlanDrafts({ schema: PLAN_DRAFTS_SCHEMA, items: [sampleDraft(), sampleDraft()] });
    expect(dup.success ? [] : dup.issues).toContain("$.items: each draft has its own id");
  });
  it("reads absent as empty, and corrupt, newer and invalid values as errors it never rewrites", () => {
    expect(readPlanDrafts(null)).toEqual({ ok: true, list: emptyPlanDrafts(), fresh: true });
    expect(readPlanDrafts(JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items: [sampleDraft()] })).ok).toBe(true);
    expect(readPlanDrafts("{not json")).toMatchObject({ ok: false, reason: "corrupt" });
    expect(readPlanDrafts(JSON.stringify({ schema: "plan-drafts/2", items: [] }))).toMatchObject({ ok: false, reason: "newer" });
    expect(readPlanDrafts(JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items: [{ ...sampleDraft(), schema: "plan-draft/2", more: 1 }] }))).toMatchObject({ ok: false, reason: "newer" });
    expect(readPlanDrafts(JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items: [{ ...sampleDraft(), kind: "weekend" }] }))).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("kinds are derived from nights (trip-kinds TK1)", () => {
  it("bands: day 0, weekend 1-2, long weekend 3-4, week 5-9, holiday 10-21", () => {
    const want: Record<number, string> = { 0: "day", 1: "weekend", 2: "weekend", 3: "long_weekend", 4: "long_weekend", 5: "week", 9: "week", 10: "holiday", 21: "holiday" };
    for (const [n, k] of Object.entries(want)) expect(planKindOf(Number(n)), n).toBe(k);
  });
  it("no kind without valid nights", () => {
    for (const n of [null, undefined, -1, 22, 2.5, Number.NaN]) expect(planKindOf(n as number | null)).toBeNull();
  });
  it("every kind is reached and the order is fixed", () => {
    const seen = new Set(Array.from({ length: PLAN_LIMITS.nights + 1 }, (_, n) => planKindOf(n)));
    expect([...seen]).toEqual([...PLAN_KINDS]);
  });
});

describe("shared vocabulary", () => {
  it("the paces are the scheduler's", () => {
    expect([...PLAN_PACES].sort()).toEqual(Object.keys(ACTIVE_BUDGET_MIN).sort());
  });
  it("origin tokens round-trip and refuse anything else", () => {
    for (const o of [{ kind: "hub", id: "toronto" }, { kind: "airport", iata: "YYZ" }, { kind: "town", id: "ca-on-whitby" }] as const) {
      expect(originOfToken(originToken(o))).toEqual(o);
    }
    for (const bad of ["loc:abc", "gn:123", "hub:", "iata:yyz", "town:43.6,-79.4", "point:43.6,-79.4", "hub:Toronto", ""]) expect(originOfToken(bad), bad).toBeNull();
  });
});

// ---- the boundary: raw schemas are parsed only inside their module ----

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".og-cache", "data-snapshots", "public", ".turbo"]);
const RAW = "planDraft|planDrafts|planPick|planOutputs|planWhere|planBuildInput|planCandidatesQuery";
const BARE_CALL = new RegExp(`\\b(?:${RAW})\\s*\\.\\s*(?:safeParse|parse|parseAsync|safeParseAsync|spa|decode|safeDecode|decodeAsync|safeDecodeAsync)\\s*\\(`);
const ALLOWED = new Set(["core/src/schema/plan-draft.ts", "core/src/schema/api/plan.ts"]);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

describe("plan-draft/1 is parsed only through its helpers", () => {
  it("the pattern catches a bare call and spares the helpers", () => {
    for (const bad of ["planDraft.parse(x)", "planDrafts .safeParse(x)", "planBuildInput.safeParse(b)"]) expect(BARE_CALL.test(bad), bad).toBe(true);
    for (const good of ["parsePlanDraft(x)", "readPlanDrafts(raw)", "z.toJSONSchema(planDraft)", "myPlanDraft.parse(x)"]) expect(BARE_CALL.test(good), good).toBe(false);
  });
  it("no file in core/src or web/ calls .parse on a raw plan schema", () => {
    const hits: string[] = [];
    for (const dir of ["core/src", "web"]) {
      for (const f of files(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, f).split(path.sep).join("/");
        if (!ALLOWED.has(rel) && BARE_CALL.test(readFileSync(f, "utf8"))) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
