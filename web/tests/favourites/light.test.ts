import { afterEach, describe, expect, it, vi } from 'vitest';
import { heartedHandles, isHearted, setSession, watchHearts } from '@/lib/favourites/light';
import { CHANGED_EVENT, FAV_KEY } from '@/lib/mine/keys';

// The cheap read the heart and the badges share: plain JSON, no Zod. A damaged list shows no hearts and is left alone.

function stub(raw: string | null) {
  const listeners = new Map<string, (e: unknown) => void>();
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => (k === FAV_KEY ? raw : null) },
    addEventListener: (n: string, f: (e: unknown) => void) => listeners.set(n, f),
    removeEventListener: (n: string) => listeners.delete(n),
  });
  return listeners;
}
afterEach(() => {
  vi.unstubAllGlobals();
  setSession([]);
});

const env = (items: object[]) => JSON.stringify({ schema: 'favourites/1', items });

describe('heartedHandles', () => {
  it('reads place and trip handles from the stored list', () => {
    stub(env([{ space: 'place', slug: 'a' }, { space: 'trip', slug: 'b' }, { space: 'offer', slug: 'x' }, { space: 'place' }]));
    expect([...heartedHandles()].sort()).toEqual(['place:a', 'trip:b']);
    expect(isHearted('place', 'a')).toBe(true);
    expect(isHearted('trip', 'a')).toBe(false);
  });
  it('reads nothing from a missing, damaged or odd list', () => {
    for (const raw of [null, '{nope', '[]', JSON.stringify({ items: 'x' })]) {
      stub(raw);
      expect(heartedHandles().size).toBe(0);
    }
  });
  it('adds the session list', () => {
    stub(null);
    setSession(['place:s']);
    expect(isHearted('place', 's')).toBe(true);
  });
  it('a browser that throws on access reads as no hearts, not an error', () => {
    vi.stubGlobal('window', { get localStorage(): never { throw new DOMException('x', 'SecurityError'); } });
    expect(heartedHandles().size).toBe(0);
  });
});

describe('watchHearts', () => {
  it('fires for this tab\'s change event and for the other tab\'s storage event on the list, and stops when asked', () => {
    const ls = stub(null);
    const on = vi.fn();
    const off = watchHearts(on);
    ls.get(CHANGED_EVENT)!({});
    ls.get('storage')!({ key: FAV_KEY });
    ls.get('storage')!({ key: 'travel.something.else' });
    ls.get('storage')!({ key: null });
    expect(on).toHaveBeenCalledTimes(3);
    off();
    expect(ls.size).toBe(0);
  });
});
