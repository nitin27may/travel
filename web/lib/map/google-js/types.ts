/** The few Google Maps JavaScript API members the adapter calls. Kept minimal so tests can fake them. */
export interface GLatLngLiteral { lat: number; lng: number }
export interface GMap {
  panTo(p: GLatLngLiteral): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  getCenter(): { lat(): number; lng(): number } | undefined;
  fitBounds(b: unknown, padding?: number): void;
  addListener(ev: string, fn: () => void): { remove(): void };
}
export interface GMarker { position: GLatLngLiteral | null; map: GMap | null; content?: HTMLElement | null; title?: string }
export interface GPolyline { setMap(m: GMap | null): void }
export interface GoogleMapsApi {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  LatLngBounds: new () => { extend(p: GLatLngLiteral): void };
  marker: { AdvancedMarkerElement: new (opts: Record<string, unknown>) => GMarker };
  event?: { addListenerOnce?: (...a: unknown[]) => void };
}
export interface GoogleLoadOptions { key: string; mapId?: string }
export type GoogleLoader = (opts: GoogleLoadOptions) => Promise<GoogleMapsApi>;
