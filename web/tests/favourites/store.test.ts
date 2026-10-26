import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAVOURITES_CAP, FAV_LOCAL_KEY } from '@travel/core/schema/favourites.ts';
import { readFavourites } from '@travel/core/favourites/envelope.ts';
import { resetMineStorage } from '@/lib/mine/storage';
import { heartedHandles, setSession } from '@/lib/favourites/light';
import { addHeart, removeHeart, restoreHeart } from '@/lib/favourites/store';

// FAV-1: the heart's writes over a fake localStorage. Every write goes through the core's compare-and-set; nothing here touches a server.

type Fake = { map: Map<string, string>; throwOnSet: boolean; events: number };
function install(o: { blocked?: boolean; throwAfterProbe?: boolean } = {}): Fake {
  const f: Fake = { map: new Map(), throwOnSet: false, events: 0 };
  const ls = {
    getItem: (k: string) => f.map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (f.throwOnSet && k !== 'travel.probe') throw new DOMException('full', 'QuotaExceededError');
      f.map.set(k, String(v));
    },
    removeItem: (k: string) => void f.map.delete(k),
  };
  vi.stubGlobal('window', {
    get localStorage() {
      if (o.blocked) throw new DOMException('insecure', 'SecurityError');
      return ls;
    },
    dispatchEvent: () => ((f.events += 1), true),
  });
  return f;
}
const read = (f: Fake) => {
  const r = readFavourites(f.map.get(FAV_LOCAL_KEY) ?? null);
  if (!r.ok) throw new Error(r.reason);
  return r.envelope;
};
const NOW = new Date('2026-10-26T10:00:00.000Z');
const lake = { space: 'place' as const, slug: 'moraine-lake', name: 'Moraine Lake', kind: 'lake', cc: 'CA' };

beforeEach(() => {
  resetMineStorage();
  setSession([]);
});
afterEach(() => vi.unstubAllGlobals());

describe('addHeart', () => {
  it('adds newest first, tells the shell, and marks the first-save note seen in the same write', () => {
    const f = install();
    const a = addHeart(lake, NOW);
    expect(a).toMatchObject({ kind: 'added', first: true, session: false });
    expect(f.events).toBe(1);
    const env = read(f);
    expect(env.items.map((i) => i.slug)).toEqual(['moraine-lake']);
    expect(env.noteSeen).toBe(NOW.toISOString());
    const b = addHeart({ space: 'trip', slug: 'dolomites-2027', name: 'Dolomites' }, new Date('2026-10-26T11:00:00.000Z'));
    expect(b).toMatchObject({ kind: 'added', first: false });
    expect(read(f).items.map((i) => i.slug)).toEqual(['dolomites-2027', 'moraine-lake']);
  });
  it('a second heart on the same page is a no-op: one row, no event, no toast', () => {
    const f = install();
    addHeart(lake, NOW);
    const again = addHeart(lake, NOW);
    expect(again.kind).toBe('exists');
    expect(read(f).items).toHaveLength(1);
    expect(f.events).toBe(1);
  });
  it('hearting 3 places and 1 trip keeps all four', () => {
    const f = install();
    for (const slug of ['a', 'b', 'c']) addHeart({ space: 'place', slug }, NOW);
    addHeart({ space: 'trip', slug: 't' }, NOW);
    expect([...heartedHandles()].sort()).toEqual(['place:a', 'place:b', 'place:c', 'trip:t']);
    expect(read(f).items).toHaveLength(4);
  });
  it('refuses the 501st with the cap and writes nothing', () => {
    const f = install();
    for (let i = 0; i < FAVOURITES_CAP; i++) expect(addHeart({ space: 'place', slug: `p-${i}` }, NOW).kind).toBe('added');
    const before = f.map.get(FAV_LOCAL_KEY);
    expect(addHeart({ space: 'place', slug: 'one-more' }, NOW).kind).toBe('cap');
    expect(f.map.get(FAV_LOCAL_KEY)).toBe(before);
  });
  it('leaves a newer or damaged envelope exactly as it is', () => {
    const f = install();
    f.map.set(FAV_LOCAL_KEY, JSON.stringify({ schema: 'favourites/2', items: [] }));
    expect(addHeart(lake, NOW)).toEqual({ kind: 'failed', reason: 'newer' });
    f.map.set(FAV_LOCAL_KEY, '{not json');
    expect(addHeart(lake, NOW)).toEqual({ kind: 'failed', reason: 'corrupt' });
    expect(f.map.get(FAV_LOCAL_KEY)).toBe('{not json');
  });
});

describe('removeHeart and restoreHeart', () => {
  it('removes with the row for Undo, and Undo puts it back where its time puts it', () => {
    const f = install();
    addHeart({ space: 'place', slug: 'a' }, new Date('2026-10-26T10:00:00.000Z'));
    addHeart({ space: 'place', slug: 'b' }, new Date('2026-10-26T11:00:00.000Z'));
    const r = removeHeart('place', 'a');
    if (!r.ok) throw new Error('x');
    expect(read(f).items.map((i) => i.slug)).toEqual(['b']);
    expect(restoreHeart(r.removed)).toBe(true);
    expect(read(f).items.map((i) => i.slug)).toEqual(['b', 'a']);
  });
  it('Undo is refused when the page was hearted again meanwhile', () => {
    install();
    addHeart({ space: 'place', slug: 'a' }, NOW);
    const r = removeHeart('place', 'a');
    if (!r.ok) throw new Error('x');
    addHeart({ space: 'place', slug: 'a' }, NOW);
    expect(restoreHeart(r.removed)).toBe(false);
  });
  it('removing a page that is not a favourite says so and writes nothing', () => {
    const f = install();
    expect(removeHeart('place', 'nope')).toEqual({ ok: false, reason: 'absent' });
    expect(f.events).toBe(0);
  });
});

describe('storage that keeps nothing (visitor spec 4.3)', () => {
  it('a browser that blocks access keeps the list in this page: the heart still works, as a session list', () => {
    const f = install({ blocked: true });
    const a = addHeart(lake, NOW);
    expect(a).toMatchObject({ kind: 'added', session: true });
    expect(f.map.size).toBe(0);
    expect(heartedHandles().has('place:moraine-lake')).toBe(true);
    const r = removeHeart('place', 'moraine-lake');
    expect(r.ok).toBe(true);
    expect(heartedHandles().has('place:moraine-lake')).toBe(false);
  });
  it('a store that is full falls back to the session list and says so', () => {
    const f = install();
    f.throwOnSet = true;
    const a = addHeart(lake, NOW);
    expect(a).toMatchObject({ kind: 'added', session: true });
    expect(heartedHandles().has('place:moraine-lake')).toBe(true);
  });
});
