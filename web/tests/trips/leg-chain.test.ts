// SHOULD-5: the map's own chain (the scheduler's timeline, pins by place) finds the fetched legs. On the Dolomites, days 3 to 5 draw every
// step routed, none left to the dashed estimate, so the fetched pairs and the map agree about what a step is.
import { describe, expect, it } from 'vitest';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { buildTripPageModel } from '@/components/trips/model';
import { legGeometry } from '@/components/trips/legGeometry';
import { dayMapOf, pointLookup } from '@/components/trips/mapPins';
import { routeSpec } from '@/components/trips/routeSpec';
import { getPlace, getTrip } from '@/lib/public';
import { getStore } from '@/lib/server/store';

describe('Dolomites: every step of days 3 to 5 is routed', () => {
  it('draws routed steps and dashes only the stubs', async () => {
    const trip = getTrip('dolomites-2027')!;
    const model = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, []);
    const r = await getStore().tripLegs('dolomites-2027');
    if (!r.ok || 'moved' in r.data) throw new Error('no legs');
    const slugs = new Map<string, string>();
    for (const d of model.days) for (const s of [...d.stops, ...(d.tracks ?? []).flatMap((t) => t.stops)]) if (s.placeSlug) slugs.set(s.id, s.placeSlug);
    const tls = scheduleTrip(trip.days.map((d) => d.scheduleInput!), trip.schedule!.defaultProfile);
    const maps = tls.map((t) => dayMapOf(t, pointLookup(model.route)));
    const geometry = legGeometry(r.data.legs, maps, model.route.bases, (k) => slugs.get(k) ?? null);
    for (const day of [3, 4, 5]) {
      const steps = routeSpec({ bases: model.route.bases, models: maps, picked: day, geometry }).lines.filter((l) => !/:[ab]$/.test(l.id));
      expect(steps.length, `day ${day} has steps`).toBeGreaterThan(0);
      expect(steps.filter((l) => l.style === 'straight-estimate').map((l) => l.id), `day ${day}`).toEqual([]);
    }
    // a walk on day 4 is keyed as such
    const d4 = routeSpec({ bases: model.route.bases, models: maps, picked: 4, geometry }).lines;
    expect(d4.some((l) => l.mode === 'walk')).toBe(true);
  });
});
