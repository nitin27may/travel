import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { primaryRef } from '@travel/core/capture/records.ts';
import { bookingCounts, tripBookings } from '@travel/core/export/bookings.ts';
import { getTrip } from '@/lib/public';
import { graphOf, readBookingRefs } from '@/lib/public/entry';
import { TRIP_SLUGS } from '@/lib/public/slugs';
import { publicWorld } from '@/lib/public/world';

// data/trips/booking-refs.json (protected-area-entry 6.3; deleted at TD-4): the legacy booking rows a capture requirement record replaces.
const ROOT = path.resolve(__dirname, '../../..');
const refs = readBookingRefs(ROOT);
const world = publicWorld(ROOT);

describe('data/trips/booking-refs.json', () => {
  it('is keyed by legacy trip folders the web builds, and every value has a ref', () => {
    expect(Object.keys(refs).length).toBeGreaterThan(0);
    for (const [folder, rows] of Object.entries(refs)) {
      expect(TRIP_SLUGS[folder], `${folder} is not a built trip folder`).toBeTruthy();
      for (const [id, r] of Object.entries(rows)) {
        expect(typeof r.ref, `${folder}/${id}`).toBe('string');
        if (r.days) expect(r.days.every((d) => Number.isInteger(d) && d > 0), `${folder}/${id} days`).toBe(true);
      }
    }
  });
  it('every mapped record exists in the capture store, and is a requirement (an access or lodging offer)', () => {
    const g = graphOf(world);
    const missing: string[] = [];
    for (const [folder, rows] of Object.entries(refs)) {
      for (const [id, r] of Object.entries(rows)) {
        const rec = g.recs.get(primaryRef(world, r.ref));
        if (!rec) missing.push(`${folder}/${id} -> ${r.ref}`);
        else if (rec.layer !== 'offer') missing.push(`${folder}/${id} -> ${r.ref} is a ${rec.layer}, not an offer`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('every mapped id is a booking row of the trip (the legacy bookings file) and the row it replaced carries a kind now', () => {
    for (const [folder, rows] of Object.entries(refs)) {
      const file = path.join(ROOT, 'legacy', folder, 'data', 'bookings.json');
      const ids = existsSync(file) ? new Set((JSON.parse(readFileSync(file, 'utf8')) as { id: string }[]).map((b) => b.id)) : null;
      const trip = getTrip(TRIP_SLUGS[folder]!)!;
      const built = Object.values(trip.categories).flat();
      for (const id of Object.keys(rows)) {
        if (ids) expect(ids.has(id), `${folder}: no legacy booking "${id}"`).toBe(true);
        const mine = built.filter((r) => r.key === `logistics:${id}` || r.key.startsWith(`logistics:${id}:d`));
        expect(mine.length, `${folder}/${id} was not replaced by a derived row`).toBeGreaterThan(0);
        expect(mine.every((r) => !!r.bookKind), `${folder}/${id}`).toBe(true);
      }
    }
  });
});

describe('the Rockies rows on the real data', () => {
  const trip = getTrip('canadian-rockies-2029')!;
  const rows = tripBookings(Object.values(trip.categories).flat());
  it('the Moraine Lake and Lake Louise shuttle is a booking with its window and the official page; the lakeshore lot is a check', () => {
    const shuttle = rows.filter((b) => b.ref.startsWith('logistics:shuttle-moraine-lakelouise'));
    expect(shuttle).toHaveLength(1);
    expect(shuttle[0]).toMatchObject({ kind: 'booking', rule: 'Opens 2 days before Day 10 at 08:00 local', link: 'https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise' });
    expect(shuttle[0]!.note).toContain('40% of seats go on sale on a spring launch day');
    expect(rows.find((b) => b.ref === 'logistics:lakelouise-lakeshore-parking')).toMatchObject({ kind: 'check', day: 10 });
  });
  it('"to book ahead" counts the booking rows only: the check is listed, never counted', () => {
    const c = bookingCounts(rows);
    expect(c.toBook).toBe(rows.filter((b) => b.kind === 'booking').length);
    expect(c.check).toBeGreaterThanOrEqual(1);
  });
  it('Dolomites rows keep their own words (no record replaces them yet)', () => {
    const dolo = tripBookings(Object.values(getTrip('dolomites-2027')!.categories).flat());
    expect(dolo.map((b) => b.kind)).toEqual(['booking', 'booking', 'booking']);
    expect(dolo.find((b) => /Tre Cime/.test(b.name))!.rule).toBe('Opens 30 days before Day 3');
  });
});
