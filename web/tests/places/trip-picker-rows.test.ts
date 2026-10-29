import { describe, expect, it } from 'vitest';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { memoryStorage } from '@travel/core/schema/copies.ts';
import { DEVICE_EDITS_KEY } from '@/lib/trip-edit/keys';
import { addHref, dayOfPlace, inYourTrips, pickRows } from '@/components/trip-picker/rows';

const base: CopyItem = {
  id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03',
  adults: 2, children: [], profile: null, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
};
const other: CopyItem = { ...base, id: '7a1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'rockies-2029', title: 'Rockies', start: '2026-12-01', added: [{ day: 5, placeSlug: 'moraine-lake' }] };
const undated: CopyItem = { ...base, id: '8a1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'iceland', title: 'Iceland', start: null };

describe('the trip picker rows', () => {
  it('the row address is the add picker of that trip on this place', () => {
    expect(addHref(base.id, 'moraine-lake')).toBe(`/t/${base.id}/?edit=1&add=moraine-lake`);
  });
  it('lists every copy once in Mine order: upcoming soonest first, then No date', () => {
    const rows = pickRows([base, undated, other], 'moraine-lake', '2026-10-28');
    expect(rows.map((r) => r.row.title)).toEqual(['Rockies', 'Dolomites', 'Iceland']);
    expect(rows[0]!.href).toBe(`/t/${other.id}/?edit=1&add=moraine-lake`);
  });
  it('knows the day a copy already holds the place on, from its added list or the device edits', () => {
    expect(dayOfPlace(other, 'moraine-lake')).toBe(5);
    expect(dayOfPlace(base, 'moraine-lake')).toBeNull();
    const s = memoryStorage();
    s.setItem(DEVICE_EDITS_KEY, JSON.stringify({ v: 1, items: { [base.id]: { added: [{ day: 3, ref: 'place/moraine-lake' }, { day: 'op-1', ref: 'place/other' }] } } }));
    expect(pickRows([base], 'moraine-lake', '2026-10-28', s)[0]!.on).toBe(3);
    expect(pickRows([base], 'other', '2026-10-28', s)[0]!.on).toBeNull();
  });
});

describe('In your trips', () => {
  it('names an exact day first, then a copy of a public trip that uses the place (no day), and nothing else', () => {
    const lines = inYourTrips([base, other, undated], 'moraine-lake', ['dolomites-2027']);
    expect(lines).toEqual([
      { id: other.id, title: 'Rockies', day: 5 },
      { id: base.id, title: 'Dolomites', day: null },
    ]);
    expect(inYourTrips([undated], 'moraine-lake', ['dolomites-2027'])).toEqual([]);
  });
});
