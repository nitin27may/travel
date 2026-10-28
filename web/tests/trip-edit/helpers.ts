import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import { COPIES_KEY } from '@travel/core/schema/copies.ts';

export const ID_A = '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b';
export const ID_B = '7a2d1b63-9e1f-4c8f-8b62-3d4e5f6a7b8c';

export const copy = (over: Partial<CopyItem> = {}): CopyItem => ({
  id: ID_A,
  slug: 'dolomites-2027',
  title: 'Dolomites',
  days: 14,
  cc: 'IT',
  photo: '/img/abc123-960.webp',
  start: '2027-07-03',
  adults: 2,
  children: [6],
  profile: { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false },
  overrides: { '2': 'B' },
  added: [],
  copiedAt: '2026-10-20T10:00:00.000Z',
  ...over,
});

export function memory(items: CopyItem[] = []): StorageLike & { raw(): string | null } {
  const m = new Map<string, string>();
  // the oldest version that holds the items: copies/1 still reads (back compatibility), copies/2 for an undated or coloured copy
  const v2 = items.some((c) => c.start === null || c.identity !== undefined);
  if (items.length) m.set(COPIES_KEY, JSON.stringify({ schema: v2 ? 'copies/2' : 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} }));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    raw: () => m.get(COPIES_KEY) ?? null,
  };
}

export const items = (s: { raw(): string | null }): CopyItem[] => (JSON.parse(s.raw() ?? '{"items":[]}') as { items: CopyItem[] }).items;
