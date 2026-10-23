// The nearest town of a point (META-2; capture contract 3.7, nearby spec 3.1): the nearest settlement of at least 1,000 people within 50 km,
// else the value `none_within_50km`, which is an answer and never a gap. Pure: the towns come in as rows, distances from core/src/geo only.
// A tie in distance goes to the larger town, then to the lower id, so two runs always agree.
import { PLACEMENT_RULES } from "../capture/placementBlock.ts";
import { haversineKm, type LatLon } from "../geo/distance.ts";
import { NEAR_TOWN_NONE } from "../schema/capture/points.ts";

/** What the derivation needs of a town: the id, the point GeoNames holds, its size and its GeoNames id (provenance). */
export interface NearTown extends LatLon {
  id: string;
  pop: number;
  geonamesId: number;
}

export interface NearTownResult {
  /** a town id, or `none_within_50km` */
  town: string;
  /** straight-line km to the town's point, one decimal; null when there is none */
  km: number | null;
  geonamesId: number | null;
}

/** Kilometres rounded to one decimal, the precision `near_town_km` is stored at. */
export const roundKm = (km: number): number => Math.round(km * 10) / 10;

export function nearestTown(p: LatLon, towns: readonly NearTown[], radiusKm: number = PLACEMENT_RULES.townRadiusKm, minPop: number = PLACEMENT_RULES.townMinPopulation): { town: NearTown; km: number } | null {
  let best: { town: NearTown; km: number } | null = null;
  for (const t of towns) {
    if (t.pop < minPop) continue;
    const km = haversineKm(p, t);
    if (km > radiusKm) continue;
    if (!best || km < best.km || (km === best.km && (t.pop > best.town.pop || (t.pop === best.town.pop && t.id < best.town.id)))) best = { town: t, km };
  }
  return best;
}

export function deriveNearTown(p: LatLon, towns: readonly NearTown[]): NearTownResult {
  const hit = nearestTown(p, towns);
  return hit ? { town: hit.town.id, km: roundKm(hit.km), geonamesId: hit.town.geonamesId } : { town: NEAR_TOWN_NONE, km: null, geonamesId: null };
}
