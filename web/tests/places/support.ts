import { buildPlaceRows, type PlaceListRow } from '@/components/places/rows';
import { loadPlaces } from '@/lib/data/places';
import { createPublicData } from '@/lib/public';

let cached: PlaceListRow[] | null = null;

/** The rows the Places page builds: every public place, joined with the legacy store where one exists. */
export function placeRows(): PlaceListRow[] {
  if (cached) return cached;
  const data = createPublicData();
  cached = buildPlaceRows(data.listPlaces(), loadPlaces(), data.legacyPlaceRedirects());
  return cached;
}
