/* One dependency-free SVG map for builder, parks and planner (replaces three placeholders). No tiles, no network: points
   are projected (equirectangular, scaled by cos(latitude)) and fitted to the element's pixel width, so pins stay 28 px
   at 320 to 1440 px. Colour comes only from the /themes.css tokens (--map-*, --id-*; no green), so light and dark follow
   data-theme. Re-renders on resize.

   ProtoMap.render(el, {
     days:    [{n, points:[{id, lat, lon, label}]}],   // legs join a day's points in order; pins are numbered 1.. within the day
     extras:  [{id, lat, lon, label}],                 // unnumbered markers (a base, an airport): small square
     outline: [[lat, lon], ...] or [[[lat, lon], ...], ...],   // optional park boundary, drawn closed
     selected: id, height: px (default: 3/4 of width, 220 to 520), label: 'accessible name of the map',
     onPin: function (id, point, dayN) {}   // click, Enter or Space on a pin
   }) -> {update(opts), destroy(), svg}
   Day colours cycle through DAY_COLOURS. Every pin is a focusable role=button with aria-label "Day 2, stop 3: Name". */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var DAY_COLOURS = ['--id-blue', '--id-orange', '--id-rose', '--id-sky', '--id-vermillion', '--id-teal', '--id-yellow'];
  function dayColour(i) { return 'var(' + DAY_COLOURS[i % DAY_COLOURS.length] + ')'; }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function allLL(o) {
    var pts = [];
    (o.days || []).forEach(function (d) { (d.points || []).forEach(function (p) { pts.push(p); }); });
    (o.extras || []).forEach(function (p) { pts.push(p); });
    var ol = o.outline || [];
    var rings = ol.length && typeof ol[0][0] === 'number' ? [ol] : ol;
    rings.forEach(function (r) { r.forEach(function (c) { pts.push({ lat: c[0], lon: c[1] }); }); });
    return { pts: pts, rings: rings };
  }
  /** returns {x(lon), y(lat)} mapping into [pad, W-pad] x [pad, H-pad], aspect preserved */
  function project(pts, W, H, pad) {
    if (!pts.length) return { x: function () { return W / 2; }, y: function () { return H / 2; } };
    var lat0 = pts.reduce(function (s, p) { return s + p.lat; }, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
    var xs = pts.map(function (p) { return p.lon * k; }), ys = pts.map(function (p) { return -p.lat; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = Math.max(maxX - minX, 0.02), h = Math.max(maxY - minY, 0.02);
    var s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
    var ox = (W - w * s) / 2 - minX * s, oy = (H - h * s) / 2 - minY * s;
    return { x: function (lon) { return lon * k * s + ox; }, y: function (lat) { return -lat * s + oy; } };
  }

  function draw(host, o, state) {
    var W = Math.max(240, Math.round(host.clientWidth || 640)), H = Math.round(o.height || Math.min(520, Math.max(220, W * 0.75)));
    var svg = state.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', o.label || 'Map of the stops');
    var a = allLL(o), P = project(a.pts, W, H, 34);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'var(--map-land)' }, svg);
    // outline
    a.rings.forEach(function (r) {
      var d = r.map(function (c, i) { return (i ? 'L' : 'M') + P.x(c[1]).toFixed(1) + ' ' + P.y(c[0]).toFixed(1); }).join('') + 'Z';
      el('path', { d: d, fill: 'var(--map-wood)', 'fill-opacity': '0.5', stroke: 'var(--map-border)', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'aria-hidden': 'true' }, svg);
    });
    var pinLayer = el('g', {}, svg);
    // legs first (under pins)
    (o.days || []).forEach(function (d, di) {
      var pts = d.points || [];
      if (pts.length < 2) return;
      var dd = pts.map(function (p, i) { return (i ? 'L' : 'M') + P.x(p.lon).toFixed(1) + ' ' + P.y(p.lat).toFixed(1); }).join('');
      el('path', { d: dd, fill: 'none', stroke: 'var(--map-casing)', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg);
      el('path', { d: dd, fill: 'none', stroke: dayColour(di), 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg);
    });
    (o.extras || []).forEach(function (p) {
      var g = el('g', { transform: 'translate(' + P.x(p.lon).toFixed(1) + ' ' + P.y(p.lat).toFixed(1) + ')', 'aria-label': p.label || 'Base', role: 'img' }, svg);
      el('rect', { x: -6, y: -6, width: 12, height: 12, rx: 2, fill: 'var(--map-stop)', stroke: 'var(--map-halo)', 'stroke-width': 2 }, g);
    });
    (o.days || []).forEach(function (d, di) {
      (d.points || []).forEach(function (p, i) {
        var sel = o.selected === p.id, x = P.x(p.lon), y = P.y(p.lat);
        var g = el('g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')', role: 'button', tabindex: 0, 'data-pin': p.id, 'data-day': d.n,
          'aria-label': 'Day ' + d.n + ', stop ' + (i + 1) + ': ' + (p.label || p.id), style: 'cursor:pointer;outline:none' }, svg);
        el('circle', { r: 22, fill: 'transparent' }, g); // 44 px touch target
        if (sel) el('circle', { r: 19, fill: 'none', stroke: 'var(--map-select-ring)', 'stroke-width': 3 }, g);
        el('circle', { r: 14, fill: 'var(--map-pin)', stroke: dayColour(di), 'stroke-width': 4 }, g);
        var t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--map-pin-ink)', 'font-size': 13, 'font-weight': 700, 'font-family': 'var(--font-body)', 'aria-hidden': 'true' }, g);
        t.textContent = String(i + 1);
        if (sel && p.label) {
          var tw = Math.min(W - 8, p.label.length * 7.2 + 16), lx = Math.max(4 - x, Math.min(-tw / 2, W - 4 - tw - x)), ly = y > 50 ? -48 : 24;
          el('rect', { x: lx, y: ly, width: tw, height: 24, rx: 6, fill: 'var(--map-pin)', stroke: 'var(--map-border)' }, g);
          var lt = el('text', { x: lx + tw / 2, y: ly + 12, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--map-pin-ink)', 'font-size': 12, 'font-family': 'var(--font-body)', 'aria-hidden': 'true' }, g);
          lt.textContent = p.label;
        }
        function fire() { if (o.onPin) o.onPin(p.id, p, d.n); }
        g.addEventListener('click', fire);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
        g.addEventListener('focus', function () { g.setAttribute('data-focus', 'visible'); g.firstChild.setAttribute('stroke', 'var(--focus)'); g.firstChild.setAttribute('stroke-width', 3); g.firstChild.setAttribute('fill', 'none'); g.firstChild.setAttribute('r', 20); });
        g.addEventListener('blur', function () { g.removeAttribute('data-focus'); g.firstChild.setAttribute('stroke', 'none'); g.firstChild.setAttribute('fill', 'transparent'); g.firstChild.setAttribute('r', 22); });
      });
    });
    var top = svg.querySelector('[data-pin="' + (o.selected || '') + '"]');
    if (top) svg.appendChild(top); // the selected pin and its label sit above every other pin
    void pinLayer;
  }

  function render(host, opts) {
    var state = { opts: opts || {}, svg: el('svg', { xmlns: NS, style: 'display:block;width:100%;max-width:100%;height:auto;border-radius:var(--r-3)' }), last: 0 };
    host.innerHTML = ''; host.appendChild(state.svg);
    function go() { state.last = host.clientWidth; draw(host, state.opts, state); }
    go();
    var ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { if (Math.abs(host.clientWidth - state.last) > 1) go(); }); ro.observe(host); }
    return { svg: state.svg, update: function (o2) { state.opts = o2; go(); }, destroy: function () { if (ro) ro.disconnect(); host.innerHTML = ''; } };
  }

  var api = { render: render, project: project, DAY_COLOURS: DAY_COLOURS };
  root.ProtoMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
