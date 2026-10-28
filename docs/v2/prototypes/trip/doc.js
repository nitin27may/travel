/* THROWAWAY prototype: the ONE document shape for a trip (fixes X-1, X-2) and every edit as an operation.
   A trip is a ProtoContract trip (the shape Mine, the planner and the builder already read) plus one extension bag,
   `trip.ext.edit`, which the contract keeps as a plain object:

     edit = { mode: 'template' | 'built',        template = a copy that follows our plan; built = the person's own trip
              source, ops[], marks{}, maybe[], removed[], unfit[], keys[], pace, converted?, built? }

   Template mode keeps an operation log (`ops`) and RE-PLAYS it over our published days (ours.js), so the copy keeps our
   versions A, B, C and follows our plan (B-F6). Built mode edits the days directly (no log, the engine owns the days).
   `trip.days` always holds the rendered result, so every other app reads a normal trip.
   Undo is a snapshot stack in the page (trip.js); in the product each operation carries its inverse (core/src/plan/ops.ts).
   Needs: shared/contract.js, builder/data.js (PL, PLACES, SUNSET, MS), shared/engine.js, ours.js. */
(function () {
  'use strict';
  var C = window.ProtoContract, E = window.ProtoEngine, O = window.OURS;
  var PACES = { relaxed: { l: 'Relaxed', drive: 180 }, standard: { l: 'Standard', drive: 240 }, full: { l: 'Full', drive: 300 } };
  var DAY_START = 540, DAY_WINDOW = 600;                       // 09:00, and ten hours of day to fill
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var KEY_RE = /^d(\d+)$/;

  function uid() { return 'o' + Math.random().toString(36).slice(2, 8); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function mk(pid) {
    var p = PL[pid];
    return { id: pid, name: p.name, slug: pid, park: p.park || undefined, time: '', durMin: p.dur, driveMin: 0, locked: false, placed: false, mustSee: false, note: '' };
  }
  /* ---------- dates ---------- */
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dowOf(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
  function fmtDate(iso) { var d = new Date(iso + 'T00:00:00Z'); return DOWS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function dateOf(T, n) { return T.dates && T.dates.from ? addDays(T.dates.from, n - 1) : null; }
  function toMin(hm) { var p = String(hm || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function fd(m) { return E.fd(m); }

  /* ---------- reading the edit bag ---------- */
  function modeOf(T) { return (T.ext && T.ext.edit && T.ext.edit.mode) || 'built'; }
  function ed(T) {
    T.ext = T.ext || {}; T.ext.edit = T.ext.edit || {};
    var e = T.ext.edit;
    e.mode = e.mode || 'built'; e.ops = e.ops || []; e.marks = e.marks || {}; e.maybe = e.maybe || []; e.removed = e.removed || [];
    e.unfit = e.unfit || []; e.pace = e.pace || 'standard';
    if (!e.keys || e.keys.length !== T.days.length) e.keys = T.days.map(function (_, i) { return 'k' + (i + 1); });
    return e;
  }
  function keyNumber(key) { var m = KEY_RE.exec(key || ''); return m ? +m[1] : null; }
  function dayN(T, key) { var i = ed(T).keys.indexOf(key); return i >= 0 ? i + 1 : (keyNumber(key) || '?'); }
  function keyOfN(T, n) { return ed(T).keys[n - 1]; }

  /* ---------- places ---------- */
  function pt(name) {
    if (!name) return null;
    return PLACES.find(function (x) { return x.name === name; }) ||
      PLACES.find(function (x) { return x.type === 'town' && (x.name.indexOf(name) === 0 || name.indexOf(x.name) === 0); }) || null;
  }
  function locate(T, id) {
    for (var i = 0; i < T.days.length; i++) {
      var j = T.days[i].items.findIndex(function (x) { return x.id === id; });
      if (j >= 0) return { di: i, j: j, n: i + 1, it: T.days[i].items[j], day: T.days[i] };
    }
    return null;
  }

  /* ---------- flow: times, driving, free time ---------- */
  function flowDay(days, i) {
    var d = days[i], b = pt(d.base);
    var from = i > 0 && days[i - 1].base !== d.base ? pt(days[i - 1].base) : b, prev = from, cur = DAY_START;
    d.items.forEach(function (it, k) {
      var p = PL[it.id], leg = E.drive(prev, p);
      if (k === 0) { cur = DAY_START; } else { cur += leg; }
      it.time = E.hm(cur); it.driveMin = leg; it.durMin = it.durMin || p.dur;
      cur += it.durMin; prev = p;
    });
  }
  function stats(T, i) {
    var d = T.days[i], b = pt(d.base), n = d.items.length;
    var last = n ? PL[d.items[n - 1].id] : null, back = last ? E.drive(last, b) : 0;
    var drive = d.items.reduce(function (s, it) { return s + (it.driveMin || 0); }, 0) + back;
    var visit = d.items.reduce(function (s, it) { return s + (it.durMin || 0); }, 0);
    var end = n ? toMin(d.items[n - 1].time) + d.items[n - 1].durMin + back : DAY_START;
    return { drive: drive, visit: visit, end: end, free: DAY_WINDOW - (drive + visit), back: back };
  }
  function limitOf(T) { return PACES[ed(T).pace].drive; }

  /* ---------- warnings: two levels, never block (spec 11) ---------- */
  function warnings(T, i) {
    var d = T.days[i], date = dateOf(T, d.n), month = C.monthOf(T), st = stats(T, i), fix = [], check = [];
    d.items.forEach(function (it) {
      var p = PL[it.id], cd = O.closedDays[it.id];
      if (date && cd && cd.indexOf(dowOf(date)) >= 0) fix.push({ code: 'W_HOURS', id: it.id, text: it.name + ' is closed on ' + DOW[dowOf(date)] + 's', fix: 'Swap or remove it' });
      else if (month && p.cl && p.cl.indexOf(month) >= 0) fix.push({ code: 'TB_CLOSED', id: it.id, text: it.name + ' is closed in ' + MONFULL[month - 1], fix: 'Swap or remove it' });
    });
    var lim = limitOf(T);
    if (st.drive > lim) {
      var big = d.items.slice().sort(function (a, b) { return b.driveMin - a.driveMin; })[0];
      check.push({ code: 'W_DRIVE_LIMIT', id: big && big.id, text: fd(st.drive) + ' driving, over your ' + fd(lim) + ' a day', fix: big ? 'Move ' + big.name + ' to a lighter day' : '' });
    }
    var lastIt = d.items[d.items.length - 1];
    if (st.free < 90 && st.drive <= lim) check.push({ code: 'W_PACE', id: lastIt && lastIt.id, text: 'A full day: ' + fd(st.visit + st.drive) + ' on the go', fix: lastIt ? 'Move a stop to a lighter day' : '' });
    var ss = month ? SUNSET[month - 1] : null;
    if (ss && d.items.length && st.end > toMin(ss) && st.end > 0) check.push({ code: 'W_DAYLIGHT', id: lastIt && lastIt.id, text: 'Ends ' + E.hm(st.end) + ' ≈, after sunset at ' + ss, fix: lastIt ? 'Move a stop to a lighter day' : '' });
    return { fix: fix, check: check };
  }
  function summary(T) {
    var fix = 0, check = 0;
    T.days.forEach(function (_, i) { var w = warnings(T, i); fix += w.fix.length; check += w.check.length; });
    return { fix: fix, check: check };
  }

  /* ---------- bases, nights, region, distance (review M7, M3) ---------- */
  /** One entry per distinct base, in first-night order. A night is spent at the base of every day but the last (departure day). */
  function basesNights(T) {
    var out = [], idx = {};
    T.days.forEach(function (d, i) {
      if (!(d.base in idx)) { idx[d.base] = out.length; out.push({ base: d.base, nights: 0 }); }
      if (i < T.days.length - 1) out[idx[d.base]].nights++;
    });
    return out;
  }
  /** The region named from the trip's own places, never a literal */
  function whereOf(T) {
    if (modeOf(T) === 'template' || (T.ext && T.ext.edit && T.ext.edit.converted)) return O.name;
    var names = [];
    T.days.forEach(function (d) { d.items.forEach(function (it) { var p = PL[it.id], r = p && REGIONS[p.reg]; if (r && names.indexOf(r.name) < 0) names.push(r.name); }); });
    return names.join(', ') || 'Not set';
  }
  var PIN_FAR_KM = 100;                     // the product reads this from core/src/config/nearby.ts (ADD_PIN_FAR_KM)
  /** Straight-line km from a point to the nearest base or stop of the trip (Infinity when the trip holds no point) */
  function kmToTrip(T, pointOrId) {
    var q = typeof pointOrId === 'string' ? (PL[pointOrId] || (typeof PARKS !== 'undefined' && PARKS[pointOrId])) : pointOrId, best = Infinity;
    if (!q || q.lat == null) return Infinity;
    T.days.forEach(function (d) {
      var b = pt(d.base); if (b) best = Math.min(best, E.hav(b, q));
      d.items.forEach(function (it) { if (PL[it.id]) best = Math.min(best, E.hav(PL[it.id], q)); });
    });
    return best;
  }
  function kmBases(T, q) { var best = Infinity; T.days.forEach(function (d) { var b = pt(d.base); if (b && q) best = Math.min(best, E.hav(b, q)); }); return best; }
  function farFrom(T, q) { return kmBases(T, q) > PIN_FAR_KM; }
  function kmText(km) { return km >= 100 ? (Math.round(km / 100) * 100).toLocaleString('en-CA') + ' km' : Math.round(km) + ' km'; }

  /* ---------- party ---------- */
  function partyWords(T) {
    var a = T.party.filter(function (p) { return p.type === 'adult'; }).length;
    var kids = T.party.filter(function (p) { return p.type !== 'adult'; });
    var out = [a + ' adult' + (a === 1 ? '' : 's')];
    if (kids.length) out.push(kids.length + ' child' + (kids.length === 1 ? '' : 'ren') + ' (' + kids.map(function (k) { return k.type === 'infant' ? 'under 2' : k.age; }).join(', ') + ')');
    return out.join(' · ');
  }
  function defaultVariant(T) {
    var ages = T.party.filter(function (p) { return p.type !== 'adult'; }).map(function (p) { return p.type === 'infant' ? 1 : (p.age == null ? 9 : p.age); });
    return ages.length && Math.min.apply(null, ages) <= 7 ? 'B' : 'A';
  }

  /* ---------- the working form W: {built, e, days[{key, base, items, notes, added}], originOf} ---------- */
  function toW(T) {
    var e = ed(T);
    return { built: e.mode === 'built', e: e, originOf: {}, days: T.days.map(function (d, i) { return { key: e.keys[i], base: d.base, items: d.items, notes: d.notes || '', added: / \(added\)$/.test(d.label || '') }; }) };
  }
  function fromW(T, W) {
    var e = W.e;
    T.days = W.days.map(function (d, i) {
      return { n: i + 1, label: 'Day ' + (i + 1) + (d.base ? ' · ' + d.base : '') + (d.added ? ' (added)' : ''), base: d.base, notes: d.notes || '', items: d.items };
    });
    e.keys = W.days.map(function (d) { return d.key; });
  }
  function dayByKey(W, key) { return W.days.find(function (d) { return d.key === key; }); }
  function findIn(W, id) {
    for (var i = 0; i < W.days.length; i++) { var j = W.days[i].items.findIndex(function (x) { return x.id === id; }); if (j >= 0) return { d: W.days[i], i: i, j: j, it: W.days[i].items[j] }; }
    return null;
  }
  function pushUnique(a, x) { if (a.indexOf(x) < 0) a.push(x); return a; }

  function applyOp(W, op) {
    var e = W.e, f, d, at;
    switch (op.t) {
      case 'add':
        if (findIn(W, op.id)) return applyOp(W, { t: 'move', id: op.id, day: op.day, at: op.at });
        d = dayByKey(W, op.day) || W.days[W.days.length - 1];
        var it = mk(op.id);
        if (W.built) { it.placed = true; }
        at = op.at == null || op.at > d.items.length ? d.items.length : op.at;
        d.items.splice(at, 0, it);
        e.marks[op.id] = ['added'];
        e.removed = e.removed.filter(function (x) { return x.id !== op.id; });
        e.maybe = e.maybe.filter(function (x) { return x !== op.id; });
        e.unfit = e.unfit.filter(function (x) { return x !== op.id; });
        return;
      case 'remove':
        f = findIn(W, op.id); if (!f) return;
        f.d.items.splice(f.j, 1);
        e.removed = e.removed.filter(function (x) { return x.id !== op.id; });
        e.removed.unshift({ id: op.id, name: f.it.name, day: f.d.key });
        if (op.maybe) e.maybe.unshift(op.id);
        delete e.marks[op.id];
        return;
      case 'move':
        f = findIn(W, op.id); d = dayByKey(W, op.day); if (!f || !d) return;
        f.d.items.splice(f.j, 1);
        at = op.at == null || op.at > d.items.length ? d.items.length : op.at;
        d.items.splice(at, 0, f.it);
        var m = e.marks[op.id] || [];
        if (W.built) {
          f.it.locked = true; f.it.placed = true;
          if (m.indexOf('you') < 0 && m.indexOf('ours') < 0) m = m.concat('you');
          e.marks[op.id] = m;
        } else if (m[0] !== 'added') {
          var o = W.originOf[op.id];
          if (o && o !== d.key) e.marks[op.id] = ['moved:' + keyNumber(o)]; else delete e.marks[op.id];
        }
        return;
      case 'note':
        if (op.id) { f = findIn(W, op.id); if (f) f.it.note = op.text || ''; } else { d = dayByKey(W, op.day); if (d) d.notes = op.text || ''; }
        return;
      case 'insertDay':
        var idx = W.days.findIndex(function (x) { return x.key === op.after; }) + 1;
        W.days.splice(idx, 0, { key: op.key, base: (W.days[idx - 1] || W.days[0]).base, items: [], notes: '', added: true });
        return;
      case 'dropDay':
        d = dayByKey(W, op.key); if (!d) return;
        var items = d.items.slice();
        W.days.splice(W.days.indexOf(d), 1);
        items.forEach(function (x) {
          if (op.to === 'day' && dayByKey(W, op.toKey)) dayByKey(W, op.toKey).items.push(x);
          else { e.removed.unshift({ id: x.id, name: x.name, day: op.key }); delete e.marks[x.id]; if (op.to === 'maybe') e.maybe.unshift(x.id); }
        });
        return;
      case 'moveDay':
        var k = W.days.findIndex(function (x) { return x.key === op.key; }), k2 = k + op.dir;
        if (k < 0 || k2 < 0 || k2 >= W.days.length) return;
        var tmp = W.days[k]; W.days[k] = W.days[k2]; W.days[k2] = tmp;
        return;
    }
  }

  /* ---------- template: replay the log over our published days ---------- */
  function ourItems(d, letter) { return d.v ? (d.v[letter] || d.v.A) : d.items; }
  function rebuild(T) {
    var e = ed(T), vmap = {}, seen = {};
    e.ops.forEach(function (o) { if (o.t === 'variant') vmap[o.day] = o.v; });
    var dflt = defaultVariant(T);
    var W = { built: false, e: e, originOf: {}, days: [] };
    O.days.forEach(function (d) {
      var items = ourItems(d, vmap[d.key] || dflt).filter(function (id) { if (seen[id]) return false; seen[id] = 1; W.originOf[id] = d.key; return true; });
      W.days.push({ key: d.key, base: d.base, items: items.map(mk), notes: '', added: false });
    });
    e.marks = {}; e.maybe = []; e.removed = [];
    e.ops.forEach(function (o) { if (o.t !== 'variant') applyOp(W, o); });
    fromW(T, W);
    e.variantNow = {}; O.days.forEach(function (d) { if (d.v) e.variantNow[d.key] = vmap[d.key] || dflt; });
  }

  /* ---------- finishing every change: times, nights, dates, bookings ---------- */
  function syncBookings(T) {
    var want = [], old = {};
    T.bookings.forEach(function (b) { old[b.label] = b; });
    T.days.forEach(function (d) {
      var date = dateOf(T, d.n);
      d.items.forEach(function (it) {
        var p = PL[it.id]; if (!p || !p.bk) return;
        var label = p.bk[0] + ' (' + p.name + ')';
        want.push(old[label] || { label: label, by: date ? addDays(date, -p.bk[1]) : p.bk[1] + 'd', link: '#', done: false });
      });
    });
    var other = T.bookings.filter(function (b) {
      var m = /\(([^)]*)\)$/.exec(b.label); if (!m) return true;
      return !PLACES.some(function (x) { return x.name === m[1]; });
    });
    T.bookings = other.concat(want);
  }
  function finalise(T) {
    var e = ed(T);
    T.days.forEach(function (_, i) { flowDay(T.days, i); });
    T.nights = Math.max(0, T.days.length - 1);
    if (T.dates && T.dates.from) T.dates = { from: T.dates.from, to: addDays(T.dates.from, Math.max(0, T.days.length - 1)) };
    syncBookings(T);
    T.updated = new Date().toISOString();
    return e;
  }

  /* ---------- the operations the page calls (each returns a message for the toast) ---------- */
  function mergeOp(T, op) {
    var ops = ed(T).ops;
    op.oid = op.oid || uid();
    function drop(fn) { for (var k = ops.length - 1; k >= 0; k--) if (fn(ops[k])) ops.splice(k, 1); }
    var addOp = function (id) { return ops.find(function (o) { return o.t === 'add' && o.id === id; }); };
    switch (op.t) {
      case 'remove':
        if (addOp(op.id)) { drop(function (o) { return o.id === op.id; }); return; }
        drop(function (o) { return o.t === 'move' && o.id === op.id; });
        ops.push(op); return;
      case 'add': {
        var had = ops.find(function (o) { return o.t === 'remove' && o.id === op.id; });
        if (had) {
          drop(function (o) { return o === had; });
          if (originDay(op.id) !== op.day) ops.push({ t: 'move', id: op.id, day: op.day, at: op.at, oid: uid() });
          return;
        }
        break;
      }
      case 'move': {
        var ao = addOp(op.id);
        if (ao) { ao.day = op.day; ao.at = op.at; return; }
        drop(function (o) { return o.t === 'move' && o.id === op.id; });
        break;
      }
      case 'variant':
        drop(function (o) { return o.t === 'variant' && o.day === op.day; });
        if (op.v === defaultVariant(T)) return;
        break;
      case 'note':
        drop(function (o) { return o.t === 'note' && o.day === op.day && o.id === op.id; });
        if (!op.text) return;
        break;
    }
    ops.push(op);
  }
  function act(T, op) {
    var e = ed(T);
    if (e.mode === 'template') { mergeOp(T, op); rebuild(T); } else { var W = toW(T); applyOp(W, op); fromW(T, W); }
    finalise(T);
  }
  function nameOf(id) { return PL[id] ? PL[id].name : id; }

  function removeItem(T, id) {
    var loc = locate(T, id), nb = T.bookings.length; if (!loc) return null;
    act(T, { t: 'remove', id: id, from: keyOfN(T, loc.n) });
    var gone = nb - T.bookings.length;
    return { msg: 'Removed ' + loc.it.name + ' from Day ' + loc.n + (gone > 0 ? ' and its booking slot' : ''), from: loc };
  }
  function addItem(T, id, n, at) {
    var was = locate(T, id);
    if (was) return moveItem(T, id, n, at);
    act(T, { t: 'add', id: id, day: keyOfN(T, n), at: at });
    return { msg: 'Added ' + nameOf(id) + ' to Day ' + n };
  }
  function moveItem(T, id, n, at) {
    var loc = locate(T, id); if (!loc) return null;
    act(T, { t: 'move', id: id, day: keyOfN(T, n), at: at });
    var now = locate(T, id), built = modeOf(T) === 'built';
    var where = n === loc.n ? (now.j < loc.j ? 'up' : now.j > loc.j ? 'down' : '') : 'to Day ' + n;
    return { msg: 'Moved ' + loc.it.name + (where ? ' ' + where : '') + (built ? ' · kept there' : ''), from: loc, to: now,
      live: 'Moved ' + loc.it.name + (where ? ' ' + where : '') + ', position ' + (now.j + 1) + ' of ' + now.day.items.length };
  }
  function nudge(T, id, dir) {
    var loc = locate(T, id); if (!loc) return null;
    var at = loc.j + dir;
    if (at < 0 || at >= loc.day.items.length) return { msg: loc.it.name + ' is already ' + (dir < 0 ? 'first' : 'last') + ' on Day ' + loc.n, none: true };
    return moveItem(T, id, loc.n, at);
  }
  function toMaybe(T, id) {
    var loc = locate(T, id); if (!loc) return null;
    act(T, { t: 'remove', id: id, maybe: true, from: keyOfN(T, loc.n) });
    return { msg: 'Moved ' + loc.it.name + ' to Maybe' };
  }
  function setNote(T, target, text) {
    act(T, target.id ? { t: 'note', id: target.id, text: text } : { t: 'note', day: keyOfN(T, target.n), text: text });
    return { msg: text ? 'Note saved' : 'Note removed' };
  }
  function insertDay(T, afterN) {
    var key = 'x' + uid().slice(1);
    act(T, { t: 'insertDay', after: keyOfN(T, afterN), key: key });
    return { msg: 'Added Day ' + (afterN + 1), n: afterN + 1 };
  }
  function dropDay(T, n, to, toN) {
    var d = T.days[n - 1], cnt = d.items.length;
    act(T, { t: 'dropDay', key: keyOfN(T, n), to: to, toKey: toN ? keyOfN(T, toN) : null });
    return { msg: 'Dropped Day ' + n + (cnt ? (to === 'day' ? ' · ' + cnt + ' stop' + (cnt === 1 ? '' : 's') + ' moved to Day ' + (toN > n ? toN - 1 : toN) : to === 'maybe' ? ' · stops moved to Maybe' : ' · stops removed') : '') };
  }
  function moveDay(T, n, dir) {
    act(T, { t: 'moveDay', key: keyOfN(T, n), dir: dir });
    return { msg: 'Moved Day ' + n + (dir < 0 ? ' earlier' : ' later') };
  }
  function setVariant(T, n, letter) {
    act(T, { t: 'variant', day: keyOfN(T, n), v: letter });
    return { msg: 'Day ' + n + ' now uses version ' + letter };
  }
  function resetDay(T, n) {
    var key = keyOfN(T, n), e = ed(T);
    e.ops = e.ops.filter(function (o) { return o.day !== key && o.key !== key && o.after !== key && !(o.t === 'move' && originDay(o.id) === key) && !(o.t === 'remove' && originDay(o.id) === key); });
    rebuild(T); finalise(T);
    return { msg: 'Day ' + n + ' is back to our plan' };
  }
  function originDay(id) { var r = null; O.days.forEach(function (d) { if (!r && ourItems(d, 'A').indexOf(id) >= 0 && !d.v) r = d.key; }); return r; }
  function resetAll(T) {
    ed(T).ops = []; rebuild(T); finalise(T);
    return { msg: 'Back to our plan' };
  }
  function restoreOp(T, oid) {
    var e = ed(T), o = e.ops.find(function (x) { return x.oid === oid; }); if (!o) return null;
    e.ops = e.ops.filter(function (x) { return x !== o && !(o.t === 'add' && x.id === o.id); });
    rebuild(T); finalise(T);
    return { msg: 'Put back: ' + opText(T, o, true) };
  }
  function opText(T, o, past) {
    var n = function (k) { return dayN(T, k); };
    switch (o.t) {
      case 'add': return 'Added ' + nameOf(o.id) + ' to Day ' + n(o.day);
      case 'remove': return o.maybe ? 'Moved ' + nameOf(o.id) + ' to Maybe' : 'Removed ' + nameOf(o.id) + ' from Day ' + dayN(T, o.from);
      case 'move': {
        var loc = locate(T, o.id), from = keyNumber(originDay(o.id));
        return loc && from && from !== loc.n ? 'Moved ' + nameOf(o.id) + ' from Day ' + from + ' to Day ' + loc.n : 'Moved ' + nameOf(o.id) + ' within Day ' + (loc ? loc.n : n(o.day));
      }
      case 'variant': return 'Day ' + n(o.day) + ' uses version ' + o.v;
      case 'note': return (o.id ? 'Note on ' + nameOf(o.id) : 'Note on Day ' + n(o.day)) + (o.text ? ': ' + o.text : '');
      case 'insertDay': return 'Added a day after Day ' + (dayN(T, o.after));
      case 'dropDay': return 'Dropped Day ' + (keyNumber(o.key) || '');
    }
    return o.t;
  }
  /** What each row's button does, in the words of the change (ruling C4): never "Restore" on an Added row */
  var VERBS = { add: 'Remove it', remove: 'Put it back', move: 'Move it back', variant: 'Use our version', note: 'Remove note', insertDay: 'Remove day', dropDay: 'Put it back', moveDay: 'Move it back' };
  function changes(T) {
    var e = ed(T);
    return e.ops.slice().reverse().map(function (o) { return { oid: o.oid, kind: o.t, text: opText(T, o), verb: VERBS[o.t] || 'Put it back' }; });
  }
  /** template -> built, in place (spec 13.2): every stop is kept "From our trip", the versions are flattened */
  function convert(T) {
    var e = ed(T);
    e.mode = 'built'; e.converted = { at: new Date().toISOString(), from: O.name };
    T.days.forEach(function (d) { d.items.forEach(function (it) { it.placed = true; it.locked = true; if ((e.marks[it.id] || [])[0] !== 'added') e.marks[it.id] = ['ours']; }); });
    e.ops = [];
    finalise(T);
  }
  /** Rebuild (built): keeps what was placed or kept; the prototype only re-times the days */
  function rebuildBuilt(T) { finalise(T); return { msg: 'Rebuilt ' + T.days.length + ' days · ' + T.days.reduce(function (s, d) { return s + d.items.filter(function (i) { return i.placed || i.locked; }).length; }, 0) + ' kept' }; }
  function setKeep(T, id, on) { var l = locate(T, id); if (!l) return null; l.it.locked = on; l.it.placed = on; return { msg: on ? 'Kept ' + l.it.name + ' on Day ' + l.n : l.it.name + ' can move with the plan' }; }
  function setMust(T, id, on) { var l = locate(T, id); if (!l) return null; l.it.mustSee = on; return { msg: on ? l.it.name + ' is a must see' : l.it.name + ' is no longer a must see' }; }

  /** Settings > Length (spec 9.2). Longer: add days after Day `afterN` (default the end). Shorter: drop day `dropN` first, its stops to `to`
      ('day' = the day before it, 'maybe', 'remove'), then days from the end. One call is one undo step (one commit in trip.js). */
  function setLength(T, want, o) {
    o = o || {}; var cur = T.days.length, msg;
    if (want > cur) {
      var at = o.afterN || cur;
      for (var k = 0; k < want - cur; k++) insertDay(T, at);
      msg = 'Added ' + (want - cur) + ' day' + (want - cur === 1 ? '' : 's') + (at === cur ? ' at the end' : ' after Day ' + at);
    } else if (want < cur) {
      var first = o.dropN || cur, n0 = first;
      for (var j = 0; j < cur - want; j++) {
        var dn = j === 0 ? first : T.days.length, tN = dn > 1 ? dn - 1 : 2;
        dropDay(T, dn, o.to || 'day', tN);
      }
      msg = 'Dropped ' + (cur - want) + ' day' + (cur - want === 1 ? '' : 's') + (n0 ? ' · from Day ' + n0 : '');
    } else return null;
    return { msg: msg };
  }
  function setTitle(T, title) { T.title = title || T.title; }
  function setDates(T, from) {
    if (from) T.dates = { from: from, to: addDays(from, Math.max(0, T.days.length - 1)) };
    else { var m = C.monthOf(T) || 7; T.dates = { month: m }; }
    finalise(T);
    return { msg: from ? 'Dates are ' + fmtDate(from) + ' to ' + fmtDate(T.dates.to) : 'Dates removed' };
  }
  function setParty(T, party, pace) {
    var e = ed(T); T.party = party; if (pace) e.pace = pace;
    if (e.mode === 'template') rebuild(T);
    finalise(T);
    return { msg: 'Planned for ' + partyWords(T) };
  }
  /** What a change of party or pace would do, for the effect line before Apply */
  function previewParty(T, party, pace) {
    var U = clone(T); var e = ed(U); var before = summary(T);
    var vBefore = clone(ed(T).variantNow || {});
    U.party = party; e.pace = pace || e.pace;
    if (e.mode === 'template') rebuild(U);
    finalise(U);
    var after = summary(U), changed = [];
    Object.keys(ed(U).variantNow || {}).forEach(function (k) { if (vBefore[k] !== ed(U).variantNow[k]) changed.push('Day ' + dayN(U, k) + ' uses version ' + ed(U).variantNow[k]); });
    return { variants: changed, check: after.check - before.check, fix: after.fix - before.fix, over: after.check };
  }

  /* ---------- what would happen (Move to day, the add picker) ---------- */
  function fitsIf(T, id, n) {
    var U = { days: clone(T.days), dates: T.dates, ext: T.ext, party: T.party };
    var before = stats(T, n - 1), i = n - 1;
    U.days.forEach(function (d) { d.items = d.items.filter(function (x) { return x.id !== id; }); });
    U.days.forEach(function (d, k) { d.n = k + 1; });
    var prevName = U.days[i].items.length ? U.days[i].items[U.days[i].items.length - 1].name : null;
    U.days[i].items.push(mk(id));
    flowDay(U.days, i);
    var after = stats(U, i), w = warnings(U, i);
    var cur = locate(T, id);
    return { addDrive: cur && cur.n === n ? 0 : after.drive - before.drive, driveBefore: before.drive, driveAfter: after.drive, ends: E.hm(after.end), free: Math.max(0, after.free), over: after.free < 0, after: prevName,
      fix: w.fix.filter(function (x) { return x.id === id; })[0] || null, tight: !!w.check.length && !warnings(T, i).check.length, dayFix: warnings(T, i).fix.length };
  }
  function bestDays(T, id) {
    return T.days.map(function (d, i) { var f = fitsIf(T, id, d.n); var near = pt(d.base) ? E.hav(pt(d.base), PL[id]) : 999; return { n: d.n, f: f, near: near, score: (f.fix ? 1000 : 0) + (f.tight || f.over ? 300 : 0) + near }; })
      .sort(function (a, b) { return a.score - b.score; });
  }

  function marksOf(T, it, di) {
    var e = ed(T), m = (e.marks[it.id] || []).slice(), out = [];
    m.forEach(function (x) {
      if (x === 'added') out.push('Added by you');
      else if (x === 'you') out.push('Moved by you');
      else if (x === 'ours') out.push('From our trip');
      else if (x.indexOf('moved:') === 0) out.push('Moved from Day ' + x.slice(6));
    });
    if (e.mode === 'built' && (it.locked || it.placed) && m.indexOf('ours') < 0 && m.indexOf('you') < 0 && m.indexOf('added') < 0) out.push('Kept on Day ' + (di + 1));
    else if (e.mode === 'built' && (it.locked || it.placed) && m.indexOf('ours') < 0) out.push('Kept on Day ' + (di + 1));
    return out;
  }

  /* ---------- storage ---------- */
  function all() { return C.readTrips(localStorage); }
  function get(id) { return all().find(function (t) { return t.id === id; }) || null; }
  function put(T) {
    var list = all(), n = C.normalise(T), i = list.findIndex(function (x) { return x.id === T.id; });
    if (i >= 0) list[i] = n; else list.push(n);
    return C.writeTrips(localStorage, list).ok;
  }
  function remove(id) { C.writeTrips(localStorage, all().filter(function (t) { return t.id !== id; })); }

  /* ---------- making trips ---------- */
  var PARTY_DEMO = [{ type: 'adult', needs: [] }, { type: 'adult', needs: [] }, { type: 'child', age: 6, needs: [] }];
  function blank(over) {
    return Object.assign({ id: 't-' + uid(), title: 'Trip', kind: 'weekair', mode: 'trip', start: { city: 'Toronto', airport: 'YYZ' }, party: clone(PARTY_DEMO),
      dates: {}, nights: 0, identity: 'var(--id-orange)', inMine: true, updated: new Date().toISOString(), days: [],
      gettingThere: { from: 'YYZ', mode: 'fly' }, bookings: [], checklist: [{ label: 'Passport valid for the whole trip', done: false }, { label: 'Travel insurance', done: false }, { label: 'Hire car and licence', done: false }], costs: [] }, over);
  }
  /** "Copy to my trips": a template-mode copy of our Dolomites trip (spec 2.2) */
  function makeCopy(opts) {
    opts = opts || {};
    var T = blank({ id: opts.id || 'copy-' + uid().slice(1), title: opts.title || O.name, dates: { from: opts.from || O.start },
      party: opts.party || clone(PARTY_DEMO), updated: new Date().toISOString() });
    T.ext = { edit: { mode: 'template', source: O.id, sourceName: O.name, rev: O.rev, ops: [], marks: {}, maybe: [], removed: [], unfit: [], pace: 'standard' } };
    T.days = O.days.map(function (d, i) { return { n: i + 1, label: '', base: d.base, notes: '', items: [] }; });
    ed(T).keys = O.days.map(function (d) { return d.key; });
    rebuild(T); finalise(T);
    return T;
  }
  function seedCopy() {
    var T = makeCopy({ id: 'demo-copy', title: O.name });
    removeItem(T, 'sorapis');
    addItem(T, 'gherdeina', 7);
    moveItem(T, 'lagazuoi', 9);
    addItem(T, 'tre-cime', 5);
    setNote(T, { n: 4 }, 'Lunch at the hut, book ahead.');
    return T;
  }
  function seedBuilt() {
    var T = blank({ id: 'demo-built', title: 'Banff long weekend', kind: 'long', start: { city: 'Calgary' }, identity: 'var(--id-blue)',
      dates: { from: '2027-08-05' }, gettingThere: { from: 'Calgary', mode: 'drive' } });
    var plan = [['Banff townsite', ['banff-town', 'bow-falls', 'banff-gondola']], ['Banff townsite', ['johnston-canyon']], ['Lake Louise village', ['lake-louise', 'moraine-lake']], ['Banff townsite', ['six-glaciers']]];
    T.days = plan.map(function (p, i) { return { n: i + 1, label: 'Day ' + (i + 1) + ' · ' + p[0], base: p[0], notes: '', items: p[1].map(mk) }; });
    T.ext = { edit: { mode: 'built', ops: [], marks: { 'moraine-lake': ['you'] }, maybe: [], removed: [], unfit: ['canoe-lake'], pace: 'standard', keys: ['k1', 'k2', 'k3', 'k4'], built: { days: 4, unfit: 1, warnings: 1 } } };
    T.days[2].items[1].placed = true; T.days[2].items[1].locked = true;
    finalise(T);
    return T;
  }
  function seed() {
    var list = all(), changed = false;
    if (!list.some(function (t) { return t.id === 'demo-copy'; })) { list.push(C.normalise(seedCopy())); changed = true; }
    if (!list.some(function (t) { return t.id === 'demo-built'; })) { list.push(C.normalise(seedBuilt())); changed = true; }
    if (changed) C.writeTrips(localStorage, list);
  }

  window.TripDoc = {
    PACES: PACES, DOW: DOW, DOWS: DOWS, MON: MON, MONFULL: MONFULL, DAY_WINDOW: DAY_WINDOW,
    all: all, get: get, put: put, remove: remove, seed: seed, makeCopy: makeCopy, blank: blank, ed: ed, modeOf: modeOf,
    clone: clone, mk: mk, pt: pt, locate: locate, dateOf: dateOf, fmtDate: fmtDate, addDays: addDays, dayN: dayN, keyOfN: keyOfN, keyNumber: keyNumber, toMin: toMin,
    stats: stats, warnings: warnings, summary: summary, limitOf: limitOf, partyWords: partyWords, defaultVariant: defaultVariant, marksOf: marksOf,
    finalise: finalise, rebuild: rebuild, flowDay: flowDay,
    removeItem: removeItem, addItem: addItem, moveItem: moveItem, nudge: nudge, toMaybe: toMaybe, setNote: setNote, insertDay: insertDay, dropDay: dropDay, moveDay: moveDay,
    setVariant: setVariant, resetDay: resetDay, resetAll: resetAll, restoreOp: restoreOp, changes: changes, convert: convert, rebuildBuilt: rebuildBuilt,
    setKeep: setKeep, setMust: setMust, setTitle: setTitle, setLength: setLength, basesNights: basesNights, whereOf: whereOf, kmToTrip: kmToTrip, kmBases: kmBases, farFrom: farFrom, kmText: kmText, PIN_FAR_KM: PIN_FAR_KM, setDates: setDates, setParty: setParty, previewParty: previewParty, fitsIf: fitsIf, bestDays: bestDays, ourItems: ourItems, originDay: originDay
  };
})();
