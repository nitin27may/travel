import { addDays, compact, pad, parseIso } from './dates';
import { knownZone, vtimezone } from './tz';
import type { TripExport } from './types';

// RFC 5545. Only a dated copy has an ICS: the public trip is dateless, so `buildIcs` needs the copy's start date and
// refuses an overview trip (no days to put on a calendar).

const CRLF = '\r\n';

export const icsText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line at 75 octets, continuing with a single space (RFC 5545 3.1). Never splits a UTF-8 character. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

function localDateTime(date: string, hhmm: string, plusMin = 0): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + plusMin;
  const dayShift = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return `${compact(addDays(date, dayShift))}T${pad(Math.floor(t / 60))}${pad(t % 60)}00`;
}

export function icsEventCount(trip: TripExport): { allDay: number; timed: number } {
  return { allDay: trip.days.length, timed: trip.stops.filter((s) => s.time).length };
}

export class NoCalendarError extends Error {}

export function buildIcs(trip: TripExport, startDate: string, now: Date = new Date()): string {
  if (trip.depth === 'overview' || trip.days.length === 0) throw new NoCalendarError(`${trip.slug} is an overview and has no days to put on a calendar`);
  parseIso(startDate);
  const host = new URL(trip.url).host;
  const L: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trip Plans//Copy to my trips//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsText(trip.title)}`,
  ];
  const zone = knownZone(trip.tz) ? trip.tz : null; // an unknown zone is written as floating local time, never as a dangling TZID
  if (zone && trip.stops.some((s) => s.time)) L.push(...vtimezone(zone));
  const dtstamp = `DTSTAMP:${stamp(now)}`;
  for (const day of trip.days) {
    const date = addDays(startDate, day.n - 1);
    const stops = trip.stops.filter((s) => s.day === day.n);
    const summary = ['Day ' + day.n, day.title, day.base ? `base ${day.base}` : null].filter(Boolean).join(' · ');
    const description = [
      ...stops.map((s) => `${s.time ? s.time + ' ' : ''}${s.name}${s.lane ? ` (${s.lane})` : ''}`),
      `${trip.url}#day-${day.n}`,
    ].join('\n');
    L.push(
      'BEGIN:VEVENT',
      `UID:${trip.slug}-day-${day.n}@${host}`,
      dtstamp,
      `DTSTART;VALUE=DATE:${compact(date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
      `SUMMARY:${icsText(summary)}`,
      `DESCRIPTION:${icsText(description)}`,
      `URL:${trip.url}#day-${day.n}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
    const tzid = zone ? `;TZID=${zone}` : '';
    for (const s of stops.filter((x) => x.time)) {
      L.push(
        'BEGIN:VEVENT',
        `UID:${trip.slug}-day-${day.n}-${s.id}@${host}`,
        dtstamp,
        `DTSTART${tzid}:${localDateTime(date, s.time!)}`,
        `DTEND${tzid}:${localDateTime(date, s.time!, s.durationMin ?? 60)}`,
        `SUMMARY:${icsText(s.name)}`,
        ...(s.note ? [`DESCRIPTION:${icsText(s.note)}`] : []),
        `URL:${trip.url}#day-${day.n}`,
        'END:VEVENT',
      );
    }
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join(CRLF) + CRLF;
}
