const { test, expect } = require('@playwright/test');
const ICS = require('../ics.js');
const C = require('../contract.js');

const trip = (over) => C.normalise({
  id: 'dolo', title: 'Dolomites, "July"; trip', kind: 'weekair', mode: 'trip', start: { city: 'Toronto' }, party: [{ type: 'adult' }],
  dates: { from: '2027-07-10', to: '2027-07-12' }, nights: 2, days: [
    { n: 1, label: 'Day 1', base: 'Ortisei', items: [{ id: 'sec', name: 'Seceda, ridge; lift', slug: 'seceda', time: '09:30', durMin: 180, note: 'Line one\nLine two' }, { id: 'nt', name: 'No time', slug: 'nt' }] },
    { n: 3, label: 'Day 3', base: 'Ortisei', items: [{ id: 'late', name: 'Late dinner', slug: 'ld', time: '23:30', durMin: 90 }] }],
  bookings: [{ label: 'Lift tickets', by: '2027-06-20', link: 'https://example.org/a,b', done: false }, { label: 'Relative', by: '14d', link: '#', done: false }], ...over,
});
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);

test('ics: timed events are floating local times with the item duration', () => {
  const r = ICS.build(trip(), { now: NOW });
  const ev = ICS.parse(r.text);
  const sec = ev.find((e) => e.props.UID === 'dolo-d1-sec@proto');
  expect(sec.props.DTSTART).toBe('20270710T093000');
  expect(sec.props.DTEND).toBe('20270710T123000');
  expect(sec.props.SUMMARY).toBe('Seceda, ridge; lift');
  expect(sec.props.DESCRIPTION).toContain('Line one\nLine two');
  expect(sec.props.DTSTAMP).toBe('20261027T120000Z');
  const late = ev.find((e) => e.props.UID === 'dolo-d3-late@proto');
  expect(late.props.DTSTART).toBe('20270712T233000');
  expect(late.props.DTEND).toBe('20270713T010000'); // runs past midnight into the next date
});
test('ics: book-by items are all-day events with an exclusive end date; relative ones are skipped and listed', () => {
  const r = ICS.build(trip(), { now: NOW });
  const b = ICS.parse(r.text).find((e) => e.props.UID === 'dolo-b0@proto');
  expect(b.props.DTSTART).toBe('20270620');
  expect(b.params.DTSTART).toBe('VALUE=DATE');
  expect(b.props.DTEND).toBe('20270621');
  expect(b.props.SUMMARY).toBe('Book by today: Lift tickets');
  expect(b.props.DESCRIPTION).toBe('https://example.org/a,b');
  expect(r.skipped.join('|')).toMatch(/Relative/);
  expect(r.skipped.join('|')).toMatch(/No time/);
  expect(r.events).toBe(3);
});
test('ics: UTC mode applies a fixed offset', () => {
  const r = ICS.build(trip(), { now: NOW, utcOffsetMin: 120 });
  const sec = ICS.parse(r.text).find((e) => e.props.UID === 'dolo-d1-sec@proto');
  expect(sec.props.DTSTART).toBe('20270710T073000Z');
});
test('ics: RFC 5545 text rules (escaping, CRLF, folding at 75 octets, header and footer)', () => {
  expect(ICS.escapeText('a;b,c\\d\ne')).toBe('a\;b\\,c\\\\d\\ne');
  const r = ICS.build(trip({ title: 'Dolomites, "July"; trip' }), { now: NOW });
  expect(r.text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(r.text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  expect(r.text).toContain('X-WR-CALNAME:Dolomites\\, "July"\; trip');
  for (const line of r.text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(r.text).not.toMatch(/[^\r]\n/);
  const long = ICS.fold('SUMMARY:' + 'é'.repeat(80));
  long.split('\r\n').forEach((l) => expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75));
  expect(long.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'é'.repeat(80));
});
test('ics: a trip without dates yields no timed events and says why', () => {
  const r = ICS.build(trip({ dates: { month: 9 } }), { now: NOW });
  expect(r.events).toBe(1); // only the dated book-by
  expect(r.skipped.join('|')).toMatch(/no dates/);
});
