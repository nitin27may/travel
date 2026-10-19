import { describe, expect, it } from 'vitest';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import { buildTripExport } from '@/lib/export/build.server';
import { buildIcs, icsEventCount } from '@/lib/export/ics';
import { getTrip } from '@/lib/public';
import { parseIcs } from './helpers';

const NOW = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));
const trip = getTrip('canadian-rockies-2029')!;
const exp = buildTripExport(trip);
const sunPoints = Object.fromEntries(trip.days.map((d) => [d.n, d.scheduleInput!.sunPoint]));
const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), trip.schedule!.defaultProfile);
const make = (full: boolean, tls = timelines) => buildIcs(exp, '2029-09-08', NOW, { timelines: tls, sunPoints, full });

describe('ICS from the timeline (spec 3.9, check 13)', () => {
  const { events } = parseIcs(make(false));
  const timed = (day: number) => events.filter((e) => e.get('UID')?.includes(`-day-${day}-`));
  it('has one all-day event per day and timed events at the computed times', () => {
    expect(events.filter((e) => e.param('DTSTART', 'VALUE') === 'DATE')).toHaveLength(15);
    const cruise = timed(5).find((e) => e.get('SUMMARY') === 'Spirit Island cruise')!;
    expect(cruise.get('DTSTART')).toBe('20290912T100000');
    expect(cruise.get('DTEND')).toBe('20290912T113000');
    expect(cruise.param('DTSTART', 'TZID')).toBeTruthy();
  });
  it('says how firm each time is, and where it comes from, at the start of the description', () => {
    expect(timed(5).find((e) => e.get('SUMMARY') === 'Spirit Island cruise')!.get('DESCRIPTION')).toMatch(/^Fixed slot\\, operator timetable/);
    expect(timed(5).find((e) => e.get('SUMMARY') === 'Mary Schaffer Loop')!.get('DESCRIPTION')).toMatch(/^Suggested time\\, our rule/);
    expect(timed(5).find((e) => e.get('SUMMARY') === 'Pyramid Lake')!.get('DESCRIPTION')).toMatch(/^Sun-timed\\, sun\\, computed for the real date/);
  });
  it('recomputes a sun-tied entry for the real date', () => {
    const pyramid = timed(5).find((e) => e.get('SUMMARY') === 'Pyramid Lake')!;
    // 12 Sep 2029 sunset in Jasper is about 20:12; 40 minutes before it
    expect(pyramid.get('DTSTART')).toMatch(/^20290912T19[2-4]\d00$/);
  });
  it('leaves out coffee, rest and sun events unless Full detail is ticked', () => {
    const titles = (full: boolean) => parseIcs(make(full)).events.map((e) => e.get('SUMMARY'));
    expect(titles(false).some((t) => /Coffee|Free time|Rest at the base|Sunset/.test(t ?? ''))).toBe(false);
    expect(titles(true).some((t) => /Coffee|Free time|Rest at the base|Sunset/.test(t ?? ''))).toBe(true);
    expect(icsEventCount(exp, { timelines, sunPoints, full: true }).timed).toBeGreaterThan(icsEventCount(exp, { timelines, sunPoints, full: false }).timed);
  });
  it('follows the chosen profile', () => {
    const adults = scheduleTrip(trip.days.map((d) => d.scheduleInput!), { ...DEFAULT_PROFILE, party: 'adults', youngest: null });
    const titles = parseIcs(make(false, adults)).events.map((e) => e.get('SUMMARY'));
    expect(titles).toContain('Bald Hills');
    expect(titles).not.toContain('Mary Schaffer Loop');
  });
  it('without a timeline the file is the old one', () => {
    expect(buildIcs(exp, '2029-09-08', NOW)).toBe(buildIcs(exp, '2029-09-08', NOW, undefined));
  });
});
