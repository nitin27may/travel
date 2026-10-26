import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@travel/core/schema/copies.ts';
import { FAV_LOCAL_KEY } from '@travel/core/schema/favourites.ts';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import { readFavourites } from '@travel/core/favourites/envelope.ts';
import { forgetAsked, refreshPage } from '@/lib/favourites/resolve';

const resolveRefs = vi.fn();
vi.mock('@/lib/client/data', () => ({ resolveRefs }));

const fav = (o: Partial<FavItem> & { slug: string }): FavItem => ({
  space: 'place', ref: null, name: null, kind: null, cc: null, favouredAt: '2026-10-20T10:00:00.000Z', unlistedAt: null, ...o,
});
const seed = (items: FavItem[]) => {
  const s = memoryStorage();
  s.setItem(FAV_LOCAL_KEY, JSON.stringify({ schema: 'favourites/1', items, noteSeen: null, snoozedUntil: null, snoozedAtCount: null, merged: {}, pending: [] }));
  return s;
};
const read = (s: ReturnType<typeof memoryStorage>) => {
  const r = readFavourites(s.getItem(FAV_LOCAL_KEY));
  if (!r.ok) throw new Error(r.reason);
  return r.envelope.items;
};
const row = (o: object) => ({ asked: '', state: 'current', space: 'place', slug: null, ref: null, name: null, kind: null, cc: null, ...o });
const NOW = new Date('2026-10-26T10:00:00.000Z');

beforeEach(() => {
  resolveRefs.mockReset();
  forgetAsked();
});

describe('refreshPage (visitor spec 4.5)', () => {
  it('asks for the visible handles, takes a new name and a new slug, and writes once', async () => {
    const s = seed([fav({ slug: 'old-slug', name: 'Old name' }), fav({ slug: 'same', name: 'Same' })]);
    resolveRefs.mockResolvedValue([
      row({ asked: 'place:old-slug', state: 'moved', slug: 'new-slug', ref: 'place/x', name: 'New name', kind: 'lake', cc: 'CA' }),
      row({ asked: 'place:same', state: 'current', slug: 'same', ref: 'place/y', name: 'Same', kind: 'trail', cc: 'IT' }),
    ]);
    const r = await refreshPage(s, read(s), { now: NOW });
    expect(resolveRefs).toHaveBeenCalledWith(['place:old-slug', 'place:same']);
    expect(r).toEqual({ kind: 'done', changed: true });
    expect(read(s).map((i) => [i.slug, i.name])).toEqual(expect.arrayContaining([['new-slug', 'New name'], ['same', 'Same']]));
  });
  it('a withdrawn or unknown page stays, tombstoned: never removed silently', async () => {
    const s = seed([fav({ slug: 'gone', name: 'Gone place' }), fav({ space: 'trip', slug: 'never', name: 'Never' })]);
    resolveRefs.mockResolvedValue([row({ asked: 'place:gone', state: 'withdrawn' }), row({ asked: 'trip:never', state: 'unknown', space: 'trip' })]);
    await refreshPage(s, read(s), { now: NOW });
    const items = read(s);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.unlistedAt === NOW.toISOString())).toBe(true);
    expect(items.map((i) => i.name).sort()).toEqual(['Gone place', 'Never']);
  });
  it('asks once per visit for the same page of handles, and again when forced (Try again)', async () => {
    const s = seed([fav({ slug: 'a' })]);
    resolveRefs.mockResolvedValue([row({ asked: 'place:a', slug: 'a', name: 'A' })]);
    await refreshPage(s, read(s), { now: NOW });
    await refreshPage(s, read(s), { now: NOW });
    expect(resolveRefs).toHaveBeenCalledTimes(1);
    await refreshPage(s, read(s), { now: NOW, force: true });
    expect(resolveRefs).toHaveBeenCalledTimes(2);
  });
  it('a build with no resolve endpoint keeps the snapshots; a failed request is reported and changes nothing', async () => {
    const s = seed([fav({ slug: 'a', name: 'A' })]);
    const before = s.getItem(FAV_LOCAL_KEY);
    resolveRefs.mockResolvedValue(null);
    expect(await refreshPage(s, read(s), { now: NOW })).toEqual({ kind: 'unavailable' });
    resolveRefs.mockRejectedValue(new Error('down'));
    expect(await refreshPage(s, read(s), { now: NOW })).toEqual({ kind: 'failed' });
    expect(s.getItem(FAV_LOCAL_KEY)).toBe(before);
  });
  it('writes nothing when nothing changed, and asks nothing for an empty page', async () => {
    const s = seed([fav({ slug: 'a', name: 'A', kind: 'lake', cc: 'CA', ref: 'place/a' })]);
    const before = s.getItem(FAV_LOCAL_KEY);
    resolveRefs.mockResolvedValue([row({ asked: 'place:a', slug: 'a', ref: 'place/a', name: 'A', kind: 'lake', cc: 'CA' })]);
    expect(await refreshPage(s, read(s), { now: NOW })).toEqual({ kind: 'done', changed: false });
    expect(s.getItem(FAV_LOCAL_KEY)).toBe(before);
    resolveRefs.mockClear();
    expect(await refreshPage(s, [], { now: NOW })).toEqual({ kind: 'done', changed: false });
    expect(resolveRefs).not.toHaveBeenCalled();
  });
});
