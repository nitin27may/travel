// Reads the public trip behind `?seed=<slug>` through the one data boundary (P9) and turns it into the parts `seedState` needs. Lazy: the
// builder loads this only when the link carries a seed. Public data only: the trip's plan model, its places' public rows, the country's
// areas and the towns around a stop. No request carries anything of the visitor's.
import type { PlaceRow, Town } from '@travel/core/schema/api/index.ts';
import { haversineKm } from '@travel/core/geo/distance.ts';
import { countryName } from './draft';
import { seedState, SEED_MAX_PICKS, type SeedBase, type SeedParts, type SeedRow, type Seeded } from './seed';
import { MAX_BASES } from './bases';

export type SeedResult = { status: 'ok'; seeded: Seeded } | { status: 'missing' } | { status: 'empty' };

const NOT_A_STOP = new Set(['meal', 'break', 'rest', 'checkin', 'checkout', 'transfer', 'booking', 'sun', 'leg', 'start', 'end']);
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** The town of a trip's base: the nearby town that carries its name, else the nearest to the base's point within 25 km. Null: none. */
export function townOfBase(towns: readonly Town[], base: { name: string; lat: number; lon: number }): Town | null {
  const want = norm(base.name);
  const named = towns.find((t) => want === norm(t.name) || want.startsWith(`${norm(t.name)} `) || want.endsWith(` ${norm(t.name)}`));
  if (named) return named;
  let best: Town | null = null;
  let bestKm = 25;
  for (const t of towns) {
    const km = haversineKm({ lat: base.lat, lon: base.lon }, { lat: t.lat, lon: t.lon });
    if (km < bestKm) {
      best = t;
      bestKm = km;
    }
  }
  return best;
}

export async function loadSeed(slug: string, id: string, nowIso: string): Promise<SeedResult> {
  const [{ tripPlanModel }, data] = await Promise.all([import('@/lib/trip-edit/planModel'), import('@/lib/client/data')]);
  const model = await tripPlanModel(slug);
  if (!model) return { status: 'missing' };

  // the stops in the trip's order, once each, and the day each lies on
  const order: string[] = [];
  const dayOf = new Map<string, number>();
  for (const d of model.days) {
    for (const s of d.stops) {
      if (!s.placeSlug || NOT_A_STOP.has(s.kind) || dayOf.has(s.placeSlug)) continue;
      order.push(s.placeSlug);
      dayOf.set(s.placeSlug, d.n);
    }
  }
  if (!order.length) return { status: 'empty' };

  const rows: SeedRow[] = [];
  for (let i = 0; i < order.length && i < SEED_MAX_PICKS + 20; i += 20) {
    const page = await data.placesPage({ ids: order.slice(i, i + 20) }, 1, 20);
    for (const r of (page?.items ?? []) as PlaceRow[]) rows.push({ ref: r.ref, slug: r.slug, name: r.name, country: (r.country ?? '').toUpperCase(), region: r.region ?? '' });
  }

  const title = await data.resolveRefs([`trip:${slug}`]).then((r) => r?.[0]?.name ?? null).catch(() => null);
  const cc = rows.find((r) => r.country)?.country ?? null;
  const offered = cc ? await data.planRegions(cc).then((r) => (r ? new Set([...r.groups.flatMap((g) => g.regions), ...r.ungrouped].map((x) => x.id)) : null)).catch(() => null) : null;

  // the trip's bases: each is a town of the towns layer near the stops of its days, so the engine can route to it
  const days = model.days.filter((d) => d.n >= 1).length;
  const bases: SeedBase[] = [];
  for (const b of model.route.bases.slice(0, MAX_BASES)) {
    const stop = order.find((s) => b.days.includes(dayOf.get(s) ?? -1));
    if (!stop) continue;
    const towns = await data.townsAround({ place: stop, r: 60 }).catch(() => null);
    const t = towns ? townOfBase(towns, { name: b.name, lat: b.lat, lon: b.lng }) : null;
    if (!t || bases.some((x) => x.town === t.id)) continue;
    bases.push({ town: t.id, name: t.name, lat: t.lat, lon: t.lon, nights: b.days.filter((n) => n >= 1).length });
  }

  const parts: SeedParts = { slug, title, days, order, rows, offeredRegions: offered, bases };
  const seeded = seedState(parts, id, nowIso, countryName);
  return seeded.state.picks.length ? { status: 'ok', seeded } : { status: 'empty' };
}
