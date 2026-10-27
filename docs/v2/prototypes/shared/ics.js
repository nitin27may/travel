/* Calendar export (RFC 5545) for a contract trip (see contract.js).
   - One timed VEVENT per item with a start time, on the day's date (dates.from + n - 1), lasting durMin (default 60).
     Times are FLOATING local times ("20270715T093000", no Z, no TZID): the calendar shows them at the same clock time
     wherever the viewer is, which is what a holiday plan wants. Pass {utcOffsetMin: -360} to get UTC ("...Z") instead,
     using that fixed offset from UTC for the whole trip (no daylight-saving handling).
   - One all-day VEVENT per booking whose `by` is a YYYY-MM-DD date (DTEND is the next day, exclusive). Bookings whose
     `by` is relative ("14d") are skipped and listed in result.skipped.
   - A trip with no dates.from has no calendar dates: no events, everything is listed in result.skipped.
   Text is escaped (backslash, semicolon, comma, newline) and lines are folded at 75 octets with CRLF + space.
   Browser: window.ProtoICS. Node: require('./ics.js'). */
(function (root) {
  'use strict';
  function pad(n) { return String(n).padStart(2, '0'); }
  function addDays(iso, n) {
    var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function ymd(iso) { return iso.replace(/-/g, ''); }
  function escapeText(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n'); }
  function unescapeText(s) { return s.replace(/\\n/gi, '\n').replace(/\\([;,\\])/g, '$1'); }
  /** fold at 75 octets (UTF-8 aware); continuation lines start with one space */
  function fold(line) {
    var out = [], cur = '', bytes = 0, limit = 75;
    Array.from(line).forEach(function (ch) {
      var b = new TextEncoder().encode(ch).length;
      if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
      cur += ch; bytes += b;
    });
    out.push(cur);
    return out.join('\r\n');
  }
  function stamp(now) { var d = new Date(now); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  function localStamp(iso, hhmm, plusMin, utcOffsetMin) {
    var p = iso.split('-').map(Number), h = +hhmm.slice(0, 2), m = +hhmm.slice(3, 5);
    var ms = Date.UTC(p[0], p[1] - 1, p[2], h, m) + plusMin * 60000;
    if (typeof utcOffsetMin === 'number') ms -= utcOffsetMin * 60000;
    var d = new Date(ms);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00' + (typeof utcOffsetMin === 'number' ? 'Z' : '');
  }

  /** trip: contract trip. opts: {now: ms for DTSTAMP (default Date.now()), utcOffsetMin}. Returns {text, events, skipped:[string]}. */
  function build(trip, opts) {
    opts = opts || {};
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//proto//travel prototypes//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + escapeText(trip.title || 'Trip')];
    var from = trip.dates && trip.dates.from, skipped = [], events = 0, ds = stamp(opts.now == null ? Date.now() : opts.now);
    function ev(uid, body) { events++; lines.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + ds); body.forEach(function (b) { lines.push(b); }); lines.push('END:VEVENT'); }
    (trip.days || []).forEach(function (day) {
      (day.items || []).forEach(function (it) {
        if (!from) { skipped.push('Day ' + day.n + ': ' + it.name + ' (trip has no dates)'); return; }
        if (!it.time) { skipped.push('Day ' + day.n + ': ' + it.name + ' (no start time)'); return; }
        var date = addDays(from, day.n - 1), dur = it.durMin > 0 ? it.durMin : 60;
        ev(escapeText(trip.id) + '-d' + day.n + '-' + escapeText(it.id) + '@proto', [
          'DTSTART:' + localStamp(date, it.time, 0, opts.utcOffsetMin), 'DTEND:' + localStamp(date, it.time, dur, opts.utcOffsetMin),
          'SUMMARY:' + escapeText(it.name), 'DESCRIPTION:' + escapeText('Day ' + day.n + (day.base ? ', ' + day.base : '') + (it.note ? '. ' + it.note : ''))]);
      });
    });
    (trip.bookings || []).forEach(function (b, i) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.by || '')) { skipped.push('Booking: ' + b.label + ' (book-by is "' + b.by + '", not a date)'); return; }
      ev(escapeText(trip.id) + '-b' + i + '@proto', ['DTSTART;VALUE=DATE:' + ymd(b.by), 'DTEND;VALUE=DATE:' + ymd(addDays(b.by, 1)),
        'SUMMARY:' + escapeText('Book by today: ' + b.label), 'DESCRIPTION:' + escapeText(b.link && b.link !== '#' ? b.link : ''),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeText('Book: ' + b.label), 'TRIGGER:-P1D', 'END:VALARM']);
    });
    lines.push('END:VCALENDAR');
    return { text: lines.map(fold).join('\r\n') + '\r\n', events: events, skipped: skipped };
  }

  /** Minimal parser for tests and round trips: [{props: {NAME: value}, params: {NAME: 'VALUE=DATE'}}] for each VEVENT. */
  function parse(text) {
    var unfolded = text.replace(/\r\n[ \t]/g, '').split(/\r\n/).filter(Boolean), out = [], cur = null, stack = [];
    unfolded.forEach(function (l) {
      if (l === 'BEGIN:VEVENT') { cur = { props: {}, params: {} }; stack = ['VEVENT']; return; }
      if (l === 'END:VEVENT') { out.push(cur); cur = null; stack = []; return; }
      if (!cur) return;
      if (/^BEGIN:/.test(l)) { stack.push(l.slice(6)); return; }
      if (/^END:/.test(l)) { stack.pop(); return; }
      if (stack.length > 1) return; // inside VALARM
      var i = l.indexOf(':'), left = l.slice(0, i), name = left.split(';')[0];
      cur.props[name] = unescapeText(l.slice(i + 1));
      cur.params[name] = left.indexOf(';') >= 0 ? left.slice(left.indexOf(';') + 1) : '';
    });
    return out;
  }

  var api = { build: build, parse: parse, escapeText: escapeText, fold: fold, addDays: addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProtoICS = api;
})(typeof window !== 'undefined' ? window : globalThis);
