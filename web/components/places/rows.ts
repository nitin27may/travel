import { publicText } from './model';
import { placeHref } from '@/lib/data/paths';
import type { PlaceRow, PlaceSource, PlaceTag } from '@/lib/data/types';
import type { Completeness, Honesty, Photo, PlaceKind, PublicPlaceCard } from '@/lib/public/types';

/**
 * One row of the Places list: the public adapter's card (every kind, one slug) joined with the legacy store row
 * where the place came from `locations.json` (status, citations, tags, the old region code). Pure and
 * serialisable, so the server page builds it and the client list filters it.
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
  status: 'idea' | 'shortlisted' | 'planned' | 'visited' | 'dropped';
  country: string;
  country_name: string;
  region: string;
  region_name: string;
  /** Every spelling of the region the URL may carry: the slug, the name, the legacy code, the ISO code. */
  regionAliases: string[];
  area: string;
  area_name: string;
  lat: number | null;
  lon: number | null;
  elevation_m: number | null;
  season: number[];
  kid_fit: string;
  tags: PlaceTag[];
  /** One sentence, for search and the card. */
  note: string;
  image: string | null;
  photo: Photo | null;
  trip: string | null;
  trip_title: string | null;
  plans: number;
  stats: { km?: number; gain_m?: number; hours?: string };
  stats_verified: boolean;
  location_status: string;
  sources: PlaceSource[];
  completeness: Completeness;
  honesty: Honesty[];
  /** "locations", "prototype" or "trail": where the facts came from. */
  origins: PublicPlaceCard['sources'];
  added: string;
}

const STATUS_RANK = ['idea', 'shortlisted', 'planned', 'visited', 'dropped'] as const;

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
    const stats: PlaceListRow['stats'] = {};
    if (c.stats.distanceKm !== null) stats.km = c.stats.distanceKm;
    if (c.stats.gainM !== null) stats.gain_m = c.stats.gainM;
    if (c.stats.hours) stats.hours = c.stats.hours;
    const status = old && (STATUS_RANK as readonly string[]).includes(old.status) ? (old.status as PlaceListRow['status']) : c.trips.length ? 'planned' : 'idea';
    return {
      id: c.slug,
      slug: c.slug,
      name: c.name,
      kind: c.kind,
      kindLabel: c.kindLabel,
      legacyKind: old?.kind ?? null,
      status,
      country: (country?.slug ?? '').toUpperCase(),
      country_name: country?.name ?? '',
      region: state?.slug ?? '',
      region_name: state?.name ?? '',
      regionAliases: [state?.slug, state?.name, old?.region, old?.region_name, old?.region_iso].filter((x): x is string => Boolean(x)),
      area: district?.slug ?? '',
      area_name: district?.name ?? '',
      lat: c.point?.lat ?? null,
      lon: c.point?.lon ?? null,
      elevation_m: elevationOf(c.slug) ?? old?.elevation_m ?? null,
      season: c.season,
      kid_fit: c.kidFit || 'unknown',
      tags: old ? old.tags.map((t) => ({ id: t.id, label: t.label, kind: t.kind })) : [],
      note: publicText(c.summary),
      image: c.photo?.url ?? null,
      photo: c.photo,
      trip: c.trips[0]?.slug ?? null,
      trip_title: c.trips[0]?.title ?? null,
      plans: c.trips.length,
      stats,
      stats_verified: old?.stats_verified ?? false,
      location_status: old?.location_status ?? (c.honesty.some((h) => h.id === 'location_unconfirmed') ? 'unconfirmed' : 'resolved'),
      sources: old ? old.sources.map((s) => ({ type: s.type, url: s.url, post_date: s.post_date })) : [],
      completeness: c.completeness,
      honesty: c.honesty,
      origins: c.sources,
      added: old?.added ?? '',
    };
  });
}
