import { placeHref } from '@/lib/data/paths';
import type { PlaceRow, PlaceTag } from '@/lib/data/types';
import type { Honesty, PlaceKind, PublicPlaceCard } from '@/lib/public/types';

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
 */
export interface PlaceListRow {
  /** The slug; the list's row id, so `ids=` and `focus=` use slugs. */
  id: string;
  slug: string;
  name: string;
  kind: PlaceKind;
  kindLabel: string;
  /** The kind in `locations.json` (city, park, mountain ...) when the place came from there, so old links with `kind=park` still work. */
  legacyKind: string | null;
  country: string;
  country_name: string;
  region: string;
  region_name: string;
  /** Every spelling of the region the URL may carry: the slug, the name, the legacy code, the ISO code. */
  regionAliases: string[];
  area: string;
  area_name: string;
  /** The pin, for the map view, the globe link and the map-area filter. */
  lat: number | null;
  lon: number | null;
  /**
   * Three numbers a visitor reads at a glance (principle P3: how long, how hard), so they stay in the list row and the table:
   * trail length in km, climb in metres and elevation in metres. They are widely published, so principle P8 does not need
   * to hide them. Notes, source links, checks, times and suitability values stay on the place page.
   */
  km: number | null;
  gain_m: number | null;
  elevation_m: number | null;
  /** 1 to 12. */
  season: number[];
  /** The kids chip: strong-kid, yes, no or unknown. */
  kid_fit: string;
  tags: PlaceTag[];
  /** Card cover URL. */
  image: string | null;
  /** Every public trip that uses the place. Public trips are dateless, so no dates are carried. */
  trips: { slug: string; title: string }[];
  honesty: ListHonesty[];
  /** The completeness chip: its level and short label. The count of checks and which fail stay on the place page. */
  completeness: { level: 'draft' | 'usable' | 'complete'; label: string };
  /** Source types only ("instagram", "official"), for the card's source chip. No address, no date. */
  sourceTypes: string[];
  /** Whether the place has stats, and whether they are checked: a chip, never the numbers. */
  statsState: 'verified' | 'unverified' | null;
  /** True when the place has research beyond a saved pin. */
  researched: boolean;
  added: string;
  // ---- facet fields (capture contract 7.3; L3b): a type id and bands, all labels. Never a fact with a source (principle P8). ----
  /** The capture type id (`nature.trail.hike`) or the category its kind implies; the Kind pill and the type-aware facets read it. */
  type: string | null;
  /** Effort name (Stroll to Technical), or null where the profile has none or nobody has checked. */
  effort: string | null;
  kids_from: number | null;
  /** `rule` hides the place from a younger child; `advice` only fades its card. */
  kids_basis: 'rule' | 'advice' | null;
  time_band: string | null;
  price_band: string | null;
  booking: string | null;
  /** Up to six ids of yes/no facets ("swim", "!dogs"); a gap stores neither. */
  flags: string[];
}

/** Every key a list row may carry. A test compares this with the keys the builder writes. */
export const PLACE_LIST_KEYS: readonly (keyof PlaceListRow)[] = [
  'id', 'slug', 'name', 'kind', 'kindLabel', 'legacyKind', 'country', 'country_name', 'region', 'region_name', 'regionAliases', 'area', 'area_name',
  'lat', 'lon', 'km', 'gain_m', 'elevation_m', 'season', 'kid_fit', 'tags', 'image', 'trips', 'honesty', 'completeness', 'sourceTypes', 'statsState', 'researched', 'added',
  'type', 'effort', 'kids_from', 'kids_basis', 'time_band', 'price_band', 'booking', 'flags',
];

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
      completeness: { level: c.completeness.level, label: c.completeness.label },
      sourceTypes: old ? old.sources.map((s) => s.type) : [],
      statsState: hasStats ? (old?.stats_verified ? 'verified' : 'unverified') : null,
      researched: c.sources.some((o) => o !== 'locations'),
      added: old?.added ?? '',
      type: c.type,
      effort: c.bands.effort,
      kids_from: c.bands.kids_from,
      kids_basis: c.bands.kids_basis,
      time_band: c.bands.time_band,
      price_band: c.bands.price_band,
      booking: c.bands.booking,
      flags: c.bands.flags,
    };
  });
}
