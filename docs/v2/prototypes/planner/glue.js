/* THROWAWAY prototype: glue between a contract trip (shared/contract.js) and the builder engine (shared/engine.js).
   Uses window.ProtoEngine only (documented API: build, rebuild, toTrip, whenInfo, eff, misfit, recalc) plus the data globals
   of builder/data.js (PLACES, PL, PARKS, CITIES, AIRPORTS). Exposes window.PEngine:
     stateOf(trip)            builder state S for a trip
     propose(before, after)   re-flow `after` (a trip whose party changed) keeping locked and placed items; returns a diff
     canReflow(trip)          true when the trip holds places the engine knows
     seedTrips()              the demo trips, produced by running the engine (same date model as the builder) */
(function () {
  'use strict';
  var E = window.ProtoEngine, D = window.PDates;
  var NEEDKEY = { 'Step-free': 'stepfree' };
  var PACE_LABEL = function (p) { return E.PACE[p] ? E.PACE[p].l : p; };

  function blank(kind, over) {
    var K = E.KINDS[kind];
    var s = {
      kind: kind, id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: '', identity: 'var(--id-blue)', origin: CITIES[0], locOn: false,
      airFrom: 'YYZ', arrive: 'VCE', leave: 'VCE', openJaw: false, flyMode: K.mode === 'trip' ? 'fly' : 'drive',
      party: [{ id: 1, name: '', type: 'adult', needs: [] }], when: { type: 'unsure' }, cc: 'IT', macro: 'north', regions: ['dolomites'], reachH: K.reach || 3, areas: [], area: null,
      picks: [], must: {}, stay: {}, vibes: [], filt: { kids: true, stroller: false, step: false, dogs: false, indoor: false, hard: false }, nights: K.nights,
      driveDay: null, pace: 'standard', paceSet: false, moves: 'fewer', movesSet: false, bases: 'auto', car: 'own', stayPref: 'any',
      plan: null, unfit: [], copy: false, releaseTrip: true, checklist: [], done: {}, notesTrip: ''
    };
    return Object.assign(s, over || {});
  }
  function pidOf(it) { return it.id || it.slug; }
  function known(trip) { return (trip.days || []).reduce(function (n, d) { return n + (d.items || []).filter(function (it) { return PL[pidOf(it)]; }).length; }, 0); }

  /** the previous plan, rebuilt from the trip's days (the builder's own fromTrip does the same) */
  function planOf(trip, S) {
    var bases = [], days = [];
    (trip.days || []).forEach(function (d, i) {
      var items = (d.items || []).filter(function (it) { return PL[pidOf(it)]; }).map(function (it) { return { pid: pidOf(it), locked: !!it.locked, placed: !!it.placed }; });
      var bp = PLACES.find(function (p) { return p.name === d.base; }) || PL[(items[0] || {}).pid] || PLACES[0];
      var b = { id: bp.id, name: bp.name, lat: bp.lat, lon: bp.lon };
      if (!bases.find(function (x) { return x.id === b.id; })) bases.push(Object.assign({ nights: 0 }, b));
      var bb = bases.find(function (x) { return x.id === b.id; }); bb.nights++;
      days.push({ n: i, base: bb, moveFrom: null, items: items, note: d.notes || '' });
    });
    days.forEach(function (d, i) { if (i > 0 && days[i - 1].base !== d.base) d.moveFrom = days[i - 1].base; });
    var plan = { days: days, bases: bases, unfit: [], builtAt: Date.now(), nights: Math.max(0, days.length - 1) };
    E.recalc(plan, S);
    return plan;
  }

  function stateOf(trip) {
    var gt = trip.gettingThere || {};
    var kind = E.KINDS[trip.kind] ? trip.kind : (trip.mode === 'trip' ? 'weekair' : 'weekend');
    var items = [];
    (trip.days || []).forEach(function (d) { (d.items || []).forEach(function (it) { if (PL[pidOf(it)]) items.push(it); }); });
    var pids = [];
    items.forEach(function (it) { if (pids.indexOf(pidOf(it)) < 0 && !PARKS[pidOf(it)]) pids.push(pidOf(it)); });
    var first = PL[pids[0]];
    var S = blank(kind, {
      id: trip.id, title: trip.title, identity: trip.identity,
      origin: CITIES.find(function (c) { return c.name === (trip.start && trip.start.city); }) || CITIES[0],
      party: (trip.party || []).map(function (p, i) {
        return { id: i + 1, name: p.name || '', type: p.type, age: p.type === 'child' ? (p.age == null ? 5 : p.age) : undefined, needs: (p.needs || []).map(function (n) { return NEEDKEY[n] || n; }) };
      }),
      when: D.whenOf(trip), nights: (trip.days || []).length ? trip.days.length - 1 : trip.nights,
      picks: pids, must: {}, stay: {}
    });
    items.forEach(function (it) { if (it.mustSee) S.must[pidOf(it)] = true; });
    if (E.KINDS[kind].mode === 'trip') {
      if (gt.from && AIRPORTS[gt.from]) S.airFrom = gt.from;
      if (gt.arrive && AIRPORTS[gt.arrive]) S.arrive = gt.arrive;
      if (gt.leave && AIRPORTS[gt.leave]) S.leave = gt.leave;
      S.flyMode = 'fly';
      if (first) { S.cc = first.cc; S.regions = [first.reg]; }
    }
    // bases the trip already uses stay pinned, so a re-flow does not move the hotel
    (trip.days || []).forEach(function (d) { var b = PLACES.find(function (p) { return p.name === d.base && p.type === 'town'; }); if (b) S.stay[b.id] = true; });
    return S;
  }

  function dayOf(trip) {
    var m = {};
    (trip.days || []).forEach(function (d) { (d.items || []).forEach(function (it) { if (PL[pidOf(it)]) m[pidOf(it)] = d.n; }); });
    return m;
  }
  function plain(reasons) {
    var s = reasons.map(function (r) {
      var m = /^Not for age (\d+)$/.exec(r);
      if (m) { var a = +m[1]; return 'not suitable for ' + (a < 1 ? 'an infant' : a < 4 ? 'a toddler' : 'a child aged ' + a); }
      if (r === 'Hard hike') return 'a hard hike for a child under 10';
      return r.charAt(0).toLowerCase() + r.slice(1);
    }).join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function isTown(pid) { return PL[pid] && PL[pid].type === 'town'; }
  function nameOf(pid) { return PL[pid] ? PL[pid].name : pid; }

  /** Re-flow `after` (the trip with its new party). `before` is the trip as it was; locked and placed items stay where the person put them. */
  function propose(before, after) {
    if (!known(after)) return { ok: false, reason: 'This trip has no places the planner can re-flow. Open it in the builder.' };
    var S0 = stateOf(before), S1 = stateOf(after);
    var prev = planOf(after, S1);
    // places the new party cannot do leave the plan, unless the person locked or placed them
    var held = {};
    prev.days.forEach(function (d) { d.items.forEach(function (it) { if (it.locked || it.placed) held[it.pid] = true; }); });
    S1.picks = S1.picks.filter(function (pid) { return held[pid] || PL[pid].type === 'town' || !E.misfit(S1, PL[pid]).length; });
    var plan = E.rebuild(S1, prev);
    E.fillFree(S1, plan);
    S1.plan = plan;
    var built = E.toTrip(S1);
    var old = {}, oldItems = {};
    (after.days || []).forEach(function (d) { (d.items || []).forEach(function (it) { oldItems[pidOf(it)] = it; }); });
    var days = built.days.map(function (d) {
      d.label = d.label.replace(/^Day \d+ \u00b7 /, '');
      d.items.forEach(function (it) { var o = oldItems[it.id]; if (o) { it.note = o.note || ''; if (o.mustSee) it.mustSee = true; } });
      var od = (after.days || [])[d.n - 1];
      if (od) { d.notes = od.notes || d.notes; (od.items || []).forEach(function (it) { if (!PL[pidOf(it)]) d.items.push(JSON.parse(JSON.stringify(it))); }); }
      return d;
    });
    var a = dayOf(before), b = {};
    days.forEach(function (d) { d.items.forEach(function (it) { if (PL[it.id]) b[it.id] = d.n; }); });
    var moved = [], added = [], removed = [];
    Object.keys(b).forEach(function (pid) {
      if (isTown(pid)) return;
      if (a[pid] == null) added.push({ pid: pid, name: nameOf(pid), day: b[pid] });
      else if (a[pid] !== b[pid]) moved.push({ pid: pid, name: nameOf(pid), from: a[pid], to: b[pid] });
    });
    Object.keys(a).forEach(function (pid) {
      if (b[pid] != null || isTown(pid)) return;
      var why = E.misfit(S1, PL[pid]);
      var un = (plan.unfit || []).find(function (u) { return u.pid === pid; });
      removed.push({ pid: pid, name: nameOf(pid), day: a[pid], reason: why.length ? plain(why) : (un ? un.reason : 'No room at the new pace') });
    });
    var kept = { locked: 0, placed: 0 };
    plan.days.forEach(function (d) { d.items.forEach(function (it) { if (it.locked) kept.locked++; else if (it.placed) kept.placed++; }); });
    var e0 = E.eff(S0), e1 = E.eff(S1);
    var have = {};
    (after.bookings || []).forEach(function (bk) { have[bk.label] = true; });
    var bookings = built.bookings.filter(function (bk) { return !have[bk.label] && added.some(function (x) { return bk.label.indexOf(x.name) >= 0; }); });
    return {
      ok: true, bases: plan.bases.map(function (x) { return x.name; }), days: days, bookings: bookings, kept: kept,
      diff: { moved: moved, added: added, removed: removed },
      pace: { before: PACE_LABEL(e0.pace), after: PACE_LABEL(e1.pace) },
      drive: { before: e0.driveDay, after: e1.driveDay },
      nothing: !moved.length && !added.length && !removed.length && e0.pace === e1.pace && e0.driveDay === e1.driveDay
    };
  }

  /* ---------- seeds: the engine builds them, with the builder's date model ---------- */
  var EXTRA_CHECK = {
    weekend: [['Health cards and insurance', true, 'Documents'], ['Bug spray', false, 'Packing'], ['Rain jackets', false, 'Packing'], ['Snacks for the drives', false, 'Kids']],
    weekair: [['Passports valid 6 months past return', true, 'Documents'], ['International driving permit', false, 'Documents'], ['Travel insurance, with hiking cover', false, 'Documents'],
      ['Plug adapters (type F/L)', false, 'Documents'], ['Rain jackets', false, 'Packing'], ['Trekking poles', false, 'Packing'], ['Snacks for the drives', false, 'Kids']],
    long: [['Discovery Pass printed', true, 'Documents'], ['Bear spray', true, 'Packing'], ['Layers for cold mornings', true, 'Packing']]
  };
  function lockItems(S, pids) { S.plan.days.forEach(function (d) { d.items.forEach(function (it) { if (pids.indexOf(it.pid) >= 0) it.locked = true; }); }); }
  function seedOne(kind, over, o) {
    var S = blank(kind, over);
    if (o && o.mark) Object.keys(o.mark).forEach(function (k) { S.must[k] = true; });
    S.plan = E.build(S);
    E.fillFree(S, S.plan);
    if (o && o.lock) lockItems(S, o.lock);
    var t = E.toTrip(S);
    t.days.forEach(function (d) { d.label = d.label.replace(/^Day \d+ \u00b7 /, ''); });
    t.dates = D.fromWhen(S.when);
    t.nights = S.nights;
    t.checklist = (EXTRA_CHECK[o.check] || []).map(function (c) { return { label: c[0], done: c[1], group: c[2] }; });
    t.bookings = (o.extraBookings || []).concat(t.bookings.map(function (b) { return Object.assign({ kind: 'activity' }, b, { link: b.link && b.link !== '#' ? b.link : 'https://example.org/' }); }));
    t.notes = o.notes || '';
    (o.flag || []).forEach(function (f) { t.days.forEach(function (d) { d.items.forEach(function (it) { if (it.id === f[0]) it[f[1]] = true; }); }); });
    t.gettingThere = Object.assign({}, t.gettingThere);
    if (kind === 'weekair') t.gettingThere.country = 'Italy';
    return t;
  }
  function seedTrips() {
    var adult = function (n) { return { id: 0, name: n, type: 'adult', needs: [] }; };
    var A = seedOne('weekend', {
      id: 't-algonquin', title: 'Algonquin weekend from Toronto', identity: 'var(--id-blue)',
      party: [adult('Nitin'), adult('Asha'), { id: 3, name: 'Mira', type: 'child', age: 6, needs: [] }],
      when: { type: 'next' }, picks: ['huntsville', 'algonquin', 'arrowhead', 'lookout-trail', 'spruce-bog'], stay: { huntsville: true }, nights: 2
    }, { check: 'weekend', flag: [['spruce-bog', 'stale']], mark: { 'lookout-trail': true },
      extraBookings: [{ label: 'Campsite at Lake of Two Rivers', by: '155d', link: 'https://reservations.ontarioparks.ca/', done: false, kind: 'stay', rule: 'Opens 5 months ahead, fills fast' }] });
    var B = seedOne('weekair', {
      id: 't-dolomites', title: 'Dolomites · 10 days', identity: 'var(--id-orange)',
      party: [adult('Nitin'), adult('Asha'), { id: 3, name: 'Mira', type: 'child', age: 9, needs: [] }],
      when: { type: 'dates', from: '2027-07-13', to: '2027-07-22' }, picks: ['ortisei', 'cortina', 'seceda', 'siusi', 'braies', 'funes', 'tre-cime', 'carezza', 'gherdeina', 'cinque'],
      stay: { ortisei: true, cortina: true }, nights: 9, cc: 'IT', regions: ['dolomites'], airFrom: 'YYZ', arrive: 'VCE', leave: 'VCE'
    }, { check: 'weekair', lock: ['seceda', 'tre-cime'], mark: { seceda: true, 'tre-cime': true }, flag: [['gherdeina', 'priv'], ['funes', 'priv'], ['cinque', 'stale']],
      notes: 'Ask Asha about the museum day if the weather turns.',
      extraBookings: [{ label: 'Flights YYZ to Venice', by: '330d', link: 'https://www.aircanada.com/', done: true, kind: 'flight', rule: 'Fares rise 5 months out' },
        { label: 'Ortisei apartment, 5 nights', by: '120d', link: 'https://www.booking.com/', done: true, kind: 'stay' },
        { label: 'Hire car with child seat', by: '90d', link: 'https://www.rentalcars.com/', done: false, kind: 'car' }] });
    var C = seedOne('long', {
      id: 't-banff', title: 'Banff long weekend', identity: 'var(--id-rose)', origin: CITIES.find(function (c) { return c.id === 'calgary'; }),
      party: [adult('Nitin'), adult('Asha')], when: { type: 'dates', from: '2026-09-04', to: '2026-09-07' },
      picks: ['banff-town', 'lake-louise', 'moraine-lake', 'johnston-canyon', 'bow-falls'], nights: 3, cc: 'CA', regions: ['rockies']
    }, { check: 'long', notes: 'Johnston Canyon: the lower falls were busy, go before 09:00.',
      extraBookings: [{ label: 'Tunnel Mountain campsite', by: '150d', link: 'https://reservation.pc.gc.ca/', done: true, kind: 'stay' }] });
    C.bookings.forEach(function (b) { b.done = true; });
    return [A, B, C];
  }

  window.PEngine = { stateOf: stateOf, propose: propose, canReflow: function (t) { return known(t) > 0; }, seedTrips: seedTrips, blank: blank };
})();
