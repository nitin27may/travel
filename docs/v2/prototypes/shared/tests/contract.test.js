const { test, expect } = require('@playwright/test');
const C = require('../contract.js');

const store = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const good = () => C.normalise({
  id: 't1', title: 'Dolomites', kind: 'weekair', mode: 'trip', start: { city: 'Toronto', airport: 'YYZ' }, party: [{ type: 'adult' }, { type: 'child', age: 7 }],
  dates: { from: '2027-07-10', to: '2027-07-12' }, nights: 2, identity: 'a', inMine: true, updated: '2026-10-27T10:00:00Z',
  days: [{ n: 1, label: 'Day 1', base: 'Ortisei', notes: '', items: [{ id: 'x', name: 'Seceda', slug: 'seceda', time: '09:30', durMin: 180, driveMin: 20 }] }, { n: 2, label: 'Day 2', base: 'Ortisei', items: [] }, { n: 3, label: 'Day 3', base: 'Ortisei', items: [] }],
  gettingThere: { from: 'YYZ', mode: 'fly' }, bookings: [{ label: 'Lift', by: '2027-06-20', link: '#', done: false }], checklist: [{ label: 'Passports', done: true }], costs: [{ label: 'Seceda', amount: 40 }],
});

test('contract: a complete trip validates and normalise is idempotent', () => {
  const t = good();
  expect(C.validate(t)).toEqual([]);
  expect(C.normalise(t)).toEqual(t);
});
test('contract: normalise fills a bare object and never throws', () => {
  for (const bad of [undefined, null, {}, { days: [null, {}] }, { party: 'x', dates: 5 }]) {
    const t = C.normalise(bad);
    expect(t.days.every((d, i) => d.n === i + 1 && Array.isArray(d.items))).toBe(true);
    expect(t.mode).toBe('near');
    expect(Array.isArray(t.bookings) && Array.isArray(t.checklist) && Array.isArray(t.costs)).toBe(true);
  }
});
test('contract: month accepts a number, a numeric string and YYYY-MM; B3 round trip', () => {
  expect(C.monthNumber(7)).toBe(7);
  expect(C.monthNumber('7')).toBe(7);
  expect(C.monthNumber('2027-09')).toBe(9);
  expect(C.monthNumber(13)).toBeNull();
  expect(C.monthNumber('2027-13')).toBeNull();
  expect(C.monthNumber(null)).toBeNull();
  const a = C.normalise({ dates: { month: '2027-09' } }), b = C.normalise({ dates: { month: 9 } });
  expect(C.monthOf(a)).toBe(9);
  expect(C.monthOf(b)).toBe(9);
  expect(C.monthOf(C.normalise({ dates: { from: '2027-03-02', month: 9 } }))).toBe(3);
  expect(C.normalise({ dates: { month: 99 } }).dates.month).toBeUndefined();
});
test('contract: validate reports the field', () => {
  const t = good(); t.dates.to = '2027-07-01'; t.days[0].items[0].time = '25:00'; t.party = []; t.nights = -1;
  const paths = C.validate(t).map((p) => p.path);
  expect(paths).toEqual(expect.arrayContaining(['dates.to', 'days.0.items.0.time', 'party', 'nights']));
});
test('contract: store round trip through readTrips and writeTrips; bad data refused; bad JSON gives []', () => {
  const s = store();
  expect(C.readTrips(s)).toEqual([]);
  expect(C.writeTrips(s, [good()]).ok).toBe(true);
  expect(C.readTrips(s)).toEqual([good()]);
  const refused = C.writeTrips(s, [{ ...good(), id: '' }]);
  expect(refused.ok).toBe(false);
  expect(refused.problems[0].path).toBe('id');
  expect(C.readTrips(s)).toEqual([good()]); // untouched
  s.setItem('proto.trips', '{nope');
  expect(C.readTrips(s)).toEqual([]);
  s.setItem('proto.trips', JSON.stringify([{ id: 'old', dates: { month: '2027-09' }, days: [{ items: [{ id: 'q', name: 'Q' }] }] }]));
  const t = C.readTrips(s)[0];
  expect(t.days[0].n).toBe(1);
  expect(C.monthOf(t)).toBe(9);
});
test('contract: requests default, validate, add and persist', () => {
  const s = store();
  const r = C.addRequest(s, { kind: 'region', name: ' Puglia ', note: 'trulli' }, 1790000000000);
  expect(r.ok).toBe(true);
  expect(r.request).toMatchObject({ kind: 'region', name: 'Puglia', status: 'Requested' });
  expect(C.readRequests(s)).toHaveLength(1);
  expect(C.addRequest(s, { kind: 'place', name: '  ' }, 1790000000001).ok).toBe(false);
  expect(C.readRequests(s)).toHaveLength(1);
  expect(C.normaliseRequest({ kind: 'zzz', status: 'zzz', name: 'A' })).toMatchObject({ kind: 'place', status: 'Requested' });
});

test('contract: ext (the planner extension bag) survives normalise and a store round trip; non-objects are refused', () => {
  const s = store();
  const t = { ...good(), ext: { notes: 'n', done: { a: true }, parkTicks: [1, 2] } };
  expect(C.validate(C.normalise(t))).toEqual([]);
  expect(C.writeTrips(s, [t]).ok).toBe(true);
  expect(C.readTrips(s)[0].ext).toEqual(t.ext);
  expect(C.normalise(good()).ext).toBeUndefined();
  expect(C.normalise({ ...good(), ext: [1] }).ext).toBeUndefined();
  expect(C.validate({ ...C.normalise(good()), ext: 'x' }).map((p) => p.path)).toContain('ext');
  expect(C.validate({ ...C.normalise(good()), ext: [] }).map((p) => p.path)).toContain('ext');
});
