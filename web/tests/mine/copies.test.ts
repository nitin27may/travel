import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIES_KEY, DEVICE_COPY_CAP, LEGACY_COPIES_KEY, LEGACY_MOVED_KEY, memoryStorage, readCopies } from '@travel/core/schema/copies.ts';
import type { CopyInput, StorageLike } from '@travel/core/schema/copies.ts';
import { parseTimelineUrl, serialiseTimelineUrl } from '@travel/core/schedule/profileCodec.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import { landingFor } from '@travel/core/trips/party.ts';
import {
  changeDates, moveLegacyOnce, partyText, removeById, saveCopy, undoChange, undoRemove, undoSave,
} from '@/lib/mine/copies';
import { pruneOrphanEdits, readOverview } from '@/lib/mine/overview';
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
  it('writes a=<adults> from 1 to 12, 2 included, and never a child age', () => {
    const st = m();
    saveCopy(st, input('c', { adults: 5, children: [3, 8] }));
    expect(openHref(read(st).items[0]!)).toBe('/trips/c/?p=family-3&a=5&view=day&mine=1');
    const st2 = m();
    saveCopy(st2, input('d', { adults: 2, children: [8] }));
    expect(openHref(read(st2).items[0]!)).toBe('/trips/d/?p=family-8&a=2&view=day&mine=1');
  });
  it('a copy with no stored profile opens on the default with the youngest child as the band', () => {
    const st = m();
    saveCopy(st, input('a', { children: [4, 11] }));
    expect(openHref(read(st).items[0]!)).toBe('/trips/a/?p=family-4&a=2&view=day&mine=1');
    const st2 = m();
    saveCopy(st2, input('b'));
    expect(openHref(read(st2).items[0]!)).toBe('/trips/b/?p=adults&a=2&view=day&mine=1');
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
    // the codec leaves default party keys out; a copy always writes them (EM-B), in the codec's order, then the tab and the marker
    const q = new URLSearchParams(expected);
    q.set('p', q.get('p') ?? 'adults');
    q.set('a', q.get('a') ?? '2');
    const order = ['p', 'pace', 'a', 'walk', 'split', 'd', 'add'];
    const withParty = order.filter((k) => q.has(k)).map((k) => `${k}=${q.get(k)}`).join('&').replace(/%2C/g, ',');
    expect(openQuery(item)).toBe([withParty, 'view=day', 'mine=1'].join('&'));
    expect(serialiseTimelineUrl(url)).toBe(expected);
    expect(url.profile.adults).toBe(item.adults);
  });
});

describe('EM-B: a copy opens with its own party', () => {
  const dev = { adults: 2, children: [6] };
  const fam = { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false } as const;
  const defaults = { ...DEFAULT_PROFILE };
  const land = (c: CopyInput) => {
    const st = memoryStorage();
    saveCopy(st, c);
    const q = openQuery(read(st).items[0]!);
    const state = parseTimelineUrl(q);
    return { q, state, landing: landingFor({ query: q, device: dev, defaults, urlProfile: state.profile }) };
  };
  it('B1: Change dates to adults only rewrites the profile, so Open asks for p=adults', () => {
    const st = memoryStorage();
    saveCopy(st, input('t', { children: [6], profile: fam }));
    const id = read(st).items[0]!.id;
    expect(openQuery(read(st).items[0]!)).toContain('p=family-6');
    const r = changeDates(st, id, { start: '2027-08-01', adults: 2, children: [] });
    expect(r.ok).toBe(true);
    const item = read(st).items[0]!;
    expect(item.profile).toMatchObject({ party: 'adults', youngest: null, adults: 2, pace: 'standard' });
    expect(openQuery(item)).toContain('p=adults');
    expect(openQuery(item)).not.toContain('family');
  });
  it('B1: a new child set moves the youngest, and the adults follow; pace, walk and split are kept', () => {
    const st = memoryStorage();
    saveCopy(st, input('t', { children: [6], profile: { ...fam, pace: 'relaxed', walk: 8, split: true } }));
    const id = read(st).items[0]!.id;
    const first = read(st).items[0]!;
    const r = changeDates(st, id, { start: '2027-08-01', adults: 3, children: [12, 9] });
    expect(read(st).items[0]!.profile).toEqual({ party: 'family', youngest: 9, pace: 'relaxed', adults: 3, walk: 8, split: true });
    if (r.ok) undoChange(st, r.before);
    expect(read(st).items[0]).toEqual(first);
  });
  it('B1: a copy with no stored profile stays without one (its party follows the travellers)', () => {
    const st = memoryStorage();
    saveCopy(st, input('t'));
    changeDates(st, read(st).items[0]!.id, { start: '2027-08-01', adults: 2, children: [5] });
    expect(read(st).items[0]!.profile).toBeNull();
    expect(openQuery(read(st).items[0]!)).toContain('p=family-5');
  });
  it.each([
    ['adults only', {}, 'adults', 2],
    ['a family', { children: [6], profile: fam }, 'family', 2],
    ['three adults', { adults: 3 }, 'adults', 3],
  ] as const)('B2: %s always writes the party keys and lands on the link, never the device party', (_n, c, party, adults) => {
    const { q, state, landing } = land(input('t', c as Partial<CopyInput>));
    expect(q).toMatch(/(^|&)p=/);
    expect(q).toMatch(/(^|&)a=\d+/);
    expect(state.profile).toMatchObject({ party, adults });
    expect(landing.mode).toBe('shared');
    expect(landing.apply).toBeNull();
  });
  it('B3: a copy carries the marker mine=1 after view=day', () => {
    expect(land(input('t')).q.endsWith('&view=day&mine=1')).toBe(true);
  });
});

// Review STEP2-ES ES-002: a copy's device edits (notes, removed and moved stops, Maybe) and its undo stack in the tab leave with the copy.
describe('a removed or replaced copy takes its device edits with it (ES-002)', () => {
  const DEVICE = 'travel.trip-edit.device';
  const entry = { added: [], removed: [{ op: 'o-1', day: 2, item: 'x' }], moved: [], days: [], maybe: [], notes: { '2': 'Emma nap 13:00' } };
  const plant = (id: string) => s.setItem(DEVICE, JSON.stringify({ v: 1, items: { ...(JSON.parse(s.getItem(DEVICE) ?? '{"items":{}}') as { items: object }).items, [id]: entry } }));
  let session: Map<string, string>;
  beforeEach(() => {
    session = new Map();
    vi.stubGlobal('window', {
      dispatchEvent: () => true,
      sessionStorage: {
        get length() { return session.size; },
        key: (i: number) => [...session.keys()][i] ?? null,
        getItem: (k: string) => session.get(k) ?? null,
        setItem: (k: string, v: string) => void session.set(k, v),
        removeItem: (k: string) => void session.delete(k),
      },
    });
  });

  it('Remove deletes the entry and the undo stack; Undo of Remove puts the entry back', () => {
    const a = saveCopy(s, input('a'));
    if (a.kind !== 'added') throw new Error('x');
    plant(a.item.id);
    session.set(`travel.trip-edit.undo.${a.item.id}`, '{"v":1,"past":[],"future":[]}');
    const r = removeById(s, a.item.id);
    if (!r.ok) throw new Error('x');
    expect(s.getItem(DEVICE)).toBeNull();
    expect(session.has(`travel.trip-edit.undo.${a.item.id}`)).toBe(false);
    expect(undoRemove(s, r.removed, r.edits)).toBe(true);
    expect(JSON.parse(s.getItem(DEVICE)!).items[a.item.id]).toEqual(entry);
  });

  it('a replace takes the replaced copy\'s entry; Undo of the replace puts it back', () => {
    const a = saveCopy(s, input('a'));
    if (a.kind !== 'added') throw new Error('x');
    plant(a.item.id);
    const r = saveCopy(s, input('a', { start: '2027-09-01' }), { replace: true });
    if (r.kind !== 'added') throw new Error('x');
    expect(r.replacedEdits).toEqual(entry);
    expect(s.getItem(DEVICE)).toBeNull();
    expect(undoSave(s, r.item, r.replaced, r.replacedEdits)).toBe(true);
    expect(JSON.parse(s.getItem(DEVICE)!).items[a.item.id]).toEqual(entry);
  });

  it('Mine\'s load drops entries whose copy is gone, and keeps the live ones', () => {
    const a = saveCopy(s, input('a'));
    if (a.kind !== 'added') throw new Error('x');
    plant(a.item.id);
    plant('00000000-0000-4000-8000-000000000000');
    pruneOrphanEdits(s, readOverview(s));
    expect(Object.keys(JSON.parse(s.getItem(DEVICE)!).items)).toEqual([a.item.id]);
  });
});
