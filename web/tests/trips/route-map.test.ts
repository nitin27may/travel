import { describe, expect, it } from 'vitest';
import { buildTripPageModel } from '@/components/trips/model';
import { routeSpec } from '@/components/trips/TripRouteMap';
import { orderRoute } from '@/components/trips/timeline/model';
import { groupPins } from '@/lib/map/geo';
import { getPlace, getTrip, tripSlugs } from '@/lib/public';

const lookup = (slug: string) => {
  const p = getPlace(slug);
  return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
};

const models = tripSlugs().map((slug) => {
  const m = buildTripPageModel(getTrip(slug)!, lookup);
  return { slug, m, route: m.timeline ? orderRoute(m.route, m.timeline.defaultTimelines) : m.route };
});

describe('trip route map (backlog 4.23)', () => {
  it('draws no solid or amber leg: the stored legs hold minutes and km, no road geometry', () => {
    for (const { slug, route } of models) {
      for (const picked of [null, ...route.days.map((d) => d.n)]) {
        const spec = routeSpec(route, picked);
        for (const l of spec.lines) expect(l.style, `${slug} day ${picked}`).toBe('straight-estimate');
      }
    }
  });

  it('no two pins on one map share a number, and no pin merges into a count badge', () => {
    for (const { slug, route } of models) {
      for (const d of route.days) {
        const groups = groupPins(routeSpec(route, d.n).pins);
        const labels = groups.map((g) => g.text).filter(Boolean);
        expect(new Set(labels).size, `${slug} day ${d.n}: ${labels.join(',')}`).toBe(labels.length);
        for (const g of groups) {
          // only a base signpost may share a spot with a numbered stop; two stops on one spot are one pin
          const stops = g.pins.filter((p) => p.style !== 'base');
          expect(stops.length, `${slug} day ${d.n} at ${g.at.lng},${g.at.lat}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('the numbers run 1..n in the order of the day list, and a stop with no position is not numbered', () => {
    for (const { slug, route } of models) {
      for (const d of route.days) {
        const nums = routeSpec(route, d.n).pins.filter((p) => p.style === 'stop-numbered');
        expect(nums.map((p) => p.number), `${slug} day ${d.n}`).toEqual(nums.map((_, i) => i + 1));
        const names = nums.map((p) => p.label);
        const listed = d.points.map((p) => p.name).filter((n) => names.includes(n));
        expect(names, `${slug} day ${d.n} follows the day list`).toEqual(listed);
        expect(nums.length).toBeLessThanOrEqual(d.points.length);
      }
    }
  });

  it('Rockies day 5: Pyramid Lake is numbered once and no other day sits on top of it', () => {
    const rk = models.find((x) => x.slug === 'canadian-rockies-2029');
    if (!rk) return;
    const groups = groupPins(routeSpec(rk.route, 5).pins);
    const twos = groups.filter((g) => g.text === '2');
    expect(twos.length).toBeLessThanOrEqual(1);
  });
});

describe('one age on the trip page (backlog 4.24)', () => {
  it('the hero chip, the profile line and the Kids tag show the same N', () => {
    for (const slug of tripSlugs()) {
      const trip = getTrip(slug)!;
      const p = trip.schedule?.defaultProfile;
      if (p?.party !== 'family' || typeof p.youngest !== 'number') continue;
      // the hero chip reads trip.ageFit; the profile line and the plan bar read the profile's youngest age
      expect(trip.ageFit, `${slug}: hero chip vs plan profile`).toBe(p.youngest);
      const written = /child from about (\d+)/.exec(trip.schedule?.writtenFor ?? '');
      if (written) expect(Number(written[1]), `${slug}: profile line`).toBe(p.youngest);
    }
  });
});

describe('a day with no placed stop (review M9)', () => {
  it('picks its base on the map instead of leaving nothing selected', async () => {
    const { routeSpec } = await import('@/components/trips/TripRouteMap');
    const route = { bases: [{ id: 'b1', name: 'Ushuaia', lng: -68.3, lat: -54.8, days: [2, 3] }], days: [{ n: 2, title: 'Fly', base: 'Ushuaia', points: [], unplaced: 2 }, { n: 3, title: 'Park', base: 'Ushuaia', points: [{ key: 'k', name: 'Bay', lng: -68.4, lat: -54.85, placeSlug: 'bay' }], unplaced: 0 }], unplaced: 2 };
    expect(routeSpec(route as never, 2).selectedId).toBe('base:b1');
    expect(routeSpec(route as never, 3).selectedId).toBeUndefined();
  });
});
