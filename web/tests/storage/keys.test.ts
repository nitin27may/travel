// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRIP_UI_ENTRY, PARTY_CHANGED_EVENT, PARTY_KEY, TRIPUI_KEY, TRIPUI_MAX_TRIPS, clearParty, patchTripUi, readParty, readTripEntry, readTripUi,
  rememberedTab, writeParty, writePartyOpen, writeTripEntry,
} from '@/lib/storage/keys';
import { resolveTripTab, TRIP_TABS } from '@travel/core/trips/tabs.ts';

// UXB-C (trip-and-places-ux-fixes.md 10.2): travel.party and travel.tripui through safe.ts; blocked storage gives the defaults.
let data: Map<string, string>;
let events: string[];
function fakeWindow(blocked = false) {
  data = new Map();
  events = [];
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const w = { dispatchEvent: (e: Event) => { events.push(e.type); return true; } } as Record<string, unknown>;
  Object.defineProperty(w, 'localStorage', blocked ? { get: () => { throw new DOMException('denied', 'SecurityError'); } } : { value: store });
  vi.stubGlobal('window', w);
  vi.stubGlobal('Event', class { constructor(public type: string) {} });
}
afterEach(() => vi.unstubAllGlobals());

describe('travel.party', () => {
  it('round-trips a party with each age, versioned, and tells the page', () => {
    fakeWindow();
    expect(readParty()).toBeNull();
    expect(writeParty({ adults: 2, children: [7, null] })).toBe(true);
    expect(JSON.parse(data.get(PARTY_KEY)!)).toEqual({ v: 1, adults: 2, children: [7, null] });
    expect(readParty()).toEqual({ adults: 2, children: [7, null] });
    expect(events).toEqual([PARTY_CHANGED_EVENT]);
    expect(clearParty()).toBe(true);
    expect(readParty()).toBeNull();
  });
  it('cleans a stored value to the limits and ignores another version or garbage', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 30, children: [1, 2, 3, 4, 5, 6, 7, 8, 9, 40] }));
    expect(readParty()).toEqual({ adults: 12, children: [1, 2, 3, 4, 5, 6, 7, 8] });
    data.set(PARTY_KEY, JSON.stringify({ v: 2, adults: 2, children: [] }));
    expect(readParty()).toBeNull();
    data.set(PARTY_KEY, '{not json');
    expect(readParty()).toBeNull();
  });
  it('blocked storage: no party, no error, the write says it failed', () => {
    fakeWindow(true);
    expect(readParty()).toBeNull();
    expect(writeParty({ adults: 2, children: [5] })).toBe(false);
    expect(events).toEqual([]);
  });
});

describe('travel.tripui', () => {
  it('remembers a tab per trip; with nothing remembered the URL and the default decide', () => {
    fakeWindow();
    expect(rememberedTab('canadian-rockies-2029')).toBeNull();
    expect(readTripEntry('canadian-rockies-2029')).toEqual(DEFAULT_TRIP_UI_ENTRY);
    expect(writeTripEntry('canadian-rockies-2029', { tab: 'days', daysView: 'table' })).toBe(true);
    expect(rememberedTab('canadian-rockies-2029')).toEqual({ tab: 'days', daysView: 'table' });
    const r = rememberedTab('canadian-rockies-2029')!;
    expect(resolveTripTab({ view: null, hash: '', remembered: r.tab, rememberedDaysView: r.daysView, available: [...TRIP_TABS] })).toEqual({ tab: 'days', daysView: 'table', from: 'device' });
    writeTripEntry('canadian-rockies-2029', { shapeOpen: true, asWritten: true });
    expect(readTripEntry('canadian-rockies-2029')).toEqual({ tab: 'days', daysView: 'table', shapeOpen: true, rows: 'all', asWritten: true });
    writePartyOpen(true);
    expect(readTripUi().partyOpen).toBe(true);
    expect(readTripEntry('canadian-rockies-2029').tab).toBe('days');
  });
  it('keeps at most 30 trips, dropping the least recently written', () => {
    fakeWindow();
    for (let i = 0; i < TRIPUI_MAX_TRIPS + 5; i++) writeTripEntry(`trip-${i}`, { tab: 'photos' });
    writeTripEntry('trip-6', { tab: 'stops' });
    const ui = readTripUi();
    expect(Object.keys(ui.trips)).toHaveLength(TRIPUI_MAX_TRIPS);
    expect(ui.trips['trip-0']).toBeUndefined();
    expect(ui.trips['trip-4']).toBeUndefined();
    expect(ui.trips['trip-5']?.tab).toBe('photos');
    expect(Object.keys(ui.trips).at(-1)).toBe('trip-6');
  });
  it('cleans what it reads: unknown tabs, fields and slugs are dropped', () => {
    fakeWindow();
    data.set(TRIPUI_KEY, JSON.stringify({ v: 1, partyOpen: 'yes', trips: { 'ok-trip': { tab: 'map', rows: 'stops', extra: 1, children: [7] }, 'Bad Slug': { tab: 'days' } } }));
    expect(readTripUi()).toEqual({ v: 1, partyOpen: false, trips: { 'ok-trip': { tab: 'summary', daysView: 'list', shapeOpen: false, rows: 'stops', asWritten: false } } });
    expect(patchTripUi(readTripUi(), '../x', { tab: 'days' })).toEqual(readTripUi());
  });
  it('blocked storage: defaults every time, silently', () => {
    fakeWindow(true);
    expect(readTripUi()).toEqual({ v: 1, partyOpen: false, trips: {} });
    expect(rememberedTab('canadian-rockies-2029')).toBeNull();
    expect(writeTripEntry('canadian-rockies-2029', { tab: 'days' })).toBe(false);
  });
  it('never holds household data', () => {
    fakeWindow();
    writeParty({ adults: 3, children: [4, 9] });
    writeTripEntry('dolomites-2027', { tab: 'bookings' });
    expect(data.get(TRIPUI_KEY)).not.toMatch(/adults|children|youngest/);
  });
});
