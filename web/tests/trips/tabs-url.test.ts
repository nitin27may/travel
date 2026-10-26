import { describe, expect, it } from 'vitest';
import { resolveTripTab, tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { parseTripUrl, tripQuery } from '@/components/trips/useTripUrl';

// UXB-1: how the trip page lands on a tab. The URL's `view`, then the fragment, then the tab this device remembered, then the Summary;
// a tab the trip does not draw is never the answer (spec 3.4). The rules are core's (resolveTripTab); these pin them where the page reads them.
const ALL: TripTab[] = ['summary', 'days', 'stops', 'bookings', 'photos'];
const land = (search: string, hash: string, remembered: TripTab | null = null, available: readonly TripTab[] = ALL) => {
  const u = parseTripUrl(search, hash);
  return resolveTripTab({ view: u.view, hash: u.hash, remembered, available });
};

describe('landing on a tab', () => {
  it('opens the Summary with no view, no fragment and nothing remembered', () => {
    expect(land('', '')).toMatchObject({ tab: 'summary', from: 'default' });
    expect(land('?p=family-6&pace=relaxed', '')).toMatchObject({ tab: 'summary' });
  });
  it('the URL first: view=day, view=all, view=bookings, view=photos', () => {
    expect(land('?view=day', '', 'photos')).toMatchObject({ tab: 'days', from: 'url' });
    expect(land('?view=all', '')).toMatchObject({ tab: 'stops' });
    expect(land('?view=bookings', '')).toMatchObject({ tab: 'bookings' });
    expect(land('?view=photos', '')).toMatchObject({ tab: 'photos' });
    expect(land('?view=table', '')).toMatchObject({ tab: 'days', daysView: 'table' });
  });
  it('old links still open the same list: view=category and #trails open Stops, #day-N opens Days', () => {
    expect(land('?view=category', '')).toMatchObject({ tab: 'stops' });
    expect(land('?view=category', '#trails')).toMatchObject({ tab: 'stops' });
    expect(land('', '#trails')).toMatchObject({ tab: 'stops', from: 'hash' });
    expect(land('', '#day-11')).toMatchObject({ tab: 'days', from: 'hash' });
    expect(land('?p=adults&view=day', '#day-4')).toMatchObject({ tab: 'days' });
  });
  it('the remembered tab applies only when the URL names none', () => {
    expect(land('', '', 'bookings')).toMatchObject({ tab: 'bookings', from: 'device' });
    expect(land('?view=all', '', 'bookings')).toMatchObject({ tab: 'stops', from: 'url' });
    expect(land('', '#day-2', 'bookings')).toMatchObject({ tab: 'days', from: 'hash' });
  });
  it('a tab the trip does not draw falls through: an overview trip asked for Days opens the Summary', () => {
    const overview: TripTab[] = ['summary', 'photos'];
    expect(land('?view=day', '', null, overview)).toMatchObject({ tab: 'summary' });
    expect(land('?view=bookings', '', 'days', overview)).toMatchObject({ tab: 'summary' });
    expect(land('', '', 'photos', overview)).toMatchObject({ tab: 'photos' });
  });
  it('an unknown view value falls back like an absent one', () => {
    expect(land('?view=nonsense', '')).toMatchObject({ tab: 'summary', from: 'default' });
  });
});

describe('the tabs a trip draws', () => {
  it('Summary always; Days and Stops with a plan; Bookings with a booking; Photos with the photo minimum', () => {
    expect(tripTabsFor({ days: 15, stops: 76, bookings: 7, photos: 41 })).toEqual(ALL);
    expect(tripTabsFor({ days: 14, stops: 40, bookings: 0, photos: 0 })).toEqual(['summary', 'days', 'stops']);
    expect(tripTabsFor({ days: 0, stops: 0, bookings: 0, photos: 17 })).toEqual(['summary', 'photos']);
    expect(tripTabsFor({ days: 0, stops: 0, bookings: 0, photos: 0 })).toEqual(['summary']);
  });
});

describe('the address a tab writes', () => {
  it('keeps the profile keys and any other key, and leaves view out for the Summary', () => {
    const t = (tab: TripTab, daysView: 'list' | 'table' = 'list') => ({ tab, daysView });
    expect(tripQuery(t('summary'), 'p=family-6&pace=relaxed')).toBe('?p=family-6&pace=relaxed');
    expect(tripQuery(t('days'), 'p=family-6')).toBe('?p=family-6&view=day');
    expect(tripQuery(t('days', 'table'), '')).toBe('?view=table');
    expect(tripQuery(t('stops'), '', 'utm=mail')).toBe('?view=all&utm=mail');
    expect(tripQuery(t('bookings'), 'd=5C,9A')).toBe('?d=5C,9A&view=bookings');
    expect(tripQuery(t('photos'), '')).toBe('?view=photos');
  });
});
