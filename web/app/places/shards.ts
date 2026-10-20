import { buildPlaceRows } from '@/components/places/rows';
import type { PlaceListRow } from '@/components/places/rows';
import { loadPlaces } from '@/lib/data/places';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { buildShards } from '@/lib/entities/shards';
import type { BuiltShards } from '@/lib/entities/shards';
import { getPlace, legacyPlaceRedirects, listPlaces } from '@/lib/public';
import { buildTextIndex, cardText } from '@/lib/search/fulltext';
import type { TextIndex } from '@/lib/search/fulltext';

let cached: BuiltShards<PlaceListRow> | null = null;

/**
 * The Places list as the build writes it (backlog 3.59): the first page for the page itself, the manifest, and the row files by country.
 * Built once per build process from the same rows the page used to inline whole.
 */
export function placeShards(): BuiltShards<PlaceListRow> {
  cached ??= buildShards(buildPlaceRows(listPlaces(), loadPlaces(), legacyPlaceRedirects(), (slug) => getPlace(slug)?.elevationM ?? null), placeDescriptor, (r) => r.country);
  return cached;
}

let cachedText: Record<string, TextIndex> | null = null;

/** The full-text index (3.60), one file for each row file, over the text a place card shows. */
export function placeTextShards(): Record<string, TextIndex> {
  if (cachedText) return cachedText;
  const cards = new Map(listPlaces().map((c) => [c.slug, c]));
  const out: Record<string, TextIndex> = {};
  for (const [id, rows] of Object.entries(placeShards().files)) {
    out[id] = buildTextIndex(rows.flatMap((r) => (cards.get(r.slug) ? [{ id: r.slug, text: cardText(cards.get(r.slug)!) }] : [])));
  }
  cachedText = out;
  return out;
}
