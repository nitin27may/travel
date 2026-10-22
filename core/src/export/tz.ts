// Time zones for the calendar export: a VTIMEZONE for each zone the public trips use, and a coarse fallback from a
// trip's first point for trips whose booking rules name no zone. A zone not in the table is written as floating local time.

interface Zone {
  std: number; // minutes east of UTC
  rule: 'eu' | 'us' | null;
  names: [string, string];
}
const ZONES: Record<string, Zone> = {
  'Europe/Rome': { std: 60, rule: 'eu', names: ['CET', 'CEST'] },
  'Europe/Zurich': { std: 60, rule: 'eu', names: ['CET', 'CEST'] },
  'Europe/Paris': { std: 60, rule: 'eu', names: ['CET', 'CEST'] },
  'Europe/Oslo': { std: 60, rule: 'eu', names: ['CET', 'CEST'] },
  'Atlantic/Reykjavik': { std: 0, rule: null, names: ['GMT', 'GMT'] },
  'America/Toronto': { std: -300, rule: 'us', names: ['EST', 'EDT'] },
  'America/Edmonton': { std: -420, rule: 'us', names: ['MST', 'MDT'] },
  'America/Vancouver': { std: -480, rule: 'us', names: ['PST', 'PDT'] },
  'America/Denver': { std: -420, rule: 'us', names: ['MST', 'MDT'] },
  'America/Argentina/Ushuaia': { std: -180, rule: null, names: ['-03', '-03'] },
  'America/Costa_Rica': { std: -360, rule: null, names: ['CST', 'CST'] },
};

export const knownZone = (tz: string | null | undefined): tz is string => !!tz && tz in ZONES;

const off = (m: number) => `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}${String(Math.abs(m) % 60).padStart(2, '0')}`;

/** Lines of a VTIMEZONE (RFC 5545 3.6.5) with yearly rules; fold and join them like any other content lines. */
export function vtimezone(tz: string): string[] {
  const z = ZONES[tz];
  const L = ['BEGIN:VTIMEZONE', `TZID:${tz}`];
  const part = (kind: 'STANDARD' | 'DAYLIGHT', from: number, to: number, name: string, start: string, rrule: string) =>
    L.push(`BEGIN:${kind}`, `TZOFFSETFROM:${off(from)}`, `TZOFFSETTO:${off(to)}`, `TZNAME:${name}`, `DTSTART:${start}`, `RRULE:${rrule}`, `END:${kind}`);
  const dst = z.std + 60;
  if (z.rule === 'eu') {
    part('DAYLIGHT', z.std, dst, z.names[1], '19700329T020000', 'FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    part('STANDARD', dst, z.std, z.names[0], '19701025T030000', 'FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  } else if (z.rule === 'us') {
    part('DAYLIGHT', z.std, dst, z.names[1], '19700308T020000', 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    part('STANDARD', dst, z.std, z.names[0], '19701101T020000', 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
  } else {
    L.push('BEGIN:STANDARD', `TZOFFSETFROM:${off(z.std)}`, `TZOFFSETTO:${off(z.std)}`, `TZNAME:${z.names[0]}`, 'DTSTART:19700101T000000', 'END:STANDARD');
  }
  L.push('END:VTIMEZONE');
  return L;
}

/** Coarse region to zone, for trips that carry no booking rule with a zone. Boxes: [south, north, west, east]. */
const BOXES: [string, [number, number, number, number]][] = [
  ['America/Edmonton', [49, 60, -120.1, -110]], // Alberta and the Rockies
  ['America/Vancouver', [48, 55, -130, -120.1]],
  ['America/Toronto', [41.5, 52, -83, -64]], // Ontario, Quebec, New England
  ['America/Denver', [31, 42, -114, -102]], // Utah
  ['America/Argentina/Ushuaia', [-56, -40, -75, -63]],
  ['America/Costa_Rica', [8, 11.5, -86, -82]],
  ['Atlantic/Reykjavik', [63, 67, -25, -13]],
  ['Europe/Oslo', [57, 72, 4, 32]],
  ['Europe/Zurich', [45.8, 47.9, 5.9, 10.6]],
  ['Europe/Paris', [43, 51, -5, 7.5]],
  ['Europe/Rome', [36, 47.2, 6, 19]],
];
export function zoneNear(lat: number, lon: number): string | null {
  return BOXES.find(([, [s, n, w, e]]) => lat >= s && lat <= n && lon >= w && lon <= e)?.[0] ?? null;
}

/** Last resort for trips with no pins at all (the Rockies today): the region and base names. */
export function zoneByName(text: string): string | null {
  if (/banff|jasper|lake louise|kananaskis|canadian rockies|calgary|waterton/i.test(text)) return 'America/Edmonton';
  return null;
}
