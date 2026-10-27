/* The one definition of the prototypes' stored shapes: proto.trips (builder, planner, parks "add to a trip") and
   proto.requests ("Ask us for more" in the builder and parks). Every read goes through normalise(), every write through
   validate() (writeTrips refuses a trip with problems), so a month stored as 7 by one app and "2027-07" by another cannot
   break the other (finding B3). Browser: window.ProtoContract. Node: require('./contract.js').

   Trip:
     id, title, kind ('day'|'weekend'|'long'|'weekcar'|'weekair'|'holiday'|...), mode ('near'|'trip'),
     start {city, airport?}, party [{name?, type:'adult'|'child'|'infant', age?, needs[]}],
     dates {from?:'YYYY-MM-DD', to?:'YYYY-MM-DD', month?: 1..12 | 'YYYY-MM', flexible?:true},
     nights (int >= 0), identity, inMine (bool), updated (ISO string),
     days [{n (1-based), label, base, notes, items [{id, name, slug, park?, time:'HH:MM', durMin, driveMin, locked, placed, mustSee, note}]}],
     gettingThere {from, arrive?, leave?, mode}, bookings [{label, by:'YYYY-MM-DD'|'<n>d', link, done}], checklist [{label, done}],
     costs [{label, free?, amount?}]
   Request: {id, kind:'place'|'region', name, note, status:'Requested'|'Researching'|'Added', created (ISO)} */
(function (root) {
  'use strict';
  var KEYS = { trips: 'proto.trips', requests: 'proto.requests' };
  var REQUEST_KINDS = ['place', 'region'];
  var REQUEST_STATUS = ['Requested', 'Researching', 'Added'];
  var PARTY_TYPES = ['adult', 'child', 'infant'];
  var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  var CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

  function str(v, d) { return typeof v === 'string' ? v : (v == null ? (d == null ? '' : d) : String(v)); }
  function int(v, d) { var n = Number(v); return isFinite(n) && v !== '' && v !== null ? Math.round(n) : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function validDate(s) {
    if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
    var p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  /** month 1..12 from a number, a numeric string ("7"), or 'YYYY-MM'; null when unusable */
  function monthNumber(m) {
    if (typeof m === 'number' && m >= 1 && m <= 12 && m % 1 === 0) return m;
    if (typeof m === 'string') {
      if (/^\d{1,2}$/.test(m) && +m >= 1 && +m <= 12) return +m;
      if (ISO_MONTH.test(m)) return +m.slice(5);
    }
    return null;
  }
  /** month of a trip's dates: from the date, else the month field; null when unknown */
  function monthOf(trip) {
    var d = (trip && trip.dates) || {};
    if (validDate(d.from)) return +d.from.slice(5, 7);
    return monthNumber(d.month);
  }

  function normaliseItem(it) {
    it = it || {};
    var time = str(it.time);
    return { id: str(it.id), name: str(it.name), slug: str(it.slug || it.id), park: it.park ? str(it.park) : undefined,
      time: CLOCK.test(time) ? time : '', durMin: Math.max(0, int(it.durMin, 0)), driveMin: Math.max(0, int(it.driveMin, 0)),
      locked: !!it.locked, placed: !!it.placed, mustSee: !!it.mustSee, note: str(it.note) };
  }
  function normaliseDay(d, i) {
    d = d || {};
    return { n: int(d.n, i + 1), label: str(d.label, 'Day ' + (i + 1)), base: str(d.base), notes: str(d.notes), items: arr(d.items).map(normaliseItem) };
  }
  function normaliseDates(d) {
    d = d || {};
    var out = {};
    if (validDate(d.from)) out.from = d.from;
    if (validDate(d.to)) out.to = d.to;
    var m = monthNumber(d.month);
    if (m !== null) out.month = typeof d.month === 'string' && ISO_MONTH.test(d.month) ? d.month : m;
    if (d.flexible) out.flexible = true;
    return out;
  }
  /** A complete trip with every field present and typed; never throws, never mutates the input. */
  function normalise(t) {
    t = t || {};
    var start = t.start || {};
    var gt = t.gettingThere || {};
    var days = arr(t.days).map(normaliseDay);
    var nights = int(t.nights, Math.max(0, days.length - 1));
    return {
      id: str(t.id), title: str(t.title, 'Untitled trip'), kind: str(t.kind), mode: t.mode === 'trip' ? 'trip' : 'near',
      start: { city: str(start.city), airport: start.airport ? str(start.airport) : undefined },
      party: arr(t.party).map(function (p) {
        p = p || {};
        var type = PARTY_TYPES.indexOf(p.type) >= 0 ? p.type : 'adult';
        return { name: p.name ? str(p.name) : undefined, type: type, age: type === 'child' ? int(p.age, undefined) : undefined, needs: arr(p.needs).map(String) };
      }),
      dates: normaliseDates(t.dates), nights: Math.max(0, nights), identity: str(t.identity), inMine: t.inMine !== false,
      updated: str(t.updated), days: days,
      gettingThere: { from: str(gt.from), arrive: gt.arrive ? str(gt.arrive) : undefined, leave: gt.leave ? str(gt.leave) : undefined, mode: str(gt.mode, 'drive') },
      bookings: arr(t.bookings).map(function (b) { b = b || {}; return { label: str(b.label), by: str(b.by), link: str(b.link), done: !!b.done }; }),
      checklist: arr(t.checklist).map(function (c) { c = c || {}; return { label: str(c.label), done: !!c.done }; }),
      costs: arr(t.costs).map(function (c) { c = c || {}; var o = { label: str(c.label) }; if (c.free) o.free = true; if (c.amount != null) o.amount = Number(c.amount) || 0; return o; })
    };
  }

  /** Problems with a (raw or normalised) trip as [{path, msg}]; empty means it can be stored. */
  function validate(t) {
    var p = [];
    function bad(path, msg) { p.push({ path: path, msg: msg }); }
    if (!t || typeof t !== 'object') return [{ path: '', msg: 'Trip is not an object' }];
    if (!t.id || typeof t.id !== 'string') bad('id', 'Needs an id');
    if (!t.title || typeof t.title !== 'string') bad('title', 'Needs a title');
    if (t.mode !== 'near' && t.mode !== 'trip') bad('mode', 'Must be near or trip');
    if (!t.start || typeof t.start.city !== 'string' || !t.start.city) bad('start.city', 'Needs a start city');
    if (!Array.isArray(t.party) || !t.party.length) bad('party', 'Needs at least one traveller');
    else t.party.forEach(function (x, i) { if (PARTY_TYPES.indexOf(x && x.type) < 0) bad('party.' + i + '.type', 'adult, child or infant'); });
    var d = t.dates;
    if (!d || typeof d !== 'object') bad('dates', 'Needs a dates object');
    else {
      if (d.from !== undefined && !validDate(d.from)) bad('dates.from', 'Must be YYYY-MM-DD');
      if (d.to !== undefined && !validDate(d.to)) bad('dates.to', 'Must be YYYY-MM-DD');
      if (validDate(d.from) && validDate(d.to) && d.to < d.from) bad('dates.to', 'Ends before it starts');
      if (d.month !== undefined && monthNumber(d.month) === null) bad('dates.month', 'Must be 1 to 12 or YYYY-MM');
    }
    if (!(typeof t.nights === 'number' && t.nights >= 0 && t.nights % 1 === 0)) bad('nights', 'Must be a whole number, 0 or more');
    if (typeof t.inMine !== 'boolean') bad('inMine', 'Must be true or false');
    if (!Array.isArray(t.days)) bad('days', 'Must be a list');
    else t.days.forEach(function (day, i) {
      var at = 'days.' + i;
      if (!day || day.n !== i + 1) bad(at + '.n', 'Days count from 1 in order');
      if (!day || !Array.isArray(day.items)) { bad(at + '.items', 'Must be a list'); return; }
      day.items.forEach(function (it, j) {
        var ip = at + '.items.' + j;
        if (!it.id) bad(ip + '.id', 'Needs an id');
        if (it.time !== '' && !CLOCK.test(it.time || '')) bad(ip + '.time', 'Must be HH:MM');
        if (!(it.durMin >= 0)) bad(ip + '.durMin', 'Must be 0 or more');
      });
    });
    ['bookings', 'checklist', 'costs'].forEach(function (k) { if (!Array.isArray(t[k])) bad(k, 'Must be a list'); });
    if (Array.isArray(t.bookings)) t.bookings.forEach(function (b, i) { if (!b.label) bad('bookings.' + i + '.label', 'Needs a label'); });
    return p;
  }

  function normaliseRequest(r) {
    r = r || {};
    return { id: str(r.id), kind: REQUEST_KINDS.indexOf(r.kind) >= 0 ? r.kind : 'place', name: str(r.name).trim(), note: str(r.note),
      status: REQUEST_STATUS.indexOf(r.status) >= 0 ? r.status : 'Requested', created: str(r.created) };
  }
  function validateRequest(r) {
    var p = [];
    if (!r || typeof r !== 'object') return [{ path: '', msg: 'Request is not an object' }];
    if (!r.id) p.push({ path: 'id', msg: 'Needs an id' });
    if (REQUEST_KINDS.indexOf(r.kind) < 0) p.push({ path: 'kind', msg: 'place or region' });
    if (!r.name) p.push({ path: 'name', msg: 'Needs a name' });
    if (REQUEST_STATUS.indexOf(r.status) < 0) p.push({ path: 'status', msg: 'Requested, Researching or Added' });
    if (!r.created || isNaN(Date.parse(r.created))) p.push({ path: 'created', msg: 'Must be an ISO time' });
    return p;
  }

  function readJson(storage, key) { try { var v = storage.getItem(key); var j = v ? JSON.parse(v) : []; return Array.isArray(j) ? j : []; } catch (e) { return []; } }
  /** All stored trips, normalised. Bad JSON gives []. */
  function readTrips(storage) { return readJson(storage, KEYS.trips).map(normalise); }
  /** Normalise then validate each trip; stores them all when every one is valid. Returns {ok, problems:[{id, path, msg}]}. */
  function writeTrips(storage, trips) {
    var norm = arr(trips).map(normalise), problems = [];
    norm.forEach(function (t) { validate(t).forEach(function (x) { problems.push({ id: t.id, path: x.path, msg: x.msg }); }); });
    if (problems.length) return { ok: false, problems: problems };
    storage.setItem(KEYS.trips, JSON.stringify(norm));
    return { ok: true, problems: [] };
  }
  function readRequests(storage) { return readJson(storage, KEYS.requests).map(normaliseRequest); }
  function writeRequests(storage, list) {
    var norm = arr(list).map(normaliseRequest), problems = [];
    norm.forEach(function (r) { validateRequest(r).forEach(function (x) { problems.push({ id: r.id, path: x.path, msg: x.msg }); }); });
    if (problems.length) return { ok: false, problems: problems };
    storage.setItem(KEYS.requests, JSON.stringify(norm));
    return { ok: true, problems: [] };
  }
  /** Add a request (status Requested, created now) and store the list. Returns {ok, request, problems}. */
  function addRequest(storage, fields, now) {
    var list = readRequests(storage);
    var r = normaliseRequest({ id: 'rq' + (now || Date.now()).toString(36) + list.length, kind: fields.kind, name: fields.name, note: fields.note, status: 'Requested', created: new Date(now || Date.now()).toISOString() });
    var res = writeRequests(storage, list.concat([r]));
    return { ok: res.ok, request: r, problems: res.problems };
  }

  var api = { KEYS: KEYS, REQUEST_STATUS: REQUEST_STATUS, normalise: normalise, validate: validate, monthNumber: monthNumber, monthOf: monthOf,
    normaliseRequest: normaliseRequest, validateRequest: validateRequest, readTrips: readTrips, writeTrips: writeTrips,
    readRequests: readRequests, writeRequests: writeRequests, addRequest: addRequest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProtoContract = api;
})(typeof window !== 'undefined' ? window : globalThis);
