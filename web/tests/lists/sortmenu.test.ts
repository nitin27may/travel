import { describe, expect, it } from 'vitest';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';

// REVIEW4: 15 sort options is a wall. The menu offers six at most; the rest sort from their table column header.
describe('the Sort by menu', () => {
  it('offers at most six sorts, all real, and the table columns keep theirs', () => {
    for (const d of [placeDescriptor, tripDescriptor]) {
      const menu = d.sortMenu ?? Object.keys(d.sorts);
      expect(menu.length).toBeLessThanOrEqual(6);
      for (const id of menu) expect(d.sorts[id], id).toBeDefined();
    }
    expect(Object.keys(placeDescriptor.sorts).length).toBeGreaterThan(6);
    expect(placeDescriptor.sorts.season).toBeDefined();
  });
});
