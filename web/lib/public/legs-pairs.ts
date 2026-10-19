// The consecutive place pairs the Dolomites timeline needs a road time for (trip-timeline spec 2.5). Both the adapter and
// scripts/legs-ors.mjs read this, so the cache the script fills is exactly the cache the adapter looks up. No imports:
// the script loads this file directly under Node's type stripping.

export interface PairPlace {
  id: string;
  kind: string;
  lat: number;
  lng: number;
}
export interface PairDay {
  n: number;
  baseTown: string | null;
  items: { id: string; placeId: string; variant?: string }[];
}

/** Ordered [from, to] place ids for every leg of every day and variant, deduplicated by unordered pair. */
export function dolomitesLegPairs(days: PairDay[], places: PairPlace[]): [string, string][] {
  const kindOf = new Map(places.map((p) => [p.id, p.kind]));
  const seen = new Set<string>();
  const out: [string, string][] = [];
  const add = (a: string, b: string) => {
    if (a === b) return;
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push([a, b]);
  };
  let prevNight: string | null = null;
  days.forEach((d, idx) => {
    const last = idx === days.length - 1;
    const night = d.baseTown ?? prevNight ?? 'san-candido';
    // a day that changes base starts where the previous night was spent
    const start = idx === 0 ? night : (prevNight ?? night);
    const airport = d.items.find((i) => kindOf.get(i.placeId) === 'airport')?.placeId ?? null;
    const seq = d.items.filter((i) => !['airport', 'parking'].includes(kindOf.get(i.placeId) ?? ''));
    const keys = [...new Set(seq.map((i) => i.variant).filter((v): v is string => !!v))];
    const from = idx === 0 && airport ? airport : start;
    const to = last && airport ? airport : night;
    for (const v of keys.length ? keys : ['']) {
      let prev = from;
      for (const it of seq.filter((i) => !i.variant || i.variant === v)) {
        add(prev, it.placeId);
        prev = it.placeId;
      }
      add(prev, to);
    }
    prevNight = night;
  });
  return out;
}

export interface AccessPoints {
  trailhead?: { lat: number; lon: number } | null;
  parking?: { lat: number; lon: number }[];
}

/**
 * Where to route to: the trailhead, else the first car park, else the place's own pin. A drive ends at a car park, and the
 * prototype's place pins sit on summits and lake shores that no road reaches.
 */
export function routingPoint(place: PairPlace, access: AccessPoints | undefined): { lat: number; lng: number } {
  const t = access?.trailhead ?? access?.parking?.[0] ?? null;
  return t ? { lat: t.lat, lng: t.lon } : { lat: place.lat, lng: place.lng };
}
