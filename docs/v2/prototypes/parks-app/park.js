(function () {
  var P = PROTO, L = LIB, A = APP, esc = A.esc;
  A.header('Parks');
  var q = new URLSearchParams(location.search);
  var slug = q.get('slug') || 'banff-national-park';
  var park = P.PARKS.filter(function (p) { return p.slug === slug; })[0];
  var ctl = { pm: +q.get('pm') || 10, stale: q.get('stale') === '1', closure: q.get('closure') === '1', sd: q.get('sd') || 'held' };
  var app = document.getElementById('app');
  var expanded = {};
  var NEWTAB = ' target="_blank" rel="noopener noreferrer"';

  function today() { return new Date(2026, ctl.pm - 1, 27); }
  function writeUrl() {
    var u = new URLSearchParams(); u.set('slug', slug);
    if (ctl.pm !== 10) u.set('pm', ctl.pm); if (ctl.stale) u.set('stale', '1'); if (ctl.closure) u.set('closure', '1'); if (ctl.sd !== 'held') u.set('sd', ctl.sd);
    history.replaceState(null, '', location.pathname + '?' + u.toString());
  }
  function effSeason() {
    var s = park.season || { kind: 'none' };
    if (ctl.sd === 'none') return { kind: 'none' };
    if (ctl.sd === 'allyear') return { kind: 'allyear', read: '2026-10-27' };
    if (ctl.sd === 'seasonal' && s.kind !== 'seasonal') return { kind: 'seasonal', windows: [['2026-05-15', '2026-10-15']], label: 'May to Oct', from: '15 May', to: '15 Oct', read: '2026-10-27' };
    return s;
  }
  function stale(read, d) { return ctl.stale || L.days(L.iso(read), today()) > d; }
  function closures() {
    var t = today(), c = park.closures || [];
    if (!ctl.closure) return c;
    var first = c[0] || {}, mem = first.member || ((park.todo && park.todo[0] && park.todo[0].items[0]) ? park.todo[0].items[0].name : park.name);
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    return [{ member: mem, msg: first.msg || 'trail and day-use area', from: iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 14)), to: iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30)), read: iso(t), ph: first.ph || !!park.placeholder }];
  }
  function kindWord(p) { return p.kind === 'zone' ? 'Area of ' + p.parent.name : P.KIND_LABEL[p.kind] + ' · ' + p.authority; }
  /* links: every stored URL opens in a new tab; every URL here is a placeholder URL and says so */
  function mapsDir() { return 'https://www.google.com/maps/dir/?api=1&destination=' + park.ll[0] + ',' + park.ll[1]; }
  function mapsPoint() { return 'https://www.google.com/maps/search/?api=1&query=' + park.ll[0] + ',' + park.ll[1]; }
  function ext(url, label, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(url) + '"' + NEWTAB + ' aria-label="' + esc(label) + ', opens in a new tab">' + esc(label) + '<span aria-hidden="true"> ↗</span></a>'; }
  function lk(url, label) { return '<span class="lk" data-ph>' + ext(url, label) + A.ph('Placeholder URL') + '</span>'; }
  function dataPh(on) { return on ? ' data-ph' : ''; }
  function tag(on, text) { return on ? A.ph(text) : ''; }

  /* ---------- pieces ---------- */
  function crumb() {
    var h = '<div class="crumb"><a href="index.html">Parks</a> · <a href="index.html?country=' + park.cc.toLowerCase() + '">' + park.country + '</a> · <a href="index.html?country=' + park.cc.toLowerCase() + '&amp;region=' + park.rc + '">' + park.region + '</a>';
    if (park.parent) h += ' · <a href="park.html?slug=' + park.parent.slug + '">' + esc(park.parent.name) + '</a>';
    return h + '</div>';
  }
  function actions() {
    var saved = A.isSaved(slug), fav = favs().indexOf(slug) >= 0, pv = '';
    if (park.pts >= 3) {
      var b = '/builder/index.html?m=';
      pv = '<div class="planvisit" role="group" aria-labelledby="pv"><span class="lbl" id="pv">Plan a visit</span>' +
        '<a class="btn" href="' + b + 'near&amp;n=0&amp;p=' + slug + '" aria-label="Plan a day trip">Day trip</a>' +
        '<a class="btn" href="' + b + 'near&amp;n=1&amp;p=' + slug + '" aria-label="Plan a visit with 1 night">1 night</a>' +
        '<a class="btn" href="' + b + 'near&amp;n=2&amp;p=' + slug + '" aria-label="Plan a visit with 2 nights">2 nights</a>' +
        '<a class="btn" href="' + b + 'trip&amp;cc=' + park.cc.toUpperCase() + '&amp;p=' + slug + '" aria-label="Plan a longer trip that includes ' + esc(park.name) + '">Part of a longer trip</a></div>';
    }
    return '<div class="actions"><div class="btns"><button class="btn pri" id="save" aria-pressed="' + saved + '">' + (saved ? '✓ Saved' : 'Save to a trip') + '</button>' +
      '<a class="btn" id="dir" href="' + esc(mapsDir()) + '"' + NEWTAB + ' aria-label="Directions to ' + esc(park.name) + ', opens in a new tab">Directions</a>' +
      '<button class="btn ic" id="share" aria-haspopup="dialog" aria-label="Share ' + esc(park.name) + '">&#8599;</button>' +
      '<button class="btn ic" id="fav" aria-label="Favourite" aria-pressed="' + fav + '">' + (fav ? '♥' : '♡') + '</button></div>' + pv + '</div>';
  }
  function favs() { try { return JSON.parse(localStorage.getItem('proto.fav') || '[]'); } catch (e) { return []; } }
  function banner(es) {
    var t = today(), asof = L.dow(t);
    if (es.kind === 'seasonal' && !L.inWindows(es, t)) {
      var txt = es.banner || 'Closed for the season: the park operates ' + es.from + ' to ' + es.to + '.';
      return '<div class="banner info" role="note"><span class="ic" aria-hidden="true">i</span><div>' + esc(txt) + (es.exceptions ? ' ' + esc(es.exceptions) + '.' : '') + '<span class="meta">As of ' + asof + ' · <a href="#seasons">Alerts and closures</a></span></div></div>';
    }
    var cs = closures().filter(function (c) { var f = L.iso(c.from), e = L.iso(c.to); return f <= new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30) && e >= t; });
    if (cs.length) {
      var c = cs[0], st = stale(c.read, 7);
      return '<div class="banner" role="note"' + dataPh(c.ph) + '><span class="ic" aria-hidden="true">!</span><div><a href="#todo">' + esc(c.member) + '</a> closed ' + L.dm(L.iso(c.from)) + ' to ' + L.dmy(L.iso(c.to)) + ': ' + esc(c.msg) + '. ' + esc(park.authority) + ', read ' + L.dmy(L.iso(c.read)) + '. ' + tag(c.ph) + ' ' +
        (st ? '<span class="chip hon">May be out of date</span>' : '') + '<span class="meta">As of ' + asof + (closures().length > 1 ? ' · 1 of ' + closures().length + ' closures, see Seasons and closures' : '') + ' · <a href="#seasons">Current alerts</a></span></div></div>';
    }
    return '';
  }
  /* the glance reads P.facts(), the same function the index chips read (data-fact), so the two cannot disagree */
  function glance(es) {
    var f = P.facts(park, es), t = today(), full = park.level === 'full', gap = function (x) { return '<span class="gapv">' + x + '</span>'; };
    function val(k, inner, sub) { return f[k].gap ? '<b data-fact="' + k + '" class="gapb">' + esc(f[k].text) + '</b>' : '<b data-fact="' + k + '">' + inner + '</b>' + (sub || ''); }
    var season = val('season', esc(f.season.text), es.kind === 'seasonal' ? '<span class="meta">' + (L.inWindows(es, t) ? 'open now' : 'closed now') + (es.from ? ' · ' + es.from + ' to ' + es.to : '') + '</span>' : es.kind === 'allyear' ? '<span class="meta">read ' + L.dmy(L.iso(es.read)) + '</span>' : '');
    var entry = val('entry', f.entry.gap ? '' : '<a class="f" href="#entry">' + esc(f.entry.text) + '</a>', '<span class="meta">' + (full && park.rows ? (park.rows.filter(function (r) { return r.g === 'fees'; }).length ? 'fees and passes' : 'see rows below') : 'details not held') + '</span>');
    var camp = val('camping', esc(f.camping.text), park.glanceCamp ? '<span class="meta">' + esc(park.glanceCamp.s) + '</span>' + tag(f.camping.ph) : '');
    var ap = park.airport ? '<b>' + park.airport.code + '</b><span class="meta">' + esc(park.airport.name) + ' · ' + park.airport.drive + '</span>' + tag(park.airport.ph) : gap('Not checked');
    return '<div class="glance"><div><span class="cap">Season</span>' + season + '</div><div><span class="cap">Entry</span>' + entry + '</div><div' + dataPh(f.camping.ph) + '><span class="cap">Camping</span>' + camp + '</div>' +
      '<div><span class="cap">Places inside</span><b>' + park.places + '</b><span class="meta">in our catalogue</span></div><div' + dataPh(park.airport && park.airport.ph) + '><span class="cap">Nearest airport</span>' + ap + '</div></div>';
  }
  function reqRow(r, glyph) {
    var cls = r.cls || 'price', days = cls === 'window' ? 365 : 120, rd = L.iso(r.read), st = stale(r.read, days);
    var price = esc(r.price) + (st && cls === 'price' ? ' <span class="stale">· read ' + L.mY(rd) + ', may have changed</span>' : '');
    var right = '<span class="chip">' + esc(r.chip) + '</span>' + (st && cls === 'window' ? '<span class="chip hon">! May be out of date</span>' : '') + tag(r.ph);
    var age = st && cls === 'window' ? '<div class="age">Read ' + L.mY(rd) + '; check before you book →</div>' : '';
    var covHtml = r.cov ? '<div class="cov">' + esc(r.cov) + '</div>' : '';
    var more = (cls === 'window' ? '' : covHtml) + (r.ex ? '<div class="ex">' + esc(r.ex) + '</div>' : '') + '<div class="meta">Read ' + L.dmy(rd) + '</div>';
    return '<li' + dataPh(r.ph) + '><span class="glyph" aria-hidden="true">' + glyph + '</span><div class="nm">' + esc(r.name) + '</div><div class="right">' + right + '</div><div class="body">' +
      '<div class="who">' + esc(r.who || '') + '</div><div class="price">' + price + '</div>' + age + '<div class="more">' + more + '</div>' +
      '<div class="lnk">' + (r.link ? lk(r.url, r.link) : '') + '<button type="button" data-more aria-expanded="false">Details ▾</button></div></div></li>';
  }
  function basicsNote() {
    return '<div class="basicsnote" role="note"><b>Basics only</b><span>This park has the index facts and a short place list. Entry detail, safety, seasons, camping and getting there are not researched yet, so the sections below say so instead of guessing.</span></div>';
  }
  function entry() {
    var h = '<section id="entry"><h2>Entry and bookings</h2>';
    if (park.level !== 'full') {
      if (park.entry === 'not_checked') {
        h += '<ul class="req"><li><span class="glyph" aria-hidden="true">T</span><div class="nm">Entry not checked yet</div><div class="right"><span class="chip gap">Not checked</span></div><div class="body"><div class="who">A missing permit can stop a visit: check before you go.</div><div class="lnk">' + lk(park.officialUrl, 'Official page') + (park.alerts ? lk(park.alertsUrl, 'Current alerts') : '') + '</div></div></li></ul>';
      } else {
        h += '<ul class="req"><li' + dataPh(park.placeholder) + '><span class="glyph" aria-hidden="true">T</span><div class="nm">' + esc(P.ENTRY_LABEL[park.entry]) + '</div><div class="right"><span class="chip">' + esc(P.ENTRY_LABEL[park.entry]) + '</span>' + tag(park.placeholder) + '</div><div class="body"><div class="who">Basics only: the row detail (fees, passes, booking windows) is not held for this park.</div><div class="lnk">' + lk(park.officialUrl, 'Official page') + '</div></div></li></ul>';
      }
      return h + '</section>';
    }
    var rows = park.rows || [], own = rows.filter(function (r) { return !r.inh; }), inh = rows.filter(function (r) { return r.inh; });
    var nb = own.filter(function (r) { return r.g === 'book'; }).length, np = own.filter(function (r) { return r.g === 'fees'; }).length, nc = (park.camps || []).length;
    var latest = rows.map(function (r) { return r.read; }).sort().pop();
    var parts = []; if (nb) parts.push(nb + ' to book ahead'); if (np) parts.push(np + ' pass' + (np > 1 ? 'es' : '') + ' or fee'); if (inh.length) parts.push(inh.length + ' from ' + inh[0].inh); if (nc) parts.push(nc + (nc === 1 ? ' campground' : ' campgrounds') + ' (windows under Where to stay)');
    h += '<div class="stateline">' + esc(parts.join(' · ')) + ' · checked ' + L.dmy(L.iso(latest)) + '</div>';
    [['book', 'Book ahead'], ['fees', 'Passes and fees'], ['day', 'On the day']].forEach(function (g) {
      var rs = own.filter(function (r) { return r.g === g[0]; }); if (!rs.length) return;
      h += '<h3>' + g[1] + ' (' + rs.length + ')</h3><ul class="req">' + rs.map(function (r) { return reqRow(r, 'T'); }).join('') + '</ul>';
    });
    if (inh.length) h += '<h3>From ' + esc(inh[0].inh) + ' (' + inh.length + ')</h3><ul class="req">' + inh.map(function (r) { return reqRow(r, 'T'); }).join('') + '</ul>';
    return h + '</section>';
  }
  function safety() {
    var s = park.safety;
    if (park.level !== 'full') return '<section id="safety" class="safety"><h2>Safety and rules</h2>' + (park.alerts ? '<p>' + lk(park.alertsUrl, park.alerts) + ' for fire bans, closures and wildlife. Wildlife rules: <span class="chip gap">not researched yet</span></p>' : '<p><span class="chip gap">Not checked yet</span></p>') + '</section>';
    return '<section id="safety" class="safety"' + dataPh(s.ph) + '><h2>Safety and rules ' + tag(s.ph) + '</h2>' + (s.wildlife ? '<p>' + esc(s.wildlife) + '</p>' : '<p><span class="chip gap">Wildlife: not checked yet</span></p>') +
      '<p>Alerts, fire bans and wildlife closures change daily: ' + lk(s.alertsUrl, s.alerts) + '</p></section>';
  }
  function pins() {
    var pts = []; (park.todo || []).forEach(function (k) { k.items.forEach(function (it) { if (it.pt) pts.push(it.name); }); });
    function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000; return h; }
    return '<div class="map" role="img" aria-label="Stand-in map with ' + (pts.length || 'no') + ' pins">' + pts.slice(0, 14).map(function (n) { var h = hash(n); return '<span class="pin" style="left:' + (12 + h % 76) + '%;top:' + (14 + (h * 7) % 70) + '%"></span>'; }).join('') + '</div>';
  }
  function phoneMap() { return '<div class="phonemap">' + pins() + '<p class="meta">Pins mark places we hold; no park boundary is drawn. ' + ext(mapsPoint(), 'Open map') + '</p></div>'; }
  function seasons(es) {
    var t = today(), h = '<section id="seasons"><h2>Seasons and closures</h2>';
    if (es.kind === 'none') h += '<p><span class="chip gap">Operating season: not checked yet</span></p>';
    else if (es.kind === 'allyear') h += '<p>Open all year, read ' + L.dmy(L.iso(es.read)) + '</p>';
    else {
      var open = [], closed = [];
      var cells = L.MON.map(function (m, i) { var s = L.monthStatus(es, i); (s === 'closed' ? closed : open).push(L.MONFULL[i]); return '<li class="' + s + (i === t.getMonth() ? ' now' : '') + '" aria-hidden="true">' + m + '<i>' + (s === 'closed' ? 'closed' : s) + '</i></li>'; }).join('');
      h += '<ul class="strip" role="img" aria-label="Open: ' + open.join(', ') + '. Closed: ' + closed.join(', ') + '.">' + cells + '</ul><p class="meta">Operating season, read ' + L.dmy(L.iso(es.read)) + ' · filled = open, hatched foot = part of the month, cross-hatch = closed, outline = this month</p>';
      if (es.exceptions) h += '<p class="cov">' + esc(es.exceptions) + '</p>';
    }
    (park.services || []).forEach(function (s) { h += '<p class="cov"' + dataPh(park.placeholder) + '>' + esc(s) + ' ' + tag(park.placeholder) + '</p>'; });
    closures().forEach(function (c) {
      var stl = stale(c.read, 7);
      h += '<p class="cov"' + dataPh(c.ph) + '>Closed ' + L.dm(L.iso(c.from)) + ' to ' + L.dmy(L.iso(c.to)) + ': ' + esc(c.member) + ' ' + esc(c.msg) + ' (read ' + L.dmy(L.iso(c.read)) + ') ' + (stl ? '<span class="chip hon">May be out of date</span>' : '') + tag(c.ph) + '</p>';
    });
    return h + '<p class="meta">' + lk(park.alertsUrl, 'Current alerts and closures: ' + park.authority + ' bulletins') + '</p></section>';
  }
  function stay() {
    var h = '<section id="stay"><h2>Where to stay or camp</h2>';
    if (park.camps && park.camps.length) h += '<ul class="req">' + park.camps.map(function (c) { return reqRow({ g: 'camp', cls: 'window', name: c.name, chip: c.chip, who: c.sites + ' · ' + c.who, price: c.price, cov: c.win, read: c.read, link: c.link, url: c.url, ph: c.ph }, 'C'); }).join('') + '</ul>';
    else h += '<p><span class="chip gap">Campgrounds: not checked yet</span></p>';
    if (park.gatewayTowns) h += '<p class="cov"' + dataPh(park.placeholder || (park.gateway && park.gateway.ph)) + '>Gateway towns: ' + esc(park.gatewayTowns) + ' ' + tag(park.placeholder || (park.gateway && park.gateway.ph)) + '</p>';
    return h + '</section>';
  }
  function placeCard(it) {
    var ps = A.placeSlug(park, it.name), sv = A.isSaved(ps);
    return '<div class="pcard"><div class="ph" aria-hidden="true"></div><div class="bd"><b>' + esc(it.name) + '</b><div class="chips">' + it.chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + (it.pt ? '' : '<span class="chip gap">No map point</span>') + '</div></div>' +
      '<div class="act"><button class="btn sm" data-psave="' + esc(ps) + '" aria-pressed="' + sv + '" aria-label="Save ' + esc(it.name) + '">' + (sv ? '✓ Saved' : 'Save') + '</button><a class="btn sm" href="/builder/index.html?add=' + encodeURIComponent(ps) + '&amp;p=' + slug + '" aria-label="Add ' + esc(it.name) + ' to a trip">Add to a trip</a></div></div>';
  }
  function todo() {
    var ks = park.todo || [], compact = park.level !== 'full';
    var name = compact ? 'Places inside' : 'Things to do';
    if (!ks.length) return '<section id="todo"><h2>' + name + '</h2><p class="cov">' + park.places + ' places in our catalogue; the list is not held in this prototype.</p></section>';
    var h = '<section id="todo"><h2>' + name + '</h2>' + (park.placeholder ? '<p class="meta" data-ph>' + A.ph() + ' list: the names, counts and distances are invented for this prototype.</p>' : '') + '<div class="counts">' + ks.map(function (k) {
      var m = P.KINDS[k.id]; return '<button class="count" data-kind="' + k.id + '"><b>' + k.count + ' ' + m[k.count === 1 ? 0 : 1] + '</b><span>' + (k.count > 3 ? 'Show all' : m[2]) + '</span></button>'; }).join('') + '</div>';
    ks.forEach(function (k) {
      var m = P.KINDS[k.id], ex = !!expanded[k.id], list = ex ? k.items : k.items.slice(0, 3);
      h += '<div class="grouphd"><b id="g-' + k.id + '" tabindex="-1">' + m[1][0].toUpperCase() + m[1].slice(1) + '</b>' + (k.count > 3 ? '<button data-expand="' + k.id + '" aria-expanded="' + ex + '">' + (ex ? 'Show fewer' : 'Show all ' + k.count + ' ' + m[1]) + '</button>' : '') + '</div><div class="cards">' + list.map(placeCard).join('') + '</div>';
      if (ex && k.items.length < k.count) h += '<p class="notice-small">Prototype lists ' + k.items.length + ' of ' + k.count + '; the real page lists all.</p>';
    });
    if (park.areas) h += '<p class="meta">Areas inside: ' + park.areas.map(function (a) { return a.nolink ? esc(a.name) : '<a href="park.html?slug=' + a.slug + '">' + esc(a.name) + '</a>'; }).join(' · ') + '</p>';
    return h + '</section>';
  }
  function areasOnly() { return park.areas && !(park.todo || []).length ? '<p class="meta">Areas inside: ' + park.areas.map(function (a) { return '<a href="park.html?slug=' + a.slug + '">' + esc(a.name) + '</a>'; }).join(' · ') + '</p>' : ''; }
  function gettingThere() {
    var h = '<section id="getting-there"><h2>Getting there</h2>';
    if (park.airport) h += '<p' + dataPh(park.airport.ph) + '>Nearest airport: ' + esc(park.airport.name) + ' (' + park.airport.code + '), about ' + park.airport.drive + ' by car. ' + tag(park.airport.ph) + '</p>';
    else h += '<p><span class="chip gap">Getting there: not checked yet</span></p>';
    if (park.gateway) h += '<p class="cov"' + dataPh(park.gateway.ph) + '>Gateway: ' + esc(park.gateway.town) + (park.gateway.note ? ', ' + esc(park.gateway.note) : '') + ' ' + tag(park.gateway.ph) + '</p>';
    if (park.transit && park.transit.length) h += '<p class="meta">Transit and shuttles: ' + park.transit.map(function (x) { return lk(P.URL_BASE + slug + '/' + A.slugify(x), x); }).join(' · ') + '</p>';
    return h + '<p><a class="btn" data-dir href="' + esc(mapsDir()) + '"' + NEWTAB + ' aria-label="Directions to the visitor centre, opens in a new tab">Directions to the visitor centre</a></p></section>';
  }
  function notChecked() {
    var nc = park.notChecked; if (!nc || !nc.length) return '';
    return '<section id="not-checked"><div class="cap">' + (park.level === 'full' ? 'Not checked yet' : 'Not researched yet') + '</div><dl class="nc">' + nc.map(function (x) { return '<dt>' + esc(x[0]) + '</dt>' + (x[1] ? '<dd>' + esc(x[1]) + '</dd>' : ''); }).join('') + '</dl></section>';
  }
  function sources() {
    return '<section id="sources"><h2>Sources</h2><ul class="cov srcs">' + park.sources.map(function (x) {
      return '<li data-ph>' + ext(x.url, x.title) + ' · read ' + esc(x.read) + ' ' + A.ph('Placeholder URL') + '<span class="urlx">' + esc(x.url.replace(/^https?:\/\//, '')) + '</span></li>'; }).join('') + '</ul></section>';
  }
  function side() {
    return '<aside class="side" aria-label="About this park"><div>' + pins() + '<p class="meta">Pins mark places we hold; no park boundary is drawn.</p></div>' +
      (park.trips && park.trips.length ? '<div class="trips"><div class="cap">In public trips</div>' + park.trips.map(function (t) { return '<p><a href="../planner/index.html">' + esc(t.name) + '</a> · ' + esc(t.days) + '</p>'; }).join('') + '</div>' : '') +
      '<div class="links" data-ph><div class="cap">Links</div><p class="mono">' + ext(park.officialUrl, 'Official') + ' · ' + ext(park.feesUrl, 'Fees') + ' · ' + ext(park.alertsUrl, 'Alerts') + '</p><p class="meta">' + A.ph('Placeholder URLs') + ' links read ' + L.dmy(today()) + ' (prototype)</p></div>' +
      '<div class="auth"><div class="cap">Managed by</div><p>' + esc(park.authority) + '</p></div></aside>';
  }

  function render(focusSel) {
    if (!park) { app.innerHTML = '<div class="wrap"><h1>Park not found</h1><p><a href="index.html">Back to Parks</a></p></div>'; return; }
    document.title = park.name + ' (prototype)';
    var es = effSeason(), full = park.level === 'full';
    var cover = '<div class="cover' + (full ? '' : ' compact') + '">' + crumb() + (full ? '' : '<span class="band">' + (park.level === 'basics' && !park.placeholder ? 'No licensed photo yet' : 'No photo in this prototype') + '</span>') + '<div class="in"><div class="kicker">' + esc(kindWord(park)) + ' · ' + esc(park.region) + '</div><h1 class="title">' + esc(park.name) + '</h1>' +
      '<div class="compl">' + (park.placeholder ? '<span class="ph">Placeholder data</span>' : '') + (park.level === 'basics' ? '<span class="state">Basics only</span>' : '') + '</div></div></div>';
    var main = entry() + safety() + phoneMap() + (full ? seasons(es) + stay() : '') + todo() + (full ? gettingThere() : areasOnly()) + notChecked() + sources();
    app.innerHTML = cover + actions() + '<div class="wrap">' +
      (park.placeholder ? '<div class="protonote">Placeholder: ' + esc(park.name) + ' is not researched yet. Every fact on this page is invented to show the page shape.</div>' : '') +
      (full ? '' : basicsNote()) + banner(es) + glance(es) + '<div class="grid"><main>' + main + '</main>' + side() + '</div></div>';
    wire();
    if (focusSel) { var f = document.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
  }

  function copyText(text, input) {
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
    return p.then(function () { return true; }, function () { try { input.focus(); input.select(); return document.execCommand('copy'); } catch (e) { return false; } });
  }
  /* Share: the system sheet when the browser has one, else our own sheet with a copy-link button and a confirmation */
  function openShare(opener) {
    var url = location.origin + location.pathname + '?slug=' + slug;
    function ownSheet() {
      A.layer({ cls: 'sheet', id: 'sharesheet', label: 'Share ' + park.name, opener: opener, initial: '#copylink',
        html: '<button class="btn ic x" aria-label="Close share" data-close>&times;</button><h2>Share ' + esc(park.name) + '</h2><label class="sharelbl">Link<input id="sharelink" class="search" readonly value="' + esc(url) + '"></label>' +
          '<div class="btns"><button class="btn pri" id="copylink">Copy link</button><a class="btn" id="mailshare" href="mailto:?subject=' + encodeURIComponent(park.name) + '&amp;body=' + encodeURIComponent(url) + '">Email it</a></div><p class="cov" id="sharemsg" role="status"></p>',
        mount: function (d) {
          d.querySelector('#copylink').onclick = function () {
            copyText(url, d.querySelector('#sharelink')).then(function (ok) { d.querySelector('#sharemsg').textContent = ok ? 'Link copied' : 'Select the link and copy it'; });
          };
        } });
    }
    if (navigator.share) { navigator.share({ title: park.name, text: park.name + ' on Trip Plans', url: url }).catch(function (err) { if (!err || err.name !== 'AbortError') ownSheet(); }); return; }
    ownSheet();
  }
  function wire() {
    var sv = document.getElementById('save'); sv.onclick = function () { var on = A.toggleSaved(slug); A.toast(on ? 'Saved to your trip list' : 'Removed from saved'); };
    document.getElementById('fav').onclick = function () { var f = favs(), i = f.indexOf(slug); if (i >= 0) f.splice(i, 1); else f.push(slug); try { localStorage.setItem('proto.fav', JSON.stringify(f)); } catch (e) {} render('#fav'); };
    document.getElementById('share').onclick = function (e) { openShare(e.currentTarget); };
    app.querySelectorAll('[data-more]').forEach(function (b) { b.onclick = function () { var li = b.closest('li'); li.classList.toggle('open'); b.setAttribute('aria-expanded', li.classList.contains('open')); b.textContent = li.classList.contains('open') ? 'Details ▴' : 'Details ▾'; }; });
    app.querySelectorAll('[data-expand]').forEach(function (b) { b.onclick = function () { expanded[b.dataset.expand] = !expanded[b.dataset.expand]; keepScroll('[data-expand="' + b.dataset.expand + '"]'); }; });
    app.querySelectorAll('[data-kind]').forEach(function (b) { b.onclick = function () { var k = b.dataset.kind; expanded[k] = true; render(); var g = document.getElementById('g-' + k); if (g) { g.scrollIntoView({ block: 'start' }); g.focus({ preventScroll: true }); } }; });
    app.querySelectorAll('[data-psave]').forEach(function (b) { b.onclick = function () { var on = A.toggleSaved(b.dataset.psave); b.setAttribute('aria-pressed', on); b.textContent = on ? '✓ Saved' : 'Save'; }; });
  }
  function keepScroll(focusSel) { var y = window.scrollY; render(focusSel); window.scrollTo(0, y); }
  document.addEventListener('saved-changed', function () {
    var sv = document.getElementById('save'); if (!sv) return; var on = A.isSaved(slug); sv.setAttribute('aria-pressed', on); sv.textContent = on ? '✓ Saved' : 'Save to a trip';
    app.querySelectorAll('[data-psave]').forEach(function (b) { var o = A.isSaved(b.dataset.psave); b.setAttribute('aria-pressed', o); b.textContent = o ? '✓ Saved' : 'Save'; });
  });

  /* ---------- prototype controls ---------- */
  function controls() {
    var c = document.getElementById('ctl'), open = false;
    function draw(focusId) {
      c.innerHTML = '<button id="ctlb" aria-expanded="' + open + '" aria-controls="ctlpnl">Prototype controls</button>' + (open ? '<div class="pnl" id="ctlpnl" role="group" aria-label="Prototype controls">' +
        '<label>Month (today is the 27th)<select id="c-m">' + L.MONFULL.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (ctl.pm === i + 1 ? ' selected' : '') + '>' + m + ' 2026' + (i === 9 ? ' (now)' : '') + '</option>'; }).join('') + '</select></label>' +
        '<label>Season data<select id="c-s">' + [['held', 'As held'], ['none', 'Not checked'], ['allyear', 'Open all year'], ['seasonal', 'Seasonal, May to Oct']].map(function (o) { return '<option value="' + o[0] + '"' + (ctl.sd === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="chk"><input type="checkbox" id="c-st"' + (ctl.stale ? ' checked' : '') + '> Force stale data</label><label class="chk"><input type="checkbox" id="c-cl"' + (ctl.closure ? ' checked' : '') + '> Force a dated closure</label>' +
        '<span class="meta">Settings live in the URL, so each state has an address.</span></div>' : '');
      c.querySelector('#ctlb').onclick = function () { open = !open; draw('ctlb'); };
      if (open) {
        c.querySelector('#c-m').onchange = function (e) { ctl.pm = +e.target.value; apply(); };
        c.querySelector('#c-s').onchange = function (e) { ctl.sd = e.target.value; apply(); };
        c.querySelector('#c-st').onchange = function (e) { ctl.stale = e.target.checked; apply(); };
        c.querySelector('#c-cl').onchange = function (e) { ctl.closure = e.target.checked; apply(); };
      }
      if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    }
    c.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { open = false; draw('ctlb'); } });
    function apply() { writeUrl(); keepScroll(); }
    draw();
  }
  render(); controls();
})();
