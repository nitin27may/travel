import { buildPlaceRows } from '@/components/places/rows';
import type { PlaceListRow } from '@/components/places/rows';
import { loadPlaces } from '@/lib/data/places';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { buildShards } from '@/lib/entities/shards';
import type { BuiltShards } from '@/lib/entities/shards';
import { getPlace, legacyPlaceRedirects, listPlaces } from '@/lib/public';

let cached: BuiltShards<PlaceListRow> | null = null;

/**
 * The Places list as the build writes it (backlog 3.59): the first page for the page itself, the manifest, and the row files by country.
 * Built once per build process from the same rows the page used to inline whole.
 */
export function placeShards(): BuiltShards<PlaceListRow> {
  cached ??= buildShards(buildPlaceRows(listPlaces(), loadPlaces(), legacyPlaceRedirects(), (slug) => getPlace(slug)?.elevationM ?? null), placeDescriptor, (r) => r.country);
  return cached;
}
