import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, pageWindow } from '@/components/ui/Pager';

describe('pager', () => {
  it('uses 48 cards or 100 rows a page', () => {
    expect(PAGE_SIZE.cards).toBe(48);
    expect(PAGE_SIZE.table).toBe(100);
  });
  it('lists every page up to seven, then gaps', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 12)).toEqual([1, 2, 0, 4, 5, 6, 0, 11, 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, 0, 11, 12]);
  });
});
