// RB-012 (review TB-R1): "Fits 7" sat on 11 to 15 km trails. The candidate fit now reads the same walk ceiling as the day check
// W_CEILING (core/src/schedule/rules.ts walkCeiling): a trail over the youngest's length or climb is `fail` by advice, with its words,
// and stays on the main list and on a day; a rule the party fails (an operator's age) still takes the row off the list.
import { describe, expect, it } from "vitest";
import { rankCandidates } from "../../src/plan/candidates.ts";
import { buildPlan } from "../../src/plan/engine.ts";
import { fitOf, profileOf, scorePlace } from "../../src/plan/score.ts";
import type { PlanCandidatesQuery } from "../../src/schema/api/plan.ts";
import { EMPTY_DRIVE, ageLimited, mkBuild, mkInput, mkPlace, mkRow, placesMap } from "./engine-fixture.ts";

const kid7 = profileOf({ adults: 2, children: [7], walkKm: null }, "standard");
const larch = mkPlace("route/larch-valley", 51.33, -116.18, { kind: "trail", distanceKm: 11.2, gainM: 535, visitMin: null });
const short = mkPlace("route/lakeshore", 51.42, -116.22, { kind: "trail", distanceKm: 4.6, gainM: 50, visitMin: null });
const steep = mkPlace("route/steep", 51.4, -116.2, { kind: "trail", distanceKm: 4, gainM: 700, visitMin: null });

describe("the candidate fit reads the walk ceiling (RB-012)", () => {
  it("an 11.2 km trail is not a fit for a 7-year-old: advice, with the numbers", () => {
    expect(fitOf(larch, kid7)).toEqual({ state: "fail", why: "Long for age 7: 11.2 km; we plan walks up to 6 km", basis: "advice" });
  });
  it("a climb over the ceiling says so too", () => {
    expect(fitOf(steep, kid7)).toMatchObject({ state: "fail", basis: "advice", why: "Steep for age 7: 700 m of climb; we plan up to 350 m" });
  });
  it("a short trail with no suitability block stays unknown (a gap is never a yes); adults have no ceiling to fail", () => {
    expect(fitOf(short, kid7).state).toBe("unknown");
    expect(fitOf(larch, profileOf({ adults: 2, children: [], walkKm: null }, "standard")).state).toBe("pass");
  });
  it("the visitor's own longest walk wins over the age band", () => {
    expect(fitOf(larch, profileOf({ adults: 2, children: [7], walkKm: 12 }, "standard")).state).not.toBe("fail");
  });
  it("an operator's rule still wins over the ceiling: the row is Not for your party", () => {
    const zip = mkPlace("place/zip", 51.3, -116.1, { kind: "trail", distanceKm: 15, suitability: ageLimited(12) });
    expect(fitOf(zip, kid7)).toMatchObject({ state: "fail", basis: "rule", why: "Needs age 12; youngest is 7" });
  });
  it("scoring keeps an advice failure on the main list, at the fail points, with its words", () => {
    const s = scorePlace(larch, { profile: kid7, month: 7, interests: [], driveMin: null });
    expect(s).toMatchObject({ fit: "fail", fitBasis: "advice", list: "main", why: "Long for age 7: 11.2 km; we plan walks up to 6 km" });
    expect(s.score.fit).toBe(0);
  });
  it("the candidate rows: the long trail is listed (no Fits chip: fit is not pass), the age-ruled one is not", () => {
    const rows = [
      mkRow("route/larch-valley", 51.33, -116.18, { kind: "trail", km: 11.2, gain_m: 535, time_band: "half-day" }),
      mkRow("route/lakeshore", 51.42, -116.22, { kind: "trail", km: 4.6, gain_m: 50, time_band: "1-2h" }),
      mkRow("place/zip", 51.3, -116.1, { kind: "activity", kids_from: 12, kids_basis: "rule" }),
    ];
    const q = { mode: "trip", cc: "CA", regions: ["CA/ontario"], party: "family-7", month: 7 } as PlanCandidatesQuery;
    const r = rankCandidates(rows, q, { centre: null, drive: EMPTY_DRIVE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const larchRow = r.data.items.find((x) => x.ref === "route/larch-valley")!;
    expect(larchRow).toMatchObject({ fit: "fail", why: "Long for age 7: 11.2 km; we plan walks up to 6 km" });
    expect(r.data.items.map((x) => x.ref)).not.toContain("place/zip");
    expect(r.data.removed.not_for_party).toBe(1);
  });
  it("the engine still plans the long trail (a Check on the day, W_CEILING), never TB_FIT", () => {
    const out = buildPlan(mkInput(mkBuild([larch.ref], { party: { adults: 2, children: [7], walkKm: null }, nights: 1, where: { mode: "trip", cc: "CA", regions: ["CA/alberta"] } }), { places: placesMap([larch]), towns: [] }));
    expect(out.didNotFit.find((m) => m.code === "TB_FIT")).toBeUndefined();
  });
});
