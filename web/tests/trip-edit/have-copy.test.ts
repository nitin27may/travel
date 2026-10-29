import { describe, expect, it } from 'vitest';
import { findCopyId } from '@/components/trips/edit/have-copy/find';
import type { KeyedStorage } from '@/components/trips/edit/have-copy/find';
import { ACCT_KEY_PREFIX, COPIES_KEY } from '@/lib/mine/keys';

// STEP2-P3: "You have a copy of this trip · Open it" reads two lists on the device as plain JSON and fetches nothing.

const A = '2d9f6a3e-1b8c-4f2a-8e47-0a1b2c3d4e5f';
const B = '3e0a7b4f-2c9d-4a3b-9f58-1b2c3d4e5f6a';
const C = '4f1b8c5a-3d0e-4b4c-8a69-2c3d4e5f6a7b';
const store = (kv: Record<string, string>): KeyedStorage => {
  const keys = Object.keys(kv);
  return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => kv[k] ?? null };
};
const copies = (...items: unknown[]) => JSON.stringify({ schema: 'copies/2', items });

describe('findCopyId', () => {
  it('finds the newest device copy of the trip and ignores other trips', () => {
    const s = store({
      [COPIES_KEY]: copies(
        { id: A, slug: 'dolomites-2027', copiedAt: '2026-10-01T10:00:00.000Z' },
        { id: B, slug: 'dolomites-2027', copiedAt: '2026-10-20T10:00:00.000Z' },
        { id: C, slug: 'other-trip', copiedAt: '2026-10-25T10:00:00.000Z' },
      ),
    });
    expect(findCopyId(s, 'dolomites-2027')).toBe(B);
    expect(findCopyId(s, 'other-trip')).toBe(C);
    expect(findCopyId(s, 'no-copy')).toBeNull();
  });

  it('finds an account trip from the cache on this device, but not a removed one', () => {
    const k = `${ACCT_KEY_PREFIX}abc123`;
    const rows = (...r: unknown[]) => JSON.stringify({ schema: 'x', savedAt: '2026-10-20T10:00:00.000Z', rows: r });
    expect(findCopyId(store({ [k]: rows({ id: A, source_trip: 'dolomites-2027', deleted_at: null }) }), 'dolomites-2027')).toBe(A);
    expect(findCopyId(store({ [k]: rows({ id: A, source_trip: 'dolomites-2027', deleted_at: '2026-10-21T10:00:00.000Z' }) }), 'dolomites-2027')).toBeNull();
    expect(findCopyId(store({ [k]: rows({ id: A, source_trip: 'dolomites-2027', removing: true }) }), 'dolomites-2027')).toBeNull();
  });

  it('gives nothing for a list it cannot read, an id that is not a copy id, or a storage that throws', () => {
    expect(findCopyId(store({ [COPIES_KEY]: '{nope' }), 'dolomites-2027')).toBeNull();
    expect(findCopyId(store({ [COPIES_KEY]: copies({ id: 'not-an-id', slug: 'dolomites-2027' }) }), 'dolomites-2027')).toBeNull();
    const boom: KeyedStorage = { length: 0, key: () => null, getItem: () => { throw new Error('blocked'); } };
    expect(findCopyId(boom, 'dolomites-2027')).toBeNull();
  });
});
