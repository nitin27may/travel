import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIES_KEY, DEVICE_COPY_CAP, LEGACY_COPIES_KEY, LEGACY_MOVED_KEY, memoryStorage, readCopies } from '@travel/core/schema/copies.ts';
import type { CopyInput, StorageLike } from '@travel/core/schema/copies.ts';
import { parseTimelineUrl, serialiseTimelineUrl } from '@travel/core/schedule/profileCodec.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import {
  changeDates, moveLegacyOnce, partyText, removeById, saveCopy, undoChange, undoRemove, undoSave,
} from '@/lib/mine/copies';
import { countdown, groupRows, openHref, openQuery, rowModel, rowTitle } from '@/lib/mine/rows';

// NAV-2: the device list's reads and writes, over a memory store. The envelope is only ever written through the core's compare-and-set.

const input = (slug: string, o: Partial<CopyInput> = {}): CopyInput => ({
  slug, title: slug, days: 14, cc: null, photo: null, start: '2027-07-03', adults: 2, children: [], profile: null, overrides: {}, added: [], ...o,
});
const read = (s: StorageLike) => {
  const r = readCopies(s.getItem(COPIES_KEY));
  if (!r.ok) throw new Error(r.reason);
  return r.envelope;
};
let s: StorageLike;
let events = 0;
beforeEach(() => {
  s = memoryStorage();
  events = 0;
  vi.stubGlobal('window', { dispatchEvent: () => ((events += 1), true) });
});
afterEach(() => vi.unstubAllGlobals());

describe('saveCopy', () => {
  it('adds, tells the shell, and asks before replacing the same trip', () => {
    const a = saveCopy(s, input('dolomites-2027'));
    expect(a.kind).toBe('added');
    expect(events).toBe(1);
    const again = saveCopy(s, input('dolomites-2027', { start: '2027-08-01' }));
    expect(again.kind).toBe('exists');
    expect(read(s).items).toHaveLength(1);
    expect(events).toBe(1);
    const r = saveCopy(s, input('dolomites-2027', { start: '2027-08-01' }), { replace: true });
    expect(r.kind).toBe('added');
    expect(read(s).items.map((i) => i.start)).toEqual(['2027-08-01']);
  });
  it('undo of a replace puts the earlier copy back', () => {
    saveCopy(s, input('a'));
    const r = saveCopy(s, input('a', { start: '2027-09-01' }), { replace: true });
    if (r.kind !== 'added') throw new Error('x');
    expect(undoSave(s, r.item, r.replaced)).toBe(true);
    expect(read(s).items.map((i) => i.start)).toEqual(['2027-07-03']);
  });
  it('refuses the 21st trip with the cap and writes nothing', () => {
    for (let i = 0; i < DEVICE_COPY_CAP; i++) expect(saveCopy(s, input(`trip-${i}`)).kind).toBe('added');
    const before = s.getItem(COPIES_KEY);
    expect(saveCopy(s, input('one-more')).kind).toBe('cap');
    expect(s.getItem(COPIES_KEY)).toBe(before);
    // replacing a trip already held is still allowed at the cap
    expect(saveCopy(s, input('trip-3'), { replace: true }).kind).toBe('added');
  });
  it('leaves a newer or damaged envelope exactly as it is', () => {
    s.setItem(COPIES_KEY, JSON.stringify({ schema: 'copies/2', items: [] }));
    expect(saveCopy(s, input('a'))).toEqual({ kind: 'failed', reason: 'newer' });
    expect(s.getItem(COPIES_KEY)).toBe(JSON.stringify({ schema: 'copies/2', items: [] }));
    s.setItem(COPIES_KEY, '{nope');
    expect(saveCopy(s, input('a'))).toEqual({ kind: 'failed', reason: 'corrupt' });
    expect(s.getItem(COPIES_KEY)).toBe('{nope');
  });
  it('keeps the copy in a per-tab store when the browser keeps nothing (the caller passes the memory store)', () => {
    const mem = memoryStorage();
    expect(saveCopy(mem, input('a')).kind).toBe('added');
    expect(read(mem).items).toHaveLength(1);
  });
});

describe('remove, restore, change dates', () => {
  it('remove then undo brings it back; remove then reload does not', () => {
    saveCopy(s, input('a'));
    const id = read(s).items[0]!.id;
    const r = removeById(s, id);
    if (!r.ok) throw new Error('x');
    expect(read(s).items).toHaveLength(0);
    expect(undoRemove(s, r.removed)).toBe(true);
    expect(read(s).items).toHaveLength(1);
    removeById(s, id);
    expect(read(s).items).toHaveLength(0);
  });
  it('undo of remove fails once the trip was copied again', () => {
    saveCopy(s, input('a'));
    const r = removeById(s, read(s).items[0]!.id);
    if (!r.ok) throw new Error('x');
    saveCopy(s, input('a', { start: '2027-10-01' }));
    expect(undoRemove(s, r.removed)).toBe(false);
    expect(read(s).items).toHaveLength(1);
  });
  it('change dates keeps the id and the copy time, and undo restores both', () => {
    saveCopy(s, input('a'));
    const before = read(s).items[0]!;
    const c = changeDates(s, before.id, { start: '2027-07-10', adults: 1, children: [5] });
    if (!c.ok) throw new Error('x');
    const now = read(s).items[0]!;
    expect([now.id, now.copiedAt, now.start, now.adults, now.children]).toEqual([before.id, before.copiedAt, '2027-07-10', 1, [5]]);
    expect(undoChange(s, c.before)).toBe(true);
    expect(read(s).items[0]).toEqual(before);
  });
  it('refuses a change to a copy another tab already removed', () => {
    expect(changeDates(s, '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', { start: '2027-07-10', adults: 2, children: [] })).toEqual({ ok: false, reason: 'refused' });
  });
});

describe('the one-time move of the old key', () => {
  const draft = (slug: string, o: Record<string, unknown> = {}) => ({ slug, start: '2027-07-03', adults: 2, children: [], savedAt: '2026-10-01T10:00:00.000Z', ...o });
  it('shows a draft with one bad override and deletes the old key only after a good write', () => {
    s.setItem(LEGACY_COPIES_KEY, JSON.stringify([draft('dolomites-2027', { overrides: { '3': 'B', '4': 'ZZ' } })]));
    const r = moveLegacyOnce(s);
    expect(r).toMatchObject({ status: 'moved', moved: 1, kept: 0, dropped: 0 });
    expect(read(s).items[0]).toMatchObject({ slug: 'dolomites-2027', overrides: { '3': 'B' } });
    expect(s.getItem(LEGACY_COPIES_KEY)).toBeNull();
    expect(s.getItem(LEGACY_MOVED_KEY)).not.toBeNull();
  });
  it('moves once: a removed copy is not pulled back by the next read, and over-cap drafts stay under the old key', () => {
    const many = Array.from({ length: DEVICE_COPY_CAP + 2 }, (_, i) => draft(`trip-${i}`, { savedAt: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }));
    s.setItem(LEGACY_COPIES_KEY, JSON.stringify(many));
    const r = moveLegacyOnce(s);
    expect(r).toMatchObject({ status: 'moved', moved: DEVICE_COPY_CAP, kept: 2 });
    removeById(s, read(s).items[0]!.id);
    expect(moveLegacyOnce(s)).toEqual({ status: 'none' });
    expect(read(s).items).toHaveLength(DEVICE_COPY_CAP - 1);
  });
  it('leaves everything alone when the envelope is newer', () => {
    s.setItem(COPIES_KEY, JSON.stringify({ schema: 'copies/2', items: [] }));
    s.setItem(LEGACY_COPIES_KEY, JSON.stringify([draft('a')]));
    expect(moveLegacyOnce(s)).toMatchObject({ status: 'failed' });
    expect(s.getItem(LEGACY_COPIES_KEY)).not.toBeNull();
  });
});

describe('rows', () => {
  const base = saveAndGet();
  function saveAndGet() {
    const m = memoryStorage();
    vi.stubGlobal('window', { dispatchEvent: () => true });
    saveCopy(m, input('dolomites-2027', { title: 'Dolomites', children: [6], adults: 2 }));
    return read(m).items[0]!;
  }
  it('counts down in neutral words', () => {
    expect(countdown('2027-07-03', 14, '2026-10-25')).toEqual({ text: 'in 251 days', group: 'upcoming' });
    expect(countdown('2027-07-03', 14, '2027-07-02').text).toBe('tomorrow');
    expect(countdown('2027-07-03', 14, '2027-07-06')).toEqual({ text: 'Day 4 of 14 · now', group: 'upcoming' });
    expect(countdown('2027-07-03', 14, '2027-07-16').group).toBe('upcoming');
    expect(countdown('2027-07-03', 14, '2027-07-17')).toEqual({ text: 'ended yesterday', group: 'past' });
    expect(countdown('2027-07-03', 14, '2027-08-01').text).toBe('ended 16 days ago');
  });
  it('writes three lines that fit 30 characters at 320', () => {
    const r = rowModel(base, '2026-10-25');
    expect(r.title).toBe('Dolomites');
    expect(r.when).toBe('Sat 3 Jul 2027 · in 251 days');
    expect(r.who).toBe('14 days · 2 adults, 1 child');
    expect(r.when.length).toBeLessThanOrEqual(30);
    expect(r.who.length).toBeLessThanOrEqual(30);
  });
  it('says the party in words', () => {
    expect(partyText({ adults: 1, children: [] })).toBe('1 adult');
    expect(partyText({ adults: 2, children: [3, 5] })).toBe('2 adults, 2 children');
  });
  it('names a moved legacy copy from its slug until the catalogue gives the name', () => {
    expect(rowTitle({ title: 'Trip', slug: 'canadian-rockies-sept-2029' })).toBe('Canadian rockies sept 2029');
    expect(rowTitle({ title: 'Dolomites', slug: 'x' })).toBe('Dolomites');
  });
  it('groups Upcoming soonest first and Past latest first', () => {
    const m = memoryStorage();
    for (const [slug, start] of [['b', '2027-09-01'], ['a', '2027-07-01'], ['old', '2025-01-01'], ['older', '2024-01-01']] as const) saveCopy(m, input(slug, { start }));
    const g = groupRows(read(m).items, '2026-10-25');
    expect(g.upcoming.map((r) => r.item.slug)).toEqual(['a', 'b']);
    expect(g.past.map((r) => r.item.slug)).toEqual(['old', 'older']);
  });
});

describe('Open', () => {
  const m = () => memoryStorage();
  it('carries party band, pace, walk, split, variants and additions through the codec, never the ages', () => {
    const st = m();
    saveCopy(st, input('dolomites-2027', {
      children: [6, 9], adults: 1,
      profile: { party: 'family', youngest: 6, pace: 'relaxed', adults: 1, walk: 8, split: true },
      overrides: { '5': 'C', '9': 'A' },
      added: [{ day: 5, placeSlug: 'moraine-lake' }],
    }));
    const href = openHref(read(st).items[0]!);
    expect(href.startsWith('/trips/dolomites-2027/?')).toBe(true);
    const state = parseTimelineUrl(href.split('?')[1]!);
    expect(state.profile).toMatchObject({ party: 'family', youngest: 6, pace: 'relaxed', adults: 1, walkKm: 8, split: true });
    expect(state.overrides).toEqual({ 5: 'C', 9: 'A' });
    expect(state.added).toEqual([{ day: 5, slug: 'moraine-lake' }]);
    expect(decodeURIComponent(href)).not.toContain('6,9');
  });
  it('writes a=<adults> from 3 to 12, leaves the default 2 out, and never a child age', () => {
    const st = m();
    saveCopy(st, input('c', { adults: 5, children: [3, 8] }));
    expect(openHref(read(st).items[0]!)).toBe('/trips/c/?p=family-3&a=5&view=day');
    const st2 = m();
    saveCopy(st2, input('d', { adults: 2, children: [8] }));
    expect(openHref(read(st2).items[0]!)).toBe('/trips/d/?p=family-8&view=day');
  });
  it('a copy with no stored profile opens on the default with the youngest child as the band', () => {
    const st = m();
    saveCopy(st, input('a', { children: [4, 11] }));
    expect(openHref(read(st).items[0]!)).toBe('/trips/a/?p=family-4&view=day');
    const st2 = m();
    saveCopy(st2, input('b'));
    expect(openHref(read(st2).items[0]!)).toBe('/trips/b/?view=day');
  });
});

describe('Open writes the profile codec\'s format itself (so the Mine chunk does not share the codec with the trip page)', () => {
  const cases: Partial<CopyInput>[] = [
    {},
    { children: [4, 11] },
    { adults: 1 },
    { adults: 3 },
    { adults: 12, children: [5, 7, 9] },
    { children: [0], profile: { party: 'family', youngest: 0, pace: 'full', adults: 2, walk: 12, split: false } },
    { adults: 1, profile: { party: 'adults', youngest: null, pace: 'relaxed', adults: 1, walk: 5, split: true }, overrides: { '12': 'B', '3': 'A' }, added: [{ day: 2, placeSlug: 'a-b' }, { day: 9, placeSlug: 'c' }] },
    { profile: { party: 'family', youngest: 17, pace: 'standard', adults: 2, walk: 8, split: false } },
  ];
  it.each(cases.map((c, i) => [i, c] as const))('case %i equals serialiseTimelineUrl and reads back', (_i, c) => {
    const st = memoryStorage();
    saveCopy(st, input('t', c));
    const item = read(st).items[0]!;
    const url = parseTimelineUrl(openQuery(item));
    const expected = serialiseTimelineUrl({
      profile: {
        ...DEFAULT_PROFILE,
        ...(item.profile ? { party: item.profile.party, youngest: item.profile.youngest, pace: item.profile.pace, walkKm: item.profile.walk, split: item.profile.split } : item.children.length ? { party: 'family' as const, youngest: Math.min(...item.children) } : {}),
        adults: item.adults,
      },
      overrides: Object.fromEntries(Object.entries(item.overrides).map(([k, v]) => [Number(k), v])),
      added: item.added.map((a) => ({ day: a.day, slug: a.placeSlug })),
    });
    // the codec's keys, then the tab the trip page opens a copy on (UXB-2): the Summary is the default tab since UXB-1
    expect(openQuery(item)).toBe([expected, 'view=day'].filter(Boolean).join('&'));
    expect(serialiseTimelineUrl(url)).toBe(expected);
    expect(url.profile.adults).toBe(item.adults);
  });
});
