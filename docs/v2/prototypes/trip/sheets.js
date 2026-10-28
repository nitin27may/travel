/* THROWAWAY prototype: the markup of every sheet and menu on the trip page (item sheet, Move to day, add picker, Settings,
   changes, menus, drop day, versions, note, confirms). Pure functions of the trip and the sheet's own state; trip.js owns the
   state and the actions (data-a attributes). Needs: doc.js (TripDoc), ours.js, builder/data.js (PL, PLACES), shared/engine.js. */
(function () {
  'use strict';
  var D = window.TripDoc, O = window.OURS, E = window.ProtoEngine;
  var ADD_NEARBY_KM = 30, PICK_PAGE = 12;                  // the product reads these from core/src/config/nearby.ts and PAGE_SIZE.list
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ic = function () { return window.TripApp.ic.apply(null, arguments); };
  var KINDS = { town: 'Town', sight: 'Sight', hike: 'Hike', activity: 'Activity', park: 'Park' };

  function dayLine(T, n) {
    var d = T.days[n - 1], date = D.dateOf(T, n), st = D.stats(T, n - 1);
    return 'Base: ' + esc(d.base) + ' · ' + E.fd(Math.max(0, st.free)) + ' free' + (date ? ' · ' + D.fmtDate(date) : '');
  }
  function chipFor(f) {
    if (f.fix) return '<span class="chip crit">' + ic('alert') + 'Fix: ' + esc(f.fix.text.replace(/^.* is /, '')) + '</span>';
    if (f.over || f.tight) return '<span class="chip warn">Tight</span>';
    return '<span class="chip">Fits</span>';
  }
  function head(id, title, meta, extra) {
    return '<header><h2 id="' + id + '">' + title + (meta ? '<span class="meta">' + meta + '</span>' : '') + '</h2>' + (extra || '') +
      '<button class="icon-btn" data-a="closesheet" data-k="sx" aria-label="Close">' + ic('x') + '</button></header>';
  }
  function bearing(a, b) {
    var y = b.lon - a.lon, x = b.lat - a.lat, ang = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(ang / 45) % 8];
  }

  /* ---- the stop's actions: a bottom sheet on a phone, a popover on a desktop (spec 5) ---- */
  function item(T, s) {
    var loc = D.locate(T, s.id); if (!loc) return '';
    var built = D.modeOf(T) === 'built', it = loc.it, n = loc.n, last = loc.day.items.length - 1, p = PL[it.id];
    var marks = D.marksOf(T, it, loc.di), extra = marks.slice(2);
    var row = function (a, label, o) {
      o = o || {};
      return '<button class="mrow' + (o.danger ? ' danger' : '') + '" data-a="' + a + '" data-id="' + esc(it.id) + '"' + (o.dis ? ' disabled' : '') + (o.sw != null ? ' role="switch" aria-checked="' + o.sw + '"' : '') + ' data-k="r-' + a + '"><span class="tx"><span class="nm">' + label + '</span>' +
        (o.sub ? '<span class="meta">' + o.sub + '</span>' : '') + '</span>' + (o.sw != null ? '<span class="sw" aria-hidden="true"></span>' : o.chev === false ? '' : ic('chev')) + '</button>';
    };
    var h = head('sh-t', esc(it.name), 'Day ' + n + ' · ' + it.time + (extra.length ? ' · ' + extra.map(esc).join(' · ') : ''));
    var body = row('openmove', 'Move to day…') +
      '<div class="pair"><button class="mrow" data-a="up" data-id="' + esc(it.id) + '"' + (loc.j === 0 ? ' disabled' : '') + '><span class="tx"><span class="nm">Move up</span></span></button>' +
      '<button class="mrow" data-a="down" data-id="' + esc(it.id) + '"' + (loc.j === last ? ' disabled' : '') + '><span class="tx"><span class="nm">Move down</span></span></button></div>' +
      row('openswap', 'Swap with…') + row('openswapnear', 'Swap for a nearby place');
    if (!built) body += row('maybe', 'Add to Maybe', { chev: false });
    else {
      var kept = it.locked || it.placed;
      body += row('keep', 'Keep on Day ' + n, { sw: kept, sub: kept ? 'On because you placed it. Turn off to let the plan move it.' : 'Off. The plan can move it.' }) +
        row('must', 'Must see', { sw: !!it.mustSee });
    }
    body += row('opennote', it.note ? 'Edit note' : 'Add a note', { chev: false });
    body += p && p.park ? '<a class="mrow" href="/parks-app/park.html?slug=' + esc(p.park) + '"><span class="tx"><span class="nm">Open place page</span></span>' + ic('chev') + '</a>'
      : '<button class="mrow" disabled><span class="tx"><span class="nm">Open place page</span><span class="meta">No place page yet</span></span></button>';
    body += row('remove', 'Remove from Day ' + n, { danger: true, chev: false });
    return h + '<div class="sb">' + body + '</div>';
  }

  /* ---- Move to day: one row per day with base, free time, driving change and a fit chip (spec 5.1) ---- */
  function move(T, s) {
    var loc = D.locate(T, s.id); if (!loc) return '';
    var h = head('sh-t', 'Move ' + esc(loc.it.name), 'Now on Day ' + loc.n);
    var rows = T.days.map(function (d) {
      var date = D.dateOf(T, d.n);
      if (d.n === loc.n) return '<button class="mrow" disabled><span class="tx"><span class="nm">Day ' + d.n + (date ? ' · ' + D.fmtDate(date) : '') + '</span><span class="meta">Now on Day ' + d.n + '</span></span></button>';
      var f = D.fitsIf(T, s.id, d.n), delta = f.addDrive;
      return '<button class="mrow" data-a="movedo" data-id="' + esc(s.id) + '" data-n="' + d.n + '" data-k="mv-' + d.n + '"><span class="tx"><span class="nm">Day ' + d.n + (date ? ' · ' + D.fmtDate(date) : '') +
        (/ \(added\)$/.test(d.label) ? ' (added)' : '') + '</span><span class="meta">Base: ' + esc(d.base) + ' · ' + E.fd(f.free) + ' free · ' + (delta >= 0 ? '+' : '−') + E.fd(Math.abs(delta)) + ' driving ≈</span>' +
        (f.fix ? '<span class="meta" style="color:var(--crit)">' + esc(f.fix.text) + '</span>' : '') + '</span>' + chipFor(f) + '</button>';
    }).join('');
    return h + '<div class="sb">' + rows + '</div>';
  }

  function swapWith(T, s) {
    var loc = D.locate(T, s.id); if (!loc) return '';
    var rows = [];
    T.days.forEach(function (d) { d.items.forEach(function (x) { if (x.id !== s.id) rows.push('<button class="mrow" data-a="swapdo" data-id="' + esc(s.id) + '" data-with="' + esc(x.id) + '"><span class="tx"><span class="nm">' + esc(x.name) + '</span><span class="meta">Day ' + d.n + ' · ' + x.time + '</span></span></button>'); }); });
    return head('sh-t', 'Swap ' + esc(loc.it.name) + ' with…', 'Both stops change places') + '<div class="sb">' + rows.join('') + '</div>';
  }

  /* ---- the add picker (spec 7): one picker for Add a place, Swap for a nearby place, Save to a trip ---- */
  function onTrip(T, id) { return D.locate(T, id); }
  function pickRow(T, s, id, why, forceAdd) {
    var p = PL[id]; if (!p) return '';
    var n = s.n, here = onTrip(T, id), f = D.fitsIf(T, id, n), line;
    if (s.added && s.added[id]) return '<div class="prow"><span class="glyph">' + ic(p.type) + '</span><div class="tx"><div class="nm">' + esc(p.name) + '</div><div class="l2">Added to Day ' + n + '</div></div><button class="btn sm" data-a="undo" data-k="pu-' + esc(id) + '">Undo</button></div>';
    if (f.fix) line = '<div class="l2 f">' + esc(f.fix.text) + '</div>';
    else if (f.over) line = '<div class="l2">Day full: try another day</div>';
    else line = '<div class="l2">' + (f.after ? 'fits after ' + esc(f.after) + ' · ' : '') + (f.addDrive >= 0 ? '+' : '−') + E.fd(Math.abs(f.addDrive)) + ' ≈ · ends ' + f.ends + (why ? ' · ' + why : '') + '</div>';
    var label = s.mode === 'swap' ? 'Swap' : here ? 'Move here' : 'Add';
    return '<div class="prow"><span class="glyph">' + ic(p.type) + '</span><div class="tx"><div class="nm">' + esc(p.name) + ' ' + chipFor(f) + '</div>' + (here ? '<div class="l2">On Day ' + here.n + '</div>' : '') + line +
      '</div><button class="btn sm" data-a="padd" data-id="' + esc(id) + '" data-k="pa-' + esc(id) + '" aria-label="' + label + ' ' + esc(p.name) + (s.mode === 'swap' ? '' : ' to Day ' + n) + '">' + label + '</button></div>';
  }
  function groups(T, s) {
    var off = function (id) { return !onTrip(T, id) || (s.added && s.added[id]); };
    var d = T.days[s.n - 1], e = D.ed(T), key = e.keys[s.n - 1], base = D.pt(d.base), g = [], seen = {}, q = (s.q || '').trim().toLowerCase();
    var month = ProtoContract.monthOf(T), young = T.party.filter(function (x) { return x.type !== 'adult'; }).map(function (x) { return x.type === 'infant' ? 0 : x.age; });
    function ok(id) {
      var p = PL[id]; if (!p) return false;
      if (s.filt.rain && !p.in) return false;
      if (s.filt.kids && young.length && p.kids > Math.min.apply(null, young)) return false;
      if (s.filt.open && month && p.cl && p.cl.indexOf(month) >= 0) return false;
      return true;
    }
    function add(title, ids, why) { ids = ids.filter(function (id) { if (!ok(id)) return false; return true; }); if (ids.length) g.push({ title: title, ids: ids, why: why || {} }); }
    if (s.mode !== 'swap') {
      var od = O.days.find(function (x) { return x.key === key; });
      if (od && od.v && e.source) {
        var cur = (e.variantNow || {})[key], ids = [], why = {};
        Object.keys(od.v).forEach(function (L) { if (L !== cur) od.v[L].forEach(function (id) { if (off(id) && ids.indexOf(id) < 0) { ids.push(id); why[id] = 'version ' + L; } }); });
        add('From the other versions of this day', ids, why);
      }
      add('Removed from this day', e.removed.filter(function (x) { return x.day === key && off(x.id); }).map(function (x) { return x.id; }));
      add('Maybe', e.maybe.filter(function (id) { return off(id); }));
      add('Your picks not on a day', e.unfit.filter(function (id) { return off(id); }));
      var els = [], why2 = {};
      T.days.forEach(function (x) { if (x.n !== s.n && x.base === d.base) x.items.forEach(function (it) { els.push(it.id); why2[it.id] = 'also on Day ' + x.n; }); });
      add('Elsewhere on this trip, near here', els, why2);
    }
    if (base && !s.offline) {
      var near = PLACES.filter(function (p) { return p.type !== 'town' && off(p.id) && E.hav(base, p) <= ADD_NEARBY_KM; }).sort(function (a, b) { return E.hav(base, a) - E.hav(base, b); });
      var why3 = {}; near.forEach(function (p) { var km = Math.round(E.hav(base, p)); why3[p.id] = km + ' km ' + bearing(base, p) + ' · ' + E.fd(E.drive(base, p)) + ' ≈'; });
      add('Within ' + ADD_NEARBY_KM + ' km, with a place page', near.map(function (p) { return p.id; }), why3);
    }
    if (q) {
      var hits = PLACES.filter(function (p) { return p.type !== 'town' && p.name.toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return base ? E.hav(base, a) - E.hav(base, b) : 0; });
      g = [{ title: 'Search results', ids: hits.map(function (p) { return p.id; }), why: {} }];
    }
    return g.filter(function (x) { x.ids = x.ids.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; }); return x.ids.length; });
  }
  function add(T, s) {
    var d = T.days[s.n - 1], title = s.pin && !s.pin.missing ? 'Add ' + esc(s.pin.name) : s.mode === 'swap' ? 'Swap ' + esc(PL[s.from].name) + ' for a nearby place' : 'Add a place to Day ' + s.n;
    var h = head('sh-t', title, dayLine(T, s.n));
    var pills = [['rain', 'Rainy day'], ['kids', 'Kids'], ['open', 'Open in ' + (D.MONFULL[(ProtoContract.monthOf(T) || 1) - 1])]].map(function (p) {
      return '<button class="pill" data-a="pfilt" data-f="' + p[0] + '" aria-pressed="' + !!s.filt[p[0]] + '" data-k="pf-' + p[0] + '">' + esc(p[1]) + '</button>';
    }).join('');
    var body = '<div class="fld"><label for="pq">Search places</label><input type="search" id="pq" data-k="pq" value="' + esc(s.q || '') + '" placeholder="Search places"></div><div class="row" style="margin-bottom:8px">' + pills + '</div>';
    if (s.offline) body += '<p class="small" style="margin:8px 0">Nearby places and search need a connection.</p>';
    if (s.pin) body += pinned(T, s);
    var gs = s.pin && !(s.q || '').trim() ? [] : groups(T, s), total = 0;
    if (!gs.length && !s.pin) body += '<p class="small" style="margin-top:12px">Nothing we hold near ' + esc(d.base) + ' fits. Try search or another day.</p>';
    gs.forEach(function (gr, gi) {
      var lim = (s.more && s.more[gi]) || PICK_PAGE, shown = gr.ids.slice(0, lim);
      body += '<div class="grp">' + esc(gr.title) + '</div>' + shown.map(function (id) { return pickRow(T, s, id, gr.why[id]); }).join('');
      if (gr.ids.length > lim) body += '<button class="btn sm" data-a="pmore" data-g="' + gi + '">Show ' + Math.min(PICK_PAGE, gr.ids.length - lim) + ' more</button>';
      total += gr.ids.length;
    });
    return h + '<div class="sb">' + body + '</div>';
  }
  /* arriving with a place or a park (add=<slug>, spec 7.4) */
  function pinned(T, s) {
    var pin = s.pin;
    if (pin.missing) return '<div class="note warn"><span class="tx">We do not have this place any more.</span></div>';
    if (pin.park) {
      var mem = PLACES.filter(function (p) { return p.park === pin.park; });
      return '<div class="grp">In ' + esc(pin.name) + '</div>' + mem.map(function (p) { return pickRow(T, s, p.id, ''); }).join('');
    }
    var rows = D.bestDays(T, pin.id).map(function (b) {
      var f = b.f, d = T.days[b.n - 1], added = s.addedDay === b.n;
      return '<div class="prow"><div class="tx"><div class="nm">Day ' + b.n + ' · ' + esc(d.base) + ' ' + chipFor(f) + '</div><div class="l2">' + (f.fix ? esc(f.fix.text) : (f.after ? 'fits after ' + esc(f.after) + ' · ' : '') + (f.addDrive >= 0 ? '+' : '−') + E.fd(Math.abs(f.addDrive)) + ' ≈') + '</div></div>' +
        (added ? '<button class="btn sm" data-a="undo">Added · Undo</button>' : '<button class="btn sm" data-a="pinadd" data-n="' + b.n + '" data-k="pn-' + b.n + '" aria-label="Add to Day ' + b.n + '">Add to Day ' + b.n + '</button>') + '</div>';
    }).join('');
    return '<div class="grp">' + esc(PL[pin.id].name) + '</div>' + (onTrip(T, pin.id) ? '<p class="small">On Day ' + onTrip(T, pin.id).n + ' already.</p>' : '') + rows;
  }

  /* ---- Settings (spec 8): one sheet, one Apply that states its effect ---- */
  function settings(T, s) {
    var built = D.modeOf(T) === 'built', e = D.ed(T), dr = s.draft, kids = dr.party.filter(function (p) { return p.type !== 'adult'; });
    var adults = dr.party.length - kids.length;
    var h = head('sh-t', 'Settings', esc(T.title));
    var b = '<div class="fld"><label for="st-title">Trip title</label><input type="text" id="st-title" data-i="title" value="' + esc(dr.title) + '" data-k="st-title"></div>';
    b += '<div class="fld"><label for="st-date">Start date</label><input type="date" id="st-date" data-i="from" value="' + esc(dr.from || '') + '"' + (dr.noDate ? ' disabled' : '') + ' data-k="st-date">' +
      '<label class="row" style="gap:8px"><input type="checkbox" data-i="nodate"' + (dr.noDate ? ' checked' : '') + '> No date yet</label></div>';
    b += '<div class="grp" style="margin-top:0">Who is going</div><div class="step" style="margin-bottom:8px"><span class="lbl" style="flex:1">Adults</span><button class="icon-btn" data-a="stepadult" data-d="-1" aria-label="One fewer adult"' + (adults <= 1 ? ' disabled' : '') + '>−</button><b aria-live="polite">' + adults + '</b><button class="icon-btn" data-a="stepadult" data-d="1" aria-label="One more adult">+</button></div>';
    kids.forEach(function (k, i) {
      b += '<div class="step" style="margin-bottom:8px"><label class="lbl" style="flex:1" for="kid' + i + '">Child ' + (i + 1) + ' age</label><select id="kid' + i + '" data-i="age" data-idx="' + i + '" style="width:90px">' +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(function (a) { return '<option value="' + a + '"' + (k.age === a ? ' selected' : '') + '>' + (a || 'Under 1') + '</option>'; }).join('') +
        '</select><button class="icon-btn" data-a="rmkid" data-idx="' + i + '" aria-label="Remove child ' + (i + 1) + '">' + ic('x') + '</button></div>';
    });
    b += '<div class="row" style="margin-bottom:12px"><button class="btn sm" data-a="addkid">Add a child</button><button class="btn sm ghost" data-a="mytrav">Use my travellers</button></div>';
    b += '<div class="fld"><label for="st-pace">Pace</label><select id="st-pace" data-i="pace">' + Object.keys(D.PACES).map(function (k) { return '<option value="' + k + '"' + (dr.pace === k ? ' selected' : '') + '>' + D.PACES[k].l + ' (' + E.fd(D.PACES[k].drive) + ' driving a day)</option>'; }).join('') + '</select></div>';
    b += '<div class="effect" id="effect" role="status">' + effect(T, dr) + '</div>';
    if (!built) {
      b += '<div class="grp">Make it yours</div><button class="mrow" data-a="addpickday" data-n="1"><span class="tx"><span class="nm">Change places</span><span class="meta">Opens the add picker on Day 1</span></span>' + ic('chev') + '</button>' +
        engineRows(T, s, true);
      if (s.convert) b += convertNotice(T);
    } else {
      b += '<div class="grp">Your trip' + (e.converted ? ', from our ' + esc(O.name) + ' trip' : '') + '</div>' + engineRows(T, s, false) +
        '<button class="mrow" data-a="rebuild"><span class="tx"><span class="nm">Rebuild</span><span class="meta">Rebuild ' + T.days.length + ' days · ' + T.days.reduce(function (n, d) { return n + d.items.filter(function (i) { return i.placed || i.locked; }).length; }, 0) + ' kept stay</span></span></button>';
    }
    b += '<p class="meta" style="margin-top:16px">' + (s.signed ? 'In your account. Changes sync in the background.' : 'Kept in this browser. Sign in to keep it on every device.') + '</p>';
    return h + '<div class="sb">' + b + '</div><footer><button class="btn" data-a="closesheet">Cancel</button><button class="btn pri" data-a="apply" data-k="apply">Apply</button></footer>';
  }
  function engineRows(T, s, gate) {
    var e = D.ed(T);
    return [['Where you start', T.start.city], ['Where', O.name + ' (Dolomites)'], ['Days and driving', E.fd(D.limitOf(T)) + ' a day'], ['Bases', T.days.reduce(function (a, d) { if (a.indexOf(d.base) < 0) a.push(d.base); return a; }, []).join(', ')], ['Getting there', T.gettingThere.from || '']]
      .map(function (r) {
        return gate ? '<button class="mrow" data-a="engine" data-v="' + esc(r[0]) + '"><span class="tx"><span class="nm">' + r[0] + '</span><span class="meta">' + esc(r[1]) + '</span></span>' + ic('chev') + '</button>'
          : '<a class="mrow" href="/builder/index.html?edit=' + esc(T.id) + '"><span class="tx"><span class="nm">' + r[0] + '</span><span class="meta">' + esc(r[1]) + '</span></span>' + ic('chev') + '</a>';
      }).join('');
  }
  function convertNotice(T) {
    return '<div class="note card" id="convertnotice" role="group" aria-label="Make it your own trip"><span class="tx"><b>This makes it your own trip.</b> Our later updates to the ' + esc(O.name) + ' trip will no longer change it. You can undo this until you leave the page.</span>' +
      '<span class="row"><button class="btn pri sm" data-a="convertgo" data-k="convertgo">Continue</button><button class="btn sm" data-a="convertcancel">Cancel</button></span></div>';
  }
  function effect(T, dr) {
    var parts = [], e = D.ed(T);
    var party = dr.party, same = JSON.stringify(party) === JSON.stringify(T.party) && dr.pace === e.pace;
    if (dr.from && dr.from !== (T.dates && T.dates.from)) parts.push('Days relabel from ' + D.fmtDate(dr.from) + '. Closures, sun times and book-by dates re-check; no stop moves.');
    if (dr.noDate && T.dates && T.dates.from) parts.push('Days show numbers only. Book-by dates need a start date.');
    if (!same) {
      var pv = D.previewParty(T, party, dr.pace);
      if (D.modeOf(T) === 'template') parts.push((pv.variants.length ? pv.variants.join('; ') + '. ' : 'Our days stay as they are. ') + (pv.over ? pv.over + ' day' + (pv.over === 1 ? '' : 's') + ' to check at this pace.' : 'Nothing to check.'));
      else parts.push('Fit and pace re-check at once' + (pv.over ? ': ' + pv.over + ' day' + (pv.over === 1 ? '' : 's') + ' to check' : '') + '. Nothing moves until you rebuild.');
    }
    return parts.length ? esc(parts.join(' ')) : 'Nothing to apply yet.';
  }

  /* ---- Changes from our plan (spec 10) ---- */
  function changes(T) {
    var list = D.changes(T), e = D.ed(T);
    var rows = list.length ? list.map(function (c) {
      return '<div class="srow"><div class="tx"><div class="nm">' + esc(c.text) + '</div></div><button class="btn sm" data-a="restore" data-oid="' + esc(c.oid) + '" aria-label="Restore: ' + esc(c.text) + '" data-k="rs-' + esc(c.oid) + '">Restore</button></div>';
    }).join('') : '<p class="small">No changes. This is our plan.</p>';
    return head('sh-t', 'Changes from our plan', list.length + ' change' + (list.length === 1 ? '' : 's') + ', newest first') +
      '<div class="sb"><p class="small" style="margin-bottom:8px"><a href="/index.html" target="_blank" rel="noopener">Open our ' + esc(O.name) + ' trip<span class="sr"> (opens in a new tab)</span></a></p>' + rows + '</div>';
  }

  /* ---- menus ---- */
  function m(a, label, o) {
    o = o || {};
    return '<button class="mrow' + (o.danger ? ' danger' : '') + '" data-a="' + a + '"' + (o.n ? ' data-n="' + o.n + '"' : '') + (o.dis ? ' disabled' : '') + ' data-k="m-' + a + '"><span class="tx"><span class="nm">' + label + '</span></span></button>';
  }
  function tripMenu(T, s, canUndo, canRedo) {
    var tpl = D.modeOf(T) === 'template';
    return head('sh-t', 'Trip actions', esc(T.title)) + '<div class="sb">' + m('undo', 'Undo', { dis: !canUndo }) + m('redo', 'Redo', { dis: !canRedo }) +
      (tpl ? m('makeit', 'Make it yours') : m('rebuild', 'Rebuild')) + (tpl ? m('resetall', 'Reset to our plan') : '') +
      m('ics', T.dates && T.dates.from ? 'Add to calendar' : 'Add dates') + '<a class="mrow" href="/planner/print.html?id=' + esc(T.id) + '"><span class="tx"><span class="nm">Print</span></span></a>' + m('removetrip', 'Remove from My trips', { danger: true }) + '</div>';
  }
  function dayMenu(T, s) {
    var n = s.n, d = T.days[n - 1], e = D.ed(T), tpl = e.mode === 'template', key = e.keys[n - 1], od = O.days.find(function (x) { return x.key === key; });
    return head('sh-t', 'Day ' + n, esc(d.base)) + '<div class="sb">' + m('insertday', 'Add a day after Day ' + n, { n: n }) + m('dropday', 'Drop Day ' + n, { n: n, dis: T.days.length < 2 }) +
      (tpl ? m('resetday', 'Reset Day ' + n, { n: n }) : '') + m('daynote', d.notes ? 'Edit note on Day ' + n : 'Add a note', { n: n }) +
      (tpl && od && od.v ? m('versions', 'Version of Day ' + n, { n: n }) : '') +
      (!tpl ? '<button class="mrow" data-a="daymove" data-n="' + n + '" data-d="-1"' + (n === 1 ? ' disabled' : '') + '><span class="tx"><span class="nm">Move Day ' + n + ' earlier</span></span></button>' + '<button class="mrow" data-a="daymove" data-n="' + n + '" data-d="1"' + (n === T.days.length ? ' disabled' : '') + '><span class="tx"><span class="nm">Move Day ' + n + ' later</span></span></button>' : '') + '</div>';
  }
  function dropDay(T, s) {
    var n = s.n, d = T.days[n - 1], cnt = d.items.length, to = s.to || 'day', tgt = n > 1 ? n - 1 : n + 1;
    var book = d.items.map(function (i) { return PL[i.id] && PL[i.id].bk ? PL[i.id].bk[0] : null; }).filter(Boolean)[0];
    var opt = function (v, label) { return '<button class="mrow" data-a="dropto" data-v="' + v + '" aria-pressed="' + (to === v) + '"><span class="tx"><span class="nm">' + label + '</span></span><span aria-hidden="true">' + (to === v ? '●' : '○') + '</span></button>'; };
    var b = cnt ? '<p class="small" style="margin-bottom:8px">Drop Day ' + n + ': its ' + cnt + ' stop' + (cnt === 1 ? '' : 's') + '</p>' + opt('day', 'Move to Day ' + (n > 1 ? n - 1 : 2)) + opt('maybe', 'Go to Maybe') + opt('remove', 'Are removed')
      : '<p class="small">Day ' + n + ' has no stops.</p>';
    if (book) b += '<div class="note warn" style="margin-top:8px"><span class="tx">Drop Day ' + n + ' and its ' + esc(book.toLowerCase()) + ' booking?</span></div>';
    return head('sh-t', 'Drop Day ' + n, esc(d.base)) + '<div class="sb">' + b + '</div><footer><button class="btn" data-a="closesheet" data-k="cancel">Cancel</button><button class="btn danger" data-a="dropgo" data-k="dropgo">Drop Day ' + n + '</button></footer>';
  }
  function versions(T, s) {
    var e = D.ed(T), key = e.keys[s.n - 1], od = O.days.find(function (x) { return x.key === key; }), cur = (e.variantNow || {})[key];
    var rows = Object.keys(od.v).map(function (L) {
      return '<button class="mrow" data-a="setver" data-n="' + s.n + '" data-v="' + L + '" aria-pressed="' + (L === cur) + '"><span class="tx"><span class="nm">Version ' + L + (L === cur ? ' · now' : '') + '</span><span class="meta">' + esc(O.why[L]) + ': ' + od.v[L].map(function (id) { return esc(PL[id].name); }).join(', ') + '</span></span></button>';
    }).join('');
    return head('sh-t', 'Version of Day ' + s.n, esc(T.days[s.n - 1].base)) + '<div class="sb">' + rows + '</div>';
  }
  function note(T, s) {
    var cur = s.id ? D.locate(T, s.id).it.note : T.days[s.n - 1].notes;
    return head('sh-t', s.id ? 'Note on ' + esc(D.locate(T, s.id).it.name) : 'Note on Day ' + s.n, '') + '<div class="sb"><div class="fld"><label for="nt">Note</label><textarea id="nt" data-k="nt">' + esc(cur) + '</textarea></div></div><footer><button class="btn" data-a="closesheet">Cancel</button><button class="btn pri" data-a="notesave">Save note</button></footer>';
  }
  function confirmReset(T, s) {
    var c = D.changes(T).length;
    return head('sh-t', 'Reset to our plan?', '') + '<div class="sb"><p>Reset to our plan? Your ' + c + ' changes are removed. You can undo this until you leave the page.</p></div><footer><button class="btn" data-a="closesheet" data-k="cancel">Cancel</button><button class="btn danger" data-a="resetgo">Reset</button></footer>';
  }
  function confirmRemove(T) {
    return head('sh-t', 'Remove from My trips?', '') + '<div class="sb"><p>' + esc(T.title) + ' is removed from this device. This cannot be undone here.</p></div><footer><button class="btn" data-a="closesheet" data-k="cancel">Cancel</button><button class="btn danger" data-a="removego">Remove</button></footer>';
  }

  window.TripSheets = {
    ADD_NEARBY_KM: ADD_NEARBY_KM, effect: effect,
    render: function (T, s, extra) {
      switch (s.type) {
        case 'item': return item(T, s);
        case 'move': return move(T, s);
        case 'swap': return swapWith(T, s);
        case 'add': return add(T, s);
        case 'settings': return settings(T, s);
        case 'changes': return changes(T);
        case 'trip': return tripMenu(T, s, extra.canUndo, extra.canRedo);
        case 'day': return dayMenu(T, s);
        case 'dropday': return dropDay(T, s);
        case 'versions': return versions(T, s);
        case 'note': return note(T, s);
        case 'confirmreset': return confirmReset(T, s);
        case 'confirmremove': return confirmRemove(T);
      }
      return '';
    },
    kinds: { item: 'menu', move: 'mid', swap: 'mid', add: 'side', settings: 'side', changes: 'side', trip: 'menu', day: 'menu', dropday: 'mid', versions: 'mid', note: 'mid', confirmreset: 'mid', confirmremove: 'mid' },
    fullOnPhone: { add: 1, settings: 1, changes: 1 }
  };
})();
