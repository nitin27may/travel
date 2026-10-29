// Near mode's shared rule (N2; store.ts A17, A35, A41): the point centre, the radius, and the ranking of rows around a centre, so
// JsonStore, StubStore and a later SQL store measure, include, band, order and page the same rows. Pure: no I/O, no clock.
//
//   centre     a place (`place:<slug>`, its exact point), an area (`area:<id>`, the mean of its exact points), a town (`city`, the
//              gazetteer point) or a coordinate cell (`point:<lat>,<lon>`, at most API_LIMITS.nearPoint.decimals decimals)
//   radius     r, else the default by centre kind (25; 50 for an area), clamped to API_LIMITS.nearRadius.max with `clamped: true`
//   rows       exact points only; an approximate point is counted in `excludedApprox` whatever its distance (A13); no point: skipped
//   measure    distance.ts (haversine, inclusion on the unrounded km, distanceKm to 0.1 km, the 8-wind bearing)
//   band       a walk under WALK_KM, else the drive band of the L2 drive model's minutes when the store has the drive data (an
//              estimate: `basis: "estimate"`, `minutes: null`, A35), else the timeline rule `bandOf`
//   order      distanceKm, then sortKey(name), then ref (compareByDistance)
import { DRIVE_BAND_EDGES_MIN, WALK_KM, nearCellSlackKm } from "../config/nearby.ts";
import { modelDrive, type DriveIndex } from "../drive/model.ts";
import type { ModelPoint } from "../drive/types.ts";
import type { LatLon } from "../geo/distance.ts";
import * as S from "../schema/api/index.ts";
import { compareByDistance, measure, within, type Measure } from "./distance.ts";

type Band = (typeof S.NEAR_BANDS)[number];

/** The point of `point:<lat>,<lon>`, rounded to the cell (a direct store call may skip the schema), or null for any other value. */
export function pointOfToken(token: string | undefined): LatLon | null {
  if (!token) return null;
  const m = S.NEAR_POINT_RE.exec(token);
  if (!m) return null;
  const f = 10 ** S.API_LIMITS.nearPoint.decimals;
  const lat = Math.round(Number(m[1]) * f) / f;
  const lon = Math.round(Number(m[2]) * f) / f;
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/** The cell slack (config/nearby.ts): a client re-measuring from its own point inside the cell asks for `r` plus this. */
export const cellSlackKm = nearCellSlackKm;

/** The point centre as it is answered: no coordinates (A41). */
export const POINT_CENTRE: S.NearPage["centre"] = { kind: "point", key: "point", name: "", lat: null, lon: null };

/** The radius rule (case K3): the default by centre kind, clamped to the max. */
export function nearRadius(r: number | undefined, kind: S.NearPage["centre"]["kind"]): { r: number; clamped: boolean } {
  const lim = S.API_LIMITS.nearRadius;
  const asked = r ?? (kind === "area" ? lim.areaDefault : lim.default);
  return asked > lim.max ? { r: lim.max, clamped: true } : { r: asked, clamped: false };
}

/** The band of a drive estimate in minutes, on the same edges as `bandOf` (nearby spec 5.1). */
export function bandOfMinutes(km: number, minutes: number | null): Band | null {
  if (km < WALK_KM) return "walk";
  if (minutes === null) return null;
  const [a, b, c] = DRIVE_BAND_EDGES_MIN;
  return minutes < a ? "lt15" : minutes < b ? "15-30" : minutes < c ? "30-60" : "60-120";
}

/**
 * A band function over the L2 drive model: the model's minutes from the centre to the row, banded. The centre takes the row's country
 * when it has none of its own (a coordinate cell or an area): within the 100 km cap the two ends nearly always share it, and a
 * cross-border pair only loses the border minutes. A row the model cannot reach (no road) falls back to `bandOf`.
 */
export function driveBander(drive: DriveIndex, centreCc: string | null): (centre: LatLon, row: S.PlaceRow, m: Measure) => Band {
  return (centre, row, m) => {
    if (m.km < WALK_KM) return "walk";
    const cc = row.country ? row.country.toUpperCase() : null;
    const a: ModelPoint = { lat: centre.lat, lon: centre.lon, cc: centreCc ?? cc };
    const b: ModelPoint = { lat: row.lat!, lon: row.lon!, cc };
    return bandOfMinutes(m.km, modelDrive(a, b, {}, drive).minutes) ?? m.band;
  };
}

export interface Ranked {
  rows: S.NearRow[];
  excludedApprox: number;
}

/** The rows within `r` of the centre, measured, banded and in the near order (A17), and the approximate rows left out (A13). */
export function rankNear(rows: readonly S.PlaceRow[], centre: LatLon, r: number, band?: (centre: LatLon, row: S.PlaceRow, m: Measure) => Band): Ranked {
  let excludedApprox = 0;
  const hits: S.NearRow[] = [];
  for (const row of rows) {
    if (row.lat === null || row.lon === null) continue;
    if (row.approx) {
      excludedApprox++;
      continue;
    }
    const m = measure(centre, { lat: row.lat, lon: row.lon });
    if (!within(m, r)) continue;
    hits.push({ ...row, distanceKm: m.distanceKm, bearing: m.bearing, band: band ? band(centre, row, m) : m.band, basis: "estimate", minutes: null });
  }
  hits.sort(compareByDistance);
  return { rows: hits, excludedApprox };
}
