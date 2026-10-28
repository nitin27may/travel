/* THROWAWAY prototype: the planner's service worker (scope /planner/, so it needs localhost or https).
   - install: precaches the planner shell (pages, scripts, styles), the shared scripts, builder/data.js, themes.css and fonts;
   - fetch: same-origin GETs go network first and fall back to the cache, so an edit shows at once online and Today still
     loads offline (a page opened with ?id=... falls back to the cached page, the trip itself comes from this device);
   - message {type:'cache-trip', id, json}: keeps a copy of the open trip, which the page restores if the browser lost it. */
const VERSION = 'planner-shell-v1';
const TRIPS = 'planner-trips-v1';
const SHELL = [
  '/planner/', '/planner/index.html', '/planner/trip.html', '/planner/today.html', '/planner/print.html',
  '/planner/planner.css', '/planner/shared.js', '/planner/dates.js', '/planner/glue.js', '/planner/index.js', '/planner/trip.js', '/planner/today.js', '/planner/print.js',
  '/shared/contract.js', '/shared/sun.js', '/shared/ics.js', '/shared/map.js', '/shared/engine.js', '/builder/data.js', '/themes.css',
  '/fonts/big-shoulders-display-latin-wght-normal.woff2', '/fonts/source-serif-4-latin-wght-normal.woff2', '/fonts/source-serif-4-latin-wght-italic.woff2',
  '/fonts/ibm-plex-mono-latin-400-normal.woff2', '/fonts/ibm-plex-mono-latin-500-normal.woff2', '/fonts/ibm-plex-mono-latin-600-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TRIPS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/planner/__trip/')) {
    event.respondWith(caches.open(TRIPS).then((c) => c.match(req)).then((r) => r || new Response('', { status: 404 })));
    return;
  }
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((r) => r || (req.mode === 'navigate' ? caches.match('/planner/index.html') : Response.error())))
  );
});
self.addEventListener('message', (event) => {
  const m = event.data || {};
  if (m.type === 'cache-trip' && m.id) {
    event.waitUntil(caches.open(TRIPS).then((c) => c.put('/planner/__trip/' + encodeURIComponent(m.id) + '.json', new Response(m.json, { headers: { 'content-type': 'application/json' } }))));
  }
});
