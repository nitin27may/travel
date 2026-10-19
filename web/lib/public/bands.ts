// Facet bands and the type id of each place card (capture contract 7.3). The list shows labels and bands only, never facts with a
// source (principle P8): this module hands the card exactly the keys of `ListBands`, nothing else of the suitability record.
import { bandsOf } from '@travel/core/capture/bands.ts';
import { NO_BANDS } from '@travel/core/capture/bandKeys.ts';
import type { ListBands } from '@travel/core/capture/bandKeys.ts';
import type { World } from '@travel/core/capture/records.ts';
import { normName } from './places';
import { publicTypes } from './world';
import type { PublicPlace } from './types';

/** When a place has no capture record and no legacy (kind, subkind) pair, its kind still names a category. */
const CATEGORY_OF_KIND: Record<string, string> = {
  trail: 'nature.trail',
  lake: 'water.body',
  viewpoint: 'nature.viewpoint',
  waterfall: 'water.falls',
  sight: 'culture.heritage',
  town: 'settlement',
  area: 'nature.protected',
  lift: 'ride.lift',
  eatery: 'food.eat',
  stay: 'stay.room',
};

export interface PlaceFacets {
  type: string | null;
  bands: ListBands;
  /** The capture record the bands came from, or null. Stays inside the adapter: it is never put on a card. */
  ref: string | null;
}

/**
 * For each place, the type id and the bands. The capture record is found by the prototype id (`place/<id>`), then by a name that
 * only one capture record carries. A place with no record has the type its kind implies and no bands: every band is a gap.
 */
export function placeFacets(world: World, root: string, places: readonly PublicPlace[], protoIdOf: ReadonlyMap<string, string>): Map<string, PlaceFacets> {
  const refBySlug = new Map<string, string>();
  for (const [protoId, slug] of protoIdOf) if (world.cap.has(`place/${protoId}`)) refBySlug.set(slug, `place/${protoId}`);
  const byName = new Map<string, string[]>();
  for (const { rec } of world.cap.values()) {
    if (rec.layer === 'offer' || !rec.name || rec.ref.startsWith('part/')) continue;
    const key = normName(rec.name);
    byName.set(key, [...(byName.get(key) ?? []), rec.ref]);
  }
  const types = publicTypes(root);
  const out = new Map<string, PlaceFacets>();
  for (const p of places) {
    let ref = refBySlug.get(p.slug);
    if (!ref) {
      const hit = byName.get(normName(p.name));
      if (hit?.length === 1) ref = hit[0];
    }
    const cap = ref ? world.cap.get(ref)?.rec : undefined;
    const type = cap?.type ?? types.byPair.get(`${p.kind}/${p.subkind ?? ''}`) ?? CATEGORY_OF_KIND[p.kind] ?? null;
    out.set(p.slug, { type, ref: ref ?? null, bands: ref ? bandsOf(world, ref) : { ...NO_BANDS, flags: [] } });
  }
  return out;
}
