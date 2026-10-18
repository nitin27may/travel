import type { GLatLngLiteral, GMap, GMarker, GPolyline, GoogleMapsApi } from './google-js/types';

/** Records every call so the Google families are testable without a key or a network. */
export class FakeGoogle {
  calls: { fn: string; args: unknown[] }[] = [];
  maps: GMap[] = [];
  markers: GMarker[] = [];
  polylines: Record<string, unknown>[] = [];
  loads = 0;

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
      fitBounds(b: unknown, padding?: number) { self.rec('fitBounds', b, padding); }
      addListener(ev: string) { self.rec('addListener', ev); return { remove: () => undefined }; }
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
    }
    class FakeBounds { pts: GLatLngLiteral[] = []; extend(p: GLatLngLiteral) { this.pts.push(p); } }
    return { Map: FakeMap, Polyline: FakePolyline, LatLngBounds: FakeBounds, marker: { AdvancedMarkerElement: FakeMarker } };
  }

  loader() {
    return async () => { this.loads += 1; return this.api(); };
  }
}
