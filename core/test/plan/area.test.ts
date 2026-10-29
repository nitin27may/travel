// Area picks (TB-PIN, BACKLOG 15.354; park-page README 7 R1; FLOW stage 3): a park, zone, area or range pick pins the trip's area. It is
// never a stop with a visit time and never a Did not fit row; its members among the picks are the stops; with none, the answer says
// "Pick places inside <area>" (TB_AREA_EMPTY, a Check) and the base is drawn towards it. Candidates for an area pick are its members.
import { describe, expect, it } from "vitest";
import { BUILDER_AREA } from "../../src/config/builder.ts";
import { inArea, isAreaPlace } from "../../src/plan/area.ts";
import { rankCandidates } from "../../src/plan/candidates.ts";
import { buildPlan } from "../../src/plan/engine.ts";
import { buildChecks } from "../../src/plan/summary.ts";
import { planBuild, type PlanBuild } from "../../src/schema/api/plan.ts";
import { planOutputs } from "../../src/schema/plan-draft.ts";
import { EMPTY_DRIVE, ONT, ageLimited, mkBuild, mkInput, mkPlace, mkRow, mkTown, placesMap, seeded } from "./engine-fixture.ts";

const placed = (out: PlanBuild): string[] => out.days.flatMap((d) => d.items.map((i) => i.ref));
const PARK = "place/algonquin-provincial-park";
const park = (over: Parameters<typeof mkPlace>[3] = {}) =>
  mkPlace(PARK, 45.55, -78.4, { kind: "park", type: "protected-area", visitMin: null, season: [], ...over });
const WHITNEY = mkTown("ca-on-whitney", "Whitney", 45.4994, -78.2269, 200, 1);
const TRAIL = mkPlace("route/track-and-tower-trail", 45.5877, -78.5546, { kind: "trail", visitMin: 120 });

describe("isAreaPlace and inArea", () => {
  it("protected areas, their zones, areas, ranges and regions are areas; a city park or a lake is not", () => {
    const area = (kind: string, type: string | null) => isAreaPlace({ kind, type, visitMin: null, visitRange: null });
    expect(area("park", "protected-area")).toBe(true);
    expect(area("park", "nature.protected.state_provincial_park")).toBe(true);
    expect(area("park", "nature.protected.national_park")).toBe(true);
    expect(area("park", "nature.protected.zone")).toBe(true);
    expect(area("park", "national_park")).toBe(true);
    expect(area("mountain", "range")).toBe(true);
    expect(area("region", null)).toBe(true);
    expect(area("area", null)).toBe(true); // the list row's kind for a park, region, valley or island
    expect(area("park", "nature.garden.urban_park")).toBe(false);
    expect(area("park", null)).toBe(false);
    expect(area("lake", null)).toBe(false);
    expect(area("park", "nature.protectedx")).toBe(false);
  });
  it("an area type with a time on site from data is a stop (a state park walked as a gorge, a day-use area)", () => {
    expect(isAreaPlace({ kind: "area", type: "nature.protected.state_provincial_park", visitMin: 150, visitRange: null })).toBe(false);
    expect(isAreaPlace({ kind: "park", type: "protected-area", visitMin: null, visitRange: [60, 120] })).toBe(false);
    const glen = mkPlace("place/watkins-glen-state-park", 45.5, -78.5, { kind: "area", type: "nature.protected.state_provincial_park", visitMin: 150 });
    const out = buildPlan(mkInput(mkBuild([glen.ref]), { places: placesMap([glen]) }));
    expect(placed(out)).toEqual([glen.ref]);
    expect("areas" in out).toBe(false);
  });
  it("membership: `within` when the place carries it, else the fallback radius from the area's point", () => {
    const a = park();
    expect(inArea(TRAIL, a)).toBe(true); // about 12 km
    expect(inArea(mkPlace("place/oxtongue-lake", 45.3606, -78.9246), a)).toBe(false); // about 45 km
    expect(inArea({ ...TRAIL, within: [] }, a)).toBe(false);
    expect(inArea(mkPlace("place/far-lake", 46.2, -77.5, { within: [PARK] }), a)).toBe(true);
    expect(inArea(a, a)).toBe(false);
    expect(inArea(mkPlace("place/no-point", null, null), a)).toBe(false);
    expect(BUILDER_AREA.fallbackMemberKm).toBe(30);
  });
});

describe("an area pick in a build", () => {
  it("with members: never a stop, never Did not fit, out of the matrix; the members are the stops", () => {
    const places = placesMap([park(), TRAIL, ...ONT.places]);
    const out = buildPlan(mkInput(mkBuild([{ ref: PARK, must: true }, TRAIL.ref, "place/arrowhead"], { month: 7 }), { places, towns: [...ONT.towns, WHITNEY] }));
    expect(placed(out)).not.toContain(PARK);
    expect(placed(out).sort()).toEqual(["place/arrowhead", TRAIL.ref]);
    expect(out.didNotFit).toEqual([]);
    expect(out.matrix.refs).toEqual([TRAIL.ref, "place/arrowhead"]);
    expect(out.areas).toMatchObject([{ ref: PARK, members: 1, code: null, reasons: [{ code: "area_pinned", text: "Algonquin Provincial Park is your area; its 1 trail is a stop" }] }]);
    expect(planBuild.safeParse(out).success).toBe(true);
  });

  it("the only pick: no Did not fit row, TB_AREA_EMPTY 'Pick places inside', a base drawn to the area, a Check counted", () => {
    const places = placesMap([park(), ...ONT.places]);
    const out = buildPlan(mkInput(mkBuild([PARK], { nights: 1 }), { places, towns: [...ONT.towns, WHITNEY] }));
    expect(placed(out)).toEqual([]);
    expect(out.didNotFit).toEqual([]);
    expect(out.areas).toEqual([
      {
        ref: PARK,
        slug: "algonquin-provincial-park",
        name: "Algonquin Provincial Park",
        members: 0,
        code: "TB_AREA_EMPTY",
        reasons: [{ code: "pick_inside", values: { area: "Algonquin Provincial Park" }, text: "Pick places inside Algonquin Provincial Park" }],
      },
    ]);
    // Whitney is the town nearest the park's point, so the base goes there, and says so
    expect(out.bases.map((b) => b.town)).toEqual(["ca-on-whitney"]);
    expect(out.bases[0]!.reasons[0]).toMatchObject({ code: "near_area", values: { area: "Algonquin Provincial Park" } });
    expect(out.bases[0]!.reasons[0]!.text).toMatch(/≈ from Algonquin Provincial Park, your area$/);
    // the area check is one more Check on top of the days' own (the long drive in and out)
    const { areas: _a, ...withoutArea } = out;
    expect(buildChecks(out)).toMatchObject({ check: buildChecks(withoutArea).check + 1, didNotFit: 0 });
    expect(planBuild.safeParse(out).success).toBe(true);
    expect(planOutputs.safeParse({ ...out, matrix: undefined, builtAt: "2026-10-28T10:00:00Z" }).success).toBe(false); // matrix is not kept
    const { matrix: _m, ...kept } = out;
    expect(planOutputs.safeParse({ ...kept, builtAt: "2026-10-28T10:00:00Z" }).success).toBe(true);
  });

  it("a day trip to an area alone: one empty day, no base, still no Did not fit", () => {
    const out = buildPlan(mkInput(mkBuild([PARK], { nights: 0 }), { places: placesMap([park()]) }));
    expect(out.bases).toEqual([]);
    expect(out.days).toHaveLength(1);
    expect(out.days[0]!.items).toEqual([]);
    expect(out.didNotFit).toEqual([]);
    expect(out.areas?.[0]?.code).toBe("TB_AREA_EMPTY");
  });

  it("an area closed in the month, or with an age rule, is still the area, never TB_CLOSED or TB_FIT", () => {
    const strict = park({ season: [6, 7, 8], suitability: ageLimited(16) });
    const out = buildPlan(mkInput(mkBuild([PARK, TRAIL.ref], { month: 1, party: { adults: 2, children: [5], walkKm: null } }), { places: placesMap([strict, TRAIL]) }));
    expect(out.didNotFit.map((m) => m.ref)).not.toContain(PARK);
    expect(out.areas?.map((a) => a.ref)).toEqual([PARK]);
  });

  it("an area the person locked on a day stays off the day (it is never a stop)", () => {
    const build = mkBuild([PARK, TRAIL.ref], { edits: [{ day: 2, refs: [PARK, TRAIL.ref], locked: [PARK, TRAIL.ref] }] });
    const out = buildPlan(mkInput(build, { places: placesMap([park(), TRAIL]) }));
    expect(placed(out)).toEqual([TRAIL.ref]);
    expect(out.days.find((d) => d.day === 2)!.items.map((i) => i.ref)).toEqual([TRAIL.ref]);
  });

  it("a build with no area pick carries no `areas` key (older answers and goldens unchanged)", () => {
    const out = buildPlan(mkInput(mkBuild(["place/arrowhead"])));
    expect("areas" in out).toBe(false);
  });

  it("a zone inside a park is an area too, and `within` decides its members", () => {
    const zone = mkPlace("part/place/algonquin-provincial-park#highway-60-corridor", 45.56, -78.6, { kind: "park", type: "nature.protected.zone", visitMin: null });
    const lake = mkPlace("place/canoe-lake", 45.5, -79.0, { within: [zone.ref, PARK] }); // 47 km from the zone's point: `within` wins
    const out = buildPlan(mkInput(mkBuild([zone.ref, lake.ref, TRAIL.ref]), { places: placesMap([zone, lake, { ...TRAIL, within: [PARK] }]) }));
    expect(out.areas).toMatchObject([{ ref: zone.ref, members: 1, reasons: [{ text: /its 1 place is a stop$/ }] }]);
    expect(placed(out).sort()).toEqual([lake.ref, TRAIL.ref].sort());
  });
});

describe("property: an area pick is never on any day, and every other pick is placed once or listed once", () => {
  const rnd = seeded(15354);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const AREA_TYPES = ["protected-area", "nature.protected.state_provincial_park", "nature.protected.zone", "range"];
  for (let run = 0; run < 40; run++) {
    it(`run ${run}`, () => {
      const nAreas = 1 + Math.floor(rnd() * 2);
      const areas = Array.from({ length: nAreas }, (_, i) =>
        mkPlace(`place/area-${run}-${i}`, 45 + rnd(), -79.5 + rnd() * 1.5, { kind: pick(["park", "mountain", "region"]), type: pick(AREA_TYPES), visitMin: null }),
      );
      const others = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) =>
        mkPlace(`place/p-${run}-${i}`, 45 + rnd(), -79.5 + rnd() * 1.5, {
          kind: pick(["lake", "trail", "waterfall", "viewpoint"]),
          visitMin: pick([30, 60, 90, 120, 180]),
          season: rnd() < 0.15 ? [1, 2] : [5, 6, 7, 8, 9, 10],
          ...(rnd() < 0.3 ? { within: [pick(areas).ref] } : {}),
        }),
      );
      const all = [...areas, ...others];
      const order = [...all].sort((a, b) => (a.ref < b.ref ? -1 : 1));
      const nights = Math.floor(rnd() * 4);
      const input = mkInput(mkBuild(order.map((p) => ({ ref: p.ref, must: rnd() < 0.3 })), { nights, month: 7 }), {
        places: placesMap(all),
        towns: [...ONT.towns, WHITNEY],
      });
      const out = buildPlan(input);
      const on = placed(out);
      const missed = out.didNotFit.map((m) => m.ref);
      const areaRefs = new Set(areas.map((a) => a.ref));
      expect(on.filter((r) => areaRefs.has(r))).toEqual([]);
      expect(missed.filter((r) => areaRefs.has(r))).toEqual([]);
      expect(out.matrix.refs.filter((r) => areaRefs.has(r))).toEqual([]);
      expect(out.areas?.map((a) => a.ref)).toEqual(order.filter((p) => areaRefs.has(p.ref)).map((p) => p.ref));
      expect(new Set(on).size).toBe(on.length);
      expect([...on, ...missed].sort()).toEqual(others.map((p) => p.ref).sort());
      for (const a of out.areas ?? []) {
        const area = areas.find((x) => x.ref === a.ref)!;
        expect(a.members).toBe(others.filter((p) => inArea(p, area)).length);
        expect(a.code).toBe(a.members === 0 ? "TB_AREA_EMPTY" : null);
      }
      expect(planBuild.safeParse(out).success).toBe(true);
      expect(JSON.stringify(buildPlan(input))).toBe(JSON.stringify(out));
    });
  }
});

describe("candidates for an area pick list its members", () => {
  const rows = [
    mkRow(PARK, 45.55, -78.4, { kind: "area", type: "nature.protected.state_provincial_park", time_band: null }),
    mkRow("route/track-and-tower-trail", 45.5877, -78.5546, { kind: "trail" }),
    mkRow("place/canoe-lake", 45.5, -79.0),
    mkRow("place/oxtongue-lake", 45.3606, -78.9246),
  ];
  const q = { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 240, near: "algonquin-provincial-park" } as const;

  it("by the fallback radius when the rows carry no `within`", () => {
    const r = rankCandidates(rows, q, { centre: null, drive: EMPTY_DRIVE });
    expect(r.ok && r.data.items.map((x) => x.ref)).toEqual(["route/track-and-tower-trail"]);
  });
  it("by `within` when the service enriches the rows with it", () => {
    const within: Record<string, string[]> = { "place/canoe-lake": [PARK], "route/track-and-tower-trail": [PARK], "place/oxtongue-lake": [] };
    const r = rankCandidates(rows, q, { centre: null, drive: EMPTY_DRIVE, enrich: (row) => (within[row.ref] ? { within: within[row.ref] } : null) });
    expect(r.ok && [...r.data.items.map((x) => x.ref)].sort()).toEqual(["place/canoe-lake", "route/track-and-tower-trail"]);
  });
  it("a pick that is not an area keeps its whole surroundings", () => {
    const r = rankCandidates(rows, { ...q, near: "canoe-lake" }, { centre: null, drive: EMPTY_DRIVE });
    expect(r.ok && r.data.items.length).toBe(3);
  });
});
