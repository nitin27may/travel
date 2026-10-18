import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/entities/csv';
import { buildPlaceExport, buildTripExport } from '@/lib/export/build.server';
import { listCsv, TRIP_CSV_HEADER, tripCsv } from '@/lib/export/csv';
import { addDays, checkWindow, holidays, inWindow, shadeOf } from '@/lib/export/dates';
import { buildGpx } from '@/lib/export/gpx';
import { buildIcs, icsText, NoCalendarError } from '@/lib/export/ics';
import { buildKml } from '@/lib/export/kml';
import { OSM_ATTRIBUTION } from '@/lib/export/licence';
import { listShareUrl, shareUrl } from '@/lib/export/share';
import type { ExportWaypoint, TripExport } from '@/lib/export/types';
import { getPlace, getTrip, listTrips, placeSlugs } from '@/lib/public';
import { kids, parseIcs, parseXml } from './helpers';

const trip = (slug: string): TripExport => buildTripExport(getTrip(slug)!);
const dolomites = trip('dolomites-2027');
const DATE = /\b(19|20)\d{2}-\d{2}-\d{2}\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;
const NOW = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));

describe('ICS', () => {
  const ics = buildIcs(dolomites, '2027-07-13', NOW);
  const { events, calendar } = parseIcs(ics);

  it('is a valid RFC 5545 calendar: CRLF, folded lines, nested components, required properties', () => {
    expect(calendar.get('VERSION')).toBe('2.0');
    expect(calendar.get('PRODID')).toBeTruthy();
    for (const e of events) for (const r of ['UID', 'DTSTAMP', 'DTSTART', 'SUMMARY']) expect(e.get(r), r).toBeTruthy();
  });
  it('has one all-day event per day with the right local dates', () => {
    const allDay = events.filter((e) => e.param('DTSTART', 'VALUE') === 'DATE');
    expect(allDay).toHaveLength(dolomites.days.length);
    expect(allDay.map((e) => e.get('DTSTART'))).toEqual(dolomites.days.map((d) => addDays('2027-07-13', d.n - 1).replace(/-/g, '')));
    for (const e of allDay) expect(e.get('DTEND')).toBe(addDays(e.get('DTSTART')!.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), 1).replace(/-/g, ''));
    expect(allDay[2].get('SUMMARY')).toMatch(/^Day 3 · Tre Cime di Lavaredo · base San Candido$/);
  });
  it('adds timed events with the trip zone for items that have a time', () => {
    const timed = events.filter((e) => e.param('DTSTART', 'VALUE') !== 'DATE');
    expect(timed.length).toBe(dolomites.stops.filter((s) => s.time).length);
    expect(timed.length).toBeGreaterThan(0);
    const tre = timed.find((e) => e.get('SUMMARY') === 'Tre Cime di Lavaredo loop')!;
    expect(tre.get('DTSTART')).toBe('20270715T113000');
    expect(tre.param('DTSTART', 'TZID')).toBe(dolomites.tz);
    expect(dolomites.tz).toBe('Europe/Rome');
    expect(tre.get('DTEND')).toBe('20270715T160000');
  });
  it('keeps UIDs unique and stable between runs, and moves with the start date only', () => {
    const uids = events.map((e) => e.get('UID'));
    expect(new Set(uids).size).toBe(uids.length);
    const again = parseIcs(buildIcs(dolomites, '2027-08-02', NOW)).events.map((e) => e.get('UID'));
    expect(again).toEqual(uids);
  });
  it('refuses an overview trip: there is nothing to put on a calendar', () => {
    expect(() => buildIcs(trip('costa-rica-2027'), '2027-03-01')).toThrow(NoCalendarError);
  });
  it('writes a VTIMEZONE for the TZID with yearly rules, before the first event', () => {
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Rome');
    expect(ics).toMatch(/BEGIN:DAYLIGHT\r\nTZOFFSETFROM:\+0100\r\nTZOFFSETTO:\+0200[\s\S]*RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU/);
    expect(ics.indexOf('BEGIN:VTIMEZONE')).toBeLessThan(ics.indexOf('BEGIN:VEVENT'));
    const used = new Set([...ics.matchAll(/TZID=([^:;]+)/g)].map((m) => m[1]));
    for (const z of used) expect(ics).toContain(`TZID:${z}\r\n`);
  });
  it('gives the Rockies America/Edmonton from their base point, and writes unknown zones as floating time', () => {
    expect(trip('canadian-rockies-2029').tz).toBe('America/Edmonton');
    const r0 = trip('canadian-rockies-2029');
    const rock = buildIcs({ ...r0, stops: r0.stops.map((x, i) => (i === 0 ? { ...x, time: '09:00' } : x)) }, '2029-09-08', NOW);
    expect(rock).toContain('TZID:America/Edmonton');
    expect(rock).toContain('TZOFFSETTO:-0600');
    const odd = buildIcs({ ...dolomites, tz: 'Mars/Olympus' }, '2027-07-13', NOW);
    expect(odd).not.toContain('TZID');
    expect(odd).toMatch(/DTSTART:\d{8}T\d{6}\r\n/);
  });
  it('escapes text and folds long lines', () => {
    expect(icsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const long = { ...dolomites, title: 'Ü'.repeat(80), days: [{ n: 1, title: 'é'.repeat(90), base: null }], stops: [] };
    const out = buildIcs(long, '2027-07-13', NOW);
    expect(() => parseIcs(out)).not.toThrow();
    expect(parseIcs(out).events[0].get('SUMMARY')).toContain('é'.repeat(90));
  });
});

describe('GPX', () => {
  const r = buildGpx(dolomites);
  const gpx = parseXml(r.xml);
  it('is well-formed GPX 1.1 with metadata, a page link and the OSM attribution', () => {
    expect(gpx.name).toBe('gpx');
    expect(gpx.attrs.version).toBe('1.1');
    expect(gpx.attrs.xmlns).toBe('http://www.topografix.com/GPX/1/1');
    const meta = kids(gpx, 'metadata')[0];
    expect(kids(meta, 'link')[0].attrs.href).toBe(dolomites.url);
    expect(kids(meta, 'desc')[0].text).toContain(OSM_ATTRIBUTION);
    expect(kids(meta, 'copyright')[0].attrs.author).toBe('OpenStreetMap contributors');
  });
  it('writes waypoints in schema order with a type that names the day', () => {
    const wpts = kids(gpx, 'wpt');
    expect(wpts).toHaveLength(r.points);
    expect(r.points).toBeGreaterThan(10);
    const order = ['ele', 'time', 'name', 'cmt', 'desc', 'src', 'link', 'sym', 'type'];
    for (const w of wpts) {
      expect(Number.isFinite(+w.attrs.lat) && Math.abs(+w.attrs.lat) <= 90).toBe(true);
      expect(Number.isFinite(+w.attrs.lon) && Math.abs(+w.attrs.lon) <= 180).toBe(true);
      const idx = w.children.map((c) => order.indexOf(c.name));
      expect(idx.every((i) => i >= 0)).toBe(true);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
    expect(wpts.some((w) => kids(w, 'type')[0].text.startsWith('Day 3 · '))).toBe(true);
  });
  it('contains no Google-sourced point: skipped, counted in a comment', () => {
    const bad: ExportWaypoint = { id: 'g', name: 'Pin from Google', kind: 'sight', role: 'stop', day: 1, note: null, url: null, point: { lat: 46.5, lon: 11.9, pointSource: 'google_maps', pointChecked: null, sourceLicence: 'Google' } };
    const out = buildGpx({ ...dolomites, waypoints: [...dolomites.waypoints, bad], skipped: 2 });
    expect(out.xml).not.toContain('Pin from Google');
    expect(out.skipped).toBe(3);
    expect(out.xml).toContain('<!-- 3 points left out: source not ours to give -->');
    expect(() => parseXml(out.xml)).not.toThrow();
  });
  it('writes a track only for an exportable line with geometry', () => {
    const geometry: [number, number][] = [[11.7, 46.6], [11.71, 46.61]];
    const lines = [
      { ref: 'osm_relation:1', label: 'Open route', exportable: true, licence: 'ODbL', geometry },
      { ref: 'osm_relation:2', label: 'Held back', exportable: false, licence: 'ODbL', geometry },
      { ref: 'google_directions:3', label: 'Google route', exportable: true, licence: 'unknown', geometry },
    ];
    const out = buildGpx({ ...dolomites, lines });
    expect(out.tracks).toBe(1);
    expect(out.xml).toContain('Open route');
    expect(out.xml).not.toContain('Held back');
    expect(out.xml).not.toContain('Google route');
  });
  it('escapes names', () => {
    const w = { ...dolomites.waypoints[0], name: 'Rifugio "Auronzo" <hut> & café' };
    const out = buildGpx({ ...dolomites, waypoints: [w] });
    expect(() => parseXml(out.xml)).not.toThrow();
    expect(out.xml).toContain('&lt;hut&gt; &amp; café');
  });
});

describe('KML', () => {
  const r = buildKml(dolomites);
  const kml = parseXml(r.xml);
  it('is well-formed KML 2.2 with a folder per day', () => {
    expect(kml.attrs.xmlns).toBe('http://www.opengis.net/kml/2.2');
    const doc = kids(kml, 'Document')[0];
    const folders = kids(doc, 'Folder');
    expect(folders.length).toBeGreaterThan(5);
    expect(kids(folders[0], 'name')[0].text).toMatch(/^Day \d+$/);
    const placemarks = folders.flatMap((f) => kids(f, 'Placemark'));
    expect(placemarks).toHaveLength(r.points);
    expect(kids(doc, 'description')[0].text).toContain(OSM_ATTRIBUTION);
    const [lon, lat] = kids(kids(placemarks[0], 'Point')[0], 'coordinates')[0].text.split(',').map(Number);
    expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
  });
  it('marks approximate points in the description, as GPX does', () => {
    expect(r.xml).toContain('Approximate position, not surveyed');
    const surveyed = buildKml({ ...dolomites, waypoints: dolomites.waypoints.filter((w) => w.point.pointSource.startsWith('osm_')) });
    expect(surveyed.xml).not.toContain('Approximate position');
  });
  it('leaves out the same points GPX leaves out', () => {
    expect(r.points).toBe(buildGpx(dolomites).points);
    expect(r.skipped).toBe(buildGpx(dolomites).skipped);
  });
});

describe('CSV', () => {
  const csv = tripCsv(dolomites);
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
  it('has one row per stop, in day then time order, with the documented header', () => {
    expect(lines[0]).toBe(TRIP_CSV_HEADER.join(','));
    expect(lines).toHaveLength(dolomites.stops.length + 1);
    const keys = lines.slice(1).map((l) => l.split(',').slice(0, 2)).map(([d, t]) => `${d.padStart(2, '0')} ${t || '99:99'}`);
    expect(keys).toEqual([...keys].sort());
  });
  it('flags approximate points in an Approximate column', () => {
    const col = TRIP_CSV_HEADER.indexOf('Approximate');
    expect(col).toBe(8);
    const approx = dolomites.stops.filter((s) => s.point?.pointSource === 'prototype_approx').length;
    expect(approx).toBeGreaterThan(0);
    expect(csv.match(/,yes,/g)).toHaveLength(approx);
  });
  it('writes coordinates only where the point may be exported', () => {
    const hidden = { ...dolomites, stops: dolomites.stops.map((s) => ({ ...s, point: s.point ? { ...s.point, pointSource: 'google_maps' } : null })) };
    const rows = tripCsv(hidden).trimEnd().split('\r\n').slice(1);
    expect(rows.every((r) => /,,,[^,]*$/.test(r) || r.includes(',,'))).toBe(true);
    expect(tripCsv(hidden)).not.toMatch(/46\.\d{3,}/);
    expect(csv).toMatch(/46\.\d{3,}/);
  });
  it('list CSV is the same code path as the table export (toCsv)', () => {
    expect(listCsv([{ a: 1, b: 'x,y' }, { a: 2, b: null }])).toBe(toCsv(['a', 'b'], [[1, 'x,y'], [2, null]]));
    expect(listCsv([['A', 'B'], [1, 2]])).toBe(toCsv(['A', 'B'], [[1, 2]]));
  });
});

describe('public trips stay dateless', () => {
  it('no export of any public trip or place carries a calendar date', () => {
    for (const card of listTrips()) {
      const t = trip(card.slug);
      const files = [buildGpx(t).xml, buildKml(t).xml, tripCsv(t), JSON.stringify(t)];
      for (const f of files) expect(f.match(DATE), `${card.slug}: ${f.match(DATE)?.[0]}`).toBeNull();
    }
    for (const slug of placeSlugs()) {
      const p = buildPlaceExport(getPlace(slug)!);
      expect(buildGpx(p).xml.match(DATE), slug).toBeNull();
    }
  });
  it('the calendar is the only dated output, and only when given a start date', () => {
    expect(buildIcs(dolomites, '2027-07-13', NOW)).toContain('20270713');
  });
});

describe('privacy', () => {
  it('exports hold no household fields, only what the public adapter returns', () => {
    const PRIVATE = /height_cm|weight_kg|age_years|citizenship|confirmation|contact|price_paid|insurer|passport|household/i;
    for (const card of listTrips()) expect(JSON.stringify(trip(card.slug)), card.slug).not.toMatch(PRIVATE);
    for (const slug of placeSlugs().slice(0, 200)) expect(JSON.stringify(buildPlaceExport(getPlace(slug)!)), slug).not.toMatch(PRIVATE);
  });
  it('every exported point passes the licence guard source rules', () => {
    for (const card of listTrips()) for (const w of trip(card.slug).waypoints) expect(w.point.pointSource).not.toMatch(/google|gmaps|apple|bing/i);
  });
  it('a trip the adapter did not build cannot be exported: there is no way in but getTrip()', () => {
    expect(getTrip('no-such-trip')).toBeNull();
  });
});

describe('share URLs', () => {
  it('keeps the day anchor and builds list state in the table order, with c= only on a map view', () => {
    expect(shareUrl({ slug: 'dolomites-2027' }, 3)).toMatch(/\/trips\/dolomites-2027\/#day-3$/);
    expect(shareUrl({ slug: 'dolomites-2027' })).toMatch(/\/trips\/dolomites-2027\/$/);
    expect(listShareUrl('/places', { view: 'map', kind: 'trail', q: 'lake', c: '11.9,46.6,9' })).toMatch(/\/places\/\?q=lake&kind=trail&view=map&c=11\.9%2C46\.6%2C9$/);
    expect(listShareUrl('/places', { view: 'table', kind: 'trail', c: '1,2,3' })).toMatch(/\?kind=trail&view=table$/);
  });
});

describe('dates', () => {
  it('knows Thanksgiving 2026 (Mon 12 Oct) and Family Day 2027 (Mon 15 Feb)', () => {
    expect(holidays(2026).find((h) => h.name === 'Thanksgiving')?.date).toBe('2026-10-12');
    expect(holidays(2027).find((h) => h.name === 'Family Day')?.date).toBe('2027-02-15');
    expect(shadeOf('2026-10-10').longWeekend).toBe('Thanksgiving');
    expect(shadeOf('2026-10-13').longWeekend).toBeNull();
    expect(shadeOf('2026-10-31').longWeekend).toBeNull();
  });
  it('shades weekends and school breaks', () => {
    expect(shadeOf('2027-07-17')).toMatchObject({ weekend: true, schoolBreak: 'Summer break' });
    expect(shadeOf('2027-03-16').schoolBreak).toBe('March break');
  });
  it('checks a start against the season window, including windows that wrap the new year', () => {
    const w = { from: '07-15', to: '08-31' };
    expect(inWindow(w, '2027-07-20')).toBe(true);
    expect(inWindow(w, '2027-09-02')).toBe(false);
    expect(checkWindow(w, '2027-08-25', 14)).toMatchObject({ startOutside: false, endOutside: true });
    expect(inWindow({ from: '2026-11-01', to: '2027-02-28' }, '2027-01-05')).toBe(true);
    expect(inWindow(undefined, '2027-01-05')).toBe(true);
  });
});
