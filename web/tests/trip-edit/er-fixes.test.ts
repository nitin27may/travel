// The independent design review's rows (STEP2-ERV, ER-001 to ER-026) that are pure: the Move to day list's distances, the one fix, the
// wording of the day-cap warning, and the colour of a version's consequence line.
import { describe, expect, it } from 'vitest';
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import { nearestFit } from '@/components/trips/edit/warnings/useFix';
import { warnText } from '@/components/trips/timeline/warnText';
import { variantLine } from '@/components/trips/timeline/consequence';
import { dayChoices } from '@/lib/trip-edit/moveFit';
import { createPublicData } from '@/lib/public';

describe('ER-001: the one fix offers only days near the stop, its own day first', () => {
  const row = (n: number, over: Partial<{ fit: 'fits' | 'tight' | 'fix'; near: boolean; current: boolean }> = {}) => ({ n, current: false, fit: 'fits' as const, last: `l${n}`, near: true, ...over });
  it('skips a far day even when the scheduler says it fits', () => {
    expect(nearestFit([row(6, { near: false }), row(7, { near: false })], 9, 10)).toBeNull();
  });
  it('tries the day the stop came from before the nearest by number', () => {
    expect(nearestFit([row(8), row(10), row(11)], 9, 10)).toEqual({ day: 10, after: 'l10' });
    expect(nearestFit([row(8), row(11)], 9, 10)).toEqual({ day: 8, after: 'l8' });
    // the stop's own day is offered even when it reads Tight (those checks were the plan's), but not when a rule fails there
    expect(nearestFit([row(8), row(10, { fit: 'tight' })], 9, 10)).toEqual({ day: 10, after: 'l10' });
    expect(nearestFit([row(8, { fit: 'tight' }), row(10, { fit: 'fix' })], 9, 10)).toBeNull();
  });
});

describe('ER-001: the Move to day list says how far each day is and never calls a far day a fit', () => {
  it('measures the stop against each day\'s base (a stop with no coordinate stands at its own day\'s base)', async () => {
    const data = createPublicData();
    const { buildTripPageModel } = await import('@/components/trips/model');
    const { listPlaces, getPlace } = await import('@/lib/public');
    const engine = await import('@travel/core/schedule/template.ts');
    const trip = data.getTrip('canadian-rockies-2029')!;
    const m = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, listPlaces());
    const tl = m.timeline!;
    const from = tl.days.find((d) => d.base?.startsWith('Lake Louise') && d.input.variants.some((v) => v.items.some((i) => !i.point)))!;
    const item = from.input.variants.find((v) => v.key === 'B')!.items.find((i) => !i.point)!;
    const rows = dayChoices({
      engine, days: tl.days, delta: { added: [], removed: [], moved: [], days: [] }, overrides: {}, profile: { ...tl.defaultProfile, adults: 2 },
      addItem: () => null, start: null, stop: { id: item.id, day: from.n, from: from.n, added: null },
    });
    const jasper = rows.find((r) => r.base?.startsWith('Jasper'))!;
    expect(jasper.km).toBeGreaterThan(100);
    expect(jasper.near).toBe(false);
    expect(jasper.fit).not.toBe('fits');
    const own = rows.find((r) => r.n === from.n)!;
    expect(own.current).toBe(true);
    const sameBase = rows.find((r) => r.n !== from.n && r.base === from.base);
    if (sameBase) {
      expect(sameBase.km!).toBeLessThanOrEqual(ADD_NEARBY_KM);
      expect(sameBase.near).toBe(true);
    }
  }, 60000);
});

describe('ER-003: the day-cap warning says how long the day is', () => {
  it('rewords the scheduler\'s sentence and passes any other through', () => {
    expect(warnText('Day 9 is 10 h 25 away from base, over 10 h for a standard family day.')).toBe('Day 9 is 10 h 25 from leaving the base to getting back; a standard family day is 10 h.');
    expect(warnText('Day 3 is 9 h away from base, over 8 h for an easy adult day. Optional: Lake.')).toBe('Day 3 is 9 h from leaving the base to getting back; an easy adult day is 8 h. Optional: Lake.');
    expect(warnText('Something else.')).toBe('Something else.');
  });
});

describe('ER-016: a version\'s warning is coloured by what it is', () => {
  it('reads the day running long as Check and a stop the party cannot do as Fix', () => {
    const tl = { totals: { walkKm: 0, driveMin: 60 }, span: { start: '09:00', end: '18:00' }, blocks: false, notes: [], warnings: [{ code: 'S_DAY_CAP', message: 'Day 4 is 10 h 15 away from base, over 10 h for a standard family day.', entryId: null, lane: 'all' }] };
    const v = variantLine(tl as never, 'km');
    expect(v.level).toBe('check');
    expect(v.warn).toContain('from leaving the base');
    const fit = variantLine({ ...tl, warnings: [], notes: [{ kind: 'no-fit', text: 'x picked for this day. Not suited to age 6.' }] } as never, 'km');
    expect(fit.level).toBe('fix');
  });
});
