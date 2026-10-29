// The trip builder engine's numbers (trip-builder.md 4.3 to 4.7; FLOW TF7, TF8; task TB-E1), defined once. Pure constants: the engine
// (core/src/plan/engine.ts, score.ts, candidates.ts, pack.ts, reasons.ts) reads them, and so may a client re-flow later (TB-E4). A
// change to a weight or a cap is a change to this file only; core/test/plan/engine.test.ts pins the ones the spec states.

/** The engine version a build carries (`lastBuild.engine`, PLAN_ENGINE_RE): bump it when a change moves a placement. */
export const BUILDER_ENGINE = "tb-e2.1";

/** Stage 1, the candidate score (4.3). Integer points, so ties are exact. */
export const BUILDER_SCORE = {
  /** the relevance badge (`data/relevance`) */
  draw: { journey: 40, detour: 25, local: 10, unknown: 15 },
  /** suitability for the party; a fail removes the row from the default list */
  fit: { pass: 30, unknown: 10, fail: 0 },
  /** the chosen month against the season months; closed removes the row */
  season: { in: 20, shoulder: 8, unknown: 8, closed: 0 },
  /** each interest (a chosen facet value) the row matches, up to `themeMax` */
  themeEach: 10,
  themeMax: 20,
  /** one-way drive from the centre: the first band whose `underMin` is above the drive wins; beyond the last, 0 */
  distance: [
    { underMin: 30, points: 10 },
    { underMin: 60, points: 6 },
    { underMin: 120, points: 3 },
  ],
  /** completeness at the required tier (`usable` or `complete`) */
  quality: 5,
} as const;

/** The relevance badge labels a Places row carries (`badge`), mapped to the draw tier (web/lib/public/relevance.ts BADGE_LABEL). */
export const BUILDER_BADGES: Readonly<Record<string, "journey" | "detour" | "local">> = {
  "Worth the journey": "journey",
  "Worth a detour": "detour",
  "Local favourite": "local",
};

/** A Places row's `time_band` as minutes on site, for a row with no data duration (capture bands; 4.3 "the type's rule" otherwise). */
export const BUILDER_TIME_BAND_MIN: Readonly<Record<string, number>> = {
  "<1h": 45,
  "1-2h": 90,
  "2-4h": 180,
  "half-day": 240,
  "full-day": 420,
  "multi-day": 480,
};

/** The candidate list's duration bands (api/plan.ts PLAN_DURATION_BANDS) by their upper edge in minutes; past the last: `full_day`. */
export const BUILDER_DURATION_BAND_EDGES = [
  { underMin: 60, band: "lt1h" },
  { underMin: 120, band: "1to2h" },
  { underMin: 240, band: "2to4h" },
  { underMin: 360, band: "4to6h" },
] as const;

/** Stages 2 to 4: bases, nights and packing. */
export const BUILDER_PACK = {
  /** the day-trip radius is half the day's driving (`driveDayMin`, else the pace's `driveLimitMin`), capped at this, one way (TF7, 4.4) */
  dayTripRadiusCapMin: 120,
  /**
   * a pick outside a town's day-trip radius costs this many radii in the base objective (4.4): a must costs more than a nice-to-have,
   * but one far must never drags the base away from every other pick (the infeasible fixture: the must is TB_TOO_FAR, nothing else moves)
   */
  uncoveredRadii: { must: 8, other: 4 },
  /** candidate base towns considered (4.4) */
  baseTowns: 40,
  /** minutes the lodging signal takes off a town's cost per class step (4.4 `L`): breaks near ties, never overrules geography */
  lodgingStepMin: 15,
  /** lunch on every full day, as minutes the packer keeps free (the scheduler places the real meal) */
  mealAllowanceMin: 60,
  /**
   * the share of a day (its cap less lunch) an arrival or departure day offers, before the drive in or out is taken off it: a near
   * plan leaves home in the morning (the whole day); a trip by air loses about half of it to the flight and the car hire
   */
  edgeDayShare: { near: 1, trip: 0.5 },
  /** Held-Karp orders a day exactly up to this many stops; 2-opt beyond (4.6 step 3) */
  exactOrderMax: 10,
  /** relocate moves the local search may make (4.6 step 4) */
  localSearchMoves: 200,
  /** "Add N days" tries 1 to this many more days before it says even that does not fit (4.7) */
  addDaysMax: 3,
  /** a trail with no time, no range and no length gets this many minutes, shown as an estimate */
  trailFallbackMin: 120,
  /**
   * Spreading the stops (review TB-R1 RB-001): the days fill in order, each with up to this many stops at the pace before the next day
   * gets one (more when the stops outnumber the days), so a week never holds three stops on one day and five empty days
   */
  stopsPerDay: { relaxed: 1, standard: 2, full: 3 },
  /** a stop this many minutes (either way) from one already on a day joins it beyond the quota: two lakes 15 min apart share a day */
  clusterMin: 30,
  /** how many such close stops a day may take beyond its quota (so a chain of close stops never empties the next day) */
  clusterExtra: 1,
  /** sweep rotations the seed tries when the quota is large (more stops than days); with a small quota every rotation is tried */
  seedRotationsMax: 8,
  /** swaps between days are tried while the quota is at most this (beyond it the days are full and swaps cost more than they give) */
  swapQuotaMax: 4,
  /**
   * a day with a way in, out or a move may drive this many minutes beyond it even when the way alone takes the day's driving: a stop
   * near the line (4.6 step 2, "the picks within 30 min of the line go first"; Athabasca Glacier on the Banff to Jasper move)
   */
  lineDetourMin: 30,
} as const;

/**
 * Several bases chosen by the visitor (TB-E2; trip-builder.md 4.5, 4.6): the visitor's bases in their order, nights shared by
 * demand, a move day between two bases (core/src/plan/bases.ts, moves.ts). Two or more bases in the build turn this on; with none or
 * one the engine is K = 1 as before.
 */
export const BUILDER_BASES = {
  /** a base whose nights the visitor left open gets at least this many when the open nights allow it for every such base (4.5) */
  nightsFloor: 2,
  /** each move day that starts or ends at a base adds this share of a day to the base's demand (4.5 "plus 0.5 for each move day") */
  moveDayDemandShare: 0.5,
  /**
   * "Let the plan choose" (review TB-R1 RB-002; FLOW TF8): with no base the visitor pinned, the plan adds a base near the picks beyond a
   * day out from its first base, while each base can have this many nights by the moves preference (4.4 Kmax): 7 nights and Fewer
   * moves allow one move (two bases), Balanced and Shorter drives one base per 2 nights. At most PLAN_LIMITS.bases
   */
  autoNightsPerBase: { fewer: 3, balanced: 2, shorter: 2 },
  /** two towns whose plans cost within this many minutes of each other in all are a tie: the larger town wins (a lodge loses to Jasper) */
  autoTieMin: 20,
  /** M of the base objective (4.4): the minutes a move costs in packing and check-in, by the moves preference */
  moveCostMin: { fewer: 240, balanced: 120, shorter: 60 },
  /**
   * what a pick no base reaches costs in that objective, minutes: a pick the person made is worth more than a move (240 at Fewer) and
   * the drive to a base near it, so Maligne Lake and Athabasca Glacier bring Jasper in a week (RB-002); a must is worth a whole day
   */
  autoUncoveredMin: { must: 1440, other: 720 },
} as const;

/** The candidate scan (P8: server side only, bounded). */
export const BUILDER_SCAN = {
  /** rows read from the store for one candidates answer, at most (the store's own page cap is 100) */
  maxRows: 2000,
  /** the store's page size used while scanning */
  pageSize: 100,
  /** straight-line km per hour of one-way drive used to bound the near-mode box before the drive model filters it (a generous upper bound) */
  reachKmPerHour: 100,
  /** the near strip's default rows (FLOW TF6 and stage 4: one strip of 6, "Also within your driving" up to 12) */
  stripDefault: 6,
  stripMax: 12,
} as const;

/**
 * Area picks (TB-PIN, BACKLOG 15.354; park-page README 7 R1): a pick that is a protected area, a zone, an area or a range, with no time
 * on site from data, is the trip's AREA, never a stop with a visit time (core/src/plan/area.ts; with a data time it is a stop). Its members among the picks are the stops; with none, the base is drawn towards the area and the
 * answer says "Pick places inside <area>" (TB_AREA_EMPTY).
 */
export const BUILDER_AREA = {
  /** capture type ids (and the older list-row types) that make a pick an area, matched exactly */
  types: ["protected-area", "national_park", "provincial_or_state_park", "zone", "area", "range"],
  /** capture type id prefixes that make a pick an area: every protected area and its zones (`nature.protected.zone`) */
  typePrefixes: ["nature.protected"],
  /** place kinds that are always an area, whatever the type: the list row's `area` (park, region, valley, island) and `region` */
  kinds: ["area", "region"],
  /**
   * Until EG-Q's `within` closure reaches the engine (EnginePlace.within), a pick counts as inside an area when its point lies this many
   * km (straight line) from the area's point at most. A place that carries `within` is never measured: its list is the answer.
   */
  fallbackMemberKm: 30,
  /**
   * The fallback radius by area type, first match (type id or a prefix of it): a national park is a long valley system (Banff and Jasper
   * run 200 km and more along the Icefields Parkway), so its members reach further than a provincial park's (review TB-R1 RB-002)
   */
  fallbackMemberKmByType: [{ type: "nature.protected.national_park", km: 100 }, { type: "national_park", km: 100 }],
  /**
   * Type prefixes that keep a pick of an area KIND a stop: an island or a rock (`nature.landform.island`, Perce Rock) is visited, not
   * the trip's area. A park, zone or region stays an area
   */
  stopTypePrefixes: ["nature.landform"],
  /**
   * An area picked with nothing inside it stands for the stops not picked yet: the base objective adds this many round trips from the
   * town into the area per day of the plan (a stop counts one round trip in all), so the base sits near the area, not near the start
   */
  emptyAreaTripsPerDay: 1,
} as const;
