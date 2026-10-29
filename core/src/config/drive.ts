// The drive-time model's parameters (driving-time-model.md 4.3 to 4.6 and 6.3; DT-C, 27 Oct 2026), defined once. Pure and framework-free.
//
// These are the measured prior of spec section 2.3: `realisation` was fitted on the Rockies routed legs and held for every country,
// `detourByTerrain` is measured for "mountain" (1.37 road / line in the Rockies) and "alpine" (1.82 in the Dolomites) and a prior for
// the rest (to check against the first wave 0 urban and flat legs, DT-K). Per-country values (legal limits, winter factors, border
// and ferry defaults) are data: data/reference/drive/countries.json, never here. Calibration (data/reference/drive/generated/
// calibration.json) corrects the prior per (country, terrain, band) cell; it never edits these numbers.

/** The terrain classes of driving-time-model.md 4.3, in order from the straightest roads to the most winding. */
export const DRIVE_TERRAINS = ["flat", "rolling", "hilly", "mountain", "urban", "alpine", "coastal-fjord"] as const;

export const DRIVE_MODEL = {
  /** straight-line band edges in km: under 10, 10-30, 30-60, 60-150, over 150 */
  bandEdges: [10, 30, 60, 150],
  bandIds: ["lt10", "10-30", "30-60", "60-150", "gt150"],
  /** R[band]: the share of the rural legal limit a car realises over a leg of that straight-line band */
  realisation: [0.45, 0.62, 0.75, 0.8, 0.82],
  /**
   * The straight-line km at which each band's R (and calibration factor) holds exactly; between two knots the value is linear, and
   * flat outside the first and last. A step at the band edges would make a 11 km leg faster than a 9 km one (spec 6.3 asks for
   * monotonic minutes), so the spec's per-band values are read as values at the band centres.
   */
  bandKnots: [5, 20, 45, 105, 225],
  /** D[t]: road km per straight km by terrain, before the short-hop term */
  detourByTerrain: { flat: 1.2, rolling: 1.25, hilly: 1.3, mountain: 1.3, urban: 1.35, alpine: 1.6, "coastal-fjord": 1.7 },
  /** detour(t, d) = D[t] x (1 + shortHopExtra x e^(-d / shortHopScale)): shorter hops wind more */
  shortHopExtra: 0.35,
  shortHopScale: 10,
  /** minutes to park and get going, added once per leg */
  parkMin: 2,
  /** [Q10, Q90] of routed / prior on the 201 pairs of spec 2.2: the range of an uncalibrated cell */
  priorRange: [0.88, 1.53],
  /** a country with no profile row: this rural limit (km/h) and terrain, and the confidence drops to `rough` */
  fallbackRuralKmh: 80,
  fallbackTerrain: "hilly",
  /** speed cap (km/h) on the unpaved share of an area (OSRM's gravel cap) */
  unpavedCapKmh: 40,
  /** city entry: minutes per end inside a town of at least `pop` people (L2 only); the first matching row wins */
  cityEntry: [
    { pop: 1_000_000, min: 8 },
    { pop: 250_000, min: 4 },
  ],
  /** ferry check-in when neither the crossing nor the country says */
  ferryCheckinDefaultMin: 20,
} as const;

export const DRIVE_CALIBRATION = {
  /** shrink a cell's factor toward 1.0 with weight n / (n + shrinkPairs) */
  shrinkPairs: 20,
  /** pairs under this straight-line distance are walks, not drive pairs (spec 2.1) */
  minStraight: 1.2,
  /** a cell with at least this many pairs that still shows a median bias beyond `cellBiasLimit` fails the check (the profile is wrong) */
  cellCheckPairs: 30,
  cellBiasLimit: 0.15,
  /** a band (all countries) with at least this many pairs may not show a median bias beyond `cellBiasLimit` */
  bandCheckPairs: 20,
  /** golden mean absolute error limits (spec 6.3): all pairs, then by country */
  goldenLimit: 0.22,
  goldenLimitByCountry: { CA: 0.2, IT: 0.33 } as Readonly<Record<string, number>>,
  /** `--write` refuses a calibration whose golden mean error is worse than the committed one by more than this (3 points) */
  regressionLimit: 0.03,
  /** decimals kept in the generated file (byte-stable across runs) */
  decimals: 3,
  /** the radius (km) within which a point's nearest town gives its country and subdivision */
  townLookupRadius: 250,
} as const;

/** The display rules of spec 4.6 (rounding) and 4.2 (the near-mode keep factor). */
export const DRIVE_DISPLAY = {
  /** [upper bound in minutes (exclusive), step]; the last row has no bound */
  rounding: [
    [60, 5],
    [240, 10],
    [Number.POSITIVE_INFINITY, 15],
  ] as readonly (readonly [number, number])[],
  /** near mode keeps a candidate when estimate x keepFactor is within the limit (recall 100% on the golden set) */
  keepFactor: 0.75,
} as const;

/** The leg cache key rules (spec 5.6; DT-L uses them inside TB-L). */
export const DRIVE_CACHE = {
  /** g: keys are geohashes of this many characters (about 1.2 x 0.6 km) */
  geohashChars: 6,
  /** samples per side of the grid tested against the home radius before a cell may be written (corners included) */
  homeGridSide: 9,
  /** cached routed values older than this many days are a miss */
  maxAgeDays: 180,
  /** at most this many sources or targets in one matrix call */
  matrixMax: 40,
} as const;

/** The routed inputs of the calibration and the golden set: every stored ORS drive leg, plus these research runs (spec 2.1). */
export const DRIVE_INPUTS = {
  legsDir: "data/schedules/legs",
  runs: ["research/runs/DATA-D9R/ors-legs-2026-10-25.json"],
  profile: "driving-car",
} as const;

/**
 * The server leg service (TB-L; spec 4.1 L1 and 5.6): the one runtime ORS client. The key is read from the environment variable named
 * `keyEnv` (server only, never logged). ORS free tier: 500 matrix requests a day, 3,500 cells a request; the guard stops at
 * `guardShare` of `dailyCap` so a build never meets the hard limit (the page below that: DT-X triggers at 5 trips of the guard a month).
 */
export const DRIVE_ROUTING = {
  keyEnv: "ORS_API_KEY",
  baseUrl: "https://api.openrouteservice.org/v2/matrix",
  profile: "driving-car",
  engine: "ors",
  /** the ORS and OpenStreetMap line carried by every routed answer */
  attribution: "Routing by openrouteservice.org. Map data (c) OpenStreetMap contributors, ODbL.",
  /** hard cells in one matrix request (ORS limit) */
  maxCells: 3500,
  dailyCap: 500,
  guardShare: 0.8,
  /** quota bucket (core/src/quota): one global counter per UTC day */
  quotaBucket: "ors:matrix",
  quotaWindowS: 86400,
  timeoutMs: 8000,
  /** retries are off by default: a failed call falls back to the model at once */
  retries: 0,
  breaker: { failures: 3, openMs: 60_000 },
  userAgent: "nks-travel-legs/1",
} as const;
