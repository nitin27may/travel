(function () {
  var P = PROTO, L = LIB, A = APP, esc = A.esc;
  A.header('Parks');
  var CODES = {}; P.PARKS.forEach(function (p) { CODES[p.rc] = p.region; });
  var COUNTRIES = { ca: 'Canada', us: 'United States' };
  var RAW = new URLSearchParams(location.search);
  var st = readUrl(), openMenu = null, mapHandle = null, lastSig = null;
  /* `ps` overrides the page size so the pager can be tried with 10 parks (prototype only); the default is 20 */
  var PAGE_SIZE = Math.max(1, +RAW.get('ps') || P.PAGE_SIZE);

  function readUrl() {
    var u = RAW, d = (u.get('drive') || '').split('-');
    return { q: u.get('q') || '', country: u.get('country') || '', region: u.get('region') || '', k: (u.get('k') || '').split(',').filter(Boolean),
      season: (u.get('season') || '').split(',').filter(Boolean), drive: d.length === 2 && P.HUBS[d[0]] && +d[1] >= 1 && +d[1] <= 4 ? { hub: d[0], band: +d[1] } : null,
      view: ['cards', 'map'].indexOf(u.get('view')) >= 0 ? u.get('view') : 'list', sort: u.get('sort') || '', page: Math.max(1, +u.get('page') || 1) };
  }
  function writeUrl() {
    var u = new URLSearchParams();
    if (st.q) u.set('q', st.q); if (st.country) u.set('country', st.country); if (st.region) u.set('region', st.region);
    if (st.k.length) u.set('k', st.k.join(',')); if (st.season.length) u.set('season', st.season.join(','));
    if (st.drive) u.set('drive', st.drive.hub + '-' + st.drive.band);
    if (st.view !== 'list') u.set('view', st.view); if (st.sort) u.set('sort', st.sort);
    if (st.page > 1) u.set('page', st.page);
    if (RAW.get('ps')) u.set('ps', RAW.get('ps'));
    var s = u.toString(); history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  function filterSig() { return JSON.stringify([st.q, st.country, st.region, st.k, st.season, st.drive, st.sort]); }
  var listed = P.PARKS.filter(function (p) { return p.kind !== 'zone'; });
  function mIdx(a) { return L.MON.map(function (m) { return m.toLowerCase(); }).indexOf(a); }
  function seasonMatch(p) {
    if (!st.season.length) return true;
    if (p.season.kind === 'none') return true; // stays, in the "not checked" group
    return st.season.some(function (s) { return s === 'all' ? p.season.kind === 'allyear' : ['open', 'part'].indexOf(L.monthStatus(p.season, mIdx(s))) >= 0; });
  }
  /* sort: draw | name | drive-<hub>. A drive filter makes its hub the default sort; "drive" alone is read as the filter's hub (or Toronto). */
  function sortKey() {
    var k = st.sort;
    if (k === 'drive') k = 'drive-' + (st.drive ? st.drive.hub : 'toronto');
    if (k && (k === 'draw' || k === 'name' || (k.indexOf('drive-') === 0 && P.HUBS[k.slice(6)]))) return k;
    return st.drive ? 'drive-' + st.drive.hub : 'draw';
  }
  function defaultSort() { return st.drive ? 'drive-' + st.drive.hub : 'draw'; }
  function sortHub() { var k = sortKey(); return k.indexOf('drive-') === 0 ? k.slice(6) : null; }
  function metaHub() { return sortHub() || (st.drive && st.drive.hub) || null; }
  function match(p, skip) {
    if (skip !== 'where') { if (st.country && p.cc.toLowerCase() !== st.country) return false; if (st.region && p.rc !== st.region) return false; }
    if (skip !== 'type' && st.k.length && st.k.indexOf(P.KIND_TYPE[p.kind]) < 0) return false;
    if (skip !== 'season' && !seasonMatch(p)) return false;
    if (skip !== 'drive' && st.drive) { var m = P.driveFrom(p, st.drive.hub); if (m == null || m > st.drive.band * 60) return false; }
    if (skip !== 'q' && st.q) { var q = st.q.toLowerCase(); if ((p.name + ' ' + p.region + ' ' + p.country).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }
  function results() { return listed.filter(function (p) { return match(p); }); }
  function count(skip, fn) { return listed.filter(function (p) { return match(p, skip) && (!fn || fn(p)); }).length; }
  function hm(min) { return Math.floor(min / 60) + ' h ' + ('0' + (min % 60)).slice(-2); }
  function sorted(a) {
    var k = sortKey(), hub = sortHub();
    return a.slice().sort(function (x, y) {
      if (k === 'name') return x.name.localeCompare(y.name);
      if (hub) { var dx = P.driveFrom(x, hub), dy = P.driveFrom(y, hub); return (dx == null ? 9e9 : dx) - (dy == null ? 9e9 : dy) || x.worth - y.worth; }
      return x.worth - y.worth;
    });
  }
  function seasonWords() { return st.season.map(function (s) { return s === 'all' ? 'Open all year' : L.MONFULL[mIdx(s)]; }); }

  /* chips come from P.facts(), the function the park page glance reads, so index and page cannot disagree */
  function chips(p) {
    var f = P.facts(p);
    function c(k) { return '<span class="chip' + (f[k].gap ? ' gap' : '') + '" data-fact="' + k + '">' + esc(f[k].text) + '</span>'; }
    return c('season') + c('entry') + c('camping') + (p.placeholder || f.camping.ph ? A.ph() : '');
  }
  function meta(p, groupedByRegion, noCount) {
    var parts = [P.KIND_LABEL[p.kind]];
    if (!groupedByRegion) parts.push(p.region);
    var hub = metaHub(), d = hub ? P.driveFrom(p, hub) : null; if (hub && d != null) parts.push('≈ ' + hm(d) + ' from ' + P.HUBS[hub]);
    if (p.places && !noCount) parts.push(p.places + ' places inside');
    return parts.join(' · ');
  }
  function href(p) { return 'park.html?slug=' + p.slug; }
  function row(p, byRegion, n) {
    return '<a class="prow" href="' + href(p) + '"><span class="ph" aria-hidden="true"></span><div><b>' + (n ? '<span class="num">' + n + '</span> ' : '') + esc(p.name) + '</b><div class="ml">' + esc(meta(p, byRegion)) + '</div><div class="chips">' + chips(p) + '</div></div><span aria-hidden="true">›</span></a>';
  }
  function card(p, byRegion) {
    return '<a class="pk" href="' + href(p) + '"><div class="ph" role="img" aria-label="Photo placeholder"><span>Photo placeholder</span></div><div class="bd"><b>' + esc(p.name) + '</b><div class="cnt"><span class="big">' + p.places + '</span> places inside</div><div class="ml">' + esc(meta(p, byRegion, true)) + '</div><div class="chips">' + chips(p) + '</div></div></a>';
  }
  /* groups: by country or region; with a season filter, "Open in" then "Season not checked"; with a drive sort, nearest first
     and the parks that have no value for that hub last, under "Drive time not set" */
  function groups(res) {
    var byRegion = !!st.country, out = [], seasonSet = st.season.length > 0, hub = sortHub();
    var sets = seasonSet ? [['open', res.filter(function (p) { return p.season.kind !== 'none'; })], ['unknown', res.filter(function (p) { return p.season.kind === 'none'; })]] : [['', res]];
    sets.forEach(function (s) {
      var pre = s[0] === 'open' ? 'Open in ' + seasonWords().join(', ') + ' · ' : s[0] === 'unknown' ? 'Season not checked · ' : '';
      if (hub) {
        var has = sorted(s[1].filter(function (p) { return P.driveFrom(p, hub) != null; })), none = sorted(s[1].filter(function (p) { return P.driveFrom(p, hub) == null; }));
        if (has.length) out.push({ head: pre + 'Nearest first · from ' + P.HUBS[hub], tag: s[0], items: has, byRegion: false });
        if (none.length) out.push({ head: pre + 'Drive time not set', tag: 'nodrive', items: none, byRegion: false });
        return;
      }
      var m = {}, order = [];
      sorted(s[1]).forEach(function (p) { var key = byRegion ? p.region : p.country; if (!m[key]) { m[key] = []; order.push(key); } m[key].push(p); });
      order.forEach(function (key) {
        var area = byRegion ? (COUNTRIES[st.country] + ' · ' + key) : key;
        out.push({ head: pre + area, tag: s[0], items: m[key], byRegion: byRegion });
      });
    });
    return out;
  }
  /* 20 per page across the groups, in order */
  function paged(gs, total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); st.page = Math.min(Math.max(1, st.page), pages);
    var start = (st.page - 1) * PAGE_SIZE, end = start + PAGE_SIZE, i = 0, out = [];
    gs.forEach(function (g) {
      var items = g.items.filter(function (_, k) { return i + k >= start && i + k < end; });
      i += g.items.length;
      if (items.length) out.push({ head: g.head, tag: g.tag, byRegion: g.byRegion, items: items, total: g.items.length, offset: i - g.items.length });
    });
    return { groups: out, pages: pages, start: start, end: Math.min(end, total), total: total };
  }
  function pagerHtml(pg) {
    var p = st.page, nums = '';
    for (var i = 1; i <= pg.pages; i++) nums += '<button data-page="' + i + '"' + (i === p ? ' aria-current="page" id="pgcur"' : '') + ' aria-label="Page ' + i + '">' + i + '</button>';
    return '<nav class="pager" aria-label="Pages"><button data-page="' + (p - 1) + '"' + (p <= 1 ? ' disabled' : '') + ' aria-label="Previous page">‹</button>' + (pg.pages <= 9 ? nums : '<span class="meta">Page ' + p + ' of ' + pg.pages + '</span>') +
      '<button data-page="' + (p + 1) + '"' + (p >= pg.pages ? ' disabled' : '') + ' aria-label="Next page">›</button><span class="meta">' + (pg.start + 1) + ' to ' + pg.end + ' of ' + pg.total + '</span></nav>';
  }

  function renderList() {
    var res = results(), el = document.getElementById('list'), sb = document.getElementById('subbar');
    var n = activeCount();
    if (mapHandle) { mapHandle.destroy(); mapHandle = null; }
    sb.innerHTML = '<span>' + res.length + ' park' + (res.length === 1 ? '' : 's') + (n ? ' · <button class="linkbtn" id="clr">Clear all</button>' : '') + '</span>' +
      '<span class="sortw"><label for="sort">Sort</label> <select id="sort">' + sortOpts() + '</select></span>' +
      '<button class="btn sm filtersbtn" id="fbtn" aria-haspopup="dialog">Filters' + (n ? ' (' + n + ')' : '') + '</button>' +
      '<span class="seg phone" role="group" aria-label="View">' + ['list', 'cards', 'map'].map(function (v) { return '<button data-v="' + v + '" aria-pressed="' + (st.view === v) + '">' + v[0].toUpperCase() + v.slice(1) + '</button>'; }).join('') + '</span>';
    if (n) sb.querySelector('#clr').onclick = function () { st = { q: '', country: '', region: '', k: [], season: [], drive: null, view: st.view, sort: '', page: 1 }; document.getElementById('q').value = ''; document.getElementById('q2').value = ''; update(); };
    sb.querySelector('#sort').onchange = function (e) { st.sort = e.target.value === defaultSort() ? '' : e.target.value; update(); };
    sb.querySelector('#fbtn').onclick = function (e) { showMenu(e.currentTarget, 'filters'); };
    sb.querySelectorAll('.seg.phone button').forEach(function (b) { b.onclick = function () { st.view = b.dataset.v; update(); }; });
    document.title = 'Parks (prototype) · ' + res.length;
    document.getElementById('live').textContent = res.length + ' park' + (res.length === 1 ? '' : 's') + ', ' + st.view + ' view';
    if (!res.length) { el.innerHTML = emptyHtml(); wireEmpty(); return; }
    var pg = paged(groups(res), res.length);
    if (st.view === 'cards') {
      el.innerHTML = pg.groups.map(function (g) { return '<div class="cgroup"><h2 class="cap">' + esc(g.head) + '</h2><span class="meta">' + g.total + '</span></div><div class="pgrid">' + g.items.map(function (p) { return card(p, g.byRegion); }).join('') + '</div>'; }).join('') + pagerHtml(pg);
    } else if (st.view === 'map') {
      var flat = []; pg.groups.forEach(function (g) { g.items.forEach(function (p) { flat.push({ p: p, byRegion: g.byRegion }); }); });
      el.innerHTML = '<div class="mapwrap"><div class="mapcol"><div class="mapbox" id="mapbox"></div><p class="meta">Pins mark each park’s map point; no park boundary is drawn. Tap a pin to open the park. This is a stand-in map without tiles.</p></div>' +
        '<div class="maplist" id="maplist">' + flat.map(function (x, i) { return row(x.p, x.byRegion, pg.start + i + 1); }).join('') + '</div></div>' + pagerHtml(pg);
      wireMap(flat.map(function (x) { return x.p; }), pg.start);
    } else {
      el.innerHTML = pg.groups.map(function (g, i) { return '<div class="cgroup' + (i ? ' second' : '') + '"><h2 class="cap">' + esc(g.head) + '</h2><span class="meta">' + g.total + '</span></div>' + g.items.map(function (p) { return row(p, g.byRegion); }).join(''); }).join('') + pagerHtml(pg);
    }
    el.querySelectorAll('.pager [data-page]').forEach(function (b) { b.onclick = function () { st.page = +b.dataset.page; writeUrl(); renderList(); var c = document.getElementById('pgcur'); if (c) c.focus({ preventScroll: true }); window.scrollTo(0, 0); }; });
  }
  function sortOpts() {
    var cur = sortKey(), o = [['draw', 'Most worth it'], ['name', 'Name']];
    Object.keys(P.HUBS).forEach(function (h) { o.push(['drive-' + h, 'Drive time from ' + P.HUBS[h]]); });
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

  /* map view: shared/map.js with one pin per park on this page; a pin opens the park. map.js numbers pins within a day, so each park is
     its own one-stop day and the pin number and name are rewritten to the list position (and kept when map.js redraws on resize). */
  function wireMap(ps, offset) {
    var host = document.getElementById('mapbox'), sel = null;
    function opts() {
      return { days: ps.map(function (p, i) { return { n: offset + i + 1, points: [{ id: p.slug, lat: p.ll[0], lon: p.ll[1], label: p.name }] }; }), selected: sel, height: 440,
        label: 'Map of ' + ps.length + ' parks; each pin opens its park', onPin: function (id) { location.href = 'park.html?slug=' + id; } };
    }
    mapHandle = ProtoMap.render(host, opts());
    function patch() {
      mo.disconnect();
      host.querySelectorAll('[data-pin]').forEach(function (g) {
        var i = ps.map(function (p) { return p.slug; }).indexOf(g.getAttribute('data-pin')), p = ps[i]; if (!p) return;
        g.setAttribute('aria-label', 'Open ' + p.name + ', park ' + (offset + i + 1) + ' of the list');
        var t = g.querySelector('text'); if (t && t.getAttribute('aria-hidden') === 'true' && !t.getAttribute('x')) t.textContent = String(offset + i + 1);
      });
      mo.observe(mapHandle.svg, { childList: true });
    }
    var mo = new MutationObserver(patch); patch();
    document.querySelectorAll('#maplist .prow').forEach(function (r, i) {
      function on() { sel = ps[i].slug; mapHandle.update(opts()); }
      r.addEventListener('mouseenter', on); r.addEventListener('focus', on);
    });
  }

  /* pills */
  function whereLabel() { if (!st.country) return 'Where'; return 'Where · ' + (st.region ? CODES[st.region] : COUNTRIES[st.country]); }
  function driveLabel() { return st.drive ? 'Within ' + st.drive.band + ' h of ' + P.HUBS[st.drive.hub] : 'Drive time'; }
  function typeLabel() { return st.k.length ? 'Type · ' + st.k.map(function (k) { return P.TYPES.filter(function (t) { return t[0] === k; })[0][1]; }).join(', ') : 'Type'; }
  function seasonPill() { return st.season.length ? 'Open in · ' + st.season.map(function (s) { return s === 'all' ? 'all year' : L.MON[mIdx(s)]; }).join(', ') : 'Open in'; }
  function pill(id, label, on) { return '<span class="pillw' + (on ? ' on' : '') + '"><button data-p="' + id + '" aria-haspopup="dialog" aria-expanded="' + (openMenu === id) + '">' + esc(label) + (on ? '' : ' ▾') + '</button>' + (on ? '<button class="x" data-x="' + id + '" aria-label="Clear ' + esc(label) + '">&times;</button>' : '') + '</span>'; }
  function renderPills() {
    var el = document.getElementById('pills');
    el.innerHTML = pill('where', whereLabel(), !!st.country) + pill('type', typeLabel(), !!st.k.length) + pill('drive', driveLabel(), !!st.drive) + pill('season', seasonPill(), !!st.season.length);
    el.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { showMenu(b, b.dataset.p); }; });
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { clearOne(b.dataset.x); closeMenu(); update(); }; });
    var v = document.getElementById('views'); v.innerHTML = ['list', 'cards', 'map'].map(function (x) { return '<button data-v="' + x + '" aria-pressed="' + (st.view === x) + '">' + x[0].toUpperCase() + x.slice(1) + '</button>'; }).join('');
    v.querySelectorAll('button').forEach(function (b) { b.onclick = function () { st.view = b.dataset.v; update(); }; });
  }

  /* menus: a popover (a bottom sheet on a phone) that takes focus, keeps Tab inside, and hands focus back to its pill on Escape */
  var anchor = null;
  function showMenu(btn, id) { if (openMenu === id) { closeMenu(true); return; } openMenu = id; anchor = btn; renderPills(); drawMenu(true); }
  function closeMenu(back) {
    var id = openMenu; openMenu = null; var m = document.getElementById('menu'); m.hidden = true; renderPills();
    if (back) { var b = document.querySelector(id === 'filters' ? '#fbtn' : '[data-p="' + id + '"]'); if (b) b.focus(); }
  }
  function btnKey(b) { for (var i = 0; i < b.attributes.length; i++) if (/^data-/.test(b.attributes[i].name)) return '[' + b.attributes[i].name + '="' + b.attributes[i].value + '"]'; return null; }
  function drawMenu(takeFocus) {
    var m = document.getElementById('menu'), id = openMenu, h = '';
    var had = !takeFocus && m.contains(document.activeElement) ? btnKey(document.activeElement) : null;
    if (id === 'where') {
      h = '<h4>Country</h4>';
      Object.keys(COUNTRIES).forEach(function (c) {
        h += '<button class="opt" aria-pressed="' + (st.country === c && !st.region) + '" data-where="' + c + '">' + COUNTRIES[c] + '<span class="n">' + count('where', function (p) { return p.cc.toLowerCase() === c; }) + '</span></button>';
        var rs = {}; listed.forEach(function (p) { if (p.cc.toLowerCase() === c) rs[p.rc] = p.region; });
        if (st.country === c) Object.keys(rs).sort().forEach(function (r) { h += '<button class="opt sub" aria-pressed="' + (st.region === r) + '" data-where="' + c + ':' + r + '">' + rs[r] + '<span class="n">' + count('where', function (p) { return p.rc === r; }) + '</span></button>'; });
      });
      h += '<button class="linkbtn" data-where="">Any country</button>';
    } else if (id === 'type') {
      h = '<h4>Type</h4>' + P.TYPES.map(function (t) { return '<button class="opt" aria-pressed="' + (st.k.indexOf(t[0]) >= 0) + '" data-type="' + t[0] + '"><span aria-hidden="true">' + (st.k.indexOf(t[0]) >= 0 ? '☑ ' : '☐ ') + '</span>' + t[1] + '<span class="n">' + count('type', function (p) { return P.KIND_TYPE[p.kind] === t[0]; }) + '</span></button>'; }).join('');
    } else if (id === 'season') {
      h = '<h4>Open in</h4><div class="mg">' + L.MON.map(function (mm) { var k = mm.toLowerCase(); return '<button data-season="' + k + '" aria-pressed="' + (st.season.indexOf(k) >= 0) + '">' + mm + '</button>'; }).join('') + '</div>' +
        '<button class="opt" aria-pressed="' + (st.season.indexOf('all') >= 0) + '" data-season="all"><span aria-hidden="true">' + (st.season.indexOf('all') >= 0 ? '☑ ' : '☐ ') + '</span>Open all year<span class="n">' + count('season', function (p) { return p.season.kind === 'allyear'; }) + '</span></button>' +
        '<p class="meta">Parks with no checked season stay in the list, under “Season not checked” (' + count('season', function (p) { return p.season.kind === 'none'; }) + ').</p>';
    } else if (id === 'drive') {
      var hub = st.drive ? st.drive.hub : (m.dataset.hub || 'toronto');
      h = '<h4>From</h4>' + Object.keys(P.HUBS).map(function (k) { return '<button class="opt" aria-pressed="' + (hub === k) + '" data-hub="' + k + '">' + P.HUBS[k] + '</button>'; }).join('') +
        '<h4>Up to</h4><div class="bands">' + [1, 2, 3, 4].map(function (b) { var n = listed.filter(function (p) { return match(p, 'drive') && P.driveFrom(p, hub) != null && P.driveFrom(p, hub) <= b * 60; }).length; return '<button data-band="' + b + '" data-h="' + hub + '" aria-pressed="' + (st.drive && st.drive.hub === hub && st.drive.band === b) + '"' + (n ? '' : ' disabled') + '>' + b + ' h<small>' + n + '</small></button>'; }).join('') + '</div>' +
        '<p class="meta">Approximate drive times from a public hub; invented for this prototype. URL value: ' + hub + '-&lt;band&gt;.</p>';
      m.dataset.hub = hub;
    } else if (id === 'filters') {
      h = '<h4>Sort</h4>' + sortOpts().replace(/<option value="([^"]+)"( selected)?>([^<]+)<\/option>/g, function (_, v, s, t) { return '<button class="opt" aria-pressed="' + !!s + '" data-sort="' + v + '">' + t + '</button>'; }) + '<p class="meta">Where, Type, Drive time and Open in are the pills above.</p>';
    }
    m.innerHTML = '<button class="x" data-mclose aria-label="Close ' + (id === 'filters' ? 'sort' : 'menu') + '">&times;</button>' + h; m.hidden = false;
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', id === 'filters' ? 'Sort and filters' : { where: 'Where', type: 'Type', season: 'Open in', drive: 'Drive time' }[id]);
    var an = document.querySelector(id === 'filters' ? '#fbtn' : '[data-p="' + id + '"]') || anchor, r = an.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(r.left, innerWidth - 270)) + 'px'; m.style.top = (r.bottom + 6) + 'px';
    m.querySelector('[data-mclose]').onclick = function () { closeMenu(true); };
    m.querySelectorAll('[data-where]').forEach(function (b) { b.onclick = function () { var v = b.dataset.where.split(':'); st.country = v[0]; st.region = v[1] || ''; update(); }; });
    m.querySelectorAll('[data-type]').forEach(function (b) { b.onclick = function () { var i = st.k.indexOf(b.dataset.type); if (i >= 0) st.k.splice(i, 1); else st.k.push(b.dataset.type); update(); }; });
    m.querySelectorAll('[data-season]').forEach(function (b) { b.onclick = function () { var i = st.season.indexOf(b.dataset.season); if (i >= 0) st.season.splice(i, 1); else st.season.push(b.dataset.season); update(); }; });
    m.querySelectorAll('[data-hub]').forEach(function (b) { b.onclick = function () { m.dataset.hub = b.dataset.hub; if (st.drive) st.drive.hub = b.dataset.hub; drawMenu(); update(true); }; });
    m.querySelectorAll('[data-band]').forEach(function (b) { b.onclick = function () { var same = st.drive && st.drive.hub === b.dataset.h && st.drive.band === +b.dataset.band; st.drive = same ? null : { hub: b.dataset.h, band: +b.dataset.band }; update(); }; });
    m.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { st.sort = b.dataset.sort === defaultSort() ? '' : b.dataset.sort; update(); }; });
    var target = had && m.querySelector(had) || (takeFocus && m.querySelector('button:not([disabled]):not([data-mclose])'));
    if (target) target.focus();
  }
  document.addEventListener('click', function (e) { if (openMenu && e.target.isConnected && !e.target.closest('#menu') && !e.target.closest('.pillw') && !e.target.closest('#fbtn')) closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openMenu) { e.preventDefault(); closeMenu(true); return; }
    if (e.key === 'Tab' && openMenu) {
      var f = Array.prototype.filter.call(document.getElementById('menu').querySelectorAll('button:not([disabled])'), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var inside = document.getElementById('menu').contains(document.activeElement);
      if (!inside) { e.preventDefault(); f[0].focus(); }
      else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    if (e.key === '/' && !/^(input|textarea|select)$/i.test((e.target.tagName || '')) && !openMenu) { var s = document.getElementById('q'); if (s.offsetParent === null) s = document.getElementById('q2'); e.preventDefault(); s.focus(); }
  });
  window.addEventListener('resize', function () { if (openMenu) drawMenu(); });

  /* a state change keeps the keyboard where it was: the controls are rebuilt, so the focused one is found again afterwards */
  function focusKey() {
    var a = document.activeElement; if (!a || a === document.body) return null;
    if (a.id) return '#' + a.id;
    if (a.closest('#views')) return '#views [data-v="' + a.dataset.v + '"]';
    if (a.closest('.seg.phone')) return '.seg.phone [data-v="' + a.dataset.v + '"]';
    if (a.closest('#pills') && a.dataset.p) return '#pills [data-p="' + a.dataset.p + '"]';
    return null;
  }
  function update(keepMenu) {
    var fk = focusKey(), sig = filterSig(); if (lastSig !== null && sig !== lastSig) st.page = 1; lastSig = sig;
    writeUrl(); renderPills(); renderList(); if (openMenu && !keepMenu) drawMenu();
    if (fk && !document.getElementById('menu').contains(document.activeElement)) { var n = document.querySelector(fk); if (n && n !== document.activeElement) n.focus({ preventScroll: true }); }
  }
  ['q', 'q2'].forEach(function (id) { document.getElementById(id).oninput = function (e) { st.q = e.target.value; document.getElementById(id === 'q' ? 'q2' : 'q').value = st.q; update(true); }; });
  document.getElementById('q').value = st.q; document.getElementById('q2').value = st.q;
  lastSig = filterSig(); renderPills(); renderList();
})();
