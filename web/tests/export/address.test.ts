import { describe, expect, it } from 'vitest';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { buildTripExport } from '@/lib/export/build.server';
import { TRIP_CSV_HEADER, tripCsv } from '@/lib/export/csv';
import { buildIcs } from '@/lib/export/ics';
import { approxNote, checkPoint } from '@/lib/export/licence';
import type { ExportStop, TripExport } from '@/lib/export/types';
import { exportFileOf } from '@/lib/server/exports';
import { getPlace, getTrip } from '@/lib/public';
import { parseIcs } from './helpers';

// LT-M: the address of a stop's place in the CSV (column Address), the print and the dated copy's calendar (LOCATION, GEO). The fixtures are
// in memory: no record in data/ holds an address yet (LT-WHERE and LT-AP fill them).
const NOW = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));
const base = buildTripExport(getTrip('dolomites-2027')!);
const surveyed = (s: ExportStop): boolean => !!s.point && checkPoint(s.point).ok && !approxNote(s.point);
const timed = base.stops.filter((s) => s.time && surveyed(s));
const [a, b, c] = timed;
const ADDR = '224 Banff Avenue, Banff, T1L 1A3';
const NEAR = 'Near Icefields Parkway, Lake Louise';
const withAddr = (): TripExport => ({
  ...base,
  stops: base.stops.map((s) => (s.id === a!.id ? { ...s, address: ADDR } : s.id === b!.id ? { ...s, address: NEAR } : s.id === c!.id ? { ...s, address: 'Via Roma 1; piano 2, Bolzano' } : s)),
});
const model = withAddr();

describe('CSV Address column', () => {
  it('sits after Area, "Book ahead" stays last, and a stop with no address leaves it empty', () => {
    expect(TRIP_CSV_HEADER.indexOf('Address')).toBe(TRIP_CSV_HEADER.indexOf('Area') + 1);
    expect(TRIP_CSV_HEADER.at(-1)).toBe('Book ahead');
    const rows = tripCsv(model).replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(rows[0]).toBe(TRIP_CSV_HEADER.join(','));
    expect(rows.filter((r) => r.includes('"224 Banff Avenue, Banff, T1L 1A3"'))).toHaveLength(1);
    expect(rows.filter((r) => r.includes(NEAR))).toHaveLength(1);
    // no address anywhere: the column is empty on every row, and the file is the old one plus one empty cell per row
    const plain = tripCsv(base).replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(plain[0]).toBe(TRIP_CSV_HEADER.join(','));
    expect(plain.join('\n')).not.toMatch(/Banff Avenue/);
  });
});

describe('ICS LOCATION and GEO', () => {
  const ics = buildIcs(model, '2027-07-13', NOW);
  const { events } = parseIcs(ics);
  const ev = (stop: ExportStop) => events.find((e) => e.get('UID')?.includes(`-${stop.id}@`))!;

  it('writes the address as LOCATION (escaped per RFC 5545) and the point as GEO, a literal semicolon between two floats', () => {
    const e = ev(a!);
    expect(e.get('LOCATION')).toBe('224 Banff Avenue\\, Banff\\, T1L 1A3');
    const geo = e.get('GEO')!;
    expect(geo).toMatch(/^-?\d+(\.\d+)?;-?\d+(\.\d+)?$/);
    expect(Number(geo.split(';')[0])).toBeCloseTo(a!.point!.lat, 5);
    expect(Number(geo.split(';')[1])).toBeCloseTo(a!.point!.lon, 5);
    expect(ev(b!).get('LOCATION')).toBe('Near Icefields Parkway\\, Lake Louise');
    expect(ev(c!).get('LOCATION')).toBe('Via Roma 1\\; piano 2\\, Bolzano');
  });
  it('without an address the place name stands in, with GEO where the point may be exported; an approximate pin gets no GEO', () => {
    const other = base.stops.find((s) => s.time && surveyed(s) && ![a!.id, b!.id, c!.id].includes(s.id))!;
    const e = ev(other);
    expect(e.get('LOCATION')).toBe(other.name.replace(/([\;,])/g, '\\$1'));
    expect(e.get('GEO')).toBeTruthy();
    const approx = { ...model, stops: model.stops.map((s) => (s.id === a!.id ? { ...s, point: { ...s.point!, pointSource: 'prototype_approx' } } : s)) };
    const e2 = parseIcs(buildIcs(approx, '2027-07-13', NOW)).events.find((x) => x.get('UID')?.includes(`-${a!.id}@`))!;
    expect(e2.get('LOCATION')).toBe('224 Banff Avenue\\, Banff\\, T1L 1A3');
    expect(e2.get('GEO')).toBeUndefined();
  });
  it('a point that fails the licence guard gives no GEO; the all-day day event has neither property', () => {
    const hidden = { ...model, stops: model.stops.map((s) => (s.id === a!.id ? { ...s, point: { ...s.point!, pointSource: 'google_maps' } } : s)) };
    const e = parseIcs(buildIcs(hidden, '2027-07-13', NOW)).events.find((x) => x.get('UID')?.includes(`-${a!.id}@`))!;
    expect(e.get('GEO')).toBeUndefined();
    expect(e.get('LOCATION')).toBe('224 Banff Avenue\\, Banff\\, T1L 1A3');
    for (const day of events.filter((x) => x.param('DTSTART', 'VALUE') === 'DATE')) expect(day.get('LOCATION')).toBeUndefined();
  });
  it('a calendar of a trip with no address data keeps every address-free property', () => {
    const plain = parseIcs(buildIcs(base, '2027-07-13', NOW)).events;
    expect(plain.flatMap((e) => (e.get('LOCATION') ? [e.get('LOCATION')] : [])).every((l) => !/\d{2,5} [A-Z]/.test(l!))).toBe(true);
  });
  it('the timeline path carries LOCATION and GEO on the visit it belongs to', () => {
    const trip = getTrip('canadian-rockies-2029')!;
    const exp = buildTripExport(trip);
    const sunPoints = Object.fromEntries(trip.days.map((d) => [d.n, d.scheduleInput!.sunPoint]));
    const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), trip.schedule!.defaultProfile);
    const visit = timelines.flatMap((t) => t.entries).find((e) => (e.kind === 'visit' || e.kind === 'trail') && exp.stops.some((s) => s.day === e.day && !!s.placeSlug && s.placeSlug === e.at?.placeSlug && surveyed(s)))!;
    const stop = exp.stops.find((s) => s.day === visit.day && s.placeSlug === visit.at?.placeSlug)!;
    const m: TripExport = { ...exp, stops: exp.stops.map((s) => (s.id === stop.id ? { ...s, address: ADDR } : s)) };
    const out = parseIcs(buildIcs(m, '2029-09-08', NOW, { timelines, sunPoints, full: false })).events.filter((e) => e.get('UID')?.includes(`-${visit.id}@`));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.get('LOCATION')).toBe('224 Banff Avenue\\, Banff\\, T1L 1A3');
    expect(out[0]!.get('GEO')).toBeTruthy();
  });
  it('the privacy net reads the calendar as before: a LOCATION value starts after a colon, which the street rule leaves alone (ES-012)', () => {
    expect(privacyHits(ics)).toEqual([]);
    // the same words anywhere else in a body are still a street address
    expect(privacyHits(`Stay at ${ADDR}`).map((h) => h.why)).toEqual(['a household planning note']);
  });
});

describe('the API text files leave the address out; the json model carries it', () => {
  const slug = 'dolomites-2027';
  const lookup = { place: (s: string) => getPlace(s), trip: (s: string) => (s === slug ? getTrip(s) : null) };
  it('csv and print hold no stop address, json does not break the privacy net', () => {
    const csv = exportFileOf({ type: 'trip', slug, format: 'csv' } as never, lookup)!;
    expect(csv.body).not.toContain('Banff Avenue');
    const json = JSON.parse(exportFileOf({ type: 'trip', slug, format: 'json' } as never, lookup)!.body);
    expect(privacyHits({ ...json, stops: json.stops.map((s: ExportStop, i: number) => (i === 0 ? { ...s, address: ADDR } : s)) })).toEqual([]);
  });
});
