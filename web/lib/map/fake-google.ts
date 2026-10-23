import type { GLatLngLiteral, GMap, GPadding, GMarker, GPolyline, GoogleMapsApi } from './google-js/types';

/** Records every call so the Google families are testable without a key or a network. */
export class FakeGoogle {
  calls: { fn: string; args: unknown[] }[] = [];
  maps: GMap[] = [];
  markers: GMarker[] = [];
  polylines: Record<string, unknown>[] = [];
  loads = 0;
  /** Map listeners by event name; `emit('idle')` runs them. */
  listeners: Record<string, (() => void)[]> = {};
  emit(ev: string): void { (this.listeners[ev] ?? []).forEach((f) => f()); }

  private rec(fn: string, ...args: unknown[]) { this.calls.push({ fn, args }); }

  api(): GoogleMapsApi {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    class FakeMap implements GMap {
      private z = 8; private c: GLatLngLiteral = { lat: 0, lng: 0 };
      constructor(public el: HTMLElement, public opts: Record<string, unknown>) {
        self.rec('Map', opts); self.maps.push(this);
        if (opts.center) this.c = opts.center as GLatLngLiteral;
        if (typeof opts.zoom === 'number') this.z = opts.zoom;
      }
      panTo(p: GLatLngLiteral) { self.rec('panTo', p); this.c = p; }
      setZoom(z: number) { self.rec('setZoom', z); this.z = z; }
      getZoom() { return this.z; }
      getCenter() { return { lat: () => this.c.lat, lng: () => this.c.lng }; }
      fitBounds(b: unknown, padding?: number | GPadding) { self.rec('fitBounds', b, padding); }
      moveCamera(o: { center?: GLatLngLiteral; zoom?: number }) { self.rec('moveCamera', o); if (o.center) this.c = o.center; if (typeof o.zoom === 'number') this.z = o.zoom; }
      getBounds() { return { contains: () => true }; }
      getMapCapabilities() { return { isAdvancedMarkersAvailable: !!this.opts.mapId }; }
      addListener(ev: string, fn?: () => void) { self.rec('addListener', ev); (self.listeners[ev] ??= []).push(fn ?? (() => undefined)); return { remove: () => undefined }; }
    }
    class FakeMarker implements GMarker {
      position: GLatLngLiteral | null; map: GMap | null; content: HTMLElement | null; title?: string;
      constructor(o: Record<string, unknown>) {
        self.rec('AdvancedMarkerElement', o); self.markers.push(this);
        this.position = (o.position as GLatLngLiteral) ?? null; this.map = (o.map as GMap) ?? null;
        this.content = (o.content as HTMLElement) ?? null; this.title = o.title as string | undefined;
      }
    }
    class FakePolyline implements GPolyline {
      constructor(o: Record<string, unknown>) { self.rec('Polyline', o); self.polylines.push(o); }
      setMap(m: GMap | null) { self.rec('Polyline.setMap', m); }
      setOptions(o: Record<string, unknown>) { self.rec('Polyline.setOptions', o); }
    }
    class FakeBounds { pts: GLatLngLiteral[] = []; extend(p: GLatLngLiteral) { this.pts.push(p); } }
    return { Map: FakeMap, Polyline: FakePolyline, LatLngBounds: FakeBounds, marker: { AdvancedMarkerElement: FakeMarker } };
  }

  loader() {
    return async () => { this.loads += 1; return this.api(); };
  }
}
