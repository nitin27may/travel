const fs = require('node:fs');
const { test, expect, open, trips } = require('./helpers.js');
const ICS = require('../../shared/ics.js');

test('Add to calendar downloads an .ics with timed stops and all-day book-by events, and it parses', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to calendar' }).first().click()]);
  expect(dl.suggestedFilename()).toBe('dolomites-10-days.ics');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  const t = (await trips(page)).find((x) => x.id === 't-dolomites');

  // structure an importing calendar checks
  expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(text.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  expect(text.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  expect((text.match(/BEGIN:VEVENT/g) || []).length).toBe((text.match(/END:VEVENT/g) || []).length);
  const uids = text.match(/^UID:.*$/gm);
  expect(new Set(uids).size).toBe(uids.length);

  const ev = ICS.parse(text);
  const timed = ev.filter((e) => /^\d{8}T\d{6}$/.test(e.props.DTSTART));
  const allDay = ev.filter((e) => e.params.DTSTART === 'VALUE=DATE');
  const stops = t.days.flatMap((d) => d.items).filter((i) => i.time);
  expect(timed.length).toBe(stops.length);
  expect(timed.length + allDay.length).toBe(ev.length);
  timed.forEach((e) => expect(e.props.DTEND > e.props.DTSTART).toBe(true));
  // day 1 starts on 13 July 2027 at the first item's time
  const first = t.days[0].items[0];
  expect(timed[0].props.DTSTART).toBe('20270713T' + first.time.replace(':', '') + '00');
  expect(timed[0].props.SUMMARY).toBe(first.name);
  // book-by days: one all-day event per booking that is not ticked off and has a date
  const open_ = t.bookings.filter((b) => !b.done);
  expect(allDay.length).toBe(open_.length);
  allDay.forEach((e) => { expect(e.props.SUMMARY).toMatch(/^Book by today: /); expect(e.props.DTEND > e.props.DTSTART).toBe(true); });
  const hire = allDay.find((e) => /Hire car/.test(e.props.SUMMARY));
  expect(hire.props.DTSTART).toBe('20270414'); // 90 days before 13 July 2027
});

test('shared/ics.js: escapes text, folds long lines, skips undated trips and relative book-by dates', () => {
  const trip = { id: 'x', title: 'A, B; C', dates: { from: '2027-01-01', to: '2027-01-02' }, days: [{ n: 1, base: 'Base', items: [{ id: 'a', name: 'Long ' + 'word '.repeat(30) + 'é', time: '09:00', durMin: 90, note: 'Line;one,two' }, { id: 'b', name: 'No time', time: '' }] }],
    bookings: [{ label: 'Rel', by: '14d' }, { label: 'Abs', by: '2026-12-01', link: 'https://example.org/' }] };
  const r = ICS.build(trip, { now: Date.UTC(2026, 0, 1) });
  expect(r.events).toBe(2);
  expect(r.skipped.length).toBe(2);
  const ev = ICS.parse(r.text);
  expect(ev[0].props.SUMMARY).toContain('é');
  expect(ev[0].props.DTEND).toBe('20270101T103000');
  expect(ev[0].props.DESCRIPTION).toContain('Line;one,two');
  expect(ICS.build({ id: 'y', title: 'n', dates: {}, days: trip.days, bookings: [] }).events).toBe(0);
});
