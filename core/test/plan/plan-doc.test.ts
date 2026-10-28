// The editable trip document (edit-my-trip.md 2, 3, 4.2, 7; task EM-C): plan-draft/1's template mode and the trip's own party, rules
// R1 to R7, the copy mapper, the M3 merge rule, the account route shapes and decisions, the migration description, and the detector.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PLAN_DOC_LIMITS, PLAN_SYNC } from "../../src/config/plans.ts";
import { copyToPlanDraft, copyToPlanRow, draftContentKey, planCopyMerge, planRowFields, type AccountPlanKey } from "../../src/plan/doc.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import {
  ACCOUNT_PLAN_KINDS,
  ACCOUNT_PLANS_LIMITS,
  accountPlanMergeAnswer,
  decideDelete,
  decidePut,
  diffPlanList,
  isPurgeable,
  parseAccountPlanDelete,
  parseAccountPlanList,
  parseAccountPlanPut,
  PLAN_DOC_MIGRATION,
  tombstoneCutoff,
  withinBytes,
} from "../../src/schema/api/account-plans.ts";
import {
  ACCOUNT_DRAFT_CAP,
  copyContentKey,
  DEVICE_COPY_CAP,
  emptyCopies,
  fromDeviceTitle,
  FROM_DEVICE_SUFFIX,
  markMerged,
  planMerge,
  sameTripChoice,
  TITLE_MAX,
  type AccountDraftKey,
} from "../../src/schema/copies.ts";
import {
  emptyPlanTemplate,
  isTemplateDraft,
  parsePlanDraft,
  PLAN_DOC_MODES,
  PLAN_LIMITS,
  planDraft,
  planGateways,
  planModeOf,
  planOriginRef,
  planOverrides,
  planProfile,
  planSourceRevision,
  planTemplate,
  planTravellers,
  type PlanDraft,
} from "../../src/schema/plan-draft.ts";
import { slugIdentity } from "../../src/schema/identity.ts";
import { gateways, originRef, overrides, sourceRevision, timelineProfile, travellers } from "../../src/schema/trip-custom.ts";
import { COPIED_AT, COPY_ID, copyOf, int, pick, rng, templateDraft } from "./doc-helpers.ts";
import { sampleDraft } from "./helpers.ts";

const issues = (d: unknown): string[] => {
  const r = parsePlanDraft(d);
  return r.success ? [] : r.issues;
};
const ok = (d: unknown): boolean => parsePlanDraft(d).success;
const json = (s: z.ZodType) => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" });

describe("plan-draft/1, two modes (edit-my-trip 2)", () => {
  it("a built draft from the builder's fixtures parses byte for byte as before (R2)", () => {
    const d = sampleDraft();
    const r = parsePlanDraft(JSON.parse(JSON.stringify(d)));
    expect(r.success).toBe(true);
    expect(JSON.stringify(r.success && r.data)).toBe(JSON.stringify(d));
    expect(planModeOf(d)).toBe("built");
  });
  it("a template draft parses, and its mode is template", () => {
    const d = templateDraft();
    expect(issues(d)).toEqual([]);
    expect(planModeOf(d)).toBe("template");
    expect(isTemplateDraft(d)).toBe(true);
  });
  it("still exports to JSON Schema with the new keys (the subset rule)", () => {
    for (const s of [planDraft, planTemplate]) expect(() => json(s)).not.toThrow();
  });
  it("the modes are the account row's kinds", () => {
    expect([...PLAN_DOC_MODES]).toEqual([...ACCOUNT_PLAN_KINDS]);
  });
  it("the template atoms are the device copy's, exactly (the two modules cannot import each other)", () => {
    const pairs: [z.ZodType, z.ZodType][] = [
      [planProfile, timelineProfile],
      [planOverrides, overrides],
      [planTravellers, travellers],
      [planOriginRef, originRef],
      [planGateways, gateways],
      [planSourceRevision, sourceRevision],
    ];
    for (const [a, b] of pairs) expect(json(a)).toEqual(json(b));
  });
  it("a template draft longer than the builder's 21 nights is valid; a built one is not", () => {
    expect(ok(templateDraft({ nights: 40 }))).toBe(true);
    expect(issues(sampleDraft({ where: { mode: "trip", cc: "IT", regions: [] }, nights: 22, bases: [], edits: [], lastBuild: null }))).toContain(
      `$.nights: a built plan has at most ${PLAN_LIMITS.nights} nights (R2)`,
    );
    expect(ok(templateDraft({ nights: PLAN_DOC_LIMITS.templateDays }))).toBe(false);
  });
});

describe("R1: a template draft holds only the person's changes", () => {
  const pk = { ref: "place/x", slug: "x", name: "X", must: false };
  it.each([
    ["picks", { picks: [pk] }, "$.picks: a template draft has none (R1)"],
    ["bases", { bases: [{ town: "it-21-ortisei", nights: 2, pinned: false }] }, "$.bases: a template draft has none (R1)"],
    ["edits", { edits: [{ day: 1, refs: [], locked: [] }] }, "$.edits: a template draft has none (R1)"],
    ["lastBuild", { lastBuild: sampleDraft().lastBuild }, "$.lastBuild: a template draft has none (R1)"],
    ["seed", { seed: "dolomites-2027" }, "$.seed: a template draft has none (R1)"],
    ["regions", { where: { mode: "trip", cc: "IT", regions: ["it-ne"] } }, "$.where: trip mode with no regions (R1)"],
    ["near", { where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 120 } }, "$.where: trip mode with no regions (R1)"],
    ["nights", { nights: null }, "$.nights: a template draft has the trip's nights (R1)"],
    ["origin", { origin: { kind: "airport", iata: "BOM" } }, "$.origin: a template draft keeps its origin in fromRef (R1)"],
    ["pace", { pace: "full" }, "$.pace: the profile's pace (R1)"],
  ] as const)("refuses %s", (_k, over, want) => {
    expect(issues(templateDraft(over as never))).toContain(want);
  });
  it("accepts an undated copy (no start) and a profile of null", () => {
    const { start, ...undated } = templateDraft();
    void start;
    expect(ok(undated)).toBe(true);
    expect(ok(templateDraft({ template: { ...templateDraft().template, profile: null }, pace: "relaxed" }))).toBe(true);
  });
  it("a start's month is the draft's month (both modes)", () => {
    expect(issues(templateDraft({ month: 8 }))).toContain("$.month: the month of start");
    expect(issues({ ...sampleDraft(), start: "2027-03-01" })).toContain("$.month: the month of start");
  });
});

describe("R3: the trip's own party is an age snapshot", () => {
  it("party trip needs travellers; party device refuses them", () => {
    const { travellers: t, ...noParty } = templateDraft();
    void t;
    expect(issues(noParty)).toContain("$.travellers: a trip's own party needs its travellers (R3)");
    expect(issues(templateDraft({ party: "device" }))).toContain('$.travellers: only with party "trip"; the device party is never copied (R3)');
    expect(ok({ ...noParty, party: "device" })).toBe(true);
    // a builder draft may choose its own party too
    expect(ok({ ...sampleDraft(), party: "trip", travellers: { adults: 1, children: [] } })).toBe(true);
  });
  it("holds no name, no birth date, no birth month: strict, ages 0 to 17, at most 12 adults and 12 children", () => {
    const t = (travellers: unknown) => ok(templateDraft({ travellers: travellers as never }));
    expect(t({ adults: 2, children: [0, 17] })).toBe(true);
    expect(t({ adults: 2, children: [6], names: ["Asha"] })).toBe(false);
    expect(t({ adults: 2, children: [{ born: "2019-03" }] })).toBe(false);
    expect(t({ adults: 2, children: ["2019-03"] })).toBe(false);
    expect(t({ adults: 2, children: [6], dob: ["2019-03-14"] })).toBe(false);
    expect(t({ adults: 2, children: [18] })).toBe(false);
    expect(t({ adults: 2, children: [6.5] })).toBe(false);
    expect(t({ adults: 13, children: [] })).toBe(false);
    expect(t({ adults: 2, children: Array.from({ length: 13 }, () => 5) })).toBe(false);
  });
  it("one origin: origin or fromRef", () => {
    expect(ok(templateDraft({ fromRef: "iata:BOM", gw: { in: "YEG", out: "YYC" } }))).toBe(true);
    expect(issues({ ...sampleDraft(), origin: { kind: "airport", iata: "YYZ" }, fromRef: "iata:BOM" })).toContain("$.fromRef: one origin, in origin or in fromRef");
  });
});

describe("R5 to R7: the template block's caps and ids", () => {
  const t = templateDraft().template;
  const withT = (over: object) => templateDraft({ template: { ...t, ...over } as never });
  it("caps: 30 added, 40 removed, 40 moved, 10 day operations, 30 Maybe, 60 overrides, 2,000 note characters", () => {
    const added = (n: number) => Array.from({ length: n }, (_, i) => ({ op: `o-a${i}`, day: 1, ref: `place/p${i}` }));
    expect(ok(withT({ added: added(30) }))).toBe(true);
    expect(ok(withT({ added: added(31) }))).toBe(false);
    const removed = (n: number) => Array.from({ length: n }, (_, i) => ({ op: `o-r${i}`, day: 1 + (i % 9), item: `stop-${i}` }));
    expect(ok(withT({ removed: removed(40) }))).toBe(true);
    expect(ok(withT({ removed: removed(41) }))).toBe(false);
    const days = (n: number) => Array.from({ length: n }, (_, i) => ({ op: `o-d${i}`, kind: "insert", after: i }));
    expect(ok(withT({ days: days(10) }))).toBe(true);
    expect(ok(withT({ days: days(11) }))).toBe(false);
    const ov = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), "B"]));
    expect(ok(withT({ overrides: ov(60) }))).toBe(true);
    expect(issues(withT({ overrides: ov(61) }))).toContain("$.template.overrides: at most 60 overrides");
    expect(ok(withT({ notes: { trip: "a".repeat(1000), "5": "b".repeat(1000) } }))).toBe(true);
    expect(issues(withT({ notes: { trip: "a".repeat(1000), "5": "b".repeat(1001) } }))).toContain("$.template.notes: at most 2000 characters in all");
  });
  it("R6: ids are schedule ids or public refs, never names, origin keys or dated folders", () => {
    for (const item of ["Moose Lake Loop", "loc:CA/AB/x", "x proto:1", "canadian-rockies-sept-2029", "a\nb", ""]) {
      expect(ok(withT({ removed: [{ op: "o-9", day: 5, item }] })), item).toBe(false);
    }
    for (const item of ["moose-lake-loop", "5-all-meal-1", "d5-b-3"]) expect(ok(withT({ removed: [{ op: "o-9", day: 5, item }] })), item).toBe(true);
    expect(ok(withT({ added: [{ op: "o-1", day: 5, ref: "Pyramid Lake" }] }))).toBe(false);
    expect(ok(withT({ maybe: [{ op: "o-2", ref: "loc:abc" }] }))).toBe(false);
  });
  it("R7: every operation id once across the block", () => {
    expect(issues(withT({ maybe: [{ op: "o-1", ref: "place/opal-hills" }] }))).toContain("$.template: each operation id once (R7)");
    expect(ok(withT({ added: [{ op: "x-1", day: 5, ref: "place/pyramid-lake" }] }))).toBe(false);
  });
  it("an inserted day named by a place, a move or a note exists; stops and places once", () => {
    expect(ok(withT({ days: [{ op: "o-ins", kind: "insert", after: 7 }], added: [{ op: "o-1", day: "o-ins", ref: "place/x" }], notes: { "o-ins": "Rest" } }))).toBe(true);
    expect(issues(withT({ added: [{ op: "o-1", day: "o-ins", ref: "place/x" }] }))).toContain("$.template.added[0].day: an inserted day of this draft");
    expect(issues(withT({ notes: { "o-ins": "Rest" } }))).toContain("$.template.notes: a note's inserted day exists");
    expect(issues(withT({ moved: [{ op: "o-7", day: 6, item: "a", toDay: "o-zz" }] }))).toContain("$.template.moved[0].toDay: an inserted day of this draft");
    expect(issues(withT({ removed: [{ op: "o-5", day: 5, item: "a" }, { op: "o-6", day: 5, item: "a" }] }))).toContain("$.template.removed: each stop once");
    expect(issues(withT({ moved: [{ op: "o-5", day: 5, item: "a", toDay: 6 }, { op: "o-6", day: 5, item: "a", toDay: 7 }] }))).toContain("$.template.moved: each stop once");
    expect(issues(withT({ added: [{ op: "o-1", day: 5, ref: "place/x" }, { op: "o-2", day: 6, ref: "place/x" }] }))).toContain("$.template.added: each place once");
    expect(issues(withT({ days: [{ op: "o-5", kind: "drop", day: 3 }, { op: "o-6", kind: "drop", day: 3 }] }))).toContain("$.template.days: each day dropped once");
  });
  it("is strict: custom and stays are not in /1, and a planted key fails", () => {
    expect(ok(withT({ custom: [] }))).toBe(false);
    expect(ok(withT({ stays: [] }))).toBe(false);
    expect(ok(withT({ added: [{ op: "o-1", day: 5, ref: "place/x", name: "X" }] }))).toBe(false);
  });
  it("issues never carry a value: a bad note key or text, a planted name", () => {
    const r = issues(withT({ notes: { "Moraine Lake": "call Asha on 555-0100" } }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.join(" ")).not.toMatch(/Moraine|Asha|555/);
  });
  it("the 16 KB cap holds for a full template", () => {
    const long = (p: string, i: number) => `place/${p.repeat(150)}${i}`;
    const big = withT({
      notes: { trip: "n".repeat(2000) },
      added: Array.from({ length: 30 }, (_, i) => ({ op: `o-a${i}`, day: 1, ref: long("a", i) })),
      maybe: Array.from({ length: 30 }, (_, i) => ({ op: `o-m${i}`, ref: long("m", i) })),
      removed: Array.from({ length: 40 }, (_, i) => ({ op: `o-r${i}`, day: 2, item: `${"r".repeat(100)}${i}` })),
    });
    expect(issues(big)).toContain(`$: a draft is at most ${PLAN_LIMITS.draftBytes} bytes`);
  });
  it("emptyPlanTemplate is a valid block", () => {
    expect(ok(templateDraft({ template: emptyPlanTemplate("dolomites-2027", "2026-10-27.3") }))).toBe(true);
  });
});

describe("the copy mapper (replaces docOf; edit-my-trip 2 'Mapping a device copy')", () => {
  it("maps a copy to the template draft, with its slug's ring colour when the copy has none (SW-026)", () => {
    expect(copyToPlanDraft(copyOf())).toEqual({ success: true, data: { ...templateDraft(), identity: slugIdentity(copyOf().slug) } });
  });
  it("copies/2: the copy's own colour goes to the document, and an undated copy maps to a draft with no start and no month (SW-008)", () => {
    const r = copyToPlanDraft({ ...copyOf(), identity: "orange", start: null });
    if (!r.success) throw new Error(r.issues.join("; "));
    expect(r.data.identity).toBe("orange");
    expect("start" in r.data).toBe(false);
    expect(r.data.month).toBeNull();
    const row = copyToPlanRow({ ...copyOf(), start: null });
    expect(row.success && row.data.start).toBeNull();
  });
  it("keeps fromRef, gw and rev; a title other than the copy's becomes the person's own", () => {
    const r = copyToPlanDraft({ ...copyOf(), fromRef: "town:in-mh-mumbai", gw: { in: "YEG", out: "YYC" }, rev: "2026-10-20.a1b2" }, { title: fromDeviceTitle("Dolomites") });
    expect(r.success && r.data).toMatchObject({ fromRef: "town:in-mh-mumbai", gw: { in: "YEG", out: "YYC" }, title: "Dolomites (from this device)", template: { rev: "2026-10-20.a1b2" } });
  });
  it("the snapshot fields are not document keys (P8)", () => {
    const r = copyToPlanDraft(copyOf());
    if (!r.success) throw new Error(r.issues.join("; "));
    for (const k of ["days", "cc", "photo", "slug", "copiedAt", "adults", "children", "profile", "overrides", "added"]) expect(Object.keys(r.data)).not.toContain(k);
  });
  it("every web/tests/mine copy fixture maps to a valid template draft, with the trip's facts when the snapshot lacks them", () => {
    const base = { slug: "dolomites-2027", title: "dolomites-2027", days: 14, cc: null, photo: null, start: "2027-07-03", adults: 2, children: [], profile: null, overrides: {}, added: [] };
    const cases = [
      {},
      { children: [4, 11] },
      { adults: 1 },
      { adults: 3 },
      { adults: 12, children: [5, 7, 9] },
      { children: [0], profile: { party: "family", youngest: 0, pace: "full", adults: 2, walk: 12, split: false } },
      { adults: 1, profile: { party: "adults", youngest: null, pace: "relaxed", adults: 1, walk: 5, split: true }, overrides: { "12": "B", "3": "A" }, added: [{ day: 2, placeSlug: "a-b" }, { day: 9, placeSlug: "c" }] },
      { profile: { party: "family", youngest: 17, pace: "standard", adults: 2, walk: 8, split: false } },
    ];
    const facts = () => ({ cc: "IT", days: 14 });
    for (const c of cases) {
      const copy = copyOf({ ...base, ...c } as never);
      expect(copyToPlanDraft(copy)).toMatchObject({ success: false, issues: ["$.cc: the trip's country is not known"] });
      const r = copyToPlanDraft(copy, { facts });
      expect(r.success, JSON.stringify(c)).toBe(true);
      if (r.success) expect(r.data.pace).toBe(copy.profile?.pace ?? "standard");
    }
    expect(copyToPlanDraft(copyOf({ ...base, cc: "IT", days: null } as never))).toMatchObject({ success: false, issues: ["$.days: the trip's days are not known"] });
  });
  it("maps a dated slug to its public alias, and refuses a trip that is not public", () => {
    const dated = copyOf({ slug: "canadian-rockies-sept-2029", cc: "CA" });
    expect(copyToPlanDraft(dated).success).toBe(false);
    const r = copyToPlanDraft(dated, { publicSlug: (s) => s.replace("-sept-", "-") });
    expect(r.success && r.data.template.trip).toBe("canadian-rockies-2029");
    expect(copyToPlanDraft(copyOf(), { publicSlug: () => null })).toMatchObject({ success: false, issues: ["$.slug: a public, listed trip"] });
  });
  it("an old copy listing a place twice keeps the first addition", () => {
    const r = copyToPlanDraft(copyOf({ added: [{ day: 5, placeSlug: "a" }, { day: 6, placeSlug: "a" }] }));
    expect(r.success && r.data.template.added).toEqual([{ op: "o-1", day: 5, ref: "place/a" }]);
  });
  it("refuses what is not a copy (review C2)", () => {
    expect(copyToPlanDraft("nope").success).toBe(false);
    expect(copyToPlanDraft({ ...copyOf(), is_admin: true }).success).toBe(false);
  });
  it("the account row: its light columns derive from the document", () => {
    const r = copyToPlanRow(copyOf());
    expect(r.success && { ...r.data, doc: undefined }).toEqual({ id: COPY_ID, title: "Dolomites", kind: "template", source_trip: "dolomites-2027", start: "2027-07-03", days: 14, doc: undefined });
    expect(planRowFields(sampleDraft())).toEqual({ kind: "built", source_trip: null, start: null, days: 3 });
  });
});

describe("the content key (M3)", () => {
  it("a copy and the draft it maps to have the same key; titles, op ids and the revision are not content", () => {
    const c = copyOf();
    const d = templateDraft({ title: "My Dolomites" });
    expect(draftContentKey(d)).toBe(copyContentKey(c));
    const t = d.template;
    expect(draftContentKey({ ...d, template: { ...t, rev: "x", added: t.added.map((a) => ({ ...a, op: "o-zz" })) } })).toBe(copyContentKey(c));
    expect(draftContentKey({ ...d, travellers: { adults: 2, children: [6] } })).toBe(copyContentKey(c));
  });
  it("any change of the person's is a difference", () => {
    const c = copyContentKey(copyOf());
    const d = templateDraft();
    const t = d.template;
    for (const x of [
      { ...d, start: "2027-07-04" },
      { ...d, travellers: { adults: 2, children: [7] } },
      { ...d, template: { ...t, overrides: { "5": "B" } } },
      { ...d, template: { ...t, removed: [{ op: "o-9", day: 5, item: "a" }] } },
      { ...d, template: { ...t, notes: { trip: "x" } } },
      { ...d, template: { ...t, maybe: [{ op: "o-9", ref: "place/y" }] } },
      { ...d, fromRef: "iata:BOM" },
    ]) {
      expect(draftContentKey(x as PlanDraft)).not.toBe(c);
    }
  });
  it("children's ages are a party, not a list: order does not matter", () => {
    expect(copyContentKey(copyOf({ children: [9, 6] }))).toBe(copyContentKey(copyOf({ children: [6, 9] })));
  });
  it("an inserted day is named by its position, not its operation id", () => {
    const d = (id: string) => templateDraft({ template: { ...templateDraft().template, days: [{ op: id, kind: "insert", after: 3 }], notes: { [id]: "Rest" } } });
    expect(draftContentKey(d("o-aaa"))).toBe(draftContentKey(d("o-bbb")));
  });
  it("a built draft has no content key", () => {
    expect(draftContentKey(sampleDraft())).toBeNull();
    expect(draftContentKey(null)).toBeNull();
  });
});

describe("the sign-in merge with M3 (edit-my-trip 4.2)", () => {
  const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";
  it("sameTripChoice: identical skips, different keeps both, unread content is the old rule", () => {
    expect(sameTripChoice("a", ["a"])).toBe("same");
    expect(sameTripChoice("a", ["b"])).toBe("both");
    expect(sameTripChoice("a", ["b", "a"])).toBe("same");
    expect(sameTripChoice("a", [null])).toBe("both");
    expect(sameTripChoice("a", ["a", undefined])).toBe("legacy");
  });
  it("identical content on the same trip and start is skipped and leaves the device", () => {
    const c = copyOf();
    const acct: AccountPlanKey[] = [{ id: OTHER, source_trip: c.slug, start: c.start, content: copyContentKey(c) }];
    const r = planCopyMerge([c], acct);
    if (!r.success) throw new Error(r.issues.join("; "));
    expect(r.data).toMatchObject({ insert: [], sameTrip: [c.id], both: [] });
    const env = markMerged({ ...emptyCopies(), items: [c] }, { inserted: [], already: [], sameTrip: r.data.sameTrip }, "acct_hash_1234", new Date(COPIED_AT));
    expect(env.items).toEqual([]);
  });
  it("different content keeps both: the device copy is inserted, titled (from this device)", () => {
    const c = copyOf();
    const changed = draftContentKey(templateDraft({ template: { ...templateDraft().template, overrides: { "5": "A" } } }));
    const r = planCopyMerge([c], [{ id: OTHER, source_trip: c.slug, start: c.start, content: changed }]);
    if (!r.success) throw new Error(r.issues.join("; "));
    expect(r.data.both).toEqual([c.id]);
    expect(r.data.insert).toHaveLength(1);
    expect(r.data.insert[0]).toMatchObject({ id: c.id, title: "Dolomites (from this device)", kind: "template", source_trip: "dolomites-2027" });
    expect(r.data.insert[0]!.doc.title).toBe("Dolomites (from this device)");
    expect(parsePlanDraft(r.data.insert[0]!.doc).success).toBe(true);
    // idempotent (M1): the second run finds the id and inserts nothing
    const again = planCopyMerge([c], [{ id: OTHER, source_trip: c.slug, start: c.start, content: changed }, { id: c.id, source_trip: c.slug, start: c.start, content: copyContentKey(c) }]);
    expect(again.success && again.data).toMatchObject({ insert: [], already: [c.id] });
    expect(accountPlanMergeAnswer.safeParse({ inserted: [c.id], already: [], sameTrip: [], both: [c.id], overCap: [], refused: [] }).success).toBe(true);
  });
  it("a dated copy slug meets its public account row", () => {
    const c = copyOf({ slug: "canadian-rockies-sept-2029", cc: "CA" });
    const publicSlug = (s: string) => s.replace("-sept-", "-");
    const r = planCopyMerge([c], [{ id: OTHER, source_trip: "canadian-rockies-2029", start: c.start, content: copyContentKey(c, publicSlug) }], { publicSlug });
    expect(r.success && r.data.sameTrip).toEqual([c.id]);
  });
  it("a copy the mapper cannot take is refused and stays; the cap and the newest-first order hold (M4)", () => {
    const r1 = rng(3);
    const ids = Array.from({ length: 5 }, () => `${Math.floor(r1() * 1e8).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`);
    const copies = ids.map((id, i) => ({ ...copyOf({ slug: `trip-${i}`, cc: i === 0 ? null : "IT" }, id), copiedAt: `2026-10-0${i + 1}T00:00:00Z` }));
    const full: AccountPlanKey[] = Array.from({ length: ACCOUNT_DRAFT_CAP - 2 }, (_, i) => ({ id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, source_trip: null, start: null, content: null }));
    const r = planCopyMerge(copies, full);
    if (!r.success) throw new Error(r.issues.join("; "));
    expect(r.data.insert.map((x) => x.id)).toEqual([copies[4]!.id, copies[3]!.id]);
    expect(r.data.overCap).toEqual([copies[2]!.id, copies[1]!.id, copies[0]!.id]);
    const roomy = planCopyMerge(copies, []);
    expect(roomy.success && roomy.data.refused).toEqual([copies[0]!.id]);
  });
  it("property: every copy lands in exactly one bucket; both rows are inserted; a re-run inserts nothing", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const n = int(r, 0, DEVICE_COPY_CAP);
      const copies = Array.from({ length: n }, (_, i) =>
        copyOf({ slug: `trip-${i}`, start: pick(r, ["2027-07-03", "2027-07-10"]), overrides: r() < 0.5 ? { "5": "C" } : { "5": "B" } }, `${String(seed).padStart(4, "0")}${String(i).padStart(4, "0")}-0000-4000-8000-000000000000`),
      );
      const account: AccountPlanKey[] = [];
      for (const c of copies) {
        const k = r();
        if (k < 0.2) account.push({ id: `${String(account.length).padStart(8, "0")}-2222-4222-8222-222222222222`, source_trip: c.slug, start: c.start, content: copyContentKey(c) });
        else if (k < 0.4) account.push({ id: `${String(account.length).padStart(8, "0")}-2222-4222-8222-222222222222`, source_trip: c.slug, start: c.start, content: copyContentKey({ ...c, overrides: { "9": "A" } }) });
        else if (k < 0.5) account.push({ id: c.id, source_trip: c.slug, start: c.start, content: copyContentKey(c) });
      }
      const plan = planCopyMerge(copies, account);
      if (!plan.success) throw new Error(plan.issues.join("; "));
      const p = plan.data;
      const buckets = [...p.insert.map((x) => x.id), ...p.already, ...p.sameTrip, ...p.overCap, ...p.refused];
      expect(buckets.sort(), `seed ${seed}`).toEqual(copies.map((c) => c.id).sort());
      for (const id of p.both) expect(p.insert.map((x) => x.id), `seed ${seed}`).toContain(id);
      for (const row of p.insert) expect(parsePlanDraft(row.doc).success, `seed ${seed}`).toBe(true);
      const after: AccountPlanKey[] = [...account, ...p.insert.map((x) => ({ id: x.id, source_trip: x.source_trip, start: x.start, content: draftContentKey(x.doc) }))];
      const again = planCopyMerge(copies, after);
      expect(again.success && again.data.insert, `seed ${seed}`).toEqual([]);
    }
  });
  it("planMerge without content keys keeps the old rule (stored tests), and its default rows are unchanged", () => {
    const c = copyOf();
    const legacy: AccountDraftKey[] = [{ id: "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d", source_trip: c.slug, start: c.start }];
    expect(planMerge([c], legacy).success && planMerge([c], legacy)).toMatchObject({ data: { sameTrip: [c.id], insert: [] } });
  });
  it("fromDeviceTitle stays within the title cap", () => {
    expect(fromDeviceTitle("Dolomites")).toBe(`Dolomites${FROM_DEVICE_SUFFIX}`);
    const long = fromDeviceTitle("x".repeat(TITLE_MAX));
    expect(long.length).toBe(TITLE_MAX);
    expect(long.endsWith(FROM_DEVICE_SUFFIX)).toBe(true);
  });
});

describe("the account routes' contract (edit-my-trip 4.1, 4.5)", () => {
  const D = templateDraft();
  const parseDoc = (x: unknown) => parsePlanDraft(x);
  it("a PUT is checked whole: shape, the document's rules, and the path's id", () => {
    expect(parseAccountPlanPut({ base: null, title: "Dolomites", doc: D }, COPY_ID, parseDoc)).toMatchObject({ success: true, data: { base: null, restore: false } });
    expect(parseAccountPlanPut({ base: 3, title: "Dolomites", doc: D, restore: true }, COPY_ID, parseDoc)).toMatchObject({ success: true, data: { restore: true } });
    expect(parseAccountPlanPut({ base: null, title: "Dolomites", doc: D }, "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d", parseDoc)).toMatchObject({ success: false, issues: ["$.doc.id: the row's id"] });
    const bad = parseAccountPlanPut({ base: null, title: "Dolomites", doc: { ...D, party: "device" } }, COPY_ID, parseDoc);
    expect(bad.success ? [] : bad.issues).toContain('$.doc.travellers: only with party "trip"; the device party is never copied (R3)');
    for (const body of [{ base: -1, title: "x", doc: D }, { base: null, title: "", doc: D }, { base: null, title: "x", doc: { ...D, schema: "trip-custom/1" } }, { base: null, title: "x", doc: D, user_id: "u" }]) {
      expect(parseAccountPlanPut(body, COPY_ID, parseDoc).success, JSON.stringify(Object.keys(body))).toBe(false);
    }
    expect(parseAccountPlanDelete({ base: 4 })).toEqual({ success: true, data: { base: 4 } });
    expect(parseAccountPlanDelete({ base: "4" }).success).toBe(false);
  });
  it("byte caps: 16 KB a document, 84 KB a merge", () => {
    expect(ACCOUNT_PLANS_LIMITS.docBytes).toBe(16 * 1024);
    expect(ACCOUNT_PLANS_LIMITS.mergeBodyBytes).toBe(84 * 1024);
    expect(withinBytes("é".repeat(8192), ACCOUNT_PLANS_LIMITS.docBytes)).toBe(true);
    expect(withinBytes("é".repeat(8193), ACCOUNT_PLANS_LIMITS.docBytes)).toBe(false);
  });
  it("decidePut and decideDelete: revisions and tombstones", () => {
    const live = { revision: 4, deleted_at: null };
    const tomb = { revision: 5, deleted_at: "2026-10-27T10:00:00Z" };
    expect(decidePut(null, null)).toBe("insert");
    expect(decidePut(3, null)).toBe("not-found");
    expect(decidePut(4, live)).toBe("update");
    expect(decidePut(3, live)).toBe("conflict");
    expect(decidePut(null, live)).toBe("conflict");
    expect(decidePut(5, tomb)).toBe("conflict");
    expect(decidePut(5, tomb, true)).toBe("update");
    expect(decidePut(4, tomb, true)).toBe("conflict");
    expect(decideDelete(4, live)).toBe("delete");
    expect(decideDelete(3, live)).toBe("conflict");
    expect(decideDelete(5, tomb)).toBe("already");
    expect(decideDelete(1, null)).toBe("not-found");
  });
  it("tombstones last 30 days", () => {
    const now = new Date("2026-11-30T12:00:00Z");
    expect(PLAN_SYNC.tombstoneDays).toBe(30);
    expect(tombstoneCutoff(now)).toBe("2026-10-31T12:00:00.000Z");
    expect(isPurgeable("2026-10-31T11:59:59Z", now)).toBe(true);
    expect(isPurgeable("2026-10-31T12:00:00Z", now)).toBe(false);
    expect(isPurgeable(null, now)).toBe(false);
  });
  it("the list: light rows, at most 50 live, tombstones beside them; diffPlanList says what to fetch and drop", () => {
    const row = (id: string, revision: number, deleted_at: string | null = null) => ({ id, title: "Dolomites", kind: "template", source_trip: "dolomites-2027", start: "2027-07-03", days: 14, revision, updated_at: "2026-10-27T10:00:00Z", deleted_at });
    const id = (i: number) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`;
    expect(parseAccountPlanList({ items: Array.from({ length: 50 }, (_, i) => row(id(i), 1)) }).success).toBe(true);
    expect(parseAccountPlanList({ items: Array.from({ length: 51 }, (_, i) => row(id(i), 1)) })).toMatchObject({ success: false, issues: ["$.items: at most 50 live rows"] });
    expect(parseAccountPlanList({ items: [...Array.from({ length: 50 }, (_, i) => row(id(i), 1)), row(id(60), 2, "2026-10-27T11:00:00Z")] }).success).toBe(true);
    expect(parseAccountPlanList({ items: [{ ...row(id(1), 1), doc: {} }] }).success).toBe(false);
    const d = diffPlanList(
      [{ id: id(1), revision: 1 }, { id: id(2), revision: 1 }, { id: id(3), revision: 1 }, { id: id(4), revision: 1 }],
      [row(id(1), 1), row(id(2), 2), row(id(3), 2, "2026-10-27T11:00:00Z"), row(id(5), 1)],
    );
    expect(d).toEqual({ fetch: [id(2), id(5)], drop: [id(3), id(4)], keep: [id(1)], removed: [id(3)] });
  });
});

describe("the table change for EM-M (no migration here)", () => {
  it("matches the constants it describes", () => {
    const text = JSON.stringify(PLAN_DOC_MIGRATION);
    expect(PLAN_DOC_MIGRATION.slug).toBe("plan_doc");
    expect(text).toContain(`at most ${ACCOUNT_DRAFT_CAP} rows`);
    expect(text).toContain(`interval '${PLAN_SYNC.tombstoneDays} days'`);
    expect(text).toContain(`kind in (${ACCOUNT_PLAN_KINDS.map((k) => `'${k}'`).join(", ")})`);
    expect(text).toContain(`days between 1 and ${PLAN_DOC_LIMITS.templateDays}`);
    expect(PLAN_DOC_MIGRATION.columns.map((c) => c.name)).toEqual(["doc", "kind", "source_trip", "start", "days", "revision", "deleted_at"]);
    // a backstop at least the route's cap, allowing for the spaces jsonb's text form adds
    expect(Number(/octet_length\(doc::text\) <= (\d+)/.exec(text)![1])).toBeGreaterThanOrEqual(ACCOUNT_PLANS_LIMITS.docBytes * 1.5);
    // no migration number is chosen in the contract (ACCT-PC's 0012 is in flight)
    expect(text).not.toMatch(/\b00\d\d_plan_doc\b/);
  });
});

describe("privacy detector: a trip document in a served body (edit-my-trip 7)", () => {
  const whys = (x: unknown) => privacyHits(x).map((h) => `${h.where} ${h.why}`);
  it("fails a planted draft, its template, notes and start, and an outbox", () => {
    const hits = whys({ trip: templateDraft({ template: { ...templateDraft().template, notes: { trip: "x" } } }) });
    expect(hits).toEqual(expect.arrayContaining(["$.trip a visitor's trip document", "$.trip.template a private key", "$.trip.start a private key", "$.trip.travellers a private key", "$.trip.template.added a private key"]));
    expect(whys({ body: JSON.stringify({ schema: "plan-drafts/1", items: [sampleDraft()] }) })).toContain("$.body<json> a visitor's trip document");
    expect(whys({ x: { schema: "plan-outbox/1", items: [] } })).toContain("$.x a visitor's trip document");
    // a bare template block, without its document
    expect(whys({ t: { template: { trip: "dolomites-2027", notes: { trip: "x" } }, notes: "x", start: "2027-07-03" } })).toEqual(
      expect.arrayContaining(["$.t.template a private key", "$.t.notes a private key", "$.t.start a private key"]),
    );
  });
  it("leaves the public start, notes and removed alone outside a draft shape", () => {
    expect(whys({ window: { start: "07-13", end: "07-26" }, notes: "Bring a jacket", removed: { not_for_party: 2, closed: 1 } })).toEqual([]);
    expect(whys({ template: "trip-page" })).toEqual([]);
    expect(whys({ schema: "trip/1", start: "x" })).toEqual([]);
  });
  it("hits never carry the value", () => {
    expect(JSON.stringify(privacyHits({ d: templateDraft({ template: { ...templateDraft().template, notes: { trip: "call Asha" } } }) }))).not.toMatch(/Asha|2027-07-03|dolomites/);
  });
});

// ---- the boundary: the new raw schemas are parsed only through their helpers ----

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".og-cache", "data-snapshots", "public", ".turbo"]);
const RAW = "planTemplate|planOp|planOutbox|planPendingChange|accountPlanPut|accountPlanList|accountPlanDelete";
const BARE_CALL = new RegExp(`\\b(?:${RAW})\\s*\\.\\s*(?:safeParse|parse|parseAsync|safeParseAsync|spa|decode|safeDecode|decodeAsync|safeDecodeAsync)\\s*\\(`);
const ALLOWED = new Set(["core/src/schema/plan-draft.ts", "core/src/plan/ops.ts", "core/src/plan/sync.ts", "core/src/schema/api/account-plans.ts"]);
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

describe("the editable trip's raw schemas are parsed only through their helpers", () => {
  it("no file in core/src or web/ calls .parse on one", () => {
    expect(BARE_CALL.test("planOp.safeParse(x)")).toBe(true);
    expect(BARE_CALL.test("parsePlanOp(x)")).toBe(false);
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
