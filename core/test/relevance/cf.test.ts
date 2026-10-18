// Lane CF: relevance roles (relevance.md 3.4 and 3.5). Fixtures are synthetic; the cases mirror the verification findings:
// Aiguille du Midi against Montenvers, Maligne Lake against its cruise, and Sunset Point.
import { describe, expect, it } from "vitest";
import { deriveAll } from "../../src/relevance/derive.ts";
import type { Derived, DeriveInput, Signals } from "../../src/relevance/derive.ts";
import { vacationFit } from "../../src/relevance/fit.ts";
import type { FitFacts } from "../../src/relevance/fit.ts";
import { rec } from "./helpers.ts";

const f = (o: Partial<FitFacts> = {}): FitFacts => ({ ed: "regional", standing: "good", distinction: "common", weather: "any_weather", load: "easy", detourMin: 5, onSiteMin: 60, ...o });
const SIG: Record<string, Signals> = {};
function run(records: ReturnType<typeof rec>[]): Record<string, Derived> {
  const input: DeriveInput = { records, facts: {}, signals: SIG, towns: [], matrix: null };
  return Object.fromEntries(deriveAll(input).map((d) => [d.ref, d]));
}

describe("4(a) a world top draw that needs a clear day stays an anchor", () => {
  it("keeps plan_around and says why", () => {
    const r = vacationFit(f({ ed: "world", standing: "top", distinction: "rare", weather: "clear_only" }));
    expect(r.fit).toBe("plan_around");
    expect(r.reason).toContain("go_clear_day");
  });
  it("a national draw still steps down for clear_only", () => {
    expect(vacationFit(f({ ed: "national", standing: "top", distinction: "rare", weather: "clear_only" })).fit).toBe("worth_it");
  });
  it("a world draw with standing below top still steps down", () => {
    expect(vacationFit(f({ ed: "world", standing: "good", weather: "clear_only" })).fit).toBe("worth_it");
  });
  it("better_clear never drops anything", () => {
    expect(vacationFit(f({ ed: "world", standing: "top", weather: "better_clear" })).fit).toBe("plan_around");
  });
  it("Aiguille du Midi is an anchor with go_clear_day; Montenvers is not above it", () => {
    const d = run([
      rec({ ref: "place/aiguille-du-midi", kind: "lift", qid: "Q1", draw: "world", standing: "top", distinction: "unique", weather: "clear_only", class_key: "lake/glacial-turquoise" }),
      rec({ ref: "place/montenvers", kind: "lift", qid: "Q2", draw: "national", standing: "top", distinction: "rare", weather: "any_weather", class_key: "lake/glacial-turquoise" }),
    ]);
    expect(d["place/aiguille-du-midi"]!.role).toBe("anchor");
    expect(d["place/aiguille-du-midi"]!.flags.go_clear_day).toBe(true);
    expect(d["place/montenvers"]!.role).toBe("anchor");
    expect(d["place/montenvers"]!.flags.go_clear_day).toBe(false);
  });
  it("a national clear_only place does not get the flag", () => {
    const d = run([rec({ ref: "place/x", draw: "national", standing: "top", distinction: "rare", weather: "clear_only" })]);
    expect(d["place/x"]!.role).toBe("highlight");
    expect(d["place/x"]!.flags.go_clear_day).toBe(false);
  });
});

describe("4(c) an anchor needs unique or rare, or a world draw", () => {
  it("national, top, common caps at highlight (Sunset Point)", () => {
    expect(vacationFit(f({ ed: "national", standing: "top", distinction: "common" })).fit).toBe("worth_it");
    const d = run([rec({ ref: "place/sunset-point", draw: "national", standing: "top", distinction: "common" })]);
    expect(d["place/sunset-point"]!.role).toBe("highlight");
    expect(d["place/sunset-point"]!.badge).toBe("Worth a detour");
  });
  it("unique and rare national tops stay anchors", () => {
    for (const distinction of ["unique", "rare"] as const) {
      expect(run([rec({ ref: "place/x", draw: "national", standing: "top", distinction })])["place/x"]!.role).toBe("anchor");
    }
  });
  it("a world draw is an anchor whatever the distinction", () => {
    expect(vacationFit(f({ ed: "world", standing: "ordinary", distinction: "common" })).fit).toBe("plan_around");
  });
  it("the same cap holds at the peak tier", () => {
    const r = rec({ ref: "place/x", draw: "regional", standing: "top", distinction: "common", peak: { tier: "national", from: "09-20", to: "10-10", why: "fall colour" } });
    expect(run([r])["place/x"]!.peak).toMatchObject({ tier: "national", role: "highlight" });
  });
});

describe("4(b) a place and its activity are not both anchors", () => {
  const lake = () => rec({ ref: "place/maligne-lake", kind: "lake", qid: "Q7", draw: "world", standing: "top", distinction: "unique", class_key: "lake/glacial-turquoise" });
  const cruise = (over: Partial<Parameters<typeof rec>[0]> = {}) => rec({ ref: "trip/jasper/activity:maligne-cruise", kind: "activity", qid: null, draw: "world", standing: "top", distinction: "rare", class_key: "lake/glacial-turquoise", ...over });

  it("matches by an explicit same_place_as ref: the place keeps the anchor", () => {
    const c = { ...cruise(), same_place_as: "place/maligne-lake" };
    const d = run([lake(), c]);
    expect(d["place/maligne-lake"]!.role).toBe("anchor");
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("highlight");
    expect(d["trip/jasper/activity:maligne-cruise"]!.fits.vacation.fit).toBe("worth_it");
    expect(d["trip/jasper/activity:maligne-cruise"]!.fits.vacation.reason).toContain("place/maligne-lake");
    expect(d["trip/jasper/activity:maligne-cruise"]!.badge).toBe("Worth a detour");
  });
  it("matches by the shared QID when there is no same_place_as", () => {
    const d = run([lake(), cruise({ qid: "Q7" })]);
    expect(d["place/maligne-lake"]!.role).toBe("anchor");
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("highlight");
  });
  it("is symmetric: the record order does not matter", () => {
    const d = run([cruise({ qid: "Q7" }), lake()]);
    expect(d["place/maligne-lake"]!.role).toBe("anchor");
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("highlight");
  });
  it("different places with different QIDs are untouched", () => {
    const d = run([lake(), cruise({ qid: "Q8" })]);
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("anchor");
  });
  it("an activity stays an anchor when the place is not one", () => {
    const d = run([rec({ ref: "place/maligne-lake", kind: "lake", qid: "Q7", draw: "regional", standing: "top", distinction: "rare" }), cruise({ qid: "Q7" })]);
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("anchor");
  });
  it("an owner override of the role is honoured", () => {
    const c = { ...cruise({ qid: "Q7" }), override: { field: "role" as const, value: "anchor", reason: "the owner's pick", by: "nitin", on: "2026-10-18" } };
    const d = run([lake(), c]);
    expect(d["trip/jasper/activity:maligne-cruise"]!.role).toBe("anchor");
  });
  it("the demoted activity loses its plan B and its go_clear_day flag", () => {
    const c = { ...cruise({ qid: "Q7", weather: "clear_only", access: [{ type: "timed_entry" }] }) };
    const d = run([lake(), c]);
    const x = d["trip/jasper/activity:maligne-cruise"]!;
    expect(x.role).toBe("highlight");
    expect(x.plan_b).toBeNull();
    expect(x.flags.go_clear_day).toBe(false);
  });
});

describe("same_place_as in the validator", () => {
  // the validator resolves refs against the fixture root; reuse the default fixture ref and a self reference
  it("accepts a resolving ref, and refuses the record's own ref and a ref that does not resolve", async () => {
    const { validateDoc } = await import("../../src/validate/index.ts");
    const { doc } = await import("./helpers.ts");
    const { fileURLToPath } = await import("node:url");
    const { join } = await import("node:path");
    const root = join(fileURLToPath(new URL("../fixtures/relevance", import.meta.url)), "root");
    process.env.RELEVANCE_TODAY = "2026-10-18";
    const check = (same: string | undefined) => validateDoc(doc([{ ...rec(), ...(same ? { same_place_as: same } : {}) }]), "sidecar", root, { kind: "relevance" as never });
    expect(check(undefined).errors).toEqual([]);
    expect(check("place/lago-di-braies").errors.map((e) => e.path)).toEqual(["/records/0/same_place_as"]); // own ref
    const bad = check("place/does-not-exist").errors;
    expect(bad.map((e) => e.code)).toEqual(["E_REL_REF"]);
    expect(bad[0]!.path).toBe("/records/0/same_place_as");
  });
});

describe("4(b) a lift yields the anchor to the summit it serves", () => {
  const summit = () => rec({ ref: "place/summit", kind: "viewpoint", qid: "Q9", draw: "world", standing: "top", distinction: "unique" });
  const lift = (over: Record<string, unknown> = {}) => ({ ...rec({ ref: "trip/x/lift:cable-car", kind: "lift", qid: null, draw: "world", standing: "top", distinction: "rare" }), ...over });
  it("by same_place_as", () => {
    const d = run([summit(), lift({ same_place_as: "place/summit" })]);
    expect(d["place/summit"]!.role).toBe("anchor");
    expect(d["trip/x/lift:cable-car"]!.role).toBe("highlight");
  });
  it("by QID", () => {
    const l = lift();
    l.wikidata = { ...summit().wikidata };
    const d = run([summit(), l]);
    expect(d["trip/x/lift:cable-car"]!.role).toBe("highlight");
  });
  it("unlinked, it stays an anchor", () => {
    expect(run([summit(), lift()])["trip/x/lift:cable-car"]!.role).toBe("anchor");
  });
});
