import { describe, expect, it } from 'vitest';
import { seasonLabel } from '@/lib/format/season';
import { formatDistance, formatElevation, formatMoney, formatTemperature, defaultPrefs, parsePrefs } from '@/lib/format/units';

describe('distance: one decimal, km or mi', () => {
  it('formats kilometres to one decimal', () => {
    expect(formatDistance(21.5, 'km')).toBe('21.5 km');
    expect(formatDistance(10, 'km')).toBe('10.0 km');
    expect(formatDistance(0.04, 'km')).toBe('0.0 km');
    expect(formatDistance(2.25, 'km')).toBe('2.3 km');
  });
  it('converts to miles to one decimal', () => {
    expect(formatDistance(10, 'mi')).toBe('6.2 mi');
    expect(formatDistance(21.5, 'mi')).toBe('13.4 mi');
    expect(formatDistance(1.609344, 'mi')).toBe('1.0 mi');
  });
});

describe('elevation: nearest 10, m or ft', () => {
  it('rounds metres to the nearest 10', () => {
    expect(formatElevation(1731, 'm')).toBe('1,730 m');
    expect(formatElevation(1735, 'm')).toBe('1,740 m');
    expect(formatElevation(4, 'm')).toBe('0 m');
    expect(formatElevation(5, 'm')).toBe('10 m');
  });
  it('converts to feet and rounds to the nearest 10', () => {
    expect(formatElevation(1731, 'ft')).toBe('5,680 ft');
    expect(formatElevation(950, 'ft')).toBe('3,120 ft');
    expect(formatElevation(0, 'ft')).toBe('0 ft');
  });
});

describe('temperature and money', () => {
  it('rounds to whole degrees in C or F', () => {
    expect(formatTemperature(21.4, 'C')).toBe('21\u00b0C');
    expect(formatTemperature(0, 'F')).toBe('32\u00b0F');
    expect(formatTemperature(21.5, 'F')).toBe('71\u00b0F');
    expect(formatTemperature(-5, 'F')).toBe('23\u00b0F');
  });
  it('shows money in the chosen currency without converting', () => {
    expect(formatMoney(1200, 'CAD')).toMatch(/1,200/);
    expect(formatMoney(12.5, 'USD')).toMatch(/12\.50/);
    expect(formatMoney(5, 'not-a-code')).toBe('5 not-a-code');
  });
});

describe('preferences', () => {
  it('defaults from the browser locale: en-US is imperial, everything else metric', () => {
    expect(defaultPrefs('en-US')).toMatchObject({ distance: 'mi', elevation: 'ft', temperature: 'F' });
    expect(defaultPrefs('en-CA')).toMatchObject({ distance: 'km', elevation: 'm', temperature: 'C' });
    expect(defaultPrefs('fr-FR')).toMatchObject({ distance: 'km' });
    expect(defaultPrefs(undefined)).toMatchObject({ distance: 'km' });
  });
  it('lets stored values override the locale, field by field, and ignores junk', () => {
    expect(parsePrefs('{"distance":"km"}', 'en-US')).toMatchObject({ distance: 'km', elevation: 'ft' });
    expect(parsePrefs('{"distance":"parsecs","currency":"cad"}', 'en-CA')).toMatchObject({ distance: 'km', currency: 'CAD' });
    expect(parsePrefs('not json', 'en-US')).toEqual(defaultPrefs('en-US'));
    expect(parsePrefs(null, 'en-CA')).toEqual(defaultPrefs('en-CA'));
    expect(parsePrefs('{"density":"compact"}', 'en-CA').density).toBe('compact');
  });
});

describe('season label', () => {
  it('collapses runs and wraps over the year end', () => {
    expect(seasonLabel([6, 7, 8, 9])).toBe('Jun to Sep');
    expect(seasonLabel([9, 10])).toBe('Sep, Oct');
    expect(seasonLabel([5])).toBe('May');
    expect(seasonLabel([11, 12, 1, 2])).toBe('Nov to Feb');
    expect(seasonLabel([3, 4, 5, 8, 9])).toBe('Mar to May, Aug, Sep');
    expect(seasonLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('Year-round');
    expect(seasonLabel([])).toBe('');
  });
});
