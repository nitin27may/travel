import { describe, expect, it } from 'vitest';
import { clusterPins } from '@/components/places/cluster';
import { tripListRows } from '@/app/trips/rows';
import { clusterAtMembers } from '@/components/trips/TripsMap';

describe('trip pins are honest (T5)', () => {
  const rows = tripListRows();
  it('no trip with a real position sits at a country middle, and the ones that do are marked approximate', () => {
    const middles = ['38,-97', '60,-95'];
    for (const r of rows) {
      const at = `${r.lat?.toFixed(0)},${r.lon?.toFixed(0)}`;
      if (!r.approx) expect(middles, r.slug).not.toContain(at);
    }
    expect(rows.find((r) => r.slug === 'vermont-fall-2026')?.approx).toBe(false);
    expect(rows.find((r) => r.slug === 'utah-five-parks')?.approx).toBe(false);
  });
});

describe('trips map clusters (backlog 2.41)', () => {
  it('a cluster sits on one of its members, never at the mean between them', () => {
    const at = new Map([['calgary', { lng: -114, lat: 51 }], ['toronto', { lng: -79, lat: 43.7 }], ['ottawa', { lng: -75.7, lat: 45.4 }]]);
    const pts = [...at].map(([id, p]) => ({ id, at: p, label: id }));
    const r = clusterPins(pts, 1);
    const cluster = r.pins.find((p) => p.id.startsWith('cluster:'))!;
    expect(cluster.number).toBeGreaterThan(1);
    const placed = clusterAtMembers(r.pins, r.members, at).find((p) => p.id === cluster.id)!;
    expect(placed.number).toBe(cluster.number);
    const member = r.members.get(cluster.id)!.map((m) => at.get(m)!);
    expect(member.some((m) => m.lng === placed.at.lng && m.lat === placed.at.lat)).toBe(true);
  });
  it('single pins are untouched', () => {
    const pins = [{ id: 'a', at: { lng: 1, lat: 2 }, style: 'trip' as const }];
    expect(clusterAtMembers(pins, new Map(), new Map())).toEqual(pins);
  });
});
