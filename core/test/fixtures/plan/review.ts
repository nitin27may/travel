// The five trips of the builder review (TB-R1, docs/v2/design/trip-builder/review-TB-R1-2026-10-29.md section 7), plus its infeasible
// weekend (RB-005) and the Toronto day trip (RB-008): the engine inputs the plan service read from the real catalogue on 28 Oct 2026,
// frozen in review/<name>.input.json (places as the Places rows give them, the towns layer around the picks, the public hub or airport
// point). The Italian picks carry the point of their row (RB-003 makes every candidate placeable; until then the service read 7 of 12
// as "no location"). The drive model is the real one (data/reference/drive), so a recalibration shows in these goldens on purpose.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDriveData } from "../../../src/drive/load.ts";
import { indexDriveData, type DriveIndex } from "../../../src/drive/model.ts";
import type { EngineInput, EnginePlace, EnginePoint, EngineTown } from "../../../src/plan/engineTypes.ts";
import type { PlanBuildInput } from "../../../src/schema/api/plan.ts";
import type { GoldenCase } from "./types.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
let drive: DriveIndex | undefined;
/** The real drive model, read once. */
export const realDrive = (): DriveIndex => (drive ??= indexDriveData(loadDriveData(REPO).data));

interface Frozen {
  name: string;
  build: PlanBuildInput;
  start: EnginePoint | null;
  gateway: EnginePoint | null;
  tz: string;
  towns: EngineTown[];
  places: EnginePlace[];
}

function load(name: string): GoldenCase {
  const f = JSON.parse(readFileSync(new URL(`review/${name}.input.json`, import.meta.url), "utf8")) as Frozen;
  const input: EngineInput = {
    build: f.build,
    places: new Map(f.places.map((p) => [p.ref, p])),
    towns: f.towns,
    start: f.start,
    gateway: f.gateway,
    tz: f.tz,
    drive: realDrive(),
  };
  return { name: `review-${f.name}`, input };
}

/** Week by air to Alberta: YYC, 7 nights, Moves fewer, Banff and Jasper parks picked with five places, a 7-year-old (RB-001, RB-002). */
export const albertaAir = (): GoldenCase => load("alberta-air-week");
/** A week by car from Calgary: 7 nights, seven picks on both sides of the Icefields Parkway (RB-001, RB-002). */
export const albertaCar = (): GoldenCase => load("alberta-car-week");
/** Longer holiday in Italy: Venice airport, 14 nights, 12 picks in South Tyrol and the Veneto, one must (RB-001, RB-002, RB-012). */
export const italy = (): GoldenCase => load("italy-15-days");
/** A Quebec family week by air: Quebec City airport, 7 nights, Montmorency and the Gaspe peninsula (two musts). */
export const quebecFamily = (): GoldenCase => load("quebec-family");
/** Algonquin and Muskoka from the Toronto hub: 2 nights, six picks. */
export const algonquinWeekend = (): GoldenCase => load("algonquin-weekend");
/** The review's infeasible weekend: 1 night from Calgary, seven picks, all Must see (RB-005). */
export const weekendMusts = (): GoldenCase => load("weekend-all-musts");
/** A day trip from Toronto, 3 h each way: Muskoka places about 2 h 40 away (RB-008). */
export const daytripToronto = (): GoldenCase => load("daytrip-toronto");

export const REVIEW_TRIPS = [albertaAir, albertaCar, italy, quebecFamily, algonquinWeekend, weekendMusts, daytripToronto] as const;
