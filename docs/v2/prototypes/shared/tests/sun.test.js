/* sun.js against core/bin/sun.ts (the reference). Tolerance 1 minute; polar states must match exactly. */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const sun = require('../sun.js');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const CASES = [
  { name: 'Reykjavik (west longitude)', lat: 64.1466, lon: -21.9426, zone: 'Atlantic/Reykjavik', date: '2027-09-08' },
  { name: 'Banff (DST, west)', lat: 51.1784, lon: -115.5708, zone: 'America/Edmonton', date: '2029-09-08' },
  { name: 'Cortina d\'Ampezzo (east, DST)', lat: 46.5405, lon: 12.1357, zone: 'Europe/Rome', date: '2027-07-15' },
  { name: 'Toronto (DST change day)', lat: 43.6532, lon: -79.3832, zone: 'America/Toronto', date: '2027-03-14' },
  { name: 'Tromso, midnight sun', lat: 69.6492, lon: 18.9553, zone: 'Europe/Oslo', date: '2027-06-21' },
  { name: 'Tromso, polar-night edge', lat: 69.6492, lon: 18.9553, zone: 'Europe/Oslo', date: '2027-11-26' },
  { name: 'Longyearbyen, polar night', lat: 78.2232, lon: 15.6267, zone: 'Arctic/Longyearbyen', date: '2027-12-21' },
];
const toMin = (hhmm) => (hhmm ? +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5) : null);
const circDiff = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };

for (const c of CASES) {
  test(`sun: ${c.name} matches core/bin/sun.ts within 1 minute`, () => {
    const ref = JSON.parse(execFileSync('node', ['core/bin/sun.ts', '--lat', String(c.lat), '--lon', String(c.lon), '--zone', c.zone, '--date', c.date, '--json'], { cwd: REPO, encoding: 'utf8' }))[0];
    const mine = sun.report(c.lat, c.lon, c.zone, c.date);
    expect(mine.sunState).toBe(ref.sunState);
    for (const k of ['sunrise', 'sunset', 'civilDawn', 'civilDusk']) {
      if (ref[k] === null) expect(mine[k], k).toBeNull();
      else expect(circDiff(toMin(mine[k]), toMin(ref[k])), `${k}: ${mine[k]} vs ${ref[k]}`).toBeLessThanOrEqual(1);
    }
  });
}

test('sun: longitude is positive east (Reykjavik rises later than Greenwich-time naive value)', () => {
  const r = sun.sunFor(64.1466, -21.9426, '2027-09-08', 'Atlantic/Reykjavik');
  expect(r.sunrise).toBe('06:28');
  expect(sun.sunFor(78.2232, 15.6267, '2027-12-21', 'Arctic/Longyearbyen')).toBeNull();
});
test('sun: endsAfterSunset flags a hike ending within 30 minutes of sunset', () => {
  const s = sun.sunFor(51.1784, -115.5708, '2029-09-08', 'America/Edmonton');
  expect(sun.endsAfterSunset(51.1784, -115.5708, '2029-09-08', 'America/Edmonton', s.setMin - 31)).toBe(false);
  expect(sun.endsAfterSunset(51.1784, -115.5708, '2029-09-08', 'America/Edmonton', s.setMin - 29)).toBe(true);
  expect(sun.endsAfterSunset(78.2232, 15.6267, '2027-12-21', 'Arctic/Longyearbyen', 900)).toBe(false);
});
