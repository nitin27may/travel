// The consecutive stop pairs a trip's map asks routed legs for, from the trip route model (D-E5, TRP2b). It runs under vitest (the '@' alias
// and the store's imports need it, as scripts/snapshot does) and is the only place that knows how a stop key becomes a leg file's pair key.
//
// The pairs are exactly the ones the store looks up: `tripLegsOf` (core/src/catalogue/json/legs.ts) walks the trip detail's days and asks
// `pairKeyOf` for both ends of every consecutive stop pair, so this module asks it the same way and records the answers. A road stored as
// a point (a scenic drive) is never a pin on the map (mapPins.ts), so no leg is fetched into or out of one.
import { tripLegsOf } from '@travel/core/catalogue/json/legs.ts';
import { haversineKm } from '@travel/core/geo/distance.ts';
import type { TripDetail, TripLegsFile } from '@travel/core/schema/api/index.ts';
import { isRoadLike } from '@/components/trips/mapPins';
import { sharedPublicData } from '@/lib/public';
import { dolomitesLegPairs, routingPoint } from '@/lib/public/legs-pairs';
import { getStore } from '@/lib/server/store';
import snapshot from '../../data-snapshots/prototype.json';
import type { Pt, RoutePair } from './lib';

const SAME_SPOT_GAP = 0.05;
type Item = TripDetail['days'][number]['items'][number];

const EMPTY: TripLegsFile = { schema: 'trip-legs/2', trip: 'x', fetched: '2000-01-01', attribution: 'x', legs: [] };
const protoPlaceOfItem = new Map<string, string>();
for (const day of snapshot.trip.days) for (const it of day.items) protoPlaceOfItem.set(it.id, it.placeId);

/** The file's pair key for a stop key: the prototype place id for the Dolomites trip, the stop key itself for any other (web/lib/server/source.ts legsFile). */
export function pairKeyOf(slug: string, stopKey: string): string | null {
  if (stopKey.startsWith('base:')) return stopKey.slice(5);
  return slug === snapshot.trip.id ? (protoPlaceOfItem.get(stopKey) ?? null) : stopKey;
}

export async function tripDetailOf(slug: string): Promise<TripDetail> {
  const r = await getStore().getTrip(slug);
  if (!r.ok || 'moved' in r.data) throw new Error(`trip ${slug} is not a public trip`);
  return r.data as TripDetail;
}

/** Where to route to for a stop: its trailhead, else its first car park, else its own pin (the drive ends at a car park). */
function pointOfItem(item: Item): Pt | null {
  if (!item.placeSlug) return null;
  const place = sharedPublicData().getPlace(item.placeSlug);
  if (!place?.point) return null;
  const at = routingPoint({ id: place.slug, kind: place.kind, lat: place.point.lat, lng: place.point.lon }, place.access ? { trailhead: place.access.trailhead, parking: place.access.parking } : undefined);
  return { lat: at.lat, lng: at.lng };
}

export async function routePairs(slug: string): Promise<RoutePair[]> {
  const detail = await tripDetailOf(slug);
  const items = new Map<string, Item>();
  for (const d of detail.days) for (const it of [...d.items, ...(d.tracks ?? []).flatMap((t) => t.items)]) items.set(it.id, it);
  const protoTrip = slug === snapshot.trip.id;
  const protoPlaces = new Map(snapshot.places.map((p) => [p.id, p]));
  const access = snapshot.access as Record<string, { trailhead?: { lat: number; lon: number } | null; parking?: { lat: number; lon: number }[] }>;

  // the stop keys of every consecutive pair, as the store asks for them: two calls to pairKeyOf per pair, from then to
  const asked: string[] = [];
  tripLegsOf(detail, { file: EMPTY, pairKeyOf: (k) => (asked.push(k), pairKeyOf(slug, k)) });

  const pointOfKey = new Map<string, Pt>();
  const labelOf = new Map<string, string>();
  const note = (key: string | null, stop: string): boolean => {
    if (!key) return false;
    if (pointOfKey.has(key)) return true;
    let at: Pt | null = null;
    let label = key;
    if (stop.startsWith('base:')) {
      const b = detail.bases.find((x) => x.id === stop.slice(5));
      const town = protoTrip ? protoPlaces.get(key) : null;
      if (town) at = routingPoint(town, access[key]);
      else if (b?.point) at = { lat: b.point.lat, lng: b.point.lon };
      label = b?.name ?? key;
    } else {
      const item = items.get(stop);
      // only the route model's stops (an item with a category, model.ts isStop): a car park or a folded lift is never a leg's end
      if (!item || item.category === null || isRoadLike(item.name)) return false;
      const proto = protoTrip ? protoPlaces.get(key) : null;
      at = proto ? routingPoint(proto, access[key]) : pointOfItem(item);
      label = item.name;
    }
    if (!at) return false;
    pointOfKey.set(key, at);
    labelOf.set(key, label);
    return true;
  };

  const out: RoutePair[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string) => {
    const k = [from, to].sort().join('|');
    const a = pointOfKey.get(from);
    const b = pointOfKey.get(to);
    // two items on one spot share a pin on the map, so there is no leg between them
    if (from === to || seen.has(k) || !a || !b || haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }) < SAME_SPOT_GAP) return;
    seen.add(k);
    out.push({ from, to, a, b, label: `${labelOf.get(from)} to ${labelOf.get(to)}` });
  };
  for (let i = 0; i + 1 < asked.length; i += 2) {
    const [sa, sb] = [asked[i]!, asked[i + 1]!];
    const [ka, kb] = [pairKeyOf(slug, sa), pairKeyOf(slug, sb)];
    if (note(ka, sa) && note(kb, sb)) add(ka!, kb!);
  }
  if (protoTrip) {
    // the Dolomites timeline also looks these up (legs-pairs.ts): evening returns to the base and the airport legs
    for (const p of snapshot.places) {
      const at = routingPoint(p, access[p.id]);
      if (!pointOfKey.has(p.id)) { pointOfKey.set(p.id, at); labelOf.set(p.id, p.id); }
    }
    for (const [a, b] of dolomitesLegPairs(snapshot.trip.days, snapshot.places)) add(a, b);
  }
  return out;
}

/** Straight-line km between a pair's ends, to pick the profile (a short pair is a walk). */
export const straightKm = (p: RoutePair): number => haversineKm({ lat: p.a.lat, lon: p.a.lng }, { lat: p.b.lat, lon: p.b.lng });
