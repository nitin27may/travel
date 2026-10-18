import { getTrip, globeIndex, listTrips } from '@/lib/public';
import type { PublicTripCard } from '@/lib/public';
import type { TripListRow } from '@/components/trips/types';

const DEPTH_RANK = { full: 0, summary: 1, overview: 2 } as const;

/** Rows for /trips: the listed trips with the country and first-base pin from the globe index. Build time only. */
export function tripListRows(cards: PublicTripCard[] = listTrips()): TripListRow[] {
  const g = globeIndex();
  const countryName = new Map(g.continents.flatMap((c) => c.countries).map((n) => [n.slug, n.name] as const));
  const pins = new Map(g.pins.filter((p) => p.kind === 'trip').map((p) => [p.slug, p] as const));
  return cards
    .map((c) => {
      const full = getTrip(c.slug);
      const pin = pins.get(c.slug);
      const cc = pin?.path[0] ?? '';
      return {
        id: c.slug,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        depth: c.depth,
        nights: c.nights,
        days: c.daysCount,
        seasonNotSet: c.seasonNotSet,
        isDone: c.isDone,
        region: c.region,
        cover: c.cover?.url ?? null,
        seasonLabel: c.season?.label ?? null,
        seasonMonths: c.season?.months ?? [],
        legacyUrl: c.legacyUrl,
        country: cc.toUpperCase(),
        countryName: countryName.get(cc) ?? cc.toUpperCase(),
        lat: pin?.lat ?? null,
        lon: pin?.lon ?? null,
        approx: pin?.approx ?? false,
        bases: full && full.bases.length ? full.bases.length : null,
        driveAvgMin: full?.driveAvgMin ?? null,
        ageFit: full?.ageFit ?? null,
        effort: full?.effort ?? null,
        firstBase: c.firstBase,
      } satisfies TripListRow;
    })
    .sort((a, b) => Number(a.isDone) - Number(b.isDone) || DEPTH_RANK[a.depth] - DEPTH_RANK[b.depth] || a.title.localeCompare(b.title));
}

