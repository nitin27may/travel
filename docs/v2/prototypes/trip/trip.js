/* THROWAWAY prototype: the trip details page at /trip/?id=<id>[&edit=1][&view=day]. Read mode and edit mode are one page
   (edit-mode-spec 1): edit only adds controls. State lives in `T` (a ProtoContract trip, see doc.js), the undo stack in
   sessionStorage. Sheets are drawn by sheets.js. Deep links for every frame of spec 17 are listed in frames.html.
   Needs: doc.js, sheets.js, ours.js, shared/{contract,engine,map,ics}.js, builder/data.js. */
(function () {
  'use strict';
  var D = window.TripDoc, S = window.TripSheets, E = window.ProtoEngine, C = window.ProtoContract, O = window.OURS;
  /* The product keeps these in web/lib/config/product.ts (TRIP_EDIT_UI, TOAST_TIMES) and core/src/config/plans.ts (PLAN_EDIT). */
  var LONG_PRESS_MS = 300, DRAG_PX_HANDLE = 4, DRAG_PX_ROW = 8, EDGE_PX = 64, TOAST_UNDO_MS = 6000, TOAST_MS = 4000, UNDO_STEPS = 50, RESET_CONFIRM_OVER = 3, SYNC_DELAY_MS = 1000, PHONE_PX = 700;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var IC = {
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    grip: '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>',
    undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>', chev: '<path d="m9 6 6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9z"/>',
    town: '<path d="M4 20V10l5-4 5 4v10M14 20v-7h6v7M2 20h20"/>', sight: '<path d="M3 20h18M5 20V9h14v11M9 9V5h6v4M10 20v-5h4v5"/>', hike: '<path d="M3 20 10 7l4 7 2-3 5 9z"/>',
    activity: '<circle cx="12" cy="12" r="8"/><path d="m10 8 6 4-6 4z"/>', park: '<path d="M12 3 6 13h4l-3 5h10l-3-5h4zM12 18v3"/>'
  };
  function ic(n, c) { return '<svg class="ic ' + (c || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[n] || IC.sight) + '</svg>'; }
  window.TripApp = { ic: ic };

  var Q = new URLSearchParams(location.search);
  var T = null, TID = null, stack = { past: [], future: [] };
  var U = { edit: false, tab: 'summary', sheet: null, sync: 'device', syncTmp: null, offline: false, lift: null, makeit: false, built: false, checks: {}, ctl: false, openDay: 1, state: null, copied: false, mark: null };
  var toastTimer = null, syncTimer = null, drag = null, backKey = null, backEl = null;
  var phone = function () { return window.innerWidth < PHONE_PX; };

  /* ---------- storage and undo ---------- */
  function ukey() { return 'proto.trip.undo.' + TID; }
  function loadStack() { try { stack = JSON.parse(sessionStorage.getItem(ukey())) || { past: [], future: [] }; } catch (e) { stack = { past: [], future: [] }; } }
  function saveStack() { try { sessionStorage.setItem(ukey(), JSON.stringify(stack)); } catch (e) { /* storage blocked: the stack lasts for the page */ } }
  function persist() { if (!D.put(T)) toast('Could not save this trip on this device'); }
  function commit(fn, opt) {
    opt = opt || {};
    var snap = JSON.stringify(T), res = fn();
    if (!res) return null;
    if (res.none) { toast(res.msg); return res; }
    stack.past.push(snap); if (stack.past.length > UNDO_STEPS) stack.past.shift();
    stack.future = []; saveStack(); persist(); kickSync();
    if (!opt.quiet) toast(res.msg, true);
    say(res.live || res.msg);
    if (opt.keepSheet) { render(opt.focus); } else { render(opt.focus); }
    return res;
  }
  function undo() {
    if (!stack.past.length) return;
    stack.future.push(JSON.stringify(T)); T = JSON.parse(stack.past.pop()); saveStack(); persist(); kickSync(); say('Undone'); toast('Undone'); render();
  }
  function redo() {
    if (!stack.future.length) return;
    stack.past.push(JSON.stringify(T)); T = JSON.parse(stack.future.pop()); saveStack(); persist(); kickSync(); say('Redone'); toast('Redone'); render();
  }
  function kickSync() {
    if (U.sync !== 'account' || U.offline) return;
    U.syncTmp = 'syncing'; clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { U.syncTmp = null; paintSync(); }, SYNC_DELAY_MS);
  }
  function syncState() { if (U.syncTmp) return U.syncTmp; if (U.sync !== 'device' && U.offline) return 'pending'; return U.sync; }
  function syncHtml() {
    var s = syncState();
    if (s === 'syncing') return '<span class="sync" data-sync="syncing"><span class="spin" aria-hidden="true"></span>Syncing</span>';
    if (s === 'pending') return '<span class="sync" data-sync="pending">' + ic('cloud', 's') + 'Not synced yet</span>';
    if (s === 'failed') return '<span class="sync bad" data-sync="failed">' + ic('alert', 's') + '<button class="btn sm ghost" data-a="syncretry" data-k="retry" style="color:var(--warn)">Not synced · Retry</button></span>';
    if (s === 'account') return '<span class="sync" data-sync="account">' + ic('cloud', 's') + 'In your account</span>';
    return '<span class="sync" data-sync="device">On this device</span>';
  }
  function paintSync() { $$('.sync').forEach(function (n) { n.outerHTML = syncHtml(); }); }

  /* ---------- toast and live region ---------- */
  function toast(msg, withUndo) {
    var el = $('#toast'), can = withUndo && stack.past.length;
    el.innerHTML = '<span>' + esc(msg) + (can ? ' · ' : '') + '</span>' + (can ? '<button data-a="undo" data-k="toast-undo">Undo</button>' : '');
    el.classList.remove('off'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('off'); }, can ? TOAST_UNDO_MS : TOAST_MS);
  }
  function say(msg) { var l = $('#live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 20); }

  /* ---------- URL ---------- */
  function url(edit, view) {
    var p = new URLSearchParams(); p.set('id', TID); if (edit) p.set('edit', '1'); if (view) p.set('view', view);
    return location.pathname + '?' + p.toString();
  }
  function tabParam() { return { summary: null, days: 'day', stops: 'stops', bookings: 'bookings', photos: 'photos' }[U.tab]; }
  function readUrl() {
    var q = new URLSearchParams(location.search), v = q.get('view');
    U.edit = q.get('edit') === '1';
    U.tab = { day: 'days', days: 'days', stops: 'stops', bookings: 'bookings', photos: 'photos' }[v] || (U.edit ? 'days' : 'summary');
  }
  function setEdit(on) {
    if (on && !editable()) return;
    if (on && U.tab === 'summary') U.tab = 'days';
    U.edit = on; U.lift = null; U.sheet = null;
    history.pushState(null, '', url(on, tabParam()));
    say(on ? 'Editing ' + T.title : 'Done editing');
    render(on ? 'done' : 'edit');
  }
  function editable() { return !!T; }

  /* ---------- formatting ---------- */
  function dateText() {
    var d = T.dates || {};
    if (d.from) return D.fmtDate(d.from) + ' – ' + D.fmtDate(d.to || d.from) + ' ' + d.from.slice(0, 4);
    var m = C.monthOf(T); return m ? D.MONFULL[m - 1] : 'No date';
  }
  function dur(m) { return E.fd(m); }
  function dayColour(i) { return window.ProtoMap ? 'var(' + ProtoMap.DAY_COLOURS[i % ProtoMap.DAY_COLOURS.length] + ')' : 'var(--id-blue)'; }
  function mapsUrl(p, dir) { return 'https://www.google.com/maps/' + (dir ? 'dir/?api=1&destination=' : 'search/?api=1&query=') + p.lat + ',' + p.lon; }
  function isBuilt() { return D.modeOf(T) === 'built'; }

  /* ---------- render ---------- */
  function render(focusKey) {
    if (U.state === 'notfound' || !T) return renderNotFound();
    var y = window.scrollY, ae = document.activeElement, key = focusKey || (ae && ae.getAttribute && ae.getAttribute('data-k'));
    if (!focusKey && ae && ae.closest && ae.closest('.sheet')) key = null;
    renderHeader();
    $('#app').innerHTML = pageHtml();
    renderBar(); renderSheets(); renderCtl(); drawMap();
    window.scrollTo(0, y);
    if (key && !(U.sheet && !focusKey)) { var el = $('[data-k="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }
  }
  var NAV = [['Home', '/index.html'], ['Parks', '/parks-app/index.html'], ['Mine', '/planner/index.html'], ['Plan', '/builder/index.html']];
  function renderHeader() {
    $('#hdr').innerHTML = '<a class="brand" href="/index.html">Trip plans</a><nav aria-label="Main">' + NAV.map(function (n) { return '<a href="' + n[1] + '">' + n[0] + '</a>'; }).join('') + '</nav><span class="sp"></span><button class="hdr-btn" data-a="theme" aria-label="Switch theme">Theme</button>';
  }
  function renderBar() {
    var b = $('#bbar');
    if (U.edit) b.innerHTML = '<div class="editbar" role="toolbar" aria-label="Editing"><button class="btn" data-a="settings" data-k="settings-bar">' + ic('gear', 's') + ' Settings</button><button class="btn pri" data-a="done" data-k="done-bar">Done</button></div>';
    else b.innerHTML = '<nav class="bbar" aria-label="Main">' + NAV.map(function (n) { return '<a href="' + n[1] + '">' + n[0] + '</a>'; }).join('') + '</nav>';
  }
  function renderNotFound() {
    renderHeader(); $('#bbar').innerHTML = '';
    $('#app').innerHTML = '<div class="page"><div class="state" id="notfound"><h2>Trip not found</h2><p>This trip is not on this device or in your account.</p><a class="btn pri" href="/planner/index.html" data-k="openmine">Open Mine</a></div></div>';
    $('#sheets').innerHTML = ''; renderCtl();
  }

  function pageHtml() {
    var e = D.ed(T), tpl = e.mode === 'template', sum = D.summary(T);
    var h = '<div class="page' + (U.edit ? ' edit' : '') + '" data-mode="' + e.mode + '">';
    if (U.offline) h += '<div class="offline" role="status" style="margin-top:12px">You are offline. Edits are kept on this device and will sync when you are back online.</div>';
    h += cover(e, tpl) + sticky(sum, tpl, e) + '<div class="layout"><div class="colmain" role="tabpanel" id="panel">' + tabHtml(e, tpl, sum) + '</div><aside class="colmap" aria-label="Map"><div class="mapcard"><h2>Day ' + U.openDay + ' on the map</h2><div class="mapbox" id="mapbox"></div></div></aside></div></div>';
    return h;
  }
  function cover(e, tpl) {
    var kick = tpl ? 'Your copy · from our ' + O.name + ' trip' : e.converted ? 'Your trip · from our ' + O.name + ' trip' : 'Your trip';
    return '<section class="cover" style="--id:' + esc(T.identity || 'var(--id-none)') + '" aria-label="Trip"><div class="kick"><a href="/planner/index.html">Mine</a> › ' + esc(kick) + '</div><div class="phone-only">' + syncHtml() + '</div>' +
      (U.edit ? '<input class="title-edit" type="text" value="' + esc(T.title) + '" aria-label="Trip title" data-i="inlinetitle" data-k="title">' : '<h1 tabindex="-1" data-k="h1">' + esc(T.title) + '</h1>') +
      '<div class="chips"><span class="chip">' + esc(dateText()) + '</span><span class="chip">' + T.days.length + ' days</span><span class="chip">' + esc(D.partyWords(T)) + '</span></div>' +
      '<div class="acts">' + (U.edit ? '<button class="btn pri" data-a="done" data-k="done">Done</button>' : '<button class="btn pri" data-a="edit" data-k="edit">Edit trip</button>') +
      (T.dates && T.dates.from ? '<button class="btn" data-a="ics" data-k="ics">Add to calendar</button>' : '<button class="btn" data-a="settings" data-k="adddates">Add dates</button>') +
      '<button class="icon-btn" data-a="tripmenu" data-k="tripmenu" aria-haspopup="dialog" aria-label="Trip actions">' + ic('dots') + '</button></div></section>';
  }
  function sticky(sum, tpl, e) {
    var tabs = [['summary', 'Summary'], ['days', 'Days'], ['stops', 'Stops'], ['bookings', 'Bookings'], ['photos', 'Photos']];
    var h = '<div class="sticky"><div class="tabs" role="tablist" aria-label="Trip sections">' + tabs.map(function (t) {
      return '<button class="tab" role="tab" data-a="tab" data-tab="' + t[0] + '" aria-selected="' + (U.tab === t[0]) + '" data-k="tab-' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="tools">';
    if (U.edit) {
      h += (sum.fix ? '<span class="chip crit" data-k="fixcount">' + ic('alert') + sum.fix + ' to fix</span>' : '') +
        '<span class="desk-only row" style="gap:6px"><button class="icon-btn" data-a="undo" data-k="undo-btn" aria-label="Undo"' + (stack.past.length ? '' : ' disabled') + '>' + ic('undo') + '</button>' +
        '<button class="icon-btn" data-a="redo" data-k="redo-btn" aria-label="Redo"' + (stack.future.length ? '' : ' disabled') + '>' + ic('redo') + '</button>' +
        (tpl ? '<button class="lnk" data-a="changes" data-k="changes-btn" style="font:var(--t-meta)">' + e.ops.length + ' changes</button>' : '') + '</span>';
    }
    h += syncHtml();
    if (U.edit) h += '<span class="desk-only row" style="gap:6px"><button class="btn sm" data-a="settings" data-k="settings">' + ic('gear', 's') + ' Settings</button><button class="btn pri sm" data-a="done" data-k="done-row">Done</button></span>';
    return h + '</div></div>';
  }
  function tabHtml(e, tpl, sum) {
    switch (U.tab) {
      case 'summary': return summaryTab(e, tpl, sum);
      case 'days': return daysTab(e, tpl, sum);
      case 'stops': return stopsTab();
      case 'bookings': return bookingsTab();
      default: return '<div class="state"><h2>Photos</h2><p>Photos come later in this prototype.</p></div>';
    }
  }

  /* ----- the three one-line facts of the just-built landing (spec 2.1) ----- */
  function basesLine() {
    var runs = [];
    T.days.forEach(function (d) { var l = runs[runs.length - 1]; if (l && l.b === d.base) l.n++; else runs.push({ b: d.base, n: 1 }); });
    var names = runs.map(function (r) { return esc(r.b) + ' ' + r.n + ' night' + (r.n === 1 ? '' : 's'); }).join(', ');
    return '<div class="line" data-line="bases"><span><b>' + runs.length + ' base' + (runs.length === 1 ? '' : 's') + '</b> · ' + names + ' · <button class="lnk" data-a="settings">Change</button></span></div>';
  }
  function checksLine() {
    var drives = T.days.map(function (_, i) { return D.stats(T, i).drive; }).filter(function (m) { return m > 0; });
    var avg = drives.length ? Math.round(drives.reduce(function (a, b) { return a + b; }, 0) / drives.length / 5) * 5 : 0;
    var moves = 0; T.days.forEach(function (d, i) { if (i && T.days[i - 1].base !== d.base) moves++; });
    var items = T.days.reduce(function (a, d) { return a.concat(d.items); }, []), priced = items.filter(function (i) { return PL[i.id] && PL[i.id].pr != null; }).length;
    var book = T.bookings.filter(function (b) { return !b.done; }).length;
    return '<div class="line" data-line="checks"><span>' + dur(avg) + ' driving a day ≈ · ' + moves + ' move' + (moves === 1 ? '' : 's') + ' · Book ahead ' + book + ' · Known costs: ' + priced + ' of ' + items.length + ' priced</span></div>';
  }
  function builtStatus(sum) {
    var b = D.ed(T).built || { days: T.days.length, unfit: D.ed(T).unfit.length, warnings: sum.fix + sum.check };
    return '<div class="note" id="builtline" role="status"><span class="tx"><b>Built ' + b.days + ' days · ' + b.unfit + ' did not fit · ' + b.warnings + ' warning' + (b.warnings === 1 ? '' : 's') + '</b></span></div>';
  }
  function changesLine(e) {
    var n = e.ops.length;
    return '<div class="line" data-line="changes"><span><b>' + n + ' change' + (n === 1 ? '' : 's') + ' from our plan</b> · <button class="lnk" data-a="changes" data-k="changes-line">Show</button></span></div>';
  }

  function summaryTab(e, tpl, sum) {
    var h = '';
    if (!tpl && U.built) h += builtStatus(sum);
    if (tpl) h += changesLine(e);
    h += '<div class="panel"><h2>To fix and to check</h2>';
    var any = false;
    T.days.forEach(function (d, i) {
      var w = D.warnings(T, i);
      w.fix.forEach(function (x) { any = true; h += '<div class="srow"><div class="tx"><div class="wfix">' + ic('alert') + '<span>Day ' + d.n + ': ' + esc(x.text) + '</span></div></div><button class="btn sm" data-a="gotoday" data-n="' + d.n + '">Show</button></div>'; });
      w.check.forEach(function (x) { any = true; h += '<div class="srow"><div class="tx"><span class="small">Day ' + d.n + ': ' + esc(x.text) + '</span></div><button class="btn sm" data-a="gotoday" data-n="' + d.n + '">Show</button></div>'; });
    });
    if (!any) h += '<p class="small">Nothing to fix or check.</p>';
    h += '</div>' + basesLine() + checksLine();
    if (e.maybe.length) h += '<div class="panel" style="margin-top:16px"><h2>Maybe (' + e.maybe.length + ')</h2>' + e.maybe.map(function (id) { return '<div class="srow"><div class="tx"><span class="nm">' + esc(PL[id].name) + '</span></div></div>'; }).join('') + '</div>';
    h += '<div class="panel" style="margin-top:16px"><h2>At a glance</h2><div class="srow"><div class="tx">' + T.days.length + ' days · ' + T.days.reduce(function (n, d) { return n + d.items.length; }, 0) + ' stops · planned for ' + esc(D.partyWords(T)) + ' · ' + D.PACES[e.pace].l + ' pace</div></div></div>';
    return h;
  }

  function daysTab(e, tpl, sum) {
    var h = '<div class="partybar">Planned for ' + esc(D.partyWords(T)) + ' · ' + D.PACES[e.pace].l + ' pace · <button class="lnk" data-a="settings" data-k="partyedit">Edit</button></div>';
    if (U.built) h += builtStatus(sum) + basesLine() + checksLine();
    if (tpl && U.edit && U.makeit) h += '<div class="note card" id="makeit" role="group" aria-label="Make it yours"><span class="tx"><b>Make it yours.</b> This is a copy of our ' + esc(O.name) + ' trip. Change what you like; we keep the rest.</span><span class="row"><button class="btn sm" data-a="addpickday" data-n="1" data-k="mk-places">Change places</button><button class="btn sm" data-a="settings" data-k="mk-pace">Your driving and pace</button><button class="btn sm" data-a="settings" data-k="mk-start">Where you start</button></span><button class="lnk" data-a="dismissmakeit" data-k="mk-keep">Keep it as it is</button></div>';
    if (tpl) h += changesLine(e);
    h += '<nav class="rail" aria-label="Days">' + T.days.map(function (d, i) {
      return '<button data-a="gotoday" data-n="' + d.n + '" data-k="rail-' + d.n + '"' + (d.n === U.openDay ? ' aria-current="true"' : '') + (D.warnings(T, i).fix.length ? ' class="fix"' : '') + ' aria-label="Day ' + d.n + (D.warnings(T, i).fix.length ? ', 1 to fix' : '') + '">' + d.n + '</button>'; }).join('') + '</nav>';
    h += T.days.map(function (_, i) { return dayCard(i); }).join('');
    return h;
  }

  function dayCard(i) {
    var d = T.days[i], n = d.n, st = D.stats(T, i), w = D.warnings(T, i), date = D.dateOf(T, n), e = D.ed(T), key = e.keys[i];
    var added = / \(added\)$/.test(d.label), ver = e.mode === 'template' && (e.variantNow || {})[key];
    var h = '<section class="day" id="day-' + n + '" data-n="' + n + '" style="--dc:' + dayColour(i) + '" aria-labelledby="dh-' + n + '"><header class="dayh"><h3 class="dn" id="dh-' + n + '" tabindex="-1">Day ' + String(n).padStart(2, '0') + (added ? ' (added)' : '') + '</h3>' +
      '<div class="dm"><b>' + (date ? D.fmtDate(date) + ' · ' : '') + esc(d.base) + '</b> · ' + (st.drive ? dur(st.drive) + ' driving ≈' : 'no driving') + (ver && e.ops.some(function (o) { return o.t === 'variant' && o.day === key; }) ? ' · <span class="chip mark">Version ' + ver + '</span>' : '') + '</div>' +
      (U.edit ? '<button class="icon-btn" data-a="daymenu" data-n="' + n + '" data-k="dm-' + n + '" aria-haspopup="dialog" aria-label="Actions for Day ' + n + '">' + ic('dots') + '</button>' : '') + '</header>';
    if (w.fix.length || w.check.length) {
      h += '<div class="warnbox">' + w.fix.map(function (x) {
        return '<div class="wfix" data-warn="fix">' + ic('alert') + '<span>' + esc(x.text) + '</span>' + (U.edit ? '<button class="btn sm crit" data-a="fixwarn" data-id="' + esc(x.id) + '" data-code="' + x.code + '" data-k="fx-' + esc(x.id) + '">' + esc(x.fix) + '</button>' : '') + '</div>'; }).join('');
      if (w.check.length === 1) h += '<div class="wchk" data-warn="check">' + esc(w.check[0].text) + (U.edit && w.check[0].fix ? ' · <button class="lnk" data-a="fixwarn" data-id="' + esc(w.check[0].id) + '" data-code="' + w.check[0].code + '">' + esc(w.check[0].fix) + '</button>' : '') + '</div>';
      else if (w.check.length > 1) h += '<div class="wchk" data-warn="check">' + (U.checks[n] ? w.check.map(function (x) { return esc(x.text); }).join(' · ') + ' · ' : w.check.length + ' to check · ') + '<button class="lnk" data-a="togglechecks" data-n="' + n + '">' + (U.checks[n] ? 'Hide' : 'Show') + '</button></div>';
      h += '</div>';
    }
    if (d.notes) h += '<p class="daynote">' + esc(d.notes) + '</p>';
    if (!d.items.length) h += '<p class="emptyday">No stops on Day ' + n + '.' + (U.edit ? ' <button class="lnk" data-a="addpickday" data-n="' + n + '">Add a place to Day ' + n + '</button> · <button class="lnk" data-a="dropday" data-n="' + n + '">Drop Day ' + n + '</button>' : '') + '</p>';
    h += '<ol class="entries" data-day="' + n + '">' + d.items.map(function (it, j) { return entry(it, i, j); }).join('') + '</ol>';
    if (U.edit) h += '<button class="addrow" data-a="addpickday" data-n="' + n + '" data-k="ar-' + n + '">' + ic('plus', 's') + ' Add a place to Day ' + n + '</button>';
    return h + '</section>';
  }
  function entry(it, di, j) {
    var p = PL[it.id], n = di + 1, marks = D.marksOf(T, it, di).slice(0, 2), lifted = U.lift && U.lift.id === it.id, flash = U.mark && U.mark === it.id;
    var name = p && p.park ? '<a href="/parks-app/park.html?slug=' + esc(p.park) + '">' + esc(it.name) + '</a>' : esc(it.name);
    var bk = p && p.bk ? ' · <span class="chip">Book ahead</span>' : '';
    return '<li class="entry' + (lifted ? ' lifted' : '') + (flash ? ' flash' : '') + '" id="e-' + esc(it.id) + '" data-id="' + esc(it.id) + '" data-day="' + n + '"' + (U.edit ? ' tabindex="0" data-k="en-' + esc(it.id) + '" aria-label="' + esc(it.name) + ', Day ' + n + ', ' + it.time + '"' : '') + '>' +
      (U.edit ? '<button class="handle" data-a="handle" data-k="h-' + esc(it.id) + '" aria-label="Reorder ' + esc(it.name) + ', Day ' + n + '" aria-describedby="kbhint" aria-pressed="' + !!lifted + '">' + ic('grip') + '</button>' : '') +
      '<span class="tm">' + esc(it.time) + '</span><div class="body"><div class="tx"><div class="nm">' + name + '</div>' +
      (marks.length ? '<div class="marks">' + marks.map(function (m) { return '<span class="chip mark">' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="sub">' + dur(it.durMin) + (j ? ' · ' + dur(it.driveMin) + ' drive ≈' : it.driveMin > 5 ? ' · ' + dur(it.driveMin) + ' to get there ≈' : '') + bk + '</div>' +
      (p ? '<div class="acts"><a href="' + mapsUrl(p) + '" target="_blank" rel="noopener" aria-label="Map: ' + esc(it.name) + ', opens in a new tab">Map: ' + esc(it.name) + '</a><a href="' + mapsUrl(p, 1) + '" target="_blank" rel="noopener" aria-label="Directions to ' + esc(it.name) + ', opens in a new tab">Directions</a></div>' : '') +
      (it.note ? '<div class="eff">' + esc(it.note) + '</div>' : '') + '</div><div class="tile" aria-hidden="true">' + ic(p ? p.type : 'sight') + '</div></div>' +
      (U.edit ? '<button class="icon-btn" data-a="itemmenu" data-id="' + esc(it.id) + '" data-k="im-' + esc(it.id) + '" aria-haspopup="dialog" aria-label="Actions for ' + esc(it.name) + ', Day ' + n + '">' + ic('dots') + '</button>' : '') + '</li>';
  }
  function stopsTab() {
    var rows = [];
    T.days.forEach(function (d, i) { d.items.forEach(function (it) {
      rows.push('<div class="srow"><div class="tx"><span class="nm">' + esc(it.name) + '</span><div class="meta">Day ' + d.n + ' · ' + it.time + ' · ' + esc(KINDL(PL[it.id])) + '</div></div>' +
        (U.edit ? '<button class="icon-btn" data-a="itemmenu" data-id="' + esc(it.id) + '" data-k="sm-' + esc(it.id) + '" aria-haspopup="dialog" aria-label="Actions for ' + esc(it.name) + ', Day ' + d.n + '">' + ic('dots') + '</button>' : '') + '</div>'); }); });
    return '<div class="panel"><h2>Stops (' + rows.length + ')</h2>' + rows.join('') + '</div>';
  }
  function KINDL(p) { return p ? ({ town: 'Town', sight: 'Sight', hike: 'Hike', activity: 'Activity', park: 'Park' }[p.type] || p.type) : ''; }
  function bookingsTab() {
    var rows = T.bookings.map(function (b) {
      var by = /^\d{4}-/.test(b.by) ? 'Book by ' + D.fmtDate(b.by) : /d$/.test(b.by) ? 'Book ' + b.by.replace('d', ' days') + ' ahead' : b.by;
      return '<div class="srow"><div class="tx"><span class="nm">' + esc(b.label) + '</span><div class="meta">' + esc(by) + '</div></div><span class="chip">' + (b.done ? 'Done' : 'To book') + '</span></div>'; });
    return '<div class="panel"><h2>Bookings</h2>' + (rows.join('') || '<p class="small">No bookings needed for these stops.</p>') + '<p class="meta" style="margin-top:12px">Bookings follow their stop: remove the stop and the booking goes with it.</p></div>';
  }

  /* ---------- map column (desktop) ---------- */
  function drawMap() {
    var box = $('#mapbox'); if (!box || !window.ProtoMap || box.offsetParent === null) return;
    var d = T.days[U.openDay - 1] || T.days[0], b = D.pt(d.base);
    ProtoMap.render(box, { days: [{ n: d.n - 1, points: d.items.map(function (it) { return { id: it.id, lat: PL[it.id].lat, lon: PL[it.id].lon, label: it.name }; }) }],
      extras: b ? [{ id: 'base', lat: b.lat, lon: b.lon, label: d.base, caption: d.base }] : [], label: 'Day ' + d.n + ' route', height: 360, onPin: function (id) { var el = $('#e-' + id); if (el) el.scrollIntoView({ block: 'center' }); } });
  }

  /* ---------- sheets ---------- */
  function openSheet(s, trig) {
    var el = trig || document.activeElement;
    backKey = el && el.getAttribute ? el.getAttribute('data-k') : null; backEl = el;
    s.trigRect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    U.sheet = s; renderSheets(true);
  }
  function closeSheet(noFocus) {
    if (!U.sheet) return;
    U.sheet = null; renderSheets();
    if (noFocus) return;
    var el = backKey && $('[data-k="' + backKey + '"]'); if (!el && backEl && document.contains(backEl)) el = backEl;
    if (el) el.focus({ preventScroll: true });
  }
  function renderSheets(first) {
    var host = $('#sheets'), s = U.sheet;
    if (!s) { host.innerHTML = ''; document.body.classList.remove('nosc'); return; }
    var ae = document.activeElement, key = ae && ae.getAttribute && ae.closest('.sheet') ? ae.getAttribute('data-k') : null, pos = ae && ae.selectionStart;
    var kind = S.kinds[s.type], full = phone() && S.fullOnPhone[s.type];
    var style = '';
    if (kind === 'menu' && !phone() && s.trigRect) style = ' style="--x:' + Math.max(8, Math.min(window.innerWidth - 356, s.trigRect.left)) + 'px;--y:' + Math.max(8, Math.min(window.innerHeight - 300, s.trigRect.bottom + 4)) + 'px"';
    var inner = S.render(T, s, { canUndo: stack.past.length > 0, canRedo: stack.future.length > 0 });
    if (!inner) { U.sheet = null; host.innerHTML = ''; return; }
    host.innerHTML = '<div class="scrim" data-a="closesheet"></div><div class="sheet ' + kind + (full ? ' full' : '') + '" role="dialog" aria-modal="true" aria-labelledby="sh-t" data-type="' + s.type + '"' + style + '>' + inner + '</div>';
    document.body.classList.add('nosc');
    var sh = $('.sheet'), hh = $('#sh-t', sh); if (hh) { sh.setAttribute('aria-label', hh.firstChild.textContent.trim()); sh.removeAttribute('aria-labelledby'); }
    var target = key && $('[data-k="' + key + '"]', sh);
    if (!target && first) target = $('.sb button:not([disabled]), .sb a, .sb input, .sb textarea, .sb select', sh) || $('header .icon-btn', sh);
    if (target) { target.focus({ preventScroll: true }); if (pos != null && target.setSelectionRange) { try { target.setSelectionRange(pos, pos); } catch (er) { /* not a text field */ } } }
  }
  function trapTab(e) {
    var sh = $('.sheet'); if (!sh) return;
    var f = $$('button:not([disabled]), a[href], input:not([disabled]), textarea, select', sh).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!sh.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  function settingsDraft() {
    var e = D.ed(T);
    return { title: T.title, from: T.dates && T.dates.from || '', noDate: !(T.dates && T.dates.from), party: D.clone(T.party), pace: e.pace };
  }
  function openAdd(n, extra, trig) { openSheet(Object.assign({ type: 'add', n: n, q: '', filt: {}, more: {}, added: {}, offline: U.offline }, extra || {}), trig); U.openDay = n; }
  function resolvePin(slug) {
    if (!slug) return null;
    if (PL[slug]) return { id: slug, name: PL[slug].name };
    if (PARKS[slug]) return { park: slug, name: PARKS[slug].name };
    if (slug.indexOf('--') > 0) {
      var nm = slug.split('--')[1], hit = PLACES.find(function (p) { return p.id === nm || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === nm; });
      if (hit) return { id: hit.id, name: hit.name };
    }
    return { missing: true, name: slug };
  }

  /* ---------- actions ---------- */
  function sheetFor(id) { return D.locate(T, id); }
  function actions(a, t, ev) {
    var id = t.getAttribute('data-id'), n = +t.getAttribute('data-n'), s = U.sheet;
    switch (a) {
      case 'theme': ProtoTheme.toggle(); return;
      case 'edit': setEdit(true); return;
      case 'done': setEdit(false); return;
      case 'tab': U.tab = t.getAttribute('data-tab'); history.replaceState(null, '', url(U.edit, tabParam())); render('tab-' + U.tab); return;
      case 'undo': undo(); return;
      case 'redo': redo(); return;
      case 'closesheet': closeSheet(); return;
      case 'gotoday': U.tab = 'days'; U.openDay = n; render(); var dh = $('#dh-' + n); if (dh) { dh.scrollIntoView({ block: 'start' }); dh.focus({ preventScroll: true }); } return;
      case 'togglechecks': U.checks[n] = !U.checks[n]; render(); return;
      case 'itemmenu': U.openDay = sheetFor(id).n; openSheet({ type: 'item', id: id }, t); return;
      case 'openmove': s.type = 'move'; renderSheets(true); return;
      case 'openswap': s.type = 'swap'; renderSheets(true); return;
      case 'openswapnear': openAdd(sheetFor(s.id).n, { mode: 'swap', from: s.id, filt: {} }); return;
      case 'movedo': closeSheet(true); commit(function () { return D.moveItem(T, id, n, null); }, { focus: 'en-' + id }); scrollToEntry(id); return;
      case 'up': case 'down': { var r = commit(function () { return D.nudge(T, id, a === 'up' ? -1 : 1); }, { focus: 'en-' + id }); if (s) closeSheet(true); return; }
      case 'swapdo': { closeSheet(true); commit(function () { return swapTwo(id, t.getAttribute('data-with')); }, { focus: 'en-' + id }); return; }
      case 'maybe': closeSheet(true); commit(function () { return D.toMaybe(T, id); }); return;
      case 'keep': { var l = sheetFor(id); commit(function () { return D.setKeep(T, id, !(l.it.locked || l.it.placed)); }, { quiet: true }); return; }
      case 'must': commit(function () { return D.setMust(T, id, !sheetFor(id).it.mustSee); }, { quiet: true }); return;
      case 'opennote': openSheet({ type: 'note', id: id }, backEl); return;
      case 'daynote': openSheet({ type: 'note', n: n }, backEl); return;
      case 'notesave': { var txt = $('#nt').value.trim(), tgt = s.id ? { id: s.id } : { n: s.n }; closeSheet(true); commit(function () { return D.setNote(T, tgt, txt); }, { quiet: true }); return; }
      case 'remove': removeStop(id); return;
      case 'addpickday': { var trig = t; if (s) { closeSheet(true); } openAdd(n, null, trig); return; }
      case 'padd': pickAdd(id); return;
      case 'pinadd': { var pid = s.pin.id; commit(function () { s.addedDay = n; return D.addItem(T, pid, n); }, { focus: 'pn-' + n }); return; }
      case 'pfilt': { var f = t.getAttribute('data-f'); s.filt[f] = !s.filt[f]; renderSheets(); return; }
      case 'pmore': s.more[t.getAttribute('data-g')] = ((s.more[t.getAttribute('data-g')]) || 12) + 12; renderSheets(); return;
      case 'tripmenu': openSheet({ type: 'trip' }, t); return;
      case 'daymenu': U.openDay = n; openSheet({ type: 'day', n: n }, t); return;
      case 'insertday': closeSheet(true); commit(function () { return D.insertDay(T, n); }, { focus: 'ar-' + (n + 1) }); scrollToDay(n + 1); return;
      case 'dropday': if (s) closeSheet(true); openSheet({ type: 'dropday', n: n, to: 'day' }, backEl); return;
      case 'dropto': s.to = t.getAttribute('data-v'); renderSheets(); return;
      case 'dropgo': { var dn = s.n, to = s.to; closeSheet(true); commit(function () { return D.dropDay(T, dn, to, dn > 1 ? dn - 1 : 2); }); return; }
      case 'resetday': closeSheet(true); commit(function () { return D.resetDay(T, n); }); return;
      case 'versions': closeSheet(true); openSheet({ type: 'versions', n: n }, backEl); return;
      case 'setver': closeSheet(true); commit(function () { return D.setVariant(T, n, t.getAttribute('data-v')); }); return;
      case 'daymove': closeSheet(true); commit(function () { return D.moveDay(T, n, +t.getAttribute('data-d')); }); return;
      case 'settings': if (s) closeSheet(true); openSheet({ type: 'settings', draft: settingsDraft(), signed: U.sync !== 'device' }, t); return;
      case 'changes': openSheet({ type: 'changes' }, t); return;
      case 'restore': { var oid = t.getAttribute('data-oid'); commit(function () { return D.restoreOp(T, oid); }, { focus: 'changes-btn' }); if (U.sheet) renderSheets(); return; }
      case 'makeit': closeSheet(true); U.makeit = true; U.tab = 'days'; if (!U.edit) setEdit(true); else render(); return;
      case 'dismissmakeit': U.makeit = false; render('edit'); return;
      case 'resetall': if (D.changes(T).length > RESET_CONFIRM_OVER) { closeSheet(true); openSheet({ type: 'confirmreset' }, backEl); } else { closeSheet(true); commit(function () { return D.resetAll(T); }); } return;
      case 'resetgo': closeSheet(true); commit(function () { return D.resetAll(T); }); return;
      case 'ics': closeSheet(true); downloadIcs(); return;
      case 'removetrip': closeSheet(true); openSheet({ type: 'confirmremove' }, backEl); return;
      case 'removego': D.remove(TID); location.href = '/planner/index.html'; return;
      case 'rebuild': closeSheet(true); commit(function () { return D.rebuildBuilt(T); }); return;
      case 'apply': applySettings(); return;
      case 'stepadult': { var dd = +t.getAttribute('data-d'), P = s.draft.party, ad = P.filter(function (x) { return x.type === 'adult'; }).length; if (dd < 0 && ad > 1) P.splice(P.findIndex(function (x) { return x.type === 'adult'; }), 1); else if (dd > 0) P.unshift({ type: 'adult', needs: [] }); renderSettings(); return; }
      case 'addkid': s.draft.party.push({ type: 'child', age: 8, needs: [] }); renderSettings(); return;
      case 'rmkid': { var kids = s.draft.party.filter(function (x) { return x.type !== 'adult'; }); s.draft.party.splice(s.draft.party.indexOf(kids[+t.getAttribute('data-idx')]), 1); renderSettings(); return; }
      case 'mytrav': s.draft.party = [{ type: 'adult', needs: [] }, { type: 'adult', needs: [] }, { type: 'child', age: 6, needs: [] }]; renderSettings(); toast('Filled from your travellers'); return;
      case 'engine': if (isBuilt()) return; s.convert = true; renderSettings(); { var cn = $('#convertnotice'); if (cn) cn.scrollIntoView({ block: 'center' }); var cg = $('[data-k="convertgo"]'); if (cg) cg.focus(); } return;
      case 'convertcancel': s.convert = false; renderSettings(); return;
      case 'convertgo': { var dr = s.draft; commit(function () { D.convert(T); return { msg: 'Now your own trip, from our ' + O.name + ' trip' }; }, { focus: 'apply' }); if (U.sheet) { U.sheet.convert = false; U.sheet.draft = settingsDraft(); renderSheets(); } return; }
      case 'syncretry': U.sync = 'account'; U.syncTmp = null; kickSync(); paintSync(); say('Retrying'); return;
      case 'fixwarn': { var loc = sheetFor(id); if (!loc) return; var code = t.getAttribute('data-code'); openSheet(code === 'W_HOURS' ? { type: 'item', id: id } : { type: 'move', id: id }, t); return; }
      case 'ctl': U.ctl = !U.ctl; renderCtl(); return;
      case 'reseed': resetDemo(); return;
      case 'handle': return;
    }
  }
  function swapTwo(a, b) {
    var A = D.locate(T, a), B = D.locate(T, b); if (!A || !B) return null;
    var an = A.n, aj = A.j, bn = B.n, bj = B.j, nameA = A.it.name, nameB = B.it.name;
    D.moveItem(T, a, bn, bj); D.moveItem(T, b, an, an === bn ? aj : aj);
    return { msg: 'Swapped ' + nameA + ' and ' + nameB };
  }
  function removeStop(id) {
    var loc = sheetFor(id); if (!loc) return;
    var nextId = (loc.day.items[loc.j + 1] || loc.day.items[loc.j - 1] || {}).id, n = loc.n;
    if (U.sheet) closeSheet(true);
    var el = $('#e-' + id);
    var go = function () { commit(function () { return D.removeItem(T, id); }, { focus: nextId ? 'en-' + nextId : 'ar-' + n }); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el && !reduce) { el.classList.add('out'); setTimeout(go, 200); } else go();
  }
  function pickAdd(id) {
    var s = U.sheet;
    if (s.mode === 'swap') {
      var from = s.from, loc = sheetFor(from), n = loc.n, j = loc.j;
      closeSheet(true);
      commit(function () { var nm = loc.it.name; D.addItem(T, id, n, j + 1); D.removeItem(T, from); return { msg: 'Swapped ' + nm + ' for ' + PL[id].name }; });
      return;
    }
    var n2 = s.n;
    commit(function () { s.added[id] = true; return D.addItem(T, id, n2); }, { focus: 'pa-' + id });
    U.mark = id; setTimeout(function () { U.mark = null; }, 6000);
  }
  function renderSettings() { var sh = U.sheet; if (sh && sh.type === 'settings') renderSheets(); }
  function applySettings() {
    var s = U.sheet, dr = s.draft, e = D.ed(T), msgs = [];
    var partyChanged = JSON.stringify(dr.party) !== JSON.stringify(T.party), paceChanged = dr.pace !== e.pace;
    var fromNow = T.dates && T.dates.from || '', want = dr.noDate ? '' : dr.from;
    closeSheet(true);
    commit(function () {
      if (dr.title && dr.title !== T.title) { D.setTitle(T, dr.title); msgs.push('Title saved'); }
      if (want !== fromNow) msgs.push(D.setDates(T, want || null).msg);
      if (partyChanged || paceChanged) msgs.push(D.setParty(T, dr.party, dr.pace).msg);
      return msgs.length ? { msg: msgs[msgs.length - 1] } : { none: true, msg: 'Nothing changed' };
    });
  }
  function scrollToEntry(id) { setTimeout(function () { var el = $('#e-' + id); if (el) el.scrollIntoView({ block: 'center' }); }, 30); }
  function scrollToDay(n) { setTimeout(function () { var el = $('#dh-' + n); if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); } }, 30); }
  function downloadIcs() {
    var r = ProtoICS.build(C.normalise(T)), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.text], { type: 'text/calendar' })); a.download = (T.title || 'trip') + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    toast('Calendar file ready: ' + r.events + ' events');
  }
  function resetDemo() {
    D.remove('demo-copy'); D.remove('demo-built'); sessionStorage.removeItem('proto.trip.undo.demo-copy'); sessionStorage.removeItem('proto.trip.undo.demo-built'); D.seed();
    T = D.get(TID); loadStack(); render(); toast('Demo trips reset');
  }

  /* ---------- keyboard model (spec 5.3) ---------- */
  function positionText(id) { var l = D.locate(T, id); return l ? l.it.name + ', Day ' + l.n + ', position ' + (l.j + 1) + ' of ' + l.day.items.length : ''; }
  function lift(id) { U.lift = { id: id, base: JSON.stringify(T) }; render('h-' + id); say('Lifted ' + positionText(id) + '. Arrow keys move it, Page Up and Page Down change day, Space drops it, Escape cancels.'); }
  function liftMove(k) {
    var id = U.lift.id, l = D.locate(T, id), moved = null;
    if (k === 'ArrowUp') moved = D.nudge(T, id, -1); else if (k === 'ArrowDown') moved = D.nudge(T, id, 1);
    else if (k === 'Home') moved = D.moveItem(T, id, l.n, 0); else if (k === 'End') moved = D.moveItem(T, id, l.n, null);
    else if (k === 'PageUp' && l.n > 1) moved = D.moveItem(T, id, l.n - 1, null); else if (k === 'PageDown' && l.n < T.days.length) moved = D.moveItem(T, id, l.n + 1, 0);
    render('h-' + id); say(positionText(id)); var el = $('#e-' + id); if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function drop() {
    var id = U.lift.id, fin = D.locate(T, id), base = U.lift.base, start = JSON.parse(base);
    T = start; U.lift = null;
    var was = D.locate(T, id);
    if (was.n === fin.n && was.j === fin.j) { render('h-' + id); say('Dropped ' + was.it.name + ' where it was'); return; }
    commit(function () { return D.moveItem(T, id, fin.n, fin.j); }, { focus: 'h-' + id });
  }
  function cancelLift() { var id = U.lift.id; T = JSON.parse(U.lift.base); U.lift = null; render('h-' + id); say('Cancelled. ' + positionText(id)); }
  function onKey(e) {
    var tg = e.target, k = e.key;
    if (U.sheet) { if (k === 'Escape') { e.preventDefault(); closeSheet(); } else if (k === 'Tab') trapTab(e); return; }
    if (drag && drag.active && k === 'Escape') { endDrag(false); return; }
    if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(tg.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (!U.edit) { if (k.toLowerCase() === 'e' && !/INPUT|TEXTAREA|SELECT/.test(tg.tagName) && !e.metaKey && !e.ctrlKey) { setEdit(true); } return; }
    if (/INPUT|TEXTAREA|SELECT/.test(tg.tagName)) { if (tg.getAttribute('data-i') === 'inlinetitle') { if (k === 'Enter') tg.blur(); if (k === 'Escape') { tg.value = T.title; tg.blur(); } } return; }
    var li = tg.closest && tg.closest('.entry');
    if (U.lift) {
      var id = U.lift.id;
      if (k === ' ' || k === 'Enter') { e.preventDefault(); drop(); }
      else if (k === 'Escape') { e.preventDefault(); cancelLift(); }
      else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].indexOf(k) >= 0) { e.preventDefault(); liftMove(k); }
      return;
    }
    if (tg.classList && tg.classList.contains('handle') && (k === ' ' || k === 'Enter')) { e.preventDefault(); lift(li.getAttribute('data-id')); return; }
    if (!li) { if (k.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) setEdit(false); return; }
    var eid = li.getAttribute('data-id');
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); commit(function () { return D.nudge(T, eid, k === 'ArrowUp' ? -1 : 1); }, { focus: tg.classList.contains('handle') ? 'h-' + eid : 'en-' + eid }); return; }
    if (tg !== li) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeStop(eid); }
    else if (k === 'Enter') { e.preventDefault(); openSheet({ type: 'item', id: eid }, li); }
    else if (k.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) { openSheet({ type: 'move', id: eid }, li); }
    else if (k.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) { openSheet({ type: 'swap', id: eid }, li); }
    else if (k.toLowerCase() === 'l' && isBuilt() && !e.metaKey && !e.ctrlKey) { var l = D.locate(T, eid); commit(function () { return D.setKeep(T, eid, !(l.it.locked || l.it.placed)); }, { quiet: true, focus: 'en-' + eid }); }
  }

  /* ---------- drag (spec 5.2): desktop anywhere in the list and onto the day rail, phone long-press on the handle within the day ---------- */
  var ghost = null, line = null, scrollTimer = null, lastPt = null;
  function onDown(e) {
    var h = e.target.closest && e.target.closest('.handle');
    if (!h || !U.edit || U.lift || e.button > 0) return;
    var li = h.closest('.entry');
    drag = { id: li.getAttribute('data-id'), x0: e.clientX, y0: e.clientY, pid: e.pointerId, touch: e.pointerType === 'touch', active: false, h: h, li: li, day0: +li.getAttribute('data-day'), target: null, timer: null };
    if (drag.touch) drag.timer = setTimeout(function () { if (drag && !drag.active) startDrag(); }, LONG_PRESS_MS);
  }
  function onMove(e) {
    if (!drag) return;
    lastPt = { x: e.clientX, y: e.clientY };
    if (!drag.active) {
      var dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      if (drag.touch) { if (dist > DRAG_PX_ROW) { clearTimeout(drag.timer); drag = null; } return; }
      if (dist < DRAG_PX_HANDLE) return;
      startDrag();
    }
    e.preventDefault(); moveDrag(e);
  }
  function startDrag() {
    drag.active = true; try { drag.h.setPointerCapture(drag.pid); } catch (er) { /* synthetic pointer */ }
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (er) { /* not allowed */ } }
    ghost = document.createElement('div'); ghost.className = 'dragghost'; ghost.textContent = PL[drag.id].name; document.body.appendChild(ghost);
    line = document.createElement('div'); line.className = 'dropline'; line.hidden = true; line.innerHTML = '<i></i>'; document.body.appendChild(line);
    drag.li.classList.add('dragging');
    clearInterval(scrollTimer);
    scrollTimer = setInterval(function () { if (!lastPt || !drag) return; if (lastPt.y < EDGE_PX) window.scrollBy(0, -14); else if (lastPt.y > window.innerHeight - EDGE_PX) window.scrollBy(0, 14); }, 16);
  }
  function moveDrag(e) {
    ghost.style.left = (e.clientX + 12) + 'px'; ghost.style.top = (e.clientY - 18) + 'px';
    var els = document.elementsFromPoint(e.clientX, e.clientY), tgt = null;
    $$('.rail .dropt').forEach(function (x) { x.classList.remove('dropt'); });
    var rb = !phone() && els.find(function (x) { return x.matches && x.matches('.rail button'); });
    if (rb) { tgt = { day: +rb.getAttribute('data-n'), at: null, rail: rb }; rb.classList.add('dropt'); }
    else {
      var en = els.find(function (x) { return x.matches && x.matches('.entry') && x !== drag.li; });
      if (en) {
        var r = en.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2, dn = +en.getAttribute('data-day');
        var arr = $$('.entry', en.closest('.entries')).filter(function (x) { return x !== drag.li; });
        tgt = { day: dn, at: arr.indexOf(en) + (before ? 0 : 1), y: before ? r.top : r.bottom, x: r.left, w: r.width, before: before, ref: en };
      } else {
        var dayEl = els.find(function (x) { return x.matches && x.matches('.day'); });
        if (dayEl) { var ol = $('.entries', dayEl), last = ol && $$('.entry', ol).filter(function (x) { return x !== drag.li; }).pop(), dn2 = +dayEl.getAttribute('data-n');
          if (last) { var r2 = last.getBoundingClientRect(); tgt = { day: dn2, at: null, y: r2.bottom, x: r2.left, w: r2.width, ref: null }; } else if (ol) { var r3 = ol.getBoundingClientRect(); tgt = { day: dn2, at: 0, y: r3.top, x: r3.left, w: r3.width, ref: null }; } }
      }
    }
    if (phone() && tgt && tgt.day !== drag.day0) tgt = null;
    drag.target = tgt;
    if (tgt && tgt.w) {
      line.hidden = false; line.style.left = tgt.x + 'px'; line.style.width = tgt.w + 'px'; line.style.top = tgt.y + 'px';
      var f = D.fitsIf(T, drag.id, tgt.day), at = tgt.ref ? (tgt.before ? 'before ' : 'after ') + (tgt.ref.querySelector('.tm') || {}).textContent : 'at the end';
      line.firstChild.textContent = 'to Day ' + tgt.day + ' · ' + at + ' · ' + (f.addDrive >= 0 ? '+' : '−') + dur(Math.abs(f.addDrive)) + ' driving ≈';
    } else if (tgt && tgt.rail) { line.hidden = true; } else line.hidden = true;
  }
  function endDrag(drop) {
    var d = drag; if (!d) return;
    clearTimeout(d.timer); clearInterval(scrollTimer);
    $$('.rail .dropt').forEach(function (x) { x.classList.remove('dropt'); });
    if (ghost) ghost.remove(); if (line) line.remove(); ghost = line = null;
    drag = null;
    if (!d.active) return;
    d.li.classList.remove('dragging'); window.__justDragged = Date.now();
    var t = d.target;
    if (drop && t) {
      var loc = D.locate(T, d.id);
      if (t.day === loc.n && (t.at === loc.j || t.at === loc.j + 1)) { say('Dropped ' + loc.it.name + ' where it was'); return; }
      commit(function () { return D.moveItem(T, d.id, t.day, t.at); }, { focus: 'h-' + d.id });
    } else say('Cancelled');
  }
  function onUp() { if (drag) endDrag(true); }

  /* ---------- inputs ---------- */
  function onInput(e) {
    var t = e.target, i = t.getAttribute && t.getAttribute('data-i'), s = U.sheet;
    if (t.id === 'pq' && s) { s.q = t.value; renderSheets(); return; }
    if (!i || !s || s.type !== 'settings') return;
    var dr = s.draft;
    if (i === 'title') dr.title = t.value;
    else if (i === 'from') dr.from = t.value;
    else if (i === 'nodate') { dr.noDate = t.checked; renderSettings(); return; }
    else if (i === 'age') { var kids = dr.party.filter(function (x) { return x.type !== 'adult'; }); kids[+t.getAttribute('data-idx')].age = +t.value; kids[+t.getAttribute('data-idx')].type = 'child'; }
    else if (i === 'pace') dr.pace = t.value;
    var ef = $('#effect'); if (ef) ef.innerHTML = S.effect(T, dr);
  }
  function onChange(e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-i') === 'inlinetitle' && t.value.trim() && t.value.trim() !== T.title) {
      var v = t.value.trim(); commit(function () { D.setTitle(T, v); return { msg: 'Title saved' }; }, { quiet: true, focus: 'title' });
    }
  }

  /* ---------- prototype controls ---------- */
  function renderCtl() {
    var c = $('#ctl');
    c.innerHTML = '<button data-a="ctl" aria-expanded="' + U.ctl + '" data-k="ctlb">Prototype controls</button>' + (U.ctl ?
      '<div class="pnl" role="group" aria-label="Prototype controls"><label>Account and sync<select id="c-sync"><option value="device">Signed out: On this device</option><option value="account">In your account</option><option value="syncing">Syncing</option><option value="pending">Not synced yet</option><option value="failed">Not synced · Retry</option></select></label>' +
      '<label class="row" style="flex-direction:row;gap:8px"><input type="checkbox" id="c-off"' + (U.offline ? ' checked' : '') + '> Offline</label><button class="btn sm" data-a="reseed">Reset demo trips</button><a class="btn sm" href="frames.html">All frames</a></div>' : '');
    var sel = $('#c-sync'); if (sel) { sel.value = U.sync === 'device' ? 'device' : (U.syncForce || U.sync); sel.onchange = function () { setSync(sel.value); }; }
    var off = $('#c-off'); if (off) off.onchange = function () { U.offline = off.checked; render('ctlb'); };
  }
  function setSync(v) { U.syncForce = v; U.syncTmp = null; if (v === 'syncing' || v === 'pending' || v === 'failed') { U.sync = v === 'syncing' ? 'account' : v === 'pending' ? 'account' : 'failed'; U.syncTmp = v === 'syncing' ? 'syncing' : null; U.offline = v === 'pending'; } else { U.sync = v; U.offline = false; } render('ctlb'); }

  /* ---------- boot ---------- */
  function applyFrame(q) {
    var sh = q.get('sheet'), mine = $('[data-k="edit"]');
    if (q.get('sync')) setSync(q.get('sync'));
    if (q.get('offline') === '1') { U.offline = true; if (U.sync === 'device') U.sync = 'account'; }
    if (q.get('makeit') === '1') U.makeit = true;
    if (q.get('built') === '1') U.built = true;
    render();
    if (q.get('built') === '1') { say($('#builtline') ? $('#builtline').textContent : ''); history.replaceState(null, '', url(U.edit, tabParam())); }
    if (q.get('add')) { var pin = resolvePin(q.get('add')), best = pin && pin.id ? D.bestDays(T, pin.id)[0].n : 1; openAdd(best, { pin: pin }); }
    if (!sh) return;
    var p = sh.split(':'), kind = p[0], arg = p[1];
    var first = T.days.reduce(function (a, d) { return a || d.items[0]; }, null);
    if (kind === 'item') { var en = $('#e-' + (arg || first.id)); if (en) en.scrollIntoView({ block: 'start' }); window.scrollBy(0, -260); }
    if (kind === 'item') openSheet({ type: 'item', id: arg || first.id }, $('[data-k="im-' + (arg || first.id) + '"]'));
    else if (kind === 'move') openSheet({ type: 'move', id: arg || first.id }, null);
    else if (kind === 'add') openAdd(+arg || 1);
    else if (kind === 'settings') openSheet({ type: 'settings', draft: settingsDraft(), signed: U.sync !== 'device' }, null);
    else if (kind === 'convert') openSheet({ type: 'settings', draft: settingsDraft(), signed: U.sync !== 'device', convert: true }, null);
    else if (kind === 'changes') openSheet({ type: 'changes' }, null);
    else if (kind === 'day') openSheet({ type: 'day', n: +arg || 1 }, $('[data-k="dm-' + (+arg || 1) + '"]'));
    else if (kind === 'trip') openSheet({ type: 'trip' }, null);
    else if (kind === 'drop') openSheet({ type: 'dropday', n: +arg || 1, to: 'day' }, null);
  }
  function boot() {
    D.seed();
    var q = new URLSearchParams(location.search);
    if (q.get('copy') === 'dolomites') {
      T = D.makeCopy(); D.put(T); TID = T.id; U.makeit = true; history.replaceState(null, '', '?id=' + TID + '&edit=1');
      var copyMsg = 'Copied ' + O.name + ' to My trips';
    } else {
      TID = q.get('id') || localStorage.getItem('proto.draft') || 'demo-copy'; T = D.get(TID);
    }
    if (q.get('state') === 'notfound') T = null;
    readUrl();
    if (T) { loadStack(); if (T.id === 'demo-built' || (T.ext && T.ext.edit && T.ext.edit.mode === 'built')) { /* built */ } }
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-a]'); if (!t) return;
      if (window.__justDragged && Date.now() - window.__justDragged < 250 && t.closest('.handle')) return;
      if (t.tagName === 'A') return;
      actions(t.getAttribute('data-a'), t, e);
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', function () { if (drag) endDrag(false); });
    window.addEventListener('popstate', function () { readUrl(); U.sheet = null; U.lift = null; render(); });
    window.addEventListener('resize', function () { if (T) drawMap(); });
    if (T) applyFrame(q); else render();
    if (copyMsg) { stack = { past: [], future: [] }; toast(copyMsg + ' · ', false); var tt = $('#toast'); tt.insertAdjacentHTML('beforeend', '<button data-a="undocopy">Undo</button>'); }
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-a="undocopy"]'); if (b) { D.remove(TID); location.href = '/trip/frames.html'; } });
  boot();
})();
