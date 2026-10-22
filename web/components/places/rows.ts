import { placeHref } from '@/lib/data/paths';
import type { PlaceRow } from '@/lib/data/types';
import type { Honesty, PublicPlaceCard } from '@/lib/public/types';
import { PLACE_LIST_ROW_KEYS, type PlaceListRow as ContractPlaceListRow } from '@travel/core/schema/api/place.ts';

/** The honesty chip a card shows: the id and the label. The reason is a sentence of its own and stays on the place page. */
export interface ListHonesty {
  id: Honesty['id'];
  label: string;
}

/**
 * One row of the Places list: card and filter fields only (principle P8, backlog 2.24). The row is built at
 * build time and ships inside the list page, so it must never carry what the place page holds: facts, links,
 * suitability values, times or notes. `tests/data/light-data.test.ts` pins the key list. A place's personal
 * status (idea, planned, visited ...) is household data and is deliberately never read here either.
 *
 * The shape is the Zod schema `placeListRow` in core (API-1a, schema diff 13.1 item 2): the type is its `z.infer`, and the key list
 * below is the schema's keys, so the allowlist has one home. The API's `PlaceRow` is this row plus `ref`.
 */
export type PlaceListRow = ContractPlaceListRow;

/** Every key a list row may carry, derived from the schema. A test compares this with the keys the builder writes. */
export const PLACE_LIST_KEYS: readonly (keyof PlaceListRow)[] = PLACE_LIST_ROW_KEYS;

/** Joins the adapter cards with the legacy rows through the old place URLs that LD already maps to slugs. */
export function buildPlaceRows(
  cards: readonly PublicPlaceCard[],
  legacy: readonly PlaceRow[],
  redirects: readonly { from: string; to: string }[],
  elevationOf: (slug: string) => number | null = () => null,
): PlaceListRow[] {
  const slugOfLegacy = new Map(redirects.map((r) => [r.from, r.to.replace(/^\/places\//, '').replace(/\/$/, '')]));
  const legacyBySlug = new Map<string, PlaceRow>();
  for (const row of legacy) {
    const slug = slugOfLegacy.get(placeHref(row.id));
    if (slug) legacyBySlug.set(slug, row);
  }
  return cards.map((c): PlaceListRow => {
    const old = legacyBySlug.get(c.slug);
    const country = c.areaChain.find((a) => a.level === 'country');
    const state = c.areaChain.find((a) => a.level === 'state');
    const district = c.areaChain.find((a) => a.level === 'district');
    const hasStats = c.stats.distanceKm !== null || c.stats.gainM !== null || Boolean(c.stats.hours);
    return {
      id: c.slug,
      slug: c.slug,
      name: c.name,
      kind: c.kind,
      kindLabel: c.kindLabel,
      legacyKind: old?.kind ?? null,
      country: (country?.slug ?? '').toUpperCase(),
      country_name: country?.name ?? '',
      region: state?.slug ?? '',
      region_name: state?.name ?? '',
      regionAliases: [state?.slug, state?.name, old?.region, old?.region_name, old?.region_iso].filter((x): x is string => Boolean(x)),
      area: district?.slug ?? '',
      area_name: district?.name ?? '',
      lat: c.point?.lat ?? null,
      lon: c.point?.lon ?? null,
      km: c.stats.distanceKm,
      gain_m: c.stats.gainM,
      elevation_m: elevationOf(c.slug) ?? old?.elevation_m ?? null,
      season: c.season,
      kid_fit: c.kidFit || 'unknown',
      tags: old ? old.tags.map((t) => ({ id: t.id, label: t.label, kind: t.kind })) : [],
      image: c.photo?.url ?? null,
      trips: c.trips.map((t) => ({ slug: t.slug, title: t.title })),
      honesty: c.honesty.map((h) => ({ id: h.id, label: h.label })),
      // the list never carries the workshop's word "Draft": the label is Basics only, Early research, Partly checked or Checked
      completeness: { level: c.completeness.level, label: c.completeness.label },
      statsState: hasStats ? (old?.stats_verified ? 'verified' : 'unverified') : null,
      researched: c.sources.some((o) => o !== 'locations'),
      type: c.type,
      effort: c.bands.effort,
      kids_from: c.bands.kids_from,
      kids_basis: c.bands.kids_basis,
      time_band: c.bands.time_band,
      price_band: c.bands.price_band,
      booking: c.bands.booking,
      flags: c.bands.flags,
      walk_band: c.bands.walk_band,
      shape: c.bands.shape,
      best_time: c.bands.best_time,
      badge: c.badge,
    };
  });
}
