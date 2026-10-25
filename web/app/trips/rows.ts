import { getPlace, getTrip, globeIndex, listPlaces, listTrips } from '@/lib/public';
import type { PublicTrip } from '@/lib/public';
import type { PublicTripCard } from '@/lib/public';
import type { TripListRow } from '@/components/trips/types';

const DEPTH_RANK = { full: 0, summary: 1, overview: 2 } as const;

/** The first stop of the plan that has a real position (not a country middle): where an overview of the trip can honestly put a pin. */
function firstStopPoint(trip: PublicTrip | null, slug: string): { lat: number; lon: number } | null {
  for (const day of trip?.days ?? []) {
    for (const item of day.items) {
      const p = item.placeSlug ? getPlace(item.placeSlug)?.point : null;
      if (p && p.pointSource !== 'prototype_approx') return { lat: p.lat, lon: p.lon };
    }
  }
  // else a place the plan uses (the region it is in), when one has a real position
  const used = listPlaces().find((pl) => pl.trips.some((t) => t.slug === slug) && pl.point && pl.point.pointSource !== 'prototype_approx');
  return used?.point ? { lat: used.point.lat, lon: used.point.lon } : null;
}

/** Rows for /trips: the listed trips with the country and first-base pin from the globe index. Build time only. */
export function tripListRows(cards: PublicTripCard[] = listTrips()): TripListRow[] {
  const g = globeIndex();
  const names = new Intl.DisplayNames('en', { type: 'region' });
  const countryName = new Map(g.continents.flatMap((c) => c.countries).map((n) => [n.slug, n.name] as const));
  const nameOf = (cc: string) => {
    if (!cc) return '';
    try {
      return names.of(cc.toUpperCase()) ?? countryName.get(cc) ?? cc.toUpperCase();
    } catch {
      return countryName.get(cc) ?? cc.toUpperCase();
    }
  };
  const pins = new Map(g.pins.filter((p) => p.kind === 'trip').map((p) => [p.slug, p] as const));
  return cards
    .map((c) => {
      const full = getTrip(c.slug);
      const pin = pins.get(c.slug);
      const cc = pin?.path[0] ?? '';
      const tags = c.tags;
      // a trip whose first base has no point of its own would sit in the middle of its country: use its first positioned stop when it has one
      const stop = pin?.approx ? firstStopPoint(full, c.slug) : null;
      const toronto = c.fromHubs.find((h) => h.hub === 'toronto');
      return {
        id: c.slug,
        slug: c.slug,
        title: c.title,
        depth: c.depth,
        nights: c.nights,
        days: c.daysCount,
        seasonNotSet: c.seasonNotSet,
        isDone: c.isDone,
        region: c.region,
        cover: c.cover?.url ?? null,
        seasonLabel: c.season?.label ?? null,
        seasonBasis: c.season?.basis ?? null,
        seasonMonths: c.season?.months ?? [],
        country: cc.toUpperCase(),
        countryName: nameOf(cc),
        lat: stop?.lat ?? pin?.lat ?? null,
        lon: stop?.lon ?? pin?.lon ?? null,
        approx: stop ? false : (pin?.approx ?? false),
        ageFit: tags.kidsFrom,
        kidsBasis: tags.kidsBasis,
        effort: full?.effort ?? null,
        firstBase: c.firstBase,
        countries: tags.countries.map((code) => ({ code: code.toUpperCase(), name: nameOf(code) })),
        continents: tags.continents,
        length: tags.length,
        lengthClass: c.lengthClass,
        hike: tags.hike,
        hikeBasis: tags.hikeBasis,
        strollerDays: tags.stroller === null ? null : tags.stroller.all ? 'friendly' : { n: tags.stroller.n, of: tags.stroller.of },
        activities: tags.activities,
        highlights: tags.highlights,
        around: tags.around,
        perDay: tags.perDay,
        perDayApprox: tags.perDayApprox,
        shape: tags.shape,
        fromHubMin: toronto?.minutes ?? null,
        fromHubApprox: toronto ? toronto.basis === 'estimate' : false,
      } satisfies TripListRow;
    })
    .sort((a, b) => Number(a.isDone) - Number(b.isDone) || DEPTH_RANK[a.depth] - DEPTH_RANK[b.depth] || a.title.localeCompare(b.title));
}

