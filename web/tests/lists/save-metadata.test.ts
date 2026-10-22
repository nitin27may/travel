import { describe, expect, it } from 'vitest';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { sortRows } from '@/lib/entities/sort';
import { decodeState } from '@/lib/entities/url';
import { placeRows } from '../places/support';

// PRIV1: the owner's save metadata is not a Places column, sort or chooser entry. An old link or saved view that names one degrades to the default order.
describe('the Places table has no wishlist save columns', () => {
  it('has no Sources or Date added column, sort, or sort menu item', () => {
    const ids = placeDescriptor.columns.map((c) => String((c as { id?: string; accessorKey?: string }).id ?? ''));
    expect(ids).not.toContain('sources');
    expect(JSON.stringify(placeDescriptor.columns.map((c) => (c.meta as { label?: string } | undefined)?.label))).not.toMatch(/Sources|Date added/);
    expect(Object.keys(placeDescriptor.sorts)).not.toContain('sources');
    expect(Object.keys(placeDescriptor.sorts)).not.toContain('added');
    expect(placeDescriptor.sortMenu).not.toContain('added');
    expect(placeDescriptor.defaultColumns).not.toContain('sources');
    expect((placeDescriptor.sortMenu ?? []).length).toBeLessThanOrEqual(6);
  });
  it('an old sort key falls back to the default order without throwing', () => {
    const rows = placeRows();
    const base = sortRows(rows, decodeState(''), placeDescriptor).map((r) => r.id);
    for (const k of ['sources', '-sources', 'added', '-added']) {
      expect(sortRows(rows, decodeState(`sort=${k}`), placeDescriptor).map((r) => r.id), k).toEqual(base);
    }
  });
});
