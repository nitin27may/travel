/* THROWAWAY prototype shared code: theme, saved store, header with real nav, phone bottom bar, drawers and sheets (focus trap and
   focus return), toast, the Placeholder tag. */
(function () {
  var P = window.PROTO, KEY = 'proto.saved';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function getSaved() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function setSaved(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} document.dispatchEvent(new CustomEvent('saved-changed')); }
  function isSaved(s) { return getSaved().indexOf(s) >= 0; }
  function toggleSaved(s) { var a = getSaved(), i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else a.push(s); setSaved(a); return i < 0; }
  function placeSlug(park, name) { return park.slug + '--' + slugify(name); }
  function lookup(slug) {
    for (var i = 0; i < P.PARKS.length; i++) {
      var p = P.PARKS[i];
      if (p.slug === slug) return { name: p.name, sub: P.KIND_LABEL[p.kind] + ' · ' + p.region, href: 'park.html?slug=' + p.slug };
      var hit = null;
      (p.todo || []).forEach(function (k) { k.items.forEach(function (it) { if (placeSlug(p, it.name) === slug) hit = { name: it.name, sub: 'Place in ' + p.name, href: 'park.html?slug=' + p.slug }; }); });
      if (hit) return hit;
    }
    return { name: slug, sub: '', href: '#' };
  }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  /** Small inline icons (currentColor, 18 px); always aria-hidden, the text beside them carries the meaning. */
  var ICONS = { ticket: 'M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3zM14 6v12', tent: 'M3 19 12 5l9 14zM12 19l-3.5-6M12 19l3.5-6', info: 'M12 11v6M12 7.5v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17v.5' };
  function icon(n) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + ICONS[n] + '"/></svg>'; }
  /** The tag every invented value carries. */
  function ph(text) { return '<span class="phtag">' + esc(text || 'Placeholder') + '</span>'; }

  /* ---- navigation: the same four places in the header (desktop) and the bottom bar (phone, from design/park-page) ---- */
  var NAV = [['Home', '../index.html'], ['Parks', 'index.html'], ['Trips', '../planner/index.html'], ['Plan', '../builder/index.html']];
  var BAR = [['Home', '../index.html', 'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10'], ['Parks', 'index.html', 'M4 20 10 8l4 7 2-3 4 8z'], ['Trips', '../planner/index.html', 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5'], ['Plan', '../builder/index.html', 'M12 5v14M5 12h14']];
  function header(active) {
    var h = document.getElementById('hdr'); if (!h) return;
    h.className = 'hdr';
    h.innerHTML = '<a class="brand" href="../index.html">TRIP PLANS</a><nav aria-label="Main">' + NAV.map(function (n) { return '<a href="' + n[1] + '"' + (n[0] === (active || 'Parks') ? ' class="cur" aria-current="page"' : '') + '>' + n[0] + '</a>'; }).join('') + '</nav><span class="sp"></span>' +
      '<button id="savedbtn" aria-haspopup="dialog">Saved <span id="savedn">0</span></button><button id="theme" aria-label="Switch theme">Theme</button>';
    document.getElementById('theme').onclick = function () { ProtoTheme.toggle(); };   // shared/theme.js: key proto.theme, applied before first paint
    document.getElementById('savedbtn').onclick = openSaved;
    function upd() { document.getElementById('savedn').textContent = getSaved().length; }
    upd(); document.addEventListener('saved-changed', upd);
    var b = document.createElement('nav'); b.className = 'bbar'; b.id = 'bbar'; b.setAttribute('aria-label', 'Main (phone)');
    b.innerHTML = BAR.map(function (n) { var cur = n[0] === (active || 'Parks'); return '<a href="' + n[1] + '"' + (cur ? ' class="cur" aria-current="page"' : '') + '><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + n[2] + '"/></svg><span>' + n[0] + '</span></a>'; }).join('');
    document.body.appendChild(b);
    var f = document.createElement('footer'); f.className = 'printfoot'; f.id = 'printfoot';
    f.innerHTML = ph('Placeholder') + ' Prototype data, not for planning a trip. Printed ' + new Date().toISOString().slice(0, 10) + ' from the clickable prototype.';
    document.body.appendChild(f);
  }

  /* ---- layers: a drawer or a sheet with a focus trap, Escape, scrim click, and focus returned to the opener ---- */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  /** opts: {cls:'drawer'|'sheet', id, label, html, opener, mount(panel, close), initial: selector} -> {panel, close} */
  function layer(opts) {
    var opener = opts.opener || document.activeElement;
    var sc = document.createElement('div'); sc.className = 'scrim'; sc.id = opts.id + 'scrim';
    var d = document.createElement('div'); d.className = opts.cls; d.id = opts.id; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', opts.label);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      d.remove(); sc.remove(); document.removeEventListener('keydown', key, true);
      if (opts.onClose) opts.onClose();
      if (opener && opener.isConnected && opener.focus) opener.focus();
    }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(d.querySelectorAll(FOCUSABLE), function (x) { return x.offsetParent !== null || x === document.activeElement; });
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if (!d.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    d.innerHTML = opts.html;
    document.body.appendChild(sc); document.body.appendChild(d);
    document.addEventListener('keydown', key, true); sc.onclick = close;
    var x = d.querySelector('[data-close]'); if (x) x.onclick = close;
    if (opts.mount) opts.mount(d, close);
    var init = (opts.initial && d.querySelector(opts.initial)) || d.querySelector(FOCUSABLE); if (init) init.focus();
    return { panel: d, close: close };
  }

  function openSaved(e) {
    var old = document.getElementById('saveddrawer'); if (old) return;
    var opener = (e && e.currentTarget) || document.getElementById('savedbtn');
    function html() {
      var s = getSaved();
      return '<button class="btn ic x" aria-label="Close saved places" data-close>&times;</button><h2>My saved places</h2>' +
        (s.length ? '<ul>' + s.map(function (x) { var l = lookup(x); return '<li><span><a href="' + esc(l.href) + '">' + esc(l.name) + '</a><br><span class="meta">' + esc(l.sub) + '</span></span><button class="btn sm" data-rm="' + esc(x) + '" aria-label="Remove ' + esc(l.name) + ' from saved">Remove</button></li>'; }).join('') + '</ul>' +
          '<a class="btn pri" id="planfrom" href="/builder/index.html?saved=1">Plan a trip from these</a>'
          : '<p class="cov">Nothing saved yet. Use Save to a trip on a park or a place.</p>');
    }
    var L = layer({ cls: 'drawer', id: 'saveddrawer', label: 'My saved places', html: html(), opener: opener, onClose: function () { document.removeEventListener('saved-changed', redraw); } });
    function redraw() {
      var focusRm = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-rm');
      L.panel.innerHTML = html();
      var x = L.panel.querySelector('[data-close]'); if (x) x.onclick = L.close;
      L.panel.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { toggleSaved(b.dataset.rm); }; });
      var next = (focusRm && L.panel.querySelector('[data-rm]')) || L.panel.querySelector('[data-close]'); if (next) next.focus();
    }
    L.panel.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { toggleSaved(b.dataset.rm); }; });
    document.addEventListener('saved-changed', redraw);
  }
  window.APP = { esc: esc, slugify: slugify, getSaved: getSaved, isSaved: isSaved, toggleSaved: toggleSaved, placeSlug: placeSlug, toast: toast, header: header, openSaved: openSaved, layer: layer, ph: ph, icon: icon };
})();
