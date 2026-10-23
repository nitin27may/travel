import { describe, expect, it } from 'vitest';
import { isRoadLike, dayMapFromRoute, dayMapOf, pointLookup, type DayMap } from '@/components/trips/mapPins';
import { buildTripPageModel } from '@/components/trips/model';
import { routeSpec } from '@/components/trips/routeSpec';
import { getPlace, getTrip, tripSlugs } from '@/lib/public';

const lookup = (slug: string) => {
  const p = getPlace(slug);
  return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
};

const models = tripSlugs().map((slug) => {
  const m = buildTripPageModel(getTrip(slug)!, lookup);
  const days: DayMap[] = m.timeline ? m.timeline.defaultTimelines.map((t) => dayMapOf(t, pointLookup(m.route))) : m.route.days.map(dayMapFromRoute);
  return { slug, m, days };
});
const by = (slug: string) => models.find((x) => x.slug === slug);

describe('trip route map: which stops are pins (map note 4.1, backlog 4.23)', () => {
  it('draws no solid or amber leg: the stored legs hold minutes and km, no road geometry', () => {
    for (const { slug, m, days } of models) {
      for (const picked of [null, ...days.map((d) => d.day)]) {
        const spec = routeSpec({ bases: m.route.bases, models: days, picked });
        for (const l of spec.lines) expect(l.style, `${slug} day ${picked}`).toBe('straight-estimate');
      }
    }
  });

  it('the numbers run 1..n in the order of the day list, one pin to a spot, and no two pins share a number', () => {
    for (const { slug, days } of models) {
      for (const d of days) {
        expect(d.pins.map((p) => p.n), `${slug} day ${d.day}`).toEqual(d.pins.map((_, i) => i + 1));
        const cells = d.pins.map((p) => `${p.at.lng.toFixed(4)},${p.at.lat.toFixed(4)}`);
        expect(new Set(cells).size, `${slug} day ${d.day}`).toBe(cells.length);
      }
    }
  });

  it('a pin is a timeline entry: every entry id maps to a number, and a stop with no position is listed, not drawn', () => {
    for (const { m, days } of models) {
      if (!m.timeline) continue;
      for (const d of days) {
        const tl = m.timeline.defaultTimelines.find((t) => t.day === d.day)!;
        const ids = new Set(tl.entries.map((e) => e.id));
        for (const [id, n] of d.entryPin) {
          expect(ids.has(id)).toBe(true);
          expect(d.pins.find((p) => p.n === n)?.entryIds).toContain(id);
        }
        for (const u of d.unplaced) expect(d.entryPin.has(u.id)).toBe(false);
        expect(d.missing).toBe(d.unplaced.length);
      }
    }
  });

  it('a road or drive is never a pin in any view', () => {
    for (const { m, days } of models) {
      const spec = routeSpec({ bases: m.route.bases, models: days, picked: null });
      for (const p of spec.pins.filter((x) => x.style !== 'base')) expect(isRoadLike(p.label ?? ''), p.label).toBe(false);
      for (const d of days) for (const p of d.pins) expect(isRoadLike(p.name), p.name).toBe(false);
    }
  });

  it('what counts as a road is the small set of words a road name uses, and nothing a trail or a village uses', () => {
    for (const n of ['Icefields Parkway (Hwy 93N) scenic drive', 'Vermilion Lakes Drive', 'Zion Canyon Scenic Drive by shuttle', 'Highwood Pass and Hwy 40 corridor']) expect(isRoadLike(n), n).toBe(true);
    for (const n of ['Mary Schaffer Loop', 'Tre Cime di Lavaredo loop', 'Takakkaw Falls', 'Sunwapta Falls', 'Natural Bridge']) expect(isRoadLike(n), n).toBe(false);
    // every item across all trips that the matcher takes for a road is one a person would call a road
    const hits = new Set<string>();
    for (const slug of tripSlugs()) for (const d of getTrip(slug)!.days) for (const i of d.items) if (isRoadLike(i.name)) hits.add(i.name);
    expect([...hits].sort()).toEqual([
      'Highwood Pass and Hwy 40 corridor',
      'Icefields Parkway (Hwy 93N) scenic drive',
      'Vermilion Lakes Drive',
      'Zion Canyon Scenic Drive by shuttle',
    ]);
  });

  it('Rockies day 8 has no Icefields Parkway pin and numbers its stops north to south', () => {
    const rk = by('canadian-rockies-2029');
    if (!rk) return;
    const d8 = rk.days.find((d) => d.day === 8)!;
    expect(d8.pins.map((p) => p.name)).toEqual(['Athabasca Falls', 'Sunwapta Falls']);
    expect(d8.pins[0]!.at.lat).toBeGreaterThan(d8.pins[1]!.at.lat);
    // the Toe of the glacier has no position of its own: it is listed as not on the map, not placed on a neighbour's point
    expect(d8.unplaced.map((u) => u.name)).toContain('Toe of Athabasca Glacier');
  });

  it('Dolomites day 3 is Tre Cime then Cadini di Misurina, 1 and 2', () => {
    const d = by('dolomites-2027')?.days.find((x) => x.day === 3);
    expect(d?.pins.map((p) => `${p.n} ${p.name}`)).toEqual(['1 Tre Cime di Lavaredo loop', '2 Cadini di Misurina viewpoint']);
  });
});

describe('a day with no placed stop (review M9, map note 6.3)', () => {
  const route = {
    bases: [{ id: 'b1', name: 'Ushuaia', lng: -68.3, lat: -54.8, days: [2, 3] }],
    days: [
      { n: 2, title: 'Fly', base: 'Ushuaia', points: [], unplaced: 2 },
      { n: 3, title: 'Park', base: 'Ushuaia', points: [{ key: 'k', name: 'Bay', lng: -68.4, lat: -54.85, placeSlug: 'bay' }], unplaced: 0 },
    ],
    unplaced: 2,
  };
  const days = route.days.map(dayMapFromRoute);
  it('picks its night base and frames it at zoom 11 instead of leaving nothing selected', () => {
    const s = routeSpec({ bases: route.bases, models: days, picked: 2 });
    expect(s.selectedId).toBe('base:b1');
    expect(s.fit).toEqual({ ids: ['base:b1'] });
    expect(s.maxZoom).toBe(11);
  });
  it('a day with stops fits the day and caps the zoom at 13', () => {
    const s = routeSpec({ bases: route.bases, models: days, picked: 3 });
    expect(s.maxZoom).toBe(13);
    expect(s.pins.filter((p) => p.style === 'stop-numbered').map((p) => p.number)).toEqual([1]);
  });
  it('with no base point it shows the whole trip, every other stop dimmed, never the last day left on screen', () => {
    const s = routeSpec({ bases: [], models: days, picked: 2 });
    expect(s.fit).toBe('all');
    expect(s.maxZoom).toBeUndefined();
    expect(s.pins.every((p) => p.style !== 'stop' || p.dim)).toBe(true);
  });
});
