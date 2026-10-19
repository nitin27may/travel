import { addDays, compact, pad, parseIso } from './dates';
import { sourceLine } from './licence';
import { knownZone, vtimezone } from './tz';
import { sunFor } from '@travel/core/sun/index.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
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

export function icsEventCount(trip: TripExport, timeline?: IcsTimeline): { allDay: number; timed: number } {
  if (timeline) return { allDay: trip.days.length, timed: timeline.timelines.reduce((n, t) => n + t.entries.filter((e) => (e.lane === 'all' || e.lane === (t.lanes[0] ?? 'all')) && wanted(e, timeline.full)).length, 0) };
  return { allDay: trip.days.length, timed: trip.stops.filter((s) => s.time).length };
}

export class NoCalendarError extends Error {}

/** The timeline a dated copy carries: the chosen profile's days, with where each day's sun is computed (spec 3.9). */
export interface IcsTimeline {
  timelines: DayTimeline[];
  sunPoints: Record<number, { lat: number; lon: number } | null>;
  /** Adds breaks, rest and sun markers to the timed events. */
  full: boolean;
}

const LABEL = { fixed: 'Fixed slot', anchored: 'Sun-timed', suggested: 'Suggested time' } as const;
const SOURCE = { operator: 'operator timetable', plan: 'from the plan', sun: 'sun, computed for the real date', data: 'our place data', rule: 'our rule', visitor: 'added by you' } as const;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const clock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Start of an entry on the real date: a sun-tied entry is recomputed with core/src/sun, anything else keeps its time. */
function realStart(e: TimelineEntry, date: string, point: { lat: number; lon: number } | null): string {
  const a = e.time.anchor;
  if (!a || !point || e.kind === 'sun') return e.start;
  const sun = sunFor(point.lat, point.lon, date, e.tz);
  if (!sun) return e.start;
  const base = a.to === 'sunrise' ? toMin(sun.sunrise) : toMin(sun.sunset) + (a.to === 'golden-pm' ? -60 : 0);
  const m = base + a.offsetMin;
  return m >= 0 && m < 1440 ? clock(m) : e.start;
}

/** Which entries become timed calendar events: places and bookings, sit-down meals and legs of 45 min or more; "Full detail" adds the rest. */
function wanted(e: TimelineEntry, full: boolean): boolean {
  if (e.kind === 'visit' || e.kind === 'trail' || e.kind === 'booking' || e.kind === 'checkin') return true;
  if (e.kind === 'meal') return e.style === 'sit-down' || (full && e.style !== 'on-trail');
  if (e.kind === 'leg') return e.durationMin >= 45;
  if (e.kind === 'break' || e.kind === 'rest' || e.kind === 'sun') return full && (e.kind === 'sun' || e.durationMin > 0);
  return false;
}

export function buildIcs(trip: TripExport, startDate: string, now: Date = new Date(), timeline?: IcsTimeline): string {
  if (trip.depth === 'overview' || trip.days.length === 0) throw new NoCalendarError(`${trip.slug} is an overview and has no days to put on a calendar`);
  parseIso(startDate);
  const host = new URL(trip.url).host;
  const L: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trip Plans//Copy to my trips//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsText(trip.title)}`,
    `X-WR-CALDESC:${icsText(sourceLine(trip.url))}`,
  ];
  const zone = knownZone(trip.tz) ? trip.tz : null; // an unknown zone is written as floating local time, never as a dangling TZID
  if (zone && (timeline ? timeline.timelines.length > 0 : trip.stops.some((s) => s.time))) L.push(...vtimezone(zone));
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
    const tl = timeline?.timelines.find((t) => t.day === day.n);
    if (tl) {
      const lane = tl.lanes[0] ?? 'all';
      for (const e of tl.entries.filter((x) => (x.lane === 'all' || x.lane === lane) && wanted(x, timeline!.full))) {
        const start = realStart(e, date, timeline!.sunPoints[day.n] ?? null);
        const label = `${LABEL[e.time.confidence]}, ${SOURCE[e.time.source]}`;
        L.push(
          'BEGIN:VEVENT',
          `UID:${trip.slug}-day-${day.n}-${e.id}@${host}`,
          dtstamp,
          `DTSTART${tzid}:${localDateTime(date, start)}`,
          `DTEND${tzid}:${localDateTime(date, start, e.durationMin)}`,
          `SUMMARY:${icsText(e.title)}`,
          `DESCRIPTION:${icsText([label, e.time.note].filter(Boolean).join('. '))}`,
          `URL:${trip.url}#day-${day.n}`,
          'END:VEVENT',
        );
      }
      continue;
    }
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
