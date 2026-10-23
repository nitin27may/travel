// A stand-in for the Maps JavaScript API that runs in the page: the e2e serves it for the Maps script URL, so the trip map's own code runs
// against real DOM elements without a key or a network. It records what the adapter asks for in window.__fg.
export const FAKE_GOOGLE_JS = `(() => {
  const log = (window.__fg = { maps: 0, markerCreates: 0, polylineCreates: 0, calls: [], mapOpts: null, polylines: [], listeners: {} });
  class FakeMap {
    constructor(el, o) {
      log.maps++; log.mapOpts = o; this.o = o; this.z = o.zoom; this.c = o.center; this.l = {};
      this.layer = document.createElement('div'); this.layer.setAttribute('data-fake-layer', ''); this.layer.style.cssText = 'position:absolute;inset:0';
      el.appendChild(this.layer); window.__fgMap = this;
    }
    panTo(p) { log.calls.push(['panTo', p]); this.c = p; }
    setZoom(z) { log.calls.push(['setZoom', z]); this.z = z; (this.l.zoom_changed || []).forEach((f) => f()); }
    getZoom() { return this.z; }
    getCenter() { return { lat: () => this.c.lat, lng: () => this.c.lng }; }
    fitBounds(b, pad) { log.calls.push(['fitBounds', b.pts.length, pad]); }
    moveCamera(o) { log.calls.push(['moveCamera', o]); }
    getBounds() { return { contains: () => window.__fgInside !== false }; }
    getMapCapabilities() { return { isAdvancedMarkersAvailable: !window.__fgNoMarkers && !!this.o.mapId }; }
    addListener(ev, fn) { (this.l[ev] = this.l[ev] || []).push(fn); if (ev === 'idle') setTimeout(fn, 0); return { remove: () => { this.l[ev] = (this.l[ev] || []).filter((x) => x !== fn); } }; }
  }
  class FakeMarker extends HTMLElement {
    constructor(o) {
      super(); log.markerCreates++;
      this._map = null; this.position = o.position; this.title = o.title || ''; this.zIndex = o.zIndex; this.collisionBehavior = o.collisionBehavior;
      this.setAttribute('data-fake-marker', '');
      if (o.content) this.appendChild(o.content);
      if (o.gmpClickable) {
        this.tabIndex = 0; this.setAttribute('data-clickable', '');
        this.addEventListener('click', () => this.dispatchEvent(new Event('gmp-click')));
        this.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.dispatchEvent(new Event('gmp-click')); } });
      }
      this.map = o.map;
    }
    get map() { return this._map; }
    set map(m) { this._map = m; if (m) m.layer.appendChild(this); else this.remove(); }
  }
  customElements.define('fake-advanced-marker', FakeMarker);
  class FakePolyline { constructor(o) { log.polylineCreates++; this.o = { ...o }; log.polylines.push(this); } setMap(m) { this.map = m; } setOptions(o) { Object.assign(this.o, o); log.calls.push(['setOptions']); } }
  class FakeBounds { constructor() { this.pts = []; } extend(p) { this.pts.push(p); } }
  window.google = { maps: { Map: FakeMap, Polyline: FakePolyline, LatLngBounds: FakeBounds, marker: { AdvancedMarkerElement: FakeMarker }, importLibrary: async () => ({}), event: {} } };
  setTimeout(() => window.__gmapsReady && window.__gmapsReady(), 0);
})();`;
