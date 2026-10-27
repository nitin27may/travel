(function () {
  var P = PROTO, L = LIB, A = APP, esc = A.esc;
  A.header('Parks');
  var CODES = {}; P.PARKS.forEach(function (p) { CODES[p.rc] = p.region; });
  var COUNTRIES = { ca: 'Canada', us: 'United States' };
  var st = readUrl(), openMenu = null;

  function readUrl() {
    var u = new URLSearchParams(location.search), d = (u.get('drive') || '').split('-');
    return { q: u.get('q') || '', country: u.get('country') || '', region: u.get('region') || '', k: (u.get('k') || '').split(',').filter(Boolean),
      season: (u.get('season') || '').split(',').filter(Boolean), drive: d.length === 2 && P.HUBS[d[0]] && +d[1] >= 1 && +d[1] <= 4 ? { hub: d[0], band: +d[1] } : null,
      view: u.get('view') || 'list', sort: u.get('sort') || '' };
  }
  function writeUrl() {
    var u = new URLSearchParams();
    if (st.q) u.set('q', st.q); if (st.country) u.set('country', st.country); if (st.region) u.set('region', st.region);
    if (st.k.length) u.set('k', st.k.join(',')); if (st.season.length) u.set('season', st.season.join(','));
    if (st.drive) u.set('drive', st.drive.hub + '-' + st.drive.band);
    if (st.view !== 'list') u.set('view', st.view); if (st.sort) u.set('sort', st.sort);
    var s = u.toString(); history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  var listed = P.PARKS.filter(function (p) { return p.kind !== 'zone'; });
  function mIdx(a) { return L.MON.map(function (m) { return m.toLowerCase(); }).indexOf(a); }
  function seasonMatch(p) {
    if (!st.season.length) return true;
    if (p.season.kind === 'none') return true; // stays, in the "not checked" group
    return st.season.some(function (s) { return s === 'all' ? p.season.kind === 'allyear' : ['open', 'part'].indexOf(L.monthStatus(p.season, mIdx(s))) >= 0; });
  }
  function driveMin(p) { return st.drive ? p.drive[st.drive.hub] : null; }
  function match(p, skip) {
    if (skip !== 'where') { if (st.country && p.cc.toLowerCase() !== st.country) return false; if (st.region && p.rc !== st.region) return false; }
    if (skip !== 'type' && st.k.length && st.k.indexOf(P.KIND_TYPE[p.kind]) < 0) return false;
    if (skip !== 'season' && !seasonMatch(p)) return false;
    if (skip !== 'drive' && st.drive) { var m = p.drive[st.drive.hub]; if (m == null || m > st.drive.band * 60) return false; }
    if (skip !== 'q' && st.q) { var q = st.q.toLowerCase(); if ((p.name + ' ' + p.region + ' ' + p.country).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }
  function results() { return listed.filter(function (p) { return match(p); }); }
  function count(skip, fn) { return listed.filter(function (p) { return match(p, skip) && (!fn || fn(p)); }).length; }
  function hm(min) { return Math.floor(min / 60) + ' h ' + ('0' + (min % 60)).slice(-2); }
  function sortKey() { return st.sort || (st.drive ? 'drive' : 'draw'); }
  function sorted(a) {
    var k = sortKey();
    return a.slice().sort(function (x, y) {
      if (k === 'name') return x.name.localeCompare(y.name);
      if (k === 'drive' && st.drive) return (x.drive[st.drive.hub] == null ? 9e9 : x.drive[st.drive.hub]) - (y.drive[st.drive.hub] == null ? 9e9 : y.drive[st.drive.hub]);
      return x.worth - y.worth;
    });
  }
  function seasonWords() { return st.season.map(function (s) { return s === 'all' ? 'Open all year' : L.MONFULL[mIdx(s)]; }); }

  /* chips: entry then season; at most two */
  function chips(p) {
    var e = p.entry === 'not_checked' ? '<span class="chip gap">Entry not checked yet</span>' : '<span class="chip">' + esc(P.ENTRY_LABEL[p.entry]) + '</span>';
    var sl = L.seasonLabel(p.season), s = sl ? '<span class="chip">' + esc(sl) + '</span>' : '<span class="chip gap">Season not checked</span>';
    return e + s;
  }
  function meta(p, groupedByRegion) {
    var parts = [P.KIND_LABEL[p.kind]];
    if (!groupedByRegion) parts.push(p.region);
    var d = driveMin(p); if (st.drive && d != null) parts.push('≈ ' + hm(d) + ' from ' + P.HUBS[st.drive.hub]);
    if (p.places) parts.push(p.places + ' places inside');
    return parts.join(' · ');
  }
  function row(p, byRegion) {
    var gl = p.level === 'full' ? '' : 'PK';
    return '<a class="prow" href="park.html?slug=' + p.slug + '"><span class="ph">' + gl + '</span><div><b>' + esc(p.name) + '</b><div class="ml">' + esc(meta(p, byRegion)) + '</div><div class="chips">' + chips(p) + '</div></div><span aria-hidden="true">›</span></a>';
  }
  function groups(res) {
    var byRegion = !!st.country, out = [], seasonSet = st.season.length > 0;
    var sets = seasonSet ? [['open', res.filter(function (p) { return p.season.kind !== 'none'; })], ['unknown', res.filter(function (p) { return p.season.kind === 'none'; })]] : [['', res]];
    sets.forEach(function (s) {
      var m = {}, order = [];
      sorted(s[1]).forEach(function (p) { var key = byRegion ? p.region : p.country; if (!m[key]) { m[key] = []; order.push(key); } m[key].push(p); });
      order.forEach(function (key) {
        var pre = s[0] === 'open' ? 'Open in ' + seasonWords().join(', ') + ' · ' : s[0] === 'unknown' ? 'Season not checked · ' : '';
        var area = byRegion ? (COUNTRIES[st.country] + ' · ' + key) : key;
        out.push({ head: pre + area, tag: s[0], items: m[key], byRegion: byRegion });
      });
    });
    return out;
  }

  function renderList() {
    var res = results(), el = document.getElementById('list'), sb = document.getElementById('subbar');
    var n = activeCount();
    sb.innerHTML = '<span>' + res.length + ' park' + (res.length === 1 ? '' : 's') + (n ? ' · <button class="linkbtn" id="clr">Clear all</button>' : '') + '</span>' +
      '<span class="sortw">Sort <select id="sort" aria-label="Sort">' + sortOpts() + '</select></span>' +
      '<button class="btn sm filtersbtn" id="fbtn">Filters' + (n ? ' (' + n + ')' : '') + '</button>' +
      '<span class="seg phone" role="group" aria-label="View"><button data-v="list" aria-pressed="' + (st.view !== 'map') + '">List</button><button data-v="map" aria-pressed="' + (st.view === 'map') + '">Map</button></span>';
    if (n) sb.querySelector('#clr').onclick = function () { st = { q: '', country: '', region: '', k: [], season: [], drive: null, view: st.view, sort: '' }; document.getElementById('q').value = ''; document.getElementById('q2').value = ''; update(); };
    sb.querySelector('#sort').onchange = function (e) { st.sort = e.target.value === (st.drive ? 'drive' : 'draw') ? '' : e.target.value; update(); };
    sb.querySelector('#fbtn').onclick = function (e) { showMenu(e.currentTarget, 'filters'); };
    sb.querySelectorAll('.seg.phone button').forEach(function (b) { b.onclick = function () { st.view = b.dataset.v; update(); }; });
    document.title = 'Parks (prototype) · ' + res.length;
    if (!res.length) { el.innerHTML = emptyHtml(); wireEmpty(); return; }
    if (st.view === 'cards') {
      el.innerHTML = groups(res).map(function (g) { return '<div class="cgroup"><span class="cap">' + esc(g.head) + '</span><span class="meta">' + g.items.length + '</span></div><div class="pgrid">' + g.items.map(function (p) {
        return '<a class="pk" href="park.html?slug=' + p.slug + '"><div class="ph">' + (p.level === 'full' ? '' : 'PK') + '</div><div class="bd"><b>' + esc(p.name) + '</b><div class="ml">' + esc(meta(p, g.byRegion)) + '</div><div class="chips">' + chips(p) + '</div></div></a>'; }).join('') + '</div>'; }).join('') + pager(res);
    } else if (st.view === 'map') { el.innerHTML = mapHtml(res); wireMap(res); }
    else {
      el.innerHTML = groups(res).map(function (g, i) { return '<div class="cgroup' + (g.tag === 'unknown' && i ? ' second' : '') + '"><span class="cap">' + esc(g.head) + '</span><span class="meta">' + g.items.length + '</span></div>' + g.items.map(function (p) { return row(p, g.byRegion); }).join(''); }).join('') + pager(res);
    }
  }
  function pager(res) { return '<p class="meta">‹ 1 › &nbsp; 1 to ' + res.length + ' of ' + res.length + '</p>'; }
  function sortOpts() {
    var cur = sortKey(), o = [['draw', 'Most worth it'], ['name', 'Name']]; if (st.drive) o.push(['drive', 'Drive time']);
    return o.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === cur ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
  }
  function activeCount() { return (st.q ? 1 : 0) + (st.country ? 1 : 0) + (st.k.length ? 1 : 0) + (st.season.length ? 1 : 0) + (st.drive ? 1 : 0); }
  function emptyHtml() {
    var order = [['season', 'Open in'], ['drive', 'Drive time'], ['type', 'Type'], ['where', 'Where'], ['q', 'Search']], act = { season: st.season.length, drive: st.drive, type: st.k.length, where: st.country, q: st.q }, pick = null;
    order.forEach(function (o) { if (!pick && act[o[0]]) pick = o; });
    var w = pick ? count(pick[0]) : listed.length;
    return '<div class="empty"><b>No parks match</b><p>' + (pick ? 'Without “' + pick[1] + '” there ' + (w === 1 ? 'is 1 park' : 'are ' + w) + '.' : 'Nothing to show.') + '</p>' + (pick ? '<button class="btn pri" id="rm" data-k="' + pick[0] + '">Remove ' + pick[1] + '</button>' : '') + '</div>';
  }
  function wireEmpty() { var b = document.getElementById('rm'); if (b) b.onclick = function () { clearOne(b.dataset.k); update(); }; }
  function clearOne(k) { if (k === 'season') st.season = []; if (k === 'drive') st.drive = null; if (k === 'type') st.k = []; if (k === 'where') { st.country = ''; st.region = ''; } if (k === 'q') { st.q = ''; document.getElementById('q').value = ''; document.getElementById('q2').value = ''; } }

  /* map view */
  function mapHtml(res) {
    var la = res.map(function (p) { return p.ll[0]; }), lo = res.map(function (p) { return p.ll[1]; });
    var a = Math.min.apply(0, la), b = Math.max.apply(0, la), c = Math.min.apply(0, lo), d = Math.max.apply(0, lo);
    var pa = Math.max((b - a) * .2, 1), pc = Math.max((d - c) * .2, 1); a -= pa; b += pa; c -= pc; d += pc;
    var pins = res.map(function (p) {
      var x = (p.ll[1] - c) / (d - c) * 100, y = (1 - (p.ll[0] - a) / (b - a)) * 100;
      return '<button class="pin" data-s="' + p.slug + '" style="left:' + x + '%;top:' + y + '%" aria-label="' + esc(p.name) + '"></button><span class="lbl" style="left:' + x + '%;top:' + y + '%">' + esc(p.name.replace(/ (National|Provincial) Park/, '')) + '</span>';
    }).join('');
    return '<div class="bigmap" id="bigmap">' + pins + '<div class="peek" id="peek" hidden></div></div><p class="meta">Pins mark each park’s main visitor centre or map point; no park boundary is drawn. This is a stand-in map. <button class="linkbtn" data-v="list" id="tolist">List</button></p>';
  }
  function wireMap(res) {
    document.getElementById('tolist').onclick = function () { st.view = 'list'; update(); };
    document.querySelectorAll('#bigmap .pin').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#bigmap .pin').forEach(function (x) { x.classList.toggle('sel', x === b); });
        var p = P.PARKS.filter(function (x) { return x.slug === b.dataset.s; })[0], pk = document.getElementById('peek'); pk.hidden = false;
        pk.innerHTML = '<b>' + esc(p.name) + '</b><div class="meta">' + esc(meta(p, false)) + '</div><div class="chips">' + chips(p) + '</div><p><a class="btn pri" href="park.html?slug=' + p.slug + '">Open park</a></p>';
      };
    });
  }

  /* pills */
  function whereLabel() { if (!st.country) return 'Where'; return 'Where · ' + (st.region ? CODES[st.region] : COUNTRIES[st.country]); }
  function driveLabel() { return st.drive ? 'Within ' + st.drive.band + ' h of ' + P.HUBS[st.drive.hub] : 'Drive time'; }
  function typeLabel() { return st.k.length ? 'Type · ' + st.k.map(function (k) { return P.TYPES.filter(function (t) { return t[0] === k; })[0][1]; }).join(', ') : 'Type'; }
  function seasonPill() { return st.season.length ? 'Open in · ' + st.season.map(function (s) { return s === 'all' ? 'all year' : L.MON[mIdx(s)]; }).join(', ') : 'Open in'; }
  function pill(id, label, on) { return '<span class="pillw' + (on ? ' on' : '') + '"><button data-p="' + id + '" aria-haspopup="true" aria-expanded="' + (openMenu === id) + '">' + esc(label) + (on ? '' : ' ▾') + '</button>' + (on ? '<button class="x" data-x="' + id + '" aria-label="Clear ' + esc(label) + '">&times;</button>' : '') + '</span>'; }
  function renderPills() {
    var el = document.getElementById('pills');
    el.innerHTML = pill('where', whereLabel(), !!st.country) + pill('type', typeLabel(), !!st.k.length) + pill('drive', driveLabel(), !!st.drive) + pill('season', seasonPill(), !!st.season.length);
    el.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { showMenu(b, b.dataset.p); }; });
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { clearOne(b.dataset.x === 'drive' ? 'drive' : b.dataset.x === 'type' ? 'type' : b.dataset.x); closeMenu(); update(); }; });
    var v = document.getElementById('views'); v.innerHTML = ['list', 'cards', 'map'].map(function (x) { return '<button data-v="' + x + '" aria-pressed="' + (st.view === x || (x === 'list' && !/cards|map/.test(st.view))) + '">' + x[0].toUpperCase() + x.slice(1) + '</button>'; }).join('');
    v.querySelectorAll('button').forEach(function (b) { b.onclick = function () { st.view = b.dataset.v; update(); }; });
  }

  /* menus */
  var anchor = null;
  function showMenu(btn, id) { if (openMenu === id) { closeMenu(); return; } openMenu = id; anchor = btn; drawMenu(); }
  function closeMenu() { openMenu = null; var m = document.getElementById('menu'); m.hidden = true; renderPills(); }
  function drawMenu() {
    var m = document.getElementById('menu'), id = openMenu, h = '';
    if (id === 'where') {
      h = '<h4>Country</h4>';
      Object.keys(COUNTRIES).forEach(function (c) {
        h += '<button class="opt" role="menuitemradio" aria-checked="' + (st.country === c && !st.region) + '" data-where="' + c + '">' + COUNTRIES[c] + '<span class="n">' + count('where', function (p) { return p.cc.toLowerCase() === c; }) + '</span></button>';
        var rs = {}; listed.forEach(function (p) { if (p.cc.toLowerCase() === c) rs[p.rc] = p.region; });
        if (st.country === c) Object.keys(rs).sort().forEach(function (r) { h += '<button class="opt sub" role="menuitemradio" aria-checked="' + (st.region === r) + '" data-where="' + c + ':' + r + '">' + rs[r] + '<span class="n">' + count('where', function (p) { return p.rc === r; }) + '</span></button>'; });
      });
      h += '<button class="linkbtn" data-where="">Any country</button>';
    } else if (id === 'type') {
      h = '<h4>Type</h4>' + P.TYPES.map(function (t) { return '<button class="opt" role="menuitemcheckbox" aria-checked="' + (st.k.indexOf(t[0]) >= 0) + '" data-type="' + t[0] + '">' + (st.k.indexOf(t[0]) >= 0 ? '☑ ' : '☐ ') + t[1] + '<span class="n">' + count('type', function (p) { return P.KIND_TYPE[p.kind] === t[0]; }) + '</span></button>'; }).join('');
    } else if (id === 'season') {
      h = '<h4>Open in</h4><div class="mg">' + L.MON.map(function (mm, i) { var k = mm.toLowerCase(); return '<button data-season="' + k + '" aria-pressed="' + (st.season.indexOf(k) >= 0) + '">' + mm + '</button>'; }).join('') + '</div>' +
        '<button class="opt" role="menuitemcheckbox" aria-checked="' + (st.season.indexOf('all') >= 0) + '" data-season="all">' + (st.season.indexOf('all') >= 0 ? '☑ ' : '☐ ') + 'Open all year<span class="n">' + count('season', function (p) { return p.season.kind === 'allyear'; }) + '</span></button>' +
        '<p class="meta">Parks with no checked season stay in the list, under “Season not checked” (' + count('season', function (p) { return p.season.kind === 'none'; }) + ').</p>';
    } else if (id === 'drive') {
      var hub = st.drive ? st.drive.hub : (m.dataset.hub || 'toronto');
      h = '<h4>From</h4>' + Object.keys(P.HUBS).map(function (k) { return '<button class="opt" role="menuitemradio" aria-checked="' + (hub === k) + '" data-hub="' + k + '">' + P.HUBS[k] + '</button>'; }).join('') +
        '<h4>Up to</h4><div class="bands">' + [1, 2, 3, 4].map(function (b) { var n = listed.filter(function (p) { return match(p, 'drive') && p.drive[hub] != null && p.drive[hub] <= b * 60; }).length; return '<button data-band="' + b + '" data-h="' + hub + '" aria-pressed="' + (st.drive && st.drive.hub === hub && st.drive.band === b) + '"' + (n ? '' : ' disabled') + '>' + b + ' h<small>' + n + '</small></button>'; }).join('') + '</div>' +
        '<p class="meta">Approximate drive times from a public hub; placeholders in this prototype. URL value: ' + hub + '-&lt;band&gt;.</p>';
      m.dataset.hub = hub;
    } else if (id === 'filters') {
      h = '<h4>Sort</h4>' + [['draw', 'Most worth it'], ['name', 'Name']].concat(st.drive ? [['drive', 'Drive time']] : []).map(function (o) { return '<button class="opt" role="menuitemradio" aria-checked="' + (sortKey() === o[0]) + '" data-sort="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '<p class="meta">Where, Type, Drive time and Open in are the pills above.</p>';
    }
    m.innerHTML = h; m.hidden = false;
    var an = document.querySelector(id === 'filters' ? '#fbtn' : '[data-p="' + id + '"]') || anchor, r = an.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - 270) + 'px'; m.style.top = (r.bottom + 6) + 'px';
    m.querySelectorAll('[data-where]').forEach(function (b) { b.onclick = function () { var v = b.dataset.where.split(':'); st.country = v[0]; st.region = v[1] || ''; if (!st.country) closeMenuKeep(); update(); }; });
    m.querySelectorAll('[data-type]').forEach(function (b) { b.onclick = function () { var i = st.k.indexOf(b.dataset.type); if (i >= 0) st.k.splice(i, 1); else st.k.push(b.dataset.type); update(); }; });
    m.querySelectorAll('[data-season]').forEach(function (b) { b.onclick = function () { var i = st.season.indexOf(b.dataset.season); if (i >= 0) st.season.splice(i, 1); else st.season.push(b.dataset.season); update(); }; });
    m.querySelectorAll('[data-hub]').forEach(function (b) { b.onclick = function () { m.dataset.hub = b.dataset.hub; if (st.drive) st.drive.hub = b.dataset.hub; drawMenu(); update(true); }; });
    m.querySelectorAll('[data-band]').forEach(function (b) { b.onclick = function () { var same = st.drive && st.drive.hub === b.dataset.h && st.drive.band === +b.dataset.band; st.drive = same ? null : { hub: b.dataset.h, band: +b.dataset.band }; update(); }; });
    m.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { st.sort = b.dataset.sort === (st.drive ? 'drive' : 'draw') ? '' : b.dataset.sort; update(); }; });
  }
  function closeMenuKeep() {}
  document.addEventListener('click', function (e) { if (openMenu && e.target.isConnected && !e.target.closest('#menu') && !e.target.closest('.pillw') && !e.target.closest('#fbtn')) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openMenu) closeMenu(); });
  window.addEventListener('resize', function () { if (openMenu) drawMenu(); });

  function update(keepMenu) { writeUrl(); renderPills(); renderList(); if (openMenu && !keepMenu) drawMenu(); }
  ['q', 'q2'].forEach(function (id) { document.getElementById(id).oninput = function (e) { st.q = e.target.value; document.getElementById(id === 'q' ? 'q2' : 'q').value = st.q; writeUrl(); renderList(); }; });
  document.getElementById('q').value = st.q; document.getElementById('q2').value = st.q;
  renderPills(); renderList();
})();
