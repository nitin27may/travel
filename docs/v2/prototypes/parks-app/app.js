/* THROWAWAY prototype shared code: theme, saved store, header, drawers, toast. */
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
      (p.todo || []).forEach(function () {});
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
  function theme() { try { var t = localStorage.getItem('travel:v1:theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch (e) {} }
  theme();
  function header(active) {
    var h = document.getElementById('hdr'); if (!h) return;
    h.className = 'hdr';
    h.innerHTML = '<a class="brand" href="index.html">TRIP PLANS</a><nav><span>Trips</span><span class="cur">' + (active || 'Parks') + '</span><span>Globe</span></nav><span class="sp"></span>' +
      '<button id="savedbtn" aria-haspopup="dialog">Saved <span id="savedn">0</span></button><button id="theme" aria-label="Switch theme">Theme</button>';
    document.getElementById('theme').onclick = function () { var r = document.documentElement, n = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = n; try { localStorage.setItem('travel:v1:theme', n); } catch (e) {} };
    document.getElementById('savedbtn').onclick = openSaved;
    function upd() { document.getElementById('savedn').textContent = getSaved().length; }
    upd(); document.addEventListener('saved-changed', upd);
  }
  function openSaved() {
    var old = document.getElementById('saveddrawer'); if (old) { old.remove(); document.getElementById('savedscrim').remove(); return; }
    var sc = document.createElement('div'); sc.className = 'scrim'; sc.id = 'savedscrim';
    var d = document.createElement('aside'); d.className = 'drawer'; d.id = 'saveddrawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'My saved places');
    function close() { d.remove(); sc.remove(); document.removeEventListener('saved-changed', draw); document.removeEventListener('keydown', esck); }
    function esck(e) { if (e.key === 'Escape') close(); }
    function draw() {
      var s = getSaved();
      d.innerHTML = '<button class="btn ic x" aria-label="Close saved places" id="sclose">&times;</button><h2>My saved places</h2>' +
        (s.length ? '<ul>' + s.map(function (x) { var l = lookup(x); return '<li><span><a href="' + esc(l.href) + '">' + esc(l.name) + '</a><br><span class="meta">' + esc(l.sub) + '</span></span><button class="btn sm" data-rm="' + esc(x) + '">Remove</button></li>'; }).join('') + '</ul>' +
          '<a class="btn pri" id="planfrom" href="/builder/index.html?saved=1">Plan a trip from these</a>'
          : '<p class="cov">Nothing saved yet. Use Save to a trip on a park or a place.</p>');
      d.querySelector('#sclose').onclick = close;
      d.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { toggleSaved(b.dataset.rm); }; });
    }
    document.body.appendChild(sc); document.body.appendChild(d); draw();
    document.addEventListener('saved-changed', draw); document.addEventListener('keydown', esck); sc.onclick = close; d.querySelector('#sclose').focus();
  }
  window.APP = { esc: esc, slugify: slugify, getSaved: getSaved, isSaved: isSaved, toggleSaved: toggleSaved, placeSlug: placeSlug, toast: toast, header: header, openSaved: openSaved };
})();
